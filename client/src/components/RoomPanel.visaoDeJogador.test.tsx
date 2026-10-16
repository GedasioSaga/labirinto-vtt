import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TunnelState } from '../net/hostBridge'
import type { FichaParaTeste, VisaoDeJogadorNoPainel } from '../net/visaoDeTeste/tipos'
import { VISAO_DE_JOGADOR_AJUDA, type RoomPanelProps } from './RoomPanel'
import { PaginaMesa } from './livro/PaginaMesa'
import { TopoDaSala } from './livro/TopoDaSala'

/*
 * VISÃO DE JOGADOR no livro da mesa (maquete 1A, 1B e 1C; lugar novo na
 * fatia 4): o botão no topo da Sala fechada, logo abaixo de "Abrir sala", e
 * na ficha "Visão de jogador" da página Mesa (com a linha de ajuda); a lista
 * de fichas presa a ele e o estado "Janela aberta". Sem a prop, nada aparece.
 */

const noop = vi.fn()
const BASE: RoomPanelProps = {
  room: null,
  players: [],
  tokens: [],
  tunnel: { kind: 'idle' } satisfies TunnelState,
  clues: { rows: [], onCenter: noop, onToggle: noop },
  onStart: noop,
  onStop: noop,
  onStartTunnel: noop,
  onStopTunnel: noop,
  onAssign: noop,
  onUnassign: noop,
  onKick: noop,
  onVisionRadiusChange: noop,
  onVisionFactorChange: noop,
  onRevealPlan: noop,
  onHidePlan: noop,
}
const ROOM = { code: 'K7Q2XM', urls: ['http://10.0.0.2:7777'], qrSvg: '<svg/>' }

const GROG: FichaParaTeste = { id: 'grog', nome: 'Grog', retrato: null, cor: '#35b24a', dono: 'Ana', npc: false }
const LYRA: FichaParaTeste = { id: 'lyra', nome: 'Lyra Ventoleste', retrato: null, cor: '#5a8fd6', dono: 'Bruno', npc: false }

function visao(overrides: Partial<VisaoDeJogadorNoPainel> = {}): VisaoDeJogadorNoPainel {
  return {
    aberta: false,
    fichaAberta: null,
    fichas: [LYRA, GROG],
    fichaSelecionadaId: 'grog',
    onAbrir: vi.fn(),
    onMostrar: vi.fn(),
    onFechar: vi.fn(),
    ...overrides,
  }
}

