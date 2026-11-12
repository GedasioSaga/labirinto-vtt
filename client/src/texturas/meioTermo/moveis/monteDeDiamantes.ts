/**
 * MONTE DE DIAMANTES de cima com volume (lote 17 dos objetos novos, 12/11/2026, grupo Tesouro; pedido do mestre:
 * "coloque Ouro, Diamente, Joias, Moedas de ouro como objeto única e em poças"): a forma em POÇA, os diamantes
 * derramados no chão.
 *
 * A poça tem a beira irregular em lóbulos (`criarMonte`) e sobe para o meio. Na beira, pedras grandes inteiras (a
 * lapidação inteira de `pedraLapidada.ts`, cada uma tombada para um lado), que dizem "diamante" sozinhas; para
 * dentro, pedras menores (a lapidação simples) e, entre elas, a MASSA de facetas miúdas e azuladas que é o fundo do
 * monte. O tom de tudo segue a encosta (o lado da luz claro, o de lá azulado): de longe o meio é um volume de
 * facetas claras e sombras azuis, e não sal grosso. Cada pedra faz uma sombrinha no que está debaixo dela. Algumas
 * pedras soltas fora da poça, com a sombra delas no chão, e umas estrelinhas de brilho nas pedras altas. Nada acende
 * luz: o brilho é pintado.
 *
 * Na 3/4 o monte sobe em quatro degraus (`chaoDoMonte`): cada pedra sobe com o degrau em que está o meio dela, o
 * fundo de cada degrau sobe com ele e o degrau de baixo aparece na frente. As soltas ficam no chão.
 *
 * Tamanho de partida 1,5 x 1 casa, objeto do chão COM altura. Esticado, a poça estica com a pegada e as pedras não:
 * têm tamanho fixo e só ficam mais numerosas (a grade cobre a pegada nova). Girado, a luz das facetas, a encosta, o
 * brilho e as sombras ficam no lugar NA TELA (`desgirado`). Sem material a escolher. Escreve `cena.corDoPiso`
 * (`ESCURO_DA_PEDRA`), como o diamante.
 */
