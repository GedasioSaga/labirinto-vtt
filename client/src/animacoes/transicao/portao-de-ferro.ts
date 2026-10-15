import type * as Three from 'three'
import type { CriarCena, KitDeSom, ThreeModule } from '../../transicoes/tipos'
import { descartarCena, semente } from '../../transicoes/texturas'
import { clamp01, easeInOutSine, easeInQuad, easeOutCubic, span } from '../../transicoes/curvas'

/**
 * Portão de ferro: a tela de porta do Resident Evil (1998) com um portão de
 * grade de duas folhas entre pilares de tijolo claro, numa noite de neblina
 * fria. Em primeira pessoa: chega pela laje de pedra, sobe o degrau, o trinco
 * solta com um estalo e as folhas abrem devagar, pesadas, para longe da
 * câmera, num rangido longo de dobradiça enferrujada que muda de tom com a
 * velocidade. No fim elas balançam um pouco e assentam; a câmera atravessa e a
 * neblina engole a tela antes do preto.
 *
 * NÃO emperra (isso é o "Portão pesado"): a abertura é uma curva só, sem
 * trancos. O ar de PlayStation é o mesmo pipeline do "Portão pesado": o mundo
 * é desenhado numa imagem pequena (~430×240, meio-float com queda para 8 bits)
 * e ampliado sem suavizar, com cor de 15 bits e pontilhado ordenado. O motor só
 * chama `renderer.render(scene, camera)`: a `scene` entregue é um quadro de
 * tela cheia, e o mundo (`mundo`, filho dela, invisível para o quadro) é
 * desenhado na imagem pequena no `onBeforeRender` da própria `scene`.
 */

/** Roteiro em segundos. Exportado para o teste e para o gráfico do movimento conferirem as mesmas marcas. */
export const ROTEIRO_DO_PORTAO_DE_FERRO = {
  duracao: 9,
  fadeInFim: 1,
  /** A caminhada vem em passo constante até aqui e então freia até parar. */
  freada: 2.1,
  chegadaFim: 2.9,
  /** Pés na pedra: três no chão, um no degrau, um na laje e o último, de juntar os pés, ao parar. */
  passos: [0.4, 0.95, 1.5, 1.95, 2.35, 2.8],
  degrau: 1.95,
  patamar: 2.35,
  /** O trinco solta (estalo de ferro). */
  trinco: 3,
  aberturaInicio: 3.3,
  aberturaFim: 7,
  travessiaInicio: 6.2,
  travessiaFim: 8.6,
  passosDentro: [6.75, 7.3, 7.85, 8.4],
  neblinaInicio: 7.5,
  neblinaFim: 8.55,
  fadeOutInicio: 8.5,
  fadeOutFim: 9,
} as const
const T = ROTEIRO_DO_PORTAO_DE_FERRO

/** Ângulo final da folha direita (≈83°): aberta o bastante para a câmera passar no meio. */
export const PORTAO_DE_FERRO_ABERTO_RAD = 1.45
/** A esquerda sai um pouco depois e para um pouco antes: as duas não andam como espelho. */
const ATRASO_DA_ESQUERDA = 0.14
const ABERTO_DA_ESQUERDA = PORTAO_DE_FERRO_ABERTO_RAD * 0.98
/** O balanço do fim: passa um pouco do ponto, volta e assenta (rad, s). */
const BALANCO = { amplitude: 0.024, periodo: 0.95, subida: 0.07, queda: 0.42 }

/** Medidas em metros. */
const PATAMAR = 0.3
const DEGRAU = 0.15
const LAJE = { meiaLargura: 1.9, frente: 3.35, fundo: -0.45 }
const PISO_DO_DEGRAU = { meiaLargura: 1.7, frente: 3.75 }
const VAO = 1.15
const PILAR = { lado: 0.5, x: 1.42, altura: 2.9 }
/** `ombro`: fração da largura em que o topo termina de subir; dali ao meio ele segue reto. */
const FOLHA = { largura: VAO - 0.006, alturaNaDobradica: 1.83, alturaNoMeio: 2.35, ombro: 0.42, folgaDoChao: 0.02, barra: 0.03, montante: 0.06 }
const TRILHOS = [
  [0.04, 0.05],
  [0.6, 0.04],
  [0.95, 0.055],
  [1.62, 0.04],
] as const
const BARRAS_POR_FOLHA = 9
const Y_DO_TRINCO = 1.12

const CAM = { olho: 1.55, velocidade: 1.45, zParada: 3.05, zFim: -1.6, zReduzido: 3.2, xParado: 0.02 }
const Z_INICIAL = CAM.zParada + CAM.velocidade * T.freada + CAM.velocidade * (T.chegadaFim - T.freada) * 0.5
/** Balanço do passo: queda da cabeça a cada pisada e ida e volta para os lados (m, rad). */
const PASSO = { queda: 0.022, lado: 0.012, giro: 0.004 }
const ALVO_NO_PORTAO = { y: 1.72, z: 0 }

const COR_DA_NEBLINA = 0x0d1117
const COR_DO_CEU_ALTO = 0x010203
const COR_DOS_FIAPOS = 0x3a4452
const COR_DO_VEU = 0x141a21
const NEBLINA = { base: 0.075, final: 0.5 }
/** Pixels da imagem pequena: ~430×240 em 16:9, a resolução de um jogo de PlayStation. */
const PIXELS_DA_TELA = 430 * 240

// ---------------------------------------------------------------------------
// Movimento (funções puras: o teste e o gráfico do movimento leem sem desenhar)
// ---------------------------------------------------------------------------

export type LadoDaFolha = 'esquerda' | 'direita'

/** Sai pesada e devagar, acelera e gasta mais tempo freando do que acelerando. */
function aberturaPesada(u: number): number {
  return easeInOutSine(Math.pow(clamp01(u), 0.8))
}

/** Passa do ponto, volta e assenta: começa e termina parado (sem salto de velocidade). */
function balanco(d: number): number {
  if (d <= 0) return 0
  return BALANCO.amplitude * Math.sin((2 * Math.PI * d) / BALANCO.periodo) * (1 - Math.exp(-d / BALANCO.subida)) * Math.exp(-d / BALANCO.queda)
}

/** Ângulo de uma folha (rad, 0 = fechada, positivo = aberta para longe da câmera). */
export function anguloDaFolha(t: number, lado: LadoDaFolha, reduzirMovimento: boolean): number {
  const esquerda = lado === 'esquerda'
  const inicio = T.aberturaInicio + (esquerda ? ATRASO_DA_ESQUERDA : 0)
  const aberto = esquerda ? ABERTO_DA_ESQUERDA : PORTAO_DE_FERRO_ABERTO_RAD
  const angulo = aberto * aberturaPesada(span(t, inicio, T.aberturaFim))
  if (reduzirMovimento) return angulo
  return angulo + balanco(t - T.aberturaFim - (esquerda ? 0.05 : 0))
}

/** O trinco de queda: a barra sobe de vez, bate no batente e assenta um pouco abaixo (rad). */
export function anguloDoTrinco(t: number): number {
  const sobe = easeOutCubic(span(t, T.trinco - 0.1, T.trinco + 0.02))
  const assenta = easeInOutSine(span(t, T.trinco + 0.02, T.trinco + 0.2))
  return 0.78 * sobe - 0.12 * assenta
}

/** Metros andados na chegada: passo constante e depois uma freada lisa até parar. */
function andadoNaChegada(t: number): number {
  const v = CAM.velocidade
  if (t <= T.freada) return v * Math.max(0, t)
  const u = span(t, T.freada, T.chegadaFim)
  return v * T.freada + v * (T.chegadaFim - T.freada) * (u - u ** 3 + u ** 4 / 2)
}

/** Fração da velocidade de passo (1 andando, 0 parado): escala o balanço da cabeça. */
function ritmoDaChegada(t: number): number {
  if (t <= T.freada) return 1
  const u = span(t, T.freada, T.chegadaFim)
  return 1 - 3 * u * u + 2 * u * u * u
}

