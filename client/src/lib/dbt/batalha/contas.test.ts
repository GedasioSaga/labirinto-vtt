/**
 * Números da batalha Dragon Ball Tales pelos exemplos do livro
 * (docs/planos/dbt-batalha.md, seção 19): faixas contra CA, diferença de EP,
 * crítico, básicos condensados, Kamehameha, Exposto, Desnorteado, Ki.
 */
import { describe, expect, it } from 'vitest'
import {
  criticoAPartirDe,
  custoEfetivo,
  danoDaFaixa,
  faixaDaMargem,
  faixaInvertida,
  kiDaCorrida,
  kiDaRecarga,
  kiDeDesengajar,
  kiDeVoo,
  montarAcerto,
  casasDoDeslocamento,
  redutorDosBasicos,
  subirEstagios,
  vantagemDoAtaque,
} from './contas'
import { MULTIPLICADOR_DO_CRITICO, type FichaLida } from './leitura'
import { nucleoInicial } from './motor'

const KAMEHAMEHA = { minimo: 11, medio: 22, completo: 44 }

function fichaLida(parcial: Partial<FichaLida> = {}): FichaLida {
  return {
    personagemId: 'p1',
    nome: 'Goku',
    jogador: true,
    atributos: { for: 14, des: 14, con: 12, int: 10, sab: 10, pod: 12, pre: 10 },
    epBase: 2,
    caBase: 14,
    pv: { atual: 50, max: 50 },
    pk: { atual: 30, max: 30 },
    pkBloqueadosDaFicha: 0,
    armaduraKiPorTurno: 0,
    rankMaximo: 'C',
    usosTransfMaximaDesdeDescanso: 0,
    choqueDisponivel: true,
    deslocamentoM: 9,
    tecnicas: [],
    transformacoes: [],
    movimentos: [],
    ...parcial,
  }
}

function combatenteDeTeste() {
  const nucleo = nucleoInicial([{ tokenId: 't1', personagemId: 'p1', nome: 'Goku', lado: 'pj', npc: false }], {}, new Map(), () => 'id')
  return nucleo.combatentes.t1
}

describe('faixa contra CA 18 sem diferença de EP', () => {
  it('total 18 erra; 19-20 mínimo; 21-23 médio; 24+ completo', () => {
    const ca = 18
    expect([18, 19, 20, 21, 23, 24, 30].map((total) => faixaDaMargem(total - ca, 0))).toEqual(['erro', 'minimo', 'minimo', 'medio', 'medio', 'completo', 'completo'])
  })

  it('o mais fraco usa a faixa base: diferença negativa não desloca a seu favor', () => {
    for (const margem of [1, 3, 6]) expect(faixaDaMargem(margem, -2)).toBe(faixaDaMargem(margem, 0))
  })

  it('o mais forte (+2 EP) nunca cai para uma faixa pior que a base', () => {
    const ordem = ['erro', 'minimo', 'medio', 'completo']
    for (const margem of [1, 2, 3, 5, 6]) expect(ordem.indexOf(faixaDaMargem(margem, 2))).toBeGreaterThanOrEqual(ordem.indexOf(faixaDaMargem(margem, 0)))
  })
})

