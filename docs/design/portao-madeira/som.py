"""Som do portão: sintetizado do zero, na linha do tempo do grafico.json que o cena.py escreveu.

    python som.py <grafico.json> <saida>   (Python do sistema: numpy, scipy, matplotlib; mais node e ffmpeg)

Escreve em <saida>: som.wav (48 kHz, 16 bits, estéreo, 7,0 s), medidas-som.json (com `passou`) e
som-e-movimento.png (curvas da animação em cima, envoltória do som embaixo, mesmo eixo de tempo). Sai com 1 se algum
critério falhar. Nenhuma amostra de terceiros: tudo é ruído filtrado, ressonadores e senóides (CC0 por construção).
Mesma semente, mesmo wav. Medir não é ouvir: os números conferem volume, pico, cliques e o casamento com a animação;
timbre e gosto só o ouvido decide.

Camadas: rangido grave das duas dobradiças (atrito gruda-solta excitando os modos da folha, guiado pela velocidade
angular de cada folha), trinco (ergue, arrasta, cai), trancos (a dobradiça prende: estalo e pancada de madeira),
baque surdo das batidas, argola batendo na madeira, passos em pedra, pó caindo, ar parado do lugar. Reverb de pedra
(convolução com resposta sintética de 2 s) em envio.
"""

import json
import math
import os
import subprocess
import sys

import numpy as np
from scipy import signal

TAXA = 48000
SEMENTE = 1979
ALVO_LUFS = -20.0
TETO_DBTP = -1.5
PASTA = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(PASTA, "..", "..", ".."))

# ganhos de mixagem em dB (os botões para ajustar depois de ouvir)
GANHO_DB = {
    "rangido": 0.0,
    "gemido": -6.0,
    "trinco": -3.0,
    "tranco": 4.0,
    "batida": 3.0,
    "argola": -12.0,
    "passos": 4.0,
    "poeira": -24.0,
    "ambiente": -20.0,
}
# a resposta tem energia 1 espalhada em ~2 s: com envio acima de -10 dB a cauda de um tranco cobria o tranco seguinte
REVERB_ENVIO_DB = {"rangido": -19.0, "gemido": -22.0, "trinco": -15.0, "tranco": -16.0, "batida": -12.0, "argola": -17.0, "passos": -14.0, "poeira": -26.0}
RT60_S = 2.0
# modos graves da folha (Hz, Q, ganho): dão o "corpo" do rangido; a direita é um pouco mais aguda
MODOS_FOLHA = [(68, 6, 1.0), (112, 8, 0.85), (171, 10, 0.75), (255, 12, 0.6), (384, 14, 0.42), (598, 16, 0.26), (915, 18, 0.13)]
PAN = {"esq": -0.45, "dir": 0.45}


# ================================================================ utilidades
def ler_grafico(caminho):
    with open(caminho, encoding="utf-8") as arq:
        return json.load(arq)


def sos(tipo, freq, ordem=2):
    return signal.butter(ordem, freq, btype=tipo, fs=TAXA, output="sos")


def filtrar(x, tipo, freq, ordem=2):
    return signal.sosfilt(sos(tipo, freq, ordem), x)


def ressonar(x, freq, q):
    b, a = signal.iirpeak(freq, q, fs=TAXA)
    return signal.lfilter(b, a, x)


def ataque(n, ms):
    """Rampa de meio cosseno nas primeiras `ms` (nada começa em degrau: degrau é clique)."""
    k = max(2, int(TAXA * ms / 1000.0))
    env = np.ones(n)
    k = min(k, n)
    env[:k] = 0.5 - 0.5 * np.cos(np.linspace(0.0, math.pi, k))
    return env


def modal(freqs, decaimentos, amps, dur, ataque_ms=1.5, fase=0.0):
    n = int(dur * TAXA)
    tt = np.arange(n) / TAXA
    y = np.zeros(n)
    for f, d, a in zip(freqs, decaimentos, amps):
        y += a * np.sin(2.0 * math.pi * f * tt + fase) * np.exp(-tt / d)
    return y * ataque(n, ataque_ms)


def estalo_de_ruido(rng, dur, banda, decai, ataque_ms=1.5):
    n = int(dur * TAXA)
    tt = np.arange(n) / TAXA
    x = filtrar(rng.standard_normal(n), "bandpass", banda, 2)
    return x * np.exp(-tt / decai) * ataque(n, ataque_ms)


