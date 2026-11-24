import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Moita tropical (lote L08 de 24/11/2026, item 78: a folhagem baixa de folha larga que cobre as bordas dos degraus do
 * templo do mapa 6, desenho próprio). Uma touceira baixa de FOLHAS LARGAS E RECORTADAS, em coração, cada uma com os
 * rasgos fundos que entram da beira até perto da nervura (a folha "de janela" da mata), abertas em roda a partir do
 * pé, umas por cima das outras, com duas folhas novas, inteiras e claras, no meio. Cada folha tem as duas metades de
 * tom (a que olha para a luz, clara) e a nervura do meio; por baixo, a massa escura do pé. O que a separa do Arbusto
 * (uma bola de folha miúda) e da Samambaia (frondes finas): poucas folhas GRANDES, de contorno recortado. O giro gira
 * a roda das folhas; a luz não gira.
 */

const MASSA: Rgb = [24, 70, 52]
const FOLHA_ESCURA: Rgb = [38, 102, 66]
const FOLHA_MEDIA: Rgb = [60, 130, 76]
const FOLHA_CLARA: Rgb = [102, 160, 90]
const FOLHA_NOVA: Rgb = [138, 182, 104]
const NERVURA: Rgb = [156, 192, 124]
const TALO: Rgb = [70, 110, 62]

function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

const LUZ_NO_PLANO = { x: -0.6, y: -0.8 }

function voltadoParaALuz(dx: number, dy: number): number {
  const n = Math.hypot(dx, dy) || 1
  return 0.5 + 0.5 * ((dx * LUZ_NO_PLANO.x + dy * LUZ_NO_PLANO.y) / n)
}

type Ponto = readonly [number, number]

/** O pé da touceira e o quanto o chão achata (visto de cima e um pouco de frente). */
const PE = { x: 0, y: -0.06 } as const
const ACHATA = 0.62
/** Amostras ao longo de cada metade da folha. */
const AMOSTRAS = 12

interface Folha {
  a: number
  /** Onde a folha começa (o talo vai do pé até aqui) e o tamanho dela. */
  talo: number
  comprimento: number
  largura: number
  /** Em que amostras cada metade tem um rasgo. */
  rasgos: ReadonlySet<number>
  nova: boolean
}

/** A meia largura da folha em coração ao longo dela (0 no pé, 1 na ponta): o ombro largo perto do pé, a ponta aguda. */
function perfil(t: number): number {
  return Math.pow(Math.sin(Math.PI * Math.pow(t, 0.62)), 0.9) * (1 - 0.18 * t)
}

