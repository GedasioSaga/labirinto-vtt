/**
 * BAÚ DE FERRO de cima com volume (lote L02 dos objetos de 24/11/2026, Masmorra: carcereiro e tortura; a versão
 * de ferro do baú): o cofre do carcereiro, todo de CHAPA batida, sem uma tábua. A TAMPA abaulada, de ferro
 * martelado, quase do tom das cintas: o arco se lê pela LUZ (uma faixa clara a um terço do alto, que escurece para a
 * frente e para trás) e por um fio claro na beira de cima. Em volta da tampa, a CINTA da beira, e de través, as duas
 * CINTAS, todas rebitadas em fila; nos cantos, as CANTONEIRAS; nas pontas, as ALÇAS grossas de argola, presas numa
 * chapinha rebitada; na frente, o FECHO com o CADEADO grande pendurado. A ferrugem escorre curta, de pé, embaixo de
 * alguns rebites.
 *
 * O que diz "baú de ferro" (e não baú de madeira) a 25% de zoom é o retângulo de ferro frio, riscado de faixas com
 * pontos claros, e o cadeado saindo da frente.
 *
 * Na 3/4 (`tresQuartos.ts`, derivado) o corpo é uma coluna da altura do baú e tudo o que é da tampa sobe com ela; o
 * cadeado e as alças têm a caixa com o meio dentro do corpo (`comMeioEm`), para subirem junto. A frente é chapa LISA
 * (a tampa usa um ferro de classe lisa com a textura própria, e a frente herda só o material: com a textura de metal
 * ela saía riscada de pé, como chapa corrugada).
 *
 * Esticado, a chapa, as cintas e as fileiras de rebites acompanham a pegada (mais rebites, nunca maiores); o cadeado
 * e as alças têm o tamanho do menor lado. Materiais: `chapa` (a tampa) e `ferragens` (as cintas, os rebites, as
 * cantoneiras, as alças e o cadeado). A ferrugem é fixa.
 */
import { hash, type Rgb } from '../../ruido'
import { caixa, dentroDe, elipse, menos, poligono, type Forma } from './formas'
import { contato, ruido, type CurvaY, type MaterialDaPeca, type Textura } from './motor'
import { G, QUARTO, type MontarMovel } from './contexto'

// ---------- as medidas ----------

/** A altura do baú (px do protótipo). */
const ALTURA_DO_BAU = 0.46 * G
/** O quanto o corpo entra da beira da pegada: dos lados e atrás, e na frente (o lugar do cadeado). */
const RECUO_DOS_LADOS = 1.8
const RECUO_DA_FRENTE = 3.6
/** A cinta da beira e as cintas de través (meia largura, px); o meio das de través (fração do meio comprimento). */
const CINTA_DA_BEIRA = 2.5
const MEIA_CINTA = 2.3
const MEIO_DAS_CINTAS = 0.38
/** Os tons: os painéis da tampa quase no das cintas (no máximo 0,1 de diferença), senão liam como vidro. */
const TOM_DOS_PAINEIS = 0.85
const TOM_DAS_CINTAS = 0.76
const TOM_DAS_CANTONEIRAS = 0.74
/** O passo dos rebites (px) e o raio de cada um. */
const PASSO_DO_REBITE = 4.8
const RAIO_DO_REBITE = 0.85
/** A cantoneira (lado, px). */
const CANTONEIRA = 6.2
/** O arco da tampa: a força da inclinação, a faixa de luz (a 1/3 do alto) e a meia largura dela (frações da fundura). */
const FORCA_DO_ARCO = 0.5
const ALTURA_DA_FAIXA = 1 / 3
const LARGURA_DA_FAIXA = 0.16
const LUZ_DA_FAIXA = 0.18
const ESCURO_FORA_DA_FAIXA = 0.1
/** O menor lado da pegada de partida (0,6 casa): o cadeado e as alças são medidos nele. */
const LADO_DE_PARTIDA = 0.6 * G
/** A ferrugem: os escorridos curtos embaixo dos rebites (a fração dos rebites que escorre e o comprimento, px). */
const CHANCE_DE_FERRUGEM = 0.2
const ESCORRIDO = 2.6

// ---------- os materiais fixos ----------

const FERRUGEM: MaterialDaPeca = { classe: 'liso', rgb: [0x7c, 0x52, 0x3a] }
/** O escuro em que o pixel escuro demais é levantado: cinza-ferro frio (com o da nogueira, a quina saía marrom). */
const ESCURO_DO_FERRO: Rgb = [0x40, 0x43, 0x47]
const BURACO_DA_CHAVE: MaterialDaPeca = { classe: 'liso', rgb: [0x26, 0x24, 0x24] }

