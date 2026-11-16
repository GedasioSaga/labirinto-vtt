/**
 * LUMINÁRIA ARTICULADA de cima com volume (lote L1 de 16/11/2026, necrotério e laboratório; versão ORIGINAL, só a
 * ideia do objeto das referências): a luminária de pé de consultório antigo. No canto de trás, a BASE redonda de
 * ferro fundido com o anel de reforço; dela sobe a HASTE de níquel, e do alto da haste sai o BRAÇO em dois lances,
 * com as articulações de botão e a MOLA de contrapeso ao longo do primeiro lance. Na ponta, a CÚPULA cônica de
 * esmalte verde-escuro por fora e branco por dentro, inclinada para a frente: de cima se vê o lombo dela e, na beira
 * da frente, a boca com o bulbo.
 *
 * ACESA (variante 0) e APAGADA (variante 1), como o holofote (`holofote.ts`): acesa, a boca da cúpula e o bulbo são
 * branco-quente, todo emissão, com um brilho em volta da cúpula; apagada, o esmalte branco de dentro e o bulbo de
 * vidro cinza. A luz que alcança o mapa é a da tabela `LUZ_DOS_OBJETOS` (o integrador põe a linha); aqui é só o
 * desenho. A cúpula fica no meio da pegada, de onde a luz nasce.
 *
 * NA 3/4 é derivada (`tresQuartos.ts`): a base é uma coluna baixa; a haste, uma coluna fina do chão até o alto (sobe
 * com ela o primeiro lance do braço); a cúpula é um tampo solto, e a beirada dele (`ESPESSURA_DA_CUPULA_DA_LUMINARIA`,
 * o perfil) é a saia da cúpula. O segundo lance sobe com a cúpula. Nada lê o giro: girada, a 3/4 gira a cena (a
 * cúpula continua inclinada para o lado em que o giro a deixou).
 *
 * Sem material escolhido: o ferro, o níquel, o esmalte e o vidro são fixos.
 */
import type { Rgb } from '../../ruido'
import { capsula, elipse, elipseGirada, menos } from './formas'
import { contato, type MaterialDaPeca, type Textura } from './motor'
import { G, type MontarMovel } from './contexto'
import { comMeioEm } from './varalDeBandeirinhas'
import { ESMALTE, FERRO_VELHO, NIQUEL, BRILHO_DO_NIQUEL, PISO_DO_NECROTERIO, VIDRO, texEsmalte } from './apoioDoNecroterio'

/** O esmalte verde-escuro de fora da cúpula (o verde das luminárias de consultório, apagado). */
const ESMALTE_VERDE: MaterialDaPeca = { classe: 'liso', rgb: [0x3f, 0x57, 0x4a] }
/** Acesa: o branco quente do bulbo e da boca da cúpula; o brilho em volta. */
const BULBO_ACESO: Rgb = [0xff, 0xf6, 0xe0]
const BOCA_ACESA: Rgb = [0xf6, 0xe4, 0xbc]
const COR_DO_BRILHO: Rgb = [0xff, 0xef, 0xcc]
const ALFA_DO_BRILHO = 0.4

/** As alturas em casas: o alto da haste e a cúpula; a saia da cúpula na 3/4 (px do protótipo). */
const ALTURA_DA_HASTE = 1.12
const ALTURA_DA_CUPULA = 1
export const ESPESSURA_DA_CUPULA_DA_LUMINARIA = 0.16 * G
const ALTURA_DA_BASE = 0.06

/** As medidas em frações do menor meio lado: a base (o meio e o raio), a articulação do cotovelo e a cúpula. */
const BASE = { x: -0.5, y: -0.5, r: 0.36 } as const
const COTOVELO = { x: 0.34, y: -0.62 } as const
const CUPULA = { x: 0.04, y: 0.06, rx: 0.42, ry: 0.34, giro: -0.5 } as const
/** A boca da cúpula, na beira da frente: o quanto anda para a frente e o tamanho em fração da cúpula. */
const BOCA = { frente: 0.42, parte: 0.62 } as const
const RAIO_DA_HASTE = 0.05
const RAIO_DO_BRACO = 0.035
const RAIO_DO_BOTAO = 0.075
/** A mola do primeiro lance: quantas espiras e o afastamento do braço. */
const ESPIRAS = 9
const AFASTAMENTO_DA_MOLA = 0.07
/** Onde fica o meio da caixa do brilho: no canto da frente à direita, fora da base, da haste e da cúpula. */
const MEIO_DO_BRILHO = { x: 0.62, y: 0.78 } as const
/** Onde fica o meio da caixa do segundo lance e do botão do cotovelo: dentro da cúpula, na beira do lado do cotovelo. */
const MEIO_DO_LANCE = { x: 0.16, y: -0.21 } as const

