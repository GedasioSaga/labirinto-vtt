import { createStore, type StoreApi } from 'zustand/vanilla'
import { armazenamentoEmTexto, type ArmazenamentoDaFila, type ArquivoDeTexto } from '../../lib/nuvem/fila'
import { criarChatDaCampanha, pendentesACaminho, type ChatDaCampanha, type EstadoDoChat, type PendentesGuardadas } from './chatDaCampanha'
import { clienteIdDaAba, type AmbienteDaAba } from './clienteDaAba'
import { criarDueloDaCampanha, type DueloDaCampanha, type EstadoDoDuelo } from './dueloDaCampanha'
import { abrirBancoDaFila, armazenamentoNoIndexedDB } from './filaNoIndexedDB'
import { ErroDoEu, type Eu, type FonteDoLobby } from './fonte'
import { criarFonteDemo } from './fonteDemo'
import { criarFonteReal } from './fonteReal'
import { campanhaDaRota, ehDemo, enderecoDaRota, lerRota, type Rota } from './rotas'
import { criarMuralDaCampanha, type EstadoDoMural, type MuralDaCampanha } from './muralDaCampanha'
import { VERSAO_NOVA_DA_DEMO } from './muralDaDemo'
import { abrirSessaoDaCampanha, type EstadoDaCampanha, type SessaoDaCampanha } from './sessaoDaCampanha'
import { vigiarVersaoDoSite, type VersaoNova } from './versaoDoSite'

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
  /** O servidor já serve uma versão do Labirinto maior que a desta página (M2, cartão do mural). */
  versaoNova: VersaoNova | null
  /** Não deu para abrir a campanha (IndexedDB bloqueado, navegador sem espaço). */
  erroDaCampanha: string | null
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

interface Aberta {
  campanhaId: string
  sessao: SessaoDaCampanha
  chat: ChatDaCampanha
  mural: MuralDaCampanha
  duelo: DueloDaCampanha
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
    // A demo não tem carimbo: o cartão aparece com versões inventadas, para a tela ter o que mostrar.
    versaoNova: demo ? VERSAO_NOVA_DA_DEMO : null,
    erroDaCampanha: null,
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

  function fecharAberta(): void {
    if (aberta === null) return
    const guardar = aberta.chat.guardarPendentes()
    if (guardar.length > 0) chatGuardado.set(aberta.campanhaId, guardar)
    else chatGuardado.delete(aberta.campanhaId)
    aberta.chat.fechar()
    aberta.mural.fechar()
    aberta.duelo.fechar()
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
        if (minha === aberturas) store.setState({ chat: estadoDoChat })
      },
      pendentesGuardadas: chatGuardado.get(campanhaId),
    })
    const mural = criarMuralDaCampanha({
      enviar: (pedido) => sessao?.enviarDoMural(pedido) ?? false,
      aoMudar: (estadoDoMural) => {
        if (minha === aberturas) store.setState({ mural: estadoDoMural })
      },
    })
    const duelo = criarDueloDaCampanha({
      enviar: (pedido) => sessao?.enviarDoDuelo(pedido) ?? false,
      aoMudar: (estadoDoDuelo) => {
        if (minha === aberturas) store.setState({ duelo: estadoDoDuelo })
      },
    })
    try {
      sessao = await abrirSessaoDaCampanha({
        fonte,
        campanhaId,
        armazenamento: fila.armazenamento,
        clienteId: fila.clienteId,
        aoMudar: (campanha) => {
          if (minha === aberturas) store.setState({ campanha })
        },
        chat,
        mural,
        duelo,
      })
    } catch (erro) {
      chat.fechar()
      mural.fechar()
      duelo.fechar()
      fila.fecharBanco()
      throw erro
    }
    if (minha !== aberturas) {
      chat.fechar()
      mural.fechar()
      duelo.fechar()
      sessao.fechar()
      fila.fecharBanco()
      return
    }
    aberta = { campanhaId, sessao, chat, mural, duelo, fecharBanco: fila.fecharBanco }
    // As guardadas agora moram no chat aberto (e voltam para cá se a pessoa sair de novo antes de saírem).
    chatGuardado.delete(campanhaId)
    store.setState({ campanha: sessao.estado(), chat: chat.estado(), mural: mural.estado(), duelo: duelo.estado(), chatGuardado: contarChatGuardado(), erroDaCampanha: null })
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
      store.setState({ campanha: null, chat: null, mural: null, duelo: null, erroDaCampanha: null })
      return
    }
    // Mesa que não está na lista desta pessoa: não abre base nem canal com id que veio só da URL.
    if (!eu.eu.campanhas.some((campanha) => campanha.campanhaId === campanhaId)) {
      store.setState({ rota: { tela: 'nao-achada' }, campanha: null, chat: null, mural: null, duelo: null, erroDaCampanha: null })
      return
    }
    store.setState({ campanha: null, chat: null, mural: null, duelo: null, erroDaCampanha: null })
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
    sessao: () => aberta?.sessao ?? null,
    chat: () => aberta?.chat ?? null,
    mural: () => aberta?.mural ?? null,
    duelo: () => aberta?.duelo ?? null,
    encerrar() {
      aberturas += 1
      fecharAberta()
      pararAVigia()
      janela.removeEventListener('popstate', aoVoltarNaHistoria)
      janela.removeEventListener('online', aoVoltarARede)
    },
  }
}
