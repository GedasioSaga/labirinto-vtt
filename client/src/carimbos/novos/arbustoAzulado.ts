import { css, misturar, type DefinicaoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Arbusto azulado (referências de 15/11/2026, lote L3: "o que falta das 4
 * referências", versão original no estilo Meio-Termo): uma moita baixa e
 * larga de folha miúda e cerosa, azul-acinzentada como o junípero e o
 * cipreste-azul. O que a separa do Arbusto (uma copa redonda de lóbulos
 * grandes) é a FORMA, além da cor: três montes encostados, de borda
 * recortada fina (mais lóbulos, menores), e a geada da folha, uns pontinhos
 * claros onde a luz bate. Cada monte em camadas chapadas de tom, como a copa
 * de `embutidos.ts`: o escuro inteiro, o meio-tom para cima à esquerda e o
 * claro no alto; o monte de trás um nada mais escuro, o da frente à esquerda
 * mais aceso. O giro gira a moita em volta do pé e o recorte de cada monte;
 * a luz não gira.
 */

/** O pé da moita, por baixo dos montes: o azul mais fundo, onde a luz não chega. */
const SOMBRA_DO_PE: Rgb = [38, 62, 72]
/**
 * A folha: azul-acinzentado com um fio de verde (puro azul lia como plástico ao lado da mata), clara e cerosa. Na
 * primeira folha (15/11/2026) os tons eram um passo mais fundos e a moita lia como pedra azul-escura.
 */
const FOLHA_ESCURA: Rgb = [60, 94, 106]
const FOLHA_MEIA: Rgb = [94, 130, 140]
const FOLHA_CLARA: Rgb = [138, 168, 174]
/** A geada da folha cerosa: o claro frio das pontas. */
const GEADA: Rgb = [180, 200, 202]

/** O chão visto de cima e um pouco de frente (o das pedras). */
const ACHATA = 0.55
/** Onde o pé da moita fica no quadro, e o quanto os montes se afastam do meio. */
const PE_Y = -0.02
const AFASTA = 0.17
/** Lóbulos por monte: mais e menores que os do Arbusto, para a borda ler folha miúda. */
const LOBULOS = 11
/** Pontinhos de geada por monte. */
const GEADA_POR_MONTE = 5
/** Escurece (negativo) ou acende o tom de cada monte, de trás para a frente. */
const LUZ_DOS_MONTES = [-0.12, 0.08, -0.04] as const
/** O raio de cada monte (o de trás é o maior), antes do sorteio. */
const RAIOS = [0.25, 0.21, 0.19] as const

/** Sorteio fixo de 0 a 1 por semente e índice: o mesmo desenho em toda tela. */
function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

/** Clareia (`f` > 0) ou escurece (`f` < 0) o tom, como o `luz` de `embutidos.ts`. */
function comLuz(c: Rgb, f: number): Rgb {
  return f >= 0 ? misturar(c, [236, 238, 226], f) : misturar(c, [8, 18, 22], -f)
}

/** Vários círculos num caminho só: o preenchimento é a união deles, sem emenda. */
function circulos(g: CanvasRenderingContext2D, lista: ReadonlyArray<readonly [number, number, number]>): void {
  g.beginPath()
  for (const [x, y, r] of lista) {
    g.moveTo(x + r, y)
    g.arc(x, y, r, 0, Math.PI * 2)
  }
  g.fill()
}

/** A silhueta de um monte: o miolo e os lóbulos em volta, achatados de leve na vertical (a moita vista de cima). */
function lobulos(cx: number, cy: number, raio: number, giro: number, semente: number, encolher: number): Array<[number, number, number]> {
  const lista: Array<[number, number, number]> = [[cx, cy, raio * 0.64 * encolher]]
  for (let i = 0; i < LOBULOS; i++) {
    const a = giro + (i * Math.PI * 2) / LOBULOS + (sorteio(semente, i) - 0.5) * 0.45
    const r = raio * (0.26 + 0.1 * sorteio(semente, i + 20)) * encolher
    const d = raio * 0.68 * encolher
    lista.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.86, r])
  }
  return lista
}

