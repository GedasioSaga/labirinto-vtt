import { invoke, isTauri } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { create } from 'zustand'
import { abrirCanalDoNavegador, type Canal } from '../net/visaoDeTeste/canal'
import { aplicarPedido, assinarEspelho } from './mesa'
import { lerMensagemDaJanela, nomeDoCanal, PAGINA_DA_JANELA, SESSAO_VALIDA, type MensagemDaMesa } from './protocolo'

/**
 * ONDE A MESA DA BATALHA ESTÁ, visto da janela principal, e o fio com a janela
 * da batalha (o molde do Prelúdio, `preludio/janela/mesaDoPreludio.ts`).
 *
 * - `noApp`: a mesa está à vista no app (a doca encostada na direita do mapa,
 *   durante a batalha); `false` = o mestre recolheu a mesa.
 * - `emJanela`: a janela da batalha está viva (respondeu há pouco).
 *
 * A janela é aberta pelo Rust (`abrir_janela_batalha`) ou, no navegador, num
 * popup. A sessão (o nome do canal) mora no `sessionStorage`: recarregar a
 * principal (F5) com a janela aberta mantém a sessão, a janela continua no
 * mesmo canal e recebe o estado de novo assim que a principal volta. Fechar
 * a janela (o X do sistema) volta a mesa para o app; fechar a principal
 * derruba a janela (Rust, `janela_batalha.rs`).
 */

interface EstadoDaMesa {
  noApp: boolean
  emJanela: boolean
}

export const useMesaDaBatalha = create<EstadoDaMesa>(() => ({ noApp: true, emJanela: false }))

const CHAVE_DA_SESSAO = 'lb-batalha:sessao-da-janela'
/** A janela estava aberta quando a principal recarregou: a principal volta escutando por ela. */
const CHAVE_ABERTA = 'lb-batalha:janela-aberta'
const NOME_DO_POPUP = 'labirinto-batalha'
const EVENTO_FECHADA = 'batalha-janela:fechada'
/** Sem `ping` por isto, a janela conta como fechada (sumiu no navegador, travou). */
const VIVA_MS = 6000
const VIGIA_MS = 1000

type Avisar = (texto: string) => void
/** A mensagem sem o envelope (o lado e a sessão entram no `mandar`). */
type SemEnvelope<T> = T extends unknown ? Omit<T, 'de' | 'sessao'> : never

interface Controle {
  abrirEmJanela(): Promise<void>
  trazerParaOApp(): Promise<void>
  mostrarJanela(): Promise<void>
  parar(): void
}

let controle: Controle | null = null

function lerArmazem(armazem: Storage, chave: string): string | null {
  try {
    return armazem.getItem(chave)
  } catch {
    return null
  }
}

function gravarArmazem(armazem: Storage, chave: string, valor: string | null): void {
  try {
    if (valor === null) armazem.removeItem(chave)
    else armazem.setItem(chave, valor)
  } catch {
    // Sem armazenamento (modo privado): a janela só não sobrevive ao F5 da principal.
  }
}

function sessaoDestaPrincipal(): string {
  const guardada = lerArmazem(window.sessionStorage, CHAVE_DA_SESSAO)
  if (guardada !== null && SESSAO_VALIDA.test(guardada)) return guardada
  const nova = crypto.randomUUID()
  gravarArmazem(window.sessionStorage, CHAVE_DA_SESSAO, nova)
  return nova
}

