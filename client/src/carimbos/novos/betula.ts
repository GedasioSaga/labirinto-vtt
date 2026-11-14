import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Bétula (item 118 dos carimbos de 14/11/2026): a árvore do TRONCO BRANCO.
 * Alta e estreita, quase sempre com dois troncos finos saindo do mesmo pé,
 * a casca branca com as marcas escuras atravessadas e o pé escuro e áspero.
 * A copa é leve: tufos pequenos de folha verde-amarelada com vãos, e o branco
 * do tronco aparece por dentro dela (é o que diz "bétula" no tamanho de
 * mesa). O giro troca a arrumação dos tufos e inclina de leve; a semente
 * decide se há o segundo tronco. A luz não gira: o lado esquerdo do tronco
 * branco, o direito no cinza.
 */

const CASCA: Rgb = [226, 222, 208]
const CASCA_SOMBRA: Rgb = [174, 172, 162]
const MARCA: Rgb = [70, 66, 62]
const PE_ESCURO: Rgb = [92, 86, 78]
const GALHO: Rgb = [104, 88, 80]
const FOLHA_ESCURA: Rgb = [70, 114, 62]
const FOLHA_MEDIA: Rgb = [116, 156, 76]
const FOLHA_CLARA: Rgb = [164, 190, 102]

function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

function circulos(g: CanvasRenderingContext2D, lista: ReadonlyArray<readonly [number, number, number]>): void {
  g.beginPath()
  for (const [x, y, r] of lista) {
    g.moveTo(x + r, y)
    g.arc(x, y, r, 0, Math.PI * 2)
  }
  g.fill()
}

interface Tronco {
  /** O pé e o alto do tronco, e a barriga da curva (desvio do meio, em x). */
  pe: readonly [number, number]
  alto: readonly [number, number]
  curva: number
  /** Meia largura no pé e no alto. */
  grosso: number
  fino: number
}

/** O ponto do eixo do tronco a uma altura `t` (0 no pé, 1 no alto), e a meia largura ali. */
function noTronco(t: Tronco, k: number): { x: number; y: number; w: number } {
  const cx = (t.pe[0] + t.alto[0]) / 2 + t.curva
  const cy = (t.pe[1] + t.alto[1]) / 2
  const u = 1 - k
  return {
    x: u * u * t.pe[0] + 2 * u * k * cx + k * k * t.alto[0],
    y: u * u * t.pe[1] + 2 * u * k * cy + k * k * t.alto[1],
    w: t.grosso + (t.fino - t.grosso) * k,
  }
}

/** Um tronco branco: a metade da luz, a da sombra, o pé escuro e as marcas atravessadas. */
function desenharTronco(g: CanvasRenderingContext2D, t: Tronco, semente: number, marcas: number): void {
  const cx = (t.pe[0] + t.alto[0]) / 2 + t.curva
  const cy = (t.pe[1] + t.alto[1]) / 2
  const wMeio = (t.grosso + t.fino) / 2
  g.fillStyle = css(CASCA)
  g.beginPath()
  g.moveTo(t.pe[0], t.pe[1])
  g.lineTo(t.pe[0] - t.grosso, t.pe[1])
  g.quadraticCurveTo(cx - wMeio, cy, t.alto[0] - t.fino, t.alto[1])
  g.lineTo(t.alto[0], t.alto[1])
  g.quadraticCurveTo(cx + wMeio * 0.2, cy, t.pe[0] + t.grosso * 0.2, t.pe[1])
  g.closePath()
  g.fill()
  g.fillStyle = css(CASCA_SOMBRA)
  g.beginPath()
  g.moveTo(t.pe[0] + t.grosso * 0.2, t.pe[1])
  g.quadraticCurveTo(cx + wMeio * 0.2, cy, t.alto[0], t.alto[1])
  g.lineTo(t.alto[0] + t.fino, t.alto[1])
  g.quadraticCurveTo(cx + wMeio, cy, t.pe[0] + t.grosso, t.pe[1])
  g.closePath()
  g.fill()
  // O pé áspero: a casca escurece e racha perto do chão.
  const pe = noTronco(t, 0.06 + 0.03 * sorteio(semente, 3))
  g.fillStyle = css(PE_ESCURO)
  g.beginPath()
  g.moveTo(t.pe[0] - t.grosso, t.pe[1])
  g.lineTo(pe.x - pe.w, pe.y + 0.01)
  g.lineTo(pe.x - pe.w * 0.3, pe.y - 0.02)
  g.lineTo(pe.x + pe.w * 0.2, pe.y + 0.015)
  g.lineTo(pe.x + pe.w, pe.y - 0.01)
  g.lineTo(t.pe[0] + t.grosso, t.pe[1])
  g.closePath()
  g.fill()
  // As marcas: riscos curtos e grossos, de lado a lado só em parte, mais
  // juntas embaixo. Um caminho só.
  g.fillStyle = css(MARCA)
  g.beginPath()
  for (let i = 0; i < marcas; i++) {
    const k = 0.16 + (0.7 * (i + 0.3 * sorteio(semente, 10 + i))) / marcas
    const p = noTronco(t, k)
    const de = -p.w * (0.6 + 0.45 * sorteio(semente, 20 + i))
    const ate = p.w * (sorteio(semente, 30 + i) - 0.1)
    const alto = 0.009 + 0.008 * sorteio(semente, 40 + i)
    g.moveTo(p.x + de, p.y)
    g.lineTo(p.x + (de + ate) / 2, p.y - alto)
    g.lineTo(p.x + ate, p.y - alto * 0.3)
    g.lineTo(p.x + (de + ate) / 2, p.y + alto * 0.6)
    g.closePath()
  }
  g.fill()
}

