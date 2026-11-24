/**
 * SELO DE CRISTAL (lote L06 de 24/11/2026, item 60, do cruzamento da cripta do mapa 8; desenho próprio, só a ideia do
 * objeto). Um LOSANGO DE CRISTAL ciano embutido no piso, uma PEDRA LAPIDADA velha: dois degraus de facetas e a mesa.
 * As facetas têm tons desencontrados (o degrau de fora é cortado em oito, de larguras diferentes, e não alterna só
 * claro e escuro), o ciano do degrau de fora perdeu um quarto da saturação e puxa para o azul-acinzentado, e a pedra
 * tem defeito: três trincas finas, uma inclusão leitosa e o véu de dentro. No meio, o PONTO DE LUZ, pequeno: o miolo
 * claro e a estrelinha de quatro pontas. Em volta, o engaste de ferro e a MOLDURA de quatro lajes de pedra, com um
 * filete gravado por onde a luz corre e um cabochão de cristal em cada ponta do losango.
 *
 * É objeto de CHÃO RENTE, como o círculo mágico: nenhuma sombra, nenhuma altura; mora por baixo dos outros objetos e
 * das fichas, e a 3/4 sai igual à vista de cima. A luz de verdade é a do integrador (`LUZ_DOS_OBJETOS`): por ser
 * objeto, e não carimbo, ele pode ter a sua.
 *
 * Esticado, o losango acompanha a pegada (as meias diagonais são os meios lados). Material: `pedra` (a moldura); o
 * cristal e o ferro são fixos.
 *
 * Revisão do diretor de arte (24/11/2026): lia como ícone de app ou pirâmide vetorial, a área mais clara e saturada
 * da sala. A estrela de luz encolheu (a pedra lê antes do brilho) e o musgo que passava da moldura ficou preso nela.
 */
import { hash, limitar01 } from '../../ruido'
import { cadeia, dentroDe, elipse, elipseGirada, menos, poligono, type Forma, type Ponto } from './formas'
import { texturaDaClasse, type MaterialDaPeca, type Textura } from './motor'
import { materialDaPeca, type MontarMovel } from './contexto'
import { noObjeto } from './pilhaDeFatias'
import { quartosDoGiro } from './pipaDeitada'
import { ESCURO_DA_PEDRA } from './apoioDasReferencias'
import { banhada, CIANO, corAcesa, CRISTAL, MUSGO, MUSGO_DA_CRIPTA, musgoPreso, texDaFaceta, texHaloFrio, tomDaLapidacao, type FonteFria } from './pedestalComCristal'

/** Os losangos, em fração das meias diagonais: a junta, a moldura (de fora e de dentro), o engaste, os dois degraus e a mesa. */
const K = { junta: 0.99, fora: 0.965, dentro: 0.7, engaste: 0.672, degrau: 0.47, mesa: 0.29 } as const
/** O filete gravado no meio da moldura e o cabochão de cada ponta (fração das meias diagonais; raio em px). */
const FILETE = 0.835
const CABOCHAO = 3.1
/** A fresta entre duas lajes da moldura e entre duas facetas (px). */
const FRESTA_DA_PEDRA = 0.4
const FRESTA_DO_CRISTAL = 0.16
/**
 * O degrau de FORA, lado a lado NA TELA (de cima à direita, de baixo à direita, de baixo à esquerda, de cima à
 * esquerda): onde o lado é cortado em dois (fração do comprimento, nunca no meio) e o tom de cada metade. Os tons não
 * alternam: a luz vem de cima à esquerda (e fica lá com o selo girado), mas cada faceta tem o seu corte.
 */
