import type * as Three from 'three'
import { aberturaDeBatalhaInfo, criarCenaDaAbertura } from './aberturasDeBatalha'
import { aguardarTransicoesDeFora, criarCenaDeFora, duracaoEfetivaS, transicaoInfo, type TransicaoEscolhida, type TransicaoId, type TransicaoInfo } from './catalogo'
import type { CenaTransicao, CriarCena, KitDeSom, OpcoesDaCena, ThreeModule } from './tipos'

/**
 * Motor das transições especiais: carrega `three` sob demanda, monta a cena do
 * catálogo num canvas, toca no tempo escolhido e avisa o fim.
 *
 * Nada aqui pode prender o jogo: sem WebGL, sem `three`, transição que este
 * app não tem (pacote ainda não baixado) ou com erro na cena, `onFim` sai na
 * hora e o jogador cai direto no mapa.
 */

let threeCarregando: Promise<ThreeModule> | null = null

/** Sem WebGL (navegador velho, ambiente de teste) nem vale baixar o `three`. */
function temWebGL(): boolean {
  return typeof WebGLRenderingContext !== 'undefined'
}

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

/**
 * A fábrica da cena: embutida pelo `switch` (chunk próprio de cada cena),
 * a do pacote pelo registro do catálogo. `null` = este app não tem a transição.
 */
