import { Geometry, GlProgram, ImageSource, Mesh, Shader, State, UniformGroup, type Renderer, type TextureSource } from 'pixi.js'
import type { MalhaDoTraco } from '../texturas/desenhado/traco'

/**
 * A MALHA DO TRAÇO NA PLACA (plano de 29/10/2026, F4; CONTRATO.md 11.3 a
 * 11.11): os três shaders do traço Desenhado (a face, a borda e a sombra) e o
 * `Mesh` do Pixi de cada um, com os números de `texturas/desenhado/traco.ts`.
 *
 * Cada pixel faz a conta da referência (`godot/desenhado/ferramentas/traco.ts`,
 * `varrerTrecho`): a inversa exata do quadrilátero do trecho dá (u, v); u vira
 * o comprimento s da linha e v a fração da altura; a face lê a cor e o relevo
 * e acende com a luz do app pela normal do trecho mais o relevo (11.5). A
 * malha é contínua (os pedaços vizinhos dividem os cantos): sem fresta na dobra.
 *
 * O shader é GPU nova: `tracoCompila` compila os três no contexto do próprio
 * renderer antes do primeiro quadro. Não compilou (placa antiga, WebGL 1):
 * quem desenha fica no Atual, nunca tela preta (regra de 29/10/2026).
 *
 * A imagem é lida com o mipmap um nível abaixo (`VIES`): a 100% ela tem 2 px
 * por px do mundo e sai do nível 0, como a referência; mais longe, os níveis
 * de baixo evitam a cintilação. O nível sai da conta (`nivelDoMip`), não da
 * derivada da coordenada. A folga de 4 px de cada módulo segura o mipmap.
 */

/** O vértice comum; a sombra põe a profundidade do nível (`uProfundidade`). */
function vertice(comProfundidade: boolean): string {
  return `#version 300 es
precision highp float;
${comProfundidade ? 'uniform float uProfundidade;' : 'const float uProfundidade = 0.0;'}
in vec2 aPosition;
in vec4 aQuadA;
in vec4 aQuadB;
in vec4 aAoLongo;
in vec4 aModulo;
in vec4 aQuadro;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
out vec2 vPos;
flat out vec4 vQuadA;
flat out vec4 vQuadB;
flat out vec4 vAoLongo;
flat out vec4 vModulo;
flat out vec4 vQuadro;
void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, uProfundidade, 1.0);
  vPos = aPosition;
  vQuadA = aQuadA;
  vQuadB = aQuadB;
  vAoLongo = aAoLongo;
  vModulo = aModulo;
  vQuadro = aQuadro;
}
`
}

/** A inversa do quadrilátero q0 + e*u + f*v + g*u*v (a do `varrerTrecho`, com a raiz estável). */
const INVERSA = `
in vec2 vPos;
flat in vec4 vQuadA;
flat in vec4 vQuadB;
flat in vec4 vAoLongo;
flat in vec4 vModulo;
flat in vec4 vQuadro;
uniform vec4 uColor;
out vec4 finalColor;
float cruz(vec2 a, vec2 b) { return a.x * b.y - a.y * b.x; }
// (u, v, achou): achou = 0 quando o ponto nao tem raiz no quadrilatero.
vec3 inversa(vec2 p) {
  vec2 e = vQuadA.zw;
  vec2 f = vQuadB.xy;
  vec2 g = vQuadB.zw;
  vec2 h = p - vQuadA.xy;
  float k2 = cruz(g, f);
  float k1 = cruz(e, f) + cruz(h, g);
  float k0 = cruz(h, e);
  float w = k1 * k1 - 4.0 * k0 * k2;
  if (w < 0.0) return vec3(0.0);
  float r = sqrt(w);
  float qq = -0.5 * (k1 + (k1 >= 0.0 ? r : -r));
  float vPerto = abs(qq) > 1e-20 ? k0 / qq : 0.0;
  float vLonge = abs(k2) > 1e-20 ? qq / k2 : vPerto;
  float v = (vPerto >= -0.01 && vPerto <= 1.01) ? vPerto : vLonge;
  v = clamp(v, 0.0, 1.0);
  vec2 ev = e + g * v;
  float l2 = dot(ev, ev);
  if (l2 < 1e-9) return vec3(0.0);
  float u = dot(h - f * v, ev) / l2;
  return vec3(clamp(u, 0.0, 1.0), v, 1.0);
}
// O nivel do mipmap pela conta, nao pela derivada da coordenada: ela salta na
// troca de modulo e fora do quadrilatero (o pixel vizinho do 2 x 2), e o salto
// puxava o nivel mais borrado numa linha de pixels. vPos e continuo em toda a
// malha. texelsPorMundo: px da imagem por px do mundo ao longo e de traves.
float nivelDoMip(float aoLongo, float deTraves) {
  vec2 dx = dFdx(vPos);
  vec2 dy = dFdy(vPos);
  float mundoPorTela = sqrt(max(dot(dx, dx), dot(dy, dy)));
  float texels = sqrt(max(1e-6, aoLongo * deTraves)) * mundoPorTela;
  return max(0.0, log2(max(1e-6, texels)) + VIES);
}
`

