import { invoke, isTauri } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { create } from 'zustand'
import { SOM_DE_AMOSTRA } from '../components/ControleDeSom'
import { arquivosDaMidiaDaPasta, carregarBytesDoMestre } from '../lib/sons/aoVivo/carregadorDoMestre'
import type { EventoDoMotor, MotorAoVivo } from '../lib/sons/aoVivo/motor'
import { serializarBiblioteca, type AlvoDosSons } from '../lib/sons/biblioteca'
import { tocarAmostra } from '../lib/sons/tocarSom'
import { abrirCanalDoNavegador, type Canal } from '../net/visaoDeTeste/canal'
import type { PonteDosSons } from '../net/ponteDosSons'
import { useBibliotecaDeSonsStore } from '../stores/bibliotecaDeSonsStore'
import { useSomStore } from '../stores/somStore'
import { lerMensagemDaJanela, nomeDoCanal, SESSAO_VALIDA, type EstadoNoFio, type MensagemDoApp, type MudancaNaBiblioteca, type PedidoDosSons, type RespostaDosSons } from './protocolo'

/**
 * ONDE A PÁGINA SONS ESTÁ, visto da janela principal, e o fio com a janela dos
 * sons (o molde da mesa da batalha, `batalhaJanela/controleDaJanela.ts`).
 *
 * A principal continua sendo a única que toca: o motor, a ponte da sala, a
 * biblioteca e o disco ficam nela, e a janela só mostra o espelho e pede. Por
 * isso a página Sons do livro fica montada com a janela aberta (as teclas 1 a 9
 * e a sala seguem valendo no mapa) e só troca o conteúdo pelo aviso.
 *
 * A janela é aberta pelo Rust (`abrir_janela_sons`; só no app, o navegador não
 * tem o botão). A sessão mora no `sessionStorage` (F5 da principal com a janela
 * aberta: a janela continua no mesmo canal e recebe o estado de novo), e a
 * escolha de deixar os sons em janela mora no `localStorage`: reabrir o app
 * reabre a janela. Fechar a janela (o X do sistema) devolve a página ao livro;
 * fechar a principal derruba a janela (Rust, `janela_sons.rs`).
 */

interface EstadoDaJanela {
  emJanela: boolean
}

export const useSonsEmJanela = create<EstadoDaJanela>(() => ({ emJanela: false }))

const CHAVE_DA_SESSAO = 'lb-sons:sessao-da-janela'
/** A janela estava aberta quando a principal recarregou: a principal volta escutando por ela. */
const CHAVE_ABERTA = 'lb-sons:janela-aberta'
/** O mestre deixou os sons em janela: o app que abre de novo reabre a janela. */
const CHAVE_LEMBRADA = 'lb-sons:em-janela'
const EVENTO_FECHADA = 'sons-janela:fechada'
/** Sem `ping` por isto, a janela conta como fechada (travou, ou fechou sem avisar). */
const VIVA_MS = 6000
const VIGIA_MS = 1000
const ALVO_TODOS: AlvoDosSons = { tipo: 'todos' }

const FECHOU = 'A janela dos sons fechou: os sons voltaram para o livro.'
const PAROU = 'A janela dos sons parou de responder: os sons voltaram para o livro.'

type Avisar = (texto: string) => void
/** A mensagem sem o envelope (o lado e a sessão entram no `mandar`). */
type SemEnvelope<T> = T extends unknown ? Omit<T, 'de' | 'sessao'> : never

/** O que só existe na principal: quem toca aqui e na mesa. */
export interface FiosDosSons {
  motor: MotorAoVivo
  ponte: PonteDosSons
}

interface Controle {
  abrirEmJanela(): Promise<void>
  trazerParaOApp(): Promise<void>
  parar(): void
}

let controle: Controle | null = null

function lerArmazem(armazem: () => Storage, chave: string): string | null {
  try {
    return armazem().getItem(chave)
  } catch {
    return null
  }
}

function gravarArmazem(armazem: () => Storage, chave: string, valor: string | null): void {
  try {
    if (valor === null) armazem().removeItem(chave)
    else armazem().setItem(chave, valor)
  } catch {
    // Sem armazenamento (modo privado): a janela só não sobrevive ao F5 nem à volta do app.
  }
}

const sessaoDoNavegador = () => window.sessionStorage
const localDoNavegador = () => window.localStorage

