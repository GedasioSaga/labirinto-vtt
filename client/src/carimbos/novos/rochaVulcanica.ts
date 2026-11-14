import { css, type DefinicaoDeCarimbo, type DesenhoDeCarimbo, type Rgb } from '../embutidos'
import { caminhoDaRocha, facesDaRocha, meioDaFace, paletaDaRocha, pintarRocha, pontoNaFace, type FaceDaRocha, type FormaDaRocha, type Ponto, type TonsDaRocha } from './_rochaFacetada'

/**
 * Rocha vulcânica com brasa (item 148 dos carimbos de 14/11/2026): um bloco
 * de basalto escuro, alto e lascado (o topo torto, em picos), com um caco
 * menor do lado, rachado de fendas que guardam brasa, e umas pedrinhas de
 * lava no chão em volta. O bloco é o de `_rochaFacetada.ts`.
 *
 * DOIS desenhos no mesmo quadro e no mesmo giro: `desenhar` é a rocha com as
 * fendas em brasa APAGADA (o vermelho-escuro da brasa morna); `brilho` é SÓ o
 * que acende (as fendas e as pedrinhas, nas cores da chama do app, miolo e
 * borda de `pixi/chamasDasFogueiras.ts`), somado por cima e pulsando no app.
 * As fendas saem da mesma conta nos dois (`fendasDaRocha`), então o brilho cai
 * em cima da fenda apagada em todo giro. A luz não gira.
 */

const BASALTO: TonsDaRocha = { escura: [60, 56, 60], meia: [88, 82, 84], clara: [128, 120, 116] }
/** A brasa morna, apagada: o que a fenda mostra de dia. */
const BRASA_APAGADA: Rgb = [112, 50, 42]
/** As cores da chama do app (`0xf0c98a` e `0xa04a2c`): só no `brilho`, fora da paleta. */
const MIOLO_DA_CHAMA: Rgb = [240, 201, 138]
const BORDA_DA_CHAMA: Rgb = [160, 74, 44]

/** A grossura das fendas no quadro (unidades). */
const FENDA = { apagada: 0.022, borda: 0.05, miolo: 0.013 } as const

/** Sorteio fixo de 0 a 1 por semente e índice: o mesmo desenho em toda tela. */
function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

interface Pedaco {
  readonly forma: FormaDaRocha
  readonly faces: FaceDaRocha[]
  readonly fendas: Ponto[][]
}

interface Rocha {
  /** Os pedaços na ordem de pintar (o de trás primeiro). */
  readonly pedacos: readonly Pedaco[]
  /** As pedrinhas de lava no chão: x, y, raio. */
  readonly brasas: ReadonlyArray<readonly [number, number, number]>
}

/**
 * Uma fenda que desce uma face de lado, do alto até perto do pé (no pé, o
 * brilho vazava no chão como pingo), em zigue-zague quebrado, com um galho curto.
 */
function fendaNaFace(face: FaceDaRocha, semente: number, i: number): Ponto[][] {
  let s = 0.32 + 0.36 * sorteio(semente, 300 + i)
  let t = 0.92
  const linha: Ponto[] = []
  while (t > 0.12) {
    linha.push(pontoNaFace(face, s, t))
    // Desvio sorteado, sem vai e volta forçado (alternado, a fenda virava um raio de desenho).
    s = Math.min(0.8, Math.max(0.2, s + (sorteio(semente, 310 + i * 11 + linha.length) - 0.5) * 0.3))
    t -= 0.1 + 0.08 * sorteio(semente, 360 + i * 11 + linha.length)
  }
  linha.push(pontoNaFace(face, s, 0.12))
  const de = linha[2]
  const ponta = pontoNaFace(face, Math.min(0.88, Math.max(0.12, s + (sorteio(semente, 330 + i) < 0.5 ? -0.28 : 0.28))), 0.36)
  return [linha, [de, ponta]]
}

