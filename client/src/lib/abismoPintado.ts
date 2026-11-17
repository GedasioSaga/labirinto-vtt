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
 * Tudo aqui é puro: sem Pixi nem store.
 */
import type { Abismo, BrilhoDoAbismo, MapData, NoPiso, RegionPoint } from '../types/map'
import { BRILHOS_DO_ABISMO, contornoSimplificado } from './abismo'
import { beiraSuaveDoLaco, lacosDosQuadrados, type ArestaDeQuadrado } from './barranco'
import { pisoDe } from './pisos'

/** Um quadrado cavado. `brilho`: o do buraco dele (ausente = sem brilho). `piso` (`NoPiso`): ausente = térreo. */
export interface QuadradoDoAbismo extends NoPiso {
  x: number
  y: number
  brilho?: BrilhoDoAbismo
}

/** O abismo pintado do mapa (`MapData.abismoPintado`). */
export interface AbismoPintado {
  /** Lado do quadrado, em px de mundo (a grade de quando o primeiro traço nasceu). */
  quadrado: number
  /** Onde fica o canto do quadrado (0, 0), em px de mundo. */
  origem: RegionPoint
  quadrados: QuadradoDoAbismo[]
}

// Declarado aqui até entrar em `types/map.ts`.
declare module '../types/map' {
  interface MapData {
    /**
     * ABISMO POR PINCEL (`lib/abismoPintado.ts`): os quadrados cavados.
     * `undefined` === nenhum: o mapa de antes abre igual, e o último quadrado
     * tapado tira o campo. NUNCA sai no recorte do jogador: ele recebe os
     * buracos já prontos em `abismos` (`abismosParaJogador`).
     */
    abismoPintado?: AbismoPintado
  }
}

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
 * Um trecho do traço do pincel: cada centro de `centros` (px de mundo) cava o
 * quadrado em que cai e os que têm o meio dentro do raio, ou os tapa com `tapar`. Cavar dá o
 * `brilho` (`null` = nenhum) aos quadrados novos E a todo buraco em que o
 * traço encosta, para o buraco ter um brilho só. Tapar não mexe em brilho.
 * Devolve o MESMO abismo quando nada mudou.
 */
