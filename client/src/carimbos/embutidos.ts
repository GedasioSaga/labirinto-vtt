/**
 * A BIBLIOTECA INICIAL de carimbos (fatia 5 do plano do relevo): os objetos do
 * protótipo Diorama (`mapa-vivo/diorama`), redesenhados um a um para a
 * ferramenta Carimbos — pinheiro, pinheiro com neve, árvore, arbusto,
 * palmeira, pedras da serra, poça do pântano e juncos; depois, a árvore
 * redonda (MT5) e o tronco caído (28/10/2026).
 *
 * Cada objeto é desenhado com o Canvas 2D num QUADRO de unidades: 1 = o
 * tamanho natural dele, a BASE (onde toca o chão) na origem, x de -0,75 a
 * 0,75 e y de -1,2 (o alto) a 0,3 (`QUADRO_DA_BIBLIOTECA` em `arte.ts`).
 * Quem o põe no mapa escala o quadro pelo `tamanho` do carimbo.
 *
 * Regras de todos, as mesmas das texturas (pedido de 10/10/2026: "não ficar
 * estourado"):
 * - LUZ de cima à esquerda, a do relevo: a face da esquerda/de cima clara, a
 *   da direita/de baixo escura. O `giro` muda o desenho (os lóbulos da copa,
 *   as folhas da palmeira, a posição das pedras), nunca o lado da luz;
 * - VOLUME por camadas chapadas de tom, sem contorno grosso nem listra fina;
 * - CORES que partem do mapa do usuário (a floresta `#177c5c`, a serra
 *   `#9e8a74`, o pântano `#47948c`), nenhum canal acima de 245
 *   (`embutidos.test.ts` mede);
 * - a SOMBRA no chão não é desenhada aqui: sai da silhueta, projetada para
 *   baixo e para a direita pelo jeito de cada um (`sombra`), numa camada só.
 */

export type Rgb = readonly [number, number, number]

/**
 * Como a sombra cai: `em-pe` (alto, sombra comprida), `baixa` (rente ao chão),
 * `deitada` (deitado no chão e comprido, como o tronco caído: a silhueta
 * inteira desliza um tanto curto, sem a ponta de trás parecer no alto) ou
 * `nenhuma` (do chão, como a poça).
 */
export type SombraDoCarimbo = 'em-pe' | 'baixa' | 'deitada' | 'nenhuma'

/**
 * O desenho de um objeto no quadro de unidades. `giro` em radianos (o
 * desenho escolhe o que gira com ele), `semente` de 0 a 7 para as pequenas
 * diferenças entre um e outro. Só Canvas 2D, sem estado entre chamadas.
 */
export type DesenhoDeCarimbo = (g: CanvasRenderingContext2D, giro: number, semente: number) => void

export interface DefinicaoDeCarimbo {
  id: string
  nome: string
  /** O tamanho natural, em px do protótipo do relevo (o metro do pincel de textura). */
  tamanho: number
  sombra: SombraDoCarimbo
  desenhar: DesenhoDeCarimbo
}

// ---------------------------------------------------------------------------
// Ajudantes

export function css(c: Rgb, alfa = 1): string {
  return alfa >= 1 ? `rgb(${c[0]}, ${c[1]}, ${c[2]})` : `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alfa})`
}

export function misturar(a: Rgb, b: Rgb, t: number): Rgb {
  const k = Math.min(1, Math.max(0, t))
  return [Math.round(a[0] + (b[0] - a[0]) * k), Math.round(a[1] + (b[1] - a[1]) * k), Math.round(a[2] + (b[2] - a[2]) * k)]
}

/** Clareia (`f` > 0) ou escurece (`f` < 0) mantendo o tom. */
function luz(c: Rgb, f: number): Rgb {
  return f >= 0 ? misturar(c, [236, 238, 226], f) : misturar(c, [8, 18, 22], -f)
}

/** Sorteio fixo de 0 a 1 por semente e índice: o mesmo desenho em toda tela. */
function sorteio(semente: number, i: number): number {
  const s = Math.sin(semente * 127.1 + i * 311.7 + 74.7) * 43758.5453
  return s - Math.floor(s)
}

/** Direção da luz no chão (de cima à esquerda), para tingir o que aponta para ela. */
const LUZ_NO_PLANO = { x: -0.6, y: -0.8 }

