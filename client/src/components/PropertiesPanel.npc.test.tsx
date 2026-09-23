import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { EMPTY_SELECTION } from '../lib/selectionModel'
import { colocarPecaDoAcervo, criarToken, marcarFichaNpc } from '../stores/criarToken'
import { useMapStore } from '../stores/mapStore'
import type { Token } from '../types/map'
import { PropertiesPanel } from './PropertiesPanel'
import { propsDoPainel } from './propertiesPanelTestProps'
import { TOKEN_NPC_HINT } from './TokenNpcControls'

/*
 * O interruptor "Ficha de NPC" tem de estar no painel de propriedades DE
 * VERDADE, na seção da ficha selecionada, e ligado ao mapa pelo mesmo
 * `marcarFichaNpc` que o App passa em `tokenNpc`. Renderizar o controle solto
 * não prova isso: tirá-lo do `PropertiesPanel` deixaria aquele teste verde.
 */

describe('"Ficha de NPC" no painel de propriedades', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    useMapStore.setState({
      map: createEmptyMap('m1', 'Casa', 20, 20, 50),
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

  function fichaNoMapa(id: string): Token {
    const ficha = useMapStore.getState().map.tokens.find((t) => t.id === id)
    if (ficha === undefined) throw new Error(`ficha ${id} não está no mapa`)
    return ficha
  }

  /** Renderiza o painel com a ficha como está no mapa AGORA, como o App faz a cada mudança da store. */
  function renderPainel(id: string): void {
    // A mesma ligação de App.tsx (`tokenNpc`).
    const props = propsDoPainel(fichaNoMapa(id), { tokenNpc: { onNpcChange: (npc) => marcarFichaNpc(id, npc) } })
    act(() => root.render(<PropertiesPanel {...props} />))
  }

  /** O interruptor achado pelo rótulo visível, como o mestre acha. */
  function interruptorNpc(): HTMLInputElement | null {
    const rotulo = Array.from(container.querySelectorAll('label')).find((el) => (el.textContent ?? '').includes('Ficha de NPC'))
    return rotulo?.querySelector('input[type="checkbox"]') ?? null
  }

  it('ficha comum selecionada: o painel mostra "Ficha de NPC" desligado, com a dica do que muda', () => {
    const id = criarToken('Gina', { at: { x: 300, y: 300 } }, null)
    if (id === null) throw new Error('a ficha não nasceu')
    renderPainel(id)

    const caixa = interruptorNpc()
    expect(caixa).not.toBe(null)
    expect(caixa?.checked).toBe(false)
    expect(document.getElementById(caixa?.getAttribute('aria-describedby') ?? '')?.textContent).toBe(TOKEN_NPC_HINT)
  })

  it('ligar no painel grava npc: true no mapa (um desfazer); desligar grava false', () => {
    const id = criarToken('Mordomo', { at: { x: 300, y: 300 } }, null)
    if (id === null) throw new Error('a ficha não nasceu')
    renderPainel(id)
    const antes = useMapStore.getState().past.length

    act(() => interruptorNpc()?.click())
    expect(fichaNoMapa(id).npc).toBe(true)
    expect(useMapStore.getState().past.length).toBe(antes + 1)

    renderPainel(id)
    expect(interruptorNpc()?.checked).toBe(true)
    act(() => interruptorNpc()?.click())
    expect(fichaNoMapa(id).npc).toBe(false)
  })

  it('ficha trazida do acervo abre no painel já com "Ficha de NPC" ligado', () => {
    const id = colocarPecaDoAcervo({ nome: 'Mordomo', tamanho: 1 }, 'tok-mordomo', { image: null, imageData: null }, { x: 300, y: 300 }, null)
    if (id === null) throw new Error('a ficha não nasceu')
    renderPainel(id)

    expect(interruptorNpc()?.checked).toBe(true)
  })
})
