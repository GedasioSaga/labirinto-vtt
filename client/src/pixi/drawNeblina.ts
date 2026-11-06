import { BufferImageSource, CanvasSource, Container, Geometry, GlProgram, Mesh, Shader, UniformGroup, type Renderer, type Ticker, type TextureSource } from 'pixi.js'
import type { PinceladaDeNeblina, Periodo } from '../types/map'
import { CURVAS, mulberry32 } from '../cenario/revelacao/tempo'
import { caixaDaNeblinaPintada } from '../lib/neblina'
import { erroNoContexto } from './malhaDoTraco'

/**
 * NEBLINA no palco (`lib/neblina.ts`): UM quadrilátero com um shader próprio,
 * no mundo, por cima da noite e da névoa de guerra. Por quadro só mudam três
 * deslocamentos (uniforms); nada é redesenhado, e não há filtro (nenhuma
 * passada a mais). A camada é um grupo de render próprio.
 *
 * - A BRUMA vem de uma textura de ruído de 128 x 128 que se repete sem emenda,
 *   feita UMA vez, lida em três escalas, cada uma girada e andando para um
 *   lado. A camada larga torce as outras duas: a bruma se desfaz e se refaz
 *   em vez de deslizar inteira, e o ladrilho não se vê repetir.
 * - A ÁREA PINTADA é uma máscara pequena (2 texels por célula, no máximo 512
 *   de lado, só na caixa das pinceladas), pintada em tela 2D a cada mudança
 *   do pincel, nunca por quadro.
 * - A chave do mapa inteiro é só um número no shader.
 *
 * Só cobre: a cor é sempre a da bruma por cima do que houver, então nunca
 * mostra o que a névoa de guerra esconde. O relógio só roda com a neblina
 * andando ou aparecendo; movimento reduzido (ou "Efeitos do mapa" desligado)
 * = bruma parada.
 */

/**
 * OS NÚMEROS QUE SE AJUSTAM (rascunho para o mestre aprovar, 06/11/2026):
 * velocidade, opacidade, escala e cor. Mexer aqui não muda nada fora do
 * desenho.
 */
export const AJUSTE_DA_NEBLINA = {
  /** Lado do ladrilho de ruído, em células: o tamanho dos novelos da bruma. */
  ladrilhoEmCelulas: 14,
  /** Opacidade da bruma mais densa na intensidade 100 (a rala fica em `piso` disso). */
  alfaMaximo: 0.55,
  /** Fração do alfa onde a bruma é mais rala: nunca some de todo dentro da área. */
  piso: 0.3,
  /** Deriva de cada camada, em ladrilhos por segundo (a larga, a média e o detalhe), cada uma para um lado. */
  derivaLarga: [0.0042, 0.0016],
  derivaMedia: [0.011, -0.004],
  derivaFina: [-0.03, 0.02],
  /** A cor da bruma em cada período (0 a 1): clara de dia, morna à tarde, azul-acinzentada à noite. */
  cor: {
    dia: [0.88, 0.9, 0.92],
    tarde: [0.9, 0.85, 0.8],
    noite: [0.62, 0.68, 0.78],
  } satisfies Record<Periodo, readonly [number, number, number]>,
  /** Quanto a bruma leva para aparecer (ms) quando a cena ganha neblina, e para sumir quando perde. */
  aparecerMs: 900,
  sumirMs: 300,
} as const

/** Lado da textura de ruído (potência de 2: repete e gera mipmap em qualquer placa). */
export const LADO_DO_RUIDO = 128
/** Texels da máscara por célula, e o teto de lado dela. */
export const TEXELS_POR_CELULA = 2
export const LADO_MAXIMO_DA_MASCARA = 512
/** Folga transparente em volta da máscara: fora da caixa, o `clamp` lê zero. */
// Três vezes o desfoque (uma célula = 2 texels): a cauda macia cabe inteira na
// máscara e o quadrado desenhado não corta a beirada em linha reta.
const BORDA_DA_MASCARA = 6
/** De quanto em quanto tempo, com a bruma andando, o renderer confere se a pessoa passou a pedir menos movimento. */
const CONFERIR_MOVIMENTO_MS = 1000

const VERTICE = `#version 300 es
precision highp float;
in vec2 aPosition;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
// x, y, largura, altura (px de mundo) do retângulo desenhado.
uniform vec4 uCaixa;
out vec2 vPos;
void main() {
  vec2 p = uCaixa.xy + aPosition * uCaixa.zw;
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(p, 1.0)).xy, 0.0, 1.0);
  vPos = p;
}
`

