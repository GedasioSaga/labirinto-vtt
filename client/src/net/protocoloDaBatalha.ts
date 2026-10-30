import { personagemDoArquivo, type Personagem } from '../lib/personagem'
import {
  ALVOS_MAX,
  ARMAS_NA_BATALHA_MAX,
  CARGA_MAX,
  CUSTO_MAX,
  DANO_MAX,
  EFEITOS_POR_MENSAGEM,
  GOLPES_PENDENTES_MAX,
  MODIFICADOR_DA_REACAO_MAX,
  NOME_DO_GOLPE_MAX,
  type AcaoDaTecnica,
  type PedidoDeAcao,
  type PedidoDeAlvo,
  type PedidoDeReacao,
  type RolagemDaReacao,
  type SaidaDaReacao,
} from '../lib/batalha/combate'
import { NOME_DA_EQUIPE_MAX } from '../lib/batalha/equipes'
import { LIMITE_DE_ARMAS_MAX } from '../lib/batalha/leituraDaFicha'
import type { VezEsperada } from '../lib/batalha/ponte'
import { AUTOR_NO_REGISTRO_MAX, REGISTRO_PARA_JOGADOR_MAX, REGISTRO_TEXTO_MAX, type LinhaParaJogador } from '../lib/batalha/registro'
import { lerRegrasDaBatalha, type RegrasDaBatalha } from '../lib/batalha/regrasDoCampo'
import type { DuracaoDaExtra } from '../lib/batalha/turnos'
import {
  CARTAS_PARA_JOGADOR_MAX,
  CARTOES_NO_COMBATE_MAX,
  MEUS_NO_COMBATE_MAX,
  NOME_NA_CARTA_MAX,
  type AcoesParaJogador,
  type AlvoParaJogador,
  type CartaParaJogador,
  type CombateParaJogador,
  type ContraParaJogador,
  type EfeitoParaJogador,
  type EstadoParaJogador,
  type GolpeParaJogador,
  type LadoNaCarta,
  type ReacaoParaJogador,
} from '../lib/batalha/vistaDoJogador'

/**
 * BATALHA ONE PIECE, F1 (seção 3 de docs/planos/batalha-one-piece-f1-plano.md):
 * as mensagens da ordem dos turnos entre o jogador e o host, e a validação de
 * fronteira de cada uma.
 *
 * Do jogador para o host — os ÚNICOS pedidos de batalha que passam pela rede
 * (tudo o mais é ação local do mestre na store):
 *  - `batalha.passar`: "Passar a vez", com a carta e a rodada que ele viu;
 *  - `batalha.desfazer`: Desfazer uma linha do registro;
 *  - F2 (seção 4 de docs/planos/batalha-one-piece-f2-plano.md):
 *    `batalha.agir` (Atacar, Habilidade, Concentrar, o contra-ataque gasto em
 *    Mover), `batalha.reagir` (o d20 é rolado pelo HOST: o pedido não tem
 *    campo de dado), `batalha.dano` (dano livre na ficha dele) e
 *    `batalha.armas` (as armas da batalha, quando quiser, Q8).
 * O host confere o resto (é a vez dele? a linha é dele?) e responde só
 * `ok: false`, sem motivo: motivo ensinaria ids.
 *
 * Do host para o jogador:
 *  - `batalha.estado`: o recorte dele (`vistaParaJogador`), só quando muda;
 *    `null` uma vez ao sair da batalha ou da cena;
 *  - `batalha.aliados`: os personagens dos aliados (perfil e vida), sem `dono`;
 *  - `batalha.resultado`: a resposta a cada pedido, pelo `reqId`;
 *  - F2: `batalha.efeitos`, as animações novas que a tela dele pode tocar.
 *
 * Entrada é hostil dos dois lados: campo torto derruba a mensagem inteira. O
 * host já corta nomes e textos no teto (`vistaDoJogador.ts`, `registro.ts`),
 * então acima do teto aqui é mensagem forjada.
 *
 * Este módulo não importa `protocol.ts`, que importa daqui: o ciclo entre os
 * dois deixaria um deles meio carregado conforme a ordem de import.
 */

