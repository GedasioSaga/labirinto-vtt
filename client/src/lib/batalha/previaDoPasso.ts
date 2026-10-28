import type { MapData } from '../../types/map'
import type { Point } from '../../pixi/world'
import { validateTokenMove, type TokenMoveResult } from '../moveValidation'
import { paredesParaAndar } from '../barranco'
import { pisoDe } from '../pisos'

/** Dono de mentira da prévia: só a ficha que se arrasta é "dele". */
const QUEM_ARRASTA = 'previa'

/**
 * PRÉVIA DO PASSO EM BATALHA (B6), na tela do jogador: a MESMA conta que o
 * host faz (`validateTokenMove` → `passoEmBatalha`), rodando sobre o recorte
 * que o jogador recebeu — as paredes que ele conhece são as do host e as dele
 * ao mesmo tempo, e só ocupam casa as fichas que ele vê. Sem ida e volta pela
 * rede ("Decisão das paredes", opção D).
 *
 * Quando o menor caminho não encosta em parede fora do recorte, "N blocos"
 * aqui é o `blocos` do host. Quando encosta, vale o host: a ficha para antes
 * e a tela avisa o esbarrão, nunca troca o número em silêncio.
 */
export function previaDoPassoEmBatalha(recorte: MapData, tokenId: string, para: Point): TokenMoveResult {
  // BARRANCO: o que ele vê do barranco segura a prévia; o host usa todos (o esbarrão avisa a diferença).
  const ficha = recorte.tokens.find((t) => t.id === tokenId)
  const paredes = paredesParaAndar(recorte.walls, recorte, ficha === undefined ? 0 : pisoDe(ficha))
  return validateTokenMove(
    recorte,
    { playerId: QUEM_ARRASTA, tokenId, x: para.x, y: para.y },
    { [QUEM_ARRASTA]: [tokenId] },
    { occupants: recorte.tokens, batalha: { paredesDoJogador: paredes, comCaminho: true } },
  )
}
