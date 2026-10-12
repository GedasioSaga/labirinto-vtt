import { describe, expect, it } from 'vitest'
import { bordasDoControle, criarFontesDasTrilhas, laneDaTecla, lanesDoControle, ROTULO_TECLA, startApertado, type ControleLido } from './entrada'

/** Controle de mentira com 17 botões, só os da lista apertados. */
function controle(apertados: number[], axes: number[] = [0, 0]): ControleLido {
  return { buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: apertados.includes(i) })), axes }
}

describe('teclado', () => {
  it('setas e WASD', () => {
    const codigos = ['ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowRight', 'KeyA', 'KeyS', 'KeyW', 'KeyD', 'KeyF']
    expect(codigos.map((c) => laneDaTecla(c, 'setas'))).toEqual([0, 1, 2, 3, 0, 1, 2, 3, -1])
  })

  it('setas e DFJK (D é ← aqui, → no WASD)', () => {
    const codigos = ['KeyD', 'KeyF', 'KeyJ', 'KeyK', 'KeyA', 'ArrowUp']
    expect(codigos.map((c) => laneDaTecla(c, 'dfjk'))).toEqual([0, 1, 2, 3, -1, 2])
  })

  it('nome de propriedade do objeto não vira trilha', () => {
    expect(laneDaTecla('toString', 'setas')).toBe(-1)
    expect(laneDaTecla('__proto__', 'dfjk')).toBe(-1)
    expect(laneDaTecla('', 'setas')).toBe(-1)
  })

  it('rótulos dos botões da pista', () => {
    expect(ROTULO_TECLA.setas).toEqual(['A', 'S', 'W', 'D'])
    expect(ROTULO_TECLA.dfjk).toEqual(['D', 'F', 'J', 'K'])
  })
})

describe('controle', () => {
  it('direcional e losango de botões na mesma posição das setas', () => {
    const trilhas = [12, 13, 14, 15, 0, 1, 2, 3].map((b) => lanesDoControle(controle([b])).indexOf(true))
    expect(trilhas).toEqual([2, 1, 0, 3, 1, 3, 0, 2])
  })

  it('analógico esquerdo além de meio curso', () => {
    const eixos = [[-1, 0], [1, 0], [0, -1], [0, 1]].map((a) => lanesDoControle({ buttons: [], axes: a }).indexOf(true))
    expect(eixos).toEqual([0, 3, 2, 1])
    expect(lanesDoControle({ buttons: [], axes: [0.4, -0.4] })).toEqual([false, false, false, false])
  })

  it('LB e RB valem ← e →; controle sem eixos nem botões não aperta nada', () => {
    expect(lanesDoControle(controle([4]))).toEqual([true, false, false, false])
    expect(lanesDoControle(controle([5]))).toEqual([false, false, false, true])
    expect(lanesDoControle({ buttons: [null, undefined], axes: [] })).toEqual([false, false, false, false])
  })

  it('Start é o botão 9', () => {
    expect(startApertado(controle([9]))).toBe(true)
    expect(startApertado(controle([0]))).toBe(false)
    expect(startApertado({ buttons: [], axes: [] })).toBe(false)
  })

  it('bordas entre duas leituras', () => {
    expect(bordasDoControle([false, true, false, false], [true, false, false, false])).toEqual({ apertou: [0], soltou: [1] })
    expect(bordasDoControle([true, true, true, true], [true, true, true, true])).toEqual({ apertou: [], soltou: [] })
  })
})

describe('quem segura cada trilha', () => {
  it('a mesma fonte apertando de novo não conta', () => {
    const f = criarFontesDasTrilhas()
    expect(f.apertou(0, 'kArrowLeft')).toBe(true)
    expect(f.apertou(0, 'kArrowLeft')).toBe(false)
  })

  it('a trilha só solta quando a última fonte solta', () => {
    const f = criarFontesDasTrilhas()
    f.apertou(2, 'kArrowUp')
    f.apertou(2, 'g0')
    expect(f.soltou(2, 'kArrowUp')).toBe(false)
    expect(f.soltou(2, 'g0')).toBe(true)
    expect(f.soltou(2, 'g0')).toBe(false)
  })

  it('soltar quem não apertou não solta nada', () => {
    const f = criarFontesDasTrilhas()
    expect(f.soltou(1, 'p7')).toBe(false)
  })

  it('limpar solta tudo e diz quais trilhas estavam seguras', () => {
    const f = criarFontesDasTrilhas()
    f.apertou(1, 'p7')
    f.apertou(3, 'kKeyD')
    expect(f.limpar()).toEqual([1, 3])
    expect(f.limpar()).toEqual([])
    expect(f.apertou(1, 'p7')).toBe(true)
  })
})