interface Monte {
  readonly x: number
  /** O pé do monte no chão (o y da tela). */
  readonly pe: number
  readonly raio: number
  readonly luz: number
  readonly giro: number
  readonly semente: number
}

function desenharMonte(g: CanvasRenderingContext2D, m: Monte): void {
  // O monte assenta no chão: o meio dele fica um raio acima do pé, um pouco menos (a moita é baixa).
  const cy = m.pe - m.raio * 0.72
  g.fillStyle = css(comLuz(FOLHA_ESCURA, m.luz))
  circulos(g, lobulos(m.x, cy, m.raio, m.giro, m.semente, 1))
  g.fillStyle = css(comLuz(FOLHA_MEIA, m.luz))
  circulos(g, lobulos(m.x - m.raio * 0.12, cy - m.raio * 0.16, m.raio, m.giro, m.semente, 0.76))
  g.fillStyle = css(comLuz(FOLHA_CLARA, m.luz))
  circulos(g, lobulos(m.x - m.raio * 0.32, cy - m.raio * 0.36, m.raio, m.giro + 0.7, m.semente + 3, 0.38))
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const montes: Monte[] = RAIOS.map((raio, i) => {
    const a = giro + (i * Math.PI * 2) / 3 + (sorteio(semente, 40 + i) - 0.5) * 0.5
    const d = AFASTA * (0.85 + 0.3 * sorteio(semente, 44 + i))
    return {
      x: Math.cos(a) * d,
      pe: PE_Y + Math.sin(a) * d * ACHATA,
      raio: raio * (0.92 + 0.16 * sorteio(semente, 48 + i)),
      luz: LUZ_DOS_MONTES[i],
      giro: giro * 1.3 + i * 2.2,
      semente: semente * 3 + i * 11,
    }
  }).sort((p, q) => p.pe - q.pe)
  // O pé da moita: o escuro rente ao chão, por baixo dos montes da frente (a costura com o chão).
  g.fillStyle = css(SOMBRA_DO_PE)
  g.beginPath()
  g.ellipse(0.02, PE_Y - 0.03, AFASTA + 0.12, 0.09, 0, 0, Math.PI * 2)
  g.fill()
  for (const m of montes) desenharMonte(g, m)
  // A geada: pontinhos claros na metade de cima à esquerda de cada monte, onde a luz bate na folha cerosa.
  g.fillStyle = css(GEADA)
  g.beginPath()
  montes.forEach((m, i) => {
    const cy = m.pe - m.raio * 0.72
    for (let k = 0; k < GEADA_POR_MONTE; k++) {
      const n = i * GEADA_POR_MONTE + k
      const a = Math.PI * (0.95 + 0.6 * ((k + sorteio(semente, 60 + n)) / GEADA_POR_MONTE))
      const d = m.raio * (0.3 + 0.45 * sorteio(semente, 90 + n))
      const x = m.x - m.raio * 0.1 + Math.cos(a) * d
      const y = cy - m.raio * 0.1 + Math.sin(a) * d * 0.86
      // Miúdos: maiores, os pontinhos liam como bolha d'água em cima da moita.
      const r = m.raio * (0.035 + 0.03 * sorteio(semente, 120 + n))
      g.moveTo(x + r, y)
      g.arc(x, y, r, 0, Math.PI * 2)
    }
  })
  g.fill()
}

export const carimbo: DefinicaoDeCarimbo = { id: 'arbusto-azulado', nome: 'Arbusto azulado', tamanho: 7, sombra: 'baixa', desenhar }

/** Todas as cores chapadas do desenho (os montes acesos e apagados saem destas, misturadas). */
export const paleta: readonly Rgb[] = [SOMBRA_DO_PE, FOLHA_ESCURA, FOLHA_MEIA, FOLHA_CLARA, GEADA]
