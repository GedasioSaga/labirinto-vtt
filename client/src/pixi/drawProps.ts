import { Container, Sprite, Graphics, Assets, Texture } from 'pixi.js'
import { convertFileSrc } from '@tauri-apps/api/core'
import type { MapData, Prop } from '../types/map'
import { SECRET_ITEM_ALPHA, SELECTION_COLOR } from './constants'
import { isHidden, rotationToRadians } from '../lib/itemTransform'
import { useToastStore } from '../stores/toastStore'
import { drawPropSilhouettes } from './drawPropSilhouettes'
import { fitPropSprite } from './drawPropLooks'
import { urlDaMidiaNoMestre } from '../lib/midiaNoDisco'
import { contornoDaCercaCurva } from '../lib/cercaCurva'
import { ehMovelDeCimaDaMesa, ehMovelDoChao, temChama } from '../lib/mobilia'
import { emOrdemDoTresQuartos, tresQuartosAtivo } from '../lib/mobilia/vistaTresQuartos'
import { createChamasDasFogueiras, type OpcoesDasChamas } from './chamasDasFogueiras'

/**
 * Onda 2, item 12 (notificação) — reduz um caminho de arquivo ao nome
 * exibível no toast ("C:\...\barril.png" → "barril.png"). Mesma função de
 * `pixi/tokensRenderer.ts` — não extraída pra lib compartilhada: só 2 usos
 * no projeto inteiro, abaixo do "regra do três" da convenção do projeto.
 */
/** Objeto "Oculto no editor": fantasma bem transparente, mas ainda clicável (igual ao token). */
export const HIDDEN_PROP_GHOST_ALPHA = 0.3
const GHOST_DASH_LENGTH = 8
const GHOST_OUTLINE_WIDTH = 2
const GHOST_OUTLINE_COLOR = 0xffffff

/** Contorno tracejado de retângulo: traço e vão de `GHOST_DASH_LENGTH` em cada lado. */
function strokeDashedRect(graphics: Graphics, x: number, y: number, width: number, height: number): void {
  const corners = [
    [x, y],
    [x + width, y],
    [x + width, y + height],
    [x, y + height],
  ]
  for (let i = 0; i < corners.length; i++) {
    const [ax, ay] = corners[i]
    const [bx, by] = corners[(i + 1) % corners.length]
    const sideLength = Math.hypot(bx - ax, by - ay)
    if (sideLength === 0) continue
    const ux = (bx - ax) / sideLength
    const uy = (by - ay) / sideLength
    for (let t = 0; t < sideLength; t += GHOST_DASH_LENGTH * 2) {
      const end = Math.min(t + GHOST_DASH_LENGTH, sideLength)
      graphics.moveTo(ax + ux * t, ay + uy * t).lineTo(ax + ux * end, ay + uy * end)
    }
  }
  graphics.stroke({ width: GHOST_OUTLINE_WIDTH, color: GHOST_OUTLINE_COLOR })
}

/**
 * Contorno tracejado de polígono fechado (a cerca curva): o compasso de
 * `GHOST_DASH_LENGTH` corre pelo perímetro inteiro, sem recomeçar em cada
 * vértice — a curva tem dezenas de lados curtos, e recomeçar a cada um viraria
 * linha cheia.
 */
function strokeDashedPolygon(graphics: Graphics, points: readonly { x: number; y: number }[]): void {
  let andado = 0
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    const lado = Math.hypot(b.x - a.x, b.y - a.y)
    if (lado === 0) continue
    const ux = (b.x - a.x) / lado
    const uy = (b.y - a.y) / lado
    const fase = andado % (2 * GHOST_DASH_LENGTH)
    // Traço que vinha do lado anterior e ainda não acabou (com fase 0, é o traço que começa em `a`).
    const resto = GHOST_DASH_LENGTH - fase
    // O próximo começo de traço, medido a partir de `a`.
    let t = 2 * GHOST_DASH_LENGTH - fase
    if (resto > 0) graphics.moveTo(a.x, a.y).lineTo(a.x + ux * Math.min(resto, lado), a.y + uy * Math.min(resto, lado))
    for (; t < lado; t += 2 * GHOST_DASH_LENGTH) {
      const fim = Math.min(t + GHOST_DASH_LENGTH, lado)
      graphics.moveTo(a.x + ux * t, a.y + uy * t).lineTo(a.x + ux * fim, a.y + uy * fim)
    }
    andado += lado
  }
  graphics.stroke({ width: GHOST_OUTLINE_WIDTH, color: GHOST_OUTLINE_COLOR })
}

