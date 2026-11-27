"""Junta PNGs (8 ou 16 bits) num mosaico com legenda: python mosaico.py <saida.png> <colunas> <a.png> <b.png> ..."""
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw


def ler(caminho):
    """Lê PNG de 8 ou 16 bits via ffmpeg (o PIL corta o RGB de 16 bits)."""
    sonda = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", caminho], capture_output=True, text=True, check=True)
    w, h = (int(v) for v in sonda.stdout.strip().split(","))
    bruto = subprocess.run(["ffmpeg", "-v", "error", "-i", caminho, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
    return Image.fromarray(np.frombuffer(bruto, np.uint8).reshape(h, w, 3))


def principal():
    saida, colunas, arquivos = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
    imgs = [ler(a) for a in arquivos]
    w, h = imgs[0].size
    linhas = (len(imgs) + colunas - 1) // colunas
    folha = Image.new("RGB", (w * colunas, (h + 18) * linhas), (12, 12, 12))
    d = ImageDraw.Draw(folha)
    for i, (img, nome) in enumerate(zip(imgs, arquivos)):
        x, y = (i % colunas) * w, (i // colunas) * (h + 18)
        folha.paste(img, (x, y))
        d.text((x + 4, y + h + 3), nome.replace(chr(92), "/").split("/")[-1], fill=(220, 220, 220))
    folha.save(saida)


principal()
