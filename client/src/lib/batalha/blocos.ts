import type { Point } from '../../pixi/world'
import { distanciaAoTraco } from '../caminhamento/malha'
import { segmentsIntersect } from '../collision'

/**
 * BLOCOS DO MODO BATALHA (fatia B1 de docs/planos/modo-batalha-2026-10-24.md):
 * quantos blocos custa andar na grade quadrada. A diagonal custa 1, como o
 * modo `chessboard` da régua (`lib/measurement.ts`), e a diagonal que raspa a
 * quina de uma parede é recusada (decisão 8): o movimento dá a volta.
 *
 * Quem valida é o host; o cliente só mostra. Os dois chamam estas funções, e
 * por isso o "N blocos" da prévia bate com o `blocos` que o host devolve.
 *
 * A casa (col, row) ocupa de (col·grid, row·grid) a ((col+1)·grid, (row+1)·grid)
 * em px de mundo, como em `snapToGridCenter` (`pixi/tokenInteraction.ts`).
 * Só grade quadrada: hex conta de outro jeito.
 *
 * Puro: sem store, sem DOM, sem Pixi.
 */

/** Uma casa da grade quadrada, no formato dos blocos do chão (`FloorPiece`). */
export interface Casa {
  readonly col: number
  readonly row: number
}

/** O que o passo precisa da porta. `DoorState` (types/map.ts) cabe aqui. */
export interface PortaDoPasso {
  readonly open: boolean
  readonly locked: boolean
  readonly secret?: boolean
}

/** Um traço de parede, em px de mundo. */
export interface TracoDeParede {
  readonly x1: number
  readonly y1: number
  readonly x2: number
  readonly y2: number
}

/** O que o passo precisa da parede. `Wall` (types/map.ts) cabe aqui. */
export interface ParedeDoPasso extends TracoDeParede {
  readonly blocksMove: boolean
  readonly door: PortaDoPasso | null
}

/**
 * Folga da quina, em fração da casa: a diagonal que passa a menos disto de
 * uma parede raspa a quina. É o mesmo 1/4 de casa do raspão do arrasto
 * (`GRAZE_CELL_FRACTION`, `lib/collision.ts`), e fica abaixo de 1/2 para a
 * diagonal continuar valendo ao lado de uma parede reta (ela passa a meia casa dela).
 */
export const FOLGA_DA_QUINA = 1 / 4

/**
 * O veredito de um passo de 1 bloco:
 * - `livre`: anda;
 * - `parede`: o traço do passo atravessa uma parede (ou porta fechada);
 * - `quina`: passo diagonal que raspa a quina — encosta numa parede, passa a
 *   menos de `FOLGA_DA_QUINA` dela, ou contorna parede que barra um dos dois
 *   passos retos ao lado (a diagonal só vale onde os dois caminhos retos valem);
 * - `invalido`: não é um passo de 1 bloco entre duas casas do mapa.
 */
export type VereditoDoPasso = 'livre' | 'parede' | 'quina' | 'invalido'

/** As paredes que barram, já separadas por casa: monte uma vez e consulte muitas. */
export interface MapaDosBlocos {
  readonly grid: number
  readonly colunas: number
  readonly linhas: number
  /** Só as paredes que barram o passo, recortadas no mapa (com a folga em volta). */
  readonly paredes: readonly TracoDeParede[]
  /** Casa (`col + row * colunas`) → índices, em `paredes`, das que chegam a até `FOLGA_DA_QUINA` dela. */
  readonly baldes: ReadonlyMap<number, readonly number[]>
}

export interface MovimentoEmBlocos {
  readonly blocos: number
  /** Da casa de saída à de chegada, as duas inclusas, um bloco por passo. */
  readonly caminho: readonly Casa[]
}

/** Os 8 vizinhos: retos primeiro (o caminho prefere andar reto quando empata). */
const VIZINHOS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
]

/** Blocos entre duas casas, com a diagonal custando 1: max(|dx|, |dy|). */
export function blocosEntre(a: Casa, b: Casa): number {
  return Math.max(Math.abs(b.col - a.col), Math.abs(b.row - a.row))
}

/** Blocos andados num caminho: a soma dos trechos (ir e voltar conta os dois). */
export function blocosDoCaminho(casas: readonly Casa[]): number {
  let total = 0
  for (let k = 1; k < casas.length; k += 1) {
    const a = casas[k - 1]
    const b = casas[k]
    if (a !== undefined && b !== undefined) total += blocosEntre(a, b)
  }
  return total
}

export function centroDaCasa(casa: Casa, grid: number): Point {
  return { x: (casa.col + 0.5) * grid, y: (casa.row + 0.5) * grid }
}

