/**
 * CATRE DESARRUMADO de cima com volume (lote L09 dos objetos de 24/11/2026, "Cortiço"; a versão largada do catre,
 * `catre.ts`). A mesma armação de cabeceira e pé com os quatro postes, um pouco mais estreita, porque a beira da direita
 * da pegada é CHÃO: foi ali que a coberta caiu. Na cama, o LENÇOL encardido foi puxado para baixo e para a direita e
 * deixou à mostra a quina do COLCHÃO de lona riscada na cabeceira; as PREGAS do lençol são arcos macios, quase só o
 * vale escuro, com um fio de luz em cima. O TRAVESSEIRO está torto e afundado onde a cabeça esteve. A COBERTA
 * escorregou pela grade da direita: a aba que ficou na cama, com a BAINHA mais escura na beira, a dobra que passa por
 * cima da grade e o MONTE no chão, de beira mole, com as pregas da queda.
 *
 * A 25% de zoom sobra a cama de sempre com a mancha clara do lençol torta e a coberta saindo pela direita até o chão: é
 * o que a separa do catre arrumado (o cobertor dobrado, reto, atravessado no pé).
 *
 * Na 3/4 (DERIVADO) a cama sobe como a do catre (o colchão, a cabeceira e o pé, cada um na sua altura); o monte da
 * coberta no chão é uma coluna baixa e fica embaixo, ao lado da cama. Materiais: os três lugares do catre, `madeira`,
 * `cobertor` e `travesseiro`; o lençol encardido e a lona do colchão são fixos. As medidas saem das frações da pegada
 * (1 x 2 casas de partida); os detalhes miúdos, do menor lado.
 */
import { misturar, type Rgb } from '../../ruido'
import { cadeia, caixa, elipse, poligono, type Ponto } from './formas'
import { contato, type CriarPeca, type MaterialDaPeca, type Peca } from './motor'
import { G, LENCOL, QUARTO, type MontarMovel } from './contexto'
import { girar } from './grilhoesDeParede'

/** A parte da largura da pegada que é chão (onde a coberta caiu), à direita da cama. */
const CHAO_DA_COBERTA = 0.2
/** Alturas, em casas: o colchão, a cabeceira, o pé e o monte da coberta no chão. */
const ALTURA_DO_COLCHAO = 0.34
const ALTURA_DA_CABECEIRA = 0.72
const ALTURA_DO_PE = 0.44
const ALTURA_DO_MONTE = 0.09
/** O encardido do uso: o lençol do catre puxado para o cinza. */
const ENCARDIDO: Rgb = [0x8c, 0x82, 0x6c]
const LENCOL_USADO: MaterialDaPeca = { ...LENCOL, rgb: misturar(LENCOL.rgb, ENCARDIDO, 0.3) }
/** A lona do colchão, mais escura que o lençol para a quina descoberta ler, os riscos dela e a mancha velha. */
const LONA: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0x86, 0x7b, 0x63] }
const RISCO_DA_LONA: MaterialDaPeca = { classe: 'liso', rgb: [0x5e, 0x5a, 0x52] }
const MANCHA: MaterialDaPeca = { classe: 'liso', rgb: [0x6e, 0x5f, 0x47] }
/** O travesseiro torto (radianos). */
const GIRO_DO_TRAVESSEIRO = -0.2
/** Pontos por prega (a curva de Bézier amostrada) e por volta do monte. */
const PASSOS_DA_PREGA = 8
const PASSOS_DO_MONTE = 28

/** Os pontos (fx, fy) em frações da caixa (x0, y0, x1, y1). */
function naCaixa(x0: number, y0: number, x1: number, y1: number, fx: number, fy: number): Ponto {
  return [x0 + (x1 - x0) * fx, y0 + (y1 - y0) * fy]
}

/**
 * A curva de `a` a `b` puxada para `m` (Bézier quadrática), amostrada: a prega sai em arco, sem quina. Os outros panos
 * do lote L09 (a cama de caixotes, a mesa de caixote, a cortina, a cadeira e a trouxa) usam esta e a `prega`.
 */
