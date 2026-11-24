import { css, type DefinicaoDeCarimbo, type DesenhoDeCarimbo, type Rgb } from '../embutidos'

/**
 * Brasas espalhadas (lote L03 de 24/11/2026, Tortura e fogo; versão da Fenda
 * em brasa, desenho ORIGINAL): um punhado de CARVÃO e brasas soltas, do que
 * cai para fora do fosso e dos braseiros. Caiu com RUMO: um NÚCLEO de torrões
 * maiores, deslocado para um lado, e uma CAUDA de torrões miúdos e migalhas
 * escorrendo para o outro. Nada de punhado redondo. Por baixo, a CINZA: uma
 * mancha macia de cinza quente, de beira irregular, que some no chão.
 *
 * A brasa não é um olho no meio do torrão: aparece RENTE AO CHÃO, num anel
 * que contorna parte da base dele (cada um num trecho diferente), e, em
 * alguns, numa FRESTA que racha a face de cima. No núcleo quase todos ainda
 * estão acesos; na cauda, poucos.
 *
 * DOIS desenhos no mesmo quadro e no mesmo giro, como a Fenda em brasa:
 * `desenhar` é o punhado com a brasa APAGADA (o vermelho-escuro da brasa
 * morna, a cara dele de dia); `brilho` é SÓ o que acende (o anel da base, a
 * fresta e as fagulhas), somado por cima e pulsando no app. Como o brilho é
 * somado por cima de todos os corpos, cada torrão apaga nele o brilho dos de
 * trás onde os cobre (e a metade de dentro do próprio anel). O brilho é fraco;
 * quem ilumina em volta é a entrada em `LUZ_DOS_CARIMBOS` (luz curta). É do
 * chão (`sombra: 'nenhuma'`): a sombrinha de cada torrão é pintada aqui, para
 * ele não parecer mancha. O giro gira o punhado; a luz não gira.
 */

/** A cinza no chão: um cinza quente, em manchas macias (por cima do chão do mapa, transparente na beira). */
const CINZA_NO_CHAO: Rgb = [122, 112, 104]
/** A sombrinha de cada torrão no chão. */
const SOMBRA: Rgb = [30, 24, 22]
/** O carvão: o corpo, a face de cima (do lado da luz) e a quina com cinza. */
const CARVAO: Rgb = [54, 48, 44]
const CARVAO_CLARO: Rgb = [88, 81, 75]
const QUINA_DE_CINZA: Rgb = [138, 131, 122]
/** A brasa morna, apagada: o que o anel e a fresta mostram de dia (a da Fenda em brasa). */
const BRASA_APAGADA: Rgb = [118, 54, 44]
/** O que acende: a borda da chama do app (`0xa04a2c`) e o miolo alaranjado. Só no `brilho`, fora da paleta. */
const BORDA_DA_CHAMA: Rgb = [160, 74, 44]
const MIOLO_DA_BRASA: Rgb = [236, 146, 92]

/** O chão visto de cima e um pouco de frente (o das pedras). */
const ACHATA = 0.55
/** O meio do punhado no quadro. */
const MEIO_Y = -0.07
/** O núcleo: quantos torrões, o quanto ele fica deslocado no rumo da queda, o raio em que se juntam e o tamanho deles. */
const NUCLEO = { quantos: 5, deslocado: 0.13, raio: 0.15, torrao: 0.1 }
/** A cauda: quantos torrões, de onde a onde ela vai (a partir do núcleo, contra o rumo), o quanto abre para os lados e o tamanho deles. */
const CAUDA = { quantos: 6, de: 0.18, ate: 0.6, abre: 0.2, torrao: 0.074 }
const MIGALHAS = 12
const ANGULO_DE_OURO = 2.39996
const LADOS = 6
/** A parte dos torrões que ainda tem brasa: quase todos no núcleo, poucos na cauda. */
const ACESOS_NO_NUCLEO = 0.75
const ACESOS_NA_CAUDA = 0.34
/**
 * O anel de brasa na base do torrão: o quanto fica para fora do contorno e as larguras do traço (em raios do torrão), a
 * da brasa e a do miolo claro. Fino: grosso, virava um colchete de néon em volta do carvão.
 */