describe('conta do acerto (7.1)', () => {
  it('alvo com 2 EP a mais: -2 no acerto', () => {
    const { partes, total } = montarAcerto({ d20: 12, atributo: 'des', mod: 3, epAtacante: 2, epAlvo: 4, precisao: 0, temporarios: 0, redutorBasico: 0, desnorteado: false })
    expect(partes).toContainEqual({ rotulo: 'Dif. EP', valor: -2 })
    expect(total).toBe(12 + 3 + 2 - 2)
  })

  it('Desnorteado tira 2 do acerto', () => {
    const base = montarAcerto({ d20: 10, atributo: 'for', mod: 2, epAtacante: 1, epAlvo: 1, precisao: 0, temporarios: 0, redutorBasico: 0, desnorteado: false })
    const desnorteado = montarAcerto({ d20: 10, atributo: 'for', mod: 2, epAtacante: 1, epAlvo: 1, precisao: 0, temporarios: 0, redutorBasico: 0, desnorteado: true })
    expect(base.total - desnorteado.total).toBe(2)
  })

  it('5 básicos condensados: -(0+1+2+3+4) = -10', () => {
    expect(redutorDosBasicos(0, 5)).toBe(10)
    // O 3º básico sozinho, com 2 já usados no turno: -2.
    expect(redutorDosBasicos(2, 1)).toBe(2)
  })

  it('vantagem com desvantagem = normal', () => {
    expect(vantagemDoAtaque(['flanqueado'], ['envenenado'])).toBe(0)
    expect(vantagemDoAtaque(['flanqueado'], [])).toBe(1)
    expect(vantagemDoAtaque([], ['envenenado'])).toBe(-1)
  })
})

describe('dano', () => {
  it('Kamehameha: 11 / 22 / 44 e o crítico dobra o completo para 88', () => {
    expect(danoDaFaixa(KAMEHAMEHA, 'minimo')).toBe(11)
    expect(danoDaFaixa(KAMEHAMEHA, 'medio')).toBe(22)
    expect(danoDaFaixa(KAMEHAMEHA, 'completo')).toBe(44)
    expect(danoDaFaixa(KAMEHAMEHA, 'completo') * MULTIPLICADOR_DO_CRITICO).toBe(88)
  })

  it('Sangrando sobe um estágio; acima do completo vira + dano mínimo', () => {
    expect(subirEstagios('minimo', 1, 11)).toEqual({ faixa: 'medio', extra: 0 })
    expect(subirEstagios('completo', 1, 11)).toEqual({ faixa: 'completo', extra: 11 })
    expect(subirEstagios('erro', 1, 11)).toEqual({ faixa: 'erro', extra: 0 })
  })

  it('escala invertida (defensiva e cura): igual ou acima = completo; até 5 abaixo = médio', () => {
    expect(faixaInvertida(15, 15)).toBe('completo')
    expect(faixaInvertida(10, 15)).toBe('medio')
    expect(faixaInvertida(9, 15)).toBe('minimo')
  })

  it('Exposto: crítico de 16 a 20', () => {
    expect(criticoAPartirDe(0, false)).toBe(20)
    expect(criticoAPartirDe(0, true)).toBe(16)
    expect(criticoAPartirDe(5, true)).toBe(15)
  })
})

describe('Ki', () => {
  it('multiplicadores distintos se multiplicam', () => {
    expect(custoEfetivo(10, { sobrecarregado: true, reacaoDobrada: false, choque: false })).toBe(20)
    expect(custoEfetivo(10, { sobrecarregado: true, reacaoDobrada: true, choque: true })).toBe(80)
  })

  it('voo: decolar 4, mudar de nível 2, pousar 0', () => {
    expect(kiDeVoo(0, 1)).toBe(4)
    expect(kiDeVoo(0, 3)).toBe(6)
    expect(kiDeVoo(1, 3)).toBe(2)
    expect(kiDeVoo(2, 0)).toBe(0)
  })

  it('correr: 1 Ki por 1,5 m além dos 9 m; Caído anda a metade', () => {
    expect(casasDoDeslocamento(1.5)).toBe(6)
    expect(casasDoDeslocamento(1.5, 9, true)).toBe(3)
    expect(kiDaCorrida(2, 1.5)).toBe(2)
  })

  it('desengajar: no mínimo 2, ou 2x a EP do outro', () => {
    expect(kiDeDesengajar(0)).toBe(2)
    expect(kiDeDesengajar(3)).toBe(6)
  })

  it('recarga: máximo menos o bloqueado da ficha e o débito do Choque', () => {
    const c = { ...combatenteDeTeste(), kiDebito: 4 }
    expect(kiDaRecarga(c, fichaLida({ pk: { atual: 0, max: 30 }, pkBloqueadosDaFicha: 5 }))).toBe(21)
  })
})
