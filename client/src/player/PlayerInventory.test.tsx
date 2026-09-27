import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { Token } from '../types/map'
import { inventoryCharacters, type InventoryCharacter, type ItemTexts } from './inventario'
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
  itemTexts?: ItemTexts
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
          itemTexts={handlers.itemTexts}
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
    expect(detalhe()).toContain('15 moedas para pagar um colega ou oferecer numa troca.')
    tecla('ArrowRight')
    expect(document.activeElement).toBe(vaga('Erva verde, 2 unidades'))
    expect(selecionadas()).toEqual(['Erva verde, 2 unidades'])
    expect(detalhe()).toContain('Erva verde')
    expect(detalhe()).toContain('2 unidades. Para usar, avise o mestre: o efeito é com ele.')
    tecla('End')
    expect(document.activeElement).toBe(vaga('Chave do Escudo'))
    tecla('Home')
    expect(document.activeElement).toBe(vaga('Moedas: 15'))
    // A vaga escolhida é a única parada do Tab na grade.
    expect(vaga('Moedas: 15').tabIndex).toBe(0)
    expect(vaga('Chave do Escudo').tabIndex).toBe(-1)
  })

  describe('o visor do item escolhido: o objeto no palco, o nome e o texto do item', () => {
    const TEXTO_DA_CHAVE = 'Uma chave pesada, com um escudo gravado.'

    function palco(): HTMLElement {
      const achado = dialogo().querySelector<HTMLElement>('.pp-inv__palco')
      if (achado === null) throw new Error('sem o palco do item')
      return achado
    }

    function descricao(): HTMLElement {
      const achado = dialogo().querySelector<HTMLElement>('.pp-inv__detalhe-texto')
      if (achado === null) throw new Error('sem o texto do item')
      return achado
    }

    it('o texto que o mestre escreveu no item, lido quando ele ainda estava no chão', () => {
      render(personagens([JILL, DIEGO], ['jill']), { itemTexts: new Map([['chave-1', TEXTO_DA_CHAVE]]) })
      act(() => vaga('Chave do Escudo').click())
      expect(dialogo().querySelector('h3.pp-inv__detalhe-nome')?.textContent).toBe('Chave do Escudo')
      expect(descricao().textContent).toBe(TEXTO_DA_CHAVE)
      expect(descricao().classList.contains('pp-inv__detalhe-texto--derivado')).toBe(false)
    })

    it('sem o texto do mestre: o que dá para fazer com o item, pelo tipo; nunca "na sua mochila"', () => {
      render(personagens([JILL, DIEGO], ['jill']))
      act(() => vaga('Chave do Escudo').click())
      expect(descricao().textContent).toBe('Se for a chave certa, abre uma passagem trancada: encoste a ficha nela e use pelo cartão da passagem.')
      expect(descricao().classList.contains('pp-inv__detalhe-texto--derivado')).toBe(true)
      for (const rotulo of ['Moedas: 15', 'Erva verde, 2 unidades', 'Chave do Escudo']) {
        act(() => vaga(rotulo).click())
        expect(detalhe()).not.toMatch(/mochila|bolsa/i)
      }
    })

    it('o objeto ocupa o palco, fora da leitura de tela: o nome logo abaixo já diz o que é', () => {
      render(personagens([JILL, DIEGO], ['jill']))
      expect(palco().getAttribute('aria-hidden')).toBe('true')
      expect(palco().querySelector('svg')).not.toBeNull()
      act(() => vaga('Chave do Escudo').click())
      expect(palco().querySelector('svg')).not.toBeNull()
    })

    it('a vaga escolhida aponta para o texto do item: o leitor de tela lê o que é ao chegar nela', () => {
      render(personagens([JILL, DIEGO], ['jill']), { itemTexts: new Map([['chave-1', TEXTO_DA_CHAVE]]) })
      tecla('End')
      const alvo = vaga('Chave do Escudo').getAttribute('aria-describedby')
      expect(alvo).toBe(descricao().id)
      expect(document.getElementById(alvo ?? '')?.textContent).toBe(TEXTO_DA_CHAVE)
      expect(vaga('Moedas: 15').hasAttribute('aria-describedby')).toBe(false)
    })

    it('clicar numa vaga traz o objeto com movimento; pelas setas ele só troca', () => {
      render(personagens([JILL, DIEGO], ['jill']))
      // Abrir já é a entrada do inventário inteiro: o palco não anima de novo.
      expect(palco().hasAttribute('data-entrada')).toBe(false)
      act(() => vaga('Chave do Escudo').click())
      expect(palco().getAttribute('data-entrada')).toBe('clique')
      tecla('ArrowLeft')
      expect(selecionadas()).toEqual(['Erva verde, 2 unidades'])
      expect(palco().hasAttribute('data-entrada')).toBe(false)
    })
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

    it('o mestre encerra o empréstimo do Carlos antes de o host cobrar: ficha que sai do recorte não é pagamento, e o "short" do host ainda aparece', () => {
      const onPay = vi.fn(() => true)
      render(mesa(20, 2), { onPay })
      // A Jill só tem 2: os 3 saem pela ficha do Carlos.
      act(() => botao('Carlos').click())
      act(() => botao('Pagar a…').click())
      const campo = dialogo().querySelector<HTMLInputElement>('input[type="number"]')
      if (campo === null) throw new Error('sem o campo de moedas')
      digita(campo, '3')
      act(() => botao('Diego').click())
      act(() => botao('Sim').click())
      expect(onPay).toHaveBeenCalledWith('diego', 3)
      // O mapa novo chega antes da resposta: o Carlos voltou ao mestre, saiu das
      // fichas dele e a bolsa não viaja mais. A soma cai de 22 para 2 — e ninguém pagou.
      const semCarlos = personagens([ficha('carlos', 'Carlos', 100, { y: 150 }), { ...jill, moedas: 2 }, diego], ['jill'])
      render(semCarlos, { onPay })
      expect(status()).toBe('Pagando 3 moedas a Diego…')
      // O host só acha a Jill encostada, com 2, e recusa: a recusa é deste pedido.
      render(semCarlos, { onPay, notice: { id: 1, phase: 'coins_rejected', reason: 'short' } })
      expect(status()).toBe('A sua ficha ao lado dele não tem tantas moedas')
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

  describe('o véu isola o inventário: o resto da página fica inerte e some enquanto ele está aberto', () => {
    function solto(classe = ''): HTMLDivElement {
      const el = document.createElement('div')
      if (classe !== '') el.className = classe
      document.body.appendChild(el)
      return el
    }

    it('abrir deixa inerte tudo o que está fora do véu; fechar devolve', () => {
      const cartao = solto('pp-pincard')
      render(personagens([JILL, DIEGO], ['jill']))
      const veu = document.querySelector('.pp-inv')
      expect(cartao.hasAttribute('inert')).toBe(true)
      expect(cartao.getAttribute('data-pp-inv-fundo')).toBe('')
      expect(container.hasAttribute('inert')).toBe(true)
      expect(veu?.hasAttribute('inert')).toBe(false)
      expect(veu?.hasAttribute('data-pp-inv-fundo')).toBe(false)
      act(() => root.render(<></>))
      expect(cartao.hasAttribute('inert')).toBe(false)
      expect(cartao.hasAttribute('data-pp-inv-fundo')).toBe(false)
      expect(container.hasAttribute('inert')).toBe(false)
      cartao.remove()
    })

    it('na raiz do app, só os irmãos do véu ficam inertes: o alarme do mestre e o aviso de reconexão continuam livres', async () => {
      const raiz = solto()
      raiz.id = 'root'
      const barra = document.createElement('div')
      barra.className = 'pp-bar'
      const alarme = document.createElement('div')
      alarme.className = 'pp-alarm'
      raiz.append(barra, alarme)
      render(personagens([JILL, DIEGO], ['jill']))
      expect(raiz.hasAttribute('inert')).toBe(false)
      expect(barra.hasAttribute('inert')).toBe(true)
      expect(alarme.hasAttribute('inert')).toBe(false)
      // Chegam depois da abertura: a conexão caiu (fica à vista, por cima do véu)
      // e um aviso novo (vai para trás do véu, já escondido, sem esperar o fade).
      const reconectando = document.createElement('div')
      reconectando.className = 'pp-reconnecting'
      const aviso = document.createElement('p')
      aviso.className = 'pp-notice'
      raiz.append(reconectando, aviso)
      await act(async () => {})
      expect(reconectando.hasAttribute('inert')).toBe(false)
      expect(aviso.hasAttribute('inert')).toBe(true)
      expect(aviso.getAttribute('data-pp-inv-fundo')).toBe('ja')
      act(() => root.render(<></>))
      expect(barra.hasAttribute('inert')).toBe(false)
      expect(aviso.hasAttribute('inert')).toBe(false)
      raiz.remove()
    })

    it('quem já era inerte antes continua inerte depois de fechar', () => {
      const ja = solto()
      ja.setAttribute('inert', '')
      render(personagens([JILL, DIEGO], ['jill']))
      expect(ja.hasAttribute('data-pp-inv-fundo')).toBe(false)
      act(() => root.render(<></>))
      expect(ja.hasAttribute('inert')).toBe(true)
      ja.remove()
    })

    it('aberto pelo teclado, o fundo sai de cena na hora, sem esperar o véu', () => {
      render(personagens([JILL, DIEGO], ['jill']), { instant: true })
      expect(container.getAttribute('data-pp-inv-fundo')).toBe('ja')
    })

    it('o Esc é do inventário: nenhum outro ouvinte da página recebe a tecla', () => {
      const onClose = vi.fn()
      const outro = vi.fn()
      document.addEventListener('keydown', outro)
      window.addEventListener('keydown', outro)
      try {
        render(personagens([JILL, DIEGO], ['jill']), { onClose })
        tecla('Escape')
        expect(onClose).toHaveBeenCalledTimes(1)
        expect(outro).not.toHaveBeenCalled()
      } finally {
        document.removeEventListener('keydown', outro)
        window.removeEventListener('keydown', outro)
      }
    })
  })

  it('ver o item, "Dar a quem?", "Pagar" e a pergunta trocam só o miolo da caixa de ações: a caixa (altura reservada) e a linha do resultado ficam no lugar', () => {
    render(personagens([JILL, DIEGO], ['jill']))
    const caixa = dialogo().querySelector('.pp-inv__passos')
    const linha = dialogo().querySelector('[role="status"]')
    expect(caixa).not.toBeNull()
    const noLugar = () => {
      expect(dialogo().querySelector('.pp-inv__passos')).toBe(caixa)
      expect(dialogo().querySelector('[role="status"]')).toBe(linha)
    }
    // Pagar: o campo e o "Voltar" dividem a primeira fileira; os colegas ficam na segunda.
    act(() => botao('Pagar a…').click())
    noLugar()
    const campo = dialogo().querySelector<HTMLInputElement>('input[type="number"]')
    if (campo === null) throw new Error('sem o campo de moedas')
    digita(campo, '5')
    const topoPagar = campo.closest('.pp-inv__passo-topo')
    expect(topoPagar).not.toBeNull()
    expect(botao('Voltar').closest('.pp-inv__passo-topo')).toBe(topoPagar)
    noLugar()
    act(() => botao('Diego').click())
    expect(detalhe()).toContain('Pagar 5 moedas a Diego?')
    noLugar()
    act(() => botao('Não').click())
    // Dar: a pergunta e o "Voltar" na mesma fileira.
    act(() => vaga('Chave do Escudo').click())
    act(() => botao('Dar a…').click())
    const pergunta = Array.from(dialogo().querySelectorAll('.pp-inv__pergunta')).find((p) => p.textContent === 'Dar a quem?')
    expect(pergunta?.closest('.pp-inv__passo-topo')).not.toBeNull()
    expect(botao('Voltar').closest('.pp-inv__passo-topo')).toBe(pergunta?.closest('.pp-inv__passo-topo'))
    noLugar()
  })

  it('Dar, Pagar e a pergunta final têm a mesma forma, duas fileiras: em cima o que se pergunta (e o "Voltar"), embaixo as respostas; o molde que reserva a altura tem essa forma também', () => {
    render(personagens([JILL, DIEGO], ['jill']))
    const vivo = () => Array.from(dialogo().querySelectorAll('.pp-inv__passo')).find((passo) => passo.closest('.pp-inv__molde') === null)
    const fileiras = (passo: Element | null | undefined) => Array.from(passo?.children ?? []).map((filho) => filho.className)
    const respostas = () => Array.from(vivo()?.querySelectorAll('.pp-inv__passo-escolhas button') ?? []).map((b) => b.textContent)
    const forma: Record<string, unknown> = {}
    act(() => botao('Pagar a…').click())
    forma.pagar = [fileiras(vivo()), respostas()]
    act(() => botao('Diego').click())
    forma.confirmarPagar = [fileiras(vivo()), respostas()]
    act(() => botao('Não').click())
    act(() => vaga('Chave do Escudo').click())
    act(() => botao('Dar a…').click())
    forma.dar = [fileiras(vivo()), respostas()]
    act(() => botao('Diego').click())
    forma.confirmarDar = [fileiras(vivo()), respostas()]
    forma.molde = fileiras(dialogo().querySelector('.pp-inv__molde .pp-inv__passo'))
    const DUAS = ['pp-inv__passo-topo', 'pp-inv__passo-escolhas']
    expect(forma).toEqual({
      pagar: [DUAS, ['Diego']],
      confirmarPagar: [DUAS, ['Sim', 'Não']],
      dar: [DUAS, ['Diego']],
      confirmarDar: [DUAS, ['Sim', 'Não']],
      molde: DUAS,
    })
  })

  it('ao entrar em "Pagar" e em "Dar a quem?", o foco cai na primeira resposta do passo: o campo, na fileira de cima do Pagar; o primeiro colega, na fileira de baixo do Dar (que a zona inteira cabe na tela de um celular, só o navegador prova)', () => {
    render(personagens([JILL, DIEGO], ['jill']))
    act(() => botao('Pagar a…').click())
    expect(document.activeElement).toBeInstanceOf(HTMLInputElement)
    expect(document.activeElement?.closest('.pp-inv__passo-topo')).toBe(botao('Voltar').closest('.pp-inv__passo-topo'))
    act(() => botao('Voltar').click())
    act(() => vaga('Chave do Escudo').click())
    act(() => botao('Dar a…').click())
    expect(document.activeElement).toBe(botao('Diego'))
    expect(document.activeElement?.closest('.pp-inv__passo-escolhas')).not.toBeNull()
  })

  it('"Pagar" com um valor que não vale: o aviso ganha uma linha só dele embaixo dos colegas, e o campo, "Pagar a quem?" e o Diego (indisponível, com o aviso como motivo) ficam na tela enquanto o jogador corrige; tocar no Diego não tira o foco do campo; a fileira tem a mesma forma no valor bom, no ruim e no molde', () => {
    const onPay = vi.fn(() => true)
    render(personagens([JILL, DIEGO], ['jill']), { onPay })
    act(() => botao('Pagar a…').click())
    const campo = dialogo().querySelector<HTMLInputElement>('input[type="number"]')
    if (campo === null) throw new Error('sem o campo de moedas')
    const vivo = () => Array.from(dialogo().querySelectorAll('.pp-inv__passo')).find((passo) => passo.closest('.pp-inv__molde') === null)
    const escolhas = (passo: Element | null | undefined) => Array.from(passo?.querySelector('.pp-inv__passo-escolhas')?.children ?? []).map((filho) => filho.className)
    const comValorBom = escolhas(vivo())
    digita(campo, '99')
    // O destinatário continua na tela enquanto se corrige o valor.
    const diego = botao('Diego')
    const aviso = vivo()?.querySelector('[role="alert"]')
    expect(aviso?.textContent).toBe('Use um número inteiro de 1 a 15')
    expect(detalhe()).toContain('Pagar a quem?')
    // Indisponível, com o aviso como motivo — no botão e no campo. `aria-disabled`,
    // e não `disabled`: o botão desligado de verdade não pega foco, e o toque
    // nele jogava o foco do campo para fora da janela.
    expect(diego.getAttribute('aria-disabled')).toBe('true')
    expect(diego.disabled).toBe(false)
    expect(aviso?.id).toBeTruthy()
    expect(diego.getAttribute('aria-describedby')).toBe(aviso?.id)
    expect(campo.getAttribute('aria-describedby')).toBe(aviso?.id)
    expect(campo.getAttribute('aria-invalid')).toBe('true')
    // Nada entra nem sai da fileira: só o texto do aviso muda.
    expect(escolhas(vivo())).toEqual(comValorBom)
    expect(escolhas(dialogo().querySelector('.pp-inv__molde .pp-inv__passo'))).toEqual(comValorBom)
    // O dedo no destinatário com o valor ruim não leva o foco do campo (no
    // celular o teclado fica aberto) ...
    const toque = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    act(() => {
      diego.dispatchEvent(toque)
    })
    expect(toque.defaultPrevented).toBe(true)
    // ... e o clique, de dedo ou de Enter com o foco nele, não pergunta nem
    // paga: devolve o foco ao campo, que é onde está o conserto.
    act(() => diego.focus())
    expect(document.activeElement).toBe(diego)
    act(() => diego.click())
    expect(detalhe()).not.toContain('Pagar 99')
    expect(onPay).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(campo)
    // Corrigido, o aviso some sem sair do lugar (a região viva é a mesma) e o Diego volta a valer.
    digita(campo, '5')
    expect(vivo()?.querySelector('[role="alert"]')).toBe(aviso)
    expect(aviso?.textContent).toBe('')
    expect(campo.hasAttribute('aria-describedby')).toBe(false)
    expect(botao('Diego').hasAttribute('aria-disabled')).toBe(false)
    const toqueBom = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    act(() => {
      botao('Diego').dispatchEvent(toqueBom)
    })
    expect(toqueBom.defaultPrevented).toBe(false)
    act(() => botao('Diego').click())
    expect(detalhe()).toContain('Pagar 5 moedas a Diego?')
  })
})
