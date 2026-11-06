import { segmentoValido } from '../../lib/nuvem/caminho'
import { ehRegistro, proprio } from '../../lib/nuvem/json'
import { ehRefDeMidia } from '../../lib/midia'
import {
  ehReacaoDoMural,
  MURAL_TEXTO_MAX,
  type ContagemDaReacao,
  type MensagemDoMuralDoServidor,
  type ModificacaoDoMural,
  type MotivoDoMuralRecusado,
  type NoticiaDoMural,
  type TipoDoPedidoDoMural,
} from '../../lib/nuvem/muralDoLobby'

/**
 * LEITURA DO FIO DO MURAL (fatia M2): os frames `mural.*` que o DO Campanha
 * manda (`lobby/nuvem/src/mural.ts`), conferidos como qualquer entrada de fora
 * antes de chegar à tela. `null` = fora do formato; lista com um item torto
 * vale como torta inteira (como o resto do fio, `mensagens.ts`).
 */

const MOTIVOS: readonly MotivoDoMuralRecusado[] = ['formato', 'texto', 'imagem', 'nao-existe', 'sem-permissao', 'apagada', 'ritmo', 'cota']
const PEDIDOS: readonly (TipoDoPedidoDoMural | 'mural')[] = [
  'mural.postar',
  'mural.editar',
  'mural.apagar',
  'mural.fixar',
  'mural.reagir',
  'mural.lido',
  'mural.antes',
  'mural.modificacoes',
  'mural',
]

function ehInteiro(valor: unknown, minimo: number): valor is number {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= minimo
}

function ehHora(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor)
}

