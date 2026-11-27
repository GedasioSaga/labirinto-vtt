"""Roteiro do portão de madeira: tempos e curvas (graus, metros, segundos).

Python puro, sem bpy: o cena.py (dentro do Blender) e o som.py (Python do sistema) importam este arquivo, então
imagem e som saem da MESMA linha do tempo. Nenhum instante de evento mora em outro lugar.

O peso vem de quatro coisas, todas daqui:
- a folha não arranca de uma vez: três arrancos curtos (a madeira cede um fio, para, cede mais) antes de andar;
- quando anda, acelera devagar (inércia) e engasga duas vezes por folha (a dobradiça prende e solta: o tranco);
- chega no batente ainda andando e bate: volta 1 grau e assenta (o baque);
- a câmera treme no trinco e nas batidas e balança a cada passo quando atravessa.
"""

import math
import random

FPS = 30
DURACAO_S = 7.0
QUADROS = round(FPS * DURACAO_S)  # 210, de 0 a 209

FADE_ENTRA = (0.0, 0.8)
FADE_SAI = (6.4, 7.0)

# Destrave (a tranca fica do lado de dentro: só se vê o efeito nas folhas, na argola e na poeira)
TRINCO_ERGUE_S = 0.88  # a tranca sobe: as folhas puxam um fio para a câmera
TRINCO_DESLIZA = (1.02, 1.30)  # a barra arrasta nos suportes, em dois arranques
TRINCO_CAI_S = 1.40  # a barra bate no fim do curso: o baque do trinco
ABRE_S = 1.60

# Cada folha: arrancos (início, duração, graus), início do movimento contínuo, trancos (instante, profundidade),
# abertura final (graus) e o instante em que bate no batente. A direita vem um pouco atrás e abre menos.
FOLHAS = {
    "esq": {
        "sinal": 1.0,
        "arrancos": [(1.62, 0.18, 0.35), (1.95, 0.20, 0.60), (2.22, 0.20, 0.90)],
        "continuo": 2.32,
        "trancos": [(2.88, 0.85), (3.58, 0.70)],
        "abertura": 76.0,
        "batida": 4.80,
        "argola": 12.0,
    },
    "dir": {
        "sinal": -1.0,
        "arrancos": [(1.70, 0.18, 0.25), (2.03, 0.20, 0.50), (2.31, 0.20, 0.80)],
        "continuo": 2.42,
        "trancos": [(3.10, 0.80), (3.82, 0.65)],
        "abertura": 71.0,
        "batida": 4.93,
        "argola": 10.0,
    },
}
REBOTE_GRAUS = 1.6  # o quanto a folha volta depois de bater
ASSENTA_GRAUS = 0.5  # onde ela fica, abaixo da abertura

# Câmera em primeira pessoa
CAMERA_Y0 = -3.55
CAMERA_Z = 1.55
CAMERA_ARRASTA_M = 0.22  # chega um fio para a frente enquanto as folhas abrem (tensão, quase invisível)
CAMINHA_S = 4.95  # começa a andar logo depois da 2a batida
CAMINHA_ACELERA_S = 0.40
CAMINHA_VEL = 3.2  # m/s depois de acelerar
PASSO_PERIODO_S = 0.35
PASSOS_S = [round(CAMINHA_S + 0.17 + i * PASSO_PERIODO_S, 3) for i in range(5)]  # 5,12 ... 6,52
INCLINA_INICIO_GRAUS = 6.5  # olha um pouco para cima: o portão é grande
INCLINA_FIM_GRAUS = 1.0

# Tremor da câmera: (instante, amplitude em graus, decaimento em s)
TREMORES = [
    (TRINCO_CAI_S, 0.32, 0.22),
    (FOLHAS["esq"]["trancos"][0][0], 0.10, 0.15),
    (FOLHAS["dir"]["trancos"][0][0], 0.09, 0.15),
    (FOLHAS["esq"]["trancos"][1][0], 0.08, 0.15),
    (FOLHAS["dir"]["trancos"][1][0], 0.07, 0.15),
    (FOLHAS["esq"]["batida"], 0.55, 0.38),
    (FOLHAS["dir"]["batida"], 0.42, 0.34),
]

