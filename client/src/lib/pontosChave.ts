/**
 * EDITAR O TRAÇO DEPOIS DE PRONTO, como a sala livre: alças nos PONTOS-CHAVE.
 *
 * Vale para dois desenhos que guardam uma lista de pontos:
 * - o traço do Pincel (`freehand`): centenas de pontos brutos, um por
 *   pointermove. Pegar todos seria uma alça a cada 3 px; os pontos-chave são
 *   os que o Douglas-Peucker guarda — uma alça a cada ~30-60 px de curva;
 * - o polígono (`polygon`): a forma Polígono e a pintura do balde. Polígono
 *   com poucos cantos tem alça em todos; pintura antiga cheia de degraus passa
 *   pelo mesmo Douglas-Peucker e só os cantos de verdade ganham alça.
 *
 * Os pontos brutos entre dois pontos-chave NÃO são jogados fora: arrastar uma
 * alça desloca o trecho dela com peso que cai até zero nos pontos-chave
 * vizinhos, e o tremido da mão continua lá. No traço o peso é suave
 * (smoothstep: o trecho entorta sem bico); no polígono é reto (linear: aresta
 * reta continua reta, como na sala livre).
 *
 * Depois da primeira edição os índices dos pontos-chave ficam guardados no
 * próprio desenho (`pontosChave`), para as alças não pularem de lugar: o
 * Douglas-Peucker de um traço já entortado escolheria outros pontos. Índice
 * guardado que não bate mais com os pontos (outra operação mudou a contagem,
 * arquivo editado à mão) é ignorado e o cálculo volta.
 *
 * Tudo puro: a store (`stores/mapStore.ts`) e o canvas só chamam daqui.
 */
import type { Drawing, DrawingPoint, MapData } from '../types/map'

/** Desenho que se edita por pontos-chave. */
export type DesenhoPorPontos = Extract<Drawing, { kind: 'freehand' | 'polygon' }>

export function editavelPorPontos(drawing: Drawing): drawing is DesenhoPorPontos {
  return drawing.kind === 'freehand' || drawing.kind === 'polygon'
}

/**
 * Quanto um ponto bruto pode ficar longe do trecho reto entre dois
 * pontos-chave, em px de MUNDO (fixo: os pontos-chave são do desenho, não do
 * zoom). Numa curva de raio R o Douglas-Peucker guarda um ponto a cada
 * ~√(8·R·tolerância): com 4 px, curva fechada de raio 30 dá uma alça a cada
 * ~31 px e curva aberta de raio 150, a cada ~69 px. E 4 px fica acima do
 * tremido de uma mão (1-2 px), que assim não vira alça.
 */
export const TOLERANCIA_DOS_PONTOS_CHAVE = 4

/**
 * Teto de alças de um desenho que ainda não foi editado. Rabisco enorme
 * passaria disso; a tolerância cresce até caber. A bolinha vazada de meio
 * cria mais onde a pessoa quiser.
 */
export const MAXIMO_DE_ALCAS = 60

/** Quanto a tolerância cresce a cada tentativa de caber no teto. */
const CRESCIMENTO_DA_TOLERANCIA = 1.5
const TENTATIVAS_DE_CABER = 12

/**
 * Trecho mais curto que isto NA TELA, em px, não ganha bolinha vazada de meio:
 * com o zoom longe, vértice e meio se amontoariam e o traço inteiro viraria
 * alça — não sobraria onde pegar para mover.
 */
export const TRECHO_MINIMO_PARA_MEIO_NA_TELA = 24

/** Ponto do meio a menos disto de um ponto bruto já existente reaproveita esse ponto. */
const MESMO_PONTO = 0.5

// ─────────────────────────────────────────────────────────────
// Douglas-Peucker
// ─────────────────────────────────────────────────────────────

/** Distância do ponto ao SEGMENTO (não à reta): traço que volta por cima de si mesmo não some. */
function distanciaAoSegmento(p: DrawingPoint, a: DrawingPoint, b: DrawingPoint): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const comprimento2 = dx * dx + dy * dy
  if (comprimento2 === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / comprimento2))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/**
 * Douglas-Peucker numa polilinha aberta: índices dos pontos guardados, em
 * ordem, sempre com as duas pontas. Pilha em vez de recursão — traço de
 * milhares de pontos não estoura a pilha do JS.
 */
