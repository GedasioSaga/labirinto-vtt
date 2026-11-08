// @vitest-environment node
/**
 * CONSERTO DAS FICHAS F1, fatia S2 (bug 6 de
 * docs/auditoria-fichas/00-bugs-do-sistema.md): o Salvar do jogador não
 * desfaz o que o mestre mudou na mesma aba (ou na lista de etiquetas) depois
 * que a edição abriu. As duas pontas de verdade: `mensagensDoSalvar` no
 * jogador e `aplicarPartesPelaBase` no host, com a base do host (a ficha que
 * ele mandou por último). Ficha inventada.
 */
import { describe, expect, it } from 'vitest'
import { novoCartao, novoPersonagem, type CartaoDaFicha, type Personagem } from '../lib/personagem'
import { SISTEMA_ONE_PIECE } from '../lib/sistemaOnePiece'
import { aplicarPartesPelaBase, mensagensDoSalvar } from './edicaoDoPersonagem'

const tecnica = (id: string, nome: string, campos: Record<string, string>): CartaoDaFicha => ({ ...novoCartao(nome), id, campos })

const NOVO = novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Coveiro')
const AO_ABRIR: Personagem = {
  ...NOVO,
  id: 'pers_coveiro',
  etiquetas: ['Pirata'],
  abas: { ...NOVO.abas, habilidades: [tecnica('tec_pazada', 'Pazada', { custo: '15 SP' }), tecnica('tec_giro', 'Giro de Pá', { custo: '20 SP', descricao: 'Gira a pá' })] },
}

const comCampo = (personagem: Personagem, cartaoId: string, campo: string, valor: string): Personagem => ({
  ...personagem,
  abas: { ...personagem.abas, habilidades: (personagem.abas.habilidades ?? []).map((cartao) => (cartao.id === cartaoId ? { ...cartao, campos: { ...cartao.campos, [campo]: valor } } : cartao)) },
})

/** O jogador salva; o host aplica cada pacote como faz com a base da conexão (= a ficha que mandou por último, `recebida`). */
function salvarNoHost(rascunho: Personagem, recebida: Personagem): Personagem {
  const pacote = mensagensDoSalvar(AO_ABRIR, rascunho, { novoReqId: () => 'p1', cabe: () => true }, recebida)
  if (!pacote.ok) throw new Error(pacote.erro)
  return pacote.mensagens.reduce((atual, mensagem) => (mensagem.type === 'personagem.editar' ? aplicarPartesPelaBase(recebida, atual, mensagem.partes) : atual), recebida)
}

const campoDe = (personagem: Personagem, cartaoId: string, campo: string): string | undefined => personagem.abas.habilidades?.find((cartao) => cartao.id === cartaoId)?.campos[campo]

describe('bug 6: o Salvar do jogador mescla pela ficha que a mesa mandou', () => {
  it('jogador abre a edição → mestre muda a Pazada de 15 para 25 SP → jogador muda a descrição do Giro de Pá e salva: Pazada fica 25 SP e a descrição entra', () => {
    const doMestre = comCampo(AO_ABRIR, 'tec_pazada', 'custo', '25 SP')
    const rascunho = comCampo(AO_ABRIR, 'tec_giro', 'descricao', 'Gira a pá em volta de si')

    const salvo = salvarNoHost(rascunho, doMestre)

    expect(campoDe(salvo, 'tec_pazada', 'custo')).toBe('25 SP')
    expect(campoDe(salvo, 'tec_giro', 'descricao')).toBe('Gira a pá em volta de si')
  })

  it('etiquetas: o mestre põe "Amaldiçoado" e o jogador "Médico" na mesma edição: ficam as duas', () => {
    const doMestre: Personagem = { ...AO_ABRIR, etiquetas: ['Pirata', 'Amaldiçoado'] }
    const rascunho: Personagem = { ...AO_ABRIR, etiquetas: ['Pirata', 'Médico'] }

    const salvo = salvarNoHost(rascunho, doMestre)

    expect([...salvo.etiquetas].sort()).toEqual(['Amaldiçoado', 'Médico', 'Pirata'])
  })
})
