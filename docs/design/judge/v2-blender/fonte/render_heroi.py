"""Render grande do Judge (o "heroi"), sem fundo.

Uso, de dentro desta pasta:
    blender -b --factory-startup -P render_heroi.py -- <saida.png> [largura] [altura] [amostras]

A camera fica do lado esquerdo da ave; montar_heroi.py espelha a imagem (ave olhando para a
direita, mao das redeas na frente e cartao erguido atras do elmo, como na pintura) e poe o fundo.
"""
import os
import sys
import tempfile

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import bpy  # noqa: E402

import judge_modelo as J  # noqa: E402

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
saida = os.path.abspath(args[0]) if args else os.path.join(tempfile.gettempdir(), 'judge_heroi_bruto.png')
largura = int(args[1]) if len(args) > 1 else 1200
altura = int(args[2]) if len(args) > 2 else 1500
amostras = int(args[3]) if len(args) > 3 else 128

scene = J.construir_tudo()
J.config_render(scene, largura, altura, amostras)
J.preparar_heroi(scene)
J.posar(0.25, 1.0, vento=1.8)
scene.render.filepath = saida
bpy.ops.render.render(write_still=True)
print('HEROI', saida)
