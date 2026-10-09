/**
 * ANOTAÇÃO PESSOAL montada na página do jogador (`main.tsx`), sem navegador:
 * Fabi liga "Anotar", toca ao lado do baú e escreve "baú trancado aqui". A
 * nota aparece no mapa dela e a lista INTEIRA vai ao host (`mynotes.set`),
 * que a guarda só para ela e devolve na volta (`mynotes.book`) — nenhum sinal,
 * nada para os colegas. O toque longo na nota apaga; "Minhas notas" no
 * Caderno lista as de todos os mapas e centraliza as desta cena.
 *
 * Só o que o jsdom não tem é trocado: a `PlayerView` (Pixi pede WebGL) vira
 * botões que chamam os mesmos ganchos (`onNotePlace`, `onNoteLongPress`) e
 * mostram o que ela recebeu (`personalNotes`, `focusPoint`); o `WebSocket`
 * vira um falso que faz o papel do mestre e guarda tudo que saiu.
 */
import { act } from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData } from '../types/map'
import { MY_NOTES_SEND_INTERVAL_MS } from '../lib/minhasNotas'
import type { PersonalNote } from './personalNotes'

type PlayerViewProps = Parameters<(typeof import('./PlayerView'))['PlayerView']>[0]

const BAU = { x: 420, y: 180 }

vi.mock('./PlayerView', () => ({
  OWN_TOKEN_CSS: '#4ea1ff',
  PlayerView: ({ personalNotes = [], onNotePlace, onNoteLongPress, focusPoint, noteArmed }: PlayerViewProps) => (
    <div data-testid="mapa" data-anotar={String(noteArmed ?? false)} data-foco={focusPoint ? `${focusPoint.x},${focusPoint.y}` : ''}>
      <ul data-testid="notas-no-mapa">
        {personalNotes.map((nota) => (
          <li key={nota.id}>{nota.text}</li>
        ))}
      </ul>
      {/* O toque com "Anotar" ligado: o mesmo ramo do pointerdown do "Marcar destino". */}
      <button type="button" onClick={() => onNotePlace?.(BAU.x, BAU.y)}>
        tocar ao lado do bau
      </button>
      {personalNotes.map((nota) => (
        <button key={nota.id} type="button" onClick={() => onNoteLongPress?.(nota.id)}>
          {`segurar nota ${nota.text}`}
        </button>
      ))}
    </div>
  ),
}))

const CODE = 'ABC123'

class MestreFalso {
  static ultimo: MestreFalso | null = null
  readyState = 0
  sent: string[] = []
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  constructor() {
    MestreFalso.ultimo = this
  }
  send(data: string): void {
    this.sent.push(data)
  }
  close(): void {
    this.readyState = 3
  }
  abre(): void {
    this.readyState = 1
    this.onopen?.(new Event('open'))
  }
  manda(message: unknown): void {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(message) }))
  }
}

function mestre(): MestreFalso {
  const atual = MestreFalso.ultimo
  if (atual === null) throw new Error('a página não abriu o socket')
  return atual
}

const MAPA: MapData = {
  ...createEmptyMap('vila', '', 20, 12, 50),
  tokens: [{ id: 'fabi', characterId: null, name: 'Fabi', x: 300, y: 300, size: 1, image: null }],
}

/** De uma sessão anterior, guardadas no host: uma nota nesta cena e uma em outra. */
const ANTIGAS: PersonalNote[] = [
  { id: 'antiga-vila', mapId: 'vila', x: 100, y: 100, text: 'poço seco' },
  { id: 'antiga-masmorra', mapId: 'masmorra', x: 5, y: 5, text: 'armadilha no corredor' },
]

function botao(nome: string): HTMLButtonElement {
  const achado = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent === nome)
  if (!achado) throw new Error(`sem o botão ${nome}`)
  return achado
}

function notasNoMapa(): string[] {
  return Array.from(document.querySelectorAll('[data-testid="notas-no-mapa"] li')).map((li) => li.textContent ?? '')
}

function aba(nome: RegExp): HTMLButtonElement {
  const achada = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find((b) => nome.test(b.textContent ?? ''))
  if (!achada) throw new Error(`sem a aba ${nome}`)
  return achada
}

function mapa(): HTMLElement {
  const achado = document.querySelector<HTMLElement>('[data-testid="mapa"]')
  if (!achado) throw new Error('mapa fora da tela')
  return achado
}

