import type * as Three from 'three'
import type { CenaTransicao, CriarCena, KitDeSom, OpcoesDaCena, ThreeModule } from '../../transicoes/tipos'
import { descartarCena, semente } from '../../transicoes/texturas'
import { type ArvoreDaMata, type FogoDoPinheiral, montarFogo, RUIDO } from './_fogoDoPinheiral'
import {
  andadoEm,
  avancoEm,
  BORDA_DA_MATA,
  fadeEm,
  faseEm,
  fogoEm,
  inclinacaoDaTrilha,
  rajadaEm,
  tremorEm,
  trilhaX,
  type VarianteDaTrilha,
} from './_roteiroDoPinheiral'
import { somDaTrilha } from './_somDoPinheiral'

/*
 * TRILHA DO PINHEIRAL (pacote de animações, transição de viagem). Pedido de
 * 27/10/2026, com duas variações da mesma caminhada:
 *
 * - 'dia': fim de tarde frio de tempo fechado. Uma pessoa de capa e mochila
 *   anda de costas para a câmera por uma trilha de terra; à frente, um
 *   pinheiral escuro e denso, com neblina na borda, cresce até tomar o quadro.
 * - 'chamas': a mesma caminhada, a mesma câmera, à noite, com o pinheiral em
 *   chamas: fogo nas copas, brasas subindo, fumaça e a luz laranja tremendo na
 *   trilha e na pessoa, que vira silhueta e estica a sombra para a câmera.
 *
 * Tudo pintado em canvas ou calculado em shader na criação (o pacote não
 * aceita imagem). Roteiro em `_roteiroDoPinheiral.ts`, fogo em
 * `_fogoDoPinheiral.ts`, som em `_somDoPinheiral.ts`.
 */

interface Paleta {
  ceuZenite: number
  ceuHorizonte: number
  ceuFaixa: number
  ceuNuvem: number
  serraLonge: string
  serraPerto: string
  pontaDoPinheiro: number
  miolo: number
  tronco: number
  /** Multiplica a cor da mata inteira (carvão, à noite). */
  escurecerMata: number
  neblina: number
  neblinaOpacidade: number
  ceuLuz: number
  chaoLuz: number
  forcaHemisferio: number
  luzDirecional: number
  forcaDirecional: number
  direcaoDaLuz: readonly [number, number, number]
}

const DIA: Paleta = {
  ceuZenite: 0x56626d,
  ceuHorizonte: 0xa7aeb0,
  ceuFaixa: 0xc4b39c,
  ceuNuvem: 0x7b858b,
  serraLonge: '#8b949a',
  serraPerto: '#6b757b',
  pontaDoPinheiro: 0x2b3d2f,
  miolo: 0x0b140f,
  tronco: 0x2b2119,
  escurecerMata: 1,
  neblina: 0xaeb6ba,
  neblinaOpacidade: 0.45,
  ceuLuz: 0xa9adab,
  chaoLuz: 0x3b3729,
  forcaHemisferio: 3,
  luzDirecional: 0xd8cab4,
  forcaDirecional: 1.5,
  // Sol fraco atrás da mata, à esquerda: a face da mata virada para nós fica no escuro.
  direcaoDaLuz: [-0.45, 0.5, -1],
}

const CHAMAS: Paleta = {
  ceuZenite: 0x05060b,
  ceuHorizonte: 0x2a0d06,
  ceuFaixa: 0xff6a1e,
  ceuNuvem: 0x000000,
  serraLonge: '#1c0805',
  serraPerto: '#0c0403',
  pontaDoPinheiro: 0x1d241b,
  miolo: 0x07090a,
  tronco: 0x1a1410,
  escurecerMata: 0.3,
  neblina: 0x3a2217,
  neblinaOpacidade: 0.5,
  ceuLuz: 0x1b2034,
  chaoLuz: 0x2c1408,
  forcaHemisferio: 1,
  luzDirecional: 0x8193c0,
  forcaDirecional: 0.45,
  // Lua atrás da câmera, à direita: só um fio azul nas costas da pessoa.
  direcaoDaLuz: [0.6, 0.8, 0.9],
}

// ---------------------------------------------------------------------------
// Pintura (canvas)
// ---------------------------------------------------------------------------

/** O chão pintado cobre x de -20 a 20 e z de +10 a -50. */
const CHAO_LARGURA = 40
const CHAO_COMPRIMENTO = 60
const CHAO_Z_PERTO = 10
const PX_POR_M = 25.6

function tela(largura: number, altura: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  // Pintado na CPU: sem isso cada envio para o WebGL vira uma leitura de volta da GPU.
  const g = canvas.getContext('2d', { willReadFrequently: true })
  if (!g) throw new Error('canvas 2D indisponível')
  return [canvas, g]
}

