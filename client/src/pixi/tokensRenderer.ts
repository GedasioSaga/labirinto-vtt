import { Container, Sprite, Graphics, Text, Assets, Texture } from 'pixi.js'
import { convertFileSrc } from '@tauri-apps/api/core'
import type { Token, TokenHealth } from '../types/map'
import { SECRET_ITEM_ALPHA, SELECTION_COLOR, TOKEN_FRAME_COLOR, TOKEN_FRAME_WIDTH } from './constants'
import { drawTokenCircle } from './drawTokens'
import { drawTokenHealthBar, HEALTH_BAR_LABEL, tokenLabelTop } from './drawTokenHealth'
import { readTokenHealth } from '../lib/tokenHealth'
import { parseHexColor, tokenFillColor } from '../lib/tokenColor'
import { isHidden, rotationToRadians } from '../lib/itemTransform'
import { isTokenPhotoData, tokenPhotoLabel, tokenPhotoRef } from '../lib/tokenPhoto'
import { fitPhotoSprite, textureFromDataUrl } from './tokenPhotoSprite'
import { useToastStore } from '../stores/toastStore'
import { screenLabelSizing } from './screenLabel'
import { tokenConditionsOf } from '../lib/tokenConditions'
import { CONDITION_MARKS_LABEL, drawTokenConditions } from './drawTokenConditions'

/** Token "Oculto no editor": fantasma bem transparente, mas ainda clicável. */
const HIDDEN_TOKEN_GHOST_ALPHA = 0.3
const GHOST_DASH_COUNT = 16
const GHOST_OUTLINE_WIDTH = 2
const GHOST_OUTLINE_COLOR = 0xffffff

/** Contorno tracejado: metade de cada fatia do círculo é traço, metade é vão. */
function strokeDashedCircle(graphics: Graphics, radius: number): void {
  const slice = (Math.PI * 2) / GHOST_DASH_COUNT
  for (let i = 0; i < GHOST_DASH_COUNT; i++) {
    const start = i * slice
    graphics.moveTo(Math.cos(start) * radius, Math.sin(start) * radius)
    graphics.arc(0, 0, radius, start, start + slice / 2)
  }
  graphics.stroke({ width: GHOST_OUTLINE_WIDTH, color: GHOST_OUTLINE_COLOR })
}

/** Fonte do nome do token em px de mundo; na tela nunca abaixo de 11 px (screenLabel.ts). */
export const TOKEN_LABEL_FONT_SIZE = 12

export interface TokensRenderer {
  /** `cameraScale` omitido mantém o último zoom informado. */
  draw: (container: Container, tokens: Token[], gridSize: number, selectedTokenId?: string | null, cameraScale?: number) => void
  /** Só o zoom mudou: reescala e mostra/esconde os nomes sem redesenhar os tokens. */
  setCameraScale: (cameraScale: number) => void
}

