/**
 * MONTE DE JOIAS de cima com volume (lote 17 dos objetos novos, 12/11/2026, grupo Tesouro; pedido do mestre:
 * "coloque Ouro, Diamente, Joias, Moedas de ouro como objeto única e em poças"): a forma em POÇA das joias, o tesouro
 * de baú derramado no chão.
 *
 * O fundo é a MASSA de ouro velho, riscada de fios claros embaraçados (as correntes de baixo), que sobe para o meio
 * (`criarMonte`, com outra beira que a dos diamantes). Em cima dela, espalhados pela grade: anéis (o aro de ouro, uns
 * com a pedrinha), braceletes (o aro largo e fino), broches (a oval de ouro com a pedra), cachos de pérolas, pedaços
 * de corrente e pedras soltas de três cores (rubi, esmeralda, safira). Por cima de tudo, dois COLARES de pérolas e
 * duas CORRENTES de ouro embaraçados que escorrem para fora da beira; e as peças que dizem "tesouro": o CÁLICE de
 * ouro tombado, com a faixa de pedras e as pedras e pérolas que caíram da boca, o DIADEMA simples (o aro com cinco
 * pontas de pérola e a safira no meio) e o BROCHE grande com a esmeralda. Umas peças soltas fora da poça. O ouro amarra
 * tudo: as pedras são acentos escuros e pequenos, não confete. Estrelinhas de brilho pintadas; nada acende luz.
 *
 * Difere do monte de moedas (discos) e do de ouro (barras e pepitas): aqui quase não há disco cheio; são aros,
 * fios, contas e pedras. Na 3/4 sobe em três degraus (`chaoDoMonte`); cada peça sobe com o degrau mais alto que toca
 * (`degrauDaPeca`), e as peças grandes sobem inteiras.
 *
 * Tamanho de partida 1,5 x 1 casa, objeto do chão COM altura. Esticado, a poça estica e as peças não: a grade cobre
 * a pegada nova com mais peças; os colares, as correntes e as peças grandes ficam em frações da pegada (esticam o
 * caminho, não a conta nem o elo). Girado, a luz, a encosta e o brilho ficam no lugar NA TELA. Sem material a
 * escolher. Não escreve `cena.corDoPiso` (o escuro do ouro já é o marrom quente da nogueira).
 */
import { hash, misturar, type Rgb } from '../../ruido'
import { cadeia, capsula, elipseGirada, menos, poligono, type Forma, type Ponto } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, type MaterialDaPeca, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import {
  alturaNoMonte,
  aoLongo,
  arrastada,
  chaoDoMonte,
  comMeioEm,
  corrente,
  criarMonte,
  degrauDaPeca,
  desgirado,
  ESMERALDA,
  estrelinha,
  luzDaEncosta,
  luzNoDesenho,
  MASSA_DE_OURO,
  mesaDaPedra,
  noOuro,
  OURO_NA_SOMBRA,
  OURO_VELHO,
  pedraLapidada,
  perola,
  RUBI,
  rumoDaLuz,
  SAFIRA,
  type Monte,
  type NivelDoMonte,
  type Paleta,
  type PoseDaPedra,
  type Vetor,
} from './pedraLapidada'

const SEMENTE = 9700

