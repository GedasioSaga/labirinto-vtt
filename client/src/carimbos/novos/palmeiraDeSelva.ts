import { css, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Palmeira de selva (lote L08 de 24/11/2026, item 77: versão da Palmeira; as palmeiras do templo do mapa 6, desenho
 * próprio). O que a separa da Palmeira de praia (o tronco fino e curvo, sete folhas estreitas e os cocos): a COPA
 * CHEIA, de dez folhas LARGAS e SERRILHADAS em duas voltas (as de baixo compridas e caídas, as de cima curtas e
 * claras), cada folha com as duas metades de tom e a nervura clara; o tronco mais grosso, reto, com os anéis das
 * folhas que caíram; no olho da copa, o broto novo; e nenhum coco. Em algumas sementes o pé mostra as RAÍZES à
 * mostra, abertas no chão (as do alto do templo, por cima da pedra). O giro gira o leque das folhas e o das raízes;
 * a planta só inclina de leve. A luz não gira.
 */

const TRONCO: Rgb = [128, 102, 70]
const TRONCO_SOMBRA: Rgb = [92, 72, 50]
const ANEL: Rgb = [74, 58, 42]
const RAIZ: Rgb = [116, 92, 64]
const RAIZ_SOMBRA: Rgb = [80, 62, 44]
const FOLHA_CLARA: Rgb = [94, 150, 86]
const FOLHA_MEDIA: Rgb = [58, 122, 72]
const FOLHA_ESCURA: Rgb = [30, 90, 62]
const NERVURA: Rgb = [142, 178, 110]
const BROTO: Rgb = [128, 170, 96]

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

/** O olho da copa, no alto do tronco. */
const ALTO = { x: 0.03, y: -0.72 } as const
/** O chão visto de cima e um pouco de frente: o leque das folhas e o das raízes achatam assim. */
const ACHATA = 0.6
/** Amostras ao longo de cada metade da folha: os dentes da serrilha. */
const DENTES = 14
/** De cada quantas sementes uma mostra as raízes (as de número que deixa este resto). */
const RAIZES_A_CADA = 3

interface Folha {
  a: number
  comprimento: number
  largura: number
  /** Quanto a ponta cai (as de baixo caem mais). */
  cai: number
  /** A volta de cima (curta e clara) ou a de baixo. */
  deCima: boolean
}

function noArco(a: Ponto, c: Ponto, b: Ponto, t: number): Ponto {
  const u = 1 - t
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]
}

