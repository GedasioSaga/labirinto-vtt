import { Container, Point, Sprite, Texture, type Ticker } from 'pixi.js'
import type { AuraDaFicha, TipoDeAura } from '../../lib/auras'
import { theme } from '../../theme'
import { colunaDaCor, plantaDoAtlas, texturasDaAura } from './atlasDaAura'
import { ATRAS, criarSaida, estadoDaAura, PERIODO, poseDaAura, sementeDaAura, sorteio, SOMA, type MisturaDaAura, type SaidaDaAura } from './estadoDaAura'

/**
 * AURA DA FICHA no mapa (Pixi 8), a mesma para o MESTRE (`pixi/tokensRenderer.ts`)
 * e para o JOGADOR (`player/PlayerView.tsx`). Cada ficha com aura ganha duas
 * camadas dentro do invólucro dela: `atras` (o filho 0, por baixo da foto) e
 * `frente` (logo acima da moldura e dos aros, por baixo da barra, do nome e
 * das marcas: o raio e a faísca cruzam o latão, nunca o rosto nem o texto).
 *
 * Um sprite por item do quadro (`estadoDaAura`), todos recortes da textura da
 * aura (`atlasDaAura.ts`), com a mistura de cada item: o corpo e o brilho de
 * fundo em mistura normal, as luzes pequenas somadas ('add', o 'lighter' da
 * página). As contas são em px de TELA, como na prova: as camadas desfazem o
 * zoom da câmera (escala 1/zoom), e o raio entra já multiplicado por ele.
 */

/** Quanto a aura passa do raio da ficha, no pior caso (chamas e brilho): a margem do "está na tela". */
const ALCANCE_DA_AURA = 2.3
/** De quanto em quanto tempo o "menos movimento" do sistema é relido (ms), como em `particulasDoMapa.ts`. */
const CONFERIR_MOVIMENTO_MS = 1000
/** A aura acende no tempo de assentar da ficha e apaga mais rápido do que acende (só opacidade). */
const ENTRADA_MS = Number.parseFloat(theme.motion.base)
const SAIDA_MS = Number.parseFloat(theme.motion.fast)

/** Responde já e assenta no fim, como o assentar da ficha (`tokensRenderer.ts`). */
function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

interface SpriteDaAura {
  sprite: Sprite
  mistura: MisturaDaAura
}

/** As duas camadas de uma ficha e os sprites que elas reaproveitam a cada quadro. */
export interface VistaDaAura {
  readonly atras: Container
  readonly frente: Container
  readonly tipo: TipoDeAura
  /** Atraso desta ficha no laço (s): duas fichas com a mesma aura não batem juntas. */
  readonly fase: number
  readonly saida: SaidaDaAura
  readonly spritesAtras: SpriteDaAura[]
  readonly spritesFrente: SpriteDaAura[]
  /** O que o último quadro pintou (tempo, raio na tela e zoom); `null` = nada ainda. */
  pintado: { t: number; raio: number; escala: number } | null
}

/** Hash curto do id da ficha: a mesma ficha tem a mesma fase no mestre e no jogador. */
function hashDoId(id: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < id.length; i += 1) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193)
  return h | 0
}

/** O atraso da ficha `id` no laço da aura, de 0 a PERIODO segundos. */
export function faseDaFicha(id: string): number {
  return sorteio(hashDoId(id), 17, 29) * PERIODO
}

/** O instante do laço agora, num relógio que o mestre e o jogador compartilham (o da parede). */
export function instanteDaAura(fase: number, agoraMs: number): number {
  return (((agoraMs / 1000 + fase) % PERIODO) + PERIODO) % PERIODO
}

function criarCamada(rotulo: string): Container {
  const camada = new Container()
  camada.label = rotulo
  // A aura não é alvo de clique: o toque e o arrasto continuam sendo da ficha.
  camada.eventMode = 'none'
  camada.interactiveChildren = false
  return camada
}

export function criarVistaDaAura(tipo: TipoDeAura, tokenId: string): VistaDaAura {
  return {
    atras: criarCamada('aura-atras'),
    frente: criarCamada('aura-frente'),
    tipo,
    fase: faseDaFicha(tokenId),
    saida: criarSaida(),
    spritesAtras: [],
    spritesFrente: [],
    pintado: null,
  }
}

