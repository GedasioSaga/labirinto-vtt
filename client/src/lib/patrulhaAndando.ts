import type { Point } from '../pixi/world'
import type { MapData, ModoDaPatrulha, TokenPatrol } from '../types/map'
import { andarPeloTrajeto, TENTAR_DE_NOVO_MS, trajetoAte } from './andarPeloCaminho'
import { tokenPatrolOf, VELOCIDADE_PADRAO } from './npcPatrol'
import { PASSO_DA_ROTINA_MS, passoEmPx } from './rotinaAndando'

export { adiarEsperas } from './rotinaAndando'
export { TENTAR_DE_NOVO_MS } from './andarPeloCaminho'

/**
 * PATRULHA ANDANDO — "Patrulhar sozinha": ligada, a ficha anda pela própria
 * rota de patrulha (`lib/npcPatrol.ts`) casa a casa, como a rotina andando
 * (`lib/rotinaAndando.ts`), espera um pouco em cada ponto e segue, em circuito
 * (1-2-3-1) ou em vai-e-volta (1-2-3-2-1). Até o mestre tocar "Parar".
 *
 * O trecho até o ponto anda pelo caminho em grade, com a mesma regra da rotina
 * (`lib/andarPeloCaminho.ts`): contorna parede, passa por porta aberta, e sem
 * caminho a ficha NÃO pula — fica onde está e tenta de novo a cada
 * `TENTAR_DE_NOVO_MS`.
 *
 * Diferente da rotina, não depende de aventura nem de estado do mundo: a rota
 * é da ficha, na cena aberta. Por isso o agendador recebe só o MAPA aberto —
 * ficha que saiu dele (removida, cena trocada) para de patrulhar.
 *
 * Aqui só o agendador puro: quem anda, para onde e quando. Aplicar o passo é
 * do editor (`stores/patrulhaAndandoStore.ts`), fora do Ctrl+Z. Quem está
 * andando vive só na memória do editor: o arquivo guarda a rota e a
 * configuração, nunca "ligada" — o mapa reaberto volta com todo mundo parado.
 */

/** O mesmo tique da rotina: emenda no deslize de 240 ms do jogador. */
export const PASSO_DA_PATRULHA_MS = PASSO_DA_ROTINA_MS
/** Parada em cada ponto antes de seguir para o próximo. */
export const ESPERA_NO_PONTO_MS = 2000

/** A ficha com a patrulha ligada. */
export interface FichaPatrulhando {
  /** Índice, em `pontos`, do ponto para onde ela anda agora. */
  destino: number
  /** No vai-e-volta, para que lado da rota ela segue (1 = rumo ao último). No circuito, sempre 1. */
  sentido: 1 | -1
  /** Parada no ponto (ou à espera de caminho): não anda antes deste instante. */
  esperaAte: number
  /** Os cantos que faltam do trecho atual, o último é o ponto. Ausente: calcular no próximo passo. */
  trajeto?: readonly Point[]
}

/** Fichas com a patrulha ligada, por id. */
export type PatrulhasAndando = ReadonlyMap<string, FichaPatrulhando>

/** O passo de uma ficha, aplicado ao mapa por `moverPatrulhas`. */
export interface MovimentoDaPatrulha {
  tokenId: string
  x: number
  y: number
  /** Presente quando ela CHEGOU a um ponto: vira o `atual` da rota. */
  atual?: number
}

/**
 * Quanto a ficha espera ao chegar ao ponto `indice` da `rota`. Hoje, o mesmo
 * para todo ponto; quando cada ponto ganhar o próprio passo de macro, é aqui
 * (ou num substituto passado a `darPassoDaPatrulha`) que a espera do ponto entra.
 */
export type EsperaNoPonto = (rota: TokenPatrol, indice: number) => number

export const esperaNoPonto: EsperaNoPonto = () => ESPERA_NO_PONTO_MS

/** O ponto depois de `indice` na ordem da ronda, e o sentido em que se segue dele. */
export function proximoPonto(indice: number, sentido: 1 | -1, total: number, modo: ModoDaPatrulha): { indice: number; sentido: 1 | -1 } {
  if (total < 2) return { indice: 0, sentido: 1 }
  if (modo === 'circuito') return { indice: (indice + 1) % total, sentido: 1 }
  const seguinte = indice + sentido
  // Bateu na ponta: volta pelo mesmo caminho.
  if (seguinte < 0 || seguinte >= total) return { indice: indice - sentido, sentido: sentido === 1 ? -1 : 1 }
  return { indice: seguinte, sentido }
}

function modoDa(rota: TokenPatrol): ModoDaPatrulha {
  return rota.modo ?? 'circuito'
}

/** A rota de patrulha andável da ficha `tokenId` no mapa: com 2 pontos ou mais. */
function rotaAndavel(map: MapData, tokenId: string): { x: number; y: number; rota: TokenPatrol } | null {
  const token = map.tokens.find((t) => t.id === tokenId)
  const rota = token === undefined ? null : tokenPatrolOf(token)
  if (token === undefined || rota === null || rota.pontos.length < 2) return null
  return { x: token.x, y: token.y, rota }
}

/**
 * Liga a patrulha de `tokenId`. Em cima de um ponto da rota (o atual primeiro),
 * a ficha sai rumo ao seguinte; fora da rota (o mestre a arrastou), volta antes
 * ao ponto onde parou. Sem rota de 2 pontos, ou ficha fora do mapa: não liga.
 */
