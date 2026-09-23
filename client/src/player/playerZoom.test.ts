import { describe, expect, it } from 'vitest'
import { MAX_SCALE, MIN_SCALE, type Camera, type Point } from '../pixi/world'
import { theme } from '../theme'
import {
  NO_TOUCH,
  ZOOM_STEP_FACTOR,
  ZOOM_STEP_MS,
  fingerDown,
  fingerMove,
  fingerUp,
  rebasePinch,
  steppedScale,
  zoomAnimationFrame,
  zoomLimits,
  zoomStepAnimation,
  zoomStepNow,
  type TouchState,
} from './playerZoom'

function worldAt(camera: Camera, screen: Point): Point {
  return { x: (screen.x - camera.x) / camera.scale, y: (screen.y - camera.y) / camera.scale }
}

/** Enquadramento do mapa de 600×500 num celular de 360×740 (escala 0,52), como a câmera do jogador nasce. */
const INICIAL: Camera = { x: 24, y: 240, scale: 0.52 }
const CENTRO = { x: 180, y: 370 }

describe('degrau dos botões + e −', () => {
  it('cada toque multiplica (ou divide) a escala por √2: dois toques no + dobram o mapa na tela', () => {
    expect(ZOOM_STEP_FACTOR).toBeCloseTo(Math.SQRT2, 12)
    const um = steppedScale(0.52, 1)
    const dois = steppedScale(um, 1)
    expect(um / 0.52).toBeGreaterThan(1.15)
    expect(dois / 0.52).toBeCloseTo(2, 9)
    expect(steppedScale(dois, -1)).toBeCloseTo(um, 12)
  })

  it('para nos limites da roda do mouse', () => {
    expect(steppedScale(MAX_SCALE / 1.1, 1)).toBe(MAX_SCALE)
    expect(steppedScale(MIN_SCALE * 1.1, -1)).toBe(MIN_SCALE)
  })

  it('limites: no máximo não aproxima, no mínimo não afasta, no meio faz os dois', () => {
    expect(zoomLimits(1)).toEqual({ canZoomIn: true, canZoomOut: true })
    expect(zoomLimits(MAX_SCALE)).toEqual({ canZoomIn: false, canZoomOut: true })
    expect(zoomLimits(MIN_SCALE)).toEqual({ canZoomIn: true, canZoomOut: false })
  })
})

