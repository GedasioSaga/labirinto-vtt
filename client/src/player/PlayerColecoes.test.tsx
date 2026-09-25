/**
 * COLEÇÃO DE PISTAS na tela do jogador: no Caderno, cada coleção é uma fileira
 * de casas ("Letreiro · 2 de 3"), cheias as que ele tem e vazias as que
 * faltam. Tocar numa casa cheia reabre o cartão da pista. Juntas todas, a
 * frase inteira aparece, sempre como texto.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { ColecaoProgresso } from '../lib/colecao'
import type { ClueEntry } from '../net/protocol'
import { PlayerColecaoList } from './PlayerClues'
import { DEFAULT_PLAYER_SETTINGS, PlayerPanel } from './PlayerPanel'
import { createPlayerConnection, type SocketLike } from './playerConnection'

const AS_20 = new Date(2026, 8, 24, 20, 0).getTime()
const LETRA_A: ClueEntry = { id: 'c1', title: 'Letra Á', text: 'Letra Á', image: null, at: AS_20 }
const LETRA_S: ClueEntry = { id: 'c3', title: 'Letra S', text: 'Letra S', image: null, at: AS_20 }
const DUAS_DE_TRES: ColecaoProgresso = {
  nome: 'Letreiro',
  total: 3,
  partes: [
    { parte: 1, clueId: 'c1' },
    { parte: 3, clueId: 'c3' },
  ],
  completa: false,
}

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
  vi.unstubAllGlobals()
})

describe('PlayerColecaoList', () => {
  it('2 de 3: a contagem, duas casas cheias que são botões e uma vazia que não é', () => {
    const onOpen = vi.fn()
    act(() => root.render(<PlayerColecaoList colecoes={[DUAS_DE_TRES]} clues={[LETRA_A, LETRA_S]} onOpen={onOpen} />))
    expect(container.textContent).toContain('Letreiro')
    expect(container.textContent).toContain('2 de 3')
    const casas = container.querySelectorAll('.pp-colecao__casa')
    expect(casas).toHaveLength(3)
    const botoes = [...container.querySelectorAll<HTMLButtonElement>('button.pp-colecao__casa')]
    expect(botoes.map((b) => b.getAttribute('aria-label'))).toEqual(['Peça 1 de 3', 'Peça 3 de 3'])
    expect(container.querySelector('[aria-label="Peça 2 de 3: falta"]')).not.toBeNull()
    act(() => botoes[1]?.click())
    expect(onOpen).toHaveBeenCalledWith('c3')
  })

  it('peça cuja pista já saiu do caderno fica cheia, mas não abre nada', () => {
    act(() => root.render(<PlayerColecaoList colecoes={[DUAS_DE_TRES]} clues={[LETRA_A]} onOpen={vi.fn()} />))
    expect([...container.querySelectorAll('button.pp-colecao__casa')].map((b) => b.getAttribute('aria-label'))).toEqual(['Peça 1 de 3'])
    expect(container.querySelector('[aria-label="Peça 3 de 3"]')?.tagName).toBe('SPAN')
  })

  it('completa: mostra a frase inteira como texto (marcação não vira HTML)', () => {
    const completa: ColecaoProgresso = { ...DUAS_DE_TRES, partes: [...DUAS_DE_TRES.partes, { parte: 2, clueId: 'c2' }], completa: true, inteira: '<b>A BOCA ABRE</b>' }
    act(() => root.render(<PlayerColecaoList colecoes={[completa]} clues={[]} onOpen={vi.fn()} />))
    expect(container.textContent).toContain('3 de 3')
    const frase = container.querySelector('.pp-colecao__inteira')
    expect(frase?.textContent).toBe('<b>A BOCA ABRE</b>')
    expect(container.querySelector('b')).toBeNull()
  })

  it('completa sem frase escrita pelo mestre: diz que juntou todas', () => {
    const completa: ColecaoProgresso = { nome: 'Chave', total: 1, partes: [{ parte: 1, clueId: 'c1' }], completa: true }
    act(() => root.render(<PlayerColecaoList colecoes={[completa]} clues={[]} onOpen={vi.fn()} />))
    expect(container.querySelector('.pp-colecao__inteira')?.textContent).toBe('Você juntou todas as peças.')
  })

  it('sem coleção nenhuma: não desenha nada', () => {
    act(() => root.render(<PlayerColecaoList colecoes={[]} clues={[]} onOpen={vi.fn()} />))
    expect(container.innerHTML).toBe('')
  })
})

describe('PlayerPanel — a coleção mora no Caderno, junto das pistas', () => {
  it('aba Caderno mostra "Letreiro 2 de 3" acima da lista de pistas', () => {
    // jsdom não tem matchMedia: janela larga, painel em coluna (mesmo stub de PlayerPanel.caderno.test).
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {} }))
    act(() =>
      root.render(
        <PlayerPanel
          characters={[{ id: 't1', name: 'Gabi' }]}
          characterColor="#fff"
          settings={DEFAULT_PLAYER_SETTINGS}
          onSettingsChange={vi.fn()}
          onFocusToken={vi.fn()}
          signalArmed={false}
          onToggleSignal={vi.fn()}
          measureArmed={false}
          onToggleMeasure={vi.fn()}
          laserArmed={false}
          onToggleLaser={vi.fn()}
          onRenameToken={vi.fn()}
          onChangeTokenPhoto={vi.fn()}
          notebook={[]}
          notebookUnread={false}
          onReadNotebook={vi.fn()}
          clues={[LETRA_A, LETRA_S]}
          colecoes={[DUAS_DE_TRES]}
        />,
      ),
    )
    const aba = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((b) => b.textContent?.includes('Caderno'))
    if (aba === undefined) throw new Error('sem a aba Caderno')
    act(() => aba.click())
    const painel = container.querySelector('[role="tabpanel"]:not([hidden])')
    expect(painel?.querySelector('.pp-colecoes')?.textContent).toContain('2 de 3')
    // A coleção vem antes da lista de pistas, na ordem de leitura.
    const colecoes = painel?.querySelector('.pp-colecoes')
    const lista = painel?.querySelector('.pp-clues')
    expect(colecoes !== null && colecoes !== undefined && lista !== null && lista !== undefined && (colecoes.compareDocumentPosition(lista) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0).toBe(true)
  })
})

class FakeSocket implements SocketLike {
  readyState = 0
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  send(): void {}
  close(): void {}
  open(): void {
    this.readyState = 1
    this.onopen?.(new Event('open'))
  }
  receive(message: unknown): void {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(message) }))
  }
}

describe('playerConnection — a coleção que o host manda', () => {
  it('guarda a lista em state.colecoes; forma errada é ignorada', () => {
    const sockets: FakeSocket[] = []
    const connection = createPlayerConnection({
      url: 'ws://host/ws',
      code: 'ABC123',
      name: 'Gabi',
      storage: null,
      createSocket: () => {
        const socket = new FakeSocket()
        sockets.push(socket)
        return socket
      },
    })
    const socket = sockets[0]
    if (!socket) throw new Error('socket não criado')
    socket.open()
    socket.receive({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Gabi' })
    socket.receive({ type: 'snapshot', rev: 1, map: createEmptyMap('m1', '', 10, 10, 50), vision: [], ownTokens: [], concealed: [] })
    socket.receive({ type: 'colecoes', colecoes: [DUAS_DE_TRES] })
    expect(connection.getState().colecoes).toEqual([DUAS_DE_TRES])
    socket.receive({ type: 'colecoes', colecoes: [{ ...DUAS_DE_TRES, total: 0 }] })
    expect(connection.getState().colecoes).toEqual([DUAS_DE_TRES])
  })
})
