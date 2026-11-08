import { createStore, type StoreApi } from 'zustand/vanilla'
import { armazenamentoEmTexto, type ArmazenamentoDaFila, type ArquivoDeTexto } from '../../lib/nuvem/fila'
import { criarChatDaCampanha, pendentesACaminho, type ChatDaCampanha, type EstadoDoChat, type PendentesGuardadas } from './chatDaCampanha'
import { clienteIdDaAba, type AmbienteDaAba } from './clienteDaAba'
import { criarDueloDaCampanha, type DueloDaCampanha, type EstadoDoDuelo } from './dueloDaCampanha'
import type { EstadoDasLutas, LutasDaCampanha, OpcoesDasLutas, ParteDasLutas } from './lutasDaCampanha'
import { abrirBancoDaFila, armazenamentoNoIndexedDB } from './filaNoIndexedDB'
import { ErroDoEu, type Eu, type FonteDoLobby } from './fonte'
import { criarFonteDemo } from './fonteDemo'
import { criarFonteReal } from './fonteReal'
import { campanhaDaRota, ehDemo, enderecoDaRota, lerRota, type Rota } from './rotas'
import { criarMuralDaCampanha, type EstadoDoMural, type MuralDaCampanha } from './muralDaCampanha'
import { VERSAO_NOVA_DA_DEMO } from './muralDaDemo'
import { abrirSessaoDaCampanha, type EstadoDaCampanha, type SessaoDaCampanha } from './sessaoDaCampanha'
import { vigiarVersaoDoSite, type VersaoNova } from './versaoDoSite'
import type { MensagemDoVerComoNoSite, VistaDoVerComoNoSite } from './fonte'
import type { MembroProjetado } from '../../lib/nuvem/tipos'
import { campanhaVistaComo, chatSoDaSala, dueloDaVista, muralDaVista } from './vistaDoVerComo'

/**
 * "VER COMO JOGADOR" (pedido do mestre, 07/11/2026): o mestre escolhe um
 * jogador e as telas passam a mostrar a vista daquele jogador, montada pelo
 * servidor. Por baixo, a sessão, a fila, o chat, o mural e o duelo do mestre
 * continuam vivos; o store só troca o que as telas leem. SÓ LEITURA: enquanto
 * a vista está pedida ou aberta, `sessao()`, `chat()`, `mural()` e `duelo()`
 * devolvem `null` (nada sai em nome de ninguém), e as telas desligam os
 * controles com o motivo.
 * - `pedindo`: o pedido saiu; as telas ainda mostram o do mestre, já sem gravar;
 * - `pronto`: a vista chegou (e se atualiza sozinha quando a mesa muda);
 * - `erro`: não veio; o mestre volta a ser mestre (grava de novo) e a faixa diz por quê.
 */
export type FalhaDoVerComo = 'so-mestre' | 'nao-e-jogador' | 'torta' | 'sem-resposta' | 'sem-canal'

export type VerComoNoSite =
  | { t: 'pedindo'; contaId: string; nome: string; mestre: MembroProjetado | null }
  | { t: 'pronto'; contaId: string; nome: string; mestre: MembroProjetado | null }
  | { t: 'erro'; contaId: string; nome: string; mestre: MembroProjetado | null; motivo: FalhaDoVerComo }

/** Sem resposta neste tempo, o pedido desiste (o DO de antes do "ver como" nem lê o frame). */
export const PRAZO_DO_VER_COMO_MS = 10_000
/** A mesa mudou (rev, membros, mural) com a vista aberta: pede de novo depois deste respiro, uma vez só para a rajada. */
const RESPIRO_DA_ATUALIZACAO_MS = 900
/** Recusada por ritmo: tenta de novo depois disto (a vista velha continua na tela). */
const ESPERA_DO_RITMO_MS = 2_500

/**
 * O STORE DO SITE (fatia S2): quem é a pessoa (`/api/eu`), a rota e a
 * campanha aberta. A tela (S3) lê com `useStore(site.store, seletor)` e age
 * pela sessão (`site.sessao()`). Uma campanha aberta por vez: trocar de rota
 * para outra mesa fecha o canal e a base da anterior.
 *
 * A fila mora no IndexedDB do navegador (base por e-mail + campanha); na
 * demo, só em memória — a demo nunca encosta na fila de verdade.
 */

