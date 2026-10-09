import { describe, expect, it } from 'vitest'
import {
  ANGULO_PARADO,
  MOVIMENTO_DO_MARCADOR,
  camadasDaPose,
  desenharChao,
  desenharCorpo,
  desenharGiro,
  desenharMarcador,
  faseDoMarcador,
  poseMarcador,
  tomDaFace,
  type PincelDoMarcador,
} from './drawMarcadorDeContinente'

/** Pincel que só anota o que o desenho pediu, na ordem. */
function pincelDeTeste() {
  const chamadas: { metodo: string; args: unknown[] }[] = []
  const pincel: PincelDoMarcador = {
    clear() {
      chamadas.push({ metodo: 'clear', args: [] })
    },
    poly(...args) {
      chamadas.push({ metodo: 'poly', args })
      return pincel
    },
    ellipse(...args) {
      chamadas.push({ metodo: 'ellipse', args })
      return pincel
    },
    moveTo(...args) {
      chamadas.push({ metodo: 'moveTo', args })
      return pincel
    },
    lineTo(...args) {
      chamadas.push({ metodo: 'lineTo', args })
      return pincel
    },
    fill(...args) {
      chamadas.push({ metodo: 'fill', args })
      return pincel
    },
    stroke(...args) {
      chamadas.push({ metodo: 'stroke', args })
      return pincel
    },
  }
  const quantas = (metodo: string) => chamadas.filter((c) => c.metodo === metodo).length
  return { pincel, chamadas, quantas }
}

const VOLTA = 2 * Math.PI
const QUARTO_DE_VOLTA = Math.PI / 2

describe('poseMarcador: giro e flutuar', () => {
  it('gira linear: uma volta a cada 6 s, um quarto de volta em 1,5 s', () => {
    expect(MOVIMENTO_DO_MARCADOR.voltaMs).toBe(6000)
    expect(poseMarcador(0).angulo).toBeCloseTo(0)
    expect(poseMarcador(1500).angulo).toBeCloseTo(QUARTO_DE_VOLTA)
    expect(poseMarcador(3000).angulo).toBeCloseTo(Math.PI)
    // Linear: passos iguais de tempo dão passos iguais de ângulo.
    const a = poseMarcador(1000).angulo - poseMarcador(500).angulo
    const b = poseMarcador(4000).angulo - poseMarcador(3500).angulo
    expect(a).toBeCloseTo(b)
    // Volta inteira recomeça do zero, sem sair de [0, 2π).
    expect(poseMarcador(6000).angulo).toBeCloseTo(0)
    expect(poseMarcador(5999).angulo).toBeLessThan(VOLTA)
  })

  it('flutua 1,5 px para cima e para baixo, nunca mais que isso', () => {
    let maior = -Infinity
    let menor = Infinity
    for (let t = 0; t <= MOVIMENTO_DO_MARCADOR.flutuarMs; t += 10) {
      const { flutuar } = poseMarcador(t)
      maior = Math.max(maior, flutuar)
      menor = Math.min(menor, flutuar)
    }
    expect(maior).toBeCloseTo(1.5, 2)
    expect(menor).toBeCloseTo(-1.5, 2)
  })

  it('movimento reduzido: a pirâmide fica parada em 30° e o pino não flutua, em qualquer instante', () => {
    expect(ANGULO_PARADO).toBeCloseTo(Math.PI / 6)
    for (const t of [0, 1234, 99999]) {
      expect(poseMarcador(t, { reduzirMovimento: true, fase: 0.4 })).toEqual({ angulo: ANGULO_PARADO, flutuar: 0 })
    }
  })

  it('a fase desencontra os pinos: meia volta de fase = meia volta de ângulo', () => {
    expect(poseMarcador(0, { fase: 0.5 }).angulo).toBeCloseTo(Math.PI)
  })

  it('fase por ficha: estável, entre 0 e 1, e diferente entre fichas vizinhas', () => {
    expect(faseDoMarcador('t1')).toBe(faseDoMarcador('t1'))
    for (const id of ['t1', 't2', 'abc', '']) {
      expect(faseDoMarcador(id)).toBeGreaterThanOrEqual(0)
      expect(faseDoMarcador(id)).toBeLessThan(1)
    }
    expect(faseDoMarcador('t1')).not.toBe(faseDoMarcador('t2'))
  })

  it('camadas: subir puxa giro e corpo para cima e encolhe e clareia a sombra', () => {
    expect(camadasDaPose(0)).toEqual({ deslocY: -0, escalaChao: 1, alphaChao: 1 })
    const alto = camadasDaPose(1.5)
    expect(alto.deslocY).toBeLessThan(0)
    expect(alto.escalaChao).toBeLessThan(1)
    expect(alto.alphaChao).toBeLessThan(1)
  })
})

