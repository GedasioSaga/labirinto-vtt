/**
 * CEPO DO CARRASCO de cima com volume (lote L02 dos objetos de 24/11/2026, Masmorra: carcereiro e tortura; a versão
 * de execução do toco com machado): o bloco de madeira escura, baixo e comprido, com o ENTALHE do pescoço cavado de
 * través no meio (a cava pega a luz na parede da direita e escurece no fundo), os talhos de machado em volta e a
 * MANCHA de sangue velho, cor de vinho, que entrou na madeira e escorreu pela beira da frente. Encostado na ponta da
 * direita, o MACHADO de carrasco: o cabo claro com a empunhadura de couro apoiada no cepo e a lâmina larga, de barba,
 * deitada no chão, com o fio polido. No chão, a mancha seca que ninguém limpou e a serragem jogada por cima.
 *
 * O que diz "cepo" a 25% de zoom é o bloco escuro com a faixa da cava no meio e a mancha vinho; o machado diz o
 * resto.
 *
 * Na 3/4 (`tresQuartos.ts`, derivado) o bloco é uma coluna da altura do cepo, e a cava, os talhos e a mancha de cima
 * sobem com ele; o machado inteiro tem o meio fora do bloco (`comMeioEm` no meio do cabo) e fica no chão, encostado
 * na frente do cepo, como a mancha do chão e a serragem.
 *
 * Esticado, o bloco acompanha a pegada; a cava e o machado têm o tamanho do menor lado. Material: `madeira` (o
 * bloco). O cabo, o couro, o ferro do machado, o sangue e a serragem são fixos.
 */
import { hash, type Rgb } from '../../ruido'
import { capsula, caixa, dentroDe, elipse, elipseGirada, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, texturaDaClasse, type MaterialDaPeca, type Textura } from './motor'
import { G, materialDaPeca, QUARTO, type MontarMovel } from './contexto'

// ---------- as medidas (px do protótipo no tamanho de partida, 1 x 1 casa) ----------

const LADO_DE_PARTIDA = G
/** A altura do cepo (px). */
const ALTURA_DO_CEPO = 0.42 * G
/** O bloco: as beiras (frações da meia pegada) e o raio dos cantos (px). */
const BLOCO = { x0: -0.8, x1: 0.36, y0: -0.44, y1: 0.36 } as const
const CANTO_DO_BLOCO = 2.6
/** A cava do pescoço: o meio (fração entre as beiras do bloco) e a meia largura (px). */
const MEIO_DA_CAVA = 0.46
const MEIA_CAVA = 5.4
/** O machado: o pé do cabo (no chão, frações), a ponta apoiada no cepo (frações) e o raio do cabo (px). */
const PE_DO_CABO: Ponto = [0.55, 0.57]
const PONTA_DO_CABO: Ponto = [0.29, 0.04]
const RAIO_DO_CABO = 1.65
/** A lâmina em (ao longo do cabo, para fora), px: o contorno de barba, do olho até o fio. */
const LAMINA: readonly Ponto[] = [
  [-2.6, 1.8],
  [-7, 10.2],
  [-5.4, 11.6],
  [-2.2, 12.4],
  [1.4, 12.2],
  [4.4, 11.2],
  [5.4, 9.6],
  [2.6, 1.8],
]
/** A faixa polida do fio (px, medido para fora). */
const COMECO_DO_FIO = 9.8

// ---------- os materiais fixos ----------

const CABO = materialDaPeca('carvalho')
const FERRO = materialDaPeca('ferro')
const COURO: MaterialDaPeca = { classe: 'liso', rgb: [0x4e, 0x36, 0x29] }
const SANGUE_VELHO: MaterialDaPeca = { classe: 'liso', rgb: [0x52, 0x25, 0x22] }
const SANGUE_SECO: MaterialDaPeca = { classe: 'liso', rgb: [0x6c, 0x3c, 0x31] }
const SERRAGEM: MaterialDaPeca = { classe: 'liso', rgb: [0xb4, 0x9c, 0x74] }
const TALHO: MaterialDaPeca = { classe: 'liso', rgb: [0x2f, 0x23, 0x1c] }
const SOMBRA: MaterialDaPeca = { classe: 'liso', rgb: [0x1c, 0x17, 0x13] }
const FERRUGEM: Rgb = [0x7c, 0x52, 0x3a]

