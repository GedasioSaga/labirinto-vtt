"""Portão de madeira: monta a cena, anima pelo roteiro.py e renderiza no EEVEE (Blender sem janela).

    "$B" --background --factory-startup --python cena.py -- <saida> [--escala 50] [--amostras 32]
         [--quadros 0,60,120] [--passo 2] [--so-grafico] [--sem-poeira]

Escreve em <saida>: grafico.json (curvas a cada quadro e a cada 0,1 s, eventos), cru/q_NNNN.png (16 bits, sem fade:
o fade, a vinheta e o grão são pós no montar.py) e portao.blend (a cena, para abrir e mexer). Texturas CC0 da
Poly Haven, baixadas por baixar-texturas.cjs para ~/Animações/referencias/portao-madeira/texturas/.
"""

import json
import math
import os
import sys
import time

import bmesh
import bpy
from mathutils import Matrix, Vector

PASTA = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, PASTA)
import roteiro as R

TEXTURAS = os.path.join(os.path.expanduser("~"), "Animações", "referencias", "portao-madeira", "texturas")
LARGURA, ALTURA = 1280, 720
SEMENTE = 1979

# ---------------------------------------------------------------- medidas (metros)
VAO_MEIO = 1.6  # meia largura do vão: cada folha tem 1,6 m
FOLHA_ALTURA = 3.48
FOLHA_ESPESSURA = 0.14
FOLGA_MEIO = 0.003
PILAR = (1.6, 1.98)
VERGA_Z = (3.5, 3.98)
PAREDE_FRENTE_Y = -0.06
FAIXAS_Z = (0.42, 1.74, 3.06)  # centro das três faixas de ferro
FAIXA_ALTURA = 0.11
FAIXA_ESPESSURA = 0.016
ARGOLA_Z = 1.17
ARGOLA_X = 0.42
LENTE_MM = 18.0

# luz
LAMPIAO_POS = (-1.75, -2.7, 3.45)
LAMPIAO_ALVO = (0.2, 0.0, 1.65)
LAMPIAO_W = 900.0
LAMPIAO_COR = (1.0, 0.60, 0.32)
MAO_W = 9.0
FRIA_W = 90.0
FRIA_COR = (0.42, 0.58, 1.0)
MAO_COR = (1.0, 0.62, 0.32)
NEBLINA_DENSIDADE = 0.010


def argumentos():
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    if not args:
        raise SystemExit("uso: cena.py -- <saida> [opções]")
    op = {"saida": args[0], "escala": 100, "amostras": 32, "quadros": None, "passo": 1, "so_grafico": False, "poeira": True}
    i = 1
    while i < len(args):
        a = args[i]
        if a == "--escala":
            op["escala"] = int(args[i + 1])
            i += 1
        elif a == "--amostras":
            op["amostras"] = int(args[i + 1])
            i += 1
        elif a == "--quadros":
            op["quadros"] = [int(x) for x in args[i + 1].split(",")]
            i += 1
        elif a == "--passo":
            op["passo"] = int(args[i + 1])
            i += 1
        elif a == "--so-grafico":
            op["so_grafico"] = True
        elif a == "--sem-poeira":
            op["poeira"] = False
        else:
            raise SystemExit(f"opção desconhecida: {a}")
        i += 1
    return op


def definir(alvo, nome, valor):
    if not hasattr(alvo, nome):
        return False
    try:
        setattr(alvo, nome, valor)
        return True
    except (TypeError, AttributeError, ValueError):
        return False


# ================================================================ nós
class Nos:
    """Atalhos para montar árvore de nós (procura sempre por tipo, nunca por nome)."""

    def __init__(self, arvore):
        self.arvore = arvore

    def no(self, tipo, **props):
        no = self.arvore.nodes.new(tipo)
        for chave, valor in props.items():
            setattr(no, chave, valor)
        return no

    def entrar(self, entrada, valor):
        if isinstance(valor, bpy.types.NodeSocket):
            self.arvore.links.new(valor, entrada)
        elif isinstance(valor, tuple) and len(valor) == 3 and getattr(entrada, "type", "") == "RGBA":
            entrada.default_value = (*valor, 1.0)
        else:
            entrada.default_value = valor

    def mat(self, operacao, a, b=0.0, limitar=False):
        no = self.no("ShaderNodeMath", operation=operacao, use_clamp=limitar)
        self.entrar(no.inputs[0], a)
        self.entrar(no.inputs[1], b)
        return no.outputs[0]

    def suave(self, de, ate, x):
        no = self.no("ShaderNodeMapRange", interpolation_type="SMOOTHSTEP", data_type="FLOAT", clamp=True)
        self.entrar(no.inputs[0], x)
        self.entrar(no.inputs[1], de)
        self.entrar(no.inputs[2], ate)
        no.inputs[3].default_value = 0.0
        no.inputs[4].default_value = 1.0
        return no.outputs[0]

    def faixa(self, x, de, ate, para_de, para_ate):
        no = self.no("ShaderNodeMapRange", data_type="FLOAT", clamp=True)
        self.entrar(no.inputs[0], x)
        no.inputs[1].default_value = de
        no.inputs[2].default_value = ate
        no.inputs[3].default_value = para_de
        no.inputs[4].default_value = para_ate
        return no.outputs[0]

    def cor(self, fator, a, b, tipo="MIX"):
        no = self.no("ShaderNodeMix", data_type="RGBA", blend_type=tipo)
        self.entrar(no.inputs[0], fator)
        sa = next(s for s in no.inputs if s.identifier == "A_Color")
        sb = next(s for s in no.inputs if s.identifier == "B_Color")
        self.entrar(sa, a if not isinstance(a, tuple) else (*a, 1.0))
        self.entrar(sb, b if not isinstance(b, tuple) else (*b, 1.0))
        return next(s for s in no.outputs if s.identifier == "Result_Color")

    def ruido(self, vetor, escala, detalhe=3.0, aspereza=0.6, w=None):
        no = self.no("ShaderNodeTexNoise", noise_dimensions="4D" if w is not None else "3D")
        self.entrar(no.inputs["Vector"], vetor)
        no.inputs["Scale"].default_value = escala
        no.inputs["Detail"].default_value = detalhe
        no.inputs["Roughness"].default_value = aspereza
        if w is not None:
            self.entrar(no.inputs["W"], w)
        return no.outputs["Fac"]

    def separar(self, vetor):
        no = self.no("ShaderNodeSeparateXYZ")
        self.entrar(no.inputs[0], vetor)
        return no.outputs[0], no.outputs[1], no.outputs[2]

    def juntar(self, x, y, z):
        no = self.no("ShaderNodeCombineXYZ")
        for i, v in enumerate((x, y, z)):
            self.entrar(no.inputs[i], v)
        return no.outputs[0]

    def escalar(self, vetor, fator):
        no = self.no("ShaderNodeVectorMath", operation="SCALE")
        self.entrar(no.inputs[0], vetor)
        self.entrar(no.inputs["Scale"], fator)
        return no.outputs["Vector"]

    def somar_vetor(self, a, b):
        no = self.no("ShaderNodeVectorMath", operation="ADD")
        self.entrar(no.inputs[0], a)
        self.entrar(no.inputs[1], b)
        return no.outputs["Vector"]

    def imagem(self, caminho, vetor, cor=True):
        img = bpy.data.images.load(caminho, check_existing=True)
        if not cor:
            try:
                img.colorspace_settings.name = "Non-Color"
            except TypeError:
                img.colorspace_settings.is_data = True
        no = self.no("ShaderNodeTexImage", image=img, interpolation="Cubic" if not cor else "Linear")
        self.entrar(no.inputs["Vector"], vetor)
        return no.outputs["Color"]

    def valor(self, nome, padrao):
        no = self.no("ShaderNodeValue")
        no.name = nome
        no.label = nome
        no.outputs[0].default_value = padrao
        return no


