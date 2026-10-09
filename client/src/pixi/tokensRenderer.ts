import { Container, Sprite, Graphics, Text, Assets, Texture, type Ticker } from 'pixi.js'
import { convertFileSrc } from '@tauri-apps/api/core'
import { theme } from '../theme'
import { createTokenGlides, stepGlides, syncGlide, type GlidePoint } from '../player/tokenGlide'
import type { Token, TokenHealth } from '../types/map'
import { SECRET_ITEM_ALPHA, SELECTION_COLOR, TOKEN_FRAME_COLOR, TOKEN_FRAME_WIDTH, TURN_RING_COLOR, TURN_RING_GAP, TURN_RING_WIDTH } from './constants'
import { drawTokenCircle, tokenCircleRadius } from './drawTokens'
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
import { estaCongelada } from '../lib/congelar'
import { drawFrostBadge } from './drawTokenFrozen'
import { faseDoMarcador } from './drawMarcadorDeContinente'
import { criarVistaDoMarcador, escalarVistaDoMarcador, pintarVistaDoMarcador, posarVistaDoMarcador, type VistaDoMarcador } from './vistaDoMarcador'

/** Token "Oculto no editor": fantasma bem transparente, mas ainda clicável. */
const HIDDEN_TOKEN_GHOST_ALPHA = 0.3
const GHOST_DASH_COUNT = 16
const GHOST_OUTLINE_WIDTH = 2
const GHOST_OUTLINE_COLOR = 0xffffff

/**
 * VOLTO JÁ: o disco (círculo ou foto) da ficha de quem saiu da mesa apaga até
 * aqui. Só o disco: o selo e o nome continuam nítidos, e é o selo que diz o
 * porquê — apagado sozinho se confundiria com a ficha oculta.
 */
export const AWAY_TOKEN_ALPHA = 0.55
/** Centro do selo, em fração do raio, no alto à direita do disco. */
const AWAY_SEAL_OFFSET = 0.75
/** Raio do selo em fração do raio da ficha, com piso para ficha pequena. */
const AWAY_SEAL_SCALE = 0.32
const AWAY_SEAL_MIN_RADIUS = 5
/** Selo no estilo do mapa: disco escuro chapado com linha fina clara, e o "pausa" dentro. */
const AWAY_SEAL_FILL = 0x1a1a1a
const AWAY_SEAL_LINE = 0xe8e8e8
const AWAY_SEAL_LINE_WIDTH = 1.5

/**
 * Selo de ausente do Volto já: disco pequeno no alto à direita com duas
 * barras de "pausa". Desenhado no anel da ficha, sem filho novo no wrapper.
 */
function drawAwaySeal(graphics: Graphics, radius: number): void {
  const sealRadius = Math.max(AWAY_SEAL_MIN_RADIUS, radius * AWAY_SEAL_SCALE)
  const cx = radius * AWAY_SEAL_OFFSET
  const cy = -radius * AWAY_SEAL_OFFSET
  const barWidth = sealRadius * 0.28
  const barHeight = sealRadius * 0.9
  graphics
    .circle(cx, cy, sealRadius)
    .fill({ color: AWAY_SEAL_FILL })
    .stroke({ width: AWAY_SEAL_LINE_WIDTH, color: AWAY_SEAL_LINE })
    .rect(cx - barWidth * 1.5, cy - barHeight / 2, barWidth, barHeight)
    .rect(cx + barWidth * 0.5, cy - barHeight / 2, barWidth, barHeight)
    .fill({ color: AWAY_SEAL_LINE })
}

const NO_AWAY_TOKENS: ReadonlySet<string> = new Set()

/**
 * Ficha OCULTA PARA JOGADORES (`secret` — escondida pelo mestre ou pelo pedido
 * de esconder-se): o mesmo tracejado claro e fino, mas POR FORA do disco, a
 * esta folga em px de mundo. Por fora para não se confundir com o fantasma do
 * "Oculto no editor" (tracejado na borda) e para continuar visível sobre a foto.
 */
