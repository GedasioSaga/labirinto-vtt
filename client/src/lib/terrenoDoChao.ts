import type { Drawing, FloorPiece, FloorShape, MapData, PinceladaDeTextura, RegionPoint } from '../types/map'
import { aneisDoCampo, floorSampleStep, type FloorClip } from './floorContour'
import { pieceBounds, pieceDistance, pontosDoCorredor, valueNoise, type Bounds, type CompiledFloor } from './floorSdf'

/**
 * TERRENO DO CHÃO (pedido CHÃO E CAMINHO de 12/11/2026, aprovado com "perfeito
 * é exatamente isso"): caminho e área são a mesma coisa, uma peça de Chão com
 * MATERIAL (`FloorPiece.material`, o id de uma textura da biblioteca).
 *
 * - A peça sem material é o Liso de sempre: cor lisa, desenhada embaixo das
 *   Texturas (`floorGraphics`), como todo mapa de antes abre.
 * - A peça com material sai da cor lisa e vai para o TERRENO, uma faixa acima
 *   das Texturas e abaixo da luz do relevo (`lib/camadas/ordem.ts`): a textura
 *   dela vista pela forma, pintada pelo mesmo motor das Texturas
 *   (`pixi/drawTexturas.ts`), com a beira nítida em vez da esfumada do pincel.
 * - As peças do MESMO material viram uma forma só (os cruzamentos se fundem,
 *   com o canto de dentro arredondado), na posição da mais nova; material
 *   diferente: o mais novo por cima, como numa pintura.
 * - A BORDA (`FloorPiece.borda`, 0 a 1) é só aparência: a beira ondula, a
 *   largura varia e, no calçamento e no cascalho, pedras soltas saem inteiras
 *   para fora. O LIMITE do "Fora do Chão" continua sendo a forma limpa
 *   (`lib/floorSdf.ts`, sem nada disto), e a peça com `soPintura` não limita.
 *
 * Função pura sobre as peças (nada de Pixi): o pintor (`pixi/terrenoDoChao.ts`)
 * só recebe os passos de balde que daqui saem.
 */

export interface MaterialDoChao {
  /** Id da textura da biblioteca (`texturas/embutidas.ts`) que a peça guarda; `null` = Liso. */
  readonly textura: string | null
  readonly nome: string
  /** Solta pedras inteiras na borda (calçamento, cascalho). */
  readonly pedras: boolean
  /** A cor da amostra no painel (a média do material, do protótipo aprovado). */
  readonly amostra: string
  /** A cor lisa com que o app de antes pintava esse chão (Caminho e tintas do Chão): o "Dar material" acha o material por ela. */
  readonly hoje: string
}

/** Os materiais do painel, na ordem do protótipo aprovado. */
export const MATERIAIS_DO_CHAO: readonly MaterialDoChao[] = [
  { textura: 'calcamento', nome: 'Calçamento', pedras: true, amostra: '#c9c4b8', hoje: '#6e6e72' },
  { textura: 'terra', nome: 'Terra batida', pedras: false, amostra: '#977b55', hoje: '#8a6a45' },
  { textura: 'cascalho', nome: 'Cascalho', pedras: true, amostra: '#b2a68e', hoje: '#8f8a80' },
  { textura: 'areia', nome: 'Areia', pedras: false, amostra: '#cfbb82', hoje: '#cbb57e' },
  { textura: 'conves', nome: 'Tábuas', pedras: false, amostra: '#8d6239', hoje: '#8d6239' },
  { textura: 'grama', nome: 'Grama', pedras: false, amostra: '#7fc468', hoje: '#4a6b35' },
  { textura: null, nome: 'Liso', pedras: false, amostra: '#a8776a', hoje: '#a8776a' },
]

/** Teto do id do material no arquivo (os ids da biblioteca e da importada cabem com folga). */
const MATERIAL_MAX = 80
const ID_DE_MATERIAL = /^[a-z0-9][a-z0-9:_-]*$/i

/** O material do arquivo, só se servir: texto curto de id. O resto (torto, vazio) é AUSENTE, o Liso de antes. */
export function lerMaterial(valor: unknown): string | undefined {
  return typeof valor === 'string' && valor.length <= MATERIAL_MAX && ID_DE_MATERIAL.test(valor) ? valor : undefined
}

/** A borda do arquivo, só se for número entre 0 e 1 (0 = reta, ausente). */
export function lerBorda(valor: unknown): number | undefined {
  return typeof valor === 'number' && Number.isFinite(valor) && valor > 0 ? Math.min(1, valor) : undefined
}

/**
 * Os campos do terreno de uma peça lida do arquivo: só o que serve fica.
 * Material torto, borda fora de número, `soPintura` que não é `true` e
 * `suave` que não é `true` saem (a peça volta Lisa, com limite e em retas,
 * como antes destes campos). Peça sem nenhum deles volta a mesma.
 */
