"""
Judge v2 em Blender: o avatar do mestre, um juiz em armadura de placas montado num grifo marrom.

Este modulo so monta a cena (malhas, materiais, luz, cameras) e faz a pose.
Quem renderiza sao os scripts ao lado:
  render_heroi.py   o render grande
  render_folha.py   os 160 quadros da folha (8 direcoes x 20 quadros)
  montar_folhas.py  junta os quadros nas folhas de 64 e 48 px por casa (Python do sistema + Pillow)

Unidade: 1 = uma casa do mapa. Chao em z = 0, centro do token na origem.
O modelo olha para -Y (para a camera da folha). A direita do cavaleiro fica em -X.
Tudo e gerado por codigo: nada foi copiado de pintura nem tirado de jogo.
"""
import math
import random

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

# ---------------- medidas da folha (as mesmas da v1) ----------------
QUADRO_L = 3.0  # largura do quadro, em casas
QUADRO_A = 3.75  # altura do quadro
QUADRO_BASE = 0.62  # do pe do quadro ate o centro da base
ELEVACAO = math.radians(30.0)  # camera 3/4 da mesa
N_DIR = 8
N_RESPIRO = 12
N_CARTAO = 8

# ---------------- pose de descanso e de cartao erguido ----------------
OMBRO_D = Vector((-0.255, 0.125, 1.975))  # ombro direito do cavaleiro (lado -X)
ESCALA_CAVALEIRO = 1.22  # o cavaleiro em proporcao heroica sobre o grifo
POSE_DESCANSO = {'flexao': 0.30, 'abducao': 0.30, 'cotovelo': 1.05}
POSE_ERGUIDO = {'flexao': 2.72, 'abducao': 0.46, 'cotovelo': 0.2}

_COL = None
_MAT = {}


# =====================================================================
# utilidades de malha
# =====================================================================
def _colecao():
    return _COL


def cr(linhas, n):
    """Catmull-Rom sobre linhas de floats (posicao + raios), devolve n amostras."""
    P = np.asarray(linhas, dtype=float)
    if len(P) == 2:
        P = np.vstack([P[0], (P[0] + P[1]) / 2, P[1]])
    K = len(P)
    saida = []
    for s in np.linspace(0, K - 1, n):
        i = min(int(math.floor(s)), K - 2)
        t = s - i
        p0 = P[max(i - 1, 0)]
        p1 = P[i]
        p2 = P[i + 1]
        p3 = P[min(i + 2, K - 1)]
        saida.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    return np.array(saida)


def tubo(linhas, n_ao_longo, n_anel=16, lado=(1.0, 0.0, 0.0), tampas=(True, True), ponta=(0.0, 0.0), achatar=None):
    """Loft ao longo de um caminho. linhas: [x, y, z, rx, r_dorso, r_ventre].
    O anel tem rx no lado e r_dorso/r_ventre na normal (cima/baixo do caminho)."""
    R = cr(linhas, n_ao_longo)
    C = R[:, :3]
    T = np.gradient(C, axis=0)
    T /= np.linalg.norm(T, axis=1)[:, None]
    b = np.array(lado, dtype=float)
    B = np.zeros_like(C)
    Nn = np.zeros_like(C)
    for i in range(len(C)):
        b = b - np.dot(b, T[i]) * T[i]
        nb = np.linalg.norm(b)
        if nb < 1e-8:
            b = np.cross(T[i], [0.0, 0.0, 1.0])
            nb = np.linalg.norm(b)
        b = b / nb
        B[i] = b
        Nn[i] = np.cross(T[i], b)
    comp = np.concatenate([[0.0], np.cumsum(np.linalg.norm(np.diff(C, axis=0), axis=1))])
    comp = comp / max(comp[-1], 1e-9)
    verts = []
    uvs = []
    for i in range(len(C)):
        rx, rt, rb = R[i, 3], R[i, 4], R[i, 5]
        for j in range(n_anel):
            th = 2 * math.pi * j / n_anel
            c = math.cos(th)
            s = math.sin(th)
            rn = rt if s >= 0 else rb
            p = C[i] + rx * c * B[i] + rn * s * Nn[i]
            if achatar is not None:
                p = achatar(p, comp[i], th)
            verts.append(p)
            uvs.append((j / n_anel, comp[i]))
    faces = []
    for i in range(len(C) - 1):
        for j in range(n_anel):
            a = i * n_anel + j
            b2 = i * n_anel + (j + 1) % n_anel
            faces.append((a, b2, b2 + n_anel, a + n_anel))
    if tampas[0]:
        verts.append(C[0] - T[0] * ponta[0])
        uvs.append((0.0, 0.0))
        k = len(verts) - 1
        for j in range(n_anel):
            faces.append((k, (j + 1) % n_anel, j))
    if tampas[1]:
        verts.append(C[-1] + T[-1] * ponta[1])
        uvs.append((0.0, 1.0))
        k = len(verts) - 1
        base = (len(C) - 1) * n_anel
        for j in range(n_anel):
            faces.append((k, base + j, base + (j + 1) % n_anel))
    return verts, faces, uvs


def anel_fechado(pontos, raio, n_anel=8, cima=(0.0, 0.0, 1.0)):
    """Tubo fechado em laco (borda enrolada, cinto, aro)."""
    P = np.asarray(pontos, dtype=float)
    K = len(P)
    verts = []
    faces = []
    up = np.array(cima, dtype=float)
    for k in range(K):
        t = P[(k + 1) % K] - P[(k - 1) % K]
        t /= np.linalg.norm(t)
        b = np.cross(t, up)
        if np.linalg.norm(b) < 1e-6:
            b = np.cross(t, [1.0, 0.0, 0.0])
        b /= np.linalg.norm(b)
        n = np.cross(b, t)
        for j in range(n_anel):
            th = 2 * math.pi * j / n_anel
            verts.append(P[k] + raio * (math.cos(th) * b + math.sin(th) * n))
    for k in range(K):
        for j in range(n_anel):
            a = k * n_anel + j
            b2 = k * n_anel + (j + 1) % n_anel
            a2 = ((k + 1) % K) * n_anel + j
            c2 = ((k + 1) % K) * n_anel + (j + 1) % n_anel
            faces.append((a, a2, c2, b2))
    return verts, faces


def quadro_local(eixo, ref=(0.0, 1.0, 0.0)):
    Z = Vector(eixo).normalized()
    X = Vector(ref).cross(Z)
    if X.length < 1e-6:
        X = Vector((1.0, 0.0, 0.0)).cross(Z)
    X.normalize()
    Y = Z.cross(X)
    return Matrix((X, Y, Z)).transposed()


def casca(centro, eixo, raios, th0, th1, nth, ph0=0.0, ph1=2 * math.pi, nph=32, ref=(0.0, 1.0, 0.0), deform=None):
    """Pedaco de elipsoide (placa). Polo no eixo dado. Normais para fora."""
    rot = quadro_local(eixo, ref)
    centro = Vector(centro)
    fechado = abs((ph1 - ph0) - 2 * math.pi) < 1e-6
    ncol = nph if fechado else nph + 1
    verts = []
    uvs = []
    for i in range(nth + 1):
        th = th0 + (th1 - th0) * i / nth
        for j in range(ncol):
            ph = ph0 + (ph1 - ph0) * j / nph
            p = Vector((raios[0] * math.sin(th) * math.cos(ph), raios[1] * math.sin(th) * math.sin(ph), raios[2] * math.cos(th)))
            if deform is not None:
                p = deform(p, th, ph)
            verts.append(centro + rot @ p)
            uvs.append((j / nph, i / nth))
    faces = []
    for i in range(nth):
        for j in range(nph):
            a = i * ncol + j
            b = i * ncol + ((j + 1) % ncol if fechado else j + 1)
            faces.append((a, a + ncol, b + ncol, b))
    return verts, faces, uvs


def faixa(c, linhas, n=32, quilha=0.0, quilha_l=0.06, dorso_plano=0.0):
    """Faixa de placa em volta do corpo (fraldao, gorjal, couraca).
    linhas: (z, rx, ry, dy) de baixo para cima. j=0 fica na frente (-Y).
    quilha: aresta viva em V no meio da frente."""
    verts = []
    for (z, rx, ry, dy) in linhas:
        for j in range(n):
            ph = -math.pi / 2 + 2 * math.pi * j / n
            x = rx * math.cos(ph)
            y = ry * math.sin(ph) + dy
            if quilha and math.sin(ph) < 0:
                y -= quilha * max(0.0, 1.0 - abs(x) / quilha_l) * (-math.sin(ph))
            if dorso_plano and math.sin(ph) > 0:
                y -= dorso_plano * math.sin(ph) ** 4
            verts.append((c[0] + x, c[1] + y, z))
    faces = []
    for i in range(len(linhas) - 1):
        for j in range(n):
            a = i * n + j
            b = i * n + (j + 1) % n
            faces.append((a, b, b + n, a + n))
    return verts, faces


def transformar(verts, M):
    return [M @ Vector(v) for v in verts]


def _suavizar(me, angulo_vivo):
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    if angulo_vivo is not None:
        try:
            me.set_sharp_from_angle(angle=math.radians(angulo_vivo))
        except Exception:
            pass


def malha(nome, verts, faces, mat=None, pai=None, subsurf=0, solid=0.0, bevel=0.0, bevel_seg=2,
          angulo_vivo=None, uvs=None, attrs=None, fundir=False, recalc=False, solid_off=-1.0, vis_sombra=True):
    me = bpy.data.meshes.new(nome)
    me.from_pydata([tuple(float(c) for c in v) for v in verts], [], [tuple(int(i) for i in f) for f in faces])
    if uvs is not None:
        camada = me.uv_layers.new(name='UVMap')
        li = np.empty(len(me.loops), dtype=np.int64)
        me.loops.foreach_get('vertex_index', li)
        uv = np.asarray(uvs, dtype=np.float32)[li]
        camada.data.foreach_set('uv', uv.ravel())
    if attrs:
        for k, vals in attrs.items():
            a = me.attributes.new(k, 'FLOAT', 'POINT')
            a.data.foreach_set('value', np.asarray(vals, dtype=np.float32))
    if fundir or recalc:
        bm = bmesh.new()
        bm.from_mesh(me)
        if fundir:
            bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        if recalc:
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(me)
        bm.free()
    me.validate(clean_customdata=False)
    me.update()
    ob = bpy.data.objects.new(nome, me)
    _colecao().objects.link(ob)
    if mat is not None:
        me.materials.append(mat)
    _suavizar(me, angulo_vivo)
    if solid:
        m = ob.modifiers.new('Espessura', 'SOLIDIFY')
        m.thickness = solid
        m.offset = solid_off
        m.use_even_offset = True
        m.use_quality_normals = True
        if mat is not None and mat.name == 'Aco' and 'AcoEscuro' in bpy.data.materials:
            # avesso da placa escuro: a fresta entre uma lame e outra aparece
            me.materials.append(bpy.data.materials['AcoEscuro'])
            m.material_offset = 1
    if bevel:
        m = ob.modifiers.new('Chanfro', 'BEVEL')
        m.width = bevel
        m.segments = bevel_seg
        m.limit_method = 'ANGLE'
        m.angle_limit = math.radians(32)
        try:
            m.harden_normals = True
        except Exception:
            pass
    if subsurf:
        m = ob.modifiers.new('Suave', 'SUBSURF')
        m.levels = 1
        m.render_levels = subsurf
    if pai is not None:
        prender(ob, pai)
    if not vis_sombra:
        ob.visible_shadow = False
    return ob


def prender(ob, pai, manter=True):
    ob.parent = pai
    if manter:
        ob.matrix_parent_inverse = pai.matrix_world.inverted()


def vazio(nome, posicao=(0, 0, 0), pai=None):
    ob = bpy.data.objects.new(nome, None)
    _colecao().objects.link(ob)
    ob.empty_display_size = 0.08
    if pai is not None:
        ob.parent = pai
    ob.matrix_world = Matrix.Translation(Vector(posicao))
    return ob


# =====================================================================
# materiais
# =====================================================================
def _nos(dono):
    try:
        dono.use_nodes = True
    except Exception:
        pass
    nt = dono.node_tree
    nt.nodes.clear()
    return nt


def N(nt, tipo, **props):
    n = nt.nodes.new(tipo)
    for k, v in props.items():
        setattr(n, k, v)
    return n


def E(no, nome, valor):
    s = no.inputs.get(nome)
    if s is not None:
        s.default_value = valor
    return s


def L(nt, a, b):
    nt.links.new(a, b)