function pintarChao(g: CanvasRenderingContext2D): void {
  const rnd = semente(771)
  const L = g.canvas.width
  const A = g.canvas.height
  const px = (x: number) => (x + CHAO_LARGURA / 2) * PX_POR_M
  const py = (z: number) => (z + CHAO_COMPRIMENTO - CHAO_Z_PERTO) * PX_POR_M
  g.fillStyle = '#4a4933'
  g.fillRect(0, 0, L, A)
  const urze = ['#3d402f', '#565237', '#4e492f', '#625b3e', '#343a2a', '#6a6247']
  g.globalAlpha = 0.22
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = urze[i % urze.length]
    g.beginPath()
    g.ellipse(rnd() * L, rnd() * A, 4 + rnd() * 22, 3 + rnd() * 14, rnd() * Math.PI, 0, Math.PI * 2)
    g.fill()
  }
  // Capim seco miúdo.
  g.lineWidth = 1
  g.globalAlpha = 0.45
  const capim = ['#7c7450', '#2f3324', '#5f6440']
  for (let i = 0; i < 7000; i++) {
    const x = rnd() * L
    const y = rnd() * A
    const c = 2 + rnd() * 7
    const a = (rnd() - 0.5) * 1.2 - Math.PI / 2
    g.strokeStyle = capim[i % 3]
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + Math.cos(a) * c, y + Math.sin(a) * c)
    g.stroke()
  }
  // A trilha: beira gasta, leito, sulcos das rodas e a lombada clara no meio.
  const pontos: [number, number][] = []
  for (let z = CHAO_Z_PERTO; z >= CHAO_Z_PERTO - CHAO_COMPRIMENTO; z -= 0.5) pontos.push([px(trilhaX(z)), py(z)])
  g.lineCap = 'round'
  g.lineJoin = 'round'
  const tracar = (desvio: number, largura: number, cor: string, alfa: number) => {
    g.globalAlpha = alfa
    g.strokeStyle = cor
    g.lineWidth = largura * PX_POR_M
    g.beginPath()
    pontos.forEach(([x, y], i) => (i === 0 ? g.moveTo(x + desvio * PX_POR_M, y) : g.lineTo(x + desvio * PX_POR_M, y)))
    g.stroke()
  }
  tracar(0, 2.5, '#5a5340', 0.55)
  tracar(0, 1.85, '#6f604b', 1)
  tracar(0, 1.5, '#7b6b54', 0.9)
  tracar(-0.4, 0.26, '#5a4c3b', 0.55)
  tracar(0.4, 0.26, '#5a4c3b', 0.55)
  tracar(0, 0.32, '#8e7d63', 0.35)
  // Grão e pedrinhas no leito.
  g.globalAlpha = 0.5
  for (let i = 0; i < 9000; i++) {
    const z = CHAO_Z_PERTO - rnd() * CHAO_COMPRIMENTO
    const x = trilhaX(z) + (rnd() - 0.5) * 1.8
    g.fillStyle = rnd() < 0.5 ? '#a39277' : '#4c4133'
    g.fillRect(px(x), py(z), 1 + rnd() * 1.6, 1 + rnd() * 1.6)
  }
  for (let i = 0; i < 420; i++) {
    const z = CHAO_Z_PERTO - rnd() * CHAO_COMPRIMENTO
    const x = px(trilhaX(z) + (rnd() - 0.5) * 1.7)
    const y = py(z)
    const r = 1.5 + rnd() * 2.5
    g.globalAlpha = 0.5
    g.fillStyle = '#3a3026'
    g.beginPath()
    g.ellipse(x + 0.8, y + 1, r, r * 0.7, 0, 0, Math.PI * 2)
    g.fill()
    g.globalAlpha = 0.85
    g.fillStyle = rnd() < 0.6 ? '#a69a86' : '#8a7d68'
    g.beginPath()
    g.ellipse(x, y, r, r * 0.7, 0, 0, Math.PI * 2)
    g.fill()
  }
  // Capim invadindo as beiradas.
  g.globalAlpha = 0.7
  g.lineWidth = 1.4
  const beira = ['#8a8057', '#5c6239', '#3b4028', '#6f6a45']
  for (let i = 0; i < 2200; i++) {
    const z = CHAO_Z_PERTO - rnd() * CHAO_COMPRIMENTO
    const lado = rnd() < 0.5 ? -1 : 1
    const x = px(trilhaX(z) + lado * (0.85 + (rnd() - 0.35) * 0.5))
    const y = py(z)
    const c = 3 + rnd() * 6
    const a = -Math.PI / 2 + lado * (0.2 + rnd() * 0.7)
    g.strokeStyle = beira[i % beira.length]
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x - Math.cos(a) * c * lado, y + Math.sin(a) * c)
    g.stroke()
  }
  g.globalAlpha = 1
}

/** Grão de 1 m que se repete por cima do chão (multiplica em torno de 1): nitidez de perto. */
function pintarDetalhe(g: CanvasRenderingContext2D): void {
  const rnd = semente(919)
  g.fillStyle = 'rgb(128,128,128)'
  g.fillRect(0, 0, 256, 256)
  g.globalAlpha = 0.35
  for (let i = 0; i < 5000; i++) {
    const v = Math.floor(80 + rnd() * 100)
    g.fillStyle = `rgb(${v},${v},${v})`
    g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 2.5, 1 + rnd() * 2.5)
  }
  g.globalAlpha = 1
}

