import type { MapData, PostoDaRotina, RotinaDoNpc, Token } from '../types/map'

/**
 * ROTINA DO NPC — cada ficha tem um posto por turno, até em outra cena, e ao
 * tocar o apito todas vão para o posto de uma vez. O "apito" é um ESTADO DO
 * MUNDO ("Apito: Aurora, Meio, Brasa, Sombra"): trocar o valor dele é tocar o
 * apito (`useAdventureStore.trocarEstadoDoMundo`). Plano:
 * `docs/planos/rotina-do-npc-p.md`.
 *
 * Aqui só o que é puro: planejar quem vai para onde, mover dentro da cena,
 * gravar/tirar posto e ler do disco. Trocar de cena é do `transferToken`.
 */

/** Uma cena carregada, com o id dela na aventura. */
export interface CenaDaRotina {
  sceneId: string
  map: MapData
}

/** Uma ficha indo ao posto: `de` e `para` são ids de cena; iguais = anda dentro da cena. */
export interface MovimentoDaRotina {
  tokenId: string
  de: string
  para: string
  x: number
  y: number
}

/** O posto da rotina para `valor` do estado `estadoId`, ou `undefined` quando a rotina não fala dele. */
function postoPara(rotina: RotinaDoNpc | undefined, estadoId: string, valor: string): PostoDaRotina | undefined {
  if (rotina === undefined || rotina.estadoId !== estadoId) return undefined
  return rotina.postos.find((posto) => posto.valor === valor)
}

/**
 * Quem anda quando `estadoId` vira `valor`. Fica de fora: ficha sem posto
 * nesse valor, ficha já no posto, ficha em `fixas` (a que um jogador segura) e
 * posto numa cena que não está em `cenas` (fora do ar) — a ficha não pode
 * sumir de um mapa para não chegar em outro.
 */
export function planejarRotina(
  cenas: readonly CenaDaRotina[],
  estadoId: string,
  valor: string,
  fixas: ReadonlySet<string> = new Set(),
): MovimentoDaRotina[] {
  const carregadas = new Set(cenas.map((cena) => cena.sceneId))
  const vistas = new Set<string>()
  const movimentos: MovimentoDaRotina[] = []
  for (const cena of cenas) {
    for (const token of cena.map.tokens) {
      // Ficha repetida em duas cenas (arquivo editado à mão): só a primeira anda.
      if (vistas.has(token.id)) continue
      vistas.add(token.id)
      if (fixas.has(token.id)) continue
      const posto = postoPara(token.rotina, estadoId, valor)
      if (posto === undefined || !carregadas.has(posto.sceneId)) continue
      if (posto.sceneId === cena.sceneId && posto.x === token.x && posto.y === token.y) continue
      movimentos.push({ tokenId: token.id, de: cena.sceneId, para: posto.sceneId, x: posto.x, y: posto.y })
    }
  }
  return movimentos
}

/**
 * O mapa com cada movimento DENTRO da cena aplicado (`de === para`). Devolve o
 * MESMO mapa quando nenhuma ficha dele anda. Pura e válida para qualquer
 * versão do mapa: serve de `transform` para `applyPlayerChange`, que a
 * reaplica no histórico do desfazer.
 */
export function moverNaCena(map: MapData, movimentos: readonly MovimentoDaRotina[]): MapData {
  const destino = new Map(movimentos.filter((m) => m.de === m.para).map((m): [string, MovimentoDaRotina] => [m.tokenId, m]))
  if (destino.size === 0) return map
  let mudou = false
  const tokens = map.tokens.map((token) => {
    const m = destino.get(token.id)
    if (m === undefined || (token.x === m.x && token.y === m.y)) return token
    mudou = true
    return { ...token, x: m.x, y: m.y }
  })
  return mudou ? { ...map, tokens } : map
}

/** A rotina com `posto` no lugar do posto do mesmo valor (valor novo vai para o fim). */
export function gravarPosto(rotina: RotinaDoNpc, posto: PostoDaRotina): RotinaDoNpc {
  if (!rotina.postos.some((p) => p.valor === posto.valor)) return { ...rotina, postos: [...rotina.postos, posto] }
  return { ...rotina, postos: rotina.postos.map((p) => (p.valor === posto.valor ? posto : p)) }
}

/** A rotina sem o posto de `valor`: naquele turno a ficha passa a ficar onde está. */
export function tirarPosto(rotina: RotinaDoNpc, valor: string): RotinaDoNpc {
  return { ...rotina, postos: rotina.postos.filter((p) => p.valor !== valor) }
}

/** A ficha com `rotina`; `undefined` grava a ficha sem a chave, como ficha de antes do campo. */
export function comRotina(token: Token, rotina: RotinaDoNpc | undefined): Token {
  if (rotina !== undefined) return { ...token, rotina }
  if (!('rotina' in token)) return token
  const { rotina: _tirada, ...semRotina } = token
  return semRotina
}

// ───────────────────────────────────────────────────────────────────────────
// Leitura do disco (arquivo editado à mão, versão futura)
// ───────────────────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function numeroFinito(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function postoDoArquivo(raw: unknown): PostoDaRotina | null {
  if (!isRecord(raw)) return null
  const { valor, sceneId, x, y } = raw
  if (typeof valor !== 'string' || typeof sceneId !== 'string' || sceneId.length === 0) return null
  if (!numeroFinito(x) || !numeroFinito(y)) return null
  return { valor, sceneId, x, y }
}

/**
 * A rotina lida do disco. Sem `estadoId` de texto ou sem nenhum posto bom:
 * `undefined` (a ficha volta a ser a de sempre). Posto torto e valor repetido
 * saem; os bons ficam.
 */
export function rotinaDoArquivo(raw: unknown): RotinaDoNpc | undefined {
  if (!isRecord(raw)) return undefined
  const { estadoId, postos } = raw
  if (typeof estadoId !== 'string' || estadoId.length === 0 || !Array.isArray(postos)) return undefined
  const bons: PostoDaRotina[] = []
  for (const bruto of postos) {
    const posto = postoDoArquivo(bruto)
    if (posto !== null && !bons.some((b) => b.valor === posto.valor)) bons.push(posto)
  }
  return bons.length === 0 ? undefined : { estadoId, postos: bons }
}

/** Ficha lida do disco: só a rotina passa por conferência; ausente continua ausente. */
export function fichaComRotinaDoArquivo(token: Token): Token {
  if (!('rotina' in token)) return token
  return comRotina(token, rotinaDoArquivo(token.rotina))
}
