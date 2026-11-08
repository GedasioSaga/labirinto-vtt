import type { CartaoDaFicha } from '../personagem'
import { ficha } from './fichasDaFatiaB.testkit'

/**
 * Conserto das fichas F2, fatia C: os cartões REAIS da Aira e do Alexei (ids,
 * ação, custo, tempo e dano copiados do rpg.json da pasta da mesa em 08/11;
 * descrições de fora) e os atributos e recursos reais, para os testes da lib
 * e da store. Só para teste.
 */

function cartao(id: string, nome: string, campos: Record<string, string>, extras: { nome: string; valor: string }[] = []): CartaoDaFicha {
  return { id, nome, campos, extras, atributos: [], imagem: null, modificadores: [], subcartoes: [] }
}

export const BENCAO = cartao('cart_369efcd2-19cf-400d-a0f0-c19ceebc0070', 'A Virtude Traz Benção', { acao: 'Completa', efeito: '-', custo: '-35 de SP', tempo: '1', dano: '-', tipo: 'Buff' })
export const DANCA = cartao(
  'cart_b49c9862-9fa4-48fb-9a6f-c39cffc919c4',
  'Em Meio às Alegres Nuvens',
  { acao: 'Completa', efeito: 'Alvo gira um teste cd12+modificador de carisma de Aira, caso falhe ele fica Atordoado podendo receber um golpe de oportunidade.', custo: '-15 Sp', tempo: '1', dano: '-', tipo: 'Debuff' },
  [{ nome: 'Concentração:', valor: 'Caso Aira se concentre 3 vezes, não é necessário rolar o teste, o Alvo fica atordoado automatico.' }],
)
export const LUZ_DO_SOL = cartao('cart_f95a0284-28f8-4265-96fe-bcd0906148a6', 'A Luz do Sol Brilha Sobre Todos', { acao: 'Completa', efeito: '-', custo: '-25 de SP', tempo: '2', dano: '40 de dano base + Espirito' }, [
  { nome: 'Imbuir Eletricidade', valor: 'Gasta 10SP para imbuir e da 20 a mais de dano eletrico' },
])

export const RIFLE = cartao('cart_b52c0be8-9d06-4cb8-a011-bd5c5578a3a1', 'Rifle', { categoria: 'De fogo', dano: '20', atributoDoAtaque: 'Percepção', acao: 'Simples' })
export const CACADA = cartao(
  'cart_64453d92-4278-4aeb-afed-483ab4ed972c',
  'A Caçada Começa',
  { acao: 'OVERLOAD | TRANSFORMAÇÃO', efeito: 'Por 5 Turnos, você pode atacar duas vezes.', custo: '200 Sp', tempo: 'OVERLOAD', dano: '-' },
  [{ nome: 'OVERLOAD', valor: 'Após o Fim da Tecnica, você reduz todos seus status pela metade.' }],
)

export const ATRIBUTOS_DA_AIRA = { forca: 1, agilidade: 34, percepcao: 5, resistencia: 50, intuicao: 4, espirito: 40, carisma: 55, determinacao: 16 }
export const ATRIBUTOS_DO_ALEXEI = { forca: 1, agilidade: 33, percepcao: 80, resistencia: 6, intuicao: 30, espirito: 50, carisma: 20, determinacao: 40 }

export const aira = ficha('Aira', ATRIBUTOS_DA_AIRA, { hp: 900, sp: 140, escudo: 100 }, { habilidades: [BENCAO, DANCA, LUZ_DO_SOL] })
/** O Alexei com HP 365 de 600 (a ficha real) e o Rifle de dano 20 (gravado pelo F0). */
export const alexei = { ...ficha('Alexei', ATRIBUTOS_DO_ALEXEI, { hp: 365, sp: 120, escudo: 12 }, { habilidades: [CACADA], armas: [RIFLE] }), maximos: { hp: 600, sp: 120 } }
