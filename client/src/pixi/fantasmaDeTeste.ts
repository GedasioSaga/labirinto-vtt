/**
 * FANTASMA DA FICHA DE TESTE — o renderer (Visão de jogador, entrega 3). Monta
 * a cópia translúcida da ficha no mundo do editor, anda com ela e a faz
 * aparecer e sumir. O desenho em si mora em `drawFantasmaDeTeste.ts`.
 *
 * NÃO É FICHA DO MAPA: não está em `MapData`, então clique, arrasto, hover,
 * borracha, seleção por área, Ctrl+A, cursor e minimapa — que leem a geometria
 * do mapa, nunca a árvore do Pixi — não o enxergam. A raiz ainda nasce com
 * `eventMode = 'none'` para valer sozinha, fora do `world` que já poda eventos.
 *
 * MOVIMENTO (skill emil-kowalski-ui-craft):
 * - Andar: cada passo do teste desliza como o passo do jogador no editor
 *   (`player/tokenGlide.ts`, 240 ms, sai rápido e assenta; passos emendados em
 *   velocidade constante). É o mesmo tipo de mudança, então o mesmo movimento.
 * - Aparecer (raro: o primeiro passo do teste): sai de dentro da ficha de
 *   verdade deslizando até onde está no teste, acendendo junto. Explica de onde
 *   a cópia veio.
 * - Sumir (raro: fechou a janela, voltou ao lugar, Esquecer tudo): apaga onde
 *   está, mais rápido que a entrada.
 * - Trocar de cena não atravessa a tela: o fantasma da cena anterior some e o
 *   da nova já aparece no lugar, como as fichas.
 * - A ficha que o teste levou para OUTRA cena (`deOutraCena`): a de verdade
 *   não está na cena de destino, então ele não sai de dentro dela — acende no
 *   lugar, só na opacidade e curto — e não tem ligação.
 * - `prefers-reduced-motion`: nada desliza; aparecer e sumir ficam só na
 *   opacidade, curtos.
 * Só transform e alpha, num relógio que só existe enquanto algo anima.
 */
import { Assets, Container, Graphics, Sprite, Text, Texture, type Ticker } from 'pixi.js'
import { convertFileSrc } from '@tauri-apps/api/core'
import { DEFAULT_TEXT_FONT_FAMILY } from '../lib/drawingFactory'
import { rotationToRadians } from '../lib/itemTransform'
import { tokenFillColor } from '../lib/tokenColor'
import { isTokenPhotoData } from '../lib/tokenPhoto'
import { createTokenGlides, stepGlides, syncGlide, TOKEN_GLIDE_MS, type GlidePoint } from '../player/tokenGlide'
import { theme } from '../theme'
import type { Token } from '../types/map'
import {
  drawAnelDoTeste,
  drawEtiquetaDoTeste,
  drawLigacaoDoTeste,
  escalaUtil,
  ETIQUETA_COR_DO_TEXTO,
  ETIQUETA_FONTE_PX,
  ETIQUETA_PESO,
  ETIQUETA_TEXTO,
  FANTASMA_CORPO_ALPHA,
  FANTASMA_DE_TESTE_LABEL,
  raioDoFantasma,
  type FantasmaNaCena,
  type PontaDaLigacao,
} from './drawFantasmaDeTeste'
import { tokenLabelTop } from './drawTokenHealth'
import { screenLabelSizing } from './screenLabel'
import { fitPhotoSprite, textureFromDataUrl } from './tokenPhotoSprite'

/** Aparecer sem deslizar e sumir: o tempo base do tema, abaixo dos 240 ms da entrada que desliza. */
export const FANTASMA_APAGAR_MS = Number.parseFloat(theme.motion.base)

/** Chave do deslize em `player/tokenGlide.ts`, que guarda um por id: aqui só há um fantasma. */
const DESLIZE = 'fantasma'

/** Largura por caractere quando o Pixi não consegue medir (jsdom, sem canvas 2D). */
const LARGURA_POR_FONTE = 0.62

