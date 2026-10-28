import { BufferImageSource, Container, MaskFilter, Rectangle, Sprite, Texture, type TilingSprite } from 'pixi.js'
import type { Caixa } from '../lib/texturas'
import { FATIA_DO_LADRILHO_MS } from '../texturas/ladrilhos'
import { LADO_DO_PEDACO, comecarPedaco, ladoDoPedacoNoMundo, pintarLinhas, type ChaoDaTextura, type Pedaco, type PinturaDoPedaco } from '../texturas/meioTermo/chaoNoMundo'

/**
 * PEDAÇOS DO CHÃO (Meio-Termo, fatia MT7): com a chave de obra ligada, a
 * textura de cada camada deixa de ser um `TilingSprite` e vira os pedaços de
 * 256 x 256 px que cruzam a vista, pintados por posição
 * (`texturas/meioTermo/chaoNoMundo.ts`). O ladrilho repetido de hoje fica POR
 * BAIXO, como placeholder, até os pedaços da vista ficarem prontos: a primeira
 * pintura sai na mesma hora de antes e nunca aparece buraco.
 *
 * - Nível: o mapa afastado pede pedaços que cobrem 2^k vezes mais mundo com os
 *   mesmos 256 x 256 px; o nível é o menor com no máximo
 *   `MAX_PEDACOS_NA_VISTA` pedaços na vista (a vista é o que se sabe da tela:
 *   `ajustarAVista` não recebe o tamanho dela). Os pedaços têm mipmap.
 * - Fila de fatias de 8 ms (`FATIA_DO_LADRILHO_MS`), um pedaço por vez,
 *   algumas linhas por passo: nenhuma tarefa longa. Quem saiu da vista antes
 *   de começar sai da fila.
 * - Cache LRU por bytes (64 MB no computador, 24 MB com `pointer: coarse`),
 *   contando a cópia na CPU e a da placa com o mipmap. O pedaço em uso (num
 *   sprite do palco) nunca sai; o que sai é destruído (`destroy(true)`, a
 *   fonte de bytes não tem coleta automática no Pixi 8).
 * - A névoa nunca dispara geração: só `ajustar` (a câmera) e a pintura nova pedem pedaços.
 */

/** Teto de pedaços na vista: escolhe o nível (1440 x 900 a 100% pede 24 a 35 pedaços no nível 0). */
export const MAX_PEDACOS_NA_VISTA = 48
/** Teto da imagem exportada (a pintura inteira, sem vista). */
export const MAX_PEDACOS_NO_PNG = 64
export const NIVEL_MAXIMO_DO_CHAO = 8

const MEGABYTE = 1024 * 1024
export const TETO_DO_CHAO_NO_COMPUTADOR = 64 * MEGABYTE
export const TETO_DO_CHAO_NO_TOQUE = 24 * MEGABYTE
/** Um pedaço mora na CPU (os bytes) e na placa (a cópia e o mipmap, +1/3). */
export const BYTES_DO_PEDACO = LADO_DO_PEDACO * LADO_DO_PEDACO * 4 * (1 + 4 / 3)
/** Linhas pintadas entre duas conferências do relógio (8 linhas de 256 px: bem abaixo de 1 ms). */
const LINHAS_POR_PASSO = 8

/** O teto de bytes do aparelho: menor com dedo (celular, tablet). */
export function tetoDoChaoDoAparelho(): number {
  const toque = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
  return toque ? TETO_DO_CHAO_NO_TOQUE : TETO_DO_CHAO_NO_COMPUTADOR
}

interface Faixa {
  i0: number
  i1: number
  j0: number
  j1: number
}

function faixaDaArea(area: Caixa, nivel: number): Faixa {
  const lado = ladoDoPedacoNoMundo(nivel)
  return {
    i0: Math.floor(area.minX / lado),
    i1: Math.ceil(area.maxX / lado) - 1,
    j0: Math.floor(area.minY / lado),
    j1: Math.ceil(area.maxY / lado) - 1,
  }
}

/** O menor nível com no máximo `maximo` pedaços cobrindo `area`. */
export function nivelDaVista(area: Caixa, maximo = MAX_PEDACOS_NA_VISTA): number {
  for (let nivel = 0; nivel < NIVEL_MAXIMO_DO_CHAO; nivel += 1) {
    const f = faixaDaArea(area, nivel)
    if ((f.i1 - f.i0 + 1) * (f.j1 - f.j0 + 1) <= maximo) return nivel
  }
  return NIVEL_MAXIMO_DO_CHAO
}

