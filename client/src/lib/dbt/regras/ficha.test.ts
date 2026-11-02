/**
 * Derivados da ficha do Dragon Ball Tales contra os exemplos do Livro do
 * Jogador (3.0, p. 12-14) e do Livro do Narrador (4.0.2, p. 17-18).
 */
import { describe, expect, it } from 'vitest'
import { modificador } from './atributos'
import {
  aumentosDaFicha,
  caDaFicha,
  derivadosDaFicha,
  ehHumanoMarcial,
  epBase,
  epTotal,
  periciaDaFicha,
  pkMaximo,
  proximosMarcos,
  pvMaximo,
  slotsDeTecnica,
  talentosDaFicha,
  vidaDoNpc,
} from './ficha'
import { RANKS_DO_LIVRO, VIDA_POR_GOLPE, atributosDeTeste, fichaDeTeste, racaDeTeste, tecnicaDeTeste } from './livro.fixture'

const SAIYAJIN = racaDeTeste('saiyajin', 12)
const TERRAQUEO = racaDeTeste('terraqueo', 6, [
  { id: 'humano-marcial', nome: 'HUMANO MARCIAL', descricao: '', tracos: [] },
  { id: 'humano-cientista', nome: 'HUMANO CIENTISTA', descricao: '', tracos: [] },
])

describe('modificador (p. 6, pelos exemplos)', () => {
  it('8 → −1, 10 → 0, 12 → +1, 14 → +2; ímpar arredonda para baixo', () => {
    expect(modificador(8)).toBe(-1)
    expect(modificador(9)).toBe(-1)
    expect(modificador(10)).toBe(0)
    expect(modificador(11)).toBe(0)
    expect(modificador(12)).toBe(1)
    expect(modificador(14)).toBe(2)
    expect(modificador(7)).toBe(-2)
  })
})

describe('PV (3.0.3, p. 12-13)', () => {
  it('CON 12 + raça 12 = 72 PV no PDL 0, com a raça desde o início', () => {
    const pv = pvMaximo(fichaDeTeste({ raca: 'saiyajin', pdl: 0 }), atributosDeTeste({ con: 12 }), SAIYAJIN, null)
    expect(pv.valor).toBe(72)
    expect(pv.manual).toBe(false)
    expect(pv.formula).toContain('= 72')
  })

  it('84 PV aos 10.000 PDL; 96 aos 20.000; 19.999 ainda é 84', () => {
    const con = atributosDeTeste({ con: 12 })
    expect(pvMaximo(fichaDeTeste({ raca: 'saiyajin', pdl: 10_000 }), con, SAIYAJIN, null).valor).toBe(84)
    expect(pvMaximo(fichaDeTeste({ raca: 'saiyajin', pdl: 19_999 }), con, SAIYAJIN, null).valor).toBe(84)
    expect(pvMaximo(fichaDeTeste({ raca: 'saiyajin', pdl: 20_000 }), con, SAIYAJIN, null).valor).toBe(96)
  })

  it('raça livre vence o catálogo; raça do catálogo que não é a da ficha não conta', () => {
    const con = atributosDeTeste({ con: 10 })
    expect(pvMaximo(fichaDeTeste({ racaLivre: { nome: 'Kaioshin', vidaPor10k: 20 } }), con, SAIYAJIN, null).valor).toBe(70)
    expect(pvMaximo(fichaDeTeste({ raca: 'majin' }), con, SAIYAJIN, null).valor).toBe(50)
  })

  it('o ajuste à mão vence a conta, e a conta continua visível', () => {
    const pv = pvMaximo(fichaDeTeste({ raca: 'saiyajin', ajustes: { pvMax: 100 } }), atributosDeTeste({ con: 12 }), SAIYAJIN, null)
    expect(pv.valor).toBe(100)
    expect(pv.calculado).toBe(72)
    expect(pv.manual).toBe(true)
    expect(pv.formula).toContain('fixado à mão em 100')
  })

  it('NPC: ND × vida por golpe (ND 3 Rank E Comum = 36; ND 10 Rank Z Chefão = 2.340)', () => {
    expect(vidaDoNpc(3, 'comum', 'E', VIDA_POR_GOLPE)).toBe(36)
    expect(vidaDoNpc(10, 'chefao', 'Z', VIDA_POR_GOLPE)).toBe(2340)
    const npc = fichaDeTeste({ npc: { nd: 3, categoria: 'comum', rank: 'E', passivas: [], prontoId: null } })
    expect(pvMaximo(npc, atributosDeTeste({ con: 20 }), null, VIDA_POR_GOLPE).valor).toBe(36)
  })

  it('NPC sem ND escolhido cai na conta do jogador e diz isso', () => {
    const npc = fichaDeTeste({ npc: { nd: null, categoria: 'elite', rank: 'C', passivas: [], prontoId: null } })
    const pv = pvMaximo(npc, atributosDeTeste({ con: 15 }), null, VIDA_POR_GOLPE)
    expect(pv.valor).toBe(75)
    expect(pv.formula).toContain('ND ainda não escolhido')
  })
})

