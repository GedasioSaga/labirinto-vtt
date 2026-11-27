"""Inspeção do .glb da máscara: orientação, tamanho, materiais e 3 vistas rápidas.

Uso: blender --background --factory-startup --python inspecionar.py -- <mascara.glb> <saida>
O .glb é dado não confiável: entra só pelo importador glTF do Blender.
"""

import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def argumentos() -> tuple[Path, Path]:
    resto = sys.argv[sys.argv.index("--") + 1 :]
    return Path(resto[0]), Path(resto[1])


def caixa_mundo(obj: bpy.types.Object) -> tuple[Vector, Vector]:
    pontos = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    menor = Vector((min(p.x for p in pontos), min(p.y for p in pontos), min(p.z for p in pontos)))
    maior = Vector((max(p.x for p in pontos), max(p.y for p in pontos), max(p.z for p in pontos)))
    return menor, maior


def main() -> None:
    glb, saida = argumentos()
    saida.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(glb))
    info: dict = {"objetos": []}
    for obj in bpy.context.scene.objects:
        item = {"nome": obj.name, "tipo": obj.type}
        if obj.type == "MESH":
            menor, maior = caixa_mundo(obj)
            item["caixa"] = [list(menor), list(maior)]
            item["vertices"] = len(obj.data.vertices)
            item["faces"] = len(obj.data.polygons)
            item["materiais"] = [m.name for m in obj.data.materials if m]
            # Normal média ponderada pela área: para onde a frente da máscara olha.
            soma = Vector((0, 0, 0))
            for p in obj.data.polygons:
                soma += (obj.matrix_world.to_3x3() @ p.normal) * p.area
            item["normal_media"] = list(soma.normalized())
            # Arestas com uma face só: a borda da máscara e a dos olhos (onde o fogo nasce).
            contagem: dict[tuple[int, int], int] = {}
            for p in obj.data.polygons:
                for chave in p.edge_keys:
                    contagem[chave] = contagem.get(chave, 0) + 1
            item["arestas_de_borda"] = sum(1 for n in contagem.values() if n == 1)
        info["objetos"].append(item)
    for img in bpy.data.images:
        info.setdefault("imagens", []).append({"nome": img.name, "tamanho": list(img.size)})
    for mat in bpy.data.materials:
        if not mat.node_tree:
            continue
        nos = [f"{n.type}:{n.name}" for n in mat.node_tree.nodes]
        info.setdefault("materiais", {})[mat.name] = nos
    (saida / "inventario.json").write_text(json.dumps(info, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(info, indent=2, ensure_ascii=False))

    mascara = next(o for o in bpy.context.scene.objects if o.type == "MESH" and len(o.data.vertices) > 100)
    menor, maior = caixa_mundo(mascara)
    centro = (menor + maior) / 2
    raio = (maior - menor).length / 2
    cena = bpy.context.scene
    cena.render.engine = "BLENDER_EEVEE"
    cena.render.resolution_x = 640
    cena.render.resolution_y = 640
    mundo = bpy.data.worlds.new("mundo")
    cena.world = mundo
    mundo.use_nodes = True
    fundo = next(n for n in mundo.node_tree.nodes if n.type == "BACKGROUND")
    fundo.inputs[0].default_value = (0.35, 0.35, 0.38, 1)
    for obj in cena.objects:
        if obj.type == "MESH" and obj is not mascara:
            obj.hide_render = True
    cam_dados = bpy.data.cameras.new("cam")
    cam_dados.type = "ORTHO"
    cam_dados.ortho_scale = raio * 2.2
    cam = bpy.data.objects.new("cam", cam_dados)
    cena.collection.objects.link(cam)
    cena.camera = cam
    vistas = {
        "menos_y": Vector((0, -1, 0)),
        "mais_y": Vector((0, 1, 0)),
        "lado_mais_x": Vector((1, 0, 0)),
        "cima": Vector((0, 0, 1)),
    }
    for nome, direcao in vistas.items():
        cam.location = centro + direcao * raio * 4
        alvo = centro - cam.location
        cam.rotation_euler = alvo.to_track_quat("-Z", "Y" if nome == "cima" else "Z").to_euler()
        cena.render.filepath = str(saida / f"vista-{nome}.png")
        bpy.ops.render.render(write_still=True)
    print("centro", list(centro), "raio", raio, "graus", math.degrees(0))


main()