def novo_material(nome):
    mat = bpy.data.materials.new(nome)
    definir(mat, "use_nodes", True)
    arvore = mat.node_tree
    for no in list(arvore.nodes):
        arvore.nodes.remove(no)
    n = Nos(arvore)
    saida = n.no("ShaderNodeOutputMaterial")
    return mat, n, saida


def textura(id_poly, mapa):
    return os.path.join(TEXTURAS, id_poly, f"{id_poly}_{mapa}_2k.jpg")


def base_pbr(n, id_poly, uv, normal_forca=1.0):
    """Cor, aspereza e normal (tangente, OpenGL) de uma textura da Poly Haven."""
    cor = n.imagem(textura(id_poly, "Diffuse"), uv, cor=True)
    aspero = n.imagem(textura(id_poly, "Rough"), uv, cor=False)
    nor_img = n.imagem(textura(id_poly, "nor_gl"), uv, cor=False)
    mapa = n.no("ShaderNodeNormalMap")
    mapa.inputs["Strength"].default_value = normal_forca
    n.entrar(mapa.inputs["Color"], nor_img)
    return cor, aspero, mapa.outputs["Normal"]


def principled(n, saida):
    bsdf = n.no("ShaderNodeBsdfPrincipled")
    n.entrar(saida.inputs["Surface"], bsdf.outputs[0])
    return bsdf


