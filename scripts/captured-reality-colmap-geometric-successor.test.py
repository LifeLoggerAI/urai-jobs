import importlib.util
import pathlib
import sqlite3
import struct
import tempfile
import unittest

ROOT=pathlib.Path(__file__).parent
def module(file):
    spec=importlib.util.spec_from_file_location(file.replace('-','_').replace('.','_'),ROOT/file)
    obj=importlib.util.module_from_spec(spec);spec.loader.exec_module(obj);return obj

v2=module('captured-reality-colmap-track-repair.py')
v3=module('captured-reality-colmap-geometric-successor.py')

def fixture(root):
    source=root/'original';source.mkdir()
    cameras=struct.pack('<QiiQQ4d',1,1,2,720,1280,600.,360.,640.,0.)
    images=bytearray(struct.pack('<Q',15))
    points=bytearray(struct.pack('<Q',1))
    track=[]
    database=root/'features.db'
    with sqlite3.connect(database) as con:
        con.execute('CREATE TABLE images(image_id INTEGER PRIMARY KEY,name TEXT,camera_id INTEGER)')
        con.execute('CREATE TABLE cameras(camera_id INTEGER PRIMARY KEY,model INTEGER,width INTEGER,height INTEGER,params BLOB)')
        con.execute('CREATE TABLE keypoints(image_id INTEGER PRIMARY KEY,rows INTEGER,cols INTEGER,data BLOB)')
        con.execute('CREATE TABLE two_view_geometries(pair_id INTEGER PRIMARY KEY,rows INTEGER,cols INTEGER,data BLOB)')
        con.execute('INSERT INTO cameras VALUES(?,?,?,?,?)',(1,2,720,1280,struct.pack('<4d',600.,360.,640.,0.)))
        for iid in range(1,16):
            tx=-.08*(iid-1)
            measured=360.+600.*tx/4.
            xy=[(measured,640.),(measured+1.5,640.)] if iid==1 else [(measured+1.5,640.)]
            images.extend(struct.pack('<I7dI',iid,1.,0.,0.,0.,tx,0.,0.,1))
            filename=f'image-{iid}.png'
            images.extend(filename.encode()+b'\0')
            images.extend(struct.pack('<Q',len(xy)))
            for x,y in xy:images.extend(struct.pack('<ddq',x,y,1))
            track.extend((iid,index) for index in range(len(xy)))
            con.execute('INSERT INTO images VALUES(?,?,?)',(iid,filename,1))
            con.execute('INSERT INTO keypoints VALUES(?,?,?,?)',(iid,len(xy),2,b''.join(struct.pack('<ff',x,y) for x,y in xy)))
            if iid!=1:
                con.execute('INSERT INTO two_view_geometries VALUES(?,?,?,?)',(2147483647+iid,1,2,struct.pack('<II',1,0)))
    points.extend(struct.pack('<Q3d3Bd',1,0.,0.,4.,100,150,200,1.))
    points.extend(struct.pack('<Q',len(track)))
    for pair in track:points.extend(struct.pack('<II',*pair))
    for name,content in (('cameras.bin',cameras),('images.bin',images),('points3D.bin',points)):
        (source/name).write_bytes(content)
    derivative=root/'v2'
    v2.repair(source,derivative)
    return source,derivative,database

class GenuineGeometricSuccessor(unittest.TestCase):
    def test_retriangulates_and_rebinds_only_original_source_features(self):
        with tempfile.TemporaryDirectory() as temp:
            root=pathlib.Path(temp)
            original,v2model,database=fixture(root)
            prior={name:v2.digest(v2model/name) for name in ('cameras.bin','images.bin','points3D.bin')}
            outcome=v3.apply(original,v2model,database,root/'v3')
            self.assertEqual(outcome['accepted_feature_reassociations'],1)
            self.assertEqual(outcome['retriangulated_points_changed'],1)
            self.assertFalse(outcome['training_permitted'])
            self.assertEqual(prior,{name:v2.digest(v2model/name) for name in prior})
            cameras=v2.cameras_from((original/'cameras.bin').read_bytes())
            images=v2.images_from((root/'v3/images.bin').read_bytes(),cameras)
            self.assertEqual([obs['pid'] for obs in images[1]['obs']],[-1,1])
            self.assertEqual(len(v2.points_from((root/'v3/points3D.bin').read_bytes())[0]['track']),15)
            with self.assertRaisesRegex(ValueError,'REFUSE_EXISTING_OUTPUT'):
                v3.apply(original,v2model,database,root/'v3')
    def test_tampered_feature_database_prevents_output(self):
        with tempfile.TemporaryDirectory() as temp:
            root=pathlib.Path(temp)
            original,v2model,database=fixture(root)
            with sqlite3.connect(database) as con:
                con.execute('UPDATE keypoints SET data=? WHERE image_id=1',(b'corrupt',))
            with self.assertRaisesRegex(ValueError,'DATABASE_FEATURE_ARRAY_INVALID'):
                v3.apply(original,v2model,database,root/'v3')
            self.assertFalse((root/'v3').exists())

if __name__=='__main__':unittest.main()
