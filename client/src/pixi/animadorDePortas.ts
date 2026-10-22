import { Graphics, type Ticker } from 'pixi.js'
import type { DoorState, Wall } from '../types/map'
import { animacaoDePorta, duracaoDoSentido, type AnimacaoDePorta } from '../portas/animacoesDePorta'
import type { EventoDeSomDaPorta } from '../portas/somDePorta'
import { easeOutCubic } from '../transicoes/curvas'
import { drawDoors, type PortaAnimando } from './drawDoors'

/**
 * O que o animador precisa para animar. Sem isto (testes, exportação de
 * imagem), nada anima: a porta vai direto ao estado final, como sempre foi.
 * Mesmo molde de `TokensMotion` (`pixi/tokensRenderer.ts`).
 */
export interface MovimentoDasPortas {
  /** O relógio de quadros do Pixi (`app.ticker`): o animador só se inscreve enquanto alguma porta anima. */
  ticker: Pick<Ticker, 'add' | 'remove'>
  /**
   * `prefers-reduced-motion`, lido quando uma porta vai começar a animar e a
   * cada quadro: a pessoa pode ligar com o app aberto, e a porta no meio do
   * caminho vai na hora ao estado final.
   */
  reducedMotion: () => boolean
  /** Agora, em ms. Padrão `performance.now()`. */
  now?: () => number
  /**
   * Quem toca o som da porta (`portas/somDePorta.ts`): no começo do caminho e
   * ao trancar ou destrancar. Ausente = muda. A cópia das portas por cima do
   * telhado (`player/PlayerView.tsx`) anima junto com a de baixo e fica sem,
   * senão o mesmo rangido tocaria duas vezes.
   */
  som?: (evento: EventoDeSomDaPorta) => void
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

/** O que o animador lembra de cada porta do desenho anterior. */
interface EstadoDaPorta {
  aberta: boolean
  trancada: boolean
}

/**
 * Ponto do caminho em `agora`. A curva é `easeOutCubic`, o
 * `cubic-bezier(0.33, 1, 0.68, 1)` da medalha da ficha (`gr.easePorta` no
 * `theme.ts`): a folha responde ao clique na hora e assenta sem passar do fim
 * (nunca passa de 1 nem volta: sem quique), e mapa e medalha andam no mesmo
 * passo. O refinamento das embutidas mora no desenho (`animacoesDePorta.ts`),
 * não aqui: trocar a curva do tempo descasaria a medalha.
 */
function pontoDoCaminho(caminho: Caminho, agora: number): { progresso: number; terminou: boolean } {
  const t = caminho.duracao <= 0 ? 1 : Math.min(1, Math.max(0, (agora - caminho.inicio) / caminho.duracao))
  return { progresso: caminho.de + (caminho.para - caminho.de) * easeOutCubic(t), terminou: t >= 1 }
}

/** Animação da porta, ou `null`: sem escolha, id que este app não conhece, ou porta secreta (é tracejada aberta ou fechada). */
function animacaoDaPorta(door: DoorState): AnimacaoDePorta | null {
  if (door.secret === true) return null
  return animacaoDePorta(door.animacao)
}

/** Som é enfeite: quem toca falhar não pode parar o desenho da porta. */
function tocarSemQuebrar(som: (evento: EventoDeSomDaPorta) => void, evento: EventoDeSomDaPorta): void {
  try {
    som(evento)
  } catch {
    // Sem som desta vez; a porta anda igual.
  }
}

/** A porta parada sai preenchida: fechada, ou trancada (o cadeado vale mais que a folha). */
function cheia(aberta: boolean, trancada: boolean): boolean {
  return trancada || !aberta
}

function mesmosIds(animando: ReadonlyMap<string, PortaAnimando>, ids: ReadonlySet<string>): boolean {
  if (animando.size !== ids.size) return false
  for (const id of ids) if (!animando.has(id)) return false
  return true
}

/**
 * Cria o animador das portas, com estado fechado por closure — instanciar
 * dentro do setup de cada montagem (PixiCanvas e PlayerView), nunca em escopo
 * de módulo: o `Graphics` guardado morre no desmonte, como o cache de
 * `createTokensRenderer` documenta.
 *
 * Interromper é retomar: a porta que fecha no meio do abrir volta de onde
 * está, no tempo proporcional ao que falta.
 *
 * DESEMPENHO (fatia 22): enquanto uma porta anda, só ELA é repintada a cada
 * quadro. As em movimento vão para um `Graphics` irmão logo acima do das
 * portas (`camada`), e o das portas guarda as paradas, repintado só quando
 * uma porta entra ou sai do movimento. Abrir 1 porta entre 50 custa uma porta
 * por quadro, não 50. Parado, o irmão sai da cena: a árvore fica a de sempre.
 * Sem pai (exportação de imagem, teste) não há onde pôr o irmão, e tudo vai no
 * mesmo `Graphics`, como antes.
 */
export function createAnimadorDePortas(movimento?: MovimentoDasPortas): AnimadorDePortas {
  const relogio = movimento?.now ?? (() => performance.now())
  /** `open` e `locked` de cada porta no último desenho, por id de parede. */
  const estadoAntes = new Map<string, EstadoDaPorta>()
  const caminhos = new Map<string, Caminho>()
  let pintura: Pintura | null = null
  let ligado = false
  /** O irmão das portas em movimento; criado na primeira animação e reaproveitado. */
  let camada: Graphics | null = null
  /** As paredes pintadas na camada (fora do Graphics das paradas), e os ids delas. */
  let naCamada: Wall[] = []
  let idsNaCamada: ReadonlySet<string> = new Set()

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
    // O que falta anda no tempo do sentido NOVO: fechar no meio do abrir usa a duração de fechar.
    const duracao = duracaoDoSentido(animacao, para === 1) * Math.abs(para - de)
    caminhos.set(id, { de, para, inicio: agora, duracao, animacao })
    ligarRelogio()
    if (movimento?.som !== undefined && animacao.som !== undefined) {
      tocarSemQuebrar(movimento.som, { tipo: para === 1 ? 'abrir' : 'fechar', som: animacao.som, duracaoMs: duracao })
    }
  }