export function pincelarAbismo(
  pintado: AbismoPintado,
  centros: readonly RegionPoint[],
  raioEmQuadrados: number,
  tapar: boolean,
  brilho: BrilhoDoAbismo | null,
  piso: number,
): AbismoPintado {
  const q = pintado.quadrado
  if (q <= 0 || centros.length === 0) return pintado
  const raio = raioEmQuadrados * q
  // Os quadrados debaixo do traço, sem repetir.
  const tocados = new Map<string, { x: number; y: number }>()
  for (const centro of centros) {
    // O quadrado debaixo do ponteiro entra sempre: o toque do pincel Fino num canto da grade
    // fica a mais de um raio de todos os meios e não cavaria (nem taparia) nada.
    const cx = Math.floor((centro.x - pintado.origem.x) / q)
    const cy = Math.floor((centro.y - pintado.origem.y) / q)
    tocados.set(chave(cx, cy, piso), { x: cx, y: cy })
    const x0 = Math.floor((centro.x - raio - pintado.origem.x) / q)
    const x1 = Math.floor((centro.x + raio - pintado.origem.x) / q)
    const y0 = Math.floor((centro.y - raio - pintado.origem.y) / q)
    const y1 = Math.floor((centro.y + raio - pintado.origem.y) / q)
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        if (Math.hypot(pintado.origem.x + (x + 0.5) * q - centro.x, pintado.origem.y + (y + 0.5) * q - centro.y) > raio) continue
        tocados.set(chave(x, y, piso), { x, y })
      }
    }
  }
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
  // O brilho se espalha pelo buraco: os vizinhos pelo lado com outro brilho trocam também.
  for (let i = 0; i < fila.length; i += 1) {
    for (const [dx, dy] of LADOS) {
      const k = chave(fila[i].x + dx, fila[i].y + dy, piso)
      const vizinho = doPiso.get(k)
      if (vizinho === undefined || trocados.has(k) || (vizinho.brilho ?? null) === brilho) continue
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

/** O número do buraco de cada quadrado do piso: os vizinhos pelo lado ganham o mesmo. */
function buracosDoPiso(doPiso: ReadonlyMap<string, QuadradoDoAbismo>, piso: number): Map<string, number> {
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
        if (c !== undefined && !buraco.has(vizinha)) {
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
const bocasPorPintado = new WeakMap<AbismoPintado, Abismo[]>()

/**
 * Os abismos que os quadrados cavados formam, de todos os pisos: um por buraco
 * (quadrados vizinhos pelo lado), com a boca arredondada e as ilhas de dentro.
 * O id é `pintado:<piso>:<x>,<y>` do quadrado mais de cima e à esquerda do
 * buraco. Guardado pela referência: o mesmo abismo pintado devolve o MESMO array.
 */
export function bocasDoAbismoPintado(pintado: AbismoPintado | undefined): Abismo[] {
  if (pintado === undefined || pintado.quadrados.length === 0 || pintado.quadrado <= 0) return SEM_BOCAS
  const guardadas = bocasPorPintado.get(pintado)
  if (guardadas !== undefined) return guardadas
  const q = pintado.quadrado
  const tolerancia = TOLERANCIA_EM_QUADRADOS * q
  const contorno = (laco: readonly ArestaDeQuadrado[]): RegionPoint[] =>
    contornoSimplificado(beiraSuaveDoLaco(laco, q, pintado.origem).map((p) => ({ x: p[0], y: p[1] })), tolerancia)
  const pisos = [...new Set(pintado.quadrados.map((c) => pisoDe(c)))].sort((a, b) => a - b)
  const bocas: Abismo[] = []
  for (const piso of pisos) {
    const doPiso = new Map<string, QuadradoDoAbismo>()
    for (const c of pintado.quadrados) if (pisoDe(c) === piso) doPiso.set(chave(c.x, c.y, piso), c)
    const buraco = buracosDoPiso(doPiso, piso)
    // O quadrado mais de cima e à esquerda de cada buraco dá o id e o brilho dele.
    const primeiro = new Map<number, QuadradoDoAbismo>()
    for (const [k, c] of doPiso) {
      const n = buraco.get(k)
      if (n === undefined) continue
      const atual = primeiro.get(n)
      if (atual === undefined || c.y < atual.y || (c.y === atual.y && c.x < atual.x)) primeiro.set(n, c)
    }
    const deFora = new Map<number, RegionPoint[]>()
    const ilhas = new Map<number, RegionPoint[][]>()
    for (const laco of lacosDosQuadrados([...doPiso.values()], (x, y) => doPiso.has(chave(x, y, piso)))) {
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
      if (canto === undefined) continue
      const doBuraco = ilhas.get(n) ?? []
      bocas.push({
        id: `${PREFIXO_DO_PINTADO}${piso}:${canto.x},${canto.y}`,
        pontos,
        ...(doBuraco.length > 0 ? { ilhas: doBuraco } : {}),
        ...(canto.brilho !== undefined ? { brilho: canto.brilho } : {}),
        ...(piso !== 0 ? { piso } : {}),
      })
    }
  }
  bocasPorPintado.set(pintado, bocas)
  return bocas
}

const juntos = new WeakMap<AbismoPintado, { abismos: readonly Abismo[] | undefined; todos: readonly Abismo[] }>()

/**
 * Todos os abismos do mapa: os contornados à mão (`map.abismos`) e, depois
 * deles, os pintados (`bocasDoAbismoPintado`). Sem quadrado cavado é a PRÓPRIA
 * lista do mapa (ou `undefined`); as mesmas entradas devolvem o MESMO array
 * (as paredes de andar e a luz guardam cache pela referência da lista).
 */
export function abismosDoMapa(map: Pick<MapData, 'abismos' | 'abismoPintado'>): readonly Abismo[] | undefined {
  const pintado = map.abismoPintado
  if (pintado === undefined) return map.abismos
  const bocas = bocasDoAbismoPintado(pintado)
  if (bocas.length === 0) return map.abismos
  const guardado = juntos.get(pintado)
  if (guardado !== undefined && guardado.abismos === map.abismos) return guardado.todos
  const todos = map.abismos === undefined ? bocas : [...map.abismos, ...bocas]
  juntos.set(pintado, { abismos: map.abismos, todos })
  return todos
}
