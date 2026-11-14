import { css, misturar, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Flor gigante (item 151 da lista de 14/11/2026, Pântano e fantasia): uma flor
 * do tamanho de um homem, de fantasia. Embaixo, quatro folhas grandes
 * deitadas no chão; no meio, o caule grosso; no alto, a corola aberta para o
 * céu: cinco pétalas largas e redondas, violeta-azuladas (cor que nenhum
 * outro carimbo usa), cada uma com a beira mais funda, o miolo da pétala
 * aceso e um risco claro no meio (juntos fazem a estrela do centro), a
 * garganta funda e os estames claros. Às vezes um botão fechado, num caule
 * fino, do lado.
 *
 * Vista de cima com um pouco de frente: a corola é um disco achatado. A luz
 * é a de sempre (de cima à esquerda, não gira): a pétala que aponta para ela
 * sai mais clara. O giro gira as pétalas e as folhas, inclina o caule de
 * leve e muda o lado do botão.
 */

type Ponto = [number, number]

const FOLHA_ESCURA: Rgb = [42, 96, 70]
const FOLHA_CLARA: Rgb = [116, 162, 100]
const CAULE: Rgb = [62, 108, 72]
const CAULE_CLARO: Rgb = [104, 148, 90]
const PETALA_FUNDA: Rgb = [78, 70, 140]
const PETALA: Rgb = [112, 104, 180]
const PETALA_CLARA: Rgb = [152, 146, 208]
const PETALA_RISCO: Rgb = [184, 180, 224]
const GARGANTA: Rgb = [64, 52, 108]
const ESTAME: Rgb = [234, 214, 142]
const ESTAME_SOMBRA: Rgb = [190, 160, 98]

const LUZ_NO_PLANO = { x: -0.6, y: -0.8 } as const

const FOLHAS = { y: -0.03, achata: 0.6, quantas: 4, comprimento: 0.42, largura: 0.15 } as const
/** A corola: o meio, o raio e o achatamento do disco (virado para o céu, visto um pouco de frente). */
const COROLA = { y: -0.64, raio: 0.36, achata: 0.8, petalas: 5, abre: 0.7 } as const

/** Sorteio fixo de 0 a 1 por semente e índice: o mesmo desenho em toda tela. */
function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

/** O quanto a direção (dx, dy) aponta para a luz: 0 de costas, 1 de frente. */
function voltadoParaALuz(dx: number, dy: number): number {
  const n = Math.hypot(dx, dy) || 1
  return 0.5 + 0.5 * ((dx * LUZ_NO_PLANO.x + dy * LUZ_NO_PLANO.y) / n)
}

function caminho(g: CanvasRenderingContext2D, pontos: readonly Ponto[]): void {
  g.beginPath()
  pontos.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)))
  g.closePath()
}

function pintar(g: CanvasRenderingContext2D, cor: Rgb, pontos: readonly Ponto[]): void {
  g.fillStyle = css(cor)
  caminho(g, pontos)
  g.fill()
}

/** Uma folha grande deitada, do pé para fora: a metade do lado da luz mais clara que a outra. */
function desenharFolha(g: CanvasRenderingContext2D, angulo: number, comprimento: number, largura: number): void {
  const dx = Math.cos(angulo)
  const dy = Math.sin(angulo)
  const ponto = (u: number, v: number): Ponto => [u * dx - v * dy, FOLHAS.y + (u * dy + v * dx) * FOLHAS.achata]
  const passos = 7
  const borda = (lado: number, k: number, t0 = 0, t1 = 1): Ponto[] =>
    Array.from({ length: passos + 1 }, (_, i) => {
      const t = t0 + ((t1 - t0) * i) / passos
      // Larga no terço do pé, de ponta fina.
      const w = largura * Math.sin(Math.PI * t) ** 0.7 * (1 - 0.3 * t)
      return ponto(t * comprimento, lado * w * k)
    })
  const naTela = { x: dx, y: dy * FOLHAS.achata }
  const tom = voltadoParaALuz(naTela.x, naTela.y)
  // A folha inteira no tom escuro (a beira segura a folha na grama; clara, ela sumia)...
  pintar(g, misturar(FOLHA_ESCURA, FOLHA_CLARA, 0.12 + tom * 0.3), [...borda(1, 1), ...borda(-1, 1).reverse()])
  // ...e a metade do lado da luz (+v ou -v, pela normal +v na tela), por dentro da beira.
  const normal = { x: -dy, y: dx * FOLHAS.achata }
  const lado = normal.x * LUZ_NO_PLANO.x + normal.y * LUZ_NO_PLANO.y >= 0 ? 1 : -1
  pintar(g, misturar(FOLHA_ESCURA, FOLHA_CLARA, 0.3 + tom * 0.7), [...borda(lado, 0.78, 0.08, 0.88), ...borda(lado, 0.08, 0.08, 0.88).reverse()])
}

