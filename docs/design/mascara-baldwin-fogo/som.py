"""Som da máscara pegando fogo, sintetizado do zero (sem amostra de terceiros) na linha do tempo do grafico.json.

Uso: python -I som.py <grafico.json> <saida> [--semente 7]
Escreve som.wav (48 kHz, 16 bits, estéreo, 4,5 s = vídeo de 4,2 s + cortina de 0,3 s do app),
envoltoria.json (RMS de cada camada a cada 10 ms) e medidas-som.json (LUFS, pico verdadeiro, eventos); sai com 1 se
algum critério falhar. Medir não é ouvir: os números conferem volume, pico e sincronia, não timbre nem gosto.

Camadas: ambiente grave; brasa (chiado e estalinhos) desde a brasa nos olhos; sopro das primeiras línguas;
whoosh da ignição; rugido do fogo seguindo a chama MEDIDA na simulação (chama_total); crepitar com taxa pela chama;
tique das faíscas novas; riser e impacto no clímax (estrondo grave, sopro, anel de metal da máscara); cortina.
"""

import json
import math
import sys
from pathlib import Path

import numpy as np
from scipy.signal import butter, resample_poly, sosfilt, sosfiltfilt

TAXA = 48000
GANHO_DB = {
    "ambiente": -36.0,
    "brasa": -30.0,
    "linguas": -22.0,
    "ignicao": -12.0,
    "rugido": -15.0,
    "crepitar": -21.0,
    "faiscas": -34.0,
    "riser": -20.0,
    "impacto": -6.0,
}
LUFS_ALVO = -19.5
LUFS_FAIXA = (-23.0, -18.0)
TETO_DBFS = -1.6
PICO_VERDADEIRO_MAX = -1.0


def argumentos() -> tuple[Path, Path, int]:
    resto = sys.argv[1:]
    if resto and resto[0] == "--":
        resto = resto[1:]
    semente = 7
    if "--semente" in resto:
        i = resto.index("--semente")
        semente = int(resto[i + 1])
        del resto[i : i + 2]
    return Path(resto[0]), Path(resto[1]), semente


def db(x: float) -> float:
    return 20 * math.log10(max(x, 1e-12))


def faixa(x: np.ndarray, baixa: float | None, alta: float | None, ordem: int = 2) -> np.ndarray:
    if baixa and alta:
        sos = butter(ordem, [baixa, alta], btype="band", fs=TAXA, output="sos")
    elif baixa:
        sos = butter(ordem, baixa, btype="high", fs=TAXA, output="sos")
    else:
        sos = butter(ordem, alta, btype="low", fs=TAXA, output="sos")
    return sosfilt(sos, x)


def ruido_rosa(n: int, rng: np.random.Generator) -> np.ndarray:
    espectro = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / TAXA)
    f[0] = f[1]
    x = np.fft.irfft(espectro / np.sqrt(f), n)
    return x / (np.std(x) + 1e-12)


def ruido_marrom(n: int, rng: np.random.Generator) -> np.ndarray:
    x = np.cumsum(rng.standard_normal(n))
    x = faixa(x, 20, None, 1)
    return x / (np.std(x) + 1e-12)


def curva_amostras(t_quadros: np.ndarray, valores: list[float], t: np.ndarray) -> np.ndarray:
    return np.interp(t, t_quadros, np.asarray(valores, dtype=float))


def suavizar(env: np.ndarray, segundos: float) -> np.ndarray:
    n = max(1, int(segundos * TAXA))
    janela = np.hanning(2 * n + 1)
    janela /= janela.sum()
    return np.convolve(env, janela, mode="same")


def tremulacao(t: np.ndarray, rng: np.random.Generator, profundidade: float) -> np.ndarray:
    soma = np.zeros_like(t)
    for f, a in ((2.3, 0.45), (4.1, 0.3), (6.7, 0.18), (11.3, 0.1)):
        soma += a * np.sin(2 * np.pi * f * t + rng.uniform(0, 2 * np.pi))
    return 1 + profundidade * soma


