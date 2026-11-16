/**
 * ARTE DO BARRIL: o barril de carvalho com três aros de ferro no porão, o
 * martelo à direita, o brilho do aro da vez, as rachaduras do progresso e a
 * abertura (os aros caem, a tampa salta e as aduelas se abrem). Pixel art por
 * fillRect na tela lógica de 240x135, sem texto. O corpo do barril, que não
 * muda, fica numa tela fora da página (fechado e aberto); sem tela (teste em
 * Node), é pintado direto. Movimento reduzido: sem tremor, sem clarão no aro,
 * sem lascas, sem faísca piscando e sem salto da tampa; o brilho dos aros e as
 * rachaduras continuam, porque são informação.
 */
import { CENTRO_X, CHAO_Y, desenharFundo, desenharLuz, desenharVela, novaTela } from '../abrir/cenario'
import { COR, contorno, luz, misturar, pix } from '../abrir/desenho'
import { rngDe } from '../abrir/rng'
import { AROS, abertura, brilhoDoPulso, brilhoEm, progresso, proximoPulso, ultimoPulso } from './sim'
import type { TelaFora } from '../abrir/cenario'
import type { OpcoesDeDesenho } from '../abrir/tipos'
import type { Estado } from './sim'

/** Altura do corpo do barril, em px; a base encosta no chão. */
const ALTURA = 88
/** Linha de cima do corpo. */
const TOPO = CHAO_Y - ALTURA
/** Meia-largura nas pontas e no bojo (o meio do barril é mais largo). */
const MEIA_PONTA = 33
const MEIA_BOJO = 40
const ADUELAS = 9
/** Linha de cima da faixa de cada aro, de cima para baixo. */
export const Y_DOS_AROS: readonly number[] = [TOPO + 12, TOPO + 42, TOPO + 73]
const ARO_ALT = 4
/**
 * Na abertura: quanto o topo das aduelas de fora se afasta, quanto as da
 * frente caem e quanto as de fora também caem (sem isso, as aduelas finas da
 * borda ficam altas e inclinadas e parecem arame de gaiola), em px.
 */
const ABRE_X = 16
const ABRE_Y = 26
const ABRE_Y_LADO = 16
/** Ponto por onde a armadilha sai do barril aberto: o meio da boca escura. */
export const BOCA: readonly [number, number] = [CENTRO_X, TOPO + 18]

/** Rachaduras possíveis: uma por golpe certo no Normal. */
const N_RACHAS = 12
/** Tremor do barril no golpe certo: 1 px para cada lado, a cada 30 ms, por 120 ms. */
const TREMOR = [1, -1, 1, -1]
const TREMOR_PASSO = 0.03
/** Clarão do aro acertado, em s. */
const CLARAO_S = 0.07
/** Faísca do escorregão e lascas do golpe certo, em s. */
const FAISCA_S = 0.16
const LASCA_S = 0.3
const GRAVIDADE_PX = 400
/** O martelo vai para o aro que acende no começo da subida: chega com 40% do brilho. */
const SEGUE = 2.5

/** Martelo: comprimento do cabo, distância da mão até a borda do barril e ângulos (graus; 270 = cabo em pé). */
const COMP_CABO = 31
const AFASTAMENTO = 10
const ANG_DESCANSO = 305
const ANG_GOLPE = 270
const ANG_ESCORREGA = 258
/** Tempos do golpe do martelo, em s: desce, segura no aro, volta; no escorregão, desliza de lado. */
const DESCE = 0.05
const SEGURA = 0.04
const VOLTA = 0.2
const DESLIZA = 0.08
const DESLIZA_PX = 6

