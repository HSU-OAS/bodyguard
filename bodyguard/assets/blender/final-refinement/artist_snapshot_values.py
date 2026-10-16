"""FR-A-02/03/08: exact professional body/rig snapshot, no authoring."""


def typed_property(value):
    """Compare nested native data and types, never process memory addresses."""
    if hasattr(value, "to_list"):
        return (type(value).__name__, tuple(typed_property(v) for v in value.to_list()))
    if hasattr(value, "to_dict"):
        return (
            type(value).__name__,
            {k: typed_property(v) for k, v in value.to_dict().items()},
        )
    if isinstance(value, (str, int, float, bool)) or value is None:
        return (type(value).__name__, value)
    if isinstance(value, (tuple, list)):
        return (type(value).__name__, tuple(typed_property(v) for v in value))
    if isinstance(value, dict):
        return (type(value).__name__, {k: typed_property(v) for k, v in value.items()})
    raise TypeError(f"Unrecognized native property type: {type(value).__name__}")


def snapshot(body, rig):
    pbr = next(n for n in body.data.materials[0].node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    return {
        "points": [tuple(v.co) for v in body.data.vertices],
        "skin": [[(g.group, g.weight) for g in v.groups] for v in body.data.vertices],
        "faces": [(tuple(p.vertices), p.material_index, p.use_smooth) for p in body.data.polygons],
        "groups": [g.name for g in body.vertex_groups],
        "rest": [
            (
                b.name,
                tuple(b.head_local),
                tuple(b.tail_local),
                [tuple(row) for row in b.matrix_local],
                b.parent.name if b.parent else None,
                b.use_deform,
                b.inherit_scale,
            )
            for b in rig.data.bones
        ],
        "pose": [(b.name, [tuple(row) for row in b.matrix_basis]) for b in rig.pose.bones],
        "world": [[tuple(row) for row in o.matrix_world] for o in (body, rig)],
        "materials": [m.name for m in body.data.materials],
        "finish": {
            i.name: tuple(i.default_value)
            if hasattr(i.default_value, "__iter__")
            else i.default_value
            for i in pbr.inputs
        },
        "properties": {k: typed_property(body[k]) for k in body.keys()},
        "point_ledger": [v.value for v in body.data.attributes["a239_source_point_id"].data],
        "hands": list(body["bodyguard_distal_hand_vertices"]),
        "modifiers": [
            (
                m.name,
                m.type,
                m.object.name if m.type == "ARMATURE" and m.object else None,
                m.use_deform_preserve_volume if m.type == "ARMATURE" else None,
                m.use_vertex_groups if m.type == "ARMATURE" else None,
            )
            for m in body.modifiers
        ],
    }
