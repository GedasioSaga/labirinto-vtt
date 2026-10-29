import { BufferImageSource, Geometry, GlProgram, Mesh, Shader, UniformGroup, type Renderer, type TextureSource } from 'pixi.js'
import type { MalhaDaParede } from '../texturas/desenhado/parede'
import type { Rgb } from '../texturas/ruido'
import { erroNoContexto, falhaDoTracoForcada, QUEBRA, type ImagemNaPlaca } from './malhaDoTraco'

/**
 * A PAREDE DESENHADA NA PLACA (plano de 29/10/2026, F4b; CONTRATO.md 11.15): os
 * dois shaders da parede, da janela e da grade, com os números de
 * `texturas/desenhado/parede.ts`.
 *
 * - O CONTORNO (passe 1): a faixa inteira de cada trecho na cor do valor 0,10
 *   da rampa da cor da parede, com a borda suave de 1 px da tela no lado e na
 *   ponta reta da cadeia aberta.
 * - O MIOLO (passe 2): a imagem do item (o valor em R, 0,5 = a cor do mestre)
 *   pelo `s` da projeção no trecho (preso na quina: a coluna da ponta esticada)
 *   e pelo `w` da inversa do quadrilátero do esquadro; o valor vira cor pela
 *   rampa (11.8, a família da pedra) e acende com o relevo (11.5).
 *
 * As rampas de todas as cores do nó vão num atlas de 256 x N (uma linha por
 * cor, lida no meio da linha: sem mistura entre cores). O shader é GPU nova:
 * `paredeCompila` testa os dois no contexto do renderer; não compilou, a
 * parede fica no Atual (regra de 29/10/2026). A falha forçada do traço
 * (`forcarFalhaDoTraco`) quebra estes também.
 */

function vertice(): string {
  return `#version 300 es
precision highp float;
in vec2 aPosition;
in vec4 aQuadA;
in vec4 aQuadB;
in vec4 aTrecho;
in vec4 aFaixa;
in vec4 aCorte;
in vec4 aModulo;
in vec4 aExtra;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
out vec2 vPos;
flat out vec4 vQuadA;
flat out vec4 vQuadB;
flat out vec4 vTrecho;
flat out vec4 vFaixa;
flat out vec4 vCorte;
flat out vec4 vModulo;
flat out vec4 vExtra;
void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vPos = aPosition;
  vQuadA = aQuadA;
  vQuadB = aQuadB;
  vTrecho = aTrecho;
  vFaixa = aFaixa;
  vCorte = aCorte;
  vModulo = aModulo;
  vExtra = aExtra;
}
`
}

/** A inversa do quadrilátero (a mesma de `malhaDoTraco.ts`), a rampa do atlas e o px da tela no mundo. */
const COMUM = `
in vec2 vPos;
flat in vec4 vQuadA;
flat in vec4 vQuadB;
flat in vec4 vTrecho;
flat in vec4 vFaixa;
flat in vec4 vCorte;
flat in vec4 vModulo;
flat in vec4 vExtra;
uniform vec4 uColor;
uniform sampler2D uRampa;
// linhas do atlas, o valor do contorno.
uniform vec2 uAtlas;
out vec4 finalColor;
float cruz(vec2 a, vec2 b) { return a.x * b.y - a.y * b.x; }
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
vec3 corDaRampa(float g) {
  float x = (clamp(g, 0.0, 1.0) * 255.0 + 0.5) / 256.0;
  float y = (vExtra.y + 0.5) / uAtlas.x;
  return texture(uRampa, vec2(x, y)).rgb;
}
float suave1(float x) { return clamp(x + 0.5, 0.0, 1.0); }
`

/** O passe 1: a faixa inteira no valor do contorno. */
const CONTORNO = `#version 300 es
precision highp float;
${COMUM}
void main() {
  vec2 dx = dFdx(vPos);
  vec2 dy = dFdy(vPos);
  float mpt = max(1e-6, sqrt(max(dot(dx, dx), dot(dy, dy))));
  vec3 uv = inversa(vPos);
  float w = vFaixa.y + (vFaixa.z - vFaixa.y) * uv.y;
  float s = vFaixa.x + dot(vPos - vTrecho.xy, vTrecho.zw);
  float a = suave1((vFaixa.w - abs(w)) / mpt);
  if (vCorte.w > 0.0) a *= suave1(s / mpt) * suave1((vCorte.w - s) / mpt);
  if (uv.z < 0.5 || a <= 1e-4) discard;
  vec3 c = corDaRampa(uAtlas.y);
  finalColor = vec4(c * a, a) * uColor.a;
}
`

