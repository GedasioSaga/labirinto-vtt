/**
 * MINIATURA DO MAPA na lista de Cenas (lista de cenas, ideia 1): o desenho da
 * Visão geral em cada linha, guardado em memória por mapa; cena sem mapa fica
 * com o quadro vazio; o interruptor "Miniaturas" desliga, lembra e aguenta lixo
 * no localStorage.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { SceneListItem } from '../stores/adventureStore'
import type { MapData, Token } from '../types/map'
import { CHAVE_MINIATURAS, lerMiniaturasLigadas } from './MiniaturaDaCena'
import { arteDaCena, arteJaPronta } from './SceneOverview'
import { ScenesSection } from './ScenesSection'

const LARGURA = 1000
const ALTURA = 800

function cena(id: string, tokens: Token[] = []): MapData {
  const base = createEmptyMap(id, id, 20, 16, 50)
  return {
    ...base,
    floor: [{ id: `${id}-chao`, shape: { kind: 'rect', cx: LARGURA / 2, cy: ALTURA / 2, w: LARGURA - 20, h: ALTURA - 20 }, op: 'add', modifiers: {} }],
    tokens,
  }
}

const BIRA: Token = { id: 'tok-bira', characterId: null, name: 'Bira', x: 300, y: 300, size: 1, image: null, color: '#3a7bd5' }

const CENAS: SceneListItem[] = [
  { id: 's-praca', name: 'Praça da Vila', active: true, available: true, renamable: true, tokenCount: 1 },
  { id: 's-clareira', name: 'Bosque – clareira ao anoitecer', active: false, available: true, renamable: true, tokenCount: 0 },
  { id: 's-torre', name: 'Torre do sino', active: false, available: false, renamable: true, tokenCount: null },
]

describe('lista de Cenas: miniatura do mapa', () => {
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
  })

  it('a arte de cada mapa é calculada uma vez e guardada; mapa novo é chave nova; lixo guardado = ligadas', () => {
    const praca = cena('praca', [BIRA])
    expect(arteJaPronta(praca, 0)).toBe(false)
    const primeira = arteDaCena(praca, 0)
    expect(primeira).not.toBeNull()
    expect(arteJaPronta(praca, 0)).toBe(true)
    expect(arteDaCena(praca, 0)).toBe(primeira)
    // A ficha andou: a store dá um MapData novo, e a arte dele é outra.
    const andou = { ...praca, tokens: [{ ...BIRA, x: 600 }] }
    expect(arteJaPronta(andou, 0)).toBe(false)
    expect(arteDaCena(andou, 0)).not.toBe(primeira)
    for (const lixo of [null, '', 'sim', '{"a":1}', '1', 'false']) expect(lerMiniaturasLigadas(lixo)).toBe(true)
    expect(lerMiniaturasLigadas('0')).toBe(false)
  })

  it('cada linha tem o quadro 40×30; quem não tem mapa fica vazio; desligar tira os quadros e lembra ao reabrir', async () => {
    const maps = new Map<string, MapData>([
      ['s-praca', cena('map_praca', [BIRA])],
      ['s-clareira', cena('map_clareira')],
    ])
    const render = () => act(() => root.render(<ScenesSection scenes={CENAS} onSelect={vi.fn()} onCreate={() => {}} onRename={() => {}} maps={maps} />))
    render()

    const interruptor = () => container.querySelector<HTMLInputElement>('input[role="switch"]')
    expect(interruptor()?.checked).toBe(true)
    const quadros = () => Array.from(container.querySelectorAll<HTMLElement>('.lb-cenas__mini'))
    expect(quadros()).toHaveLength(3)
    // O desenho chega no tempo livre, sem travar a lista; a Torre (sem mapa) segue vazia.
    await vi.waitFor(() => expect(quadros().filter((quadro) => quadro.querySelector('svg') !== null)).toHaveLength(2))
    const torre = container.querySelector('[data-cena-id="s-torre"] .lb-cenas__mini')
    expect(torre?.childElementCount).toBe(0)
    // A bolinha da ficha não leva o nome no <title>: o nome já está nos retratos da linha.
    expect(container.querySelector('.lb-cenas__mini title')).toBeNull()

    act(() => interruptor()?.click())
    expect(quadros()).toHaveLength(0)
    expect(window.localStorage.getItem(CHAVE_MINIATURAS)).toBe('0')

    act(() => root.unmount())
    root = createRoot(container)
    render()
    expect(interruptor()?.checked).toBe(false)
    expect(quadros()).toHaveLength(0)
  })
})
