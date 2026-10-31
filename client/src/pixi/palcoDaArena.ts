import { Application, Container, Graphics, Sprite, Texture, type Ticker } from 'pixi.js'
import type { ConsultaDaFicha } from '../components/batalha/MiraDoGolpe'
import { CASA_DA_ARENA, type PalcoDaArenaProps } from '../lib/arena/tipos'
import { tokenRadiusOf } from '../lib/doorReach'
import type { Token } from '../types/map'
import { criarGradeDaBatalha } from './gradeDaBatalha'
import { ALTURA_DO_CORPO_EM_CASAS, createJudgeDoMapa } from './judgeDoMapa'
import { snapToPhysicalPixel } from './pixelAlign'
import { currentRendererResolution, watchDevicePixelRatio } from './rendererResolution'
import { createDebouncedTask, syncWorldTextResolution } from './textResolution'
import { findTokenAt } from './tokenInteraction'
import { createTokensRenderer } from './tokensRenderer'
import { fitCamera, freeArea, panBy, zoomAt, type Bounds, type Camera } from './world'

/**
 * O PALCO DA ARENA DE TESTES (Escritor B da fase 1, seção 3b "D1" de
 * docs/planos/batalha-arena-de-testes-plano.md): um Pixi próprio e leve, sem
 * store, montado só com peças que não leem o mapa:
 *
 *   stage
 *     └ world (câmera: pan no vazio, zoom na roda)
 *         ├ chão (um retângulo do tamanho da grade)
 *         ├ grade da batalha (`gradeDaBatalha.ts`)
 *         ├ fichas (`tokensRenderer.ts`: anel e pulso da vez, vida, selos, foto da forma)
 *         └ Judge (`judgeDoMapa.ts`: árbitro, ou o corpo do boneco)
 *
 * O RELÓGIO DE QUADROS SÓ ANDA COM ANIMAÇÃO: o app nasce parado
 * (`autoStart: false`) e as peças recebem um relógio que liga o `app.ticker`
 * enquanto alguém está inscrito (pulso da vez, ficha na mão, Judge respirando,
 * foto ainda carregando) e o desliga no último que sai. O resto (desenho
 * novo, pan, zoom) pede UM quadro (`pedirQuadro`).
 *
 * Duas telas Pixi ao mesmo tempo: com o mundo do livro aberto por cima do
 * editor, o `PixiCanvas` do editor continua vivo atrás (o relógio dele é dele;
 * pausá-lo é mexer no editor, fora deste palco). Este palco, parado, não custa
 * quadro nenhum.
 */

/** O que o palco desenha: as props sem as funções. */
export type DadosDoPalco = Omit<PalcoDaArenaProps, 'onMover' | 'onTocarFicha' | 'onConsulta'>

export interface OpcoesDoPalco {
  /** As props de agora (lidas a cada `atualizar` e ao ficar pronto). */
  dados: () => DadosDoPalco
  onMover: (tokenId: string, x: number, y: number) => void
  onTocarFicha: (tokenId: string) => void
  /** O WebGL não subiu: o palco fica vazio. */
  aoFalhar: (erro: unknown) => void
  /** O contexto WebGL caiu: quem montou troca este palco por um novo. */
  aoPerderContexto: () => void
  /**
   * O que flutua por cima do palco (faixa da ordem, menu da vez, placar), em px
   * relativos ao canvas: o enquadramento põe a grade na parte que sobra
   * (`freeArea`). Ausente = o canvas inteiro.
   */
  obstaculos?: () => Bounds[]
}

export interface PalcoPixiDaArena {
  /** As props mudaram: redesenha (antes de pronto, só guarda para a montagem). */
  atualizar: () => void
  /** Onde a ficha está na tela, em px da janela; `null` antes de pronto, depois de destruído ou ficha desconhecida. */
  readonly consulta: ConsultaDaFicha
  destruir: () => void
}

/** Px de tela em volta da grade quando ela é enquadrada. */
const MARGEM_DO_ENQUADRE = 48
/** Px de tela que o ponteiro anda antes de o toque virar arrasto (abaixo disso é clique). */
const LIMIAR_DO_ARRASTO = 4
/** Teto da espera pela foto das fichas com o relógio ligado (a que não carrega fica vazia, sem segurar o relógio). */
const PRAZO_DAS_FOTOS_MS = 3000
const COR_DO_FUNDO = 0x141417
const COR_DO_CHAO = 0x3b3934
const COR_DA_BORDA = 0x5a564d
const BORDA_DO_CHAO_PX = 2

