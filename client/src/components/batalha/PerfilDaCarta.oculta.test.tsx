import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { jimboy, QUEBRA_QUEIXO, sistema } from '../../lib/batalha/fichasDaFatiaB.testkit'
import { ocultarCartao } from '../../lib/habilidadeOculta'
import { PerfilDaCarta } from './PerfilDaCarta'

/**
 * O PERFIL DA CARTA e a habilidade oculta (fatia C7, revisão): o mestre
 * revela com um clique sem sair da batalha; o jogador nunca vê o botão.
 * Dados do kit da fatia B (inventados a partir das fichas de teste).
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

const ROTULO = `Revelar ${QUEBRA_QUEIXO.nome} aos jogadores`

describe('perfil da carta com cartão oculto', () => {
  it('o mestre vê "Revelar" e o clique pede a revelação daquele cartão; o perfil do jogador não tem o botão', () => {
    const oculto = ocultarCartao(jimboy, QUEBRA_QUEIXO.id, false)
    const pedidos: string[] = []
    act(() => root.render(<PerfilDaCarta personagem={oculto} sistema={sistema} onRevelar={(cartaoId) => pedidos.push(cartaoId)} onFechar={() => {}} />))
    const botao = document.body.querySelector(`button[aria-label="${ROTULO}"]`)
    expect(botao).not.toBeNull()
    act(() => botao?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(pedidos).toEqual([QUEBRA_QUEIXO.id])

    act(() => root.render(<PerfilDaCarta personagem={oculto} sistema={sistema} quemOlha="jogador" onRevelar={(cartaoId) => pedidos.push(cartaoId)} onFechar={() => {}} />))
    expect(document.body.querySelector(`button[aria-label="${ROTULO}"]`)).toBeNull()
  })
})
