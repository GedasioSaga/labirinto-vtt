// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { EMPTY_SELECTION } from '../lib/selectionModel'
import { relevantPropertyGroups } from '../lib/toolProperties'
import { useMapStore } from '../stores/mapStore'
import { mudarRaioDeVisaoDaSala, mudarVistaDeLonge } from '../stores/visaoDeLonge'
import type { Light, Region } from '../types/map'
import { PropertiesPanel } from './PropertiesPanel'
import { propsDoPainel } from './propertiesPanelTestProps'

/*
 * "Raio de visão aqui" e "Vista de longe" no painel de propriedades DE VERDADE,
 * ligados ao mapa pelas MESMAS funções que o App passa (`stores/visaoDeLonge.ts`).
 * `RoomControls.raioDeVisao.test` e `LightControls.vistaDeLonge.test` provam os
 * controles soltos, com o callback injetado; aqui a prova é a costura: o painel
 * lê o valor da Sala/luz selecionada e o clique chega ao mapa com histórico.
 */

const SALA: Region = {
  id: 'mirante',
  points: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }],
  tag: '',
  fillColor: '#123',
  fillPattern: 'solid',
  data: {},
  room: { shape: 'rect', name: 'Mirante' },
}

const LAMPIAO: Light = { id: 'lampiao', x: 900, y: 300, radius: 200, color: '#ffcc66', intensity: 0.8 }

describe('painel de propriedades — raio de visão da Sala e luz vista de longe', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    useMapStore.setState({
      map: { ...createEmptyMap('m1', 'Vale', 20, 20, 50), regions: [SALA], lights: [LAMPIAO] },
      camera: { x: 0, y: 0, scale: 1 },
      selection: EMPTY_SELECTION,
      past: [],
      future: [],
    })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function salaNoMapa(): Region {
    const sala = useMapStore.getState().map.regions.find((r) => r.id === SALA.id)
    if (sala === undefined) throw new Error('a sala não está no mapa')
    return sala
  }

  function luzNoMapa(): Light {
    const luz = useMapStore.getState().map.lights.find((l) => l.id === LAMPIAO.id)
    if (luz === undefined) throw new Error('o lampião não está no mapa')
    return luz
  }

  /** O painel com a Sala como está no mapa AGORA e a ligação de App.tsx (`room.onRaioDeVisaoChange`). */
  function renderSala(): void {
    const sala = salaNoMapa()
    const props = propsDoPainel(null, {
      groups: relevantPropertyGroups('select', { region: true, regionIsRoom: true }),
      selectedRegion: sala,
      room: {
        onNameChange: () => {},
        onWidthChange: () => {},
        onHeightChange: () => {},
        onRotationChange: () => {},
        onRotateBy: () => {},
        onRaioDeVisaoChange: (raio) => mudarRaioDeVisaoDaSala(sala.id, raio),
      },
    })
    act(() => root.render(<PropertiesPanel {...props} />))
  }

  /** O painel com a luz como está no mapa AGORA e a ligação de App.tsx (`lightControls.onVistaDeLongeChange`). */
  function renderLuz(): void {
    const luz = luzNoMapa()
    const props = propsDoPainel(null, {
      groups: relevantPropertyGroups('select', { light: true }),
      selectedLight: luz,
      lightControls: {
        onColorChange: () => {},
        onIntensityChange: () => {},
        tokens: [],
        onAttach: () => {},
        onDetach: () => {},
        onVistaDeLongeChange: (vistaDeLonge) => mudarVistaDeLonge(luz.id, vistaDeLonge),
      },
    })
    act(() => root.render(<PropertiesPanel {...props} />))
  }

  function campoRaio(): HTMLInputElement {
    const label = [...container.querySelectorAll('label')].find((l) => l.textContent?.trim() === 'Raio de visão aqui')
    const input = label ? document.getElementById(label.htmlFor) : null
    if (!(input instanceof HTMLInputElement)) throw new Error('o painel da Sala não tem o campo "Raio de visão aqui"')
    return input
  }

  function confirmar(input: HTMLInputElement, valor: string): void {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      setter?.call(input, valor)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    })
  }

  function interruptorVistaDeLonge(): HTMLInputElement {
    const rotulo = [...container.querySelectorAll('label')].find((el) => (el.textContent ?? '').includes('Vista de longe'))
    const caixa = rotulo?.querySelector('input[type="checkbox"]')
    if (!(caixa instanceof HTMLInputElement)) throw new Error('o painel da luz não tem o interruptor "Vista de longe"')
    return caixa
  }

  it('Sala sem raio próprio: o campo aparece vazio; confirmar 700 grava no mapa com um desfazer', () => {
    renderSala()
    expect(campoRaio().value).toBe('')

    confirmar(campoRaio(), '700')
    expect(salaNoMapa().room?.raioDeVisao).toBe(700)
    expect(useMapStore.getState().past.length).toBe(1)

    useMapStore.getState().undo()
    expect(salaNoMapa().room?.raioDeVisao).toBeUndefined()
  })

  it('o painel mostra o raio que a Sala já tem, e apagar o número a devolve ao raio do jogador', () => {
    mudarRaioDeVisaoDaSala(SALA.id, 1500)
    renderSala()
    expect(campoRaio().value).toBe('1500')

    confirmar(campoRaio(), '')
    const room = salaNoMapa().room
    expect(room?.name).toBe('Mirante')
    expect(Object.keys(room ?? {})).not.toContain('raioDeVisao')
  })

  it('luz comum: "Vista de longe" desligado; ligar grava no mapa (um desfazer) e o painel reabre ligado', () => {
    renderLuz()
    expect(interruptorVistaDeLonge().checked).toBe(false)

    act(() => interruptorVistaDeLonge().click())
    expect(luzNoMapa().vistaDeLonge).toBe(true)
    expect(useMapStore.getState().past.length).toBe(1)

    renderLuz()
    expect(interruptorVistaDeLonge().checked).toBe(true)
  })

  it('desligar "Vista de longe" tira a marca do mapa, sem gravar false', () => {
    mudarVistaDeLonge(LAMPIAO.id, true)
    renderLuz()
    expect(interruptorVistaDeLonge().checked).toBe(true)

    act(() => interruptorVistaDeLonge().click())
    expect(luzNoMapa().vistaDeLonge).toBeUndefined()
    expect(JSON.stringify(luzNoMapa())).not.toContain('vistaDeLonge')
  })
})
