"""Private geometry → continuous raster scene. No geometry is shipped to the site.
Run with Blender --background --python this-file; controls first, sequence later.
"""
from pathlib import Path
import argparse
import math
import sys
import bpy
from bpy_extras.object_utils import world_to_camera_view
import json
from mathutils import Vector

parser = argparse.ArgumentParser()
parser.add_argument('--sequence', action='store_true')
parser.add_argument('--mobile', action='store_true')
parser.add_argument('--prototype', action='store_true')
parser.add_argument('--start', type=int, default=0)
parser.add_argument('--end', type=int, default=999)
parser.add_argument('--only')
parser.add_argument('--anchors-only', action='store_true')
parser.add_argument('--skip-existing', action='store_true')
parser.add_argument('--samples', type=int, default=24)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
WORK = Path('/tmp/print-showcase-robot-story')
OUT = WORK / 'redesign' / ('mobile' if args.mobile else 'prototype' if args.prototype else 'sequence' if args.sequence else 'storyboard')
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
def linear(c):
    return c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4
mat = bpy.data.materials.new('Matte warm PLA')
mat.use_nodes = True
shader = mat.node_tree.nodes.get('Principled BSDF')
shader.inputs['Base Color'].default_value = (*(linear(c) for c in (.91, .90, .85)), 1)
shader.inputs['Roughness'].default_value = .62
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
scene.cycles.samples = args.samples
scene.cycles.use_denoising = True
scene.render.use_persistent_data = False
scene.render.resolution_x, scene.render.resolution_y = (780, 1000) if args.mobile else (1600, 1000)
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = True
scene.world = bpy.data.worlds.new('World')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .12
scene.view_settings.view_transform = 'AgX'
for name, pos, energy, size in [('Key', (-.22, -.30, .40), 2.8, .12), ('Fill', (.3, -.15, .20), .25, .3), ('Rim', (.1, .2, .3), 1, .25)]:
    data = bpy.data.lights.new(name, 'AREA')
    data.energy, data.shape, data.size = energy, 'DISK', size
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = pos
    obj.rotation_euler = (Vector((0, 0, .10)) - obj.location).to_track_quat('-Z', 'Y').to_euler()
