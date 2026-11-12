/**
 * O OURO DO TESOURO (lote 17 dos objetos novos, 12/11/2026; pedido do mestre: "coloque Ouro, Diamente, Joias,
 * Moedas de ouro como objeto única e em poças"): as cores do ouro e o que a peça única e o monte desenham do
 * mesmo jeito: a BARRA de fundição, a MOEDA cunhada, a PEPITA, o pedaço de MINÉRIO, o BRILHO em estrela e a
 * MASSA de ouro que enche o vão entre as peças do monte. É um ajudante, como `blocoDeInscricoes.ts`: não é
 * objeto e não entra em MONTADORES, PERFIS nem no catálogo.
 *
 * O ouro é velho, quente e contido: âmbar e ocre no corpo, o amarelo claro só nas quinas, nos reflexos e nos
 * brilhos, e a sombra num marrom apagado. Escurecer o âmbar o leva a um marrom de saturação HSV acima do teto
 * de 0,62; por isso a rampa e o lado de lá da moeda MISTURAM para o marrom da sombra em vez de só perder luz.
 * A tabela de materiais não tem ouro: a cor é literal, como nos blocos dourados. O brilho é PINTADO (a luz das
 * rampas, a meia-lua da moeda, as estrelinhas); nada aqui acende luz.
 *
 * A luz pintada vem da direção da luz NO CHÃO DA TELA (`paraALuz`): de cima é a do motor, porque quem gira é a
 * imagem pronta; na 3/4 o quarto de volta é pintado na cena e a direção chega desgirada pelo `giro` (a conta da
 * armadilha de espinhos), para a rampa clara ficar do lado da luz em qualquer giro.
 *
 * Os MONTES sobem na 3/4 em dois degraus (`declararAlturas`): o anel do meio e o miolo são estruturas soltas e
 * sem sombra (a da armadilha), as duas com a caixa do monte inteiro, para a 3/4 pintar o miolo por último em
 * qualquer giro. O degrau que aparece embaixo de cada camada é o FLANCO, pintado na massa da camada de baixo
 * (`texDaMassa`): de cima ele fica escondido, na 3/4 é o lado do monte, escuro e riscado de quinas de ouro.
 */
import { hash, type Rgb } from '../../ruido'
import { capsula, elipse, elipseGirada, menos, poligono, uniao, type Forma, type Ponto } from './formas'
import { ruido, type Cena, type CriarPeca, type MaterialDaPeca, type Textura } from './motor'

// ---------- as cores ----------

/** O corpo do ouro: âmbar-ocre (saturação HSV 0,54, matiz 39°), nem amarelo-limão nem laranja. */
export const OURO: MaterialDaPeca = { classe: 'metal', rgb: [0xbc, 0x98, 0x56] }
/** O amarelo claro das quinas e dos reflexos (saturação 0,31). */
export const BRILHO_DO_OURO: Rgb = [0xf2, 0xe0, 0xa8]
/** A sombra do ouro: marrom quente e apagado (saturação 0,43). */
export const SOMBRA_DO_OURO: Rgb = [0x7a, 0x62, 0x46]
/** A massa entre as peças do monte: o ouro de baixo, na sombra das de cima (com as pintas, não lama). */
export const MASSA_DO_OURO: MaterialDaPeca = { classe: 'liso', rgb: [0x80, 0x65, 0x3c] }
/**
 * O escuro em que o pixel escuro demais é levantado: o marrom do ouro na sombra (saturação 0,50, luminância
 * linear 0,070). Com o da nogueira (saturação 0,60) os vãos do monte saíam cor de madeira.
 */
export const ESCURO_DO_OURO: Rgb = [0x5c, 0x47, 0x2e]
/** O brilho em estrela, como material. */
const ESTRELA: MaterialDaPeca = { classe: 'liso', rgb: BRILHO_DO_OURO }
/** A rocha do minério: pardo escuro e quente, que faz o ouro do veio saltar (cinza neutro, ao lado do ouro, lia azul). */
const ROCHA: MaterialDaPeca = { classe: 'pedra', pedra: 'granito', rgb: [0x6c, 0x5c, 0x4a] }

// ---------- a luz pintada e o giro ----------

/** A luz do motor no chão (de cima à esquerda): para onde olha a rampa clara. */
const LUZ_NO_CHAO: Ponto = [-0.79, -0.61]
/** Abaixo deste tamanho (pixels da imagem por px do protótipo) o risco fino e a conta da borda viram ruído. */
const ESCALA_DO_DETALHE = 2

/** O deslocamento que cai em (dx, dy) NA TELA depois do quarto de volta da 3/4 (`giro`, em graus): a conta do altar. */
export function desgirado(dx: number, dy: number, giro: number): Ponto {
  const quartos = ((Math.round(giro / 90) % 4) + 4) % 4
  return quartos === 1 ? [dy, -dx] : quartos === 2 ? [-dx, -dy] : quartos === 3 ? [-dy, dx] : [dx, dy]
}

/** A direção da luz no chão, no referencial do desenho. */
export function paraALuz(giro: number): Ponto {
  return desgirado(LUZ_NO_CHAO[0], LUZ_NO_CHAO[1], giro)
}

function limitar01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t
}

function suave01(t: number): number {
  const x = limitar01(t)
  return x * x * (3 - 2 * x)
}