def baque_grave(dur, f_ini, f_fim, tau_f, decai, ataque_ms=3.0):
    n = int(dur * TAXA)
    tt = np.arange(n) / TAXA
    freq = f_fim + (f_ini - f_fim) * np.exp(-tt / tau_f)
    fase = 2.0 * math.pi * np.cumsum(freq) / TAXA
    return np.sin(fase) * np.exp(-tt / decai) * ataque(n, ataque_ms)


def normalizar(x):
    pico = np.max(np.abs(x))
    return x / pico if pico > 0 else x


def colocar(destino, sinal_mono, t0, ganho=1.0, pan=0.0):
    """Soma um sinal mono no buffer estéreo em t0, com pan de potência constante."""
    i0 = int(round(t0 * TAXA))
    if i0 >= destino.shape[1]:
        return
    sinal_mono = sinal_mono[: destino.shape[1] - i0]
    ang = (pan + 1.0) * math.pi / 4.0
    destino[0, i0 : i0 + len(sinal_mono)] += ganho * math.cos(ang) * sinal_mono
    destino[1, i0 : i0 + len(sinal_mono)] += ganho * math.sin(ang) * sinal_mono


def suave(a, b, x):
    u = np.clip((x - a) / (b - a), 0.0, 1.0)
    return u * u * (3.0 - 2.0 * u)


def db(v):
    return 20.0 * math.log10(v) if v > 0 else -math.inf


# ================================================================ camadas
def camada_rangido(g, n, rng):
    """Duas vozes (uma por folha): trem de pulsos gruda-solta com taxa e força guiadas por |velocidade angular|."""
    linhas = np.array(g["velocidade_fina"]["linhas"])
    tt = np.arange(n) / TAXA
    rangido = np.zeros((2, n))
    gemido = np.zeros((2, n))
    for coluna, nome, fator in ((1, "esq", 1.0), (2, "dir", 1.08)):
        vel = np.abs(np.interp(tt, linhas[:, 0], linhas[:, coluna]))
        taxa = 24.0 + 2.3 * vel  # Hz do gruda-solta: grave e lento no arranco, mais agudo andando
        forca = suave(0.25, 3.0, vel) * (0.55 + 0.45 * np.minimum(1.0, vel / 40.0))
        frase = 0.62 + 0.38 * normalizar(filtrar(rng.standard_normal(n), "lowpass", 2.2, 2))
        forca = forca * np.clip(frase, 0.25, 1.0)
        pulsos = np.zeros(n)
        fase = 0.0
        desvio = 0.0
        sorteio = rng.random(n)
        normais = rng.standard_normal(n)
        for i in range(n):
            if forca[i] <= 1e-4:
                continue
            fase += taxa[i] * (1.0 + 0.14 * desvio) / TAXA
            if fase >= 1.0:
                fase -= 1.0
                pulsos[i] = forca[i] * (0.65 + 0.7 * sorteio[i])
                desvio = normais[i]
        corpo = np.zeros(n)
        for f, q, a in MODOS_FOLHA:
            corpo += a * ressonar(pulsos, f * fator, q)
        fibra = filtrar(pulsos, "bandpass", (1400.0 * fator, 4200.0), 2) * 0.10  # a fibra da madeira raspando
        voz = corpo + fibra
        colocar(rangido, voz, 0.0, 1.0, PAN[nome])
        # gemido: o peso; ruído abaixo de 130 Hz seguindo a força, muito baixo
        baixo = filtrar(rng.standard_normal(n), "lowpass", 130.0, 4) * suave(0.5, 6.0, vel)
        colocar(gemido, baixo, 0.0, 1.0, PAN[nome] * 0.5)
    return rangido, gemido