describe('desenho do pino', () => {
  it('chão: três elipses da sombra, sem traço', () => {
    const { pincel, quantas } = pincelDeTeste()
    desenharChao(pincel)
    expect(quantas('ellipse')).toBe(3)
    expect(quantas('fill')).toBe(3)
    expect(quantas('stroke')).toBe(0)
  })

  it('giro: só faces de frente, cada uma pintada e com aresta fina, mais o contorno da silhueta', () => {
    const { pincel, chamadas, quantas } = pincelDeTeste()
    desenharGiro(pincel, 0x64b5f6, 0)
    const faces = quantas('fill')
    // A pirâmide tem 5 faces: de frente aparecem entre 2 e 4, nunca todas.
    expect(faces).toBeGreaterThanOrEqual(2)
    expect(faces).toBeLessThan(5)
    // Uma aresta por face e o contorno da silhueta no fim.
    expect(quantas('stroke')).toBe(faces + 1)
    expect(quantas('poly')).toBe(faces + 1)
    const contorno = chamadas[chamadas.length - 1]
    expect(contorno.metodo).toBe('stroke')
    expect(contorno.args[0]).toMatchObject({ width: 1.5, alpha: 0.9 })
  })

  it('giro: a cor do jogador pinta as faces (tons dela, nunca a cor de outro)', () => {
    const azul = pincelDeTeste()
    const vermelho = pincelDeTeste()
    desenharGiro(azul.pincel, 0x64b5f6, 1)
    desenharGiro(vermelho.pincel, 0xe57373, 1)
    const cores = (c: { metodo: string; args: unknown[] }[]) => c.filter((x) => x.metodo === 'fill').map((x) => JSON.stringify(x.args[0]))
    expect(cores(azul.chamadas)).not.toEqual(cores(vermelho.chamadas))
  })

  it('corpo: o cristal pintado e o risco de brilho (moveTo, lineTo, traço branco)', () => {
    const { pincel, chamadas, quantas } = pincelDeTeste()
    desenharCorpo(pincel, 0x81c784)
    expect(quantas('fill')).toBeGreaterThan(0)
    expect(quantas('moveTo')).toBe(1)
    expect(quantas('lineTo')).toBe(3)
    const brilho = chamadas[chamadas.length - 1]
    expect(brilho.metodo).toBe('stroke')
    expect(brilho.args[0]).toMatchObject({ color: 0xffffff, cap: 'round' })
  })

  it('o pino inteiro limpa primeiro e desenha tudo acima do ponto do chão', () => {
    const { pincel, chamadas } = pincelDeTeste()
    desenharMarcador(pincel, 0xffd54f, poseMarcador(700))
    expect(chamadas[0].metodo).toBe('clear')
    const ys = chamadas
      .filter((c) => c.metodo === 'poly')
      .flatMap((c) => {
        const pontos = c.args[0]
        return Array.isArray(pontos) ? pontos.filter((_, i) => i % 2 === 1) : []
      })
    // Nada do sólido abaixo do chão; o topo do cristal ~46 px acima dele.
    expect(Math.max(...ys)).toBeLessThan(0)
    expect(Math.min(...ys)).toBeGreaterThan(-52)
  })

  it('tom da face: de frente para a luz clareia, de costas escurece', () => {
    const azul: readonly [number, number, number] = [0.4, 0.7, 0.96]
    expect(tomDaFace(azul, 1)[0]).toBeGreaterThan(azul[0])
    expect(tomDaFace(azul, -1)[0]).toBeLessThan(azul[0])
  })
})
