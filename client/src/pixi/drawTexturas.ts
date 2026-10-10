import { CanvasSource, Container, Sprite, Texture, TilingSprite } from 'pixi.js'
import type { Drawing, MapData, PinceladaDeTextura, Region, TexturaImportada } from '../types/map'
import { planoDasTexturas, pixelsDoPlano, type PlanoDasTexturas } from '../lib/planoDasTexturas'
import { assinaturaDasTexturas, type Caixa } from '../lib/texturas'
import { unidadeDoRelevo } from '../lib/relevo'
import type { Camera } from './world'
import { assinarTexturas, texturaDoCatalogo } from '../texturas/catalogo'
import { LADO_DO_LADRILHO, pixelsEmFatias } from '../texturas/ladrilhos'
import { rasterizarTexturas } from './texturasRaster'

/**
 * TEXTURAS no palco (`lib/texturas.ts`): acima do chão das regiões e dos
 * desenhos, abaixo do relevo (a luz e a sombra caem por cima da textura), da
 * borda das regiões e de tudo o que se lê (paredes, nomes, pinos, fichas).
 *
 * Cada camada do plano (`lib/planoDasTexturas.ts`) é uma textura repetida
 * (`TilingSprite`, ladrilho em potência de 2 com mipmap: sem emenda nem
 * cintilação ao afastar) vista pela máscara dela (`texturasRaster.ts`).
 *
 * NADA é redesenhado por quadro: a máscara nasce quando os passos mudam e
 * fica parada. A pintura espera a mão parar (`ESPERA_DAS_TEXTURAS_MS`) e a de
 * antes fica na tela até a nova ficar pronta (sem piscar). Troca de cena
 * solta a da cena anterior na hora.
 */

export const ESPERA_DAS_TEXTURAS_MS = 250

/** Lado mínimo do ladrilho no mapa, em células: num mapa pequeno de masmorra a copa não vira grão. */
const LADRILHO_MINIMO_EM_CELULAS = 3
/** Escala da textura importada (o mestre não diz o tamanho; a mesma da Floresta). */
export const ESCALA_DA_IMPORTADA = 40

export interface EntradaDasTexturas {
  /** Id da cena (`MapData.id`): cena nova solta a pintura da anterior na hora. */
  cena: string
  mapa: Pick<MapData, 'width' | 'height' | 'grid'>
  /** Os passos que ESTA tela recebeu (no jogador, os do recorte dele). */
  passos: readonly PinceladaDeTextura[] | undefined
  importadas: readonly TexturaImportada[] | undefined
  /** As regiões e os desenhos que ESTA tela desenha: o balde enche a forma deles. */
  regioes: readonly Region[]
  desenhos: readonly Drawing[]
}

export interface MedidaDasTexturas {
  ms: number
  camadas: number
  pixels: number
}

export interface OpcoesDasTexturas {
  esperaMs?: number
  aoGerar?: (medida: MedidaDasTexturas) => void
  /** Avisado quando a camada passa a ter algo (ou nada): o jogador esconde junto o contêiner com a máscara do conhecido. */
  aoMudarVisibilidade?: (visivel: boolean) => void
  /** Os testes trocam a pintura das máscaras e o ladrilho (não há canvas no jsdom). */
  rasterizar?: (plano: PlanoDasTexturas, cancelado: () => boolean) => Promise<HTMLCanvasElement[] | null>
  ladrilho?: (id: string, importada: TexturaImportada | undefined, cancelado: () => boolean) => Promise<Texture | null>
  mascara?: (tela: HTMLCanvasElement) => Texture
}