export function arco(a: Ponto, m: Ponto, b: Ponto): Ponto[] {
  return Array.from({ length: PASSOS_DA_PREGA + 1 }, (_, i): Ponto => {
    const t = i / PASSOS_DA_PREGA
    const s = 1 - t
    return [s * s * a[0] + 2 * s * t * m[0] + t * t * b[0], s * s * a[1] + 2 * s * t * m[1] + t * t * b[1]]
  })
}

/**
 * Uma PREGA do pano: o vale escuro, largo e macio, embaixo à direita e um fio de luz por cima (a luz vem de cima à
 * esquerda). Quase toda a leitura vem do vale: a crista forte virava risco branco. `forca` de 0 a 1.
 */
export function prega(P: CriarPeca, L: Peca[], mat: MaterialDaPeca, pontos: readonly Ponto[], r: number, forca: number, semente: number): void {
  const vale = cadeia(pontos.map(([x, y]): Ponto => [x + r * 0.7, y + r * 0.9]), r * 1.1)
  L.push(P(vale, mat, { tabua: 0, bisel: 0, contorno: 0, tom: 1 - 0.34 * forca, alfa: 0.55, suave: r * 1.3, semente }))
  L.push(P(cadeia(pontos, r * 0.55), mat, { tabua: 0, bisel: 0, contorno: 0, tom: 1 + 0.1 * forca, alfa: 0.42, suave: r * 0.9, semente: semente + 1 }))
}

/** Uma volta mole e torta (o monte de pano no chão, a trouxa): o raio varia devagar, sem bolo nem ponta. */
export function voltaMole(cx: number, cy: number, rx: number, ry: number, fase: number): Ponto[] {
  return Array.from({ length: PASSOS_DO_MONTE }, (_, i): Ponto => {
    const t = (i / PASSOS_DO_MONTE) * Math.PI * 2
    const r = 1 + 0.07 * Math.sin(2 * t + fase) + 0.05 * Math.sin(3 * t + fase * 1.7) + 0.03 * Math.sin(5 * t + fase * 0.6)
    return [cx + Math.cos(t) * rx * r, cy + Math.sin(t) * ry * r]
  })
}

