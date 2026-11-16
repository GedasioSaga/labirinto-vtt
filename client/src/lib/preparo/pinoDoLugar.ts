import { CENARIO_PADRAO } from '../../cenario/catalogo'
import type { Pin } from '../../types/map'
import { isPlayerSafePinImage } from '../pins'

/**
 * O "!" DE UM LUGAR: o nome e o texto do verbete e, se a imagem pode ir ao
 * jogador (`isPlayerSafePinImage`: só data URL), a imagem com a animação do
 * cenário, que é o que faz o cartão do jogador mostrar a imagem com a
 * datilografia (`cenario/revelacao/doPino.ts`). Imagem que não pode ir não
 * entra, e sem imagem não há cenário. O recorte do jogador ainda segura nome,
 * texto e imagem até ele chegar perto para ler (`pinForPlayer`, lib/fogFilter.ts).
 */
export function pinoDoLugar(pin: Pin, lugar: { readonly nome: string; readonly texto: string; readonly imagem: string | null }): Pin {
  const base: Pin = { ...pin, kind: 'exclamacao', description: lugar.texto, image: null }
  delete base.cenario
  if (lugar.nome.trim() !== '') base.nome = lugar.nome.trim()
  if (!isPlayerSafePinImage(lugar.imagem)) return base
  return { ...base, image: lugar.imagem, cenario: { ...CENARIO_PADRAO } }
}
