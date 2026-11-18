import { CanvasSource, Container, Sprite, Texture, type Ticker } from 'pixi.js'
import { rotationToRadians } from '../lib/itemTransform'
import type { Caixa } from '../lib/texturas'
import type { Prop } from '../types/map'
import { faseDoId } from './mapaDeLuz'

/**
 * A ESTRELA DO ITEM (pedido de 17/11/2026: "uma espécie de estrelinha com
 * animação brilhando no chão"). O item no chão com `Prop.marcaDoItem` vira uma
 * estrela dourada de quatro pontas, de meia casa, com contorno no dourado
 * escuro, que pisca devagar: é a variante "1. Cintilar" do protótipo aprovado
 * (`tmp/pedidos-2026-11-17/estrela-prototipo/`), portada fiel —
 * - subida em S de ~320 ms e descida longa, com ~34% do ciclo em repouso;
 * - ciclo de 1,7 a 2,3 s e fase sorteados por estrela (nada de pulsar em coro);
 * - 2 ou 3 faíscas que acendem uma a uma na descida;
 * - com "menos movimento", parada: a estrela cheia e um halo fraco.
 *
 * DESENHO UMA VEZ SÓ: estrela, faísca e halo são texturas assadas na primeira
 * estrela (canvas 2D, com mipmap para o zoom longe) e divididas por todas; por
 * quadro mudam só alpha, escala e visível de sprites.
 *
 * O RELÓGIO só fica inscrito com alguma estrela na VISTA e movimento normal
 * (o molde de `fogosDoMapa.ts`): a estrela fora da vista nem desenha
 * (`renderable`). É o `app.ticker`, não o `desenho.relogio`: inscrito neste,
 * a tela inteira redesenharia a todo quadro (`desenhoSobPedido.ts`). Aqui a
 * estrela escreve no máximo `QUADROS_DA_ESTRELA_POR_SEGUNDO` vezes por segundo
 * (o passo da água), e o desenho sob pedido vê a mudança sozinho.
 *
 * Uma instância por tela (editor e jogador), dividida por quem desenha os
 * objetos (`drawProps.ts`, `drawPropLooks.ts`): cada um cria e solta as
 * estrelas dos seus objetos e põe o nó delas onde o objeto mora (camada,
 * pilha, fantasma do "Oculto").
 */

/** O que a estrela lê do objeto. */
export type PropDaEstrela = Pick<Prop, 'x' | 'y' | 'width' | 'height' | 'rotation'>

/** O diâmetro da estrela em fração do lado da caixa do objeto (a caixa nasce com uma casa: meia casa, como no protótipo). */
export const PROPORCAO_DA_ESTRELA = 0.5
const PROPORCAO_DO_HALO = 0.9
const PROPORCAO_DA_FAISCA = 0.2
/** Quantas vezes por segundo a estrela se mexe: metade dos quadros, cada um um desenho da tela inteira. */
export const QUADROS_DA_ESTRELA_POR_SEGUNDO = 30
const QUADRO_DA_ESTRELA_MS = 1000 / QUADROS_DA_ESTRELA_POR_SEGUNDO
/** Aceita o quadro um pouco antes da hora: sem isto, a 60 Hz o quadro de 16,6 ms às vezes pularia para o terceiro. */
const FOLGA_DO_QUADRO = 0.85
const CONFERIR_MOVIMENTO_MS = 1000
/** O ciclo médio, em segundos; cada estrela sorteia de 0,85 a 1,15 dele. */
const CICLO_DO_CINTILAR_S = 2.0
/** Quanto do ciclo cada faísca fica acesa. */
const VIDA_DA_FAISCA = 0.2
/** A pose parada ("menos movimento"): a estrela cheia, o halo fraco, sem faíscas. */
const HALO_PARADO = 0.35

/** As texturas assadas, em px: o lado do quadro e o diâmetro do desenho dentro dele. */
const QUADRO_DA_ESTRELA_PX = 128
const DIAMETRO_DA_ESTRELA_PX = 110
const QUADRO_DA_FAISCA_PX = 64
const DIAMETRO_DA_FAISCA_PX = 54
const QUADRO_DO_HALO_PX = 128

const TAU = Math.PI * 2

