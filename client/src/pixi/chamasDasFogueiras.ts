import { Container, Graphics, GraphicsContext, type Ticker } from 'pixi.js'
import type { MapData, Prop } from '../types/map'
import { chamaDaFogueira, vistaDoMovel } from '../lib/mobilia'
import { deslocamentoDaChama } from '../lib/mobilia/vistaTresQuartos'
import { rotatePointAround, rotationTrig } from '../lib/roomRotation'

/**
 * A CHAMA DAS FOGUEIRAS (protótipo aprovado em 14/10/2026,
 * `docs/design/mobilia-cozinha-fogueira/ESPEC.md`): a fogueira é o único móvel
 * com parte animada. Pedras e lenha saem no desenho de sempre do móvel
 * (`drawPropSilhouettes`, que NUNCA é repintado por causa da chama); a chama e
 * as fagulhas moram aqui, num nó por fogueira:
 *
 *   nó (posição = base da chama na tela, sem giro)
 *     ├ borda   (Graphics, contexto compartilhado; escala = H × pose)
 *     ├ miolo   (Graphics, contexto compartilhado; escala = H × pose, alpha da pose)
 *     └ 3 fagulhas (Graphics, um círculo compartilhado; posição e alpha da pose)
 *
 * As formas são desenhadas UMA vez por tela, em unidade de referência; por
 * quadro só mudam escala, posição e alpha. Nada de `clear()` nem de `visible`
 * por quadro: trocar `visible` refaz as instruções do grupo de render inteiro
 * (o mapa todo, no editor), e alpha 0 custa só três círculos.
 *
 * A chama fica SEMPRE EM PÉ na tela (ajuste do usuário na aprovação): o giro do
 * objeto leva a base junto com a lenha (`chamaDaFogueira`), mas não vira a
 * chama, e as fagulhas sobem para cima da tela.
 *
 * O relógio só fica inscrito com ao menos uma fogueira e movimento normal; com
 * "menos movimento" do sistema a chama fica na pose fixa (`POSE_FIXA`). Sem
 * relógio nenhum (testes, exportar imagem), também.
 */

/** Um ciclo da chama, em ms: só harmônicos inteiros dele, então a volta não tem salto. */
export const CICLO_DA_CHAMA_MS = 2400
/** Vida de uma fagulha, em fração do ciclo (0,9 s). */
export const VIDA_DA_FAGULHA = 0.375

/** As três fagulhas: quando nascem (fração do ciclo), de onde saem e para onde derivam (em H), e a fase da onda (rad). */
const FAGULHAS = [
  { inicio: 0, x0: -0.1, deriva: -0.06, onda: 0 },
  { inicio: 0.36, x0: 0.12, deriva: 0.07, onda: 2.1 },
  { inicio: 0.68, x0: 0.02, deriva: -0.03, onda: 4.2 },
]
/** A fagulha nasce logo abaixo da ponta da chama (em H acima da base)... */
const NASCER_DA_FAGULHA = 0.9
/** ...e sobe mais isto, desacelerando. */
const SUBIDA_DA_FAGULHA = 0.5
/** Balanço lateral da fagulha, em H, e quantas ondas ela faz na vida. */
const BALANCO_DA_FAGULHA = 0.035
const ONDAS_DA_FAGULHA = 1.5
/** Fração da vida em que a fagulha acende, e o expoente do apagar. */
const ACENDER_DA_FAGULHA = 0.12
const APAGAR_DA_FAGULHA = 1.4
/** Alpha do miolo na pose parada. */
const ALPHA_DO_MIOLO_PARADO = 0.9

export interface PoseDaFagulha {
  /** Em H, a partir da base da chama; y negativo = para cima. */
  readonly x: number
  readonly y: number
  readonly alpha: number
}

export interface PoseDaChama {
  /** Escala da chama inteira (borda e miolo), com o pivô na base. */
  readonly escalaX: number
  readonly escalaY: number
  /** Alpha do MIOLO; a borda fica opaca. */
  readonly alpha: number
  /** Sempre 3, apagadas com alpha 0. */
  readonly fagulhas: readonly PoseDaFagulha[]
}

function fagulhaApagada(fagulha: (typeof FAGULHAS)[number]): PoseDaFagulha {
  return { x: fagulha.x0, y: -NASCER_DA_FAGULHA, alpha: 0 }
}