// Cores prontas (contorno e luz montam texto; aqui saem uma vez só).
const JUNTA = contorno(COR.carvalho)
const PONTA_DA_ADUELA = luz(COR.pinho, 1.08)
const RACHA = contorno(COR.nogueira)
const RACHA_LASCA = luz(COR.pinho, 1.12)
const MARCA_DO_ARO = misturar(COR.carvalho, COR.pinho, 0.65)
const ARO_CONTORNO = contorno(COR.ferro)
const ARO_REALCE = luz(COR.ferro, 1.35)
const ARO_OURO_CONTORNO = luz(COR.ouro, 0.72)
const REBITE = COR.latao
const TAMPO_BORDA = luz(COR.carvalho, 0.9)
const TAMPO_BORDA_CONTORNO = contorno(COR.carvalho)
const TAMPO_TABUA = luz(COR.pinho, 0.82)
const BOCA_ESCURA = luz(COR.nogueira, 0.3)
const CABO_CONTORNO = contorno(COR.nogueira)
const PUNHO = luz(COR.nogueira, 0.85)
const CABECA_CONTORNO = contorno(COR.ferro)
const CABECA_REALCE = luz(COR.ferro, 1.3)
const CABECA_FACE = luz(COR.ferro, 1.15)
const SOMBRA_NO_CHAO = 'rgba(14,10,8,0.45)'
/** Halo do aro aceso: o ouro da paleta com transparência. */
const HALO = '242,193,78'

/** Variação de tom de cada aduela (carvalho puxando para pinho) e sombra do cilindro (a da frente é a mais clara). */
const TOM_DAS_ADUELAS = [0.1, 0.03, 0.15, 0.06, 0.18, 0.08, 0.13, 0.02, 0.1]
const BASE_DAS_ADUELAS = TOM_DAS_ADUELAS.map((v) => misturar(COR.carvalho, COR.pinho, v))
const SOMBRA_CILINDRO = Array.from({ length: ADUELAS }, (_, i) => 0.72 + 0.3 * Math.cos(-Math.PI / 2 + (Math.PI * (i + 0.5)) / ADUELAS))

const suave = (k: number): number => k * k * (3 - 2 * k)
const lerp = (a: number, b: number, k: number): number => a + (b - a) * k

/** Meia-largura do barril na linha y (o bojo no meio). */
function meiaLargura(y: number): number {
  const u = Math.min(1, Math.max(0, (y - TOPO + 0.5) / ALTURA))
  return Math.round(MEIA_PONTA + (MEIA_BOJO - MEIA_PONTA) * Math.sin(Math.PI * u))
}

/** Uma aduela numa linha: onde começa (a junta), a largura, a cor e os pixels de veio. */
interface LinhaDeAduela {
  x: number
  w: number
  cor: string
  corVeio: string
  veio: readonly number[]
}

/**
 * Tabela das aduelas, linha por linha: as juntas seguem a projeção de um
 * cilindro (estreitas nas bordas), a luz vem de cima e da frente. Calculada
 * uma vez; o veio é sorteado com semente fixa (igual em toda execução).
 */
function montarAduelas(): { tabela: LinhaDeAduela[][]; direita: number[] } {
  const r = rngDe('barril|veio')
  const veios = Array.from({ length: ADUELAS }, () =>
    Array.from({ length: 3 }, () => ({ f: 0.2 + 0.6 * r(), j0: Math.floor(r() * (ALTURA - 12)), n: 8 + Math.floor(r() * 20) })))
  const tabela: LinhaDeAduela[][] = []
  const direita: number[] = []
  for (let j = 0; j < ALTURA; j++) {
    const m = meiaLargura(TOPO + j)
    const bordas = Array.from({ length: ADUELAS + 1 }, (_, i) => CENTRO_X + Math.round(m * Math.sin(-Math.PI / 2 + (Math.PI * i) / ADUELAS)))
    // Luz de cima em faixas de 4%, para o degradê virar faixas de pixel art.
    const fy = Math.round((1.08 - 0.24 * (j / ALTURA)) / 0.04) * 0.04
    const linha: LinhaDeAduela[] = []
    for (let i = 0; i < ADUELAS; i++) {
      const x = bordas[i]
      const w = bordas[i + 1] - x
      const fundo = j === ALTURA - 1
      const cor = fundo ? JUNTA : luz(BASE_DAS_ADUELAS[i], SOMBRA_CILINDRO[i] * fy)
      const veio = fundo || w < 4 ? [] : veios[i].filter((v) => j >= v.j0 && j < v.j0 + v.n).map((v) => x + 1 + Math.floor(v.f * (w - 2)))
      linha.push({ x, w, cor, corVeio: luz(cor, 0.86), veio })
    }
    tabela.push(linha)
    direita.push(bordas[ADUELAS])
  }
  return { tabela, direita }
}