/** O quanto a direção (dx, dy) aponta para a luz: 0 de costas, 1 de frente. */
function voltadoParaALuz(dx: number, dy: number): number {
  const n = Math.hypot(dx, dy) || 1
  return 0.5 + 0.5 * ((dx * LUZ_NO_PLANO.x + dy * LUZ_NO_PLANO.y) / n)
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

// ---------------------------------------------------------------------------
// Pinheiro: três andares de cone, metade clara (esquerda) e metade na sombra
// (direita), como o do Diorama; o de baixo um pouco mais escuro (a copa de
// cima tampa a luz). O giro só inclina de leve: pinheiro não deita.

const PINHO_CLARO: Rgb = [42, 128, 94]
const PINHO_ESCURO: Rgb = [14, 78, 58]
const TRONCO: Rgb = [92, 66, 44]
const TRONCO_SOMBRA: Rgb = [62, 44, 30]
const NEVE: Rgb = [228, 236, 242]
const NEVE_SOMBRA: Rgb = [188, 202, 214]
/** O pinheiro da neve é mais azulado e escuro: a cor de fundo é o branco. */
const PINHO_FRIO_CLARO: Rgb = [46, 112, 96]
const PINHO_FRIO_ESCURO: Rgb = [18, 66, 60]

const ANDARES = [
  { base: -0.1, largura: 0.64, altura: 0.5, luz: -0.08 },
  { base: -0.34, largura: 0.5, altura: 0.44, luz: 0 },
  { base: -0.57, largura: 0.34, altura: 0.43, luz: 0.05 },
] as const

function desenharPinheiro(g: CanvasRenderingContext2D, giro: number, semente: number, nevado: boolean): void {
  g.save()
  g.rotate(Math.sin(giro) * 0.07)
  g.fillStyle = css(TRONCO)
  g.fillRect(-0.04, -0.16, 0.04, 0.17)
  g.fillStyle = css(TRONCO_SOMBRA)
  g.fillRect(0, -0.16, 0.04, 0.17)
  const claro = nevado ? PINHO_FRIO_CLARO : PINHO_CLARO
  const escuro = nevado ? PINHO_FRIO_ESCURO : PINHO_ESCURO
  ANDARES.forEach((andar, i) => {
    const w = andar.largura * (0.93 + 0.14 * sorteio(semente, i))
    const topo = andar.base - andar.altura
    const fundo = andar.base + 0.045
    // Metade da luz.
    g.fillStyle = css(luz(claro, andar.luz))
    g.beginPath()
    g.moveTo(0, topo)
    g.lineTo(-w / 2, andar.base)
    g.quadraticCurveTo(-w / 4, andar.base + 0.04, 0, fundo)
    g.closePath()
    g.fill()
    // Metade da sombra.
    g.fillStyle = css(luz(escuro, andar.luz))
    g.beginPath()
    g.moveTo(0, topo)
    g.lineTo(0, fundo)
    g.quadraticCurveTo(w / 4, andar.base + 0.04, w / 2, andar.base)
    g.closePath()
    g.fill()
    if (!nevado) return
    // A neve pousa na SAIA de cada andar — a parte que o andar de cima não
    // cobre — e na ponta: clara do lado da luz, azulada do outro. Uma faixa
    // larga que segue a encosta, não um risco.
    const cima = i === ANDARES.length - 1 ? topo : ANDARES[i + 1].base + 0.03
    const naEncosta = (y: number) => ((y - topo) / andar.altura) * (w / 2)
    const meio = (cima + andar.base) / 2
    g.fillStyle = css(NEVE)
    g.beginPath()
    g.moveTo(-naEncosta(cima), cima)
    g.lineTo(-naEncosta(andar.base - 0.02), andar.base - 0.02)
    g.quadraticCurveTo(-naEncosta(andar.base) * 0.55, meio + 0.01, 0, cima + (meio - cima) * 0.55)
    g.lineTo(0, cima)
    g.closePath()
    g.fill()
    g.fillStyle = css(NEVE_SOMBRA)
    g.beginPath()
    g.moveTo(0, cima)
    g.lineTo(0, cima + (meio - cima) * 0.55)
    g.quadraticCurveTo(naEncosta(andar.base) * 0.5, meio - 0.005, naEncosta(andar.base - 0.03) * 0.9, andar.base - 0.03)
    g.lineTo(naEncosta(cima), cima)
    g.closePath()
    g.fill()
  })
  g.restore()
}

// ---------------------------------------------------------------------------
// Copa redonda (o arbusto, e cada cacho da árvore): a silhueta é a união de lóbulos em volta
// do miolo, girados pelo giro — cada uma sai com outro contorno. Três camadas
// chapadas: o escuro inteiro, o médio puxado para a luz e uns brilhos no alto
// à esquerda. A luz nunca gira com os lóbulos.

interface TonsDaCopa {
  escuro: Rgb
  medio: Rgb
  claro: Rgb
}

const TONS_DA_ARVORE: TonsDaCopa = { escuro: [16, 86, 64], medio: [28, 120, 88], claro: [78, 156, 112] }
const TONS_DO_ARBUSTO: TonsDaCopa = { escuro: [52, 100, 58], medio: [80, 132, 74], claro: [132, 170, 106] }

function lobulos(cy: number, raio: number, giro: number, semente: number, encolher: number, dx: number, dy: number): Array<[number, number, number]> {
  const n = 7
  const lista: Array<[number, number, number]> = [[dx, cy + dy, raio * 0.68 * encolher]]
  for (let i = 0; i < n; i++) {
    const a = giro + (i * Math.PI * 2) / n + (sorteio(semente, i) - 0.5) * 0.5
    const r = raio * (0.38 + 0.1 * sorteio(semente, i + 10)) * encolher
    const d = raio * 0.56 * encolher
    // A copa é vista de cima e um pouco de frente: achatada de leve na vertical.
    lista.push([dx + Math.cos(a) * d, cy + dy + Math.sin(a) * d * 0.88, r])
  }
  return lista
}

function desenharCopa(g: CanvasRenderingContext2D, giro: number, semente: number, tons: TonsDaCopa, cy: number, raio: number, cx = 0): void {
  g.fillStyle = css(tons.escuro)
  circulos(g, lobulos(cy, raio, giro, semente, 1, cx, 0))
  g.fillStyle = css(tons.medio)
  circulos(g, lobulos(cy, raio, giro, semente, 0.78, cx - raio * 0.12, -raio * 0.15))
  // Brilho: uma copa pequena no alto à esquerda, onde a luz bate em cheio.
  g.fillStyle = css(tons.claro)
  circulos(g, lobulos(cy, raio, giro, semente, 0.4, cx - raio * 0.34, -raio * 0.38))
}

// ---------------------------------------------------------------------------
// Árvore: o que a separa do arbusto é a ALTURA. O tronco aparece embaixo da
// copa, com as raízes abrindo no chão; a copa sobe em dois andares de cachos
// (dois embaixo, um maior no alto, que tampa os de baixo e deixa a costura
// escura entre eles); por baixo dos cachos, a sombra da própria copa, mais
// escura, pousa sobre o tronco. Como o desenho é alto, a sombra `em-pe` sai
// da copa e cai longe do pé — o que vende a altura no mapa. A luz é a de
// sempre: o cacho da direita mais apagado, o do alto mais aceso.

const ARVORE_SOMBRA_DA_COPA: Rgb = [14, 60, 50]

/** Os tons de um cacho, mais ou menos de frente para a luz. */
function tonsComLuz(t: TonsDaCopa, f: number): TonsDaCopa {
  return { escuro: luz(t.escuro, f), medio: luz(t.medio, f), claro: luz(t.claro, f) }
}

function desenharArvore(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const inclina = Math.sin(giro) * 0.035
  const topoDoTronco = -0.46
  // Tronco: a metade da luz, com a raiz da esquerda abrindo no chão...
  g.fillStyle = css(TRONCO)
  g.beginPath()
  g.moveTo(0, 0.02)
  g.lineTo(-0.1, 0.026)
  g.quadraticCurveTo(-0.046, 0.004, -0.043, -0.1)
  g.lineTo(-0.033 + inclina, topoDoTronco)
  g.lineTo(inclina, topoDoTronco)
  g.closePath()
  g.fill()
  // ...e a da sombra, com a raiz da direita mais comprida (cada uma sai de um jeito).
  const raiz = 0.1 + 0.035 * sorteio(semente, 80)
  g.fillStyle = css(TRONCO_SOMBRA)
  g.beginPath()
  g.moveTo(0, 0.02)
  g.lineTo(inclina, topoDoTronco)
  g.lineTo(0.033 + inclina, topoDoTronco)
  g.lineTo(0.043, -0.1)
  g.quadraticCurveTo(0.05, 0.004, raiz, 0.03)
  g.closePath()
  g.fill()

  // Os cachos: qual dos de baixo sobe um pouco e onde o do alto pende mudam
  // com a semente; o contorno de cada um gira com o giro.
  const sobe = sorteio(semente, 81) < 0.5 ? -1 : 1
  const tamanho = (i: number) => 0.94 + 0.12 * sorteio(semente, 82 + i)
  const cachos = [
    { x: -0.215, y: -0.54 + 0.025 * sobe, r: 0.225 * tamanho(0), luz: 0.03 },
    { x: 0.215, y: -0.54 - 0.025 * sobe, r: 0.225 * tamanho(1), luz: -0.09 },
    { x: (sorteio(semente, 85) - 0.5) * 0.08, y: -0.83, r: 0.285 * tamanho(2), luz: 0.06 },
  ]
  const lobosDoCacho = (i: number) => giro + i * 2.1
  const sementeDoCacho = (i: number) => semente * 3 + i * 17

  // A sombra por baixo da copa: os cachos de baixo, um pouco mais para baixo
  // e para a direita, e o miolo entre eles, onde o tronco entra na sombra.
  g.fillStyle = css(ARVORE_SOMBRA_DA_COPA)
  circulos(g, [
    ...lobulos(cachos[0].y + 0.035, cachos[0].r, lobosDoCacho(0), sementeDoCacho(0), 1, cachos[0].x + 0.015, 0),
    ...lobulos(cachos[1].y + 0.035, cachos[1].r, lobosDoCacho(1), sementeDoCacho(1), 1, cachos[1].x + 0.015, 0),
    [0.01, -0.5, 0.17],
  ])
  cachos.forEach((c, i) => desenharCopa(g, lobosDoCacho(i), sementeDoCacho(i), tonsComLuz(TONS_DA_ARVORE, c.luz), c.y, c.r, c.x))
}

// ---------------------------------------------------------------------------
// Palmeira: o tronco curvo e o leque de folhas visto de cima. As folhas
// giram com o giro; o tom de cada uma vem da direção dela (a que aponta para
// a luz, clara). As de trás (apontando para cima) saem primeiro.

const PALMEIRA_TRONCO: Rgb = [134, 100, 64]
const PALMEIRA_TRONCO_SOMBRA: Rgb = [98, 72, 46]
const FOLHA_CLARA: Rgb = [76, 152, 92]
const FOLHA_ESCURA: Rgb = [26, 98, 62]
const COCO: Rgb = [86, 60, 38]

function desenharPalmeira(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const inclina = Math.sin(giro) * 0.07
  const topo = { x: 0.08 + inclina, y: -0.8 }
  // Tronco: metade da luz e metade da sombra, afinando para o alto.
  g.fillStyle = css(PALMEIRA_TRONCO)
  g.beginPath()
  g.moveTo(-0.04, 0)
  g.quadraticCurveTo(-0.08, -0.42, topo.x - 0.024, topo.y)
  g.lineTo(topo.x, topo.y)
  g.quadraticCurveTo(-0.02, -0.42, 0, 0)
  g.closePath()
  g.fill()
  g.fillStyle = css(PALMEIRA_TRONCO_SOMBRA)
  g.beginPath()
  g.moveTo(0, 0)
  g.quadraticCurveTo(-0.02, -0.42, topo.x, topo.y)
  g.lineTo(topo.x + 0.024, topo.y)
  g.quadraticCurveTo(0.04, -0.42, 0.04, 0)
  g.closePath()
  g.fill()

  const folhas = Array.from({ length: 7 }, (_, i) => {
    const a = giro + (i * Math.PI * 2) / 7 + (sorteio(semente, i) - 0.5) * 0.35
    return { a, comprimento: 0.46 * (0.88 + 0.24 * sorteio(semente, i + 20)) }
  }).sort((p, q) => Math.sin(p.a) - Math.sin(q.a))
  const folha = (a: number, comprimento: number) => {
    const dx = Math.cos(a)
    const dy = Math.sin(a) * 0.62
    const ponta = { x: topo.x + dx * comprimento, y: topo.y + dy * comprimento + 0.14 }
    const meio = { x: topo.x + dx * comprimento * 0.52, y: topo.y + dy * comprimento * 0.52 - 0.07 }
    // A folha tem largura no meio (normal ao eixo), fina na base e na ponta.
    const nx = -dy
    const ny = dx
    const n = Math.hypot(nx, ny) || 1
    const largura = 0.065
    g.fillStyle = css(misturar(FOLHA_ESCURA, FOLHA_CLARA, voltadoParaALuz(dx, dy)))
    g.beginPath()
    g.moveTo(topo.x, topo.y)
    g.quadraticCurveTo(meio.x + (nx / n) * largura, meio.y + (ny / n) * largura, ponta.x, ponta.y)
    g.quadraticCurveTo(meio.x - (nx / n) * largura, meio.y - (ny / n) * largura, topo.x, topo.y)
    g.fill()
  }
  for (const f of folhas.filter((f) => Math.sin(f.a) < 0)) folha(f.a, f.comprimento)
  g.fillStyle = css(COCO)
  circulos(g, [
    [topo.x - 0.03, topo.y + 0.035, 0.028],
    [topo.x + 0.03, topo.y + 0.04, 0.026],
  ])
  for (const f of folhas.filter((f) => Math.sin(f.a) >= 0)) folha(f.a, f.comprimento)
}

// ---------------------------------------------------------------------------
// Pedras da serra: um grupo de três pedras facetadas. Cada pedra é uma
// pirâmide baixa sobre um pé de seis lados; cada face toma a luz pela
// direção para onde olha (a luz vem de cima à esquerda e do alto). O giro
// troca a arrumação do grupo e o corte de cada pedra.

const PEDRA_CLARA: Rgb = [196, 180, 156]
const PEDRA_MEIA: Rgb = [156, 138, 116]
const PEDRA_ESCURA: Rgb = [110, 94, 78]

/** Luz em 3D (x direita, y para baixo na tela, z para cima): de cima à esquerda e do alto. */
const LUZ_3D = (() => {
  const v = { x: -0.5, y: -0.55, z: 0.67 }
  const n = Math.hypot(v.x, v.y, v.z)
  return { x: v.x / n, y: v.y / n, z: v.z / n }
})()

/** O tom de uma face pelo quanto ela olha para a luz (0 de costas, 1 de frente). */
function tomDaPedra(brilho: number): Rgb {
  const t = Math.min(1, Math.max(0, (brilho - 0.1) / 0.85))
  return t > 0.5 ? misturar(PEDRA_MEIA, PEDRA_CLARA, (t - 0.5) * 2) : misturar(PEDRA_ESCURA, PEDRA_MEIA, t * 2)
}

/**
 * Uma pedra: um bloco de seis lados que afina para cima até um topo chato
 * (um matacão lascado, não uma pirâmide). Cada lado é um quadrilátero do pé
 * ao topo, com a luz pela direção para onde olha; o topo, de frente para o
 * céu, é o mais claro.
 */
function desenharPedra(g: CanvasRenderingContext2D, cx: number, cy: number, raio: number, altura: number, giro: number, semente: number): void {
  const angulos = Array.from({ length: 6 }, (_, k) => giro + (k * Math.PI) / 3 + (sorteio(semente, k + 40) - 0.5) * 0.5)
  const pe = angulos.map((a, k) => {
    const r = raio * (0.82 + 0.3 * sorteio(semente, k + 50))
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.55 }
  })
  // O topo: o pé encolhido, puxado um pouco para trás e para a esquerda (o lado de cima da pedra).
  const encolhe = 0.42 + 0.12 * sorteio(semente, 60)
  const topoX = cx - raio * 0.1
  const topoY = cy - altura
  const topo = pe.map((p) => ({ x: topoX + (p.x - cx) * encolhe, y: topoY + (p.y - cy) * encolhe }))
  const lados = pe.map((p, k) => {
    const q = pe[(k + 1) % pe.length]
    // A normal do lado: para fora do pé, inclinada para cima pelo quanto a pedra afina.
    const mx = (p.x + q.x) / 2 - cx
    const my = ((p.y + q.y) / 2 - cy) / 0.55
    const m = Math.hypot(mx, my) || 1
    const nz = (raio * (1 - encolhe)) / Math.max(altura, 0.01)
    const n = Math.hypot(1, nz)
    const brilho = ((mx / m) * LUZ_3D.x + (my / m) * LUZ_3D.y + nz * LUZ_3D.z) / n
    return { pontos: [p, q, topo[(k + 1) % pe.length], topo[k]], fundo: (p.y + q.y) / 2, brilho }
  })
  // De trás para a frente: o lado da frente cobre o de trás; o topo por último.
  lados.sort((a, b) => a.fundo - b.fundo)
  for (const lado of lados) {
    g.fillStyle = css(tomDaPedra(lado.brilho))
    g.beginPath()
    lado.pontos.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)))
    g.closePath()
    g.fill()
  }
  g.fillStyle = css(tomDaPedra(LUZ_3D.z + 0.12))
  g.beginPath()
  topo.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)))
  g.closePath()
  g.fill()
}