/** A cava: o veio da madeira e a luz pela inclinação das paredes (a da direita olha para a luz, a da esquerda não). */
function texCava(gx: number, r: number): Textura {
  const veio = texturaDaClasse('madeira')
  return (u, v, x, y, p, s, escala) => {
    if (veio !== null) veio(u, v, x, y, p, s, escala)
    const t = Math.max(-1, Math.min(1, (x - gx) / r))
    s[3] += t * 0.3 - (1 - t * t) * 0.16
  }
}

/** A ferrugem pintada na lâmina, perto do olho. */
function texLamina(cx: number, cy: number): Textura {
  const metal = texturaDaClasse('metal')
  return (u, v, x, y, p, s, escala) => {
    if (metal !== null) metal(u, v, x, y, p, s, escala)
    const d = Math.hypot(x - cx, y - cy)
    const t = Math.max(0, 1 - d / 5.5) * 0.55
    s[0] += (FERRUGEM[0] - s[0]) * t
    s[1] += (FERRUGEM[1] - s[1]) * t
    s[2] += (FERRUGEM[2] - s[2]) * t
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
  const mad = c.m.madeira
  const L = cena.partes
  const k = Math.min(c.w, c.h) / LADO_DE_PARTIDA
  const x0 = BLOCO.x0 * hw
  const x1 = BLOCO.x1 * hw
  const y0 = BLOCO.y0 * hh
  const y1 = BLOCO.y1 * hh
  const bloco = caixa(x0, y0, x1, y1, CANTO_DO_BLOCO)
  const gx = x0 + (x1 - x0) * MEIO_DA_CAVA
  const rc = MEIA_CAVA * k

  // ---------- as sombras: o bloco (coluna) e o contato ----------
  cena.sombras.push({ forma: bloco, z: ALTURA_DO_CEPO, forca: 0.32 }, contato(bloco, 0.36))

  // ---------- no chão: a mancha seca da frente e a serragem ----------
  const poca = uniao(uniao(elipse(gx - 2 * k, y1 + 6.5 * k, 9 * k, 4 * k), elipse(gx + 6 * k, y1 + 4.5 * k, 5 * k, 3 * k)), elipse(gx - 9 * k, y1 + 9 * k, 3.4 * k, 2.2 * k))
  L.push(P(poca, SANGUE_SECO, { bisel: 0, contorno: 0, alfa: 0.46, suave: 2.2, semente: 9701 }))
  L.push(P(elipse(gx - 1 * k, y1 + 5.5 * k, 5.2 * k, 2.4 * k), SANGUE_VELHO, { bisel: 0.3, contorno: 0, alfa: 0.55, suave: 1.6, semente: 9702 }))
  for (let i = 0; i < 14; i += 1) {
    const a = hash(i, 1, 9703) * Math.PI * 2
    const sx = gx + (hash(i, 2, 9703) - 0.4) * 30 * k
    const sy = y1 + (2.5 + hash(i, 3, 9703) * 10) * k
    const m = (0.7 + hash(i, 4, 9703) * 0.8) * k
    L.push(P(capsula(sx - Math.cos(a) * m, sy - Math.sin(a) * m, sx + Math.cos(a) * m, sy + Math.sin(a) * m, 0.5 * k), SERRAGEM, { bisel: 0.3, contorno: 0.12, tom: 0.85 + hash(i, 5, 9703) * 0.2, alfa: 0.9, semente: 9704 }))
  }

  // ---------- o bloco, a cava, os talhos e a mancha de cima ----------
  L.push(P(bloco, mad, { tabua: 0, bisel: 2.2, contorno: 0.34, tom: 0.84, semente: 9710 }))
  L.push(P(dentroDe(caixa(gx - rc, y0 - 1, gx + rc, y1 + 1), bloco), mad, { textura: texCava(gx, rc), tabua: 0, bisel: 0, contorno: 0.3, tom: 0.78, semente: 9711 }))
  for (let i = 0; i < 6; i += 1) {
    const lado = i % 2 === 0 ? -1 : 1
    const tx = gx + lado * (rc + (1.5 + hash(i, 1, 9712) * 5) * k)
    const ty = y0 + (y1 - y0) * (0.18 + hash(i, 2, 9712) * 0.64)
    const a = 1.2 + (hash(i, 3, 9712) - 0.5) * 1.1
    const m = (2 + hash(i, 4, 9712) * 1.6) * k
    L.push(P(capsula(tx - Math.cos(a) * m, ty - Math.sin(a) * m, tx + Math.cos(a) * m, ty + Math.sin(a) * m, 0.42 * k), TALHO, { bisel: 0, contorno: 0, alfa: 0.62, semente: 9713 + i }))
  }
  const manchaDeCima = uniao(uniao(elipse(gx, (y0 + y1) / 2 + 2 * k, rc * 1.5, (y1 - y0) * 0.34), elipse(gx + rc * 1.2, y1 - 3 * k, rc * 0.8, 3.2 * k)), elipse(gx - rc * 0.9, y0 + 4 * k, rc * 0.6, 2.4 * k))
  L.push(P(dentroDe(manchaDeCima, bloco), SANGUE_SECO, { bisel: 0, contorno: 0, alfa: 0.42, suave: 2, semente: 9720 }))
  L.push(P(dentroDe(elipseGirada(gx + 0.6 * k, (y0 + y1) / 2 + 2.6 * k, rc * 0.62, (y1 - y0) * 0.26, 0.08), bloco), SANGUE_VELHO, { bisel: 0, contorno: 0, alfa: 0.62, suave: 1.6, semente: 9721 }))
  L.push(P(dentroDe(capsula(gx + rc * 0.9, y1 - 4 * k, gx + rc * 1.1, y1 + 1, 1.1 * k), bloco), SANGUE_VELHO, { bisel: 0, contorno: 0, alfa: 0.55, suave: 0.8, semente: 9722 }))

  // ---------- o machado: a sombra do cabo, o cabo, a empunhadura e a lâmina no chão ----------
  const [pex, pey] = [PE_DO_CABO[0] * hw, PE_DO_CABO[1] * hh]
  const [ptx, pty] = [PONTA_DO_CABO[0] * hw, PONTA_DO_CABO[1] * hh]
  const comp = Math.hypot(ptx - pex, pty - pey)
  const dx = (ptx - pex) / comp
  const dy = (pty - pey) / comp
  const nx = -dy
  const ny = dx
  const mx = (pex + ptx) / 2
  const my = (pey + pty) / 2
  const noChao = (f: Forma): Forma => comMeioEm(f, mx, my)
  const em = ([t, n]: Ponto): Ponto => [pex + dx * t * k + nx * n * k, pey + dy * t * k + ny * n * k]
  const cabo = capsula(pex, pey, ptx, pty, RAIO_DO_CABO * k)
  const lamina = poligono(LAMINA.map(em))
  const olho = poligono([em([-3, -2.4]), em([3, -2.4]), em([3, 2.4]), em([-3, 2.4])])
  L.push(P(noChao(deslocada(cabo, 2.2, 1.7)), SOMBRA, { bisel: 0, contorno: 0, alfa: 0.26, suave: 1.3, semente: 9730 }))
  cena.sombras.push(contato(uniao(lamina, olho), 0.36))
  L.push(P(noChao(cabo), CABO, { eixo: Math.atan2(dy, dx), tabua: 0, bisel: RAIO_DO_CABO * k * 0.9, contorno: 0.32, tom: 1.06, semente: 9731, projeta: { dist: 1.6, forca: 0.45, suave: 0.8 } }))
  const empunhadura = capsula(ptx - dx * 7 * k, pty - dy * 7 * k, ptx - dx * 0.4 * k, pty - dy * 0.4 * k, RAIO_DO_CABO * k * 1.12)
  L.push(P(noChao(empunhadura), COURO, { eixo: Math.atan2(dy, dx) + QUARTO, tabua: 1.6 * k, bisel: 0.9, contorno: 0.32, tom: 1, semente: 9732, projeta: { dist: 1.4, forca: 0.4 } }))
  const [lx, ly] = em([0, 4])
  L.push(P(noChao(lamina), FERRO, { textura: texLamina(lx, ly), tabua: 0, bisel: 1.1, contorno: 0.34, tom: 0.92, metal: 0.5, semente: 9733 }))
  const fio = dentroDe(lamina, poligono([em([-9, COMECO_DO_FIO]), em([8, COMECO_DO_FIO - 1.2]), em([8, 14]), em([-9, 14])]))
  L.push(P(noChao(fio), FERRO, { tabua: 0, bisel: 0.6, contorno: 0.2, tom: 1.42, metal: 0.75, semente: 9734 }))
  L.push(P(noChao(olho), FERRO, { tabua: 0, bisel: 0.9, contorno: 0.34, tom: 0.78, metal: 0.4, semente: 9735 }))
  L.push(P(noChao(elipse(pex, pey, RAIO_DO_CABO * k * 0.8, RAIO_DO_CABO * k * 0.8)), CABO, { bisel: 0.5, contorno: 0.3, tom: 0.9, semente: 9736 }))
}
