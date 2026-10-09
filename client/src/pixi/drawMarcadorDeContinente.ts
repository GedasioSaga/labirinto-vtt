// Pino do jogador no MAPA DE CONTINENTE: pose e desenho (variação A, "Cristal",
// aprovada pelo usuário em 09/10/2026 — protótipo e folha de contato no pedido).
//
// PURO: não importa o Pixi. Desenha num pincel recebido de fora (o Graphics do
// Pixi v8 serve, pela forma) usando só poly, ellipse, moveTo, lineTo, fill e
// stroke, em px de TELA. Quem chama põe o pino num Container com escala inversa
// ao zoom (`lib/marcadorDeContinente.ts` → `escalaDoMarcador`); por isso ele
// tem o mesmo tamanho em qualquer zoom, como um marcador de GPS.
//
// "3D falso": os vértices de cada sólido giram no eixo vertical, a câmera olha
// um pouco de cima (INCLINACAO) e a projeção é ortográfica. Face de costas para
// a câmera não entra; cada face de frente ganha um tom pela normal contra uma
// luz fixa; a silhueta do sólido ganha um contorno escuro fino, que separa o
// pino de qualquer região do mapa (mar, areia, gelo).
//
// Camadas, de trás para a frente:
//   chão  - sombra elíptica; encolhe e clareia quando o pino sobe
//   giro  - a pirâmide invertida, que gira
//   corpo - o cristal parado em cima
// Na tela cada camada é um Graphics: só o giro é redesenhado a cada quadro;
// corpo e chão só mudam de posição, escala e transparência (`camadasDaPose`).
// `desenharMarcador` junta as três num pincel só (testes e folha de contato).
//
// Origem (0, 0) = ponto do chão onde a ficha está; o pino cresce para y < 0.
// As funções de camada NÃO limpam o pincel; `desenharMarcador` limpa.

/** O pedaço do Graphics do Pixi v8 que o desenho usa. */
export interface PincelDoMarcador {
  clear(): unknown
  poly(pontos: number[], fechar?: boolean): PincelDoMarcador
  ellipse(x: number, y: number, raioX: number, raioY: number): PincelDoMarcador
  moveTo(x: number, y: number): PincelDoMarcador
  lineTo(x: number, y: number): PincelDoMarcador
  fill(estilo: { color: number; alpha?: number }): PincelDoMarcador
  stroke(estilo: { width: number; color: number; alpha?: number; join?: 'round'; cap?: 'round' }): PincelDoMarcador
}

/**
 * Giro linear (uma volta a cada `voltaMs`) e flutuar senoidal (vai e volta a
 * cada `flutuarMs`, `flutuarPx` para cima e para baixo). Contínuos, sem rebote:
 * movimento constante, então linear — nada de curva de entrada e saída.
 */
export const MOVIMENTO_DO_MARCADOR = { voltaMs: 6000, flutuarMs: 3600, flutuarPx: 1.5 }

/** Com "Reduzir movimento" a pirâmide fica parada neste ângulo (30°: mostra duas faces). */
export const ANGULO_PARADO = Math.PI / 6

/** Topo do nome do personagem, abaixo do ponto do chão, em px de tela. */
export const ROTULO_Y = 9

/** Estilo do nome no pino. */
export interface EstiloDoRotulo {
  fontFamily: string
  fontSize: number
  fill: number
  stroke: { color: number; width: number; join: 'round' }
}

/**
 * Nome no estilo do nome da ficha (12 px, branco), com contorno escuro de 3 px:
 * o mapa de continente é claro em boa parte (gelo, areia), onde o branco puro
 * sumia no protótipo. Só no pino; a ficha de sempre segue com o nome dela.
 */
export const ESTILO_ROTULO: EstiloDoRotulo = {
  fontFamily: 'Arial',
  fontSize: 12,
  fill: 0xffffff,
  stroke: { color: 0x0b1220, width: 3, join: 'round' },
}

/**
 * Área de toque do pino com o nome, em px de tela relativos ao ponto do chão:
 * 48 px de largura, da ponta do cristal (46 px acima) até o fim do nome.
 * A mesma no mestre (`findTokenAt`, seleção por área) e no jogador (hitArea).
 */