function desenharPedras(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const grupo = [
    { dx: -0.1, dy: -0.02, raio: 0.3, altura: 0.3 },
    { dx: 0.24, dy: 0.04, raio: 0.19, altura: 0.18 },
    { dx: 0.02, dy: 0.13, raio: 0.13, altura: 0.11 },
  ]
    .map((p, i) => {
      // A arrumação gira em volta da base, achatada como o chão visto de cima.
      const c = Math.cos(giro)
      const s = Math.sin(giro)
      const y = p.dy / 0.55
      return { ...p, x: p.dx * c - y * s, y: (p.dx * s + y * c) * 0.55, i }
    })
    .sort((a, b) => a.y - b.y)
  for (const p of grupo) desenharPedra(g, p.x, p.y, p.raio, p.altura, giro + p.i, semente + p.i * 3)
}

// ---------------------------------------------------------------------------
// Poça do pântano: uma bacia rasa vista de cima — a margem molhada, a água
// mais escura no alto (a margem de cima faz sombra nela) e mais clara
// embaixo, a beira de baixo pegando luz e o reflexo do céu. Fica rente ao
// chão: sem sombra, e por baixo das sombras dos outros.

const MARGEM: Rgb = [92, 108, 80]
const AGUA_FUNDA: Rgb = [36, 88, 92]
const AGUA_RASA: Rgb = [70, 136, 132]
const BEIRA_DE_LUZ: Rgb = [150, 204, 194]
const REFLEXO: Rgb = [188, 224, 218]