const SECRET_RING_GAP = 4

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

/**
 * FICHA NA MÃO — quanto a ficha cresce enquanto o mestre a arrasta: sai da
 * mesa sem cobrir a vizinha. É o que diferencia "segurando" de "selecionada"
 * (o anel amarelo já diz a segunda).
 */
export const TOKEN_LIFT_SCALE = 1.06
/** Pegar responde no tempo curto do tema; assentar, no base — um pouco mais calmo. */
const TOKEN_LIFT_MS = Number.parseFloat(theme.motion.fast)
const TOKEN_SETTLE_MS = Number.parseFloat(theme.motion.base)

/**
 * ANEL DA VEZ — quando a vez passa, o anel chega de fora, maior e
 * transparente, e fecha sobre a ficha seguinte: o olho do mestre vai direto
 * para quem joga, mesmo num mapa cheio. Troca rara e importante, por isso
 * anima; a do atalho de teclado (Shift+N) não (`semPulsoDaVez`).
 */
export const TURN_RING_PULSE_FROM_SCALE = 1.25
const TURN_RING_PULSE_MS = Number.parseFloat(theme.motion.base)
/** Nome (`Container.label`) do anel da vez no wrapper — é por ele que o teste o acha. */
export const TURN_RING_LABEL = 'vez'

/**
 * O que o renderer precisa para animar. Sem isto (exportação de imagem,
 * testes), nada anima: a ficha vai direto ao estado final.
 */
export interface TokensMotion {
  /** O relógio de quadros do Pixi (`app.ticker`): o renderer só se inscreve enquanto alguma ficha anima. */
  ticker: Pick<Ticker, 'add' | 'remove'>
  /** `prefers-reduced-motion`, lido quando uma animação vai começar — a pessoa pode mudar com o app aberto. */
  reducedMotion: () => boolean
  /** Agora, em ms. Padrão `performance.now()`, o relógio do deslize (`player/tokenGlide.ts`). */
  now?: () => number
}

/**
 * Quem pode deslizar neste desenho. A ficha que o JOGADOR andou desliza do
 * lugar antigo ao novo, como na tela dele; a que o MESTRE mexeu (arrasto,
 * setas, desfazer) continua indo direto, porque foi a mão dele que a pôs lá.
 */
export interface TokenGlideContext {
  /** Identidade da cena desenhada: troca de cena não atravessa a tela. */
  sceneId: string
  /** Fichas que o jogador acabou de mover (`lib/movimentoRemoto.ts`). */
  remoteMoveIds: ReadonlySet<string>
}

export interface TokensRenderer {
  /**
   * `cameraScale` omitido mantém o último zoom informado. `turnTokenId`: a
   * ficha da vez na iniciativa, que ganha o anel da vez (`TURN_RING_*`).
   * `awayTokenIds`: as fichas de quem está no Volto já, que levam o selo de
   * ausente; omitido = nenhuma (a exportação de imagem não leva estado da sessão).
   * `glide`: quem pode deslizar; omitido = tudo no lugar final, e deslize em
   * curso termina já (a exportação de imagem sai com as fichas paradas).
   * `pinos`: MAPA DE CONTINENTE — a cor (`#rrggbb`) de cada ficha de jogador,
   * que é desenhada como o pino no lugar do disco (`lib/marcadorDeContinente.ts`):
   * só o nome embaixo, sem vida, condições nem anel da vez. Omitido = nenhuma.
   *
   * Só repinta a ficha cuja pintura mudou (`TokenPaint`); a outra só anda.
   * Devolve quantos nomes nasceram ou trocaram de texto neste desenho: só
   * então a resolução do texto precisa ser refeita (`syncWorldTextResolution`
   * percorre o mundo inteiro, e o arrasto chama `draw` a cada passo).
   */
  draw: (
    container: Container,
    tokens: Token[],
    gridSize: number,
    selectedTokenId?: string | null,
    cameraScale?: number,
    turnTokenId?: string | null,
    awayTokenIds?: ReadonlySet<string>,
    glide?: TokenGlideContext,
    pinos?: ReadonlyMap<string, string>,
  ) => number
  /** Só o zoom mudou: reescala e mostra/esconde os nomes e o tamanho dos pinos, sem redesenhar os tokens. */
  setCameraScale: (cameraScale: number) => void
  /**
   * A ficha na mão do mestre (`null` = soltou): ela cresce até
   * `TOKEN_LIFT_SCALE` e, solta, assenta. Chamar no primeiro passo em que a
   * ficha anda, nunca no apertar: clique de seleção não pulsa. A ficha na mão
   * também nunca desliza atrás do ponteiro.
   */
  levantar: (tokenId: string | null) => void
  /** Roda `aplicar` (que troca a vez e redesenha) sem o pulso do anel: a vez passada pelo teclado. */
  semPulsoDaVez: (aplicar: () => void) => void
  /** Desmonte: sai do relógio de quadros e esquece toda animação em curso. */
  cancelarAnimacoes: () => void
}

