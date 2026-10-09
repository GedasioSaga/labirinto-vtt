/**
 * ITEM NO MAPA montado na página do jogador (`main.tsx`), sem navegador: o
 * toque na imagem de item no chão (ou no pino de item) abre o CARTÃO DO ITEM,
 * "Pegar" manda o `pin.take` com o id do item, longe o botão apaga, e o item
 * que sai do recorte fecha o cartão sem reabrir quando volta. O pino "!" de
 * antes continua no cartão do pino.
 *
 * Como em `main.doisPinos.test.tsx`: a `PlayerView` (Pixi pede WebGL) vira
 * botões que chamam os mesmos `onItemNoChaoOpen`/`onPinOpen`, e o `WebSocket`
 * vira um falso que faz o papel do mestre.
 */
import { act } from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { objetoDeItem, pinoDeItem } from '../lib/itemNoMapa'
import { createEmptyMap } from '../lib/mapFactory'
import type { Pin, Prop, Token } from '../types/map'

type PlayerViewProps = Parameters<(typeof import('./PlayerView'))['PlayerView']>[0]

vi.mock('./PlayerView', () => ({
  OWN_TOKEN_CSS: '#4ea1ff',
  PlayerView: ({ onItemNoChaoOpen, onPinOpen }: PlayerViewProps) => (
    <div data-testid="mapa">
      <button type="button" onClick={() => onItemNoChaoOpen?.('chao-pocao')}>
        toque na poção
      </button>
      <button type="button" onClick={() => onPinOpen?.('pino-corda')}>
        toque na corda
      </button>
      <button type="button" onClick={() => onPinOpen?.('pino-chave')}>
        toque na chave
      </button>
    </div>
  ),
}))

const CODE = 'ABC123'
const ID_POCAO = `${'3'.repeat(64)}.webp`
const POCAO: Prop = objetoDeItem('chao-pocao', { x: 160, y: 100 }, 50, { nome: 'Poção', imagem: `midia:${ID_POCAO}`, descricao: 'Cura 50 HP.', quantidade: 2, livre: true })
const CORDA: Pin = pinoDeItem('pino-corda', { x: 100, y: 160 }, { nome: 'Corda', descricao: '10 m de corda.' })
const CHAVE: Pin = { id: 'pino-chave', x: 120, y: 120, kind: 'exclamacao', description: 'Uma chave velha.', image: null, item: { nome: 'Chave' } }
const ANA: Token = { id: 'ana', characterId: null, name: 'Ana', x: 100, y: 100, size: 1, image: null }

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

let rev = 0
function recorte(props: Prop[], pins: Pin[], ana: Token = ANA): void {
  rev += 1
  act(() => {
    mestre().manda({
      type: 'snapshot',
      rev,
      map: { ...createEmptyMap('m1', '', 20, 20, 50), props, pins, tokens: [ana] },
      vision: [],
      ownTokens: [ana.id],
      concealed: [],
    })
  })
}

function botao(nome: string, dentro: ParentNode = document): HTMLButtonElement {
  const achado = Array.from(dentro.querySelectorAll('button')).find((b) => b.textContent?.trim() === nome)
  if (!achado) throw new Error(`sem o botão ${nome}`)
  return achado
}

function dialogos(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]'))
}

function dialogo(): HTMLElement {
  const abertos = dialogos()
  if (abertos.length !== 1) throw new Error(`esperava um cartão aberto, há ${abertos.length}`)
  return abertos[0]
}

beforeAll(async () => {
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
  recorte([POCAO], [CORDA, CHAVE])
})

afterAll(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
  sessionStorage.clear()
})

describe('main.tsx: item no mapa de ponta a ponta', () => {
  it('o toque na poção do chão abre o cartão do item; "Pegar" manda o pin.take com o id dela e fecha', () => {
    act(() => botao('toque na poção').click())
    const cartao = dialogo()
    expect(cartao.getAttribute('aria-label')).toBe('Poção')
    expect(cartao.querySelector('img')?.getAttribute('src')).toBe(`/media/${ID_POCAO}`)
    expect(cartao.textContent).toContain('Quantidade: 2')
    act(() => botao('Pegar', cartao).click())
    expect(mestre().enviados('pin.take')).toEqual([{ type: 'pin.take', pinId: 'chao-pocao' }])
    expect(dialogos()).toEqual([])
  })

  it('o pino de item abre o cartão do item ("Pede ao mestre"); o pino "!" de antes, o cartão do pino', () => {
    act(() => botao('toque na corda').click())
    expect(dialogo().getAttribute('aria-label')).toBe('Corda')
    expect(botao('Pedir para pegar', dialogo())).toBeDefined()
    act(() => botao('Fechar', dialogo()).click())
    act(() => botao('toque na chave').click())
    expect(dialogo().querySelector('.pp-pincard__text')?.textContent).toBe('Uma chave velha.')
    expect(botao('Pegar', dialogo())).toBeDefined()
    act(() => botao('Fechar', dialogo()).click())
    expect(dialogos()).toEqual([])
  })

  it('longe: o botão apaga e diz por quê; chegando perto, acende sozinho', () => {
    recorte([POCAO], [CORDA, CHAVE], { ...ANA, x: 800, y: 800 })
    act(() => botao('toque na poção').click())
    expect(botao('Pegar', dialogo()).disabled).toBe(true)
    expect(dialogo().textContent).toContain('Chegue mais perto para pegar.')
    recorte([POCAO], [CORDA, CHAVE])
    expect(botao('Pegar', dialogo()).disabled).toBe(false)
  })

  it('a poção sai do recorte com o cartão aberto: ele fecha, e não reabre quando ela volta', () => {
    expect(dialogo().getAttribute('aria-label')).toBe('Poção')
    recorte([], [CORDA, CHAVE])
    expect(dialogos()).toEqual([])
    recorte([POCAO], [CORDA, CHAVE])
    expect(dialogos()).toEqual([])
  })
})