def _sock(no, ident, saida=False):
    for s in (no.outputs if saida else no.inputs):
        if s.identifier == ident:
            return s
    raise KeyError(ident)


def misturar(nt, fator, a, b, modo='MIX'):
    m = N(nt, 'ShaderNodeMix')
    m.data_type = 'RGBA'
    m.blend_type = modo
    f = _sock(m, 'Factor_Float')
    if isinstance(fator, (int, float)):
        f.default_value = fator
    else:
        L(nt, fator, f)
    for ident, val in (('A_Color', a), ('B_Color', b)):
        s = _sock(m, ident)
        if isinstance(val, tuple):
            s.default_value = val if len(val) == 4 else (*val, 1.0)
        else:
            L(nt, val, s)
    return _sock(m, 'Result_Color', saida=True)


def rampa(nt, fator, paradas):
    r = N(nt, 'ShaderNodeValToRGB')
    els = r.color_ramp.elements
    while len(els) > 1:
        els.remove(els[-1])
    els[0].position = paradas[0][0]
    els[0].color = (*paradas[0][1], 1.0)
    for pos, cor in paradas[1:]:
        e = els.new(pos)
        e.color = (*cor, 1.0)
    L(nt, fator, r.inputs['Fac'])
    return r.outputs['Color']


def mat_principled(nome, **kw):
    m = bpy.data.materials.new(nome)
    nt = _nos(m)
    out = N(nt, 'ShaderNodeOutputMaterial')
    p = N(nt, 'ShaderNodeBsdfPrincipled')
    for k, v in kw.items():
        E(p, k, v)
    L(nt, p.outputs['BSDF'], out.inputs['Surface'])
    return m, nt, p


def mat_aco(nome, cor, rug):
    m, nt, p = mat_principled(nome, **{'Metallic': 1.0, 'Roughness': rug, 'Anisotropic': 0.35})
    tc = N(nt, 'ShaderNodeTexCoord')
    ru = N(nt, 'ShaderNodeTexNoise')
    E(ru, 'Scale', 14.0)
    E(ru, 'Detail', 6.0)
    E(ru, 'Roughness', 0.6)
    L(nt, tc.outputs['Object'], ru.inputs['Vector'])
    mr = N(nt, 'ShaderNodeMapRange')
    E(mr, 'From Min', 0.35)
    E(mr, 'From Max', 0.65)
    E(mr, 'To Min', rug - 0.07)
    E(mr, 'To Max', rug + 0.12)
    L(nt, ru.outputs['Fac'], mr.inputs['Value'])
    L(nt, mr.outputs['Result'], p.inputs['Roughness'])
    ao = N(nt, 'ShaderNodeAmbientOcclusion')
    ao.samples = 8
    E(ao, 'Distance', 0.06)
    escuro = tuple(c * 0.28 for c in cor)
    L(nt, rampa(nt, ao.outputs['AO'], [(0.0, escuro), (0.9, cor)]), p.inputs['Base Color'])
    risco = N(nt, 'ShaderNodeTexNoise')
    E(risco, 'Scale', 240.0)
    E(risco, 'Detail', 2.0)
    L(nt, tc.outputs['Object'], risco.inputs['Vector'])
    bev = N(nt, 'ShaderNodeBevel')
    bev.samples = 6
    E(bev, 'Radius', 0.003)
    bump = N(nt, 'ShaderNodeBump')
    E(bump, 'Strength', 0.03)
    E(bump, 'Distance', 0.002)
    L(nt, risco.outputs['Fac'], bump.inputs['Height'])
    L(nt, bev.outputs['Normal'], bump.inputs['Normal'])
    # gravura: arabescos rasos na placa (so aparecem de perto, no render grande)
    grav = N(nt, 'ShaderNodeTexWave')
    E(grav, 'Scale', 16.0)
    E(grav, 'Distortion', 10.0)
    E(grav, 'Detail', 3.0)
    L(nt, tc.outputs['Object'], grav.inputs['Vector'])
    bump2 = N(nt, 'ShaderNodeBump')
    E(bump2, 'Strength', 0.14)
    E(bump2, 'Distance', 0.0015)
    L(nt, grav.outputs['Fac'], bump2.inputs['Height'])
    L(nt, bump.outputs['Normal'], bump2.inputs['Normal'])
    L(nt, bump2.outputs['Normal'], p.inputs['Normal'])
    return m


def mat_tecido(nome, cor, forro, debrum):
    m, nt, p = mat_principled(nome, **{'Roughness': 0.82, 'Sheen Weight': 0.85, 'Sheen Roughness': 0.38,
                                       'Sheen Tint': (0.55, 0.68, 1.0, 1.0)})
    geo = N(nt, 'ShaderNodeNewGeometry')
    uvn = N(nt, 'ShaderNodeUVMap')
    sep = N(nt, 'ShaderNodeSeparateXYZ')
    L(nt, uvn.outputs['UV'], sep.inputs['Vector'])
    # faixa bordada nas beiradas (u perto de 0 ou 1, v perto de 1)
    a = N(nt, 'ShaderNodeMath', operation='LESS_THAN')
    E(a, 'Value', 0.0)
    a.inputs[1].default_value = 0.022
    L(nt, sep.outputs['X'], a.inputs[0])
    b = N(nt, 'ShaderNodeMath', operation='GREATER_THAN')
    b.inputs[1].default_value = 0.978
    L(nt, sep.outputs['X'], b.inputs[0])
    c = N(nt, 'ShaderNodeMath', operation='GREATER_THAN')
    c.inputs[1].default_value = 0.972
    L(nt, sep.outputs['Y'], c.inputs[0])
    ab = N(nt, 'ShaderNodeMath', operation='MAXIMUM')
    L(nt, a.outputs[0], ab.inputs[0])
    L(nt, b.outputs[0], ab.inputs[1])
    abc = N(nt, 'ShaderNodeMath', operation='MAXIMUM')
    L(nt, ab.outputs[0], abc.inputs[0])
    L(nt, c.outputs[0], abc.inputs[1])
    frente = N(nt, 'ShaderNodeMath', operation='SUBTRACT')
    frente.inputs[0].default_value = 1.0
    L(nt, geo.outputs['Backfacing'], frente.inputs[1])
    faixa_f = N(nt, 'ShaderNodeMath', operation='MULTIPLY')
    L(nt, abc.outputs[0], faixa_f.inputs[0])
    L(nt, frente.outputs[0], faixa_f.inputs[1])
    # cor: frente x forro, depois o debrum
    tc = N(nt, 'ShaderNodeTexCoord')
    var = N(nt, 'ShaderNodeTexNoise')
    E(var, 'Scale', 5.0)
    E(var, 'Detail', 3.0)
    L(nt, tc.outputs['Object'], var.inputs['Vector'])
    claro = tuple(min(1.0, x * 1.25) for x in cor)
    tom = rampa(nt, var.outputs['Fac'], [(0.3, cor), (0.7, claro)])
    corpo = misturar(nt, geo.outputs['Backfacing'], tom, forro)
    final = misturar(nt, faixa_f.outputs[0], corpo, debrum)
    L(nt, final, p.inputs['Base Color'])
    L(nt, faixa_f.outputs[0], p.inputs['Metallic'])
    # trama + rugas finas
    trama = N(nt, 'ShaderNodeTexNoise')
    E(trama, 'Scale', 380.0)
    E(trama, 'Detail', 1.0)
    L(nt, tc.outputs['Object'], trama.inputs['Vector'])
    ruga = N(nt, 'ShaderNodeTexNoise')
    E(ruga, 'Scale', 9.0)
    E(ruga, 'Detail', 4.0)
    L(nt, tc.outputs['Object'], ruga.inputs['Vector'])
    soma = N(nt, 'ShaderNodeMath', operation='ADD')
    L(nt, trama.outputs['Fac'], soma.inputs[0])
    L(nt, ruga.outputs['Fac'], soma.inputs[1])
    bump = N(nt, 'ShaderNodeBump')
    E(bump, 'Strength', 0.12)
    E(bump, 'Distance', 0.004)
    L(nt, soma.outputs[0], bump.inputs['Height'])
    L(nt, bump.outputs['Normal'], p.inputs['Normal'])
    return m


def mat_pena(nome, paradas, barbas=0.18, beirada=1.15, veludo=0.08):
    """Pena larga: cor da raiz a ponta, variacao por pena e barbulas leves no relevo."""
    m, nt, p = mat_principled(nome, **{'Roughness': 0.72, 'Sheen Weight': veludo, 'Sheen Roughness': 0.35,
                                       'Sheen Tint': (1.0, 0.9, 0.85, 1.0), 'Specular IOR Level': 0.04})
    uvn = N(nt, 'ShaderNodeUVMap')
    sep = N(nt, 'ShaderNodeSeparateXYZ')
    L(nt, uvn.outputs['UV'], sep.inputs['Vector'])
    tom = rampa(nt, sep.outputs['Y'], paradas)
    # barbulas: listras inclinadas para a ponta
    meio = N(nt, 'ShaderNodeMath', operation='SUBTRACT')
    meio.inputs[1].default_value = 0.5
    L(nt, sep.outputs['X'], meio.inputs[0])
    absm = N(nt, 'ShaderNodeMath', operation='ABSOLUTE')
    L(nt, meio.outputs[0], absm.inputs[0])
    k1 = N(nt, 'ShaderNodeMath', operation='MULTIPLY')
    k1.inputs[1].default_value = 70.0
    L(nt, absm.outputs[0], k1.inputs[0])
    k2 = N(nt, 'ShaderNodeMath', operation='MULTIPLY')
    k2.inputs[1].default_value = -45.0
    L(nt, sep.outputs['Y'], k2.inputs[0])
    soma = N(nt, 'ShaderNodeMath', operation='ADD')
    L(nt, k1.outputs[0], soma.inputs[0])
    L(nt, k2.outputs[0], soma.inputs[1])
    seno = N(nt, 'ShaderNodeMath', operation='SINE')
    L(nt, soma.outputs[0], seno.inputs[0])
    # variacao por pena
    at = N(nt, 'ShaderNodeAttribute')
    at.attribute_name = 'rnd'
    var = N(nt, 'ShaderNodeMapRange')
    E(var, 'To Min', 0.78)
    E(var, 'To Max', 1.22)
    L(nt, at.outputs['Fac'], var.inputs['Value'])
    esc = N(nt, 'ShaderNodeVectorMath', operation='SCALE')
    L(nt, tom, esc.inputs[0])
    L(nt, var.outputs['Result'], esc.inputs['Scale'])
    # beirada da pena mais clara (a luz de contorno pega nela)
    borda = N(nt, 'ShaderNodeMapRange')
    E(borda, 'From Min', 0.30)
    E(borda, 'From Max', 0.5)
    E(borda, 'To Min', 1.0)
    E(borda, 'To Max', beirada)
    L(nt, absm.outputs[0], borda.inputs['Value'])
    esc2 = N(nt, 'ShaderNodeVectorMath', operation='SCALE')
    L(nt, esc.outputs[0], esc2.inputs[0])
    L(nt, borda.outputs['Result'], esc2.inputs['Scale'])
    L(nt, esc2.outputs[0], p.inputs['Base Color'])
    bump = N(nt, 'ShaderNodeBump')
    E(bump, 'Strength', barbas)
    E(bump, 'Distance', 0.002)
    L(nt, seno.outputs[0], bump.inputs['Height'])
    L(nt, bump.outputs['Normal'], p.inputs['Normal'])
    return m


def mat_escamas(nome, cor):
    m, nt, p = mat_principled(nome, **{'Roughness': 0.5, 'Coat Weight': 0.25})
    tc = N(nt, 'ShaderNodeTexCoord')
    vor = N(nt, 'ShaderNodeTexVoronoi')
    E(vor, 'Scale', 70.0)
    L(nt, tc.outputs['Object'], vor.inputs['Vector'])
    L(nt, rampa(nt, vor.outputs['Distance'], [(0.0, cor), (0.45, tuple(c * 0.75 for c in cor)), (0.75, tuple(c * 0.3 for c in cor))]), p.inputs['Base Color'])
    bump = N(nt, 'ShaderNodeBump')
    E(bump, 'Strength', 0.45)
    E(bump, 'Distance', 0.004)
    L(nt, vor.outputs['Distance'], bump.inputs['Height'])
    L(nt, bump.outputs['Normal'], p.inputs['Normal'])
    return m


