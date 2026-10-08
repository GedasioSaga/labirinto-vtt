/**
 * FICHA DE PERSONAGEM montada na página do jogador (`main.tsx`), de ponta a
 * ponta sem navegador: o botão "Ficha" só aparece quando o mestre serve
 * ficha, abre a ficha em tela cheia, "Criar minha ficha" sai pelo socket, a
 * ficha nova chega e abre em edição, e o "Salvar" sai como `personagem.editar`
 * e fecha a edição quando o mestre confirma.
 *
 * Mesmo molde de `main.inventario.test.tsx`: a `PlayerView` (Pixi pede WebGL)
 * vira um marcador, e o `WebSocket` vira um falso no papel do mestre.
 */
import { act, createElement } from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { novoPersonagem } from '../lib/personagem'
import { SISTEMA_ONE_PIECE } from '../lib/sistemaOnePiece'

vi.mock('./PlayerView', () => ({
  OWN_TOKEN_CSS: '#4ea1ff',
  PlayerView: () => createElement('div', { 'data-testid': 'mapa' }),
}))

const CODE = 'ABC123'

interface Enviada {
  type: string
  reqId?: string
  [chave: string]: unknown
}

class MestreFalso {
  static ultimo: MestreFalso | null = null
  readonly url: string
  readyState = 0
  sent: Enviada[] = []
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
    act(() => this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(message) })))
  }
  enviadas(tipo: string): Enviada[] {
    return this.sent.filter((m) => m.type === tipo)
  }
}

function mestre(): MestreFalso {
  const atual = MestreFalso.ultimo
  if (atual === null) throw new Error('a página não abriu o socket')
  return atual
}

const botaoDaFicha = () => document.querySelector<HTMLButtonElement>('.pp-bar button[aria-label="Ficha de personagem"]')
const ficha = () => document.querySelector<HTMLElement>('.pp-ficha')

function botao(texto: string): HTMLButtonElement {
  const achado = Array.from(document.querySelectorAll<HTMLButtonElement>('.pp-ficha button')).find((b) => b.textContent?.trim() === texto)
  if (achado === undefined) throw new Error(`a ficha não tem o botão "${texto}"`)
  return achado
}

function digitar(input: HTMLInputElement, valor: string): void {
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
  localStorage.setItem('labirinto.ultima-entrada', JSON.stringify({ code: CODE, name: 'Nami' }))
  sessionStorage.setItem('labirinto.resume', JSON.stringify({ code: CODE, token: 'tok' }))
  await act(async () => {
    await import('./boot')
  })
  act(() => mestre().abre())
  mestre().manda({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Nami' })
  mestre().manda({
    type: 'snapshot',
    rev: 1,
    map: { ...createEmptyMap('m1', '', 12, 6, 50), tokens: [{ id: 'nami', characterId: null, name: 'Nami', x: 100, y: 100, size: 1, image: null }] },
    vision: [],
    ownTokens: ['nami'],
    concealed: [],
  })
})

afterAll(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
  sessionStorage.clear()
})

describe('main.tsx: a ficha de personagem de ponta a ponta', () => {
  it('sem o mestre servir ficha (mapa solto), a barra não tem "Ficha"', () => {
    expect(document.querySelector('.pp-bar')).not.toBeNull()
    expect(botaoDaFicha()).toBeNull()
  })

  it('numa aventura, "Ficha" aparece e abre a ficha em tela cheia, com "Criar minha ficha"', () => {
    mestre().manda({ type: 'rpg.sistema', sistema: SISTEMA_ONE_PIECE })
    mestre().manda({ type: 'personagens', personagens: [], tokens: [{ tokenId: 'nami', nome: 'Nami', personagemId: null }] })
    const abrir = botaoDaFicha()
    expect(abrir).not.toBeNull()
    act(() => abrir?.focus())
    act(() => abrir?.click())
    expect(ficha()?.getAttribute('role')).toBe('dialog')
    expect(ficha()?.textContent).toContain('Você ainda não tem ficha de personagem')
  })

  it('"Criar minha ficha" sai pelo socket; a ficha nova chega e abre em edição', () => {
    act(() => botao('Criar minha ficha').click())
    const [pedido] = mestre().enviadas('personagem.criar')
    expect(pedido).toMatchObject({ type: 'personagem.criar', tokenId: 'nami' })
    const nova = { ...novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Nami'), id: 'pers_nami' }
    mestre().manda({ type: 'personagens', personagens: [nova], tokens: [{ tokenId: 'nami', nome: 'Nami', personagemId: nova.id }] })
    mestre().manda({ type: 'personagem.resultado', reqId: pedido?.reqId, ok: true, personagemId: nova.id })
    expect(botao('Salvar')).toBeDefined()
  })

  it('"Salvar" manda só o que mudou e, confirmado, sai da edição', () => {
    const nome = Array.from(document.querySelectorAll('.pp-ficha label')).find((l) => l.textContent?.startsWith('Nome'))?.querySelector('input')
    if (nome === null || nome === undefined) throw new Error('sem o campo Nome')
    digitar(nome, 'Nami, a Gata Ladra')
    act(() => botao('Salvar').click())
    const [salvar] = mestre().enviadas('personagem.editar')
    expect(salvar).toMatchObject({ personagemId: 'pers_nami', partes: { nome: 'Nami, a Gata Ladra' } })
    const salva = { ...novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Nami, a Gata Ladra'), id: 'pers_nami' }
    mestre().manda({ type: 'personagens', personagens: [salva], tokens: [{ tokenId: 'nami', nome: 'Nami', personagemId: salva.id }] })
    mestre().manda({ type: 'personagem.resultado', reqId: salvar?.reqId, ok: true })
    expect(botao('Editar')).toBeDefined()
    expect(ficha()?.querySelector('h2')?.textContent).toBe('Nami, a Gata Ladra')
  })

  it('o X fecha a ficha e o foco volta ao botão da barra', () => {
    const fechar = document.querySelector<HTMLButtonElement>('.pp-ficha button[aria-label="Fechar a ficha"]')
    act(() => fechar?.click())
    expect(ficha()).toBeNull()
    expect(document.activeElement).toBe(botaoDaFicha())
  })
})