/** Mesmo teto de `REQ_ID_MAX_LENGTH` (protocol.ts). */
const REQ_ID_MAX = 64
/** Ids de carta, linha e token no fio. */
export const ID_DA_BATALHA_MAX = 80
/** Id de personagem: o mesmo teto de `PERSONAGEM_ID_MAX` (protocoloDoPersonagem.ts). */
const PERSONAGEM_ID_MAX = 128
export const RODADA_MAX = 100_000
/** Pedidos de batalha por jogador dentro da janela; o resto morre calado. F2: 20 (golpe em 4 alvos + rerolagens cabe). */
export const PEDIDOS_DE_BATALHA_POR_JANELA = 20
export const JANELA_DOS_PEDIDOS_DE_BATALHA_MS = 5_000
/** Personagens num `batalha.aliados`: uma mesa não chega perto. */
export const ALIADOS_MAX = 64
const COR_HEX = /^#[0-9a-f]{6}$/i

export interface BatalhaPassarMessage {
  type: 'batalha.passar'
  reqId: string
  cartaId: string
  rodada: number
}

export interface BatalhaDesfazerMessage {
  type: 'batalha.desfazer'
  reqId: string
  linhaId: string
}

/** F2: agir. `vez` = a carta e a rodada que ele viu; `null` só no contra-ataque (`pedido.contraDe`, Q6). */
export interface BatalhaAgirMessage {
  type: 'batalha.agir'
  reqId: string
  vez: VezEsperada | null
  pedido: PedidoDeAcao
}

/** F2: reagir. Sem campo de dado: quem rola é o host. */
export interface BatalhaReagirMessage {
  type: 'batalha.reagir'
  reqId: string
  pedido: PedidoDeReacao
}

/** F2: dano livre numa ficha dele (de 1 a `DANO_MAX`). */
export interface BatalhaDanoMessage {
  type: 'batalha.dano'
  reqId: string
  tokenId: string
  valor: number
}

/** F2: as armas da aba Armas levadas para a batalha (Q8: troca quando quiser, dentro do limite). */
export interface BatalhaArmasMessage {
  type: 'batalha.armas'
  reqId: string
  personagemId: string
  armas: string[]
}

/** Os pedidos de batalha do jogador da F1 (entram na união `PlayerMessage`). */
export type BatalhaPlayerMessage = BatalhaPassarMessage | BatalhaDesfazerMessage

/**
 * F2: os pedidos novos do jogador. União à parte para o contrato compilar
 * sem mexer no `switch` do host: B a junta à `PlayerMessage` (`protocol.ts`)
 * junto com os `case` em `hostSession.ts`.
 */
export type BatalhaAcaoPlayerMessage = BatalhaAgirMessage | BatalhaReagirMessage | BatalhaDanoMessage | BatalhaArmasMessage

export interface BatalhaEstadoMessage {
  type: 'batalha.estado'
  estado: EstadoParaJogador | null
}

export interface BatalhaAliadosMessage {
  type: 'batalha.aliados'
  personagens: Personagem[]
}

export interface BatalhaResultadoMessage {
  type: 'batalha.resultado'
  reqId: string
  ok: boolean
}

/** F2: as animações novas para esta conexão (`efeitosParaJogador`), até `EFEITOS_POR_MENSAGEM`, `seq` crescente. */
export interface BatalhaEfeitosMessage {
  type: 'batalha.efeitos'
  efeitos: EfeitoParaJogador[]
}

/** As mensagens de batalha do host (entram na união `HostMessage`). */
export type BatalhaHostMessage = BatalhaEstadoMessage | BatalhaAliadosMessage | BatalhaResultadoMessage | BatalhaEfeitosMessage

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function textoAte(value: unknown, minimo: number, maximo: number): value is string {
  return typeof value === 'string' && value.length >= minimo && value.length <= maximo
}

function inteiroAte(value: unknown, minimo: number, maximo: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimo && value <= maximo
}

function idOuNulo(value: unknown): value is string | null {
  return value === null || textoAte(value, 1, ID_DA_BATALHA_MAX)
}

// ---- jogador → host ----

export function parseBatalhaPassar(value: unknown): BatalhaPassarMessage | null {
  if (!isRecord(value) || value.type !== 'batalha.passar') return null
  const { reqId, cartaId, rodada } = value
  if (!textoAte(reqId, 1, REQ_ID_MAX) || !textoAte(cartaId, 1, ID_DA_BATALHA_MAX) || !inteiroAte(rodada, 1, RODADA_MAX)) return null
  return { type: 'batalha.passar', reqId, cartaId, rodada }
}

