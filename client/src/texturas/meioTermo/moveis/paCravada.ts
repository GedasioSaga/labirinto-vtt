/**
 * PÁ CRAVADA NA TERRA (11/11/2026, lote 8 dos objetos novos, grupo
 * Cemitério): a pá do coveiro fincada num monte de terra fresca, com os
 * torrões que rolaram em volta e o lampião APAGADO ao pé, de quem cavou de
 * noite.
 *
 * DESENHADA DE FRENTE nas duas vistas, como a lápide (perfil `EM_PE`): do alto
 * a pá cravada é um cabo visto de ponta e some, e o que diz "pá de coveiro" é
 * a silhueta de frente, o cabo com a empunhadura em D, o encaixe de ferro e
 * meia lâmina para fora da terra. O monte é a terra revolvida da cova
 * (`cova.ts`): o mesmo cinza-marrom da cova fresca, partido em torrões
 * pequenos, cada um com o seu claro em cima à esquerda, e com torrões soltos
 * na beira, que deixam o contorno encaroçado (liso, o monte lia como pedra).
 * A luz de cima à esquerda arredonda o monte numa meia cúpula. A lâmina entra
 * por trás da beira do monte (é pintada antes dele), e a sombra da pá cai no
 * monte, para baixo à direita. No chão, a sombra comprida da pá e a curta do
 * monte, como a da lápide. O giro deita a imagem, como na lápide.
 *
 * A pá passa um pouco da pegada para cima (`SUBIDA`): o cabo de coveiro é mais
 * alto que o monte é largo. A pá e o lampião têm medida própria e só encolhem
 * juntos se o mestre fizer o objeto menor que o de partida; o monte acompanha
 * a pegada. Materiais: `madeira` (o cabo) e `metal` (a lâmina, o encaixe e o
 * lampião). A terra, o vidro, a cera e o capim são fixos.
 */