def estalo(rng: np.random.Generator, centro_hz: float, decai_s: float) -> np.ndarray:
    n = int(decai_s * 6 * TAXA)
    x = rng.standard_normal(n) * np.exp(-np.arange(n) / (decai_s * TAXA))
    x = faixa(x, centro_hz * 0.6, min(centro_hz * 1.6, 20000), 2)
    rampa = min(24, n)  # 0,5 ms de ataque: estalo sem clique digital
    x[:rampa] *= np.sin(np.linspace(0, np.pi / 2, rampa)) ** 2
    return x / (np.max(np.abs(x)) + 1e-12)


def poisson(taxa_por_s: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """Instantes (amostra) de um processo de Poisson com taxa variável."""
    p = taxa_por_s / TAXA
    return np.nonzero(rng.random(p.size) < p)[0]


def colar(destino: np.ndarray, som: np.ndarray, inicio: int, ganho: float) -> None:
    fim = min(destino.size, inicio + som.size)
    if inicio < destino.size and fim > inicio:
        destino[inicio:fim] += ganho * som[: fim - inicio]


# ---------------------------------------------------------------- medidas


def k_ponderar(x: np.ndarray) -> np.ndarray:
    from scipy.signal import lfilter

    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621]
    return lfilter(b2, a2, lfilter(b1, a1, x))


def lufs_integrado(estereo: np.ndarray) -> float:
    canais = [k_ponderar(c) for c in estereo]
    bloco, passo = int(0.4 * TAXA), int(0.1 * TAXA)
    energias = []
    for i in range(0, estereo.shape[1] - bloco + 1, passo):
        energias.append(sum(np.mean(c[i : i + bloco] ** 2) for c in canais))
    energias = np.asarray(energias)
    alto = energias[-0.691 + 10 * np.log10(energias + 1e-20) > -70]
    if alto.size == 0:
        return -math.inf
    relativo = -0.691 + 10 * np.log10(np.mean(alto)) - 10
    final = alto[-0.691 + 10 * np.log10(alto) > relativo]
    return float(-0.691 + 10 * np.log10(np.mean(final)))


def pico_verdadeiro(estereo: np.ndarray) -> float:
    return db(max(np.max(np.abs(resample_poly(c, 4, 1))) for c in estereo))


def limitar(estereo: np.ndarray, teto_dbfs: float) -> np.ndarray:
    """Limitador com antecipação de 2 ms e soltura de 60 ms, ganho comum aos dois canais."""
    teto = 10 ** (teto_dbfs / 20)
    nivel = np.max(np.abs(estereo), axis=0)
    antecipa = int(0.002 * TAXA)
    pico = np.maximum.reduce([np.roll(nivel, -k) for k in range(antecipa + 1)])
    ganho_alvo = np.minimum(1.0, teto / np.maximum(pico, 1e-12))
    solta = math.exp(-1 / (0.06 * TAXA))
    ganho = np.empty_like(ganho_alvo)
    g = 1.0
    for i, alvo in enumerate(ganho_alvo):
        g = alvo if alvo < g else alvo + (g - alvo) * solta
        ganho[i] = g
    return estereo * ganho


def ataque_em(x: np.ndarray, centro_s: float, raio_s: float = 0.05) -> tuple[float, float]:
    """Onde a energia de 4 ms mais sobe sobre a dos 20 ms anteriores, perto de centro_s; devolve (t, dB)."""
    e = x**2
    curto = np.convolve(e, np.ones(int(0.004 * TAXA)) / int(0.004 * TAXA), mode="full")[: e.size]
    longo = np.convolve(e, np.ones(int(0.020 * TAXA)) / int(0.020 * TAXA), mode="full")[: e.size]
    a, b = int((centro_s - raio_s) * TAXA), int((centro_s + raio_s) * TAXA)
    atraso = int(0.004 * TAXA)
    razao = 10 * np.log10((curto[a + atraso : b + atraso] + 1e-14) / (longo[a:b] + 1e-14))
    i = int(np.argmax(razao))
    return (a + i) / TAXA, float(razao[i])


