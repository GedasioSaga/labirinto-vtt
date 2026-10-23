import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CamadaId, MapData } from '../types/map'
import { alternarCadeado, alternarOlhoDoMestre, alternarOlhoDosJogadores, definirOpacidade } from '../lib/camadas/estado'
import { CAMADAS_PADRAO } from '../lib/camadas/padrao'
import { createEmptyMap } from '../lib/mapFactory'
import { LayersPanel } from './LayersPanel'

const COUNTS: Partial<Record<CamadaId, number>> = { paredes: 3, portas: 1, objetos: 2, tokens: 4, chao: 2 }

type Pedido = { tipo: 'mestre' | 'jogadores' | 'cadeado'; id: CamadaId } | { tipo: 'opacidade'; id: CamadaId; valor: number; gesto: string }

/**
 * Estado real (as funções da store, `lib/camadas/estado.ts`) para provar que
 * `aria-pressed`, o nome e o slider acompanham cada controle, e um espião para
 * provar que cada controle pede a camada certa.
 */
function Harness({ pedir, inicial }: { pedir: (pedido: Pedido) => void; inicial: MapData }) {
  const [map, setMap] = useState(inicial)
  return (
    <LayersPanel
      camadas={map}
      counts={COUNTS}
      onToggleLayer={(id) => {
        pedir({ tipo: 'mestre', id })
        setMap((m) => alternarOlhoDoMestre(m, id))
      }}
      onTogglePlayers={(id) => {
        pedir({ tipo: 'jogadores', id })
        setMap((m) => alternarOlhoDosJogadores(m, id))
      }}
      onToggleLock={(id) => {
        pedir({ tipo: 'cadeado', id })
        setMap((m) => alternarCadeado(m, id))
      }}
      onOpacity={(id, valor, gesto) => {
        pedir({ tipo: 'opacidade', id, valor, gesto })
        setMap((m) => definirOpacidade(m, id, valor))
      }}
      chao={<ul aria-label="Camadas do chão" />}
      telhados={<label>Transparente</label>}
    />
  )
}

