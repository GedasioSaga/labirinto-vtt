/**
 * CEPO DO CARRASCO de cima com volume (lote L02 dos objetos de 24/11/2026, Masmorra: carcereiro e tortura; a versão
 * de execução do toco com machado): o bloco de madeira bem escura, baixo e comprido, de quinas pouco arredondadas.
 * De través no meio, o ENTALHE do pescoço: as duas meias-luas em U mordem a silhueta nas duas beiras compridas, com
 * a sombra dentro do U, e o sulco raso liga uma à outra pelo alto do bloco (pega a luz na parede da direita). Em
 * volta, os talhos de machado, e o SANGUE velho que entrou na madeira do entalhe e escorreu em dois fios até a beira
 * da frente. Encostado na ponta da direita, o MACHADO de carrasco: o cabo comprido com a empunhadura de couro apoiada
 * no cepo e a cabeça de ferro escuro deitada no chão, com o brilho só na faixa do fio. Na frente, o CESTO raso de
 * vime, rente ao entalhe, e a mancha seca no chão que ninguém limpou.
 *
 * O que diz "cepo" a 25% de zoom é o bloco escuro com o entalhe em U no meio e a mancha vinho; o machado e o cesto
 * dizem o resto.
 *
 * Na 3/4 (`tresQuartos.ts`, derivado) o bloco é uma coluna da altura do cepo, de frente lisa e inteira, e o alto
 * (o entalhe, os talhos e a mancha de cima) sobe com ele: o U da beira da frente aparece como um dente escuro no alto
 * da frente. O machado inteiro tem o meio fora do bloco (`comMeioEm` no meio do cabo) e fica no chão, como o cesto e
 * a mancha do chão.
 *
 * Esticado, o bloco acompanha a pegada; o entalhe, o machado e o cesto têm o tamanho do menor lado. Material:
 * `madeira` (o bloco). O cabo, o couro, o ferro do machado, o vime e o sangue são fixos.
 */
import { hash, type Rgb } from '../../ruido'
import { anel, cadeia, capsula, caixa, dentroDe, elipse, elipseGirada, menos, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, texturaDaClasse, type MaterialDaPeca, type Textura } from './motor'
import { G, materialDaPeca, QUARTO, type MontarMovel } from './contexto'

// ---------- as medidas (px do protótipo no tamanho de partida, 1 x 1 casa) ----------

const LADO_DE_PARTIDA = G
/** A altura do cepo (px). */
const ALTURA_DO_CEPO = 0.42 * G
/**
 * O bloco: as beiras (frações da meia pegada), o raio dos cantos (px), o escurecimento da madeira e o tom do alto.
 * Escuro, mas acima do piso de luz do motor: abaixo dele (o tom 0,6 pedido) o pixel é levantado até o marrom do
 * piso e o veio, o entalhe e a mancha somem numa chapa lisa. O tom do alto fica acima do da frente da 3/4 (0,74).
 */
const BLOCO = { x0: -0.8, x1: 0.36, y0: -0.44, y1: 0.36 } as const
const CANTO_DO_BLOCO = 1.2
const ESCURECE_A_MADEIRA = 0.9
const TOM_DO_BLOCO = 0.86
/** O entalhe do pescoço: o meio (fração entre as beiras do bloco), o raio do U (px) e a meia largura do sulco. */
const MEIO_DA_CAVA = 0.46
const MEIA_CAVA = 5.4
const MEIO_SULCO = 0.72
/** O machado: o pé do cabo (no chão, frações), a ponta apoiada no cepo (frações) e o raio do cabo (px). */
const PE_DO_CABO: Ponto = [0.8, 0.46]
const PONTA_DO_CABO: Ponto = [0.3, -0.07]
const RAIO_DO_CABO = 1.5
/** A cabeça do machado, em (ao longo do cabo, para o lado), px: o contorno de barba, do olho até o fio. */
const LAMINA: readonly Ponto[] = [
  [-2.1, 1.4],
  [-5.6, 8.2],
  [-4.3, 9.3],
  [-1.8, 9.9],
  [1.1, 9.8],
  [3.5, 9],
  [4.3, 7.7],
  [2.1, 1.4],
]
/** A faixa do fio (px, medido para o lado): o único brilho da cabeça. */
const COMECO_DO_FIO = 7.6
/** O cesto de vime: o meio (px a partir do entalhe e da beira da frente) e os meios eixos (px). */
const CESTO: Ponto = [-1.4, 6.9]
const MEIO_CESTO: Ponto = [8, 5.4]

// ---------- os materiais fixos ----------

