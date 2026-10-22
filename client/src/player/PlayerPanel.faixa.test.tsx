/**
 * FATIA 19a do design consolidado: a tela do jogador na gramática do
 * grimório (protótipo em docs/design/consolidado/prototipo, `renderJogador`).
 * O que muda é a pele; o que o jogador faz continua o mesmo. Aqui fica o que
 * o desenho novo acrescenta à árvore: o traço de latão que corre até a aba
 * escolhida, as quatro peças "No mapa" com uma dica só, o "Volto já" em linha
 * com a explicação como descrição, e o "Sair" no pé da aba Jogo, ainda com o
 * segundo toque. A geometria (nada passa da borda, alvo do dedo) é do e2e
 * task-hud-do-jogador-sem-sobreposicao.spec.ts.
 */
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_PLAYER_SETTINGS, PlayerPanel } from './PlayerPanel'

type Props = ComponentProps<typeof PlayerPanel>

const BASE: Props = {
  characters: [{ id: 't1', name: 'Fábio' }],
  characterColor: '#fff',
  settings: DEFAULT_PLAYER_SETTINGS,
  onSettingsChange: () => {},
  onFocusToken: () => {},
  signalArmed: false,
  onToggleSignal: () => {},
  measureArmed: false,
  onToggleMeasure: () => {},
  laserArmed: false,
  onToggleLaser: () => {},
  onToggleDestination: () => {},
  onClearDestination: () => {},
  onToggleNote: () => {},
  onRenameToken: () => {},
  onChangeTokenPhoto: async () => {},
  markForm: { result: undefined, onPlace: () => {}, onClose: () => {} },
  onStepAway: () => {},
  onSignOut: () => {},
}

/** O jsdom não mede nada: cada aba ganha 60 px de largura e mora a 6 + 64 px por posição, como na fileira de verdade. */
const LARGURA_DA_ABA = 60
function posicaoDaAba(el: HTMLElement): number {
  const irmas = Array.from(el.parentElement?.querySelectorAll('[role="tab"]') ?? [])
  return 6 + irmas.indexOf(el) * (LARGURA_DA_ABA + 4)
}