export async function resolverFabricaDaCena(id: TransicaoId): Promise<CriarCena | null> {
  switch (id) {
    case 'porta':
      return (await import('./cenas/porta')).criarCenaPorta
    case 'escada-pedra':
      return (await import('./cenas/escadaPedra')).criarCenaEscadaPedra
    case 'escada-pedra-descendo':
      return (await import('./cenas/escadaPedra')).criarCenaEscadaPedraDescendo
  }
  // O pacote pode estar chegando agora (o jogador atravessou logo ao conectar).
  await aguardarTransicoesDeFora()
  return criarCenaDeFora(id)
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

/** O que tocar uma cena pede, seja transição de local ou abertura de batalha. */
interface OpcoesDoPalco {
  canvas: HTMLCanvasElement
  /** 0 a 1; 0 = mudo. Pode mudar depois com `definirVolume`. */
  volume: number
  reduzirMovimento: boolean
  /** Prévia do mestre: recomeça sozinha. No jogo: toca uma vez e chama `onFim`. */
  repetir?: boolean
  /** Opacidade da cortina preta (fade da própria cena), a cada quadro. */
  onFade?: (opacidade: number) => void
  onFim: () => void
}

export interface OpcoesDeTocar extends OpcoesDoPalco {
  escolha: TransicaoEscolhida
}

export interface OpcoesDeTocarAbertura extends OpcoesDoPalco {
  /** Id da abertura no registro (`aberturasDeBatalha.ts`), ex.: "espadas-cruzadas". */
  id: string
  /** O nome que a cena mostra; ausente ou vazio = o padrão da cena ("Royals" nas espadas). */
  nome?: string
}

export interface ControleDeTransicao {
  parar: () => void
  definirVolume: (volume: number) => void
}

/** A fábrica achada e as durações; `null` = este app não tem a cena. */
interface CenaResolvida {
  criar: CriarCena
  duracaoNaturalS: number
  duracaoS: number
}

/** Toca uma transição. Resolve com o controle; qualquer falha vira `onFim` imediato. */
export function tocarTransicao(opcoes: OpcoesDeTocar): Promise<ControleDeTransicao> {
  const { escolha } = opcoes
  return tocarCena(opcoes, { reduzirMovimento: opcoes.reduzirMovimento }, async () => {
    const criar = await resolverFabricaDaCena(escolha.id)
    const info = transicaoInfo(escolha.id)
    if (criar === null || info === undefined) return null
    return { criar, duracaoNaturalS: info.duracaoNaturalS, duracaoS: duracaoEfetivaS(escolha, info) }
  })
}

/**
 * Toca uma abertura de batalha do pacote, sempre na duração natural, com o
 * `nome` chegando à cena por `OpcoesDaCena`. Abertura que este app não tem
 * (pacote ainda não baixado, app antigo) vira `onFim` na hora, como a
 * transição desconhecida.
 */
export function tocarAberturaDeBatalha(opcoes: OpcoesDeTocarAbertura): Promise<ControleDeTransicao> {
  const { id, nome } = opcoes
  const opcoesDaCena: OpcoesDaCena = nome === undefined ? { reduzirMovimento: opcoes.reduzirMovimento } : { reduzirMovimento: opcoes.reduzirMovimento, nome }
  return tocarCena(opcoes, opcoesDaCena, async () => {
    // O pacote pode estar chegando agora: o mesmo carregamento das transições.
    await aguardarTransicoesDeFora()
    const criar = criarCenaDaAbertura(id)
    const info = aberturaDeBatalhaInfo(id)
    if (criar === null || info === undefined) return null
    return { criar, duracaoNaturalS: info.duracaoNaturalS, duracaoS: info.duracaoNaturalS }
  })
}

async function tocarCena(opcoes: OpcoesDoPalco, opcoesDaCena: OpcoesDaCena, resolver: () => Promise<CenaResolvida | null>): Promise<ControleDeTransicao> {
  const { canvas, repetir = false, onFade, onFim } = opcoes
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
  let resolvida: CenaResolvida
  if (!temWebGL()) {
    avisarFim()
    return controleVazio
  }
  // Só para soltar o contexto WebGL se a cena (de um pacote, talvez) falhar ao montar.
  let rendererCriado: Three.WebGLRenderer | null = null
  try {
    // A fábrica antes do `three`: transição desconhecida nem baixa a biblioteca.
    const achada = await resolver()
    if (achada === null) {
      avisarFim()
      return controleVazio
    }
    resolvida = achada
    THREE = await carregarThree()
    renderer = rendererCriado = criarRenderer(THREE, canvas, false)
    cena = resolvida.criar(THREE, opcoesDaCena)
    // Vale também para as do pacote: elas são escritas no mesmo molde das
    // embutidas (luzes afinadas em unidades legadas), e assim tocam igual.
    converterLuzesLegadas(cena.scene)
  } catch {
    rendererCriado?.dispose()
    avisarFim()
    return controleVazio
  }

  const natural = resolvida.duracaoNaturalS
  const escala = natural / resolvida.duracaoS

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

/**
 * Guardadas pela ENTRADA do catálogo, não pelo id: a versão nova de uma
 * transição do pacote é outra entrada (mesmo id) e ganha miniatura nova.
 */
const miniaturas = new WeakMap<TransicaoInfo, Promise<string | null>>()

/**
 * Um quadro da cena como imagem (data URL), para a galeria. Feito uma vez por
 * transição e guardado; `null` quando não há WebGL ou o app não tem a transição.
 */
export function miniaturaDaTransicao(id: TransicaoId): Promise<string | null> {
  const info = transicaoInfo(id)
  if (info === undefined) return Promise.resolve(null)
  const pronta = miniaturas.get(info)
  if (pronta) return pronta
  const gerando = (async () => {
    if (!temWebGL()) return null
    // Cena de pacote que lança no meio não pode deixar o contexto WebGL preso:
    // o navegador tem poucos, e a galeria pede uma miniatura por transição.
    let renderer: Three.WebGLRenderer | null = null
    try {
      const criar = await resolverFabricaDaCena(id)
      if (criar === null) return null
      const THREE = await carregarThree()
      const canvas = document.createElement('canvas')
      renderer = criarRenderer(THREE, canvas, true)
      renderer.setPixelRatio(1)
      renderer.setSize(320, 180, false)
      const cena = criar(THREE, { reduzirMovimento: false })
      converterLuzesLegadas(cena.scene)
      cena.ajustarTela(320 / 180)
      cena.atualizar(info.quadroDaMiniaturaS)
      renderer.render(cena.scene, cena.camera)
      const url = canvas.toDataURL('image/jpeg', 0.82)
      cena.descartar()
      return url
    } catch {
      return null
    } finally {
      renderer?.dispose()
      renderer?.forceContextLoss()
    }
  })()
  miniaturas.set(info, gerando)
  return gerando
}
