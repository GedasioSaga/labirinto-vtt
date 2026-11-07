import {
  ehRegistro,
  lerJsonSeguro,
  lerPedidoDeVerComo,
  lerPedidoDoChat,
  lerPedidoDoMural,
  parseLivroPedir,
  proprio,
  segmentoValido,
  type LeituraDoPedidoDoChat,
  type LeituraDoPedidoDoMural,
  type MensagemDoChatDoServidor,
  type MensagemDoMuralDoServidor,
  type MensagemDoServidor,
  type MensagemDoVerComo,
  type PedidoDeVerComo,
} from './nucleo'
// O duelo fica fora do `nucleo.ts`: a regra dele puxa a store da batalha (zustand), e o fecho do núcleo é puro.
import { lerPedidoDoDuelo, type LeituraDoPedidoDoDuelo, type MensagemDoDueloDoServidor } from '../../../client/src/lib/treino/dueloDoLobby'
import type { MensagemDaSala } from './salaAberta'

/**
 * O WebSocket do site (plano §5.4), com Hibernation: o DO dorme entre as
 * mensagens, e o que precisa sobreviver ao sono fica no anexo do socket
 * (`serializeAttachment`) ou no SQLite — nunca em campo da classe.
 */

/**
 * A auto-resposta do ping (`setWebSocketAutoResponse`): o runtime responde
 * sem acordar o DO e sem cobrar. O site (S2) manda o texto exato `ping`.
 */
export const PING = 'ping'
export const PONG = 'pong'

/** Fechamentos com motivo (4000-4999 são do aplicativo). */
export const FECHAR_SEM_ACESSO = 4004
export const FECHAR_POR_VIOLACAO = 1008
const FECHAR_NORMAL = 1000

/** O socket da conta leva esta tag: fechar os sockets de quem saiu ou mudou de e-mail (§6.4). Tag tem teto de 256 caracteres; o e-mail poderia passar. */
export function tagDaConta(contaId: string): string {
  return `conta:${contaId}`
}

/** O que o socket lembra entre as mensagens. `clienteId` nasce no `ola`; antes dele, só o `ola` é aceito. */
export interface Anexo {
  contaId: string
  email: string
  origem: 'app' | 'site'
  clienteId: string | null
  violacoes: number
}

export function lerAnexo(valor: unknown): Anexo | null {
  if (!ehRegistro(valor)) return null
  const contaId = proprio(valor, 'contaId')
  const email = proprio(valor, 'email')
  const origem = proprio(valor, 'origem')
  const clienteId = proprio(valor, 'clienteId')
  const violacoes = proprio(valor, 'violacoes')
  if (typeof contaId !== 'string' || typeof email !== 'string' || (origem !== 'app' && origem !== 'site')) return null
  if ((clienteId !== null && typeof clienteId !== 'string') || typeof violacoes !== 'number') return null
  return { contaId, email, origem, clienteId, violacoes }
}

export type Frame =
  /** `marcaDoSistema` (F1): `undefined` = site de antes dela (o DO segue só a rev); `null` = o site não tem sistema do servidor. */
  | { t: 'ola'; desdeRev: number | null; v: unknown; clienteId: string; marcaDoSistema: string | null | undefined }
  /** O `livro.pedir` (F1), lido pelo mesmo leitor da sala LAN. */
  | { t: 'livro'; pedido: { reqId: string; sistemaId: string } }
  | { t: 'ops'; lote: unknown[] }
  /** O pedido inteiro vai para `processarDesfazer`, que lê `opId`, `novoOpId` e `confirmar`. */
  | { t: 'desfazer'; pedido: Record<string, unknown> }
  | { t: 'historico'; fichaId: string; antesDeRev: number | null; limite: number }
  /** Todo `chat.*` (fatia C1): lido inteiro pelo núcleo; o torto vem marcado para a resposta `chat.recusado`. */
  | { t: 'chat'; leitura: LeituraDoPedidoDoChat }
  /** Todo `mural.*` (fatia M1): idem. */
  | { t: 'mural'; leitura: LeituraDoPedidoDoMural }
  /** Todo `duelo.*` (fatia T6): idem. */
  | { t: 'duelo'; leitura: LeituraDoPedidoDoDuelo }
  /** O mestre pede a vista de um jogador (07/11/2026); quem pode é decidido no DO, pelo papel de agora. */
  | { t: 'verComo'; pedido: PedidoDeVerComo }

