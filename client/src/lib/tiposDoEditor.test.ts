import { describe, expect, it } from 'vitest'
import { EMPTY_AREA_SELECTION, isAreaSelectionEmpty } from './areaSelection'
import { createEmptyMap } from './mapFactory'
import { comCadaTipo, ehTipoDoEditor, TIPOS_DO_EDITOR, TODOS_OS_TIPOS, type TrocaDeLista } from './tiposDoEditor'
import type { SelectionKind } from '../types/tools'

/**
 * A TABELA DOS TIPOS DO EDITOR (análise 18/11/2026, seção 3, causa 1): "cada
 * tipo × cada operação de conjunto". A tabela é exaustiva pelo compilador; o
 * que este teste segura é o lado de fora dela: a operação que anda pela tabela
 * alcança os 14, e a caixa (a seleção por área) enxerga cada um por um campo
 * próprio. Tipo novo que ganhar linha sem campo próprio, ou campo esquecido no
 * "seleção vazia?", fica vermelho aqui.
 */

const OS_14: readonly SelectionKind[] = ['wall', 'region', 'light', 'token', 'prop', 'stair', 'drawing', 'carimbo', 'pin', 'zone', 'agua', 'barranco', 'abismo', 'floor']

describe('tabela dos tipos do editor', () => {
  it('comCadaTipo (mover, levar ao piso, nascer no piso) passa pela lista de cada um dos 14, uma vez, na ordem da tabela; sem troca, o mesmo mapa', () => {
    const map = createEmptyMap('map_tipos', 'Tipos', 10, 10, 64)
    const vistos: SelectionKind[] = []
    const registrar: TrocaDeLista = (lista, tipo) => {
      vistos.push(tipo)
      return lista
    }
    expect(comCadaTipo(map, registrar)).toBe(map)
    expect(vistos).toEqual(OS_14)
    expect(TODOS_OS_TIPOS).toEqual(OS_14)
    expect(OS_14.every(ehTipoDoEditor)).toBe(true)
    expect(ehTipoDoEditor('toString')).toBe(false)
  })

  it('a caixa enxerga cada tipo por um campo próprio, e um item só daquele tipo já não é "seleção vazia"', () => {
    const campos = OS_14.map((tipo) => TIPOS_DO_EDITOR[tipo].naArea)
    expect(new Set(campos).size).toBe(OS_14.length)
    for (const tipo of OS_14) {
      const campo = TIPOS_DO_EDITOR[tipo].naArea
      expect({ tipo, vazia: isAreaSelectionEmpty({ ...EMPTY_AREA_SELECTION, [campo]: ['item-1'] }) }).toEqual({ tipo, vazia: false })
    }
    expect(isAreaSelectionEmpty(EMPTY_AREA_SELECTION)).toBe(true)
  })
})