def mat_chifre(nome):
    m, nt, p = mat_principled(nome, **{'Roughness': 0.32, 'Coat Weight': 0.35})
    uvn = N(nt, 'ShaderNodeUVMap')
    sep = N(nt, 'ShaderNodeSeparateXYZ')
    L(nt, uvn.outputs['UV'], sep.inputs['Vector'])
    L(nt, rampa(nt, sep.outputs['Y'], [(0.0, (0.07, 0.065, 0.07)), (0.55, (0.16, 0.15, 0.15)), (1.0, (0.62, 0.58, 0.52))]), p.inputs['Base Color'])
    k = N(nt, 'ShaderNodeMath', operation='MULTIPLY')
    k.inputs[1].default_value = 95.0
    L(nt, sep.outputs['Y'], k.inputs[0])
    s = N(nt, 'ShaderNodeMath', operation='SINE')
    L(nt, k.outputs[0], s.inputs[0])
    bump = N(nt, 'ShaderNodeBump')
    E(bump, 'Strength', 0.35)
    E(bump, 'Distance', 0.003)
    L(nt, s.outputs[0], bump.inputs['Height'])
    L(nt, bump.outputs['Normal'], p.inputs['Normal'])
    return m


def mat_bico(nome):
    m, nt, p = mat_principled(nome, **{'Roughness': 0.3, 'Coat Weight': 0.5, 'Coat Roughness': 0.15})
    uvn = N(nt, 'ShaderNodeUVMap')
    sep = N(nt, 'ShaderNodeSeparateXYZ')
    L(nt, uvn.outputs['UV'], sep.inputs['Vector'])
    L(nt, rampa(nt, sep.outputs['Y'], [(0.0, (0.42, 0.33, 0.14)), (0.22, (0.16, 0.14, 0.12)), (0.8, (0.05, 0.048, 0.05)), (1.0, (0.2, 0.19, 0.18))]), p.inputs['Base Color'])
    return m


def mat_cartao(nome):
    m, nt, p = mat_principled(nome, **{'Base Color': (0.7, 0.02, 0.02, 1.0), 'Roughness': 0.35,
                                       'Emission Color': (1.0, 0.03, 0.018, 1.0), 'Emission Strength': 6.0})
    p.name = 'Cartao'
    return m


def mat_halo(nome):
    m = bpy.data.materials.new(nome)
    nt = _nos(m)
    out = N(nt, 'ShaderNodeOutputMaterial')
    lw = N(nt, 'ShaderNodeLayerWeight')
    E(lw, 'Blend', 0.5)
    inv = N(nt, 'ShaderNodeMath', operation='SUBTRACT')
    inv.inputs[0].default_value = 1.0
    L(nt, lw.outputs['Facing'], inv.inputs[1])
    pw = N(nt, 'ShaderNodeMath', operation='POWER')
    pw.inputs[1].default_value = 3.2
    L(nt, inv.outputs[0], pw.inputs[0])
    em = N(nt, 'ShaderNodeEmission')
    em.name = 'Halo'
    E(em, 'Color', (1.0, 0.035, 0.015, 1.0))
    E(em, 'Strength', 1.5)
    tr = N(nt, 'ShaderNodeBsdfTransparent')
    mx = N(nt, 'ShaderNodeMixShader')
    L(nt, pw.outputs[0], mx.inputs[0])
    L(nt, tr.outputs[0], mx.inputs[1])
    L(nt, em.outputs[0], mx.inputs[2])
    L(nt, mx.outputs[0], out.inputs['Surface'])
    return m


def materiais():
    M = {}
    M['aco'] = mat_aco('Aco', (0.3, 0.33, 0.41), 0.37)
    M['aco_escuro'] = mat_aco('AcoEscuro', (0.2, 0.21, 0.24), 0.38)
    m, nt, p = mat_principled('EsmalteAzul', **{'Base Color': (0.018, 0.06, 0.32, 1.0), 'Roughness': 0.2, 'Coat Weight': 1.0, 'Coat Roughness': 0.06})
    M['esmalte'] = m
    M['capa'] = mat_tecido('Capa', (0.014, 0.045, 0.27), (0.006, 0.016, 0.085), (0.09, 0.15, 0.40))
    M['pena_corpo'] = mat_pena('PenaCorpo', [(0.0, (0.035, 0.02, 0.014)), (0.4, (0.11, 0.066, 0.046)), (0.85, (0.17, 0.11, 0.08)),
                                             (1.0, (0.15, 0.1, 0.075))], barbas=0.1, beirada=1.0, veludo=0.03)
    m, nt, p = mat_principled('Pele', **{'Base Color': (0.07, 0.04, 0.022, 1.0), 'Roughness': 0.85})
    M['pele'] = m
    M['pena'] = mat_pena('Pena', [(0.0, (0.17, 0.115, 0.088)), (0.35, (0.145, 0.097, 0.072)), (0.8, (0.11, 0.07, 0.05)),
                                  (0.95, (0.06, 0.04, 0.03))])
    m, nt, p = mat_principled('OlhoElmo', **{'Base Color': (0.8, 0.9, 1.0, 1.0), 'Emission Color': (0.78, 0.9, 1.0, 1.0),
                                             'Emission Strength': 9.0})
    M['olho_elmo'] = m
    M['escama'] = mat_escamas('Escama', (0.11, 0.07, 0.042))
    M['bico'] = mat_bico('Bico')
    m, nt, p = mat_principled('Garra', **{'Base Color': (0.03, 0.028, 0.03, 1.0), 'Roughness': 0.22, 'Coat Weight': 0.6})
    M['garra'] = m
    m, nt, p = mat_principled('Olho', **{'Base Color': (0.32, 0.07, 0.01, 1.0), 'Roughness': 0.04, 'Coat Weight': 1.0,
                                         'Emission Color': (1.0, 0.35, 0.05, 1.0), 'Emission Strength': 0.12})
    M['olho'] = m
    M['chifre'] = mat_chifre('Chifre')
    m, nt, p = mat_principled('Couro', **{'Base Color': (0.10, 0.05, 0.025, 1.0), 'Roughness': 0.48, 'Coat Weight': 0.2})
    M['couro'] = m
    M['cartao'] = mat_cartao('Cartao')
    M['halo'] = mat_halo('Halo')
    m, nt, p = mat_principled('Sombra', **{'Base Color': (0.5, 0.5, 0.5, 1.0)})
    M['sombra'] = m
    return M


# =====================================================================
# penas largas (cards), nada de fio
# =====================================================================
def quadro_pena(raiz, direcao, normal):
    """Matriz de uma pena: Y ao longo da pena, Z para fora da superficie."""
    y = Vector(direcao).normalized()
    z = Vector(normal)
    z = z - y * z.dot(y)
    if z.length < 1e-6:
        z = y.orthogonal()
    z.normalize()
    x = y.cross(z)
    m = Matrix((x, y, z)).transposed().to_4x4()
    m.translation = Vector(raiz)
    return m


def plumagem(ob, M, pai, nome, direcao, tamanho, pular=None, semente=7, erguer=0.26, area_ref=0.0018):
    """Cobre a malha com penas largas deitadas, como telhas: raiz escondida, ponta levantada."""
    pen = Penas(semente)
    rng = random.Random(semente)
    for poly in ob.data.polygons:
        c = poly.center.copy()
        n = poly.normal.copy()
        if pular is not None and pular(c, n):
            continue
        if rng.random() > min(1.0, poly.area / area_ref):
            continue
        comp, larg = tamanho(c, n)
        d = Vector(direcao(c, n))
        d = d - n * d.dot(n)
        if d.length < 1e-4:
            continue
        d = Matrix.Rotation(rng.uniform(-0.2, 0.2), 3, n) @ d
        M4 = quadro_pena(c - n * 0.012, d, n) @ Matrix.Rotation(erguer + rng.uniform(-0.07, 0.07), 4, 'X')
        pen.add(M4, comp * rng.uniform(0.85, 1.15), larg * rng.uniform(0.85, 1.15), assim=rng.uniform(-0.15, 0.15), curva=0.1)
    return pen.objeto(nome, M['pena_corpo'], pai)


# =====================================================================
# a ave (grifo marrom)
# =====================================================================
# coluna: cauda -> peito -> pescoco -> cabeca. [x, y, z, rx, r_dorso, r_ventre]
COLUNA_AVE = [
    [0, 0.74, 1.22, 0.05, 0.04, 0.04],
    [0, 0.62, 1.22, 0.15, 0.12, 0.13],
    [0, 0.45, 1.19, 0.27, 0.20, 0.27],
    [0, 0.24, 1.16, 0.345, 0.255, 0.36],
    [0, 0.02, 1.14, 0.375, 0.275, 0.41],
    [0, -0.20, 1.17, 0.37, 0.27, 0.42],
    [0, -0.37, 1.27, 0.32, 0.245, 0.38],
    [0, -0.50, 1.40, 0.24, 0.21, 0.28],
    [0, -0.60, 1.56, 0.205, 0.19, 0.215],
    [0, -0.67, 1.70, 0.18, 0.175, 0.18],
    [0, -0.72, 1.81, 0.165, 0.16, 0.16],
    [0, -0.79, 1.90, 0.15, 0.15, 0.125],
    [0, -0.89, 1.945, 0.135, 0.122, 0.105],
    [0, -1.0, 1.93, 0.094, 0.085, 0.077],
]
# a cabeca foi desenhada no lugar antigo e depois empurrada para a frente e para baixo
DESLOCA_CABECA = Vector((0.0, -0.12, -0.075))
CABECA_AVE = Vector((0.0, -0.73, 2.0))
ESCALA_CABECA = 1.22


def secao_corpo(y):
    """Centro e raios do corpo da ave na altura y (trecho quase horizontal do tronco)."""
    pts = [r for r in COLUNA_AVE[1:7]]
    ys = [r[1] for r in pts]
    for i in range(len(pts) - 1):
        y0, y1 = ys[i], ys[i + 1]
        if (y0 - y) * (y1 - y) <= 0:
            t = (y - y0) / (y1 - y0) if y1 != y0 else 0.0
            return [pts[i][k] + (pts[i + 1][k] - pts[i][k]) * t for k in (2, 3, 4, 5)]
    r = pts[0] if y > ys[0] else pts[-1]
    return [r[2], r[3], r[4], r[5]]


def _direcao_peito(h, v):
    return Vector((math.cos(v) * math.sin(h), -math.cos(v) * math.cos(h), math.sin(v)))


def no_peitoral(c, margem=0.06):
    """O ponto fica debaixo da placa do peito? (angulos em volta do centro do peito)"""
    d = Vector(c) - PEITO_C
    if d.length < 1e-6:
        return False
    d.normalize()
    v = math.asin(max(-1.0, min(1.0, d.z)))
    h = math.atan2(d.x, -d.y)
    return abs(h) < PEITO_H - margem and PEITO_V[0] + margem < v < PEITO_V[1] - margem


def _sem_pena_corpo(c, n):
    # debaixo da manta e da sela, debaixo do peitoral e dentro da testeira a pena nao aparece
    if -0.26 < c.y < 0.52 and c.z > 1.02:
        return True
    if c.y < -0.70 and c.z > 1.80 and abs(c.x) < 0.2:
        return True
    return no_peitoral(c)


def _fluxo_corpo(c, n):
    if c.y < -0.70 and c.z > 1.75:
        return Vector((0.0, 1.0, -0.25))  # cabeca: para a nuca
    if c.y < -0.42 and c.z > 1.32:
        return Vector((0.0, 0.42, -1.0))  # pescoco grosso: descem para o corpo
    if c.y < -0.22 and n.y < -0.4:
        return Vector((0.0, 0.25, -1.0))  # peito: para baixo
    return Vector((0.0, 1.0, -0.3 - 0.7 * max(0.0, -n.z)))  # dorso, flanco e barriga: para tras e para baixo


def _tamanho_corpo(c, n):
    if c.y < -0.70 and c.z > 1.75:
        return 0.1, 0.06
    if c.y < -0.42 and c.z > 1.32:
        return 0.2, 0.12
    if c.y < -0.2:
        return 0.28, 0.17
    if c.z < 0.95:
        return 0.26, 0.16
    return 0.25, 0.15


def construir_corpo_ave(M, pai):
    verts, faces, uvs = tubo(COLUNA_AVE, 70, 26, lado=(1, 0, 0), ponta=(0.03, 0.0))
    ob = malha('AveCorpo', verts, faces, M['pele'], pai=pai, subsurf=2, recalc=True)
    plumagem(ob, M, pai, 'AvePenas', _fluxo_corpo, _tamanho_corpo, pular=_sem_pena_corpo, semente=3, erguer=0.13, area_ref=0.0026)
    return ob


