import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { aplicarAjustes, NOME_DO_MESTRE } from '../lib/ajusteDaFicha'
import { novoCartao, novoPersonagem, type Personagem } from '../lib/personagem'
import { SISTEMA_ONE_PIECE } from '../lib/sistemaOnePiece'
import { FichaDePersonagemDialog } from './FichaDePersonagemDialog'

/**
 * AJUSTE RÁPIDO na janela do MESTRE: o HP abre o painel com −, + e o campo do
 * "-50"; a Força tem − e + na hora e o rank acompanha; a transformação liga
 * e soma; tudo vai na hora (sem Salvar) e fica no "Histórico". Em edição,
 * nada disso aparece: lá tudo é campo e espera o Salvar.
 */

beforeAll(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
})

const FORMA = { ...novoCartao('Transformação'), id: 'forma', nome: 'Forma Híbrida', modificadores: [{ atributo: 'forca', delta: 40 }] }

/** Vagn de antes dos ajustes: HP 1000 de um número só, Força 50 (R2). */
function vagn(): Personagem {
  const base = novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Vagn Kane')
  return { ...base, id: 'pers_vagn', recursos: { hp: 1000, sp: 120, escudo: 0 }, atributos: { ...base.atributos, forca: 50 }, abas: { ...base.abas, transformacoes: [FORMA] } }
}

/** A janela como o App a usa: o ajuste vai para a "aventura" (aqui, o estado) na hora, com o histórico do mestre. */
function MesaDoMestre({ onClose }: { onClose: () => void }) {
  const [personagem, setPersonagem] = useState(vagn)
  return (
    <FichaDePersonagemDialog
      personagem={personagem}
      sistema={SISTEMA_ONE_PIECE}
      sistemaId="one-piece"
      editandoNoInicio={false}
      onSalvar={setPersonagem}
      onClose={onClose}
      escolherImagem={async () => null}
      tokens={[]}
      onLigarToken={() => {}}
      onAjustar={(ajuste) => setPersonagem((atual) => aplicarAjustes(atual, SISTEMA_ONE_PIECE, [ajuste], NOME_DO_MESTRE, Date.now()))}
    />
  )
}

let container: HTMLDivElement
let root: Root
let onClose = vi.fn<() => void>()

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  onClose = vi.fn<() => void>()
  act(() => root.render(<MesaDoMestre onClose={onClose} />))
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function porRotulo(rotulo: string): HTMLElement {
  const achado = document.body.querySelector<HTMLElement>(`[aria-label="${rotulo}"]`)
  if (achado === null) throw new Error(`"${rotulo}" não está na tela`)
  return achado
}

const clicar = (rotulo: string, vezes = 1) => {
  for (let i = 0; i < vezes; i += 1) act(() => porRotulo(rotulo).click())
}

function campo(rotulo: string): HTMLInputElement {
  const achado = porRotulo(rotulo)
  if (!(achado instanceof HTMLInputElement)) throw new Error(`"${rotulo}" não é campo`)
  return achado
}

/** Digita como a pessoa: o texto troca e o Enter aplica. */
function digitarEEnter(input: HTMLInputElement, texto: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    input.focus()
    setter?.call(input, texto)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  act(() => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  })
}

const tecla = (alvo: Element, key: string) => act(() => void alvo.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })))
const quadrinhoDoHp = () => document.body.querySelector('.lb-ficha__recurso[data-tom="vida"]')?.textContent
const rankDaForca = () => Array.from(document.body.querySelectorAll('.lb-ficha__atributo')).find((linha) => linha.textContent?.startsWith('Força'))?.querySelector('.lb-ficha__rank')?.textContent

