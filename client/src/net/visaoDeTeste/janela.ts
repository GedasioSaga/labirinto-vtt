import { invoke, isTauri } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { InvokeFn, ListenFn } from '../hostBridge'

/**
 * A janela separada da Visão de jogador, vista do controlador (`visaoDeTeste.ts`).
 *
 * No app (Tauri) quem cria e fecha é o Rust, por comandos próprios com rótulo
 * e endereço fixos (`abrir_visao_jogador`, `mostrar_visao_jogador`,
 * `fechar_visao_jogador`); o X do sistema volta como o evento
 * `visao-jogador:fechada`. No navegador (Vite puro) é um `window.open`.
 */

export const ROTULO_DA_JANELA = 'visao-jogador'
export const EVENTO_JANELA_FECHADA = 'visao-jogador:fechada'
/** O caminho da página da janela de teste (`client/visao-jogador.html`). */
export const PAGINA_DA_JANELA = '/visao-jogador.html'
/** De quanto em quanto tempo o navegador confere se o mestre fechou o popup (não há evento para isso). */
export const VIGIA_DO_POPUP_MS = 500

export interface JanelaDeTeste {
  /** Abre a janela da sessão `sessao` (a que houver antes é trocada). Rejeita se não abriu. */
  abrir(sessao: string): Promise<void>
  /** Traz a janela para a frente. `false` = não há janela. */
  mostrar(): Promise<boolean>
  /** Fecha a janela. Fechar de novo não faz nada. Quem fecha por aqui não recebe `aoFecharPorFora`. */
  fechar(): Promise<void>
  /** Para de vigiar o fechamento (o editor desmontou). */
  desligar(): void
}

export interface DepsDaJanelaTauri {
  invoke: InvokeFn
  listen: ListenFn
  /** O mestre fechou a janela de teste pelo X do sistema (ou ela morreu). */
  aoFecharPorFora(): void
}

/**
 * A janela pelos comandos do Rust. O evento `fechada` não diz QUAL janela
 * morreu, e abrir com uma janela já aberta destrói a velha — o evento dela
 * pode chegar antes ou depois do `abrir` responder. Por isso: durante um
 * `abrir` o evento é ignorado, e fora dele só fecha a sessão se o Rust
 * confirmar que não há janela viva (`mostrar_visao_jogador` = `false`). Se
 * houver, o evento era da janela trocada.
 */
export function criarJanelaTauri(deps: DepsDaJanelaTauri): JanelaDeTeste {
  /** Há janela desta sessão viva, até onde se sabe. */
  let aberta = false
  /** O controlador quer a janela aberta: `fechar` no meio de um `abrir` vira `false`. */
  let querAberta = false
  let abrindo = 0
  /** Muda a cada abrir e fechar: a conferência que começou antes não decide mais nada. */
  let versao = 0
  let desligada = false
  let pararDeOuvir: (() => void) | null = null

  const existeJanela = async (): Promise<boolean> => {
    try {
      return (await deps.invoke('mostrar_visao_jogador')) === true
    } catch {
      // O Rust recusou ou caiu: para o controlador, não há janela que dê para usar.
      return false
    }
  }

  const aoEventoFechada = async (): Promise<void> => {
    if (!aberta || abrindo > 0) return
    const minha = versao
    const viva = await existeJanela()
    if (versao !== minha || abrindo > 0 || !aberta || viva) return
    aberta = false
    versao += 1
    deps.aoFecharPorFora()
  }

  deps
    .listen(EVENTO_JANELA_FECHADA, () => {
      void aoEventoFechada()
    })
    .then(
      (parar) => {
        if (desligada) parar()
        else pararDeOuvir = parar
      },
      () => {
        // Sem o evento, o X do sistema ainda fecha a sessão pelo prazo do ping (`visaoDeTeste.ts`).
      },
    )

  return {
    async abrir(sessao) {
      abrindo += 1
      versao += 1
      querAberta = true
      const minha = versao
      try {
        await deps.invoke('abrir_visao_jogador', { sessao })
      } finally {
        abrindo -= 1
      }
      if (!querAberta) {
        // Fechada enquanto o Rust criava: o `fechar` pode ter chegado antes da janela existir.
        await deps.invoke('fechar_visao_jogador')
        return
      }
      // Um `abrir` mais novo responde por si.
      if (versao === minha) aberta = true
    },
    async mostrar() {
      if (!aberta) return false
      return existeJanela()
    },
    async fechar() {
      querAberta = false
      aberta = false
      versao += 1
      // Sempre: o comando é idempotente, e a janela pode estar nascendo agora.
      await deps.invoke('fechar_visao_jogador')
    },
    desligar() {
      desligada = true
      pararDeOuvir?.()
      pararDeOuvir = null
    },
  }
}

/** O pedaço do `Window` do popup que a janela de teste usa. */
export interface PopupDaJanela {
  readonly closed: boolean
  focus(): void
  close(): void
}

export interface DepsDaJanelaDoNavegador {
  /** `window.open` com o nome fixo: abrir de novo reaproveita o mesmo popup. `null` = bloqueado. */
  abrirPopup(url: string): PopupDaJanela | null
  aoFecharPorFora(): void
  intervaloMs?: number
}

/** A janela no navegador: um popup, vigiado pelo `closed` (o navegador não avisa quando o mestre fecha). */
export function criarJanelaDoNavegador(deps: DepsDaJanelaDoNavegador): JanelaDeTeste {
  let popup: PopupDaJanela | null = null
  let vigia: ReturnType<typeof setInterval> | null = null
  const pararDeVigiar = () => {
    if (vigia !== null) clearInterval(vigia)
    vigia = null
  }
  return {
    async abrir(sessao) {
      pararDeVigiar()
      const aberto = deps.abrirPopup(`${PAGINA_DA_JANELA}?sessao=${encodeURIComponent(sessao)}`)
      if (aberto === null) throw new Error('o navegador bloqueou a janela nova')
      popup = aberto
      vigia = setInterval(() => {
        if (popup !== aberto || !aberto.closed) return
        pararDeVigiar()
        popup = null
        deps.aoFecharPorFora()
      }, deps.intervaloMs ?? VIGIA_DO_POPUP_MS)
    },
    async mostrar() {
      if (popup === null || popup.closed) return false
      popup.focus()
      return true
    },
    async fechar() {
      pararDeVigiar()
      const atual = popup
      popup = null
      if (atual !== null && !atual.closed) atual.close()
    },
    desligar: pararDeVigiar,
  }
}

/** A janela certa para onde o editor está: comandos do Rust no app, popup no navegador. */
export function criarJanelaDoSistema(aoFecharPorFora: () => void): JanelaDeTeste {
  if (isTauri()) return criarJanelaTauri({ invoke, listen, aoFecharPorFora })
  return criarJanelaDoNavegador({
    abrirPopup: (url) => window.open(url, ROTULO_DA_JANELA, 'popup,width=1100,height=750'),
    aoFecharPorFora,
  })
}