def ameias(nome, borda, normais, fora, M, pai, alt=0.04, esp=0.02, cada=2):
    """Dentes de castelo na borda de uma placa: um bloco sim, um nao."""
    verts, faces = [], []
    lados = ((0, 1, 3, 2), (4, 5, 7, 6), (0, 1, 5, 4), (2, 3, 7, 6), (0, 2, 6, 4), (1, 3, 7, 5))
    for i in range(0, len(borda) - 1, cada):
        a, b = Vector(borda[i]), Vector(borda[i + 1])
        n = (Vector(normais[i]) + Vector(normais[i + 1])).normalized()
        o = (Vector(fora[i]) + Vector(fora[i + 1])).normalized()
        base = len(verts)
        for p_ in (a, b):
            for h in (-0.006, alt):
                for e in (-0.5, 0.5):
                    verts.append(p_ + o * h + n * (e * esp))
        faces.extend(tuple(base + k for k in lado) for lado in lados)
    return malha(nome, verts, faces, M['aco'], pai=pai, bevel=0.003, angulo_vivo=30, recalc=True)


def construir_peitoral_ave(M, pai, corpo_ob):
    """Placa de aco no peito da ave, colada na forma do corpo, com ameias na borda de cima."""
    from mathutils.bvhtree import BVHTree
    me = corpo_ob.data
    arvore = BVHTree.FromPolygons([v.co.copy() for v in me.vertices], [tuple(p_.vertices) for p_ in me.polygons])
    nh, nv = 26, 14
    verts, normais = [], []
    for j in range(nv + 1):
        vv = PEITO_V[0] + (PEITO_V[1] - PEITO_V[0]) * j / nv
        for i in range(nh + 1):
            d = _direcao_peito(-PEITO_H + 2 * PEITO_H * i / nh, vv)
            acerto, nrm, _, _ = arvore.ray_cast(PEITO_C + d * 1.5, -d, 3.0)
            if acerto is None:
                acerto, nrm = PEITO_C + d * 0.42, d
            if nrm.dot(d) < 0:
                nrm = -nrm
            verts.append(acerto + nrm * 0.045)
            normais.append(nrm)
    linha = nh + 1
    faces = [(j * linha + i, j * linha + i + 1, (j + 1) * linha + i + 1, (j + 1) * linha + i) for j in range(nv) for i in range(nh)]
    obs = [malha('PeitoralAve', verts, faces, M['aco'], pai=pai, solid=0.018, subsurf=2, recalc=True)]
    topo = verts[nv * linha:]
    abaixo = verts[(nv - 1) * linha:nv * linha]
    fora = [(a - b).normalized() for a, b in zip(topo, abaixo)]
    obs.append(ameias('PeitoralAmeias', topo, normais[nv * linha:], fora, M, pai, alt=0.05, esp=0.022))
    return obs


def construir_pernas_ave(M, pai):
    """Pernas grossas encolhidas (a ave esta no salto), tres dedos fechados como na pintura."""
    obs = []
    for sg in (-1, 1):
        lado = 'E' if sg > 0 else 'D'
        coxa = [[sg * 0.21, 0.10, 0.94, 0.15, 0.15, 0.15], [sg * 0.25, 0.0, 0.81, 0.14, 0.14, 0.14],
                [sg * 0.265, -0.10, 0.71, 0.105, 0.105, 0.105]]
        v, f, u = tubo(coxa, 16, 16, lado=(1, 0, 0))
        ob = malha('AveCoxa' + lado, v, f, M['pele'], pai=pai, subsurf=2, recalc=True)
        obs.append(ob)
        plumagem(ob, M, pai, 'AveCoxaPenas' + lado, lambda c, n: Vector((0.0, 0.5, -1.0)), lambda c, n: (0.19, 0.13),
                 semente=40 + sg, erguer=0.2, area_ref=0.0032)
        canela = [[sg * 0.265, -0.11, 0.71, 0.082, 0.082, 0.082], [sg * 0.27, 0.02, 0.61, 0.076, 0.072, 0.072],
                  [sg * 0.275, 0.17, 0.53, 0.068, 0.065, 0.065]]
        v, f, u = tubo(canela, 14, 14, lado=(1, 0, 0))
        obs.append(malha('AveCanela' + lado, v, f, M['escama'], pai=pai, subsurf=2, recalc=True))
        tornozelo = Vector((sg * 0.275, 0.18, 0.52))
        for k, a in enumerate((-0.45, 0.0, 0.45)):
            lat = math.sin(a)
            p0 = tornozelo
            p1 = tornozelo + Vector((lat * 0.06, -0.075, -0.05))
            p2 = tornozelo + Vector((lat * 0.105, -0.13, -0.12))
            p3 = tornozelo + Vector((lat * 0.125, -0.10, -0.2))
            linhas = [[*p0, 0.056, 0.05, 0.05], [*p1, 0.05, 0.046, 0.046], [*p2, 0.042, 0.04, 0.04], [*p3, 0.034, 0.032, 0.032]]
            v, f, u = tubo(linhas, 14, 12, lado=(1, 0, 0))
            obs.append(malha('AveDedo%d%s' % (k, lado), v, f, M['escama'], pai=pai, subsurf=2, recalc=True))
            q1 = p3 + Vector((lat * 0.01, 0.03, -0.045))
            q2 = p3 + Vector((lat * 0.015, 0.08, -0.055))
            linhas = [[*p3, 0.028, 0.028, 0.024], [*q1, 0.02, 0.02, 0.017], [*q2, 0.0025, 0.0025, 0.0025]]
            v, f, u = tubo(linhas, 12, 10, lado=(1, 0, 0))
            obs.append(malha('AveGarra%d%s' % (k, lado), v, f, M['garra'], pai=pai, subsurf=1, recalc=True))
    return obs


def pena_local(L_, W, assim=0.0, curva=0.08, n_l=9, n_w=4):
    pts = []
    uvs = []
    for i in range(n_l + 1):
        t = i / n_l
        w = W * (t ** 0.42) * max(0.0, 1.0 - t ** 5) ** 0.5
        w = max(w, W * 0.05)
        for k in range(n_w + 1):
            s = -1.0 + 2.0 * k / n_w
            x = s * w * (1.0 - assim) if s < 0 else s * w * (1.0 + assim)
            z = -curva * L_ * t * t + 0.05 * W * (1.0 - abs(s)) ** 3 - 0.10 * W * s * s
            pts.append((x, t * L_, z))
            uvs.append((k / n_w, t))
    faces = []
    for i in range(n_l):
        for k in range(n_w):
            a = i * (n_w + 1) + k
            faces.append((a, a + 1, a + n_w + 2, a + n_w + 1))
    return pts, faces, uvs


class Penas:
    """Junta varias penas numa malha so (cada uma com cor um pouco diferente)."""

    def __init__(self, semente):
        self.v = []
        self.f = []
        self.uv = []
        self.rnd = []
        self.rng = random.Random(semente)

    def add(self, M4, L_, W, assim=0.0, curva=0.08):
        pts, faces, uvs = pena_local(L_, W, assim, curva)
        base = len(self.v)
        r = self.rng.random()
        for p in pts:
            self.v.append(M4 @ Vector(p))
            self.rnd.append(r)
        self.uv.extend(uvs)
        self.f.extend([tuple(i + base for i in fa) for fa in faces])

    def espelhar_x(self):
        self.v = [Vector((-p.x, p.y, p.z)) for p in self.v]
        self.f = [tuple(reversed(fa)) for fa in self.f]

    def objeto(self, nome, mat, pai):
        return malha(nome, self.v, self.f, mat, pai=pai, subsurf=1, solid=0.0025, solid_off=0.0,
                     uvs=self.uv, attrs={'rnd': self.rnd})


# salto: a ave empina o peito como na pintura; o cavaleiro compensa e fica quase em pe
SALTO_INCLINA = math.radians(10)
SALTO_DESLOCA = Vector((0.0, -0.2, 0.15))
INCLINA_CAVALEIRO = math.radians(3)
ORIGEM_CAV = Vector((0.0, 0.13, 1.47))
# peitoral da ave: placa no peito, com ameias na borda de cima
PEITO_C = Vector((0.0, -0.18, 1.16))
PEITO_H = math.radians(40)
PEITO_V = (math.radians(-30), math.radians(6))


def construir_asas(M, corpo_pivo):
    """Asas fechadas, deitadas no flanco por baixo da manta: so as pontas aparecem atras."""
    pivos = []
    fora = Vector((1.0, 0.0, 0.2)).normalized()
    for sg in (1, -1):
        lado = 'E' if sg > 0 else 'D'
        piv = vazio('AsaPivo' + lado, (sg * 0.34, -0.2, 1.36), corpo_pivo)
        pen = Penas(11 + sg)
        for i in range(16):
            f = i / 15
            y = -0.2 + 0.6 * f
            zc, rx, rt, rb = secao_corpo(y)
            raiz = Vector((rx + 0.03 + 0.012 * f, y, zc + 0.12 - 0.06 * f))
            ang = math.radians(-8 - 14 * (1.0 - f))
            d = Vector((0.06, math.cos(ang), math.sin(ang)))
            pen.add(quadro_pena(raiz, d, fora) @ Matrix.Rotation(0.05, 4, 'X'), 0.42 + 0.3 * f, 0.1, assim=0.25, curva=0.05)
        for i in range(12):
            f = i / 11
            y = -0.24 + 0.56 * f
            zc, rx, rt, rb = secao_corpo(y)
            raiz = Vector((rx + 0.055, y, zc + 0.16 - 0.03 * f))
            pen.add(quadro_pena(raiz, Vector((0.04, 1.0, -0.35)), fora) @ Matrix.Rotation(0.1, 4, 'X'), 0.25, 0.09, curva=0.08)
        if sg < 0:
            pen.espelhar_x()
        pen.objeto('AsaPenas' + lado, M['pena'], piv)
        pivos.append(piv)
    return pivos


def construir_cauda(M, pai):
    """Leque largo de penas chatas e grossas, como na pintura."""
    pen = Penas(31)
    raiz0 = Vector((0.0, 0.6, 1.24))
    giro = Matrix.Rotation(math.radians(40), 3, 'Y')
    cima = giro @ Vector((0.0, 0.0, 1.0))
    for i in range(13):
        f = i / 12 - 0.5
        a = f * math.radians(104)
        p_ = math.radians(9 - 24 * abs(f))
        d = giro @ Vector((math.sin(a) * math.cos(p_), math.cos(a) * math.cos(p_), math.sin(p_)))
        raiz = raiz0 + giro @ Vector((f * 0.14, 0.0, 0.012 * (0.5 - abs(f))))
        pen.add(quadro_pena(raiz, d, cima) @ Matrix.Rotation(f * 0.4, 4, 'Y'), 0.66 + 0.1 * math.cos(f * math.pi), 0.14,
                assim=0.12 * (1 if f > 0 else -1), curva=0.03)
    for i in range(9):
        f = i / 8 - 0.5
        a = f * math.radians(84)
        p_ = math.radians(13 - 18 * abs(f))
        d = giro @ Vector((math.sin(a) * math.cos(p_), math.cos(a) * math.cos(p_), math.sin(p_)))
        raiz = raiz0 + giro @ Vector((f * 0.12, -0.05, 0.035))
        pen.add(quadro_pena(raiz, d, cima) @ Matrix.Rotation(f * 0.3, 4, 'Y'), 0.42 + 0.06 * math.cos(f * math.pi), 0.12, curva=0.05)
    for i in range(7):
        f = i / 6 - 0.5
        raiz = raiz0 + giro @ Vector((f * 0.16, -0.13, 0.06))
        pen.add(quadro_pena(raiz, giro @ Vector((math.sin(f * 1.1), 1.0, 0.12)), cima), 0.24, 0.1, curva=0.08)
    return pen.objeto('Cauda', M['pena'], pai)


