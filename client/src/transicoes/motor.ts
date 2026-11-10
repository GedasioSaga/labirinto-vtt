import type * as Three from 'three'
import { ABERTURA_DURACAO_MAX_S, aberturaDeBatalhaInfo, criarCenaDaAbertura } from './aberturasDeBatalha'
import {
  aguardarTransicoesDeFora,
  criarCenaDeFora,
  duracaoEfetivaS,
  TRANSICAO_DURACAO_MAX_S,
  transicaoInfo,
  type TransicaoEscolhida,
  type TransicaoId,
  type TransicaoInfo,
} from './catalogo'
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
 * Teto da espera pelo pacote de animações que ainda está chegando: o download
 * travado (rede caída no meio) não segura a tela preta em "Preparando a
 * cena…". Vencido, vale o que já está registrado: sem a cena, o jogador volta
 * ao jogo na hora, com o que veio depois (o mapa novo, a batalha) por baixo.
 */
export const ESPERA_DO_PACOTE_MAX_MS = 4000

/** Espera o pacote que está chegando, até o teto. Nunca rejeita. */
async function aguardarPacote(): Promise<void> {
  let teto: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      aguardarTransicoesDeFora(),
      new Promise<void>((resolver) => {
        teto = setTimeout(resolver, ESPERA_DO_PACOTE_MAX_MS)
      }),
    ])
  } finally {
    clearTimeout(teto)
  }
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
  await aguardarPacote()
  return criarCenaDeFora(id)
}

// ---------------------------------------------------------------------------
// Cutscene no ar
// ---------------------------------------------------------------------------

/** Cutscenes de jogo (não a prévia do mestre, que repete) entre o pedido e o fim, nesta página. */
let cutscenesNoAr = 0
const esperandoOArLivre = new Set<() => void>()

/** Há cutscene carregando ou tocando nesta página? O aquecimento não baixa nem compila nada por cima dela. */
export function haCutsceneNoAr(): boolean {
  return cutscenesNoAr > 0
}

/** Resolve quando não houver cutscene no ar (já resolvida, se não há). */
export function semCutsceneNoAr(): Promise<void> {
  if (cutscenesNoAr === 0) return Promise.resolve()
  return new Promise((feito) => {
    esperandoOArLivre.add(feito)
  })
}

