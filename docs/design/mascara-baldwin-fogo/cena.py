"""Máscara de Baldwin IV pegando fogo: abertura de batalha (rascunho para aprovar).

Mesmo formato da "Armaduras despertam": 1280x720, 30 fps, 126 quadros (4,2 s); o app fecha a cortina em 0,3 s
depois do último quadro. A cena sai inteira deste script, no Blender sem janela:

  blender --background --factory-startup --python cena.py -- <mascara.glb> <saida> [opções]

Opções: --resolucao-fogo 64 (divisões do domínio no eixo maior; padrão 80), --escala 50 (porcentagem de 1280x720),
--amostras 32 (EEVEE; padrão 64), --quadros 1,40,105 (só esses, contados de 1), --so-grafico (simula e mede, sem render).

O .glb é dado não confiável (baixado): entra só pelo importador glTF do Blender. O fogo é simulação Mantaflow
(gás com fogo e fumaça) com detalhe de ruído no shader do volume; o EEVEE não acende superfície com volume, então o
brilho do fogo no metal vem de luzes que seguem o combustível, com tremulação. Faíscas são partículas.
Tudo que depende do tempo mora nas funções de curva abaixo e sai no grafico.json (o som lê de lá).
"""

import heapq
import json
import math
import random
import shutil
import sys
import time
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

FPS = 30
QUADROS = 126  # 4,2 s, como a Armaduras despertam
DURACAO_S = QUADROS / FPS
CORTINA_S = 0.3
LARGURA, ALTURA = 1280, 720
ALTURA_MASCARA_M = 1.0
DISCO_MINIMO_GB = 5.0
SEMENTE = 7

# Linha do tempo (s). O som e as medidas leem estes instantes do grafico.json.
T_BRASA_OLHOS = 0.25
T_BRASA_BORDA = 0.60
T_LINGUAS = 0.70  # primeiras línguas de fogo saindo dos olhos
T_IGNICAO = 1.45  # o fogo pega de vez (whoosh)
T_CLIMAX = 3.50
T_FIM = DURACAO_S

COR_FOGO = (1.0, 0.42, 0.10)
COR_LUA = (0.55, 0.66, 1.0)


# ---------------------------------------------------------------- curvas


def suave(a: float, b: float, t: float) -> float:
    if t <= a:
        return 0.0
    if t >= b:
        return 1.0
    x = (t - a) / (b - a)
    return x * x * (3 - 2 * x)


def sai(a: float, b: float, t: float) -> float:
    """Ease-out cúbico de 0 a 1 entre a e b."""
    if t <= a:
        return 0.0
    if t >= b:
        return 1.0
    x = (t - a) / (b - a)
    return 1 - (1 - x) ** 3


def pulso(centro: float, largura: float, t: float) -> float:
    return math.exp(-(((t - centro) / largura) ** 2))


def brasa_olhos(t: float) -> float:
    return suave(T_BRASA_OLHOS, 1.35, t)


def brasa_borda(t: float) -> float:
    return suave(T_BRASA_BORDA, 1.6, t)


def combustivel(t: float) -> dict[str, float]:
    """Combustível de cada emissor (o Mantaflow lê por quadro)."""
    # A simulação responde com ~0,15 s de atraso: a rajada começa antes para o fogo estourar no clímax.
    rajada = pulso(T_CLIMAX - 0.06, 0.09, t)
    olhos = 0.35 * suave(T_LINGUAS - 0.1, 1.25, t) + 0.75 * sai(T_IGNICAO - 0.1, T_IGNICAO + 0.35, t) + 1.6 * rajada
    borda = 0.3 * suave(0.9, 1.4, t) + 1.1 * sai(T_IGNICAO, T_IGNICAO + 0.5, t) + 1.6 * rajada
    costas = 1.7 * sai(T_IGNICAO - 0.05, T_IGNICAO + 0.45, t) + 0.5 * suave(2.0, 3.3, t) + 3.2 * rajada
    frente = 0.35 * suave(2.1, 3.2, t) + 0.6 * rajada
    climax = 4.5 * pulso(T_CLIMAX - 0.05, 0.06, t)
    return {"olhos": olhos, "borda": borda, "costas": costas, "frente": frente, "climax": climax}


def subida_rajada(t: float) -> float:
    """Velocidade inicial para cima (m/s) dos emissores de trás: 0,5 sempre, mais 4 no clímax."""
    return 0.5 + 4.0 * pulso(T_CLIMAX - 0.06, 0.09, t)


def tremula(t: float, fase: float, rapidez: float = 1.0) -> float:
    """Tremulação determinística em [~0,55; ~1,45]: soma de senos incomensuráveis."""
    s = (
        0.22 * math.sin(2 * math.pi * 1.7 * rapidez * t + fase)
        + 0.14 * math.sin(2 * math.pi * 4.3 * rapidez * t + 2.1 * fase)
        + 0.09 * math.sin(2 * math.pi * 9.1 * rapidez * t + 0.7 * fase)
    )
    return 1 + s


def camera_em(t: float) -> tuple[Vector, Vector]:
    """Câmera: empurra devagar (easeInOutSine) e treme 0,45 s depois do clímax."""
    x = (1 - math.cos(math.pi * min(1.0, t / T_FIM))) / 2
    dist = 3.30 + (2.80 - 3.30) * x
    altura = -0.12 + 0.06 * x
    alvo = Vector((0.0, 0.0, 0.17))
    amp = 0.012 * pulso(T_CLIMAX + 0.12, 0.22, t) * (1 if t >= T_CLIMAX - 0.05 else 0)
    alvo += Vector((amp * math.sin(t * 71.0), 0.0, amp * math.sin(t * 53.0 + 1.3)))
    return Vector((0.0, -dist, altura)), alvo


# ---------------------------------------------------------------- utilidades


def argumentos() -> dict:
    resto = sys.argv[sys.argv.index("--") + 1 :]
    opcoes = {
        "glb": Path(resto[0]),
        "saida": Path(resto[1]),
        "resolucao": 80,
        "escala": 100,
        "amostras": 64,
        "quadros": None,
        "so_grafico": False,
    }
    i = 2
    while i < len(resto):
        chave = resto[i]
        if chave == "--resolucao-fogo":
            opcoes["resolucao"] = int(resto[i + 1])
            i += 2
        elif chave == "--escala":
            opcoes["escala"] = int(resto[i + 1])
            i += 2
        elif chave == "--amostras":
            opcoes["amostras"] = int(resto[i + 1])
            i += 2
        elif chave == "--quadros":
            opcoes["quadros"] = [int(q) for q in resto[i + 1].split(",")]
            i += 2
        elif chave == "--so-grafico":
            opcoes["so_grafico"] = True
            i += 1
        elif chave == "--so-montar":
            opcoes["so_montar"] = True
            i += 1
        else:
            raise SystemExit(f"opção desconhecida: {chave}")
    return opcoes