def construir_cabeca_ave(M, pai):
    obs = []
    # bico grosso de chocobo: alto e largo na base, ponta pouco curva
    sup = [[0, -0.78, 2.012, 0.086, 0.08, 0.07], [0, -0.87, 2.006, 0.078, 0.07, 0.062], [0, -0.95, 1.986, 0.062, 0.058, 0.05],
           [0, -1.02, 1.956, 0.045, 0.042, 0.036], [0, -1.062, 1.918, 0.026, 0.026, 0.022], [0, -1.072, 1.878, 0.006, 0.006, 0.006]]
    v, f, u = tubo(sup, 30, 18, lado=(1, 0, 0))
    obs.append(malha('Bico', v, f, M['bico'], pai=pai, subsurf=2, uvs=u, recalc=True))
    inf = [[0, -0.79, 1.948, 0.07, 0.04, 0.04], [0, -0.89, 1.932, 0.058, 0.032, 0.03], [0, -0.97, 1.916, 0.034, 0.02, 0.02],
           [0, -1.01, 1.906, 0.006, 0.006, 0.006]]
    v, f, u = tubo(inf, 16, 14, lado=(1, 0, 0))
    obs.append(malha('BicoInferior', v, f, M['bico'], pai=pai, subsurf=2, uvs=u, recalc=True))
    olhos = []
    for sg in (-1, 1):
        centro = Vector((sg * 0.098, -0.775, 2.005))
        eixo = Vector((sg, -0.35, 0.05)).normalized()
        olhos.append((centro, eixo, sg))
        v, f, u = casca(centro, eixo, (0.019, 0.019, 0.019), 0, math.pi, 10, nph=14)
        obs.append(malha('Olho' + ('E' if sg > 0 else 'D'), v, f, M['olho'], pai=pai, subsurf=1, fundir=True, recalc=True))

    # testeira angulosa e comprida cobrindo a cabeca, com furo em volta de cada olho
    def quilha(p, th, ph):
        p = facetar(p, ph, 6)
        k = max(0.0, 1.0 - abs(p.x) / 0.05)
        return Vector((p.x, p.y, p.z + 0.022 * k * math.sin(th) + 0.01 * k))
    v, f, u = casca(CABECA_AVE + Vector((0, -0.06, 0.012)), (0, -0.42, 1.0), (0.27, 0.155, 0.15), 0.0, math.radians(100), 12,
                    nph=36, ref=(1, 0, 0), deform=quilha)

    def no_furo(fa):
        c = sum((Vector(v[i]) for i in fa), Vector()) / len(fa)
        for centro, eixo, _ in olhos:
            d = c - centro
            if (d - eixo * d.dot(eixo)).length < 0.036 and d.dot(eixo) > -0.03:
                return True
        return False
    f = [fa for fa in f if not no_furo(fa)]
    obs.append(malha('Testeira', v, f, M['aco'], pai=pai, solid=0.014, bevel=0.0045, angulo_vivo=38, fundir=True))
    # aro de aco em volta do furo do olho
    for centro, eixo, sg in olhos:
        rot = quadro_local(eixo, (0, 0, 1))
        pts = [centro + eixo * 0.03 + rot @ Vector((0.038 * math.cos(a), 0.038 * math.sin(a), 0.0))
               for a in np.linspace(0, 2 * math.pi, 18, endpoint=False)]
        v2, f2 = anel_fechado(pts, 0.009, 8, cima=eixo)
        obs.append(malha('AroOlho' + ('E' if sg > 0 else 'D'), v2, f2, M['aco'], pai=pai, subsurf=1))
    # crista espetada: penas compridas e pontudas saindo de tras da testeira
    pen = Penas(77)
    for i in range(9):
        f_ = i / 8
        x = 0.022 * (1 if i % 2 else -1)
        raiz = Vector((x, -0.66 + 0.15 * f_, 2.1 - 0.03 * f_))
        th = math.radians(16 + 50 * f_)
        d = Vector((x * 2.0, math.sin(th), math.cos(th)))
        pen.add(quadro_pena(raiz, d, Vector((1.0 if i % 2 else -1.0, 0.0, 0.0))), 0.34 - 0.12 * f_, 0.06, curva=0.03)
    obs.append(pen.objeto('Crista', M['pena'], pai))
    # pano azul pendurado debaixo do bico
    nu, nv = 16, 12
    verts, uvs = [], []
    for i in range(nv + 1):
        t = i / nv
        for j in range(nu + 1):
            fi = math.radians(-80 + 160 * j / nu)
            x = 0.075 * math.sin(fi) * (1.0 + 0.3 * t)
            y = -0.745 - 0.075 * math.cos(fi) - 0.03 * t + 0.012 * t * math.sin(fi * 4.0 + t * 3.0)
            z = 1.905 - 0.40 * t
            verts.append((x, y, z))
            uvs.append((j / nu, 1.0 - t))
    faces = [(i * (nu + 1) + j, i * (nu + 1) + j + 1, (i + 1) * (nu + 1) + j + 1, (i + 1) * (nu + 1) + j) for i in range(nv) for j in range(nu)]
    obs.append(malha('PanoBico', verts, faces, M['capa'], pai=pai, subsurf=2, solid=0.008, solid_off=0.0, uvs=uvs))
    # lames do pescoco (crineira de metal) logo atras da testeira
    for k in range(2):
        c = Vector((0.0, -0.58 + 0.06 * k, 1.93 - 0.075 * k))
        v, f, u = casca(c, (0, 0.35, 1.0), (0.17 + 0.01 * k, 0.14, 0.13), 0.0, math.radians(58), 6, nph=28, ref=(1, 0, 0))
        obs.append(malha('Crineira%d' % k, v, f, M['aco'], pai=pai, solid=0.012, bevel=0.004, angulo_vivo=38, fundir=True))
    return obs


def construir_sela(M, pai, cav):
    obs = []
    v, f, u = casca((0.0, 0.15, 1.425), (0, 0, 1), (0.21, 0.26, 0.055), 0.0, math.pi, 12, nph=28, ref=(1, 0, 0))
    obs.append(malha('Sela', v, f, M['couro'], pai=pai, subsurf=1, fundir=True, recalc=True))
    for nome, pts, r in (('Patilha', [(-0.16, 0.32, 1.47), (0.0, 0.40, 1.57), (0.16, 0.32, 1.47)], 0.03),
                         ('Arcao', [(-0.11, -0.07, 1.47), (0.0, -0.12, 1.53), (0.11, -0.07, 1.47)], 0.024)):
        linhas = [[*p, r, r, r] for p in pts]
        v, f, u = tubo(linhas, 14, 10, lado=(0, 0, 1))
        obs.append(malha(nome, v, f, M['couro'], pai=pai, subsurf=2, recalc=True))
    # manta azul por cima do dorso, caindo pelos flancos
    nu, nv = 30, 12
    verts = []
    uvs = []
    for i in range(nv + 1):
        t = i / nv
        y = -0.24 + 0.74 * t
        zc, rx, rt, rb = secao_corpo(y)
        for j in range(nu + 1):
            s = -1.0 + 2.0 * j / nu
            ang = s * math.radians(78)
            off = 0.075
            x = (rx + off) * math.sin(ang)
            z = zc + (rt + off) * math.cos(ang)
            if abs(s) > 0.72:
                # cai reto pelo flanco
                extra = (abs(s) - 0.72) / 0.28
                x = math.copysign(rx + off + 0.02 * extra, s) * math.sin(math.radians(78)) / math.sin(math.radians(78))
                z = zc + (rt + off) * math.cos(math.radians(78 * 0.72)) - 0.36 * extra
                z += 0.018 * math.sin(t * math.pi * 5.0)
            verts.append((x, y, z))
            uvs.append((t, 0.5 + 0.5 * abs(s)))
    faces = [(i * (nu + 1) + j, i * (nu + 1) + j + 1, (i + 1) * (nu + 1) + j + 1, (i + 1) * (nu + 1) + j) for i in range(nv) for j in range(nu)]
    obs.append(malha('Manta', verts, faces, M['capa'], pai=pai, subsurf=2, solid=0.012, uvs=uvs, recalc=True))
    # estribos
    for sg in (-1, 1):
        pts = [(sg * 0.52 + 0.045 * math.cos(a), -0.035 + 0.06 * math.sin(a), 0.975) for a in np.linspace(0, 2 * math.pi, 16, endpoint=False)]
        v, f = anel_fechado(pts, 0.008, 6)
        obs.append(malha('Estribo' + ('E' if sg > 0 else 'D'), v, f, M['aco'], pai=cav, subsurf=1))
        linhas = [[sg * 0.40, 0.12, 1.40, 0.012, 0.004, 0.004], [sg * 0.50, 0.0, 1.10, 0.012, 0.004, 0.004],
                  [sg * 0.52, -0.035, 0.985, 0.012, 0.004, 0.004]]
        v, f, u = tubo(linhas, 10, 8, lado=(0, 1, 0))
        obs.append(malha('Loro' + ('E' if sg > 0 else 'D'), v, f, M['couro'], pai=cav, recalc=True))
    return obs


def construir_redeas(M, pai, mao, cab):
    """Redeas da argola do bico ate a mao esquerda. Montadas depois da pose: pontos ja no mundo."""
    obs = []

    def na_cabeca(p):
        return cab.matrix_world @ (Vector(p) - CABECA_AVE)
    for sg in (-1, 1):
        a = na_cabeca((sg * 0.105, -0.88, 1.95))
        b = Vector(mao) + Vector((sg * 0.012, 0.0, 0.0))
        meio = a.lerp(b, 0.5) + Vector((0.0, 0.0, -0.07))
        linhas = [[*a, 0.008, 0.008, 0.008], [*a.lerp(meio, 0.6), 0.008, 0.008, 0.008], [*meio, 0.008, 0.008, 0.008],
                  [*meio.lerp(b, 0.5), 0.008, 0.008, 0.008], [*b, 0.008, 0.008, 0.008]]
        v, f, u = tubo(linhas, 30, 6, lado=(0, 0, 1))
        obs.append(malha('Redea' + ('E' if sg > 0 else 'D'), v, f, M['couro'], pai=pai, recalc=True))
        pts = [na_cabeca((sg * 0.105, -0.88 + 0.022 * math.cos(t_), 1.95 + 0.022 * math.sin(t_)))
               for t_ in np.linspace(0, 2 * math.pi, 12, endpoint=False)]
        v, f = anel_fechado(pts, 0.006, 6, cima=(1, 0, 0))
        obs.append(malha('Argola' + ('E' if sg > 0 else 'D'), v, f, M['aco'], pai=pai))
    return obs


# =====================================================================
# o cavaleiro (placas duras, chanfradas e sobrepostas)
# =====================================================================
TORSO_C = Vector((0.0, 0.125, 1.80))
CABECA_C = Vector((0.0, 0.10, 2.215))


def placa(nome, vfu, M, mat, pai, esp=0.014, chanfro=0.0045, ang=34, fundir=False):
    v, f = vfu[0], vfu[1]
    return malha(nome, v, f, mat, pai=pai, solid=esp, bevel=chanfro, angulo_vivo=ang, fundir=fundir)


def construir_tronco(M, pai):
    obs = []
    c = TORSO_C
    # corpo escuro por dentro (aparece nas frestas)
    v, f, u = casca(c + Vector((0, 0.0, -0.02)), (0, 0, 1), (0.17, 0.13, 0.27), 0.0, math.pi, 12, nph=20)
    obs.append(malha('CorpoInterno', v, f, M['aco_escuro'], pai=pai, fundir=True, recalc=True))
    # couraca: peito alto em quilha, cintura fina
    linhas = [(1.615, 0.152, 0.118, -0.004), (1.68, 0.168, 0.128, -0.012), (1.76, 0.198, 0.148, -0.024),
              (1.85, 0.222, 0.158, -0.03), (1.93, 0.218, 0.152, -0.024), (1.99, 0.19, 0.135, -0.01), (2.035, 0.15, 0.112, 0.0)]
    v, f = faixa((c.x, c.y), linhas, n=36, quilha=0.032, quilha_l=0.085, dorso_plano=0.02)
    obs.append(placa('Couraca', (v, f), M, M['aco'], pai, esp=0.016, chanfro=0.005, ang=30))
    # placa da barriga (plackart) por cima, com borda de cima em ponta
    linhas = [(1.60, 0.162, 0.127, -0.012), (1.66, 0.176, 0.137, -0.02), (1.72, 0.192, 0.148, -0.03)]
    v, f = faixa((c.x, c.y), linhas, n=36, quilha=0.036, quilha_l=0.09)
    # corta as costas: so a frente (metade de -Y)
    keep = set(j for j in range(36) if math.sin(-math.pi / 2 + 2 * math.pi * j / 36) < 0.25)
    f2 = []
    for fa in f:
        js = [i % 36 for i in fa]
        if all(j in keep for j in js):
            f2.append(fa)
    # a borda de cima vira ponta (sobe no meio)
    v = [Vector(p) for p in v]
    for i in range(36):
        x = v[2 * 36 + i].x
        v[2 * 36 + i].z += 0.07 * max(0.0, 1.0 - abs(x) / 0.12)
    obs.append(placa('Placarte', (v, f2), M, M['aco'], pai, esp=0.012, chanfro=0.004, ang=30))
    # fraldao: 3 lames que se abrem para baixo, uma por cima da outra
    for i in range(3):
        z1 = 1.625 - 0.05 * i
        rx = 0.162 + 0.016 * i
        ry = 0.128 + 0.012 * i
        linhas = [(z1 - 0.062, rx * 1.10, ry * 1.08, -0.01), (z1, rx, ry, -0.01)]
        v, f = faixa((c.x, c.y), linhas, n=36, quilha=0.02, quilha_l=0.09)
        obs.append(placa('Fraldao%d' % i, (v, f), M, M['aco'], pai, esp=0.011, chanfro=0.0038, ang=30))
    # cinto de couro com fivela
    pts = [(c.x + 0.168 * math.cos(a), c.y + 0.132 * math.sin(a) - 0.008, 1.632) for a in np.linspace(0, 2 * math.pi, 40, endpoint=False)]
    v, f = anel_fechado(pts, 0.013, 8)
    obs.append(malha('Cinto', v, f, M['couro'], pai=pai, subsurf=1))
    # gorjal: 3 lames em volta do pescoco
    for i in range(3):
        z0 = 2.02 + 0.032 * i
        linhas = [(z0, 0.165 - 0.026 * i, 0.135 - 0.02 * i, 0.0), (z0 + 0.045, 0.118 - 0.022 * i, 0.10 - 0.016 * i, 0.0)]
        v, f = faixa((c.x, c.y - 0.01), linhas, n=32, quilha=0.012, quilha_l=0.06)
        obs.append(placa('Gorjal%d' % i, (v, f), M, M['aco'], pai, esp=0.01, chanfro=0.0035, ang=30))
    return obs