const ANEL = { fora: 1.04, largura: 0.22, miolo: 0.07 }
/** A parte dos acesos que tem também a fresta na face de cima. */
const COM_FRESTA = 0.55
/** A cinza: quantas manchas e a transparência no meio de cada uma. */
const MANCHAS_DE_CINZA = 6
const ALFA_DA_CINZA = 0.2
/** A cinza em volta de cada torrão: o raio (em raios dele) e a transparência no meio. */
const CINZA_DO_TORRAO = { raio: 2.1, alfa: 0.24 }

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
  /** O trecho da base em brasa (os cantos seguidos do contorno, um pouco para fora dele); vazio = torrão apagado. */
  readonly anel: readonly P[]
  /** A fresta em brasa na face de cima; vazia = sem fresta. */
  readonly fresta: readonly P[]
}

interface Punhado {
  /** Os torrões, já no lugar da tela, do fundo para a frente. */
  readonly torroes: readonly Torrao[]
  /** As migalhas: x, y, raio e se é fagulha (acende). */
  readonly migalhas: readonly { readonly x: number; readonly y: number; readonly r: number; readonly fagulha: boolean }[]
  /** As manchas de cinza: o meio e o raio de cada uma. */
  readonly cinzas: readonly { readonly x: number; readonly y: number; readonly r: number }[]
}

/** Um torrão em (px, py) do chão (antes de achatar), de raio `r`; `i` = o índice dele nos sorteios. */
function torraoEm(px: number, py: number, r: number, aceso: boolean, semente: number, i: number): Torrao {
  const x = px
  const y = MEIO_Y + py * ACHATA
  const torto = sorteio(semente, 30 + i) * Math.PI * 2
  const angulos: number[] = []
  const contorno: P[] = []
  for (let q = 0; q < LADOS; q++) {
    const ang = torto + (q / LADOS) * Math.PI * 2
    const d = r * (0.7 + 0.5 * sorteio(semente, 40 + i * LADOS + q))
    angulos.push(ang)
    contorno.push([x + Math.cos(ang) * d, y + Math.sin(ang) * d * 0.72])
  }
  if (!aceso) return { x, y, r, contorno, anel: [], fresta: [] }
  // O anel: os cantos do contorno em volta de um rumo sorteado (quase sempre a frente ou um lado da base), um pouco para fora.
  const rumo = Math.PI / 2 + (sorteio(semente, 140 + i) - 0.5) * 3.4
  const abre = 1.15 + 0.75 * sorteio(semente, 160 + i)
  const anel: P[] = []
  // Começa no canto logo depois do maior vão (o lado de fora do trecho), para os cantos saírem seguidos.
  let primeiro = 0
  for (let q = 0; q < LADOS; q++) {
    const dentro = Math.abs(Math.atan2(Math.sin(angulos[q] - rumo), Math.cos(angulos[q] - rumo))) < abre
    const antes = Math.abs(Math.atan2(Math.sin(angulos[(q + LADOS - 1) % LADOS] - rumo), Math.cos(angulos[(q + LADOS - 1) % LADOS] - rumo))) < abre
    if (dentro && !antes) primeiro = q
  }
  for (let n = 0; n < LADOS; n++) {
    const q = (primeiro + n) % LADOS
    if (Math.abs(Math.atan2(Math.sin(angulos[q] - rumo), Math.cos(angulos[q] - rumo))) >= abre) break
    anel.push([x + (contorno[q][0] - x) * ANEL.fora, y + (contorno[q][1] - y) * ANEL.fora])
  }
  // A fresta: um risco torto que atravessa a face de cima, de um canto ao canto do outro lado.
  const fresta: P[] = []
  if (sorteio(semente, 180 + i) < COM_FRESTA) {
    const q = Math.floor(sorteio(semente, 200 + i) * LADOS)
    const [a, b] = [contorno[q], contorno[(q + 3) % LADOS]]
    const torce = (sorteio(semente, 220 + i) - 0.5) * r * 0.5
    fresta.push([x + (a[0] - x) * 0.66 - r * 0.1, y + (a[1] - y) * 0.66 - r * 0.12], [x + torce - r * 0.1, y + torce * 0.5 - r * 0.12], [x + (b[0] - x) * 0.6 - r * 0.1, y + (b[1] - y) * 0.6 - r * 0.12])
  }
  return { x, y, r, contorno, anel, fresta }
}

