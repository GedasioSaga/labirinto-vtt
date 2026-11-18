/**
 * ABISMO POR PINCEL (pedido de 17/11/2026: "o abismo gostaria que desse para
 * colocar por pincel", com ilha no meio). O mestre pinta o buraco quadrado por
 * quadrado, como a Área alta do barranco (`lib/barranco.ts`): o pincel cava, a
 * borracha (Alt) tapa, e tapar no meio deixa chão de pé dentro do buraco, uma
 * ILHA. A beira sai arredondada, pelos meios das arestas (`beiraSuaveDoLaco`).
 *
 * O que fica no mapa são os quadrados (`MapData.abismoPintado`). Cada buraco
 * (quadrados vizinhos pelo lado) vira um `Abismo` de verdade para o resto do
 * app (`bocasDoAbismoPintado`): a boca é a beira de fora e as ilhas são as
 * beiras de dentro (`Abismo.ilhas`). Quem desenha, quem segura o andar, a luz
 * do fundo e o recorte do jogador leem a lista junta (`abismosDoMapa`): os
 * contornados à mão (`MapData.abismos`) e os pintados.
 *
 * O brilho é do buraco inteiro: o traço dá o brilho do painel a todo buraco em
 * que cava (um toque dentro de um buraco pintado troca o brilho dele).
 *
 * Mora na camada Terreno, como o abismo contornado. Campo novo e opcional: o
 * mapa de antes abre e salva igual, e o app antigo ignora os quadrados.
 *
 * PARA NA PAREDE (pedido de 17/11/2026, `lib/abismoNaParede.ts`): o pincel
 * não cava nem tapa através de parede, o traço fica do lado em que começou, e
 * o buraco que encosta numa parede chega até ela, com a beira reta e rente (o
 * quadrado do outro lado entra só na conta, para a beira passar da parede, e o
 * corte pela parede tira o que passou). Dois quadrados com uma parede entre eles
 * são dois buracos, um de cada lado.
 *
 * Tudo aqui é puro: sem Pixi nem store.
 */
import type { Abismo, AbismoPintado, BrilhoDoAbismo, MapData, QuadradoDoAbismo, RegionPoint, Wall } from '../types/map'
import { BRILHOS_DO_ABISMO, areaDoContorno, contornoSimplificado, pontoNoContorno } from './abismo'
import {
  algumPontoDentro,
  assinaturaDasParedes,
  contornadosRentesAParede,
  paredeNoCaminho,
  paredesNosQuadrados,
  pedacosDaBoca,
  type ParedesNosQuadrados,
  type Quadrado,
} from './abismoNaParede'
import { beiraSuaveDoLaco, lacosDosQuadrados, type ArestaDeQuadrado } from './barranco'
import { pisoDe } from './pisos'

// Os tipos moram em `types/map.ts`, com o resto do mapa; quem já os importava daqui continua valendo.
export type { AbismoPintado, QuadradoDoAbismo }

/** Teto da leitura do arquivo: quadrados cavados por mapa. */
export const TETO_DE_QUADRADOS_DO_ABISMO = 40000
/** O id dos abismos que saem dos quadrados (o contornado à mão tem um UUID). */
const PREFIXO_DO_PINTADO = 'pintado:'
/** A tolerância da beira enxuta, em quadrados: tira os pontos da reta e deixa a curva da quina. */
const TOLERANCIA_EM_QUADRADOS = 0.015

/** O id é de um abismo pintado (e não de um contornado à mão)? */
export function ehAbismoPintado(id: string): boolean {
  return id.startsWith(PREFIXO_DO_PINTADO)
}

function chave(x: number, y: number, piso: number): string {
  return `${x},${y},${piso}`
}

// ─────────────────────────────────────────────────────────────
// O campo do mapa e a leitura do arquivo
// ─────────────────────────────────────────────────────────────

