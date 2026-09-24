// A FIAÇÃO DO CLIQUE DIREITO NA PAREDE: evento `contextmenu` no contêiner do
// mapa → menu da parede na tela → clique no item → store (`abrirVaoAqui` /
// `desabarParede`) com a parede e o ponto certos. O palco abaixo liga as
// mesmas duas peças que o PixiCanvas liga (`ligarMenuDaParede` e
// `WallGestureMenuHost`), com uma câmera deslocada e com zoom, para o ponto de
// mundo ter de ser convertido de verdade.
import { act, useEffect, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WallGestureMenuHost } from '../components/WallGestureMenuHost'
import { addRoom, createEmptyMap } from '../lib/mapFactory'
import { buildRoomFromDraft } from '../lib/drawingFactory'
import { findTokenPath } from '../lib/collision'
import { useMapStore } from '../stores/mapStore'
import type { MapData, Wall } from '../types/map'
import { botaoDireitoEhDaParede, ligarMenuDaParede, type MenuDaParede } from './wallGesture'

const GRADE = 64
/** Câmera do palco: mundo → tela é `mundo * ESCALA + DESLOCAMENTO`. */
const ESCALA = 0.5
const DESLOCAMENTO = { x: 40, y: 30 }
/** Onde o contêiner está na página (clientX/Y contam a partir daqui). */
const CAIXA = { left: 100, top: 50, width: 1200, height: 800 }

function doisPredios(): MapData {
  const armazem = buildRoomFromDraft('armazem', ['a0', 'a1', 'a2', 'a3'], { x: 0, y: 0 }, { x: 512, y: 320 })
  const oficina = buildRoomFromDraft('oficina', ['o0', 'o1', 'o2', 'o3'], { x: 512, y: 0 }, { x: 1024, y: 320 })
  const base = createEmptyMap('m_gesto', 'Dois prédios', 40, 20, GRADE)
  return addRoom(addRoom(base, armazem.region, armazem.walls), oficina.region, oficina.walls)
}

function divisa(map: MapData): Wall[] {
  return map.walls.filter((w) => Math.abs(w.x1 - 512) < 0.01 && Math.abs(w.x2 - 512) < 0.01)
}

/** Ponto de mundo → clientX/clientY de um clique real na página. */
function naPagina(mundo: { x: number; y: number }): { clientX: number; clientY: number } {
  return { clientX: CAIXA.left + DESLOCAMENTO.x + mundo.x * ESCALA, clientY: CAIXA.top + DESLOCAMENTO.y + mundo.y * ESCALA }
}

function Palco() {
  const ref = useRef<HTMLDivElement | null>(null)
  const [menu, setMenu] = useState<MenuDaParede | null>(null)
  useEffect(() => {
    const el = ref.current
    if (el === null) return
    return ligarMenuDaParede(el, {
      estado: useMapStore.getState,
      paraMundo: (x, y) => ({ x: (x - DESLOCAMENTO.x) / ESCALA, y: (y - DESLOCAMENTO.y) / ESCALA }),
      escala: () => ESCALA,
      abrir: setMenu,
    })
  }, [])
  return <div ref={ref} data-palco="">{menu && <WallGestureMenuHost menu={menu} onClose={() => setMenu(null)} />}</div>
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  useMapStore.setState({ map: doisPredios(), selection: [], past: [], future: [], activeTool: 'select', floorShapeKind: 'rect' })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(<Palco />))
  const palco = container.querySelector<HTMLDivElement>('[data-palco]')
  if (palco === null) throw new Error('palco não montou')
  vi.spyOn(palco, 'getBoundingClientRect').mockReturnValue({
    ...CAIXA,
    x: CAIXA.left,
    y: CAIXA.top,
    right: CAIXA.left + CAIXA.width,
    bottom: CAIXA.top + CAIXA.height,
    toJSON: () => CAIXA,
  })
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.restoreAllMocks()
})

function palco(): HTMLDivElement {
  const el = container.querySelector<HTMLDivElement>('[data-palco]')
  if (el === null) throw new Error('palco sumiu')
  return el
}

/** Dispara o clique direito; devolve `true` se o menu do navegador foi suprimido. */
function cliqueDireito(mundo: { x: number; y: number }): boolean {
  const evento = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, ...naPagina(mundo) })
  act(() => {
    palco().dispatchEvent(evento)
  })
  return evento.defaultPrevented
}