const PIXEL = `#version 300 es
precision highp float;
in vec2 vPos;
uniform vec4 uColor;
uniform sampler2D uRuido;
uniform sampler2D uMascara;
// 1 / lado do ladrilho (px), mapa inteiro (0 a 1), alfa máximo, tem máscara (0 ou 1).
uniform vec4 uMapa;
// x, y, 1 / largura, 1 / altura da máscara (px de mundo).
uniform vec4 uCaixaDaMascara;
// deriva da camada larga (xy) e da média (zw), em frações do ladrilho.
uniform vec4 uDeriva;
// deriva do detalhe (xy); z = piso da bruma.
uniform vec4 uDetalhe;
uniform vec3 uCor;
out vec4 finalColor;
const mat2 GIRO = mat2(0.8, -0.6, 0.6, 0.8);
void main() {
  vec2 p = vPos * uMapa.x;
  float largo = texture(uRuido, GIRO * p * 0.41 + uDeriva.xy).g;
  vec2 torcao = vec2(largo - 0.5, texture(uRuido, p * 0.29 - uDeriva.xy).r - 0.5) * 0.6;
  float medio = texture(uRuido, p + uDeriva.zw + torcao).r;
  float fino = texture(uRuido, GIRO * p * 2.17 + uDetalhe.xy + torcao * 1.7).g;
  float bruma = smoothstep(0.3, 0.72, largo * 0.5 + medio * 0.35 + fino * 0.15);
  float area = uMapa.y;
  if (uMapa.w > 0.5) {
    vec2 m = (vPos - uCaixaDaMascara.xy) * uCaixaDaMascara.zw;
    area = max(area, texture(uMascara, m).a);
  }
  float a = area * mix(uDetalhe.z, 1.0, bruma) * uMapa.z;
  if (a <= 0.003) discard;
  finalColor = vec4(uCor * a, a) * uColor.a;
}
`

let programa: GlProgram | null = null
function programaDaNeblina(): GlProgram {
  programa ??= new GlProgram({ vertex: VERTICE, fragment: PIXEL, name: 'neblina' })
  return programa
}

const compilou = new WeakMap<object, boolean>()

/** O shader da neblina compila e liga neste renderer? Uma vez por renderer. Não compilou = sem neblina (com aviso). */
export function neblinaCompila(renderer: Renderer): boolean {
  const sabido = compilou.get(renderer)
  if (sabido !== undefined) return sabido
  let erro: string | null = 'o renderer não é WebGL'
  if ('gl' in renderer) {
    const gl = renderer.gl
    erro = gl.isContextLost() ? 'contexto perdido' : erroNoContexto(gl, programaDaNeblina())
  }
  const ok = erro === null
  compilou.set(renderer, ok)
  if (!ok) console.warn(`[neblina] o shader não compilou nesta placa; a neblina não aparece (${erro})`)
  return ok
}

// ---------- o ruído ----------

/** Ruído de valor periódico (repete a cada `periodo` células da grade), interpolado pelo quíntico. */
function ruidoPeriodico(lado: number, periodo: number, sorteio: () => number): Float32Array {
  const grade = new Float32Array(periodo * periodo)
  for (let i = 0; i < grade.length; i += 1) grade[i] = sorteio()
  const saida = new Float32Array(lado * lado)
  const passo = periodo / lado
  const suave = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
  for (let y = 0; y < lado; y += 1) {
    const gy = y * passo
    const y0 = Math.floor(gy)
    const ty = suave(gy - y0)
    const l0 = (y0 % periodo) * periodo
    const l1 = ((y0 + 1) % periodo) * periodo
    for (let x = 0; x < lado; x += 1) {
      const gx = x * passo
      const x0 = Math.floor(gx)
      const tx = suave(gx - x0)
      const c0 = x0 % periodo
      const c1 = (x0 + 1) % periodo
      const a = grade[l0 + c0] + (grade[l0 + c1] - grade[l0 + c0]) * tx
      const b = grade[l1 + c0] + (grade[l1 + c1] - grade[l1 + c0]) * tx
      saida[y * lado + x] = a + (b - a) * ty
    }
  }
  return saida
}