function proximoSprite(lista: SpriteDaAura[], usados: number, camada: Container): SpriteDaAura {
  let item = lista[usados]
  if (item === undefined) {
    const sprite = new Sprite(Texture.EMPTY)
    sprite.anchor.set(0.5)
    sprite.eventMode = 'none'
    camada.addChild(sprite)
    item = { sprite, mistura: 0 }
    lista.push(item)
  }
  return item
}

function esconderDesde(lista: readonly SpriteDaAura[], usados: number): void {
  for (let i = usados; i < lista.length; i += 1) {
    const { sprite } = lista[i]
    if (!sprite.visible) break
    sprite.visible = false
  }
}

/**
 * O quadro `t` da aura na ficha de raio `raioNaTela` (px de tela). `escala` é
 * o zoom da câmera: as camadas o desfazem para os sprites ficarem em px de tela.
 */
export function pintarVistaDaAura(vista: VistaDaAura, t: number, raioNaTela: number, escala: number): void {
  const k = escala > 0 ? 1 / escala : 1
  vista.atras.scale.set(k)
  vista.frente.scale.set(k)
  const { saida } = vista
  estadoDaAura(vista.tipo, t, raioNaTela, sementeDaAura(vista.tipo), saida)
  const { quadros } = texturasDaAura(vista.tipo)
  const { linhas } = plantaDoAtlas(vista.tipo)
  let usadosAtras = 0
  let usadosFrente = 0
  for (let i = 0; i < saida.n; i += 1) {
    const it = saida.itens[i]
    const atras = it.camada === ATRAS
    const item = atras ? proximoSprite(vista.spritesAtras, usadosAtras, vista.atras) : proximoSprite(vista.spritesFrente, usadosFrente, vista.frente)
    if (atras) usadosAtras += 1
    else usadosFrente += 1
    const linha = linhas[it.pincel]
    const { sprite } = item
    sprite.texture = quadros[it.pincel][colunaDaCor(linha, it.cor)]
    if (item.mistura !== it.mistura) {
      item.mistura = it.mistura
      sprite.blendMode = it.mistura === SOMA ? 'add' : 'normal'
    }
    sprite.position.set(it.x, it.y)
    sprite.scale.set(it.w / linha.forma.w, it.h / linha.forma.h)
    sprite.rotation = it.rot
    sprite.alpha = it.alfa
    sprite.visible = true
  }
  esconderDesde(vista.spritesAtras, usadosAtras)
  esconderDesde(vista.spritesFrente, usadosFrente)
  vista.pintado = { t, raio: raioNaTela, escala }
}

/** O quadro parado (movimento reduzido, desenho sem relógio): o mesmo da página de prova. */
export function posarVistaDaAura(vista: VistaDaAura, raioNaTela: number, escala: number): void {
  const pose = poseDaAura(vista.tipo, sementeDaAura(vista.tipo))
  const { pintado } = vista
  if (pintado !== null && pintado.t === pose && pintado.raio === raioNaTela && pintado.escala === escala) return
  pintarVistaDaAura(vista, pose, raioNaTela, escala)
}

/**
 * As camadas no invólucro da ficha: `atras` vira o filho 0 (por baixo da foto
 * e do disco) e `frente` fica logo acima de `acimaDe` (a moldura ou o aro mais
 * de fora). Chamar depois de a ficha ganhar o visual dela: quem nasce no índice
 * 0 depois empurraria a aura para cima da foto.
 */
export function encaixarVistaDaAura(wrapper: Container, vista: VistaDaAura, acimaDe: Container): void {
  if (vista.atras.parent !== wrapper || wrapper.getChildIndex(vista.atras) !== 0) wrapper.addChildAt(vista.atras, 0)
  if (vista.frente.parent !== wrapper) wrapper.addChild(vista.frente)
  // Sem a referência no invólucro (não deveria acontecer), a frente fica onde está, e nada quebra.
  if (acimaDe.parent !== wrapper) return
  // `addChildAt` de quem já é filho tira e reinsere: o índice certo é o de depois da retirada.
  const indiceDaFrente = wrapper.getChildIndex(vista.frente)
  const indiceDoAlvo = wrapper.getChildIndex(acimaDe)
  const alvo = indiceDaFrente < indiceDoAlvo ? indiceDoAlvo : indiceDoAlvo + 1
  if (indiceDaFrente !== alvo) wrapper.addChildAt(vista.frente, alvo)
}

