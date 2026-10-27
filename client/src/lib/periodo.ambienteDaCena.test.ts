/**
 * AMBIENTE DA CENA (Luz L4c): o que o painel "Ambiente da cena" grava no mapa.
 * Cada mudança é pura e devolve o MESMO mapa quando nada muda (sem passo de
 * desfazer à toa); voltar ao padrão TIRA os campos, e o arquivo sai igual ao
 * de um mapa que nunca os teve.
 */
import { describe, expect, it } from 'vitest'
import l1Json from '../../../maps/L1.json'
import antesL1 from './__fixtures__/roundtrip-924c2bdd/L1.json'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import {
  AMBIENTE_PADRAO,
  ATALHOS_DA_NOITE,
  ambienteDoPeriodo,
  atalhoDaNoiteAtual,
  comAmbienteDoPeriodo,
  comAtalhoDaNoite,
  comPeriodoFixo,
  comVisaoDoPeriodo,
  periodoDaCena,
  raioNoPeriodo,
  semAjusteDoPeriodo,
} from './periodo'
import type { MapData } from '../types/map'

const GRADE = 50

function cena(extra: Partial<MapData> = {}): MapData {
  return { ...createEmptyMap('m', 'Vila', 20, 20, GRADE), ...extra }
}

describe('comPeriodoFixo', () => {
  it('fixa a cena num período e "nenhum" tira o campo', () => {
    const noite = comPeriodoFixo(cena(), 'noite')
    expect(noite.periodoFixo).toBe('noite')
    expect(periodoDaCena(noite, 'dia')).toBe('noite')
    const livre = comPeriodoFixo(noite, undefined)
    expect('periodoFixo' in livre).toBe(false)
  })

  it('o mesmo valor devolve o mesmo mapa', () => {
    const base = cena()
    expect(comPeriodoFixo(base, undefined)).toBe(base)
    const tarde = comPeriodoFixo(base, 'tarde')
    expect(comPeriodoFixo(tarde, 'tarde')).toBe(tarde)
  })
})

describe('comAmbienteDoPeriodo', () => {
  it('grava a força da noite e o resto fica no padrão', () => {
    const m = comAmbienteDoPeriodo(cena(), 'noite', { forca: 0.4 })
    expect(m.ambientePorPeriodo).toEqual({ noite: { forca: 0.4 } })
    expect(ambienteDoPeriodo(m, 'noite')).toEqual({ cor: AMBIENTE_PADRAO.noite.cor, forca: 0.4 })
    expect(ambienteDoPeriodo(m, 'tarde')).toEqual(AMBIENTE_PADRAO.tarde)
  })

  it('cor e força juntas, na ordem do arquivo (tarde antes de noite, cor antes de força)', () => {
    const m = comAmbienteDoPeriodo(comAmbienteDoPeriodo(cena(), 'noite', { forca: 1 }), 'tarde', { forca: 0.2, cor: '#aa5500' })
    expect(JSON.stringify(m.ambientePorPeriodo)).toBe('{"tarde":{"cor":"#aa5500","forca":0.2},"noite":{"forca":1}}')
  })

  it('força fora de 0..1 é grampeada; NaN e cor torta não mudam nada', () => {
    expect(comAmbienteDoPeriodo(cena(), 'noite', { forca: 3 }).ambientePorPeriodo?.noite?.forca).toBe(1)
    expect(comAmbienteDoPeriodo(cena(), 'noite', { forca: -1 }).ambientePorPeriodo?.noite?.forca).toBe(0)
    const base = cena()
    expect(comAmbienteDoPeriodo(base, 'noite', { forca: Number.NaN })).toBe(base)
    expect(comAmbienteDoPeriodo(base, 'noite', { cor: 'azul' })).toBe(base)
  })

  it('o mesmo valor devolve o mesmo mapa', () => {
    const m = comAmbienteDoPeriodo(cena(), 'tarde', { forca: 0.3 })
    expect(comAmbienteDoPeriodo(m, 'tarde', { forca: 0.3 })).toBe(m)
  })
})

describe('comVisaoDoPeriodo', () => {
  it('grava as casas, 0 inclusive, e vazio tira o campo', () => {
    const zero = comVisaoDoPeriodo(cena(), 'noite', 0)
    expect(zero.visaoPorPeriodo).toEqual({ noite: 0 })
    expect(raioNoPeriodo(700, 'noite', zero)).toBe(0)
    const sem = comVisaoDoPeriodo(zero, 'noite', undefined)
    expect('visaoPorPeriodo' in sem).toBe(false)
  })

  it('fração, negativo e acima de 200 não gravam', () => {
    const base = cena()
    for (const torto of [1.5, -1, 201, Number.NaN]) expect(comVisaoDoPeriodo(base, 'tarde', torto)).toBe(base)
    expect(comVisaoDoPeriodo(base, 'tarde', 200).visaoPorPeriodo).toEqual({ tarde: 200 })
  })
})