def conferir_disco(pasta: Path) -> float:
    livre = shutil.disk_usage(pasta.anchor).free / 1e9
    if livre < DISCO_MINIMO_GB:
        raise SystemExit(f"PARADO: disco com {livre:.2f} GB livres (piso {DISCO_MINIMO_GB} GB)")
    return livre


def definir(alvo, **valores) -> None:
    """Atribui só o que existe nesta versão do Blender (nomes mudam entre versões)."""
    for nome, valor in valores.items():
        if hasattr(alvo, nome):
            try:
                setattr(alvo, nome, valor)
            except (TypeError, ValueError) as erro:
                print(f"aviso: {type(alvo).__name__}.{nome} = {valor!r} recusado: {erro}")
        else:
            print(f"aviso: {type(alvo).__name__} sem {nome}")


def no(arvore, tipo: str, x: float = 0, y: float = 0):
    n = arvore.nodes.new(tipo)
    n.location = (x, y)
    return n


def chave_por_quadro(alvo, propriedade: str, valores: list[float]) -> None:
    """Uma chave por quadro, interpolação linear (valores[0] é o quadro 1)."""
    for i, v in enumerate(valores):
        setattr(alvo, propriedade, v)
        alvo.keyframe_insert(propriedade, frame=i + 1)


def linearizar(id_dados) -> None:
    anim = id_dados.animation_data
    if not anim or not anim.action:
        return
    curvas = []
    acao = anim.action
    if hasattr(acao, "fcurves"):
        curvas = list(acao.fcurves)
    else:  # ações em camadas (Blender 4.4+)
        for camada in acao.layers:
            for faixa in camada.strips:
                for canal in faixa.channelbags:
                    curvas.extend(canal.fcurves)
    for fc in curvas:
        for k in fc.keyframe_points:
            k.interpolation = "LINEAR"


# ---------------------------------------------------------------- máscara


def importar_mascara(glb: Path) -> bpy.types.Object:
    bpy.ops.import_scene.gltf(filepath=str(glb))
    malhas = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    mascara = max(malhas, key=lambda o: len(o.data.vertices))
    for o in malhas:
        if o is not mascara:
            bpy.data.objects.remove(o, do_unlink=True)
    # Assa a transformação na malha e põe em pé: a frente vinha para +Z e a testa para +Y.
    mundo = mascara.matrix_world.copy()
    mascara.parent = None
    mascara.data.transform(mundo)
    mascara.matrix_world = Matrix.Identity(4)
    mascara.data.transform(Matrix.Rotation(math.radians(90), 4, "X"))
    pontos = [v.co for v in mascara.data.vertices]
    menor = Vector((min(p.x for p in pontos), min(p.y for p in pontos), min(p.z for p in pontos)))
    maior = Vector((max(p.x for p in pontos), max(p.y for p in pontos), max(p.z for p in pontos)))
    escala = ALTURA_MASCARA_M / (maior.z - menor.z)
    centro = (menor + maior) / 2
    mascara.data.transform(Matrix.Scale(escala, 4) @ Matrix.Translation(-centro))
    mascara.data.update()
    for o in [o for o in bpy.context.scene.objects if o.type == "EMPTY"]:
        bpy.data.objects.remove(o, do_unlink=True)
    mascara.name = "mascara"
    for p in mascara.data.polygons:
        p.use_smooth = True
    return mascara