/** A chama parada ("menos movimento", ou sem relógio): sempre o mesmo objeto. */
export const POSE_FIXA: PoseDaChama = Object.freeze({
  escalaX: 1,
  escalaY: 1,
  alpha: ALPHA_DO_MIOLO_PARADO,
  fagulhas: Object.freeze(FAGULHAS.map(fagulhaApagada)),
})

function fracao(valor: number): number {
  return valor - Math.floor(valor)
}

/** Pose que o relógio reescreve a cada quadro: com dezenas de fogueiras, nada novo para o coletor de lixo. O objeto Fogo (`fogosDoMapa.ts`) reaproveita. */
export interface PoseReescrita {
  escalaX: number
  escalaY: number
  alpha: number
  fagulhas: { x: number; y: number; alpha: number }[]
}

export function novaPose(): PoseReescrita {
  return { escalaX: 1, escalaY: 1, alpha: ALPHA_DO_MIOLO_PARADO, fagulhas: FAGULHAS.map((fagulha) => ({ x: fagulha.x0, y: -NASCER_DA_FAGULHA, alpha: 0 })) }
}

/** Escreve em `destino` a pose da chama em movimento (ver `poseDaChama`) e devolve o próprio `destino`. */
export function escreverPose(tempoMs: number, fase: number, destino: PoseReescrita): PoseReescrita {
  const volta = 2 * Math.PI
  const u = fracao(tempoMs / CICLO_DA_CHAMA_MS + fase)
  destino.escalaY = 1 + 0.07 * Math.sin(volta * 2 * u) + 0.035 * Math.sin(volta * 5 * u + 1.3) + 0.015 * Math.sin(volta * 9 * u + 0.4)
  destino.escalaX = 1 - 0.4 * (destino.escalaY - 1) + 0.02 * Math.sin(volta * 3 * u + 2.1)
  destino.alpha = Math.min(1, 0.86 + 0.1 * Math.sin(volta * 4 * u + 0.9) + 0.04 * Math.sin(volta * 7 * u + 2.6))
  for (let i = 0; i < FAGULHAS.length; i += 1) {
    const fagulha = FAGULHAS[i]
    const saida = destino.fagulhas[i]
    const p = fracao(u - fagulha.inicio) / VIDA_DA_FAGULHA
    if (p >= 1) {
      saida.x = fagulha.x0
      saida.y = -NASCER_DA_FAGULHA
      saida.alpha = 0
      continue
    }
    // Sai rápido e desacelera.
    const subida = 1 - (1 - p) * (1 - p)
    saida.x = fagulha.x0 + fagulha.deriva * p + BALANCO_DA_FAGULHA * Math.sin(volta * ONDAS_DA_FAGULHA * p + fagulha.onda)
    saida.y = -(NASCER_DA_FAGULHA + SUBIDA_DA_FAGULHA * subida)
    saida.alpha = Math.min(1, p / ACENDER_DA_FAGULHA) * Math.pow(1 - p, APAGAR_DA_FAGULHA)
  }
  return destino
}

/**
 * A pose da chama no instante `tempoMs`, na fase `fase` ([0, 1), a da
 * fogueira). Função pura, o mesmo código do protótipo: o pulso principal é de
 * 1,2 s e o mais rápido de 3,75 Hz; quando a chama sobe, afina. `reduzir` =
 * `POSE_FIXA`.
 */
export function poseDaChama(tempoMs: number, fase: number, reduzir: boolean): PoseDaChama {
  if (reduzir) return POSE_FIXA
  return escreverPose(tempoMs, fase, novaPose())
}

/**
 * A fase da fogueira, do id dela (FNV-1a de 32 bits levado a [0, 1)): duas
 * fogueiras não pulsam juntas, e a mesma tem a mesma fase no editor e na tela
 * do jogador (o relógio é o de cada tela; não precisa sincronizar).
 */
export function faseDaFogueira(id: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0) / 2 ** 32
}

/**
 * Cores próprias da chama ("Cor" e "Cor da linha" do móvel não mudam a chama).
 * A borda é um tom mais escuro e mais quente que a do protótipo (`#d0703c`),
 * sem saturar mais (ajuste do usuário na aprovação): 1,57:1 sobre o chão
 * padrão (#a8776a), onde a chama fica na vista de lado. O miolo claro dá a
 * leitura sobre o fundo escuro da roda (4,8:1).
 */
