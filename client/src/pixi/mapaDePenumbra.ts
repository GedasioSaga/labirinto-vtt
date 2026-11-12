import { Container, Geometry, GlProgram, Graphics, GraphicsContext, Matrix, Mesh, RenderTexture, Shader, UniformGroup, type Renderer } from 'pixi.js'
import type { RegionPoint } from '../types/map'
import { erroNoContexto } from './malhaDoTraco'

/**
 * PENUMBRA POR DENTRO (sombras da caça de 12/11/2026; proposta em
 * `tmp/caca-2026-11-12/sombras/PROPOSTA.md`, protótipo aprovado pelo mestre em
 * `docs/design/sombras/prototipo-sombras.html`).
 *
 * O escuro da visão do jogador deixa de ser recortado a tesoura:
 *
 * - Um MAPA DE PENUMBRA em baixa resolução (8 texels por casa, no máximo meia
 *   tela) com dois campos: "vejo agora" (canal R) e "conheço" (canal G). Em cada
 *   um, a área entra em branco, e as paredes do pacote entram em traço branco
 *   largo (senão a penumbra escurece o pé de toda parede). Depois, um borrão
 *   gaussiano (desvio = penumbra / 1,5).
 * - Dois quadriláteros com shader próprio, em MULTIPLY, no lugar do véu preto
 *   (`fogDim`): um por dentro do que ele vê (máscara dura de hoje, direta) e um
 *   no lembrado (a mesma máscara, inversa). A conta, com v e k as rampas dos
 *   dois campos e m a tinta fria do lembrado:
 *     visto:    (m + (1 - m) v) k
 *     lembrado: m k
 *   As duas dão o mesmo número na fronteira (v = 0): não há degrau.
 * - A TROCA DO PASSO: quando o recorte novo chega, o escuro de antes é
 *   fotografado e o novo entra por cima dele em 200 ms (a mistura é feita na
 *   imagem final do escuro, como no protótipo: o que sai da vista também apaga
 *   devagar). Com "menos movimento", troca na hora.
 *
 * A REGRA QUE PROTEGE A NÉVOA: tudo isto fica DEBAIXO de `fogUnknown` e de
 * `concealed`, que não mudam de forma nem de lugar, e SÓ ESCURECE (o fator vai
 * de 0 a 1 e entra em multiply). Nada aqui lê além de `vision`, da memória e das
 * paredes do pacote, e nada escreve neles.
 *
 * Modo leve e placa sem WebGL2: `criarMapaDePenumbra` devolve `null` e a névoa
 * fica a de hoje (véu preto e nunca visto preto).
 */

// ───────────────────────────────────────────────────────────────────────────
// Números aprovados (protótipo das sombras, "aplicar o recomendado", 12/11/2026)
// ───────────────────────────────────────────────────────────────────────────

export const AJUSTE_DA_PENUMBRA = {
  /** Largura da borda suave, em casas: o desvio do borrão é isto / 1,5. */
  larguraEmCasas: 0.45,
  /** Texels dos campos por casa (no máximo meia tela). */
  texelsPorCasa: 8,
  /** A rampa sobre o campo borrado: 0,5 em cima de uma borda reta (zero de claro), cheio em 0,95. */
  rampa: [0.5, 0.95] as const,
  /** As paredes em branco nos campos: espessura + isto vezes o desvio. */
  paredeBrancaEmDesvios: 2.6,
  /**
   * A tinta fria do lembrado: brilho vezes isto, por canal, com teto em 1
   * (`#61708c` a 45%, o padrão do painel). O protótipo tinha 1,25 no azul
   * (`#61708f`); 1,22 segura o azul do padrão em 0,549, abaixo do 0,55 do véu
   * preto de antes: com o padrão, nenhum canal do lembrado fica mais claro que era.
   */
  pesoDaTinta: [0.85, 0.98, 1.22] as const,
  /** O nunca visto: quase preto, frio (o fundo de fora do mapa fica como está). */
  nuncaVisto: 0x06070a,
  /** A troca do passo, em ms, e a curva (a `--ease-out` da casa). */
  misturaMs: 200,
  curva: [0.23, 1, 0.32, 1] as const,
  /** Luz macia (peça E): desvio do borrão do mapa de luz, em px de mundo. */
  luzMaciaPx: 6,
  /** Queda do alcance (peça D): o olho escurece nesta fração final do raio... */
  quedaDoAlcance: 0.3,
  /** ...com teto nesta largura, em casas (de dia, raio enorme: a queda fica longe e estreita). */
  quedaMaximaEmCasas: 3,
  /**
   * Onde o canal da luz (B) segura a queda: cheio a partir de 0,25 do campo
   * borrado. Mais baixo que a rampa da vista para o pé da parede e o canto da
   * sala acesos não caírem (no canto o campo borrado fica perto de 0,25).
   */
  rampaDaLuz: [0, 0.25] as const,
} as const

/** Quantos olhos o shader da queda conhece; os de depois ficam sem queda (como luz). */
export const OLHOS_NA_QUEDA = 8

