/**
 * TORRE DE RÁDIO DE TRELIÇA de cima com volume (14/11/2026, lote L16, construções da base militar): a torre
 * autoportante de três pernas de aço que afinam para o alto, pintada em FAIXAS vermelhas e brancas (a marca de
 * aviação), com as TRAVESSAS de cada faixa e uma DIAGONAL por face em zigue-zague, no alto a PLATAFORMA com as
 * três ANTENAS de painel e o MASTRO com a luz vermelha na ponta, e a meia altura uma ANTENA DE PRATO. No chão,
 * as três SAPATAS de concreto, o círculo de BRITA, o ARMÁRIO dos rádios na quina e a calha dos cabos.
 *
 * De cima: as pernas são riscas listradas de vermelho e branco que vão das sapatas até o meio, com os
 * triângulos das travessas encaixados um dentro do outro (a treliça vista do alto), as antenas e a luz no meio,
 * e a SOMBRA pontilhada de cada perna e travessa para baixo à direita. É a treliça listrada que diz "torre de
 * rádio" e não a caixa d'água nem a torre de vigia (de madeira e com telhado).
 *
 * NA 3/4 (`tresQuartos.ts`): cada perna são tampos de disco do chão ao alto, cada um um passo para dentro (a
 * perna afina), e o pedaço de perna vista de cima de cada nível tem a caixa recentrada no tico de fora que só
 * aquele disco cobre (`comMeioEm`), na cor da faixa; as travessas são tampos em triângulo com uma peça por lado, e
 * as diagonais, discos ao longo da linha, cada um com o pedaço dele. A plataforma, as antenas e o mastro saem por
 * último. Lê `c.giro` só para o que fica no alto sair depois das pernas.
 *
 * PELO MENOR LADO: medidas em fração do menor meio lado, alturas em lados (fica fina e de pé quando esticada).
 * Sem material escolhido: a tinta, o concreto, a brita e o aço são fixos.
 */
import { hash } from '../../ruido'
import { anel, caixa, capsula, dentroDe, elipse, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, type MaterialDaPeca } from './motor'
import { BURACO, G, materialDaPeca, type MontarMovel } from './contexto'
import { comMeioEm, discosQueAlargam, esticadaParaAFrente, solta } from './apoioDasConstrucoes'

/** A beirada dos tampos da torre (px do protótipo): a altura de cada tampo das pernas. O perfil usa este valor. */
export const ESPESSURA_DA_TORRE_DE_RADIO = 0.1 * G

/** As pernas: os ângulos (a face da frente fica entre as duas de baixo), o raio no pé e no alto, a grossura. */
const ANGULOS_DAS_PERNAS: readonly number[] = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6]
const PERNA_NO_PE = 0.62
const PERNA_NO_ALTO = 0.11
const RAIO_DA_PERNA = 0.036
const RAIO_DA_TRAVESSA = 0.02
/** As faixas da pintura (ímpar: vermelha nas duas pontas) e os discos de cada diagonal. */
const FAIXAS = 7
const DISCOS_DA_DIAGONAL = 7
/** No chão: a brita, a sapata, o armário (x0, y0, x1, y1) e a calha. */
const BRITA = 0.97
const MEIA_SAPATA = 0.1
const ARMARIO: readonly [number, number, number, number] = [0.5, -0.92, 0.9, -0.62]
/** No alto: as antenas de painel (meia largura, meia grossura) e o mastro (raio). */
const MEIA_ANTENA: readonly [number, number] = [0.07, 0.025]
const RAIO_DO_MASTRO = 0.026
const RAIO_DA_LUZ = 0.045
/** A antena de prato: em que faixa, em que perna, quanto sai e o raio. */
const PRATO_NA_FAIXA = 3
const PRATO_NA_PERNA = 2
const PRATO_SAI = 0.1
const RAIO_DO_PRATO = 0.085
/** Alturas em lados: a torre, as antenas acima da plataforma, o mastro e o armário. */
const ALTURA_DA_TORRE = 1.8
const ALTURA_DAS_ANTENAS = 0.12
const ALTURA_DO_MASTRO = 0.3
const ALTURA_DO_ARMARIO = 0.26
const FORCA_DA_SOMBRA_DA_PERNA = 0.2