/** A face (11.3 a 11.5): o módulo pelo s, a imagem pela fração da altura, a luz pela normal e pelo relevo. */
const FACE = `#version 300 es
precision highp float;
const float VIES = -1.0;
${INVERSA}
uniform sampler2D uCor;
uniform sampler2D uRelevo;
// acimaPx, hPx (px do traco), largura e altura da imagem (px da imagem).
uniform vec4 uFace;
// luz da face, luz do relevo.
uniform vec2 uLuz;
const vec2 LUZ = vec2(-0.70710678, -0.70710678);
void main() {
  vec3 uv = inversa(vPos);
  float s = vAoLongo.x + (vAoLongo.y - vAoLongo.x) * uv.x;
  float fr = vAoLongo.z + (vAoLongo.w - vAoLongo.z) * uv.y;
  float comprimento = vModulo.w;
  float x = (s - vModulo.x) / max(1e-6, vModulo.y - vModulo.x) * comprimento;
  x = mix(x, comprimento - x, step(0.5, vQuadro.w));
  x = mix(x, comprimento - x, step(vQuadro.z, 0.0));
  float xi = vModulo.z + 2.0 * x;
  float yi = 2.0 * (uFace.x + fr * uFace.y);
  vec2 t = vec2(clamp(xi, 0.5, uFace.z - 0.5) / uFace.z, clamp(yi, 0.5, uFace.w - 0.5) / uFace.w);
  float taxaAoLongo = 2.0 * comprimento / max(1e-6, vModulo.y - vModulo.x) * abs(vAoLongo.y - vAoLongo.x) / max(1e-6, length(vQuadA.zw));
  float taxaDeTraves = 2.0 * abs(vAoLongo.w - vAoLongo.z) * uFace.y / max(1e-6, length(vQuadB.xy));
  float nivel = nivelDoMip(taxaAoLongo, taxaDeTraves);
  vec4 c4 = textureLod(uCor, t, nivel);
  vec4 r4 = textureLod(uRelevo, t, nivel);
  if (uv.z < 0.5 || c4.a <= 1e-4) discard;
  float rx = (2.0 * r4.r - 1.0) * vQuadro.z;
  float ry = 2.0 * r4.g - 1.0;
  vec2 baixo = vQuadro.xy;
  vec2 aoLongo = vec2(baixo.y, -baixo.x);
  vec2 n = rx * aoLongo + ry * baixo;
  float l = uLuz.x * dot(baixo, LUZ) + uLuz.y * dot(n, LUZ);
  vec3 c = c4.rgb / c4.a;
  if (l >= 0.0) {
    vec3 realce = c * 1.1 * 0.92 + vec3(0.98, 0.93, 0.7) * 0.08;
    c = c + (realce - c) * min(1.0, l);
  } else {
    c = c * (1.0 - 0.3 * min(1.0, -l));
  }
  finalColor = vec4(c * c4.a, c4.a) * uColor.a;
}
`

