/**
 * NPC do Dragon Ball Tales: PV pelo ND (Livro do Narrador 4.0.2) e a conversão
 * de um NPC pronto (o bloco do Mirio Jo, Enma Daioh p. 4-7) em ficha.
 */
import { describe, expect, it } from 'vitest'
import type { NpcProntoDBT, TecnicaProntaDBT } from '../modelo'
import { VIDA_POR_GOLPE, atributosDeTeste } from './livro.fixture'
import { ameacaPelaEscala, avisosDosAtributosDoNpc, fichaDeNpcEmBranco, npcProntoParaFicha, tecnicaDaPronta, tipoPelosRotulos, vidaDoNpc } from './npc'

const ESFERA_DE_KI: TecnicaProntaDBT = {
  nome: 'Esfera de Ki',
  categoria: 'ofensiva',
  rank: 'D',
  rankTexto: 'D',
  custoKi: 8,
  custoTexto: 'Ki: 08',
  faixa: { minimo: 8, medio: 17, completo: 34 },
  efeitoDaFaixa: 'dano',
  faixaTexto: '08-17-34',
  alcance: 'Alvo Único em 9,0m',
  rotulosPositivos: { pontos: 4, nomes: ['Técnica Básica', 'Técnica de Ki', 'Projétil', 'Aumentar Dano por Ki'] },
  rotulosNegativos: { pontos: 2, nomes: ['Somática'] },
  descricao: 'O usuário ergue o palmar estendido e lança uma esfera de ki no inimigo, causando danos.',
  efeito: '',
  pagina: 5,
}

function npcPronto(parcial: Partial<NpcProntoDBT> = {}): NpcProntoDBT {
  return {
    id: 'enma/mirio-jo',
    nome: 'Mirio Jo',
    colecao: 'enma',
    saga: null,
    fonte: 'Enma Daioh - 2025.pdf',
    criador: null,
    categoria: 'elite',
    rank: 'C',
    atributos: { for: 14, des: 16, con: 15, int: 16, sab: 12, pod: 14, pre: 13 },
    pk: 28,
    ca: 15,
    vel: 9,
    ep: 2,
    tecnicas: [ESFERA_DE_KI],
    transformacoes: [],
    passivas: [{ nome: 'Pavor', tipo: 'Passiva', texto: 'Teme o escuro.', pagina: 7 }],
    historia: 'Um lutador do Outro Mundo.',
    notas: [],
    pagina: 4,
    ...parcial,
  }
}

describe('vida do NPC (4.0.2, p. 17-18)', () => {
  it('exemplos do livro: ND 3 Rank E Comum = 36; ND 10 Rank Z Chefão = 2.340', () => {
    expect(vidaDoNpc(3, 'comum', 'E', VIDA_POR_GOLPE)).toBe(36)
    expect(vidaDoNpc(10, 'chefao', 'Z', VIDA_POR_GOLPE)).toBe(2340)
  })
})

describe('NPC pronto → ficha', () => {
  it('Mirio Jo (Elite C, ND 4): PV 168, PK 28, CA pela conta (sem ajuste à mão)', () => {
    const { ficha, atributos, recursos, maximos } = npcProntoParaFicha(npcPronto(), { nd: 4, vidaPorGolpe: VIDA_POR_GOLPE })
    expect(maximos).toEqual({ pv: 4 * 42, pk: 28 })
    expect(recursos).toEqual(maximos)
    expect(atributos.des).toBe(16)
    expect(ficha.epInicial).toBe(2)
    expect(ficha.ajustes).toEqual({})
    expect(ficha.npc).toMatchObject({ nd: 4, categoria: 'elite', rank: 'C', prontoId: 'enma/mirio-jo' })
    expect(ficha.npc?.passivas[0]).toMatchObject({ nome: 'Pavor', efeito: '(Passiva) Teme o escuro.' })
  })

  it('sem ND escolhido: PV pela conta do jogador (CON 15 × 5)', () => {
    expect(npcProntoParaFicha(npcPronto(), { nd: null, vidaPorGolpe: VIDA_POR_GOLPE }).maximos.pv).toBe(75)
  })

  it('PK e CA impressos fora da conta viram ajuste à mão (o impresso vence)', () => {
    const { ficha, maximos } = npcProntoParaFicha(npcPronto({ pk: 34, ca: 18, vel: 12 }), { nd: 1, vidaPorGolpe: VIDA_POR_GOLPE })
    expect(ficha.ajustes).toEqual({ pkMax: 34, ca: 18, deslocamento: 12 })
    expect(maximos.pk).toBe(34)
  })

  it('técnica pronta entra com Ki e faixa à mão e o tipo pelo rótulo impresso', () => {
    const tecnica = tecnicaDaPronta(ESFERA_DE_KI, 'C')
    expect(tecnica).toMatchObject({ rank: 'D', tipo: 'ki', atributo: 'int', kiManual: 8, danoManual: { minimo: 8, medio: 17, completo: 34 }, ativa: true, especial: null })
    expect(tecnica.descricao).toContain('Rótulos positivos (4): Técnica Básica, Técnica de Ki, Projétil, Aumentar Dano por Ki.')
  })

  it('rank impresso fora de E..Z cai no rank do NPC e fica anotado', () => {
    const tecnica = tecnicaDaPronta({ ...ESFERA_DE_KI, rank: null, rankTexto: 'God' }, 'Z')
    expect(tecnica.rank).toBe('Z')
    expect(tecnica.descricao).toContain('Rank impresso: God.')
  })
})

describe('tipo pelo rótulo impresso', () => {
  it('Física, de Ki, Mágica e Híbrida; sem rótulo de tipo, física', () => {
    expect(tipoPelosRotulos(['Técnica Física', 'Toque'])).toBe('fisica')
    expect(tipoPelosRotulos(['Técnica de Ki'])).toBe('ki')
    expect(tipoPelosRotulos(['Técnicas Mágicas'])).toBe('magica')
    expect(tipoPelosRotulos(['Técnica Híbrida', 'Técnica de Ki'])).toBe('hibrida')
    expect(tipoPelosRotulos(['Técnica de Acumulação – Ki'])).toBe('fisica')
  })
})

describe('NPC em branco e boa prática', () => {
  it('ficha em branco traz o bloco de NPC', () => {
    expect(fichaDeNpcEmBranco('chefao', 'B', 6).npc).toEqual({ nd: 6, categoria: 'chefao', rank: 'B', passivas: [], prontoId: null })
  })

  it('atributos acima do teto da categoria só avisam', () => {
    expect(avisosDosAtributosDoNpc('comum', atributosDeTeste({ for: 18 }))).toHaveLength(1)
    expect(avisosDosAtributosDoNpc('comum', atributosDeTeste({ for: 16, des: 14, con: 13 }))).toHaveLength(1)
    expect(avisosDosAtributosDoNpc('elite', atributosDeTeste({ for: 20, des: 16, con: 14 }))).toEqual([])
    expect(avisosDosAtributosDoNpc('chefao', atributosDeTeste({ pod: 30 }))).toEqual([])
  })

  it('ameaça pela EP do NPC contra a do grupo (4.0.3)', () => {
    expect(ameacaPelaEscala(1, 2)).toBe('facil')
    expect(ameacaPelaEscala(2, 2)).toBe('equilibrado')
    expect(ameacaPelaEscala(3, 2)).toBe('dificil')
    expect(ameacaPelaEscala(5, 2)).toBe('mortal')
  })
})
