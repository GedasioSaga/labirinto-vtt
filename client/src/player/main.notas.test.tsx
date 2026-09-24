/**
 * ANOTAÇÃO PESSOAL montada na página do jogador (`main.tsx`), sem navegador:
 * Fabi liga "Anotar", toca ao lado do baú e escreve "baú trancado aqui". A
 * nota aparece no mapa dela, fica no aparelho (volta ao recarregar) e NADA
 * sai pelo fio — nem a nota, nem o sinal de 3 s. O toque longo na nota apaga;
 * "Minhas notas" no Caderno lista e centraliza.
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
import { PERSONAL_NOTES_KEY, loadPersonalNotes, type PersonalNote } from './personalNotes'

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

/** De uma sessão anterior neste aparelho: uma nota nesta cena e uma em outra. */
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

/** O que está no aparelho agora, lido como a página lê ao recarregar. */
function notasGuardadas(): PersonalNote[] {
  return loadPersonalNotes(localStorage)
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
  localStorage.setItem(PERSONAL_NOTES_KEY, JSON.stringify(ANTIGAS))
  await act(async () => {
    await import('./main')
  })
  act(() => mestre().abre())
  act(() => {
    mestre().manda({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Fabi' })
    mestre().manda({ type: 'snapshot', rev: 1, map: MAPA, vision: [], ownTokens: ['fabi'], concealed: [] })
  })
})

afterAll(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
  sessionStorage.clear()
})

describe('main.tsx: anotação pessoal de ponta a ponta', () => {
  it('recarregou: a nota guardada no aparelho volta no mapa desta cena, e a de outra cena não aparece', () => {
    expect(notasNoMapa()).toEqual(['poço seco'])
    expect(notasNoMapa()).not.toContain('armadilha no corredor')
  })

  it('Fabi anota ao lado do baú: a nota aparece no mapa dela, fica no aparelho e nada sai pelo fio', () => {
    const enviadasAntes = mestre().sent.length
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

    expect(document.querySelector('input[maxlength="40"]')).toBeNull()
    expect(notasNoMapa()).toEqual(['poço seco', 'baú trancado aqui'])
    const guardada = notasGuardadas().find((nota) => nota.text === 'baú trancado aqui')
    expect(guardada).toMatchObject({ mapId: 'vila', x: BAU.x, y: BAU.y })
    // Bruno não vê: nenhuma mensagem saiu — nem a nota, nem o sinal do toque.
    expect(mestre().sent.length).toBe(enviadasAntes)
    expect(mestre().sent.some((m) => m.includes('baú trancado'))).toBe(false)
  })

  it('Caderno > Minhas notas: tocar na nota leva a câmera até ela', () => {
    const caderno = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find((b) => /Caderno/.test(b.textContent ?? ''))
    if (!caderno) throw new Error('sem a aba Caderno')
    act(() => caderno.click())
    const centrar = document.querySelector<HTMLButtonElement>('button[aria-label="Centralizar em baú trancado aqui"]')
    if (!centrar) throw new Error('sem a nota em Minhas notas')
    act(() => centrar.click())
    expect(mapa().dataset.foco).toBe(`${BAU.x},${BAU.y}`)
  })

  it('toque longo na nota apaga: some do mapa e do aparelho, sem mandar sinal', () => {
    const enviadasAntes = mestre().sent.length
    act(() => botao('segurar nota baú trancado aqui').click())
    expect(notasNoMapa()).toEqual(['poço seco'])
    expect(notasGuardadas().map((nota) => nota.text)).toEqual(['poço seco', 'armadilha no corredor'])
    expect(mestre().sent.length).toBe(enviadasAntes)
  })
})
