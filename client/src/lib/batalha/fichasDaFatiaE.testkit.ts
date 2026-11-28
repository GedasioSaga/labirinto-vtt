import type { CarriedItem } from '../../types/map'
import { pecasDoItemGuardadas } from '../itens/editorDoItem'
import type { RegraDaVaga } from '../itens/modelo'
import type { CartaoDaFicha, Personagem } from '../personagem'
import { CURA_REDUZIDA_PADRAO, NOME_DA_CURA_REDUZIDA } from './condicoes'
import { ficha } from './fichasDaFatiaB.testkit'
import { PREFIXO_DA_ARMA_DA_MOCHILA, PREFIXO_DA_MUNICAO } from './leituraDaFicha'

/**
 * Conserto das fichas F2, fatia E: os cartões REAIS da Ryoko D. Violet e do
 * Vincent G. (ids, ação, custo, tempo, dano, grupo e modificadores copiados do
 * rpg.json da pasta da mesa em 08/11; descrições de fora) e os atributos,
 * recursos, raça e id reais, para os testes da lib. Só para teste.
 */

function cartao(id: string, nome: string, campos: Record<string, string>, subcartoes: CartaoDaFicha[] = [], modificadores: CartaoDaFicha['modificadores'] = []): CartaoDaFicha {
  return { id, nome, campos, extras: [], atributos: [], imagem: null, modificadores, subcartoes }
}

const DOS_LADOS = (forca: number, resistencia: number): CartaoDaFicha['modificadores'] => [
  { atributo: 'agilidade', delta: 5 },
  { atributo: 'forca', delta: forca },
  { atributo: 'percepcao', delta: 5 },
  { atributo: 'resistencia', delta: resistencia },
]

export const CHUTE = cartao('cart_b0bc47ef-4a3e-4ccc-8650-8c26b823b5c6', 'Chute do Dragão', { acao: 'Simples', custo: '-10 SP', tempo: '2', dano: 'Força + 20 de Dano + 25 de Queimadura' })
export const CHIFRES = cartao('cart_bd88bb1b-2c2d-4b48-af1a-b50bd0009f03', 'Golpe de Chifres', { acao: 'Ação Completa', efeito: ' Perfura o Inimigo, da dano direto na vida.', custo: '35 de Sp', tempo: '3', dano: 'Força + 50 de dano' })
export const RECUPERACAO_DE_FORCAS = cartao('cart_f9a3ebf3-cc68-4892-9e90-75b3a1bdc947', 'Recuperação de forças (Passiva)', {
  acao: 'Simples/Reação',
  efeito: 'No caso de reação: (Anula o dano e 20% do dano que tomaria se torna vida), No caso de comer fora da batalha recupera tudo/grande parte',
  custo: '0',
  tempo: '2 vezes por combate',
  dano: '0',
  tipo: 'Reação',
})
const SOPRO = (id: string) => cartao(id, 'Sopro do Dragão', { acao: 'Completa', efeito: 'As chamas negras acertam Perfurante 50%.', custo: '-30 de SP', tempo: '4', dano: 'Espírito + 45 de dano base.' })
const FURIA = (id: string) => cartao(id, 'Fúria do Dragão', { acao: 'Completa', efeito: 'Você consegue evoluir seus poderes.', custo: '0 de SP', tempo: '1', dano: '0' })
export const SOPRO_1 = SOPRO('cart_dc17ce3b-139e-4a19-ae06-b53750c2706a')
export const FURIA_1 = FURIA('cart_d2b48141-2b42-474b-9003-27b40f38c174')
export const FURIA_3 = FURIA('cart_ba677726-fba0-439a-a35f-66fdea245a08')
export const PARTE_1 = cartao('cart_5b1f2e01-5ed4-4fb1-aa28-46b533b54521', 'Forma Hibrida(Parte 1)', { grupo: 'Forma Híbrida', requisito: 'Não gasta SP' }, [SOPRO_1, FURIA_1], DOS_LADOS(15, 10))
export const PARTE_2 = cartao(
  'cart_82959662-3d4b-4715-99e9-675856c1fcfa',
  'Forma Hibrida(Parte 2)',
  { grupo: 'Forma Híbrida', requisito: 'Gasta 10 SP por turno' },
  [SOPRO('cart_38cfcf69-e8d1-4565-95ae-a379a8a9fb5d'), FURIA('cart_7fa7e21f-8085-4410-95c7-9ca8dd03b8fb')],
  DOS_LADOS(20, 20),
)
export const PARTE_3 = cartao(
  'cart_8db149cc-a1e0-4c61-a064-8a4b836d7c12',
  'Forma Hibrida(Parte 3)',
  { grupo: 'Forma Híbrida', requisito: 'Gasta 20 SP por turno' },
  [SOPRO('cart_2a727d56-0629-4807-9355-b43a20cd73b2'), FURIA_3],
  // A ficha real traz também as linhas com 0 (HP, SP, CAR, DET, ESP, INT): a forma não dá HP.
  [...DOS_LADOS(40, 40), { atributo: 'hp', delta: 0 }, { atributo: 'sp', delta: 0 }, { atributo: 'espirito', delta: 0 }],
)

