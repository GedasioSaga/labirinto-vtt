/**
 * A BIBLIOTECA INICIAL medida, não só olhada: cada ladrilho
 * - repete sem emenda (a diferença entre a última coluna e a primeira é a de
 *   duas colunas vizinhas quaisquer);
 * - não estoura: sem branco puro, saturação no máximo a das cores de bioma do
 *   mapa do usuário (a mais forte, o #bd993f das dunas, tem croma 0,49), e o
 *   contraste de luz contido;
 * - não tem listra fina: a variação de pixel para pixel é pequena e parecida
 *   nas duas direções;
 * - sai igual toda vez (cada tela pinta a sua, e todas precisam ver o mesmo).
 */
import { describe, expect, it } from 'vitest'
import { TEXTURAS_EMBUTIDAS } from './embutidas'
import { pixelsDoLadrilho } from './ladrilhos'

/** Mede na metade da resolução de verdade de cada ladrilho (256 → 128, 512 → 256): o mesmo pixel em toda textura. */
const LADO_PADRAO = 256

interface Medidas {
  emendaX: number
  emendaY: number
  vizinhoX: number
  vizinhoY: number
  maiorCanal: number
  cromaMedia: number
  cromaMaxima: number
  desvioDaLuz: number
  faixaDaLuz: number
}

function luzDe(d: Uint8ClampedArray, i: number): number {
  return (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255
}

function medir(d: Uint8ClampedArray, lado: number): Medidas {
  const L = (x: number, y: number) => luzDe(d, (y * lado + x) * 4)
  let emendaX = 0
  let emendaY = 0
  let vizinhoX = 0
  let vizinhoY = 0
  for (let k = 0; k < lado; k += 1) {
    emendaX += Math.abs(L(lado - 1, k) - L(0, k))
    emendaY += Math.abs(L(k, lado - 1) - L(k, 0))
  }
  for (let y = 0; y < lado; y += 1) {
    for (let x = 0; x < lado - 1; x += 1) {
      vizinhoX += Math.abs(L(x + 1, y) - L(x, y))
      vizinhoY += Math.abs(L(y, x + 1) - L(y, x))
    }
  }
  const luzes: number[] = []
  let maiorCanal = 0
  let somaCroma = 0
  let cromaMaxima = 0
  for (let i = 0; i < d.length; i += 4) {
    maiorCanal = Math.max(maiorCanal, d[i], d[i + 1], d[i + 2])
    const croma = (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2])) / 255
    somaCroma += croma
    cromaMaxima = Math.max(cromaMaxima, croma)
    luzes.push(luzDe(d, i))
  }
  const media = luzes.reduce((a, b) => a + b, 0) / luzes.length
  const desvio = Math.sqrt(luzes.reduce((a, b) => a + (b - media) ** 2, 0) / luzes.length)
  const ordem = [...luzes].sort((a, b) => a - b)
  const faixa = ordem[Math.floor(ordem.length * 0.99)] - ordem[Math.floor(ordem.length * 0.01)]
  return {
    emendaX: emendaX / lado,
    emendaY: emendaY / lado,
    vizinhoX: vizinhoX / (lado * (lado - 1)),
    vizinhoY: vizinhoY / (lado * (lado - 1)),
    maiorCanal,
    cromaMedia: somaCroma / (d.length / 4),
    cromaMaxima,
    desvioDaLuz: desvio,
    faixaDaLuz: faixa,
  }
}

describe('biblioteca inicial de texturas', () => {
  it('tem as treze texturas pedidas (os chãos de masmorra no fim), com id e nome únicos', () => {
    const ids = TEXTURAS_EMBUTIDAS.map((t) => t.id)
    expect(ids).toEqual(['areia', 'duna', 'grama', 'floresta', 'bosque', 'pinheiros', 'chao-de-floresta', 'pantano', 'terra', 'pedra', 'neve', 'conves', 'lajotas'])
    expect(new Set(TEXTURAS_EMBUTIDAS.map((t) => t.nome)).size).toBe(ids.length)
  })

  for (const textura of TEXTURAS_EMBUTIDAS) {
    describe(textura.nome, () => {
      const LADO = (textura.lado ?? LADO_PADRAO) / 2
      const pixels = pixelsDoLadrilho(textura.cor, LADO)
      const m = medir(pixels, LADO)

      it('repete sem emenda nas duas direções', () => {
        // A emenda é só mais um par de vizinhos: no máximo 1,6 vez a média deles (e algum ruído de amostra).
        expect(m.emendaX).toBeLessThanOrEqual(m.vizinhoX * 1.6 + 0.004)
        expect(m.emendaY).toBeLessThanOrEqual(m.vizinhoY * 1.6 + 0.004)
      })

      it('não estoura: sem branco puro, saturação e contraste contidos', () => {
        expect(m.maiorCanal).toBeLessThanOrEqual(245)
        expect(m.cromaMaxima).toBeLessThanOrEqual(0.5)
        expect(m.cromaMedia).toBeLessThanOrEqual(0.42)
        expect(m.desvioDaLuz).toBeLessThanOrEqual(0.09)
        expect(m.faixaDaLuz).toBeLessThanOrEqual(0.4)
      })

      it('não tem listra fina: pouca variação de pixel a pixel, igual nas duas direções', () => {
        expect(m.vizinhoX).toBeLessThanOrEqual(0.035)
        expect(m.vizinhoY).toBeLessThanOrEqual(0.035)
        if (textura.casas !== undefined) {
          // Chão desenhado (tábua, lajota): a junta se repete numa direção por
          // natureza. Em troca, ela tem de ser macia: metade da variação de
          // pixel a pixel que as outras podem ter, nas duas direções.
          expect(Math.max(m.vizinhoX, m.vizinhoY)).toBeLessThanOrEqual(0.0175)
          return
        }
        const razao = m.vizinhoX / m.vizinhoY
        expect(razao).toBeGreaterThan(0.6)
        expect(razao).toBeLessThan(1 / 0.6)
      })

      it('sai igual toda vez, e a volta inteira (u + 1) cai na mesma cor', () => {
        expect(pixelsDoLadrilho(textura.cor, 16)).toEqual(pixelsDoLadrilho(textura.cor, 16))
        for (const [u, v] of [
          [0.13, 0.71],
          [0.5, 0.02],
          [0.97, 0.44],
        ]) {
          const a = textura.cor(u, v)
          const b = textura.cor(u + 1, v + 1)
          for (const desloca of [16, 8, 0]) expect(Math.abs(((a >> desloca) & 255) - ((b >> desloca) & 255))).toBeLessThanOrEqual(2)
        }
      })
    })
  }
})

