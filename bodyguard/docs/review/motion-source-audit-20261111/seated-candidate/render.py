import bpy,json
from pathlib import Path
from mathutils import Vector
out=Path('/private/tmp/bodyguard-seated-reference-20261111/render');assert not out.exists();out.mkdir()
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=16;s.cycles.use_denoising=True;s.render.resolution_x=700;s.render.resolution_y=800;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG';rows=[]
for gender in ('male','female'):
 rig=bpy.data.objects[f'BODYGUARD {gender.title()} rig WIP'];body=bpy.data.objects[f'BODYGUARD {gender.title()} sculpt WIP']
 for obj in s.objects:
  if obj.type=='MESH' and obj.name.startswith('BODYGUARD '):obj.hide_render=not obj.name.startswith(f'BODYGUARD {gender.title()} ')
 for motion,frame in [('neck-side',1),('arm-overhead',44)]:
  a=bpy.data.actions[f'bodyguard-preview-{gender}-{motion}'];rig.animation_data.action=a;rig.animation_data.action_slot=a.slots[0];s.frame_set(frame);bpy.context.view_layer.update()
  ev=body.evaluated_get(bpy.context.evaluated_depsgraph_get());pts=[ev.matrix_world@Vector(c) for c in ev.bound_box];center=sum(pts,Vector())/8
  cam=s.camera;cam.data.type='ORTHO';cam.data.ortho_scale=max(1.8,max(p.z for p in pts)-min(p.z for p in pts)+.4);cam.location=center+Vector((2,-4,.15));cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();name=f'{gender}-{motion}-{frame}.png';s.render.filepath=str(out/name);bpy.ops.render.render(write_still=True);rows.append(name)
(out/'report.json').write_text(json.dumps({'source_saved':False,'views':rows,'clinical_approval':False},indent=2))