/** Travessia: sai do parado e chega andando (u²(2−u): velocidade final = média). */
function andadoNaTravessia(u: number): number {
  return u * u * (2 - u)
}

/** Quantos passos já foram (contínuo): inteiro em cada pisada, interpolado entre elas. */
function passoContinuo(t: number, pisadas: readonly number[]): number {
  if (t <= pisadas[0]) return (t - pisadas[0]) / (pisadas[1] - pisadas[0])
  for (let i = 0; i < pisadas.length - 1; i++) {
    if (t <= pisadas[i + 1]) return i + (t - pisadas[i]) / (pisadas[i + 1] - pisadas[i])
  }
  const ultimo = pisadas.length - 1
  return ultimo + (t - pisadas[ultimo]) / (pisadas[ultimo] - pisadas[ultimo - 1])
}

/** Sobe o degrau junto com o pé que pisa nele. */
function subida(t: number, pisada: number): number {
  return easeInOutSine(span(t, pisada - 0.08, pisada + 0.18))
}

export interface EstadoDaCamera {
  x: number
  y: number
  z: number
  alvoX: number
  alvoY: number
  alvoZ: number
  giro: number
}

export function estadoDaCamera(t: number, reduzirMovimento: boolean): EstadoDaCamera {
  if (reduzirMovimento) {
    const y = PATAMAR + CAM.olho
    return { x: CAM.xParado, y, z: CAM.zReduzido, alvoX: 0, alvoY: ALVO_NO_PORTAO.y, alvoZ: ALVO_NO_PORTAO.z, giro: 0 }
  }
  const uTravessia = span(t, T.travessiaInicio, T.travessiaFim)
  const z = Z_INICIAL - andadoNaChegada(t) - (CAM.zParada - CAM.zFim) * andadoNaTravessia(uTravessia)
  const chao = DEGRAU * subida(t, T.degrau) + DEGRAU * subida(t, T.patamar)

  // Balanço do passo: na chegada pela fração da velocidade; na travessia pela velocidade dela.
  let pc: number
  let ritmo: number
  if (t < T.travessiaInicio) {
    pc = passoContinuo(t, T.passos)
    ritmo = ritmoDaChegada(t)
  } else {
    pc = passoContinuo(t, T.passosDentro)
    ritmo = clamp01((4 * uTravessia - 3 * uTravessia * uTravessia) / (4 / 3)) * (1 - span(t, T.neblinaFim, T.duracao))
  }
  const queda = -PASSO.queda * ritmo * (1 + Math.cos(2 * Math.PI * pc)) * 0.5
  const lado = PASSO.lado * ritmo * Math.sin(Math.PI * pc)
  // Parado diante do portão: só a respiração.
  const respira = 0.005 * Math.sin((2 * Math.PI * (t - T.chegadaFim)) / 3.4) * span(t, T.chegadaFim - 0.2, T.chegadaFim + 0.6) * (1 - span(t, T.travessiaInicio, T.travessiaInicio + 0.4))

  const x = CAM.xParado + lado
  const y = CAM.olho + chao + queda + respira
  // Olha o portão; ao atravessar, passa a olhar em frente, para dentro da neblina.
  const emFrente = easeInOutSine(span(t, T.travessiaInicio, T.travessiaInicio + 1.3))
  return {
    x,
    y,
    z,
    alvoX: x * emFrente,
    alvoY: ALVO_NO_PORTAO.y + (y - 0.2 - ALVO_NO_PORTAO.y) * emFrente,
    alvoZ: ALVO_NO_PORTAO.z + (z - 8 - ALVO_NO_PORTAO.z) * emFrente,
    giro: PASSO.giro * ritmo * Math.sin(Math.PI * pc),
  }
}

export interface EstadoDoAr {
  /** Densidade da neblina (FogExp2). */
  densidade: number
  /** Opacidade do véu de neblina na frente da câmera (0 a 1). */
  veu: number
  /** Fator da luz fria (1 = cheia): a neblina come a luz no fim. */
  luz: number
}

export function estadoDoAr(t: number): EstadoDoAr {
  const n = easeInQuad(span(t, T.neblinaInicio, T.neblinaFim))
  return {
    densidade: NEBLINA.base + (NEBLINA.final - NEBLINA.base) * n,
    veu: 0.92 * easeInOutSine(span(t, T.neblinaInicio + 0.25, T.neblinaFim)),
    luz: 1 - 0.45 * n,
  }
}

/** 0 = cena visível, 1 = preto. */
export function fadeDoPortao(t: number): number {
  return Math.max(1 - span(t, 0, T.fadeInFim), span(t, T.fadeOutInicio, T.fadeOutFim))
}

// ---------------------------------------------------------------------------
// Cena
// ---------------------------------------------------------------------------

export const criarCenaPortaoDeFerro: CriarCena = (THREE, { reduzirMovimento }) => {
  const scene = new THREE.Scene()
  const mundo = new THREE.Scene()
  const neblina = new THREE.FogExp2(COR_DA_NEBLINA, NEBLINA.base)
  mundo.fog = neblina
  scene.add(mundo)

  // A câmera do motor só enxerga o quadro de tela cheia; quem anda é o `olho`.
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 10)
  const olho = new THREE.PerspectiveCamera(52, 1, 0.05, 110)
  olho.name = 'olho'
  mundo.add(olho)

  // Uma luz só, fria, alta e à frente: acende os pilares e a laje e joga a
  // sombra das grades no chão de dentro. O resto é a neblina contra o céu.
  mundo.add(new THREE.AmbientLight(0x1c2533, 0.3))
  const luz = new THREE.SpotLight(0xc8d5ea, 1.25, 18, 0.62, 0.6, 1.7)
  luz.name = 'luz'
  luz.position.set(0.5, 5.5, 3.2)
  luz.target.position.set(0, 1.0, -0.6)
  luz.castShadow = true
  luz.shadow.mapSize.set(1024, 1024)
  luz.shadow.bias = -0.0008
  luz.shadow.normalBias = 0.02
  luz.shadow.camera.near = 0.5
  luz.shadow.camera.far = 18
  mundo.add(luz, luz.target)

  const instanciadas: Three.InstancedMesh[] = []
  montarCeu(THREE, mundo)
  montarChao(THREE, mundo)
  montarPilares(THREE, mundo)
  instanciadas.push(...montarMuros(THREE, mundo))
  montarArbustos(THREE, mundo)
  montarFundo(THREE, mundo)
  const esquerda = montarFolha(THREE, mundo, -1)
  const direita = montarFolha(THREE, mundo, 1)
  instanciadas.push(...esquerda.instanciadas, ...direita.instanciadas)
  const nevoas = criarNevoas(THREE, mundo)

  // O véu: a neblina que toma a tela quando a câmera entra nela.
  const veu = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 4),
    new THREE.MeshBasicMaterial({ color: COR_DO_VEU, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false }),
  )
  veu.name = 'veu'
  veu.position.z = -0.2
  veu.renderOrder = 50
  veu.visible = false
  olho.add(veu)

  // A imagem pequena: meio-float para o degradê escuro não virar faixas antes
  // do pontilhado (8 bits lineares perdem os tons perto do preto).
  const alvo = new THREE.WebGLRenderTarget(430, 240, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false, depthBuffer: true })
  const uniforms = { tCena: { value: alvo.texture }, uResolucao: { value: new THREE.Vector2(430, 240) }, uTempo: { value: 0 } }
  const quadro = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms, vertexShader: VERTICE_DO_QUADRO, fragmentShader: FRAGMENTO_DO_QUADRO, depthTest: false, depthWrite: false }))
  quadro.frustumCulled = false
  scene.add(quadro)

  mundo.visible = false
  let tipoConferido = false
  scene.onBeforeRender = (renderer) => {
    // Celular sem render em meio-float daria tela PRETA: antes do primeiro
    // desenho (a textura ainda não existe na GPU), cai para 8 bits.
    if (!tipoConferido) {
      tipoConferido = true
      const meioFloat = renderer.extensions.has('EXT_color_buffer_half_float') || renderer.extensions.has('EXT_color_buffer_float')
      if (!meioFloat) alvo.texture.type = THREE.UnsignedByteType
    }
    const anterior = renderer.getRenderTarget()
    mundo.visible = true
    renderer.setRenderTarget(alvo)
    renderer.render(mundo, olho)
    renderer.setRenderTarget(anterior)
    mundo.visible = false
  }

  // A intensidade só vale depois da conversão de unidades do motor (feita
  // logo após `criar`): a base é lida no primeiro quadro, não aqui.
  let luzBase = -1

  function atualizar(t: number) {
    if (luzBase < 0) luzBase = luz.intensity
    uniforms.uTempo.value = t

    esquerda.grupo.rotation.y = anguloDaFolha(t, 'esquerda', reduzirMovimento)
    direita.grupo.rotation.y = -anguloDaFolha(t, 'direita', reduzirMovimento)
    if (direita.trinco) direita.trinco.rotation.z = -anguloDoTrinco(t)

    const ar = estadoDoAr(t)
    neblina.density = ar.densidade
    luz.intensity = luzBase * ar.luz
    const material = veu.material
    material.opacity = ar.veu
    veu.visible = ar.veu > 0.001

    const c = estadoDaCamera(t, reduzirMovimento)
    olho.position.set(c.x, c.y, c.z)
    olho.lookAt(c.alvoX, c.alvoY, c.alvoZ)
    if (c.giro !== 0) olho.rotateZ(c.giro)
    nevoas.atualizar(t, c.z, ar.veu, reduzirMovimento)

    return { fade: fadeDoPortao(t) }
  }

  function ajustarTela(aspecto: number) {
    const altura = Math.max(120, Math.round(Math.sqrt(PIXELS_DA_TELA / aspecto)))
    const largura = Math.max(64, Math.round(altura * aspecto))
    alvo.setSize(largura, altura)
    uniforms.uResolucao.value.set(largura, altura)
    olho.aspect = aspecto
    olho.fov = aspecto < 0.8 ? 68 : 52
    olho.updateProjectionMatrix()
    camera.aspect = aspecto
    camera.updateProjectionMatrix()
  }

  function descartar() {
    for (const malha of instanciadas) malha.dispose()
    descartarCena(scene)
    alvo.dispose()
  }

  return { scene, camera, atualizar, ajustarTela, criarSom: (kit: KitDeSom) => criarSomDoPortao(kit, reduzirMovimento), descartar }
}

