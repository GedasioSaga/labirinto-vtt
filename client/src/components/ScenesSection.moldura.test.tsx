import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SceneListItem } from '../stores/adventureStore'
import { ScenesSection } from './ScenesSection'

/**
 * MOLDURA DO PAINEL ENXUTA (27/09/2026): "Cenas" nasce na MESMA regra de
 * "Chão do mapa" e "Camadas" — aberta só com Selecionar e nada selecionado.
 * Com uma sala na mão, a lista de cenas aberta empurrava a ficha do item para
 * baixo da dobra. A escolha do mestre (abriu ou fechou à mão) continua valendo.
 */

const CENAS: SceneListItem[] = [
  { id: 's-a', name: 'Salao', active: true, available: true, renamable: true, tokenCount: 2 },
  { id: 's-b', name: 'Cripta', active: false, available: true, renamable: false, tokenCount: 0 },
]

const nada = () => undefined

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  window.localStorage.clear()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  window.localStorage.clear()
})

function montar(defaultOpen?: boolean) {
  act(() => root.render(<ScenesSection scenes={CENAS} onSelect={nada} onCreate={nada} onRename={nada} defaultOpen={defaultOpen} />))
}

/** O cabeçalho "Cenas": o primeiro botão de seção recolhível da lista. */
function cabecalho(): HTMLButtonElement {
  const botao = container.querySelector<HTMLButtonElement>('button.lb-collapsible__toggle')
  if (botao === null) throw new Error('Cenas sem cabeçalho')
  return botao
}

function corpo(): HTMLElement {
  const alvo = document.getElementById(cabecalho().getAttribute('aria-controls') ?? '')
  if (alvo === null) throw new Error('aria-controls de Cenas não aponta para corpo nenhum')
  return alvo
}

describe('Cenas nasce na regra de Chão do mapa e Camadas', () => {
  it('fora de Selecionar sem seleção, nasce recolhida; o cabeçalho continua botão que controla o corpo', () => {
    montar(false)
    expect(cabecalho().textContent).toContain('Cenas')
    expect(cabecalho().getAttribute('aria-expanded')).toBe('false')
    expect(corpo().hidden).toBe(true)
  })

  it('recolhida, um clique no cabeçalho abre a lista', () => {
    montar(false)
    act(() => cabecalho().click())
    expect(cabecalho().getAttribute('aria-expanded')).toBe('true')
    expect(corpo().hidden).toBe(false)
    expect(corpo().textContent).toContain('Cripta')
  })

  it('sem a regra (quem não passa a prop), continua nascendo aberta', () => {
    montar()
    expect(cabecalho().getAttribute('aria-expanded')).toBe('true')
  })

  it('aberta à mão fica aberta, mesmo com a regra dizendo recolhida', () => {
    window.localStorage.setItem('lb-section:scenes', '1')
    montar(false)
    expect(cabecalho().getAttribute('aria-expanded')).toBe('true')
  })

  it('fechada à mão fica fechada, mesmo com a regra dizendo aberta', () => {
    window.localStorage.setItem('lb-section:scenes', '0')
    montar(true)
    expect(cabecalho().getAttribute('aria-expanded')).toBe('false')
  })
})