export type CargaDoEu = { t: 'carregando' } | { t: 'pronto'; eu: Eu } | { t: 'erro'; tipo: ErroDoEu['tipo']; detalhe: string }

export interface EstadoDoSite {
  demo: boolean
  eu: CargaDoEu
  rota: Rota
  /** A campanha da rota; `null` = a rota não é de campanha, ou ela ainda está abrindo. */
  campanha: EstadoDaCampanha | null
  /** O chat da campanha aberta (C2); `null` junto com ela. */
  chat: EstadoDoChat | null
  /** Mensagens do chat de mesas que a pessoa deixou nesta aba e que ainda vão sair (quando a mesa abrir de novo). */
  chatGuardado: number
  /** O mural da campanha aberta (M2); `null` junto com ela. */
  mural: EstadoDoMural | null
  /** Os convites e duelos da campanha aberta (T7); `null` junto com ela. */
  duelo: EstadoDoDuelo | null
  /** As lutas de N lados da campanha aberta (Arena multijogador F5); `null` junto com ela. Fora do "ver como": é sempre o do mestre. */
  lutas: EstadoDasLutas | null
  /** O pedaço do site com as lutas de N lados não baixou (a rede caiu, ou o site foi publicado de novo): a tela mostra o aviso com "Tentar de novo". */
  lutasNaoAbriram: boolean
  /** O servidor já serve uma versão do Labirinto maior que a desta página (M2, cartão do mural). */
  versaoNova: VersaoNova | null
  /** Não deu para abrir a campanha (IndexedDB bloqueado, navegador sem espaço). */
  erroDaCampanha: string | null
  /** O mestre vendo a mesa como um jogador (só leitura); `null` = cada um vendo como si. */
  verComo: VerComoNoSite | null
}

export interface Site {
  store: StoreApi<EstadoDoSite>
  fonte: FonteDoLobby
  irPara(rota: Rota): void
  /** A sessão da campanha aberta, para editar, decidir, desfazer e pedir histórico. */
  sessao(): SessaoDaCampanha | null
  /** O chat da campanha aberta, para mandar, apagar, ler e baixar. */
  chat(): ChatDaCampanha | null
  /** O mural da campanha aberta, para postar, reagir, marcar lido e ver as modificações. */
  mural(): MuralDaCampanha | null
  /** O duelo da campanha aberta, para convidar, aceitar, jogar e desistir (T7). */
  duelo(): DueloDaCampanha | null
  /** As lutas de N lados da campanha aberta: criar, aceitar, jogar, arbitrar, assistir e ler o histórico (F5). */
  lutas(): LutasDaCampanha | null
  /** Baixa de novo o pedaço das lutas que não chegou (`lutasNaoAbriram`). */
  tentarAsLutasDeNovo(): void
  /** Só o mestre: passa a ver a mesa como o jogador `contaId` (só leitura). */
  verComo(contaId: string): void
  /** Sai do "ver como": as telas voltam a mostrar (e a gravar) o do mestre. */
  voltarASerMestre(): void
  encerrar(): void
}

/** O pedaço da janela que o site usa (injetado para a página e para quem testa). */
export interface JanelaDoSite {
  location: Pick<Location, 'pathname' | 'search' | 'origin'>
  history: Pick<History, 'pushState' | 'replaceState'>
  addEventListener(tipo: 'popstate' | 'online', ouvinte: () => void): void
  removeEventListener(tipo: 'popstate' | 'online', ouvinte: () => void): void
  /** Ler pode lançar (armazenamento bloqueado pelo navegador): quem lê protege. */
  readonly sessionStorage: Pick<Storage, 'getItem' | 'setItem'>
  /** `locks` falta fora de contexto seguro e em navegador antigo. */
  readonly navigator: { readonly locks?: Pick<LockManager, 'request'> }
}

/** As lutas de N lados enquanto o módulo delas carrega (`pronta()` é `null` até chegar). */
interface LutasSobDemanda extends ParteDasLutas {
  pronta(): LutasDaCampanha | null
  /** Baixa de novo o módulo que não chegou; já baixando, chegado ou fechado, nada. */
  tentarDeNovo(): void
  fechar(): void
}