export function terrenoDoArquivo<T extends FloorPiece>(peca: T): T {
  const material = lerMaterial(peca.material)
  const borda = lerBorda(peca.borda)
  const shape = peca.shape
  const suaveTorto = shape?.kind === 'corridor' && shape.suave !== undefined && shape.suave !== true
  if (material === peca.material && borda === peca.borda && (peca.soPintura === undefined || peca.soPintura === true) && !suaveTorto) return peca
  const limpa: T = { ...peca }
  if (material === undefined) delete limpa.material
  else limpa.material = material
  if (borda === undefined) delete limpa.borda
  else limpa.borda = borda
  if (limpa.soPintura !== true) delete limpa.soPintura
  if (shape?.kind === 'corridor' && suaveTorto) {
    const semSuave = { ...shape }
    delete semSuave.suave
    limpa.shape = semSuave
  }
  return limpa
}

/** A peça é terreno (tem material)? */
export function temMaterial(peca: FloorPiece): boolean {
  return peca.material !== undefined && peca.material !== ''
}

const lisaPorPeca = new WeakMap<FloorPiece, FloorPiece>()

/**
 * A peça como Chão LISO: sem o material e sem a borda (que só vale com
 * material). O recorte do jogador manda assim a peça de que ele não conhece
 * pedaço nenhum (`lib/fogFilter.ts`): a forma vai, como o chão de todo lugar
 * ainda não visto, e o material, que é a textura dela, segue a regra das
 * Texturas, que não saem do lugar que ele não conhece. Guardada pela peça (a
 * store é imutável): a mesma peça volta o MESMO objeto, e o "só o que mudou"
 * do pacote não a reenvia a cada recorte.
 */
export function semMaterial(peca: FloorPiece): FloorPiece {
  if (peca.material === undefined && peca.borda === undefined) return peca
  let lisa = lisaPorPeca.get(peca)
  if (lisa === undefined) {
    lisa = { ...peca }
    delete lisa.material
    delete lisa.borda
    lisaPorPeca.set(peca, lisa)
  }
  return lisa
}

/** Teto de amostras de uma peça para o recorte: peça enorme não vira milhares de perguntas por recorte. */
const AMOSTRAS_MAXIMAS = 512
/** Divisões por lado da grade de amostras das formas de área (retângulo, elipse, polígono, livre). */
const DIVISOES_DA_AREA = 24
/** Fração da meia largura do caminho onde ficam as amostras das beiras (dentro dele). */
const BEIRA_DAS_AMOSTRAS = 0.8

/** Só uma a cada `passo`, para caber no teto. */
function rarear<T>(lista: readonly T[], teto: number): T[] {
  if (lista.length <= teto) return [...lista]
  const passo = lista.length / teto
  const saida: T[] = []
  for (let i = 0; i < teto; i += 1) saida.push(lista[Math.floor(i * passo)])
  return saida
}

/** O caminho: a linha do meio e as duas beiras de dentro, a cada meia casa. */
function amostrasDoCorredor(shape: Extract<FloorShape, { kind: 'corridor' }>, grid: number): RegionPoint[] {
  const linha = pontosDoCorredor(shape)
  const passo = Math.max(1, grid / 2)
  const saida: RegionPoint[] = []
  for (let i = 0; i < linha.length; i += 1) {
    const a = linha[i]
    const b = linha[Math.min(linha.length - 1, i + 1)]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const tamanho = Math.hypot(dx, dy)
    const n = i + 1 < linha.length ? Math.max(1, Math.ceil(tamanho / passo)) : 1
    // Rumo do trecho (o último ponto usa o do trecho de antes); trecho parado: só o ponto.
    const ref = tamanho > 0 ? { dx, dy, tamanho } : null
    for (let k = 0; k < n; k += 1) {
      const t = i + 1 < linha.length ? k / n : 0
      const x = a.x + dx * t
      const y = a.y + dy * t
      saida.push({ x, y })
      if (ref === null) continue
      const meia = ((a.width + (b.width - a.width) * t) / 2) * BEIRA_DAS_AMOSTRAS
      const nx = (-ref.dy / ref.tamanho) * meia
      const ny = (ref.dx / ref.tamanho) * meia
      saida.push({ x: x + nx, y: y + ny }, { x: x - nx, y: y - ny })
    }
  }
  return saida
}

/**
 * Pontos DENTRO da peça para o recorte perguntar se o jogador conhece algum
 * pedaço dela (`lib/fogFilter.ts`): no caminho, a linha do meio e as duas
 * beiras de dentro a cada meia casa; nos blocos, o meio de cada célula; nas
 * outras formas, uma grade na caixa. Até `AMOSTRAS_MAXIMAS` pontos.
 */
