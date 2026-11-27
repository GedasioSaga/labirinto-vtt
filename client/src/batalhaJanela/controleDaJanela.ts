import { invoke, isTauri } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { create } from 'zustand'
import { abrirCanalDoNavegador, type Canal } from '../net/visaoDeTeste/canal'
import { aplicarPedido, assinarEspelho } from './mesa'
import { mostrarMiraDaMesa } from './miraDaMesa'
import { lerMensagemDaJanela, nomeDoCanal, PAGINA_DA_JANELA, SESSAO_VALIDA, type MensagemDaMesa } from './protocolo'
import { fecharOMenuDoMapa } from './telaDaMesa'

/**
 * COMO O MESTRE CONDUZ A BATALHA, visto da janela principal, e o fio com a
 * janela da batalha (o molde do Prelúdio, `preludio/janela/mesaDoPreludio.ts`).
 *
 * Pedido de 27/11/2026 ("era para eu poder escolher entre 3"): um modo de cada
 * vez, nunca dois, e um estado só para ele (`modo`):
 * - `janela`: a mesa numa janela do Windows à parte (pode ir ao 2º monitor);
 * - `minimalista`: a mesa compacta encostada na direita do mapa (a doca);
 * - `jogador`: na vez do NPC, o menu grande no meio do mapa, o mesmo do jogador.
 * `voltaDaJanela` só lembra o último modo no app, para onde a batalha volta
 * quando a janela fecha. Os dois ficam neste aparelho entre as sessões.
 *
 * A janela é aberta pelo Rust (`abrir_janela_batalha`) ou, no navegador, num
 * popup. A sessão (o nome do canal) mora no `sessionStorage`: recarregar a
 * principal (F5) com a janela aberta mantém a sessão, a janela continua no
 * mesmo canal e recebe o estado de novo assim que a principal volta. Fechar
 * a janela (o X do sistema) volta ao modo de antes dela; fechar a principal
 * derruba a janela (Rust, `janela_batalha.rs`) e o modo `janela` fica
 * lembrado: na próxima batalha a janela abre sozinha.
 */

export type ModoDaBatalha = 'janela' | 'minimalista' | 'jogador'
export type ModoNoApp = Exclude<ModoDaBatalha, 'janela'>

interface EstadoDaMesa {
  modo: ModoDaBatalha
  voltaDaJanela: ModoNoApp
}

const CHAVE_DO_MODO = 'lb-batalha:modo-da-mesa'
const CHAVE_DA_VOLTA = 'lb-batalha:volta-da-janela'
const MODO_PADRAO: ModoNoApp = 'minimalista'

function ehModoNoApp(valor: string | null): valor is ModoNoApp {
  return valor === 'minimalista' || valor === 'jogador'
}

/** O `localStorage` deste aparelho; fora do navegador ou bloqueado = `null`. */
function armazemDoAparelho(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** O modo da última sessão; nada guardado, guardado torto ou armazenamento bloqueado = a mesa minimalista. */
function modoLembrado(): EstadoDaMesa {
  const armazem = armazemDoAparelho()
  const modo = armazem === null ? null : lerArmazem(armazem, CHAVE_DO_MODO)
  const volta = armazem === null ? null : lerArmazem(armazem, CHAVE_DA_VOLTA)
  const voltaDaJanela = ehModoNoApp(volta) ? volta : MODO_PADRAO
  return { modo: modo === 'janela' || ehModoNoApp(modo) ? modo : voltaDaJanela, voltaDaJanela }
}

export const useMesaDaBatalha = create<EstadoDaMesa>(() => modoLembrado())

/**
 * O único lugar que troca o modo. O menu do mapa que a mesa pediu fecha junto: ele é um passo da mesa, e
 * sobrava aberto ao lado da doca quando a janela fechava (os "dois negócios de luta" de 27/11/2026).
 */
function mudarModo(modo: ModoDaBatalha): void {
  const antes = useMesaDaBatalha.getState()
  if (antes.modo === modo) return
  const voltaDaJanela = modo === 'janela' ? antes.voltaDaJanela : modo
  useMesaDaBatalha.setState({ modo, voltaDaJanela })
  fecharOMenuDoMapa()
  const armazem = armazemDoAparelho()
  if (armazem === null) return
  gravarArmazem(armazem, CHAVE_DO_MODO, modo)
  gravarArmazem(armazem, CHAVE_DA_VOLTA, voltaDaJanela)
}

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
  /** Abre a janela (ou a traz para a frente) e põe a batalha no modo `janela`. */
  mostrarJanela(): Promise<void>
  /** Abre a janela só se ela não está viva: o modo `janela` lembrado da última sessão. */
  garantirJanela(): Promise<void>
  /** Fecha a janela; a batalha vai para `destino` (sem ele, para o modo de antes da janela). */
  trazerParaOApp(destino?: ModoNoApp): Promise<void>
  parar(): void
}