/** O ferro batido da tampa: as mossas do martelo em duas escalas, sem listra, e a faixa de luz do arco. */
function texChapa(yFaixa: number, largura: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const q = (y - yFaixa) / largura
    s[3] += ruido(x * 0.24 + p.su, y * 0.24 + p.sv) * 0.1 + ruido(x * 0.75 + 31, y * 0.75) * 0.04 + LUZ_DA_FAIXA * Math.exp(-q * q) - ESCURO_FORA_DA_FAIXA
  }
}

/** A mesma forma numa caixa com o meio em (mx, my): a 3/4 sobe a peça com a estrutura que contém esse ponto. */
function comMeioEm(forma: Forma, mx: number, my: number): Forma {
  const ex = Math.max(mx - forma.b[0], forma.b[2] - mx)
  const ey = Math.max(my - forma.b[1], forma.b[3] - my)
  return { b: [mx - ex, my - ey, mx + ex, my + ey], d: forma.d }
}

/** Os pontos a cada `passo` ao longo de um segmento, sem as pontas. */
function aoLongo(x0: number, y0: number, x1: number, y1: number, passo: number): readonly (readonly [number, number])[] {
  const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / passo))
  return Array.from({ length: n + 1 }, (_, i) => [x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n] as const)
}

/** O escorrido de ferrugem de um rebite: fino, de pé, afinando para baixo, com a gota na ponta. */
function escorrido(x: number, y: number, comp: number): Forma {
  return poligono([
    [x - 0.55, y],
    [x + 0.55, y],
    [x + 0.24, y + comp],
    [x, y + comp + 0.3],
    [x - 0.24, y + comp],
  ])
}