export default criarCenaPortaoDeFerro

// ---------------------------------------------------------------------------
// Construção
// ---------------------------------------------------------------------------

type Caixa = readonly [largura: number, altura: number, profundidade: number, x: number, y: number, z: number, giroZ?: number]

/** Muitas caixas numa malha só (um desenho por material): grade, trilhos, rebites. */
function caixasInstanciadas(THREE: ThreeModule, material: Three.Material, caixas: readonly Caixa[]): Three.InstancedMesh {
  const malha = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, caixas.length)
  const m = new THREE.Matrix4()
  const p = new THREE.Vector3()
  const q = new THREE.Quaternion()
  const s = new THREE.Vector3()
  const eixo = new THREE.Vector3(0, 0, 1)
  caixas.forEach(([w, h, d, x, y, z, giro = 0], i) => {
    q.setFromAxisAngle(eixo, giro)
    m.compose(p.set(x, y, z), q, s.set(w, h, d))
    malha.setMatrixAt(i, m)
  })
  malha.instanceMatrix.needsUpdate = true
  malha.castShadow = true
  malha.receiveShadow = true
  return malha
}

/** Céu de noite: quase preto no alto, a cor da neblina no horizonte; a lua velada atrás do portão. */
function montarCeu(THREE: ThreeModule, mundo: Three.Scene) {
  const geo = new THREE.SphereGeometry(60, 24, 14)
  const pos = geo.getAttribute('position')
  const cores = new Float32Array(pos.count * 3)
  const baixo = new THREE.Color(COR_DA_NEBLINA)
  const alto = new THREE.Color(COR_DO_CEU_ALTO)
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const h = pos.getY(i) / 60
    c.copy(baixo).lerp(alto, easeInOutSine(span(h, 0.02, 0.55)))
    cores.set([c.r, c.g, c.b], i * 3)
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cores, 3))
  const ceu = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }))
  ceu.renderOrder = -10
  ceu.frustumCulled = false
  mundo.add(ceu)

  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaDoHalo(THREE), color: 0x7a889c, transparent: true, opacity: 0.6, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }))
  halo.position.set(-9, 13, -45)
  halo.scale.setScalar(20)
  halo.renderOrder = -9
  mundo.add(halo)
}

function plano(THREE: ThreeModule, largura: number, comprimento: number, material: Three.Material, x: number, y: number, z: number): Three.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(largura, comprimento), material)
  m.rotation.x = -Math.PI / 2
  m.position.set(x, y, z)
  m.receiveShadow = true
  return m
}

/** Chão de fora, caminho de lajes até o degrau, o degrau, a laje do portão e o chão de dentro. */
function montarChao(THREE: ThreeModule, mundo: Three.Scene) {
  const terraTex = texturaDeTerra(THREE, 61)
  terraTex.repeat.set(10, 6)
  const terra = new THREE.MeshStandardMaterial({ map: terraTex, roughness: 1 })
  mundo.add(plano(THREE, 26, 16, terra, 0, 0, 6))

  const caminhoTex = texturaDeLajes(THREE, 13, 40, 14)
  caminhoTex.repeat.set(2, 11)
  mundo.add(plano(THREE, 1.9, 10.5, new THREE.MeshStandardMaterial({ map: caminhoTex, roughness: 0.95 }), 0, 0.003, PISO_DO_DEGRAU.frente + 5.25))

  const pedraTex = texturaDePedraClara(THREE, 31)
  pedraTex.repeat.set(2, 0.4)
  const pedra = new THREE.MeshStandardMaterial({ map: pedraTex, roughness: 0.9 })
  const lajeTex = texturaDeLajes(THREE, 17, 78, 18)
  const laje = new THREE.MeshStandardMaterial({ map: lajeTex, roughness: 0.88 })

  const profundidade = LAJE.frente - LAJE.fundo
  lajeTex.repeat.set((LAJE.meiaLargura * 2) / 0.95, profundidade / 0.95)
  const patamar = new THREE.Mesh(new THREE.BoxGeometry(LAJE.meiaLargura * 2, PATAMAR, profundidade), [pedra, pedra, laje, pedra, pedra, pedra])
  patamar.position.set(0, PATAMAR / 2, (LAJE.frente + LAJE.fundo) / 2)
  patamar.receiveShadow = true
  patamar.castShadow = true
  mundo.add(patamar)

  const degrauTex = texturaDeLajes(THREE, 19, 74, 16)
  degrauTex.repeat.set((PISO_DO_DEGRAU.meiaLargura * 2) / 0.95, 0.42)
  const fundo = PISO_DO_DEGRAU.frente - LAJE.frente
  const degrau = new THREE.Mesh(new THREE.BoxGeometry(PISO_DO_DEGRAU.meiaLargura * 2, DEGRAU, fundo), [pedra, pedra, new THREE.MeshStandardMaterial({ map: degrauTex, roughness: 0.88 }), pedra, pedra, pedra])
  degrau.position.set(0, DEGRAU / 2, LAJE.frente + fundo / 2)
  degrau.receiveShadow = true
  degrau.castShadow = true
  mundo.add(degrau)

  // Dentro: o chão segue na altura da laje, e o caminho de pedra some na neblina.
  const dentroTex = texturaDeTerra(THREE, 67)
  dentroTex.repeat.set(12, 18)
  mundo.add(plano(THREE, 30, 40, new THREE.MeshStandardMaterial({ map: dentroTex, roughness: 1 }), 0, PATAMAR, LAJE.fundo - 20))
  const trilhaTex = texturaDeLajes(THREE, 23, 52, 16)
  trilhaTex.repeat.set(2, 36)
  mundo.add(plano(THREE, 1.6, 34, new THREE.MeshStandardMaterial({ map: trilhaTex, roughness: 0.95 }), 0, PATAMAR + 0.002, LAJE.fundo - 17))
}

