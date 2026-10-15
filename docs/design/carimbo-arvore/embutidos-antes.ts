/**
 * A BIBLIOTECA INICIAL de carimbos (fatia 5 do plano do relevo): os objetos do
 * protótipo Diorama (`mapa-vivo/diorama`), redesenhados um a um para a
 * ferramenta Carimbos — pinheiro, pinheiro com neve, árvore, arbusto,
 * palmeira, pedras da serra, poça do pântano e juncos.
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

/** Como a sombra cai: `em-pe` (alto, sombra comprida), `baixa` (rente ao chão) ou `nenhuma` (do chão, como a poça). */
export type SombraDoCarimbo = 'em-pe' | 'baixa' | 'nenhuma'

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
// Copa redonda (árvore e arbusto): a silhueta é a união de lóbulos em volta
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

function desenharCopa(g: CanvasRenderingContext2D, giro: number, semente: number, tons: TonsDaCopa, cy: number, raio: number): void {
  g.fillStyle = css(tons.escuro)
  circulos(g, lobulos(cy, raio, giro, semente, 1, 0, 0))
  g.fillStyle = css(tons.medio)
  circulos(g, lobulos(cy, raio, giro, semente, 0.78, -raio * 0.12, -raio * 0.15))
  // Brilho: uma copa pequena no alto à esquerda, onde a luz bate em cheio.
  g.fillStyle = css(tons.claro)
  circulos(g, lobulos(cy, raio, giro, semente, 0.4, -raio * 0.34, -raio * 0.38))
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

export const CARIMBOS_EMBUTIDOS: readonly DefinicaoDeCarimbo[] = [
  { id: 'pinheiro', nome: 'Pinheiro', tamanho: 14, sombra: 'em-pe', desenhar: (g, giro, semente) => desenharPinheiro(g, giro, semente, false) },
  { id: 'pinheiro-nevado', nome: 'Pinheiro com neve', tamanho: 14, sombra: 'em-pe', desenhar: (g, giro, semente) => desenharPinheiro(g, giro, semente, true) },
  { id: 'arvore', nome: 'Árvore', tamanho: 12, sombra: 'em-pe', desenhar: (g, giro, semente) => desenharCopa(g, giro, semente, TONS_DA_ARVORE, -0.4, 0.42) },
  { id: 'arbusto', nome: 'Arbusto', tamanho: 6, sombra: 'baixa', desenhar: (g, giro, semente) => desenharCopa(g, giro, semente, TONS_DO_ARBUSTO, -0.3, 0.4) },
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
  ...Object.values(TONS_DO_ARBUSTO),
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