export const COR_DA_BORDA_DA_CHAMA = 0xa04a2c
export const COR_DO_MIOLO_DA_CHAMA = 0xf0c98a
export const COR_DA_FAGULHA = 0xf6dca8

/**
 * A borda da chama em unidade de H (origem na base, ponta em (0, −1)), a partir
 * da ponta: 4 cúbicas de Bézier, cada uma [c1x, c1y, c2x, c2y, x, y].
 */
const CURVA_DA_CHAMA: readonly (readonly [number, number, number, number, number, number])[] = [
  [0.13, -0.75, 0.4, -0.52, 0.36, -0.25],
  [0.33, -0.06, 0.18, 0, 0, 0],
  [-0.18, 0, -0.33, -0.06, -0.36, -0.25],
  [-0.4, -0.52, -0.13, -0.75, 0, -1],
]
/** O miolo é a mesma curva, menor e um pouco acima da base. */
const MIOLO = { escalaX: 0.5, escalaY: 0.56, deslocamento: -0.04 }
/**
 * Unidades do contexto por H. O Pixi divide a curva com tolerância de ~0,5
 * unidade: desenhada em H = 1 a chama sairia um losango; a 256 a curva fica lisa
 * até ~400 px de tela.
 */
export const ALTURA_DE_REFERENCIA = 256
export const RAIO_DE_REFERENCIA = 16
/** A fagulha nunca fica menor que isto na tela... */
const RAIO_MINIMO_DA_FAGULHA_EM_PX = 1.2
/** ...e no mais é esta fração do lado menor da fogueira (0,022 casa no tamanho padrão). */
const RAIO_DA_FAGULHA = 0.022
/** De quanto em quanto tempo, com a chama viva, o relógio confere se a pessoa passou a pedir menos movimento. */
const CONFERIR_MOVIMENTO_MS = 1000

function contextoDaChama(cor: number, escalaX: number, escalaY: number, deslocamento: number): GraphicsContext {
  const ponto = (x: number, y: number) => ({ x: x * escalaX * ALTURA_DE_REFERENCIA, y: (y * escalaY + deslocamento) * ALTURA_DE_REFERENCIA })
  const contexto = new GraphicsContext()
  const ponta = ponto(0, -1)
  contexto.moveTo(ponta.x, ponta.y)
  for (const [c1x, c1y, c2x, c2y, x, y] of CURVA_DA_CHAMA) {
    const c1 = ponto(c1x, c1y)
    const c2 = ponto(c2x, c2y)
    const fim = ponto(x, y)
    contexto.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, fim.x, fim.y)
  }
  return contexto.closePath().fill({ color: cor })
}

/** As três formas da chama (borda, miolo e fagulha), em unidade de referência: a fogueira e o objeto Fogo desenham as mesmas. */
export interface FormasDaChama {
  borda: GraphicsContext
  miolo: GraphicsContext
  fagulha: GraphicsContext
}

export function criarFormasDaChama(): FormasDaChama {
  return {
    borda: contextoDaChama(COR_DA_BORDA_DA_CHAMA, 1, 1, 0),
    miolo: contextoDaChama(COR_DO_MIOLO_DA_CHAMA, MIOLO.escalaX, MIOLO.escalaY, MIOLO.deslocamento),
    fagulha: new GraphicsContext().circle(0, 0, RAIO_DE_REFERENCIA).fill({ color: COR_DA_FAGULHA }),
  }
}

/** O que a chama lê do objeto. */
export type PropDaChama = Pick<Prop, 'id' | 'x' | 'y' | 'width' | 'height' | 'rotation' | 'mobilia' | 'mobiliaVista'>

/** Zoom do quadro: a fagulha tem um raio mínimo em px de tela. */
export interface TelaDasChamas {
  cameraScale: number
  /**
   * Vista dos móveis do mapa (MT11). Na 3/4, com a chave de obra ligada, a
   * lenha sobe na imagem e a chama sobe junto (`deslocamentoDaChama`).
   * Ausente = "de cima", a chama no lugar de sempre.
   */
  vistaDosMoveis?: MapData['vistaDosMoveis']
}

export interface MovimentoDasChamas {
  /** O relógio de quadros do Pixi (`app.ticker`): inscrito só com fogueira e movimento normal. */
  ticker: Pick<Ticker, 'add' | 'remove'>
  /** `prefers-reduced-motion`, relido a cada passada e, com a chama viva, uma vez por segundo. */
  reducedMotion: () => boolean
  /** Agora, em ms. Padrão `performance.now()`: o relógio de cada tela. */
  agora?: () => number
}

