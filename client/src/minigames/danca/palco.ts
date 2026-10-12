import { hashTexto } from './coreografia'
import { EASE_IN_OUT, interpolar, limitar } from './curvas'
import type { TrilhaDanca } from './tipos'

/**
 * PALCO EM PIXEL ART: a porta de pedra ao fundo com as runas, o holofote, o
 * chão em perspectiva, você de costas no centro e até 4 colegas (jogadores de
 * verdade) menores ao redor. Canvas de baixa resolução em escala inteira.
 * A geometria e as poses são contas puras (testáveis); só `prepararCenario`,
 * `desenharFigura` e `desenharPalco` pintam.
 */

// ------------------------------------------------------------------ figuras

export interface DimensoesDaFigura {
  perna: number
  tronco: number
  larg: number
  cab: number
  /** Braço: do ombro ao cotovelo e do cotovelo à mão. */
  b1: number
  b2: number
  /** Espessura do braço e da perna. */
  espB: number
  espP: number
  pe: number
  ombro: number
}

export const DIM: { readonly grande: DimensoesDaFigura; readonly pequeno: DimensoesDaFigura } = {
  grande: { perna: 13, tronco: 15, larg: 12, cab: 10, b1: 7, b2: 6, espB: 2, espP: 3, pe: 5, ombro: 6 },
  pequeno: { perna: 9, tronco: 11, larg: 9, cab: 8, b1: 5, b2: 4, espB: 1, espP: 2, pe: 4, ombro: 4 },
}

export type EstiloDoCabelo = 'curto' | 'rabo' | 'gorro' | 'coque'

export interface VisualDoDancarino {
  cabelo: string
  cabeloLuz: string
  pele: string
  tunica: string
  tunicaSombra: string
  calca: string
  bota: string
  cinto: string
  /** Lenço no pescoço: só você usa, para se achar no meio do grupo. */
  lenco: { cor: string; sombra: string } | null
  gorro: string | null
  estilo: EstiloDoCabelo
}

export const VISUAL_VOCE: VisualDoDancarino = {
  cabelo: '#3b2a1e', cabeloLuz: '#5d4431', pele: '#c98d62', tunica: '#3f6f8f', tunicaSombra: '#2e546d',
  calca: '#4b3b2f', bota: '#2a1d14', cinto: '#5a3c22', lenco: { cor: '#e2645a', sombra: '#a9473f' }, gorro: null, estilo: 'curto',
}

/**
 * Paletas dos colegas, por ordem de chegada. As duas primeiras são as do
 * protótipo (Iara e Tomé); as duas novas seguem o mesmo tom contido, com
 * túnica de cor e silhueta de cabeça diferentes para não se confundirem.
 */
export const VISUAL_COLEGAS: readonly VisualDoDancarino[] = [
  {
    cabelo: '#1f1612', cabeloLuz: '#3a2a20', pele: '#a8714d', tunica: '#5f7f45', tunicaSombra: '#475f33',
    calca: '#3b3329', bota: '#231a12', cinto: '#6b4a2a', lenco: null, gorro: null, estilo: 'rabo',
  },
  {
    cabelo: '#8a6a3a', cabeloLuz: '#a8854f', pele: '#d9a57c', tunica: '#6b5590', tunicaSombra: '#52406f',
    calca: '#3a3240', bota: '#211a20', cinto: '#4a3a2a', lenco: null, gorro: '#a8473f', estilo: 'gorro',
  },
  {
    cabelo: '#2b2420', cabeloLuz: '#463a32', pele: '#8d5a3b', tunica: '#8a6a35', tunicaSombra: '#6b5128',
    calca: '#3a3128', bota: '#221a13', cinto: '#4f3a24', lenco: null, gorro: null, estilo: 'coque',
  },
  {
    cabelo: '#b9b2a6', cabeloLuz: '#d3cdc2', pele: '#c4916b', tunica: '#8a4c3e', tunicaSombra: '#6a3a30',
    calca: '#33303a', bota: '#1f1a1e', cinto: '#5a4030', lenco: null, gorro: null, estilo: 'curto',
  },
]

/** No palco cabem 4 colegas; o resto aparece só na lista da mesa. */
export const COLEGAS_NO_PALCO = 4

export function visualDoColega(indice: number): VisualDoDancarino {
  return VISUAL_COLEGAS[((indice % VISUAL_COLEGAS.length) + VISUAL_COLEGAS.length) % VISUAL_COLEGAS.length]
}

export const CONTORNO = '#110d0a'

export type Braco = 'baixo' | 'fora' | 'cima' | 'diag' | 'quadril' | 'agita' | 'solto'
/** Ângulo do braço (graus, 0 = para fora, 90 = para baixo): do ombro ao cotovelo e do cotovelo à mão. */
const ANG: Readonly<Record<Braco, readonly [number, number]>> = {
  baixo: [80, 92],
  fora: [0, -10],
  cima: [-72, -90],
  diag: [-38, -50],
  quadril: [52, 150],
  agita: [-55, -105],
  solto: [28, 62],
}

export interface Pose {
  /** Braço esquerdo e direito. */
  bE: Braco
  bD: Braco
  /** 0 em pé, 1 agachado (↓), 2 caído. */
  agacha: number
  /** Deslocamento do quadril, em px (−1, 0, 1). */
  quadril: number
  /** Inclinação do tronco: −1 a 1 na dança, ±2 no tropeço. */
  incl: number
  /** Pulo (↑ sozinho), em px. */
  pulo: number
  /** Lado da perna que tropeça, só no tropeço. */
  tropeco?: number
}