/** Escreve em `s` a cor de `s` puxada para `alvo` (t de 0 a 1). */
function puxar(s: Float32Array, alvo: Rgb, t: number): void {
  s[0] += (alvo[0] - s[0]) * t
  s[1] += (alvo[1] - s[1]) * t
  s[2] += (alvo[2] - s[2]) * t
}

// ---------- formas ----------

/** Retângulo de meias medidas (a, b) e cantos arredondados `raio`, girado `ang` em volta de (cx, cy). */
export function caixaGirada(cx: number, cy: number, a: number, b: number, ang: number, raio: number): Forma {
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  const r = Math.min(raio, a, b)
  const hx = a - r
  const hy = b - r
  const ex = Math.abs(a * co) + Math.abs(b * si)
  const ey = Math.abs(a * si) + Math.abs(b * co)
  return {
    b: [cx - ex, cy - ey, cx + ex, cy + ey],
    d(x, y) {
      const dx = x - cx
      const dy = y - cy
      const qx = Math.abs(dx * co + dy * si) - hx
      const qy = Math.abs(-dx * si + dy * co) - hy
      const ox = qx > 0 ? qx : 0
      const oy = qy > 0 ? qy : 0
      const dentro = qx > qy ? qx : qy
      return Math.sqrt(ox * ox + oy * oy) + (dentro < 0 ? dentro : 0) - r
    },
  }
}

/** Círculo com a distância exata: o monte tem centenas de moedas, e a conta da elipse custa mais. */
export function circulo(cx: number, cy: number, r: number): Forma {
  return { b: [cx - r, cy - r, cx + r, cy + r], d: (x, y) => Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) - r }
}

/**
 * A mesma forma com a caixa de pintura centrada em (mx, my): o desenho não muda, mas o meio da caixa, que é o
 * que a 3/4 lê para saber com que estrutura a peça sobe, cai onde se quer (a conta da armadilha de espinhos).
 */
export function comMeioEm(forma: Forma, mx: number, my: number): Forma {
  const ex = Math.max(mx - forma.b[0], forma.b[2] - mx)
  const ey = Math.max(my - forma.b[1], forma.b[3] - my)
  return { b: [mx - ex, my - ey, mx + ex, my + ey], d: forma.d }
}

/** A forma com a beira ondulada pelo ruído, `amplitude` px para dentro e para fora: o contorno de coisa derramada. */
export function ondular(f: Forma, amplitude: number, escala: number, semente: number): Forma {
  const b = f.b
  return {
    b: [b[0] - amplitude, b[1] - amplitude, b[2] + amplitude, b[3] + amplitude],
    d: (x, y) => f.d(x, y) + ruido(x * escala + semente, y * escala - semente) * 2 * amplitude,
  }
}

/** A forma deslocada (dx, dy): a sombra pintada no chão, que não pode ter altura (viraria estrutura na 3/4). */
export function deslocada(f: Forma, dx: number, dy: number): Forma {
  const b = f.b
  return { b: [b[0] + dx, b[1] + dy, b[2] + dx, b[3] + dy], d: (x, y) => f.d(x - dx, y - dy) }
}

/** A forma encolhida `margem` px para dentro (a região das peças de uma camada, longe da beira dela). */
export function encolhida(f: Forma, margem: number): Forma {
  return { b: f.b, d: (x, y) => f.d(x, y) + margem }
}

// ---------- a barra de fundição ----------

export interface BarraDeOuro {
  /** O meio (px da pegada) e o giro da barra. */
  readonly x: number
  readonly y: number
  readonly ang: number
  /** As meias medidas da base (px), ao comprido e de través. */
  readonly a: number
  readonly b: number
  readonly tom: number
  /** A marca de punção na face de cima: o sol no cartucho e os três riscos do ensaiador. */
  readonly marca: boolean
  /** A sombra que a barra faz nas peças de baixo (px; 0 = nenhuma). */
  readonly projeta: number
  readonly semente: number
}

/** A face de cima recua das pontas e dos lados estas frações da meia medida: é a rampa que diz "barra de fundição". */
const RECUO_DA_PONTA = 0.17
const RECUO_DO_LADO = 0.34
/** Os cantos amaciados, em fração da meia largura: a base e a face de cima. */
const CANTO_DA_BASE = 0.3
const CANTO_DO_TOPO = 0.22
/**
 * A luz de cada rampa é a de uma faceta inclinada `INCLINACAO_DA_RAMPA` debaixo da luz do motor (38° acima do
 * chão), relativa à da face de cima: a virada para a luz sai bem mais clara (puxa para o amarelo claro), a de
 * lado um pouco mais escura e a do outro lado quase na sombra (puxa para o marrom). Com a luz só somada as
 * rampas ficavam no tom da face de cima, e a barra lia como chapa.
 */