/** O brilho em volta da cúpula acesa: o tom claro com o alfa caindo do meio para fora (o do holofote). */
function texDoBrilho(cx: number, cy: number, rx: number, ry: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const dx = (x - cx) / rx
    const dy = (y - cy) / ry
    const q = Math.min(1, dx * dx + dy * dy)
    s[0] = COR_DO_BRILHO[0]
    s[1] = COR_DO_BRILHO[1]
    s[2] = COR_DO_BRILHO[2]
    s[4] = 1
    s[5] = ALFA_DO_BRILHO * (1 - q) * (1 - q)
  }
}

/** A boca acesa: branca no meio, creme na beira, toda emissão. */
function texDaBoca(cx: number, cy: number, r: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const t = Math.min(1, Math.hypot(x - cx, y - cy) / r)
    s[0] = BULBO_ACESO[0] + (BOCA_ACESA[0] - BULBO_ACESO[0]) * t
    s[1] = BULBO_ACESO[1] + (BOCA_ACESA[1] - BULBO_ACESO[1]) * t
    s[2] = BULBO_ACESO[2] + (BOCA_ACESA[2] - BULBO_ACESO[2]) * t
    s[4] = 1
  }
}

export const montarLuminariaArticulada: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  cena.corDoPiso = PISO_DO_NECROTERIO
  const m = Math.min(hw, hh)
  const acesa = c.variante !== 1
  const [bx, by, br] = [m * BASE.x, m * BASE.y, m * BASE.r]
  const [ex, ey] = [m * COTOVELO.x, m * COTOVELO.y]
  const [cx, cy, crx, cry] = [m * CUPULA.x, m * CUPULA.y, m * CUPULA.rx, m * CUPULA.ry]
  const cupula = elipseGirada(cx, cy, crx, cry, CUPULA.giro)
  const haste = elipse(bx, by, m * RAIO_DA_HASTE, m * RAIO_DA_HASTE)
  const base = elipse(bx, by, br, br)

  // As estruturas: a base baixa, a haste do chão ao alto e a cúpula solta (a saia dela é a beirada da 3/4).
  cena.sombras.push(
    { forma: base, z: g * ALTURA_DA_BASE, forca: 0.24 },
    contato(base, 0.32),
    { forma: haste, z: g * ALTURA_DA_HASTE, suave: 0.9, forca: 0.24 },
    { forma: cupula, z: g * ALTURA_DA_CUPULA, solta: true, suave: 2, forca: 0.22 },
  )

  const L = cena.partes
  // A base de ferro fundido (o meio da caixa fora da haste, para não subir com ela) e o anel de reforço.
  const [ax, ay] = [bx + br * 0.55, by + br * 0.55]
  L.push(P(comMeioEm(base, ax, ay), FERRO_VELHO, { tabua: 0, bisel: br * 0.45, contorno: 0.3, semente: 7601 }))
  L.push(P(comMeioEm(menos(elipse(bx, by, br * 0.62, br * 0.62), elipse(bx, by, br * 0.5, br * 0.5)), ax, ay), FERRO_VELHO, { tabua: 0, bisel: 0.5, tom: 1.15, contorno: 0.2, semente: 7602 }))

  // A haste vista do alto (o tampão) e o primeiro lance do braço com a mola, que sobem com a haste.
  const doLance = { tabua: 0, bisel: m * RAIO_DO_BRACO * 0.8, tom: 1.05, contorno: 0.26, metal: BRILHO_DO_NIQUEL }
  L.push(P(comMeioEm(capsula(bx, by, ex, ey, m * RAIO_DO_BRACO), bx, by), NIQUEL, { ...doLance, semente: 7603, projeta: { dist: 1.4, forca: 0.26 } }))
  const [dx, dy] = [ex - bx, ey - by]
  const comp = Math.hypot(dx, dy) || 1
  const [nx, ny] = [(-dy / comp) * m * AFASTAMENTO_DA_MOLA, (dx / comp) * m * AFASTAMENTO_DA_MOLA]
  for (let k = 1; k < ESPIRAS; k += 1) {
    const t = 0.18 + (k / ESPIRAS) * 0.64
    const [sx, sy] = [bx + dx * t + nx, by + dy * t + ny]
    L.push(P(comMeioEm(capsula(sx - nx * 0.5, sy - ny * 0.5, sx + nx * 0.5, sy + ny * 0.5, m * 0.016), bx, by), FERRO_VELHO, { tabua: 0, bisel: 0.2, tom: 1.3, contorno: 0.2, semente: 7604 + k }))
  }
  L.push(P(elipse(bx, by, m * RAIO_DO_BOTAO, m * RAIO_DO_BOTAO), NIQUEL, { tabua: 0, bisel: 0.8, tom: 1.08, contorno: 0.28, metal: BRILHO_DO_NIQUEL, semente: 7615, projeta: { dist: 1, forca: 0.28 } }))

  // O segundo lance, do cotovelo à cúpula, e o botão do cotovelo: sobem com a cúpula. O meio da caixa deles fica na
  // beira da cúpula do lado do cotovelo, e não no meio dela: a caixa esticada até lá passaria a da cúpula, e a saia
  // da cúpula na 3/4 sairia de níquel em vez do esmalte verde (a frente leva o material da maior caixa).
  const [lx, ly] = [m * MEIO_DO_LANCE.x, m * MEIO_DO_LANCE.y]
  L.push(P(comMeioEm(capsula(ex, ey, cx, cy, m * RAIO_DO_BRACO), lx, ly), NIQUEL, { ...doLance, semente: 7616, projeta: { dist: 1.4, forca: 0.26 } }))
  L.push(P(comMeioEm(elipse(ex, ey, m * RAIO_DO_BOTAO, m * RAIO_DO_BOTAO), lx, ly), NIQUEL, { tabua: 0, bisel: 0.8, tom: 1.08, contorno: 0.28, metal: BRILHO_DO_NIQUEL, semente: 7617, projeta: { dist: 1, forca: 0.28 } }))

  // O brilho em volta da cúpula acesa, por baixo dela. O meio da caixa dele fica fora de toda estrutura: na 3/4 ele
  // não sobe (é a poça de luz no chão, debaixo da cúpula) e não vira a saia da cúpula (é a maior peça dela).
  if (acesa) {
    const rb = Math.max(crx, cry) * 1.5
    const brilho = elipse(cx + crx * 0.2, cy + cry * 0.35, rb, rb)
    L.push(P(comMeioEm(brilho, m * MEIO_DO_BRILHO.x, m * MEIO_DO_BRILHO.y), ESMALTE, { tabua: 0, bisel: 0, contorno: 0, textura: texDoBrilho(cx + crx * 0.2, cy + cry * 0.35, rb, rb), semente: 7620 }))
  }
  // A cúpula: o lombo verde, o friso de níquel do pescoço e a boca na beira da frente (por dentro, o esmalte branco).
  L.push(P(cupula, ESMALTE_VERDE, { tabua: 0, bisel: crx * 0.5, contorno: 0.3, metal: 0.25, textura: texEsmalte, semente: 7621, projeta: { dist: 1.2, forca: 0.24 } }))
  const [qx, qy] = [cx - crx * 0.3, cy - cry * 0.35]
  L.push(P(elipse(qx, qy, m * 0.09, m * 0.09), NIQUEL, { tabua: 0, bisel: 0.8, tom: 1.05, contorno: 0.26, metal: BRILHO_DO_NIQUEL, semente: 7622 }))
  const [ox, oy] = [cx + crx * BOCA.frente * 0.45, cy + cry * BOCA.frente]
  const boca = elipseGirada(ox, oy, crx * BOCA.parte, cry * BOCA.parte * 0.62, CUPULA.giro)
  L.push(P(boca, ESMALTE, { tabua: 0, bisel: 0.5, contorno: 0.24, recesso: { k: 1.6, forca: 0.3 }, textura: acesa ? texDaBoca(ox, oy, crx * BOCA.parte) : texEsmalte, semente: 7623 }))
  const bulbo = elipse(ox + crx * 0.05, oy + cry * 0.02, m * 0.08, m * 0.06)
  if (acesa) L.push(P(bulbo, ESMALTE, { tabua: 0, bisel: 0, contorno: 0, textura: texDaBoca(ox, oy, m * 0.12), semente: 7624 }))
  else L.push(P(bulbo, VIDRO, { tabua: 0, bisel: 0.6, tom: 0.85, contorno: 0.24, semente: 7624 }))
  // O reflexo largo no lombo, do lado da luz.
  L.push(P(elipseGirada(cx - crx * 0.35, cy - cry * 0.1, crx * 0.32, cry * 0.18, CUPULA.giro), ESMALTE, { tabua: 0, bisel: 0, contorno: 0, tom: 1.05, alfa: 0.18, suave: 1.2, semente: 7625 }))
}
