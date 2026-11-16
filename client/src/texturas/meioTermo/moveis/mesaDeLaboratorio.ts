/**
 * MESA DE LABORATÓRIO de cima com volume (lote L1 de 16/11/2026, necrotério e laboratório; versão ORIGINAL, só a
 * ideia do objeto das referências): a mesa de metal de laboratório antigo, de chapa esmaltada cinza-esverdeada com a
 * beira dobrada, pernas de cantoneira e a prateleira de baixo. Em cima, do jeito que o cientista deixou: o
 * MICROSCÓPIO de laca preta com a ocular de latão, o CADERNO aberto com o lápis, o SUPORTE de argola com o BALÃO de
 * fundo redondo sobre o bico de gás (a mangueira de borracha correndo para o fundo), a ESTANTE de tubos de ensaio, os
 * dois FRASCOS cônicos, o VIDRO DE AMOSTRA aberto com o líquido turvo e uma coisa pálida boiando (a tampa ao lado), o
 * GRAL de porcelana com o pilão e, na beira da frente, a TENAZ e a ESPÁTULA.
 *
 * Os líquidos são contidos (âmbar, verde-pálido, azul de sulfato e o turvo). A 25% de zoom sobram o retângulo
 * verde-cinza com os pontos de vidro colorido: é o que diz "laboratório", e não "mesa de jantar" nem "bancada".
 *
 * NA 3/4 é derivada (`tresQuartos.ts`): o tampo é um tampo solto na altura da mesa (a beirada dobrada,
 * `ESPESSURA_DO_TAMPO_DA_MESA_DE_LABORATORIO`), as quatro pernas são colunas e a prateleira de baixo é outro tampo
 * solto, baixo, que só a 3/4 mostra entre as pernas. Tudo o que está em cima sobe com o tampo. Nada lê o giro.
 *
 * As coisas em cima têm o tamanho do menor lado (2 x 1 casa de partida) e os lugares são frações do tampo: a mesa
 * esticada ganha tampo, não frascos maiores. Sem material escolhido: tudo é fixo.
 */
import { anel, cadeia, caixa, capsula, elipse, elipseGirada, menos, uniao, type Forma, type Ponto } from './formas'
import { contato, type MaterialDaPeca, type OpcoesDaPeca } from './motor'
import { G, materialDaPeca, type MontarMovel } from './contexto'
import {
  BORRACHA, ESCURO, ESMALTE, FERRO_VELHO, LACA_PRETA, LATAO, LIQUIDO_AMBAR, LIQUIDO_AZUL, LIQUIDO_TURVO, LIQUIDO_VERDE, NIQUEL,
  BRILHO_DO_NIQUEL, BRILHO_DA_TINTA, PAPEL, PISO_DO_NECROTERIO, REFLEXO, TINTA_VERDE, VIDRO, texEsmalte, texTinta,
} from './apoioDoNecroterio'

/** A estante dos tubos e o lápis: a madeira clara do Meio-Termo. */
const MADEIRA: MaterialDaPeca = materialDaPeca('pinho')
/** A coisa pálida no vidro de amostra: cinza-rosado de carne lavada, quase sem cor. */
const AMOSTRA: MaterialDaPeca = { classe: 'liso', rgb: [0xc4, 0xb4, 0xa6] }

/** Alturas em casas: o tampo e a prateleira de baixo; a beirada dobrada do tampo na 3/4 (px do protótipo). */
const ALTURA_DO_TAMPO = 0.55
const ALTURA_DA_PRATELEIRA = 0.16
export const ESPESSURA_DO_TAMPO_DA_MESA_DE_LABORATORIO = 0.05 * G
/** O tampo recua isto da pegada; a quina; a perna (lado e recuo), em px. */
const FOLGA = 0.8
const QUINA = 1.8
const PERNA = 2.6
const RECUO_DA_PERNA = 1.4
/** A pegada de partida (px do protótipo): as coisas em cima crescem só com o menor lado. */
const FUNDO_DE_PARTIDA = 1 * G