export const POSE_PARADA: Pose = { bE: 'baixo', bD: 'baixo', agacha: 0, quadril: 0, incl: 0, pulo: 0 }
/** Errou na Diversão: só um "ops". */
export const POSE_OPS: Pose = { bE: 'solto', bD: 'baixo', agacha: 0, quadril: 0, incl: 1, pulo: 0 }
/** Vida zerou no Expert. */
export const POSE_CAIU: Pose = { bE: 'quadril', bD: 'quadril', agacha: 2, quadril: 0, incl: 0, pulo: 0 }

export function poseTropeco(lado: number): Pose {
  return { bE: lado > 0 ? 'solto' : 'agita', bD: lado > 0 ? 'agita' : 'solto', agacha: 0, quadril: lado, incl: 2 * lado, pulo: 0, tropeco: lado }
}

/** A pose das setas tocadas juntas (uma ou um salto); `lado` alterna o quadril a cada ↓. */
export function poseDe(lanes: ReadonlySet<TrilhaDanca>, lado: number): Pose {
  const E = lanes.has(0)
  const B = lanes.has(1)
  const C = lanes.has(2)
  const D = lanes.has(3)
  const p: Pose = { bE: 'baixo', bD: 'baixo', agacha: 0, quadril: 0, incl: 0, pulo: 0 }
  if (B) {
    p.agacha = 1
    p.bE = 'quadril'
    p.bD = 'quadril'
    p.quadril = lado
  }
  if (C) {
    p.bE = 'cima'
    p.bD = 'cima'
    if (!B) p.pulo = 1
  }
  if (E) {
    p.bE = C ? 'diag' : 'fora'
    if (!D && !C) {
      p.incl = -1
      if (!B) p.bD = 'quadril'
    }
  }
  if (D) {
    p.bD = C ? 'diag' : 'fora'
    if (!E && !C) {
      p.incl = 1
      if (!B) p.bE = 'quadril'
    }
  }
  return p
}

type Ponto = [number, number]
export interface BracoDaFigura {
  ombro: Ponto
  cotovelo: Ponto
  mao: Ponto
}

export interface PontosDaFigura {
  /** Centro do quadril e altura do quadril e do ombro. */
  qX: number
  qY: number
  oY: number
  /** Quanto o topo do tronco anda com a inclinação. */
  dxTopo: number
  cabX: number
  esq: BracoDaFigura
  dir: BracoDaFigura
  /** Quanto a figura desceu agachando. */
  ag: number
}

/** Geometria da figura (px do palco), com os pés em (x, y). O desenho e o gráfico do movimento usam a mesma conta. */
export function pontosFigura(x: number, y: number, D: DimensoesDaFigura, pose: Pose, bob = 0): PontosDaFigura {
  const ag = pose.agacha ? Math.round(D.perna * (pose.agacha > 1 ? 0.55 : 0.3)) : 0
  const qY = y - D.perna + ag + bob - pose.pulo
  const qX = x + pose.quadril
  const oY = qY - D.tronco + 1
  const inc = pose.incl
  const dxTopo = Math.round((inc * D.tronco) / 8)
  const braco = (lado: number): BracoDaFigura => {
    const [a1, a2] = ANG[lado < 0 ? pose.bE : pose.bD].map((a) => ((lado < 0 ? 180 - a : a) * Math.PI) / 180)
    const ox = qX + dxTopo + lado * D.ombro
    const oy = oY + 1
    const cx = ox + Math.cos(a1) * D.b1
    const cy = oy + Math.sin(a1) * D.b1
    return { ombro: [ox, oy], cotovelo: [cx, cy], mao: [cx + Math.cos(a2) * D.b2, cy + Math.sin(a2) * D.b2] }
  }
  return { qX, qY, oY, dxTopo, cabX: qX + Math.round((inc * (D.tronco + D.cab * 0.6)) / 8), esq: braco(-1), dir: braco(1), ag }
}

/** Retângulo e traço de pixels; o passe 0 pinta o contorno 1 px maior, o passe 1 a cor. */
interface Pincel {
  R(px: number, py: number, w: number, h: number, cor: string): void
  L(x0: number, y0: number, x1: number, y1: number, esp: number, cor: string): void
}

function pincelDoPasse(g: CanvasRenderingContext2D, passe: 0 | 1): Pincel {
  return {
    R(px, py, w, h, cor) {
      if (passe === 0) {
        g.fillStyle = CONTORNO
        g.fillRect(px - 1, py - 1, w + 2, h + 2)
      } else {
        g.fillStyle = cor
        g.fillRect(px, py, w, h)
      }
    },
    L(x0, y0, x1, y1, esp, cor) {
      const s = passe === 0 ? esp + 2 : esp
      const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))))
      g.fillStyle = passe === 0 ? CONTORNO : cor
      for (let i = 0; i <= n; i += 1) g.fillRect(Math.round(x0 + ((x1 - x0) * i) / n - s / 2), Math.round(y0 + ((y1 - y0) * i) / n - s / 2), s, s)
    },
  }
}