export const AREA_DE_TOQUE = { x: -24, y: -52, largura: 48, altura: 78 }

const INCLINACAO = (24 * Math.PI) / 180 // a câmera olha um pouco de cima
const COS_I = Math.cos(INCLINACAO)
const SEN_I = Math.sin(INCLINACAO)
const CONTORNO = 0x0b1220

type Vetor = readonly [number, number, number]
type PontoDeTela = readonly [number, number]

interface Solido {
  vertices: readonly Vetor[]
  faces: readonly (readonly number[])[]
}

const LUZ = normalizar([-0.5, 0.45, 0.75]) // de cima, da esquerda, da frente
const ESCURO: Vetor = [11 / 255, 18 / 255, 32 / 255] // a sombra puxa para o azul do mar, não para o preto
const BRANCO: Vetor = [1, 1, 1]

// ---------------------------------------------------------------- pose

export interface PoseDoMarcador {
  /** Ângulo da pirâmide, em rad [0, 2π). */
  angulo: number
  /** Altura do flutuar, em px de tela; positivo = para cima. */
  flutuar: number
}

/**
 * Pose do pino num instante. Pura: mesma entrada, mesma saída.
 * `fase` em voltas (0..1) desencontra os pinos, para não girarem nem flutuarem juntos.
 */
export function poseMarcador(tempoMs: number, { reduzirMovimento = false, fase = 0 }: { reduzirMovimento?: boolean; fase?: number } = {}): PoseDoMarcador {
  if (reduzirMovimento) return { angulo: ANGULO_PARADO, flutuar: 0 }
  const m = MOVIMENTO_DO_MARCADOR
  const voltas = tempoMs / m.voltaMs + fase
  const angulo = (voltas - Math.floor(voltas)) * 2 * Math.PI
  // 1,618 (razão áurea) desencontra o flutuar do giro entre pinos de fases diferentes.
  const flutuar = m.flutuarPx * Math.sin(2 * Math.PI * (tempoMs / m.flutuarMs + fase * 1.618))
  return { angulo, flutuar }
}

/**
 * Fase estável por ficha (hash do id, passo áureo): o mesmo pino gira sempre
 * no mesmo compasso, e pinos vizinhos raramente juntos.
 */
export function faseDoMarcador(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  const fase = hash * 0.6180339887
  return fase - Math.floor(fase)
}

export interface CamadasDaPose {
  /** Deslocamento vertical de giro e corpo, em px de tela. */
  deslocY: number
  escalaChao: number
  alphaChao: number
}

/** Onde cada camada fica numa pose: giro e corpo sobem juntos; a sombra encolhe e clareia quanto mais alto o pino está. */
export function camadasDaPose(flutuar: number): CamadasDaPose {
  return {
    deslocY: -flutuar * COS_I,
    escalaChao: limitar(1 - 0.035 * flutuar, 0.6, 1.1),
    alphaChao: limitar(1 - 0.05 * flutuar, 0.4, 1),
  }
}

// ---------------------------------------------------------------- desenho

/** Sombra no chão, em (0, 0). */
export function desenharChao(g: PincelDoMarcador, escala = 1, alpha = 1): void {
  const rx = 8.5 * escala
  const ry = rx * SEN_I * 1.15
  g.ellipse(0, 0, rx * 1.3, ry * 1.3).fill({ color: CONTORNO, alpha: 0.1 * alpha })
  g.ellipse(0, 0, rx, ry).fill({ color: CONTORNO, alpha: 0.16 * alpha })
  g.ellipse(0, 0, rx * 0.6, ry * 0.6).fill({ color: CONTORNO, alpha: 0.22 * alpha })
}

/** A pirâmide que gira, na altura de repouso deslocada por `oy`. `cor` = 0xrrggbb. */
export function desenharGiro(g: PincelDoMarcador, cor: number, angulo: number, oy = 0): void {
  desenharSolido(g, PIRAMIDE, angulo, rgbDeNumero(cor), oy, true)
}

/** O cristal parado de cima, com o risco de brilho do lado da luz. */
export function desenharCorpo(g: PincelDoMarcador, cor: number, oy = 0): void {
  desenharSolido(g, CRISTAL, 0, rgbDeNumero(cor), oy, false)
  desenharBrilho(g, BRILHO_DO_CRISTAL, oy)
}

