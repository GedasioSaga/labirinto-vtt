import { afterEach, describe, expect, it } from 'vitest'
import { assinarPeriodoDaSombra, definirPeriodoDaSombra, DIRECAO_DA_SOMBRA, forcaDaSombra, forcaDaSombraAgora, FORCA_DA_SOMBRA } from './sombra'

/** A sombra única (Fase 6, 16/11/2026): uma direção, uma cor e uma força, mais fraca à tarde e à noite. */

afterEach(() => definirPeriodoDaSombra('dia'))

describe('a sombra única', () => {
  it('a direção é a do relevo (7, 11), de comprimento 1: de cima à esquerda para baixo à direita', () => {
    expect(Math.hypot(DIRECAO_DA_SOMBRA.x, DIRECAO_DA_SOMBRA.y)).toBeCloseTo(1, 10)
    expect(DIRECAO_DA_SOMBRA.y / DIRECAO_DA_SOMBRA.x).toBeCloseTo(11 / 7, 10)
  })

  it('a força cai à tarde e mais à noite', () => {
    expect(forcaDaSombra('dia')).toBe(FORCA_DA_SOMBRA)
    expect(forcaDaSombra('tarde')).toBeLessThan(forcaDaSombra('dia'))
    expect(forcaDaSombra('noite')).toBeLessThan(forcaDaSombra('tarde'))
  })

  it('a troca do período da tela avisa uma vez, e a força de agora acompanha', () => {
    let avisos = 0
    const parar = assinarPeriodoDaSombra(() => {
      avisos += 1
    })
    definirPeriodoDaSombra('noite')
    definirPeriodoDaSombra('noite')
    expect(avisos).toBe(1)
    expect(forcaDaSombraAgora()).toBe(forcaDaSombra('noite'))
    parar()
    definirPeriodoDaSombra('tarde')
    expect(avisos).toBe(1)
  })
})