def construir_tabardo(M, pai):
    c = TORSO_C
    nu, nv = 16, 10
    verts = []
    uvs = []
    for i in range(nv + 1):
        t = i / nv
        z = 1.655 - 0.27 * t
        rx = 0.172 + 0.05 * t
        ry = 0.138 + 0.05 * t
        for j in range(nu + 1):
            u = j / nu
            ph = -math.pi / 2 + (u - 0.5) * math.radians(96 - 40 * t)
            dobra = 0.014 * t * math.sin(u * math.pi * 4.0 + 0.6)
            x = (rx + dobra) * math.cos(ph)
            y = c.y + (ry + dobra) * math.sin(ph) - 0.012 - 0.11 * t * t
            verts.append((x, y, z))
            uvs.append((u, t))
    faces = [(i * (nu + 1) + j, (i + 1) * (nu + 1) + j, (i + 1) * (nu + 1) + j + 1, i * (nu + 1) + j + 1) for i in range(nv) for j in range(nu)]
    return malha('Tabardo', verts, faces, M['capa'], pai=pai, subsurf=2, solid=0.008, solid_off=0.0, uvs=uvs)


def facetar(p, ph, n=8):
    """Achata a casca em n faces planas em volta do eixo: placa dura, nao bola."""
    passo = 2 * math.pi / n
    d = ph - round(ph / passo) * passo
    k = math.cos(passo / 2) / math.cos(d)
    return Vector((p.x * k, p.y * k, p.z))


def construir_ombreiras(M, pai):
    """Ombreira grande e redonda, com gravura no aco e ameias na borda (como na pintura)."""
    obs = []
    raios = (0.205, 0.23, 0.13)
    th1 = math.radians(74)
    for sg in (-1, 1):
        lado = 'E' if sg > 0 else 'D'
        origem = Vector((sg * 0.235, 0.125, 1.975))
        A = Vector((sg * 1.0, 0.0, 1.45)).normalized()
        rot = quadro_local(A, (0, 1, 0))

        def crista(p, th, ph):
            # espinha suave de frente para tras: redonda, mas com aresta
            k = max(0.0, 1.0 - abs(p.x) / 0.06)
            return Vector((p.x, p.y, p.z + 0.02 * k * math.sin(th)))
        v, f, u = casca(origem, A, raios, 0.0, th1, 12, nph=40, ref=(0, 1, 0), deform=crista)
        obs.append(malha('Ombreira' + lado, v, f, M['aco'], pai=pai, solid=0.02, bevel=0.006, angulo_vivo=30, fundir=True))

        def ponto(th, ph):
            q = Vector((raios[0] * math.sin(th) * math.cos(ph), raios[1] * math.sin(th) * math.sin(ph), raios[2] * math.cos(th)))
            return origem + rot @ q
        borda, normais, fora = [], [], []
        for j in range(29):
            ph = 2 * math.pi * j / 28
            a, b = ponto(th1, ph), ponto(th1 + 0.06, ph)
            borda.append(a)
            normais.append((a - origem).normalized())
            fora.append((b - a).normalized())
        v, f = anel_fechado(borda[:-1], 0.011, 8, cima=A)
        obs.append(malha('Rolo' + lado, v, f, M['aco'], pai=pai, subsurf=1))
        obs.append(ameias('OmbreiraAmeias' + lado, borda, normais, fora, M, pai, alt=0.045, esp=0.024))
        # guarda do pescoco: placa em pe na beira de dentro da ombreira
        v, f, u = casca(Vector((sg * 0.02, 0.125, 1.99)), (0, 0, 1), (0.24, 0.20, 0.20), math.radians(48), math.radians(70), 3,
                        ph0=(0.0 if sg > 0 else math.pi) - math.radians(48), ph1=(0.0 if sg > 0 else math.pi) + math.radians(48), nph=14,
                        ref=(0, 1, 0))
        obs.append(malha('GuardaPescoco' + lado, v, f, M['aco'], pai=pai, solid=0.014, bevel=0.0045, angulo_vivo=30))
    return obs


def construir_elmo(M, pai):
    obs = []
    c = CABECA_C
    v, f, u = casca(c, (0, 0, 1), (0.09, 0.1, 0.11), 0.0, math.pi, 10, nph=18)
    obs.append(malha('CabecaInterna', v, f, M['aco_escuro'], pai=pai, fundir=True, recalc=True))
    # cranio: de cima ate a fresta dos olhos, com aresta viva no meio da frente
    linhas = []
    for i in range(9):
        t = i / 8
        z = c.z - 0.002 + 0.13 * t
        r = math.sqrt(max(0.0, 1.0 - (t ** 1.6))) if t < 1 else 0.0
        linhas.append((z, 0.112 * r + 0.002, 0.124 * r + 0.002, -0.006 * r))
    v, f = faixa((c.x, c.y), linhas, n=32, quilha=0.034, quilha_l=0.055, dorso_plano=0.012)
    obs.append(placa('Cranio', (v, f), M, M['aco'], pai, esp=0.012, chanfro=0.004, ang=32, fundir=True))
    # viseira de placas empilhadas: tres lames abaixo da fresta, cada uma mais larga e mais para fora
    frente = set(j for j in range(32) if math.sin(-math.pi / 2 + 2 * math.pi * j / 32) < 0.45)
    for k in range(3):
        topo = c.z - 0.026 - 0.036 * k
        linhas = [(topo - 0.04, 0.094 + 0.008 * k, 0.108 + 0.01 * k, -0.012 - 0.008 * k),
                  (topo, 0.108 + 0.008 * k, 0.122 + 0.01 * k, -0.004 - 0.008 * k)]
        v, f = faixa((c.x, c.y), linhas, n=32, quilha=0.026, quilha_l=0.07)
        f = [fa for fa in f if all((i % 32) in frente for i in fa)]
        obs.append(placa('Viseira%d' % k, (v, f), M, M['aco'], pai, esp=0.01, chanfro=0.0035, ang=32))
    # dois olhos brancos acesos na fresta
    for sg in (-1, 1):
        v, f, u = casca((sg * 0.04, c.y - 0.1, c.z - 0.014), (sg * 0.3, -1.0, 0.0), (0.016, 0.011, 0.008), 0.0, math.pi, 6, nph=12)
        obs.append(malha('OlhoElmo' + ('E' if sg > 0 else 'D'), v, f, M['olho_elmo'], pai=pai, fundir=True, recalc=True))
    # espigao no topo
    linhas = [[0, c.y, c.z + 0.118, 0.026, 0.026, 0.026], [0, c.y + 0.004, c.z + 0.17, 0.015, 0.015, 0.015],
              [0, c.y + 0.01, c.z + 0.235, 0.002, 0.002, 0.002]]
    v, f, u = tubo(linhas, 10, 10, lado=(1, 0, 0))
    obs.append(malha('Espigao', v, f, M['aco'], pai=pai, subsurf=1, recalc=True))
    # chifres de touro: saem para o lado e viram para a frente e para cima na ponta
    for sg in (-1, 1):
        pts = [(sg * 0.085, c.y + 0.01, c.z + 0.045), (sg * 0.19, c.y + 0.02, c.z + 0.06), (sg * 0.31, c.y + 0.0, c.z + 0.066),
               (sg * 0.42, c.y - 0.045, c.z + 0.09), (sg * 0.50, c.y - 0.09, c.z + 0.15), (sg * 0.53, c.y - 0.11, c.z + 0.225)]
        raios = [0.05, 0.047, 0.04, 0.03, 0.018, 0.003]
        linhas = [[*p, r, r, r] for p, r in zip(pts, raios)]
        v, f, u = tubo(linhas, 36, 14, lado=(0, 0, 1))
        obs.append(malha('Chifre' + ('E' if sg > 0 else 'D'), v, f, M['chifre'], pai=pai, subsurf=2, uvs=u, recalc=True))
        pts = []
        for j in range(16):
            a = 2 * math.pi * j / 16
            pts.append((sg * 0.118, c.y + 0.02 + 0.05 * math.cos(a), c.z + 0.045 + 0.05 * math.sin(a)))
        v, f = anel_fechado(pts, 0.011, 8, cima=(1, 0, 0))
        obs.append(malha('RaizChifre' + ('E' if sg > 0 else 'D'), v, f, M['aco'], pai=pai, subsurf=1))
    return obs


def braco(nome, M, pai, ombro, cotovelo, pulso, frente=(0, -1, 0)):
    """Braco de placas (o esquerdo, das redeas): lames sobrepostas, cotoveleira, avambraco e manopla com ameias."""
    obs = []
    a, b, c = Vector(ombro), Vector(cotovelo), Vector(pulso)
    # braco de cima: tres lames que descem, cada uma abrindo na borda de baixo
    d = b - a
    for k in range(3):
        t0 = 0.04 + 0.27 * k
        r = 0.066 - 0.004 * k
        linhas = [[*(a + d * t0), r, r, r], [*(a + d * (t0 + 0.33)), r + 0.012, r + 0.012, r + 0.012]]
        v, f, u = tubo(linhas, 4, 16, lado=frente, tampas=(False, False))
        obs.append(malha('%sLame%d' % (nome, k), v, f, M['aco'], pai=pai, solid=0.01, bevel=0.0035, angulo_vivo=30))
    # cotoveleira com aba
    fora = (b - (a + c) / 2).normalized()
    v, f, u = casca(b, fora, (0.08, 0.08, 0.066), 0.0, math.radians(78), 6, nph=24)
    obs.append(malha(nome + 'Cotoveleira', v, f, M['aco'], pai=pai, solid=0.012, bevel=0.004, angulo_vivo=30, fundir=True))
    # avambraco conico
    e = c - b
    dd = e.normalized()
    linhas = [[*(b + e * 0.1), 0.05, 0.05, 0.05], [*(b + e * 0.55), 0.054, 0.054, 0.054], [*(c - dd * 0.05), 0.058, 0.058, 0.058]]
    v, f, u = tubo(linhas, 8, 16, lado=frente, tampas=(False, False))
    obs.append(malha(nome + 'Antebraco', v, f, M['aco'], pai=pai, solid=0.012, bevel=0.004, angulo_vivo=30))
    # punho da manopla: abre para o cotovelo e tem ameias na borda larga (como na pintura)
    linhas = [[*(c + dd * 0.03), 0.058, 0.058, 0.058], [*(c - dd * 0.075), 0.084, 0.084, 0.084]]
    v, f, u = tubo(linhas, 4, 16, lado=frente, tampas=(False, False))
    obs.append(malha(nome + 'Punho', v, f, M['aco'], pai=pai, solid=0.01, bevel=0.0035, angulo_vivo=30))
    rot = quadro_local(-dd, frente)
    aro = c - dd * 0.075
    borda, normais, fora_ = [], [], []
    for j in range(17):
        ang = 2 * math.pi * j / 16
        q = rot @ Vector((math.cos(ang), math.sin(ang), 0.0))
        borda.append(aro + q * 0.084)
        normais.append(q)
        fora_.append(-dd)
    obs.append(ameias(nome + 'PunhoAmeias', borda, normais, fora_, M, pai, alt=0.026, esp=0.014))
    # mao fechada com nos dos dedos marcados
    v, f, u = casca(c + dd * 0.07, dd, (0.05, 0.056, 0.064), 0.0, math.pi, 8, nph=16)
    obs.append(malha(nome + 'Mao', v, f, M['aco_escuro'], pai=pai, fundir=True, recalc=True, subsurf=1))
    lado_ = dd.cross(Vector(frente)).normalized()
    for k in range(3):
        meio = c + dd * (0.075 + 0.022 * k) - Vector(frente) * 0.035
        linhas = [[*(meio - lado_ * 0.045), 0.014, 0.014, 0.014], [*(meio + lado_ * 0.045), 0.014, 0.014, 0.014]]
        v, f, u = tubo(linhas, 4, 10, lado=dd)
        obs.append(malha('%sDedo%d' % (nome, k), v, f, M['aco'], pai=pai, subsurf=1, recalc=True))
    return obs


