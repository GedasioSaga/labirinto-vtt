"""Quadros da folha de sprites do Judge: 8 direcoes x (12 de respiro + 8 de cartao subindo).

Uso, de dentro desta pasta:
    blender -b --factory-startup -P render_folha.py -- <pasta_saida> [px_por_casa] [amostras]

Gera <pasta>/d{0..7}_k{00..19}.png (fundo transparente, sombra no chao). Direcao 0 = sul (de frente),
depois sudeste, leste, nordeste, norte, noroeste, oeste, sudoeste. montar_folhas.py junta tudo.
"""
import os
import sys
import time

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import bpy  # noqa: E402

import judge_modelo as J  # noqa: E402

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
pasta = os.path.abspath(args[0]) if args else os.path.join(AQUI, 'quadros')
px = int(args[1]) if len(args) > 1 else 128
amostras = int(args[2]) if len(args) > 2 else 24
os.makedirs(pasta, exist_ok=True)

scene = J.construir_tudo()
J.config_render(scene, int(J.QUADRO_L * px), int(J.QUADRO_A * px), amostras)
scene.camera = bpy.data.objects['CamFolha']
bpy.data.objects['ChaoSombra'].hide_render = False
t0 = time.time()
for k in range(J.N_RESPIRO + J.N_CARTAO):
    if k < J.N_RESPIRO:
        J.posar(k / J.N_RESPIRO, 0.0)
    else:
        J.posar(0.0, (k - J.N_RESPIRO) / (J.N_CARTAO - 1))
    for d in range(J.N_DIR):
        J.apontar_suporte(d)
        scene.render.filepath = os.path.join(pasta, 'd%d_k%02d.png' % (d, k))
        bpy.ops.render.render(write_still=True)
print('FOLHA', J.N_DIR * (J.N_RESPIRO + J.N_CARTAO), 'quadros em', round(time.time() - t0), 's')
