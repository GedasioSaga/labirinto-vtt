# Renderiza o Judge a partir do judge.blend, fora da janela do Blender (linha de comando).
#
# Uso (na pasta fonte/):
#   blender -b judge.blend --python render_judge.py -- heroi folha webp --tmp <pasta-temporaria>
# Modos: "limpar" (so na primeira vez: tira o que sobrou da sessao e salva judge.blend),
#        "heroi" (imagem grande 1200x1500), "folha" (folha do app: 8 direcoes x 20 quadros),
#        "webp" (copia leve da folha em WebP, a partir do PNG).
import json
import os
import sys
from math import radians

import bpy
import numpy as np
from mathutils import Quaternion, Vector

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['heroi', 'folha']
AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.dirname(AQUI)
TMP = ARGS[ARGS.index('--tmp') + 1] if '--tmp' in ARGS else os.path.join(SAIDA, '_quadros')
cena = bpy.data.scenes['Judge']
OB = bpy.data.objects

DIRECOES = ['sul', 'sudeste', 'leste', 'nordeste', 'norte', 'noroeste', 'oeste', 'sudoeste']
QW, QH, PX_QUADRADO, ORIGEM_ACIMA = 192, 240, 64, 0.62
FUNDO_HEROI = [(0.0, (0.64, 0.62, 0.78)), (0.5, (0.50, 0.53, 0.72)), (1.0, (0.33, 0.39, 0.62))]
# heroi: luz de recorte fria e forte atras (contorno azul no metal); o ceu cai para o metal nao lavar o contorno
HDRI_HEROI = 0.28
CONTORNO_HEROI = (14000, 8000)
COR_CONTORNO, COR_CONTORNO2 = (0.30, 0.50, 1.0), (0.34, 0.54, 1.0)
SEM_CONTORNO_HEROI = ['JA_cauda']
METAIS = ('JM_m_aco', 'JJ_m_aco')   # aco liso, aco gravado e aco escuro
# no reflexo do metal conta o brilho por area: area grande pede muita potencia (so o aco recebe esta luz)
LUZ_METAL = {'pos': (3.6, 5.9, 3.0), 'alvo': (0.0, -0.08, 1.75), 'tam': (3.0, 3.0), 'w': 320000, 'cor': (0.07, 0.25, 1.0),
             'sem_sombra': ['JC_capa', 'JC_capa_gola', 'JA_cauda', 'JA_crista']}


def ligar_gpu():
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for tipo in ('OPTIX', 'CUDA'):
        try:
            prefs.compute_device_type = tipo
        except TypeError:
            continue
        prefs.get_devices()
        if any(d.type == tipo for d in prefs.devices):
            for d in prefs.devices:
                d.use = d.type == tipo
            cena.cycles.device = 'GPU'
            print('GPU', tipo)
            return
    cena.cycles.device = 'CPU'
    print('sem GPU, usando CPU')


