import bpy, json, hashlib
from pathlib import Path
p=Path('/private/tmp/bodyguard-female-normal-trial-20261110')
source=Path(bpy.data.filepath)
assert hashlib.sha256(source.read_bytes()).hexdigest()=='71c369c96667549d00a4e77ff5d0b301ce307d806d5f3b42e739f48b4b7a8a2d'
target=p/'candidate.blend'
assert not target.exists()
body=bpy.data.objects['BODYGUARD Female sculpt WIP']
selected=json.loads(Path.cwd().joinpath('bodyguard/docs/review/avatar-reassessment-20261106/local-curvature-20261109/selected.json').read_text())
points=[tuple(v.co) for v in body.data.vertices]
pre={'vertices':len(points),'polygons':len(body.data.polygons),'custom_normals':body.data.has_custom_normals,'modifiers':[m.name for m in body.modifiers]}
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.context.view_layer.objects.active=body
group=body.vertex_groups.new(name='temporary normal trial region')
group.add(selected, 1.0, 'REPLACE')
modifier=body.modifiers.new('local weighted-normal trial', 'WEIGHTED_NORMAL')
modifier.vertex_group=group.name
modifier.keep_sharp=True
modifier.mode='FACE_AREA'
while body.modifiers.find(modifier.name)>0: bpy.ops.object.modifier_move_up(modifier=modifier.name)
bpy.ops.object.modifier_apply(modifier=modifier.name)
body.vertex_groups.remove(group)
body.data.update()
assert points==[tuple(v.co) for v in body.data.vertices]
post={'vertices':len(body.data.vertices),'polygons':len(body.data.polygons),'custom_normals':body.data.has_custom_normals,'modifiers':[m.name for m in body.modifiers]}
assert pre['modifiers']==post['modifiers']
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(target),compress=True)
(p/'report.json').write_text(json.dumps({'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'candidate_sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'pre':pre,'post':post,'all_vertices_unchanged':True,'appearance_approved':False},indent=2))