export interface TexturasRenderer {
  readonly camada: Container
  /**
   * O ladrilho de uma textura para a PRÉVIA do pincel, se já está pronto;
   * senão começa a fazê-lo e devolve `null` (a prévia sai na cor neutra).
   */
  ladrilhoParaPrevia: (id: string, importadas: readonly TexturaImportada[] | undefined) => Texture | null
  atualizar: (entrada: EntradaDasTexturas | null) => void
  /**
   * A pintura desta entrada num contêiner NOVO, sem mexer no palco: a imagem
   * exportada pinta a do mapa dela (sem os itens do mestre) antes de trocar a
   * cena. `null` = nada a pintar (ou o palco desmontou). Quem pede solta com
   * `soltarPintura`.
   */
  pintarAParte: (entrada: EntradaDasTexturas) => Promise<Container | null>
  /**
   * O pedaço do mundo à vista (`vistaDaCamera`); `null` = sem recorte. A
   * textura repetida do palco cobre só o que está na tela: o Pixi passa a
   * área mascarada por uma textura do tamanho dela NA TELA, sem recortar na
   * janela (`MaskFilter`, `clipToViewport: false`), e um balde num continente
   * a 100% pedia 16384 x 8192 px — a placa recusa e a tela do mestre fica
   * vazia. Quem move a câmera chama a cada mudança.
   */
  ajustarAVista: (vista: Caixa | null) => void
  destruir: () => void
}

/** O pedaço do mundo que a tela mostra com esta câmera (sem giro: o mundo só anda e escala). */
export function vistaDaCamera(camera: Camera, tela: { width: number; height: number }): Caixa {
  return {
    minX: -camera.x / camera.scale,
    minY: -camera.y / camera.scale,
    maxX: (tela.width - camera.x) / camera.scale,
    maxY: (tela.height - camera.y) / camera.scale,
  }
}

/**
 * Leva a área repetida para o pedaço da caixa da pintura que está à vista. A
 * máscara continua do tamanho da pintura (só recorta quem é mascarado), e o
 * ladrilho segue preso à origem do mundo: mover a vista não desliza o desenho.
 */
function recortarNaVista(repetida: TilingSprite, caixa: Caixa, vista: Caixa | null): void {
  // Pixel inteiro para fora: a borda da tela nunca cai meio pixel antes do fim da textura.
  const minX = vista === null ? caixa.minX : Math.max(caixa.minX, Math.floor(vista.minX))
  const minY = vista === null ? caixa.minY : Math.max(caixa.minY, Math.floor(vista.minY))
  const maxX = vista === null ? caixa.maxX : Math.min(caixa.maxX, Math.ceil(vista.maxX))
  const maxY = vista === null ? caixa.maxY : Math.min(caixa.maxY, Math.ceil(vista.maxY))
  repetida.visible = maxX > minX && maxY > minY
  if (!repetida.visible) return
  repetida.position.set(minX, minY)
  repetida.setSize(maxX - minX, maxY - minY)
  repetida.tilePosition.set(-minX, -minY)
}

/**
 * Solta uma pintura: a repetição sai (o ladrilho fica no cache) e a máscara,
 * que é só desta pintura, vai com a tela dela. Os filhos saem do contêiner.
 */
export function soltarPintura(alvo: Container): void {
  for (const filho of alvo.removeChildren()) {
    if (filho instanceof TilingSprite) {
      filho.mask = null
      filho.destroy()
    } else if (filho instanceof Sprite && !filho.destroyed) {
      filho.texture.destroy(true)
      filho.destroy()
    }
  }
}

/** Lado do ladrilho no mundo: a escala da textura no metro do relevo, nunca menor que umas células. */
export function ladoDoLadrilhoNoMundo(mapa: Pick<MapData, 'width' | 'height' | 'grid'>, escala: number): number {
  return Math.max(escala * unidadeDoRelevo(mapa), LADRILHO_MINIMO_EM_CELULAS * mapa.grid)
}

/** O lado do ladrilho de uma textura, em px do protótipo do relevo: a do catálogo, ou a fixa da importada. */
export function escalaDaTextura(id: string): number {
  return texturaDoCatalogo(id)?.escala ?? ESCALA_DA_IMPORTADA
}

/** A textura de pixels já prontos, repetível e com mipmap. */
function texturaDoLadrilho(tela: HTMLCanvasElement): Texture {
  return new Texture({ source: new CanvasSource({ resource: tela, autoGenerateMipmaps: true, addressMode: 'repeat', scaleMode: 'linear' }) })
}