const INCLINACAO_DA_RAMPA = (40 * Math.PI) / 180
const LUZ_DO_MOTOR_DE_CIMA = 0.62
const LUZ_DO_MOTOR_DE_LADO = 0.79
const CLARO_MINIMO_DA_RAMPA = 0.3
const CLAREIA_A_RAMPA = 1.2
const ESCURECE_A_RAMPA = 0.85
const LUZ_DA_RAMPA = 0.14
/** O reflexo largo da face de cima e o grão de fundição. */
const REFLEXO_DO_TOPO = 0.1
const GRAO_DO_TOPO = 0.035
/** Os riscos de uso na face de cima: quantos, o comprimento (fração da meia face) e a largura e a luz do risco. */
const RISCOS = 6
const RISCO_MINIMO = 0.14
const RISCO_MAXIMO = 0.38
const LARGURA_DO_RISCO = 0.26
const LUZ_DO_RISCO = 0.09
/** O quanto um risco foge do comprido da barra (radianos, para cada lado): mais que isto, dois riscos vizinhos formavam um "<". */
const DESVIO_DO_RISCO = 0.42
/** O chanfro fino da face de cima: a quina do lado da luz acende no brilho do metal. */
const CHANFRO_DO_TOPO = 0.35
const METAL_DO_TOPO = 0.5
/** A sombra que a barra de cima faz nas de baixo. */
const FORCA_DA_PROJECAO = 0.34

/** A marca de punção: o cartucho redondo (meio e raio em frações da meia face), o sol dentro dele e os riscos. */
const MEIO_DO_CARTUCHO = -0.42
const RAIO_DO_CARTUCHO = 0.72
const MIOLO_DO_SOL = 0.3
const RAIOS_DO_SOL = 8
const RAIO_DE_DENTRO = 0.48
const RAIO_DE_FORA = 0.8
const GROSSURA_DO_RAIO = 0.075
/** Os três riscos do ensaiador: de onde a onde vão (frações da meia face), a meia altura e a grossura. */
const RISCOS_DO_ENSAIO: readonly number[] = [0.22, 0.34, 0.46]
const MEIA_ALTURA_DO_ENSAIO = 0.4
const GROSSURA_DO_ENSAIO = 0.095
/** O cartucho e os riscos são batidos: o fundo escuro e a beira clara do lado de lá da luz (fração do raio). */
const TOM_DO_FUNDO_DA_MARCA = 0.68
const TOM_DA_BEIRA_DA_MARCA = 1.28
const BEIRA_DA_MARCA = 0.1
const TOM_DO_SOL = 1.06

/** A rampa: a luz de cada ponto sai da direção em que a face de cima fica mais perto (a normal da rampa). */
function texDaRampa(cx: number, cy: number, ang: number, ha: number, hb: number, luz: Ponto): Textura {
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  return (_u, _v, x, y, _p, s) => {
    const dx = x - cx
    const dy = y - cy
    const u = dx * co + dy * si
    const v = -dx * si + dy * co
    const qx = Math.abs(u) - ha
    const qy = Math.abs(v) - hb
    let nu = 0
    let nv = 0
    if (qx > 0 && qy > 0) {
      // No canto a rampa vira: a normal gira em volta do canto da face de cima.
      const l = Math.sqrt(qx * qx + qy * qy)
      nu = (Math.sign(u) * qx) / l
      nv = (Math.sign(v) * qy) / l
    } else if (qx > qy) nu = Math.sign(u)
    else nv = Math.sign(v)
    const t = (nu * co - nv * si) * luz[0] + (nu * si + nv * co) * luz[1]
    const claro = Math.max(CLARO_MINIMO_DA_RAMPA, (Math.cos(INCLINACAO_DA_RAMPA) * LUZ_DO_MOTOR_DE_CIMA + Math.sin(INCLINACAO_DA_RAMPA) * LUZ_DO_MOTOR_DE_LADO * t) / LUZ_DO_MOTOR_DE_CIMA)
    if (claro >= 1) puxar(s, BRILHO_DO_OURO, Math.min(1, (claro - 1) * CLAREIA_A_RAMPA))
    else puxar(s, SOMBRA_DO_OURO, (1 - claro) * ESCURECE_A_RAMPA)
    s[3] += (claro - 1) * LUZ_DA_RAMPA
  }
}

/** Um risco de uso, no referencial da face (u ao comprido): o começo e o fim. */
type Risco = readonly [number, number, number, number]

/**
 * Os riscos de uma barra: curtos, quase ao comprido (a barra arrastada), sorteados pela semente. O começo de cada
 * um cai na sua faixa do comprido: sorteados soltos, dois nasciam no mesmo ponto e formavam um "<".
 */
function riscosDaBarra(ha: number, hb: number, semente: number): Risco[] {
  return Array.from({ length: RISCOS }, (_, i): Risco => {
    const u0 = (((i + 0.1 + 0.8 * hash(i, 1, semente)) / RISCOS) * 2 - 1) * ha * 0.8
    const v0 = (hash(i, 2, semente) * 2 - 1) * hb * 0.75
    const comp = (RISCO_MINIMO + (RISCO_MAXIMO - RISCO_MINIMO) * hash(i, 3, semente)) * ha
    const ang = (hash(i, 4, semente) * 2 - 1) * DESVIO_DO_RISCO + (i % 2) * Math.PI
    return [u0, v0, u0 + Math.cos(ang) * comp, v0 + Math.sin(ang) * comp]
  })
}

