import type * as Three from 'three'
import { duracaoEfetivaS, transicaoInfo, type TransicaoEscolhida, type TransicaoId } from './catalogo'
import type { CenaTransicao, CriarCena, KitDeSom, ThreeModule } from './tipos'

/**
 * Motor das transições especiais: carrega `three` sob demanda, monta a cena do
 * catálogo num canvas, toca no tempo escolhido e avisa o fim.
 *
 * Nada aqui pode prender o jogo: sem WebGL, sem `three` ou com erro na cena,
 * `onFim` sai na hora e o jogador cai direto no mapa.
 */

let threeCarregando: Promise<ThreeModule> | null = null

/** Baixa `three` uma vez só; o chunk fica fora do bundle principal. */
export function carregarThree(): Promise<ThreeModule> {
  if (!threeCarregando) {
    threeCarregando = import('three').then((THREE) => {
      // As cenas foram afinadas no modelo de cor antigo (cor e textura lidas
      // como lineares): desligar o gerenciamento mantém o mesmo tom.
      THREE.ColorManagement.enabled = false
      return THREE
    })
    threeCarregando.catch(() => {
      threeCarregando = null
    })
  }
  return threeCarregando
}

async function fabricaDaCena(id: TransicaoId): Promise<CriarCena> {
  switch (id) {
    case 'porta':
      return (await import('./cenas/porta')).criarCenaPorta
    case 'escada-pedra':
      return (await import('./cenas/escadaPedra')).criarCenaEscadaPedra
  }
}

/**
 * As luzes foram afinadas no three antigo (r128, unidades "legadas"). No atual,
 * luz pontual e holofote caem com o quadrado da distância e saem bem mais
 * fracas; ambiente e direcional ficaram parecidas. Fator medido no olho,
 * comparando quadros com as páginas originais.
 */
const FATOR_LUZ_PONTUAL = Math.PI * 3.5

function converterLuzesLegadas(scene: Three.Scene): void {
  scene.traverse((obj) => {
    if ((obj as Three.SpotLight).isSpotLight || (obj as Three.PointLight).isPointLight) (obj as Three.Light).intensity *= FATOR_LUZ_PONTUAL
  })
}

function criarRenderer(THREE: ThreeModule, canvas: HTMLCanvasElement, guardarQuadro: boolean): Three.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: guardarQuadro })
  renderer.setClearColor(0x000000, 1)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  return renderer
}

export interface OpcoesDeTocar {
  canvas: HTMLCanvasElement
  escolha: TransicaoEscolhida
  /** 0 a 1; 0 = mudo. Pode mudar depois com `definirVolume`. */
  volume: number
  reduzirMovimento: boolean
  /** Prévia do mestre: recomeça sozinha. No jogo: toca uma vez e chama `onFim`. */
  repetir?: boolean
  /** Opacidade da cortina preta (fade da própria cena), a cada quadro. */
  onFade?: (opacidade: number) => void
  onFim: () => void
}

export interface ControleDeTransicao {
  parar: () => void
  definirVolume: (volume: number) => void
}