export const montarCatreDesarrumado: MontarMovel = (c, cena) => {
  const { hw, hh, h, g, peca: P } = c
  const mad = c.m.madeira
  const cob = c.m.cobertor
  const L = cena.partes
  const k = Math.min(c.w / G, h / (2 * G))

  // A CAMA: da beira da esquerda até o chão da coberta. Cabeceira em cima, pé embaixo, como o catre.
  const [xL, xR] = [-hw, hw - CHAO_DA_COBERTA * c.w]
  const bw = xR - xL
  const yCab = -hh + 0.075 * h
  const yPe = hh - 0.05 * h
  const beira = 0.07 * bw
  const poste = 0.13 * bw
  const [zM, zH, zF] = [g * ALTURA_DO_COLCHAO, g * ALTURA_DA_CABECEIRA, g * ALTURA_DO_PE]
  const [mx0, my0, mx1, my1] = [xL + beira, yCab, xR - beira, yPe]
  const pt = (fx: number, fy: number): Ponto => naCaixa(mx0, my0, mx1, my1, fx, fy)

  // O MONTE da coberta no chão, ao lado da cama, mais para o pé: uma volta mole que encosta na grade.
  const xChao = xR - 0.6 * k
  const largo = hw - 0.5 * k - xChao
  const [cxM, cyM] = [xChao + largo * 0.5, -hh + h * 0.7]
  const monte = poligono(voltaMole(cxM, cyM, largo * 0.5, h * 0.24, 0.8))

  cena.sombras.push(
    { forma: caixa(xL, -hh, xR, hh, 1.5), z: zM },
    { forma: caixa(xL, -hh, xR, yCab), z: zH },
    { forma: caixa(xL, yPe, xR, hh), z: zF },
    contato(caixa(xL, -hh, xR, hh, 1.5)),
    { forma: monte, z: g * ALTURA_DO_MONTE, forca: 0.26 },
    contato(monte, 0.3),
  )

  // A armação e o COLCHÃO de lona riscada entre as grades (os riscos só aparecem na quina descoberta).
  L.push(P(caixa(xL, -hh, xR, hh, 1.5), mad, { eixo: QUARTO, tabua: 0, bisel: 1.1, semente: 8101 }))
  L.push(P(caixa(mx0, my0, mx1, my1, 2 * k), LONA, { tabua: 0, bisel: 2.2 * k, ruga: 0.8, contorno: 0.2, semente: 8102 }))
  for (const fx of [0.12, 0.24, 0.36]) {
    const [x] = pt(fx, 0)
    L.push(P(caixa(x - 0.45 * k, my0 + 1.2 * k, x + 0.45 * k, pt(0, 0.3)[1], 0.3 * k), RISCO_DA_LONA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.3, semente: 8103 }))
  }
  const [sx, sy] = pt(0.16, 0.12)
  L.push(P(elipse(sx, sy, 3.6 * k, 2.4 * k), MANCHA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.2, suave: 1.6 * k, semente: 8104 }))

  // O LENÇOL puxado para baixo e para a direita: a quina de cima à esquerda ficou sem ele, e a beira dele ali é uma
  // curva mole que faz sombra na lona.
  const lencol = poligono([
    ...arco(pt(-0.02, 0.36), pt(0.05, 0.1), pt(0.42, 0.05)),
    pt(0.7, 0.014), pt(1.03, 0.004), pt(1.05, 0.34), pt(1.06, 0.66), pt(1.03, 0.985), pt(0.55, 1.005), pt(0.2, 0.99), pt(-0.015, 0.94), pt(-0.02, 0.62),
  ])
  L.push(P(lencol, LENCOL_USADO, { tabua: 0, bisel: 2.4 * k, ruga: 2, contorno: 0.18, semente: 8105, projeta: { dist: 1.4 * k, forca: 0.36, suave: 1 * k } }))
  // A beira puxada engrossa um pouco (o pano juntou ali): uma prega curta ao longo dela.
  prega(P, L, LENCOL_USADO, arco(pt(0.03, 0.3), pt(0.1, 0.13), pt(0.36, 0.08)), 1.3 * k, 0.7, 8106)
  // As PREGAS: arcos compridos que saem do meio, onde o corpo virou, e abrem para as beiras.
  const pregas: readonly (readonly [Ponto, Ponto, Ponto])[] = [
    [pt(0.48, 0.14), pt(0.72, 0.15), pt(0.95, 0.24)],
    [pt(0.1, 0.27), pt(0.36, 0.22), pt(0.64, 0.3)],
    [pt(0.34, 0.39), pt(0.56, 0.34), pt(0.92, 0.38)],
    [pt(0.06, 0.53), pt(0.24, 0.47), pt(0.44, 0.52)],
    [pt(0.08, 0.74), pt(0.26, 0.67), pt(0.46, 0.72)],
  ]
  pregas.forEach(([a, m, b], i) => prega(P, L, LENCOL_USADO, arco(a, m, b), 1.8 * k, 1 - 0.08 * i, 8110 + i * 2))

  // O TRAVESSEIRO torto, afundado no meio onde a cabeça esteve.
  const [tx, ty] = pt(0.46, 0.085)
  const [tmx, tmy] = [(mx1 - mx0) * 0.33, (my1 - my0) * 0.058]
  const travesseiro = girar(caixa(tx - tmx, ty - tmy, tx + tmx, ty + tmy, 4 * k), tx, ty, GIRO_DO_TRAVESSEIRO)
  L.push(P(travesseiro, c.m.travesseiro, { tabua: 0, bisel: 0.065 * h, ruga: 1.6, contorno: 0.2, semente: 8120, projeta: { dist: 1.6 * k, forca: 0.32, suave: 1.2 * k } }))
  L.push(P(elipse(tx + 1.4 * k, ty + 0.4 * k, tmx * 0.48, tmy * 0.5), c.m.travesseiro, { tabua: 0, bisel: 0, contorno: 0, tom: 0.82, alfa: 0.55, suave: 2.6 * k, semente: 8121 }))

  // A COBERTA na cama: a aba de beira quase reta (a bainha), que desce de través até a grade da direita.
  const aba: readonly Ponto[] = [pt(0.46, 0.53), pt(0.72, 0.47), pt(1.1, 0.42)]
  const naCama = poligono([...aba, pt(1.12, 0.66), pt(1.12, 0.985), pt(0.82, 0.995), pt(0.66, 0.95), pt(0.52, 0.86), pt(0.56, 0.74), pt(0.42, 0.64)])
  L.push(P(naCama, cob, { tabua: 0, bisel: 2.6 * k, ruga: 1.6, contorno: 0.22, semente: 8130, projeta: { dist: 1.5 * k, forca: 0.34, suave: 1 * k } }))
  // A bainha: a faixa mais escura junto da beira de cima, que diz "coberta" e não "pano qualquer".
  const desce = 2.4 * k
  const bainha = poligono([...aba, [aba[2][0], aba[2][1] + desce], [aba[1][0], aba[1][1] + desce], [aba[0][0] + 0.6 * k, aba[0][1] + desce]])
  L.push(P(bainha, cob, { tabua: 0, bisel: 0.6 * k, ruga: 0.5, contorno: 0.12, tom: 0.7, semente: 8131 }))
  prega(P, L, cob, arco(pt(0.6, 0.64), pt(0.8, 0.58), pt(1.04, 0.62)), 1.7 * k, 1, 8132)
  prega(P, L, cob, arco(pt(0.62, 0.84), pt(0.84, 0.77), pt(1.06, 0.83)), 1.6 * k, 0.9, 8134)

  // A dobra que passa por cima da grade da direita e desce até o monte: o pano mais escuro, de lado.
  const dobra = caixa(xR - beira * 1.1, pt(0, 0.43)[1], xR + 1.4 * k, pt(0, 0.98)[1], 1.8 * k)
  L.push(P(dobra, cob, { tabua: 0, bisel: 1.6 * k, ruga: 1, tom: 0.78, contorno: 0.18, semente: 8136 }))

  // O MONTE no chão: o corpo, as pregas da queda (de través, como o pano escorregou da grade) e o lombo claro.
  L.push(P(monte, cob, { tabua: 0, bisel: 2.8 * k, ruga: 1.8, tom: 0.9, contorno: 0.24, semente: 8140, projeta: { dist: 1 * k, forca: 0.3 } }))
  const naMonte = (fx: number, fy: number): Ponto => [cxM + largo * 0.5 * fx, cyM + h * 0.24 * fy]
  const pregasDoMonte: readonly (readonly [Ponto, Ponto, Ponto])[] = [
    [naMonte(-0.9, -0.62), naMonte(-0.1, -0.74), naMonte(0.6, -0.5)],
    [naMonte(-0.8, -0.2), naMonte(0.1, -0.32), naMonte(0.85, -0.12)],
    [naMonte(-0.85, 0.24), naMonte(-0.05, 0.12), naMonte(0.75, 0.3)],
    [naMonte(-0.6, 0.62), naMonte(0.05, 0.52), naMonte(0.55, 0.7)],
  ]
  pregasDoMonte.forEach(([a, m, b], i) => prega(P, L, cob, arco(a, m, b), 1.5 * k, 1, 8142 + i * 2))

  // O pé e os postes do pé; a cabeceira e os postes dela por último (fazem sombra no travesseiro).
  L.push(P(caixa(xL, yPe, xR, hh, 1), mad, { tabua: 0, bisel: 1.2, semente: 8160 }))
  for (const x0 of [xL, xR - poste]) L.push(P(caixa(x0, hh - poste, x0 + poste, hh, 1.5), mad, { tabua: 0, bisel: 2.4, semente: 8161 }))
  L.push(P(caixa(xL, -hh, xR, yCab, 1), mad, { tabua: 0, bisel: 1.3, semente: 8162, projeta: { dist: 3.2, forca: 0.32, suave: 1.6 } }))
  for (const x0 of [xL, xR - poste]) L.push(P(caixa(x0, -hh, x0 + poste, -hh + poste, 1.5), mad, { tabua: 0, bisel: 2.4, semente: 8163 }))
}