/** Um abismo pintado vazio, com o quadrado na grade de agora do mapa. */
export function abismoPintadoVazio(map: Pick<MapData, 'grid' | 'gridOffset'>): AbismoPintado {
  return { quadrado: map.grid > 0 ? map.grid : 64, origem: map.gridOffset ?? { x: 0, y: 0 }, quadrados: [] }
}

/** O abismo pintado do mapa, ou um vazio na grade dele para começar a pintar. */
export function abismoPintadoOuVazio(map: Pick<MapData, 'grid' | 'gridOffset' | 'abismoPintado'>): AbismoPintado {
  return map.abismoPintado ?? abismoPintadoVazio(map)
}

/** O mapa com este abismo pintado. Sem quadrado nenhum, tira o campo (o mapa volta a salvar como antes). */
export function comAbismoPintado(map: MapData, pintado: AbismoPintado): MapData {
  if (pintado.quadrados.length > 0) return { ...map, abismoPintado: pintado }
  if (map.abismoPintado === undefined) return map
  const { abismoPintado: _fora, ...resto } = map
  return resto
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function numeroFinito(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor)
}

/**
 * O abismo pintado do arquivo, lido com cuidado: o quadrado sem x e y inteiros
 * sai, o repetido fica uma vez, o brilho desconhecido vira "sem brilho" e o
 * piso só entra inteiro e diferente de 0. `undefined` sem medida válida ou sem
 * nenhum quadrado bom (o campo nem entra no mapa).
 */
export function lerAbismoPintado(valor: unknown): AbismoPintado | undefined {
  if (!ehObjeto(valor) || !numeroFinito(valor.quadrado) || valor.quadrado <= 0 || !Array.isArray(valor.quadrados)) return undefined
  const origem = ehObjeto(valor.origem) && numeroFinito(valor.origem.x) && numeroFinito(valor.origem.y) ? { x: valor.origem.x, y: valor.origem.y } : { x: 0, y: 0 }
  const vistos = new Set<string>()
  const quadrados: QuadradoDoAbismo[] = []
  for (const item of valor.quadrados) {
    if (quadrados.length >= TETO_DE_QUADRADOS_DO_ABISMO) break
    if (!ehObjeto(item) || !numeroFinito(item.x) || !numeroFinito(item.y) || !Number.isInteger(item.x) || !Number.isInteger(item.y)) continue
    const piso = numeroFinito(item.piso) && Number.isInteger(item.piso) ? item.piso : 0
    const k = chave(item.x, item.y, piso)
    if (vistos.has(k)) continue
    vistos.add(k)
    const brilho = BRILHOS_DO_ABISMO.find((b) => b === item.brilho)
    quadrados.push({ x: item.x, y: item.y, ...(brilho !== undefined ? { brilho } : {}), ...(piso !== 0 ? { piso } : {}) })
  }
  return quadrados.length === 0 ? undefined : { quadrado: valor.quadrado, origem, quadrados }
}

// ─────────────────────────────────────────────────────────────
// O pincel (funções puras: o abismo de antes não muda)
// ─────────────────────────────────────────────────────────────

const LADOS: readonly (readonly [number, number])[] = [[-1, 0], [1, 0], [0, -1], [0, 1]]

/** O quadrado do ponto (px de mundo) está cavado neste piso? */
export function cavadoNoPonto(pintado: AbismoPintado | undefined, p: RegionPoint, piso: number): boolean {
  if (pintado === undefined || pintado.quadrado <= 0) return false
  const x = Math.floor((p.x - pintado.origem.x) / pintado.quadrado)
  const y = Math.floor((p.y - pintado.origem.y) / pintado.quadrado)
  return pintado.quadrados.some((c) => c.x === x && c.y === y && pisoDe(c) === piso)
}

/**
 * Os quadrados debaixo do traço, sem repetir: o do ponteiro e os que têm o
 * meio dentro do raio, fora os que uma parede esconde do centro do carimbo.
 */