describe('PlayerPanel na gramática do grimório (fatia 19a)', () => {
  let container: HTMLDivElement
  let root: Root
  const originais = {
    offsetWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth'),
    offsetLeft: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetLeft'),
  }

  function montar(props: Partial<Props> = {}) {
    act(() => root.render(<PlayerPanel {...BASE} {...props} />))
  }

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get(this: HTMLElement) {
        return this.getAttribute('role') === 'tab' ? LARGURA_DA_ABA : 0
      },
    })
    Object.defineProperty(HTMLElement.prototype, 'offsetLeft', {
      configurable: true,
      get(this: HTMLElement) {
        return this.getAttribute('role') === 'tab' ? posicaoDaAba(this) : 0
      },
    })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    montar()
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    for (const [nome, descritor] of Object.entries(originais)) {
      if (descritor !== undefined) Object.defineProperty(HTMLElement.prototype, nome, descritor)
    }
  })

  function abaJogo(): HTMLElement {
    const achada = container.querySelector<HTMLElement>('[role="tabpanel"]:not([hidden])')
    if (!achada) throw new Error('sem a aba à vista')
    return achada
  }

  function botaoComTexto(dentro: ParentNode, texto: string): HTMLButtonElement {
    const achado = Array.from(dentro.querySelectorAll('button')).find((b) => b.textContent === texto)
    if (!achado) throw new Error(`sem o botão ${texto}`)
    return achado
  }

  it('o traço de latão mora na fileira de abas, fora da árvore de leitura, e corre até a aba escolhida', () => {
    const fileira = container.querySelector<HTMLElement>('[role="tablist"]')
    const traco = fileira?.querySelector<HTMLElement>('.pp-tabs__ind')
    expect(traco).not.toBeNull()
    expect(traco?.getAttribute('aria-hidden')).toBe('true')
    // Começa na aba Jogo, a primeira: a 6 px, com a largura dela.
    expect(traco?.style.transform).toBe('translateX(6px) scaleX(0.6)')

    const caderno = Array.from(fileira?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? []).find((b) => b.textContent === 'Caderno')
    act(() => caderno?.click())
    expect(traco?.style.transform).toBe(`translateX(${6 + LARGURA_DA_ABA + 4}px) scaleX(0.6)`)
    // As abas continuam só as abas: o traço não entra na contagem nem no nome delas.
    expect(Array.from(fileira?.querySelectorAll('[role="tab"]') ?? []).map((b) => b.textContent)).toEqual(['Jogo', 'Caderno', 'Lugares'])
  })

  it('pelo teclado nada corre: o traço salta para a aba e a folha aparece sem descer; com o dedo, corre e desce', () => {
    const fileira = container.querySelector<HTMLElement>('[role="tablist"]')
    const traco = fileira?.querySelector<HTMLElement>('.pp-tabs__ind')
    if (!fileira || !traco) throw new Error('sem a fileira de abas')
    const abas = () => Array.from(fileira.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
    // A troca é síncrona (desliga, posiciona, religa): só o histórico do `style` mostra o salto.
    const vigia = new MutationObserver(() => {})
    vigia.observe(traco, { attributes: true, attributeFilter: ['style'], attributeOldValue: true })
    const saltou = () => vigia.takeRecords().some((r) => r.oldValue?.includes('transition: none') ?? false)

    act(() => abas()[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
    expect(traco.style.transform).toBe(`translateX(${6 + LARGURA_DA_ABA + 4}px) scaleX(0.6)`)
    expect(saltou()).toBe(true)

    act(() => abas()[2]?.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })))
    expect(traco.style.transform).toBe(`translateX(${6 + 2 * (LARGURA_DA_ABA + 4)}px) scaleX(0.6)`)
    expect(saltou()).toBe(false)

    act(() => abas()[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 })))
    expect(traco.style.transform).toBe('translateX(6px) scaleX(0.6)')
    expect(saltou()).toBe(true)
    vigia.disconnect()

    const painel = container.querySelector<HTMLButtonElement>('.pp-toggle')
    const folha = container.querySelector<HTMLElement>('.pp-panel')
    act(() => painel?.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 })))
    expect(folha?.classList.contains('pp-panel--teclado')).toBe(true)
    act(() => painel?.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })))
    expect(folha?.classList.contains('pp-panel--teclado')).toBe(false)
  })

  it('No mapa: Sinalizar, Marcações, Medir e Laser num grupo, na ordem de sempre, com uma dica só', () => {
    const grupo = abaJogo().querySelector<HTMLElement>('[role="group"].pp-pecas')
    if (!grupo) throw new Error('sem o grupo das peças')
    const rotulo = document.getElementById(grupo.getAttribute('aria-labelledby') ?? '')
    expect(rotulo?.textContent).toBe('No mapa')
    const nomes = Array.from(grupo.querySelectorAll('button:not([role="menuitem"])')).map((b) => b.textContent?.trim())
    expect(nomes).toEqual(['Sinalizar', 'Marcações', 'Medir', 'Laser'])

    const dicas = () => Array.from(abaJogo().querySelectorAll<HTMLElement>('.pp-dica-acao'))
    expect(dicas()).toHaveLength(1)
    expect(dicas()[0]?.getAttribute('aria-live')).toBe('polite')
    expect(dicas()[0]?.textContent).toBe('Escolha uma ação e toque no mapa.')

    montar({ measureArmed: true })
    expect(dicas()).toHaveLength(1)
    expect(dicas()[0]?.textContent).toBe('Arraste no mapa para medir. Esc sai.')

    montar({ laserArmed: true })
    expect(dicas()[0]?.textContent).toBe('Segure e arraste no mapa para apontar. Quem está na sua cena vê. Esc sai.')

    montar({ signalArmed: true })
    expect(botaoComTexto(grupo, 'Toque no mapa…').getAttribute('aria-pressed')).toBe('true')
    expect(dicas()[0]?.textContent).toBe('Toque no mapa para sinalizar. No PC: Alt+clique ou segure o clique parado.')
  })

  it('"Volto já" é uma linha: o nome continua "Volto já", e a explicação é a descrição dele', () => {
    const volto = botaoComTexto(abaJogo(), 'Volto já')
    const descricao = document.getElementById(volto.getAttribute('aria-describedby') ?? '')
    expect(descricao?.textContent).toBe('Sua ficha fica parada e o mestre sabe que você saiu por um instante.')
    expect(volto.closest('.pp-linha-acao')).not.toBeNull()
  })

  it('"Sair" mora no pé da aba Jogo e continua pedindo o segundo toque; Esc desiste', () => {
    const botoes = () => Array.from(abaJogo().querySelectorAll('button'))
    expect(botoes().at(-1)?.textContent).toBe('Sair')

    act(() => botoes().at(-1)?.click())
    const pergunta = abaJogo().querySelector<HTMLElement>('[role="group"][aria-label="Sair da sala e deste aparelho"]')
    if (!pergunta) throw new Error('sem a pergunta do segundo toque')
    expect(document.activeElement).toBe(botaoComTexto(pergunta, 'Sair'))
    expect(botaoComTexto(pergunta, 'Ficar')).toBeTruthy()

    act(() => pergunta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(abaJogo().querySelector('[aria-label="Sair da sala e deste aparelho"]')).toBeNull()
    expect(botoes().at(-1)?.textContent).toBe('Sair')
  })
})