function telaComPixels(pixels: Uint8ClampedArray, lado: number): HTMLCanvasElement | null {
  const tela = document.createElement('canvas')
  tela.width = lado
  tela.height = lado
  const g = tela.getContext('2d')
  if (g === null) return null
  g.putImageData(new ImageData(new Uint8ClampedArray(pixels), lado, lado), 0, 0)
  return tela
}

function carregarImagem(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolver) => {
    const img = new Image()
    img.onload = () => resolver(img)
    img.onerror = () => resolver(null)
    img.src = src
  })
}

/** O ladrilho de uma textura do catálogo (gerado em fatias) ou importada (a imagem dela). */
async function ladrilhoPadrao(id: string, importada: TexturaImportada | undefined, cancelado: () => boolean): Promise<Texture | null> {
  if (importada !== undefined) {
    const img = await carregarImagem(importada.imagem)
    if (img === null || cancelado()) return null
    const tela = document.createElement('canvas')
    tela.width = LADO_DO_LADRILHO
    tela.height = LADO_DO_LADRILHO
    const g = tela.getContext('2d')
    if (g === null) return null
    g.drawImage(img, 0, 0, LADO_DO_LADRILHO, LADO_DO_LADRILHO)
    return texturaDoLadrilho(tela)
  }
  const textura = texturaDoCatalogo(id)
  if (textura === null) return null
  const pixels = await pixelsEmFatias(textura.cor, LADO_DO_LADRILHO, cancelado)
  if (pixels === null) return null
  const tela = telaComPixels(pixels, LADO_DO_LADRILHO)
  return tela === null ? null : texturaDoLadrilho(tela)
}

const SEM_ITENS: readonly never[] = []

function mesmosItens<T>(a: readonly T[], b: readonly T[]): boolean {
  return a === b || (a.length === b.length && a.every((item, i) => item === b[i]))
}

/** Uma textura repetida do palco e a caixa inteira da pintura dela (o recorte na vista sai dessa caixa). */
interface Recortavel {
  repetida: TilingSprite
  caixa: Caixa
}

/** O que está no palco (ou saindo): a entrada, a versão do catálogo e, quando preciso, a assinatura das formas. */
interface Pedida {
  entrada: EntradaDasTexturas
  versao: number
  formas?: string
}

/** Assinatura das formas que o balde enche: o conteúdo, para quando as referências mudam sem mudar nada (o jogador). */
function assinaturaDasFormas(e: EntradaDasTexturas): string {
  return JSON.stringify([e.regioes.map((r) => [r.id, r.filled, r.points]), e.desenhos])
}

function mesmasImportadas(a: readonly TexturaImportada[], b: readonly TexturaImportada[]): boolean {
  return a.length === b.length && a.every((t, i) => t === b[i] || (t.id === b[i].id && t.imagem === b[i].imagem))
}

/**
 * Mesma pintura? Passos e importadas pelo conteúdo. Regiões e desenhos (só
 * com balde) item a item pela referência — o editor guarda a mesma referência
 * do que não mudou —, e pelo conteúdo quando ela muda: o mapa do jogador chega
 * novo a cada mensagem, e cada passo da ficha repintaria tudo à toa.
 */
function mesmaPintura(pedida: Pedida, b: EntradaDasTexturas, versaoB: number): boolean {
  const a = pedida.entrada
  if (a.cena !== b.cena || pedida.versao !== versaoB) return false
  if (a.mapa.width !== b.mapa.width || a.mapa.height !== b.mapa.height || a.mapa.grid !== b.mapa.grid) return false
  if (!mesmasImportadas(a.importadas ?? SEM_ITENS, b.importadas ?? SEM_ITENS)) return false
  if (a.passos !== b.passos && assinaturaDasTexturas(a.passos) !== assinaturaDasTexturas(b.passos)) return false
  const temBalde = (b.passos ?? []).some((p) => p.tipo === 'balde')
  if (!temBalde || (mesmosItens(a.regioes, b.regioes) && mesmosItens(a.desenhos, b.desenhos))) return true
  pedida.formas ??= assinaturaDasFormas(a)
  const formas = assinaturaDasFormas(b)
  if (formas !== pedida.formas) return false
  // O mesmo conteúdo em referências novas: guarda as novas, e a próxima conferência sai barata.
  pedida.entrada = b
  return true
}