/** Os degraus da 3/4 (profundidade) e a altura do monte no meio (casas): mais baixo que o de diamantes. */
const DEGRAUS = [0.12, 0.38, 0.62]
const ALTO = 0.11
/** A grade das peças: o passo (casas), o sacode (fração do passo) e onde as peças começam (um tico fora do fundo). */
const PASSO = 0.108
const SACODE = 0.4
const COMECO_DAS_PECAS = -0.05
/** O sorteio de cada ponto da grade, acumulado: pedra, anel, pérolas, corrente, bracelete; o resto é broche. */
const ATE_PEDRA = 0.16
const ATE_ANEL = 0.4
const ATE_PEROLAS = 0.48
const ATE_CORRENTE = 0.66
const ATE_BRACELETE = 0.87
/** As medidas (casas): a pedra solta, o anel, o bracelete, a pérola, o elo e o broche pequeno. */
const RAIO_DA_PEDRA: readonly [number, number] = [0.036, 0.014]
const RAIO_DO_ANEL: readonly [number, number] = [0.05, 0.012]
const ARO_DO_ANEL = 0.36
const CHANCE_DA_PEDRA_DO_ANEL = 0.35
const RAIO_DO_BRACELETE: readonly [number, number] = [0.084, 0.016]
const ARO_DO_BRACELETE = 0.17
const RAIO_DA_PEROLA = 0.022
const ELO = 0.03
const BROCHE: readonly [number, number] = [0.056, 0.045]
/** O quanto o aro tomba (a oval do anel deitado de lado): a fração de través, de-até. */
const TOMBO_DO_ARO: readonly [number, number] = [0.45, 1]
/** As soltas fora da poça: a faixa de profundidade e a chance de cada ponto da grade. */
const SOLTAS_DE = -0.4
const SOLTAS_ATE = -0.14
const CHANCE_DA_SOLTA = 0.18
/** A borda da pedra caída no chão, fora do fundo de ouro (a de cima do monte leva a de sempre). */
const CONTORNO_NO_CHAO = 0

/** Os colares de pérolas e as correntes de ouro: o caminho em frações da meia pegada (escorrem para fora da beira). */
const COLARES: readonly (readonly Ponto[])[] = [
  [[-0.98, 0.42], [-0.66, 0.22], [-0.36, 0.36], [-0.06, 0.16], [0.24, 0.32], [0.5, 0.1], [0.62, -0.12]],
  [[-0.46, -0.86], [-0.26, -0.46], [0.04, -0.56], [0.24, -0.3], [0.04, -0.12], [-0.22, -0.2]],
]
const PASSO_DAS_CONTAS = 2.35
const CONTA = 1.22
/** As correntes ficam dentro da poça (os colares de pérola é que escorrem para fora). */
const CORRENTES: readonly (readonly Ponto[])[] = [
  [[0.54, 0.5], [0.36, 0.4], [0.14, 0.5], [-0.14, 0.38], [-0.34, 0.5], [-0.5, 0.6]],
  [[-0.66, -0.26], [-0.5, -0.06], [-0.3, -0.28], [-0.08, -0.16], [0.14, -0.02]],
]
/** O cálice tombado: o pé (frações), o rumo do pé para a boca, o comprimento e a meia boca (casas). */
const PE_DO_CALICE: Ponto = [0.34, -0.44]
const RUMO_DO_CALICE = 0.72
const CALICE = 0.3
const MEIA_BOCA = 0.09
/** O diadema: o meio (frações), o raio e quantas pontas. */
const MEIO_DO_DIADEMA: Ponto = [-0.46, -0.1]
const DIADEMA = 0.16
const PONTAS = 5
/** O broche grande: o meio (frações) e as meias medidas (casas). */
const MEIO_DO_BROCHE: Ponto = [0.0, 0.0]
const BROCHE_GRANDE: readonly [number, number] = [0.078, 0.062]
/** A massa do fundo: os fios (a frequência por px e o limiar da crista), o tom, o contraste e o quanto segue a encosta. */
const FIO_A = 0.3
const FIO_B = 0.24
const CRISTA = 0.78
const TOM_DA_MASSA = 0.46
const CONTRASTE_DOS_FIOS = 0.38
const GANHO_DA_ENCOSTA = 1.3
const CONTORNO_DA_POCA = 0.3
/** A sombrinha das peças nas de baixo (frações do raio). */
const SOMBRA_DA_PECA = 0.3
const FORCA_DA_SOMBRA = 0.22