const { tabela: ADUELA, direita: DIREITA } = montarAduelas()

/** Interior do barril, escurecendo para o fundo (só aparece na abertura). */
const COR_INTERIOR = Array.from({ length: ALTURA }, (_, j) =>
  misturar(luz(COR.nogueira, 0.5), COR.sombra, Math.round(Math.min(1, j / 40) * 6) / 6))

/** Elipse cheia de pixels (tampa, borda, boca). */
function elipse(g: CanvasRenderingContext2D, cor: string, cx: number, cy: number, rx: number, ry: number): void {
  for (let y = -ry; y <= ry; y++) {
    const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y / (ry + 0.5)) ** 2)))
    pix(g, cor, cx - hw, cy + y, 2 * hw + 1, 1)
  }
}

/**
 * Aduelas, linha por linha. `k` = abertura das aduelas (0 = barril fechado):
 * as de fora se afastam pelo topo e as da frente caem, revelando o interior.
 */
function pintarAduelas(g: CanvasRenderingContext2D, dx: number, dy: number, k: number): void {
  for (let i = 0; i < ADUELAS; i++) {
    const s = (2 * i) / (ADUELAS - 1) - 1
    const topoX = k * ABRE_X * s
    const queda = Math.round(k * (ABRE_Y * (1 - Math.abs(s)) + ABRE_Y_LADO * Math.abs(s)))
    const alt = ALTURA - queda
    for (let yd = 0; yd < alt; yd++) {
      const j = queda === 0 ? yd : Math.min(ALTURA - 1, Math.floor((yd * ALTURA) / alt))
      const sx = k === 0 ? 0 : Math.round((topoX * (alt - 1 - yd)) / (ALTURA - 1))
      const a = ADUELA[j][i]
      const x = dx + a.x + sx
      const y = dy + TOPO + queda + yd
      pix(g, JUNTA, x, y)
      if (a.w > 1) pix(g, k > 0 && yd === 0 ? PONTA_DA_ADUELA : a.cor, x + 1, y, a.w - 1, 1)
      for (const vx of a.veio) pix(g, a.corVeio, vx + dx + sx, y)
      if (i === ADUELAS - 1) pix(g, JUNTA, dx + DIREITA[j] + sx, y)
    }
  }
}

/** Tampa vista de cima: tábuas de pinho dentro da borda das aduelas. */
function pintarTampa(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number): void {
  elipse(g, TAMPO_BORDA_CONTORNO, cx, cy, rx + 1, ry + 1)
  elipse(g, TAMPO_BORDA, cx, cy, rx, ry)
  elipse(g, COR.pinho, cx, cy, rx - 3, Math.max(0, ry - 2))
  if (ry >= 3) for (const f of [-0.45, 0, 0.45]) pix(g, TAMPO_TABUA, cx + Math.round(f * (rx - 3)), cy - ry + 3, 1, Math.max(1, 2 * ry - 5))
}

function pintarFechado(g: CanvasRenderingContext2D, dx: number, dy: number): void {
  pintarAduelas(g, dx, dy, 0)
  pintarTampa(g, CENTRO_X + dx, TOPO + 1 + dy, MEIA_PONTA, 4)
}