/** Pilares de tijolo claro com capa de pedra, como na imagem de referência. */
function montarPilares(THREE: ThreeModule, mundo: Three.Scene) {
  const tijoloTex = texturaDeTijolos(THREE, 41)
  tijoloTex.repeat.set(1, PILAR.altura)
  const tijolo = new THREE.MeshStandardMaterial({ map: tijoloTex, roughness: 0.92 })
  const capaTex = texturaDePedraClara(THREE, 43)
  capaTex.repeat.set(0.6, 0.6)
  const capa = new THREE.MeshStandardMaterial({ map: capaTex, roughness: 0.85 })
  for (const lado of [-1, 1]) {
    const x = lado * PILAR.x
    const corpo = new THREE.Mesh(new THREE.BoxGeometry(PILAR.lado, PILAR.altura, PILAR.lado), tijolo)
    corpo.position.set(x, PILAR.altura / 2, 0)
    corpo.castShadow = true
    corpo.receiveShadow = true
    mundo.add(corpo)
    const partes: Array<[number, number, number]> = [
      [PILAR.lado + 0.14, 0.11, PILAR.altura + 0.055],
      [PILAR.lado + 0.04, 0.07, PILAR.altura + 0.145],
    ]
    for (const [lado2, altura, y] of partes) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(lado2, altura, lado2), capa)
      m.position.set(x, y, 0)
      m.castShadow = true
      m.receiveShadow = true
      mundo.add(m)
    }
    const ponta = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.16, 4), capa)
    ponta.rotation.y = Math.PI / 4
    ponta.position.set(x, PILAR.altura + 0.26, 0)
    ponta.castShadow = true
    mundo.add(ponta)
  }
}

/** Muro baixo de tijolo com grade de lanças, saindo dos pilares para os lados até sumir no escuro. */
function montarMuros(THREE: ThreeModule, mundo: Three.Scene): Three.InstancedMesh[] {
  const inicio = PILAR.x + PILAR.lado / 2
  const fim = 9
  const comprimento = fim - inicio
  const altura = 0.8
  const tijoloTex = texturaDeTijolos(THREE, 47)
  tijoloTex.repeat.set(comprimento / 0.5, altura)
  const tijolo = new THREE.MeshStandardMaterial({ map: tijoloTex, roughness: 0.95 })
  const ferro = materialDeFerro(THREE)
  const caixas: Caixa[] = []
  const pontas: Array<[number, number]> = []
  for (const lado of [-1, 1]) {
    const muro = new THREE.Mesh(new THREE.BoxGeometry(comprimento, altura, 0.35), tijolo)
    muro.position.set(lado * (inicio + comprimento / 2), altura / 2, 0)
    muro.castShadow = true
    muro.receiveShadow = true
    mundo.add(muro)
    for (let x = inicio + 0.16; x < fim; x += 0.16) {
      caixas.push([0.02, 1.25, 0.02, lado * x, altura + 0.625, 0])
      pontas.push([lado * x, altura + 1.3])
    }
    caixas.push([comprimento, 0.035, 0.03, lado * (inicio + comprimento / 2), altura + 0.12, 0])
    caixas.push([comprimento, 0.035, 0.03, lado * (inicio + comprimento / 2), altura + 1.12, 0])
  }
  const grade = caixasInstanciadas(THREE, ferro, caixas)
  mundo.add(grade)
  const lancas = new THREE.InstancedMesh(new THREE.ConeGeometry(0.026, 0.1, 4), ferro, pontas.length)
  const m = new THREE.Matrix4()
  pontas.forEach(([x, y], i) => lancas.setMatrixAt(i, m.makeTranslation(x, y, 0)))
  lancas.instanceMatrix.needsUpdate = true
  lancas.castShadow = true
  mundo.add(lancas)
  return [grade, lancas]
}

/** Moitas baixas nos cantos, ao lado do degrau (poucos polígonos, sombreado chapado). */
function montarArbustos(THREE: ThreeModule, mundo: Three.Scene) {
  const rnd = semente(53)
  const folhas = [new THREE.MeshStandardMaterial({ color: 0x1d3524, roughness: 1, flatShading: true }), new THREE.MeshStandardMaterial({ color: 0x29452e, roughness: 1, flatShading: true })]
  const geo = new THREE.IcosahedronGeometry(1, 0)
  const moitas: Array<[number, number, number]> = [
    [2.35, 2.3, 0.55],
    [2.15, 3.95, 0.5],
    [2.75, 1.0, 0.6],
  ]
  for (const lado of [-1, 1]) {
    for (const [x, z, r] of moitas) {
      for (let k = 0; k < 4; k++) {
        const m = new THREE.Mesh(geo, folhas[k % 2])
        const rr = r * (0.55 + rnd() * 0.45)
        m.scale.set(rr, rr * (0.7 + rnd() * 0.3), rr)
        m.position.set(lado * (x + (rnd() - 0.5) * 0.5), rr * 0.55, z + (rnd() - 0.5) * 0.5)
        m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3)
        m.castShadow = true
        m.receiveShadow = true
        mundo.add(m)
      }
    }
  }
}

/** Do lado de dentro: sebes baixas ao longo do caminho e árvores secas, sumindo na neblina. */
function montarFundo(THREE: ThreeModule, mundo: Three.Scene) {
  const rnd = semente(59)
  // Moitas soltas na beira do caminho: marcam a profundidade até a neblina engolir.
  const folhaTex = texturaDeFolhagem(THREE, 71)
  const folha = new THREE.MeshStandardMaterial({ map: folhaTex, roughness: 1, flatShading: true })
  const geo = new THREE.IcosahedronGeometry(1, 0)
  for (const lado of [-1, 1]) {
    for (let z = -2.4 - rnd(); z > -26; z -= 2.2 + rnd() * 1.6) {
      const r = 0.32 + rnd() * 0.3
      const m = new THREE.Mesh(geo, folha)
      m.scale.set(r * 1.3, r * 0.8, r)
      m.position.set(lado * (1.25 + rnd() * 0.6), PATAMAR + r * 0.45, z)
      m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3)
      m.receiveShadow = true
      m.castShadow = true
      mundo.add(m)
    }
  }
  const casca = new THREE.MeshStandardMaterial({ color: 0x101318, roughness: 1 })
  const arvores: Array<[number, number, number]> = [
    [-3.4, -6.5, 4.2],
    [3.9, -9, 4.8],
    [-2.7, -13, 4.4],
    [4.6, -17, 5],
  ]
  const eixoY = new THREE.Vector3(0, 1, 0)
  for (const [x, z, h] of arvores) {
    const tronco = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.16, h, 6), casca)
    tronco.position.set(x, PATAMAR + h / 2, z)
    tronco.rotation.z = (rnd() - 0.5) * 0.12
    mundo.add(tronco)
    for (let k = 0; k < 4; k++) {
      const base = new THREE.Vector3(x, PATAMAR + h * (0.45 + k * 0.13), z)
      const ang = rnd() * Math.PI * 2
      const comp = 0.8 + rnd() * 1.1
      const ponta = base.clone().add(new THREE.Vector3(Math.cos(ang) * comp, 0.4 + rnd() * 0.9, Math.sin(ang) * comp * 0.6))
      const galho = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.05, base.distanceTo(ponta), 5), casca)
      galho.position.copy(base).lerp(ponta, 0.5)
      galho.quaternion.setFromUnitVectors(eixoY, ponta.clone().sub(base).normalize())
      mundo.add(galho)
    }
  }
}