function ehHoraOuNulo(valor: unknown): valor is number | null {
  return valor === null || ehHora(valor)
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

function lerTexto(item: unknown): string | null {
  return typeof item === 'string' ? item : null
}

function lerContagem(bruto: unknown): ContagemDaReacao | null {
  if (!ehRegistro(bruto)) return null
  const reacao = proprio(bruto, 'reacao')
  const total = proprio(bruto, 'total')
  return ehReacaoDoMural(reacao) && ehInteiro(total, 1) ? { reacao, total } : null
}

/** Uma notícia do fio; texto acima do teto ou imagem fora de `midia:` = torta. */
export function lerNoticiaDoMural(bruto: unknown): NoticiaDoMural | null {
  if (!ehRegistro(bruto)) return null
  const id = proprio(bruto, 'id')
  const autorContaId = proprio(bruto, 'autorContaId')
  const autorNome = proprio(bruto, 'autorNome')
  const texto = proprio(bruto, 'texto')
  const imagem = proprio(bruto, 'imagem')
  const mencoes = lerLista(proprio(bruto, 'mencoes'), lerTexto)
  const fixada = proprio(bruto, 'fixada')
  const versao = proprio(bruto, 'versao')
  const criadaEm = proprio(bruto, 'criadaEm')
  const editadaEm = proprio(bruto, 'editadaEm')
  const apagadaEm = proprio(bruto, 'apagadaEm')
  const reacoes = lerLista(proprio(bruto, 'reacoes'), lerContagem)
  const minhaReacao = proprio(bruto, 'minhaReacao')
  const lida = proprio(bruto, 'lida')
  if (!ehInteiro(id, 1) || typeof autorContaId !== 'string' || typeof autorNome !== 'string') return null
  if (typeof texto !== 'string' || texto.length > MURAL_TEXTO_MAX) return null
  if (imagem !== null && !ehRefDeMidia(imagem)) return null
  if (mencoes === null || reacoes === null || typeof fixada !== 'boolean' || typeof lida !== 'boolean' || !ehInteiro(versao, 1)) return null
  if (!ehHora(criadaEm) || !ehHoraOuNulo(editadaEm) || !ehHoraOuNulo(apagadaEm)) return null
  if (minhaReacao !== null && !ehReacaoDoMural(minhaReacao)) return null
  return { id, autorContaId, autorNome, texto, imagem, mencoes, fixada, versao, criadaEm, editadaEm, apagadaEm, reacoes, minhaReacao, lida }
}

function lerModificacao(bruto: unknown): ModificacaoDoMural | null {
  if (!ehRegistro(bruto)) return null
  const rev = proprio(bruto, 'rev')
  const quando = proprio(bruto, 'quando')
  const fichaId = proprio(bruto, 'fichaId')
  const fichaNome = proprio(bruto, 'fichaNome')
  const autorContaId = proprio(bruto, 'autorContaId')
  const autorNome = proprio(bruto, 'autorNome')
  const frase = proprio(bruto, 'frase')
  const desfazendo = proprio(bruto, 'desfazendo')
  if (!ehInteiro(rev, 1) || !ehHora(quando) || !segmentoValido(fichaId)) return null
  if (typeof fichaNome !== 'string' || typeof autorContaId !== 'string' || typeof autorNome !== 'string' || typeof frase !== 'string') return null
  if (desfazendo !== undefined && desfazendo !== true) return null
  const linha: ModificacaoDoMural = { rev, quando, fichaId, fichaNome, autorContaId, autorNome, frase }
  if (desfazendo === true) linha.desfazendo = true
  return linha
}

function lerFiltro(valor: unknown): string | null | undefined {
  if (valor === null) return null
  return segmentoValido(valor) ? valor : undefined
}

function lerEstado(bruto: Record<string, unknown>): MensagemDoMuralDoServidor | null {
  const fixadas = lerLista(proprio(bruto, 'fixadas'), lerNoticiaDoMural)
  const noticias = lerLista(proprio(bruto, 'noticias'), lerNoticiaDoMural)
  const temMaisAntigas = proprio(bruto, 'temMaisAntigas')
  return fixadas !== null && noticias !== null && typeof temMaisAntigas === 'boolean' ? { t: 'mural.estado', fixadas, noticias, temMaisAntigas } : null
}

function lerModificacoes(bruto: Record<string, unknown>): MensagemDoMuralDoServidor | null {
  const fichaId = lerFiltro(proprio(bruto, 'fichaId'))
  const autorContaId = lerFiltro(proprio(bruto, 'autorContaId'))
  const lista = lerLista(proprio(bruto, 'lista'), lerModificacao)
  const proxima = proprio(bruto, 'proximaAntesDeRev')
  if (fichaId === undefined || autorContaId === undefined || lista === null) return null
  if (proxima !== null && !ehInteiro(proxima, 1)) return null
  return { t: 'mural.modificacoes', fichaId, autorContaId, lista, proximaAntesDeRev: proxima }
}

function lerRecusado(bruto: Record<string, unknown>): MensagemDoMuralDoServidor | null {
  const pedido = PEDIDOS.find((tipo) => tipo === proprio(bruto, 'pedido'))
  const motivo = MOTIVOS.find((nome) => nome === proprio(bruto, 'motivo'))
  const idDoCliente = proprio(bruto, 'idDoCliente')
  const tentarDepoisDe = proprio(bruto, 'tentarDepoisDe')
  if (pedido === undefined || motivo === undefined) return null
  if (idDoCliente !== undefined && !segmentoValido(idDoCliente)) return null
  if (tentarDepoisDe !== undefined && !ehHora(tentarDepoisDe)) return null
  const recusa: MensagemDoMuralDoServidor = { t: 'mural.recusado', pedido, motivo }
  if (idDoCliente !== undefined) recusa.idDoCliente = idDoCliente
  if (tentarDepoisDe !== undefined) recusa.tentarDepoisDe = tentarDepoisDe
  return recusa
}

/** Um frame `mural.*` já como registro; `null` = fora do formato (o canal cai e volta, como com qualquer frame torto). */
export function lerFrameDoMural(bruto: Record<string, unknown>): MensagemDoMuralDoServidor | null {
  switch (proprio(bruto, 't')) {
    case 'mural.estado':
      return lerEstado(bruto)
    case 'mural.ok': {
      const idDoCliente = proprio(bruto, 'idDoCliente')
      const noticia = lerNoticiaDoMural(proprio(bruto, 'noticia'))
      return segmentoValido(idDoCliente) && noticia !== null ? { t: 'mural.ok', idDoCliente, noticia } : null
    }
    case 'mural.noticia': {
      const noticia = lerNoticiaDoMural(proprio(bruto, 'noticia'))
      return noticia === null ? null : { t: 'mural.noticia', noticia }
    }
    case 'mural.lista': {
      const noticias = lerLista(proprio(bruto, 'noticias'), lerNoticiaDoMural)
      const temMaisAntigas = proprio(bruto, 'temMaisAntigas')
      return noticias !== null && typeof temMaisAntigas === 'boolean' ? { t: 'mural.lista', noticias, temMaisAntigas } : null
    }
    case 'mural.modificacoes':
      return lerModificacoes(bruto)
    case 'mural.recusado':
      return lerRecusado(bruto)
    default:
      return null
  }
}
