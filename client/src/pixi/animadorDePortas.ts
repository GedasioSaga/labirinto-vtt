import type { Graphics, Ticker } from 'pixi.js'
import type { DoorState, Wall } from '../types/map'
import { animacaoDePorta, type AnimacaoDePorta } from '../portas/animacoesDePorta'
import { easeInOutCubic } from '../transicoes/curvas'
import { drawDoors, type PortaAnimando } from './drawDoors'

/**
 * O que o animador precisa para animar. Sem isto (testes, exportação de
 * imagem), nada anima: a porta vai direto ao estado final, como sempre foi.
 * Mesmo molde de `TokensMotion` (`pixi/tokensRenderer.ts`).
 */
export interface MovimentoDasPortas {
  /** O relógio de quadros do Pixi (`app.ticker`): o animador só se inscreve enquanto alguma porta anima. */
  ticker: Pick<Ticker, 'add' | 'remove'>
  /** `prefers-reduced-motion`, lido quando uma porta vai começar a animar: a pessoa pode mudar com o app aberto. */
  reducedMotion: () => boolean
  /** Agora, em ms. Padrão `performance.now()`. */
  now?: () => number
}

export interface AnimadorDePortas {
  /**
   * Mesmos parâmetros de `drawDoors`. Compara cada porta com a do desenho
   * anterior: a que trocou `open` e tem animação conhecida anda de um estado
   * ao outro no relógio; o resto sai como sempre. A primeira vez que um id
   * aparece (mapa abrindo, porta saindo da névoa ou de camada oculta) não anima.
   */
  desenhar: (graphics: Graphics, walls: Wall[], selectedWallId?: string | null, cameraScale?: number, rendererResolution?: number, toCross?: ReadonlySet<string>) => void
  /** Desmonte: sai do relógio e esquece toda animação em curso. */
  cancelar: () => void
}

/** Uma porta indo de `de` a `para` (0 = fechada, 1 = aberta). */
interface Caminho {
  de: number
  para: 0 | 1
  inicio: number
  duracao: number
  animacao: AnimacaoDePorta
}

/** Os argumentos do último `desenhar`: o relógio repinta com eles a cada quadro. */
interface Pintura {
  graphics: Graphics
  walls: Wall[]
  selectedWallId: string | null
  cameraScale: number
  rendererResolution: number
  toCross: ReadonlySet<string> | undefined
}

/**
 * Ponto do caminho em `agora`. A curva é a de movimento NA tela (acelera e
 * assenta), a mesma `easeInOutCubic` das transições (`transicoes/curvas.ts`).
 */
function pontoDoCaminho(caminho: Caminho, agora: number): { progresso: number; terminou: boolean } {
  const t = caminho.duracao <= 0 ? 1 : Math.min(1, Math.max(0, (agora - caminho.inicio) / caminho.duracao))
  return { progresso: caminho.de + (caminho.para - caminho.de) * easeInOutCubic(t), terminou: t >= 1 }
}

/** Animação da porta, ou `null`: sem escolha, id que este app não conhece, ou porta secreta (é tracejada aberta ou fechada). */
function animacaoDaPorta(door: DoorState): AnimacaoDePorta | null {
  if (door.secret === true) return null
  return animacaoDePorta(door.animacao)
}

/**
 * Cria o animador das portas, com estado fechado por closure — instanciar
 * dentro do setup de cada montagem (PixiCanvas e PlayerView), nunca em escopo
 * de módulo: o `Graphics` guardado morre no desmonte, como o cache de
 * `createTokensRenderer` documenta.
 *
 * Interromper é retomar: a porta que fecha no meio do abrir volta de onde
 * está, no tempo proporcional ao que falta.
 */
export function createAnimadorDePortas(movimento?: MovimentoDasPortas): AnimadorDePortas {
  const relogio = movimento?.now ?? (() => performance.now())
  /** `open` de cada porta no último desenho, por id de parede. */
  const abertaAntes = new Map<string, boolean>()
  const caminhos = new Map<string, Caminho>()
  let pintura: Pintura | null = null
  let ligado = false

  function podeAnimar(): boolean {
    return movimento !== undefined && !movimento.reducedMotion()
  }

  function ligarRelogio(): void {
    if (ligado || movimento === undefined) return
    ligado = true
    movimento.ticker.add(quadro)
  }

  function desligarRelogio(): void {
    if (!ligado || movimento === undefined) return
    ligado = false
    movimento.ticker.remove(quadro)
  }

  function iniciarCaminho(id: string, door: DoorState, agora: number): void {
    const animacao = animacaoDaPorta(door)
    const anterior = caminhos.get(id)
    if (animacao === null || !podeAnimar()) {
      caminhos.delete(id)
      return
    }
    const para = door.open ? 1 : 0
    const de = anterior === undefined ? 1 - para : pontoDoCaminho(anterior, agora).progresso
    caminhos.set(id, { de, para, inicio: agora, duracao: animacao.duracaoMs * Math.abs(para - de), animacao })
    ligarRelogio()
  }

  /** Repinta todas as portas com as em curso no ponto de `agora`; a que chegou volta a ser desenhada pelo estado. */
  function pintar(agora: number): void {
    if (pintura === null) return
    const animando = new Map<string, PortaAnimando>()
    for (const [id, caminho] of caminhos) {
      const { progresso, terminou } = pontoDoCaminho(caminho, agora)
      if (terminou) {
        caminhos.delete(id)
        continue
      }
      animando.set(id, { animacao: caminho.animacao, progresso, abrindo: caminho.para === 1 })
    }
    const { graphics, walls, selectedWallId, cameraScale, rendererResolution, toCross } = pintura
    drawDoors(graphics, walls, selectedWallId, cameraScale, rendererResolution, toCross, animando)
    if (caminhos.size === 0) desligarRelogio()
  }

  function quadro(): void {
    if (pintura === null || pintura.graphics.destroyed) {
      caminhos.clear()
      desligarRelogio()
      return
    }
    pintar(relogio())
  }

  function desenhar(graphics: Graphics, walls: Wall[], selectedWallId: string | null = null, cameraScale = 1, rendererResolution = 1, toCross?: ReadonlySet<string>): void {
    const agora = relogio()
    const presentes = new Set<string>()
    for (const wall of walls) {
      const door = wall.door
      if (door === null) continue
      presentes.add(wall.id)
      const antes = abertaAntes.get(wall.id)
      abertaAntes.set(wall.id, door.open)
      if (antes !== undefined && antes !== door.open) iniciarCaminho(wall.id, door, agora)
    }
    // Porta que sumiu (apagada, virou parede, camada oculta, fora do recorte do
    // jogador): esquece. Voltando, é "primeira vez" e não anima.
    for (const id of abertaAntes.keys()) {
      if (presentes.has(id)) continue
      abertaAntes.delete(id)
      caminhos.delete(id)
    }
    pintura = { graphics, walls, selectedWallId, cameraScale, rendererResolution, toCross }
    pintar(agora)
  }

  function cancelar(): void {
    desligarRelogio()
    caminhos.clear()
    abertaAntes.clear()
    pintura = null
  }

  return { desenhar, cancelar }
}
