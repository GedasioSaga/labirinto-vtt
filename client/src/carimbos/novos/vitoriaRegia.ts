import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Vitória-régia (item 133 dos carimbos de 14/11/2026): três folhas redondas
 * boiando, uma grande e duas menores, e às vezes a flor. O que diz
 * "vitória-régia" (e não "folha de nenúfar") é a BORDA LEVANTADA: um aro
 * baixo em volta da folha, cor de vinho por fora (o avesso da folha). Vista
 * de cima e um pouco de frente: o aro da frente mostra o lado de fora (claro
 * à esquerda, escuro à direita), o de trás mostra o lado de dentro, e o
 * fundo da folha é um prato verde com as nervuras em raio. Por baixo, a
 * água escura em três véus transparentes, que se somam no meio e somem na
 * beira: no lago ela vira a sombra das folhas, no chão vira uma poça mansa.
 * Fica rente: sem sombra. O giro gira o arranjo das folhas; a luz não gira.
 */

const AGUA: Rgb = [38, 90, 94]
const AVESSO_CLARO: Rgb = [170, 96, 84]
const AVESSO_ESCURO: Rgb = [112, 54, 56]
const ARO: Rgb = [146, 84, 72]
const PAREDE_DE_DENTRO: Rgb = [72, 112, 64]
const FOLHA_CLARA: Rgb = [112, 154, 82]
const FOLHA_ESCURA: Rgb = [74, 122, 64]
const NERVURA: Rgb = [138, 172, 100]
const BRILHO: Rgb = [184, 210, 156]
const PETALA_CLARA: Rgb = [236, 230, 224]
const PETALA_SOMBRA: Rgb = [196, 184, 186]
const PETALA_ROSA: Rgb = [222, 170, 184]
const PETALA_ROSA_SOMBRA: Rgb = [178, 118, 138]
const MIOLO: Rgb = [222, 192, 120]

/** A água vista de cima e um pouco de frente. */
const ACHATA = 0.56
const MEIO_Y = -0.03

function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

const LUZ_NO_PLANO = { x: -0.6, y: -0.8 }

function voltadoParaALuz(dx: number, dy: number): number {
  const n = Math.hypot(dx, dy) || 1
  return 0.5 + 0.5 * ((dx * LUZ_NO_PLANO.x + dy * LUZ_NO_PLANO.y) / n)
}

function elipse(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, cor: Rgb, alfa = 1): void {
  g.fillStyle = css(cor, alfa)
  g.beginPath()
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  g.fill()
}

/** Uma folha com o aro levantado; (x, y) é o meio da borda de cima do aro. */
function desenharFolha(g: CanvasRenderingContext2D, x: number, y: number, r: number, semente: number): void {
  const ry = r * ACHATA
  const alto = r * 0.13
  // O lado de fora do aro da frente: a faixa entre a borda de cima e a linha d'água.
  const avesso = g.createLinearGradient(x - r, 0, x + r, 0)
  avesso.addColorStop(0, css(AVESSO_CLARO))
  avesso.addColorStop(1, css(AVESSO_ESCURO))
  g.fillStyle = avesso
  g.beginPath()
  g.moveTo(x + r, y)
  g.ellipse(x, y, r, ry, 0, 0, Math.PI)
  g.lineTo(x - r, y + alto)
  g.ellipse(x, y + alto, r, ry, 0, Math.PI, 0, true)
  g.closePath()
  g.fill()
  // A borda de cima do aro (só sobra à vista na frente, uma beirinha).
  elipse(g, x, y, r, ry, ARO)
  // O lado de dentro do aro de trás.
  elipse(g, x, y + ry * 0.02, r * 0.965, ry * 0.95, PAREDE_DE_DENTRO)
  // O fundo da folha: um prato, claro em cima à esquerda.
  const fy = y + ry * 0.12
  const fundo = g.createLinearGradient(x - r * 0.6, fy - ry * 0.8, x + r * 0.6, fy + ry * 0.8)
  fundo.addColorStop(0, css(FOLHA_CLARA))
  fundo.addColorStop(1, css(FOLHA_ESCURA))
  g.fillStyle = fundo
  g.beginPath()
  g.ellipse(x, fy, r * 0.92, ry * 0.8, 0, 0, Math.PI * 2)
  g.fill()
  // As nervuras: raios do meio para a beira e um anel, largos e mansos.
  g.strokeStyle = css(NERVURA, 0.5)
  g.lineWidth = r * 0.035
  g.lineCap = 'round'
  g.beginPath()
  const raios = 10
  const torce = sorteio(semente, 5) * Math.PI
  for (let i = 0; i < raios; i++) {
    const a = torce + (i * Math.PI * 2) / raios
    g.moveTo(x + Math.cos(a) * r * 0.1, fy + Math.sin(a) * ry * 0.08)
    g.lineTo(x + Math.cos(a) * r * 0.84, fy + Math.sin(a) * ry * 0.72)
  }
  g.moveTo(x + r * 0.5, fy)
  g.ellipse(x, fy, r * 0.5, ry * 0.43, 0, 0, Math.PI * 2)
  g.stroke()
  // O brilho da cera da folha, em cima à esquerda.
  elipse(g, x - r * 0.32, fy - ry * 0.3, r * 0.3, ry * 0.2, BRILHO, 0.4)
}

