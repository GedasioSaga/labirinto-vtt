/**
 * Janela do corte da torre: dois trechos de mesmo nome em alturas separadas
 * desenham dois fios, cada um só nas linhas dos andares que liga — nenhum fio
 * atravessa o andar que ninguém liga.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { CorteCena } from '../lib/corteDaTorre'
import type { MapData, Pin } from '../types/map'
import { CorteDaTorreDialog } from './CorteDaTorre'

function pino(id: string, descricao: string, sceneId: string, pinId: string): Pin {
  return { id, x: 10, y: 10, kind: 'viagem', description: descricao, image: null, destino: { sceneId, pinId } }
}

function mapa(id: string, pins: Pin[]): MapData {
  return { ...createEmptyMap(`m_${id}`, id, 20, 16, 50), pins }
}

// Cinco andares: 'a' é o 1 (embaixo), 'e' é o 5 (no alto, linha 1 da grade).
const CENAS: CorteCena[] = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, name: id.toUpperCase(), available: true, active: false }))

describe('CorteDaTorreDialog: poços', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function pocosDesenhados(maps: ReadonlyMap<string, MapData>) {
    act(() => root.render(<CorteDaTorreDialog scenes={CENAS} maps={maps} players={[]} onPickScene={() => {}} onPickPoint={() => {}} onClose={() => {}} />))
    return Array.from(document.body.querySelectorAll<HTMLElement>('[data-poco]')).map((el) => ({
      rotulo: el.getAttribute('aria-label'),
      linhas: el.style.gridRow,
    }))
  }

  it('Escada 1-2 e outra Escada 4-5 viram dois fios, e o andar 3 fica sem fio', () => {
    const maps = new Map([
      ['a', mapa('a', [pino('a1', 'Escada', 'b', 'b1')])],
      ['b', mapa('b', [pino('b1', 'Escada', 'a', 'a1')])],
      ['c', mapa('c', [])],
      ['d', mapa('d', [pino('d1', 'Escada', 'e', 'e1')])],
      ['e', mapa('e', [pino('e1', 'Escada', 'd', 'd1')])],
    ])
    // Andar n está na linha 5 - n + 1: o 1-2 ocupa as linhas 4 e 5; o 4-5, as linhas 1 e 2; a linha 3 (andar 3) fica livre.
    expect(pocosDesenhados(maps)).toEqual([
      { rotulo: 'Poço Escada: do andar 1 ao 2', linhas: '4 / 6' },
      { rotulo: 'Poço Escada: do andar 4 ao 5', linhas: '1 / 3' },
    ])
  })

  it('dois pinos de viagem sem descrição em alturas separadas não viram um fio do 1 ao 5', () => {
    const maps = new Map([
      ['a', mapa('a', [pino('a1', '', 'b', 'b1')])],
      ['b', mapa('b', [pino('b1', '', 'a', 'a1')])],
      ['c', mapa('c', [])],
      ['d', mapa('d', [pino('d1', '', 'e', 'e1')])],
      ['e', mapa('e', [pino('e1', '', 'd', 'd1')])],
    ])
    expect(pocosDesenhados(maps)).toEqual([
      { rotulo: 'Poço Pino de viagem: do andar 1 ao 2', linhas: '4 / 6' },
      { rotulo: 'Poço Pino de viagem: do andar 4 ao 5', linhas: '1 / 3' },
    ])
  })
})
