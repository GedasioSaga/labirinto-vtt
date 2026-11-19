import type { AlturaDeUmPiso, AlturaDoPiso, Light, MapData, NoPiso, Pin, Stair, Token } from '../types/map'
import type { SelectionKind } from '../types/tools'
import { carriedBy, carrierIdOf, withoutCarrier } from './carry'
import { subtreeIds } from './roomNesting'
import { stairCenterline } from './stairCurve'
import { comCadaTipo, TIPOS_DO_EDITOR, type EntidadePorTipo } from './tiposDoEditor'

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

/**
 * As listas do RELEVO que têm piso (texturas, carimbos, penhasco). Ausentes
 * continuam ausentes no recorte: o editor e a tela do jogador leem `undefined`
 * como "nada pintado" e não ganham chave nova.
 */
type ListasDoRelevo = Pick<MapData, 'texturas' | 'carimbos' | 'penhascos' | 'neblinaPintada' | 'ambientePintado' | 'aguas'>

function listasDoRelevo(map: MapData, f: <T extends NoPiso & { id: string }>(list: T[]) => T[]): ListasDoRelevo {
  return {
    ...(map.texturas === undefined ? {} : { texturas: f(map.texturas) }),
    ...(map.carimbos === undefined ? {} : { carimbos: f(map.carimbos) }),
    ...(map.penhascos === undefined ? {} : { penhascos: f(map.penhascos) }),
    // NEBLINA pintada: a do 1º piso não cobre o térreo.
    ...(map.neblinaPintada === undefined ? {} : { neblinaPintada: f(map.neblinaPintada) }),
    // AMBIENTE pintado: idem, por piso.
    ...(map.ambientePintado === undefined ? {} : { ambientePintado: f(map.ambientePintado) }),
    // ÁGUA (`lib/agua/`): o rio do 1º piso não corre no térreo.
    ...(map.aguas === undefined ? {} : { aguas: f(map.aguas) }),
  }
}

/** O mapa tem mais de um piso? Alguma entidade fora do térreo, ou escada que liga pisos. */
export function temPisos(map: MapData): boolean {
  const fora = (item: NoPiso): boolean => pisoDe(item) !== 0
  const doRelevo = [map.texturas, map.carimbos, map.penhascos, map.neblinaPintada, map.ambientePintado, map.aguas].some((list) => (list ?? []).some(fora))
  return doRelevo || listasDe(map).some((list) => list.some(fora)) || (map.stairs ?? []).some((s) => fora(s) || s.levaAoPiso !== undefined)
}

/**
 * Leitura do arquivo: o `piso` de um item do relevo (passo de textura,
 * carimbo, risco de penhasco), só se é inteiro na faixa. Ausente, térreo ou
 * torto: nada (o item fica no térreo, como era antes do campo existir).
 */
export function pisoLido(valor: object): NoPiso {
  const piso = 'piso' in valor ? valor.piso : undefined
  return ehPiso(piso) && piso !== 0 ? { piso } : {}
}

/**
 * A lista inteira com os itens do piso `piso` trocados por `doPiso` (o que a
 * operação do editor fez só com eles). Os dos outros pisos ficam como estavam:
 * a borracha no 1º piso não alcança a pintura do térreo. A ordem só importa
 * dentro de um piso (cada piso pinta só os dele), então os do piso vão no fim.
 */