function pintarTufo(g: CanvasRenderingContext2D): void {
  const rnd = semente(5150)
  g.lineCap = 'round'
  const cores = ['#8a8057', '#5c6239', '#3b4028', '#a2996b', '#6f6a45']
  for (let i = 0; i < 46; i++) {
    const x0 = 14 + rnd() * 100
    const h = 40 + rnd() * 82
    const curva = (rnd() - 0.5) * 50
    g.strokeStyle = cores[i % cores.length]
    g.lineWidth = 1.6 + rnd() * 1.8
    g.beginPath()
    g.moveTo(x0, 128)
    g.quadraticCurveTo(x0 + curva * 0.3, 128 - h * 0.6, x0 + curva, 128 - h)
    g.stroke()
  }
}

function pintarMancha(g: CanvasRenderingContext2D): void {
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255,255,255,0.9)')
  grad.addColorStop(0.5, 'rgba(255,255,255,0.35)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
}

/** Serras ao longe num cilindro de raio 400 com o centro na câmera; o perfil é dado em graus de elevação. */
function pintarSerra(g: CanvasRenderingContext2D, longe: string, perto: string): void {
  const rnd = semente(3030)
  const L = g.canvas.width
  const A = g.canvas.height
  const linha = (graus: number) => ((130 - 400 * Math.tan((graus * Math.PI) / 180)) / 260) * A
  const camada = (cor: string, perfil: (u: number) => number, dente: number) => {
    g.fillStyle = cor
    for (let x = 0; x < L; x += 2) {
      const topo = linha(perfil(x / L))
      g.fillRect(x, topo, 2, A - topo)
    }
    // Pinheirinhos no alto da serra.
    for (let x = 0; x < L; x += 3 + rnd() * 4) {
      const topo = linha(perfil(x / L))
      const h = dente * (0.5 + rnd())
      g.beginPath()
      g.moveTo(x - h * 0.28, topo + 1)
      g.lineTo(x, topo - h)
      g.lineTo(x + h * 0.28, topo + 1)
      g.fill()
    }
  }
  camada(longe, (u) => 8 + 2.6 * Math.sin(u * 9 + 1) + 1.4 * Math.sin(u * 23 + 0.5) + 0.6 * Math.sin(u * 61), 5)
  camada(perto, (u) => 4.6 + 1.8 * Math.sin(u * 14 + 2) + 0.9 * Math.sin(u * 37 + 1.1), 8)
}

/** Fundo da mata em chamas: brasa viva no chão, escurecendo até o alto das copas. */
function pintarBrasaNoFundo(g: CanvasRenderingContext2D): void {
  const grad = g.createLinearGradient(0, g.canvas.height, 0, 0)
  grad.addColorStop(0, '#ff7a26')
  grad.addColorStop(0.12, '#e0480e')
  grad.addColorStop(0.35, '#7a1c06')
  grad.addColorStop(0.7, '#240804')
  grad.addColorStop(1, '#0d0403')
  g.fillStyle = grad
  g.fillRect(0, 0, g.canvas.width, g.canvas.height)
}

// ---------------------------------------------------------------------------
// Céu
// ---------------------------------------------------------------------------

const CEU_VERTICE = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

// Saída direta em sRGB (sem conversão de cor), como o céu do Campo ensolarado.
const CEU_FRAGMENTO = /* glsl */ `
uniform vec3 uZenite;
uniform vec3 uHorizonte;
uniform vec3 uFaixa;
uniform vec3 uNuvem;
uniform float uTempo;
uniform float uChamas;
uniform float uBrilhoDoFogo;
varying vec3 vDir;
${RUIDO}
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  float hp = max(h, 0.0);
  vec3 c = mix(uHorizonte, uZenite, smoothstep(0.0, 0.6, hp));
  float az = atan(d.x, -d.z);
  if (uChamas < 0.5) {
    c = mix(c, uFaixa, exp(-hp * 10.0) * 0.5);
    vec2 p = d.xz / (hp + 0.16);
    float n = fbm(p * 1.1 + vec2(uTempo * 0.03, uTempo * 0.012));
    float cobertura = smoothstep(0.36, 0.7, n) * smoothstep(-0.02, 0.1, h);
    c = mix(c, uNuvem, cobertura * 0.65);
    c += (n - 0.47) * 0.05;
  } else {
    float brilho = exp(-hp * 3.5) * uBrilhoDoFogo;
    vec2 q = vec2(az * 3.0, h * 4.0 - uTempo * 0.22);
    float n = fbm(q + vec2(0.0, fbm(q * 0.7 + 3.0)));
    float fumaca = smoothstep(0.32, 0.8, n) * smoothstep(0.8, 0.05, h);
    c += uFaixa * brilho * (0.35 + 0.4 * n);
    vec3 corDaFumaca = mix(vec3(0.05, 0.03, 0.025), uFaixa * 0.42, brilho);
    c = mix(c, corDaFumaca, fumaca * 0.75);
    vec2 g = vec2(az * 70.0, h * 70.0);
    float estrela = step(0.9972, hash(floor(g))) * smoothstep(0.22, 0.5, h) * (1.0 - fumaca);
    c += vec3(estrela * 0.55);
  }
  gl_FragColor = vec4(c, 1.0);
}
`

// ---------------------------------------------------------------------------
// Peças
// ---------------------------------------------------------------------------