def camada_trinco(eventos, n, rng):
    buf = np.zeros((2, n))
    for e in eventos:
        if e["nome"] == "trinco ergue":
            raspa = estalo_de_ruido(rng, 0.16, (1200.0, 4200.0), 0.05, 4.0) * 0.35
            tinido = modal([880, 2105, 3320], [0.16, 0.10, 0.06], [0.5, 0.3, 0.15], 0.4, 1.5)
            colocar(buf, raspa, e["t"], 1.0, 0.0)
            colocar(buf, tinido, e["t"] + 0.01, 0.6, 0.05)
        elif e["nome"] == "trinco desliza":
            dur = e["fim"] - e["t"]
            m = int(dur * TAXA)
            tt = np.arange(m) / TAXA
            # dois arranques: arrasta, para um instante, arrasta de novo
            env = suave(0.0, 0.015, tt) * (1.0 - suave(0.08, 0.10, tt)) + suave(0.13, 0.15, tt) * (1.0 - suave(dur - 0.02, dur, tt))
            taxa = 38.0 + 22.0 * np.sin(math.pi * tt / dur)
            fase = np.cumsum(taxa) / TAXA
            gruda = (np.diff(np.floor(fase), prepend=0.0) > 0).astype(float)
            atrito = filtrar(rng.standard_normal(m), "bandpass", (500.0, 3200.0), 2) * 0.25 + gruda * 3.0
            metal = ressonar(atrito, 1240.0, 14) + 0.6 * ressonar(atrito, 2380.0, 16) + 0.4 * ressonar(atrito, 610.0, 9)
            colocar(buf, normalizar(metal) * env * 0.55, e["t"], 1.0, 0.0)
        elif e["nome"] == "trinco cai":
            clangor = modal([238, 607, 1176, 1733, 2648, 3905], [0.45, 0.34, 0.24, 0.17, 0.11, 0.07], [1.0, 0.7, 0.5, 0.35, 0.22, 0.12], 0.9, 1.2)
            surdo = baque_grave(0.5, 96.0, 58.0, 0.05, 0.15)
            madeira = modal([108, 168, 257], [0.2, 0.16, 0.11], [0.6, 0.45, 0.3], 0.5, 2.0)
            colocar(buf, normalizar(clangor) * 0.75, e["t"], 1.0, 0.05)
            colocar(buf, normalizar(surdo) * 0.9, e["t"], 1.0, 0.0)
            colocar(buf, normalizar(madeira) * 0.6, e["t"] + 0.002, 1.0, 0.0)
    return buf


def camada_trancos(eventos, n, rng):
    buf = np.zeros((2, n))
    for e in eventos:
        nome = e["nome"]
        if nome.startswith("tranco ") or nome.startswith("arranco "):
            folha = nome.split()[1]
            forte = (0.7 + 0.3 * e["forca"]) if nome.startswith("tranco ") else 0.35 * e["forca"]
            pancada = modal([94, 158, 241, 409], [0.18, 0.14, 0.10, 0.06], [1.0, 0.75, 0.5, 0.3], 0.6, 2.0)
            lasca = estalo_de_ruido(rng, 0.08, (700.0, 2600.0), 0.018, 1.5) * 1.5  # o estalo seco da fibra: é ele que marca o tranco
            colocar(buf, normalizar(pancada) * forte, e["t"], 1.0, PAN[folha])
            colocar(buf, lasca * forte, e["t"], 1.0, PAN[folha])
            if nome.startswith("tranco "):
                # a dobradiça prendendo: um guincho curto que desce de 170 para 85 Hz
                m = int(0.16 * TAXA)
                tt = np.arange(m) / TAXA
                taxa = 85.0 + 85.0 * np.exp(-tt / 0.05)
                pulsos = (np.diff(np.floor(np.cumsum(taxa) / TAXA), prepend=0.0) > 0).astype(float)
                guincho = sum(a * ressonar(pulsos, f * 1.3, q) for f, q, a in MODOS_FOLHA[2:6])
                guincho = normalizar(guincho) * np.exp(-tt / 0.07) * ataque(m, 3.0)
                colocar(buf, guincho * 0.7 * forte, e["t"], 1.0, PAN[folha])
    return buf


def camada_batidas(eventos, n, rng):
    buf = np.zeros((2, n))
    for e in eventos:
        if not e["nome"].startswith("batida "):
            continue
        folha = e["nome"].split()[1]
        f = e["forca"]
        surdo = baque_grave(1.4, 74.0, 39.0, 0.08, 0.36, 3.0)
        corpo = filtrar(np.random.default_rng(SEMENTE + int(e["t"] * 1000)).standard_normal(int(0.8 * TAXA)), "lowpass", 260.0, 4)
        corpo = corpo * np.exp(-np.arange(len(corpo)) / TAXA / 0.17) * ataque(len(corpo), 3.0)
        madeira = modal([86, 129, 195, 283, 418, 636], [0.5, 0.42, 0.33, 0.24, 0.15, 0.09], [1.0, 0.8, 0.62, 0.45, 0.3, 0.16], 1.4, 2.5)
        ferro = modal([523, 1307, 2236, 3481], [0.24, 0.17, 0.11, 0.07], [0.6, 0.4, 0.25, 0.12], 0.6, 1.0)
        colocar(buf, normalizar(surdo) * 1.0 * f, e["t"], 1.0, PAN[folha] * 0.6)
        colocar(buf, normalizar(corpo) * 0.55 * f, e["t"], 1.0, PAN[folha] * 0.6)
        colocar(buf, normalizar(madeira) * 0.75 * f, e["t"] + 0.002, 1.0, PAN[folha] * 0.7)
        estalo = estalo_de_ruido(rng, 0.12, (300.0, 2600.0), 0.022, 1.5)  # o estalo da madeira no batente
        colocar(buf, normalizar(estalo) * 0.45 * f, e["t"], 1.0, PAN[folha] * 0.7)
        for k, atraso in enumerate((0.012, 0.075, 0.13)):  # a folga da dobradiça chacoalha
            colocar(buf, normalizar(ferro) * 0.16 * f / (k + 1), e["t"] + atraso, 1.0, PAN[folha])
    return buf