# The floor is a shadow catcher: compositing retains the page's exact background.
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -.001))
bpy.context.object.is_shadow_catcher = True
cam_data = bpy.data.cameras.new('Camera')
cam_data.type = 'ORTHO'
cam_data.clip_start = .001
cam = bpy.data.objects.new('Camera', cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
direction = Vector((.15, -.55, .23)).normalized()
cam.rotation_euler = (-direction).to_track_quat('-Z', 'Y').to_euler()

def mix(a, b, t): return a + (b - a) * t
def smooth(t):
    t = max(0., min(1., t))
    return t*t*(3-2*t)
# Poses: locations, x rotation, camera target and vertical field of view.
def key(k):
    p = {n: [0., 0., 0., 0.] for n in parts}
    target, scale = [0., 0., .095], .25
    if k == 1: target[0] = -.035
    if k == 2:
        p['Head'][2] = .060
        p['Body'][2] = .025
        target[2], scale = .120, .32
    if k == 3:
        # Confirmed README: head flat base, body on back (Y=+16), legs on feet.
        p['Head'] = [-.085, 0., -.096, 0.]
        p['Body'] = [0., .065, .016, -math.pi / 2]
        p['Legs'] = [.085, 0., 0., 0.]
        target, scale = [.020, .025, .045], .27
    if k == 4:
        p['Head'][2] = .024
        target, scale = [0., -.004, .124], .14
    if k == 6:
        p['Head'] = [-.075, 0., .038, 0.]
        p['HeadBunny'] = [.075, 0., .038, 0.]
        target, scale = [0., 0., .12], .34
    if k == 7:
        p['Head'] = [-.095, -.005, -.096, 0.]
        target, scale = [-.015, 0., .10], .30
    if k == 3 and not args.mobile:
        for name in ('Head', 'Body', 'Legs'): p[name][0] -= .035
    if args.mobile:
        scale = max(scale, .30 if k in (3, 6, 7) else scale)
        if k == 1: target[0] = 0
        if k == 3:
            p['Head'] = [-.055, -.020, -.096, 0.]
            p['Body'] = [.025, .065, .016, -math.pi/2]
            p['Legs'] = [.055, -.025, 0., 0.]
            target, scale = [0., .02, .035], .28
    return p, target, scale

def pose(a, b=None, t=0):
    pa, ca, sa = key(a)
    pb, cb, sb = key(b if b is not None else a)
    for name, obj in parts.items():
        v = [mix(pa[name][i], pb[name][i], t) for i in range(4)]
        obj.location, obj.rotation_euler = v[:3], (v[3], 0, 0)
        obj.hide_render = name == 'HeadBunny' and a < 6 and (b is None or b < 6 or t == 0)
    # Bunny enters from upper right, never morphs from the departing cat.
    if a == 5 and b == 6:
        parts['Head'].location.z = .038 * smooth(t * 3)
        parts['Head'].location.x = -.075 * smooth((t - 1/3) * 1.5)
        parts['HeadBunny'].location = (.30 - .225 * t, 0, .038 * t)
    if a == 6 and b == 7:
        parts['HeadBunny'].location.x = .075 * (1 - smooth(t * 2))
        parts['HeadBunny'].location.z = .038 * (1 - smooth((t - .5) * 2))
    if a == 2 and b == 3:
        parts['Head'].location.x = mix(pa['Head'][0], pb['Head'][0], smooth(t*2))
        parts['Head'].location.z = mix(pa['Head'][2], pb['Head'][2], smooth(t*2-1))
    if a == 3 and b == 4:
        parts['Head'].location.z = mix(pa['Head'][2], pb['Head'][2], smooth(t*2))
        parts['Head'].location.x = mix(pa['Head'][0], pb['Head'][0], smooth(t*2-1))
        for name in ('Body', 'Legs'):
            v = [mix(pa[name][i], pb[name][i], smooth(t*2)) for i in range(4)]
            parts[name].location, parts[name].rotation_euler = v[:3], (v[3], 0, 0)
    if a == 4 and b == 5:
        # Complete the physical seating before the camera pulls back.
        seat = min(1., t * 2)
        parts['Head'].location.z = .024 * (1 - seat)
        camera_t = max(0., (t - .5) * 2)
    else:
        camera_t = t
    if a == 3 and b == 4:
        # Seat the legs in the wider view, then approach the neck.
        intermediate = [.020, .015, .09]
        if t <= .5:
            ca, cb, camera_t = ca, intermediate, smooth(t*2)
            sb = sa
        else:
            ca, camera_t = intermediate, smooth(t*2-1)
    target = Vector([mix(ca[i], cb[i], camera_t) for i in range(3)])
    cam.location = target + direction * .65
    cam_data.ortho_scale = mix(sa, sb, camera_t) * (1 if args.mobile else 1.6)

anchors = {}
def render(name, a, b=None, t=0):
    if args.skip_existing and (OUT / f'{name}.png').exists():
        return
    if args.only and name not in args.only.split(','):
        return
    if name.isdigit() and not args.start <= int(name) <= args.end:
        return
    pose(a, b, t)
    if args.mobile:
        scene.render.resolution_y = 650 if a == 3 else 1000
        if a == 3: cam_data.ortho_scale = .24
    def project(point):
        p = world_to_camera_view(scene, cam, Vector(point))
        return [round(p.x * 100, 3), round((1-p.y) * 100, 3)]
    bpy.context.view_layer.update()
    anchors[name] = {'pin': project((0, 0, .108)), 'head': project(parts['Head'].location + Vector((0, -.025, .13))), 'parts': {n: project(parts[n].matrix_world @ (sum((Vector(v) for v in parts[n].bound_box), Vector()) / 8)) for n in ('Head','Body','Legs')}, 'zones': [project(v) for v in [(0, -.02, .096), (-.041, .01396, .035), (.037, .01328, .023)]]}
    scene.render.filepath = str(OUT / f'{name}.png')
    if not args.anchors_only: bpy.ops.render.render(write_still=True)

if args.prototype:
    for a in range(2, 7):
        for j in range(6):
            t = j / 6
            render(f'{(a-2)*6+j:03}', a, a+1, t*t*(3-2*t))
    render('030', 7)
elif args.sequence:
    for a in range(7):
        for j in range(12):
            t = j / 12
            t = t*t*(3-2*t)
            render(f'{a*12+j:03}', a, a+1, t)
    render('084', 7)
else:
    for k in range(8): render(f'K{k}', k)
    if not args.mobile:
        for a in [1, 2, 3, 4, 5, 6]:
            render(f'K{a}-{a+1}-mid', a, a+1, .5)
anchor_path = OUT / 'anchors.json'
previous = json.loads(anchor_path.read_text()) if anchor_path.exists() else {}
previous.update(anchors)
anchor_path.write_text(json.dumps(previous, indent=2))
print('Rendered', OUT, flush=True)
