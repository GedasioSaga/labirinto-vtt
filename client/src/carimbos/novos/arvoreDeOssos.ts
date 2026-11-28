import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Árvore de ossos (L09 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`; tema Inferno): a
 * árvore que cresceu de osso no lugar de madeira. Em pé, como a Árvore congelada (`arvoreCongelada.ts`): o pé no 0 e a
 * copa para cima. O TRONCO é uma espinha de vértebras empilhadas, um nada torta, com as asas de cada vértebra para os
 * lados; as RAÍZES são dedos de osso abertos no chão, com os nós das juntas; os GALHOS são costelas que saem do alto
 * do tronco e sobem abrindo, e cada ponta acaba em DEDOS (as falanges abertas como uma mão que pega o ar). No garfo,
 * onde as costelas saem, a CAVEIRA de frente. De um galho pende um cordão com duas vértebras; no chão, dois ossos.
 *
 * O osso é o marfim velho dos ossos de hoje (`ossos.ts`), com o lado da luz à esquerda (o fio claro em cima de cada
 * osso) e a beira escura que segura o desenho no chão de cinza e no de lava. O giro inclina a copa de leve e troca o
 * lado do cordão; a luz não gira.
 *
 * Os ossos são pintados em GRUPOS (o chão, as raízes, os galhos com os dedos), camada por camada, cada camada num
 * caminho só: os ossos de um grupo juntam numa silhueta, e o desenho fica dentro do teto de tempo da folha (a 1ª,
 * 28/11/2026, com um caminho por osso e por camada, deu 307 comandos e passou do teto).
 */

const OSSO_CLARO: Rgb = [216, 206, 180]
const OSSO: Rgb = [190, 178, 150]
const OSSO_SOMBRA: Rgb = [146, 132, 108]
const BEIRA: Rgb = [84, 72, 62]
const OCO: Rgb = [70, 60, 52]
const CORDAO: Rgb = [96, 80, 66]

/** As larguras dos galhos e dos dedos (unidades do carimbo). */
const LARGURA_DO_GALHO = 0.032
const LARGURA_DO_DEDO = 0.013
/** Abaixo destas larguras o fio de luz do osso e o brilho do nó somem no tamanho de mesa: não são pintados. */
const LARGURA_COM_BRILHO = 0.016
const RAIO_COM_BRILHO = 0.011

type Ponto = readonly [number, number]
/** Um osso traçado pela curva (de, meio, ate), com a largura dele. */
interface Osso {
  readonly de: Ponto
  readonly meio: Ponto
  readonly ate: Ponto
  readonly largura: number
}
/** Um nó (a cabeça redonda do osso, a junta). */
interface No {
  readonly x: number
  readonly y: number
  readonly r: number
}

function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

/**
 * O retângulo de cantos redondos no caminho (o `roundRect` à mão: a tela da folha de carimbos não tem `roundRect`, e
 * o desenho tem de sair igual nas duas).
 */
function retanguloRedondo(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, raio: number): void {
  const r = Math.min(raio, w / 2, h / 2)
  g.moveTo(x + r, y)
  g.lineTo(x + w - r, y)
  g.quadraticCurveTo(x + w, y, x + w, y + r)
  g.lineTo(x + w, y + h - r)
  g.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  g.lineTo(x + r, y + h)
  g.quadraticCurveTo(x, y + h, x, y + h - r)
  g.lineTo(x, y + r)
  g.quadraticCurveTo(x, y, x + r, y)
  g.closePath()
}

/**
 * Os ossos de uma largura num caminho só, deslocados `d` (o fio de luz sobe para a esquerda). Só as costelas dos
 * galhos são curvas; os ossos finos são dois gomos retos pelo meio (a junta): o traço da curva em software sai em
 * dezenas de pedaços, e a 2ª folha (28/11/2026) passou do teto de tempo com todos curvos.
 */
function tracarOssos(g: CanvasRenderingContext2D, ossos: readonly Osso[], largura: number, d: number): void {
  g.beginPath()
  for (const o of ossos) {
    if (o.largura !== largura) continue
    g.moveTo(o.de[0] + d, o.de[1] + d)
    if (o.largura >= LARGURA_DO_GALHO) {
      g.quadraticCurveTo(o.meio[0] + d, o.meio[1] + d, o.ate[0] + d, o.ate[1] + d)
    } else {
      g.lineTo(o.meio[0] + d, o.meio[1] + d)
      g.lineTo(o.ate[0] + d, o.ate[1] + d)
    }
  }
}

/** Os nós escolhidos num caminho só: o raio e o deslocamento de cada um saem das funções. */
function pintarNos(g: CanvasRenderingContext2D, nos: readonly No[], cor: string, raio: (n: No) => number, d: (n: No) => number): void {
  if (nos.length === 0) return
  g.fillStyle = cor
  g.beginPath()
  for (const n of nos) {
    const [x, y, r] = [n.x + d(n), n.y + d(n), raio(n)]
    g.moveTo(x + r, y)
    g.arc(x, y, r, 0, Math.PI * 2)
  }
  g.fill()
}

/** Um grupo de ossos e nós, camada por camada: a beira escura, o corpo e o fio de luz em cima à esquerda. */
function pintarGrupo(g: CanvasRenderingContext2D, ossos: readonly Osso[], nos: readonly No[]): void {
  const larguras = [...new Set(ossos.map((o) => o.largura))]
  g.lineCap = 'round'
  g.strokeStyle = css(BEIRA)
  for (const l of larguras) {
    g.lineWidth = l + 0.014
    tracarOssos(g, ossos, l, 0)
    g.stroke()
  }
  pintarNos(g, nos, css(BEIRA), (n) => n.r + 0.007, () => 0)
  g.strokeStyle = css(OSSO)
  for (const l of larguras) {
    g.lineWidth = l
    tracarOssos(g, ossos, l, 0)
    g.stroke()
  }
  pintarNos(g, nos, css(OSSO), (n) => n.r, () => 0)
  g.strokeStyle = css(OSSO_CLARO)
  for (const l of larguras) {
    if (l < LARGURA_COM_BRILHO) continue
    g.lineWidth = l * 0.42
    tracarOssos(g, ossos, l, -l * 0.22)
    g.stroke()
  }
  pintarNos(g, nos.filter((n) => n.r >= RAIO_COM_BRILHO), css(OSSO_CLARO), (n) => n.r * 0.45, (n) => -n.r * 0.3)
}

/** Os dedos: três falanges abertas na ponta do galho, cada uma um osso só, curvo, saindo do nó da junta. */
function dedos(x: number, y: number, rumo: number, tamanho: number, semente: number): Osso[] {
  return [0, 1, 2].map((i): Osso => {
    const a = rumo + (i - 1) * 0.55 + (sorteio(semente, i) - 0.5) * 0.25
    const l = tamanho * (0.8 + 0.4 * sorteio(semente, i + 5))
    const meio: Ponto = [x + Math.cos(a) * l * 0.55, y + Math.sin(a) * l * 0.55]
    const curva = a + (i - 1) * 0.35
    const ate: Ponto = [meio[0] + Math.cos(curva) * l * 0.5, meio[1] + Math.sin(curva) * l * 0.5]
    return { de: [x, y], meio, ate, largura: LARGURA_DO_DEDO }
  })
}

/** O tronco: as vértebras empilhadas do pé ao garfo, afinando, com as asas para os lados e o vão escuro entre elas. */
function tronco(g: CanvasRenderingContext2D, torto: (y: number) => number, topo: number): void {
  const n = 8
  const passo = (0.02 - topo) / n
  const vertebras = Array.from({ length: n }, (_, i) => {
    const y1 = 0.02 - i * passo
    const y0 = y1 - passo * 0.86
    const meio = (y0 + y1) / 2
    return { y0, y1, meio, x: torto(meio), meia: 0.042 - i * 0.0025 }
  })
  // As asas (os processos de lado), atrás dos corpos, num caminho só.
  g.fillStyle = css(OSSO_SOMBRA)
  g.strokeStyle = css(BEIRA)
  g.lineWidth = 0.006
  g.beginPath()
  for (const { y0, y1, meio, x, meia } of vertebras) {
    for (const lado of [-1, 1]) {
      g.moveTo(x + lado * meia * 0.6, y0 + passo * 0.2)
      g.lineTo(x + lado * (meia + 0.03), meio - passo * 0.1)
      g.lineTo(x + lado * meia * 0.7, y1 - passo * 0.15)
      g.closePath()
    }
  }
  g.stroke()
  g.fill()
  // Os corpos, uma camada por vez (a beira, a metade da sombra, a da luz e o brilho), cada camada num caminho só.
  const camada = (cor: string, caixa: (v: (typeof vertebras)[number]) => readonly [number, number, number, number, number]): void => {
    g.fillStyle = cor
    g.beginPath()
    for (const v of vertebras) retanguloRedondo(g, ...caixa(v))
    g.fill()
  }
  camada(css(BEIRA), ({ x, y0, y1, meia }) => [x - meia - 0.006, y0 - 0.006, (meia + 0.006) * 2, y1 - y0 + 0.012, 0.016])
  camada(css(OSSO_SOMBRA), ({ x, y0, y1, meia }) => [x - meia, y0, meia * 2, y1 - y0, 0.013])
  camada(css(OSSO), ({ x, y0, y1, meia }) => [x - meia, y0, meia * 1.15, y1 - y0, 0.013])
  camada(css(OSSO_CLARO), ({ x, y0, y1, meia }) => [x - meia * 0.8, y0 + (y1 - y0) * 0.2, meia * 0.45, (y1 - y0) * 0.55, 0.008])
}

/** A caveira do garfo, de frente: a cúpula com o maxilar, as órbitas, o nariz e a fileira de dentes. */
function caveira(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  g.fillStyle = css(BEIRA)
  g.beginPath()
  g.ellipse(x, y, r + 0.008, r * 0.92 + 0.008, 0, 0, Math.PI * 2)
  retanguloRedondo(g, x - r * 0.52 - 0.008, y, r * 1.04 + 0.016, r * 1.05 + 0.008, r * 0.3)
  g.fill()
  g.fillStyle = css(OSSO)
  g.beginPath()
  g.ellipse(x, y, r, r * 0.92, 0, 0, Math.PI * 2)
  retanguloRedondo(g, x - r * 0.52, y, r * 1.04, r * 1.05, r * 0.28)
  g.fill()
  g.fillStyle = css(OSSO_CLARO)
  g.beginPath()
  g.ellipse(x - r * 0.3, y - r * 0.35, r * 0.42, r * 0.32, -0.4, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = css(OCO)
  g.beginPath()
  for (const lado of [-1, 1]) g.ellipse(x + lado * r * 0.38, y + r * 0.18, r * 0.27, r * 0.25, lado * -0.2, 0, Math.PI * 2)
  g.fill()
  g.beginPath()
  g.moveTo(x, y + r * 0.42)
  g.lineTo(x + r * 0.12, y + r * 0.66)
  g.lineTo(x - r * 0.12, y + r * 0.66)
  g.closePath()
  g.fill()
  g.fillRect(x - r * 0.42, y + r * 0.8, r * 0.84, r * 0.2)
  g.fillStyle = css(OSSO_CLARO)
  for (let i = 0; i < 5; i++) g.fillRect(x - r * 0.38 + i * r * 0.17, y + r * 0.78, r * 0.11, r * 0.18)
}

/** As costelas que viram galhos: de onde saem no garfo, a curva e a ponta (de onde abrem os dedos). */
const GALHOS: readonly (readonly [Ponto, Ponto, Ponto])[] = [
  [[-0.02, -0.5], [-0.3, -0.6], [-0.37, -0.84]],
  [[-0.01, -0.53], [-0.15, -0.74], [-0.19, -0.97]],
  [[0, -0.55], [0.03, -0.8], [-0.01, -1.04]],
  [[0.01, -0.53], [0.17, -0.72], [0.22, -0.95]],
  [[0.02, -0.5], [0.3, -0.58], [0.38, -0.8]],
]

/** As raízes: dedos de osso abertos no chão (do pé do tronco para fora). */
const RAIZES: readonly (readonly [Ponto, Ponto])[] = [
  [[-0.13, 0.02], [-0.23, 0.045]],
  [[-0.06, 0.035], [-0.12, 0.07]],
  [[0.07, 0.035], [0.14, 0.068]],
  [[0.13, 0.018], [0.24, 0.04]],
]

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const inclina = Math.sin(giro) * 0.04
  const torto = (y: number): number => Math.sin(-y * 5.2 + sorteio(semente, 1) * 2) * 0.016 + (-y / 0.5) * inclina * 0.5
  const topo = -0.5
  const garfo: Ponto = [torto(topo), topo]

  // Os ossos caídos no chão, atrás das raízes.
  pintarGrupo(
    g,
    [
      { de: [-0.3, 0.07], meio: [-0.24, 0.068], ate: [-0.17, 0.08], largura: 0.018 },
      { de: [0.2, 0.085], meio: [0.25, 0.08], ate: [0.31, 0.072], largura: 0.015 },
    ],
    [
      { x: -0.3, y: 0.07, r: 0.013 },
      { x: -0.17, y: 0.08, r: 0.013 },
    ],
  )

  // As raízes: dois gomos cada, a junta no meio, saindo de debaixo do tronco.
  const raizes: Osso[] = []
  const nosDasRaizes: No[] = []
  RAIZES.forEach(([meio, ponta], i) => {
    const de: Ponto = [torto(0) + meio[0] * 0.3, 0.0]
    raizes.push({ de, meio: [(de[0] + meio[0]) / 2, de[1] + 0.012], ate: meio, largura: 0.022 })
    raizes.push({ de: meio, meio: [(meio[0] + ponta[0]) / 2, (meio[1] + ponta[1]) / 2 + 0.006], ate: ponta, largura: 0.016 })
    nosDasRaizes.push({ x: meio[0], y: meio[1], r: 0.014 }, { x: ponta[0], y: ponta[1], r: 0.01 + 0.003 * sorteio(semente, 20 + i) })
  })
  pintarGrupo(g, raizes, nosDasRaizes)

  // Os galhos de costela, atrás do tronco e da caveira, cada um com os dedos na ponta.
  const galhos: Osso[] = []
  const nosDosGalhos: No[] = []
  GALHOS.forEach(([de, meio, ate], i) => {
    const d: Ponto = [de[0] + garfo[0], de[1]]
    const m: Ponto = [meio[0] + garfo[0] + inclina, meio[1]]
    const a: Ponto = [ate[0] + garfo[0] + inclina * 1.6, ate[1]]
    galhos.push({ de: d, meio: m, ate: a, largura: LARGURA_DO_GALHO }, ...dedos(a[0], a[1], Math.atan2(a[1] - m[1], a[0] - m[0]), 0.07, semente * 3 + i * 7))
    nosDosGalhos.push({ x: a[0], y: a[1], r: 0.013 })
  })
  pintarGrupo(g, galhos, nosDosGalhos)

  // O cordão com as duas vértebras, pendurado no galho de um lado (o giro escolhe).
  const lado = Math.cos(giro) >= 0 ? 1 : -1
  const [px, py] = [lado * 0.27 + garfo[0] + inclina, -0.66]
  g.strokeStyle = css(CORDAO)
  g.lineWidth = 0.006
  g.beginPath()
  g.moveTo(px, py)
  g.quadraticCurveTo(px + lado * 0.012, py + 0.06, px + lado * 0.004, py + 0.13)
  g.stroke()
  pintarGrupo(g, [], [
    { x: px + lado * 0.008, y: py + 0.075, r: 0.014 },
    { x: px + lado * 0.004, y: py + 0.115, r: 0.016 },
  ])

  tronco(g, torto, topo)
  caveira(g, garfo[0], garfo[1] - 0.02, 0.068)
}

/**
 * Tamanho 15, o da Árvore congelada. O tempo dos 8 giros na folha (régua relativa, por software) ficou em 650 a 720
 * ms, teto 500, com a congelada em 360 a 400 ms no mesmo run (28/11/2026): cair para o tamanho 12, juntar os ossos
 * em grupos (307 para 46 comandos), trocar as curvas finas por gomos retos, a beira opaca e a ponta reta não mudaram o
 * tempo além do ruído da máquina; fica para o integrador medir no navegador (cada giro assa uma vez, ~85 ms aqui).
 */
export const carimbo: DefinicaoDeCarimbo = { id: 'arvore-de-ossos', nome: 'Árvore de ossos', tamanho: 15, sombra: 'em-pe', desenhar }

/** Todas as cores chapadas do desenho. */
export const paleta: readonly Rgb[] = [OSSO_CLARO, OSSO, OSSO_SOMBRA, BEIRA, OCO, CORDAO]