  /** Trancar e destrancar soam só na porta que tem som de animação: porta de mapa antigo continua muda. */
  function avisarTranca(door: DoorState): void {
    if (movimento?.som === undefined) return
    const animacao = animacaoDaPorta(door)
    if (animacao === null || animacao.som === undefined) return
    tocarSemQuebrar(movimento.som, { tipo: door.locked ? 'trancar' : 'destrancar' })
  }

  /**
   * O irmão logo acima do Graphics das paradas, no mesmo pai, com o mesmo
   * lugar e a mesma visibilidade (camada oculta esconde as duas). `null` sem pai.
   */
  function camadaAcima(base: Graphics): Graphics | null {
    const pai = base.parent
    if (pai === null) return null
    if (camada === null || camada.destroyed) {
      camada = new Graphics()
      camada.label = 'portasEmMovimento'
      camada.eventMode = 'none'
    }
    if (camada.parent !== pai || pai.getChildIndex(camada) !== pai.getChildIndex(base) + 1) {
      camada.removeFromParent()
      pai.addChildAt(camada, pai.getChildIndex(base) + 1)
    }
    camada.visible = base.visible
    camada.alpha = base.alpha
    camada.zIndex = base.zIndex
    camada.position.copyFrom(base.position)
    camada.scale.copyFrom(base.scale)
    return camada
  }

  /** Nada anda mais: o irmão sai da cena (vazio) e as paradas voltam a ser todas. */
  function soltarCamada(): void {
    naCamada = []
    idsNaCamada = new Set()
    if (camada === null || camada.destroyed) return
    camada.clear()
    camada.removeFromParent()
  }

  /**
   * Pinta as em curso no ponto de `agora`; a que chegou volta a ser desenhada
   * pelo estado. `tudo` = os argumentos mudaram (novo `desenhar`): as paradas
   * são repintadas também. No quadro do relógio, só a camada.
   */
  function pintar(agora: number, tudo: boolean): void {
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
    const acima = animando.size === 0 ? null : camadaAcima(graphics)
    if (acima === null) {
      // Nada andando, ou Graphics sem pai: todas no mesmo, como sempre foi.
      drawDoors(graphics, walls, selectedWallId, cameraScale, rendererResolution, toCross, animando)
      soltarCamada()
    } else {
      if (tudo || !mesmosIds(animando, idsNaCamada)) {
        const paradas: Wall[] = []
        const andando: Wall[] = []
        for (const wall of walls) (animando.has(wall.id) ? andando : paradas).push(wall)
        drawDoors(graphics, paradas, selectedWallId, cameraScale, rendererResolution, toCross)
        naCamada = andando
        idsNaCamada = new Set(animando.keys())
      }
      drawDoors(acima, naCamada, selectedWallId, cameraScale, rendererResolution, toCross, animando)
    }
    if (caminhos.size === 0) desligarRelogio()
  }

  function quadro(): void {
    if (pintura === null || pintura.graphics.destroyed) {
      caminhos.clear()
      desligarRelogio()
      soltarCamada()
      return
    }
    // Movimento reduzido ligado no meio do caminho: a porta vai na hora ao estado final.
    if (!podeAnimar()) caminhos.clear()
    pintar(relogio(), false)
  }

  function desenhar(graphics: Graphics, walls: Wall[], selectedWallId: string | null = null, cameraScale = 1, rendererResolution = 1, toCross?: ReadonlySet<string>): void {
    const agora = relogio()
    const presentes = new Set<string>()
    for (const wall of walls) {
      const door = wall.door
      if (door === null) continue
      presentes.add(wall.id)
      const antes = estadoAntes.get(wall.id)
      estadoAntes.set(wall.id, { aberta: door.open, trancada: door.locked })
      if (antes === undefined) continue
      if (antes.aberta !== door.open) {
        // Trancada é cheia aberta ou fechada (`drawDoors`): se a cara não muda, não há caminho a andar.
        if (cheia(antes.aberta, antes.trancada) === cheia(door.open, door.locked)) caminhos.delete(wall.id)
        else iniciarCaminho(wall.id, door, agora)
      }
      if (antes.trancada !== door.locked) avisarTranca(door)
    }
    // Porta que sumiu (apagada, virou parede, camada oculta, fora do recorte do
    // jogador): esquece. Voltando, é "primeira vez" e não anima.
    for (const id of estadoAntes.keys()) {
      if (presentes.has(id)) continue
      estadoAntes.delete(id)
      caminhos.delete(id)
    }
    if (caminhos.size === 0) desligarRelogio()
    pintura = { graphics, walls, selectedWallId, cameraScale, rendererResolution, toCross }
    pintar(agora, true)
  }

  function cancelar(): void {
    desligarRelogio()
    caminhos.clear()
    estadoAntes.clear()
    pintura = null
    naCamada = []
    idsNaCamada = new Set()
    if (camada !== null && !camada.destroyed) camada.destroy()
    camada = null
  }

  return { desenhar, cancelar }
}