/** A borda (11.11): repetida no período, a linha do chão, o alfa caindo onde a beira afina. */
const BORDA = `#version 300 es
precision highp float;
const float VIES = -1.0;
${INVERSA}
uniform sampler2D uImagem;
// desvio e periodo (px do traco), y e altura da linha (px da imagem).
uniform vec4 uLinha;
// acima + abaixo (px do traco), -, largura e altura da imagem.
uniform vec4 uBorda;
void main() {
  vec3 uv = inversa(vPos);
  // vModulo: a espessura (px do mundo) no comeco e no fim, e a altura da face no mundo.
  float s = vAoLongo.x + (vAoLongo.y - vAoLongo.x) * uv.x;
  float tq = vModulo.x + (vModulo.y - vModulo.x) * uv.x;
  float a = clamp(tq / max(1e-6, vModulo.z) / 0.25, 0.0, 1.0);
  float some = a * a * (3.0 - 2.0 * a);
  float x = 2.0 * mod(s + uLinha.x, uLinha.y);
  float y = uLinha.z + 2.0 * uv.y * uBorda.x;
  vec2 t = vec2(clamp(x, 0.5, uBorda.z - 0.5) / uBorda.z, clamp(min(y, uLinha.z + uLinha.w - 0.5), 0.5, uBorda.w - 0.5) / uBorda.w);
  float nivel = nivelDoMip(2.0 * abs(vAoLongo.y - vAoLongo.x) / max(1e-6, length(vQuadA.zw)), 2.0 * uBorda.x / max(1e-6, length(vQuadB.xy)));
  vec4 c4 = textureLod(uImagem, t, nivel) * some;
  if (uv.z < 0.5 || c4.a <= 1e-4) discard;
  finalColor = c4 * uColor.a;
}
`

/**
 * A sombra do pé (11.9): a faixa de d0 a d1 (px do mundo da beira) com o
 * desfoque de 3 caixas da referência feito na conta (a soma de 3 uniformes),
 * sem passada de filtro nem textura do tamanho do mapa. d0 e d1 andam com u.
 */
const SOMBRA = `#version 300 es
precision highp float;
const float VIES = -1.0;
${INVERSA}
// a cor da sombra, o alfa.
uniform vec4 uSombra;
// a largura da caixa do desfoque, em px do mundo.
uniform float uCaixa;
// A chance de 3 caixas somadas passarem de x (centradas em 0).
float acumulada(float x) {
  float z = clamp(x / uCaixa + 1.5, 0.0, 3.0);
  if (z < 1.0) return z * z * z / 6.0;
  if (z < 2.0) return (-2.0 * z * z * z + 9.0 * z * z - 9.0 * z + 3.0) / 6.0;
  float w = 3.0 - z;
  return 1.0 - w * w * w / 6.0;
}
void main() {
  vec3 uv = inversa(vPos);
  // vAoLongo: d0 e d1 no comeco e no fim; vModulo.xy: a beira no comeco; vQuadro.xy: a normal do trecho.
  float d0 = mix(vAoLongo.x, vAoLongo.y, uv.x);
  float d1 = mix(vAoLongo.z, vAoLongo.w, uv.x);
  float d = dot(vPos - vModulo.xy, vQuadro.xy);
  float cobre = acumulada(d1 - d) - acumulada(d0 - d);
  float a = uSombra.a * cobre;
  if (uv.z < 0.5 || a <= 1e-4) discard;
  finalColor = vec4(uSombra.rgb * a, a) * uColor.a;
}
`

interface Programas {
  readonly face: GlProgram
  readonly borda: GlProgram
  readonly sombra: GlProgram
}

let programas: Programas | null = null
let programasQuebrados: Programas | null = null
let falhaForcada = false

/** Uma linha que nenhum compilador aceita: a prova de que a falha cai no Atual. */
const QUEBRA = '\n#error falha forcada do traco\n'

function criarProgramas(quebrar: boolean): Programas {
  const extra = quebrar ? QUEBRA : ''
  return {
    face: new GlProgram({ vertex: vertice(false), fragment: FACE + extra, name: 'traco-face' }),
    borda: new GlProgram({ vertex: vertice(false), fragment: BORDA + extra, name: 'traco-borda' }),
    sombra: new GlProgram({ vertex: vertice(true), fragment: SOMBRA + extra, name: 'traco-sombra' }),
  }
}

function programasDoTraco(): Programas {
  if (falhaForcada) {
    programasQuebrados ??= criarProgramas(true)
    return programasQuebrados
  }
  programas ??= criarProgramas(false)
  return programas
}