interface TokenEntry {
  /** Único filho que este renderer adiciona a `container` por token — carrega
   *  o visual (sprite OU graphics, nunca os dois), o anel de seleção, o
   *  rótulo de nome e as marcas de condição como filhos internos, e é
   *  posicionado em (token.x, token.y)
   *  inteiro. Mantém `container.children.length === tokens.length` sempre,
   *  mesmo quando o token troca de "círculo" pra "imagem" e vice-versa. */
  wrapper: Container
  sprite: Sprite | null
  /** Máscara circular do `sprite`: é ela que faz a foto sair RECORTADA no
   *  círculo em vez de ocupar o quadrado inteiro, cantos inclusive. Vive junto
   *  do sprite (nasce e morre com ele). */
  photoMask: Graphics | null
  graphics: Graphics | null
  ring: Graphics
  /** Barra de vida sob o disco (`pixi/drawTokenHealth.ts`). Nasce só na
   *  ficha que TEM vida e morre quando a vida sai: ficha sem vida continua
   *  com os mesmos 4 filhos (visual, anel, nome, marcas) de antes da barra existir. */
  bar: Graphics | null
  label: Text
  /** Marcas de condição (envenenado, caído...) em cima da ficha. Existe
   *  sempre, vazia quando não há condição — é o último slot desenhado, por
   *  cima do disco, do anel e do nome. Filha do wrapper e não do visual: o
   *  disco gira com `Token.rotation`, a marca fica em pé. */
  marks: Graphics
  /** `Token.image` já carregado no `sprite` atual, ou null enquanto nenhuma
   *  imagem foi carregada ainda (token sem imagem, ou sprite recém-criado). */
  loadedSrc: string | null
  /** `Token.imageData` que acompanhava a foto carregada. É a TESTEMUNHA DO
   *  CONTEÚDO: `loadedSrc` sozinho não serve porque trocar a foto grava por
   *  cima do MESMO arquivo (`token_<id>_original.<ext>`, lib/imageImport.ts) e
   *  o caminho fica idêntico dos dois lados da troca. A cópia embutida é
   *  derivada dos BYTES da foto escolhida (lib/tokenPhoto.ts), então muda
   *  junto com o conteúdo. */
  loadedData: string | null
  /** Última URL de ARQUIVO que este token entregou ao `Assets.load` (o caminho
   *  já passado por `convertFileSrc`); null enquanto ele nunca carregou foto de
   *  arquivo, ou depois de perder a imagem. Foto embutida não passa pelo
   *  `Assets` e não mexe aqui. É por este campo que se sabe QUANDO o cache do
   *  Pixi precisa ser descarregado — ver `textureDoArquivo`. */
  loadedUrl: string | null
  /** Incrementado a cada novo Assets.load disparado para este token. O
   *  callback assíncrono só aplica a textura se o contador não mudou nesse
   *  meio-tempo — protege contra: (a) o token trocar de imagem de novo antes
   *  do primeiro load terminar (a textura antiga vence por engano) e (b) o
   *  próprio token ser removido do mapa antes do load terminar. */
  loadToken: number
}

/**
 * Cria um renderer de tokens com cache por id, fechado por closure — MESMA
 * lifecycle de createPropsRenderer (pixi/drawProps.ts:10-16): instanciar uma
 * vez dentro do setup() de cada mount do PixiCanvas, NUNCA em escopo de
 * módulo. Um cache em escopo de módulo sobreviveria ao destroy()/remount do
 * StrictMode: o draw() seguinte encontraria entradas cujo `wrapper`/`sprite`
 * já foram destruídos pelo unmount anterior (app.destroy(true, {children:
 * true}) desce recursivamente), tentaria reaproveitá-los em vez de recriar, e
 * o token sumiria da tela sem erro — exatamente o "sprite fantasma" que o
 * comentário de drawProps.ts já documenta para Prop. Instanciado dentro do
 * setup(), o cache nasce vazio a cada mount e o bug não tem como ocorrer.
 *
 * `Token.image === null` desenha o círculo genérico de sempre (drawTokenCircle,
 * idêntico ao antigo drawTokens.ts:10-18). `Token.image !== null` carrega a
 * imagem pelo mesmo pipeline de Prop (convertFileSrc + Assets.load, textura
 * ausente = Texture.EMPTY até o load resolver; load que falha deixa o sprite
 * invisível sem quebrar o resto do mapa, mesmo padrão de createPropsRenderer).
 */