/** Os pedaços do nível que cruzam `area`, do centro para fora (o do meio da tela sai primeiro). */
export function pedacosDaArea(area: Caixa, nivel: number): Pedaco[] {
  const f = faixaDaArea(area, nivel)
  const lado = ladoDoPedacoNoMundo(nivel)
  const cx = (area.minX + area.maxX) / 2
  const cy = (area.minY + area.maxY) / 2
  const lista: { p: Pedaco; d: number }[] = []
  for (let j = f.j0; j <= f.j1; j += 1) {
    for (let i = f.i0; i <= f.i1; i += 1) lista.push({ p: { i, j, nivel }, d: Math.hypot((i + 0.5) * lado - cx, (j + 0.5) * lado - cy) })
  }
  return lista.sort((a, b) => a.d - b.d).map((x) => x.p)
}

/** A caixa da pintura cortada pela vista, com pixel inteiro para fora (como `recortarNaVista`); `null` = nada à vista. */
export function areaNaVista(caixa: Caixa, vista: Caixa): Caixa | null {
  const minX = Math.max(caixa.minX, Math.floor(vista.minX))
  const minY = Math.max(caixa.minY, Math.floor(vista.minY))
  const maxX = Math.min(caixa.maxX, Math.ceil(vista.maxX))
  const maxY = Math.min(caixa.maxY, Math.ceil(vista.maxY))
  return maxX > minX && maxY > minY ? { minX, minY, maxX, maxY } : null
}

export interface PedidoDoPedaco {
  /** A textura, se o pedaço já estava pronto; senão chega por `aoFicarPronto`. */
  readonly textura: Texture | null
  soltar: () => void
}

interface EntradaDoPedaco {
  readonly chave: string
  readonly chao: ChaoDaTextura
  readonly pedaco: Pedaco
  pintura: PinturaDoPedaco | null
  textura: Texture | null
  usos: number
  readonly ouvintes: Set<(t: Texture) => void>
  retirada: boolean
}

export interface OpcoesDoCacheDoChao {
  tetoDeBytes?: number
  /** Agenda a próxima fatia (padrão: `setTimeout(…, 0)`, que dá a vez ao navegador). */
  agendar?: (fatia: () => void) => void
  fatiaMs?: number
}

/** Os pedaços pintados de um renderer: cache LRU com teto, fila de fatias e quem usa cada um. */
export class CacheDoChao {
  private readonly cache = new Map<string, EntradaDoPedaco>()
  private fila: EntradaDoPedaco[] = []
  private bombaAgendada = false
  private destruido = false
  private readonly tetoDeBytes: number
  private readonly agendar: (fatia: () => void) => void
  private readonly fatiaMs: number
  /** Contadores para os testes: pedaços pintados e destruídos. */
  pintados = 0
  destruidos = 0

  constructor(opcoes: OpcoesDoCacheDoChao = {}) {
    this.tetoDeBytes = opcoes.tetoDeBytes ?? tetoDoChaoDoAparelho()
    this.agendar = opcoes.agendar ?? ((fatia) => setTimeout(fatia, 0))
    this.fatiaMs = opcoes.fatiaMs ?? FATIA_DO_LADRILHO_MS
  }

  get bytes(): number {
    return this.cache.size * BYTES_DO_PEDACO
  }

  get quantos(): number {
    return this.cache.size
  }

  get naFila(): number {
    return this.fila.length
  }

  /** Pede o pedaço (`chaveDoChao` = a textura, o lado dela no mundo e a versão do desenho). */
  pedir(chaveDoChao: string, chao: ChaoDaTextura, pedaco: Pedaco, aoFicarPronto: (t: Texture) => void): PedidoDoPedaco {
    const chave = `${chaveDoChao}|${pedaco.nivel}|${pedaco.i}|${pedaco.j}`
    let e = this.cache.get(chave)
    if (e === undefined || this.destruido) {
      e = { chave, chao, pedaco, pintura: null, textura: null, usos: 0, ouvintes: new Set(), retirada: false }
      if (!this.destruido) {
        this.cache.set(chave, e)
        this.fila.push(e)
        this.agendarBomba()
      }
    } else {
      // LRU: o pedido recente vai para o fim.
      this.cache.delete(chave)
      this.cache.set(chave, e)
    }
    const entrada = e
    entrada.usos += 1
    const ouvinte = entrada.textura === null ? (t: Texture) => aoFicarPronto(t) : null
    if (ouvinte !== null) entrada.ouvintes.add(ouvinte)
    this.podar()
    let solto = false
    return {
      textura: entrada.textura,
      soltar: () => {
        if (solto) return
        solto = true
        entrada.usos -= 1
        if (ouvinte !== null) entrada.ouvintes.delete(ouvinte)
        this.podar()
      },
    }
  }