function punhadoDe(giro: number, semente: number): Punhado {
  // O rumo da queda: o núcleo vai para um lado e a cauda escorre para o outro.
  const rumo = giro + (sorteio(semente, 5) - 0.5) * 0.9
  const [dx, dy] = [Math.cos(rumo), Math.sin(rumo)]
  const [nx, ny] = [dx * NUCLEO.deslocado, dy * NUCLEO.deslocado]
  const torroes: Torrao[] = []
  for (let i = 0; i < NUCLEO.quantos; i++) {
    // Juntos, em espiral curta (o ângulo de ouro): os maiores no meio do núcleo.
    const t = (i + 0.5) / NUCLEO.quantos
    const rho = NUCLEO.raio * Math.sqrt(t) * (0.8 + 0.35 * sorteio(semente, i))
    const a = rumo + i * ANGULO_DE_OURO + (sorteio(semente, 10 + i) - 0.5) * 0.7
    const r = NUCLEO.torrao * (1 - 0.3 * Math.sqrt(t)) * (0.8 + 0.45 * sorteio(semente, 20 + i))
    torroes.push(torraoEm(nx + Math.cos(a) * rho, ny + Math.sin(a) * rho, r, sorteio(semente, 120 + i) < ACESOS_NO_NUCLEO, semente, i))
  }
  for (let j = 0; j < CAUDA.quantos; j++) {
    // Contra o rumo, cada vez menores e mais abertos para os lados.
    const i = NUCLEO.quantos + j
    const t = (j + 0.6) / CAUDA.quantos
    const ao = CAUDA.de + (CAUDA.ate - CAUDA.de) * t * (0.85 + 0.3 * sorteio(semente, i))
    const lado = (sorteio(semente, 10 + i) - 0.5) * CAUDA.abre * (0.5 + t)
    const r = CAUDA.torrao * (1 - 0.55 * t) * (0.8 + 0.45 * sorteio(semente, 20 + i))
    torroes.push(torraoEm(nx - dx * ao - dy * lado, ny - dy * ao + dx * lado, r, sorteio(semente, 120 + i) < ACESOS_NA_CAUDA, semente, i))
  }
  const migalhas = Array.from({ length: MIGALHAS }, (_, i) => {
    // Dois terços na cauda e além dela, o resto em volta do núcleo.
    const naCauda = i % 3 !== 0
    const ao = naCauda ? CAUDA.de * 0.6 + (CAUDA.ate + 0.04 - CAUDA.de * 0.6) * sorteio(semente, 210 + i) : -NUCLEO.raio * 1.5 * sorteio(semente, 210 + i)
    const lado = (sorteio(semente, 250 + i) - 0.5) * (naCauda ? CAUDA.abre * 1.5 : NUCLEO.raio * 3)
    return {
      x: nx - dx * ao - dy * lado,
      y: MEIO_Y + (ny - dy * ao + dx * lado) * ACHATA,
      r: 0.011 + 0.011 * sorteio(semente, 220 + i),
      fagulha: sorteio(semente, 230 + i) < (naCauda ? 0.3 : 0.55),
    }
  })
  // A cinza acompanha a queda: manchas do núcleo até o meio da cauda, de tamanhos desiguais, para a beira não sair redonda.
  const cinzas = Array.from({ length: MANCHAS_DE_CINZA }, (_, i) => {
    const t = i / (MANCHAS_DE_CINZA - 1)
    const ao = -NUCLEO.raio * 0.5 + (CAUDA.ate * 0.8 + NUCLEO.raio * 0.5) * t
    const lado = (sorteio(semente, 300 + i) - 0.5) * 0.16
    return { x: nx - dx * ao - dy * lado, y: MEIO_Y + (ny - dy * ao + dx * lado) * ACHATA, r: (0.24 - 0.12 * t) * (0.8 + 0.3 * sorteio(semente, 320 + i)) }
  })
  return { torroes: torroes.sort((p, q) => p.y - q.y), migalhas, cinzas }
}

/** O contorno encolhido `f` vezes em volta de um ponto deslocado (dx, dy) raios do meio: uma face do torrão. */
function face(t: Torrao, f: number, dx: number, dy: number): P[] {
  const [cx, cy] = [t.x + dx * t.r, t.y + dy * t.r]
  return t.contorno.map(([x, y]): P => [cx + (x - t.x) * f, cy + (y - t.y) * f])
}

function caminho(g: CanvasRenderingContext2D, pontos: readonly P[], fechado: boolean): void {
  g.beginPath()
  pontos.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)))
  if (fechado) g.closePath()
}

function preencher(g: CanvasRenderingContext2D, pontos: readonly P[], cor: string): void {
  g.fillStyle = cor
  caminho(g, pontos, true)
  g.fill()
}

function riscar(g: CanvasRenderingContext2D, pontos: readonly P[], largura: number, cor: string): void {
  if (pontos.length < 2) return
  g.strokeStyle = cor
  g.lineWidth = largura
  caminho(g, pontos, false)
  g.stroke()
}

