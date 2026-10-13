#!/usr/bin/env python3
"""Read-only geometric triage of COLMAP track ambiguity using original inlier edges.

Geometry is triangulated while excluding the camera whose feature is disputed.
No association is switched, no original bytes are modified, and no training gate
is granted. This report is evidence for a subsequent independently reviewed solve.
"""
import argparse
import collections
import importlib.util
import json
import math
import pathlib
import sqlite3
import struct


def module(name):
    path = pathlib.Path(__file__).with_name(name)
    spec = importlib.util.spec_from_file_location(name.replace('-', '_'), path)
    obj = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(obj)
    return obj


def require(condition, code):
    if not condition:
        raise ValueError(code)


def camera_view(image):
    w, x, y, z = image['q']
    r = ((1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)),
         (2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)),
         (2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)))
    t = image['t']
    center = tuple(-sum(r[j][i]*t[j] for j in range(3)) for i in range(3))
    return r, center


def ray(image, index, view):
    x, y = image['obs'][index]['xy']
    f, cx, cy, k, _, _ = image['cam']
    u, v = (x-cx)/f, (y-cy)/f
    nx, ny = u, v
    for _ in range(18):
        denom = 1+k*(nx*nx+ny*ny)
        require(math.isfinite(denom) and denom > 0.001, 'LENS_UNDISTORTION_INVALID')
        nx, ny = u/denom, v/denom
    rot, center = view
    direction = tuple(rot[0][j]*nx + rot[1][j]*ny + rot[2][j] for j in range(3))
    length = math.sqrt(sum(value*value for value in direction))
    require(math.isfinite(length) and length > 0, 'RAY_INVALID')
    return center, tuple(v/length for v in direction)


def solve3(a, b):
    mat = [list(row)+[b[i]] for i, row in enumerate(a)]
    pivots = []
    for column in range(3):
        lead = max(range(column, 3), key=lambda i: abs(mat[i][column]))
        mat[column], mat[lead] = mat[lead], mat[column]
        pivot = mat[column][column]
        if abs(pivot) < 1e-12:
            return None
        pivots.append(abs(pivot))
        for row in range(column+1, 3):
            factor = mat[row][column]/pivot
            for c in range(column, 4):
                mat[row][c] -= factor*mat[column][c]
    if min(pivots)/max(pivots) < 1e-10:
        return None
    answer = [0.0]*3
    for row in (2,1,0):
        answer[row] = (mat[row][3] - sum(mat[row][j]*answer[j] for j in range(row+1,3)))/mat[row][row]
    return tuple(answer) if all(math.isfinite(x) for x in answer) else None


def triangulate(pairs, images, views):
    if len(pairs)<2:
        return None
    samples = [ray(images[i], idx, views[i]) for i,idx in pairs]
    a = [[0.0]*3 for _ in range(3)]
    b = [0.0]*3
    for center, direction in samples:
        for i in range(3):
            for j in range(3):
                value = (1.0 if i==j else 0.0)-direction[i]*direction[j]
                a[i][j] += value
                b[i] += value*center[j]
    point = solve3(a,b)
    if point is None:
        return None
    if any(sum((point[i]-center[i])*direction[i] for i in range(3)) <= 0 for center,direction in samples):
        return None
    max_angle = 0.0
    for k,(c,d) in enumerate(samples):
        for _,d2 in samples[k+1:]:
            max_angle = max(max_angle, math.degrees(math.acos(max(-1.,min(1.,sum(x*y for x,y in zip(d,d2)))))))
    return point, max_angle


