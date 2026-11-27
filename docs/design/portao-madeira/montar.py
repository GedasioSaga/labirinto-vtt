"""Pós e montagem: fade, vinheta e grão sobre os quadros crus do cena.py, vídeos e folha de contato.

    python montar.py <saida do cena.py> <som.wav> <pasta de entrega>

Lê <saida>/cru/q_NNNN.png (16 bits) e <saida>/grafico.json; escreve <saida>/pos/q_NNNN.png (8 bits) e, na entrega:
video.webm (VP9 1280x720 30 fps, mudo: o formato do pacote de animações), video-com-som.webm (VP9 + Opus),
video-com-som.mp4 (H.264 + AAC, para navegador sem VP9) e folha-de-contato.png (16 quadros com o tempo embaixo).
"""

import json
import math
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

LARGURA, ALTURA, FPS = 1280, 720, 30
GRAO = 0.010  # desvio do grão no meio-tom (escala 0-1, espaço de tela)
VINHETA = 0.30
SEMENTE = 1979
# os 16 quadros da folha de contato: (instante, o que acontece)
FOLHA = [
    (0.30, "sai do preto"),
    (0.90, "a tranca sobe"),
    (1.40, "trinco cai"),
    (1.53, "tremor do trinco"),
    (1.97, "2o arranco"),
    (2.40, "começa a andar"),
    (2.90, "tranco (esq.)"),
    (3.30, "abrindo"),
    (3.83, "tranco (dir.)"),
    (4.30, "abrindo"),
    (4.80, "batida (esq.)"),
    (4.97, "batida (dir.)"),
    (5.40, "atravessa"),
    (5.90, "passando"),
    (6.27, "no vão"),
    (6.70, "escuro engole"),
]


def ler_crus(pasta, n):
    """Um ffmpeg só lê a sequência inteira de 16 bits e entrega rgb48 quadro a quadro."""
    proc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-framerate", str(FPS), "-start_number", "0", "-i", os.path.join(pasta, "q_%04d.png"), "-frames:v", str(n), "-f", "rawvideo", "-pix_fmt", "rgb48le", "-"],
        stdout=subprocess.PIPE,
    )
    tamanho = LARGURA * ALTURA * 3 * 2
    for _ in range(n):
        bruto = proc.stdout.read(tamanho)
        if len(bruto) < tamanho:
            raise SystemExit("faltam quadros crus")
        yield np.frombuffer(bruto, "<u2").reshape(ALTURA, LARGURA, 3).astype(np.float32) / 65535.0
    proc.wait()


def para_linear(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def para_tela(c):
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(np.maximum(c, 0.0), 1.0 / 2.4) - 0.055)


def mascara_vinheta():
    y, x = np.mgrid[0:ALTURA, 0:LARGURA].astype(np.float32)
    dx = (x - LARGURA / 2) / (LARGURA / 2)
    dy = (y - ALTURA / 2) / (LARGURA / 2)
    r = np.sqrt(dx * dx + dy * dy)
    u = np.clip((r - 0.45) / (1.25 - 0.45), 0.0, 1.0)
    return (1.0 - VINHETA * u * u * (3 - 2 * u))[..., None]


def processar(quadro, fade, vinheta, rng):
    if fade >= 0.999:
        return np.zeros((ALTURA, LARGURA, 3), np.uint8)  # preto de verdade no 1o e no último quadro: emenda sem salto
    lin = para_linear(quadro) * vinheta * (1.0 - fade)
    tela = para_tela(lin)
    luma = tela.mean(axis=2, keepdims=True)
    sigma = GRAO * (0.35 + 2.6 * luma * (1.0 - luma)) * (1.0 - fade)  # grão de filme: mais no meio-tom, some no preto
    tela = tela + rng.standard_normal((ALTURA, LARGURA, 1)).astype(np.float32) * sigma
    tela = tela + (rng.random(tela.shape, dtype=np.float32) - rng.random(tela.shape, dtype=np.float32)) / 255.0
    return np.clip(np.round(tela * 255.0), 0, 255).astype(np.uint8)


def rodar(args):
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-v", "error", *args], check=True)


def fonte(tamanho):
    for caminho in ("C:/Windows/Fonts/segoeui.ttf", "C:/Windows/Fonts/arial.ttf"):
        if os.path.exists(caminho):
            return ImageFont.truetype(caminho, tamanho)
    return ImageFont.load_default()


def folha_de_contato(pasta_pos, destino):
    w, h, faixa, colunas = 400, 225, 34, 4
    linhas = math.ceil(len(FOLHA) / colunas)
    folha = Image.new("RGB", (w * colunas + 10 * (colunas + 1), (h + faixa) * linhas + 10 * (linhas + 1)), (14, 14, 15))
    d = ImageDraw.Draw(folha)
    f_tempo, f_nome = fonte(17), fonte(14)
    for i, (t, nome) in enumerate(FOLHA):
        q = min(round(t * FPS), int(7.0 * FPS) - 1)
        img = Image.open(os.path.join(pasta_pos, f"q_{q:04d}.png")).resize((w, h), Image.LANCZOS)
        x = 10 + (i % colunas) * (w + 10)
        y = 10 + (i // colunas) * (h + faixa + 10)
        folha.paste(img, (x, y))
        d.text((x + 2, y + h + 6), f"{t:.2f} s".replace(".", ","), font=f_tempo, fill=(236, 230, 220))
        d.text((x + 72, y + h + 9), f"quadro {q} · {nome}", font=f_nome, fill=(150, 144, 136))
    folha.save(destino)


def principal():
    saida, wav, entrega = sys.argv[1], sys.argv[2], sys.argv[3]
    with open(os.path.join(saida, "grafico.json"), encoding="utf-8") as arq:
        g = json.load(arq)
    n = g["quadros"]
    pasta_pos = os.path.join(saida, "pos")
    os.makedirs(pasta_pos, exist_ok=True)
    os.makedirs(entrega, exist_ok=True)
    vinheta = mascara_vinheta()
    for f, quadro in enumerate(ler_crus(os.path.join(saida, "cru"), n)):
        rng = np.random.default_rng(SEMENTE + f)
        Image.fromarray(processar(quadro, g["curvas"][f]["fade"], vinheta, rng)).save(os.path.join(pasta_pos, f"q_{f:04d}.png"), compress_level=1)
    seq = ["-framerate", str(FPS), "-start_number", "0", "-i", os.path.join(pasta_pos, "q_%04d.png")]
    webm = os.path.join(entrega, "video.webm")
    vp9 = ["-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "32", "-pix_fmt", "yuv420p", "-row-mt", "1", "-deadline", "good", "-cpu-used", "2", "-g", "60"]
    rodar([*seq, *vp9, "-an", webm])
    rodar(["-i", webm, "-i", wav, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "libopus", "-b:a", "160k", "-shortest", os.path.join(entrega, "video-com-som.webm")])
    rodar([*seq, "-i", wav, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "libx264", "-crf", "20", "-preset", "slow", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest", os.path.join(entrega, "video-com-som.mp4")])
    folha_de_contato(pasta_pos, os.path.join(entrega, "folha-de-contato.png"))
    for nome in ("video.webm", "video-com-som.webm", "video-com-som.mp4", "folha-de-contato.png"):
        caminho = os.path.join(entrega, nome)
        print(f"{nome}: {os.path.getsize(caminho) / 1e6:.2f} MB")


principal()