function oval(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, cor: string): void {
  g.fillStyle = cor
  g.beginPath()
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  g.fill()
}

/**
 * Uma mancha macia de cinza: o degradê radial num círculo de raio `r`, achatado na oval do chão. (O raio fica em
 * unidades do quadro, sem esticar a escala: a régua dos carimbos confere os números crus que o desenho passa.)
 */
function manchaDeCinza(g: CanvasRenderingContext2D, x: number, y: number, r: number, alfa: number): void {
  g.save()
  g.translate(x, y)
  g.scale(1, ACHATA)
  const cinza = g.createRadialGradient(0, 0, 0, 0, 0, r)
  cinza.addColorStop(0, css(CINZA_NO_CHAO, alfa))
  cinza.addColorStop(0.5, css(CINZA_NO_CHAO, alfa * 0.62))
  cinza.addColorStop(1, css(CINZA_NO_CHAO, 0))
  g.fillStyle = cinza
  g.beginPath()
  g.arc(0, 0, r, 0, Math.PI * 2)
  g.fill()
  g.restore()
}

function desenhar(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const { torroes, migalhas, cinzas } = punhadoDe(giro, semente)
  g.lineCap = 'round'
  g.lineJoin = 'round'
  for (const c of cinzas) manchaDeCinza(g, c.x, c.y, c.r, ALFA_DA_CINZA)
  // E um pouco de cinza em volta de cada torrão: a beira dele pousa na cinza, e não some no preto da sombrinha.
  for (const t of torroes) manchaDeCinza(g, t.x, t.y + t.r * 0.2, t.r * CINZA_DO_TORRAO.raio, CINZA_DO_TORRAO.alfa)
  // As sombrinhas todas antes dos corpos e das migalhas: caem no chão, não no carvão vizinho (empilhadas nele, a beira do punhado ia a quase preto).
  for (const t of torroes) oval(g, t.x + t.r * 0.22, t.y + t.r * 0.3, t.r * 0.98, t.r * 0.6, css(SOMBRA, 0.34))
  for (const m of migalhas) oval(g, m.x, m.y, m.r, m.r * 0.72, css(m.fagulha ? BRASA_APAGADA : CARVAO))
  for (const t of torroes) {
    // O anel da base por baixo do corpo: só a metade de fora dele fica à vista, rente ao chão.
    riscar(g, t.anel, t.r * ANEL.largura, css(BRASA_APAGADA))
    preencher(g, t.contorno, css(CARVAO))
    preencher(g, face(t, 0.62, -0.2, -0.24), css(CARVAO_CLARO))
    preencher(g, face(t, 0.22, -0.46, -0.44), css(QUINA_DE_CINZA))
    riscar(g, t.fresta, t.r * 0.1, css(BRASA_APAGADA))
  }
}

/** Só o que acende: o anel da base e a fresta de cada torrão aceso, e as fagulhas. O torrão da frente apaga o brilho do de trás onde o cobre. */
const desenharBrilho: DesenhoDeCarimbo = (g, giro, semente) => {
  const { torroes, migalhas } = punhadoDe(giro, semente)
  g.lineCap = 'round'
  g.lineJoin = 'round'
  for (const m of migalhas) if (m.fagulha) oval(g, m.x, m.y, m.r, m.r * 0.72, css(BORDA_DA_CHAMA, 0.9))
  for (const t of torroes) {
    riscar(g, t.anel, t.r * ANEL.largura, css(BORDA_DA_CHAMA, 0.92))
    riscar(g, t.anel, t.r * ANEL.miolo, css(MIOLO_DA_BRASA, 0.9))
    g.save()
    g.globalCompositeOperation = 'destination-out'
    preencher(g, t.contorno, css(CARVAO))
    g.restore()
    riscar(g, t.fresta, t.r * 0.11, css(BORDA_DA_CHAMA, 0.92))
    riscar(g, t.fresta, t.r * 0.045, css(MIOLO_DA_BRASA, 0.9))
  }
}

export const carimbo: DefinicaoDeCarimbo = { id: 'brasas-espalhadas', nome: 'Brasas espalhadas', tamanho: 8, sombra: 'nenhuma', desenhar }

export const brilho: DesenhoDeCarimbo = desenharBrilho

/** Todas as cores chapadas do desenho (as do `brilho` ficam fora, como pede o briefing dos carimbos). */
export const paleta: readonly Rgb[] = [CINZA_NO_CHAO, SOMBRA, CARVAO, CARVAO_CLARO, QUINA_DE_CINZA, BRASA_APAGADA]