def review(original_model, derivative_model, database):
    check = module('captured-reality-colmap-match-consistency.py')
    source_truth = check.inspect(original_model, derivative_model, database)
    require(source_truth['training_permitted'] is False, 'ADMISSION_CHECK_UNEXPECTED')
    parse = module('captured-reality-colmap-track-repair.py')
    orig, der = pathlib.Path(original_model), pathlib.Path(derivative_model)
    cameras = parse.cameras_from((orig/'cameras.bin').read_bytes())
    original_images = parse.images_from((orig/'images.bin').read_bytes(), cameras)
    derivative_images = parse.images_from((der/'images.bin').read_bytes(), cameras)
    original_points = parse.points_from((orig/'points3D.bin').read_bytes())
    derivative_points = {p['id']:p for p in parse.points_from((der/'points3D.bin').read_bytes())}
    groups = collections.defaultdict(list)
    for point in original_points:
        for iid, index in point['track']:
            groups[point['id'], iid].append(index)
    ambiguities = {key:indexes for key,indexes in groups.items() if len(indexes)>1}
    audit = json.loads((der/'track-disambiguation-audit.json').read_text())
    selected = {(int(v['point_id']),int(v['image_id'])):int(v['retained_index']) for v in audit['changes']}
    require(set(selected)==set(ambiguities), 'AMBIGUOUS_GROUP_AUDIT_INCOMPLETE')
    scores = collections.Counter()
    matches = 0
    with sqlite3.connect(pathlib.Path(database).resolve().as_uri()+'?mode=ro',uri=True) as connection:
        for pairid, count, columns, data in connection.execute('SELECT pair_id,rows,cols,data FROM two_view_geometries'):
            if not data or not count:
                continue
            image_a,image_b=divmod(int(pairid),2147483647)
            if image_a not in original_images or image_b not in original_images:
                continue
            require(columns==2 and len(data)==count*8, 'INLIER_DATA_INVALID')
            a, b = original_images[image_a], original_images[image_b]
            for ai, bi in struct.iter_unpack('<II',data):
                require(ai<len(a['obs']) and bi<len(b['obs']), 'MATCH_INDEX_INVALID')
                pid = a['obs'][ai]['pid']
                if pid>0 and pid==b['obs'][bi]['pid']:
                    if (pid,image_a) in ambiguities: scores[pid,image_a,ai]+=1
                    if (pid,image_b) in ambiguities: scores[pid,image_b,bi]+=1
                matches+=1
    views = {iid:camera_view(image) for iid,image in derivative_images.items()}
    classifications = collections.Counter()
    angles = []
    details=[]
    for (pid,iid), indexes in ambiguities.items():
        other = [(i,j) for i,j in derivative_points[pid]['track'] if i!=iid]
        fit = triangulate(other,derivative_images,views)
        if fit is None:
            geometry = 'geometric_insufficient'
            angle = None
            delta = None
        else:
            point,angle = fit
            residuals = [math.dist(parse.reproject(derivative_images[i],point),derivative_images[i]['obs'][j]['xy']) for i,j in other]
            if len(other)>=4:
                inliers = [pair for pair,e in zip(other,residuals) if e<=2.5]
                if 3<=len(inliers)<len(other):
                    refit=triangulate(inliers,derivative_images,views)
                    if refit is not None:
                        point,angle=refit
            errors = [math.dist(parse.reproject(derivative_images[iid],point),original_images[iid]['obs'][idx]['xy']) for idx in indexes]
            choice=indexes.index(selected[pid,iid])
            delta=min(value for i,value in enumerate(errors) if i!=choice)-errors[choice]
            geometry = 'geometry_selected' if delta>.25 else 'geometry_alternative' if delta<-.25 else 'geometry_inconclusive'
            angles.append(angle)
        selected_support=scores[pid,iid,selected[pid,iid]]
        alternative_support=max(scores[pid,iid,idx] for idx in indexes if idx != selected[pid,iid])
        matches_class = 'matches_selected' if selected_support>alternative_support else 'matches_alternative' if selected_support<alternative_support else 'matches_tied'
        classifications[matches_class,geometry]+=1
        # Never include original image coordinates or absolute scene positions in printed results.
        details.append({'point_id':pid,'image_id':iid,'source_match_support':matches_class,'loo_geometry':geometry,'loo_delta_px':delta,'independent_view_angle_deg':angle})
    report={
      'schema':'urai-independent-colmap-geometry-triage-1',
      'classification':'PRIVATE_GEOMETRIC_TRIAGE_NOT_TRAINING_OR_ASSET_ADMISSION',
      'source_and_derivative_fixity_verified':True,
      'ambiguous_groups':len(ambiguities),'source_inlier_edges_scanned':matches,
      'leave_one_out_geometric_margin_px':0.25,
      'max_pair_view_angle_deg_median':sorted(angles)[len(angles)//2] if angles else None,
      'match_geometry_cross_evidence':{match:{geom:classifications[match,geom] for geom in ('geometry_selected','geometry_alternative','geometry_inconclusive','geometric_insufficient')} for match in ('matches_selected','matches_alternative','matches_tied')},
      'training_permitted':False,'admission_status':'BLOCKED_CONFLICT_ADJUDICATION_RETRIANGULATION_HELDOUT_AND_INDEPENDENT_REVIEW',
      'resolution':'No original or derivative associations are altered by this read-only reviewer.'}
    return report,details


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--original-model',required=True)
    parser.add_argument('--derivative-model',required=True)
    parser.add_argument('--database',required=True)
    parser.add_argument('--report',required=True)
    parser.add_argument('--private-detail',help='Optional private-only point/image audit; never publish this artifact')
    args=parser.parse_args()
    report,details=review(args.original_model,args.derivative_model,args.database)
    path=pathlib.Path(args.report)
    require(not path.exists(),'REPORT_ALREADY_EXISTS')
    path.write_text(json.dumps(report,indent=2)+'\n')
    if args.private_detail:
        private=pathlib.Path(args.private_detail)
        require(not private.exists(),'PRIVATE_REPORT_ALREADY_EXISTS')
        private.write_text(json.dumps(details,indent=2)+'\n')
    print(json.dumps(report,indent=2))

if __name__=='__main__': main()
