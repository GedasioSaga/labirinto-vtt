import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EsperaPorCena } from '../lib/cenaQueEspera'
import type { PartyMember } from '../lib/party'
import type { Point } from '../pixi/world'
import { useAdventureStore } from './adventureStore'
import { useToastStore } from './toastStore'
import { useCenaQueEspera } from './useCenaQueEspera'

function membro(playerId: string, name: string, sceneId: string | null, x = 100, y = 200): PartyMember {
  return {
    playerId,
    name,
    connected: true,
    sceneId,
    sceneName: null,
    token: sceneId === null ? null : { id: `ficha-${playerId}`, color: '#3cff00', x, y },
    travelPending: false,
    mochila: [],
  }
}

const FABIO_NA_CAPITANIA = membro('fabio', 'Fábio', 's-capitania', 300, 450)

/** O que o hook devolveu no último render: é isto que o App passa à lista Cenas. */
let espera: EsperaPorCena = new Map()

function Harness({ members, activeSceneId, atalhoLigado }: { members: PartyMember[]; activeSceneId: string | null; atalhoLigado: boolean }) {
  espera = useCenaQueEspera(members, activeSceneId, atalhoLigado)
  return null
}

function ctrlJ(target: EventTarget = window): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: 'j', ctrlKey: true, bubbles: true, cancelable: true })
  act(() => {
    target.dispatchEvent(event)
  })
  return event
}

describe('useCenaQueEspera — a ligação do App: relógio por cena e Ctrl+J', () => {
  let container: HTMLDivElement
  let root: Root
  const originalGoToPoint = useAdventureStore.getState().goToPoint
  let goToPoint: ReturnType<typeof vi.fn<(sceneId: string | null, point: Point) => boolean>>
  let agora = 0

  const render = (members: PartyMember[], activeSceneId: string | null, atalhoLigado = true) => {
    act(() => root.render(<Harness members={members} activeSceneId={activeSceneId} atalhoLigado={atalhoLigado} />))
  }

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    agora = 1_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => agora)
    goToPoint = vi.fn((_sceneId: string | null, _point: Point) => true)
    useAdventureStore.setState({ goToPoint })
    useToastStore.setState({ toasts: [] })
    espera = new Map()
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    useAdventureStore.setState({ goToPoint: originalGoToPoint })
    useToastStore.setState({ toasts: [] })
    vi.restoreAllMocks()
  })

  it('Fábio chega na Capitania com o mestre noutra cena: a Capitania passa a esperar desde agora', () => {
    render([FABIO_NA_CAPITANIA], 's-salao')
    expect([...espera]).toEqual([['s-capitania', 1_000_000]])
  })

  it('a cena aberta no editor não espera, mesmo com gente nela', () => {
    render([FABIO_NA_CAPITANIA], 's-capitania')
    expect(espera.size).toBe(0)
  })

  it('Ctrl+J abre a Capitania centrada no Fábio, e abrir a cena zera a espera dela', () => {
    render([FABIO_NA_CAPITANIA], 's-salao')
    agora += 11 * 60_000
    const event = ctrlJ()
    expect(goToPoint).toHaveBeenCalledTimes(1)
    expect(goToPoint).toHaveBeenCalledWith('s-capitania', { x: 300, y: 450 })
    // O navegador não abre os downloads: a tecla é do mestre.
    expect(event.defaultPrevented).toBe(true)
    // O goToPoint troca a cena aberta; o App re-renderiza com ela e o relógio dela some.
    render([FABIO_NA_CAPITANIA], 's-capitania')
    expect(espera.has('s-capitania')).toBe(false)
    expect(espera.size).toBe(0)
  })

  it('duas cenas esperando: o Ctrl+J vai na que espera há mais tempo, não na mais recente', () => {
    const ana = membro('ana', 'Ana', 's-cripta', 10, 20)
    render([ana], 's-salao')
    agora += 5 * 60_000
    render([ana, FABIO_NA_CAPITANIA], 's-salao')
    expect(espera.get('s-cripta')).toBe(1_000_000)
    expect(espera.get('s-capitania')).toBe(1_000_000 + 5 * 60_000)
    ctrlJ()
    expect(goToPoint).toHaveBeenCalledWith('s-cripta', { x: 10, y: 20 })
  })

  it('a cena que já esperava guarda o início quando a mesa re-renderiza', () => {
    render([FABIO_NA_CAPITANIA], 's-salao')
    const antes = espera
    agora += 3 * 60_000
    render([membro('fabio', 'Fábio', 's-capitania', 320, 450)], 's-salao')
    expect(espera.get('s-capitania')).toBe(1_000_000)
    expect(espera).toBe(antes)
  })

  it('a cena esvaziou: sai da espera', () => {
    render([FABIO_NA_CAPITANIA], 's-salao')
    render([membro('fabio', 'Fábio', null)], 's-salao')
    expect(espera.size).toBe(0)
  })

  it('Ctrl+J sem cena esperando: avisa e não mexe na câmera', () => {
    render([], 's-salao')
    ctrlJ()
    expect(goToPoint).not.toHaveBeenCalled()
    expect(useToastStore.getState().toasts.map((toast) => toast.text)).toEqual(['Nenhuma cena esperando você'])
  })

  it('fora do editor o Ctrl+J não é nosso: nada acontece e o navegador fica com a tecla', () => {
    render([FABIO_NA_CAPITANIA], 's-salao', false)
    const event = ctrlJ()
    expect(goToPoint).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
    // O relógio continua valendo: a lista mostra a espera quando o mestre voltar ao editor.
    expect(espera.get('s-capitania')).toBe(1_000_000)
  })

  it('digitando num campo, Ctrl+J não abre cena', () => {
    render([FABIO_NA_CAPITANIA], 's-salao')
    const campo = document.createElement('input')
    campo.type = 'text'
    container.appendChild(campo)
    const event = ctrlJ(campo)
    expect(goToPoint).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('J sozinho (Sala Circular) não abre cena', () => {
    render([FABIO_NA_CAPITANIA], 's-salao')
    const event = new KeyboardEvent('keydown', { key: 'j', bubbles: true, cancelable: true })
    act(() => {
      window.dispatchEvent(event)
    })
    expect(goToPoint).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('desmontar tira o listener: Ctrl+J depois não abre nada', () => {
    render([FABIO_NA_CAPITANIA], 's-salao')
    act(() => root.unmount())
    root = createRoot(container)
    ctrlJ()
    expect(goToPoint).not.toHaveBeenCalled()
  })
})