/** A face de cima: o reflexo largo (mais claro do lado da luz), o grão de fundição e os riscos de uso. */
function texDoTopo(cx: number, cy: number, ang: number, ha: number, hb: number, luz: Ponto, semente: number): Textura {
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  const riscos = riscosDaBarra(ha, hb, semente)
  const fase = hash(semente, 7, 991) * Math.PI
  return (_u, _v, x, y, p, s, escala) => {
    const dx = x - cx
    const dy = y - cy
    const u = dx * co + dy * si
    const v = -dx * si + dy * co
    const rumo = (dx * luz[0] + dy * luz[1]) / ha
    let l = REFLEXO_DO_TOPO * (0.6 * rumo + 0.4 * Math.cos((u / ha) * 2.4 + fase))
    l += ruido(x * 0.4 + p.su, y * 0.4 + p.sv) * GRAO_DO_TOPO
    if (escala >= ESCALA_DO_DETALHE) {
      for (const [u0, v0, u1, v1] of riscos) {
        const ru = u1 - u0
        const rv = v1 - v0
        const h = limitar01(((u - u0) * ru + (v - v0) * rv) / (ru * ru + rv * rv))
        const d = Math.hypot(u - u0 - ru * h, v - v0 - rv * h)
        if (d < LARGURA_DO_RISCO) l += LUZ_DO_RISCO * (1 - d / LARGURA_DO_RISCO)
      }
    }
    s[3] += l
  }
}

/** Uma marca batida (o cartucho, os riscos): a beira clara do lado de lá da luz e o fundo escuro por cima. */
function bater(P: CriarPeca, L: Cena['partes'], forma: Forma, b: BarraDeOuro, luz: Ponto, beira: number, semente: number): void {
  L.push(P(forma, OURO, { dx: -luz[0] * beira, dy: -luz[1] * beira, bisel: 0, contorno: 0, metal: 0, tom: b.tom * TOM_DA_BEIRA_DA_MARCA, semente }))
  L.push(P(forma, OURO, { bisel: 0, contorno: 0, metal: 0, tom: b.tom * TOM_DO_FUNDO_DA_MARCA, semente: semente + 1 }))
}

/** A marca de punção na face de cima: o cartucho redondo com o sol em relevo e os três riscos do ensaiador. */
function marcaDaBarra(P: CriarPeca, L: Cena['partes'], b: BarraDeOuro, ha: number, hb: number, luz: Ponto): void {
  const co = Math.cos(b.ang)
  const si = Math.sin(b.ang)
  const naFace = (u: number, v: number): Ponto => [b.x + u * co - v * si, b.y + u * si + v * co]
  const R = hb * RAIO_DO_CARTUCHO
  const [mx, my] = naFace(ha * MEIO_DO_CARTUCHO, 0)
  bater(P, L, circulo(mx, my, R), b, luz, R * BEIRA_DA_MARCA, b.semente + 20)
  let sol: Forma = circulo(mx, my, R * MIOLO_DO_SOL)
  for (let i = 0; i < RAIOS_DO_SOL; i += 1) {
    const a = (i / RAIOS_DO_SOL) * Math.PI * 2 + b.ang
    sol = uniao(sol, capsula(mx + Math.cos(a) * R * RAIO_DE_DENTRO, my + Math.sin(a) * R * RAIO_DE_DENTRO, mx + Math.cos(a) * R * RAIO_DE_FORA, my + Math.sin(a) * R * RAIO_DE_FORA, R * GROSSURA_DO_RAIO))
  }
  L.push(P(sol, OURO, { bisel: R * 0.12, contorno: 0.1, metal: 0.35, tom: b.tom * TOM_DO_SOL, semente: b.semente + 22 }))
  RISCOS_DO_ENSAIO.forEach((f, i) => {
    const [x0, y0] = naFace(ha * f, -hb * MEIA_ALTURA_DO_ENSAIO)
    const [x1, y1] = naFace(ha * f, hb * MEIA_ALTURA_DO_ENSAIO)
    bater(P, L, capsula(x0, y0, x1, y1, hb * GROSSURA_DO_ENSAIO), b, luz, hb * GROSSURA_DO_ENSAIO * 0.6, b.semente + 24 + i * 2)
  })
}

/** A base da barra (o contorno das rampas): é também a forma da sombra dela. */
export function baseDaBarra(b: BarraDeOuro): Forma {
  return caixaGirada(b.x, b.y, b.a, b.b, b.ang, b.b * CANTO_DA_BASE)
}

/**
 * Uma barra de fundição deitada: a base com as quatro rampas (uma peça só, a luz de cada ponto pela rampa em
 * que ele está), a face de cima menor, com o reflexo, o grão e os riscos, e, se tiver, a marca de punção.
 */
export function pintarBarraDeOuro(P: CriarPeca, cena: Cena, b: BarraDeOuro, luz: Ponto): void {
  const L = cena.partes
  const ha = b.a * (1 - RECUO_DA_PONTA)
  const hb = b.b * (1 - RECUO_DO_LADO)
  const canto = b.b * CANTO_DO_TOPO
  const projeta = b.projeta > 0 ? { dist: b.projeta, forca: FORCA_DA_PROJECAO } : undefined
  L.push(P(baseDaBarra(b), OURO, { bisel: 0, contorno: 0.3, metal: 0, tom: b.tom, textura: texDaRampa(b.x, b.y, b.ang, ha - canto, hb - canto, luz), projeta, semente: b.semente }))
  L.push(P(caixaGirada(b.x, b.y, ha, hb, b.ang, canto), OURO, { bisel: CHANFRO_DO_TOPO, contorno: 0, metal: METAL_DO_TOPO, tom: b.tom, textura: texDoTopo(b.x, b.y, b.ang, ha, hb, luz, b.semente), semente: b.semente + 1 }))
  if (b.marca) marcaDaBarra(P, L, b, ha, hb, luz)
}

// ---------- a moeda cunhada ----------

