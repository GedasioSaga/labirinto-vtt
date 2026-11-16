/**
 * "LER AGORA" DUAS VEZES SEGUIDAS ('!' Cenário, P4) na tela do jogador
 * (`main.tsx`). Achado na conferência ao vivo de 16/11/2026: o 2º "Ler agora"
 * chegou com o 1º cartão ainda aberto e o título trocou, mas a datilografia
 * continuou com o texto do 1º pino (Ana viu "Fonte" com "TXZONA o cofre…").
 * O fio levava o texto certo: a revelação só relê o texto ao montar, e o
 * overlay não remontava.
 *
 * Regra: cada leitura remonta o cartão com o próprio título e texto, e o
 * cartão trocado conta como lido (o jogador o viu) — o host ouve
 * `cenario.lido` dos dois pinos.
 *
 * Mesma costura de `main.revelacaoSobreOCartao.test.tsx`: a `PlayerView`
 * vira uma lista de botões e o `WebSocket` vira um mestre falso que guarda o
 * que o jogador mandou.
 */
import { act } from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { Pin } from '../types/map'
import { PRAZO_DA_IMPORTACAO_MS } from './importacaoDaPagina.testkit'

type PlayerViewProps = Parameters<(typeof import('./PlayerView'))['PlayerView']>[0]

vi.mock('./PlayerView', () => ({
  OWN_TOKEN_CSS: '#4ea1ff',
  PlayerView: ({ map, onPinOpen }: PlayerViewProps) => (
    <div data-testid="mapa">
      {map.pins.map((pin) => (
        <button key={pin.id} type="button" data-pin={pin.id} onClick={() => onPinOpen?.(pin.id)}>
          {`pino ${pin.id}`}
        </button>
      ))}
    </div>
  ),
}))

const CODE = 'ABC123'

class MestreFalso {
  static ultimo: MestreFalso | null = null
  readonly url: string
  readyState = 0
  sent: unknown[] = []
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  constructor(url: string) {
    this.url = url
    MestreFalso.ultimo = this
  }
  send(data: string): void {
    this.sent.push(JSON.parse(data))
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
  enviados(tipo: string): unknown[] {
    return this.sent.filter((m) => typeof m === 'object' && m !== null && 'type' in m && m.type === tipo)
  }
}

function mestre(): MestreFalso {
  const atual = MestreFalso.ultimo
  if (atual === null) throw new Error('a página não abriu o socket')
  return atual
}

const COFRE: Pin = { id: 'cofre', x: 100, y: 100, kind: 'exclamacao', description: 'TXZONA o cofre range.', image: null, nome: 'Cofre' }
const FONTE: Pin = { id: 'fonte', x: 300, y: 100, kind: 'exclamacao', description: 'A fonte borbulha.', image: null, nome: 'Fonte' }

function lerAgora(pinId: string, nome: string, texto: string): void {
  act(() => mestre().manda({ type: 'cenario.ler', pinId, nome, texto }))
}

const revelacao = (): Element | null => document.querySelector('.lb-revelacao-jogo')
const titulo = (): string | null => document.querySelector('.lb-revelacao__nome')?.textContent ?? null
/** O que a datilografia escreve na tela (o já escrito + o que falta, transparente), não o parágrafo do leitor de tela. */
const datilografado = (): string | null => document.querySelector('.lb-revelacao__texto')?.textContent ?? null
const lidos = (): unknown[] => mestre().enviados('cenario.lido')

/** O toque de verdade: o pointerdown que o cartão ouve na janela, depois o clique. */
function tocar(rotulo: string): void {
  const el = document.querySelector<HTMLButtonElement>('.lb-revelacao__pular')
  if (el === null || el.textContent !== rotulo) throw new Error(`a revelação não mostra "${rotulo}"`)
  act(() => {
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))
    el.click()
  })
}

function fecharARevelacao(): void {
  tocar('Pular')
  tocar('Fechar')
  act(() => vi.advanceTimersByTime(1000))
}

beforeAll(async () => {
  vi.useFakeTimers()
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('WebSocket', MestreFalso)
  const raiz = document.createElement('div')
  raiz.id = 'root'
  document.body.appendChild(raiz)
  localStorage.setItem('labirinto.ultima-entrada', JSON.stringify({ code: CODE, name: 'Ana' }))
  sessionStorage.setItem('labirinto.resume', JSON.stringify({ code: CODE, token: 'tok' }))
  await act(async () => {
    await import('./boot')
  })
  act(() => mestre().abre())
  act(() => mestre().manda({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Ana' }))
  act(() => {
    mestre().manda({
      type: 'snapshot',
      rev: 1,
      map: { ...createEmptyMap('m1', '', 10, 10, 50), pins: [COFRE, FONTE] },
      vision: [],
      ownTokens: [],
      concealed: [],
    })
  })
}, PRAZO_DA_IMPORTACAO_MS)

afterAll(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  localStorage.clear()
  sessionStorage.clear()
})

describe('main.tsx: dois "Ler agora" seguidos com o cartão aberto', () => {
  it('o 2º mostra o próprio título e texto, e os dois pinos contam como lidos', () => {
    lerAgora('cofre', 'Cofre', 'TXZONA o cofre range.')
    expect(titulo()).toBe('Cofre')
    expect(datilografado()).toBe('TXZONA o cofre range.')
    expect(lidos(), 'nada lido enquanto o 1º está aberto').toEqual([])

    lerAgora('fonte', 'Fonte', 'A fonte borbulha.')
    expect(titulo()).toBe('Fonte')
    expect(datilografado(), 'a datilografia é a do 2º pino, não a do 1º').toBe('A fonte borbulha.')
    expect(lidos(), 'o 1º cartão foi trocado: o jogador o viu, conta como lido').toEqual([{ type: 'cenario.lido', pinId: 'cofre' }])

    fecharARevelacao()
    expect(revelacao()).toBeNull()
    expect(lidos(), 'fechar o 2º avisa o 2º pino').toEqual([
      { type: 'cenario.lido', pinId: 'cofre' },
      { type: 'cenario.lido', pinId: 'fonte' },
    ])
  })

  it('o mesmo pino lido de novo, sem título: o texto novo e o cartão sem o título antigo', () => {
    const antes = lidos().length
    lerAgora('cofre', 'Cofre', 'TXZONA o cofre range.')
    expect(datilografado()).toBe('TXZONA o cofre range.')

    lerAgora('cofre', '', 'O cofre está aberto agora.')
    expect(titulo(), 'título vazio = sem título').toBeNull()
    expect(datilografado()).toBe('O cofre está aberto agora.')

    fecharARevelacao()
    expect(revelacao()).toBeNull()
    expect(lidos().slice(antes), 'a leitura trocada e a fechada, cada uma avisa').toEqual([
      { type: 'cenario.lido', pinId: 'cofre' },
      { type: 'cenario.lido', pinId: 'cofre' },
    ])
  })
})