const MASSA: MaterialDaPeca = { classe: 'liso', rgb: MASSA_DE_OURO }
const DENTRO_DO_CALICE: MaterialDaPeca = { classe: 'liso', rgb: [88, 68, 45] }
const CORES: readonly Paleta[] = [RUBI, ESMERALDA, SAFIRA]

/**
 * A massa de ouro: o escuro, a massa e o ouro claro, pelo tom (0 a 1). O tom não desce de `PISO_DA_MASSA`: debaixo
 * de duas sombrinhas de peça o escuro do ouro passava do piso de luz do motor.
 */
const PISO_DA_MASSA = 0.18
function corDaMassa(t: number): Rgb {
  const u = Math.min(1, Math.max(PISO_DA_MASSA, t))
  return u < 0.5 ? misturar(OURO_NA_SOMBRA.rgb, MASSA_DE_OURO, u / 0.5) : misturar(MASSA_DE_OURO, OURO_VELHO.rgb, (u - 0.5) / 0.5)
}

/** A massa de ouro do fundo: duas cristas de ruído que se cruzam (os fios embaraçados) e o tom da encosta. */
function texDaMassa(monte: Monte, alto: number, luz: Vetor): Textura {
  const crista = (n: number): number => {
    const a = 1 - 2 * Math.abs(n)
    return a > CRISTA ? (a - CRISTA) / (1 - CRISTA) : 0
  }
  return (_u, _v, x, y, _p, s) => {
    const fio = Math.max(crista(ruido(x * FIO_A, y * FIO_A * 0.6)), crista(ruido(x * FIO_B * 0.6 + 31, y * FIO_B + 17)))
    const t = TOM_DA_MASSA + luzDaEncosta(monte, alto, luz, x, y) * GANHO_DA_ENCOSTA + (fio - 0.35) * CONTRASTE_DOS_FIOS
    const cor = corDaMassa(t)
    s[0] = cor[0]
    s[1] = cor[1]
    s[2] = cor[2]
  }
}

type TipoDaPeca = 'pedra' | 'anel' | 'perolas' | 'corrente' | 'bracelete' | 'broche'

interface PecaDoMonte {
  readonly tipo: TipoDaPeca
  readonly x: number
  readonly y: number
  /** O raio que ela ocupa (px): o degrau dela é o mais alto que esse disco toca. */
  readonly r: number
  readonly z: number
  readonly k: number
  readonly meio: Ponto
  readonly sorte: (n: number) => number
  readonly semente: number
}