  destruir(): void {
    this.destruido = true
    for (const e of this.cache.values()) this.retirar(e)
    this.cache.clear()
    this.fila = []
  }

  private agendarBomba(): void {
    if (this.bombaAgendada || this.destruido) return
    this.bombaAgendada = true
    this.agendar(() => this.bombear())
  }

  /** Uma fatia: pinta linhas do primeiro da fila até o relógio passar de `fatiaMs`. */
  private bombear(): void {
    this.bombaAgendada = false
    if (this.destruido) return
    const inicio = performance.now()
    // Ao menos um passo por fatia: com fatia curtíssima (ou relógio parado no teste) a fila ainda anda.
    let primeira = true
    while (this.fila.length > 0 && (primeira || performance.now() - inicio < this.fatiaMs)) {
      const e = this.fila[0]
      if (e.retirada) {
        this.fila.shift()
        continue
      }
      if (e.usos === 0) {
        // Saiu da vista antes de ficar pronto: não pinta à toa.
        this.fila.shift()
        this.retirar(e)
        continue
      }
      e.pintura ??= comecarPedaco(e.chao, e.pedaco)
      const p = e.pintura
      do {
        pintarLinhas(e.chao, e.pedaco, p, p.linha + LINHAS_POR_PASSO)
        primeira = false
      } while (p.linha < LADO_DO_PEDACO && performance.now() - inicio < this.fatiaMs)
      if (p.linha >= LADO_DO_PEDACO) {
        this.fila.shift()
        this.terminar(e, p)
      }
    }
    if (this.fila.length > 0) this.agendarBomba()
  }

  private terminar(e: EntradaDoPedaco, p: PinturaDoPedaco): void {
    // Bytes opacos (alfa 255): pré-multiplicado ou não dá o mesmo, e a placa não converte.
    const source = new BufferImageSource({
      resource: p.pixels,
      width: LADO_DO_PEDACO,
      height: LADO_DO_PEDACO,
      format: 'rgba8unorm',
      alphaMode: 'premultiplied-alpha',
      scaleMode: 'linear',
      autoGenerateMipmaps: true,
    })
    const textura = new Texture({ source })
    e.textura = textura
    e.pintura = null
    this.pintados += 1
    const ouvintes = [...e.ouvintes]
    e.ouvintes.clear()
    for (const o of ouvintes) o(textura)
    this.podar()
  }

  /** Tira os mais antigos sem uso até caber no teto; o pedaço em uso fica, mesmo acima dele. */
  private podar(): void {
    if (this.bytes <= this.tetoDeBytes) return
    for (const e of [...this.cache.values()]) {
      if (this.bytes <= this.tetoDeBytes) return
      if (e.usos > 0 || (e.pintura !== null && this.fila[0] === e)) continue
      this.retirar(e)
    }
  }

  private retirar(e: EntradaDoPedaco): void {
    if (e.retirada) return
    e.retirada = true
    this.cache.delete(e.chave)
    e.pintura = null
    e.ouvintes.clear()
    if (e.textura !== null) {
      e.textura.destroy(true)
      e.textura = null
      this.destruidos += 1
    }
  }
}

/** Uma camada do chão no palco: o ladrilho de hoje por baixo e os pedaços por cima. */
export interface ChaoEmPedacos {
  /** O que vai para o palco (a máscara da camada é posta nele). */
  readonly grupo: Container
  /**
   * A vista mudou (`null` = a pintura inteira, a do PNG). Barato quando os pedaços não mudam.
   * `cobrir` = a área a cobrir quando ela passa da vista (a vitrine das texturas compõe tela + margem);
   * o nível dos pedaços continua o da vista, para a imagem ser a mesma.
   */
  ajustar: (vista: Caixa | null, cobrir?: Caixa) => void
  /** Só a área da máscara (um ladrilho da vitrine), sem mexer nos pedaços pedidos. */
  limitarFiltro: (area: Caixa) => void
  /** Resolve quando todos os pedaços pedidos estão no palco (ou a camada foi solta). */
  pronto: () => Promise<void>
  /** Pedaços pedidos que ainda não chegaram. */
  readonly faltam: number
  /** Solta os pedaços (o cache os guarda) e destrói o grupo; o ladrilho do placeholder fica no cache dele. */
  soltar: () => void
}

interface NoPalco {
  sprite: Sprite | null
  pedido: PedidoDoPedaco | null
}

/** Grupos de pedaços vivos: `soltarPintura` (drawTexturas) os acha pelo contêiner. */
const camadasDoChao = new WeakMap<Container, ChaoEmPedacos>()

