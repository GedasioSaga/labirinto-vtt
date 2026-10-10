/**
 * RELEVO rasterizado: o jsdom não tem tela 2D, então aqui roda uma tela falsa
 * que PINTA de verdade (pixel a pixel, alfa pré-multiplicado), com só o que o
 * rasterizador usa: preencher, traçar, compor (`source-over`,
 * `destination-out`, `destination-in`, `lighter`, `clearRect`) e a sombra do `drawImage`. O borrão da
 * sombra vira uma dilatação quadrada de 1,5 × o borrão (o alcance de 3 desvios
 * da gaussiana do canvas): mais larga que a de verdade, então qualquer sobra
 * de efeito onde não devia aparece aqui. O degradê não é simulado (pinta nada):
 * o que sobra dentro da terra é só sombra de fronteira e friso.
 *
 * Prova:
 * - NÉVOA: a região chega INTEIRA no recorte do jogador assim que um pedaço
 *   dela é visto; a sombra no mar de uma costa ainda na névoa, e a faixa de uma
 *   divisa na névoa, não podem cair no que ele já conhece;
 * - FRESTA: a divisa desenhada à mão com fresta, que `bordasDaTerra` chama de
 *   fronteira, fica fechada na união (senão ganharia sombra de mar e friso).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Drawing, Region, RegionPoint, TracoDePenhasco } from '../types/map'
import { AJUSTE_DO_PENHASCO, alturaDaParede, planoComPenhascos, planoDoRelevo, type ConhecidoDoRelevo, type PlanoDoRelevo } from '../lib/relevo'
import { rasterizarRelevo } from './relevoRaster'

type Cor = [number, number, number, number]

function lerCor(estilo: unknown): Cor {
  if (estilo === '#fff') return [255, 255, 255, 1]
  if (estilo === '#000') return [0, 0, 0, 1]
  if (typeof estilo === 'string' && estilo.startsWith('rgba(')) {
    const [r, g, b, a] = estilo.slice(5, -1).split(',').map(Number)
    return [r, g, b, a]
  }
  // Degradê (objeto): não simulado.
  return [0, 0, 0, 0]
}

function dentroDoPoligono(x: number, y: number, poligono: readonly RegionPoint[]): boolean {
  let dentro = false
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i, i += 1) {
    const a = poligono[i]
    const b = poligono[j]
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) dentro = !dentro
  }
  return dentro
}

function distanciaAoSegmento(x: number, y: number, a: RegionPoint, b: RegionPoint): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const t = dx === 0 && dy === 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(x - (a.x + dx * t), y - (a.y + dy * t))
}

/** Dilatação quadrada do alfa (máximo na janela), em duas passadas. */
function dilatar(alfa: Float32Array, largura: number, altura: number, raio: number): Float32Array {
  const linhas = new Float32Array(alfa.length)
  for (let y = 0; y < altura; y += 1) {
    for (let x = 0; x < largura; x += 1) {
      let m = 0
      for (let k = Math.max(0, x - raio); k <= Math.min(largura - 1, x + raio); k += 1) m = Math.max(m, alfa[y * largura + k])
      linhas[y * largura + x] = m
    }
  }
  const saida = new Float32Array(alfa.length)
  for (let y = 0; y < altura; y += 1) {
    for (let x = 0; x < largura; x += 1) {
      let m = 0
      for (let k = Math.max(0, y - raio); k <= Math.min(altura - 1, y + raio); k += 1) m = Math.max(m, linhas[k * largura + x])
      saida[y * largura + x] = m
    }
  }
  return saida
}

interface Estado {
  t: [number, number, number, number]
  fillStyle: unknown
  strokeStyle: unknown
  lineWidth: number
  globalCompositeOperation: string
  shadowColor: string
  shadowBlur: number
  shadowOffsetX: number
  shadowOffsetY: number
}

class TelaFalsa {
  private _largura = 0
  private _altura = 0
  /** RGBA pré-multiplicado. */
  dados = new Float32Array(0)
  /** O que a tela tinha quando foi descartada (`width = 0`): o teste lê as etapas. */
  antesDeDescartar: { dados: Float32Array; largura: number; altura: number } | null = null
  private readonly pincel = new PincelFalso(this)

