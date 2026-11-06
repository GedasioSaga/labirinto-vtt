import { CHAT_MASTER_MENTION, CHAT_TEXT_MAX_LENGTH, cleanChatText, findMentions } from '../chat'
import { segmentoValido } from './caminho'
import { ehRegistro, proprio } from './json'
import { CONTA_DO_MESTRE, type MembroProjetado } from './tipos'

/**
 * CHAT DO LOBBY (plano do Lobby §4.5 e §8.2, fatia C1): o protocolo que o DO
 * Campanha fala com o site pela MESMA conexão WebSocket das fichas
 * (mensagens `chat.*`), e as regras puras que o servidor aplica. O site (C2)
 * usa os mesmos tipos.
 *
 * Dois tipos de canal: a sala da campanha e o privado entre duas contas. O
 * cliente nunca diz QUAL privado: manda só `{dm: contaIdDoOutro}`, e o
 * servidor monta o par com o contaId do socket (XS5). Assim o privado entre
 * dois jogadores não tem endereço que o mestre consiga pedir; o privado do
 * mestre com um jogador existe (12.16).
 *
 * O texto passa por `cleanChatText` e as menções por `findMentions`, as
 * mesmas do chat da mesa LAN (`lib/chat.ts`).
 */

/**
 * Teto de menções numa mensagem. COPIADO de `net/protocol.ts`
 * (`CHAT_MENTIONS_MAX = PARTY_MAX_MEMBERS + 1`, com 32 no Grupo): o núcleo
 * não importa o protocolo da LAN (plano 8.2, C1; achado Ch9).
 */
export const CHAT_MENCOES_MAX = 33

/** Mensagens por página do `chat.antes` (carregar anteriores). */
export const CHAT_PAGINA_MAX = 100

/** As não lidas param de contar aqui: "100" na tela quer dizer "100 ou mais" (a contagem lê só até o teto). */
export const CHAT_NAO_LIDAS_MAX = 100

/** O que o cliente manda: a sala, ou o privado com outra conta. Nunca a chave do par. */
export type CanalDoChat = 'sala' | { dm: string }

export interface MensagemDoChat {
  /** Crescente dentro do canal (a ordem de chegada no servidor). */
  id: number
  autorContaId: string
  /** O nome da conta quando a mensagem foi dita (o mestre é `contaId 'mestre'`). */
  autorNome: string
  /** Vazio na lápide. */
  texto: string
  /** ContaIds mencionados com `@Nome` (só na sala; `'mestre'` para `@mestre`). */
  mencoes: string[]
  criadaEm: number
  /** `null` = de pé; número = apagada (lápide: a linha fica, o texto some). */
  apagadaEm: number | null
  /** Cursor da última mudança desta mensagem (criar ou apagar): a volta (`chat.desde`) parte do maior que o cliente viu. */
  mudou: number
}

export interface MensagemNoCanal {
  canal: CanalDoChat
  msg: MensagemDoChat
}

export interface ResumoDoCanal {
  canal: CanalDoChat
  /** Maior id do canal. */
  ultimaId: number
  /** Até onde quem pediu já leu (`chat.lida`). */
  lidaAte: number
  /** De outras contas, de pé, depois de `lidaAte`; no máximo `CHAT_NAO_LIDAS_MAX`. */
  naoLidas: number
}

export type PedidoDoChat =
  | { t: 'chat.enviar'; canal: CanalDoChat; texto: string; idDoCliente: string }
  | { t: 'chat.apagar'; canal: CanalDoChat; id: number }
  /** Sem `antesDeId` = as mais novas. */
  | { t: 'chat.antes'; canal: CanalDoChat; antesDeId: number | null; limite: number }
  /** `cursor` = o maior `mudou` que o cliente viu; `null` = nunca viu nada. */
  | { t: 'chat.desde'; cursor: number | null }
  | { t: 'chat.lida'; canal: CanalDoChat; ateId: number }

export type TipoDoPedidoDoChat = PedidoDoChat['t']

/**
 * `formato` = pedido torto (conta como violação, §6.5); `texto` = vazio
 * depois da limpeza ou acima do teto; `canal` = privado consigo mesmo ou
 * com quem não é membro; `ritmo`/`cota` = espere `tentarDepoisDe`.
 */
export type MotivoDoChatRecusado = 'formato' | 'texto' | 'canal' | 'nao-existe' | 'sem-permissao' | 'ritmo' | 'cota'

export type MensagemDoChatDoServidor =
  /** Só para o socket que mandou: confirma o envio (o site tira o "enviando…"). */
  | { t: 'chat.ok'; idDoCliente: string; canal: CanalDoChat; msg: MensagemDoChat }
  /** Para os outros sockets do canal, com o canal visto por quem recebe. */
  | { t: 'chat.msg'; canal: CanalDoChat; msg: MensagemDoChat }
  | { t: 'chat.apagada'; canal: CanalDoChat; id: number; apagadaEm: number; mudou: number }
  | { t: 'chat.lista'; canal: CanalDoChat; lista: MensagemDoChat[]; temMaisAntigas: boolean }
  /** `recomecar` = longe demais (ou sem cursor): o cliente esquece o que tem e recarrega o canal aberto pelo `chat.antes`. */
  | { t: 'chat.mudancas'; desde: number; ate: number; lista: MensagemNoCanal[]; recomecar?: true }
  | { t: 'chat.resumo'; cursor: number; canais: ResumoDoCanal[] }
  | { t: 'chat.recusado'; pedido: TipoDoPedidoDoChat | 'chat'; idDoCliente?: string; motivo: MotivoDoChatRecusado; tentarDepoisDe?: number }

