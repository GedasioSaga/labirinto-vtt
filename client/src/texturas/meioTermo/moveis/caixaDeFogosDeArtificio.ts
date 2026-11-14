/**
 * CAIXA DE FOGOS DE ARTIFÍCIO de cima com volume (lote L10 dos objetos de 14/11/2026, grupo Taverna e festa;
 * pedido do mestre: "caixa de fogos de artifício"). O caixote de tábuas ABERTO, forrado de PALHA, com os fogos
 * deitados em cinco fileiras: os FOGUETES (o tubo de papel enrolado em espiral, o cone de ponta e o estopim no
 * rabo) e as VELAS ROMANAS (o tubo de pontas retas com as cintas de papel de outra cor). Por cima deles, a RODA
 * DE FOGO (a girândola: o tubo enrolado em espiral preso na cruz de varetas, com o cubo e o prego no meio) e uma
 * BOMBA redonda de papel pardo amarrada em cruz. Fora do caixote, à direita, dois foguetes de VARA deitados no
 * chão, cruzados, e outra bomba.
 *
 * A 25% de zoom sobram o caixote claro cheio de tubos de cores e a espiral vermelha por cima, com as duas varas
 * compridas do lado: é o que diz "fogos" e não "caixote de frutas" (bolas) nem "caixas de munição" (oliva, sem
 * cor). As cores do papel são vivas, mas contidas (saturação HSV abaixo de 0,57).
 *
 * Na 3/4 (`tresQuartos.ts`, perfil derivado) o caixote é uma coluna da altura da parede e tudo o que está
 * dentro sobe com ele (a frente sai de madeira, a maior peça); as varas e a bomba de fora ficam no chão.
 * Material: `madeira` (o caixote; pinho de partida). O papel, a palha, o estopim e as varas são fixos. As
 * posições saem de frações da pegada (1 x 0,8 casa de partida); esticado, o caixote e os tubos crescem juntos.
 */
