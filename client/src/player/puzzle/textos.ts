/**
 * Os textos da tela do jogador no puzzle (os do protótipo aprovado,
 * `docs/design/puzzles/prototipo-v2.html`; a troca de peso, do v1). Puro: a
 * tela só escolhe onde mostrar.
 */
import { TEXTO_DO_CASTIGO_PADRAO } from '../../puzzles/padroes'
import { TEXTO_DA_RECUSA } from '../../puzzles/tipos'
import type { VistaDoPuzzle } from '../../puzzles/tipos'
import type { CastigoNaTela, ErroNaTela } from './tipos'

/** O tom do aviso: o neutro, o perigo (recusa, dano) e o latão (barulho, ganho). */
export type TomDoAviso = 'neutro' | 'perigo' | 'latao'

export interface AvisoDoPuzzle {
  texto: string
  tom: TomDoAviso
}

/** O título quando o mestre deixou o nome público vazio. */
export const TITULO_SEM_NOME = 'Mecanismo'

export const NOTA_DA_MOCHILA = 'Arraste a peça até um encaixe, ou toque nela e depois no encaixe. Tocar numa peça posta a devolve.'

/** No teste (P9), a mochila é de mentira: as peças certas e duas que não servem (v2). */
export const TITULO_DAS_PECAS_DO_TESTE = 'Peças do teste'
export const NOTA_DAS_PECAS_DO_TESTE = 'As peças certas e duas que não servem. Arraste até um encaixe, ou toque na peça e depois no encaixe.'
export const FAIXA_DO_TESTE = 'Você vê o puzzle como o jogador. Nenhuma peça é gasta e o desfecho não é entregue a ninguém.'
/** O fim do aviso do castigo no teste: a tela pisca e treme, e nada desce de verdade. */
const FIM_DO_CASTIGO_NO_TESTE = ' (No teste, nada acontece de verdade.)'
export const ENCAIXE_VAZIO = 'Encaixe vazio. Escolha uma peça primeiro.'
export const BANDEJA_VAZIA = 'Bandeja vazia. Ponha pedras de peso marcado.'

/** "2 de 3 no lugar"; o destaque vai em negrito, como no v2 (`rotuloEstado`, também o da combinação). */
export function estadoDoPuzzle(vista: Pick<VistaDoPuzzle, 'versaoNova' | 'resolvido' | 'contagem' | 'troca' | 'combinacao' | 'giratorias' | 'interruptores'>, teste = false): { destaque: string; resto: string } {
  if (vista.versaoNova === true) return { destaque: '', resto: TEXTO_DA_RECUSA.versao_nova }
  if (vista.resolvido) return { destaque: teste ? 'Resolvido no teste.' : 'Resolvido.', resto: vista.contagem.total > 0 ? ' As peças ficaram presas.' : '' }
  // As peças giratórias não contam quantos anéis estão no lugar: seria a resposta pela metade.
  if (vista.giratorias !== undefined) {
    const como = vista.giratorias.desenho === 'simbolos' ? 'até os símbolos certos ficarem sob a marca' : 'até o desenho fechar'
    return { destaque: '', resto: `Gire os anéis ${como}.${vista.giratorias.vizinhas ? ' Cada anel leva os do lado.' : ''}` }
  }
  // Os interruptores também não contam quantos estão certos: o jogador vê os lampiões.
  const interruptores = vista.interruptores
  if (interruptores !== undefined) {
    if (interruptores.objetivo === 'todas') return { destaque: '', resto: 'Puxe as alavancas até todos os lampiões acenderem.' }
    return { destaque: '', resto: interruptores.desenho !== null ? 'Puxe as alavancas até os lampiões ficarem como na plaqueta.' : 'Puxe as alavancas até os lampiões ficarem como a pista pede.' }
  }
  const combinacao = vista.combinacao
  if (combinacao !== undefined) {
    if (combinacao.forma === 'relogio') return { destaque: '', resto: 'Acerte os ponteiros e tente.' }
    if (combinacao.forma === 'botoes') return { destaque: `${combinacao.certos} de ${combinacao.total}`, resto: ' na sequência' }
    return { destaque: '', resto: 'Gire as rodas e tente abrir.' }
  }
  if (vista.contagem.total === 0) return { destaque: '', resto: vista.troca !== null ? 'Ponha na bandeja o peso que o pedestal pede.' : 'Nada para encaixar aqui.' }
  return { destaque: `${vista.contagem.postos} de ${vista.contagem.total}`, resto: ' no lugar' }
}

/** O peso em traços, como o mostrador do v1 ("IIII"). */
function tracos(n: number): string {
  return n <= 0 ? '0' : 'I'.repeat(n)
}

/** Por que errou: a tranca da Ordem certa, o pedestal da Troca de peso, ou a combinação (os textos do v2). */
export function textoDoErro(em: ErroNaTela, soma: number, pedido: number): string {
  if (em === 'ordem') return 'A tranca não cede: a ordem está errada.'
  if (em === 'combinacao') return 'A trava não cede.'
  if (em === 'hora') return 'Os ponteiros voltam a tremer: não é essa hora.'
  if (em === 'sequencia') return 'Os botões voltam para cima: a sequência recomeça.'
  if (soma === 0) return 'Você tira a joia sem nada no lugar: o pedestal sobe de estalo.'
  return `O pedestal ${soma < pedido ? 'sobe' : 'afunda'}: ${tracos(soma)} não é ${tracos(pedido)}.`
}

/** O que o castigo fez, depois do motivo do erro. */
export function avisoDoErro(motivo: string, castigo: CastigoNaTela | null, teste = false): AvisoDoPuzzle {
  if (castigo === null) return { texto: `${motivo} Nada acontece.`, tom: 'neutro' }
  const texto = castigo.texto.trim() !== '' ? castigo.texto.trim() : TEXTO_DO_CASTIGO_PADRAO[castigo.tipo]
  const fim = teste ? FIM_DO_CASTIGO_NO_TESTE : ''
  if (castigo.tipo === 'barulho') return { texto: `${motivo} ${texto}${fim}`, tom: 'latao' }
  const pv = castigo.pv > 0 ? `${semPontoFinal(texto)}: −${castigo.pv} PV.` : texto
  return { texto: `${motivo} ${pv}${fim}`, tom: 'perigo' }
}

function semPontoFinal(texto: string): string {
  return texto.endsWith('.') ? texto.slice(0, -1) : texto
}

/** "Medalhão do Sapo voltou para a sua mochila", ou para a de quem a pôs. */
export function textoDaDevolucao(nome: string, por: string, eu: string, teste = false): string {
  if (teste) return `${nome} voltou para as peças do teste.`
  return por === '' || por === eu ? `${nome} voltou para a sua mochila.` : `${nome} voltou para a mochila de ${por}.`
}