export const montarMonteDeJoias: MontarMovel = (c, cena) => {
  const P = c.peca
  const L = cena.partes
  const { hw, hh, g } = c
  const luz = luzNoDesenho(c.giro)
  const [lx, ly] = rumoDaLuz(luz)
  const alto = ALTO * g
  const monte = criarMonte(hw, hh, SEMENTE)
  const niveis: NivelDoMonte[] = DEGRAUS.map((de, k) => ({ de, z: (alto * (k + 1)) / DEGRAUS.length }))
  const [sx, sy] = desgirado(SOMBRA_X * alto, SOMBRA_Y * alto, c.giro)
  chaoDoMonte(cena, P, hw, hh, monte, niveis, { material: MASSA, textura: texDaMassa(monte, alto, luz), contorno: CONTORNO_DA_POCA }, [sx, sy], SEMENTE)

  const ondeFica = (x: number, y: number, r: number): { k: number; meio: Ponto; z: number } => {
    const q = monte.q(x, y)
    if (q < COMECO_DAS_PECAS) return { k: -1, meio: [x, y], z: 0 }
    return { ...degrauDaPeca(monte, niveis, x, y, r), z: alturaNoMonte(q, alto) }
  }
  const projeta = (r: number) => ({ projeta: { dist: r * SOMBRA_DA_PECA, forca: FORCA_DA_SOMBRA, suave: r * 0.4 } })
  /** A pedra lapidada simples, de cor sorteada, com o meio da 3/4 no lugar dado. */
  const pedra = (x: number, y: number, r: number, cor: number, sorte: (n: number) => number, semente: number, meio: Ponto, inteira = false): PoseDaPedra => {
    const pose: PoseDaPedra = { x, y, raio: r, tombo: 0.15 + 0.6 * sorte(40), rumo: sorte(41) * 2 * Math.PI }
    // No chão (fora do fundo de ouro) a borda da pedra é mais leve: ver `OpcoesDaPedra.contorno`.
    const noChao = monte.q(meio[0], meio[1]) < DEGRAUS[0]
    pedraLapidada(L, P, pose, { paleta: CORES[Math.floor(cor * CORES.length) % CORES.length], detalhe: inteira ? 'inteira' : 'simples', luz, semente, fresta: inteira ? 0.1 : 0, culeta: inteira, meio, ...(noChao ? { contorno: CONTORNO_NO_CHAO } : {}), ...projeta(r) })
    return pose
  }
  /** O aro de ouro (anel ou bracelete) deitado, tombado numa oval. */
  const aro = (x: number, y: number, r: number, grossura: number, sorte: (n: number) => number, semente: number, meio: Ponto): void => {
    const f = TOMBO_DO_ARO[0] + (TOMBO_DO_ARO[1] - TOMBO_DO_ARO[0]) * sorte(30)
    const ang = sorte(31) * Math.PI
    const dentro = r * (1 - grossura)
    const forma = menos(elipseGirada(x, y, r, r * f, ang), elipseGirada(x, y, dentro, dentro * f, ang))
    L.push(P(comMeioEm(forma, meio[0], meio[1]), OURO_VELHO, { ...noOuro((r - dentro) * 0.5, semente, 0.92 + 0.16 * sorte(32)), ...projeta(r * 0.6) }))
  }
  const desenhar = (p: PecaDoMonte): void => {
    const { x, y, r, sorte, semente, meio } = p
    const g1 = (lo: readonly [number, number], n: number): number => g * (lo[0] + lo[1] * sorte(n))
    if (p.tipo === 'pedra') {
      pedra(x, y, r, sorte(20), sorte, semente, meio)
    } else if (p.tipo === 'anel' || p.tipo === 'bracelete') {
      aro(x, y, r, p.tipo === 'anel' ? ARO_DO_ANEL : ARO_DO_BRACELETE, sorte, semente, meio)
      if (p.tipo === 'anel' && sorte(21) < CHANCE_DA_PEDRA_DO_ANEL) {
        const a = sorte(22) * 2 * Math.PI
        pedra(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8, r * 0.42, sorte(23), sorte, semente + 10, meio)
      }
    } else if (p.tipo === 'perolas') {
      const n = 2 + Math.floor(sorte(24) * 2)
      const a0 = sorte(25) * 2 * Math.PI
      const rp = RAIO_DA_PEROLA * g
      for (let i = 0; i < n; i += 1) {
        const a = a0 + i * 0.95
        perola(L, P, x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, rp, luz, semente + i * 2, meio)
      }
    } else if (p.tipo === 'corrente') {
      const a = sorte(26) * 2 * Math.PI
      const [ca, sa] = [Math.cos(a), Math.sin(a)]
      const curva = (sorte(27) - 0.5) * r
      const pontos: Ponto[] = [[x - ca * r, y - sa * r], [x - sa * curva, y + ca * curva], [x + ca * r, y + sa * r]]
      const elo = ELO * g
      corrente(L, P, aoLongo(pontos, elo * 1.1), elo, semente, () => meio)
    } else {
      const [a, b] = [g1([BROCHE[0], 0.008], 28), g * BROCHE[1]]
      const ang = sorte(29) * Math.PI
      L.push(P(comMeioEm(elipseGirada(x, y, a, b, ang), meio[0], meio[1]), OURO_VELHO, { ...noOuro(b * 0.5, semente), ...projeta(b) }))
      pedra(x, y, b * 0.6, sorte(20), sorte, semente + 10, meio)
    }
  }

  // As peças da grade, as do monte e as soltas fora dele.
  const passo = PASSO * g
  const pecas: PecaDoMonte[] = []
  const soltas: PecaDoMonte[] = []
  for (let j = 0, y = -hh; y <= hh; j += 1, y += passo * 0.866) {
    for (let i = 0, x = -hw + (j % 2) * passo * 0.5; x <= hw; i += 1, x += passo) {
      const sorte = (n: number): number => hash(i * 7 + n, j * 13 + n, SEMENTE + n)
      const px = x + (sorte(1) - 0.5) * 2 * SACODE * passo
      const py = y + (sorte(2) - 0.5) * 2 * SACODE * passo
      const q = monte.q(px, py)
      const fora = q < COMECO_DAS_PECAS
      if (fora && !(q >= SOLTAS_DE && q <= SOLTAS_ATE && sorte(3) < CHANCE_DA_SOLTA)) continue
      const s = sorte(4)
      // Fora da poça só a pedra e o anel (as pérolas soltas no chão viravam pipoca).
      const tipo: TipoDaPeca = s < ATE_PEDRA || (fora && s >= 0.5) ? 'pedra' : s < ATE_ANEL || fora ? 'anel' : s < ATE_PEROLAS ? 'perolas' : s < ATE_CORRENTE ? 'corrente' : s < ATE_BRACELETE ? 'bracelete' : 'broche'
      const r =
        tipo === 'pedra'
          ? g * (RAIO_DA_PEDRA[0] + RAIO_DA_PEDRA[1] * sorte(5))
          : tipo === 'anel'
            ? g * (RAIO_DO_ANEL[0] + RAIO_DO_ANEL[1] * sorte(5))
            : tipo === 'bracelete'
              ? g * (RAIO_DO_BRACELETE[0] + RAIO_DO_BRACELETE[1] * sorte(5))
              : tipo === 'broche'
                ? g * BROCHE[0]
                : tipo === 'corrente'
                  ? g * PASSO * 0.6
                  : g * RAIO_DA_PEROLA * 2.4
      const onde = ondeFica(px, py, r)
      ;(fora ? soltas : pecas).push({ tipo, x: px, y: py, r, ...onde, sorte, semente: SEMENTE + 200 + ((i * 31 + j * 17) % 997) * 40 })
    }
  }

  // As soltas, no chão, com a sombrinha delas.
  soltas.forEach((p) => {
    const base = elipseGirada(p.x, p.y, p.r * 0.8, p.r * 0.8, 0)
    const [ox, oy] = desgirado(SOMBRA_X * p.r, SOMBRA_Y * p.r, c.giro)
    cena.sombras.push(contato(base, 0.26), { forma: arrastada(base, ox, oy), z: 0, suave: 1, forca: 0.18 })
    desenhar(p)
  })
  // As do monte, degrau por degrau, da mais baixa para a mais alta.
  pecas.sort((a, b) => a.k - b.k || a.z - b.z || a.y - b.y)
  pecas.forEach(desenhar)

  // Os colares e as correntes por cima: cada conta e cada elo sobem com o degrau que tocam.
  COLARES.forEach((caminho, n) => {
    aoLongo(caminho.map(([fx, fy]): Ponto => [fx * hw, fy * hh]), PASSO_DAS_CONTAS).forEach(([x, y], i) => {
      perola(L, P, x, y, CONTA, luz, SEMENTE + 3000 + n * 200 + i * 2, ondeFica(x, y, CONTA).meio)
    })
  })
  CORRENTES.forEach((caminho, n) => {
    const elo = ELO * g
    const pontos = aoLongo(caminho.map(([fx, fy]): Ponto => [fx * hw, fy * hh]), elo * 1.1)
    corrente(L, P, pontos, elo, SEMENTE + 3500 + n * 200, (i) => ondeFica(pontos[i][0], pontos[i][1], elo).meio)
  })

  // As peças grandes: o cálice tombado, o diadema e o broche grande; e os brilhos.
  const brilhos: [number, number, number, Ponto][] = []
  calice()
  diadema()
  broche()
  brilhos.forEach(([x, y, braco, meio], k) => estrelinha(L, P, x, y, braco, SEMENTE + 4900 + k * 2, meio))

  function calice(): void {
    const comprimento = CALICE * g
    const boca = MEIA_BOCA * g
    const [bx, by] = [PE_DO_CALICE[0] * hw, PE_DO_CALICE[1] * hh]
    const [ux, uy] = [Math.cos(RUMO_DO_CALICE), Math.sin(RUMO_DO_CALICE)]
    const em = (u: number, v: number): Ponto => [bx + ux * u - uy * v, by + uy * u + ux * v]
    const [mx, my] = em(comprimento / 2, 0)
    const { meio } = ondeFica(mx, my, comprimento / 2)
    const nm = (f: Forma): Forma => comMeioEm(f, meio[0], meio[1])
    const s = SEMENTE + 4000
    const pe = em(0, 0)
    L.push(P(nm(elipseGirada(pe[0], pe[1], 1.3, boca * 0.85, RUMO_DO_CALICE)), OURO_VELHO, { ...noOuro(1, s), ...projeta(3) }))
    const [h0, h1] = [em(0.8, 0), em(comprimento * 0.36, 0)]
    L.push(P(nm(capsula(h0[0], h0[1], h1[0], h1[1], 0.95)), OURO_VELHO, { ...noOuro(0.9, s + 1), ...projeta(2) }))
    const no = em(comprimento * 0.2, 0)
    L.push(P(nm(elipseGirada(no[0], no[1], 1.2, 1.7, RUMO_DO_CALICE)), OURO_VELHO, noOuro(1.1, s + 2)))
    // O bojo: do fim da haste até a boca, em taça (o fundo redondo, a parede quase reta perto da boca; em cone ele
    // virava um sino).
    const meiaLargura = (t: number): number => 1.3 + (boca - 1.3) * (1 - (1 - t) ** 2.4)
    const lado = (sinal: number): Ponto[] =>
      Array.from({ length: 9 }, (_, i): Ponto => {
        const t = i / 8
        return em(comprimento * (0.36 + 0.64 * t), sinal * meiaLargura(t))
      })
    L.push(P(nm(poligono([...lado(1), ...lado(-1).reverse()])), OURO_VELHO, { ...noOuro(boca * 0.75, s + 3), contorno: 0.32, ...projeta(boca) }))
    // A faixa de pedras no bojo.
    for (let i = -1; i <= 1; i += 1) {
      const t = 0.55
      const [gx, gy] = em(comprimento * (0.36 + 0.64 * t), i * meiaLargura(t) * 0.55)
      pedra(gx, gy, 1.15, (i + 1.5) / 3, (n) => hash(i + 5, n, s), s + 10 + (i + 1) * 20, meio)
    }
    // A boca, aberta para quem olha: a beira de ouro e o escuro de dentro.
    const b = em(comprimento, 0)
    L.push(P(nm(elipseGirada(b[0], b[1], 2.7, boca, RUMO_DO_CALICE)), OURO_VELHO, noOuro(0.8, s + 80, 1.08)))
    const d = em(comprimento + 0.25, 0)
    L.push(P(nm(elipseGirada(d[0], d[1], 1.9, boca - 1, RUMO_DO_CALICE)), DENTRO_DO_CALICE, { bisel: 0, contorno: 0, semente: s + 81 }))
    brilhos.push([b[0] - uy * boca * 0.6, b[1] + ux * boca * 0.6, 2.6, meio])
    // O que caiu da boca: pedras e pérolas em leque, cada uma no degrau dela (ou no chão).
    for (let i = 0; i < 6; i += 1) {
      const h = (n: number): number => hash(i, n, s + 90)
      const [x, y] = em(comprimento + 2.5 + h(1) * 6, (h(2) - 0.5) * boca * 2.4)
      const onde = ondeFica(x, y, 1.6)
      if (i % 3 === 2) perola(L, P, x, y, CONTA, luz, s + 100 + i * 2, onde.meio)
      else pedra(x, y, 1.5 + h(3) * 0.7, h(4), h, s + 120 + i * 20, onde.meio)
    }
  }

  function diadema(): void {
    const R = DIADEMA * g
    const [cx, cy] = [MEIO_DO_DIADEMA[0] * hw, MEIO_DO_DIADEMA[1] * hh]
    const { meio } = ondeFica(cx, cy, R)
    const nm = (f: Forma): Forma => comMeioEm(f, meio[0], meio[1])
    const s = SEMENTE + 4400
    const [a0, a1] = [Math.PI + 0.45, 2 * Math.PI - 0.45]
    const noAro = (a: number, raio: number): Ponto => [cx + Math.cos(a) * raio, cy + Math.sin(a) * raio * 0.82]
    const arco = Array.from({ length: 13 }, (_, i): Ponto => noAro(a0 + ((a1 - a0) * i) / 12, R))
    L.push(P(nm(cadeia(arco, 1.3)), OURO_VELHO, { ...noOuro(0.9, s), ...projeta(3) }))
    for (let i = 0; i < PONTAS; i += 1) {
      const a = a0 + ((a1 - a0) * (i + 0.5)) / PONTAS
      const alta = i === Math.floor(PONTAS / 2)
      const ponta = noAro(a, R + (alta ? 4.2 : 3))
      const [e1, e2] = [noAro(a - 0.14, R + 0.6), noAro(a + 0.14, R + 0.6)]
      L.push(P(nm(poligono([e1, ponta, e2])), OURO_VELHO, noOuro(0.6, s + 1 + i, 1.04)))
      perola(L, P, ponta[0], ponta[1], alta ? 1.1 : 0.95, luz, s + 20 + i * 2, meio)
    }
    const [gx, gy] = noAro(1.5 * Math.PI, R)
    const pose = pedra(gx, gy, 1.9, 0.9, (n) => hash(3, n, s), s + 40, meio, true)
    const [tx, ty] = mesaDaPedra(pose)
    brilhos.push([tx + lx * 0.8, ty + ly * 0.8, 2.4, meio])
  }

  function broche(): void {
    const [a, b] = [BROCHE_GRANDE[0] * g, BROCHE_GRANDE[1] * g]
    const [cx, cy] = [MEIO_DO_BROCHE[0] * hw, MEIO_DO_BROCHE[1] * hh]
    const { meio } = ondeFica(cx, cy, a)
    const nm = (f: Forma): Forma => comMeioEm(f, meio[0], meio[1])
    const s = SEMENTE + 4600
    const ang = -0.35
    L.push(P(nm(elipseGirada(cx, cy, a, b, ang)), OURO_VELHO, { ...noOuro(1.4, s), contorno: 0.34, ...projeta(a) }))
    for (let i = 0; i < 14; i += 1) {
      const t = (i / 14) * 2 * Math.PI
      const [px, py] = [cx + Math.cos(t) * a * 0.86 * Math.cos(ang) - Math.sin(t) * b * 0.86 * Math.sin(ang), cy + Math.cos(t) * a * 0.86 * Math.sin(ang) + Math.sin(t) * b * 0.86 * Math.cos(ang)]
      L.push(P(nm(elipseGirada(px, py, 0.62, 0.62, 0)), OURO_VELHO, { ...noOuro(0.6, s + 1 + i), metal: 0.62 }))
    }
    const pose = pedra(cx, cy, b * 0.62, 0.5, (n) => hash(7, n, s), s + 40, meio, true)
    const [tx, ty] = mesaDaPedra(pose)
    brilhos.push([tx + lx * b * 0.3, ty + ly * b * 0.3, b * 0.75, meio])
  }
}
