import type * as Three from 'three'
import type { ThreeModule } from '../../transicoes/tipos'
import { semente } from '../../transicoes/texturas'
import { fogoEm, tremorEm, trilhaX } from './_roteiroDoPinheiral'

/*
 * O fogo da "Trilha do pinheiral: em chamas". Tudo calculado na GPU pelo tempo
 * da cena (nada de relógio interno): chamas em placas viradas para a câmera,
 * com a forma corroída por ruído que sobe; brasas que sobem e derivam com o
 * vento; fumaça escura iluminada por baixo; luzes de fogo que tremem e um
 * holofote que joga a luz trêmula na trilha à frente de quem anda e estica a
 * sombra do capim na direção dos olhos.
 */

export interface ArvoreDaMata {
  x: number
  z: number
  altura: number
  /** Metros para dentro da mata, a partir da primeira fileira. */
  profundidade: number
}

export interface FogoDoPinheiral {
  atualizar: (t: number) => void
  descartar: () => void
}

export const RUIDO = /* glsl */ `
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float ruido(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0; float a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * ruido(p); p = p * 2.02 + vec2(17.1, 9.3); a *= 0.5; }
  return s;
}
`

const CHAMA_VERTICE = /* glsl */ `
attribute vec3 aCentro;
attribute vec2 aTamanho;
attribute vec2 aSemente;
uniform float uTempo;
uniform float uFogo;
varying vec2 vUv;
varying float vSemente;
varying float vForca;
void main() {
  vUv = uv;
  float s = aSemente.x;
  vSemente = s;
  float lambida = 0.88 + 0.12 * sin(uTempo * (5.0 + s * 4.0) + s * 40.0);
  vForca = aSemente.y * uFogo * (0.78 + 0.22 * sin(uTempo * (8.0 + s * 6.0) + s * 13.0));
  vec3 direita = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 p = aCentro + direita * position.x * aTamanho.x + vec3(0.0, (position.y + 0.5) * aTamanho.y * lambida, 0.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`

const CHAMA_FRAGMENTO = /* glsl */ `
uniform float uTempo;
varying vec2 vUv;
varying float vSemente;
varying float vForca;
${RUIDO}
void main() {
  float t = uTempo * (1.3 + vSemente * 0.5);
  vec2 q = vec2(vUv.x * 2.4 + vSemente * 17.0, vUv.y * 1.7 - t * 1.9);
  float n = fbm(q);
  float n2 = fbm(q * 2.1 + vec2(3.1, -t * 0.9));
  float x = (vUv.x - 0.5) * 2.0;
  float y = vUv.y;
  float largura = mix(0.9, 0.12, pow(y, 0.85));
  float forma = 1.0 - abs(x + (n - 0.5) * 0.7 * y) / largura;
  float f = forma * 1.15 + (n2 - 0.5) * 0.85 - y * 0.75;
  f = clamp(f, 0.0, 1.0) * smoothstep(0.0, 0.16, y);
  vec3 c = mix(vec3(0.6, 0.07, 0.0), vec3(1.0, 0.42, 0.04), smoothstep(0.08, 0.42, f));
  c = mix(c, vec3(1.0, 0.86, 0.5), smoothstep(0.5, 0.88, f));
  float a = smoothstep(0.06, 0.38, f) * vForca;
  gl_FragColor = vec4(c, a);
}
`

const BRASA_VERTICE = /* glsl */ `
attribute vec3 aOrigem;
attribute vec4 aParam;
attribute vec2 aSubida;
uniform float uTempo;
varying float vVida;
varying float vBrilho;
varying vec2 vUv;
void main() {
  float vida = fract(uTempo * aParam.x / aSubida.x + aParam.y);
  vec3 p = aOrigem;
  p.y += vida * aSubida.x;
  p.x += sin(uTempo * 1.3 + aParam.y * 20.0) * aParam.z * vida + vida * vida * 3.0 * aSubida.y;
  p.z += vida * 2.0 * aSubida.y + cos(uTempo * 0.9 + aParam.y * 11.0) * aParam.z * 0.4;
  vVida = vida;
  vBrilho = 0.6 + 0.4 * sin(uTempo * 17.0 + aParam.y * 50.0);
  vUv = uv;
  vec3 direita = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 cima = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 q = p + (direita * position.x + cima * position.y) * aParam.w;
  gl_Position = projectionMatrix * viewMatrix * vec4(q, 1.0);
}
`