/** A casa que contém o ponto; o ponto na linha da grade fica na casa da direita (ou de baixo). */
export function casaDoPonto(p: Point, grid: number): Casa {
  return { col: Math.floor(p.x / grid), row: Math.floor(p.y / grid) }
}

/** A parede barra o passo: barra movimento e não é porta aberta, destrancada e à mostra (`lib/collision.ts`). */
export function paredeBarraOPasso(w: ParedeDoPasso): boolean {
  if (!w.blocksMove) return false
  const porta = w.door
  return porta === null || !porta.open || porta.locked || porta.secret === true
}

function chaveDaCasa(mapa: MapaDosBlocos, col: number, row: number): number {
  return col + row * mapa.colunas
}

function casaNoMapa(mapa: MapaDosBlocos, casa: Casa): boolean {
  return Number.isInteger(casa.col) && Number.isInteger(casa.row) && casa.col >= 0 && casa.row >= 0 && casa.col < mapa.colunas && casa.row < mapa.linhas
}

/**
 * O trecho da parede dentro da caixa (recorte de Liang–Barsky); `null` quando
 * ela passa fora, não é número ou estoura o double. Parede de mapa salvo pode
 * vir com coordenada absurda: recortada, a conta de cruzar fica em números do
 * tamanho do mapa, e amostrá-la termina.
 */
function trechoNaCaixa(w: TracoDeParede, xMin: number, yMin: number, xMax: number, yMax: number): TracoDeParede | null {
  const dx = w.x2 - w.x1
  const dy = w.y2 - w.y1
  let t0 = 0
  let t1 = 1
  const lados: ReadonlyArray<readonly [number, number]> = [
    [-dx, w.x1 - xMin],
    [dx, xMax - w.x1],
    [-dy, w.y1 - yMin],
    [dy, yMax - w.y1],
  ]
  for (const [p, q] of lados) {
    if (p === 0) {
      if (q < 0) return null
      continue
    }
    if (p < 0) t0 = Math.max(t0, q / p)
    else t1 = Math.min(t1, q / p)
  }
  if (!(t0 <= t1)) return null
  // Ponta que o recorte não move fica idêntica: `x1 + dx * 1` pode errar o `x2` no último bit.
  const trecho = {
    x1: t0 === 0 ? w.x1 : w.x1 + dx * t0,
    y1: t0 === 0 ? w.y1 : w.y1 + dy * t0,
    x2: t1 === 1 ? w.x2 : w.x1 + dx * t1,
    y2: t1 === 1 ? w.y2 : w.y1 + dy * t1,
  }
  const finito = Number.isFinite(trecho.x1) && Number.isFinite(trecho.y1) && Number.isFinite(trecho.x2) && Number.isFinite(trecho.y2)
  return finito ? trecho : null
}

/** Até onde, em px, uma casa guarda as paredes perto dela: a folga da quina mais a meia distância entre amostras. */
function alcanceDoBalde(grid: number): number {
  return grid * FOLGA_DA_QUINA + grid / 4
}

/**
 * Guarda o traço `indice` no balde de cada casa a até `FOLGA_DA_QUINA` dele.
 * Amostra o traço a cada meia casa: todo ponto dele fica a até 1/4 de casa de
 * uma amostra, então a caixa de lado `alcanceDoBalde` em volta de cada amostra cobre tudo.
 */
function guardarNosBaldes(baldes: Map<number, number[]>, grid: number, colunas: number, linhas: number, w: TracoDeParede, indice: number): void {
  const alcance = alcanceDoBalde(grid)
  const amostras = Math.max(1, Math.ceil(Math.hypot(w.x2 - w.x1, w.y2 - w.y1) / (grid / 2)))
  for (let s = 0; s <= amostras; s += 1) {
    const x = w.x1 + ((w.x2 - w.x1) * s) / amostras
    const y = w.y1 + ((w.y2 - w.y1) * s) / amostras
    const c0 = Math.max(0, Math.floor((x - alcance) / grid))
    const c1 = Math.min(colunas - 1, Math.floor((x + alcance) / grid))
    const r0 = Math.max(0, Math.floor((y - alcance) / grid))
    const r1 = Math.min(linhas - 1, Math.floor((y + alcance) / grid))
    for (let row = r0; row <= r1; row += 1) {
      for (let col = c0; col <= c1; col += 1) {
        const chave = col + row * colunas
        const balde = baldes.get(chave)
        if (balde === undefined) baldes.set(chave, [indice])
        else if (balde[balde.length - 1] !== indice) balde.push(indice)
      }
    }
  }
}

