import { Container, Graphics, GraphicsContext, type Ticker } from 'pixi.js'
import type { Prop } from '../types/map'
import {
  CASA_DO_FOGO_PX,
  alturaMaximaDaLingua,
  brilhoDoFogo,
  fiosDeFumaca,
  linguasComFagulha,
  linguasDoFogo,
  linguasMaisAltas,
} from '../lib/mobilia/fogo'
import { rotatePointAround, rotationTrig } from '../lib/roomRotation'
import {
  ALTURA_DE_REFERENCIA,
  CICLO_DA_CHAMA_MS,
  RAIO_DE_REFERENCIA,
  criarFormasDaChama,
  escreverPose,
  faseDaFogueira,
  novaPose,
  type FormasDaChama,
  type PoseReescrita,
} from './chamasDasFogueiras'

/**
 * OS FOGOS DO MAPA (objeto Fogo, `docs/design/objeto-fogo/README.md`, decisões
 * do mestre de 27/10/2026): a parte que MEXE de cada fogo. O chão queimado é a
 * imagem do móvel (`texturas/meioTermo/moveis/fogo.ts`), pintada uma vez; aqui
 * moram as línguas (a MESMA chama da fogueira, `chamasDasFogueiras.ts`, várias
 * conforme a pegada), o brilho no chão, as fagulhas e a fumaça.
 *
 *   camada (grupo de render próprio, POR CIMA dos telhados)
 *     ├ brilhos  (um disco por fogo)
 *     ├ chamas   (as línguas de cada fogo, de trás para a frente, e as fagulhas)
 *     └ fumaça   (as nuvens de cada fogo)
 *
 * Três subcamadas: a fumaça de um fogo não fica embaixo da chama do vizinho. As
 * formas são as da fogueira, desenhadas UMA vez por tela; por quadro só mudam
 * escala, posição e alpha. Sem shader, sem filtro, sem mistura aditiva.
 *
 * DESEMPENHO (mapas de 200 x 200): só anima o que está na tela. A cada mudança
 * de câmera (`ajustarAVista`) o fogo cujo retângulo (com brilho, fagulha e
 * fumaça) sai da vista fica `renderable = false` e sai do relógio; isso nunca
 * muda por quadro. O relógio (`app.ticker`) só fica inscrito com ao menos um
 * fogo na vista. Fogo fora da câmera custa zero por quadro.
 *
 * "Menos movimento": cada língua para numa pose (cada uma numa diferente), as
 * fagulhas somem, a fumaça fica parada e só o brilho respira devagar (ciclo de
 * 4 s, 10 quadros por segundo). Sem relógio (testes, exportar imagem), tudo
 * fica parado na pose fixa.
 */

/** O que o fogo lê do objeto. */
export type PropDoFogo = Pick<Prop, 'id' | 'x' | 'y' | 'width' | 'height' | 'rotation' | 'mobilia' | 'hidden' | 'secret'>