function desenharPoca(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  // O giro vira só uma inclinação da bacia: a luz da água não gira.
  const angulo = Math.sin(giro) * 0.32
  const rx = 0.44 * (0.92 + 0.16 * sorteio(semente, 60))
  const ry = 0.22
  g.fillStyle = css(MARGEM, 0.55)
  g.beginPath()
  g.ellipse(0, 0.01, rx + 0.05, ry + 0.035, angulo, 0, Math.PI * 2)
  g.fill()
  const agua = g.createLinearGradient(0, -ry, 0, ry)
  agua.addColorStop(0, css(AGUA_FUNDA))
  agua.addColorStop(1, css(AGUA_RASA))
  g.fillStyle = agua
  g.beginPath()
  g.ellipse(0, 0, rx, ry, angulo, 0, Math.PI * 2)
  g.fill()
  // A beira de baixo, iluminada: um arco largo e suave, não um contorno.
  g.strokeStyle = css(BEIRA_DE_LUZ, 0.55)
  g.lineWidth = 0.022
  g.lineCap = 'round'
  g.beginPath()
  g.ellipse(0, 0, rx - 0.015, ry - 0.012, angulo, Math.PI * 0.18, Math.PI * 0.82)
  g.stroke()
  g.fillStyle = css(REFLEXO, 0.45)
  g.beginPath()
  g.ellipse(-rx * 0.34, -ry * 0.18, rx * 0.26, ry * 0.18, angulo, 0, Math.PI * 2)
  g.fill()
}

// ---------------------------------------------------------------------------
// Juncos: um tufo de hastes finas curvas, as da esquerda com a luz, e uma ou
// duas taboas. O giro troca o leque das hastes.

const JUNCO_CLARO: Rgb = [92, 144, 104]
const JUNCO_ESCURO: Rgb = [38, 92, 74]
const TABOA: Rgb = [116, 82, 52]

function desenharJuncos(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  g.lineCap = 'round'
  g.lineWidth = 0.055
  const hastes = Array.from({ length: 6 }, (_, i) => {
    const t = i / 5 - 0.5
    const abre = t * 0.62 + Math.sin(giro + i) * 0.06
    return { x0: t * 0.16, ponta: { x: abre, y: -0.68 - 0.26 * sorteio(semente, i + 70) }, t }
  })
  // As de trás (do meio para fora) primeiro; as das pontas por cima.
  for (const h of [...hastes].sort((a, b) => Math.abs(a.t) - Math.abs(b.t))) {
    g.strokeStyle = css(misturar(JUNCO_CLARO, JUNCO_ESCURO, h.t + 0.5))
    g.beginPath()
    g.moveTo(h.x0, 0)
    g.quadraticCurveTo(h.x0 + h.ponta.x * 0.25, h.ponta.y * 0.6, h.ponta.x, h.ponta.y)
    g.stroke()
  }
  // Taboas: a espiga marrom no alto de duas hastes.
  for (const h of [hastes[1], hastes[4]]) {
    g.fillStyle = css(TABOA)
    g.beginPath()
    g.ellipse(h.ponta.x * 0.86, h.ponta.y * 0.84, 0.04, 0.1, h.ponta.x * 0.4, 0, Math.PI * 2)
    g.fill()
  }
}

// ---------------------------------------------------------------------------
// Árvore redonda (fatia MT5 do Meio-Termo): a copa redonda vista de cima,
// desenho ORIGINAL inspirado na árvore do Estilo Mother da vila
// (`docs/design/vila-estilo-mother/prototipo/mother.js`, `arvore`): sete
// lóbulos em volta e um no meio, com um contorno verde-escuro (nunca preto)
// por fora, a massa escura, a média puxada para a luz (cima à esquerda) e
// brilhos pequenos; às vezes umas flores. Só a pontinha do tronco aparece
// embaixo. A árvore antiga (`arvore`) não muda: os mapas antigos ficam iguais.

const REDONDA_CONTORNO: Rgb = [40, 88, 62]
const REDONDA_ESCURO: Rgb = [58, 116, 80]
const REDONDA_MEDIO: Rgb = [80, 148, 100]
const REDONDA_CLARO: Rgb = [128, 182, 130]
const REDONDA_FLOR_ROSA: Rgb = [222, 168, 192]
const REDONDA_FLOR_BRANCA: Rgb = [236, 232, 218]

/** Centro e raio da copa redonda no quadro de unidades (o pé do objeto em 0, 0). */
const COPA_REDONDA = { cy: -0.46, raio: 0.42 } as const