/**
 * Monta o mapa dos blocos: `colunas` x `linhas` casas de `grid` px. Grade sem
 * tamanho (ou número que não é número) dá mapa sem casa: todo passo é inválido.
 * Fica só o trecho de cada parede perto do mapa: o resto não chega a casa nenhuma.
 */
export function montarMapaDosBlocos(paredes: readonly ParedeDoPasso[], grid: number, colunas: number, linhas: number): MapaDosBlocos {
  const finito = Number.isFinite(grid) && Number.isFinite(colunas) && Number.isFinite(linhas)
  if (!finito || grid <= 0 || colunas <= 0 || linhas <= 0) return { grid: 1, colunas: 0, linhas: 0, paredes: [], baldes: new Map() }
  const totalDeColunas = Math.ceil(colunas)
  const totalDeLinhas = Math.ceil(linhas)
  const alcance = alcanceDoBalde(grid)
  const tracos: TracoDeParede[] = []
  for (const w of paredes) {
    if (!paredeBarraOPasso(w)) continue
    const trecho = trechoNaCaixa(w, -alcance, -alcance, totalDeColunas * grid + alcance, totalDeLinhas * grid + alcance)
    if (trecho !== null) tracos.push(trecho)
  }
  const baldes = new Map<number, number[]>()
  tracos.forEach((traco, indice) => guardarNosBaldes(baldes, grid, totalDeColunas, totalDeLinhas, traco, indice))
  return { grid, colunas: totalDeColunas, linhas: totalDeLinhas, paredes: tracos, baldes }
}

/** As paredes guardadas no balde da casa (vazio quando nenhuma chega perto). */
function baldeDaCasa(mapa: MapaDosBlocos, casa: Casa): readonly number[] {
  return mapa.baldes.get(chaveDaCasa(mapa, casa.col, casa.row)) ?? SEM_PAREDES
}

const SEM_PAREDES: readonly number[] = []

/** Alguma parede do balde da casa encosta no traço p→q? */
function baldeEncostaNoTraco(mapa: MapaDosBlocos, casa: Casa, p: Point, q: Point): boolean {
  for (const indice of baldeDaCasa(mapa, casa)) {
    const w = mapa.paredes[indice]
    if (w !== undefined && segmentsIntersect(p, q, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 })) return true
  }
  return false
}

/** Passo reto de centro a centro: alguma parede encosta no traço? Basta olhar os baldes das duas casas. */
function tracoBarrado(mapa: MapaDosBlocos, a: Casa, b: Casa): boolean {
  const p = centroDaCasa(a, mapa.grid)
  const q = centroDaCasa(b, mapa.grid)
  return baldeEncostaNoTraco(mapa, a, p, q) || baldeEncostaNoTraco(mapa, b, p, q)
}

/** Lado de `c` em relação à reta a→b: positivo, negativo ou zero (em cima). */
function lado(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}

/** O traço p→q atravessa a parede de um lado ao outro, sem só encostar na ponta. */
function atravessa(p: Point, q: Point, w: TracoDeParede): boolean {
  const a = { x: w.x1, y: w.y1 }
  const b = { x: w.x2, y: w.y2 }
  return lado(p, q, a) * lado(p, q, b) < 0 && lado(a, b, p) * lado(a, b, q) < 0
}

/** Distância entre o traço p→q e a parede: zero quando se tocam. */
function distanciaAteAParede(p: Point, q: Point, w: TracoDeParede): number {
  if (segmentsIntersect(p, q, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 })) return 0
  return Math.min(
    distanciaAoTraco(p.x, p.y, w.x1, w.y1, w.x2, w.y2),
    distanciaAoTraco(q.x, q.y, w.x1, w.y1, w.x2, w.y2),
    distanciaAoTraco(w.x1, w.y1, p.x, p.y, q.x, q.y),
    distanciaAoTraco(w.x2, w.y2, p.x, p.y, q.x, q.y),
  )
}

/**
 * O traço diagonal p→q contra as paredes do balde da casa: `parede` se alguma
 * o atravessa, `quina` se alguma passa a menos da folga, `livre` se nenhuma.
 */
function diagonalContraOBalde(mapa: MapaDosBlocos, casa: Casa, p: Point, q: Point): VereditoDoPasso {
  const folga = mapa.grid * FOLGA_DA_QUINA
  let veredito: VereditoDoPasso = 'livre'
  for (const indice of baldeDaCasa(mapa, casa)) {
    const w = mapa.paredes[indice]
    if (w === undefined) continue
    if (atravessa(p, q, w)) return 'parede'
    if (distanciaAteAParede(p, q, w) < folga) veredito = 'quina'
  }
  return veredito
}