export function douglasPeucker(pontos: readonly DrawingPoint[], tolerancia: number): number[] {
  const n = pontos.length
  if (n <= 2) return pontos.map((_, i) => i)
  const manter = new Uint8Array(n)
  manter[0] = 1
  manter[n - 1] = 1
  const pendentes: Array<[number, number]> = [[0, n - 1]]
  while (pendentes.length > 0) {
    const trecho = pendentes.pop()
    if (trecho === undefined) break
    const [i, j] = trecho
    let pior = -1
    let maior = tolerancia
    for (let k = i + 1; k < j; k += 1) {
      const d = distanciaAoSegmento(pontos[k], pontos[i], pontos[j])
      if (d > maior) {
        maior = d
        pior = k
      }
    }
    if (pior < 0) continue
    manter[pior] = 1
    pendentes.push([i, pior], [pior, j])
  }
  const indices: number[] = []
  for (let i = 0; i < n; i += 1) if (manter[i] === 1) indices.push(i)
  return indices
}

// ─────────────────────────────────────────────────────────────
// Fechadura da pintura do balde
// ─────────────────────────────────────────────────────────────

const chaveDaAresta = (a: DrawingPoint, b: DrawingPoint): string => `${a.x},${a.y}|${b.x},${b.y}`

const arestasDobradasMemo = new WeakMap<readonly DrawingPoint[], Set<number>>()

/**
 * Arestas `i → i+1` do anel que o próprio anel percorre de volta (`j → j+1`
 * com as pontas trocadas). É a assinatura do "buraco de fechadura" que o
 * balde usa para pintar em volta de um buraco com um anel só
 * (`juntarBuracos`, lib/baldeDeTinta.ts): a ponte vai e volta pelo mesmo
 * caminho. Arrastar só uma das cópias rasgaria o buraco.
 */
function arestasDobradas(pontos: readonly DrawingPoint[]): Set<number> {
  const guardado = arestasDobradasMemo.get(pontos)
  if (guardado) return guardado
  const n = pontos.length
  const porChave = new Map<string, number>()
  for (let i = 0; i < n; i += 1) porChave.set(chaveDaAresta(pontos[i], pontos[(i + 1) % n]), i)
  const dobradas = new Set<number>()
  for (let i = 0; i < n; i += 1) {
    const a = pontos[i]
    const b = pontos[(i + 1) % n]
    if (a.x === b.x && a.y === b.y) continue
    const volta = porChave.get(chaveDaAresta(b, a))
    if (volta !== undefined && volta !== i) dobradas.add(i)
  }
  arestasDobradasMemo.set(pontos, dobradas)
  return dobradas
}

/**
 * Pontos do anel que ficam PARADOS: as pontas da ponte de ida e volta. São
 * pontos-chave (peso zero, nenhum arrasto vizinho os tira do lugar) mas sem
 * alça, e não saem por duplo clique — uma ponta de ponte movida sozinha abriria
 * um rasgo no buraco.
 */
export function ancorasDaFechadura(pontos: readonly DrawingPoint[]): Set<number> {
  const n = pontos.length
  const ancoras = new Set<number>()
  for (const i of arestasDobradas(pontos)) {
    ancoras.add(i)
    ancoras.add((i + 1) % n)
  }
  return ancoras
}

// ─────────────────────────────────────────────────────────────
// Quais são os pontos-chave
// ─────────────────────────────────────────────────────────────

const ehFechado = (desenho: DesenhoPorPontos): boolean => desenho.kind === 'polygon'

/** Índices de `a` até `b` andando para a frente; no anel, dá a volta pelo fim. */
function indicesDoTrecho(a: number, b: number, n: number): number[] {
  const indices = [a]
  let i = a
  while (i !== b) {
    i = (i + 1) % n
    indices.push(i)
  }
  return indices
}

