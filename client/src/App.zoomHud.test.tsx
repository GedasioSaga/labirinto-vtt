import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Camera } from './pixi/world'

/**
 * O zoom com a roda não re-renderiza o App. O App tem milhares de linhas e
 * monta a barra, o painel de propriedades, as camadas e os pinos; quando a
 * escala da câmera morava num useState dele, cada quadro de zoom refazia tudo
 * isso só para trocar o "NN%" do HUD (medido: um render do App por quadro).
 * Agora o HUD lê a escala da store sozinho.
 */
interface DubleDoCanvas {
  renders: number
  /** O aviso de câmera que o App passa ao canvas, se ainda passar algum. */
  avisarCamera: ((camera: Camera) => void) | undefined
}

// O canvas de verdade precisa de WebGL. O dublê conta os próprios renders: o
// App passa props novas a cada render dele, então cada render do App é um
// render do dublê.
const duble = vi.hoisted((): DubleDoCanvas => ({ renders: 0, avisarCamera: undefined }))

vi.mock('./pixi/PixiCanvas', () => ({
  PixiCanvas: (props: { onCameraChange?: (camera: Camera) => void }) => {
    duble.renders += 1
    duble.avisarCamera = props.onCameraChange
    return <div className="duble-do-canvas" />
  },
}))

const { default: App } = await import('./App')
const { useMapStore } = await import('./stores/mapStore')

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

function rotuloDoZoom(): string | null {
  return container.querySelector('.lb-zoomhud')?.getAttribute('aria-label') ?? null
}

/** O caminho do menu inicial, o mesmo do e2e (`e2e/helpers/enterEditor.ts`). */
async function abrirOEditor() {
  await act(async () => root.render(<App />))
  await act(async () => botao('Criar Mapas', false).click())
  await act(async () => botao('Criar mapa', true).click())
  if (container.querySelector('.duble-do-canvas') === null) throw new Error('o editor não abriu')
}

/** O que o `applyCamera` do canvas faz a cada passo: grava na store e avisa quem pediu. */
function aplicarCamera(camera: Camera) {
  act(() => {
    useMapStore.getState().setCamera(camera)
    duble.avisarCamera?.(camera)
  })
}

describe('App: zoom e HUD', () => {
  it('dez passos de roda trocam o "NN%" do HUD sem re-renderizar o App', async () => {
    await abrirOEditor()
    expect(rotuloDoZoom()).toBe('Zoom: 100%')
    const rendersAntes = duble.renders
    for (let passo = 1; passo <= 10; passo += 1) aplicarCamera({ x: -passo * 7, y: -passo * 3, scale: 1 + passo * 0.1 })
    expect(rotuloDoZoom()).toBe('Zoom: 200%')
    expect(duble.renders - rendersAntes).toBe(0)
  })

  it('o pan também não re-renderiza o App, e o HUD fica onde estava', async () => {
    await abrirOEditor()
    aplicarCamera({ x: 0, y: 0, scale: 0.5 })
    const rendersAntes = duble.renders
    for (let passo = 1; passo <= 10; passo += 1) aplicarCamera({ x: passo * 40, y: passo * 15, scale: 0.5 })
    expect(rotuloDoZoom()).toBe('Zoom: 50%')
    expect(duble.renders - rendersAntes).toBe(0)
  })
})
