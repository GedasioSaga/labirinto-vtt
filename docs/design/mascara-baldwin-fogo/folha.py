"""Folha de contato: N quadros numa imagem só, com o tempo embaixo de cada um.

Uso: python -I folha.py <pasta-de-quadros> <saida.png> [colunas] [largura-da-celula] [q000.png q010.png ...]
Sem lista de quadros, usa todos os q*.png da pasta. O tempo sai do índice (q045.png = 45/30 s).
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

FPS = 30


def fonte(tamanho: int) -> ImageFont.ImageFont:
    for nome in ("segoeui.ttf", "arial.ttf"):
        try:
            return ImageFont.truetype(nome, tamanho)
        except OSError:
            continue
    return ImageFont.load_default()


def main() -> None:
    pasta, saida = Path(sys.argv[1]), Path(sys.argv[2])
    colunas = int(sys.argv[3]) if len(sys.argv) > 3 else 4
    largura = int(sys.argv[4]) if len(sys.argv) > 4 else 400
    nomes = sys.argv[5:] or sorted(p.name for p in pasta.glob("q*.png"))
    quadros = [pasta / n for n in nomes]
    primeiro = Image.open(quadros[0])
    altura = round(largura * primeiro.height / primeiro.width)
    legenda = 30
    linhas = (len(quadros) + colunas - 1) // colunas
    folha = Image.new("RGB", (colunas * largura + (colunas + 1) * 6, linhas * (altura + legenda) + (linhas + 1) * 6), (14, 13, 12))
    desenho = ImageDraw.Draw(folha)
    letra = fonte(18)
    for i, caminho in enumerate(quadros):
        im = Image.open(caminho).convert("RGB").resize((largura, altura), Image.LANCZOS)
        x = 6 + (i % colunas) * (largura + 6)
        y = 6 + (i // colunas) * (altura + legenda + 6)
        folha.paste(im, (x, y))
        indice = int(caminho.stem.lstrip("q"))
        texto = f"{indice / FPS:.2f} s  ·  quadro {indice}".replace(".", ",", 1)
        desenho.text((x + 4, y + altura + 5), texto, fill=(214, 204, 190), font=letra)
    saida.parent.mkdir(parents=True, exist_ok=True)
    folha.save(saida)
    print(f"{len(quadros)} quadros -> {saida} ({folha.width}x{folha.height})")


main()
