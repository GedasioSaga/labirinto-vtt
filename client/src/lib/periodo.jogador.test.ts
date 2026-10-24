/**
 * DIA/TARDE/NOITE (Luz L1): o que o JOGADOR recebe do período. Só o período
 * da cena DELE e a tinta desse período (cor e força); dia = nada (o campo nem
 * sai). A leitura do lado do jogador recusa o que não tem a forma e joga fora
 * o que vier a mais (pacote forjado). A noite encolhe a visão como o relógio
 * fazia (`VISAO_DA_NOITE`), até a L2 trazer `visaoPorPeriodo`.
 */
import { describe, expect, it } from 'vitest'
import type { MapData } from '../types/map'
import { AMBIENTE_PADRAO, comCenaExterna, lerLuzDoJogador, luzParaJogador, raioNoPeriodo, VISAO_DA_NOITE } from './periodo'
import { createEmptyMap } from './mapFactory'

const EXTERNA: Pick<MapData, 'externa'> = { externa: true }

describe('luzParaJogador', () => {
  it('cena externa segue a sessão, com a tinta padrão do período', () => {
    expect(luzParaJogador(EXTERNA, 'noite')).toEqual({ periodo: 'noite', ...AMBIENTE_PADRAO.noite })
    expect(luzParaJogador(EXTERNA, 'tarde')).toEqual({ periodo: 'tarde', ...AMBIENTE_PADRAO.tarde })
  })

  it('dia, cena interior e mestre sem período: nada (o campo nem sai)', () => {
    expect(luzParaJogador(EXTERNA, 'dia')).toBeNull()
    expect(luzParaJogador({}, 'noite')).toBeNull()
    expect(luzParaJogador(EXTERNA, null)).toBeNull()
    // 'manha' do relógio antigo é dia.
    expect(luzParaJogador(EXTERNA, 'manha')).toBeNull()
  })

  it('cena com período fixo usa o fixo e a tinta da própria cena', () => {
    const fixa: Pick<MapData, 'periodoFixo' | 'ambientePorPeriodo'> = { periodoFixo: 'tarde', ambientePorPeriodo: { tarde: { cor: '#aa3311', forca: 0.4 }, noite: { cor: '#010203', forca: 1 } } }
    expect(luzParaJogador(fixa, 'noite')).toEqual({ periodo: 'tarde', cor: '#aa3311', forca: 0.4 })
    expect(luzParaJogador(fixa, 'dia')).toEqual({ periodo: 'tarde', cor: '#aa3311', forca: 0.4 })
  })

  it('só três chaves: período, cor e força', () => {
    const cena: Pick<MapData, 'externa' | 'periodoFixo' | 'visaoPorPeriodo'> = { externa: true, periodoFixo: 'noite', visaoPorPeriodo: { noite: 2 } }
    const luz = luzParaJogador(cena, 'tarde')
    expect(Object.keys(luz ?? {}).sort()).toEqual(['cor', 'forca', 'periodo'])
  })
})

describe('lerLuzDoJogador (o que chega pela rede)', () => {
  it('lê a forma certa e joga fora o que vier a mais', () => {
    const forjado = { periodo: 'noite', cor: '#465a92', forca: 0.85, periodoFixo: 'noite', acesaEm: ['noite'], outraCena: { periodo: 'tarde' } }
    expect(lerLuzDoJogador(forjado)).toEqual({ periodo: 'noite', cor: '#465a92', forca: 0.85 })
  })

  it('recusa o que não tem a forma', () => {
    for (const torto of [null, 'noite', [], {}, { periodo: 'manha', cor: '#000000', forca: 0 }, { periodo: 'noite', cor: 'azul', forca: 0.5 }, { periodo: 'noite', cor: '#000000', forca: 2 }, { periodo: 'noite', cor: '#000000', forca: Number.NaN }, { periodo: 'noite', cor: '#000000' }]) {
      expect(lerLuzDoJogador(torto)).toBeNull()
    }
  })
})

describe('raioNoPeriodo', () => {
  it('a noite tira metade da visão; dia e tarde ficam iguais', () => {
    expect(raioNoPeriodo(700, 'noite')).toBe(Math.round(700 * VISAO_DA_NOITE))
    expect(raioNoPeriodo(700, 'tarde')).toBe(700)
    expect(raioNoPeriodo(700, 'dia')).toBe(700)
  })
})

describe('comCenaExterna', () => {
  it('liga e desliga a marca; desligada, a cena volta igual a mapa antigo', () => {
    const antes = createEmptyMap('m', 'Pátio', 10, 10, 50)
    const externa = comCenaExterna(antes, true)
    expect(externa.externa).toBe(true)
    expect(comCenaExterna(externa, true)).toBe(externa)
    const interna = comCenaExterna(externa, false)
    expect('externa' in interna).toBe(false)
    expect(comCenaExterna(antes, false)).toBe(antes)
  })
})
