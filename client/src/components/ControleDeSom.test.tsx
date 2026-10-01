import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CHAVE_DA_PREFERENCIA_DE_SOM, PREFERENCIA_DE_SOM_PADRAO, useSomStore } from '../stores/somStore'
import { ControleDeSom, SOM_DE_AMOSTRA, TITULO_DO_SOM, type ControleDeSomProps } from './ControleDeSom'

/*
 * SOM DA MESA (pedido "sons", fatia 3): o alto-falante abre um popover pequeno
 * com a barra de volume e o mudo de um clique. Vale para o jogador (sobre o
 * mapa) e para o mestre (painel da sala). A preferência é a do `somStore`,
 * guardada no aparelho.
 */

describe('ControleDeSom', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    localStorage.clear()
    useSomStore.setState({ ...PREFERENCIA_DE_SOM_PADRAO })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function montar(props: Partial<ControleDeSomProps> = {}) {
    const tocar = vi.fn()
    const pararDeDestravar = vi.fn()
    const destravar = vi.fn((_alvo: EventTarget) => pararDeDestravar)
    act(() => root.render(<ControleDeSom variante="flutuante" tocar={tocar} destravar={destravar} {...props} />))
    return { tocar, destravar, pararDeDestravar }
  }

  function gatilho(): HTMLButtonElement {
    const achado = container.querySelector<HTMLButtonElement>('button[aria-label="Som"]')
    if (achado === null) throw new Error('sem o botão "Som"')
    return achado
  }

  function dialogo(): HTMLElement | null {
    return container.querySelector<HTMLElement>('[role="dialog"]')
  }

  function barra(): HTMLInputElement {
    const achada = dialogo()?.querySelector<HTMLInputElement>('input[type="range"]')
    if (achada === null || achada === undefined) throw new Error('sem a barra de volume')
    return achada
  }

  function mudo(): HTMLButtonElement {
    const achado = dialogo()?.querySelector<HTMLButtonElement>('button[aria-label="Mudo"]')
    if (achado === null || achado === undefined) throw new Error('sem o botão "Mudo"')
    return achado
  }

  /** Clique de dedo ou mouse: `detail` conta os cliques (1). Enter e Espaço sintetizam clique com `detail` 0. */
  function apertar(alvo: HTMLElement, detail = 1): void {
    act(() => {
      alvo.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail }))
    })
  }

  /** Arrasto da alça: o navegador troca o valor e solta `input` a cada passo. */
  function arrastarAte(valor: number): void {
    const definirValor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      definirValor?.call(barra(), String(valor))
      barra().dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  /** Soltar a alça: o `change` nativo é o fim do gesto. */
  function soltar(): void {
    act(() => {
      barra().dispatchEvent(new Event('change', { bubbles: true }))
    })
  }

  function teclar(alvo: HTMLElement, key: string): void {
    act(() => {
      alvo.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
    })
  }

  function gravado(): unknown {
    const texto = localStorage.getItem(CHAVE_DA_PREFERENCIA_DE_SOM)
    return texto === null ? null : JSON.parse(texto)
  }

  it('fechado: um botão "Som" de alto-falante que avisa que abre um diálogo, e nada mais na tela', () => {
    montar()
    expect(gatilho().getAttribute('aria-expanded')).toBe('false')
    expect(gatilho().getAttribute('aria-haspopup')).toBe('dialog')
    expect(gatilho().dataset.estado).toBe('ligado')
    expect(gatilho().title).toBe('Som: 35%')
    // O desenho do alto-falante é enfeite: quem dá o nome é o aria-label.
    expect(gatilho().querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(dialogo()).toBeNull()
  })

  it('o clique abre o popover "Som da mesa" com o volume guardado e o foco na barra', () => {
    montar()
    apertar(gatilho())
    const aberto = dialogo()
    expect(gatilho().getAttribute('aria-expanded')).toBe('true')
    expect(gatilho().getAttribute('aria-controls')).toBe(aberto?.id)
    const tituloId = aberto?.getAttribute('aria-labelledby') ?? ''
    expect(document.getElementById(tituloId)?.textContent).toBe(TITULO_DO_SOM)
    expect(barra().value).toBe('35')
    expect(barra().min).toBe('0')
    expect(barra().max).toBe('100')
    expect(barra().getAttribute('aria-valuetext')).toBe('35%')
    expect(barra().labels?.[0]?.textContent).toBe('Volume')
    expect(document.activeElement).toBe(barra())
    expect(mudo().getAttribute('aria-pressed')).toBe('false')
    // O mesmo botão fecha.
    apertar(gatilho())
    expect(dialogo()).toBeNull()
    expect(gatilho().getAttribute('aria-expanded')).toBe('false')
  })

  it('mudo num clique: alterna, grava no aparelho e o alto-falante do botão fica cortado', () => {
    const { tocar } = montar()
    apertar(gatilho())
    apertar(mudo())
    expect(useSomStore.getState().mudo).toBe(true)
    expect(gravado()).toEqual({ volume: 0.35, mudo: true })
    expect(mudo().getAttribute('aria-pressed')).toBe('true')
    expect(gatilho().dataset.estado).toBe('mudo')
    expect(gatilho().title).toBe('Som: mudo')
    expect(tocar).not.toHaveBeenCalled()
    // Tirar do mudo toca a amostra no volume escolhido: o ouvido confirma que o som voltou.
    apertar(mudo())
    expect(useSomStore.getState().mudo).toBe(false)
    expect(gatilho().dataset.estado).toBe('ligado')
    expect(tocar).toHaveBeenCalledTimes(1)
    expect(tocar).toHaveBeenCalledWith(SOM_DE_AMOSTRA)
  })

  it('a barra muda o volume durante o arrasto, grava, e só ao soltar toca a amostra', () => {
    const { tocar } = montar()
    apertar(gatilho())
    arrastarAte(20)
    expect(useSomStore.getState().volume).toBe(0.2)
    expect(gravado()).toEqual({ volume: 0.2, mudo: false })
    expect(barra().getAttribute('aria-valuetext')).toBe('20%')
    expect(dialogo()?.textContent).toContain('20%')
    expect(tocar).not.toHaveBeenCalled()
    soltar()
    expect(tocar).toHaveBeenCalledTimes(1)
    expect(tocar).toHaveBeenCalledWith(SOM_DE_AMOSTRA)
  })

  it('mexer na barra com o mudo ligado tira do mudo, como o volume do sistema', () => {
    useSomStore.setState({ volume: 0.35, mudo: true })
    montar()
    apertar(gatilho())
    expect(dialogo()?.textContent).toContain('Mudo')
    arrastarAte(50)
    expect(useSomStore.getState()).toMatchObject({ volume: 0.5, mudo: false })
    expect(mudo().getAttribute('aria-pressed')).toBe('false')
  })

  it('volume zero também mostra o alto-falante cortado', () => {
    montar()
    apertar(gatilho())
    arrastarAte(0)
    expect(gatilho().dataset.estado).toBe('mudo')
    expect(gatilho().title).toBe('Som: 0%')
  })

  it('Esc fecha, devolve o foco ao botão e não chega aos atalhos da página', () => {
    montar()
    const atalhos = vi.fn()
    window.addEventListener('keydown', atalhos)
    try {
      apertar(gatilho())
      teclar(barra(), 'Escape')
      expect(dialogo()).toBeNull()
      expect(document.activeElement).toBe(gatilho())
      expect(atalhos).not.toHaveBeenCalled()
    } finally {
      window.removeEventListener('keydown', atalhos)
    }
  })

  it('as teclas da barra e dos botões ficam no controle; as outras seguem para os atalhos', () => {
    montar()
    const atalhos = vi.fn()
    window.addEventListener('keydown', atalhos)
    try {
      apertar(gatilho())
      // No mestre, a seta também empurraria o objeto selecionado no mapa; o Espaço armaria o arrasto do mapa.
      for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End']) teclar(barra(), key)
      teclar(mudo(), ' ')
      teclar(mudo(), 'Enter')
      teclar(gatilho(), ' ')
      expect(atalhos).not.toHaveBeenCalled()
      teclar(barra(), 'v')
      expect(atalhos).toHaveBeenCalledTimes(1)
    } finally {
      window.removeEventListener('keydown', atalhos)
    }
  })

  it('tocar fora fecha; tocar dentro do popover não', () => {
    montar()
    apertar(gatilho())
    act(() => {
      dialogo()?.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    })
    expect(dialogo()).not.toBeNull()
    act(() => {
      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    })
    expect(dialogo()).toBeNull()
    // Fechar por tocar fora não puxa o foco de volta: ele vai para onde o dedo foi.
    expect(document.activeElement).not.toBe(gatilho())
  })

  it('o foco que sai do controle (Tab) fecha o popover', () => {
    const fora = document.createElement('button')
    document.body.appendChild(fora)
    try {
      montar()
      apertar(gatilho())
      act(() => fora.focus())
      expect(dialogo()).toBeNull()
    } finally {
      fora.remove()
    }
  })

  it('aberto pelo teclado aparece na hora; pelo dedo ou mouse, com a entrada curta', () => {
    montar()
    apertar(gatilho(), 0)
    expect(dialogo()?.dataset.abertura).toBe('teclado')
    apertar(gatilho(), 0)
    apertar(gatilho(), 1)
    expect(dialogo()?.dataset.abertura).toBe('ponteiro')
  })

  it('destrava o áudio nos gestos dentro do próprio controle e solta ao sair da tela', () => {
    const { destravar, pararDeDestravar } = montar()
    expect(destravar).toHaveBeenCalledTimes(1)
    const alvo = destravar.mock.calls[0]?.[0]
    expect(alvo).toBeInstanceOf(HTMLElement)
    expect(alvo instanceof HTMLElement && alvo.contains(gatilho())).toBe(true)
    act(() => root.unmount())
    expect(pararDeDestravar).toHaveBeenCalledTimes(1)
    root = createRoot(container)
  })

  it('com legenda, o texto ao lado nomeia o alto-falante e também abre o popover', () => {
    montar({ variante: 'painel', legenda: TITULO_DO_SOM })
    const legenda = container.querySelector('label')
    const botao = container.querySelector('button')
    expect(legenda?.textContent).toBe(TITULO_DO_SOM)
    expect(legenda?.htmlFor).toBe(botao?.id)
    // O nome vem da legenda à vista; o "Som" escondido ficaria diferente do que se lê.
    expect(botao?.hasAttribute('aria-label')).toBe(false)
    expect(container.firstElementChild?.classList.contains('lb-som--com-legenda')).toBe(true)
    act(() => legenda?.click())
    expect(dialogo()).not.toBeNull()
  })

  it('a variante flutuante é o botão de toque do jogador; a de painel usa o botão compacto do mestre', () => {
    montar({ className: 'pp-som' })
    const raiz = container.firstElementChild
    expect(raiz?.classList.contains('lb-som')).toBe(true)
    expect(raiz?.classList.contains('lb-som--flutuante')).toBe(true)
    expect(raiz?.classList.contains('pp-som')).toBe(true)
    expect(gatilho().classList.contains('lb-btn')).toBe(false)
    montar({ variante: 'painel' })
    expect(container.firstElementChild?.classList.contains('lb-som--painel')).toBe(true)
    expect(gatilho().classList.contains('lb-btn')).toBe(true)
    expect(gatilho().classList.contains('lb-btn--compact')).toBe(true)
  })
})