export function comListaDoPiso<T extends NoPiso>(todos: readonly T[], doPiso: readonly T[], piso: number): T[] {
  return [...todos.filter((item) => pisoDe(item) !== piso), ...doPiso]
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
 * O editor mostra um piso só (mapa com pisos, ou fora do térreo)? É quando
 * "apagar todos" e as contagens dos painéis valem para "este piso". Usa o
 * recorte em cache em vez de `temPisos`, que varreria o mapa a cada mudança
 * da store (o seletor roda a cada quadro de arrasto).
 */
export function editandoUmPiso(map: MapData, piso: number): boolean {
  return mapaDoPiso(map, piso) !== map
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
    // TEXTURAS, CARIMBOS e PENHASCO: a pincelada do 1º piso não aparece no térreo.
    ...listasDoRelevo(map, (list) => doPiso(list, chave, noPiso)),
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
  // Os tipos do editor vêm da tabela (`lib/tiposDoEditor.ts`): antes a lista
  // era escrita à mão e a água, o abismo e o risco do Barranco colados ou
  // duplicados em outro piso nasciam no piso de origem (análise de 18/11/2026).
  const comOsTipos = comCadaTipo(depois, (lista, tipo) => nascidosNoPiso(TIPOS_DO_EDITOR[tipo].lista(antes), lista, piso))
  // O que tem piso e não é selecionável: a linha, o marcador, o passo de textura e o risco de penhasco.
  const lines = nascidosNoPiso(antes.lines, comOsTipos.lines, piso)
  const markers = nascidosNoPiso(antes.markers, comOsTipos.markers, piso)
  const texturas = comOsTipos.texturas === undefined ? undefined : nascidosNoPiso(antes.texturas, comOsTipos.texturas, piso)
  const penhascos = comOsTipos.penhascos === undefined ? undefined : nascidosNoPiso(antes.penhascos, comOsTipos.penhascos, piso)
  const mudou = lines !== comOsTipos.lines || markers !== comOsTipos.markers || texturas !== comOsTipos.texturas || penhascos !== comOsTipos.penhascos
  if (!mudou) return comOsTipos
  return {
    ...comOsTipos,
    lines,
    markers,
    ...(texturas === undefined ? {} : { texturas }),
    ...(penhascos === undefined ? {} : { penhascos }),
  }
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
 *
 * A regra de cada tipo mora em `vai`, um registro EXAUSTIVO por
 * `SelectionKind`, e as listas vêm da tabela (`lib/tiposDoEditor.ts`): antes
 * o carimbo, o pino, a zona, a água, o risco do Barranco e o abismo eram
 * ignorados sem aviso (análise de 18/11/2026). Tipo novo não compila sem
 * dizer aqui se vai ao piso.
 */
export function comSelecaoNoPiso(map: MapData, itens: readonly ItemParaPiso[], piso: number): MapData {
  const ids = (kind: SelectionKind): Set<string> => new Set(itens.filter((i) => i.kind === kind).map((i) => i.id))
  const escolhido = (kind: SelectionKind): ((item: { id: string }) => boolean) => {
    const doTipo = ids(kind)
    return (item) => doTipo.has(item.id)
  }
  const paredes = ids('wall')
  const salas = new Set<string>()
  const salasEscolhidas = [
    ...ids('region'),
    ...map.walls.flatMap((w) => (w.regionId !== undefined && paredes.has(w.id) ? [w.regionId] : [])),
  ]
  for (const regionId of salasEscolhidas) for (const id of subtreeIds(map.regions, regionId)) salas.add(id)
  const pinos = ids('pin')
  const vai: { readonly [K in SelectionKind]: (item: EntidadePorTipo[K]) => boolean } = {
    region: (r) => salas.has(r.id),
    wall: (w) => paredes.has(w.id) || (w.regionId !== undefined && salas.has(w.regionId)),
    // A ficha vai por `comFichasNoPiso`, abaixo, com tudo o que anda com ela.
    token: () => false,
    // O pino PRESO a uma ficha tem o piso da ficha (`comFichasNoPiso`): sozinho
    // em outro piso, seguiria o x/y dela e mostraria a quem ficou o caminho dela.
    pin: (p) => pinos.has(p.id) && p.presoA === undefined,
    light: escolhido('light'),
    stair: escolhido('stair'),
    prop: escolhido('prop'),
    drawing: escolhido('drawing'),
    floor: escolhido('floor'),
    carimbo: escolhido('carimbo'),
    zone: escolhido('zone'),
    agua: escolhido('agua'),
    barranco: escolhido('barranco'),
    abismo: escolhido('abismo'),
  }
  // A ficha leva o que anda com ela (a ficha levada, a tocha, o pino preso): `comFichasNoPiso`.
  const comFichas = comFichasNoPiso(map, ids('token'), piso)
  const fichasMudaram = comFichas.tokens !== map.tokens || comFichas.lights !== map.lights || comFichas.pins !== map.pins
  const base: MapData = fichasMudaram ? { ...map, ...comFichas } : map
  // Devolver a MESMA lista é "nada mudou": `comCadaTipo` devolve o mesmo mapa.
  return comCadaTipo(base, (lista, tipo) => {
    const vaiDoTipo = vai[tipo]
    if (!lista.some((item) => vaiDoTipo(item) && pisoDe(item) !== piso)) return lista
    return lista.map((item) => (vaiDoTipo(item) && pisoDe(item) !== piso ? comPiso(item, piso) : item))
  })
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
    // Escada curva: a ficha está nela se encosta no arco desenhado (`lib/stairCurve.ts`).
    const encostada = stairCenterline(stair).some((s) => distanciaAoSegmento(token.x, token.y, s.x1, s.y1, s.x2, s.y2) <= alcance)
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

/** TERRENO ALTO: a "Altura" do piso `piso` (`MapData.alturaDosPisos`); ausente é a média. */
export function alturaDoPiso(map: Pick<MapData, 'alturaDosPisos'>, piso: number): AlturaDoPiso {
  return map.alturaDosPisos?.find((a) => a.piso === piso)?.altura ?? 'media'
}

/**
 * O mestre muda a "Altura" do piso `piso`. A média TIRA a entrada (e a lista
 * vazia tira o campo): o arquivo fica como o de um mapa sem a opção. Nada
 * muda: o próprio mapa.
 */
export function comAlturaDoPiso(map: MapData, piso: number, altura: AlturaDoPiso): MapData {
  if (alturaDoPiso(map, piso) === altura) return map
  const outras = (map.alturaDosPisos ?? []).filter((a) => a.piso !== piso)
  const lista: AlturaDeUmPiso[] = altura === 'media' ? outras : [...outras, { piso, altura }]
  if (lista.length > 0) return { ...map, alturaDosPisos: lista }
  const copia = { ...map }
  delete copia.alturaDosPisos
  return copia
}

/**
 * Leitura do arquivo: só entrada com piso inteiro na faixa e altura 'baixa'
 * ou 'alta' fica, uma por piso (a primeira vale). Nada que sirva: `undefined`
 * (o campo nem existe, como em mapa de antes dele).
 */
export function alturasDosPisosDoArquivo(valor: unknown): AlturaDeUmPiso[] | undefined {
  if (!Array.isArray(valor)) return undefined
  const vistos = new Set<number>()
  const lista: AlturaDeUmPiso[] = []
  for (const item of valor) {
    if (typeof item !== 'object' || item === null) continue
    const piso: unknown = 'piso' in item ? item.piso : undefined
    const altura: unknown = 'altura' in item ? item.altura : undefined
    if (!ehPiso(piso) || vistos.has(piso) || (altura !== 'baixa' && altura !== 'alta')) continue
    vistos.add(piso)
    lista.push({ piso, altura })
  }
  return lista.length === 0 ? undefined : lista
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