const CABO = materialDaPeca('carvalho')
const FERRO = materialDaPeca('ferro')
const COURO: MaterialDaPeca = { classe: 'liso', rgb: [0x4e, 0x36, 0x29] }
const SANGUE_VELHO: MaterialDaPeca = { classe: 'liso', rgb: [0x52, 0x25, 0x22] }
const SANGUE_SECO: MaterialDaPeca = { classe: 'liso', rgb: [0x6c, 0x3c, 0x31] }
const VIME: MaterialDaPeca = { classe: 'liso', rgb: [0x8a, 0x72, 0x4e] }
const FUNDO_DO_CESTO: MaterialDaPeca = { classe: 'liso', rgb: [0x5a, 0x48, 0x32] }
const TALHO: MaterialDaPeca = { classe: 'liso', rgb: [0x24, 0x1b, 0x16] }
const SOMBRA: MaterialDaPeca = { classe: 'liso', rgb: [0x1c, 0x17, 0x13] }
const FERRUGEM: Rgb = [0x6c, 0x4a, 0x36]

/**
 * O entalhe e o sulco: o veio da madeira e a luz pela inclinação das paredes (a da direita olha para a luz, a da
 * esquerda fica no escuro). `forca` = o fundo do U (funda) ou o sulco raso.
 */
function texCava(gx: number, r: number, forca: number): Textura {
  const veio = texturaDaClasse('madeira')
  return (u, v, x, y, p, s, escala) => {
    if (veio !== null) veio(u, v, x, y, p, s, escala)
    const t = Math.max(-1, Math.min(1, (x - gx) / r))
    s[3] += t * forca - (1 - t * t) * forca * 0.4 - forca * 0.2
  }
}

/** A ferrugem pintada na cabeça, perto do olho. */
function texLamina(cx: number, cy: number): Textura {
  const metal = texturaDaClasse('metal')
  return (u, v, x, y, p, s, escala) => {
    if (metal !== null) metal(u, v, x, y, p, s, escala)
    const d = Math.hypot(x - cx, y - cy)
    const t = Math.max(0, 1 - d / 4.5) * 0.4
    s[0] += (FERRUGEM[0] - s[0]) * t
    s[1] += (FERRUGEM[1] - s[1]) * t
    s[2] += (FERRUGEM[2] - s[2]) * t
  }
}

/** O vime trançado: as varas da beira correndo em volta e o fundo em espiral, sem listra reta. */
function texVime(cx: number, cy: number, ry: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const a = Math.atan2((y - cy) / ry, (x - cx) / (ry * 1.48))
    const r = Math.hypot((x - cx) / 1.48, y - cy)
    const trama = Math.sin(a * 26 + Math.floor(r * 0.9) * 1.6) * Math.sin(r * 3.4)
    s[3] += trama * 0.1 + ruido(x * 0.6 + p.su, y * 0.6) * 0.05
  }
}

/** A mesma forma numa caixa com o meio em (mx, my): a 3/4 decide pela caixa de quem a peça é. */
function comMeioEm(forma: Forma, mx: number, my: number): Forma {
  const ex = Math.max(mx - forma.b[0], forma.b[2] - mx)
  const ey = Math.max(my - forma.b[1], forma.b[3] - my)
  return { b: [mx - ex, my - ey, mx + ex, my + ey], d: forma.d }
}

/** A mesma forma deslocada (a sombra do cabo no chão). */
function deslocada(f: Forma, dx: number, dy: number): Forma {
  return { b: [f.b[0] + dx, f.b[1] + dy, f.b[2] + dx, f.b[3] + dy], d: (x, y) => f.d(x - dx, y - dy) }
}