/** O pedido lido; fora do formato, o tipo (se conhecido) e o `idDoCliente` (se legível) para a resposta. */
export type LeituraDoPedidoDoChat = { ok: true; pedido: PedidoDoChat } | { ok: false; pedido: TipoDoPedidoDoChat | 'chat'; idDoCliente?: string }

const TIPOS_DO_PEDIDO: readonly TipoDoPedidoDoChat[] = ['chat.enviar', 'chat.apagar', 'chat.antes', 'chat.desde', 'chat.lida']

function tipoDoPedido(valor: unknown): TipoDoPedidoDoChat | null {
  return TIPOS_DO_PEDIDO.find((tipo) => tipo === valor) ?? null
}

/** `'sala'` ou `{dm: contaId}` com essa chave só. Texto como `'dm:a:b'` é fora do formato. */
export function lerCanal(valor: unknown): CanalDoChat | null {
  if (valor === 'sala') return 'sala'
  if (!ehRegistro(valor) || Object.keys(valor).length !== 1) return null
  const outro = proprio(valor, 'dm')
  return segmentoValido(outro) ? { dm: outro } : null
}

function idValido(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 1
}

function cursorValido(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 0
}

function pedidoDoRegistro(tipo: TipoDoPedidoDoChat, registro: Record<string, unknown>): PedidoDoChat | null {
  if (tipo === 'chat.desde') {
    const cursor = proprio(registro, 'cursor')
    if (cursor === null || cursor === undefined) return { t: tipo, cursor: null }
    return cursorValido(cursor) ? { t: tipo, cursor } : null
  }
  const canal = lerCanal(proprio(registro, 'canal'))
  if (canal === null) return null
  switch (tipo) {
    case 'chat.enviar': {
      const texto = proprio(registro, 'texto')
      const idDoCliente = proprio(registro, 'idDoCliente')
      return typeof texto === 'string' && segmentoValido(idDoCliente) ? { t: tipo, canal, texto, idDoCliente } : null
    }
    case 'chat.apagar': {
      const id = proprio(registro, 'id')
      return idValido(id) ? { t: tipo, canal, id } : null
    }
    case 'chat.antes': {
      const antesDeId = proprio(registro, 'antesDeId')
      const limite = proprio(registro, 'limite')
      if (!idValido(limite)) return null
      if (antesDeId === null || antesDeId === undefined) return { t: tipo, canal, antesDeId: null, limite: Math.min(limite, CHAT_PAGINA_MAX) }
      return idValido(antesDeId) ? { t: tipo, canal, antesDeId, limite: Math.min(limite, CHAT_PAGINA_MAX) } : null
    }
    case 'chat.lida': {
      const ateId = proprio(registro, 'ateId')
      return idValido(ateId) ? { t: tipo, canal, ateId } : null
    }
  }
}

/** Um frame `chat.*` do site. Fora do formato não lança: devolve o que dá para responder. */
export function lerPedidoDoChat(registro: Record<string, unknown>): LeituraDoPedidoDoChat {
  const tipo = tipoDoPedido(proprio(registro, 't'))
  if (tipo === null) return { ok: false, pedido: 'chat' }
  const pedido = pedidoDoRegistro(tipo, registro)
  if (pedido !== null) return { ok: true, pedido }
  const idDoCliente = proprio(registro, 'idDoCliente')
  return segmentoValido(idDoCliente) ? { ok: false, pedido: tipo, idDoCliente } : { ok: false, pedido: tipo }
}

/** O texto como os outros vão ler; `null` = não vai (vazio depois da limpeza ou acima do teto). */
export function textoDoChat(bruto: string): string | null {
  const limpo = cleanChatText(bruto)
  return limpo === '' || limpo.length > CHAT_TEXT_MAX_LENGTH ? null : limpo
}

/**
 * Quem a mensagem da sala menciona, em contaIds: `@mestre` e o nome do mestre
 * viram `'mestre'`; o nome de um membro vira o contaId dele (dois membros com
 * o mesmo nome são mencionados juntos). Na ordem do texto, sem repetir.
 */
export function mencoesDaSala(texto: string, membros: readonly MembroProjetado[]): string[] {
  const nomes = [CHAT_MASTER_MENTION, ...membros.map((membro) => membro.nome)]
  const contas: string[] = []
  for (const nome of findMentions(texto, nomes)) {
    const doNome = nome === CHAT_MASTER_MENTION ? [CONTA_DO_MESTRE] : membros.filter((membro) => membro.nome === nome).map((membro) => membro.contaId)
    for (const contaId of doNome) if (!contas.includes(contaId)) contas.push(contaId)
  }
  return contas.slice(0, CHAT_MENCOES_MAX)
}

/** O par de um privado, montado pelo servidor: as duas contas em ordem, e a chave `'a|b'` (contaId não tem `|`, `segmentoValido`). */
export interface ParDoPrivado {
  a: string
  b: string
  par: string
}

export function parDoPrivado(eu: string, outro: string): ParDoPrivado {
  const [a, b] = eu < outro ? [eu, outro] : [outro, eu]
  return { a, b, par: `${a}|${b}` }
}

/** O canal do privado como `quem` o vê: o outro lado do par. */
export function canalDoPar(par: ParDoPrivado, quem: string): CanalDoChat {
  return { dm: quem === par.a ? par.b : par.a }
}