/** Escala do wrapper indo de `from` a `to` (levantar e assentar). */
interface ScaleTween {
  from: number
  to: number
  start: number
  duration: number
}

const NO_REMOTE_MOVES: ReadonlySet<string> = new Set()
const NO_PINS: ReadonlyMap<string, string> = new Map()

/** Anel de seleção no chão do pino, em px de tela: a elipse de um anel deitado, na mesma inclinação do pino. */
const MARCADOR_SELECAO_RX = 15
const MARCADOR_SELECAO_RY = 6

/** Responde já e assenta no fim, como o degrau de zoom do jogador (`player/playerZoom.ts`). */
function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

/** Fração andada de uma animação, entre 0 e 1. */
function progressOf(start: number, duration: number, now: number): number {
  if (duration <= 0) return 1
  return Math.min(1, Math.max(0, (now - start) / duration))
}

/** O anel da vez num ponto do pulso: `k` 0 = chegando de fora, transparente; 1 = assentado. */
function applyTurnPulse(ring: Graphics, k: number): void {
  ring.scale.set(TURN_RING_PULSE_FROM_SCALE + (1 - TURN_RING_PULSE_FROM_SCALE) * k)
  ring.alpha = k
}

/**
 * Tudo o que a pintura de uma ficha leu. Igual ao da última pintura = nada a
 * limpar nem a refazer: a ficha só anda. Cada Graphics limpo refaz a geometria
 * e obriga o Pixi a refazer os lotes do grupo de render — com 800 fichas, um
 * arrasto de 30 passos limpava ~75 mil (medido no dev, 01/10/2026).
 *
 * A ficha entra pela REFERÊNCIA: a store troca o objeto a cada mudança e
 * conserva o das fichas que não mudaram (`moveTokenLive`, `setTokenPosition`),
 * então a referência cobre todo campo que o desenho lê — cor, foto, tamanho,
 * giro, nome, vida, condições, oculta, secreta, congelada. O resto vem de
 * fora da ficha: a grade (raio), a seleção, a vez e o Volto já. O zoom não
 * entra: ele só muda a escala do nome, refeita a cada `draw` e em `setCameraScale`.
 */
interface TokenPaint {
  token: Token
  gridSize: number
  selected: boolean
  isTurn: boolean
  away: boolean
  /** MAPA DE CONTINENTE: a cor do pino; `null` = disco ou foto de sempre. */
  pino: string | null
}