const DEGRAU_DE_FORA: readonly (readonly [number, number, number])[] = [
  [0.4, 0.6, 0.42],
  [0.62, 0.18, 0.3],
  [0.36, 0.38, 0.24],
  [0.57, 0.7, 0.86],
]
/** O degrau de DENTRO devolve o reflexo do outro lado: um tom por lado, e nenhum repete o de fora. */
const DEGRAU_DE_DENTRO: readonly number[] = [0.36, 0.72, 0.56, 0.28]
/** Quanto cada parte perde de saturação: o degrau de fora, um quarto (o azul-acinzentado); para dentro, menos. */
const DESSATURA = { fora: 0.27, dentro: 0.18, mesa: 0.12 } as const
/** O ponto de luz: o raio do miolo e o braço da estrelinha (fração do menor meio lado: 15% da meia diagonal). */
const MIOLO = 0.085
const BRACO = 0.15
/** A junta de pó em volta, como a das lajes tumulares. */
const FUNDO_DA_JUNTA: MaterialDaPeca = { classe: 'liso', rgb: [0x40, 0x3c, 0x38] }
const FERRO = materialDaPeca('ferro')
const SEMENTE = 6000

/** A forma encolhida `d` px para dentro. */
function encolhida(f: Forma, d: number): Forma {
  return { b: f.b, d: (x, y) => f.d(x, y) + d }
}