describe('RoomPanel — Visão de jogador', () => {
  it('sem a prop, nenhum botão novo no topo da Sala nem na página Mesa, nas duas formas da sala', () => {
    expect(renderToStaticMarkup(<TopoDaSala {...BASE} />)).not.toContain('Visão de jogador')
    expect(renderToStaticMarkup(<TopoDaSala {...BASE} room={ROOM} />)).not.toContain('Visão de jogador')
    expect(renderToStaticMarkup(<PaginaMesa {...BASE} />)).not.toContain('Visão de jogador')
  })

  it('sala fechada: no topo, logo abaixo de "Abrir sala" e antes da Rede, sem a linha de ajuda', () => {
    const html = renderToStaticMarkup(<TopoDaSala {...BASE} visaoDeJogador={visao()} />)
    const abrir = html.indexOf('Abrir sala')
    const botao = html.indexOf('Visão de jogador')
    expect(abrir).toBeGreaterThan(-1)
    expect(botao).toBeGreaterThan(abrir)
    expect(html.indexOf('Rede<')).toBeGreaterThan(botao)
    expect(html).not.toContain(VISAO_DE_JOGADOR_AJUDA)
    expect(html).toMatch(/<button[^>]*aria-haspopup="dialog"[^>]*aria-expanded="false"/)
  })

  it('página Mesa: a ficha Visão de jogador traz o botão com a linha de ajuda ligada a ele, nas duas formas da sala', () => {
    for (const room of [null, ROOM]) {
      const html = renderToStaticMarkup(<PaginaMesa {...BASE} room={room} visaoDeJogador={visao()} />)
      const describedby = /<button[^>]*aria-describedby="([^"]+)"[^>]*>.*?Visão de jogador/.exec(html)?.[1]
      expect(describedby).toBeDefined()
      expect(html).toContain('<p id="' + describedby + '" class="lb-room__visao-ajuda">' + VISAO_DE_JOGADOR_AJUDA + '</p>')
    }
  })

  describe('interação', () => {
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

    function botao(): HTMLButtonElement {
      const achado = container.querySelector<HTMLButtonElement>('.lb-room__visao-botao')
      if (achado === null) throw new Error('sem o botão Visão de jogador')
      return achado
    }

    function clicar(alvo: HTMLElement, detail = 1): void {
      act(() => {
        alvo.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail }))
      })
    }

    function lista(): HTMLElement | null {
      return document.querySelector<HTMLElement>('[role="dialog"][aria-label="Escolher a ficha"]')
    }

    it('abre a lista presa ao botão; escolher a ficha abre a janela de teste com ela', () => {
      const v = visao()
      act(() => root.render(<TopoDaSala {...BASE} visaoDeJogador={v} />))
      clicar(botao())
      expect(botao().getAttribute('aria-expanded')).toBe('true')
      expect(botao().getAttribute('aria-controls')).toBe(lista()?.id)
      expect(lista()?.getAttribute('data-abertura')).toBe('ponteiro')
      // A selecionada no mapa vem primeiro e ativa: Enter abre a janela com ela.
      act(() => {
        document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
      })
      expect(v.onAbrir).toHaveBeenCalledExactlyOnceWith('grog')
      expect(lista()).toBeNull()
      expect(document.activeElement).toBe(botao())
      expect(botao().getAttribute('aria-expanded')).toBe('false')
    })

    it('pelo teclado a lista aparece parada; clicar de novo no botão fecha', () => {
      act(() => root.render(<TopoDaSala {...BASE} visaoDeJogador={visao()} />))
      clicar(botao(), 0)
      expect(lista()?.getAttribute('data-abertura')).toBe('teclado')
      clicar(botao())
      expect(lista()).toBeNull()
    })

    it('janela aberta: latão com a ficha à direita; clicar traz a janela para a frente, e o × fecha devolvendo o foco', () => {
      const v = visao({ aberta: true, fichaAberta: 'Grog' })
      act(() => root.render(<PaginaMesa {...BASE} room={ROOM} visaoDeJogador={v} />))
      expect(botao().classList.contains('lb-room__visao-botao--aberta')).toBe(true)
      expect(botao().getAttribute('aria-label')).toBe('Visão de jogador: mostrar a janela de Grog')
      expect(botao().hasAttribute('aria-expanded')).toBe(false)
      expect(container.querySelector('.lb-room__visao-nome')?.textContent).toBe('Grog')
      // O retrato pega a cor da ficha da lista (nome único).
      expect(container.querySelector<HTMLElement>('.lb-room__visao-ficha .vj-retrato')?.style.backgroundColor).toBe('rgb(53, 178, 74)')
      clicar(botao())
      expect(v.onMostrar).toHaveBeenCalledOnce()
      expect(lista()).toBeNull()
      const fechar = container.querySelector<HTMLButtonElement>('button[aria-label="Fechar a janela de teste"]')
      if (fechar === null) throw new Error('sem o ×')
      clicar(fechar)
      expect(v.onFechar).toHaveBeenCalledOnce()
      expect(document.activeElement).toBe(botao())
    })

    it('a janela abrindo por outro caminho fecha a lista, e ela não volta sozinha quando a janela fecha', () => {
      act(() => root.render(<TopoDaSala {...BASE} visaoDeJogador={visao()} />))
      clicar(botao())
      expect(lista()).not.toBeNull()
      act(() => root.render(<TopoDaSala {...BASE} visaoDeJogador={visao({ aberta: true, fichaAberta: 'Lyra Ventoleste' })} />))
      expect(lista()).toBeNull()
      act(() => root.render(<TopoDaSala {...BASE} visaoDeJogador={visao()} />))
      expect(lista()).toBeNull()
    })
  })
})
