import { Sprite, Texture } from 'pixi.js'
import type { Drawing, MapData, Region } from '../types/map'
import {
  assinaturaDaTerra,
  idsDaTerra,
  idsDasAreasPintadas,
  mesmoConhecido,
  planoDoRelevoEmPassos,
  type ConhecidoDoRelevo,
  type PlanoDoRelevo,
} from '../lib/relevo'
import { ceder, rasterizarRelevo } from './relevoRaster'

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

/**
 * Quanto o plano do relevo roda de uma vez antes de dar a vez ao navegador.
 * Metade de um quadro a 60 Hz: o resto sobra para a tela continuar
 * respondendo enquanto o plano do mapa real (~100 ms no celular lento) sai.
 */
export const FATIA_DO_PLANO_MS = 8

export interface EntradaDoRelevo {
  /** Id da cena (`MapData.id`): cena nova libera a textura da anterior na hora. */
  cena: string
  mapa: Pick<MapData, 'width' | 'height' | 'grid'>
  /** As regiões que ESTA tela desenha (no jogador, só as do recorte dele). */
  regioes: readonly Region[]
  /**
   * Os desenhos que ESTA tela desenha (no jogador, só os do recorte dele): os
   * preenchidos sobre a terra dão as divisas pintadas (`divisasPintadas`).
   * Ausente: nenhum.
   */
  desenhos?: readonly Drawing[]
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
  /** Fatia do plano (`FATIA_DO_PLANO_MS`). Os testes passam 0 para ceder a cada passo. */
  fatiaMs?: number
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

const SEM_DESENHOS: readonly Drawing[] = []

/** Mesma terra (regiões e desenhos que pintam o chão)? Por referência primeiro (barato); referência nova compara pelo conteúdo. */
function mesmaTerra(a: EntradaDoRelevo, b: EntradaDoRelevo, assinaturaDeA: () => string): boolean {
  if (a.cena !== b.cena || a.mapa.width !== b.mapa.width || a.mapa.height !== b.mapa.height || a.mapa.grid !== b.mapa.grid) return false
  if (mesmosItens(a.regioes, b.regioes) && mesmosItens(a.desenhos ?? SEM_DESENHOS, b.desenhos ?? SEM_DESENHOS)) return true
  return assinaturaDeA() === assinaturaDaTerra(b.regioes, b.desenhos)
}

function mesmosItens<T>(a: readonly T[], b: readonly T[]): boolean {
  return a === b || (a.length === b.length && a.every((item, i) => item === b[i]))
}

/**
 * Alguma região de terra de antes ficou de fora agora, ou algum desenho cuja
 * borda está na textura do palco (`divisoresNaTela`) deixou de pintar o chão?
 * Só esses têm o formato na textura. Detalhe, tinta fraca e desenho sobre o
 * mar que somem não mudam o que está no palco: seguem a espera normal, sem o
 * mapa inteiro piscar numa edição que não mexe no relevo.
 */
function perdeuTerra(antes: EntradaDoRelevo, agora: EntradaDoRelevo, divisoresNaTela: readonly string[]): boolean {
  if (algumSumiu(idsDaTerra(antes.regioes), idsDaTerra(agora.regioes))) return true
  if (divisoresNaTela.length === 0) return false
  return algumSumiu(divisoresNaTela, idsDasAreasPintadas(agora.desenhos ?? SEM_DESENHOS))
}

function algumSumiu(antes: Iterable<string>, agora: ReadonlySet<string>): boolean {
  for (const id of antes) if (!agora.has(id)) return true
  return false
}

/** O plano foi abandonado no meio (a terra mudou, ou o palco morreu): quem esperava por ele desiste. */
const INTERROMPIDO = 'interrompido'

/**
 * Roda os passos do plano em fatias de `fatiaMs`, dando a vez ao navegador
 * entre elas. Confere `interrompido` a cada volta: terra nova não espera o
 * plano velho terminar.
 */
async function planoEmFatias(
  entrada: EntradaDoRelevo,
  fatiaMs: number,
  interrompido: () => boolean,
): Promise<PlanoDoRelevo | null | typeof INTERROMPIDO> {
  const passos = planoDoRelevoEmPassos(entrada.mapa, entrada.regioes, entrada.desenhos)
  let inicioDaFatia = performance.now()
  for (;;) {
    const passo = passos.next()
    if (passo.done === true) return passo.value
    if (performance.now() - inicioDaFatia < fatiaMs) continue
    await ceder()
    if (interrompido()) return INTERROMPIDO
    inicioDaFatia = performance.now()
  }
}

export function createRelevoRenderer(opcoes: OpcoesDoRelevo = {}): RelevoRenderer {
  const gerarTextura = opcoes.gerarTextura ?? texturaPadrao
  const esperaMs = opcoes.esperaMs ?? ESPERA_DO_RELEVO_MS
  const fatiaMs = opcoes.fatiaMs ?? FATIA_DO_PLANO_MS
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
  /**
   * O plano da terra do pedido, sem o conhecido (`null` = ainda não calculado
   * para esta terra). O jogador regera a cada pedaço explorado, e a terra
   * quase nunca muda junto: classificar as divisas de novo a cada passo
   * custaria dezenas de ms no celular, para sair o mesmo plano. É a promessa
   * (o plano sai em fatias): a geração que chega com a mesma terra no meio do
   * plano espera o mesmo, em vez de começar outro.
   */
  let planoDaTerra: Promise<PlanoDoRelevo | null | typeof INTERROMPIDO> | null = null
  /** Muda a cada terra nova: o plano em fatias da terra velha para na próxima volta. */
  let versaoDaTerra = 0
  /** Os desenhos cuja borda está na textura do palco agora (`PlanoDoRelevo.divisores`). */
  let divisoresNaTela: readonly string[] = []

  const assinatura = (): string => {
    if (assinaturaDoPedido === null) assinaturaDoPedido = pedido === null ? '' : assinaturaDaTerra(pedido.regioes, pedido.desenhos)
    return assinaturaDoPedido
  }

  function liberar(): void {
    const velha = texturaAtual
    texturaAtual = null
    cenaNaTela = null
    divisoresNaTela = []
    if (!camada.destroyed) camada.texture = Texture.EMPTY
    mostrar(false)
    velha?.destroy(true)
  }

  function cancelarEspera(): void {
    if (espera !== null) clearTimeout(espera)
    espera = null
  }

  /** A terra mudou (ou o relevo desligou): o plano guardado não vale mais, e o que está saindo para. */
  function esquecerPlano(): void {
    planoDaTerra = null
    versaoDaTerra += 1
  }

  async function gerar(entrada: EntradaDoRelevo): Promise<void> {
    const minha = ++geracao
    const cancelado = () => destruido || minha !== geracao
    // Toda mudança de terra cancela a espera e esquece o plano (`atualizar`):
    // o guardado aqui é sempre da terra desta entrada.
    if (planoDaTerra === null) {
      const versao = versaoDaTerra
      planoDaTerra = planoEmFatias(entrada, fatiaMs, () => destruido || versao !== versaoDaTerra)
    }
    let base: PlanoDoRelevo | null | typeof INTERROMPIDO
    try {
      base = await planoDaTerra
    } catch {
      // Sem relevo é o mapa de sempre: falha no plano não pode derrubar a tela.
      base = null
    }
    // Plano interrompido: a terra mudou e a geração dela já está marcada (ou o relevo desligou).
    if (base === INTERROMPIDO || cancelado()) return
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
    divisoresNaTela = plano.divisores
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
      esquecerPlano()
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
    // Terra que ENCOLHEU (o mestre ocultou uma região ou um desenho cuja borda
    // está na textura, o tornou secreto, ou escondeu a camada): o relevo dele
    // sai já, senão o formato do que saiu do recorte ficaria ~0,5 s no palco.
    // Terra que cresce ou se move, desenho que some sem estar na textura, e o
    // conhecido que cresce, mantêm a textura velha até a nova.
    const encolheu = !cenaNova && anterior !== null && !terraIgual && perdeuTerra(anterior, entrada, divisoresNaTela)
    pedido = entrada
    if (!terraIgual) {
      assinaturaDoPedido = null
      esquecerPlano()
    }
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