# ---------------------------------------------------------------- síntese


def sintetizar(g: dict, semente: int) -> tuple[np.ndarray, dict[str, np.ndarray]]:
    rng = np.random.default_rng(semente)
    eventos = {e["nome"]: e["t"] for e in g["eventos"]}
    dur = g["duracao_total_s"]
    n = int(round(dur * TAXA))
    t = np.arange(n) / TAXA
    c = g["curvas"]
    tq = np.asarray(c["t"])
    chama = np.asarray(c["chama_total"], dtype=float)
    chama = chama / (chama.max() or 1.0)
    env_chama = suavizar(curva_amostras(tq, list(chama), t), 0.03)
    brasa = curva_amostras(tq, [max(a, b) for a, b in zip(c["brasa_olhos"], c["brasa_borda"])], t)
    faiscas = np.asarray(c["faiscas_vivas"], dtype=float)
    novas = np.maximum(0, np.diff(faiscas, prepend=0.0)) * g["fps"]  # faíscas nascendo por segundo
    env_novas = curva_amostras(tq, list(novas), t)
    camadas: dict[str, np.ndarray] = {}

    # Ambiente: grave escuro que sobe devagar.
    amb = faixa(ruido_marrom(n, rng), 30, 160, 2) * 0.8 + 0.5 * np.sin(2 * np.pi * 41 * t)
    camadas["ambiente"] = amb * (0.5 + 0.5 * np.clip(t / 3.5, 0, 1))

    # Brasa: chiado fino e estalinhos de metal esquentando.
    chiado = faixa(rng.standard_normal(n), 2500, 7000, 2)
    chiado *= suavizar(brasa, 0.05) * tremulacao(t, rng, 0.35)
    estalinhos = np.zeros(n)
    for i in poisson(9.0 * brasa * (1 - 0.6 * env_chama), rng):
        colar(estalinhos, estalo(rng, rng.uniform(2500, 6000), rng.uniform(0.0008, 0.002)), i, rng.lognormal(-1.2, 0.5))
    camadas["brasa"] = chiado * 0.6 + estalinhos * 0.9

    # Línguas: dois sopros macios quando o fogo começa a sair dos olhos.
    linguas = np.zeros(n)
    for atraso, ganho in ((0.0, 1.0), (0.32, 0.7)):
        t0 = eventos["linguas olhos"] + atraso
        m = (t >= t0) & (t < t0 + 0.6)
        tt = t[m] - t0
        env = (1 - np.exp(-tt / 0.06)) * np.exp(-tt / 0.18)
        linguas[m] += ganho * env * faixa(rng.standard_normal(n), 150, 900, 2)[m]
    camadas["linguas"] = linguas

    # Ignição: whoosh com o filtro subindo, mais um baque grave curto.
    t_ign = eventos["ignicao"]
    ruido = rng.standard_normal(n)
    whoosh = np.zeros(n)
    m = (t >= t_ign - 0.40) & (t < t_ign + 0.9)
    idx = np.nonzero(m)[0]
    blocos = np.array_split(idx, 40)
    for bl in blocos:
        tc = t[bl].mean() - t_ign
        centro = 250 + 2200 * float(np.clip((tc + 0.4) / 0.45, 0, 1)) ** 1.5
        trecho = ruido[max(0, bl[0] - 2400) : bl[-1] + 1]
        filtrado = sosfiltfilt(butter(2, [centro * 0.5, min(centro * 1.8, 20000)], btype="band", fs=TAXA, output="sos"), trecho)
        whoosh[bl] = filtrado[-bl.size :]
    tt = t - t_ign
    env_w = np.where(tt < 0.05, np.clip((tt + 0.40) / 0.45, 0, 1) ** 2.2, np.exp(-(tt - 0.05) / 0.32))
    whoosh *= env_w * (t >= t_ign - 0.40)
    baque = np.where(tt >= 0, np.sin(2 * np.pi * (70 * tt - 30 * tt**2)) * np.exp(-tt / 0.16) * (1 - np.exp(-tt / 0.004)), 0.0)
    camadas["ignicao"] = whoosh / (np.max(np.abs(whoosh)) + 1e-12) + 0.6 * baque

    # Rugido: ruído grave-médio, nível pela chama medida, com tremulação.
    rug = faixa(ruido_rosa(n, rng), 55, 750, 2) + 0.5 * faixa(ruido_marrom(n, rng), 35, 180, 2)
    rug = np.tanh(1.4 * rug) / 1.4
    camadas["rugido"] = rug * env_chama**1.2 * tremulacao(t, rng, 0.25)

    # Crepitar: estalos de madeira/metal com taxa pela chama.
    crep = np.zeros(n)
    for i in poisson(4.0 + 34.0 * env_chama, rng):
        if env_chama[i] < 0.03:
            continue
        colar(crep, estalo(rng, rng.uniform(900, 5200), rng.uniform(0.001, 0.006)), i, env_chama[i] * rng.lognormal(-0.9, 0.6))
    camadas["crepitar"] = crep

    # Faíscas: tique agudo por faísca nascendo (raleado).
    tiq = np.zeros(n)
    for i in poisson(np.minimum(60.0, env_novas * 0.12), rng):
        colar(tiq, estalo(rng, rng.uniform(5500, 9000), 0.0006), i, rng.lognormal(-1.0, 0.5))
    camadas["faiscas"] = tiq

    # Clímax: riser de 0,7 s e impacto (estrondo grave com queda de tom, sopro e anel de metal da máscara).
    t_c = eventos["climax"]
    tr = t - (t_c - 0.7)
    riser_env = np.where((tr >= 0) & (t < t_c), (np.clip(tr, 0, None) / 0.7) ** 2.5, 0.0)
    riser = faixa(rng.standard_normal(n), 400, 5000, 2) * riser_env
    riser += 0.4 * np.sin(2 * np.pi * (110 * tr + 160 * tr**2)) * riser_env
    camadas["riser"] = riser
    ti = t - t_c
    depois = ti >= 0
    ataque = 1 - np.exp(-np.maximum(ti, 0) / 0.0015)
    fase = 2 * np.pi * (52 * ti - 9 * ti**2)
    estrondo = np.where(depois, np.sin(fase) * np.exp(-ti / 0.75) * ataque, 0.0)
    sopro = np.where(depois, faixa(rng.standard_normal(n), 60, 2500, 2) * np.exp(-ti / 0.22) * ataque, 0.0)
    anel = np.zeros(n)
    for f, a, d in ((523.0, 0.5, 1.1), (1342.0, 0.35, 0.8), (2207.0, 0.22, 0.6), (3171.0, 0.14, 0.45), (4410.0, 0.08, 0.3)):
        anel += a * np.sin(2 * np.pi * f * ti) * np.exp(-np.maximum(ti, 0) / d)
    anel = np.where(depois, anel * ataque, 0.0)
    camadas["impacto"] = 1.0 * estrondo + 0.55 * sopro + 0.22 * anel

    # Mistura em estéreo: cada camada com abertura própria (ruídos descorrelacionados por atraso curto).
    mix = np.zeros((2, n))
    for nome, sinal in camadas.items():
        ganho = 10 ** (GANHO_DB[nome] / 20)
        sinal = sinal / (np.max(np.abs(sinal)) + 1e-12)
        atraso = {"rugido": 23, "crepitar": 0, "brasa": 11, "faiscas": 0, "ambiente": 37}.get(nome, 0)
        esq = sinal
        dirt = np.roll(sinal, atraso) if atraso else sinal
        mix[0] += ganho * esq
        mix[1] += ganho * dirt
    # Cortina: easeInOutSine de 1 a 0 entre o fim do vídeo e o preto, e 4 ms de meio cosseno até zero.
    t_fim, t_preto = eventos["fim do video"], eventos["preto"]
    x = np.clip((t - t_fim) / (t_preto - t_fim), 0, 1)
    cortina = 1 - (1 - np.cos(np.pi * x)) / 2
    mix *= cortina
    return mix, camadas