export function parseBatalhaDesfazer(value: unknown): BatalhaDesfazerMessage | null {
  if (!isRecord(value) || value.type !== 'batalha.desfazer') return null
  const { reqId, linhaId } = value
  if (!textoAte(reqId, 1, REQ_ID_MAX) || !textoAte(linhaId, 1, ID_DA_BATALHA_MAX)) return null
  return { type: 'batalha.desfazer', reqId, linhaId }
}

/** Id de cartão da ficha (técnica, arma): o mesmo teto do personagem (`protocoloDoPersonagem.ts`). */
const CARTAO_ID_MAX = PERSONAGEM_ID_MAX
const LADOS_DO_D20 = 20

function cartaoOuNulo(value: unknown): value is string | null {
  return value === null || textoAte(value, 1, CARTAO_ID_MAX)
}

function lerVezEsperada(value: unknown): VezEsperada | null {
  if (!isRecord(value)) return null
  const { cartaId, rodada } = value
  if (!textoAte(cartaId, 1, ID_DA_BATALHA_MAX) || !inteiroAte(rodada, 1, RODADA_MAX)) return null
  return { cartaId, rodada }
}

function lerAlvoDoPedido(value: unknown): PedidoDeAlvo | null {
  if (!isRecord(value)) return null
  const { tokenId, dano } = value
  if (!textoAte(tokenId, 1, ID_DA_BATALHA_MAX) || (dano !== null && !inteiroAte(dano, 0, DANO_MAX))) return null
  return { tokenId, dano }
}

/** Os alvos do pedido: entre `minimo` e `ALVOS_MAX`, sem ficha repetida. */
function lerAlvosDoPedido(value: unknown, minimo: number): PedidoDeAlvo[] | null {
  const alvos = lerLista(value, ALVOS_MAX, lerAlvoDoPedido)
  if (alvos === null || alvos.length < minimo) return null
  return new Set(alvos.map((alvo) => alvo.tokenId)).size === alvos.length ? alvos : null
}

function lerAcaoDaTecnica(value: unknown): AcaoDaTecnica | null {
  return value === 'simples' || value === 'completa' || value === 'bonus' || value === 'livre' ? value : null
}

function lerSaida(value: unknown): SaidaDaReacao | null {
  return value === 'critico' || value === 'cheio' || value === 'metade' || value === 'esquiva' || value === 'contra' || value === 'naoReagiu' || value === 'semReacao'
    ? value
    : null
}

/** `contraDe` ausente, ou o id do golpe. `false` = torto. */
function lerContraDe(value: unknown): string | undefined | false {
  if (value === undefined) return undefined
  return textoAte(value, 1, ID_DA_BATALHA_MAX) ? value : false
}

/** O pedido de ação, enum fechado no `tipo`. */
export function lerPedidoDeAcao(value: unknown): PedidoDeAcao | null {
  if (!isRecord(value)) return null
  switch (value.tipo) {
    case 'atacar': {
      const { armaId, alvos, surpresa, perfurante } = value
      const contraDe = lerContraDe(value.contraDe)
      const alvosLidos = lerAlvosDoPedido(alvos, 1)
      if (!cartaoOuNulo(armaId) || alvosLidos === null || typeof surpresa !== 'boolean' || typeof perfurante !== 'boolean' || contraDe === false) return null
      const pedido: PedidoDeAcao = { tipo: 'atacar', armaId, alvos: alvosLidos, surpresa, perfurante }
      if (contraDe !== undefined) pedido.contraDe = contraDe
      return pedido
    }
    case 'habilidade': {
      const { cartaoId, armaId, alvos, surpresa, perfurante, custo, acao } = value
      const contraDe = lerContraDe(value.contraDe)
      // Habilidade de suporte pode não ter alvo.
      const alvosLidos = lerAlvosDoPedido(alvos, 0)
      const acaoLida = acao === null ? null : lerAcaoDaTecnica(acao)
      if (!textoAte(cartaoId, 1, CARTAO_ID_MAX) || !cartaoOuNulo(armaId) || alvosLidos === null || typeof surpresa !== 'boolean' || typeof perfurante !== 'boolean') return null
      if ((custo !== null && !inteiroAte(custo, 0, CUSTO_MAX)) || (acao !== null && acaoLida === null) || contraDe === false) return null
      const pedido: PedidoDeAcao = { tipo: 'habilidade', cartaoId, armaId, alvos: alvosLidos, surpresa, perfurante, custo, acao: acaoLida }
      if (contraDe !== undefined) pedido.contraDe = contraDe
      return pedido
    }
    case 'concentrar':
      return { tipo: 'concentrar' }
    case 'mover': {
      const contraDe = lerContraDe(value.contraDe)
      return contraDe === undefined || contraDe === false ? null : { tipo: 'mover', contraDe }
    }
    default:
      return null
  }
}

