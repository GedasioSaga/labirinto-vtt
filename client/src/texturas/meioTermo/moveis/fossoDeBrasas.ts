/**
 * FOSSO DE BRASAS de cima com volume (construção do lote L03 de 24/11/2026,
 * Tortura e fogo; desenho ORIGINAL, junta a ideia do "fosso de brasa com
 * grade" e a da "fornalha de incineração" dos mapas de referência): a COVA
 * quadrada no chão da masmorra, com a BORDA de pedras assentadas (os quatro
 * cunhais e três pedras de cada lado, escuras de fuligem na beira de dentro),
 * as PAREDES descendo até o LEITO de carvão em brasa viva e, por cima, a GRADE
 * de ferro: o quadro chato, sete barras redondas e duas travessas, presa na
 * borda de trás por duas DOBRADIÇAS e com a ARGOLA de puxar na da frente.
 *
 * O leito é uma textura só (`texBrasasVivas`): torrões de carvão escuros com a
 * cinza na crista, a brasa correndo nas frestas entre eles e, mais para o
 * meio, torrões inteiros acesos. As barras da grade pegam o fogo POR BAIXO: o
 * lombo é ferro escuro, e as beiras, o vermelho da brasa. O brilho do desenho
 * é contido (regra 5 do estilo): quem ilumina é a entrada em `LUZ_DOS_OBJETOS`.
 *
 * NA 3/4 é derivado (`tresQuartos.ts`): a borda é uma coluna em anel
 * (`ALTURA` casa) e a grade, um tampo solto um fio acima dela; as peças da
 * cova (as paredes, o leito, o halo) têm a caixa centrada num vão da grade,
 * fora de qualquer estrutura, e ficam no chão. Nada lê o giro: a cova é quase
 * igual dos quatro lados.
 *
 * A 25% de zoom sobram o quadrado de pedra, o miolo quente e os riscos escuros
 * da grade por cima: é o que diz "fosso de brasas", e não poço (a água), ralo
 * (rente e pequeno) ou fogueira (a roda de pedras, sem grade). Materiais:
 * `pedra` (a borda) e `metal` (a grade). Tudo sai de frações da pegada (2 x 2
 * casas de partida).
 */
import { hash, limitar01, misturar, type Rgb } from '../../ruido'
import { anel, caixa, capsula, elipse, menos, uniao, type Forma } from './formas'
import { contato, ruido, texturaDaClasse, type MaterialDaPeca, type OpcoesDaPeca, type Peca, type Textura } from './motor'
import { G, type MontarMovel } from './contexto'
import { comMeioEm, solta } from './andaimeDaTresQuartos'
import { FOGO_PARADO, texHalo } from './fogoDeCasa'
import { BRASA_QUENTE, BRASA_VIVA } from './fogueira'

/** O fosso foi medido no tamanho de partida (2 casas, 56 px de meio lado): as medidas miúdas escalam por aqui. */
const MEIO_LADO_DE_PARTIDA = G
/** A altura da borda, em casas do lado: um degrau baixo de pedra. */
const ALTURA = 0.09

/** Em fração da meia pegada: a borda por fora e por dentro (a boca da cova) e onde as paredes acabam no leito. */
const BORDA_DE_FORA = 0.95
const BOCA = 0.7
const LEITO = 0.585
/** As pedras da borda: onde cada lado é cortado (frações entre os dois cunhais) e a junta (px de partida). */
const CORTES_DO_LADO: readonly (readonly number[])[] = [
  [0, 0.36, 0.7, 1],
  [0, 0.3, 0.63, 1],
  [0, 0.38, 0.66, 1],
  [0, 0.32, 0.7, 1],
]
const JUNTA = 1
/** A fuligem na beira de dentro da borda e o claro quente que o fogo põe nela. */
const FULIGEM = 0.36
const CLARO_DO_FOGO_NA_BORDA = 0.3

/** A grade: a meia largura do quadro chato (px de partida), as barras (quantas, o raio) e as travessas (o y, fração; a meia altura). */
const MEIO_QUADRO = 2.6
const BARRAS = 7
const RAIO_DA_BARRA = 1.75
const TRAVESSAS: readonly number[] = [-0.25, 0.25]
const MEIA_TRAVESSA = 1.5
/** As dobradiças na borda de trás (o x, fração) e a argola na da frente. */
const DOBRADICAS: readonly number[] = [-0.36, 0.36]