/** Cor dada em sRGB, guardada linear: o motor desliga o gerenciamento e a saída em sRGB devolve o tom exato. */
function corLinear(THREE: ThreeModule, hex: number): Three.Color {
  return new THREE.Color().setHex(hex, THREE.LinearSRGBColorSpace).convertSRGBToLinear()
}

/** Cor crua (sRGB) para os shaders que escrevem direto na tela. */
function corCrua(THREE: ThreeModule, hex: number): Three.Vector3 {
  const c = new THREE.Color().setHex(hex, THREE.LinearSRGBColorSpace)
  return new THREE.Vector3(c.r, c.g, c.b)
}

/**
 * Um pinheiro de altura 1 numa geometria só: tronco e seis saias cônicas com a
 * borda serrilhada (pontas de galho caídas) e giradas uma da outra. A cor vai
 * no vértice: ponta do galho clara, miolo escuro.
 */
function geometriaDoPinheiro(THREE: ThreeModule, ponta: Three.Color, miolo: Three.Color, tronco: Three.Color): Three.BufferGeometry {
  const rnd = semente(4417)
  const posicoes: number[] = []
  const normais: number[] = []
  const cores: number[] = []
  const anexar = (geo: Three.BufferGeometry, cor: (y01: number) => Three.Color) => {
    geo.computeVertexNormals()
    const solta = geo.index ? geo.toNonIndexed() : geo
    const p = solta.getAttribute('position')
    const n = solta.getAttribute('normal')
    let yMin = Infinity
    let yMax = -Infinity
    for (let i = 0; i < p.count; i++) {
      yMin = Math.min(yMin, p.getY(i))
      yMax = Math.max(yMax, p.getY(i))
    }
    for (let i = 0; i < p.count; i++) {
      posicoes.push(p.getX(i), p.getY(i), p.getZ(i))
      normais.push(n.getX(i), n.getY(i), n.getZ(i))
      const c = cor((p.getY(i) - yMin) / (yMax - yMin || 1))
      cores.push(c.r, c.g, c.b)
    }
    if (solta !== geo) solta.dispose()
    geo.dispose()
  }
  const caule = new THREE.CylinderGeometry(0.016, 0.034, 0.32, 6, 1, true)
  caule.translate(0, 0.16, 0)
  anexar(caule, () => tronco)
  const CAMADAS = 7
  const LADOS = 11
  const tmp = new THREE.Color()
  for (let i = 0; i < CAMADAS; i++) {
    const u = i / (CAMADAS - 1)
    const altura = 0.27 - u * 0.09
    const raio = 0.21 * (1 - u * 0.78) + 0.02
    const base = 0.13 + u * 0.68
    const cone = new THREE.ConeGeometry(raio, altura, LADOS, 1, true)
    const pos = cone.getAttribute('position')
    const fatores = Array.from({ length: LADOS }, (_, j) => (j % 2 === 0 ? 1.14 : 0.74) * (0.88 + rnd() * 0.24))
    const quedas = Array.from({ length: LADOS }, (_, j) => (j % 2 === 0 ? 0.05 + rnd() * 0.06 : rnd() * 0.02))
    for (let k = 0; k < pos.count; k++) {
      const y = pos.getY(k)
      if (y > -altura / 2 + 1e-4) continue // só o anel de baixo: as pontas dos galhos
      const x = pos.getX(k)
      const z = pos.getZ(k)
      const passo = (2 * Math.PI) / LADOS
      const j = (((Math.round(Math.atan2(x, z) / passo) % LADOS) + LADOS) % LADOS)
      pos.setXYZ(k, x * fatores[j], y - quedas[j] * altura, z * fatores[j])
    }
    cone.rotateY(rnd() * Math.PI)
    cone.translate(0, base + altura / 2, 0)
    anexar(cone, (y01) => tmp.copy(ponta).lerp(miolo, Math.pow(y01, 0.7)))
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(posicoes, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normais, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cores, 3))
  return geo
}

/** Dois quadrados cruzados, base no chão; normal para cima para o capim pegar a luz do céu. */
function geometriaDoTufo(THREE: ThreeModule): Three.BufferGeometry {
  const geo = new THREE.BufferGeometry()
  geo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0, 0, 0, -0.5, 0, 0, 0.5, 0, 1, 0.5, 0, 1, -0.5], 3),
  )
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(Array.from({ length: 8 }, () => [0, 1, 0]).flat(), 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1], 2))
  geo.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7])
  return geo
}

interface Andarilho {
  raiz: Three.Group
  /** Põe o corpo na fase do ciclo de passos (radianos). */
  posar: (fase: number) => void
}

/**
 * A pessoa: capa cor de ferrugem com capuz, mochila com o rolo de dormir,
 * túnica, calça e botas. Juntas em grupos (quadril, coxa, joelho, tornozelo,
 * ombro, cotovelo) para o ciclo de passos: perna que balança dobra o joelho,
 * o quadril sobe no apoio e desce no contato, os braços vão contra as pernas,
 * os ombros giram contra o quadril e a capa arrasta para trás a cada passo.
 */
