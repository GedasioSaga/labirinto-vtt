/**
 * LAYOUT DA REVELAÇÃO — onde ficam a imagem emoldurada, o postigo (o painel na
 * dobradiça) e os canos das dobradiças, para um palco de W x H px. Puro: a
 * altura do painel depende do texto e quem sabe medi-la é o DOM, então ela
 * chega por função. Porte de `coreografia.js` do protótipo v3.
 *
 * Tela larga: imagem alta à esquerda, painel à direita, alinhados pelo topo.
 * Celular (ou palco em pé): um embaixo do outro, e a porta abre para baixo.
 */

import { ROTEIRO } from './tempo'

export const MARGEM = 16
/** Na coluna (celular) o botão "Pular" fica embaixo, fora da imagem e do painel. */
export const ESPACO_DO_PULAR = 60
/** Folga do trilho para a sombra do painel não ser cortada. */
export const SOMBRA_M = 56
/** Espessura do cano da dobradiça (px), centrado no eixo de giro. */
export const CANO = 10
export const CANO_COMPRIDO = 34
/** Abaixo disso a imagem vira miniatura: no celular ela encolhe até aqui e o painel cede o resto. */
const IMAGEM_MIN_ALTURA = 150
const IMAGEM_MIN_LARGURA = 200

export interface Retangulo {
  x: number
  y: number
  w: number
  h: number
}

export interface EntradaDoLayout {
  W: number
  H: number
  /** Largura/altura da imagem; `null` = pino sem imagem (só o painel). */
  proporcao: number | null
  /** Altura original da imagem: a moldura nunca a amplia. */
  naturalAltura: number
  /** Espessura das tábuas de madeira e do aro de metal (px). */
  madeira: number
  metal: number
  /** Sem nome e sem descrição não há painel: só a imagem. */
  temPainel: boolean
  /** Espaço reservado embaixo para o "Pular" no celular (0 na prévia do mestre). */
  espacoDoPular: number
  /**
   * Altura do painel com esta largura, já com o mínimo e o máximo aplicados
   * (a tela mede no DOM; o texto que não cabe rola dentro do papel).
   */
  alturaDoPainel: (largura: number, alturaMinima: number, alturaMaxima: number) => number
}

export interface Layout {
  W: number
  H: number
  coluna: boolean
  semImagem: boolean
  temPainel: boolean
  /** A moldura em volta da imagem (madeira + metal). */
  f: number
  imgW: number
  imgH: number
  /** Imagem com moldura. */
  ow: number
  oh: number
  pw: number
  ph: number
  painelMaxAltura: number
  gap: number
  /** O grupo inteiro (imagem + painel), no palco. */
  grupo: Retangulo
  /** A imagem emoldurada, dentro do grupo. */
  quadro: Retangulo
  /** A caixa da perspectiva da porta, dentro do grupo. */
  trilho: Retangulo
  /** O painel dentro do trilho. */
  carro: { x: number; y: number }
  perspectiveOrigin: string
  transformOrigin: string
  /** Canos presos na moldura da imagem (no grupo) e as folhas no painel. */
  canos: Retangulo[]
  folhas: Retangulo[]
  /** Onde a entrada começa: fora da tela, à direita, com folga para a sombra. */
  entradaX: number
  /** No celular, quanto o painel pode passar da borda direita antes de ser segurado. */
  folgaDireita: number
}

