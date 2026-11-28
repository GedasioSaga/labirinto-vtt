/**
 * As versões do BUEIRO (lote L05 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`; tema
 * Esgotos). A 1ª, FECHADO, é o desenho de `MONTADORES` (`montarBueiro`: a grade sobre o buraco). Aqui fica o ABERTO:
 * a mesma moldura de quatro blocos, agora com o REBAIXO à mostra (o degrau de assentar a grade, com o ferro do
 * caixilho fixo enferrujado) e o POÇO escuro, mais fundo que o buraco de hoje: as paredes de dentro (a de baixo e a da
 * direita pegam a luz, as outras ficam no escuro), os DEGRAUS de ferro em U chumbados na parede de cima, um abaixo do
 * outro (cada um mais apagado: é o que diz "dá para descer"), e lá no fundo o brilho pequeno da água. A GRADE tirada
 * foi arrastada para baixo, quase reta: cobre a metade de baixo da boca e passa da pedra para o chão da rua, com as
 * duas folhas secas ainda presas; nos dois trilhos do rebaixo, o RISCO claro do ferro lixado por onde ela desceu.
 *
 * Mesma pegada e mesmos lugares de material do tipo (`pedra` e `grade`). As medidas da moldura e da grade são as de
 * `moveis/bueiro.ts` (lá elas não são exportadas: copiadas aqui, com o mesmo nome). A grade passa um nada da pegada
 * (o canto dela no chão): a imagem cresce para caber, como a sombra.
 */
import type { VersoesDesenhadas } from '.'
import { hash, type Rgb } from '../../../ruido'
import { caixa, capsula, dentroDe, elipse, elipseGirada, menos, poligono, uniao, type Forma, type Ponto } from '../formas'
import { contato, type MaterialDaPeca } from '../motor'
import type { MontarMovel } from '../contexto'

// ---------- as medidas de `bueiro.ts` ----------

const BEIRA_DE_FORA = 0.95
const LARGURA_DO_BLOCO = 0.25
const JUNTA = 0.45
const CAIXILHO = 2.2
const PASSO_DA_BARRA = 5.6
const MEIA_BARRA = 1.15
const SOMBRA_DA_BARRA = 2.4

// ---------- as medidas do aberto ----------

/** O rebaixo à mostra: a largura do degrau (px), dentro da boca. */
const REBAIXO = 1.9
/** Onde a grade tirada ficou: o deslocamento (fração do meio vão) e o giro. Arrastada para baixo, quase reta. */
const GRADE_DESLOCADA = { x: 0.12, y: 0.78, giro: 0.07 } as const
/** Os degraus em U na parede de cima: quantos, a meia largura (fração do meio vão) e o passo em profundidade (px). */
const DEGRAUS = 3
const MEIO_DEGRAU = 0.38
const PASSO_DO_DEGRAU = 3.1

// ---------- os materiais fixos (os de `bueiro.ts` e os do poço) ----------

const BURACO_FUNDO: MaterialDaPeca = { classe: 'liso', rgb: [0x24, 0x25, 0x24] }
const ESCURO_DO_BURACO: Rgb = [0x3e, 0x40, 0x40]
const AGUA: MaterialDaPeca = { classe: 'liso', rgb: [0x33, 0x40, 0x3d] }
const REFLEXO: MaterialDaPeca = { classe: 'liso', rgb: [0x8c, 0x98, 0x93] }
const UMIDADE: MaterialDaPeca = { classe: 'liso', rgb: [0x3b, 0x35, 0x2e] }
const FERRUGEM: MaterialDaPeca = { classe: 'liso', rgb: [0x8a, 0x58, 0x3c] }
const FOLHA_SECA: MaterialDaPeca = { classe: 'folha', rgb: [0x9a, 0x6a, 0x3a] }
const MUSGO: MaterialDaPeca = { classe: 'folha', rgb: [0x5a, 0x6b, 0x42] }
/** A parede de dentro do poço que pega a luz: a pedra no escuro, levantada só um pouco. */
const PAREDE_DO_POCO: MaterialDaPeca = { classe: 'liso', rgb: [0x4d, 0x4c, 0x48] }
/** O risco claro na pedra, de quando arrastaram a grade. */
const RISCO: MaterialDaPeca = { classe: 'liso', rgb: [0xb4, 0xb0, 0xa4] }

/** As folhas secas presas na grade (as de `bueiro.ts`): o meio, o comprido e o ângulo. */
const FOLHAS: readonly (readonly [number, number, number, number])[] = [
  [-0.45, 0.3, 0.2, 0.7],
  [0.38, -0.5, 0.16, -0.4],
]