def construir_braco_esquerdo(M, pai):
    ombro = (0.255, 0.125, 1.95)
    cotovelo = (0.335, 0.03, 1.74)
    pulso = (0.20, -0.17, 1.665)
    obs = braco('BracoE', M, pai, ombro, cotovelo, pulso)
    mao = Vector(pulso) + (Vector(pulso) - Vector(cotovelo)).normalized() * 0.07
    return obs, mao


def construir_braco_direito(M, cav):
    """Braco do cartao: montado pendurado em -Z dentro de pivos (ombro e cotovelo)."""
    ombro = vazio('OmbroD', OMBRO_D, cav)
    obs = []
    for (z0, z1, r0, r1, nm) in ((-0.02, -0.23, 0.064, 0.056, 'Braco'),):
        linhas = [[0, 0, z0, r0, r0, r0], [0, 0, (z0 + z1) / 2, (r0 + r1) / 2, (r0 + r1) / 2, (r0 + r1) / 2], [0, 0, z1, r1, r1, r1]]
        v, f, u = tubo(linhas, 8, 14, lado=(0, -1, 0), tampas=(False, False))
        ob = malha('BracoD' + nm, v, f, M['aco'], solid=0.012, bevel=0.004, angulo_vivo=30)
        ob.parent = ombro
        obs.append(ob)
    cot = vazio('CotoveloD', OMBRO_D + Vector((0, 0, -0.255)), ombro)
    v, f, u = casca(Vector((0, 0, 0)), (0, 1, 0), (0.07, 0.07, 0.06), 0.0, math.radians(75), 6, nph=24)
    ob = malha('BracoDCotoveleira', v, f, M['aco'], solid=0.012, bevel=0.004, angulo_vivo=30, fundir=True)
    ob.parent = cot
    obs.append(ob)
    linhas = [[0, 0, -0.02, 0.054, 0.054, 0.054], [0, 0, -0.11, 0.05, 0.05, 0.05], [0, 0, -0.2, 0.046, 0.046, 0.046]]
    v, f, u = tubo(linhas, 8, 14, lado=(0, -1, 0), tampas=(False, False))
    ob = malha('BracoDAntebraco', v, f, M['aco'], solid=0.012, bevel=0.004, angulo_vivo=30)
    ob.parent = cot
    obs.append(ob)
    linhas = [[0, 0, -0.18, 0.05, 0.05, 0.05], [0, 0, -0.245, 0.068, 0.068, 0.068]]
    v, f, u = tubo(linhas, 4, 16, lado=(0, -1, 0), tampas=(False, False))
    ob = malha('BracoDPunho', v, f, M['aco'], solid=0.01, bevel=0.0035, angulo_vivo=30)
    ob.parent = cot
    obs.append(ob)
    v, f, u = casca(Vector((0, -0.005, -0.285)), (0, 0, -1), (0.048, 0.052, 0.06), 0.0, math.pi, 8, nph=16)
    ob = malha('BracoDMao', v, f, M['aco_escuro'], fundir=True, recalc=True, subsurf=1)
    ob.parent = cot
    obs.append(ob)
    # cartao vermelho pequeno entre os dedos, um pouco girado para aparecer de lado tambem
    w, h, e = 0.055, 0.08, 0.0035
    cz = -0.36
    pts = [(-w, -e, cz - h), (w, -e, cz - h), (w, e, cz - h), (-w, e, cz - h), (-w, -e, cz + h), (w, -e, cz + h), (w, e, cz + h), (-w, e, cz + h)]
    fs = [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
    giro = Matrix.Rotation(math.radians(38), 4, 'Z')
    pts = [giro @ Vector(p) for p in pts]
    cartao = malha('Cartao', pts, fs, M['cartao'], bevel=0.0012, recalc=True)
    cartao.parent = cot
    v, f, u = casca(Vector((0, 0, cz)), (0, 0, 1), (0.085, 0.085, 0.085), 0.0, math.pi, 12, nph=20)
    halo = malha('Halo', v, f, M['halo'], fundir=True, recalc=True, vis_sombra=False)
    halo.parent = cot
    for attr in ('visible_diffuse', 'visible_glossy', 'visible_transmission'):
        try:
            setattr(halo, attr, False)
        except Exception:
            pass
    luz = bpy.data.lights.new('LuzCartao', 'POINT')
    luz.color = (1.0, 0.12, 0.06)
    luz.energy = 2.0
    luz.shadow_soft_size = 0.03
    lo = bpy.data.objects.new('LuzCartao', luz)
    _colecao().objects.link(lo)
    lo.parent = cot
    lo.location = (0.0, -0.03, cz)
    return ombro, cot, obs


def construir_pernas_cavaleiro(M, pai):
    obs = []
    for sg in (-1, 1):
        lado = 'E' if sg > 0 else 'D'
        quadril = Vector((sg * 0.125, 0.09, 1.53))
        joelho = Vector((sg * 0.445, -0.10, 1.35))
        tornoz = Vector((sg * 0.525, -0.03, 1.035))
        for (a, b, r0, r1, nm) in ((quadril, joelho, 0.085, 0.066, 'Coxote'), (joelho, tornoz, 0.058, 0.047, 'Greva')):
            d = b - a
            linhas = [[*(a + d * 0.02), r0, r0, r0], [*(a + d * 0.5), (r0 + r1) / 2, (r0 + r1) / 2, (r0 + r1) / 2], [*(b - d * 0.03), r1, r1, r1]]
            v, f, u = tubo(linhas, 8, 14, lado=(0, -1, 0.3), tampas=(False, False))
            obs.append(malha(nm + lado, v, f, M['aco'], pai=pai, solid=0.012, bevel=0.004, angulo_vivo=30))
        fora = Vector((sg * 0.5, -1.0, 0.25)).normalized()
        v, f, u = casca(joelho, fora, (0.072, 0.072, 0.07), 0.0, math.radians(78), 6, nph=24)
        obs.append(malha('Joelheira' + lado, v, f, M['aco'], pai=pai, solid=0.012, bevel=0.004, angulo_vivo=30, fundir=True))
        # escarpe: lames ate a ponta
        linhas = [[*tornoz, 0.05, 0.045, 0.04], [*(tornoz + Vector((sg * 0.004, -0.085, -0.03))), 0.046, 0.036, 0.03],
                  [*(tornoz + Vector((sg * 0.008, -0.17, -0.035))), 0.012, 0.01, 0.01]]
        v, f, u = tubo(linhas, 14, 12, lado=(1, 0, 0))
        obs.append(malha('Escarpe' + lado, v, f, M['aco'], pai=pai, subsurf=1, bevel=0.003, angulo_vivo=35, recalc=True))
    return obs


# =====================================================================
# a capa (malha procedural com dobras; refeita a cada quadro)
# =====================================================================
CAPA_NU = 44
CAPA_NV = 46


def _capa_centro(v, fase, vento):
    pts = np.array([
        [0.0, 0.25, 2.03],
        [0.0, 0.34, 1.84],
        [0.0, 0.46, 1.64],
        [0.0, 0.62, 1.50],
        [0.0, 0.80, 1.40],
        [0.0, 0.97, 1.25],
        [0.0, 1.08, 1.07],
        [0.0, 1.14, 0.90],
    ])
    s = v * (len(pts) - 1)
    i = min(int(s), len(pts) - 2)
    t = s - i
    p0 = pts[max(i - 1, 0)]
    p1 = pts[i]
    p2 = pts[i + 1]
    p3 = pts[min(i + 2, len(pts) - 1)]
    c = 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3)
    onda = math.sin(2 * math.pi * (1.15 * v - fase))
    c[1] += vento * (0.16 * max(0.0, v - 0.45) ** 1.6 + 0.02 * v * v * onda)
    c[2] += vento * (0.05 * max(0.0, v - 0.6) + 0.012 * v * v * math.cos(2 * math.pi * (1.15 * v - fase)))
    c[0] += -0.16 * max(0.0, v - 0.35) ** 1.8 * vento
    return np.array(c)


def capa_vertices(fase=0.0, vento=1.0):
    verts = []
    uvs = []
    for i in range(CAPA_NV + 1):
        v = i / CAPA_NV
        C = _capa_centro(v, fase, vento)
        C2 = _capa_centro(min(1.0, v + 0.01), fase, vento)
        C1 = _capa_centro(max(0.0, v - 0.01), fase, vento)
        T = C2 - C1
        T /= np.linalg.norm(T)
        X = np.array([1.0, 0.0, 0.0])
        D = np.cross(X, T)
        D /= np.linalg.norm(D)
        largura = 0.44 + 1.05 * (v ** 0.85)
        theta = 2.5 - 0.45 * min(1.0, v / 0.35) + 1.0 * max(0.0, v - 0.45)
        R = largura / theta
        amp = 0.005 + 0.095 * v ** 1.2
        for j in range(CAPA_NU + 1):
            u = j / CAPA_NU
            a = (u - 0.5) * theta
            nrm = math.sin(a) * X + math.cos(a) * D
            p = C + R * math.sin(a) * X + R * (math.cos(a) - 1.0) * D
            # dobras: juntas no ombro, abertas embaixo; perfil meio vivo
            fd = (0.62 * math.sin(2 * math.pi * 4.5 * u + 0.6 + 2.2 * v + 0.35 * math.sin(2 * math.pi * fase))
                  + 0.30 * math.sin(2 * math.pi * 8.0 * u + 1.9 - 2.6 * v)
                  + 0.14 * math.sin(2 * math.pi * 13.0 * u + 3.0 * v + 0.5 * math.cos(2 * math.pi * fase)))
            fd = math.copysign(abs(fd) ** 0.62, fd)
            p = p + amp * fd * nrm
            # barra pesada: a beirada de baixo pende um pouco
            p[2] -= 0.03 * max(0.0, v - 0.9) * (1.0 - 4 * (u - 0.5) ** 2)
            verts.append(p)
            uvs.append((u, v))
    return verts, uvs


def construir_capa(M, pai):
    verts, uvs = capa_vertices(0.0)
    nu = CAPA_NU + 1
    faces = [(i * nu + j, (i + 1) * nu + j, (i + 1) * nu + j + 1, i * nu + j + 1) for i in range(CAPA_NV) for j in range(CAPA_NU)]
    return malha('Capa', verts, faces, M['capa'], pai=pai, subsurf=2, solid=0.013, solid_off=0.0, uvs=uvs)


# =====================================================================
# luz, mundo e cameras
# =====================================================================
def construir_mundo(scene):
    w = bpy.data.worlds.new('Mundo')
    scene.world = w
    nt = _nos(w)
    out = N(nt, 'ShaderNodeOutputWorld')
    bg = N(nt, 'ShaderNodeBackground')
    bg.name = 'Fundo'
    tc = N(nt, 'ShaderNodeTexCoord')
    sep = N(nt, 'ShaderNodeSeparateXYZ')
    L(nt, tc.outputs['Generated'], sep.inputs['Vector'])
    mr = N(nt, 'ShaderNodeMapRange')
    E(mr, 'From Min', -1.0)
    E(mr, 'From Max', 1.0)
    L(nt, sep.outputs['Z'], mr.inputs['Value'])
    cor = rampa(nt, mr.outputs['Result'], [(0.0, (0.05, 0.05, 0.07)), (0.44, (0.08, 0.08, 0.11)), (0.5, (0.2, 0.2, 0.3)),
                                           (0.62, (0.38, 0.4, 0.6)), (1.0, (0.6, 0.64, 0.95))])
    L(nt, cor, bg.inputs['Color'])
    E(bg, 'Strength', 0.6)
    L(nt, bg.outputs['Background'], out.inputs['Surface'])


