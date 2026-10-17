"""World001 training-only feature-association regression tests (stdlib, no media)."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
import hashlib
import math

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('world001_train_track_rebuild',HERE/'world001_train_track_rebuild.py')
src=importlib.util.module_from_spec(spec)
spec.loader.exec_module(src)


def n(frame=1,survey='S01_PUSH'):
    return f'train/{survey}/{survey}__frame{frame:04d}.jpg'


class MatcherTests(unittest.TestCase):
    def test_mutual_ratio_and_100_max_distance_required(self):
        fw=[(0,10,62.,110.),(1,11,99.,150.),(2,12,99.9,100.),(3,13,101.,200.)]
        bw=[(10,0,62.,150.),(11,1,99.,155.),(12,2,99.,150.),(13,3,101.,200.)]
        self.assertEqual(src.strong_mutual_matches(fw,bw),[(0,10,62.),(1,11,99.)])

    def test_one_way_only_cannot_certify_match(self):
        self.assertEqual(src.strong_mutual_matches([(2,3,20.,100.)],[(3,8,20.,100.)]),[])

    def test_ratio_ambiguity_rejected(self):
        self.assertEqual(src.strong_mutual_matches([(2,3,50.,60.)],[(3,2,50.,60.)]),[])

    def test_nan_and_negative_descriptors_fail_closed(self):
        for d in (float('nan'),-1.,float('inf')):
            with self.assertRaisesRegex(ValueError,'INVALID_MATCH_DESCRIPTOR'):
                src.strong_mutual_matches([(1,2,d,110.)],[(2,1,30.,110.)])

    def test_duplicate_query_not_silently_overwritten(self):
        with self.assertRaisesRegex(ValueError,'DUPLICATE_MATCH_QUERY'):
            src.strong_mutual_matches([(1,2,20.,90.),(1,4,10.,90.)],[])

    def test_epipolar_zero_vertical_displacement(self):
        F=[[0,0,0],[0,0,-1],[0,1,0]]
        self.assertAlmostEqual(src.epipolar_error((400,200),(200,200),F),0)
        self.assertGreater(src.epipolar_error((400,200),(200,206),F),2.5)

    def test_degenerate_epipolar_geometry_rejected(self):
        with self.assertRaisesRegex(ValueError,'DEGENERATE_EPIPOLAR_GEOMETRY'):
            src.epipolar_error((10,20),(30,40),[[0]*3 for _ in range(3)])

    def test_nan_epipolar_pixel_rejected(self):
        with self.assertRaisesRegex(ValueError,'NONFINITE_PIXEL'):
            src.epipolar_error((math.nan,0),(1,0),[[0,0,0],[0,0,-1],[0,1,0]])


class OwnershipTests(unittest.TestCase):
    def test_four_view_rebuild_retains_single_owner(self):
        frames=[n(i,'S01_PUSH' if i<3 else 'S02_PULLBACK') for i in range(4)]
        assign={x:{0:7} for x in frames}
        edges=[(frames[i],0,frames[i+1],0) for i in range(3)]
        tracks,m=src.build_disjoint_tracks(edges,assign)
        self.assertEqual(m['owned_four_view_components'],1)
        self.assertEqual(m['unowned_four_view_components'],0)
        self.assertEqual(tracks[0]['source_owner'],7)
        self.assertEqual(len(tracks[0]['observations']),4)

    def test_unclaimed_four_view_track_remains_unadmitted_candidate(self):
        frames=[n(i,'S01_PUSH') for i in range(4)]
        tracks,m=src.build_disjoint_tracks([(frames[i],1,frames[i+1],1) for i in range(3)],{x:{} for x in frames})
        self.assertEqual(m['unowned_four_view_components'],1)
        self.assertIsNone(tracks[0]['source_owner'])
        self.assertEqual(src.FROZEN_MIN_LANDMARKS,800)

    def test_preowned_conflicting_landmark_rejected(self):
        a,b,c=n(1),n(2),n(3)
        tracks,m=src.build_disjoint_tracks([(a,1,b,1),(b,1,c,1)],{a:{1:10},b:{1:12},c:{1:12}})
        self.assertEqual(m['foreign_owner_conflicts_rejected'],1)
        self.assertEqual(len(tracks),2)

    def test_one_feature_per_frame_across_transitive_merges(self):
        a,b,c=n(1),n(2),n(3)
        edges=[(a,1,b,1),(b,1,c,1),(a,2,c,1)]
        tracks,m=src.build_disjoint_tracks(edges,{a:{},b:{},c:{}})
        self.assertEqual(m['same_frame_duplicates_rejected'],1)
        self.assertEqual(m['total_components'],2)

    def test_transitive_conflicting_owner_rejected(self):
        a,b,c=n(1),n(2),n(3)
        tracks,m=src.build_disjoint_tracks([(a,1,b,1),(b,1,c,1)],{a:{1:5},b:{},c:{1:6}})
        self.assertEqual(m['foreign_owner_conflicts_rejected'],1)
        self.assertEqual(len(tracks),2)

    def test_deterministic_across_edge_input_order(self):
        a,b,c,d=n(1),n(2),n(3),n(4)
        edges=[(a,1,b,1),(b,1,c,1),(c,1,d,1),(a,2,c,1)]
        owners={x:{} for x in (a,b,c,d)}
        self.assertEqual(src.build_disjoint_tracks(edges,owners),src.build_disjoint_tracks(edges[::-1],owners))

    def test_heldout_never_accepted(self):
        a,b=n(1),n(2)
        with self.assertRaisesRegex(ValueError,'HELDOUT_OR_UNTRUSTED_TRAIN_FRAME'):
            src.build_disjoint_tracks([(a,0,'train/S08_DIAGONAL/S08_DIAGONAL__frame0001.jpg',0)],{a:{}})
        with self.assertRaisesRegex(ValueError,'HELDOUT_OR_UNTRUSTED_TRAIN_FRAME'):
            src.source_pairs([a,'holdout/S08_DIAGONAL/S08_DIAGONAL__frame0001.jpg'])

    def test_same_frame_candidate_invalid(self):
        a=n(1)
        with self.assertRaisesRegex(ValueError,'SAME_FRAME_EDGE'):
            src.build_disjoint_tracks([(a,0,a,1)],{a:{}})

    def test_source_schedule_fixed_and_nonadaptive(self):
        frames=[n(i,s) for s in src.SURVEYS for i in range(2)]
        pairs=src.source_pairs(frames)
        self.assertEqual(len(pairs),7+21*2)
        self.assertTrue(all('S08' not in a+b for a,b in pairs))

    def test_checksum_before_deserialization(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'source.pkl';p.write_bytes(b'untrusted-not-a-pickle')
            with self.assertRaisesRegex(ValueError,'SOURCE_SHA256_MISMATCH'):
                src.strict_hash(p,'0'*64)
            with self.assertRaisesRegex(ValueError,'EXPLICIT_SHA256_REQUIRED'):
                src.strict_hash(p,'')
            src.strict_hash(p,hashlib.sha256(p.read_bytes()).hexdigest())

    def test_release_policy_remains_unmodified(self):
        self.assertEqual(src.DESC_MAX_L2,100.)
        self.assertEqual(src.REPROJECTION_MAX_PX,2.5)
        self.assertEqual(src.MIN_VIEWS,4)
        self.assertEqual(src.FROZEN_MIN_LANDMARKS,800)


if __name__=='__main__':
    unittest.main(verbosity=2)
