/**
 * Janela "Revisar aventura": os problemas em três grupos, cada um com "Ir lá"
 * e, quando existe, o conserto de um clique. Esc fecha; sem problema, diz isso.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { SceneListItem } from '../stores/adventureStore'
import type { MapData } from '../types/map'
import { RevisorAventuraDialog } from './RevisorAventura'

const CENAS: SceneListItem[] = [
  { id: 's-salao', name: 'Salão', active: true, available: true, renamable: true, tokenCount: 1 },
  { id: 's-cripta', name: 'Cripta', active: false, available: true, renamable: true, tokenCount: 0 },
  { id: 's-torre', name: 'Torre', active: false, available: false, renamable: true, tokenCount: null },
]

function comProblemas(): Map<string, MapData> {
  const salao: MapData = {
    ...createEmptyMap('map_salao', 'Salão', 20, 16, 50),
    pins: [{ id: 'p1', x: 120, y: 80, kind: 'exclamacao', description: 'MESTRE: o baú é um mímico', image: null }],
    tokens: [{ id: 't1', characterId: null, name: 'Irmão Bóia (traidor)', x: 300, y: 200, size: 1, image: null }],
  }
  const cripta: MapData = {
    ...createEmptyMap('map_cripta', 'Cripta', 20, 16, 50),
    pins: [{ id: 'v1', x: 40, y: 60, kind: 'viagem', description: 'Alçapão', image: null }],
  }
  return new Map([
    ['s-salao', salao],
    ['s-cripta', cripta],
  ])
}

function limpo(): Map<string, MapData> {
  return new Map([
    ['s-salao', createEmptyMap('map_salao', 'Salão', 20, 16, 50)],
    ['s-cripta', createEmptyMap('map_cripta', 'Cripta', 20, 16, 50)],
  ])
}

describe('RevisorAventuraDialog', () => {
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

  function render(maps: ReadonlyMap<string, MapData>, onFix: (sceneId: string, conserto: unknown) => boolean = vi.fn(() => true)) {
    const onGoTo = vi.fn()
    const onClose = vi.fn()
    act(() => root.render(<RevisorAventuraDialog scenes={CENAS} maps={maps} onGoTo={onGoTo} onFix={onFix} onClose={onClose} />))
    return { onGoTo, onClose, onFix }
  }

  const janela = () => document.body.querySelector<HTMLElement>('[role="dialog"]')
  const botoes = (texto: string) => Array.from(janela()?.querySelectorAll<HTMLButtonElement>('button') ?? []).filter((b) => b.textContent === texto)
  const grupo = (titulo: string) =>
    Array.from(janela()?.querySelectorAll<HTMLElement>('section') ?? []).find((s) => (s.querySelector('h3')?.textContent ?? '').startsWith(titulo))

  it('é uma janela modal "Revisar aventura" com os três grupos e a contagem de cada um', () => {
    render(comProblemas())
    const box = janela()
    expect(box?.getAttribute('aria-modal')).toBe('true')
    const tituloId = box?.getAttribute('aria-labelledby') ?? ''
    expect(document.getElementById(tituloId)?.textContent).toBe('Revisar aventura')
    expect(grupo('Vaza ao jogador')?.querySelectorAll('li')).toHaveLength(2)
    expect(grupo('Quebra o jogo')?.querySelectorAll('li')).toHaveLength(1)
    expect(grupo('Ficou feio')?.textContent).toContain('Nada encontrado')
    expect(box?.textContent).toContain('3 problemas')
    // A cena que não abriu é dita, não esquecida.
    expect(box?.textContent).toContain('Torre')
  })

  it('"Ir lá" leva à cena e ao ponto do problema', () => {
    const { onGoTo } = render(comProblemas())
    const primeiroIrLa = botoes('Ir lá')[0]
    act(() => primeiroIrLa.click())
    expect(onGoTo).toHaveBeenCalledWith('s-salao', 120, 80)
  })

  it('o botão de conserto chama o conserto com a cena e o que fazer, e anuncia o resultado', () => {
    const onFix = vi.fn(() => true)
    render(comProblemas(), onFix)
    const ocultar = botoes('Ocultar dos jogadores')
    expect(ocultar).toHaveLength(1)
    act(() => ocultar[0].click())
    expect(onFix).toHaveBeenCalledWith('s-salao', { tipo: 'ocultar-pino', pinId: 'p1' })
    expect(janela()?.querySelector('[role="status"]')?.textContent).toContain('Consertado')
  })

  it('conserto que não pegou diz isso perto da lista, sem fechar a janela', () => {
    render(comProblemas(), vi.fn(() => false))
    act(() => botoes('Ocultar dos jogadores')[0].click())
    expect(janela()).not.toBeNull()
    expect(janela()?.querySelector('[role="status"]')?.textContent).toContain('Não deu para consertar')
  })

  it('sem problema nenhum, diz que a aventura está limpa', () => {
    render(limpo())
    expect(janela()?.textContent).toContain('Nenhum problema encontrado')
    expect(botoes('Ir lá')).toHaveLength(0)
  })

  it('Esc fecha', () => {
    const { onClose } = render(comProblemas())
    const box = janela()
    if (!box) throw new Error('sem janela')
    act(() => {
      box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