# Argola de bater: cai de volta na madeira a cada meio período, cada vez mais fraca
ARGOLA_MEIO_PERIODO_S = 0.30
ARGOLA_DECAI_S = 0.26

PASSO_FINO_S = 1.0 / 1200.0


def suave(a, b, x):
    """smoothstep de a até b."""
    if b == a:
        return 1.0 if x >= b else 0.0
    u = min(1.0, max(0.0, (x - a) / (b - a)))
    return u * u * (3.0 - 2.0 * u)


def _pulso(t, t0, d):
    """sin² de t0 a t0+d (integral d/2)."""
    if t < t0 or t > t0 + d:
        return 0.0
    s = math.sin(math.pi * (t - t0) / d)
    return s * s


def _prende(x):
    """A dobradiça prende: cai rápido (12 ms) e solta devagar (100 ms). Pico 1."""
    if x < 0.0:
        return 0.0
    return (1.0 - math.exp(-x / 0.012)) * math.exp(-x / 0.10) / 0.8495


def _solta(x):
    """Depois de prender, a folha escapa um pouco mais rápido (gaussiana em +0,12 s)."""
    return math.exp(-(((x - 0.12) / 0.05) ** 2))


def _base_continua(f, t):
    if t < f["continuo"] or t > f["batida"]:
        return 0.0
    v = suave(f["continuo"], f["continuo"] + 0.75, t) * (1.0 - 0.22 * suave(3.7, f["batida"], t))
    for tj, profundidade in f["trancos"]:
        v *= 1.0 - profundidade * _prende(t - tj) + 0.18 * profundidade * _solta(t - tj)
    return max(0.0, v)


def _desvio_destrave(t):
    """Antes de abrir: a tranca sobe (puxa 0,1 grau) e cai (as folhas assentam 0,22 grau, com um tremido)."""
    d = 0.0
    if t >= TRINCO_ERGUE_S:
        x = t - TRINCO_ERGUE_S
        d -= 0.10 * math.sin(math.pi * min(1.0, x / 0.5))
    if t >= TRINCO_CAI_S:
        x = t - TRINCO_CAI_S
        d += 0.22 * (1.0 - math.exp(-x / 0.02)) + 0.08 * math.exp(-x / 0.08) * math.sin(2.0 * math.pi * 9.0 * x)
    return d


def _montar_folha(f):
    n = int(DURACAO_S / PASSO_FINO_S) + 2
    dt = PASSO_FINO_S
    # velocidade sem escala do trecho contínuo, para achar a velocidade máxima que chega na abertura certa
    integral_base = sum(_base_continua(f, i * dt) for i in range(n)) * dt
    total_arrancos = sum(g for _, _, g in f["arrancos"])
    vmax = (f["abertura"] - total_arrancos) / integral_base
    angulos = [0.0] * n
    velocidades = [0.0] * n
    theta = 0.0
    for i in range(n):
        t = i * dt
        if t <= f["batida"]:
            v = vmax * _base_continua(f, t)
            for t0, d, graus in f["arrancos"]:
                v += graus * _pulso(t, t0, d) / (d / 2.0)
            theta += v * dt
            angulos[i] = theta
        else:
            x = t - f["batida"]
            rebote = REBOTE_GRAUS * (1.0 - math.exp(-x / 0.03)) * math.exp(-x / 0.30)
            assenta = ASSENTA_GRAUS * (1.0 - math.exp(-x / 0.15))
            angulos[i] = f["abertura"] - rebote - assenta
    # o encaixe exato na batida (a integral discreta erra por fração de grau)
    i_batida = int(f["batida"] / dt)
    erro = angulos[i_batida] - f["abertura"]
    for i in range(i_batida + 1):
        t = i * dt
        if t >= ABRE_S:
            angulos[i] -= erro * suave(ABRE_S, f["batida"], t)
    for i in range(n):
        angulos[i] += _desvio_destrave(i * dt)
    for i in range(1, n - 1):
        velocidades[i] = (angulos[i + 1] - angulos[i - 1]) / (2.0 * dt)
    return {"angulos": angulos, "velocidades": velocidades, "vmax": vmax}


_FOLHAS_MONTADAS = {nome: _montar_folha(f) for nome, f in FOLHAS.items()}