describe('PK (3.0.4, p. 13)', () => {
  it('POD 14 = 28 PK; +1 a cada 10.000 PDL', () => {
    expect(pkMaximo(fichaDeTeste(), atributosDeTeste({ pod: 14 })).valor).toBe(28)
    expect(pkMaximo(fichaDeTeste({ pdl: 10_000 }), atributosDeTeste({ pod: 14 })).valor).toBe(29)
    expect(pkMaximo(fichaDeTeste({ pdl: 35_000 }), atributosDeTeste({ pod: 14 })).valor).toBe(31)
  })
})

describe('EP e CA (2.3, 3.0.5)', () => {
  it('EP base = EP inicial + 1 a cada 40.000 PDL', () => {
    expect(epBase(fichaDeTeste({ epInicial: 1, pdl: 39_999 })).valor).toBe(1)
    expect(epBase(fichaDeTeste({ epInicial: 1, pdl: 80_000 })).valor).toBe(3)
  })

  it('EP total soma a transformação ativa; a CA não', () => {
    const transformada = fichaDeTeste({
      epInicial: 1,
      transformacoes: [{ id: 'ssj', livroId: null, nome: 'Super Saiyajin', estagio: 1, ep: 2, custoKi: 6, kiPorRodada: 0, efeitos: '', origem: '' }],
      transformacaoAtiva: 'ssj',
    })
    const base = epBase(transformada)
    expect(epTotal(transformada, base).valor).toBe(3)
    // DES 14 (+2): 10 + 2 + EP base 1 = 13, sem os +2 da forma.
    expect(caDaFicha(transformada, atributosDeTeste({ des: 14 }), base).valor).toBe(13)
  })

  it('armadura equipada soma na CA; guardada na mochila não', () => {
    const item = { id: 'a', livroId: null, nome: 'Armadura Saiyajin', quantidade: 1, carga: 2, descricao: '', bonusCA: 2, kiPorTurno: 5 }
    const comArmadura = fichaDeTeste({ epInicial: 1, inventario: [{ ...item, equipado: true }] })
    const semArmadura = fichaDeTeste({ epInicial: 1, inventario: [{ ...item, equipado: false }] })
    expect(caDaFicha(comArmadura, atributosDeTeste({ des: 10 }), epBase(comArmadura)).valor).toBe(13)
    expect(caDaFicha(semArmadura, atributosDeTeste({ des: 10 }), epBase(semArmadura)).valor).toBe(11)
  })
})

describe('ST (3.0.6, 3.0.11; Humano Marcial 4.7.1)', () => {
  it('SAB 8 (−1) dá 20 ST; +2 a cada 10.000 PDL', () => {
    expect(slotsDeTecnica(fichaDeTeste(), atributosDeTeste({ sab: 8 }), false).valor).toBe(20)
    expect(slotsDeTecnica(fichaDeTeste({ pdl: 20_000 }), atributosDeTeste({ sab: 8 }), false).valor).toBe(24)
  })

  it('SAB 14 (+2) dá 35 pela fórmula (o exemplo da p. 109 diz 22, com a conta errada)', () => {
    expect(slotsDeTecnica(fichaDeTeste(), atributosDeTeste({ sab: 14 }), false).valor).toBe(35)
  })

  it('Humano Marcial multiplica por 10: SAB 14 dá 50', () => {
    const ficha = fichaDeTeste({ raca: 'terraqueo', variante: 'humano-marcial' })
    expect(ehHumanoMarcial(ficha, TERRAQUEO)).toBe(true)
    expect(ehHumanoMarcial(fichaDeTeste({ raca: 'terraqueo', variante: 'humano-cientista' }), TERRAQUEO)).toBe(false)
    expect(slotsDeTecnica(ficha, atributosDeTeste({ sab: 14 }), true).valor).toBe(50)
  })
})