function lobulosRedondos(semente: number, giro: number, encolher: number, dx: number, dy: number): Array<[number, number, number]> {
  const { cy, raio } = COPA_REDONDA
  const lista: Array<[number, number, number]> = []
  for (let i = 0; i < 7; i++) {
    const a = giro + (i / 7) * Math.PI * 2 + sorteio(semente, 40 + i) * 0.7
    const d = raio * (0.44 + 0.1 * sorteio(semente, 50 + i)) * encolher
    lista.push([dx + Math.cos(a) * d, cy + dy + Math.sin(a) * d, raio * (0.44 + 0.1 * sorteio(semente, 60 + i)) * encolher])
  }
  lista.push([dx - raio * 0.06, cy + dy - raio * 0.08, raio * 0.56 * encolher])
  return lista
}

function desenharArvoreRedonda(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  // A pontinha do tronco, por baixo da copa.
  g.fillStyle = css(TRONCO_SOMBRA)
  g.beginPath()
  g.ellipse(0.01, -0.06, 0.05, 0.07, 0, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = css(TRONCO)
  g.beginPath()
  g.ellipse(-0.012, -0.07, 0.03, 0.06, 0, 0, Math.PI * 2)
  g.fill()
  // Contorno: a mesma copa um pouco maior, no verde-escuro.
  g.fillStyle = css(REDONDA_CONTORNO)
  circulos(g, lobulosRedondos(semente, giro, 1, 0, 0).map(([x, y, r]) => [x, y, r + 0.025] as [number, number, number]))
  g.fillStyle = css(REDONDA_ESCURO)
  circulos(g, lobulosRedondos(semente, giro, 1, 0, 0))
  g.fillStyle = css(REDONDA_MEDIO)
  circulos(g, lobulosRedondos(semente, giro, 0.8, -COPA_REDONDA.raio * 0.1, -COPA_REDONDA.raio * 0.12))
  g.fillStyle = css(REDONDA_CLARO)
  circulos(g, lobulosRedondos(semente, giro, 0.36, -COPA_REDONDA.raio * 0.34, -COPA_REDONDA.raio * 0.36))
  // Às vezes floresce: cinco florzinhas espalhadas pela copa.
  if (sorteio(semente, 70) < 0.4) {
    g.fillStyle = css(sorteio(semente, 71) < 0.5 ? REDONDA_FLOR_ROSA : REDONDA_FLOR_BRANCA)
    const flores: Array<[number, number, number]> = []
    for (let i = 0; i < 5; i++) {
      const a = sorteio(semente, 80 + i) * Math.PI * 2
      const d = COPA_REDONDA.raio * (0.2 + 0.5 * sorteio(semente, 90 + i))
      flores.push([Math.cos(a) * d, COPA_REDONDA.cy + Math.sin(a) * d, 0.028])
    }
    circulos(g, flores)
  }
}

// ---------------------------------------------------------------------------
// Tronco caído (pedido de 28/10/2026): um tronco DEITADO no chão, visto de
// cima e um pouco de frente, como as pedras e a poça. O giro aponta o tronco
// para qualquer lado (deitado, ele não tem "de pé"); a variante escolhe uma
// de quatro formas, cada uma num giro reto e num diagonal: reto com a ponta
// quebrada, com um galho seco, com musgo por cima de um lado, e curto e
// grosso com o corte e os anéis. A casca são POUCAS FAIXAS LARGAS ao longo do
// tronco (o lado da luz, o meio e o lado da sombra), de borda mansa, nunca
// risco fino, escama ou bolinha (pedido do usuário: "tá muito detalhado,
// cheio de bolinhas, fica estranho"); o corte tem dois anéis calmos. A luz é
// a de sempre: a faixa clara vai para o lado que olha para cima à esquerda, e
// a ponta que olha para a luz sai clara. A sombra é `deitada` (`arte.ts`).
//
// Os pontos saem já no quadro (sem `rotate`/`scale` no contexto): u corre ao
// longo do tronco, v de través, e `eixoDoTronco` leva (u, v) para o quadro —
// o comprimento encolhe quando aponta para cima ou para baixo (o chão visto
// um pouco de frente), a grossura não.

const CASCA_DA_LUZ: Rgb = [124, 94, 66]
const GALHO_SECO: Rgb = [108, 84, 60]
const CERNE_CLARO: Rgb = [178, 142, 100]
const CERNE_ESCURO: Rgb = [128, 98, 68]

/**
 * O meio do tronco no quadro, um pouco acima da base: o tronco que aponta
 * para cima e para baixo cabe no quadro do corpo, e a sombra dele no da
 * sombra (`QUADRO_DA_SOMBRA`, que começa em -0,6).
 */
const CENTRO_DO_TRONCO = { x: 0, y: -0.2 } as const
/** O quanto encolhe o comprimento que aponta para cima ou para baixo (as pedras, pequenas, usam 0,55). */
const ACHATAMENTO_DO_CHAO = 0.7

type PontaDoTronco = 'redonda' | 'corte' | 'quebrada' | 'lascada'

interface FormaDoTronco {
  /** Onde o cilindro começa e acaba ao longo do tronco; as pontas passam um pouco disso. */
  u0: number
  u1: number
  raio: number
  /** Quanto o tronco afina do pé (u0) para a ponta (u1), em fração do raio. */
  afina: number
  ponta0: PontaDoTronco
  ponta1: PontaDoTronco
  galho: boolean
  musgo: boolean
}

type NomeDaForma = 'quebrado' | 'galho' | 'musgo' | 'curto'

/**
 * As quatro formas, no quadro de unidades: as compridas com ~1,3 unidade de
 * ponta a ponta, a curta com ~0,95 e mais grossa. Nenhuma ponta passa de 0,7
 * do meio com o bojo (a ponta que aponta para baixo na tela, 70% disso, ainda
 * cabe no quadro, que acaba em 0,3).
 */
const FORMAS_DO_TRONCO: Record<NomeDaForma, FormaDoTronco> = {
  quebrado: { u0: -0.57, u1: 0.48, raio: 0.12, afina: 0.2, ponta0: 'redonda', ponta1: 'quebrada', galho: false, musgo: false },
  galho: { u0: -0.57, u1: 0.57, raio: 0.116, afina: 0.16, ponta0: 'corte', ponta1: 'redonda', galho: true, musgo: false },
  musgo: { u0: -0.57, u1: 0.55, raio: 0.126, afina: 0.14, ponta0: 'redonda', ponta1: 'lascada', galho: false, musgo: true },
  curto: { u0: -0.36, u1: 0.36, raio: 0.168, afina: 0.08, ponta0: 'redonda', ponta1: 'corte', galho: false, musgo: false },
}

/**
 * A forma de cada uma das oito variantes (uma a cada 45°): cada forma sai num
 * giro reto e num diagonal, nunca só em pé ou só deitada na tela. A variante
 * 1 é a da miniatura do painel: o tronco do galho, com o corte virado para a luz.
 */
const FORMA_POR_VARIANTE: readonly NomeDaForma[] = ['musgo', 'galho', 'curto', 'quebrado', 'galho', 'musgo', 'quebrado', 'curto']

/** A ponta quebrada: [de través, em frações do raio, do lado +v ao -v; para fora, em unidades]. Poucos dentes, grandes. */
const DENTES_DA_QUEBRA: ReadonlyArray<readonly [number, number]> = [
  [1, -0.02],
  [0.6, 0.05],
  [0.26, 0.18],
  [0.02, 0.05],
  [-0.34, 0.12],
  [-0.68, 0.01],
  [-1, 0.03],
]
/** A ponta lascada (a do musgo): a quebra antiga, de dentes baixos. */
const DENTES_DA_LASCA: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [0.45, 0.07],
  [0.05, 0.02],
  [-0.4, 0.09],
  [-1, 0.01],
]

