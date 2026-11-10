import type * as Three from 'three'
import { aberturaDeBatalhaInfo, criarCenaDaAbertura } from './aberturasDeBatalha'
import { aguardarTransicoesDeFora, criarCenaDeFora, duracaoEfetivaS, transicaoInfo, type TransicaoEscolhida, type TransicaoId, type TransicaoInfo } from './catalogo'
import type { CenaTransicao, CriarCena, KitDeSom, OpcoesDaCena, ThreeModule } from './tipos'

/**
 * Motor das transições especiais: carrega `three` sob demanda, monta a cena do
 * catálogo num canvas, PREPARA tudo (programas, texturas, um quadro escondido)
 * e só então liga o relógio, toca no tempo escolhido e avisa o fim.
 *
 * Nada aqui pode prender o jogo: sem WebGL, sem `three`, transição que este
 * app não tem (pacote ainda não baixado) ou com erro na cena, `onFim` sai na
 * hora e o jogador cai direto no mapa.
 */

let threeCarregando: Promise<ThreeModule> | null = null

/** Sem WebGL (navegador velho, ambiente de teste) nem vale baixar o `three`. */
export function temWebGL(): boolean {
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
  /**
   * O que mais precisa chegar antes de a cena tocar (o mapa novo da travessia):
   * o motor espera por ela DEPOIS de montar a cena e ANTES de se dizer pronto.
   * Quem passa cuida do teto; rejeição vale como "chegou".
   */
  antes?: Promise<unknown>
  /** Chamado uma vez com tudo carregado, compilado e a página sossegada: falta só o relógio. */
  onPronta?: () => void
  /**
   * LARGADA COMBINADA (`largada.ts`): o relógio só liga quando ela resolve, com
   * o instante (`performance.now()`) em que a mesa largou. Quem ficou pronto
   * depois desse instante entra adiantado nesse tanto (o ponto certo da cena);
   * quem já perdeu a cena inteira só chama `onFim`. Ausente = liga assim que
   * estiver pronta. Quem passa cuida do teto.
   */
  largada?: Promise<number>
  /** Chamado uma vez quando o relógio liga (o primeiro quadro vem logo atrás). */
  onLargada?: () => void
  /** Quem pediu desistiu (pulou, desmontou): o preparo para no próximo passo, sem `onFim`. */
  sinal?: AbortSignal
}

export interface OpcoesDeTocar extends OpcoesDoPalco {
  escolha: TransicaoEscolhida
}

export interface OpcoesDeTocarAbertura extends OpcoesDoPalco {
  /** Id da abertura no registro (`aberturasDeBatalha.ts`), ex.: "espadas-cruzadas". */
  id: string
  /** O nome que a cena mostra; ausente ou vazio = sem nome (as cenas do pacote desde 28/10/2026). */
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

async function resolverTransicao(escolha: TransicaoEscolhida): Promise<CenaResolvida | null> {
  const criar = await resolverFabricaDaCena(escolha.id)
  const info = transicaoInfo(escolha.id)
  if (criar === null || info === undefined) return null
  return { criar, duracaoNaturalS: info.duracaoNaturalS, duracaoS: duracaoEfetivaS(escolha, info) }
}

async function resolverAbertura(id: string): Promise<CenaResolvida | null> {
  // O pacote pode estar chegando agora: o mesmo carregamento das transições.
  await aguardarTransicoesDeFora()
  const criar = criarCenaDaAbertura(id)
  const info = aberturaDeBatalhaInfo(id)
  if (criar === null || info === undefined) return null
  return { criar, duracaoNaturalS: info.duracaoNaturalS, duracaoS: info.duracaoNaturalS }
}

/** Toca uma transição. Resolve com o controle; qualquer falha vira `onFim` imediato. */
export function tocarTransicao(opcoes: OpcoesDeTocar): Promise<ControleDeTransicao> {
  return tocarCena(opcoes, { reduzirMovimento: opcoes.reduzirMovimento }, () => resolverTransicao(opcoes.escolha))
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
  return tocarCena(opcoes, opcoesDaCena, () => resolverAbertura(id))
}

/** Teto da espera pelos shaders: com o contexto perdido no meio, o `compileAsync` não acabaria. */
const ESPERA_DOS_SHADERS_MAX_MS = 1500
/** Teto da espera pelas imagens de uma cena (`pronta`): rede lenta não segura a transição. */
export const ESPERA_DA_CENA_MAX_MS = 4000
/** Teto da espera pelo sossego da página: aparelho que nunca fica ocioso toca assim mesmo. */
const ESPERA_DO_SOSSEGO_MAX_MS = 1200
/** Quem entra atrasado por mais que isto não ouve de uma vez os sons que já passaram (ver `entrarComSom`). */
const ATRASO_COM_SOM_MAX_S = 0.25
/** Subida do volume de quem entrou atrasado, depois de os sons passados terem sido engolidos. */
const SUBIDA_DO_SOM_S = 0.3

/** As etapas do preparo no User Timing do navegador (aba Desempenho): é por elas que se mede onde o tempo foi. */
function marcar(etapa: 'pedida' | 'codigo' | 'montada' | 'compilada' | 'pronta' | 'largada'): void {
  performance.mark(`lb-cutscene:${etapa}`)
}

/**
 * Espera a `pronta` da cena, se ela tiver uma (cenas antigas não têm e seguem
 * na hora). Falha ou teto estourado: segue, e a cena desenha o que já chegou.
 */
export async function aguardarCenaPronta(cena: Pick<CenaTransicao, 'pronta'>): Promise<void> {
  if (!cena.pronta) return
  let teto: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      cena.pronta,
      new Promise<void>((resolver) => {
        teto = setTimeout(resolver, ESPERA_DA_CENA_MAX_MS)
      }),
    ])
  } catch {
    // Segue sem as imagens que faltaram.
  } finally {
    clearTimeout(teto)
  }
}