/** `prefers-reduced-motion` do sistema: ligado, nada anima (anel parado, Judge na pose fixa). */
function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/** Algum sprite de foto ainda sem textura (a carga é assíncrona e não pede quadro sozinha)? */
function temFotoCarregando(no: Container): boolean {
  for (const filho of no.children) {
    if (filho instanceof Sprite && filho.visible && filho.texture === Texture.EMPTY) return true
    if (filho.children.length > 0 && temFotoCarregando(filho)) return true
  }
  return false
}

function limitar(valor: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, valor))
}

/** O centro da casa sob (x, y), dentro da grade. */
function centroDaCasa(x: number, y: number, colunas: number, linhas: number): { x: number; y: number } {
  const coluna = limitar(Math.floor(x / CASA_DA_ARENA), 0, Math.max(0, colunas - 1))
  const linha = limitar(Math.floor(y / CASA_DA_ARENA), 0, Math.max(0, linhas - 1))
  return { x: coluna * CASA_DA_ARENA + CASA_DA_ARENA / 2, y: linha * CASA_DA_ARENA + CASA_DA_ARENA / 2 }
}

type Gesto =
  | { tipo: 'ficha'; pointerId: number; tokenId: string; inicioX: number; inicioY: number; difX: number; difY: number; movido: boolean }
  | { tipo: 'pan'; pointerId: number; ultimoX: number; ultimoY: number }