export const ID_DA_RYOKO = 'pers_7479adc1-5276-4b27-8adb-394f39463d58'
export const ATRIBUTOS_DA_RYOKO = { forca: 60, agilidade: 33, percepcao: 11, resistencia: 6, intuicao: 20, espirito: 35, carisma: 30, determinacao: 30 }

/** A Ryoko (Ogro, HP 700, SP 240, Escudo 12); `ativos` = as Partes ligadas. */
export function ryokoCom(ativos: string[] = [], recursos = { hp: 700, sp: 240, escudo: 12 }): Personagem {
  const base = ficha('Ryoko D. Violet', ATRIBUTOS_DA_RYOKO, recursos, { habilidades: [CHUTE, RECUPERACAO_DE_FORCAS, CHIFRES], transformacoes: [PARTE_1, PARTE_2, PARTE_3] }, ativos)
  return { ...base, id: ID_DA_RYOKO, escolhas: { raca: 'Ogro', oficio: 'Navegador' }, maximos: { hp: 700, sp: 240 } }
}

/** Outro ogro (um NPC qualquer): a raça vale nele sem a exceção da Ryoko. */
export function outroOgro(): Personagem {
  return { ...ficha('Ogro da Marinha', ATRIBUTOS_DA_RYOKO, { hp: 700, sp: 60, escudo: 0 }, {}), escolhas: { raca: 'Ogro' } }
}

export const OLHAR = { ...cartao('cart_45405a41-ce97-40e9-a891-347285dddcd6', 'Olhar artístico', { acao: 'Passiva', custo: 'Teste de Percepção Cd 15 ou Gastar 40 de SP', tipo: 'Passiva', efeito: 'Ao atingir inimigos com disparos de sua pistola, ao passar em um teste de percepção, Vincent pode realizar uma marca de tinta em seu alvo.' }) }
export const DESENHAR = cartao('cart_206aa17a-dc52-472b-adab-8cd4c71638b0', 'Desenhar o alvo', {
  acao: 'Simples',
  efeito: 'Atinge 1 inimigo e expõe um ponto vulnerável no alvo com uma marca de tinta. Dano Perfurante',
  custo: '30 Sp',
  tempo: '3',
  dano: 'Dano da Bala + Dano da Arma + Percepção',
  tipo: 'Debuff',
})
export const PASSO_DE_VALSA = cartao('cart_5ef11e05-c73e-4972-a432-9fc23a6641ef', 'Passo de Valsa', {
  acao: 'Reação',
  efeito: 'Ao ser alvo de um ataque corpo a corpo, Vincent realiza sua reação para esquivar e realizar uma marca de tinta contra o adversário.',
  custo: '35 Sp',
  tempo: '3',
  dano: '0',
  tipo: 'Reação',
})
export const BALA_DE_PRATA = cartao('cart_e41ee968-7a05-4591-a003-6900a6482e91', 'Bala de Prata', { dano: '+Percepção / 2', efeito: 'Cura pela metade: lembrete.' })
export const ROSA_FUNEBRE = cartao('cart_5d1de574-d982-4406-896f-62048d135b4a', 'Rosa Fúnebre', { dano: '20', acao: 'Ação Simples', categoria: 'De fogo', atributoDoAtaque: 'Percepção' }, [BALA_DE_PRATA])