/** O ponto (x, y) girado por `a` em volta da origem e levado para (cx, cy). */
function levar(x: number, y: number, a: number, cx: number, cy: number): Ponto {
  return [cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)]
}

/** O retângulo (x0, y0, x1, y1) da grade, girado e levado para o lugar onde ela ficou. */
function retanguloLevado(x0: number, y0: number, x1: number, y1: number, a: number, cx: number, cy: number): Forma {
  return poligono([levar(x0, y0, a, cx, cy), levar(x1, y0, a, cx, cy), levar(x1, y1, a, cx, cy), levar(x0, y1, a, cx, cy)])
}

/** ABERTO: o rebaixo, o poço com os degraus e a água lá no fundo, e a grade deitada de viés no canto. */
const montarBueiroAberto: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const R = Math.min(hw, hh)
  const pedra = c.m.pedra
  const grade = c.m.grade
  const L = cena.partes
  const ox = BEIRA_DE_FORA * hw
  const oy = BEIRA_DE_FORA * hh
  const t = LARGURA_DO_BLOCO * R
  const bx = ox - t
  const by = oy - t
  const moldura = caixa(-ox, -oy, ox, oy, 1.2)
  cena.sombras.push(contato(moldura, 0.18))
  cena.corDoPiso = ESCURO_DO_BURACO

  // ---------- a moldura (os mesmos quatro blocos), o musgo e a umidade ----------
  const blocos: readonly Forma[] = [
    caixa(-ox, -oy, ox, -by - JUNTA, 1),
    caixa(-ox, by + JUNTA, ox, oy, 1),
    caixa(-ox, -by + JUNTA, -bx - JUNTA, by - JUNTA, 1),
    caixa(bx + JUNTA, -by + JUNTA, ox, by - JUNTA, 1),
  ]
  blocos.forEach((bloco, k) => L.push(P(bloco, pedra, { tabua: 0, bisel: 1.6, tom: 0.94 + hash(k, 7, 7301) * 0.12, contorno: 0.26, semente: 7310 + k })))
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const mx = sx * (bx + t * 0.5)
    const my = sy * by
    L.push(P(dentroDe(elipse(mx, my, t * 0.34, 1.3), moldura), MUSGO, { bisel: 0.5, contorno: 0.06, tom: 0.9 + hash(sx, sy, 7302) * 0.2, semente: 7320 + sx + sy * 2 }))
  }
  L.push(P(dentroDe(elipse(0, by + t * 0.35, bx * 0.8, t * 0.55), blocos[1]), UMIDADE, { bisel: 0, contorno: 0, alfa: 0.32, suave: 2.2, semente: 7330 }))

  // ---------- o rebaixo à mostra: o ferro do caixilho fixo, enferrujado ----------
  const boca = caixa(-bx, -by, bx, by, 0.6)
  const rebaixo = menos(boca, caixa(-bx + REBAIXO, -by + REBAIXO, bx - REBAIXO, by - REBAIXO, 0.4))
  L.push(P(rebaixo, grade, { tabua: 0, bisel: 0.6, tom: 0.78, contorno: 0.3, metal: 0.25, semente: 7336 }))
  L.push(P(dentroDe(uniao(elipse(-bx * 0.5, -by, bx * 0.45, 1.6), elipse(bx, -by * 0.2, 1.6, by * 0.5)), rebaixo), FERRUGEM, { bisel: 0, contorno: 0, alfa: 0.5, suave: 0.8, semente: 7337 }))
  // O risco de arrastar a grade: o ferro dos dois trilhos do lado lixado claro, por onde ela desceu.
  for (const lado of [-1, 1]) {
    const x = lado * (bx - REBAIXO * 0.5)
    L.push(P(dentroDe(capsula(x, -by + 0.8, x + lado * 0.25, by - 1, 0.3), rebaixo), RISCO, { bisel: 0, contorno: 0, alfa: 0.38, suave: 0.3, semente: 7338 + lado }))
  }

  // ---------- o poço: o escuro fundo, as paredes de dentro que pegam a luz, os degraus e a água ----------
  const ix = bx - REBAIXO
  const iy = by - REBAIXO
  const poco = caixa(-ix, -iy, ix, iy, 0.4)
  L.push(P(poco, BURACO_FUNDO, { bisel: 0, contorno: 0.24, recesso: { k: 5.5, forca: 0.75 }, semente: 7340 }))
  // A parede de baixo e a da direita, viradas para a luz: uma faixa da pedra no escuro, sumindo para dentro.
  const paredes = uniao(caixa(-ix, iy - 3.4, ix, iy), caixa(ix - 3.4, -iy, ix, iy))
  L.push(P(dentroDe(paredes, poco), PAREDE_DO_POCO, { bisel: 0, contorno: 0, alfa: 0.55, suave: 1.6, semente: 7341 }))
  // A água lá no fundo, na parte do poço que a grade deixou à mostra (à direita dos degraus).
  L.push(P(dentroDe(elipse(ix * 0.6, -iy * 0.52, ix * 0.18, iy * 0.13), poco), AGUA, { bisel: 0, contorno: 0, alfa: 0.8, suave: 1.2, semente: 7342 }))
  L.push(P(dentroDe(elipseGirada(ix * 0.64, -iy * 0.55, ix * 0.08, 0.45, -0.12), poco), REFLEXO, { bisel: 0, contorno: 0, alfa: 0.42, suave: 0.4, semente: 7343 }))
  // Os degraus em U chumbados na parede de cima: cada um mais fundo, um nada mais para baixo e mais apagado.
  const md = MEIO_DEGRAU * ix
  for (let i = 0; i < DEGRAUS; i += 1) {
    const y = -iy + 1.6 + i * PASSO_DO_DEGRAU
    const apaga = 1 - i * 0.3
    const degrau = uniao(capsula(-md, y, md, y, 0.62), uniao(capsula(-md, -iy, -md, y, 0.55), capsula(md, -iy, md, y, 0.55)))
    L.push(P(degrau, grade, { bisel: 0.5, tom: 0.95 * apaga + 0.1, contorno: 0.3, metal: 0.4, alfa: 0.5 + 0.5 * apaga, semente: 7345 + i, projeta: { dist: 1.2, forca: 0.45 * apaga, suave: 0.6 } }))
  }

  // ---------- a grade tirada, deitada de viés no canto de baixo à direita ----------
  const gx = GRADE_DESLOCADA.x * bx
  const gy = GRADE_DESLOCADA.y * by
  const a = GRADE_DESLOCADA.giro
  const contorno = retanguloLevado(-bx - CAIXILHO, -by - CAIXILHO, bx + CAIXILHO, by + CAIXILHO, a, gx, gy)
  cena.sombras.push({ forma: contorno, z: 2.6, forca: 0.3 }, contato(contorno, 0.3))
  L.push(P(retanguloLevado(-bx, -MEIA_BARRA * 0.9, bx, MEIA_BARRA * 0.9, a, gx, gy), grade, { tabua: 0, bisel: 0.9, tom: 0.78, contorno: 0.3, semente: 7350, projeta: { dist: SOMBRA_DA_BARRA, forca: 0.5, suave: 0.8 } }))
  const barras = Math.max(2, Math.round((bx * 2) / PASSO_DA_BARRA) - 1)
  const passo = (bx * 2) / (barras + 1)
  for (let i = 1; i <= barras; i += 1) {
    const x = -bx + i * passo
    L.push(P(retanguloLevado(x - MEIA_BARRA, -by, x + MEIA_BARRA, by, a, gx, gy), grade, { eixo: Math.PI / 2 + a, tabua: 0, bisel: MEIA_BARRA, tom: 1.02, contorno: 0.3, semente: 7360 + i, projeta: { dist: SOMBRA_DA_BARRA, forca: 0.55, suave: 0.8 } }))
  }
  const caixilho = menos(contorno, retanguloLevado(-bx + 0.6, -by + 0.6, bx - 0.6, by - 0.6, a, gx, gy))
  L.push(P(caixilho, grade, { tabua: 0, bisel: 1, tom: 0.92, contorno: 0.3, semente: 7370, projeta: { dist: 1.6, forca: 0.45, suave: 0.8 } }))
  const [fx, fy] = levar(-bx * 0.4, by + CAIXILHO * 0.4, a, gx, gy)
  L.push(P(dentroDe(elipseGirada(fx, fy, bx * 0.45, CAIXILHO * 1.2, a), caixilho), FERRUGEM, { bisel: 0, contorno: 0, alfa: 0.5, suave: 1.2, semente: 7371 }))
  FOLHAS.forEach(([px, py, comp, ang], k) => {
    const meio = comp * R
    const [lx, ly] = levar(px * bx, py * by, a, gx, gy)
    L.push(P(elipseGirada(lx, ly, meio, meio * 0.42, ang + a), FOLHA_SECA, { bisel: 0.8, contorno: 0.26, tom: 0.95 + k * 0.1, semente: 7380 + k, projeta: { dist: 1.2, forca: 0.4, suave: 0.6 } }))
  })
}

export const versoesDoBueiro: VersoesDesenhadas = {
  aberto: montarBueiroAberto,
}
