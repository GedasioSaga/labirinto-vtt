/**
 * CATRE DESARRUMADO de cima com volume (lote L09 dos objetos de 24/11/2026, "Cortiço"; a versão largada do catre,
 * `catre.ts`). A mesma armação de cabeceira e pé com os quatro postes, mais estreita, porque a faixa da direita da
 * pegada é CHÃO: foi ali que a coberta caiu. Na cama, o LENÇOL encardido foi puxado para baixo e para a direita e
 * deixou à mostra a quina do COLCHÃO de lona cinza-parda riscada na cabeceira; as PREGAS do lençol são arcos macios,
 * quase só o vale escuro, com um fio de luz em cima. O TRAVESSEIRO está torto e afundado onde a cabeça esteve. A COBERTA
 * desbotada é um pano só: a aba que ficou na cama, com a BAINHA mais escura, puxada para o ponto em que ela passa pela
 * grade da direita; ali o pano vira (a crista clara), desce pela FACE de lado, mais escura, e abre no chão num MONTE
 * largo e baixo, de beira mole e espalhada, com as pregas em leque saindo da grade e a sombra da cama por cima.
 *
 * A 25% de zoom sobra a cama de sempre com a quina escura da lona, a mancha clara do lençol torta e a coberta saindo
 * pela direita até o chão: é o que a separa do catre arrumado (o cobertor dobrado, reto, atravessado no pé).
 *
 * Na 3/4 (DERIVADO) a cama sobe como a do catre (o colchão, a cabeceira alta e o pé baixo, mais escuro, cada um na sua
 * altura); a face do pano que desce pela grade é uma coluna própria, da altura do colchão, e o monte no chão é uma coluna
 * baixa ao lado dela. Materiais: os três lugares do catre, `madeira`, `cobertor` e `travesseiro`; a coberta sai sempre
 * desbotada (a lã vinho de partida vira um vinho apagado), e o lençol encardido e a lona do colchão são fixos. As medidas
 * saem das frações da pegada (1 x 2 casas de partida); os detalhes miúdos, do menor lado.
 *
 * Este arquivo é o módulo comum do lote: exporta `arco`, `prega`, `vale`, `voltaMole`, o `ENCARDIDO` e as cores gastas
 * (`madeiraGasta`, `tecidoDesbotado`) que os outros móveis do cortiço usam.
 */
import { misturar, type Rgb } from '../../ruido'
import { cadeia, caixa, elipse, poligono, type Ponto } from './formas'
import { contato, type CriarPeca, type MaterialDaPeca, type Peca } from './motor'
import { G, LENCOL, QUARTO, type MontarMovel } from './contexto'
import { girar } from './grilhoesDeParede'

/** A parte da largura da pegada que é chão (onde a coberta caiu), à direita da cama. */
const CHAO_DA_COBERTA = 0.3
/** Alturas, em casas: o colchão, a cabeceira, o pé (metade da cabeceira de antes) e o monte da coberta no chão. */
const ALTURA_DO_COLCHAO = 0.26
const ALTURA_DA_CABECEIRA = 0.72
const ALTURA_DO_PE = 0.22
const ALTURA_DO_MONTE = 0.08
/** O encardido do uso: o lençol do catre (e a trouxa) puxado para o cinza. */
export const ENCARDIDO: Rgb = [0x8c, 0x82, 0x6c]
const LENCOL_USADO: MaterialDaPeca = { ...LENCOL, rgb: misturar(LENCOL.rgb, ENCARDIDO, 0.3) }
/** A lona do colchão, cinza-parda e mais fria que o lençol (a quina puxada lê a 25%), o riscado fino e a mancha velha. */
const LONA: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0x6f, 0x6a, 0x5e] }
const RISCO_DA_LONA: MaterialDaPeca = { classe: 'liso', rgb: [0x58, 0x55, 0x4c] }
const MANCHA: MaterialDaPeca = { classe: 'liso', rgb: [0x5c, 0x50, 0x3e] }
/** A sombra da cama no pano do chão e o escuro que recua o pé. */
const SOMBRA: MaterialDaPeca = { classe: 'liso', rgb: [0x2e, 0x28, 0x22] }
const ESCURO: Rgb = [0x2e, 0x28, 0x22]
/** O pé um tom abaixo da madeira (recua na 3/4) e a coberta desbotada (a lã vinho vira ~#7a5952). */
const ESCURO_DO_PE = 0.2
const DESBOTE_DA_COBERTA = 0.62
/** O travesseiro torto (radianos). */
const GIRO_DO_TRAVESSEIRO = -0.2
/** Onde o pano passa pela grade (frações do comprimento do colchão) e quanto o monte se abre para os lados da grade. */
const SAIDA: readonly [number, number] = [0.62, 0.8]
const ABERTURA_DO_MONTE = 0.35
/** As pregas do monte abrem em leque da passagem para a beira (ângulos em volta do meio do monte). */
const LEQUE_DO_MONTE: readonly number[] = [-0.95, 0.1, 1.05]
/** Pontos por prega (a curva de Bézier amostrada), por volta da `voltaMole` e pela beira do monte. */
const PASSOS_DA_PREGA = 8
const PASSOS_DO_MONTE = 28
const PASSOS_DA_BEIRA = 20