type Opcoes = OpcoesDaPeca

export const montarMesaDeLaboratorio: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  cena.corDoPiso = PISO_DO_NECROTERIO
  const k = Math.min(1.4, c.h / FUNDO_DE_PARTIDA, c.w / (2 * FUNDO_DE_PARTIDA))
  const z = g * ALTURA_DO_TAMPO
  const [x0, y0, x1, y1] = [-hw + FOLGA, -hh + FOLGA, hw - FOLGA, hh - FOLGA]
  const tampo = caixa(x0, y0, x1, y1, QUINA)

  // As estruturas: a sombra de baixo, o tampo solto, as quatro pernas e a prateleira de baixo (só a 3/4 a vê).
  cena.sombras.push(
    { forma: caixa(x0 - 1.2, y0 - 1.2, x1 + 1.2, y1 + 1.2, QUINA + 1.2), z: 0, suave: 1.2, forca: 0.34 },
    { forma: tampo, z, solta: true, suave: 1.8, forca: 0.24 },
    { forma: caixa(x0 + RECUO_DA_PERNA + PERNA, y0 + RECUO_DA_PERNA + PERNA, x1 - RECUO_DA_PERNA - PERNA, y1 - RECUO_DA_PERNA - PERNA, 0.6), z: g * ALTURA_DA_PRATELEIRA, solta: true, forca: 0 },
  )
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const px = sx < 0 ? x0 + RECUO_DA_PERNA : x1 - RECUO_DA_PERNA - PERNA
      const py = sy < 0 ? y0 + RECUO_DA_PERNA : y1 - RECUO_DA_PERNA - PERNA
      const perna = caixa(px, py, px + PERNA, py + PERNA, 0.4)
      cena.sombras.push({ forma: perna, z: z - ESPESSURA_DO_TAMPO_DA_MESA_DE_LABORATORIO, suave: 0.9, forca: 0.3 }, contato(perna, 0.34))
    }
  }

  const L = cena.partes
  const por = (forma: Forma, mat: MaterialDaPeca, o: Opcoes): void => {
    L.push(P(forma, mat, o))
  }
  // O tampo de chapa esmaltada, com a beira dobrada um degrau mais clara.
  por(tampo, TINTA_VERDE, { tabua: 0, bisel: 1.4, tom: 1.12, contorno: 0.26, metal: BRILHO_DA_TINTA, textura: texTinta, semente: 7801 })
  por(caixa(x0 + 1.8, y0 + 1.8, x1 - 1.8, y1 - 1.8, 0.8), TINTA_VERDE, { tabua: 0, bisel: 0.5, tom: 1.06, contorno: 0.12, metal: BRILHO_DA_TINTA, textura: texTinta, semente: 7802 })

  // Os lugares das coisas: frações do tampo (x de -1 a 1 da esquerda para a direita, y de -1 a 1 do fundo à frente).
  const tx = (x1 - x0) / 2 - 4
  const ty = (y1 - y0) / 2 - 4
  const em = (fx: number, fy: number): [number, number] => [fx * tx, fy * ty]
  const vidro = (semente: number): Opcoes => ({ tabua: 0, bisel: 0.6 * k, tom: 0.92, contorno: 0.26, alfa: 0.88, semente, projeta: { dist: 1, forca: 0.26 } })
  const liquido = (semente: number): Opcoes => ({ tabua: 0, bisel: 0, tom: 0.9, contorno: 0, alfa: 0.82, semente })
  const reflexo = (x: number, y: number, r: number, semente: number): void =>
    por(elipseGirada(x - r * 0.4, y - r * 0.45, r * 0.32, r * 0.16, -0.6), REFLEXO, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.7, suave: 0.3, semente })

  // O caderno aberto com as linhas e o lápis.
  {
    const [cx, cy] = em(-0.38, 0.38)
    const folha = (lado: -1 | 1): Forma => caixa(cx + (lado < 0 ? -10.4 : 0) * k, cy - 6.8 * k, cx + (lado < 0 ? 0 : 10.4) * k, cy + 6.8 * k, 0.6)
    for (const lado of [-1, 1] as const) por(folha(lado), PAPEL, { tabua: 0, bisel: 0.5, tom: lado < 0 ? 0.97 : 1.02, contorno: 0.24, semente: 7810 + lado, projeta: { dist: 0.6, forca: 0.24 } })
    for (let i = 0; i < 6; i += 1) {
      const y = cy - 4.6 * k + i * 1.8 * k
      for (const lado of [-1, 1]) por(capsula(cx + lado * 1.6 * k, y, cx + lado * (i % 3 === 2 ? 6 : 8.6) * k, y, 0.22 * k), ESCURO, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.4, semente: 7812 })
    }
    por(capsula(cx + 3 * k, cy + 8.6 * k, cx + 12 * k, cy + 6.4 * k, 0.6 * k), MADEIRA, { tabua: 0, bisel: 0.4, tom: 1.05, contorno: 0.26, semente: 7813, projeta: { dist: 0.6, forca: 0.26 } })
  }

  // O microscópio: a base em ferradura, a platina com a lâmina de vidro, o braço e o tubo com a ocular de latão.
  {
    const [mx, my] = em(-0.74, -0.2)
    const r = 6.4 * k
    por(menos(elipse(mx, my + r * 0.4, r, r * 0.8), elipse(mx, my + r * 1.1, r * 0.5, r * 0.5)), LACA_PRETA, { tabua: 0, bisel: 1, contorno: 0.3, metal: 0.4, semente: 7820, projeta: { dist: 1, forca: 0.3 } })
    por(caixa(mx - r * 0.62, my - r * 0.3, mx + r * 0.62, my + r * 0.62, 0.6), LACA_PRETA, { tabua: 0, bisel: 0.6, tom: 1.2, contorno: 0.28, metal: 0.4, semente: 7821, projeta: { dist: 1.4, forca: 0.3 } })
    por(caixa(mx - r * 0.82, my + r * 0.05, mx + r * 0.82, my + r * 0.3, 0.2), VIDRO, { tabua: 0, bisel: 0.2, tom: 1.05, contorno: 0.2, alfa: 0.8, semente: 7822 })
    por(capsula(mx, my - r * 1.1, mx, my - r * 0.2, r * 0.26), LACA_PRETA, { tabua: 0, bisel: 0.8, tom: 1.1, contorno: 0.28, metal: 0.45, semente: 7823, projeta: { dist: 2, forca: 0.3 } })
    por(elipse(mx, my - r * 0.25, r * 0.36, r * 0.36), LATAO, { tabua: 0, bisel: 0.8, contorno: 0.3, metal: 0.6, semente: 7824, projeta: { dist: 2.2, forca: 0.32 } })
    por(elipse(mx, my - r * 0.25, r * 0.17, r * 0.17), ESCURO, { tabua: 0, bisel: 0.2, contorno: 0.1, recesso: { k: 0.6, forca: 0.4 }, semente: 7825 })
  }

  // O suporte de argola: a chapa de ferro, a haste, a argola e o balão de fundo redondo; a mangueira do bico de gás.
  {
    const [sx, sy] = em(-0.02, -0.12)
    const r = 6.2 * k
    por(caixa(sx - r * 1.1, sy - r * 1.55, sx + r * 1.1, sy + r * 1.15, 0.6), FERRO_VELHO, { tabua: 0, bisel: 0.7, contorno: 0.26, semente: 7830 })
    const mangueira: Ponto[] = [[sx + r * 0.3, sy + r * 0.5], [sx + r * 1.6, sy + r * 0.2], [sx + r * 2, sy - r * 0.9], [sx + r * 1.7, y0 + 1.2]]
    por(cadeia(mangueira, 0.75 * k), BORRACHA, { tabua: 0, bisel: 0.5, tom: 1.25, contorno: 0.26, semente: 7831, projeta: { dist: 0.6, forca: 0.26 } })
    por(elipse(sx, sy - r * 1.25, 0.9 * k, 0.9 * k), FERRO_VELHO, { tabua: 0, bisel: 0.5, tom: 1.2, contorno: 0.28, semente: 7832, projeta: { dist: 2.4, forca: 0.3 } })
    por(capsula(sx, sy - r * 1.25, sx, sy - r * 0.9, 0.45 * k), FERRO_VELHO, { tabua: 0, bisel: 0.3, tom: 1.2, contorno: 0.24, semente: 7833 })
    por(elipse(sx, sy, r * 0.82, r * 0.82), VIDRO, vidro(7834))
    por(elipse(sx + r * 0.05, sy + r * 0.08, r * 0.66, r * 0.66), LIQUIDO_VERDE, liquido(7835))
    por(anel(sx, sy, r * 0.94, r * 0.94, r * 0.8, r * 0.8), FERRO_VELHO, { tabua: 0, bisel: 0.3, tom: 1.1, contorno: 0.24, semente: 7836 })
    por(elipse(sx, sy, r * 0.3, r * 0.3), VIDRO, { ...vidro(7837), tom: 1.02 })
    por(elipse(sx, sy, r * 0.17, r * 0.17), ESCURO, { tabua: 0, bisel: 0, contorno: 0.1, alfa: 0.7, semente: 7838 })
    reflexo(sx, sy, r * 0.82, 7839)
  }

  // A estante de tubos: a madeira com seis furos, cinco tubos com o líquido de cima e um furo vazio.
  {
    const [ex, ey] = em(0.36, -0.5)
    const w = 13 * k
    por(caixa(ex - w / 2, ey - 2.6 * k, ex + w / 2, ey + 2.6 * k, 0.6), MADEIRA, { eixo: 0, tabua: 0, bisel: 0.7, contorno: 0.28, semente: 7840, projeta: { dist: 0.8, forca: 0.28 } })
    const cores = [LIQUIDO_AMBAR, LIQUIDO_AZUL, null, LIQUIDO_VERDE, LIQUIDO_TURVO, LIQUIDO_AMBAR]
    cores.forEach((cor, i) => {
      const x = ex - w / 2 + (w * (i + 0.5)) / cores.length
      por(elipse(x, ey, 1.05 * k, 1.05 * k), cor === null ? ESCURO : VIDRO, cor === null ? { tabua: 0, bisel: 0, contorno: 0.1, recesso: { k: 0.6, forca: 0.4 }, semente: 7841 } : { ...vidro(7842 + i), projeta: { dist: 1.4, forca: 0.24 } })
      if (cor !== null) por(elipse(x, ey, 0.7 * k, 0.7 * k), cor, liquido(7850 + i))
    })
  }

  // Os dois frascos cônicos: a base larga de vidro, o líquido e o gargalo.
  for (const [fx, fy, cor, s] of [[0.2, 0.3, LIQUIDO_AMBAR, 7860], [0.45, 0.5, LIQUIDO_AZUL, 7866]] as const) {
    const [ax, ay] = em(fx, fy)
    const r = 4.4 * k
    por(elipse(ax, ay, r, r), VIDRO, vidro(s))
    por(elipse(ax + r * 0.05, ay + r * 0.1, r * 0.8, r * 0.8), cor, liquido(s + 1))
    por(elipse(ax, ay, r * 0.36, r * 0.36), VIDRO, { ...vidro(s + 2), tom: 1.05, projeta: { dist: 1.6, forca: 0.24 } })
    por(elipse(ax, ay, r * 0.22, r * 0.22), ESCURO, { tabua: 0, bisel: 0, contorno: 0.1, alfa: 0.5, semente: s + 3 })
    reflexo(ax, ay, r, s + 4)
  }

  // O vidro de amostra aberto: o vidro grosso, o líquido turvo, a coisa pálida boiando e a tampa de lado.
  {
    const [vx, vy] = em(0.76, -0.14)
    const r = 6.6 * k
    por(elipse(vx, vy, r, r), VIDRO, { ...vidro(7870), bisel: 1.1 * k })
    por(elipse(vx + r * 0.04, vy + r * 0.06, r * 0.82, r * 0.82), LIQUIDO_TURVO, { ...liquido(7871), alfa: 0.88 })
    por(uniao(elipseGirada(vx - r * 0.12, vy + r * 0.05, r * 0.36, r * 0.22, 0.6), elipseGirada(vx + r * 0.14, vy - r * 0.12, r * 0.2, r * 0.14, -0.3)), AMOSTRA, { tabua: 0, bisel: 1, contorno: 0, alfa: 0.55, suave: 0.8, semente: 7872 })
    reflexo(vx, vy, r, 7873)
    const [lx, ly] = [vx - r * 0.2, vy + r * 1.55]
    por(elipse(lx, ly, r * 0.78, r * 0.5), NIQUEL, { tabua: 0, bisel: 0.8, contorno: 0.28, metal: BRILHO_DO_NIQUEL, semente: 7874, projeta: { dist: 0.7, forca: 0.26 } })
    por(elipse(lx, ly, r * 0.6, r * 0.36), NIQUEL, { tabua: 0, bisel: 0.4, tom: 0.88, contorno: 0.14, metal: BRILHO_DO_NIQUEL, recesso: { k: 0.8, forca: 0.24 }, semente: 7875 })
  }

  // O gral de porcelana com o pilão.
  {
    const [gx, gy] = em(0.72, 0.62)
    const r = 3.6 * k
    por(elipse(gx, gy, r, r), ESMALTE, { tabua: 0, bisel: 0.9, contorno: 0.28, textura: texEsmalte, semente: 7880, projeta: { dist: 0.9, forca: 0.28 } })
    por(elipse(gx, gy, r * 0.72, r * 0.72), ESMALTE, { tabua: 0, bisel: 0.5, tom: 0.92, contorno: 0.1, recesso: { k: 1.2, forca: 0.36 }, textura: texEsmalte, semente: 7881 })
    por(capsula(gx - r * 0.1, gy + r * 0.1, gx - r * 1.5, gy - r * 0.9, r * 0.24), ESMALTE, { tabua: 0, bisel: 0.6, tom: 1.04, contorno: 0.26, textura: texEsmalte, semente: 7882, projeta: { dist: 1.2, forca: 0.28 } })
  }

  // As ferramentas na beira da frente: a tenaz de cadinho e a espátula.
  {
    const [tx0, ty0] = em(-0.02, 0.72)
    for (const lado of [-1, 1]) {
      por(cadeia([[tx0 - 7 * k, ty0 + lado * 0.9 * k], [tx0 + 1 * k, ty0 + lado * 0.4 * k], [tx0 + 4.5 * k, ty0 + lado * 1.4 * k]], 0.45 * k), NIQUEL, { tabua: 0, bisel: 0.3, contorno: 0.26, metal: BRILHO_DO_NIQUEL, semente: 7890, projeta: { dist: 0.6, forca: 0.26 } })
    }
    por(elipse(tx0 + 1 * k, ty0, 0.6 * k, 0.6 * k), NIQUEL, { tabua: 0, bisel: 0.3, tom: 0.85, contorno: 0.2, metal: BRILHO_DO_NIQUEL, semente: 7891 })
    const [ax, ay] = em(0.3, 0.78)
    por(capsula(ax - 5 * k, ay, ax + 1 * k, ay, 0.5 * k), MADEIRA, { tabua: 0, bisel: 0.3, contorno: 0.26, semente: 7892, projeta: { dist: 0.5, forca: 0.24 } })
    por(elipseGirada(ax + 3 * k, ay, 2.4 * k, 0.9 * k, 0), NIQUEL, { tabua: 0, bisel: 0.3, tom: 1.08, contorno: 0.26, metal: BRILHO_DO_NIQUEL, semente: 7893, projeta: { dist: 0.5, forca: 0.24 } })
  }
}