const VERMELHO: MaterialDaPeca = { classe: 'metal', rgb: [0xa6, 0x4a, 0x3e] }
const BRANCO: MaterialDaPeca = { classe: 'metal', rgb: [0xd6, 0xd1, 0xc4] }
const CONCRETO: MaterialDaPeca = { classe: 'pedra', pedra: 'granito', rgb: [0xa8, 0xa5, 0x9c] }
const BRITA_CINZA: MaterialDaPeca = { classe: 'pedra', pedra: 'granito', rgb: [0x8e, 0x8a, 0x82] }
const ACO = materialDaPeca('ferro')
const ARMARIO_CINZA: MaterialDaPeca = { classe: 'metal', rgb: [0x8c, 0x90, 0x8a] }
const LUZ_VERMELHA: MaterialDaPeca = { classe: 'liso', rgb: [0xc0, 0x50, 0x40] }

export const montarTorreDeRadio: MontarMovel = (c, cena) => {
  const P = c.peca
  const L = cena.partes
  const S = cena.sombras
  const R = Math.min(c.hw, c.hh)
  const lado = 2 * R
  const e = ESPESSURA_DA_TORRE_DE_RADIO
  const f = (v: number): number => v * R
  const Ht = ALTURA_DA_TORRE * lado
  const niveis = Math.ceil(Ht / e - 0.01)
  cena.corDoPiso = [0x48, 0x46, 0x42]
  const disco = (x: number, y: number, r: number): Forma => elipse(x, y, r, r)
  const corDaFaixa = (z: number): MaterialDaPeca => (Math.min(FAIXAS - 1, Math.floor((z / Ht) * FAIXAS)) % 2 === 0 ? VERMELHO : BRANCO)
  /** Onde fica a perna `i` na altura `z` (afina em linha reta do pé ao alto). */
  const perna = (i: number, z: number): Ponto => {
    const r = f(PERNA_NO_PE + (PERNA_NO_ALTO - PERNA_NO_PE) * (z / Ht))
    return [Math.cos(ANGULOS_DAS_PERNAS[i]) * r, Math.sin(ANGULOS_DAS_PERNAS[i]) * r]
  }
  const noAlto = (forma: Forma, mais = 0): Forma => esticadaParaAFrente(forma, R + mais, c.giro)

  // ---------- no chão: a brita em quatro quartos, as sapatas, o armário dos rádios e a calha dos cabos ----------
  // A caixa de cada peça do chão fica centrada longe da torre: no meio, a 3/4 a faria subir com o mastro.
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    const quarto = dentroDe(disco(0, 0, f(BRITA)), caixa(Math.min(0, sx * R), Math.min(0, sy * R), Math.max(0, sx * R), Math.max(0, sy * R)))
    // Sem chanfro nem contorno: as emendas dos quartos não aparecem; a borda sai no aro, também em quartos.
    L.push(P(quarto, BRITA_CINZA, { tabua: 0, bisel: 0, tom: 0.96, contorno: 0, semente: 17400 + sx * 3 + sy }))
    const aro = dentroDe(anel(0, 0, f(BRITA), f(BRITA), f(BRITA) - 2.4, f(BRITA) - 2.4), caixa(Math.min(0, sx * R), Math.min(0, sy * R), Math.max(0, sx * R), Math.max(0, sy * R)))
    L.push(P(aro, BRITA_CINZA, { tabua: 0, bisel: 1.2, tom: 0.9, contorno: 0.2, semente: 17440 + sx * 3 + sy }))
  }
  for (let i = 0; i < 3; i += 1) {
    const [x, y] = perna(i, 0)
    const [ux, uy] = [Math.cos(ANGULOS_DAS_PERNAS[i]), Math.sin(ANGULOS_DAS_PERNAS[i])]
    const sapata = caixa(x - f(MEIA_SAPATA), y - f(MEIA_SAPATA), x + f(MEIA_SAPATA), y + f(MEIA_SAPATA), 1.2)
    S.push(contato(sapata, 0.32))
    L.push(P(comMeioEm(sapata, x + ux * f(MEIA_SAPATA * 0.8), y + uy * f(MEIA_SAPATA * 0.8)), CONCRETO, { tabua: 0, bisel: 1.2, tom: 1.04, contorno: 0.3, semente: 17410 + i }))
    for (const [dx, dy] of [[-0.6, -0.6], [0.6, -0.6], [0.6, 0.6], [-0.6, 0.6]] as const) {
      L.push(P(disco(x + dx * f(MEIA_SAPATA), y + dy * f(MEIA_SAPATA), 0.75), ACO, { tabua: 0, bisel: 0.4, contorno: 0.3, metal: 0.4, semente: 17414 + i * 4 }))
    }
  }
  const [a0, b0, a1, b1] = ARMARIO.map(f)
  const pePerna0 = perna(0, 0)
  L.push(P(capsula((a0 + a1) / 2, b1, pePerna0[0] + f(MEIA_SAPATA), pePerna0[1], f(0.035)), ACO, { tabua: 0, bisel: 0.5, tom: 0.9, contorno: 0.3, metal: 0.3, semente: 17428 }))
  const armario = caixa(a0, b0, a1, b1, 1)
  S.push({ forma: armario, z: ALTURA_DO_ARMARIO * lado })
  L.push(P(armario, ARMARIO_CINZA, { tabua: 0, bisel: 1.2, contorno: 0.3, metal: 0.24, semente: 17429 }))
  for (let k = 0; k < 4; k += 1) {
    const y = b0 + (b1 - b0) * (0.25 + 0.16 * k)
    L.push(P(caixa(a0 + 3, y - 0.5, a1 - 3, y + 0.5), BURACO, { tabua: 0, bisel: 0, contorno: 0.1, tom: 0.7, semente: 17420 + k }))
  }

  // ---------- as pernas: tampos de disco do chão ao alto, cada um um passo para dentro, na cor da faixa ----------
  // De cima, a perna é a risca do pé ao alto em pedaços, um por tampo; a caixa de cada pedaço fica centrada no tico
  // de fora do tampo dele (o de cima já entrou um passo e não chega lá), e o pedaço dá a cor da frente do tampo.
  const rPerna = f(RAIO_DA_PERNA)
  for (let i = 0; i < 3; i += 1) {
    const [ux, uy] = [Math.cos(ANGULOS_DAS_PERNAS[i]), Math.sin(ANGULOS_DAS_PERNAS[i])]
    let anterior = perna(i, 0)
    for (let j = 0; j < niveis; j += 1) {
      const z = (Ht * (j + 1)) / niveis
      const [x, y] = perna(i, z - e / 2)
      S.push(solta(j === niveis - 1 ? noAlto(disco(x, y, rPerna)) : disco(x, y, rPerna), z, FORCA_DA_SOMBRA_DA_PERNA))
      const pedaco = capsula(anterior[0], anterior[1], x, y, rPerna)
      L.push(P(comMeioEm(pedaco, x + ux * (rPerna - 0.15), y + uy * (rPerna - 0.15)), corDaFaixa(z - e / 2), { tabua: 0, eixo: ANGULOS_DAS_PERNAS[i], bisel: rPerna * 0.6, contorno: 0.3, metal: 0.2, semente: 17430 + i * 100 + j }))
      anterior = [x, y]
    }
  }

  // ---------- as travessas de cada faixa (triângulos) e uma diagonal por face, em zigue-zague ----------
  const rTravessa = f(RAIO_DA_TRAVESSA)
  for (let k = 1; k <= FAIXAS; k += 1) {
    const z = (Ht * k) / FAIXAS
    const cantos = [0, 1, 2].map((i) => perna(i, z))
    const triangulo = uniao(uniao(capsula(cantos[0][0], cantos[0][1], cantos[1][0], cantos[1][1], rTravessa), capsula(cantos[1][0], cantos[1][1], cantos[2][0], cantos[2][1], rTravessa)), capsula(cantos[2][0], cantos[2][1], cantos[0][0], cantos[0][1], rTravessa))
    S.push(solta(k === FAIXAS ? noAlto(triangulo) : triangulo, z, 0.14))
    const mat = corDaFaixa(z - e)
    // De cima, cada lado da travessa é uma peça: a caixa de cada uma fica centrada no meio do lado, longe dos discos
    // das diagonais (que andam meio passo para dentro a cada faixa), e assim sobe com a travessa.
    for (let i = 0; i < 3; i += 1) {
      const [p, q] = [cantos[i], cantos[(i + 1) % 3]]
      L.push(P(capsula(p[0], p[1], q[0], q[1], rTravessa), mat, { tabua: 0, eixo: Math.atan2(q[1] - p[1], q[0] - p[0]), bisel: rTravessa, contorno: 0.3, metal: 0.2, semente: 17810 + k * 3 + i }))
    }
    // A diagonal de cada face, da perna de baixo de um lado à de cima do outro (alterna de faixa em faixa): cada
    // disco é um tampo, e o pedaço que chega nele sobe com ele.
    const z0 = (Ht * (k - 1)) / FAIXAS
    for (let i = 0; i < 3; i += 1) {
      const [ia, ib] = k % 2 === 0 ? [i, (i + 1) % 3] : [(i + 1) % 3, i]
      const [p, q] = [perna(ia, z0), perna(ib, z)]
      let anterior: Ponto = p
      for (let d = 1; d <= DISCOS_DA_DIAGONAL; d += 1) {
        const t = d / (DISCOS_DA_DIAGONAL + 1)
        const [x, y] = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]
        const zd = z0 + (z - z0) * t
        S.push(solta(disco(x, y, rTravessa), zd))
        const fim: Ponto = d === DISCOS_DA_DIAGONAL ? q : [x, y]
        const pedaco = capsula(anterior[0], anterior[1], fim[0], fim[1], rTravessa * 0.85)
        L.push(P(comMeioEm(pedaco, x, y), corDaFaixa(zd), { tabua: 0, bisel: rTravessa * 0.5, contorno: 0.26, tom: 0.94, semente: 17820 + k * 40 + i * 10 + d }))
        anterior = [x, y]
      }
    }
  }

  // ---------- a antena de prato a meia altura, presa numa perna, virada para fora ----------
  const zPrato = (Ht * (PRATO_NA_FAIXA + 0.5)) / FAIXAS
  const [ppx, ppy] = perna(PRATO_NA_PERNA, zPrato)
  const ang = ANGULOS_DAS_PERNAS[PRATO_NA_PERNA]
  const [dx, dy] = [ppx + Math.cos(ang) * f(PRATO_SAI), ppy + Math.sin(ang) * f(PRATO_SAI)]
  const rPrato = f(RAIO_DO_PRATO)
  discosQueAlargam(P, cena, [dx, dy], rPrato, 0.25, { de: zPrato - e, ate: zPrato + e, espessura: e, forca: 0.2 }, BRANCO, 18200)
  L.push(P(disco(dx, dy, rPrato), BRANCO, { tabua: 0, bisel: rPrato * 0.5, tom: 1.02, contorno: 0.32, recesso: { k: 2, forca: 0.4 }, semente: 18210 }))
  L.push(P(disco(dx, dy, rPrato * 0.22), ACO, { tabua: 0, bisel: 0.5, contorno: 0.3, metal: 0.4, projeta: { dist: 1, forca: 0.3 }, semente: 18211 }))

  // ---------- no alto: a plataforma, as três antenas de painel e o mastro com a luz vermelha ----------
  const topo = [0, 1, 2].map((i) => perna(i, Ht))
  const plataforma = poligono(topo.map(([x, y]): Ponto => [x * 1.35, y * 1.35]))
  S.push(solta(noAlto(plataforma, 0.1), Ht + e * 0.5, 0.2))
  L.push(P(plataforma, ACO, { tabua: 2.2, bisel: 0.6, tom: 1.08, contorno: 0.32, metal: 0.3, semente: 18220 }))
  topo.forEach(([x, y], i) => {
    const ang2 = ANGULOS_DAS_PERNAS[i]
    const [tx, ty] = [-Math.sin(ang2), Math.cos(ang2)]
    const [ax, ay] = [x * 1.25, y * 1.25]
    const [mw, mg] = [f(MEIA_ANTENA[0]), f(MEIA_ANTENA[1])]
    const painel = poligono([
      [ax - tx * mw - Math.cos(ang2) * mg, ay - ty * mw - Math.sin(ang2) * mg],
      [ax + tx * mw - Math.cos(ang2) * mg, ay + ty * mw - Math.sin(ang2) * mg],
      [ax + tx * mw + Math.cos(ang2) * mg, ay + ty * mw + Math.sin(ang2) * mg],
      [ax - tx * mw + Math.cos(ang2) * mg, ay - ty * mw + Math.sin(ang2) * mg],
    ])
    S.push(solta(noAlto(painel, 0.2), Ht + ALTURA_DAS_ANTENAS * lado, 0.2), solta(noAlto(painel, 0.2), Ht + ALTURA_DAS_ANTENAS * lado * 0.5))
    L.push(P(painel, BRANCO, { tabua: 0, eixo: ang2, bisel: 0.6, tom: 1.06 - 0.06 * hash(i, 1, 1823), contorno: 0.34, projeta: { dist: 1.2, forca: 0.32 }, semente: 18230 + i }))
  })
  const rMastro = f(RAIO_DO_MASTRO)
  discosQueAlargam(P, cena, [0, 0], rMastro, 0.02, { de: Ht, ate: Ht + ALTURA_DO_MASTRO * lado, espessura: e, forca: 0.18, estica: (forma) => noAlto(forma, 0.3) }, BRANCO, 18240)
  L.push(P(disco(0, 0, f(RAIO_DA_LUZ)), LUZ_VERMELHA, { tabua: 0, bisel: f(RAIO_DA_LUZ) * 0.6, tom: 1.05, contorno: 0.34, projeta: { dist: 1, forca: 0.3 }, semente: 18290 }))
  L.push(P(disco(-f(0.012), -f(0.012), f(0.014)), BRANCO, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.7, semente: 18291 }))
}
