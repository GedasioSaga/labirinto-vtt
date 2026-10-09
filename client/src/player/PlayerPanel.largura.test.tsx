import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { BAR_WIDTH_VAR, DEFAULT_PLAYER_SETTINGS, PlayerPanel, type PlayerCharacter } from './PlayerPanel'

/*
 * A barra de cima (Painel, Minha ficha, Inventário) é o cabeçalho da gaveta,
 * mas é `fixed`, fora dela: em 390 ela passava da borda direita da gaveta. O
 * painel publica a largura da barra em `--pp-bar-w`, e o player.css não deixa
 * a gaveta mais estreita que isso (a folha é conferida em hudSemColisao.test.tsx).
 *
 * O jsdom não tem layout nem ResizeObserver: a largura da barra e o observador
 * são de mentira. O que se prova é que a largura chega à gaveta, acompanha a
 * barra quando ela muda e sai junto com o painel.
 */

const FABIO: PlayerCharacter = { id: 'tok-fabio', name: 'Capa azul' }

/** A barra com Painel, Minha ficha e Inventário, do tamanho relatado em 390 px. */
const BARRA_CHEIA = 355
/** A barra depois de mudar (o ponto de recado que sai, por exemplo). */
const BARRA_MENOR = 311

interface Observacao {
  avisar: () => void
  observados: Element[]
  disconnect: Mock<() => void>
}

describe('PlayerPanel: a gaveta sabe a largura da barra de cima', () => {
  let container: HTMLDivElement
  let root: Root
  let larguraDaBarra: number
  let observacoes: Observacao[]

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    larguraDaBarra = BARRA_CHEIA
    observacoes = []
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('pp-bar') ? larguraDaBarra : 0
    })
    vi.stubGlobal(
      'ResizeObserver',
      class {
        private readonly registro: Observacao
        constructor(avisar: () => void) {
          this.registro = { avisar, observados: [], disconnect: vi.fn<() => void>() }
          observacoes.push(this.registro)
        }
        observe(alvo: Element) {
          this.registro.observados.push(alvo)
        }
        unobserve() {}
        disconnect() {
          this.registro.disconnect()
        }
      },
    )
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  function render(): void {
    act(() =>
      root.render(
        <PlayerPanel
          characters={[FABIO]}
          characterColor="#3b82f6"
          settings={DEFAULT_PLAYER_SETTINGS}
          onSettingsChange={() => {}}
          onFocusToken={() => {}}
          signalArmed={false}
          onToggleSignal={() => {}}
          measureArmed={false}
          onToggleMeasure={() => {}}
          laserArmed={false}
          onToggleLaser={() => {}}
          onRenameToken={() => {}}
          onChangeTokenPhoto={async () => {}}
        />,
      ),
    )
  }

  function painel(): HTMLElement {
    const aside = container.querySelector<HTMLElement>('aside[aria-label="Painel do jogador"]')
    if (!aside) throw new Error('sem o painel do jogador')
    return aside
  }

  /** O observador que acompanha a barra de cima (outros podem existir na tela). */
  function daBarra(): Observacao {
    const achado = observacoes.find((observacao) => observacao.observados.some((alvo) => alvo.classList.contains('pp-bar')))
    if (!achado) throw new Error('ninguém observa a barra de cima')
    return achado
  }

  it('a largura da barra chega à gaveta na variável que o player.css lê', () => {
    expect(BAR_WIDTH_VAR).toBe('--pp-bar-w')
    render()
    expect(painel().style.getPropertyValue(BAR_WIDTH_VAR)).toBe(`${BARRA_CHEIA}px`)
  })

  it('a barra muda (ponto de recado, fonte que chega, "Minha ficha" que aparece) e a gaveta acompanha', () => {
    render()
    larguraDaBarra = BARRA_MENOR
    act(() => daBarra().avisar())
    expect(painel().style.getPropertyValue(BAR_WIDTH_VAR)).toBe(`${BARRA_MENOR}px`)
  })

  it('o painel sai de cena: o observador para e a variável some com ele', () => {
    render()
    const aside = painel()
    const observacao = daBarra()
    act(() => root.render(null))
    expect(observacao.disconnect).toHaveBeenCalled()
    expect(aside.style.getPropertyValue(BAR_WIDTH_VAR)).toBe('')
  })

  it('sem ResizeObserver (navegador velho) a largura entra uma vez e a tela não quebra', () => {
    vi.stubGlobal('ResizeObserver', undefined)
    render()
    expect(painel().style.getPropertyValue(BAR_WIDTH_VAR)).toBe(`${BARRA_CHEIA}px`)
  })
})