import { barra, cadeia, caixa, capsula, elipse, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type Cena, type MaterialDaPeca, type Peca, type Sombra, type Textura } from './motor'
import { PREGO, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

/** A altura da parede do caixote, em casas (a coluna da 3/4 e a sombra no chão). */
const ALTURA_DO_CAIXOTE = 0.36
/** O caixote, em frações da meia pegada: fica à esquerda, e a direita é das varas no chão. */
const CAIXOTE_X0 = -0.97
const CAIXOTE_X1 = 0.44
const CAIXOTE_Y0 = -0.93
const CAIXOTE_Y1 = 0.9
/** A grossura da parede (px do protótipo) e a folga entre um tubo e o vizinho, por onde a palha aparece. */
const PAREDE = 2.4
const FOLGA_DOS_TUBOS = 0.62
const FILEIRAS = 5

// ---------- as cores (papel de embrulho tingido, contido) ----------

const VERMELHO: MaterialDaPeca = { classe: 'liso', rgb: [0xa6, 0x55, 0x48] }
const AZUL: MaterialDaPeca = { classe: 'liso', rgb: [0x5a, 0x6e, 0x92] }
const AMARELO: MaterialDaPeca = { classe: 'liso', rgb: [0xcc, 0xa8, 0x5c] }
const VERDE: MaterialDaPeca = { classe: 'liso', rgb: [0x6c, 0x88, 0x5e] }
const CREME: MaterialDaPeca = { classe: 'liso', rgb: [0xd8, 0xcc, 0xae] }
/** O papel pardo da bomba e o barbante que a amarra. */
const PARDO: MaterialDaPeca = { classe: 'liso', rgb: [0x9c, 0x7e, 0x58] }
const BARBANTE: MaterialDaPeca = { classe: 'corda', rgb: [0xc9, 0xbc, 0x98] }
/** O estopim: cordão encerado, escuro e esverdeado. */
const ESTOPIM: MaterialDaPeca = { classe: 'liso', rgb: [0x4c, 0x48, 0x3c] }
/** A palha do forro, mais escura que a do fardo: fica no fundo do caixote, na sombra das paredes. */
const PALHA: MaterialDaPeca = { classe: 'palha', rgb: [0xa2, 0x8c, 0x58] }
/** A vara dos foguetes de fora: taquara clara. */
const VARA: MaterialDaPeca = { classe: 'madeira', rgb: [0xc8, 0xb0, 0x7e] }
/** O cubo da roda de fogo: madeira escura, torneada. */
const CUBO: MaterialDaPeca = { classe: 'madeira', rgb: [0x7a, 0x5a, 0x40] }

type Fogo = 'foguete' | 'vela'

interface Tubo {
  /** Início e fim no comprido do miolo do caixote (frações de 0 a 1). */
  readonly de: number
  readonly ate: number
  readonly papel: MaterialDaPeca
  readonly tipo: Fogo
  /** Para que lado fica o cone (foguete) ou o estopim (vela): -1 esquerda, 1 direita. */
  readonly ponta: -1 | 1
}

/** As cinco fileiras, de trás para a frente: uma ou duas peças cada, nunca duas da mesma cor lado a lado. */
const FILEIRAS_DE_TUBOS: readonly (readonly Tubo[])[] = [
  [{ de: 0.03, ate: 0.84, papel: VERMELHO, tipo: 'foguete', ponta: -1 }],
  [{ de: 0.13, ate: 0.98, papel: AZUL, tipo: 'foguete', ponta: 1 }],
  [
    { de: 0.02, ate: 0.46, papel: AMARELO, tipo: 'vela', ponta: -1 },
    { de: 0.5, ate: 0.98, papel: VERDE, tipo: 'vela', ponta: 1 },
  ],
  [{ de: 0.04, ate: 0.88, papel: CREME, tipo: 'foguete', ponta: 1 }],
  [
    { de: 0.02, ate: 0.42, papel: VERMELHO, tipo: 'vela', ponta: -1 },
    { de: 0.5, ate: 0.97, papel: AZUL, tipo: 'foguete', ponta: -1 },
  ],
]

/** O comprimento do cone do foguete, em raios do tubo. */
const CONE = 2.1
/** A roda de fogo: o meio (fração do miolo), o raio de dentro e o de fora (fração do menor lado do miolo) e as voltas. */
const RODA = { x: 0.36, y: 0.42, r0: 0.09, r1: 0.3, voltas: 1.7, tubo: 1.2 } as const
/** As cintas creme da roda, por volta: poucas, para a espiral não virar os anéis de um alvo a 1x. */
const CINTAS_DA_RODA = 6
/** Pontos por volta da espiral: o bastante para a curva sair lisa a 4x. */
const PONTOS_POR_VOLTA = 28

/**
 * A sombra rasteira de uma peça baixa deitada no chão (a vara, a bomba de fora): a forma deslocada para baixo à
 * direita, sem altura. Sombra com altura vira coluna na 3/4, e a vara e a bomba subiriam num pedestal.
 */
function sombraRasteira(f: Forma, altura: number): Sombra {
  const dx = altura * SOMBRA_X
  const dy = altura * SOMBRA_Y
  return { forma: { b: [f.b[0] + dx, f.b[1] + dy, f.b[2] + dx, f.b[3] + dy], d: (x, y) => f.d(x - dx, y - dy) }, z: 0, suave: 1.4, forca: 0.24 }
}

/** A espiral do papel enrolado no tubo: a faixa clara a cada `passo` px, inclinada. */
function texPapel(passo: number, inclina: number): Textura {
  return (u, v, x, y, p, s) => {
    const fase = (u + v * inclina) / passo
    const t = fase - Math.floor(fase)
    s[3] += (t < 0.16 ? 0.08 : 0) - (t > 0.92 ? 0.07 : 0) + ruido(x * 0.4 + p.su, y * 0.4) * 0.03
  }
}

/** As cintas da roda: a cada `fatias` de volta, uma faixa de papel creme no tubo vermelho. */
function texCintasDaRoda(cx: number, cy: number, fatias: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const a = (Math.atan2(y - cy, x - cx) / (Math.PI * 2)) * fatias
    const t = a - Math.floor(a)
    if (t < 0.22) {
      s[0] = CREME.rgb[0]
      s[1] = CREME.rgb[1]
      s[2] = CREME.rgb[2]
    }
    s[3] += ruido(x * 0.4 + p.su, y * 0.4) * 0.03
  }
}

