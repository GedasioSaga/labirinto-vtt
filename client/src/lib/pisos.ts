import type { Light, MapData, NoPiso, Pin, Stair, Token } from '../types/map'
import type { SelectionKind } from '../types/tools'
import { carriedBy, carrierIdOf, withoutCarrier } from './carry'
import { subtreeIds } from './roomNesting'

/**
 * PISOS NA MESMA CENA — lógica pura. A cena tem pisos numerados (inteiros;
 * ausente = 0, o térreo), o jogador recebe só o piso da ficha dele e a escada
 * com `levaAoPiso` troca o piso da ficha no mesmo ponto, sem trocar de cena.
 * Plano em `docs/planos/pisos-na-mesma-cena.md`.
 */

/** Faixa de piso aceita do arquivo: um prédio de verdade cabe com folga, e número absurdo não. */
export const PISO_MIN = -99
export const PISO_MAX = 999

/**
 * Folga, em células, de "a ficha está na escada": o centro da ficha a até meia
 * largura do lance MAIS meia célula da linha dele. É encostar na escada, como a
 * porta pede ficha encostada (`lib/doorReach.ts`), e não pisar no degrau exato.
 */
const ESCADA_FOLGA_CELULAS = 0.5

/** O piso da entidade: ausente é o térreo. */
export function pisoDe(item: NoPiso): number {
  return item.piso ?? 0
}

/** Valor que serve como piso: inteiro finito dentro da faixa. */
export function ehPiso(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= PISO_MIN && value <= PISO_MAX
}

/**
 * A entidade no piso `piso`. Térreo (ou ausente) TIRA o campo em vez de gravar
 * `0`: o arquivo fica como o de um mapa sem pisos, sem chave inventada.
 */
export function comPiso<T extends NoPiso>(item: T, piso: number | undefined): T {
  if (piso !== undefined && piso !== 0) return { ...item, piso }
  if (!('piso' in item)) return item
  const copia = { ...item }
  delete copia.piso
  return copia
}

/** "térreo", "1º piso", "2º subsolo" — o nome que a tela do jogador mostra. */
export function nomeDoPiso(piso: number): string {
  if (piso === 0) return 'térreo'
  return piso > 0 ? `${piso}º piso` : `${-piso}º subsolo`
}

/** As listas de entidade do mapa que têm piso — todas menos a escada, que liga dois. */
type ListasComPiso = Pick<MapData, 'walls' | 'lights' | 'regions' | 'tokens' | 'props' | 'drawings' | 'floor' | 'lines' | 'markers' | 'concealZones' | 'pins'>

/** Aplica `f` a cada lista com piso, uma a uma, sem perder o tipo de nenhuma. */
function cadaLista(map: MapData, f: <T extends NoPiso>(list: T[]) => T[]): ListasComPiso {
  return {
    walls: f(map.walls),
    lights: f(map.lights),
    regions: f(map.regions),
    tokens: f(map.tokens),
    props: f(map.props),
    drawings: f(map.drawings),
    floor: f(map.floor),
    lines: f(map.lines),
    markers: f(map.markers),
    concealZones: f(map.concealZones),
    pins: f(map.pins),
  }
}

/**
 * As listas com piso, para perguntar. `?? []`: mapa montado fora do
 * `deserializeMap` (teste, cena antiga em cache) pode vir sem a lista.
 */
function listasDe(map: MapData): readonly NoPiso[][] {
  return [map.walls, map.lights, map.regions, map.tokens, map.props, map.drawings, map.floor, map.lines, map.markers, map.concealZones, map.pins].map(
    (list: NoPiso[] | undefined) => list ?? [],
  )
}

/** O mapa tem mais de um piso? Alguma entidade fora do térreo, ou escada que liga pisos. */
export function temPisos(map: MapData): boolean {
  const fora = (item: NoPiso): boolean => pisoDe(item) !== 0
  return listasDe(map).some((list) => list.some(fora)) || (map.stairs ?? []).some((s) => fora(s) || s.levaAoPiso !== undefined)
}