def _amostra(lista, t):
    x = max(0.0, min(DURACAO_S, t)) / PASSO_FINO_S
    i = int(x)
    a = x - i
    return lista[i] * (1.0 - a) + lista[min(i + 1, len(lista) - 1)] * a


def angulo(folha, t):
    """Graus de abertura da folha (positivo = abrindo para dentro, longe da câmera)."""
    return _amostra(_FOLHAS_MONTADAS[folha]["angulos"], t)


def velocidade(folha, t):
    """Graus por segundo."""
    return _amostra(_FOLHAS_MONTADAS[folha]["velocidades"], t)


def assentamento_z(t):
    """As folhas descem 4 mm quando a tranca cai (o peso volta para as dobradiças)."""
    if t < TRINCO_CAI_S:
        return 0.0
    return -0.004 * (1.0 - math.exp(-(t - TRINCO_CAI_S) / 0.03))


def argola(folha, t):
    """Graus da argola (negativo = sai para a câmera) e a lista dos instantes em que ela bate de volta."""
    f = FOLHAS[folha]
    disparos = [(TRINCO_CAI_S, f["argola"] * 0.55), (f["batida"], f["argola"] * 1.6)]
    total = 0.0
    for te, amplitude in disparos:
        if t >= te:
            x = t - te
            total -= amplitude * math.exp(-x / ARGOLA_DECAI_S) * abs(math.sin(math.pi * x / ARGOLA_MEIO_PERIODO_S))
    return total


def batidas_da_argola(folha):
    f = FOLHAS[folha]
    saida = []
    for te, amplitude in [(TRINCO_CAI_S, f["argola"] * 0.55), (f["batida"], f["argola"] * 1.6)]:
        for k in (1, 2):
            forca = amplitude * math.exp(-k * ARGOLA_MEIO_PERIODO_S / ARGOLA_DECAI_S)
            saida.append((round(te + k * ARGOLA_MEIO_PERIODO_S, 4), round(forca, 3)))
    return saida


def _caminhada(t):
    x = t - CAMINHA_S
    if x <= 0.0:
        return 0.0
    a = CAMINHA_ACELERA_S
    acel = CAMINHA_VEL / a
    if x < a:
        return 0.5 * acel * x * x
    return 0.5 * acel * a * a + CAMINHA_VEL * (x - a)


def _tremor(t):
    """(pitch, roll, z) do tremor: senóides amortecidas, frequências diferentes em cada eixo."""
    pitch = roll = z = 0.0
    for i, (te, amplitude, decai) in enumerate(TREMORES):
        if t < te:
            continue
        x = t - te
        env = amplitude * math.exp(-x / decai) * (1.0 - math.exp(-x / 0.006))
        pitch += env * math.sin(2.0 * math.pi * 8.3 * x + 0.7 * i)
        roll += 0.7 * env * math.sin(2.0 * math.pi * 6.1 * x + 1.9 + 0.3 * i)
        z += 0.004 * (env / 0.5) * math.sin(2.0 * math.pi * 7.2 * x + 0.4)
    return pitch, roll, z


def _balanco(t):
    """Balanço do passo: desce 1,6 cm no apoio, rola 0,35 grau para o lado do pé."""
    if t < PASSOS_S[0] - PASSO_PERIODO_S / 2.0:
        return 0.0, 0.0
    entra = suave(CAMINHA_S, CAMINHA_S + 0.3, t)
    fase = (t - PASSOS_S[0]) / PASSO_PERIODO_S
    z = -0.016 * entra * (0.5 + 0.5 * math.cos(2.0 * math.pi * fase))
    roll = 0.35 * entra * math.sin(math.pi * fase)
    return z, roll


def camera(t):
    """Posição (x, y, z) e rotação (inclinação para cima, rolagem, guinada) em graus."""
    y = CAMERA_Y0 + CAMERA_ARRASTA_M * suave(ABRE_S, CAMINHA_S, t) + _caminhada(t)
    pitch_t, roll_t, z_t = _tremor(t)
    z_b, roll_b = _balanco(t)
    respira = 0.12 * math.sin(2.0 * math.pi * 0.23 * t + 0.6)  # a mão nunca fica parada
    inclina = INCLINA_INICIO_GRAUS + (INCLINA_FIM_GRAUS - INCLINA_INICIO_GRAUS) * suave(CAMINHA_S, FADE_SAI[0], t)
    guinada = 0.10 * math.sin(2.0 * math.pi * 0.17 * t + 1.3)
    return {
        "pos": (0.0, y, CAMERA_Z + z_t + z_b),
        "inclina": inclina + respira + pitch_t,
        "rola": roll_t + roll_b,
        "guinada": guinada,
    }