function sessaoDestaPrincipal(): string {
  const guardada = lerArmazem(sessaoDoNavegador, CHAVE_DA_SESSAO)
  if (guardada !== null && SESSAO_VALIDA.test(guardada)) return guardada
  const nova = crypto.randomUUID()
  gravarArmazem(sessaoDoNavegador, CHAVE_DA_SESSAO, nova)
  return nova
}

function mensagemDoErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

/** O `tocando` com o início no relógio de parede: o `performance.now()` da outra janela começa em outra hora. */
function eventoNoFio(evento: EventoDoMotor): EventoDoMotor {
  return evento.tipo === 'tocando' ? { ...evento, inicioEmMs: performance.timeOrigin + evento.inicioEmMs } : evento
}

/** A mudança da janela pelas mesmas ações da loja, com o id que a janela já mostra. Recusada, o espelho desfaz lá. */
function aplicarMudanca(mudanca: MudancaNaBiblioteca): void {
  const loja = useBibliotecaDeSonsStore.getState()
  switch (mudanca.acao) {
    case 'adicionarEfeito':
      loja.adicionarEfeito(mudanca.novo, mudanca.id)
      return
    case 'editarEfeito':
      loja.editarEfeito(mudanca.id, mudanca.mudanca)
      return
    case 'apagarEfeito':
      loja.apagarEfeito(mudanca.id)
      return
    case 'criarPasta':
      loja.criarPasta(mudanca.nome, mudanca.parte, mudanca.id)
      return
    case 'renomearPasta':
      loja.renomearPasta(mudanca.id, mudanca.nome)
      return
    case 'apagarPasta':
      loja.apagarPasta(mudanca.id)
      return
  }
}

