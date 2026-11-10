import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { selectionOfItem } from '../lib/selectionModel'
import type { Token } from '../types/map'
import { abrirDestaqueNoMapa, esperarTokenNoMapa, PRAZO_DA_ESPERA_MS } from './destaqueNoMapa'
import { useMapStore } from './mapStore'

/*
 * O seletor "Atribuir token" e o mapa (auditoria da frente D, 09/11/2026): a
 * espera do "clicar no token no mapa" só vale para um clique de verdade no
 * canvas, e o que ela e o destaque da lista mexem no editor (ferramenta,
 * seleção, pino) volta a ser o que era.
 */

const alce = (id: string): Token => ({ id, characterId: null, name: 'Alce', x: 0, y: 0, size: 1, image: null })
const doToken = (id: string) => selectionOfItem({ kind: 'token', id })

let canvas: HTMLCanvasElement
let mapa: HTMLDivElement

beforeEach(() => {
  useMapStore.getState().loadMap({ ...createEmptyMap('m1', 'Clareira', 10, 10, 50), tokens: [alce('t1'), alce('t2')] })
  useMapStore.getState().setActiveTool('select')
  // O canvas do editor mora em `.lb-editor__canvas` (App.tsx): é por ele que a espera reconhece o clique no mapa.
  mapa = document.createElement('div')
  mapa.className = 'lb-editor__canvas'
  canvas = document.createElement('canvas')
  mapa.appendChild(canvas)
  document.body.appendChild(mapa)
})

afterEach(() => {
  mapa.remove()
  vi.useRealTimers()
})

/** O clique de verdade: o aperto nasce no canvas do mapa e é dentro dele que o editor seleciona o token, como o Pixi faz. */
function clicarNoToken(tokenId: string): void {
  canvas.addEventListener('pointerdown', () => useMapStore.getState().setSelection(doToken(tokenId)), { once: true })
  canvas.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }))
  window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 0 }))
}

describe('esperarTokenNoMapa: só um clique de verdade num token do mapa escolhe', () => {
  it('o clique no token avisa uma vez só, deixa o token selecionado e não mexe mais na ferramenta', () => {
    useMapStore.getState().setActiveTool('wall')
    const cliques: string[] = []
    const desarmar = esperarTokenNoMapa((id) => cliques.push(id), () => {})
    expect(useMapStore.getState().activeTool).toBe('select')

    clicarNoToken('t2')
    clicarNoToken('t1')
    desarmar()

    expect(cliques).toEqual(['t2'])
    // Depois do clique o gesto é do mestre (ele pode estar arrastando o token): nada é devolvido.
    expect(useMapStore.getState().activeTool).toBe('select')
    expect(useMapStore.getState().selection).toEqual(doToken('t1'))
  })

  it('card A esperando o clique e a lista do card B só aponta uma linha: A não recebe o token e perde a vez', () => {
    const cliquesDeA: string[] = []
    const perdeuAVez = vi.fn()
    const desarmar = esperarTokenNoMapa((id) => cliquesDeA.push(id), perdeuAVez)

    const destaqueDeB = abrirDestaqueNoMapa()
    destaqueDeB.destacar('t1')
    // Nem um clique no mapa depois disso vai para A: abrir a lista de B desarmou a espera.
    clicarNoToken('t2')
    destaqueDeB.soltar()
    desarmar()

    expect(cliquesDeA).toEqual([])
    expect(perdeuAVez).toHaveBeenCalledTimes(1)
  })

  it('seleção que não nasce de um clique no mapa (outra ferramenta, outro painel) não escolhe ninguém', () => {
    const cliques: string[] = []
    const desarmar = esperarTokenNoMapa((id) => cliques.push(id), () => {})

    useMapStore.getState().setSelection(doToken('t1'))
    useMapStore.getState().setActiveTool('wall')
    useMapStore.getState().setSelection(doToken('t2'))
    desarmar()

    expect(cliques).toEqual([])
  })

  it('cancelar a espera devolve a ferramenta e a seleção de antes', () => {
    const store = useMapStore.getState()
    store.setActiveTool('wall')
    store.setSelection(doToken('t2'))

    const desarmar = esperarTokenNoMapa(() => {}, () => {})
    expect(useMapStore.getState().activeTool).toBe('select')
    expect(useMapStore.getState().selection).toEqual([])
    desarmar()

    expect(useMapStore.getState().activeTool).toBe('wall')
    expect(useMapStore.getState().selection).toEqual(doToken('t2'))
  })

  it('sem clique nenhum, a espera desiste sozinha no prazo: avisa quem armou e devolve a seleção', () => {
    vi.useFakeTimers()
    useMapStore.getState().setSelection(doToken('t2'))
    const cliques: string[] = []
    const perdeuAVez = vi.fn()
    esperarTokenNoMapa((id) => cliques.push(id), perdeuAVez)

    vi.advanceTimersByTime(PRAZO_DA_ESPERA_MS - 1)
    expect(perdeuAVez).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)

    expect(perdeuAVez).toHaveBeenCalledTimes(1)
    expect(useMapStore.getState().selection).toEqual(doToken('t2'))
    clicarNoToken('t1')
    expect(cliques).toEqual([])
  })
})

describe('abrirDestaqueNoMapa: fechar a lista devolve o que estava selecionado', () => {
  it('o pino que estava selecionado volta quando a lista fecha', () => {
    useMapStore.setState({ selectedPinId: 'pino-1' })

    const destaque = abrirDestaqueNoMapa()
    destaque.destacar('t1')
    expect(useMapStore.getState().selection).toEqual(doToken('t1'))
    destaque.soltar()

    expect(useMapStore.getState().selectedPinId).toBe('pino-1')
    expect(useMapStore.getState().selection).toEqual([])
  })
})
