import type { Drawing, DrawingPoint, MapData, Wall } from '../types/map'
import type { SelectionItem, SelectionSet } from './selectionModel'
import { canInteractInLayer, drawingLayer, isLayerLocked, wallLayer } from './layers'
import { pisoDe } from './pisos'

/**
 * ENDIREITAR — pedido 5 de 30/09/2026 (PEDIDOS.md): "depois que eu faço uma
 * linha seria legal eu poder alinhar ela mesmo depois de feita apertando alt,
 * para ela ficar em angulos retos".
 *
 * Endireitar = deixar deitada (0°) ou em pé (90°), a que estiver mais perto,
 * sem mudar o comprimento nem o sentido. Vale para Linha (desenho `line`),
 * Caminho (desenho `path`, trecho a trecho a partir do primeiro ponto) e
 * Parede solta. Parede de Sala fica de fora (a Sala tem o giro dela), e item
 * travado — ele, um pedaço dele ou a camada — também.
 *
 * O PONTO QUE FICA PARADO: abrir buraco entre paredes vaza luz e passo no jogo
 * (`collision`, `fogFilter`), então todo lugar onde o traço encosta em outro
 * do mesmo piso — ponta com ponta, ponta no meio do outro (T), ou a ponta do
 * outro no meio deste — é um ponto FIXO. Nenhum: gira em volta do meio, como
 * no Figma. Um: gira em volta dele. Dois ou mais: fica como estava (presa) e o
 * mestre é avisado. Como todo encontro é fixo para os DOIS lados, duas paredes
 * selecionadas que se encontram continuam se encontrando depois.
 *
 * PAREDE COM PORTA: `addDoorOnWall` troca a parede por 3 pedaços colineares
 * (antes, porta, depois). Para o mestre aquilo é UMA parede, então os pedaços
 * soltos colineares emendados ponta a ponta formam uma CORRENTE que endireita
 * inteira, cada pedaço no mesmo lugar ao longo dela — esteja selecionado um
 * pedaço ou todos. Sem isso o pedaço da porta, emendado dos dois lados, ficaria
 * preso, e cada pedaço de fora giraria em volta dele: um zigue-zague.
 *
 * Sem trigonometria: o eixo que fica é copiado do ponto fixo, então x1 === x2
 * (ou y1 === y2) sai exato, sem ruído de cos/sin.
 *
 * Módulo puro, sem store e sem PixiJS. O Ctrl+Z (um passo para a seleção
 * inteira) e o aviso ficam em `stores/mapStore.ts` → `endireitarSelecionados`;
 * o gesto do Alt, em `lib/toqueDeAlt.ts`.
 */

type Ponto = DrawingPoint

/** Deitada ('h') ou em pé ('v'). */
export type Eixo = 'h' | 'v'

/** O ponto que fica parado num segmento: uma das pontas ou o meio. */
export type Pivo = 'a' | 'b' | 'meio'

/** Até onde um traço "encosta" em outro, em px de mundo: meio pixel, abaixo do
 *  que a junta não se vê nem deixa a luz passar. Vale também para a emenda
 *  entre os pedaços de uma parede com porta. */
const TOLERANCIA_ENCOSTA = 0.5

/** Desvio, em px de mundo, abaixo do qual o traço já conta como reto: ruído de
 *  ponto flutuante não pode virar um passo de desfazer que não muda a tela. */
const TOLERANCIA_RETA = 0.01

/**
 * Mais para deitada fica deitada. Comparar os módulos (em vez de usar atan2)
 * deixa o empate de 45 graus exatos previsível — fica deitado — e livre de
 * ruído de ponto flutuante.
 */
export function eixoMaisProximo(dx: number, dy: number): Eixo {
  return Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v'
}

/** Já está deitada ou em pé, a menos de `TOLERANCIA_RETA`. Comprimento zero conta como reta. */
export function jaEstaReta(a: Ponto, b: Ponto): boolean {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return Math.abs(eixoMaisProximo(dx, dy) === 'h' ? dy : dx) <= TOLERANCIA_RETA
}

