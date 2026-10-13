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

/** O nome que o painel mostra: o da textura e, quando ela é uma forma de um grupo, o da forma. */
function rotulo(t: (typeof TEXTURAS_EMBUTIDAS)[number]): string {
  return t.forma === undefined ? t.nome : `${t.nome} (${t.forma.nome})`
}

describe('biblioteca inicial de texturas', () => {
  it('tem as texturas pedidas (os chãos de masmorra no fim), com id e nome únicos', () => {
    const ids = TEXTURAS_EMBUTIDAS.map((t) => t.id)
    expect(ids).toEqual(['areia', 'duna', 'grama', 'grama-amarela', 'floresta', 'bosque', 'pinheiros', 'chao-de-floresta', 'pantano', 'terra', 'pedra', 'neve', 'conves', 'lajotas', 'lajotas-escuras', 'calcamento'])
    // As formas de um grupo dividem o nome do cartão; o nome da forma as separa.
    expect(new Set(TEXTURAS_EMBUTIDAS.map(rotulo)).size).toBe(ids.length)
  })

  for (const textura of TEXTURAS_EMBUTIDAS) {
    describe(rotulo(textura), () => {
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

/** FNV-1a de 32 bits dos pixels: a impressão digital do ladrilho. */
function impressaoDigital(d: Uint8ClampedArray): number {
  let h = 0x811c9dc5
  for (let i = 0; i < d.length; i += 1) h = Math.imul(h ^ d[i], 0x01000193) >>> 0
  return h
}

describe('Lajotas de pedra em duas formas, Clara e Escura (pedido de 10/10/2026)', () => {
  it('as duas formam o grupo "lajotas": a clara primeiro, com o mesmo nome de cartão', () => {
    expect(texturaDe('lajotas').forma).toEqual({ grupo: 'lajotas', nome: 'Clara' })
    expect(texturaDe('lajotas-escuras').forma).toEqual({ grupo: 'lajotas', nome: 'Escura' })
    expect(texturaDe('lajotas-escuras').nome).toBe(texturaDe('lajotas').nome)
    expect(texturaDe('lajotas-escuras').casas).toBe(texturaDe('lajotas').casas)
    expect(texturaDe('lajotas-escuras').lado).toBe(texturaDe('lajotas').lado)
  })

  it('a Clara é pixel a pixel a de antes: mapa salvo com Lajotas não muda', () => {
    // Medida na versão de 3ee11a2b, antes da forma Escura existir.
    expect(impressaoDigital(pixelsDoLadrilho(texturaDe('lajotas').cor, 128))).toBe(1658562967)
  })

  it('a Escura é grafite neutro: escura sem ser preta, sem tom, a junta mais escura que a pedra', () => {
    const escura = texturaDe('lajotas-escuras')
    const d = pixelsDoLadrilho(escura.cor, 128)
    let soma = 0
    let menorCanal = 255
    let maiorCroma = 0
    for (let i = 0; i < d.length; i += 4) {
      soma += luzDe(d, i)
      menorCanal = Math.min(menorCanal, d[i], d[i + 1], d[i + 2])
      maiorCroma = Math.max(maiorCroma, Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]))
    }
    const media = soma / (d.length / 4)
    // A pedra #4a4946 tem luz ~0,28; a junta #353432 puxa um pouco para baixo.
    expect(media).toBeGreaterThan(0.24)
    expect(media).toBeLessThan(0.31)
    // Sem preto: nem a junta desce do #282828.
    expect(menorCanal).toBeGreaterThanOrEqual(0x28)
    // Grafite neutro: no máximo uns poucos níveis entre o canal maior e o menor.
    expect(maiorCroma).toBeLessThanOrEqual(8)
    // A junta horizontal (entre duas filas) escurece a pedra, nunca clareia.
    const filas = 16
    let juntaMaisEscura = 0
    let total = 0
    for (let k = 0; k < filas; k += 1) {
      for (const u of [0.11, 0.37, 0.62, 0.89]) {
        // Com a meia fila de deslocamento, a junta da fila k fica em (k + 0,5)/16 e o meio da lajota em k/16.
        const junta = luzDaCor(escura.cor(u, (k + 0.5) / filas))
        const meio = luzDaCor(escura.cor(u, k / filas))
        if (junta < meio) juntaMaisEscura += 1
        total += 1
      }
    }
    expect(juntaMaisEscura / total).toBeGreaterThan(0.9)
  })
})

function luzDaCor(c: number): number {
  return (0.2126 * ((c >> 16) & 255) + 0.7152 * ((c >> 8) & 255) + 0.0722 * (c & 255)) / 255
}

/** A cor média do ladrilho e a luz de cada pixel. */
function mediaELuzes(d: Uint8ClampedArray): { r: number; g: number; b: number; croma: number; luzes: number[] } {
  let r = 0
  let g = 0
  let b = 0
  let croma = 0
  const luzes: number[] = []
  for (let i = 0; i < d.length; i += 4) {
    r += d[i]
    g += d[i + 1]
    b += d[i + 2]
    croma += (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2])) / 255
    luzes.push(luzDe(d, i))
  }
  const n = d.length / 4
  return { r: r / n, g: g / n, b: b / n, croma: croma / n, luzes }
}

/** Matiz em graus (0 = vermelho, 60 = amarelo, 120 = verde) de uma cor com r ≥ g ≥ b ou g ≥ r ≥ b. */
function matiz(r: number, g: number, b: number): number {
  const maior = Math.max(r, g, b)
  const menor = Math.min(r, g, b)
  if (maior === r) return (60 * (g - b)) / (maior - menor)
  return 60 * (2 + (b - r) / (maior - menor))
}

function correlacao(a: readonly number[], b: readonly number[]): number {
  const ma = a.reduce((s, x) => s + x, 0) / a.length
  const mb = b.reduce((s, x) => s + x, 0) / b.length
  let cov = 0
  let va = 0
  let vb = 0
  for (let i = 0; i < a.length; i += 1) {
    cov += (a[i] - ma) * (b[i] - mb)
    va += (a[i] - ma) ** 2
    vb += (b[i] - mb) ** 2
  }
  return cov / Math.sqrt(va * vb)
}

describe('Campo em duas formas, Verde e Amarelo (pedido de 13/10/2026)', () => {
  it('as duas formam o grupo "grama": a verde primeiro, com o mesmo nome de cartão e o mesmo tamanho', () => {
    expect(texturaDe('grama').forma).toEqual({ grupo: 'grama', nome: 'Verde' })
    expect(texturaDe('grama-amarela').forma).toEqual({ grupo: 'grama', nome: 'Amarelo' })
    expect(texturaDe('grama-amarela').nome).toBe(texturaDe('grama').nome)
    expect(texturaDe('grama-amarela').escala).toBe(texturaDe('grama').escala)
    expect(texturaDe('grama-amarela').lado).toBe(texturaDe('grama').lado)
  })

  it('a Verde é pixel a pixel a de antes: mapa salvo com Campo não muda', () => {
    // Medida na versão de 07a2a7e2, antes da forma Amarela existir.
    expect(impressaoDigital(pixelsDoLadrilho(texturaDe('grama').cor, 128))).toBe(1018597982)
  })

  it('a Amarela é palha dourada contida (nem limão nem laranja), com a luz e o desenho da Verde', () => {
    const verde = mediaELuzes(pixelsDoLadrilho(texturaDe('grama').cor, 128))
    const amarela = mediaELuzes(pixelsDoLadrilho(texturaDe('grama-amarela').cor, 128))
    // Dourado: o vermelho passa o verde, que passa bem o azul; matiz entre o
    // laranja (~30°) e o limão (~58°), longe dos dois.
    expect(amarela.r).toBeGreaterThan(amarela.g)
    expect(amarela.g).toBeGreaterThan(amarela.b + 40)
    const m = matiz(amarela.r, amarela.g, amarela.b)
    expect(m).toBeGreaterThan(40)
    expect(m).toBeLessThan(52)
    // Contida: no máximo a saturação média da Verde.
    expect(amarela.croma).toBeLessThanOrEqual(verde.croma)
    // A mesma luz da Verde (o mesmo campo noutra estação)...
    const luzMedia = (l: readonly number[]) => l.reduce((s, x) => s + x, 0) / l.length
    expect(Math.abs(luzMedia(amarela.luzes) - luzMedia(verde.luzes))).toBeLessThan(0.04)
    // ...e o mesmo desenho: manchas, moitas e tufos nos mesmos lugares.
    expect(correlacao(amarela.luzes, verde.luzes)).toBeGreaterThan(0.85)
  })
})

describe('Calçamento (pedido de 13/10/2026)', () => {
  it('chão de masmorra medido em casas, nítido de perto (128 px por casa)', () => {
    const calcamento = texturaDe('calcamento')
    expect(calcamento.nome).toBe('Calçamento')
    expect(calcamento.casas).toBe(8)
    expect((calcamento.lado ?? LADO_PADRAO) / (calcamento.casas ?? 1)).toBeGreaterThanOrEqual(128)
  })

  it('cinza-pedra escuro e neutro: escuro sem ser preto, sem tom', () => {
    const d = pixelsDoLadrilho(texturaDe('calcamento').cor, 256)
    const { r, g, b, luzes } = mediaELuzes(d)
    const media = luzes.reduce((s, x) => s + x, 0) / luzes.length
    // Na família das Lajotas escuras (#4a4946, luz ~0,28), a pedra um nada mais clara.
    expect(media).toBeGreaterThan(0.25)
    expect(media).toBeLessThan(0.32)
    let menorCanal = 255
    let maiorCroma = 0
    for (let i = 0; i < d.length; i += 4) {
      menorCanal = Math.min(menorCanal, d[i], d[i + 1], d[i + 2])
      maiorCroma = Math.max(maiorCroma, Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]))
    }
    // Sem preto: nem a junta desce do #282828.
    expect(menorCanal).toBeGreaterThanOrEqual(0x28)
    // Neutro, um nada quente (o vermelho não fica abaixo do azul): sem tom azulado nem castanho.
    expect(maiorCroma).toBeLessThanOrEqual(8)
    expect(r).toBeGreaterThanOrEqual(b)
    expect(r - b).toBeLessThan(6)
    expect(g).toBeGreaterThanOrEqual(b)
  })

  it('pedras soltas, umas duas por casa de lado: a junta escura corta cada fileira umas duas vezes por casa', () => {
    const calcamento = texturaDe('calcamento')
    const casas = calcamento.casas ?? 1
    const amostrasPorCasa = 128
    const fileiras = 16
    let juntas = 0
    for (let k = 0; k < fileiras; k += 1) {
      const v = (k + 0.37) / fileiras
      const luzes = Array.from({ length: casas * amostrasPorCasa }, (_, i) => luzDaCor(calcamento.cor((i + 0.5) / (casas * amostrasPorCasa), v)))
      // Na junta: mais perto da cor da junta (#353432) que da pedra (a mediana da fileira).
      const pedra = [...luzes].sort((a, b) => a - b)[Math.floor(luzes.length / 2)]
      const limiar = (pedra + luzDaCor(0x353432)) / 2
      for (let i = 0; i < luzes.length; i += 1) if (luzes[i] < limiar && luzes[(i + luzes.length - 1) % luzes.length] >= limiar) juntas += 1
    }
    const porCasa = juntas / (fileiras * casas)
    expect(porCasa).toBeGreaterThan(1.5)
    expect(porCasa).toBeLessThan(2.8)
  })
})