function contraDoPedido(pedido: PedidoDeAcao): string | undefined {
  return pedido.tipo === 'concentrar' ? undefined : pedido.contraDe
}

export function parseBatalhaAgir(value: unknown): BatalhaAgirMessage | null {
  if (!isRecord(value) || value.type !== 'batalha.agir' || !('vez' in value)) return null
  const { reqId } = value
  const vez = value.vez === null ? null : lerVezEsperada(value.vez)
  const pedido = lerPedidoDeAcao(value.pedido)
  if (!textoAte(reqId, 1, REQ_ID_MAX) || pedido === null || (value.vez !== null && vez === null)) return null
  // Sem vez SÓ o contra-ataque (Q6, fora da vez); e o contra-ataque nunca vem com vez.
  if ((vez === null) !== (contraDoPedido(pedido) !== undefined)) return null
  return { type: 'batalha.agir', reqId, vez, pedido }
}

function lerModificador(value: unknown): value is number {
  return inteiroAte(value, -MODIFICADOR_DA_REACAO_MAX, MODIFICADOR_DA_REACAO_MAX)
}

/** O pedido de reação, enum fechado no `tipo`. Nenhum campo de dado: quem rola é o host. */
export function lerPedidoDeReacao(value: unknown): PedidoDeReacao | null {
  if (!isRecord(value)) return null
  const { golpeId, tokenId } = value
  if (!textoAte(tokenId, 1, ID_DA_BATALHA_MAX)) return null
  switch (value.tipo) {
    case 'rolar':
      return idOuNulo(golpeId) && lerModificador(value.modificador) ? { tipo: 'rolar', golpeId, tokenId, modificador: value.modificador } : null
    case 'rerolar':
      return textoAte(golpeId, 1, ID_DA_BATALHA_MAX) && lerModificador(value.modificador) ? { tipo: 'rerolar', golpeId, tokenId, modificador: value.modificador } : null
    case 'escolher': {
      const saida = lerSaida(value.saida)
      return textoAte(golpeId, 1, ID_DA_BATALHA_MAX) && saida !== null ? { tipo: 'escolher', golpeId, tokenId, saida } : null
    }
    case 'naoReagir':
      return textoAte(golpeId, 1, ID_DA_BATALHA_MAX) ? { tipo: 'naoReagir', golpeId, tokenId } : null
    default:
      return null
  }
}

export function parseBatalhaReagir(value: unknown): BatalhaReagirMessage | null {
  if (!isRecord(value) || value.type !== 'batalha.reagir') return null
  const { reqId } = value
  const pedido = lerPedidoDeReacao(value.pedido)
  if (!textoAte(reqId, 1, REQ_ID_MAX) || pedido === null) return null
  return { type: 'batalha.reagir', reqId, pedido }
}

export function parseBatalhaDano(value: unknown): BatalhaDanoMessage | null {
  if (!isRecord(value) || value.type !== 'batalha.dano') return null
  const { reqId, tokenId, valor } = value
  if (!textoAte(reqId, 1, REQ_ID_MAX) || !textoAte(tokenId, 1, ID_DA_BATALHA_MAX) || !inteiroAte(valor, 1, DANO_MAX)) return null
  return { type: 'batalha.dano', reqId, tokenId, valor }
}

function lerCartaoId(value: unknown): string | null {
  return textoAte(value, 1, CARTAO_ID_MAX) ? value : null
}

/** Ids de cartão sem repetição, até `ARMAS_NA_BATALHA_MAX`. */
function lerArmas(value: unknown): string[] | null {
  const armas = lerLista(value, ARMAS_NA_BATALHA_MAX, lerCartaoId)
  return armas !== null && new Set(armas).size === armas.length ? armas : null
}

