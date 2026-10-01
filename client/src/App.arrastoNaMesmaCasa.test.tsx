import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapData, Token } from './types/map'

/**
 * Arrastar a ficha sem sair da casa não re-renderiza o App (achado da trilha
 * C1, 01/10/2026). O canvas manda `moveTokenLive` a cada pointermove com a
 * posição já encaixada na grade; enquanto o ponteiro não sai da casa ela é a
 * mesma, e `setTokenPosition` devolve o mesmo mapa. Antes saía um mapa novo
 * por pointermove e o App inteiro (barra, painel, camadas, pinos) re-renderizava
 * só para chegar ao mesmo lugar.
 */

// O canvas de verdade precisa de WebGL. O App passa props novas ao dublê a cada
// render dele (como em `App.zoomHud.test.tsx`), então cada render do App conta aqui.
const duble = vi.hoisted(() => ({ renders: 0 }))

vi.mock('./pixi/PixiCanvas', () => ({
  PixiCanvas: () => {
    duble.renders += 1
    return <div className="duble-do-canvas" />
  },
}))

const { default: App } = await import('./App')
const { createEmptyMap } = await import('./lib/mapFactory')
const { useMapStore } = await import('./stores/mapStore')

const GRADE = 50
const FICHAS = 800
/** 40 colunas de fichas e 10 colunas livres à direita, para o passo de controle cair em casa vazia. */
const COLUNAS_COM_FICHA = 40
/** A ficha arrastada: a última da primeira linha, encostada na faixa livre. */
const ARRASTADA = { id: 'f39', x: 25 + 39 * GRADE, y: 25 }

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

function botao(nome: string, exato: boolean): HTMLButtonElement {
  const achado = [...container.querySelectorAll('button')].find((b) => {
    const texto = (b.textContent ?? '').trim()
    return exato ? texto === nome : texto.startsWith(nome)
  })
  if (!achado) throw new Error(`sem o botão "${nome}"`)
  return achado
}

/** O caminho do menu inicial, o mesmo do e2e (`e2e/helpers/enterEditor.ts`). */
async function abrirOEditor() {
  await act(async () => root.render(<App />))
  await act(async () => botao('Criar Mapas', false).click())
  await act(async () => botao('Criar mapa', true).click())
  if (container.querySelector('.duble-do-canvas') === null) throw new Error('o editor não abriu')
}

function mesaCheia(): MapData {
  const tokens: Token[] = Array.from({ length: FICHAS }, (_, i) => ({
    id: `f${i}`,
    characterId: null,
    name: `Ficha ${i}`,
    x: 25 + (i % COLUNAS_COM_FICHA) * GRADE,
    y: 25 + Math.floor(i / COLUNAS_COM_FICHA) * GRADE,
    size: 1,
    image: null,
  }))
  return { ...createEmptyMap('m-800', 'Mesa cheia', 50, 20, GRADE), tokens }
}

/** Um pointermove do arrasto: o canvas já encaixou o ponteiro na casa (`PixiCanvas.tsx`, modo dragging-token). */
function pointermove(x: number, y: number) {
  act(() => useMapStore.getState().moveTokenLive(ARRASTADA.id, x, y))
}

describe('App: arrasto da ficha numa mesa de 800 fichas', () => {
  it('trinta pointermoves sem sair da casa não re-renderizam o App; sair da casa re-renderiza', async () => {
    await abrirOEditor()
    act(() => useMapStore.getState().loadMap(mesaCheia()))
    const rendersAntes = duble.renders

    for (let passo = 0; passo < 30; passo += 1) pointermove(ARRASTADA.x, ARRASTADA.y)
    expect(duble.renders - rendersAntes).toBe(0)

    // Controle: o dublê conta mesmo os renders do App — a ficha que troca de casa redesenha.
    pointermove(ARRASTADA.x + GRADE, ARRASTADA.y)
    expect(duble.renders - rendersAntes).toBeGreaterThan(0)
  })
})
