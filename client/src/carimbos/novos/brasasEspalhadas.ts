import { css, type DefinicaoDeCarimbo, type DesenhoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Brasas espalhadas (lote L03 de 24/11/2026, Tortura e fogo; versão da Fenda
 * em brasa, desenho ORIGINAL): um punhado de CARVÃO e brasas soltas, do que
 * cai para fora do fosso e dos braseiros. Torrões escuros e lascados, de
 * tamanhos misturados (os maiores no meio, as migalhas na beira), sobre uma
 * mancha rala de cinza; metade deles ainda tem uma face em brasa.
 *
 * DOIS desenhos no mesmo quadro e no mesmo giro, como a Fenda em brasa:
 * `desenhar` é o punhado com a brasa APAGADA (o vermelho-escuro da brasa
 * morna, a cara dele de dia); `brilho` é SÓ o que acende (a face em brasa de
 * cada torrão aceso, o miolo dela e as fagulhas), somado por cima e pulsando
 * no app. Nada do `brilho` sai de dentro dos torrões: ele é somado por cima de
 * todos os corpos no palco. O brilho é fraco; quem ilumina em volta é a
 * entrada em `LUZ_DOS_CARIMBOS` (luz curta). É do chão (`sombra: 'nenhuma'`):
 * a sombrinha de cada torrão é pintada aqui, para ele não parecer mancha.
 * O giro gira o punhado; a luz não gira.
 */

/** A cinza rala em volta (por cima do chão do mapa, meio transparente). */
const CINZA_NO_CHAO: Rgb = [112, 106, 98]
/** A sombrinha de cada torrão no chão. */
const SOMBRA: Rgb = [30, 24, 22]
/** O carvão: o corpo, a face de cima (do lado da luz) e a quina com cinza. */
const CARVAO: Rgb = [54, 48, 44]
const CARVAO_CLARO: Rgb = [88, 81, 75]
const QUINA_DE_CINZA: Rgb = [138, 131, 122]
/** A brasa morna, apagada: o que a face acesa mostra de dia (a da Fenda em brasa). */
const BRASA_APAGADA: Rgb = [118, 54, 44]
/** O que acende: a borda da chama do app (`0xa04a2c`) e o miolo alaranjado. Só no `brilho`, fora da paleta. */
const BORDA_DA_CHAMA: Rgb = [160, 74, 44]
const MIOLO_DA_BRASA: Rgb = [236, 146, 92]

/** O chão visto de cima e um pouco de frente (o das pedras). */
const ACHATA = 0.55
/** O meio do punhado no quadro. */
const MEIO_Y = -0.07
const QUANTOS = 11
const MIGALHAS = 11
const RAIO_DO_PUNHADO = 0.45
const ANGULO_DE_OURO = 2.39996
const LADOS = 6
/** A parte dos torrões que tem uma face em brasa. */
const PARTE_ACESA = 0.55

type P = readonly [number, number]

/** Sorteio fixo de 0 a 1 por semente e índice: o mesmo desenho em toda tela. */
function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

interface Torrao {
  readonly x: number
  readonly y: number
  readonly r: number
  /** O contorno lascado, em volta de (x, y). */
  readonly contorno: readonly P[]
  readonly acesa: boolean
}

/** Os torrões do punhado, já no lugar da tela, do fundo para a frente. */
function torroesDe(giro: number, semente: number): Torrao[] {
  const torroes: Torrao[] = []
  for (let i = 0; i < QUANTOS; i++) {
    // Em espiral (o ângulo de ouro): os maiores no meio, os miúdos na beira, sem fila.
    const t = (i + 0.5) / QUANTOS
    const rho = RAIO_DO_PUNHADO * Math.sqrt(t) * (0.8 + 0.34 * sorteio(semente, i))
    const a = giro + i * ANGULO_DE_OURO + (sorteio(semente, 10 + i) - 0.5) * 0.7
    const x = Math.cos(a) * rho
    const y = MEIO_Y + Math.sin(a) * rho * ACHATA
    const r = 0.104 * (1 - 0.5 * Math.sqrt(t)) * (0.78 + 0.5 * sorteio(semente, 20 + i))
    const torto = sorteio(semente, 30 + i) * Math.PI * 2
    const contorno: P[] = []
    for (let q = 0; q < LADOS; q++) {
      const ang = torto + (q / LADOS) * Math.PI * 2
      const d = r * (0.7 + 0.5 * sorteio(semente, 40 + i * LADOS + q))
      contorno.push([x + Math.cos(ang) * d, y + Math.sin(ang) * d * 0.72])
    }
    torroes.push({ x, y, r, contorno, acesa: sorteio(semente, 120 + i) < PARTE_ACESA })
  }
  return torroes.sort((p, q) => p.y - q.y)
}

/** O contorno encolhido `f` vezes em volta de um ponto deslocado (dx, dy) raios do meio: uma face do torrão. */
function face(t: Torrao, f: number, dx: number, dy: number): P[] {
  const [cx, cy] = [t.x + dx * t.r, t.y + dy * t.r]
  return t.contorno.map(([x, y]): P => [cx + (x - t.x) * f, cy + (y - t.y) * f])
}

function preencher(g: CanvasRenderingContext2D, pontos: readonly P[], cor: string): void {
  g.fillStyle = cor
  g.beginPath()
  pontos.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)))
  g.closePath()
  g.fill()
}