export function amostrasDoTerreno(peca: FloorPiece, grid: number): RegionPoint[] {
  const shape = peca.shape
  const girada = (peca.rotation ?? 0) !== 0
  let pontos: RegionPoint[]
  if (shape.kind === 'corridor' && !girada) pontos = amostrasDoCorredor(shape, grid)
  else if (shape.kind === 'blocos' && !girada) pontos = shape.cells.map((c) => ({ x: (c.col + 0.5) * shape.cell, y: (c.row + 0.5) * shape.cell }))
  else {
    const b = pieceBounds(peca)
    const passo = Math.max(grid / 2, (b.maxX - b.minX) / DIVISOES_DA_AREA, (b.maxY - b.minY) / DIVISOES_DA_AREA, 1)
    pontos = []
    for (let y = b.minY + passo / 2; y < b.maxY; y += passo) {
      for (let x = b.minX + passo / 2; x < b.maxX; x += passo) if (pieceDistance(peca, x, y) <= 0) pontos.push({ x, y })
    }
  }
  return rarear(pontos, AMOSTRAS_MAXIMAS)
}

const lisasPorLista = new WeakMap<FloorPiece[], FloorPiece[]>()

/**
 * As peças que o Chão LISO desenha (`floorGraphics`): todas menos as que têm
 * material. Sem nenhuma com material, a própria lista (mesma referência: o
 * contorno guardado por lista não se perde); com alguma, uma lista guardada
 * por lista, para a referência também não mudar a cada desenho.
 */
export function pecasLisas(floor: FloorPiece[]): FloorPiece[] {
  if (!floor.some(temMaterial)) return floor
  let lisas = lisasPorLista.get(floor)
  if (lisas === undefined) {
    lisas = floor.filter((p) => !temMaterial(p))
    lisasPorLista.set(floor, lisas)
  }
  return lisas
}

const limitamPorLista = new WeakMap<FloorPiece[], FloorPiece[]>()

/**
 * As peças que LIMITAM visão e passo (`lib/offFloor.ts`): todas menos as
 * marcadas `soPintura` ("Conta como Chão" desligado). Mesma regra de
 * referência de `pecasLisas`: mapa sem nenhuma devolve a própria lista.
 */
export function pecasQueLimitam(floor: FloorPiece[]): FloorPiece[] {
  if (!floor.some((p) => p.soPintura === true)) return floor
  let limitam = limitamPorLista.get(floor)
  if (limitam === undefined) {
    limitam = floor.filter((p) => p.soPintura !== true)
    limitamPorLista.set(floor, limitam)
  }
  return limitam
}

// ---------------------------------------------------------------------------
// A ferramenta: o terreno da próxima peça e o traço do Caminho

/** O terreno da PRÓXIMA peça (`stores/terrenoStore.ts`). `material: null` = Liso. */
export interface TerrenoDaFerramenta {
  material: string | null
  larguraEmCasas: number
  borda: number
  contaComoChao: boolean
}

/** Os padrões do protótipo aprovado: Calçamento, 2 casas, borda de 60%. */
export const MATERIAL_PADRAO = 'calcamento'
export const LARGURA_PADRAO_EM_CASAS = 2
export const BORDA_PADRAO = 0.6
/** A faixa de largura do Caminho de antes (`lib/drawingFactory.ts`): meia casa a quatro. */
export const LARGURA_MINIMA_EM_CASAS = 0.5
export const LARGURA_MAXIMA_EM_CASAS = 4

/** A peça com o terreno da ferramenta: material, borda (só com material) e "Conta como Chão". */
export function comTerreno(peca: FloorPiece, terreno: TerrenoDaFerramenta): FloorPiece {
  const nova: FloorPiece = { ...peca }
  // Buraco não tem material nem deixa de limitar: ele tira o que está embaixo.
  if (peca.op !== 'add') return nova
  if (terreno.material !== null) {
    nova.material = terreno.material
    const borda = Math.round(Math.min(1, Math.max(0, terreno.borda)) * 100) / 100
    if (borda > 0) nova.borda = borda
  }
  if (!terreno.contaComoChao) nova.soPintura = true
  return nova
}

/** Mão parada no traço arrastado: pontos mais perto que isto (em casas) não entram. */
export const PASSO_DO_TRACO_EM_CASAS = 0.2
/** Desvio aceito ao enxugar o traço arrastado, em casas: a curva sai lisa, sem o tremor da mão. */
const TOLERANCIA_DO_TRACO_EM_CASAS = 0.12

interface Ponto {
  x: number
  y: number
}

