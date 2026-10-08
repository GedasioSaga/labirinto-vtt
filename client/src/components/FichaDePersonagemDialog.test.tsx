import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { novoCartao, novoPersonagem, type Personagem } from '../lib/personagem'
import { SISTEMA_ONE_PIECE } from '../lib/sistemaOnePiece'
import { FichaDePersonagemDialog, type FichaDePersonagemDialogProps } from './FichaDePersonagemDialog'

/**
 * A janela da FICHA DE PERSONAGEM: lê a ficha no desenho do projeto-rpg-v2
 * (nome, selo, recursos, atributos com rank, abas de cartões) e edita num
 * rascunho que só vai para a aventura no Salvar.
 */

beforeAll(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
})

function vagn(): Personagem {
  const base = novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Vagn Kane')
  return {
    ...base,
    descricao: 'Idade: 21',
    escolhas: { raca: 'Lunariano', oficio: 'Ferreiro' },
    recursos: { hp: 1000, sp: 120, escudo: 100 },
    atributos: { ...base.atributos, forca: 50, espirito: 2500 },
    abas: {
      ...base.abas,
      habilidades: [{ ...novoCartao('Habilidade'), nome: 'Martelo Lunar', campos: { descricao: 'Bate forte', custo: '-45 de SP', tempo: '' }, extras: [{ nome: 'Requisito', valor: 'Haki' }] }],
      pericias: [{ ...novoCartao('Perícia'), nome: 'Forjar', atributos: ['forca', 'percepcao'] }],
    },
  }
}