# ---------------------------------------------------------------- materiais
def material_folha(nome, deslocamento_uv, com_trinca):
    """Madeira do portão: medieval_wood (CC0) escurecida, encardida embaixo, ferrugem escorrida das faixas, trinca."""
    mat, n, saida = novo_material(nome)
    bsdf = principled(n, saida)
    coord = n.no("ShaderNodeTexCoord")
    uv = n.no("ShaderNodeUVMap").outputs[0]
    mapeia = n.no("ShaderNodeMapping")
    n.entrar(mapeia.inputs["Vector"], uv)
    mapeia.inputs["Location"].default_value = (*deslocamento_uv, 0.0)
    uv = mapeia.outputs[0]
    cor, aspero, normal = base_pbr(n, "medieval_wood", uv, 1.25)
    altura = n.imagem(textura("medieval_wood", "Displacement"), uv, cor=False)
    obj = coord.outputs["Object"]
    x, y, z = n.separar(obj)

    # tom: mais escuro e menos saturado que a foto (madeira velha de mansão, não de celeiro)
    hsv = n.no("ShaderNodeHueSaturation")
    hsv.inputs["Saturation"].default_value = 0.78
    hsv.inputs["Value"].default_value = 0.62
    n.entrar(hsv.inputs["Color"], cor)
    cor = hsv.outputs[0]
    variacao = n.ruido(obj, 0.9, 2.0, 0.5)
    cor = n.cor(n.faixa(variacao, 0.3, 0.7, 0.0, 0.35), cor, n.cor(1.0, cor, (0.55, 0.47, 0.40), "MULTIPLY"))

    # encardido de baixo: respingo de chão, escuro e um pouco esverdeado nos primeiros 45 cm, irregular
    sujeira_ruido = n.ruido(obj, 6.0, 4.0, 0.65)
    limite = n.mat("ADD", 0.22, n.mat("MULTIPLY", sujeira_ruido, 0.35))
    sujo = n.suave(limite, n.mat("SUBTRACT", limite, 0.30), z)
    cor = n.cor(n.mat("MULTIPLY", sujo, 0.85), cor, n.cor(1.0, cor, (0.20, 0.21, 0.16), "MULTIPLY"))

    # ferrugem que escorreu de cada faixa: listras finas para baixo, mais fortes perto do ferro
    listras = n.ruido(n.juntar(n.mat("MULTIPLY", x, 38.0), n.mat("MULTIPLY", z, 1.6), y), 1.0, 2.0, 0.5)
    listras = n.faixa(listras, 0.52, 0.72, 0.0, 1.0)
    escorrido = None
    for zc in FAIXAS_Z:
        base = zc - FAIXA_ALTURA / 2.0
        perto = n.mat("MULTIPLY", n.suave(base - 0.55, base - 0.02, z), n.suave(base + 0.005, base - 0.01, z))
        escorrido = perto if escorrido is None else n.mat("MAXIMUM", escorrido, perto)
    ferrugem = n.mat("MULTIPLY", n.mat("MULTIPLY", escorrido, listras), 0.75)
    cor = n.cor(ferrugem, cor, n.cor(1.0, cor, (0.62, 0.30, 0.14), "MULTIPLY"))

    relevo = altura
    if com_trinca:
        # trinca vertical numa tábua (x local da folha esquerda), torta, de 0,25 a 1,45 m, com lascas finas
        torto = n.mat("MULTIPLY", n.mat("SUBTRACT", n.ruido(n.juntar(0.0, 0.0, n.mat("MULTIPLY", z, 3.0)), 1.0, 3.0, 0.6), 0.5), 0.05)
        dx = n.mat("ABSOLUTE", n.mat("SUBTRACT", n.mat("ADD", x, torto), -0.71))
        largura = n.mat("MULTIPLY", n.suave(0.25, 0.55, z), n.suave(1.45, 1.05, z))
        largura = n.mat("ADD", n.mat("MULTIPLY", largura, 0.0085), 0.0006)
        trinca = n.suave(largura, n.mat("MULTIPLY", largura, 0.2), dx)
        trinca = n.mat("MULTIPLY", trinca, n.mat("MULTIPLY", n.suave(0.2, 0.3, z), n.suave(1.5, 1.4, z)))
        cor = n.cor(trinca, cor, (0.015, 0.012, 0.010))
        relevo = n.mat("SUBTRACT", altura, n.mat("MULTIPLY", trinca, 0.8))
        aspero = n.cor(trinca, aspero, (1.0, 1.0, 1.0))

    bump = n.no("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.55
    bump.inputs["Distance"].default_value = 0.012
    n.entrar(bump.inputs["Height"], relevo)
    n.entrar(bump.inputs["Normal"], normal)
    n.entrar(bsdf.inputs["Base Color"], cor)
    n.entrar(bsdf.inputs["Roughness"], n.faixa(n.separar(aspero)[0], 0.0, 1.0, 0.62, 0.97))
    n.entrar(bsdf.inputs["Normal"], bump.outputs[0])
    definir(bsdf.inputs["Specular IOR Level"], "default_value", 0.35)
    return mat


def material_madeira_escura(nome):
    """Batentes e verga: dark_wooden_planks (CC0), mais escuro ainda."""
    mat, n, saida = novo_material(nome)
    bsdf = principled(n, saida)
    uv = n.no("ShaderNodeUVMap").outputs[0]
    cor, aspero, normal = base_pbr(n, "dark_wooden_planks", uv, 1.1)
    hsv = n.no("ShaderNodeHueSaturation")
    hsv.inputs["Saturation"].default_value = 0.75
    hsv.inputs["Value"].default_value = 0.55
    n.entrar(hsv.inputs["Color"], cor)
    n.entrar(bsdf.inputs["Base Color"], hsv.outputs[0])
    n.entrar(bsdf.inputs["Roughness"], n.faixa(n.separar(aspero)[0], 0.0, 1.0, 0.6, 0.95))
    n.entrar(bsdf.inputs["Normal"], normal)
    definir(bsdf.inputs["Specular IOR Level"], "default_value", 0.35)
    return mat


def material_ferro(nome):
    """Ferro batido escuro com manchas de ferrugem: rust_coarse_01 (CC0) só onde a máscara deixa."""
    mat, n, saida = novo_material(nome)
    bsdf = principled(n, saida)
    coord = n.no("ShaderNodeTexCoord")
    uv = n.no("ShaderNodeUVMap").outputs[0]
    cor, aspero, normal = base_pbr(n, "rust_coarse_01", uv, 0.9)
    mancha = n.ruido(coord.outputs["Object"], 7.0, 5.0, 0.7)
    mascara = n.faixa(mancha, 0.50, 0.66, 0.0, 1.0)
    ferro = n.cor(1.0, cor, (0.07, 0.065, 0.06), "MULTIPLY")
    ferrugem = n.cor(1.0, cor, (0.55, 0.42, 0.34), "MULTIPLY")
    n.entrar(bsdf.inputs["Base Color"], n.cor(mascara, ferro, ferrugem))
    n.entrar(bsdf.inputs["Metallic"], n.faixa(mascara, 0.0, 1.0, 0.85, 0.15))
    asp = n.faixa(n.separar(aspero)[0], 0.0, 1.0, 0.38, 0.85)
    n.entrar(bsdf.inputs["Roughness"], n.mat("ADD", asp, n.mat("MULTIPLY", mascara, 0.15), limitar=True))
    n.entrar(bsdf.inputs["Normal"], normal)
    return mat


def material_pedra(nome, valor, umido=0.0):
    """medieval_blocks_03 (CC0) escurecida; o chão leva um pouco de umidade (mais liso nas manchas)."""
    mat, n, saida = novo_material(nome)
    bsdf = principled(n, saida)
    coord = n.no("ShaderNodeTexCoord")
    uv = n.no("ShaderNodeUVMap").outputs[0]
    cor, aspero, normal = base_pbr(n, "medieval_blocks_03", uv, 1.2)
    hsv = n.no("ShaderNodeHueSaturation")
    hsv.inputs["Saturation"].default_value = 0.6
    hsv.inputs["Value"].default_value = valor
    n.entrar(hsv.inputs["Color"], cor)
    asp = n.faixa(n.separar(aspero)[0], 0.0, 1.0, 0.7, 1.0)
    cor_final = hsv.outputs[0]
    if umido > 0.0:
        manchas = n.faixa(n.ruido(coord.outputs["Object"], 0.7, 3.0, 0.6), 0.5, 0.65, 0.0, umido)
        cor_final = n.cor(manchas, cor_final, n.cor(1.0, cor_final, (0.55, 0.55, 0.55), "MULTIPLY"))
        asp = n.mat("SUBTRACT", asp, n.mat("MULTIPLY", manchas, 0.45))
    n.entrar(bsdf.inputs["Base Color"], cor_final)
    n.entrar(bsdf.inputs["Roughness"], asp)
    n.entrar(bsdf.inputs["Normal"], normal)
    return mat


def material_poeira(nome):
    mat, n, saida = novo_material(nome)
    bsdf = principled(n, saida)
    n.entrar(bsdf.inputs["Base Color"], (0.42, 0.38, 0.33))
    n.entrar(bsdf.inputs["Roughness"], 1.0)
    definir(bsdf.inputs["Specular IOR Level"], "default_value", 0.1)
    return mat


def material_neblina(nome, densidade):
    mat, n, saida = novo_material(nome)
    vol = n.no("ShaderNodeVolumePrincipled")
    vol.inputs["Color"].default_value = (0.86, 0.80, 0.74, 1.0)
    vol.inputs["Density"].default_value = densidade
    vol.inputs["Anisotropy"].default_value = 0.35
    n.entrar(saida.inputs["Volume"], vol.outputs[0])
    return mat


def material_nuvem_poeira(nome):
    """Nuvem de pó que solta da verga: densidade = p_poeira x ruído que desce (p_queda) x mais denso em cima."""
    mat, n, saida = novo_material(nome)
    coord = n.no("ShaderNodeTexCoord")
    p_poeira = n.valor("p_poeira", 0.0)
    p_queda = n.valor("p_queda", 0.0)
    obj = coord.outputs["Object"]
    x, y, z = n.separar(obj)
    desce = n.somar_vetor(obj, n.juntar(0.0, 0.0, p_queda.outputs[0]))
    ruido = n.ruido(n.juntar(n.mat("MULTIPLY", x, 1.0), y, n.mat("MULTIPLY", n.separar(desce)[2], 0.55)), 2.6, 4.0, 0.62, w=p_queda.outputs[0])
    tufos = n.faixa(ruido, 0.45, 0.75, 0.0, 1.0)
    alto = n.faixa(z, 0.3, 3.5, 0.25, 1.0)
    densidade = n.mat("MULTIPLY", n.mat("MULTIPLY", tufos, alto), n.mat("MULTIPLY", p_poeira.outputs[0], 0.9))
    vol = n.no("ShaderNodeVolumePrincipled")
    vol.inputs["Color"].default_value = (0.70, 0.62, 0.52, 1.0)
    vol.inputs["Anisotropy"].default_value = 0.45
    n.entrar(vol.inputs["Density"], densidade)
    n.entrar(saida.inputs["Volume"], vol.outputs[0])
    return mat


# ================================================================ malhas
def colecao_principal():
    return bpy.context.scene.collection


def objeto_de_bmesh(nome, bm, material=None):
    malha = bpy.data.meshes.new(nome)
    bm.to_mesh(malha)
    bm.free()
    obj = bpy.data.objects.new(nome, malha)
    colecao_principal().objects.link(obj)
    if material is not None:
        obj.data.materials.append(material)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def uv_caixa(bm, escala, deslocamento=(0.0, 0.0), girar=False):
    """UV por projeção de caixa (eixo dominante da normal), em metros / escala."""
    camada = bm.loops.layers.uv.verify()
    for face in bm.faces:
        nrm = face.normal
        eixo = max(range(3), key=lambda i: abs(nrm[i]))
        for laco in face.loops:
            co = laco.vert.co
            if eixo == 0:
                u, v = co.y, co.z
            elif eixo == 1:
                u, v = co.x, co.z
            else:
                u, v = co.x, co.y
            if girar:
                u, v = v, u
            laco[camada].uv = (u / escala + deslocamento[0], v / escala + deslocamento[1])


def caixa(nome, minimo, maximo, material, escala_uv=2.0, chanfro=0.006, deslocamento_uv=(0.0, 0.0), girar_uv=False):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    tam = Vector(maximo) - Vector(minimo)
    centro = (Vector(maximo) + Vector(minimo)) / 2.0
    for v in bm.verts:
        v.co = Vector((v.co.x * tam.x, v.co.y * tam.y, v.co.z * tam.z)) + centro
    if chanfro > 0.0:
        bmesh.ops.bevel(bm, geom=bm.edges[:], offset=chanfro, segments=2, profile=0.5, affect="EDGES", clamp_overlap=True)
    bm.normal_update()
    uv_caixa(bm, escala_uv, deslocamento_uv, girar_uv)
    return objeto_de_bmesh(nome, bm, material)


def cilindro(nome, centro, raio, altura, eixo, material, segmentos=20, chanfro=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segmentos, radius1=raio, radius2=raio, depth=altura)
    if chanfro > 0.0:
        aresta = [e for e in bm.edges if not e.is_manifold or len(e.link_faces) == 2 and abs(e.link_faces[0].normal.dot(e.link_faces[1].normal)) < 0.3]
        bmesh.ops.bevel(bm, geom=aresta, offset=chanfro, segments=2, profile=0.5, affect="EDGES", clamp_overlap=True)
    rot = {"x": Matrix.Rotation(math.pi / 2, 4, "Y"), "y": Matrix.Rotation(math.pi / 2, 4, "X"), "z": Matrix.Identity(4)}[eixo]
    bmesh.ops.transform(bm, matrix=rot, verts=bm.verts)
    bmesh.ops.translate(bm, vec=Vector(centro), verts=bm.verts)
    bm.normal_update()
    uv_caixa(bm, 0.5)
    return objeto_de_bmesh(nome, bm, material)


def rebite_malha(material):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=0.018)
    for v in bm.verts:
        v.co.y *= 0.5
    bm.normal_update()
    uv_caixa(bm, 0.3)
    malha = bpy.data.meshes.new("rebite")
    bm.to_mesh(malha)
    bm.free()
    malha.materials.append(material)
    for p in malha.polygons:
        p.use_smooth = True
    return malha