export function criarPalcoDaArena(el: HTMLElement, opcoes: OpcoesDoPalco): PalcoPixiDaArena {
  const app = new Application()
  let destruido = false
  let desmontar: (() => void) | null = null
  let atualizarMontado: (() => void) | null = null
  let consultaMontada: ConsultaDaFicha | null = null

  const montar = () => {
    app.canvas.style.display = 'block'
    app.canvas.style.touchAction = 'none'
    el.appendChild(app.canvas)
    const perderContexto = () => {
      if (!destruido) opcoes.aoPerderContexto()
    }
    app.canvas.addEventListener('webglcontextlost', perderContexto)

    // Os cliques vêm do DOM (abaixo), testados à mão no mundo: o Pixi não procura alvo.
    app.stage.eventMode = 'none'
    const world = new Container()
    const chao = new Graphics()
    const grade = criarGradeDaBatalha()
    const fichas = new Container()
    app.stage.addChild(world)

    // ── Relógio: o ticker do app só roda com alguém inscrito ──
    const inscritos = new Set<unknown>()
    let quadroPedido = 0
    const pedirQuadro = () => {
      if (destruido || app.ticker.started || quadroPedido !== 0) return
      quadroPedido = requestAnimationFrame(() => {
        quadroPedido = 0
        if (!destruido) app.render()
      })
    }
    const acertarRelogio = () => {
      if (inscritos.size > 0 && !app.ticker.started) app.ticker.start()
      else if (inscritos.size === 0 && app.ticker.started) {
        app.ticker.stop()
        // O último quadro da animação fica na tela.
        pedirQuadro()
      }
      el.dataset.relogio = app.ticker.started ? 'ligado' : 'parado'
    }
    const relogio: Pick<Ticker, 'add' | 'remove'> = {
      add(fn, contexto, prioridade) {
        app.ticker.add(fn, contexto, prioridade)
        inscritos.add(fn)
        acertarRelogio()
        return app.ticker
      },
      remove(fn, contexto) {
        app.ticker.remove(fn, contexto)
        inscritos.delete(fn)
        acertarRelogio()
        return app.ticker
      },
    }

    const tokensRenderer = createTokensRenderer({ ticker: relogio, reducedMotion: prefersReducedMotion })
    const judge = createJudgeDoMapa({ movimento: { ticker: relogio, reducedMotion: prefersReducedMotion }, aoMudar: pedirQuadro })
    world.addChild(chao, grade.camada, fichas, judge.camada)

    // A foto da ficha chega depois do desenho: o relógio fica ligado até ela chegar (ou o prazo vencer).
    let prazoDasFotos = 0
    const vigiarFotos = () => {
      if (!temFotoCarregando(fichas) || performance.now() > prazoDasFotos) relogio.remove(vigiarFotos)
    }
    const esperarFotos = () => {
      if (!temFotoCarregando(fichas)) return
      prazoDasFotos = performance.now() + PRAZO_DAS_FOTOS_MS
      relogio.add(vigiarFotos)
    }

    // ── Câmera ──
    let camera: Camera = { x: 0, y: 0, scale: 1 }
    /** A pessoa já mexeu (pan ou zoom): redimensionar não enquadra de novo. */
    let cameraMexida = false
    let colunas = 0
    let linhas = 0

    const sincronizarTextos = () => {
      if (destruido) return
      el.dataset.textResolution = String(syncWorldTextResolution(world, camera.scale, app.renderer.resolution))
      pedirQuadro()
    }
    const tarefaDosTextos = createDebouncedTask(sincronizarTextos)

    const aplicarCamera = () => {
      const res = app.renderer.resolution
      world.position.set(snapToPhysicalPixel(camera.x, res), snapToPhysicalPixel(camera.y, res))
      world.scale.set(camera.scale)
      const { width, height } = app.screen
      const minX = -camera.x / camera.scale
      const minY = -camera.y / camera.scale
      const maxX = (width - camera.x) / camera.scale
      const maxY = (height - camera.y) / camera.scale
      grade.ajustarAVista({ left: minX, top: minY, right: maxX, bottom: maxY }, camera.scale, res)
      judge.ajustarAVista({ minX, minY, maxX, maxY })
      tokensRenderer.setCameraScale(camera.scale)
      pedirQuadro()
    }

    const enquadrar = () => {
      const { width, height } = app.screen
      if (width <= 0 || height <= 0 || colunas <= 0 || linhas <= 0) return
      // Na parte que a faixa, o menu e o placar não cobrem: a ficha do Lado A não nasce embaixo do menu.
      const livre = freeArea({ width, height }, opcoes.obstaculos?.() ?? [])
      const naArea = fitCamera(
        { minX: 0, minY: 0, maxX: colunas * CASA_DA_ARENA, maxY: linhas * CASA_DA_ARENA },
        { width: livre.maxX - livre.minX, height: livre.maxY - livre.minY },
        MARGEM_DO_ENQUADRE,
      )
      camera = { scale: naArea.scale, x: naArea.x + livre.minX, y: naArea.y + livre.minY }
      aplicarCamera()
      tarefaDosTextos.schedule()
    }

    // ── Desenho ──
    let dados = opcoes.dados()
    /** As fichas de agora, cópia mutável (o renderer e o toque pedem `Token[]`). */
    let fichasDeAgora: Token[] = []
    /** A ficha na mão: desenhada aqui até soltar. */
    let naMao: { tokenId: string; x: number; y: number } | null = null

    const desenharFichas = () => {
      fichasDeAgora = dados.tokens.map((token) => (naMao !== null && token.id === naMao.tokenId ? { ...token, x: naMao.x, y: naMao.y } : token))
      const nomesNovos = tokensRenderer.draw(
        fichas,
        fichasDeAgora,
        CASA_DA_ARENA,
        null,
        camera.scale,
        undefined,
        undefined,
        undefined,
        dados.vidas,
        undefined,
        dados.vezTokenId,
        dados.fotoDaForma,
        dados.selos,
      )
      if (nomesNovos > 0) sincronizarTextos()
      esperarFotos()
      pedirQuadro()
    }

    const desenharJudge = () => {
      judge.definir({ judge: dados.judge, tamanhoDaCasa: CASA_DA_ARENA, alvo: dados.judgeAlvo })
      judge.lerFila(dados.gestoDoJudge)
      pedirQuadro()
    }

    const desenharChao = () => {
      const largura = colunas * CASA_DA_ARENA
      const altura = linhas * CASA_DA_ARENA
      chao.clear().rect(0, 0, largura, altura).fill({ color: COR_DO_CHAO }).stroke({ width: BORDA_DO_CHAO_PX, color: COR_DA_BORDA })
      grade.definir(true, { width: colunas, height: linhas, grid: CASA_DA_ARENA, gridShape: 'square' })
    }

    const atualizar = () => {
      dados = opcoes.dados()
      if (dados.grade.colunas !== colunas || dados.grade.linhas !== linhas) {
        // Grade nova (sessão nova ou trocada): chão novo e enquadra de novo.
        colunas = dados.grade.colunas
        linhas = dados.grade.linhas
        desenharChao()
        cameraMexida = false
        enquadrar()
      }
      desenharFichas()
      desenharJudge()
    }
    atualizarMontado = atualizar

    // ── Consulta (a mira e os efeitos) ──
    consultaMontada = (tokenId) => {
      if (destruido) return null
      const caixa = app.canvas.getBoundingClientRect()
      if (dados.bonecoTokenId !== null && tokenId === dados.bonecoTokenId) {
        // O Judge é o corpo do boneco: o meio do corpo, dos pés até o alto da cabeça.
        const corpo = judge.posicao()
        if (corpo !== null) {
          const meio = corpo.y + CASA_DA_ARENA / 2 - ((ALTURA_DO_CORPO_EM_CASAS + 1) * CASA_DA_ARENA) / 2
          return { x: caixa.left + camera.x + corpo.x * camera.scale, y: caixa.top + camera.y + meio * camera.scale, raio: (CASA_DA_ARENA / 2) * camera.scale }
        }
      }
      const token = dados.tokens.find((candidato) => candidato.id === tokenId)
      if (token === undefined) return null
      return { x: caixa.left + camera.x + token.x * camera.scale, y: caixa.top + camera.y + token.y * camera.scale, raio: tokenRadiusOf(token, CASA_DA_ARENA) * camera.scale }
    }

    // ── Toque: arrastar ficha, pan no vazio, clique na ficha, roda ──
    const pontoNaTela = (evento: { clientX: number; clientY: number }) => {
      const caixa = app.canvas.getBoundingClientRect()
      return { x: evento.clientX - caixa.left, y: evento.clientY - caixa.top }
    }
    const noMundo = (tela: { x: number; y: number }) => ({ x: (tela.x - camera.x) / camera.scale, y: (tela.y - camera.y) / camera.scale })

    /** A ficha sob o ponto: no modo boneco o corpo do Judge vem primeiro (ele está por cima). */
    const fichaSob = (ponto: { x: number; y: number }): Token | null => {
      const boneco = dados.bonecoTokenId
      if (boneco !== null && judge.acertou(ponto)) {
        const doBoneco = fichasDeAgora.find((token) => token.id === boneco)
        if (doBoneco !== undefined) return doBoneco
      }
      return findTokenAt(fichasDeAgora, ponto, CASA_DA_ARENA)
    }

    let gesto: Gesto | null = null

    const aoApertar = (evento: PointerEvent) => {
      if (evento.button !== 0 || gesto !== null) return
      const tela = pontoNaTela(evento)
      const mundo = noMundo(tela)
      const ficha = fichaSob(mundo)
      app.canvas.setPointerCapture(evento.pointerId)
      if (ficha !== null) {
        gesto = { tipo: 'ficha', pointerId: evento.pointerId, tokenId: ficha.id, inicioX: tela.x, inicioY: tela.y, difX: ficha.x - mundo.x, difY: ficha.y - mundo.y, movido: false }
      } else {
        gesto = { tipo: 'pan', pointerId: evento.pointerId, ultimoX: tela.x, ultimoY: tela.y }
        app.canvas.style.cursor = 'grabbing'
      }
    }

    const aoMover = (evento: PointerEvent) => {
      const tela = pontoNaTela(evento)
      if (gesto === null) {
        app.canvas.style.cursor = fichaSob(noMundo(tela)) === null ? '' : 'grab'
        return
      }
      if (evento.pointerId !== gesto.pointerId) return
      if (gesto.tipo === 'pan') {
        camera = panBy(camera, tela.x - gesto.ultimoX, tela.y - gesto.ultimoY)
        gesto.ultimoX = tela.x
        gesto.ultimoY = tela.y
        cameraMexida = true
        aplicarCamera()
        return
      }
      if (!gesto.movido) {
        if (Math.hypot(tela.x - gesto.inicioX, tela.y - gesto.inicioY) < LIMIAR_DO_ARRASTO) return
        // Só o primeiro passo que anda levanta a ficha: clique de mira não pulsa.
        gesto.movido = true
        tokensRenderer.levantar(gesto.tokenId)
        app.canvas.style.cursor = 'grabbing'
      }
      const mundo = noMundo(tela)
      naMao = { tokenId: gesto.tokenId, x: mundo.x + gesto.difX, y: mundo.y + gesto.difY }
      if (gesto.tokenId === dados.bonecoTokenId) judge.arrastar({ x: naMao.x, y: naMao.y })
      desenharFichas()
    }

    /** Fim do gesto: `soltou` = o dedo saiu (cancelado = a ficha volta para onde estava). */
    const terminar = (evento: PointerEvent, soltou: boolean) => {
      if (gesto === null || evento.pointerId !== gesto.pointerId) return
      const fim = gesto
      gesto = null
      if (app.canvas.hasPointerCapture(evento.pointerId)) app.canvas.releasePointerCapture(evento.pointerId)
      app.canvas.style.cursor = ''
      if (fim.tipo === 'pan') return
      if (!fim.movido) {
        if (soltou) opcoes.onTocarFicha(fim.tokenId)
        return
      }
      const solta = naMao
      naMao = null
      tokensRenderer.levantar(null)
      judge.arrastar(null)
      // A store responde antes do próximo quadro: este desenho (do lugar antigo) nunca chega à tela se ela aceitar.
      if (soltou && solta !== null) {
        const casa = centroDaCasa(solta.x, solta.y, colunas, linhas)
        opcoes.onMover(fim.tokenId, casa.x, casa.y)
      }
      desenharFichas()
    }
    const aoSoltar = (evento: PointerEvent) => terminar(evento, true)
    const aoCancelar = (evento: PointerEvent) => terminar(evento, false)

    const aoRodar = (evento: WheelEvent) => {
      evento.preventDefault()
      camera = zoomAt(camera, pontoNaTela(evento), evento.deltaY)
      cameraMexida = true
      aplicarCamera()
      tarefaDosTextos.schedule()
    }

    /** Duplo clique no vazio: enquadra a grade de novo. */
    const aoDuploClique = (evento: MouseEvent) => {
      if (fichaSob(noMundo(pontoNaTela(evento))) !== null) return
      cameraMexida = false
      enquadrar()
    }

    app.canvas.addEventListener('pointerdown', aoApertar)
    app.canvas.addEventListener('pointermove', aoMover)
    app.canvas.addEventListener('pointerup', aoSoltar)
    app.canvas.addEventListener('pointercancel', aoCancelar)
    app.canvas.addEventListener('wheel', aoRodar, { passive: false })
    app.canvas.addEventListener('dblclick', aoDuploClique)

    // ── Tamanho e densidade ──
    const observador = new ResizeObserver(() => {
      if (destruido) return
      app.resize()
      if (cameraMexida) aplicarCamera()
      else enquadrar()
    })
    observador.observe(el)
    const pararDeVigiarDensidade = watchDevicePixelRatio((resolucao) => {
      if (destruido) return
      app.renderer.resolution = resolucao
      app.resize()
      aplicarCamera()
      tarefaDosTextos.flush()
    })

    atualizar()

    desmontar = () => {
      if (quadroPedido !== 0) cancelAnimationFrame(quadroPedido)
      quadroPedido = 0
      tarefaDosTextos.cancel()
      observador.disconnect()
      pararDeVigiarDensidade()
      app.canvas.removeEventListener('pointerdown', aoApertar)
      app.canvas.removeEventListener('pointermove', aoMover)
      app.canvas.removeEventListener('pointerup', aoSoltar)
      app.canvas.removeEventListener('pointercancel', aoCancelar)
      app.canvas.removeEventListener('wheel', aoRodar)
      app.canvas.removeEventListener('dblclick', aoDuploClique)
      app.canvas.removeEventListener('webglcontextlost', perderContexto)
      app.ticker.remove(vigiarFotos)
      tokensRenderer.cancelarAnimacoes()
      // O Judge sai do relógio antes do app (a folha fica no cache do `Assets` para o próximo palco).
      judge.destruir()
      app.ticker.stop()
      app.destroy({ removeView: true }, { children: true }) // `true` limparia o TexturePool GLOBAL e quebraria Text do editor vivo atrás
    }
  }

  app
    .init({
      // SÓ WebGL, como o editor e o jogador: sem ele o init lança e o palco avisa.
      preference: ['webgl'],
      backgroundColor: COR_DO_FUNDO,
      resizeTo: el,
      resolution: currentRendererResolution(),
      autoDensity: true,
      antialias: true,
      // O relógio só liga com animação (acima).
      autoStart: false,
    })
    .then(() => {
      if (destruido) {
        app.destroy({ removeView: true }, { children: true })
        return
      }
      montar()
    })
    .catch((erro: unknown) => {
      if (!destruido) opcoes.aoFalhar(erro)
    })

  return {
    atualizar: () => {
      if (!destruido) atualizarMontado?.()
    },
    consulta: (tokenId) => consultaMontada?.(tokenId) ?? null,
    destruir: () => {
      if (destruido) return
      destruido = true
      desmontar?.()
      desmontar = null
      atualizarMontado = null
      consultaMontada = null
    },
  }
}