/** Douglas-Peucker do trecho `a → b` (no anel, com volta), marcando em `manter`. */
function marcarTrecho(pontos: readonly DrawingPoint[], a: number, b: number, tolerancia: number, manter: Uint8Array): void {
  const indices = indicesDoTrecho(a, b, pontos.length)
  for (const k of douglasPeucker(indices.map((i) => pontos[i]), tolerancia)) manter[indices[k]] = 1
}

function indiceMaisLonge(pontos: readonly DrawingPoint[], de: number): number {
  let melhor = de
  let maior = -1
  for (let i = 0; i < pontos.length; i += 1) {
    const d = Math.hypot(pontos[i].x - pontos[de].x, pontos[i].y - pontos[de].y)
    if (d > maior) {
      maior = d
      melhor = i
    }
  }
  return melhor
}

function chavesDoAnel(pontos: readonly DrawingPoint[], tolerancia: number, ancoras: ReadonlySet<number>): number[] {
  const n = pontos.length
  const fixos = [...ancoras].sort((a, b) => a - b)
  if (fixos.length === 0) fixos.push(0)
  if (fixos.length === 1) {
    const longe = indiceMaisLonge(pontos, fixos[0])
    if (longe !== fixos[0]) fixos.push(longe)
    fixos.sort((a, b) => a - b)
  }
  const manter = new Uint8Array(n)
  for (const i of fixos) manter[i] = 1
  for (let k = 0; k < fixos.length; k += 1) {
    const a = fixos[k]
    const b = fixos[(k + 1) % fixos.length]
    if (a !== b) marcarTrecho(pontos, a, b, tolerancia, manter)
  }
  const chaves: number[] = []
  for (let i = 0; i < n; i += 1) if (manter[i] === 1) chaves.push(i)
  return chaves
}

/** Pontos-chave calculados, com a tolerância crescendo até caber no teto. */
function calcularChaves(pontos: readonly DrawingPoint[], fechado: boolean, ancoras: ReadonlySet<number>): number[] {
  const n = pontos.length
  if (fechado && n <= 3) return pontos.map((_, i) => i)
  let tolerancia = TOLERANCIA_DOS_PONTOS_CHAVE
  let chaves: number[] = []
  for (let tentativa = 0; tentativa < TENTATIVAS_DE_CABER; tentativa += 1) {
    chaves = fechado ? chavesDoAnel(pontos, tolerancia, ancoras) : douglasPeucker(pontos, tolerancia)
    if (chaves.length <= MAXIMO_DE_ALCAS) break
    tolerancia *= CRESCIMENTO_DA_TOLERANCIA
  }
  // Anel quase reto (todos os pontos numa linha): três pontos-chave espalhados,
  // o mínimo para ainda ser um polígono.
  if (fechado && chaves.length < 3) return [0, Math.floor(n / 3), Math.floor((2 * n) / 3)]
  return chaves
}

const chavesCalculadasMemo = new WeakMap<readonly DrawingPoint[], number[]>()

/** Os índices guardados valem para os pontos de agora? */
function chavesGuardadasValem(chaves: readonly unknown[], n: number, fechado: boolean): chaves is number[] {
  if (chaves.length < (fechado ? 3 : 2)) return false
  let anterior = -1
  for (const chave of chaves) {
    if (typeof chave !== 'number' || !Number.isInteger(chave) || chave <= anterior || chave >= n) return false
    anterior = chave
  }
  if (fechado) return true
  return chaves[0] === 0 && chaves[chaves.length - 1] === n - 1
}

/**
 * Índices (em `points`) dos pontos-chave, em ordem crescente: os guardados
 * quando ainda valem, senão o Douglas-Peucker. No polígono as âncoras da
 * fechadura sempre entram.
 */