function pintarPernas(pc: Pincel, x: number, y: number, D: DimensoesDaFigura, pose: Pose, V: VisualDoDancarino, P: PontosDaFigura): void {
  const pd = D.larg >= 12 ? 3 : 2
  for (const lado of [-1, 1]) {
    const hx = P.qX + lado * pd
    const hy = P.qY + 1
    const fx = x + lado * (pd + (P.ag ? 1 : 0))
    if (pose.tropeco && lado === pose.tropeco) {
      pc.L(hx, hy, hx + lado * 3, hy + 4, D.espP, V.calca)
      pc.L(hx + lado * 3, hy + 4, hx + lado * 2, hy + 8, D.espP, V.calca)
      pc.R(hx + lado * 2 - 2, hy + 7, D.pe - 1, 2, V.bota)
    } else if (P.ag) {
      const jx = hx + lado * (P.ag > 4 ? 5 : 3)
      const jy = hy + (y - hy) * 0.5
      pc.L(hx, hy, jx, jy, D.espP, V.calca)
      pc.L(jx, jy, fx, y - 2, D.espP, V.calca)
      pc.R(lado < 0 ? fx - D.pe + 2 : fx - 1, y - 2, D.pe, 2, V.bota)
    } else {
      pc.L(hx, hy, fx, y - 2, D.espP, V.calca)
      pc.R(lado < 0 ? fx - D.pe + 2 : fx - 1, y - 2, D.pe, 2, V.bota)
    }
  }
}

function pintarCorpo(pc: Pincel, D: DimensoesDaFigura, pose: Pose, V: VisualDoDancarino, P: PontosDaFigura, cabTopo: number): void {
  // Tronco: paralelogramo, linha a linha (a inclinação sobe do quadril).
  for (let ry = P.oY; ry <= P.qY; ry += 1) {
    const dx = Math.round((pose.incl * (P.qY - ry)) / 8)
    const w = ry > P.qY - 3 ? D.larg - 2 : D.larg
    pc.R(P.qX - (w >> 1) + dx, ry, w, 1, V.tunica)
  }
  // Braços: manga da túnica até o cotovelo, pele até a mão.
  for (const b of [P.esq, P.dir]) {
    pc.L(b.ombro[0], b.ombro[1], b.cotovelo[0], b.cotovelo[1], D.espB + 1, V.tunica)
    pc.L(b.cotovelo[0], b.cotovelo[1], b.mao[0], b.mao[1], D.espB, V.pele)
    pc.R(Math.round(b.mao[0]) - 1, Math.round(b.mao[1]) - 1, 2, 2, V.pele)
  }
  // Pescoço e cabeça (de costas: só cabelo).
  const hx = P.cabX
  const w = D.cab
  pc.R(hx - 2, P.oY - 2, 4, 2, V.pele)
  pc.R(hx - (w >> 1) + 1, cabTopo, w - 2, 1, V.cabelo)
  pc.R(hx - (w >> 1), cabTopo + 1, w, w - 2, V.cabelo)
  pc.R(hx - (w >> 1) + 1, cabTopo + w - 1, w - 2, 1, V.cabelo)
  if (V.estilo === 'rabo') pc.L(hx + 1, cabTopo + w - 2, hx + 2 - pose.incl, cabTopo + w + 4, 2, V.cabelo)
  if (V.estilo === 'coque') pc.R(hx - 2, cabTopo - 2, 4, 2, V.cabelo)
}

/** Detalhes sem contorno: sombra da túnica, cinto, orelhas, brilho do cabelo, gorro, lenço e a luz do holofote. */
function pintarDetalhes(g: CanvasRenderingContext2D, D: DimensoesDaFigura, pose: Pose, V: VisualDoDancarino, P: PontosDaFigura, cabTopo: number, luz: number): void {
  const hx = P.cabX
  const w = D.cab
  g.fillStyle = V.tunicaSombra
  for (let ry = P.oY + 1; ry < P.qY - 1; ry += 1) {
    const dx = Math.round((pose.incl * (P.qY - ry)) / 8)
    g.fillRect(P.qX + dx, ry, 1, 1)
    g.fillRect(P.qX + (D.larg >> 1) - 2 + dx, ry, 2, 1)
  }
  g.fillStyle = V.cinto
  g.fillRect(P.qX - (D.larg >> 1) + 1, P.qY - 2, D.larg - 2, 1)
  g.fillStyle = V.pele
  g.fillRect(hx - (w >> 1) - 1, cabTopo + (w >> 1), 1, 2)
  g.fillRect(hx + (w >> 1), cabTopo + (w >> 1), 1, 2)
  g.fillStyle = V.cabeloLuz
  g.fillRect(hx - (w >> 1) + 2, cabTopo + 1, 3, 1)
  g.fillRect(hx - (w >> 1) + 1, cabTopo + 2, 1, 2)
  if (V.estilo === 'coque') g.fillRect(hx - 1, cabTopo - 2, 2, 1)
  if (V.gorro !== null) {
    g.fillStyle = V.gorro
    g.fillRect(hx - (w >> 1), cabTopo, w, 3)
    g.fillStyle = CONTORNO
    g.fillRect(hx - (w >> 1), cabTopo + 3, w, 1)
  }
  if (V.lenco !== null) {
    g.fillStyle = V.lenco.cor
    g.fillRect(hx - 4, P.oY - 1, 8, 2)
    const cauda = -pose.incl * 2 + pose.quadril
    for (let i = 0; i < 6; i += 1) {
      g.fillStyle = i > 3 ? V.lenco.sombra : V.lenco.cor
      g.fillRect(hx + 2 + Math.round((cauda * i) / 6), P.oY + 1 + i, 2, 1)
    }
  }
  if (luz > 0) {
    g.fillStyle = `rgba(255,236,200,${0.45 * luz})`
    g.fillRect(hx - (w >> 1) + 1, cabTopo - 1, w - 2, 1)
    g.fillRect(P.qX - (D.larg >> 1) + P.dxTopo, P.oY - 1, 3, 1)
    g.fillRect(P.qX + (D.larg >> 1) - 3 + P.dxTopo, P.oY - 1, 3, 1)
  }
}