/** Interior escuro (o que aparece quando as aduelas se abrem) e a borda da boca. */
function pintarInterior(g: CanvasRenderingContext2D, dx: number, dy: number): void {
  for (let j = 0; j < ALTURA; j++) {
    const x0 = ADUELA[j][0].x
    pix(g, COR_INTERIOR[j], dx + x0, dy + TOPO + j, DIREITA[j] - x0 + 1, 1)
  }
  elipse(g, TAMPO_BORDA_CONTORNO, CENTRO_X + dx, TOPO + 1 + dy, MEIA_PONTA, 4)
  elipse(g, BOCA_ESCURA, CENTRO_X + dx, TOPO + 1 + dy, MEIA_PONTA - 3, 2)
}

function pintarAberto(g: CanvasRenderingContext2D, dx: number, dy: number): void {
  pintarInterior(g, dx, dy)
  pintarAduelas(g, dx, dy, 1)
}

/** Corpo em cache: o retângulo que ele ocupa na cena. */
const Y_CORPO = TOPO - 6
const ALT_CORPO = ALTURA + 6
const X_FECHADO = CENTRO_X - MEIA_BOJO - 2
const LARG_FECHADO = 2 * MEIA_BOJO + 5
const X_ABERTO = CENTRO_X - MEIA_BOJO - ABRE_X - 2
const LARG_ABERTO = 2 * (MEIA_BOJO + ABRE_X) + 5

let telaFechada: TelaFora | null = null
let telaAberta: TelaFora | null = null

/** Corpo do barril fechado, da tela fora da página quando há uma; senão pintado direto. */
function corpoFechado(g: CanvasRenderingContext2D, dx: number): void {
  if (telaFechada === null) {
    const t = novaTela(LARG_FECHADO, ALT_CORPO)
    if (t !== null) {
      pintarFechado(t.g, -X_FECHADO, -Y_CORPO)
      telaFechada = t
    }
  }
  if (telaFechada !== null) g.drawImage(telaFechada.tela, X_FECHADO + dx, Y_CORPO)
  else pintarFechado(g, dx, 0)
}

/** Corpo do barril já aberto (fica parado enquanto a armadilha sai). */
function corpoAberto(g: CanvasRenderingContext2D): void {
  if (telaAberta === null) {
    const t = novaTela(LARG_ABERTO, ALT_CORPO)
    if (t !== null) {
      pintarAberto(t.g, -X_ABERTO, -Y_CORPO)
      telaAberta = t
    }
  }
  if (telaAberta !== null) g.drawImage(telaAberta.tela, X_ABERTO, Y_CORPO)
  else pintarAberto(g, 0, 0)
}

/** Deslocamento do barril, em px, no golpe certo; sempre 0 no movimento reduzido. */
export function tremorDoBarril(e: Readonly<Estado>, reduzido: boolean): number {
  if (reduzido || abertura(e) > 0) return 0
  const s = e.t - e.tGolpe
  if (s < 0 || s >= TREMOR.length * TREMOR_PASSO) return 0
  return TREMOR[Math.min(TREMOR.length - 1, Math.floor(s / TREMOR_PASSO))]
}

let rachasDe: { sem: number; rachas: number[][] } | null = null

/** Rachaduras da tentativa ([x, y, x, y...] cada), sorteadas pela semente da arte e guardadas. */
function rachas(sem: number): number[][] {
  if (rachasDe !== null && rachasDe.sem === sem) return rachasDe.rachas
  const r = rngDe('barril|racha|' + sem)
  const lista: number[][] = []
  for (let n = 0; n < N_RACHAS; n++) {
    // Só nas aduelas da frente e fora das faixas dos aros.
    const i = 2 + Math.floor(r() * 5)
    let j = 4 + Math.floor(r() * (ALTURA - 14))
    for (const ya of Y_DOS_AROS) if (TOPO + j >= ya - 2 && TOPO + j <= ya + ARO_ALT + 1) j = ya + ARO_ALT + 2 - TOPO
    const a = ADUELA[Math.min(ALTURA - 1, j)][i]
    let x = a.x + 2 + Math.floor(r() * Math.max(1, a.w - 4))
    const comp = 4 + Math.floor(r() * 5)
    const px: number[] = []
    for (let k = 0; k < comp && TOPO + j + k < CHAO_Y - 2; k++) {
      if (k > 0 && r() < 0.45) x += r() < 0.5 ? -1 : 1
      px.push(x, TOPO + j + k)
    }
    lista.push(px)
  }
  rachasDe = { sem, rachas: lista }
  return lista
}

