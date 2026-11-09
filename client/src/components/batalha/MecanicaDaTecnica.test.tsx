import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ficha, sistema } from '../../lib/batalha/fichasDaFatiaB.testkit'
import { lerMecanica } from '../../lib/batalha/mecanica/modelo'
import { guardarMecanica, mecanicaDoModelo } from '../../lib/batalha/mecanica/modelos'
import { novoCartao, type CartaoDaFicha } from '../../lib/personagem'
import { MecanicaDaTecnica } from './MecanicaDaTecnica'

/**
 * A TELA DE MONTAR A MECÂNICA (construtor, revisão da fatia C2): a peça pela
 * metade não entra no cartão que o Salvar grava, e o bloco não fecha sozinho
 * embaixo do cursor quando o conteúdo dele muda. Dados inventados.
 */

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
})

const marinheiro = ficha('Marinheiro de Teste', { forca: 60 }, { hp: 500, sp: 100, escudo: 0 }, {})
const ESPADADA: CartaoDaFicha = { ...novoCartao('Espadada de Teste'), id: 'cart_espadada', mecanica: guardarMecanica(mecanicaDoModelo('golpe', sistema)) }

/** A janela da ficha: guarda o cartão em edição e registra cada mudança que chegaria ao Salvar. */
function montar(): CartaoDaFicha[] {
  const mudancas: CartaoDaFicha[] = []
  function Janela() {
    const [cartao, setCartao] = useState(ESPADADA)
    const mudar = (novo: CartaoDaFicha) => {
      mudancas.push(novo)
      setCartao(novo)
    }
    return <MecanicaDaTecnica cartao={cartao} ficha={{ personagem: marinheiro, sistema }} quemEdita="mestre" tecnicas={[cartao]} onChange={mudar} />
  }
  act(() => root.render(<Janela />))
  return mudancas
}

const botao = (texto: string) => [...container.querySelectorAll('button')].find((item) => item.textContent === texto)
const daDano = () => [...container.querySelectorAll('label')].find((item) => item.textContent === 'Dá dano')?.querySelector('input')
const blocos = () => [...container.querySelectorAll('details')]

describe('tela de montar a mecânica', () => {
  it('desmarca e marca "Dá dano" (fórmula vazia): o cartão fica com a última versão que vale, o aviso diz isso, e o rascunho volta ao reabrir', () => {
    const mudancas = montar()
    act(() => botao('Editar a mecânica')?.click())
    act(() => daDano()?.click())
    act(() => daDano()?.click())
    const ultima = mudancas.at(-1)
    expect(mudancas).toHaveLength(1)
    expect(ultima?.mecanica).not.toHaveProperty('dano')
    expect(lerMecanica(ultima?.mecanica).tipo).toBe('pecas')
    expect(container.textContent).toContain('Ainda não vale na batalha: falta a fórmula do dano. Até completar, a ficha guarda a última versão completa.')
    act(() => botao('Fechar o editor')?.click())
    expect(container.textContent).toContain('O que você montou por último não entrou na ficha: falta a fórmula do dano.')
    act(() => botao('Editar a mecânica')?.click())
    expect(daDano()?.checked).toBe(true)
  })

  it('desmarcar "Dá dano" não fecha o bloco 5 embaixo do cursor: o bloco segue aberto e o foco fica na caixa', () => {
    montar()
    act(() => botao('Editar a mecânica')?.click())
    expect(blocos()[4]?.open).toBe(true)
    const caixa = daDano()
    act(() => caixa?.focus())
    act(() => caixa?.click())
    expect(caixa?.checked).toBe(false)
    expect(blocos()[4]?.open).toBe(true)
    expect(document.activeElement).toBe(caixa)
  })
})