/**
 * Cache por LISTA (a referência imutável de `map.walls`, `map.floor`...): a
 * mesma lista pedida para o mesmo piso volta o MESMO array. O contorno do chão
 * e a visão são cacheados pela referência da lista (`lib/fogFilter.ts`,
 * `lib/visibility.ts`); sem isto, cada recorte de um mapa com pisos criaria
 * listas novas e jogaria esses caches fora.
 */
const cachePorLista = new WeakMap<readonly object[], Map<string, readonly object[]>>()

function doPiso<T extends NoPiso>(list: T[] | undefined, chave: string, pertence: (item: T) => boolean): T[] {
  if (list === undefined) return []
  let porPiso = cachePorLista.get(list)
  if (porPiso === undefined) {
    porPiso = new Map()
    cachePorLista.set(list, porPiso)
  }
  const cached = porPiso.get(chave)
  if (cached !== undefined) return cached as T[] // cast: só esta função grava aqui, e grava o filtro desta MESMA lista `T[]` com esta chave
  const out = list.filter(pertence)
  porPiso.set(chave, out)
  return out
}

/** A escada aparece no piso dela e no piso a que leva. */
function escadaNoPiso(stair: Stair, piso: number): boolean {
  return pisoDe(stair) === piso || stair.levaAoPiso === piso
}

/**
 * O mapa como ele é num piso só: cada lista leva o que é daquele piso, e a
 * escada que chega nele. Mapa de um piso só pedido no térreo volta ELE MESMO.
 * O resto do `MapData` (grade, fundo, estilo, camadas) é da cena, não do piso.
 */
export function mapaDoPiso(map: MapData, piso: number): MapData {
  let porPiso = cachePorMapa.get(map)
  const cached = porPiso?.get(piso)
  if (cached !== undefined) return cached
  const recorte = recortarPiso(map, piso)
  if (porPiso === undefined) {
    porPiso = new Map()
    cachePorMapa.set(map, porPiso)
  }
  porPiso.set(piso, recorte)
  return recorte
}

/**
 * Cache por MAPA do recorte inteiro: o editor pede o piso em edição a cada
 * quadro de arrasto e a cada clique (`pixi/PixiCanvas.tsx`), e `temPisos`
 * percorre o mapa todo. O mesmo mapa pedido de novo no mesmo piso volta o
 * MESMO objeto, sem varrer nada.
 */
const cachePorMapa = new WeakMap<MapData, Map<number, MapData>>()

function recortarPiso(map: MapData, piso: number): MapData {
  if (piso === 0 && !temPisos(map)) return map
  const chave = `piso:${piso}`
  const noPiso = (item: NoPiso): boolean => pisoDe(item) === piso
  return {
    ...map,
    ...cadaLista(map, (list) => doPiso(list, chave, noPiso)),
    stairs: doPiso(map.stairs, `escada:${piso}`, (s) => escadaNoPiso(s, piso)),
  }
}

/** Entidade com piso e identidade — toda lista do mapa que tem piso. */
type ComPisoEId = NoPiso & { id: string }

/** A lista `depois` com o que NÃO existia em `antes` posto no piso `piso`. Nada nasceu fora dele: a própria lista. */
function nascidosNoPiso<T extends ComPisoEId>(antes: readonly T[] | undefined, depois: T[], piso: number): T[] {
  if (antes === depois) return depois
  const existiam = new Set((antes ?? []).map((item) => item.id))
  let mudou = false
  const out = depois.map((item) => {
    if (existiam.has(item.id) || pisoDe(item) === piso) return item
    mudou = true
    return comPiso(item, piso)
  })
  return mudou ? out : depois
}

/**
 * O EDITOR CONSTRÓI NO PISO EM EDIÇÃO: toda entidade que o passo do mestre
 * criou (id que não existia em `antes`) nasce no piso `piso` — parede, sala,
 * peça de chão, luz, pino, objeto, desenho, linha, marcador, zona, ficha e
 * escada, por qualquer ferramenta, colar ou duplicar. Quem já existia fica
 * onde estava. Nada nasceu fora do piso: `depois` ELE MESMO.
 */