export const montarBauDeFerro: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const chapa = c.m.chapa
  const fer = c.m.ferragens
  const L = cena.partes
  const k = Math.min(c.w, c.h) / LADO_DE_PARTIDA
  const bx = hw - RECUO_DOS_LADOS
  const y0 = -hh + RECUO_DOS_LADOS
  const y1 = hh - RECUO_DA_FRENTE
  const meioY = (y0 + y1) / 2
  const fundura = y1 - y0
  const corpo = caixa(-bx, y0, bx, y1, 1.6)
  // O arco deita em volta da faixa de luz: dali para trás a chapa olha para a luz, dali para a frente vira as costas.
  const yFaixa = y0 + fundura * ALTURA_DA_FAIXA
  const arco: CurvaY = { c: yFaixa, r: Math.max(yFaixa - y0, y1 - yFaixa), forca: FORCA_DO_ARCO }
  // A tampa é de classe lisa: de cima ela usa a textura própria, e a frente da 3/4, que herda o material, sai lisa.
  const chapaLisa: MaterialDaPeca = { classe: 'liso', rgb: chapa.rgb }
  const rebites: { x: number; y: number; semente: number }[] = []

  // ---------- as sombras: o corpo inteiro (coluna) e o contato ----------
  cena.corDoPiso = ESCURO_DO_FERRO
  cena.sombras.push({ forma: corpo, z: ALTURA_DO_BAU, forca: 0.32 }, contato(corpo, 0.36))

  // ---------- as alças de argola nas pontas, grossas (por baixo da beira da tampa e da chapinha) ----------
  for (const lado of [-1, 1]) {
    const ax = lado * (bx + 0.6)
    const meiaAlca = lado < 0 ? caixa(ax - 4.4 * k, meioY - 6.4 * k, ax + 0.4, meioY + 6.4 * k) : caixa(ax - 0.4, meioY - 6.4 * k, ax + 4.4 * k, meioY + 6.4 * k)
    const argola = dentroDe(menos(elipse(ax, meioY, 3.6 * k, 5.6 * k), elipse(ax, meioY, 1.6 * k, 3.4 * k)), meiaAlca)
    L.push(P(comMeioEm(argola, lado * (bx - 2), meioY), fer, { tabua: 0, bisel: 1, contorno: 0.34, tom: 0.92, metal: 0.5, semente: 9505 + lado, projeta: { dist: 1, forca: 0.42 } }))
  }

  // ---------- a tampa de chapa batida: quase do tom das cintas, o arco pela luz ----------
  L.push(P(corpo, chapaLisa, { textura: texChapa(yFaixa, fundura * LARGURA_DA_FAIXA), tabua: 0, bisel: 1.5, contorno: 0.34, tom: TOM_DOS_PAINEIS, metal: 0.3, curvaY: arco, semente: 9510 }))

  // ---------- a frente na 3/4: a beira da tampa e as cintas descendo pela frente ----------
  // Estruturas sem sombra (força 0), só para a 3/4: uma fita na beira da frente, com uma peça de ferragem dentro,
  // vira a face daquela fita. A beira da tampa (tampo solto, da espessura do perfil, mais clara: a luz vem de cima) e,
  // por cima dela, as cintas e as cantoneiras de cima a baixo (colunas). De cima, as peças ficam por baixo das cintas.
  const fita = (xa: number, xb: number): Forma => caixa(xa, y1 - 0.7, xb, y1, 0.2)
  const fitas: { forma: Forma; solta: boolean }[] = [
    { forma: fita(-bx + 0.8, bx - 0.8), solta: true },
    ...[-MEIO_DAS_CINTAS * bx, MEIO_DAS_CINTAS * bx].map((x) => ({ forma: fita(x - MEIA_CINTA, x + MEIA_CINTA), solta: false })),
    { forma: fita(-bx, -bx + CANTONEIRA * 0.8), solta: false },
    { forma: fita(bx - CANTONEIRA * 0.8, bx), solta: false },
  ]
  // A face na 3/4 pega o MATERIAL da peça (o tom é o da frente): ferro de classe lisa, sem estria.
  const ferDaFrente = (f: number): MaterialDaPeca => ({ classe: 'liso', rgb: [fer.rgb[0] * f, fer.rgb[1] * f, fer.rgb[2] * f] })
  fitas.forEach(({ forma, solta }, i) => {
    cena.sombras.push({ forma, z: ALTURA_DO_BAU, solta, forca: 0 })
    L.push(P(forma, ferDaFrente(solta ? 1.02 : 0.76), { tabua: 0, bisel: 0.3, contorno: 0.2, metal: 0.3, semente: 9560 + i }))
  })

  // ---------- as cintas: a da beira e as duas de través ----------
  const dentro = caixa(-bx + CINTA_DA_BEIRA * 2, y0 + CINTA_DA_BEIRA * 2, bx - CINTA_DA_BEIRA * 2, y1 - CINTA_DA_BEIRA * 2, 0.6)
  L.push(P(menos(corpo, dentro), fer, { tabua: 0, bisel: 0.9, contorno: 0.3, tom: TOM_DAS_CINTAS, metal: 0.3, curvaY: arco, semente: 9511, projeta: { dist: 0.8, forca: 0.35, suave: 0.6 } }))
  const xsCintas = [-MEIO_DAS_CINTAS * bx, MEIO_DAS_CINTAS * bx]
  xsCintas.forEach((x, i) => {
    L.push(P(caixa(x - MEIA_CINTA, y0, x + MEIA_CINTA, y1, 0.5), fer, { eixo: QUARTO, tabua: 0, bisel: 0.9, contorno: 0.3, tom: TOM_DAS_CINTAS, metal: 0.3, curvaY: arco, semente: 9512 + i, projeta: { dist: 0.9, forca: 0.4, suave: 0.6 } }))
  })

  // ---------- as cantoneiras ----------
  const cantos: [number, number][] = []
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const cx = sx * bx
    const cy = sy < 0 ? y0 : y1
    const canto = caixa(Math.min(cx, cx - sx * CANTONEIRA), Math.min(cy, cy - sy * CANTONEIRA), Math.max(cx, cx - sx * CANTONEIRA), Math.max(cy, cy - sy * CANTONEIRA), 1.2)
    L.push(P(canto, fer, { tabua: 0, bisel: 0.8, contorno: 0.32, tom: TOM_DAS_CANTONEIRAS, metal: 0.3, curvaY: arco, semente: 9580, projeta: { dist: 0.7, forca: 0.35 } }))
    cantos.push([cx - sx * CANTONEIRA * 0.45, cy - sy * CANTONEIRA * 0.45])
  }

  // ---------- os rebites: em fila pela cinta da beira e pelas de través, e um em cada cantoneira ----------
  const rx = bx - CINTA_DA_BEIRA
  const ry0 = y0 + CINTA_DA_BEIRA
  const ry1 = y1 - CINTA_DA_BEIRA
  let s = 9520
  const anotar = (x: number, y: number): void => {
    rebites.push({ x, y, semente: (s += 1) })
  }
  for (const [x, y] of aoLongo(-rx, ry0, rx, ry0, PASSO_DO_REBITE)) anotar(x, y)
  for (const [x, y] of aoLongo(-rx, ry1, rx, ry1, PASSO_DO_REBITE)) anotar(x, y)
  for (const lado of [-1, 1]) for (const [x, y] of aoLongo(lado * rx, ry0, lado * rx, ry1, PASSO_DO_REBITE).slice(1, -1)) anotar(x, y)
  for (const x of xsCintas) for (const [px, py] of aoLongo(x, ry0, x, ry1, PASSO_DO_REBITE).slice(1, -1)) anotar(px, py)
  for (const [x, y] of cantos) anotar(x, y)

  // A ferrugem: escorridos curtos e de pé, embaixo de alguns rebites (as manchas redondas liam como borrão laranja).
  rebites.forEach(({ x, y }, i) => {
    if (hash(i, 3, 9590) >= CHANCE_DE_FERRUGEM) return
    const comp = ESCORRIDO * (0.7 + hash(i, 4, 9590) * 0.7)
    L.push(P(dentroDe(escorrido(x + (hash(i, 5, 9590) - 0.5) * 0.3, y + 0.3, comp), corpo), FERRUGEM, { bisel: 0, contorno: 0, alfa: 0.3, suave: 0.35, semente: 9591 }))
  })
  for (const { x, y, semente } of rebites) {
    L.push(P(elipse(x, y, RAIO_DO_REBITE, RAIO_DO_REBITE), fer, { bisel: 0.6, contorno: 0.28, tom: 1.24 + hash(Math.round(x * 3), Math.round(y * 3), 9501) * 0.1, metal: 0.62, curvaY: arco, semente, projeta: { dist: 0.55, forca: 0.4 } }))
  }

  // ---------- a chapinha rebitada que prende cada alça ----------
  for (const lado of [-1, 1]) {
    const x = lado * bx
    const placa = caixa(x - 1.4, meioY - 6.4 * k, x + 1.4, meioY + 6.4 * k, 0.6)
    L.push(P(comMeioEm(placa, lado * (bx - 2), meioY), fer, { tabua: 0, bisel: 0.6, contorno: 0.32, tom: 0.84, metal: 0.35, semente: 9585 + lado, projeta: { dist: 0.7, forca: 0.4 } }))
    for (const dy of [-4.6 * k, 4.6 * k]) {
      L.push(P(comMeioEm(elipse(x, meioY + dy, 0.75, 0.75), lado * (bx - 2), meioY), fer, { bisel: 0.5, contorno: 0.28, tom: 1.2, metal: 0.6, semente: 9587 }))
    }
  }

  // ---------- o fio de luz na beira de cima da tampa (no piso escuro, sem ele o baú sumia) ----------
  L.push(P(caixa(-bx + 1.4, y0 + 0.2, bx - 1.4, y0 + 0.85, 0.3), chapa, { tabua: 0, bisel: 0, contorno: 0, tom: 1.25, metal: 0.3, alfa: 0.9, semente: 9594 }))

  // ---------- o fecho e o cadeado pendurado na frente ----------
  const fecho = caixa(-2.1 * k, y1 - 5 * k, 2.1 * k, y1 + 1.2 * k, 0.7)
  L.push(P(fecho, fer, { tabua: 0, bisel: 0.7, contorno: 0.34, tom: 0.78, metal: 0.4, semente: 9595, projeta: { dist: 0.9, forca: 0.45 } }))
  L.push(P(elipse(0, y1 - 3.8 * k, RAIO_DO_REBITE, RAIO_DO_REBITE), fer, { bisel: 0.6, contorno: 0.28, tom: 1.24, metal: 0.62, semente: 9596, projeta: { dist: 0.55, forca: 0.4 } }))
  const ay = y1 + 1.6 * k
  const argola = menos(elipse(0, ay, 2.2 * k, 2.4 * k), elipse(0, ay, 1.2 * k, 1.4 * k))
  L.push(P(comMeioEm(argola, 0, y1 - 2), fer, { tabua: 0, bisel: 0.6, contorno: 0.34, tom: 1.06, metal: 0.55, semente: 9597 }))
  const cadeado = caixa(-3.3 * k, ay + 1.2 * k, 3.3 * k, ay + 6.6 * k, 1.7 * k)
  L.push(P(comMeioEm(cadeado, 0, y1 - 2), fer, { tabua: 0, bisel: 1.2, contorno: 0.36, tom: 0.96, metal: 0.55, semente: 9598, projeta: { dist: 1.2, forca: 0.45 } }))
  L.push(P(comMeioEm(caixa(-0.5 * k, ay + 3 * k, 0.5 * k, ay + 5.2 * k, 0.4), 0, y1 - 2), BURACO_DA_CHAVE, { bisel: 0, contorno: 0, semente: 9599 }))
}