type Ponto = [number, number]

interface EixoDoTronco {
  /** O ponto (u ao longo, v de través) no quadro. */
  ponto: (u: number, v: number) => Ponto
  /** O ângulo do tronco na tela (para as elipses do corte) e o quanto o comprimento encolhe nele. */
  angulo: number
  encurta: number
  /** Para onde, no chão, olham o lado +v e a ponta +u (para tingir pela luz). */
  lado: { x: number; y: number }
  frente: { x: number; y: number }
  /** O lado +v na tela (para baixo, ele é o lado que a vista de frente mostra por baixo). */
  ladoNaTela: { x: number; y: number }
}

function eixoDoTronco(giro: number): EixoDoTronco {
  const c = Math.cos(giro)
  const s = Math.sin(giro)
  const encurta = Math.hypot(c, s * ACHATAMENTO_DO_CHAO)
  const a = { x: c / encurta, y: (s * ACHATAMENTO_DO_CHAO) / encurta }
  const p = { x: -a.y, y: a.x }
  return {
    ponto: (u, v) => [CENTRO_DO_TRONCO.x + a.x * u * encurta + p.x * v, CENTRO_DO_TRONCO.y + a.y * u * encurta + p.y * v],
    angulo: Math.atan2(a.y, a.x),
    encurta,
    lado: { x: -s, y: c },
    frente: { x: c, y: s },
    ladoNaTela: p,
  }
}

/** O quanto a direção do chão olha para a luz (LUZ_3D sem a altura): -1 de costas, 1 de frente. */
function deFrenteParaALuz(d: { x: number; y: number }): number {
  return (d.x * LUZ_3D.x + d.y * LUZ_3D.y) / ((Math.hypot(d.x, d.y) || 1) * Math.hypot(LUZ_3D.x, LUZ_3D.y))
}

function caminho(g: CanvasRenderingContext2D, pontos: readonly Ponto[]): void {
  g.beginPath()
  pontos.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)))
  g.closePath()
}

/** Os dentes de uma ponta quebrada, do lado +v ao -v (`espelho` troca os lados). */
function dentesDaPonta(ponta: 'quebrada' | 'lascada', espelho: boolean): ReadonlyArray<readonly [number, number]> {
  const dentes = ponta === 'quebrada' ? DENTES_DA_QUEBRA : DENTES_DA_LASCA
  return espelho ? dentes.map(([dv, du]) => [-dv, du] as const).reverse() : dentes
}

/** A face do corte, ao longo do tronco NA TELA, em frações do raio: a de lado se vê de quina; a que olha para quem vê, quase redonda. */
const FACE_DO_CORTE = { deLado: 0.3, deFrente: 0.72 } as const
/** A face cabe no bojo da ponta serrada com uma beira de casca em volta (a face é 78% do bojo). */
const FACE_NO_BOJO = 0.78
/** O bojo da ponta redonda, na tela, em frações do raio. */
const BOJO_REDONDO = { deLado: 0.42, deFrente: 0.67 } as const

/**
 * O bojo da ponta redonda ou serrada, ao longo do tronco, em unidades de u.
 * A ponta que aponta para baixo na tela olha para quem vê e mostra mais de si
 * (o tronco curto apontando para baixo, com o corte achatado, parecia um toco
 * em pé); a que aponta para cima ou de lado fica com o bojo de quina.
 */
function bojoDaPonta(ponta: 'corte' | 'redonda', raio: number, para: 1 | -1, eixo: EixoDoTronco): number {
  const deFrente = Math.max(0, eixo.frente.y * para)
  const naTela =
    ponta === 'corte'
      ? (FACE_DO_CORTE.deLado + (FACE_DO_CORTE.deFrente - FACE_DO_CORTE.deLado) * deFrente) / FACE_NO_BOJO
      : BOJO_REDONDO.deLado + (BOJO_REDONDO.deFrente - BOJO_REDONDO.deLado) * deFrente
  return (naTela * raio) / eixo.encurta
}

/** Até onde a ponta passa do cilindro, em unidades (as faixas da casca vão até ali, e não além do quadro). */
function alcanceDaPonta(ponta: PontaDoTronco, raio: number, para: 1 | -1, eixo: EixoDoTronco): number {
  if (ponta === 'quebrada' || ponta === 'lascada') return Math.max(...dentesDaPonta(ponta, false).map(([, du]) => du))
  return bojoDaPonta(ponta, raio, para, eixo)
}

/** A ponta, do lado +v ao -v, sem os dois cantos (que são da borda do tronco). `para` = +1 na ponta u1, -1 na u0. */
function pontaDoContorno(ponta: PontaDoTronco, u: number, para: 1 | -1, raio: number, meio: number, espelho: boolean, eixo: EixoDoTronco): Ponto[] {
  if (ponta === 'quebrada' || ponta === 'lascada') return dentesDaPonta(ponta, espelho).map(([dv, du]) => [u + para * du, meio + raio * dv])
  const bojo = bojoDaPonta(ponta, raio, para, eixo)
  const pontos: Ponto[] = []
  const passos = 8
  for (let k = 1; k < passos; k++) {
    const fi = Math.PI / 2 - (Math.PI * k) / passos
    pontos.push([u + para * bojo * Math.cos(fi), meio + raio * Math.sin(fi)])
  }
  return pontos
}