function quadradosDoTraco(
  pintado: AbismoPintado,
  centros: readonly RegionPoint[],
  raio: number,
  piso: number,
  paredes: ParedesNosQuadrados | null,
): Map<string, Quadrado> {
  const q = pintado.quadrado
  const { origem } = pintado
  const tocados = new Map<string, Quadrado>()
  for (const centro of centros) {
    // O quadrado debaixo do ponteiro entra sempre: o toque do pincel Fino num canto da grade
    // fica a mais de um raio de todos os meios e não cavaria (nem taparia) nada.
    const debaixo = { x: Math.floor((centro.x - origem.x) / q), y: Math.floor((centro.y - origem.y) / q) }
    const doCarimbo: Quadrado[] = [debaixo]
    const x0 = Math.floor((centro.x - raio - origem.x) / q)
    const x1 = Math.floor((centro.x + raio - origem.x) / q)
    const y0 = Math.floor((centro.y - raio - origem.y) / q)
    const y1 = Math.floor((centro.y + raio - origem.y) / q)
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        if ((x !== debaixo.x || y !== debaixo.y) && Math.hypot(origem.x + (x + 0.5) * q - centro.x, origem.y + (y + 0.5) * q - centro.y) <= raio) doCarimbo.push({ x, y })
      }
    }
    // A parede faz sombra: o carimbo não alcança o meio de quadrado do outro lado dela.
    const trechos = paredes === null ? [] : paredes.perto(doCarimbo)
    for (const c of doCarimbo) {
      if (trechos.length > 0 && paredeNoCaminho(centro, { x: origem.x + (c.x + 0.5) * q, y: origem.y + (c.y + 0.5) * q }, trechos)) continue
      tocados.set(chave(c.x, c.y, piso), c)
    }
  }
  return tocados
}

/**
 * Um trecho do traço do pincel: cada centro de `centros` (px de mundo) cava o
 * quadrado em que cai e os que têm o meio dentro do raio, ou os tapa com `tapar`. Cavar dá o
 * `brilho` (`null` = nenhum) aos quadrados novos E a todo buraco em que o
 * traço encosta, para o buraco ter um brilho só. Tapar não mexe em brilho.
 * Com `walls`, o carimbo não alcança quadrado do outro lado de uma parede (o
 * caminho reto do centro ao meio do quadrado bate nela), e o brilho não se
 * espalha para o buraco do outro lado.
 * Devolve o MESMO abismo quando nada mudou.
 */
export function pincelarAbismo(
  pintado: AbismoPintado,
  centros: readonly RegionPoint[],
  raioEmQuadrados: number,
  tapar: boolean,
  brilho: BrilhoDoAbismo | null,
  piso: number,
  walls?: readonly Wall[],
): AbismoPintado {
  const q = pintado.quadrado
  if (q <= 0 || centros.length === 0) return pintado
  const paredes = paredesNosQuadrados(walls, piso, q, pintado.origem)
  const tocados = quadradosDoTraco(pintado, centros, raioEmQuadrados * q, piso, paredes)
  if (tocados.size === 0) return pintado
  if (tapar) {
    const ficam = pintado.quadrados.filter((c) => !tocados.has(chave(c.x, c.y, pisoDe(c))))
    return ficam.length === pintado.quadrados.length ? pintado : { ...pintado, quadrados: ficam }
  }
  const doPiso = new Map<string, QuadradoDoAbismo>()
  for (const c of pintado.quadrados) if (pisoDe(c) === piso) doPiso.set(chave(c.x, c.y, piso), c)
  const novo = (x: number, y: number): QuadradoDoAbismo => ({ x, y, ...(brilho !== null ? { brilho } : {}), ...(piso !== 0 ? { piso } : {}) })
  const trocados = new Map<string, QuadradoDoAbismo>()
  const fila: QuadradoDoAbismo[] = []
  for (const [k, { x, y }] of tocados) {
    const antes = doPiso.get(k)
    if (antes !== undefined && (antes.brilho ?? null) === brilho) continue
    const depois = novo(x, y)
    trocados.set(k, depois)
    fila.push(depois)
  }
  if (trocados.size === 0) return pintado
  // O brilho se espalha pelo buraco: os vizinhos pelo lado com outro brilho trocam também (não através de parede).
  for (let i = 0; i < fila.length; i += 1) {
    for (const [dx, dy] of LADOS) {
      const k = chave(fila[i].x + dx, fila[i].y + dy, piso)
      const vizinho = doPiso.get(k)
      if (vizinho === undefined || trocados.has(k) || (vizinho.brilho ?? null) === brilho) continue
      if (paredes !== null && paredes.separa(fila[i], vizinho)) continue
      const depois = novo(vizinho.x, vizinho.y)
      trocados.set(k, depois)
      fila.push(depois)
    }
  }
  const quadrados: QuadradoDoAbismo[] = []
  for (const c of pintado.quadrados) if (!trocados.has(chave(c.x, c.y, pisoDe(c))) || pisoDe(c) !== piso) quadrados.push(c)
  for (const c of trocados.values()) quadrados.push(c)
  return { ...pintado, quadrados }
}