describe('degrau animado', () => {
  it('dura o motion.base do tema, abaixo de 300 ms', () => {
    expect(ZOOM_STEP_MS).toBe(Number.parseFloat(theme.motion.base))
    expect(ZOOM_STEP_MS).toBeLessThan(300)
  })

  it('parte da câmera de agora e mira um degrau acima, em volta do centro da tela', () => {
    const passo = zoomStepAnimation(INICIAL, null, CENTRO, 1, 1000)
    expect(passo).not.toBeNull()
    if (passo === null) return
    expect(passo.from).toBe(INICIAL.scale)
    expect(passo.to).toBeCloseTo(INICIAL.scale * Math.SQRT2, 12)
    expect(zoomAnimationFrame(passo, 1000).camera.scale).toBeCloseTo(INICIAL.scale, 12)
  })

  it('em todo quadro o ponto do mapa sob o centro fica no centro, e a escala só cresce até o alvo exato', () => {
    const passo = zoomStepAnimation(INICIAL, null, CENTRO, 1, 0)
    if (passo === null) throw new Error('deveria haver degrau')
    const sobOCentro = worldAt(INICIAL, CENTRO)
    let anterior = INICIAL.scale
    for (let t = 0; t <= ZOOM_STEP_MS; t += ZOOM_STEP_MS / 10) {
      const { camera } = zoomAnimationFrame(passo, t)
      const agora = worldAt(camera, CENTRO)
      expect(agora.x).toBeCloseTo(sobOCentro.x, 9)
      expect(agora.y).toBeCloseTo(sobOCentro.y, 9)
      expect(camera.scale).toBeGreaterThanOrEqual(anterior)
      anterior = camera.scale
    }
    const fim = zoomAnimationFrame(passo, ZOOM_STEP_MS)
    expect(fim.done).toBe(true)
    expect(fim.camera.scale).toBe(passo.to)
    expect(zoomAnimationFrame(passo, ZOOM_STEP_MS / 2).done).toBe(false)
  })

  it('sai do lugar já no primeiro terço (ease-out: responde na hora, assenta no fim)', () => {
    const passo = zoomStepAnimation(INICIAL, null, CENTRO, 1, 0)
    if (passo === null) throw new Error('deveria haver degrau')
    const terco = zoomAnimationFrame(passo, ZOOM_STEP_MS / 3).camera.scale
    const metadeDoCaminho = Math.sqrt(passo.from * passo.to)
    expect(terco).toBeGreaterThan(metadeDoCaminho)
  })

  it('dois toques rápidos dão dois degraus inteiros, sem salto: o segundo mira o alvo do primeiro × √2 e parte de onde a câmera está', () => {
    const primeiro = zoomStepAnimation(INICIAL, null, CENTRO, 1, 0)
    if (primeiro === null) throw new Error('deveria haver degrau')
    const noMeio = zoomAnimationFrame(primeiro, 50).camera
    const segundo = zoomStepAnimation(noMeio, primeiro, CENTRO, 1, 50)
    if (segundo === null) throw new Error('deveria haver degrau')
    expect(segundo.to).toBeCloseTo(INICIAL.scale * 2, 9)
    expect(segundo.from).toBe(noMeio.scale)
    const logoDepois = zoomAnimationFrame(segundo, 50).camera
    expect(logoDepois.scale).toBeCloseTo(noMeio.scale, 12)
    expect(logoDepois.x).toBeCloseTo(noMeio.x, 9)
  })

  it('+ e depois − no meio do caminho volta ao ponto de partida', () => {
    const mais = zoomStepAnimation(INICIAL, null, CENTRO, 1, 0)
    if (mais === null) throw new Error('deveria haver degrau')
    const noMeio = zoomAnimationFrame(mais, 60).camera
    const menos = zoomStepAnimation(noMeio, mais, CENTRO, -1, 60)
    expect(menos?.to).toBeCloseTo(INICIAL.scale, 12)
  })

  it('no limite não há degrau (o botão não promete o que não faz)', () => {
    const noMaximo = { x: 0, y: 0, scale: MAX_SCALE }
    expect(zoomStepAnimation(noMaximo, null, CENTRO, 1, 0)).toBeNull()
    expect(zoomStepAnimation(noMaximo, null, CENTRO, -1, 0)).not.toBeNull()
    const noMinimo = { x: 0, y: 0, scale: MIN_SCALE }
    expect(zoomStepAnimation(noMinimo, null, CENTRO, -1, 0)).toBeNull()
  })

  it('sem animação (teclado, movimento reduzido): o degrau inteiro de uma vez, igual ao fim do animado', () => {
    const animado = zoomStepAnimation(INICIAL, null, CENTRO, 1, 0)
    if (animado === null) throw new Error('deveria haver degrau')
    const fim = zoomAnimationFrame(animado, ZOOM_STEP_MS).camera
    const direto = zoomStepNow(INICIAL, null, CENTRO, 1)
    expect(direto?.scale).toBeCloseTo(fim.scale, 12)
    expect(direto?.x).toBeCloseTo(fim.x, 9)
    expect(direto?.y).toBeCloseTo(fim.y, 9)
    // Com um degrau animado andando, o direto vai ao alvo dele × √2 (não fica meio degrau atrás).
    const noMeio = zoomAnimationFrame(animado, 40).camera
    expect(zoomStepNow(noMeio, animado, CENTRO, 1)?.scale).toBeCloseTo(INICIAL.scale * 2, 9)
    expect(zoomStepNow({ x: 0, y: 0, scale: MAX_SCALE }, null, CENTRO, 1)).toBeNull()
  })
})

