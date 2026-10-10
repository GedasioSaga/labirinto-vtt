import { Sprite, Texture } from 'pixi.js'
import type { MapData, Region } from '../types/map'
import { assinaturaDaTerra, idsDaTerra, mesmoConhecido, planoDoRelevo, type ConhecidoDoRelevo, type PlanoDoRelevo } from '../lib/relevo'
import { rasterizarRelevo } from './relevoRaster'

/**
 * RELEVO no palco (`lib/relevo.ts`): um Sprite só, acima do chão das regiões e
 * dos desenhos que o pintam, abaixo da borda das regiões, de paredes, nomes,
 * pinos e fichas — eles continuam legíveis por cima.
 *
 * NADA é redesenhado por quadro: a textura nasce uma vez quando a terra muda e
 * fica parada. Durante o arrasto de um vértice a terra muda a cada movimento,
 * então a geração espera a mão parar (`ESPERA_DO_RELEVO_MS`). Troca de cena
 * libera a textura da anterior NA HORA (antes de gerar a nova), e o relevo
 * desligado também.
 */

/** Quanto a terra precisa ficar parada para o relevo ser refeito (arrasto de vértice, digitação no painel). */
export const ESPERA_DO_RELEVO_MS = 250

export interface EntradaDoRelevo {
  /** Id da cena (`MapData.id`): cena nova libera a textura da anterior na hora. */
  cena: string
  mapa: Pick<MapData, 'width' | 'height' | 'grid'>
  /** As regiões que ESTA tela desenha (no jogador, só as do recorte dele). */
  regioes: readonly Region[]
  /** O que o jogador já conhece (a origem de cada efeito sai só daqui). Ausente: tudo (o mestre). */
  conhecido?: ConhecidoDoRelevo
}

/** Quanto custou a última textura: o que a medida de desempenho lê. */
export interface MedidaDoRelevo {
  ms: number
  largura: number
  altura: number
}

export interface OpcoesDoRelevo {
  /** Gera a textura do plano. Padrão: a tela 2D de `relevoRaster.ts`. Os testes trocam por uma falsa. */
  gerarTextura?: (plano: PlanoDoRelevo, cancelado: () => boolean) => Promise<Texture | null>
  esperaMs?: number
  /** Avisado a cada textura nova aplicada (o editor marca no DOM para o e2e e a medida). */
  aoGerar?: (medida: MedidaDoRelevo) => void
  /**
   * Avisado quando a camada aparece (textura no palco) ou some. O jogador
   * esconde junto o contêiner com a máscara do conhecido: máscara de contêiner
   * visível custa o stencil a cada quadro, mesmo sem nada para mostrar.
   */
  aoMudarVisibilidade?: (visivel: boolean) => void
}

export interface RelevoRenderer {
  /** O que vai no palco. Invisível enquanto não há textura. */
  readonly camada: Sprite
  /** `null` = relevo desligado (ou modo leve): libera a textura. */
  atualizar: (entrada: EntradaDoRelevo | null) => void
  destruir: () => void
}

async function texturaPadrao(plano: PlanoDoRelevo, cancelado: () => boolean): Promise<Texture | null> {
  const tela = await rasterizarRelevo(plano, cancelado)
  // `true`: sem o cache global de texturas — a tela é desta geração só, e o
  // `destroy(true)` abaixo solta tela e textura juntas.
  return tela === null ? null : Texture.from(tela, true)
}

/** Mesma terra? Por referência primeiro (barato); referência nova compara pelo conteúdo. */
function mesmaTerra(a: EntradaDoRelevo, b: EntradaDoRelevo, assinaturaDeA: () => string): boolean {
  if (a.cena !== b.cena || a.mapa.width !== b.mapa.width || a.mapa.height !== b.mapa.height || a.mapa.grid !== b.mapa.grid) return false
  if (a.regioes.length === b.regioes.length && a.regioes.every((r, i) => r === b.regioes[i])) return true
  return assinaturaDeA() === assinaturaDaTerra(b.regioes)
}

/** Alguma região de terra de antes ficou de fora agora? */
function perdeuTerra(antes: readonly Region[], agora: readonly Region[]): boolean {
  const ficaram = idsDaTerra(agora)
  for (const id of idsDaTerra(antes)) if (!ficaram.has(id)) return true
  return false
}