/**
 * As lutas de N lados (Arena multijogador F5) carregam sob demanda: o leitor
 * dos frames e o controlador ficam fora da entrada do site. O canal só fala
 * `luta.*` depois que elas chegam (o `luta.lista` sai do `aoFicarEmDia`
 * delas), então até lá não há frame para guardar; o que chegar entra na fila.
 * Sem o módulo (a rede caiu no meio, ou o site foi publicado de novo e o
 * arquivo antigo saiu), `aoFalhar` avisa e o resto da mesa segue; a fila
 * continua guardando até o `tentarDeNovo` trazer o módulo.
 */
function lutasSobDemanda(opcoes: OpcoesDasLutas, aoCarregar: (lutas: LutasDaCampanha) => void, aoFalhar: () => void): LutasSobDemanda {
  let lutas: LutasDaCampanha | null = null
  let fechada = false
  let emDia = false
  let baixando = false
  const fila: Parameters<ParteDasLutas['aoReceber']>[0][] = []
  function baixar(): void {
    if (baixando || lutas !== null || fechada) return
    baixando = true
    void import('./lutasDaCampanha')
      .then(({ criarLutasDaCampanha }) => {
        baixando = false
        if (fechada) return
        const prontas = criarLutasDaCampanha(opcoes)
        lutas = prontas
        aoCarregar(prontas)
        if (emDia) prontas.aoFicarEmDia()
        for (const frame of fila.splice(0)) prontas.aoReceber(frame)
      })
      .catch(() => {
        baixando = false
        // Erro depois de o módulo chegar não é "não abriu": as lutas já estão na tela.
        if (!fechada && lutas === null) aoFalhar()
      })
  }
  baixar()
  return {
    tentarDeNovo: baixar,
    aoFicarEmDia() {
      emDia = true
      lutas?.aoFicarEmDia()
    },
    aoCair() {
      emDia = false
      lutas?.aoCair()
    },
    aoReceber(frame) {
      if (lutas !== null) lutas.aoReceber(frame)
      else if (!fechada) fila.push(frame)
    },
    fechar() {
      fechada = true
      fila.length = 0
      lutas?.fechar()
    },
    pronta: () => lutas,
  }
}

interface Aberta {
  campanhaId: string
  sessao: SessaoDaCampanha
  chat: ChatDaCampanha
  mural: MuralDaCampanha
  duelo: DueloDaCampanha
  lutas: LutasSobDemanda
  fecharBanco(): void
}

function arquivoEmMemoria(): ArquivoDeTexto {
  let texto: string | null = null
  return {
    ler: async () => texto,
    acrescentar: async (mais) => {
      texto = (texto ?? '') + mais
    },
    reescrever: async (novo) => {
      texto = novo
    },
  }
}

function textoDoErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : 'Não deu para abrir a mesa neste navegador'
}

interface FilaDaCampanha {
  armazenamento: ArmazenamentoDaFila
  clienteId: string
  fecharBanco(): void
}

/** O id da aba antes da base: depois de abrir a base nada mais pode falhar, e ela não fica aberta à toa. */
async function abrirFilaDaCampanha(demo: boolean, email: string, campanhaId: string, idDaAba: () => Promise<string>): Promise<FilaDaCampanha> {
  if (demo) return { armazenamento: armazenamentoEmTexto(arquivoEmMemoria()), clienteId: `cli_demo_${crypto.randomUUID()}`, fecharBanco: () => undefined }
  const clienteId = await idDaAba()
  const banco = await abrirBancoDaFila(email, campanhaId)
  return { armazenamento: armazenamentoNoIndexedDB(banco), clienteId, fecharBanco: () => banco.close() }
}

function ambienteDaAba(janela: JanelaDoSite): AmbienteDaAba {
  let guarda: AmbienteDaAba['guarda'] = null
  try {
    guarda = janela.sessionStorage
  } catch {
    // Armazenamento bloqueado: id novo a cada página (aviso de conflito a mais, nunca perda).
  }
  // Sem Web Locks não dá para notar a aba duplicada; o resto funciona igual.
  return { guarda, travas: janela.navigator.locks ?? null, novoId: () => crypto.randomUUID() }
}

