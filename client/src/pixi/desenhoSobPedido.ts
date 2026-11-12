/**
 * DESENHO SOB PEDIDO (O10 da caça de 12/11/2026; é a fatia F6 do plano de
 * otimização de 27/10, `docs/planos/otimizacao-200x200-2026-10-27.md`).
 *
 * Parado, o Pixi redesenhava a tela inteira a cada tique: 100% dos quadros, de
 * 104 a 236 ms de CPU por segundo, sem nada mudar na tela. Aqui o relógio
 * continua batendo (quem anima por ele continua andando), mas o DESENHO da
 * tela só acontece quando há motivo:
 *
 * 1. A CENA MUDOU: qualquer nó mexido (posição, escala, alpha, tint, visível,
 *    filho novo ou tirado, desenho de Graphics, textura de Sprite, texto). É o
 *    que o próprio Pixi anota para o próximo desenho (`RenderGroup`), e cobre
 *    deslize de ficha, câmera, pulso, laser, sinal, porta, telhado...
 * 2. UM DESENHO FORA DA TELA (`renderer.render` com `target`): o mapa de luz
 *    (com o tremor da tocha), os campos da penumbra, a vitrine das texturas, a
 *    foto do telhado. A tela lê essas texturas, então desenha de novo.
 * 3. ALGUÉM ANIMANDO PELO `relogio` (chama, água, nuvem, neblina, partícula,
 *    fogo, porta, telhado, Judge, impacto): com um inscrito, todo quadro
 *    desenha, e mais um quando o último sai (a pose final).
 * 4. `pedir()`: quem muda o que o Pixi não vê (um uniform de shader, como a
 *    troca de 200 ms da penumbra) pede o quadro.
 * 5. TAMANHO OU DENSIDADE DA TELA mudou.
 * 6. O PULSO: um desenho a cada `PULSO_DO_DESENHO_MS`, mesmo parado. É a rede
 *    de segurança para o que nenhum dos de cima vê (pixel novo subido numa
 *    textura que já estava na tela, `source.update()`): no pior caso a tela
 *    atrasa meio segundo, em vez de ficar parada para sempre.
 *
 * Quem desenha é o mesmo `app.render()` de sempre, no mesmo lugar do tique
 * (prioridade baixa, depois de todos os ouvintes do quadro).
 */
import { UPDATE_PRIORITY, type Application, type RenderGroup, type Ticker } from 'pixi.js'

/** De quanto em quanto tempo a tela desenha mesmo parada (a rede de segurança). */
export const PULSO_DO_DESENHO_MS = 500

export interface MedidasDoDesenho {
  /** Tiques do relógio desde a montagem. */
  quadros: number
  /** Tiques que desenharam a tela. */
  desenhados: number
  /** Desenhos só pelo pulso (nada mais pediu). */
  pulsos: number
}

export interface DesenhoSobPedido {
  /** O relógio para quem anima: o mesmo `add`/`remove` do ticker; com alguém inscrito, todo quadro desenha. */
  readonly relogio: Pick<Ticker, 'add' | 'remove'>
  readonly medidas: MedidasDoDesenho
  /** Desenha no próximo quadro: para o que o Pixi não vê mudar (uniform de shader). */
  pedir(): void
  /** Devolve o desenho de todo quadro ao app (antes do `app.destroy`). */
  destruir(): void
}

/** A cena mudou desde o último desenho? O que o Pixi anotou para refazer, neste grupo de render e nos de dentro. */
export function grupoMudou(grupo: RenderGroup): boolean {
  if (grupo.structureDidChange || grupo.childrenRenderablesToUpdate.index > 0) return true
  const porProfundidade = grupo.childrenToUpdate
  for (const profundidade in porProfundidade) {
    if (porProfundidade[Number(profundidade)].index > 0) return true
  }
  for (const filho of grupo.renderGroupChildren) if (grupoMudou(filho)) return true
  return false
}

/**
 * O app desenha de verdade? O `Application` falso dos testes (jsdom, sem GPU)
 * não tem `render` nem os runners do renderer, e o teste roda os quadros à mão.
 */