/** O que a tela anota para a medida de desempenho e a conferência. */
export interface EstadoDasChamas {
  chamas: number
  animando: boolean
}

export interface OpcoesDasChamas {
  /** Sem isto nada anima: a chama fica na pose fixa. */
  movimento?: MovimentoDasChamas
  aoMudar?: (estado: EstadoDasChamas) => void
}

export interface ChamasDasFogueiras {
  /**
   * A chama de `prop` no zoom de agora: cria o nó na primeira vez e o põe na
   * base da chama. `null` = não é fogueira, ou não tem tamanho nem posição
   * desenháveis (a chama que havia sai). Quem chama põe o nó na árvore.
   */
  colocar: (prop: PropDaChama, tela: TelaDasChamas) => Container | null
  /**
   * Fim de uma passada: some a chama de quem não está em `presentes`, relê o
   * "menos movimento" e liga ou desliga o relógio.
   */
  podar: (presentes: ReadonlySet<string>) => void
  destruir: () => void
}

interface ChamaNoPalco {
  no: Container
  borda: Graphics
  miolo: Graphics
  fagulhas: Graphics[]
  fase: number
  /** H, em px de mundo. */
  altura: number
}

/**
 * Cria as chamas de uma tela, com os contextos e o relógio fechados por
 * closure: instanciar dentro do setup de cada montagem (editor e jogador),
 * nunca em escopo de módulo, como `createAnimadorDePortas`.
 */
