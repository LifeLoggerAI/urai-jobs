import importlib.util
import pathlib
import sqlite3
import struct
import tempfile
import unittest

ROOT=pathlib.Path(__file__).parent

def mod(filename):
    p=ROOT/filename
    spec=importlib.util.spec_from_file_location('module_'+filename.replace('-','_').replace('.','_'),p)
    out=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(out)
    return out

triage=mod('captured-reality-colmap-geometric-triage.py')
repair=mod('captured-reality-colmap-track-repair.py')

def source_fixture(root, same_center=False):
    source=root/'original';source.mkdir()
    camera=struct.pack('<QiiQQ4d',1,1,2,720,1280,600.,360.,640.,0.)
    images=bytearray(struct.pack('<Q',3))
    observations={1:[(360.,640.,1),(364.,640.,1)],2:[(360. if same_center else 330.,640.,1)],3:[(360. if same_center else 300.,640.,1)]}
    for iid in (1,2,3):
        shift=0. if same_center else -.2*(iid-1)
        images.extend(struct.pack('<I7dI',iid,1.,0.,0.,0.,shift,0.,0.,1))
        images.extend(f'candidate_{iid:03}.png'.encode()+b'\0')
        images.extend(struct.pack('<Q',len(observations[iid])))
        for xyz in observations[iid]:images.extend(struct.pack('<ddq',*xyz))
    points=bytearray(struct.pack('<Q',1))
    points.extend(struct.pack('<Q3d3Bd',1,0.,0.,4.,100,150,200,.4))
    points.extend(struct.pack('<Q',4))
    for pair in ((1,0),(1,1),(2,0),(3,0)):points.extend(struct.pack('<II',*pair))
    for name,payload in [('cameras.bin',camera),('images.bin',images),('points3D.bin',points)]: (source/name).write_bytes(payload)
    db=root/'database.db'
    with sqlite3.connect(db) as connection:
        connection.execute('CREATE TABLE images(image_id INTEGER PRIMARY KEY,name TEXT,camera_id INTEGER)')
        connection.execute('CREATE TABLE cameras(camera_id INTEGER PRIMARY KEY,model INTEGER,width INTEGER,height INTEGER,params BLOB)')
        connection.execute('CREATE TABLE keypoints(image_id INTEGER PRIMARY KEY, rows INTEGER,cols INTEGER,data BLOB)')
        connection.execute('CREATE TABLE two_view_geometries(pair_id INTEGER PRIMARY KEY,rows INTEGER,cols INTEGER,data BLOB)')
        connection.execute('INSERT INTO cameras VALUES(?,?,?,?,?)',(1,2,720,1280,struct.pack('<4d',600.,360.,640.,0.)))
        for iid,xy in observations.items():
            connection.execute('INSERT INTO images VALUES(?,?,?)',(iid,f'candidate_{iid:03}.png',1))
            packed=b''.join(struct.pack('<ff',x,y) for x,y,_ in xy)
            connection.execute('INSERT INTO keypoints VALUES(?,?,?,?)',(iid,len(xy),2,packed))
        for i,j,ai,bi in ((1,2,1,0),(1,3,1,0),(2,3,0,0)):
            connection.execute('INSERT INTO two_view_geometries VALUES(?,?,?,?)',(2147483647*i+j,1,2,struct.pack('<II',ai,bi)))
    output=root/'derivative'
    repair.repair(source,output)
    return source,output,db

class IndependentGeometry(unittest.TestCase):
    def test_match_support_cannot_override_independent_view_geometry(self):
        with tempfile.TemporaryDirectory() as tmp:
            src,derived,db=source_fixture(pathlib.Path(tmp))
            report,detail=triage.review(src,derived,db)
            self.assertEqual(report['ambiguous_groups'],1)
            self.assertEqual(report['match_geometry_cross_evidence']['matches_alternative']['geometry_selected'],1)
            self.assertGreater(detail[0]['independent_view_angle_deg'],2)
            self.assertFalse(report['training_permitted'])
    def test_degenerate_views_do_not_gain_geometric_confidence(self):
        with tempfile.TemporaryDirectory() as tmp:
            src,derived,db=source_fixture(pathlib.Path(tmp),same_center=True)
            report,detail=triage.review(src,derived,db)
            self.assertEqual(report['match_geometry_cross_evidence']['matches_alternative']['geometric_insufficient'],1)
            self.assertIsNone(detail[0]['loo_delta_px'])
    def test_derivative_mutation_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            src,derived,db=source_fixture(pathlib.Path(tmp))
            with (derived/'points3D.bin').open('ab') as stream: stream.write(b'unreviewed')
            with self.assertRaisesRegex(ValueError,'DERIVATIVE_HASH_CHANGED'):
                triage.review(src,derived,db)
    def test_calibration_identity_is_checked(self):
        with tempfile.TemporaryDirectory() as tmp:
            src,derived,db=source_fixture(pathlib.Path(tmp))
            with sqlite3.connect(db) as c:c.execute('UPDATE cameras SET width=777 WHERE camera_id=1')
            with self.assertRaisesRegex(ValueError,'DATABASE_CAMERA_DIMENSIONS_MISMATCH'):
                triage.review(src,derived,db)

if __name__=='__main__':unittest.main()