describe('marcos de PDL (3.0.11, p. 14)', () => {
  it('talentos = 3 + 1 a cada 20.000; Humano Marcial ganha movimentos à parte', () => {
    expect(talentosDaFicha(fichaDeTeste({ pdl: 45_000 }), false).disponiveis).toBe(5)
    const marcial = talentosDaFicha(fichaDeTeste({ pdl: 45_000 }), true)
    expect(marcial.movimentosExtras).toBe(3)
    expect(marcial.restantes).toBe(8)
  })

  it('pontos de aumento = 2 a cada 30.000, menos os gastos', () => {
    const ficha = fichaDeTeste({ pdl: 60_000, aumentos: [{ marco: 1, atributo: 'for', pontos: 2 }, { marco: 2, atributo: 'des', pontos: 1 }] })
    expect(aumentosDaFicha(ficha)).toMatchObject({ total: 4, gastos: 3, restantes: 1 })
  })

  it('próximos marcos a partir de 25.000: 30.000 (atributo), 40.000 (talento e EP), 50.000', () => {
    const marcos = proximosMarcos(25_000, 12, false)
    expect(marcos.map((m) => m.pdl)).toEqual([30_000, 40_000, 50_000])
    expect(marcos[0].falta).toBe(5_000)
    expect(marcos[0].ganhos).toContain('+2 em um atributo ou +1 em dois')
    expect(marcos[1].ganhos).toEqual(expect.arrayContaining(['+12 PV (raça)', '+1 PK', '+2 ST', '+1 talento ou movimento marcial', '+1 EP base']))
  })
})

describe('perícias (8.1.2, p. 97-98)', () => {
  it('d20 + mod; treinada soma a EP base', () => {
    const ficha = fichaDeTeste({ epInicial: 2, periciasTreinadas: ['percepcao'] })
    const sab = atributosDeTeste({ sab: 14 })
    expect(periciaDaFicha('percepcao', ficha, sab, 2).bonus).toBe(4)
    expect(periciaDaFicha('sentido-de-ki', ficha, sab, 2).bonus).toBe(2)
  })
})

describe('derivadosDaFicha', () => {
  it('junta tudo e conta ST só das técnicas ativas que não são especiais', () => {
    const ficha = fichaDeTeste({
      raca: 'saiyajin',
      pdl: 10_000,
      kiBloqueado: 5,
      tecnicas: [
        tecnicaDeTeste({ id: 'a', rank: 'B', ativa: true }),
        tecnicaDeTeste({ id: 'b', rank: 'D', ativa: false }),
        tecnicaDeTeste({ id: 'c', rank: 'C', ativa: true, especial: { ofensiva: false, momento: 'acao', efeito: '', aprovada: true } }),
      ],
    })
    const derivados = derivadosDaFicha(ficha, atributosDeTeste({ con: 12, pod: 14 }), { raca: SAIYAJIN, ranks: RANKS_DO_LIVRO, vidaPorGolpe: null })
    expect(derivados.pvMax.valor).toBe(84)
    expect(derivados.pkMax.valor).toBe(29)
    expect(derivados.pkDisponivel).toBe(24)
    expect(derivados.stUsados).toBe(8)
    expect(Object.keys(derivados.pericias)).toHaveLength(13)
  })

  it('atributo ausente vale 8 (ficha nova)', () => {
    const derivados = derivadosDaFicha(fichaDeTeste(), {}, { raca: null, ranks: RANKS_DO_LIVRO, vidaPorGolpe: null })
    expect(derivados.pvMax.valor).toBe(40)
    expect(derivados.pkMax.valor).toBe(16)
  })
})
