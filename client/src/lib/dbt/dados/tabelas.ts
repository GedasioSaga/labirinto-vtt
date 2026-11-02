/**
 * Gerado por scripts/dbt/gerar-dados.cjs a partir de docs/fontes/dragon-ball-tales/.
 * Não editar à mão: mude o gerador (ou a fonte) e rode `node scripts/dbt/gerar-dados.cjs`.
 *
 * Tabelas do livro: estágios de dano por diferença de EP (Livro do Jogador 2.2.4 e 2.3.3),
 * vida por golpe do NPC (Livro do Narrador 4.0.2), atributos de PNJ (4.0.4) e escala de poder
 * do encontro e da campanha (4.0.3 e 2.2.1).
 * A linha -1 encurta o mínimo para 1 ponto e da linha -5 em diante o padrão muda: é o impresso.
 */
import type { CategoriaDeNpcDBT, TabelaVidaPorGolpe } from '../modelo'

/** Faixa de margem (resultado do ataque − CA); `ate` null = sem teto. */
export interface IntervaloDeMargemDBT {
  de: number
  ate: number | null
}

/** Uma linha da tabela de estágios por diferença de EP (2.3.3, p. 10-11). */
export interface LinhaDaEscalaDePoderDBT {
  /** Como impresso no livro: negativo (-1 a -10) = EP a favor do atacante. */
  difEp: number
  minimo: IntervaloDeMargemDBT
  medio: IntervaloDeMargemDBT
  completo: IntervaloDeMargemDBT
  /** As células como impressas ("2 a 4", "5 +"). */
  texto: { minimo: string; medio: string; completo: string }
}

/** Distribuição de atributos de PNJ por categoria (Livro do Narrador 4.0.4): boa prática, não regra rígida. */
export interface AtributosDePnjDBT {
  teto: number
  segundoAtributoMax: number | null
  demaisMin: number | null
  demaisMax: number | null
  /** Passar do teto: cada ponto acima tira `reduzirPorPonto` de outro atributo. */
  excedente: { acimaDe: number; reduzirPorPonto: number } | null
  texto: string[]
}

/** Ameaça do encontro pela diferença EP do PNJ − EP dos jogadores (Livro do Narrador 4.0.3, p. 18). */
export interface AmeacaPorDiferencaDeEpDBT {
  diferenca: string
  dificuldade: string
  texto: string
}

/** Sem diferença de EP (2.2.4): mínimo 1-2, médio 3-5, completo 6+. */
export const ESCALA_DE_PODER_SEM_DIFERENCA: LinhaDaEscalaDePoderDBT = {
  difEp: 0,
  minimo: {
    de: 1,
    ate: 2,
  },
  medio: {
    de: 3,
    ate: 5,
  },
  completo: {
    de: 6,
    ate: null,
  },
  texto: {
    minimo: '1 a 2',
    medio: '3 a 5',
    completo: '6+',
  },
}

export const TABELA_DA_ESCALA_DE_PODER: LinhaDaEscalaDePoderDBT[] = [
  {
    difEp: -1,
    minimo: {
      de: 1,
      ate: 1,
    },
    medio: {
      de: 2,
      ate: 4,
    },
    completo: {
      de: 5,
      ate: null,
    },
    texto: {
      minimo: '1',
      medio: '2 a 4',
      completo: '5 +',
    },
  },
  {
    difEp: -2,
    minimo: {
      de: 0,
      ate: 0,
    },
    medio: {
      de: 1,
      ate: 3,
    },
    completo: {
      de: 4,
      ate: null,
    },
    texto: {
      minimo: '0',
      medio: '1 a 3',
      completo: '4 +',
    },
  },
  {
    difEp: -3,
    minimo: {
      de: -1,
      ate: -1,
    },
    medio: {
      de: 0,
      ate: 2,
    },
    completo: {
      de: 3,
      ate: null,
    },
    texto: {
      minimo: '-1',
      medio: '0 a 2',
      completo: '3 +',
    },
  },
  {
    difEp: -4,
    minimo: {
      de: -2,
      ate: -2,
    },
    medio: {
      de: -1,
      ate: 1,
    },
    completo: {
      de: 2,
      ate: null,
    },
    texto: {
      minimo: '-2',
      medio: '-1 a 1',
      completo: '2 +',
    },
  },
  {
    difEp: -5,
    minimo: {
      de: -3,
      ate: -3,
    },
    medio: {
      de: -2,
      ate: -1,
    },
    completo: {
      de: 0,
      ate: null,
    },
    texto: {
      minimo: '-3',
      medio: '-2 a -1',
      completo: '0 +',
    },
  },
  {
    difEp: -6,
    minimo: {
      de: -4,
      ate: -4,
    },
    medio: {
      de: -3,
      ate: -2,
    },
    completo: {
      de: -1,
      ate: null,
    },
    texto: {
      minimo: '-4',
      medio: '-3 a -2',
      completo: '-1 +',
    },
  },
  {
    difEp: -7,
    minimo: {
      de: -5,
      ate: -5,
    },
    medio: {
      de: -4,
      ate: -3,
    },
    completo: {
      de: -2,
      ate: null,
    },
    texto: {
      minimo: '-5',
      medio: '-4 a -3',
      completo: '-2 +',
    },
  },
  {
    difEp: -8,
    minimo: {
      de: -6,
      ate: -6,
    },
    medio: {
      de: -5,
      ate: -4,
    },
    completo: {
      de: -3,
      ate: null,
    },
    texto: {
      minimo: '-6',
      medio: '-5 a -4',
      completo: '-3 +',
    },
  },
  {
    difEp: -9,
    minimo: {
      de: -7,
      ate: -7,
    },
    medio: {
      de: -6,
      ate: -5,
    },
    completo: {
      de: -4,
      ate: null,
    },
    texto: {
      minimo: '-7',
      medio: '-6 a -5',
      completo: '-4 +',
    },
  },
  {
    difEp: -10,
    minimo: {
      de: -8,
      ate: -8,
    },
    medio: {
      de: -7,
      ate: -6,
    },
    completo: {
      de: -5,
      ate: null,
    },
    texto: {
      minimo: '-8',
      medio: '-7 a -6',
      completo: '-5 +',
    },
  },
]