function desenharRachas(g: CanvasRenderingContext2D, e: Readonly<Estado>, dx: number): void {
  const n = Math.min(N_RACHAS, Math.floor(progresso(e) * N_RACHAS + 1e-9))
  const lista = rachas(e.semRacha)
  for (let k = 0; k < n; k++) {
    const px = lista[k]
    for (let p = 0; p < px.length; p += 2) pix(g, RACHA, px[p] + dx, px[p + 1])
    if (px.length >= 2) pix(g, RACHA_LASCA, px[0] + 1 + dx, px[1])
  }
}

/** Divisões da faixa do aro: firme = 3 pedaços com a do meio 1 px abaixo; solto = 4 degraus, torto. */
const PEDACOS_FIRME = [0, 0.18, 0.82, 1]
const DEGRAUS_FIRME = [0, 1, 0]
const PEDACOS_SOLTO = [0, 0.25, 0.5, 0.75, 1]
const DEGRAUS_SOLTO = [0, 1, 2, 3]

interface CoresDoAro {
  borda: string
  realce: string
  corpo: string
}

/** Faixa de ferro de um aro, de xE a xD, com a sombra e o realce de cima. */
function faixaDoAro(
  g: CanvasRenderingContext2D, xE: number, xD: number, y: number,
  pedacos: readonly number[], degraus: readonly number[], c: CoresDoAro,
): void {
  const larg = xD - xE + 1
  for (let k = 0; k < degraus.length; k++) {
    const x0 = xE + Math.round(pedacos[k] * larg)
    const x1 = xE + Math.round(pedacos[k + 1] * larg)
    const yk = y + degraus[k]
    pix(g, c.borda, x0, yk, x1 - x0, ARO_ALT)
    const a = k === 0 ? x0 + 1 : x0
    const b = k === degraus.length - 1 ? x1 - 1 : x1
    pix(g, c.realce, a, yk + 1, b - a, 1)
    pix(g, c.corpo, a, yk + 2, b - a, 1)
  }
  // Dois rebites de latão.
  for (const f of [0.3, 0.68]) {
    const x = xE + Math.round(f * larg)
    let k = 0
    while (k < degraus.length - 1 && pedacos[k + 1] <= f) k++
    pix(g, REBITE, x, y + degraus[k] + 2)
  }
}

/** Halo do aro aceso, por cima e por baixo da faixa; maior perto do pico. */
function haloDoAro(g: CanvasRenderingContext2D, xE: number, xD: number, y: number, b: number): void {
  const larg = xD - xE + 1
  g.fillStyle = `rgba(${HALO},${(0.45 * b).toFixed(3)})`
  g.fillRect(xE, y - 1, larg, 1)
  g.fillRect(xE, y + ARO_ALT + 1, larg, 1)
  if (b > 0.6) {
    g.fillStyle = `rgba(${HALO},${(0.22 * b).toFixed(3)})`
    g.fillRect(xE + 2, y - 2, larg - 4, 1)
    g.fillRect(xE + 2, y + ARO_ALT + 2, larg - 4, 1)
  }
}