export const montarCepoDoCarrasco: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const mad: MaterialDaPeca = { ...c.m.madeira, rgb: [c.m.madeira.rgb[0] * ESCURECE_A_MADEIRA, c.m.madeira.rgb[1] * ESCURECE_A_MADEIRA, c.m.madeira.rgb[2] * ESCURECE_A_MADEIRA] }
  const L = cena.partes
  const k = Math.min(c.w, c.h) / LADO_DE_PARTIDA
  const x0 = BLOCO.x0 * hw
  const x1 = BLOCO.x1 * hw
  const y0 = BLOCO.y0 * hh
  const y1 = BLOCO.y1 * hh
  const ym = (y0 + y1) / 2
  const bloco = caixa(x0, y0, x1, y1, CANTO_DO_BLOCO)
  const gx = x0 + (x1 - x0) * MEIO_DA_CAVA
  const rc = MEIA_CAVA * k
  // As duas meias-luas do entalhe, mordendo as beiras compridas.
  const uDeTras = elipse(gx, y0, rc, rc * 0.92)
  const uDaFrente = elipse(gx, y1, rc, rc * 0.92)
  const entalhe = dentroDe(uniao(uDeTras, uDaFrente), bloco)

  // ---------- as sombras: o bloco inteiro (coluna, de frente lisa) e o contato ----------
  cena.sombras.push({ forma: bloco, z: ALTURA_DO_CEPO, forca: 0.32 }, contato(bloco, 0.36))

  // ---------- no chão: a mancha seca da frente e o cesto de vime ----------
  const poca = uniao(uniao(elipse(gx - 2 * k, y1 + 6.5 * k, 9 * k, 4 * k), elipse(gx + 6 * k, y1 + 4.5 * k, 5 * k, 3 * k)), elipse(gx - 9 * k, y1 + 9 * k, 3.4 * k, 2.2 * k))
  L.push(P(poca, SANGUE_SECO, { bisel: 0, contorno: 0, alfa: 0.46, suave: 1.6, semente: 9701 }))
  L.push(P(elipseGirada(gx + 1.2 * k, y1 + 2.6 * k, 4.4 * k, 1.7 * k, 0.12), SANGUE_VELHO, { bisel: 0.3, contorno: 0, alfa: 0.55, suave: 1, semente: 9702 }))
  const [ccx, ccy] = [gx + CESTO[0] * k, y1 + CESTO[1] * k]
  const [crx, cry] = [MEIO_CESTO[0] * k, MEIO_CESTO[1] * k]
  cena.sombras.push(contato(elipse(ccx, ccy, crx, cry), 0.4))
  L.push(P(elipse(ccx, ccy, crx, cry), VIME, { textura: texVime(ccx, ccy, cry), bisel: 1.2, contorno: 0.34, tom: 0.92, semente: 9703, projeta: { dist: 1.2, forca: 0.45, suave: 0.8 } }))
  L.push(P(elipse(ccx, ccy + 0.3 * k, crx - 1.7 * k, cry - 1.5 * k), FUNDO_DO_CESTO, { textura: texVime(ccx, ccy, cry), bisel: 0.4, contorno: 0.2, tom: 0.9, recesso: { k: 2.4, forca: 0.55 }, semente: 9704 }))
  L.push(P(anel(ccx, ccy, crx - 0.5 * k, cry - 0.5 * k, crx - 1.5 * k, cry - 1.3 * k), VIME, { bisel: 0.4, contorno: 0.16, tom: 1.08, alfa: 0.7, semente: 9705 }))

  // ---------- o bloco: a sombra dentro do U por baixo, o alto mordido pelo U, o sulco e os talhos ----------
  L.push(P(entalhe, mad, { textura: texCava(gx, rc, 0.36), tabua: 0, bisel: 0.3, contorno: 0.4, tom: TOM_DO_BLOCO, recesso: { k: 2.2, forca: 0.45 }, semente: 9709 }))
  L.push(P(menos(bloco, uniao(uDeTras, uDaFrente)), mad, { tabua: 0, bisel: 1.6, contorno: 0.36, tom: TOM_DO_BLOCO, semente: 9710 }))
  L.push(P(dentroDe(caixa(gx - rc * MEIO_SULCO, y0 + rc * 0.6, gx + rc * MEIO_SULCO, y1 - rc * 0.6), bloco), mad, { textura: texCava(gx, rc * MEIO_SULCO, 0.2), tabua: 0, bisel: 0.3, contorno: 0.22, tom: TOM_DO_BLOCO, semente: 9711 }))
  for (let i = 0; i < 6; i += 1) {
    const lado = i % 2 === 0 ? -1 : 1
    const tx = gx + lado * (rc + (1.5 + hash(i, 1, 9712) * 5) * k)
    const ty = y0 + (y1 - y0) * (0.18 + hash(i, 2, 9712) * 0.64)
    const a = 1.2 + (hash(i, 3, 9712) - 0.5) * 1.1
    const m = (2 + hash(i, 4, 9712) * 1.6) * k
    L.push(P(capsula(tx - Math.cos(a) * m, ty - Math.sin(a) * m, tx + Math.cos(a) * m, ty + Math.sin(a) * m, 0.42 * k), TALHO, { bisel: 0, contorno: 0, alfa: 0.55, semente: 9713 + i }))
  }

  // ---------- o sangue de cima: no entalhe e em dois fios até a beira da frente ----------
  const noEntalhe = uniao(elipse(gx + 0.4 * k, ym + 1.2 * k, rc * 0.9, (y1 - y0) * 0.24), elipse(gx + 0.6 * k, y1 - rc * 0.4, rc * 0.7, rc * 0.5))
  L.push(P(dentroDe(noEntalhe, bloco), SANGUE_SECO, { bisel: 0, contorno: 0, alfa: 0.4, suave: 1, semente: 9720 }))
  L.push(P(dentroDe(elipseGirada(gx + 0.6 * k, ym + 2 * k, rc * 0.5, (y1 - y0) * 0.16, 0.08), bloco), SANGUE_VELHO, { bisel: 0, contorno: 0, alfa: 0.56, suave: 0.8, semente: 9721 }))
  const fios: readonly (readonly Ponto[])[] = [
    [[gx + rc * 0.55, ym + 1.5 * k], [gx + rc * 0.85, ym + 4.2 * k], [gx + rc * 0.98, y1 - 3.4 * k], [gx + rc * 1.12, y1 - 0.2]],
    [[gx + rc * 0.62, ym + 4 * k], [gx + rc * 1.1, ym + 5.4 * k], [gx + rc * 1.45, y1 - 2.2 * k], [gx + rc * 1.62, y1 - 0.2]],
  ]
  fios.forEach((fio, i) => {
    L.push(P(dentroDe(cadeia(fio, (0.55 - i * 0.12) * k), bloco), SANGUE_VELHO, { bisel: 0, contorno: 0, alfa: 0.62, suave: 0.35, semente: 9722 + i }))
  })

  // ---------- o machado: a sombra do cabo, o cabo, a empunhadura e a cabeça no chão ----------
  const [pex, pey] = [PE_DO_CABO[0] * hw, PE_DO_CABO[1] * hh]
  const [ptx, pty] = [PONTA_DO_CABO[0] * hw, PONTA_DO_CABO[1] * hh]
  const comp = Math.hypot(ptx - pex, pty - pey)
  const dx = (ptx - pex) / comp
  const dy = (pty - pey) / comp
  // A cabeça fica do lado de baixo do cabo (para dentro da casa).
  const nx = dy
  const ny = -dx
  const mx = (pex + ptx) / 2
  const my = (pey + pty) / 2
  const noChao = (f: Forma): Forma => comMeioEm(f, mx, my)
  const em = ([t, n]: Ponto): Ponto => [pex + dx * t * k + nx * n * k, pey + dy * t * k + ny * n * k]
  const cabo = capsula(pex, pey, ptx, pty, RAIO_DO_CABO * k)
  const lamina = poligono(LAMINA.map(em))
  const olho = poligono([em([-2.4, -1.9]), em([2.4, -1.9]), em([2.4, 1.9]), em([-2.4, 1.9])])
  L.push(P(noChao(deslocada(cabo, 2.2, 1.7)), SOMBRA, { bisel: 0, contorno: 0, alfa: 0.26, suave: 1.3, semente: 9730 }))
  cena.sombras.push(contato(uniao(lamina, olho), 0.38))
  L.push(P(noChao(cabo), CABO, { eixo: Math.atan2(dy, dx), tabua: 0, bisel: RAIO_DO_CABO * k * 0.9, contorno: 0.32, tom: 1.02, semente: 9731, projeta: { dist: 1.6, forca: 0.45, suave: 0.8 } }))
  const empunhadura = capsula(ptx - dx * 6.4 * k, pty - dy * 6.4 * k, ptx - dx * 0.4 * k, pty - dy * 0.4 * k, RAIO_DO_CABO * k * 1.12)
  L.push(P(noChao(empunhadura), COURO, { eixo: Math.atan2(dy, dx) + QUARTO, tabua: 1.5 * k, bisel: 0.9, contorno: 0.32, tom: 1, semente: 9732, projeta: { dist: 1.4, forca: 0.4 } }))
  const [lx, ly] = em([0, 3])
  L.push(P(noChao(lamina), FERRO, { textura: texLamina(lx, ly), tabua: 0, bisel: 1, contorno: 0.36, tom: 0.75, metal: 0.25, semente: 9733 }))
  const fio = dentroDe(lamina, poligono([em([-7.5, COMECO_DO_FIO]), em([6.5, COMECO_DO_FIO - 0.9]), em([6.5, 11.5]), em([-7.5, 11.5])]))
  L.push(P(noChao(fio), FERRO, { tabua: 0, bisel: 0.5, contorno: 0.2, tom: 1.36, metal: 0.75, semente: 9734 }))
  L.push(P(noChao(olho), FERRO, { tabua: 0, bisel: 0.8, contorno: 0.34, tom: 0.66, metal: 0.25, semente: 9735 }))
  L.push(P(noChao(elipse(pex, pey, RAIO_DO_CABO * k * 0.8, RAIO_DO_CABO * k * 0.8)), CABO, { bisel: 0.5, contorno: 0.3, tom: 0.86, semente: 9736 }))
}