def camada_argola(eventos, n, rng):
    buf = np.zeros((2, n))
    for e in eventos:
        if not e["nome"].startswith("argola "):
            continue
        folha = e["nome"].split()[1]
        ferro = modal([781, 1957, 3349, 4902], [0.11, 0.075, 0.05, 0.03], [1.0, 0.6, 0.35, 0.15], 0.3, 0.8)
        toque = modal([522, 897], [0.03, 0.02], [1.0, 0.6], 0.1, 0.8)
        colocar(buf, normalizar(ferro) * 0.8 * e["forca"], e["t"], 1.0, PAN[folha] * 0.8)
        colocar(buf, normalizar(toque) * 0.6 * e["forca"], e["t"], 1.0, PAN[folha] * 0.8)
    return buf


def camada_passos(eventos, n, rng):
    buf = np.zeros((2, n))
    k = 0
    for e in eventos:
        if not e["nome"].startswith("passo "):
            continue
        lado = -0.12 if k % 2 == 0 else 0.12
        k += 1
        var = 1.0 + 0.06 * rng.standard_normal()
        calcanhar = estalo_de_ruido(rng, 0.12, (160.0 * var, 2400.0 * var), 0.032, 1.6)
        grave = baque_grave(0.2, 92.0 * var, 62.0, 0.02, 0.05, 2.0)
        sola = filtrar(rng.standard_normal(int(0.07 * TAXA)), "bandpass", (2200.0, 7000.0), 2)
        sola = sola * np.exp(-np.arange(len(sola)) / TAXA / 0.025) * ataque(len(sola), 4.0)
        cascalho = np.zeros(int(0.1 * TAXA))
        for _ in range(9):
            i = int(rng.uniform(0.0, 0.08) * TAXA)
            cascalho[i] += rng.uniform(0.3, 1.0)
        cascalho = filtrar(cascalho, "bandpass", (2500.0, 8000.0), 2)
        f = e["forca"]
        colocar(buf, normalizar(calcanhar) * 0.8 * f, e["t"], 1.0, lado)
        colocar(buf, normalizar(grave) * 0.55 * f, e["t"], 1.0, lado)
        colocar(buf, normalizar(sola) * 0.25 * f, e["t"] + 0.055, 1.0, lado)
        colocar(buf, normalizar(cascalho) * 0.18 * f, e["t"] + 0.01, 1.0, lado)
    return buf


def camada_poeira(g, n, rng):
    curvas = g["curvas"]
    tq = np.array([c["t"] for c in curvas])
    pq = np.array([c["poeira"] for c in curvas])
    tt = np.arange(n) / TAXA
    forca = np.interp(tt, tq, pq)
    chiado = filtrar(rng.standard_normal(n), "bandpass", (2500.0, 9000.0), 2) * 0.25
    graos = (rng.random(n) < (70.0 / TAXA) * np.minimum(1.0, forca)).astype(float) * rng.uniform(0.3, 1.0, n)
    graos = filtrar(graos, "bandpass", (3000.0, 9500.0), 2) * 2.5
    mono = (chiado + graos) * np.minimum(1.0, forca)
    buf = np.zeros((2, n))
    colocar(buf, mono, 0.0, 1.0, -0.1)
    colocar(buf, filtrar(mono, "highpass", 4000.0, 2), 0.0, 0.5, 0.2)
    return buf


def camada_ambiente(n, rng, t_cruza):
    tt = np.arange(n) / TAXA
    marrom = filtrar(np.cumsum(rng.standard_normal(n)) * 0.02, "bandpass", (25.0, 140.0), 2)
    ar = filtrar(rng.standard_normal(n), "bandpass", (240.0, 720.0), 2)
    ar = ar * (0.6 + 0.4 * normalizar(filtrar(rng.standard_normal(n), "lowpass", 0.6, 2)))
    dentro = suave(t_cruza - 0.15, t_cruza + 0.25, tt)  # do outro lado do portão o ar é mais grave e fechado
    esq = normalizar(marrom) * (1.0 + 0.4 * dentro) + 0.35 * normalizar(ar) * (1.0 - 0.5 * dentro)
    dir_ = np.roll(esq, int(0.013 * TAXA))
    return np.vstack([esq, dir_]) * 0.5


