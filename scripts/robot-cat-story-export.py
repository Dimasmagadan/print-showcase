"""Read adjacent CAD recipes; write assembly geometry only to the task temp dir."""
import sys
import json
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
WORK = Path('/tmp/print-showcase-robot-story')
sys.path.insert(0, str(ROOT.parent / '3dprint/models'))
import robot_cat as cat
import robot_cat_bunny as bunny

WORK.mkdir(parents=True, exist_ok=True)
parts = cat.build()
parts['HeadBunny'] = bunny.build_head_bunny()
report = {}
for name, solid in parts.items():
    target = WORK / f'{name}.stl'
    vertices, triangles = cat.write_stl(solid, target)
    lo, hi = cat.mesh_bounds(solid)
    report[name] = dict(bounds_mm=[lo, hi], vertices=vertices, triangles=triangles)
    print(name, report[name], flush=True)
(WORK / 'geometry.json').write_text(json.dumps(report, indent=2))