def malha_soldada(mascara: bpy.types.Object) -> bmesh.types.BMesh:
    bm = bmesh.new()
    bm.from_mesh(mascara.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bm.normal_update()
    bm.verts.ensure_lookup_table()
    bm.edges.ensure_lookup_table()
    bm.faces.ensure_lookup_table()
    return bm


CELULA_M = 0.008  # grade dos raios de frente


def furos_por_raio(bm: bmesh.types.BMesh) -> dict:
    """A máscara é casca fechada (com espessura): olhos e boca são túneis, sem aresta de borda.

    Raios de frente (-Y para +Y) numa grade: célula que erra a malha e não encosta na borda da grade é furo; os furos
    viram grupos (olhos = os dois maiores na metade de cima). Célula que acerta e encosta em furo ou no fundo é borda.
    """
    arvore = BVHTree.FromBMesh(bm)
    xs = [v.co.x for v in bm.verts]
    zs = [v.co.z for v in bm.verts]
    x0, x1, z0, z1 = min(xs) - 0.02, max(xs) + 0.02, min(zs) - 0.02, max(zs) + 0.02
    nx, nz = int((x1 - x0) / CELULA_M) + 1, int((z1 - z0) / CELULA_M) + 1
    acerto: dict[tuple[int, int], float] = {}
    for i in range(nx):
        for k in range(nz):
            origem = Vector((x0 + i * CELULA_M, -2.0, z0 + k * CELULA_M))
            pos, _n, _f, _d = arvore.ray_cast(origem, Vector((0, 1, 0)))
            if pos is not None:
                acerto[(i, k)] = pos.y
    # Fundo: erros ligados à borda da grade.
    fundo: set[tuple[int, int]] = set()
    pilha = [(i, k) for i in range(nx) for k in (0, nz - 1)] + [(i, k) for i in (0, nx - 1) for k in range(nz)]
    while pilha:
        c = pilha.pop()
        if c in fundo or c in acerto or not (0 <= c[0] < nx and 0 <= c[1] < nz):
            continue
        fundo.add(c)
        pilha.extend([(c[0] + 1, c[1]), (c[0] - 1, c[1]), (c[0], c[1] + 1), (c[0], c[1] - 1)])
    furos_celulas = {(i, k) for i in range(nx) for k in range(nz) if (i, k) not in acerto and (i, k) not in fundo}
    grupos, vistos = [], set()
    for c in furos_celulas:
        if c in vistos:
            continue
        pilha, grupo = [c], []
        while pilha:
            d = pilha.pop()
            if d in vistos or d not in furos_celulas:
                continue
            vistos.add(d)
            grupo.append(d)
            pilha.extend([(d[0] + 1, d[1]), (d[0] - 1, d[1]), (d[0], d[1] + 1), (d[0], d[1] - 1)])
        grupos.append(grupo)

    def ponto(c: tuple[int, int]) -> Vector:
        return Vector((x0 + c[0] * CELULA_M, acerto.get(c, 0.0), z0 + c[1] * CELULA_M))

    def borda_de(conjunto: set[tuple[int, int]]) -> list[Vector]:
        pontos = []
        for c, y in acerto.items():
            viz = [(c[0] + 1, c[1]), (c[0] - 1, c[1]), (c[0], c[1] + 1), (c[0], c[1] - 1)]
            if any(v in conjunto for v in viz):
                pontos.append(Vector((x0 + c[0] * CELULA_M, y, z0 + c[1] * CELULA_M)))
        return pontos

    furos = []
    for g in grupos:
        conjunto = set(g)
        centro = sum((ponto(c) for c in g), Vector()) / len(g)
        borda = borda_de(conjunto)
        y_borda = sum(p.y for p in borda) / max(1, len(borda))
        furos.append({"pontos": [ponto(c) for c in g], "centro": Vector((centro.x, y_borda, centro.z)),
                      "area": len(g) * CELULA_M**2, "borda": borda})
    furos.sort(key=lambda f: -f["area"])
    olhos = [f for f in furos if f["centro"].z > 0.0 and abs(f["centro"].x) > 0.04][:2]
    boca = [f for f in furos if f["centro"].z < -0.08 and abs(f["centro"].x) < 0.1][:1]
    return {
        "olhos": sorted(olhos, key=lambda f: f["centro"].x),
        "boca": boca,
        "contorno": {"borda": borda_de(fundo)},
        "grade": {"nx": nx, "nz": nz, "acertos": len(acerto), "furos": [round(f["area"] * 1e4, 1) for f in furos[:6]]},
    }


def sementes_perto(bm: bmesh.types.BMesh, pontos: list[Vector], raio: float) -> list[int]:
    arvore = KDTree(len(bm.verts))
    for v in bm.verts:
        arvore.insert(v.co, v.index)
    arvore.balance()
    achados: set[int] = set()
    for p in pontos:
        for _co, indice, _d in arvore.find_range(p, raio):
            achados.add(indice)
    return sorted(achados)


def geodesica(bm: bmesh.types.BMesh, sementes: list[int]) -> list[float]:
    dist = [math.inf] * len(bm.verts)
    fila = []
    for s in sementes:
        dist[s] = 0.0
        fila.append((0.0, s))
    heapq.heapify(fila)
    while fila:
        d, v = heapq.heappop(fila)
        if d > dist[v]:
            continue
        for e in bm.verts[v].link_edges:
            o = e.other_vert(bm.verts[v]).index
            nd = d + e.calc_length()
            if nd < dist[o]:
                dist[o] = nd
                heapq.heappush(fila, (nd, o))
    return dist


def gravar_atributos(mascara: bpy.types.Object, bm: bmesh.types.BMesh, campos: dict[str, list[float]]) -> None:
    arvore = KDTree(len(bm.verts))
    for v in bm.verts:
        arvore.insert(v.co, v.index)
    arvore.balance()
    perto = [arvore.find(v.co)[1] for v in mascara.data.vertices]
    for nome, valores in campos.items():
        atributo = mascara.data.attributes.new(nome, "FLOAT", "POINT")
        atributo.data.foreach_set("value", [min(valores[i], 9.0) for i in perto])


def objeto_de_bmesh(nome: str, bm: bmesh.types.BMesh) -> bpy.types.Object:
    malha = bpy.data.meshes.new(nome)
    bm.to_mesh(malha)
    obj = bpy.data.objects.new(nome, malha)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def emissor_olhos(furos: dict) -> bpy.types.Object:
    """Um quadradinho por célula do furo, um pouco para dentro do túnel do olho."""
    novo = bmesh.new()
    meia = CELULA_M * 0.5
    for olho in furos["olhos"]:
        y = olho["centro"].y + 0.015
        for p in olho["pontos"]:
            v = [novo.verts.new((p.x + dx, y, p.z + dz)) for dx, dz in ((-meia, -meia), (meia, -meia), (meia, meia), (-meia, meia))]
            novo.faces.new(v)
    return objeto_de_bmesh("emissor_olhos", novo)


def copia_filtrada(nome: str, bm: bmesh.types.BMesh, manter, desloca: Vector, escala: float = 1.0) -> bpy.types.Object:
    novo = bm.copy()
    novo.faces.ensure_lookup_table()
    fora = [f for f in novo.faces if not manter(f)]
    bmesh.ops.delete(novo, geom=fora, context="FACES")
    for v in novo.verts:
        v.co = v.co * escala + desloca
    return objeto_de_bmesh(nome, novo)


# ---------------------------------------------------------------- materiais


def material_mascara(mascara: bpy.types.Object, valores: dict[str, list[float]]) -> None:
    mat = mascara.data.materials[0]
    arvore = mat.node_tree
    bsdf = next(n for n in arvore.nodes if n.type == "BSDF_PRINCIPLED")
    # Metal mais liso que o lambert de origem: o fogo precisa de reflexo para virar brilho alaranjado no metal.
    if not bsdf.inputs["Roughness"].is_linked:
        bsdf.inputs["Roughness"].default_value = 0.38
    # Escurece a cor da textura (aço escuro): com a cor de origem o fogo deixava a máscara cor de cobre chapado.
    ligacao = next((lk for lk in arvore.links if lk.to_socket == bsdf.inputs["Base Color"]), None)
    escurece = no(arvore, "ShaderNodeMix", -200, 300)
    escurece.data_type = "RGBA"
    escurece.blend_type = "MULTIPLY"
    escurece.inputs["Factor"].default_value = 1.0
    escurece.inputs[7].default_value = (0.36, 0.35, 0.37, 1)  # B (RGBA)
    if ligacao is not None:
        arvore.links.new(ligacao.from_socket, escurece.inputs[6])  # A (RGBA)
    else:
        escurece.inputs[6].default_value = bsdf.inputs["Base Color"].default_value
    arvore.links.new(escurece.outputs[2], bsdf.inputs["Base Color"])
    entradas = {}
    for i, nome in enumerate(["p_olhos", "p_borda", "p_calor", "p_tempo"]):
        v = no(arvore, "ShaderNodeValue", -1400, -600 - 120 * i)
        v.name = v.label = nome
        entradas[nome] = v
    att_o = no(arvore, "ShaderNodeAttribute", -1400, -1100)
    att_o.attribute_type = "GEOMETRY"
    att_o.attribute_name = "d_olhos"
    att_b = no(arvore, "ShaderNodeAttribute", -1400, -1250)
    att_b.attribute_type = "GEOMETRY"
    att_b.attribute_name = "d_borda"

    def frente(valor_no, atributo, alcance: float):
        # brasa = clamp((p * alcance - d) / 0,03): uma frente que anda pela máscara a partir do olho ou da borda.
        mult = no(arvore, "ShaderNodeMath", -1150, valor_no.location.y)
        mult.operation = "MULTIPLY"
        mult.inputs[1].default_value = alcance
        arvore.links.new(valor_no.outputs[0], mult.inputs[0])
        sub = no(arvore, "ShaderNodeMath", -1000, valor_no.location.y)
        sub.operation = "SUBTRACT"
        arvore.links.new(mult.outputs[0], sub.inputs[0])
        arvore.links.new(atributo.outputs["Fac"], sub.inputs[1])
        div = no(arvore, "ShaderNodeMath", -850, valor_no.location.y)
        div.operation = "DIVIDE"
        div.use_clamp = True
        div.inputs[1].default_value = 0.035
        arvore.links.new(sub.outputs[0], div.inputs[0])
        return div

    f_olhos = frente(entradas["p_olhos"], att_o, 0.10)
    f_borda = frente(entradas["p_borda"], att_b, 0.075)
    junta = no(arvore, "ShaderNodeMath", -700, -700)
    junta.operation = "MAXIMUM"
    arvore.links.new(f_olhos.outputs[0], junta.inputs[0])
    arvore.links.new(f_borda.outputs[0], junta.inputs[1])

    # Mosqueado da brasa: ruído 4D que respira com o tempo.
    coord = no(arvore, "ShaderNodeTexCoord", -1400, -1450)
    ruido = no(arvore, "ShaderNodeTexNoise", -1150, -1450)
    ruido.noise_dimensions = "4D"
    ruido.inputs["Scale"].default_value = 38.0
    ruido.inputs["Detail"].default_value = 3.0
    arvore.links.new(coord.outputs["Object"], ruido.inputs["Vector"])
    vel = no(arvore, "ShaderNodeMath", -1300, -1600)
    vel.operation = "MULTIPLY"
    vel.inputs[1].default_value = 1.6
    arvore.links.new(entradas["p_tempo"].outputs[0], vel.inputs[0])
    arvore.links.new(vel.outputs[0], ruido.inputs["W"])
    mapa = no(arvore, "ShaderNodeMapRange", -950, -1450)
    mapa.inputs["From Min"].default_value = 0.38
    mapa.inputs["From Max"].default_value = 0.68
    mapa.inputs["To Min"].default_value = 0.25
    mapa.inputs["To Max"].default_value = 1.0
    arvore.links.new(ruido.outputs["Fac"], mapa.inputs["Value"])
    brasa = no(arvore, "ShaderNodeMath", -550, -800)
    brasa.operation = "MULTIPLY"
    arvore.links.new(junta.outputs[0], brasa.inputs[0])
    arvore.links.new(mapa.outputs["Result"], brasa.inputs[1])
    # Calor geral (metal em brasa fraca) entra no clímax.
    calor = no(arvore, "ShaderNodeMath", -400, -800)
    calor.operation = "MULTIPLY_ADD"
    arvore.links.new(entradas["p_calor"].outputs[0], calor.inputs[0])
    arvore.links.new(mapa.outputs["Result"], calor.inputs[1])
    arvore.links.new(brasa.outputs[0], calor.inputs[2])

    rampa = no(arvore, "ShaderNodeValToRGB", -250, -800)
    cores = [(0.0, (0.0, 0.0, 0.0)), (0.25, (0.45, 0.02, 0.0)), (0.6, (1.0, 0.22, 0.02)), (1.0, (1.0, 0.62, 0.22))]
    elementos = rampa.color_ramp.elements
    elementos[0].position, elementos[0].color = cores[0][0], (*cores[0][1], 1)
    elementos[1].position, elementos[1].color = cores[-1][0], (*cores[-1][1], 1)
    for pos, cor in cores[1:-1]:
        e = elementos.new(pos)
        e.color = (*cor, 1)
    arvore.links.new(calor.outputs[0], rampa.inputs["Fac"])
    forca = no(arvore, "ShaderNodeMath", -250, -1000)
    forca.operation = "POWER"
    forca.inputs[1].default_value = 2.0
    arvore.links.new(calor.outputs[0], forca.inputs[0])
    forca2 = no(arvore, "ShaderNodeMath", -100, -1000)
    forca2.operation = "MULTIPLY"
    forca2.inputs[1].default_value = 7.0
    arvore.links.new(forca.outputs[0], forca2.inputs[0])
    arvore.links.new(rampa.outputs["Color"], bsdf.inputs["Emission Color"])
    arvore.links.new(forca2.outputs[0], bsdf.inputs["Emission Strength"])

    for nome, v in entradas.items():
        chave_por_quadro(v.outputs[0], "default_value", valores[nome])
    linearizar(arvore)


def material_fogo(valores_tempo: list[float]) -> bpy.types.Material:
    mat = bpy.data.materials.new("fogo")
    mat.use_nodes = True
    arvore = mat.node_tree
    for n in list(arvore.nodes):
        arvore.nodes.remove(n)
    saida = no(arvore, "ShaderNodeOutputMaterial", 900, 0)
    vol = no(arvore, "ShaderNodeVolumePrincipled", 600, 0)
    info = no(arvore, "ShaderNodeVolumeInfo", -900, 100)
    tempo = no(arvore, "ShaderNodeValue", -1100, -300)
    tempo.name = tempo.label = "p_tempo"
    # Detalhe abaixo da grade da simulação: ruído 4D que sobe com o tempo e rasga a chama em línguas.
    coord = no(arvore, "ShaderNodeTexCoord", -1100, -100)
    sobe = no(arvore, "ShaderNodeVectorMath", -900, -150)
    sobe.operation = "SUBTRACT"
    combina = no(arvore, "ShaderNodeCombineXYZ", -1000, -400)
    vel_sub = no(arvore, "ShaderNodeMath", -1100, -450)
    vel_sub.operation = "MULTIPLY"
    vel_sub.inputs[1].default_value = 1.15
    arvore.links.new(tempo.outputs[0], vel_sub.inputs[0])
    arvore.links.new(vel_sub.outputs[0], combina.inputs["Z"])
    arvore.links.new(coord.outputs["Object"], sobe.inputs[0])
    arvore.links.new(combina.outputs[0], sobe.inputs[1])
    estica = no(arvore, "ShaderNodeVectorMath", -750, -150)
    estica.operation = "MULTIPLY"
    estica.inputs[1].default_value = (1.0, 1.0, 0.55)
    arvore.links.new(sobe.outputs[0], estica.inputs[0])
    ruido = no(arvore, "ShaderNodeTexNoise", -550, -150)
    ruido.noise_dimensions = "4D"
    ruido.inputs["Scale"].default_value = 7.5
    ruido.inputs["Detail"].default_value = 5.0
    ruido.inputs["Roughness"].default_value = 0.58
    ruido.inputs["Distortion"].default_value = 0.35
    arvore.links.new(estica.outputs[0], ruido.inputs["Vector"])
    w = no(arvore, "ShaderNodeMath", -750, -350)
    w.operation = "MULTIPLY"
    w.inputs[1].default_value = 0.9
    arvore.links.new(tempo.outputs[0], w.inputs[0])
    arvore.links.new(w.outputs[0], ruido.inputs["W"])
    detalhe = no(arvore, "ShaderNodeMapRange", -350, -150)
    detalhe.inputs["From Min"].default_value = 0.30
    detalhe.inputs["From Max"].default_value = 0.72
    detalhe.inputs["To Min"].default_value = 0.10
    detalhe.inputs["To Max"].default_value = 1.7
    arvore.links.new(ruido.outputs["Fac"], detalhe.inputs["Value"])
    chama = no(arvore, "ShaderNodeMath", -150, 100)
    chama.operation = "MULTIPLY"
    arvore.links.new(info.outputs["Flame"], chama.inputs[0])
    arvore.links.new(detalhe.outputs["Result"], chama.inputs[1])
    chama_lim = no(arvore, "ShaderNodeMath", 0, 100)
    chama_lim.operation = "MINIMUM"
    chama_lim.inputs[1].default_value = 1.5
    arvore.links.new(chama.outputs[0], chama_lim.inputs[0])
    # Cor: vermelho escuro nas pontas, laranja no corpo, amarelo-branco no núcleo.
    rampa = no(arvore, "ShaderNodeValToRGB", 200, 200)
    paradas = [
        (0.0, (0.0, 0.0, 0.0)),
        (0.08, (0.35, 0.02, 0.0)),
        (0.28, (1.0, 0.16, 0.01)),
        (0.55, (1.0, 0.42, 0.05)),
        (0.85, (1.0, 0.72, 0.28)),
        (1.2, (1.0, 0.93, 0.78)),
    ]
    el = rampa.color_ramp.elements
    el[0].position, el[0].color = 0.0, (0, 0, 0, 1)
    el[1].position, el[1].color = 1.0, (*paradas[-1][1], 1)
    for pos, cor in paradas[1:-1]:
        e = el.new(min(pos, 0.99))
        e.color = (*cor, 1)
    escala_cor = no(arvore, "ShaderNodeMath", 100, 300)
    escala_cor.operation = "MULTIPLY"
    escala_cor.inputs[1].default_value = 1 / 1.2
    escala_cor.use_clamp = True
    arvore.links.new(chama_lim.outputs[0], escala_cor.inputs[0])
    arvore.links.new(escala_cor.outputs[0], rampa.inputs["Fac"])
    potencia = no(arvore, "ShaderNodeMath", 200, -50)
    potencia.operation = "POWER"
    potencia.inputs[1].default_value = 1.7
    arvore.links.new(chama_lim.outputs[0], potencia.inputs[0])
    brilho = no(arvore, "ShaderNodeMath", 380, -50)
    brilho.operation = "MULTIPLY"
    brilho.inputs[1].default_value = 65.0
    brilho.name = "brilho_fogo"
    arvore.links.new(potencia.outputs[0], brilho.inputs[0])
    arvore.links.new(rampa.outputs["Color"], vol.inputs["Emission Color"])
    arvore.links.new(brilho.outputs[0], vol.inputs["Emission Strength"])
    # Fumaça escura, mais rala onde a chama come.
    dens = no(arvore, "ShaderNodeMath", 200, -250)
    dens.operation = "MULTIPLY"
    dens.inputs[1].default_value = 7.0
    dens.name = "densidade_fumaca"
    arvore.links.new(info.outputs["Density"], dens.inputs[0])
    arvore.links.new(dens.outputs[0], vol.inputs["Density"])
    vol.inputs["Color"].default_value = (0.06, 0.055, 0.05, 1)
    vol.inputs["Anisotropy"].default_value = 0.35
    arvore.links.new(vol.outputs[0], saida.inputs["Volume"])
    chave_por_quadro(tempo.outputs[0], "default_value", valores_tempo)
    linearizar(arvore)
    return mat


def material_faisca() -> bpy.types.Material:
    mat = bpy.data.materials.new("faisca")
    mat.use_nodes = True
    arvore = mat.node_tree
    for n in list(arvore.nodes):
        arvore.nodes.remove(n)
    saida = no(arvore, "ShaderNodeOutputMaterial", 600, 0)
    emi = no(arvore, "ShaderNodeEmission", 400, 0)
    info = no(arvore, "ShaderNodeParticleInfo", -400, 0)
    idade = no(arvore, "ShaderNodeMath", -200, 0)
    idade.operation = "DIVIDE"
    idade.use_clamp = True
    arvore.links.new(info.outputs["Age"], idade.inputs[0])
    arvore.links.new(info.outputs["Lifetime"], idade.inputs[1])
    rampa = no(arvore, "ShaderNodeValToRGB", 0, 100)
    el = rampa.color_ramp.elements
    el[0].position, el[0].color = 0.0, (1.0, 0.48, 0.10, 1)
    el[1].position, el[1].color = 1.0, (0.6, 0.06, 0.0, 1)
    meio = el.new(0.45)
    meio.color = (1.0, 0.42, 0.06, 1)
    arvore.links.new(idade.outputs[0], rampa.inputs["Fac"])
    resto = no(arvore, "ShaderNodeMath", 0, -150)
    resto.operation = "SUBTRACT"
    resto.inputs[0].default_value = 1.0
    arvore.links.new(idade.outputs[0], resto.inputs[1])
    forca = no(arvore, "ShaderNodeMath", 200, -150)
    forca.operation = "POWER"
    forca.inputs[1].default_value = 1.4
    arvore.links.new(resto.outputs[0], forca.inputs[0])
    forca2 = no(arvore, "ShaderNodeMath", 300, -250)
    forca2.operation = "MULTIPLY"
    forca2.inputs[1].default_value = 8.0
    arvore.links.new(forca.outputs[0], forca2.inputs[0])
    arvore.links.new(rampa.outputs["Color"], emi.inputs["Color"])
    arvore.links.new(forca2.outputs[0], emi.inputs["Strength"])
    arvore.links.new(emi.outputs[0], saida.inputs["Surface"])
    return mat


# ---------------------------------------------------------------- simulação


def configurar_dominio(resolucao: int, cache: Path, mat: bpy.types.Material, limpar: bool = True) -> bpy.types.Object:
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    menor, maior = Vector((-0.78, -0.36, -0.62)), Vector((0.78, 0.46, 1.58))
    for v in bm.verts:
        v.co = Vector(
            (
                menor.x if v.co.x < 0 else maior.x,
                menor.y if v.co.y < 0 else maior.y,
                menor.z if v.co.z < 0 else maior.z,
            )
        )
    dominio = objeto_de_bmesh("dominio", bm)
    dominio.data.materials.append(mat)
    mod = dominio.modifiers.new("Fluid", "FLUID")
    mod.fluid_type = "DOMAIN"
    ds = mod.domain_settings
    ds.domain_type = "GAS"
    ds.resolution_max = resolucao
    if limpar:
        if cache.exists():
            shutil.rmtree(cache)
        cache.mkdir(parents=True)
    # Cada ajuste do domínio dispara um reset que APAGA os arquivos do cache: a pasta do cache entra por último.
    definir(
        ds,
        use_noise=False,
        use_adaptive_timesteps=True,
        cfl_condition=3.0,
        timesteps_max=4,
        alpha=0.0,
        beta=1.6,
        vorticity=0.4,
        burning_rate=0.4,
        flame_smoke=0.9,
        flame_vorticity=1.0,
        flame_ignition=1.25,
        flame_max_temp=2.2,
        flame_smoke_color=(0.06, 0.05, 0.045),
        use_dissolve_smoke=True,
        dissolve_speed=20,
        use_dissolve_smoke_log=True,
        time_scale=1.0,
        highres_sampling="FULLSAMPLE",
    )
    definir(
        ds,
        cache_type="ALL",
        cache_frame_start=1,
        cache_frame_end=QUADROS,
        cache_data_format="OPENVDB",
        openvdb_cache_compress_type="BLOSC",
        openvdb_data_depth="16",
        cache_directory=str(cache),
    )
    dominio.display_type = "WIRE"
    return dominio


def configurar_fluxo(obj: bpy.types.Object, chave: str, valores: list[float], fumaca: float, velocidade: Vector | None,
                     subida: list[float] | None = None) -> None:
    mod = obj.modifiers.new("Fluid", "FLUID")
    mod.fluid_type = "FLOW"
    fs = mod.flow_settings
    definir(fs, flow_type="BOTH", flow_behavior="INFLOW", flow_source="MESH", surface_distance=0.028, temperature=2.0,
            subframes=1, use_plane_init=False, smoke_color=(0.05, 0.045, 0.04))
    if velocidade is not None:
        definir(fs, use_initial_velocity=True, velocity_coord=velocidade, velocity_factor=0.0, velocity_normal=0.4)
    for i, v in enumerate(valores):
        fs.fuel_amount = v
        fs.density = fumaca * min(1.0, v)
        fs.keyframe_insert("fuel_amount", frame=i + 1)
        fs.keyframe_insert("density", frame=i + 1)
        if velocidade is not None and subida is not None:
            fs.velocity_coord = Vector((velocidade.x, velocidade.y, subida[i]))
            fs.keyframe_insert("velocity_coord", frame=i + 1)
    linearizar(obj)
    obj.hide_render = True
    obj.display_type = "WIRE"
    print(f"fluxo {chave}: {len(obj.data.vertices)} vértices, combustível máx {max(valores):.2f}")


def assar(dominio: bpy.types.Object) -> float:
    cena = bpy.context.scene
    inicio = time.time()
    with bpy.context.temp_override(scene=cena, view_layer=cena.view_layers[0], active_object=dominio, object=dominio,
                                   selected_objects=[dominio], selected_editable_objects=[dominio]):
        resultado = bpy.ops.fluid.bake_all()
    print("bake:", resultado, f"{time.time() - inicio:.1f} s")
    return time.time() - inicio


# ---------------------------------------------------------------- faíscas, luzes, câmera


def faisca_modelo(mat: bpy.types.Material) -> bpy.types.Object:
    bm = bmesh.new()
    # Redonda: a orientação pela velocidade não pegou e a faísca comprida saía deitada ("grão de arroz").
    bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.0032)
    obj = objeto_de_bmesh("faisca", bm)
    obj.data.materials.append(mat)
    obj.location = (0, 0, -100)
    return obj


