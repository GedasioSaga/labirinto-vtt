import type { MensagemDoChatDoServidor, PedidoDoChat } from '../../lib/nuvem/chatDoLobby'
import type { MensagemDoMuralDoServidor, PedidoDoMural } from '../../lib/nuvem/muralDoLobby'
import type { MensagemDoCliente, MensagemDoServidor, Papel } from '../../lib/nuvem/tipos'

/**
 * A FONTE DOS DADOS do site do Lobby (docs/planos/lobby-jogadores-2026-11-05.md
 * §5.4, fatia S2): de onde o site tira quem é a pessoa, as campanhas dela e o
 * canal de cada campanha. Duas fontes com o mesmo formato:
 * - a real (`fonteReal.ts`): `GET /api/eu` e o WebSocket `/api/c/:id/ws`,
 *   na mesma origem, atrás do Access;
 * - a demo (`fonteDemo.ts`, `?demo=1`): dados inventados e um servidor de
 *   mentira no próprio navegador, com o mesmo núcleo do servidor de verdade.
 * A sessão da campanha (`sessaoDaCampanha.ts`) não sabe qual das duas está usando.
 */

/** Uma linha do `/api/eu` (o DO Diretório, `lobby/nuvem/src/diretorio.ts`). */
export interface CampanhaDoEu {
  campanhaId: string
  nomeDaCampanha: string
  papel: Papel
}

/** `GET /api/eu`: o próprio e-mail (só aqui ele volta, §6.4) e as campanhas dele. */
export interface Eu {
  email: string
  campanhas: CampanhaDoEu[]
}

/**
 * Por que o canal fechou:
 * - `rede`: caiu, ou nem abriu (sem internet, servidor fora, upgrade recusado
 *   por bloqueio ou por abas demais) — a sessão tenta de novo sozinha;
 * - `sem-acesso`: o servidor disse que a pessoa não está nesta campanha
 *   (removida, ou trocou de e-mail) — tentar de novo não adianta.
 */
export type MotivoDoFechamento = 'rede' | 'sem-acesso'

/**
 * Tudo o que chega pelo canal da campanha: o protocolo das fichas (§5.4), o
 * do chat (`chat.*`, fatia C2) e o do mural (`mural.*`, fatia M2), que andam
 * pela MESMA conexão.
 */
export type MensagemDoSite = MensagemDoServidor | MensagemDoChatDoServidor | MensagemDoMuralDoServidor

/** Tudo o que o site manda pelo canal: o protocolo das fichas e os pedidos do chat e do mural. */
export type PedidoDoSite = MensagemDoCliente | PedidoDoChat | PedidoDoMural

/** O frame é do chat (`chat.*`)? */
export function ehDoChat(mensagem: MensagemDoSite): mensagem is MensagemDoChatDoServidor {
  return mensagem.t.startsWith('chat.')
}

/** O pedido é do chat (`chat.*`)? */
export function ehPedidoDoChat(pedido: PedidoDoSite): pedido is PedidoDoChat {
  return pedido.t.startsWith('chat.')
}

/** O frame é do mural (`mural.*`)? */
export function ehDoMural(mensagem: MensagemDoSite): mensagem is MensagemDoMuralDoServidor {
  return mensagem.t.startsWith('mural.')
}

/** O pedido é do mural (`mural.*`)? */
export function ehPedidoDoMural(pedido: PedidoDoSite): pedido is PedidoDoMural {
  return pedido.t.startsWith('mural.')
}

export interface OuvinteDoCanal {
  aoAbrir(): void
  aoReceber(mensagem: MensagemDoSite): void
  aoFechar(motivo: MotivoDoFechamento): void
}

export interface Canal {
  /** `false` = o canal não está aberto (a mensagem não saiu). */
  enviar(mensagem: PedidoDoSite): boolean
  /** Fecha sem avisar o ouvinte (quem fecha já sabe). */
  fechar(): void
}

export interface FonteDoLobby {
  /** A demo (`?demo=1`): os dados são inventados e nada sai do navegador. */
  readonly demo: boolean
  buscarEu(): Promise<Eu>
  abrirCanal(campanhaId: string, ouvinte: OuvinteDoCanal): Canal
}

/** O relógio da sessão, injetado: os testes andam o tempo sem esperar. */
export interface Relogio {
  agora(): number
  /** Chama `fazer` daqui a `ms`; devolve quem cancela. */
  depois(ms: number, fazer: () => void): () => void
}

export const RELOGIO_DO_NAVEGADOR: Relogio = {
  agora: () => Date.now(),
  depois(ms, fazer) {
    const id = setTimeout(fazer, ms)
    return () => clearTimeout(id)
  },
}

/** Erro do `/api/eu` com o que a tela precisa para escolher a mensagem. */
export class ErroDoEu extends Error {
  readonly tipo: 'sem-login' | 'rede' | 'servidor' | 'formato'

  constructor(tipo: ErroDoEu['tipo'], mensagem: string) {
    super(mensagem)
    this.name = 'ErroDoEu'
    this.tipo = tipo
  }
}
