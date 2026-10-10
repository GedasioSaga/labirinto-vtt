import { CanvasSource, Container, Sprite, Texture } from 'pixi.js'
import type { Carimbo, CarimboImportado, MapData } from '../types/map'
import { ehTipoImportado, mesmosCarimbos, varianteDoGiro } from '../lib/carimbos'
import { unidadeDoRelevo } from '../lib/relevo'
import { assinarCarimbos, carimboDoCatalogo } from '../carimbos/catalogo'
import { ALFA_DA_SOMBRA, assarDesenho, assarImagem, QUADRO_DA_SOMBRA, type ArteEmTela, type QuadroDaArte } from '../carimbos/arte'

/**
 * CARIMBOS no palco (`lib/carimbos.ts`): os objetos que o mestre soltou,
 * acima do chão, das texturas, do relevo, da borda das regiões e dos
 * caminhos, e ABAIXO de paredes, nomes, pinos e fichas — tudo o que se lê
 * continua por cima.
 *
 * Três camadas, de baixo para cima, como no protótipo Diorama:
 * 1. o CHÃO: os objetos rentes ao chão (a poça), que as sombras cobrem;
 * 2. as SOMBRAS: todas numa camada só, pintada em pedaços (`LADO_DO_PEDACO`
 *    px do protótipo do relevo) com a silhueta opaca de cada sombra e posta
 *    no palco com a transparência uma vez só — duas sombras que se cruzam não
 *    escurecem duas vezes, e o palco desenha meia dúzia de imagens, não mil;
 * 3. os CORPOS: um sprite por objeto, todos da mesma textura por desenho (o
 *    Pixi os junta num lote), de trás (norte) para a frente (sul).
 *
 * NADA é redesenhado por quadro: os sprites e os pedaços mudam só quando os
 * objetos mudam, e só o pedaço que mudou é pintado de novo. Troca de cena
 * solta tudo da anterior na hora.
 */

/** Lado do desenho de cada objeto, em texels: nítido de perto no editor (o celular passa menos). */
export const LADO_DA_ARTE = 256
/** Lado do pedaço de sombra, em px do protótipo do relevo (`unidadeDoRelevo`): um mapa inteiro dá uns 5 × 4. */
const LADO_DO_PEDACO = 256
/**
 * Resolução do pedaço de sombra, em texels (2 por px do protótipo; lado em
 * potência de 2, para o mipmap valer em qualquer placa): a sombra é macia. No
 * pior caso medido (2.000 objetos espalhados pelo mapa inteiro, 39 pedaços),
 * 512² dá ~39 MB de placa — por isso o celular usa a metade do lado (~10 MB).
 */
export const TEXELS_DO_PEDACO = 512
/** Num mapa pequeno, o pedaço nunca fica menor que umas células (senão viram centenas). */
const PEDACO_MINIMO_EM_CELULAS = 8
/** O objeto que a borracha vai tirar fica assim, enquanto o mestre ainda não soltou. */
const ALFA_DE_QUEM_SAI = 0.28
/** A imagem importada não tem oito desenhos: inclina de leve com o giro (até ±5°), sem deitar. */
const INCLINACAO_DO_IMPORTADO = 0.09

export interface ArteNoPalco {
  corpo: Texture
  quadro: QuadroDaArte
  /** A silhueta da sombra (`carimbos/arte.ts`), ou `null` no objeto do chão. */
  sombra: CanvasImageSource | null
  chao: boolean
}

export interface EntradaDosCarimbos {
  /** Id da cena (`MapData.id`): cena nova solta os objetos da anterior na hora. */
  cena: string
  mapa: Pick<MapData, 'width' | 'height' | 'grid'>
  /** Os objetos que ESTA tela recebeu (no jogador, os do recorte dele). */
  carimbos: readonly Carimbo[] | undefined
  importados: readonly CarimboImportado[] | undefined
  /** `false` = sem a camada de sombras (o modo leve do jogador: os objetos ficam, a memória dos pedaços sai). */
  sombras?: boolean
}

export interface MedidaDosCarimbos {
  ms: number
  objetos: number
  pedacos: number
}