/** Douglas-Peucker numa linha aberta: fica o primeiro, o último e os pontos que desviam mais que `tolerancia`. */
function enxugar(pontos: readonly Ponto[], tolerancia: number): Ponto[] {
  if (pontos.length <= 2) return [...pontos]
  const manter = new Array<boolean>(pontos.length).fill(false)
  manter[0] = true
  manter[pontos.length - 1] = true
  const pilha: Array<[number, number]> = [[0, pontos.length - 1]]
  while (pilha.length > 0) {
    const trecho = pilha.pop()
    if (trecho === undefined) break
    const [i0, i1] = trecho
    const a = pontos[i0]
    const b = pontos[i1]
    const ex = b.x - a.x
    const ey = b.y - a.y
    const tamanho = Math.hypot(ex, ey)
    let pior = -1
    let indice = -1
    for (let i = i0 + 1; i < i1; i += 1) {
      const p = pontos[i]
      const d = tamanho === 0 ? Math.hypot(p.x - a.x, p.y - a.y) : Math.abs((p.x - a.x) * ey - (p.y - a.y) * ex) / tamanho
      if (d > pior) {
        pior = d
        indice = i
      }
    }
    if (indice >= 0 && pior > tolerancia) {
      manter[indice] = true
      pilha.push([i0, indice], [indice, i1])
    }
  }
  return pontos.filter((_, i) => manter[i])
}

/**
 * O traço da forma CAMINHO do Chão: um corredor `suave` (curva pelos pontos),
 * com a mesma largura em todos. Repetição seguida (o duplo clique) sai; o
 * traço arrastado é enxugado para a curva não tremer. Menos de 2 pontos
 * distintos não é caminho.
 */
export function buildCaminhoShape(pontos: readonly Ponto[], largura: number, grid: number): FloorShape | null {
  if (!(largura > 0)) return null
  const distintos: Ponto[] = []
  for (const p of pontos) {
    const ultimo = distintos[distintos.length - 1]
    if (ultimo === undefined || ultimo.x !== p.x || ultimo.y !== p.y) distintos.push({ x: p.x, y: p.y })
  }
  if (distintos.length < 2) return null
  const enxuto = enxugar(distintos, TOLERANCIA_DO_TRACO_EM_CASAS * grid)
  return { kind: 'corridor', suave: true, points: enxuto.map((p) => ({ x: p.x, y: p.y, width: largura })) }
}

// ---------------------------------------------------------------------------
// A forma de cada material

/** Raio da fusão entre trechos do mesmo material, em casas: o canto de dentro do cruzamento arredonda. */
const FUSAO_EM_CASAS = 0.3
/** Ondulação larga da borda (em casas, com a borda em 100%) e o comprimento de onda dela. */
const ONDA_LARGA = { amplitude: 0.16, escala: 0.75 }
/** Ondulação fina (a beira "comida" pelo capim), mais forte na grama. */
const ONDA_FINA = { amplitude: 0.05, escala: 0.16 }
const ONDA_FINA_DA_GRAMA = { amplitude: 0.09, escala: 0.12 }
/** Pedras soltas: lado da célula em que cada uma pode cair, raio, e até onde saem da forma limpa (casas). */
const PEDRA = { celula: 0.42, raioMin: 0.07, raioVar: 0.07, alcance: 0.4, chance: 0.6 }
/** Passo da grade do contorno do terreno, em px de mundo (o do Chão). */
const PASSO_DO_CONTORNO = 3
/** Folga do descarte por caixa, além da fusão. */
const FOLGA_DO_DESCARTE = 8
/** Inclinação do `valueNoise` por unidade de entrada, com folga (a mesma conta de `floorSdf.ts`). */
const INCLINACAO_DO_RUIDO = 6.5
const SEMENTE_DA_BORDA = 7121
/** Folga da grade das pedras além da área do contorno, em px (a moldura de amostras e a volta de 3×3 células cabem). */
const MARGEM_DA_GRADE_DE_PEDRAS = 128
/** Teto de células da grade das pedras (~8 MB): acima disso, só o mapa por texto. */
const CELULAS_MAXIMAS_DA_GRADE_DE_PEDRAS = 1_000_000

/** Mínimo suave polinomial: igual ao `min` longe da junta, arredonda o canto onde as duas se cruzam. */
function minSuave(a: number, b: number, k: number): number {
  if (k <= 0) return Math.min(a, b)
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}

function distanciaACaixa(b: Bounds, x: number, y: number): number {
  const dx = Math.max(b.minX - x, 0, x - b.maxX)
  const dy = Math.max(b.minY - y, 0, y - b.maxY)
  return Math.hypot(dx, dy)
}