/** Rótulo do `Graphics` de cada móvel da mobília desenhada (achado pelos testes e pelo inspetor do Pixi). */
export const FURNITURE_LABEL = 'mobilia'
/** Rótulo do `Container` do CHÃO: os tapetes, sempre no índice 0 dos objetos, por baixo de sprite e móvel. */
export const FLOOR_LABEL = 'chao-dos-objetos'
/** Rótulo do `Container` da MESA POSTA: os Pratos, por cima de sprite e móvel, logo abaixo do destaque. */
export const MESA_POSTA_LABEL = 'mesa-posta'

/** Transparência do objeto no editor: fantasma do "Oculto no editor", meio apagado se "Oculto para jogadores". */
function propAlpha(prop: Prop): number {
  return isHidden(prop) ? HIDDEN_PROP_GHOST_ALPHA : prop.secret ? SECRET_ITEM_ALPHA : 1
}

function fileBaseName(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  const idx = normalized.lastIndexOf('/')
  return idx === -1 ? normalized : normalized.slice(idx + 1)
}

/**
 * Zoom e densidade de pixel do quadro: o fio do móvel desenhado é em px de
 * TELA (como a parede), então a largura em mundo depende dos dois. Obrigatório
 * de propósito: sem ele o fio caía no padrão de 1 px de MUNDO e engrossava e
 * afinava com o zoom.
 */
export interface PropsView {
  cameraScale: number
  rendererResolution: number
  /** VISTA DOS MÓVEIS da cena (`MapData.vistaDosMoveis`, Meio-Termo): segue para `drawPropSilhouettes`, como no jogador. */
  vistaDosMoveis?: MapData['vistaDosMoveis']
}

export interface PropsRenderer {
  draw: (container: Container, props: Prop[], selectedPropId: string | null, view: PropsView) => void
  /** Desmonte: as chamas das fogueiras saem do relógio e soltam as formas delas (antes do `app.destroy`). */
  destruir: () => void
}

/**
 * Um móvel desenhado e o que a última pintura dele leu. Mesma pintura =
 * nada a limpar: arrastar UM móvel chamava `draw` com todos a cada passo e
 * limpava cada um (1200 móveis: ~40 mil `GraphicsContext.clear` num arrasto
 * de 30 passos, medido no dev em 01/10/2026). O móvel entra pela REFERÊNCIA
 * (`setPropPosition` conserva a dos outros), o que cobre todo campo que a
 * silhueta lê; zoom e densidade entram porque o fio é em px de TELA.
 */
interface FurnitureEntry {
  drawing: Graphics
  painted: { prop: Prop; cameraScale: number; rendererResolution: number; vistaDosMoveis: MapData['vistaDosMoveis'] } | null
  /** A chama da fogueira (o nó logo acima do desenho), para a ordem da 3/4 levá-la junto. */
  chama: Container | null
}

/**
 * Cria um renderer de props com cache de sprite fechado por closure — mesma
 * lifecycle de backgroundSprite/backgroundLoadToken em PixiCanvas.tsx: deve
 * ser instanciado uma vez dentro do setup() de cada mount do PixiCanvas, nunca
 * em escopo de módulo. Um cache em escopo de módulo sobreviveria ao
 * destroy()/remount do StrictMode e faria drawProps encontrar sprites já
 * destruídos, pulando o addChild e sumindo com os objetos silenciosamente.
 *
 * FOGUEIRA: a chama (`chamasDasFogueiras.ts`) é um nó logo acima do desenho do
 * móvel, posto na mesma repintura; segue o móvel em posição, fantasma, camada
 * oculta e remoção, mas não gira com ele. Sem `chamas.movimento` (testes,
 * exportar imagem) a chama fica parada.
 *
 * TAPETE: o desenho dele mora no `Container` do chão (`FLOOR_LABEL`), no
 * índice 0 dos objetos — todo sprite e todo móvel novo entra com
 * `addChildAt(…, 0)`, então o chão volta ao fundo no fim de cada `draw`. Dentro
 * do chão os tapetes seguem a ordem da lista, como na tela do jogador.
 */