  get width(): number {
    return this._largura
  }
  set width(v: number) {
    if (v === 0 && this._largura > 0) this.antesDeDescartar = { dados: this.dados, largura: this._largura, altura: this._altura }
    this._largura = v
    this.dados = new Float32Array(this._largura * this._altura * 4)
  }
  get height(): number {
    return this._altura
  }
  set height(v: number) {
    this._altura = v
    this.dados = new Float32Array(this._largura * this._altura * 4)
  }
  getContext(): PincelFalso {
    return this.pincel
  }
  alfa(x: number, y: number): number {
    return this.dados[(y * this._largura + x) * 4 + 3]
  }
}

class PincelFalso {
  private estado: Estado = {
    t: [1, 1, 0, 0],
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    globalCompositeOperation: 'source-over',
    shadowColor: 'rgba(0, 0, 0, 0)',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
  }
  private pilha: Estado[] = []
  private caminho: RegionPoint[][] = []
  private fechados: boolean[] = []
  lineCap = 'butt'

  constructor(private readonly tela: TelaFalsa) {}

  set fillStyle(v: unknown) { this.estado.fillStyle = v }
  set strokeStyle(v: unknown) { this.estado.strokeStyle = v }
  set lineWidth(v: number) { this.estado.lineWidth = v }
  set globalCompositeOperation(v: string) { this.estado.globalCompositeOperation = v }
  set shadowColor(v: string) { this.estado.shadowColor = v }
  set shadowBlur(v: number) { this.estado.shadowBlur = v }
  set shadowOffsetX(v: number) { this.estado.shadowOffsetX = v }
  set shadowOffsetY(v: number) { this.estado.shadowOffsetY = v }

  save(): void {
    this.pilha.push({ ...this.estado, t: [...this.estado.t] })
  }
  restore(): void {
    const anterior = this.pilha.pop()
    if (anterior !== undefined) this.estado = anterior
  }
  /** Só escala e translação (o rasterizador não gira nada). */
  setTransform(a: number, _b: number, _c: number, d: number, e: number, f: number): void {
    this.estado.t = [a, d, e, f]
  }
  createLinearGradient(): { addColorStop: () => void } {
    return { addColorStop: () => undefined }
  }
  beginPath(): void {
    this.caminho = []
    this.fechados = []
  }
  moveTo(x: number, y: number): void {
    this.caminho.push([{ x, y }])
    this.fechados.push(false)
  }
  lineTo(x: number, y: number): void {
    this.caminho[this.caminho.length - 1].push({ x, y })
  }
  closePath(): void {
    this.fechados[this.fechados.length - 1] = true
  }
  fill(): void {
    const poligonos = this.caminho
    this.pintar(lerCor(this.estado.fillStyle), (x, y) => poligonos.some((p) => dentroDoPoligono(x, y, p)))
  }
  fillRect(x: number, y: number, largura: number, altura: number): void {
    this.pintar(lerCor(this.estado.fillStyle), (px, py) => px >= x && px < x + largura && py >= y && py < y + altura)
  }
  clearRect(x: number, y: number, largura: number, altura: number): void {
    const [a, d, e, f] = this.estado.t
    const { width: lt } = this.tela
    for (let j = 0; j < this.tela.height; j += 1) {
      for (let i = 0; i < lt; i += 1) {
        const px = (i + 0.5 - e) / a
        const py = (j + 0.5 - f) / d
        if (px >= x && px < x + largura && py >= y && py < y + altura) this.tela.dados.fill(0, (j * lt + i) * 4, (j * lt + i) * 4 + 4)
      }
    }
  }
  stroke(): void {
    const meia = this.estado.lineWidth / 2
    const segmentos: [RegionPoint, RegionPoint][] = []
    this.caminho.forEach((pontos, i) => {
      for (let k = 1; k < pontos.length; k += 1) segmentos.push([pontos[k - 1], pontos[k]])
      if (this.fechados[i] && pontos.length > 2) segmentos.push([pontos[pontos.length - 1], pontos[0]])
    })
    this.pintar(lerCor(this.estado.strokeStyle), (x, y) => segmentos.some(([a, b]) => distanciaAoSegmento(x, y, a, b) <= meia))
  }
  drawImage(fonte: TelaFalsa, x: number, y: number): void {
    const [a, d, e, f] = this.estado.t
    const ox = Math.round(a * x + e)
    const oy = Math.round(d * y + f)
    const { width: largura, height: altura } = this.tela
    const sombra = lerCor(this.estado.shadowColor)
    if (sombra[3] > 0) {
      const alfa = new Float32Array(largura * altura)
      const sx = ox + Math.round(this.estado.shadowOffsetX)
      const sy = oy + Math.round(this.estado.shadowOffsetY)
      for (let j = 0; j < altura; j += 1) {
        for (let i = 0; i < largura; i += 1) {
          const fi = i - sx
          const fj = j - sy
          if (fi >= 0 && fj >= 0 && fi < fonte.width && fj < fonte.height) alfa[j * largura + i] = fonte.alfa(fi, fj)
        }
      }
      const borrado = dilatar(alfa, largura, altura, Math.ceil(this.estado.shadowBlur * 1.5))
      const camada = new Float32Array(largura * altura * 4)
      for (let k = 0; k < borrado.length; k += 1) {
        const s = borrado[k] * sombra[3]
        camada.set([sombra[0] * s, sombra[1] * s, sombra[2] * s, s], k * 4)
      }
      this.compor(camada)
    }
    const camada = new Float32Array(largura * altura * 4)
    for (let j = 0; j < altura; j += 1) {
      for (let i = 0; i < largura; i += 1) {
        const fi = i - ox
        const fj = j - oy
        if (fi >= 0 && fj >= 0 && fi < fonte.width && fj < fonte.height) {
          const de = (fj * fonte.width + fi) * 4
          camada.set(fonte.dados.subarray(de, de + 4), (j * largura + i) * 4)
        }
      }
    }
    this.compor(camada)
  }