/** Contorno inteiro primeiro, cor depois: assim o contorno de um membro nunca corta a cor de outro. */
const PASSES: readonly (0 | 1)[] = [0, 1]

/** Desenha um dançarino de costas com os pés em (x, y). `luz` 0-1 é o brilho do holofote no topo. */
export function desenharFigura(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  D: DimensoesDaFigura,
  pose: Pose,
  V: VisualDoDancarino,
  luz: number,
  bob = 0,
): void {
  const P = pontosFigura(x, y, D, pose, bob)
  const cabTopo = P.oY - D.cab - 1
  for (const passe of PASSES) {
    const pc = pincelDoPasse(g, passe)
    pintarPernas(pc, x, y, D, pose, V, P)
    pintarCorpo(pc, D, pose, V, P, cabTopo)
  }
  pintarDetalhes(g, D, pose, V, P, cabTopo, luz)
}

// ------------------------------------------------------------------ dançarino no tempo

export interface Dancarino {
  pose: Pose
  /** Até quando (s de música) a pose vale; depois volta a parada. */
  ate: number
  lado: number
  ultimoT: number
  /** Setas tocadas juntas (salto) na pose atual. */
  lanes: Set<TrilhaDanca> | null
  /** Vida zerou no Expert: fica caído até o fim. */
  caiu: boolean
}

export function novoDancarino(): Dancarino {
  return { pose: POSE_PARADA, ate: -1, lado: 1, ultimoT: -9, lanes: null, caiu: false }
}

/** Duas setas a menos de 60 ms uma da outra são o mesmo salto. */
const JANELA_DO_SALTO_S = 0.06
const DURACAO_DO_ERRO_S = 0.42
/** A pose fica no ar 3/4 de batida, nunca menos de 0,24 s. */
const POSE_MINIMA_S = 0.24
const POSE_EM_BATIDAS = 0.75

/**
 * O dançarino reage a uma seta (ou a um erro). Muda o dançarino recebido.
 * Devolve true quando tropeçou de verdade (erro no Expert): é a hora da poeira.
 */
export function dancar(d: Dancarino, lane: TrilhaDanca, st: number, batidaS: number, erro: 'nao' | 'tropeco' | 'ops' = 'nao'): boolean {
  if (d.caiu) return false
  if (erro !== 'nao') {
    d.lado = -d.lado
    d.pose = erro === 'ops' ? POSE_OPS : poseTropeco(d.lado)
    d.ate = st + DURACAO_DO_ERRO_S
    return erro === 'tropeco'
  }
  if (st - d.ultimoT < JANELA_DO_SALTO_S && d.lanes !== null) d.lanes.add(lane)
  else d.lanes = new Set([lane])
  d.ultimoT = st
  if (lane === 1) d.lado = -d.lado
  d.pose = poseDe(d.lanes, d.lado)
  d.ate = st + Math.max(POSE_MINIMA_S, batidaS * POSE_EM_BATIDAS)
  return false
}

/** O primeiro quarto de cada batida desce 1 px: o balanço de quem espera a próxima seta. */
const QUARTO_DO_BALANCO = 0.25

/**
 * Pose a desenhar na posição `st`. `balanca` = em jogo e sem movimento
 * reduzido: parado, o dançarino balança na batida.
 */
export function poseNoTempo(d: Dancarino, st: number, ritmo: { batidaS: number; grade0: number }, balanca: boolean): { pose: Pose; bob: number } {
  if (d.caiu) return { pose: POSE_CAIU, bob: 0 }
  if (st <= d.ate) return { pose: d.pose, bob: 0 }
  const fase = ritmo.batidaS > 0 ? ((((st - ritmo.grade0) / ritmo.batidaS) % 1) + 1) % 1 : 0
  return { pose: POSE_PARADA, bob: balanca && fase < QUARTO_DO_BALANCO ? 1 : 0 }
}

export interface GraoDePoeira {
  x: number
  y: number
  vx: number
  vy: number
  /** Opacidade; some ao chegar a 0. */
  a: number
}

/** Seis grãos saindo dos pés de você, quando tropeça. */
export function soltarPoeira(geo: { w: number; peY: number }): GraoDePoeira[] {
  const graos: GraoDePoeira[] = []
  for (let i = 0; i < 6; i += 1) graos.push({ x: geo.w / 2 + (i - 2.5) * 3, y: geo.peY - 1, vx: (i - 2.5) * 6, vy: -8 - (i % 3) * 4, a: 0.8 })
  return graos
}

const GRAVIDADE_DA_POEIRA = 40
const SUMICO_DA_POEIRA_POR_S = 2

/** Anda a poeira `dt` segundos (muda os grãos) e devolve só os que ainda aparecem. */
export function avancarPoeira(graos: readonly GraoDePoeira[], dt: number): GraoDePoeira[] {
  return graos.filter((p) => {
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.vy += GRAVIDADE_DA_POEIRA * dt
    p.a -= dt * SUMICO_DA_POEIRA_POR_S
    return p.a > 0
  })
}

