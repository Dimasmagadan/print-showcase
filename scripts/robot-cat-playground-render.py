"""Render playground assets from private assembly STL files; geometry never enters public/.

Run scripts/robot-cat-story-export.py first (using the adjacent CAD environment), then:
blender --background --python scripts/robot-cat-playground-render.py -- --study
Outputs remain in /tmp until the composition has been checked.
"""
from pathlib import Path
import argparse
import sys
import bpy
from mathutils import Vector

p = argparse.ArgumentParser()
p.add_argument('--study', action='store_true')
p.add_argument('--motion', action='store_true')
p.add_argument('--support', action='store_true')
p.add_argument('--body-motion', action='store_true')
p.add_argument('--anchors-only', action='store_true')
p.add_argument('--wheel-study', action='store_true')
p.add_argument('--cart-refresh', action='store_true')
p.add_argument('--samples', type=int, default=16)
args = p.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
root = Path(__file__).resolve().parents[1]
source = root.parent / '3dprint/exports/robot_cat/preview'
out = Path('/tmp/robot-cat-playground') / ('wheel-study' if args.wheel_study else 'study' if args.study else 'full')
out.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = args.samples
scene.cycles.use_denoising = True
scene.render.resolution_x = scene.render.resolution_y = 800
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = True
scene.world = bpy.data.worlds.new('Studio world')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .16
scene.view_settings.view_transform = 'AgX'

def material(name, color):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = .62
    return mat
ivory = material('Warm plastic', (.78, .76, .68))
beak = material('Duck beak', (.8, .31, .045))
nose = material('Dog nose', (.045, .035, .03))
wheel = material('Wheels', (.24, .22, .20))
# A subtle mottled surface makes rotation perceptible on otherwise symmetric wheels.
nodes = wheel.node_tree.nodes; links = wheel.node_tree.links
coordinates = nodes.new('ShaderNodeTexCoord'); noise = nodes.new('ShaderNodeTexNoise')
noise.inputs['Scale'].default_value = 7; noise.inputs['Detail'].default_value = 1
ramp = nodes.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].color = (.16, .145, .13, 1)
ramp.color_ramp.elements[1].color = (.31, .285, .26, 1)
links.new(coordinates.outputs['Generated'], noise.inputs['Vector'])
links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
links.new(ramp.outputs['Color'], nodes.get('Principled BSDF').inputs['Base Color'])
# A muted visual mark follows each wheel and makes its rotation perceptible.
separate = nodes.new('ShaderNodeSeparateXYZ'); combine = nodes.new('ShaderNodeCombineXYZ')
distance = nodes.new('ShaderNodeVectorMath'); distance.operation = 'DISTANCE'
distance.inputs[1].default_value = (0, .5, .79)
dot = nodes.new('ShaderNodeMath'); dot.operation = 'LESS_THAN'; dot.inputs[1].default_value = .09
mix = nodes.new('ShaderNodeMixRGB'); mix.inputs[2].default_value = (.46, .43, .39, 1)
links.new(coordinates.outputs['Generated'], separate.inputs[0])
links.new(separate.outputs['Y'], combine.inputs['Y']); links.new(separate.outputs['Z'], combine.inputs['Z'])
links.new(combine.outputs[0], distance.inputs[0]); links.new(distance.outputs['Value'], dot.inputs[0])
links.new(dot.outputs[0], mix.inputs[0]); links.new(ramp.outputs['Color'], mix.inputs[1])
links.new(mix.outputs[0], nodes.get('Principled BSDF').inputs['Base Color'])
base = material('Cart', (.63, .45, .22))
parts = {}
def add(name, path, mat=ivory):
    bpy.ops.wm.stl_import(filepath=str(path))
    obj = bpy.context.object
    obj.name = name
    obj.scale = (.001,)*3
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    parts[name] = obj
for name in ['Head', 'HeadDuck', 'HeadDog', 'Body', 'BodyPlain', 'Legs', 'Cart']:
    add(name, source / f'assembly_{name}.stl', base if name == 'Cart' else ivory)
add('HeadBunny', Path('/tmp/print-showcase-robot-story/HeadBunny.stl'))
for name, mat in [('DuckBeak', beak), ('DogNose', nose)]: add(name, source / f'assembly_{name}.stl', mat)
for kind in ['CartWheel', 'CartAxle']:
    for i in range(1, 5): add(f'{kind}{i}', source / f'assembly_{kind}_{i}.stl', wheel if kind == 'CartWheel' else base)
for name, pos, energy, size in [('Key', (-.22, -.30, .40), 2.8, .12), ('Fill', (.3, -.15, .20), .25, .3), ('Rim', (.1, .2, .3), 1, .25)]:
    data = bpy.data.lights.new(name, 'AREA'); data.energy = energy; data.shape = 'DISK'; data.size = size
    light = bpy.data.objects.new(name, data); scene.collection.objects.link(light); light.location = pos
    light.rotation_euler = (Vector((0, 0, .08)) - light.location).to_track_quat('-Z', 'Y').to_euler()
