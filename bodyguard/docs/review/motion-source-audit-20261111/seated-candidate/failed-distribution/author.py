# FR-S-03/FR-A-03: distribute an existing illustration swing, not clinical targets.
import bpy,math,hashlib,json
from pathlib import Path
from mathutils import Vector,Quaternion
source=Path(bpy.data.filepath);sha=hashlib.sha256(source.read_bytes()).hexdigest();assert sha=='e227d1d387a499d7815fdc03c3c8f8b75984642bd7c66f4c3ba2a04b76cc93f8'
output=Path('/private/tmp/bodyguard-seated-balanced-reference-20261111');target=output/'candidate.blend';assert not target.exists()
keys=[(1,0),(12,0),(44,1),(52,1),(72,0),(108,-1),(116,-1),(144,0)]
for gender in ('male','female'):
 rig=bpy.data.objects[f'BODYGUARD {gender.title()} rig WIP'];a=bpy.data.actions[f'bodyguard-preview-{gender}-arm-overhead'];rig.animation_data.action=a;rig.animation_data.action_slot=a.slots[0];bpy.context.scene.frame_set(1);bpy.context.view_layer.update()
 base={n:rig.pose.bones[n].rotation_quaternion.copy() for n in ['upperarm01.L','upperarm01.R','clavicle.L','clavicle.R']}
 for frame,p in keys:
  bpy.context.scene.frame_set(frame)
  for side in ('L','R'):
   progress=max(p,0) if side=='L' else max(-p,0);sign=-1 if side=='L' else 1
   for prefix,angle in [('clavicle',.3),('upperarm01',2.02)]:
    name=f'{prefix}.{side}';b=rig.pose.bones[name];axis=b.bone.matrix_local.to_quaternion().inverted()@Vector((0,1,0));b.rotation_quaternion=base[name]@Quaternion(axis,sign*angle*progress);b.keyframe_insert('rotation_quaternion',frame=frame,group='balanced-illustration-candidate')
assert sha==hashlib.sha256(source.read_bytes()).hexdigest();bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(target),compress=True)
(output/'report.json').write_text(json.dumps({'input_sha256':sha,'candidate_sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'original_total_illustration_swing_radians':2.32,'new_total_illustration_swing_radians':2.32,'clinical_angles':False,'appearance_approved':False},indent=2))
