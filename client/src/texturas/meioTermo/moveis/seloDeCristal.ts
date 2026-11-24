/**
 * SELO DE CRISTAL (lote L06 de 24/11/2026, item 60, do cruzamento da cripta do mapa 8; desenho próprio, só a ideia do
 * objeto). Um LOSANGO DE CRISTAL ciano embutido no piso, lapidado em dois degraus e mesa (as facetas de cada degrau
 * alternam claro e escuro, como numa pedra talhada), com o PONTO DE LUZ no meio: o miolo quase branco e a estrelinha
 * de quatro pontas. Em volta, o engaste de ferro e a MOLDURA de quatro lajes de pedra, com um filete gravado por onde
 * a luz corre e um cabochão de cristal em cada ponta do losango.
 *
 * É objeto de CHÃO RENTE, como o círculo mágico: nenhuma sombra, nenhuma altura; mora por baixo dos outros objetos e
 * das fichas, e a 3/4 sai igual à vista de cima. A luz de verdade é a do integrador (`LUZ_DOS_OBJETOS`): por ser
 * objeto, e não carimbo, ele pode ter a sua.
 *
 * Esticado, o losango acompanha a pegada (as meias diagonais são os meios lados). Material: `pedra` (a moldura); o
 * cristal e o ferro são fixos.
 */
import { hash, limitar01 } from '../../ruido'
import { cadeia, dentroDe, elipse, menos, poligono, type Forma, type Ponto } from './formas'
import { texturaDaClasse, type MaterialDaPeca, type Textura } from './motor'
import { materialDaPeca, type MontarMovel } from './contexto'
import { ESCURO_DA_PEDRA } from './apoioDasReferencias'
import { banhada, CIANO, CRISTAL, MUSGO_DA_CRIPTA, texHaloFrio, tomDoCristal, type FonteFria } from './pedestalComCristal'

/** Os losangos, em fração das meias diagonais: a junta, a moldura (de fora e de dentro), o engaste, os dois degraus e a mesa. */
const K = { junta: 0.99, fora: 0.965, dentro: 0.7, engaste: 0.672, degrau: 0.47, mesa: 0.29 } as const
/** O filete gravado no meio da moldura e o cabochão de cada ponta (fração das meias diagonais; raio em px). */
const FILETE = 0.835
const CABOCHAO = 3.1
/** A fresta entre duas lajes da moldura e entre duas facetas (px). */
const FRESTA_DA_PEDRA = 0.4
const FRESTA_DO_CRISTAL = 0.14
/**
 * O tom de cada faceta, na ordem dos lados (de cima à direita, de baixo à direita, de baixo à esquerda, de cima à
 * esquerda): o degrau de fora pega a luz de cima à esquerda; o de dentro devolve o reflexo do outro lado.
 */