export function createPropsRenderer(opcoesDasChamas: OpcoesDasChamas = {}): PropsRenderer {
  const chamas = createChamasDasFogueiras(opcoesDasChamas)
  const spriteCache = new Map<string, Sprite>()
  // Móveis da mobília desenhada, por id — mesma vida do `spriteCache`.
  const furnitureCache = new Map<string, FurnitureEntry>()
  const highlightGraphics = new Graphics()
  let highlightAttached = false
  const floor = new Container()
  floor.label = FLOOR_LABEL
  // A MESA POSTA (os Pratos): o avesso do chão, por cima de todo objeto e logo abaixo do destaque.
  const mesaPosta = new Container()
  mesaPosta.label = MESA_POSTA_LABEL
  // Onda 2, item 12 — caminho de imagem já avisado, pra não empilhar o
  // mesmo toast de erro a cada `draw()` (chamado a cada mudança relevante do
  // mapa, não só uma vez). Fechado por closure igual `spriteCache`: nasce
  // vazio a cada mount. Guarda por CAMINHO, não por prop — dois props com a
  // mesma imagem quebrada avisam uma vez só, não duas.
  const warnedSrcPaths = new Set<string>()
  // O objeto como está AGORA, por id: a textura que chega depois do carregamento
  // encaixa no tamanho de agora (o mestre pode ter redimensionado no meio).
  const propsById = new Map<string, Prop>()

  function draw(container: Container, props: Prop[], selectedPropId: string | null, view: PropsView): void {
    if (!highlightAttached) {
      container.addChild(highlightGraphics)
      highlightAttached = true
    }

    // Móvel da mobília desenhada não tem imagem: fica fora do cache de sprite
    // (e o sprite de um objeto que virou móvel sai), e vice-versa.
    const imageIds = new Set(props.filter((p) => p.mobilia === undefined).map((p) => p.id))
    const furnitureIds = new Set(props.filter((p) => p.mobilia !== undefined).map((p) => p.id))

    for (const [id, sprite] of spriteCache) {
      if (!imageIds.has(id)) {
        container.removeChild(sprite)
        sprite.destroy()
        spriteCache.delete(id)
        propsById.delete(id)
      }
    }
    for (const [id, { drawing }] of furnitureCache) {
      if (!furnitureIds.has(id)) {
        // Do chão (tapete) ou dos objetos: sai de onde estiver.
        drawing.removeFromParent()
        drawing.destroy()
        furnitureCache.delete(id)
      }
    }

    highlightGraphics.clear()

    const fogueiras = new Set<string>()
    for (const prop of props) {
      propsById.set(prop.id, prop)
      if (prop.mobilia !== undefined) {
        drawFurniture(container, prop, view)
        if (temChama(prop.mobilia)) fogueiras.add(prop.id)
        markPropState(prop, selectedPropId)
        continue
      }
      let sprite = spriteCache.get(prop.id)
      if (!sprite) {
        sprite = new Sprite(Texture.EMPTY)
        sprite.anchor.set(0.5)
        spriteCache.set(prop.id, sprite)
        container.addChildAt(sprite, 0)

        // Capturado num `const` separado: dentro do `.then()`/`.catch()`
        // abaixo (fronteira de função nova), o TS não carrega a narrowing
        // que o `if (!sprite)` fez do `let sprite`.
        const criado = sprite
        // ITEM NO CHÃO: a imagem é a mídia do item (`midia:<id>`), lida do
        // disco pela ponte do Tauri — `src` fica vazio. O objeto comum segue
        // pelo caminho de disco dele, como sempre.
        const imagemDoItem = prop.item?.imagem
        const srcPath = imagemDoItem ?? prop.src
        const aviso = imagemDoItem === undefined ? `Imagem do objeto não carregou: ${fileBaseName(srcPath)}` : `Imagem do item não carregou: ${prop.item?.nome ?? ''}`
        const url = imagemDoItem === undefined ? Promise.resolve(convertFileSrc(srcPath)) : urlDaMidiaNoMestre(imagemDoItem)
        url
          .then((endereco) => (endereco === null ? Promise.reject(new Error('sem mídia')) : Assets.load<Texture>(endereco)))
          .then((texture) => {
            // Nó da camada descartado no meio do carregamento (`destruir` + destroy do nó):
            // mexer no sprite destruído lançava TypeError e caía no aviso falso abaixo.
            if (criado.destroyed || spriteCache.get(prop.id) !== criado) return
            criado.texture = texture
            fitPropSprite(criado, propsById.get(prop.id) ?? prop)
          })
          .catch(() => {
            // textura não carregou — sprite fica com Texture.EMPTY
            // (invisível), sem quebrar o resto do mapa. Onda 2, item 12:
            // antes isso era silencioso; agora avisa, uma vez por caminho
            // (warnedSrcPaths), não uma vez por prop nem por frame.
            if (!warnedSrcPaths.has(srcPath)) {
              warnedSrcPaths.add(srcPath)
              useToastStore.getState().push('error', aviso)
            }
          })
      }
      sprite.x = prop.x
      sprite.y = prop.y
      fitPropSprite(sprite, prop)
      // Anchor já é 0.5 (linha 45), então a rotação gira em torno do centro
      // do prop, não do canto. `undefined` → 0 radiano: aparência idêntica à
      // de hoje (types/map.ts documenta Prop.rotation undefined === 0).
      sprite.rotation = rotationToRadians(prop.rotation)
      // hidden === "Oculto no editor" (organização de cena do mestre). Antes
      // o objeto sumia e não havia como clicar nele para desfazer; agora fica
      // como fantasma (alpha baixo + contorno tracejado), clicável — mesma
      // regra dos tokens (tokensRenderer.ts).
      sprite.visible = true
      sprite.alpha = propAlpha(prop)
      markPropState(prop, selectedPropId)
    }
    // Fogueira, lareira ou fornalha que sumiu (outro tipo, camada oculta) leva a chama; apagada, `colocar` já a tirou.
    chamas.podar(fogueiras)
    if (tresQuartosAtivo(view.vistaDosMoveis)) ordenarPelaBase(container, props)
    // O chão volta ao fundo: o que entrou agora com `addChildAt(…, 0)` passou por
    // baixo dele. Mapa sem tapete nunca ganha o chão (a lista de filhos fica a de sempre).
    if (floor.children.length > 0) {
      if (floor.parent !== container) container.addChildAt(floor, 0)
      else if (container.getChildIndex(floor) !== 0) container.setChildIndex(floor, 0)
    }
    // A mesa posta volta ao topo, logo abaixo do destaque. Mapa sem pratos nunca a ganha.
    if (mesaPosta.children.length > 0) {
      if (mesaPosta.parent !== container) container.addChildAt(mesaPosta, container.getChildIndex(highlightGraphics))
      else if (container.getChildIndex(mesaPosta) !== container.getChildIndex(highlightGraphics) - 1) container.setChildIndex(mesaPosta, container.getChildIndex(highlightGraphics) - 1)
    }
  }

  /**
   * MOBÍLIA DESENHADA no editor: a mesma silhueta chapada com o glifo que o
   * jogador vê (`drawPropSilhouettes`), um `Graphics` por móvel para o
   * fantasma e o "Oculto para jogadores" valerem por móvel, como no sprite.
   * Nada de imagem: nem pedido de arquivo, nem aviso de imagem quebrada.
   * Só repinta quando a pintura mudou (`FurnitureEntry`).
   */
  function drawFurniture(container: Container, prop: Prop, view: PropsView): void {
    let entry = furnitureCache.get(prop.id)
    if (!entry) {
      const drawing = new Graphics()
      drawing.label = FURNITURE_LABEL
      entry = { drawing, painted: null, chama: null }
      furnitureCache.set(prop.id, entry)
    }
    // O tapete (e o tapete longo, MT5) mora no chão; o resto, nos objetos (o "Tipo" do painel pode trocar um pelo outro).
    if (ehMovelDoChao(prop.mobilia)) {
      if (entry.drawing.parent !== floor) floor.addChild(entry.drawing)
    } else if (ehMovelDeCimaDaMesa(prop.mobilia)) {
      if (entry.drawing.parent !== mesaPosta) mesaPosta.addChild(entry.drawing)
    } else if (entry.drawing.parent !== container) {
      container.addChildAt(entry.drawing, 0)
    }
    const { painted } = entry
    const { cameraScale, rendererResolution, vistaDosMoveis } = view
    // Mesma pintura: o desenho de antes continua valendo, nada a limpar.
    if (
      painted !== null &&
      painted.prop === prop &&
      painted.cameraScale === cameraScale &&
      painted.rendererResolution === rendererResolution &&
      painted.vistaDosMoveis === vistaDosMoveis
    ) {
      return
    }
    drawPropSilhouettes(entry.drawing, [prop], cameraScale, rendererResolution, vistaDosMoveis)
    entry.drawing.alpha = propAlpha(prop)
    entry.painted = { prop, cameraScale, rendererResolution, vistaDosMoveis }
    // A chama da fogueira, logo acima do desenho dela (o mesmo fantasma); outro tipo não tem chama.
    const chama = chamas.colocar(prop, view)
    entry.chama = chama
    if (chama === null) return
    if (chama.parent !== container) container.addChildAt(chama, container.getChildIndex(entry.drawing) + 1)
    chama.alpha = propAlpha(prop)
  }

  /**
   * VISTA 3/4 (MT11): os móveis dos objetos (o chão fica como está) trocam de
   * lugar entre si pela BASE, o mais ao sul por cima, cada chama logo acima da
   * sua fogueira. As imagens de objeto e o destaque não saem do lugar: os
   * móveis só ocupam, na nova ordem, os mesmos índices que já tinham.
   */
  function ordenarPelaBase(container: Container, props: readonly Prop[]): void {
    const nos: Container[] = []
    for (const prop of emOrdemDoTresQuartos(props.filter((p) => p.mobilia !== undefined && !ehMovelDoChao(p.mobilia)))) {
      const entry = furnitureCache.get(prop.id)
      if (entry === undefined || entry.drawing.parent !== container) continue
      nos.push(entry.drawing)
      if (entry.chama !== null && !entry.chama.destroyed && entry.chama.parent === container) nos.push(entry.chama)
    }
    if (nos.length < 2) return
    const doConjunto = new Set<Container>(nos)
    const filhos = container.children
    const alvo: Container[] = []
    let proximo = 0
    for (const filho of filhos) alvo.push(doConjunto.has(filho) ? nos[proximo++] : filho)
    if (alvo.every((no, i) => filhos[i] === no)) return
    alvo.forEach((no, i) => container.setChildIndex(no, i))
  }

  /** Fantasma do "Oculto no editor" e destaque de seleção, iguais para imagem e móvel. */
  function markPropState(prop: Prop, selectedPropId: string | null): void {
    // CERCA CURVA: fantasma e destaque contornam a faixa dobrada no arco, não a caixa reta (`lib/cercaCurva.ts`).
    const curva = contornoDaCercaCurva(prop)
    if (curva !== null) {
      if (isHidden(prop)) strokeDashedPolygon(highlightGraphics, curva)
      if (prop.id === selectedPropId) highlightGraphics.poly(curva.flatMap((p) => [p.x, p.y]), true).stroke({ width: 3, color: SELECTION_COLOR })
      return
    }
    const left = prop.x - prop.width / 2
    const top = prop.y - prop.height / 2
    if (isHidden(prop)) strokeDashedRect(highlightGraphics, left, top, prop.width, prop.height)
    if (prop.id === selectedPropId) {
      highlightGraphics.rect(left, top, prop.width, prop.height).stroke({ width: 3, color: SELECTION_COLOR })
    }
  }

  /** Desmonte (ou nó da camada descartado): as chamas saem do relógio e nenhum carregamento pendente encontra mais o sprite. */
  function destruir(): void {
    chamas.destruir()
    spriteCache.clear()
    furnitureCache.clear()
    propsById.clear()
  }

  return { draw, destruir }
}
