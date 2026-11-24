import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Blocos de cantaria (lote L07 "Selva: ruína e água", 24/11/2026; versão original das Pedras, só a ideia): três
 * blocos de pedra CORTADA que caíram de uma ruína e ficaram meio enterrados, mais uma lasca. O que os separa das
 * Pedras da serra (lascadas, redondas) é a quina reta: cada bloco é um prisma de faces planas, com o alto inclinado
 * (um canto afundou mais que o outro, bem mais no bloco grande), a faixa lisa da cantaria em volta do alto (a borda
 * que o canteiro aparelhou), o miolo áspero bem mais escuro e pontilhado de poros, uma quina quebrada grande e a terra
 * escura que subiu no pé. O musgo é uma mancha só, no alto do bloco grande. O giro gira o arranjo e cada bloco; a luz
 * não gira (a face virada para a esquerda clara, a da direita escura). A semente troca o tamanho, a inclinação e a
 * pedra (arenito das ruínas ou o cinzento da serra). Com faixa e miolo quase iguais, faces limpas e a terra fraca, os
 * blocos liam como caixas de papelão na grama.
 */

interface Tons {
  /** A faixa aparelhada do alto (a mais clara). */
  readonly faixa: Rgb
  /** O miolo áspero do alto e os poros dele. */
  readonly miolo: Rgb
  readonly poro: Rgb
  /** A face virada para a luz (para a esquerda) e a de costas para ela. */
  readonly clara: Rgb
  readonly escura: Rgb
}

/** O arenito das ruínas e o cinzento da serra, os dois contidos. */
const ARENITO: Tons = { faixa: [206, 190, 158], miolo: [170, 150, 118], poro: [132, 114, 88], clara: [158, 140, 110], escura: [116, 102, 80] }
const CINZENTO: Tons = { faixa: [190, 186, 174], miolo: [154, 149, 137], poro: [118, 113, 103], clara: [140, 135, 124], escura: [102, 98, 90] }
/** A terra escura que subiu no pé (meio enterrado) e o musgo verde-escuro. */
const TERRA: Rgb = [70, 60, 46]
const MUSGO: Rgb = [96, 110, 72]

/** O chão visto de cima e um pouco de frente (o das pedras). */
const ACHATA = 0.55
/** Quanto a faixa aparelhada come do alto (o miolo é o alto encolhido em volta do meio). */
const MIOLO = 0.7
/** Quanto a terra passa do pé do bloco e o quanto ela cobre. */
const TERRA_EM_VOLTA = 1.28
const FORCA_DA_TERRA = 0.72
/**
 * A quina quebrada: quanto ela come de cada aresta do alto (fração da aresta), quanto desce pela quina (fração da
 * altura) e o tom da face da quebra (entre a face clara e a escura). O alto perde a ponta: onde a face da quebra fica de
 * costas, o recorte mostra o chão.
 */
const QUINA = { come: 0.4, desce: 0.46, tom: 0.45 } as const
/** Os poros do miolo: quantos por bloco grande, o lado de cada um (unidades) e o quanto eles fogem da quina quebrada. */
const POROS = 16
const LADO_DO_PORO = 0.011
const LONGE_DA_QUINA = 0.42
/**
 * A mancha de musgo do bloco grande: uma forma só, desenhada no próprio alto (em frações dele, então nunca vaza para
 * fora da pedra): o meio, o raio de partida e o quanto ele varia, em lóbulos.
 */
const MANCHA_DE_MUSGO = { meio: 0.12, raio: 0.27, varia: 0.08, lobulos: 3, pontos: 12 } as const
const FORCA_DO_MUSGO = 0.52

type P = readonly [number, number]

/** Sorteio fixo de 0 a 1 por semente e índice: o mesmo desenho em toda tela. */
function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

function misturar(a: Rgb, b: Rgb, t: number): Rgb {
  return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)]
}

function preencher(g: CanvasRenderingContext2D, pontos: readonly P[], cor: string): void {
  g.fillStyle = cor
  g.beginPath()
  pontos.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)))
  g.closePath()
  g.fill()
}

/** O ponto (s, t) do quadrilátero (cantos em volta), pela mistura bilinear. */
function noQuadrilatero(q: readonly P[], s: number, t: number): P {
  const [a, b, c, d] = q
  const x = (1 - t) * ((1 - s) * a[0] + s * b[0]) + t * ((1 - s) * d[0] + s * c[0])
  const y = (1 - t) * ((1 - s) * a[1] + s * b[1]) + t * ((1 - s) * d[1] + s * c[1])
  return [x, y]
}

