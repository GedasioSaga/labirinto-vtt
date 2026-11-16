import { SESSAO_DA_JANELA_VALIDA } from '../../lib/janelaDoPreludio'
import { idDoPreparoValido } from '../../lib/preparo/disco'
import { ehRegistro } from '../../lib/preparo/molde'
import type { LigaCena } from '../../lib/preparo/tipos'

/**
 * O FIO ENTRE A MESA (janela principal) E A JANELA DO PRELÚDIO, P1 do estudo
 * de 15/11 (`tmp/preludio-integrado-2026-11-15/ESTUDO.md` §3).
 *
 * Uma janela, um papel: a mesa é a única que mexe no mapa, no desfazer e nos
 * jogadores. O Prelúdio PEDE, numa lista fechada; a mesa confere a forma de
 * tudo, aplica ou recusa com o motivo. O canal é um BroadcastChannel com o
 * nome da sessão (o segredo que só as duas janelas conhecem: a visão de
 * jogador, na mesma origem, não sabe o nome e não ouve), e cada mensagem
 * repete a sessão. Mensagem torta, de outra sessão ou de tipo desconhecido é
 * ignorada sem efeito nenhum.
 *
 * Do Prelúdio para a mesa: `ola` (abri ou recarreguei), `ping`, `ir-a-mesa`
 * (cena e pino, como os links do roteiro), `mudou` (gravei algo em preparo/),
 * `gravou` (resposta ao `salvar-agora`), `por-no-mapa` (P3: a seção que o
 * mestre vai cravar no mapa com um clique), `cancelar-por` e `ler-agora` (P4: o
 * "Ler agora" de um "!" da lista "Na mesa").
 * Da mesa para o Prelúdio: `estado` (mapa, cena e pino selecionado), `pong`,
 * `abrir-verbete` (o "Abrir no Prelúdio" do mapa, com a seção do pino ligado),
 * `resposta` (ao `ir-a-mesa`), `mudou` (o Livro do mestre revelou),
 * `salvar-agora` (a janela principal vai fechar), `pondo` (o andamento do
 * "Pôr no mapa") e `na-mesa` (os pinos ligados do mapa aberto).
 *
 * O texto da seção nunca viaja pelo fio: a mesa o lê do disco, no próprio
 * verbete, e confere ali que a seção não é segredo antes de cravar o pino.
 */

export const VERSAO_DO_FIO = 1

/** O canal desta sessão. O nome é o segredo: só quem abriu a janela sabe. */
export function nomeDoCanal(sessao: string): string {
  return `labirinto-preludio:${sessao}`
}

/** Teto de um nome que a mesa mostra (mapa, cena, pino) e de um motivo. */
const NOME_MAX = 200
const MOTIVO_MAX = 500
/** Teto de um id do mapa (chave da pasta, cena, pino). */
const ID_DO_MAPA_MAX = 200

/** O que o Prelúdio gravou em preparo/: a outra janela relê só isso. */
export type MudancaNoPreparo =
  | { readonly o: 'revelado'; readonly campanhaId: string }
  | { readonly o: 'verbete'; readonly id: string }
  | { readonly o: 'tempo' }
  /** O índice (preparo.json): campanhas e a sessão em jogo (P2). */
  | { readonly o: 'indice' }

export type AbaDoVerbete = 'roteiro' | 'quadro'

/** O que está em jogo na mesa agora (a faixa "Mesa" do Prelúdio). */
export interface EstadoDaMesa {
  /**
   * `null` = nenhum mapa aberto no editor. `chave` = a pasta do mapa em
   * `<appData>/maps`, a mesma dos links (`LigaCena.chave`); `null` = mapa novo,
   * ainda sem pasta (não dá para ligar a sessão a ele).
   */
  readonly mapa: { readonly nome: string; readonly chave: string | null } | null
  readonly cena: { readonly id: string; readonly nome: string } | null
  /** O pino selecionado no mapa, se um pino (e só ele) está selecionado. */
  readonly pino: { readonly id: string; readonly nome: string } | null
}

/** A seção de um verbete que vai ao mapa ("Pôr no mapa", P3). */
export interface SecaoParaOMapa {
  readonly verbeteId: string
  readonly formaId: string
  readonly secaoId: string
}