import { hash } from '../../ruido'
import { elipse, type Ponto } from './formas'
import { contato, SOMBRA_X, SOMBRA_Y, type MaterialDaPeca, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import {
  alturaNoMonte,
  arrastada,
  chaoDoMonte,
  corDoTom,
  criarMonte,
  degrauDaPeca,
  desgirado,
  DIAMANTE,
  ESCURO_DA_PEDRA,
  estrelinha,
  luzDaEncosta,
  luzNoDesenho,
  mesaDaPedra,
  pedraLapidada,
  rumoDaLuz,
  type Monte,
  type NivelDoMonte,
  type Vetor,
} from './pedraLapidada'

const SEMENTE = 9500

/**
 * Os degraus da 3/4: a profundidade a partir da qual a pedra sobe com cada um; a altura do monte no meio (casas).
 * O primeiro fica para dentro da beira: as pedras da beira passam do fundo, e o contorno do monte é de pedras.
 */
const DEGRAUS = [0.12, 0.34, 0.55, 0.74]
const ALTO = 0.13
/** A grade das pedras: o passo (casas) e o quanto cada ponto sacode (fração do passo). */
const PASSO = 0.105
const SACODE = 0.42
/** As pedras começam nesta profundidade (um tico fora do fundo) e, até `FIM_DA_BEIRA`, são as grandes e inteiras. */
const COMECO_DAS_PEDRAS = -0.03
const FIM_DA_BEIRA = 0.3
const RAIO_NA_BEIRA: readonly [number, number] = [0.064, 0.022]
const RAIO_NO_MEIO: readonly [number, number] = [0.043, 0.022]
const CHANCE_DA_SEGUNDA = 0.45
/**
 * As três pedras grandes no alto do monte (frações da meia pegada, e o raio em casas): as que levam o brilho e a
 * culeta. Ficam só se o ponto cair no alto (o monte esticado ou de beira estranha pode tirá-las).
 */
const GRANDES: readonly (readonly [number, number, number])[] = [
  [-0.16, -0.2, 0.108],
  [0.22, -0.04, 0.098],
  [-0.03, 0.2, 0.092],
]
const ALTO_DAS_GRANDES = 0.45
/** Daqui para cima (px) a pedra leva a lapidação inteira, com a aresta entre as facetas. */
const RAIO_DA_INTEIRA = 4.4
const FRESTA = 0.1
/** As soltas: a faixa de profundidade fora da poça, a chance de cada ponto da grade e o raio (casas). */
const SOLTAS_DE = -0.4
const SOLTAS_ATE = -0.14
const CHANCE_DA_SOLTA = 0.3
const RAIO_DA_SOLTA: readonly [number, number] = [0.056, 0.018]
/** O tombo das pedras (radianos): da mesa para cima até bem caída (a oval torta, cada uma de um jeito). */
const TOMBO: readonly [number, number] = [0.15, 1]
/** O quanto o tom das facetas segue a encosta, os limites, o tom a mais de todas e o sorteio de cada pedra. */
const TOM_DA_ENCOSTA = 1
const TOM_MINIMO = -0.15
const TOM_MAXIMO = 0.18
const TOM_A_MAIS = 0.1
const TOM_SORTEADO = 0.08
/** A sombrinha de cada pedra no que está debaixo (frações do raio). */
const SOMBRA_DA_PEDRA = 0.32
const FORCA_DA_SOMBRA_DA_PEDRA = 0.34
/** A massa do fundo, o vão entre as pedras: facetas miúdas (px), escuras e azuladas, quase sem contraste. */
const FACETA_DO_FUNDO = 2
const TOM_DO_FUNDO = 0.2
const CONTRASTE_DO_FUNDO = 0.28
const ACESA = 0.985
const TOM_DA_ACESA = 0.7
const CONTORNO_DA_POCA = 0.3
/** As estrelinhas: quantas além das grandes, o braço (raios da pedra), onde (raios, para a luz) e a distância mínima (casas). */
const BRILHOS_A_MAIS = 2
const BRACO = 0.85
const NA_MESA = 0.42
const LONGE_ENTRE_BRILHOS = 0.3

const FUNDO: MaterialDaPeca = { classe: 'liso', rgb: corDoTom(DIAMANTE, TOM_DO_FUNDO) }

interface PedraDoMonte {
  readonly x: number
  readonly y: number
  readonly r: number
  /** A altura (px) no monte: a pedra mais alta é pintada por cima. */
  readonly z: number
  readonly tombo: number
  readonly rumo: number
  readonly tom: number
  readonly semente: number
  /** O degrau mais alto que a pedra toca (-1 = o chão) e um ponto dela nesse degrau, o meio que a 3/4 lê. */
  readonly k: number
  readonly meio: Ponto
}

/** O tom que a encosta dá no ponto (`luzDaEncosta`), com o ganho e os limites do diamante. */
function tomDaEncosta(monte: Monte, alto: number, luz: Vetor, x: number, y: number): number {
  return Math.min(TOM_MAXIMO, Math.max(TOM_MINIMO, luzDaEncosta(monte, alto, luz, x, y) * TOM_DA_ENCOSTA))
}

/** A massa do fundo: triângulos miúdos de tom sorteado em volta do tom da encosta, um ou outro aceso. */
function texDoFundo(monte: Monte, alto: number, luz: Vetor): Textura {
  return (_u, _v, x, y, _p, s) => {
    const fy = y / (FACETA_DO_FUNDO * 0.866)
    const fx = x / FACETA_DO_FUNDO - fy * 0.5
    const ix = Math.floor(fx)
    const iy = Math.floor(fy)
    const metade = fx - ix + (fy - iy) > 1 ? 1 : 0
    const h = hash(ix * 2 + metade, iy, SEMENTE + 7)
    const t = h > ACESA ? TOM_DA_ACESA : TOM_DO_FUNDO + tomDaEncosta(monte, alto, luz, x, y) + (h - 0.5) * CONTRASTE_DO_FUNDO
    const cor = corDoTom(DIAMANTE, t)
    s[0] = cor[0]
    s[1] = cor[1]
    s[2] = cor[2]
  }
}

export const montarMonteDeDiamantes: MontarMovel = (c, cena) => {
  const P = c.peca
  const L = cena.partes
  const { hw, hh, g } = c
  const luz = luzNoDesenho(c.giro)
  const [lx, ly] = rumoDaLuz(luz)
  const alto = ALTO * g
  const monte = criarMonte(hw, hh, SEMENTE)
  const niveis: NivelDoMonte[] = DEGRAUS.map((de, k) => ({ de, z: (alto * (k + 1)) / DEGRAUS.length }))
  cena.corDoPiso = ESCURO_DA_PEDRA

  // O chão do monte: as estruturas dos degraus, as sombras e a massa de facetas de cada degrau.
  const [sx, sy] = desgirado(SOMBRA_X * alto, SOMBRA_Y * alto, c.giro)
  chaoDoMonte(cena, P, hw, hh, monte, niveis, { material: FUNDO, textura: texDoFundo(monte, alto, luz), contorno: CONTORNO_DA_POCA }, [sx, sy], SEMENTE)

  // As pedras: uma por ponto da grade (às vezes duas, para dentro), as grandes do alto e as soltas fora da poça.
  const passo = PASSO * g
  const doMonte: PedraDoMonte[] = []
  const soltas: PedraDoMonte[] = []
  const sorteio = (i: number, j: number, n: number): number => hash(i * 7 + n, j * 13 + n, SEMENTE + n)
  const pedra = (x: number, y: number, r: number, i: number, j: number, n: number, naEncosta: boolean): PedraDoMonte => ({
    x,
    y,
    r,
    z: naEncosta ? alturaNoMonte(monte.q(x, y), alto) : 0,
    tombo: TOMBO[0] + (TOMBO[1] - TOMBO[0]) * sorteio(i, j, n + 5),
    rumo: sorteio(i, j, n + 6) * 2 * Math.PI,
    tom: (naEncosta ? tomDaEncosta(monte, alto, luz, x, y) : 0) + TOM_A_MAIS + (sorteio(i, j, n + 7) - 0.5) * 2 * TOM_SORTEADO,
    semente: SEMENTE + 100 + ((i * 31 + j * 17 + n) % 997) * 70,
    ...(naEncosta ? degrauDaPeca(monte, niveis, x, y, r) : { k: -1, meio: [x, y] as Ponto }),
  })
  for (let j = 0, y = -hh; y <= hh; j += 1, y += passo * 0.866) {
    for (let i = 0, x = -hw + (j % 2) * passo * 0.5; x <= hw; i += 1, x += passo) {
      const px = x + (sorteio(i, j, 1) - 0.5) * 2 * SACODE * passo
      const py = y + (sorteio(i, j, 2) - 0.5) * 2 * SACODE * passo
      const q = monte.q(px, py)
      if (q >= COMECO_DAS_PEDRAS) {
        const [r0, r1] = q < FIM_DA_BEIRA ? RAIO_NA_BEIRA : RAIO_NO_MEIO
        doMonte.push(pedra(px, py, g * (r0 + r1 * sorteio(i, j, 3)), i, j, 0, true))
        if (q >= FIM_DA_BEIRA && sorteio(i, j, 4) < CHANCE_DA_SEGUNDA) {
          const qx = px + (sorteio(i, j, 8) - 0.5) * passo
          const qy = py + (sorteio(i, j, 9) - 0.5) * passo
          if (monte.q(qx, qy) >= FIM_DA_BEIRA) doMonte.push(pedra(qx, qy, g * (RAIO_NO_MEIO[0] + RAIO_NO_MEIO[1] * sorteio(i, j, 10) * 0.6), i, j, 20, true))
        }
      } else if (q >= SOLTAS_DE && q <= SOLTAS_ATE && sorteio(i, j, 11) < CHANCE_DA_SOLTA) {
        soltas.push(pedra(px, py, g * (RAIO_DA_SOLTA[0] + RAIO_DA_SOLTA[1] * sorteio(i, j, 12)), i, j, 40, false))
      }
    }
  }

  const grandes: PedraDoMonte[] = []
  GRANDES.forEach(([fx, fy, r], k) => {
    const [x, y] = [fx * hw, fy * hh]
    if (monte.q(x, y) < ALTO_DAS_GRANDES) return
    const p = pedra(x, y, g * r, 500 + k, 500, 60, true)
    grandes.push({ ...p, z: p.z + 0.5, tom: p.tom + TOM_A_MAIS })
  })

  const desenhar = (p: PedraDoMonte, comSombra: boolean, culeta: boolean): void => {
    const inteira = p.r >= RAIO_DA_INTEIRA
    pedraLapidada(L, P, { x: p.x, y: p.y, raio: p.r, tombo: p.tombo, rumo: p.rumo }, {
      paleta: DIAMANTE,
      detalhe: inteira ? 'inteira' : 'simples',
      luz,
      semente: p.semente,
      tom: p.tom,
      fresta: inteira ? FRESTA : 0,
      culeta,
      meio: p.meio,
      ...(comSombra ? { projeta: { dist: p.r * SOMBRA_DA_PEDRA, forca: FORCA_DA_SOMBRA_DA_PEDRA, suave: p.r * 0.4 } } : {}),
    })
  }

  // As soltas, no chão: o contato e a sombra curta arrastada à mão (sem altura, não viram estrutura).
  soltas.forEach((p) => {
    const base = elipse(p.x, p.y, p.r * 0.86, p.r * 0.86)
    const [ox, oy] = desgirado(SOMBRA_X * p.r * 1.3, SOMBRA_Y * p.r * 1.3, c.giro)
    cena.sombras.push(contato(base, 0.3), { forma: arrastada(base, ox, oy), z: 0, suave: 1, forca: 0.22 })
    desenhar(p, false, false)
  })
  // As do monte, degrau por degrau e, no degrau, da mais baixa para a mais alta (a de cima é pintada por cima, de
  // cima e na 3/4, que pinta cada degrau com as peças dele na ordem da lista); as grandes por último.
  doMonte.sort((a, b) => a.k - b.k || a.z - b.z || a.y - b.y)
  doMonte.forEach((p) => desenhar(p, true, false))
  grandes.forEach((p) => desenhar(p, true, true))

  // As estrelinhas: nas grandes e em mais umas pedras altas, longe umas das outras, no canto da mesa do lado da luz.
  const longe = LONGE_ENTRE_BRILHOS * g
  const escolhidas: PedraDoMonte[] = [...grandes]
  let mais = 0
  for (const p of [...doMonte].filter((d) => d.r >= RAIO_NO_MEIO[0] * g * 1.15).sort((a, b) => b.z + b.tom * alto - (a.z + a.tom * alto))) {
    if (mais >= BRILHOS_A_MAIS) break
    if (escolhidas.some((e) => Math.hypot(e.x - p.x, e.y - p.y) < longe)) continue
    escolhidas.push(p)
    mais += 1
  }
  escolhidas.forEach((p, k) => {
    const [tx, ty] = mesaDaPedra({ x: p.x, y: p.y, raio: p.r, tombo: p.tombo, rumo: p.rumo })
    estrelinha(L, P, tx + lx * NA_MESA * p.r, ty + ly * NA_MESA * p.r, BRACO * p.r, SEMENTE + 90 + k * 2, p.meio)
  })
}
