/**
 * ARANDELA DE CRISTAL (lote L06 de 24/11/2026, item 55: versão da `tochaDeParede`, dos corredores da cripta do mapa
 * 8; desenho próprio, só a ideia do objeto). O suporte de parede de ferro forjado com CRISTAIS ciano no lugar do
 * fogo. A PAREDE é a beira de cima da pegada (giro 0), como na tocha: ali fica a CHAPA com os dois rebites, de onde
 * sai o BRAÇO grosso, com o nó forjado, até a COPA (a argola com as garras). Da copa sai o NINHO de três prismas
 * apontando para fora da parede, abertos em leque (o do meio tem 0,28 casa). A luz aparece na grade: o claro em
 * leque no chão à frente (a meia elipse rente ao chão, de 0,6 x 0,4 casa) e o claro no trecho de parede atrás.
 *
 * A luz é FRIA E NÃO TREME (a de verdade é a do integrador, `LUZ_DOS_OBJETOS`): não há chama animada nem
 * Aceso/Apagado. Feita para ir às dezenas ao longo de um corredor, girada para cada parede: miúda e sem sombra no
 * chão (ela é a luz).
 *
 * As duas vistas saem da PILHA DE FATIAS (`pilhaDeFatias.ts`). NA 3/4 ela sobe POUCO, como a tocha de parede (decisão
 * 27 do mestre, 12/11/2026): a parede do app é uma linha sem altura, então todas as alturas encolhem por
 * `SUBIDA_DA_TOCHA_DE_PAREDE` e a chapa continua na linha da parede. Perfil da 3/4:
 * `{ modo: 'derivado', espessura: 0 }`. Material: `metal` (a chapa, o braço e a copa); o cristal é fixo.
 *
 * Revisão do diretor de arte (24/11/2026): o cristal único pendurado lia como pingente ou picolé e, a 50%, virava
 * um ponto; virou o ninho de três prismas. A chapa ganhou os rebites à vista, o braço engrossou 20% e a mancha de
 * luz, que na 3/4 parecia fumaça embaixo do cristal, virou a meia elipse chata no chão.
 */
