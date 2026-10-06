import type { CriarCena, KitDeSom } from '../tipos'
import { descartarCena, texturaDeMadeira, texturaDeReboco } from '../texturas'
import { clamp01, easeInOutCubic, easeInOutSine, easeInQuad, easeOutCubic, span } from '../curvas'

/** Roteiro em segundos: aproxima, gira a maçaneta, fresta com tranco, abre devagar, atravessa. */
const T = {
  fadeInEnd: 0.8,
  approachStart: 0.4,
  approachEnd: 2.2,
  knobStart: 1.9,
  knobEnd: 2.3,
  crackStart: 2.3,
  crackEnd: 2.65,
  swingStart: 2.95,
  swingEnd: 5.6,
  throughStart: 3.9,
  throughEnd: 6.9,
  fadeOutStart: 6.4,
  fadeOutEnd: 7.2,
}
const DOOR = { w: 1.1, h: 2.25, d: 0.06, crack: 0.14, open: 1.72 }
const CAM = { y: 1.5, z0: 4.4, z1: 3.05, z2: -2.6 }

export const criarCenaPorta: CriarCena = (THREE, { reduzirMovimento }) => {
  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0x000000, 0.26)
  const camera = new THREE.PerspectiveCamera(48, 1, 0.05, 40)
  scene.add(camera)

  // Lanterna fraca presa à câmera + um fio de luz ambiente.
  scene.add(new THREE.AmbientLight(0x120e0a, 0.35))
  const lamp = new THREE.SpotLight(0xffc98a, 1.7, 10, Math.PI / 7, 0.75, 1.8)
  lamp.position.set(0.15, -0.05, 0)
  lamp.castShadow = true
  lamp.shadow.mapSize.set(1024, 1024)
  lamp.shadow.bias = -0.0005
  camera.add(lamp)
  const lampTarget = new THREE.Object3D()
  lampTarget.position.set(0, -0.1, -3)
  camera.add(lampTarget)
  lamp.target = lampTarget

  // Piso de tábuas.
  const floorTex = texturaDeMadeira(THREE, 512, 512, '#2b1d12', '#0c0805', 7)
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping
  floorTex.repeat.set(4, 8)
  floorTex.rotation = Math.PI / 2
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 20), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85, metalness: 0 }))
  floor.rotation.x = -Math.PI / 2
  floor.position.z = -4
  floor.receiveShadow = true
  scene.add(floor)

  // Parede com o vão da porta (três blocos em volta do vão).
  const wallTex = texturaDeReboco(THREE, '#1d1913', 3)
  wallTex.repeat.set(3, 2)
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 1 })
  const WALL_H = 3.4
  const WALL_W = 7
  const WALL_T = 0.25
  const gapW = DOOR.w + 0.02
  const gapH = DOOR.h + 0.01
  const sideW = (WALL_W - gapW) / 2
  const mkWall = (w: number, h: number, x: number, y: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, WALL_T), wallMat)
    m.position.set(x, y, -WALL_T / 2)
    m.receiveShadow = true
    scene.add(m)
  }
  mkWall(sideW, WALL_H, -(gapW / 2 + sideW / 2), WALL_H / 2)
  mkWall(sideW, WALL_H, gapW / 2 + sideW / 2, WALL_H / 2)
  mkWall(gapW, WALL_H - gapH, 0, gapH + (WALL_H - gapH) / 2)

  // Rodapé.
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x140d07, roughness: 0.7 })
  for (const side of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(sideW, 0.16, 0.04), baseMat)
    b.position.set(side * (gapW / 2 + sideW / 2), 0.08, 0.02)
    scene.add(b)
  }

  // Batente de madeira escura e cornija.
  const frameMat = new THREE.MeshStandardMaterial({ map: texturaDeMadeira(THREE, 128, 512, '#24160c', '#080402', 3), roughness: 0.6 })
  const FR = 0.11
  const mkFrame = (w: number, h: number, x: number, y: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, WALL_T + 0.08), frameMat)
    m.position.set(x, y, -WALL_T / 2)
    m.castShadow = true
    m.receiveShadow = true
    scene.add(m)
  }
  mkFrame(FR, gapH + FR, -(gapW / 2 + FR / 2), (gapH + FR) / 2)
  mkFrame(FR, gapH + FR, gapW / 2 + FR / 2, (gapH + FR) / 2)
  mkFrame(gapW + FR * 2, FR, 0, gapH + FR / 2)
  const corn = new THREE.Mesh(new THREE.BoxGeometry(gapW + FR * 2 + 0.16, 0.07, WALL_T + 0.16), frameMat)
  corn.position.set(0, gapH + FR + 0.035, -WALL_T / 2)
  scene.add(corn)

  // Porta: grupo-pivô na dobradiça esquerda.
  const hinge = new THREE.Group()
  hinge.position.set(-DOOR.w / 2, 0, -0.02)
  scene.add(hinge)
  const doorMat = new THREE.MeshStandardMaterial({ map: texturaDeMadeira(THREE, 256, 512, '#2c180a', '#0a0502', 21), roughness: 0.55, metalness: 0.02 })
  const slab = new THREE.Mesh(new THREE.BoxGeometry(DOOR.w, DOOR.h, DOOR.d), doorMat)
  slab.position.set(DOOR.w / 2, DOOR.h / 2, 0)
  slab.castShadow = true
  slab.receiveShadow = true
  hinge.add(slab)

  // Almofadas (painéis em relevo) dos dois lados, com molduras finas.
  const panelMat = new THREE.MeshStandardMaterial({ map: texturaDeMadeira(THREE, 128, 256, '#241309', '#080401', 5), roughness: 0.5 })
  const moldMat = new THREE.MeshStandardMaterial({ color: 0x1c1007, roughness: 0.45 })
  const panels = [
    { x: 0.29, y: 1.62, w: 0.36, h: 0.72 },
    { x: 0.81, y: 1.62, w: 0.36, h: 0.72 },
    { x: 0.29, y: 0.62, w: 0.36, h: 0.78 },
    { x: 0.81, y: 0.62, w: 0.36, h: 0.78 },
  ]
  for (const face of [1, -1]) {
    for (const p of panels) {
      const inset = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, 0.012), panelMat)
      inset.position.set(p.x, p.y, face * (DOOR.d / 2 + 0.004))
      inset.castShadow = true
      hinge.add(inset)
      const t = 0.022
      const molduras: Array<[number, number, number, number]> = [
        [p.w + t * 2, t, 0, p.h / 2 + t / 2],
        [p.w + t * 2, t, 0, -p.h / 2 - t / 2],
        [t, p.h, -p.w / 2 - t / 2, 0],
        [t, p.h, p.w / 2 + t / 2, 0],
      ]
      for (const [w, h, dx, dy] of molduras) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.02), moldMat)
        m.position.set(p.x + dx, p.y + dy, face * (DOOR.d / 2 + 0.01))
        m.castShadow = true
        hinge.add(m)
      }
    }
  }

  // Maçaneta de latão envelhecido, espelho com fechadura, dobradiças.
  const brass = new THREE.MeshStandardMaterial({ color: 0x8a6a32, roughness: 0.32, metalness: 0.9 })
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.24, 0.012), brass)
  plate.position.set(DOOR.w - 0.12, 1.02, DOOR.d / 2 + 0.006)
  hinge.add(plate)
  const keyhole = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.02, 12), new THREE.MeshBasicMaterial({ color: 0x000000 }))
  keyhole.rotation.x = Math.PI / 2
  keyhole.position.set(DOOR.w - 0.12, 0.95, DOOR.d / 2 + 0.013)
  hinge.add(keyhole)
  const knob = new THREE.Group()
  knob.position.set(DOOR.w - 0.12, 1.06, DOOR.d / 2 + 0.012)
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.02, 0.05, 16), brass)
  neck.rotation.x = Math.PI / 2
  neck.position.z = 0.025
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.036, 24, 16), brass)
  ball.scale.set(1, 1, 0.8)
  ball.position.z = 0.065
  ball.castShadow = true
  knob.add(neck, ball)
  hinge.add(knob)
  for (const y of [0.3, 1.95]) {
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.12, 10), brass)
    h.position.set(0, y, DOOR.d / 2)
    hinge.add(h)
  }

  // Do outro lado: só escuridão e uma luz fria bem ao fundo.
  const farGlow = new THREE.PointLight(0x5d7088, 0, 6, 2)
  farGlow.position.set(0.3, 1.2, -4.5)
  scene.add(farGlow)

  function atualizar(t: number) {
    const approach = easeInOutCubic(span(t, T.approachStart, T.approachEnd))
    const through = easeInQuad(span(t, T.throughStart, T.throughEnd))
    let z = CAM.z0 + (CAM.z1 - CAM.z0) * approach
    if (!reduzirMovimento) z += (CAM.z2 - CAM.z1) * through
    const walking = (t > T.approachStart && t < T.approachEnd) || (t > T.throughStart && t < T.throughEnd)
    const bob = walking && !reduzirMovimento ? Math.sin(t * 9) * 0.012 : 0
    const camZ = reduzirMovimento ? CAM.z1 : z
    camera.position.set(0.02, CAM.y + bob, camZ)
    camera.lookAt(0.05, 1.2 - through * 0.05, camZ - 4)

    const kIn = easeOutCubic(span(t, T.knobStart, T.knobStart + 0.18))
    const kOut = easeOutCubic(span(t, T.knobEnd, T.knobEnd + 0.25))
    knob.rotation.z = -0.9 * (kIn - kOut)

    const crack = easeOutCubic(span(t, T.crackStart, T.crackEnd)) * DOOR.crack
    const swing = easeInOutSine(span(t, T.swingStart, T.swingEnd)) * (DOOR.open - DOOR.crack)
    const joltWindow = t > T.crackEnd && t < T.crackEnd + 0.25
    const jolt = joltWindow ? Math.sin((t - T.crackEnd) * 60) * 0.006 * (1 - span(t, T.crackEnd, T.crackEnd + 0.25)) : 0
    hinge.rotation.y = crack + swing + jolt
    farGlow.intensity = 0.9 * clamp01((crack + swing) / DOOR.open)

    const fIn = 1 - span(t, 0, T.fadeInEnd)
    const fOut = span(t, T.fadeOutStart, T.fadeOutEnd)
    return { fade: Math.max(fIn, fOut) }
  }

  function ajustarTela(aspecto: number) {
    camera.aspect = aspecto
    camera.fov = aspecto < 0.8 ? 64 : 48
    camera.updateProjectionMatrix()
  }

  function criarSom(kit: KitDeSom) {
    const tocadas = new Set<string>()
    const pistas: Array<[string, number, (agora: number) => void]> = [
      ['passo1', 0.6, (a) => passo(kit, a)],
      ['passo2', 1.3, (a) => passo(kit, a)],
      ['trinco', T.knobStart + 0.15, (a) => trinco(kit, a)],
      ['fresta', T.crackStart, (a) => rangido(kit, a, 0.45)],
      ['abre', T.swingStart, (a) => rangido(kit, a, T.swingEnd - T.swingStart)],
      ['passo3', T.throughStart + 0.6, (a) => passo(kit, a)],
      ['passo4', T.throughStart + 1.3, (a) => passo(kit, a)],
      ['passo5', T.throughStart + 2.0, (a) => passo(kit, a)],
    ]
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

  return { scene, camera, atualizar, ajustarTela, criarSom, descartar: () => descartarCena(scene) }
}