function desenharTroncoCaido(g: CanvasRenderingContext2D, giro: number, semente: number): void {
  const variante = ((Math.round(semente) % 8) + 8) % 8
  const f = FORMAS_DO_TRONCO[FORMA_POR_VARIANTE[variante]]
  const eixo = eixoDoTronco(giro)
  const comprimento = f.u1 - f.u0
  const raio = (u: number) => f.raio * (1 + f.afina * (0.5 - (u - f.u0) / comprimento))
  // Uma curva leve: tronco de verdade não é cano.
  const arco = (sorteio(semente, 120) - 0.5) * 0.5 * f.raio
  const meio = (u: number) => arco * (1 - ((2 * (u - f.u0)) / comprimento - 1) ** 2)
  const espelho = sorteio(semente, 121) < 0.5
  const naTela = (lista: readonly Ponto[]) => lista.map(([u, v]) => eixo.ponto(u, v))

  // O contorno: a borda +v do pé à ponta, a ponta u1, a borda -v de volta e a ponta u0.
  const passos = 14
  const ao = (i: number) => f.u0 + (comprimento * i) / passos
  const contorno: Ponto[] = []
  for (let i = 0; i <= passos; i++) contorno.push([ao(i), meio(ao(i)) + raio(ao(i))])
  contorno.push(...pontaDoContorno(f.ponta1, f.u1, 1, raio(f.u1), meio(f.u1), espelho, eixo))
  for (let i = passos; i >= 0; i--) contorno.push([ao(i), meio(ao(i)) - raio(ao(i))])
  contorno.push(...pontaDoContorno(f.ponta0, f.u0, -1, raio(f.u0), meio(f.u0), espelho, eixo).reverse())
  const silhueta = naTela(contorno)

  // De que lado bate a luz: o lado +v (1) ou o -v (-1). Com o tronco apontando
  // para a luz os dois lados empatam, e o escuro fica no lado que a vista de
  // frente mostra por baixo (o de baixo na tela).
  const olhar = deFrenteParaALuz(eixo.lado)
  const ladoDaLuz = Math.abs(olhar) >= 0.16 ? Math.sign(olhar) : eixo.ladoNaTela.y > 0 ? -1 : 1
  const deLado = Math.abs(olhar)

  if (f.galho) desenharGalhoSeco(g, eixo, raio, meio, semente)

  g.fillStyle = css(TRONCO)
  caminho(g, silhueta)
  g.fill()

  g.save()
  caminho(g, silhueta)
  g.clip()
  // As faixas da casca, em frações do raio a partir do meio, no sentido do
  // lado da luz; a borda de cada uma ondula devagar ao longo do tronco.
  const alem = 1.3
  const faixa = (de: number, ate: number, cor: Rgb, onda: number) => {
    const borda = (u: number, x: number, k: number) =>
      Math.abs(x) >= alem ? x : x + 0.08 * Math.sin(u * 5.2 + sorteio(semente, onda + k) * Math.PI * 2)
    const ua = f.u0 - alcanceDaPonta(f.ponta0, raio(f.u0), -1, eixo) - 0.01
    const ub = f.u1 + alcanceDaPonta(f.ponta1, raio(f.u1), 1, eixo) + 0.01
    const pontos: Ponto[] = []
    for (let i = 0; i <= passos; i++) {
      const u = ua + ((ub - ua) * i) / passos
      pontos.push([u, meio(u) + ladoDaLuz * borda(u, de, 0) * raio(u)])
    }
    for (let i = passos; i >= 0; i--) {
      const u = ua + ((ub - ua) * i) / passos
      pontos.push([u, meio(u) + ladoDaLuz * borda(u, ate, 1) * raio(u)])
    }
    g.fillStyle = css(cor)
    caminho(g, naTela(pontos))
    g.fill()
  }
  faixa(-alem, -0.6 + 0.25 * deLado, TRONCO_SOMBRA, 130)
  const fimDaLuz = 0.5 + 0.5 * deLado
  faixa(-0.3 + 0.52 * deLado, 1 - fimDaLuz < 0.22 ? alem : fimDaLuz, CASCA_DA_LUZ, 132)

  // As pontas de madeira: o corte com os anéis, a quebra com a madeira rasgada.
  const pontas: Array<[PontaDoTronco, number, 1 | -1]> = [
    [f.ponta0, f.u0, -1],
    [f.ponta1, f.u1, 1],
  ]
  for (const [ponta, u, para] of pontas) {
    if (ponta === 'redonda') continue
    const luzDaPonta = 0.5 + 0.5 * deFrenteParaALuz({ x: eixo.frente.x * para, y: eixo.frente.y * para })
    if (ponta === 'corte') desenharCorte(g, eixo, u, para, raio(u), meio(u), luzDaPonta, ladoDaLuz)
    else {
      const fundo = ponta === 'quebrada' ? 0.075 : 0.05
      const fora = dentesDaPonta(ponta, espelho).map(([dv, du]): Ponto => [u + para * du, meio(u) + raio(u) * dv])
      const dentro = dentesDaPonta(ponta, espelho).map(([dv, du]): Ponto => [u + para * (du - fundo), meio(u) + raio(u) * dv * 0.8])
      g.fillStyle = css(misturar(CERNE_ESCURO, CERNE_CLARO, 0.15 + 0.6 * luzDaPonta))
      caminho(g, naTela([...fora, ...dentro.reverse()]))
      g.fill()
    }
  }

  if (f.musgo) desenharMusgo(g, eixo, f, raio, meio, ladoDaLuz, semente)
  g.restore()
}

/** O corte de serra visto meio de lado: a face clara (mais na luz quando a ponta olha para ela) e dois anéis calmos. */
function desenharCorte(g: CanvasRenderingContext2D, eixo: EixoDoTronco, u: number, para: 1 | -1, raio: number, meio: number, luz: number, ladoDaLuz: number): void {
  const [cx, cy] = eixo.ponto(u, meio)
  // A face cabe no bojo da ponta serrada, com uma beira de casca em volta.
  const rx = FACE_NO_BOJO * bojoDaPonta('corte', raio, para, eixo) * eixo.encurta
  const ry = 0.86 * raio
  const face = misturar(CERNE_ESCURO, CERNE_CLARO, 0.45 + 0.55 * luz)
  const anel = misturar(face, CERNE_ESCURO, 0.5)
  // O miolo fica um pouco fora do centro, para dentro e para o lado da sombra (a árvore cresceu torta).
  const [mx, my] = eixo.ponto(u - para * 0.012, meio - ladoDaLuz * raio * 0.12)
  const elipse = (x: number, y: number, k: number, cor: Rgb) => {
    g.fillStyle = css(cor)
    g.beginPath()
    g.ellipse(x, y, rx * k, ry * k, eixo.angulo, 0, Math.PI * 2)
    g.fill()
  }
  elipse(cx, cy, 1, face)
  elipse(cx + (mx - cx) * 0.4, cy + (my - cy) * 0.4, 0.72, anel)
  elipse(cx + (mx - cx) * 0.6, cy + (my - cy) * 0.6, 0.56, face)
  elipse(mx, my, 0.26, misturar(face, anel, 0.6))
}

/** O galho seco: sai de um lado perto do meio, afina até a ponta e abre um raminho. Vai por baixo do tronco (a base some nele). */
function desenharGalhoSeco(
  g: CanvasRenderingContext2D,
  eixo: EixoDoTronco,
  raio: (u: number) => number,
  meio: (u: number) => number,
  semente: number,
): void {
  const lado = sorteio(semente, 140) < 0.5 ? 1 : -1
  const ub = 0.1 + 0.08 * sorteio(semente, 141)
  const base: Ponto = [ub, meio(ub) + lado * raio(ub) * 0.55]
  const ramo = (de: Ponto, angulo: number, comprimento: number, grosso: number, fino: number) => {
    const du = Math.cos(angulo)
    const dv = lado * Math.sin(angulo)
    const n: Ponto = [-dv, du]
    const curva = 0.025 * lado
    const ponta: Ponto = [de[0] + du * comprimento, de[1] + dv * comprimento]
    const meioDoRamo: Ponto = [de[0] + du * comprimento * 0.5 + n[0] * curva, de[1] + dv * comprimento * 0.5 + n[1] * curva]
    const largura = (grosso + fino) / 2
    caminho(
      g,
      [
        [de[0] + n[0] * grosso, de[1] + n[1] * grosso],
        [meioDoRamo[0] + n[0] * largura, meioDoRamo[1] + n[1] * largura],
        [ponta[0] + n[0] * fino, ponta[1] + n[1] * fino],
        [ponta[0] - n[0] * fino, ponta[1] - n[1] * fino],
        [meioDoRamo[0] - n[0] * largura, meioDoRamo[1] - n[1] * largura],
        [de[0] - n[0] * grosso, de[1] - n[1] * grosso],
      ].map(([u, v]) => eixo.ponto(u, v)),
    )
    g.fill()
  }
  g.fillStyle = css(GALHO_SECO)
  const angulo = 0.92
  const comprimento = 0.3
  // Grosso o bastante para ler a 25% de zoom: mais fino que isso vira risco.
  ramo(base, angulo, comprimento, 0.045, 0.014)
  // O raminho: do terço de fora do galho, abrindo para a ponta do tronco.
  const t = 0.62
  const forquilha: Ponto = [base[0] + Math.cos(angulo) * comprimento * t, base[1] + lado * Math.sin(angulo) * comprimento * t]
  ramo(forquilha, angulo - 0.7, 0.11, 0.022, 0.009)
}