/**
 * Compila os programas da cena sem travar a página (`compileAsync` usa o
 * KHR_parallel_shader_compile; o `compile` sozinho não basta, porque o three só
 * espera o link no primeiro uso, e ele trava o 1º quadro do mesmo jeito). Falha
 * ou teto estourado: segue, e o primeiro quadro compila do jeito antigo, com o
 * `catch` dele encerrando se for o caso.
 */
async function compilarAntesDoRelogio(renderer: Three.WebGLRenderer, cena: CenaTransicao): Promise<void> {
  let teto: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      renderer.compileAsync(cena.scene, cena.camera),
      new Promise<void>((resolver) => {
        teto = setTimeout(resolver, ESPERA_DOS_SHADERS_MAX_MS)
      }),
    ])
  } catch {
    // Segue para o primeiro quadro.
  } finally {
    clearTimeout(teto)
  }
}

/** Todas as texturas que os materiais da cena usam, inclusive as de objeto ainda escondido. */
function texturasDaCena(THREE: ThreeModule, scene: Three.Scene): Set<Three.Texture> {
  const texturas = new Set<Three.Texture>()
  const colher = (valor: unknown): void => {
    if (valor instanceof THREE.Texture) texturas.add(valor)
  }
  scene.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.Line || obj instanceof THREE.Sprite)) return
    const materiais: unknown[] = Array.isArray(obj.material) ? obj.material : [obj.material]
    for (const material of materiais) {
      if (!(material instanceof THREE.Material)) continue
      for (const valor of Object.values(material)) colher(valor)
      if (material instanceof THREE.ShaderMaterial) for (const uniforme of Object.values(material.uniforms)) colher(uniforme.value)
    }
  })
  return texturas
}

/**
 * Sobe as texturas para a placa e desenha um quadro escondido (a cortina preta
 * ainda cobre o canvas). O `compileAsync` não cobre isso: sem este passo, o 1º
 * quadro de verdade subia as texturas e montava as sombras com o relógio já
 * correndo (medido em 09/11/2026 com a CPU 4x mais lenta: 348 ms no Portão
 * pesado, comidos do começo da cena). Falha aqui não decide nada: o primeiro
 * quadro de verdade tem o `catch` dele.
 */
function aquecerNaPlaca(THREE: ThreeModule, renderer: Three.WebGLRenderer, cena: CenaTransicao): void {
  try {
    for (const textura of texturasDaCena(THREE, cena.scene)) {
      // Alvo de desenho não tem imagem a subir; textura sem imagem ainda (cena com `pronta` que falhou) também não.
      if (textura.isRenderTargetTexture || textura.image === null || textura.image === undefined) continue
      renderer.initTexture(textura)
    }
    cena.atualizar(0)
    renderer.render(cena.scene, cena.camera)
  } catch {
    // Segue para o primeiro quadro.
  }
}

/**
 * Espera a página sossegar: o mapa novo, o recorte da batalha e os painéis
 * chegam junto com a ordem de tocar e montam por baixo da cortina. Com o
 * relógio correndo, esse trabalho comia quadros do começo da cena.
 */
function sossegoDaPagina(): Promise<void> {
  return new Promise((feito) => {
    const depoisDoQuadro = (): void => {
      requestAnimationFrame(() => feito())
    }
    if (typeof requestIdleCallback === 'function') requestIdleCallback(depoisDoQuadro, { timeout: ESPERA_DO_SOSSEGO_MAX_MS })
    else setTimeout(depoisDoQuadro, 0)
  })
}

type Pistas = ReturnType<NonNullable<CenaTransicao['criarSom']>>

interface SomDaCena {
  ctx: AudioContext
  volume: GainNode
  pistas: Pistas
}

/**
 * Quem entra com a cena andando não ouve de uma vez os sons que já passaram:
 * as pistas disparam mudas até o ponto de entrada e o volume sobe em seguida
 * (o que ainda soa entra pela metade, como para quem chegou atrasado).
 */
function entrarComSom(audio: SomDaCena, tS: number, volume: number): void {
  if (tS <= ATRASO_COM_SOM_MAX_S) return
  const agora = audio.ctx.currentTime
  audio.volume.gain.setValueAtTime(0, agora)
  try {
    audio.pistas.atualizar(tS)
  } catch {
    // O `catch` do primeiro quadro decide; aqui só não se toca o que passou.
  }
  audio.volume.gain.linearRampToValueAtTime(volume, agora + SUBIDA_DO_SOM_S)
}

