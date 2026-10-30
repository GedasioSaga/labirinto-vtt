import { Container, Sprite, Texture } from 'pixi.js'
import type { Drawing, MapData, PinceladaDeTextura, Region, TracoDePenhasco } from '../types/map'
import {
  assinaturaDaTerra,
  mesmosPenhascos,
  planoComPenhascos,
  idsDaTerra,
  idsDasAreasPintadas,
  mesmoConhecido,
  perfilDoPenhasco,
  planoDoRelevoEmPassos,
  type ConhecidoDoRelevo,
  type PerfilDoPenhasco,
  type PlanoDoRelevo,
} from '../lib/relevo'
import { ceder, rasterizarRelevo } from './relevoRaster'
import { desenhadoLigado, versaoDoEstilo } from '../lib/estiloDoMapa'
import { temRiscoDePenhasco } from '../lib/penhasco'
import { consultaDoChaoPintado } from '../lib/chaoPintado'
import { assinarTracosDesenhados, ehTracoDesenhado, pedirBordaDoTraco, pedirFaceDoTraco } from '../texturas/desenhado/carregadorDoTraco'
import type { TintaDoBarranco } from './barrancoDesenhado'
import { criarPenhascoDoContinente } from './penhascoDoContinente'

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
  /**
   * Os riscos do pincel de penhasco que ESTA tela recebeu (`MapData.penhascos`;
   * no jogador, só os junto do que ele conhece). Ausente: nenhum.
   */
  penhascos?: readonly TracoDePenhasco[]
  /** O que o jogador já conhece (a origem de cada efeito sai só daqui). Ausente: tudo (o mestre). */
  conhecido?: ConhecidoDoRelevo
  /**
   * Os passos da ferramenta Texturas que ESTA tela pinta (`MapData.texturas`):
   * o chão do lado alto, que escolhe a linha de cima da borda do penhasco
   * Desenhado (grama, terra, neve). Ausente: nenhum (a linha da grama). Não
   * mexe na textura do relevo.
   */
  texturas?: readonly PinceladaDeTextura[]
}

/** Quanto custou a última textura: o que a medida de desempenho lê. */
export interface MedidaDoRelevo {
  /** A textura: pintar as telas 2D do plano e embrulhar numa `Texture` (o envio à GPU fica no quadro seguinte, fora daqui). */
  ms: number
  /**
   * O plano (classificar a terra, em fatias), do pedido da geração até ele
   * sair. Perto de 0 quando a terra não mudou: o plano vem do cache da terra.
   * Medido à parte porque é a maior parte do custo e não entra em `ms`.
   */
  planoMs: number
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
  /**
   * A parede do penhasco no estilo Desenhado (`penhascoDoContinente.ts`), logo
   * por cima da `camada`, no mesmo contêiner. Vazia no Atual e no Simples, e
   * enquanto as imagens do pacote não chegam (a parede sai na textura).
   */
  readonly penhasco: Container
  /** `null` = relevo desligado (ou modo leve): libera a textura. */
  atualizar: (entrada: EntradaDoRelevo | null) => void
  /**
   * O relevo desta entrada num Sprite NOVO, sem mexer no palco nem no plano
   * guardado: a imagem exportada gera o do mapa dela (sem a sala secreta do
   * mestre) antes de trocar a cena. `null` = sem terra (ou o palco desmontou).
   * Quem pede solta o Sprite e a textura dele.
   */
  gerarAParte: (entrada: EntradaDoRelevo) => Promise<Sprite | null>
  destruir: () => void
}

async function texturaPadrao(plano: PlanoDoRelevo, cancelado: () => boolean): Promise<Texture | null> {
  const tela = await rasterizarRelevo(plano, cancelado)
  // `true`: sem o cache global de texturas — a tela é desta geração só, e o
  // `destroy(true)` abaixo solta tela e textura juntas.
  return tela === null ? null : Texture.from(tela, true)
}

const SEM_DESENHOS: readonly Drawing[] = []