/**
 * Só para a prova da integração (CONTRATO, regra de 29/10/2026): com `true`, os
 * shaders do traço saem com uma linha que não compila. Quem desenha tem de cair
 * no Atual. Nenhuma tela do app chama isto.
 */
export function forcarFalhaDoTraco(sim: boolean): void {
  falhaForcada = sim
}

type Contexto = WebGLRenderingContext | WebGL2RenderingContext

/** `null` = compilou e ligou; senão, o motivo (o registro do compilador, para o aviso). */
function erroNoContexto(gl: Contexto, p: GlProgram): string | null {
  const { vertex, fragment } = p
  if (vertex === undefined || fragment === undefined) return 'sem fonte'
  const vs = gl.createShader(gl.VERTEX_SHADER)
  const fs = gl.createShader(gl.FRAGMENT_SHADER)
  const prog = gl.createProgram()
  try {
    if (vs === null || fs === null || prog === null) return 'o contexto não criou o shader'
    gl.shaderSource(vs, vertex)
    gl.compileShader(vs)
    if (gl.getShaderParameter(vs, gl.COMPILE_STATUS) !== true) return `vértice: ${gl.getShaderInfoLog(vs) ?? ''}`
    gl.shaderSource(fs, fragment)
    gl.compileShader(fs)
    if (gl.getShaderParameter(fs, gl.COMPILE_STATUS) !== true) return `pixel: ${gl.getShaderInfoLog(fs) ?? ''}`
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    return gl.getProgramParameter(prog, gl.LINK_STATUS) === true ? null : `ligar: ${gl.getProgramInfoLog(prog) ?? ''}`
  } finally {
    if (prog !== null) gl.deleteProgram(prog)
    if (vs !== null) gl.deleteShader(vs)
    if (fs !== null) gl.deleteShader(fs)
  }
}

/** O resultado por renderer e por jogo de programas (o forçado é outro jogo). */
const compilou = new WeakMap<object, WeakMap<Programas, boolean>>()

/**
 * Os três shaders do traço compilam e ligam neste renderer? Testa uma vez por
 * renderer, no contexto dele, com as fontes que o Pixi vai usar. Renderer sem
 * WebGL (WebGPU, Canvas) ou contexto perdido = não.
 */
export function tracoCompila(renderer: Renderer): boolean {
  const jogo = programasDoTraco()
  let porJogo = compilou.get(renderer)
  if (porJogo === undefined) {
    porJogo = new WeakMap()
    compilou.set(renderer, porJogo)
  }
  const sabido = porJogo.get(jogo)
  if (sabido !== undefined) return sabido
  let erro: string | null = 'o renderer não é WebGL'
  if ('gl' in renderer) {
    const gl = renderer.gl
    erro = gl.isContextLost() ? 'contexto perdido' : (erroNoContexto(gl, jogo.face) ?? erroNoContexto(gl, jogo.borda) ?? erroNoContexto(gl, jogo.sombra))
  }
  const ok = erro === null
  porJogo.set(jogo, ok)
  if (!ok) console.warn(`[desenhado] o shader do traço não compilou nesta placa; o barranco fica no Atual (${erro})`)
  return ok
}

// ---------- as texturas e os Mesh ----------

/** A textura de uma imagem do pacote: mipmap, linear, presa na borda. `relevo` = número, não cor (sem pré-multiplicar). */
export function texturaDoTraco(imagem: HTMLImageElement, relevo: boolean): ImageSource {
  return new ImageSource({
    resource: imagem,
    autoGenerateMipmaps: true,
    scaleMode: 'linear',
    mipmapFilter: 'linear',
    addressMode: 'clamp-to-edge',
    alphaMode: relevo ? 'no-premultiply-alpha' : 'premultiply-alpha-on-upload',
  })
}

function geometriaDe(m: MalhaDoTraco): Geometry {
  return new Geometry({
    attributes: {
      aPosition: { buffer: m.posicoes, format: 'float32x2' },
      aQuadA: { buffer: m.quadA, format: 'float32x4' },
      aQuadB: { buffer: m.quadB, format: 'float32x4' },
      aAoLongo: { buffer: m.aoLongo, format: 'float32x4' },
      aModulo: { buffer: m.modulo, format: 'float32x4' },
      aQuadro: { buffer: m.quadro, format: 'float32x4' },
    },
    indexBuffer: m.indices,
  })
}