/** Uma cutscene entra no ar; devolve a saída dela (uma vez só, por mais que chamem). */
function entrarNoAr(): () => void {
  cutscenesNoAr += 1
  let saiu = false
  return () => {
    if (saiu) return
    saiu = true
    cutscenesNoAr -= 1
    if (cutscenesNoAr > 0) return
    const soltos = [...esperandoOArLivre]
    esperandoOArLivre.clear()
    for (const soltar of soltos) soltar()
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
  // O pacote pode estar chegando agora: o mesmo carregamento das transições, com o mesmo teto.
  await aguardarPacote()
  const criar = criarCenaDaAbertura(id)
  const info = aberturaDeBatalhaInfo(id)
  if (criar === null || info === undefined) return null
  return { criar, duracaoNaturalS: info.duracaoNaturalS, duracaoS: info.duracaoNaturalS }
}

/** Toca uma transição. Resolve com o controle; qualquer falha vira `onFim` imediato. */
export function tocarTransicao(opcoes: OpcoesDeTocar): Promise<ControleDeTransicao> {
  // A transição não tem largada combinada: a duração prevista só entra na vigia da cena perdida, que ela não arma.
  return tocarCena(opcoes, { reduzirMovimento: opcoes.reduzirMovimento }, () => resolverTransicao(opcoes.escolha), TRANSICAO_DURACAO_MAX_S)
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
  // Com o pacote ainda chegando a duração não é conhecida: a vigia da cena perdida arma com a maior que uma abertura pode ter.
  return tocarCena(opcoes, opcoesDaCena, () => resolverAbertura(id), aberturaDeBatalhaInfo(id)?.duracaoNaturalS ?? ABERTURA_DURACAO_MAX_S)
}

/** O canvas escondido do pré-aquecimento: o tamanho não muda os programas nem as texturas, só o custo do quadro. */
const PRE_LARGURA = 64
const PRE_ALTURA = 36
/** O nome que a abertura pré-aquecida mostra: com nome a cena monta tudo o que a sem nome monta, e mais a placa dele. */
const NOME_DO_PRE_AQUECIMENTO = 'Mesa'

/**
 * AQUECER PELA INTENÇÃO (`aquecimento.ts`): monta a cena num canvas escondido,
 * compila os programas, sobe as texturas, desenha um quadro e joga tudo fora.
 * O que fica para a hora de tocar: o código avaliado, as imagens da cena no
 * cache e os programas no cache de shaders do navegador (compilar na placa é a
 * parte cara a frio: 685 ms nas Espadas, medido no mestre em 09/11/2026).
 *
 * `false` = este app (ainda) não tem a cena, ou ela falhou: quem pediu pode
 * tentar de novo. Cutscene que entra no ar no meio ganha a vez: para ali, e o
 * preparo de verdade aquece o resto.
 */
async function preCompilar(resolver: () => Promise<CenaResolvida | null>, opcoesDaCena: OpcoesDaCena): Promise<boolean> {
  if (!temWebGL()) return false
  let renderer: Three.WebGLRenderer | null = null
  let cena: CenaTransicao | null = null
  try {
    const achada = await resolver()
    if (achada === null) return false
    const THREE = await carregarThree()
    if (haCutsceneNoAr()) return true
    const canvas = document.createElement('canvas')
    renderer = criarRenderer(THREE, canvas, false)
    renderer.setPixelRatio(1)
    renderer.setSize(PRE_LARGURA, PRE_ALTURA, false)
    cena = achada.criar(THREE, opcoesDaCena)
    converterLuzesLegadas(cena.scene)
    cena.ajustarTela(PRE_LARGURA / PRE_ALTURA)
    await aguardarCenaPronta(cena)
    if (haCutsceneNoAr()) return true
    await compilarAntesDoRelogio(renderer, cena)
    if (!haCutsceneNoAr()) aquecerNaPlaca(THREE, renderer, cena)
    return true
  } catch {
    return false
  } finally {
    try {
      cena?.descartar()
    } catch {
      // Cena de pacote que falha ao descartar não prende o contexto: ele cai logo abaixo.
    }
    // O navegador tem poucos contextos WebGL: este cai na hora, sem esperar o coletor.
    renderer?.dispose()
    renderer?.forceContextLoss()
  }
}

/** Pré-aquece a abertura de batalha `id` (ver `preCompilar`). */
export function preCompilarAbertura(id: string, reduzirMovimento = false): Promise<boolean> {
  return preCompilar(() => resolverAbertura(id), { reduzirMovimento, nome: NOME_DO_PRE_AQUECIMENTO })
}

/** Pré-aquece a transição de local `id` (ver `preCompilar`). */
export function preCompilarTransicao(id: TransicaoId, reduzirMovimento = false): Promise<boolean> {
  return preCompilar(() => resolverTransicao({ id }), { reduzirMovimento })
}

/** Teto da espera pelos shaders: com o contexto perdido no meio, o `compileAsync` não acabaria. */
const ESPERA_DOS_SHADERS_MAX_MS = 1500
/** Teto da espera pelas imagens de uma cena (`pronta`): rede lenta não segura a transição. */
export const ESPERA_DA_CENA_MAX_MS = 4000
/** Teto da espera pelo sossego da página: aparelho que nunca fica ocioso toca assim mesmo. */
const ESPERA_DO_SOSSEGO_MAX_MS = 1200
/** Quem entra atrasado por mais que isto não ouve de uma vez os sons que já passaram (ver `entrarComSom`). */
const ATRASO_COM_SOM_MAX_S = 0.25
/**
 * Quem entrou atrasado fica este tanto em silêncio: os sons que já passaram
 * disparam mudos e têm esse tempo para acabar. Sem ele, um som longo do começo
 * (o zunido da espada, o tiro) soava inteiro fora do ponto da imagem.
 */
const SILENCIO_DE_QUEM_ENTROU_ATRASADO_S = 1
/** Subida do volume de quem entrou atrasado, depois do silêncio. */
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
 * Quem entra com a cena andando PULA os sons que já passaram: as pistas
 * disparam mudas até o ponto de entrada, o silêncio dura o bastante para elas
 * acabarem e só então o volume sobe. O que a cena disparar daí em diante soa
 * no ponto certo da imagem. (O som não tem como ser adiantado: cada cena monta
 * o dela na hora, sem ponto de entrada no meio.)
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
  const fimDoSilencio = agora + SILENCIO_DE_QUEM_ENTROU_ATRASADO_S
  audio.volume.gain.setValueAtTime(0, fimDoSilencio)
  audio.volume.gain.linearRampToValueAtTime(volume, fimDoSilencio + SUBIDA_DO_SOM_S)
}