export function pontosChaveDoDesenho(desenho: DesenhoPorPontos): number[] {
  const { points } = desenho
  const fechado = ehFechado(desenho)
  const ancoras = fechado ? ancorasDaFechadura(points) : new Set<number>()
  // `pontosChave` vem também de arquivo salvo: o tipo diz number[], mas o que
  // está lá dentro é conferido item a item antes de valer.
  const guardadas: readonly unknown[] | undefined = Array.isArray(desenho.pontosChave) ? desenho.pontosChave : undefined
  if (guardadas !== undefined && chavesGuardadasValem(guardadas, points.length, fechado)) {
    if ([...ancoras].every((i) => guardadas.includes(i))) return [...guardadas]
    return [...new Set([...guardadas, ...ancoras])].sort((a, b) => a - b)
  }
  const memo = chavesCalculadasMemo.get(points)
  if (memo) return [...memo]
  const calculadas = calcularChaves(points, fechado, ancoras)
  chavesCalculadasMemo.set(points, calculadas)
  return [...calculadas]
}

// ─────────────────────────────────────────────────────────────
// Medidas ao longo do traço
// ─────────────────────────────────────────────────────────────

/** Comprimento acumulado de cada índice do trecho, a partir do primeiro. */
function acumulado(pontos: readonly DrawingPoint[], indices: readonly number[]): number[] {
  const soma = [0]
  for (let k = 1; k < indices.length; k += 1) {
    const a = pontos[indices[k - 1]]
    const b = pontos[indices[k]]
    soma.push(soma[k - 1] + Math.hypot(b.x - a.x, b.y - a.y))
  }
  return soma
}

/** Posição de cada índice do trecho, de 0 (primeiro) a 1 (último), pelo comprimento. Trecho de comprimento zero usa a contagem. */
function fracoes(pontos: readonly DrawingPoint[], indices: readonly number[]): number[] {
  const soma = acumulado(pontos, indices)
  const total = soma[soma.length - 1]
  const ultimo = indices.length - 1
  return soma.map((s, k) => (total > 0 ? s / total : ultimo > 0 ? k / ultimo : 0))
}

interface MeioDoTrecho {
  x: number
  y: number
  /** Ponto bruto que já está ali (reaproveitado em vez de duplicar). */
  existente: number | null
  /** Onde o ponto novo entra em `points` quando não há um existente. */
  inserirEm: number
  /** Comprimento do trecho inteiro, em px de mundo. */
  comprimento: number
}

/** O ponto no MEIO do trecho entre dois pontos-chave, medido pelo comprimento do traço. */
function meioDoTrecho(pontos: readonly DrawingPoint[], a: number, b: number): MeioDoTrecho | null {
  const indices = indicesDoTrecho(a, b, pontos.length)
  const soma = acumulado(pontos, indices)
  const total = soma[soma.length - 1]
  if (!(total > 0)) return null
  const metade = total / 2
  let k = 0
  while (k < indices.length - 2 && soma[k + 1] < metade) k += 1
  const de = pontos[indices[k]]
  const ate = pontos[indices[k + 1]]
  const lado = soma[k + 1] - soma[k]
  const t = lado > 0 ? (metade - soma[k]) / lado : 0
  const x = de.x + (ate.x - de.x) * t
  const y = de.y + (ate.y - de.y) * t
  let existente: number | null = null
  if (k > 0 && t * lado < MESMO_PONTO) existente = indices[k]
  else if (k + 1 < indices.length - 1 && (1 - t) * lado < MESMO_PONTO) existente = indices[k + 1]
  return { x, y, existente, inserirEm: indices[k] + 1, comprimento: total }
}

// ─────────────────────────────────────────────────────────────
// Alças
// ─────────────────────────────────────────────────────────────

export interface AlcaDeVertice {
  x: number
  y: number
  /** Índice em `pontosChaveDoDesenho(desenho)`. */
  chave: number
}

export interface AlcaDeMeio {
  x: number
  y: number
  /** O trecho vai do ponto-chave `depoisDaChave` ao seguinte. */
  depoisDaChave: number
}

export interface AlcasDoDesenho {
  vertices: AlcaDeVertice[]
  meios: AlcaDeMeio[]
}

/** A ponte da fechadura: trecho que é uma aresta só, e dobrada. */
function trechoEhPonte(pontos: readonly DrawingPoint[], a: number, b: number): boolean {
  return b === (a + 1) % pontos.length && arestasDobradas(pontos).has(a)
}