/** Quanto desenho a moeda leva: a única (com a coroa em relevo), a da beira do monte (inteira) e a do miolo (lisa). */
export type DetalheDaMoeda = 'unica' | 'beira' | 'miolo'

export interface MoedaDeOuro {
  readonly x: number
  readonly y: number
  readonly r: number
  /** 1 = deitada reta; menos = inclinada no monte (a elipse que se vê de cima). */
  readonly achatado: number
  /** A direção do eixo achatado (radianos). */
  readonly ang: number
  readonly tom: number
  readonly detalhe: DetalheDaMoeda
  /** A sombra que a moeda faz nas peças de baixo (px; 0 = nenhuma). */
  readonly projeta: number
  readonly semente: number
}

/** Da beira para dentro, em fração do raio: a borda alta em cordão, o sulco do aro de dentro e o campo. */
const BORDA_DA_MOEDA = 0.8
const SULCO_DA_MOEDA = 0.71
const LUZ_DA_BORDA = 0.07
const FUNDO_DO_SULCO = 0.16
/** As contas do cordão: uma a cada tanto de px na beira, e quanto cada uma clareia. */
const PASSO_DAS_CONTAS = 1.05
const LUZ_DAS_CONTAS = 0.09
/** O cordão só aparece com a moeda grande na imagem (px de raio): miúdo, vira chuvisco. */
const RAIO_MINIMO_DAS_CONTAS = 9
/** O campo: o reflexo largo atravessado e o relevo do meio das moedas do monte (raio em fração do raio e luz). */
const REFLEXO_DO_CAMPO = 0.11
const RELEVO_DO_MONTE = 0.4
const LUZ_DO_RELEVO = 0.16
/** O chanfro da beira (fração do raio, até um teto em px): é ele que faz a meia-lua de luz e a de sombra. */
const CHANFRO_DA_MOEDA = 0.3
const CHANFRO_MAXIMO = 1.7
const METAL_DA_MOEDA = 0.5

/** A moeda: a borda em cordão, o sulco do aro de dentro, o campo com o reflexo e, no monte, o relevo do meio. */
function texDaMoeda(m: MoedaDeOuro, luz: Ponto): Textura {
  const co = Math.cos(m.ang)
  const si = Math.sin(m.ang)
  const contas = Math.max(12, Math.round((2 * Math.PI * m.r) / PASSO_DAS_CONTAS))
  const fase = hash(m.semente, 3, 517) * Math.PI
  return (_u, _v, x, y, _p, s, escala) => {
    const dx = x - m.x
    const dy = y - m.y
    // No referencial da moeda deitada: desfaz a inclinação (o achatado ao longo do eixo `ang`).
    const pu = dx * co + dy * si
    const pv = (-dx * si + dy * co) / m.achatado
    const rho = Math.sqrt(pu * pu + pv * pv) / m.r
    let l = 0
    if (rho > BORDA_DA_MOEDA) {
      l += LUZ_DA_BORDA
      if (m.r * escala >= RAIO_MINIMO_DAS_CONTAS) l += Math.cos(Math.atan2(pv, pu) * contas) > 0.1 ? LUZ_DAS_CONTAS : -LUZ_DAS_CONTAS * 0.6
    } else if (rho > SULCO_DA_MOEDA) {
      l -= FUNDO_DO_SULCO * Math.sin(((rho - SULCO_DA_MOEDA) / (BORDA_DA_MOEDA - SULCO_DA_MOEDA)) * Math.PI)
    } else {
      const rumo = (dx * luz[0] + dy * luz[1]) / m.r
      l += REFLEXO_DO_CAMPO * Math.cos(rumo * 2.2 + fase)
      // O relevo do meio (as moedas do monte, sem a coroa de peça): a bossa clara do lado da luz.
      if (m.detalhe !== 'unica' && rho < RELEVO_DO_MONTE) l += LUZ_DO_RELEVO * rumo * (1 - rho / RELEVO_DO_MONTE) * 2
    }
    s[3] += l
  }
}

/** A coroa da moeda única, em relevo: a faixa, as três pontas e uma pérola em cada ponta (s = meia largura). */
function formaDaCoroa(cx: number, cy: number, s: number): Forma {
  const corpo = poligono([
    [cx - s, cy + s * 0.55],
    [cx - s, cy - s * 0.4],
    [cx - s * 0.48, cy + s * 0.02],
    [cx, cy - s * 0.62],
    [cx + s * 0.48, cy + s * 0.02],
    [cx + s, cy - s * 0.4],
    [cx + s, cy + s * 0.55],
  ])
  const perola = s * 0.17
  return [circulo(cx - s, cy - s * 0.48, perola), circulo(cx, cy - s * 0.7, perola), circulo(cx + s, cy - s * 0.48, perola)].reduce(uniao, corpo)
}

/** A coroa: meia largura em fração do raio e o quanto ela desce do meio (o centro óptico fica um pouco acima). */
const COROA = 0.42
const COROA_DESCE = 0.06
const TOM_DA_COROA = 1.05
const CHANFRO_DA_COROA = 0.05
/** A sombrinha da coroa no campo: quanto ela anda para o lado de lá da luz (fração do raio), o tom e a força. */
const PASSO_DA_SOMBRA_DA_COROA = 0.05
const TOM_DA_SOMBRA_DA_COROA = 0.62
const ALFA_DA_SOMBRA_DA_COROA = 0.7
/** A meia-lua clara do lado da luz e a escura do outro: o recuo da beira e o quanto a forma de corte anda (frações do raio) e a força. */
const RECUO_DA_MEIA_LUA = 0.03
const MEIA_LUA = 0.16
const ALFA_DA_MEIA_LUA = 0.68
const ALFA_DA_SOMBRA_DA_LUA = 0.4