export function iniciarSite(janela: JanelaDoSite): Site {
  const demo = ehDemo(janela.location.search)
  const fonte = demo ? criarFonteDemo() : criarFonteReal({ origem: janela.location.origin })
  const store = createStore<EstadoDoSite>(() => ({
    demo,
    eu: { t: 'carregando' },
    rota: lerRota(janela.location.pathname),
    campanha: null,
    chat: null,
    chatGuardado: 0,
    mural: null,
    duelo: null,
    lutas: null,
    lutasNaoAbriram: false,
    // A demo não tem carimbo: o cartão aparece com versões inventadas, para a tela ter o que mostrar.
    versaoNova: demo ? VERSAO_NOVA_DA_DEMO : null,
    erroDaCampanha: null,
    verComo: null,
  }))
  const pararAVigia = demo ? () => undefined : vigiarVersaoDoSite({ origem: janela.location.origin, aoAchar: (versaoNova) => store.setState({ versaoNova }) })
  let aberta: Aberta | null = null
  /**
   * O chat que ficou sem sair, por mesa. As pendentes vivem só na memória da aba: sair da mesa ("Suas mesas", outra
   * mesa) não as perde, elas voltam com a mesa (o mesmo `idDoCliente`, nada duplica). Fechar a aba com alguma aqui
   * faz o navegador perguntar (`Site.tsx`).
   */
  const chatGuardado = new Map<string, readonly PendentesGuardadas[]>()

  function contarChatGuardado(): number {
    let total = 0
    for (const conversas of chatGuardado.values()) total += pendentesACaminho(conversas)
    return total
  }
  /** Cada abertura ganha um número: a que terminar depois de outra navegação é fechada em vez de ocupar a tela. */
  let aberturas = 0
  /** Um por página: pedir de novo a trava que esta mesma página já segura daria um id novo a cada troca de mesa. */
  let clienteIdDestaAba: Promise<string> | null = null

  function idDaAba(): Promise<string> {
    clienteIdDestaAba ??= clienteIdDaAba(ambienteDaAba(janela))
    return clienteIdDestaAba
  }

  // ── Ver como jogador ───────────────────────────────────────────────────────

  /** O que as telas mostram fora do "ver como" (o do mestre): com a vista aberta, o store mostra a vista no lugar. */
  const doMestre: { campanha: EstadoDaCampanha | null; chat: EstadoDoChat | null; mural: EstadoDoMural | null; duelo: EstadoDoDuelo | null } = {
    campanha: null,
    chat: null,
    mural: null,
    duelo: null,
  }
  let vista: VistaDoVerComoNoSite | null = null
  let pedidoDaVista: { reqId: string; contaId: string; cancelarPrazo: () => void } | null = null
  let cancelarNovoPedido: (() => void) | null = null
  /** Como a mesa estava quando a vista foi pedida: mudou (rev, membros, sala, mural), pede de novo. */
  let marcaDaVista = ''

  /** Vista pedida ou aberta: nada sai pelas partes da mesa (a guarda das telas é a segunda camada). */
  function soLeitura(): boolean {
    const verComo = store.getState().verComo
    return verComo !== null && verComo.t !== 'erro'
  }

  function marcaDaMesa(): string {
    const { campanha, mural } = doMestre
    const membros = campanha === null ? '' : campanha.membros.map((membro) => `${membro.contaId}:${membro.nome}:${membro.foto ?? ''}`).join('|')
    const noticias = mural === null ? '' : [...mural.fixadas, ...mural.noticias].map((noticia) => `${noticia.id}.${noticia.versao}.${noticia.fixada ? 1 : 0}`).join(',')
    return `${campanha?.rev ?? -1}#${campanha?.sala?.codigo ?? ''}#${membros}#${noticias}`
  }

  function pararVerComo(): void {
    pedidoDaVista?.cancelarPrazo()
    pedidoDaVista = null
    cancelarNovoPedido?.()
    cancelarNovoPedido = null
    // A sala ficou aberta pelo store enquanto a vista durou (a tela não tem o chat para abrir): solta.
    if (vista !== null) aberta?.chat.soltar('sala')
    vista = null
  }

  /** Uma parte do mestre mudou: guarda; com a vista aberta, a campanha segue a vista e a sala do chat continua ao vivo. */
  function doMestreMudou(parte: Partial<typeof doMestre>): void {
    Object.assign(doMestre, parte)
    const verComo = store.getState().verComo
    if (verComo === null || verComo.t !== 'pronto' || vista === null) {
      store.setState(parte)
      return
    }
    if (parte.chat !== undefined) store.setState({ chat: parte.chat === null ? null : chatSoDaSala(parte.chat) })
    if (parte.campanha !== undefined && parte.campanha !== null) store.setState({ campanha: campanhaVistaComo(parte.campanha, vista.estado) })
    if (marcaDaMesa() !== marcaDaVista) pedirDeNovoDepois(RESPIRO_DA_ATUALIZACAO_MS)
  }

  function pedirDeNovoDepois(ms: number): void {
    if (cancelarNovoPedido !== null) return
    const id = setTimeout(() => {
      cancelarNovoPedido = null
      const verComo = store.getState().verComo
      if (verComo === null || verComo.t === 'erro') return
      if (!pedirVista(verComo.contaId)) falhouOVerComo('sem-canal')
    }, ms)
    cancelarNovoPedido = () => clearTimeout(id)
  }

  /** Manda o pedido pela sessão do mestre; `false` = sem canal agora. */
  function pedirVista(contaId: string): boolean {
    const sessao = aberta?.sessao
    if (sessao === undefined) return false
    const reqId = `vc_${crypto.randomUUID()}`
    if (!sessao.pedirVerComo(contaId, reqId)) return false
    pedidoDaVista?.cancelarPrazo()
    marcaDaVista = marcaDaMesa()
    const id = setTimeout(() => {
      if (pedidoDaVista?.reqId !== reqId) return
      pedidoDaVista = null
      falhouOVerComo('sem-resposta')
    }, PRAZO_DO_VER_COMO_MS)
    pedidoDaVista = { reqId, contaId, cancelarPrazo: () => clearTimeout(id) }
    return true
  }

  /**
   * Não veio. Antes da primeira vista, ou quando o jogador saiu da mesa: o
   * mestre volta a ver (e a gravar) o dele, e a faixa diz por quê. Com a
   * vista já na tela e uma falha de passagem (prazo, canal), a velha fica:
   * a próxima mudança da mesa pede de novo.
   */
  function falhouOVerComo(motivo: FalhaDoVerComo): void {
    const verComo = store.getState().verComo
    if (verComo === null || verComo.t === 'erro') return
    const deVez = motivo === 'so-mestre' || motivo === 'nao-e-jogador'
    if (verComo.t === 'pronto' && !deVez) return
    pararVerComo()
    store.setState({ verComo: { t: 'erro', contaId: verComo.contaId, nome: verComo.nome, mestre: verComo.mestre, motivo }, ...doMestre })
  }

  function receberVerComo(mensagem: MensagemDoVerComoNoSite): void {
    if (pedidoDaVista === null || mensagem.reqId !== pedidoDaVista.reqId) return
    pedidoDaVista.cancelarPrazo()
    const { contaId } = pedidoDaVista
    pedidoDaVista = null
    const verComo = store.getState().verComo
    if (verComo === null || verComo.t === 'erro' || verComo.contaId !== contaId) return
    if (mensagem.t === 'verComo.recusa') {
      if (mensagem.motivo === 'ritmo') pedirDeNovoDepois(ESPERA_DO_RITMO_MS)
      else falhouOVerComo(mensagem.motivo)
      return
    }
    const real = doMestre.campanha
    if (real === null) return
    // Ler a sala é o mesmo para o mestre e o jogador: o store a mantém aberta (só pede páginas), já que a tela não tem `chat()`.
    if (vista === null) aberta?.chat.abrir('sala')
    vista = mensagem
    store.setState({
      verComo: { t: 'pronto', contaId, nome: mensagem.estado.eu.nome, mestre: verComo.mestre },
      campanha: campanhaVistaComo(real, mensagem.estado),
      chat: doMestre.chat === null ? null : chatSoDaSala(doMestre.chat),
      mural: muralDaVista(mensagem),
      duelo: dueloDaVista(mensagem),
    })
  }

  function fecharAberta(): void {
    pararVerComo()
    Object.assign(doMestre, { campanha: null, chat: null, mural: null, duelo: null })
    if (store.getState().verComo !== null) store.setState({ verComo: null })
    if (aberta === null) return
    const guardar = aberta.chat.guardarPendentes()
    if (guardar.length > 0) chatGuardado.set(aberta.campanhaId, guardar)
    else chatGuardado.delete(aberta.campanhaId)
    aberta.chat.fechar()
    aberta.mural.fechar()
    aberta.duelo.fechar()
    aberta.lutas.fechar()
    aberta.sessao.fechar()
    aberta.fecharBanco()
    aberta = null
    store.setState({ chatGuardado: contarChatGuardado() })
  }

  async function abrir(eu: Eu, campanhaId: string, minha: number): Promise<void> {
    const fila = await abrirFilaDaCampanha(demo, eu.email, campanhaId, idDaAba)
    let sessao: SessaoDaCampanha | null = null
    // O chat manda pela sessão, que só existe depois de aberta; o canal só abre depois disso (nunca de dentro da abertura).
    const chat = criarChatDaCampanha({
      enviar: (pedido) => sessao?.enviarDoChat(pedido) ?? false,
      quemSouEu: () => sessao?.estado().eu?.contaId ?? null,
      aoMudar: (estadoDoChat) => {
        if (minha === aberturas) doMestreMudou({ chat: estadoDoChat })
      },
      pendentesGuardadas: chatGuardado.get(campanhaId),
    })
    const mural = criarMuralDaCampanha({
      enviar: (pedido) => sessao?.enviarDoMural(pedido) ?? false,
      aoMudar: (estadoDoMural) => {
        if (minha === aberturas) doMestreMudou({ mural: estadoDoMural })
      },
    })
    const duelo = criarDueloDaCampanha({
      enviar: (pedido) => sessao?.enviarDoDuelo(pedido) ?? false,
      aoMudar: (estadoDoDuelo) => {
        if (minha === aberturas) doMestreMudou({ duelo: estadoDoDuelo })
      },
    })
    // As lutas de N lados não entram no "ver como" (a vista do jogador não as traz): o store mostra sempre as do mestre, e as telas as escondem na vista.
    const lutas = lutasSobDemanda(
      {
        enviar: (pedido) => sessao?.enviarDaLuta(pedido) ?? false,
        aoMudar: (estadoDasLutas) => {
          if (minha === aberturas) store.setState({ lutas: estadoDasLutas })
        },
      },
      (prontas) => {
        if (minha === aberturas) store.setState({ lutas: prontas.estado(), lutasNaoAbriram: false })
      },
      () => {
        if (minha === aberturas) store.setState({ lutasNaoAbriram: true })
      },
    )
    try {
      sessao = await abrirSessaoDaCampanha({
        fonte,
        campanhaId,
        armazenamento: fila.armazenamento,
        clienteId: fila.clienteId,
        aoMudar: (campanha) => {
          if (minha === aberturas) doMestreMudou({ campanha })
        },
        chat,
        mural,
        duelo,
        lutas,
        verComo: (mensagem) => {
          if (minha === aberturas) receberVerComo(mensagem)
        },
      })
    } catch (erro) {
      chat.fechar()
      mural.fechar()
      duelo.fechar()
      lutas.fechar()
      fila.fecharBanco()
      throw erro
    }
    if (minha !== aberturas) {
      chat.fechar()
      mural.fechar()
      duelo.fechar()
      lutas.fechar()
      sessao.fechar()
      fila.fecharBanco()
      return
    }
    aberta = { campanhaId, sessao, chat, mural, duelo, lutas, fecharBanco: fila.fecharBanco }
    // As guardadas agora moram no chat aberto (e voltam para cá se a pessoa sair de novo antes de saírem).
    chatGuardado.delete(campanhaId)
    Object.assign(doMestre, { campanha: sessao.estado(), chat: chat.estado(), mural: mural.estado(), duelo: duelo.estado() })
    store.setState({ ...doMestre, lutas: lutas.pronta()?.estado() ?? null, chatGuardado: contarChatGuardado(), erroDaCampanha: null })
  }

  /** Abre a campanha da rota (e fecha a anterior), quando o `/api/eu` já respondeu. */
  function seguirARota(): void {
    const { eu, rota } = store.getState()
    if (eu.t !== 'pronto') return
    const campanhaId = campanhaDaRota(rota)
    if (campanhaId !== null && campanhaId === aberta?.campanhaId) return
    aberturas += 1
    fecharAberta()
    if (campanhaId === null) {
      store.setState({ campanha: null, chat: null, mural: null, duelo: null, lutas: null, lutasNaoAbriram: false, erroDaCampanha: null })
      return
    }
    // Mesa que não está na lista desta pessoa: não abre base nem canal com id que veio só da URL.
    if (!eu.eu.campanhas.some((campanha) => campanha.campanhaId === campanhaId)) {
      store.setState({ rota: { tela: 'nao-achada' }, campanha: null, chat: null, mural: null, duelo: null, lutas: null, lutasNaoAbriram: false, erroDaCampanha: null })
      return
    }
    store.setState({ campanha: null, chat: null, mural: null, duelo: null, lutas: null, lutasNaoAbriram: false, erroDaCampanha: null })
    const minha = aberturas
    abrir(eu.eu, campanhaId, minha).catch((erro: unknown) => {
      if (minha === aberturas) store.setState({ erroDaCampanha: textoDoErro(erro) })
    })
  }

  function aoVoltarNaHistoria(): void {
    store.setState({ rota: lerRota(janela.location.pathname) })
    seguirARota()
  }

  function aoVoltarARede(): void {
    aberta?.sessao.reconectarAgora()
  }

  janela.addEventListener('popstate', aoVoltarNaHistoria)
  janela.addEventListener('online', aoVoltarARede)

  fonte
    .buscarEu()
    .then((eu) => {
      // Logo depois do login, quem joga numa mesa só entra direto no lobby dela (H1); com mais de uma, escolhe
      // primeiro em "Suas mesas". Troca o endereço sem empilhar: o Voltar do navegador não cai de novo aqui.
      const [unica, ...outras] = eu.campanhas
      if (store.getState().rota.tela === 'campanhas' && unica !== undefined && outras.length === 0) {
        const lobby: Rota = { tela: 'campanha', campanhaId: unica.campanhaId }
        janela.history.replaceState(null, '', enderecoDaRota(lobby, demo))
        store.setState({ rota: lobby })
      }
      store.setState({ eu: { t: 'pronto', eu } })
      seguirARota()
    })
    .catch((erro: unknown) => {
      const tipo = erro instanceof ErroDoEu ? erro.tipo : 'rede'
      store.setState({ eu: { t: 'erro', tipo, detalhe: textoDoErro(erro) } })
    })

  return {
    store,
    fonte,
    irPara(rota) {
      janela.history.pushState(null, '', enderecoDaRota(rota, demo))
      store.setState({ rota })
      seguirARota()
    },
    // No "ver como" nenhuma parte da mesa fica ao alcance das telas: o que elas pedissem sairia como o mestre.
    sessao: () => (soLeitura() ? null : (aberta?.sessao ?? null)),
    chat: () => (soLeitura() ? null : (aberta?.chat ?? null)),
    mural: () => (soLeitura() ? null : (aberta?.mural ?? null)),
    duelo: () => (soLeitura() ? null : (aberta?.duelo ?? null)),
    lutas: () => (soLeitura() ? null : (aberta?.lutas.pronta() ?? null)),
    tentarAsLutasDeNovo() {
      if (aberta === null) return
      store.setState({ lutasNaoAbriram: false })
      aberta.lutas.tentarDeNovo()
    },
    verComo(contaId) {
      const real = doMestre.campanha
      if (real === null || real.eu === null || real.eu.papel !== 'mestre') return
      const alvo = real.membros.find((membro) => membro.contaId === contaId && membro.papel === 'jogador')
      if (alvo === undefined) return
      pararVerComo()
      const mestre = real.eu
      // Antes do pedido sair: daqui em diante nada grava, mesmo antes de a vista chegar.
      store.setState({ verComo: { t: 'pedindo', contaId, nome: alvo.nome, mestre }, ...doMestre })
      if (!pedirVista(contaId)) store.setState({ verComo: { t: 'erro', contaId, nome: alvo.nome, mestre, motivo: 'sem-canal' } })
    },
    voltarASerMestre() {
      pararVerComo()
      store.setState({ verComo: null, ...doMestre })
    },
    encerrar() {
      aberturas += 1
      fecharAberta()
      pararAVigia()
      janela.removeEventListener('popstate', aoVoltarNaHistoria)
      janela.removeEventListener('online', aoVoltarARede)
    },
  }
}