def sistema_faiscas(emissor: bpy.types.Object, nome: str, modelo: bpy.types.Object, quantos: int, de: int, ate: int,
                    vida: float, subida: float, aleatorio: float, semente: int) -> None:
    mod = emissor.modifiers.new(nome, "PARTICLE_SYSTEM")
    psys = mod.particle_system
    psys.seed = semente
    p = psys.settings
    p.name = nome
    definir(p, count=quantos, frame_start=de, frame_end=ate, lifetime=vida, lifetime_random=0.55, emit_from="FACE",
            use_emit_random=True, normal_factor=0.35, object_align_factor=(0.0, 0.0, subida), factor_random=aleatorio,
            physics_type="NEWTON", mass=0.05, brownian_factor=0.7, drag_factor=0.35, render_type="OBJECT",
            instance_object=modelo, particle_size=1.0, size_random=0.6, use_rotations=True, rotation_mode="VEL",
            timestep=1 / FPS)
    p.effector_weights.gravity = -0.25
    emissor.show_instancer_for_render = False  # o emissor some, as faíscas ficam


def luz(nome: str, tipo: str, pos: tuple, cor: tuple, raio: float) -> bpy.types.Object:
    dados = bpy.data.lights.new(nome, tipo)
    dados.color = cor
    definir(dados, shadow_soft_size=raio, use_shadow=True, volume_factor=1.0)
    obj = bpy.data.objects.new(nome, dados)
    obj.location = pos
    bpy.context.scene.collection.objects.link(obj)
    return obj