function appDesenhavel(app: Application): boolean {
  const runners: Partial<Application['renderer']['runners']> | undefined = app.renderer.runners
  return typeof app.render === 'function' && typeof app.renderer.on === 'function' && runners?.postrender !== undefined && runners.resolutionChange !== undefined
}

/** Sem como desenhar sob pedido: o ticker de sempre, e nada muda. */
function desenhoDeTodoQuadro(app: Application): DesenhoSobPedido {
  return {
    relogio: app.ticker,
    medidas: { quadros: 0, desenhados: 0, pulsos: 0 },
    pedir() {},
    destruir() {},
  }
}

/**
 * Tira o desenho de todo quadro do ticker do `app` e põe no lugar o desenho
 * sob pedido. Chame logo depois do `app.init`, antes de qualquer outro
 * ouvinte: o desenho fica no mesmo lugar da fila (o primeiro de prioridade baixa).
 */
export function criarDesenhoSobPedido(app: Application, pulsoMs: number = PULSO_DO_DESENHO_MS): DesenhoSobPedido {
  if (!appDesenhavel(app)) return desenhoDeTodoQuadro(app)
  const { ticker, renderer, stage } = app
  const medidas: MedidasDoDesenho = { quadros: 0, desenhados: 0, pulsos: 0 }
  const inscritos = new Set<unknown>()
  // O primeiro quadro desenha.
  let pedido = true
  let desenhando = false
  let ultimoDesenho = Number.NEGATIVE_INFINITY
  let destruido = false

  // Os runners do renderer chamam o método de mesmo nome deste objeto.
  const ouvinte = {
    /** Desenho fora da tela (textura de render): a tela lê a textura, então desenha. O do próprio quadro não conta. */
    postrender(opcoes: { target?: unknown }): void {
      if (!desenhando && opcoes.target !== renderer.view.renderTarget) pedido = true
    },
    resolutionChange(): void {
      pedido = true
    },
  }
  const aoRedimensionar = (): void => {
    pedido = true
  }

  function quadro(): void {
    medidas.quadros += 1
    const agora = performance.now()
    // Antes do primeiro desenho o palco ainda não tem grupo de render: desenha.
    const grupo: RenderGroup | null | undefined = stage.renderGroup
    const temMotivo = pedido || inscritos.size > 0 || grupo === null || grupo === undefined || grupoMudou(grupo)
    if (!temMotivo && agora - ultimoDesenho < pulsoMs) return
    if (!temMotivo) medidas.pulsos += 1
    pedido = false
    ultimoDesenho = agora
    desenhando = true
    try {
      app.render()
    } finally {
      desenhando = false
    }
    medidas.desenhados += 1
  }

  const ouvintesAntes = ticker.count
  ticker.remove(app.render, app)
  // O desenho de todo quadro não estava onde o TickerPlugin põe (outro plugin o
  // trocou): sem tirá-lo, a tela desenharia duas vezes. Fica como estava.
  if (ticker.count === ouvintesAntes) return desenhoDeTodoQuadro(app)
  ticker.add(quadro, undefined, UPDATE_PRIORITY.LOW)
  renderer.runners.postrender.add(ouvinte)
  renderer.runners.resolutionChange.add(ouvinte)
  renderer.on('resize', aoRedimensionar)

  const relogio: Pick<Ticker, 'add' | 'remove'> = {
    add(fn, contexto, prioridade) {
      ticker.add(fn, contexto, prioridade)
      inscritos.add(fn)
      return ticker
    },
    remove(fn, contexto) {
      ticker.remove(fn, contexto)
      // A pose final da animação sai no quadro em que ela deixa o relógio.
      if (inscritos.delete(fn)) pedido = true
      return ticker
    },
  }

  return {
    relogio,
    medidas,
    pedir() {
      pedido = true
    },
    destruir() {
      if (destruido) return
      destruido = true
      inscritos.clear()
      ticker.remove(quadro)
      ticker.add(app.render, app, UPDATE_PRIORITY.LOW)
      renderer.runners.postrender.remove(ouvinte)
      renderer.runners.resolutionChange.remove(ouvinte)
      renderer.off('resize', aoRedimensionar)
    },
  }
}