/** Holofote pelo combo: 10, 25 e 50 abrem um nível cada. */
export function nivelDoCombo(c: number): number {
  return c >= 50 ? 3 : c >= 25 ? 2 : c >= 10 ? 1 : 0
}

/** O holofote troca de nível em ~0,12 s, sem salto. */
const TEMPO_DO_HOLOFOTE_S = 0.12

export function suavizarHolofote(atual: number, alvo: number, dt: number): number {
  return atual + (alvo - atual) * (1 - Math.exp(-dt / TEMPO_DO_HOLOFOTE_S))
}

/** A partir do combo 25 o chão acende na batida; no 50, mais forte. */
export function chaoDoNivel(nivel: number): number {
  return nivel >= 2 ? (nivel === 3 ? 1 : 0.7) : 0
}

/** Runas da placa: acendem uma por quarto da música, enquanto a nota ao vivo está passando. */
export function runasAcesas(passando: boolean, progresso: number): number[] {
  return [0, 1, 2, 3].map((i) => (passando && progresso > i / 4 ? 1 : 0))
}

// ------------------------------------------------------------------ porta

/** Runas da placa sobre a porta, 5x5: ← ↓ ↑ →. */
export const RUNAS: readonly (readonly string[])[] = [
  ['..#..', '.#...', '#####', '.#...', '..#..'],
  ['..#..', '..#..', '#.#.#', '.###.', '..#..'],
  ['..#..', '.###.', '#.#.#', '..#..', '..#..'],
  ['..#..', '...#.', '#####', '...#.', '..#..'],
]

/** A porta leva 2,4 s para abrir: runas, fresta de luz, folhas. */
export const PORTA_DUR = 2.4
/** Com movimento reduzido, tudo junto em 0,4 s. */
const PORTA_REDUZIDA_S = 0.4

export interface EstadoDaPorta {
  runas: number[]
  fresta: number
  abre: number
  luz: number
}

/** Estado da porta no tempo `s` (segundos desde que abriu; null = fechada). Usado no desenho e no gráfico do movimento. */
export function estadoPorta(s: number | null, reduzido: boolean): EstadoDaPorta {
  if (s === null || s < 0) return { runas: [0, 0, 0, 0], fresta: 0, abre: 0, luz: 0 }
  if (reduzido) {
    const k = limitar(s / PORTA_REDUZIDA_S, 0, 1)
    return { runas: [k, k, k, k], fresta: 0, abre: k, luz: k }
  }
  const runas = [0, 1, 2, 3].map((i) => limitar((s - i * 0.12) / 0.16, 0, 1))
  const fresta = limitar((s - 0.6) / 0.3, 0, 1)
  const abre = EASE_IN_OUT(limitar((s - 0.9) / 1.5, 0, 1))
  return { runas, fresta, abre, luz: Math.max(fresta * 0.6, abre) }
}

// ------------------------------------------------------------------ geometria do palco

/** Uma pedra pintada; muda é o ladrilho que acende na batida. */
export interface Ladrilho {
  x: number
  y: number
  w: number
  h: number
  par: number
}

export interface FileiraDoChao {
  y: number
  alt: number
  ladrilhos: Ladrilho[]
}

export interface GeometriaDoPalco {
  w: number
  h: number
  /** Onde a parede encontra o chão. */
  base: number
  /** Pés de você. */
  peY: number
  porta: { cx: number; larg: number; alt: number; x0: number; topo: number }
  /** Pés de cada colega, na ordem de chegada: perto à esquerda, perto à direita, atrás à esquerda, atrás à direita. */
  colegas: readonly { x: number; y: number }[]
  fileiras: FileiraDoChao[]
}

/** O palco tem ~150 px de altura lógica; a escala é inteira e nunca menor que 2. */
const ALTURA_LOGICA = 150
const ESCALA_MINIMA = 2
const MEDIDA_MINIMA_CSS = 10

/** Tamanho lógico e escala para uma caixa de `larguraCss` × `alturaCss`; null se a caixa ainda não tem tamanho. */
export function medidasDoPalco(larguraCss: number, alturaCss: number): { esc: number; w: number; h: number } | null {
  if (larguraCss < MEDIDA_MINIMA_CSS || alturaCss < MEDIDA_MINIMA_CSS) return null
  const esc = Math.max(ESCALA_MINIMA, Math.round(alturaCss / ALTURA_LOGICA))
  return { esc, w: Math.ceil(larguraCss / esc), h: Math.ceil(alturaCss / esc) }
}

const PORTA_LARG = 44
const PORTA_ALT = 58
/** Colegas de perto: a 42% do caminho entre a parede e você, afastados 30% da largura (até 70 px), como no protótipo. */
const COLEGA_PERTO_Y = 0.42
const COLEGA_PERTO_X = 0.3
const COLEGA_PERTO_X_MAX = 70
/** Colegas de trás: mais perto da parede e mais abertos, para o grupo virar um leque e ninguém cobrir ninguém. */
const COLEGA_ATRAS_Y = 0.2
const COLEGA_ATRAS_X = 0.42
const COLEGA_ATRAS_X_MAX = 112
const FILEIRA_ALT_MAX = 14