/** PV do NPC = ND × VIDA_POR_GOLPE[categoria][rank] (Livro do Narrador 4.0.2, p. 17-18). */
export const VIDA_POR_GOLPE: TabelaVidaPorGolpe = {
  comum: {
    E: 12,
    D: 26,
    C: 34,
    B: 44,
    A: 68,
    Z: 130,
  },
  elite: {
    E: 14,
    D: 32,
    C: 42,
    B: 58,
    A: 80,
    Z: 175,
  },
  chefao: {
    E: 20,
    D: 46,
    C: 58,
    B: 80,
    A: 124,
    Z: 234,
  },
}

export const ATRIBUTOS_DE_PNJ: Record<CategoriaDeNpcDBT, AtributosDePnjDBT> = {
  comum: {
    teto: 16,
    segundoAtributoMax: null,
    demaisMin: null,
    demaisMax: 12,
    excedente: {
      acimaDe: 16,
      reduzirPorPonto: 2,
    },
    texto: [
      'Máximo de 16 em um ou dois atributos.',
      'Restante entre 12 ou menos.',
      'Para cada ponto acima de 16, reduza 2 pontos de outro atributo.',
    ],
  },
  elite: {
    teto: 20,
    segundoAtributoMax: 16,
    demaisMin: 12,
    demaisMax: 14,
    excedente: {
      acimaDe: 20,
      reduzirPorPonto: 3,
    },
    texto: [
      'Podem ter até 20 em um atributo, 16 em outro.',
      'Restante entre 14 a 12.',
      'Para passar de 20, reduza 3 pontos de outro atributo por ponto acima.',
    ],
  },
  chefao: {
    teto: 30,
    segundoAtributoMax: null,
    demaisMin: null,
    demaisMax: null,
    excedente: null,
    texto: [
      'Podem chegar até 30 em um atributo.',
      'Sem limites fixos nos demais, mas use o bom senso narrativo.',
    ],
  },
}

export const AMEACA_POR_DIFERENCA_DE_EP: AmeacaPorDiferencaDeEpDBT[] = [
  {
    diferenca: '< 0',
    dificuldade: 'fácil',
    texto: 'Escala abaixo → Combate fácil.',
  },
  {
    diferenca: '0',
    dificuldade: 'equilibrado',
    texto: 'Escala igual → Combate equilibrado.',
  },
  {
    diferenca: '+1',
    dificuldade: 'difícil',
    texto: 'Escala +1 acima dos jogadores → Desafio difícil.',
  },
  {
    diferenca: '>= +2',
    dificuldade: 'mortal',
    texto: 'Escala +2 ou mais acima → Desafio mortal.',
  },
]

/** EP inicial sugerida da campanha (Livro do Narrador 2.2.1). */
export const EP_INICIAL_DE_CAMPANHA: { ep: string; uso: string }[] = [
  {
    ep: '0',
    uso: 'história mais humilde, ao estilo Dragon Ball Clássico',
  },
  {
    ep: '1 ou 2',
    uso: 'lutadores treinados, mestres de técnicas, veteranos de guerra ou filhos de deuses (o mais indicado)',
  },
  {
    ep: '3 ou mais',
    uso: 'nível de elite; reservar para personagens já consagrados ou risco planetário/intergaláctico imediato',
  },
]
