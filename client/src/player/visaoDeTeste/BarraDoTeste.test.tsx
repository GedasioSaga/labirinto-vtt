import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BarraDoTesteProps, FichaParaTeste } from '../../net/visaoDeTeste/tipos'
import { AVISO_DO_ESQUECER_MS, BarraDoTeste, LARGURA_LARGA, LARGURA_MEDIA, MOTIVO_JOGAR_INDISPONIVEL, SELO_DO_TESTE, larguraDaBarra } from './BarraDoTeste'

/*
 * VISÃO DE JOGADOR — a barra da janela de teste (maquete 3A, 3D, 3E): de quem
 * é a tela, o selo Teste, Olhar | Jogar no centro e as ações (Trocar ficha,
 * Esquecer tudo, Fechar). Nesta entrega o Jogar vem desligado, com o motivo.
 */

const GROG: FichaParaTeste = { id: 'grog', nome: 'Grog', retrato: null, cor: '#35b24a', dono: 'Ana', npc: false }
const LYRA: FichaParaTeste = { id: 'lyra', nome: 'Lyra Ventoleste', retrato: null, cor: '#5a8fd6', dono: 'Bruno', npc: false }
const CAPITAO: FichaParaTeste = { id: 'cap', nome: 'Capitão Gorzûl, o Que Ri por Último', retrato: null, cor: '#d6452f', dono: null, npc: true }
const FICHAS = [LYRA, GROG, CAPITAO]

describe('larguraDaBarra', () => {
  it('larga com folga para o selo inteiro e o seletor no centro; média com ícones; estreita com o menu "Mais"', () => {
    expect(larguraDaBarra(1100)).toBe('larga')
    expect(larguraDaBarra(LARGURA_LARGA)).toBe('larga')
    expect(larguraDaBarra(LARGURA_LARGA - 1)).toBe('media')
    expect(larguraDaBarra(LARGURA_MEDIA)).toBe('media')
    expect(larguraDaBarra(420)).toBe('estreita')
  })
})

