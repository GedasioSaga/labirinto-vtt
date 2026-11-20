/**
 * Os textos da tela do jogador no puzzle (os do protótipo aprovado,
 * `docs/design/puzzles/prototipo-v2.html`; a troca de peso, do v1). Puro: a
 * tela só escolhe onde mostrar.
 */
import { TEXTO_DO_CASTIGO_PADRAO } from '../../puzzles/padroes'
import { TEXTO_DA_RECUSA } from '../../puzzles/tipos'
import type { VistaDoPuzzle } from '../../puzzles/tipos'
import type { CastigoNaTela } from './tipos'

/** O tom do aviso: o neutro, o perigo (recusa, dano) e o latão (barulho, ganho). */
export type TomDoAviso = 'neutro' | 'perigo' | 'latao'

export interface AvisoDoPuzzle {
  texto: string
  tom: TomDoAviso
}

/** O título quando o mestre deixou o nome público vazio. */
export const TITULO_SEM_NOME = 'Mecanismo'

export const NOTA_DA_MOCHILA = 'Arraste a peça até um encaixe, ou toque nela e depois no encaixe. Tocar numa peça posta a devolve.'
export const ENCAIXE_VAZIO = 'Encaixe vazio. Escolha uma peça primeiro.'
export const BANDEJA_VAZIA = 'Bandeja vazia. Ponha pedras de peso marcado.'

/** "2 de 3 no lugar"; o destaque vai em negrito, como no v2. */
export function estadoDoPuzzle(vista: Pick<VistaDoPuzzle, 'versaoNova' | 'resolvido' | 'contagem' | 'troca'>): { destaque: string; resto: string } {
  if (vista.versaoNova === true) return { destaque: '', resto: TEXTO_DA_RECUSA.versao_nova }
  if (vista.resolvido) return { destaque: 'Resolvido.', resto: vista.contagem.total > 0 ? ' As peças ficaram presas.' : '' }
  if (vista.contagem.total === 0) return { destaque: '', resto: vista.troca !== null ? 'Ponha na bandeja o peso que o pedestal pede.' : 'Nada para encaixar aqui.' }
  return { destaque: `${vista.contagem.postos} de ${vista.contagem.total}`, resto: ' no lugar' }
}

/** O peso em traços, como o mostrador do v1 ("IIII"). */
function tracos(n: number): string {
  return n <= 0 ? '0' : 'I'.repeat(n)
}

/** Por que errou: a tranca da Ordem certa, ou o pedestal da Troca de peso. */
export function textoDoErro(em: 'ordem' | 'peso', soma: number, pedido: number): string {
  if (em === 'ordem') return 'A tranca não cede: a ordem está errada.'
  if (soma === 0) return 'Você tira a joia sem nada no lugar: o pedestal sobe de estalo.'
  return `O pedestal ${soma < pedido ? 'sobe' : 'afunda'}: ${tracos(soma)} não é ${tracos(pedido)}.`
}

/** O que o castigo fez, depois do motivo do erro. */
export function avisoDoErro(motivo: string, castigo: CastigoNaTela | null): AvisoDoPuzzle {
  if (castigo === null) return { texto: `${motivo} Nada acontece.`, tom: 'neutro' }
  const texto = castigo.texto.trim() !== '' ? castigo.texto.trim() : TEXTO_DO_CASTIGO_PADRAO[castigo.tipo]
  if (castigo.tipo === 'barulho') return { texto: `${motivo} ${texto}`, tom: 'latao' }
  const pv = castigo.pv > 0 ? `${semPontoFinal(texto)}: −${castigo.pv} PV.` : texto
  return { texto: `${motivo} ${pv}`, tom: 'perigo' }
}

function semPontoFinal(texto: string): string {
  return texto.endsWith('.') ? texto.slice(0, -1) : texto
}

/** "Medalhão do Sapo voltou para a sua mochila", ou para a de quem a pôs. */
export function textoDaDevolucao(nome: string, por: string, eu: string): string {
  return por === '' || por === eu ? `${nome} voltou para a sua mochila.` : `${nome} voltou para a mochila de ${por}.`
}