/** Quantidade de trechos entre pontos-chave: no anel o último volta ao primeiro. */
function quantosTrechos(chaves: readonly number[], fechado: boolean): number {
  return fechado ? chaves.length : chaves.length - 1
}

/**
 * Onde desenhar (e onde clicar) as alças: bolinha cheia em cada ponto-chave
 * (menos âncora) e vazada no meio de cada trecho (menos ponte e trecho curto
 * demais na tela). `escalaDaCamera` só decide os meios: ausente = 1.
 */
export function alcasDoDesenho(desenho: DesenhoPorPontos, escalaDaCamera = 1): AlcasDoDesenho {
  const { points } = desenho
  const fechado = ehFechado(desenho)
  if (points.length < (fechado ? 3 : 2)) return { vertices: [], meios: [] }
  const chaves = pontosChaveDoDesenho(desenho)
  const ancoras = fechado ? ancorasDaFechadura(points) : new Set<number>()
  const vertices: AlcaDeVertice[] = []
  chaves.forEach((indice, chave) => {
    if (!ancoras.has(indice)) vertices.push({ x: points[indice].x, y: points[indice].y, chave })
  })
  const escala = Number.isFinite(escalaDaCamera) && escalaDaCamera > 0 ? escalaDaCamera : 1
  const meios: AlcaDeMeio[] = []
  for (let s = 0; s < quantosTrechos(chaves, fechado); s += 1) {
    const a = chaves[s]
    const b = chaves[(s + 1) % chaves.length]
    if (trechoEhPonte(points, a, b)) continue
    const meio = meioDoTrecho(points, a, b)
    if (meio === null || meio.comprimento * escala < TRECHO_MINIMO_PARA_MEIO_NA_TELA) continue
    meios.push({ x: meio.x, y: meio.y, depoisDaChave: s })
  }
  return { vertices, meios }
}

// ─────────────────────────────────────────────────────────────
// Arrastar, inserir, remover
// ─────────────────────────────────────────────────────────────

/** Peso do deslocamento pela posição no trecho (0 no vizinho, 1 no ponto arrastado). */
type Perfil = (t: number) => number
const suave: Perfil = (t) => t * t * (3 - 2 * t)
const reto: Perfil = (t) => t

const perfilDe = (desenho: DesenhoPorPontos): Perfil => (desenho.kind === 'freehand' ? suave : reto)

/** Posição de cada índice do trecho, de 0 a 1 — é ela que decide o peso. */
type Medida = (indices: readonly number[]) => number[]

/** Pela ordem do ponto no trecho, sem olhar a geometria. */
const peloIndice: Medida = (indices) => indices.map((_, k) => (indices.length > 1 ? k / (indices.length - 1) : 0))

/** Pelo comprimento ao longo de `pontos`. */
const peloComprimentoEm = (pontos: readonly DrawingPoint[]): Medida => (indices) => fracoes(pontos, indices)

/**
 * Desloca o trecho `de → ate` (pontas de fora) por `(dx, dy)` com o peso do
 * perfil: `crescente` = peso 0 em `de` e 1 em `ate`; senão, o contrário.
 */
function deslocarTrecho(
  base: readonly DrawingPoint[],
  saida: DrawingPoint[],
  de: number,
  ate: number,
  dx: number,
  dy: number,
  perfil: Perfil,
  crescente: boolean,
  medir: Medida,
): void {
  const indices = indicesDoTrecho(de, ate, base.length)
  const posicao = medir(indices)
  for (let k = 1; k < indices.length - 1; k += 1) {
    const peso = perfil(crescente ? posicao[k] : 1 - posicao[k])
    const p = base[indices[k]]
    saida[indices[k]] = { x: p.x + dx * peso, y: p.y + dy * peso }
  }
}

/**
 * Pontos com o ponto-chave `chave` levado a (x, y) e os trechos vizinhos
 * acompanhando. `medir` decide a posição (e o peso) de cada ponto no trecho;
 * ausente, o comprimento ao longo dos próprios pontos.
 */