export function createTexturasRenderer(opcoes: OpcoesDasTexturas = {}): TexturasRenderer {
  const camada = new Container()
  camada.eventMode = 'none'
  camada.label = 'texturas'
  const esperaMs = opcoes.esperaMs ?? ESPERA_DAS_TEXTURAS_MS
  const rasterizar = opcoes.rasterizar ?? rasterizarTexturas
  const ladrilho = opcoes.ladrilho ?? ladrilhoPadrao
  const mascaraDe = opcoes.mascara ?? ((tela: HTMLCanvasElement) => Texture.from(tela, true))

  /** Ladrilhos já feitos, por id (a importada pelo id, que é único por imagem). */
  const ladrilhos = new Map<string, Promise<Texture | null>>()
  /** Os que já ficaram prontos (a prévia precisa deles na hora, sem esperar). */
  const prontos = new Map<string, Texture>()
  /** Muda quando o catálogo muda (pacote novo): a pintura sai de novo com as texturas que chegaram. */
  let versaoDoCatalogo = 0
  let destruido = false
  let geracao = 0
  let espera: ReturnType<typeof setTimeout> | null = null
  /** O que está no palco agora (ou sendo pintado), para não pintar de novo o mesmo. */
  let pedida: Pedida | null = null
  let cenaNoPalco: string | null = null
  let visivel = false
  let ultimaEntrada: EntradaDasTexturas | null = null
  /**
   * Ladrilhos que saíram do cache (pacote novo) mas ainda podem estar no
   * palco: o TilingSprite segue apontando para eles até a repintura, e o
   * Pixi lê a fonte do ladrilho a cada quadro (destruído = erro no laço de
   * render, e a tela congela). Só são destruídos quando `limparPalco` tira as
   * camadas que os usavam.
   */
  const descartados: Promise<Texture | null>[] = []
  /** O último ladrilho entregue à prévia do pincel: o traço em curso pode estar desenhando com ele. */
  let ladrilhoDaPrevia: Texture | null = null
  /** O pedaço do mundo à vista (`ajustarAVista`) e as repetidas do palco que se recortam nele. */
  let vista: Caixa | null = null
  let noPalco: Recortavel[] = []

  const pararDeOuvir = assinarTexturas(() => {
    // As do pacote saem do cache (a cor pode ter mudado); as embutidas ficam.
    for (const [id, promessa] of [...ladrilhos]) {
      if (texturaDoCatalogo(id)?.origem !== 'embutida' && !id.startsWith('importada:')) {
        descartados.push(promessa)
        ladrilhos.delete(id)
        prontos.delete(id)
      }
    }
    versaoDoCatalogo += 1
    if (ultimaEntrada !== null) atualizar(ultimaEntrada)
  })

  /** Destrói os ladrilhos descartados, menos o da prévia (fica para a próxima vez, ou para o `destruir`). */
  function soltarDescartados(): void {
    for (const promessa of descartados.splice(0)) {
      void promessa.then((t) => {
        if (t === null || t.destroyed) return
        if (t === ladrilhoDaPrevia && !destruido) descartados.push(promessa)
        else t.destroy(true)
      })
    }
  }

  function mudarVisibilidade(agora: boolean): void {
    if (agora === visivel) return
    visivel = agora
    opcoes.aoMudarVisibilidade?.(agora)
  }

  function limparPalco(): void {
    noPalco = []
    soltarPintura(camada)
    // Nenhuma camada usa mais os ladrilhos que o pacote novo aposentou.
    soltarDescartados()
    mudarVisibilidade(false)
  }

  function obterLadrilho(id: string, importadas: readonly TexturaImportada[] | undefined, cancelado: () => boolean): Promise<Texture | null> {
    const existente = ladrilhos.get(id)
    if (existente !== undefined) return existente
    const importada = importadas?.find((t) => t.id === id)
    const promessa = ladrilho(id, importada, cancelado).then(
      (t) => {
        // Falhou (imagem quebrada, palco desmontado): sai do cache para a próxima pintura tentar de novo.
        if (t === null) ladrilhos.delete(id)
        else if (ladrilhos.get(id) === promessa) prontos.set(id, t)
        return t
      },
      (erro: unknown) => {
        // Lançou (cor de fora que lança): a promessa rejeitada também sai do cache, senão toda pintura seguinte falharia igual.
        if (ladrilhos.get(id) === promessa) ladrilhos.delete(id)
        throw erro
      },
    )
    ladrilhos.set(id, promessa)
    return promessa
  }

  function escalaDe(id: string): number {
    return escalaDaTextura(id)
  }

  function planoDe(entrada: EntradaDasTexturas): PlanoDasTexturas | null {
    const importadas = new Set((entrada.importadas ?? []).map((t) => t.id))
    return planoDasTexturas(entrada.passos, entrada.regioes, entrada.desenhos, (id) => importadas.has(id) || texturaDoCatalogo(id) !== null)
  }

  /** Ladrilhos e máscaras do plano, prontos para montar; `null` = cancelado no meio. */
  async function prepararPlano(
    plano: PlanoDasTexturas,
    entrada: EntradaDasTexturas,
    cancelado: () => boolean,
  ): Promise<{ ladrilhoDe: Map<string, Texture | null>; mascaras: HTMLCanvasElement[] } | null> {
    const usadas = [...new Set(plano.camadas.map((c) => c.textura))]
    // O ladrilho só desiste com o palco desmontado: a edição seguinte reaproveita o que já está saindo.
    const prontos = await Promise.all(usadas.map((id) => obterLadrilho(id, entrada.importadas, () => destruido)))
    if (cancelado()) return null
    const ladrilhoDe = new Map(usadas.map((id, i) => [id, prontos[i]]))
    const mascaras = await rasterizar(plano, cancelado)
    if (cancelado() || mascaras === null) return null
    return { ladrilhoDe, mascaras }
  }

  /**
   * Cada camada do plano (a textura repetida vista pela máscara dela) dentro
   * de `alvo`, recortada em `vista` (`null` = a pintura inteira, a do PNG).
   * Devolve cada repetida com a caixa da pintura dela, para recortar de novo.
   */
  function montarPlano(
    alvo: Container,
    plano: PlanoDasTexturas,
    entrada: EntradaDasTexturas,
    { ladrilhoDe, mascaras }: { ladrilhoDe: Map<string, Texture | null>; mascaras: HTMLCanvasElement[] },
    vista: Caixa | null,
  ): Recortavel[] {
    const montadas: Recortavel[] = []
    plano.camadas.forEach((c, i) => {
      const tile = ladrilhoDe.get(c.textura)
      const tela = mascaras[i]
      if (tile === null || tile === undefined || tela === undefined) return
      const lado = ladoDoLadrilhoNoMundo(entrada.mapa, escalaDe(c.textura))
      const repetida = new TilingSprite({ texture: tile })
      repetida.tileScale.set(lado / tile.width)
      // A grade dos ladrilhos parte da origem do mundo (`recortarNaVista`):
      // pintar mais (a caixa cresce) não desliza a floresta que já estava lá.
      recortarNaVista(repetida, c.caixa, vista)
      const mascara = new Sprite(mascaraDe(tela))
      mascara.position.set(c.caixa.minX, c.caixa.minY)
      mascara.scale.set(1 / plano.escala)
      alvo.addChild(repetida, mascara)
      repetida.setMask({ mask: mascara, channel: 'alpha' })
      montadas.push({ repetida, caixa: c.caixa })
    })
    return montadas
  }

  async function pintar(entrada: EntradaDasTexturas, minha: number): Promise<void> {
    const cancelado = () => destruido || minha !== geracao
    const inicio = performance.now()
    const plano = planoDe(entrada)
    if (plano === null) {
      limparPalco()
      cenaNoPalco = entrada.cena
      return
    }
    const pronto = await prepararPlano(plano, entrada, cancelado)
    if (pronto === null) return
    limparPalco()
    noPalco = montarPlano(camada, plano, entrada, pronto, vista)
    cenaNoPalco = entrada.cena
    mudarVisibilidade(camada.children.length > 0)
    opcoes.aoGerar?.({ ms: performance.now() - inicio, camadas: plano.camadas.length, pixels: pixelsDoPlano(plano) })
  }

  function cancelarEspera(): void {
    if (espera !== null) clearTimeout(espera)
    espera = null
  }

  function atualizar(entrada: EntradaDasTexturas | null): void {
    if (destruido) return
    ultimaEntrada = entrada
    if (entrada === null || entrada.passos === undefined || entrada.passos.length === 0) {
      cancelarEspera()
      geracao += 1
      pedida = null
      limparPalco()
      cenaNoPalco = entrada?.cena ?? null
      return
    }
    if (pedida !== null && mesmaPintura(pedida, entrada, versaoDoCatalogo)) return
    const cenaNova = cenaNoPalco !== entrada.cena
    // Cena nova: a pintura da anterior sai NA HORA (não fica por cima do mapa novo).
    if (cenaNova) limparPalco()
    pedida = { entrada, versao: versaoDoCatalogo }
    cancelarEspera()
    geracao += 1
    const minha = geracao
    const comecar = () => {
      espera = null
      pintar(entrada, minha).catch((erro: unknown) => {
        // Pintura que quebrou no meio não pode travar as próximas: a mesma entrada tenta de novo.
        if (minha === geracao) pedida = null
        console.warn('[texturas] a pintura falhou', erro)
      })
    }
    // Sem nada no palco (abriu a cena) não há o que esperar; na edição, espera a mão parar.
    if (cenaNova || camada.children.length === 0) comecar()
    else espera = setTimeout(comecar, esperaMs)
  }

  async function pintarAParte(entrada: EntradaDasTexturas): Promise<Container | null> {
    if (destruido || entrada.passos === undefined || entrada.passos.length === 0) return null
    const plano = planoDe(entrada)
    if (plano === null) return null
    const parado = () => destruido
    const alvo = new Container()
    alvo.eventMode = 'none'
    alvo.label = 'texturas-a-parte'
    try {
      const pronto = await prepararPlano(plano, entrada, parado)
      if (pronto === null) {
        alvo.destroy()
        return null
      }
      montarPlano(alvo, plano, entrada, pronto, null)
      return alvo
    } catch (erro: unknown) {
      // Como o `gerarAParte` do relevo: o PNG sai sem a textura em vez de não sair (o palco faz o mesmo no `.catch` do `pintar`).
      soltarPintura(alvo)
      alvo.destroy()
      console.warn('[texturas] a pintura da imagem falhou', erro)
      return null
    }
  }

  return {
    camada,
    atualizar,
    pintarAParte,
    ajustarAVista: (agora) => {
      vista = agora
      for (const { repetida, caixa } of noPalco) recortarNaVista(repetida, caixa, vista)
    },
    ladrilhoParaPrevia: (id, importadas) => {
      if (destruido) return null
      const pronto = prontos.get(id)
      ladrilhoDaPrevia = pronto ?? null
      if (pronto !== undefined) return pronto
      if (importadas?.some((t) => t.id === id) || texturaDoCatalogo(id) !== null) void obterLadrilho(id, importadas, () => destruido)
      return null
    },
    destruir: () => {
      destruido = true
      cancelarEspera()
      pararDeOuvir()
      limparPalco()
      // `destruido` já está ligado: o `limparPalco` acima soltou também o da prévia.
      for (const promessa of ladrilhos.values()) void promessa.then((t) => t?.destroy(true))
      ladrilhos.clear()
      prontos.clear()
      camada.destroy()
    },
  }
}