function desenharCaule(g: CanvasRenderingContext2D, de: Ponto, curva: Ponto, ate: Ponto, largura: number): void {
  g.lineCap = 'round'
  g.lineWidth = largura
  g.strokeStyle = css(CAULE)
  g.beginPath()
  g.moveTo(de[0], de[1])
  g.quadraticCurveTo(curva[0], curva[1], ate[0], ate[1])
  g.stroke()
  g.lineWidth = largura * 0.4
  g.strokeStyle = css(CAULE_CLARO)
  const d = largura * 0.22
  g.beginPath()
  g.moveTo(de[0] - d, de[1])
  g.quadraticCurveTo(curva[0] - d, curva[1], ate[0] - d, ate[1])
  g.stroke()
}

/** O botão fechado: uma gota violeta apontando para cima, abraçada por duas sépalas verdes. */
function desenharBotao(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  const gota = (k: number, dx: number, cor: Rgb) => {
    g.fillStyle = css(cor)
    g.beginPath()
    g.moveTo(x + dx, y - r * 2.1 * k)
    g.quadraticCurveTo(x + dx + r * 1.25 * k, y - r * 0.5 * k, x + dx, y + r * 0.45 * k)
    g.quadraticCurveTo(x + dx - r * 1.25 * k, y - r * 0.5 * k, x + dx, y - r * 2.1 * k)
    g.fill()
  }
  gota(1, 0, PETALA_FUNDA)
  gota(0.72, -r * 0.22, PETALA)
  g.fillStyle = css(CAULE)
  g.beginPath()
  g.moveTo(x - r * 0.95, y - r * 0.55)
  g.quadraticCurveTo(x - r * 0.7, y + r * 0.55, x, y + r * 0.5)
  g.quadraticCurveTo(x + r * 0.7, y + r * 0.55, x + r * 0.95, y - r * 0.55)
  g.quadraticCurveTo(x, y + r * 0.05, x - r * 0.95, y - r * 0.55)
  g.fill()
}

/** A pétala no disco da corola: do miolo (s = 0) à beira (s = 1), larga e redonda, com um dente raso na ponta. */
function petala(cx: number, cy: number, angulo: number, raio: number, abre: number, de: number, ate: number, achata: number = COROLA.achata): Ponto[] {
  const ponto = (r: number, a: number): Ponto => [cx + Math.cos(a) * r, cy + Math.sin(a) * r * achata]
  const meia = (s: number) => abre * (0.42 + 0.58 * Math.sin(Math.PI * Math.min(1, s * 0.82 + 0.1)))
  const passos = 6
  const ida: Ponto[] = []
  const volta: Ponto[] = []
  for (let i = 0; i <= passos; i++) {
    const s = de + ((ate - de) * i) / passos
    ida.push(ponto(raio * s, angulo - meia(s)))
    volta.push(ponto(raio * s, angulo + meia(s)))
  }
  // A ponta: redonda dos lados, com o dente raso no meio.
  const pontaFora = meia(ate)
  const ponta: Ponto[] = [
    ponto(raio * ate * 1.0, angulo - pontaFora * 0.55),
    ponto(raio * ate * 0.985, angulo - pontaFora * 0.18),
    ponto(raio * ate * 0.93, angulo),
    ponto(raio * ate * 0.985, angulo + pontaFora * 0.18),
    ponto(raio * ate * 1.0, angulo + pontaFora * 0.55),
  ]
  return [...ida, ...ponta, ...volta.reverse()]
}