/** Um aro no barril fechado: aceso pelo brilho, torto e frouxo depois de solto. */
function desenharAro(g: CanvasRenderingContext2D, e: Readonly<Estado>, op: OpcoesDeDesenho, i: number, dx: number): void {
  const y0 = Y_DOS_AROS[i]
  const m = meiaLargura(y0 + 2)
  const solto = i < e.soltos
  const b = brilhoEm(e, i, e.t)
  const xE = CENTRO_X - m - 1 - (solto ? 2 : 0) + dx
  const xD = CENTRO_X + m + 1 + (solto ? 2 : 0) + dx
  const y = y0 + (solto ? 2 : 0)
  // Onde o aro estava, a madeira ficou mais clara.
  if (solto) pix(g, MARCA_DO_ARO, CENTRO_X - m + 2 + dx, y0, 2 * m - 3, 2)
  if (b > 0.15) haloDoAro(g, xE, xD, y, b)
  const clarao = !op.reduzido && e.aroGolpe === i && e.t - e.tGolpe >= 0 && e.t - e.tGolpe < CLARAO_S
  const cores: CoresDoAro = clarao
    ? { borda: ARO_OURO_CONTORNO, realce: COR.branco, corpo: luz(COR.ouro, 1.05) }
    : {
        borda: misturar(ARO_CONTORNO, ARO_OURO_CONTORNO, b),
        realce: misturar(ARO_REALCE, COR.ouro, b),
        corpo: misturar(COR.ferro, COR.ouro, 0.75 * b),
      }
  faixaDoAro(g, xE, xD, y, solto ? PEDACOS_SOLTO : PEDACOS_FIRME, solto ? DEGRAUS_SOLTO : DEGRAUS_FIRME, cores)
  // No pico, um ponto de luz fixo em cada ponta do aro (não pisca: vale também no reduzido).
  if (b > 0.92) {
    pix(g, COR.branco, xE - 1, y - 1)
    pix(g, COR.branco, xD + 1, y - 1)
  }
}

function desenharFechado(g: CanvasRenderingContext2D, e: Readonly<Estado>, op: OpcoesDeDesenho): void {
  const dx = tremorDoBarril(e, op.reduzido)
  corpoFechado(g, dx)
  desenharRachas(g, e, dx)
  for (let i = 0; i < AROS; i++) desenharAro(g, e, op, i, dx)
}

/** Abertura: aduelas se abrindo, aros caindo no chão e a tampa saltando para a esquerda. */
function desenharAbrindo(g: CanvasRenderingContext2D, op: OpcoesDeDesenho, a: number): void {
  // Desacelera no fim; no reduzido, linear e sem salto.
  const k = op.reduzido ? a : 1 - (1 - a) * (1 - a)
  if (a >= 1) corpoAberto(g)
  else {
    pintarInterior(g, 0, 0)
    pintarAduelas(g, 0, 0, k)
  }
  const kq = op.reduzido ? a : a * a
  const ferro: CoresDoAro = { borda: ARO_CONTORNO, realce: ARO_REALCE, corpo: COR.ferro }
  for (let i = 0; i < AROS; i++) {
    const y = Math.round(lerp(Y_DOS_AROS[i], CHAO_Y - 3 + 2 * i, kq))
    const m = meiaLargura(Y_DOS_AROS[i] + 2) + 3 + Math.round(3 * k)
    faixaDoAro(g, CENTRO_X - m, CENTRO_X + m, y, PEDACOS_SOLTO, DEGRAUS_SOLTO, ferro)
  }
  const salto = op.reduzido ? 0 : 22 * Math.sin(Math.PI * a)
  const tx = Math.round(lerp(CENTRO_X, CENTRO_X - 64, k))
  const ty = Math.round(lerp(TOPO + 1, CHAO_Y + 8, k) - salto)
  pintarTampa(g, tx, ty, MEIA_PONTA - 2, Math.max(1, Math.round(4 - 2 * k)))
}