/** O pardo gasto do cortiço: a madeira escolhida puxada para o cinza-pardo de tábua velha. */
const PARDO_GASTO: Rgb = [0x80, 0x76, 0x68]
/** O desbotado do pano lavado e usado: um pardo que puxa o pano para a terracota apagada. */
const DESBOTADO: Rgb = [0x70, 0x66, 0x52]
/**
 * O escuro do cortiço (`cena.corDoPiso` de todos os móveis do lote): o pixel escuro demais sobe para este cinza-pardo,
 * e não para o marrom avermelhado da nogueira, que pintava contorno e fresta de vermelho e subia a saturação.
 */
export const ESCURO_DO_CORTICO: Rgb = [0x48, 0x42, 0x3b]

/** A madeira escolhida, gasta e acinzentada `t` (0 a 1): o pardo comum dos móveis do cortiço. */
export function madeiraGasta(mat: MaterialDaPeca, t: number): MaterialDaPeca {
  return { ...mat, rgb: misturar(mat.rgb, PARDO_GASTO, t) }
}

/** O tecido escolhido, desbotado `t` (0 a 1): guarda o matiz e perde a força da cor. */
export function tecidoDesbotado(mat: MaterialDaPeca, t: number): MaterialDaPeca {
  return { ...mat, rgb: misturar(mat.rgb, DESBOTADO, t) }
}

/** Os pontos (fx, fy) em frações da caixa (x0, y0, x1, y1). */
function naCaixa(x0: number, y0: number, x1: number, y1: number, fx: number, fy: number): Ponto {
  return [x0 + (x1 - x0) * fx, y0 + (y1 - y0) * fy]
}

/**
 * A curva de `a` a `b` puxada para `m` (Bézier quadrática), amostrada: a prega sai em arco, sem quina. Os outros panos
 * do lote L09 (a cama de caixotes, a mesa de caixote, a cortina, a cadeira e a trouxa) usam esta, a `prega` e o `vale`.
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
  vale(P, L, mat, pontos, r, forca, semente)
  L.push(P(cadeia(pontos, r * 0.55), mat, { tabua: 0, bisel: 0, contorno: 0, tom: 1 + 0.1 * forca, alfa: 0.42, suave: r * 0.9, semente: semente + 1 }))
}

/** Só o VALE escuro da prega, sem o fio de luz: o pano que cai na sombra (as pontas da toalha, a face do pano). */
export function vale(P: CriarPeca, L: Peca[], mat: MaterialDaPeca, pontos: readonly Ponto[], r: number, forca: number, semente: number): void {
  const fundo = cadeia(pontos.map(([x, y]): Ponto => [x + r * 0.7, y + r * 0.9]), r * 1.1)
  L.push(P(fundo, mat, { tabua: 0, bisel: 0, contorno: 0, tom: 1 - 0.34 * forca, alfa: 0.55, suave: r * 1.3, semente }))
}