/** Folga dos campos em volta da vista, em frações dela: arrastar um pouco a câmera não refaz nada. */
const FOLGA_DA_VISTA = 0.25
/** Um texel cobre ao menos isto de px de tela (o teto de meia tela). */
const TEXEL_MINIMO_EM_PX_DE_TELA = 2
/** Lado máximo da textura dos campos (proteção: a conta já fica abaixo disto). */
const LADO_MAXIMO = 2048
/** Raio máximo do borrão, em texels (o laço do shader tem teto fixo). */
const RAIO_MAXIMO_DO_BORRAO = 24

// ───────────────────────────────────────────────────────────────────────────
// Parte pura
// ───────────────────────────────────────────────────────────────────────────

/** A tinta fria do lembrado, por canal (0 a 1), a partir do brilho do painel do jogador. */
export function tintaDoLembrado(brilho: number): [number, number, number] {
  const b = Number.isFinite(brilho) ? Math.min(1, Math.max(0, brilho)) : 0
  const [r, g, a] = AJUSTE_DA_PENUMBRA.pesoDaTinta
  return [Math.min(1, b * r), Math.min(1, b * g), Math.min(1, b * a)]
}

/** O desvio do borrão, em px de mundo. */
export function desvioDaPenumbra(grid: number): number {
  return (AJUSTE_DA_PENUMBRA.larguraEmCasas / 1.5) * grid
}

/** O olho de uma ficha para a queda do alcance (px de mundo). */
export interface OlhoDaPenumbra {
  x: number
  y: number
  raio: number
}

/** O olhar como chega do host (`OlharDaVisao` de `lib/fogFilter.ts`): o olho e os índices dos anéis dele em `vision`. */
export interface OlharDaPenumbra extends OlhoDaPenumbra {
  aneis: readonly number[]
}

/** Os olhos da queda e os anéis que NÃO caem (luz, fresta, vislumbre, olho além do teto do shader). */
export interface OlhosEluzes {
  olhos: readonly OlhoDaPenumbra[]
  luzes: readonly RegionPoint[][]
}

const SEM_OLHOS: OlhosEluzes = { olhos: [], luzes: [] }

/**
 * Separa a visão para a queda do alcance: os `OLHOS_NA_QUEDA` primeiros
 * olhares caem; todo anel que não é de um deles vai para as luzes (canal B),
 * que seguram a queda. Sem olhares, nada cai (e nem há luz a desenhar).
 */
export function separarOlhares(vision: readonly RegionPoint[][], olhares: readonly OlharDaPenumbra[] | undefined): OlhosEluzes {
  if (olhares === undefined || olhares.length === 0) return SEM_OLHOS
  const usados = olhares.slice(0, OLHOS_NA_QUEDA)
  const doOlho = new Set(usados.flatMap((o) => o.aneis))
  return {
    olhos: usados.map((o) => ({ x: o.x, y: o.y, raio: o.raio })),
    luzes: vision.filter((anel, i) => !doOlho.has(i) && anel.length >= 3),
  }
}

/** A largura da queda de um olho, em px de mundo: a fração final do raio, com teto em casas. */
export function larguraDaQueda(raio: number, grid: number): number {
  return Math.min(AJUSTE_DA_PENUMBRA.quedaDoAlcance * raio, AJUSTE_DA_PENUMBRA.quedaMaximaEmCasas * grid)
}

/** A câmera do jogador como a penumbra a vê (px CSS; `resolucao` = px físicos por px CSS). */
export interface VistaDaPenumbra {
  x: number
  y: number
  escala: number
  largura: number
  altura: number
  resolucao: number
}

/** O retângulo de mundo coberto pela textura dos campos, preso na grade de texels. */
export interface CaixaDosCampos {
  x: number
  y: number
  /** Lado do texel, em px de mundo. */
  texel: number
  texelsX: number
  texelsY: number
}

function escalaValida(vista: VistaDaPenumbra): number {
  return vista.escala > 0 && Number.isFinite(vista.escala) ? vista.escala : 1
}

/** O lado do texel para esta escala: 8 por casa; afastado demais, dobra até um texel cobrir 2 px de tela. */
export function texelDaPenumbra(grid: number, escala: number): number {
  const minimo = TEXEL_MINIMO_EM_PX_DE_TELA / (escala > 0 && Number.isFinite(escala) ? escala : 1)
  let texel = grid / AJUSTE_DA_PENUMBRA.texelsPorCasa
  if (!(texel > 0)) return 1
  while (texel < minimo) texel *= 2
  return texel
}

/** O que a vista enxerga do mundo, em px de mundo. */
function retanguloDaVista(vista: VistaDaPenumbra): { x: number; y: number; w: number; h: number } {
  const s = escalaValida(vista)
  return { x: -vista.x / s, y: -vista.y / s, w: vista.largura / s, h: vista.altura / s }
}

/**
 * A caixa dos campos: a vista, mais uma folga de 25% de cada lado e a cauda do
 * borrão. A origem cai num múltiplo do texel em px de mundo (senão a borda
 * "ferve" quando a câmera desliza).
 */
