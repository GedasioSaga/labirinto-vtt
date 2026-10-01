import { describe, expect, it } from 'vitest'
import { lerPlayerCss, px, regraBase, variaveis } from './cssDoJogador.testkit'

/**
 * Junção de duas features no MESMO canto da tela do jogador: o zoom (+ e −,
 * `zoom-no-celular`) e a mão de CHAMAR O MESTRE (`chamar-o-mestre`) moram
 * embaixo à direita. A mão tem `z-index` maior: no mesmo lugar ela cobria o
 * botão "−" e o toque no zoom ia para a mão. O jsdom não desenha nem faz
 * hit-test, então a prova é a geometria da regra no player.css: a mão começa
 * acima do topo do grupo do zoom. As duas bases saem da régua do HUD (as
 * variáveis do `:root` do player.css), resolvidas aqui como na tela.
 */
describe('canto de baixo à direita da tela do jogador: zoom e "chamar o mestre"', () => {
  it('a mão fica ACIMA do grupo do zoom, sem cobrir o "−"', async () => {
    const css = await lerPlayerCss()
    const v = variaveis(css)
    const zoom = regraBase(css, '.pp-zoom')
    const botao = regraBase(css, '.pp-zoom__button')
    const filete = regraBase(css, '.pp-zoom__button + .pp-zoom__button')
    const mao = regraBase(css, '.pp-call')
    // A premissa: os dois no mesmo canto, fixos na tela.
    expect(mao.get('position')).toBe('fixed')
    expect(zoom.get('position')).toBe('fixed')
    expect(px(mao.get('right'), v)).toBe(px(zoom.get('right'), v))
    // Topo do zoom: a distância do fundo, os dois botões e a borda de cima e de baixo (o filete do meio mora dentro do botão de baixo).
    expect(filete.get('border-top') ?? '').toMatch(/^1px /)
    const topoDoZoom = px(zoom.get('bottom'), v) + 2 * px(botao.get('height')) + 2 * px((zoom.get('border') ?? '').split(' ')[0])
    expect(px(mao.get('bottom'), v)).toBeGreaterThan(topoDoZoom)
  })
})
