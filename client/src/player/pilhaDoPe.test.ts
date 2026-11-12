import { describe, expect, it } from 'vitest'
import { FOLGA_DA_PILHA_PX, subidasDaPilha, type CaixaDaPilha } from './pilhaDoPe'

/** Uma caixa do pé: de `esquerda` a `direita` na janela, com o pé a `base` px do fundo. */
const caixa = (esquerda: number, direita: number, base: number, altura: number): CaixaDaPilha => ({ esquerda, direita, base, altura })

// Medidas do navegador (caça de 12/11/2026, FX-ROTA): 1280 x 800 e 390 x 844.
describe('pilha do pé', () => {
  it('o "Mostrar a…" sobe acima do "Aguardando o mestre…"; quem não cruza ninguém fica na casa', () => {
    const doca = caixa(578, 703, 72, 46)
    const viagem = caixa(513, 767, 68, 50)
    const item = caixa(528, 753, 24, 38)
    const doLado = caixa(0, 100, 72, 46)
    expect(subidasDaPilha([doca, viagem, item, doLado])).toEqual([68 + 50 + FOLGA_DA_PILHA_PX - 72, 0, 0, 0])
  })

  it('no celular, com a faixa da porta no chão, todos sobem em ordem de andar e nenhum cruza outro', () => {
    const porta = caixa(12, 324, 12, 106)
    const item = caixa(98, 293, 24, 59)
    const viagem = caixa(98, 293, 68, 82)
    const doca = caixa(133, 258, 72, 46)
    const pausa = caixa(98, 293, 112, 59)
    const pilha = [doca, viagem, porta, item, pausa]
    const subidas = subidasDaPilha(pilha)
    expect(subidas).toEqual([211, 125, 0, 102, 225])
    const postas = pilha.map((c, i) => ({ ...c, base: c.base + subidas[i] }))
    for (const [i, a] of postas.entries())
      for (const b of postas.slice(i + 1)) expect(Math.min(a.base + a.altura, b.base + b.altura) - Math.max(a.base, b.base)).toBeLessThanOrEqual(-FOLGA_DA_PILHA_PX)
  })
})
