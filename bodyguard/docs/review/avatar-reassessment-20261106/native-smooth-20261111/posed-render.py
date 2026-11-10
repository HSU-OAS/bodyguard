# FR-A-03: explicit technical pose previews, no validated exercise instructions.
import bpy,json,sys,math
from pathlib import Path
from mathutils import Vector,Quaternion
out=Path(sys.argv[sys.argv.index('--')+1]);assert not out.exists();out.mkdir()
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True;scene.render.resolution_x=600;scene.render.resolution_y=700;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
body=bpy.data.objects['BODYGUARD Female sculpt WIP'];rig=bpy.data.objects['BODYGUARD Female rig WIP']
for o in scene.objects:
 if o.type=='MESH' and o.name.startswith('BODYGUARD '):o.hide_render=not o.name.startswith('BODYGUARD Female ')
base={b.name:b.matrix_basis.copy() for b in rig.pose.bones};x=body.matrix_world.translation.x;z=max(v.co.z for v in body.data.vertices)*.895
rows=[]
for pose in ('neck-left','neck-right','shoulder-left'):
 for b in rig.pose.bones:b.matrix_basis=base[b.name]
 if pose.startswith('neck'):
  sign=1 if pose.endswith('left') else -1
  entries=[(n,Vector((0,1,0)),sign*a) for n,a in [('neck01',4),('neck02',5),('neck03',5),('head',6)]]
 else:entries=[('clavicle.L',Vector((0,1,0)),-10)]
 for name,axis,angle in entries:
  b=rig.pose.bones[name];b.rotation_mode='QUATERNION';local=b.bone.matrix_local.to_3x3().inverted()@axis;b.rotation_quaternion=base[name].to_quaternion()@Quaternion(local,math.radians(angle))
 bpy.context.view_layer.update()
 for view,y in [('front',-3),('back',3)]:
  cam=scene.camera;cam.data.type='ORTHO';cam.data.ortho_scale=.65;cam.location=(x,y,z);cam.rotation_euler=(Vector((x,0,z))-cam.location).to_track_quat('-Z','Y').to_euler();name=f'{pose}-{view}.png';scene.render.filepath=str(out/name);bpy.ops.render.render(write_still=True);rows.append(name)
(out/'render.json').write_text(json.dumps({'samples':32,'technical_only':True,'clinical_approval':False,'source_saved':False,'views':rows},indent=2))