/** Como a seção entra no mapa: "!" (cenário, para ler) ou "?" (fala ou pista). P4/P5 dão papel próprio a cada um. */
export type TipoParaOMapa = 'exclamacao' | 'interrogacao'

/** O andamento de um "Pôr no mapa": a mesa espera o clique, pôs, desistiu ou recusou. */
export type AndamentoDoPor = 'esperando' | 'posto' | 'cancelado' | 'recusado'

/** Uma coisa do mapa ligada a uma seção do Prelúdio (a lista "Na mesa"). Por ora, só pinos. */
export interface ItemNaMesa {
  readonly pinoId: string
  /** O nome do pino como o mestre o lê no mapa. */
  readonly nome: string
  /** O tipo do pino; `'outro'` = viagem, alavanca ou minigame que ficou ligado depois de trocar de tipo. */
  readonly kind: TipoParaOMapa | 'outro'
  /** O endereço do pino, como os links do roteiro (`LigaCena`). */
  readonly chave: string
  readonly sceneId: string
  /** O nome da cena; `''` = mapa sem cenas. */
  readonly cena: string
  readonly verbeteId: string
  readonly formaId: string
  readonly secaoId: string
}

export type PedidoDoPreludio =
  | { readonly de: 'preludio'; readonly v: number; readonly sessao: string; readonly tipo: 'ola' }
  | { readonly de: 'preludio'; readonly v: number; readonly sessao: string; readonly tipo: 'por-no-mapa'; readonly pedido: number; readonly fonte: SecaoParaOMapa; readonly kind: TipoParaOMapa }
  | { readonly de: 'preludio'; readonly v: number; readonly sessao: string; readonly tipo: 'cancelar-por'; readonly pedido: number }
  | { readonly de: 'preludio'; readonly v: number; readonly sessao: string; readonly tipo: 'ping'; readonly n: number }
  | { readonly de: 'preludio'; readonly v: number; readonly sessao: string; readonly tipo: 'ir-a-mesa'; readonly pedido: number; readonly alvo: LigaCena }
  | { readonly de: 'preludio'; readonly v: number; readonly sessao: string; readonly tipo: 'mudou'; readonly mudanca: MudancaNoPreparo }
  | { readonly de: 'preludio'; readonly v: number; readonly sessao: string; readonly tipo: 'gravou'; readonly pedido: number; readonly motivo: string | null }
  /** P4: "Ler agora" de um "!" da lista "Na mesa", para todos da cena do pino. A mesa confere o pino e responde com `resposta`. */
  | { readonly de: 'preludio'; readonly v: number; readonly sessao: string; readonly tipo: 'ler-agora'; readonly pedido: number; readonly alvo: LigaCena }

export type RecadoDaMesa =
  | { readonly de: 'mesa'; readonly v: number; readonly sessao: string; readonly tipo: 'estado'; readonly estado: EstadoDaMesa }
  | { readonly de: 'mesa'; readonly v: number; readonly sessao: string; readonly tipo: 'pong'; readonly n: number }
  | { readonly de: 'mesa'; readonly v: number; readonly sessao: string; readonly tipo: 'abrir-verbete'; readonly verbeteId: string; readonly aba: AbaDoVerbete | null; readonly secaoId: string | null }
  | { readonly de: 'mesa'; readonly v: number; readonly sessao: string; readonly tipo: 'pondo'; readonly pedido: number; readonly andamento: AndamentoDoPor; readonly motivo: string | null }
  | { readonly de: 'mesa'; readonly v: number; readonly sessao: string; readonly tipo: 'na-mesa'; readonly itens: readonly ItemNaMesa[] }
  | { readonly de: 'mesa'; readonly v: number; readonly sessao: string; readonly tipo: 'resposta'; readonly pedido: number; readonly ok: boolean; readonly motivo: string | null }
  | { readonly de: 'mesa'; readonly v: number; readonly sessao: string; readonly tipo: 'mudou'; readonly mudanca: MudancaNoPreparo }
  | { readonly de: 'mesa'; readonly v: number; readonly sessao: string; readonly tipo: 'salvar-agora'; readonly pedido: number }