/** O que o renderer precisa para animar. Sem isto (testes), tudo vai direto ao estado final. */
export interface FantasmaDeTesteMotion {
  ticker: Pick<Ticker, 'add' | 'remove'>
  /** `prefers-reduced-motion`, lido quando uma animação vai começar. */
  reducedMotion: () => boolean
  /** Agora, em ms. Padrão `performance.now()`, o relógio do deslize. */
  now?: () => number
}

export interface FantasmaDeTesteRenderer {
  /**
   * Leva o fantasma ao estado pedido: `null` some; um alvo aparece, anda ou só
   * repinta. `sceneId` identifica a cena desenhada (trocar não atravessa a
   * tela). Barato quando nada mudou: o disco só repinta quando a aparência da
   * ficha muda, e o anel e a ligação quando a geometria ou o zoom mudam.
   */
  draw: (alvo: FantasmaNaCena | null, gridSize: number, sceneId: string, cameraScale: number) => void
  /** Só o zoom: a etiqueta acompanha os nomes das fichas. O anel e a ligação, de px de tela, refazem no próximo `draw`. */
  setCameraScale: (cameraScale: number) => void
  /** Desmonte: sai do relógio, esquece o que carregava e solta a textura que é só dele. */
  desmontar: () => void
}

/** O que a pintura do disco leu da ficha. Igual = nada a refazer (a ficha só andou). */
interface Aparencia {
  gridSize: number
  size: number
  image: string | null
  imageData: string | null
  color: string | null
  rotation: number | undefined
}

function aparenciaDe(ficha: Token, gridSize: number): Aparencia {
  return {
    gridSize,
    size: ficha.size,
    image: ficha.image ?? null,
    imageData: ficha.imageData ?? null,
    color: ficha.color ?? null,
    rotation: ficha.rotation,
  }
}

function mesmaAparencia(a: Aparencia | null, b: Aparencia): boolean {
  return (
    a !== null &&
    a.gridSize === b.gridSize &&
    a.size === b.size &&
    a.image === b.image &&
    a.imageData === b.imageData &&
    a.color === b.color &&
    a.rotation === b.rotation
  )
}

/**
 * A foto do fantasma. A cópia embutida vem primeiro, ao contrário da ficha
 * (`tokenPhotoRef`): ela vira uma textura só do fantasma, que ele solta quando
 * quiser. A do arquivo é a MESMA textura da ficha no cache do Pixi, e quem a
 * descarrega é o renderer das fichas — a cópia, de até 256 px, sobra para um
 * disco que aparece pela metade.
 */
function fotoDo(ficha: Token): { ref: string; embutida: boolean } | null {
  const embutida = ficha.imageData
  if (isTokenPhotoData(embutida)) return { ref: embutida, embutida: true }
  return ficha.image ? { ref: ficha.image, embutida: false } : null
}

/** Responde já e assenta no fim: a mesma curva do levantar da ficha e do anel da vez. */
function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

function larguraDoTexto(texto: Text): number {
  try {
    const largura = texto.getLocalBounds().width
    if (Number.isFinite(largura) && largura > 0) return largura
  } catch {
    // jsdom não tem canvas 2D para medir: cai na estimativa abaixo.
  }
  return ETIQUETA_TEXTO.length * ETIQUETA_FONTE_PX * LARGURA_POR_FONTE
}

/**
 * Cria o fantasma dentro de `parent` (a camada dele no `world`, logo acima dos
 * pinos). Instanciar dentro do `setup()` de cada montagem do PixiCanvas, como
 * `createTokensRenderer`: um cache em escopo de módulo sobreviveria ao
 * desmonte com objetos já destruídos.
 */