function pontosArrastados(
  desenho: DesenhoPorPontos,
  chaves: readonly number[],
  chave: number,
  x: number,
  y: number,
  medir: Medida = peloComprimentoEm(desenho.points),
): DrawingPoint[] {
  const base = desenho.points
  const fechado = ehFechado(desenho)
  const m = chaves.length
  const indice = chaves[chave]
  const dx = x - base[indice].x
  const dy = y - base[indice].y
  const saida = base.slice()
  const perfil = perfilDe(desenho)
  const temAnterior = fechado ? m >= 3 : chave > 0
  const temSeguinte = fechado ? m >= 3 : chave < m - 1
  if (temAnterior) deslocarTrecho(base, saida, chaves[(chave - 1 + m) % m], indice, dx, dy, perfil, true, medir)
  if (temSeguinte) deslocarTrecho(base, saida, indice, chaves[(chave + 1) % m], dx, dy, perfil, false, medir)
  saida[indice] = { x, y }
  return saida
}

/**
 * Arrasta o ponto-chave `chave` (índice em `pontosChaveDoDesenho`) até (x, y).
 * `desenho` é o de ANTES do gesto: cada pointermove recalcula a partir dele,
 * senão os pesos se acumulariam passo a passo. Os vizinhos ficam parados.
 * Âncora da fechadura não se arrasta (devolve o mesmo desenho).
 */
export function arrastarPontoChave(desenho: DesenhoPorPontos, chave: number, x: number, y: number): DesenhoPorPontos {
  const chaves = pontosChaveDoDesenho(desenho)
  if (!Number.isInteger(chave) || chave < 0 || chave >= chaves.length) return desenho
  if (ehFechado(desenho) && ancorasDaFechadura(desenho.points).has(chaves[chave])) return desenho
  // Ponteiro de volta ao lugar de antes do gesto: o desenho de antes, intacto
  // (clique na alça sem arrastar não vira passo de desfazer).
  const origem = desenho.points[chaves[chave]]
  if (origem.x === x && origem.y === y) return desenho
  return { ...desenho, points: pontosArrastados(desenho, chaves, chave, x, y), pontosChave: chaves }
}

/**
 * Cria um ponto-chave no meio do trecho que começa no ponto-chave
 * `depoisDaChave` — é a bolinha vazada. O desenho não muda de forma: ou um
 * ponto bruto que já estava ali vira ponto-chave, ou entra um ponto novo sobre
 * o traço. Devolve o desenho e o índice do ponto-chave novo (para já sair
 * arrastando), ou `null` se o trecho não aceita (ponte da fechadura, trecho de
 * comprimento zero, índice fora).
 */
export function inserirPontoChave(desenho: DesenhoPorPontos, depoisDaChave: number): { desenho: DesenhoPorPontos; chave: number } | null {
  const { points } = desenho
  const fechado = ehFechado(desenho)
  const chaves = pontosChaveDoDesenho(desenho)
  if (!Number.isInteger(depoisDaChave) || depoisDaChave < 0 || depoisDaChave >= quantosTrechos(chaves, fechado)) return null
  const a = chaves[depoisDaChave]
  const b = chaves[(depoisDaChave + 1) % chaves.length]
  if (trechoEhPonte(points, a, b)) return null
  const meio = meioDoTrecho(points, a, b)
  if (meio === null) return null

  if (meio.existente !== null) {
    const novas = [...chaves, meio.existente].sort((p, q) => p - q)
    return { desenho: { ...desenho, pontosChave: novas }, chave: novas.indexOf(meio.existente) }
  }
  const em = meio.inserirEm
  const pontos = [...points.slice(0, em), { x: meio.x, y: meio.y }, ...points.slice(em)]
  const novas = [...chaves.map((i) => (i >= em ? i + 1 : i)), em].sort((p, q) => p - q)
  return { desenho: { ...desenho, points: pontos, pontosChave: novas }, chave: novas.indexOf(em) }
}

const distancia = (a: DrawingPoint, b: DrawingPoint): number => Math.hypot(b.x - a.x, b.y - a.y)