function materialDeFerro(THREE: ThreeModule): Three.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.5, metalness: 0.62 })
}

/** Topo da folha: sobe da dobradiça para o meio num quarto de elipse (os "ombros" arqueados). */
function topoDaFolha(s: number): number {
  const u = clamp01(s / (FOLHA.largura * FOLHA.ombro))
  return FOLHA.alturaNaDobradica + (FOLHA.alturaNoMeio - FOLHA.alturaNaDobradica) * Math.sqrt(1 - (1 - u) * (1 - u))
}

interface Folha {
  grupo: Three.Group
  trinco: Three.Group | null
  instanciadas: Three.InstancedMesh[]
}

/**
 * Uma folha de grade com pivô na dobradiça. `lado` -1 = esquerda (dobradiça em
 * x negativo), 1 = direita. `s` mede da dobradiça para o meio; em x local é
 * `-lado * s`. A direita leva o trinco de queda; a esquerda, o batente dele.
 */
function montarFolha(THREE: ThreeModule, mundo: Three.Scene, lado: -1 | 1): Folha {
  const grupo = new THREE.Group()
  grupo.name = lado < 0 ? 'folha-esquerda' : 'folha-direita'
  grupo.position.set(lado * VAO, PATAMAR + FOLHA.folgaDoChao, 0)
  mundo.add(grupo)
  const ferro = materialDeFerro(THREE)
  const xl = (s: number) => -lado * s
  const W = FOLHA.largura
  const b = FOLHA.barra
  const caixas: Caixa[] = []

  // Prumos: montante da dobradiça, 9 barras e montante do meio, igualmente espaçados.
  const nos: number[] = []
  const passo = (W - 0.06) / (BARRAS_POR_FOLHA + 1)
  for (let i = 0; i <= BARRAS_POR_FOLHA + 1; i++) nos.push(0.03 + i * passo)
  nos.forEach((s, i) => {
    const borda = i === 0 || i === nos.length - 1
    const topo = topoDaFolha(s) + 0.01
    caixas.push([borda ? FOLHA.montante : b, topo, borda ? 0.04 : b, xl(s), topo / 2, 0])
  })
  // Trilhos retos.
  const meio = (nos[0] + nos[nos.length - 1]) / 2
  const vao = nos[nos.length - 1] - nos[0]
  for (const [y, h] of TRILHOS) caixas.push([vao, h, 0.03, xl(meio), y, 0])
  // Trilho de cima, curvo: segmentos ao longo do arco.
  const SEG = 12
  for (let k = 0; k < SEG; k++) {
    const s0 = (W * k) / SEG
    const s1 = (W * (k + 1)) / SEG
    const x0 = xl(s0)
    const x1 = xl(s1)
    const y0 = topoDaFolha(s0)
    const y1 = topoDaFolha(s1)
    const corda = Math.hypot(x1 - x0, y1 - y0)
    caixas.push([corda + 0.012, 0.045, 0.035, (x0 + x1) / 2, (y0 + y1) / 2, 0, Math.atan2(y1 - y0, x1 - x0)])
  }
  // Faixa de baixo, mais fechada: uma barra fina no meio de cada vão, até o topo do arquinho.
  const raio = passo / 2
  const topoDaFaixa = TRILHOS[1][0] - TRILHOS[1][1] / 2
  for (let i = 0; i < nos.length - 1; i++) {
    const s = (nos[i] + nos[i + 1]) / 2
    const h = topoDaFaixa - TRILHOS[0][0]
    caixas.push([b * 0.8, h, b * 0.8, xl(s), TRILHOS[0][0] + h / 2, 0])
  }
  // Rebites: nos cruzamentos do trilho do meio e do de cima.
  for (const s of nos) {
    for (const y of [TRILHOS[2][0], TRILHOS[3][0]]) caixas.push([0.034, 0.034, 0.03, xl(s), y, 0.022])
  }
  const grade = caixasInstanciadas(THREE, ferro, caixas)
  grade.name = 'grade'
  grupo.add(grade)

  // Arquinhos (∩) entre os prumos, encostados por baixo no trilho da faixa.
  const arcoGeo = new THREE.TorusGeometry(1, 0.16, 3, 10, Math.PI)
  const arcos = new THREE.InstancedMesh(arcoGeo, ferro, nos.length - 1)
  const m = new THREE.Matrix4()
  const escala = new THREE.Vector3(raio, raio, raio)
  const q = new THREE.Quaternion()
  const p = new THREE.Vector3()
  for (let i = 0; i < nos.length - 1; i++) {
    m.compose(p.set(xl((nos[i] + nos[i + 1]) / 2), topoDaFaixa - raio, 0), q, escala)
    arcos.setMatrixAt(i, m)
  }
  arcos.instanceMatrix.needsUpdate = true
  arcos.castShadow = true
  grupo.add(arcos)

  // Gonzos da dobradiça.
  for (const y of [0.25, 1.45]) {
    const gonzo = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.14, 6), ferro)
    gonzo.position.set(0, y, 0)
    gonzo.castShadow = true
    grupo.add(gonzo)
  }

  let trinco: Three.Group | null = null
  if (lado > 0) {
    // Trinco de queda: a barra gira num pino da folha direita e descansa no batente da esquerda.
    trinco = new THREE.Group()
    trinco.name = 'trinco'
    trinco.position.set(xl(W - 0.22), Y_DO_TRINCO, 0.035)
    const barra = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.012), ferro)
    barra.position.set(-0.17 + 0.015, 0, 0)
    barra.castShadow = true
    const pino = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.03, 6), ferro)
    pino.rotation.x = Math.PI / 2
    trinco.add(barra, pino)
    grupo.add(trinco)
  } else {
    const apoio = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.022, 0.05), ferro)
    apoio.position.set(xl(W - 0.06), Y_DO_TRINCO - 0.026, 0.035)
    const lingua = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.01), ferro)
    lingua.position.set(xl(W - 0.06), Y_DO_TRINCO - 0.005, 0.058)
    grupo.add(apoio, lingua)
  }
  return { grupo, trinco, instanciadas: [grade, arcos] }
}

interface Nevoa {
  malha: Three.Mesh<Three.PlaneGeometry, Three.MeshBasicMaterial>
  x: number
  z: number
  alfa: number
  deriva: number
  fase: number
}

/** Fiapos de neblina baixa: planos de ruído macio que derivam devagar e somem quando a câmera chega neles. */
function criarNevoas(THREE: ThreeModule, mundo: Three.Scene) {
  const base = texturaDeNevoa(THREE, 83)
  const camadas: Array<[x: number, y: number, z: number, largura: number, altura: number, alfa: number]> = [
    [0.4, 0.55, 1.4, 7, 1.2, 0.16],
    [-0.6, 0.85, -1.9, 9, 1.9, 0.26],
    [0.8, 1.15, -4.6, 12, 2.8, 0.3],
    [-1.2, 1.5, -8.2, 16, 3.8, 0.34],
    [0.5, 1.9, -12.5, 22, 5, 0.36],
  ]
  const nevoas: Nevoa[] = camadas.map(([x, y, z, largura, altura, alfa], i) => {
    const tex = i === 0 ? base : base.clone()
    tex.offset.set(i * 0.37, 0)
    const malha = new THREE.Mesh(new THREE.PlaneGeometry(largura, altura), new THREE.MeshBasicMaterial({ map: tex, color: COR_DOS_FIAPOS, transparent: true, opacity: alfa, depthWrite: false }))
    malha.position.set(x, PATAMAR + y, z)
    malha.renderOrder = 2 + i
    mundo.add(malha)
    return { malha, x, z, alfa, deriva: 0.012 + i * 0.004, fase: i * 1.7 }
  })
  return {
    atualizar(t: number, zDaCamera: number, veu: number, reduzir: boolean) {
      const ritmo = reduzir ? 0.4 : 1
      for (const n of nevoas) {
        n.malha.position.x = n.x + Math.sin(t * 0.25 * ritmo + n.fase) * 0.35
        const mapa = n.malha.material.map
        if (mapa) mapa.offset.x = n.fase * 0.2 + t * n.deriva * ritmo
        const perto = clamp01((Math.abs(zDaCamera - n.z) - 0.6) / 2.4)
        n.malha.material.opacity = n.alfa * perto * (1 + 0.8 * veu)
        n.malha.visible = n.malha.material.opacity > 0.002
      }
    },
  }
}

