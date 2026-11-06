import { createStore, type StoreApi } from 'zustand/vanilla'
import { armazenamentoEmTexto, type ArmazenamentoDaFila, type ArquivoDeTexto } from '../../lib/nuvem/fila'
import { clienteIdDaAba, type AmbienteDaAba } from './clienteDaAba'
import { abrirBancoDaFila, armazenamentoNoIndexedDB } from './filaNoIndexedDB'
import { ErroDoEu, type Eu, type FonteDoLobby } from './fonte'
import { criarFonteDemo } from './fonteDemo'
import { criarFonteReal } from './fonteReal'
import { campanhaDaRota, ehDemo, enderecoDaRota, lerRota, type Rota } from './rotas'
import { abrirSessaoDaCampanha, type EstadoDaCampanha, type SessaoDaCampanha } from './sessaoDaCampanha'

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
  /** Não deu para abrir a campanha (IndexedDB bloqueado, navegador sem espaço). */
  erroDaCampanha: string | null
}

export interface Site {
  store: StoreApi<EstadoDoSite>
  fonte: FonteDoLobby
  irPara(rota: Rota): void
  /** A sessão da campanha aberta, para editar, decidir, desfazer e pedir histórico. */
  sessao(): SessaoDaCampanha | null
  encerrar(): void
}

/** O pedaço da janela que o site usa (injetado para a página e para quem testa). */
export interface JanelaDoSite {
  location: Pick<Location, 'pathname' | 'search' | 'origin'>
  history: Pick<History, 'pushState'>
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
  const store = createStore<EstadoDoSite>(() => ({ demo, eu: { t: 'carregando' }, rota: lerRota(janela.location.pathname), campanha: null, erroDaCampanha: null }))
  let aberta: Aberta | null = null
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
    aberta.sessao.fechar()
    aberta.fecharBanco()
    aberta = null
  }

  async function abrir(eu: Eu, campanhaId: string, minha: number): Promise<void> {
    const fila = await abrirFilaDaCampanha(demo, eu.email, campanhaId, idDaAba)
    let sessao: SessaoDaCampanha | null = null
    try {
      sessao = await abrirSessaoDaCampanha({
        fonte,
        campanhaId,
        armazenamento: fila.armazenamento,
        clienteId: fila.clienteId,
        aoMudar: (campanha) => {
          if (minha === aberturas) store.setState({ campanha })
        },
      })
    } catch (erro) {
      fila.fecharBanco()
      throw erro
    }
    if (minha !== aberturas) {
      sessao.fechar()
      fila.fecharBanco()
      return
    }
    aberta = { campanhaId, sessao, fecharBanco: fila.fecharBanco }
    store.setState({ campanha: sessao.estado(), erroDaCampanha: null })
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
      store.setState({ campanha: null, erroDaCampanha: null })
      return
    }
    // Mesa que não está na lista desta pessoa: não abre base nem canal com id que veio só da URL.
    if (!eu.eu.campanhas.some((campanha) => campanha.campanhaId === campanhaId)) {
      store.setState({ rota: { tela: 'nao-achada' }, campanha: null, erroDaCampanha: null })
      return
    }
    store.setState({ campanha: null, erroDaCampanha: null })
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
    encerrar() {
      aberturas += 1
      fecharAberta()
      janela.removeEventListener('popstate', aoVoltarNaHistoria)
      janela.removeEventListener('online', aoVoltarARede)
    },
  }
}
