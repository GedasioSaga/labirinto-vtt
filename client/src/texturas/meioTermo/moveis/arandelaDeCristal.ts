/**
 * ARANDELA DE CRISTAL (lote L06 de 24/11/2026, item 55: versão da `tochaDeParede`, dos corredores da cripta do mapa
 * 8; desenho próprio, só a ideia do objeto). O suporte de parede de ferro forjado com um CRISTAL ciano no lugar do
 * fogo. A PAREDE é a beira de cima da pegada (giro 0), como na tocha: ali fica a CHAPA rebitada, de onde sai o BRAÇO
 * torcido, com o nó forjado, até a COPA (a argola com as garras), que segura o cristal inclinado para fora; ao pé
 * dele, duas lascas menores. No lugar da fuligem, o claro frio na parede; no chão, na frente, um brilho discreto.
 *
 * A luz é FRIA E NÃO TREME (a de verdade é a do integrador, `LUZ_DOS_OBJETOS`): não há chama animada nem
 * Aceso/Apagado. Feita para ir às dezenas ao longo de um corredor, girada para cada parede: miúda e sem sombra no
 * chão (ela é a luz).
 *
 * As duas vistas saem da PILHA DE FATIAS (`pilhaDeFatias.ts`). NA 3/4 ela sobe POUCO, como a tocha de parede (decisão
 * 27 do mestre, 12/11/2026): a parede do app é uma linha sem altura, então todas as alturas encolhem por
 * `SUBIDA_DA_TOCHA_DE_PAREDE` e a chapa continua na linha da parede. Perfil da 3/4:
 * `{ modo: 'derivado', espessura: 0 }`. Material: `metal` (a chapa, o braço e a copa); o cristal é fixo.
 */