function desenharFolha(g: CanvasRenderingContext2D, f: Folha): void {
  const dx = Math.cos(f.a)
  const dy = Math.sin(f.a) * ACHATA
  // A nervura: sai do olho, sobe arqueando e cai na ponta.
  const base: Ponto = [ALTO.x + dx * 0.03, ALTO.y + dy * 0.03]
  const curva: Ponto = [ALTO.x + dx * f.comprimento * 0.5, ALTO.y + dy * f.comprimento * 0.5 - (f.deCima ? 0.2 : 0.13)]
  const ponta: Ponto = [ALTO.x + dx * f.comprimento, ALTO.y + dy * f.comprimento + f.cai]
  const normalEm = (t: number): Ponto => {
    const q = noArco(base, curva, ponta, Math.min(1, t + 0.02))
    const r = noArco(base, curva, ponta, Math.max(0, t - 0.02))
    const tx = q[0] - r[0]
    const ty = q[1] - r[1]
    const n = Math.hypot(tx, ty) || 1
    return [-ty / n, tx / n]
  }
  // Larga no meio, afinando para o pé e para a ponta; a serrilha tira um dente a cada duas amostras.
  const largura = (t: number): number => f.largura * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.8)), 0.85)
  const borda = (k: number, lado: 1 | -1): Ponto => {
    const t = k / DENTES
    const p = noArco(base, curva, ponta, t)
    const n = normalEm(t)
    const w = largura(t) * (k % 2 === 0 ? 0.66 : 1) * lado
    return [p[0] + n[0] * w, p[1] + n[1] * w]
  }
  const meio = normalEm(0.5)
  const [claro, escuro] = f.deCima ? [FOLHA_CLARA, FOLHA_MEDIA] : Math.sin(f.a) < -0.25 ? [FOLHA_MEDIA, FOLHA_ESCURA] : [FOLHA_CLARA, FOLHA_ESCURA]
  for (const lado of [1, -1] as const) {
    g.fillStyle = css(voltadoParaALuz(meio[0] * lado, meio[1] * lado) > 0.5 ? claro : escuro)
    g.beginPath()
    g.moveTo(base[0], base[1])
    for (let k = 1; k < DENTES; k++) {
      const p = borda(k, lado)
      g.lineTo(p[0], p[1])
    }
    g.lineTo(ponta[0], ponta[1])
    for (let k = DENTES - 1; k >= 0; k -= 2) {
      const p = noArco(base, curva, ponta, k / DENTES)
      g.lineTo(p[0], p[1])
    }
    g.closePath()
    g.fill()
  }
  // A nervura clara, do pé até perto da ponta.
  const fim = noArco(base, curva, ponta, 0.86)
  const meioDaNervura = noArco(base, curva, ponta, 0.43)
  g.strokeStyle = css(NERVURA, 0.7)
  g.lineWidth = 0.012
  g.lineCap = 'round'
  g.beginPath()
  g.moveTo(base[0], base[1])
  g.quadraticCurveTo(2 * meioDaNervura[0] - (base[0] + fim[0]) / 2, 2 * meioDaNervura[1] - (base[1] + fim[1]) / 2, fim[0], fim[1])
  g.stroke()
}