export function nascemNoPiso(antes: MapData, depois: MapData, piso: number): MapData {
  if (antes === depois) return depois
  const listas = {
    walls: nascidosNoPiso(antes.walls, depois.walls, piso),
    lights: nascidosNoPiso(antes.lights, depois.lights, piso),
    regions: nascidosNoPiso(antes.regions, depois.regions, piso),
    tokens: nascidosNoPiso(antes.tokens, depois.tokens, piso),
    props: nascidosNoPiso(antes.props, depois.props, piso),
    drawings: nascidosNoPiso(antes.drawings, depois.drawings, piso),
    floor: nascidosNoPiso(antes.floor, depois.floor, piso),
    lines: nascidosNoPiso(antes.lines, depois.lines, piso),
    markers: nascidosNoPiso(antes.markers, depois.markers, piso),
    concealZones: nascidosNoPiso(antes.concealZones, depois.concealZones, piso),
    pins: nascidosNoPiso(antes.pins, depois.pins, piso),
    stairs: nascidosNoPiso(antes.stairs, depois.stairs, piso),
  }
  const mudou = [
    listas.walls !== depois.walls,
    listas.lights !== depois.lights,
    listas.regions !== depois.regions,
    listas.tokens !== depois.tokens,
    listas.props !== depois.props,
    listas.drawings !== depois.drawings,
    listas.floor !== depois.floor,
    listas.lines !== depois.lines,
    listas.markers !== depois.markers,
    listas.concealZones !== depois.concealZones,
    listas.pins !== depois.pins,
    listas.stairs !== depois.stairs,
  ].some(Boolean)
  return mudou ? { ...depois, ...listas } : depois
}

/** O que o mestre pode levar a outro piso pela seleção (`lib/selectionModel.ts`). */
export interface ItemParaPiso {
  readonly kind: SelectionKind
  readonly id: string
}

/**
 * "Levar ao piso" da seleção: cada item escolhido vai ao piso `piso`. A sala
 * leva as sub-salas e as paredes dela (parede de sala escolhida sozinha leva
 * a sala inteira: sala com metade das paredes em outro piso não fecha); a
 * ficha leva o que anda com ela — a ficha que ela leva, a tocha e o pino
 * preso (`comFichasNoPiso`). Nada muda: o próprio mapa.
 */
export function comSelecaoNoPiso(map: MapData, itens: readonly ItemParaPiso[], piso: number): MapData {
  const ids = (kind: ItemParaPiso['kind']): Set<string> => new Set(itens.filter((i) => i.kind === kind).map((i) => i.id))
  const paredes = ids('wall')
  const salas = new Set<string>()
  const salasEscolhidas = [
    ...ids('region'),
    ...map.walls.flatMap((w) => (w.regionId !== undefined && paredes.has(w.id) ? [w.regionId] : [])),
  ]
  for (const regionId of salasEscolhidas) for (const id of subtreeIds(map.regions, regionId)) salas.add(id)
  const luzes = ids('light')
  const leva = <T extends ComPisoEId>(list: T[], vai: (item: T) => boolean): T[] => {
    let mudou = false
    const out = list.map((item) => {
      if (!vai(item) || pisoDe(item) === piso) return item
      mudou = true
      return comPiso(item, piso)
    })
    return mudou ? out : list
  }
  const escadas = ids('stair')
  const objetos = ids('prop')
  const desenhos = ids('drawing')
  const pecas = ids('floor')
  // A ficha leva o que anda com ela (a ficha levada, a tocha, o pino preso): `comFichasNoPiso`.
  const comFichas = comFichasNoPiso(map, ids('token'), piso)
  const next: MapData = {
    ...map,
    ...comFichas,
    regions: leva(map.regions, (r) => salas.has(r.id)),
    walls: leva(map.walls, (w) => paredes.has(w.id) || (w.regionId !== undefined && salas.has(w.regionId))),
    lights: leva(comFichas.lights, (l) => luzes.has(l.id)),
    stairs: leva(map.stairs, (s) => escadas.has(s.id)),
    props: leva(map.props, (p) => objetos.has(p.id)),
    drawings: leva(map.drawings, (d) => desenhos.has(d.id)),
    floor: leva(map.floor, (p) => pecas.has(p.id)),
  }
  const mudou = next.regions !== map.regions || next.walls !== map.walls || next.tokens !== map.tokens || next.lights !== map.lights ||
    next.pins !== map.pins || next.stairs !== map.stairs || next.props !== map.props || next.drawings !== map.drawings || next.floor !== map.floor
  return mudou ? next : map
}