import { hash, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { anel, caixa, capsula, dentroDe, elipse, poligono, type Forma, type Ponto } from './formas'
import { contato, ruido, type MaterialDaPeca, type Textura } from './motor'
import type { MontarMovel } from './contexto'

/** O lado de partida, em casas: abaixo dele a pá e o lampião encolhem junto. */
const LADO_DE_PARTIDA = 0.8
/** O chão (o pé do monte), em fração da altura da pegada a partir de baixo, e quanto a pá pode subir acima da pegada (casas). */
const PE = 0.11
const SUBIDA = 0.13
/** O monte: meia largura (fração da largura), altura (fração da altura), o meio (fração da largura) e as alturas em casas. */
const MEIA_LARGURA_DO_MONTE = 0.44
const ALTURA_DO_MONTE = 0.33
const MEIO_DO_MONTE = -0.03
const ALTURA_DO_MONTE_EM_CASAS = 0.22
const ALTURA_DA_PA_EM_CASAS = 0.62
const ALTURA_DO_LAMPIAO_EM_CASAS = 0.24
/** O contorno do monte: quantos pontos na cúpula, o achatado do alto e os caroços (fração do raio). */
const PONTOS_DO_MONTE = 56
const ACHATADO = 0.8
const CAROCOS = 0.06
/**
 * Os torrões presos na beira do monte, que encaroçam o contorno: o ângulo na
 * cúpula (0 = pé direito, pi = pé esquerdo; o alto, onde a pá entra, fica
 * livre) e o raio (px do protótipo).
 */
const TORROES_DA_BEIRA: readonly (readonly [number, number])[] = [
  [0.5, 1.9],
  [2.05, 2.1],
  [2.75, 1.7],
]
/**
 * A terra fresca: os tons da cova fresca (`cova.ts`), o mesmo monte visto de
 * frente. O lado do torrão da textura (px do protótipo).
 */
const TERRA_FRESCA: MaterialDaPeca = { classe: 'liso', rgb: rgb('#5a5249') }
const TORRAO: MaterialDaPeca = { classe: 'liso', rgb: rgb('#4a443d') }
const LADO_DO_TORRAO = 3.2
/** A luz da meia cúpula: quanto a terra virada para a luz clareia (ou a do outro lado escurece). */
const LUZ_DA_CUPULA = 0.32
/**
 * A luz de cada torrão da textura: quanto o lado de cima à esquerda clareia.
 * Forte, com fresta funda, cada torrão virava uma pedra e o monte, carvão.
 */
const LUZ_DO_TORRAO = 0.16
const FRESTA = 0.6
/** As migalhas de terra seca, mais claras: o limiar do grão fino e quanto clareiam. */
const MIGALHA = 0.36
const LUZ_DA_MIGALHA = 0.16
/**
 * O escuro em que o pixel escuro demais é levantado: um cinza quente da
 * terra, de luminância linear 0,052, acima do piso de luz (0,045). O de
 * sempre (o da nogueira) pintava de laranja as frestas da terra; o da cova
 * (#3d3935, 0,042) fica abaixo do piso e reprovava a folha.
 */
const ESCURO_DA_TERRA: Rgb = rgb('#45403b')

/** A pá, no referencial dela (ao longo para cima, de través para a direita), em px do protótipo. */
const INCLINACAO_DA_PA = -0.1
/** O tamanho da pá em relação às medidas abaixo: o cabo fica com ~0,55 casa fora da terra. */
const ESCALA_DA_PA = 0.88
/** Onde a lâmina entra: a fração da largura e quanto abaixo da beira do monte (px). */
const ENTRADA_X = 0.02
const ENTRADA_ABAIXO = 1.3
/** A lâmina: os vértices (de través, ao longo); o alto dela, com os pisadores, e quanto dela fica fora da terra. */
const LAMINA: readonly Ponto[] = [[-4.6, 5.2], [4.6, 5.2], [4.4, -3], [2.7, -7.2], [0, -8.6], [-2.7, -7.2], [-4.4, -3]]
const ALTO_DA_LAMINA = 5.2
const LAMINA_FORA = 8.5
const PISADOR = 0.9
/** O encaixe de ferro do cabo: de onde a onde vai e a meia largura embaixo e em cima. */
const ENCAIXE: readonly [number, number, number, number] = [4.4, 10, 1.75, 1.3]
/** O cabo: de onde a onde vai e o raio. A empunhadura em D: os dois braços e a travessa de cima. */
const CABO: readonly [number, number, number] = [9.4, 25.6, 1.15]
const BRACO_DE: readonly [number, number] = [0.9, 25.4]
const BRACO_ATE: readonly [number, number] = [3.2, 31.2]
const RAIO_DO_BRACO = 0.8
const TRAVESSA_DO_D: readonly [number, number, number] = [3.7, 31.9, 1.05]
/** Os rebites do encaixe (ao longo) e a terra grudada na lâmina (fração dela, a partir de baixo). */
const REBITES: readonly number[] = [6.4, 8.4]
const BARRO_NA_LAMINA = 0.42
/** A sombra da pá no monte: para onde cai (px, para baixo à direita), a grossura e a força. */
const SOMBRA_NO_MONTE: readonly [number, number] = [7, 8.5]
const GROSSURA_DA_SOMBRA_NO_MONTE = 1.7
const FORCA_DA_SOMBRA_NO_MONTE = 0.34

/** O lampião apagado, no pé direito do monte: o meio da base (fração da largura) e as duas colunas da gaiola (px do protótipo). */
const LAMPIAO_X = 0.33
const COLUNAS_DO_LAMPIAO: readonly number[] = [-2.8, 2.8]
/** O vidro fosco e frio do lampião apagado, a cera do toco e o pavio queimado. */
const VIDRO_APAGADO: MaterialDaPeca = { classe: 'liso', rgb: rgb('#59666a') }
const REFLEXO: MaterialDaPeca = { classe: 'liso', rgb: rgb('#c9d2cf') }
const ALFA_DO_REFLEXO = 0.38
const CERA: MaterialDaPeca = { classe: 'liso', rgb: [0xe2, 0xd7, 0xbc] }
const ALFA_DA_CERA_NO_VIDRO = 0.6
const PAVIO: MaterialDaPeca = { classe: 'liso', rgb: rgb('#2f2a26') }
/** O capim do pé: o verde-oliva da lápide. */
const CAPIM: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('musgo', 0.95)) }

