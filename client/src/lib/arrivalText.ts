import type { MapData } from '../types/map'

/**
 * TEXTO DE CHEGADA DA CENA: o mestre escreve um texto curto na cena, e quem
 * CHEGA nela (viagem, escada, "Mandar para…", reunião, caravana) o lê uma vez
 * num cartão. Mora no mapa da cena (`MapData.textoChegada`) e NUNCA sai no
 * recorte do jogador (`lib/fogFilter.ts`): viaja só no `scene.changed` de quem
 * chega (`net/hostSession.ts`).
 */

/** Teto do texto, em unidades UTF-16 — o mesmo do recado: é um cartão, não uma carta. */
export const ARRIVAL_TEXT_MAX_LENGTH = 500

/**
 * O texto como a cena o guarda: pontas aparadas, cortado no teto sem partir um
 * emoji ao meio. Vazio, só espaço ou o que não é texto (arquivo editado à mão)
 * viram `undefined` — cena sem texto, igual a mapa antigo.
 */
export function readArrivalText(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const trimmed = raw.trim()
  if (trimmed.length === 0) return undefined
  if (trimmed.length <= ARRIVAL_TEXT_MAX_LENGTH) return trimmed
  const cut = trimmed.slice(0, ARRIVAL_TEXT_MAX_LENGTH)
  const last = cut.charCodeAt(cut.length - 1)
  // Surrogate alto sozinho no fim viraria um losango de erro na tela do jogador.
  const whole = last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut
  return whole.trimEnd()
}

/**
 * O texto que o jogador aceita no `scene.changed`. Diferente de
 * `readArrivalText`, texto acima do teto é RECUSADO em vez de cortado (mesma
 * regra do recado): o host já manda cortado, e um pedaço seria outro texto.
 */
export function parseArrivalText(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > ARRIVAL_TEXT_MAX_LENGTH) return null
  return raw.trim().length === 0 ? null : raw
}

/**
 * Grava o texto na cena. Apagar tira o campo (a cena volta igual a mapa sem
 * texto); o mesmo texto devolve o MESMO mapa, para não virar passo do desfazer.
 */
export function setArrivalText(map: MapData, raw: string): MapData {
  const text = readArrivalText(raw)
  if (text === map.textoChegada) return map
  if (text !== undefined) return { ...map, textoChegada: text }
  const { textoChegada: _apagado, ...rest } = map
  return rest
}