export function createFantasmaDeTesteRenderer(parent: Container, motion?: FantasmaDeTesteMotion): FantasmaDeTesteRenderer {
  const raiz = new Container({ label: FANTASMA_DE_TESTE_LABEL })
  raiz.eventMode = 'none'
  raiz.interactiveChildren = false
  raiz.visible = false
  raiz.alpha = 0
  // A ligação por baixo do disco: os pontos param na borda dele.
  const ligacao = new Graphics()
  const corpo = new Container()
  const disco = new Container()
  disco.alpha = FANTASMA_CORPO_ALPHA
  const cor = new Graphics()
  const foto = new Sprite(Texture.EMPTY)
  foto.anchor.set(0.5)
  foto.visible = false
  // A máscara precisa estar na árvore para o Pixi a usar; ela mesma não aparece.
  const mascara = new Graphics()
  foto.mask = mascara
  disco.addChild(cor, foto, mascara)
  const anel = new Graphics()
  const etiqueta = new Container()
  const placa = new Graphics()
  // Nasce na montagem, com o texto que nunca muda: nenhum Text novo (e nenhuma
  // medida de fonte) no meio do teste.
  const texto = new Text({
    text: ETIQUETA_TEXTO,
    anchor: 0.5,
    roundPixels: true,
    style: { fontFamily: DEFAULT_TEXT_FONT_FAMILY, fontSize: ETIQUETA_FONTE_PX, fontWeight: ETIQUETA_PESO, fill: ETIQUETA_COR_DO_TEXTO },
  })
  const pilula = drawEtiquetaDoTeste(placa, larguraDoTexto(texto))
  texto.position.set(0, pilula.altura / 2)
  etiqueta.addChild(placa, texto)
  corpo.addChild(disco, anel, etiqueta)
  raiz.addChild(ligacao, corpo)
  parent.addChild(raiz)

  const clock = motion?.now ?? (() => performance.now())
  const glides = createTokenGlides()
  /** Acender ou apagar em curso: a opacidade da raiz vai de `de` a `para`. */
  let opacidade: { de: number; para: number; inicio: number; duracao: number } | null = null
  /** O fantasma está na tela (acendendo, parado ou apagando). */
  let mostrado = false
  /** Apagando para sumir. */
  let saindo = false
  /** A cena do último `draw`; `null` antes do primeiro — abrir o editor com teste em curso não anima. */
  let cena: string | null = null
  let escala = 1
  let ticking = false
  let desmontado = false

  let aparencia: Aparencia | null = null
  let raio = 0
  let anelPintado: { raio: number; escala: number } | null = null
  /**
   * De onde a ligação sai: a ficha de verdade do último `draw` com alvo, com a
   * meia casa dela — até onde chegam a moldura e a seleção da ficha, e o anel
   * do fantasma. Objeto novo só quando ela muda de lugar ou de tamanho: é a
   * testemunha do cache da ligação.
   */
  let origem: PontaDaLigacao | null = null
  let ligacaoPintada: { de: PontaDaLigacao; x: number; y: number; escala: number } | null = null

  /** A foto pedida agora (`ref`); `null` = disco de cor. */
  let fotoAtual: string | null = null
  /** Textura que só o fantasma usa (da cópia embutida): é ele que a destrói. */
  let texturaPropria: Texture | null = null
  /** Sobe a cada pedido de foto: o carregamento que voltar atrasado não pinta por cima do mais novo. */
  let carga = 0

  function podeAnimar(): boolean {
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

  function soltarTexturaPropria(): void {
    if (texturaPropria === null) return
    if (foto.texture === texturaPropria) foto.texture = Texture.EMPTY
    texturaPropria.destroy(true)
    texturaPropria = null
  }

  function carregarFoto(pedida: { ref: string; embutida: boolean }): void {
    carga += 1
    const minha = carga
    fotoAtual = pedida.ref
    // Vazio já, no mesmo redesenho: a textura antiga pode ser descarregada pelo
    // renderer das fichas logo em seguida, e sprite com textura destruída é erro de render.
    foto.texture = Texture.EMPTY
    soltarTexturaPropria()
    const caminho = pedida.ref
    const pedido: Promise<Texture> = pedida.embutida
      ? textureFromDataUrl(caminho)
      : Promise.resolve().then(() => Assets.load<Texture>(convertFileSrc(caminho)))
    pedido
      .then((textura) => {
        if (desmontado || minha !== carga) {
          if (pedida.embutida) textura.destroy(true)
          return
        }
        if (pedida.embutida) texturaPropria = textura
        foto.texture = textura
        // A proporção só é conhecida com a textura na mão: reencaixa.
        fitPhotoSprite(foto, raio)
      })
      .catch(() => {
        // A ficha de verdade já avisa a foto que não carregou (`tokensRenderer.ts`);
        // o fantasma fica com o anel e a etiqueta, sem segundo aviso.
      })
  }

  function esquecerFoto(): void {
    if (fotoAtual === null) return
    carga += 1
    fotoAtual = null
    foto.texture = Texture.EMPTY
    soltarTexturaPropria()
  }

  /** O disco com a cara da ficha: foto recortada no círculo, ou a cor dela. Só quando a aparência mudou. */
  function pintarDisco(ficha: Token, gridSize: number): void {
    const agora = aparenciaDe(ficha, gridSize)
    if (mesmaAparencia(aparencia, agora)) return
    aparencia = agora
    raio = raioDoFantasma(gridSize, ficha.size)
    const pedida = fotoDo(ficha)
    if (pedida === null) {
      esquecerFoto()
      foto.visible = false
      mascara.clear()
      cor.clear().circle(0, 0, raio).fill({ color: tokenFillColor(ficha) })
    } else {
      cor.clear()
      foto.visible = true
      mascara.clear().circle(0, 0, raio).fill({ color: 0xffffff })
      if (pedida.ref !== fotoAtual) carregarFoto(pedida)
      fitPhotoSprite(foto, raio)
      foto.rotation = rotationToRadians(ficha.rotation)
    }
    // A etiqueta no lugar do nome da ficha, com a mesma folga.
    etiqueta.position.set(0, tokenLabelTop(raio, false))
  }

  function pintarAnel(): void {
    if (anelPintado !== null && anelPintado.raio === raio && anelPintado.escala === escala) return
    drawAnelDoTeste(anel, raio, escala)
    anelPintado = { raio, escala }
  }

  /**
   * Sem ponta de onde sair (a ficha de verdade ficou em outra cena): apaga os
   * pontos — os da cena de antes, desenhados nas coordenadas de lá, inclusive.
   */
  function soltarLigacao(): void {
    if (origem === null && ligacaoPintada === null) return
    origem = null
    ligacaoPintada = null
    ligacao.clear()
  }

  /** Os pontos até onde o fantasma está desenhado agora (no meio do deslize, inclusive). */
  function pintarLigacao(): void {
    if (origem === null) return
    const { x, y } = corpo.position
    const atual = ligacaoPintada
    if (atual !== null && atual.de === origem && atual.x === x && atual.y === y && atual.escala === escala) return
    // As duas pontas têm a mesma meia casa: os pontos param na mesma folga da ficha e do fantasma.
    drawLigacaoDoTeste(ligacao, origem, { x, y, raio: origem.raio }, escala)
    ligacaoPintada = { de: origem, x, y, escala }
  }

  function aplicarEscalaDaEtiqueta(): void {
    const tamanho = screenLabelSizing(ETIQUETA_FONTE_PX, escala)
    etiqueta.scale.set(tamanho.scale)
    etiqueta.visible = tamanho.visible
  }

  function animarOpacidade(de: number, para: number, duracao: number): void {
    opacidade = { de, para, inicio: clock(), duracao }
    raiz.alpha = de
    startTicking()
  }

  function sumirJa(): void {
    mostrado = false
    saindo = false
    opacidade = null
    glides.clear()
    raiz.visible = false
    raiz.alpha = 0
    stopTicking()
  }

  function tick(): void {
    const now = clock()
    if (glides.size > 0) {
      for (const { x, y } of stepGlides(glides, now)) corpo.position.set(x, y)
    }
    if (opacidade !== null) {
      const { de, para, inicio, duracao } = opacidade
      const t = duracao <= 0 ? 1 : Math.min(1, Math.max(0, (now - inicio) / duracao))
      raiz.alpha = de + (para - de) * easeOutCubic(t)
      if (t >= 1) {
        opacidade = null
        if (saindo) {
          sumirJa()
          return
        }
      }
    }
    pintarLigacao()
    if (glides.size === 0 && opacidade === null) stopTicking()
  }

  /**
   * Aparece: de dentro da ficha de verdade (mesma cena, com movimento) ou já
   * no lugar. `daFicha` = a ficha está nesta cena; a que ficou em outra não tem
   * de onde ele sair (o ponto dela é de lá), e ele só acende no lugar.
   */
  function nascer(ficha: Token, alvo: GlidePoint, mesmaCena: boolean, daFicha: boolean): void {
    mostrado = true
    saindo = false
    raiz.visible = true
    if (mesmaCena && daFicha && podeAnimar()) {
      const at = syncGlide(glides, DESLIZE, { shown: { x: ficha.x, y: ficha.y }, target: alvo, now: clock(), animate: true })
      corpo.position.set(at.x, at.y)
      animarOpacidade(0, 1, TOKEN_GLIDE_MS)
      return
    }
    glides.delete(DESLIZE)
    corpo.position.set(alvo.x, alvo.y)
    // Movimento reduzido, ou a ficha em outra cena: sem deslize, só a opacidade,
    // curta. Cena que acabou de abrir, ou sem relógio: já aceso.
    if (mesmaCena && motion !== undefined) {
      animarOpacidade(0, 1, FANTASMA_APAGAR_MS)
    } else {
      opacidade = null
      raiz.alpha = 1
    }
  }

  /** Some: apaga onde está (mesma cena) ou na hora (outra cena, sem relógio). */
  function sair(mesmaCena: boolean): void {
    if (!mostrado) return
    if (!mesmaCena || motion === undefined) {
      sumirJa()
      return
    }
    if (saindo) return
    saindo = true
    animarOpacidade(raiz.alpha, 0, FANTASMA_APAGAR_MS)
  }

  function draw(alvo: FantasmaNaCena | null, gridSize: number, sceneId: string, cameraScale: number): void {
    if (desmontado) return
    const mesmaCena = cena === sceneId
    cena = sceneId
    escala = escalaUtil(cameraScale)
    aplicarEscalaDaEtiqueta()
    if (alvo === null) {
      sair(mesmaCena)
      return
    }
    const { ficha } = alvo
    pintarDisco(ficha, gridSize)
    // A ligação sai da ficha de verdade NESTA cena; a que ficou em outra não tem ponta aqui.
    const daFicha = alvo.deOutraCena !== true
    if (daFicha) {
      const meiaCasa = (gridSize * ficha.size) / 2
      if (origem === null || origem.x !== ficha.x || origem.y !== ficha.y || origem.raio !== meiaCasa) {
        origem = { x: ficha.x, y: ficha.y, raio: meiaCasa }
      }
    } else {
      soltarLigacao()
    }
    const destino = { x: alvo.x, y: alvo.y }
    if (!mostrado) {
      nascer(ficha, destino, mesmaCena, daFicha)
    } else {
      if (saindo) {
        // Voltou antes de sumir: acende de novo a partir de onde estava.
        saindo = false
        animarOpacidade(raiz.alpha, 1, FANTASMA_APAGAR_MS)
      }
      const shown = { x: corpo.position.x, y: corpo.position.y }
      const at = syncGlide(glides, DESLIZE, { shown, target: destino, now: clock(), animate: mesmaCena && podeAnimar() })
      corpo.position.set(at.x, at.y)
    }
    pintarAnel()
    pintarLigacao()
    if (glides.size > 0 || opacidade !== null) startTicking()
  }

  function setCameraScale(cameraScale: number): void {
    escala = escalaUtil(cameraScale)
    aplicarEscalaDaEtiqueta()
  }

  function desmontar(): void {
    desmontado = true
    carga += 1
    glides.clear()
    opacidade = null
    stopTicking()
    soltarTexturaPropria()
  }

  return { draw, setCameraScale, desmontar }
}