/** A forma da moeda vista de cima: o círculo, ou a elipse da moeda inclinada. */
export function formaDaMoeda(m: MoedaDeOuro): Forma {
  return m.achatado >= 0.995 ? circulo(m.x, m.y, m.r) : elipseGirada(m.x, m.y, m.r, m.r * m.achatado, m.ang)
}

/** Uma moeda: o disco com chanfro (a meia-lua de luz e a de sombra do motor) e o cunho na textura; a única leva ainda a coroa e a meia-lua pintada. */
export function pintarMoedaDeOuro(P: CriarPeca, cena: Cena, m: MoedaDeOuro, luz: Ponto): void {
  const L = cena.partes
  const projeta = m.projeta > 0 ? { dist: m.projeta, forca: FORCA_DA_PROJECAO, suave: 0.7 } : undefined
  const bisel = Math.min(m.r * CHANFRO_DA_MOEDA * m.achatado, CHANFRO_MAXIMO)
  const contorno = m.detalhe === 'miolo' ? 0.16 : 0.24
  L.push(P(formaDaMoeda(m), OURO, { bisel, contorno, metal: METAL_DA_MOEDA, tom: m.tom, textura: texDaMoeda(m, luz), projeta, semente: m.semente }))
  if (m.detalhe !== 'unica') return
  // A coroa em relevo, do tamanho do lado curto (a moeda esticada fica oval), com a sombrinha dela no campo.
  const curto = m.r * m.achatado
  const coroa = formaDaCoroa(m.x, m.y + curto * COROA_DESCE, curto * COROA)
  const passo = curto * PASSO_DA_SOMBRA_DA_COROA
  L.push(P(coroa, OURO, { dx: -luz[0] * passo, dy: -luz[1] * passo, bisel: 0, contorno: 0, metal: 0, tom: m.tom * TOM_DA_SOMBRA_DA_COROA, alfa: ALFA_DA_SOMBRA_DA_COROA, semente: m.semente + 1 }))
  L.push(P(coroa, OURO, { bisel: curto * CHANFRO_DA_COROA, contorno: 0.12, metal: 0.4, tom: m.tom * TOM_DA_COROA, semente: m.semente + 2 }))
  // A meia-lua: a beira do lado da luz clareia, a do outro lado escurece (a forma da moeda menos ela deslocada).
  const corte = curto * MEIA_LUA
  const disco = encolhida(formaDaMoeda(m), curto * RECUO_DA_MEIA_LUA)
  L.push(P(menos(disco, deslocada(disco, -luz[0] * corte, -luz[1] * corte)), { classe: 'liso', rgb: BRILHO_DO_OURO }, { bisel: 0, contorno: 0, alfa: ALFA_DA_MEIA_LUA, suave: 0.5, semente: m.semente + 3 }))
  L.push(P(menos(disco, deslocada(disco, luz[0] * corte, luz[1] * corte)), { classe: 'liso', rgb: SOMBRA_DO_OURO }, { bisel: 0, contorno: 0, alfa: ALFA_DA_SOMBRA_DA_LUA, suave: 0.5, semente: m.semente + 4 }))
}

// ---------- a pepita, o minério e o brilho ----------

/** A pepita: um caroço de 2 ou 3 bolotas, de beira ondulada e superfície encaroçada (`ruga`), que pega a luz em pontos. Devolve a forma (a sombra da solta). */
export function pintarPepita(P: CriarPeca, cena: Cena, x: number, y: number, r: number, tom: number, semente: number): Forma {
  const a = hash(semente, 1, 313) * Math.PI * 2
  let forma: Forma = elipseGirada(x, y, r, r * (0.65 + 0.25 * hash(semente, 2, 313)), a)
  const bolotas = 1 + Math.round(hash(semente, 3, 313))
  for (let i = 0; i < bolotas; i += 1) {
    const b = a + (i === 0 ? 1.9 : -2.2) + hash(semente, 4 + i, 313)
    forma = uniao(forma, circulo(x + Math.cos(b) * r * 0.62, y + Math.sin(b) * r * 0.62, r * (0.42 + 0.2 * hash(semente, 6 + i, 313))))
  }
  const pepita = ondular(forma, r * 0.12, 0.9, semente * 0.37)
  cena.partes.push(P(pepita, OURO, { bisel: r * 0.55, contorno: 0.22, metal: 0.55, ruga: 2.6, tom, semente }))
  return pepita
}

/** O minério: as quinas da rocha (quantas e o raio de cada uma, frações do raio) e a aspereza da beira. */
const QUINAS_DO_MINERIO = 8
const QUINA_MINIMA = 0.7
const QUINA_A_MAIS = 0.36
const ASPEREZA_DO_MINERIO = 0.07
/** O veio de ouro atravessado, o galho dele e as pintas (grossuras e raios em frações do raio da rocha). */
const VEIO = 0.12
const GALHO_DO_VEIO = 0.085
const PINTAS_DO_MINERIO = 5
const PINTA_MINIMA = 0.09
const PINTA_A_MAIS = 0.08
/** A sombra que o pedaço faz nas peças de baixo (px). */
const PROJECAO_DO_MINERIO = 1.2