def toro(nome, raio_maior, raio_menor, material, seg_maior=40, seg_menor=12):
    """Toro no plano XZ (argola pendurada numa porta virada para -Y), centro na origem."""
    bm = bmesh.new()
    aneis = []
    for i in range(seg_maior):
        a = 2.0 * math.pi * i / seg_maior
        anel = []
        for j in range(seg_menor):
            b = 2.0 * math.pi * j / seg_menor
            r = raio_maior + raio_menor * math.cos(b)
            anel.append(bm.verts.new((r * math.cos(a), raio_menor * math.sin(b), r * math.sin(a))))
        aneis.append(anel)
    for i in range(seg_maior):
        for j in range(seg_menor):
            a, b = aneis[i], aneis[(i + 1) % seg_maior]
            bm.faces.new((a[j], b[j], b[(j + 1) % seg_menor], a[(j + 1) % seg_menor]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.normal_update()
    uv_caixa(bm, 0.3)
    return objeto_de_bmesh(nome, bm, material)


def pivo(nome, posicao, pai=None):
    vazio = bpy.data.objects.new(nome, None)
    vazio.location = posicao
    colecao_principal().objects.link(vazio)
    if pai is not None:
        prender(vazio, pai)
    return vazio


def prender(filho, pai):
    """Parenta mantendo a posição no mundo (pais ainda na pose de repouso)."""
    bpy.context.view_layer.update()
    filho.parent = pai
    filho.matrix_parent_inverse = pai.matrix_world.inverted()


# ================================================================ montagem
def montar_folha(nome, sinal, mat_madeira, mat_ferro, malha_rebite):
    """Uma folha: tábua maciça com faixas de ferro, rebites, argola. sinal -1 = esquerda (x < 0)."""
    hinge_x = sinal * VAO_MEIO
    piv = pivo(f"pivo_{nome}", (hinge_x, FOLHA_ESPESSURA, 0.0))
    x_ext, x_int = sinal * VAO_MEIO, sinal * FOLGA_MEIO
    x0, x1 = min(x_ext, x_int), max(x_ext, x_int)
    tabua = caixa(f"folha_{nome}", (x0, 0.0, 0.015), (x1, FOLHA_ESPESSURA, 0.015 + FOLHA_ALTURA), mat_madeira, 2.6, 0.010)
    prender(tabua, piv)
    pecas = [tabua]
    # mata-junta: régua de madeira na folha direita cobrindo a fresta do meio
    if sinal > 0:
        regua = caixa("mata_junta", (-0.06, -0.035, 0.03), (0.07, 0.0, 0.015 + FOLHA_ALTURA - 0.02), mat_madeira, 2.0, 0.008, (0.31, 0.07))
        prender(regua, piv)
        pecas.append(regua)
    for k, zc in enumerate(FAIXAS_Z):
        z0, z1 = zc - FAIXA_ALTURA / 2.0, zc + FAIXA_ALTURA / 2.0
        xa = sinal * (VAO_MEIO + 0.02)
        xb = sinal * 0.24
        faixa = caixa(f"faixa_{nome}_{k}", (min(xa, xb), -FAIXA_ESPESSURA, z0), (max(xa, xb), 0.0, z1), mat_ferro, 0.6, 0.004)
        prender(faixa, piv)
        ponta = cilindro(f"ponta_{nome}_{k}", (xb, -FAIXA_ESPESSURA / 2.0, zc), 0.075, FAIXA_ESPESSURA, "y", mat_ferro, 28, 0.003)
        prender(ponta, piv)
        pecas += [faixa, ponta]
        passos = 7
        for i in range(passos + 1):
            x = xa + (xb - xa) * (0.04 + 0.92 * i / passos)
            for dz in (-0.028, 0.028) if i % 2 == 0 else (0.0,):
                rb = bpy.data.objects.new(f"rebite_{nome}_{k}_{i}_{dz}", malha_rebite)
                rb.location = (x, -FAIXA_ESPESSURA, zc + dz)
                colecao_principal().objects.link(rb)
                prender(rb, piv)
        rb = bpy.data.objects.new(f"rebite_ponta_{nome}_{k}", malha_rebite)
        rb.location = (xb, -FAIXA_ESPESSURA, zc)
        rb.scale = (1.4, 1.4, 1.4)
        colecao_principal().objects.link(rb)
        prender(rb, piv)
    # argola: espelho quadrado, olhal e o aro pendurado num pivô que balança em X
    xc = sinal * ARGOLA_X
    espelho = caixa(f"espelho_{nome}", (xc - 0.075, -0.02, ARGOLA_Z - 0.09), (xc + 0.075, 0.0, ARGOLA_Z + 0.07), mat_ferro, 0.4, 0.004)
    prender(espelho, piv)
    olhal = cilindro(f"olhal_{nome}", (xc, -0.04, ARGOLA_Z), 0.022, 0.045, "y", mat_ferro, 16, 0.003)
    prender(olhal, piv)
    piv_argola = pivo(f"pivo_argola_{nome}", (xc, -0.052, ARGOLA_Z), piv)
    aro = toro(f"argola_{nome}", 0.105, 0.015, mat_ferro)
    aro.location = (xc, -0.052, ARGOLA_Z - 0.105)
    prender(aro, piv_argola)
    for dz in (0.045, -0.06):
        for dx in (-0.05, 0.05):
            rb = bpy.data.objects.new(f"rebite_espelho_{nome}_{dx}_{dz}", malha_rebite)
            rb.location = (xc + dx, -0.02, ARGOLA_Z + dz)
            colecao_principal().objects.link(rb)
            prender(rb, piv)
    return piv, piv_argola, pecas


def montar_moldura(mat_moldura, mat_pedra, mat_chao, mat_ferro):
    xi, xe = PILAR
    for s, nome in ((-1, "esq"), (1, "dir")):
        caixa(f"pilar_{nome}", (min(s * xi, s * xe), -0.16, 0.0), (max(s * xi, s * xe), 0.34, VERGA_Z[0] + 0.05), mat_moldura, 2.2, 0.012, (0.17 * s, 0.0), True)
        # gonzos: pinos de ferro no batente, na altura das faixas
        for k, zc in enumerate(FAIXAS_Z):
            cilindro(f"gonzo_{nome}_{k}", (s * (xi + 0.02), FOLHA_ESPESSURA + 0.03, zc), 0.032, 0.17, "z", mat_ferro, 18, 0.004)
    caixa("verga", (-2.18, -0.20, VERGA_Z[0]), (2.18, 0.36, VERGA_Z[1]), mat_moldura, 2.2, 0.014, (0.4, 0.12))
    # parede de pedra em volta (três blocos, sem booleana) e a soleira
    caixa("parede_esq", (-8.0, PAREDE_FRENTE_Y, 0.0), (-xe + 0.001, 0.9, 7.5), mat_pedra, 2.4, 0.0)
    caixa("parede_dir", (xe - 0.001, PAREDE_FRENTE_Y, 0.0), (8.0, 0.9, 7.5), mat_pedra, 2.4, 0.0, (0.37, 0.0))
    caixa("parede_cima", (-xe, PAREDE_FRENTE_Y, VERGA_Z[1] - 0.001), (xe, 0.9, 7.5), mat_pedra, 2.4, 0.0, (0.11, 0.21))
    caixa("soleira", (-xe, -0.32, -0.06), (xe, 0.42, 0.014), mat_pedra, 1.6, 0.012, (0.23, 0.4))
    caixa("chao", (-9.0, -9.0, -0.3), (9.0, 16.0, 0.0), mat_chao, 2.4, 0.0)
    # corredor do outro lado: paredes que só a luz da mão revela
    caixa("corredor_esq", (-3.6, 0.9, 0.0), (-2.7, 16.0, 5.0), mat_pedra, 2.4, 0.0, (0.5, 0.3))
    caixa("corredor_dir", (2.7, 0.9, 0.0), (3.6, 16.0, 5.0), mat_pedra, 2.4, 0.0, (0.2, 0.6))
    caixa("corredor_teto", (-3.6, 0.9, 5.0), (3.6, 16.0, 5.4), mat_pedra, 2.4, 0.0)


def montar_volumes():
    neblina = caixa("neblina", (-8.0, -7.0, 0.0), (8.0, 15.0, 6.5), material_neblina("neblina", NEBLINA_DENSIDADE), 1.0, 0.0)
    neblina.visible_shadow = False
    nuvem = caixa("nuvem_poeira", (-1.95, -0.75, 0.25), (1.95, 0.12, 3.5), material_nuvem_poeira("nuvem_poeira"), 1.0, 0.0)
    nuvem.visible_shadow = False
    return nuvem


def montar_luzes(camera):
    # lampião pendurado fora do quadro, no alto à esquerda: luz rasante que revela veio, prego e ferro
    dados = bpy.data.lights.new("lampiao", "SPOT")
    dados.energy = LAMPIAO_W
    dados.color = LAMPIAO_COR
    dados.shadow_soft_size = 0.05
    dados.spot_size = math.radians(96.0)
    dados.spot_blend = 1.0  # o cone inteiro é degradê: sem anel de holofote
    definir(dados, "volume_factor", 1.0)
    lampiao = bpy.data.objects.new("lampiao", dados)
    lampiao.location = LAMPIAO_POS
    colecao_principal().objects.link(lampiao)
    lampiao.rotation_euler = (Vector(LAMPIAO_ALVO) - Vector(LAMPIAO_POS)).to_track_quat("-Z", "Y").to_euler()

    # luz fria e fraca do alto à direita: só para a sombra não ser do mesmo marrom da luz
    fria_dados = bpy.data.lights.new("fria", "AREA")
    fria_dados.energy = FRIA_W
    fria_dados.color = FRIA_COR
    fria_dados.size = 2.5
    definir(fria_dados, "volume_factor", 0.4)
    fria = bpy.data.objects.new("fria", fria_dados)
    fria.location = (3.0, -4.5, 5.0)
    colecao_principal().objects.link(fria)
    fria.rotation_euler = (Vector((0.0, 0.0, 1.6)) - fria.location).to_track_quat("-Z", "Y").to_euler()

    mao_dados = bpy.data.lights.new("lanterna_mao", "POINT")
    mao_dados.energy = MAO_W
    mao_dados.color = MAO_COR
    mao_dados.shadow_soft_size = 0.04
    definir(mao_dados, "volume_factor", 0.6)
    mao = bpy.data.objects.new("lanterna_mao", mao_dados)
    mao.location = (0.30, -0.34, 0.05)  # no espaço da câmera: à direita, abaixo
    colecao_principal().objects.link(mao)
    mao.parent = camera
    return lampiao, mao


def montar_camera():
    dados = bpy.data.cameras.new("olho")
    dados.lens = LENTE_MM
    dados.sensor_width = 36.0
    dados.clip_start = 0.05
    dados.clip_end = 60.0
    cam = bpy.data.objects.new("olho", dados)
    colecao_principal().objects.link(cam)
    bpy.context.scene.camera = cam
    return cam


# ================================================================ poeira
def montar_poeira(mat_poeira):
    """Grãos e lascas com posição por quadro (física simples: queda com arrasto e deriva), semente fixa."""
    rng = R.rng(SEMENTE)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0)
    malha_grao = bpy.data.meshes.new("grao")
    bm.to_mesh(malha_grao)
    bm.free()
    malha_grao.materials.append(mat_poeira)
    graos = []
    for t0, quantidade, xmin, xmax, origem in R.eventos_de_poeira():
        for _ in range(quantidade):
            lasca = rng.random() < 0.05
            raio = rng.uniform(0.007, 0.013) if lasca else rng.uniform(0.003, 0.007)
            if origem == "verga":
                # com as folhas fechadas, só o pó da frente aparece (o resto cairia dentro da madeira)
                y_max = -0.005 if t0 < R.ABRE_S + 1.0 else 0.34
                p0 = Vector((rng.uniform(xmin, xmax), rng.uniform(-0.2, y_max), VERGA_Z[0] - 0.01))
            else:
                # do topo da folha, onde ela raspa na verga: ponto a d metros da dobradiça, na pose do instante
                folha = origem.split(":")[1]
                s = -1.0 if folha == "esq" else 1.0
                ang = math.radians(R.angulo(folha, t0))
                d = rng.uniform(0.2, 1.5)
                p0 = Vector((s * VAO_MEIO - s * d * math.cos(ang), FOLHA_ESPESSURA + d * math.sin(ang), VERGA_Z[0] - 0.02))
            atraso = rng.uniform(0.0, 0.35 if not lasca else 0.12)
            terminal = (2.6 if lasca else rng.uniform(0.35, 1.1)) * rng.uniform(0.85, 1.15)
            deriva = Vector((rng.uniform(-0.12, 0.12), rng.uniform(-0.22, 0.05), 0.0))
            fase = rng.uniform(0.0, 6.28)
            escala = Vector((rng.uniform(0.6, 1.4), rng.uniform(0.6, 1.4), rng.uniform(0.6, 1.4))) * raio
            graos.append((t0 + atraso, p0, terminal, deriva, fase, escala, lasca, rng.uniform(-9, 9)))
    objetos = []
    for k, (te, p0, terminal, deriva, fase, escala, lasca, giro) in enumerate(graos):
        obj = bpy.data.objects.new(f"grao_{k}", malha_grao)
        colecao_principal().objects.link(obj)
        obj.visible_shadow = False
        quadros = []
        vida_max = 2.2 if not lasca else 1.4
        for f in range(R.QUADROS):
            t = f / R.FPS
            x = t - te
            if x < -1.0 / R.FPS or x > vida_max:
                continue
            if not lasca and f % 2 == 1 and x > 1.0 / R.FPS and x + 1.0 / R.FPS <= vida_max:
                continue  # grão fino: chave a cada 2 quadros (o LINEAR preenche)
            if x < 0.0:
                pos, esc = p0, Vector((0.0, 0.0, 0.0))
            else:
                tau = 0.25 if not lasca else 0.32
                queda = terminal * (x - tau * (1.0 - math.exp(-x / tau)))
                vagueia = Vector((0.04 * math.sin(2.1 * x + fase), 0.03 * math.sin(1.7 * x + fase * 1.3), 0.0))
                pos = p0 + deriva * min(x, 1.2) + vagueia + Vector((0.0, 0.0, -queda))
                if pos.z < 0.005:
                    pos = Vector((pos.x, pos.y, 0.005))
                vida = 1.0 if lasca else max(0.0, 1.0 - max(0.0, x - 1.2) / 1.0)
                esc = escala * vida if pos.z > 0.006 or lasca else escala * vida * 0.5
            quadros.append((f, pos, esc, giro * max(0.0, x)))
        if not quadros:
            continue
        # antes e depois da vida, escala zero (não aparece nem projeta)
        obj.scale = (0.0, 0.0, 0.0)
        obj.keyframe_insert("scale", frame=max(0, quadros[0][0] - 1))
        for f, pos, esc, rot in quadros:
            obj.location = pos
            obj.scale = esc
            obj.keyframe_insert("location", frame=f)
            obj.keyframe_insert("scale", frame=f)
            if lasca:
                obj.rotation_euler = (rot, rot * 0.7, rot * 0.3)
                obj.keyframe_insert("rotation_euler", frame=f)
        ultimo = quadros[-1][0]
        if ultimo < R.QUADROS - 1:
            obj.scale = (0.0, 0.0, 0.0)
            obj.keyframe_insert("scale", frame=ultimo + 1)
        objetos.append(obj)
    return objetos, len(graos)


def curva_poeira(t):
    """Força da nuvem de pó: cada evento sobe em 80 ms e cai em 0,9 s."""
    total = 0.0
    for t0, quantidade, _, _, _ in R.eventos_de_poeira():
        if t >= t0:
            x = t - t0
            total += (quantidade / 110.0) * (1.0 - math.exp(-x / 0.08)) * math.exp(-x / 0.9)
    return min(1.6, total)


# ================================================================ animação
def animar(piv_esq, piv_dir, argola_esq, argola_dir, cam, lampiao, mao, nuvem):
    no_poeira = next(n for n in nuvem.data.materials[0].node_tree.nodes if n.type == "VALUE" and n.label == "p_poeira")
    no_queda = next(n for n in nuvem.data.materials[0].node_tree.nodes if n.type == "VALUE" and n.label == "p_queda")
    queda = 0.0
    for f in range(R.QUADROS):
        t = f / R.FPS
        a_esq = math.radians(R.angulo("esq", t))
        a_dir = math.radians(R.angulo("dir", t))
        dz = R.assentamento_z(t)
        piv_esq.rotation_euler = (0.0, 0.0, a_esq)
        piv_dir.rotation_euler = (0.0, 0.0, -a_dir)
        piv_esq.location.z = dz
        piv_dir.location.z = dz
        for p in (piv_esq, piv_dir):
            p.keyframe_insert("rotation_euler", frame=f)
            p.keyframe_insert("location", frame=f)
        argola_esq.rotation_euler = (math.radians(R.argola("esq", t)), 0.0, 0.0)
        argola_dir.rotation_euler = (math.radians(R.argola("dir", t)), 0.0, 0.0)
        argola_esq.keyframe_insert("rotation_euler", frame=f)
        argola_dir.keyframe_insert("rotation_euler", frame=f)
        c = R.camera(t)
        cam.location = c["pos"]
        cam.rotation_euler = (math.radians(90.0 + c["inclina"]), math.radians(c["rola"]), math.radians(c["guinada"]))
        cam.keyframe_insert("location", frame=f)
        cam.keyframe_insert("rotation_euler", frame=f)
        fator = R.lampiao(t)
        lampiao.data.energy = LAMPIAO_W * fator
        lampiao.data.keyframe_insert("energy", frame=f)
        mao.data.energy = MAO_W * R.lampiao(t + 0.37)
        mao.data.keyframe_insert("energy", frame=f)
        forca = curva_poeira(t)
        queda += (0.25 + 0.9 * min(1.0, forca)) / R.FPS
        no_poeira.outputs[0].default_value = forca
        no_queda.outputs[0].default_value = queda
        no_poeira.outputs[0].keyframe_insert("default_value", frame=f)
        no_queda.outputs[0].keyframe_insert("default_value", frame=f)
    interpolacao_linear()


def interpolacao_linear():
    """Tudo já vem amostrado por quadro: LINEAR evita o Bézier inventar curva entre as amostras."""
    for acao in bpy.data.actions:
        curvas = []
        if hasattr(acao, "fcurves"):
            try:
                curvas = list(acao.fcurves)
            except (AttributeError, RuntimeError):
                curvas = []
        if not curvas and hasattr(acao, "layers"):
            for camada in acao.layers:
                for faixa in camada.strips:
                    for saco in getattr(faixa, "channelbags", []):
                        curvas += list(saco.fcurves)
        for fc in curvas:
            for kp in fc.keyframe_points:
                kp.interpolation = "LINEAR"


# ================================================================ render
def configurar_render(cena, escala, amostras):
    try:
        cena.render.engine = "BLENDER_EEVEE"
    except TypeError:
        cena.render.engine = "BLENDER_EEVEE_NEXT"
    cena.render.resolution_x = LARGURA
    cena.render.resolution_y = ALTURA
    cena.render.resolution_percentage = escala
    cena.render.fps = R.FPS
    cena.frame_start = 0
    cena.frame_end = R.QUADROS - 1
    cena.render.image_settings.file_format = "PNG"
    cena.render.image_settings.color_mode = "RGB"
    cena.render.image_settings.color_depth = "16"
    cena.render.film_transparent = False
    ev = cena.eevee
    ev.taa_render_samples = amostras
    definir(ev, "use_shadows", True)
    definir(ev, "shadow_ray_count", 2)
    definir(ev, "shadow_step_count", 8)
    definir(ev, "use_raytracing", True)
    definir(ev, "ray_tracing_method", "SCREEN")
    definir(ev, "use_fast_gi", True)
    definir(ev, "fast_gi_method", "GLOBAL_ILLUMINATION")
    definir(ev, "fast_gi_distance", 1.5)
    definir(ev, "volumetric_tile_size", "2" if escala >= 100 else "4")
    definir(ev, "volumetric_samples", 64)
    definir(ev, "volumetric_start", 0.1)
    definir(ev, "volumetric_end", 22.0)
    definir(ev, "use_volumetric_shadows", True)
    definir(ev, "volumetric_shadow_samples", 16)
    definir(cena.render, "use_motion_blur", True)
    definir(cena.render, "motion_blur_shutter", 0.5)
    definir(ev, "motion_blur_steps", 1)
    vs = cena.view_settings
    for transformacao in ("AgX", "Filmic", "Standard"):
        if definir(vs, "view_transform", transformacao):
            break
    for olhar in ("AgX - Medium High Contrast", "Medium High Contrast", "None"):
        if definir(vs, "look", olhar):
            break
    vs.exposure = 0.0
    vs.gamma = 1.0
    print(f"render: {cena.render.engine} {vs.view_transform} / {vs.look}, {amostras} amostras, {escala}%")


def mundo_preto(cena):
    mundo = bpy.data.worlds.new("preto")
    definir(mundo, "use_nodes", True)
    fundo = next((n for n in mundo.node_tree.nodes if n.type == "BACKGROUND"), None)
    if fundo is None:
        fundo = mundo.node_tree.nodes.new("ShaderNodeBackground")
        saida = next((n for n in mundo.node_tree.nodes if n.type == "OUTPUT_WORLD"), None) or mundo.node_tree.nodes.new("ShaderNodeOutputWorld")
        mundo.node_tree.links.new(fundo.outputs[0], saida.inputs["Surface"])
    fundo.inputs["Color"].default_value = (0.0, 0.0, 0.0, 1.0)
    fundo.inputs["Strength"].default_value = 0.0
    cena.world = mundo


# ================================================================ gráfico
def gravar_grafico(saida, n_graos):
    quadros = []
    for f in range(R.QUADROS):
        t = f / R.FPS
        c = R.camera(t)
        quadros.append(
            {
                "q": f,
                "t": round(t, 4),
                "angulo_esq": round(R.angulo("esq", t), 3),
                "angulo_dir": round(R.angulo("dir", t), 3),
                "vel_esq": round(R.velocidade("esq", t), 2),
                "vel_dir": round(R.velocidade("dir", t), 2),
                "argola_esq": round(R.argola("esq", t), 3),
                "argola_dir": round(R.argola("dir", t), 3),
                "cam_y": round(c["pos"][1], 4),
                "cam_z": round(c["pos"][2], 4),
                "cam_inclina": round(c["inclina"], 3),
                "cam_rola": round(c["rola"], 3),
                "poeira": round(curva_poeira(t), 4),
                "lampiao": round(R.lampiao(t), 4),
                "fade": round(R.fade(t), 4),
            }
        )
    fino = []
    passo = 0.01
    for i in range(int(R.DURACAO_S / passo) + 1):
        t = i * passo
        fino.append([round(t, 3), round(R.velocidade("esq", t), 2), round(R.velocidade("dir", t), 2)])
    dados = {
        "fps": R.FPS,
        "duracao_s": R.DURACAO_S,
        "quadros": R.QUADROS,
        "graos_de_poeira": n_graos,
        "eventos": R.eventos(),
        "curvas": quadros,
        "velocidade_fina": {"passo_s": passo, "colunas": ["t", "vel_esq", "vel_dir"], "linhas": fino},
    }
    with open(os.path.join(saida, "grafico.json"), "w", encoding="utf-8") as arq:
        json.dump(dados, arq, ensure_ascii=False, indent=1)


def principal():
    op = argumentos()
    saida = op["saida"]
    os.makedirs(os.path.join(saida, "cru"), exist_ok=True)
    inicio = time.time()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.edit.keyframe_new_interpolation_type = "LINEAR"
    cena = bpy.context.scene
    mundo_preto(cena)
    configurar_render(cena, op["escala"], op["amostras"])

    mat_ferro = material_ferro("ferro")
    mat_esq = material_folha("madeira_esq", (0.0, 0.0), True)
    mat_dir = material_folha("madeira_dir", (0.43, 0.19), False)
    malha_rebite = rebite_malha(mat_ferro)
    piv_esq, argola_esq, _ = montar_folha("esq", -1.0, mat_esq, mat_ferro, malha_rebite)
    piv_dir, argola_dir, _ = montar_folha("dir", 1.0, mat_dir, mat_ferro, malha_rebite)
    montar_moldura(material_madeira_escura("moldura"), material_pedra("pedra", 0.28), material_pedra("chao", 0.30, 0.6), mat_ferro)
    nuvem = montar_volumes()
    cam = montar_camera()
    lampiao, mao = montar_luzes(cam)
    # a luz da mão não acende a poeira (de perto os grãos viravam pipoca): ligação de luz só com o cenário
    cenario = bpy.data.collections.new("luz_da_mao")
    for obj in list(cena.objects):
        if obj.type == "MESH":
            cenario.objects.link(obj)
    mao.light_linking.receiver_collection = cenario
    n_graos = 0
    if op["poeira"]:
        _, n_graos = montar_poeira(material_poeira("poeira"))
    animar(piv_esq, piv_dir, argola_esq, argola_dir, cam, lampiao, mao, nuvem)
    gravar_grafico(saida, n_graos)
    print(f"cena montada em {time.time() - inicio:.1f} s ({n_graos} grãos)")
    try:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(saida, "portao.blend"), compress=True)
    except RuntimeError as erro:
        print(f"aviso: não salvei o .blend ({erro})")
    if op["so_grafico"]:
        return
    quadros = op["quadros"] if op["quadros"] is not None else list(range(0, R.QUADROS, op["passo"]))
    tempos = []
    for f in quadros:
        t0 = time.time()
        cena.frame_set(f)
        cena.render.filepath = os.path.join(saida, "cru", f"q_{f:04d}.png")
        bpy.ops.render.render(write_still=True)
        tempos.append(time.time() - t0)
        print(f"quadro {f} ({f / R.FPS:.2f} s) em {tempos[-1]:.1f} s", flush=True)
    if tempos:
        print(f"{len(tempos)} quadros, média {sum(tempos) / len(tempos):.2f} s, total {sum(tempos):.0f} s")


principal()
