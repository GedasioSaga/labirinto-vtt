/**
 * DIA/TARDE/NOITE (L0): o período em que cada cena está. A regra é uma só e
 * mora em `periodoDaCena`: cena com período fixo usa o fixo; cena externa
 * segue a sessão; cena sem nenhuma das duas marcas é INTERIOR e ignora a troca
 * (decisão D1). Sessão ausente = dia. O 'manha' do relógio antigo é lido como
 * 'dia' e nunca é devolvido.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Periodo } from '../types/map'
import { AMBIENTE_PADRAO, ambienteDoPeriodo, lerPeriodo, PERIODO_PADRAO, PERIODOS, periodoDaCena } from './periodo'

type Marcas = Pick<MapData, 'externa' | 'periodoFixo'>

const SEM_MARCA: Marcas = {}
const EXTERNA: Marcas = { externa: true }
const FIXA_NOITE: Marcas = { periodoFixo: 'noite' }
const FIXA_TARDE_E_EXTERNA: Marcas = { externa: true, periodoFixo: 'tarde' }

describe('periodoDaCena: tabela dos 6 casos', () => {
  it('1. cena sem campo e sessão ausente: dia', () => {
    expect(periodoDaCena(SEM_MARCA, undefined)).toBe('dia')
    expect(periodoDaCena(EXTERNA, undefined)).toBe('dia')
    expect(periodoDaCena(SEM_MARCA, null)).toBe('dia')
  })

  it('2. cena externa segue a sessão', () => {
    for (const sessao of PERIODOS) expect(periodoDaCena(EXTERNA, sessao)).toBe(sessao)
  })

  it('3. cena com período fixo usa o fixo, qualquer que seja a sessão (e vence a marca externa)', () => {
    for (const sessao of [...PERIODOS, undefined]) {
      expect(periodoDaCena(FIXA_NOITE, sessao)).toBe('noite')
      expect(periodoDaCena(FIXA_TARDE_E_EXTERNA, sessao)).toBe('tarde')
    }
  })

  it('4. cena interior (sem nenhuma marca) ignora a troca: dia com sessão dia, tarde ou noite', () => {
    for (const sessao of PERIODOS) expect(periodoDaCena(SEM_MARCA, sessao)).toBe('dia')
  })

  it("5. 'manha' do relógio antigo é lido como 'dia' (sessão e fixo)", () => {
    expect(lerPeriodo('manha')).toBe('dia')
    expect(periodoDaCena(EXTERNA, 'manha')).toBe('dia')
    expect(periodoDaCena({ periodoFixo: lerPeriodo('manha') }, 'noite')).toBe('dia')
  })

  it('6. valor inválido volta ausente e a cena cai na regra sem ele', () => {
    for (const torto of ['madrugada', 'Dia', '', 0, 1, null, true, {}, ['noite']]) {
      expect(lerPeriodo(torto)).toBeUndefined()
      expect(periodoDaCena(EXTERNA, lerPeriodo(torto))).toBe('dia')
      expect(periodoDaCena({ externa: true, periodoFixo: lerPeriodo(torto) }, 'noite')).toBe('noite')
    }
  })
})

describe('lerPeriodo', () => {
  it('devolve os três períodos como estão e nunca devolve manha', () => {
    for (const periodo of PERIODOS) expect(lerPeriodo(periodo)).toBe(periodo)
    const lidos: (Periodo | undefined)[] = ['manha', 'dia', 'tarde', 'noite'].map(lerPeriodo)
    expect(lidos).not.toContain('manha')
  })

  it('o padrão é dia', () => {
    expect(PERIODO_PADRAO).toBe('dia')
  })
})

describe('ambienteDoPeriodo: tinta por cena mesclada com o padrão aprovado', () => {
  it('padrão aprovado: dia sem tinta, tarde âmbar a 60%, noite azul-ardósia a 85%', () => {
    expect(AMBIENTE_PADRAO).toEqual({
      dia: { cor: '#ffffff', forca: 0 },
      tarde: { cor: '#f2b071', forca: 0.6 },
      noite: { cor: '#465a92', forca: 0.85 },
    })
  })

  const casos: [string, Pick<MapData, 'ambientePorPeriodo'>, Periodo, { cor: string; forca: number }][] = [
    ['mapa sem campo, noite', {}, 'noite', { cor: '#465a92', forca: 0.85 }],
    ['mapa sem campo, tarde', {}, 'tarde', { cor: '#f2b071', forca: 0.6 }],
    ['só cor', { ambientePorPeriodo: { noite: { cor: '#102030' } } }, 'noite', { cor: '#102030', forca: 0.85 }],
    ['só força', { ambientePorPeriodo: { tarde: { forca: 0.25 } } }, 'tarde', { cor: '#f2b071', forca: 0.25 }],
    ['força -1 grampeada em 0', { ambientePorPeriodo: { noite: { forca: -1 } } }, 'noite', { cor: '#465a92', forca: 0 }],
    ['força 5 grampeada em 1', { ambientePorPeriodo: { noite: { forca: 5 } } }, 'noite', { cor: '#465a92', forca: 1 }],
    ['cor lixo cai no padrão', { ambientePorPeriodo: { tarde: { cor: 'azul', forca: 0.4 } } }, 'tarde', { cor: '#f2b071', forca: 0.4 }],
    ['cor sem # cai no padrão', { ambientePorPeriodo: { noite: { cor: '465a92' } } }, 'noite', { cor: '#465a92', forca: 0.85 }],
    ['cor curta cai no padrão', { ambientePorPeriodo: { noite: { cor: '#fff' } } }, 'noite', { cor: '#465a92', forca: 0.85 }],
    ['dia: sempre sem tinta, mesmo com tarde e noite na cena', { ambientePorPeriodo: { tarde: { cor: '#000000', forca: 1 }, noite: { cor: '#000000', forca: 1 } } }, 'dia', { cor: '#ffffff', forca: 0 }],
    ['o campo de um período não vaza para o outro', { ambientePorPeriodo: { noite: { cor: '#000000', forca: 1 } } }, 'tarde', { cor: '#f2b071', forca: 0.6 }],
  ]

  for (const [nome, cena, periodo, esperado] of casos) {
    it(nome, () => {
      expect(ambienteDoPeriodo(cena, periodo)).toEqual(esperado)
    })
  }

  it('força NaN ou infinita cai no padrão', () => {
    expect(ambienteDoPeriodo({ ambientePorPeriodo: { noite: { forca: Number.NaN } } }, 'noite').forca).toBe(0.85)
    expect(ambienteDoPeriodo({ ambientePorPeriodo: { noite: { forca: Number.POSITIVE_INFINITY } } }, 'noite').forca).toBe(0.85)
  })

  it('devolve cópia: mexer no resultado não muda o padrão', () => {
    ambienteDoPeriodo({}, 'dia').forca = 1
    ambienteDoPeriodo({}, 'noite').forca = 0
    expect(AMBIENTE_PADRAO.dia.forca).toBe(0)
    expect(AMBIENTE_PADRAO.noite.forca).toBe(0.85)
  })
})