/** Os torrões que rolaram: o meio (x em fração da meia pegada; y a partir do chão, em px) e o raio (px). */
const TORROES: readonly (readonly [number, number, number])[] = [
  [-0.93, 0.4, 2.3],
  [-0.62, 2.2, 1.8],
  [-0.24, 2.7, 2.2],
  [0.12, 2.3, 1.5],
  [0.58, 2.6, 1.7],
  [0.97, 0.9, 1.9],
  [-0.78, -1.2, 1.4],
]

/** O torrão mais perto de um ponto: a folga para o segundo (`fresta`), o tom sorteado, a distância e o deslocamento até ele. */
interface Torrao {
  readonly fresta: number
  readonly tom: number
  readonly perto: number
  readonly dx: number
  readonly dy: number
}

/**
 * Torrões: células de Voronoi com um ponto sorteado em cada (a conta da cova).
 * `fresta` perto de 0 é a divisa entre dois torrões; (dx, dy) vai do ponto do
 * torrão ao pixel, em lados de célula, e dá a luz de cada um.
 */
function torroes(x: number, y: number, lado: number, semente: number): Torrao {
  const X = x / lado
  const Y = y / lado
  const cx = Math.floor(X)
  const cy = Math.floor(Y)
  let perto = Infinity
  let longe = Infinity
  let tom = 0.5
  let dx = 0
  let dy = 0
  for (let j = -1; j <= 1; j += 1) {
    for (let i = -1; i <= 1; i += 1) {
      const ix = cx + i
      const iy = cy + j
      const ox = X - (ix + hash(ix, iy, semente))
      const oy = Y - (iy + hash(ix, iy, semente + 1))
      const d = Math.hypot(ox, oy)
      if (d < perto) {
        longe = perto
        perto = d
        tom = hash(ix, iy, semente + 2)
        dx = ox
        dy = oy
      } else if (d < longe) {
        longe = d
      }
    }
  }
  return { fresta: longe - perto, tom, perto, dx, dy }
}

/** A luz da terra revolvida num ponto: cada torrão claro em cima à esquerda, as frestas, o grão e as migalhas secas. */
function luzDaTerra(x: number, y: number, semente: number): number {
  const { fresta, tom, perto, dx, dy } = torroes(x, y, LADO_DO_TORRAO, semente)
  const lado = Math.min(1, perto / 0.55)
  const luz = perto > 0 ? (-(0.62 * dx + 0.48 * dy) / perto) * lado : 0
  const grao = ruido(x * 2.3 + 7.1, y * 2.3)
  const migalha = grao > MIGALHA ? LUZ_DA_MIGALHA : 0
  return LUZ_DO_TORRAO * luz + (tom - 0.5) * 0.1 - Math.max(0, 0.06 - fresta) * FRESTA + ruido(x * 1.7, y * 1.7) * 0.12 + migalha
}

/** A terra do monte de frente: a meia cúpula de pé em (cx, chao), raios rx e ry, com a luz de cima à esquerda e da frente, e os torrões. */
function texDoMonte(cx: number, chao: number, rx: number, ry: number, semente: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const nx = Math.max(-1, Math.min(1, (x - cx) / rx))
    const ny = Math.max(-1, Math.min(0, (y - chao) / ry))
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny))
    s[3] += LUZ_DA_CUPULA * (-0.62 * nx - 0.48 * ny + 0.62 * nz - 0.62) + luzDaTerra(x, y, semente)
  }
}

/** A terra de um torrão solto: só os torrões pequenos da textura. */
function texDaTerra(semente: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    s[3] += luzDaTerra(x, y, semente) * 0.7
  }
}

/** O contorno do monte: a meia cúpula com caroços, do pé direito ao esquerdo, e a base reta um pouco abaixo do chão. */
function contornoDoMonte(cx: number, chao: number, rx: number, ry: number, sem: number): Ponto[] {
  const pontos: Ponto[] = []
  for (let i = 0; i <= PONTOS_DO_MONTE; i += 1) {
    const t = (i / PONTOS_DO_MONTE) * Math.PI
    const k = 1 + CAROCOS * (Math.sin(5 * t + 0.7) + 0.6 * Math.sin(11 * t + 2.1) + 0.5 * Math.sin(23 * t + 0.4)) + (hash(i, 1, sem) - 0.5) * CAROCOS
    pontos.push([cx + Math.cos(t) * rx * (1 + 0.04 * (k - 1)), chao - Math.sin(t) ** ACHATADO * ry * k])
  }
  pontos.push([cx - rx * 1.02, chao + 1], [cx + rx * 1.02, chao + 1])
  return pontos
}