function oval(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, cor: string): void {
  g.fillStyle = cor
  g.beginPath()
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  g.fill()
}

/** As migalhas da beira: x, y, raio e se é fagulha (acende). */
function migalhasDe(giro: number, semente: number): { x: number; y: number; r: number; fagulha: boolean }[] {
  return Array.from({ length: MIGALHAS }, (_, i) => {
    const a = giro + i * ANGULO_DE_OURO * 1.7 + sorteio(semente, 200 + i) * 1.2
    const rho = RAIO_DO_PUNHADO * (0.45 + 0.75 * sorteio(semente, 210 + i))
    return { x: Math.cos(a) * rho, y: MEIO_Y + Math.sin(a) * rho * ACHATA, r: 0.011 + 0.011 * sorteio(semente, 220 + i), fagulha: sorteio(semente, 230 + i) < 0.4 }
  })
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const torroes = torroesDe(giro, semente)
  // A cinza rala, em manchas debaixo de tudo.
  for (let i = 0; i < 5; i++) {
    const a = giro + i * 1.9 + sorteio(semente, 300 + i)
    const rho = RAIO_DO_PUNHADO * 0.42 * sorteio(semente, 310 + i)
    const r = RAIO_DO_PUNHADO * (0.5 + 0.3 * sorteio(semente, 320 + i))
    oval(g, Math.cos(a) * rho, MEIO_Y + Math.sin(a) * rho * ACHATA, r, r * ACHATA, css(CINZA_NO_CHAO, 0.13))
  }
  for (const m of migalhasDe(giro, semente)) oval(g, m.x, m.y, m.r, m.r * 0.72, css(m.fagulha ? BRASA_APAGADA : CARVAO))
  for (const t of torroes) {
    oval(g, t.x + t.r * 0.22, t.y + t.r * 0.3, t.r * 0.98, t.r * 0.6, css(SOMBRA, 0.34))
    preencher(g, t.contorno, css(CARVAO))
    preencher(g, face(t, 0.62, -0.2, -0.24), css(CARVAO_CLARO))
    preencher(g, face(t, 0.22, -0.46, -0.44), css(QUINA_DE_CINZA))
    if (t.acesa) preencher(g, face(t, 0.4, 0.3, 0.26), css(BRASA_APAGADA))
  }
}

/** Só o que acende: a face em brasa de cada torrão aceso, o miolo dela e as fagulhas. */
const desenharBrilho: DesenhoDeCarimbo = (g, giro, semente) => {
  for (const m of migalhasDe(giro, semente)) if (m.fagulha) oval(g, m.x, m.y, m.r, m.r * 0.72, css(BORDA_DA_CHAMA, 0.9))
  for (const t of torroesDe(giro, semente)) {
    if (!t.acesa) continue
    preencher(g, face(t, 0.4, 0.3, 0.26), css(BORDA_DA_CHAMA, 0.92))
    preencher(g, face(t, 0.2, 0.3, 0.26), css(MIOLO_DA_BRASA, 0.9))
  }
}

export const carimbo: DefinicaoDeCarimbo = { id: 'brasas-espalhadas', nome: 'Brasas espalhadas', tamanho: 8, sombra: 'nenhuma', desenhar }

export const brilho: DesenhoDeCarimbo = desenharBrilho

/** Todas as cores chapadas do desenho (as do `brilho` ficam fora, como pede o briefing dos carimbos). */
export const paleta: readonly Rgb[] = [CINZA_NO_CHAO, SOMBRA, CARVAO, CARVAO_CLARO, QUINA_DE_CINZA, BRASA_APAGADA]
