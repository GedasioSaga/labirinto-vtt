import { Container, Matrix, RenderTexture, Sprite, UPDATE_PRIORITY, type Renderer, type Ticker } from 'pixi.js'
import type { Caixa } from '../lib/texturas'

/**
 * VITRINE DAS TEXTURAS (otimização 200x200, fatia F7, 27/10/2026).
 *
 * Cada camada de textura passa por uma máscara alfa, e máscara alfa no Pixi é
 * um filtro: uma passada por camada. O Tasmaturi tem ~17 camadas e o
 * sintético 200x200 ~20: cada quadro custava 17 a 20 passadas de tela cheia
 * (149 Mpx por quadro em 2560x1440 a 150%), parado ou não, no Meio-Termo e no
 * modo linhas (`passadasDeFiltro` do harness). A pilha não muda de um quadro
 * para outro: só a câmera anda.
 *
 * A vitrine compõe a pilha em LADRILHOS de `LADO_DO_LADRILHO_PX` px (cada um
 * numa textura própria) cobrindo a tela mais uma margem, e o quadro desenha só
 * esses sprites. Composição nova vai para um segundo jogo de ladrilhos
 * ("atrás"), `LADRILHOS_POR_QUADRO` por quadro, do centro para fora; o jogo
 * da frente continua na tela até o de trás ficar pronto, e aí trocam. Assim
 * nenhum quadro paga a pilha inteira: o custo de compor fica diluído.
 *
 * Por que ladrilhos e não uma textura só: o filtro da máscara arredonda a área
 * para potência de 2. Tela + margem em 1440 a 150% (4800 px) virava textura de
 * 8192 a cada passada; num ladrilho de 1024 a textura do filtro é 1024.
 *
 * Compõe de novo quando: a pintura mudou (`sujar('ja')`: na hora, tudo; ou
 * `sujar('aos-poucos')`, os pedaços do chão chegando: aos poucos, por trás);
 * a vista passou da metade da margem; o zoom passou de `ZOOM_SEM_COMPOR`; ou a
 * câmera parou (`PARADA_MS`) num lugar diferente do da composição.
 *
 * PIXEL COM PIXEL: o canto da composição cai num pixel inteiro da tela, na
 * resolução da tela, e cada ladrilho é desenhado com a mesma conta mundo ->
 * pixel. Parada, a vitrine é cópia 1:1 da tela. Em movimento ela é reamostrada
 * até a câmera parar. A diferença possível é de arredondamento onde a camada é
 * translúcida (compor sobre transparente e depois sobre o chão não arredonda
 * igual a compor direto, 8 bits por canal).
 */

/** Margem de cada lado, em fração da tela. */
export const MARGEM_DA_VITRINE = 0.125
/** Câmera parada há este tempo num lugar diferente do da composição: compõe de novo, alinhada. */
export const PARADA_MS = 150
/** Zoom que passou disto (para mais ou para menos) desde a composição: compõe de novo. */
export const ZOOM_SEM_COMPOR = 1.2
/**
 * Lado do ladrilho em px do aparelho. Abaixo de 1024 de propósito: a área da
 * máscara arredonda para fora em unidades inteiras do mundo (alguns px a mais
 * de cada lado com zoom perto), e passar de 1024 dobraria a textura do filtro.
 */
export const LADO_DO_LADRILHO_PX = 960
/** Ladrilhos compostos por quadro na composição de trás. */
export const LADRILHOS_POR_QUADRO = 1
/** Texturas de ladrilho guardadas para reaproveitar (o resto é destruído ao trocar). */
const LIVRES_MAXIMO = 4

/** Câmera da tela: px CSS = mundo * s + t. */
export interface CameraDaTela {
  s: number
  tx: number
  ty: number
}

export interface QuadroDaVitrine {
  camera: CameraDaTela
  /** Canto da composição em px do aparelho, relativo à tela (inteiro, negativo = margem). */
  x0: number
  y0: number
  /** Tamanho em px do aparelho. */
  largura: number
  altura: number
  /** O pedaço do mundo que a composição cobre. */
  mundo: Caixa
  /** O pedaço do mundo que a tela mostra. */
  vista: Caixa
}