/** O leito: o lado de cada torrão (px de partida), a largura da fresta em brasa e até onde o miolo é quente (fração). */
const TORRAO = 5.4
const FRESTA = 0.2
const RAIO_DO_CALOR = 0.66
const ALFA_DO_HALO = 0.13

const TOM_DO_FERRO = 0.8
const BRILHO_DO_FERRO = 0.3
const TOM_DO_REBITE = 1.34
const ESCURO_DA_PEDRA: Rgb = [0x45, 0x40, 0x3b]
/** O carvão e a cinza da crista dele; a brasa funda das frestas da beira e o miolo mais claro dos torrões acesos. */
const CARVAO: Rgb = [0x40, 0x3a, 0x36]
const CINZA_DO_CARVAO: Rgb = [0x82, 0x7b, 0x73]
const BRASA_FUNDA: Rgb = [0x66, 0x38, 0x2c]
const MIOLO_DA_BRASA: Rgb = [0xda, 0x9c, 0x62]
/** A parede da cova: a pedra no escuro, no alto, e tingida pela brasa junto do leito. */
const PAREDE_NO_ESCURO: Rgb = [0x3a, 0x31, 0x2d]
const PAREDE_JUNTO_DO_FOGO: Rgb = [0x84, 0x4b, 0x38]
const PAREDE: MaterialDaPeca = { classe: 'liso', rgb: PAREDE_NO_ESCURO }
const SOMBRA_NA_COVA: MaterialDaPeca = { classe: 'liso', rgb: [0x2c, 0x22, 0x1f] }

const DA_PEDRA = texturaDaClasse('pedra')
const DO_METAL = texturaDaClasse('metal')

/** A distância "quadrada" ao meio, em fração da meia pegada: 1 na beira da pegada, igual nos quatro lados. */
function quadrada(x: number, y: number, hw: number, hh: number): number {
  return Math.max(Math.abs(x) / hw, Math.abs(y) / hh)
}

/**
 * O LEITO de carvão em brasa viva, numa textura só: células de torrão (a mais
 * perto e a segunda dão a fresta entre dois torrões), o carvão escuro com a
 * cinza na crista, a brasa nas frestas e, quanto mais perto do meio, mais
 * torrões inteiros acesos. `lado` = o tamanho do torrão (px).
 */
function texBrasasVivas(hw: number, hh: number, lado: number, semente: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const gx = x / lado
    const gy = y / lado
    const ix = Math.floor(gx)
    const iy = Math.floor(gy)
    let perto = 9
    let segunda = 9
    let sorte = 0
    for (let j = -1; j <= 1; j += 1) {
      for (let i = -1; i <= 1; i += 1) {
        const d = Math.hypot(gx - (ix + i + 0.18 + 0.64 * hash(ix + i, iy + j, semente)), gy - (iy + j + 0.18 + 0.64 * hash(ix + i, iy + j, semente + 1)))
        if (d < perto) {
          segunda = perto
          perto = d
          sorte = hash(ix + i, iy + j, semente + 2)
        } else if (d < segunda) segunda = d
      }
    }
    const calor = limitar01(1.08 - Math.hypot(x / hw, y / hh) / RAIO_DO_CALOR + ruido(x * 0.09 + 5, y * 0.09 + 13) * 0.5)
    const fresta = limitar01(1 - (segunda - perto) / FRESTA)
    const miolo = limitar01(1 - perto * 1.5)
    const acesa = sorte < 0.06 + 0.42 * calor
    let cor: Rgb
    let emissao: number
    if (acesa) {
      cor = misturar(BRASA_VIVA, MIOLO_DA_BRASA, miolo * (0.3 + 0.7 * calor))
      emissao = 0.9
    } else {
      cor = misturar(CARVAO, CINZA_DO_CARVAO, miolo * miolo * (0.55 - 0.3 * calor))
      emissao = 0.1
      s[3] += (miolo - 0.45) * 0.3
    }
    const naFresta = misturar(BRASA_FUNDA, BRASA_QUENTE, 0.15 + 0.85 * calor)
    const t = fresta * (acesa ? 0.35 : 0.9)
    s[0] = cor[0] + (naFresta[0] - cor[0]) * t
    s[1] = cor[1] + (naFresta[1] - cor[1]) * t
    s[2] = cor[2] + (naFresta[2] - cor[2]) * t
    s[4] = emissao + (0.92 - emissao) * fresta
  }
}