function menu(): HTMLElement | null {
  return container.querySelector<HTMLElement>('[role="menu"]')
}

function item(rotulo: string): HTMLButtonElement {
  const botao = [...container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find((b) => b.textContent?.includes(rotulo))
  if (botao === undefined) throw new Error(`item "${rotulo}" não está no menu`)
  return botao
}

describe('clique direito na parede → menu → store', () => {
  it('abre o menu no ponto do clique, sem o menu do navegador por cima', () => {
    expect(menu()).toBeNull()
    expect(cliqueDireito({ x: 512, y: 160 })).toBe(true)
    const aberto = menu()
    expect(aberto).not.toBeNull()
    expect(item('Abrir vão aqui')).toBeTruthy()
    expect(item('Desabar parede')).toBeTruthy()
  })

  it('"Abrir vão aqui" abre o vão ONDE o mestre clicou, dos dois lados, e a ficha passa', () => {
    cliqueDireito({ x: 512, y: 160 })
    act(() => item('Abrir vão aqui').click())

    const map = useMapStore.getState().map
    const bordas = divisa(map)
      .flatMap((w) => [w.y1, w.y2])
      .map(Math.round)
    // Um vão de uma célula centrado em y=160 (128..192) nas duas paredes.
    expect(bordas.filter((y) => y === 128)).toHaveLength(2)
    expect(bordas.filter((y) => y === 192)).toHaveLength(2)
    expect(divisa(map)).toHaveLength(4)
    expect(findTokenPath({ x: 480, y: 160 }, { x: 544, y: 160 }, map.walls, GRADE)).not.toBeNull()
    // O menu fecha depois da escolha.
    expect(menu()).toBeNull()
  })

  it('"Desabar parede" derruba a parede clicada e a do outro lado', () => {
    cliqueDireito({ x: 512, y: 40 })
    act(() => item('Desabar parede').click())
    expect(divisa(useMapStore.getState().map)).toHaveLength(0)
    expect(menu()).toBeNull()
  })

  it('fora de parede: nenhum menu, e o clique direito continua sendo o do navegador', () => {
    expect(cliqueDireito({ x: 250, y: 160 })).toBe(false)
    expect(menu()).toBeNull()
  })

  it('no pincel de blocos o botão direito apaga: sem menu do navegador e sem menu da parede', () => {
    useMapStore.setState({ activeTool: 'floor', floorShapeKind: 'blocos' })
    expect(cliqueDireito({ x: 512, y: 160 })).toBe(true)
    expect(menu()).toBeNull()
  })

  it('desmontado o palco, o ouvinte sai junto: o clique direito volta a ser o do navegador', () => {
    const el = palco()
    act(() => root.unmount())
    const evento = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, ...naPagina({ x: 512, y: 160 }) })
    el.dispatchEvent(evento)
    expect(evento.defaultPrevented).toBe(false)
    // O afterEach desmonta de novo: remonta para não desmontar duas vezes.
    root = createRoot(container)
  })
})

describe('botaoDireitoEhDaParede — o pointerdown do botão direito na parede não começa outro gesto', () => {
  const estado = () => ({ map: doisPredios(), activeTool: 'select' as const, floorShapeKind: 'rect' as const })

  it('botão direito em cima de parede: é do menu da parede', () => {
    expect(botaoDireitoEhDaParede(estado(), 2, { x: 512, y: 160 }, 1)).toBe(true)
  })

  it('botão esquerdo, ou direito fora de parede: segue o gesto da ferramenta', () => {
    expect(botaoDireitoEhDaParede(estado(), 0, { x: 512, y: 160 }, 1)).toBe(false)
    expect(botaoDireitoEhDaParede(estado(), 2, { x: 250, y: 160 }, 1)).toBe(false)
  })

  it('no pincel de blocos o botão direito é do pincel, mesmo em cima de parede', () => {
    expect(botaoDireitoEhDaParede({ ...estado(), activeTool: 'floor', floorShapeKind: 'blocos' }, 2, { x: 512, y: 160 }, 1)).toBe(false)
  })

  it('a folga é de tela: 8 px de mundo da parede pega sem zoom e não pega com zoom 4x', () => {
    expect(botaoDireitoEhDaParede(estado(), 2, { x: 520, y: 160 }, 1)).toBe(true)
    expect(botaoDireitoEhDaParede(estado(), 2, { x: 520, y: 160 }, 4)).toBe(false)
  })
})