function hashDaCelula(ix: number, iy: number, semente: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(semente, 982451653)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

interface Entrada {
  peca: FloorPiece
  soma: boolean
  caixa: Bounds
  descarte: Bounds
  borda: number
}

/** Uma pedra solta: centro e raio, em px de mundo. */
interface Pedra {
  x: number
  y: number
  r: number
}

/** O campo de distância de um material: as peças dele fundidas, os buracos depois delas, a borda e as pedras. */
function campoDoMaterial(floor: readonly FloorPiece[], textura: string, grid: number, pedras: boolean): CompiledFloor | null {
  const entradas: Entrada[] = []
  const fusao = FUSAO_EM_CASAS * grid
  let caixa: Bounds | null = null
  let bordaMaxima = 0
  let inclinacao = 0
  for (const peca of floor) {
    if (peca.hidden === true) continue
    const soma = peca.op === 'add'
    if (soma && peca.material !== textura) continue
    // Buraco antes da primeira peça do material não tira nada dele.
    if (!soma && entradas.length === 0) continue
    const c = pieceBounds(peca)
    const borda = soma ? Math.min(1, Math.max(0, peca.borda ?? 0)) : 0
    const margem = fusao + FOLGA_DO_DESCARTE
    entradas.push({ peca, soma, caixa: c, descarte: { minX: c.minX - margem, minY: c.minY - margem, maxX: c.maxX + margem, maxY: c.maxY + margem }, borda })
    const ruido = peca.modifiers.noise
    if (ruido && ruido.amplitude > 0 && ruido.scale > 0) inclinacao = Math.max(inclinacao, (INCLINACAO_DO_RUIDO * ruido.amplitude) / ruido.scale)
    if (!soma) continue
    bordaMaxima = Math.max(bordaMaxima, borda)
    caixa = caixa === null ? { ...c } : { minX: Math.min(caixa.minX, c.minX), minY: Math.min(caixa.minY, c.minY), maxX: Math.max(caixa.maxX, c.maxX), maxY: Math.max(caixa.maxY, c.maxY) }
  }
  if (caixa === null) return null
  const fina = textura === 'grama' ? ONDA_FINA_DA_GRAMA : ONDA_FINA
  const comPedras = pedras && bordaMaxima > 0

  /** A forma limpa do material (sem borda nem pedras): é dela que as pedras se medem. */
  const limpa = (x: number, y: number): number => {
    let d = Infinity
    for (const e of entradas) {
      const c = e.descarte
      const fora = x < c.minX || x > c.maxX || y < c.minY || y > c.maxY
      const p = fora ? Math.max(distanciaACaixa(e.caixa, x, y), FOLGA_DO_DESCARTE) : pieceDistance(e.peca, x, y)
      d = e.soma ? minSuave(d, p, fusao) : Math.max(d, -p)
    }
    return d
  }

  /** Quanto de borda vale perto do ponto: a da peça do material mais perto (cada traço tem a sua). */
  const bordaPerto = (x: number, y: number): number => {
    let melhor = Infinity
    let borda = 0
    for (const e of entradas) {
      if (!e.soma || e.borda === 0) continue
      const d = distanciaACaixa(e.caixa, x, y)
      if (d < melhor) {
        melhor = d
        borda = e.borda
      }
    }
    return borda
  }

  const folga = bordaMaxima * grid * (ONDA_LARGA.amplitude + fina.amplitude + (comPedras ? PEDRA.alcance + PEDRA.raioMin + PEDRA.raioVar : 0)) + fusao
  const bounds = { minX: caixa.minX - folga, minY: caixa.minY - folga, maxX: caixa.maxX + folga, maxY: caixa.maxY + folga }

  const lado = PEDRA.celula * grid
  // A pedra de cada célula guardada numa grade densa sobre a área do contorno (com folga); fora dela, no mapa
  // por texto de sempre. A pedra só depende da célula: muda onde se guarda, não o que se guarda (FX-CAMINHO-062).
  const celulaMinX = Math.floor((bounds.minX - MARGEM_DA_GRADE_DE_PEDRAS) / lado)
  const celulaMinY = Math.floor((bounds.minY - MARGEM_DA_GRADE_DE_PEDRAS) / lado)
  const colunasDaGrade = Math.floor((bounds.maxX + MARGEM_DA_GRADE_DE_PEDRAS) / lado) - celulaMinX + 1
  const linhasDaGrade = Math.floor((bounds.maxY + MARGEM_DA_GRADE_DE_PEDRAS) / lado) - celulaMinY + 1
  const temGrade = comPedras && colunasDaGrade > 0 && linhasDaGrade > 0 && colunasDaGrade * linhasDaGrade <= CELULAS_MAXIMAS_DA_GRADE_DE_PEDRAS
  const gradeDePedras: Array<Pedra | null | undefined> = temGrade ? new Array<Pedra | null | undefined>(colunasDaGrade * linhasDaGrade) : []
  const pedrasPorCelula = new Map<string, Pedra | null>()
  const pedraDaCelula = (ix: number, iy: number): Pedra | null => {
    const gx = ix - celulaMinX
    const gy = iy - celulaMinY
    const naGrade = temGrade && gx >= 0 && gy >= 0 && gx < colunasDaGrade && gy < linhasDaGrade ? gy * colunasDaGrade + gx : -1
    const chave = naGrade >= 0 ? '' : `${ix},${iy}`
    const guardada = naGrade >= 0 ? gradeDePedras[naGrade] : pedrasPorCelula.get(chave)
    if (guardada !== undefined) return guardada
    let pedra: Pedra | null = null
    const x = (ix + 0.2 + 0.6 * hashDaCelula(ix, iy, 11)) * lado
    const y = (iy + 0.2 + 0.6 * hashDaCelula(ix, iy, 12)) * lado
    const borda = bordaPerto(x, y)
    if (borda > 0 && hashDaCelula(ix, iy, 13) < PEDRA.chance * borda) {
      const r = (PEDRA.raioMin + PEDRA.raioVar * hashDaCelula(ix, iy, 14)) * grid
      const d = limpa(x, y)
      // Só a pedra que cai FORA da forma limpa e perto dela: dentro, ela já é caminho.
      if (d > r * 0.3 && d < PEDRA.alcance * grid * borda + r) pedra = { x, y, r }
    }
    if (naGrade >= 0) gradeDePedras[naGrade] = pedra
    else pedrasPorCelula.set(chave, pedra)
    return pedra
  }

  // As 9 pedras em volta da última célula pedida, na ordem de sempre: o contorno anda 3 px por amostra e a célula
  // tem ~27, então a mesma volta serve às amostras seguidas (eram 9 buscas por texto a cada amostra; FX-CAMINHO-062).
  let celulaX = Number.NaN
  let celulaY = Number.NaN
  const pedrasEmVolta: Array<Pedra | null> = new Array<Pedra | null>(9).fill(null)

  const sample = (x: number, y: number): number => {
    let d = limpa(x, y)
    if (bordaMaxima > 0) {
      const borda = bordaPerto(x, y)
      if (borda > 0) {
        const larga = valueNoise(x / (ONDA_LARGA.escala * grid), y / (ONDA_LARGA.escala * grid), SEMENTE_DA_BORDA) * ONDA_LARGA.amplitude
        const miuda = valueNoise(x / (fina.escala * grid), y / (fina.escala * grid), SEMENTE_DA_BORDA + 1) * fina.amplitude
        d += (larga + miuda) * grid * borda
      }
    }
    if (comPedras) {
      const ix = Math.floor(x / lado)
      const iy = Math.floor(y / lado)
      if (ix !== celulaX || iy !== celulaY) {
        celulaX = ix
        celulaY = iy
        let k = 0
        for (let oy = -1; oy <= 1; oy += 1) {
          for (let ox = -1; ox <= 1; ox += 1) {
            pedrasEmVolta[k] = pedraDaCelula(ix + ox, iy + oy)
            k += 1
          }
        }
      }
      for (const pedra of pedrasEmVolta) {
        if (pedra !== null) d = Math.min(d, Math.hypot(x - pedra.x, y - pedra.y) - pedra.r)
      }
    }
    return d
  }

  const inclinacaoDaBorda =
    bordaMaxima * INCLINACAO_DO_RUIDO * (ONDA_LARGA.amplitude / ONDA_LARGA.escala + fina.amplitude / fina.escala)
  // A troca de peça mais perto em `bordaPerto` muda a borda aos saltos entre dois traços de borda diferente: a folga de 1,25 cobre o salto pequeno.
  return { sample, bounds, lipschitz: (1 + inclinacao + inclinacaoDaBorda) * 1.25 }
}

/** A forma de um material, pronta para o balde: os anéis dele e a posição da peça mais nova. */
export interface FormaDoTerreno {
  textura: string
  aneis: RegionPoint[][]
  /** Índice, em `floor`, da peça mais nova do material: os materiais se empilham por ele. */
  ultima: number
}

/** As formas dos materiais, do de baixo para o de cima. Função pura (o teste confere a conta). */
export function formasDoTerreno(floor: readonly FloorPiece[], grid: number, clip?: FloorClip): FormaDoTerreno[] {
  const ultimas = new Map<string, number>()
  floor.forEach((peca, i) => {
    if (peca.hidden !== true && peca.op === 'add' && peca.material !== undefined && peca.material !== '') ultimas.set(peca.material, i)
  })
  const formas: FormaDoTerreno[] = []
  for (const [textura, ultima] of ultimas) {
    const aneis = aneisDoMaterial(floor, textura, grid, clip)
    if (aneis.length > 0) formas.push({ textura, aneis, ultima })
  }
  return formas.sort((a, b) => a.ultima - b.ultima)
}

/** Quantos contornos de material ficam guardados (mexer num caminho não reconta os outros materiais). */
const CONTORNOS_GUARDADOS = 16
const contornosRecentes: Array<{ chave: string; aneis: RegionPoint[][] }> = []

/**
 * Os anéis de um material, guardados pelo DESENHO das peças que contam para
 * ele (as dele e os buracos depois da primeira), a grade e o recorte: mexer
 * numa trilha de terra não reconta o calçamento. A conta (o contorno) é a
 * parte cara do terreno.
 */
function aneisDoMaterial(floor: readonly FloorPiece[], textura: string, grid: number, clip?: FloorClip): RegionPoint[][] {
  const contam: unknown[] = []
  for (const p of floor) {
    if (p.hidden === true) continue
    if (p.op === 'add' ? p.material === textura : contam.length > 0) contam.push([p.shape, p.op, p.rotation ?? 0, p.modifiers, p.borda ?? 0])
  }
  const chave = `${textura}|${grid}|${clip ? `${clip.minX},${clip.minY},${clip.maxX},${clip.maxY}` : ''}|${JSON.stringify(contam)}`
  const k = contornosRecentes.findIndex((e) => e.chave === chave)
  if (k >= 0) {
    const [achado] = contornosRecentes.splice(k, 1)
    contornosRecentes.push(achado)
    return achado.aneis
  }
  const pedras = MATERIAIS_DO_CHAO.some((m) => m.textura === textura && m.pedras)
  const campo = campoDoMaterial(floor, textura, grid, pedras)
  const aneis =
    campo === null || campo.bounds === null
      ? []
      : aneisDoCampo(campo, { step: floorSampleStep(campo.bounds, PASSO_DO_CONTORNO), clip }).filter((anel) => anel.length >= 3)
  contornosRecentes.push({ chave, aneis })
  if (contornosRecentes.length > CONTORNOS_GUARDADOS) contornosRecentes.shift()
  return aneis
}

/**
 * Os anéis de uma forma numa lista só de pontos, para o balde (`AlvoDoBalde`
 * de área, preenchido com par-ímpar): cada anel fecha nele mesmo e a ponte
 * até ele sai do primeiro ponto do primeiro anel (a ÂNCORA) e volta para lá
 * pelo mesmo traço, ida e volta, o que não muda nada no par-ímpar. Assim os
 * buracos (praça com canteiro) e as pedras soltas vão num passo só.
 *
 * A ponte ligando o fim de um anel direto ao começo do seguinte NÃO volta: as
 * pontes de todos os anéis formam um polígono a mais (o dos primeiros pontos),
 * e o par-ímpar o inverte por cima do caminho. Era o E01 da 0.5.62: cunhas e
 * fiapos ligando as pedras soltas e grama por dentro do caminho.
 */
export function pontosDosAneis(aneis: readonly RegionPoint[][]): RegionPoint[] {
  const pontos: RegionPoint[] = []
  let ancora: RegionPoint | null = null
  for (const anel of aneis) {
    if (anel.length === 0) continue
    for (const p of anel) pontos.push({ x: p.x, y: p.y })
    pontos.push({ x: anel[0].x, y: anel[0].y })
    if (ancora === null) ancora = anel[0]
    // De volta à âncora pelo mesmo traço da ida; o primeiro anel já começa e acaba nela.
    else pontos.push({ x: ancora.x, y: ancora.y })
  }
  return pontos
}

/** O passo de balde de um material: a forma dele (`pontosDosAneis`) cheia com a textura. O worker e a página montam por aqui. */
export function passoDoTerreno(textura: string, pontos: RegionPoint[]): PinceladaDeTextura {
  return { id: `terreno:${textura}`, tipo: 'balde', textura, forca: 1, alvo: { tipo: 'area', pontos } }
}

/** A grade e o recorte num texto (a outra metade da chave dos passos guardados). */
export function chaveDaGradeDoTerreno(grid: number, clip?: FloorClip): string {
  return `${grid}|${clip ? `${clip.minX},${clip.minY},${clip.maxX},${clip.maxY}` : ''}`
}

/**
 * Só as peças que CONTAM para o contorno do terreno, na ordem: as visíveis com
 * material e os buracos visíveis depois da primeira delas (o buraco de antes
 * não tira nada de material nenhum, `campoDoMaterial`). Os passos destas são
 * os MESMOS da lista inteira: a peça Lisa e a escondida não entram em conta
 * nenhuma, e a ordem dos materiais sai da ordem relativa das peças, que fica.
 * É o que vai ao worker do contorno (`terrenoNoWorker.ts`), e nada além.
 */
export function pecasDoContorno(floor: readonly FloorPiece[]): FloorPiece[] {
  const contam: FloorPiece[] = []
  for (const p of floor) {
    if (p.hidden === true) continue
    if (p.op === 'add' ? temMaterial(p) : contam.length > 0) contam.push(p)
  }
  return contam
}

/** O desenho das peças que contam (as de `pecasDoContorno`), com a grade e o recorte: a mesma chave = os mesmos passos. */
export function chaveDoTerreno(contam: readonly FloorPiece[], grid: number, clip?: FloorClip): string {
  const desenho = contam.map((p) => [p.op === 'add' ? (p.material ?? '') : '', p.shape, p.op, p.rotation ?? 0, p.modifiers, p.borda ?? 0])
  return `${chaveDaGradeDoTerreno(grid, clip)}|${JSON.stringify(desenho)}`
}

const passosPorLista = new WeakMap<readonly FloorPiece[], { chave: string; passos: PinceladaDeTextura[] }>()

/**
 * Os passos de balde do terreno: um por material, na ordem das peças mais
 * novas. Guardados pela lista e pela grade/recorte (a store é imutável: a
 * mesma lista é o mesmo terreno). Lista vazia = nada a pintar.
 *
 * Conta na hora, na thread de quem chama: a tela pede pelo worker
 * (`terrenoNoWorker.ts`, `pedirTerreno`), que roda esta mesma conta fora dela.
 */
export function passosDoTerreno(floor: readonly FloorPiece[], grid: number, clip?: FloorClip): PinceladaDeTextura[] {
  const chave = chaveDaGradeDoTerreno(grid, clip)
  const guardado = passosPorLista.get(floor)
  if (guardado !== undefined && guardado.chave === chave) return guardado.passos
  const passos = formasDoTerreno(floor, grid, clip).map((forma) => passoDoTerreno(forma.textura, pontosDosAneis(forma.aneis)))
  passosPorLista.set(floor, { chave, passos })
  return passos
}

// ---------------------------------------------------------------------------
// Caminhos antigos: "Dar material"

/** A cor `#rrggbb` em componentes; texto torto vira cinza médio. */
function componentes(cor: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(cor.trim())
  if (m === null) return [128, 128, 128]
  const n = Number.parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** O material de cor mais perto da cor do caminho antigo (marrom vira terra, cinza vira pedra). */
export function materialPelaCor(cor: string): string {
  const [r, g, b] = componentes(cor)
  let melhor = MATERIAL_PADRAO
  let menor = Infinity
  for (const m of MATERIAIS_DO_CHAO) {
    if (m.textura === null) continue
    const [mr, mg, mb] = componentes(m.hoje)
    const d = (r - mr) ** 2 + (g - mg) ** 2 + (b - mb) ** 2
    if (d < menor) {
      menor = d
      melhor = m.textura
    }
  }
  return melhor
}

/** Um caminho antigo (desenho `path`) que pode ganhar material: não secreto e com comprimento. */
export function caminhoQueGanhaMaterial(d: Drawing): d is Extract<Drawing, { kind: 'path' }> {
  return d.kind === 'path' && d.secret !== true && d.points.length >= 2
}

/**
 * DAR MATERIAL (decisão do mestre de 12/11/2026: os caminhos antigos ficam
 * como estão, com o botão na ficha): troca os caminhos `ids` por peças de
 * Chão com material, na mesma rota (curva suave pelos mesmos pontos), na
 * mesma largura e no mesmo piso, com `soPintura` (o caminho nunca foi
 * limite: a regra da cena não muda). O material sai da cor do caminho. O
 * caminho SECRETO fica como está: a peça de Chão iria para o jogador.
 * `null` = nada a trocar.
 */
export function caminhosComMaterial(map: MapData, ids: readonly string[], novoId: () => string = () => crypto.randomUUID()): { map: MapData; quantos: number } | null {
  const alvo = new Set(ids)
  const pecas: FloorPiece[] = []
  const trocados = new Set<string>()
  for (const d of map.drawings) {
    if (!alvo.has(d.id) || !caminhoQueGanhaMaterial(d)) continue
    const peca: FloorPiece = {
      id: novoId(),
      shape: { kind: 'corridor', suave: true, points: d.points.map((p) => ({ x: p.x, y: p.y, width: d.width })) },
      op: 'add',
      modifiers: {},
      material: materialPelaCor(d.color),
      borda: BORDA_PADRAO,
      soPintura: true,
    }
    if (d.piso !== undefined) peca.piso = d.piso
    pecas.push(peca)
    trocados.add(d.id)
  }
  if (pecas.length === 0) return null
  return { map: { ...map, floor: [...map.floor, ...pecas], drawings: map.drawings.filter((d) => !trocados.has(d.id)) }, quantos: pecas.length }
}