/** Tira todos os quadrados cavados de um piso (o botão "Apagar o abismo pintado"). O MESMO abismo sem nenhum lá. */
export function semAbismoPintadoNoPiso(pintado: AbismoPintado, piso: number): AbismoPintado {
  const ficam = pintado.quadrados.filter((c) => pisoDe(c) !== piso)
  return ficam.length === pintado.quadrados.length ? pintado : { ...pintado, quadrados: ficam }
}

// ─────────────────────────────────────────────────────────────
// Dos quadrados aos abismos
// ─────────────────────────────────────────────────────────────

/** A área com sinal de um laço de arestas (em quadrados): negativa na beira de fora, positiva na de dentro (a ilha). */
function areaDoLaco(laco: readonly ArestaDeQuadrado[]): number {
  let soma = 0
  for (const e of laco) soma += e.a[0] * e.b[1] - e.b[0] * e.a[1]
  return soma / 2
}

/** O quadrado cavado de que a aresta é beira (o buraco fica à direita de quem anda por ela). */
function quadradoDaAresta(e: ArestaDeQuadrado): { x: number; y: number } {
  const dx = e.b[0] - e.a[0]
  const dy = e.b[1] - e.a[1]
  return { x: Math.floor((e.a[0] + e.b[0]) / 2 + dy / 2), y: Math.floor((e.a[1] + e.b[1]) / 2 - dx / 2) }
}

/** O número do buraco de cada quadrado do piso: os vizinhos pelo lado ganham o mesmo (com uma parede entre eles, não). */
function buracosDoPiso(doPiso: ReadonlyMap<string, QuadradoDoAbismo>, piso: number, paredes: ParedesNosQuadrados | null): Map<string, number> {
  const buraco = new Map<string, number>()
  let proximo = 0
  for (const [k, inicio] of doPiso) {
    if (buraco.has(k)) continue
    buraco.set(k, proximo)
    const fila = [inicio]
    for (let i = 0; i < fila.length; i += 1) {
      for (const [dx, dy] of LADOS) {
        const vizinha = chave(fila[i].x + dx, fila[i].y + dy, piso)
        const c = doPiso.get(vizinha)
        if (c !== undefined && !buraco.has(vizinha) && (paredes === null || !paredes.separa(fila[i], c))) {
          buraco.set(vizinha, proximo)
          fila.push(c)
        }
      }
    }
    proximo += 1
  }
  return buraco
}

const SEM_BOCAS: Abismo[] = []
const bocasPorPintado = new WeakMap<AbismoPintado, { assinatura: string; bocas: Abismo[] }>()