// Distributiva: tira os campos do envelope de cada membro da união.
type SemEnvelope<M> = M extends unknown ? Omit<M, 'de' | 'v' | 'sessao'> : never
export type CorpoDoPedido = SemEnvelope<PedidoDoPreludio>
export type CorpoDoRecado = SemEnvelope<RecadoDaMesa>

export function pedidoDoPreludio(sessao: string, corpo: CorpoDoPedido): PedidoDoPreludio {
  return { ...corpo, de: 'preludio', v: VERSAO_DO_FIO, sessao } as PedidoDoPreludio
}

export function recadoDaMesa(sessao: string, corpo: CorpoDoRecado): RecadoDaMesa {
  return { ...corpo, de: 'mesa', v: VERSAO_DO_FIO, sessao } as RecadoDaMesa
}

// ─── Conferência ─────────────────────────────────────────────────────────────

function temControle(texto: string): boolean {
  for (const letra of texto) {
    const codigo = letra.codePointAt(0) ?? 0
    if (codigo < 0x20 || codigo === 0x7f) return true
  }
  return false
}

/** Texto de mostrar: até `max` caracteres, sem caractere de controle. */
function nomeValido(valor: unknown, max: number): valor is string {
  return typeof valor === 'string' && valor.length <= max && !temControle(valor)
}

/** Id do mapa: não vazio (a cena pode ser '' no link antigo, ver `idDaCena`). */
function idDoMapaValido(valor: unknown): valor is string {
  return nomeValido(valor, ID_DO_MAPA_MAX) && valor !== ''
}

function numeroValido(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 0
}

/** `null` = sem motivo; `undefined` = motivo torto (a mensagem inteira é ignorada). */
function lerMotivo(valor: unknown): string | null | undefined {
  if (valor === null) return null
  return nomeValido(valor, MOTIVO_MAX) ? valor : undefined
}

/** O envelope: lado certo, versão certa, sessão desta janela. */
function envelopeValido(dado: unknown, de: 'preludio' | 'mesa', sessao: string): dado is Record<string, unknown> {
  return ehRegistro(dado) && dado.de === de && dado.v === VERSAO_DO_FIO && typeof dado.sessao === 'string' && SESSAO_DA_JANELA_VALIDA.test(dado.sessao) && dado.sessao === sessao
}

function lerMudanca(valor: unknown): MudancaNoPreparo | null {
  if (!ehRegistro(valor)) return null
  if (valor.o === 'revelado') return idDoPreparoValido(valor.campanhaId) ? { o: 'revelado', campanhaId: valor.campanhaId } : null
  if (valor.o === 'verbete') return idDoPreparoValido(valor.id) ? { o: 'verbete', id: valor.id } : null
  if (valor.o === 'tempo') return { o: 'tempo' }
  if (valor.o === 'indice') return { o: 'indice' }
  return null
}

/** O alvo de um link do roteiro: a mesa ainda confere se o mapa, a cena e o pino existem. */
export function lerAlvoNaMesa(valor: unknown): LigaCena | null {
  if (!ehRegistro(valor)) return null
  const { chave, sceneId, pinoId } = valor
  // `sceneId` vazio = o link de quando o mapa não tinha cenas (`irNaCena`).
  if (!idDoMapaValido(chave) || !nomeValido(sceneId, ID_DO_MAPA_MAX)) return null
  if (pinoId === undefined) return { chave, sceneId }
  return idDoMapaValido(pinoId) ? { chave, sceneId, pinoId } : null
}

/** Teto da lista "Na mesa" (um mapa com mais pinos ligados que isso manda os primeiros). */
export const NA_MESA_MAX = 500

/** Id de forma ou de seção dentro do verbete: não vazio, no teto, sem controle. */
function idDentroDoVerbete(valor: unknown): valor is string {
  return idDoMapaValido(valor)
}

function lerTipoParaOMapa(valor: unknown): TipoParaOMapa | null {
  return valor === 'exclamacao' || valor === 'interrogacao' ? valor : null
}