function digita(input: HTMLInputElement, valor: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(input, valor)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

beforeAll(async () => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('WebSocket', MestreFalso)
  const raiz = document.createElement('div')
  raiz.id = 'root'
  document.body.appendChild(raiz)
  localStorage.setItem('labirinto.ultima-entrada', JSON.stringify({ code: CODE, name: 'Fabi' }))
  sessionStorage.setItem('labirinto.resume', JSON.stringify({ code: CODE, token: 'tok' }))
  await act(async () => {
    await import('./boot')
  })
  act(() => mestre().abre())
  act(() => {
    mestre().manda({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Fabi' })
    mestre().manda({ type: 'mynotes.book', notes: ANTIGAS })
    mestre().manda({ type: 'snapshot', rev: 1, map: MAPA, vision: [], ownTokens: ['fabi'], concealed: [] })
  })
})

afterAll(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
  sessionStorage.clear()
})

describe('main.tsx: anotação pessoal de ponta a ponta', () => {
  it('a lista que o host guardou para ela volta: no mapa só a desta cena; no Caderno, as de todos os mapas', () => {
    expect(notasNoMapa()).toEqual(['poço seco'])
    expect(notasNoMapa()).not.toContain('armadilha no corredor')
    act(() => aba(/Caderno/).click())
    const caderno = document.querySelector('[role="tabpanel"]:not([hidden])')?.textContent ?? ''
    expect(caderno).toContain('poço seco')
    expect(caderno).toContain('armadilha no corredor')
    act(() => aba(/Jogo/).click())
  })

  it('Fabi anota pelo menu Marcações: a nota aparece no mapa e a lista INTEIRA vai ao host, sem sinal nenhum', async () => {
    const enviadasAntes = mestre().sent.length
    act(() => botao('Marcações').click())
    act(() => botao('Anotar').click())
    expect(mapa().dataset.anotar).toBe('true')
    act(() => botao('tocar ao lado do bau').click())
    // Um toque: o modo desliga e o cartão pede o texto.
    expect(mapa().dataset.anotar).toBe('false')
    const campo = document.querySelector<HTMLInputElement>('input[maxlength="40"]')
    if (!campo) throw new Error('o cartão da anotação não abriu')
    expect(document.activeElement).toBe(campo)
    digita(campo, 'baú trancado aqui')
    act(() => botao('Salvar').click())
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(document.querySelector('input[maxlength="40"]')).toBeNull()
    expect(notasNoMapa()).toEqual(['poço seco', 'baú trancado aqui'])
    const saidas = mestre().sent.slice(enviadasAntes).map((texto) => JSON.parse(texto) as { type: string; notes?: PersonalNote[] })
    // Só a lista ao host: nem o sinal do toque, nem nada para os colegas.
    expect(saidas.map((m) => m.type)).toEqual(['mynotes.set'])
    expect(saidas[0]?.notes?.map((nota) => nota.text)).toEqual(['poço seco', 'armadilha no corredor', 'baú trancado aqui'])
    expect(saidas[0]?.notes?.[2]).toMatchObject({ mapId: 'vila', x: BAU.x, y: BAU.y })
  })

  it('Caderno > Minhas notas: tocar na nota desta cena leva a câmera até ela', () => {
    act(() => aba(/Caderno/).click())
    const centrar = document.querySelector<HTMLButtonElement>('button[aria-label="Centralizar em baú trancado aqui"]')
    if (!centrar) throw new Error('sem a nota em Minhas notas')
    act(() => centrar.click())
    expect(mapa().dataset.foco).toBe(`${BAU.x},${BAU.y}`)
    act(() => aba(/Jogo/).click())
  })

  it('toque longo na nota apaga: some do mapa e a lista nova vai ao host depois do intervalo, sem sinal', () => {
    vi.useFakeTimers()
    try {
      const enviadasAntes = mestre().sent.length
      act(() => botao('segurar nota baú trancado aqui').click())
      expect(notasNoMapa()).toEqual(['poço seco'])
      act(() => {
        vi.advanceTimersByTime(MY_NOTES_SEND_INTERVAL_MS)
      })
      const saidas = mestre().sent.slice(enviadasAntes).map((texto) => JSON.parse(texto) as { type: string; notes?: PersonalNote[] })
      expect(saidas.map((m) => m.type)).toEqual(['mynotes.set'])
      expect(saidas[0]?.notes?.map((nota) => nota.text)).toEqual(['poço seco', 'armadilha no corredor'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('o host recusou por pressa (too_soon): a mesma lista vai de novo depois do intervalo', () => {
    vi.useFakeTimers()
    try {
      const enviadasAntes = mestre().sent.length
      act(() => mestre().manda({ type: 'mynotes.rejected', reason: 'too_soon' }))
      // Nunca antes do intervalo, contado também do último envio (que foi há pouco, no teste anterior).
      act(() => {
        vi.advanceTimersByTime(2 * MY_NOTES_SEND_INTERVAL_MS)
      })
      const saidas = mestre().sent.slice(enviadasAntes).map((texto) => JSON.parse(texto) as { type: string; notes?: PersonalNote[] })
      expect(saidas.map((m) => m.type)).toEqual(['mynotes.set'])
      expect(saidas[0]?.notes?.map((nota) => nota.text)).toEqual(['poço seco', 'armadilha no corredor'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('voltou de uma queda: a lista guardada no host manda (a tela não tinha nada por mandar)', () => {
    act(() =>
      mestre().manda({ type: 'mynotes.book', notes: [{ id: 'outra-vila', mapId: 'vila', x: 1, y: 1, text: 'escada podre' }] }),
    )
    expect(notasNoMapa()).toEqual(['escada podre'])
  })
})