function montarAndarilho(THREE: ThreeModule): Andarilho {
  const material = (hex: number, rugosidade = 0.9) => new THREE.MeshStandardMaterial({ color: corLinear(THREE, hex), roughness: rugosidade, metalness: 0 })
  const capa = material(0x8c3f24)
  capa.side = THREE.DoubleSide
  const tunica = material(0x3b3d2c)
  const calca = material(0x2b2722)
  const bota = material(0x1c1714, 0.8)
  const pele = material(0xb88a6a, 0.7)
  const couro = material(0x5a3d26, 0.75)
  const rolo = material(0x9c8a66)
  const peca = (geo: Three.BufferGeometry, mat: Three.Material, pai: Three.Object3D, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    m.castShadow = true
    pai.add(m)
    return m
  }
  const junta = (pai: Three.Object3D, x: number, y: number, z: number) => {
    const g = new THREE.Group()
    g.position.set(x, y, z)
    pai.add(g)
    return g
  }

  const raiz = new THREE.Group()
  const quadril = junta(raiz, 0, 0.93, 0)
  peca(new THREE.BoxGeometry(0.3, 0.16, 0.19), calca, quadril)
  const perna = (lado: number) => {
    const coxa = junta(quadril, 0.095 * lado, -0.03, 0)
    peca(new THREE.CapsuleGeometry(0.068, 0.32, 4, 8), calca, coxa, 0, -0.21, 0)
    const joelho = junta(coxa, 0, -0.43, 0)
    peca(new THREE.CapsuleGeometry(0.056, 0.32, 4, 8), calca, joelho, 0, -0.2, 0)
    peca(new THREE.CylinderGeometry(0.064, 0.06, 0.16, 8), bota, joelho, 0, -0.34, 0)
    const tornozelo = junta(joelho, 0, -0.42, 0)
    peca(new THREE.BoxGeometry(0.11, 0.09, 0.25), bota, tornozelo, 0, -0.03, -0.05)
    return { coxa, joelho, tornozelo }
  }
  const esquerda = perna(-1)
  const direita = perna(1)

  const tronco = junta(quadril, 0, 0.06, 0)
  peca(new THREE.CapsuleGeometry(0.16, 0.3, 4, 10), tunica, tronco, 0, 0.3, 0).scale.set(1.05, 1, 0.75)
  peca(new THREE.CylinderGeometry(0.17, 0.175, 0.06, 12), couro, tronco, 0, 0.08, 0)
  const cabeca = junta(tronco, 0, 0.67, 0)
  peca(new THREE.SphereGeometry(0.1, 12, 10), pele, cabeca, 0, 0, -0.01)
  peca(new THREE.SphereGeometry(0.128, 14, 10), capa, cabeca, 0, 0.012, 0.018).scale.set(1, 1.08, 1.1)
  peca(new THREE.ConeGeometry(0.07, 0.16, 8), capa, cabeca, 0, -0.03, 0.13).rotation.x = 2.1
  const braco = (lado: number) => {
    const ombro = junta(tronco, 0.215 * lado, 0.52, 0)
    peca(new THREE.CapsuleGeometry(0.052, 0.22, 4, 8), tunica, ombro, 0, -0.15, 0)
    const cotovelo = junta(ombro, 0, -0.3, 0)
    peca(new THREE.CapsuleGeometry(0.046, 0.2, 4, 8), tunica, cotovelo, 0, -0.13, 0)
    peca(new THREE.SphereGeometry(0.05, 8, 6), pele, cotovelo, 0, -0.28, 0)
    return { ombro, cotovelo }
  }
  const bracoE = braco(-1)
  const bracoD = braco(1)
  // A capa cobre só as costas (metade de um cone aberto, presa nos ombros).
  const presaDaCapa = junta(tronco, 0, 0.6, 0.06)
  peca(new THREE.CylinderGeometry(0.2, 0.36, 0.95, 16, 3, true, -Math.PI / 2, Math.PI), capa, presaDaCapa, 0, -0.475, 0)
  peca(new THREE.BoxGeometry(0.3, 0.34, 0.15), couro, tronco, 0, 0.36, 0.25)
  peca(new THREE.CylinderGeometry(0.075, 0.075, 0.42, 10), rolo, tronco, 0, 0.58, 0.23).rotation.z = Math.PI / 2

  const AMPLITUDE = 0.38
  const posarPerna = (p: { coxa: Three.Group; joelho: Three.Group; tornozelo: Three.Group }, fase: number) => {
    const s = Math.sin(fase)
    const balanco = Math.pow(Math.max(0, Math.cos(fase)), 1.6)
    p.coxa.rotation.x = AMPLITUDE * s
    p.joelho.rotation.x = -(0.08 + 0.95 * balanco)
    // Pé quase rente ao chão; ponta para cima no contato, calcanhar sobe no impulso.
    p.tornozelo.rotation.x = -(p.coxa.rotation.x + p.joelho.rotation.x) + 0.18 * s
  }

  return {
    raiz,
    posar(fase: number) {
      const s = Math.sin(fase)
      const c = Math.cos(fase)
      quadril.position.y = 0.915 + 0.032 * Math.cos(2 * fase)
      quadril.position.x = 0.028 * c
      quadril.rotation.y = -0.06 * s
      quadril.rotation.z = 0.03 * c
      posarPerna(esquerda, fase)
      posarPerna(direita, fase + Math.PI)
      tronco.rotation.set(-0.07, 0.09 * s, -0.025 * c)
      cabeca.rotation.set(0.05, -0.07 * s, 0)
      bracoE.ombro.rotation.set(-0.34 * s, 0, -0.1)
      bracoD.ombro.rotation.set(0.34 * s, 0, 0.1)
      bracoE.cotovelo.rotation.x = 0.18 + 0.22 * Math.max(0, -s)
      bracoD.cotovelo.rotation.x = 0.18 + 0.22 * Math.max(0, s)
      presaDaCapa.rotation.set(-0.1 - 0.05 * (0.5 + 0.5 * Math.sin(2 * fase + 0.8)), 0, 0.035 * Math.cos(fase + 0.5))
    },
  }
}

