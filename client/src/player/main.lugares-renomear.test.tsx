/**
 * LUGARES montado na página do jogador (`main.tsx`), com o `localStorage`
 * cheio (o `setItem` do nome lança) e depois bloqueado (o `getItem` também
 * lança). Renomear "Lugar 1" para "Mercado" tem de valer nesta aba mesmo
 * assim: a miniatura, a vista grande e o campo ao voltar à aba mostram
 * "Mercado". A gravação é só persistência — antes, `main.tsx` relia o nome do
 * armazenamento e, sem gravação, o nome sumia.
 *
 * Só o que o jsdom não tem é trocado: a `PlayerView` (Pixi pede WebGL) e o
 * `WebSocket` (um falso que faz o papel do mestre).
 */
import { act } from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { createExploration, encodeExploration, markRings, type ExploredWire } from '../lib/exploration'
import { PLACE_NAMES_KEY } from './playerPlaces'

vi.mock('./PlayerView', () => ({
  OWN_TOKEN_CSS: '#4ea1ff',
  PlayerView: () => <div data-testid="mapa" />,
}))

const CODE = 'ABC123'

class MestreFalso {
  static ultimo: MestreFalso | null = null
  readyState = 0
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  constructor() {
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

function explorado(): ExploredWire {
  const exp = createExploration({ width: 500, height: 500, grid: 50 })
  markRings(exp, [
    [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 200 },
      { x: 0, y: 200 },
    ],
  ])
  return encodeExploration(exp)
}

function botao(nome: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim() === nome)
}

function aba(nome: string): void {
  const alvo = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find((b) => b.textContent === nome)
  if (!alvo) throw new Error(`sem a aba ${nome}`)
  act(() => alvo.click())
}

function campoDoLugar(): HTMLInputElement {
  const campo = document.querySelector<HTMLInputElement>('.pp-place input')
  if (!campo) throw new Error('sem o campo do lugar')
  return campo
}

function renomear(nome: string): void {
  const campo = campoDoLugar()
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => campo.focus())
  act(() => {
    setter?.call(campo, nome)
    campo.dispatchEvent(new Event('input', { bubbles: true }))
  })
  act(() => campo.blur())
}

/** Quantas vezes a página tentou gravar o nome (e o armazenamento recusou). */
let gravacoesRecusadas = 0
let leituraBloqueada = false

beforeAll(async () => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('WebSocket', MestreFalso)
  const setItemReal = Storage.prototype.setItem
  const getItemReal = Storage.prototype.getItem
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
    if (key === PLACE_NAMES_KEY) {
      gravacoesRecusadas += 1
      throw new DOMException('cota estourada', 'QuotaExceededError')
    }
    setItemReal.call(this, key, value)
  })
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
    if (key === PLACE_NAMES_KEY && leituraBloqueada) throw new DOMException('bloqueado', 'SecurityError')
    return getItemReal.call(this, key)
  })
  const raiz = document.createElement('div')
  raiz.id = 'root'
  document.body.appendChild(raiz)
  localStorage.setItem('labirinto.ultima-entrada', JSON.stringify({ code: CODE, name: 'Eva' }))
  sessionStorage.setItem('labirinto.resume', JSON.stringify({ code: CODE, token: 'tok' }))
  await act(async () => {
    await import('./main')
  })
  act(() => mestre().abre())
  act(() => {
    mestre().manda({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Eva' })
    mestre().manda({
      type: 'snapshot',
      rev: 1,
      map: createEmptyMap('m-mercado', '', 10, 10, 50),
      vision: [],
      explored: explorado(),
      ownTokens: [],
      concealed: [],
      place: 'l1',
      places: ['l1'],
    })
  })
})

afterAll(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
  sessionStorage.clear()
})

describe('main.tsx: renomear lugar sem armazenamento vale nesta aba', () => {
  it('armazenamento cheio: "Mercado" chega à miniatura, à vista grande e ao campo depois de trocar de aba', () => {
    aba('Lugares')
    expect(campoDoLugar().value).toBe('Lugar 1')
    expect(botao('Abrir Lugar 1 em tamanho grande')).toBeDefined()

    renomear('  Mercado  ')
    // A página tentou gravar e o armazenamento recusou: o nome vem do estado, não da releitura.
    expect(gravacoesRecusadas).toBe(1)
    expect(botao('Abrir Lugar 1 em tamanho grande')).toBeUndefined()
    const abrir = botao('Abrir Mercado em tamanho grande')
    if (!abrir) throw new Error('a miniatura não levou o nome novo')
    expect(abrir.querySelector('svg')?.getAttribute('aria-label')).toBe('Mapa de Mercado, só o que você explorou')

    act(() => abrir.click())
    const dialogo = document.querySelector<HTMLElement>('[role="dialog"]')
    expect(dialogo?.textContent).toContain('Mercado')
    const fechar = botao('Fechar')
    if (!fechar) throw new Error('sem o Fechar da vista grande')
    act(() => fechar.click())

    // Trocar de aba desmonta a lista; ao voltar, o nome continua (o rascunho do campo não sobrevive a isso).
    aba('Jogo')
    expect(document.querySelector('.pp-place input')).toBeNull()
    aba('Lugares')
    expect(campoDoLugar().value).toBe('Mercado')
    expect(botao('Abrir Mercado em tamanho grande')).toBeDefined()
  })

  it('armazenamento bloqueado (a leitura também lança): renomear de novo e apagar o nome seguem valendo', () => {
    leituraBloqueada = true
    renomear('Porto')
    expect(gravacoesRecusadas).toBe(2)
    expect(campoDoLugar().value).toBe('Porto')
    expect(botao('Abrir Porto em tamanho grande')).toBeDefined()

    // Vazio volta ao número, também sem armazenamento.
    renomear('   ')
    expect(campoDoLugar().value).toBe('Lugar 1')
    expect(botao('Abrir Lugar 1 em tamanho grande')).toBeDefined()
    expect(botao('Abrir Porto em tamanho grande')).toBeUndefined()
  })
})