/** O pedaço do mundo à vista (`vistaDaCamera` de `drawTexturas.ts`). */
export interface CaixaDaVista {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface TelaDosFogos {
  cameraScale: number
  /** Px de mundo por casa do mapa: abaixo de `CASA_PX_SEM_FAGULHA` na tela as fagulhas somem e a fumaça cai à metade. */
  grade: number
  /** Transparência de cada fogo (o fantasma do "Oculto" no editor). Ausente = 1. */
  alfa?: (prop: PropDoFogo) => number
}

export interface MovimentoDosFogos {
  /** O relógio de quadros do Pixi: inscrito só com fogo na vista. */
  ticker: Pick<Ticker, 'add' | 'remove'>
  /** `prefers-reduced-motion`, relido a cada passada e, com o relógio vivo, uma vez por segundo. */
  reducedMotion: () => boolean
  /** Agora, em ms. Padrão `performance.now()`. */
  agora?: () => number
}

/** O que a tela anota para a medida de desempenho e a conferência. */
export interface EstadoDosFogos {
  fogos: number
  naVista: number
  animando: boolean
}

export interface OpcoesDosFogos {
  /** Sem isto nada anima: tudo fica na pose fixa. */
  movimento?: MovimentoDosFogos
  aoMudar?: (estado: EstadoDosFogos) => void
}

export interface FogosDoMapa {
  /** A camada inteira: quem chama a põe na pilha, acima dos telhados. */
  readonly camada: Container
  /**
   * Fim de uma passada de desenho: cria ou acerta o fogo de cada objeto `fogo`
   * de `props` e tira o de quem não está mais. Devolve quantos fogos há.
   */
  sincronizar: (props: readonly PropDoFogo[], tela: TelaDosFogos) => number
  /** A câmera andou: o fogo fora de `vista` sai do relógio (`null` = sem recorte). */
  ajustarAVista: (vista: CaixaDaVista | null) => void
  estado: () => EstadoDosFogos
  destruir: () => void
}

/** Abaixo disto (px de tela por casa) as fagulhas ficariam do tamanho de um pixel. */
export const CASA_PX_SEM_FAGULHA = 30
/** Com "menos movimento" o brilho respira num ciclo de 4 s, redesenhado a 10 quadros por segundo. */
const CICLO_DO_BRILHO_REDUZIDO_MS = 4000
const QUADRO_REDUZIDO_MS = 100
const CONFERIR_MOVIMENTO_MS = 1000
/** Fase entre as línguas do mesmo fogo (a do protótipo): cada uma no seu passo. */
const PASSO_ENTRE_LINGUAS = 0.137
/** A fagulha: raio em fração da casa, nunca menor que `RAIO_MINIMO_DA_FAGULHA_PX` na tela. */
const RAIO_DA_FAGULHA = 0.028
const RAIO_MINIMO_DA_FAGULHA_PX = 1.2
/** Brilho no chão: transparência de base, o piscar (0,84 a 1 dela) e o pulso da escala (3%). */
const ALFA_DO_BRILHO = 0.62
const PISCAR_MINIMO = 0.84
const PULSO_DA_ESCALA = 0.03
const RESPIRAR_MINIMO = 0.93
/** Raio do disco do brilho e da nuvem de fumaça na unidade das formas. */
const RAIO_DO_BRILHO = 64
const RAIO_DA_NUVEM = 32
/** Fumaça: as medidas da Chama (em casas e ms); as maiores crescem com a língua mais alta. */
const FUMACA = { s0: 0.24, s1: 0.68, sobe: 1.65, vento: 0.36, alfa: 0.32, vida: 4200 }
const NUVENS_POR_FIO_PEQUENO = 3
const NUVENS_POR_FIO = 4
/** Com "menos movimento", quantas nuvens ficam paradas em cada fio. */
const NUVENS_PARADAS = 2

/** Anéis do brilho, de fora para dentro: [raio em fração, cor, alpha] — o laranja do fogo passando ao tom do miolo. */
const ANEIS_DO_BRILHO: readonly (readonly [number, number, number])[] = [
  [1, 0xe39446, 0.1],
  [0.8, 0xe39446, 0.12],
  [0.6, 0xe8a85e, 0.14],
  [0.42, 0xedbb76, 0.16],
  [0.26, 0xf0c98a, 0.18],
]
/** Anéis da nuvem: o cinza quente do README, borda mais clara e rala. */
const ANEIS_DA_NUVEM: readonly (readonly [number, number, number])[] = [
  [1, 0x78706a, 0.35],
  [0.72, 0x6a625c, 0.45],
  [0.45, 0x5d5650, 0.55],
]

interface Formas extends FormasDaChama {
  brilho: GraphicsContext
  nuvem: GraphicsContext
}

function contextoDeAneis(raio: number, aneis: readonly (readonly [number, number, number])[]): GraphicsContext {
  const contexto = new GraphicsContext()
  for (const [fracao, cor, alpha] of aneis) contexto.circle(0, 0, raio * fracao).fill({ color: cor, alpha })
  return contexto
}

function fracao(valor: number): number {
  return valor - Math.floor(valor)
}

function suave(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

interface LinguaNoPalco {
  borda: Graphics
  miolo: Graphics
  /** Base em px de mundo, relativa ao centro do fogo (já girada com o objeto). */
  x: number
  y: number
  /** H em px de mundo. */
  altura: number
  fase: number
  /** As 3 fagulhas, se esta língua solta fagulha. */
  fagulhas: Graphics[]
}

interface NuvemNoPalco {
  desenho: Graphics
  /** A língua de onde o fio sai. */
  lingua: LinguaNoPalco
  i: number
  fio: number
}

interface FogoNoPalco {
  brilhos: Container
  chamas: Container
  fumaca: Container
  brilho: Graphics
  linguas: LinguaNoPalco[]
  nuvens: NuvemNoPalco[]
  nuvensPorFio: number
  /** Escala de repouso do brilho (x, y). */
  brilhoX: number
  brilhoY: number
  fase: number
  /** Medidas da fumaça em px de mundo e ms. */
  medidasDaFumaca: { s0: number; s1: number; sobe: number; vento: number; alfa: number; vida: number }
  /** A pegada e o giro que a última montagem leu: a mesma = os nós continuam valendo. */
  forma: string
  /** O retângulo do fogo inteiro (brilho, línguas, fagulhas, fumaça) em volta do centro, e ele já no lugar, em px de mundo. */
  caixaRelativa: CaixaDaVista
  caixa: CaixaDaVista
  naVista: boolean
}

function ehFogoDesenhavel(prop: PropDoFogo): boolean {
  return (
    prop.mobilia === 'fogo' &&
    Number.isFinite(prop.x) &&
    Number.isFinite(prop.y) &&
    Number.isFinite(prop.width) &&
    Number.isFinite(prop.height) &&
    prop.width > 0 &&
    prop.height > 0
  )
}

function cruza(a: CaixaDaVista, b: CaixaDaVista): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY
}

/**
 * Cria os fogos de uma tela, com as formas e o relógio fechados por closure:
 * instanciar dentro do setup de cada montagem (editor e jogador), nunca em
 * escopo de módulo, como `createChamasDasFogueiras`.
 */
export function createFogosDoMapa(opcoes: OpcoesDosFogos = {}): FogosDoMapa {
  const { movimento, aoMudar } = opcoes
  const agora = movimento?.agora ?? (() => performance.now())
  const camada = new Container()
  camada.label = 'fogos'
  camada.eventMode = 'none'
  camada.interactiveChildren = false
  // Grupo de render próprio: fogo que entra ou sai da vista refaz só as instruções desta camada.
  camada.enableRenderGroup()
  const brilhos = new Container()
  brilhos.label = 'brilhos'
  const chamas = new Container()
  chamas.label = 'chamas'
  const fumacas = new Container()
  fumacas.label = 'fumaca'
  camada.addChild(brilhos, chamas, fumacas)

  const fogos = new Map<string, FogoNoPalco>()
  const pose: PoseReescrita = novaPose()
  let formas: Formas | null = null
  let vista: CaixaDaVista | null = null
  let noRelogio = false
  let reduzido = movimento === undefined || movimento.reducedMotion()
  let comFagulha = true
  let conferidoEm = 0
  let ultimoQuadroReduzido = -Infinity
  let avisado = ''

  /** As formas nascem com o primeiro fogo e ficam até o fim. */
  function asFormas(): Formas {
    if (formas !== null) return formas
    formas = { ...criarFormasDaChama(), brilho: contextoDeAneis(RAIO_DO_BRILHO, ANEIS_DO_BRILHO), nuvem: contextoDeAneis(RAIO_DA_NUVEM, ANEIS_DA_NUVEM) }
    return formas
  }

  function contarNaVista(): number {
    let n = 0
    for (const fogo of fogos.values()) if (fogo.naVista) n += 1
    return n
  }

  function estado(): EstadoDosFogos {
    return { fogos: fogos.size, naVista: contarNaVista(), animando: noRelogio }
  }

  function avisar(): void {
    const e = estado()
    const chave = `${e.fogos}:${e.naVista}:${e.animando}`
    if (chave === avisado) return
    avisado = chave
    aoMudar?.(e)
  }

  function remover(id: string): void {
    const fogo = fogos.get(id)
    if (fogo === undefined) return
    fogos.delete(id)
    // `children: true` não destrói os contextos compartilhados (Graphics só destrói o contexto próprio).
    for (const no of [fogo.brilhos, fogo.chamas, fogo.fumaca]) if (!no.destroyed) no.destroy({ children: true })
  }

  /** Monta os nós de um fogo para a pegada e o giro de agora (só quando a leitura muda). */
  function montar(prop: PropDoFogo, anterior: FogoNoPalco | undefined): FogoNoPalco {
    if (anterior !== undefined) remover(prop.id)
    const f = asFormas()
    const casasW = prop.width / CASA_DO_FOGO_PX
    const casasH = prop.height / CASA_DO_FOGO_PX
    const trig = rotationTrig(prop.rotation ?? 0)
    const origem = { x: 0, y: 0 }
    const fase = faseDaFogueira(prop.id)
    const disposicao = linguasDoFogo(casasW, casasH)
    // A base gira com o chão queimado; a chama não gira (fica sempre em pé na tela).
    const linguas: LinguaNoPalco[] = disposicao.map((lingua, i) => {
      const base = rotatePointAround({ x: lingua.x * CASA_DO_FOGO_PX, y: lingua.y * CASA_DO_FOGO_PX }, origem, trig)
      const borda = new Graphics(f.borda)
      borda.label = 'borda'
      const miolo = new Graphics(f.miolo)
      miolo.label = 'miolo'
      borda.position.set(base.x, base.y)
      miolo.position.set(base.x, base.y)
      return { borda, miolo, x: base.x, y: base.y, altura: lingua.altura * CASA_DO_FOGO_PX, fase: fase + i * PASSO_ENTRE_LINGUAS, fagulhas: [] }
    })
    for (const i of linguasMaisAltas(disposicao, linguasComFagulha(disposicao.length))) {
      linguas[i].fagulhas = [0, 1, 2].map(() => {
        const fagulha = new Graphics(f.fagulha)
        fagulha.label = 'fagulha'
        fagulha.alpha = 0
        return fagulha
      })
    }
    const chamasNo = new Container()
    chamasNo.label = `fogo:${prop.id}`
    // De trás para a frente depois do giro: a língua da frente cobre a de trás.
    for (const lingua of [...linguas].sort((a, b) => a.y - b.y)) chamasNo.addChild(lingua.borda, lingua.miolo)
    for (const lingua of linguas) if (lingua.fagulhas.length > 0) chamasNo.addChild(...lingua.fagulhas)

    const brilhoDaPegada = brilhoDoFogo(casasW, casasH)
    const deLado = Math.abs(trig.sin) > Math.abs(trig.cos)
    const rx = (deLado ? brilhoDaPegada.ry : brilhoDaPegada.rx) * CASA_DO_FOGO_PX
    const ry = (deLado ? brilhoDaPegada.rx : brilhoDaPegada.ry) * CASA_DO_FOGO_PX
    const centroDoBrilho = rotatePointAround({ x: 0, y: brilhoDaPegada.cy * CASA_DO_FOGO_PX }, origem, trig)
    const brilho = new Graphics(f.brilho)
    brilho.label = 'brilho'
    brilho.position.set(centroDoBrilho.x, centroDoBrilho.y)
    const brilhosNo = new Container()
    brilhosNo.label = `brilho:${prop.id}`
    brilhosNo.addChild(brilho)

    const k = alturaMaximaDaLingua(casasW, casasH) / alturaMaximaDaLingua(1, 1)
    const medidas = {
      s0: FUMACA.s0 * k * CASA_DO_FOGO_PX,
      s1: FUMACA.s1 * k * CASA_DO_FOGO_PX,
      sobe: FUMACA.sobe * k * CASA_DO_FOGO_PX,
      vento: FUMACA.vento * k * CASA_DO_FOGO_PX,
      alfa: FUMACA.alfa + 0.04 * (k - 1),
      vida: FUMACA.vida + 1000 * (k - 1),
    }
    const nuvensPorFio = disposicao.length >= 5 ? NUVENS_POR_FIO : NUVENS_POR_FIO_PEQUENO
    const fumacaNo = new Container()
    fumacaNo.label = `fumaca:${prop.id}`
    const nuvens: NuvemNoPalco[] = []
    linguasMaisAltas(disposicao, fiosDeFumaca(disposicao.length)).forEach((indice, fio) => {
      for (let i = 0; i < nuvensPorFio; i += 1) {
        const desenho = new Graphics(f.nuvem)
        desenho.label = 'nuvem'
        desenho.alpha = 0
        fumacaNo.addChild(desenho)
        nuvens.push({ desenho, lingua: linguas[indice], i, fio })
      }
    })

    // O retângulo inteiro: brilho, línguas com fagulha (sobem ~1,6 H) e a fumaça que sobe e vai com o vento.
    let minX = centroDoBrilho.x - rx
    let maxX = centroDoBrilho.x + rx
    let minY = centroDoBrilho.y - ry
    let maxY = centroDoBrilho.y + ry
    for (const lingua of linguas) {
      minX = Math.min(minX, lingua.x - 0.45 * lingua.altura)
      maxX = Math.max(maxX, lingua.x + 0.45 * lingua.altura)
      minY = Math.min(minY, lingua.y - 1.6 * lingua.altura)
      maxY = Math.max(maxY, lingua.y + 0.1 * lingua.altura)
    }
    for (const { lingua } of nuvens) {
      minX = Math.min(minX, lingua.x - medidas.s1)
      maxX = Math.max(maxX, lingua.x + medidas.vento + medidas.s1)
      minY = Math.min(minY, lingua.y - 0.95 * lingua.altura - medidas.sobe - medidas.s1)
    }
    brilhos.addChild(brilhosNo)
    chamas.addChild(chamasNo)
    fumacas.addChild(fumacaNo)
    return {
      brilhos: brilhosNo,
      chamas: chamasNo,
      fumaca: fumacaNo,
      brilho,
      linguas,
      nuvens,
      nuvensPorFio,
      brilhoX: rx / RAIO_DO_BRILHO,
      brilhoY: ry / RAIO_DO_BRILHO,
      fase,
      medidasDaFumaca: medidas,
      forma: '',
      caixaRelativa: { minX, minY, maxX, maxY },
      caixa: { minX: prop.x + minX, minY: prop.y + minY, maxX: prop.x + maxX, maxY: prop.y + maxY },
      naVista: true,
    }
  }

  /** Só números: a língua na pose, as fagulhas dela, o brilho e a fumaça no instante `t`. */
  function aplicarMovendo(fogo: FogoNoPalco, t: number): void {
    for (const lingua of fogo.linguas) {
      escreverPose(t, lingua.fase, pose)
      const k = lingua.altura / ALTURA_DE_REFERENCIA
      lingua.borda.scale.set(k * pose.escalaX, k * pose.escalaY)
      lingua.miolo.scale.set(k * pose.escalaX, k * pose.escalaY)
      lingua.miolo.alpha = pose.alpha
      for (let i = 0; i < lingua.fagulhas.length; i += 1) {
        const saida = pose.fagulhas[i]
        const desenho = lingua.fagulhas[i]
        desenho.position.set(lingua.x + saida.x * lingua.altura, lingua.y + saida.y * lingua.altura)
        desenho.alpha = comFagulha ? saida.alpha : 0
      }
    }
    const volta = 2 * Math.PI
    const u = fracao(t / CICLO_DA_CHAMA_MS + fogo.fase)
    const piscar = 0.5 + 0.35 * Math.sin(volta * 4 * u + 0.7) + 0.15 * Math.sin(volta * 9 * u + 2.2)
    fogo.brilho.alpha = ALFA_DO_BRILHO * (PISCAR_MINIMO + (1 - PISCAR_MINIMO) * piscar)
    const pulso = 1 + PULSO_DA_ESCALA * Math.sin(volta * 2 * u + 1.1)
    fogo.brilho.scale.set(fogo.brilhoX * pulso, fogo.brilhoY * pulso)
    const m = fogo.medidasDaFumaca
    for (const nuvem of fogo.nuvens) {
      // Na zoom Longe a fumaça cai à metade: as ímpares ficam apagadas.
      if (!comFagulha && nuvem.i % 2 === 1) {
        nuvem.desenho.alpha = 0
        continue
      }
      const p = fracao(t / m.vida + fogo.fase + nuvem.i / fogo.nuvensPorFio + nuvem.fio * 0.37)
      const { lingua } = nuvem
      nuvem.desenho.position.set(
        lingua.x + m.vento * Math.pow(p, 1.4) + 0.09 * CASA_DO_FOGO_PX * Math.sin(volta * (p * 0.9 + nuvem.i * 0.31 + fogo.fase)),
        lingua.y - 0.95 * lingua.altura - m.sobe * p,
      )
      nuvem.desenho.scale.set((m.s0 + (m.s1 - m.s0) * p) / (2 * RAIO_DA_NUVEM))
      nuvem.desenho.alpha = m.alfa * suave(0, 0.18, p) * (1 - suave(0.45, 1, p))
    }
  }

  /** A pose parada: cada língua numa pose própria, sem fagulha, fumaça em 2 nuvens por fio, brilho respirando em `t`. */
  function aplicarParado(fogo: FogoNoPalco, t: number): void {
    for (const lingua of fogo.linguas) {
      escreverPose(0, lingua.fase, pose)
      const k = lingua.altura / ALTURA_DE_REFERENCIA
      lingua.borda.scale.set(k * pose.escalaX, k * pose.escalaY)
      lingua.miolo.scale.set(k * pose.escalaX, k * pose.escalaY)
      lingua.miolo.alpha = pose.alpha
      for (const fagulha of lingua.fagulhas) fagulha.alpha = 0
    }
    respirar(fogo, t)
    const m = fogo.medidasDaFumaca
    for (const nuvem of fogo.nuvens) {
      if (nuvem.i >= NUVENS_PARADAS) {
        nuvem.desenho.alpha = 0
        continue
      }
      const p = fracao(nuvem.i / fogo.nuvensPorFio + 0.1 + nuvem.fio * 0.37)
      const { lingua } = nuvem
      nuvem.desenho.position.set(lingua.x + m.vento * Math.pow(p, 1.4), lingua.y - 0.95 * lingua.altura - m.sobe * p)
      nuvem.desenho.scale.set((m.s0 + (m.s1 - m.s0) * p) / (2 * RAIO_DA_NUVEM))
      nuvem.desenho.alpha = 0.85 * m.alfa * suave(0, 0.18, p) * (1 - suave(0.45, 1, p))
    }
  }

  /** "Menos movimento": só o brilho muda, num ciclo de 4 s entre 0,93 e 1 da transparência. */
  function respirar(fogo: FogoNoPalco, t: number): void {
    const u = fracao(t / CICLO_DO_BRILHO_REDUZIDO_MS + fogo.fase)
    fogo.brilho.alpha = ALFA_DO_BRILHO * (RESPIRAR_MINIMO + (1 - RESPIRAR_MINIMO) * (0.5 + 0.5 * Math.sin(2 * Math.PI * u)))
    fogo.brilho.scale.set(fogo.brilhoX, fogo.brilhoY)
  }

  function passo(): void {
    const t = agora()
    if (movimento !== undefined && Math.abs(t - conferidoEm) >= CONFERIR_MOVIMENTO_MS) {
      conferidoEm = t
      const agoraReduzido = movimento.reducedMotion()
      if (agoraReduzido !== reduzido) {
        reduzido = agoraReduzido
        for (const fogo of fogos.values()) if (fogo.naVista) (reduzido ? aplicarParado : aplicarMovendo)(fogo, t)
      }
    }
    if (reduzido) {
      if (t - ultimoQuadroReduzido < QUADRO_REDUZIDO_MS) return
      ultimoQuadroReduzido = t
      for (const fogo of fogos.values()) if (fogo.naVista && !fogo.chamas.destroyed) respirar(fogo, t)
      return
    }
    for (const fogo of fogos.values()) if (fogo.naVista && !fogo.chamas.destroyed) aplicarMovendo(fogo, t)
  }

  /** O relógio só fica inscrito com movimento e ao menos um fogo na vista. */
  function acertarRelogio(): void {
    const querRelogio = movimento !== undefined && contarNaVista() > 0
    if (querRelogio && !noRelogio && movimento !== undefined) {
      noRelogio = true
      conferidoEm = agora()
      movimento.ticker.add(passo)
    } else if (!querRelogio && noRelogio && movimento !== undefined) {
      noRelogio = false
      movimento.ticker.remove(passo)
    }
    avisar()
  }

  /** Marca quem está na vista: o resto fica sem desenhar (`renderable`) e fora da conta do relógio. */
  function recortar(fogo: FogoNoPalco): void {
    const naVista = vista === null || cruza(fogo.caixa, vista)
    if (naVista === fogo.naVista) return
    fogo.naVista = naVista
    fogo.brilhos.renderable = naVista
    fogo.chamas.renderable = naVista
    fogo.fumaca.renderable = naVista
    // Volta à vista com a pose de agora, antes do primeiro quadro do relógio.
    if (naVista) (reduzido ? aplicarParado : aplicarMovendo)(fogo, agora())
  }

  return {
    camada,
    sincronizar(props, tela) {
      const t = agora()
      if (movimento !== undefined) {
        const agoraReduzido = movimento.reducedMotion()
        // Passou a pedir (ou deixou de pedir) menos movimento: cada fogo vai já para a pose certa.
        if (agoraReduzido !== reduzido) {
          reduzido = agoraReduzido
          for (const fogo of fogos.values()) if (fogo.naVista) (reduzido ? aplicarParado : aplicarMovendo)(fogo, t)
        }
      }
      const escala = Number.isFinite(tela.cameraScale) && tela.cameraScale > 0 ? tela.cameraScale : 1
      comFagulha = tela.grade * escala >= CASA_PX_SEM_FAGULHA
      const raioDaFagulha = Math.max(RAIO_MINIMO_DA_FAGULHA_PX / escala, RAIO_DA_FAGULHA * CASA_DO_FOGO_PX) / RAIO_DE_REFERENCIA
      const presentes = new Set<string>()
      for (const prop of props) {
        if (!ehFogoDesenhavel(prop)) continue
        presentes.add(prop.id)
        const forma = `${prop.width}|${prop.height}|${prop.rotation ?? 0}`
        let fogo = fogos.get(prop.id)
        if (fogo === undefined || fogo.chamas.destroyed || fogo.forma !== forma) {
          // Pegada ou giro novos: as línguas mudam de número e de lugar, os nós são refeitos.
          fogo = montar(prop, fogo)
          fogo.forma = forma
          fogos.set(prop.id, fogo)
          fogo.naVista = vista === null || cruza(fogo.caixa, vista)
          for (const no of [fogo.brilhos, fogo.chamas, fogo.fumaca]) no.renderable = fogo.naVista
          ;(reduzido || movimento === undefined ? aplicarParado : aplicarMovendo)(fogo, t)
        }
        // Só andou (o arrasto): os nós vão junto, nada é refeito.
        if (fogo.chamas.x !== prop.x || fogo.chamas.y !== prop.y) {
          for (const no of [fogo.brilhos, fogo.chamas, fogo.fumaca]) no.position.set(prop.x, prop.y)
          const r = fogo.caixaRelativa
          fogo.caixa = { minX: prop.x + r.minX, minY: prop.y + r.minY, maxX: prop.x + r.maxX, maxY: prop.y + r.maxY }
          recortar(fogo)
        }
        for (const lingua of fogo.linguas) for (const fagulha of lingua.fagulhas) fagulha.scale.set(raioDaFagulha)
        const alfa = tela.alfa?.(prop) ?? 1
        fogo.brilhos.alpha = alfa
        fogo.chamas.alpha = alfa
        fogo.fumaca.alpha = alfa
      }
      for (const id of [...fogos.keys()]) if (!presentes.has(id)) remover(id)
      acertarRelogio()
      return fogos.size
    },
    ajustarAVista(nova) {
      vista = nova
      for (const fogo of fogos.values()) recortar(fogo)
      acertarRelogio()
    },
    estado,
    destruir() {
      if (noRelogio && movimento !== undefined) movimento.ticker.remove(passo)
      noRelogio = false
      for (const id of [...fogos.keys()]) remover(id)
      if (formas !== null) {
        for (const contexto of [formas.borda, formas.miolo, formas.fagulha, formas.brilho, formas.nuvem]) contexto.destroy()
        formas = null
      }
      if (!camada.destroyed) camada.destroy({ children: true })
      avisar()
    },
  }
}