/** Onde a tela entra na cena, dado o instante em que a mesa largou. */
export interface EntradaNaCena {
  /** O zero do relógio desta tela (`performance.now()`): o instante da largada. */
  inicio: number
  /** O ponto da cena, em segundos dela, em que esta tela começa. 0 = do começo. */
  entradaS: number
  /** A cena inteira já passou para a mesa: nada a mostrar. */
  perdeu: boolean
}

/**
 * LARGADA COMBINADA: quem ficou pronto antes da largada começa do zero, junto
 * com a mesa; quem ficou pronto depois entra adiantado nesse tanto; e para
 * quem a cena inteira já passou não há o que tocar. `escala` converte tempo de
 * parede em tempo de cena (duração natural sobre a escolhida).
 */
export function entradaNaCena({ largouEm, agora, escala, naturalS }: { largouEm: number; agora: number; escala: number; naturalS: number }): EntradaNaCena {
  // Largada "no futuro" (relógios de origens diferentes) vale como agora: ninguém entra em tempo negativo.
  const inicio = Math.min(largouEm, agora)
  const entradaS = ((agora - inicio) / 1000) * escala
  return { inicio, entradaS, perdeu: entradaS >= naturalS }
}

async function tocarCena(
  opcoes: OpcoesDoPalco,
  opcoesDaCena: OpcoesDaCena,
  resolver: () => Promise<CenaResolvida | null>,
  /** A duração da cena enquanto ela não está resolvida (o pacote ainda chegando): só para a vigia da cena perdida. */
  duracaoPrevistaS: number,
): Promise<ControleDeTransicao> {
  const { canvas, repetir = false, onFade, onFim, sinal } = opcoes
  // A prévia do mestre (que repete) não conta: é dele, e fica aberta o tempo que ele quiser.
  const sairDoAr = repetir ? () => undefined : entrarNoAr()
  let parado = false
  let fimAvisado = false
  const avisarFim = () => {
    if (fimAvisado) return
    fimAvisado = true
    sairDoAr()
    onFim()
  }
  const controleVazio: ControleDeTransicao = {
    parar: () => {
      parado = true
      sairDoAr()
    },
    definirVolume: () => undefined,
  }
  // Quem pediu desistiu no meio do preparo (pulou, desmontou): a cena sai do ar ali, sem esperar o próximo passo.
  if (sinal?.aborted === true) sairDoAr()
  else sinal?.addEventListener('abort', sairDoAr, { once: true })
  const desistiu = (): boolean => parado || fimAvisado || sinal?.aborted === true
  let relogioLigado = false
  /**
   * A mesa não espera por esta tela: se a cena inteira passar para ela com o
   * preparo daqui ainda no meio (o pacote ou o `three` descendo numa rede
   * lenta), não há mais o que mostrar. Avisa o fim na hora em que a cena acabou
   * para a mesa, e o jogador volta ao jogo em vez de ficar na tela preta até o
   * download acabar. Armada ANTES de qualquer espera, com a duração prevista;
   * a duração de verdade a rearma quando a cena é resolvida.
   */
  let duracaoVigiadaS = duracaoPrevistaS
  let largouEmVigiado: number | null = null
  let vigia: ReturnType<typeof setTimeout> | undefined
  const armarVigia = (): void => {
    if (largouEmVigiado === null) return
    clearTimeout(vigia)
    const restaMs = duracaoVigiadaS * 1000 - (performance.now() - largouEmVigiado)
    vigia = setTimeout(() => {
      if (!relogioLigado && !desistiu()) avisarFim()
    }, Math.max(0, restaMs))
  }
  if (!repetir && opcoes.largada) {
    void opcoes.largada.then(
      (largouEm) => {
        largouEmVigiado = largouEm
        armarVigia()
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
    duracaoVigiadaS = achada.duracaoS
    armarVigia()
    THREE = await carregarThree()
    marcar('codigo')
    // Quem pediu já saiu (pulou durante o download): nem monta a cena.
    if (desistiu()) {
      sairDoAr()
      return controleVazio
    }
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
    clearTimeout(vigia)
    observador?.disconnect()
    cena.descartar()
    renderer.dispose()
    if (audio) void audio.ctx.close().catch(() => undefined)
    sairDoAr()
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
  let largouEm = performance.now()
  if (opcoes.largada) {
    largouEm = await opcoes.largada.catch(() => performance.now())
    if (desistiu()) {
      desmontar()
      return controleVazio
    }
  }
  const entrada = entradaNaCena({ largouEm, agora: performance.now(), escala, naturalS: natural })
  let inicio = entrada.inicio
  const entradaS = entrada.entradaS
  if (!repetir && entrada.perdeu) {
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