/** Um bloco: meio na base (no chão), meio comprimento e meia largura, giro no chão e a altura de cada canto. */
interface Bloco {
  readonly x: number
  readonly y: number
  readonly a: number
  readonly b: number
  readonly giro: number
  readonly alturas: readonly [number, number, number, number]
  readonly tons: Tons
  /** O canto quebrado (0 a 3), se o alto tem musgo, quantos poros e a semente deles. */
  readonly quebrado: number
  readonly musgo: boolean
  readonly poros: number
  readonly semente: number
}

/** O ponto a uma fração `t` de `a` até `b`. */
function entre(a: P, b: P, t: number): P {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}

/** O giro do triângulo na tela (o sinal diz o sentido: igual ao do alto, a face olha para quem vê). */
function sentido(a: P, b: P, c: P): number {
  return Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]))
}

/** O canto do alto, nas frações do quadrilátero (`noQuadrilatero`). */
const CANTOS: readonly P[] = [[0, 0], [1, 0], [1, 1], [0, 1]]

function desenharBloco(g: CanvasRenderingContext2D, k: Bloco): void {
  const c = Math.cos(k.giro)
  const s = Math.sin(k.giro)
  const noChao: P[] = ([[-k.a, -k.b], [k.a, -k.b], [k.a, k.b], [-k.a, k.b]] as const).map(([u, v]): P => [k.x + u * c - v * s, k.y + u * s + v * c])
  const pe = noChao.map(([x, y]): P => [x, y * ACHATA])
  const alto = pe.map(([x, y], i): P => [x, y - k.alturas[i]])
  const [mx, my] = [k.x, k.y * ACHATA]
  // A quina quebrada: o canto do alto perde a ponta (de `pa` a `pb`) e a quebra desce pela quina até `qd`.
  const qi = k.quebrado
  const pa = entre(alto[qi], alto[(qi + 3) % 4], QUINA.come)
  const pb = entre(alto[qi], alto[(qi + 1) % 4], QUINA.come)
  const qd: P = [alto[qi][0], alto[qi][1] + k.alturas[qi] * QUINA.desce]
  // A terra escura que subiu no pé: o contorno do pé bem maior, por baixo de tudo.
  preencher(g, pe.map(([x, y]): P => [mx + (x - mx) * TERRA_EM_VOLTA, my + (y - my) * TERRA_EM_VOLTA + 0.012]), css(TERRA, FORCA_DA_TERRA))
  // As faces que olham para quem vê (a normal no chão aponta para baixo na tela): a da esquerda clara, a da direita
  // escura. A que encosta na quina quebrada perde a ponta de cima.
  for (let i = 0; i < 4; i += 1) {
    const j = (i + 1) % 4
    const [ax, ay] = noChao[i]
    const [bx, by] = noChao[j]
    let nx = by - ay
    let ny = -(bx - ax)
    if (nx * ((ax + bx) / 2 - k.x) + ny * ((ay + by) / 2 - k.y) < 0) {
      nx = -nx
      ny = -ny
    }
    const l = Math.hypot(nx, ny) || 1
    if (ny / l <= 0.05) continue
    const face: P[] = j === qi ? [pe[i], pe[j], qd, pa, alto[i]] : i === qi ? [pe[i], pe[j], alto[j], pb, qd] : [pe[i], pe[j], alto[j], alto[i]]
    preencher(g, face, css(misturar(k.tons.clara, k.tons.escura, (nx / l + 1) / 2)))
  }
  // O alto sem a ponta: a faixa aparelhada (clara) e o miolo áspero, bem mais escuro, encolhido em volta do meio.
  const topo: P[] = alto.flatMap((p, i): P[] => (i === qi ? [pa, pb] : [p]))
  const [ax, ay] = [alto.reduce((t, p) => t + p[0], 0) / 4, alto.reduce((t, p) => t + p[1], 0) / 4]
  const encolher = ([x, y]: P): P => [ax + (x - ax) * MIOLO, ay + (y - ay) * MIOLO]
  preencher(g, topo, css(k.tons.faixa))
  preencher(g, topo.map(encolher), css(k.tons.miolo))
  // Os poros do miolo, longe da quina quebrada.
  const miolo = alto.map(encolher)
  const [cs, ct] = CANTOS[qi]
  g.fillStyle = css(k.tons.poro)
  for (let i = 0; i < k.poros; i += 1) {
    const [ps, pt] = [0.1 + 0.8 * sorteio(k.semente, 100 + i), 0.1 + 0.8 * sorteio(k.semente, 200 + i)]
    if (Math.hypot(ps - cs, pt - ct) < LONGE_DA_QUINA) continue
    const [px, py] = noQuadrilatero(miolo, ps, pt)
    const lado = LADO_DO_PORO * (0.7 + 0.6 * sorteio(k.semente, 300 + i))
    g.fillRect(px - lado / 2, py - lado / 2, lado, lado)
  }
  // A face da quebra, só quando olha para quem vê (no mesmo sentido do alto); de costas, fica o recorte no chão.
  if (sentido(pb, pa, qd) === sentido(alto[0], alto[1], alto[2])) preencher(g, [pb, pa, qd], css(misturar(k.tons.clara, k.tons.escura, QUINA.tom)))
  if (k.musgo) {
    // O musgo contido: uma mancha só, de beira em lóbulos, desenhada nas frações do próprio alto (não vaza da pedra)
    // e puxada para longe da quina quebrada.
    const [ms, mt] = [0.5 + (0.5 - cs) * MANCHA_DE_MUSGO.meio * 2, 0.5 + (0.5 - ct) * MANCHA_DE_MUSGO.meio * 2]
    const fase = sorteio(k.semente, 400) * Math.PI * 2
    const mancha: P[] = []
    for (let i = 0; i < MANCHA_DE_MUSGO.pontos; i += 1) {
      const a = (i / MANCHA_DE_MUSGO.pontos) * Math.PI * 2
      const r = MANCHA_DE_MUSGO.raio + MANCHA_DE_MUSGO.varia * Math.sin(a * MANCHA_DE_MUSGO.lobulos + fase)
      mancha.push(noQuadrilatero(alto, ms + Math.cos(a) * r, mt + Math.sin(a) * r))
    }
    preencher(g, mancha, css(MUSGO, FORCA_DO_MUSGO))
  }
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const tons = sorteio(semente, 1) < 0.7 ? ARENITO : CINZENTO
  // O arranjo no chão (unidades): o bloco grande deitado e bem inclinado (afundou), o médio torto e meio enterrado,
  // o pequeno e a lasca.
  const molde: readonly (readonly [number, number, number, number, number, number, number])[] = [
    // [x, y, meio comprido, meia largura, giro próprio, altura, inclinação]
    [-0.16, -0.02, 0.2, 0.15, 0.25, 0.26, 0.62],
    [0.24, 0.07, 0.15, 0.11, -0.55, 0.15, 0.55],
    [0.02, 0.17, 0.1, 0.08, 0.9, 0.11, 0.3],
    [0.33, -0.1, 0.05, 0.04, 0.4, 0.05, 0.2],
  ]
  const c = Math.cos(giro)
  const s = Math.sin(giro)
  const blocos: Bloco[] = molde.map(([dx, dy, a, b, proprio, h, inclina], i) => {
    const tamanho = 0.88 + 0.24 * sorteio(semente, 10 + i)
    const altura = h * (0.85 + 0.3 * sorteio(semente, 20 + i))
    // O alto inclinado: os cantos de um lado afundam mais (o bloco caiu torto).
    const lado = Math.floor(sorteio(semente, 30 + i) * 4)
    const afunda = (k: number): number => altura * (1 - (k === lado || k === (lado + 1) % 4 ? inclina * (0.6 + 0.4 * sorteio(semente, 40 + i)) : 0))
    const alturas: readonly [number, number, number, number] = [afunda(0), afunda(1), afunda(2), afunda(3)]
    return {
      x: dx * c - dy * s,
      y: dx * s + dy * c,
      a: a * tamanho,
      b: b * tamanho,
      giro: giro + proprio + (sorteio(semente, 50 + i) - 0.5) * 0.5,
      alturas,
      tons,
      quebrado: Math.floor(sorteio(semente, 60 + i) * 4),
      musgo: i === 0,
      poros: Math.round(POROS * (a / molde[0][2])),
      semente: semente * 7 + i,
    }
  })
  // De trás para a frente na tela.
  for (const k of [...blocos].sort((p, q) => p.y - q.y)) desenharBloco(g, k)
}

export const carimbo: DefinicaoDeCarimbo = {
  id: 'blocos-de-cantaria',
  nome: 'Blocos de cantaria',
  tamanho: 10,
  sombra: 'baixa',
  desenhar,
}

/** Todas as cores chapadas do desenho (as faces são misturas da clara com a escura, dentro da faixa delas). */
export const paleta: readonly Rgb[] = [...[ARENITO, CINZENTO].flatMap((t) => [t.faixa, t.miolo, t.poro, t.clara, t.escura]), TERRA, MUSGO]