/** O pino inteiro num pincel só: limpa, depois chão, giro e corpo. */
export function desenharMarcador(g: PincelDoMarcador, cor: number, pose: PoseDoMarcador): void {
  const c = camadasDaPose(pose.flutuar)
  g.clear()
  desenharChao(g, c.escalaChao, c.alphaChao)
  desenharGiro(g, cor, pose.angulo, c.deslocY)
  desenharCorpo(g, cor, c.deslocY)
}

/**
 * Tom de uma face pela luz que bate nela (n·L em -1..1): de costas puxa para o
 * escuro do mar, de frente puxa para o branco, no meio fica a cor do jogador.
 */
export function tomDaFace(rgb: Vetor, luz: number): Vetor {
  const t = limitar((luz + 0.3) / 1.3, 0, 1)
  const sombra = misturar(rgb, ESCURO, 0.6)
  const realce = misturar(rgb, BRANCO, 0.5)
  return t < 0.62 ? misturar(sombra, rgb, t / 0.62) : misturar(rgb, realce, (t - 0.62) / 0.38)
}

// ---------------------------------------------------------------- sólidos

/** Pirâmide de base quadrada com a ponta para baixo. */
function piramideInvertida(meioLado: number, topo: number, altura: number): Solido {
  const l = meioLado
  return {
    vertices: [[-l, topo, -l], [l, topo, -l], [l, topo, l], [-l, topo, l], [0, topo - altura, 0]],
    faces: [[0, 1, 2, 3], [0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]],
  }
}

/** Sólido de revolução facetado; perfil [[raio, y], ...] de baixo para cima, raio 0 só no fim (ponta). */
function torneado(perfil: readonly PontoDeTela[], lados: number, giroInicial: number): Solido {
  const vertices: Vetor[] = []
  const aneis: number[][] = []
  let ponta = -1
  for (const [raio, y] of perfil) {
    if (raio === 0) {
      ponta = vertices.length
      vertices.push([0, y, 0])
      continue
    }
    const anel: number[] = []
    for (let k = 0; k < lados; k += 1) {
      const a = giroInicial + (k * 2 * Math.PI) / lados
      anel.push(vertices.length)
      vertices.push([raio * Math.cos(a), y, raio * Math.sin(a)])
    }
    aneis.push(anel)
  }
  const faces: number[][] = [aneis[0].slice()]
  for (let i = 0; i + 1 < aneis.length; i += 1) {
    for (let k = 0; k < lados; k += 1) {
      const k2 = (k + 1) % lados
      faces.push([aneis[i][k], aneis[i][k2], aneis[i + 1][k2], aneis[i + 1][k]])
    }
  }
  const ultimo = aneis[aneis.length - 1]
  if (ponta >= 0) for (let k = 0; k < lados; k += 1) faces.push([ultimo[k], ultimo[(k + 1) % lados], ponta])
  return { vertices, faces }
}

// Medidas em px de tela, y para cima a partir do chão.
const PERFIL_CRISTAL: readonly PontoDeTela[] = [[5.2, 28.5], [7.4, 31], [7.8, 34.5], [7, 38.5], [5, 42], [2.4, 44.5], [0, 45.5]]
const CRISTAL = torneado(PERFIL_CRISTAL, 8, 0.2)
const PIRAMIDE = piramideInvertida(7, 26, 22) // ponta a 4 px do chão, base logo abaixo do cristal
// Risco de brilho no lado do cristal que encara a luz (ângulo ~124° no plano do chão).
const BRILHO_DO_CRISTAL: readonly Vetor[] = (
  [
    [7.3, 31.6],
    [7.6, 35],
    [6.9, 38.5],
    [5.4, 41.2],
  ] satisfies readonly PontoDeTela[]
).map(([r, y]) => projetarPonto([-0.555 * r * 0.96, y, 0.832 * r * 0.96], 0))

// ---------------------------------------------------------------- miolo