def main() -> int:
    caminho, saida, semente = argumentos()
    saida.mkdir(parents=True, exist_ok=True)
    g = json.loads(caminho.read_text(encoding="utf-8"))
    mix, camadas = sintetizar(g, semente)
    mix -= mix.mean(axis=1, keepdims=True)
    # Volume: ganho até o alvo, limitador e confere de novo (duas voltas).
    for _ in range(3):
        mix *= 10 ** ((LUFS_ALVO - lufs_integrado(mix)) / 20)
        mix = limitar(mix, TETO_DBFS)
    n = mix.shape[1]
    fim4 = int(0.004 * TAXA)
    mix[:, n - fim4 :] *= (1 + np.cos(np.linspace(0, np.pi, fim4))) / 2
    mix[:, -1] = 0.0
    rng = np.random.default_rng(semente + 1)
    pcm = np.clip(np.round(mix * 32767 + (rng.random(mix.shape) - rng.random(mix.shape))), -32767, 32767).astype("<i2")
    pcm[:, -fim4 // 2 :] = 0
    entrelacado = pcm.T.reshape(-1)
    dados = entrelacado.tobytes()
    cab = b"RIFF" + (36 + len(dados)).to_bytes(4, "little") + b"WAVEfmt " + (16).to_bytes(4, "little")
    cab += (1).to_bytes(2, "little") + (2).to_bytes(2, "little") + TAXA.to_bytes(4, "little")
    cab += (TAXA * 4).to_bytes(4, "little") + (4).to_bytes(2, "little") + (16).to_bytes(2, "little")
    cab += b"data" + len(dados).to_bytes(4, "little")
    (saida / "som.wav").write_bytes(cab + dados)
    final = pcm.astype(float) / 32767

    # Envoltória a cada 10 ms (total e por camada, antes do ganho final) para o gráfico som x movimento.
    passo = int(0.01 * TAXA)
    def rms_db(x: np.ndarray) -> list[float]:
        m = x[: (x.size // passo) * passo].reshape(-1, passo)
        return [round(db(float(np.sqrt(np.mean(b**2)))), 2) for b in m]
    env = {"passo_s": 0.01, "total": rms_db(final.mean(axis=0))}
    for nome, sinal in camadas.items():
        env[nome] = rms_db(sinal / (np.max(np.abs(sinal)) + 1e-12) * 10 ** (GANHO_DB[nome] / 20))
    (saida / "envoltoria.json").write_text(json.dumps(env), encoding="utf-8")

    # Medidas e critérios.
    eventos = {e["nome"]: e["t"] for e in g["eventos"]}
    mono = final.mean(axis=0)
    t_imp, forca_imp = ataque_em(mono, eventos["climax"], 0.03)
    t_ign, forca_ign = ataque_em(faixa(mono, 40, 200, 2), eventos["ignicao"], 0.03)
    nao_nulo = np.nonzero(np.abs(pcm).max(axis=0) > 0)[0]
    ultima = (nao_nulo[-1] + 1) / TAXA if nao_nulo.size else 0.0
    janelas = np.array(rms_db(mono)).reshape(-1, 10).max(axis=1)  # máximo de cada 0,1 s
    i_alta = int(np.argmax(janelas))
    tq = np.asarray(g["curvas"]["t"])
    chama = np.asarray(g["curvas"]["chama_total"], dtype=float)
    # 180-700 Hz: acima do ambiente (que mora abaixo de 160 Hz) e abaixo do grosso do crepitar.
    rug_env = 10 ** (np.array(rms_db(faixa(mono, 180, 700, 2))) / 20)
    rug_env = np.convolve(rug_env, np.ones(25) / 25, mode="same")  # 0,25 s: tira a tremulação, fica o nível
    t_env = np.arange(rug_env.size) * 0.01
    rug_q = np.interp(tq, t_env, rug_env)
    # Depois que o whoosh da ignição morre (0,7 s) e antes do riser do clímax: só o rugido manda no grave-médio.
    trecho = (tq > eventos["ignicao"] + 0.7) & (tq < eventos["climax"] - 0.75)
    corr_mix = float(np.corrcoef(rug_q[trecho], chama[trecho])[0, 1]) if trecho.sum() > 5 else float("nan")
    # Critério: a camada do rugido (antes da mistura) segue a chama medida, da ignição ao fim do vídeo. Na mistura
    # final a janela limpa (sem whoosh nem riser) tem só 0,6 s e a tremulação pesa; esse número fica só informativo.
    camada = 10 ** (np.array(rms_db(camadas["rugido"])) / 20)
    camada = np.convolve(camada, np.ones(25) / 25, mode="same")
    camada_q = np.interp(tq, np.arange(camada.size) * 0.01, camada)
    janela = (tq >= eventos["ignicao"]) & (tq <= eventos["fim do video"] - 0.15)
    corr = float(np.corrcoef(camada_q[janela], chama[janela])[0, 1])
    lufs = lufs_integrado(final)
    tp = pico_verdadeiro(final)
    quadro = 1 / g["fps"]
    medidas = {
        "duracao_s": round(n / TAXA, 4),
        "amostras": n,
        "lufs_integrado": round(lufs, 2),
        "pico_verdadeiro_dbtp": round(tp, 2),
        "pico_amostra_dbfs": round(db(float(np.max(np.abs(final)))), 2),
        "amostras_no_limite": int(np.sum(np.abs(pcm) >= 32767)),
        "impacto": {"alvo_s": eventos["climax"], "medido_s": round(t_imp, 4), "subida_db": round(forca_imp, 1)},
        "baque_ignicao": {"alvo_s": eventos["ignicao"], "medido_s": round(t_ign, 4), "subida_db": round(forca_ign, 1)},
        "ultima_amostra_nao_nula_s": round(ultima, 4),
        "janela_mais_alta_s": round(i_alta * 0.1, 1),
        "correlacao_rugido_chama": round(corr, 3),
        "correlacao_mistura_180_700hz_informativa": round(corr_mix, 3),
    }
    criterios = {
        "lufs na faixa": LUFS_FAIXA[0] <= lufs <= LUFS_FAIXA[1],
        "pico verdadeiro <= -1 dBTP": tp <= PICO_VERDADEIRO_MAX,
        "nenhuma amostra no limite": medidas["amostras_no_limite"] == 0,
        "duracao = video + cortina": n == int(round(g["duracao_total_s"] * TAXA)),
        "impacto a 1 quadro do climax": abs(t_imp - eventos["climax"]) <= quadro and forca_imp >= 6,
        "baque a 1 quadro da ignicao": abs(t_ign - eventos["ignicao"]) <= quadro and forca_ign >= 6,
        "silencio no preto": ultima <= eventos["preto"] + 1e-9,
        "janela mais alta no climax": eventos["climax"] - 0.05 <= i_alta * 0.1 <= eventos["climax"] + 0.4,
        "rugido segue a chama (r >= 0,8)": corr >= 0.8,
    }
    medidas["criterios"] = {k: bool(v) for k, v in criterios.items()}
    medidas["passou"] = all(medidas["criterios"].values())
    (saida / "medidas-som.json").write_text(json.dumps(medidas, indent=1, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(medidas, indent=1, ensure_ascii=False))
    return 0 if medidas["passou"] else 1


sys.exit(main())
