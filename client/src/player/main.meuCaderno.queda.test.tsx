/**
 * LEVAR O CADERNO PARA CASA quando o mestre FECHA O APP em vez de encerrar a
 * sala: o socket cai sem `room.closed` e a página vai para "A conexão com o
 * mestre caiu." É o fim de sessão mais comum, e o "Guardar meu caderno" tem de
 * estar lá também — inclusive depois de um "Reconectar" que não achou a sala,
 * quando a conexão já zerou as pistas e os recados da tela.
 *
 * Só o que o jsdom não tem é trocado: a `PlayerView` (Pixi pede WebGL), o
 * `WebSocket` (um falso faz o papel do mestre) e o download do navegador.
 */
import { act } from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'

vi.mock('./PlayerView', () => ({
  OWN_TOKEN_CSS: '#4ea1ff',
  PlayerView: () => <div data-testid="mapa" />,
}))

const CODE = 'ABC123'

class MestreFalso {
  static ultimo: MestreFalso | null = null
  readonly url: string
  readyState = 0
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  constructor(url: string) {
    this.url = url
    MestreFalso.ultimo = this
  }
  send(): void {}
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

function botao(nome: string, dentro: ParentNode = document): HTMLButtonElement {
  const achado = Array.from(dentro.querySelectorAll('button')).find((b) => b.textContent === nome)
  if (!achado) throw new Error(`sem o botão ${nome}`)
  return achado
}

/** O que o navegador teria baixado: o conteúdo do blob e o nome do link. */
const baixados: { nome: string; blob: Blob }[] = []
let ultimoBlob: Blob | null = null
const originalCreate: unknown = Reflect.get(URL, 'createObjectURL')
const originalRevoke: unknown = Reflect.get(URL, 'revokeObjectURL')

function ficha(id: string, name: string, x: number) {
  return { id, characterId: null, name, x, y: 100, size: 1, image: null }
}

beforeAll(async () => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('WebSocket', MestreFalso)
  // jsdom não tem `createObjectURL`: a página recebe um falso que guarda o blob (e o afterAll devolve o original).
  Reflect.set(URL, 'createObjectURL', (blob: Blob) => {
    ultimoBlob = blob
    return 'blob:caderno'
  })
  Reflect.set(URL, 'revokeObjectURL', () => {})
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    if (ultimoBlob !== null) baixados.push({ nome: this.download, blob: ultimoBlob })
  })
  const raiz = document.createElement('div')
  raiz.id = 'root'
  document.body.appendChild(raiz)
  localStorage.setItem('labirinto.ultima-entrada', JSON.stringify({ code: CODE, name: 'Gabi' }))
  sessionStorage.setItem('labirinto.resume', JSON.stringify({ code: CODE, token: 'tok' }))
  await act(async () => {
    await import('./main')
  })
  act(() => mestre().abre())
  act(() => {
    mestre().manda({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Gabi' })
    mestre().manda({
      type: 'snapshot',
      rev: 1,
      map: { ...createEmptyMap('cena-cripta', '', 10, 10, 50), tokens: [ficha('heroi', 'Gabi', 100), ficha('npc', 'Capataz traidor', 160)] },
      vision: [
        [
          { x: 0, y: 0 },
          { x: 300, y: 0 },
          { x: 300, y: 300 },
          { x: 0, y: 300 },
        ],
      ],
      ownTokens: ['heroi'],
      concealed: [],
    })
    mestre().manda({ type: 'clue.added', clue: { id: 'c1', title: 'Bilhete', text: 'Encontre-me na torre.', image: null, at: Date.now() } })
    mestre().manda({ type: 'scene.note', id: 'n1', text: 'A guarda troca à meia-noite.' })
  })
})

afterAll(() => {
  Reflect.set(URL, 'createObjectURL', originalCreate)
  Reflect.set(URL, 'revokeObjectURL', originalRevoke)
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
  sessionStorage.clear()
})

/** O mestre fechou o app: o socket cai, sem `room.closed`. */
function mestreFechaOApp(): void {
  act(() => mestre().onclose?.(new CloseEvent('close')))
}

async function ultimoHtml(quantos: number): Promise<string> {
  expect(baixados.length).toBe(quantos)
  return (await baixados[quantos - 1]?.blob.text()) ?? ''
}

describe('main.tsx: o caderno vai para casa mesmo quando o mestre fecha o app', () => {
  it('conexão caída: "Guardar meu caderno" baixa a cena, a pista e o recado', async () => {
    mestreFechaOApp()
    expect(document.body.textContent).toContain('A conexão com o mestre caiu.')
    act(() => botao('Guardar meu caderno').click())

    const html = await ultimoHtml(1)
    expect(html).toContain('Cena 1')
    expect(html).toContain('Bilhete')
    expect(html).toContain('Encontre-me na torre.')
    expect(html).toContain('A guarda troca à meia-noite.')
    expect(html).not.toContain('Capataz')
    expect(document.body.textContent).toContain(`Baixado: ${baixados[0]?.nome}`)
  })

  it('"Reconectar" que não acha a sala: o caderno ainda leva a pista e o recado', async () => {
    const antes = MestreFalso.ultimo
    act(() => botao('Reconectar').click())
    expect(MestreFalso.ultimo).not.toBe(antes)
    // A sala não voltou: o socket novo cai sem nunca abrir.
    mestreFechaOApp()
    expect(document.body.textContent).toContain('A conexão com o mestre caiu.')
    act(() => botao('Guardar meu caderno').click())

    const html = await ultimoHtml(2)
    expect(html).toContain('Cena 1')
    expect(html).toContain('Bilhete')
    expect(html).toContain('A guarda troca à meia-noite.')
  })

  it('"Reconectar" que abre mas ninguém responde: a tela de sala muda também oferece o caderno', async () => {
    vi.useFakeTimers()
    try {
      act(() => botao('Reconectar').click())
      act(() => mestre().abre())
      act(() => {
        vi.advanceTimersByTime(8_000)
      })
      expect(document.body.textContent).toContain(`A sala ${CODE} não respondeu.`)
      act(() => botao('Guardar meu caderno').click())
    } finally {
      vi.useRealTimers()
    }

    const html = await ultimoHtml(3)
    expect(html).toContain('Bilhete')
    expect(html).toContain('A guarda troca à meia-noite.')
  })
})