  /** Pinta onde `cobre` (centro do pixel, em coordenadas do mundo) com a cor. */
  private pintar(cor: Cor, cobre: (x: number, y: number) => boolean): void {
    const [a, d, e, f] = this.estado.t
    const { width: largura, height: altura } = this.tela
    const camada = new Float32Array(largura * altura * 4)
    for (let j = 0; j < altura; j += 1) {
      for (let i = 0; i < largura; i += 1) {
        if (cobre((i + 0.5 - e) / a, (j + 0.5 - f) / d)) camada.set([cor[0] * cor[3], cor[1] * cor[3], cor[2] * cor[3], cor[3]], (j * largura + i) * 4)
      }
    }
    this.compor(camada)
  }

  private compor(fonte: Float32Array): void {
    const destino = this.tela.dados
    const modo = this.estado.globalCompositeOperation
    for (let k = 0; k < destino.length; k += 4) {
      const sa = fonte[k + 3]
      for (let c = 0; c < 4; c += 1) {
        if (modo === 'destination-out') destino[k + c] *= 1 - sa
        // `lighter` soma, com o teto do canvas (alfa 1, canal 255).
        else if (modo === 'lighter') destino[k + c] = Math.min(c === 3 ? 1 : 255, fonte[k + c] + destino[k + c])
        else if (modo === 'destination-in') destino[k + c] *= sa
        else destino[k + c] = fonte[k + c] + destino[k + c] * (1 - sa)
      }
    }
  }
}

let telas: TelaFalsa[] = []