export function destruirVistaDaAura(vista: VistaDaAura): void {
  // As texturas são da aura (uma por tipo, a sessão inteira): só os sprites e as camadas morrem.
  for (const camada of [vista.atras, vista.frente]) {
    if (camada.destroyed) continue
    camada.removeFromParent()
    camada.destroy({ children: true })
  }
}

/**
 * O nó aparece de verdade: ele e todos os de cima visíveis e com opacidade.
 * A ficha numa camada escondida ou noutro andar não anima: mexer nos sprites
 * dela faria a tela inteira desenhar a cada quadro sem nada aparecer.
 */
function aparece(no: Container): boolean {
  for (let atual: Container | null = no; atual !== null; atual = atual.parent) {
    if (!atual.visible || !atual.renderable || atual.alpha <= 0) return false
  }
  return true
}

function definirAlfa(vista: VistaDaAura, alfa: number): void {
  vista.atras.alpha = alfa
  vista.frente.alpha = alfa
}

/** O que as auras de um desenho precisam para animar; sem isto, ficam paradas no quadro da prova. */
export interface MovimentoDasAuras {
  /**
   * O relógio de quadros CRU (`app.ticker`), não o do desenho sob pedido: a
   * aura fora da tela não pinta nada, e assim não obriga a tela a desenhar
   * (`pixi/desenhoSobPedido.ts`). Os sprites que mudam já pedem o quadro.
   */
  quadros: Pick<Ticker, 'add' | 'remove'>
  /** `prefers-reduced-motion`; relido a cada segundo. */
  reducedMotion: () => boolean
  /** O tamanho da tela em px (`app.screen`): só anima a aura de ficha à vista. */
  tela: () => { width: number; height: number }
  /** Agora, em ms, num relógio de parede (padrão `Date.now()`): o mestre e o jogador veem o mesmo quadro. */
  agora?: () => number
}

/** Uma ficha com aura: a vista e o que a pintura precisa saber dela. */
interface FichaComAura {
  vista: VistaDaAura
  wrapper: Container
  /** Raio da ficha em px de mundo (com a moldura). */
  raio: number
  /** A opacidade da ficha (Volto já apaga a foto e a aura juntas). */
  alfa: number
  /** Quando ela acendeu (ms de `performance.now()`); `null` = já acesa de todo. */
  acendeuEm: number | null
}

/** Aura que acabou de sair (desligada ou trocada): apaga e só então morre. */
interface AuraApagando {
  /** De que ficha, e em que invólucro: religada a tempo, volta a acender de onde estava. */
  id: string
  wrapper: Container
  vista: VistaDaAura
  alfa: number
  desde: number
}

/** As auras das fichas de um desenho (o mapa do mestre ou a tela do jogador). */
export interface AurasNoMapa {
  /**
   * Depois de pintar a ficha `id`: liga, troca ou tira a aura dela (`null` ou
   * desligada tira). `raio` em px de mundo, com a moldura; `acimaDe` = o filho
   * do invólucro logo abaixo da camada da frente; `alfa` = o da foto.
   */
  sincronizar(id: string, wrapper: Container, aura: AuraDaFicha | null, raio: number, acimaDe: Container, alfa: number): void
  /** A ficha saiu do mapa: a aura morre já, sem apagar devagar (o invólucro vai junto). */
  esquecer(id: string): void
  /**
   * O zoom mudou: cada aura repinta o quadro que mostrava, no tamanho novo, já
   * (a imagem exportada sai no mesmo passo, sem esperar o relógio).
   */
  reescalar(): void
  /** Quantas fichas têm aura acesa agora. */
  readonly quantas: number
  /** Sai do relógio e solta as camadas (o desenho vai ser desmontado). */
  destruir(): void
}

