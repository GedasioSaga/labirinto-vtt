import type { EspelhoDaBatalha, PedidoDaMesa, RespostaDaMesa } from './tipos'

/**
 * O FIO entre a janela principal (a MESA) e a janela da batalha, pelo
 * `BroadcastChannel` de nome secreto (a sessão; o mesmo molde da Visão de
 * jogador e do Prelúdio). Toda mensagem leva a sessão e o lado de quem manda;
 * a mesa só aplica o pedido que passa por `lerMensagemDaJanela`: nada de campo
 * a mais, texto comprido ou ação fora da lista.
 */

/** O formato da sessão: o mesmo que o Rust aceita (`sessao_valida`). */
export const SESSAO_VALIDA = /^[A-Za-z0-9-]{8,64}$/

/** A página da janela da batalha (`client/batalha.html`). */
export const PAGINA_DA_JANELA = '/batalha.html'

/** O nome do canal desta sessão. */
export function nomeDoCanal(sessao: string): string {
  return `labirinto-batalha-${sessao}`
}

/** Ids e chaves que andam no fio: os da store são curtos (`carta_…`, `linha_…`, `golpe|token`). */
const ID_MAX = 200
const ALVOS_MAX = 24

/** Da janela para a mesa. */
export type MensagemDaJanela =
  | { de: 'janela'; sessao: string; tipo: 'ola' }
  | { de: 'janela'; sessao: string; tipo: 'ping' }
  | { de: 'janela'; sessao: string; tipo: 'adeus' }
  | { de: 'janela'; sessao: string; tipo: 'voltar' }
  | { de: 'janela'; sessao: string; tipo: 'pedido'; id: number; pedido: PedidoDaMesa }

/** Da mesa para a janela. */
export type MensagemDaMesa =
  | { de: 'mesa'; sessao: string; tipo: 'estado'; espelho: EspelhoDaBatalha | null }
  | { de: 'mesa'; sessao: string; tipo: 'resposta'; id: number; resposta: RespostaDaMesa }
  | { de: 'mesa'; sessao: string; tipo: 'pong' }
  | { de: 'mesa'; sessao: string; tipo: 'saiu' }
  | { de: 'mesa'; sessao: string; tipo: 'fechar' }

function objeto(dado: unknown): Record<string, unknown> | null {
  return typeof dado === 'object' && dado !== null && !Array.isArray(dado) ? (dado as Record<string, unknown>) : null
}

function id(valor: unknown): string | null {
  return typeof valor === 'string' && valor.length > 0 && valor.length <= ID_MAX ? valor : null
}

/** O pedido inteiro, campo a campo; torto = `null`. */
export function lerPedido(dado: unknown): PedidoDaMesa | null {
  const o = objeto(dado)
  if (o === null) return null
  const sceneKey = id(o.sceneKey)
  if (sceneKey === null) return null
  switch (o.acao) {
    case 'passar': {
      const vez = id(o.vez)
      return vez === null ? null : { acao: 'passar', sceneKey, vez }
    }
    case 'darVez': {
      const cartaId = id(o.cartaId)
      return cartaId === null ? null : { acao: 'darVez', sceneKey, cartaId }
    }
    case 'agir': {
      const vez = id(o.vez)
      const golpe = id(o.golpe)
      if (vez === null || golpe === null || !Array.isArray(o.alvos) || o.alvos.length > ALVOS_MAX) return null
      const alvos: string[] = []
      for (const alvo of o.alvos) {
        const lido = id(alvo)
        if (lido === null) return null
        alvos.push(lido)
      }
      return { acao: 'agir', sceneKey, vez, golpe, alvos }
    }
    case 'responder': {
      const pendente = id(o.pendente)
      const resposta = id(o.resposta)
      return pendente === null || resposta === null ? null : { acao: 'responder', sceneKey, pendente, resposta }
    }
    case 'desfazer': {
      const linhaId = id(o.linhaId)
      return linhaId === null ? null : { acao: 'desfazer', sceneKey, linhaId }
    }
    case 'iniciativa':
      return o.passo === 'rolar' || o.passo === 'comecar' ? { acao: 'iniciativa', sceneKey, passo: o.passo } : null
    case 'encerrar':
      return { acao: 'encerrar', sceneKey }
    default:
      return null
  }
}

/** A mensagem da janela desta sessão; outra sessão, outro lado ou forma torta = `null`. */
export function lerMensagemDaJanela(dado: unknown, sessao: string): MensagemDaJanela | null {
  const o = objeto(dado)
  if (o === null || o.de !== 'janela' || o.sessao !== sessao) return null
  switch (o.tipo) {
    case 'ola':
    case 'ping':
    case 'adeus':
    case 'voltar':
      return { de: 'janela', sessao, tipo: o.tipo }
    case 'pedido': {
      if (typeof o.id !== 'number' || !Number.isSafeInteger(o.id)) return null
      const pedido = lerPedido(o.pedido)
      return pedido === null ? null : { de: 'janela', sessao, tipo: 'pedido', id: o.id, pedido }
    }
    default:
      return null
  }
}

/**
 * A mensagem da mesa desta sessão. A janela confia na mesa (a mesma origem e o
 * mesmo app; ela só mostra): confere o envelope, não o espelho campo a campo.
 */
export function lerMensagemDaMesa(dado: unknown, sessao: string): MensagemDaMesa | null {
  const o = objeto(dado)
  if (o === null || o.de !== 'mesa' || o.sessao !== sessao) return null
  switch (o.tipo) {
    case 'estado':
      return objeto(o.espelho) === null && o.espelho !== null ? null : (o as unknown as MensagemDaMesa)
    case 'resposta': {
      const resposta = objeto(o.resposta)
      if (typeof o.id !== 'number' || resposta === null || typeof resposta.ok !== 'boolean') return null
      return { de: 'mesa', sessao, tipo: 'resposta', id: o.id, resposta: { ok: resposta.ok, motivo: typeof resposta.motivo === 'string' ? resposta.motivo : null } }
    }
    case 'pong':
    case 'saiu':
    case 'fechar':
      return { de: 'mesa', sessao, tipo: o.tipo }
    default:
      return null
  }
}