/** Quatro oitavas somadas e esticadas para 0..1: novelos grandes com a beirada miúda. */
function fbm(lado: number, semente: number): Float32Array {
  const sorteio = mulberry32(semente)
  const soma = new Float32Array(lado * lado)
  let amplitude = 1
  for (const periodo of [4, 8, 16, 32]) {
    const oitava = ruidoPeriodico(lado, periodo, sorteio)
    for (let i = 0; i < soma.length; i += 1) soma[i] += oitava[i] * amplitude
    amplitude *= 0.5
  }
  let min = Infinity
  let max = -Infinity
  for (const v of soma) {
    min = Math.min(min, v)
    max = Math.max(max, v)
  }
  const faixa = max - min || 1
  for (let i = 0; i < soma.length; i += 1) soma[i] = (soma[i] - min) / faixa
  return soma
}

/** Os dois ruídos (R e G, sementes diferentes) que o shader lê. Exportado para o teste. */
export function pixelsDoRuido(lado = LADO_DO_RUIDO): Uint8Array {
  const r = fbm(lado, 0x6e65626c)
  const g = fbm(lado, 0x62727561)
  const px = new Uint8Array(lado * lado * 4)
  for (let i = 0; i < lado * lado; i += 1) {
    px[i * 4] = Math.round(r[i] * 255)
    px[i * 4 + 1] = Math.round(g[i] * 255)
    px[i * 4 + 3] = 255
  }
  return px
}

function texturaDoRuido(): TextureSource {
  return new BufferImageSource({
    resource: pixelsDoRuido(),
    width: LADO_DO_RUIDO,
    height: LADO_DO_RUIDO,
    format: 'rgba8unorm',
    scaleMode: 'linear',
    addressMode: 'repeat',
    // Com o mapa inteiro na tela, a bruma vira um véu liso em vez de chuvisco piscando.
    autoGenerateMipmaps: true,
    alphaMode: 'no-premultiply-alpha',
  })
}

// ---------- a máscara do pincel ----------

export interface CaixaDaMascara {
  x: number
  y: number
  largura: number
  altura: number
  /** Texels por px de mundo. */
  escala: number
  /** Lado da tela da máscara, já com a borda. */
  texelsX: number
  texelsY: number
}

/** A caixa e a resolução da máscara para estas pinceladas; `null` = nenhuma pincelada de pincel. */
export function caixaDaMascara(lista: readonly PinceladaDeNeblina[], grid: number): CaixaDaMascara | null {
  const caixa = caixaDaNeblinaPintada(lista)
  if (caixa === null || caixa.largura <= 0 || caixa.altura <= 0) return null
  const escala = Math.min(TEXELS_POR_CELULA / Math.max(1, grid), (LADO_MAXIMO_DA_MASCARA - 2 * BORDA_DA_MASCARA) / Math.max(caixa.largura, caixa.altura))
  return {
    ...caixa,
    escala,
    texelsX: Math.max(1, Math.ceil(caixa.largura * escala)) + 2 * BORDA_DA_MASCARA,
    texelsY: Math.max(1, Math.ceil(caixa.altura * escala)) + 2 * BORDA_DA_MASCARA,
  }
}

function caminho(g: CanvasRenderingContext2D, pontos: PinceladaDeNeblina['pontos']): void {
  g.beginPath()
  const [primeiro, ...resto] = pontos
  g.moveTo(primeiro.x, primeiro.y)
  // Um ponto só (um clique) também vira um disco: a ponta redonda de um traço quase nulo.
  if (resto.length === 0) g.lineTo(primeiro.x + 0.01, primeiro.y)
  for (const p of resto) g.lineTo(p.x, p.y)
}

/**
 * Pinta a máscara: o pincel DEIXA a neblina na força dele (tira o que havia
 * debaixo e põe a força), a borracha tira a força dela. A beirada macia vem
 * de um desfoque de uma célula no fim.
 */
