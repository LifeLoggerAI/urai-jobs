#!/usr/bin/env python3
"""Offline COLMAP v3 successor from independent reprojection and match support.

Only original features may be reassociated. A candidate must have independent
excluded-camera geometric and original source-match support, plus unchanged
within-model held-out camera observations. Originals are never modified.
This is sparse structural optimization, NOT photographic training admission.
"""
import argparse, collections, importlib.util, json, math, pathlib, sqlite3, statistics, struct


def load(name):
    path=pathlib.Path(__file__).with_name(name)
    spec=importlib.util.spec_from_file_location(name.replace('-','_').replace('.','_'),path)
    mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
    return mod


repair=load('captured-reality-colmap-track-repair.py')
geom=load('captured-reality-colmap-geometric-triage.py')


def p95(values):
    v=sorted(values)
    if not v:return 0.
    pos=.95*(len(v)-1);i=int(pos)
    return v[i]+(v[min(i+1,len(v)-1)]-v[i])*(pos-i)


def residuals(pairs,images,xyz):
    return [math.dist(repair.reproject(images[iid],xyz),images[iid]['obs'][index]['xy']) for iid,index in pairs]


def robust_optimize(pairs,images,start,iterations=16,huber=1.25):
    """Damped finite-Jacobian 3D Gauss-Newton with Huber loss; fixed poses."""
    point=tuple(start)
    def cost(x):
        return sum(.5*r*r if r<=huber else huber*(r-.5*huber) for r in residuals(pairs,images,x))
    current=cost(point)
    for _ in range(iterations):
        lhs=[[0.]*3 for _ in range(3)]
        rhs=[0.]*3
        for iid,index in pairs:
            image=images[iid]
            ox,oy=image['obs'][index]['xy']
            px,py=repair.reproject(image,point)
            dx,dy=px-ox,py-oy
            weight=min(1.,huber/max(1e-10,math.hypot(dx,dy)))
            jac=[]
            for axis in range(3):
                h=1e-5*max(1.,abs(point[axis]))
                check=list(point);check[axis]+=h
                qx,qy=repair.reproject(image,check)
                jac.append(((qx-px)/h,(qy-py)/h))
            for i in range(3):
                rhs[i]+=weight*(jac[i][0]*dx+jac[i][1]*dy)
                for j in range(3):
                    lhs[i][j]+=weight*(jac[i][0]*jac[j][0]+jac[i][1]*jac[j][1])
        for i in range(3):lhs[i][i]+=1e-6
        change=geom.solve3(lhs,[-value for value in rhs])
        if change is None:break
        improved=False
        for alpha in (1.,.5,.25,.125,.0625):
            candidate=tuple(point[i]+alpha*change[i] for i in range(3))
            try:value=cost(candidate)
            except (ValueError,OverflowError,ZeroDivisionError):continue
            if value<current-1e-10:
                current=value;point=candidate;improved=True;break
        if not improved:break
    return point


def source_match_votes(database,original_images,ambiguous):
    votes=collections.Counter()
    with sqlite3.connect(pathlib.Path(database).resolve().as_uri()+'?mode=ro',uri=True) as con:
        for pair_id,count,cols,data in con.execute('SELECT pair_id,rows,cols,data FROM two_view_geometries'):
            if not data or not count:continue
            iid,jid=divmod(pair_id,2147483647)
            if iid not in original_images or jid not in original_images:continue
            if cols!=2 or len(data)!=count*8:raise ValueError('ORIGINAL_MATCH_GRAPH_INVALID')
            first,second=original_images[iid]['obs'],original_images[jid]['obs']
            for i,j in struct.iter_unpack('<II',data):
                if i>=len(first) or j>=len(second):raise ValueError('SOURCE_MATCH_FEATURE_OUT_OF_RANGE')
                pid=first[i]['pid']
                if pid>0 and pid==second[j]['pid']:
                    if (pid,iid) in ambiguous:votes[pid,iid,i]+=1
                    if (pid,jid) in ambiguous:votes[pid,jid,j]+=1
    return votes