// ---------------------------------------------------------------------------
// A cena
// ---------------------------------------------------------------------------

function montarTrilha(THREE: ThreeModule, { reduzirMovimento }: OpcoesDaCena, variante: VarianteDaTrilha): CenaTransicao {
  const chamas = variante === 'chamas'
  const P = chamas ? CHAMAS : DIA
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 1200)
  scene.add(camera)
  const texturas: Three.Texture[] = []
  const rnd = semente(20261027)
  const lin = (hex: number) => corLinear(THREE, hex)

  const textura = (canvas: HTMLCanvasElement, opcoes: { repetir?: boolean; cor?: boolean } = {}) => {
    const tex = new THREE.CanvasTexture(canvas)
    if (opcoes.cor !== false) tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    if (opcoes.repetir) tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    texturas.push(tex)
    return tex
  }
  const pintar = (largura: number, altura: number, pintor: (g: CanvasRenderingContext2D) => void) => {
    const [canvas, g] = tela(largura, altura)
    pintor(g)
    return canvas
  }

  // --- Luz -----------------------------------------------------------------
  scene.add(new THREE.HemisphereLight(lin(P.ceuLuz), lin(P.chaoLuz), P.forcaHemisferio))
  const direcional = new THREE.DirectionalLight(lin(P.luzDirecional), P.forcaDirecional)
  direcional.position.set(P.direcaoDaLuz[0], P.direcaoDaLuz[1], P.direcaoDaLuz[2]).multiplyScalar(50)
  scene.add(direcional)

  // --- Céu e serras ---------------------------------------------------------
  const materialDoCeu = new THREE.ShaderMaterial({
    uniforms: {
      uZenite: { value: corCrua(THREE, P.ceuZenite) },
      uHorizonte: { value: corCrua(THREE, P.ceuHorizonte) },
      uFaixa: { value: corCrua(THREE, P.ceuFaixa) },
      uNuvem: { value: corCrua(THREE, P.ceuNuvem) },
      uTempo: { value: 0 },
      uChamas: { value: chamas ? 1 : 0 },
      uBrilhoDoFogo: { value: 1 },
    },
    vertexShader: CEU_VERTICE,
    fragmentShader: CEU_FRAGMENTO,
    side: THREE.BackSide,
    depthWrite: false,
  })
  const ceu = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), materialDoCeu)
  ceu.renderOrder = -10
  ceu.frustumCulled = false
  scene.add(ceu)

  const serra = new THREE.Mesh(
    new THREE.CylinderGeometry(400, 400, 260, 64, 1, true, Math.PI - 1.4, 2.8),
    new THREE.MeshBasicMaterial({ map: textura(pintar(2048, 256, (g) => pintarSerra(g, P.serraLonge, P.serraPerto))), side: THREE.BackSide, alphaTest: 0.5, depthWrite: false }),
  )
  serra.renderOrder = -9
  serra.frustumCulled = false
  scene.add(serra)

  // --- Chão ------------------------------------------------------------------
  const texDetalhe = textura(pintar(256, 256, pintarDetalhe), { repetir: true, cor: false })
  const materialDoChao = new THREE.MeshLambertMaterial({ map: textura(pintar(1024, 1536, pintarChao)) })
  materialDoChao.onBeforeCompile = (shader) => {
    shader.uniforms.uDetalhe = { value: texDetalhe }
    shader.fragmentShader =
      'uniform sampler2D uDetalhe;\n' +
      shader.fragmentShader.replace(
        '#include <map_fragment>',
        `#include <map_fragment>\n  diffuseColor.rgb *= texture2D(uDetalhe, vMapUv * vec2(${CHAO_LARGURA.toFixed(1)}, ${CHAO_COMPRIMENTO.toFixed(1)})).rgb * 2.0;`,
      )
  }
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(CHAO_LARGURA, CHAO_COMPRIMENTO), materialDoChao)
  chao.rotation.x = -Math.PI / 2
  chao.position.set(0, 0, CHAO_Z_PERTO - CHAO_COMPRIMENTO / 2)
  chao.receiveShadow = true
  scene.add(chao)
  const campoAoLonge = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshLambertMaterial({ color: lin(0x3f3f2c) }))
  campoAoLonge.rotation.x = -Math.PI / 2
  campoAoLonge.position.y = -0.02
  scene.add(campoAoLonge)

  const m4 = new THREE.Matrix4()
  const quat = new THREE.Quaternion()
  const pos = new THREE.Vector3()
  const esc = new THREE.Vector3()
  const eixoY = new THREE.Vector3(0, 1, 0)
  const giro = new THREE.Euler()
  const cor = new THREE.Color()

  // --- Tufos de capim nas beiradas da trilha -----------------------------------
  const TUFOS = 520
  const tufos = new THREE.InstancedMesh(
    geometriaDoTufo(THREE),
    new THREE.MeshLambertMaterial({ map: textura(pintar(128, 128, pintarTufo)), alphaTest: 0.45, side: THREE.DoubleSide }),
    TUFOS,
  )
  for (let i = 0; i < TUFOS; i++) {
    const z = 9 - rnd() * 30
    const centro = trilhaX(z)
    let x = i % 10 < 7 ? centro + (rnd() < 0.5 ? -1 : 1) * (0.8 + rnd() * 1.6) : -18 + rnd() * 36
    if (Math.abs(x - centro) < 0.8) x = centro + (x < centro ? -1.6 : 1.6)
    const e = 0.22 + rnd() * 0.3
    m4.compose(pos.set(x, 0, z), quat.setFromAxisAngle(eixoY, rnd() * Math.PI), esc.set(e * (1.1 + rnd() * 0.5), e, e * (1.1 + rnd() * 0.5)))
    tufos.setMatrixAt(i, m4)
    tufos.setColorAt(i, cor.setScalar((0.55 + rnd() * 0.3) * (chamas ? 0.8 : 1)))
  }
  tufos.frustumCulled = false
  scene.add(tufos)

  // --- O pinheiral ---------------------------------------------------------------
  const arvores: ArvoreDaMata[] = []
  for (let z = BORDA_DA_MATA; z > -52; z -= 1.5 + rnd() * 0.45) {
    for (let x = -34 + rnd(); x < 34; x += 1.65 + rnd() * 0.9) {
      const zz = z + (rnd() - 0.5) * 1.1
      // A trilha entra na mata e some no escuro: um corredor sem árvore até z = -38.
      if (zz > -38 && Math.abs(x - trilhaX(zz)) < 1.7) continue
      const profundidade = Math.max(0, BORDA_DA_MATA - zz)
      arvores.push({ x, z: zz, altura: 8 + rnd() * 4.5 + profundidade * 0.14, profundidade })
    }
  }
  // Sentinelas: árvores que saem um pouco da linha, para a borda não ficar reta.
  for (let i = 0; i < 26; i++) {
    const z = BORDA_DA_MATA + 0.5 + rnd() * 4
    const x = -30 + rnd() * 60
    if (Math.abs(x - trilhaX(z)) < 2.2) continue
    arvores.push({ x, z, altura: 6 + rnd() * 5, profundidade: 0 })
  }
  // Pinheiros soltos no campo, entre a câmera e a mata: dão profundidade quando a câmera anda.
  const soltos = Array.from({ length: 16 }, (_, i) => {
    const z = 4 - rnd() * 22
    return { x: trilhaX(z) + (i % 2 === 0 ? -1 : 1) * (4.5 + rnd() * 11), z, altura: 3.5 + rnd() * 5.5 }
  })
  const mata = new THREE.InstancedMesh(
    geometriaDoPinheiro(THREE, lin(P.pontaDoPinheiro), lin(P.miolo), lin(P.tronco)),
    new THREE.MeshLambertMaterial({ vertexColors: true }),
    arvores.length + soltos.length,
  )
  const plantar = (i: number, x: number, z: number, altura: number, tom: number) => {
    const largura = altura * (0.85 + rnd() * 0.3)
    m4.compose(pos.set(x, 0, z), quat.setFromEuler(giro.set((rnd() - 0.5) * 0.06, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.06)), esc.set(largura, altura, largura))
    mata.setMatrixAt(i, m4)
    mata.setColorAt(i, cor.setScalar(tom * (0.85 + rnd() * 0.3)))
  }
  arvores.forEach((a, i) => {
    // Para dentro da mata tudo escurece até quase o preto.
    const escuro = 1 - 0.86 * Math.min(1, a.profundidade / 15) ** 0.8
    plantar(i, a.x, a.z, a.altura, escuro * P.escurecerMata)
  })
  soltos.forEach((s, i) => plantar(arvores.length + i, s.x, s.z, s.altura, chamas ? 0.55 : 1))
  mata.frustumCulled = false
  scene.add(mata)

  // O fundo da mata: escuro de dia, brasa à noite (aparece entre os troncos e no fim do corredor).
  const materialDoFundo = chamas
    ? new THREE.MeshBasicMaterial({ map: textura(pintar(64, 256, pintarBrasaNoFundo)) })
    : new THREE.MeshBasicMaterial({ color: lin(0x0a0f0c) })
  const fundoDaMata = new THREE.Mesh(new THREE.PlaneGeometry(150, 11), materialDoFundo)
  fundoDaMata.position.set(0, 5.5, -50)
  scene.add(fundoDaMata)

  // --- Neblina (dia) ou fumaça baixa (noite) na borda da mata ---------------------
  const texMancha = textura(pintar(128, 128, pintarMancha))
  const neblinas = Array.from({ length: 11 }, (_, i) => {
    const naBorda = i < 8
    const material = new THREE.SpriteMaterial({ map: texMancha, color: lin(P.neblina), transparent: true, depthWrite: false })
    const sprite = new THREE.Sprite(material)
    const largura = naBorda ? 16 + rnd() * 12 : 10 + rnd() * 8
    sprite.scale.set(largura, naBorda ? 3.2 + rnd() * 2 : 1.6 + rnd(), 1)
    const x0 = -26 + (i % 8) * 7.4 + rnd() * 3
    sprite.position.set(x0, naBorda ? 0.9 + rnd() * 0.9 : 0.6, naBorda ? BORDA_DA_MATA + 2 - rnd() * 3.5 : -12 - rnd() * 5)
    material.opacity = P.neblinaOpacidade * (naBorda ? 1 : 0.5) * (0.75 + rnd() * 0.5)
    scene.add(sprite)
    return { sprite, x0, velocidade: 0.12 + rnd() * 0.12, s: i * 1.3 }
  })

  // --- A pessoa e a sombra no chão -----------------------------------------------
  const andarilho = montarAndarilho(THREE)
  scene.add(andarilho.raiz)
  const sombra = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 1.1),
    new THREE.MeshBasicMaterial({ map: texMancha, color: 0x000000, transparent: true, opacity: chamas ? 0.35 : 0.5, depthWrite: false }),
  )
  sombra.rotation.x = -Math.PI / 2
  scene.add(sombra)

  const fogo: FogoDoPinheiral | null = chamas ? montarFogo(THREE, scene, { arvores, reduzir: reduzirMovimento, alvo: andarilho.raiz }) : null

  // --- Câmera ------------------------------------------------------------------
  const alvoDaCamera = new THREE.Vector3()
  const BOCA_DA_TRILHA = -24
  let fatorDoCampo = 1
  let ultimoT = 0

  /** A pessoa e a câmera no tempo t (sem tocar nas luzes: o motor ainda vai converter as unidades delas). */
  function posar(t: number) {
    ultimoT = t
    const wz = -andadoEm(t)
    const wx = trilhaX(wz)
    andarilho.raiz.position.set(wx, 0, wz)
    andarilho.raiz.rotation.y = Math.atan2(inclinacaoDaTrilha(wz), 1)
    andarilho.posar(faseEm(t))
    sombra.position.set(wx, 0.012, wz + 0.05)

    const a = avancoEm(t)
    // Recua enquanto fecha o campo de visão: a pessoa fica do mesmo tamanho e a mata cresce.
    const recuo = reduzirMovimento ? 5.2 + 0.6 * a : 5.2 + 1.8 * a
    const camZ = wz + recuo
    const tremX = reduzirMovimento ? 0 : 0.035 * Math.sin(t * 0.83 + 0.4) + 0.015 * Math.sin(t * 1.9)
    const tremY = reduzirMovimento ? 0 : 0.025 * Math.sin(t * 1.21 + 1.3)
    camera.position.set(0.5 * (trilhaX(camZ) + wx) + 0.9 - 0.35 * a + tremX, 2.25 - 0.5 * a + tremY, camZ)
    const peso = 0.75
    alvoDaCamera.set(wx + (trilhaX(BOCA_DA_TRILHA) - wx) * peso, 1.2 + (2.4 + 0.8 * a - 1.2) * peso, wz + (BOCA_DA_TRILHA - wz) * peso)
    camera.lookAt(alvoDaCamera)
    camera.fov = (reduzirMovimento ? 50 - 4 * a : 50 - 16 * a) * fatorDoCampo
    camera.updateProjectionMatrix()
    ceu.position.copy(camera.position)
    serra.position.copy(camera.position)
  }
  posar(0)

  function atualizar(t: number) {
    posar(t)
    materialDoCeu.uniforms.uTempo.value = t
    const rajada = rajadaEm(t)
    for (const n of neblinas) n.sprite.position.x = n.x0 + n.velocidade * t * (0.7 + 0.6 * rajada) + 0.3 * Math.sin(t * 0.5 + n.s)
    if (chamas) {
      const fogoAgora = fogoEm(t)
      materialDoCeu.uniforms.uBrilhoDoFogo.value = fogoAgora * (0.85 + 0.15 * tremorEm(t, 3.3, reduzirMovimento))
      materialDoFundo.color.setScalar(0.75 + 0.25 * tremorEm(t, 1.9, reduzirMovimento))
      fogo?.atualizar(t)
    }
    return { fade: fadeEm(t) }
  }

  function ajustarTela(aspecto: number) {
    camera.aspect = aspecto
    fatorDoCampo = aspecto < 0.8 ? 1.32 : 1
    posar(ultimoT)
  }

  return {
    scene,
    camera,
    atualizar,
    ajustarTela,
    criarSom: (kit: KitDeSom) => somDaTrilha(kit, variante),
    descartar: () => {
      fogo?.descartar()
      tufos.dispose()
      mata.dispose()
      descartarCena(scene)
      for (const tex of texturas) tex.dispose()
    },
  }
}

/** A cena da trilha na variação escolhida; cada animação do pacote é um `export default criarTrilha(...)`. */
export function criarTrilha(variante: VarianteDaTrilha): CriarCena {
  return (THREE, opcoes) => montarTrilha(THREE, opcoes, variante)
}