/** Um abismo de um buraco pintado: o id e o brilho vêm do quadrado do canto de cima e à esquerda. */
function bocaDoBuraco(id: string, pontos: RegionPoint[], ilhas: readonly RegionPoint[][], canto: QuadradoDoAbismo, piso: number): Abismo {
  return {
    id,
    pontos,
    ...(ilhas.length > 0 ? { ilhas: [...ilhas] } : {}),
    ...(canto.brilho !== undefined ? { brilho: canto.brilho } : {}),
    ...(piso !== 0 ? { piso } : {}),
  }
}

/** O meio de algum destes quadrados está dentro do contorno? (a caixa filtra antes da conta cara) */
function temMeioDentro(pontos: readonly RegionPoint[], quadrados: readonly Quadrado[], meio: (c: Quadrado) => RegionPoint): boolean {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pontos) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return quadrados.some((c) => {
    const m = meio(c)
    return m.x >= minX && m.x <= maxX && m.y >= minY && m.y <= maxY && pontoNoContorno(pontos, m)
  })
}

/**
 * O buraco pintado que encosta em parede, rente a ela. Os quadrados vizinhos
 * do outro lado da parede entram SÓ na conta da beira (a beira arredondada
 * passa da parede), e o corte pela parede (`pedacosDaBoca`) tira o que passou:
 * a beira do lado da parede sai reta, sem chão entre o buraco e a parede, e a
 * quina da sala fica em canto vivo. Ficam os pedaços com o meio de um quadrado
 * cavado; o maior leva o id do buraco, os outros ganham `~1`, `~2`.
 * Se a parede não chega a dividir (a ponta solta), o quadrado de fora não pode
 * virar buraco: a conta refaz só com os cavados, ainda cortada pela parede.
 */
function bocasRentesAParede(
  membros: readonly QuadradoDoAbismo[],
  pintado: AbismoPintado,
  piso: number,
  paredes: ParedesNosQuadrados,
  canto: QuadradoDoAbismo,
  contorno: (laco: readonly ArestaDeQuadrado[]) => RegionPoint[],
): Abismo[] {
  const q = pintado.quadrado
  const { origem } = pintado
  const meio = (c: Quadrado): RegionPoint => ({ x: origem.x + (c.x + 0.5) * q, y: origem.y + (c.y + 0.5) * q })
  const k = (x: number, y: number): string => `${x},${y}`
  const sao = new Set(membros.map((c) => k(c.x, c.y)))
  const doOutroLado = new Map<string, Quadrado>()
  for (const c of membros) {
    for (const [dx, dy] of LADOS) {
      const vizinho = { x: c.x + dx, y: c.y + dy }
      const kv = k(vizinho.x, vizinho.y)
      if (!sao.has(kv) && !doOutroLado.has(kv) && paredes.separa(c, vizinho)) doOutroLado.set(kv, vizinho)
    }
  }
  const fora = [...doOutroLado.values()]
  const trechos = paredes.perto([...membros, ...fora])
  const cortar = (comOsDeFora: boolean): { ficam: { pontos: RegionPoint[]; buracos: RegionPoint[][] }[]; ilhas: RegionPoint[][] } | null => {
    const todos = comOsDeFora ? [...membros, ...fora] : membros
    let boca: RegionPoint[] | null = null
    const ilhas: RegionPoint[][] = []
    for (const laco of lacosDosQuadrados(todos, (x, y) => sao.has(k(x, y)) || (comOsDeFora && doOutroLado.has(k(x, y))))) {
      const pontos = contorno(laco)
      if (pontos.length < 3) continue
      if (areaDoLaco(laco) < 0 && boca === null) boca = pontos
      else ilhas.push(pontos)
    }
    if (boca === null) return null
    const pedacos = pedacosDaBoca(boca, trechos) ?? [{ pontos: boca, buracos: [], area: areaDoContorno(boca) }]
    return { ficam: pedacos.filter((p) => temMeioDentro(p.pontos, membros, meio)), ilhas }
  }
  let corte = cortar(fora.length > 0)
  if (corte !== null && fora.length > 0 && corte.ficam.some((p) => temMeioDentro(p.pontos, fora, meio))) corte = cortar(false)
  if (corte === null) return []
  const { ficam, ilhas } = corte
  const id = `${PREFIXO_DO_PINTADO}${piso}:${canto.x},${canto.y}`
  return ficam.map((p, i) => bocaDoBuraco(i === 0 ? id : `${id}~${i}`, p.pontos, [...ilhas.filter((ilha) => algumPontoDentro(ilha, p.pontos)), ...p.buracos], canto, piso))
}