async function tocarCena(opcoes: OpcoesDoPalco, opcoesDaCena: OpcoesDaCena, resolver: () => Promise<CenaResolvida | null>): Promise<ControleDeTransicao> {
  const { canvas, repetir = false, onFade, onFim, sinal } = opcoes
  let parado = false
  let fimAvisado = false
  const avisarFim = () => {
    if (fimAvisado) return
    fimAvisado = true
    onFim()
  }
  const controleVazio: ControleDeTransicao = { parar: () => (parado = true), definirVolume: () => undefined }
  const desistiu = (): boolean => parado || fimAvisado || sinal?.aborted === true
  let relogioLigado = false
  /**
   * A mesa não espera por esta tela: se a cena inteira passar para ela com o
   * preparo daqui ainda no meio (o `three` descendo numa rede lenta), não há
   * mais o que mostrar. Avisa o fim na hora em que a cena acabou para a mesa, e
   * o jogador volta ao jogo em vez de ficar na tela preta até o download acabar.
   */
  const vigiarCenaPerdida = (duracaoS: number): void => {
    if (repetir || !opcoes.largada) return
    void opcoes.largada.then(
      (largouEm) => {
        const restaMs = duracaoS * 1000 - (performance.now() - largouEm)
        setTimeout(() => {
          if (!relogioLigado && !desistiu()) avisarFim()
        }, Math.max(0, restaMs))
      },
      () => undefined,
    )
  }

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
    marcar('pedida')
    // A fábrica antes do `three`: transição desconhecida nem baixa a biblioteca.
    const achada = await resolver()
    if (achada === null) {
      avisarFim()
      return controleVazio
    }
    resolvida = achada
    vigiarCenaPerdida(achada.duracaoS)
    THREE = await carregarThree()
    marcar('codigo')
    // Quem pediu já saiu (pulou durante o download): nem monta a cena.
    if (desistiu()) return controleVazio
    renderer = rendererCriado = criarRenderer(THREE, canvas, false)
    cena = resolvida.criar(THREE, opcoesDaCena)
    // Vale também para as do pacote: elas são escritas no mesmo molde das
    // embutidas (luzes afinadas em unidades legadas), e assim tocam igual.
    converterLuzesLegadas(cena.scene)
    marcar('montada')
  } catch {
    rendererCriado?.dispose()
    avisarFim()
    return controleVazio
  }

  const natural = resolvida.duracaoNaturalS
  const escala = natural / resolvida.duracaoS

  // Som: contexto próprio, criado já dentro do gesto que abriu a transição
  // quando houver um; se o navegador recusar, segue mudo.
  let audio: SomDaCena | null = null
  let volumeAtual = opcoes.volume
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

  let quadro = 0
  const desmontar = () => {
    cancelAnimationFrame(quadro)
    observador?.disconnect()
    cena.descartar()
    renderer.dispose()
    if (audio) void audio.ctx.close().catch(() => undefined)
  }

  // TUDO CARREGADO ANTES DE TOCAR, com a cortina preta ainda cobrindo o canvas:
  // as imagens da cena, os shaders (no primeiro quadro eles comiam o começo da
  // cena: medido em 28/10/2026, a frio, 280 ms na Marinha e 492 ms nas Espadas
  // entre o 1º e o 2º quadro), as texturas na placa e um quadro escondido.
  await aguardarCenaPronta(cena)
  await compilarAntesDoRelogio(renderer, cena)
  marcar('compilada')
  if (!desistiu()) aquecerNaPlaca(THREE, renderer, cena)
  // O mapa novo da travessia e o trabalho que chega junto com a ordem (recorte da
  // batalha, painéis) terminam por baixo da cortina, e não em cima da cena tocando.
  if (opcoes.antes) await opcoes.antes.catch(() => undefined)
  await sossegoDaPagina()
  if (desistiu()) {
    desmontar()
    return controleVazio
  }
  marcar('pronta')
  opcoes.onPronta?.()

  // A largada combinada: o instante em que a mesa largou. Quem ficou pronto depois entra adiantado.
  let inicio = performance.now()
  if (opcoes.largada) {
    const largouEm = await opcoes.largada.catch(() => performance.now())
    if (desistiu()) {
      desmontar()
      return controleVazio
    }
    inicio = Math.min(largouEm, performance.now())
  }
  const entradaS = ((performance.now() - inicio) / 1000) * escala
  if (!repetir && entradaS >= natural) {
    // A cena inteira já passou para a mesa: nada a mostrar, e o que veio depois (a batalha aberta) está embaixo.
    onFade?.(1)
    desmontar()
    avisarFim()
    return controleVazio
  }
  if (audio) entrarComSom(audio, entradaS, volumeAtual)
  relogioLigado = true
  marcar('largada')
  opcoes.onLargada?.()

  const tick = (agora: number) => {
    if (parado) return
    let t = Math.max(0, ((agora - inicio) / 1000) * escala)
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
      volumeAtual = volume
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
      await aguardarCenaPronta(cena)
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
