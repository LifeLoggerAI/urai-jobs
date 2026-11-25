#!/usr/bin/env python3
"""Produce a reversible, audited COLMAP track-uniqueness derivative.

Never edits originals. Keeps all 2D coordinates, camera poses and XYZ positions;
changes only ambiguous 2D point IDs, their reciprocal 3D tracks, and the
3D point's now-updated mean residual. This is NOT photorealistic QA/admission.
"""
import argparse
import collections
import hashlib
import json
import math
import shutil
import struct
from pathlib import Path

CAMERA_PREFIX = struct.Struct('<iiQQ')
IMAGE_PREFIX = struct.Struct('<I7dI')
OBSERVATION = struct.Struct('<ddq')
POINT_PREFIX = struct.Struct('<Q3d3Bd')
TRACK_OBSERVATION = struct.Struct('<II')


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as src:
        for chunk in iter(lambda: src.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def require(ok, reason):
    if not ok:
        raise ValueError(reason)


def cameras_from(data):
    n = struct.unpack_from('<Q', data)[0]
    result = {}
    offset = 8
    for _ in range(n):
        cid, model, width, height = CAMERA_PREFIX.unpack_from(data, offset)
        offset += CAMERA_PREFIX.size
        require(model == 2, 'ONLY_COLMAP_SIMPLE_RADIAL_SUPPORTED')
        focal, cx, cy, k = struct.unpack_from('<4d', data, offset)
        offset += 32
        require(cid not in result and width and height and all(math.isfinite(v) for v in (focal,cx,cy,k)) and focal > 0, 'CAMERA_INVALID')
        result[cid] = (focal,cx,cy,k,width,height)
    require(offset == len(data), 'CAMERA_TRAILING_BYTES')
    return result


def images_from(data, cameras):
    images = {}
    offset = 8
    n = struct.unpack_from('<Q', data)[0]
    for _ in range(n):
        iid, *v = IMAGE_PREFIX.unpack_from(data, offset)
        offset += IMAGE_PREFIX.size
        end = data.index(b'\0', offset)
        name = data[offset:end].decode('utf-8')
        offset = end+1
        count = struct.unpack_from('<Q', data, offset)[0]
        offset += 8
        observations = []
        for idx in range(count):
            x,y,pid = OBSERVATION.unpack_from(data, offset)
            require(math.isfinite(x) and math.isfinite(y) and pid >= -1, 'IMAGE_POINT_INVALID')
            observations.append({'xy':(x,y), 'pid':pid, 'pid_offset':offset+16})
            offset += OBSERVATION.size
        require(iid not in images and v[-1] in cameras, 'IMAGE_CAMERA_INVALID')
        images[iid] = {'name':name,'q':v[:4],'t':v[4:7],'cam':cameras[v[-1]],'obs':observations}
    require(offset == len(data), 'IMAGE_TRAILING_BYTES')
    return images


def points_from(data):
    points = []
    offset = 8
    n = struct.unpack_from('<Q', data)[0]
    for _ in range(n):
        head = data[offset:offset+POINT_PREFIX.size]
        require(len(head)==POINT_PREFIX.size, 'POINT_RECORD_TRUNCATED')
        pid,x,y,z,*tail = POINT_PREFIX.unpack(head)
        offset += POINT_PREFIX.size
        track_size = struct.unpack_from('<Q',data,offset)[0]
        offset += 8
        require(track_size>=2 and offset+track_size*8<=len(data), 'POINT_TRACK_TRUNCATED')
        track = [TRACK_OBSERVATION.unpack_from(data,offset+i*8) for i in range(track_size)]
        offset += 8*track_size
        points.append({'id':pid, 'xyz':(x,y,z), 'head':head, 'track':track})
    require(offset == len(data), 'POINT_TRAILING_BYTES')
    return points


def reproject(image, xyz):
    w,x,y,z = image['q']
    rot = ((1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)),
           (2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)),
           (2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)))
    vec = [sum(rot[k][j]*xyz[j] for j in range(3))+image['t'][k] for k in range(3)]
    require(math.isfinite(vec[2]) and vec[2]>0, 'POINT_BEHIND_CAMERA')
    nx,ny = vec[0]/vec[2],vec[1]/vec[2]
    f,cx,cy,k,_,_ = image['cam']
    distortion = 1 + k*(nx*nx+ny*ny)
    return (f*nx*distortion+cx, f*ny*distortion+cy)


