"""Local Blender recipe. Review first; sequence generation needs review approval.

Blender --background --python-exit-code 1 --python scripts/robot-cat-story-render.py
"""
from pathlib import Path
import json
import argparse
import sys
import shutil
import bpy
from mathutils import Vector

WORK = Path('/tmp/print-showcase-robot-story')
parser = argparse.ArgumentParser()
parser.add_argument('--sequence', choices=['split', 'swap'])
parser.add_argument('--count', type=int, default=40)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
if args.count < 2:
    parser.error('count must be >= 2')
OUT = WORK / (args.sequence or 'control')
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
def linear(c):
    return c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4
mat = bpy.data.materials.new('Light matte PLA')
mat.use_nodes = True
shader = mat.node_tree.nodes.get('Principled BSDF')
shader.inputs['Base Color'].default_value = (*(linear(c) for c in (.91, .90, .85)), 1)
shader.inputs['Roughness'].default_value = .6
parts = {}
for name in ['Head', 'Body', 'Legs', 'HeadBunny']:
    bpy.ops.wm.stl_import(filepath=str(WORK / f'{name}.stl'))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (.001,) * 3
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    parts[name] = obj

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.cycles.use_denoising = True
scene.render.resolution_x = 800
scene.render.resolution_y = 1000
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.world = bpy.data.worlds.new('World')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.3, .3, .32, 1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .35
# Transparent render; assets recipe composites over the exact site background.
scene.render.film_transparent = True
scene.view_settings.view_transform = 'AgX'
for name, pos, energy, size in [('Key', (.2, -.4, .4), 1.5, .3), ('Fill', (-.3, -.2, .18), .6, .35), ('Rim', (.1, .2, .3), 1, .25)]:
    light = bpy.data.lights.new(name, 'AREA')
    light.energy, light.shape, light.size = energy, 'DISK', size
    obj = bpy.data.objects.new(name, light)
    scene.collection.objects.link(obj)
    obj.location = pos
    obj.rotation_euler = (Vector((0, 0, .1)) - obj.location).to_track_quat('-Z', 'Y').to_euler()

cam_data = bpy.data.cameras.new('Camera')
cam_data.type = 'ORTHO'
cam_data.clip_start = .001
cam = bpy.data.objects.new('Camera', cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
direction = Vector((.16, -.5, .17)).normalized()
cam.rotation_euler = (-direction).to_track_quat('-Z', 'Y').to_euler()
# Fit union of all vertically extreme poses in camera coordinates, with 6% margins.
rotation = cam.rotation_euler.to_matrix()
inverse = rotation.transposed()
points = []
for name, offsets in [('Body', [0]), ('Legs', [0, -.030]), ('Head', [0, .038]), ('HeadBunny', [0, .038])]:
    for z in offsets:
        points.extend(inverse @ (Vector(v) + Vector((0, 0, z))) for v in parts[name].bound_box)
lo = Vector(tuple(min(p[i] for p in points) for i in range(3)))
hi = Vector(tuple(max(p[i] for p in points) for i in range(3)))
center = rotation @ ((lo + hi) / 2)
cam.location = center + direction * .6
cam_data.ortho_scale = max(hi.y - lo.y, (hi.x - lo.x) / .8) / .88
# Lateral clearance exceeds both head half-widths; departing heads leave the frame.
distance = max(.22, cam_data.ortho_scale * .9)
(WORK / 'camera.json').write_text(json.dumps(dict(projected_bounds_m=[list(lo), list(hi)], center_m=list(center), ortho_scale=cam_data.ortho_scale, lateral_distance_m=distance), indent=2))

def pose(split=0, swap=None):
    for obj in parts.values():
        obj.location = (0, 0, 0)
        obj.hide_render = False
    parts['HeadBunny'].hide_render = True
    parts['Head'].location.z = .038 * split
    parts['Legs'].location.z = -.030 * split
    if swap is None:
        return
    cat, bunny = parts['Head'], parts['HeadBunny']
    cat.location.z = .038 * min(swap / .25, 1)
    cat.location.x = -.085 * max(0, min((swap - .25) / .15, 1)) - (distance - .085) * max(0, min((swap - .40) / .15, 1))
    cat.hide_render = swap >= .55
    bunny.hide_render = swap <= .25
    bunny.location.x = (distance - (distance - .085) * max(0, min((swap - .25) / .15, 1))) * (1 - max(0, min((swap - .55) / .20, 1)))
    bunny.location.z = .038 * (1 - max(0, min((swap - .75) / .25, 1)))

states = [('01-assembled-cat', 0, None), ('02-exploded-cat', 1, None), ('03-half-assembly', .5, None), ('04-raised-cat', 0, .25), ('05-head-exchange', 0, .40), ('06-assembled-bunny', 0, 1)]
if args.sequence:
    states = [(f'{i:03}', i / (args.count - 1) if args.sequence == 'split' else 0,
               i / (args.count - 1) if args.sequence == 'swap' else None) for i in range(args.count)]
for name, split, swap in states:
    if args.sequence == 'swap' and name == '000':
        shutil.copyfile(WORK / 'split/000.png', OUT / '000.png')
        continue
    pose(split, swap)
    scene.render.filepath = str(OUT / f'{name}.png')
    bpy.ops.render.render(write_still=True)
print('Rendered:', OUT, flush=True)