/** Toca uma transição. Resolve com o controle; qualquer falha vira `onFim` imediato. */
export async function tocarTransicao(opcoes: OpcoesDeTocar): Promise<ControleDeTransicao> {
  const { canvas, escolha, reduzirMovimento, repetir = false, onFade, onFim } = opcoes
  let parado = false
  let fimAvisado = false
  const avisarFim = () => {
    if (fimAvisado) return
    fimAvisado = true
    onFim()
  }
  const controleVazio: ControleDeTransicao = { parar: () => (parado = true), definirVolume: () => undefined }

  let THREE: ThreeModule
  let renderer: Three.WebGLRenderer
  let cena: CenaTransicao
  try {
    THREE = await carregarThree()
    const criar = await fabricaDaCena(escolha.id)
    renderer = criarRenderer(THREE, canvas, false)
    cena = criar(THREE, { reduzirMovimento })
    converterLuzesLegadas(cena.scene)
  } catch {
    avisarFim()
    return controleVazio
  }

  const natural = transicaoInfo(escolha.id).duracaoNaturalS
  const escala = natural / duracaoEfetivaS(escolha)

  // Som: contexto próprio, criado já dentro do gesto que abriu a transição
  // quando houver um; se o navegador recusar, segue mudo.
  let audio: { ctx: AudioContext; volume: GainNode; pistas: ReturnType<NonNullable<CenaTransicao['criarSom']>> } | null = null
  try {
    if (cena.criarSom && typeof AudioContext !== 'undefined') {
      const ctx = new AudioContext()
      const volume = ctx.createGain()
      volume.gain.value = opcoes.volume
      volume.connect(ctx.destination)
      const ruidos = new Map<number, AudioBuffer>()
      const kit: KitDeSom = {
        ctx,
        destino: volume,
        ruido: (segundos) => {
          const pronto = ruidos.get(segundos)
          if (pronto) return pronto
          const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * segundos), ctx.sampleRate)
          const dados = buffer.getChannelData(0)
          for (let i = 0; i < dados.length; i++) dados[i] = Math.random() * 2 - 1
          ruidos.set(segundos, buffer)
          return buffer
        },
      }
      audio = { ctx, volume, pistas: cena.criarSom(kit) }
      void ctx.resume().catch(() => undefined)
    }
  } catch {
    audio = null
  }

  const ajustar = () => {
    const largura = canvas.clientWidth || 1
    const altura = canvas.clientHeight || 1
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(largura, altura, false)
    cena.ajustarTela(largura / altura)
  }
  ajustar()
  const observador = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(ajustar) : null
  observador?.observe(canvas)

  let inicio = performance.now()
  let quadro = 0
  const desmontar = () => {
    cancelAnimationFrame(quadro)
    observador?.disconnect()
    cena.descartar()
    renderer.dispose()
    if (audio) void audio.ctx.close().catch(() => undefined)
  }

  const tick = (agora: number) => {
    if (parado) return
    let t = ((agora - inicio) / 1000) * escala
    if (t >= natural) {
      if (repetir) {
        inicio = agora
        t = 0
        audio?.pistas.reiniciar()
      } else {
        onFade?.(1)
        desmontar()
        avisarFim()
        return
      }
    }
    try {
      const { fade } = cena.atualizar(t)
      onFade?.(fade)
      audio?.pistas.atualizar(t)
      renderer.render(cena.scene, cena.camera)
    } catch {
      desmontar()
      avisarFim()
      return
    }
    quadro = requestAnimationFrame(tick)
  }
  quadro = requestAnimationFrame(tick)

  return {
    parar: () => {
      if (parado) return
      parado = true
      desmontar()
    },
    definirVolume: (volume) => {
      if (audio) audio.volume.gain.value = volume
    },
  }
}

const miniaturas = new Map<TransicaoId, Promise<string | null>>()

/**
 * Um quadro da cena como imagem (data URL), para a galeria. Feito uma vez por
 * transição e guardado; `null` quando não há WebGL.
 */
export function miniaturaDaTransicao(id: TransicaoId): Promise<string | null> {
  const pronta = miniaturas.get(id)
  if (pronta) return pronta
  const gerando = (async () => {
    try {
      const THREE = await carregarThree()
      const criar = await fabricaDaCena(id)
      const canvas = document.createElement('canvas')
      const renderer = criarRenderer(THREE, canvas, true)
      renderer.setPixelRatio(1)
      renderer.setSize(320, 180, false)
      const cena = criar(THREE, { reduzirMovimento: false })
      converterLuzesLegadas(cena.scene)
      cena.ajustarTela(320 / 180)
      cena.atualizar(transicaoInfo(id).quadroDaMiniaturaS)
      renderer.render(cena.scene, cena.camera)
      const url = canvas.toDataURL('image/jpeg', 0.82)
      cena.descartar()
      renderer.dispose()
      renderer.forceContextLoss()
      return url
    } catch {
      return null
    }
  })()
  miniaturas.set(id, gerando)
  return gerando
}