/** Onde a composição fica para esta câmera: tela + margem, em px inteiros do aparelho. */
export function quadroDaVitrine(camera: CameraDaTela, tela: { width: number; height: number }, resolucao: number, margem = MARGEM_DA_VITRINE): QuadroDaVitrine {
  const larguraDaTela = Math.ceil(tela.width * resolucao)
  const alturaDaTela = Math.ceil(tela.height * resolucao)
  const mx = Math.ceil(larguraDaTela * margem)
  const my = Math.ceil(alturaDaTela * margem)
  const x0 = -mx
  const y0 = -my
  const largura = larguraDaTela + 2 * mx
  const altura = alturaDaTela + 2 * my
  return {
    camera,
    x0,
    y0,
    largura,
    altura,
    mundo: caixaNoMundo(camera, resolucao, x0, y0, largura, altura),
    vista: caixaNoMundo(camera, resolucao, 0, 0, larguraDaTela, alturaDaTela),
  }
}

/** O retângulo de px do aparelho (relativo à tela) de volta ao mundo. */
function caixaNoMundo(camera: CameraDaTela, resolucao: number, x: number, y: number, largura: number, altura: number): Caixa {
  return {
    minX: (x / resolucao - camera.tx) / camera.s,
    minY: (y / resolucao - camera.ty) / camera.s,
    maxX: ((x + largura) / resolucao - camera.tx) / camera.s,
    maxY: ((y + altura) / resolucao - camera.ty) / camera.s,
  }
}

export interface Ladrilho {
  /** Canto em px do aparelho relativo à tela, na câmera da composição. */
  x: number
  y: number
  mundo: Caixa
}

/** Os ladrilhos do quadro, do centro da tela para fora (o do meio fica pronto primeiro). */
export function ladrilhosDoQuadro(q: QuadroDaVitrine, resolucao: number, lado = LADO_DO_LADRILHO_PX): Ladrilho[] {
  const lista: { l: Ladrilho; d: number }[] = []
  const cx = q.x0 + q.largura / 2
  const cy = q.y0 + q.altura / 2
  for (let y = q.y0; y < q.y0 + q.altura; y += lado) {
    for (let x = q.x0; x < q.x0 + q.largura; x += lado) {
      lista.push({ l: { x, y, mundo: caixaNoMundo(q.camera, resolucao, x, y, lado, lado) }, d: Math.hypot(x + lado / 2 - cx, y + lado / 2 - cy) })
    }
  }
  return lista.sort((a, b) => a.d - b.d).map((x) => x.l)
}

function mesmaCamera(a: CameraDaTela, b: CameraDaTela): boolean {
  return a.s === b.s && a.tx === b.tx && a.ty === b.ty
}

function cobre(fora: Caixa, dentro: Caixa): boolean {
  return dentro.minX >= fora.minX && dentro.minY >= fora.minY && dentro.maxX <= fora.maxX && dentro.maxY <= fora.maxY
}

/** A caixa encolhida de cada lado por `fracao` do seu tamanho. */
function encolher(c: Caixa, fx: number, fy: number): Caixa {
  return { minX: c.minX + fx, minY: c.minY + fy, maxX: c.maxX - fx, maxY: c.maxY - fy }
}

export interface EstadoDaVitrine {
  /** O quadro da composição da frente (`null` = nenhuma). */
  frente: QuadroDaVitrine | null
  /** A frente está atrás da versão da pintura (pedaços chegaram, pintura nova). */
  desatualizada: boolean
  /** ms desde que a câmera mexeu pela última vez. */
  parada: number
}

/**
 * Começar uma composição de trás neste quadro? (`agora` = o quadro desta câmera.)
 * A pintura nova com urgência (`ja`) não passa por aqui: compõe tudo na hora.
 */