/** Altura do aro para onde o martelo aponta em t: o da última batida, indo para o que acende. */
function alturaDoMartelo(e: Readonly<Estado>, t: number): number {
  const ult = ultimoPulso(e, t)
  const prox = proximoPulso(e, t)
  const yUlt = ult !== null ? Y_DOS_AROS[ult.aro] : prox !== null ? Y_DOS_AROS[prox.aro] : Y_DOS_AROS[1]
  if (prox === null || (e.fim !== null && t >= e.tFim)) return yUlt
  // Só se move quando o brilho já começou: o martelo não conta nada que o brilho ainda não mostrou.
  const k = suave(Math.min(1, brilhoDoPulso(prox, e.d.queda, t) * SEGUE))
  return lerp(yUlt, Y_DOS_AROS[prox.aro], k)
}

/** Pose do martelo: mão (pivô) e ângulo do cabo, em radianos. */
export interface PoseDoMartelo {
  px: number
  py: number
  ang: number
}

/** Pose do martelo em e.t: descansando erguido, descendo no golpe, deslizando no escorregão. */
export function poseDoMartelo(e: Readonly<Estado>): PoseDoMartelo {
  const tRef = e.fim !== null ? e.tFim : e.t
  const tMartelo = Math.max(e.tGolpe, e.tEscorrega)
  const s = e.t - tMartelo
  const escorregou = e.tEscorrega > e.tGolpe
  const yAgora = alturaDoMartelo(e, tRef)
  let ang = ANG_DESCANSO
  let desliza = 0
  let y = yAgora
  if (s >= 0) {
    const yGolpe = alturaDoMartelo(e, tMartelo)
    // No escorregão o martelo fica caído enquanto está travado: a pessoa vê que não adianta bater.
    const segura = escorregou ? Math.max(DESCE + DESLIZA, e.travadoAte - tMartelo) : DESCE + SEGURA
    const angBaixo = escorregou ? ANG_ESCORREGA : ANG_GOLPE
    if (s < DESCE) {
      ang = lerp(ANG_DESCANSO, ANG_GOLPE, (s / DESCE) ** 2)
      y = yGolpe
    } else if (s < segura) {
      y = yGolpe
      if (escorregou) {
        const k = suave(Math.min(1, (s - DESCE) / DESLIZA))
        ang = lerp(ANG_GOLPE, ANG_ESCORREGA, k)
        desliza = DESLIZA_PX * k
      } else ang = ANG_GOLPE
    } else if (s < segura + VOLTA) {
      const k = suave((s - segura) / VOLTA)
      ang = lerp(angBaixo, ANG_DESCANSO, k)
      desliza = escorregou ? DESLIZA_PX * (1 - k) : 0
      y = lerp(yGolpe, yAgora, k)
    }
  }
  const px = CENTRO_X + meiaLargura(Math.round(y) + 2) + AFASTAMENTO
  return { px, py: y + 2 + COMP_CABO + desliza, ang: (ang * Math.PI) / 180 }
}

/** Traço grosso em pixels: um quadrado de `esp` px a cada passo da reta. */
function traco(g: CanvasRenderingContext2D, cor: string, x0: number, y0: number, x1: number, y1: number, esp: number): void {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))))
  const meio = esp / 2
  g.fillStyle = cor
  for (let k = 0; k <= n; k++) {
    g.fillRect(Math.round(x0 + ((x1 - x0) * k) / n - meio), Math.round(y0 + ((y1 - y0) * k) / n - meio), esp, esp)
  }
}