def apply(original,derivative,database,destination):
    original,derivative,database,destination=map(pathlib.Path,(original,derivative,database,destination))
    if destination.exists():raise ValueError('REFUSE_EXISTING_OUTPUT')
    source=load('captured-reality-colmap-match-consistency.py').inspect(original,derivative,database)
    if source['training_permitted'] or source['selection_inlier_support']['less_supported']<=0:
        raise ValueError('EXPECTED_ORIGINAL_AMBIGUITY_MISSING')
    _,details=geom.review(original,derivative,database)
    cameras=repair.cameras_from((original/'cameras.bin').read_bytes())
    original_images=repair.images_from((original/'images.bin').read_bytes(),cameras)
    images=repair.images_from((derivative/'images.bin').read_bytes(),cameras)
    points=repair.points_from((derivative/'points3D.bin').read_bytes())
    by_id={p['id']:p for p in points}
    ambiguous=collections.defaultdict(list)
    for point in repair.points_from((original/'points3D.bin').read_bytes()):
        for iid,index in point['track']:ambiguous[point['id'],iid].append(index)
    ambiguous={key:idxs for key,idxs in ambiguous.items() if len(idxs)>1}
    votes=source_match_votes(database,original_images,ambiguous)
    v2audit=json.loads((derivative/'track-disambiguation-audit.json').read_text())
    chosen={(r['point_id'],r['image_id']):r['retained_index'] for r in v2audit['changes']}
    views={iid:geom.camera_view(image) for iid,image in images.items()}
    proposals={}
    for row in details:
        key=row['point_id'],row['image_id']
        if row['source_match_support']!='matches_alternative' or row['loo_geometry']!='geometry_alternative':
            continue
        pid,iid=key
        selected=chosen[key]
        alternatives=[idx for idx in ambiguous[key] if idx!=selected]
        best=max(alternatives,key=lambda idx:(votes[pid,iid,idx],-idx))
        if votes[pid,iid,best]<=votes[pid,iid,selected]:continue
        others=[(i,j) for i,j in by_id[pid]['track'] if i!=iid]
        fit=geom.triangulate(others,images,views)
        if fit is None:continue
        xyz,angle=fit
        before=math.dist(repair.reproject(images[iid],xyz),original_images[iid]['obs'][selected]['xy'])
        after=math.dist(repair.reproject(images[iid],xyz),original_images[iid]['obs'][best]['xy'])
        if angle<2. or before-after<.25 or after>2.5:continue
        proposals[key]={'from':selected,'to':best,'before_loo':before,'after_loo':after,
                        'source_support_old':votes[pid,iid,selected],'source_support_new':votes[pid,iid,best]}
    by_point=collections.defaultdict(list)
    for (pid,iid),choice in sorted(proposals.items()):by_point[pid].append((iid,choice))
    output_images=bytearray((derivative/'images.bin').read_bytes())
    output_points=bytearray(struct.pack('<Q',len(points)))
    accepted=[];rejected=[];retriangulated=0
    for point in points:
        pid=point['id'];changes=by_point.get(pid,[])
        track=list(point['track'])
        xyz=tuple(point['xyz'])
        if changes:
            trial=[]
            for iid,index in track:
                choice=next((change for id_,change in changes if id_==iid),None)
                trial.append((iid,choice['to'] if choice else index))
            fitted=[pair for pair in trial if pair[0]%5!=pid%5]
            held=[pair for pair in trial if pair[0]%5==pid%5]
            if len(fitted)<6 or len(held)<2:
                rejected.extend({'point_id':pid,'image_id':iid,'reason':'INSUFFICIENT_CAMERA_HOLDOUT'} for iid,_ in changes)
            else:
                try:
                    old_held=residuals(held,images,xyz)
                    seed=geom.triangulate(fitted,images,views)
                    start=seed[0] if seed else xyz
                    partial=robust_optimize(fitted,images,start)
                    fresh_held=residuals(held,images,partial)
                    switched={iid for iid,_ in changes}
                    held_safe=[(old,new) for (iid,_),old,new in zip(held,old_held,fresh_held) if iid not in switched]
                    if len(held_safe)<2:raise ValueError('NO_INDEPENDENT_UNCHANGED_CAMERA_HOLDOUT')
                    old_med=statistics.median(old for old,new in held_safe)
                    new_med=statistics.median(new for old,new in held_safe)
                    if new_med>old_med+.10:raise ValueError('INDEPENDENT_CAMERA_HOLDOUT_REGRESSED')
                    refined=robust_optimize(trial,images,partial)
                    old_rs=residuals(track,images,xyz)
                    new_rs=residuals(trial,images,refined)
                    if p95(new_rs)>p95(old_rs)+.20 or max(new_rs)>max(old_rs)+.25:
                        raise ValueError('REPROJECTION_TAIL_REGRESSED')
                    for iid,decision in changes:
                        old=images[iid]['obs'][decision['from']]
                        new=images[iid]['obs'][decision['to']]
                        if old['pid']!=pid or new['pid']!=-1:
                            raise ValueError('SOURCE_FEATURE_AUTHORITY_CHANGED')
                    track=trial;xyz=refined
                    for iid,decision in changes:
                        struct.pack_into('<q',output_images,images[iid]['obs'][decision['from']]['pid_offset'],-1)
                        struct.pack_into('<q',output_images,images[iid]['obs'][decision['to']]['pid_offset'],pid)
                        accepted.append({'point_id':pid,'image_id':iid,
                                         'old_index':decision['from'],'new_index':decision['to'],
                                         'old_holdout_median_px':old_med,'new_holdout_median_px':new_med,
                                         'old_source_match_votes':decision['source_support_old'],
                                         'new_source_match_votes':decision['source_support_new']})
                except (ValueError,ZeroDivisionError,OverflowError) as error:
                    rejected.extend({'point_id':pid,'image_id':iid,'reason':str(error)} for iid,_ in changes)
        header=bytearray(point['head'])
        if xyz!=tuple(point['xyz']):
            retriangulated+=1
            struct.pack_into('<3d',header,8,*xyz)
            struct.pack_into('<d',header,len(header)-8,statistics.mean(residuals(track,images,xyz)))
        output_points.extend(header)
        output_points.extend(struct.pack('<Q',len(track)))
        for iid,index in track:output_points.extend(struct.pack('<II',iid,index))
    out_images=repair.images_from(output_images,cameras)
    out_points=repair.points_from(output_points)
    if len(out_points)!=len(points):raise ValueError('POINT_COUNT_CHANGED')
    total=0
    for point in out_points:
        if len({iid for iid,_ in point['track']})!=len(point['track']):
            raise ValueError('DUPLICATE_TRACK_REINTRODUCED')
        for iid,index in point['track']:
            if out_images[iid]['obs'][index]['pid']!=point['id']:
                raise ValueError('RECIPROCAL_TRACK_BROKEN')
            total+=1
    if total!=sum(len(point['track']) for point in points):raise ValueError('TRACK_COUNT_CHANGED')
    if not accepted:raise ValueError('NO_JUSTIFIABLE_ASSOCIATIONS')
    destination.mkdir(parents=True,exist_ok=False)
    for filename in ('cameras.bin','rigs.bin','frames.bin'):
        if (derivative/filename).exists():
            (destination/filename).write_bytes((derivative/filename).read_bytes())
    (destination/'images.bin').write_bytes(output_images)
    (destination/'points3D.bin').write_bytes(output_points)
    hashes={name:{'before_sha256':repair.digest(derivative/name),
                  'after_sha256':repair.digest(destination/name)}
            for name in ('cameras.bin','images.bin','points3D.bin')}
    receipt={'schema':'urai-colmap-evidence-adjudicated-v3',
             'classification':'EXPERIMENTAL_GEOMETRIC_DERIVATIVE_NOT_TRAINING_ADMISSION',
             'prior_model':str(derivative),'original_model':str(original),
             'source_matches_disputed':source['selection_inlier_support']['less_supported'],
             'double_supported_proposals':len(proposals),
             'accepted_feature_reassociations':len(accepted),
             'rejected_feature_reassociations':len(rejected),
             'retriangulated_points_changed':retriangulated,
             'registered_images_preserved':len(out_images),
             'sparse_points_preserved':len(out_points),
             'track_count_preserved':total,'camera_poses_unchanged':True,
             'raw_feature_coordinates_unchanged':True,'training_permitted':False,
             'independent_novel_view_psnr':None,'independent_visual_approval':False,
             'file_hashes':hashes}
    (destination/'v3-adjudication-audit.private.json').write_text(
        json.dumps({'receipt':receipt,'accepted':accepted,'rejected':rejected},indent=2)+'\n')
    return receipt


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--original',required=True)
    parser.add_argument('--v2',required=True)
    parser.add_argument('--database',required=True)
    parser.add_argument('--v3',required=True)
    args=parser.parse_args()
    print(json.dumps(apply(args.original,args.v2,args.database,args.v3),indent=2))