/** Fração dos pixels (amostrados numa grade de 128×128) cujo vermelho fica abaixo de `limite`. */
function fracaoComVermelhoAbaixo(cor: (u: number, v: number) => number, limite: number): number {
  const n = 128
  let conta = 0
  for (let y = 0; y < n; y += 1) for (let x = 0; x < n; x += 1) if (((cor((x + 0.5) / n, (y + 0.5) / n) >> 16) & 255) < limite) conta += 1
  return conta / (n * n)
}

function texturaDe(id: string) {
  const t = TEXTURAS_EMBUTIDAS.find((x) => x.id === id)
  if (t === undefined) throw new Error(`a textura ${id} sumiu da biblioteca`)
  return t
}

describe('Bosque e Pântano (pedido de 10/10/2026)', () => {
  it('Bosque: as copas da Floresta, espaçadas, com o capim aparecendo entre elas', () => {
    // A copa tem o vermelho baixo das cores da Floresta (#177c5c...); o capim, não.
    const copa = fracaoComVermelhoAbaixo(texturaDe('bosque').cor, 56)
    expect(copa).toBeGreaterThan(0.15)
    expect(copa).toBeLessThan(0.45)
    // A Floresta continua fechada: quase tudo é copa.
    expect(fracaoComVermelhoAbaixo(texturaDe('floresta').cor, 56)).toBeGreaterThan(0.9)
  })

  it('Pântano: água em parte do chão (nem lago nem campo), com período três vezes o de antes', () => {
    // A água (#2f6b66, #3d7f77) tem o vermelho bem abaixo do mato (#5c8f71, #6f9673).
    const agua = fracaoComVermelhoAbaixo(texturaDe('pantano').cor, 66)
    expect(agua).toBeGreaterThan(0.2)
    expect(agua).toBeLessThan(0.5)
    expect(texturaDe('pantano').escala).toBeGreaterThanOrEqual(3 * 48)
  })

  it('Chão de floresta: o verde escuro do mapa (#1f3a1f), sem copa nem preto, e de contraste baixo', () => {
    const lado = 128
    const d = pixelsDoLadrilho(texturaDe('chao-de-floresta').cor, lado)
    const m = medir(d, lado)
    // Escuro, mas não preto: a luz média perto da do #1f3a1f (~0,19).
    const luzMedia = Array.from({ length: lado * lado }, (_, k) => luzDe(d, k * 4)).reduce((a, b) => a + b, 0) / (lado * lado)
    expect(luzMedia).toBeGreaterThan(0.15)
    expect(luzMedia).toBeLessThan(0.26)
    // Contraste baixo (pino, nome e ficha leem por cima): bem abaixo do limite das outras.
    expect(m.desvioDaLuz).toBeLessThan(0.03)
    expect(m.faixaDaLuz).toBeLessThan(0.12)
  })

  it('ladrilho grande só com mais pixels: nenhuma textura fica com menos de 3,5 pixels por px do protótipo', () => {
    for (const t of TEXTURAS_EMBUTIDAS) expect((t.lado ?? LADO_PADRAO) / t.escala).toBeGreaterThanOrEqual(3.5)
  })
})

describe('chãos de masmorra, medidos em casas da grade', () => {
  const luzDaCor = (c: number) => (0.2126 * ((c >> 16) & 255) + 0.7152 * ((c >> 8) & 255) + 0.0722 * (c & 255)) / 255

  it('Convés: quatro tábuas por casa (a junta escurece entre elas), oito casas por ladrilho', () => {
    const conves = texturaDe('conves')
    expect(conves.casas).toBe(8)
    const filas = 8 * 4
    let juntaMaisEscura = 0
    let total = 0
    for (let k = 0; k < filas; k += 1) {
      for (const u of [0.11, 0.37, 0.62, 0.89]) {
        // Com a meia tábua de deslocamento, a junta da fila k fica em (k - 0,5)/32 e o meio da tábua em k/32.
        const junta = luzDaCor(conves.cor(u, (k + 0.5) / filas))
        const meio = luzDaCor(conves.cor(u, k / filas))
        if (junta < meio) juntaMaisEscura += 1
        total += 1
      }
    }
    expect(juntaMaisEscura / total).toBeGreaterThan(0.9)
  })

  it('Lajotas: pedra clara (entre o cinza e o bege), sem branco', () => {
    const d = pixelsDoLadrilho(texturaDe('lajotas').cor, 128)
    let soma = 0
    for (let i = 0; i < d.length; i += 4) soma += luzDe(d, i)
    const media = soma / (d.length / 4)
    expect(media).toBeGreaterThan(0.7)
    expect(media).toBeLessThan(0.85)
  })
})