def resposta_de_pedra(rng):
    m = int(2.4 * TAXA)
    tt = np.arange(m) / TAXA
    ir = np.zeros((2, m))
    for c in range(2):
        cauda = rng.standard_normal(m) * np.exp(-6.91 * tt / RT60_S)
        cauda = filtrar(cauda, "lowpass", 3200.0, 2) * suave(0.0, 0.02, tt)
        for atraso, ganho in ((0.013, 0.5), (0.023 + 0.004 * c, 0.4), (0.037, 0.32), (0.051 - 0.003 * c, 0.25), (0.069, 0.18)):
            ir[c, int(atraso * TAXA)] += ganho * (1 if c == 0 else -1) ** int(atraso * 1000)
        ir[c] += cauda * 0.08
    return ir / np.sqrt(np.sum(ir**2, axis=1, keepdims=True))


def aplicar_reverb(seco, ir, envio_db):
    ganho = 10.0 ** (envio_db / 20.0)
    molhado = np.vstack([signal.fftconvolve(seco[0] + 0.3 * seco[1], ir[0])[: seco.shape[1]], signal.fftconvolve(seco[1] + 0.3 * seco[0], ir[1])[: seco.shape[1]]])
    return molhado * ganho


# ================================================================ volume, pico, medidas
def lufs_integrado(x):
    """BS.1770-4: ponderação K (coeficientes de 48 kHz), blocos de 400 ms com 75%, porta absoluta e relativa."""
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621]
    k = np.vstack([signal.lfilter(b2, a2, signal.lfilter(b1, a1, c)) for c in x])
    bloco, passo = int(0.4 * TAXA), int(0.1 * TAXA)
    z = np.array([np.sum(np.mean(k[:, i : i + bloco] ** 2, axis=1)) for i in range(0, k.shape[1] - bloco + 1, passo)])
    nivel = -0.691 + 10.0 * np.log10(np.maximum(z, 1e-20))
    z = z[nivel > -70.0]
    rel = -0.691 + 10.0 * np.log10(np.mean(z)) - 10.0
    nivel = -0.691 + 10.0 * np.log10(np.maximum(z, 1e-20))
    return float(-0.691 + 10.0 * np.log10(np.mean(z[nivel > rel])))


def pico_verdadeiro(x):
    return float(np.max(np.abs(signal.resample_poly(x, 4, 1, axis=1))))


def limitar(x, teto_lin):
    """Limitador com antecipação de 3 ms: ganho pelo pico (sobreamostrado 4x) numa janela, solta em 120 ms."""
    sobre = np.max(np.abs(signal.resample_poly(x, 4, 1, axis=1)), axis=0).reshape(-1, 4).max(axis=1)[: x.shape[1]]
    janela = int(0.003 * TAXA)
    pico = np.array(sobre)
    for d in range(1, janela + 1):
        pico[:-d] = np.maximum(pico[:-d], sobre[d:])
    # alvo[i] já é o mínimo do ganho necessário em [i, i+3 ms]; a média dos 3 ms anteriores dele fica sempre abaixo do
    # ganho necessário em i e vira uma rampa (sem degrau de ganho, que estalaria)
    alvo = np.minimum(1.0, teto_lin / np.maximum(pico, 1e-12))
    rampa = np.convolve(alvo, np.ones(janela) / janela)[: len(alvo)]
    rampa[:janela] = np.minimum(rampa[:janela], alvo[:janela])
    ganho = np.empty_like(rampa)
    g = 1.0
    solta = math.exp(-1.0 / (0.12 * TAXA))
    for i in range(len(rampa)):
        g = rampa[i] if rampa[i] < g else rampa[i] + (g - rampa[i]) * solta
        ganho[i] = g
    return x * ganho


def detectar_ataque(mono, t_esperado, janela_s=1.0 / 60.0):
    """Maior subida dentro de ±1 quadro do esperado: energia de 4 ms sobre a média dos 20 ms anteriores, em dB.

    O sinal passa antes por um passa-alta de 120 Hz: o grave do baque anterior ainda soando escondia o ataque seguinte.
    """
    passo = int(0.001 * TAXA)
    curto, longo = int(0.004 * TAXA), int(0.020 * TAXA)
    melhor = (-math.inf, None)
    i0 = int((t_esperado - janela_s) * TAXA)
    i1 = int((t_esperado + janela_s) * TAXA)
    for i in range(max(longo, i0), min(len(mono) - curto, i1), passo):
        e_curto = np.mean(mono[i : i + curto] ** 2)
        e_longo = np.mean(mono[i - longo : i] ** 2) + 1e-14
        subida = 10.0 * math.log10(e_curto / e_longo + 1e-14)
        if subida > melhor[0]:
            melhor = (subida, i / TAXA)
    return melhor[1], melhor[0]