/** A camada de pedaços deste contêiner, se ele for uma. */
export function chaoDoGrupo(grupo: Container): ChaoEmPedacos | undefined {
  return camadasDoChao.get(grupo)
}

export interface MontagemDoChao {
  cache: CacheDoChao
  chaveDoChao: string
  chao: ChaoDaTextura
  /** A caixa da pintura da camada (os pedaços só cobrem o que ela pinta). */
  caixa: Caixa
  /** O ladrilho repetido de hoje, já recortado na vista: fica por baixo até os pedaços chegarem. */
  repetida: TilingSprite
  vista: Caixa | null
  /**
   * A máscara alfa da camada (a pintura dela). O grupo passa por ela num
   * filtro com a ÁREA PRESA À VISTA (`mascaraNaVista`); sem ela, o grupo não
   * é mascarado (testes do cache).
   */
  mascara?: Sprite
  /** Avisado cada vez que todos os pedaços da vista ficam prontos. */
  aoFicarPronto?: () => void
  /** Avisado quando o que o grupo desenha muda (pedaço chegou, faixa trocou): a vitrine compõe de novo. */
  aoMudar?: () => void
}

/**
 * A máscara do grupo de pedaços com a área do filtro presa a vista ∩ caixa.
 *
 * POR QUE NÃO `setMask` (otimização 200x200, fatia F1, medida em 27/10/2026):
 * o Pixi 8 passa a área mascarada por uma textura temporária do tamanho da
 * caixa do conteúdo NA TELA, sem recortar na janela (`MaskFilter` nasce com
 * `clipToViewport: false`), arredondada para potência de 2. Os pedaços passam
 * da vista (pedaço inteiro na borda e, na troca de nível, os do nível
 * anterior, até 2^k vezes maiores): a área chegava a 8192 px de lado por
 * camada a cada quadro. Com `filterArea` = vista ∩ caixa, a textura tem no
 * máximo o tamanho da tela, como no modo linhas (ladrilho cortado à vista).
 * O que fica de fora da área está fora da tela: a imagem não muda.
 */
function mascaraNaVista(grupo: Container, mascara: Sprite, caixa: Caixa): { ajustar: (vista: Caixa | null) => void; soltar: () => void } {
  // Os mesmos parâmetros do `AlphaMaskEffect` do `setMask` (resolução e antialias da tela, canal alfa).
  const filtro = new MaskFilter({ sprite: mascara, channel: 'alpha', inverse: false, resolution: 'inherit', antialias: 'inherit' })
  // Como o `setMask` de um sprite: a máscara fica na cena (a matriz dela anda com o mundo), mas não desenha.
  mascara.renderable = false
  grupo.filters = [filtro]
  const area = new Rectangle()
  // A tela da máscara arredonda a caixa para cima (pixels inteiros na escala da pintura) e pode passar da
  // caixa em até um pixel dela: a área cobre a caixa E a máscara, para nunca cortar o que a máscara mostra.
  const coberta: Caixa = {
    minX: Math.min(caixa.minX, Math.floor(mascara.x)),
    minY: Math.min(caixa.minY, Math.floor(mascara.y)),
    maxX: Math.max(caixa.maxX, Math.ceil(mascara.x + mascara.width)),
    maxY: Math.max(caixa.maxY, Math.ceil(mascara.y + mascara.height)),
  }
  return {
    ajustar: (vista) => {
      if (vista === null) {
        // A pintura inteira (PNG): a área volta a ser a caixa do conteúdo, como antes.
        grupo.filterArea = null as unknown as Rectangle // as: o Pixi aceita null (volta à caixa do conteúdo); o tipo do setter não diz
        grupo.renderable = true
        return
      }
      const naVista = areaNaVista(coberta, vista)
      // Fora da vista nada se vê; e área vazia faria o Pixi PULAR o filtro e desenhar o grupo sem máscara.
      grupo.renderable = naVista !== null
      if (naVista === null) return
      area.x = naVista.minX
      area.y = naVista.minY
      area.width = naVista.maxX - naVista.minX
      area.height = naVista.maxY - naVista.minY
      grupo.filterArea = area
    },
    soltar: () => {
      grupo.filters = null
      filtro.destroy()
    },
  }
}