export function caixaDosCampos(vista: VistaDaPenumbra, grid: number): CaixaDosCampos {
  const texel = texelDaPenumbra(grid, escalaValida(vista))
  const v = retanguloDaVista(vista)
  const cauda = 3 * desvioDaPenumbra(grid) + texel
  const mx = v.w * FOLGA_DA_VISTA + cauda
  const my = v.h * FOLGA_DA_VISTA + cauda
  const x = Math.floor((v.x - mx) / texel) * texel
  const y = Math.floor((v.y - my) / texel) * texel
  const texelsX = Math.max(1, Math.min(LADO_MAXIMO, Math.ceil((v.x + v.w + mx - x) / texel)))
  const texelsY = Math.max(1, Math.min(LADO_MAXIMO, Math.ceil((v.y + v.h + my - y) / texel)))
  return { x, y, texel, texelsX, texelsY }
}

/** A vista ainda cabe na caixa (com a cauda do borrão) e na mesma escala de texel? */
export function vistaCabeNaCaixa(vista: VistaDaPenumbra, caixa: CaixaDosCampos, grid: number): boolean {
  if (texelDaPenumbra(grid, escalaValida(vista)) !== caixa.texel) return false
  const v = retanguloDaVista(vista)
  const cauda = 3 * desvioDaPenumbra(grid)
  return (
    v.x - cauda >= caixa.x &&
    v.y - cauda >= caixa.y &&
    v.x + v.w + cauda <= caixa.x + caixa.texelsX * caixa.texel &&
    v.y + v.h + cauda <= caixa.y + caixa.texelsY * caixa.texel
  )
}

/** `cubic-bezier(x1, y1, x2, y2)` como função de x em [0, 1] (a mesma conta do protótipo). */
export function curvaCubica(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t
  const sy = (t: number) => ((ay * t + by) * t + cy) * t
  const dsx = (t: number) => (3 * ax * t + 2 * bx) * t + cx
  return (x) => {
    if (!(x > 0)) return 0
    if (x >= 1) return 1
    let t = x
    for (let i = 0; i < 8; i += 1) {
      const erro = sx(t) - x
      if (Math.abs(erro) < 1e-6) return sy(t)
      const d = dsx(t)
      if (Math.abs(d) < 1e-6) break
      t -= erro / d
    }
    let lo = 0
    let hi = 1
    t = x
    for (let i = 0; i < 30; i += 1) {
      if (sx(t) < x) lo = t
      else hi = t
      t = (lo + hi) / 2
    }
    return sy(t)
  }
}

const CURVA_DA_MISTURA = curvaCubica(...AJUSTE_DA_PENUMBRA.curva)

/** O quanto a troca do passo já andou (0 a 1) depois de `decorridoMs`. */
export function mistura(decorridoMs: number): number {
  return CURVA_DA_MISTURA(decorridoMs / AJUSTE_DA_PENUMBRA.misturaMs)
}

/** Uma parede que barra a vista, do pacote do jogador: o eixo e a espessura do corpo (0 = linha fina). */
export interface ParedeDaPenumbra {
  x1: number
  y1: number
  x2: number
  y2: number
  espessura: number
}

/** O retângulo do traço branco de uma parede (ponta reta, como `lineCap: 'butt'`); `null` = parede de comprimento 0. */
export function tracoBrancoDaParede(p: ParedeDaPenumbra, largura: number): RegionPoint[] | null {
  const dx = p.x2 - p.x1
  const dy = p.y2 - p.y1
  const comprimento = Math.hypot(dx, dy)
  if (!(comprimento > 0) || !(largura > 0)) return null
  const nx = (-dy / comprimento) * (largura / 2)
  const ny = (dx / comprimento) * (largura / 2)
  return [
    { x: p.x1 + nx, y: p.y1 + ny },
    { x: p.x2 + nx, y: p.y2 + ny },
    { x: p.x2 - nx, y: p.y2 - ny },
    { x: p.x1 - nx, y: p.y1 - ny },
  ]
}

// ───────────────────────────────────────────────────────────────────────────
// Os shaders
// ───────────────────────────────────────────────────────────────────────────

/** Quadrilátero do tamanho do alvo (px do alvo); `vUv` vai de 0 a 1 com (0, 0) no canto de cima. */
const VERTICE_DO_ALVO = `#version 300 es
precision highp float;
in vec2 aPosition;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
uniform vec2 uTamanho;
out vec2 vUv;
void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition * uTamanho, 1.0)).xy, 0.0, 1.0);
  vUv = aPosition;
}
`

