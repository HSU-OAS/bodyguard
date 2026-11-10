# FR-A-03/FR-S-03: authored content deformation engineering check, not clinical.
import bpy,json,math,hashlib
from pathlib import Path
rows=[];failures=[];source=Path(bpy.data.filepath);sha=hashlib.sha256(source.read_bytes()).hexdigest()
for gender in ('male','female'):
 rig=bpy.data.objects[f'BODYGUARD {gender.title()} rig WIP'];body=bpy.data.objects[f'BODYGUARD {gender.title()} sculpt WIP'];rest=[v.co.copy() for v in body.data.vertices]
 edges=[(a,b,d) for e in body.data.edges for a,b in [e.vertices] if (d:=(rest[a]-rest[b]).length)>.001]
 for motion in ('neck-side','arm-overhead'):
  action=bpy.data.actions[f'bodyguard-preview-{gender}-{motion}'];rig.animation_data.action=action;rig.animation_data.action_slot=action.slots[0]
  for frame in (1,44,72,108,144):
   bpy.context.scene.frame_set(frame);bpy.context.view_layer.update();m=body.evaluated_get(bpy.context.evaluated_depsgraph_get()).data
   assert all(math.isfinite(x) for v in m.vertices for x in v.co)
   ratio=max((m.vertices[a].co-m.vertices[b].co).length/d for a,b,d in edges)
   rows.append({'gender':gender,'motion':motion,'frame':frame,'maximum_edge_stretch':ratio})
   if ratio>=3:failures.append({'gender':gender,'motion':motion,'frame':frame,'reason':'existing 3x engineering stretch bound exceeded'})
assert sha==hashlib.sha256(source.read_bytes()).hexdigest()
Path('/private/tmp/bodyguard-seated-reference-20261111/baseline-deformation.json').write_text(json.dumps({'passed':not failures,'source_sha256':sha,'source_saved':False,'rows':rows,'failures':failures,'clinical_approval':False},indent=2))
assert not failures
