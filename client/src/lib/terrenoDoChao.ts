import type { FloorPiece, FloorShape, PinceladaDeTextura, RegionPoint } from '../types/map'
import { aneisDoCampo, floorSampleStep, type FloorClip } from './floorContour'
import { pieceBounds, pieceDistance, valueNoise, type Bounds, type CompiledFloor } from './floorSdf'

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
}

/** Os materiais do painel, na ordem do protótipo aprovado. */
export const MATERIAIS_DO_CHAO: readonly MaterialDoChao[] = [
  { textura: 'calcamento', nome: 'Calçamento', pedras: true, amostra: '#c9c4b8' },
  { textura: 'terra', nome: 'Terra batida', pedras: false, amostra: '#977b55' },
  { textura: 'cascalho', nome: 'Cascalho', pedras: true, amostra: '#b2a68e' },
  { textura: 'areia', nome: 'Areia', pedras: false, amostra: '#cfbb82' },
  { textura: 'conves', nome: 'Tábuas', pedras: false, amostra: '#8d6239' },
  { textura: 'grama', nome: 'Grama', pedras: false, amostra: '#7fc468' },
  { textura: null, nome: 'Liso', pedras: false, amostra: '#a8776a' },
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
const PASSO_DO_CONTORNO = 2
/** Folga do descarte por caixa, além da fusão. */
const FOLGA_DO_DESCARTE = 8
/** Inclinação do `valueNoise` por unidade de entrada, com folga (a mesma conta de `floorSdf.ts`). */
const INCLINACAO_DO_RUIDO = 6.5
const SEMENTE_DA_BORDA = 7121

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

  const lado = PEDRA.celula * grid
  const pedrasPorCelula = new Map<string, Pedra | null>()
  const pedraDaCelula = (ix: number, iy: number): Pedra | null => {
    const chave = `${ix},${iy}`
    const guardada = pedrasPorCelula.get(chave)
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
    pedrasPorCelula.set(chave, pedra)
    return pedra
  }

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
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          const pedra = pedraDaCelula(ix + ox, iy + oy)
          if (pedra !== null) d = Math.min(d, Math.hypot(x - pedra.x, y - pedra.y) - pedra.r)
        }
      }
    }
    return d
  }

  const folga = bordaMaxima * grid * (ONDA_LARGA.amplitude + fina.amplitude + (comPedras ? PEDRA.alcance + PEDRA.raioMin + PEDRA.raioVar : 0)) + fusao
  const bounds = { minX: caixa.minX - folga, minY: caixa.minY - folga, maxX: caixa.maxX + folga, maxY: caixa.maxY + folga }
  const inclinacaoDaBorda =
    bordaMaxima * INCLINACAO_DO_RUIDO * (ONDA_LARGA.amplitude / ONDA_LARGA.escala + fina.amplitude / fina.escala)
  // A troca de peça mais perto em `bordaPerto` muda a borda aos saltos: a folga de 2 cobre o salto entre dois traços.
  return { sample, bounds, lipschitz: (1 + inclinacao + inclinacaoDaBorda) * 1.25 * (bordaMaxima > 0 ? 2 : 1) }
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
    const pedras = MATERIAIS_DO_CHAO.some((m) => m.textura === textura && m.pedras)
    const campo = campoDoMaterial(floor, textura, grid, pedras)
    if (campo === null || campo.bounds === null) continue
    const passo = floorSampleStep(campo.bounds, PASSO_DO_CONTORNO)
    const aneis = aneisDoCampo(campo, { step: passo, clip }).filter((anel) => anel.length >= 3)
    if (aneis.length > 0) formas.push({ textura, aneis, ultima })
  }
  return formas.sort((a, b) => a.ultima - b.ultima)
}

/**
 * Os anéis de uma forma numa lista só de pontos, para o balde (`AlvoDoBalde`
 * de área, preenchido com par-ímpar): cada anel fecha nele mesmo e a ponte
 * entre um e o outro é percorrida ida e volta, o que não muda nada no
 * par-ímpar. Assim os buracos (praça com canteiro) e as pedras soltas vão
 * num passo só.
 */
export function pontosDosAneis(aneis: readonly RegionPoint[][]): RegionPoint[] {
  const pontos: RegionPoint[] = []
  for (const anel of aneis) {
    if (anel.length === 0) continue
    for (const p of anel) pontos.push({ x: p.x, y: p.y })
    pontos.push({ x: anel[0].x, y: anel[0].y })
  }
  return pontos
}

const passosPorLista = new WeakMap<readonly FloorPiece[], { chave: string; passos: PinceladaDeTextura[] }>()

/**
 * Os passos de balde do terreno: um por material, na ordem das peças mais
 * novas. Guardados pela lista e pela grade/recorte (a store é imutável: a
 * mesma lista é o mesmo terreno). Lista vazia = nada a pintar.
 */
export function passosDoTerreno(floor: readonly FloorPiece[], grid: number, clip?: FloorClip): PinceladaDeTextura[] {
  const chave = `${grid}|${clip ? `${clip.minX},${clip.minY},${clip.maxX},${clip.maxY}` : ''}`
  const guardado = passosPorLista.get(floor)
  if (guardado !== undefined && guardado.chave === chave) return guardado.passos
  const passos: PinceladaDeTextura[] = formasDoTerreno(floor, grid, clip).map((forma) => ({
    id: `terreno:${forma.textura}`,
    tipo: 'balde',
    textura: forma.textura,
    forca: 1,
    alvo: { tipo: 'area', pontos: pontosDosAneis(forma.aneis) },
  }))
  passosPorLista.set(floor, { chave, passos })
  return passos
}