describe('BarraDoTeste', () => {
  let container: HTMLDivElement
  let root: Root
  const larguraOriginal = window.innerWidth

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: larguraOriginal })
    vi.useRealTimers()
  })

  /** jsdom não mede caixa nem tem `ResizeObserver`: a barra cai na largura da janela. */
  function janelaCom(largura: number): void {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: largura })
  }

  function montar(props: Partial<BarraDoTesteProps> = {}) {
    const handlers = { onModo: vi.fn(), onTrocarFicha: vi.fn(), onFechar: vi.fn() }
    act(() =>
      root.render(
        <BarraDoTeste ficha={GROG} modo="olhar" jogarDisponivel={false} fichas={FICHAS} fichaSelecionadaId="lyra" {...handlers} {...props} />,
      ),
    )
    return handlers
  }

  function botao(nome: string): HTMLButtonElement {
    const achado = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
      (el) => el.getAttribute('aria-label') === nome || el.textContent?.trim() === nome,
    )
    if (achado === undefined) throw new Error(`sem o botão "${nome}"`)
    return achado
  }

  function opcao(nome: 'Olhar' | 'Jogar'): HTMLButtonElement {
    const achada = [...container.querySelectorAll<HTMLButtonElement>('[role="radio"]')].find(
      (el) => el.textContent === nome || el.getAttribute('aria-label') === nome,
    )
    if (achada === undefined) throw new Error(`sem a opção ${nome}`)
    return achada
  }

  function clicar(alvo: HTMLElement, detail = 1): void {
    act(() => {
      alvo.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail }))
    })
  }

  function tecla(alvo: Element, key: string): KeyboardEvent {
    const evento = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
    act(() => {
      alvo.dispatchEvent(evento)
    })
    return evento
  }

  function lista(): HTMLElement | null {
    return document.querySelector<HTMLElement>('[role="dialog"][aria-label="Escolher a ficha"]')
  }

  it('diz de quem é a tela e que é teste: retrato, nome, "de Ana" e o selo inteiro', () => {
    janelaCom(1100)
    montar()
    const barra = container.querySelector('header')
    expect(barra?.getAttribute('aria-label')).toBe('Visão de jogador: Grog (teste)')
    expect(barra?.getAttribute('data-largura')).toBe('larga')
    expect(container.querySelector('.vj-barra__nome')?.textContent).toBe('Grog')
    expect(container.querySelector('.vj-barra__dono')?.textContent).toBe('de Ana')
    expect(container.querySelector('.vj-barra__teste')?.textContent).toBe(SELO_DO_TESTE)
    expect(container.querySelector('.vj-retrato')?.textContent).toBe('G')
  })

  it('ficha sem jogador: "sem jogador" com o porquê da névoa do zero', () => {
    janelaCom(1100)
    montar({ ficha: CAPITAO })
    const dono = container.querySelector('.vj-barra__dono--sem')
    expect(dono?.textContent).toBe('sem jogador')
    expect(dono?.getAttribute('title')).toBe('Sem jogador: a névoa começa do zero')
    expect(container.querySelector('.vj-barra__nome')?.getAttribute('title')).toBe(CAPITAO.nome)
  })

  it('Jogar desligado nesta entrega: à vista e apagado, com o motivo ligado a ele, e clicar não troca o modo', () => {
    janelaCom(1100)
    const { onModo } = montar()
    expect(opcao('Olhar').getAttribute('aria-checked')).toBe('true')
    const jogar = opcao('Jogar')
    expect(jogar.getAttribute('aria-checked')).toBe('false')
    expect(jogar.getAttribute('aria-disabled')).toBe('true')
    const motivo = document.getElementById(jogar.getAttribute('aria-describedby') ?? '')
    expect(motivo?.textContent).toBe(MOTIVO_JOGAR_INDISPONIVEL)
    expect(motivo?.getAttribute('role')).toBe('tooltip')
    clicar(jogar)
    // Pelo teclado o foco chega até o Jogar (o balão diz o porquê), mas o modo não troca.
    tecla(opcao('Olhar'), 'ArrowRight')
    expect(document.activeElement).toBe(jogar)
    expect(onModo).not.toHaveBeenCalled()
  })

  it('com o Jogar disponível: o clique troca deslizando; as setas trocam sem animação; uma parada só do Tab', () => {
    janelaCom(1100)
    const { onModo } = montar({ jogarDisponivel: true })
    const seletor = container.querySelector('[role="radiogroup"]')
    expect(opcao('Olhar').tabIndex).toBe(0)
    expect(opcao('Jogar').tabIndex).toBe(-1)
    expect(opcao('Jogar').hasAttribute('aria-disabled')).toBe(false)
    clicar(opcao('Jogar'))
    expect(onModo).toHaveBeenLastCalledWith('jogar')
    expect(seletor?.hasAttribute('data-instante')).toBe(false)
    const evento = tecla(opcao('Olhar'), 'ArrowLeft')
    expect(evento.defaultPrevented).toBe(true)
    expect(onModo).toHaveBeenLastCalledWith('jogar')
    expect(seletor?.getAttribute('data-instante')).toBe('true')
    // Clicar no modo que já está marcado não manda nada.
    onModo.mockClear()
    clicar(opcao('Olhar'))
    expect(onModo).not.toHaveBeenCalled()
  })

  it('"Esquecer tudo" só existe com quem o atenda; com ele, esquece e confirma por alguns segundos', () => {
    janelaCom(1100)
    montar()
    expect(() => botao('Esquecer tudo')).toThrow()
    vi.useFakeTimers()
    const onEsquecerTudo = vi.fn()
    montar({ onEsquecerTudo })
    clicar(botao('Esquecer tudo'))
    expect(onEsquecerTudo).toHaveBeenCalledOnce()
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Névoa esquecida.')
    act(() => {
      vi.advanceTimersByTime(AVISO_DO_ESQUECER_MS)
    })
    expect(container.querySelector('[role="status"]')?.textContent).toBe('')
  })

  it('Fechar fecha a janela de teste', () => {
    janelaCom(1100)
    const { onFechar } = montar()
    clicar(botao('Fechar'))
    expect(onFechar).toHaveBeenCalledOnce()
  })

  it('Trocar ficha abre a mesma lista dentro da janela, com a ficha atual marcada; escolher outra troca', () => {
    janelaCom(1100)
    const { onTrocarFicha } = montar()
    const trocar = botao('Trocar ficha')
    expect(trocar.getAttribute('aria-expanded')).toBe('false')
    clicar(trocar)
    expect(trocar.getAttribute('aria-expanded')).toBe('true')
    expect(trocar.getAttribute('aria-controls')).toBe(lista()?.id)
    const linhas = [...(lista()?.querySelectorAll('[role="option"]') ?? [])]
    // A selecionada no mapa (Lyra) primeiro; a da janela (Grog) com o selo "Na janela".
    expect(linhas.map((linha) => linha.getAttribute('aria-label'))).toEqual([
      'Lyra Ventoleste, de Bruno, selecionada no mapa',
      'Grog, de Ana, já está na janela',
      'Capitão Gorzûl, o Que Ri por Último, sem jogador',
    ])
    tecla(document.activeElement ?? document.body, 'Enter')
    expect(onTrocarFicha).toHaveBeenCalledExactlyOnceWith('lyra')
    expect(lista()).toBeNull()
    expect(document.activeElement).toBe(trocar)
  })

  it('média: os botões viram só ícone, com o nome no balão; o selo encurta e guarda o resto para o leitor de tela', () => {
    janelaCom(760)
    montar()
    expect(container.querySelector('header')?.getAttribute('data-largura')).toBe('media')
    const trocar = botao('Trocar ficha')
    expect(trocar.textContent).toBe('')
    expect(trocar.getAttribute('title')).toBe('Trocar ficha')
    expect(botao('Fechar').getAttribute('title')).toBe('Fechar a janela de teste')
    const selo = container.querySelector('.vj-barra__teste')
    expect(selo?.getAttribute('title')).toBe(SELO_DO_TESTE)
    expect(selo?.textContent).toBe('Teste — nada fica no jogo')
    expect(selo?.querySelector('.vj-barra__sr')?.textContent).toBe(' — nada fica no jogo')
    // O seletor continua escrito, e o dono à vista.
    expect(opcao('Olhar').textContent).toBe('Olhar')
    expect(container.querySelector('.vj-barra__dono')).not.toBeNull()
  })

  it('estreita (420 px): seletor só com ícones, e Trocar ficha e Fechar no menu "Mais"', () => {
    janelaCom(420)
    const { onFechar, onTrocarFicha } = montar()
    expect(container.querySelector('header')?.getAttribute('data-largura')).toBe('estreita')
    expect(opcao('Olhar').getAttribute('aria-label')).toBe('Olhar')
    expect(opcao('Olhar').textContent).toBe('')
    expect(container.querySelector('.vj-barra__dono')).toBeNull()
    expect(() => botao('Trocar ficha')).toThrow()
    const mais = botao('Mais')
    expect(mais.getAttribute('aria-haspopup')).toBe('menu')
    clicar(mais)
    const menu = container.querySelector('[role="menu"]')
    const itens = [...(menu?.querySelectorAll('[role="menuitem"]') ?? [])]
    expect(itens.map((item) => item.textContent)).toEqual(['Trocar ficha', 'Fechar a janela'])
    expect(document.activeElement).toBe(itens[0])
    // ↓ anda, Esc fecha e devolve o foco ao "Mais".
    tecla(itens[0] as Element, 'ArrowDown')
    expect(document.activeElement).toBe(itens[1])
    tecla(itens[1] as Element, 'Escape')
    expect(container.querySelector('[role="menu"]')).toBeNull()
    expect(document.activeElement).toBe(mais)
    // Trocar ficha pelo menu (Enter: clique com detail 0) abre a lista presa ao "Mais", parada.
    clicar(mais, 0)
    clicar(container.querySelector<HTMLElement>('[role="menuitem"]') as HTMLElement, 0)
    expect(container.querySelector('[role="menu"]')).toBeNull()
    expect(lista()?.getAttribute('data-abertura')).toBe('teclado')
    expect(mais.getAttribute('aria-expanded')).toBe('true')
    tecla(document.activeElement ?? document.body, 'ArrowDown')
    tecla(document.activeElement ?? document.body, 'ArrowDown')
    tecla(document.activeElement ?? document.body, 'Enter')
    expect(onTrocarFicha).toHaveBeenCalledExactlyOnceWith('cap')
    expect(document.activeElement).toBe(mais)
    // Fechar a janela pelo menu.
    clicar(mais)
    const fechar = [...container.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((item) => item.textContent === 'Fechar a janela')
    clicar(fechar as HTMLElement)
    expect(onFechar).toHaveBeenCalledOnce()
  })
})