/**
 * Diagonal de `a` para `d`; `b` e `c` são as duas casas ao lado da quina.
 * Parede a menos da folga do traço tem um ponto a menos da folga de `a` ou de
 * `d` (o traço fica dentro das duas), então os baldes delas bastam.
 */
function vereditoDaDiagonal(mapa: MapaDosBlocos, a: Casa, d: Casa): VereditoDoPasso {
  const p = centroDaCasa(a, mapa.grid)
  const q = centroDaCasa(d, mapa.grid)
  const deA = diagonalContraOBalde(mapa, a, p, q)
  if (deA === 'parede') return 'parede'
  const deD = diagonalContraOBalde(mapa, d, p, q)
  if (deD === 'parede') return 'parede'
  if (deA === 'quina' || deD === 'quina') return 'quina'
  const b = { col: d.col, row: a.row }
  const c = { col: a.col, row: d.row }
  const retoBarrado = tracoBarrado(mapa, a, b) || tracoBarrado(mapa, b, d) || tracoBarrado(mapa, a, c) || tracoBarrado(mapa, c, d)
  return retoBarrado ? 'quina' : 'livre'
}

/** O veredito de um passo de 1 bloco, reto ou diagonal, de `de` para `para`. */
export function conferirPasso(mapa: MapaDosBlocos, de: Casa, para: Casa): VereditoDoPasso {
  if (!casaNoMapa(mapa, de) || !casaNoMapa(mapa, para) || blocosEntre(de, para) !== 1) return 'invalido'
  const diagonal = de.col !== para.col && de.row !== para.row
  if (diagonal) return vereditoDaDiagonal(mapa, de, para)
  return tracoBarrado(mapa, de, para) ? 'parede' : 'livre'
}

/**
 * O menor movimento de `de` até `para`, um bloco por passo, só por passos
 * livres e dentro do mapa. Em campo livre conta max(|dx|, |dy|); com parede no
 * caminho conta a volta. `null` quando não se chega em até `limite` blocos.
 * Busca em largura na janela de `limite` casas em volta de `de`.
 */
export function menorCaminhoEmBlocos(mapa: MapaDosBlocos, de: Casa, para: Casa, limite: number): MovimentoEmBlocos | null {
  if (Number.isNaN(limite) || !casaNoMapa(mapa, de) || !casaNoMapa(mapa, para)) return null
  const teto = Math.max(0, Math.floor(limite))
  if (blocosEntre(de, para) > teto) return null
  if (blocosEntre(de, para) === 0) return { blocos: 0, caminho: [de] }

  const c0 = Math.max(0, de.col - teto)
  const c1 = Math.min(mapa.colunas - 1, de.col + teto)
  const r0 = Math.max(0, de.row - teto)
  const r1 = Math.min(mapa.linhas - 1, de.row + teto)
  const largura = c1 - c0 + 1
  const total = largura * (r1 - r0 + 1)
  const indiceDe = (col: number, row: number): number => col - c0 + (row - r0) * largura
  const distancia = new Int32Array(total).fill(-1)
  const veio = new Int32Array(total).fill(-1)
  const fila = new Int32Array(total)
  const inicio = indiceDe(de.col, de.row)
  const alvo = indiceDe(para.col, para.row)
  distancia[inicio] = 0
  fila[0] = inicio
  let fim = 1

  for (let cabeca = 0; cabeca < fim; cabeca += 1) {
    const atual = fila[cabeca]
    const andados = distancia[atual]
    if (andados >= teto) continue
    const daqui = { col: c0 + (atual % largura), row: r0 + Math.floor(atual / largura) }
    for (const [dc, dr] of VIZINHOS) {
      const ali = { col: daqui.col + dc, row: daqui.row + dr }
      if (ali.col < c0 || ali.col > c1 || ali.row < r0 || ali.row > r1) continue
      const indice = indiceDe(ali.col, ali.row)
      if (distancia[indice] !== -1 || conferirPasso(mapa, daqui, ali) !== 'livre') continue
      distancia[indice] = andados + 1
      veio[indice] = atual
      if (indice === alvo) return { blocos: andados + 1, caminho: caminhoAte(veio, alvo, c0, r0, largura) }
      fila[fim] = indice
      fim += 1
    }
  }
  return null
}

/** Refaz o caminho pelos `veio`, da chegada até a saída, e devolve na ordem de andar. */
function caminhoAte(veio: Int32Array, alvo: number, c0: number, r0: number, largura: number): Casa[] {
  const caminho: Casa[] = []
  for (let indice = alvo; indice !== -1; indice = veio[indice]) {
    caminho.push({ col: c0 + (indice % largura), row: r0 + Math.floor(indice / largura) })
  }
  return caminho.reverse()
}