/** Um foguete ou uma vela deitados ao comprido, com o meio da fileira em `cy` e raio `r`. */
function montarTubo(c: ContextoDoMovel, L: Peca[], t: Tubo, xa: number, xb: number, cy: number, r: number, sem: number): void {
  const P = c.peca
  const redondo = { c: cy, r: r * 1.05, forca: 0.6 }
  const sombra = { dist: 1, forca: 0.34, suave: 0.8 }
  if (t.tipo === 'foguete') {
    // O cone sai da ponta do corpo; o estopim, do rabo.
    const cone = CONE * r
    const xCorpo0 = t.ponta < 0 ? xa + cone : xa
    const xCorpo1 = t.ponta < 0 ? xb : xb - cone
    const base = t.ponta < 0 ? xCorpo0 : xCorpo1
    const bico = t.ponta < 0 ? xa : xb
    L.push(P(caixa(xCorpo0, cy - r, xCorpo1, cy + r, r * 0.35), t.papel, { tabua: 0, bisel: 0.6, contorno: 0.3, curvaY: redondo, textura: texPapel(3.2, 1.4), semente: sem, projeta: sombra }))
    // A cinta de papel creme que prende o cone ao corpo.
    const cinta = t.ponta < 0 ? [base, base + r * 0.7] : [base - r * 0.7, base]
    L.push(P(caixa(cinta[0], cy - r, cinta[1], cy + r, 0.3), t.papel === CREME ? VERMELHO : CREME, { tabua: 0, bisel: 0.4, contorno: 0.24, curvaY: redondo, semente: sem + 1 }))
    const conePapel = t.papel === VERMELHO ? CREME : VERMELHO
    L.push(P(poligono([[base, cy - r * 0.98], [bico, cy], [base, cy + r * 0.98]]), conePapel, { tabua: 0, bisel: 0.5, contorno: 0.3, curvaY: redondo, tom: 1.04, semente: sem + 2, projeta: sombra }))
    // O estopim sai do rabo, curto e torto.
    const rabo = t.ponta < 0 ? xCorpo1 : xCorpo0
    const fora = -t.ponta
    montarEstopim(c, L, rabo, cy, fora, r, sem + 3)
    return
  }
  // A vela romana: o tubo de pontas retas com três cintas de outra cor e o estopim numa das pontas.
  L.push(P(caixa(xa, cy - r, xb, cy + r, r * 0.3), t.papel, { tabua: 0, bisel: 0.6, contorno: 0.3, curvaY: redondo, textura: texPapel(4.2, 0.6), semente: sem, projeta: sombra }))
  const cintaPapel = t.papel === CREME ? VERMELHO : CREME
  for (const f of [0.14, 0.5, 0.86]) {
    const x = xa + (xb - xa) * f
    L.push(P(caixa(x - r * 0.38, cy - r, x + r * 0.38, cy + r, 0.3), cintaPapel, { tabua: 0, bisel: 0.4, contorno: 0.22, curvaY: redondo, semente: sem + 1 }))
  }
  // A tampa de papelão da ponta, mais escura (o tubo é oco).
  const xTampa = t.ponta < 0 ? xa : xb
  L.push(P(elipse(xTampa, cy, r * 0.3, r * 0.82), PARDO, { tabua: 0, bisel: 0.3, contorno: 0.28, tom: 0.8, semente: sem + 2 }))
  montarEstopim(c, L, xTampa, cy, t.ponta, r, sem + 3)
}

