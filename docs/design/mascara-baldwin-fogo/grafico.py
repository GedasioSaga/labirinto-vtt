"""Gráfico som x movimento na mesma linha do tempo (prova; medir não é ouvir).

Uso: python -I grafico.py <grafico.json> <envoltoria.json> <luma.json> <medidas-som.json> <saida.png>

Dois painéis com o mesmo eixo de tempo (nunca dois eixos y): em cima a envoltória do som (RMS a cada 10 ms, total e
três camadas), embaixo as curvas da animação normalizadas de 0 a 1 (chama medida na simulação, faíscas vivas, luma do
quadro final, brasa). A cor segue a entidade: o fogo é laranja nos dois painéis, as faíscas são verde-água nos dois.
Paleta: a de referência da skill dataviz no tema escuro (validada com validate_palette.js, superfície #191919).
"""

import json
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

SUPERFICIE = "#191919"
TEXTO = "#efefef"
TEXTO_2 = "#9c9c9c"
GRADE = "#2c2c2c"
AZUL, LARANJA, AGUA, AMARELO, VIOLETA = "#338ced", "#e76624", "#00a888", "#d28e05", "#9887ef"
NOMES_EVENTOS = {
    "brasa olhos": "brasa nos olhos",
    "linguas olhos": "línguas",
    "ignicao": "ignição",
    "climax": "clímax",
    "fim do video": "fim do vídeo",
    "preto": "preto",
}


def main() -> None:
    g = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    env = json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
    lu = json.loads(Path(sys.argv[3]).read_text(encoding="utf-8"))
    med = json.loads(Path(sys.argv[4]).read_text(encoding="utf-8"))
    saida = Path(sys.argv[5])
    c = g["curvas"]
    tq = np.asarray(c["t"])
    total = g["duracao_total_s"]

    plt.rcParams.update({"font.family": "Segoe UI", "font.size": 10, "text.color": TEXTO, "axes.labelcolor": TEXTO_2,
                         "xtick.color": TEXTO_2, "ytick.color": TEXTO_2})
    fig, (som, mov) = plt.subplots(2, 1, figsize=(12, 6.6), sharex=True, gridspec_kw={"height_ratios": [1, 1], "hspace": 0.12})
    fig.patch.set_facecolor(SUPERFICIE)
    for ax in (som, mov):
        ax.set_facecolor(SUPERFICIE)
        for lado in ("top", "right"):
            ax.spines[lado].set_visible(False)
        for lado in ("left", "bottom"):
            ax.spines[lado].set_color(GRADE)
        ax.grid(axis="y", color=GRADE, linewidth=0.8)
        ax.set_axisbelow(True)

    passo = env["passo_s"]
    te = np.arange(len(env["total"])) * passo
    linhas_som = [("total", env["total"], TEXTO, 1.6), ("rugido", env["rugido"], LARANJA, 1.4),
                  ("faíscas", env["faiscas"], AGUA, 1.2), ("impacto", env["impacto"], AMARELO, 1.4)]
    for nome, valores, cor, largura in linhas_som:
        v = np.maximum(np.asarray(valores), -80)
        som.plot(te[: v.size], v, color=cor, linewidth=largura, label=nome, solid_capstyle="round")
    som.set_ylim(-80, 8)
    som.set_ylabel("som: RMS (dBFS, 10 ms)")
    som.legend(loc="lower left", bbox_to_anchor=(0, 1.0), frameon=False, ncol=4, labelcolor=TEXTO, borderaxespad=0.2)
    fig.suptitle(f"Som x movimento · {med['lufs_integrado']:.1f} LUFS integrado · pico verdadeiro "
                 f"{med['pico_verdadeiro_dbtp']:.1f} dBTP".replace(".", ","), x=0.125, ha="left", y=0.995, color=TEXTO, fontsize=12)

    def norm(v):
        v = np.asarray(v, dtype=float)
        return v / (v.max() or 1)

    tl = np.arange(len(lu["luma"])) / lu["fps"]
    curvas_mov = [("chama (simulação)", tq, norm(c["chama_total"]), LARANJA), ("faíscas vivas", tq, norm(c["faiscas_vivas"]), AGUA),
                  ("luma do quadro", tl, norm(lu["luma"]), AZUL),
                  ("brasa", tq, np.maximum(c["brasa_olhos"], c["brasa_borda"]), VIOLETA)]
    for nome, x, y, cor in curvas_mov:
        mov.plot(x, y, color=cor, linewidth=1.6, label=nome, solid_capstyle="round")
    mov.set_ylim(0, 1.05)
    mov.set_ylabel("movimento (0 a 1)")
    mov.set_xlabel("tempo (s)")
    mov.legend(loc="lower left", bbox_to_anchor=(0, 1.0), frameon=False, ncol=4, labelcolor=TEXTO, borderaxespad=0.2)
    mov.set_xlim(0, total)

    for e in g["eventos"]:
        rotulo = NOMES_EVENTOS.get(e["nome"])
        if rotulo is None:
            continue
        for ax in (som, mov):
            ax.axvline(e["t"], color=TEXTO_2, linewidth=0.8, linestyle=(0, (3, 3)), alpha=0.7)
        lado = "right" if e["nome"] in ("preto", "fim do video") else "left"
        som.text(e["t"] + (-0.03 if lado == "right" else 0.03), 5, rotulo, color=TEXTO_2, fontsize=8.5, ha=lado, va="center")
    imp = med["impacto"]["medido_s"]
    som.annotate(f"impacto medido em {imp:.3f} s".replace(".", ","), xy=(imp, -8), xytext=(imp - 0.08, -3.5),
                 color=TEXTO, fontsize=8.5, ha="right", va="center",
                 arrowprops={"arrowstyle": "-", "color": TEXTO_2, "linewidth": 0.8})
    mov.axvspan(g["duracao_video_s"], total, color="#ffffff", alpha=0.04, linewidth=0)
    mov.text(g["duracao_video_s"] + 0.02, 1.0, "cortina\ndo app", color=TEXTO_2, fontsize=8.5, va="top")
    fig.savefig(saida, dpi=110, facecolor=SUPERFICIE, bbox_inches="tight")
    print("gráfico ->", saida)


main()
