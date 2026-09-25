import type { AreaTrigger, AreaTriggerKind, MapData, Region, RegionPoint } from '../types/map'
import { pointInRing } from './floorContour'
import { pisoDe } from './pisos'

/**
 * GATILHO DE ÁREA — regra pura, sem DOM, sem Pixi, sem store. O mestre marca
 * uma Região ou Sala como armadilha ou alarme; quando a ficha de um JOGADOR
 * entra no polígono dela, o mestre recebe o aviso "Armadilha: Ana entrou em
 * Corredor". O jogador não recebe nada por ter entrado: só vê a área marcada
 * depois que o mestre revela (o recorte mora em `lib/fogFilter.ts`).
 */

/** Os tipos, na ordem do painel. */
export const AREA_TRIGGER_KINDS: readonly AreaTriggerKind[] = ['armadilha', 'alarme']

/** O nome que a pessoa lê no painel e no aviso. */
export const AREA_TRIGGER_LABELS: Record<AreaTriggerKind, string> = {
  armadilha: 'Armadilha',
  alarme: 'Alarme',
}

/** Cor do gatilho no mapa: vermelho de perigo e âmbar de sirene, chapados. */
export const AREA_TRIGGER_COLORS: Record<AreaTriggerKind, number> = {
  armadilha: 0xc8412f,
  alarme: 0xe0a526,
}

/** Preenchimento translúcido: lê-se a marca e ainda se lê o chão embaixo. */
export const AREA_TRIGGER_FILL_ALPHA = 0.18
/** Contorno fino da área marcada, em px de mundo — linha fina, estilo minimapa. */
export const AREA_TRIGGER_STROKE_WIDTH = 2

/** Nome do aviso para a área que o mestre não nomeou. */
const UNNAMED_AREA = 'área sem nome'

export function isAreaTriggerKind(value: unknown): value is AreaTriggerKind {
  return AREA_TRIGGER_KINDS.some((kind) => kind === value)
}

