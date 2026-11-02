/**
 * Contas do mundo do livro Dragon Ball: rótulo impresso → catálogo (busca
 * tolerante), NPC pronto e NPC em branco como Personagem, e o peso de um
 * encontro, inclusive com a ficha sem nada opcional.
 */
import { describe, expect, it } from 'vitest'
import { VIDA_POR_GOLPE } from '../../../lib/dbt/dados/tabelas'
import type { NpcProntoDBT, TecnicaProntaDBT } from '../../../lib/dbt/modelo'
import { SISTEMA_DRAGON_BALL } from '../../../lib/dbt/sistemaDragonBall'
import { novoPersonagem } from '../../../lib/personagem'
import { pesoDoEncontroDBT, personagemDeNpcEmBranco, personagemDoNpcPronto, RANKS_DO_LIVRO, rotuloPeloNomeImpresso, rotulosDaPronta } from './contasDoMundo'

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
  rotulosPositivos: { pontos: 4, nomes: ['Técnica Básica', 'Técnica de Ki', 'Projétil', 'Aumento de Dano por Ki', 'Adicionar Condição (Cego)'] },
  rotulosNegativos: { pontos: 2, nomes: ['Somática', 'Dano Absoluto'] },
  descricao: 'Uma esfera de ki.',
  efeito: '',
  pagina: 5,
}

const NPC: NpcProntoDBT = {
  id: 'teste/saibaman',
  nome: 'Saibaman',
  colecao: 'saiyajins',
  saga: 'Saga Saiyajin',
  fonte: 'teste.md',
  criador: null,
  categoria: 'comum',
  rank: 'C',
  atributos: { for: 12, des: 12, con: 12, int: 10, sab: 10, pod: 10, pre: 8 },
  pk: 20,
  ca: 12,
  vel: 9,
  ep: 1,
  tecnicas: [ESFERA_DE_KI],
  transformacoes: [],
  passivas: [],
  historia: '',
  notas: [],
  pagina: null,
}

describe('rotuloPeloNomeImpresso', () => {
  it('acha o rótulo abreviado, com erro de digitação e a condição na nota', () => {
    expect(rotuloPeloNomeImpresso('Estocada')?.rotulo.nome).toBe('Alcance – Estocada')
    expect(rotuloPeloNomeImpresso('Projétil')?.rotulo.nome).toBe('Alcance – Projétil')
    expect(rotuloPeloNomeImpresso('Contudente')?.rotulo.nome).toBe('Dano Contundente')
    expect(rotuloPeloNomeImpresso('Aumento de Dano por Ki')?.rotulo.nome).toBe('Aumentar Dano por Ki')
    expect(rotuloPeloNomeImpresso('Acumulação')?.rotulo.nome).toBe('Técnica de Acumulação – Ki')
    expect(rotuloPeloNomeImpresso('Adicionar Condição (Cego)')).toMatchObject({ rotulo: { nome: 'Efeito Negativo' }, nota: 'Cego' })
  })

  it('não inventa: nome fora do catálogo fica sem rótulo', () => {
    expect(rotuloPeloNomeImpresso('Dano Absoluto')).toBeNull()
    expect(rotuloPeloNomeImpresso('')).toBeNull()
  })

  it('não repete o rótulo de tipo (o tipo já vem da técnica)', () => {
    const ids = rotulosDaPronta(ESFERA_DE_KI).map((escolhido) => escolhido.rotuloId)
    expect(ids).toHaveLength(5)
    expect(ids.some((id) => id.includes('tecnica-de-ki'))).toBe(false)
  })
})

describe('NPC novo como Personagem', () => {
  it('pronto com ND: PV = ND × vida por golpe, PK impresso, rótulos ligados', () => {
    const npc = personagemDoNpcPronto(SISTEMA_DRAGON_BALL, NPC, 3, 'Saibaman 2')
    expect(npc.tipo).toBe('npc')
    expect(npc.nome).toBe('Saibaman 2')
    expect(npc.maximos.pv).toBe(3 * VIDA_POR_GOLPE.comum.C)
    expect(npc.recursos.pv).toBe(npc.maximos.pv)
    expect(npc.maximos.pk).toBe(20)
    expect(npc.dbt?.npc?.prontoId).toBe('teste/saibaman')
    expect(npc.dbt?.tecnicas[0].rotulos.length).toBeGreaterThan(0)
  })

  it('pronto sem nada opcional: sem técnica, sem ND, sem passiva', () => {
    const npc = personagemDoNpcPronto(SISTEMA_DRAGON_BALL, { ...NPC, tecnicas: [], saga: null }, null, 'Vazio')
    expect(npc.dbt?.tecnicas).toEqual([])
    expect(npc.dbt?.npc?.nd).toBeNull()
    expect(npc.maximos.pv).toBeGreaterThan(0)
  })

  it('em branco: atributos 8, PV pelo ND e a EP escolhida', () => {
    const npc = personagemDeNpcEmBranco(SISTEMA_DRAGON_BALL, 'Capanga', { categoria: 'elite', rank: 'D', nd: 2, ep: 0 })
    expect(npc.atributos.con).toBe(8)
    expect(npc.maximos.pv).toBe(2 * VIDA_POR_GOLPE.elite.D)
    expect(npc.maximos.pk).toBe(16)
    expect(npc.dbt?.epInicial).toBe(0)
  })
})

describe('pesoDoEncontroDBT', () => {
  const ranks = RANKS_DO_LIVRO
  if (ranks === null) throw new Error('tabela de ranks do livro incompleta')

  it('ficha sem dbt e sem técnica: entra com dano 0 e nunca derruba', () => {
    const jogador = { ...novoPersonagem(SISTEMA_DRAGON_BALL, 'jogador', 'Sem ficha'), dbt: undefined }
    const inimigo = personagemDoNpcPronto(SISTEMA_DRAGON_BALL, NPC, 3, 'Saibaman')
    const encontro = pesoDoEncontroDBT([jogador.id], { [inimigo.id]: 2 }, [jogador, inimigo], ranks)
    expect(encontro.grupo.danoPorRodada).toBe(0)
    expect(encontro.grupo.rodadasParaDerrubar).toBe(Infinity)
    expect(encontro.grupo.semGolpe).toEqual(['Sem ficha'])
    expect(encontro.inimigos.vida).toBe(2 * inimigo.maximos.pv)
    expect(encontro.inimigos.danoPorRodada).toBeGreaterThan(0)
    expect(encontro.ameaca?.nivel).toBe('equilibrado')
  })

  it('sem grupo nem inimigos: nada a medir', () => {
    const encontro = pesoDoEncontroDBT([], {}, [], ranks)
    expect(encontro.ameaca).toBeNull()
    expect(encontro.grupo.vida).toBe(0)
  })
})