/** A última pintura da ficha ainda vale para estas entradas? */
function paintIsCurrent(
  painted: TokenPaint | null,
  token: Token,
  gridSize: number,
  selected: boolean,
  isTurn: boolean,
  away: boolean,
  pino: string | null,
): boolean {
  return (
    painted !== null &&
    painted.token === token &&
    painted.gridSize === gridSize &&
    painted.selected === selected &&
    painted.isTurn === isTurn &&
    painted.away === away &&
    painted.pino === pino
  )
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
  /** Anel da VEZ (`TURN_RING_*`): Graphics próprio, e não um traço a mais em
   *  `ring`, porque é ele que pulsa (escala e transparência) quando a vez
   *  chega. Nasce só na ficha da vez, logo acima de `ring`, e morre quando a
   *  vez sai: as outras fichas continuam com os filhos de sempre. */
  turnRing: Graphics | null
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
  /** O que a última pintura leu (`TokenPaint`); null antes da primeira. */
  painted: TokenPaint | null
  /** MAPA DE CONTINENTE: o pino (`pixi/vistaDoMarcador.ts`). Nasce na primeira
   *  vez que a ficha vira pino e fica escondido quando ela volta a ser disco —
   *  o `Text` do nome nunca é destruído no meio da sessão. */
  marcador: VistaDoMarcador | null
  /** Anel de seleção no chão do pino (px de tela, dentro da raiz do pino); nasce junto com ele. */
  marcadorSelecao: Graphics | null
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
 *
 * `motion` liga as três animações da ficha no mestre — levantar na mão,
 * pulso do anel da vez e deslize do passo do jogador —, todas só de
 * transform/alpha e todas num ticker que só existe enquanto alguma anima.
 * Sem `motion`, nada anima.
 */
export function createTokensRenderer(motion?: TokensMotion): TokensRenderer {
  const cache = new Map<string, TokenEntry>()
  // Onda 2, item 12 — caminho de imagem já avisado, pra não empilhar o
  // mesmo toast de erro a cada `draw()` (chamado a cada mudança relevante do
  // mapa, não só uma vez). Fechado por closure igual `cache`: nasce vazio a
  // cada mount, sem risco do "sprite fantasma" documentado acima. Guarda por
  // CAMINHO, não por token — dois tokens com a mesma imagem quebrada avisam
  // uma vez só, não duas.
  const warnedImagePaths = new Set<string>()
  let lastCameraScale = 1

  // ── Animação ──────────────────────────────────────────────────────────
  const clock = motion?.now ?? (() => performance.now())
  /** Levantar/assentar em curso, por id. */
  const scaleTweens = new Map<string, ScaleTween>()
  /** Pulso do anel da vez em curso. */
  let turnPulse: { id: string; start: number } | null = null
  /** Passos do jogador deslizando (`player/tokenGlide.ts`). */
  const glides = createTokenGlides()
  /** A ficha na mão do mestre (`levantar`). */
  let handId: string | null = null
  /** A vez do último `draw`; `undefined` antes do primeiro — abrir o mapa com a vez andando não pulsa. */
  let lastTurnTokenId: string | null | undefined = undefined
  /** A cena do último `draw` com deslize: só se desliza dentro da mesma. */
  let lastSceneId: string | null = null
  /** `semPulsoDaVez` em curso: a vez que trocar agora aparece parada. */
  let quietTurn = false
  /**
   * MAPA DE CONTINENTE: os pinos girando agora, por id. Só existem numa cena
   * Continente com movimento liberado: cena Normal (ou movimento reduzido)
   * deixa o conjunto vazio, e o relógio de quadros não roda por causa deles.
   */
  const pinosGirando = new Set<string>()
  let ticking = false

  /** Movimento reduzido ou sem relógio: nada anima, tudo vai ao estado final. */
  function canAnimate(): boolean {
    return motion !== undefined && !motion.reducedMotion()
  }

  function startTicking(): void {
    if (ticking || motion === undefined) return
    ticking = true
    motion.ticker.add(tick)
  }

  function stopTicking(): void {
    if (!ticking || motion === undefined) return
    ticking = false
    motion.ticker.remove(tick)
  }

  /** Um quadro: escala de quem levanta/assenta, o pulso da vez e os deslizes. Parado, solta o relógio. */
  function tick(): void {
    const now = clock()
    for (const [id, tween] of scaleTweens) {
      const entry = cache.get(id)
      if (!entry) {
        scaleTweens.delete(id)
        continue
      }
      const t = progressOf(tween.start, tween.duration, now)
      entry.wrapper.scale.set(tween.from + (tween.to - tween.from) * easeOutCubic(t))
      if (t >= 1) scaleTweens.delete(id)
    }
    if (turnPulse !== null) {
      const ring = cache.get(turnPulse.id)?.turnRing ?? null
      const t = progressOf(turnPulse.start, TURN_RING_PULSE_MS, now)
      if (ring !== null) applyTurnPulse(ring, easeOutCubic(t))
      if (ring === null || t >= 1) turnPulse = null
    }
    if (glides.size > 0) {
      for (const { id, x, y } of stepGlides(glides, now)) {
        const entry = cache.get(id)
        if (entry) entry.wrapper.position.set(x, y)
      }
    }
    // O pino gira e flutua: só a pirâmide é redesenhada, o resto só anda.
    // "Reduzir movimento" ligado no meio da sessão para o pino na pose parada
    // já neste quadro, sem esperar a próxima repintura das fichas.
    const parado = !canAnimate()
    for (const id of pinosGirando) {
      const marcador = cache.get(id)?.marcador ?? null
      if (marcador !== null) posarVistaDoMarcador(marcador, now, parado)
      if (marcador === null || parado) pinosGirando.delete(id)
    }
    if (scaleTweens.size === 0 && turnPulse === null && glides.size === 0 && pinosGirando.size === 0) stopTicking()
  }

  /** Leva a escala do wrapper de `id` até `to`, de onde ela estiver (soltar no meio do levantar assenta dali). */
  function animateScale(id: string, to: number, duration: number): void {
    const entry = cache.get(id)
    if (!entry) {
      scaleTweens.delete(id)
      return
    }
    // Sem animação a ficha não muda de tamanho nenhum — nem de uma vez: o
    // anel amarelo da seleção continua dizendo qual é.
    if (!canAnimate()) {
      scaleTweens.delete(id)
      entry.wrapper.scale.set(1)
      return
    }
    const from = entry.wrapper.scale.x
    if (from === to) {
      scaleTweens.delete(id)
      return
    }
    scaleTweens.set(id, { from, to, start: clock(), duration })
    startTicking()
  }

  function levantar(tokenId: string | null): void {
    if (tokenId === handId) return
    const previous = handId
    handId = tokenId
    if (previous !== null) animateScale(previous, 1, TOKEN_SETTLE_MS)
    if (tokenId !== null) animateScale(tokenId, TOKEN_LIFT_SCALE, TOKEN_LIFT_MS)
  }

  function semPulsoDaVez(aplicar: () => void): void {
    quietTurn = true
    try {
      aplicar()
    } finally {
      quietTurn = false
    }
  }

  function cancelarAnimacoes(): void {
    scaleTweens.clear()
    turnPulse = null
    glides.clear()
    pinosGirando.clear()
    stopTicking()
  }

  /**
   * O anel da vez desta ficha: nasce logo acima do anel da ficha — por baixo
   * da barra de vida, do nome e das marcas, a mesma altura de quando era um
   * traço do próprio anel — e morre quando a vez sai. `pulse` = a vez acabou
   * de chegar aqui: começa de fora e transparente.
   */
  function syncTurnRing(entry: TokenEntry, tokenId: string, isTurn: boolean, outlineRadius: number, pulse: boolean): void {
    if (!isTurn) {
      if (entry.turnRing) {
        entry.wrapper.removeChild(entry.turnRing)
        entry.turnRing.destroy()
        entry.turnRing = null
      }
      return
    }
    if (!entry.turnRing) {
      const turnRing = new Graphics()
      turnRing.label = TURN_RING_LABEL
      entry.wrapper.addChildAt(turnRing, entry.wrapper.getChildIndex(entry.ring) + 1)
      entry.turnRing = turnRing
    }
    entry.turnRing
      .clear()
      .circle(0, 0, outlineRadius + TURN_RING_GAP + TURN_RING_WIDTH / 2)
      .stroke({ width: TURN_RING_WIDTH, color: TURN_RING_COLOR })
    if (pulse) {
      turnPulse = { id: tokenId, start: clock() }
      applyTurnPulse(entry.turnRing, 0)
      startTicking()
    } else if (turnPulse?.id !== tokenId) {
      applyTurnPulse(entry.turnRing, 1)
    }
  }

  /** O deslize em curso desta ficha já vai para `target`? (redesenho sem relação não o corta) */
  function glidingTo(id: string, target: GlidePoint): boolean {
    const track = glides.get(id)
    return track !== undefined && track.toX === target.x && track.toY === target.y
  }

  /** Nome no zoom atual. A ficha que é pino esconde o nome dela: o pino leva o seu, do tamanho fixo dele. */
  function applyLabelSizing(entry: TokenEntry): void {
    const sizing = screenLabelSizing(TOKEN_LABEL_FONT_SIZE, lastCameraScale)
    entry.label.scale.set(sizing.scale)
    entry.label.visible = sizing.visible && (entry.painted === null || entry.painted.pino === null)
    if (entry.marcador !== null) escalarVistaDoMarcador(entry.marcador, lastCameraScale)
  }

  function setCameraScale(cameraScale: number): void {
    lastCameraScale = cameraScale
    for (const entry of cache.values()) applyLabelSizing(entry)
  }

  /**
   * MAPA DE CONTINENTE: a ficha vira o pino. O disco, a foto, a barra de vida,
   * as marcas, o anel da vez e os selos somem (nada de extras no pino); o nome
   * vai no pino. Selecionada, ganha o anel de seleção no chão do pino.
   * Devolve `true` quando um `Text` nasceu ou trocou de texto.
   */
  function paintMarcador(entry: TokenEntry, token: Token, cor: string, selected: boolean): boolean {
    let mudouNome = false
    let marcador = entry.marcador
    let selecao = entry.marcadorSelecao
    if (marcador === null || selecao === null) {
      marcador = criarVistaDoMarcador(faseDoMarcador(token.id))
      selecao = new Graphics()
      marcador.raiz.addChildAt(selecao, 0)
      entry.wrapper.addChild(marcador.raiz)
      entry.marcador = marcador
      entry.marcadorSelecao = selecao
      mudouNome = true
    }
    marcador.raiz.visible = true
    const visual = entry.sprite ?? entry.graphics
    if (visual !== null) visual.visible = false
    entry.ring.clear()
    syncHealthBar(entry, null, 0)
    entry.marks.clear()
    if (entry.turnRing) {
      entry.wrapper.removeChild(entry.turnRing)
      entry.turnRing.destroy()
      entry.turnRing = null
    }
    selecao.clear()
    if (selected) {
      selecao.ellipse(0, 0, MARCADOR_SELECAO_RX, MARCADOR_SELECAO_RY).fill({ color: SELECTION_COLOR, alpha: 0.18 })
      selecao.stroke({ width: 2, color: SELECTION_COLOR })
    }
    if (marcador.rotulo.text !== token.name) mudouNome = true
    pintarVistaDoMarcador(marcador, cor, token.name)
    escalarVistaDoMarcador(marcador, lastCameraScale)
    return mudouNome
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

  function draw(
    container: Container,
    tokens: Token[],
    gridSize: number,
    selectedTokenId: string | null = null,
    cameraScale?: number,
    turnTokenId: string | null = null,
    awayTokenIds: ReadonlySet<string> = NO_AWAY_TOKENS,
    glide?: TokenGlideContext,
    pinos: ReadonlyMap<string, string> = NO_PINS,
  ): number {
    if (cameraScale !== undefined) lastCameraScale = cameraScale
    const currentIds = new Set(tokens.map((t) => t.id))

    for (const [id, entry] of cache) {
      if (!currentIds.has(id)) {
        container.removeChild(entry.wrapper)
        entry.wrapper.destroy({ children: true })
        cache.delete(id)
        // Animação de quem saiu do mapa morre junto: o quadro seguinte não mexe em wrapper destruído.
        scaleTweens.delete(id)
        glides.delete(id)
        pinosGirando.delete(id)
        if (turnPulse?.id === id) turnPulse = null
      }
    }

    // A vez só pulsa na TROCA: este `draw` roda a cada passo de arrasto, e
    // com a mesma vez o anel só é redesenhado. Os testes baratos vêm antes da
    // preferência do sistema, que só é lida quando a vez troca de verdade.
    const turnChanged = lastTurnTokenId !== undefined && turnTokenId !== lastTurnTokenId
    lastTurnTokenId = turnTokenId
    if (turnChanged) turnPulse = null
    const pulseTurn = turnChanged && turnTokenId !== null && !quietTurn && canAnimate()

    // Deslize só dentro da MESMA cena e só com algo a deslizar (passo novo do
    // jogador ou deslize em curso): sem isso, nem a preferência é lida.
    const sceneId = glide?.sceneId ?? null
    const sameScene = sceneId !== null && sceneId === lastSceneId
    lastSceneId = sceneId
    const remoteMoveIds = glide?.remoteMoveIds ?? NO_REMOTE_MOVES
    const glideAllowed = sameScene && (remoteMoveIds.size > 0 || glides.size > 0) && canAnimate()
    const now = clock()
    /** Nomes que nasceram ou trocaram de texto: o retorno de `draw`. */
    let changedLabels = 0

    for (const token of tokens) {
      let entry = cache.get(token.id)
      const born = entry === undefined
      // Onde a ficha está desenhada agora; `null` = acabou de aparecer, e aparece no lugar.
      let shown: GlidePoint | null = null
      if (entry) {
        shown = { x: entry.wrapper.position.x, y: entry.wrapper.position.y }
      } else {
        const wrapper = new Container()
        const ring = new Graphics()
        const label = new Text({ text: '', style: { fontSize: TOKEN_LABEL_FONT_SIZE, fill: 0xffffff } })
        label.anchor.set(0.5, 0)
        const marks = new Graphics()
        marks.label = CONDITION_MARKS_LABEL
        wrapper.addChild(ring, label, marks)
        entry = {
          wrapper,
          sprite: null,
          photoMask: null,
          graphics: null,
          ring,
          turnRing: null,
          bar: null,
          label,
          marks,
          loadedSrc: null,
          loadedData: null,
          loadedUrl: null,
          loadToken: 0,
          painted: null,
          marcador: null,
          marcadorSelecao: null,
        }
        cache.set(token.id, entry)
        container.addChild(wrapper)
      }

      // Passo do jogador: do lugar antigo ao novo. A ficha na mão do mestre
      // nunca desliza atrás do ponteiro, e a que o mestre mexeu vai direto —
      // inclusive a que ainda deslizava, quando o alvo dela muda (Ctrl+Z, setas).
      // Antes da pintura: toda ficha anda, repintada ou não.
      const target = { x: token.x, y: token.y }
      const animate = glideAllowed && token.id !== handId && (remoteMoveIds.has(token.id) || glidingTo(token.id, target))
      const at = syncGlide(glides, token.id, { shown, target, now, animate })
      entry.wrapper.position.set(at.x, at.y)
      // O zoom de `draw` vale para todo nome, repintado ou não (só escala; o texto não muda).
      applyLabelSizing(entry)

      const selected = token.id === selectedTokenId
      // A ficha da vez: anel solto por fora de tudo (moldura e seleção), para
      // ler de relance no meio do mapa sem esconder a seleção.
      const isTurn = token.id === turnTokenId
      const pulse = isTurn && pulseTurn
      // VOLTO JÁ: a ficha de quem saiu da mesa (disco apagado e selo, abaixo).
      const away = awayTokenIds.has(token.id)
      // MAPA DE CONTINENTE: ausente = a ficha de sempre (NPC, ou cena Normal).
      const pino = pinos.get(token.id) ?? null
      if (pino !== null && canAnimate()) pinosGirando.add(token.id)
      else pinosGirando.delete(token.id)
      // Pintura em dia: a ficha só andou (acima). É o caso de quase toda ficha
      // a cada passo do arrasto de OUTRA. O pulso da vez sempre repinta: é ele
      // que arma a animação do anel.
      if (!pulse && paintIsCurrent(entry.painted, token, gridSize, selected, isTurn, away, pino)) continue

      const ghost = isHidden(token)
      entry.wrapper.alpha = ghost ? HIDDEN_TOKEN_GHOST_ALPHA : token.secret ? SECRET_ITEM_ALPHA : 1
      if (pino !== null) {
        if (paintMarcador(entry, token, pino, selected)) changedLabels += 1
        // Já na pose de agora: o pino recém-nascido não espera o próximo quadro para ter pirâmide.
        // Parado (movimento reduzido, exportação), é a pose fixa, e só aqui ela é desenhada.
        if (entry.marcador !== null) posarVistaDoMarcador(entry.marcador, now, !pinosGirando.has(token.id))
        entry.painted = { token, gridSize, selected, isTurn, away, pino }
        applyLabelSizing(entry)
        continue
      }
      // Voltou a ser disco (cena Normal, ficha sem dono): o pino some, o visual volta.
      if (entry.marcador !== null) entry.marcador.raiz.visible = false
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
        const radius = tokenCircleRadius(gridSize, token.size)
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
      else if (token.secret === true) strokeDashedCircle(entry.ring, outlineRadius + SECRET_RING_GAP)
      syncTurnRing(entry, token.id, isTurn, outlineRadius, pulse)

      // Condição na ficha: pastilhas sentadas na borda de cima do disco que a
      // pessoa vê (`outlineRadius`), por cima de tudo. Fantasma e "Oculto para
      // jogadores" esmaecem a marca junto, pelo alpha do wrapper.
      drawTokenConditions(entry.marks, tokenConditionsOf(token), outlineRadius, gridSize)

      // VOLTO JÁ: o disco apaga e o selo diz por quê. O alpha do wrapper
      // (fantasma/secreta) continua valendo por cima: o selo não revela nada.
      const visual = entry.sprite ?? entry.graphics
      if (visual !== null) {
        visual.alpha = away ? AWAY_TOKEN_ALPHA : 1
        visual.visible = true
      }
      if (away) drawAwaySeal(entry.ring, outlineRadius)
      // CONGELAR FICHA: o floco no alto à esquerda — depois do "Congelar todos"
      // o mestre vê quem está segurado sem abrir painel. No anel, como o selo:
      // sem slot novo no wrapper. Travada também: no editor não há cadeado.
      if (estaCongelada(token)) drawFrostBadge(entry.ring, outlineRadius)

      // Nome novo (Text que acabou de nascer, na resolução do renderer) ou
      // trocado: o tamanho do texto entra no teto da resolução dele.
      const renamed = entry.label.text !== token.name
      entry.label.text = token.name
      if (born || renamed) changedLabels += 1
      entry.painted = { token, gridSize, selected, isTurn, away, pino: null }
      applyLabelSizing(entry)
    }
    if (glides.size > 0 || pinosGirando.size > 0) startTicking()
    return changedLabels
  }

  return { draw, setCameraScale, levantar, semPulsoDaVez, cancelarAnimacoes }
}
