import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { Token } from '../types/map'
import { inventoryCharacters, type InventoryCharacter } from './inventario'
import type { ItemNotice } from './playerConnection'
import { PlayerInventory } from './PlayerInventory'

/**
 * INVENTÁRIO ESTILO RESIDENT EVIL, a tela: retrato à esquerda com a faixa da
 * condição, a grade de itens com a quantidade, o item escolhido com o que dá
 * para fazer, e o "Sim/Não" do RE antes de dar ou pagar. Modal de verdade:
 * o foco entra na grade, as setas andam, Esc volta um passo ou fecha, e o Tab
 * não sai.
 */

const FOTO = 'data:image/png;base64,iVBORw0KGgo='

function ficha(id: string, name: string, x: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name, x, y: 100, size: 1, image: null, ...extra }
}

const JILL = ficha('jill', 'Jill', 100, {
  imageData: FOTO,
  health: { current: 40, max: 100, shownToPlayers: true },
  conditions: ['envenenado'],
  moedas: 15,
  mochila: [
    { id: 'erva-1', nome: 'Erva verde' },
    { id: 'chave-1', nome: 'Chave do Escudo' },
    { id: 'erva-2', nome: 'Erva verde' },
  ],
})
const DIEGO = ficha('diego', 'Diego', 150)

/** As fichas como a tela as recebe: pela mesma função que a página usa. */
function personagens(tokens: Token[], own: string[], party: string[] = ['diego']): InventoryCharacter[] {
  return inventoryCharacters({ ...createEmptyMap('m1', '', 12, 6, 50), tokens }, own, party, '#4ea1ff')
}

interface Handlers {
  onGive?: (itemId: string, toTokenId: string) => boolean
  onPay?: (toTokenId: string, moedas: number) => boolean
  onClose?: () => void
  notice?: ItemNotice
  instant?: boolean
}

