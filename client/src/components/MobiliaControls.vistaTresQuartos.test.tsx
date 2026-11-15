import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Prop } from '../types/map'
import { trocarObraNoTeste } from '../lib/estiloDoMapa'
import { useMapStore } from '../stores/mapStore'
import { MobiliaControls } from './MobiliaControls'

/**
 * "VISTA 3/4" no painel do móvel (MT11; por objeto desde 15/11/2026): liga a
 * 3/4 SÓ neste objeto (`Prop.mobiliaTresQuartos`), com Ctrl+Z, sem mexer no
 * mapa nem nos outros móveis. Só aparece com a obra do Meio-Termo ligada (sem
 * ela a vista não desenha nada) e onde a vista muda o desenho. O mapa inteiro
 * muda por `definirVistaDosMoveis` ("Todos os móveis em 3/4").
 */

const BARRIL: Prop = { id: 'b', src: '', x: 100, y: 100, width: 50, height: 50, linkedMapPath: null, mobilia: 'barril' }
const CAIXA: Prop = { id: 'c', src: '', x: 200, y: 100, width: 50, height: 50, linkedMapPath: null, mobilia: 'caixa' }

let container: HTMLDivElement
let root: Root

function porNoMapa(props: Prop[]): void {
  const { vistaDosMoveis: _v, ...mapa } = useMapStore.getState().map
  useMapStore.setState({ map: { ...mapa, props }, selection: [], past: [], future: [] })
}

function doMapa(id: string): Prop {
  const achado = useMapStore.getState().map.props.find((p) => p.id === id)
  if (achado === undefined) throw new Error(`sem ${id}`)
  return achado
}

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  porNoMapa([BARRIL, CAIXA])
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  trocarObraNoTeste(false)
})

/** A ficha do móvel `id` como o app a monta: com o objeto de AGORA do mapa. */
function render(id = 'b'): void {
  const nada = (): void => {}
  act(() => root.render(<MobiliaControls parte="essencial" prop={doMapa(id)} onTipoChange={nada} onVistaChange={nada} onFormaChange={nada} onAparenciaChange={nada} />))
}

function interruptor(): HTMLInputElement | null {
  const rotulo = [...container.querySelectorAll('label.lb-switch')].find((l) => l.textContent?.includes('Vista 3/4'))
  return rotulo?.querySelector('input') ?? null
}

describe('interruptor "Vista 3/4" do móvel', () => {
  it('não aparece com a obra desligada', () => {
    trocarObraNoTeste(false)
    render()
    expect(interruptor()).toBeNull()
  })

  it('com a obra: liga e desliga a 3/4 só neste objeto, com desfazer, e diz em português o que faz', () => {
    trocarObraNoTeste(true)
    render()
    const input = interruptor()
    expect(input).not.toBeNull()
    expect(input?.checked).toBe(false)
    const ajuda = document.getElementById(input?.getAttribute('aria-describedby') ?? '')
    expect(ajuda?.textContent).toContain('Só este objeto')
    act(() => input?.click())
    expect(doMapa('b').mobiliaTresQuartos).toBe(true)
    // O mapa e o outro móvel ficam como estavam.
    expect('vistaDosMoveis' in useMapStore.getState().map).toBe(false)
    expect(doMapa('c')).toEqual(CAIXA)
    render()
    expect(interruptor()?.checked).toBe(true)
    act(() => useMapStore.getState().undo())
    expect('mobiliaTresQuartos' in doMapa('b')).toBe(false)
    act(() => useMapStore.getState().redo())
    expect(doMapa('b').mobiliaTresQuartos).toBe(true)
    render()
    // Desligar volta a seguir o mapa: o campo sai, não fica `false`.
    act(() => interruptor()?.click())
    expect('mobiliaTresQuartos' in doMapa('b')).toBe(false)
  })

  it('chave por objeto com o mapa em 3/4: desligar grava só nele; mudar o mapa inteiro apaga as escolhas num desfazer só; some no tapete e nas linhas', () => {
    trocarObraNoTeste(true)
    act(() => useMapStore.getState().definirVistaDosMoveis('tres-quartos'))
    render()
    // Sem escolha, o móvel segue o mapa.
    expect(interruptor()?.checked).toBe(true)
    act(() => interruptor()?.click())
    expect(doMapa('b').mobiliaTresQuartos).toBe(false)
    expect('mobiliaTresQuartos' in doMapa('c')).toBe(false)
    expect(useMapStore.getState().map.vistaDosMoveis).toBe('tres-quartos')
    render()
    expect(interruptor()?.checked).toBe(false)
    // "Todos os móveis em 3/4" desligado: o mapa volta a de cima e a escolha do barril some, num passo só.
    const passos = useMapStore.getState().past.length
    act(() => useMapStore.getState().definirVistaDosMoveis(undefined))
    expect(useMapStore.getState().past).toHaveLength(passos + 1)
    expect('vistaDosMoveis' in useMapStore.getState().map).toBe(false)
    expect(useMapStore.getState().map.props.some((p) => 'mobiliaTresQuartos' in p)).toBe(false)
    act(() => useMapStore.getState().undo())
    expect(doMapa('b').mobiliaTresQuartos).toBe(false)
    expect(useMapStore.getState().map.vistaDosMoveis).toBe('tres-quartos')
    // Onde a vista não muda o desenho, a chave não entra.
    porNoMapa([{ ...BARRIL, id: 't', mobilia: 'tapete' }, { ...BARRIL, id: 'l', mobilia: 'mesa', mobiliaDesenho: 'linhas' }])
    render('t')
    expect(interruptor()).toBeNull()
    render('l')
    expect(interruptor()).toBeNull()
  })
})