/** O histórico vem em páginas de 50 (§5.3). */
export const LIMITE_DO_HISTORICO = 50
/** A marca do sistema que o DO dá tem 8 caracteres (`marcaDoSistema`); a folga aceita uma marca mais longa no futuro. */
const MARCA_MAX = 64

function revOuNulo(valor: unknown): number | null | undefined {
  if (valor === undefined || valor === null) return null
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 0 ? valor : undefined
}

function frameDoRegistro(registro: Record<string, unknown>): Frame | null {
  const tipo = proprio(registro, 't')
  if (typeof tipo === 'string' && tipo.startsWith('chat.')) return { t: 'chat', leitura: lerPedidoDoChat(registro) }
  if (typeof tipo === 'string' && tipo.startsWith('mural.')) return { t: 'mural', leitura: lerPedidoDoMural(registro) }
  if (typeof tipo === 'string' && tipo.startsWith('duelo.')) return { t: 'duelo', leitura: lerPedidoDoDuelo(registro) }
  switch (tipo) {
    case 'ola': {
      const desdeRev = revOuNulo(proprio(registro, 'desdeRev'))
      const clienteId = proprio(registro, 'clienteId')
      const marcaDoSistema = proprio(registro, 'marcaDoSistema')
      if (desdeRev === undefined || !segmentoValido(clienteId)) return null
      if (marcaDoSistema !== undefined && marcaDoSistema !== null && !(typeof marcaDoSistema === 'string' && marcaDoSistema.length <= MARCA_MAX)) return null
      return { t: 'ola', desdeRev, v: proprio(registro, 'v'), clienteId, marcaDoSistema }
    }
    case 'livro.pedir': {
      const pedido = parseLivroPedir(registro)
      return pedido === null ? null : { t: 'livro', pedido: { reqId: pedido.reqId, sistemaId: pedido.sistemaId } }
    }
    case 'ops': {
      const lote = proprio(registro, 'lote')
      return Array.isArray(lote) ? { t: 'ops', lote: Array.from(lote) } : null
    }
    case 'desfazer':
      return { t: 'desfazer', pedido: registro }
    case 'historico': {
      const fichaId = proprio(registro, 'fichaId')
      const antesDeRev = revOuNulo(proprio(registro, 'antesDeRev'))
      const limite = proprio(registro, 'limite')
      if (!segmentoValido(fichaId) || antesDeRev === undefined || typeof limite !== 'number' || !Number.isSafeInteger(limite) || limite < 1) return null
      return { t: 'historico', fichaId, antesDeRev, limite: Math.min(limite, LIMITE_DO_HISTORICO) }
    }
    case 'verComo': {
      const pedido = lerPedidoDeVerComo(registro)
      return pedido === null ? null : { t: 'verComo', pedido }
    }
    default:
      return null
  }
}

/** A mensagem do site; `null` = fora do formato (conta como violação, §6.5). */
export function lerFrame(texto: string): Frame | null {
  try {
    const valor = lerJsonSeguro(texto)
    return ehRegistro(valor) ? frameDoRegistro(valor) : null
  } catch {
    // JSON torto: é só mais um frame fora do formato.
    return null
  }
}

export function enviar(
  ws: WebSocket,
  mensagem: MensagemDoServidor | MensagemDoChatDoServidor | MensagemDoMuralDoServidor | MensagemDoDueloDoServidor | MensagemDaSala | MensagemDoVerComo,
): void {
  try {
    ws.send(JSON.stringify(mensagem))
  } catch {
    // Socket já fechando: quem caiu recebe tudo de novo pelo `ola` da volta (o log não perde nada).
  }
}

export function fechar(ws: WebSocket, codigo: number, motivo: string): void {
  try {
    ws.close(codigo, motivo)
  } catch {
    // Já fechado: nada a fazer.
  }
}

/** Fecha o lado do servidor depois que o cliente fechou (o código que ele mandou pode ser um dos reservados, como 1005). */
export function fecharDeVolta(ws: WebSocket): void {
  fechar(ws, FECHAR_NORMAL, 'tchau')
}