export function ligarPatrulha(andando: PatrulhasAndando, map: MapData, tokenId: string, now: number): PatrulhasAndando {
  const achada = rotaAndavel(map, tokenId)
  if (achada === null) return andando
  const { rota } = achada
  const emCima = (i: number) => rota.pontos[i]?.x === achada.x && rota.pontos[i]?.y === achada.y
  const aqui = emCima(rota.atual) ? rota.atual : rota.pontos.findIndex((_, i) => emCima(i))
  const rumo = aqui === -1 ? { indice: rota.atual, sentido: 1 as const } : proximoPonto(aqui, 1, rota.pontos.length, modoDa(rota))
  const next = new Map(andando)
  next.set(tokenId, { destino: rumo.indice, sentido: rumo.sentido, esperaAte: now })
  return next
}

export function desligarPatrulha(andando: PatrulhasAndando, tokenId: string): PatrulhasAndando {
  if (!andando.has(tokenId)) return andando
  const next = new Map(andando)
  next.delete(tokenId)
  return next
}

/**
 * Um tique do relógio: o passo de cada ficha com a patrulha ligada, rumo ao
 * ponto de destino, na velocidade da rota, pelo caminho em grade. Ao chegar, o
 * ponto vira o `atual` e a ficha espera `espera(rota, ponto)` antes de mirar o
 * seguinte.
 * - sem caminho até o ponto: não anda e procura de novo em `TENTAR_DE_NOVO_MS`;
 * - ficha em `paradas` (um jogador segura, o mestre arrasta) ou esperando: não anda;
 * - ficha que saiu do mapa, perdeu a rota ou ficou com menos de 2 pontos: para.
 */
export function darPassoDaPatrulha(
  map: MapData,
  andando: PatrulhasAndando,
  now: number,
  paradas: ReadonlySet<string> = new Set(),
  espera: EsperaNoPonto = esperaNoPonto,
): { movimentos: MovimentoDaPatrulha[]; andando: PatrulhasAndando } {
  const movimentos: MovimentoDaPatrulha[] = []
  const next = new Map<string, FichaPatrulhando>()
  for (const [tokenId, ficha] of andando) {
    const achada = rotaAndavel(map, tokenId)
    if (achada === null) continue
    if (paradas.has(tokenId) || now < ficha.esperaAte) {
      next.set(tokenId, ficha)
      continue
    }
    const { rota } = achada
    // Rota encurtada enquanto ela andava ("Tirar último ponto"): o destino volta para dentro.
    const destino = Math.min(ficha.destino, rota.pontos.length - 1)
    const ponto = rota.pontos[destino]
    if (ponto === undefined) continue
    const aqui = { x: achada.x, y: achada.y }
    const trajeto = trajetoAte(aqui, ponto, ficha.trajeto, map)
    if (trajeto === null) {
      // Sem caminho (porta fechada): parada onde está, sem pular, até a próxima tentativa.
      next.set(tokenId, { destino, sentido: ficha.sentido, esperaAte: now + TENTAR_DE_NOVO_MS })
      continue
    }
    const { para, resta } = andarPeloTrajeto(aqui, trajeto, passoEmPx(map.grid, rota.velocidade ?? VELOCIDADE_PADRAO))
    const chegou = resta.length === 0 && para.x === ponto.x && para.y === ponto.y
    const andou = para.x !== aqui.x || para.y !== aqui.y
    if (andou || (chegou && rota.atual !== destino)) {
      movimentos.push({ tokenId, x: para.x, y: para.y, ...(chegou ? { atual: destino } : {}) })
    }
    if (!chegou) {
      next.set(tokenId, { ...ficha, destino, trajeto: resta })
      continue
    }
    const seguinte = proximoPonto(destino, ficha.sentido, rota.pontos.length, modoDa(rota))
    next.set(tokenId, { destino: seguinte.indice, sentido: seguinte.sentido, esperaAte: now + espera(rota, destino) })
  }
  return { movimentos, andando: next }
}

/**
 * Os passos aplicados a um mapa: a ficha no lugar novo e, na chegada, o ponto
 * como `atual` da rota. Pura e reaplicável a qualquer versão do mapa (é o
 * `transform` de `applyPlayerChange`, que a repassa ao histórico): ponto que
 * não existe naquela versão não vira `atual`. Mesmo mapa quando nada muda.
 */
export function moverPatrulhas(map: MapData, movimentos: readonly MovimentoDaPatrulha[]): MapData {
  if (movimentos.length === 0) return map
  const porFicha = new Map(movimentos.map((m): [string, MovimentoDaPatrulha] => [m.tokenId, m]))
  let mudou = false
  const tokens = map.tokens.map((token) => {
    const m = porFicha.get(token.id)
    if (m === undefined) return token
    const rota = token.patrulha
    const novoAtual = m.atual !== undefined && rota !== undefined && m.atual < rota.pontos.length && m.atual !== rota.atual ? m.atual : undefined
    if (token.x === m.x && token.y === m.y && novoAtual === undefined) return token
    mudou = true
    return { ...token, x: m.x, y: m.y, ...(novoAtual === undefined || rota === undefined ? {} : { patrulha: { ...rota, atual: novoAtual } }) }
  })
  return mudou ? { ...map, tokens } : map
}
