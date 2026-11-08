import type { CartaoDaFicha } from '../personagem'
import { ficha } from './fichasDaFatiaB.testkit'

/**
 * Conserto das fichas F2, fatia D: os cartões REAIS do Vagn Kane e do
 * Guilherme (ids, ação, custo, tempo, dano e campos das formas copiados do
 * rpg.json da pasta da mesa em 08/11; descrições de fora) e os atributos e
 * recursos reais, para os testes da lib. Só para teste.
 */

function cartao(id: string, nome: string, campos: Record<string, string>, extras: { nome: string; valor: string }[] = []): CartaoDaFicha {
  return { id, nome, campos, extras, atributos: [], imagem: null, modificadores: [], subcartoes: [] }
}

export const PROJECAO = cartao('cart_d50ef507-dd18-4566-8015-94910a12136e', 'Projeção Letal', { acao: 'Ação Simples', custo: '-20 de SP', tempo: '1', dano: 'ESPÍRITO + 20 de dano base.' }, [
  { nome: 'Imbuir Fogo', valor: 'Sim' },
  { nome: 'Nível de Polaridade', valor: '1' },
])
export const ARMADURA = cartao('cart_06d82bee-8643-4b48-b43f-462d58a12dfe', 'Armadura Humana LVL 1:', {
  descricao: 'Passivo: O usuário será capaz de absorver uma parcela do dano recebido e escolher absorver e diminuir o dano ou absorver e devolver o dano.',
  acao: 'Reação/Completa',
  custo: '25',
  tempo: '4',
  dano: '-',
  efeito: 'Absorve o dano.',
})
export const CAMPO = cartao('cart_9de30283-6314-44ae-bfd3-a7539c0b17de', 'Campo de Contenção', { acao: 'Ação Completa', custo: '-15 (Por turno)', tempo: '2', dano: '0' })
export const IGNICAO = cartao('cart_8ea9d2d5-f1ac-4d11-9a55-0feb66c75415', 'Ignição', { acao: 'Livre', grupo: 'Lunariano', deslocamento: '+2', ataquesExtras: '1', usos: '2' })
export const RESILIENTE = cartao('cart_e4c8dec3-5e5e-4cae-83d7-377d382e856a', 'Resiliente', { acao: 'Livre', grupo: 'Lunariano', danoRecebido: '-20%', deslocamento: 'máx 6' })

export const GIRO = cartao(
  'cart_4a5b6f4f-87d3-49f5-aafa-0bfd5973c2ca',
  'Giro da Lança',
  { acao: 'Reação/Ação Completa', efeito: 'Todos os alvos em um raio de 1 quadrado a sua volta.', custo: '30', tempo: '3', dano: 'Força + Dano da Arma + 20' },
  [{ nome: 'Reação', valor: 'Ao usar como reação, você rola 1d20 de reação +Modificador de Força/Agilidade (o maior). Sucesso anula o dano e permite manter o giro como uma ação contínua enquanto durar o SP.' }],
)
export const KMH = cartao('cart_774733ae-0a20-40cc-b838-0cf1d1bd58df', '10.000 Km/h', { acao: 'OVERLOAD', custo: '100', tempo: 'OVERLOAD', dano: '(Força + Percepção + Espirito + 100) + Dano da Arma ', tipo: 'Debuff' })
export const REVIGORAR = cartao('cart_f566bafe-6d3b-4836-aa93-12969ff5788d', 'Revigorar', { acao: 'Completa', efeito: 'Remove Debuff + Recupera Vida Igual ao Espirito', custo: '-50', tempo: '2 Vezes por Combate', dano: '-' })
export const EXPLOSAO = cartao('cart_14ed4fb4-817c-41ea-a417-517ece9782ed', 'Explosão', { acao: 'Ação Completa', efeito: 'Dobra os Debuffs que ele possui na hora', custo: '40', tempo: '2 Vezes por Combate', dano: '10% de Vida Atual do Alvo' }, [
  { nome: 'Teste de Resistência', valor: 'Cd10 + Modificador de Espirito' },
])
export const LANCA = cartao('cart_c1b88a3f-272a-442e-874e-6a14778c6851', 'Lança', { dano: '20', categoria: 'Branca' })

export const ATRIBUTOS_DO_VAGN = { forca: 50, agilidade: 0, percepcao: 0, resistencia: 50, intuicao: 30, espirito: 35, carisma: 0, determinacao: 40 }
export const ATRIBUTOS_DO_GUILHERME = { forca: 90, agilidade: 5, percepcao: 5, resistencia: 40, intuicao: 5, espirito: 100, carisma: 5, determinacao: 5 }

/** O Vagn (HP 1000, SP 120, Escudo 100); `ativos` = as formas ligadas. */
export function vagnCom(ativos: string[] = []) {
  return ficha('Vagn Kane', ATRIBUTOS_DO_VAGN, { hp: 1000, sp: 120, escudo: 100 }, { habilidades: [PROJECAO, CAMPO, ARMADURA], transformacoes: [IGNICAO, RESILIENTE] }, ativos)
}
/** O Guilherme com HP 900 de 1100 e SP 65 de 200 (a ficha real) e a Lança de dano 20 (gravada pelo F0). */
export const guilherme = { ...ficha('Guilherme', ATRIBUTOS_DO_GUILHERME, { hp: 900, sp: 65, escudo: 80 }, { habilidades: [GIRO, KMH, REVIGORAR, EXPLOSAO], armas: [LANCA] }), maximos: { hp: 1100, sp: 200 } }
