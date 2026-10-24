/**
 * LUZ QUE ACENDE SOZINHA (Luz L3): `Light.acesaEm` diz em que períodos a luz
 * está acesa. Ausente = sempre acesa (a luz de antes); `[]` = nunca; `apagada`
 * e `porEstado` vencem; cena interior ignora a troca (D1) e a luz fica como
 * sempre; valor torto (rede, arquivo editado à mão) não conta.
 */
import { describe, expect, it } from 'vitest'
import type { Light, MapData, Periodo } from '../types/map'
import { comAcesaEm, lerAcesaEm, luzAcesaNoPeriodo } from './periodo'

const PERIODOS: Periodo[] = ['dia', 'tarde', 'noite']

function luz(extra: Partial<Light> = {}): Light {
  return { id: 'l', x: 0, y: 0, radius: 100, color: '#ffba7b', intensity: 0.85, ...extra }
}

const EXTERNA: Pick<MapData, 'externa' | 'periodoFixo'> = { externa: true }
const INTERIOR: Pick<MapData, 'externa' | 'periodoFixo'> = {}

/** Em que períodos (da sessão) a luz acende nesta cena. */
function acesaEm(l: Light, cena: Pick<MapData, 'externa' | 'periodoFixo'> = EXTERNA): Periodo[] {
  return PERIODOS.filter((p) => luzAcesaNoPeriodo(l, cena, p))
}

describe('luzAcesaNoPeriodo: a tabela da L3', () => {
  it('sem o campo: sempre acesa, como hoje', () => {
    expect(acesaEm(luz())).toEqual(PERIODOS)
  })

  it('só à noite: de dia e de tarde apagada, à noite acesa', () => {
    expect(acesaEm(luz({ acesaEm: ['noite'] }))).toEqual(['noite'])
  })

  it('tarde e noite (o lampião): apagada só de dia', () => {
    expect(acesaEm(luz({ acesaEm: ['tarde', 'noite'] }))).toEqual(['tarde', 'noite'])
  })

  it('[] = nunca acesa', () => {
    expect(acesaEm(luz({ acesaEm: [] }))).toEqual([])
  })

  it('apagada vence: apagada à noite mesmo com acesaEm noite', () => {
    expect(acesaEm(luz({ acesaEm: ['noite'], apagada: true }))).toEqual([])
    expect(acesaEm(luz({ apagada: true }))).toEqual([])
  })

  it('porEstado vence: a luz que obedece a um estado não acende nem apaga sozinha', () => {
    const porEstado: Light['porEstado'] = { estadoId: 'energia', efeitos: [{ valor: 'ligada', efeito: 'acesa' }] }
    expect(acesaEm(luz({ acesaEm: ['noite'], porEstado }))).toEqual(PERIODOS)
    expect(acesaEm(luz({ acesaEm: [], porEstado }))).toEqual(PERIODOS)
    // O efeito do estado está gravado em `apagada`: apagada pelo estado continua apagada.
    expect(acesaEm(luz({ acesaEm: ['noite'], porEstado, apagada: true }))).toEqual([])
  })

  it('cena interior ignora a troca (D1): a luz acende como sempre, em qualquer período da sessão', () => {
    expect(acesaEm(luz({ acesaEm: ['tarde', 'noite'] }), INTERIOR)).toEqual(PERIODOS)
    expect(acesaEm(luz({ acesaEm: [] }), INTERIOR)).toEqual(PERIODOS)
    expect(acesaEm(luz({ acesaEm: ['noite'], apagada: true }), INTERIOR)).toEqual([])
  })

  it('cena de período fixo: vale o período da cena, não o da sessão', () => {
    const torreNaNoite: Pick<MapData, 'externa' | 'periodoFixo'> = { periodoFixo: 'noite' }
    expect(acesaEm(luz({ acesaEm: ['noite'] }), torreNaNoite)).toEqual(PERIODOS)
    expect(acesaEm(luz({ acesaEm: ['dia'] }), torreNaNoite)).toEqual([])
  })

  it('sessão ausente (mestre sem período): dia', () => {
    expect(luzAcesaNoPeriodo(luz({ acesaEm: ['noite'] }), EXTERNA, null)).toBe(false)
    expect(luzAcesaNoPeriodo(luz({ acesaEm: ['dia'] }), EXTERNA, undefined)).toBe(true)
  })

  it('valor torto (mapa vindo cru): não conta, a luz fica como a de antes (sempre acesa)', () => {
    for (const torto of ['noite', 3, null, {}, ['madrugada'], ['noite', 7]] as unknown[]) {
      expect(acesaEm(luz({ acesaEm: torto as Periodo[] })), JSON.stringify(torto)).toEqual(PERIODOS) // forja de propósito: o mapa da rede pode vir com qualquer coisa
    }
  })
})

describe('lerAcesaEm: o leitor estrito (arquivo e rede)', () => {
  it('lista de períodos: sem repetição, na ordem dia, tarde, noite', () => {
    expect(lerAcesaEm(['noite', 'tarde', 'noite'])).toEqual(['tarde', 'noite'])
    expect(lerAcesaEm(['dia'])).toEqual(['dia'])
    expect(lerAcesaEm([])).toEqual([])
  })

  it("o 'manha' do relógio antigo é lido como 'dia'", () => {
    expect(lerAcesaEm(['manha', 'noite'])).toEqual(['dia', 'noite'])
  })

  it('torto some inteiro (nunca vira "nunca acesa" por engano)', () => {
    for (const torto of ['noite', 0, 1, true, null, {}, { noite: true }, ['Noite'], ['noite', ''], [null], [['noite']]] as unknown[]) {
      expect(lerAcesaEm(torto), JSON.stringify(torto)).toBeUndefined()
    }
    expect(lerAcesaEm(undefined)).toBeUndefined()
  })
})

describe('comAcesaEm: o que o painel grava', () => {
  it('os três períodos tiram o campo: a luz volta a ser igual à de antes', () => {
    const l = comAcesaEm(luz({ acesaEm: ['noite'] }), ['dia', 'tarde', 'noite'])
    expect('acesaEm' in l).toBe(false)
    expect(l).toEqual(luz())
  })

  it('um subconjunto vira a lista em ordem; nenhum vira []', () => {
    expect(comAcesaEm(luz(), ['noite', 'dia']).acesaEm).toEqual(['dia', 'noite'])
    expect(comAcesaEm(luz(), []).acesaEm).toEqual([])
  })

  it('não muda a luz que já está assim (mesmo objeto)', () => {
    const l = luz({ acesaEm: ['tarde', 'noite'] })
    expect(comAcesaEm(l, ['tarde', 'noite'])).toBe(l)
    const sempre = luz()
    expect(comAcesaEm(sempre, PERIODOS)).toBe(sempre)
  })
})