/** A seção que o Prelúdio quer no mapa. A mesa ainda confere no verbete se ela existe e não é segredo. */
export function lerSecaoParaOMapa(valor: unknown): SecaoParaOMapa | null {
  if (!ehRegistro(valor)) return null
  const { verbeteId, formaId, secaoId } = valor
  return idDoPreparoValido(verbeteId) && idDentroDoVerbete(formaId) && idDentroDoVerbete(secaoId) ? { verbeteId, formaId, secaoId } : null
}

function lerItemNaMesa(valor: unknown): ItemNaMesa | null {
  if (!ehRegistro(valor)) return null
  const { pinoId, nome, kind, chave, sceneId, cena } = valor
  const fonte = lerSecaoParaOMapa(valor)
  const tipo = kind === 'outro' ? 'outro' : lerTipoParaOMapa(kind)
  if (fonte === null || tipo === null || !idDoMapaValido(pinoId) || !nomeValido(nome, NOME_MAX) || !idDoMapaValido(chave)) return null
  if (!nomeValido(sceneId, ID_DO_MAPA_MAX) || !nomeValido(cena, NOME_MAX)) return null
  return { pinoId, nome, kind: tipo, chave, sceneId, cena, ...fonte }
}

function lerItensNaMesa(valor: unknown): ItemNaMesa[] | null {
  if (!Array.isArray(valor) || valor.length > NA_MESA_MAX) return null
  const itens: ItemNaMesa[] = []
  for (const bruto of valor) {
    const item = lerItemNaMesa(bruto)
    // Um item torto derruba a lista inteira: lista pela metade diria "não está no mapa" do que está.
    if (item === null) return null
    itens.push(item)
  }
  return itens
}

function lerAndamento(valor: unknown): AndamentoDoPor | null {
  return valor === 'esperando' || valor === 'posto' || valor === 'cancelado' || valor === 'recusado' ? valor : null
}

/** A mesa lê o que veio do Prelúdio. `null` = ignorar. */
export function lerPedidoDoPreludio(dado: unknown, sessao: string): PedidoDoPreludio | null {
  if (!envelopeValido(dado, 'preludio', sessao)) return null
  const envelope = { de: 'preludio', v: VERSAO_DO_FIO, sessao } as const
  switch (dado.tipo) {
    case 'ola':
      return { ...envelope, tipo: 'ola' }
    case 'por-no-mapa': {
      const fonte = lerSecaoParaOMapa(dado.fonte)
      const kind = lerTipoParaOMapa(dado.kind)
      return fonte === null || kind === null || !numeroValido(dado.pedido) ? null : { ...envelope, tipo: 'por-no-mapa', pedido: dado.pedido, fonte, kind }
    }
    case 'cancelar-por':
      return numeroValido(dado.pedido) ? { ...envelope, tipo: 'cancelar-por', pedido: dado.pedido } : null
    case 'ping':
      return numeroValido(dado.n) ? { ...envelope, tipo: 'ping', n: dado.n } : null
    case 'ir-a-mesa': {
      const alvo = lerAlvoNaMesa(dado.alvo)
      return alvo !== null && numeroValido(dado.pedido) ? { ...envelope, tipo: 'ir-a-mesa', pedido: dado.pedido, alvo } : null
    }
    case 'mudou': {
      const mudanca = lerMudanca(dado.mudanca)
      return mudanca === null ? null : { ...envelope, tipo: 'mudou', mudanca }
    }
    case 'gravou': {
      const motivo = lerMotivo(dado.motivo)
      return motivo === undefined || !numeroValido(dado.pedido) ? null : { ...envelope, tipo: 'gravou', pedido: dado.pedido, motivo }
    }
    case 'ler-agora': {
      // Só o endereço do pino: o texto nunca vem pelo fio (a mesa lê o do próprio pino).
      const alvo = lerAlvoNaMesa(dado.alvo)
      return alvo === null || alvo.pinoId === undefined || !numeroValido(dado.pedido) ? null : { ...envelope, tipo: 'ler-agora', pedido: dado.pedido, alvo }
    }
    default:
      return null
  }
}