import { SUBIDA_DA_TOCHA_DE_PAREDE } from '../../../lib/mobilia/fogoDeCasa'
import type { Rgb } from '../../ruido'
import { anel, caixa, capsula, elipse, poligono, uniao } from './formas'
import { texturaDaClasse, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import { alturas, novoFatiador } from './pilhaDeFatias'
import { lisa, luzDaNormal } from './apoioDasReferencias'
import { banhada, CRISTAL, fatiarCristal, graoNaAltura, texHaloFrio, type Cristal, type FonteFria } from './pedestalComCristal'

/** As medidas de cima, em fração do menor meio lado; o `y` conta da parede (a beira de cima da pegada). */
const MEIA_LARGURA_DA_CHAPA = 0.46
const GROSSURA_DA_CHAPA = 0.2
const RAIO_DO_BRACO = 0.085
const COPA_EM = 0.66
const COPA_DE_FORA = 0.37
const COPA_DE_DENTRO = 0.25
/** O nó forjado no meio do braço: onde fica (da parede) e as meias medidas do losango. */
const NO_DO_BRACO = { da: 0.36, larga: 0.2, alta: 0.13 } as const
/** O cristal: o raio, quanto ele avança para fora da parede visto de cima e as duas lascas do pé. */
const RAIO_DO_CRISTAL = 0.22
const AVANCO_DO_CRISTAL = 0.86
/** As alturas do desenho em pé, em lados (o menor lado da pegada): encolhem por `SUBIDA_DA_TOCHA_DE_PAREDE`. */
const ALTURA = { chapa: 0.9, braco: 0.72, copa: 0.84, cristal: 1.7, lasca: 0.7 } as const
/** O brilho no chão (além da copa, os raios e o alfa) e o claro frio na parede. */
const BRILHO_NO_CHAO = { alem: 0.5, rx: 0.95, ry: 0.72, alfa: 0.3 } as const
const CLARO_NA_PAREDE = { larga: 0.7, funda: 0.3, alfa: 0.34 } as const
const TOM_DA_CHAPA = 0.92
const TOM_DO_BRACO = 1.04
const BRILHO_DO_FERRO = 0.3
const ESCURO_DO_FERRO: Rgb = [0x4a, 0x45, 0x41]
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
  const fontes: FonteFria[] = [{ x: 0, y: yCopa + 0.2 * R, r: 0.62 * R, forca: 0.5 }]
  const noFerro = banhada(DO_METAL, fontes)

  // ---------- no chão: o brilho frio na frente e o claro na parede ----------
  const by = yCopa + BRILHO_NO_CHAO.alem * R
  const [brx, bry] = [BRILHO_NO_CHAO.rx * R, Math.min(BRILHO_NO_CHAO.ry * R, c.hh - by)]
  L.push(P(elipse(0, by, brx, bry), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, textura: texHaloFrio(0, by, brx, bry, BRILHO_NO_CHAO.alfa), semente: SEMENTE }))
  const [py, pry] = [parede + CLARO_NA_PAREDE.funda * R, CLARO_NA_PAREDE.funda * R]
  L.push(P(elipse(0, py, CLARO_NA_PAREDE.larga * R, pry), CRISTAL, { tabua: 0, bisel: 0, contorno: 0, textura: texHaloFrio(0, py, CLARO_NA_PAREDE.larga * R, pry, CLARO_NA_PAREDE.alfa), semente: SEMENTE + 1 }))

  // ---------- a CHAPA na parede, com os dois rebites ----------
  const chapa = caixa(-MEIA_LARGURA_DA_CHAPA * R, parede, MEIA_LARGURA_DA_CHAPA * R, parede + GROSSURA_DA_CHAPA * R, 0.5)
  const zChapa = alto(ALTURA.chapa)
  for (const z of alturas(0, zChapa, 0.7)) {
    const topo = z >= zChapa - 1e-6
    const grao = graoNaAltura(DO_METAL, z)
    const face = banhada((u, v, x, y, p, s, escala) => {
      if (grao !== null) grao(u, v, x, y, p, s, escala)
      s[3] += luzDaNormal(0, 1, 0, q) - 0.06
    }, fontes)
    f.fatia(0, z, chapa, ferro, topo ? { tabua: 0, bisel: 0.6, tom: TOM_DA_CHAPA, metal: BRILHO_DO_FERRO, contorno: 0.3, textura: noFerro, semente: SEMENTE + 2 } : lisa(TOM_DA_CHAPA * 0.8, face, SEMENTE + 3))
  }
  for (const k of [-1, 1]) {
    f.fatia(1, zChapa + 0.1, elipse(k * MEIA_LARGURA_DA_CHAPA * R * 0.72, parede + GROSSURA_DA_CHAPA * R * 0.5, 0.075 * R, 0.075 * R), ferro, { tabua: 0, bisel: 0.07 * R, tom: 1.3, metal: 0.5, contorno: 0.2, semente: SEMENTE + 4 })
  }

  // ---------- o BRAÇO torcido e o NÓ forjado no meio dele ----------
  const doFerro = (semente: number, textura?: Textura) => ({ tabua: 0, bisel: 0.8, tom: TOM_DO_BRACO, metal: BRILHO_DO_FERRO, contorno: 0.28, textura: textura ?? noFerro, semente })
  const zBraco = alto(ALTURA.braco)
  f.fatia(2, zBraco, capsula(0, parede + GROSSURA_DA_CHAPA * R * 0.5, 0, yCopa - COPA_DE_DENTRO * R, RAIO_DO_BRACO * R), ferro, doFerro(SEMENTE + 7, banhada(texTorcido, fontes)))
  const yNo = parede + NO_DO_BRACO.da * R
  f.fatia(3, zBraco + 0.2, poligono([[0, yNo - NO_DO_BRACO.alta * R], [NO_DO_BRACO.larga * R, yNo], [0, yNo + NO_DO_BRACO.alta * R], [-NO_DO_BRACO.larga * R, yNo]]), ferro, { ...doFerro(SEMENTE + 5), tom: TOM_DO_BRACO * 1.1, bisel: 0.07 * R })

  // ---------- a COPA: a argola e as três garras que seguram o cristal ----------
  const zCopa = alto(ALTURA.copa)
  f.fatia(3, zCopa, anel(0, yCopa, COPA_DE_FORA * R, COPA_DE_FORA * R, COPA_DE_DENTRO * R, COPA_DE_DENTRO * R), ferro, doFerro(SEMENTE + 8))
  const garras = uniao(uniao(capsula(-COPA_DE_DENTRO * R, yCopa, -COPA_DE_DENTRO * R * 0.86, yCopa + 0.3 * R, 0.065 * R), capsula(COPA_DE_DENTRO * R, yCopa, COPA_DE_DENTRO * R * 0.86, yCopa + 0.3 * R, 0.065 * R)), elipse(0, yCopa - COPA_DE_DENTRO * R * 0.9, 0.1 * R, 0.1 * R))
  f.fatia(5, zCopa + alto(0.34), garras, ferro, { ...doFerro(SEMENTE + 9), tom: TOM_DO_BRACO * 1.08, bisel: 0.06 * R })

  // ---------- o CRISTAL inclinado para fora da parede e as duas lascas do pé ----------
  const altoDoCristal = alto(ALTURA.cristal)
  const altoDaLasca = alto(ALTURA.lasca)
  const cristais: Cristal[] = [
    { x: 0, y: yCopa, r: RAIO_DO_CRISTAL * R, alto: altoDoCristal, ix: 0, iy: (AVANCO_DO_CRISTAL * R) / altoDoCristal, fase: 0.52 },
    { x: -0.13 * R, y: yCopa + 0.06 * R, r: 0.11 * R, alto: altoDaLasca, ix: (-0.17 * R) / altoDaLasca, iy: (0.3 * R) / altoDaLasca, fase: 0.2 },
    { x: 0.13 * R, y: yCopa + 0.06 * R, r: 0.1 * R, alto: altoDaLasca, ix: (0.19 * R) / altoDaLasca, iy: (0.24 * R) / altoDaLasca, fase: 0.9 },
  ]
  cristais.forEach((cr, i) => fatiarCristal(f, 4, zCopa + 0.2, cr, SEMENTE + 10 + i))
  f.fechar()
}