export interface OpcoesDosCarimbos {
  /** Lado em texels do desenho de cada objeto. */
  ladoDaArte?: number
  /** Resolução do pedaço de sombra. */
  texelsDoPedaco?: number
  aoDesenhar?: (medida: MedidaDosCarimbos) => void
  /** Avisado quando a camada passa a ter algo (ou nada): o jogador esconde junto o contêiner com a máscara do conhecido. */
  aoMudarVisibilidade?: (visivel: boolean) => void
  /** Os testes trocam a arte (não há canvas no jsdom). `null` = o objeto não sai. */
  assar?: (tipo: string, variante: number, importado: CarimboImportado | undefined) => ArteNoPalco | null | Promise<ArteNoPalco | null>
  /** Os testes trocam a pintura do pedaço de sombra. */
  pintarPedaco?: (pedaco: PedacoDeSombra) => Texture | null
}

/** Um pedaço da camada de sombras: a caixa no mundo e as sombras que caem nele. */
export interface PedacoDeSombra {
  x: number
  y: number
  lado: number
  texels: number
  sombras: Array<{ silhueta: CanvasImageSource; x: number; y: number; largura: number; altura: number }>
  /** A textura que este pedaço já tinha: a pintura padrão repinta a tela dela no lugar, sem alocar outra. */
  textura?: Texture
}

export interface CarimbosRenderer {
  readonly camada: Container
  atualizar: (entrada: EntradaDosCarimbos | null) => void
  /**
   * PRÉVIA do gesto, por cima de tudo da camada: os objetos que o spray vai
   * soltar (já com o desenho e a sombra deles) e os que a borracha vai tirar
   * (apagados), antes de o mestre soltar o botão.
   */
  mostrarPrevia: (novos: readonly Carimbo[], apagando: ReadonlySet<string>, importados: readonly CarimboImportado[] | undefined) => void
  limparPrevia: () => void
  destruir: () => void
}

/** Lado do pedaço no mundo. */
export function ladoDoPedacoNoMundo(mapa: Pick<MapData, 'width' | 'height' | 'grid'>): number {
  return Math.max(LADO_DO_PEDACO * unidadeDoRelevo(mapa), PEDACO_MINIMO_EM_CELULAS * mapa.grid)
}

function texturaDaTela(tela: HTMLCanvasElement): Texture {
  return new Texture({ source: new CanvasSource({ resource: tela, autoGenerateMipmaps: true, scaleMode: 'linear' }) })
}

function carregarImagem(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolver) => {
    const img = new Image()
    img.onload = () => resolver(img)
    img.onerror = () => resolver(null)
    img.src = src
  })
}

/** A arte de verdade: do catálogo (na hora) ou da imagem importada (depois que ela abre). */
function assarPadrao(lado: number) {
  return (tipo: string, variante: number, importado: CarimboImportado | undefined): ArteNoPalco | null | Promise<ArteNoPalco | null> => {
    const paraOPalco = (arte: ArteEmTela | null): ArteNoPalco | null =>
      arte === null ? null : { corpo: texturaDaTela(arte.corpo), quadro: arte.quadro, sombra: arte.sombra, chao: arte.chao }
    if (importado !== undefined) {
      return carregarImagem(importado.imagem).then((img) => (img === null ? null : paraOPalco(assarImagem(img, img.naturalWidth, img.naturalHeight, lado))))
    }
    const definicao = carimboDoCatalogo(tipo)
    if (definicao === null) return null
    return paraOPalco(assarDesenho(definicao.desenhar, definicao.sombra, (variante * Math.PI) / 4, variante, lado))
  }
}

/** A pintura padrão do pedaço: as silhuetas numa tela opaca, na resolução do pedaço. */
function pintarPedacoPadrao(pedaco: PedacoDeSombra): Texture | null {
  const anterior = pedaco.textura?.source.resource
  const tela = anterior instanceof HTMLCanvasElement && anterior.width === pedaco.texels ? anterior : document.createElement('canvas')
  tela.width = pedaco.texels
  tela.height = pedaco.texels
  const g = tela.getContext('2d')
  if (g === null) return null
  g.clearRect(0, 0, pedaco.texels, pedaco.texels)
  const k = pedaco.texels / pedaco.lado
  for (const s of pedaco.sombras) g.drawImage(s.silhueta, (s.x - pedaco.x) * k, (s.y - pedaco.y) * k, s.largura * k, s.altura * k)
  if (pedaco.textura !== undefined && tela === anterior) {
    // A mesma tela: só sobe os pixels novos para a placa de vídeo.
    pedaco.textura.source.update()
    return pedaco.textura
  }
  return texturaDaTela(tela)
}