/**
 * Catmull-Rom entre `p1` e `p2` em `u` ∈ [0, 1], com o espaçamento pelo
 * comprimento das cordas (forma de Hermite). O uniforme trata trecho de 20 px
 * ao lado de um de 160 px como iguais e encolhe ou passa do ponto no curto.
 */
function catmullRom(p0: DrawingPoint, p1: DrawingPoint, p2: DrawingPoint, p3: DrawingPoint, u: number): DrawingPoint {
  const d01 = distancia(p0, p1)
  const d12 = distancia(p1, p2)
  const d23 = distancia(p2, p3)
  const escala1 = d01 + d12 > 0 ? d12 / (d01 + d12) : 0
  const escala2 = d12 + d23 > 0 ? d12 / (d12 + d23) : 0
  const u2 = u * u
  const u3 = u2 * u
  const h00 = 2 * u3 - 3 * u2 + 1
  const h10 = u3 - 2 * u2 + u
  const h01 = -2 * u3 + 3 * u2
  const h11 = u3 - u2
  const eixo = (a: number, b: number, c: number, d: number): number =>
    h00 * b + h10 * (c - a) * escala1 + h01 * c + h11 * (d - b) * escala2
  return { x: eixo(p0.x, p1.x, p2.x, p3.x), y: eixo(p0.y, p1.y, p2.y, p3.y) }
}

const refletir = (centro: DrawingPoint, outro: DrawingPoint): DrawingPoint => ({ x: 2 * centro.x - outro.x, y: 2 * centro.y - outro.y })

/**
 * Rodadas do peso pelo comprimento na remoção, depois da estimativa pela
 * ordem dos pontos. Medido arrastando e depois apagando o mesmo ponto num
 * traço de 200 px com a mão acelerando (espaçamento ∝ i^0,3), três casos: com
 * 1 rodada sobravam 0,37 / 4,3 / 6,5 px fora do lugar; com 2, 0,16 / 1,9 /
 * 5,8 px. Mais rodadas não melhoram e no caso assimétrico voltam a piorar.
 */
const REFINOS_DA_REMOCAO = 2

/**
 * Onde o ponto-chave `chave` estaria se ele não existisse: na curva entre os
 * dois vizinhos, na mesma fração do comprimento. No traço, a curva suave que
 * passa pelos pontos-chave em volta (Catmull-Rom; sem vizinho além, o reflexo
 * do outro lado); no polígono, a aresta reta entre os vizinhos.
 */
function semOPontoChave(desenho: DesenhoPorPontos, chaves: readonly number[], chave: number): DrawingPoint {
  const pontos = desenho.points
  const m = chaves.length
  const anterior = chaves[(chave - 1 + m) % m]
  const seguinte = chaves[(chave + 1) % m]
  const indices = indicesDoTrecho(anterior, seguinte, pontos.length)
  const u = fracoes(pontos, indices)[indices.indexOf(chaves[chave])]
  const p1 = pontos[anterior]
  const p2 = pontos[seguinte]
  if (ehFechado(desenho)) return { x: p1.x + (p2.x - p1.x) * u, y: p1.y + (p2.y - p1.y) * u }
  const p0 = chave >= 2 ? pontos[chaves[chave - 2]] : refletir(p1, p2)
  const p3 = chave + 2 < m ? pontos[chaves[chave + 2]] : refletir(p2, p1)
  return catmullRom(p0, p1, p2, p3, u)
}

/** Tira o ponto bruto `indice` e o ponto-chave `chave` (que aponta para ele). */
function semOPontoBruto(desenho: DesenhoPorPontos, pontos: readonly DrawingPoint[], chaves: readonly number[], chave: number): DesenhoPorPontos {
  const indice = chaves[chave]
  const novos = pontos.filter((_, i) => i !== indice)
  const novas = chaves.filter((_, k) => k !== chave).map((i) => (i > indice ? i - 1 : i))
  return { ...desenho, points: novos, pontosChave: novas }
}

