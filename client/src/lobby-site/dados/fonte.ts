import type { MensagemDoChatDoServidor, PedidoDoChat } from '../../lib/nuvem/chatDoLobby'
import type { MensagemDoMuralDoServidor, PedidoDoMural } from '../../lib/nuvem/muralDoLobby'
import type { MensagemDoCliente, MensagemDoServidor, Papel } from '../../lib/nuvem/tipos'
import type { MensagemDoVerComo, PedidoDeVerComo } from '../../lib/nuvem/verComo'
import type { MensagemDoDueloDoServidor, PedidoDoDuelo } from '../../lib/treino/dueloDoLobby'

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

/** Um endereço da tela do jogador no app do mestre: `lan` = `http://<IP da rede local>:<porta>/player`, `tunel` = `https://<nome>.trycloudflare.com/player`. */
export interface EnderecoDaMesa {
  tipo: 'lan' | 'tunel'
  url: string
}

/**
 * A sala que o mestre abriu no app ("Entrar na mesa agora", fatias B2 e B6):
 * o código e os endereços da tela do jogador. A chave que assina o convite
 * nunca vem para o site (lobby/nuvem/src/salaAberta.ts).
 */
export interface SalaDaMesa {
  codigo: string
  enderecos: EnderecoDaMesa[]
}

/** O frame `{ t: 'sala' }`: a sala abriu, trocou de endereço (`SalaDaMesa`), fechou ou venceu (`null`). */
export type MensagemDaSala = { t: 'sala'; sala: SalaDaMesa | null }

/** O `estado` do DO desde a B2 traz a sala aberta agora; `undefined` = DO de antes, que nunca tem sala. */
export type EstadoComSala = Extract<MensagemDoServidor, { t: 'estado' }> & { sala?: SalaDaMesa | null }

/**
 * Tudo o que chega pelo canal da campanha: o protocolo das fichas (§5.4), o
 * do chat (`chat.*`, fatia C2), o do mural (`mural.*`, fatia M2), o do duelo
 * e a sala aberta no app (B6), que andam pela MESMA conexão.
 */
export type MensagemDoSite =
  | Exclude<MensagemDoServidor, { t: 'estado' }>
  | EstadoComSala
  | MensagemDaSala
  | MensagemDoChatDoServidor
  | MensagemDoMuralDoServidor
  | MensagemDoDueloDoServidor
  | MensagemDoVerComoNoSite

/** A vista de um jogador pedida pelo mestre ("ver como", 07/11/2026), com o `estado` na forma do canal (com a sala). */
/** O `duelo.lista` que a vista traz (o tipo fica aqui: o núcleo da nuvem não importa o treino). */
export type DuelosDoVerComo = Extract<MensagemDoDueloDoServidor, { t: 'duelo.lista' }>
export type MensagemDoVerComoNoSite = MensagemDoVerComo<EstadoComSala, DuelosDoVerComo>
export type VistaDoVerComoNoSite = Extract<MensagemDoVerComoNoSite, { t: 'verComo.vista' }>

/** O frame é a resposta de um `verComo` (`verComo.*`)? */
export function ehDoVerComo(mensagem: MensagemDoSite): mensagem is MensagemDoVerComoNoSite {
  return mensagem.t.startsWith('verComo.')
}

/**
 * O convite de um clique (`POST /api/c/:id/bilhete`, só jogador): o bilhete
 * assinado vale 2 minutos e vai SÓ no fragmento da URL da tela do jogador.
 * `sala` é a mesma do frame, lida de novo na resposta (a mais recente).
 * Recusa:
 * - `sem-login`: o Access pediu login de novo (redirecionou ou 401);
 * - `sem-sala`: a sala fechou ou venceu antes do clique (409);
 * - `sem-convite`: esta conta não recebe convite (409), entra pelo código;
 * - `ritmo`: convites demais em pouco tempo (429), `tentarDepoisDe` em ms do relógio do Lobby;
 * - `fora-da-mesa`: a pessoa não é jogador desta mesa (404, ou o mestre, 403);
 * - `rede` e `servidor`: não chegou, ou voltou outra coisa.
 */
export type RespostaDoBilhete =
  | { ok: true; bilhete: string; sala: SalaDaMesa }
  | { ok: false; motivo: 'sem-login' | 'sem-sala' | 'sem-convite' | 'fora-da-mesa' | 'rede' | 'servidor' }
  | { ok: false; motivo: 'ritmo'; tentarDepoisDe: number }

/**
 * A troca da foto de perfil da própria conta na campanha (`PUT` e `DELETE`
 * `/api/c/:id/foto`, 07/11/2026). `foto` = o id da mídia de agora (`null` =
 * a inicial); o `estado` com os membros chega pelo canal logo depois, para
 * todo mundo na mesa. Recusa:
 * - `sem-login`: o Access pediu login de novo;
 * - `fora-da-mesa`: a pessoa não está nesta mesa (404);
 * - `grande`: passou de 256 KiB (413), `tipo`: não é webp, png nem jpg (400);
 * - `cheia`: as imagens da campanha chegaram no teto (413);
 * - `ritmo`: trocas demais em pouco tempo (429), `tentarDepoisDe` em ms do relógio do Lobby;
 * - `rede` e `servidor`: não chegou, ou voltou outra coisa.
 */
export type RespostaDaFoto =
  | { ok: true; foto: string | null }
  | { ok: false; motivo: 'sem-login' | 'fora-da-mesa' | 'grande' | 'tipo' | 'cheia' | 'rede' | 'servidor' }
  | { ok: false; motivo: 'ritmo'; tentarDepoisDe: number }

/** Tudo o que o site manda pelo canal: o protocolo das fichas e os pedidos do chat, do mural e do duelo (T7). */
export type PedidoDoSite = MensagemDoCliente | PedidoDoChat | PedidoDoMural | PedidoDoDuelo | PedidoDeVerComo

/** O frame é do duelo (`duelo.*`, fatia T7)? */
export function ehDoDuelo(mensagem: MensagemDoSite): mensagem is MensagemDoDueloDoServidor {
  return mensagem.t.startsWith('duelo.')
}

/** O pedido é do duelo (`duelo.*`)? */
export function ehPedidoDoDuelo(pedido: PedidoDoSite): pedido is PedidoDoDuelo {
  return pedido.t.startsWith('duelo.')
}

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
  /** O convite para entrar na sala aberta no app ("Entrar na mesa agora"); nunca lança. */
  pedirBilhete(campanhaId: string): Promise<RespostaDoBilhete>
  /** Troca (`imagem`, já reduzida pelo site) ou tira (`null`) a foto de perfil da própria conta nesta campanha; nunca lança. */
  trocarFoto(campanhaId: string, imagem: Blob | null): Promise<RespostaDaFoto>
  /** Onde a página busca a foto de um membro (`foto` do `estado`); `null` = não há como mostrar (cai na inicial). */
  enderecoDaFoto(campanhaId: string, foto: string): string | null
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