/** A arte guardada: pronta, assando (a imagem importada abrindo) ou sem jeito (`null`). */
type Guardada = ArteNoPalco | null | 'assando'

interface PedacoNoPalco {
  sprite: Sprite
  assinatura: string
}

export function createCarimbosRenderer(opcoes: OpcoesDosCarimbos = {}): CarimbosRenderer {
  const camada = new Container()
  camada.eventMode = 'none'
  camada.label = 'carimbos'
  const chao = new Container()
  chao.label = 'carimbos-chao'
  const sombras = new Container()
  sombras.label = 'carimbos-sombras'
  sombras.alpha = ALFA_DA_SOMBRA
  const corpos = new Container()
  corpos.label = 'carimbos-corpos'
  const rascunho = new Container()
  rascunho.label = 'carimbos-rascunho'
  const rascunhoSombras = new Container()
  const rascunhoCorpos = new Container()
  rascunhoCorpos.sortableChildren = true
  rascunho.addChild(rascunhoSombras, rascunhoCorpos)
  // A prévia muda a cada passo do spray: num grupo próprio, mexer nela não
  // obriga o Pixi a refazer os lotes do mapa inteiro (como o rascunho do editor).
  rascunho.enableRenderGroup()
  camada.addChild(chao, sombras, corpos, rascunho)

  const ladoDaArte = opcoes.ladoDaArte ?? LADO_DA_ARTE
  const texelsDoPedaco = opcoes.texelsDoPedaco ?? TEXELS_DO_PEDACO
  const assar = opcoes.assar ?? assarPadrao(ladoDaArte)
  const pintarPedaco = opcoes.pintarPedaco ?? pintarPedacoPadrao

  /** Artes por `tipo#variante` (o importado tem uma só, variante 0). */
  const artes = new Map<string, Guardada>()
  /**
   * Muda quando uma arte fica pronta ou o catálogo muda: o mesmo mapa é
   * desenhado de novo. NÃO entra na assinatura do pedaço de sombra — senão
   * qualquer arte nova repintaria o mapa inteiro de sombras.
   */
  let versaoDasArtes = 0
  /**
   * Identidade de cada arte, para a assinatura do pedaço: a arte refeita (o
   * pacote trocou o desenho) ganha número novo, e só os pedaços com objeto
   * dela são repintados. WeakMap: a arte que sai do cache leva o número junto.
   */
  const idDaArte = new WeakMap<ArteNoPalco, number>()
  let proximoIdDaArte = 0
  /** Texturas da silhueta para a prévia (a camada de sombras usa a tela direto). */
  const sombrasDaPrevia = new Map<ArteNoPalco, Texture>()
  const objetos = new Map<string, Sprite>()
  const pedacos = new Map<string, PedacoNoPalco>()
  const previa = new Map<string, { corpo: Sprite; sombra: Sprite | null }>()
  let apagandoAgora: ReadonlySet<string> = new Set()
  let destruido = false
  let visivel = false
  let ultima: EntradaDosCarimbos | null = null
  let desenhada: { entrada: EntradaDosCarimbos; versao: number } | null = null
  /** Texturas que saíram do cache (pacote novo) e ainda podem estar em sprites: soltas no próximo desenho. */
  const aposentadas: Texture[] = []

  const pararDeOuvir = assinarCarimbos(() => {
    // Os do pacote saem do cache (o desenho pode ter mudado); os embutidos ficam.
    for (const [chave, guardada] of [...artes]) {
      const tipo = chave.slice(0, chave.lastIndexOf('#'))
      if (ehTipoImportado(tipo) || carimboDoCatalogo(tipo)?.origem === 'embutido') continue
      if (guardada !== null && guardada !== 'assando') aposentadas.push(guardada.corpo)
      artes.delete(chave)
    }
    versaoDasArtes += 1
    if (ultima !== null) atualizar(ultima)
  })

  function mudarVisibilidade(agora: boolean): void {
    if (agora === visivel) return
    visivel = agora
    opcoes.aoMudarVisibilidade?.(agora)
  }

  function arteDe(tipo: string, giro: number, importados: readonly CarimboImportado[] | undefined): ArteNoPalco | null {
    const importado = ehTipoImportado(tipo) ? importados?.find((c) => c.id === tipo) : undefined
    // Importado que não veio com o mapa (desfeito, de outra cena): não sai.
    if (ehTipoImportado(tipo) && importado === undefined) return null
    const variante = importado === undefined ? varianteDoGiro(giro) : 0
    const chave = `${tipo}#${variante}`
    const guardada = artes.get(chave)
    if (guardada !== undefined) return guardada === 'assando' ? null : guardada
    const feita = assar(tipo, variante, importado)
    if (!(feita instanceof Promise)) {
      artes.set(chave, feita)
      return feita
    }
    artes.set(chave, 'assando')
    void feita.then(
      (arte) => {
        if (destruido) {
          arte?.corpo.destroy(true)
          return
        }
        artes.set(chave, arte)
        versaoDasArtes += 1
        if (ultima !== null) atualizar(ultima)
      },
      () => {
        artes.set(chave, null)
      },
    )
    return null
  }

  /** O sprite no lugar do objeto: a base na âncora, o quadro na escala do tamanho. */
  function posicionar(sprite: Sprite, c: Carimbo, arte: ArteNoPalco): void {
    if (sprite.texture !== arte.corpo) sprite.texture = arte.corpo
    sprite.anchor.set(-arte.quadro.esquerda / arte.quadro.lado, -arte.quadro.topo / arte.quadro.lado)
    sprite.position.set(c.x, c.y)
    const lado = arte.quadro.lado * c.tamanho
    sprite.width = lado
    sprite.height = lado
    sprite.rotation = ehTipoImportado(c.tipo) ? Math.sin((c.giro * Math.PI) / 180) * INCLINACAO_DO_IMPORTADO : 0
  }

  function caixaDaSombra(c: Carimbo): { x: number; y: number; largura: number; altura: number } {
    const q = QUADRO_DA_SOMBRA
    return { x: c.x + q.esquerda * c.tamanho, y: c.y + q.topo * c.tamanho, largura: q.largura * c.tamanho, altura: q.altura * c.tamanho }
  }

  function identidadeDaArte(arte: ArteNoPalco): number {
    const conhecida = idDaArte.get(arte)
    if (conhecida !== undefined) return conhecida
    proximoIdDaArte += 1
    idDaArte.set(arte, proximoIdDaArte)
    return proximoIdDaArte
  }

  function soltarPedaco(chave: string): void {
    const pedaco = pedacos.get(chave)
    if (pedaco === undefined) return
    pedaco.sprite.texture.destroy(true)
    pedaco.sprite.destroy()
    pedacos.delete(chave)
  }

  function limparTudo(): void {
    for (const sprite of objetos.values()) sprite.destroy()
    objetos.clear()
    for (const chave of [...pedacos.keys()]) soltarPedaco(chave)
    limparPrevia()
    mudarVisibilidade(false)
  }

  /** Repinta só os pedaços cujas sombras mudaram. */
  function desenharSombras(lista: ReadonlyArray<{ c: Carimbo; arte: ArteNoPalco }>, mapa: EntradaDosCarimbos['mapa']): void {
    const lado = ladoDoPedacoNoMundo(mapa)
    const porPedaco = new Map<string, { ix: number; iy: number; itens: Array<{ c: Carimbo; arte: ArteNoPalco }> }>()
    for (const item of lista) {
      if (item.arte.sombra === null) continue
      const caixa = caixaDaSombra(item.c)
      for (let ix = Math.floor(caixa.x / lado); ix <= Math.floor((caixa.x + caixa.largura) / lado); ix++) {
        for (let iy = Math.floor(caixa.y / lado); iy <= Math.floor((caixa.y + caixa.altura) / lado); iy++) {
          const chave = `${ix},${iy}`
          const grupo = porPedaco.get(chave)
          if (grupo === undefined) porPedaco.set(chave, { ix, iy, itens: [item] })
          else grupo.itens.push(item)
        }
      }
    }
    for (const chave of [...pedacos.keys()]) if (!porPedaco.has(chave)) soltarPedaco(chave)
    for (const [chave, grupo] of porPedaco) {
      const assinatura = `${lado}|${grupo.itens.map(({ c, arte }) => `${c.id}:${c.tipo}:${c.x}:${c.y}:${c.tamanho}:${c.giro}:${identidadeDaArte(arte)}`).join(' ')}`
      const existente = pedacos.get(chave)
      if (existente?.assinatura === assinatura) continue
      const pedaco: PedacoDeSombra = {
        x: grupo.ix * lado,
        y: grupo.iy * lado,
        lado,
        texels: texelsDoPedaco,
        sombras: grupo.itens.flatMap(({ c, arte }) => (arte.sombra === null ? [] : [{ silhueta: arte.sombra, ...caixaDaSombra(c) }])),
        textura: existente?.sprite.texture,
      }
      const textura = pintarPedaco(pedaco)
      if (textura === null) continue
      if (existente !== undefined) {
        if (existente.sprite.texture !== textura) {
          existente.sprite.texture.destroy(true)
          existente.sprite.texture = textura
        }
        existente.assinatura = assinatura
      } else {
        const sprite = new Sprite(textura)
        sprite.label = `pedaco-${chave}`
        sombras.addChild(sprite)
        pedacos.set(chave, { sprite, assinatura })
      }
      const atual = pedacos.get(chave)
      if (atual === undefined) continue
      atual.sprite.position.set(pedaco.x, pedaco.y)
      atual.sprite.width = lado
      atual.sprite.height = lado
    }
  }

  function desenhar(entrada: EntradaDosCarimbos): void {
    const inicio = performance.now()
    const lista = entrada.carimbos ?? []
    const prontos: Array<{ c: Carimbo; arte: ArteNoPalco }> = []
    for (const c of lista) {
      const arte = arteDe(c.tipo, c.giro, entrada.importados)
      if (arte !== null) prontos.push({ c, arte })
    }
    const vivos = new Set(prontos.map(({ c }) => c.id))
    for (const [id, sprite] of [...objetos]) {
      if (vivos.has(id)) continue
      sprite.destroy()
      objetos.delete(id)
    }
    // De trás (norte) para a frente (sul): quem está mais embaixo cobre quem está atrás.
    const ordem = [...prontos].sort((a, b) => a.c.y - b.c.y || a.c.x - b.c.x)
    chao.removeChildren()
    corpos.removeChildren()
    for (const { c, arte } of ordem) {
      let sprite = objetos.get(c.id)
      if (sprite === undefined) {
        sprite = new Sprite(arte.corpo)
        objetos.set(c.id, sprite)
      }
      posicionar(sprite, c, arte)
      sprite.alpha = apagandoAgora.has(c.id) ? ALFA_DE_QUEM_SAI : 1
      ;(arte.chao ? chao : corpos).addChild(sprite)
    }
    if (entrada.sombras === false) for (const chave of [...pedacos.keys()]) soltarPedaco(chave)
    else desenharSombras(prontos, entrada.mapa)
    // Nenhum sprite usa mais as texturas que o pacote novo aposentou.
    for (const textura of aposentadas.splice(0)) textura.destroy(true)
    mudarVisibilidade(objetos.size > 0)
    opcoes.aoDesenhar?.({ ms: performance.now() - inicio, objetos: objetos.size, pedacos: pedacos.size })
  }

  function mesmaEntrada(a: EntradaDosCarimbos, b: EntradaDosCarimbos): boolean {
    if (a.cena !== b.cena || a.mapa.width !== b.mapa.width || a.mapa.height !== b.mapa.height || a.mapa.grid !== b.mapa.grid) return false
    if ((a.sombras ?? true) !== (b.sombras ?? true)) return false
    if (!mesmosCarimbos(a.carimbos, b.carimbos)) return false
    const ia = a.importados ?? []
    const ib = b.importados ?? []
    return ia.length === ib.length && ia.every((c, i) => c === ib[i] || (c.id === ib[i].id && c.imagem === ib[i].imagem))
  }

  function atualizar(entrada: EntradaDosCarimbos | null): void {
    if (destruido) return
    ultima = entrada
    if (entrada === null || entrada.carimbos === undefined || entrada.carimbos.length === 0) {
      desenhada = null
      limparTudo()
      return
    }
    if (desenhada !== null && desenhada.versao === versaoDasArtes && mesmaEntrada(desenhada.entrada, entrada)) {
      // O mesmo conteúdo em referências novas (o mapa do jogador): guarda as novas, e a próxima conferência sai barata.
      desenhada.entrada = entrada
      return
    }
    // Cena nova: os objetos da anterior saem NA HORA (não ficam por cima do mapa novo).
    if (desenhada !== null && desenhada.entrada.cena !== entrada.cena) limparTudo()
    desenhada = { entrada, versao: versaoDasArtes }
    desenhar(entrada)
  }

  function sombraDaPrevia(arte: ArteNoPalco): Texture | null {
    if (arte.sombra === null) return null
    const pronta = sombrasDaPrevia.get(arte)
    if (pronta !== undefined) return pronta
    if (!(arte.sombra instanceof HTMLCanvasElement)) return null
    const textura = texturaDaTela(arte.sombra)
    sombrasDaPrevia.set(arte, textura)
    return textura
  }

  function mostrarPrevia(novos: readonly Carimbo[], apagando: ReadonlySet<string>, importados: readonly CarimboImportado[] | undefined): void {
    if (destruido) return
    if (apagando !== apagandoAgora) {
      for (const [id, sprite] of objetos) sprite.alpha = apagando.has(id) ? ALFA_DE_QUEM_SAI : 1
      apagandoAgora = apagando
    }
    const vivos = new Set(novos.map((c) => c.id))
    for (const [id, item] of [...previa]) {
      if (vivos.has(id)) continue
      item.corpo.destroy()
      item.sombra?.destroy()
      previa.delete(id)
    }
    for (const c of novos) {
      if (previa.has(c.id)) continue
      const arte = arteDe(c.tipo, c.giro, importados)
      if (arte === null) continue
      const corpo = new Sprite(arte.corpo)
      posicionar(corpo, c, arte)
      const texturaDaSombra = sombraDaPrevia(arte)
      let sombra: Sprite | null = null
      if (texturaDaSombra !== null) {
        sombra = new Sprite(texturaDaSombra)
        const caixa = caixaDaSombra(c)
        sombra.position.set(caixa.x, caixa.y)
        sombra.width = caixa.largura
        sombra.height = caixa.altura
        sombra.alpha = ALFA_DA_SOMBRA
        rascunhoSombras.addChild(sombra)
      }
      // De trás para a frente também na prévia (o Pixi ordena pelo zIndex).
      corpo.zIndex = c.y
      previa.set(c.id, { corpo, sombra })
      rascunhoCorpos.addChild(corpo)
    }
  }

  function limparPrevia(): void {
    for (const item of previa.values()) {
      item.corpo.destroy()
      item.sombra?.destroy()
    }
    previa.clear()
    if (apagandoAgora.size > 0) {
      for (const sprite of objetos.values()) sprite.alpha = 1
      apagandoAgora = new Set()
    }
  }

  return {
    camada,
    atualizar,
    mostrarPrevia,
    limparPrevia,
    destruir: () => {
      destruido = true
      pararDeOuvir()
      limparTudo()
      for (const guardada of artes.values()) if (guardada !== null && guardada !== 'assando') guardada.corpo.destroy(true)
      artes.clear()
      for (const textura of sombrasDaPrevia.values()) textura.destroy(true)
      sombrasDaPrevia.clear()
      for (const textura of aposentadas.splice(0)) textura.destroy(true)
      camada.destroy({ children: true })
    },
  }
}
