import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PedidoDeReacao } from '../../lib/batalha/combate'
import { APLAUSO, may, sistema } from '../../lib/batalha/fichasDaFatiaB.testkit'
import { reacoesPorPerto } from '../../lib/batalha/reacaoComTecnica'
import { CaixaDeReacao, type ReacaoNaCaixa } from './CaixaDeReacao'

/**
 * Conserto das fichas F2, fatia B (o "perto" do Aplauso): a caixa da May
 * pelo aliado no 6x6 à frente dela. Só a técnica que rebate, e o pedido sai
 * com quem reage (`por`); o dado, o Não reagir e o Passar sem dano são do
 * alvo e não aparecem.
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

describe('CaixaDeReacao com a ficha que rebate de perto', () => {
  it('a May rebate pelo aliado: só "Usar Aplauso", e o pedido leva o token dela e a saída Contra', () => {
    const onPedir = vi.fn<(pedido: PedidoDeReacao) => boolean>(() => true)
    const reacao: ReacaoNaCaixa = {
      golpeId: 'golpe_1',
      tokenId: 'tok_aliado',
      alvo: 'Aliado da May',
      atacante: 'Jimboy Segundo',
      nome: 'Sai Dai Rin: Rokuogan',
      dano: 257,
      overload: true,
      por: { tokenId: 'tok_may', nome: 'May D. Ark' },
      tecnicas: reacoesPorPerto({ podeReagir: true }, may, sistema, undefined),
    }
    act(() => root.render(<CaixaDeReacao reacoes={[reacao]} onPedir={onPedir} />))
    const botoes = [...container.querySelectorAll('button')].map((botao) => botao.textContent ?? '')
    expect(botoes.some((texto) => texto.startsWith(`Usar ${APLAUSO.nome}`))).toBe(true)
    expect(botoes.some((texto) => texto.includes('Não reagir') || texto.includes('Rolar') || texto.includes('Passar sem'))).toBe(false)
    expect(container.textContent).toContain('Perto de May D. Ark')
    const usar = [...container.querySelectorAll('button')].find((botao) => (botao.textContent ?? '').startsWith('Usar'))
    act(() => usar?.click())
    expect(onPedir).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'tecnica', golpeId: 'golpe_1', tokenId: 'tok_aliado', cartaoId: APLAUSO.id, saida: 'contra', por: 'tok_may' }))
  })
})
