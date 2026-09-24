/**
 * Janela "Visão geral das cenas" (G14): uma miniatura por cena, com as fichas,
 * a aberta destacada; clicar abre a cena, Esc fecha sem trocar.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { SceneListItem } from '../stores/adventureStore'
import type { MapData, Token } from '../types/map'
import { SceneOverviewDialog, tokenCountLabel } from './SceneOverview'

const LARGURA = 1000
const ALTURA = 800

function cena(id: string, nome: string, chao: string, tokens: Token[] = []): MapData {
  const base = createEmptyMap(id, nome, 20, 16, 50)
  return {
    ...base,
    floor: [{ id: `${id}-chao`, shape: { kind: 'rect', cx: LARGURA / 2, cy: ALTURA / 2, w: LARGURA - 20, h: ALTURA - 20 }, op: 'add', modifiers: {} }],
    floorStyle: { ...base.floorStyle, fillColor: chao },
    tokens,
  }
}

const LANTERNA: Token = { id: 'tok-lanterna', characterId: null, name: 'Lanterna', x: LARGURA - 125, y: 125, size: 1, image: null, color: '#ff5a00' }

const CENAS: SceneListItem[] = [
  { id: 's-salao', name: 'Salão', active: true, available: true, renamable: true, tokenCount: 0 },
  { id: 's-cripta', name: 'Cripta', active: false, available: true, renamable: true, tokenCount: 1 },
  { id: 's-poco', name: 'Poço', active: false, available: true, renamable: true, tokenCount: 2 },
  { id: 's-torre', name: 'Torre', active: false, available: false, renamable: true, tokenCount: null },
]

const MAPAS = new Map<string, MapData>([
  ['s-salao', cena('map_salao', 'Salão', '#1e8c8c')],
  ['s-cripta', cena('map_cripta', 'Cripta', '#8c1e8c', [LANTERNA])],
  ['s-poco', cena('map_poco', 'Poço', '#444444')],
])

describe('SceneOverviewDialog', () => {
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

  function render(onPick = vi.fn(), onClose = vi.fn()) {
    act(() => root.render(<SceneOverviewDialog scenes={CENAS} maps={MAPAS} onPick={onPick} onClose={onClose} />))
    return { onPick, onClose }
  }

  // A janela vai por portal para o body, fora do container.
  const janela = () => document.body.querySelector<HTMLElement>('[role="dialog"]')
  const miniaturas = () => Array.from(janela()?.querySelectorAll<HTMLButtonElement>('button[aria-label]') ?? []).filter((b) => b.getAttribute('aria-label') !== 'Fechar')
  const miniatura = (nome: string) => {
    const achada = miniaturas().find((b) => (b.getAttribute('aria-label') ?? '').startsWith(`${nome},`))
    if (!achada) throw new Error(`sem miniatura de ${nome}`)
    return achada
  }
  const tecla = (alvo: Element, key: string, shiftKey = false) =>
    act(() => {
      alvo.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true }))
    })

  it('é uma janela modal chamada "Visão geral das cenas", com uma miniatura por cena', () => {
    render()
    const aberta = janela()
    expect(aberta?.getAttribute('aria-modal')).toBe('true')
    const tituloId = aberta?.getAttribute('aria-labelledby') ?? ''
    expect(document.getElementById(tituloId)?.textContent).toBe('Visão geral das cenas')
    expect(miniaturas().map((b) => b.getAttribute('aria-label'))).toEqual([
      'Salão, 0 tokens',
      'Cripta, 1 token: Lanterna',
      'Poço, 2 tokens',
      'Torre, arquivo não encontrado',
    ])
  })

  it('a legenda é o nome da cena em texto visível, com a contagem de tokens ao lado', () => {
    render()
    const textos = Array.from(miniatura('Cripta').querySelectorAll('span')).map((s) => s.textContent)
    expect(textos).toContain('Cripta')
    expect(textos).toContain('1 token')
  })

  it('a cena aberta fica destacada (aria-current) e as outras não', () => {
    render()
    expect(miniatura('Salão').getAttribute('aria-current')).toBe('true')
    expect(miniatura('Cripta').hasAttribute('aria-current')).toBe(false)
    expect(miniatura('Poço').hasAttribute('aria-current')).toBe(false)
  })

  it('a miniatura desenha o mapa inteiro com o chão da cena e a ficha no lugar dela, sem grade', () => {
    render()
    const svg = miniatura('Cripta').querySelector('svg')
    expect(svg?.getAttribute('viewBox')).toBe(`0 0 ${LARGURA} ${ALTURA}`)
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
    expect(svg?.querySelector('path[fill="#8c1e8c"]')).not.toBeNull()
    const ficha = svg?.querySelector('circle')
    expect(ficha?.getAttribute('fill')).toBe('#ff5a00')
    expect(Number(ficha?.getAttribute('cx'))).toBe(LARGURA - 125)
    expect(Number(ficha?.getAttribute('cy'))).toBe(125)
    // Pairar a ficha diz de quem ela é.
    expect(ficha?.querySelector('title')?.textContent).toBe('Lanterna')
    expect(svg?.querySelector('pattern')).toBeNull()
    // O Salão não tem ficha.
    expect(miniatura('Salão').querySelector('circle')).toBeNull()
  })

  it('clicar numa miniatura pede para abrir aquela cena', () => {
    const { onPick, onClose } = render()
    act(() => miniatura('Cripta').click())
    expect(onPick).toHaveBeenCalledWith('s-cripta')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('cena cujo arquivo sumiu fica desabilitada e diz por quê', () => {
    const { onPick } = render()
    const torre = miniatura('Torre')
    expect(torre.disabled).toBe(true)
    expect(torre.textContent).toContain('Arquivo não encontrado')
    act(() => torre.click())
    expect(onPick).not.toHaveBeenCalled()
  })

  it('Esc fecha sem abrir cena e não chega aos atalhos do editor', () => {
    const noEditor = vi.fn()
    window.addEventListener('keydown', noEditor)
    try {
      const { onPick, onClose } = render()
      tecla(miniatura('Salão'), 'Escape')
      expect(onClose).toHaveBeenCalledTimes(1)
      expect(onPick).not.toHaveBeenCalled()
      expect(noEditor).not.toHaveBeenCalled()
    } finally {
      window.removeEventListener('keydown', noEditor)
    }
  })

  it('o foco entra na miniatura da cena aberta, e as setas, Home e End andam entre as que abrem', () => {
    render()
    expect(document.activeElement).toBe(miniatura('Salão'))
    tecla(miniatura('Salão'), 'ArrowRight')
    expect(document.activeElement).toBe(miniatura('Cripta'))
    tecla(miniatura('Cripta'), 'End')
    // A Torre (sem arquivo) não recebe foco: a última que abre é o Poço.
    expect(document.activeElement).toBe(miniatura('Poço'))
    tecla(miniatura('Poço'), 'ArrowRight')
    expect(document.activeElement).toBe(miniatura('Poço'))
    tecla(miniatura('Poço'), 'ArrowLeft')
    expect(document.activeElement).toBe(miniatura('Cripta'))
    tecla(miniatura('Cripta'), 'Home')
    expect(document.activeElement).toBe(miniatura('Salão'))
  })

  it('Tab não sai da janela: do último controle volta ao primeiro, e Shift+Tab faz o caminho de volta', () => {
    render()
    const fechar = janela()?.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')
    if (!fechar) throw new Error('sem botão Fechar')
    miniatura('Poço').focus()
    tecla(miniatura('Poço'), 'Tab')
    expect(document.activeElement).toBe(fechar)
    tecla(fechar, 'Tab', true)
    expect(document.activeElement).toBe(miniatura('Poço'))
  })

  it('clique no fundo fecha; clique dentro da janela não fecha', () => {
    const { onClose } = render()
    const fundo = document.body.querySelector<HTMLElement>('.lb-dialog-backdrop')
    const aberta = janela()
    if (!fundo || !aberta) throw new Error('janela não abriu')
    act(() => {
      aberta.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      aberta.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(onClose).not.toHaveBeenCalled()
    act(() => {
      fundo.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      fundo.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('o botão Fechar fecha', () => {
    const { onClose } = render()
    act(() => janela()?.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')?.click())
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('tokenCountLabel', () => {
  it('singular, plural e cena sem mapa', () => {
    expect(tokenCountLabel(1)).toBe('1 token')
    expect(tokenCountLabel(0)).toBe('0 tokens')
    expect(tokenCountLabel(3)).toBe('3 tokens')
    expect(tokenCountLabel(null)).toBe('indisponível')
  })
})