/** A flor: pétalas em duas voltas, as de costas para a luz no tom da sombra, e o miolo. */
function desenharFlor(g: CanvasRenderingContext2D, x: number, y: number, raio: number, giro: number, rosa: boolean): void {
  const voltas = [
    { n: 9, d: 0.55, rx: 0.5, ry: 0.26, claro: PETALA_CLARA, sombra: PETALA_SOMBRA, torce: 0 },
    { n: 7, d: 0.3, rx: 0.36, ry: 0.2, claro: rosa ? PETALA_ROSA : PETALA_CLARA, sombra: rosa ? PETALA_ROSA_SOMBRA : PETALA_SOMBRA, torce: 0.4 },
  ]
  for (const volta of voltas) {
    for (const deLuz of [false, true]) {
      g.fillStyle = css(deLuz ? volta.claro : volta.sombra)
      g.beginPath()
      for (let i = 0; i < volta.n; i++) {
        const a = giro + volta.torce + (i * Math.PI * 2) / volta.n
        if (voltadoParaALuz(Math.cos(a), Math.sin(a)) > 0.45 !== deLuz) continue
        const cx = x + Math.cos(a) * raio * volta.d
        const cy = y + Math.sin(a) * raio * volta.d * ACHATA
        const giroDaPetala = Math.atan2(Math.sin(a) * ACHATA, Math.cos(a))
        g.moveTo(cx + Math.cos(giroDaPetala) * raio * volta.rx, cy + Math.sin(giroDaPetala) * raio * volta.rx)
        g.ellipse(cx, cy, raio * volta.rx, raio * volta.ry, giroDaPetala, 0, Math.PI * 2)
      }
      g.fill()
    }
  }
  elipse(g, x, y - raio * 0.04, raio * 0.2, raio * 0.14, MIOLO)
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  // A água: três véus, do maior ao menor, levemente fora de centro.
  const veus = [
    { rx: 0.6, ry: 0.3, alfa: 0.2 },
    { rx: 0.5, ry: 0.255, alfa: 0.22 },
    { rx: 0.39, ry: 0.2, alfa: 0.24 },
  ]
  veus.forEach((v, i) => {
    const a = giro + i * 2.2
    elipse(g, Math.cos(a) * 0.03, MEIO_Y + Math.sin(a) * 0.015, v.rx, v.ry, AGUA, v.alfa)
  })

  // As folhas, no plano da água: a grande perto do meio, as menores em volta.
  const folhas = [
    { d: 0.13, a: 0, r: 0.24 },
    { d: 0.32, a: 2.2, r: 0.17 },
    { d: 0.33, a: 4.1, r: 0.12 },
  ].map((f, i) => {
    const a = giro + f.a + (sorteio(semente, 10 + i) - 0.5) * 0.4
    const r = f.r * (0.92 + 0.16 * sorteio(semente, 20 + i))
    return { x: Math.cos(a) * f.d, y: MEIO_Y + Math.sin(a) * f.d * ACHATA - r * 0.06, r, i }
  })
  const temFlor = sorteio(semente, 30) < 0.75
  const aFlor = giro + Math.PI + (sorteio(semente, 31) - 0.5) * 0.3
  const flor = { x: Math.cos(aFlor) * 0.21, y: MEIO_Y + Math.sin(aFlor) * 0.21 * ACHATA - 0.03 }
  const desenhos = [
    ...folhas.map((f) => ({ y: f.y, faz: () => desenharFolha(g, f.x, f.y, f.r, semente + f.i) })),
    ...(temFlor ? [{ y: flor.y + 0.02, faz: () => desenharFlor(g, flor.x, flor.y, 0.1, giro, sorteio(semente, 32) < 0.5) }] : []),
  ].sort((p, q) => p.y - q.y)
  for (const d of desenhos) d.faz()
}

export const carimbo: DefinicaoDeCarimbo = { id: 'vitoria-regia', nome: 'Vitória-régia', tamanho: 10, sombra: 'nenhuma', desenhar }

export const paleta: readonly Rgb[] = [
  AGUA,
  AVESSO_CLARO,
  AVESSO_ESCURO,
  ARO,
  PAREDE_DE_DENTRO,
  FOLHA_CLARA,
  FOLHA_ESCURA,
  NERVURA,
  BRILHO,
  PETALA_CLARA,
  PETALA_SOMBRA,
  PETALA_ROSA,
  PETALA_ROSA_SOMBRA,
  MIOLO,
]