export function parseBatalhaArmas(value: unknown): BatalhaArmasMessage | null {
  if (!isRecord(value) || value.type !== 'batalha.armas') return null
  const { reqId, personagemId } = value
  const armas = lerArmas(value.armas)
  if (!textoAte(reqId, 1, REQ_ID_MAX) || !textoAte(personagemId, 1, PERSONAGEM_ID_MAX) || armas === null) return null
  return { type: 'batalha.armas', reqId, personagemId, armas }
}

// ---- host → jogador ----

function lerLado(value: unknown): LadoNaCarta | null {
  return value === 'eu' || value === 'aliado' || value === 'outro' ? value : null
}

function lerDuracao(value: unknown): DuracaoDaExtra | null {
  return value === 'rodada' || value === 'sempre' ? value : null
}

function lerCarta(value: unknown): CartaParaJogador | null {
  if (!isRecord(value)) return null
  const { id, tokenId, nome, lado, equipe, personagemId, extra, caiu } = value
  const ladoLido = lerLado(lado)
  if (!textoAte(id, 1, ID_DA_BATALHA_MAX) || !textoAte(tokenId, 1, ID_DA_BATALHA_MAX) || !textoAte(nome, 0, NOME_NA_CARTA_MAX) || ladoLido === null) return null
  const carta: CartaParaJogador = { id, tokenId, nome, lado: ladoLido }
  if (equipe !== undefined) {
    if (!isRecord(equipe) || !textoAte(equipe.nome, 1, NOME_DA_EQUIPE_MAX) || typeof equipe.cor !== 'string' || !COR_HEX.test(equipe.cor)) return null
    carta.equipe = { nome: equipe.nome, cor: equipe.cor }
  }
  // Perfil e queda só nas cartas dele e dos aliados: na de "outro", é mensagem forjada.
  if (personagemId !== undefined) {
    if (ladoLido === 'outro' || !textoAte(personagemId, 1, PERSONAGEM_ID_MAX)) return null
    carta.personagemId = personagemId
  }
  if (extra !== undefined) {
    const duracao = lerDuracao(extra)
    if (duracao === null) return null
    carta.extra = duracao
  }
  if (caiu !== undefined) {
    if (caiu !== true || ladoLido === 'outro') return null
    carta.caiu = true
  }
  return carta
}

function lerLinha(value: unknown): LinhaParaJogador | null {
  if (!isRecord(value)) return null
  const { id, rodada, autor, texto, desfeita, podeDesfazer } = value
  if (!textoAte(id, 1, ID_DA_BATALHA_MAX) || !inteiroAte(rodada, 1, RODADA_MAX)) return null
  if (!textoAte(autor, 1, AUTOR_NO_REGISTRO_MAX) || !textoAte(texto, 0, REGISTRO_TEXTO_MAX) || typeof podeDesfazer !== 'boolean') return null
  const linha: LinhaParaJogador = { id, rodada, autor, texto, podeDesfazer }
  if (desfeita !== undefined) {
    if (!isRecord(desfeita) || !textoAte(desfeita.por, 1, AUTOR_NO_REGISTRO_MAX)) return null
    linha.desfeita = { por: desfeita.por }
  }
  return linha
}

/** Lista do fio, item a item; um item torto ou lista acima do teto recusa tudo. */
function lerLista<T>(value: unknown, maximo: number, ler: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(value) || value.length > maximo) return null
  const lidos: T[] = []
  for (const item of value) {
    const lido = ler(item)
    if (lido === null) return null
    lidos.push(lido)
  }
  return lidos
}

// ---- F2: os campos novos do recorte ----

/** Teto de uma contagem de ações (1 + as extras do mestre). */
const CONTAGEM_MAX = 1_000
/** Teto dos blocos andados e do limite. */
const BLOCOS_NO_FIO_MAX = 100_000
/** Teto de uma recarga ou de um contador de usos. */
const CONTADOR_DE_TECNICA_MAX = 1_000
/** Teto das rerolagens de uma reação (sem limite na regra; o fio tem). */
const REROLAGENS_MAX = 10_000
/** O `seq` dos efeitos sobe de 1 em 1 por cena. */
const SEQ_MAX = Number.MAX_SAFE_INTEGER

function lerContagem(value: unknown): { usadas: number; total: number } | null {
  if (!isRecord(value)) return null
  const { usadas, total } = value
  return inteiroAte(usadas, 0, CONTAGEM_MAX) && inteiroAte(total, 0, CONTAGEM_MAX) ? { usadas, total } : null
}