function pintarMascara(lista: readonly PinceladaDeNeblina[], caixa: CaixaDaMascara, grid: number): HTMLCanvasElement | null {
  const nitida = document.createElement('canvas')
  nitida.width = caixa.texelsX
  nitida.height = caixa.texelsY
  const g = nitida.getContext('2d')
  if (g === null) return null
  g.setTransform(caixa.escala, 0, 0, caixa.escala, BORDA_DA_MASCARA - caixa.x * caixa.escala, BORDA_DA_MASCARA - caixa.y * caixa.escala)
  g.lineCap = 'round'
  g.lineJoin = 'round'
  g.strokeStyle = '#ffffff'
  for (const passo of lista) {
    if (passo.pontos.length === 0) continue
    g.lineWidth = passo.raio * 2
    caminho(g, passo.pontos)
    g.globalCompositeOperation = 'destination-out'
    g.globalAlpha = passo.tipo === 'pincel' ? 1 : passo.forca
    g.stroke()
    if (passo.tipo === 'pincel') {
      g.globalCompositeOperation = 'source-over'
      g.globalAlpha = passo.forca
      g.stroke()
    }
  }
  const macia = document.createElement('canvas')
  macia.width = caixa.texelsX
  macia.height = caixa.texelsY
  const m = macia.getContext('2d')
  if (m === null) return nitida
  m.filter = `blur(${Math.max(1, grid * caixa.escala).toFixed(2)}px)`
  m.drawImage(nitida, 0, 0)
  return macia
}

/**
 * O retângulo desenhado quando só há neblina pintada: a máscara inteira, com a
 * borda da cauda macia, recortada no mapa. Usar só a caixa das pinceladas
 * cortava o desfoque em linha reta e a pincelada virava um retângulo.
 */
function quadroDaMascara(caixa: CaixaDaMascara, largura: number, altura: number): [number, number, number, number] {
  const borda = BORDA_DA_MASCARA / caixa.escala
  const x0 = Math.max(0, caixa.x - borda)
  const y0 = Math.max(0, caixa.y - borda)
  const x1 = Math.min(largura, caixa.x - borda + caixa.texelsX / caixa.escala)
  const y1 = Math.min(altura, caixa.y - borda + caixa.texelsY / caixa.escala)
  return [x0, y0, Math.max(0, x1 - x0), Math.max(0, y1 - y0)]
}

function telaVazia(): CanvasSource {
  const tela = document.createElement('canvas')
  tela.width = 1
  tela.height = 1
  return new CanvasSource({ resource: tela, scaleMode: 'linear', addressMode: 'clamp-to-edge' })
}

// ---------- o renderer ----------

export interface EntradaDaNeblina {
  /** Tamanho do mapa em px de mundo e o lado da célula. */
  largura: number
  altura: number
  grid: number
  /** A chave do mapa inteiro, 0 a 1 (`intensidadeDoMapaInteiro`). */
  inteira: number
  /** As pinceladas do piso à vista (no jogador, já cortadas no recorte). */
  pintada: readonly PinceladaDeNeblina[] | undefined
  /** `false` = bruma parada ("Efeitos do mapa" desligado no jogador). */
  animar: boolean
}

export interface MovimentoDaNeblina {
  ticker: Pick<Ticker, 'add' | 'remove'>
  reducedMotion: () => boolean
  /** Relógio de PAREDE em ms (padrão `Date.now()`): a bruma passa no mesmo lugar no mestre e no jogador. */
  agora?: () => number
}

/** O que a tela anota para a medida e a conferência (`data-neblina`). */
export interface EstadoDaNeblina {
  ligada: boolean
  movendo: boolean
  /** Texels da máscara (`LxA`), ou `''` sem pincelada. */
  mascara: string
}

export interface NeblinaRenderer {
  readonly camada: Container
  /** `null` = sem neblina (a camada some de leve e o relógio sai). */
  atualizar: (entrada: EntradaDaNeblina | null) => void
  /** O período da tinta à vista (`null` = dia): só a cor da bruma muda. */
  setPeriodo: (periodo: Periodo | null) => void
  destruir: () => void
}

function fracao(v: number): number {
  return v - Math.floor(v)
}