const BRASA_FRAGMENTO = /* glsl */ `
uniform float uFogo;
varying float vVida;
varying float vBrilho;
varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float a = pow(clamp(1.0 - r, 0.0, 1.0), 1.6);
  float vida = (1.0 - vVida) * smoothstep(0.0, 0.06, vVida);
  vec3 c = mix(vec3(1.0, 0.3, 0.04), vec3(1.0, 0.85, 0.45), (1.0 - vVida) * vBrilho);
  gl_FragColor = vec4(c, a * vida * vBrilho * uFogo);
}
`

const FUMACA_VERTICE = /* glsl */ `
attribute vec3 aCentro;
attribute vec3 aParam;
uniform float uTempo;
uniform float uSubida;
varying vec2 vUv;
varying float vVida;
varying float vSemente;
void main() {
  float vida = fract(uTempo * aParam.y / uSubida + aParam.z);
  float tam = aParam.x * (0.6 + 0.8 * vida);
  vec3 c = aCentro + vec3(vida * 4.0, vida * uSubida, vida * 1.5);
  vec3 direita = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 cima = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 p = c + (direita * position.x + cima * position.y) * tam;
  vUv = uv;
  vVida = vida;
  vSemente = aParam.z;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`

const FUMACA_FRAGMENTO = /* glsl */ `
uniform float uTempo;
uniform float uFogo;
uniform vec3 uBrasa;
varying vec2 vUv;
varying float vVida;
varying float vSemente;
${RUIDO}
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float n = fbm(vUv * 3.0 + vec2(vSemente * 31.0, -uTempo * 0.15));
  float blob = smoothstep(1.0, 0.2, r + (n - 0.5) * 0.7);
  float vida = smoothstep(0.0, 0.2, vVida) * (1.0 - smoothstep(0.6, 1.0, vVida));
  float baixo = (1.0 - vVida) * (1.0 - vUv.y);
  vec3 c = mix(vec3(0.05, 0.035, 0.03), uBrasa * 0.55, baixo * uFogo);
  gl_FragColor = vec4(c, blob * vida * 0.55);
}
`

/** Placas instanciadas (um quadrado 1×1) com atributos por instância. */
function placas(THREE: ThreeModule, quantas: number, atributos: Record<string, [Float32Array, number]>): Three.InstancedBufferGeometry {
  const base = new THREE.PlaneGeometry(1, 1)
  const geo = new THREE.InstancedBufferGeometry()
  geo.index = base.index
  geo.setAttribute('position', base.getAttribute('position'))
  geo.setAttribute('uv', base.getAttribute('uv'))
  for (const [nome, [dados, tamanho]] of Object.entries(atributos)) geo.setAttribute(nome, new THREE.InstancedBufferAttribute(dados, tamanho))
  geo.instanceCount = quantas
  return geo
}

function texturaDeHalo(THREE: ThreeModule): Three.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const g = canvas.getContext('2d', { willReadFrequently: true })
  if (!g) throw new Error('canvas 2D indisponível')
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.35, 'rgba(255,255,255,0.45)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

interface Opcoes {
  arvores: ArvoreDaMata[]
  reduzir: boolean
  /** Um ponto da trilha à frente dos olhos: o holofote do fogo mira nele (a cena o move a cada quadro). */
  alvo: Three.Object3D
}