function lerAcoes(value: unknown): AcoesParaJogador | null {
  if (!isRecord(value) || !isRecord(value.blocos)) return null
  const simples = lerContagem(value.simples)
  const movimento = lerContagem(value.movimento)
  const bonus = lerContagem(value.bonus)
  const { andados, limite } = value.blocos
  if (simples === null || movimento === null || bonus === null || !inteiroAte(andados, 0, BLOCOS_NO_FIO_MAX)) return null
  if (limite !== null && !inteiroAte(limite, 0, BLOCOS_NO_FIO_MAX)) return null
  return { simples, movimento, bonus, blocos: { andados, limite } }
}

/** cartaoId → contador, até `CARTOES_NO_COMBATE_MAX` chaves. */
function lerContadores(value: unknown): Record<string, number> | null {
  if (!isRecord(value)) return null
  const entradas = Object.entries(value)
  if (entradas.length > CARTOES_NO_COMBATE_MAX) return null
  const lidos: Record<string, number> = {}
  for (const [chave, numero] of entradas) {
    if (!textoAte(chave, 1, CARTAO_ID_MAX) || !inteiroAte(numero, 0, CONTADOR_DE_TECNICA_MAX)) return null
    lidos[chave] = numero
  }
  return lidos
}

function lerCombate(value: unknown): CombateParaJogador | null {
  if (!isRecord(value)) return null
  const { personagemId, overload, carga, concentrouNestaVez, limiteDeArmas } = value
  const recargas = lerContadores(value.recargas)
  const usos = lerContadores(value.usos)
  const armas = value.armas === null ? null : lerArmas(value.armas)
  if (!textoAte(personagemId, 1, PERSONAGEM_ID_MAX) || recargas === null || usos === null || typeof overload !== 'boolean') return null
  if (!inteiroAte(carga, 0, CARGA_MAX) || typeof concentrouNestaVez !== 'boolean' || (value.armas !== null && armas === null)) return null
  if (limiteDeArmas !== null && !inteiroAte(limiteDeArmas, 1, LIMITE_DE_ARMAS_MAX)) return null
  return { personagemId, recargas, usos, overload, carga, concentrouNestaVez, armas, limiteDeArmas }
}

function lerD20(value: unknown): value is number {
  return inteiroAte(value, 1, LADOS_DO_D20)
}

/** A rolagem do host: o total tem de bater com o dado e o modificador. */
function lerRolagem(value: unknown): RolagemDaReacao | null {
  if (!isRecord(value)) return null
  const { d20, modificador, total, vezes } = value
  if (!lerD20(d20) || !lerModificador(modificador) || total !== d20 + modificador || !inteiroAte(vezes, 1, REROLAGENS_MAX)) return null
  return { d20, modificador, total, vezes }
}

function lerReacao(value: unknown): ReacaoParaJogador | null {
  if (!isRecord(value)) return null
  const { golpeId, tokenId, atacante, nome, dano, perfurante, rolagem } = value
  if (!textoAte(golpeId, 1, ID_DA_BATALHA_MAX) || !textoAte(tokenId, 1, ID_DA_BATALHA_MAX) || !textoAte(atacante, 1, NOME_NA_CARTA_MAX)) return null
  if (!textoAte(nome, 0, NOME_DO_GOLPE_MAX) || (dano !== null && !inteiroAte(dano, 0, DANO_MAX))) return null
  const reacao: ReacaoParaJogador = { golpeId, tokenId, atacante, nome, dano }
  if (perfurante !== undefined) {
    if (perfurante !== true) return null
    reacao.perfurante = true
  }
  if (rolagem !== undefined) {
    const lida = lerRolagem(rolagem)
    if (lida === null) return null
    reacao.rolagem = lida
  }
  return reacao
}

function lerAlvoVisto(value: unknown): AlvoParaJogador | null {
  if (!isRecord(value)) return null
  const { tokenId, d20, total, saida } = value
  if (!textoAte(tokenId, 1, ID_DA_BATALHA_MAX)) return null
  const alvo: AlvoParaJogador = { tokenId }
  // O dado e o total andam juntos.
  if ((d20 === undefined) !== (total === undefined)) return null
  if (d20 !== undefined) {
    if (!lerD20(d20) || !inteiroAte(total, d20 - MODIFICADOR_DA_REACAO_MAX, d20 + MODIFICADOR_DA_REACAO_MAX)) return null
    alvo.d20 = d20
    alvo.total = total
  }
  if (saida !== undefined) {
    const lida = lerSaida(saida)
    if (lida === null) return null
    alvo.saida = lida
  }
  return alvo
}

