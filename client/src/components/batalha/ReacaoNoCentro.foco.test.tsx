import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { PedidoDeReacao } from '../../lib/batalha/combate'
import { useReacaoNoCentro } from './centroDaReacao'
import { ReacaoNoCentro } from './ReacaoNoCentro'
import { ReacoesPendentes, type PendenteNaTela } from './ReacoesPendentes'

/**
 * Auditoria de 10/11 (a carta REAÇÃO no centro): a carta que abre sozinha não
 * rouba o foco de quem digita (o Enter seguinte rolaria o d20 sem querer). Com
 * o foco no corpo da página ela pega o foco; aberta pelo mestre (a linha da
 * aba Batalha), sempre.
 */
let container: HTMLDivElement
let root: Root
let campo: HTMLInputElement

const golpe = (golpeId: string, alvo: string): PendenteNaTela => ({
  golpeId,
  tokenId: `tok_${golpeId}`,
  alvo,
  atacante: 'Sapo',
  nome: 'Espada Lendária Enferrujada',
  dano: 12,
  doMestre: true,
  perfurante: false,
})

/** O Enter do navegador: no botão com o foco, ele aperta; em qualquer outro lugar, a tecla só passa. */
function apertarEnter(): void {
  const ativo = document.activeElement
  if (ativo === null) return
  act(() => {
    const solta = ativo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    if (solta && ativo instanceof HTMLButtonElement) ativo.click()
  })
}

const rolar = () => [...container.querySelectorAll('button')].find((botao) => botao.textContent === 'Rolar 1d20') ?? null
const rolou = (onPedir: Mock<(pedido: PedidoDeReacao) => boolean>) => onPedir.mock.calls.some(([pedido]) => pedido.tipo === 'rolar')

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  useReacaoNoCentro.setState({ escolhida: null, recolhida: false, naFrente: false, noCentro: null, foco: 0 })
  // A nota do mestre, fora da batalha (o painel da esquerda).
  campo = document.createElement('input')
  campo.type = 'text'
  campo.setAttribute('aria-label', 'Nota')
  document.body.appendChild(campo)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  campo.remove()
})

describe('ReacaoNoCentro: o foco ao abrir', () => {
  it('digitando num campo, o golpe novo abre a carta sem tirar o foco dele, e o Enter não rola', () => {
    const onPedir = vi.fn<(pedido: PedidoDeReacao) => boolean>(() => true)
    campo.focus()
    act(() => root.render(<ReacaoNoCentro itens={[golpe('g1', 'Alce 1')]} onPedir={onPedir} />))
    expect(rolar()).not.toBeNull()
    expect(document.activeElement).toBe(campo)
    expect(container.querySelector('.bt-reacao-no-centro')?.getAttribute('data-chamadas')).toBe('1')
    apertarEnter()
    apertarEnter()
    expect(rolou(onPedir)).toBe(false)

    // A seguinte da fila também não: a primeira resolve e a outra sobe com o mestre ainda no campo.
    act(() => root.render(<ReacaoNoCentro itens={[golpe('g1', 'Alce 1'), golpe('g2', 'Alce 2')]} onPedir={onPedir} />))
    act(() => root.render(<ReacaoNoCentro itens={[golpe('g2', 'Alce 2')]} onPedir={onPedir} />))
    expect(container.textContent).toContain('Alce 2')
    expect(document.activeElement).toBe(campo)
    apertarEnter()
    expect(rolou(onPedir)).toBe(false)
  })

  it('com o foco no corpo da página, a carta pega o foco no Rolar 1d20', () => {
    const onPedir = vi.fn<(pedido: PedidoDeReacao) => boolean>(() => true)
    expect(document.activeElement).toBe(document.body)
    act(() => root.render(<ReacaoNoCentro itens={[golpe('g1', 'Alce 1')]} onPedir={onPedir} />))
    expect(document.activeElement).toBe(rolar())
    expect(container.querySelector('.bt-reacao-no-centro')?.hasAttribute('data-chamadas')).toBe(false)
    apertarEnter()
    expect(onPedir).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'rolar', golpeId: 'g1', tokenId: 'tok_g1' }))
  })

  it('a linha da aba Batalha traz a reação com o foco, mesmo com o mestre num campo; a chave perfurante diz o alvo', () => {
    const onPedir = vi.fn<(pedido: PedidoDeReacao) => boolean>(() => true)
    const itens = [golpe('g1', 'Alce 1'), golpe('g2', 'Alce 2')]
    campo.focus()
    act(() =>
      root.render(
        <>
          <ReacaoNoCentro itens={itens} onPedir={onPedir} />
          <ReacoesPendentes itens={itens} onPedir={onPedir} onTrocarPerfurante={() => true} />
        </>,
      ),
    )
    expect(document.activeElement).toBe(campo)
    const linhas = [...container.querySelectorAll<HTMLButtonElement>('.bt-pendente--linha')]
    expect(linhas).toHaveLength(2)
    // A linha da que já está no centro: nada remonta, o foco vem do pedido mesmo assim.
    act(() => linhas[0]?.click())
    expect(document.activeElement).toBe(rolar())
    campo.focus()
    act(() => linhas[1]?.click())
    expect(container.querySelector('.bt-reacao-no-centro')?.textContent).toContain('Alce 2')
    expect(document.activeElement).toBe(rolar())
    const rotulos = [...container.querySelectorAll('.bt-chave')].map((chave) => chave.textContent)
    expect(rotulos).toEqual(['Espada Lendária Enferrujada em Alce 1: perfurante', 'Espada Lendária Enferrujada em Alce 2: perfurante'])
  })
})