def repair(src, destination):
    src = Path(src); destination=Path(destination)
    require(src.is_dir() and not destination.exists(), 'SOURCE_MISSING_OR_OUTPUT_EXISTS')
    originals = {name:(src/name).read_bytes() for name in ('cameras.bin','images.bin','points3D.bin')}
    cams = cameras_from(originals['cameras.bin'])
    images = images_from(originals['images.bin'], cams)
    points = points_from(originals['points3D.bin'])
    updated_images = bytearray(originals['images.bin'])
    updated_points = bytearray(struct.pack('<Q',len(points)))
    changes = []
    original_track_count = sum(len(p['track']) for p in points)
    for point in points:
        groups = collections.defaultdict(list)
        for image_id,index in point['track']:
            require(image_id in images and index<len(images[image_id]['obs']), 'TRACK_INDEX_INVALID')
            require(images[image_id]['obs'][index]['pid']==point['id'], 'TRACK_NOT_RECIPROCAL')
            groups[image_id].append(index)
        require(len(groups)>=2, 'INSUFFICIENT_DISTINCT_CAMERAS')
        selected = []
        errors = []
        for image_id, indices in groups.items():
            image=images[image_id]
            expected = reproject(image, point['xyz'])
            scores=[]
            for idx in indices:
                xy=image['obs'][idx]['xy']
                dist=math.hypot(xy[0]-expected[0],xy[1]-expected[1])
                require(math.isfinite(dist), 'REPROJECTION_NONFINITE')
                scores.append((dist,idx))
            winner_error,winner=min(scores)
            selected.append((image_id,winner))
            errors.append(winner_error)
            for score,index in scores:
                if index==winner:continue
                offset=image['obs'][index]['pid_offset']
                struct.pack_into('<q',updated_images,offset,-1)
                changes.append({'point_id':point['id'],'image_id':image_id,
                    'detached_index':index,'retained_index':winner,
                    'detached_residual_px':round(score,6),
                    'retained_residual_px':round(winner_error,6)})
        # The mean error field belongs to the new derivative's track set.
        header = bytearray(point['head'])
        struct.pack_into('<d',header,POINT_PREFIX.size-8,sum(errors)/len(errors))
        updated_points.extend(header)
        updated_points.extend(struct.pack('<Q',len(selected)))
        for pair in selected:
            updated_points.extend(TRACK_OBSERVATION.pack(*pair))
    new_images = images_from(updated_images,cams)
    new_points = points_from(updated_points)
    require(len(new_points)==len(points), 'POINT_COUNT_CHANGED')
    for point in new_points:
        require(len(set(image_id for image_id,_ in point['track']))==len(point['track']), 'DUPLICATE_TRACK_REMAINED')
        for image_id,idx in point['track']:
            require(new_images[image_id]['obs'][idx]['pid']==point['id'], 'DERIVATIVE_NOT_RECIPROCAL')
    require(len(changes)==original_track_count-sum(len(p['track']) for p in new_points), 'AUDIT_TRACK_DELTA_MISMATCH')
    require(len(changes)>0, 'SOURCE_ALREADY_UNAMBIGUOUS')
    destination.mkdir(parents=True,exist_ok=False)
    for name in ('cameras.bin','rigs.bin','frames.bin'):
        if (src/name).exists():shutil.copyfile(src/name,destination/name)
    (destination/'images.bin').write_bytes(updated_images)
    (destination/'points3D.bin').write_bytes(updated_points)
    hashes={name:{'before_sha256':digest(src/name),'after_sha256':digest(destination/name)}
            for name in ('cameras.bin','images.bin','points3D.bin')}
    receipt={'schema':'urai-colmap-track-disambiguation-1','classification':'AUDITED_STRUCTURAL_DERIVATIVE_NOT_VISUAL_OR_TRAINING_ADMISSION',
      'method':'closest stored 2D feature to independently projected original 3D point; equal error breaks by feature index',
      'source_model':str(src),'points_before':len(points),'points_after':len(new_points),
      'track_references_before':original_track_count,'track_references_after':original_track_count-len(changes),
      'detached_associations':len(changes),'original_image_coordinates_preserved':True,
      'original_camera_poses_preserved':True,'original_point_xyz_preserved':True,
      'unassigned_2d_features_preserved':True,'requires_fresh_camera_solve_and_heldout_qa':True,'file_hashes':hashes}
    (destination/'track-disambiguation-audit.json').write_text(json.dumps({'receipt':receipt,'changes':changes},indent=2)+'\n')
    # Independently recheck each output byte against the just-emitted receipt.
    require(all(digest(destination/name)==value['after_sha256'] for name,value in hashes.items()),'OUTPUT_FIXITY_MISMATCH')
    return receipt


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input-model',required=True)
    parser.add_argument('--output-model',required=True)
    args=parser.parse_args()
    print(json.dumps(repair(args.input_model,args.output_model),indent=2))


if __name__=='__main__':main()