export function geometriaDoPalco(w: number, h: number): GeometriaDoPalco {
  const base = Math.round(h * 0.6)
  const peY = Math.round(h * 0.9)
  const cx = Math.round(w / 2)
  const pertoY = Math.round(base + (peY - base) * COLEGA_PERTO_Y)
  const atrasY = Math.round(base + (peY - base) * COLEGA_ATRAS_Y)
  const perto = Math.min(w * COLEGA_PERTO_X, COLEGA_PERTO_X_MAX)
  const atras = Math.min(w * COLEGA_ATRAS_X, COLEGA_ATRAS_X_MAX)
  return {
    w,
    h,
    base,
    peY,
    porta: { cx, larg: PORTA_LARG, alt: PORTA_ALT, x0: cx - PORTA_LARG / 2, topo: base - PORTA_ALT },
    colegas: [
      { x: Math.round(w / 2 - perto), y: pertoY },
      { x: Math.round(w / 2 + perto), y: pertoY },
      { x: Math.round(w / 2 - atras), y: atrasY },
      { x: Math.round(w / 2 + atras), y: atrasY },
    ],
    fileiras: fileirasDoChao(w, h, base),
  }
}

/** Chão em fileiras que crescem para perto (perspectiva barata). */
function fileirasDoChao(w: number, h: number, base: number): FileiraDoChao[] {
  const fileiras: FileiraDoChao[] = []
  for (let y = base, alt = 3, row = 0; y < h; y += alt, alt = Math.min(FILEIRA_ALT_MAX, Math.round(alt * 1.3 + 1)), row += 1) {
    const lw = 10 + row * 5
    const off = ((w / 2) % lw) - (row % 2 ? lw / 2 : 0)
    const ladrilhos: Ladrilho[] = []
    for (let x = off - lw, col = 0; x < w; x += lw, col += 1) {
      ladrilhos.push({ x: Math.round(x) + 1, y: y + 1, w: Math.round(lw) - 1, h: alt - 1, par: (row + col) % 2 })
    }
    fileiras.push({ y, alt, ladrilhos })
  }
  return fileiras
}

/** Ordem de desenho dos colegas: os de trás primeiro. Devolve os índices dos `n` primeiros lugares. */
export function ordemDosColegas(geo: GeometriaDoPalco, n: number): number[] {
  const lugares = Math.min(n, COLEGAS_NO_PALCO, geo.colegas.length)
  return Array.from({ length: lugares }, (_, i) => i).sort((a, b) => geo.colegas[a].y - geo.colegas[b].y || a - b)
}

// ------------------------------------------------------------------ pintura do cenário (uma vez por tamanho)

export type CriarCanvas = (w: number, h: number) => HTMLCanvasElement

const canvasDoDocumento: CriarCanvas = (w, h) => {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

function contexto2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const g = c.getContext('2d')
  if (g === null) throw new Error('canvas 2D indisponível: o palco da dança não tem onde desenhar')
  return g
}

export interface CenarioDoPalco extends GeometriaDoPalco {
  /** Parede, porta, chão e vinheta, pintados uma vez. */
  fundo: HTMLCanvasElement
  /** Os 4 níveis do holofote, pontilhados. */
  holofote: HTMLCanvasElement[]
}

/** Contorno do vão em arco da porta; `folga` > 0 é a moldura de pedra. */
function tracarVao(g: CanvasRenderingContext2D, geo: GeometriaDoPalco, folga: number): void {
  const { porta, base } = geo
  g.beginPath()
  g.moveTo(porta.x0 - folga, base)
  g.lineTo(porta.x0 - folga, porta.topo + 22)
  g.arc(porta.cx, porta.topo + 22, 22 + folga, Math.PI, 0)
  g.lineTo(porta.x0 + porta.larg + folga, base)
  g.closePath()
}

const TONS_DA_PAREDE: readonly string[] = ['#1b1a1f', '#1e1c21', '#19181c']

function pintarParede(g: CanvasRenderingContext2D, geo: GeometriaDoPalco): void {
  g.fillStyle = '#141317'
  g.fillRect(0, 0, geo.w, geo.h)
  for (let y = 0, row = 0; y < geo.base; y += 7, row += 1) {
    for (let x = -((row % 2) * 6); x < geo.w; x += 12) {
      g.fillStyle = TONS_DA_PAREDE[(hashTexto(`${x}:${row}`) >>> 3) % 3]
      g.fillRect(x + 1, y + 1, 11, 6)
    }
  }
}

/** Moldura da porta: pedras em volta do vão em arco e a placa das runas. */
function pintarMoldura(g: CanvasRenderingContext2D, geo: GeometriaDoPalco): void {
  const { porta, base } = geo
  g.fillStyle = '#3a352f'
  tracarVao(g, geo, 6)
  g.fill()
  g.fillStyle = '#26221e'
  tracarVao(g, geo, 1)
  g.fill()
  g.fillStyle = '#4b453d'
  for (let a = Math.PI; a <= 2 * Math.PI + 0.01; a += Math.PI / 6) g.fillRect(Math.round(porta.cx + Math.cos(a) * 25), Math.round(porta.topo + 22 + Math.sin(a) * 25), 2, 1)
  for (let y = porta.topo + 26; y < base; y += 7) {
    g.fillRect(porta.x0 - 6, y, 5, 1)
    g.fillRect(porta.x0 + porta.larg + 1, y, 5, 1)
  }
  g.fillStyle = '#26221e'
  g.fillRect(porta.cx - 19, porta.topo - 14, 38, 8)
}

