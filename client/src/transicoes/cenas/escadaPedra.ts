import type { CriarCena, KitDeSom } from '../tipos'
import { descartarCena, texturaDePedra } from '../texturas'
import { clamp01, easeInOutSine, span } from '../curvas'

// Escadaria larga de pedra, degraus fundos.
const STEPS = 34
const RISE = 0.2
const RUN = 0.33
const WIDTH = 4.6
const EYE = 1.25
/** Descendo, de pé e olhando para baixo: o olho fica mais alto que na subida. */
const EYE_DESCENDO = 1.6

// Passos lentos e pesados.
const STEP_DUR = 1.05
const FLOOR_STEPS = 2
const CLIMB_STEPS = 8
const WALK_START = 1.0
const TOTAL_STEPS = FLOOR_STEPS + CLIMB_STEPS
const WALK_END = WALK_START + TOTAL_STEPS * STEP_DUR
const FADE_IN = 1.1
const FADE_OUT_START = WALK_END - 0.9
const FADE_OUT_END = WALK_END + 0.2
const START_Z = 1.2 + FLOOR_STEPS * RUN
/** Fração do passo em que o corpo avança; o resto é o pé batendo e o peso assentando. */
const LIFT = 0.62

/** 1 = subindo (a escada cresce à frente), -1 = descendo (afunda à frente). */
type Sentido = 1 | -1

/** Altura do piso sob a posição z. */
function floorAt(z: number, sentido: Sentido): number {
  if (z > 0) return 0
  return sentido * Math.min(STEPS, Math.floor(-z / RUN) + 1) * RISE
}

interface Pose {
  z: number
  y: number
  roll: number
  sway: number
}

/**
 * Um passo: o corpo avança e sobe, o pé bate e o peso afunda a câmera, que
 * volta devagar. É esse afundar que faz o passo "pesar".
 */
function stepPose(k: number, u: number, sentido: Sentido): Pose {
  const zFrom = START_Z - k * RUN
  const zTo = zFrom - RUN
  const m = easeInOutSine(clamp01(u / LIFT))
  const z = zFrom + (zTo - zFrom) * m
  const yFrom = floorAt(zFrom - 0.01, sentido)
  const yTo = floorAt(zTo - 0.01, sentido)
  const arc = Math.sin(Math.PI * clamp01(u / LIFT)) * 0.035
  const after = Math.max(0, u - LIFT) / (1 - LIFT)
  const dip = u > LIFT ? -0.075 * Math.sin(Math.PI * Math.min(1, after * 1.6)) * Math.exp(-after * 1.5) : 0
  const side = k % 2 === 0 ? 1 : -1
  return { z, y: yFrom + (yTo - yFrom) * m + arc + dip, roll: side * 0.012 * Math.sin(Math.PI * u), sway: side * 0.03 * Math.sin(Math.PI * u) }
}

function poseAt(t: number, sentido: Sentido): Pose {
  const w = (t - WALK_START) / STEP_DUR
  if (w < 0) return { z: START_Z, y: 0, roll: 0, sway: 0 }
  if (w >= TOTAL_STEPS) return stepPose(TOTAL_STEPS - 1, 1, sentido)
  const k = Math.floor(w)
  return stepPose(k, w - k, sentido)
}

/**
 * Escadaria larga de pedra, subindo ou descendo. Subindo, a câmera baixa vê
 * os espelhos de frente (a referência do usuário); descendo, olha para baixo e
 * vê os pisos sumindo no escuro.
 */