/** Um passo do borrão gaussiano separável (horizontal ou vertical), de desvio `uSigma` texels. */
const BORRAO = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uFonte;
uniform vec2 uPasso;
uniform float uSigma;
out vec4 finalColor;
void main() {
  vec4 soma = texture(uFonte, vUv);
  float peso = 1.0;
  if (uSigma > 0.01) {
    float raio = min(ceil(uSigma * 3.0), ${RAIO_MAXIMO_DO_BORRAO}.0);
    float dois = 2.0 * uSigma * uSigma;
    for (int i = 1; i <= ${RAIO_MAXIMO_DO_BORRAO}; i++) {
      float d = float(i);
      if (d > raio) break;
      float w = exp(-d * d / dois);
      soma += (texture(uFonte, vUv + uPasso * d) + texture(uFonte, vUv - uPasso * d)) * w;
      peso += 2.0 * w;
    }
  }
  finalColor = soma / peso;
}
`

/** Quadrilátero em px de mundo (`uDesenho`: x, y, largura, altura); `vPos` é o ponto de mundo. */
const VERTICE_DO_MUNDO = `#version 300 es
precision highp float;
in vec2 aPosition;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
uniform vec4 uDesenho;
out vec2 vPos;
void main() {
  vec2 p = uDesenho.xy + aPosition * uDesenho.zw;
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(p, 1.0)).xy, 0.0, 1.0);
  vPos = p;
}
`

/**
 * O FATOR do escuro. `uModo` 1 = por dentro do visto, 0 = lembrado.
 * `uRegua`: xy = a rampa; z = a mistura da troca do passo (1 = sem troca).
 * `uCampo` e `uCaixaAntes`: x, y, 1 / largura, 1 / altura (px de mundo) da
 * textura dos campos e da foto do escuro de antes.
 *
 * QUEDA DO ALCANCE (peça D): `uOlhos[i]` = x, y, raio e largura da queda (px
 * de mundo) dos `uNOlhos` primeiros olhos. Por dentro do visto, `v` cai para
 * zero na faixa final do raio de cada olho (`q` é o maior entre os olhos), a
 * não ser onde o canal B (luz, fresta, vislumbre) cobre:
 * `v * max(q, luz)`. Só escurece (multiplica por no máximo 1); sem olhos, `v`
 * fica o de antes.
 */
const FATOR = `#version 300 es
precision highp float;
in vec2 vPos;
uniform vec4 uColor;
uniform sampler2D uCampos;
uniform sampler2D uAntes;
uniform vec4 uCampo;
uniform vec4 uCaixaAntes;
uniform vec3 uTinta;
uniform vec4 uRegua;
uniform float uModo;
uniform vec4 uOlhos[${OLHOS_NA_QUEDA}];
uniform float uNOlhos;
out vec4 finalColor;
void main() {
  vec4 c = texture(uCampos, (vPos - uCampo.xy) * uCampo.zw);
  float k = smoothstep(uRegua.x, uRegua.y, c.g);
  vec3 f = uTinta * k;
  if (uModo > 0.5) {
    float v = smoothstep(uRegua.x, uRegua.y, c.r);
    if (uNOlhos > 0.5) {
      float q = 0.0;
      for (int i = 0; i < ${OLHOS_NA_QUEDA}; i++) {
        if (float(i) >= uNOlhos) break;
        vec4 o = uOlhos[i];
        q = max(q, 1.0 - smoothstep(o.z - o.w, o.z, distance(vPos, o.xy)));
      }
      float luz = smoothstep(${AJUSTE_DA_PENUMBRA.rampaDaLuz[0].toFixed(3)}, ${AJUSTE_DA_PENUMBRA.rampaDaLuz[1].toFixed(3)}, c.b);
      v *= max(q, luz);
    }
    f = (uTinta + (1.0 - uTinta) * v) * k;
  }
  if (uRegua.z < 1.0) {
    vec2 a = (vPos - uCaixaAntes.xy) * uCaixaAntes.zw;
    if (a.x >= 0.0 && a.y >= 0.0 && a.x <= 1.0 && a.y <= 1.0) f = mix(texture(uAntes, a).rgb, f, uRegua.z);
  }
  finalColor = vec4(f, 1.0) * uColor.a;
}
`

let programaDoBorrao: GlProgram | null = null
let programaDoFator: GlProgram | null = null
function programas(): { borrao: GlProgram; fator: GlProgram } {
  programaDoBorrao ??= new GlProgram({ vertex: VERTICE_DO_ALVO, fragment: BORRAO, name: 'penumbra-borrao' })
  programaDoFator ??= new GlProgram({ vertex: VERTICE_DO_MUNDO, fragment: FATOR, name: 'penumbra-fator' })
  return { borrao: programaDoBorrao, fator: programaDoFator }
}

const compilou = new WeakMap<object, boolean>()

/** Os shaders da penumbra compilam neste renderer (WebGL2)? Uma vez por renderer. Não = a névoa de hoje. */
export function penumbraCompila(renderer: Renderer): boolean {
  const sabido = compilou.get(renderer)
  if (sabido !== undefined) return sabido
  let erro: string | null = 'o renderer não é WebGL'
  if ('gl' in renderer) {
    const gl = renderer.gl
    if (gl.isContextLost()) erro = 'contexto perdido'
    else {
      const { borrao, fator } = programas()
      erro = erroNoContexto(gl, borrao) ?? erroNoContexto(gl, fator)
    }
  }
  const ok = erro === null
  compilou.set(renderer, ok)
  if (!ok) console.warn(`[penumbra] o shader não compilou nesta placa; a névoa fica a de antes (${erro})`)
  return ok
}

// ───────────────────────────────────────────────────────────────────────────
// Pixi: o borrão (também usado pela luz macia de `mapaDeLuz.ts`)
// ───────────────────────────────────────────────────────────────────────────

/** O pedaço do renderer que a penumbra usa (o `app.renderer`). */
export interface RenderizadorDaPenumbra {
  render(opcoes: { container: Container; target: RenderTexture; clear: boolean; clearColor: number; transform: Matrix }): void
}

export interface Borrao {
  /** `origem` → `temp` (horizontal) → `destino` (vertical); as três do mesmo tamanho. `sigma` em texels. */
  borrar(origem: RenderTexture, temp: RenderTexture, destino: RenderTexture, sigma: number): void
  destruir(): void
}

function quadrilatero(): Geometry {
  return new Geometry({
    attributes: { aPosition: { buffer: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), format: 'float32x2' } },
    indexBuffer: new Uint16Array([0, 1, 2, 0, 2, 3]),
  })
}

/** O borrão gaussiano em dois passos. Só chame com `penumbraCompila(renderer)` verdadeiro. */
export function criarBorrao(renderer: RenderizadorDaPenumbra): Borrao {
  const geometria = quadrilatero()
  const regua = new UniformGroup({
    uTamanho: { value: new Float32Array(2), type: 'vec2<f32>' },
    uPasso: { value: new Float32Array(2), type: 'vec2<f32>' },
    uSigma: { value: 0, type: 'f32' },
  })
  const vazia = RenderTexture.create({ width: 1, height: 1, resolution: 1 })
  const shader = new Shader({ glProgram: programas().borrao, resources: { uFonte: vazia.source, borrao: regua } })
  const malha = new Mesh<Geometry, Shader>({ geometry: geometria, shader })
  const palco = new Container()
  palco.addChild(malha)
  const identidade = new Matrix()

  function passo(origem: RenderTexture, destino: RenderTexture, dx: number, dy: number, sigma: number): void {
    const tamanho = regua.uniforms.uTamanho as Float32Array
    const salto = regua.uniforms.uPasso as Float32Array
    tamanho[0] = destino.width
    tamanho[1] = destino.height
    salto[0] = dx / Math.max(1, origem.width)
    salto[1] = dy / Math.max(1, origem.height)
    regua.uniforms.uSigma = sigma
    shader.resources.uFonte = origem.source
    renderer.render({ container: palco, target: destino, clear: true, clearColor: 0x000000, transform: identidade })
  }

  return {
    borrar(origem, temp, destino, sigma) {
      const s = Number.isFinite(sigma) && sigma > 0 ? sigma : 0
      passo(origem, temp, 1, 0, s)
      passo(temp, destino, 0, 1, s)
    },
    destruir() {
      palco.destroy({ children: true })
      geometria.destroy()
      shader.destroy()
      vazia.destroy(true)
    },
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Pixi: o mapa de penumbra
// ───────────────────────────────────────────────────────────────────────────

/** O que muda os campos. Referências: lista nova = campos refeitos. */
export interface CamposDaPenumbra {
  mapaId: string
  grid: number
  /** Tamanho do mapa em px de mundo: fora dele a penumbra não desenha (o fundo de fora fica como está). */
  largura: number
  altura: number
  /** Muda sempre que as máscaras da névoa são refeitas (visão, memória ou corpo das paredes): a geometria já está nelas. */
  revisao: number
  /** As paredes do pacote que barram a vista. */
  paredes: readonly ParedeDaPenumbra[]
  /** Há visão agora? Sem ela, o lembrado cobre tudo (como o `fogDim` sem máscara). */
  temVisao: boolean
  /** QUEDA DO ALCANCE (`separarOlhares`): os olhos que caem e os anéis que seguram a queda (canal B). Vazios = sem queda. */
  olhos: readonly OlhoDaPenumbra[]
  luzes: readonly RegionPoint[][]
}

export interface MedidasDaPenumbra {
  /** Quantas vezes os campos foram redesenhados (passo, memória, câmera fora da caixa). */
  refeitos: number
  /** Quantas fotos do escuro de antes (uma por troca de passo). */
  trocas: number
  /** Tempo de CPU do último refazer (foto + campos), em ms. */
  ultimoMs: number
  maiorMs: number
}

export interface MapaDePenumbra {
  readonly medidas: MedidasDaPenumbra
  /** O brilho do lembrado (painel do jogador): só troca um número. */
  definirBrilho(brilho: number): void
  /**
   * ANTES de as máscaras da névoa mudarem (`redrawFog`): fotografa o escuro de
   * agora para a troca do passo. Não fotografa na primeira vez, noutra cena,
   * noutra grade nem com "menos movimento".
   */
  guardarAntes(mapaId: string, grid: number): void
  /** DEPOIS de as máscaras mudarem: refaz os campos (se mudaram) e começa a troca guardada. */
  atualizar(campos: CamposDaPenumbra): void
  /**
   * Todo quadro: segue a câmera (refaz os campos se ela saiu da caixa) e anda a
   * troca. Verdadeiro = o escuro mudou neste quadro só por número de shader (a
   * troca andou ou acabou), que o Pixi não vê: a tela tem de desenhar.
   */
  quadro(agora: number): boolean
  destruir(): void
}

export interface OpcoesDaPenumbra {
  renderizador: RenderizadorDaPenumbra
  /** A faixa `penumbra` do mundo (`lib/camadas/ordem.ts`): os quadriláteros e as máscaras moram nela. */
  camada: Container
  /** O contexto de `visionMask` (visão + corpo das paredes) e o de `knownMask` (visão + memória). */
  visao: GraphicsContext
  conhecido: GraphicsContext
  vista: () => VistaDaPenumbra
  menosMovimento: () => boolean
}

function novaTextura(largura: number, altura: number): RenderTexture {
  return RenderTexture.create({ width: Math.max(1, largura), height: Math.max(1, altura), resolution: 1, dynamic: true, scaleMode: 'linear' })
}

function chaveDaVista(v: VistaDaPenumbra): string {
  return `${v.x}|${v.y}|${v.escala}|${v.largura}|${v.altura}|${v.resolucao}`
}

/** O mapa de penumbra. Só chame com `penumbraCompila(renderer)` verdadeiro (e fora do modo leve). */
export function criarMapaDePenumbra(opcoes: OpcoesDaPenumbra): MapaDePenumbra {
  const { renderizador, camada } = opcoes
  const borrao = criarBorrao(renderizador)
  const medidas: MedidasDaPenumbra = { refeitos: 0, trocas: 0, ultimoMs: 0, maiorMs: 0 }

  // Os campos: R = vejo agora, G = conheço, B = luz que segura a queda do alcance. Somados em `add` sobre o preto.
  const campos = novaTextura(1, 1)
  const camposTemp = novaTextura(1, 1)
  const borrado = novaTextura(1, 1)
  const contextoDasParedes = new GraphicsContext()
  const contextoDasLuzes = new GraphicsContext()
  const palcoDosCampos = new Container()
  const campo = (contexto: GraphicsContext, cor: number): Graphics => {
    const g = new Graphics(contexto)
    g.tint = cor
    g.blendMode = 'add'
    return g
  }
  palcoDosCampos.addChild(
    campo(opcoes.visao, 0xff0000),
    campo(contextoDasParedes, 0xff0000),
    campo(opcoes.conhecido, 0x00ff00),
    campo(contextoDasParedes, 0x00ff00),
    campo(contextoDasLuzes, 0x0000ff),
  )

  // A foto do escuro de antes (px físicos da tela) e a de troca.
  let antes = novaTextura(1, 1)
  let antesTemp = novaTextura(1, 1)

  const regua = new UniformGroup({
    uDesenho: { value: new Float32Array(4), type: 'vec4<f32>' },
    uCampo: { value: new Float32Array([0, 0, 1, 1]), type: 'vec4<f32>' },
    uCaixaAntes: { value: new Float32Array([0, 0, 1, 1]), type: 'vec4<f32>' },
    uTinta: { value: new Float32Array(tintaDoLembrado(0.45)), type: 'vec3<f32>' },
    uRegua: { value: new Float32Array([AJUSTE_DA_PENUMBRA.rampa[0], AJUSTE_DA_PENUMBRA.rampa[1], 1, 0]), type: 'vec4<f32>' },
    uOlhos: { value: new Float32Array(4 * OLHOS_NA_QUEDA), type: 'vec4<f32>', size: OLHOS_NA_QUEDA },
    uNOlhos: { value: 0, type: 'f32' },
  })
  const geometria = quadrilatero()
  const shaderDoModo = (modo: number): Shader =>
    new Shader({
      glProgram: programas().fator,
      resources: { uCampos: borrado.source, uAntes: antes.source, penumbra: regua, modo: new UniformGroup({ uModo: { value: modo, type: 'f32' } }) },
    })
  const shaderDentro = shaderDoModo(1)
  const shaderFora = shaderDoModo(0)

  /** Um par (máscara, quadrilátero): por dentro do visto (máscara direta) ou no lembrado (inversa). */
  const par = (shader: Shader, blend: 'multiply' | 'normal') => {
    const mascara = new Graphics(opcoes.visao)
    mascara.eventMode = 'none'
    const malha = new Mesh<Geometry, Shader>({ geometry: geometria, shader })
    malha.blendMode = blend
    malha.eventMode = 'none'
    return { mascara, malha }
  }
  // No mundo, em multiply. As máscaras ficam presas desde já (uma máscara solta
  // seria desenhada como forma branca); sem visão, a inversa vazia não recorta nada.
  const dentro = par(shaderDentro, 'multiply')
  const fora = par(shaderFora, 'multiply')
  dentro.malha.setMask({ mask: dentro.mascara })
  fora.malha.setMask({ mask: fora.mascara, inverse: true })
  camada.addChild(dentro.mascara, dentro.malha, fora.mascara, fora.malha)
  // Na foto do escuro (fora do mundo), o mesmo fator escrito por cima do branco, e o nunca visto em preto.
  const palcoDaFoto = new Container()
  const dentroFoto = par(shaderDentro, 'normal')
  const foraFoto = par(shaderFora, 'normal')
  dentroFoto.malha.setMask({ mask: dentroFoto.mascara })
  foraFoto.malha.setMask({ mask: foraFoto.mascara, inverse: true })
  const mascaraDoConhecido = new Graphics(opcoes.conhecido)
  const tampa = new Graphics()
  tampa.setMask({ mask: mascaraDoConhecido, inverse: true })
  palcoDaFoto.addChild(dentroFoto.mascara, dentroFoto.malha, foraFoto.mascara, foraFoto.malha, mascaraDoConhecido, tampa)

  const transformacao = new Matrix()
  let caixa: CaixaDosCampos | null = null
  let ultimos: CamposDaPenumbra | null = null
  let paredesDesenhadas: { paredes: readonly ParedeDaPenumbra[]; grid: number } | null = null
  let luzesDesenhadas: readonly RegionPoint[][] | null = null
  let temVisao = false
  let aquecido = false
  /** A troca do passo: 1 = parada. */
  let misturaAtual = 1
  let inicioDaTroca = 0
  let vistaDaTroca: string | null = null
  let trocaGuardada = false
  let fotoMs = 0
  let ultimaVista: string | null = null

  function definirMistura(valor: number): void {
    misturaAtual = valor
    const v = regua.uniforms.uRegua as Float32Array
    v[2] = valor
  }

  function trocarAntes(): void {
    const velha = antes
    antes = antesTemp
    antesTemp = velha
    shaderDentro.resources.uAntes = antes.source
    shaderFora.resources.uAntes = antes.source
  }

  /** Sem visão, só o lembrado: o quadrilátero de dentro some e o de fora cobre tudo (máscara inversa vazia). */
  function aplicarVisao(): void {
    dentro.malha.visible = temVisao
    dentroFoto.malha.visible = temVisao
  }

  function redesenharParedes(paredes: readonly ParedeDaPenumbra[], grid: number): void {
    if (paredesDesenhadas !== null && paredesDesenhadas.paredes === paredes && paredesDesenhadas.grid === grid) return
    paredesDesenhadas = { paredes, grid }
    contextoDasParedes.clear()
    const extra = AJUSTE_DA_PENUMBRA.paredeBrancaEmDesvios * desvioDaPenumbra(grid)
    let algum = false
    for (const parede of paredes) {
      const traco = tracoBrancoDaParede(parede, Math.max(0, parede.espessura) + extra)
      if (traco === null) continue
      contextoDasParedes.poly(traco, true)
      algum = true
    }
    if (algum) contextoDasParedes.fill({ color: 0xffffff })
  }

  /** QUEDA DO ALCANCE: o canal B (as luzes) e os olhos no shader. */
  function aplicarOlhares(olhos: readonly OlhoDaPenumbra[], luzes: readonly RegionPoint[][], grid: number): void {
    if (luzesDesenhadas !== luzes) {
      luzesDesenhadas = luzes
      contextoDasLuzes.clear()
      for (const anel of luzes) contextoDasLuzes.poly(anel, true)
      if (luzes.length > 0) contextoDasLuzes.fill({ color: 0xffffff })
    }
    const dados = regua.uniforms.uOlhos as Float32Array // criado acima como Float32Array (4 por olho)
    dados.fill(0)
    const usados = olhos.slice(0, OLHOS_NA_QUEDA)
    usados.forEach((o, i) => {
      dados[4 * i] = o.x
      dados[4 * i + 1] = o.y
      dados[4 * i + 2] = o.raio
      dados[4 * i + 3] = larguraDaQueda(o.raio, grid)
    })
    regua.uniforms.uNOlhos = usados.length
  }

  /** Redesenha os dois campos na caixa da vista de agora e borra. */
  function refazerCampos(estado: CamposDaPenumbra, vista: VistaDaPenumbra): void {
    const nova = caixaDosCampos(vista, estado.grid)
    caixa = nova
    if (campos.width !== nova.texelsX || campos.height !== nova.texelsY) {
      campos.resize(nova.texelsX, nova.texelsY, 1)
      camposTemp.resize(nova.texelsX, nova.texelsY, 1)
      borrado.resize(nova.texelsX, nova.texelsY, 1)
    }
    const k = 1 / nova.texel
    transformacao.set(k, 0, 0, k, -nova.x * k, -nova.y * k)
    renderizador.render({ container: palcoDosCampos, target: campos, clear: true, clearColor: 0x000000, transform: transformacao })
    borrao.borrar(campos, camposTemp, borrado, desvioDaPenumbra(estado.grid) / nova.texel)
    const larguraDaCaixa = nova.texelsX * nova.texel
    const alturaDaCaixa = nova.texelsY * nova.texel
    const c = regua.uniforms.uCampo as Float32Array
    c[0] = nova.x
    c[1] = nova.y
    c[2] = 1 / larguraDaCaixa
    c[3] = 1 / alturaDaCaixa
    // Só dentro do mapa: o fundo de fora fica como está.
    const x0 = Math.max(0, nova.x)
    const y0 = Math.max(0, nova.y)
    const x1 = Math.min(estado.largura, nova.x + larguraDaCaixa)
    const y1 = Math.min(estado.altura, nova.y + alturaDaCaixa)
    const d = regua.uniforms.uDesenho as Float32Array
    d[0] = x0
    d[1] = y0
    d[2] = Math.max(0, x1 - x0)
    d[3] = Math.max(0, y1 - y0)
    medidas.refeitos += 1
  }

  function medir(inicio: number): void {
    medidas.ultimoMs = performance.now() - inicio + fotoMs
    medidas.maiorMs = Math.max(medidas.maiorMs, medidas.ultimoMs)
    fotoMs = 0
  }

  /** Fotografa o escuro como está agora (com a troca em curso, se houver) em `antesTemp` e troca com `antes`. */
  function fotografar(vista: VistaDaPenumbra, largura: number, altura: number): void {
    const r = vista.resolucao > 0 && Number.isFinite(vista.resolucao) ? vista.resolucao : 1
    const s = escalaValida(vista)
    const w = Math.max(1, Math.ceil(vista.largura * r))
    const h = Math.max(1, Math.ceil(vista.altura * r))
    if (antesTemp.width !== w || antesTemp.height !== h) antesTemp.resize(w, h, 1)
    tampa.clear().rect(0, 0, largura, altura).fill({ color: 0x000000 })
    transformacao.set(s * r, 0, 0, s * r, vista.x * r, vista.y * r)
    renderizador.render({ container: palcoDaFoto, target: antesTemp, clear: true, clearColor: 0xffffff, transform: transformacao })
    trocarAntes()
    const caixaAntes = regua.uniforms.uCaixaAntes as Float32Array
    caixaAntes[0] = -vista.x / s
    caixaAntes[1] = -vista.y / s
    caixaAntes[2] = (s * r) / w
    caixaAntes[3] = (s * r) / h
  }

  /** O primeiro uso de cada alvo (memória da placa, stencil) na montagem da cena, não no primeiro passo. */
  function aquecer(estado: CamposDaPenumbra, vista: VistaDaPenumbra): void {
    if (aquecido) return
    aquecido = true
    fotografar(vista, estado.largura, estado.altura)
    fotografar(vista, estado.largura, estado.altura)
  }

  return {
    medidas,
    definirBrilho(brilho) {
      const t = regua.uniforms.uTinta as Float32Array
      t.set(tintaDoLembrado(brilho))
    },
    guardarAntes(mapaId, grid) {
      trocaGuardada = false
      const estado = ultimos
      if (estado === null || caixa === null || estado.mapaId !== mapaId || estado.grid !== grid || opcoes.menosMovimento()) return
      const inicio = performance.now()
      fotografar(opcoes.vista(), estado.largura, estado.altura)
      fotoMs = performance.now() - inicio
      medidas.trocas += 1
      trocaGuardada = true
    },
    atualizar(estado) {
      const anterior = ultimos
      const mudou =
        anterior === null ||
        anterior.revisao !== estado.revisao ||
        anterior.paredes !== estado.paredes ||
        anterior.grid !== estado.grid ||
        anterior.mapaId !== estado.mapaId ||
        anterior.largura !== estado.largura ||
        anterior.altura !== estado.altura ||
        anterior.temVisao !== estado.temVisao ||
        anterior.olhos !== estado.olhos ||
        anterior.luzes !== estado.luzes
      ultimos = estado
      if (!mudou) return
      const inicio = performance.now()
      temVisao = estado.temVisao
      aplicarVisao()
      redesenharParedes(estado.paredes, estado.grid)
      aplicarOlhares(estado.olhos, estado.luzes, estado.grid)
      const vista = opcoes.vista()
      ultimaVista = chaveDaVista(vista)
      refazerCampos(estado, vista)
      if (trocaGuardada) {
        trocaGuardada = false
        inicioDaTroca = performance.now()
        vistaDaTroca = ultimaVista
        definirMistura(0)
      } else definirMistura(1)
      medir(inicio)
      aquecer(estado, vista)
    },
    quadro(agora) {
      const estado = ultimos
      if (estado === null || caixa === null) return false
      const vista = opcoes.vista()
      const chave = chaveDaVista(vista)
      if (chave !== ultimaVista) {
        ultimaVista = chave
        if (!vistaCabeNaCaixa(vista, caixa, estado.grid)) {
          const inicio = performance.now()
          refazerCampos(estado, vista)
          medir(inicio)
        }
      }
      if (misturaAtual >= 1) return false
      // A câmera andou no meio da troca: a foto de antes ficou fora do lugar, então a troca acaba já.
      if (chave !== vistaDaTroca) {
        definirMistura(1)
        return true
      }
      definirMistura(mistura(agora - inicioDaTroca))
      return true
    },
    destruir() {
      borrao.destruir()
      for (const no of [dentro.malha, dentro.mascara, fora.malha, fora.mascara]) {
        no.removeFromParent()
        no.destroy()
      }
      palcoDaFoto.destroy({ children: true })
      palcoDosCampos.destroy({ children: true })
      contextoDasParedes.destroy()
      contextoDasLuzes.destroy()
      shaderDentro.destroy()
      shaderFora.destroy()
      geometria.destroy()
      for (const t of [campos, camposTemp, borrado, antes, antesTemp]) t.destroy(true)
    },
  }
}