export interface MovimentoDasEstrelas {
  /** O relógio de quadros do Pixi (`app.ticker`): inscrito só com estrela na vista e movimento normal. */
  ticker: Pick<Ticker, 'add' | 'remove'>
  /** `prefers-reduced-motion`, relido a cada passada e, com a estrela viva, uma vez por segundo. */
  reducedMotion: () => boolean
  /** Agora, em ms. Padrão `performance.now()`. */
  agora?: () => number
}

/** O que a tela anota para a medida de desempenho e a conferência. */
export interface EstadoDasEstrelas {
  estrelas: number
  naVista: number
  animando: boolean
}

export interface EstrelaDoItem {
  /** O nó da estrela: quem desenha o objeto o põe onde o objeto mora. */
  readonly no: Container
  /** Centro, tamanho (meia caixa) e giro do objeto; a pose de agora vem junto. */
  posicionar: (prop: PropDaEstrela) => void
  destruir: () => void
}

export interface EstrelasDosItens {
  /** Uma estrela nova para o objeto `id` (o id sorteia o ciclo, a fase e as faíscas: a mesma estrela nas duas telas). */
  criar: (id: string) => EstrelaDoItem
  /** A câmera andou: a estrela fora de `vista` não desenha nem conta para o relógio (`null` = sem recorte). */
  ajustarAVista: (vista: Caixa | null) => void
  estado: () => EstadoDasEstrelas
  destruir: () => void
}

/** O pulso do Cintilar, de 0 a 1, na fração `u` do ciclo: sobe em S até 0,16, desce em cosseno até 0,66 e descansa. */
export function picoDoCintilar(u: number): number {
  if (u < 0.16) return suave(u / 0.16)
  if (u < 0.66) return 0.5 + 0.5 * Math.cos((Math.PI * (u - 0.16)) / 0.5)
  return 0
}

function suave(x: number): number {
  return x * x * (3 - 2 * x)
}

function saidaCubica(x: number): number {
  return 1 - Math.pow(1 - x, 3)
}

function fracao(x: number): number {
  return x - Math.floor(x)
}