def medir_com_a_casa(wav):
    """LUFS, pico, cortes, DC e cliques pelo scripts/som/medidas.cjs da casa (o mesmo das transições aprovadas)."""
    medidor = os.path.join(PASTA, "ferramentas", "medir-wav.cjs")
    saida = subprocess.run(["node", medidor, wav], capture_output=True, text=True, check=True)
    return json.loads(saida.stdout)


def medir_ffmpeg(wav):
    saida = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", wav, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True)
    texto = saida.stderr
    resumo = texto[texto.rfind("Summary:") :]
    lufs = pico = None
    for linha in resumo.splitlines():
        linha = linha.strip()
        if linha.startswith("I:"):
            lufs = float(linha.split()[1])
        if linha.startswith("Peak:"):
            pico = float(linha.split()[1])
    return lufs, pico


# ================================================================ gráfico
def desenhar(g, camadas, final, eventos, caminho):
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    curvas = g["curvas"]
    tq = [c["t"] for c in curvas]
    fundo, texto, grade = "#111214", "#d8d4cc", "#2a2c30"
    plt.rcParams.update({"axes.facecolor": fundo, "figure.facecolor": fundo, "axes.edgecolor": grade, "text.color": texto, "axes.labelcolor": texto, "xtick.color": texto, "ytick.color": texto, "font.size": 9})
    fig, eixos = plt.subplots(3, 1, figsize=(13, 9), sharex=True, gridspec_kw={"height_ratios": [1.1, 0.8, 1.4]})
    a = eixos[0]
    a.plot(tq, [c["angulo_esq"] for c in curvas], color="#e0a458", lw=1.6, label="folha esquerda (graus)")
    a.plot(tq, [c["angulo_dir"] for c in curvas], color="#c97b3c", lw=1.2, ls="--", label="folha direita (graus)")
    a.set_ylabel("abertura (graus)")
    a2 = a.twinx()
    a2.plot(tq, [c["cam_y"] for c in curvas], color="#7fa7c9", lw=1.2, label="câmera y (m)")
    a2.plot(tq, [-c["fade"] * 4 for c in curvas], color="#666", lw=1.0, ls=":", label="fade (preto = -4)")
    a2.set_ylabel("câmera y (m)")
    a.legend(loc="upper left", fontsize=8, facecolor=fundo, edgecolor=grade)
    a2.legend(loc="center left", fontsize=8, facecolor=fundo, edgecolor=grade)
    a.set_title("Movimento (a cada quadro, 30 fps) e som (RMS em janelas de 10 ms) na mesma linha do tempo", fontsize=10)
    b = eixos[1]
    b.plot(tq, [abs(c["vel_esq"]) for c in curvas], color="#e0a458", lw=1.2, label="|vel| esquerda (graus/s)")
    b.plot(tq, [abs(c["vel_dir"]) for c in curvas], color="#c97b3c", lw=1.0, ls="--", label="|vel| direita")
    b.plot(tq, [c["poeira"] * 40 for c in curvas], color="#9a9a8a", lw=1.0, label="poeira x40")
    b.plot(tq, [c["cam_inclina"] * 4 for c in curvas], color="#7fa7c9", lw=0.8, alpha=0.7, label="inclinação da câmera x4 (tremor)")
    b.legend(loc="upper left", fontsize=8, facecolor=fundo, edgecolor=grade)
    c = eixos[2]
    passo = int(0.01 * TAXA)

    def rms_db(x):
        mono = np.mean(x, axis=0)
        m = len(mono) // passo
        r = np.sqrt(np.mean(mono[: m * passo].reshape(m, passo) ** 2, axis=1))
        return np.arange(m) * 0.01 + 0.005, 20.0 * np.log10(np.maximum(r, 1e-6))

    cores = {"rangido": "#e0a458", "batida": "#e05a47", "trinco": "#b8c4cf", "tranco": "#d98f5f", "passos": "#7fa7c9", "argola": "#c9c27f", "poeira": "#8a8a7a", "ambiente": "#555a60"}
    for nome, x in camadas.items():
        if nome in cores:
            t_, v = rms_db(x)
            c.plot(t_, v, color=cores[nome], lw=0.8, alpha=0.85, label=nome)
    t_, v = rms_db(final)
    c.plot(t_, v, color="#f2efe8", lw=1.4, label="mix final")
    c.set_ylim(-80, 0)
    c.set_ylabel("dBFS (RMS 10 ms)")
    c.set_xlabel("tempo (s)")
    c.legend(loc="upper left", fontsize=7.5, ncol=5, facecolor=fundo, edgecolor=grade)
    for e in eventos:
        if e["nome"].startswith(("trinco", "tranco", "batida", "passo", "fade", "preto")):
            for ax in eixos:
                ax.axvline(e["t"], color="#3a3d42", lw=0.7, zorder=0)
            c.text(e["t"], -78, e["nome"], rotation=90, fontsize=6.5, color="#9a958c", va="bottom", ha="right")
    for ax in eixos:
        ax.grid(color=grade, lw=0.5)
        ax.set_xlim(0, g["duracao_s"])
    fig.tight_layout()
    fig.savefig(caminho, dpi=110)
    plt.close(fig)


