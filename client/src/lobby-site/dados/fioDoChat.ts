import { CHAT_TEXT_MAX_LENGTH } from '../../lib/chat'
import { segmentoValido } from '../../lib/nuvem/caminho'
import {
  lerCanal,
  type MensagemDoChat,
  type MensagemDoChatDoServidor,
  type MensagemNoCanal,
  type MotivoDoChatRecusado,
  type ResumoDoCanal,
  type TipoDoPedidoDoChat,
} from '../../lib/nuvem/chatDoLobby'
import { ehRegistro, proprio } from '../../lib/nuvem/json'

/**
 * LEITURA DO FIO DO CHAT (fatia C2): os frames `chat.*` que o DO Campanha
 * manda (`lobby/nuvem/src/chat.ts`), conferidos como qualquer entrada de fora
 * antes de chegar à tela. `null` = fora do formato; lista com um item torto
 * vale como torta inteira (como o resto do fio, `mensagens.ts`).
 */

const MOTIVOS: readonly MotivoDoChatRecusado[] = ['formato', 'texto', 'canal', 'nao-existe', 'sem-permissao', 'ritmo', 'cota']
const PEDIDOS: readonly (TipoDoPedidoDoChat | 'chat')[] = ['chat.enviar', 'chat.apagar', 'chat.antes', 'chat.desde', 'chat.lida', 'chat']

function ehInteiro(valor: unknown, minimo: number): valor is number {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= minimo
}

function ehHora(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor)
}

function lerLista<T>(bruto: unknown, ler: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(bruto)) return null
  const itens: readonly unknown[] = bruto
  const lidos: T[] = []
  for (const item of itens) {
    const lido = ler(item)
    if (lido === null) return null
    lidos.push(lido)
  }
  return lidos
}

function lerTexto(valor: unknown): string | null {
  return typeof valor === 'string' ? valor : null
}

export function lerMensagemDoChat(bruto: unknown): MensagemDoChat | null {
  if (!ehRegistro(bruto)) return null
  const id = proprio(bruto, 'id')
  const autorContaId = proprio(bruto, 'autorContaId')
  const autorNome = proprio(bruto, 'autorNome')
  const texto = proprio(bruto, 'texto')
  const mencoes = lerLista(proprio(bruto, 'mencoes'), lerTexto)
  const criadaEm = proprio(bruto, 'criadaEm')
  const apagadaEm = proprio(bruto, 'apagadaEm')
  const mudou = proprio(bruto, 'mudou')
  if (!ehInteiro(id, 1) || !segmentoValido(autorContaId) || typeof autorNome !== 'string' || mencoes === null) return null
  if (typeof texto !== 'string' || texto.length > CHAT_TEXT_MAX_LENGTH || !ehHora(criadaEm) || !ehInteiro(mudou, 0)) return null
  if (apagadaEm !== null && !ehHora(apagadaEm)) return null
  return { id, autorContaId, autorNome, texto, mencoes, criadaEm, apagadaEm, mudou }
}

function lerMensagemNoCanal(bruto: unknown): MensagemNoCanal | null {
  if (!ehRegistro(bruto)) return null
  const canal = lerCanal(proprio(bruto, 'canal'))
  const msg = lerMensagemDoChat(proprio(bruto, 'msg'))
  return canal === null || msg === null ? null : { canal, msg }
}

function lerResumoDoCanal(bruto: unknown): ResumoDoCanal | null {
  if (!ehRegistro(bruto)) return null
  const canal = lerCanal(proprio(bruto, 'canal'))
  const ultimaId = proprio(bruto, 'ultimaId')
  const lidaAte = proprio(bruto, 'lidaAte')
  const naoLidas = proprio(bruto, 'naoLidas')
  if (canal === null || !ehInteiro(ultimaId, 0) || !ehInteiro(lidaAte, 0) || !ehInteiro(naoLidas, 0)) return null
  return { canal, ultimaId, lidaAte, naoLidas }
}

function lerRecusado(bruto: Record<string, unknown>): MensagemDoChatDoServidor | null {
  const pedido = PEDIDOS.find((tipo) => tipo === proprio(bruto, 'pedido'))
  const motivo = MOTIVOS.find((tipo) => tipo === proprio(bruto, 'motivo'))
  const idDoCliente = proprio(bruto, 'idDoCliente')
  const tentarDepoisDe = proprio(bruto, 'tentarDepoisDe')
  if (pedido === undefined || motivo === undefined) return null
  if (idDoCliente !== undefined && !segmentoValido(idDoCliente)) return null
  if (tentarDepoisDe !== undefined && !ehHora(tentarDepoisDe)) return null
  const recusado: Extract<MensagemDoChatDoServidor, { t: 'chat.recusado' }> = { t: 'chat.recusado', pedido, motivo }
  if (idDoCliente !== undefined) recusado.idDoCliente = idDoCliente
  if (tentarDepoisDe !== undefined) recusado.tentarDepoisDe = tentarDepoisDe
  return recusado
}

function lerMudancas(bruto: Record<string, unknown>): MensagemDoChatDoServidor | null {
  const desde = proprio(bruto, 'desde')
  const ate = proprio(bruto, 'ate')
  const lista = lerLista(proprio(bruto, 'lista'), lerMensagemNoCanal)
  const recomecar = proprio(bruto, 'recomecar')
  if (!ehInteiro(desde, 0) || !ehInteiro(ate, 0) || lista === null || (recomecar !== undefined && recomecar !== true)) return null
  return recomecar === true ? { t: 'chat.mudancas', desde, ate, lista, recomecar } : { t: 'chat.mudancas', desde, ate, lista }
}

/** Um frame `chat.*` do servidor; `null` = fora do formato. */
export function lerFrameDoChat(bruto: Record<string, unknown>): MensagemDoChatDoServidor | null {
  const t = proprio(bruto, 't')
  const canal = lerCanal(proprio(bruto, 'canal'))
  switch (t) {
    case 'chat.ok': {
      const idDoCliente = proprio(bruto, 'idDoCliente')
      const msg = lerMensagemDoChat(proprio(bruto, 'msg'))
      return canal !== null && msg !== null && segmentoValido(idDoCliente) ? { t, idDoCliente, canal, msg } : null
    }
    case 'chat.msg': {
      const msg = lerMensagemDoChat(proprio(bruto, 'msg'))
      return canal !== null && msg !== null ? { t, canal, msg } : null
    }
    case 'chat.apagada': {
      const id = proprio(bruto, 'id')
      const apagadaEm = proprio(bruto, 'apagadaEm')
      const mudou = proprio(bruto, 'mudou')
      return canal !== null && ehInteiro(id, 1) && ehHora(apagadaEm) && ehInteiro(mudou, 0) ? { t, canal, id, apagadaEm, mudou } : null
    }
    case 'chat.lista': {
      const lista = lerLista(proprio(bruto, 'lista'), lerMensagemDoChat)
      const temMaisAntigas = proprio(bruto, 'temMaisAntigas')
      return canal !== null && lista !== null && typeof temMaisAntigas === 'boolean' ? { t, canal, lista, temMaisAntigas } : null
    }
    case 'chat.mudancas':
      return lerMudancas(bruto)
    case 'chat.resumo': {
      const cursor = proprio(bruto, 'cursor')
      const canais = lerLista(proprio(bruto, 'canais'), lerResumoDoCanal)
      return ehInteiro(cursor, 0) && canais !== null ? { t, cursor, canais } : null
    }
    case 'chat.recusado':
      return lerRecusado(bruto)
    default:
      return null
  }
}
