import bpy, bmesh, json, math, hashlib, sys
from pathlib import Path
sys.path.insert(0, str(Path.cwd() / 'bodyguard/docs/review/avatar-reassessment-20261106/executed'))
from surface_visibility import read
body = bpy.data.objects['BODYGUARD Female sculpt WIP']
rig = bpy.data.objects['BODYGUARD Female rig WIP']
t = body.matrix_world.inverted() @ rig.matrix_world
shoulder = min((t @ rig.data.bones[f'upperarm01.{s}'].head_local).z for s in ('L','R'))
low = shoulder - .06
high = (t @ rig.data.bones['head'].head_local).z + .01
width = max(abs((t @ rig.data.bones[f'upperarm01.{s}'].head_local).x) for s in ('L','R')) + .02
anterior = read(body)['anterior']
front = {i for face in body.data.polygons if face.index in anterior for i in face.vertices}
selected_file = Path('/private/tmp/bodyguard-neck-curvature-selected-20261109.json')
if not selected_file.exists():
    selected = {v.index for v in body.data.vertices if v.index not in front and v.co.y > 0 and low < v.co.z < high and abs(v.co.x) < width}
    selected_file.write_text(json.dumps(sorted(selected)))
else:
    selected = set(json.loads(selected_file.read_text()))
assert max(selected) < len(body.data.vertices)
bm = bmesh.new(); bm.from_mesh(body.data); bm.verts.index_update(); bm.normal_update()
angles = sorted(math.degrees(e.calc_face_angle()) for e in bm.edges if e.is_manifold and all(v.index in selected for f in e.link_faces for v in f.verts))
def quantile(p): return angles[min(len(angles)-1, math.ceil(p*len(angles))-1)]
path = Path(bpy.data.filepath)
print('BODYGUARD_CURVATURE_JSON ' + json.dumps({'source':str(path),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'vertices':len(selected),'edges':len(angles),'p50':quantile(.5),'p90':quantile(.9),'p95':quantile(.95),'p99':quantile(.99),'p999':quantile(.999),'max':max(angles),'over_5':sum(a>5 for a in angles),'over_10':sum(a>10 for a in angles),'over_20':sum(a>20 for a in angles),'over_40':sum(a>40 for a in angles)}),flush=True)
bm.free()