/** O estopim: dois pedaços de cordão encerado saindo da ponta (x, cy) para o lado `lado`, com a ponta desfiada. */
function montarEstopim(c: ContextoDoMovel, L: Peca[], x: number, cy: number, lado: number, r: number, sem: number): void {
  const comp = r * 1.1
  const pontos: Ponto[] = [
    [x, cy],
    [x + lado * comp * 0.55, cy - r * 0.35],
    [x + lado * comp, cy + r * 0.1],
  ]
  L.push(c.peca(cadeia(pontos, 0.42), ESTOPIM, { tabua: 0, bisel: 0.3, contorno: 0.3, semente: sem, projeta: { dist: 0.5, forca: 0.3 } }))
}

/** A roda de fogo em cima dos tubos: a cruz de varetas, o tubo em espiral, o cubo e o prego. */
function montarRoda(c: ContextoDoMovel, L: Peca[], cx: number, cy: number, lado: number, sem: number): void {
  const P = c.peca
  const r0 = RODA.r0 * lado
  const r1 = RODA.r1 * lado
  const cruz = { tabua: 0, bisel: 0.4, contorno: 0.3, semente: sem, projeta: { dist: 1.3, forca: 0.36 } }
  L.push(P(barra(cx - r1 * 0.98, cy - r1 * 0.2, cx + r1 * 0.98, cy + r1 * 0.2, 1.1), VARA, { ...cruz, eixo: -0.2 }))
  L.push(P(barra(cx - r1 * 0.2, cy + r1 * 0.98, cx + r1 * 0.2, cy - r1 * 0.98, 1.1), VARA, { ...cruz, eixo: QUARTO, semente: sem + 1 }))
  const total = Math.round(RODA.voltas * PONTOS_POR_VOLTA)
  const pontos: Ponto[] = []
  for (let i = 0; i <= total; i += 1) {
    const t = i / total
    const a = t * RODA.voltas * Math.PI * 2 + 0.6
    const r = r0 + (r1 - r0) * t
    pontos.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r])
  }
  L.push(P(cadeia(pontos, RODA.tubo), VERMELHO, { tabua: 0, bisel: RODA.tubo * 0.9, contorno: 0.32, textura: texCintasDaRoda(cx, cy, CINTAS_DA_RODA), semente: sem + 2, projeta: { dist: 1.6, forca: 0.42, suave: 0.8 } }))
  // A ponta de fora da espiral é o estopim.
  const [ex, ey] = pontos[pontos.length - 1]
  L.push(P(cadeia([[ex, ey], [ex + 1.4, ey + 1.6], [ex + 0.9, ey + 3]], 0.42), ESTOPIM, { tabua: 0, bisel: 0.3, contorno: 0.3, semente: sem + 3 }))
  // O cubo é escuro e pequeno: claro, no meio da espiral, lia como o miolo de um alvo.
  L.push(P(elipse(cx, cy, r0 * 0.8, r0 * 0.8), CUBO, { tabua: 0, bisel: r0 * 0.5, contorno: 0.3, semente: sem + 4, projeta: { dist: 0.8, forca: 0.32 } }))
  L.push(P(elipse(cx - 0.2, cy - 0.2, 0.7, 0.7), PREGO, { bisel: 0.6, contorno: 0, metal: 0.4 }))
}