# ---------------------------------------------------------------- render


def configurar_render(escala: int, amostras: int) -> None:
    cena = bpy.context.scene
    cena.render.engine = "BLENDER_EEVEE"
    cena.render.resolution_x = LARGURA
    cena.render.resolution_y = ALTURA
    cena.render.resolution_percentage = escala
    cena.render.fps = FPS
    cena.frame_start = 1
    cena.frame_end = QUADROS
    cena.render.image_settings.file_format = "PNG"
    cena.render.image_settings.color_mode = "RGB"
    cena.render.image_settings.color_depth = "8"
    cena.render.film_transparent = False
    ev = cena.eevee
    definir(ev, taa_render_samples=amostras, volumetric_tile_size="2" if escala >= 100 else "4", volumetric_samples=96,
            volumetric_start=1.4, volumetric_end=4.6, volumetric_sample_distribution=0.6, use_volumetric_shadows=True,
            volumetric_shadow_samples=16, volumetric_ray_depth=8, use_shadows=True, use_raytracing=True,
            shadow_ray_count=2, shadow_step_count=8)
    vt = cena.view_settings
    try:
        vt.view_transform = "AgX"
    except TypeError as erro:
        print("aviso: view_transform", erro)
    looks = [i.identifier for i in vt.bl_rna.properties["look"].enum_items]
    escolhido = next((nome for nome in looks if "Punchy" in nome), None) or next(
        (nome for nome in looks if "High Contrast" in nome), "None")
    vt.look = escolhido
    vt.exposure = 0.0
    print("view:", vt.view_transform, "looks:", looks, "escolhido:", escolhido)
    mundo = bpy.data.worlds.new("escuro")
    cena.world = mundo
    mundo.use_nodes = True
    fundo = next(n for n in mundo.node_tree.nodes if n.type == "BACKGROUND")
    fundo.inputs[0].default_value = (0.0012, 0.0013, 0.0018, 1)
    fundo.inputs[1].default_value = 1.0


