import { isPlayerSafePinImage } from '../../lib/pins'
import type { Pin } from '../../types/map'
import type { QuandoToca } from '../catalogo'
import type { ImagemDoLocal } from './RevelacaoDoLocal'

/** O que a revelação do local mostra para um pino, e quando ela toca. */
export interface DadosDaRevelacao {
  imagem: ImagemDoLocal | null
  nome: string
  descricao: string
  quando: QuandoToca
}

/**
 * A revelação de um pino do recorte do jogador, ou `null` = só o cartão.
 *
 * - "!" com imagem: toca quando o mestre ligou a animação do cenário ("Só da
 *   primeira vez" ou "Sempre"); com "Não, só o cartão", continua só o cartão.
 * - "!" sem imagem (decisão do usuário, 09/10/2026): o painel sozinho, com o
 *   nome e a descrição, da primeira vez que o jogador abre o pino. Pino longe
 *   chega sem texto (`fogFilter.ts`) e não tem o que revelar.
 */
export function revelacaoDoPino(pino: Pin): DadosDaRevelacao | null {
  if (pino.kind !== 'exclamacao') return null
  // O nome é opcional no pino (mapa antigo, pino sem nome): ausente = sem título.
  const nome = (pino.nome ?? '').trim()
  const descricao = pino.description.trim()
  if (isPlayerSafePinImage(pino.image)) {
    if (pino.cenario === undefined) return null
    return { imagem: { src: pino.image, cenario: pino.cenario }, nome, descricao, quando: pino.cenario.quando }
  }
  if (nome === '' && descricao === '') return null
  // Pino de ITEM sem imagem é achado, não lugar: segue direto no cartão com
  // "Pegar", sem a revelação do local na frente (decisão de 09/10/2026).
  if (pino.item !== undefined) return null
  return { imagem: null, nome, descricao, quando: 'primeira' }
}