/** A bomba: a bola de papel pardo, o barbante em cruz e o tufo do estopim no alto. */
function montarBomba(c: ContextoDoMovel, L: Peca[], x: number, y: number, r: number, noChao: Cena | null, sem: number): void {
  const P = c.peca
  const bola = elipse(x, y, r, r)
  if (noChao !== null) noChao.sombras.push(sombraRasteira(bola, r * 1.6), contato(elipse(x, y, r * 0.8, r * 0.8), 0.3))
  L.push(P(bola, PARDO, { tabua: 0, bisel: r * 0.75, contorno: 0.28, textura: texturaDaClasse('tecido'), semente: sem, projeta: { dist: 1.4, forca: 0.38, suave: 0.9 } }))
  const fio = { tabua: 0, bisel: 0.3, contorno: 0.24, semente: sem + 1 }
  L.push(P(capsula(x - r * 0.92, y - r * 0.18, x + r * 0.92, y + r * 0.18, 0.36), BARBANTE, { ...fio, eixo: 0.2 }))
  L.push(P(capsula(x - r * 0.18, y + r * 0.92, x + r * 0.18, y - r * 0.92, 0.36), BARBANTE, { ...fio, eixo: QUARTO }))
  L.push(P(cadeia([[x, y], [x - r * 0.35, y - r * 0.5], [x - r * 0.1, y - r * 0.85]], 0.45), ESTOPIM, { tabua: 0, bisel: 0.3, contorno: 0.3, semente: sem + 2 }))
}

/** O foguete de vara deitado no chão: a vara do rabo até a cabeça e, na cabeça, o tubo e o cone. */
function montarFogueteDeVara(c: ContextoDoMovel, cena: Cena, rabo: Ponto, cabeca: Ponto, comp: number, r: number, papel: MaterialDaPeca, sem: number): void {
  const P = c.peca
  const L = cena.partes
  const dx = cabeca[0] - rabo[0]
  const dy = cabeca[1] - rabo[1]
  const l = Math.hypot(dx, dy)
  const ux = dx / l
  const uy = dy / l
  const ang = Math.atan2(dy, dx)
  const vara = capsula(rabo[0], rabo[1], cabeca[0], cabeca[1], 0.62)
  const fim: Ponto = [cabeca[0] + ux * comp, cabeca[1] + uy * comp]
  const corpo = barra(cabeca[0], cabeca[1], fim[0], fim[1], r * 2)
  const bico: Ponto = [fim[0] + ux * r * CONE, fim[1] + uy * r * CONE]
  const nx = -uy * r
  const ny = ux * r
  const cone = poligono([[fim[0] + nx, fim[1] + ny], bico, [fim[0] - nx, fim[1] - ny]])
  cena.sombras.push(sombraRasteira(vara, 1.2), sombraRasteira(uniao(corpo, cone), r * 2), contato(corpo, 0.3))
  L.push(P(vara, VARA, { tabua: 0, eixo: ang, bisel: 0.5, contorno: 0.3, semente: sem }))
  // A vara amarrada no tubo: duas voltas de barbante.
  L.push(P(corpo, papel, { tabua: 0, eixo: ang, bisel: r * 0.8, contorno: 0.3, textura: texPapel(3.2, 1.4), semente: sem + 1, projeta: { dist: 0.9, forca: 0.3 } }))
  for (const f of [0.25, 0.7]) {
    const px = cabeca[0] + ux * comp * f
    const py = cabeca[1] + uy * comp * f
    L.push(P(barra(px - ux * 0.5, py - uy * 0.5, px + ux * 0.5, py + uy * 0.5, r * 2.15), BARBANTE, { tabua: 0, eixo: ang + QUARTO, bisel: 0.4, contorno: 0.24, semente: sem + 2 }))
  }
  L.push(P(cone, papel === VERMELHO ? CREME : VERMELHO, { tabua: 0, bisel: r * 0.7, contorno: 0.3, tom: 1.04, semente: sem + 3 }))
}