beforeEach(() => {
  telas = []
  const criar = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((nome: string) => {
    if (nome !== 'canvas') return criar(nome)
    const tela = new TelaFalsa()
    telas.push(tela)
    // A tela falsa tem só o que o rasterizador usa; o tipo do DOM inteiro não cabe nela.
    return tela as unknown as HTMLCanvasElement
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

function retangulo(x0: number, y0: number, x1: number, y1: number): RegionPoint[] {
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ]
}

function regiao(id: string, points: RegionPoint[]): Region {
  return { id, points, tag: 'region', fillColor: '#76c577', fillPattern: 'solid', data: {} }
}

/** 1 px do protótipo = 10 px de mundo; com o teto, 1 texel = 10 px de mundo. */
const MAPA = { width: 1242, height: 1242, grid: 10 }
const TETO = 276

function plano(regioes: Region[], conhecido?: ConhecidoDoRelevo, desenhos: Drawing[] = []): PlanoDoRelevo {
  const p = planoDoRelevo(MAPA, regioes, desenhos, TETO)
  if (p === null) throw new Error('sem terra')
  return conhecido === undefined ? p : { ...p, conhecido }
}

async function gerar(p: PlanoDoRelevo): Promise<TelaFalsa> {
  const saida = await rasterizarRelevo(p, () => false)
  const tela = telas.find((t) => Object.is(t, saida))
  if (tela === undefined) throw new Error('sem saída')
  return tela
}

/**
 * Impressão digital da tela: FNV-1a sobre os bytes dos texels (tamanho junto).
 * Igual só se cada canal de cada texel for igual, bit a bit.
 */
function impressao(tela: TelaFalsa): string {
  const bytes = new Uint8Array(tela.dados.buffer, tela.dados.byteOffset, tela.dados.byteLength)
  let h = 0x811c9dc5
  for (let i = 0; i < bytes.length; i += 1) h = Math.imul(h ^ bytes[i], 0x01000193)
  return `${tela.width}x${tela.height}:${(h >>> 0).toString(16)}`
}

const IMPRESSAO_DO_MESTRE_V0424 = '251x276:a8396f88'
const IMPRESSAO_DO_JOGADOR_V0424 = '251x276:161df926'

/** Maior alfa da textura dentro de um retângulo do MUNDO. */
function maiorAlfaNoMundo(tela: TelaFalsa, p: PlanoDoRelevo, caixa: [number, number, number, number]): number {
  const [x0, y0, x1, y1] = caixa
  let maior = 0
  for (let j = 0; j < tela.height; j += 1) {
    for (let i = 0; i < tela.width; i += 1) {
      const wx = (i + 0.5) / p.escala + p.retangulo.x
      const wy = (j + 0.5) / p.escala + p.retangulo.y
      if (wx >= x0 && wx < x1 && wy >= y0 && wy < y1) maior = Math.max(maior, tela.alfa(i, j))
    }
  }
  return maior
}

describe('rasterizarRelevo — névoa (a região chega inteira, a origem do efeito não)', () => {
  // O continente é UMA região grande; o grupo viu só a ponta de cima à
  // esquerda e anda pelo mar ao sudeste, perto de uma costa que nunca viu.
  const continente = regiao('continente', retangulo(0, 0, 1000, 1000))
  const marConhecido: [number, number, number, number] = [1050, 1050, 1500, 1500]
  const conhecido: ConhecidoDoRelevo = {
    visao: [retangulo(0, 0, 200, 200), retangulo(1050, 1050, 1500, 1500)],
  }

  it('controle: sem névoa (o mestre), a sombra da costa sudeste cai nesse mar', async () => {
    const p = plano([continente])
    expect(maiorAlfaNoMundo(await gerar(p), p, marConhecido)).toBeGreaterThan(0.1)
  })

  it('jogador: a sombra no mar de uma costa ainda na névoa não aparece no mar que ele já conhece', async () => {
    const p = plano([continente], conhecido)
    expect(maiorAlfaNoMundo(await gerar(p), p, marConhecido)).toBe(0)
  })

  it('jogador: a faixa escura de uma divisa na névoa não alcança a terra já vista do lado de lá', async () => {
    const a = regiao('a', retangulo(0, 0, 1000, 1000))
    const b = regiao('b', retangulo(1000, 0, 2000, 1000))
    // Ele conhece um pedaço de B a 100 px de mundo da divisa, nunca a divisa.
    const terraVista: [number, number, number, number] = [1100, 300, 1800, 700]
    const comNevoa = plano([a, b], { visao: [retangulo(1100, 300, 1800, 700)] })
    expect(maiorAlfaNoMundo(await gerar(comNevoa), comNevoa, terraVista)).toBe(0)
    // Controle: o mestre, que vê a divisa, tem a faixa ali.
    const mestre = plano([a, b])
    expect(maiorAlfaNoMundo(await gerar(mestre), mestre, terraVista)).toBeGreaterThan(0.05)
  })

  it('jogador: a célula explorada conta como conhecido — a terra dela faz sombra, a da névoa não', async () => {
    const p = plano([continente], {
      // O mar ao sul, visto agora.
      visao: [retangulo(0, 1050, 1500, 1500)],
      explorado: {
        cell: 500,
        cols: 4,
        rows: 4,
        // Só a célula da coluna 1, linha 1 (x 500 a 1000, y 500 a 1000): a ponta sudeste da terra.
        bits: Uint8Array.from([0x20, 0]),
        rings: [],
        ringVertices: 0,
      },
    })
    const tela = await gerar(p)
    expect(maiorAlfaNoMundo(tela, p, [600, 1050, 1000, 1300])).toBeGreaterThan(0.1)
    // Sob a costa sul a oeste, que nunca foi vista: nada.
    expect(maiorAlfaNoMundo(tela, p, [0, 1050, 250, 1500])).toBe(0)
  })
})

describe('rasterizarRelevo — fresta entre regiões vizinhas', () => {
  it('a fresta que a classificação chama de fronteira fica fechada na união da terra', async () => {
    // Divisa à mão: 12 px de mundo entre as duas (1,2 texel), menos que a folga de 15.
    const p = plano([regiao('a', retangulo(0, 0, 1000, 1000)), regiao('b', retangulo(1012, 0, 2012, 1000))])
    expect(p.fronteiras.length).toBeGreaterThan(0)
    await gerar(p)
    // A primeira tela criada é a da união da terra.
    const terra = telas[0].antesDeDescartar
    if (terra === null) throw new Error('a união não foi descartada')
    const i = Math.floor((1006 - p.retangulo.x) * p.escala)
    const j = Math.floor((500 - p.retangulo.y) * p.escala)
    expect(terra.dados[(j * terra.largura + i) * 4 + 3]).toBeGreaterThan(0.99)
  })
})

describe('rasterizarRelevo — divisas pintadas (fatia 1b)', () => {
  // Terra de uma região só; o bioma pinta a metade da direita até a costa.
  // A única divisa é a reta x = 1000 (o resto da borda do bioma é costa).
  const terra = regiao('terra', retangulo(0, 0, 2000, 1000))
  const bioma: Drawing = { id: 'bioma', kind: 'polygon', points: retangulo(1000, 0, 2000, 1000), color: '#0aa148', width: 0, filled: true, fillAlpha: 1 }
  const terraVista: [number, number, number, number] = [1100, 300, 1800, 700]

  it('o mestre tem a faixa da divisa; o jogador que nunca viu a divisa não tem nada dela na terra que conhece', async () => {
    const mestre = plano([terra], undefined, [bioma])
    expect(mestre.divisas.length).toBeGreaterThan(0)
    expect(maiorAlfaNoMundo(await gerar(mestre), mestre, terraVista)).toBeGreaterThan(0.05)
    const jogador = plano([terra], { visao: [retangulo(1100, 300, 1800, 700)] }, [bioma])
    expect(maiorAlfaNoMundo(await gerar(jogador), jogador, terraVista)).toBe(0)
  })

  it('desenho sobre o mar: a textura sai idêntica à sem ele (nem sombra no mar, nem friso)', async () => {
    const noMar: Drawing = { id: 'mar', kind: 'polygon', points: retangulo(2300, 200, 2700, 800), color: '#0aa148', width: 0, filled: true, fillAlpha: 1 }
    const sem = await gerar(plano([terra]))
    const com = await gerar(plano([terra], undefined, [noMar]))
    expect(com.width).toBe(sem.width)
    expect(com.height).toBe(sem.height)
    expect(Array.from(com.dados)).toEqual(Array.from(sem.dados))
  })
})

describe('rasterizarRelevo — penhasco (fatia 3)', () => {
  // Terra de 0 a 1000. A costa de baixo (y = 1000) é a da parede à vista.
  // Opaco = parede: a sombra no mar nunca passa de 0,55 de alfa.
  const continente = regiao('continente', retangulo(0, 0, 1000, 1000))
  const PAREDE = 0.9

  function riscoNaCosta(id: string, modo: TracoDePenhasco['modo'], de: number, ate: number, y: number, raio: number): TracoDePenhasco {
    const pontos: RegionPoint[] = []
    for (let x = de; x <= ate; x += 20) pontos.push({ x, y })
    return { id, modo, raio, pontos }
  }

  function comRiscos(riscos: TracoDePenhasco[], conhecido?: ConhecidoDoRelevo): PlanoDoRelevo {
    return planoComPenhascos(plano([continente], conhecido), riscos, TETO)
  }

  /** Cor (sem o alfa pré-multiplicado) no ponto do mundo. */
  function corNoMundo(tela: TelaFalsa, p: PlanoDoRelevo, x: number, y: number): [number, number, number, number] {
    const i = Math.floor((x - p.retangulo.x) * p.escala)
    const j = Math.floor((y - p.retangulo.y) * p.escala)
    const k = (j * tela.width + i) * 4
    const a = tela.dados[k + 3]
    return a === 0 ? [0, 0, 0, 0] : [tela.dados[k] / a, tela.dados[k + 1] / a, tela.dados[k + 2] / a, a]
  }

  it('a parede desce da costa riscada para o mar, só ali: nem sob a costa sem risco, nem sobre a terra', async () => {
    const p = comRiscos([riscoNaCosta('a', 'riscar', 200, 400, 1000, 40)])
    const tela = await gerar(p)
    // 6 px do protótipo abaixo da costa (unidade 10): parede, marrom.
    expect(maiorAlfaNoMundo(tela, p, [280, 1040, 320, 1080])).toBeGreaterThan(PAREDE)
    const [r, g, b] = corNoMundo(tela, p, 300, 1060)
    expect(r).toBeGreaterThan(g)
    expect(g).toBeGreaterThan(b)
    // A costa de baixo sem risco: só a sombra.
    expect(maiorAlfaNoMundo(tela, p, [650, 1020, 950, 1150])).toBeLessThan(PAREDE)
    // Sobre a terra, a parede não fica (o que cai nela sai).
    expect(maiorAlfaNoMundo(tela, p, [250, 700, 350, 960])).toBeLessThan(PAREDE)
    // A parede tem a altura do protótipo (18 px = 180 de mundo): bem abaixo dela, de novo só sombra.
    expect(maiorAlfaNoMundo(tela, p, [280, 1260, 320, 1300])).toBeLessThan(PAREDE)
  })

  it('a sombra no mar sai do pé da parede: cai mais longe do que a da costa sem penhasco', async () => {
    const longe: [number, number, number, number] = [250, 1430, 350, 1470]
    const sem = plano([continente])
    expect(maiorAlfaNoMundo(await gerar(sem), sem, longe)).toBe(0)
    const com = comRiscos([riscoNaCosta('a', 'riscar', 100, 900, 1000, 40)])
    expect(maiorAlfaNoMundo(await gerar(com), com, longe)).toBeGreaterThan(0.1)
  })

  it('risco na costa de cima: nada desce para o mar (a parede ficaria atrás da terra)', async () => {
    const p = comRiscos([riscoNaCosta('a', 'riscar', 200, 400, 0, 40)])
    expect(maiorAlfaNoMundo(await gerar(p), p, [150, -300, 450, -10])).toBeLessThan(PAREDE)
  })

  it('a borracha tira o trecho que ela cobre, e o resto do penhasco fica', async () => {
    const p = comRiscos([riscoNaCosta('a', 'riscar', 100, 900, 1000, 40), riscoNaCosta('b', 'apagar', 500, 500, 1000, 200)])
    const tela = await gerar(p)
    expect(maiorAlfaNoMundo(tela, p, [480, 1040, 520, 1080])).toBeLessThan(PAREDE)
    expect(maiorAlfaNoMundo(tela, p, [130, 1040, 170, 1080])).toBeGreaterThan(PAREDE)
  })

  it('jogador: costa longe do que ele conhece não faz parede, nem no mar que ele vê', async () => {
    const riscos = [riscoNaCosta('a', 'riscar', 200, 400, 1000, 40)]
    // Ele conhece o mar só a partir de 1100: a costa (1000) está fora do alcance.
    const longeDaCosta = comRiscos(riscos, { visao: [retangulo(0, 1100, 1000, 1500)] })
    expect(maiorAlfaNoMundo(await gerar(longeDaCosta), longeDaCosta, [250, 1100, 350, 1200])).toBeLessThan(PAREDE)
    // Controle: com a costa vista (terra e mar), a parede aparece.
    const comCosta = comRiscos(riscos, { visao: [retangulo(0, 900, 1000, 1500)] })
    expect(maiorAlfaNoMundo(await gerar(comCosta), comCosta, [280, 1040, 320, 1080])).toBeGreaterThan(PAREDE)
  })

  it('jogador no mar diante de uma Sala (a terra fechada para quem está fora): o mar até a beira basta', async () => {
    const riscos = [riscoNaCosta('a', 'riscar', 200, 400, 1000, 40)]
    // Conhece o mar desde a beira (1002, o antialias da costa), nada da terra.
    const doMar = comRiscos(riscos, { visao: [retangulo(0, 1002, 1000, 1500)] })
    expect(maiorAlfaNoMundo(await gerar(doMar), doMar, [280, 1040, 320, 1080])).toBeGreaterThan(PAREDE)
  })

  it('jogador na terra que nunca viu o mar: a parede é gerada, mas cai no mar que a máscara da névoa cobre', async () => {
    // A máscara é do `PlayerView`; aqui só a origem: a costa vista dá a parede (a tela a esconde no mar desconhecido).
    const riscos = [riscoNaCosta('a', 'riscar', 200, 400, 1000, 40)]
    const daTerra = comRiscos(riscos, { visao: [retangulo(0, 500, 1000, 1000)] })
    expect(maiorAlfaNoMundo(await gerar(daTerra), daTerra, [280, 1040, 320, 1080])).toBeGreaterThan(PAREDE)
  })

  it('mapa de antes da altura (riscos sem o campo): a textura sai IDÊNTICA à da v0.4.24', async () => {
    // As impressões abaixo saíram do rasterizador da v0.4.24, ANTES da altura
    // por risco existir: o mapa antigo (todo risco médio) tem de abrir igual,
    // pixel a pixel, no mestre e no jogador.
    const riscos = [riscoNaCosta('a', 'riscar', 100, 600, 1000, 40), riscoNaCosta('b', 'riscar', 700, 900, 1000, 60), riscoNaCosta('c', 'apagar', 400, 440, 1000, 80)]
    expect(impressao(await gerar(comRiscos(riscos)))).toBe(IMPRESSAO_DO_MESTRE_V0424)
    expect(impressao(await gerar(comRiscos(riscos, { visao: [retangulo(0, 900, 800, 1500)] })))).toBe(IMPRESSAO_DO_JOGADOR_V0424)
  })

  /**
   * Quanto a parede desce na coluna `x` do mundo, em px de mundo: a maior
   * sequência de texels opacos (parede) logo abaixo da costa (y = 1000).
   */
  function alturaNaColuna(tela: TelaFalsa, p: PlanoDoRelevo, x: number): number {
    const i = Math.floor((x - p.retangulo.x) * p.escala)
    let maior = 0
    let seguidos = 0
    for (let j = Math.floor((1000 - p.retangulo.y) * p.escala); j < tela.height; j += 1) {
      seguidos = tela.alfa(i, j) > PAREDE ? seguidos + 1 : 0
      maior = Math.max(maior, seguidos)
    }
    return maior / p.escala
  }

  /** As cores (sem o alfa) da parede na coluna `x`, do lábio ao pé. */
  function coresNaColuna(tela: TelaFalsa, p: PlanoDoRelevo, x: number): [number, number, number][] {
    const i = Math.floor((x - p.retangulo.x) * p.escala)
    const cores: [number, number, number][] = []
    for (let j = Math.floor((1000 - p.retangulo.y) * p.escala); j < tela.height; j += 1) {
      const k = (j * tela.width + i) * 4
      const a = tela.dados[k + 3]
      if (a > PAREDE) cores.push([tela.dados[k] / a, tela.dados[k + 1] / a, tela.dados[k + 2] / a])
      else if (cores.length > 0) break
    }
    return cores
  }

  function comAltura(traco: TracoDePenhasco, altura: TracoDePenhasco['altura']): TracoDePenhasco {
    return { ...traco, altura }
  }

  // A tela falsa pinta pixel a pixel, e a rampa tem vários degraus por rasterização:
  // sob a carga da suíte inteira, 5 s não bastam (medido em 10/10/2026).
  describe('altura por risco (Baixo, Médio, Alto)', { timeout: 30_000 }, () => {
    const MEDIA = AJUSTE_DO_PENHASCO.altura * 10
    const BAIXA = alturaDaParede({ altura: 'baixo' }) * 10
    const ALTA = alturaDaParede({ altura: 'alto' }) * 10
    /** Um texel e pouco de folga, em px de mundo (a textura daqui tem ~7 px de mundo por texel). */
    const FOLGA = 16

    it('cada risco desce a altura dele: Baixo menos que o Médio, Alto mais', async () => {
      const medir = async (altura: TracoDePenhasco['altura']) => {
        const p = comRiscos([comAltura(riscoNaCosta('a', 'riscar', 200, 800, 1000, 40), altura)])
        return alturaNaColuna(await gerar(p), p, 500)
      }
      expect(Math.abs((await medir(undefined)) - MEDIA)).toBeLessThan(FOLGA)
      expect(Math.abs((await medir('baixo')) - BAIXA)).toBeLessThan(FOLGA)
      expect(Math.abs((await medir('alto')) - ALTA)).toBeLessThan(FOLGA)
    })

    it('as faixas esticam na proporção: o veio e a base molhada continuam lá, no Baixo e no Alto', async () => {
      const soma = (c: readonly number[]) => c[0] + c[1] + c[2]
      for (const altura of ['baixo', 'alto'] as const) {
        const p = comRiscos([comAltura(riscoNaCosta('a', 'riscar', 200, 800, 1000, 40), altura)])
        const cores = coresNaColuna(await gerar(p), p, 500)
        // Uma janela da coluna, em frações das faixas do protótipo (de 0 a 18).
        const janela = (de: number, ate: number) => cores.slice(Math.floor((de / 18) * cores.length), Math.ceil((ate / 18) * cores.length)).map(soma)
        const veio = Math.min(...janela(5.6, 8))
        expect(veio, altura).toBeLessThan(Math.min(...janela(2.6, 5.4)))
        expect(veio, altura).toBeLessThan(Math.min(...janela(8.4, 11.4)))
        const pe = janela(15.2, 18)
        expect(pe.reduce((a, b) => a + b, 0) / pe.length, altura).toBeLessThan(Math.min(...janela(8.4, 11.4)))
      }
    })

    it('onde riscos de alturas diferentes se sobrepõem, vale o último', async () => {
      const longo = riscoNaCosta('a', 'riscar', 100, 900, 1000, 40)
      // Longo o bastante para a rampa de cada emenda chegar ao Alto antes do meio.
      const altoNoMeio = comAltura(riscoNaCosta('b', 'riscar', 250, 750, 1000, 40), 'alto')
      const p = comRiscos([longo, altoNoMeio])
      const tela = await gerar(p)
      expect(Math.abs(alturaNaColuna(tela, p, 500) - ALTA)).toBeLessThan(FOLGA)
      expect(Math.abs(alturaNaColuna(tela, p, 150) - MEDIA)).toBeLessThan(FOLGA)
      // Um Médio largo por cima do Alto volta o meio a Médio.
      const q = comRiscos([longo, altoNoMeio, riscoNaCosta('c', 'riscar', 300, 700, 1000, 40)])
      expect(Math.abs(alturaNaColuna(await gerar(q), q, 500) - MEDIA)).toBeLessThan(FOLGA)
    })

    it('rampa: do Médio ao Alto encostados a parede cresce aos poucos, sem buraco na emenda', async () => {
      const p = comRiscos([riscoNaCosta('m', 'riscar', 0, 500, 1000, 40), comAltura(riscoNaCosta('a', 'riscar', 500, 1000, 1000, 40), 'alto')])
      const tela = await gerar(p)
      expect(Math.abs(alturaNaColuna(tela, p, 200) - MEDIA)).toBeLessThan(FOLGA)
      expect(Math.abs(alturaNaColuna(tela, p, 960) - ALTA)).toBeLessThan(FOLGA)
      const rampa = [460, 520, 580, 640, 700, 760, 820].map((x) => alturaNaColuna(tela, p, x))
      for (const h of rampa) expect(h).toBeGreaterThan(MEDIA - FOLGA)
      for (let i = 1; i < rampa.length; i += 1) expect(rampa[i]).toBeGreaterThanOrEqual(rampa[i - 1] - 1)
      // No meio da rampa, nem Médio nem Alto: um degrau seco pularia direto de um ao outro.
      expect(rampa.some((h) => h > MEDIA + FOLGA && h < ALTA - FOLGA)).toBe(true)
    })

    it('a sombra no mar sai do pé da parede Alta: cai mais longe que a da Média', async () => {
      const alemDaMedia: [number, number, number, number] = [250, 1600, 350, 1700]
      const medio = comRiscos([riscoNaCosta('a', 'riscar', 100, 900, 1000, 40)])
      expect(maiorAlfaNoMundo(await gerar(medio), medio, alemDaMedia)).toBe(0)
      const alto = comRiscos([comAltura(riscoNaCosta('a', 'riscar', 100, 900, 1000, 40), 'alto')])
      expect(maiorAlfaNoMundo(await gerar(alto), alto, alemDaMedia)).toBeGreaterThan(0.1)
    })

    it('jogador que conhece a costa vê a parede Alta com a altura do mestre', async () => {
      const riscos = [comAltura(riscoNaCosta('a', 'riscar', 200, 800, 1000, 40), 'alto')]
      const mestre = comRiscos(riscos)
      const jogador = comRiscos(riscos, { visao: [retangulo(0, 900, 1000, 1500)] })
      expect(alturaNaColuna(await gerar(jogador), jogador, 500)).toBeCloseTo(alturaNaColuna(await gerar(mestre), mestre, 500), 0)
    })
  })

  it('jogador cujo conhecido acaba na terra um pouco acima da costa: a parede não sai do corte da névoa', async () => {
    // O topo da parede vem só da BEIRA de baixo da terra. Se viesse da terra
    // inteira sob o risco, o corte do conhecido (y = 960) viraria um topo
    // falso, e a parede desceria de ~980 com as faixas fora do lugar.
    const riscos = [riscoNaCosta('a', 'riscar', 200, 400, 1000, 40)]
    const acimaDaCosta = comRiscos(riscos, { visao: [retangulo(0, 500, 1000, 960)] })
    expect(maiorAlfaNoMundo(await gerar(acimaDaCosta), acimaDaCosta, [280, 1040, 320, 1080])).toBeLessThan(PAREDE)
  })
})