export const ATRIBUTOS_DO_VINCENT = { forca: 10, agilidade: 35, percepcao: 35, resistencia: 10, intuicao: 30, espirito: 25, carisma: 35, determinacao: 23 }

/** O Vincent (Humano, HP 600, SP 60, Escudo 20, sem máximo de Escudo gravado). */
export function vincentCom(recursos = { hp: 600, sp: 60, escudo: 20 }): Personagem {
  const base = ficha('Vincent G.', ATRIBUTOS_DO_VINCENT, recursos, { habilidades: [OLHAR, DESENHAR, PASSO_DE_VALSA], armas: [ROSA_FUNEBRE] })
  return { ...base, id: 'pers_ab10bcaa-1d1f-465d-91a3-4c6638ef838c', escolhas: { raca: 'Humano', oficio: 'Artista' }, maximos: { hp: 600, sp: 60 } }
}

/**
 * ITENS REFEITOS (E6a e E6c): a Rosa Fúnebre e a Bala de Prata como o Vincent as tem hoje. A arma é a
 * vaga EQUIPADA da mochila (dano 20 + Percepção, pente de 10 que aceita a prata), e a bala é um item de
 * Munição. A regra mora na vaga (o Worker do Lobby e o jogador não têm o Acervo): "+Percepção / 2"
 * (o que a conversão lê do tipo de bala) e, ao acertar, a Cura reduzida 50% até o fim da batalha
 * (25/11/2026: no lugar do lembrete "Ferido por prata"). O cartão da aba Armas fica, mas não vale na batalha.
 */
export const ID_DA_PRATA = 'item_bala-de-prata'
export const VAGA_DA_ROSA = 'vaga_rosa'
export const VAGA_DA_PRATA = 'vaga_prata'
/** Os ids que a batalha usa no pedido: a arma da mochila e a bala do pente. */
export const ARMA_DA_ROSA = `${PREFIXO_DA_ARMA_DA_MOCHILA}${VAGA_DA_ROSA}`
export const BALA_DA_PRATA = `${PREFIXO_DA_MUNICAO}${ID_DA_PRATA}`
/** "Capacidade de 10 Balas", da descrição da Rosa Fúnebre real. */
export const CAPACIDADE_DA_ROSA = 10

export const REGRA_DA_PRATA: RegraDaVaga = {
  bala: { modo: 'atributo', valor: 0, atributo: 'Percepção', divisor: 2 },
  aoAcertar: pecasDoItemGuardadas([{ tipo: 'condicao', nome: NOME_DA_CURA_REDUZIDA, duracao: 'fim', n: CURA_REDUZIDA_PADRAO }], 'acerto'),
}

/** A Rosa Fúnebre equipada, com `noPente` Balas de Prata no pente (0 = pente vazio, sem o campo). */
export function rosaNaMochila(noPente: number): CarriedItem {
  return {
    id: VAGA_DA_ROSA,
    nome: ROSA_FUNEBRE.nome,
    itemId: 'item_rosa-funebre',
    tipo: 'fogo',
    equipado: true,
    ...(noPente > 0 ? { pente: { balaId: ID_DA_PRATA, n: noPente } } : {}),
    regra: { ataque: { dano: 20, soma: 'percepcao', acao: 'Ação Simples', alvos: 1 }, pente: { capacidade: CAPACIDADE_DA_ROSA, aceita: [ID_DA_PRATA], recarga: { acao: 'Ação Simples', rodadas: 0 } } },
  }
}

/** A pilha de `quantas` Balas de Prata fora do pente (a recarga tira dela). */
export function pratasNaMochila(quantas: number): CarriedItem {
  return { id: VAGA_DA_PRATA, nome: BALA_DE_PRATA.nome, itemId: ID_DA_PRATA, tipo: 'municao', categoria: 'Munição', empilhavel: true, ...(quantas > 1 ? { quantidade: quantas } : {}), regra: REGRA_DA_PRATA }
}

/** O Vincent de hoje: a Rosa com `noPente` no pente e `naMochila` Balas de Prata fora dele (0 = sem a pilha). */
export function vincentArmado(noPente = 6, naMochila = 4): Personagem {
  return { ...vincentCom(), mochila: [rosaNaMochila(noPente), ...(naMochila > 0 ? [pratasNaMochila(naMochila)] : [])] }
}