function criarControle(avisar: Avisar, abrirCanal: (nome: string) => Canal): Controle {
  const sessao = sessaoDestaPrincipal()
  const canal = abrirCanal(nomeDoCanal(sessao))
  let ultimoPing = 0
  let popup: Window | null = null
  let pararDeEspelhar: (() => void) | null = null
  let desligarEvento: (() => void) | null = null

  const mandar = (corpo: SemEnvelope<MensagemDaMesa>) => canal.enviar({ de: 'mesa', sessao, ...corpo })

  const espelhar = (ligar: boolean) => {
    if (ligar && pararDeEspelhar === null) pararDeEspelhar = assinarEspelho((espelho) => mandar({ tipo: 'estado', espelho }))
    if (!ligar && pararDeEspelhar !== null) {
      pararDeEspelhar()
      pararDeEspelhar = null
    }
  }

  const marcarJanela = (viva: boolean, porque?: string) => {
    const antes = useMesaDaBatalha.getState().emJanela
    gravarArmazem(window.sessionStorage, CHAVE_ABERTA, viva ? '1' : null)
    espelhar(viva)
    if (antes === viva) return
    // A janela fechou: a mesa volta à vista no app (a doca), mesmo se estava recolhida antes de ir para a janela.
    useMesaDaBatalha.setState(viva ? { emJanela: true } : { emJanela: false, noApp: true })
    if (!viva && porque !== undefined) avisar(porque)
  }

  canal.ouvir((dado) => {
    const mensagem = lerMensagemDaJanela(dado, sessao)
    if (mensagem === null) return
    switch (mensagem.tipo) {
      case 'ola':
      case 'ping':
        ultimoPing = Date.now()
        // A janela também confere se a principal vive (F5 nela, travada): o pong responde.
        mandar({ tipo: 'pong' })
        if (!useMesaDaBatalha.getState().emJanela) {
          // A janela é a mesa agora: o diálogo do app sai da frente do mapa.
          useMesaDaBatalha.setState({ noApp: false })
          marcarJanela(true)
        } else if (mensagem.tipo === 'ola' && pararDeEspelhar !== null) {
          // Janela recarregada (F5 nela): manda o espelho de novo, sem esperar mudança.
          espelhar(false)
          espelhar(true)
        }
        return
      case 'adeus':
        marcarJanela(false, 'A janela da batalha fechou: a mesa da batalha voltou para o app.')
        return
      case 'voltar':
        void trazerParaOApp()
        return
      case 'pedido':
        mandar({ tipo: 'resposta', id: mensagem.id, resposta: aplicarPedido(mensagem.pedido) })
        return
    }
  })

  // O X do sistema na janela do Tauri (o `adeus` do `pagehide` pode não chegar antes de ela morrer).
  if (isTauri()) {
    listen(EVENTO_FECHADA, () => marcarJanela(false, 'A janela da batalha fechou: a mesa da batalha voltou para o app.'))
      .then((parar) => {
        desligarEvento = parar
      })
      .catch(() => {
        // Sem o evento, a janela fechada cai pelo prazo do ping.
      })
  }

  const vigia = setInterval(() => {
    if (popup !== null && popup.closed) {
      popup = null
      marcarJanela(false, 'A janela da batalha fechou: a mesa da batalha voltou para o app.')
      return
    }
    if (useMesaDaBatalha.getState().emJanela && Date.now() - ultimoPing > VIVA_MS) marcarJanela(false, 'A janela da batalha parou de responder: a mesa da batalha voltou para o app.')
  }, VIGIA_MS)

  // A principal recarregou com a janela aberta: escuta por ela e manda o estado já (o primeiro ping confirma).
  if (lerArmazem(window.sessionStorage, CHAVE_ABERTA) === '1') {
    ultimoPing = Date.now()
    useMesaDaBatalha.setState({ emJanela: true })
    espelhar(true)
  }

  // Fechar ou recarregar a principal: a janela mostra "esperando a mesa" até ela voltar (ou o Rust a fechar).
  const aoSair = () => mandar({ tipo: 'saiu' })
  window.addEventListener('pagehide', aoSair)

  const abrirNoNavegador = () => {
    const aberto = window.open(`${PAGINA_DA_JANELA}?sessao=${encodeURIComponent(sessao)}`, NOME_DO_POPUP, 'popup,width=1200,height=800')
    if (aberto === null) throw new Error('o navegador bloqueou a janela nova (libere os popups deste endereço)')
    aberto.focus()
    popup = aberto
  }

  const mostrarJanela = async () => {
    try {
      if (isTauri()) await invoke<boolean>('abrir_janela_batalha', { sessao })
      else if (popup !== null && !popup.closed) popup.focus()
      else abrirNoNavegador()
    } catch (erro) {
      avisar(`A mesa da batalha não abriu em janela: ${erro instanceof Error ? erro.message : String(erro)}`)
      return
    }
    ultimoPing = Date.now()
    useMesaDaBatalha.setState({ noApp: false })
    marcarJanela(true)
  }

  const trazerParaOApp = async () => {
    mandar({ tipo: 'fechar' })
    try {
      if (isTauri()) await invoke('fechar_janela_batalha')
    } catch {
      // A janela já tinha fechado: nada a fazer.
    }
    if (popup !== null && !popup.closed) popup.close()
    popup = null
    marcarJanela(false)
    useMesaDaBatalha.setState({ noApp: true })
  }

  return {
    abrirEmJanela: mostrarJanela,
    mostrarJanela,
    trazerParaOApp,
    parar() {
      clearInterval(vigia)
      window.removeEventListener('pagehide', aoSair)
      desligarEvento?.()
      espelhar(false)
      canal.fechar()
    },
  }
}

/**
 * Liga o fio desta janela principal (uma vez, na montagem do App: a janela que
 * sobreviveu ao F5 precisa da principal escutando antes do primeiro clique).
 * Devolve o desligar.
 */
export function iniciarMesaDaBatalha(avisar: Avisar, abrirCanal: (nome: string) => Canal = abrirCanalDoNavegador): () => void {
  controle?.parar()
  const meu = criarControle(avisar, abrirCanal)
  controle = meu
  return () => {
    meu.parar()
    if (controle === meu) controle = null
  }
}

/** Mostra a mesa no app (a doca, durante a batalha). */
export function abrirMesaNoApp(): void {
  useMesaDaBatalha.setState({ noApp: true })
}

/** Recolhe a doca: o mapa volta inteiro, e uma pílula no alto traz a mesa de volta. */
export function fecharMesaNoApp(): void {
  useMesaDaBatalha.setState({ noApp: false })
}

/** Abre (ou traz para a frente) a janela da batalha. */
export function abrirMesaEmJanela(): Promise<void> {
  return controle?.abrirEmJanela() ?? Promise.resolve()
}

/** Fecha a janela da batalha e põe a mesa de volta na doca do app. */
export function trazerMesaParaOApp(): Promise<void> {
  return controle?.trazerParaOApp() ?? Promise.resolve()
}