/** O id do pacote da face do penhasco (CONTRATO 11), o mesmo do barranco. */
const FACE_DO_PENHASCO = 'penhasco'
/** A sequência de módulos do mapa inteiro (uma só, pelo x): o mestre e o jogador veem a mesma pedra. */
const ID_DO_PENHASCO_DO_MAPA = 'continente'

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
  /**
   * ESTILO DO MAPA do pedido (`versaoDoEstilo()`): o barranco liso do Meio-Termo
   * é lido na geração (`relevoRaster`), fora da entrada. Trocar o estilo com a
   * mesma terra gera de novo, pelo mesmo plano.
   */
  let estiloDoPedido: string | null = null
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
  /**
   * PENHASCO DO DESENHADO (CONTRATO 11.12): com o estilo Desenhado e as imagens
   * do pacote prontas, a textura sai sem a parede (só a sombra dela) e a malha
   * do pacote a pinta por cima. `tintaDoPedido` é a tinta da última entrada
   * aceita (`null` = a parede na textura, como no Atual).
   */
  let tintaDoPedido: TintaDoBarranco | null = null
  /** O shader do penhasco não compilou neste palco (ou a malha não montou): a parede fica na textura de vez. */
  let semShader = false
  /** O perfil e o plano da malha no palco agora: o chão pintado ou a borda que chega repintam só a malha. */
  let penhascoNaTela: { plano: PlanoDoRelevo; perfil: PerfilDoPenhasco } | null = null
  const penhasco = criarPenhascoDoContinente(() => {
    semShader = true
    if (pedido !== null) atualizar(pedido)
  })
  // As imagens do penhasco chegaram (ou outro traço chegou): a entrada de agora decide se muda algo.
  const pararDeOuvir = assinarTracosDesenhados(() => {
    if (pedido !== null) atualizar(pedido)
  })

  /** A tinta do penhasco Desenhado para esta entrada, ou `null` (pinta o Atual; a face começa a carregar). */
  function tintaDe(entrada: EntradaDoRelevo): TintaDoBarranco | null {
    if (semShader || !desenhadoLigado() || !temRiscoDePenhasco(entrada.penhascos) || penhasco.compila() === false) return null
    const face = pedirFaceDoTraco(FACE_DO_PENHASCO)
    if (face === null) return null
    const id = face.face.borda
    return { face, borda: id !== null && ehTracoDesenhado(id) ? pedirBordaDoTraco(id) : null }
  }

  function pintarPenhasco(entrada: EntradaDoRelevo, plano: PlanoDoRelevo, perfil: PerfilDoPenhasco, tinta: TintaDoBarranco): void {
    penhasco.pintar(
      {
        perfil,
        // CONTRATO 11.12: s = x e t = 18 · fator em px do protótipo, que é o px do traço aqui.
        k: plano.unidade,
        origem: 0,
        id: ID_DO_PENHASCO_DO_MAPA,
        escala: plano.escala,
        terra: { poligonos: plano.terras, fronteiras: plano.fronteiras, folga: plano.folgaDaFronteira },
        chaoNoAlto: consultaDoChaoPintado(entrada.texturas, entrada.regioes, entrada.desenhos ?? SEM_DESENHOS),
        // A parede só nasce com mar logo abaixo (`perfilDoPenhasco`): o pé é sempre água.
        aguaNoPe: true,
      },
      tinta,
    )
    penhascoNaTela = { plano, perfil }
  }

  /** A malha não montou: fica o Atual (a parede volta para a textura na próxima geração). */
  function falhaDoPenhasco(erro: unknown): void {
    console.warn('[desenhado] o penhasco do continente não montou; fica o Atual', erro)
    semShader = true
    penhasco.limpar()
    penhascoNaTela = null
    if (pedido !== null) atualizar(pedido)
  }

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
    penhasco.limpar()
    penhascoNaTela = null
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
    const inicioDoPlano = performance.now()
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
    // Riscos de penhasco e conhecido entram por fora do plano guardado: os dois
    // mudam enquanto o jogador explora, a terra quase nunca.
    const comRiscos = base === null ? null : planoComPenhascos(base, entrada.penhascos)
    const doPedido = comRiscos === null || entrada.conhecido === undefined ? comRiscos : { ...comRiscos, conhecido: entrada.conhecido }
    // Desenhado com as imagens prontas: a parede sai pela malha, a textura leva só a sombra dela.
    const plano = doPedido === null || tintaDoPedido === null || doPedido.penhascos.length === 0 ? doPedido : { ...doPedido, paredeNaMalha: true }
    if (plano === null) {
      liberar()
      return
    }
    const inicio = performance.now()
    const planoMs = inicio - inicioDoPlano
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
    // O perfil da parede do Desenhado (a textura já o fez para a sombra; aqui, para a malha), numa tarefa só dele.
    const ms = performance.now() - inicio
    let perfil: PerfilDoPenhasco | null = null
    if (plano.paredeNaMalha === true) {
      perfil = perfilDoPenhasco(plano)
      await ceder()
      if (cancelado() || camada.destroyed) {
        textura.destroy(true)
        return
      }
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
    // A malha troca no mesmo giro da textura: nenhum quadro sai com a parede dobrada ou sem ela.
    // A entrada aceita por último (mesma terra) traz o chão pintado de agora.
    const tinta = tintaDoPedido
    if (perfil !== null && tinta !== null) {
      try {
        pintarPenhasco(pedido ?? entrada, plano, perfil, tinta)
      } catch (erro: unknown) {
        falhaDoPenhasco(erro)
      }
    } else {
      penhasco.limpar()
      penhascoNaTela = null
    }
    opcoes.aoGerar?.({ ms, planoMs, largura: textura.width, altura: textura.height })
  }

  function atualizar(entrada: EntradaDoRelevo | null): void {
    if (destruido) return
    if (entrada === null) {
      cancelarEspera()
      geracao += 1
      pedido = null
      assinaturaDoPedido = null
      tintaDoPedido = null
      esquecerPlano()
      liberar()
      return
    }
    const terraIgual = pedido !== null && mesmaTerra(pedido, entrada, assinatura)
    const estilo = versaoDoEstilo()
    const mesmoEstilo = estilo === estiloDoPedido
    estiloDoPedido = estilo
    // A parede muda de lugar (da textura para a malha, ou volta) só quando a tinta aparece ou some.
    const tinta = tintaDe(entrada)
    const tintaDeAntes = tintaDoPedido
    tintaDoPedido = tinta
    const paredeNoMesmoLugar = (tinta === null) === (tintaDeAntes === null)
    if (pedido !== null && terraIgual && mesmoEstilo && paredeNoMesmoLugar && mesmoConhecido(pedido.conhecido, entrada.conhecido) && mesmosPenhascos(pedido.penhascos, entrada.penhascos)) {
      // A borda que chegou depois da face, ou o chão pintado que mudou: só a malha, a textura fica.
      const outraTinta = tinta !== null && (tinta.face !== tintaDeAntes?.face || tinta.borda !== tintaDeAntes.borda)
      const outroChao = tinta !== null && entrada.texturas !== pedido.texturas
      // Mesma terra em objetos novos (pacote do jogador): guarda a referência nova
      // para a próxima comparação sair pelo caminho barato.
      pedido = entrada
      if ((outraTinta || outroChao) && tinta !== null && penhascoNaTela !== null) {
        try {
          pintarPenhasco(entrada, penhascoNaTela.plano, penhascoNaTela.perfil, tinta)
        } catch (erro: unknown) {
          falhaDoPenhasco(erro)
        }
      }
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

  async function gerarAParte(entrada: EntradaDoRelevo): Promise<Sprite | null> {
    const parado = () => destruido
    if (parado()) return null
    let base: PlanoDoRelevo | null | typeof INTERROMPIDO
    try {
      base = await planoEmFatias(entrada, fatiaMs, parado)
    } catch {
      base = null
    }
    if (base === INTERROMPIDO || base === null || parado()) return null
    const comRiscos = planoComPenhascos(base, entrada.penhascos)
    if (comRiscos === null) return null
    const plano = entrada.conhecido === undefined ? comRiscos : { ...comRiscos, conhecido: entrada.conhecido }
    let textura: Texture | null = null
    try {
      textura = await gerarTextura(plano, parado)
    } catch {
      textura = null
    }
    if (textura === null) return null
    if (parado()) {
      textura.destroy(true)
      return null
    }
    const sprite = new Sprite(textura)
    sprite.label = 'relevo-a-parte'
    sprite.eventMode = 'none'
    sprite.position.set(plano.retangulo.x, plano.retangulo.y)
    sprite.scale.set(1 / plano.escala)
    return sprite
  }

  function destruir(): void {
    if (destruido) return
    destruido = true
    cancelarEspera()
    pararDeOuvir()
    liberar()
    penhasco.destroy()
    if (!camada.destroyed) camada.destroy()
  }

  return { camada, penhasco: penhasco.camada, atualizar, gerarAParte, destruir }
}