/** A fenda do topo: atravessa o topo pelo meio, de uma quina à oposta, com uma dobra. */
function fendaNoTopo(face: FaceDaRocha, semente: number): Ponto[] {
  const p = face.pontos
  const [mx, my] = meioDaFace(face)
  const j = Math.floor(sorteio(semente, 340) * p.length)
  const a = p[j]
  const b = p[(j + Math.floor(p.length / 2)) % p.length]
  const dobra = (sorteio(semente, 341) - 0.5) * 0.05
  return [
    [mx + (a[0] - mx) * 0.7, my + (a[1] - my) * 0.7],
    [mx + (a[0] - mx) * 0.3 + dobra, my + (a[1] - my) * 0.3 + 0.012],
    [mx - dobra, my - dobra * 0.5],
    [mx + (b[0] - mx) * 0.6, my + (b[1] - my) * 0.6],
  ]
}

/** As fendas de um pedaço: nas faces de lado que mais olham para quem vê, e no topo. */
function fendasDoPedaco(faces: readonly FaceDaRocha[], quantas: number, semente: number, comTopo: boolean): Ponto[][] {
  const lados = faces
    .filter((f) => f.tipo === 'lado')
    .map((f) => {
      const [a, b, , d] = f.pontos
      // A fenda vai na face grande e de frente (na face estreita de quina ela some).
      const tamanho = Math.hypot(b[0] - a[0], b[1] - a[1]) * Math.hypot(d[0] - a[0], d[1] - a[1])
      return { f, nota: f.frente * tamanho }
    })
    .sort((x, y) => y.nota - x.nota)
    .slice(0, quantas)
  const fendas = lados.flatMap(({ f }, i) => fendaNaFace(f, semente, i))
  const topo = faces.find((f) => f.tipo === 'topo')
  if (comTopo && topo !== undefined) fendas.push(fendaNoTopo(topo, semente))
  return fendas
}

function rochaDe(giro: number, semente: number): Rocha {
  // O caco menor fica sempre de lado e um pouco na frente ou atrás; o bloco chega para o outro lado.
  const lado = Math.cos(giro + 0.9) >= 0 ? 1 : -1
  const bloco: FormaDaRocha = {
    cx: -lado * 0.05,
    cy: -0.05,
    raio: 0.27 * (0.94 + 0.12 * sorteio(semente, 2)),
    altura: 0.46 * (0.9 + 0.2 * sorteio(semente, 3)),
    lados: 6,
    aneis: [
      [0, 0.96],
      [0.5, 0.86],
      [1, 0.44],
    ],
    recuo: 0.18,
    aspereza: 0.4,
    picos: 0.5,
    giro,
    semente,
  }
  const caco: FormaDaRocha = {
    cx: lado * (0.3 + 0.04 * sorteio(semente, 4)),
    cy: -0.01 + Math.sin(giro * 1.3 + 0.5) * 0.06,
    raio: 0.13,
    altura: 0.17 + 0.04 * sorteio(semente, 5),
    lados: 5,
    aneis: [
      [0, 1],
      [1, 0.5],
    ],
    recuo: 0.1,
    aspereza: 0.4,
    picos: 0.4,
    giro: giro * 1.5 + 2,
    semente: semente + 7,
  }
  const facesDoBloco = facesDaRocha(bloco)
  const facesDoCaco = facesDaRocha(caco)
  const pedacos: Pedaco[] = [
    { forma: bloco, faces: facesDoBloco, fendas: fendasDoPedaco(facesDoBloco, 2, semente, true) },
    { forma: caco, faces: facesDoCaco, fendas: fendasDoPedaco(facesDoCaco, 1, semente + 3, false) },
  ].sort((a, b) => a.forma.cy - b.forma.cy)
  // As pedrinhas de lava: na frente, em volta do pé, fora do caco.
  const brasas = Array.from({ length: 3 }, (_, i) => {
    const a = Math.PI * (0.12 + 0.76 * ((i + sorteio(semente, 400 + i)) / 3))
    const d = 0.36 + 0.08 * sorteio(semente, 410 + i)
    return [bloco.cx + Math.cos(a) * d, bloco.cy + 0.04 + Math.sin(a) * d * 0.55, 0.028 + 0.014 * sorteio(semente, 420 + i)] as const
  }).filter(([x]) => Math.abs(x - caco.cx) > caco.raio * 1.2)
  return { pedacos, brasas }
}