/**
 * O musgo: uma almofada só, por cima do tronco, na metade do pé — redonda nas
 * duas pontas, de borda que ondula devagar (dois ou três calombos largos,
 * nunca bolinha), com a parte que olha para a luz mais clara. Os tons são os
 * do arbusto, para os dois conversarem no mapa.
 */
function desenharMusgo(
  g: CanvasRenderingContext2D,
  eixo: EixoDoTronco,
  f: FormaDoTronco,
  raio: (u: number) => number,
  meio: (u: number) => number,
  ladoDaLuz: number,
  semente: number,
): void {
  const comprimento = f.u1 - f.u0
  const almofada = (inicio: number, fim: number, de: number, ate: number, cor: Rgb, onda: number) => {
    const passos = 18
    // O perfil: cheio no meio, fechando em curva nas duas pontas.
    const cheio = (t: number) => Math.sqrt(Math.max(0, Math.sin(Math.PI * t)))
    const borda = (u: number, t: number, x: number, k: number) => (x + 0.16 * Math.sin(u * 11 + sorteio(semente, onda + k) * Math.PI * 2)) * cheio(t)
    const pontos: Ponto[] = []
    for (let i = 0; i <= passos; i++) {
      const t = i / passos
      const u = inicio + (fim - inicio) * t
      pontos.push([u, meio(u) + ladoDaLuz * borda(u, t, ate, 0) * raio(u)])
    }
    for (let i = passos; i >= 0; i--) {
      const t = i / passos
      const u = inicio + (fim - inicio) * t
      pontos.push([u, meio(u) + ladoDaLuz * borda(u, t, de, 1) * raio(u)])
    }
    g.fillStyle = css(cor)
    caminho(g, pontos.map(([u, v]) => eixo.ponto(u, v)))
    g.fill()
  }
  // Por cima e descendo pelo lado da sombra (onde o musgo cresce): a manta
  // passa da borda escura e o contorno do tronco a corta, então ela abraça o
  // tronco em vez de pousar nele como uma folha.
  const inicio = f.u0 + 0.03
  const fim = f.u0 + comprimento * 0.55
  almofada(inicio, fim, -1.25, 0.58, TONS_DO_ARBUSTO.escuro, 150)
  almofada(inicio + comprimento * 0.06, fim - comprimento * 0.12, -0.2, 0.5, TONS_DO_ARBUSTO.medio, 152)
}

// ---------------------------------------------------------------------------

export const CARIMBOS_EMBUTIDOS: readonly DefinicaoDeCarimbo[] = [
  { id: 'pinheiro', nome: 'Pinheiro', tamanho: 14, sombra: 'em-pe', desenhar: (g, giro, semente) => desenharPinheiro(g, giro, semente, false) },
  { id: 'pinheiro-nevado', nome: 'Pinheiro com neve', tamanho: 14, sombra: 'em-pe', desenhar: (g, giro, semente) => desenharPinheiro(g, giro, semente, true) },
  { id: 'arvore', nome: 'Árvore', tamanho: 15, sombra: 'em-pe', desenhar: desenharArvore },
  { id: 'arvore-redonda', nome: 'Árvore redonda', tamanho: 14, sombra: 'em-pe', desenhar: desenharArvoreRedonda },
  { id: 'arbusto', nome: 'Arbusto', tamanho: 6, sombra: 'baixa', desenhar: (g, giro, semente) => desenharCopa(g, giro, semente, TONS_DO_ARBUSTO, -0.3, 0.4) },
  // Ao lado do arbusto, com a mata. Tamanho 10 (o das pedras): ~1,3 unidade de
  // ponta a ponta = 13 px do protótipo, umas 2 casas num mapa de 200 × 200.
  { id: 'tronco-caido', nome: 'Tronco caído', tamanho: 10, sombra: 'deitada', desenhar: desenharTroncoCaido },
  { id: 'palmeira', nome: 'Palmeira', tamanho: 13, sombra: 'em-pe', desenhar: desenharPalmeira },
  { id: 'pedras', nome: 'Pedras', tamanho: 10, sombra: 'baixa', desenhar: desenharPedras },
  { id: 'poca', nome: 'Poça', tamanho: 12, sombra: 'nenhuma', desenhar: desenharPoca },
  { id: 'juncos', nome: 'Juncos', tamanho: 6, sombra: 'baixa', desenhar: desenharJuncos },
]

export const IDS_DOS_EMBUTIDOS: readonly string[] = CARIMBOS_EMBUTIDOS.map((c) => c.id)

/** Todas as cores chapadas da biblioteca, para o teste de "não estoura". */
export const PALETA_DOS_EMBUTIDOS: readonly Rgb[] = [
  PINHO_CLARO,
  PINHO_ESCURO,
  TRONCO,
  TRONCO_SOMBRA,
  NEVE,
  NEVE_SOMBRA,
  PINHO_FRIO_CLARO,
  PINHO_FRIO_ESCURO,
  ...Object.values(TONS_DA_ARVORE),
  ARVORE_SOMBRA_DA_COPA,
  REDONDA_CONTORNO,
  REDONDA_ESCURO,
  REDONDA_MEDIO,
  REDONDA_CLARO,
  REDONDA_FLOR_ROSA,
  REDONDA_FLOR_BRANCA,
  ...Object.values(TONS_DO_ARBUSTO),
  CASCA_DA_LUZ,
  GALHO_SECO,
  CERNE_CLARO,
  CERNE_ESCURO,
  PALMEIRA_TRONCO,
  PALMEIRA_TRONCO_SOMBRA,
  FOLHA_CLARA,
  FOLHA_ESCURA,
  COCO,
  PEDRA_CLARA,
  PEDRA_MEIA,
  PEDRA_ESCURA,
  MARGEM,
  AGUA_FUNDA,
  AGUA_RASA,
  BEIRA_DE_LUZ,
  REFLEXO,
  JUNCO_CLARO,
  JUNCO_ESCURO,
  TABOA,
]