function criarControle(fios: FiosDosSons, avisar: Avisar, abrirCanal: (nome: string) => Canal): Controle {
  const sessao = sessaoDestaPrincipal()
  const canal = abrirCanal(nomeDoCanal(sessao))
  /** Este fio: a janela que vê outro recomeça a conta das mudanças dela. */
  const app = crypto.randomUUID()
  let parado = false
  let ultimoPing = 0
  /** A última mudança da janela já aplicada aqui (biblioteca, volume, mudo). */
  let vez = 0
  let estadoNaFila = false
  let pararDeEspelhar: (() => void) | null = null
  let desligarEvento: (() => void) | null = null
  /** O que soa agora, pelo motor: a janela que abre (ou recarrega) recebe de novo e acende os botões certos. */
  const soando = new Map<string, EventoDoMotor>()

  const mandar = (corpo: SemEnvelope<MensagemDoApp>) => canal.enviar({ de: 'app', sessao, ...corpo })
  const responder = (id: number, resposta: RespostaDosSons) => mandar({ tipo: 'resposta', id, resposta })

  const estadoAgora = (): EstadoNoFio => {
    const { biblioteca, pasta, carregando, pendente, aviso, podeGravar } = useBibliotecaDeSonsStore.getState()
    const { volume, mudo } = useSomStore.getState()
    return { app, vez, biblioteca: serializarBiblioteca(biblioteca), pasta, carregando, pendente, aviso, podeGravar, volume, mudo }
  }

  /** Um estado por volta do laço: dez mudanças seguidas na loja são um envio só. */
  const agendarEstado = () => {
    if (estadoNaFila) return
    estadoNaFila = true
    queueMicrotask(() => {
      estadoNaFila = false
      if (pararDeEspelhar !== null) mandar({ tipo: 'estado', estado: estadoAgora() })
    })
  }

  const desligarMotor = fios.motor.assinar((evento) => {
    if (evento.tipo === 'tocando') soando.set(evento.instancia, evento)
    else if (evento.tipo === 'terminou' || evento.tipo === 'recusado') soando.delete(evento.instancia)
    if (pararDeEspelhar !== null) mandar({ tipo: 'motor', evento: eventoNoFio(evento) })
  })

  /** A janela (re)abriu: o estado e o que já soa, sem esperar mudança. */
  const mandarTudo = () => {
    mandar({ tipo: 'estado', estado: estadoAgora() })
    for (const evento of soando.values()) mandar({ tipo: 'motor', evento: eventoNoFio(evento) })
  }

  const espelhar = (ligar: boolean) => {
    if (ligar && pararDeEspelhar === null) {
      const desligarBiblioteca = useBibliotecaDeSonsStore.subscribe(agendarEstado)
      const desligarSom = useSomStore.subscribe(agendarEstado)
      pararDeEspelhar = () => {
        desligarBiblioteca()
        desligarSom()
      }
      mandarTudo()
    }
    if (!ligar && pararDeEspelhar !== null) {
      pararDeEspelhar()
      pararDeEspelhar = null
    }
  }

  const marcarJanela = (viva: boolean, porque?: string) => {
    if (parado) return
    const antes = useSonsEmJanela.getState().emJanela
    gravarArmazem(sessaoDoNavegador, CHAVE_ABERTA, viva ? '1' : null)
    gravarArmazem(localDoNavegador, CHAVE_LEMBRADA, viva ? '1' : null)
    espelhar(viva)
    if (antes === viva) return
    useSonsEmJanela.setState({ emJanela: viva })
    if (!viva && porque !== undefined) avisar(porque)
  }

  const aplicarPedido = (id: number, pedido: PedidoDosSons) => {
    switch (pedido.acao) {
      case 'tocar': {
        const efeito = useBibliotecaDeSonsStore.getState().biblioteca.efeitos.find((candidato) => candidato.id === pedido.efeitoId)
        if (efeito === undefined) return
        const { rede } = fios.ponte.tocar(efeito, ALVO_TODOS, { local: true })
        responder(id, { tipo: 'tocou', limiteNaMesa: rede !== null && !rede.ok && rede.motivo === 'limite-de-loops' })
        return
      }
      case 'parar':
        fios.ponte.parar(pedido.efeitoId)
        return
      case 'pararTudo':
        fios.ponte.pararTudo()
        return
      case 'mudarVolume':
        fios.ponte.mudarVolume(pedido.efeitoId, pedido.volume)
        return
      case 'provar':
        // A recusa chega pelos eventos do motor, como na página.
        fios.motor.tocar(pedido.instancia, pedido.fonte, { loop: pedido.loop, volumeDoEfeito: pedido.volume })
        return
      case 'pararProva':
        fios.motor.parar(pedido.instancia)
        return
      case 'amostra':
        tocarAmostra(SOM_DE_AMOSTRA)
        return
      case 'volumeDoAparelho':
        vez = pedido.vez
        useSomStore.getState().setVolume(pedido.volume)
        agendarEstado()
        return
      case 'mudo':
        vez = pedido.vez
        if (useSomStore.getState().mudo !== pedido.mudo) useSomStore.getState().alternarMudo()
        agendarEstado()
        return
      case 'biblioteca':
        vez = pedido.vez
        aplicarMudanca(pedido.mudanca)
        // Também na recusa: o espelho com esta vez desfaz o que a janela já mostrava.
        agendarEstado()
        return
      case 'importar':
        void useBibliotecaDeSonsStore
          .getState()
          .importarArquivoDeSom(pedido.nome, pedido.bytes, pedido.parte)
          .then(
            (efeito) => responder(id, { tipo: 'importado', nome: efeito.nome }),
            (erro: unknown) => responder(id, { tipo: 'erro', motivo: mensagemDoErro(erro) }),
          )
        return
      case 'medir': {
        const pasta = useBibliotecaDeSonsStore.getState().pasta
        if (pasta === null) {
          responder(id, { tipo: 'erro', motivo: 'A biblioteca de sons ainda não foi lida.' })
          return
        }
        void arquivosDaMidiaDaPasta(pasta).then(
          (arquivos) => responder(id, { tipo: 'arquivos', arquivos }),
          (erro: unknown) => responder(id, { tipo: 'erro', motivo: mensagemDoErro(erro) }),
        )
        return
      }
      case 'bytes':
        void carregarBytesDoMestre(pedido.midia).then(
          (bytes) => responder(id, { tipo: 'bytes', bytes }),
          (erro: unknown) => responder(id, { tipo: 'erro', motivo: mensagemDoErro(erro) }),
        )
        return
    }
  }

  const desligarCanal = canal.ouvir((dado) => {
    const mensagem = lerMensagemDaJanela(dado, sessao)
    if (mensagem === null) return
    switch (mensagem.tipo) {
      case 'ola':
      case 'ping':
        ultimoPing = Date.now()
        // A janela também confere se a principal vive (F5 nela, travada): o pong responde.
        mandar({ tipo: 'pong' })
        // Janela nova ou recarregada: a conta das mudanças dela recomeça do zero.
        if (mensagem.tipo === 'ola') vez = 0
        // A janela é a página Sons agora: o livro mostra o aviso (e o espelho começa, com tudo o que já soa).
        if (!useSonsEmJanela.getState().emJanela || pararDeEspelhar === null) marcarJanela(true)
        else if (mensagem.tipo === 'ola') mandarTudo()
        return
      case 'adeus':
        marcarJanela(false, FECHOU)
        return
      case 'voltar':
        void trazerParaOApp()
        return
      case 'pedido':
        aplicarPedido(mensagem.id, mensagem.pedido)
        return
    }
  })

  // O X do sistema na janela do Tauri (o `adeus` do `pagehide` pode não chegar antes de ela morrer).
  if (isTauri()) {
    listen(EVENTO_FECHADA, () => marcarJanela(false, FECHOU))
      .then((desligar) => {
        if (parado) desligar()
        else desligarEvento = desligar
      })
      .catch(() => {
        // Sem o evento, a janela fechada cai pelo prazo do ping.
      })
  }

  const vigia = setInterval(() => {
    if (useSonsEmJanela.getState().emJanela && Date.now() - ultimoPing > VIVA_MS) marcarJanela(false, PAROU)
  }, VIGIA_MS)

  // Fechar ou recarregar a principal: a janela mostra "esperando o app" até ela voltar (ou o Rust a fechar).
  const aoSair = () => mandar({ tipo: 'saiu' })
  window.addEventListener('pagehide', aoSair)

  const mostrarJanela = async () => {
    if (!isTauri()) return
    try {
      await invoke<boolean>('abrir_janela_sons', { sessao })
    } catch (erro) {
      avisar(`Os sons não abriram em janela: ${mensagemDoErro(erro)}`)
      return
    }
    ultimoPing = Date.now()
    marcarJanela(true)
  }

  const trazerParaOApp = async () => {
    mandar({ tipo: 'fechar' })
    // Antes de esperar o Rust: o `adeus` da janela que fecha chega depois e não vira o aviso de janela fechada.
    marcarJanela(false)
    try {
      if (isTauri()) await invoke('fechar_janela_sons')
    } catch {
      // A janela já tinha fechado: nada a fazer.
    }
  }

  if (lerArmazem(sessaoDoNavegador, CHAVE_ABERTA) === '1') {
    // A principal recarregou com a janela aberta: escuta por ela e manda o estado já (o primeiro ping confirma).
    ultimoPing = Date.now()
    useSonsEmJanela.setState({ emJanela: true })
    espelhar(true)
  } else if (isTauri() && lerArmazem(localDoNavegador, CHAVE_LEMBRADA) === '1') {
    // O app abriu de novo com os sons deixados em janela: a janela volta sozinha.
    void mostrarJanela()
  }

  return {
    abrirEmJanela: mostrarJanela,
    trazerParaOApp,
    parar() {
      // A página saiu (o editor voltou ao menu): a janela espera o app voltar, como no F5.
      mandar({ tipo: 'saiu' })
      parado = true
      clearInterval(vigia)
      window.removeEventListener('pagehide', aoSair)
      desligarEvento?.()
      desligarMotor()
      desligarCanal()
      espelhar(false)
      canal.fechar()
    },
  }
}