export function montarFogo(THREE: ThreeModule, scene: Three.Scene, { arvores, reduzir, alvo }: Opcoes): FogoDoPinheiral {
  const rnd = semente(20261028)
  const ritmo = reduzir ? 0.35 : 1

  // --- Chamas: nas copas das primeiras fileiras e no chão da borda -----------
  const chamas: number[][] = []
  for (const a of arvores) {
    const naFrente = a.profundidade < 7
    if (rnd() > (naFrente ? 0.72 : 0.22)) continue
    const quantas = naFrente ? 1 + Math.floor(rnd() * 3) : 1
    for (let i = 0; i < quantas; i++) {
      const largura = a.altura * (0.2 + rnd() * 0.14) * (naFrente ? 1 : 0.8)
      chamas.push([
        a.x + (rnd() - 0.5) * a.altura * 0.16,
        a.altura * (0.32 + rnd() * 0.56),
        a.z + 0.35 + rnd() * 0.4,
        largura,
        largura * (1.4 + rnd() * 0.7),
        rnd(),
        (0.6 + rnd() * 0.4) * (naFrente ? 1 : 0.8),
      ])
    }
  }
  for (let i = 0; i < 64; i++) {
    const x = -30 + rnd() * 60
    const z = -22 + (rnd() - 0.5) * 3
    if (Math.abs(x - trilhaX(z)) < 1.3) continue
    const largura = 0.8 + rnd() * 0.9
    chamas.push([x, 0, z + 0.4, largura, largura * (1.3 + rnd() * 0.8), rnd(), 0.65 + rnd() * 0.35])
  }
  const n = chamas.length
  const centro = new Float32Array(n * 3)
  const tamanho = new Float32Array(n * 2)
  const sementeDaChama = new Float32Array(n * 2)
  chamas.forEach((c, i) => {
    centro.set([c[0], c[1], c[2]], i * 3)
    tamanho.set([c[3], c[4]], i * 2)
    sementeDaChama.set([c[5], c[6]], i * 2)
  })
  const materialDaChama = new THREE.ShaderMaterial({
    uniforms: { uTempo: { value: 0 }, uFogo: { value: 1 } },
    vertexShader: CHAMA_VERTICE,
    fragmentShader: CHAMA_FRAGMENTO,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const malhaDasChamas = new THREE.Mesh(placas(THREE, n, { aCentro: [centro, 3], aTamanho: [tamanho, 2], aSemente: [sementeDaChama, 2] }), materialDaChama)
  malhaDasChamas.frustumCulled = false
  malhaDasChamas.renderOrder = 3
  scene.add(malhaDasChamas)

  // --- Halos de calor sobre as copas -----------------------------------------
  const texHalo = texturaDeHalo(THREE)
  const queimando = arvores.filter((a) => a.profundidade < 9)
  const halos = Array.from({ length: 26 }, (_, i) => {
    const a = queimando[Math.floor(rnd() * queimando.length)] ?? { x: 0, z: -24, altura: 10, profundidade: 0 }
    const material = new THREE.SpriteMaterial({ map: texHalo, color: 0xff7a2e, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
    const sprite = new THREE.Sprite(material)
    const escala = 7 + rnd() * 7
    sprite.scale.set(escala, escala, 1)
    sprite.position.set(a.x, a.altura * (0.55 + rnd() * 0.3), a.z + 1)
    sprite.renderOrder = 2
    scene.add(sprite)
    return { material, base: 0.1 + rnd() * 0.08, s: i * 1.7 }
  })

  // --- Brasas ------------------------------------------------------------------
  const BRASAS = reduzir ? 220 : 460
  const origem = new Float32Array(BRASAS * 3)
  const param = new Float32Array(BRASAS * 4)
  const subida = new Float32Array(BRASAS * 2)
  for (let i = 0; i < BRASAS; i++) {
    // As de perto nascem entre os olhos e a borda da mata e derivam na direção de quem anda.
    const perto = i % 6 === 0
    origem.set(perto ? [-6 + rnd() * 12, 0.4 + rnd() * 2.5, -21 + rnd() * 7] : [-28 + rnd() * 56, 2 + rnd() * 9, -30 + rnd() * 11], i * 3)
    param.set([(1.1 + rnd() * 1.8) * ritmo, rnd(), 0.4 + rnd() * 1.2, perto ? 0.05 + rnd() * 0.06 : 0.12 + rnd() * 0.16], i * 4)
    subida.set([perto ? 4 + rnd() * 4 : 12 + rnd() * 10, perto ? 0.6 : 1], i * 2)
  }
  const materialDasBrasas = new THREE.ShaderMaterial({
    uniforms: { uTempo: { value: 0 }, uFogo: { value: 1 } },
    vertexShader: BRASA_VERTICE,
    fragmentShader: BRASA_FRAGMENTO,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const malhaDasBrasas = new THREE.Mesh(placas(THREE, BRASAS, { aOrigem: [origem, 3], aParam: [param, 4], aSubida: [subida, 2] }), materialDasBrasas)
  malhaDasBrasas.frustumCulled = false
  malhaDasBrasas.renderOrder = 4
  scene.add(malhaDasBrasas)

  // --- Fumaça -------------------------------------------------------------------
  const FUMACAS = 22
  const centroDaFumaca = new Float32Array(FUMACAS * 3)
  const paramDaFumaca = new Float32Array(FUMACAS * 3)
  for (let i = 0; i < FUMACAS; i++) {
    centroDaFumaca.set([-30 + rnd() * 60, 8 + rnd() * 5, -26 - rnd() * 14], i * 3)
    paramDaFumaca.set([10 + rnd() * 9, (0.8 + rnd() * 0.6) * ritmo, rnd()], i * 3)
  }
  const brasa = new THREE.Color().setHex(0xff6a1e, THREE.LinearSRGBColorSpace)
  const materialDaFumaca = new THREE.ShaderMaterial({
    uniforms: { uTempo: { value: 0 }, uSubida: { value: 18 }, uFogo: { value: 1 }, uBrasa: { value: new THREE.Vector3(brasa.r, brasa.g, brasa.b) } },
    vertexShader: FUMACA_VERTICE,
    fragmentShader: FUMACA_FRAGMENTO,
    transparent: true,
    depthWrite: false,
  })
  const malhaDaFumaca = new THREE.Mesh(placas(THREE, FUMACAS, { aCentro: [centroDaFumaca, 3], aParam: [paramDaFumaca, 3] }), materialDaFumaca)
  malhaDaFumaca.frustumCulled = false
  malhaDaFumaca.renderOrder = 1
  scene.add(malhaDaFumaca)

  // --- Luzes do fogo (afinadas em unidades legadas, como as embutidas) ---------
  const luzes = [-15, -5, 4, 14].map((x, i) => {
    const luz = new THREE.PointLight(0xff6a24, 1.6, 0, 1)
    luz.position.set(x, 6.5, -20.5)
    scene.add(luz)
    return { luz, s: i * 2.3 }
  })
  const holofote = new THREE.SpotLight(0xff7a30, 5, 0, 0.5, 0.75, 1)
  holofote.position.set(trilhaX(-21), 4.6, -21)
  holofote.target = alvo
  holofote.castShadow = true
  holofote.shadow.mapSize.set(1024, 1024)
  holofote.shadow.camera.near = 2
  holofote.shadow.camera.far = 45
  holofote.shadow.bias = -0.0006
  holofote.shadow.radius = 3
  scene.add(holofote)
  // A base das luzes é lida no primeiro quadro: o motor converte as unidades legadas
  // depois de montar a cena, e reescrever a intensidade com o valor de antes desfaria isso.
  let bases: { luzes: number[]; holofote: number } | null = null

  return {
    atualizar(t: number) {
      const tempo = t * ritmo
      const fogo = fogoEm(t)
      materialDaChama.uniforms.uTempo.value = tempo
      materialDaChama.uniforms.uFogo.value = fogo
      materialDasBrasas.uniforms.uTempo.value = t
      materialDasBrasas.uniforms.uFogo.value = fogo
      materialDaFumaca.uniforms.uTempo.value = t
      materialDaFumaca.uniforms.uFogo.value = fogo
      for (const h of halos) h.material.opacity = h.base * fogo * tremorEm(t, h.s, reduzir)
      bases ??= { luzes: luzes.map((l) => l.luz.intensity), holofote: holofote.intensity }
      luzes.forEach((l, i) => (l.luz.intensity = (bases?.luzes[i] ?? 0) * fogo * tremorEm(t, l.s, reduzir)))
      holofote.intensity = bases.holofote * fogo * tremorEm(t, 5.1, reduzir)
    },
    descartar() {
      holofote.shadow.dispose()
      texHalo.dispose()
    },
  }
}