const TONS_DE_FORA: readonly number[] = [0.62, 0.16, 0.4, 0.9]
const TONS_DE_DENTRO: readonly number[] = [0.46, 0.84, 0.68, 0.3]
/** O ponto de luz: o raio do miolo (fração do menor meio lado) e o braço da estrelinha. */
const MIOLO = 0.2
const BRACO = 0.27
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

  /** As quatro pontas do losango de fração `k`: a de cima, a da direita, a de baixo e a da esquerda. */
  const pontas = (k: number): Ponto[] => [[0, -k * hh], [k * hw, 0], [0, k * hh], [-k * hw, 0]]
  const losango = (k: number): Forma => poligono(pontas(k))
  /** O trapézio do lado `i` entre dois losangos. */
  const lado = (i: number, fora: number, dentro: number): Forma => {
    const [a, b] = [pontas(fora), pontas(dentro)]
    return poligono([a[i], a[(i + 1) % 4], b[(i + 1) % 4], b[i]])
  }
  const fontes: FonteFria[] = [{ x: 0, y: 0, r: R * 0.74, forca: 0.3 }]
  const naPedra = banhada(daPedra, fontes)
  const luzPura = (cor: readonly [number, number, number]): Textura => (_u, _v, _x, _y, _p, s) => {
    s[0] = cor[0]
    s[1] = cor[1]
    s[2] = cor[2]
    s[4] = 1
  }

  // O halo no piso em volta e a junta de pó.
  L.push(P(elipse(0, 0, hw * 1.04, hh * 1.04), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, textura: texHaloFrio(0, 0, hw * 1.04, hh * 1.04, 0.3), semente: SEMENTE }))
  L.push(P(losango(K.junta), FUNDO_DA_JUNTA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.74, suave: 0.6, semente: SEMENTE + 1 }))

  // A MOLDURA: quatro lajes de pedra, com a fresta nas pontas.
  for (let i = 0; i < 4; i += 1) {
    L.push(P(encolhida(lado(i, K.fora, K.dentro), FRESTA_DA_PEDRA), pedra, { tabua: 0, bisel: 0.9, tom: 0.86 + 0.1 * hash(i, 1, SEMENTE), contorno: 0.24, textura: naPedra, semente: SEMENTE + 2 + i }))
  }
  // O FILETE gravado no meio da moldura (interrompido nas pontas, onde ficam os cabochões) e a luz que corre nele.
  const [pFora, pDentro] = [pontas(FILETE + 0.012), pontas(FILETE - 0.012)]
  const fio = pontas(FILETE)
  const semAsPontas = (f: Forma): Forma => pontas(FILETE).reduce((forma, [px, py]) => menos(forma, elipse(px, py, CABOCHAO + 2.6, CABOCHAO + 2.6)), f)
  const canal = semAsPontas(menos(poligono(pFora), poligono(pDentro)))
  L.push(P(canal, pedra, { tabua: 0, bisel: 0, contorno: 0, tom: 0.56, recesso: { k: 0.5, forca: 0.3 }, semente: SEMENTE + 8 }))
  L.push(P(semAsPontas(cadeia([...fio, fio[0]], 0.26)), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.7, textura: luzPura(CIANO.claro), semente: SEMENTE + 9 }))
  // As marcas do tempo: uma trinca numa laje e o musgo na junta.
  L.push(P(cadeia([[-hw * 0.6, -hh * 0.36], [-hw * 0.5, -hh * 0.3], [-hw * 0.47, -hh * 0.2], [-hw * 0.37, -hh * 0.14]], 0.3), pedra, { tabua: 0, bisel: 0, tom: 0.44, contorno: 0, semente: SEMENTE + 10 }))
  L.push(P(dentroDe(elipse(-hw * 0.52, hh * 0.47, 7, 7), menos(losango(K.junta + 0.03), losango(K.fora - 0.035))), MUSGO_DA_CRIPTA, { tabua: 0, bisel: 0.3, contorno: 0.08, alfa: 0.55, suave: 1.2, semente: SEMENTE + 11 }))

  // O ENGASTE de ferro em volta do cristal.
  L.push(P(losango(K.dentro), FERRO, { tabua: 0, bisel: 0.7, tom: 0.84, metal: 0.24, contorno: 0.3, semente: SEMENTE + 12 }))

  // O CRISTAL: o fundo (o que aparece nas frestas), os dois degraus de facetas e a mesa.
  L.push(P(losango(K.engaste), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, textura: luzPura(CIANO.fundo), semente: SEMENTE + 13 }))
  const faceta = (tom: number, paraOMeio: number): Textura => (_u, _v, x, y, _p, s) => {
    // Cada faceta clareia um pouco para o lado do miolo: a luz vem de dentro.
    const dentro = 1 - limitar01((Math.abs(x) / hw + Math.abs(y) / hh - K.mesa) / (K.engaste - K.mesa))
    const cor = tomDoCristal(tom + paraOMeio * dentro)
    s[0] = cor[0]
    s[1] = cor[1]
    s[2] = cor[2]
    s[4] = 0.5
  }
  for (let i = 0; i < 4; i += 1) {
    L.push(P(encolhida(lado(i, K.engaste, K.degrau), FRESTA_DO_CRISTAL), CRISTAL, { tabua: 0, bisel: 0, contorno: 0.1, textura: faceta(TONS_DE_FORA[i], 0.1), semente: SEMENTE + 14 + i }))
    L.push(P(encolhida(lado(i, K.degrau, K.mesa), FRESTA_DO_CRISTAL), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, textura: faceta(TONS_DE_DENTRO[i], 0.16), semente: SEMENTE + 18 + i }))
  }
  // A mesa: clara, com o MIOLO quase branco no meio.
  const mesa: Textura = (_u, _v, x, y, _p, s) => {
    const d = Math.hypot(x / hw, y / hh) / K.mesa
    const cor = tomDoCristal(0.74 + 0.26 * (1 - limitar01(d)))
    const w = 0.85 * Math.exp(-d * d * 3.4)
    s[0] = cor[0] + (CIANO.reflexo[0] - cor[0]) * w
    s[1] = cor[1] + (CIANO.reflexo[1] - cor[1]) * w
    s[2] = cor[2] + (CIANO.reflexo[2] - cor[2]) * w
    s[4] = 0.8
  }
  L.push(P(encolhida(losango(K.mesa), FRESTA_DO_CRISTAL), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, textura: mesa, semente: SEMENTE + 22 }))
  // Os fios de reflexo nas quinas: das pontas do cristal até a mesa.
  const [pe, pm] = [pontas(K.engaste - 0.012), pontas(K.mesa)]
  for (let i = 0; i < 4; i += 1) L.push(P(cadeia([pe[i], pm[i]], 0.2), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, alfa: i === 0 || i === 3 ? 0.6 : 0.34, textura: luzPura(CIANO.reflexo), semente: SEMENTE + 23 + i }))
  // As inclusões: pontinhos claros presos na pedra.
  for (let i = 0; i < 7; i += 1) {
    const a = hash(i, 1, SEMENTE + 30) * Math.PI * 2
    const d = 0.34 + 0.28 * hash(i, 2, SEMENTE + 30)
    const r = 0.35 + 0.4 * hash(i, 3, SEMENTE + 30)
    L.push(P(elipse(Math.cos(a) * d * hw * 0.7, Math.sin(a) * d * hh * 0.7, r, r), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.5, suave: 0.3, textura: luzPura(CIANO.reflexo), semente: SEMENTE + 31 + i }))
  }

  // O PONTO DE LUZ: o clarão macio no meio e a estrelinha de quatro pontas.
  const rMiolo = MIOLO * R
  L.push(P(elipse(0, 0, rMiolo * 1.7, rMiolo * 1.7), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, textura: (_u, _v, x, y, _p, s) => {
    const d2 = (x * x + y * y) / (rMiolo * rMiolo * 2.89)
    s[0] = 0xf4
    s[1] = 0xfc
    s[2] = 0xfb
    s[4] = 1
    s[5] = 0.9 * (1 - limitar01(d2)) * (1 - limitar01(d2))
  }, semente: SEMENTE + 40 }))
  const b = BRACO * R
  const fino = b * 0.085
  L.push(P(poligono([[0, -b], [fino, -fino], [b, 0], [fino, fino], [0, b], [-fino, fino], [-b, 0], [-fino, -fino]]), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, suave: 0.3, textura: luzPura([0xfa, 0xfe, 0xfd]), semente: SEMENTE + 41 }))
  L.push(P(elipse(0, 0, fino * 1.7, fino * 1.7), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, suave: 0.4, textura: luzPura([0xff, 0xff, 0xff]), semente: SEMENTE + 42 }))

  // Os CABOCHÕES das quatro pontas: o engaste de ferro e a gota de cristal, com o reflexo do lado da luz.
  pontas(FILETE).forEach(([px, py], i) => {
    L.push(P(elipse(px, py, CABOCHAO + 1.1, CABOCHAO + 1.1), FERRO, { tabua: 0, bisel: 0.7, tom: 0.84, metal: 0.24, contorno: 0.3, semente: SEMENTE + 50 + i }))
    L.push(P(elipse(px, py, CABOCHAO, CABOCHAO), CRISTAL, { tabua: 0, bisel: CABOCHAO * 0.7, contorno: 0.14, textura: (_u, _v, x, y, _p, s) => {
      const cor = tomDoCristal(0.66 - 0.4 * limitar01(Math.hypot(x - px, y - py) / CABOCHAO) + 0.16 * ((px - x) + (py - y)) / CABOCHAO)
      s[0] = cor[0]
      s[1] = cor[1]
      s[2] = cor[2]
      s[4] = 0.55
    }, semente: SEMENTE + 54 + i }))
    L.push(P(elipse(px - CABOCHAO * 0.34, py - CABOCHAO * 0.36, CABOCHAO * 0.26, CABOCHAO * 0.2), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.8, suave: 0.3, textura: luzPura(CIANO.reflexo), semente: SEMENTE + 58 + i }))
  })
}
