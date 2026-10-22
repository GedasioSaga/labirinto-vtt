/**
 * ABRIR E FECHAR A FOLHA 100 VEZES (fatia 19b): cada abertura liga ouvintes
 * (Esc da gaveta, o teclado do celular, o observador da fileira de abas) e
 * cada fechamento tem de desligá-los. Um que sobre por volta vira cem no fim
 * da sessão, e cada um segura a folha inteira na memória. Aqui se conta o que
 * fica ligado; o contexto WebGL e o heap de verdade são do e2e
 * task-jogador-folha-robusta.spec.ts, no Chromium.
 */
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PLAYER_SETTINGS, PlayerPanel } from './PlayerPanel'

type Props = ComponentProps<typeof PlayerPanel>

const BASE: Props = {
  characters: [{ id: 't1', name: 'Fábio' }],
  characterColor: '#79a9cc',
  settings: DEFAULT_PLAYER_SETTINGS,
  onSettingsChange: () => {},
  onFocusToken: () => {},
  signalArmed: false,
  onToggleSignal: () => {},
  measureArmed: false,
  onToggleMeasure: () => {},
  laserArmed: false,
  onToggleLaser: () => {},
  onRenameToken: () => {},
  onChangeTokenPhoto: async () => {},
  onStepAway: () => {},
  onSignOut: () => {},
}

const VEZES = 100

/** Quem está ouvindo agora, por alvo: o que entrou e não saiu. */
function contarOuvintes(alvo: EventTarget): { vivos: () => number; parar: () => void } {
  const vivos = new Set<string>()
  const ids = new WeakMap<object, number>()
  let proximo = 0
  const chave = (tipo: string, ouvinte: unknown): string => {
    if (typeof ouvinte !== 'object' && typeof ouvinte !== 'function') return tipo
    if (ouvinte === null) return tipo
    let id = ids.get(ouvinte)
    if (id === undefined) {
      id = proximo++
      ids.set(ouvinte, id)
    }
    return `${tipo}#${id}`
  }
  // O original de cada alvo (o do jsdom não aceita outro `this`), chamado de volta por ele.
  const adicionar = alvo.addEventListener.bind(alvo)
  const tirar = alvo.removeEventListener.bind(alvo)
  const add = vi.spyOn(alvo, 'addEventListener').mockImplementation((tipo, ouvinte, opcoes) => {
    vivos.add(chave(tipo, ouvinte))
    adicionar(tipo, ouvinte, opcoes)
  })
  const remove = vi.spyOn(alvo, 'removeEventListener').mockImplementation((tipo, ouvinte, opcoes) => {
    vivos.delete(chave(tipo, ouvinte))
    tirar(tipo, ouvinte, opcoes)
  })
  return {
    vivos: () => vivos.size,
    parar: () => {
      add.mockRestore()
      remove.mockRestore()
    },
  }
}

describe('PlayerPanel: abrir e fechar a folha 100 vezes não deixa nada ligado', () => {
  let container: HTMLDivElement
  let root: Root
  let observadoresVivos: number

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    // Celular em pé: a folha é gaveta e começa fechada.
    vi.stubGlobal('matchMedia', (texto: string) => ({
      matches: texto === '(max-width: 699px)',
      media: texto,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    observadoresVivos = 0
    vi.stubGlobal(
      'ResizeObserver',
      class {
        private ligado = false
        observe(): void {
          if (!this.ligado) observadoresVivos++
          this.ligado = true
        }
        unobserve(): void {}
        disconnect(): void {
          if (this.ligado) observadoresVivos--
          this.ligado = false
        }
      },
    )
    vi.stubGlobal('visualViewport', Object.assign(new EventTarget(), { height: 844, offsetTop: 0, scale: 1 }))
    vi.stubGlobal('innerHeight', 844)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => root.render(<PlayerPanel {...BASE} />))
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  function painel(): HTMLButtonElement {
    const botao = container.querySelector<HTMLButtonElement>('.pp-toggle')
    if (botao === null) throw new Error('sem o botão Painel')
    return botao
  }

  /** O toque do dedo (`detail` 1): o caminho que anima a folha. */
  function tocar(botao: HTMLButtonElement): void {
    act(() => {
      botao.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }))
    })
  }

  it('janela, vista visível e observadores voltam ao que eram antes da primeira abertura', () => {
    const janela = contarOuvintes(window)
    const vista = window.visualViewport
    if (vista === null) throw new Error('sem a vista visível de teste')
    const daVista = contarOuvintes(vista)
    const antes = { janela: janela.vivos(), vista: daVista.vivos(), observadores: observadoresVivos }

    // A primeira volta mostra que abrir liga de verdade: a contagem não é zero por acaso.
    tocar(painel())
    expect(container.querySelector('aside')?.hidden).toBe(false)
    expect(janela.vivos()).toBeGreaterThan(antes.janela)
    expect(daVista.vivos()).toBeGreaterThan(antes.vista)
    tocar(painel())

    for (let vez = 1; vez < VEZES; vez++) {
      tocar(painel())
      tocar(painel())
    }

    expect(container.querySelector('aside')?.hidden).toBe(true)
    expect({ janela: janela.vivos(), vista: daVista.vivos(), observadores: observadoresVivos }).toEqual(antes)
    janela.parar()
    daVista.parar()
  })

  it('a folha aberta na centésima vez é a mesma da primeira: nada remontou, o nome digitado continua', () => {
    tocar(painel())
    const folha = container.querySelector('aside')
    const campo = container.querySelector<HTMLInputElement>('.pp-input')
    expect(campo).not.toBeNull()
    tocar(painel())
    for (let vez = 1; vez < VEZES; vez++) {
      tocar(painel())
      tocar(painel())
    }
    tocar(painel())
    expect(container.querySelector('aside')).toBe(folha)
    expect(container.querySelector('.pp-input')).toBe(campo)
    expect(container.querySelectorAll('aside')).toHaveLength(1)
  })
})