/** As raízes à mostra: dedos que saem do pé do tronco e se abrem no chão, cada um com a metade da luz e a da sombra. */
function desenharRaizes(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const quantas = 6
  for (let i = 0; i < quantas; i++) {
    const a = giro * 0.5 + 0.3 + (i * Math.PI * 2) / quantas + (sorteio(semente, 60 + i) - 0.5) * 0.5
    const comprida = 0.2 + 0.1 * sorteio(semente, 70 + i)
    const dx = Math.cos(a)
    const dy = Math.sin(a) * ACHATA
    const ponta: Ponto = [dx * comprida, dy * comprida + 0.02]
    const pe: Ponto = [dx * 0.03, -0.05 + dy * 0.03]
    const nx = -dy
    const ny = dx
    const n = Math.hypot(nx, ny) || 1
    const grossa = 0.032
    const cotovelo: Ponto = [dx * comprida * 0.5, dy * comprida * 0.5 - 0.035]
    for (const lado of [1, -1] as const) {
      g.fillStyle = css(voltadoParaALuz((nx / n) * lado, (ny / n) * lado) > 0.5 ? RAIZ : RAIZ_SOMBRA)
      g.beginPath()
      g.moveTo(pe[0], pe[1])
      g.quadraticCurveTo(cotovelo[0] + (nx / n) * grossa * lado, cotovelo[1] + (ny / n) * grossa * lado, ponta[0], ponta[1])
      g.quadraticCurveTo(cotovelo[0], cotovelo[1], pe[0], pe[1])
      g.closePath()
      g.fill()
    }
  }
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  if (semente % RAIZES_A_CADA === 1) desenharRaizes(g, giro, semente)
  g.save()
  g.rotate(Math.sin(giro) * 0.035)
  // O tronco: grosso e reto, mais largo no pé; a metade da esquerda na luz, a da direita na sombra.
  g.fillStyle = css(TRONCO)
  g.beginPath()
  g.moveTo(-0.062, 0.012)
  g.quadraticCurveTo(-0.04, -0.3, ALTO.x - 0.034, ALTO.y + 0.03)
  g.lineTo(ALTO.x, ALTO.y + 0.03)
  g.lineTo(0, 0.02)
  g.closePath()
  g.fill()
  g.fillStyle = css(TRONCO_SOMBRA)
  g.beginPath()
  g.moveTo(0, 0.02)
  g.lineTo(ALTO.x, ALTO.y + 0.03)
  g.lineTo(ALTO.x + 0.034, ALTO.y + 0.03)
  g.quadraticCurveTo(0.046, -0.3, 0.064, 0.014)
  g.closePath()
  g.fill()
  // Os anéis das folhas que caíram: riscos curtos de través, mais juntos no alto.
  g.strokeStyle = css(ANEL, 0.6)
  g.lineWidth = 0.011
  g.lineCap = 'round'
  g.beginPath()
  for (let i = 0; i < 7; i++) {
    const t = 0.1 + 0.12 * i
    const y = ALTO.y * t
    const meia = 0.055 - 0.022 * t
    const x = ALTO.x * t
    g.moveTo(x - meia, y - 0.004)
    g.quadraticCurveTo(x, y + 0.012, x + meia, y - 0.004)
  }
  g.stroke()

  // As folhas: seis na volta de baixo, compridas e caídas, e quatro na de cima, curtas e claras.
  const folhas: Folha[] = []
  for (let i = 0; i < 6; i++) {
    folhas.push({
      a: giro + (i * Math.PI * 2) / 6 + (sorteio(semente, i) - 0.5) * 0.36,
      comprimento: 0.56 * (0.9 + 0.2 * sorteio(semente, 10 + i)),
      largura: 0.1 + 0.02 * sorteio(semente, 20 + i),
      cai: 0.15 + 0.05 * sorteio(semente, 30 + i),
      deCima: false,
    })
  }
  for (let i = 0; i < 4; i++) {
    folhas.push({
      a: giro + Math.PI / 6 + (i * Math.PI * 2) / 4 + (sorteio(semente, 40 + i) - 0.5) * 0.5,
      comprimento: 0.36 * (0.9 + 0.2 * sorteio(semente, 44 + i)),
      largura: 0.08 + 0.016 * sorteio(semente, 48 + i),
      cai: 0.04,
      deCima: true,
    })
  }
  // As de baixo primeiro (dentro delas, as de trás antes); depois as de cima; o broto por último.
  const emOrdem = (lista: Folha[]): Folha[] => [...lista].sort((p, q) => Math.sin(p.a) - Math.sin(q.a))
  for (const f of emOrdem(folhas.filter((f) => !f.deCima))) desenharFolha(g, f)
  for (const f of emOrdem(folhas.filter((f) => f.deCima))) desenharFolha(g, f)
  // O olho da copa: o broto novo, fechado e de pé.
  g.fillStyle = css(FOLHA_ESCURA)
  g.beginPath()
  g.ellipse(ALTO.x + 0.008, ALTO.y + 0.006, 0.05, 0.036, 0, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = css(BROTO)
  g.beginPath()
  g.moveTo(ALTO.x - 0.022, ALTO.y)
  g.quadraticCurveTo(ALTO.x - 0.014, ALTO.y - 0.12, ALTO.x + 0.01, ALTO.y - 0.15)
  g.quadraticCurveTo(ALTO.x + 0.02, ALTO.y - 0.07, ALTO.x + 0.016, ALTO.y)
  g.closePath()
  g.fill()
  g.restore()
}

export const carimbo: DefinicaoDeCarimbo = { id: 'palmeira-de-selva', nome: 'Palmeira de selva', tamanho: 14, sombra: 'em-pe', desenhar }

export const paleta: readonly Rgb[] = [TRONCO, TRONCO_SOMBRA, ANEL, RAIZ, RAIZ_SOMBRA, FOLHA_CLARA, FOLHA_MEDIA, FOLHA_ESCURA, NERVURA, BROTO]