/** Um galho fino, afinando da base à ponta. */
function galho(g: CanvasRenderingContext2D, de: readonly [number, number], para: readonly [number, number], grosso: number): void {
  const dx = para[0] - de[0]
  const dy = para[1] - de[1]
  const n = Math.hypot(dx, dy) || 1
  const nx = (-dy / n) * grosso
  const ny = (dx / n) * grosso
  g.beginPath()
  g.moveTo(de[0] + nx, de[1] + ny)
  g.quadraticCurveTo(de[0] + dx * 0.5 + nx * 0.4, de[1] + dy * 0.5 + ny * 0.4 - 0.02, para[0], para[1])
  g.quadraticCurveTo(de[0] + dx * 0.5 - nx * 0.4, de[1] + dy * 0.5 - ny * 0.4 - 0.02, de[0] - nx, de[1] - ny)
  g.closePath()
  g.fill()
}

/** A copa leve: o oval dos tufos, um pouco à direita do pé. */
const COPA = { cx: -0.01, cy: -0.7, rx: 0.34, ry: 0.4 } as const

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  g.save()
  g.rotate(Math.sin(giro) * 0.05)
  const doisTroncos = sorteio(semente, 1) < 0.75
  const principal: Tronco = { pe: [0, 0.01], alto: [-0.03, -1.0], curva: -0.025, grosso: doisTroncos ? 0.046 : 0.056, fino: 0.012 }
  const segundo: Tronco = { pe: [0.03, -0.04], alto: [0.13, -0.84], curva: 0.02, grosso: 0.032, fino: 0.01 }

  // Os tufos: uma espiral de pontos no oval (o giro gira a espiral), cada um
  // com o tamanho sorteado.
  const tufos = Array.from({ length: 20 }, (_, i) => {
    const raio = Math.sqrt((i + 0.6) / 20)
    const a = giro + i * 2.39996
    return {
      x: COPA.cx + Math.cos(a) * COPA.rx * raio * 0.84,
      y: COPA.cy + Math.sin(a) * COPA.ry * raio * 0.84,
      r: 0.075 + 0.04 * sorteio(semente, 50 + i),
    }
  })
  // 1. O fundo da copa, no verde escuro (o miolo que a luz não alcança).
  g.fillStyle = css(FOLHA_ESCURA)
  circulos(g, tufos.map((t) => [t.x + 0.012, t.y + 0.02, t.r] as [number, number, number]))

  // 2. Os troncos e os galhos, por cima do fundo: o branco aparece por dentro da copa.
  g.fillStyle = css(GALHO)
  const galhos: Array<[readonly [number, number], readonly [number, number], number]> = [
    [[-0.035, -0.62], [-0.22, -0.84], 0.012],
    [[-0.035, -0.46], [-0.24, -0.6], 0.011],
    [[-0.03, -0.8], [0.1, -0.98], 0.009],
  ]
  if (doisTroncos) galhos.push([[0.1, -0.64], [0.25, -0.78], 0.01])
  else galhos.push([[-0.03, -0.55], [0.22, -0.7], 0.011])
  for (const [de, para, grosso] of galhos) galho(g, de, para, grosso)
  if (doisTroncos) desenharTronco(g, segundo, semente + 4, 5)
  desenharTronco(g, principal, semente, 8)

  // 3. Os tufos da frente no verde médio, menos os que tampariam o tronco no
  // meio da copa; 4. a luz, só nos tufos do alto e da esquerda.
  const longeDoTronco = (t: { x: number; y: number }) => t.y < COPA.cy - 0.05 || Math.abs(t.x + 0.025) > 0.08
  const frente = tufos.filter(longeDoTronco)
  g.fillStyle = css(FOLHA_MEDIA)
  circulos(g, frente.map((t) => [t.x - 0.01, t.y - 0.015, t.r * 0.86] as [number, number, number]))
  g.fillStyle = css(FOLHA_CLARA)
  circulos(
    g,
    frente.filter((t) => t.x - COPA.cx < 0.1 - (t.y - COPA.cy) * 0.5).map((t) => [t.x - 0.03, t.y - 0.035, t.r * 0.48] as [number, number, number]),
  )
  g.restore()
}

export const carimbo: DefinicaoDeCarimbo = { id: 'betula', nome: 'Bétula', tamanho: 14, sombra: 'em-pe', desenhar }

export const paleta: readonly Rgb[] = [CASCA, CASCA_SOMBRA, MARCA, PE_ESCURO, GALHO, FOLHA_ESCURA, FOLHA_MEDIA, FOLHA_CLARA]