/** O passe 2: o miolo pela imagem, tingido e aceso. */
const MIOLO = `#version 300 es
precision highp float;
// O nivel 0 do mipmap ate ~2,6 px da imagem por px da tela (a 100% a parede tem 2 a 2,6).
const float VIES = -1.4;
${COMUM}
uniform sampler2D uCor;
uniform sampler2D uRelevo;
// acimaPx, hPx (px do traco), largura e altura da imagem (px da imagem).
uniform vec4 uFace;
// luz da face, luz do relevo.
uniform vec2 uLuz;
const vec2 LUZ = vec2(-0.70710678, -0.70710678);
void main() {
  vec2 dx = dFdx(vPos);
  vec2 dy = dFdy(vPos);
  float mpt = max(1e-6, sqrt(max(dot(dx, dx), dot(dy, dy))));
  vec3 uv = inversa(vPos);
  float w = vFaixa.y + (vFaixa.z - vFaixa.y) * uv.y;
  float s = clamp(vFaixa.x + dot(vPos - vTrecho.xy, vTrecho.zw), vCorte.x, vCorte.y);
  float hi = vFaixa.w;
  float f = (w + hi) / (2.0 * hi);
  float comp = vModulo.w;
  float x = comp > 0.0 ? (s - vModulo.x) / max(1e-6, vModulo.y - vModulo.x) * comp : 0.0;
  if (vExtra.x < 0.0) x = comp - x;
  float xi = vModulo.z + 2.0 * x;
  float yi = 2.0 * (uFace.x + f * uFace.y);
  vec2 t = vec2(clamp(xi, 0.5, uFace.z - 0.5) / uFace.z, clamp(yi, 0.5, uFace.w - 0.5) / uFace.w);
  float deTraves = uFace.y / max(1e-6, hi);
  float aoLongo = comp > 0.0 ? 2.0 * comp / max(1e-6, vModulo.y - vModulo.x) : deTraves;
  float nivel = max(0.0, log2(max(1e-6, sqrt(aoLongo * deTraves) * mpt)) + VIES);
  vec4 c4 = textureLod(uCor, t, nivel);
  vec4 r4 = textureLod(uRelevo, t, nivel);
  if (uv.z < 0.5 || c4.a <= 1e-4) discard;
  vec3 c = corDaRampa(c4.r / c4.a);
  float rx = (2.0 * r4.r - 1.0) * vExtra.x;
  float ry = 2.0 * r4.g - 1.0;
  vec2 d = vTrecho.zw;
  vec2 nr = vec2(-d.y, d.x);
  vec2 n = rx * d + ry * nr;
  float l = uLuz.x * dot(nr, LUZ) + uLuz.y * dot(n, LUZ);
  if (l >= 0.0) {
    vec3 realce = c * 1.1 * 0.92 + vec3(0.98, 0.93, 0.7) * 0.08;
    c = c + (realce - c) * min(1.0, l);
  } else {
    c = c * (1.0 - 0.3 * min(1.0, -l));
  }
  float ponta = vCorte.w > 0.0 ? suave1((s - vCorte.z) / mpt) * suave1((vCorte.w - vCorte.z - s) / mpt) : 1.0;
  float a = c4.a * ponta;
  if (a <= 1e-4) discard;
  finalColor = vec4(c * a, a) * uColor.a;
}
`

interface Programas {
  readonly contorno: GlProgram
  readonly miolo: GlProgram
}

let programas: Programas | null = null
let quebrados: Programas | null = null

function criar(quebrar: boolean): Programas {
  const extra = quebrar ? QUEBRA : ''
  return {
    contorno: new GlProgram({ vertex: vertice(), fragment: CONTORNO + extra, name: 'parede-contorno' }),
    miolo: new GlProgram({ vertex: vertice(), fragment: MIOLO + extra, name: 'parede-miolo' }),
  }
}