// ---------------------------------------------------------------------------
// Texturas (canvas com semente fixa: a miniatura sai igual toda vez)
// ---------------------------------------------------------------------------

function tela(largura: number, altura: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2D indisponível')
  return [canvas, ctx]
}

/** Granulado por pixel: a textura "suja" que o PlayStation mostrava em tudo. */
function granular(g: CanvasRenderingContext2D, largura: number, altura: number, rnd: () => number, forca: number) {
  const img = g.getImageData(0, 0, largura, altura)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * forca
    img.data[i] += n
    img.data[i + 1] += n
    img.data[i + 2] += n
  }
  g.putImageData(img, 0, 0)
}

function manchas(g: CanvasRenderingContext2D, largura: number, altura: number, rnd: () => number, quantas: number, raio: [number, number], cor: string) {
  for (let k = 0; k < quantas; k++) {
    const x = rnd() * largura
    const y = rnd() * altura
    const r = raio[0] + rnd() * (raio[1] - raio[0])
    const grd = g.createRadialGradient(x, y, 0, x, y, r)
    grd.addColorStop(0, cor)
    grd.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, largura, altura)
  }
}

function repetida(THREE: ThreeModule, canvas: HTMLCanvasElement): Three.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

/** Tijolo claro (128×256 = 0,5 × 1 m): dois por fiada, em amarração, cada um num tom, com luz na aresta de cima. */
function texturaDeTijolos(THREE: ThreeModule, seed: number): Three.CanvasTexture {
  const [canvas, g] = tela(128, 256)
  const rnd = semente(seed)
  g.fillStyle = '#4e545d'
  g.fillRect(0, 0, 128, 256)
  const FIADA = 32
  for (let linha = 0; linha < 256 / FIADA; linha++) {
    const desloca = linha % 2 === 0 ? 0 : 32
    for (let k = -1; k < 2; k++) {
      const x = k * 64 + desloca
      const y = linha * FIADA
      const tom = 118 + Math.round(rnd() * 26)
      g.fillStyle = `rgb(${tom},${tom + 6},${tom + 14})`
      g.fillRect(x + 2, y + 2, 60, FIADA - 4)
      g.fillStyle = `rgba(214,222,232,0.35)`
      g.fillRect(x + 2, y + 2, 60, 2)
      g.fillStyle = 'rgba(20,24,30,0.35)'
      g.fillRect(x + 2, y + FIADA - 4, 60, 2)
    }
  }
  granular(g, 128, 256, rnd, 26)
  manchas(g, 128, 256, rnd, 10, [10, 40], 'rgba(20,26,32,0.25)')
  return repetida(THREE, canvas)
}

/** Pedra clara da capa e dos espelhos do degrau, manchada e com trincas finas. */
function texturaDePedraClara(THREE: ThreeModule, seed: number): Three.CanvasTexture {
  const [canvas, g] = tela(256, 256)
  const rnd = semente(seed)
  g.fillStyle = '#8c97a4'
  g.fillRect(0, 0, 256, 256)
  granular(g, 256, 256, rnd, 30)
  manchas(g, 256, 256, rnd, 16, [12, 50], 'rgba(30,36,44,0.28)')
  g.strokeStyle = 'rgba(30,34,40,0.5)'
  g.lineWidth = 1
  for (let k = 0; k < 5; k++) {
    let x = rnd() * 256
    let y = rnd() * 256
    g.beginPath()
    g.moveTo(x, y)
    for (let s = 0; s < 7; s++) {
      x += (rnd() - 0.5) * 18
      y += rnd() * 14
      g.lineTo(x, y)
    }
    g.stroke()
  }
  return repetida(THREE, canvas)
}

/** Lajes de pedra (2×2 por ladrilho), cada uma num tom, com juntas escuras. */
function texturaDeLajes(THREE: ThreeModule, seed: number, tomBase: number, variacao: number): Three.CanvasTexture {
  const [canvas, g] = tela(256, 256)
  const rnd = semente(seed)
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      const tom = tomBase + Math.round(rnd() * variacao)
      g.fillStyle = `rgb(${tom},${tom + 4},${tom + 10})`
      g.fillRect(i * 128, j * 128, 128, 128)
    }
  }
  granular(g, 256, 256, rnd, 28)
  manchas(g, 256, 256, rnd, 14, [14, 60], 'rgba(0,0,0,0.3)')
  g.fillStyle = 'rgba(12,14,18,0.85)'
  for (const p of [0, 128]) {
    g.fillRect(p, 0, 3, 256)
    g.fillRect(0, p, 256, 3)
  }
  return repetida(THREE, canvas)
}

/** Terra escura com capim ralo. */
function texturaDeTerra(THREE: ThreeModule, seed: number): Three.CanvasTexture {
  const [canvas, g] = tela(256, 256)
  const rnd = semente(seed)
  g.fillStyle = '#1a201b'
  g.fillRect(0, 0, 256, 256)
  manchas(g, 256, 256, rnd, 18, [20, 70], 'rgba(40,52,38,0.4)')
  manchas(g, 256, 256, rnd, 12, [16, 50], 'rgba(6,8,6,0.45)')
  g.strokeStyle = 'rgba(58,74,52,0.7)'
  g.lineWidth = 1
  g.beginPath()
  for (let k = 0; k < 260; k++) {
    const x = rnd() * 256
    const y = rnd() * 256
    g.moveTo(x, y)
    g.lineTo(x + (rnd() - 0.5) * 3, y - 2 - rnd() * 5)
  }
  g.stroke()
  granular(g, 256, 256, rnd, 18)
  return repetida(THREE, canvas)
}

/** Sebe aparada: verde quase preto com folhinhas mais claras. */
function texturaDeFolhagem(THREE: ThreeModule, seed: number): Three.CanvasTexture {
  const [canvas, g] = tela(128, 128)
  const rnd = semente(seed)
  g.fillStyle = '#132018'
  g.fillRect(0, 0, 128, 128)
  for (const [cor, n] of [
    ['rgba(34,54,38,0.9)', 160],
    ['rgba(52,76,54,0.8)', 70],
  ] as const) {
    g.fillStyle = cor
    for (let k = 0; k < n; k++) g.fillRect(rnd() * 128, rnd() * 128, 2 + rnd() * 2, 2)
  }
  granular(g, 128, 128, rnd, 16)
  return repetida(THREE, canvas)
}

/** Ruído macio de neblina: bolhas brancas transparentes, mais densas embaixo, que se repetem na horizontal. */
function texturaDeNevoa(THREE: ThreeModule, seed: number): Three.CanvasTexture {
  const [canvas, g] = tela(256, 128)
  const rnd = semente(seed)
  g.clearRect(0, 0, 256, 128)
  for (let k = 0; k < 46; k++) {
    const x = rnd() * 256
    const y = 40 + rnd() * 60
    const r = 18 + rnd() * 34
    for (const dx of [-256, 0, 256]) {
      const grd = g.createRadialGradient(x + dx, y, 0, x + dx, y, r)
      grd.addColorStop(0, 'rgba(255,255,255,0.22)')
      grd.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = grd
      g.fillRect(0, 0, 256, 128)
    }
  }
  // Some nas bordas de cima e de baixo: o plano não pode mostrar a aresta.
  g.globalCompositeOperation = 'destination-in'
  const borda = g.createLinearGradient(0, 0, 0, 128)
  borda.addColorStop(0, 'rgba(0,0,0,0)')
  borda.addColorStop(0.35, 'rgba(0,0,0,1)')
  borda.addColorStop(0.8, 'rgba(0,0,0,1)')
  borda.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = borda
  g.fillRect(0, 0, 256, 128)
  g.globalCompositeOperation = 'source-over'
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  return tex
}

