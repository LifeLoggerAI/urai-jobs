import importlib.util, pathlib, struct, sqlite3, tempfile, unittest
folder=pathlib.Path(__file__).parent
spec=importlib.util.spec_from_file_location('match_consistency',folder/'captured-reality-colmap-match-consistency.py')
qa=importlib.util.module_from_spec(spec);spec.loader.exec_module(qa)
sp=importlib.util.spec_from_file_location('synthetic',folder/'captured-reality-colmap-track-repair.test.py')
fixture=importlib.util.module_from_spec(sp);sp.loader.exec_module(fixture)

def write_database(path, support_index):
 c=sqlite3.connect(path)
 c.execute('CREATE TABLE images(image_id INTEGER PRIMARY KEY, name TEXT, camera_id INTEGER)')
 c.execute('CREATE TABLE cameras(camera_id INTEGER PRIMARY KEY, model INTEGER, width INTEGER,height INTEGER,params BLOB)')
 c.execute('CREATE TABLE keypoints(image_id INTEGER PRIMARY KEY, rows INTEGER,cols INTEGER,data BLOB)')
 c.execute('CREATE TABLE two_view_geometries(pair_id INTEGER PRIMARY KEY,rows INTEGER,cols INTEGER,data BLOB)')
 c.execute('INSERT INTO cameras VALUES(?,?,?,?,?)',(1,2,720,1280,struct.pack('<4d',600.,360.,640.,0.)))
 for image_id,coords in [(1,[(360.,640.),(361.,640.)]),(2,[(360.2,640.)])]:
  c.execute('INSERT INTO images VALUES(?,?,?)',(image_id,'image-'+str(image_id)+'.png',1))
  c.execute('INSERT INTO keypoints VALUES(?,?,?,?)',(image_id,len(coords),2,b''.join(struct.pack('<ff',*xy) for xy in coords)))
 c.execute('INSERT INTO two_view_geometries VALUES(?,?,?,?)',(2147483647 + 2,1,2,struct.pack('<II',support_index,0)))
 c.commit();c.close()

class EvidenceTests(unittest.TestCase):
 def evaluate(self,support_index):
  with tempfile.TemporaryDirectory() as temp:
   root=pathlib.Path(temp); src=root/'source'; derived=root/'derivative';db=root/'database.db'
   fixture.fixture(src);fixture.m.repair(src,derived);write_database(db,support_index)
   return qa.inspect(src,derived,db)
 def test_match_graph_supports_reprojection_choice(self):
  report=self.evaluate(0)
  self.assertEqual(report['source_keypoints_identity_verified'],3)
  self.assertEqual(report['selection_inlier_support']['more_supported'],1)
  self.assertEqual(report['selection_inlier_support']['less_supported'],0)
  self.assertFalse(report['training_permitted'])
 def test_match_graph_can_disagree_with_nearest_reprojection(self):
  report=self.evaluate(1)
  self.assertEqual(report['selection_inlier_support']['less_supported'],1)
  self.assertEqual(report['selection_inlier_support']['more_supported'],0)
  self.assertFalse(report['training_permitted'])
 def test_bundle_adjusted_focal_is_measured_not_rejected(self):
  with tempfile.TemporaryDirectory() as temp:
   root=pathlib.Path(temp);src=root/'source';derived=root/'derivative';db=root/'database.db'
   fixture.fixture(src);fixture.m.repair(src,derived);write_database(db,0)
   with sqlite3.connect(db) as c:c.execute('UPDATE cameras SET params=? WHERE camera_id=1',(struct.pack('<4d',550.,360.,640.,0.),))
   report=qa.inspect(src,derived,db)
   self.assertGreater(report['absolute_focal_refinement_percent_median'],9.)
 def test_source_dimension_mismatch_fails_closed(self):
  with tempfile.TemporaryDirectory() as temp:
   root=pathlib.Path(temp);src=root/'source';derived=root/'derivative';db=root/'database.db'
   fixture.fixture(src);fixture.m.repair(src,derived);write_database(db,0)
   with sqlite3.connect(db) as c:c.execute('UPDATE cameras SET width=721 WHERE camera_id=1')
   with self.assertRaisesRegex(ValueError,'DATABASE_CAMERA_DIMENSIONS_MISMATCH'):qa.inspect(src,derived,db)
 def test_source_mutation_fails_closed(self):
  with tempfile.TemporaryDirectory() as temp:
   root=pathlib.Path(temp);src=root/'source';derived=root/'derivative';db=root/'database.db'
   fixture.fixture(src);fixture.m.repair(src,derived);write_database(db,0)
   with (derived/'images.bin').open('ab') as f:f.write(b'bad')
   with self.assertRaisesRegex(ValueError,'DERIVATIVE_HASH_CHANGED'):qa.inspect(src,derived,db)

if __name__=='__main__':unittest.main()