/** Só o app abre janela do Windows: no navegador o botão nem aparece. */
export function podeAbrirSonsEmJanela(): boolean {
  return isTauri()
}

/**
 * Liga o fio desta principal (a página Sons do livro, sempre montada, liga na
 * montagem: a janela que sobreviveu ao F5 precisa da principal escutando antes
 * do primeiro clique). Devolve o desligar.
 */
export function ligarSonsEmJanela(fios: FiosDosSons, avisar: Avisar, abrirCanal: (nome: string) => Canal = abrirCanalDoNavegador): () => void {
  controle?.parar()
  const meu = criarControle(fios, avisar, abrirCanal)
  controle = meu
  return () => {
    meu.parar()
    if (controle === meu) {
      controle = null
      // Sem o fio, a página do livro mostra os sons de novo (a janela fica esperando o app voltar).
      useSonsEmJanela.setState({ emJanela: false })
    }
  }
}

/** Abre (ou traz para a frente) a janela dos sons. */
export function abrirSonsEmJanela(): Promise<void> {
  return controle?.abrirEmJanela() ?? Promise.resolve()
}

/** Fecha a janela dos sons e põe a página de volta no livro. */
export function trazerSonsParaOApp(): Promise<void> {
  return controle?.trazerParaOApp() ?? Promise.resolve()
}