export function createNeblinaRenderer(
  renderer: Renderer,
  movimento: MovimentoDaNeblina,
  opcoes: { aoMudar?: (estado: EstadoDaNeblina) => void } = {},
): NeblinaRenderer {
  const agora = movimento.agora ?? Date.now
  const camada = new Container()
  camada.label = 'neblina'
  camada.eventMode = 'none'
  camada.interactiveChildren = false
  camada.visible = false
  camada.alpha = 0
  // Grupo de render próprio: os uniforms por quadro ficam nele.
  camada.enableRenderGroup()

  let mesh: Mesh<Geometry, Shader> | null = null
  let ajustes: UniformGroup | null = null
  let ruido: TextureSource | null = null
  let mascara: CanvasSource = telaVazia()
  let pintadaDesenhada: readonly PinceladaDeNeblina[] | undefined
  let gridDesenhado = 0
  let temMascara = false
  let caixaAtual: CaixaDaMascara | null = null
  let noRelogio = false
  let movendo = false
  /** Onde a bruma parada fica (s do relógio): 0 = aberta já parada; senão, o instante em que parou. */
  let instanteParado = 0
  let conferidoEm = 0
  let alvo = 0
  let fadeDesde: { t: number; de: number } | null = null
  let periodo: Periodo = 'dia'
  let avisado = ''

  function montar(): boolean {
    if (mesh !== null) return true
    if (!neblinaCompila(renderer)) return false
    ruido = texturaDoRuido()
    ajustes = new UniformGroup({
      uCaixa: { value: new Float32Array(4), type: 'vec4<f32>' },
      uMapa: { value: new Float32Array(4), type: 'vec4<f32>' },
      uCaixaDaMascara: { value: new Float32Array([0, 0, 1, 1]), type: 'vec4<f32>' },
      uDeriva: { value: new Float32Array(4), type: 'vec4<f32>' },
      uDetalhe: { value: new Float32Array([0, 0, AJUSTE_DA_NEBLINA.piso, 0]), type: 'vec4<f32>' },
      uCor: { value: new Float32Array(AJUSTE_DA_NEBLINA.cor.dia), type: 'vec3<f32>' },
    })
    const shader = new Shader({ glProgram: programaDaNeblina(), resources: { uRuido: ruido, uMascara: mascara, neblina: ajustes } })
    const geometria = new Geometry({
      attributes: { aPosition: { buffer: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), format: 'float32x2' } },
      indexBuffer: new Uint16Array([0, 1, 2, 0, 2, 3]),
    })
    mesh = new Mesh<Geometry, Shader>({ geometry: geometria, shader })
    mesh.eventMode = 'none'
    camada.addChild(mesh)
    return true
  }

  function avisar(): void {
    const estado: EstadoDaNeblina = { ligada: alvo > 0, movendo, mascara: caixaAtual === null ? '' : `${caixaAtual.texelsX}x${caixaAtual.texelsY}` }
    const chave = `${estado.ligada}:${estado.movendo}:${estado.mascara}`
    if (chave === avisado) return
    avisado = chave
    opcoes.aoMudar?.(estado)
  }

  function trocarMascara(nova: CanvasSource): void {
    const velha = mascara
    mascara = nova
    if (mesh !== null && mesh.shader !== null) mesh.shader.resources.uMascara = nova
    velha.destroy()
  }

  /** Repinta a máscara só quando a lista (ou a célula) mudou de referência. */
  function refazerMascara(lista: readonly PinceladaDeNeblina[] | undefined, grid: number): void {
    if (lista === pintadaDesenhada && grid === gridDesenhado) return
    pintadaDesenhada = lista
    gridDesenhado = grid
    const caixa = lista === undefined ? null : caixaDaMascara(lista, grid)
    const tela = caixa === null || lista === undefined ? null : pintarMascara(lista, caixa, grid)
    if (caixa === null || tela === null) {
      temMascara = false
      caixaAtual = null
      return
    }
    caixaAtual = caixa
    temMascara = true
    trocarMascara(new CanvasSource({ resource: tela, scaleMode: 'linear', addressMode: 'clamp-to-edge' }))
    if (ajustes !== null) {
      const v = ajustes.uniforms.uCaixaDaMascara as Float32Array
      // A origem da máscara é a da caixa menos a borda transparente.
      const origemX = caixa.x - BORDA_DA_MASCARA / caixa.escala
      const origemY = caixa.y - BORDA_DA_MASCARA / caixa.escala
      v[0] = origemX
      v[1] = origemY
      v[2] = caixa.escala / caixa.texelsX
      v[3] = caixa.escala / caixa.texelsY
    }
  }

  /** Os três deslocamentos do instante `segundos` (frações do ladrilho: a volta é sem emenda). */
  function derivar(segundos: number): void {
    if (ajustes === null) return
    const d = ajustes.uniforms.uDeriva as Float32Array
    const f = ajustes.uniforms.uDetalhe as Float32Array
    const { derivaLarga, derivaMedia, derivaFina } = AJUSTE_DA_NEBLINA
    d[0] = fracao(segundos * derivaLarga[0])
    d[1] = fracao(segundos * derivaLarga[1])
    d[2] = fracao(segundos * derivaMedia[0])
    d[3] = fracao(segundos * derivaMedia[1])
    f[0] = fracao(segundos * derivaFina[0])
    f[1] = fracao(segundos * derivaFina[1])
  }

  function pintarCor(): void {
    if (ajustes === null) return
    const cor = ajustes.uniforms.uCor as Float32Array
    cor.set(AJUSTE_DA_NEBLINA.cor[periodo])
  }

  function entrarNoRelogio(): void {
    if (noRelogio) return
    noRelogio = true
    movimento.ticker.add(passo)
  }

  function sairDoRelogio(): void {
    if (!noRelogio) return
    noRelogio = false
    movimento.ticker.remove(passo)
  }

  function passo(): void {
    const t = agora()
    if (fadeDesde !== null) {
      const duracao = alvo > fadeDesde.de ? AJUSTE_DA_NEBLINA.aparecerMs : AJUSTE_DA_NEBLINA.sumirMs
      const feito = (t - fadeDesde.t) / duracao
      if (feito >= 1 || feito < 0) {
        fadeDesde = null
        camada.alpha = alvo
        if (alvo === 0) camada.visible = false
      } else {
        camada.alpha = fadeDesde.de + (alvo - fadeDesde.de) * CURVAS.saida.f(feito)
      }
    }
    if (movendo) {
      if (Math.abs(t - conferidoEm) >= CONFERIR_MOVIMENTO_MS) {
        conferidoEm = t
        if (movimento.reducedMotion()) {
          movendo = false
          instanteParado = t / 1000
        }
      }
      if (movendo) derivar(t / 1000)
    }
    if (!movendo && fadeDesde === null) sairDoRelogio()
    avisar()
  }

  /** Leva a camada à opacidade `novo` de leve (aparece devagar, some rápido). */
  function irPara(novo: number): void {
    if (novo === alvo && (fadeDesde !== null || camada.alpha === novo)) return
    alvo = novo
    if (novo > 0) camada.visible = true
    fadeDesde = { t: agora(), de: camada.alpha }
    entrarNoRelogio()
  }

  return {
    camada,
    atualizar(entrada) {
      if (entrada === null || entrada.largura <= 0 || entrada.altura <= 0) {
        movendo = false
        irPara(0)
        avisar()
        return
      }
      if (!montar() || ajustes === null) {
        avisar()
        return
      }
      refazerMascara(entrada.pintada, entrada.grid)
      const inteira = Math.min(1, Math.max(0, entrada.inteira))
      if (inteira <= 0 && !temMascara) {
        movendo = false
        irPara(0)
        avisar()
        return
      }
      // O retângulo desenhado: o mapa todo com a chave ligada; sem ela, só a caixa das pinceladas.
      const caixa = ajustes.uniforms.uCaixa as Float32Array
      if (inteira > 0 || caixaAtual === null) caixa.set([0, 0, entrada.largura, entrada.altura])
      else caixa.set(quadroDaMascara(caixaAtual, entrada.largura, entrada.altura))
      const mapa = ajustes.uniforms.uMapa as Float32Array
      mapa[0] = 1 / (AJUSTE_DA_NEBLINA.ladrilhoEmCelulas * Math.max(1, entrada.grid))
      mapa[1] = inteira
      mapa[2] = AJUSTE_DA_NEBLINA.alfaMaximo
      mapa[3] = temMascara ? 1 : 0
      pintarCor()
      const t = agora()
      const andar = entrada.animar && !movimento.reducedMotion()
      if (andar && !movendo) conferidoEm = t
      // Parou agora: a bruma fica no instante em que parou (aberta já parada, no começo do relógio).
      if (!andar && movendo) instanteParado = t / 1000
      movendo = andar
      derivar(movendo ? t / 1000 : instanteParado)
      irPara(1)
      if (movendo) entrarNoRelogio()
      avisar()
    },
    setPeriodo(novo) {
      const proximo = novo ?? 'dia'
      if (proximo === periodo) return
      periodo = proximo
      pintarCor()
    },
    destruir() {
      sairDoRelogio()
      camada.destroy({ children: true })
      mascara.destroy()
      ruido?.destroy()
      ruido = null
      mesh = null
      ajustes = null
    },
  }
}

/** Põe `no` logo abaixo de `acima` dentro de `pai`, se já não estiver lá (a pilha de camadas mexe nos filhos). */
export function logoAbaixoDe(pai: Container, no: Container, acima: Container): void {
  const i = pai.getChildIndex(acima)
  if (i > 0 && pai.children[i - 1] === no) return
  if (no.parent !== null) no.removeFromParent()
  pai.addChildAt(no, pai.getChildIndex(acima))
}