function programasDaParede(): Programas {
  if (falhaDoTracoForcada()) {
    quebrados ??= criar(true)
    return quebrados
  }
  programas ??= criar(false)
  return programas
}

const compilou = new WeakMap<object, WeakMap<Programas, boolean>>()

/** Os dois shaders da parede compilam e ligam neste renderer? Uma vez por renderer e por jogo. */
export function paredeCompila(renderer: Renderer): boolean {
  const jogo = programasDaParede()
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
    erro = gl.isContextLost() ? 'contexto perdido' : (erroNoContexto(gl, jogo.contorno) ?? erroNoContexto(gl, jogo.miolo))
  }
  const ok = erro === null
  porJogo.set(jogo, ok)
  if (!ok) console.warn(`[desenhado] o shader da parede não compilou nesta placa; as paredes ficam no Atual (${erro})`)
  return ok
}

// ---------- o atlas das rampas ----------

/** As rampas (256 cores RGB 0..255 cada) numa textura de 256 x N, uma linha por cor. */
export function atlasDasRampas(rampas: readonly Float32Array[]): TextureSource {
  const linhas = Math.max(1, rampas.length)
  const px = new Uint8Array(256 * linhas * 4)
  rampas.forEach((r, y) => {
    for (let i = 0; i < 256; i += 1) {
      const o = (y * 256 + i) * 4
      px[o] = Math.round(r[i * 3])
      px[o + 1] = Math.round(r[i * 3 + 1])
      px[o + 2] = Math.round(r[i * 3 + 2])
      px[o + 3] = 255
    }
  })
  return new BufferImageSource({
    resource: px,
    width: 256,
    height: linhas,
    format: 'rgba8unorm',
    scaleMode: 'linear',
    addressMode: 'clamp-to-edge',
    autoGenerateMipmaps: false,
    alphaMode: 'no-premultiply-alpha',
  })
}

// ---------- os Mesh ----------

function geometriaDe(m: MalhaDaParede): Geometry {
  return new Geometry({
    attributes: {
      aPosition: { buffer: m.posicoes, format: 'float32x2' },
      aQuadA: { buffer: m.quadA, format: 'float32x4' },
      aQuadB: { buffer: m.quadB, format: 'float32x4' },
      aTrecho: { buffer: m.trecho, format: 'float32x4' },
      aFaixa: { buffer: m.faixa, format: 'float32x4' },
      aCorte: { buffer: m.corte, format: 'float32x4' },
      aModulo: { buffer: m.modulo, format: 'float32x4' },
      aExtra: { buffer: m.extra, format: 'float32x4' },
    },
    indexBuffer: m.indices,
  })
}

function meshDe(m: MalhaDaParede, shader: Shader): Mesh<Geometry, Shader> {
  const mesh = new Mesh<Geometry, Shader>({ geometry: geometriaDe(m), shader })
  mesh.eventMode = 'none'
  return mesh
}

export function meshDoContorno(m: MalhaDaParede, atlas: TextureSource, linhas: number, valor: number): Mesh<Geometry, Shader> {
  const shader = new Shader({
    glProgram: programasDaParede().contorno,
    resources: {
      uRampa: atlas,
      doContorno: new UniformGroup({ uAtlas: { value: new Float32Array([linhas, valor]), type: 'vec2<f32>' } }),
    },
  })
  return meshDe(m, shader)
}

export function meshDoMiolo(m: MalhaDaParede, img: ImagemNaPlaca, luz: { face: number; relevo: number }, atlas: TextureSource, linhas: number): Mesh<Geometry, Shader> {
  const shader = new Shader({
    glProgram: programasDaParede().miolo,
    resources: {
      uRampa: atlas,
      uCor: img.cor,
      uRelevo: img.relevo,
      doMiolo: new UniformGroup({
        uAtlas: { value: new Float32Array([linhas, 0]), type: 'vec2<f32>' },
        uFace: { value: new Float32Array([img.acimaPx, img.hPx, img.largura, img.altura]), type: 'vec4<f32>' },
        uLuz: { value: new Float32Array([luz.face, luz.relevo]), type: 'vec2<f32>' },
      }),
    },
  })
  return meshDe(m, shader)
}

/** A chave de uma cor no atlas. */
export function chaveDaCor(c: Rgb): string {
  return `${c[0]},${c[1]},${c[2]}`
}