def main() -> None:
    op = argumentos()
    saida: Path = op["saida"]
    saida.mkdir(parents=True, exist_ok=True)
    livre = conferir_disco(saida)
    print(f"disco livre: {livre:.2f} GB")
    random.seed(SEMENTE)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    cena = bpy.context.scene

    mascara = importar_mascara(op["glb"])
    bm = malha_soldada(mascara)
    partes = furos_por_raio(bm)
    print("grade:", partes["grade"], "olhos:", [[round(c, 3) for c in o["centro"]] for o in partes["olhos"]],
          "boca:", [[round(c, 3) for c in o["centro"]] for o in partes["boca"]],
          "pontos de contorno:", len(partes["contorno"]["borda"]))
    if len(partes["olhos"]) != 2:
        raise SystemExit("não achei os dois olhos pelos raios de frente")
    sem_olhos = sementes_perto(bm, [p for o in partes["olhos"] for p in o["borda"]], 0.02)
    sem_borda = sementes_perto(bm, partes["contorno"]["borda"], 0.02)
    print("sementes: olhos", len(sem_olhos), "contorno", len(sem_borda))
    d_olhos = geodesica(bm, sem_olhos)
    d_borda = geodesica(bm, sem_borda)
    gravar_atributos(mascara, bm, {"d_olhos": d_olhos, "d_borda": d_borda})

    tempos = [i / FPS for i in range(QUADROS)]
    comb = [combustivel(t) for t in tempos]
    # Calor geral do metal: sobe com o fogo e pula no clímax.
    p_calor = [0.05 * suave(T_IGNICAO, 3.3, t) + 0.16 * pulso(T_CLIMAX + 0.05, 0.18, t) + 0.06 * suave(T_CLIMAX, T_FIM, t)
               for t in tempos]
    material_mascara(mascara, {
        "p_olhos": [brasa_olhos(t) * (0.85 + 0.15 * tremula(t, 0.4, 0.7)) for t in tempos],
        "p_borda": [brasa_borda(t) for t in tempos],
        "p_calor": p_calor,
        "p_tempo": tempos,
    })

    # Emissores do fogo (malhas soltas, não renderizam).
    olhos = emissor_olhos(partes)
    borda = copia_filtrada("emissor_borda", bm, lambda f: all(d_borda[v.index] < 0.07 for v in f.verts), Vector((0, 0.006, 0)))
    costas = copia_filtrada("emissor_costas", bm, lambda f: True, Vector((0, 0.05, 0.04)), 1.0)
    frente = copia_filtrada(
        "emissor_frente", bm,
        lambda f: f.normal.y < -0.35 and min(d_olhos[v.index] for v in f.verts) > 0.03,
        Vector((0, -0.012, 0)),
    )
    # Clímax: a silhueta inteira, um pouco maior e atrás, cospe uma parede de fogo para cima.
    climax = copia_filtrada("emissor_climax", bm, lambda f: True, Vector((0, 0.09, 0.03)), 1.06)
    # A normal da malha da máscara aponta para trás em parte das faces: a frente é decidida pelo lado de -Y.
    if len(frente.data.polygons) < 50:
        bpy.data.objects.remove(frente, do_unlink=True)
        frente = copia_filtrada(
            "emissor_frente", bm,
            lambda f: f.normal.y > 0.35 and min(d_olhos[v.index] for v in f.verts) > 0.03,
            Vector((0, -0.012, 0)),
        )
    subida = [subida_rajada(t) for t in tempos]
    configurar_fluxo(olhos, "olhos", [c["olhos"] for c in comb], 0.25, Vector((0, -0.25, 0.6)), [0.1 + s for s in subida])
    configurar_fluxo(borda, "borda", [c["borda"] for c in comb], 0.35, None)
    configurar_fluxo(costas, "costas", [c["costas"] for c in comb], 0.5, Vector((0, 0.1, 0.5)), subida)
    configurar_fluxo(frente, "frente", [c["frente"] for c in comb], 0.15, None)
    configurar_fluxo(climax, "climax", [c["climax"] for c in comb], 0.6, Vector((0, 0.05, 5.0)))

    mat_fogo = material_fogo(tempos)
    cache = saida / f"cache-fogo-{op['resolucao']}"
    dominio = configurar_dominio(op["resolucao"], cache, mat_fogo, limpar=not op.get("so_montar"))

    # Faíscas: poucas desde as línguas dos olhos, muitas depois da ignição, rajada no clímax.
    modelo = faisca_modelo(material_faisca())
    q = lambda t: int(round(t * FPS)) + 1  # noqa: E731
    emissor_f = copia_filtrada("emissor_faiscas", bm, lambda f: all(d_borda[v.index] < 0.06 for v in f.verts), Vector((0, 0.02, 0)))
    sistema_faiscas(olhos, "faiscas_olhos", modelo, 40, q(T_LINGUAS + 0.2), q(T_IGNICAO), 20, 0.9, 0.5, 11)
    sistema_faiscas(emissor_f, "faiscas_fogo", modelo, 420, q(T_IGNICAO), QUADROS, 24, 1.8, 0.55, 12)
    sistema_faiscas(emissor_f, "faiscas_climax", modelo, 450, q(T_CLIMAX - 0.02), q(T_CLIMAX + 0.08), 26, 5.0, 1.6, 13)
    # Os emissores de faísca precisam renderizar (show_instancer_for_render False esconde a malha, não as faíscas).
    emissor_f.hide_render = False
    olhos.hide_render = False
    bpy.ops.object.effector_add(type="TURBULENCE", location=(0, 0, 0.6))
    turb = bpy.context.active_object
    turb.field.strength = 3.0
    turb.field.size = 0.25
    turb.field.flow = 0.5

    # Luzes. A lua fria recorta a máscara no escuro; as do fogo seguem o combustível com tremulação.
    lua = luz("lua", "AREA", (-1.3, 1.2, 1.9), COR_LUA, 0.8)
    lua.data.energy = 90
    lua.rotation_euler = (Vector((0, 0, 0.15)) - lua.location).to_track_quat("-Z", "Y").to_euler()
    preenche = luz("preenche", "AREA", (0.9, -2.4, 0.6), COR_LUA, 1.5)
    preenche.data.energy = 6
    preenche.rotation_euler = (Vector((0, 0, 0.1)) - preenche.location).to_track_quat("-Z", "Y").to_euler()
    olho_c = [laco["centro"] for laco in partes["olhos"]]
    fogo_luzes = {
        "olho_0": (luz("luz_olho_0", "POINT", tuple(olho_c[0] + Vector((0, 0.03, 0))), COR_FOGO, 0.02), "olhos", 6.0, 0.3),
        "olho_1": (luz("luz_olho_1", "POINT", tuple(olho_c[1] + Vector((0, 0.03, 0))), COR_FOGO, 0.02), "olhos", 6.0, 1.9),
        "esq": (luz("luz_esq", "POINT", (-0.50, -0.02, 0.10), COR_FOGO, 0.08), "borda", 16.0, 2.7),
        "dir": (luz("luz_dir", "POINT", (0.50, -0.02, 0.05), COR_FOGO, 0.08), "borda", 16.0, 4.1),
        "topo": (luz("luz_topo", "POINT", (0.0, -0.05, 0.75), COR_FOGO, 0.12), "costas", 22.0, 5.3),
        "queixo": (luz("luz_queixo", "POINT", (0.05, -0.22, -0.66), COR_FOGO, 0.12), "frente", 30.0, 0.9),
        "costas": (luz("luz_costas", "POINT", (0.0, 0.35, 0.55), COR_FOGO, 0.25), "costas", 220.0, 3.3),
    }
    energias = {}
    for chave, (obj, fonte, maximo, fase) in fogo_luzes.items():
        valores = []
        for i, t in enumerate(tempos):
            base = min(1.4, comb[i][fonte]) if fonte != "olhos" else max(0.25 * brasa_olhos(t), min(1.4, comb[i]["olhos"]))
            valores.append(maximo * base * tremula(t, fase, 1.0 + 0.1 * fase) * (1 + 2.0 * pulso(T_CLIMAX + 0.03, 0.07, t)))
        chave_por_quadro(obj.data, "energy", valores)
        linearizar(obj.data)
        energias[chave] = valores

    cam_dados = bpy.data.cameras.new("camera")
    cam_dados.lens = 35
    cam_dados.sensor_width = 36
    cam_dados.clip_start = 0.1
    cam_dados.clip_end = 20
    cam = bpy.data.objects.new("camera", cam_dados)
    cena.collection.objects.link(cam)
    cena.camera = cam
    for i, t in enumerate(tempos):
        pos, alvo = camera_em(t)
        cam.location = pos
        cam.rotation_euler = (alvo - pos).to_track_quat("-Z", "Y").to_euler()
        cam.keyframe_insert("location", frame=i + 1)
        cam.keyframe_insert("rotation_euler", frame=i + 1)
    linearizar(cam)

    configurar_render(op["escala"], op["amostras"])
    if op.get("so_montar"):
        # Só confere a montagem (nada vai para o disco): contagens e o que cada emissor pegou.
        for o in cena.objects:
            if o.type == "MESH":
                print(f"objeto {o.name}: {len(o.data.vertices)} vértices, {len(o.data.polygons)} faces, "
                      f"modificadores {[m.type for m in o.modifiers]}")
        print("montagem ok")
        return
    conferir_disco(saida)
    t_bake = assar(dominio)
    tam_cache = sum(f.stat().st_size for f in cache.rglob("*") if f.is_file()) / 1e6
    print(f"cache do fogo: {tam_cache:.0f} MB")
    conferir_disco(saida)

    # Mede a simulação quadro a quadro (chama e fumaça somadas) e as faíscas vivas: o som segue isto.
    ds = dominio.modifiers["Fluid"].domain_settings
    chama_total, fumaca_total, faiscas_vivas = [], [], []
    for f in range(1, QUADROS + 1):
        cena.frame_set(f)
        dom_av = dominio.evaluated_get(bpy.context.evaluated_depsgraph_get())
        ds_av = dom_av.modifiers["Fluid"].domain_settings
        chama = list(ds_av.flame_grid) if len(ds_av.flame_grid) else []
        dens = list(ds_av.density_grid) if len(ds_av.density_grid) else []
        chama_total.append(sum(chama))
        fumaca_total.append(sum(dens))
        vivas = 0
        for obj in (olhos, emissor_f):
            av = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
            for ps in av.particle_systems:
                vivas += sum(1 for p in ps.particles if p.alive_state == "ALIVE")
        faiscas_vivas.append(vivas)
    del ds

    grafico = {
        "fps": FPS,
        "quadros": QUADROS,
        "duracao_video_s": DURACAO_S,
        "cortina_s": CORTINA_S,
        "duracao_total_s": DURACAO_S + CORTINA_S,
        "eventos": [
            {"nome": "brasa olhos", "t": T_BRASA_OLHOS},
            {"nome": "brasa borda", "t": T_BRASA_BORDA},
            {"nome": "linguas olhos", "t": T_LINGUAS},
            {"nome": "ignicao", "t": T_IGNICAO},
            {"nome": "climax", "t": T_CLIMAX},
            {"nome": "fim do video", "t": DURACAO_S},
            {"nome": "preto", "t": DURACAO_S + CORTINA_S},
        ],
        "curvas": {
            "t": tempos,
            "brasa_olhos": [brasa_olhos(t) for t in tempos],
            "brasa_borda": [brasa_borda(t) for t in tempos],
            "calor_metal": p_calor,
            "combustivel": {k: [c[k] for c in comb] for k in comb[0]},
            "chama_total": chama_total,
            "fumaca_total": fumaca_total,
            "faiscas_vivas": faiscas_vivas,
            "luz_fogo_total": [sum(v[i] for v in energias.values()) for i in range(QUADROS)],
            "camera_dist": [-camera_em(t)[0].y for t in tempos],
        },
        "simulacao": {"resolucao": op["resolucao"], "bake_s": round(t_bake, 1), "cache_mb": round(tam_cache, 1)},
        "furos": {"olhos": [list(o["centro"]) for o in partes["olhos"]], "grade": partes["grade"]},
    }
    (saida / "grafico.json").write_text(json.dumps(grafico, indent=1, ensure_ascii=False), encoding="utf-8")
    pico = max(chama_total) or 1
    print("chama por 0,3 s:", [round(chama_total[i] / pico, 2) for i in range(0, QUADROS, 9)])
    print("faíscas por 0,3 s:", faiscas_vivas[::9])
    if op["so_grafico"]:
        return

    quadros = op["quadros"] or list(range(1, QUADROS + 1))
    pasta = saida / "quadros"
    pasta.mkdir(exist_ok=True)
    tempos_render = []
    for f in quadros:
        if f % 20 == 0:
            conferir_disco(saida)
        cena.frame_set(f)
        cena.render.filepath = str(pasta / f"q{f - 1:03d}.png")
        inicio = time.time()
        bpy.ops.render.render(write_still=True)
        tempos_render.append(time.time() - inicio)
        print(f"quadro {f}: {tempos_render[-1]:.1f} s")
    (saida / "render.json").write_text(json.dumps({
        "quadros": quadros, "escala": op["escala"], "amostras": op["amostras"],
        "segundos_por_quadro": [round(s, 2) for s in tempos_render],
    }, indent=1), encoding="utf-8")


main()
