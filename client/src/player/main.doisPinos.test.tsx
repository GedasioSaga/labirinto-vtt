/**
 * DOIS PINOS NO MESMO PONTO montado na página do jogador (`main.tsx`), sem
 * navegador: o que liga o toque que achou dois pinos à folha "Aqui há 2
 * coisas" e a linha escolhida ao cartão daquele pino. `pinChooser.test.ts`
 * prova as funções puras e `PlayerPinChooser.test.tsx` o componente sozinho;
 * este quebra se a costura sair de `main.tsx` — o `onPinsChoose` passado à
 * `PlayerView`, a folha montada a partir do recorte e o `choosePin` que fecha
 * a folha, abre o cartão e manda `clue.read`.
 *
 * Só o que o jsdom não tem é trocado, como em `main.pistas.test.tsx`: a
 * `PlayerView` (Pixi pede WebGL) vira um botão que chama o mesmo
 * `onPinsChoose` com os dois pinos; e o `WebSocket` vira um falso que faz o
 * papel do mestre.
 */
import { act } from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { Pin } from '../types/map'

type PlayerViewProps = Parameters<(typeof import('./PlayerView'))['PlayerView']>[0]

vi.mock('./PlayerView', () => ({
  OWN_TOKEN_CSS: '#4ea1ff',
  PlayerView: ({ onPinsChoose }: PlayerViewProps) => (
    <div data-testid="mapa">
      <button type="button" onClick={() => onPinsChoose?.(['bilhete', 'bau'])}>
        toque nos dois pinos
      </button>
    </div>
  ),
}))

const CODE = 'ABC123'
const BILHETE: Pin = { id: 'bilhete', x: 100, y: 100, kind: 'exclamacao', description: 'Bilhete\nEncontre-me na torre.', image: null }
const BAU: Pin = { id: 'bau', x: 100, y: 100, kind: 'interrogacao', description: 'Baú de ferro, sem cadeado.', image: null }

/** O mestre do outro lado do fio: guarda o que o jogador mandou e entrega o que o teste manda. */
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
/** O recorte que o mestre manda: um mapa com só estes pinos à vista. */
function recorte(pins: Pin[]): void {
  rev += 1
  act(() => {
    mestre().manda({
      type: 'snapshot',
      rev,
      map: { ...createEmptyMap('m1', '', 10, 10, 50), pins },
      vision: [],
      ownTokens: [],
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

/** O texto de cada linha da folha "Aqui há N coisas", na ordem da tela. */
function linhas(): string[] {
  return Array.from(dialogo().querySelectorAll('.pp-pinchooser__label')).map((l) => l.textContent ?? '')
}

function linha(rotulo: string): HTMLButtonElement {
  const achada = Array.from(dialogo().querySelectorAll<HTMLButtonElement>('.pp-pinchooser__option')).find(
    (b) => b.querySelector('.pp-pinchooser__label')?.textContent === rotulo,
  )
  if (!achada) throw new Error(`sem a linha ${rotulo}`)
  return achada
}

function tocarNosDoisPinos(): void {
  act(() => botao('toque nos dois pinos').click())
}

beforeAll(async () => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('WebSocket', MestreFalso)
  const raiz = document.createElement('div')
  raiz.id = 'root'
  document.body.appendChild(raiz)
  // A aba já tinha entrado nesta sala: a página volta direto, sem o formulário.
  localStorage.setItem('labirinto.ultima-entrada', JSON.stringify({ code: CODE, name: 'Gabi' }))
  sessionStorage.setItem('labirinto.resume', JSON.stringify({ code: CODE, token: 'tok' }))
  await act(async () => {
    await import('./main')
  })
  act(() => mestre().abre())
  act(() => mestre().manda({ type: 'welcome', playerId: 'p1', resumeToken: 'tok', name: 'Gabi' }))
  recorte([BILHETE, BAU])
})

afterAll(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
  sessionStorage.clear()
})

describe('main.tsx: dois pinos no mesmo ponto de ponta a ponta', () => {
  it('o toque que achou dois pinos abre "Aqui há 2 coisas", e escolher não é ler', () => {
    expect(dialogos()).toEqual([])
    tocarNosDoisPinos()
    const folha = dialogo()
    expect(folha.getAttribute('aria-label')).toBe('Aqui há 2 coisas')
    expect(linhas()).toEqual(['Bilhete', 'Baú de ferro, sem cadeado.'])
    // Só a folha abriu: nenhum pino foi lido ainda.
    expect(mestre().enviados('clue.read')).toEqual([])
  })

  it('tocar numa linha fecha a folha e abre o cartão daquele pino, que pede ao mestre para guardar a pista', () => {
    act(() => linha('Baú de ferro, sem cadeado.').click())
    const cartao = dialogo()
    expect(cartao.classList.contains('pp-pinchooser')).toBe(false)
    expect(cartao.querySelector('.pp-pincard__text')?.textContent).toBe('Baú de ferro, sem cadeado.')
    expect(mestre().enviados('clue.read')).toEqual([{ type: 'clue.read', pinId: 'bau' }])
    act(() => botao('Fechar', cartao).click())
    expect(dialogos()).toEqual([])
  })

  it('"Fechar" na folha só fecha: nenhum cartão abre e nada vai ao mestre', () => {
    tocarNosDoisPinos()
    expect(dialogo().getAttribute('aria-label')).toBe('Aqui há 2 coisas')
    act(() => botao('Fechar', dialogo()).click())
    expect(dialogos()).toEqual([])
    expect(mestre().enviados('clue.read')).toEqual([{ type: 'clue.read', pinId: 'bau' }])
  })

  it('os pinos saem do recorte com a folha aberta: a linha some, e sem nenhum a folha fecha sozinha e não volta', () => {
    tocarNosDoisPinos()
    expect(linhas()).toEqual(['Bilhete', 'Baú de ferro, sem cadeado.'])

    // O mestre escondeu o baú: a folha fica, só com o que ainda está à vista.
    recorte([BILHETE])
    expect(dialogo().getAttribute('aria-label')).toBe('Aqui há 1 coisa')
    expect(linhas()).toEqual(['Bilhete'])

    // O bilhete também saiu: nada mais para escolher.
    recorte([])
    expect(dialogos()).toEqual([])

    // Os dois voltam ao recorte: a escolha acabou, não reabre sem um toque novo.
    recorte([BILHETE, BAU])
    expect(dialogos()).toEqual([])
    expect(mestre().enviados('clue.read')).toEqual([{ type: 'clue.read', pinId: 'bau' }])
  })
})