/** A pedra da borda: a textura da pedra, a fuligem e o claro quente crescendo para a boca da cova. */
function texDaBorda(hw: number, hh: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (DA_PEDRA !== null) DA_PEDRA(u, v, x, y, p, s, escala)
    const t = limitar01((BORDA_DE_FORA - quadrada(x, y, hw, hh)) / (BORDA_DE_FORA - BOCA))
    s[3] -= FULIGEM * t * t * (0.7 + ruido(x * 0.3 + 9, y * 0.3 + 2) * 1.1)
    const quente = CLARO_DO_FOGO_NA_BORDA * t * t * t
    s[0] += (BRASA_VIVA[0] - s[0]) * quente
    s[1] += (BRASA_VIVA[1] - s[1]) * quente
    s[2] += (BRASA_VIVA[2] - s[2]) * quente
  }
}

/** A parede da cova: escura na boca, tingida pela brasa junto do leito; as de trás e da esquerda um pouco mais no escuro. */
function texDaParede(hw: number, hh: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const t = limitar01((quadrada(x, y, hw, hh) - LEITO) / (BOCA - LEITO))
    const deCostas = x / hw < -LEITO || y / hh < -LEITO ? 0.8 : 1
    const cor = misturar(PAREDE_JUNTO_DO_FOGO, PAREDE_NO_ESCURO, Math.pow(t, 0.7))
    s[0] = cor[0] * deCostas
    s[1] = cor[1] * deCostas
    s[2] = cor[2] * deCostas
    s[3] += ruido(x * 0.4 + 7, y * 0.4) * 0.1
    s[4] = 0.55 * (1 - t)
  }
}

/** O ferro da grade: escuro no lombo e, nas beiras, o vermelho da brasa que sobe por baixo (`aoLongoDeX`: a travessa). */
function texDaBarra(meio: number, raio: number, aoLongoDeX: boolean, hw: number, hh: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (DO_METAL !== null) DO_METAL(u, v, x, y, p, s, escala)
    const beira = limitar01((Math.abs((aoLongoDeX ? y : x) - meio) / raio - 0.38) / 0.55)
    const calor = limitar01(1.15 - Math.hypot(x / hw, y / hh) / LEITO)
    const t = beira * (0.25 + 0.6 * calor)
    s[0] += (BRASA_VIVA[0] - s[0]) * t
    s[1] += (BRASA_VIVA[1] - s[1]) * t
    s[2] += (BRASA_VIVA[2] - s[2]) * t
    s[4] = t * 0.7
  }
}

