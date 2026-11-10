import bpy,hashlib,json,math
from pathlib import Path
from mathutils import Vector
source=Path(bpy.data.filepath);sha=hashlib.sha256(source.read_bytes()).hexdigest()
assert sha=='130d32ff93fb2bfd252f4ef068bc587490b0b904640adf91efa002e276d17794'
rows=[]
for gender in ('male','female'):
 rig=bpy.data.objects[f'BODYGUARD {gender.title()} rig WIP']
 for motion in ('neck-side','shoulder-shrug','arm-overhead'):
  a=bpy.data.actions[f'bodyguard-preview-{gender}-{motion}'];rig.animation_data.action=a;rig.animation_data.action_slot=a.slots[0]
  bpy.context.scene.frame_set(1);bpy.context.view_layer.update()
  values={}
  for side in ('L','R'):
   b=rig.pose.bones[f'upperleg01.{side}'];d=(rig.matrix_world@b.tail)-(rig.matrix_world@b.head)
   values[side]=math.degrees(d.normalized().angle(Vector((0,0,-1))))
  rows.append({'gender':gender,'motion':motion,'frame':1,'upper_thigh_degrees_from_down':values})
assert hashlib.sha256(source.read_bytes()).hexdigest()==sha
out=Path('/private/tmp/bodyguard-reference-posture-audit-20261111.json');assert not out.exists();out.write_text(json.dumps({'source_sha256':sha,'source_saved':False,'rows':rows,'clinical_approval':False},indent=2))