/** A lua atrás da neblina: um disco fraco com um halo largo. */
function texturaDoHalo(THREE: ThreeModule): Three.CanvasTexture {
  const [canvas, g] = tela(128, 128)
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.07, 'rgba(255,255,255,0.9)')
  grd.addColorStop(0.11, 'rgba(255,255,255,0.35)')
  grd.addColorStop(0.4, 'rgba(255,255,255,0.1)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(canvas)
}

// ---------------------------------------------------------------------------
// Quadro de tela cheia: amplia a imagem pequena, cor de 15 bits com pontilhado
// (o mesmo do "Portão pesado")
// ---------------------------------------------------------------------------

const VERTICE_DO_QUADRO = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

/**
 * Amostra o texel da imagem pequena (sem suavizar), converte para a cor da
 * tela como o three faria direto no canvas (`linearToOutputTexel`), passa um
 * granulado leve e multiplicativo (o preto continua preto) e reduz a 5 bits
 * por canal com a matriz de Bayer 4×4, alinhada aos pixels grandes.
 */
const FRAGMENTO_DO_QUADRO = /* glsl */ `
uniform sampler2D tCena;
uniform vec2 uResolucao;
uniform float uTempo;
varying vec2 vUv;

float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float acaso(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  vec2 px = floor(vUv * uResolucao);
  vec4 cor = linearToOutputTexel(texture2D(tCena, (px + 0.5) / uResolucao));
  float grao = acaso(px + floor(uTempo * 12.0) * 7.31) - 0.5;
  vec3 c = cor.rgb * (1.0 + grao * 0.14);
  c = floor(c * 31.0 + bayer4(px)) / 31.0;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`

// ---------------------------------------------------------------------------
// Som (Web Audio, sintetizado: nada de arquivo)
// ---------------------------------------------------------------------------

/** Volume de cada pisada na chegada: o pé no degrau e na laje pisa mais forte; o de juntar os pés, leve. */
const VOLUME_DOS_PASSOS = [0.5, 0.56, 0.58, 0.7, 0.66, 0.34] as const
const VOLUME_DOS_PASSOS_DENTRO = [0.44, 0.4, 0.34, 0.28] as const

interface TomDaDobradica {
  /** [frequência, Q, ganho] das ressonâncias do ferro. */
  ressonancias: ReadonlyArray<readonly [number, number, number]>
  /** Estalos por segundo parado e na velocidade máxima (atrito que gruda e solta). */
  taxa: readonly [number, number]
  volume: number
  pan: number
  semente: number
}

const DOBRADICA_DIREITA: TomDaDobradica = { ressonancias: [[720, 12, 5], [1290, 15, 4.2], [2240, 19, 3], [3350, 24, 1.6]], taxa: [16, 68], volume: 0.5, pan: 0.45, semente: 41 }
const DOBRADICA_ESQUERDA: TomDaDobradica = { ressonancias: [[650, 11, 5], [1170, 14, 4.2], [2010, 18, 3], [3020, 22, 1.6]], taxa: [14, 60], volume: 0.4, pan: -0.45, semente: 43 }

function criarSomDoPortao(kitDoMotor: KitDeSom, reduzirMovimento: boolean) {
  // Limitador na saída da cena: rangido é trem de estalos, com picos muito acima da média.
  const limitador = kitDoMotor.ctx.createDynamicsCompressor()
  limitador.threshold.value = -9
  limitador.knee.value = 6
  limitador.ratio.value = 12
  limitador.attack.value = 0.002
  limitador.release.value = 0.2
  limitador.connect(kitDoMotor.destino)
  const kit: KitDeSom = { ...kitDoMotor, destino: limitador }
  type Pista = [nome: string, quando: number, tocar: (agora: number) => void]
  const passos: Pista[] = reduzirMovimento
    ? []
    : [
        ...T.passos.map((p, i): Pista => [`passo${i}`, p, (a) => passo(kit, a, VOLUME_DOS_PASSOS[i])]),
        ...T.passosDentro.map((p, i): Pista => [`dentro${i}`, p, (a) => passo(kit, a, VOLUME_DOS_PASSOS_DENTRO[i])]),
      ]
  const pistas: Pista[] = [
    ['vento', 0, (a) => vento(kit, a)],
    ...passos,
    ['ergue', T.trinco - 0.1, (a) => raspado(kit, a, 0.1, 0.06, 0.25)],
    ['trinco', T.trinco, (a) => estaloDeFerro(kit, a, 0.7, 0.2)],
    ['trinco-assenta', T.trinco + 0.18, (a) => estaloDeFerro(kit, a, 0.22, 0.2)],
    ['dobradica-direita', T.aberturaInicio, (a) => rangido(kit, a, T.aberturaFim + 0.12 - T.aberturaInicio, velocidadeDaFolha('direita', T.aberturaInicio), DOBRADICA_DIREITA)],
    ['dobradica-esquerda', T.aberturaInicio + ATRASO_DA_ESQUERDA, (a) => rangido(kit, a, T.aberturaFim + 0.12 - T.aberturaInicio - ATRASO_DA_ESQUERDA, velocidadeDaFolha('esquerda', T.aberturaInicio + ATRASO_DA_ESQUERDA), DOBRADICA_ESQUERDA)],
    ['assenta', T.aberturaFim + 0.02, (a) => tilintar(kit, a, 7, 0.045)],
  ]
  if (!reduzirMovimento) {
    // O balanço do fim arranca um "iic" curto quando a folha volta.
    const volta = T.aberturaFim + BALANCO.periodo * 0.42
    pistas.push(['volta', volta, (a) => rangido(kit, a, 0.42, curvaDeSino(24), { ...DOBRADICA_DIREITA, volume: 0.2, taxa: [14, 34] })])
  }
  const tocadas = new Set<string>()
  return {
    atualizar(t: number) {
      for (const [nome, quando, tocar] of pistas) {
        if (t >= quando && !tocadas.has(nome)) {
          tocadas.add(nome)
          tocar(kit.ctx.currentTime)
        }
      }
    },
    reiniciar: () => tocadas.clear(),
  }
}

/** Velocidade da folha (0 a 1) amostrada do próprio movimento: o rangido acompanha a folha. */
function velocidadeDaFolha(lado: LadoDaFolha, inicio: number): Float32Array {
  const N = 96
  const fim = T.aberturaFim + 0.12
  const v = new Float32Array(N)
  let maior = 0
  for (let i = 0; i < N; i++) {
    const t = inicio + ((fim - inicio) * i) / (N - 1)
    v[i] = Math.max(0, anguloDaFolha(t + 0.01, lado, true) - anguloDaFolha(t - 0.01, lado, true))
    maior = Math.max(maior, v[i])
  }
  for (let i = 0; i < N; i++) v[i] = maior > 0 ? v[i] / maior : 0
  return v
}

function curvaDeSino(n: number): Float32Array {
  const v = new Float32Array(n)
  for (let i = 0; i < n; i++) v[i] = Math.sin((Math.PI * i) / (n - 1))
  return v
}

/**
 * Rangido de dobradiça: trem de estalos (dente-de-serra lenta) excitando
 * ressonâncias estreitas do ferro. Taxa, tom e volume seguem a velocidade da
 * folha: o "iiinc" sobe quando ela embala e cai quando ela freia; uma oscilação
 * lenta faz o atrito gaguejar sem trancar.
 */