export const montarFossoDeBrasas: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const R = Math.min(hw, hh)
  const k = R / MEIO_LADO_DE_PARTIDA
  const pedra = c.m.pedra
  const ferro = c.m.metal
  const L = cena.partes
  const altura = 2 * R * ALTURA
  cena.corDoPiso = ESCURO_DA_PEDRA
  const quadrado = (f: number, raio = 0): Forma => caixa(-f * hw, -f * hh, f * hw, f * hh, raio)
  const doFerro = (semente: number, mais: OpcoesDaPeca = {}): OpcoesDaPeca => ({ tabua: 0, bisel: 0.8 * k, contorno: 0.3, tom: TOM_DO_FERRO, metal: BRILHO_DO_FERRO, semente, ...mais })

  // ---------- as formas: a borda em anel e a grade (o quadro, as travessas e as barras) ----------
  const borda = menos(quadrado(BORDA_DE_FORA, 3 * k), quadrado(BOCA))
  const [bx, by] = [BOCA * hw, BOCA * hh]
  const quadro = menos(caixa(-bx - MEIO_QUADRO * k, -by - MEIO_QUADRO * k, bx + MEIO_QUADRO * k, by + MEIO_QUADRO * k, 1.4 * k), caixa(-bx + MEIO_QUADRO * k, -by + MEIO_QUADRO * k, bx - MEIO_QUADRO * k, by - MEIO_QUADRO * k))
  const passo = (2 * bx) / (BARRAS + 1)
  const barras = Array.from({ length: BARRAS }, (_, i) => {
    const x = -bx + passo * (i + 1)
    return { x, forma: capsula(x, -by + 0.6 * k, x, by - 0.6 * k, RAIO_DA_BARRA * k) }
  })
  const travessas = TRAVESSAS.map((f) => ({ y: f * hh, forma: caixa(-bx + 0.6 * k, f * hh - MEIA_TRAVESSA * k, bx - 0.6 * k, f * hh + MEIA_TRAVESSA * k, 0.6 * k) }))
  const grade = [...barras, ...travessas].reduce((f, b) => uniao(f, b.forma), quadro)

  // ---------- as sombras: a borda (coluna em anel) e a grade (tampo solto, só para a 3/4) ----------
  cena.sombras.push(contato(quadrado(BORDA_DE_FORA, 3 * k), 0.34))
  cena.sombras.push({ forma: borda, z: altura, forca: 0.3 })
  cena.sombras.push(solta(grade, altura + 1.2 * k))

  // ---------- a cova: as paredes, o leito em brasa, a sombra da borda lá dentro e o halo (a caixa centrada num vão da grade) ----------
  const noVao = (f: Forma): Forma => comMeioEm(f, passo / 2, 0)
  const naCova: Peca[] = []
  naCova.push(P(quadrado(BOCA + 0.01), PAREDE, { tabua: 0, bisel: 0, contorno: 0, textura: texDaParede(hw, hh), semente: 24401 }))
  naCova.push(P(quadrado(LEITO, 2 * k), FOGO_PARADO, { tabua: 0, bisel: 0, contorno: 0.16, textura: texBrasasVivas(hw, hh, TORRAO * k, 24402), semente: 24402 }))
  // A borda de trás e a da esquerda fazem sombra no leito: é o que dá a fundura.
  naCova.push(P(capsula(-LEITO * hw, -LEITO * hh, LEITO * hw, -LEITO * hh, 3 * k), SOMBRA_NA_COVA, { bisel: 0, contorno: 0, alfa: 0.42, suave: 5 * k, semente: 24403 }))
  naCova.push(P(capsula(-LEITO * hw, -LEITO * hh, -LEITO * hw, LEITO * hh, 3 * k), SOMBRA_NA_COVA, { bisel: 0, contorno: 0, alfa: 0.36, suave: 5 * k, semente: 24404 }))
  naCova.push(P(elipse(0, 0, LEITO * hw, LEITO * hh), FOGO_PARADO, { textura: texHalo(0, 0, LEITO * hw, LEITO * hh, ALFA_DO_HALO), bisel: 0, contorno: 0, semente: 24405 }))
  for (const p of naCova) L.push({ ...p, forma: noVao(p.forma) })

  // ---------- a borda: a argamassa escura por baixo e as pedras (os quatro cunhais e três de cada lado) ----------
  const daPedra = (semente: number, tom: number): OpcoesDaPeca => ({ tabua: 0, bisel: 2 * k, contorno: 0.22, tom, textura: texDaBorda(hw, hh), semente })
  L.push(P(borda, pedra, { tabua: 0, bisel: 1.2 * k, contorno: 0.3, tom: 0.56, semente: 24410 }))
  const j = (JUNTA * k) / 2
  const [fx, fy] = [BORDA_DE_FORA * hw, BORDA_DE_FORA * hh]
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const x0 = sx < 0 ? -fx : bx
      const y0 = sy < 0 ? -fy : by
      L.push(P(caixa(x0 + j, y0 + j, x0 + (fx - bx) - j, y0 + (fy - by) - j, 2.4 * k), pedra, daPedra(24411 + sx + sy * 2, 0.94 + 0.12 * hash(sx, sy, 24411))))
    }
  }
  CORTES_DO_LADO.forEach((cortes, lado) => {
    for (let i = 0; i < cortes.length - 1; i += 1) {
      const tom = 0.9 + 0.2 * hash(lado, i, 24420)
      // Os lados 0 e 1 são o de trás e o da frente (as pedras correm em x); o 2 e o 3, a esquerda e a direita.
      const [a, b] = lado < 2 ? [-bx + 2 * bx * cortes[i], -bx + 2 * bx * cortes[i + 1]] : [-by + 2 * by * cortes[i], -by + 2 * by * cortes[i + 1]]
      const forma =
        lado === 0 ? caixa(a + j, -fy + j, b - j, -by - j, 2 * k)
        : lado === 1 ? caixa(a + j, by + j, b - j, fy - j, 2 * k)
        : lado === 2 ? caixa(-fx + j, a + j, -bx - j, b - j, 2 * k)
        : caixa(bx + j, a + j, fx - j, b - j, 2 * k)
      L.push(P(forma, pedra, daPedra(24420 + lado * 4 + i, tom)))
    }
  })

  // ---------- a grade: o quadro chato, as travessas por baixo e as barras redondas por cima ----------
  L.push(P(quadro, ferro, doFerro(24440, { bisel: 0.9 * k, projeta: { dist: 1.2 * k, forca: 0.34 } })))
  travessas.forEach((t, i) => {
    L.push(P(t.forma, ferro, doFerro(24441 + i, { tom: TOM_DO_FERRO * 0.9, textura: texDaBarra(t.y, MEIA_TRAVESSA * k, true, hw, hh) })))
  })
  barras.forEach((b, i) => {
    L.push(P(b.forma, ferro, doFerro(24445 + i, { bisel: RAIO_DA_BARRA * k * 0.9, tom: TOM_DO_FERRO * (0.96 + 0.1 * hash(i, 3, 24445)), textura: texDaBarra(b.x, RAIO_DA_BARRA * k, false, hw, hh) })))
  })
  // Os rebites do quadro, nas quinas e no meio de cada lado.
  for (const rx of [-1, 0, 1]) {
    for (const ry of [-1, 0, 1]) {
      if (rx === 0 && ry === 0) continue
      L.push(P(elipse(rx * bx, ry * by, 1.05 * k, 1.05 * k), ferro, doFerro(24455 + rx * 3 + ry, { bisel: 1 * k, tom: TOM_DO_REBITE, metal: 0.5, contorno: 0.2 })))
    }
  }

  // ---------- as dobradiças na borda de trás e a argola de puxar na da frente ----------
  const meioDaBorda = (BORDA_DE_FORA + BOCA) / 2
  DOBRADICAS.forEach((f, i) => {
    const x = f * hw
    L.push(P(caixa(x - 2.6 * k, -meioDaBorda * hh - 3.4 * k, x + 2.6 * k, -by + 1.2 * k, 0.9 * k), ferro, doFerro(24470 + i, { tom: 0.92, projeta: { dist: 1 * k, forca: 0.3 } })))
    L.push(P(capsula(x - 3.4 * k, -by - MEIO_QUADRO * k - 0.2 * k, x + 3.4 * k, -by - MEIO_QUADRO * k - 0.2 * k, 1.2 * k), ferro, doFerro(24472 + i, { bisel: 1.1 * k, tom: 1.06, projeta: { dist: 0.9 * k, forca: 0.3 } })))
    L.push(P(elipse(x, -meioDaBorda * hh - 1.4 * k, 0.9 * k, 0.9 * k), ferro, doFerro(24474 + i, { bisel: 0.8 * k, tom: TOM_DO_REBITE, metal: 0.5, contorno: 0.2 })))
  })
  const ya = meioDaBorda * hh + 0.6 * k
  L.push(P(caixa(-2.2 * k, by - 0.4 * k, 2.2 * k, by + MEIO_QUADRO * k + 1.6 * k, 0.8 * k), ferro, doFerro(24480, { tom: 0.98, projeta: { dist: 0.9 * k, forca: 0.3 } })))
  L.push(P(anel(0, ya, 4.2 * k, 3.6 * k, 2.7 * k, 2.2 * k), ferro, doFerro(24481, { bisel: 0.75 * k, tom: 1.1, metal: 0.42, projeta: { dist: 1 * k, forca: 0.32 } })))
}