export function precisaCompor(estado: EstadoDaVitrine, agora: QuadroDaVitrine): boolean {
  const { frente } = estado
  if (frente === null) return true
  // Metade da margem gasta: compõe antes de a vista sair da área (o pan não vê buraco).
  const meiaMargemX = (frente.vista.minX - frente.mundo.minX) / 2
  const meiaMargemY = (frente.vista.minY - frente.mundo.minY) / 2
  if (!cobre(encolher(frente.mundo, meiaMargemX, meiaMargemY), agora.vista)) return true
  const razao = agora.camera.s / frente.camera.s
  if (razao > ZOOM_SEM_COMPOR || razao < 1 / ZOOM_SEM_COMPOR) return true
  if (estado.parada < PARADA_MS) return false
  // Parada: pintura desatualizada ou câmera fora do lugar da composição (volta a casar 1:1 com a tela).
  return estado.desatualizada || !mesmaCamera(frente.camera, agora.camera)
}

export interface OpcoesDaVitrine {
  renderer: Renderer
  ticker: Ticker
  /** A pilha (as camadas com as máscaras): nunca vai para o palco, só é desenhada nos ladrilhos. */
  fonte: Container
  /** Antes de uma composição: recorta a pilha na vista da tela (nível dos pedaços) cobrindo `mundo` (pede os pedaços). */
  recortar: (vista: Caixa, mundo: Caixa) => void
  /** Antes de cada ladrilho: o que é desenhado (e a área das máscaras) fica preso a `mundo`. */
  limitar: (mundo: Caixa) => void
  /** Relógio (os testes passam um controlado). */
  agora?: () => number
}

export interface Vitrine {
  /** O que vai para o palco no lugar da pilha: os sprites dos ladrilhos. */
  readonly camada: Container
  sujar: (quanto: 'ja' | 'aos-poucos') => void
  /** Uma passada agora (o ticker chama a cada quadro; os testes chamam direto). */
  passo: () => void
  /** Ladrilhos compostos até agora (harness e testes). */
  readonly composicoes: number
  destruir: () => void
}

interface Jogo {
  quadro: QuadroDaVitrine
  versao: number
  ladrilhos: Ladrilho[]
  /** Quantos dos `ladrilhos` já foram compostos. */
  prontos: number
  sprites: Sprite[]
  grupo: Container
}