/**
 * Duplo clique numa alça: o ponto-chave sai. O trecho entre os vizinhos é
 * puxado para a curva que eles fariam sem ele — o mesmo deslocamento suave do
 * arrasto, então o tremido fica — e o traço continua inteiro, sem partir em
 * dois. A PONTA de um traço sai encurtando o traço até o ponto-chave vizinho,
 * como apagar o último ponto de uma curva. `null` quando não pode: traço com
 * 2 pontos-chave, polígono com 3, âncora da fechadura.
 */
export function removerPontoChave(desenho: DesenhoPorPontos, chave: number): DesenhoPorPontos | null {
  const chaves = pontosChaveDoDesenho(desenho)
  const m = chaves.length
  const fechado = ehFechado(desenho)
  if (!Number.isInteger(chave) || chave < 0 || chave >= m) return null

  if (fechado) {
    if (m <= 3 || desenho.points.length <= 3) return null
    if (ancorasDaFechadura(desenho.points).has(chaves[chave])) return null
  } else {
    if (m <= 2) return null
    if (chave === 0) {
      const corte = chaves[1]
      return { ...desenho, points: desenho.points.slice(corte), pontosChave: chaves.slice(1).map((i) => i - corte) }
    }
    if (chave === m - 1) {
      return { ...desenho, points: desenho.points.slice(0, chaves[m - 2] + 1), pontosChave: chaves.slice(0, m - 1) }
    }
  }

  // O peso da volta não pode ser medido no traço torto: num pico puxado de um
  // trecho curto, o comprimento do pico distorce as posições e sobrava um laço
  // (visto na prova de 08/10/2026). Primeiro uma estimativa do traço sem o
  // pico, pesando pela ordem dos pontos (o Pincel grava ~1 ponto por
  // pointermove, quase uniforme); depois o peso pelo comprimento medido na
  // estimativa, refeita algumas vezes. Peso sempre crescente ao longo do
  // traço: não forma laço.
  const alvo = semOPontoChave(desenho, chaves, chave)
  let puxados = pontosArrastados(desenho, chaves, chave, alvo.x, alvo.y, peloIndice)
  for (let rodada = 0; rodada < REFINOS_DA_REMOCAO; rodada += 1) {
    puxados = pontosArrastados(desenho, chaves, chave, alvo.x, alvo.y, peloComprimentoEm(puxados))
  }
  return semOPontoBruto(desenho, puxados, chaves, chave)
}

// ─────────────────────────────────────────────────────────────
// No mapa
// ─────────────────────────────────────────────────────────────

/**
 * Leitura do arquivo (`lib/mapFile.ts`): `pontosChave` que não é lista de
 * inteiros sai do desenho, para o tipo (`number[]`) não mentir a quem o ler.
 * Arquivo editado à mão ou de versão futura pode trazer qualquer coisa. Se os
 * índices batem com os pontos é conferido depois, em `pontosChaveDoDesenho`.
 */
export function pontosChaveDoArquivo(drawing: Drawing): Drawing {
  if (!editavelPorPontos(drawing) || drawing.pontosChave === undefined) return drawing
  const valor: unknown = drawing.pontosChave
  if (Array.isArray(valor) && valor.every((v) => Number.isInteger(v))) return drawing
  const semPontosChave = { ...drawing }
  delete semPontosChave.pontosChave
  return semPontosChave
}

/**
 * O mapa com o desenho `drawingId` trocado pelo que `trocar` devolver. Mesmo
 * `map` (mesma referência) quando o desenho não existe, não é traço nem
 * polígono, ou a troca devolve o próprio desenho — é assim que a store sabe
 * que não há passo de desfazer a empurrar.
 */
export function trocarDesenhoPorPontos(
  map: MapData,
  drawingId: string,
  trocar: (desenho: DesenhoPorPontos) => DesenhoPorPontos,
): MapData {
  const indice = map.drawings.findIndex((d) => d.id === drawingId)
  if (indice < 0) return map
  const atual = map.drawings[indice]
  if (!editavelPorPontos(atual)) return map
  const novo = trocar(atual)
  if (novo === atual) return map
  const drawings = map.drawings.slice()
  drawings[indice] = novo
  return { ...map, drawings }
}