def limpar():
    for s in [s for s in bpy.data.scenes if s.name != 'Judge']:
        bpy.data.scenes.remove(s)
    for nome in ('metal_plate_02', 'denim_fabric_05', 'leather_red_02'):
        m = bpy.data.materials.get(nome)
        if m and m.users == 0:
            bpy.data.materials.remove(m)
    bpy.data.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)
    cena.camera = OB['JG_cam_folha']
    cena.frame_set(20)
    caminho = os.path.join(AQUI, 'judge.blend')
    bpy.context.preferences.filepaths.save_version = 0  # sem judge.blend1 de copia
    bpy.ops.wm.save_as_mainfile(filepath=caminho, compress=True)
    print('limpo e salvo', caminho, os.path.getsize(caminho) // 1024, 'KB')


def hdri(forca):
    nt = cena.world.node_tree
    for n in nt.nodes:
        if n.type == 'BACKGROUND' and n.inputs['Color'].is_linked and n.inputs['Color'].links[0].from_node.type == 'TEX_ENVIRONMENT':
            n.inputs['Strength'].default_value = forca


def luzes(chave, contorno, contorno2, preenche):
    for nome, w in (('JL_chave', chave), ('JL_contorno', contorno), ('JL_contorno2', contorno2), ('JL_preenche', preenche)):
        OB[nome].data.energy = w


def comum(amostras):
    r = cena.render
    r.engine = 'CYCLES'
    r.resolution_percentage = 100
    r.use_persistent_data = True
    r.image_settings.file_format = 'PNG'
    cena.cycles.samples = amostras
    cena.cycles.use_adaptive_sampling = True
    cena.cycles.use_denoising = True


def brilho_olhos(ligado):
    """Brilho dos olhos do juiz: so na folha (a 64 px o olho tem 2-3 px); no heroi os olhos ja leem pelo tamanho."""
    for lado in ('E', 'D'):
        o = OB.get('JE_brilho_olho' + lado)
        if o is not None:
            o.hide_render = not ligado
            if ligado and o.constraints:
                o.constraints[0].target = OB['JG_cam_folha']


def nevoa_heroi():
    """Fundo lavanda enevoado (so o raio de camera): manchas grandes e macias de ruido clareando o degrade."""
    nt = cena.world.node_tree
    if nt.nodes.get('Nevoa_mistura'):
        return
    rp = next(n for n in nt.nodes if n.type == 'VALTORGB' and not n.name.startswith('Nevoa'))
    fundo = rp.outputs['Color'].links[0].to_socket
    tc = next(n for n in nt.nodes if n.type == 'TEX_COORD' and n.outputs['Window'].is_linked)
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (1.0, 1.25, 1.0)
    mp.inputs['Location'].default_value = (0.37, 0.11, 0.0)
    nt.links.new(tc.outputs['Window'], mp.inputs['Vector'])
    ru = nt.nodes.new('ShaderNodeTexNoise')
    ru.inputs['Scale'].default_value = 1.7
    ru.inputs['Detail'].default_value = 5.0
    ru.inputs['Roughness'].default_value = 0.58
    ru.inputs['Distortion'].default_value = 0.35
    nt.links.new(mp.outputs['Vector'], ru.inputs['Vector'])
    rm = nt.nodes.new('ShaderNodeValToRGB')
    rm.name = 'Nevoa_rampa'
    rm.color_ramp.elements[0].position, rm.color_ramp.elements[0].color = 0.40, (0, 0, 0, 1)
    rm.color_ramp.elements[1].position, rm.color_ramp.elements[1].color = 0.70, (1, 1, 1, 1)
    nt.links.new(ru.outputs['Fac'], rm.inputs['Fac'])
    fat = nt.nodes.new('ShaderNodeMath')
    fat.operation = 'MULTIPLY'
    fat.inputs[1].default_value = 0.55
    nt.links.new(rm.outputs['Color'], fat.inputs[0])
    mx = nt.nodes.new('ShaderNodeMix')
    mx.name = 'Nevoa_mistura'
    mx.data_type = 'RGBA'
    mx.blend_type = 'SCREEN'
    mx.inputs['B'].default_value = (0.78, 0.76, 0.92, 1)
    nt.links.new(fat.outputs[0], mx.inputs['Factor'])
    nt.links.new(rp.outputs['Color'], mx.inputs['A'])
    nt.links.new(mx.outputs['Result'], fundo)


def sem_contorno(nomes):
    """Light linking: as luzes de recorte nao acendem estes objetos (a cauda fica larga e de frente para elas e
    estourava em branco). Devolve uma funcao que desfaz (a folha, se vier depois, usa a luz do arquivo)."""
    c = bpy.data.collections.new('JL_sem_contorno')
    for nm in nomes:
        if OB.get(nm) is not None:
            c.objects.link(OB[nm])
    for co in c.collection_objects:
        co.light_linking.link_state = 'EXCLUDE'
    antes = {nm: OB[nm].light_linking.receiver_collection for nm in ('JL_contorno', 'JL_contorno2')}
    for nm in antes:
        OB[nm].light_linking.receiver_collection = c

    def desfazer():
        for nm, rc in antes.items():
            OB[nm].light_linking.receiver_collection = rc
        bpy.data.collections.remove(c)
    return desfazer


def luz_metal():
    """Recorte azul FORTE so no metal (light linking): area grande atras e a esquerda da camera do heroi; o reflexo
    dela vira uma faixa azul no lado esquerdo de cada peca de aco. Penas, capa e cauda nao recebem esta luz.
    Criada so no processo do render (o arquivo nao muda). Devolve uma funcao que desfaz."""
    c = bpy.data.collections.new('JL_so_metal')
    for o in cena.objects:
        if o.type == 'MESH' and any(m and m.name.startswith(METAIS) for m in o.data.materials):
            c.objects.link(o)
    ld = bpy.data.lights.new('JL_contorno_metal', 'AREA')
    ld.shape, ld.size = 'RECTANGLE', LUZ_METAL['tam'][0]
    ld.size_y = LUZ_METAL['tam'][1]
    ld.energy, ld.color = LUZ_METAL['w'], LUZ_METAL['cor']
    lo = bpy.data.objects.new('JL_contorno_metal', ld)
    cena.collection.objects.link(lo)
    lo.location = LUZ_METAL['pos']
    lo.rotation_mode = 'QUATERNION'
    lo.rotation_quaternion = (Vector(LUZ_METAL['alvo']) - lo.location).to_track_quat('-Z', 'Y')
    lo.light_linking.receiver_collection = c
    # a capa (e a cauda e a crista) nao fazem sombra desta luz: senao a capa, que cai atras do cavaleiro, apaga o recorte
    b = bpy.data.collections.new('JL_metal_sem_sombra')
    for nm in LUZ_METAL['sem_sombra']:
        if OB.get(nm) is not None:
            b.objects.link(OB[nm])
    for co in b.collection_objects:
        co.light_linking.link_state = 'EXCLUDE'
    lo.light_linking.blocker_collection = b
    print('luz do metal: pecas de aco', len(c.objects), '| sem sombra', len(b.objects))

    def desfazer():
        bpy.data.objects.remove(lo, do_unlink=True)
        bpy.data.lights.remove(ld)
        bpy.data.collections.remove(c)
        bpy.data.collections.remove(b)
    return desfazer


def heroi():
    comum(160)
    r = cena.render
    r.film_transparent = False
    r.resolution_x, r.resolution_y = 1200, 1500
    r.image_settings.color_mode = 'RGB'
    rp = next(n for n in cena.world.node_tree.nodes if n.type == 'VALTORGB')
    for e, (pos, cor) in zip(rp.color_ramp.elements, FUNDO_HEROI):
        e.position = pos
        e.color = (*cor, 1)
    nevoa_heroi()
    # contorno azul forte no metal: ceu mais fraco e as duas luzes de recorte (atras) bem mais fortes e mais azuis
    hdri(HDRI_HEROI)
    luzes(520, *CONTORNO_HEROI, 120)
    cores = {nm: tuple(OB[nm].data.color) for nm in ('JL_contorno', 'JL_contorno2')}
    OB['JL_contorno'].data.color = COR_CONTORNO
    OB['JL_contorno2'].data.color = COR_CONTORNO2
    desfazer_ligacao = sem_contorno(SEM_CONTORNO_HEROI)
    desfazer_metal = luz_metal()
    brilho_olhos(False)
    OB['JK_halo'].constraints[0].target = OB['JG_cam_heroi']
    OB['JP_raiz'].rotation_quaternion = (1, 0, 0, 0)
    cena.camera = OB['JG_cam_heroi']
    cena.frame_set(20)
    r.filepath = os.path.join(SAIDA, 'judge-heroi.png')
    bpy.ops.render.render(write_still=True, scene=cena.name)
    for nm, cor in cores.items():   # a folha (se vier depois no mesmo processo) usa as cores do arquivo
        OB[nm].data.color = cor
    desfazer_ligacao()
    desfazer_metal()
    print('heroi salvo', r.filepath)


def folha():
    comum(64)
    r = cena.render
    r.film_transparent = True
    r.resolution_x, r.resolution_y = QW, QH
    r.image_settings.color_mode = 'RGBA'
    hdri(0.6)
    luzes(700, 2600, 1500, 140)
    brilho_olhos(True)
    OB['JK_halo'].constraints[0].target = OB['JG_cam_folha']
    cena.camera = OB['JG_cam_folha']
    os.makedirs(TMP, exist_ok=True)
    n_col = cena.frame_end - cena.frame_start + 1
    grande = np.zeros((QH * len(DIRECOES), QW * n_col, 4), dtype=np.float32)
    raiz = OB['JP_raiz']
    for d, nome in enumerate(DIRECOES):
        # gira o modelo (a camera e as luzes ficam paradas); 45 graus anti-horario visto de cima
        raiz.rotation_quaternion = Quaternion((0, 0, 1), radians(45 * d))
        for k in range(n_col):
            cena.frame_set(cena.frame_start + k)
            arq = os.path.join(TMP, '%s_%02d.png' % (nome, k))
            r.filepath = arq
            bpy.ops.render.render(write_still=True, scene=cena.name)
            img = bpy.data.images.load(arq)
            px = np.array(img.pixels[:], dtype=np.float32).reshape(QH, QW, 4)
            bpy.data.images.remove(img)
            y0 = (len(DIRECOES) - 1 - d) * QH
            grande[y0:y0 + QH, k * QW:(k + 1) * QW] = px
        print('direcao pronta', nome, flush=True)
    raiz.rotation_quaternion = (1, 0, 0, 0)
    H, W = grande.shape[:2]
    img = bpy.data.images.new('judge_folha', W, H, alpha=True)
    img.pixels.foreach_set(grande.ravel())
    caminho = os.path.join(SAIDA, 'judge-folha.png')
    img.filepath_raw = caminho
    img.file_format = 'PNG'
    img.save()
    meta = {
        'imagem': 'judge-folha.png',
        'quadro_px': [QW, QH],
        'pixels_por_quadrado': PX_QUADRADO,
        'origem_no_quadro_px': [QW / 2, round(QH - ORIGEM_ACIMA * PX_QUADRADO, 1)],
        'linhas_direcoes': DIRECOES,
        'colunas': n_col,
        'animacoes': {
            'respiracao': {'colunas': list(range(0, 12)), 'laco': True, 'fps': 12},
            'erguer_carta': {'colunas': list(range(12, 20)), 'laco': False, 'fps': 12},
        },
        'camera': 'ortografica, 30 graus acima, 3,75 quadrados de altura por quadro',
    }
    with open(os.path.join(SAIDA, 'judge-folha.json'), 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    print('folha salva', caminho, os.path.getsize(caminho) // 1024, 'KB')


def webp():
    """Copia leve da folha em WebP (qualidade 90, com transparencia) para o app."""
    img = bpy.data.images.load(os.path.join(SAIDA, 'judge-folha.png'))
    vs = cena.view_settings
    vs.view_transform, vs.look, vs.exposure = 'Standard', 'None', 0.0  # o PNG ja tem a cor final
    st = cena.render.image_settings
    st.file_format, st.color_mode, st.quality = 'WEBP', 'RGBA', 90
    caminho = os.path.join(SAIDA, 'judge-folha.webp')
    img.save_render(caminho, scene=cena)
    print('webp salvo', caminho, os.path.getsize(caminho) // 1024, 'KB')


ligar_gpu()
if 'limpar' in ARGS:
    limpar()
if 'heroi' in ARGS:
    heroi()
if 'folha' in ARGS:
    folha()
if 'webp' in ARGS:
    webp()