export function criarVitrine(o: OpcoesDaVitrine): Vitrine {
  const relogio = o.agora ?? (() => performance.now())
  const camada = new Container()
  camada.label = 'texturas'
  camada.eventMode = 'none'
  // A pilha é desenhada sozinha (`renderer.render` com a transformação da câmera): precisa ser raiz de grupo.
  o.fonte.enableRenderGroup()
  /** Texturas de ladrilho livres (todas do mesmo tamanho; a resolução muda só com a tela). */
  const livres: RenderTexture[] = []
  let frente: Jogo | null = null
  let atras: Jogo | null = null
  /** Sobe a cada mudança da pintura; o jogo guarda a de quando começou. */
  let versao = 0
  let urgente = true
  let mexeuEm = -Infinity
  let ultimaCamera: CameraDaTela | null = null
  let composicoes = 0
  let destruida = false
  const global = new Matrix()
  const transformacao = new Matrix()

  function cameraAgora(): CameraDaTela | null {
    // A conta mundo -> px CSS da tela sai do pai da camada (o `world`), sem giro.
    const pai = camada.parent
    if (pai === null) return null
    pai.getGlobalTransform(global, false)
    if (global.a <= 0) return null
    return { s: global.a, tx: global.tx, ty: global.ty }
  }

  function texturaLivre(r: number): RenderTexture {
    const lado = LADO_DO_LADRILHO_PX / r
    let t = livres.pop()
    while (t !== undefined && t.source.resolution !== r) {
      t.destroy(true)
      t = livres.pop()
    }
    // O mesmo antialias da tela: as máscaras herdam o do alvo, e a composição tem de sair igual à tela.
    return t ?? RenderTexture.create({ width: lado, height: lado, resolution: r, antialias: o.renderer.view.antialias })
  }

  function soltar(jogo: Jogo): void {
    for (const s of jogo.sprites) {
      if (!(s.texture instanceof RenderTexture)) continue
      // Guarda poucas para a próxima composição; o resto sai da placa (cada ladrilho são ~3,5 MB).
      if (livres.length < LIVRES_MAXIMO) livres.push(s.texture)
      else s.texture.destroy(true)
    }
    jogo.grupo.destroy({ children: true })
  }

  function novoJogo(q: QuadroDaVitrine): Jogo {
    const r = o.renderer.resolution
    const grupo = new Container()
    grupo.label = 'vitrine'
    grupo.visible = false
    camada.addChild(grupo)
    // Os pedaços do chão são pedidos para a área inteira de uma vez (pedir por ladrilho soltaria os do vizinho).
    o.recortar(q.vista, q.mundo)
    return { quadro: q, versao, ladrilhos: ladrilhosDoQuadro(q, r), prontos: 0, sprites: [], grupo }
  }

  function comporLadrilho(jogo: Jogo): void {
    const r = o.renderer.resolution
    const l = jogo.ladrilhos[jogo.prontos]
    const { camera } = jogo.quadro
    const textura = texturaLivre(r)
    o.limitar(l.mundo)
    // Mundo -> px CSS do ladrilho: a mesma conta da tela, deslocada pelo canto dele (px inteiro do aparelho).
    transformacao.set(camera.s, 0, 0, camera.s, camera.tx - l.x / r, camera.ty - l.y / r)
    o.renderer.render({ container: o.fonte, target: textura, clear: true, clearColor: [0, 0, 0, 0], transform: transformacao })
    const sprite = new Sprite(textura)
    sprite.position.set(l.mundo.minX, l.mundo.minY)
    sprite.scale.set(1 / camera.s)
    jogo.grupo.addChild(sprite)
    jogo.sprites.push(sprite)
    jogo.prontos += 1
    composicoes += 1
  }

  /** O jogo de trás ficou pronto: vai para a frente, e o da frente sai. */
  function trocar(): void {
    if (atras === null) return
    if (frente !== null) soltar(frente)
    frente = atras
    atras = null
    frente.grupo.visible = o.fonte.children.length > 0
  }

  function passo(): void {
    if (destruida || !camada.visible || !camada.renderable) return
    const camera = cameraAgora()
    if (camera === null) return
    const agora = relogio()
    if (ultimaCamera === null || !mesmaCamera(ultimaCamera, camera)) mexeuEm = agora
    ultimaCamera = camera
    // Renderer destruído (ou sem tela): nada a compor neste quadro, sem derrubar o laço do ticker.
    const tela = (o.renderer as Partial<Renderer> | null | undefined)?.screen
    if (tela === undefined || tela === null) return
    const q = quadroDaVitrine(camera, tela, o.renderer.resolution)
    if (urgente) {
      // Pintura nova, cena nova ou a primeira: tudo agora (sem mostrar a pintura de antes nem buraco).
      urgente = false
      if (atras !== null) soltar(atras)
      atras = novoJogo(q)
      while (atras.prontos < atras.ladrilhos.length) comporLadrilho(atras)
      trocar()
      return
    }
    if (atras === null) {
      const estado: EstadoDaVitrine = { frente: frente?.quadro ?? null, desatualizada: frente === null || frente.versao !== versao, parada: agora - mexeuEm }
      if (precisaCompor(estado, q)) atras = novoJogo(q)
    } else if (!cobre(atras.quadro.mundo, q.vista)) {
      // A vista já saiu da área da composição em curso (pan rápido, zoom para fora): recomeça na vista de agora.
      soltar(atras)
      atras = novoJogo(q)
    }
    if (atras === null) return
    for (let i = 0; i < LADRILHOS_POR_QUADRO && atras.prontos < atras.ladrilhos.length; i += 1) comporLadrilho(atras)
    if (atras.prontos === atras.ladrilhos.length) trocar()
  }

  // Antes do desenho do quadro (o render do Application roda em LOW).
  o.ticker.add(passo, undefined, UPDATE_PRIORITY.HIGH)

  return {
    camada,
    passo,
    get composicoes() {
      return composicoes
    },
    sujar: (quanto) => {
      versao += 1
      if (quanto === 'ja') urgente = true
    },
    destruir: () => {
      destruida = true
      o.ticker.remove(passo)
      if (atras !== null) soltar(atras)
      if (frente !== null) soltar(frente)
      for (const t of livres.splice(0)) t.destroy(true)
      camada.destroy({ children: true })
    },
  }
}