function criarEscadaria(sentido: Sentido): CriarCena {
  return (THREE, { reduzirMovimento }) => {
    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x000000, sentido === 1 ? 0.24 : 0.2)
    const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 40)
    scene.add(camera)

    // Luz de cima e à frente: acende o piso dos degraus e deixa os espelhos no
    // escuro — é o que desenha as faixas.
    scene.add(new THREE.AmbientLight(0x0d0d0f, 0.3))
    const top = new THREE.DirectionalLight(0xb8bcc4, sentido === 1 ? 0.5 : 0.75)
    if (sentido === 1) {
      top.position.set(0.6, 6, -2)
      top.target.position.set(0, 0, -6)
    } else {
      top.position.set(0.6, 5, 2)
      top.target.position.set(0, -3, -5)
    }
    scene.add(top, top.target)
    const fill = new THREE.SpotLight(0xd8d2c6, 0.6, 7, Math.PI / 3.5, 0.95, 2)
    fill.position.set(0, 0.2, 0)
    camera.add(fill)
    const fillTarget = new THREE.Object3D()
    fillTarget.position.set(0, -1.2, -4)
    camera.add(fillTarget)
    fill.target = fillTarget

    const treadTex = texturaDePedra(THREE, '#1f1f21', 7)
    treadTex.repeat.set(3, 1)
    const treadMat = new THREE.MeshStandardMaterial({ map: treadTex, roughness: 0.95 })
    const riserTex = texturaDePedra(THREE, '#0b0b0c', 19)
    riserTex.repeat.set(3, 1)
    const riserMat = new THREE.MeshStandardMaterial({ map: riserTex, roughness: 1 })
    const noseMat = new THREE.MeshStandardMaterial({ color: 0x262628, roughness: 0.9 })

    // Patamar: a mesma pedra, repetida na profundidade também (a do degrau esticaria em riscos).
    const floorTex = texturaDePedra(THREE, '#1f1f21', 29)
    floorTex.repeat.set(3, 6)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(WIDTH + 6, 8), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.95 }))
    floor.rotation.x = -Math.PI / 2
    floor.position.set(0, 0, 4)
    floor.receiveShadow = true
    scene.add(floor)

    // Degrau i: piso em y=(i+1)*RISE, de z=-i*RUN até z=-(i+1)*RUN. Faces da
    // caixa: +x, -x, +y (piso), -y, +z (espelho), -z.
    const faces = [riserMat, riserMat, treadMat, treadMat, riserMat, riserMat]
    // Descendo, o corpo vai do piso do degrau até bem abaixo do último.
    const fundo = -(STEPS + 2) * RISE
    for (let i = 0; i < STEPS; i++) {
      const y = sentido * (i + 1) * RISE
      const zFront = -i * RUN
      const base = sentido === 1 ? 0 : fundo
      const body = new THREE.Mesh(new THREE.BoxGeometry(WIDTH, y - base, RUN), faces)
      body.position.set(0, (y + base) / 2, zFront - RUN / 2)
      body.receiveShadow = true
      body.castShadow = true
      scene.add(body)
      const nose = new THREE.Mesh(new THREE.BoxGeometry(WIDTH, 0.035, 0.05), noseMat)
      // Bocel na quina que aparece: subindo, a de frente; descendo, a de trás (a borda do degrau).
      nose.position.set(0, y - 0.0175, sentido === 1 ? zFront + 0.02 : zFront - RUN - 0.02)
      nose.castShadow = true
      nose.receiveShadow = true
      scene.add(nose)
    }

    function atualizar(t: number) {
      const pose = poseAt(t, sentido)
      const roll = reduzirMovimento ? 0 : pose.roll
      const sway = reduzirMovimento ? 0 : pose.sway
      camera.position.set(sway, pose.y + (sentido === 1 ? EYE : EYE_DESCENDO), pose.z)
      // Subindo, quase reto (os espelhos de frente); descendo, de olho no próximo degrau.
      camera.rotation.set(sentido === 1 ? 0.04 : -0.85, 0, roll, 'YXZ')
      const fIn = 1 - span(t, 0, FADE_IN)
      const fOut = span(t, FADE_OUT_START, FADE_OUT_END)
      return { fade: Math.max(fIn, fOut) }
    }

    function ajustarTela(aspecto: number) {
      camera.aspect = aspecto
      camera.fov = aspecto < 0.8 ? 66 : 50
      camera.updateProjectionMatrix()
    }

    function criarSom(kit: KitDeSom) {
      // Eco de salão de pedra: atraso com realimentação e agudos cortados.
      const eco = kit.ctx.createDelay(1)
      eco.delayTime.value = 0.23
      const retorno = kit.ctx.createGain()
      retorno.gain.value = 0.38
      const abafa = kit.ctx.createBiquadFilter()
      abafa.type = 'lowpass'
      abafa.frequency.value = 900
      eco.connect(abafa).connect(retorno).connect(eco)
      const molhado = kit.ctx.createGain()
      molhado.gain.value = 0.55
      abafa.connect(molhado).connect(kit.destino)
      let ultimo = -1
      return {
        atualizar(t: number) {
          const w = (t - WALK_START) / STEP_DUR
          if (w < 0 || w >= TOTAL_STEPS) return
          const k = Math.floor(w)
          if (k !== ultimo && w - k >= LIFT) {
            ultimo = k
            passoNaPedra(kit, eco, kit.ctx.currentTime, k >= FLOOR_STEPS)
          }
        },
        reiniciar: () => {
          ultimo = -1
        },
      }
    }

    return { scene, camera, atualizar, ajustarTela, criarSom, descartar: () => descartarCena(scene) }
  }
}

export const criarCenaEscadaPedra: CriarCena = criarEscadaria(1)
export const criarCenaEscadaPedraDescendo: CriarCena = criarEscadaria(-1)

/** Bota em pedra: baque fundo + estalo de sola + raspar de areia. */
function passoNaPedra(kit: KitDeSom, eco: AudioNode, at: number, pesado: boolean) {
  const { ctx } = kit
  const out = ctx.createGain()
  out.gain.value = pesado ? 1 : 0.85
  out.connect(kit.destino)
  out.connect(eco)

  const baque = ctx.createOscillator()
  baque.type = 'sine'
  baque.frequency.setValueAtTime(95, at)
  baque.frequency.exponentialRampToValueAtTime(34, at + 0.22)
  const bg = ctx.createGain()
  bg.gain.setValueAtTime(0.0001, at)
  bg.gain.exponentialRampToValueAtTime(0.9, at + 0.008)
  bg.gain.exponentialRampToValueAtTime(0.0001, at + 0.32)
  baque.connect(bg).connect(out)
  baque.start(at)
  baque.stop(at + 0.35)

  const sola = ctx.createBufferSource()
  sola.buffer = kit.ruido(0.06)
  const sf = ctx.createBiquadFilter()
  sf.type = 'bandpass'
  sf.frequency.value = 1800
  sf.Q.value = 1.4
  const sg = ctx.createGain()
  sg.gain.setValueAtTime(0.35, at)
  sg.gain.exponentialRampToValueAtTime(0.001, at + 0.05)
  sola.connect(sf).connect(sg).connect(out)
  sola.start(at)

  const areia = ctx.createBufferSource()
  areia.buffer = kit.ruido(0.25)
  const af = ctx.createBiquadFilter()
  af.type = 'highpass'
  af.frequency.value = 2500
  const ag = ctx.createGain()
  ag.gain.setValueAtTime(0.0001, at + 0.03)
  ag.gain.exponentialRampToValueAtTime(0.06, at + 0.07)
  ag.gain.exponentialRampToValueAtTime(0.0001, at + 0.22)
  areia.connect(af).connect(ag).connect(out)
  areia.start(at + 0.03)
}

/** Fim da animação (tela já preta), em segundos — bate com `duracaoNaturalS` do catálogo. */
export const ESCADA_PEDRA_FIM_S = FADE_OUT_END