describe('PlayerInventory', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.useRealTimers()
  })

  function render(characters: InventoryCharacter[], handlers: Handlers = {}): void {
    act(() =>
      root.render(
        <PlayerInventory
          characters={characters}
          onGive={handlers.onGive ?? (() => true)}
          onPay={handlers.onPay ?? (() => true)}
          onClose={handlers.onClose ?? (() => {})}
          notice={handlers.notice}
          instant={handlers.instant}
        />,
      ),
    )
  }

  function dialogo(): HTMLElement {
    const achado = document.querySelector<HTMLElement>('[role="dialog"]')
    if (achado === null) throw new Error('o inventário não abriu')
    return achado
  }

  function botao(texto: string): HTMLButtonElement {
    const achado = Array.from(dialogo().querySelectorAll('button')).find((b) => b.textContent?.trim() === texto)
    if (!(achado instanceof HTMLButtonElement)) throw new Error(`sem o botão "${texto}"`)
    return achado
  }

  function vaga(rotulo: string): HTMLButtonElement {
    const achado = dialogo().querySelector<HTMLButtonElement>(`[role="gridcell"] button[aria-label="${rotulo}"]`)
    if (achado === null) throw new Error(`sem a vaga "${rotulo}"`)
    return achado
  }

  function selecionadas(): string[] {
    return Array.from(dialogo().querySelectorAll('[role="gridcell"][aria-selected="true"] button')).map((b) => b.getAttribute('aria-label') ?? '')
  }

  function tecla(key: string, opcoes: KeyboardEventInit = {}): void {
    const alvo = document.activeElement ?? document.body
    act(() => {
      alvo.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opcoes }))
    })
  }

  function digita(campo: HTMLInputElement, valor: string): void {
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      setter?.call(campo, valor)
      campo.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  function detalhe(): string {
    return dialogo().querySelector('.pp-inv__detalhe')?.textContent ?? ''
  }

  function status(): string {
    return dialogo().querySelector('[role="status"]')?.textContent ?? ''
  }

  it('abre como diálogo modal, com o título, o retrato, o nome e a grade com as quantidades', () => {
    render(personagens([JILL, DIEGO], ['jill']))
    const d = dialogo()
    expect(d.getAttribute('aria-modal')).toBe('true')
    const titulo = document.getElementById(d.getAttribute('aria-labelledby') ?? '')
    expect(titulo?.textContent).toBe('Inventário')
    expect(d.querySelector('img')?.getAttribute('alt')).toBe('Foto de Jill')
    expect(d.textContent).toContain('Jill')
    const grade = d.querySelector('[role="grid"]')
    expect(grade?.getAttribute('aria-label')).toBe('Itens de Jill')
    expect(Array.from(d.querySelectorAll('[role="gridcell"] button')).map((b) => b.getAttribute('aria-label'))).toEqual([
      'Moedas: 15',
      'Erva verde, 2 unidades',
      'Chave do Escudo',
    ])
    expect(vaga('Moedas: 15').textContent).toContain('15')
    expect(vaga('Erva verde, 2 unidades').textContent).toContain('2')
    expect(vaga('Chave do Escudo').querySelector('.pp-inv__qtd')).toBeNull()
    // Três vagas cheias numa grade de 8: cinco vazias, só de enfeite.
    expect(d.querySelectorAll('.pp-inv__vazia')).toHaveLength(5)
    d.querySelectorAll('.pp-inv__vazia').forEach((vazia) => expect(vazia.closest('[aria-hidden="true"]')).not.toBeNull())
  })

  it('condição conhecida: a palavra do estado e o ECG com nome acessível; nenhum número de vida na tela', () => {
    render(personagens([JILL, DIEGO], ['jill']))
    const ecg = dialogo().querySelector('.pp-inv-ecg')
    expect(ecg?.getAttribute('role')).toBe('img')
    expect(ecg?.getAttribute('aria-label')).toBe('Condição: Cuidado')
    expect(ecg?.textContent).toContain('Cuidado')
    expect(ecg?.classList.contains('pp-inv-ecg--caution')).toBe(true)
    expect(dialogo().textContent).not.toMatch(/40|%/)
    expect(dialogo().querySelector('.pp-inv__marcas')?.textContent).toContain('Envenenado')
  })

  it('vida escondida pelo mestre: a condição diz que está oculta e por quê', () => {
    render(personagens([ficha('jill', 'Jill', 100, { mochila: [{ id: 'c', nome: 'Chave' }] })], ['jill']))
    const ecg = dialogo().querySelector('.pp-inv-ecg')
    expect(ecg?.getAttribute('aria-label')).toBe('Condição oculta. Só o mestre vê a sua vida.')
    expect(ecg?.classList.contains('pp-inv-ecg--oculta')).toBe(true)
    expect(ecg?.textContent).toContain('Oculta')
    expect(ecg?.textContent).toContain('Só o mestre vê a sua vida.')
    expect(dialogo().querySelector('.pp-inv__marcas')).toBeNull()
  })

  it('sem foto: a inicial no lugar do retrato e onde escolher uma', () => {
    render(personagens([ficha('jill', 'Jill', 100)], ['jill']))
    expect(dialogo().querySelector('img')).toBeNull()
    expect(dialogo().querySelector('.pp-inv__monograma')?.textContent).toBe('J')
    expect(dialogo().textContent).toContain('Sem foto. Escolha uma no Painel, em Meu personagem.')
  })

  it('o foco entra na primeira vaga; as setas andam, escolhem e o item escolhido aparece grande', () => {
    render(personagens([JILL, DIEGO], ['jill']))
    expect(document.activeElement).toBe(vaga('Moedas: 15'))
    expect(selecionadas()).toEqual(['Moedas: 15'])
    expect(detalhe()).toContain('15 moedas na sua bolsa.')
    tecla('ArrowRight')
    expect(document.activeElement).toBe(vaga('Erva verde, 2 unidades'))
    expect(selecionadas()).toEqual(['Erva verde, 2 unidades'])
    expect(detalhe()).toContain('Erva verde')
    expect(detalhe()).toContain('2 na sua mochila.')
    tecla('End')
    expect(document.activeElement).toBe(vaga('Chave do Escudo'))
    tecla('Home')
    expect(document.activeElement).toBe(vaga('Moedas: 15'))
    // A vaga escolhida é a única parada do Tab na grade.
    expect(vaga('Moedas: 15').tabIndex).toBe(0)
    expect(vaga('Chave do Escudo').tabIndex).toBe(-1)
  })

  it('Enter na vaga leva às ações do item', () => {
    render(personagens([JILL, DIEGO], ['jill']))
    act(() => vaga('Chave do Escudo').focus())
    tecla('Enter')
    expect(document.activeElement).toBe(botao('Dar a…'))
  })

  it('"Dar a…" sem colega encostado fica desligado e diz por quê', () => {
    render(personagens([JILL], ['jill'], []))
    act(() => vaga('Chave do Escudo').click())
    expect(botao('Dar a…').disabled).toBe(true)
    expect(detalhe()).toContain('Para dar, encoste a sua ficha na de um colega.')
  })

  it('"Dar a…" → colega → "Dar Chave do Escudo a Diego?" → Sim manda o item e o resultado aparece', () => {
    const onGive = vi.fn(() => true)
    const lista = personagens([JILL, DIEGO], ['jill'])
    render(lista, { onGive })
    act(() => vaga('Chave do Escudo').click())
    act(() => botao('Dar a…').click())
    expect(detalhe()).toContain('Dar a quem?')
    expect(document.activeElement).toBe(botao('Diego'))
    act(() => botao('Diego').click())
    expect(detalhe()).toContain('Dar Chave do Escudo a Diego?')
    expect(document.activeElement).toBe(botao('Sim'))
    act(() => botao('Sim').click())
    expect(onGive).toHaveBeenCalledWith('chave-1', 'diego')
    expect(status()).toBe('Entregando a Diego…')
    // O host tirou o item da mochila: chegou o mapa novo.
    const depois = personagens([{ ...JILL, mochila: JILL.mochila?.filter((i) => i.id !== 'chave-1') }, DIEGO], ['jill'])
    render(depois, { onGive })
    expect(status()).toBe('Chave do Escudo foi para Diego.')
  })

  it('"Não" volta sem dar nada', () => {
    const onGive = vi.fn(() => true)
    render(personagens([JILL, DIEGO], ['jill']), { onGive })
    act(() => vaga('Chave do Escudo').click())
    act(() => botao('Dar a…').click())
    act(() => botao('Diego').click())
    act(() => botao('Não').click())
    expect(onGive).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(botao('Dar a…'))
  })

  it('a recusa do host aparece dentro do inventário (o aviso de baixo fica atrás do véu)', () => {
    const lista = personagens([JILL, DIEGO], ['jill'])
    render(lista, { notice: { id: 3, phase: 'taken', nome: 'Faca' } })
    act(() => vaga('Chave do Escudo').click())
    act(() => botao('Dar a…').click())
    act(() => botao('Diego').click())
    act(() => botao('Sim').click())
    render(lista, { notice: { id: 4, phase: 'give_rejected', reason: 'far' } })
    expect(status()).toBe('Chegue mais perto para dar')
  })

  it('sem resposta da mesa, a espera não gira para sempre', () => {
    vi.useFakeTimers()
    render(personagens([JILL, DIEGO], ['jill']))
    act(() => vaga('Chave do Escudo').click())
    act(() => botao('Dar a…').click())
    act(() => botao('Diego').click())
    act(() => botao('Sim').click())
    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(status()).toBe('A mesa não respondeu. Confira a conexão e tente de novo.')
  })

  it('"Pagar a…" na bolsa: quantas moedas, a quem, "Pagar 5 moedas a Diego?" → Sim paga', () => {
    const onPay = vi.fn(() => true)
    render(personagens([JILL, DIEGO], ['jill']), { onPay })
    act(() => botao('Pagar a…').click())
    const campo = dialogo().querySelector<HTMLInputElement>('input[type="number"]')
    if (campo === null) throw new Error('sem o campo de moedas')
    expect(document.activeElement).toBe(campo)
    expect(dialogo().querySelector(`label[for="${campo.id}"]`)?.textContent).toBe('Quantas moedas')
    digita(campo, '99')
    expect(detalhe()).toContain('Use um número inteiro de 1 a 15')
    digita(campo, '5')
    act(() => botao('Diego').click())
    expect(detalhe()).toContain('Pagar 5 moedas a Diego?')
    act(() => botao('Sim').click())
    expect(onPay).toHaveBeenCalledWith('diego', 5)
  })

  describe('"Pagar a…" com duas fichas dele encostadas no colega: quem paga é quem o host escolhe', () => {
    // O `coins.give` não diz de qual ficha sai: o host cobra da PRIMEIRA ficha
    // do jogador, na ordem do mapa, encostada no colega e com saldo. A Jill (5)
    // está aberta; o ajudante Carlos (20) vem antes no mapa e também encosta no Diego.
    const carlos = ficha('carlos', 'Carlos', 100, { y: 150, emprestada: true, moedas: 20 })
    const jill = ficha('jill', 'Jill', 100, { moedas: 5 })
    const diego = ficha('diego', 'Diego', 150, { y: 125 })
    const mesa = (moedasDoCarlos: number, moedasDaJill = 5) => personagens([{ ...carlos, moedas: moedasDoCarlos }, { ...jill, moedas: moedasDaJill }, diego], ['jill', 'carlos'])

    function pagaTresAoDiego(): void {
      expect(dialogo().querySelector('[role="grid"]')?.getAttribute('aria-label')).toBe('Itens de Jill')
      act(() => botao('Pagar a…').click())
      const campo = dialogo().querySelector<HTMLInputElement>('input[type="number"]')
      if (campo === null) throw new Error('sem o campo de moedas')
      digita(campo, '3')
      act(() => botao('Diego').click())
    }

    it('a pergunta Sim/Não diz de qual bolsa sai quando não é a da ficha aberta', () => {
      render(mesa(20))
      pagaTresAoDiego()
      expect(detalhe()).toContain('Pagar 3 moedas a Diego?')
      expect(detalhe()).toContain('Sai da bolsa de Carlos.')
    })

    it('o host cobrou do Carlos: o pagamento conta como feito, e nunca vira "a mesa não respondeu"', () => {
      vi.useFakeTimers()
      const onPay = vi.fn(() => true)
      render(mesa(20), { onPay })
      pagaTresAoDiego()
      act(() => botao('Sim').click())
      expect(onPay).toHaveBeenCalledWith('diego', 3)
      render(mesa(17), { onPay })
      expect(status()).toBe('Você pagou 3 moedas a Diego.')
      act(() => {
        vi.advanceTimersByTime(10_000)
      })
      expect(status()).toBe('Você pagou 3 moedas a Diego.')
    })

    it('quando quem paga é a própria ficha aberta, a pergunta não fala de outra bolsa', () => {
      render(mesa(2))
      pagaTresAoDiego()
      expect(detalhe()).toContain('Pagar 3 moedas a Diego?')
      expect(detalhe()).not.toContain('Sai da bolsa')
    })
  })

  it('Esc fecha; com a pergunta aberta, Esc só volta um passo', () => {
    const onClose = vi.fn()
    render(personagens([JILL, DIEGO], ['jill']), { onClose })
    act(() => vaga('Chave do Escudo').click())
    act(() => botao('Dar a…').click())
    tecla('Escape')
    expect(onClose).not.toHaveBeenCalled()
    expect(detalhe()).not.toContain('Dar a quem?')
    tecla('Escape')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('o Tab não sai do inventário', () => {
    render(personagens([JILL, DIEGO], ['jill']))
    act(() => vaga('Chave do Escudo').click())
    act(() => botao('Dar a…').focus())
    tecla('Tab')
    expect(document.activeElement).toBe(botao('Fechar'))
    tecla('Tab', { shiftKey: true })
    expect(document.activeElement).toBe(botao('Dar a…'))
  })

  it('fechado, o foco volta para quem abriu', () => {
    const abridor = document.createElement('button')
    document.body.appendChild(abridor)
    abridor.focus()
    render(personagens([JILL, DIEGO], ['jill']))
    expect(document.activeElement).not.toBe(abridor)
    act(() => root.render(<></>))
    expect(document.activeElement).toBe(abridor)
    abridor.remove()
  })

  it('duas fichas dele: a troca de ficha troca retrato, grade e condição', () => {
    const carlos = ficha('carlos', 'Carlos', 400, { emprestada: true, mochila: [{ id: 'f', nome: 'Faca' }] })
    render(personagens([JILL, DIEGO, carlos], ['jill', 'carlos']))
    const grupo = dialogo().querySelector('[role="group"][aria-label="Ficha"]')
    expect(Array.from(grupo?.querySelectorAll('button') ?? []).map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([
      ['Jill', 'true'],
      ['Carlos', 'false'],
    ])
    act(() => botao('Carlos').click())
    expect(dialogo().querySelector('[role="grid"]')?.getAttribute('aria-label')).toBe('Itens de Carlos')
    expect(dialogo().querySelector('.pp-inv-ecg')?.getAttribute('aria-label')).toBe('Condição oculta. Só o mestre vê a vida de Carlos.')
  })

  it('sem nada: só vagas vazias, o convite, e o foco no Fechar', () => {
    render(personagens([ficha('jill', 'Jill', 100)], ['jill']))
    expect(dialogo().querySelector('[role="grid"]')).toBeNull()
    expect(dialogo().querySelectorAll('.pp-inv__vazia')).toHaveLength(8)
    expect(dialogo().textContent).toContain('Nada na mochila. Itens que você pegar no mapa aparecem aqui.')
    expect(document.activeElement).toBe(botao('Fechar'))
  })

  it('aberto pelo teclado entra sem animação', () => {
    render(personagens([JILL, DIEGO], ['jill']), { instant: true })
    expect(document.querySelector('.pp-inv')?.hasAttribute('data-instant')).toBe(true)
  })
})