export function montarChaoEmPedacos(m: MontagemDoChao): ChaoEmPedacos {
  const grupo = new Container()
  grupo.label = 'chao-em-pedacos'
  grupo.eventMode = 'none'
  const camadaDosPedacos = new Container()
  camadaDosPedacos.label = 'pedacos'
  grupo.addChild(m.repetida, camadaDosPedacos)
  let atuais = new Map<string, NoPalco>()
  /** Os do nível anterior: ficam por baixo dos novos até eles chegarem (trocar de nível não mostra o placeholder). */
  let velhos = new Map<string, NoPalco>()
  let nivelAtual = -1
  let assinatura: string | null = null
  let solto = false
  let esperando: (() => void)[] = []
  const mascarada = m.mascara === undefined ? null : mascaraNaVista(grupo, m.mascara, m.caixa)

  const contarFaltam = (): number => {
    let n = 0
    for (const no of atuais.values()) if (no.sprite === null) n += 1
    return n
  }

  function soltarTodos(nos: Map<string, NoPalco>): void {
    for (const no of nos.values()) {
      if (no.sprite !== null) {
        no.sprite.destroy()
        no.sprite = null
      }
      no.pedido?.soltar()
      no.pedido = null
    }
    nos.clear()
  }

  function cobertura(): void {
    // O placeholder, os pedaços de antes ou os novos mudaram: a vitrine compõe de novo.
    m.aoMudar?.()
    const faltam = contarFaltam()
    m.repetida.renderable = faltam > 0
    if (faltam > 0) return
    soltarTodos(velhos)
    const resolver = esperando
    esperando = []
    for (const r of resolver) r()
    if (atuais.size > 0) m.aoFicarPronto?.()
  }

  function colocar(no: NoPalco, p: Pedaco, t: Texture): void {
    const lado = ladoDoPedacoNoMundo(p.nivel)
    const sprite = new Sprite(t)
    sprite.position.set(p.i * lado, p.j * lado)
    sprite.scale.set(lado / LADO_DO_PEDACO)
    camadaDosPedacos.addChild(sprite)
    no.sprite = sprite
  }

  function ajustar(vista: Caixa | null, cobrir?: Caixa): void {
    if (solto) return
    const alvo = vista === null ? null : (cobrir ?? vista)
    // A área do filtro anda com a vista a cada chamada (o pan não muda a faixa de pedaços, mas muda a vista).
    mascarada?.ajustar(alvo)
    const nivel = vista === null ? nivelDaVista(m.caixa, MAX_PEDACOS_NO_PNG) : nivelDaVista(vista)
    const area = alvo === null ? m.caixa : areaNaVista(m.caixa, alvo)
    const f = area === null ? null : faixaDaArea(area, nivel)
    const nova = f === null ? `${nivel}|nada` : `${nivel}|${f.i0}|${f.i1}|${f.j0}|${f.j1}`
    // Arrastar chama isto a cada quadro: só monta a lista quando a faixa de pedaços muda.
    if (nova === assinatura) return
    assinatura = nova
    const lista = area === null ? [] : pedacosDaArea(area, nivel)
    const proximos = new Map<string, NoPalco>()
    for (const p of lista) {
      const chave = `${p.nivel}|${p.i}|${p.j}`
      const ja = atuais.get(chave)
      if (ja !== undefined) {
        proximos.set(chave, ja)
        atuais.delete(chave)
        continue
      }
      const no: NoPalco = { sprite: null, pedido: null }
      proximos.set(chave, no)
      no.pedido = m.cache.pedir(m.chaveDoChao, m.chao, p, (t) => {
        colocar(no, p, t)
        cobertura()
      })
      if (no.pedido.textura !== null) colocar(no, p, no.pedido.textura)
    }
    if (nivel !== nivelAtual && nivelAtual !== -1) {
      // Troca de nível: os de antes ficam por baixo até os novos chegarem.
      soltarTodos(velhos)
      velhos = atuais
    } else {
      soltarTodos(atuais)
    }
    atuais = proximos
    nivelAtual = nivel
    cobertura()
  }

  const camada: ChaoEmPedacos = {
    grupo,
    ajustar,
    limitarFiltro: (area) => {
      if (!solto) mascarada?.ajustar(area)
    },
    get faltam() {
      return contarFaltam()
    },
    pronto: () =>
      new Promise<void>((resolver) => {
        if (solto || contarFaltam() === 0) resolver()
        else esperando.push(resolver)
      }),
    soltar: () => {
      if (solto) return
      solto = true
      soltarTodos(atuais)
      soltarTodos(velhos)
      for (const r of esperando) r()
      esperando = []
      camadasDoChao.delete(grupo)
      // O filtro sai antes da textura da máscara (`soltarPintura` a destrói logo depois).
      mascarada?.soltar()
      grupo.mask = null
      // O placeholder sai sem levar o ladrilho (que é do cache de ladrilhos do renderer).
      m.repetida.mask = null
      grupo.destroy({ children: true })
    },
  }
  camadasDoChao.set(grupo, camada)
  ajustar(m.vista)
  return camada
}