/** Martelo: cabo de nogueira e cabeça de ferro; a face da cabeça bate no aro. */
function desenharMartelo(g: CanvasRenderingContext2D, e: Readonly<Estado>): void {
  const { px, py, ang } = poseDoMartelo(e)
  const c = Math.cos(ang)
  const s = Math.sin(ang)
  const ex = px + COMP_CABO * c
  const ey = py + COMP_CABO * s
  // A face aponta para onde a cabeça anda no golpe (perpendicular ao cabo).
  const fx = s
  const fy = -c
  traco(g, CABO_CONTORNO, px, py, ex, ey, 4)
  traco(g, COR.nogueira, px, py, ex, ey, 2)
  pix(g, CABO_CONTORNO, px - 2, py - 1, 5, 5)
  pix(g, PUNHO, px - 1, py, 3, 3)
  const ax = ex - 3 * fx
  const ay = ey - 3 * fy
  const bx = ex + 8 * fx
  const by = ey + 8 * fy
  traco(g, CABECA_CONTORNO, ax, ay, bx, by, 6)
  traco(g, COR.ferro, ax, ay, bx, by, 4)
  traco(g, CABECA_REALCE, ax + 1.2 * c, ay + 1.2 * s, bx + 1.2 * c, by + 1.2 * s, 1)
  pix(g, CABECA_FACE, bx - 1, by - 1, 2, 2)
}

/** Direções da faísca do escorregão e velocidades das lascas do golpe certo (px/s). */
const FAISCAS: readonly (readonly [number, number])[] = [[1, -1], [2, 0], [1, 1], [0, -2]]
const LASCAS: readonly (readonly [number, number, string])[] = [[30, -70, COR.pinho], [55, -40, COR.carvalho], [15, -95, COR.pinho]]

/** Faísca do escorregão (no reduzido, um ponto fixo breve) e lascas do golpe certo (só no movimento normal). */
function desenharFaiscas(g: CanvasRenderingContext2D, e: Readonly<Estado>, op: OpcoesDeDesenho): void {
  const sf = e.t - e.tEscorrega
  if (sf >= 0 && sf < FAISCA_S) {
    const y = alturaDoMartelo(e, e.tEscorrega) + 2
    const x = CENTRO_X + meiaLargura(y) + 2
    if (op.reduzido) pix(g, COR.chama, x, y - 1, 2, 2)
    else {
      const k = Math.floor(sf / 0.04)
      for (const [fx, fy] of FAISCAS) pix(g, k % 2 === 0 ? COR.ouro : COR.branco, x + fx * (1 + k), y + fy * (1 + k))
    }
  }
  const sl = e.t - e.tGolpe
  if (!op.reduzido && sl >= 0 && sl < LASCA_S) {
    const y0 = Y_DOS_AROS[e.aroGolpe] + 1
    const x0 = CENTRO_X + meiaLargura(y0) + 2
    for (const [vx, vy, cor] of LASCAS) pix(g, cor, x0 + vx * sl, y0 + vy * sl + 0.5 * GRAVIDADE_PX * sl * sl)
  }
}

function desenharSombra(g: CanvasRenderingContext2D): void {
  pix(g, SOMBRA_NO_CHAO, CENTRO_X - 42, CHAO_Y, 84, 1)
  pix(g, SOMBRA_NO_CHAO, CENTRO_X - 38, CHAO_Y + 1, 76, 1)
  pix(g, SOMBRA_NO_CHAO, CENTRO_X - 30, CHAO_Y + 2, 60, 1)
}

/** Desenha a cena inteira do barril na tela lógica de 240x135. */
export function desenhar(g: CanvasRenderingContext2D, e: Readonly<Estado>, op: OpcoesDeDesenho): void {
  desenharFundo(g)
  desenharLuz(g, e.t, op.reduzido)
  desenharSombra(g)
  const a = abertura(e)
  if (a <= 0) desenharFechado(g, e, op)
  else desenharAbrindo(g, op, a)
  desenharMartelo(g, e)
  desenharFaiscas(g, e, op)
  // A vela para no fim da tentativa (a animação de abrir não gasta tempo).
  desenharVela(g, e.fim !== null ? e.tFim : e.t, op.reduzido)
}

/** Alvo do toque: a tela toda golpeia (alvo único, 0). */
export function alvoEm(_x: number, _y: number, _e: Readonly<Estado>): number {
  return 0
}