export function createTokensRenderer(): TokensRenderer {
  const cache = new Map<string, TokenEntry>()
  // Onda 2, item 12 — caminho de imagem já avisado, pra não empilhar o
  // mesmo toast de erro a cada `draw()` (chamado a cada mudança relevante do
  // mapa, não só uma vez). Fechado por closure igual `cache`: nasce vazio a
  // cada mount, sem risco do "sprite fantasma" documentado acima. Guarda por
  // CAMINHO, não por token — dois tokens com a mesma imagem quebrada avisam
  // uma vez só, não duas.
  const warnedImagePaths = new Set<string>()
  let lastCameraScale = 1

  function applyLabelSizing(label: Text): void {
    const sizing = screenLabelSizing(TOKEN_LABEL_FONT_SIZE, lastCameraScale)
    label.scale.set(sizing.scale)
    label.visible = sizing.visible
  }

  function setCameraScale(cameraScale: number): void {
    lastCameraScale = cameraScale
    for (const entry of cache.values()) applyLabelSizing(entry.label)
  }

  function ensureSprite(entry: TokenEntry): Sprite {
    if (entry.graphics) {
      entry.wrapper.removeChild(entry.graphics)
      entry.graphics.destroy()
      entry.graphics = null
    }
    if (!entry.sprite) {
      const sprite = new Sprite(Texture.EMPTY)
      sprite.anchor.set(0.5)
      // A máscara precisa estar na árvore de exibição para o Pixi renderizá-la
      // como máscara; ela não aparece por si, só recorta o sprite.
      const photoMask = new Graphics()
      sprite.mask = photoMask
      entry.sprite = sprite
      entry.photoMask = photoMask
      entry.wrapper.addChildAt(sprite, 0)
      // A máscara entra no FIM, e não no começo: o índice 0 do wrapper é o
      // visual do token (Sprite ou Graphics do círculo) e o 1 é o anel, tanto
      // aqui quanto em ensureGraphics. Máscara não é desenhada, então a
      // posição dela na lista não muda nada na tela — e mudar os índices
      // mudaria o significado de "o visual é o filho 0".
      entry.wrapper.addChild(photoMask)
    }
    return entry.sprite
  }

  /**
   * Barra de vida da ficha: cria na primeira vida, redesenha a MESMA quando a
   * vida muda e destrói quando a vida sai. Entra logo antes do nome, para o
   * nome continuar por cima de tudo que é da ficha. Destruir Graphics é seguro
   * aqui — o cuidado de nunca destruir no meio da sessão é do `Text`.
   */
  function syncHealthBar(entry: TokenEntry, health: TokenHealth | null, radius: number): void {
    if (health === null) {
      if (entry.bar) {
        entry.wrapper.removeChild(entry.bar)
        entry.bar.destroy()
        entry.bar = null
      }
      return
    }
    if (!entry.bar) {
      const bar = new Graphics()
      bar.label = HEALTH_BAR_LABEL
      entry.wrapper.addChildAt(bar, entry.wrapper.getChildIndex(entry.label))
      entry.bar = bar
    }
    drawTokenHealthBar(entry.bar, radius, health)
  }

  function ensureGraphics(entry: TokenEntry): Graphics {
    if (entry.sprite) {
      entry.wrapper.removeChild(entry.sprite)
      entry.sprite.destroy()
      entry.sprite = null
      if (entry.photoMask) {
        entry.wrapper.removeChild(entry.photoMask)
        entry.photoMask.destroy()
        entry.photoMask = null
      }
      // Imagem removida do token (voltou a ser círculo): esquece a imagem
      // carregada, senão reatribuir a MESMA imagem depois não dispara reload
      // (o guard de loadedSrc abaixo compara contra este campo).
      entry.loadedSrc = null
      entry.loadedData = null
      entry.loadedUrl = null
    }
    if (!entry.graphics) {
      const graphics = new Graphics()
      entry.graphics = graphics
      entry.wrapper.addChildAt(graphics, 0)
    }
    return entry.graphics
  }

  /**
   * Textura de um arquivo do disco do mestre, ignorando a cópia que o Pixi
   * guardou para aquela URL quando o ARQUIVO mudou embaixo dela.
   *
   * `Assets.load` é um cache por URL, e a URL de uma foto de token não muda
   * quando a pessoa troca a foto: `lib/imageImport.ts` grava sempre por cima
   * de `token_<id>_original.<ext>`. Sem descarregar, o `load` devolveria a
   * textura velha sem chegar a tocar no disco — a pessoa escolhe uma cara nova
   * e continua vendo a antiga.
   *
   * Descarrega SÓ quando esta mesma URL já tinha sido carregada por ESTE token:
   * quem chama já só entra aqui quando o conteúdo mudou (nunca por quadro), e
   * descarregar uma URL que este token nunca carregou destruiria a textura de
   * outro dono (o fundo do mapa, uma peça) sem motivo. `Assets.unload` de uma
   * URL fora do cache é operação nula, então o caminho comum não paga nada.
   *
   * O sprite volta para `Texture.EMPTY` ANTES do `unload`: `unload` destrói a
   * textura, e deixar o sprite apontando para textura destruída é erro de
   * render até a foto nova chegar.
   */
  async function textureDoArquivo(entry: TokenEntry, url: string): Promise<Texture> {
    if (entry.loadedUrl === url) {
      if (entry.sprite) entry.sprite.texture = Texture.EMPTY
      entry.loadedUrl = null
      await Assets.unload(url)
    }
    entry.loadedUrl = url
    return Assets.load<Texture>(url)
  }

  function draw(container: Container, tokens: Token[], gridSize: number, selectedTokenId: string | null = null, cameraScale?: number): void {
    if (cameraScale !== undefined) lastCameraScale = cameraScale
    const currentIds = new Set(tokens.map((t) => t.id))

    for (const [id, entry] of cache) {
      if (!currentIds.has(id)) {
        container.removeChild(entry.wrapper)
        entry.wrapper.destroy({ children: true })
        cache.delete(id)
      }
    }

    for (const token of tokens) {
      let entry = cache.get(token.id)
      if (!entry) {
        const wrapper = new Container()
        const ring = new Graphics()
        const label = new Text({ text: '', style: { fontSize: TOKEN_LABEL_FONT_SIZE, fill: 0xffffff } })
        label.anchor.set(0.5, 0)
        const marks = new Graphics()
        marks.label = CONDITION_MARKS_LABEL
        wrapper.addChild(ring, label, marks)
        entry = { wrapper, sprite: null, photoMask: null, graphics: null, ring, bar: null, label, marks, loadedSrc: null, loadedData: null, loadedUrl: null, loadToken: 0 }
        cache.set(token.id, entry)
        container.addChild(wrapper)
      }

      const selected = token.id === selectedTokenId
      const ghost = isHidden(token)
      entry.wrapper.alpha = ghost ? HIDDEN_TOKEN_GHOST_ALPHA : token.secret ? SECRET_ITEM_ALPHA : 1
      entry.ring.clear()
      let outlineRadius: number

      // `tokenPhotoRef` devolve `null` (e não `undefined`) para token
      // construído fora do type-checker — mapa legado antes da migração, ou o
      // `addToken` cru que vários specs e2e fazem via `page.evaluate`. Sem
      // isso, `undefined !== null` entrava no ramo "tem imagem" e quebrava em
      // `convertFileSrc(undefined)` onde a ponte do Tauri não existe.
      const photoRef = tokenPhotoRef(token)
      if (photoRef !== null) {
        const sprite = ensureSprite(entry)
        const radius = (gridSize * token.size) / 2
        // A foto é recortada DENTRO da moldura: raio do token menos a
        // espessura do anel, senão o latão cobriria a borda da foto.
        const photoRadius = Math.max(1, radius - TOKEN_FRAME_WIDTH)
        entry.photoMask?.clear().circle(0, 0, photoRadius).fill({ color: 0xffffff })
        fitPhotoSprite(sprite, photoRadius)
        // Anchor já é 0.5 (ensureSprite), então gira em torno do centro do
        // token. `undefined` → 0 radiano: aparência idêntica à de hoje
        // (types/map.ts documenta Token.rotation undefined === 0).
        sprite.rotation = rotationToRadians(token.rotation)

        // CONTEÚDO, não só nome de arquivo. Trocar a foto de um token grava a
        // foto nova por cima do MESMO caminho, então `photoRef` é idêntico dos
        // dois lados da troca e sozinho ele deixaria a cara velha na tela. A
        // cópia embutida (`imageData`) é gerada a partir dos bytes da foto
        // escolhida, então é ela quem denuncia a troca.
        //
        // Os dois lados da comparação são as MESMAS instâncias de string que o
        // store guarda enquanto a foto não muda — comparar não aloca nada e não
        // percorre a base64: quadro que não trocou de foto sai por aqui na
        // primeira comparação, sem `Assets.load` nenhum.
        //
        // Limite conhecido: quando a cópia embutida não pôde ser gerada
        // (`null`, o melhor esforço de App.tsx, que já avisa a pessoa), não
        // sobra testemunha do conteúdo e o comportamento volta a ser o antigo.
        const photoData = token.imageData ?? null
        if (entry.loadedSrc !== photoRef || entry.loadedData !== photoData) {
          entry.loadToken += 1
          const localLoadToken = entry.loadToken
          const currentEntry = entry
          // Capturado num `const` separado: dentro do `.catch()` abaixo
          // (fronteira de função nova), o TS não carrega a narrowing feita
          // pelo `if` acima — precisa de uma variável própria para não perder
          // o tipo sem recorrer a `as`/`!`.
          const imagePath = photoRef
          const tokenName = token.name
          // Chave do aviso. Foto embutida NÃO pode entrar aqui pelo valor: são
          // dezenas de milhares de caracteres, e `warnedImagePaths` viveria a
          // sessão inteira guardando cada uma. Por token resolve — um token
          // tem uma foto embutida só.
          const warnKey = isTokenPhotoData(imagePath) ? `token:${token.id}` : imagePath
          entry.loadedSrc = photoRef
          entry.loadedData = photoData
          // Foto embutida (a que veio do jogador, ou a cópia que viaja) não
          // passa por `convertFileSrc`: ela já é auto-contida, e o Assets do
          // Pixi não sabe carregar data URL (ver pixi/tokenPhotoSprite.ts).
          // Ela também não precisa de descarga de cache: a própria referência
          // É o conteúdo, então conteúdo novo já é URL nova.
          const carregar: Promise<Texture> = isTokenPhotoData(imagePath)
            ? textureFromDataUrl(imagePath)
            : textureDoArquivo(currentEntry, convertFileSrc(imagePath))
          carregar
            .then((texture) => {
              if (cache.get(token.id) !== currentEntry || currentEntry.loadToken !== localLoadToken || !currentEntry.sprite) return
              currentEntry.sprite.texture = texture
              // A proporção só é conhecida com a textura na mão: reencaixa.
              fitPhotoSprite(currentEntry.sprite, photoRadius)
            })
            .catch(() => {
              // textura não carregou — sprite fica com Texture.EMPTY
              // (invisível), sem quebrar o resto do mapa. Onda 2, item 12:
              // antes isso era silencioso; agora avisa, uma vez por caminho
              // (warnedImagePaths), não uma vez por token nem por frame.
              if (!warnedImagePaths.has(warnKey)) {
                warnedImagePaths.add(warnKey)
                // `tokenPhotoLabel`: nome do arquivo quando é caminho, e uma
                // frase curta quando é foto embutida — despejar a base64 no
                // toast encheria a tela do mestre de lixo.
                useToastStore.getState().push('error', `Imagem do token "${tokenName}" não carregou: ${tokenPhotoLabel(imagePath)}`)
              }
            })
        }

        // Moldura SEMPRE, não só quando selecionado: foi o pedido do usuário
        // (token redondo com moldura em volta). O anel de seleção fica por
        // fora dela, para os dois continuarem legíveis ao mesmo tempo.
        // A cor escolhida pelo mestre manda na MOLDURA quando o token tem
        // foto: o disco inteiro é a cara do personagem, então é o aro que
        // sobra para dizer "este é aliado". Sem cor escolhida, o latão de
        // sempre — token com foto antigo não muda de aparência.
        entry.ring
          .circle(0, 0, radius - TOKEN_FRAME_WIDTH / 2)
          .stroke({ width: TOKEN_FRAME_WIDTH, color: parseHexColor(token.color) ?? TOKEN_FRAME_COLOR })
        if (selected) {
          entry.ring.circle(0, 0, radius).stroke({ width: 4, color: SELECTION_COLOR })
        }
        outlineRadius = radius
      } else {
        const graphics = ensureGraphics(entry)
        const radius = (gridSize * token.size) / 2 - 2
        drawTokenCircle(graphics, radius, selected, tokenFillColor(token))
        // Círculo genérico é simétrico hoje, mas gira igual ao sprite pra
        // não haver salto visual quando o token ganha/perde imagem depois.
        graphics.rotation = rotationToRadians(token.rotation)
        outlineRadius = radius
      }

      // Barra de vida SOB o disco, e o nome logo abaixo dela. `readTokenHealth`
      // porque o mapa do disco chega cru: vida com lixo não desenha barra.
      const health = readTokenHealth(token.health)
      syncHealthBar(entry, health, outlineRadius)
      entry.label.position.set(0, tokenLabelTop(outlineRadius, health !== null))

      // hidden === "Oculto no editor" (organização de cena do mestre). Antes
      // o token sumia de vez e não havia como clicar nele para desfazer; agora
      // fica como fantasma (alpha baixo acima + contorno tracejado), clicável.
      if (ghost) strokeDashedCircle(entry.ring, outlineRadius)

      // Condição na ficha: pastilhas sentadas na borda de cima do disco que a
      // pessoa vê (`outlineRadius`), por cima de tudo. Fantasma e "Oculto para
      // jogadores" esmaecem a marca junto, pelo alpha do wrapper.
      drawTokenConditions(entry.marks, tokenConditionsOf(token), outlineRadius, gridSize)

      entry.label.text = token.name
      applyLabelSizing(entry.label)
      entry.wrapper.position.set(token.x, token.y)
    }
  }

  return { draw, setCameraScale }
}