function lerGolpeVisto(value: unknown): GolpeParaJogador | null {
  if (!isRecord(value)) return null
  const { golpeId, atacanteTokenId, nome } = value
  const alvos = lerLista(value.alvos, ALVOS_MAX, lerAlvoVisto)
  if (!textoAte(golpeId, 1, ID_DA_BATALHA_MAX) || !textoAte(atacanteTokenId, 1, ID_DA_BATALHA_MAX) || !textoAte(nome, 0, NOME_DO_GOLPE_MAX)) return null
  if (alvos === null || alvos.length === 0) return null
  return { golpeId, atacanteTokenId, nome, alvos }
}

function lerContra(value: unknown): ContraParaJogador | null {
  if (!isRecord(value)) return null
  const { golpeId, tokenId, atacanteTokenId } = value
  if (!textoAte(golpeId, 1, ID_DA_BATALHA_MAX) || !textoAte(tokenId, 1, ID_DA_BATALHA_MAX) || !idOuNulo(atacanteTokenId)) return null
  return { golpeId, tokenId, atacanteTokenId }
}

/** Campo opcional do recorte: ausente = `undefined`; presente e torto = `null` (recusa o estado). */
function opcional<T>(value: unknown, ler: (item: unknown) => T | null): T | undefined | null {
  return value === undefined ? undefined : ler(value)
}

/** Os campos da F2 já lidos; `null` = algum torto. */
interface CamposDaF2 {
  acoes?: AcoesParaJogador
  meus?: CombateParaJogador[]
  reacoes?: ReacaoParaJogador[]
  golpes?: GolpeParaJogador[]
  contras?: ContraParaJogador[]
}

function lerCamposDaF2(value: Record<string, unknown>, minhaVez: boolean): CamposDaF2 | null {
  const acoes = opcional(value.acoes, lerAcoes)
  const meus = opcional(value.meus, (item) => lerLista(item, MEUS_NO_COMBATE_MAX, lerCombate))
  const reacoes = opcional(value.reacoes, (item) => lerLista(item, GOLPES_PENDENTES_MAX, lerReacao))
  const golpes = opcional(value.golpes, (item) => lerLista(item, GOLPES_PENDENTES_MAX, lerGolpeVisto))
  const contras = opcional(value.contras, (item) => lerLista(item, GOLPES_PENDENTES_MAX, lerContra))
  if (acoes === null || meus === null || reacoes === null || golpes === null || contras === null) return null
  // As ações só vêm na vez dele: fora dela é mensagem forjada.
  if (acoes !== undefined && !minhaVez) return null
  const campos: CamposDaF2 = {}
  if (acoes !== undefined) campos.acoes = acoes
  if (meus !== undefined) campos.meus = meus
  if (reacoes !== undefined) campos.reacoes = reacoes
  if (golpes !== undefined) campos.golpes = golpes
  if (contras !== undefined) campos.contras = contras
  return campos
}

/** O recorte inteiro. A vez e a próxima, quando há, têm de ser cartas da lista. */
export function lerEstadoParaJogador(value: unknown): EstadoParaJogador | null {
  if (!isRecord(value)) return null
  const { rodada, turno, vez, proxima, minhaVez, vezForaDaVista, cartas, registro, regras } = value
  if (!inteiroAte(rodada, 1, RODADA_MAX) || !isRecord(turno)) return null
  const { n, m } = turno
  if (!inteiroAte(m, 0, CARTAS_PARA_JOGADOR_MAX) || !inteiroAte(n, 0, m)) return null
  if (!idOuNulo(vez) || !idOuNulo(proxima) || typeof minhaVez !== 'boolean' || typeof vezForaDaVista !== 'boolean') return null
  const cartasLidas = lerLista(cartas, CARTAS_PARA_JOGADOR_MAX, lerCarta)
  const linhas = lerLista(registro, REGISTRO_PARA_JOGADOR_MAX, lerLinha)
  if (cartasLidas === null || linhas === null) return null
  const ids = new Set(cartasLidas.map((carta) => carta.id))
  if ((vez !== null && !ids.has(vez)) || (proxima !== null && !ids.has(proxima))) return null
  let regrasLidas: RegrasDaBatalha | null = null
  if (regras !== null) {
    regrasLidas = lerRegrasDaBatalha(regras)
    if (regrasLidas === null) return null
  }
  const daF2 = lerCamposDaF2(value, minhaVez)
  if (daF2 === null) return null
  return { rodada, turno: { n, m }, vez, proxima, minhaVez, vezForaDaVista, cartas: cartasLidas, registro: linhas, regras: regrasLidas, ...daF2 }
}