describe('LayersPanel: as 13 camadas (fatia 6)', () => {
  let container: HTMLDivElement
  let root: Root
  let pedir: ReturnType<typeof vi.fn<(pedido: Pedido) => void>>

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    pedir = vi.fn<(pedido: Pedido) => void>()
    act(() => root.render(<Harness pedir={pedir} inicial={createEmptyMap('m', 'M', 10, 10, 64)} />))
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  const button = (name: string) => {
    const found = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((el) => el.getAttribute('aria-label') === name)
    if (found === undefined) throw new Error(`sem botão ${name}`)
    return found
  }
  const slider = (name: string) => {
    const found = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="range"]')).find((el) => el.getAttribute('aria-label') === name)
    if (found === undefined) throw new Error(`sem slider ${name}`)
    return found
  }
  const linhas = () => Array.from(container.querySelectorAll<HTMLLIElement>('ul[aria-label="Camadas do mapa"] > li'))
  /** Arrasta o slider: aperta, passa por cada valor e solta (como a mão). */
  const arrastar = (alvo: HTMLInputElement, valores: number[]) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      alvo.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    })
    for (const valor of valores) {
      act(() => {
        setter?.call(alvo, String(valor))
        alvo.dispatchEvent(new Event('input', { bubbles: true }))
      })
    }
    act(() => {
      alvo.dispatchEvent(new Event('pointerup', { bubbles: true }))
    })
  }

  it('13 linhas, de cima (Telhados) para baixo (Chão); o texto da linha é só nome e contagem', () => {
    const nomes = linhas().map((li) => li.getAttribute('data-camada'))
    expect(nomes).toEqual([...CAMADAS_PADRAO].reverse())
    const paredes = linhas().find((li) => li.getAttribute('data-camada') === 'paredes')
    expect(paredes?.textContent).toBe('Paredes3')
    expect(paredes?.querySelectorAll('button.lb-iconbtn')).toHaveLength(3)
    expect(paredes?.querySelectorAll('input[type="range"]')).toHaveLength(1)
    expect(paredes?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('olho do mestre: nome e aria-pressed do jeito das jornadas seladas; o segundo clique volta ao estado inicial', () => {
    act(() => button('Ocultar Paredes').click())
    expect(pedir).toHaveBeenCalledTimes(1)
    expect(pedir).toHaveBeenLastCalledWith({ tipo: 'mestre', id: 'paredes' })
    expect(button('Mostrar Paredes').getAttribute('aria-pressed')).toBe('true')
    expect(button('Mostrar Paredes').closest('li')?.hasAttribute('data-hidden')).toBe(true)
    // Mapa de antes: a oculta de antes some também para os jogadores (o olho deles mostra isso).
    expect(button('Mostrar Paredes aos jogadores').getAttribute('aria-pressed')).toBe('true')
    // O outro callback não foi chamado.
    expect(pedir.mock.calls.every(([p]) => p.tipo === 'mestre')).toBe(true)
    act(() => button('Mostrar Paredes').click())
    expect(pedir).toHaveBeenCalledTimes(2)
    expect(button('Ocultar Paredes').getAttribute('aria-pressed')).toBe('false')
    expect(button('Ocultar Paredes').closest('li')?.hasAttribute('data-hidden')).toBe(false)
  })

  it('olho dos jogadores: "Ocultar X dos jogadores" / "Mostrar X aos jogadores" com aria-pressed; o do mestre não muda', () => {
    const olho = button('Ocultar Tokens dos jogadores')
    expect(olho.getAttribute('aria-pressed')).toBe('false')
    act(() => olho.click())
    expect(pedir).toHaveBeenCalledTimes(1)
    expect(pedir).toHaveBeenLastCalledWith({ tipo: 'jogadores', id: 'tokens' })
    expect(button('Mostrar Tokens aos jogadores').getAttribute('aria-pressed')).toBe('true')
    expect(button('Ocultar Tokens').getAttribute('aria-pressed')).toBe('false')
    act(() => button('Mostrar Tokens aos jogadores').click())
    expect(button('Ocultar Tokens dos jogadores').getAttribute('aria-pressed')).toBe('false')
    expect(pedir.mock.calls.every(([p]) => p.tipo === 'jogadores')).toBe(true)
  })

  it('cadeado: "Travar X" / "Destravar X" com aria-pressed; o segundo clique destrava', () => {
    act(() => button('Travar Chão').click())
    expect(pedir).toHaveBeenCalledTimes(1)
    expect(pedir).toHaveBeenLastCalledWith({ tipo: 'cadeado', id: 'chao' })
    expect(button('Destravar Chão').getAttribute('aria-pressed')).toBe('true')
    expect(button('Travar Salas').getAttribute('aria-pressed')).toBe('false')
    act(() => button('Destravar Chão').click())
    expect(button('Travar Chão').getAttribute('aria-pressed')).toBe('false')
    expect(pedir.mock.calls.every(([p]) => p.tipo === 'cadeado')).toBe(true)
  })

  it('o nome abre a linha: aria-expanded, slider fora do Tab até abrir, UMA aberta por vez, Esc fecha e devolve o foco ao nome', () => {
    const nome = (rotulo: string) => button(`${rotulo}, opacidade`)
    const corpoDe = (rotulo: string) => document.getElementById(nome(rotulo).getAttribute('aria-controls') ?? '')
    expect(nome('Salas').getAttribute('aria-expanded')).toBe('false')
    expect(corpoDe('Salas')?.hasAttribute('inert')).toBe(true)
    expect(corpoDe('Salas')?.contains(slider('Opacidade de Salas'))).toBe(true)
    act(() => nome('Salas').click())
    expect(nome('Salas').getAttribute('aria-expanded')).toBe('true')
    expect(corpoDe('Salas')?.hasAttribute('inert')).toBe(false)
    expect(corpoDe('Salas')?.textContent).toContain('Para você e para os jogadores')
    // Abrir outra fecha a primeira.
    act(() => nome('Paredes').click())
    expect(nome('Salas').getAttribute('aria-expanded')).toBe('false')
    expect(nome('Paredes').getAttribute('aria-expanded')).toBe('true')
    // Esc com o foco no slider: fecha e o foco volta ao nome.
    const faixa = slider('Opacidade de Paredes')
    faixa.focus()
    act(() => {
      faixa.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(nome('Paredes').getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(nome('Paredes'))
    // Fechada, o texto da linha é só nome e contagem (as jornadas leem "Paredes 3").
    expect(nome('Paredes').closest('li')?.textContent).toBe('Paredes3')
    // A ordem do DOM é a da leitura: nome, os três botões, e só então o slider.
    const linha = nome('Paredes').closest('li')
    const focaveis = Array.from(linha?.querySelectorAll('button, input') ?? []).map((el) => el.getAttribute('aria-label'))
    expect(focaveis).toEqual(['Paredes, opacidade', 'Ocultar Paredes', 'Ocultar Paredes dos jogadores', 'Travar Paredes', 'Opacidade de Paredes'])
    expect(pedir).not.toHaveBeenCalled()
  })

  it('o slider avisa no tooltip que 0% some para todos, e o tooltip não muda com o valor', () => {
    const antes = slider('Opacidade de Salas').title
    expect(antes).toContain('0% some para todos')
    arrastar(slider('Opacidade de Salas'), [40])
    expect(slider('Opacidade de Salas').title).toBe(antes)
  })

  it('opacidade: slider "Opacidade de X" com o valor em aria-valuetext; um arrasto manda UM gesto; a porcentagem fica fora do texto', () => {
    const faixa = slider('Opacidade de Objetos')
    expect(faixa.getAttribute('aria-valuetext')).toBe('100%')
    arrastar(faixa, [90, 70, 40])
    const gestos = pedir.mock.calls.map(([p]) => (p.tipo === 'opacidade' ? p.gesto : null))
    expect(new Set(gestos).size).toBe(1)
    expect(pedir).toHaveBeenLastCalledWith(expect.objectContaining({ tipo: 'opacidade', id: 'objetos', valor: 0.4 }))
    expect(slider('Opacidade de Objetos').getAttribute('aria-valuetext')).toBe('40%')
    const linha = slider('Opacidade de Objetos').closest('li')
    expect(linha?.querySelector('[data-pct]')?.getAttribute('data-pct')).toBe('40%')
    expect(linha?.textContent).toBe('Objetos2')
    // Outro arrasto, outro gesto.
    arrastar(slider('Opacidade de Objetos'), [30])
    const todos = pedir.mock.calls.map(([p]) => (p.tipo === 'opacidade' ? p.gesto : null))
    expect(new Set(todos).size).toBe(2)
  })

  it('Chão leva as camadas do chão aninhadas; Telhados leva o Transparente só enquanto o mestre vê os telhados', () => {
    const chao = linhas().find((li) => li.getAttribute('data-camada') === 'chao')
    expect(chao?.querySelector('ul[aria-label="Camadas do chão"]')).not.toBeNull()
    const telhados = () => linhas().find((li) => li.getAttribute('data-camada') === 'telhados')
    expect(telhados()?.textContent).toContain('Transparente')
    act(() => button('Ocultar Telhados').click())
    expect(telhados()?.textContent).not.toContain('Transparente')
  })
})