function desenharSolido(g: PincelDoMarcador, solido: Solido, giro: number, rgb: Vetor, oy: number, arestas: boolean): void {
  const { vista, visiveis } = projetar(solido, giro)
  const tela: PontoDeTela[] = vista.map(([x, y]) => [x, oy - y])
  for (const { face, luz } of visiveis) {
    const pontos: number[] = []
    for (const i of face) pontos.push(tela[i][0], tela[i][1])
    g.poly(pontos, true).fill({ color: rgbParaNumero(tomDaFace(rgb, luz)) })
    if (arestas) g.stroke({ width: 1, color: CONTORNO, alpha: 0.3, join: 'round' })
  }
  g.poly(cascoConvexo(tela).flat(), true).stroke({ width: 1.5, color: CONTORNO, alpha: 0.9, join: 'round' })
}

function projetar(solido: Solido, giro: number): { vista: Vetor[]; visiveis: { face: readonly number[]; luz: number }[] } {
  const vista = solido.vertices.map((v) => projetarPonto(v, giro))
  const centro = media(vista)
  const visiveis: { face: readonly number[]; luz: number }[] = []
  for (const face of solido.faces) {
    const p = face.map((i) => vista[i])
    let n = normalizar(cruz(sub(p[1], p[0]), sub(p[2], p[0])))
    if (ponto(n, sub(media(p), centro)) < 0) n = [-n[0], -n[1], -n[2]]
    if (n[2] > 1e-4) visiveis.push({ face, luz: ponto(n, LUZ) })
  }
  return { vista, visiveis }
}

/** Gira no eixo vertical, inclina para a câmera; devolve [x, cima, profundidade]. */
function projetarPonto([x, y, z]: Vetor, giro: number): Vetor {
  const c = Math.cos(giro)
  const s = Math.sin(giro)
  const xr = x * c + z * s
  const zr = -x * s + z * c
  return [xr, y * COS_I - zr * SEN_I, y * SEN_I + zr * COS_I]
}

function desenharBrilho(g: PincelDoMarcador, pontos: readonly Vetor[], oy: number): void {
  g.moveTo(pontos[0][0], oy - pontos[0][1])
  for (let i = 1; i < pontos.length; i += 1) g.lineTo(pontos[i][0], oy - pontos[i][1])
  g.stroke({ width: 1.6, color: 0xffffff, alpha: 0.55, cap: 'round', join: 'round' })
}

/** Casco convexo (cadeia monótona); para sólido convexo é a silhueta. */
function cascoConvexo(pontos: readonly PontoDeTela[]): PontoDeTela[] {
  const p = pontos.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (p.length < 3) return p
  const virada = (o: PontoDeTela, a: PontoDeTela, b: PontoDeTela) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const baixo: PontoDeTela[] = []
  for (const q of p) {
    while (baixo.length >= 2 && virada(baixo[baixo.length - 2], baixo[baixo.length - 1], q) <= 0) baixo.pop()
    baixo.push(q)
  }
  const cima: PontoDeTela[] = []
  for (let i = p.length - 1; i >= 0; i -= 1) {
    const q = p[i]
    while (cima.length >= 2 && virada(cima[cima.length - 2], cima[cima.length - 1], q) <= 0) cima.pop()
    cima.push(q)
  }
  baixo.pop()
  cima.pop()
  return baixo.concat(cima)
}

function rgbDeNumero(cor: number): Vetor {
  return [((cor >> 16) & 255) / 255, ((cor >> 8) & 255) / 255, (cor & 255) / 255]
}
function rgbParaNumero([r, g, b]: Vetor): number {
  const c = (v: number) => Math.round(limitar(v, 0, 1) * 255)
  return (c(r) << 16) | (c(g) << 8) | c(b)
}
function misturar(a: Vetor, b: Vetor, t: number): Vetor {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}
function limitar(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}
function sub(a: Vetor, b: Vetor): Vetor {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}
function cruz(a: Vetor, b: Vetor): Vetor {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}
function ponto(a: Vetor, b: Vetor): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}
function normalizar(v: Vetor): Vetor {
  const n = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / n, v[1] / n, v[2] / n]
}
function media(pontos: readonly Vetor[]): Vetor {
  let x = 0
  let y = 0
  let z = 0
  for (const p of pontos) {
    x += p[0]
    y += p[1]
    z += p[2]
  }
  return [x / pontos.length, y / pontos.length, z / pontos.length]
}
