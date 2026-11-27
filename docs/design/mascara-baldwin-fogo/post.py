"""Pós-processo dos quadros do Blender e montagem dos vídeos.

Uso: python -I post.py <pasta-dos-quadros> <grafico.json> <saida> [--som som.wav]

Por quadro: véu preto que abre em 0,45 s (como a Armaduras despertam), brilho (bloom) em duas escalas, clarão quente
de 2-3 quadros no clímax, vinheta e grão leve (semente fixa). Escreve final/q000..q125.png, mais os 9 quadros da
cortina (q126..q134: o último quadro fechando em 0,3 s com easeInOutSine, a mesma curva do app), luma.json e:
  video.webm            VP9 1280x720, 30 fps, 4,2 s, sem som (o formato que o pacote embute)
  previa-com-som.mp4    H.264 + AAC, 4,5 s (vídeo + cortina), com o som.wav quando --som vier
"""

import json
import math
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

FPS = 30
VEU_S = 0.45
LIMIAR_BRILHO = 0.58
SEMENTE = 7


def sai(a: float, b: float, t: float) -> float:
    if t <= a:
        return 0.0
    if t >= b:
        return 1.0
    x = (t - a) / (b - a)
    return 1 - (1 - x) ** 3


def pulso(centro: float, largura: float, t: float) -> float:
    return math.exp(-(((t - centro) / largura) ** 2))


def luma(img: np.ndarray) -> np.ndarray:
    return img[..., 0] * 0.2126 + img[..., 1] * 0.7152 + img[..., 2] * 0.0722


def borrar(img: np.ndarray, sigma: float, reduz: int) -> np.ndarray:
    """Borrão gaussiano feito em resolução reduzida (o brilho é macio; 1280x720 inteiro levava ~3 s por quadro)."""
    h, w = img.shape[:2]
    canais = []
    for c in range(3):
        canal = Image.fromarray(img[..., c].astype(np.float32), mode="F").resize((w // reduz, h // reduz), Image.BILINEAR)
        borrado = gaussian_filter(np.asarray(canal), sigma / reduz)
        canais.append(np.asarray(Image.fromarray(borrado, mode="F").resize((w, h), Image.BILINEAR)))
    return np.stack(canais, axis=-1)


def processar(img: np.ndarray, t: float, t_climax: float, vinheta: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    y = luma(img)
    mascara = np.clip((y - LIMIAR_BRILHO) / (1 - LIMIAR_BRILHO), 0, 1)[..., None]
    claro = img * mascara
    perto = borrar(claro, 9, 2)
    longe = borrar(claro, 38, 4)
    flash = pulso(t_climax + 0.03, 0.045, t)
    saida = img * (1 + 0.22 * flash) + perto * (0.45 + 0.6 * flash) + longe * (0.35 + 0.9 * flash) * np.array([1.0, 0.8, 0.6])
    saida += flash * 0.10 * np.array([1.0, 0.72, 0.45]) * vinheta[..., None]
    saida *= vinheta[..., None]
    saida += rng.normal(0, 0.007, saida.shape[:2])[..., None]
    saida *= sai(0.0, VEU_S, t)
    return np.clip(saida, 0, 1)


def ffmpeg(args: list[str]) -> None:
    r = subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", *args], capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit(f"ffmpeg falhou: {r.stderr}")


def main() -> None:
    resto = sys.argv[1:]
    som = None
    if "--som" in resto:
        i = resto.index("--som")
        som = Path(resto[i + 1])
        del resto[i : i + 2]
    pasta, grafico_caminho, saida = Path(resto[0]), Path(resto[1]), Path(resto[2])
    g = json.loads(grafico_caminho.read_text(encoding="utf-8"))
    eventos = {e["nome"]: e["t"] for e in g["eventos"]}
    quadros = g["quadros"]
    final = saida / "final"
    final.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(SEMENTE)
    vinheta = None
    lumas, lumas_centro = [], []
    ultimo = None
    for i in range(quadros):
        img = np.asarray(Image.open(pasta / f"q{i:03d}.png").convert("RGB"), dtype=np.float32) / 255
        if vinheta is None:
            h, w = img.shape[:2]
            yy, xx = np.mgrid[0:h, 0:w]
            r = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2) / math.sqrt(2)
            vinheta = 1 - 0.42 * r**2.2
        out = processar(img, i / FPS, eventos["climax"], vinheta, rng)
        Image.fromarray((out * 255 + 0.5).astype(np.uint8)).save(final / f"q{i:03d}.png", compress_level=6)
        y = luma(out)
        lumas.append(float(y.mean()))
        h, w = y.shape
        lumas_centro.append(float(y[int(h * 0.2) : int(h * 0.85), int(w * 0.35) : int(w * 0.65)].mean()))
        ultimo = out
    # Cortina do app: o último quadro parado, fechando para o preto em 0,3 s (easeInOutSine).
    n_cortina = round(g["cortina_s"] * FPS)
    for k in range(1, n_cortina + 1):
        x = k / n_cortina
        fecha = (1 - math.cos(math.pi * x)) / 2
        quadro = ultimo * (1 - fecha)
        Image.fromarray((quadro * 255 + 0.5).astype(np.uint8)).save(final / f"q{quadros - 1 + k:03d}.png")
        lumas.append(float(luma(quadro).mean()))
        lumas_centro.append(lumas_centro[-1] * (1 - fecha))
    (saida / "luma.json").write_text(json.dumps({"fps": FPS, "luma": lumas, "luma_centro": lumas_centro}), encoding="utf-8")

    entrada = ["-framerate", str(FPS), "-i", str(final / "q%03d.png")]
    ffmpeg([*entrada, "-frames:v", str(quadros), "-c:v", "libvpx-vp9", "-pix_fmt", "yuv420p", "-b:v", "0", "-crf", "31",
            "-row-mt", "1", "-deadline", "good", "-cpu-used", "2", "-an", str(saida / "video.webm")])
    if som is not None:
        ffmpeg([*entrada, "-i", str(som), "-map", "0:v:0", "-map", "1:a:0", "-c:v", "libx264", "-crf", "18", "-preset", "slow",
                "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", "-shortest",
                str(saida / "previa-com-som.mp4")])
    print(f"{quadros} quadros + {n_cortina} de cortina; luma média máx {max(lumas):.3f} no quadro {int(np.argmax(lumas))}")


main()