/** Uma volta mole e torta (o monte de pano, a trouxa): o raio varia devagar, sem bolo nem ponta. */
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
  const madDoPe: MaterialDaPeca = { ...mad, rgb: misturar(mad.rgb, ESCURO, ESCURO_DO_PE) }
  const cob = tecidoDesbotado(c.m.cobertor, DESBOTE_DA_COBERTA)
  const L = cena.partes
  const k = Math.min(c.w / G, h / (2 * G))
  cena.corDoPiso = ESCURO_DO_CORTICO

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
  const yEm = (fy: number): number => my0 + (my1 - my0) * fy

  // Onde o pano passa pela grade e o MONTE no chão: um pano só, da grade até a beira espalhada, que abre para os dois
  // lados da passagem (o leque) e é mais largo que fundo.
  const [ys0, ys1] = [yEm(SAIDA[0]), yEm(SAIDA[1])]
  const ysc = (ys0 + ys1) / 2
  const largo = hw - 0.4 * k - xR
  const [xP, yP] = [xR + 0.52 * largo, ysc + 1.6 * k]
  const [rx, ry] = [0.52 * largo, 0.085 * h]
  const beiraDoMonte = Array.from({ length: PASSOS_DA_BEIRA + 1 }, (_, i): Ponto => {
    const t = -Math.PI / 2 - ABERTURA_DO_MONTE + ((Math.PI + 2 * ABERTURA_DO_MONTE) * i) / PASSOS_DA_BEIRA
    const r = 1 + 0.13 * Math.sin(3 * t + 0.7) + 0.09 * Math.sin(5 * t + 1.9) + 0.06 * Math.sin(8 * t + 0.4)
    return [xP + Math.cos(t) * rx * r, yP + Math.sin(t) * ry * r]
  })
  const queda = poligono([[xR - 1.2 * k, ys1 - 0.4 * k], [xR - 1.2 * k, ys0 + 0.4 * k], ...beiraDoMonte])
  // A face de lado do pano, que desce da grade: na 3/4 é a coluna da altura do colchão, ao lado da cama.
  const face = caixa(xR - beira * 0.6, ys0 + 0.3 * k, xR + 2.6 * k, ys1 - 0.3 * k, 0.8 * k)

  cena.sombras.push(
    { forma: caixa(xL, -hh, xR, yPe, 1.5), z: zM },
    { forma: caixa(xL, -hh, xR, yCab), z: zH },
    { forma: caixa(xL, yPe, xR, hh), z: zF },
    contato(caixa(xL, -hh, xR, hh, 1.5)),
    { forma: face, z: zM, forca: 0.16 },
    { forma: queda, z: g * ALTURA_DO_MONTE, forca: 0.26 },
    contato(queda, 0.3),
  )

  // A armação e o COLCHÃO de lona cinza-parda entre as grades, com o riscado fino (só aparece na quina descoberta).
  L.push(P(caixa(xL, -hh, xR, hh, 1.5), mad, { eixo: QUARTO, tabua: 0, bisel: 1.1, semente: 8101 }))
  L.push(P(caixa(mx0, my0, mx1, my1, 2 * k), LONA, { tabua: 0, bisel: 2.2 * k, ruga: 0.8, contorno: 0.22, semente: 8102 }))
  for (let fx = 0.05; fx < 0.5; fx += 0.075) {
    const [x] = pt(fx, 0)
    L.push(P(caixa(x - 0.3 * k, my0 + 1.1 * k, x + 0.3 * k, yEm(0.42), 0.3 * k), RISCO_DA_LONA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.32, semente: 8103 }))
  }
  const [sx, sy] = pt(0.16, 0.14)
  L.push(P(elipse(sx, sy, 3.6 * k, 2.4 * k), MANCHA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.26, suave: 1.6 * k, semente: 8104 }))

  // O LENÇOL puxado para baixo e para a direita: a quina de cima à esquerda ficou sem ele, e a beira dele ali é uma
  // curva mole que faz sombra na lona.
  const lencol = poligono([
    ...arco(pt(-0.02, 0.42), pt(0.06, 0.12), pt(0.48, 0.055)),
    pt(0.72, 0.016), pt(1.03, 0.006), pt(1.05, 0.34), pt(1.06, 0.66), pt(1.03, 0.985), pt(0.55, 1.005), pt(0.2, 0.99), pt(-0.015, 0.94), pt(-0.02, 0.66),
  ])
  L.push(P(lencol, LENCOL_USADO, { tabua: 0, bisel: 2.4 * k, ruga: 2, contorno: 0.2, semente: 8105, projeta: { dist: 1.6 * k, forca: 0.42, suave: 1 * k } }))
  // A beira puxada engrossa um pouco (o pano juntou ali): uma prega curta ao longo dela.
  prega(P, L, LENCOL_USADO, arco(pt(0.03, 0.36), pt(0.11, 0.15), pt(0.4, 0.085)), 1.3 * k, 0.7, 8106)
  // As PREGAS: arcos compridos que saem do meio, onde o corpo virou, e abrem para as beiras.
  const pregas: readonly (readonly [Ponto, Ponto, Ponto])[] = [
    [pt(0.5, 0.15), pt(0.72, 0.16), pt(0.95, 0.25)],
    [pt(0.12, 0.3), pt(0.38, 0.24), pt(0.64, 0.31)],
    [pt(0.36, 0.4), pt(0.56, 0.35), pt(0.92, 0.39)],
    [pt(0.06, 0.55), pt(0.24, 0.49), pt(0.42, 0.54)],
    [pt(0.08, 0.76), pt(0.26, 0.69), pt(0.46, 0.74)],
  ]
  pregas.forEach(([a, m, b], i) => prega(P, L, LENCOL_USADO, arco(a, m, b), 1.8 * k, 1 - 0.08 * i, 8110 + i * 2))

  // O TRAVESSEIRO torto, afundado no meio onde a cabeça esteve.
  const [tx, ty] = pt(0.47, 0.085)
  const [tmx, tmy] = [(mx1 - mx0) * 0.33, (my1 - my0) * 0.058]
  const travesseiro = girar(caixa(tx - tmx, ty - tmy, tx + tmx, ty + tmy, 4 * k), tx, ty, GIRO_DO_TRAVESSEIRO)
  L.push(P(travesseiro, c.m.travesseiro, { tabua: 0, bisel: 0.065 * h, ruga: 1.6, contorno: 0.2, semente: 8120, projeta: { dist: 1.6 * k, forca: 0.32, suave: 1.2 * k } }))
  L.push(P(elipse(tx + 1.4 * k, ty + 0.4 * k, tmx * 0.48, tmy * 0.5), c.m.travesseiro, { tabua: 0, bisel: 0, contorno: 0, tom: 0.82, alfa: 0.55, suave: 2.6 * k, semente: 8121 }))

  // O MONTE no chão: o pano inteiro do chão (da grade à beira espalhada), as pregas em leque que saem da passagem e a
  // sombra da cama cortando o pano rente à grade.
  L.push(P(queda, cob, { tabua: 0, bisel: 1.3 * k, ruga: 1.2, tom: 0.9, contorno: 0.2, semente: 8140, projeta: { dist: 0.7 * k, forca: 0.26 } }))
  const saida: Ponto = [xR + 0.8 * k, ysc + 0.4 * k]
  LEQUE_DO_MONTE.forEach((ang, i) => {
    const fim: Ponto = [xP + Math.cos(ang) * rx * 0.94, yP + Math.sin(ang) * ry * 0.9]
    const meio: Ponto = [(saida[0] + fim[0]) / 2 - (fim[1] - saida[1]) * 0.12, (saida[1] + fim[1]) / 2 + (fim[0] - saida[0]) * 0.12]
    prega(P, L, cob, arco(saida, meio, fim), 1.7 * k, 1, 8142 + i * 2)
  })
  const sombraDaCama = poligono([[xR + 1.4 * k, ys0 - 0.6 * k], [xR + 4.6 * k, ys0 + 1.6 * k], [xR + 4.6 * k, yP + ry * 0.86], [xR + 1.4 * k, yP + ry * 0.96]])
  L.push(P(sombraDaCama, SOMBRA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.26, suave: 1.8 * k, semente: 8148 }))
  // A FACE de lado: o pano descendo da grade, mais escuro, que some mansa no monte.
  const descida = poligono([[xR - 0.8 * k, ys0 + 0.2 * k], [xR + 1.4 * k, ys0 + 1 * k], [xR + 2 * k, ysc], [xR + 1.4 * k, ys1 - 1 * k], [xR - 0.8 * k, ys1 - 0.2 * k]])
  L.push(P(descida, cob, { tabua: 0, bisel: 0, ruga: 1, contorno: 0, tom: 0.64, alfa: 0.9, suave: 1.1 * k, semente: 8149 }))

  // A COBERTA na cama: a aba de beira quase reta (a bainha) e o pano puxado para a passagem, onde vira por cima da grade.
  const xCrista = xR - 0.35 * k
  const aba: readonly Ponto[] = [pt(0.44, 0.53), pt(0.72, 0.47), pt(0.99, 0.43)]
  const naCama = poligono([
    ...aba,
    pt(1.03, 0.5),
    [xCrista - 0.6 * k, ys0 - 0.6 * k], [xCrista, ys0 + 1.2 * k], [xCrista + 0.2 * k, ysc], [xCrista, ys1 - 1.2 * k], [xCrista - 0.6 * k, ys1 + 0.6 * k],
    pt(1.03, 0.9), pt(1.02, 0.985), pt(0.82, 0.995), pt(0.66, 0.95), pt(0.52, 0.86), pt(0.56, 0.74), pt(0.42, 0.64),
  ])
  L.push(P(naCama, cob, { tabua: 0, bisel: 2.4 * k, ruga: 1.6, contorno: 0.16, semente: 8130, projeta: { dist: 1.5 * k, forca: 0.34, suave: 1 * k } }))
  // A bainha: a faixa mais escura junto da beira de cima, que diz "coberta" e não "pano qualquer".
  const desce = 2.4 * k
  const bainha = poligono([...aba, [aba[2][0], aba[2][1] + desce], [aba[1][0], aba[1][1] + desce], [aba[0][0] + 0.6 * k, aba[0][1] + desce]])
  L.push(P(bainha, cob, { tabua: 0, bisel: 0.6 * k, ruga: 0.5, contorno: 0.12, tom: 0.72, semente: 8131 }))
  // As pregas da aba correm para a passagem (o pano foi puxado por ali) e a crista clara onde ele vira na grade.
  prega(P, L, cob, arco(pt(0.58, 0.62), pt(0.8, 0.61), [xCrista - 1.6 * k, ysc - 2.4 * k]), 1.6 * k, 1, 8132)
  prega(P, L, cob, arco(pt(0.6, 0.9), pt(0.82, 0.86), [xCrista - 1.6 * k, ysc + 2.6 * k]), 1.5 * k, 0.9, 8134)
  const crista = arco([xCrista - 0.5 * k, ys0 + 1.2 * k], [xCrista - 0.1 * k, ysc], [xCrista - 0.5 * k, ys1 - 1.2 * k])
  L.push(P(cadeia(crista, 0.6 * k), cob, { tabua: 0, bisel: 0, contorno: 0, tom: 1.14, alfa: 0.45, suave: 0.6 * k, semente: 8136 }))

  // O pé (baixo e um tom mais escuro) e os postes dele; a cabeceira e os postes dela por último (fazem sombra no
  // travesseiro).
  L.push(P(caixa(xL, yPe, xR, hh, 1), madDoPe, { tabua: 0, bisel: 1.2, semente: 8160 }))
  for (const x0 of [xL, xR - poste]) L.push(P(caixa(x0, hh - poste, x0 + poste, hh, 1.5), madDoPe, { tabua: 0, bisel: 2.4, semente: 8161 }))
  L.push(P(caixa(xL, -hh, xR, yCab, 1), mad, { tabua: 0, bisel: 1.3, semente: 8162, projeta: { dist: 3.2, forca: 0.32, suave: 1.6 } }))
  for (const x0 of [xL, xR - poste]) L.push(P(caixa(x0, -hh, x0 + poste, -hh + poste, 1.5), mad, { tabua: 0, bisel: 2.4, semente: 8163 }))
}