function pintarChao(g: CanvasRenderingContext2D, geo: GeometriaDoPalco): void {
  for (const f of geo.fileiras) {
    for (const l of f.ladrilhos) {
      g.fillStyle = l.par ? '#25211d' : '#1f1c19'
      g.fillRect(l.x - 1, f.y, l.w + 1, f.alt)
      g.fillStyle = '#121110'
      g.fillRect(l.x - 1, f.y, 1, f.alt)
    }
    g.fillStyle = '#121110'
    g.fillRect(0, f.y, geo.w, 1)
  }
  g.fillStyle = '#0d0c0e'
  g.fillRect(0, geo.base - 1, geo.w, 2)
}

function pintarVinheta(g: CanvasRenderingContext2D, geo: GeometriaDoPalco): void {
  const { w, h } = geo
  const vin = g.createRadialGradient(w / 2, h * 0.55, h * 0.3, w / 2, h * 0.55, Math.max(w, h) * 0.75)
  vin.addColorStop(0, 'rgba(0,0,0,0)')
  vin.addColorStop(1, 'rgba(0,0,0,0.6)')
  g.fillStyle = vin
  g.fillRect(0, 0, w, h)
}

/** Pontilhado ordenado 4x4: o holofote em pixel art, sem degradê liso. */
const BAYER: readonly number[] = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16)
const NIVEIS_DO_HOLOFOTE = 4
/** O cone nasce acima do palco. */
const TOPO_DO_CONE = -12

/** Intensidade 0-1 do holofote no pixel (x, y): cone fraco que só fica forte perto do chão, mais a poça de luz nos pés. */
export function intensidadeDoHolofote(x: number, y: number, geo: { w: number; peY: number }, nivel: number): number {
  const R = 15 + nivel * 6
  const k = (y - TOPO_DO_CONE) / (geo.peY - TOPO_DO_CONE)
  const meia = interpolar(4, R, limitar(k, 0, 1))
  const dx = Math.abs(x - geo.w / 2)
  // Na altura da porta o cone não pode virar textura suja.
  let I = y <= geo.peY ? Math.max(0, 1 - dx / meia) ** 0.8 * (0.1 + 0.07 * nivel) * (0.35 + 0.65 * limitar(k, 0, 1)) : 0
  const ex = (x - geo.w / 2) / (R * 1.1)
  const ey = (y - geo.peY + 1) / (R * 0.3)
  if (ex * ex + ey * ey < 1) I = Math.max(I, (1 - (ex * ex + ey * ey)) * (0.75 + 0.08 * nivel))
  return I
}

function pintarHolofote(c: HTMLCanvasElement, geo: GeometriaDoPalco, nivel: number): void {
  const { w, h } = geo
  const gg = contexto2d(c)
  const img = gg.createImageData(w, h)
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (intensidadeDoHolofote(x, y, geo, nivel) <= BAYER[(y & 3) * 4 + (x & 3)]) continue
      const p = (y * w + x) * 4
      img.data[p] = 255
      img.data[p + 1] = 236
      img.data[p + 2] = 200
      img.data[p + 3] = 34 + nivel * 6
    }
  }
  gg.putImageData(img, 0, 0)
}

/** Pinta o fundo e os níveis do holofote. Caro: refaça só quando o tamanho do palco mudar. */
export function prepararCenario(geo: GeometriaDoPalco, criarCanvas: CriarCanvas = canvasDoDocumento): CenarioDoPalco {
  const fundo = criarCanvas(geo.w, geo.h)
  const g = contexto2d(fundo)
  pintarParede(g, geo)
  pintarMoldura(g, geo)
  pintarChao(g, geo)
  pintarVinheta(g, geo)
  const holofote: HTMLCanvasElement[] = []
  for (let nivel = 0; nivel < NIVEIS_DO_HOLOFOTE; nivel += 1) {
    const c = criarCanvas(geo.w, geo.h)
    pintarHolofote(c, geo, nivel)
    holofote.push(c)
  }
  return { ...geo, fundo, holofote }
}

// ------------------------------------------------------------------ quadro do palco

export interface FiguraNaCena {
  pose: Pose
  bob: number
}

export interface ColegaNaCena extends FiguraNaCena {
  /** Índice da paleta (`visualDoColega`). */
  visual: number
}

/** Tudo o que um quadro do palco mostra; o jogo e as provas montam a mesma cena. */
export interface CenaDoPalco {
  porta: EstadoDaPorta
  /** Runas acesas pela nota ao vivo (0-1 cada). */
  runas: readonly number[]
  /** Brilho do chão na batida (0, 0,7 ou 1). */
  chao: number
  /** Batidas desde a primeira (fração = fase dentro da batida). */
  batida: number
  reduzido: boolean
  /** Nível do holofote, 0-3, já suavizado. */
  holofote: number
  voce: FiguraNaCena
  /** Até 4, no lugar `colegas[i]` da geometria. */
  colegas: readonly ColegaNaCena[]
  poeira: readonly GraoDePoeira[]
}