function rangido(kit: KitDeSom, at: number, dur: number, velocidade: Float32Array, tom: TomDaDobradica) {
  const { ctx } = kit
  const n = velocidade.length
  const rnd = semente(tom.semente)
  const fase = rnd() * 6
  const oscila = (i: number) => 0.6 * Math.sin(i * 0.43 + fase) + 0.4 * Math.sin(i * 1.27 + fase * 2.1)
  const taxa = new Float32Array(n)
  const envelope = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const v = velocidade[i]
    taxa[i] = tom.taxa[0] + (tom.taxa[1] - tom.taxa[0]) * Math.pow(v, 0.9) + 4 * oscila(i)
    envelope[i] = tom.volume * Math.pow(v, 0.7) * (0.78 + 0.22 * oscila(i * 1.6))
  }
  envelope[0] = 0
  envelope[n - 1] = 0
  const fonte = ctx.createOscillator()
  fonte.type = 'sawtooth'
  fonte.frequency.setValueCurveAtTime(taxa, at, dur)
  // Só a curva no ganho: outro evento no mesmo instante faria o setValueCurveAtTime recusar.
  const env = ctx.createGain()
  env.gain.value = 0
  env.gain.setValueCurveAtTime(envelope, at, dur)
  const pan = ctx.createStereoPanner()
  pan.pan.value = tom.pan
  env.connect(pan).connect(kit.destino)
  for (const [freq, q, ganho] of tom.ressonancias) {
    const curva = new Float32Array(n)
    for (let i = 0; i < n; i++) curva[i] = freq * (0.84 + 0.3 * velocidade[i] + 0.04 * oscila(i * 0.7))
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = q
    bp.frequency.setValueCurveAtTime(curva, at, dur)
    const g = ctx.createGain()
    g.gain.value = ganho
    fonte.connect(bp).connect(g).connect(env)
  }
  fonte.start(at)
  fonte.stop(at + dur + 0.05)
}

/** Estalo de ferro: parciais inarmônicas que somem rápido, um tapa de ruído e um corpo grave curto. */
function estaloDeFerro(kit: KitDeSom, at: number, forca: number, panValor: number) {
  const { ctx } = kit
  const pan = ctx.createStereoPanner()
  pan.pan.value = panValor
  pan.connect(kit.destino)
  const parciais: ReadonlyArray<readonly [number, number, number]> = [
    [610, 0.3, 0.22],
    [1460, 0.22, 0.2],
    [2330, 0.16, 0.15],
    [3190, 0.12, 0.1],
    [4870, 0.07, 0.06],
  ]
  for (const [freq, decai, amp] of parciais) {
    const o = ctx.createOscillator()
    o.frequency.value = freq
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(amp * forca, at + 0.003)
    g.gain.exponentialRampToValueAtTime(0.0001, at + decai * 3)
    o.connect(g).connect(pan)
    o.start(at)
    o.stop(at + decai * 3 + 0.02)
  }
  const tapa = ctx.createBufferSource()
  tapa.buffer = kit.ruido(0.08)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 2600
  bp.Q.value = 0.9
  const gt = ctx.createGain()
  gt.gain.setValueAtTime(0.0001, at)
  gt.gain.exponentialRampToValueAtTime(0.5 * forca, at + 0.002)
  gt.gain.exponentialRampToValueAtTime(0.0001, at + 0.06)
  tapa.connect(bp).connect(gt).connect(pan)
  tapa.start(at)
  const corpo = ctx.createOscillator()
  corpo.frequency.setValueAtTime(130, at)
  corpo.frequency.exponentialRampToValueAtTime(70, at + 0.14)
  const gc = ctx.createGain()
  gc.gain.setValueAtTime(0.0001, at)
  gc.gain.exponentialRampToValueAtTime(0.35 * forca, at + 0.006)
  gc.gain.exponentialRampToValueAtTime(0.0001, at + 0.18)
  corpo.connect(gc).connect(pan)
  corpo.start(at)
  corpo.stop(at + 0.2)
}

/** Raspado curto de ferro em ferro (a barra do trinco subindo). */
function raspado(kit: KitDeSom, at: number, dur: number, volume: number, panValor: number) {
  const { ctx } = kit
  const s = ctx.createBufferSource()
  s.buffer = kit.ruido(dur)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.setValueAtTime(2400, at)
  bp.frequency.linearRampToValueAtTime(3600, at + dur)
  bp.Q.value = 6
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(volume, at + dur * 0.4)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  const pan = ctx.createStereoPanner()
  pan.pan.value = panValor
  s.connect(bp).connect(g).connect(pan).connect(kit.destino)
  s.start(at)
}

/** As barras chacoalhando baixinho quando as folhas param. */
function tilintar(kit: KitDeSom, at: number, quantos: number, volume: number) {
  const { ctx } = kit
  const rnd = semente(97)
  for (let k = 0; k < quantos; k++) {
    const quando = at + k * 0.05 + rnd() * 0.04
    const o = ctx.createOscillator()
    o.frequency.value = 2100 + rnd() * 2600
    const g = ctx.createGain()
    const v = volume * (1 - k / (quantos + 1))
    g.gain.setValueAtTime(0.0001, quando)
    g.gain.exponentialRampToValueAtTime(v, quando + 0.003)
    g.gain.exponentialRampToValueAtTime(0.0001, quando + 0.09)
    const pan = ctx.createStereoPanner()
    pan.pan.value = (rnd() - 0.5) * 1.2
    o.connect(g).connect(pan).connect(kit.destino)
    o.start(quando)
    o.stop(quando + 0.1)
  }
}

/**
 * Vento frio de noite: ruído grave que respira em rajadas lentas e um assobio
 * fraco; cresce um pouco quando a câmera entra na neblina e some no fim.
 */
function vento(kit: KitDeSom, at: number) {
  const { ctx } = kit
  const fim = at + T.duracao - 0.04
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(0.12, at + 1.2)
  g.gain.setValueAtTime(0.12, at + T.neblinaInicio)
  g.gain.linearRampToValueAtTime(0.19, at + T.neblinaFim)
  g.gain.exponentialRampToValueAtTime(0.0001, fim)
  g.connect(kit.destino)
  const rajada = ctx.createOscillator()
  rajada.frequency.value = 0.13
  const rajadaGanho = ctx.createGain()
  rajadaGanho.gain.value = 170
  rajada.connect(rajadaGanho)
  for (const [pan, deslocamento] of [
    [-0.4, 0],
    [0.4, 1.37],
  ] as const) {
    const s = ctx.createBufferSource()
    s.buffer = kit.ruido(3)
    s.loop = true
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 420
    lp.Q.value = 0.6
    rajadaGanho.connect(lp.frequency)
    const p = ctx.createStereoPanner()
    p.pan.value = pan
    s.connect(lp).connect(p).connect(g)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1150 + pan * 120
    bp.Q.value = 9
    const assobio = ctx.createGain()
    assobio.gain.value = 0.18
    s.connect(bp).connect(assobio).connect(p)
    s.start(at, deslocamento)
    s.stop(fim + 0.05)
  }
  rajada.start(at)
  rajada.stop(fim + 0.05)
}

/** Passo em pedra: baque grave da sola e um raspado. */
function passo(kit: KitDeSom, at: number, volume: number) {
  const { ctx } = kit
  const s = ctx.createBufferSource()
  s.buffer = kit.ruido(0.2)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 420
  const g = ctx.createGain()
  g.gain.setValueAtTime(volume, at)
  g.gain.exponentialRampToValueAtTime(0.001, at + 0.16)
  s.connect(lp).connect(g).connect(kit.destino)
  s.start(at)
  const raspa = ctx.createBufferSource()
  raspa.buffer = kit.ruido(0.08)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 1800
  bp.Q.value = 2
  const gr = ctx.createGain()
  gr.gain.setValueAtTime(volume * 0.35, at + 0.01)
  gr.gain.exponentialRampToValueAtTime(0.001, at + 0.07)
  raspa.connect(bp).connect(gr).connect(kit.destino)
  raspa.start(at + 0.01)
}