/**
 * O pedaço de minério: a rocha de quinas tortas e beira áspera, e o veio e as pintas de ouro nela. Vai por
 * cima das peças da camada (por baixo delas sumia) e faz sombra nelas, como uma barra.
 */
export function pintarMinerio(P: CriarPeca, cena: Cena, x: number, y: number, r: number, semente: number): void {
  const pontos: Ponto[] = Array.from({ length: QUINAS_DO_MINERIO }, (_, i) => {
    const a = (i / QUINAS_DO_MINERIO) * Math.PI * 2 + hash(semente, i, 419) * 0.5
    const raio = r * (QUINA_MINIMA + QUINA_A_MAIS * hash(semente, i + 9, 419))
    return [x + Math.cos(a) * raio, y + Math.sin(a) * raio * 0.85]
  })
  const rocha = ondular(poligono(pontos), r * ASPEREZA_DO_MINERIO, 1.4, semente * 0.29)
  const tom = 0.95 + 0.12 * hash(semente, 30, 419)
  cena.partes.push(P(rocha, ROCHA, { bisel: r * 0.34, contorno: 0.3, tom, projeta: { dist: PROJECAO_DO_MINERIO, forca: FORCA_DA_PROJECAO }, semente }))
  // O veio atravessado, um galho dele e as pintas: o ouro que dá o nome ao pedaço.
  const a = hash(semente, 31, 419) * Math.PI
  const [ca, sa] = [Math.cos(a), Math.sin(a)]
  let ouro: Forma = capsula(x - ca * r * 0.85, y - sa * r * 0.7, x + ca * r * 0.7, y + sa * r * 0.75, r * VEIO)
  ouro = uniao(ouro, capsula(x + ca * r * 0.1, y + sa * r * 0.1, x + Math.cos(a + 1.1) * r * 0.7, y + Math.sin(a + 1.1) * r * 0.6, r * GALHO_DO_VEIO))
  for (let i = 0; i < PINTAS_DO_MINERIO; i += 1) {
    const b = hash(semente, 40 + i, 419) * Math.PI * 2
    const d = r * (0.3 + 0.4 * hash(semente, 50 + i, 419))
    ouro = uniao(ouro, circulo(x + Math.cos(b) * d, y + Math.sin(b) * d, r * (PINTA_MINIMA + PINTA_A_MAIS * hash(semente, 60 + i, 419))))
  }
  const dentro: Forma = { b: ouro.b, d: (px, py) => Math.max(ouro.d(px, py), rocha.d(px, py) + r * 0.1) }
  cena.partes.push(P(dentro, OURO, { bisel: r * 0.06, contorno: 0.14, metal: 0.6, tom: 1.1, semente: semente + 1 }))
}

/** O brilho em estrela: a cintura entre as pontas e a ponta de pé (frações do raio), o halo e as forças. */
const CINTURA_DO_BRILHO = 0.13
const PONTA_DE_PE_DO_BRILHO = 0.8
const HALO_DO_BRILHO = 0.42
const ALFA_DO_HALO = 0.3
const ALFA_DO_BRILHO = 0.88

/**
 * O brilho em estrela de quatro pontas (o reflexo que salta de uma peça), pintado: não ilumina nada. As pontas
 * afinam até sumir, em volta de um halo fraco: com o fio de grossura igual, a estrela virava uma mira.
 */
export function pintarBrilho(P: CriarPeca, cena: Cena, x: number, y: number, r: number, semente: number): void {
  const k = r * CINTURA_DO_BRILHO
  const pe = r * PONTA_DE_PE_DO_BRILHO
  const estrela = poligono([
    [x + r, y],
    [x + k, y + k],
    [x, y + pe],
    [x - k, y + k],
    [x - r, y],
    [x - k, y - k],
    [x, y - pe],
    [x + k, y - k],
  ])
  cena.partes.push(P(circulo(x, y, r * HALO_DO_BRILHO), ESTRELA, { bisel: 0, contorno: 0, alfa: ALFA_DO_HALO, suave: r * HALO_DO_BRILHO, semente }))
  cena.partes.push(P(estrela, ESTRELA, { bisel: 0, contorno: 0, alfa: ALFA_DO_BRILHO, suave: 0.35, semente: semente + 1 }))
}

// ---------- o monte: as camadas, a massa e as alturas da 3/4 ----------

/** Um lóbulo do contorno do monte: o meio e os raios, em frações da meia pegada. */
export type Lobulo = readonly [number, number, number, number]

/** A escala do ruído que ondula o contorno do monte (por px): ondas largas, de coisa derramada, e não serrilha. */
const ESCALA_DA_ONDA = 0.16

/** O contorno de lóbulos ondulado (a poça de coisa derramada), encolhido `fator` em volta do pico (frações da meia pegada). */
export function contornoDoMonte(lobulos: readonly Lobulo[], hw: number, hh: number, pico: Ponto, fator: number, onda: number, semente: number): Forma {
  const [px, py] = pico
  const uniaoDosLobulos = lobulos
    .map(([fx, fy, rx, ry]) => elipse((px + (fx - px) * fator) * hw, (py + (fy - py) * fator) * hh, rx * fator * hw, ry * fator * hh))
    .reduce(uniao)
  return ondular(uniaoDosLobulos, onda, ESCALA_DA_ONDA, semente)
}