/** Vão: luz atrás e as folhas, que deslizam para dentro da parede. */
function desenharVao(g: CanvasRenderingContext2D, S: CenarioDoPalco, ep: EstadoDaPorta): void {
  const { porta, base } = S
  g.save()
  tracarVao(g, S, 0)
  g.clip()
  if (ep.luz > 0) {
    const grd = g.createLinearGradient(0, porta.topo, 0, base)
    grd.addColorStop(0, `rgba(243,186,102,${0.55 * ep.luz})`)
    grd.addColorStop(1, `rgba(255,236,200,${0.9 * ep.luz})`)
    g.fillStyle = grd
    g.fillRect(porta.x0, porta.topo, porta.larg, porta.alt)
  }
  const meia = porta.larg / 2
  const desl = Math.round(ep.abre * meia)
  for (const lado of [-1, 1]) {
    const x0 = lado < 0 ? porta.x0 - desl : porta.cx + desl
    g.fillStyle = '#2c2219'
    g.fillRect(x0, porta.topo, meia, porta.alt)
    g.fillStyle = '#3a2d20'
    for (let x = x0 + 2; x < x0 + meia; x += 4) g.fillRect(x, porta.topo, 1, porta.alt)
    g.fillStyle = '#b9853f'
    g.fillRect(x0, porta.topo + 26, meia, 2)
    g.fillRect(x0, base - 10, meia, 2)
    g.fillStyle = '#e0a44a'
    for (let x = x0 + 3; x < x0 + meia; x += 6) {
      g.fillRect(x, porta.topo + 26, 1, 1)
      g.fillRect(x, base - 10, 1, 1)
    }
    g.fillStyle = CONTORNO
    g.fillRect(lado < 0 ? x0 + meia - 1 : x0, porta.topo, 1, porta.alt)
  }
  if (ep.fresta > 0 && ep.abre < 0.05) {
    g.fillStyle = `rgba(255,236,200,${ep.fresta})`
    g.fillRect(porta.cx - 1, porta.topo + 8, 2, porta.alt - 8)
  }
  g.restore()
  // Luz da porta derramando no chão.
  if (ep.luz > 0.01) {
    g.fillStyle = `rgba(243,186,102,${0.18 * ep.luz})`
    g.beginPath()
    g.moveTo(porta.cx - meia * ep.abre, base)
    g.lineTo(porta.cx + meia * ep.abre, base)
    g.lineTo(porta.cx + meia * ep.abre * 2.4, S.h)
    g.lineTo(porta.cx - meia * ep.abre * 2.4, S.h)
    g.closePath()
    g.fill()
  }
}

function desenharRunas(g: CanvasRenderingContext2D, S: CenarioDoPalco, cena: CenaDoPalco): void {
  RUNAS.forEach((linhas, i) => {
    const v = Math.max(cena.runas[i] || 0, cena.porta.runas[i])
    const rx = S.porta.cx - 17 + i * 9
    const ry = S.porta.topo - 12
    g.fillStyle = v > 0.02 ? `rgba(243,186,102,${0.25 + 0.75 * v})` : '#3d352c'
    linhas.forEach((l, y) => {
      for (let x = 0; x < 5; x += 1) if (l[x] === '#') g.fillRect(rx + x, ry + y, 1, 1)
    })
  })
}

/** Chão que acende na batida (combo alto); com movimento reduzido, brilho parado. */
function desenharChaoAceso(g: CanvasRenderingContext2D, S: CenarioDoPalco, cena: CenaDoPalco): void {
  if (cena.chao <= 0) return
  const fase = cena.batida % 1
  const par = Math.floor(cena.batida) % 2
  const a = cena.reduzido ? 0.1 * cena.chao : 0.32 * cena.chao * (1 - fase) ** 2
  if (a <= 0.005) return
  for (const f of S.fileiras) {
    for (const t of f.ladrilhos) {
      if (t.par !== par) continue
      g.fillStyle = t.y % 2 ? `rgba(224,164,74,${a})` : `rgba(121,169,204,${a * 0.8})`
      g.fillRect(t.x, t.y, t.w, t.h)
    }
  }
}

/** Holofote: mistura entre dois níveis para trocar sem salto. */
function desenharHolofote(g: CanvasRenderingContext2D, S: CenarioDoPalco, nivel: number): void {
  const n0 = Math.floor(nivel)
  const k = nivel - n0
  g.globalAlpha = 1 - k
  g.drawImage(S.holofote[n0], 0, 0)
  if (k > 0 && n0 < NIVEIS_DO_HOLOFOTE - 1) {
    g.globalAlpha = k
    g.drawImage(S.holofote[n0 + 1], 0, 0)
  }
  g.globalAlpha = 1
}

/** Desenha um quadro do palco a partir de uma cena pura. */
export function desenharPalco(g: CanvasRenderingContext2D, S: CenarioDoPalco, cena: CenaDoPalco): void {
  g.drawImage(S.fundo, 0, 0)
  desenharVao(g, S, cena.porta)
  desenharRunas(g, S, cena)
  desenharChaoAceso(g, S, cena)
  const nv = limitar(cena.holofote, 0, NIVEIS_DO_HOLOFOTE - 1)
  desenharHolofote(g, S, nv)
  // Dançarinos: os de trás primeiro, você por último.
  for (const i of ordemDosColegas(S, cena.colegas.length)) {
    const c = cena.colegas[i]
    const lugar = S.colegas[i]
    desenharFigura(g, lugar.x, lugar.y, DIM.pequeno, c.pose, visualDoColega(c.visual), 0, c.bob)
  }
  desenharFigura(g, Math.round(S.w / 2), S.peY, DIM.grande, cena.voce.pose, VISUAL_VOCE, 0.4 + 0.2 * nv, cena.voce.bob)
  for (const p of cena.poeira) {
    g.fillStyle = `rgba(162,160,154,${p.a})`
    g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1)
  }
}