export function createRelevoRenderer(opcoes: OpcoesDoRelevo = {}): RelevoRenderer {
  const gerarTextura = opcoes.gerarTextura ?? texturaPadrao
  const esperaMs = opcoes.esperaMs ?? ESPERA_DO_RELEVO_MS
  const camada = new Sprite(Texture.EMPTY)
  camada.label = 'relevo'
  camada.eventMode = 'none'
  camada.visible = false

  function mostrar(visivel: boolean): void {
    if (!camada.destroyed) camada.visible = visivel
    opcoes.aoMudarVisibilidade?.(visivel)
  }

  /** O último pedido aceito (o que a textura mostra ou vai mostrar). */
  let pedido: EntradaDoRelevo | null = null
  let assinaturaDoPedido: string | null = null
  /** Cena da textura no palco agora (`null` = nenhuma). */
  let cenaNaTela: string | null = null
  /** A textura do palco, guardada à parte: o Sprite pode ser destruído junto com o palco antes de `destruir()`. */
  let texturaAtual: Texture | null = null
  let espera: ReturnType<typeof setTimeout> | null = null
  /** Cada geração tem um número; a que terminar depois de outra começar é jogada fora. */
  let geracao = 0
  let destruido = false

  const assinatura = (): string => {
    if (assinaturaDoPedido === null) assinaturaDoPedido = pedido === null ? '' : assinaturaDaTerra(pedido.regioes)
    return assinaturaDoPedido
  }

  function liberar(): void {
    const velha = texturaAtual
    texturaAtual = null
    cenaNaTela = null
    if (!camada.destroyed) camada.texture = Texture.EMPTY
    mostrar(false)
    velha?.destroy(true)
  }

  function cancelarEspera(): void {
    if (espera !== null) clearTimeout(espera)
    espera = null
  }

  async function gerar(entrada: EntradaDoRelevo): Promise<void> {
    const minha = ++geracao
    const cancelado = () => destruido || minha !== geracao
    const base = planoDoRelevo(entrada.mapa, entrada.regioes)
    const plano = base === null || entrada.conhecido === undefined ? base : { ...base, conhecido: entrada.conhecido }
    if (plano === null) {
      liberar()
      return
    }
    const inicio = performance.now()
    let textura: Texture | null = null
    try {
      textura = await gerarTextura(plano, cancelado)
    } catch {
      // Sem relevo é o mapa de sempre: falha aqui não pode derrubar a tela.
      textura = null
    }
    if (cancelado()) {
      textura?.destroy(true)
      return
    }
    if (textura === null) {
      liberar()
      return
    }
    if (camada.destroyed) {
      textura.destroy(true)
      return
    }
    const velha = texturaAtual
    texturaAtual = textura
    camada.texture = textura
    camada.position.set(plano.retangulo.x, plano.retangulo.y)
    camada.scale.set(1 / plano.escala)
    mostrar(true)
    cenaNaTela = entrada.cena
    velha?.destroy(true)
    opcoes.aoGerar?.({ ms: performance.now() - inicio, largura: textura.width, altura: textura.height })
  }

  function atualizar(entrada: EntradaDoRelevo | null): void {
    if (destruido) return
    if (entrada === null) {
      cancelarEspera()
      geracao += 1
      pedido = null
      assinaturaDoPedido = null
      liberar()
      return
    }
    const terraIgual = pedido !== null && mesmaTerra(pedido, entrada, assinatura)
    if (pedido !== null && terraIgual && mesmoConhecido(pedido.conhecido, entrada.conhecido)) {
      // Mesma terra em objetos novos (pacote do jogador): guarda a referência nova
      // para a próxima comparação sair pelo caminho barato.
      pedido = entrada
      return
    }
    const anterior = pedido
    const cenaNova = anterior === null || anterior.cena !== entrada.cena
    // Terra que ENCOLHEU (o mestre ocultou uma região, a tornou secreta, ou
    // escondeu a camada Salas): o relevo dela sai já, senão o formato do que
    // saiu do recorte ficaria ~0,5 s no palco. Terra que cresce ou se move, e
    // o conhecido que cresce, mantêm a textura velha até a nova.
    const encolheu = !cenaNova && anterior !== null && !terraIgual && perdeuTerra(anterior.regioes, entrada.regioes)
    pedido = entrada
    if (!terraIgual) assinaturaDoPedido = null
    cancelarEspera()
    // Cena nova: a textura da anterior sai já, e a nova nasce no próximo giro
    // (sem esperar a mão parar). Mesma cena: a textura velha fica até a nova.
    if ((cenaNova && cenaNaTela !== entrada.cena) || encolheu) {
      geracao += 1
      liberar()
    }
    espera = setTimeout(
      () => {
        espera = null
        void gerar(entrada)
      },
      cenaNova ? 0 : esperaMs,
    )
  }

  function destruir(): void {
    if (destruido) return
    destruido = true
    cancelarEspera()
    liberar()
    if (!camada.destroyed) camada.destroy()
  }

  return { camada, atualizar, destruir }
}