function tracar(g: CanvasRenderingContext2D, fendas: readonly Ponto[][]): void {
  g.beginPath()
  for (const linha of fendas) {
    linha.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)))
  }
  g.stroke()
}

/** As pedrinhas de lava: lascas de basalto de cinco quinas (bolinha redonda virava alvo). */
function lascas(g: CanvasRenderingContext2D, brasas: Rocha['brasas'], semente: number): void {
  g.fillStyle = css(BASALTO.meia)
  g.beginPath()
  brasas.forEach(([x, y, r], i) => {
    for (let k = 0; k < 5; k++) {
      const a = (k * Math.PI * 2) / 5 + sorteio(semente, 430 + i * 5 + k) * 0.6
      const d = r * (0.85 + 0.4 * sorteio(semente, 450 + i * 5 + k))
      const px = x + Math.cos(a) * d
      const py = y + Math.sin(a) * d * 0.62
      if (k === 0) g.moveTo(px, py)
      else g.lineTo(px, py)
    }
    g.closePath()
  })
  g.fill()
}

/** O miolo em brasa de cada lasca, um pouco para cima à esquerda (o topo dela). */
function miolos(g: CanvasRenderingContext2D, brasas: Rocha['brasas'], k: number, cor: string): void {
  g.fillStyle = cor
  g.beginPath()
  for (const [x, y, r] of brasas) {
    const cx = x - r * 0.12
    const cy = y - r * 0.12
    g.moveTo(cx + r * k, cy)
    g.ellipse(cx, cy, r * k, r * k * 0.7, 0, 0, Math.PI * 2)
  }
  g.fill()
}

function desenharRochaVulcanica(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const { pedacos, brasas } = rochaDe(giro, semente)
  g.lineCap = 'round'
  for (const p of pedacos) {
    pintarRocha(g, p.faces, BASALTO)
    g.strokeStyle = css(BRASA_APAGADA)
    g.lineWidth = FENDA.apagada
    tracar(g, p.fendas)
  }
  lascas(g, brasas, semente)
  miolos(g, brasas, 0.42, css(BRASA_APAGADA))
}

/** Só o que acende: as fendas e as pedrinhas. O pedaço da frente apaga o brilho do de trás onde o cobre. */
const desenharBrilho: DesenhoDeCarimbo = (g, giro, semente) => {
  const { pedacos, brasas } = rochaDe(giro, semente)
  g.lineCap = 'round'
  pedacos.forEach((p, i) => {
    if (i > 0) {
      g.save()
      g.globalCompositeOperation = 'destination-out'
      g.fillStyle = css(BASALTO.escura)
      caminhoDaRocha(g, p.faces)
      g.fill()
      g.restore()
    }
    g.strokeStyle = css(BORDA_DA_CHAMA, 0.85)
    g.lineWidth = FENDA.borda
    tracar(g, p.fendas)
    g.strokeStyle = css(MIOLO_DA_CHAMA)
    g.lineWidth = FENDA.miolo
    tracar(g, p.fendas)
  })
  miolos(g, brasas, 0.62, css(BORDA_DA_CHAMA, 0.8))
  miolos(g, brasas, 0.3, css(MIOLO_DA_CHAMA))
}

export const carimbo: DefinicaoDeCarimbo = {
  id: 'rocha-vulcanica',
  nome: 'Rocha vulcânica',
  tamanho: 10,
  sombra: 'baixa',
  desenhar: desenharRochaVulcanica,
}

export const brilho: DesenhoDeCarimbo = desenharBrilho

/** Todas as cores chapadas do desenho (as do `brilho` ficam fora, como pede o briefing). */
export const paleta: readonly Rgb[] = [...paletaDaRocha(BASALTO), BRASA_APAGADA]