function meshDe(m: MalhaDoTraco, shader: Shader): Mesh<Geometry, Shader> {
  const mesh = new Mesh<Geometry, Shader>({ geometry: geometriaDe(m), shader })
  mesh.eventMode = 'none'
  return mesh
}

/** Uma imagem da face (uma altura): a cor, o relevo e as medidas dela. */
export interface ImagemNaPlaca {
  readonly cor: TextureSource
  readonly relevo: TextureSource
  readonly acimaPx: number
  readonly hPx: number
  readonly largura: number
  readonly altura: number
}

export function meshDaFace(m: MalhaDoTraco, img: ImagemNaPlaca, luz: { face: number; relevo: number }): Mesh<Geometry, Shader> {
  const shader = new Shader({
    glProgram: programasDoTraco().face,
    resources: {
      uCor: img.cor,
      uRelevo: img.relevo,
      daFace: new UniformGroup({
        uFace: { value: new Float32Array([img.acimaPx, img.hPx, img.largura, img.altura]), type: 'vec4<f32>' },
        uLuz: { value: new Float32Array([luz.face, luz.relevo]), type: 'vec2<f32>' },
      }),
    },
  })
  return meshDe(m, shader)
}

/** Uma linha da borda na placa. O desvio de cada beira já vem somado ao s da malha. */
export interface LinhaNaPlaca {
  readonly imagem: TextureSource
  readonly periodoPx: number
  readonly yPx: number
  readonly linhaPx: number
  /** acima + abaixo, px do traço. */
  readonly alturaPx: number
  readonly largura: number
  readonly altura: number
}

export function meshDaBorda(m: MalhaDoTraco, l: LinhaNaPlaca): Mesh<Geometry, Shader> {
  const shader = new Shader({
    glProgram: programasDoTraco().borda,
    resources: {
      uImagem: l.imagem,
      daBorda: new UniformGroup({
        uLinha: { value: new Float32Array([0, l.periodoPx, l.yPx, l.linhaPx]), type: 'vec4<f32>' },
        uBorda: { value: new Float32Array([l.alturaPx, 0, l.largura, l.altura]), type: 'vec4<f32>' },
      }),
    },
  })
  return meshDe(m, shader)
}

/**
 * A sombra de um nível. A referência pinta a UNIÃO dos quadriláteros e só
 * depois desfoca; aqui cada pedaço desfoca o seu, e onde eles se sobrepõem (a
 * curva fechada do lado baixo, onde a sombra passa do raio) o alfa somava em
 * riscos escuros. O teste de profundidade pinta cada pixel uma vez só por
 * nível: o miolo cheio vai primeiro (`ordem` 0), as bordas macias depois
 * (`ordem` 1) e não passam por cima dele. `nivel` sobe a cada nível desenhado
 * (0 a 3): o de cima tem profundidade menor e passa por cima do de baixo.
 * Sem buffer de profundidade (textura intermediária), o teste deixa passar
 * tudo: volta a soma, nunca some a sombra.
 */
export function meshDaSombra(m: MalhaDoTraco, cor: readonly [number, number, number], alfa: number, caixaPx: number, nivel: number): Mesh<Geometry, Shader> {
  const shader = new Shader({
    glProgram: programasDoTraco().sombra,
    resources: {
      daSombra: new UniformGroup({
        uSombra: { value: new Float32Array([cor[0], cor[1], cor[2], alfa]), type: 'vec4<f32>' },
        uCaixa: { value: caixaPx, type: 'f32' },
        uProfundidade: { value: 0.8 - 0.2 * Math.min(3, Math.max(0, nivel)), type: 'f32' },
      }),
    },
  })
  const mesh = meshDe(m, shader)
  const estado = State.for2d()
  estado.depthTest = true
  estado.depthMask = true
  mesh.state = estado
  return mesh
}

/** Solta o Mesh, a geometria e o shader dele (as texturas são de quem as criou). */
export function soltarMesh(mesh: Mesh<Geometry, Shader>): void {
  const { geometry, shader } = mesh
  mesh.destroy()
  geometry.destroy()
  shader?.destroy()
}
