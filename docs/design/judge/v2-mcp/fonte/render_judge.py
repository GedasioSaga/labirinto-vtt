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
from mathutils import Quaternion

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['heroi', 'folha']
AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.dirname(AQUI)
TMP = ARGS[ARGS.index('--tmp') + 1] if '--tmp' in ARGS else os.path.join(SAIDA, '_quadros')
cena = bpy.data.scenes['Judge']
OB = bpy.data.objects

DIRECOES = ['sul', 'sudeste', 'leste', 'nordeste', 'norte', 'noroeste', 'oeste', 'sudoeste']
QW, QH, PX_QUADRADO, ORIGEM_ACIMA = 192, 240, 64, 0.62
FUNDO_HEROI = [(0.0, (0.64, 0.62, 0.78)), (0.5, (0.50, 0.53, 0.72)), (1.0, (0.33, 0.39, 0.62))]


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
    hdri(0.45)
    luzes(520, 7000, 4000, 120)
    OB['JK_halo'].constraints[0].target = OB['JG_cam_heroi']
    OB['JP_raiz'].rotation_quaternion = (1, 0, 0, 0)
    cena.camera = OB['JG_cam_heroi']
    cena.frame_set(20)
    r.filepath = os.path.join(SAIDA, 'judge-heroi.png')
    bpy.ops.render.render(write_still=True, scene=cena.name)
    print('heroi salvo', r.filepath)


def folha():
    comum(64)
    r = cena.render
    r.film_transparent = True
    r.resolution_x, r.resolution_y = QW, QH
    r.image_settings.color_mode = 'RGBA'
    hdri(0.6)
    luzes(700, 2600, 1500, 140)
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