function desenharFolha(g: CanvasRenderingContext2D, f: Folha): void {
  const dx = Math.cos(f.a)
  const dy = Math.sin(f.a) * ACHATA
  const nx = -Math.sin(f.a)
  const ny = Math.cos(f.a) * ACHATA
  const inicio: Ponto = [PE.x + dx * f.talo, PE.y + dy * f.talo - f.talo * 0.3]
  // A folha arqueia: o meio levanta e a ponta cai.
  const eixo = (t: number): Ponto => [inicio[0] + dx * f.comprimento * t, inicio[1] + dy * f.comprimento * t - Math.sin(Math.PI * t) * 0.05 + t * t * 0.05]
  const borda = (t: number, fator: number, lado: 1 | -1): Ponto => {
    const p = eixo(t)
    const w = f.largura * perfil(t) * fator * lado
    return [p[0] + nx * w, p[1] + ny * w]
  }
  // O talo, do pé até a folha.
  g.strokeStyle = css(TALO)
  g.lineWidth = 0.018
  g.lineCap = 'round'
  g.beginPath()
  g.moveTo(PE.x, PE.y)
  g.quadraticCurveTo(PE.x + dx * f.talo * 0.5, PE.y + dy * f.talo * 0.5 - f.talo * 0.34, inicio[0], inicio[1])
  g.stroke()
  const [claro, escuro] = f.nova ? [FOLHA_NOVA, FOLHA_CLARA] : Math.sin(f.a) < -0.2 ? [FOLHA_MEDIA, FOLHA_ESCURA] : [FOLHA_CLARA, FOLHA_MEDIA]
  for (const lado of [1, -1] as const) {
    g.fillStyle = css(voltadoParaALuz(nx * lado, ny * lado) > 0.5 ? claro : escuro)
    g.beginPath()
    g.moveTo(inicio[0], inicio[1])
    for (let k = 1; k < AMOSTRAS; k++) {
      const t = k / AMOSTRAS
      // O rasgo é uma fenda em cunha que entra da beira até perto da nervura.
      if (f.rasgos.has(k)) {
        const antes = borda(t - 0.036, 1, lado)
        const fundo = borda(t - 0.06, 0.16, lado)
        const depois = borda(t + 0.03, 1, lado)
        g.lineTo(antes[0], antes[1])
        g.lineTo(fundo[0], fundo[1])
        g.lineTo(depois[0], depois[1])
      } else {
        const p = borda(t, 1, lado)
        g.lineTo(p[0], p[1])
      }
    }
    const ponta = eixo(1)
    g.lineTo(ponta[0], ponta[1])
    const meio = eixo(0.5)
    g.lineTo(meio[0], meio[1])
    g.closePath()
    g.fill()
  }
  // A nervura do meio.
  const fim = eixo(0.9)
  const meio = eixo(0.45)
  g.strokeStyle = css(NERVURA, f.nova ? 0.5 : 0.7)
  g.lineWidth = 0.012
  g.beginPath()
  g.moveTo(inicio[0], inicio[1])
  g.quadraticCurveTo(2 * meio[0] - (inicio[0] + fim[0]) / 2, 2 * meio[1] - (inicio[1] + fim[1]) / 2, fim[0], fim[1])
  g.stroke()
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  // A massa escura do pé: o vão entre as folhas.
  g.fillStyle = css(MASSA)
  g.beginPath()
  g.ellipse(PE.x + 0.01, PE.y + 0.02, 0.3, 0.17, 0, 0, Math.PI * 2)
  g.fill()

  const quantas = 7
  const folhas: Folha[] = Array.from({ length: quantas }, (_, i) => {
    const rasgos = new Set<number>()
    for (const k of [3, 5, 7, 9]) if (sorteio(semente, 40 + i * 5 + k) < 0.82) rasgos.add(k)
    return {
      a: giro + (i * Math.PI * 2) / quantas + (sorteio(semente, i) - 0.5) * 0.4,
      talo: 0.07 + 0.05 * sorteio(semente, 10 + i),
      comprimento: 0.38 * (0.86 + 0.26 * sorteio(semente, 20 + i)),
      largura: 0.17 + 0.04 * sorteio(semente, 30 + i),
      rasgos,
      nova: false,
    }
  })
  // Duas folhas novas no meio, inteiras, menores e mais de pé.
  for (let i = 0; i < 2; i++) {
    folhas.push({
      a: giro + 0.9 + i * 2.6 + (sorteio(semente, 90 + i) - 0.5) * 0.6,
      talo: 0.03,
      comprimento: 0.2 + 0.04 * sorteio(semente, 92 + i),
      largura: 0.085,
      rasgos: new Set<number>(),
      nova: true,
    })
  }
  // As de trás primeiro; as novas por cima de todas.
  const velhas = folhas.filter((f) => !f.nova).sort((p, q) => Math.sin(p.a) - Math.sin(q.a))
  for (const f of velhas) desenharFolha(g, f)
  for (const f of folhas.filter((f) => f.nova)) desenharFolha(g, f)
}

export const carimbo: DefinicaoDeCarimbo = { id: 'moita-tropical', nome: 'Moita tropical', tamanho: 8, sombra: 'baixa', desenhar }

export const paleta: readonly Rgb[] = [MASSA, FOLHA_ESCURA, FOLHA_MEDIA, FOLHA_CLARA, FOLHA_NOVA, NERVURA, TALO]
