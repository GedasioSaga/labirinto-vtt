import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DrawingTool } from '../types/tools'
import { Toolbar } from './Toolbar'
import type { ToolVariantBindings } from './ToolVariantMenu'

// Perfil da abertura: a barra lia o layout (getBoundingClientRect) dentro do
// commit, com o canvas recém-montado, e forçava um recálculo síncrono de
// 198 a 241 ms. A medida do balão de dica agora espera o navegador fazer o
// layout que ele já ia fazer: a primeira observação do ResizeObserver, ou o
// próximo quadro quando não há ResizeObserver.

/** ResizeObserver de mentira: guarda o callback e os alvos para o teste disparar. */
class FakeResizeObserver implements ResizeObserver {
  static instances: FakeResizeObserver[] = []
  readonly targets = new Set<Element>()
  disconnected = false
  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this)
  }
  observe(target: Element) {
    this.targets.add(target)
  }
  unobserve(target: Element) {
    this.targets.delete(target)
  }
  disconnect() {
    this.disconnected = true
    this.targets.clear()
  }
  /** Simula a entrega das observações, que no navegador vem logo depois do layout. */
  deliver() {
    // O callback só lê os elementos pelas refs; entradas vazias bastam.
    this.callback([], this)
  }
}

const liveObservers = () => FakeResizeObserver.instances.filter((o) => !o.disconnected)

let container: HTMLDivElement
let root: Root
let rectSpy: ReturnType<typeof vi.spyOn>
let frames: FrameRequestCallback[]

function bindings(activeTool: DrawingTool): ToolVariantBindings {
  return {
    doorKind: { value: 'normal', onChange: vi.fn() },
    wallKind: { value: undefined, onChange: vi.fn() },
    regionFillPattern: { value: 'solid', onChange: vi.fn() },
    polygonSides: { value: 6, onChange: vi.fn() },
    stairSizePreset: { value: 'medium', onChange: vi.fn() },
    drawTexture: { value: 'pen', onChange: vi.fn() },
    eraseMode: { value: 'objeto', onChange: vi.fn() },
    floorShapeKind: { value: 'rect', onChange: vi.fn() },
    floorOp: { value: 'add', onChange: vi.fn() },
    floorPolygonSides: { value: 6, onChange: vi.fn() },
    floorBrushSize: { value: 1, onChange: vi.fn() },
    drawShape: { value: activeTool, onChange: vi.fn() },
  }
}

function render(activeTool: DrawingTool) {
  act(() =>
    root.render(
      <Toolbar activeTool={activeTool} onSelectTool={vi.fn()} lastDrawingTool="brush" variantBindings={bindings(activeTool)} />,
    ),
  )
}

const one = (selector: string) => {
  const el = document.body.querySelector<HTMLElement>(selector)
  if (!el) throw new Error(selector + ' ausente')
  return el
}

const balloon = () => one('.lb-hint')

const runFrames = () => {
  const pending = frames
  frames = []
  act(() => pending.forEach((cb) => cb(0)))
}

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  FakeResizeObserver.instances = []
  frames = []
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect')
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  rectSpy.mockRestore()
  vi.unstubAllGlobals()
})

describe('Toolbar — medida do balão depois de montar (com ResizeObserver)', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  })

  it('a montagem não lê o layout; o balão espera escondido pela primeira observação', () => {
    render('select')
    expect(rectSpy).not.toHaveBeenCalled()
    expect(balloon().style.visibility).toBe('hidden')
    // Observa a barra, o balão e o botão da ferramenta ativa.
    const [observer] = liveObservers()
    expect(observer).toBeDefined()
    expect(observer.targets.has(balloon())).toBe(true)
    expect(observer.targets.has(one('.lb-toolbar-dock'))).toBe(true)
    expect(observer.targets.has(one('[aria-pressed="true"]'))).toBe(true)
  })

  it('quando a observação chega, mede e mostra o balão posicionado', () => {
    render('select')
    act(() => liveObservers().forEach((o) => o.deliver()))
    expect(rectSpy).toHaveBeenCalled()
    expect(balloon().style.visibility).toBe('')
    expect(balloon().style.left).toMatch(/^\d+(\.\d+)?px$/)
  })

  it('trocar de ferramenta esconde o balão até a nova medida, sem ler o layout no commit', () => {
    render('select')
    act(() => liveObservers().forEach((o) => o.deliver()))
    expect(balloon().style.visibility).toBe('')
    rectSpy.mockClear()

    render('brush')
    expect(rectSpy).not.toHaveBeenCalled()
    // A posição da ferramenta anterior não vale para o texto novo.
    expect(balloon().style.visibility).toBe('hidden')
    act(() => liveObservers().forEach((o) => o.deliver()))
    expect(rectSpy).toHaveBeenCalled()
    expect(balloon().style.visibility).toBe('')
  })

  it('sem dica nem eco (dica dispensada no canvas), não observa nem mede nada', () => {
    render('select')
    const canvas = document.createElement('canvas')
    document.body.appendChild(canvas)
    act(() => {
      canvas.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }))
    })
    canvas.remove()
    expect(document.body.querySelector('.lb-hint')).toBeNull()
    expect(liveObservers()).toHaveLength(0)
    expect(frames).toHaveLength(0)
    expect(rectSpy).not.toHaveBeenCalled()
  })

  it('desmontar desliga o observador', () => {
    render('select')
    const [observer] = liveObservers()
    act(() => root.render(<></>))
    expect(observer.disconnected).toBe(true)
  })
})

describe('Toolbar — medida do balão depois de montar (sem ResizeObserver)', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', undefined)
  })

  it('mede no próximo quadro, não no commit', () => {
    render('select')
    expect(rectSpy).not.toHaveBeenCalled()
    expect(balloon().style.visibility).toBe('hidden')
    expect(frames.length).toBeGreaterThan(0)
    runFrames()
    expect(rectSpy).toHaveBeenCalled()
    expect(balloon().style.visibility).toBe('')
  })

  it('redimensionar a janela remede no quadro seguinte, não no evento', () => {
    render('select')
    runFrames()
    rectSpy.mockClear()
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })
    expect(rectSpy).not.toHaveBeenCalled()
    expect(frames).toHaveLength(1)
    runFrames()
    expect(rectSpy).toHaveBeenCalled()
  })
})
