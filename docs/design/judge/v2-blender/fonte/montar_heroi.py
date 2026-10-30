"""Monta as duas imagens do heroi a partir do render bruto do Blender (Python do sistema + Pillow + numpy).

Uso:
    python montar_heroi.py <heroi_bruto.png>

Gera, na pasta de cima (v2-blender/):
    judge-heroi.png       - o Judge sem fundo, espelhado (ave olhando para a direita)
    judge-heroi-cena.jpg  - o mesmo sobre um ceu nublado lavanda com nevoa, no espirito da pintura
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter, ImageOps

AQUI = os.path.dirname(os.path.abspath(__file__))
DESTINO = os.path.dirname(AQUI)


def ceu(largura, altura, semente=7):
    """Ceu lavanda com nuvens largas e nevoa mais clara embaixo (tudo borrado, como pincelada)."""
    rng = np.random.default_rng(semente)
    y = np.linspace(0.0, 1.0, altura)[:, None]
    topo = np.array([176, 182, 222], dtype=np.float32)
    meio = np.array([206, 208, 236], dtype=np.float32)
    base = np.array([168, 172, 214], dtype=np.float32)
    t = np.clip(y * 1.6, 0, 1)[..., None]
    u = np.clip((y - 0.62) / 0.38, 0, 1)[..., None]
    img = topo * (1 - t) + meio * t
    img = img * (1 - u) + base * u
    img = np.broadcast_to(img, (altura, largura, 3)).copy()
    # nuvens: ruido grosso borrado, mais escuro e azul a esquerda
    for escala, forca in ((48, 34.0), (16, 14.0)):
        ruido = rng.random((altura // escala + 2, largura // escala + 2)).astype(np.float32)
        r = Image.fromarray((ruido * 255).astype(np.uint8)).resize((largura, altura), Image.BICUBIC)
        r = np.asarray(r.filter(ImageFilter.GaussianBlur(escala * 0.6)), dtype=np.float32) / 255.0 - 0.5
        lado = np.linspace(1.4, 0.5, largura)[None, :]
        img += (r * forca * lado)[..., None] * np.array([1.0, 1.0, 0.7], dtype=np.float32)
    # clarao atras do cavaleiro (separa a silhueta, como na pintura)
    yy, xx = np.mgrid[0:altura, 0:largura].astype(np.float32)
    d = np.hypot((xx - largura * 0.55) / (largura * 0.42), (yy - altura * 0.36) / (altura * 0.34))
    img += (np.clip(1.0 - d, 0, 1) ** 1.6 * 34.0)[..., None]
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), 'RGB')


def brilho_do_cartao(fig):
    """Clarao vermelho em volta do cartao: pega os pixels vermelhos fortes e borra."""
    a = np.asarray(fig, dtype=np.float32)
    vermelho = ((a[..., 0] > 190) & (a[..., 1] < 140) & (a[..., 3] > 0)).astype(np.float32)
    m = Image.fromarray((vermelho * 255).astype(np.uint8))
    m = np.asarray(m.filter(ImageFilter.GaussianBlur(fig.width * 0.03)), dtype=np.float32) / 255.0
    m = np.clip(m * 3.0, 0, 1)
    camada = np.zeros(a.shape, dtype=np.float32)
    camada[..., 0] = 255
    camada[..., 1] = 70
    camada[..., 2] = 60
    camada[..., 3] = m * 150
    return Image.fromarray(camada.astype(np.uint8), 'RGBA')


def main():
    bruto = sys.argv[1]
    fig = ImageOps.mirror(Image.open(bruto).convert('RGBA'))
    fig.save(os.path.join(DESTINO, 'judge-heroi.png'), optimize=True)
    cena = ceu(fig.width, fig.height).convert('RGBA')
    # halo claro atras da figura
    alfa = fig.getchannel('A').filter(ImageFilter.GaussianBlur(fig.width * 0.02))
    halo = Image.new('RGBA', fig.size, (226, 228, 250, 0))
    halo.putalpha(alfa.point(lambda v: int(v * 0.55)))
    cena.alpha_composite(halo)
    cena.alpha_composite(brilho_do_cartao(fig))
    cena.alpha_composite(fig)
    # nevoa leve por cima da parte de baixo (pes e cauda somem um pouco no ar)
    nevoa = Image.new('RGBA', fig.size, (200, 204, 236, 0))
    grad = np.clip((np.linspace(0, 1, fig.height) - 0.7) / 0.3, 0, 1) ** 1.5 * 120
    nevoa.putalpha(Image.fromarray(np.broadcast_to(grad[:, None], (fig.height, fig.width)).astype(np.uint8)))
    cena.alpha_composite(nevoa)
    cena.convert('RGB').save(os.path.join(DESTINO, 'judge-heroi-cena.jpg'), quality=90, optimize=True, progressive=True)
    for nome in ('judge-heroi.png', 'judge-heroi-cena.jpg'):
        print(nome, round(os.path.getsize(os.path.join(DESTINO, nome)) / 1024), 'KB')


if __name__ == '__main__':
    main()
