/**
 * ABALO POR DISTÂNCIA no painel Cenas: o mestre abre o "Abalo" na linha da
 * cena de origem, escolhe de onde veio (uma Sala ou um pino dela, ou sem ponto)
 * e escreve um texto por faixa. Um envio só; o aviso diz quantos ouviram em
 * cada faixa.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { SceneListItem } from '../stores/adventureStore'
import type { MapData } from '../types/map'
import { ScenesSection, abaloFeedbackText, type AbaloEnvio } from './ScenesSection'

const CENAS: SceneListItem[] = [
  { id: 's-torre', name: 'Torre', active: true, available: true, renamable: true, tokenCount: 0 },
  { id: 's-andar1', name: 'Andar Um', active: false, available: true, renamable: false, tokenCount: 1, parentId: 's-torre' },
  { id: 's-andar2', name: 'Andar Dois', active: false, available: true, renamable: false, tokenCount: 1, parentId: 's-torre' },
  { id: 's-vila', name: 'Vila', active: false, available: true, renamable: false, tokenCount: 1 },
]

function mapaDoAndar2(): MapData {
  return {
    ...createEmptyMap('m-andar2', 'Andar Dois', 30, 20, 50),
    regions: [
      {
        id: 'r-cozinha',
        points: [
          { x: 100, y: 200 },
          { x: 300, y: 200 },
          { x: 300, y: 400 },
          { x: 100, y: 400 },
        ],
        tag: '',
        fillColor: '#222222',
        fillPattern: 'solid',
        data: {},
        room: { shape: 'rect', name: 'Cozinha' },
      },
    ],
    pins: [{ id: 'p-sino', x: 700, y: 50, kind: 'exclamacao', description: 'Sino da torre', image: null }],
  }
}

const MAPS: ReadonlyMap<string, MapData> = new Map([['s-andar2', mapaDoAndar2()]])

describe('ScenesSection: "Abalo" a partir de uma cena', () => {
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

  function render(onQuake?: AbaloEnvio): void {
    act(() => root.render(<ScenesSection scenes={CENAS} maps={MAPS} onSelect={() => {}} onCreate={() => {}} onRename={() => {}} onQuake={onQuake} />))
  }

  function botao(nome: string): HTMLButtonElement | undefined {
    return Array.from(container.querySelectorAll('button')).find((b) => (b.getAttribute('aria-label') ?? b.textContent) === nome)
  }

  function campoPorRotulo(rotulo: string): HTMLTextAreaElement | HTMLSelectElement {
    const label = Array.from(container.querySelectorAll('label')).find((l) => l.textContent?.startsWith(rotulo))
    // `useId` gera ids com ':' — getElementById dispensa escapar o seletor.
    const alvo = label === undefined ? null : document.getElementById(label.htmlFor)
    if (!(alvo instanceof HTMLTextAreaElement) && !(alvo instanceof HTMLSelectElement)) throw new Error(`campo "${rotulo}" não achado`)
    return alvo
  }

  function digita(rotulo: string, texto: string): void {
    const alvo = campoPorRotulo(rotulo)
    const proto = alvo instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLSelectElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    act(() => {
      setter?.call(alvo, texto)
      alvo.dispatchEvent(new Event(alvo instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
    })
  }

  it('sem sala (sem onQuake) não há botão "Abalo"', () => {
    render()
    expect(botao('Abalo a partir de Andar Dois')).toBeUndefined()
  })

  it('escolhe a Sala de origem, escreve as três faixas e envia um abalo só, com as cenas vizinhas', () => {
    const onQuake = vi.fn<AbaloEnvio>(() => ({ perto: 2, andar: 1, longe: 0 }))
    render(onQuake)
    act(() => botao('Abalo a partir de Andar Dois')?.click())

    const origem = campoPorRotulo('De onde veio')
    expect(origem instanceof HTMLSelectElement ? Array.from(origem.options).map((o) => o.textContent) : []).toEqual([
      'Sem ponto (sem seta)',
      'Sala: Cozinha',
      'Pino: Sino da torre',
    ])
    digita('De onde veio', 'sala:r-cozinha')
    digita('Nesta cena', 'O teto treme sobre vocês.')
    digita('Nas cenas vizinhas', 'Um tranco abafado.')
    act(() => botao('Enviar abalo')?.click())

    // Centro da Cozinha; vizinhas = a mesma pasta (Andar Um) e a de fora (Torre).
    expect(onQuake).toHaveBeenCalledTimes(1)
    const [origemEnviada, textos, vizinhas] = onQuake.mock.calls[0] ?? []
    expect(origemEnviada).toEqual({ sceneId: 's-andar2', x: 200, y: 300 })
    expect(textos).toEqual({ perto: 'O teto treme sobre vocês.', andar: 'Um tranco abafado.', longe: '' })
    expect([...(vizinhas ?? [])].sort()).toEqual(['s-andar1', 's-torre'])
    expect(container.querySelector('[role="status"]')?.textContent).toBe(abaloFeedbackText({ perto: 2, andar: 1, longe: 0 }))
    expect(container.querySelector('textarea')).toBeNull()
  })

  it('sem ponto: vai sem x/y; tudo vazio não envia; Esc cancela', () => {
    const onQuake = vi.fn<AbaloEnvio>(() => ({ perto: 0, andar: 0, longe: 1 }))
    render(onQuake)
    act(() => botao('Abalo a partir de Andar Dois')?.click())
    expect(botao('Enviar abalo')?.disabled).toBe(true)
    digita('No resto da aventura', 'Um ronco distante.')
    act(() => botao('Enviar abalo')?.click())
    expect(onQuake).toHaveBeenCalledWith({ sceneId: 's-andar2' }, { perto: '', andar: '', longe: 'Um ronco distante.' }, expect.any(Array))

    act(() => botao('Abalo a partir de Andar Dois')?.click())
    const campo = campoPorRotulo('Nesta cena')
    act(() => {
      campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(container.querySelector('textarea')).toBeNull()
    expect(onQuake).toHaveBeenCalledTimes(1)
  })

  it('aviso: quem ouviu em cada faixa, ninguém, e sala fechada', () => {
    expect(abaloFeedbackText({ perto: 2, andar: 1, longe: 3 })).toBe('Abalo: 2 nesta cena, 1 nas vizinhas, 3 longe')
    expect(abaloFeedbackText({ perto: 1, andar: 0, longe: 0 })).toBe('Abalo: 1 nesta cena')
    expect(abaloFeedbackText({ perto: 0, andar: 0, longe: 0 })).toBe('Ninguém ouviu: nenhum jogador nas faixas com texto')
    expect(abaloFeedbackText(null)).toMatch(/sala/)
  })
})
