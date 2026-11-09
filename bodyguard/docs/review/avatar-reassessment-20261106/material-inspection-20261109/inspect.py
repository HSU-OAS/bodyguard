import bpy, json
from pathlib import Path
obj=bpy.data.objects['BODYGUARD Female sculpt WIP']
rows=[]
for slot in obj.material_slots:
 m=slot.material
 if not m:
  rows.append(None)
  continue
 rows.append({'name':m.name,'use_nodes':m.use_nodes,'nodes':[{'name':n.name,'type':n.bl_idname,'image':bool(getattr(n,'image',None))} for n in (m.node_tree.nodes if m.node_tree else [])]})
out={'materials':rows,'mesh':{'has_custom_normals':obj.data.has_custom_normals,'polygons':len(obj.data.polygons),'smooth_polygons':sum(bool(p.use_smooth) for p in obj.data.polygons)},'modifiers':[{'name':m.name,'type':m.type,'visible':m.show_render} for m in obj.modifiers]}
Path('/private/tmp/bodyguard-neck-material-20261109/report.json').write_text(json.dumps(out,indent=2))