function passo(kit: KitDeSom, at: number) {
  const src = kit.ctx.createBufferSource()
  src.buffer = kit.ruido(0.2)
  const lp = kit.ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 320
  const g = kit.ctx.createGain()
  g.gain.setValueAtTime(0.7, at)
  g.gain.exponentialRampToValueAtTime(0.001, at + 0.18)
  src.connect(lp).connect(g).connect(kit.destino)
  src.start(at)
}

function trinco(kit: KitDeSom, at: number) {
  const bp = kit.ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 2400
  bp.Q.value = 6
  bp.connect(kit.destino)
  for (const [atraso, volume] of [
    [0, 0.9],
    [0.12, 0.5],
  ] as const) {
    const src = kit.ctx.createBufferSource()
    src.buffer = kit.ruido(0.08)
    const g = kit.ctx.createGain()
    g.gain.setValueAtTime(volume, at + atraso)
    g.gain.exponentialRampToValueAtTime(0.001, at + atraso + 0.07)
    src.connect(g).connect(bp)
    src.start(at + atraso)
  }
}

/** Dobradiça: dente-de-serra com altura instável, filtrada. */
function rangido(kit: KitDeSom, at: number, dur: number) {
  const { ctx } = kit
  const osc = ctx.createOscillator()
  osc.type = 'sawtooth'
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 11
  const lfoGain = ctx.createGain()
  lfoGain.gain.value = 24
  lfo.connect(lfoGain).connect(osc.frequency)
  osc.frequency.setValueAtTime(190, at)
  osc.frequency.linearRampToValueAtTime(320, at + dur * 0.35)
  osc.frequency.linearRampToValueAtTime(150, at + dur * 0.7)
  osc.frequency.linearRampToValueAtTime(240, at + dur)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 900
  bp.Q.value = 3
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(0.18, at + 0.15)
  g.gain.setValueAtTime(0.18, at + dur * 0.8)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  osc.connect(bp).connect(g).connect(kit.destino)
  osc.start(at)
  lfo.start(at)
  osc.stop(at + dur + 0.05)
  lfo.stop(at + dur + 0.05)
}


/** Fim da animação (tela já preta), em segundos — bate com `duracaoNaturalS` do catálogo. */
export const PORTA_FIM_S = T.fadeOutEnd
