import type { Region } from '../types/map'

/**
 * PORTAS POR ATRAVESSAR — a porta que o jogador conhece e cujo outro lado ainda
 * está na névoa para ele ganha um ponto claro no mapa dele, e o prédio mostra
 * quantos cômodos ele já viu lá dentro.
 *
 * Quem decide a marca é o host, no recorte (`lib/fogFilter.ts`,
 * `PlayerMapView.portasPorAtravessar`): só porta que saiu no recorte, e o
 * "outro lado conhecido" usa só o que o jogador já tem (visão, explorado,
 * cômodo lembrado). A contagem do prédio sai do PRÓPRIO recorte que chegou
 * (`contarComodosConhecidos`): o que não veio — sala secreta, cômodo não visto,
 * nome oculto — não tem como entrar na conta.
 */

/** Teto de ids por snapshot: o host corta antes de mandar, e mais que isso é mensagem forjada. */
export const MAX_PORTAS_POR_ATRAVESSAR = 4000
/** Mesmo teto de id do protocolo (`REQ_ID_MAX_LENGTH`, `net/protocol.ts`). */
const ID_MAX_LENGTH = 64

/** Id que pode ir no fio: o host deixa de fora o que o jogador recusaria (e derrubaria o snapshot inteiro). */
export function idDePortaCabeNoFio(id: string): boolean {
  return id.length >= 1 && id.length <= ID_MAX_LENGTH
}

/** `snapshot.porAtravessar` como chegou do fio. `null` = forma errada (descarta a mensagem, como os outros campos aditivos). */
export function lerPortasPorAtravessar(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_PORTAS_POR_ATRAVESSAR) return null
  const ids: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string' || !idDePortaCabeNoFio(item)) return null
    ids.push(item)
  }
  return ids
}

/** Sala que conta: tem `room` e chegou com nome (nome oculto chega vazio, e cômodo de nome oculto não entra). */
function salaComNome(region: Region): boolean {
  return region.room !== undefined && region.room.name.trim() !== ''
}

/**
 * Prédio → quantos cômodos dele o jogador conhece. Prédio é a Sala COM NOME de
 * mais fora que chegou no recorte (sem mãe no recorte); cômodo é toda Sala com
 * nome que desce dele pela corrente de `parentId` — netos inclusive. A corrente
 * anda só por Salas que chegaram: mãe que não veio encerra a conta ali, e o
 * cômodo órfão não conta em ninguém. Prédio sem cômodo conhecido fica de fora.
 */
export function contarComodosConhecidos(regions: readonly Region[]): Map<string, number> {
  const porId = new Map(regions.map((r) => [r.id, r]))
  const contagem = new Map<string, number>()
  for (const region of regions) {
    if (!salaComNome(region)) continue
    const predio = predioDe(region, porId)
    if (predio === null) continue
    contagem.set(predio.id, (contagem.get(predio.id) ?? 0) + 1)
  }
  return contagem
}

/** O prédio (Sala de mais fora, com nome) de um cômodo; `null` se ele mesmo é o de fora ou se a corrente quebra. */
function predioDe(comodo: Region, porId: ReadonlyMap<string, Region>): Region | null {
  const visitados = new Set<string>([comodo.id])
  let atual = comodo
  while (atual.parentId !== undefined) {
    const mae = porId.get(atual.parentId)
    // Mãe fora do recorte: a corrente para, e o jogador não fica sabendo de quem ela é filha.
    if (mae === undefined || visitados.has(mae.id)) return null
    visitados.add(mae.id)
    atual = mae
  }
  if (atual === comodo || !salaComNome(atual)) return null
  return atual
}

/** "Albergue · 3 cômodos vistos". */
export function rotuloComContagem(name: string, n: number): string {
  return n === 1 ? `${name} · 1 cômodo visto` : `${name} · ${n} cômodos vistos`
}

/**
 * As Salas com o rótulo que a TELA desenha: o prédio com a contagem. Sem prédio
 * nenhum a mesma lista volta, para os caches de desenho não refazerem nada.
 */
export function regioesComContagem(regions: Region[]): Region[] {
  const contagem = contarComodosConhecidos(regions)
  if (contagem.size === 0) return regions
  return regions.map((r) => {
    const n = contagem.get(r.id)
    if (n === undefined || r.room === undefined) return r
    return { ...r, room: { ...r.room, name: rotuloComContagem(r.room.name, n) } }
  })
}