def fade(t):
    """0 = imagem, 1 = preto. Entra em smoothstep (metade em 0,4 s), sai com ease-in (o escuro engole)."""
    a, b = FADE_ENTRA
    if t < b:
        return 1.0 - suave(a, b, t)
    a, b = FADE_SAI
    if t > a:
        u = min(1.0, (t - a) / (b - a - 1.0 / FPS))  # o último quadro já é preto: a cena seguinte entra sem salto
        return u**1.6
    return 0.0


def lampiao(t):
    """Fator de energia do lampião (chama viva, nunca parada; mesma curva sempre)."""
    lento = 0.05 * math.sin(2.0 * math.pi * 1.3 * t) + 0.03 * math.sin(2.0 * math.pi * 2.9 * t + 1.1)
    rapido = 0.025 * math.sin(2.0 * math.pi * 7.7 * t + 0.3) * math.sin(2.0 * math.pi * 0.6 * t)
    return 0.92 + lento + rapido


def eventos():
    """Todos os eventos com nome, instante e força (0 a 1); o som e a folha de contato leem daqui."""
    ev = [
        {"nome": "trinco ergue", "t": TRINCO_ERGUE_S, "forca": 0.5},
        {"nome": "trinco desliza", "t": TRINCO_DESLIZA[0], "fim": TRINCO_DESLIZA[1], "forca": 0.6},
        {"nome": "trinco cai", "t": TRINCO_CAI_S, "forca": 0.85},
    ]
    for nome, f in FOLHAS.items():
        for k, (t0, d, graus) in enumerate(f["arrancos"]):
            ev.append({"nome": f"arranco {nome} {k + 1}", "t": t0, "fim": round(t0 + d, 3), "forca": round(0.4 + 0.25 * k, 2)})
        for k, (tj, profundidade) in enumerate(f["trancos"]):
            ev.append({"nome": f"tranco {nome} {k + 1}", "t": tj, "forca": profundidade})
        ev.append({"nome": f"batida {nome}", "t": f["batida"], "forca": 1.0 if nome == "esq" else 0.9})
        for k, (tb, forca) in enumerate(batidas_da_argola(nome)):
            ev.append({"nome": f"argola {nome} {k + 1}", "t": tb, "forca": round(min(1.0, forca / 20.0), 3)})
    for k, tp in enumerate(PASSOS_S):
        ev.append({"nome": f"passo {k + 1}", "t": tp, "forca": round(0.9 - 0.12 * max(0, k - 2), 2)})
    ev.append({"nome": "fade sai", "t": FADE_SAI[0], "forca": 0.0})
    ev.append({"nome": "preto", "t": DURACAO_S, "forca": 0.0})
    return sorted(ev, key=lambda e: e["t"])


def eventos_de_poeira():
    """(instante, quantidade de grãos, x mínimo, x máximo, origem): 'verga' cai do batente, 'topo' da folha."""
    ev = [(TRINCO_CAI_S, 70, -1.7, 1.7, "verga")]
    for nome, f in FOLHAS.items():
        lado = (-1.6, 0.0) if nome == "esq" else (0.0, 1.6)
        for t0, _, _ in f["arrancos"]:
            ev.append((t0 + 0.05, 14, lado[0] * 0.5 + lado[1] * 0.5 - 0.4, lado[0] * 0.5 + lado[1] * 0.5 + 0.4, "verga"))
        for tj, profundidade in f["trancos"]:
            ev.append((tj + 0.02, int(40 * profundidade), lado[0], lado[1], "verga"))
        ev.append((f["batida"] + 0.01, 80, lado[0] - 0.1, lado[1] + 0.1, "verga"))
        ev.append((f["batida"] + 0.02, 24, 0.0, 1.0, "topo:" + nome))
    return ev


def rng(semente):
    return random.Random(semente)