cam_data = bpy.data.cameras.new('Camera'); cam_data.type = 'ORTHO'; cam_data.ortho_scale = .32; cam_data.clip_start = .001
cam = bpy.data.objects.new('Camera', cam_data); scene.collection.objects.link(cam); scene.camera = cam
cam.location = Vector((.15, -.55, .23)).normalized() * .6 + Vector((0, 0, .095))
cam.rotation_euler = (Vector((0, 0, .095)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
heads = {'cat': ['Head'], 'bunny': ['HeadBunny'], 'duck': ['HeadDuck', 'DuckBeak'], 'dog': ['HeadDog', 'DogNose']}

def render(label, visible, mode='robot', exploded=False):
    for name, obj in parts.items():
        obj.hide_render = name not in visible
        obj.location = (0, 0, 0)
        if name in sum(heads.values(), []): obj.location.z = (-.052 if mode == 'cart' else 0) + (.035 if exploded else 0)
        elif mode == 'cart': obj.location.z = .010
        elif name == 'Legs' and exploded: obj.location.z = -.025
    scene.render.filepath = str(out / f'{label}.png')
    bpy.ops.render.render(write_still=True)

for head, group in ([] if args.motion or args.support or args.body_motion or args.anchors_only or args.wheel_study or args.cart_refresh else heads.items()):
    if args.study and head not in ('cat', 'duck'): continue
    for mode in ('robot', 'cart'):
        for exploded in (False, True):
            for body in (('tail', 'plain') if mode == 'robot' and not args.study else ('tail',)):
                support = (['Body' if body == 'tail' else 'BodyPlain', 'Legs'] if mode == 'robot' else ['Cart'] + [f'{kind}{i}' for kind in ('CartWheel', 'CartAxle') for i in range(1,5)])
                render(f'{head}-{mode}-{body}' + ('-exploded' if exploded else ''), group + support, mode, exploded)

# Isolated, registered layers for checking compositing and animated transitions.
if not args.study and not args.motion and not args.support and not args.body_motion and not args.anchors_only and not args.wheel_study and not args.cart_refresh:
    for head, group in heads.items():
        for mode in ('robot', 'cart'):
            render(f'layer-{head}-{mode}', group, mode)
    for name in ('Body', 'BodyPlain', 'Legs'):
        render('layer-' + name.lower(), [name])
    render('layer-cart', ['Cart'] + [f'CartAxle{i}' for i in range(1, 5)], 'cart')
    for i in range(1, 5):
        render(f'layer-wheel{i}', [f'CartWheel{i}'], 'cart')

# Full-scene intermediate poses retain depth and contact shadows. Wheel phases
# rotate each wheel around its physical X axis while the glued axles stay fixed.
if args.motion:
    from math import pi
    from mathutils import Matrix
    head_parts = sum(heads.values(), [])
    for head, group in heads.items():
        for mode in ('robot', 'cart'):
            for body in (('tail', 'plain') if mode == 'robot' else ('tail',)):
                support = (['Body' if body == 'tail' else 'BodyPlain', 'Legs'] if mode == 'robot' else ['Cart'] + [f'{kind}{i}' for kind in ('CartWheel', 'CartAxle') for i in range(1,5)])
                visible = group + support
                for variant in ('lift', 'explode'):
                    for frame in (1, 2, 3):
                        t = frame / 4
                        for name, obj in parts.items():
                            obj.hide_render = name not in visible
                            obj.location.z = (-.052 if mode == 'cart' else 0) + .035*t if name in head_parts else .010 if mode == 'cart' else (-.025*t if name == 'Legs' and variant == 'explode' else 0)
                        scene.render.filepath = str(out / f'motion-{head}-{mode}-{body}-{variant}-{frame}.png')
                        bpy.ops.render.render(write_still=True)
                if mode == 'cart':
                    for phase in range(1, 4):
                        for name, obj in parts.items():
                            obj.hide_render = name not in visible
                            obj.location.z = -.052 if name in head_parts else .010
                        for i in range(1,5):
                            obj=parts[f'CartWheel{i}']
                            center=Vector((0, -.034 if i < 3 else .034, .010))
                            # STL coordinates are already in world space; rotate its vertices about axle center.
                            obj.matrix_world = Matrix.Translation(center + Vector((0,0,.010))) @ Matrix.Rotation(phase*pi/2,4,'X') @ Matrix.Translation(-center)
                        scene.render.filepath = str(out / f'motion-{head}-cart-wheel-{phase}.png')
                        bpy.ops.render.render(write_still=True)
                    for i in range(1,5): parts[f'CartWheel{i}'].matrix_world = Matrix.Identity(4)

# Robot-to-cart exchange: move each complete support offstage before the
# other enters; the head remains a single rigid part, including beak or nose.
if args.support:
    head_parts = sum(heads.values(), [])
    cart = ['Cart'] + [f'{kind}{i}' for kind in ('CartWheel', 'CartAxle') for i in range(1, 5)]
    for head, group in heads.items():
        for body in ('tail', 'plain'):
            robot = ['Body' if body == 'tail' else 'BodyPlain', 'Legs']
            for side, support in [('robot', robot), ('cart', cart)]:
                for frame in (1, 2, 3):
                    for name, obj in parts.items():
                        obj.hide_render = name not in group + support
                        obj.location = (0, 0, 0)
                        if name in group:
                            obj.location.z = .02625 if side == 'robot' else -.02575
                        elif name in support:
                            obj.location.x = (-1 if side == 'robot' else 1) * .05 * frame
                            obj.location.z = .010 if side == 'cart' else 0
                    scene.render.filepath = str(out / f'support-{head}-{body}-{side}-{frame}.png')
                    bpy.ops.render.render(write_still=True)
        for name, obj in parts.items():
            obj.hide_render = name not in group
            obj.location = (0, 0, .00025 if name in group else 0)
        scene.render.filepath = str(out / f'support-{head}-head.png')
        bpy.ops.render.render(write_still=True)

# Whole-body swap: hands and tail remain part of their respective body.
if args.body_motion:
    for head, group in heads.items():
        for body in ('tail', 'plain'):
            name_body = 'Body' if body == 'tail' else 'BodyPlain'
            visible = group + [name_body, 'Legs']
            for frame in (1, 2, 3):
                for name, obj in parts.items():
                    obj.hide_render = name not in visible
                    obj.location = (-.05*frame if name == name_body else 0, 0, 0)
                scene.render.filepath = str(out / f'body-{head}-{body}-{frame}.png')
                bpy.ops.render.render(write_still=True)

if args.anchors_only:
    from bpy_extras.object_utils import world_to_camera_view
    bpy.context.view_layer.update()
    for x,z in [(-.012,.0755),(.012,.0755),(-.012,.0505),(.012,.0505)]:
        p = world_to_camera_view(scene, cam, Vector((x,-.015,z)))
        print('BELLY_ANCHOR', round(p.x*800,3), round((1-p.y)*800,3), flush=True)

if args.wheel_study:
    from math import pi
    from mathutils import Matrix
    group = heads['cat']; support = ['Cart'] + [f'{kind}{i}' for kind in ('CartWheel', 'CartAxle') for i in range(1,5)]
    render('wheel-0', group + support, 'cart')
    for phase in (1,2,3):
        for i in range(1,5):
            obj=parts[f'CartWheel{i}']; center=Vector((0, -.034 if i < 3 else .034, .010))
            obj.matrix_world = Matrix.Translation(center + Vector((0,0,.010))) @ Matrix.Rotation(phase*pi/2,4,'X') @ Matrix.Translation(-center)
        scene.render.filepath = str(out / f'wheel-{phase}.png'); bpy.ops.render.render(write_still=True)

if args.cart_refresh:
    from math import pi
    from mathutils import Matrix
    head_parts = sum(heads.values(), [])
    support = ['Cart'] + [f'{kind}{i}' for kind in ('CartWheel', 'CartAxle') for i in range(1,5)]
    for head, group in heads.items():
        for exploded in (False, True):
            render(f'{head}-cart-tail' + ('-exploded' if exploded else ''), group + support, 'cart', exploded)
        for variant in ('lift', 'explode'):
            for frame in (1,2,3):
                for name, obj in parts.items():
                    obj.hide_render = name not in group + support
                    obj.location = (0, 0, -.052 + .035 * frame/4 if name in group else .010)
                scene.render.filepath = str(out / f'motion-{head}-cart-tail-{variant}-{frame}.png'); bpy.ops.render.render(write_still=True)
        for phase in (1,2,3):
            for name, obj in parts.items():
                obj.hide_render = name not in group + support
                obj.location = (0, 0, -.052 if name in group else .010)
            for i in range(1,5):
                obj=parts[f'CartWheel{i}']; center=Vector((0, -.034 if i < 3 else .034, .010))
                obj.matrix_world = Matrix.Translation(center + Vector((0,0,.010))) @ Matrix.Rotation(phase*pi/2,4,'X') @ Matrix.Translation(-center)
            scene.render.filepath = str(out / f'motion-{head}-cart-wheel-{phase}.png'); bpy.ops.render.render(write_still=True)
        for i in range(1,5): parts[f'CartWheel{i}'].matrix_world = Matrix.Identity(4)
        for body in ('tail', 'plain'):
            for frame in (1,2,3):
                for name, obj in parts.items():
                    obj.hide_render = name not in group + support
                    obj.location = (0, 0, -.02575) if name in group else (.05*frame, 0, .010)
                scene.render.filepath = str(out / f'support-{head}-{body}-cart-{frame}.png'); bpy.ops.render.render(write_still=True)