function digitar(input: HTMLInputElement, valor: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(input, valor)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function escolher(select: HTMLSelectElement, valor: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set
  act(() => {
    setter?.call(select, valor)
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

function botao(nome: string): HTMLButtonElement {
  const achado = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find((candidato) => candidato.textContent?.trim() === nome)
  if (achado === undefined) throw new Error(`botão "${nome}" não está na tela`)
  return achado
}

function rankDe(atributo: string): string | undefined {
  const linha = Array.from(document.body.querySelectorAll('.lb-ficha__atributo')).find((candidata) => candidata.textContent?.startsWith(atributo))
  return linha?.querySelector('.lb-ficha__rank')?.textContent ?? undefined
}

describe('FichaDePersonagemDialog', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function abrir(props: Partial<FichaDePersonagemDialogProps> = {}) {
    const onSalvar = vi.fn()
    const onClose = vi.fn()
    const onLigarToken = vi.fn()
    act(() =>
      root.render(
        <FichaDePersonagemDialog
          personagem={vagn()}
          sistema={SISTEMA_ONE_PIECE}
          sistemaId="one-piece"
          editandoNoInicio={false}
          onSalvar={onSalvar}
          onClose={onClose}
          escolherImagem={async () => null}
          tokens={[]}
          onLigarToken={onLigarToken}
          {...props}
        />,
      ),
    )
    return { onSalvar, onClose, onLigarToken }
  }

  it('mostra a ficha: chips de raça e ofício, nome com selo, recursos e atributos com rank', () => {
    abrir()
    const janela = document.body.querySelector('[role="dialog"]')
    expect(janela?.getAttribute('aria-labelledby')).not.toBeNull()
    expect(document.getElementById(janela?.getAttribute('aria-labelledby') ?? '')?.textContent).toBe('Vagn Kane')
    expect(Array.from(document.body.querySelectorAll('.lb-ficha__chips li')).map((li) => li.textContent)).toEqual(['Lunariano', 'Ferreiro'])
    expect(document.body.querySelector('.lb-ficha__selo')?.textContent).toBe('Jogador')
    expect(Array.from(document.body.querySelectorAll('.lb-ficha__recurso')).map((tile) => tile.textContent)).toEqual(['HP1000', 'SP120', 'Escudo100'])
    // Força 50: passou do limiar 40 (R2) e não chegou ao 90 (R3).
    expect(rankDe('Força')).toBe('R2')
    expect(rankDe('Espírito')).toBe('R13')
    expect(rankDe('Resistência')).toBe('R0')
  })

  it('a aba Habilidades mostra a descrição e só os campos preenchidos, com os extras depois', () => {
    abrir()
    const cartao = document.body.querySelector('.lb-cartao')
    expect(cartao?.querySelector('.lb-cartao__nome')?.textContent).toBe('Martelo Lunar')
    expect(cartao?.querySelector('.lb-cartao__paragrafo')?.textContent).toBe('Bate forte')
    expect(Array.from(cartao?.querySelectorAll('.lb-cartao__linha') ?? []).map((linha) => linha.textContent)).toEqual(['Custo:-45 de SP', 'Requisito:Haki'])
    act(() => botao('Perícias1').click())
    expect(document.body.querySelector('.lb-ficha__chip--atributos')?.textContent).toBe('FOR · PER')
    act(() => botao('Vantagens').click())
    expect(document.body.querySelector('.lb-ficha__vazio')?.textContent).toBe('Nenhuma vantagem.')
  })

  it('Editar → mudar a Força sobe o rank na hora; Salvar entrega a ficha com o número novo', () => {
    const { onSalvar } = abrir()
    act(() => botao('Editar').click())
    const forca = document.body.querySelector<HTMLInputElement>('input[aria-label="Força"], .lb-ficha__atributo input')
    if (forca === null) throw new Error('o campo de Força deveria existir')
    digitar(forca, '320')
    expect(rankDe('Força')).toBe('R5')
    act(() => botao('Salvar').click())
    expect(onSalvar).toHaveBeenCalledTimes(1)
    const salvo: Personagem = onSalvar.mock.calls[0][0]
    expect(salvo.atributos.forca).toBe(320)
    // De volta à leitura, com o rank novo.
    expect(document.body.querySelector('.lb-ficha__atributo input')).toBeNull()
  })

  it('apagar o número no meio da digitação não vira 0 nem NaN', () => {
    const { onSalvar } = abrir()
    act(() => botao('Editar').click())
    const forca = document.body.querySelector<HTMLInputElement>('.lb-ficha__atributo input')
    if (forca === null) throw new Error('o campo de Força deveria existir')
    digitar(forca, '')
    expect(forca.value).toBe('')
    digitar(forca, '9')
    act(() => botao('Salvar').click())
    expect(onSalvar.mock.calls[0][0].atributos.forca).toBe(9)
  })

  it('Cancelar joga o rascunho fora; Esc com mudança pergunta antes de fechar', () => {
    const { onSalvar, onClose } = abrir()
    act(() => botao('Editar').click())
    const nome = document.body.querySelector<HTMLInputElement>('.lb-ficha__bloco--edit input')
    if (nome === null) throw new Error('o campo Nome deveria existir')
    digitar(nome, 'Outro')
    const janela = document.body.querySelector<HTMLElement>('[role="dialog"]')
    act(() => janela?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(onClose).not.toHaveBeenCalled()
    expect(document.body.querySelector('[role="alert"]')?.textContent).toContain('mudanças que não foram salvas')
    act(() => botao('Continuar editando').click())
    act(() => botao('Cancelar').click())
    expect(onSalvar).not.toHaveBeenCalled()
    expect(document.body.querySelector('.lb-ficha__nome')?.textContent).toBe('Vagn Kane')
    act(() => janela?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('em edição, "+ Habilidade" cria um cartão aberto e o nome vazio do personagem vira "Personagem sem nome" ao salvar', () => {
    const { onSalvar } = abrir()
    act(() => botao('Editar').click())
    act(() => botao('+ Habilidade').click())
    const cartoes = document.body.querySelectorAll<HTMLDetailsElement>('details.lb-cartao--edit')
    expect(cartoes).toHaveLength(2)
    expect(cartoes[1].open).toBe(true)
    const nome = document.body.querySelector<HTMLInputElement>('.lb-ficha__bloco--edit input')
    if (nome === null) throw new Error('o campo Nome deveria existir')
    digitar(nome, '   ')
    act(() => botao('Salvar').click())
    const salvo: Personagem = onSalvar.mock.calls[0][0]
    expect(salvo.nome).toBe('Personagem sem nome')
    expect(salvo.abas.habilidades.map((cartao) => cartao.nome)).toEqual(['Martelo Lunar', 'Habilidade'])
  })

  it('"Ligar a um token" entrega o token escolhido e diz a quem ligou', () => {
    const { onLigarToken } = abrir({ tokens: [{ id: 't1', nome: 'Vagn', personagemId: null }, { id: 't2', nome: 'Barril', personagemId: 'outro' }] })
    const select = document.body.querySelector<HTMLSelectElement>('select[aria-label="Ligar a um token desta cena"]')
    if (select === null) throw new Error('o seletor de token deveria existir')
    escolher(select, 't1')
    expect(onLigarToken).toHaveBeenCalledWith('t1')
    expect(document.body.querySelector('.lb-ficha-janela__ligacao')?.textContent).toBe('Ligado a Vagn.')
  })

  it('sistema que não está no computador: avisa, não edita e não perde nada', () => {
    abrir({ sistema: undefined, sistemaId: 'dnd-5e' })
    expect(document.body.textContent).toContain('dnd-5e')
    expect(Array.from(document.body.querySelectorAll('button')).some((candidato) => candidato.textContent === 'Editar')).toBe(false)
  })
})