/** O aviso de quando a janela some sem o mestre pedir: diz para onde a batalha voltou. */
function avisoDaVolta(porque: 'fechou' | 'parou', destino: ModoNoApp): string {
  const inicio = porque === 'fechou' ? 'A janela da batalha fechou' : 'A janela da batalha parou de responder'
  return destino === 'jogador' ? `${inicio}: a batalha voltou para o menu do jogador, no meio do mapa.` : `${inicio}: a mesa minimalista voltou para o app.`
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
  /** A janela da batalha está viva (respondeu há pouco). Fato do fio, não modo: o modo mora em `useMesaDaBatalha`. */
  let viva = false
  let abrindo: Promise<void> | null = null
  let parado = false
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

  /** A janela está viva: o fio espelha a batalha para ela, e o modo passa a ser `janela`. */
  const ganharJanela = () => {
    viva = true
    gravarArmazem(window.sessionStorage, CHAVE_ABERTA, '1')
    espelhar(true)
    mudarModo('janela')
  }

  /**
   * A janela fechou, sumiu ou não abriu: o fio para de espelhar, e a batalha sai do modo `janela` para
   * `destino`. Só um modo de cada vez: a mesa minimalista OU o menu do jogador, o que o mestre usava antes.
   */
  const perderJanela = (destino: ModoNoApp, porque: 'fechou' | 'parou' | null) => {
    const estava = viva
    viva = false
    gravarArmazem(window.sessionStorage, CHAVE_ABERTA, null)
    espelhar(false)
    // A janela que fecha (ou some) não manda o "apagar": a mira que ela pôs no mapa apaga aqui.
    if (estava) mostrarMiraDaMesa(null)
    if (useMesaDaBatalha.getState().modo === 'janela') mudarModo(destino)
    if (estava && porque !== null) avisar(avisoDaVolta(porque, destino))
  }

  const voltaDaJanela = (): ModoNoApp => useMesaDaBatalha.getState().voltaDaJanela

  canal.ouvir((dado) => {
    const mensagem = lerMensagemDaJanela(dado, sessao)
    if (mensagem === null) return
    switch (mensagem.tipo) {
      case 'ola':
      case 'ping':
        ultimoPing = Date.now()
        // A janela também confere se a principal vive (F5 nela, travada): o pong responde.
        mandar({ tipo: 'pong' })
        if (!viva) {
          // A janela é a mesa agora: a doca e o menu do jogador saem da frente do mapa.
          ganharJanela()
        } else if (mensagem.tipo === 'ola' && pararDeEspelhar !== null) {
          // Janela recarregada (F5 nela): manda o espelho de novo, sem esperar mudança.
          espelhar(false)
          espelhar(true)
        }
        return
      case 'adeus':
        perderJanela(voltaDaJanela(), 'fechou')
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
    listen(EVENTO_FECHADA, () => perderJanela(voltaDaJanela(), 'fechou'))
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
      perderJanela(voltaDaJanela(), 'fechou')
      return
    }
    if (viva && Date.now() - ultimoPing > VIVA_MS) perderJanela(voltaDaJanela(), 'parou')
  }, VIGIA_MS)

  // A principal recarregou com a janela aberta: escuta por ela e manda o estado já (o primeiro ping confirma).
  if (lerArmazem(window.sessionStorage, CHAVE_ABERTA) === '1') {
    ultimoPing = Date.now()
    ganharJanela()
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

  const abrirOuTrazerParaFrente = async () => {
    try {
      if (isTauri()) await invoke<boolean>('abrir_janela_batalha', { sessao })
      else if (popup !== null && !popup.closed) popup.focus()
      else abrirNoNavegador()
    } catch (erro) {
      avisar(`A mesa da batalha não abriu em janela: ${erro instanceof Error ? erro.message : String(erro)}`)
      // A janela lembrada da última sessão que não abriu: a batalha fica no modo de antes dela, e não num vazio.
      if (!viva && !parado) perderJanela(voltaDaJanela(), null)
      return
    }
    // O fio desligou enquanto a janela abria (o App desmontou): o fio novo acha a janela pelo primeiro ping.
    if (parado) return
    ultimoPing = Date.now()
    ganharJanela()
  }

  // Um pedido de abrir de cada vez: o clique do mestre e a janela lembrada não abrem duas.
  const mostrarJanela = () => {
    abrindo ??= abrirOuTrazerParaFrente().finally(() => {
      abrindo = null
    })
    return abrindo
  }

  const trazerParaOApp = async (destino?: ModoNoApp) => {
    mandar({ tipo: 'fechar' })
    try {
      if (isTauri()) await invoke('fechar_janela_batalha')
    } catch {
      // A janela já tinha fechado: nada a fazer.
    }
    if (popup !== null && !popup.closed) popup.close()
    popup = null
    perderJanela(destino ?? voltaDaJanela(), null)
  }

  return {
    mostrarJanela,
    garantirJanela: () => (viva ? Promise.resolve() : mostrarJanela()),
    trazerParaOApp,
    parar() {
      parado = true
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
  if (garantirAoLigar) {
    garantirAoLigar = false
    if (useMesaDaBatalha.getState().modo === 'janela') void meu.garantirJanela()
  }
  return () => {
    meu.parar()
    if (controle === meu) controle = null
  }
}

/**
 * O seletor de 3 da página Batalha (e os atalhos da doca e da pílula): troca o modo. `janela` abre a janela
 * (o modo muda quando ela abre de fato); sair da janela para outro modo fecha a janela antes.
 */
export function escolherModoDaBatalha(modo: ModoDaBatalha): Promise<void> {
  if (modo === 'janela') return abrirMesaEmJanela()
  if (useMesaDaBatalha.getState().modo === 'janela' && controle !== null) return controle.trazerParaOApp(modo)
  mudarModo(modo)
  return Promise.resolve()
}

/** Abre (ou traz para a frente) a janela da batalha. */
export function abrirMesaEmJanela(): Promise<void> {
  return controle?.mostrarJanela() ?? Promise.resolve()
}

/**
 * O `garantir` que chegou antes de o fio ligar: o efeito da tela (filha) roda antes do efeito do App que liga o
 * fio, e a batalha já à vista na montagem pedia a janela para ninguém. O fio cumpre ao ligar.
 */
let garantirAoLigar = false

/** O modo `janela` lembrado da última sessão, com a batalha à vista: abre a janela se ela ainda não está aberta. */
export function garantirAJanelaDaBatalha(): Promise<void> {
  if (controle === null) {
    garantirAoLigar = true
    return Promise.resolve()
  }
  return controle.garantirJanela()
}

/** Fecha a janela da batalha e volta ao modo de antes dela (a mesa minimalista ou o menu do jogador). */
export function trazerMesaParaOApp(): Promise<void> {
  return controle?.trazerParaOApp() ?? Promise.resolve()
}