function mesmosPontos(a: readonly RegionPoint[], b: readonly RegionPoint[]): boolean {
  return a.length === b.length && a.every((p, i) => p.x === b[i].x && p.y === b[i].y)
}

/** As duas listas desenham os mesmos buracos (a parede mudou longe deles): a de antes vale, e o cache de quem a usa também. */
function mesmasBocas(a: readonly Abismo[], b: readonly Abismo[]): boolean {
  return (
    a.length === b.length &&
    a.every((x, i) => {
      const y = b[i]
      const ilhasX = x.ilhas ?? []
      const ilhasY = y.ilhas ?? []
      return x.id === y.id && x.brilho === y.brilho && x.piso === y.piso && mesmosPontos(x.pontos, y.pontos) && ilhasX.length === ilhasY.length && ilhasX.every((ilha, j) => mesmosPontos(ilha, ilhasY[j]))
    })
  )
}

/**
 * Os abismos que os quadrados cavados formam, de todos os pisos: um por buraco
 * (quadrados vizinhos pelo lado), com a boca arredondada e as ilhas de dentro.
 * O id é `pintado:<piso>:<x>,<y>` do quadrado mais de cima e à esquerda do
 * buraco. Com `walls`, o buraco que encosta em parede chega até ela, rente
 * (`bocasRentesAParede`); o que não encosta sai igual a antes.
 * Guardado pela referência e pela forma das paredes: o mesmo abismo pintado
 * com as mesmas paredes devolve o MESMO array (abrir uma porta não refaz nada).
 */