/** O layout final (o instante em que tudo assentou). `null` = palco ainda sem tamanho. */
export function calcularLayout(e: EntradaDoLayout): Layout | null {
  const { W, H } = e
  if (W <= 0 || H <= 0) return null
  const semImagem = e.proporcao === null
  const coluna = W < 640 || W / H < 0.9
  const gap = semImagem || !e.temPainel ? 0 : coluna ? ROTEIRO.gapCelular : ROTEIRO.gap
  const f = semImagem ? 0 : e.madeira + e.metal
  const livreW = W - 2 * MARGEM
  const pular = coluna ? e.espacoDoPular : 0
  const livreH = H - 2 * MARGEM - pular

  if (e.proporcao === null) {
    const pw = Math.round(Math.min(livreW, coluna ? 520 : 440))
    const painelMaxAltura = Math.max(120, livreH)
    const ph = Math.max(1, e.alturaDoPainel(pw, 0, painelMaxAltura))
    const gx = Math.round((W - pw) / 2)
    const gy = Math.round((H - ph) / 2 - pular / 2)
    const grupo = { x: gx, y: gy, w: pw, h: ph }
    return {
      W,
      H,
      coluna,
      semImagem: true,
      temPainel: true,
      f: 0,
      imgW: 0,
      imgH: 0,
      ow: 0,
      oh: 0,
      pw,
      ph,
      painelMaxAltura,
      gap: 0,
      grupo,
      quadro: { x: 0, y: 0, w: 0, h: 0 },
      trilho: { x: -SOMBRA_M, y: -SOMBRA_M, w: pw + 2 * SOMBRA_M, h: ph + 2 * SOMBRA_M },
      carro: { x: SOMBRA_M, y: SOMBRA_M },
      perspectiveOrigin: '50% 50%',
      transformOrigin: '50% 50%',
      canos: [],
      folhas: [],
      entradaX: W - gx + 70,
      folgaDireita: 0,
    }
  }

  const prop = e.proporcao
  let imgW: number
  let imgH: number
  let pw = 0
  let ph = 0
  let painelMaxAltura = 0
  if (!coluna) {
    imgH = Math.min(e.naturalAltura, H - 2 * MARGEM - 2 * f)
    imgW = imgH * prop
    if (e.temPainel) {
      pw = Math.min(400, Math.max(300, imgW * 0.86))
      if (imgW + 2 * f + gap + pw > livreW) {
        imgW = Math.max(IMAGEM_MIN_LARGURA, livreW - gap - pw - 2 * f)
        imgH = imgW / prop
      }
      pw = Math.round(pw)
      painelMaxAltura = Math.max(120, H - 2 * MARGEM)
      ph = Math.max(1, e.alturaDoPainel(pw, Math.round((imgH + 2 * f) * 0.58), painelMaxAltura))
    } else if (imgW + 2 * f > livreW) {
      imgW = livreW - 2 * f
      imgH = imgW / prop
    }
  } else {
    if (e.temPainel) {
      pw = Math.round(Math.min(livreW, 520))
      // O painel nunca toma a tela inteira: a imagem guarda pelo menos 150 px de altura.
      painelMaxAltura = Math.max(120, livreH - gap - 2 * f - IMAGEM_MIN_ALTURA)
      ph = Math.max(1, e.alturaDoPainel(pw, 0, painelMaxAltura))
    }
    imgH = Math.max(IMAGEM_MIN_ALTURA, Math.min(e.naturalAltura, livreH - (e.temPainel ? gap + ph : 0) - 2 * f))
    imgW = imgH * prop
    if (imgW + 2 * f > livreW) {
      imgW = livreW - 2 * f
      imgH = imgW / prop
    }
  }
  imgW = Math.round(imgW)
  imgH = Math.round(imgH)
  const ow = imgW + 2 * f
  const oh = imgH + 2 * f
  const gw = !e.temPainel ? ow : coluna ? Math.max(ow, pw) : ow + gap + pw
  const gh = !e.temPainel ? oh : coluna ? oh + gap + ph : Math.max(oh, ph)
  const gx = Math.round((W - gw) / 2)
  const gy = Math.round((H - gh) / 2 - pular / 2)
  const qx = coluna ? Math.round((gw - ow) / 2) : 0
  const painelX = coluna ? Math.round((gw - pw) / 2) : ow + gap
  // O trilho é a caixa da perspectiva da porta: começa na borda de fora da moldura.
  const trilho = coluna ? { x: painelX - SOMBRA_M, y: oh, w: pw + 2 * SOMBRA_M, h: gap + ph + SOMBRA_M } : { x: ow, y: -SOMBRA_M, w: gap + pw + SOMBRA_M, h: ph + 2 * SOMBRA_M }
  const carro = { x: coluna ? SOMBRA_M : gap, y: coluna ? gap : SOMBRA_M }
  // Duas dobradiças, a 22% e 78% do lado comum (no celular, da largura que imagem e porta dividem).
  const comum = coluna ? Math.min(pw, ow) : Math.min(ph, oh)
  const nos = coluna ? [0.24, 0.76].map((k) => Math.round(comum * k + (pw - comum) / 2)) : [0.22, 0.78].map((k) => Math.round(comum * k))
  const canos = !e.temPainel
    ? []
    : nos.map((no) =>
        coluna
          ? { x: Math.round(painelX + no - CANO_COMPRIDO / 2), y: oh + Math.round(gap / 2 - CANO / 2), w: CANO_COMPRIDO, h: CANO }
          : { x: ow + Math.round(gap / 2 - CANO / 2), y: no - CANO_COMPRIDO / 2, w: CANO, h: CANO_COMPRIDO },
      )
  const folhas = !e.temPainel ? [] : nos.map((no) => (coluna ? { x: no - 15, y: -3, w: 30, h: 7 } : { x: -3, y: no - 15, w: 7, h: 30 }))
  return {
    W,
    H,
    coluna,
    semImagem: false,
    temPainel: e.temPainel,
    f,
    imgW,
    imgH,
    ow,
    oh,
    pw,
    ph,
    painelMaxAltura,
    gap,
    grupo: { x: gx, y: gy, w: gw, h: gh },
    quadro: { x: qx, y: 0, w: ow, h: oh },
    trilho,
    carro,
    // Eixo de giro no meio do vão, colado na borda da moldura: é onde ficam os canos.
    perspectiveOrigin: coluna ? `${carro.x + pw / 2}px ${gap / 2}px` : `${gap / 2}px ${carro.y + ph / 2}px`,
    transformOrigin: coluna ? `50% ${-gap / 2}px` : `${-gap / 2}px 50%`,
    canos,
    folhas,
    entradaX: W - (gx + qx) + 70,
    folgaDireita: Math.max(0, W - (gx + painelX + pw) - 4),
  }
}
