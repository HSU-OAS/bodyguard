# FR-S-01/03, FR-A-01: native seated illustration candidate, not clinical angles.
import bpy,hashlib,json,math
from pathlib import Path
from mathutils import Vector,Matrix
source=Path(bpy.data.filepath);source_sha=hashlib.sha256(source.read_bytes()).hexdigest()
assert source_sha=='130d32ff93fb2bfd252f4ef068bc587490b0b904640adf91efa002e276d17794'
out=Path('/private/tmp/bodyguard-seated-reference-20261111');target=out/'candidate.blend';assert not target.exists()
def mesh_hash(body):
 h=hashlib.sha256()
 for v in body.data.vertices:h.update(repr((tuple(v.co),tuple((g.group,g.weight) for g in v.groups))).encode())
 for p in body.data.polygons:h.update(repr(tuple(p.vertices)).encode())
 return h.hexdigest()
def rig_hash(rig):return hashlib.sha256(repr([(b.name,tuple(tuple(r) for r in b.matrix_local),b.parent.name if b.parent else None) for b in rig.data.bones]).encode()).hexdigest()
rows=[]
for gender in ('male','female'):
 rig=bpy.data.objects[f'BODYGUARD {gender.title()} rig WIP'];body=bpy.data.objects[f'BODYGUARD {gender.title()} sculpt WIP']
 raw=mesh_hash(body);rest=rig_hash(rig)
 for motion in ('neck-side','arm-overhead'):
  action=bpy.data.actions[f'bodyguard-preview-{gender}-{motion}'];rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0]
  bpy.context.scene.frame_set(1);bpy.context.view_layer.update()
  keys={}
  for side in ('L','R'):
   for bone_name,anchor_name,target_direction in [(f'upperleg01.{side}',f'lowerleg01.{side}',Vector((0,-1,0))),(f'lowerleg01.{side}',f'foot.{side}',Vector((0,0,-1)))]:
    bone=rig.pose.bones[bone_name];anchor=rig.pose.bones[anchor_name]
    current=(anchor.head-bone.head).normalized();delta=current.rotation_difference(target_direction)
    pivot=bone.head.copy();bone.matrix=Matrix.Translation(pivot)@delta.to_matrix().to_4x4()@Matrix.Translation(-pivot)@bone.matrix
    bpy.context.view_layer.update()
    assert (anchor.head-bone.head).normalized().angle(target_direction)<1e-4
    keys[bone_name]=tuple(bone.rotation_quaternion)
  for frame in (1,144):
   bpy.context.scene.frame_set(frame)
   for name,q in keys.items():
    bone=rig.pose.bones[name];bone.rotation_quaternion=q;bone.keyframe_insert('rotation_quaternion',frame=frame,group='seated-illustration-candidate')
  bpy.context.scene.frame_set(1);bpy.context.view_layer.update()
  thigh={side:math.degrees((rig.pose.bones[f'lowerleg01.{side}'].head-rig.pose.bones[f'upperleg01.{side}'].head).normalized().angle(Vector((0,-1,0)))) for side in ('L','R')}
  rows.append({'gender':gender,'motion':motion,'thigh_direction_degrees_from_forward':thigh,'clinical_angles':False})
 assert raw==mesh_hash(body) and rest==rig_hash(rig)
assert hashlib.sha256(source.read_bytes()).hexdigest()==source_sha
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(target),compress=True)
(out/'report.json').write_text(json.dumps({'source_sha256':source_sha,'candidate_sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'raw_mesh_weights_and_rest_bones_unchanged':True,'rows':rows,'appearance_approved':False,'clinical_approval':False},indent=2))