/** O flanco: a faixa entre duas quinas de ouro (px, no alto da tela), a quina mais clara e o escuro do lado do monte. */
const PASSO_DAS_QUINAS = 1.25
const LUZ_DA_QUINA = 0.32
const ESCURO_DO_FLANCO = 0.55
const LUZ_DO_FLANCO = -0.1
/** A massa: as manchas largas e as pintas de ouro enterrado que pegam a luz (miúdas e muitas: é o que tira a cara de lama). */
const MANCHA_DA_MASSA = 0.1
const PINTA_DA_MASSA = 0.3
const ESCALA_DAS_PINTAS = 1.1
const LIMIAR_DAS_PINTAS = 0.12

/**
 * A MASSA de uma camada do monte, que enche o vão entre as peças: o ouro de baixo, escuro, com pintas que pegam a
 * luz. Debaixo da camada de cima (`acima`) ela é o FLANCO que a 3/4 mostra quando a camada de cima sobe: mais
 * escura, riscada de quinas de ouro deitadas NA TELA (`verticalNaTela`: a direção que desce na tela, desgirada
 * pelo `giro`). De cima o flanco fica coberto pela camada de cima.
 */
export function texDaMassa(acima: Forma | null, verticalNaTela: Ponto): Textura {
  return (_u, _v, x, y, p, s) => {
    let l = ruido(x * 0.2 + p.su, y * 0.2 + p.sv) * MANCHA_DA_MASSA
    if (ruido(x * ESCALA_DAS_PINTAS + p.sv, y * ESCALA_DAS_PINTAS + p.su) > LIMIAR_DAS_PINTAS) l += PINTA_DA_MASSA
    const fundo = acima === null ? 0 : suave01(-acima.d(x, y) / 1.2)
    if (fundo > 0) {
      const alto = x * verticalNaTela[0] + y * verticalNaTela[1]
      const ao = x * verticalNaTela[1] - y * verticalNaTela[0]
      const quina = Math.sin((alto / PASSO_DAS_QUINAS) * Math.PI * 2 + ruido(ao * 0.35 + p.su, alto * 0.2) * 5) > 0.55 ? LUZ_DA_QUINA : 0
      puxar(s, SOMBRA_DO_OURO, fundo * ESCURO_DO_FLANCO)
      l += fundo * (LUZ_DO_FLANCO + quina)
    }
    s[3] += l
  }
}

/** As três camadas do monte: o contorno de tudo (no chão), o anel do meio e o miolo. */
export interface CamadasDoMonte {
  readonly tudo: Forma
  readonly meio: Forma
  readonly miolo: Forma
}

/**
 * As alturas da 3/4: o anel do meio e o miolo viram estruturas soltas e sem sombra (de cima não pintam nada).
 * A caixa das duas é a do monte inteiro: a 3/4 pinta as estruturas pela beira de baixo da caixa e, no empate,
 * a mais baixa antes; assim o miolo sai por cima do anel em QUALQUER giro. (Com só o fundo da caixa descido, o
 * monte girado um quarto de volta tinha o fundo de lado, o anel saía por cima do miolo e o flanco riscado
 * aparecia no meio do monte.) A estrutura de cada peça sai da forma, não da caixa: a caixa maior não muda nada.
 */
export function declararAlturas(cena: Cena, camadas: CamadasDoMonte, alturaDoMeio: number, alturaDoMiolo: number): void {
  const caixa = camadas.tudo.b
  cena.sombras.push({ forma: { b: caixa, d: camadas.meio.d }, z: alturaDoMeio, solta: true, forca: 0 }, { forma: { b: caixa, d: camadas.miolo.d }, z: alturaDoMiolo, solta: true, forca: 0 })
}

/**
 * Um ponto dentro de `dentro` e fora de `fora` (com folga), perto de (cx, cy): o meio da caixa da massa de cada
 * camada, para a 3/4 subir a massa com a camada dela. Anda do meio para fora nas quatro direções.
 */
export function meioDaCamada(dentro: Forma, fora: Forma | null, cx: number, cy: number, folga: number): Ponto {
  const passos = 40
  const alcance = Math.max(dentro.b[2] - dentro.b[0], dentro.b[3] - dentro.b[1])
  for (let i = 0; i <= passos; i += 1) {
    const d = (alcance * i) / passos
    for (const [ux, uy] of [[0, -1], [-1, 0], [1, 0], [0, 1]] as const) {
      const x = cx + ux * d
      const y = cy + uy * d
      if (dentro.d(x, y) < -folga && (fora === null || fora.d(x, y) > folga)) return [x, y]
    }
  }
  return [cx, cy]
}

/** Os pontos de uma grade de favo sacudida dentro de `regiao`: o lugar de cada peça de uma camada. */
export function espalhar(regiao: Forma, passo: number, sacode: number, semente: number): Ponto[] {
  const pontos: Ponto[] = []
  const [x0, y0, x1, y1] = regiao.b
  const passoY = passo * 0.87
  for (let j = 0, y = y0; y <= y1; j += 1, y += passoY) {
    for (let i = 0, x = x0 + (j % 2) * passo * 0.5; x <= x1; i += 1, x += passo) {
      const px = x + (hash(i, j, semente) - 0.5) * 2 * sacode
      const py = y + (hash(i, j, semente + 1) - 0.5) * 2 * sacode
      if (regiao.d(px, py) < 0) pontos.push([px, py])
    }
  }
  return pontos
}