import { SUBIDA_DA_TOCHA_DE_PAREDE } from '../../../lib/mobilia/fogoDeCasa'
import type { Rgb } from '../../ruido'
import { anel, caixa, capsula, dentroDe, elipse, poligono, uniao } from './formas'
import { texturaDaClasse, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import { alturas, novoFatiador } from './pilhaDeFatias'
import { lisa, luzDaNormal } from './apoioDasReferencias'
import { banhada, CRISTAL, graoNaAltura, LUZ_FRIA, prismaDeitado, type FonteFria } from './pedestalComCristal'

/** As medidas de cima, em fração do menor meio lado; o `y` conta da parede (a beira de cima da pegada). */
const MEIA_LARGURA_DA_CHAPA = 0.5
const GROSSURA_DA_CHAPA = 0.27
const RAIO_DO_REBITE = 0.105
const RAIO_DO_BRACO = 0.102
const COPA_EM = 0.62
const COPA_DE_FORA = 0.33
const COPA_DE_DENTRO = 0.2
/** O nó forjado no meio do braço: onde fica (da parede) e as meias medidas do losango. */
const NO_DO_BRACO = { da: 0.36, larga: 0.22, alta: 0.13 } as const
/**
 * O NINHO: três prismas que saem da copa para fora da parede. De cada um, o rumo (graus a partir da direção "para
 * fora da parede"), o comprimento (casas; o do meio tem 0,28) e a meia largura (fração do menor meio lado).
 */
const PRISMAS: readonly (readonly [number, number, number])[] = [
  [-49, 0.18, 0.16],
  [34, 0.23, 0.17],
  [-5, 0.28, 0.21],
]
/** As alturas do desenho em pé, em lados (o menor lado da pegada): encolhem por `SUBIDA_DA_TOCHA_DE_PAREDE`. */
const ALTURA = { chapa: 0.9, braco: 0.72, copa: 0.84, cristal: 1.1, garras: 1.5 } as const
/** O claro em leque no chão: a largura e a fundura (casas), o alfa junto da parede e a beira macia (px). */
const CLARO_NO_CHAO = { larga: 0.6, funda: 0.4, alfa: 0.3, beira: 2.2 } as const
/** O claro no trecho de parede atrás: a meia largura e a fundura (fração do menor meio lado) e o alfa. */
const CLARO_NA_PAREDE = { larga: 1.25, funda: 0.3, alfa: 0.46 } as const
const TOM_DA_CHAPA = 0.94
const TOM_DO_BRACO = 1.04
const BRILHO_DO_FERRO = 0.34
const ESCURO_DO_FERRO: Rgb = [0x4a, 0x45, 0x41]
const GRAUS = Math.PI / 180
const SEMENTE = 5500

const DO_METAL = texturaDaClasse('metal')

/** O ferro torcido do braço: a textura do metal com as voltas da torção em diagonal. */
const texTorcido: Textura = (u, v, x, y, p, s, escala) => {
  if (DO_METAL !== null) DO_METAL(u, v, x, y, p, s, escala)
  s[3] += 0.13 * Math.sin((x + y) * 2.3)
}

export const montarArandelaDeCristal: MontarMovel = (c, cena) => {
  const P = c.peca
  const R = Math.min(c.hw, c.hh)
  const lado = 2 * R
  const ferro = c.m.metal
  const L = cena.partes
  const f = novoFatiador(P, cena, c.giro)
  const q = f.q
  cena.corDoPiso = ESCURO_DO_FERRO
  const parede = -c.hh
  const yCopa = parede + COPA_EM * R
  const alto = (emLados: number): number => emLados * lado * SUBIDA_DA_TOCHA_DE_PAREDE
  const fontes: FonteFria[] = [{ x: 0, y: yCopa + 0.3 * R, r: 0.7 * R, forca: 0.46 }]
  const noFerro = banhada(DO_METAL, fontes)

  // ---------- no chão: o claro em leque à frente (a meia elipse rente ao chão) e o claro na parede ----------
  const [rx, ry] = [(CLARO_NO_CHAO.larga * c.g) / 2, CLARO_NO_CHAO.funda * c.g]
  const leque = dentroDe(elipse(0, parede, rx, ry), caixa(-rx - 1, parede + 0.4, rx + 1, parede + ry + 1))
  const noChao: Textura = (_u, _v, x, y, _p, s) => {
    const d2 = (x / rx) * (x / rx) + ((y - parede) / ry) * ((y - parede) / ry)
    s[0] = LUZ_FRIA[0]
    s[1] = LUZ_FRIA[1]
    s[2] = LUZ_FRIA[2]
    s[4] = 1
    // Quase chapado, um pouco mais forte junto da parede: uma poça de luz com beira, não uma névoa.
    s[5] = CLARO_NO_CHAO.alfa * (1 - 0.5 * Math.min(1, d2))
  }
  L.push(P(leque, CRISTAL, { tabua: 0, bisel: 0, contorno: 0, suave: CLARO_NO_CHAO.beira, textura: noChao, semente: SEMENTE }))
  const [pwx, pwy] = [CLARO_NA_PAREDE.larga * R, CLARO_NA_PAREDE.funda * R]
  const naParede: Textura = (_u, _v, x, y, _p, s) => {
    const dx = x / pwx
    const dy = (y - parede) / pwy
    const d2 = Math.min(1, dx * dx + dy * dy)
    s[0] = LUZ_FRIA[0]
    s[1] = LUZ_FRIA[1]
    s[2] = LUZ_FRIA[2]
    s[4] = 1
    s[5] = CLARO_NA_PAREDE.alfa * (1 - d2) * (1 - d2)
  }
  L.push(P(dentroDe(elipse(0, parede, pwx, pwy), caixa(-pwx, parede, pwx, parede + pwy)), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, textura: naParede, semente: SEMENTE + 1 }))

  // ---------- a CHAPA na parede, com os dois rebites à vista ----------
  const chapa = caixa(-MEIA_LARGURA_DA_CHAPA * R, parede, MEIA_LARGURA_DA_CHAPA * R, parede + GROSSURA_DA_CHAPA * R, 0.6)
  const zChapa = alto(ALTURA.chapa)
  for (const z of alturas(0, zChapa, 0.7)) {
    const topo = z >= zChapa - 1e-6
    const grao = graoNaAltura(DO_METAL, z)
    const face = banhada((u, v, x, y, p, s, escala) => {
      if (grao !== null) grao(u, v, x, y, p, s, escala)
      s[3] += luzDaNormal(0, 1, 0, q) - 0.06
    }, fontes)
    f.fatia(0, z, chapa, ferro, topo ? { tabua: 0, bisel: 0.7, tom: TOM_DA_CHAPA, metal: BRILHO_DO_FERRO, contorno: 0.32, textura: noFerro, semente: SEMENTE + 2 } : lisa(TOM_DA_CHAPA * 0.8, face, SEMENTE + 3))
  }
  for (const k of [-1, 1]) {
    f.fatia(1, zChapa + 0.1, elipse(k * MEIA_LARGURA_DA_CHAPA * R * 0.66, parede + GROSSURA_DA_CHAPA * R * 0.5, RAIO_DO_REBITE * R, RAIO_DO_REBITE * R), ferro, { tabua: 0, bisel: RAIO_DO_REBITE * R * 0.9, tom: 1.42, metal: 0.6, contorno: 0.26, semente: SEMENTE + 4 })
  }

  // ---------- o BRAÇO torcido e o NÓ forjado no meio dele ----------
  const doFerro = (semente: number, textura?: Textura) => ({ tabua: 0, bisel: 0.9, tom: TOM_DO_BRACO, metal: BRILHO_DO_FERRO, contorno: 0.3, textura: textura ?? noFerro, semente })
  const zBraco = alto(ALTURA.braco)
  f.fatia(2, zBraco, capsula(0, parede + GROSSURA_DA_CHAPA * R * 0.5, 0, yCopa - COPA_DE_DENTRO * R, RAIO_DO_BRACO * R), ferro, doFerro(SEMENTE + 7, banhada(texTorcido, fontes)))
  const yNo = parede + NO_DO_BRACO.da * R
  f.fatia(3, zBraco + 0.2, poligono([[0, yNo - NO_DO_BRACO.alta * R], [NO_DO_BRACO.larga * R, yNo], [0, yNo + NO_DO_BRACO.alta * R], [-NO_DO_BRACO.larga * R, yNo]]), ferro, { ...doFerro(SEMENTE + 5), tom: TOM_DO_BRACO * 1.1, bisel: 0.07 * R })

  // ---------- a COPA: a argola e, por cima dos cristais, as três garras ----------
  const zCopa = alto(ALTURA.copa)
  f.fatia(3, zCopa, anel(0, yCopa, COPA_DE_FORA * R, COPA_DE_FORA * R, COPA_DE_DENTRO * R, COPA_DE_DENTRO * R), ferro, doFerro(SEMENTE + 8))

  // ---------- o NINHO: três prismas para fora da parede, em leque (os de lado primeiro, o do meio por cima) ----------
  const zCristal = alto(ALTURA.cristal)
  PRISMAS.forEach(([graus, casas, meia], i) => {
    const rumo = Math.PI / 2 + graus * GRAUS
    const pe = COPA_DE_DENTRO * R * 0.2
    prismaDeitado({ x: Math.cos(rumo) * pe, y: yCopa + Math.sin(rumo) * pe, rumo, comprido: casas * c.g, meia: meia * R }, q, SEMENTE + 10 + i * 4).forEach((face, k) => {
      // Uma camada por face: a ordem da 3/4 é a mesma da vista de cima (o prisma do meio por cima, o bico por cima do corpo).
      f.fatia(4 + i * 5 + k, zCristal + i * 0.06 + k * 0.01, face.forma, CRISTAL, face.o)
    })
  })
  // As garras: três unhas curtas na beira da argola, que prendem o pé dos prismas sem tapar o leque.
  const unha = (graus: number): ReturnType<typeof capsula> => {
    const [co, si] = [Math.cos(graus * GRAUS), Math.sin(graus * GRAUS)]
    return capsula(co * COPA_DE_FORA * R, yCopa + si * COPA_DE_FORA * R, co * COPA_DE_DENTRO * R * 0.5, yCopa + si * COPA_DE_DENTRO * R * 0.5, 0.058 * R)
  }
  const garras = uniao(uniao(unha(0), unha(180)), unha(270))
  f.fatia(20, alto(ALTURA.garras), garras, ferro, { ...doFerro(SEMENTE + 9), tom: TOM_DO_BRACO * 1.1, bisel: 0.05 * R })
  f.fechar()
}
