import type { MapData, Perigo, Region, RegionPoint, TipoDePerigo, Wall } from '../types/map'
import { signedArea } from './floorContour'
import { pointInPolygonInclusive, pointOnPolygonBorder } from './roomNesting'

/**
 * PERIGO QUE SE ALASTRA — fogo ou água presos a Salas. A cada "Avançar" do
 * mestre o perigo toma as salas vizinhas ligadas por PORTA ABERTA. O fogo
 * deixa cinza onde queimava (e a cinza não queima de novo); a água fica onde
 * estava e soma as vizinhas. Lib pura: sem store, sem Pixi.
 *
 * A vizinhança é GEOMETRIA calculada na hora, nunca gravada: mover sala ou
 * porta já vale no próximo avanço.
 */

/** Quanto do lado de cada porta se olha para achar a sala, em frações da célula. */
const LADO_DA_PORTA_EM_CELULAS = 0.25

/** Onde a sala está no perigo: queimando/alagada agora, ou já em cinza. */
export type EstadoDaSalaNoPerigo = 'tomada' | 'cinza'

export const TIPOS_DE_PERIGO: readonly TipoDePerigo[] = ['fogo', 'agua']

function isTipoDePerigo(value: unknown): value is TipoDePerigo {
  return value === 'fogo' || value === 'agua'
}

function salasDoMapa(map: Pick<MapData, 'regions'>): Region[] {
  return map.regions.filter((r) => r.room !== undefined && r.points.length >= 3)
}

/**
 * A Sala MAIS INTERNA que contém o ponto (a de menor área): o armário dentro do
 * corredor, não o corredor. Ponto em cima de parede não é de sala nenhuma.
 */
function salaNoPonto(salas: readonly Region[], ponto: RegionPoint): Region | null {
  let melhor: Region | null = null
  let menorArea = Infinity
  for (const sala of salas) {
    if (!pointInPolygonInclusive(ponto, sala.points) || pointOnPolygonBorder(ponto, sala.points)) continue
    const area = Math.abs(signedArea(sala.points))
    if (area < menorArea) {
      melhor = sala
      menorArea = area
    }
  }
  return melhor
}

/** Um ponto de cada lado da porta, a um quarto de célula do meio dela. */
function ladosDaPorta(parede: Wall, celula: number): [RegionPoint, RegionPoint] | null {
  const dx = parede.x2 - parede.x1
  const dy = parede.y2 - parede.y1
  const comprimento = Math.hypot(dx, dy)
  if (!(comprimento > 0)) return null
  const d = celula * LADO_DA_PORTA_EM_CELULAS
  const nx = (-dy / comprimento) * d
  const ny = (dx / comprimento) * d
  const mx = (parede.x1 + parede.x2) / 2
  const my = (parede.y1 + parede.y2) / 2
  return [
    { x: mx + nx, y: my + ny },
    { x: mx - nx, y: my - ny },
  ]
}

function ligar(vizinhas: Map<string, Set<string>>, a: string, b: string): void {
  const deA = vizinhas.get(a) ?? new Set<string>()
  deA.add(b)
  vizinhas.set(a, deA)
}

/** Sala → salas do outro lado de cada porta ABERTA dela. Sala sem porta aberta não entra. */
export function salasLigadasPorPortaAberta(map: Pick<MapData, 'regions' | 'walls' | 'grid'>): Map<string, Set<string>> {
  const salas = salasDoMapa(map)
  const vizinhas = new Map<string, Set<string>>()
  for (const parede of map.walls) {
    if (parede.door === null || !parede.door.open) continue
    const lados = ladosDaPorta(parede, map.grid)
    if (lados === null) continue
    const a = salaNoPonto(salas, lados[0])
    const b = salaNoPonto(salas, lados[1])
    if (a === null || b === null || a.id === b.id) continue
    ligar(vizinhas, a.id, b.id)
    ligar(vizinhas, b.id, a.id)
  }
  return vizinhas
}

/** Toda sala que algum perigo já alcançou, tomada ou em cinza. */
function salasJaAlcancadas(perigos: readonly Perigo[]): Set<string> {
  return new Set(perigos.flatMap((p) => [...p.salas, ...(p.cinzas ?? [])]))
}

/**
 * As salas que o próximo "Avançar" toma, na ordem das salas do mapa. Sala já
 * alcançada por QUALQUER perigo do mapa (o próprio ou outro, tomada ou cinza)
 * fica de fora — a mesma regra de `porPerigoNaSala`: uma sala, um perigo.
 */
export function salasQueOAvancoAtinge(map: Pick<MapData, 'regions' | 'walls' | 'grid' | 'perigos'>, perigo: Perigo): string[] {
  const vizinhas = salasLigadasPorPortaAberta(map)
  const jaTem = salasJaAlcancadas([...(map.perigos ?? []), perigo])
  const alvo = new Set(perigo.salas.flatMap((id) => [...(vizinhas.get(id) ?? [])]).filter((id) => !jaTem.has(id)))
  return map.regions.filter((r) => alvo.has(r.id)).map((r) => r.id)
}

