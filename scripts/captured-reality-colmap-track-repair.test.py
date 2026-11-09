import importlib.util, pathlib, struct, tempfile, unittest, json, hashlib
script=pathlib.Path(__file__).with_name('captured-reality-colmap-track-repair.py')
spec=importlib.util.spec_from_file_location('repair_tracks',script)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

def fixture(path, bad_reciprocal=False):
 path.mkdir()
 cam=struct.pack('<QiiQQ4d',1,1,2,720,1280,600.0,360.0,640.0,0.0)
 images=bytearray(struct.pack('<Q',2))
 for image_id,coords in [(1,[(360.,640.,1),(361.,640.,1)]),(2,[(360.2,640.,1)])]:
  images.extend(struct.pack('<I7dI',image_id,1,0,0,0,0,0,0,1))
  images.extend(('image-'+str(image_id)+'.png').encode()+b'\0')
  images.extend(struct.pack('<Q',len(coords)))
  for index,(x,y,pid) in enumerate(coords):images.extend(struct.pack('<ddq',x,y,-1 if bad_reciprocal and image_id==1 and index==0 else pid))
 points=bytearray(struct.pack('<Q',1))
 points.extend(struct.pack('<Q3d3Bd',1,0.,0.,4.,100,150,200,.5))
 points.extend(struct.pack('<Q',3))
 for pair in [(1,0),(1,1),(2,0)]:points.extend(struct.pack('<II',*pair))
 for n,data in [('cameras.bin',cam),('images.bin',images),('points3D.bin',points)]: (path/n).write_bytes(data)

class RepairTests(unittest.TestCase):
 def test_reversible_candidate_and_complete_detachment_audit(self):
  with tempfile.TemporaryDirectory() as temp:
   src=pathlib.Path(temp)/'source';out=pathlib.Path(temp)/'v2';fixture(src)
   orig={n:m.digest(src/n) for n in ('images.bin','cameras.bin','points3D.bin')}
   result=m.repair(src,out)
   self.assertEqual(result['detached_associations'],1)
   self.assertEqual(result['track_references_after'],2)
   self.assertEqual(result['points_after'],1)
   self.assertTrue(result['requires_fresh_camera_solve_and_heldout_qa'])
   receipt=json.loads((out/'track-disambiguation-audit.json').read_text())
   self.assertEqual(len(receipt['changes']),1)
   self.assertEqual(receipt['changes'][0]['detached_index'],1)
   self.assertEqual([m.digest(src/n) for n in orig],list(orig.values()))
   im=m.images_from((out/'images.bin').read_bytes(),m.cameras_from((out/'cameras.bin').read_bytes()))
   self.assertEqual([obs['pid'] for obs in im[1]['obs']],[1,-1])
   pts=m.points_from((out/'points3D.bin').read_bytes())
   self.assertEqual(pts[0]['track'],[(1,0),(2,0)])
   with self.assertRaisesRegex(ValueError,'SOURCE_MISSING_OR_OUTPUT_EXISTS'):m.repair(src,out)
 def test_mismatched_point_reference_fails_without_outputs(self):
  with tempfile.TemporaryDirectory() as temp:
   src=pathlib.Path(temp)/'source';out=pathlib.Path(temp)/'v2';fixture(src,True)
   with self.assertRaisesRegex(ValueError,'TRACK_NOT_RECIPROCAL'):m.repair(src,out)
   self.assertFalse(out.exists())

if __name__=='__main__':unittest.main()
