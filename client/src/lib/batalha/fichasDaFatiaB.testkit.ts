import { novoPersonagem, type CartaoDaFicha, type Personagem } from '../personagem'
import { SISTEMA_ONE_PIECE } from '../sistemaOnePiece'

/**
 * Conserto das fichas F2, fatia B: os cartões REAIS do Jimboy Segundo e da
 * May D. Ark (ids, fórmulas, ação, custo e tempo copiados do rpg.json da
 * pasta da mesa em 08/11; descrições de fora) e os atributos reais, para os
 * testes da lib e da store. Só para teste.
 */

export const sistema = SISTEMA_ONE_PIECE

function cartao(id: string, nome: string, campos: Record<string, string>, extras: { nome: string; valor: string }[] = [], subcartoes: CartaoDaFicha[] = []): CartaoDaFicha {
  return { id, nome, campos, extras, atributos: [], imagem: null, modificadores: [], subcartoes }
}

export const QUEBRA_QUEIXO = cartao('cart_d8b7062c-b98f-41bb-97ac-05b65892f28f', 'Quebra-Queixo', { acao: 'Ação Simples', efeito: '-', custo: '-35', tempo: '3', dano: ' (Força + 40 de dano base) * 1,5' })
export const RAPID_DASH = cartao('cart_76fe44e8-629e-4e7c-b524-a1bbc7a85dd8', 'Rapid Dash', { acao: 'Completa', efeito: 'O segundo golpe é dano perfurante', custo: '-40 de Sp', tempo: '3', dano: 'Dano 1:  (20 de dano base + Força + Espírito)' }, [{ nome: 'Dano2', valor: '(Dano 1)/2' }])
export const SAI_DAI_RIN = cartao(
  'cart_7062c767-f138-47c3-9676-5695400b23d4',
  'Sai Dai Rin: Rokuogan',
  { acao: 'OVERLOAD', efeito: 'O Dano vai direto na vida e causa paralisia de 2 turnos no alvo.', custo: '-105', tempo: 'OVERLOAD', dano: '((Força + Espírito) * 1,5)*1,5 + 100', tipo: 'Debuff' },
  [{ nome: 'Tecnica Imcompleta', valor: 'Ao usar essa técnica você perde 200 de vida.' }],
)
export const HIBRIDO = { ...cartao('cart_36afecdf-5832-4904-a0a3-e2beeb2c72bd', 'NEKO NEKO NO MI Hibrido', { requisito: 'Gasta 5 SP por turno', grupo: 'Neko Neko no Mi' }, [], [SAI_DAI_RIN]), modificadores: [{ atributo: 'agilidade', delta: 15 }, { atributo: 'forca', delta: 25 }, { atributo: 'percepcao', delta: 5 }, { atributo: 'resistencia', delta: 25 }] }
export const FULL = { ...cartao('cart_d194229d-76b4-4ecd-aeab-75206c2da1ac', 'NEKO NEKO NO MI Full', { requisito: 'Gasta 10 SP por turno para manter a forma', grupo: 'Neko Neko no Mi', deslocamento: '+2' }, [], [RAPID_DASH]), modificadores: [{ atributo: 'agilidade', delta: 35 }, { atributo: 'forca', delta: 15 }, { atributo: 'percepcao', delta: 20 }, { atributo: 'resistencia', delta: 20 }] }

export const GRANDE_CHIFRE = cartao('cart_84d81561-cdae-48a3-9ef2-8467de918656', 'Grande Chifre', { acao: 'Ação Completa', efeito: 'Empurra o Inimigo, caso bata em alguma parede', custo: '40', tempo: '3' }, [
  { nome: 'Bloco 1', valor: '30 + Força' },
  { nome: 'Bloco 2', valor: 'Força/2' },
  { nome: 'Bloco 3', valor: 'Agilidade/2' },
])
export const LANCAMENTO = cartao('cart_4944b734-4018-42a0-abcc-17ff04e32da3', 'Lançamento de Chifre', { acao: 'Ação Completa', custo: '-30 de Sp', tempo: '2', dano: '20 + Força + Agilidade' })
export const APLAUSO = cartao('cart_39e23a9c-84c7-4270-821d-bdd7701c32d3', 'Aplauso do Deus do Trovão', { acao: 'OVERLOAD/REAÇÃO', custo: '60', tempo: 'OVERLOAD' }, [
  { nome: 'OVERLOAD', valor: 'Após usar você pede metade dos seus pontos.' },
  { nome: 'Ação', valor: 'Acerta todos em uma área de 6x6: Causando (Força + 100) * 2' },
  { nome: 'Reação', valor: 'Rebate qualquer técnica de projetil podendo ser Overload. Causando o Dano da Técnica Rebatida + Força' },
])

export const CORTA_CENOURA = cartao('cart_8d2a46e7-afa7-4b7a-bbaf-53ef36cb1669', 'Corta Cenoura', {
  acao: 'Ação Simples',
  efeito: 'Se o inimigo não conseguir defender na disputa ele fica stunado por 1 turno',
  custo: '-25',
  tempo: '2',
  dano: 'Força + 25 de dano base.',
  tipo: 'Debuff',
})
export const RECUPERACAO = cartao('cart_5e5eb2ee-f406-4fcc-a895-a87ad44ce3f0', 'Recuperação Espantosa', {
  efeito: 'Em certas situações de você desmaiar(ou outras situações que te deixaram incapacitado) em batalha, depois de poucos turnos(Depende do que causou) você recupera uma quantidade não fixa de vida e acorda podendo voltar para batalha ou fazer outra, contudo só funciona uma vez por batalha.',
})

/** A ficha com os números reais (Escudo junto) e só as abas pedidas. */
export function ficha(nome: string, atributos: Record<string, number>, recursos: { hp: number; sp: number; escudo: number }, abas: Record<string, CartaoDaFicha[]>, ativos: string[] = []): Personagem {
  const base = novoPersonagem(sistema, 'jogador', nome)
  return { ...base, atributos: { ...base.atributos, ...atributos }, recursos: { ...base.recursos, ...recursos }, maximos: { hp: recursos.hp, sp: recursos.sp }, abas: { ...base.abas, ...abas }, cartoesAtivos: ativos }
}

export const ATRIBUTOS_DO_JIMBOY = { forca: 20, agilidade: 20, percepcao: 10, resistencia: 40, intuicao: 10, espirito: 25, carisma: 20, determinacao: 45 }
export const ATRIBUTOS_DA_MAY = { forca: 70, agilidade: 33, percepcao: 1, resistencia: 36, intuicao: 1, espirito: 1, carisma: 38, determinacao: 80 }
export const jimboy = ficha('Jimboy Segundo', ATRIBUTOS_DO_JIMBOY, { hp: 1000, sp: 60, escudo: 80 }, { habilidades: [QUEBRA_QUEIXO, CORTA_CENOURA], transformacoes: [HIBRIDO, FULL] })
export const may = ficha('May D. Ark', ATRIBUTOS_DA_MAY, { hp: 700, sp: 60, escudo: 72 }, { habilidades: [GRANDE_CHIFRE, LANCAMENTO, APLAUSO], vantagens: [RECUPERACAO] })