export function createChamasDasFogueiras(opcoes: OpcoesDasChamas = {}): ChamasDasFogueiras {
  const { movimento, aoMudar } = opcoes
  const agora = movimento?.agora ?? (() => performance.now())
  const chamas = new Map<string, ChamaNoPalco>()
  // Uma pose só para o quadro inteiro: `aplicar` lê na hora, antes da próxima fogueira reescrever.
  const poseDoQuadro = novaPose()
  let contextos: FormasDaChama | null = null
  let noRelogio = false
  let parada = movimento === undefined || movimento.reducedMotion()
  let conferidoEm = 0
  let avisado = ''

  /** As formas nascem com a primeira fogueira e ficam até o fim. */
  function formas(): FormasDaChama {
    if (contextos !== null) return contextos
    contextos = criarFormasDaChama()
    return contextos
  }

  function avisar(): void {
    const estado = { chamas: chamas.size, animando: noRelogio }
    const chave = `${estado.chamas}:${estado.animando}`
    if (chave === avisado) return
    avisado = chave
    aoMudar?.(estado)
  }

  function criar(id: string): ChamaNoPalco {
    const { borda: deBorda, miolo: deMiolo, fagulha: deFagulha } = formas()
    const no = new Container()
    no.label = `chama:${id}`
    no.eventMode = 'none'
    const borda = new Graphics(deBorda)
    borda.label = 'borda'
    const miolo = new Graphics(deMiolo)
    miolo.label = 'miolo'
    const fagulhas = FAGULHAS.map(() => {
      const fagulha = new Graphics(deFagulha)
      fagulha.label = 'fagulha'
      return fagulha
    })
    no.addChild(borda, miolo, ...fagulhas)
    return { no, borda, miolo, fagulhas, fase: faseDaFogueira(id), altura: 0 }
  }

  /** Só números: escala e alpha da chama, posição e alpha das fagulhas. */
  function aplicar(chama: ChamaNoPalco, pose: PoseDaChama): void {
    const k = chama.altura / ALTURA_DE_REFERENCIA
    chama.borda.scale.set(k * pose.escalaX, k * pose.escalaY)
    chama.miolo.scale.set(k * pose.escalaX, k * pose.escalaY)
    chama.miolo.alpha = pose.alpha
    for (let i = 0; i < pose.fagulhas.length; i += 1) {
      const fagulha = pose.fagulhas[i]
      const desenho = chama.fagulhas[i]
      desenho.position.set(fagulha.x * chama.altura, fagulha.y * chama.altura)
      desenho.alpha = fagulha.alpha
    }
  }

  function remover(id: string): void {
    const chama = chamas.get(id)
    if (chama === undefined) return
    chamas.delete(id)
    // `children: true` não destrói os contextos compartilhados (Graphics só destrói o contexto próprio).
    if (!chama.no.destroyed) chama.no.destroy({ children: true })
  }

  function entrarNoRelogio(): void {
    if (noRelogio || movimento === undefined) return
    noRelogio = true
    conferidoEm = agora()
    movimento.ticker.add(passo)
  }

  function sairDoRelogio(): void {
    if (!noRelogio || movimento === undefined) return
    noRelogio = false
    movimento.ticker.remove(passo)
  }

  function parar(): void {
    parada = true
    for (const chama of chamas.values()) aplicar(chama, POSE_FIXA)
    sairDoRelogio()
    avisar()
  }

  function passo(): void {
    const t = agora()
    if (Math.abs(t - conferidoEm) >= CONFERIR_MOVIMENTO_MS) {
      conferidoEm = t
      if (movimento === undefined || movimento.reducedMotion()) {
        parar()
        return
      }
    }
    for (const [id, chama] of chamas) {
      // O palco morreu antes do desmonte (não devia): esquece a chama em vez de mexer em nó destruído.
      if (chama.no.destroyed) {
        chamas.delete(id)
        continue
      }
      aplicar(chama, escreverPose(t, chama.fase, poseDoQuadro))
    }
    if (chamas.size === 0) {
      sairDoRelogio()
      avisar()
    }
  }

  return {
    colocar(prop, tela) {
      const forma = prop.mobilia === 'fogueira' ? chamaDaFogueira(prop.width, prop.height, vistaDoMovel(prop)) : null
      if (forma === null || !Number.isFinite(prop.x) || !Number.isFinite(prop.y)) {
        remover(prop.id)
        return null
      }
      let chama = chamas.get(prop.id)
      if (chama === undefined || chama.no.destroyed) {
        chama = criar(prop.id)
        chamas.set(prop.id, chama)
      }
      const centro = { x: prop.x, y: prop.y }
      const ancora = rotatePointAround({ x: prop.x + forma.ancora.x, y: prop.y + forma.ancora.y }, centro, rotationTrig(prop.rotation ?? 0))
      // Na 3/4 a chama sobe com a lenha, sempre para cima na tela (não gira com a fogueira).
      chama.no.position.set(ancora.x, ancora.y + forma.desvio + deslocamentoDaChama(prop, tela.vistaDosMoveis))
      chama.altura = forma.altura
      const escala = Number.isFinite(tela.cameraScale) && tela.cameraScale > 0 ? tela.cameraScale : 1
      const raio = Math.max(RAIO_MINIMO_DA_FAGULHA_EM_PX / escala, RAIO_DA_FAGULHA * Math.min(prop.width, prop.height))
      for (const fagulha of chama.fagulhas) fagulha.scale.set(raio / RAIO_DE_REFERENCIA)
      aplicar(chama, poseDaChama(agora(), chama.fase, parada))
      return chama.no
    },
    podar(presentes) {
      for (const id of [...chamas.keys()]) if (!presentes.has(id)) remover(id)
      const reduzido = movimento === undefined || movimento.reducedMotion()
      if (reduzido) {
        // Passou a pedir menos movimento: a chama para na pose fixa, uma vez.
        if (!parada) parar()
      } else {
        parada = false
        if (chamas.size > 0) entrarNoRelogio()
        else sairDoRelogio()
      }
      avisar()
    },
    destruir() {
      sairDoRelogio()
      for (const id of [...chamas.keys()]) remover(id)
      if (contextos !== null) {
        contextos.borda.destroy()
        contextos.miolo.destroy()
        contextos.fagulha.destroy()
        contextos = null
      }
      avisar()
    },
  }
}

/**
 * Tela do JOGADOR: todas as chamas numa camada só (logo acima das silhuetas),
 * dos mesmos objetos que a silhueta desenha — já recortados pela visão, então
 * fogueira que sai da visão leva a chama junto. Devolve quantas chamas há.
 */
export function sincronizarChamas(chamas: ChamasDasFogueiras, camada: Container, props: readonly PropDaChama[], tela: TelaDasChamas): number {
  const presentes = new Set<string>()
  for (const prop of props) {
    const no = chamas.colocar(prop, tela)
    if (no === null) continue
    presentes.add(prop.id)
    if (no.parent !== camada) camada.addChild(no)
  }
  chamas.podar(presentes)
  return presentes.size
}