function desenharFlorGigante(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const inclina = Math.sin(giro) * 0.06
  const cx = inclina * 1.4
  const cy = COROLA.y

  // As folhas do pé: quatro, deitadas; as de trás primeiro.
  const folhas = Array.from({ length: FOLHAS.quantas }, (_, i) => ({
    angulo: giro + 0.4 + (i * Math.PI * 2) / FOLHAS.quantas + (sorteio(semente, i) - 0.5) * 0.5,
    comprimento: FOLHAS.comprimento * (0.85 + 0.3 * sorteio(semente, 10 + i)),
  })).sort((p, q) => Math.sin(p.angulo) - Math.sin(q.angulo))
  for (const f of folhas) desenharFolha(g, f.angulo, f.comprimento, FOLHAS.largura)

  // Às vezes uma pétala caída no chão, perto do pé (dá a escala: cada pétala é do tamanho de uma folha).
  if (sorteio(semente, 25) < 0.5) {
    const a = giro * 1.7 + sorteio(semente, 26) * Math.PI * 2
    const px = Math.cos(a) * 0.3
    const py = FOLHAS.y + 0.04 + Math.sin(a) * 0.3 * FOLHAS.achata * 0.6
    const deita = a + Math.PI * (0.6 + 0.4 * sorteio(semente, 27))
    const tom = voltadoParaALuz(Math.cos(deita), Math.sin(deita))
    pintar(g, misturar(PETALA_FUNDA, PETALA, 0.4 + 0.6 * tom), petala(px, py, deita, 0.15, COROLA.abre, 0.05, 1, FOLHAS.achata))
    pintar(g, misturar(PETALA, PETALA_CLARA, 0.5 * tom), petala(px, py, deita, 0.15, COROLA.abre * 0.6, 0.2, 0.84, FOLHAS.achata))
  }

  // O botão, às vezes, do lado que o giro escolhe (por trás do caule grande quando sobe atrás dele).
  const botao = sorteio(semente, 20) < 0.6
  const lado = Math.cos(giro + 0.5) >= 0 ? 1 : -1
  if (botao) {
    const bx = lado * (0.3 + 0.04 * sorteio(semente, 21))
    const by = -0.3 - 0.06 * sorteio(semente, 22)
    desenharCaule(g, [lado * 0.05, FOLHAS.y], [lado * 0.22, -0.08], [bx, by + 0.03], 0.032)
    desenharBotao(g, bx, by, 0.055)
  }

  desenharCaule(g, [0, FOLHAS.y], [inclina - 0.04, -0.34], [cx, cy + 0.08], 0.085)

  // A corola: as pétalas de trás (para cima na tela) primeiro; cada uma com a beira funda, o miolo aceso e o risco claro.
  const petalas = Array.from({ length: COROLA.petalas }, (_, i) => {
    const a = giro + (i * Math.PI * 2) / COROLA.petalas + (sorteio(semente, 30 + i) - 0.5) * 0.18
    return { a, raio: COROLA.raio * (0.94 + 0.12 * sorteio(semente, 40 + i)) }
  }).sort((p, q) => Math.sin(p.a) - Math.sin(q.a))
  for (const p of petalas) {
    const tom = voltadoParaALuz(Math.cos(p.a), Math.sin(p.a) * COROLA.achata)
    pintar(g, misturar(PETALA_FUNDA, PETALA, 0.35 + 0.65 * tom), petala(cx, cy, p.a, p.raio, COROLA.abre, 0.05, 1))
    pintar(g, misturar(PETALA, PETALA_CLARA, tom), petala(cx, cy, p.a, p.raio, COROLA.abre * 0.72, 0.16, 0.86))
    pintar(g, PETALA_RISCO, petala(cx, cy, p.a, p.raio, COROLA.abre * 0.19, 0.5, 0.8))
  }
  // A volta de dentro: cinco pétalas menores entre as de fora, levantadas (pegam mais luz), com o risco curto.
  const dentro = petalas.map((p) => ({ a: p.a + Math.PI / COROLA.petalas, raio: p.raio * 0.6 })).sort((p, q) => Math.sin(p.a) - Math.sin(q.a))
  for (const p of dentro) {
    const tom = voltadoParaALuz(Math.cos(p.a), Math.sin(p.a) * COROLA.achata)
    pintar(g, misturar(PETALA_FUNDA, PETALA, 0.55 + 0.45 * tom), petala(cx, cy, p.a, p.raio, COROLA.abre * 0.8, 0.05, 1))
    pintar(g, misturar(PETALA, PETALA_CLARA, 0.25 + 0.75 * tom), petala(cx, cy, p.a, p.raio, COROLA.abre * 0.56, 0.2, 0.84))
  }

  // O miolo: a garganta funda, a coroa de estames e o pistilo no meio.
  const r = COROLA.raio
  g.fillStyle = css(GARGANTA)
  g.beginPath()
  g.ellipse(cx + r * 0.02, cy + r * 0.02, r * 0.27, r * 0.27 * COROLA.achata, 0, 0, Math.PI * 2)
  g.fill()
  const estames: Array<[number, number, number]> = []
  for (let i = 0; i < 7; i++) {
    const a = giro * 1.3 + (i * Math.PI * 2) / 7
    estames.push([cx + Math.cos(a) * r * 0.15, cy + Math.sin(a) * r * 0.15 * COROLA.achata, r * 0.06])
  }
  for (const [cor, dx, dy] of [
    [ESTAME_SOMBRA, r * 0.015, r * 0.02],
    [ESTAME, -r * 0.01, -r * 0.01],
  ] as const) {
    g.fillStyle = css(cor)
    g.beginPath()
    for (const [x, y, er] of estames) {
      g.moveTo(x + dx + er, y + dy)
      g.arc(x + dx, y + dy, er, 0, Math.PI * 2)
    }
    g.fill()
  }
  g.fillStyle = css(ESTAME_SOMBRA)
  g.beginPath()
  g.arc(cx, cy, r * 0.07, 0, Math.PI * 2)
  g.fill()
}

export const carimbo: DefinicaoDeCarimbo = {
  id: 'flor-gigante',
  nome: 'Flor gigante',
  tamanho: 11,
  sombra: 'em-pe',
  desenhar: desenharFlorGigante,
}

/** Todas as cores chapadas do desenho. */
export const paleta: readonly Rgb[] = [
  FOLHA_ESCURA,
  FOLHA_CLARA,
  CAULE,
  CAULE_CLARO,
  PETALA_FUNDA,
  PETALA,
  PETALA_CLARA,
  PETALA_RISCO,
  GARGANTA,
  ESTAME,
  ESTAME_SOMBRA,
]