describe('dedos na tela', () => {
  function encostar(state: TouchState, id: number, at: Point, isPrimary = false, camera = INICIAL) {
    return fingerDown(state, id, at, isPrimary, camera)
  }

  it('um dedo segue o gesto de sempre (ficha, câmera, sinal): nada de pinça', () => {
    const { state, role } = encostar(NO_TOUCH, 7, { x: 100, y: 100 }, true)
    expect(role).toBe('single')
    expect(state.pinch).toBeNull()
    const andou = fingerMove(state, 7, { x: 150, y: 120 })
    expect(andou.camera).toBeNull()
    const soltou = fingerUp(andou.state, 7, INICIAL)
    expect(soltou.pinchEnded).toBe(false)
    expect(soltou.carry).toBeNull()
    expect(soltou.state.fingers.size).toBe(0)
  })

  it('o segundo dedo vira pinça; abrir aproxima pelo meio e fechar afasta', () => {
    let state = encostar(NO_TOUCH, 1, { x: 180, y: 370 }, true).state
    const segundo = encostar(state, 2, { x: 230, y: 370 })
    expect(segundo.role).toBe('pinch')
    state = segundo.state
    state = fingerMove(state, 1, { x: 140, y: 370 }).state
    const aberta = fingerMove(state, 2, { x: 270, y: 370 })
    expect(aberta.camera).not.toBeNull()
    const camera = aberta.camera as Camera
    expect(camera.scale / INICIAL.scale).toBeCloseTo(130 / 50, 9)
    const meio = { x: 205, y: 370 }
    expect(worldAt(camera, meio).x).toBeCloseTo(worldAt(INICIAL, meio).x, 9)

    const fechando = fingerMove(fingerMove(aberta.state, 1, { x: 190, y: 370 }).state, 2, { x: 220, y: 370 })
    expect((fechando.camera as Camera).scale).toBeLessThan(INICIAL.scale)
  })

  it('soltar um dos dois acaba a pinça; o outro dedo segue na tela, com a posição de agora', () => {
    let state = encostar(NO_TOUCH, 1, { x: 100, y: 300 }, true).state
    state = encostar(state, 2, { x: 200, y: 300 }).state
    state = fingerMove(state, 2, { x: 260, y: 310 }).state
    const soltou = fingerUp(state, 1, INICIAL)
    expect(soltou.pinchEnded).toBe(true)
    expect(soltou.state.pinch).toBeNull()
    expect(soltou.carry).toEqual({ id: 2, at: { x: 260, y: 310 } })
    // O último dedo sai: nada mais a encerrar.
    const fim = fingerUp(soltou.state, 2, INICIAL)
    expect(fim.pinchEnded).toBe(false)
    expect(fim.state.fingers.size).toBe(0)
  })

  it('terceiro dedo é ignorado; se um dos dois da pinça sai, ela continua com os que ficaram, sem salto', () => {
    let state = encostar(NO_TOUCH, 1, { x: 100, y: 300 }, true).state
    state = encostar(state, 2, { x: 200, y: 300 }).state
    const terceiro = encostar(state, 3, { x: 150, y: 500 })
    expect(terceiro.role).toBe('extra')
    expect(fingerMove(terceiro.state, 3, { x: 150, y: 560 }).camera).toBeNull()
    const camera = { x: 10, y: 20, scale: 1.3 }
    const saiu = fingerUp(terceiro.state, 1, camera)
    expect(saiu.pinchEnded).toBe(false)
    expect(saiu.state.pinch?.ids).toEqual([2, 3])
    // Parado onde está: a câmera recomeça exatamente de onde estava.
    const parado = fingerMove(saiu.state, 3, { x: 150, y: 500 })
    expect(parado.camera?.scale).toBeCloseTo(camera.scale, 12)
    expect(parado.camera?.x).toBeCloseTo(camera.x, 9)
    expect(parado.camera?.y).toBeCloseTo(camera.y, 9)
  })

  it('o primeiro dedo de um gesto novo esquece dedo que o navegador cancelou sem avisar', () => {
    const esquecido = encostar(NO_TOUCH, 4, { x: 10, y: 10 }, true).state
    const novo = encostar(esquecido, 9, { x: 300, y: 300 }, true)
    expect(novo.role).toBe('single')
    expect([...novo.state.fingers.keys()]).toEqual([9])
  })

  it('dedo que não está na conta não mexe em nada', () => {
    let state = encostar(NO_TOUCH, 1, { x: 100, y: 300 }, true).state
    state = encostar(state, 2, { x: 200, y: 300 }).state
    expect(fingerMove(state, 99, { x: 0, y: 0 }).camera).toBeNull()
    const solto = fingerUp(state, 99, INICIAL)
    expect(solto.pinchEnded).toBe(false)
    expect(solto.state).toBe(state)
  })

  it('a câmera muda por fora no meio da pinça (viagem, centralizar): a pinça segue da câmera nova, sem voltar à velha', () => {
    let state = encostar(NO_TOUCH, 1, { x: 100, y: 300 }, true).state
    state = encostar(state, 2, { x: 200, y: 300 }).state
    const nova = { x: -500, y: 80, scale: 2 }
    state = rebasePinch(state, nova)
    const parado = fingerMove(state, 2, { x: 200, y: 300 })
    expect(parado.camera?.scale).toBeCloseTo(nova.scale, 12)
    expect(parado.camera?.x).toBeCloseTo(nova.x, 9)
    expect(rebasePinch(NO_TOUCH, nova)).toBe(NO_TOUCH)
  })
})