/** Sorteio com semente (mulberry32, o do protótipo), semeado pelo id do objeto. */
function sorteioDoId(id: string): () => number {
  let a = Math.floor(faseDoId(id) * 2 ** 32) >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Estrela de 4 pontas com lados côncavos: curva cúbica com os controles perto do centro. */
function caminhoDaEstrela(g: CanvasRenderingContext2D, centro: number, raio: number, largura: number, cintura: number): void {
  const pontas: readonly (readonly [number, number])[] = [
    [0, -raio],
    [raio * largura, 0],
    [0, raio],
    [-raio * largura, 0],
  ]
  g.beginPath()
  g.moveTo(centro + pontas[0][0], centro + pontas[0][1])
  for (let i = 0; i < 4; i += 1) {
    const a = pontas[i]
    const b = pontas[(i + 1) % 4]
    const cx = centro + ((a[0] + b[0]) / 2) * cintura
    const cy = centro + ((a[1] + b[1]) / 2) * cintura
    g.bezierCurveTo(cx, cy, cx, cy, centro + b[0], centro + b[1])
  }
  g.closePath()
}

/** Um quadro de `lado` px pintado por `pintar`; `null` sem canvas 2D (testes em jsdom). */
function assar(lado: number, pintar: (g: CanvasRenderingContext2D) => void): Texture | null {
  if (typeof document === 'undefined') return null
  const tela = document.createElement('canvas')
  tela.width = lado
  tela.height = lado
  const g = tela.getContext('2d')
  if (g === null) return null
  pintar(g)
  return new Texture({ source: new CanvasSource({ resource: tela, scaleMode: 'linear', mipmapFilter: 'linear', autoGenerateMipmaps: true, addressMode: 'clamp-to-edge' }) })
}

/** A estrela dourada: contorno no dourado escuro (só a metade de fora aparece) e o dourado cedo no degradê, que não some na pedra clara. */
function assarEstrela(): Texture | null {
  return assar(QUADRO_DA_ESTRELA_PX, (g) => {
    const centro = QUADRO_DA_ESTRELA_PX / 2
    const raio = DIAMETRO_DA_ESTRELA_PX / 2
    caminhoDaEstrela(g, centro, raio, 0.86, 0.32)
    g.lineJoin = 'round'
    g.lineWidth = raio * 0.16
    g.strokeStyle = 'rgba(118,84,30,0.85)'
    g.stroke()
    const degrade = g.createRadialGradient(centro, centro, 0, centro, centro, raio)
    degrade.addColorStop(0, '#fffbf0')
    degrade.addColorStop(0.18, '#fcefc8')
    degrade.addColorStop(0.5, '#f0cf78')
    degrade.addColorStop(1, '#d9a947')
    g.fillStyle = degrade
    g.fill()
  })
}

/** A faísca: estrela fina, com a borda dourada escura que a mantém visível na pedra clara. */
function assarFaisca(): Texture | null {
  return assar(QUADRO_DA_FAISCA_PX, (g) => {
    const centro = QUADRO_DA_FAISCA_PX / 2
    const raio = DIAMETRO_DA_FAISCA_PX / 2
    caminhoDaEstrela(g, centro, raio, 1, 0.12)
    g.lineJoin = 'round'
    g.lineWidth = raio * 0.26
    g.strokeStyle = 'rgba(140,100,36,0.7)'
    g.stroke()
    const degrade = g.createRadialGradient(centro, centro, 0, centro, centro, raio)
    degrade.addColorStop(0, '#fffdf6')
    degrade.addColorStop(0.5, '#fbe9b8')
    degrade.addColorStop(1, '#f0d07e')
    g.fillStyle = degrade
    g.fill()
  })
}

/** O halo: luz somada fraca (forte, ela estouraria a laje clara para branco). */
function assarHalo(): Texture | null {
  return assar(QUADRO_DO_HALO_PX, (g) => {
    const centro = QUADRO_DO_HALO_PX / 2
    const degrade = g.createRadialGradient(centro, centro, 0, centro, centro, centro)
    degrade.addColorStop(0, 'rgba(255,228,160,0.7)')
    degrade.addColorStop(0.35, 'rgba(255,210,130,0.32)')
    degrade.addColorStop(0.7, 'rgba(255,200,110,0.08)')
    degrade.addColorStop(1, 'rgba(255,200,110,0)')
    g.fillStyle = degrade
    g.fillRect(0, 0, QUADRO_DO_HALO_PX, QUADRO_DO_HALO_PX)
  })
}

interface TexturasDaEstrela {
  estrela: Texture
  faisca: Texture
  halo: Texture
}

interface FaiscaNoPalco {
  sprite: Sprite
  /** Onde ela acende no ciclo. */
  inicio: number
  /** O alpha cheio dela. */
  base: number
  /** Direção e distância do centro, em lados da caixa. */
  direcaoX: number
  direcaoY: number
  distancia: number
}

interface EstrelaNoPalco {
  no: Container
  halo: Sprite
  corpo: Sprite
  faiscas: FaiscaNoPalco[]
  /** O ciclo, em segundos, e a fase (0 a 1). */
  periodo: number
  fase: number
  /** As escalas de base pelo lado da caixa de agora (o pulso multiplica). */
  escalaDoCorpo: number
  escalaDoHalo: number
  escalaDaFaisca: number
  lado: number
  /** A caixa do nó no mundo, para o recorte da vista. */
  x: number
  y: number
  raio: number
  naVista: boolean
}

export function createEstrelasDosItens(opcoes: { movimento?: MovimentoDasEstrelas; aoMudar?: (estado: EstadoDasEstrelas) => void } = {}): EstrelasDosItens {
  const { movimento, aoMudar } = opcoes
  const agora = movimento?.agora ?? (() => performance.now())
  const estrelas = new Set<EstrelaNoPalco>()
  let texturas: TexturasDaEstrela | null = null
  let vista: Caixa | null = null
  let noRelogio = false
  let parada = movimento === undefined || movimento.reducedMotion()
  let conferidoEm = 0
  let ultimoQuadro = Number.NEGATIVE_INFINITY
  let acertoMarcado = false
  let destruido = false
  let avisado = ''

  /** As texturas nascem com a primeira estrela e ficam até o fim; sem canvas 2D, nada desenha (testes). */
  function asTexturas(): TexturasDaEstrela {
    if (texturas !== null) return texturas
    texturas = { estrela: assarEstrela() ?? Texture.EMPTY, faisca: assarFaisca() ?? Texture.EMPTY, halo: assarHalo() ?? Texture.EMPTY }
    return texturas
  }

  function avisar(): void {
    const estado = lerEstado()
    const chave = `${estado.estrelas}:${estado.naVista}:${estado.animando}`
    if (chave === avisado) return
    avisado = chave
    aoMudar?.(estado)
  }

  function lerEstado(): EstadoDasEstrelas {
    let naVista = 0
    for (const estrela of estrelas) if (estrela.naVista) naVista += 1
    return { estrelas: estrelas.size, naVista, animando: noRelogio }
  }

  function aplicarParada(estrela: EstrelaNoPalco): void {
    estrela.corpo.scale.set(estrela.escalaDoCorpo)
    estrela.corpo.alpha = 1
    estrela.halo.alpha = HALO_PARADO
    estrela.halo.scale.set(estrela.escalaDoHalo)
    for (const faisca of estrela.faiscas) faisca.sprite.visible = false
  }

  /** A pose do Cintilar no instante `t` (s): só números em sprites. */
  function aplicarMovendo(estrela: EstrelaNoPalco, t: number): void {
    const u = fracao(t / estrela.periodo + estrela.fase)
    const p = picoDoCintilar(u)
    estrela.corpo.scale.set(estrela.escalaDoCorpo * (0.86 + 0.14 * p))
    estrela.corpo.alpha = 0.82 + 0.18 * p
    estrela.halo.alpha = 0.16 + 0.36 * p
    estrela.halo.scale.set(estrela.escalaDoHalo * (0.9 + 0.12 * p))
    for (const faisca of estrela.faiscas) {
      const d = fracao(u - faisca.inicio)
      if (d >= VIDA_DA_FAISCA) {
        faisca.sprite.visible = false
        continue
      }
      const q = d / VIDA_DA_FAISCA
      faisca.sprite.visible = true
      faisca.sprite.alpha = faisca.base * (q < 0.25 ? saidaCubica(q / 0.25) : 1 - suave((q - 0.25) / 0.75))
      const cresce = 0.55 + 0.45 * saidaCubica(Math.min(1, q / 0.35))
      faisca.sprite.scale.set(estrela.escalaDaFaisca * cresce * (1 - 0.15 * Math.max(0, (q - 0.5) / 0.5)))
    }
  }

  function aplicar(estrela: EstrelaNoPalco): void {
    if (parada) aplicarParada(estrela)
    else aplicarMovendo(estrela, agora() / 1000)
  }

  function cruzaAVista(estrela: EstrelaNoPalco): boolean {
    if (vista === null) return true
    return estrela.x + estrela.raio >= vista.minX && estrela.x - estrela.raio <= vista.maxX && estrela.y + estrela.raio >= vista.minY && estrela.y - estrela.raio <= vista.maxY
  }

  function recortar(estrela: EstrelaNoPalco): void {
    const naVista = cruzaAVista(estrela)
    if (naVista === estrela.naVista) return
    estrela.naVista = naVista
    estrela.no.renderable = naVista
    // Volta à vista com a pose de agora, antes do primeiro quadro do relógio.
    if (naVista) aplicar(estrela)
  }

  function passo(): void {
    const t = agora()
    if (movimento !== undefined && Math.abs(t - conferidoEm) >= CONFERIR_MOVIMENTO_MS) {
      conferidoEm = t
      if (movimento.reducedMotion()) {
        acertarRelogio()
        return
      }
    }
    if (t - ultimoQuadro < QUADRO_DA_ESTRELA_MS * FOLGA_DO_QUADRO) return
    ultimoQuadro = t
    const segundos = t / 1000
    for (const estrela of estrelas) {
      // Nó levado junto com a camada (destroy em cascata): sai da conta, sem mexer no sprite morto.
      if (estrela.no.destroyed) {
        estrelas.delete(estrela)
        continue
      }
      if (estrela.naVista) aplicarMovendo(estrela, segundos)
    }
  }

  /** Relê o "menos movimento" e liga o relógio só com estrela na vista e movimento normal. */
  function acertarRelogio(): void {
    acertoMarcado = false
    if (destruido) return
    for (const estrela of estrelas) if (estrela.no.destroyed) estrelas.delete(estrela)
    const agoraParada = movimento === undefined || movimento.reducedMotion()
    if (agoraParada !== parada) {
      parada = agoraParada
      for (const estrela of estrelas) aplicar(estrela)
    }
    let algumaNaVista = false
    for (const estrela of estrelas) if (estrela.naVista) algumaNaVista = true
    const querRelogio = movimento !== undefined && !parada && algumaNaVista
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

  /** Muitas estrelas mudam na mesma passada de desenho: o relógio é acertado uma vez só, logo depois dela. */
  function marcarAcerto(): void {
    if (acertoMarcado) return
    acertoMarcado = true
    queueMicrotask(acertarRelogio)
  }

  /** As escalas de base e o lugar das faíscas pelo lado da caixa. */
  function medir(estrela: EstrelaNoPalco, lado: number): void {
    if (lado === estrela.lado) return
    estrela.lado = lado
    estrela.escalaDoCorpo = (PROPORCAO_DA_ESTRELA * lado) / DIAMETRO_DA_ESTRELA_PX
    estrela.escalaDoHalo = (PROPORCAO_DO_HALO * lado) / QUADRO_DO_HALO_PX
    estrela.escalaDaFaisca = (PROPORCAO_DA_FAISCA * lado) / DIAMETRO_DA_FAISCA_PX
    for (const faisca of estrela.faiscas) faisca.sprite.position.set(faisca.direcaoX * faisca.distancia * lado, faisca.direcaoY * faisca.distancia * lado)
    // A faísca mais longe (0,4 lado) mais a metade dela (0,1): o halo (0,45) cabe dentro.
    estrela.raio = 0.5 * lado
  }

  function criar(id: string): EstrelaDoItem {
    const tex = asTexturas()
    const sorteio = sorteioDoId(id)
    // A ordem dos sorteios é a do protótipo: ciclo, fase, quantas faíscas, ângulo de partida e, por faísca, os dela.
    const periodo = CICLO_DO_CINTILAR_S * (0.85 + sorteio() * 0.3)
    const fase = sorteio()
    const no = new Container()
    no.label = `estrela:${id}`
    no.eventMode = 'none'
    const halo = new Sprite(tex.halo)
    halo.anchor.set(0.5)
    halo.blendMode = 'add'
    const corpo = new Sprite(tex.estrela)
    corpo.anchor.set(0.5)
    const quantas = sorteio() < 0.5 ? 2 : 3
    const anguloInicial = sorteio() * TAU
    const faiscas: FaiscaNoPalco[] = []
    for (let i = 0; i < quantas; i += 1) {
      const angulo = anguloInicial + (i * TAU) / quantas + (sorteio() - 0.5) * 0.8
      const distancia = 0.3 + sorteio() * 0.1
      const sprite = new Sprite(tex.faisca)
      sprite.anchor.set(0.5)
      sprite.rotation = (sorteio() - 0.5) * 0.5
      sprite.visible = false
      faiscas.push({ sprite, inicio: 0.28 + (i * 0.62) / quantas + sorteio() * 0.06, base: 0.75 + sorteio() * 0.25, direcaoX: Math.cos(angulo), direcaoY: Math.sin(angulo), distancia })
    }
    no.addChild(halo, corpo, ...faiscas.map((faisca) => faisca.sprite))
    const estrela: EstrelaNoPalco = { no, halo, corpo, faiscas, periodo, fase, escalaDoCorpo: 1, escalaDoHalo: 1, escalaDaFaisca: 1, lado: 0, x: 0, y: 0, raio: 0, naVista: true }
    estrelas.add(estrela)
    return {
      no,
      posicionar(prop) {
        if (no.destroyed) return
        no.position.set(prop.x, prop.y)
        no.rotation = rotationToRadians(prop.rotation)
        estrela.x = prop.x
        estrela.y = prop.y
        medir(estrela, Math.max(1, Math.min(Math.abs(prop.width), Math.abs(prop.height))))
        estrela.naVista = cruzaAVista(estrela)
        no.renderable = estrela.naVista
        aplicar(estrela)
        marcarAcerto()
      },
      destruir() {
        estrelas.delete(estrela)
        if (!no.destroyed) no.destroy({ children: true })
        marcarAcerto()
      },
    }
  }

  return {
    criar,
    ajustarAVista(nova) {
      vista = nova
      // Mapa sem estrela: a câmera anda sem custo nenhum aqui.
      if (estrelas.size === 0 && !noRelogio) return
      for (const estrela of estrelas) if (!estrela.no.destroyed) recortar(estrela)
      marcarAcerto()
    },
    estado: lerEstado,
    destruir() {
      destruido = true
      if (noRelogio && movimento !== undefined) movimento.ticker.remove(passo)
      noRelogio = false
      for (const estrela of estrelas) if (!estrela.no.destroyed) estrela.no.destroy({ children: true })
      estrelas.clear()
      if (texturas !== null) {
        for (const textura of [texturas.estrela, texturas.faisca, texturas.halo]) if (textura !== Texture.EMPTY) textura.destroy(true)
        texturas = null
      }
    },
  }
}