describe('atalhos da noite', () => {
  it('três atalhos, do mais claro ao mais escuro', () => {
    expect(ATALHOS_DA_NOITE.map((a) => a.rotulo)).toEqual(['Noite leve', 'Noite fechada', 'Escuridão total'])
    const forcas = ATALHOS_DA_NOITE.map((a) => a.forca)
    expect([...forcas].sort((a, b) => a - b)).toEqual(forcas)
  })

  it('Escuridão total apaga a visão (0 casas) com tinta cheia', () => {
    const m = comAtalhoDaNoite(cena(), 'escuridao-total')
    expect(m.visaoPorPeriodo?.noite).toBe(0)
    expect(ambienteDoPeriodo(m, 'noite').forca).toBe(1)
    expect(atalhoDaNoiteAtual(m)).toBe('escuridao-total')
  })

  it('Noite leve devolve a visão à regra de sempre (sem campo) e a tarde não muda', () => {
    const tarde = comAmbienteDoPeriodo(comAtalhoDaNoite(cena(), 'escuridao-total'), 'tarde', { forca: 0.1 })
    const leve = comAtalhoDaNoite(tarde, 'noite-leve')
    expect(leve.visaoPorPeriodo).toBeUndefined()
    expect(leve.ambientePorPeriodo?.tarde).toEqual({ forca: 0.1 })
    expect(atalhoDaNoiteAtual(leve)).toBe('noite-leve')
    expect(comAtalhoDaNoite(leve, 'noite-leve')).toBe(leve)
  })

  it('mexer na força depois do atalho deixa de casar com ele', () => {
    const m = comAmbienteDoPeriodo(comAtalhoDaNoite(cena(), 'noite-fechada'), 'noite', { forca: 0.7 })
    expect(atalhoDaNoiteAtual(m)).toBeUndefined()
  })
})

describe('voltar ao padrão', () => {
  it('tira tinta e visão do período; o mapa volta a serializar igual ao de antes', () => {
    const base = cena()
    const mexido = comVisaoDoPeriodo(comAmbienteDoPeriodo(base, 'noite', { forca: 0.2, cor: '#000000' }), 'noite', 4)
    const devolvido = semAjusteDoPeriodo(mexido, 'noite')
    expect(serializeMap(devolvido)).toBe(serializeMap(base))
    expect(semAjusteDoPeriodo(base, 'noite')).toBe(base)
  })

  it('a tarde fica quando só a noite volta', () => {
    const m = semAjusteDoPeriodo(comAmbienteDoPeriodo(comAtalhoDaNoite(cena(), 'noite-fechada'), 'tarde', { forca: 0.5 }), 'noite')
    expect(m.ambientePorPeriodo).toEqual({ tarde: { forca: 0.5 } })
    expect(m.visaoPorPeriodo).toBeUndefined()
  })
})

describe('arquivo', () => {
  it('maps/L1.json sai byte a byte igual, também depois de passar pelo painel e voltar ao padrão', () => {
    const lido = deserializeMap(JSON.stringify(l1Json))
    expect('ambientePorPeriodo' in lido || 'visaoPorPeriodo' in lido || 'periodoFixo' in lido).toBe(false)
    const congelado = JSON.stringify(antesL1, null, 2)
    expect(serializeMap(lido)).toBe(congelado)
    let mexido = comPeriodoFixo(lido, 'noite')
    for (const atalho of ATALHOS_DA_NOITE) mexido = comAtalhoDaNoite(mexido, atalho.id)
    mexido = comVisaoDoPeriodo(comAmbienteDoPeriodo(mexido, 'tarde', { cor: '#123456', forca: 0.1 }), 'tarde', 9)
    const devolvido = comPeriodoFixo(semAjusteDoPeriodo(semAjusteDoPeriodo(mexido, 'tarde'), 'noite'), undefined)
    expect(serializeMap(devolvido)).toBe(congelado)
  })

  it('o que o painel grava volta igual do disco', () => {
    const m = comPeriodoFixo(comVisaoDoPeriodo(comAmbienteDoPeriodo(cena(), 'noite', { cor: '#223344', forca: 0.65 }), 'noite', 3), 'noite')
    const lido = deserializeMap(serializeMap(m))
    expect(lido.ambientePorPeriodo).toEqual(m.ambientePorPeriodo)
    expect(lido.visaoPorPeriodo).toEqual(m.visaoPorPeriodo)
    expect(lido.periodoFixo).toBe('noite')
  })
})
