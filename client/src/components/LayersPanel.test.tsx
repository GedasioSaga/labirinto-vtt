import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CamadaId, MapData } from '../types/map'
import { alternarCadeado, alternarOlhoDoMestre, alternarOlhoDosJogadores, definirOpacidade } from '../lib/camadas/estado'
import { CAMADAS_PADRAO } from '../lib/camadas/padrao'
import { createEmptyMap } from '../lib/mapFactory'
import { LayersPanel } from './LayersPanel'

const COUNTS: Partial<Record<CamadaId, number>> = { paredes: 3, portas: 1, objetos: 2, tokens: 4, chao: 2 }

type Pedido = { tipo: 'mestre' | 'jogadores' | 'cadeado'; id: CamadaId } | { tipo: 'opacidade'; id: CamadaId; valor: number; gesto: string }

/**
 * Estado real (as funções da store, `lib/camadas/estado.ts`) para provar que
 * `aria-pressed`, o nome e o slider acompanham cada controle, e um espião para
 * provar que cada controle pede a camada certa.
 */
function Harness({ pedir, inicial }: { pedir: (pedido: Pedido) => void; inicial: MapData }) {
  const [map, setMap] = useState(inicial)
  return (
    <LayersPanel
      camadas={map}
      counts={COUNTS}
      onToggleLayer={(id) => {
        pedir({ tipo: 'mestre', id })
        setMap((m) => alternarOlhoDoMestre(m, id))
      }}
      onTogglePlayers={(id) => {
        pedir({ tipo: 'jogadores', id })
        setMap((m) => alternarOlhoDosJogadores(m, id))
      }}
      onToggleLock={(id) => {
        pedir({ tipo: 'cadeado', id })
        setMap((m) => alternarCadeado(m, id))
      }}
      onOpacity={(id, valor, gesto) => {
        pedir({ tipo: 'opacidade', id, valor, gesto })
        setMap((m) => definirOpacidade(m, id, valor))
      }}
      chao={<ul aria-label="Camadas do chão" />}
      telhados={<label>Transparente</label>}
    />
  )
}

describe('LayersPanel: as 13 camadas (fatia 6)', () => {
  let container: HTMLDivElement
  let root: Root
  let pedir: ReturnType<typeof vi.fn<(pedido: Pedido) => void>>

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    pedir = vi.fn<(pedido: Pedido) => void>()
    act(() => root.render(<Harness pedir={pedir} inicial={createEmptyMap('m', 'M', 10, 10, 64)} />))
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  const button = (name: string) => {
    const found = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((el) => el.getAttribute('aria-label') === name)
    if (found === undefined) throw new Error(`sem botão ${name}`)
    return found
  }
  const slider = (name: string) => {
    const found = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="range"]')).find((el) => el.getAttribute('aria-label') === name)
    if (found === undefined) throw new Error(`sem slider ${name}`)
    return found
  }
  const linhas = () => Array.from(container.querySelectorAll<HTMLLIElement>('ul[aria-label="Camadas do mapa"] > li'))
  /** Arrasta o slider: aperta, passa por cada valor e solta (como a mão). */
  const arrastar = (alvo: HTMLInputElement, valores: number[]) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      alvo.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    })
    for (const valor of valores) {
      act(() => {
        setter?.call(alvo, String(valor))
        alvo.dispatchEvent(new Event('input', { bubbles: true }))
      })
    }
    act(() => {
      alvo.dispatchEvent(new Event('pointerup', { bubbles: true }))
    })
  }

  it('13 linhas, de cima (Telhados) para baixo (Chão); o texto da linha é só nome e contagem', () => {
    const nomes = linhas().map((li) => li.getAttribute('data-camada'))
    expect(nomes).toEqual([...CAMADAS_PADRAO].reverse())
    const paredes = linhas().find((li) => li.getAttribute('data-camada') === 'paredes')
    expect(paredes?.textContent).toBe('Paredes3')
    expect(paredes?.querySelectorAll('button.lb-iconbtn')).toHaveLength(3)
    expect(paredes?.querySelectorAll('input[type="range"]')).toHaveLength(1)
    expect(paredes?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('olho do mestre: nome e aria-pressed do jeito das jornadas seladas', () => {
    act(() => button('Ocultar Paredes').click())
    expect(pedir).toHaveBeenLastCalledWith({ tipo: 'mestre', id: 'paredes' })
    expect(button('Mostrar Paredes').getAttribute('aria-pressed')).toBe('true')
    expect(button('Mostrar Paredes').closest('li')?.hasAttribute('data-hidden')).toBe(true)
    // Mapa de antes: a oculta de antes some também para os jogadores (o olho deles mostra isso).
    expect(button('Mostrar Paredes aos jogadores').getAttribute('aria-pressed')).toBe('true')
  })

  it('olho dos jogadores: "Ocultar X dos jogadores" / "Mostrar X aos jogadores" com aria-pressed; o do mestre não muda', () => {
    const olho = button('Ocultar Tokens dos jogadores')
    expect(olho.getAttribute('aria-pressed')).toBe('false')
    act(() => olho.click())
    expect(pedir).toHaveBeenLastCalledWith({ tipo: 'jogadores', id: 'tokens' })
    expect(button('Mostrar Tokens aos jogadores').getAttribute('aria-pressed')).toBe('true')
    expect(button('Ocultar Tokens').getAttribute('aria-pressed')).toBe('false')
  })

  it('cadeado: "Travar X" / "Destravar X" com aria-pressed', () => {
    act(() => button('Travar Chão').click())
    expect(pedir).toHaveBeenLastCalledWith({ tipo: 'cadeado', id: 'chao' })
    expect(button('Destravar Chão').getAttribute('aria-pressed')).toBe('true')
    expect(button('Travar Salas').getAttribute('aria-pressed')).toBe('false')
  })

  it('opacidade: slider "Opacidade de X" com o valor em aria-valuetext; um arrasto manda UM gesto; a porcentagem fica fora do texto', () => {
    const faixa = slider('Opacidade de Objetos')
    expect(faixa.getAttribute('aria-valuetext')).toBe('100%')
    arrastar(faixa, [90, 70, 40])
    const gestos = pedir.mock.calls.map(([p]) => (p.tipo === 'opacidade' ? p.gesto : null))
    expect(new Set(gestos).size).toBe(1)
    expect(pedir).toHaveBeenLastCalledWith(expect.objectContaining({ tipo: 'opacidade', id: 'objetos', valor: 0.4 }))
    expect(slider('Opacidade de Objetos').getAttribute('aria-valuetext')).toBe('40%')
    const linha = slider('Opacidade de Objetos').closest('li')
    expect(linha?.querySelector('[data-pct]')?.getAttribute('data-pct')).toBe('40%')
    expect(linha?.textContent).toBe('Objetos2')
    // Outro arrasto, outro gesto.
    arrastar(slider('Opacidade de Objetos'), [30])
    const todos = pedir.mock.calls.map(([p]) => (p.tipo === 'opacidade' ? p.gesto : null))
    expect(new Set(todos).size).toBe(2)
  })

  it('Chão leva as camadas do chão aninhadas; Telhados leva o Transparente só enquanto o mestre vê os telhados', () => {
    const chao = linhas().find((li) => li.getAttribute('data-camada') === 'chao')
    expect(chao?.querySelector('ul[aria-label="Camadas do chão"]')).not.toBeNull()
    const telhados = () => linhas().find((li) => li.getAttribute('data-camada') === 'telhados')
    expect(telhados()?.textContent).toContain('Transparente')
    act(() => button('Ocultar Telhados').click())
    expect(telhados()?.textContent).not.toContain('Transparente')
  })
})