def _luz(nome, tipo, energia, cor, pai, pos, alvo=(0, 0, 1.4), tamanho=1.0, sombra=True, angulo=None):
    l_ = bpy.data.lights.new(nome, tipo)
    l_.energy = energia
    l_.color = cor
    if tipo == 'AREA':
        l_.shape = 'DISK'
        l_.size = tamanho
    if tipo == 'SUN' and angulo is not None:
        l_.angle = angulo
    try:
        l_.use_shadow = sombra
    except Exception:
        pass
    ob = bpy.data.objects.new(nome, l_)
    _colecao().objects.link(ob)
    ob.parent = pai
    d = Vector(alvo) - Vector(pos)
    ob.matrix_world = Matrix.Translation(Vector(pos)) @ d.to_track_quat('-Z', 'Y').to_matrix().to_4x4()
    return ob


def construir_luzes(rig):
    """Luzes presas ao suporte da camera: a luz fica igual em toda direcao da folha."""
    _luz('Chave', 'SUN', 3.4, (0.95, 0.94, 1.0), rig, (-1.4, -2.2, 6.0), alvo=(0, 0, 0), angulo=math.radians(8))
    _luz('Contorno', 'AREA', 1500.0, (0.48, 0.66, 1.0), rig, (1.9, 3.1, 3.3), tamanho=2.2, sombra=False)
    _luz('Contorno2', 'AREA', 850.0, (0.40, 0.60, 1.0), rig, (-2.4, 2.6, 1.9), tamanho=1.8, sombra=False)
    _luz('Preenche', 'AREA', 90.0, (1.0, 0.70, 0.48), rig, (2.3, -2.7, 0.9), tamanho=2.4, sombra=False)


def _mirar(ob, pos, alvo=(0.0, 0.0, 1.4)):
    """Reposiciona uma luz no espaco do suporte (a camera fica sempre em -Y)."""
    d = Vector(alvo) - Vector(pos)
    ob.matrix_basis = Matrix.Translation(Vector(pos)) @ d.to_track_quat('-Z', 'Y').to_matrix().to_4x4()


def preparar_heroi(scene):
    """Camera do heroi + luzes giradas com ela (o suporte fica com a camera sempre em -Y)."""
    cam = bpy.data.objects['CamHeroi']
    scene.camera = cam
    bpy.data.objects['ChaoSombra'].hide_render = True
    pos = cam.matrix_world.translation
    bpy.data.objects['Suporte'].rotation_euler = (0.0, 0.0, math.atan2(pos.y, pos.x) + math.pi / 2)
    luz_heroi(scene)


def luz_heroi(scene):
    """Chave de lado e por tras, contorno frio, calor fraco na frente. Lado trocado: a imagem e espelhada depois."""
    ob = bpy.data.objects
    _mirar(ob['Chave'], (4.2, 1.4, 4.6), (0.0, 0.0, 0.0))
    _mirar(ob['Contorno'], (-1.9, 3.1, 3.3))
    _mirar(ob['Contorno2'], (2.4, 2.6, 1.9))
    _mirar(ob['Preenche'], (-2.3, -2.7, 0.9))
    ob['Chave'].data.energy = 3.4
    ob['Contorno'].data.energy = 2000.0
    ob['Contorno2'].data.energy = 1200.0
    ob['Preenche'].data.energy = 130.0
    scene.world.node_tree.nodes['Fundo'].inputs['Strength'].default_value = 0.34


def construir_cameras(scene, rig):
    cam = bpy.data.cameras.new('CamFolha')
    cam.type = 'ORTHO'
    cam.sensor_fit = 'VERTICAL'
    cam.ortho_scale = QUADRO_A
    cam.clip_start = 0.1
    cam.clip_end = 60.0
    ob = bpy.data.objects.new('CamFolha', cam)
    _colecao().objects.link(ob)
    ob.parent = rig
    olhar = Vector((0.0, math.cos(ELEVACAO), -math.sin(ELEVACAO)))
    cima = Vector((0.0, math.sin(ELEVACAO), math.cos(ELEVACAO)))
    alvo = cima * (QUADRO_A / 2 - QUADRO_BASE)
    ob.location = alvo - olhar * 20.0
    ob.rotation_euler = (math.pi / 2 - ELEVACAO, 0.0, 0.0)
    camh = bpy.data.cameras.new('CamHeroi')
    camh.lens = 52.0
    camh.sensor_fit = 'VERTICAL'
    camh.sensor_height = 30.0
    obh = bpy.data.objects.new('CamHeroi', camh)
    _colecao().objects.link(obh)
    # pelo lado esquerdo e de baixo; montar_heroi.py espelha a imagem para ficar como a pintura
    pos = Vector((4.7, -3.5, 0.78))
    alvo = Vector((0.0, 0.18, 1.47))
    obh.matrix_world = Matrix.Translation(pos) @ (alvo - pos).to_track_quat('-Z', 'Y').to_matrix().to_4x4()
    scene.camera = ob
    return ob, obh


def chao_sombra(M):
    v = [(-3.0, -3.0, 0.0), (3.0, -3.0, 0.0), (3.0, 3.0, 0.0), (-3.0, 3.0, 0.0)]
    ob = malha('ChaoSombra', v, [(0, 1, 2, 3)], M['sombra'])
    ob.is_shadow_catcher = True
    return ob


# =====================================================================
# montar tudo e posar
# =====================================================================
def construir_tudo():
    global _COL, _MAT
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    _COL = bpy.data.collections.new('Judge')
    scene.collection.children.link(_COL)
    M = materiais()
    _MAT = M
    raiz = vazio('Raiz')
    corpo = vazio('CorpoPivo', (0.0, 0.05, 0.78), raiz)
    corpo_ob = construir_corpo_ave(M, corpo)
    construir_peitoral_ave(M, corpo, corpo_ob)
    construir_pernas_ave(M, raiz)
    construir_asas(M, corpo)
    construir_cauda(M, corpo)
    cab = vazio('CabecaPivo', CABECA_AVE, corpo)
    construir_cabeca_ave(M, cab)
    cav = vazio('Cavaleiro', (0.0, 0.13, 1.47), corpo)
    construir_sela(M, corpo, cav)
    construir_tronco(M, cav)
    construir_ombreiras(M, cav)
    construir_tabardo(M, cav)
    construir_elmo(M, cav)
    obs, mao = construir_braco_esquerdo(M, cav)
    construir_braco_direito(M, cav)
    construir_pernas_cavaleiro(M, cav)
    capa = construir_capa(M, corpo)
    chao_sombra(M)
    cav.scale = (ESCALA_CAVALEIRO,) * 3
    cab.location = cab.location + DESLOCA_CABECA
    cab.scale = (ESCALA_CABECA,) * 3
    bpy.context.view_layer.update()
    # a capa passa a seguir o cavaleiro (ele fica em pe quando a ave empina)
    capa.parent = cav
    capa.matrix_parent_inverse = cav.matrix_world.inverted()
    # salto: a ave empina o peito; o cavaleiro compensa e fica quase em pe
    raiz.rotation_euler = (-SALTO_INCLINA, 0.0, 0.0)
    raiz.location = SALTO_DESLOCA
    cav.rotation_euler = (SALTO_INCLINA + INCLINA_CAVALEIRO, 0.0, 0.0)
    bpy.context.view_layer.update()
    construir_redeas(M, corpo, cav.matrix_world @ (mao - ORIGEM_CAV), cab)
    rig = vazio('Suporte')
    construir_luzes(rig)
    construir_cameras(scene, rig)
    construir_mundo(scene)
    posar(0.0, 0.0)
    return scene


def _suave(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def posar(respiro=0.0, cartao=0.0, vento=1.0):
    """respiro: fase 0..1 do ciclo parado. cartao: 0 (baixo) a 1 (erguido)."""
    ob = bpy.data.objects
    b = math.sin(2 * math.pi * respiro)
    corpo = ob['CorpoPivo']
    corpo.scale = (1.0 + 0.008 * b, 1.0, 1.0 + 0.013 * b)
    ob['Cavaleiro'].location.z += 0.0  # o cavaleiro sobe junto com o corpo da ave
    for nome, sg in (('AsaPivoE', 1), ('AsaPivoD', -1)):
        ob[nome].rotation_euler = (0.0, -sg * math.radians(2.6) * b, 0.0)
    # capa: onda que corre para tras
    me = ob['Capa'].data
    verts, _ = capa_vertices(respiro, vento)
    me.vertices.foreach_set('co', np.asarray(verts, dtype=np.float32).ravel())
    me.update()
    # braco do cartao
    k = _suave(cartao)
    pd, pe = POSE_DESCANSO, POSE_ERGUIDO
    flex = pd['flexao'] + (pe['flexao'] - pd['flexao']) * k
    abd = pd['abducao'] + (pe['abducao'] - pd['abducao']) * k
    cot = pd['cotovelo'] + (pe['cotovelo'] - pd['cotovelo']) * k + 0.75 * math.sin(math.pi * k)
    ob['OmbroD'].rotation_euler = (-flex, abd, 0.0)
    ob['CotoveloD'].rotation_euler = (-cot, 0.0, 0.0)
    brilho = 0.35 + 0.65 * k
    mc = bpy.data.materials['Cartao'].node_tree.nodes['Cartao']
    mc.inputs['Emission Strength'].default_value = 1.6 + 2.6 * brilho
    bpy.data.materials['Halo'].node_tree.nodes['Halo'].inputs['Strength'].default_value = 0.2 + 0.8 * k
    ob['Halo'].scale = (0.55 + 0.45 * k,) * 3
    bpy.data.lights['LuzCartao'].energy = 0.8 + 5.0 * k


def usar_gpu(scene):
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
    except Exception:
        scene.cycles.device = 'CPU'
        return 'CPU'
    for tipo in ('OPTIX', 'CUDA'):
        try:
            prefs.compute_device_type = tipo
            prefs.get_devices()
            achou = False
            for d in prefs.devices:
                d.use = (d.type == tipo)
                achou = achou or d.use
            if achou:
                scene.cycles.device = 'GPU'
                return tipo
        except Exception:
            continue
    scene.cycles.device = 'CPU'
    return 'CPU'


def config_render(scene, largura, altura, amostras, transparente=True):
    scene.render.engine = 'CYCLES'
    disp = usar_gpu(scene)
    c = scene.cycles
    c.samples = amostras
    c.use_adaptive_sampling = True
    c.adaptive_threshold = 0.015
    c.use_denoising = True
    for nome, valor in (('denoiser', 'OPENIMAGEDENOISE'), ('denoising_use_gpu', True), ('denoising_prefilter', 'ACCURATE')):
        try:
            setattr(c, nome, valor)
        except Exception:
            pass
    c.max_bounces = 8
    c.diffuse_bounces = 3
    c.glossy_bounces = 4
    c.transmission_bounces = 2
    c.transparent_max_bounces = 24
    c.volume_bounces = 0
    c.caustics_reflective = False
    c.caustics_refractive = False
    c.sample_clamp_indirect = 6.0
    c.pixel_filter_type = 'BLACKMAN_HARRIS'
    c.filter_width = 1.5
    try:
        scene.cycles_curves.shape = 'THICK'
        scene.cycles_curves.subdivisions = 2
    except Exception:
        pass
    r = scene.render
    r.resolution_x = largura
    r.resolution_y = altura
    r.resolution_percentage = 100
    r.film_transparent = transparente
    r.use_persistent_data = True
    r.image_settings.file_format = 'PNG'
    r.image_settings.color_mode = 'RGBA'
    r.image_settings.color_depth = '8'
    r.image_settings.compression = 15
    vs = scene.view_settings
    vs.view_transform = 'AgX'
    for look in ('AgX - Medium High Contrast', 'Medium High Contrast', 'AgX - Punchy', 'Punchy'):
        try:
            vs.look = look
            break
        except Exception:
            pass
    return disp


def apontar_suporte(direcao):
    """Gira camera + luzes em volta do modelo. direcao 0 = sul (de frente), 2 = leste, 4 = norte."""
    bpy.data.objects['Suporte'].rotation_euler = (0.0, 0.0, -direcao * math.pi / 4)
