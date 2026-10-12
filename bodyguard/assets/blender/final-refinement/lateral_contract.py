"""FR-A-02/03/08: exact unchanged topology/skin/provenance and native geometry."""

import math

import bmesh
from artist_snapshot_values import snapshot


def attributes(body):
    result = {}
    for attribute in body.data.attributes:
        if attribute.name == "position":
            continue
        values = []
        for item in attribute.data:
            row = {}
            for prop in item.bl_rna.properties:
                if prop.identifier == "rna_type":
                    continue
                value = getattr(item, prop.identifier)
                if prop.is_array:
                    value = tuple(value)
                elif not isinstance(value, (int, float, bool, str)):
                    raise TypeError(f"Unhandled attribute {attribute.name}")
                row[prop.identifier] = value
            values.append(row)
        result[attribute.name] = (attribute.data_type, attribute.domain, values)
    return result


def state(body, rig):
    result = snapshot(body, rig)
    result["attributes"] = attributes(body)
    result["edges"] = [tuple(edge.vertices) for edge in body.data.edges]
    return result


def quality(body, selected):
    mesh = bmesh.new()
    try:
        mesh.from_mesh(body.data)
        mesh.verts.index_update()
        mesh.normal_update()
        faces = {f for f in mesh.faces if all(v.index in selected for v in f.verts)}
        edges = {edge for face in faces for edge in face.edges if edge.is_manifold}
        angles = [math.degrees(edge.calc_face_angle()) for edge in edges]
        return {
            "vertices": len(mesh.verts),
            "edges": len(mesh.edges),
            "faces": len(mesh.faces),
            "nonmanifold": sum(not edge.is_manifold for edge in mesh.edges),
            "winding": sum(not edge.is_contiguous for edge in mesh.edges if edge.is_manifold),
            "tiny_faces": sum(face.calc_area() < 1e-10 for face in mesh.faces),
            "selected_faces": len(faces),
            "selected_negative_y_faces": sum(face.normal.y < 0 for face in faces),
            "selected_dihedral_above_90": sum(angle > 90 for angle in angles),
            "selected_maximum_dihedral_degrees": max(angles, default=0),
            "whole_professional_mesh_volume_m3": mesh.calc_volume(signed=False),
        }
    finally:
        mesh.free()


def compare(old, new, selected):
    first, second = old["points"], new["points"]
    assert {k: v for k, v in old.items() if k != "points"} == {
        k: v for k, v in new.items() if k != "points"
    }, "Original topology/skin/rig/PBR/provenance/attributes changed"
    moved = 0
    maximum = 0.0
    for index, (before, after) in enumerate(zip(first, second, strict=True)):
        assert all(math.isfinite(value) for value in after)
        if index not in selected:
            assert before == after, f"Protected external point moved: {index}"
        moved += before != after
        maximum = max(maximum, math.dist(before, after))
    assert 0 < moved <= len(selected), "No real authoring or protected movement"
    assert maximum < 0.006, "Existing local authoring budget exceeded"
    return {
        "selected_points": len(selected),
        "moved_points": moved,
        "maximum_displacement_m": maximum,
        "outside_original_coordinates_exact": True,
        "raw_skin_topology_rest_pose_world_PBR_history_hands_attributes_exact": True,
    }