function lerEstado(valor: unknown): EstadoDaMesa | null {
  if (!ehRegistro(valor)) return null
  const { mapa, cena, pino } = valor
  let mapaLido: EstadoDaMesa['mapa'] = null
  if (mapa !== null) {
    if (!ehRegistro(mapa) || !nomeValido(mapa.nome, NOME_MAX)) return null
    if (mapa.chave !== null && !idDoMapaValido(mapa.chave)) return null
    mapaLido = { nome: mapa.nome, chave: mapa.chave }
  }
  let cenaLida: EstadoDaMesa['cena'] = null
  if (cena !== null) {
    if (!ehRegistro(cena) || !idDoMapaValido(cena.id) || !nomeValido(cena.nome, NOME_MAX)) return null
    cenaLida = { id: cena.id, nome: cena.nome }
  }
  let pinoLido: EstadoDaMesa['pino'] = null
  if (pino !== null) {
    if (!ehRegistro(pino) || !idDoMapaValido(pino.id) || !nomeValido(pino.nome, NOME_MAX)) return null
    pinoLido = { id: pino.id, nome: pino.nome }
  }
  return { mapa: mapaLido, cena: cenaLida, pino: pinoLido }
}

/** O Prelúdio lê o que veio da mesa. `null` = ignorar. */
export function lerRecadoDaMesa(dado: unknown, sessao: string): RecadoDaMesa | null {
  if (!envelopeValido(dado, 'mesa', sessao)) return null
  const envelope = { de: 'mesa', v: VERSAO_DO_FIO, sessao } as const
  switch (dado.tipo) {
    case 'estado': {
      const estado = lerEstado(dado.estado)
      return estado === null ? null : { ...envelope, tipo: 'estado', estado }
    }
    case 'pong':
      return numeroValido(dado.n) ? { ...envelope, tipo: 'pong', n: dado.n } : null
    case 'abrir-verbete': {
      if (!idDoPreparoValido(dado.verbeteId)) return null
      const aba = dado.aba === 'roteiro' || dado.aba === 'quadro' ? dado.aba : dado.aba === null ? null : undefined
      const secaoId = dado.secaoId === null ? null : idDentroDoVerbete(dado.secaoId) ? dado.secaoId : undefined
      return aba === undefined || secaoId === undefined ? null : { ...envelope, tipo: 'abrir-verbete', verbeteId: dado.verbeteId, aba, secaoId }
    }
    case 'pondo': {
      const andamento = lerAndamento(dado.andamento)
      const motivo = lerMotivo(dado.motivo)
      return andamento === null || motivo === undefined || !numeroValido(dado.pedido) ? null : { ...envelope, tipo: 'pondo', pedido: dado.pedido, andamento, motivo }
    }
    case 'na-mesa': {
      const itens = lerItensNaMesa(dado.itens)
      return itens === null ? null : { ...envelope, tipo: 'na-mesa', itens }
    }
    case 'resposta': {
      const motivo = lerMotivo(dado.motivo)
      if (motivo === undefined || !numeroValido(dado.pedido) || typeof dado.ok !== 'boolean') return null
      return { ...envelope, tipo: 'resposta', pedido: dado.pedido, ok: dado.ok, motivo }
    }
    case 'mudou': {
      const mudanca = lerMudanca(dado.mudanca)
      return mudanca === null ? null : { ...envelope, tipo: 'mudou', mudanca }
    }
    case 'salvar-agora':
      return numeroValido(dado.pedido) ? { ...envelope, tipo: 'salvar-agora', pedido: dado.pedido } : null
    default:
      return null
  }
}

function limparParaOFio(texto: string, max: number): string {
  let limpo = ''
  for (const letra of texto) {
    const codigo = letra.codePointAt(0) ?? 0
    limpo += codigo < 0x20 || codigo === 0x7f ? ' ' : letra
  }
  return limpo.length > max ? `${limpo.slice(0, max - 1)}…` : limpo
}

/** Nome de mostrar no teto do fio (quem manda corta; quem recebe recusa o que passar). */
export function nomeParaOFio(nome: string): string {
  return limparParaOFio(nome, NOME_MAX)
}

/** O id do mapa (chave, cena, pino) que cabe no fio; o que não cabe não vai (`null`). */
export function idDoMapaParaOFio(id: string | null | undefined): string | null {
  return idDoMapaValido(id) ? id : null
}

/** Motivo no teto do fio. */
export function motivoParaOFio(motivo: string): string {
  return limparParaOFio(motivo, MOTIVO_MAX)
}