/** Os gatilhos do mapa. O campo é opcional (mapa sem gatilho não carrega `[]`). */
export function areaTriggersOf(map: Pick<MapData, 'gatilhos'>): readonly AreaTrigger[] {
  return map.gatilhos ?? []
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Um gatilho lido do disco, ou `null` se a forma não fecha. `revealed` que não é booleano nasce escondido. */
function readAreaTrigger(raw: unknown): AreaTrigger | null {
  if (!isRecord(raw)) return null
  const { id, kind, regionId, revealed } = raw
  if (typeof id !== 'string' || id === '' || !isAreaTriggerKind(kind) || typeof regionId !== 'string' || regionId === '') return null
  return { id, kind, regionId, revealed: revealed === true }
}

/**
 * `MapData.gatilhos` como veio do disco (cru). Gatilho fora da forma sai
 * sozinho; segunda marca na mesma região também (vale a primeira). Lista que
 * sobra vazia é AUSÊNCIA — o mapa não ganha campo que não tinha.
 */
export function readAreaTriggers(raw: unknown): AreaTrigger[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const seen = new Set<string>()
  const out: AreaTrigger[] = []
  for (const item of raw) {
    const trigger = readAreaTrigger(item)
    if (trigger === null || seen.has(trigger.regionId)) continue
    seen.add(trigger.regionId)
    out.push(trigger)
  }
  return out.length === 0 ? undefined : out
}

/** O mapa com exatamente estes gatilhos; nenhum APAGA o campo. */
function withAreaTriggers(map: MapData, triggers: readonly AreaTrigger[]): MapData {
  const { gatilhos: _antigos, ...semGatilho } = map
  return triggers.length === 0 ? semGatilho : { ...semGatilho, gatilhos: [...triggers] }
}

/** A região do gatilho, se ainda existe e tem polígono (região apagada deixa de disparar). */
function triggerRegion(map: Pick<MapData, 'regions'>, regionId: string): Region | null {
  const region = map.regions.find((r) => r.id === regionId)
  return region !== undefined && region.points.length >= 3 ? region : null
}

/** O gatilho desta região (uma região tem no máximo um). */
export function areaTriggerOfRegion(map: Pick<MapData, 'gatilhos'>, regionId: string): AreaTrigger | null {
  return areaTriggersOf(map).find((t) => t.regionId === regionId) ?? null
}

/**
 * O mestre marca a região como armadilha/alarme, troca o tipo ou limpa
 * (`null`). Trocar o tipo mantém o id e o "revelado": é o mesmo gatilho.
 * Região que não existe, ou nada que mude, devolve o MESMO mapa — sem
 * entrada de histórico à toa.
 */
export function setRegionTrigger(map: MapData, regionId: string, kind: AreaTriggerKind | null, newId: () => string): MapData {
  if (triggerRegion(map, regionId) === null) return map
  const current = areaTriggerOfRegion(map, regionId)
  if ((current?.kind ?? null) === kind) return map
  const others = areaTriggersOf(map).filter((t) => t.regionId !== regionId)
  if (kind === null) return withAreaTriggers(map, others)
  const next: AreaTrigger = current === null ? { id: newId(), kind, regionId, revealed: false } : { ...current, kind }
  return withAreaTriggers(
    map,
    current === null ? [...others, next] : areaTriggersOf(map).map((t) => (t.regionId === regionId ? next : t)),
  )
}

/** "Mostrar aos jogadores": liga ou desliga. Sem gatilho, ou sem mudança, devolve o MESMO mapa. */
export function setRegionTriggerRevealed(map: MapData, regionId: string, revealed: boolean): MapData {
  const current = areaTriggerOfRegion(map, regionId)
  if (current === null || current.revealed === revealed) return map
  return withAreaTriggers(
    map,
    areaTriggersOf(map).map((t) => (t === current ? { ...t, revealed } : t)),
  )
}

/**
 * O gatilho como o JOGADOR o recebe (e como o desenho o pinta): só o tipo e o
 * polígono. Sem id do gatilho, sem id da região, sem nome da área.
 */
export interface PlayerAreaTrigger {
  kind: AreaTriggerKind
  points: RegionPoint[]
}

/** Gatilho com a região dele ainda no mapa. */
export function triggersWithRegions(map: Pick<MapData, 'gatilhos' | 'regions'>): { trigger: AreaTrigger; region: Region }[] {
  return areaTriggersOf(map).flatMap((trigger) => {
    const region = triggerRegion(map, trigger.regionId)
    return region === null ? [] : [{ trigger, region }]
  })
}

/** Tudo que o MESTRE vê marcado no editor: cada área de gatilho, com o tipo. */
export function areaTriggerAreas(map: Pick<MapData, 'gatilhos' | 'regions'>): PlayerAreaTrigger[] {
  return triggersWithRegions(map).map(({ trigger, region }) => ({ kind: trigger.kind, points: region.points }))
}

/** O nome da área no aviso do mestre: o da Sala, senão o rótulo da Região, senão o genérico. */
export function regionAreaName(region: Region): string {
  return region.room?.name.trim() || region.tag.trim() || UNNAMED_AREA
}

/** "Armadilha: Ana entrou em Corredor" (e a cena, quando não é a aberta no editor). */
export function areaTriggerEntryLine(playerName: string, kind: AreaTriggerKind, areaName: string, sceneName?: string): string {
  const line = `${AREA_TRIGGER_LABELS[kind]}: ${playerName} entrou em ${areaName}`
  return sceneName === undefined ? line : `${line} — ${sceneName}`
}

/** Ficha de jogador dentro de uma área de gatilho. */
export interface AreaTriggerEntry {
  tokenId: string
  triggerId: string
  kind: AreaTriggerKind
  regionId: string
}

/**
 * Uma leitura da cena: quem está dentro de qual gatilho, e o que existia na
 * leitura (gatilhos, fichas da cena, fichas de jogador). As listas é que
 * separam ENTRAR de "o mestre armou em cima" e de "a ficha acabou de ganhar dono".
 */
export interface AreaTriggerPresence {
  inside: ReadonlyMap<string, AreaTriggerEntry>
  triggerIds: ReadonlySet<string>
  sceneTokenIds: ReadonlySet<string>
  playerTokenIds: ReadonlySet<string>
}

/** Onde cada ficha da lista está agora. Só as fichas da lista — NPC na armadilha não avisa ninguém. */
export function areaTriggerPresence(map: Pick<MapData, 'gatilhos' | 'regions' | 'tokens'>, tokenIds: readonly string[]): AreaTriggerPresence {
  const wanted = new Set(tokenIds)
  const triggers = triggersWithRegions(map)
  const inside = new Map<string, AreaTriggerEntry>()
  const playerTokenIds = new Set<string>()
  for (const token of map.tokens) {
    if (!wanted.has(token.id)) continue
    playerTokenIds.add(token.id)
    for (const { trigger, region } of triggers) {
      // PISOS: passar por baixo da armadilha do andar de cima não é entrar nela.
      if (pisoDe(region) !== pisoDe(token) || !pointInRing({ x: token.x, y: token.y }, region.points)) continue
      inside.set(`${token.id}\n${trigger.id}`, { tokenId: token.id, triggerId: trigger.id, kind: trigger.kind, regionId: region.id })
    }
  }
  return {
    inside,
    triggerIds: new Set(triggers.map(({ trigger }) => trigger.id)),
    sceneTokenIds: new Set(map.tokens.map((t) => t.id)),
    playerTokenIds,
  }
}

/**
 * Quem ENTROU entre duas leituras: está dentro agora e não estava antes. NÃO
 * conta como entrada:
 * - a primeira leitura (`before` ausente): é a linha de base da sessão;
 * - gatilho que não existia antes: o mestre armou em cima de quem já estava lá;
 * - ficha que já estava na cena mas não era de jogador: o mestre acabou de dá-la a alguém.
 * Ficha que não estava na cena e chega já dentro (viagem) conta: ela entrou.
 */
export function newAreaTriggerEntries(before: AreaTriggerPresence | undefined, after: AreaTriggerPresence): AreaTriggerEntry[] {
  if (before === undefined) return []
  return [...after.inside]
    .filter(([key, entry]) => {
      if (before.inside.has(key) || !before.triggerIds.has(entry.triggerId)) return false
      return before.playerTokenIds.has(entry.tokenId) || !before.sceneTokenIds.has(entry.tokenId)
    })
    .map(([, entry]) => entry)
}

function isPoint(value: unknown): value is RegionPoint {
  return isRecord(value) && typeof value.x === 'number' && Number.isFinite(value.x) && typeof value.y === 'number' && Number.isFinite(value.y)
}

/** Teto de gatilhos por snapshot: o mestre é confiável, mas a tela não desenha lixo sem fim. */
export const MAX_PLAYER_AREA_TRIGGERS = 500
/** Teto de vértices por polígono, pelo mesmo motivo. */
export const MAX_AREA_TRIGGER_POINTS = 1000

/**
 * Valida `snapshot.gatilhos` no cliente do jogador. Forma errada devolve
 * `null`, e quem chama descarta a mensagem inteira — mesma regra dos outros
 * campos aditivos do snapshot (`parsePlayerHazards`).
 */
export function parsePlayerAreaTriggers(raw: unknown): PlayerAreaTrigger[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_PLAYER_AREA_TRIGGERS) return null
  const out: PlayerAreaTrigger[] = []
  for (const item of raw) {
    if (!isRecord(item) || !isAreaTriggerKind(item.kind)) return null
    const points = item.points
    if (!Array.isArray(points) || points.length > MAX_AREA_TRIGGER_POINTS || !points.every(isPoint)) return null
    out.push({ kind: item.kind, points: points.map((p) => ({ x: p.x, y: p.y })) })
  }
  return out
}