export const montarCaixaDeFogosDeArtificio: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const mad = c.m.madeira
  const L = cena.partes
  const x0 = CAIXOTE_X0 * hw
  const x1 = CAIXOTE_X1 * hw
  const y0 = CAIXOTE_Y0 * hh
  const y1 = CAIXOTE_Y1 * hh
  const fora = caixa(x0, y0, x1, y1, 0.8)

  // Fora do caixote primeiro: ficam no chão, por baixo da sombra dele. Os dois foguetes de vara cruzados e a bomba.
  const R = Math.min(hw, hh)
  const rVara = R * 0.095
  montarFogueteDeVara(c, cena, [0.53 * hw, 0.54 * hh], [0.87 * hw, -0.5 * hh], R * 0.3, rVara, AZUL, 8800)
  montarFogueteDeVara(c, cena, [0.92 * hw, 0.92 * hh], [0.72 * hw, -0.28 * hh], R * 0.3, rVara, VERMELHO, 8810)
  montarBomba(c, L, 0.71 * hw, 0.72 * hh, R * 0.15, cena, 8820)

  cena.sombras.push({ forma: fora, z: c.g * ALTURA_DO_CAIXOTE }, contato(fora, 0.32))
  // A caixa inteira (a maior peça: a frente da 3/4 sai dela) e o forro de palha no fundo, na sombra das paredes.
  L.push(P(fora, mad, { tabua: 0, bisel: 0.8, tom: 0.72, contorno: 0.32, semente: 8700 }))
  const ix0 = x0 + PAREDE
  const ix1 = x1 - PAREDE
  const iy0 = y0 + PAREDE
  const iy1 = y1 - PAREDE
  L.push(P(caixa(ix0, iy0, ix1, iy1), PALHA, { eixo: 0.4, bisel: 0, contorno: 0, recesso: { k: 2.6, forca: 0.42 }, tom: 0.86, semente: 8701 }))

  // Os tubos, fileira por fileira.
  const passo = (iy1 - iy0) / FILEIRAS
  const r = passo / 2 - FOLGA_DOS_TUBOS / 2
  const largura = ix1 - ix0
  FILEIRAS_DE_TUBOS.forEach((fileira, i) => {
    const cy = iy0 + passo * (i + 0.5)
    fileira.forEach((t, j) => montarTubo(c, L, t, ix0 + largura * t.de, ix0 + largura * t.ate, cy, r, 8710 + i * 10 + j * 5))
  })

  // Por cima dos tubos: a roda de fogo e uma bomba.
  const ladoDoMiolo = Math.min(largura, iy1 - iy0)
  montarRoda(c, L, ix0 + largura * RODA.x, iy0 + (iy1 - iy0) * RODA.y, ladoDoMiolo, 8760)
  montarBomba(c, L, ix1 - ladoDoMiolo * 0.19, iy1 - ladoDoMiolo * 0.27, ladoDoMiolo * 0.13, null, 8770)

  // As quatro paredes por cima de tudo: as compridas de pé, as do fundo e da frente deitadas, e os pregos dos cantos.
  const parede = { tabua: 0, bisel: 0.9, contorno: 0.3 }
  L.push(P(caixa(x0, y0, ix0, y1, 0.6), mad, { ...parede, eixo: QUARTO, tom: 0.96, semente: 8780 }))
  L.push(P(caixa(ix1, y0, x1, y1, 0.6), mad, { ...parede, eixo: QUARTO, tom: 0.9, semente: 8781 }))
  L.push(P(caixa(ix0, y0, ix1, iy0, 0.3), mad, { ...parede, tom: 1.04, semente: 8782 }))
  L.push(P(caixa(ix0, iy1, ix1, y1, 0.3), mad, { ...parede, tom: 0.94, semente: 8783 }))
  for (const [px, py] of [[x0 + PAREDE / 2, y0 + PAREDE / 2], [x1 - PAREDE / 2, y0 + PAREDE / 2], [x0 + PAREDE / 2, y1 - PAREDE / 2], [x1 - PAREDE / 2, y1 - PAREDE / 2]]) {
    L.push(P(elipse(px, py, 0.6, 0.6), PREGO, { bisel: 0.6, contorno: 0, metal: 0.2 }))
  }
}