export function bocasDoAbismoPintado(pintado: AbismoPintado | undefined, walls?: readonly Wall[]): Abismo[] {
  if (pintado === undefined || pintado.quadrados.length === 0 || pintado.quadrado <= 0) return SEM_BOCAS
  const assinatura = assinaturaDasParedes(walls)
  const guardadas = bocasPorPintado.get(pintado)
  if (guardadas !== undefined && guardadas.assinatura === assinatura) return guardadas.bocas
  const q = pintado.quadrado
  const tolerancia = TOLERANCIA_EM_QUADRADOS * q
  const contorno = (laco: readonly ArestaDeQuadrado[]): RegionPoint[] =>
    contornoSimplificado(beiraSuaveDoLaco(laco, q, pintado.origem).map((p) => ({ x: p[0], y: p[1] })), tolerancia)
  const pisos = [...new Set(pintado.quadrados.map((c) => pisoDe(c)))].sort((a, b) => a - b)
  const bocas: Abismo[] = []
  for (const piso of pisos) {
    const doPiso = new Map<string, QuadradoDoAbismo>()
    for (const c of pintado.quadrados) if (pisoDe(c) === piso) doPiso.set(chave(c.x, c.y, piso), c)
    const paredes = paredesNosQuadrados(walls, piso, q, pintado.origem)
    const buraco = buracosDoPiso(doPiso, piso, paredes)
    // O quadrado mais de cima e à esquerda de cada buraco dá o id e o brilho dele.
    const primeiro = new Map<number, QuadradoDoAbismo>()
    const membros = new Map<number, QuadradoDoAbismo[]>()
    for (const [k, c] of doPiso) {
      const n = buraco.get(k)
      if (n === undefined) continue
      const atual = primeiro.get(n)
      if (atual === undefined || c.y < atual.y || (c.y === atual.y && c.x < atual.x)) primeiro.set(n, c)
      const lista = membros.get(n)
      if (lista === undefined) membros.set(n, [c])
      else lista.push(c)
    }
    // Os buracos com parede perto saem pela conta rente; os outros, pela de sempre.
    const rentes = new Set<number>()
    if (paredes !== null) for (const [n, lista] of membros) if (paredes.perto(lista).length > 0) rentes.add(n)
    const deFora = new Map<number, RegionPoint[]>()
    const ilhas = new Map<number, RegionPoint[][]>()
    // A conta de sempre só com os buracos longe de parede (eles nunca encostam num buraco rente: entre os dois haveria parede).
    const longe = rentes.size === 0 ? [...doPiso.values()] : [...doPiso.values()].filter((c) => !rentes.has(buraco.get(chave(c.x, c.y, piso)) ?? -1))
    const ehLonge = (x: number, y: number): boolean => {
      const n = buraco.get(chave(x, y, piso))
      return n !== undefined && !rentes.has(n)
    }
    for (const laco of lacosDosQuadrados(longe, ehLonge)) {
      const dono = quadradoDaAresta(laco[0])
      const n = buraco.get(chave(dono.x, dono.y, piso))
      if (n === undefined) continue
      const pontos = contorno(laco)
      if (pontos.length < 3) continue
      if (areaDoLaco(laco) < 0 && !deFora.has(n)) deFora.set(n, pontos)
      else ilhas.set(n, [...(ilhas.get(n) ?? []), pontos])
    }
    for (const [n, pontos] of deFora) {
      const canto = primeiro.get(n)
      if (canto !== undefined) bocas.push(bocaDoBuraco(`${PREFIXO_DO_PINTADO}${piso}:${canto.x},${canto.y}`, pontos, ilhas.get(n) ?? [], canto, piso))
    }
    if (paredes === null) continue
    for (const n of rentes) {
      const canto = primeiro.get(n)
      const lista = membros.get(n)
      if (canto !== undefined && lista !== undefined) bocas.push(...bocasRentesAParede(lista, pintado, piso, paredes, canto, contorno))
    }
  }
  const final = guardadas !== undefined && mesmasBocas(guardadas.bocas, bocas) ? guardadas.bocas : bocas
  bocasPorPintado.set(pintado, { assinatura, bocas: final })
  return final
}

const juntos = new WeakMap<readonly Abismo[], { abismos: readonly Abismo[] | undefined; todos: readonly Abismo[] }>()

/**
 * Todos os abismos do mapa, JÁ RENTES À PAREDE (`lib/abismoNaParede.ts`): os
 * contornados à mão (`map.abismos`) e, depois deles, os pintados
 * (`bocasDoAbismoPintado`). É a fonte única de quem desenha, segura o andar
 * (ficha e NPC), acende a luz do fundo e faz o recorte do jogador: o corte pela
 * parede acontece aqui, uma vez. Sem quadrado cavado e sem parede dentro de
 * nenhum buraco é a PRÓPRIA lista do mapa (ou `undefined`); as mesmas entradas
 * devolvem o MESMO array (as paredes de andar e a luz guardam cache pela
 * referência da lista).
 */
export function abismosDoMapa(map: Pick<MapData, 'abismos' | 'abismoPintado' | 'walls'>): readonly Abismo[] | undefined {
  const contornados = contornadosRentesAParede(map.abismos, map.walls)
  const bocas = bocasDoAbismoPintado(map.abismoPintado, map.walls)
  if (bocas.length === 0) return contornados
  const guardado = juntos.get(bocas)
  if (guardado !== undefined && guardado.abismos === contornados) return guardado.todos
  const todos = contornados === undefined ? bocas : [...contornados, ...bocas]
  juntos.set(bocas, { abismos: contornados, todos })
  return todos
}
