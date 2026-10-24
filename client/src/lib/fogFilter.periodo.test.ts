/**
 * DIA/TARDE/NOITE no recorte do jogador (Luz L1, aviso da L0): as marcas de
 * período da cena são do mestre. `externa`, `periodoFixo`,
 * `ambientePorPeriodo` e `visaoPorPeriodo` NUNCA saem dentro do mapa do
 * jogador — ele recebe só o período e a tinta da cena dele, à parte
 * (`snapshot.luz`, montado no host). Pacote forjado: o mapa do mestre com
 * todos os campos (e valores tortos) não deixa nenhum passar.
 */
import { describe, expect, it } from 'vitest'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'
import type { MapData } from '../types/map'

const SEGREDOS = ['externa', 'periodoFixo', 'ambientePorPeriodo', 'visaoPorPeriodo'] as const

function patioDoMestre(): MapData {
  return {
    ...createEmptyMap('patio', 'Pátio', 20, 20, 50),
    externa: true,
    periodoFixo: 'noite',
    ambientePorPeriodo: { tarde: { cor: '#c0ffee', forca: 0.3 }, noite: { cor: '#0b0b0b', forca: 1 } },
    visaoPorPeriodo: { tarde: 7, noite: 0 },
    tokens: [{ id: 'heroi', characterId: null, name: 'Ana', x: 200, y: 200, size: 1, image: null }],
  }
}

describe('filterMapForPlayer e as marcas de período da cena', () => {
  it('nenhuma marca de período sai dentro do mapa do jogador', () => {
    const view = filterMapForPlayer(patioDoMestre(), 'p1', { p1: ['heroi'] }, 700)
    expect(view.map.tokens.map((t) => t.id)).toEqual(['heroi'])
    for (const campo of SEGREDOS) expect(campo in view.map, campo).toBe(false)
    const texto = JSON.stringify(view)
    for (const valor of ['#c0ffee', '#0b0b0b', 'periodoFixo', 'acesaEm']) expect(texto).not.toContain(valor)
  })

  it('pacote forjado: valor torto nas marcas também não passa', () => {
    const forjado = { ...patioDoMestre(), periodoFixo: 'manha', ambientePorPeriodo: 'tudo escuro', visaoPorPeriodo: [1, 2, 3] } as unknown as MapData // forja de propósito: o mapa cru pode vir torto do arquivo editado à mão
    const view = filterMapForPlayer(forjado, 'p1', { p1: ['heroi'] }, 700)
    for (const campo of SEGREDOS) expect(campo in view.map, campo).toBe(false)
    expect(JSON.stringify(view)).not.toContain('tudo escuro')
  })
})