export function parseBatalhaEstado(value: unknown): BatalhaEstadoMessage | null {
  if (!isRecord(value) || value.type !== 'batalha.estado' || !('estado' in value)) return null
  if (value.estado === null) return { type: 'batalha.estado', estado: null }
  const estado = lerEstadoParaJogador(value.estado)
  return estado === null ? null : { type: 'batalha.estado', estado }
}

/** Personagem torto sai sozinho (como no `personagens`); a lista que não é lista, ou acima do teto, recusa. */
export function parseBatalhaAliados(value: unknown): BatalhaAliadosMessage | null {
  if (!isRecord(value) || value.type !== 'batalha.aliados') return null
  if (!Array.isArray(value.personagens) || value.personagens.length > ALIADOS_MAX) return null
  const personagens = value.personagens.map(personagemDoArquivo).filter((p): p is Personagem => p !== null)
  return { type: 'batalha.aliados', personagens }
}

function lerEfeito(value: unknown): EfeitoParaJogador | null {
  if (!isRecord(value) || !inteiroAte(value.seq, 1, SEQ_MAX)) return null
  const { seq } = value
  switch (value.tipo) {
    case 'golpe': {
      const { golpeId, atacanteTokenId, nome, surpresa, overload } = value
      const alvos = lerLista(value.alvos, ALVOS_MAX, (item) => (textoAte(item, 1, ID_DA_BATALHA_MAX) ? item : null))
      if (!textoAte(golpeId, 1, ID_DA_BATALHA_MAX) || !textoAte(atacanteTokenId, 1, ID_DA_BATALHA_MAX) || !textoAte(nome, 0, NOME_DO_GOLPE_MAX)) return null
      if (alvos === null || alvos.length === 0 || typeof surpresa !== 'boolean' || typeof overload !== 'boolean') return null
      return { seq, tipo: 'golpe', golpeId, atacanteTokenId, nome, alvos, surpresa, overload }
    }
    case 'reacao': {
      const { golpeId, tokenId, d20, modificador, total } = value
      if (!idOuNulo(golpeId) || !textoAte(tokenId, 1, ID_DA_BATALHA_MAX) || !lerD20(d20) || !lerModificador(modificador) || total !== d20 + modificador) return null
      return { seq, tipo: 'reacao', golpeId, tokenId, d20, modificador, total }
    }
    case 'dano': {
      const { tokenId, valor } = value
      const saida = value.saida === 'direto' ? 'direto' : lerSaida(value.saida)
      if (!textoAte(tokenId, 1, ID_DA_BATALHA_MAX) || !inteiroAte(valor, 0, DANO_MAX) || saida === null) return null
      return { seq, tipo: 'dano', tokenId, valor, saida }
    }
    default:
      return null
  }
}

/** Os efeitos novos; o `seq` sobe estritamente (fora de ordem = forjado). */
export function parseBatalhaEfeitos(value: unknown): BatalhaEfeitosMessage | null {
  if (!isRecord(value) || value.type !== 'batalha.efeitos') return null
  const efeitos = lerLista(value.efeitos, EFEITOS_POR_MENSAGEM, lerEfeito)
  if (efeitos === null) return null
  for (let i = 1; i < efeitos.length; i += 1) {
    const atual = efeitos[i]
    const anterior = efeitos[i - 1]
    if (atual === undefined || anterior === undefined || atual.seq <= anterior.seq) return null
  }
  return { type: 'batalha.efeitos', efeitos }
}

export function parseBatalhaResultado(value: unknown): BatalhaResultadoMessage | null {
  if (!isRecord(value) || value.type !== 'batalha.resultado') return null
  const { reqId, ok } = value
  if (!textoAte(reqId, 1, REQ_ID_MAX) || typeof ok !== 'boolean') return null
  return { type: 'batalha.resultado', reqId, ok }
}