export const montarSeloDeCristal: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const pedra = c.m.pedra
  const L = cena.partes
  const R = Math.min(hw, hh)
  const daPedra = texturaDaClasse(pedra.classe)
  cena.corDoPiso = ESCURO_DA_PEDRA
  // O quarto de volta que as duas vistas pintam: os tons das facetas e os reflexos ficam do lado da luz NA TELA.
  const q = quartosDoGiro(c.giro)
  const [luzX, luzY] = noObjeto(-1, -1, q)

  /** As quatro pontas do losango de fração `k`: a de cima, a da direita, a de baixo e a da esquerda. */
  const pontas = (k: number): Ponto[] => [[0, -k * hh], [k * hw, 0], [0, k * hh], [-k * hw, 0]]
  const losango = (k: number): Forma => poligono(pontas(k))
  const entre = (p: Ponto, r: Ponto, t: number): Ponto => [p[0] + (r[0] - p[0]) * t, p[1] + (r[1] - p[1]) * t]
  /** O trapézio do lado `i` entre dois losangos, do ponto `de` ao ponto `ate` do comprimento do lado (0 a 1). */
  const lado = (i: number, fora: number, dentro: number, de = 0, ate = 1): Forma => {
    const [a, b] = [pontas(fora), pontas(dentro)]
    const [a0, a1, b0, b1] = [a[i], a[(i + 1) % 4], b[i], b[(i + 1) % 4]]
    return poligono([entre(a0, a1, de), entre(a0, a1, ate), entre(b0, b1, ate), entre(b0, b1, de)])
  }
  const fontes: FonteFria[] = [{ x: 0, y: 0, r: R * 0.74, forca: 0.22 }]
  const naPedra = banhada(daPedra, fontes)

  // O halo no piso em volta (fraco: a pedra lê antes do brilho) e a junta de pó.
  L.push(P(elipse(0, 0, hw * 1.02, hh * 1.02), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, textura: texHaloFrio(0, 0, hw * 1.02, hh * 1.02, 0.2), semente: SEMENTE }))
  L.push(P(losango(K.junta), FUNDO_DA_JUNTA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.74, suave: 0.6, semente: SEMENTE + 1 }))

  // A MOLDURA: quatro lajes de pedra, com a fresta nas pontas.
  const lajes = [0, 1, 2, 3].map((i) => encolhida(lado(i, K.fora, K.dentro), FRESTA_DA_PEDRA))
  lajes.forEach((laje, i) => {
    L.push(P(laje, pedra, { tabua: 0, bisel: 0.9, tom: 0.86 + 0.1 * hash(i, 1, SEMENTE), contorno: 0.24, textura: naPedra, semente: SEMENTE + 2 + i }))
  })
  // O FILETE gravado no meio da moldura (interrompido nas pontas, onde ficam os cabochões) e a luz que corre nele.
  const [pFora, pDentro] = [pontas(FILETE + 0.012), pontas(FILETE - 0.012)]
  const fio = pontas(FILETE)
  const semAsPontas = (f: Forma): Forma => pontas(FILETE).reduce((forma, [px, py]) => menos(forma, elipse(px, py, CABOCHAO + 2.6, CABOCHAO + 2.6)), f)
  const canal = semAsPontas(menos(poligono(pFora), poligono(pDentro)))
  L.push(P(canal, pedra, { tabua: 0, bisel: 0, contorno: 0, tom: 0.56, recesso: { k: 0.5, forca: 0.3 }, semente: SEMENTE + 8 }))
  L.push(P(semAsPontas(cadeia([...fio, fio[0]], 0.26)), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.6, textura: corAcesa(CIANO.claro, 1), semente: SEMENTE + 9 }))
  // As marcas do tempo: uma trinca numa laje e o MUSGO, preso à laje em que cresce (na beira de fora dela, junto da junta).
  L.push(P(cadeia([[-hw * 0.6, -hh * 0.36], [-hw * 0.5, -hh * 0.3], [-hw * 0.47, -hh * 0.2], [-hw * 0.37, -hh * 0.14]], 0.3), pedra, { tabua: 0, bisel: 0, tom: 0.44, contorno: 0, semente: SEMENTE + 10 }))
  L.push(P(musgoPreso(elipseGirada(-hw * 0.5, hh * 0.44, 7.4, 2.6, -Math.atan2(hh, hw)), lajes[2]), MUSGO_DA_CRIPTA, { ...MUSGO, bisel: 0.3, contorno: 0.08, alfa: 0.5, semente: SEMENTE + 11 }))
  L.push(P(musgoPreso(elipseGirada(hw * 0.3, -hh * 0.655, 4.4, 1.8, -Math.atan2(hh, hw)), lajes[0]), MUSGO_DA_CRIPTA, { ...MUSGO, bisel: 0.3, contorno: 0.08, alfa: 0.4, semente: SEMENTE + 12 }))

  // O ENGASTE de ferro em volta do cristal.
  L.push(P(losango(K.dentro), FERRO, { tabua: 0, bisel: 0.7, tom: 0.84, metal: 0.24, contorno: 0.3, semente: SEMENTE + 13 }))

  // O CRISTAL: o fundo (o que aparece nas frestas), os dois degraus de facetas e a mesa.
  L.push(P(losango(K.engaste), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, textura: corAcesa(tomDaLapidacao(0, 0.2), 0.3), semente: SEMENTE + 14 }))
  /** A direção do lado `i` para o meio do selo (a luz vem de dentro: cada faceta clareia para lá). */
  const paraOMeio = (i: number): readonly [number, number] => {
    const [nx, ny] = [i === 0 || i === 1 ? -hh : hh, i === 0 || i === 3 ? hw : -hw]
    const n = Math.hypot(nx, ny)
    return [nx / n, ny / n]
  }
  for (let i = 0; i < 4; i += 1) {
    const [corte, tomA, tomB] = DEGRAU_DE_FORA[(i + q) % 4]
    const [dx, dy] = paraOMeio(i)
    const meio = pontas((K.engaste + K.degrau) / 2)
    const [mx, my] = entre(meio[i], meio[(i + 1) % 4], 0.5)
    const largura = (K.engaste - K.degrau) * R * 0.7
    const faceta = (tom: number, semente: number): Textura => texDaFaceta({ tom, dessatura: DESSATURA.fora, veu: 0.17, emissao: 0.34, clareia: { x: mx - (dx * largura) / 2, y: my - (dy * largura) / 2, dx, dy, em: largura, ganho: 0.14 } }, semente)
    L.push(P(encolhida(lado(i, K.engaste, K.degrau, 0, corte), FRESTA_DO_CRISTAL), CRISTAL, { tabua: 0, bisel: 0, contorno: 0.12, textura: faceta(tomA, SEMENTE + 20 + i), semente: SEMENTE + 20 + i }))
    L.push(P(encolhida(lado(i, K.engaste, K.degrau, corte, 1), FRESTA_DO_CRISTAL), CRISTAL, { tabua: 0, bisel: 0, contorno: 0.12, textura: faceta(tomB, SEMENTE + 24 + i), semente: SEMENTE + 24 + i }))
    const larguraDeDentro = (K.degrau - K.mesa) * R * 0.7
    const [ix, iy] = entre(pontas((K.degrau + K.mesa) / 2)[i], pontas((K.degrau + K.mesa) / 2)[(i + 1) % 4], 0.5)
    L.push(P(encolhida(lado(i, K.degrau, K.mesa), FRESTA_DO_CRISTAL), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, textura: texDaFaceta({ tom: DEGRAU_DE_DENTRO[(i + q) % 4], dessatura: DESSATURA.dentro, veu: 0.14, emissao: 0.42, clareia: { x: ix - (dx * larguraDeDentro) / 2, y: iy - (dy * larguraDeDentro) / 2, dx, dy, em: larguraDeDentro, ganho: 0.2 } }, SEMENTE + 28 + i), semente: SEMENTE + 28 + i }))
  }
  // A mesa: o tom do meio da rampa com o véu, e o MIOLO claro só bem no meio.
  const base = texDaFaceta({ tom: 0.6, dessatura: DESSATURA.mesa, veu: 0.13, emissao: 0.5 }, SEMENTE + 32)
  const mesa: Textura = (u, v, x, y, p, s, escala) => {
    base(u, v, x, y, p, s, escala)
    const d = Math.hypot(x / hw, y / hh) / K.mesa
    const w = 0.7 * Math.exp(-d * d * 7)
    s[0] += (CIANO.reflexo[0] - s[0]) * w
    s[1] += (CIANO.reflexo[1] - s[1]) * w
    s[2] += (CIANO.reflexo[2] - s[2]) * w
    s[4] = 0.5 + 0.4 * w
  }
  L.push(P(encolhida(losango(K.mesa), FRESTA_DO_CRISTAL), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, textura: mesa, semente: SEMENTE + 33 }))
  // Os fios de reflexo nas quinas: das pontas do cristal até a mesa, só do lado da luz.
  const [pe, pm] = [pontas(K.engaste - 0.012), pontas(K.mesa)]
  for (let i = 0; i < 4; i += 1) {
    // A quina de cima e a da esquerda NA TELA são as que pegam a luz.
    const naTela = (i + q) % 4
    L.push(P(cadeia([pe[i], pm[i]], 0.2), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, alfa: naTela === 0 || naTela === 3 ? 0.5 : 0.2, textura: corAcesa(CIANO.reflexo, 1), semente: SEMENTE + 34 + i }))
  }

  // Os DEFEITOS da pedra velha. As três TRINCAS finas: um fio claro (a fratura pega a luz) com o risco escuro do
  // lado da sombra; atravessam facetas, sem respeitar o corte.
  const cristal = losango(K.engaste - 0.02)
  const trincas: readonly (readonly Ponto[])[] = [
    [[hw * 0.5, -hh * 0.1], [hw * 0.37, -hh * 0.2], [hw * 0.3, -hh * 0.14], [hw * 0.16, -hh * 0.3], [hw * 0.11, -hh * 0.24]],
    [[-hw * 0.3, hh * 0.3], [-hw * 0.22, hh * 0.18], [-hw * 0.27, hh * 0.1], [-hw * 0.15, hh * 0.02]],
    [[hw * 0.04, hh * 0.56], [hw * 0.1, hh * 0.4], [hw * 0.05, hh * 0.33]],
  ]
  trincas.forEach((pontos, k) => {
    const deslocada = pontos.map(([px, py]): Ponto => [px + 0.5, py + 0.5])
    L.push(P(dentroDe(cadeia(deslocada, 0.24), cristal), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.42, textura: corAcesa(tomDaLapidacao(0, 0.2), 0.2), semente: SEMENTE + 40 + k }))
    L.push(P(dentroDe(cadeia(pontos, 0.15), cristal), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.5, textura: corAcesa(CIANO.reflexo, 0.9), semente: SEMENTE + 44 + k }))
  })
  // A INCLUSÃO leitosa numa faceta escura (embaixo à direita): uma pluma de três véus finos, desencontrados, sem
  // contorno (uma elipse só, com miolo, lia como bolha), e uns grãos presos na pedra.
  const plumas: readonly (readonly [number, number, number, number, number, number])[] = [
    [0.24, 0.31, 7, 1.3, 0.86, 0.3],
    [0.29, 0.27, 4.6, 0.9, 1.06, 0.34],
    [0.22, 0.36, 3.4, 0.8, 0.62, 0.26],
  ]
  plumas.forEach(([fx, fy, rx, ry, giro, alfa], k) => {
    L.push(P(dentroDe(elipseGirada(hw * fx, hh * fy, rx, ry, giro), cristal), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, alfa, suave: 1.1, textura: corAcesa(CIANO.claro, 0.6), semente: SEMENTE + 47 + k }))
  })
  for (let i = 0; i < 6; i += 1) {
    const a = hash(i, 1, SEMENTE + 30) * Math.PI * 2
    const d = 0.34 + 0.28 * hash(i, 2, SEMENTE + 30)
    const r = 0.3 + 0.36 * hash(i, 3, SEMENTE + 30)
    L.push(P(elipse(Math.cos(a) * d * hw * 0.7, Math.sin(a) * d * hh * 0.7, r, r), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.42, suave: 0.3, textura: corAcesa(CIANO.reflexo, 1), semente: SEMENTE + 50 + i }))
  }

  // O PONTO DE LUZ, pequeno: o clarão macio no meio e a estrelinha de quatro pontas.
  const rMiolo = MIOLO * R
  L.push(P(elipse(0, 0, rMiolo * 1.7, rMiolo * 1.7), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, textura: (_u, _v, x, y, _p, s) => {
    const d2 = (x * x + y * y) / (rMiolo * rMiolo * 2.89)
    s[0] = 0xf4
    s[1] = 0xfc
    s[2] = 0xfb
    s[4] = 1
    s[5] = 0.82 * (1 - limitar01(d2)) * (1 - limitar01(d2))
  }, semente: SEMENTE + 60 }))
  const b = BRACO * R
  const fino = b * 0.1
  L.push(P(poligono([[0, -b], [fino, -fino], [b, 0], [fino, fino], [0, b], [-fino, fino], [-b, 0], [-fino, -fino]]), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, suave: 0.3, alfa: 0.9, textura: corAcesa([0xfa, 0xfe, 0xfd], 1), semente: SEMENTE + 61 }))
  L.push(P(elipse(0, 0, fino * 1.6, fino * 1.6), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, suave: 0.4, textura: corAcesa([0xff, 0xff, 0xff], 1), semente: SEMENTE + 62 }))

  // Os CABOCHÕES das quatro pontas: o engaste de ferro e a gota de cristal, com o reflexo do lado da luz.
  pontas(FILETE).forEach(([px, py], i) => {
    L.push(P(elipse(px, py, CABOCHAO + 1.1, CABOCHAO + 1.1), FERRO, { tabua: 0, bisel: 0.7, tom: 0.84, metal: 0.24, contorno: 0.3, semente: SEMENTE + 70 + i }))
    L.push(P(elipse(px, py, CABOCHAO, CABOCHAO), CRISTAL, { tabua: 0, bisel: CABOCHAO * 0.7, contorno: 0.14, textura: (_u, _v, x, y, _p, s) => {
      const cor = tomDaLapidacao(0.56 - 0.4 * limitar01(Math.hypot(x - px, y - py) / CABOCHAO) + (0.16 * ((x - px) * luzX + (y - py) * luzY)) / CABOCHAO, 0.16)
      s[0] = cor[0]
      s[1] = cor[1]
      s[2] = cor[2]
      s[4] = 0.5
    }, semente: SEMENTE + 74 + i }))
    L.push(P(elipse(px + luzX * CABOCHAO * 0.35, py + luzY * CABOCHAO * 0.35, CABOCHAO * 0.24, CABOCHAO * 0.24), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.8, suave: 0.3, textura: corAcesa(CIANO.reflexo, 1), semente: SEMENTE + 78 + i }))
  })
}