function ultimo<T>(lista: readonly T[]): T {
  return lista[lista.length - 1]
}

function distancia(p: Ponto, q: Ponto): number {
  return Math.hypot(p.x - q.x, p.y - q.y)
}

function meio(a: Ponto, b: Ponto): Ponto {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

/** Parâmetro (0..1) do ponto de `ab` mais perto de `p`; 0 num segmento de comprimento zero. */
function parametroNoSegmento(p: Ponto, a: Ponto, b: Ponto): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const quadrado = dx * dx + dy * dy
  if (quadrado === 0) return 0
  return Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / quadrado))
}

function pontoNoSegmento(a: Ponto, b: Ponto, t: number): Ponto {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

function distanciaAoSegmento(p: Ponto, a: Ponto, b: Ponto): number {
  return distancia(p, pontoNoSegmento(a, b, parametroNoSegmento(p, a, b)))
}

/**
 * Pontos em fila ao longo de um traço: o pedaço `i` vai de `vertices[i]` a
 * `vertices[i + 1]`. A Linha é corrente de um pedaço só; a parede com porta,
 * de três.
 */
interface Corrente {
  vertices: readonly Ponto[]
  /** Distância de `vertices[0]` até cada vértice, andando pelos pedaços. */
  acumulado: readonly number[]
}

function correnteDe(vertices: readonly Ponto[]): Corrente {
  const acumulado = [0]
  for (let i = 1; i < vertices.length; i++) acumulado.push(acumulado[i - 1] + distancia(vertices[i - 1], vertices[i]))
  return { vertices, acumulado }
}

/** Todos os vértices no mesmo eixo, a menos de `TOLERANCIA_RETA`. */
function correnteJaReta({ vertices }: Corrente): boolean {
  const eixo = eixoMaisProximo(ultimo(vertices).x - vertices[0].x, ultimo(vertices).y - vertices[0].y)
  const desvios = vertices.map((v) => (eixo === 'h' ? v.y : v.x))
  return Math.max(...desvios) - Math.min(...desvios) <= TOLERANCIA_RETA
}

/** O ponto que fica parado e a distância dele ao longo da corrente. */
interface PontoFixo {
  ponto: Ponto
  s: number
}

/**
 * Endireita a corrente em volta do ponto fixo: o eixo que fica é copiado dele,
 * e cada vértice vai para a mesma distância ao longo da reta — o comprimento de
 * cada pedaço (a porta inclusive) fica como era.
 */
function endireitarCorrente({ vertices, acumulado }: Corrente, fixo: PontoFixo): Ponto[] {
  const dx = ultimo(vertices).x - vertices[0].x
  const dy = ultimo(vertices).y - vertices[0].y
  const eixo = eixoMaisProximo(dx, dy)
  // O sentido fica: quem ia para a esquerda (ou para cima) continua indo.
  const sinal = (eixo === 'h' ? dx : dy) < 0 ? -1 : 1
  return acumulado.map((s) => {
    const passo = (s - fixo.s) * sinal
    return eixo === 'h' ? { x: fixo.ponto.x + passo, y: fixo.ponto.y } : { x: fixo.ponto.x, y: fixo.ponto.y + passo }
  })
}

/** Endireita um segmento em volta de uma das pontas ou do meio. Comprimento zero volta igual. */
export function endireitarSegmento(a: Ponto, b: Ponto, pivo: Pivo): [Ponto, Ponto] {
  const corrente = correnteDe([a, b])
  const comprimento = corrente.acumulado[1]
  const fixo: PontoFixo =
    pivo === 'a' ? { ponto: a, s: 0 } : pivo === 'b' ? { ponto: b, s: comprimento } : { ponto: meio(a, b), s: comprimento / 2 }
  const [novoA, novoB] = endireitarCorrente(corrente, fixo)
  return [novoA, novoB]
}

/**
 * Caminho: o primeiro ponto fica parado e cada trecho endireita a partir do
 * ponto anterior JÁ endireitado, com o comprimento e o sentido dele — uma
 * trilha torta vira um corredor em L.
 */
export function endireitarPolilinha(pontos: readonly Ponto[]): Ponto[] {
  const saida: Ponto[] = []
  pontos.forEach((p, i) => {
    if (i === 0) {
      saida.push({ x: p.x, y: p.y })
      return
    }
    const dx = p.x - pontos[i - 1].x
    const dy = p.y - pontos[i - 1].y
    const passo = Math.hypot(dx, dy)
    const anterior = saida[i - 1]
    saida.push(
      eixoMaisProximo(dx, dy) === 'h'
        ? { x: anterior.x + (dx < 0 ? -passo : passo), y: anterior.y }
        : { x: anterior.x, y: anterior.y + (dy < 0 ? -passo : passo) },
    )
  })
  return saida
}

function caminhoJaReto(pontos: readonly Ponto[]): boolean {
  return pontos.every((p, i) => i === 0 || jaEstaReta(pontos[i - 1], p))
}

// ─────────────────────────────────────────────────────────────
// Parede com porta: a corrente de pedaços colineares
// ─────────────────────────────────────────────────────────────

/** Pedaço de parede na corrente; `invertido` quando a ponta (x2,y2) é a de trás na fila. */
interface PedacoDeParede {
  parede: Wall
  invertido: boolean
}

interface CorrenteDeParedes extends Corrente {
  pedacos: readonly PedacoDeParede[]
}

const inicioDa = (w: Wall): Ponto => ({ x: w.x1, y: w.y1 })
const fimDa = (w: Wall): Ponto => ({ x: w.x2, y: w.y2 })

/**
 * A parede solta que continua a fila depois de `ponta`: encosta uma ponta em
 * `ponta` e a outra fica sobre a reta `deOnde → ponta`, além dela. Fora da reta
 * é canto (vira ponto fixo, não corrente); voltando por cima da fila, também não.
 */
function continuacao(
  deOnde: Ponto,
  ponta: Ponto,
  soltas: readonly Wall[],
  usadas: ReadonlySet<string>,
): { parede: Wall; peloInicio: boolean } | null {
  const ux = ponta.x - deOnde.x
  const uy = ponta.y - deOnde.y
  const tamanho = Math.hypot(ux, uy)
  if (tamanho === 0) return null
  for (const parede of soltas) {
    if (usadas.has(parede.id)) continue
    const peloInicio = distancia(inicioDa(parede), ponta) <= TOLERANCIA_ENCOSTA
    if (!peloInicio && distancia(fimDa(parede), ponta) > TOLERANCIA_ENCOSTA) continue
    const longe = peloInicio ? fimDa(parede) : inicioDa(parede)
    const vx = longe.x - ponta.x
    const vy = longe.y - ponta.y
    if (Math.abs(ux * vy - uy * vx) / tamanho > TOLERANCIA_ENCOSTA) continue
    if (ux * vx + uy * vy <= 0) continue
    return { parede, peloInicio }
  }
  return null
}

/** A corrente inteira da parede: ela mais os pedaços soltos colineares emendados nela, para os dois lados. */
function correnteDaParede(inicial: Wall, soltas: readonly Wall[]): CorrenteDeParedes {
  const vertices: Ponto[] = [inicioDa(inicial), fimDa(inicial)]
  const pedacos: PedacoDeParede[] = [{ parede: inicial, invertido: false }]
  const usadas = new Set([inicial.id])
  let frente = continuacao(vertices[0], ultimo(vertices), soltas, usadas)
  while (frente !== null) {
    usadas.add(frente.parede.id)
    // Na frente da fila, a ponta que encosta é a de trás do pedaço novo.
    pedacos.push({ parede: frente.parede, invertido: !frente.peloInicio })
    vertices.push(frente.peloInicio ? fimDa(frente.parede) : inicioDa(frente.parede))
    frente = continuacao(vertices[0], ultimo(vertices), soltas, usadas)
  }
  let tras = continuacao(ultimo(vertices), vertices[0], soltas, usadas)
  while (tras !== null) {
    usadas.add(tras.parede.id)
    // Atrás da fila, a ponta que encosta é a da frente do pedaço novo.
    pedacos.unshift({ parede: tras.parede, invertido: tras.peloInicio })
    vertices.unshift(tras.peloInicio ? fimDa(tras.parede) : inicioDa(tras.parede))
    tras = continuacao(ultimo(vertices), vertices[0], soltas, usadas)
  }
  return { ...correnteDe(vertices), pedacos }
}

// ─────────────────────────────────────────────────────────────
// Onde o traço encosta nos outros
// ─────────────────────────────────────────────────────────────

/** Parede ou Linha do mapa como a busca de encostos enxerga: as duas pontas e o piso. */
interface Traco {
  chave: string
  a: Ponto
  b: Ponto
  piso: number
}

// Parede e desenho têm listas de id separadas: a chave leva o tipo, para um não se passar pelo outro.
const chaveDaParede = (id: string): string => `parede:${id}`
const chaveDaLinha = (id: string): string => `linha:${id}`

function tracosDo(map: MapData): Traco[] {
  const tracos: Traco[] = map.walls.map((w) => ({ chave: chaveDaParede(w.id), a: inicioDa(w), b: fimDa(w), piso: pisoDe(w) }))
  for (const d of map.drawings) {
    if (d.kind === 'line') tracos.push({ chave: chaveDaLinha(d.id), a: { x: d.x1, y: d.y1 }, b: { x: d.x2, y: d.y2 }, piso: pisoDe(d) })
  }
  return tracos
}

/** O ponto da corrente debaixo de `q`, se `q` encosta nela. */
function pontoSobreACorrente({ vertices, acumulado }: Corrente, q: Ponto): PontoFixo | null {
  for (let i = 0; i + 1 < vertices.length; i++) {
    const t = parametroNoSegmento(q, vertices[i], vertices[i + 1])
    const ponto = pontoNoSegmento(vertices[i], vertices[i + 1], t)
    if (distancia(q, ponto) <= TOLERANCIA_ENCOSTA) return { ponto, s: acumulado[i] + t * (acumulado[i + 1] - acumulado[i]) }
  }
  return null
}

/** O encosto a menos de meio pixel de um vértice vira o próprio vértice: a ponta presa fica exatamente onde estava. */
function noVertice({ vertices, acumulado }: Corrente, fixo: PontoFixo): PontoFixo {
  const i = acumulado.findIndex((s) => Math.abs(s - fixo.s) <= TOLERANCIA_ENCOSTA)
  return i < 0 ? fixo : { ponto: vertices[i], s: acumulado[i] }
}

/** Encostos a menos de meio pixel um do outro, ao longo da corrente, são o mesmo ponto. */
function distintos(fixos: readonly PontoFixo[]): PontoFixo[] {
  const saida: PontoFixo[] = []
  for (const f of [...fixos].sort((p, q) => p.s - q.s)) {
    if (saida.length === 0 || f.s - ultimo(saida).s > TOLERANCIA_ENCOSTA) saida.push(f)
  }
  return saida
}

/**
 * Os pontos fixos da corrente: onde ela encosta numa Parede ou Linha do mesmo
 * piso que não é dela — ponta com ponta, ponta desta no meio da outra (T), ou
 * ponta da outra no meio desta.
 */
function pontosFixos(corrente: Corrente, membros: ReadonlySet<string>, piso: number, tracos: readonly Traco[]): PontoFixo[] {
  const pontas: PontoFixo[] = [
    { ponto: corrente.vertices[0], s: 0 },
    { ponto: ultimo(corrente.vertices), s: ultimo(corrente.acumulado) },
  ]
  const achados: PontoFixo[] = []
  for (const traco of tracos) {
    if (traco.piso !== piso || membros.has(traco.chave)) continue
    for (const ponta of pontas) {
      if (distanciaAoSegmento(ponta.ponto, traco.a, traco.b) <= TOLERANCIA_ENCOSTA) achados.push(ponta)
    }
    for (const q of [traco.a, traco.b]) {
      const sobre = pontoSobreACorrente(corrente, q)
      if (sobre !== null) achados.push(sobre)
    }
  }
  return distintos(achados.map((f) => noVertice(corrente, f)))
}

/** Nenhum encosto: o meio. Um: ele. Dois ou mais: `null` — a corrente está presa. */
function escolherPontoFixo(corrente: Corrente, encostos: readonly PontoFixo[]): PontoFixo | null {
  if (encostos.length > 1) return null
  if (encostos.length === 1) return encostos[0]
  return { ponto: meio(corrente.vertices[0], ultimo(corrente.vertices)), s: ultimo(corrente.acumulado) / 2 }
}

// ─────────────────────────────────────────────────────────────
// No mapa
// ─────────────────────────────────────────────────────────────

/** O que ficou como estava, e por quê. Item reto não entra em conta nenhuma: não havia o que endireitar. */
export interface IgnoradosNoEndireitar {
  /** Presos em dois pontos ou mais: endireitar soltaria uma das emendas. */
  presas: number
  /** Travados: o item, um pedaço da corrente (a porta, na camada Portas) ou a camada. */
  travados: number
  /** Paredes de Sala: a Sala tem o giro dela. */
  sala: number
}

export interface ResultadoDoEndireitar {
  /** O mapa endireitado; o MESMO objeto quando nada mudou, para não entrar no histórico. */
  map: MapData
  /** Quantas entidades mudaram — cada pedaço de uma parede com porta conta. */
  alterados: number
  ignorados: IgnoradosNoEndireitar
}

/** O que o endireitar de uma seleção vai juntando enquanto anda por ela. */
interface Andamento {
  map: MapData
  ignorados: IgnoradosNoEndireitar
  paredes: Map<string, Wall>
  desenhos: Map<string, Drawing>
  /** Paredes já tratadas numa corrente: selecionar os 3 pedaços da porta endireita uma vez só. */
  vistas: Set<string>
  /** Montados só quando algum traço torto precisa procurar encostos. */
  tracos: Traco[] | null
}

function tracosDe(andamento: Andamento): Traco[] {
  andamento.tracos ??= tracosDo(andamento.map)
  return andamento.tracos
}

function paredesSoltasDoPiso(map: MapData, piso: number): Wall[] {
  return map.walls.filter((w) => w.regionId === undefined && pisoDe(w) === piso)
}

/** A corrente da parede solta, ou `null` quando ela não existe ou é de Sala. */
function correnteDaParedeSolta(map: MapData, id: string): CorrenteDeParedes | null {
  const parede = map.walls.find((w) => w.id === id)
  if (parede === undefined || parede.regionId !== undefined) return null
  return correnteDaParede(parede, paredesSoltasDoPiso(map, pisoDe(parede)))
}

function endireitarParede(andamento: Andamento, id: string): void {
  const { map, ignorados, vistas } = andamento
  if (vistas.has(id)) return
  const selecionada = map.walls.find((w) => w.id === id)
  if (selecionada === undefined) return
  vistas.add(id)
  if (selecionada.regionId !== undefined) {
    ignorados.sala += 1
    return
  }
  const piso = pisoDe(selecionada)
  const corrente = correnteDaParede(selecionada, paredesSoltasDoPiso(map, piso))
  for (const { parede } of corrente.pedacos) vistas.add(parede.id)
  if (correnteJaReta(corrente)) return
  if (corrente.pedacos.some(({ parede }) => !canInteractInLayer(parede, wallLayer(parede), map.lockedLayers))) {
    ignorados.travados += 1
    return
  }
  const membros = new Set(corrente.pedacos.map(({ parede }) => chaveDaParede(parede.id)))
  const fixo = escolherPontoFixo(corrente, pontosFixos(corrente, membros, piso, tracosDe(andamento)))
  if (fixo === null) {
    ignorados.presas += 1
    return
  }
  const novos = endireitarCorrente(corrente, fixo)
  corrente.pedacos.forEach(({ parede, invertido }, i) => {
    const de = invertido ? novos[i + 1] : novos[i]
    const ate = invertido ? novos[i] : novos[i + 1]
    if (de.x === parede.x1 && de.y === parede.y1 && ate.x === parede.x2 && ate.y === parede.y2) return
    andamento.paredes.set(parede.id, { ...parede, x1: de.x, y1: de.y, x2: ate.x, y2: ate.y })
  })
}

function endireitarDesenho(andamento: Andamento, id: string): void {
  const { map, ignorados } = andamento
  const desenho = map.drawings.find((d) => d.id === id)
  if (desenho === undefined) return
  // Desenho não tem `locked` no schema: a única trava que vale para ele é a da camada.
  const travado = isLayerLocked(map.lockedLayers, drawingLayer(desenho))
  if (desenho.kind === 'line') {
    const corrente = correnteDe([{ x: desenho.x1, y: desenho.y1 }, { x: desenho.x2, y: desenho.y2 }])
    if (correnteJaReta(corrente)) return
    if (travado) {
      ignorados.travados += 1
      return
    }
    const fixo = escolherPontoFixo(corrente, pontosFixos(corrente, new Set([chaveDaLinha(id)]), pisoDe(desenho), tracosDe(andamento)))
    if (fixo === null) {
      ignorados.presas += 1
      return
    }
    const [a, b] = endireitarCorrente(corrente, fixo)
    andamento.desenhos.set(id, { ...desenho, x1: a.x, y1: a.y, x2: b.x, y2: b.y })
    return
  }
  if (desenho.kind !== 'path' || caminhoJaReto(desenho.points)) return
  if (travado) {
    ignorados.travados += 1
    return
  }
  andamento.desenhos.set(id, { ...desenho, points: endireitarPolilinha(desenho.points) })
}

/**
 * Endireita o que está selecionado. Nada mudou (tudo reto, nada aceito, tudo
 * preso ou travado): devolve o MESMO `map`, que é como a store sabe que não
 * deve empurrar um passo vazio de desfazer.
 */
export function endireitarNoMapa(map: MapData, selection: SelectionSet): ResultadoDoEndireitar {
  const andamento: Andamento = {
    map,
    ignorados: { presas: 0, travados: 0, sala: 0 },
    paredes: new Map(),
    desenhos: new Map(),
    vistas: new Set(),
    tracos: null,
  }
  for (const item of selection) {
    if (item.kind === 'wall') endireitarParede(andamento, item.id)
    else if (item.kind === 'drawing') endireitarDesenho(andamento, item.id)
  }
  const { paredes, desenhos, ignorados } = andamento
  const alterados = paredes.size + desenhos.size
  if (alterados === 0) return { map, alterados, ignorados }
  return {
    map: {
      ...map,
      walls: paredes.size === 0 ? map.walls : map.walls.map((w) => paredes.get(w.id) ?? w),
      drawings: desenhos.size === 0 ? map.drawings : map.drawings.map((d) => desenhos.get(d.id) ?? d),
    },
    alterados,
    ignorados,
  }
}

/** O item é de tipo aceito e está torto — travado ou preso também, que é assunto do aviso. */
function itemTorto(map: MapData, item: SelectionItem): boolean {
  if (item.kind === 'wall') {
    const corrente = correnteDaParedeSolta(map, item.id)
    return corrente !== null && !correnteJaReta(corrente)
  }
  if (item.kind !== 'drawing') return false
  const desenho = map.drawings.find((d) => d.id === item.id)
  if (desenho === undefined) return false
  if (desenho.kind === 'line') return !jaEstaReta({ x: desenho.x1, y: desenho.y1 }, { x: desenho.x2, y: desenho.y2 })
  if (desenho.kind === 'path') return !caminhoJaReto(desenho.points)
  return false
}

/**
 * O Alt (e o botão "Endireitar") age ou fica mudo: age quando a seleção tem ao
 * menos um item torto de tipo aceito — preso ou travado inclusive, para o
 * mestre ouvir no aviso por que ele ficou. Seleção vazia, só itens retos ou só
 * paredes de Sala: mudo. Mesma resposta de "o `endireitarNoMapa` mudaria ou
 * avisaria algo", sem procurar encostos — barato para chamar a cada tecla.
 */
export function haAlgoParaEndireitar(map: MapData, selection: SelectionSet): boolean {
  return selection.some((item) => itemTorto(map, item))
}