/** Um torrão: polígono irregular de raio `r` em (x, y), mais largo que alto (assentou no chão). */
function torrao(x: number, y: number, r: number, sem: number): Forma {
  const pontos: Ponto[] = []
  for (let i = 0; i < 7; i += 1) {
    const t = (i / 7) * 2 * Math.PI
    const k = 0.65 + 0.6 * hash(i, sem, 11)
    pontos.push([x + Math.cos(t) * r * k, y + Math.sin(t) * r * k * 0.78])
  }
  return poligono(pontos)
}

/** Um tufo de capim de frente, de `largura` x `alto` px com o pé em (x, y): folhas em zigue-zague (o da lápide). */
function tufo(x: number, y: number, largura: number, alto: number, inclina: number): Forma {
  const m = largura / 2
  return poligono([
    [x - m, y + 0.8],
    [x - m * 0.85 + inclina, y - alto * 0.7],
    [x - m * 0.35, y - alto * 0.2],
    [x + inclina * 0.6, y - alto],
    [x + m * 0.3, y - alto * 0.25],
    [x + m * 0.9 + inclina, y - alto * 0.62],
    [x + m, y + 0.8],
  ])
}

export const montarPaCravada: MontarMovel = (c, cena) => {
  const { w, h, hw, hh, g, peca: P } = c
  const madeira = c.m.madeira
  const metal = c.m.metal
  const L = cena.partes
  cena.corDoPiso = ESCURO_DA_TERRA
  // A pá e o lampião: medida própria, encolhendo só no objeto menor que o de partida.
  const k = Math.min(1, w / (g * LADO_DE_PARTIDA), h / (g * LADO_DE_PARTIDA))
  const kPa = k * ESCALA_DA_PA
  const chao = hh - PE * h
  const cx = MEIO_DO_MONTE * w
  const rx = MEIA_LARGURA_DO_MONTE * w
  // O ponto da lâmina que fica na beira da terra; o monte é tão alto quanto a pá deixa.
  const aDaBeira = ALTO_DA_LAMINA - LAMINA_FORA
  const altoDaPa = (TRAVESSA_DO_D[1] + TRAVESSA_DO_D[2] - aDaBeira) * kPa
  const ry = Math.min(ALTURA_DO_MONTE * h, chao + hh + SUBIDA * g - altoDaPa)
  const monte = poligono(contornoDoMonte(cx, chao, rx, ry, 61))

  // ---------- onde a pá entra: um pouco abaixo da beira do monte ----------
  const ex = ENTRADA_X * w
  const nxDoMonte = Math.max(-1, Math.min(1, (ex - cx) / rx))
  const beira = chao - Math.sqrt(1 - nxDoMonte * nxDoMonte) ** ACHATADO * ry
  const ux = Math.sin(INCLINACAO_DA_PA)
  const uy = -Math.cos(INCLINACAO_DA_PA)
  const ey = beira + ENTRADA_ABAIXO + aDaBeira * kPa * Math.cos(INCLINACAO_DA_PA)
  // (de través, ao longo) no referencial da pá: px do desenho.
  const naPa = (b: number, a: number): Ponto => [ex + (b * -uy + a * ux) * kPa, ey + (b * ux + a * uy) * kPa]
  const [px, py] = naPa(0, aDaBeira)

  // ---------- as sombras no chão: a da pá, comprida; a do monte, curta; a do lampião ----------
  const lx = LAMPIAO_X * w
  const ly = chao + 1.4 * k
  cena.sombras.push(
    { forma: caixa(ex - 1.6 * k, chao - 1.2, ex + 1.6 * k, chao), z: g * ALTURA_DA_PA_EM_CASAS * k, forca: 0.26 },
    { forma: caixa(cx - rx * 0.7, chao - 1.5, cx + rx * 0.7, chao), z: g * ALTURA_DO_MONTE_EM_CASAS, forca: 0.24 },
    contato(caixa(cx - rx, chao - 1.2, cx + rx, chao + 1.2, 1), 0.32),
    { forma: caixa(lx - 3 * k, ly - 1.2, lx + 3 * k, ly), z: g * ALTURA_DO_LAMPIAO_EM_CASAS * k, forca: 0.24 },
    contato(caixa(lx - 3.8 * k, ly - 0.8, lx + 3.8 * k, ly + 0.8, 0.8), 0.3),
  )

  // ---------- a pá, por trás da beira do monte: a lâmina, o encaixe, o cabo e a empunhadura em D ----------
  const lamina = poligono(LAMINA.map(([b, a]) => naPa(b, a)))
  L.push(P(lamina, metal, { eixo: INCLINACAO_DA_PA, tabua: 0, bisel: 1.4 * kPa, contorno: 0.3, semente: 610 }))
  // A beira de cima da lâmina, dobrada para o pé pisar: uma tira mais clara.
  const pisador = poligono([naPa(-5, ALTO_DA_LAMINA - PISADOR), naPa(5, ALTO_DA_LAMINA - PISADOR), naPa(5, ALTO_DA_LAMINA + 1), naPa(-5, ALTO_DA_LAMINA + 1)])
  L.push(P(dentroDe(lamina, pisador), metal, { tabua: 0, bisel: 0.4, contorno: 0.1, tom: 1.2, semente: 611 }))
  // O barro grudado na lâmina, perto da terra.
  const barro = ALTO_DA_LAMINA * BARRO_NA_LAMINA
  const sujo = poligono([naPa(-5, -9), naPa(5, -9), naPa(5, barro - 1.2), naPa(1, barro), naPa(-5, barro - 0.4)])
  L.push(P(dentroDe(lamina, sujo), TERRA_FRESCA, { bisel: 0, contorno: 0, alfa: 0.7, suave: 0.6, semente: 612 }))
  const [e0, e1, m0, m1] = ENCAIXE
  L.push(P(poligono([naPa(-m0, e0), naPa(m0, e0), naPa(m1, e1), naPa(-m1, e1)]), metal, { eixo: INCLINACAO_DA_PA - Math.PI / 2, tabua: 0, bisel: m0 * kPa, contorno: 0.28, semente: 613 }))
  REBITES.forEach((a, i) => {
    const [rx0, ry0] = naPa(0, a)
    L.push(P(elipse(rx0, ry0, 0.5 * kPa, 0.5 * kPa), metal, { bisel: 0.5 * kPa, contorno: 0, tom: 1.25, semente: 614 + i }))
  })
  const [c0, c1, rc] = CABO
  const [cabo0x, cabo0y] = naPa(0, c0)
  const [cabo1x, cabo1y] = naPa(0, c1)
  L.push(P(capsula(cabo0x, cabo0y, cabo1x, cabo1y, rc * kPa), madeira, { eixo: INCLINACAO_DA_PA - Math.PI / 2, tabua: 0, bisel: rc * kPa, contorno: 0.3, semente: 620 }))
  for (const lado of [-1, 1]) {
    const [b0x, b0y] = naPa(lado * BRACO_DE[0], BRACO_DE[1])
    const [b1x, b1y] = naPa(lado * BRACO_ATE[0], BRACO_ATE[1])
    L.push(P(capsula(b0x, b0y, b1x, b1y, RAIO_DO_BRACO * kPa), madeira, { tabua: 0, bisel: RAIO_DO_BRACO * kPa, contorno: 0.3, tom: 0.96, semente: 621 + lado }))
  }
  const [tb, ta, tr] = TRAVESSA_DO_D
  const [t0x, t0y] = naPa(-tb, ta)
  const [t1x, t1y] = naPa(tb, ta)
  L.push(P(capsula(t0x, t0y, t1x, t1y, tr * kPa), madeira, { eixo: INCLINACAO_DA_PA, tabua: 0, bisel: tr * kPa, contorno: 0.3, tom: 1.06, semente: 624 }))

  // ---------- o monte, por cima do pé da lâmina; os torrões da beira, a sombra da pá e a terra que a lâmina levantou ----------
  L.push(P(monte, TERRA_FRESCA, { bisel: 2.2, contorno: 0.34, textura: texDoMonte(cx, chao, rx, ry, 61), semente: 630 }))
  TORROES_DA_BEIRA.forEach(([t, r], i) => {
    const x = cx + Math.cos(t) * rx * 0.97
    const y = chao - Math.sin(t) ** ACHATADO * ry * 0.97
    L.push(P(torrao(x, y, r * k, 633 + i), TERRA_FRESCA, { bisel: 0.9, contorno: 0.26, tom: 0.98 + 0.12 * hash(i, 2, 633), textura: texDaTerra(633 + i), semente: 633 + i }))
  })
  const sombraNoMonte = capsula(px + 0.8 * k, py + 0.4 * k, px + (0.8 + SOMBRA_NO_MONTE[0]) * k, py + (0.4 + SOMBRA_NO_MONTE[1]) * k, GROSSURA_DA_SOMBRA_NO_MONTE * k)
  L.push(P(dentroDe(sombraNoMonte, monte), TORRAO, { bisel: 0, contorno: 0, tom: 0.5, alfa: FORCA_DA_SOMBRA_NO_MONTE, suave: 1.1, semente: 631 }))
  L.push(P(torrao(px + 1.4 * k, py + 1.4 * k, 2.6 * k, 632), TERRA_FRESCA, { bisel: 1, contorno: 0.3, tom: 1.08, textura: texDaTerra(632), semente: 632 }))

  // ---------- os torrões que rolaram e o capim do pé ----------
  TORROES.forEach(([fx, dy, r], i) => {
    const forma = torrao(fx * hw, chao + dy, r * k, 640 + i)
    cena.sombras.push(contato(forma, 0.26))
    L.push(P(forma, TERRA_FRESCA, { bisel: 0.8, contorno: 0.28, tom: 0.86 + 0.2 * hash(i, 1, 641), textura: texDaTerra(640 + i), semente: 640 + i }))
  })
  const capim = { bisel: 0.8, contorno: 0.2 }
  L.push(P(tufo(-hw * 0.82, chao + 1.6, 4.4, 4.2, -0.5), CAPIM, { ...capim, tom: 0.92, semente: 650 }))
  L.push(P(tufo(hw * 0.12, chao + 2.8, 3.8, 3.4, 0.4), CAPIM, { ...capim, tom: 1.04, semente: 651 }))

  // ---------- o lampião apagado, no pé direito do monte: base, vidro com o toco, colunas, chapéu e argola ----------
  const em = (x: number, y: number): Ponto => [lx + x * k, ly + y * k]
  const ret = (x0: number, y0: number, x1: number, y1: number, raio = 0): Forma => {
    const [a0, b0] = em(x0, y0)
    const [a1, b1] = em(x1, y1)
    return caixa(a0, b0, a1, b1, raio * k)
  }
  L.push(P(ret(-2.8, -8.8, 2.8, -1.4), VIDRO_APAGADO, { bisel: 0.5 * k, contorno: 0.2, semente: 660 }))
  L.push(P(ret(-0.85, -4.6, 0.85, -1.4, 0.3), CERA, { bisel: 0.4 * k, contorno: 0, alfa: ALFA_DA_CERA_NO_VIDRO, semente: 661 }))
  L.push(P(ret(-0.15, -5.5, 0.15, -4.5), PAVIO, { bisel: 0, contorno: 0, alfa: ALFA_DA_CERA_NO_VIDRO, semente: 662 }))
  L.push(P(ret(-1.9, -8.1, -1.3, -2.1, 0.3), REFLEXO, { bisel: 0, contorno: 0, alfa: ALFA_DO_REFLEXO, semente: 663 }))
  COLUNAS_DO_LAMPIAO.forEach((x, i) => L.push(P(ret(x - 0.45, -9, x + 0.45, -1.2, 0.2), metal, { bisel: 0.4 * k, contorno: 0.2, semente: 664 + i })))
  L.push(P(ret(-3.6, -1.6, 3.6, 0, 0.4), metal, { tabua: 0, bisel: 0.6 * k, contorno: 0.28, semente: 666 }))
  const chapeu = poligono([em(-3.7, -8.6), em(3.7, -8.6), em(1.5, -11.3), em(-1.5, -11.3)])
  L.push(P(chapeu, metal, { tabua: 0, bisel: 0.9 * k, contorno: 0.28, semente: 667 }))
  const [ax, ay] = em(0, -12.7)
  L.push(P(anel(ax, ay, 1.5 * k, 1.5 * k, 0.75 * k, 0.75 * k), metal, { bisel: 0.4 * k, contorno: 0.2, tom: 0.9, semente: 668 }))
}
