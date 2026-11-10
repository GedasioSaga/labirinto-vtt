import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SceneDeletionInfo, SceneListItem } from '../stores/adventureStore'
import { SAIDA_DO_POP_MS } from './grimorio/comum'
import { ScenesSection, placeSceneMenu, type ScenesSectionProps } from './ScenesSection'

const CENAS: SceneListItem[] = [
  { id: 's-cais', name: 'PC - Cais', active: true, available: true, renamable: true, tokenCount: 3 },
  { id: 's-casa', name: 'Casa genérica', active: false, available: true, renamable: true, tokenCount: 1 },
  { id: 's-9', name: 'Cena 9', active: false, available: true, renamable: true, tokenCount: 0 },
]

const INFO: Record<string, SceneDeletionInfo> = {
  's-cais': { orphanPins: 1, blockers: ['Ana', 'Bruno'], inside: 0 },
  's-casa': { orphanPins: 2, blockers: [], inside: 0 },
  's-9': { orphanPins: 0, blockers: [], inside: 0 },
}

describe('ScenesSection: menu "…" da cena (Duplicar, Subir, Descer, Apagar)', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    window.localStorage.clear()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function render(extra: Partial<ScenesSectionProps> = {}): void {
    act(() =>
      root.render(
        <ScenesSection
          scenes={CENAS}
          onSelect={() => {}}
          onCreate={() => {}}
          onRename={() => {}}
          onDuplicate={() => {}}
          onShift={() => {}}
          onDelete={() => {}}
          deletionInfo={(sceneId) => INFO[sceneId] ?? { orphanPins: 0, blockers: [], inside: 0 }}
          {...extra}
        />,
      ),
    )
  }

  function gatilho(cena: string): HTMLButtonElement {
    const alvo = container.querySelector<HTMLButtonElement>(`button[aria-label="Mais ações de ${cena}"]`)
    if (alvo === null) throw new Error(`sem menu para ${cena}`)
    return alvo
  }

  /** O menu que está aberto: o que acabou de fechar ainda sai por 120 ms, inerte (`ComSaida`). */
  function menuAberto(): HTMLElement | null {
    return container.querySelector<HTMLElement>('[role="menu"]:not([inert])')
  }

  function abrir(cena: string): HTMLElement {
    act(() => gatilho(cena).click())
    const menu = menuAberto()
    if (menu === null) throw new Error('menu não abriu')
    return menu
  }

  function item(menu: HTMLElement, nome: string): HTMLButtonElement {
    const alvo = Array.from(menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')).find((b) => b.textContent === nome)
    if (alvo === undefined) throw new Error(`sem item ${nome}`)
    return alvo
  }

  /** Abre o "…" da cena e escolhe o item — dois `act` separados, para o menu renderizar antes do clique. */
  function escolher(cena: string, nome: string): void {
    const menu = abrir(cena)
    act(() => item(menu, nome).click())
  }

  function tecla(alvo: Element, key: string): void {
    act(() => {
      alvo.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
    })
  }

  function confirmacao(): HTMLElement | null {
    return container.querySelector<HTMLElement>('[role="alertdialog"]')
  }

  function botaoNa(scope: HTMLElement, nome: string): HTMLButtonElement {
    const alvo = Array.from(scope.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent === nome)
    if (alvo === undefined) throw new Error(`sem botão ${nome}`)
    return alvo
  }

  it('sem os callbacks (mapa solto) não há menu "…"', () => {
    // O mapa solto: uma linha só, sem id e sem renomear (`sceneList`).
    const solto: SceneListItem[] = [{ id: '', name: 'Mapa solto', tokenCount: 0, available: true, active: true, renamable: false }]
    act(() => root.render(<ScenesSection scenes={solto} onSelect={() => {}} onCreate={() => {}} onRename={() => {}} />))
    expect(container.querySelector('button[aria-label^="Mais ações de"]')).toBeNull()
  })

  it('o menu tem os itens, com foco no primeiro; Subir fica esmaecido na primeira cena', () => {
    render()
    const menu = abrir('PC - Cais')
    expect(gatilho('PC - Cais').getAttribute('aria-expanded')).toBe('true')
    expect(Array.from(menu.querySelectorAll('[role="menuitem"]')).map((b) => b.textContent)).toEqual([
      // Renomear e Mover saíram da linha da cena aberta para o menu (lista de cenas, ideia 5).
      'Renomear…',
      'Mover para…',
      'Duplicar',
      'Subir',
      'Descer',
      'Definir como cena inicial',
      'Apagar cena…',
    ])
    expect(document.activeElement).toBe(item(menu, 'Renomear…'))
    // Sem `onMove` (este render), Mover fica no lugar, esmaecido.
    expect(item(menu, 'Mover para…').getAttribute('aria-disabled')).toBe('true')
    expect(item(menu, 'Subir').getAttribute('aria-disabled')).toBe('true')
    expect(item(menu, 'Descer').getAttribute('aria-disabled')).toBeNull()
  })

  it('botão direito na linha abre o mesmo menu, sem o menu do navegador; dentro de um campo, não', () => {
    render({ onMove: () => true })
    const linha = gatilho('Casa genérica').closest('li')
    if (linha === null) throw new Error('sem linha')
    const direito = (alvo: Element) => {
      const evento = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
      act(() => {
        alvo.dispatchEvent(evento)
      })
      return evento
    }
    const evento = direito(linha.querySelector('button[data-cena-nome]') ?? linha)
    expect(evento.defaultPrevented).toBe(true)
    expect(menuAberto()?.getAttribute('aria-label')).toBe('Ações de Casa genérica')
    expect(document.activeElement?.textContent).toBe('Renomear…')
    // O "Mover para…" abre dentro da linha: lá o botão direito é do campo (copiar, colar).
    act(() => item(menuAberto() as HTMLElement, 'Mover para…').click())
    const campo = linha.querySelector('select')
    if (campo === null) throw new Error('Mover para… não abriu na linha')
    expect(direito(campo).defaultPrevented).toBe(false)
  })

  it('Duplicar chama onDuplicate com a cena da linha e fecha o menu', () => {
    const onDuplicate = vi.fn()
    render({ onDuplicate })
    const menu = abrir('Casa genérica')
    act(() => item(menu, 'Duplicar').click())
    expect(onDuplicate).toHaveBeenCalledWith('s-casa')
    expect(menuAberto()).toBeNull()
  })

  it('Subir move a cena uma posição para cima; Descer, para baixo', () => {
    const onShift = vi.fn()
    render({ onShift })
    escolher('Casa genérica', 'Subir')
    expect(onShift).toHaveBeenLastCalledWith('s-casa', -1)
    escolher('Casa genérica', 'Descer')
    expect(onShift).toHaveBeenLastCalledWith('s-casa', 1)
    expect(onShift).toHaveBeenCalledTimes(2)
  })

  it('item esmaecido não age: Descer na última cena não chama onShift', () => {
    const onShift = vi.fn()
    render({ onShift })
    const menu = abrir('Cena 9')
    expect(item(menu, 'Descer').getAttribute('aria-disabled')).toBe('true')
    act(() => item(menu, 'Descer').click())
    expect(onShift).not.toHaveBeenCalled()
  })

  it('setas pulam o item esmaecido e Esc fecha devolvendo o foco ao "…"', () => {
    render()
    const menu = abrir('PC - Cais')
    tecla(menu, 'ArrowDown')
    // "Mover para…" (sem onMove) e "Subir" (primeira cena) estão esmaecidos: a seta os pula.
    expect(document.activeElement).toBe(item(menu, 'Duplicar'))
    tecla(menu, 'ArrowDown')
    expect(document.activeElement).toBe(item(menu, 'Descer'))
    tecla(menu, 'ArrowDown')
    expect(document.activeElement).toBe(item(menu, 'Apagar cena…'))
    tecla(menu, 'ArrowDown')
    expect(document.activeElement).toBe(item(menu, 'Renomear…'))
    tecla(menu, 'ArrowUp')
    expect(document.activeElement).toBe(item(menu, 'Apagar cena…'))
    tecla(menu, 'Escape')
    expect(menuAberto()).toBeNull()
    expect(document.activeElement).toBe(gatilho('PC - Cais'))
  })

  it('"Apagar cena…" pede confirmação com os pinos que ficam soltos, foco em Cancelar; Apagar chama onDelete', () => {
    const onDelete = vi.fn()
    render({ onDelete })
    escolher('Casa genérica', 'Apagar cena…')
    const caixa = confirmacao()
    if (caixa === null) throw new Error('confirmação não abriu')
    expect(caixa.textContent).toContain('Apagar Casa genérica?')
    expect(caixa.textContent).toContain('2 pinos de viagem de outras cenas vão ficar sem destino')
    expect(document.activeElement).toBe(botaoNa(caixa, 'Cancelar'))
    expect(onDelete).not.toHaveBeenCalled()
    act(() => botaoNa(caixa, 'Apagar').click())
    expect(onDelete).toHaveBeenCalledWith('s-casa')
    expect(confirmacao()).toBeNull()
  })

  it('"Cena 9" sem pino apontando diz que nada fica solto, e Esc cancela sem apagar', () => {
    const onDelete = vi.fn()
    render({ onDelete })
    escolher('Cena 9', 'Apagar cena…')
    const caixa = confirmacao()
    if (caixa === null) throw new Error('confirmação não abriu')
    expect(caixa.textContent).toContain('Nenhum pino de outra cena leva para cá.')
    tecla(caixa, 'Escape')
    expect(confirmacao()).toBeNull()
    expect(onDelete).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(gatilho('Cena 9'))
  })

  it('"PC - Cais" com o grupo mostra os nomes e Apagar desligado', () => {
    const onDelete = vi.fn()
    render({ onDelete })
    escolher('PC - Cais', 'Apagar cena…')
    const caixa = confirmacao()
    if (caixa === null) throw new Error('confirmação não abriu')
    expect(caixa.textContent).toContain('Não dá para apagar: Ana e Bruno estão nesta cena.')
    const apagar = botaoNa(caixa, 'Apagar')
    expect(apagar.disabled).toBe(true)
    act(() => apagar.click())
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('com uma cena só, "Apagar cena…" fica esmaecido', () => {
    render({ scenes: [CENAS[0]] })
    const menu = abrir('PC - Cais')
    expect(item(menu, 'Apagar cena…').getAttribute('aria-disabled')).toBe('true')
    act(() => item(menu, 'Apagar cena…').click())
    expect(confirmacao()).toBeNull()
  })

  /**
   * CENAS EM PASTAS: Subir e Descer andam entre as irmãs (mesma pasta), então
   * a ponta que esmaece é a da pasta, não a da lista inteira.
   *
   *   Costa Norte
   *     PC - Cais
   *     Casa genérica
   *   Farol
   */
  const EM_PASTAS: SceneListItem[] = [
    { id: 's-costa', name: 'Costa Norte', active: true, available: true, renamable: true, tokenCount: 0 },
    { id: 's-cais', name: 'PC - Cais', active: false, available: true, renamable: true, tokenCount: 0, parentId: 's-costa' },
    { id: 's-farol', name: 'Farol', active: false, available: true, renamable: true, tokenCount: 0 },
    { id: 's-casa', name: 'Casa genérica', active: false, available: true, renamable: true, tokenCount: 0, parentId: 's-costa' },
  ]

  it('dentro de uma pasta, Subir esmaece na primeira de dentro e Descer na última, mesmo no meio da lista', () => {
    render({ scenes: EM_PASTAS })
    const cais = abrir('PC - Cais')
    expect(item(cais, 'Subir').getAttribute('aria-disabled')).toBe('true')
    expect(item(cais, 'Descer').getAttribute('aria-disabled')).toBeNull()
    tecla(cais, 'Escape')
    const casa = abrir('Casa genérica')
    expect(item(casa, 'Subir').getAttribute('aria-disabled')).toBeNull()
    expect(item(casa, 'Descer').getAttribute('aria-disabled')).toBe('true')
  })

  it('a pasta do primeiro nível desce para baixo da irmã dela, e a última do primeiro nível não desce', () => {
    const onShift = vi.fn()
    render({ scenes: EM_PASTAS, onShift })
    const costa = abrir('Costa Norte')
    expect(item(costa, 'Subir').getAttribute('aria-disabled')).toBe('true')
    act(() => item(costa, 'Descer').click())
    expect(onShift).toHaveBeenCalledWith('s-costa', 1)
    const farol = abrir('Farol')
    expect(item(farol, 'Subir').getAttribute('aria-disabled')).toBeNull()
    expect(item(farol, 'Descer').getAttribute('aria-disabled')).toBe('true')
  })

  describe('a saída do menu (ComSaida, como os menus da porta, do token e das variantes)', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    const menuNaTela = () => container.querySelector<HTMLElement>('[role="menu"]')

    it('fechado, o menu fica os 120 ms da saída com gr-sai e inerte, com os itens de quando fechou, e então some', () => {
      render()
      const menu = abrir('Casa genérica')
      expect(menu.classList.contains('gr-anima')).toBe(true)
      expect(menu.classList.contains('gr-sai')).toBe(false)
      act(() => item(menu, 'Duplicar').click())
      expect(menuNaTela()).toBe(menu)
      expect(menu.classList.contains('gr-sai')).toBe(true)
      expect(menu.hasAttribute('inert')).toBe(true)
      expect(Array.from(menu.querySelectorAll('[role="menuitem"]')).map((b) => b.textContent)).toContain('Duplicar')
      expect(gatilho('Casa genérica').getAttribute('aria-expanded')).toBe('false')
      act(() => vi.advanceTimersByTime(SAIDA_DO_POP_MS - 1))
      expect(menuNaTela()).toBe(menu)
      act(() => vi.advanceTimersByTime(1))
      expect(menuNaTela()).toBeNull()
    })

    it('reaberto no meio da saída, o mesmo nó volta sem gr-sai e o foco volta ao primeiro item', () => {
      render()
      const menu = abrir('Casa genérica')
      tecla(menu, 'Escape')
      expect(document.activeElement).toBe(gatilho('Casa genérica'))
      const reaberto = abrir('Casa genérica')
      expect(reaberto).toBe(menu)
      expect(menu.classList.contains('gr-sai')).toBe(false)
      expect(document.activeElement).toBe(item(menu, 'Renomear…'))
    })
  })

  it('Esc depois do botão direito devolve o foco ao nome da cena, onde ele estava', () => {
    render()
    const nome = container.querySelector<HTMLButtonElement>('button[data-cena-nome="s-casa"]')
    if (nome === null) throw new Error('sem o nome')
    act(() => nome.focus())
    act(() => {
      nome.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
    })
    const menu = menuAberto()
    if (menu === null) throw new Error('menu não abriu')
    expect(document.activeElement).toBe(item(menu, 'Renomear…'))
    tecla(menu, 'Escape')
    expect(menuAberto()).toBeNull()
    expect(document.activeElement).toBe(nome)
  })

  it('Renomear… aberto pelo botão direito: Esc no campo devolve o foco ao nome da cena, não ao "…" escondido', async () => {
    render()
    const nome = container.querySelector<HTMLButtonElement>('button[data-cena-nome="s-9"]')
    if (nome === null) throw new Error('sem o nome')
    act(() => {
      nome.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
    })
    const menu = menuAberto()
    if (menu === null) throw new Error('menu não abriu')
    act(() => item(menu, 'Renomear…').click())
    const campo = container.querySelector<HTMLInputElement>('#lb-cena-nome')
    if (campo === null) throw new Error('campo não abriu')
    tecla(campo, 'Escape')
    // O foco volta no quadro seguinte (`refocusOpener`).
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)))
    expect(container.querySelector('#lb-cena-nome')).toBeNull()
    expect(document.activeElement).toBe(nome)
  })

  it('com o menu aberto, a lista rola e a linha dele sai da vista: o menu fecha', () => {
    const rolagem = document.createElement('div')
    rolagem.style.overflowY = 'auto'
    container.appendChild(rolagem)
    const raiz = createRoot(rolagem)
    act(() =>
      raiz.render(<ScenesSection scenes={CENAS} onSelect={() => {}} onCreate={() => {}} onRename={() => {}} onDuplicate={() => {}} />),
    )
    try {
      act(() => gatilho('Cena 9').click())
      expect(menuAberto()).not.toBeNull()
      // Rolou um pouco: a linha continua à vista (área de 0 a 300, linha em 200), o menu fica.
      let topoDaLinha = 200
      const caixa = (top: number, height: number) => ({ top, bottom: top + height, left: 0, right: 222, width: 222, height, x: 0, y: top, toJSON: () => ({}) })
      const medida = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
        if (this === rolagem) return caixa(0, 300)
        if (this.matches('li[data-cena-id="s-9"]')) return caixa(topoDaLinha, 40)
        return caixa(0, 0)
      })
      try {
        act(() => {
          rolagem.dispatchEvent(new Event('scroll'))
        })
        expect(menuAberto(), 'a linha ainda está à vista').not.toBeNull()
        topoDaLinha = -60
        act(() => {
          rolagem.dispatchEvent(new Event('scroll'))
        })
        expect(menuAberto(), 'a linha saiu por cima da área que rola').toBeNull()
      } finally {
        medida.mockRestore()
      }
    } finally {
      act(() => raiz.unmount())
    }
  })

  it('Renomear… abre o campo na própria linha da cena, com o nome dela no rótulo', () => {
    render()
    escolher('Cena 9', 'Renomear…')
    const campo = container.querySelector<HTMLInputElement>('#lb-cena-nome')
    if (campo === null) throw new Error('campo não abriu')
    expect(campo.closest('li')?.getAttribute('data-cena-id')).toBe('s-9')
    expect(container.querySelector('label[for="lb-cena-nome"]')?.textContent).toBe('Novo nome de Cena 9')
    expect(document.activeElement).toBe(campo)
  })

  it('placeSceneMenu põe o menu inteiro na janela: embaixo, virado para cima, deslizado ou rolando por dentro', () => {
    const base = { width: 160, height: 290, viewWidth: 1366, viewHeight: 768 }
    const ponto = (x: number, y: number) => ({ left: x, right: x, top: y, bottom: y })
    expect(placeSceneMenu({ ...base, anchor: ponto(1134, 200), fromPoint: true })).toEqual({ left: 1134, top: 202, maxHeight: null, up: false })
    // A última cena, rente ao pé da janela: vira para cima e termina 2 px acima do clique.
    expect(placeSceneMenu({ ...base, anchor: ponto(1134, 740), fromPoint: true })).toEqual({ left: 1134, top: 448, maxHeight: null, up: true })
    // Clique no meio de uma janela de 400 px: nem embaixo nem em cima cabe; encosta no pé.
    expect(placeSceneMenu({ ...base, viewHeight: 400, anchor: ponto(1300, 200), fromPoint: true })).toEqual({ left: 1198, top: 102, maxHeight: null, up: false })
    // Pelo "…": a borda direita do menu na do botão.
    expect(placeSceneMenu({ ...base, anchor: { left: 1250, right: 1273, top: 100, bottom: 124 }, fromPoint: false }).left).toBe(1113)
    // Janela mais baixa que o menu: ele ocupa a altura toda e rola por dentro.
    expect(placeSceneMenu({ ...base, viewHeight: 240, anchor: ponto(1134, 230), fromPoint: true })).toEqual({ left: 1134, top: 8, maxHeight: 224, up: false })
  })

  it('apagar uma pasta avisa que as cenas de dentro sobem um nível', () => {
    render({ scenes: EM_PASTAS, deletionInfo: (sceneId) => ({ orphanPins: 0, blockers: [], inside: sceneId === 's-costa' ? 2 : 0 }) })
    escolher('Costa Norte', 'Apagar cena…')
    const caixa = confirmacao()
    if (caixa === null) throw new Error('confirmação não abriu')
    expect(caixa.textContent).toContain('As 2 cenas de dentro dela sobem um nível.')
    act(() => botaoNa(caixa, 'Cancelar').click())
    escolher('Farol', 'Apagar cena…')
    expect(confirmacao()?.textContent).not.toContain('de dentro')
  })
})