/**
 * Cria o conjunto. Com `movimento`, uma batida por quadro no relógio cru
 * enquanto houver aura: a ficha à vista anda, a de fora da tela fica como
 * estava, e "Reduzir movimento" põe todas no quadro parado da prova (a
 * opacidade de acender e apagar continua: não é movimento). Sem `movimento`
 * (exportação, teste), cada aura nasce e fica no quadro parado, já acesa.
 * `escala` = o zoom da câmera agora.
 */
export function criarAurasNoMapa(escala: () => number, movimento?: MovimentoDasAuras): AurasNoMapa {
  const fichas = new Map<string, FichaComAura>()
  const apagando: AuraApagando[] = []
  const ponto = new Point()
  let noRelogio = false
  let reduzido = false
  let conferidoEm = Number.NEGATIVE_INFINITY

  function naTela(ficha: FichaComAura, raioNaTela: number, tela: { width: number; height: number }): boolean {
    const { wrapper } = ficha
    if (wrapper.destroyed || wrapper.parent === null || !aparece(wrapper)) return false
    wrapper.getGlobalPosition(ponto)
    const margem = raioNaTela * ALCANCE_DA_AURA
    return ponto.x + margem >= 0 && ponto.x - margem <= tela.width && ponto.y + margem >= 0 && ponto.y - margem <= tela.height
  }

  /** A opacidade de agora: a da ficha, vezes o quanto a aura já acendeu. */
  function alfaDe(ficha: FichaComAura, agoraLocal: number): number {
    if (ficha.acendeuEm === null) return ficha.alfa
    const u = (agoraLocal - ficha.acendeuEm) / ENTRADA_MS
    if (u >= 1) {
      ficha.acendeuEm = null
      return ficha.alfa
    }
    return ficha.alfa * easeOutCubic(Math.max(0, u))
  }

  function apagar(agoraLocal: number): void {
    for (let i = apagando.length - 1; i >= 0; i -= 1) {
      const saindo = apagando[i]
      const u = (agoraLocal - saindo.desde) / SAIDA_MS
      if (u >= 1 || saindo.vista.atras.destroyed) {
        destruirVistaDaAura(saindo.vista)
        apagando.splice(i, 1)
        continue
      }
      definirAlfa(saindo.vista, saindo.alfa * (1 - easeOutCubic(Math.max(0, u))))
    }
  }

  /** "Reduzir movimento" agora (relido no máximo a cada `CONFERIR_MOVIMENTO_MS`). Sem relógio, a aura é sempre a parada. */
  function movimentoReduzido(agoraLocal: number): boolean {
    if (movimento === undefined) return true
    if (agoraLocal - conferidoEm >= CONFERIR_MOVIMENTO_MS) {
      conferidoEm = agoraLocal
      reduzido = movimento.reducedMotion()
    }
    return reduzido
  }

  const tick = (): void => {
    if (movimento === undefined) return
    const agoraLocal = performance.now()
    const parada = movimentoReduzido(agoraLocal)
    if (apagando.length > 0) apagar(agoraLocal)
    const zoom = escala()
    if (zoom > 0) {
      const tela = movimento.tela()
      const agora = movimento.agora?.() ?? Date.now()
      for (const ficha of fichas.values()) {
        if (ficha.acendeuEm !== null) definirAlfa(ficha.vista, alfaDe(ficha, agoraLocal))
        const raioNaTela = ficha.raio * zoom
        if (parada) posarVistaDaAura(ficha.vista, raioNaTela, zoom)
        else if (naTela(ficha, raioNaTela, tela)) pintarVistaDaAura(ficha.vista, instanteDaAura(ficha.vista.fase, agora), raioNaTela, zoom)
      }
    }
    if (fichas.size === 0 && apagando.length === 0) sairDoRelogio()
  }

  function entrarNoRelogio(): void {
    if (noRelogio || movimento === undefined) return
    noRelogio = true
    movimento.quadros.add(tick)
  }

  function sairDoRelogio(): void {
    if (!noRelogio || movimento === undefined) return
    noRelogio = false
    movimento.quadros.remove(tick)
  }

  /** Tira a aura da ficha `id`. `devagar` = apaga em `SAIDA_MS` (só com relógio e o invólucro vivo). */
  function tirar(id: string, devagar: boolean): void {
    const ficha = fichas.get(id)
    if (ficha === undefined) return
    fichas.delete(id)
    if (devagar && noRelogio && !ficha.wrapper.destroyed) {
      apagando.push({ id, wrapper: ficha.wrapper, vista: ficha.vista, alfa: ficha.vista.atras.alpha, desde: performance.now() })
      return
    }
    destruirVistaDaAura(ficha.vista)
    if (fichas.size === 0 && apagando.length === 0) sairDoRelogio()
  }

  /**
   * A mesma aura religada enquanto ainda apagava (liga e desliga rápido, ou a
   * troca desfeita): volta a acender da opacidade em que estava, sem nascer de
   * novo do zero nem piscar.
   */
  function reacender(id: string, wrapper: Container, tipo: TipoDeAura, raio: number, alfa: number): FichaComAura | undefined {
    const i = apagando.findIndex((saindo) => saindo.id === id && saindo.wrapper === wrapper && saindo.vista.tipo === tipo && !saindo.vista.atras.destroyed)
    if (i < 0) return undefined
    const [saindo] = apagando.splice(i, 1)
    // O `easeOutCubic` ao contrário: o ponto da entrada que dá a opacidade de agora.
    const fracao = alfa > 0 ? Math.min(1, saindo.vista.atras.alpha / alfa) : 1
    const u = 1 - Math.cbrt(1 - fracao)
    return { vista: saindo.vista, wrapper, raio, alfa, acendeuEm: performance.now() - u * ENTRADA_MS }
  }

  function sincronizar(id: string, wrapper: Container, aura: AuraDaFicha | null, raio: number, acimaDe: Container, alfa: number): void {
    if (aura === null || !aura.ligada) {
      tirar(id, true)
      return
    }
    const atual = fichas.get(id)
    // Invólucro novo (a vista da ficha foi refeita): a aura velha morre com o velho.
    if (atual !== undefined && atual.wrapper !== wrapper) tirar(id, false)
    // Outra aura: a velha apaga enquanto a nova acende, no mesmo lugar.
    else if (atual !== undefined && atual.vista.tipo !== aura.tipo) tirar(id, true)
    const agoraLocal = performance.now()
    let ficha = fichas.get(id)
    if (ficha === undefined) {
      ficha = reacender(id, wrapper, aura.tipo, raio, alfa) ?? { vista: criarVistaDaAura(aura.tipo, id), wrapper, raio, alfa, acendeuEm: movimento === undefined ? null : agoraLocal }
      fichas.set(id, ficha)
    }
    ficha.raio = raio
    ficha.alfa = alfa
    definirAlfa(ficha.vista, alfaDe(ficha, agoraLocal))
    encaixarVistaDaAura(wrapper, ficha.vista, acimaDe)
    // A aura não espera a próxima batida para aparecer. Andando, já no quadro de
    // agora (sem pagar a conta da pose); sem relógio ou com o movimento
    // reduzido, no quadro parado, que é o desenho que fica.
    const zoom = escala()
    if (ficha.vista.pintado === null && zoom > 0) {
      if (movimentoReduzido(agoraLocal)) posarVistaDaAura(ficha.vista, raio * zoom, zoom)
      else pintarVistaDaAura(ficha.vista, instanteDaAura(ficha.vista.fase, movimento?.agora?.() ?? Date.now()), raio * zoom, zoom)
    }
    entrarNoRelogio()
  }

  function reescalar(): void {
    const zoom = escala()
    if (!(zoom > 0)) return
    for (const ficha of fichas.values()) {
      const { pintado } = ficha.vista
      if (pintado !== null && pintado.escala !== zoom) pintarVistaDaAura(ficha.vista, pintado.t, ficha.raio * zoom, zoom)
    }
  }

  function destruir(): void {
    sairDoRelogio()
    for (const ficha of fichas.values()) destruirVistaDaAura(ficha.vista)
    fichas.clear()
    for (const saindo of apagando) destruirVistaDaAura(saindo.vista)
    apagando.length = 0
  }

  return {
    sincronizar,
    esquecer: (id) => tirar(id, false),
    reescalar,
    get quantas() {
      return fichas.size
    },
    destruir,
  }
}