describe('ajuste rápido na janela do mestre', () => {
  it('tocar o HP abre o painel; "−" três vezes, "-50" e "+9999" valem na hora, dentro do máximo', () => {
    clicar('HP 1000 de 1000. Ajustar')
    expect(porRotulo('Ajustar HP')).toBe(document.activeElement)
    clicar('Diminuir HP', 3)
    expect(quadrinhoDoHp()).toBe('HP997/1000')
    digitarEEnter(campo('HP'), '-50')
    expect(quadrinhoDoHp()).toBe('HP947/1000')
    digitarEEnter(campo('HP'), '+9999')
    expect(quadrinhoDoHp()).toBe('HP1000/1000')
  })

  it('lixo no campo não muda nada e marca o campo; sair do campo volta ao valor', () => {
    clicar('HP 1000 de 1000. Ajustar')
    digitarEEnter(campo('HP'), 'abc')
    expect(campo('HP').getAttribute('aria-invalid')).toBe('true')
    expect(quadrinhoDoHp()).toBe('HP1000/1000')
    act(() => campo('HP').blur())
    expect([campo('HP').value, campo('HP').getAttribute('aria-invalid')]).toEqual(['1000', null])
  })

  it('máximo e modificador do HP: o máximo de verdade é a soma, e o atual não passa dele', () => {
    clicar('HP 1000 de 1000. Ajustar')
    digitarEEnter(campo('modificador do máximo de HP'), '+100')
    expect(quadrinhoDoHp()).toBe('HP1000/1100')
    expect(document.body.textContent).toContain('Máximo 1100 = 1000 base +100 mod')
    digitarEEnter(campo('HP máximo'), '500')
    expect(quadrinhoDoHp()).toBe('HP600/600')
  })

  it('Esc fecha só o painel (não a janela) e o foco volta ao quadrinho', () => {
    clicar('HP 1000 de 1000. Ajustar')
    tecla(porRotulo('Ajustar HP'), 'Escape')
    expect(document.body.querySelector('[aria-label="Ajustar HP"]')).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    expect(document.activeElement?.getAttribute('aria-label')).toBe('HP 1000 de 1000. Ajustar')
  })

  it('Força com − e + na hora; o rank acompanha; o modificador soma e a conta aparece', () => {
    expect(rankDaForca()).toBe('R2')
    clicar('Diminuir Força', 11)
    expect(rankDaForca()).toBe('R1')
    clicar('Aumentar Força')
    expect(rankDaForca()).toBe('R2')
    clicar('Força: 40 = 40 base. Conta e modificador')
    digitarEEnter(campo('modificador de Força'), '+50')
    expect(rankDaForca()).toBe('R3')
    expect(porRotulo('Ajustar Força').textContent).toContain('90 = 40 base +50 mod')
  })

  it('a transformação liga na hora, soma na Força e no rank, e o histórico diz quem fez', () => {
    act(() => {
      const aba = Array.from(document.body.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find((botao) => botao.textContent?.startsWith('Transformações'))
      aba?.click()
    })
    const ligar = porRotulo('Ativar Forma Híbrida')
    expect(ligar.getAttribute('aria-pressed')).toBe('false')
    act(() => ligar.click())
    expect(porRotulo('Ativar Forma Híbrida').getAttribute('aria-pressed')).toBe('true')
    expect(rankDaForca()).toBe('R3')
    // Escudo já no 0: o "−" no limite não muda nada, nem deixa linha.
    clicar('Diminuir Escudo')
    const historico = document.body.querySelector('.lb-ficha__historico')
    expect(historico?.querySelector('summary')?.textContent).toBe('Histórico 1')
    expect(historico?.querySelector('.lb-ficha__historico-item')?.textContent).toContain('ativou Forma Híbrida')
    expect(historico?.querySelector('.lb-ficha__historico-meta')?.textContent).toContain('Mestre')
  })

  it('dez "−" no mesmo instante são UMA linha do histórico', () => {
    clicar('HP 1000 de 1000. Ajustar')
    clicar('Diminuir HP', 10)
    const itens = Array.from(document.body.querySelectorAll('.lb-ficha__historico-texto')).map((item) => item.textContent)
    expect(itens).toEqual(['HP 1000 → 990'])
  })

  it('em edição não há ajuste rápido: os números são campos (atual, máximo, modificador) até o Salvar', () => {
    act(() => {
      const editar = Array.from(document.body.querySelectorAll('button')).find((botao) => botao.textContent === 'Editar')
      editar?.click()
    })
    expect(document.body.querySelector('[aria-label="Diminuir HP"], [aria-label="Aumentar Força"], [aria-label="Ativar Forma Híbrida"]')).toBeNull()
    expect(campo('HP máximo').value).toBe('1000')
    expect(campo('Modificador de Força').value).toBe('0')
  })
})