/** Distância do ponto ao segmento (a linha central do lance). */
function distanciaAoSegmento(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

/** A escada que a ficha está usando e o piso a que ela leva. */
export interface EscadaDaFicha {
  stairId: string
  destino: number
}

/**
 * A escada que liga pisos em que a ficha está encostada, no piso DELA, e o
 * outro piso dessa escada. Escada secreta não conta (o jogador não a tem), nem
 * a de enfeite (sem `levaAoPiso`), nem a que liga um piso ao mesmo piso.
 * Nenhuma: `null`.
 */
export function escadaDaFicha(map: Pick<MapData, 'stairs' | 'grid'>, token: Token): EscadaDaFicha | null {
  const piso = pisoDe(token)
  for (const stair of map.stairs) {
    const leva = stair.levaAoPiso
    if (leva === undefined || stair.secret === true || leva === pisoDe(stair)) continue
    if (!escadaNoPiso(stair, piso)) continue
    const alcance = stair.stepWidth / 2 + map.grid * ESCADA_FOLGA_CELULAS
    const encostada = stair.segments.some((s) => distanciaAoSegmento(token.x, token.y, s.x1, s.y1, s.x2, s.y2) <= alcance)
    if (encostada) return { stairId: stair.id, destino: piso === leva ? pisoDe(stair) : leva }
  }
  return null
}

/** Número digitado pelo mestre como piso: inteiro, preso na faixa. Não-número: `null`. */
export function pisoDigitado(value: number): number | null {
  if (!Number.isFinite(value)) return null
  return Math.min(PISO_MAX, Math.max(PISO_MIN, Math.trunc(value)))
}

/**
 * A ficha vai a outro piso — pelo painel do mestre ou pela escada do jogador —
 * e o que anda com ela vai junto, como em "Levar ao piso" (`comSelecaoNoPiso`):
 * a tocha, o pino preso ou a ficha levada que ficasse embaixo seguiria o x/y
 * da ficha lá em cima e desenharia, no recorte de quem está embaixo, o caminho
 * de quem subiu (`comFichasNoPiso`). Ficha inexistente ou já lá: o próprio mapa.
 */
export function comFichaNoPiso(map: MapData, tokenId: string, piso: number): MapData {
  const token = map.tokens.find((t) => t.id === tokenId)
  if (token === undefined || pisoDe(token) === piso) return map
  return { ...map, ...comFichasNoPiso(map, new Set([tokenId]), piso) }
}

/** As listas que mudam quando fichas trocam de piso. */
type ListasDaFicha = Pick<MapData, 'tokens' | 'lights' | 'pins'>

/**
 * As fichas `escolhidas` vão ao piso `piso` com TUDO que anda com elas — o
 * que segue o x/y delas em `setTokenPosition` (`lib/mapFactory.ts`) e, ficando
 * embaixo, desenharia no recorte de quem ficou o caminho de quem subiu:
 * - as fichas que elas LEVAM (`levadoPor`, um nível só: `lib/carry.ts`);
 * - a luz presa a qualquer uma delas (a tocha);
 * - o pino PRESO a qualquer uma delas (`Pin.presoA`: navio, maca, balão).
 * A ficha LEVADA que vai sem quem a leva solta do vínculo: presa, andaria com
 * ele no outro piso e contaria, a quem está com ela, onde ele anda.
 * Lista em que nada muda volta a MESMA (o editor redesenha pela referência).
 */
function comFichasNoPiso(map: MapData, escolhidas: ReadonlySet<string>, piso: number): ListasDaFicha {
  const vao = new Set(escolhidas)
  for (const id of escolhidas) for (const levada of carriedBy(map, id)) vao.add(levada.id)
  const pisoPorFicha = new Map(map.tokens.map((t) => [t.id, pisoDe(t)]))
  const soltaDeQuemFica = (t: Token): boolean => {
    const quemLeva = carrierIdOf(t)
    if (quemLeva === null || vao.has(quemLeva)) return false
    const pisoDeQuemLeva = pisoPorFicha.get(quemLeva)
    return pisoDeQuemLeva !== undefined && pisoDeQuemLeva !== piso
  }
  let fichasMudaram = false
  const tokens = map.tokens.map((t) => {
    if (!vao.has(t.id)) return t
    const noPiso = pisoDe(t) === piso ? t : comPiso(t, piso)
    const pronta = soltaDeQuemFica(t) ? withoutCarrier(noPiso) : noPiso
    if (pronta !== t) fichasMudaram = true
    return pronta
  })
  const levaLuz = (l: Light): boolean => l.attachedTokenId !== undefined && vao.has(l.attachedTokenId) && pisoDe(l) !== piso
  const levaPino = (p: Pin): boolean => p.presoA !== undefined && vao.has(p.presoA) && pisoDe(p) !== piso
  return {
    tokens: fichasMudaram ? tokens : map.tokens,
    lights: map.lights.some(levaLuz) ? map.lights.map((l) => (levaLuz(l) ? comPiso(l, piso) : l)) : map.lights,
    pins: map.pins.some(levaPino) ? map.pins.map((p) => (levaPino(p) ? comPiso(p, piso) : p)) : map.pins,
  }
}

/**
 * O mestre muda a escada: o piso dela e/ou o piso a que leva (`null` = de
 * enfeite, sem ligar nada). Escada inexistente ou nada muda: o próprio mapa.
 */
export function comEscadaNosPisos(map: MapData, stairId: string, mudanca: { piso?: number; levaAoPiso?: number | null }): MapData {
  const stair = map.stairs.find((s) => s.id === stairId)
  if (stair === undefined) return map
  let next = mudanca.piso === undefined ? stair : comPiso(stair, mudanca.piso)
  if (mudanca.levaAoPiso !== undefined) {
    if (mudanca.levaAoPiso === null) {
      const { levaAoPiso: _sai, ...semLigacao } = next
      next = semLigacao
    } else next = { ...next, levaAoPiso: mudanca.levaAoPiso }
  }
  if (pisoDe(next) === pisoDe(stair) && next.levaAoPiso === stair.levaAoPiso) return map
  return { ...map, stairs: map.stairs.map((s) => (s.id === stairId ? next : s)) }
}

/** A entidade como o arquivo a traz: piso torto SAI, e ela volta ao térreo. */
function semPisoTorto<T extends NoPiso>(item: T): T {
  if (!('piso' in item) || ehPiso(item.piso)) return item
  const copia = { ...item }
  delete copia.piso
  return copia
}

function escadaDoArquivo(stair: Stair): Stair {
  const limpa = semPisoTorto(stair)
  if (!('levaAoPiso' in limpa) || ehPiso(limpa.levaAoPiso)) return limpa
  const { levaAoPiso: _torto, ...resto } = limpa
  return resto
}

/**
 * Leitura do arquivo (`deserializeMap`): `piso` e `levaAoPiso` são campos
 * NOVOS e OPCIONAIS. Ausente continua ausente (mapa antigo abre igual e sem
 * ganhar chave); valor que não é inteiro na faixa (texto, fração, `NaN` de
 * arquivo editado à mão) SAI — o piso vai para a tela do jogador, e lixo não
 * atravessa. Mapa sem campo torto nenhum volta ELE MESMO.
 */
export function pisosDoArquivo(map: MapData): MapData {
  const torto = (item: NoPiso): boolean => 'piso' in item && !ehPiso(item.piso)
  const escadaTorta = (s: Stair): boolean => torto(s) || ('levaAoPiso' in s && !ehPiso(s.levaAoPiso))
  if (!listasDe(map).some((list) => list.some(torto)) && !map.stairs.some(escadaTorta)) return map
  return { ...map, ...cadaLista(map, (list) => list.map(semPisoTorto)), stairs: map.stairs.map(escadaDoArquivo) }
}