# ================================================================ principal
def principal():
    if len(sys.argv) < 3:
        raise SystemExit("uso: python som.py <grafico.json> <saida>")
    g = ler_grafico(sys.argv[1])
    saida = sys.argv[2]
    os.makedirs(saida, exist_ok=True)
    rng = np.random.default_rng(SEMENTE)
    n = int(round(g["duracao_s"] * TAXA))
    eventos = g["eventos"]
    t_cruza = next(c["t"] for c in g["curvas"] if c["cam_y"] >= 0.0)

    rangido, gemido = camada_rangido(g, n, rng)
    camadas = {
        "rangido": rangido,
        "gemido": gemido,
        "trinco": camada_trinco(eventos, n, rng),
        "tranco": camada_trancos(eventos, n, rng),
        "batida": camada_batidas(eventos, n, rng),
        "argola": camada_argola(eventos, n, rng),
        "passos": camada_passos(eventos, n, rng),
        "poeira": camada_poeira(g, n, rng),
        "ambiente": camada_ambiente(n, rng, t_cruza),
    }
    # cada camada vai ao pico 1 antes do ganho de mixagem (os ganhos ficam legíveis em dB)
    for nome in camadas:
        camadas[nome] = normalizar(camadas[nome]) * 10.0 ** (GANHO_DB[nome] / 20.0)
    ir = resposta_de_pedra(rng)
    mix = sum(camadas.values())
    for nome, envio in REVERB_ENVIO_DB.items():
        mix = mix + aplicar_reverb(camadas[nome], ir, envio)
    mix = mix - np.mean(mix, axis=1, keepdims=True)

    # o som acompanha o fade da imagem: entra com o ambiente, sai com o preto e termina em silêncio digital
    tt = np.arange(n) / TAXA
    tq = np.array([c["t"] for c in g["curvas"]] + [g["duracao_s"]])
    fq = np.array([c["fade"] for c in g["curvas"]] + [1.0])
    fade = np.interp(tt, tq, fq)
    saida_fade = np.where(tt >= 6.0, fade, 0.0)
    envelope = (1.0 - saida_fade) ** 1.1
    entra = np.where(tt < 0.9, 1.0 - fade, 1.0)
    envelope = envelope * np.where(tt < 0.9, 0.15 + 0.85 * entra, 1.0)
    envelope[:int(0.004 * TAXA)] *= np.linspace(0.0, 1.0, int(0.004 * TAXA))
    k = int(0.004 * TAXA)
    envelope[-k:] *= 0.5 + 0.5 * np.cos(np.linspace(0.0, math.pi, k))
    mix = mix * envelope

    # volume no alvo e pico verdadeiro abaixo do teto (duas voltas: o limitador mexe no volume)
    teto = 10.0 ** (TETO_DBTP / 20.0)
    for _ in range(3):
        mix = mix * 10.0 ** ((ALVO_LUFS - lufs_integrado(mix)) / 20.0)
        mix = limitar(mix, teto)
    mix[:, -1] = 0.0

    # 16 bits com dither triangular
    dither = (rng.random(mix.shape) - rng.random(mix.shape)) / 32768.0
    pcm = np.clip(np.round((mix + dither) * 32767.0), -32767, 32767).astype("<i2")
    pcm[:, -k:] = np.round(mix[:, -k:] * 32767.0).astype("<i2")
    wav = os.path.join(saida, "som.wav")
    escrever_wav(wav, pcm)

    final = pcm.astype(float) / 32767.0
    casa = medir_com_a_casa(wav)
    lufs_ff, pico_ff = medir_ffmpeg(wav)
    mono = np.mean(final, axis=0)
    mono_agudo = filtrar(mono, "highpass", 120.0, 2)
    checagens = []

    def conferir(nome, valor, passou, meta):
        checagens.append({"nome": nome, "valor": valor, "meta": meta, "passou": bool(passou)})

    conferir("LUFS integrado (ffmpeg ebur128)", lufs_ff, lufs_ff is not None and -23.0 <= lufs_ff <= -18.0, "-23 a -18")
    conferir("pico verdadeiro dBTP (ffmpeg ebur128)", pico_ff, pico_ff is not None and pico_ff <= -1.0, "<= -1")
    conferir("pico verdadeiro dBTP (medidas.cjs)", casa["picoVerdadeiroDbtp"], casa["picoVerdadeiroDbtp"] <= -1.0, "<= -1")
    conferir("amostras cortadas (medidas.cjs)", casa["cortes"], casa["cortes"] == 0, "0")
    conferir("cliques (medidas.cjs detectarCliques)", len(casa["cliques"]), len(casa["cliques"]) == 0, "0")
    conferir("offset DC % (medidas.cjs)", casa["dcPct"], abs(casa["dcPct"]) <= 0.5, "<= 0,5")
    conferir("amostras = duração x 48 kHz", final.shape[1], final.shape[1] == n, str(n))
    ultimo = float(np.max(np.abs(final[:, -int(0.001 * TAXA) :])))
    conferir("último 1 ms (pico)", round(ultimo, 6), ultimo < 10.0 ** (-60 / 20), "< -60 dBFS")
    alinhados = []
    for e in eventos:
        if e["nome"].startswith(("trinco ergue", "trinco cai", "tranco", "batida", "passo")) and e["t"] < 6.45:
            achado, subida = detectar_ataque(mono_agudo, e["t"])
            erro_ms = None if achado is None else round((achado - e["t"]) * 1000.0, 1)
            ok = achado is not None and abs(achado - e["t"]) <= 1.0 / 60.0 and subida >= 6.0
            alinhados.append({"evento": e["nome"], "t": e["t"], "achado": None if achado is None else round(achado, 4), "erro_ms": erro_ms, "subida_db": round(subida, 1), "passou": ok})
    conferir("eventos achados a ±16,7 ms (1 quadro) com subida >= 6 dB", f"{sum(a['passou'] for a in alinhados)}/{len(alinhados)}", all(a["passou"] for a in alinhados), "todos")
    passo = int(0.1 * TAXA)
    m = len(mono) // passo
    janelas = np.sqrt(np.mean(mono[: m * passo].reshape(m, passo) ** 2, axis=1))
    t_alto = (int(np.argmax(janelas)) + 0.5) * 0.1
    conferir("janela de 0,1 s mais alta cai nas batidas (4,75 a 5,15 s)", round(t_alto, 2), 4.75 <= t_alto <= 5.15, "4,75 a 5,15")
    antes = janelas[: int(1.6 / 0.1)]
    rel_inicio = db(float(np.max(antes)) / float(np.max(janelas)))
    conferir("destrave (0 a 1,6 s) abaixo das batidas (dB)", round(rel_inicio, 1), rel_inicio <= -3.0, "<= -3")

    passou = all(c["passou"] for c in checagens)
    medidas = {"passou": passou, "checagens": checagens, "eventos": alinhados, "casa": {k_: casa[k_] for k_ in ("lufsIntegrado", "picoVerdadeiroDbtp", "picoDbfs", "cortes", "dcPct", "cliques", "ataques")}, "aviso": "medir não é ouvir: ninguém ouviu este som ainda; timbre e gosto só o ouvido decide"}
    with open(os.path.join(saida, "medidas-som.json"), "w", encoding="utf-8") as arq:
        json.dump(medidas, arq, ensure_ascii=False, indent=1)
    desenhar(g, camadas, final, eventos, os.path.join(saida, "som-e-movimento.png"))
    for c in checagens:
        print(f"{'ok  ' if c['passou'] else 'FALHOU'} {c['nome']}: {c['valor']} (meta {c['meta']})")
    for a in alinhados:
        if not a["passou"]:
            print(f"   evento fora: {a}")
    print("PASSOU" if passou else "NÃO PASSOU", "· medir não é ouvir: ninguém ouviu este som ainda.")
    sys.exit(0 if passou else 1)


def escrever_wav(caminho, pcm):
    import wave

    with wave.open(caminho, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(TAXA)
        w.writeframes(np.ascontiguousarray(pcm.T).tobytes())


if __name__ == "__main__":
    principal()