/** O mapa com a lista nova; lista vazia tira o campo (mapa volta a ser igual ao de antes do perigo). */
function comPerigos(map: MapData, perigos: Perigo[]): MapData {
  if (perigos.length > 0) return { ...map, perigos }
  const { perigos: _sem, ...semCampo } = map
  return semCampo
}

/**
 * Um passo do perigo. Fogo: as vizinhas pegam fogo e as que queimavam viram
 * cinza — fogo sem vizinha para tomar se apaga e deixa só a cinza. Água: soma
 * as vizinhas e fica onde estava. Nada a mudar devolve o MESMO mapa (o Ctrl+Z
 * não ganha passo vazio).
 */
export function avancarPerigo(map: MapData, perigoId: string): MapData {
  const perigo = map.perigos?.find((p) => p.id === perigoId)
  if (perigo === undefined) return map
  const novas = salasQueOAvancoAtinge(map, perigo)
  let proximo: Perigo
  if (perigo.tipo === 'fogo') {
    if (perigo.salas.length === 0) return map
    proximo = { ...perigo, salas: novas, cinzas: [...(perigo.cinzas ?? []), ...perigo.salas] }
  } else {
    if (novas.length === 0) return map
    proximo = { ...perigo, salas: [...perigo.salas, ...novas] }
  }
  return comPerigos(
    map,
    (map.perigos ?? []).map((p) => (p.id === perigoId ? proximo : p)),
  )
}

/**
 * O perigo que alcançou a sala (tomada ou em cinza); `null` = sala livre. Uma
 * sala tem no máximo um perigo: pôr e avançar recusam sala já alcançada.
 */
export function perigoDaSala(map: Pick<MapData, 'perigos'>, salaId: string): { perigo: Perigo; estado: EstadoDaSalaNoPerigo } | null {
  for (const perigo of map.perigos ?? []) {
    if (perigo.salas.includes(salaId)) return { perigo, estado: 'tomada' }
    if (perigo.cinzas?.includes(salaId) === true) return { perigo, estado: 'cinza' }
  }
  return null
}

/** Novo perigo preso à sala. Sala que não é Sala, ou já alcançada por um perigo, devolve o mesmo mapa. */
export function porPerigoNaSala(map: MapData, salaId: string, tipo: TipoDePerigo, id: string): MapData {
  if (!salasDoMapa(map).some((r) => r.id === salaId) || perigoDaSala(map, salaId) !== null) return map
  return comPerigos(map, [...(map.perigos ?? []), { id, tipo, salas: [salaId] }])
}

export function apagarPerigo(map: MapData, perigoId: string): MapData {
  if (!(map.perigos ?? []).some((p) => p.id === perigoId)) return map
  return comPerigos(
    map,
    (map.perigos ?? []).filter((p) => p.id !== perigoId),
  )
}

function listaDeTextos(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : undefined
}

function perigoFromFile(value: unknown): Perigo | null {
  if (value === null || typeof value !== 'object') return null
  const id: unknown = Reflect.get(value, 'id')
  const tipo: unknown = Reflect.get(value, 'tipo')
  if (typeof id !== 'string' || id.length === 0 || !isTipoDePerigo(tipo)) return null
  const salas = listaDeTextos(Reflect.get(value, 'salas')) ?? []
  const cinzas = listaDeTextos(Reflect.get(value, 'cinzas'))
  return cinzas === undefined ? { id, tipo, salas } : { id, tipo, salas, cinzas }
}

/**
 * `MapData.perigos` lido do disco. Ausente (mapa salvo antes do campo) ou que
 * não é lista continua ausente; perigo torto (tipo desconhecido, id vazio) sai
 * e o resto fica, em vez de derrubar o arquivo.
 */
export function perigosFromFile(value: unknown): Perigo[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value.flatMap((item) => {
    const perigo = perigoFromFile(item)
    return perigo === null ? [] : [perigo]
  })
}

/**
 * O que o JOGADOR recebe: um item por tipo, só com as salas de `vistas` (as
 * que ele enxerga agora e que já saem no recorte dele). O id do mestre nunca
 * sai — o item leva o próprio tipo como id. Nada à vista = lista vazia.
 */
export function perigosParaJogador(perigos: readonly Perigo[], vistas: ReadonlySet<string>): Perigo[] {
  return TIPOS_DE_PERIGO.flatMap((tipo): Perigo[] => {
    const doTipo = perigos.filter((p) => p.tipo === tipo)
    const salas = [...new Set(doTipo.flatMap((p) => p.salas))].filter((id) => vistas.has(id))
    const cinzas = [...new Set(doTipo.flatMap((p) => p.cinzas ?? []))].filter((id) => vistas.has(id) && !salas.includes(id))
    if (salas.length === 0 && cinzas.length === 0) return []
    return [cinzas.length === 0 ? { id: tipo, tipo, salas } : { id: tipo, tipo, salas, cinzas }]
  })
}
