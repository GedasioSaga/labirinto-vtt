import { ehImagemDaMesa } from '../lib/midia'
import { personagemDoArquivo, type Personagem } from '../lib/personagem'
import {
  ALVOS_MAX,
  ARMAS_NA_BATALHA_MAX,
  CARGA_MAX,
  CHAVE_DA_LEMBRADA_MAX,
  CUSTO_MAX,
  DANO_MAX,
  EFEITOS_POR_MENSAGEM,
  EVOLUIDAS_MAX,
  GOLPES_PENDENTES_MAX,
  LEMBRADAS_MAX,
  LEMBRETES_MAX,
  MODIFICADOR_DA_REACAO_MAX,
  MODS_POR_SELO_MAX,
  NATUREZAS_DO_SELO,
  NOME_DA_FORMA_MAX,
  NOME_DO_GOLPE_MAX,
  NUMERO_DA_FORMA_MAX,
  NUMEROS_DA_FORMA_MAX,
  PASSIVAS_ATIVAS_MAX,
  PERFURACAO_MAX,
  PERFURACAO_MIN,
  ROTULO_DO_NUMERO_MAX,
  SAIDAS_DA_TECNICA,
  SELOS_POR_TOKEN_MAX,
  TIPOS_DO_LEMBRETE,
  TURNOS_DO_SELO_MAX,
  type AcaoDaForma,
  type AcaoDaTecnica,
  type LembreteDaPassiva,
  type ModDoSelo,
  type NumeroDaForma,
  type PedidoDeAcao,
  type PedidoDeEvolucao,
  type PedidoDePassiva,
  type PedidoDeAlvo,
  type PedidoDeReacao,
  type RolagemDaReacao,
  type SaidaDaReacao,
  type SaidaDaTecnica,
  type SeloPedido,
} from '../lib/batalha/combate'
import { NOME_DA_EQUIPE_MAX } from '../lib/batalha/equipes'
import { lerJudgeNaCena } from '../lib/batalha/judge'
import { LIMITE_DE_ARMAS_MAX } from '../lib/batalha/leituraDaFicha'
import type { VezEsperada } from '../lib/batalha/ponte'
import { AUTOR_NO_REGISTRO_MAX, REGISTRO_PARA_JOGADOR_MAX, REGISTRO_TEXTO_MAX, type LinhaParaJogador } from '../lib/batalha/registro'
import { lerRegrasDaBatalha, type RegrasDaBatalha } from '../lib/batalha/regrasDoCampo'
import { ehAlvoDeMod, ehNomeDeSelo } from '../lib/batalha/selos'
import type { DuracaoDaExtra } from '../lib/batalha/turnos'
import {
  APARENCIAS_MAX,
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
  type SeloParaJogador,
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
 *    `batalha.armas` (as armas da batalha, quando quiser, Q8) e
 *    `batalha.zerarCarga` (zerar a concentração, a qualquer hora);
 *  - F3 (fatia T): nenhuma mensagem nova; `batalha.agir` aceita `transformar`
 *    e `destransformar`, e `atacar`/`habilidade` aceitam `selo?`;
 *  - balas: `atacar` aceita `balaId?` (só com `armaId`);
 *  - tipos de habilidade F1: `batalha.reagir` aceita `tecnica` (a técnica
 *    de reação no lugar do d20; "rolar" com `modificador`);
 *  - tipos de habilidade F2: o selo do pedido aceita `mods?` (as linhas
 *    "atributo / delta" do Buff/Debuff); a carta do recorte leva `mods` e
 *    `natureza` de cada selo.
 *  - tipos de habilidade F3: `batalha.passiva` (Ativar/Desligar, lembrete);
 *  - tipos de habilidade F4: `habilidade` e a passiva aceitam `variante?`
 *    (a opção escolhida); `batalha.evoluir` (Evoluir a técnica nesta
 *    batalha); o combate do recorte leva `evoluidas`.
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

/** "Zerar" a concentração do personagem dele, a qualquer hora (perdeu a concentração ao tomar o golpe). Não devolve a ação gasta. */
export interface BatalhaZerarCargaMessage {
  type: 'batalha.zerarCarga'
  reqId: string
  personagemId: string
}

/**
 * Tipos de habilidade F3: Ativar/Desligar uma passiva, ou responder ao
 * lembrete dela (Aplicar o "a cada turno", "Agora não"). Fora da vez, sem
 * gastar ação. Mensagem própria (não é `batalha.agir`): a passiva não é golpe.
 */
export interface BatalhaPassivaMessage {
  type: 'batalha.passiva'
  reqId: string
  pedido: PedidoDePassiva
}

/**
 * Tipos de habilidade F4: Evoluir a técnica nesta batalha. Ação livre, na vez
 * do personagem (o host confere). Mensagem própria (não é `batalha.agir`):
 * evoluir não é golpe nem gasta ação.
 */
export interface BatalhaEvoluirMessage {
  type: 'batalha.evoluir'
  reqId: string
  pedido: PedidoDeEvolucao
}

/** Os pedidos de batalha do jogador da F1 (entram na união `PlayerMessage`). */
export type BatalhaPlayerMessage = BatalhaPassarMessage | BatalhaDesfazerMessage

/**
 * F2: os pedidos novos do jogador. União à parte para o contrato compilar
 * sem mexer no `switch` do host: B a junta à `PlayerMessage` (`protocol.ts`)
 * junto com os `case` em `hostSession.ts`.
 */
export type BatalhaAcaoPlayerMessage =
  | BatalhaAgirMessage
  | BatalhaReagirMessage
  | BatalhaDanoMessage
  | BatalhaArmasMessage
  | BatalhaZerarCargaMessage
  | BatalhaPassivaMessage
  | BatalhaEvoluirMessage

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
  return value === 'critico' || value === 'cheio' || value === 'metade' || value === 'esquiva' || value === 'contra' || value === 'naoReagiu' || value === 'passou' || value === 'semReacao'
    ? value
    : null
}

/** `contraDe` ausente, ou o id do golpe. `false` = torto. */
function lerContraDe(value: unknown): string | undefined | false {
  if (value === undefined) return undefined
  return textoAte(value, 1, ID_DA_BATALHA_MAX) ? value : false
}

/** `balaId` ausente, ou o id do subcartão da bala (a mesma forma do id de cartão). `false` = torto. */
function lerBalaId(value: unknown): string | undefined | false {
  if (value === undefined) return undefined
  return textoAte(value, 1, CARTAO_ID_MAX) ? value : false
}

/** `perfuracao` ausente, ou o inteiro de 1 a 100. `false` = torto (fração, 0, acima de 100, texto). */
function lerPerfuracao(value: unknown): number | undefined | false {
  if (value === undefined) return undefined
  return inteiroAte(value, PERFURACAO_MIN, PERFURACAO_MAX) ? value : false
}

/**
 * F3: o selo do pedido (o sugerido na mira). Turnos de 1 a `TURNOS_DO_SELO_MAX`, ou `null` = até tirar.
 * Tipos de habilidade F2: `mods` opcional, até `MODS_POR_SELO_MAX` (lista vazia = sem mods). Se o alvo
 * é atributo do sistema, quem confere é a store (`seloPedidoValido`); natureza e cartaoId nunca vêm do fio.
 */
export function lerSeloPedido(value: unknown): SeloPedido | null {
  if (!isRecord(value)) return null
  const { nome, turnos } = value
  const mods = lerModsOpcionais(value.mods, 0)
  if (!ehNomeDeSelo(nome) || (turnos !== null && !inteiroAte(turnos, 1, TURNOS_DO_SELO_MAX)) || mods === false) return null
  return mods === undefined || mods.length === 0 ? { nome, turnos } : { nome, turnos, mods }
}

/** Tipos de habilidade F2: uma linha "atributo / delta". Alvo com a forma de id, delta inteiro dentro de ±`DANO_MAX`. */
function lerModDoSelo(value: unknown): ModDoSelo | null {
  if (!isRecord(value)) return null
  const { alvo, delta } = value
  return ehAlvoDeMod(alvo) && inteiroAte(delta, -DANO_MAX, DANO_MAX) ? { alvo, delta } : null
}

/** `mods` ausente, ou a lista de `minimo` a `MODS_POR_SELO_MAX` itens. `false` = torto. */
function lerModsOpcionais(value: unknown, minimo: number): ModDoSelo[] | undefined | false {
  if (value === undefined) return undefined
  const mods = lerLista(value, MODS_POR_SELO_MAX, lerModDoSelo)
  return mods === null || mods.length < minimo ? false : mods
}

/** `selo` ausente, ou o selo lido. `false` = torto. */
function lerSeloOpcional(value: unknown): SeloPedido | undefined | false {
  if (value === undefined) return undefined
  return lerSeloPedido(value) ?? false
}

/**
 * Tipos de habilidade F4: `variante` ausente, ou a chave da opção (1 a
 * `NOME_DO_GOLPE_MAX`). Se é opção da técnica, quem confere é a store
 * (`varianteDoPedido`). `false` = torto.
 */
function lerVarianteOpcional(value: unknown): string | undefined | false {
  if (value === undefined) return undefined
  return textoAte(value, 1, NOME_DO_GOLPE_MAX) ? value : false
}

function lerAcaoDaForma(value: unknown): AcaoDaForma | null {
  return value === 'simples' || value === 'completa' || value === 'bonus' ? value : null
}

/** O pedido de ação, enum fechado no `tipo`. */
export function lerPedidoDeAcao(value: unknown): PedidoDeAcao | null {
  if (!isRecord(value)) return null
  switch (value.tipo) {
    case 'atacar': {
      const { armaId, alvos, surpresa, perfurante } = value
      const contraDe = lerContraDe(value.contraDe)
      const selo = lerSeloOpcional(value.selo)
      const perfuracao = lerPerfuracao(value.perfuracao)
      const balaId = lerBalaId(value.balaId)
      const alvosLidos = lerAlvosDoPedido(alvos, 1)
      if (!cartaoOuNulo(armaId) || alvosLidos === null || typeof surpresa !== 'boolean' || typeof perfurante !== 'boolean' || contraDe === false || selo === false || perfuracao === false || balaId === false) return null
      // Bala sem arma não existe: a bala é subcartão da arma.
      if (balaId !== undefined && armaId === null) return null
      const pedido: PedidoDeAcao = { tipo: 'atacar', armaId, alvos: alvosLidos, surpresa, perfurante }
      if (perfuracao !== undefined) pedido.perfuracao = perfuracao
      if (contraDe !== undefined) pedido.contraDe = contraDe
      if (selo !== undefined) pedido.selo = selo
      if (balaId !== undefined) pedido.balaId = balaId
      return pedido
    }
    case 'habilidade': {
      const { cartaoId, armaId, alvos, surpresa, perfurante, custo, acao } = value
      const contraDe = lerContraDe(value.contraDe)
      const selo = lerSeloOpcional(value.selo)
      const perfuracao = lerPerfuracao(value.perfuracao)
      const variante = lerVarianteOpcional(value.variante)
      // Habilidade de suporte pode não ter alvo.
      const alvosLidos = lerAlvosDoPedido(alvos, 0)
      const acaoLida = acao === null ? null : lerAcaoDaTecnica(acao)
      if (!textoAte(cartaoId, 1, CARTAO_ID_MAX) || !cartaoOuNulo(armaId) || alvosLidos === null || typeof surpresa !== 'boolean' || typeof perfurante !== 'boolean') return null
      if ((custo !== null && !inteiroAte(custo, 0, CUSTO_MAX)) || (acao !== null && acaoLida === null) || contraDe === false || selo === false || perfuracao === false || variante === false) return null
      const pedido: PedidoDeAcao = { tipo: 'habilidade', cartaoId, armaId, alvos: alvosLidos, surpresa, perfurante, custo, acao: acaoLida }
      if (perfuracao !== undefined) pedido.perfuracao = perfuracao
      if (contraDe !== undefined) pedido.contraDe = contraDe
      if (selo !== undefined) pedido.selo = selo
      if (variante !== undefined) pedido.variante = variante
      return pedido
    }
    case 'concentrar':
      return { tipo: 'concentrar' }
    case 'mover': {
      const contraDe = lerContraDe(value.contraDe)
      return contraDe === undefined || contraDe === false ? null : { tipo: 'mover', contraDe }
    }
    // F3 (fatia T): Ativar e Desfazer a forma. Sempre na vez (nunca contra-ataque).
    case 'transformar': {
      const { cartaoId, trocarImagem } = value
      const acao = lerAcaoDaForma(value.acao)
      if (!textoAte(cartaoId, 1, CARTAO_ID_MAX) || acao === null || typeof trocarImagem !== 'boolean') return null
      return { tipo: 'transformar', cartaoId, acao, trocarImagem }
    }
    case 'destransformar': {
      const { cartaoId } = value
      return textoAte(cartaoId, 1, CARTAO_ID_MAX) ? { tipo: 'destransformar', cartaoId } : null
    }
    default:
      return null
  }
}

function contraDoPedido(pedido: PedidoDeAcao): string | undefined {
  return pedido.tipo === 'concentrar' || pedido.tipo === 'transformar' || pedido.tipo === 'destransformar' ? undefined : pedido.contraDe
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
    case 'passar':
      return textoAte(golpeId, 1, ID_DA_BATALHA_MAX) ? { tipo: 'passar', golpeId, tokenId } : null
    // Tipos de habilidade F1: a técnica de reação no lugar do d20.
    case 'tecnica':
      return lerReacaoComTecnica(value, golpeId, tokenId)
    default:
      return null
  }
}

function lerSaidaDaTecnica(value: unknown): SaidaDaTecnica | null {
  return SAIDAS_DA_TECNICA.find((saida) => saida === value) ?? null
}

/**
 * Tipos de habilidade F1: `{ tipo: 'tecnica', golpeId, tokenId, cartaoId,
 * saida, custo, modificador?, seloNoAtacante? }`. Saída em enum fechado,
 * custo de 0 a `CUSTO_MAX` ou `null`, modificador só com "rolar", selo pela
 * regra do selo do pedido. Nenhum dado: quem rola é o host.
 */
function lerReacaoComTecnica(value: Record<string, unknown>, golpeId: unknown, tokenId: string): PedidoDeReacao | null {
  const { cartaoId, custo, modificador } = value
  const saida = lerSaidaDaTecnica(value.saida)
  const selo = lerSeloOpcional(value.seloNoAtacante)
  if (!textoAte(golpeId, 1, ID_DA_BATALHA_MAX) || !textoAte(cartaoId, 1, CARTAO_ID_MAX) || saida === null || selo === false) return null
  if (custo !== null && !inteiroAte(custo, 0, CUSTO_MAX)) return null
  if (modificador !== undefined && (saida !== 'rolar' || !lerModificador(modificador))) return null
  return {
    tipo: 'tecnica',
    golpeId,
    tokenId,
    cartaoId,
    saida,
    custo,
    ...(modificador === undefined ? {} : { modificador }),
    ...(selo === undefined ? {} : { seloNoAtacante: selo }),
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

export function parseBatalhaZerarCarga(value: unknown): BatalhaZerarCargaMessage | null {
  if (!isRecord(value) || value.type !== 'batalha.zerarCarga') return null
  const { reqId, personagemId } = value
  if (!textoAte(reqId, 1, REQ_ID_MAX) || !textoAte(personagemId, 1, PERSONAGEM_ID_MAX)) return null
  return { type: 'batalha.zerarCarga', reqId, personagemId }
}

/**
 * Tipos de habilidade F3: o pedido da passiva, enum fechado no `tipo`. Ids no
 * teto, custo de 0 a `CUSTO_MAX` ou `null`, selo pela regra do selo do
 * pedido (natureza, cartaoId e dono o host tira da ficha, nunca do fio).
 */
export function lerPedidoDePassiva(value: unknown): PedidoDePassiva | null {
  if (!isRecord(value)) return null
  const { tokenId, cartaoId } = value
  if (!textoAte(tokenId, 1, ID_DA_BATALHA_MAX) || !textoAte(cartaoId, 1, CARTAO_ID_MAX)) return null
  switch (value.tipo) {
    case 'passiva': {
      const { ligar, custo, alvoTokenId } = value
      const selo = lerSeloOpcional(value.selo)
      const variante = lerVarianteOpcional(value.variante)
      if (typeof ligar !== 'boolean' || (custo !== null && !inteiroAte(custo, 0, CUSTO_MAX)) || selo === false || variante === false) return null
      if (alvoTokenId !== undefined && !textoAte(alvoTokenId, 1, ID_DA_BATALHA_MAX)) return null
      const pedido: PedidoDePassiva = { tipo: 'passiva', tokenId, cartaoId, ligar, custo }
      if (alvoTokenId !== undefined) pedido.alvoTokenId = alvoTokenId
      if (selo !== undefined) pedido.selo = selo
      if (variante !== undefined) pedido.variante = variante
      return pedido
    }
    case 'lembrete':
      return typeof value.aplicar === 'boolean' ? { tipo: 'lembrete', tokenId, cartaoId, aplicar: value.aplicar } : null
    default:
      return null
  }
}

export function parseBatalhaPassiva(value: unknown): BatalhaPassivaMessage | null {
  if (!isRecord(value) || value.type !== 'batalha.passiva') return null
  const { reqId } = value
  const pedido = lerPedidoDePassiva(value.pedido)
  if (!textoAte(reqId, 1, REQ_ID_MAX) || pedido === null) return null
  return { type: 'batalha.passiva', reqId, pedido }
}

/**
 * Tipos de habilidade F4: `{ tipo: 'evoluir', tokenId, cartaoId, custo }`.
 * Ids no teto, custo de 0 a `CUSTO_MAX` ou `null`. Se a técnica evolui, se é
 * a vez e se a ficha é dele, quem confere é o host e a store.
 */
export function lerPedidoDeEvolucao(value: unknown): PedidoDeEvolucao | null {
  if (!isRecord(value) || value.tipo !== 'evoluir') return null
  const { tokenId, cartaoId, custo } = value
  if (!textoAte(tokenId, 1, ID_DA_BATALHA_MAX) || !textoAte(cartaoId, 1, CARTAO_ID_MAX)) return null
  if (custo !== null && !inteiroAte(custo, 0, CUSTO_MAX)) return null
  return { tipo: 'evoluir', tokenId, cartaoId, custo }
}

export function parseBatalhaEvoluir(value: unknown): BatalhaEvoluirMessage | null {
  if (!isRecord(value) || value.type !== 'batalha.evoluir') return null
  const { reqId } = value
  const pedido = lerPedidoDeEvolucao(value.pedido)
  if (!textoAte(reqId, 1, REQ_ID_MAX) || pedido === null) return null
  return { type: 'batalha.evoluir', reqId, pedido }
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
  // F3 (fatia T): o nome da forma e os selos vão a quem vê a carta, de qualquer lado (Q5).
  if (value.forma !== undefined) {
    if (!textoAte(value.forma, 1, NOME_DA_FORMA_MAX)) return null
    carta.forma = value.forma
  }
  if (value.selos !== undefined) {
    const selos = lerLista(value.selos, SELOS_POR_TOKEN_MAX, lerSeloVisto)
    if (selos === null || selos.length === 0) return null
    carta.selos = selos
  }
  return carta
}

/**
 * F3: o selo na carta. Turnos de 0 a `TURNOS_DO_SELO_MAX` (0 = acaba no fim desta vez), ou `null` = até tirar.
 * Tipos de habilidade F2: `mods` (1 a `MODS_POR_SELO_MAX`) e `natureza` em enum fechado, os dois opcionais.
 */
function lerSeloVisto(value: unknown): SeloParaJogador | null {
  if (!isRecord(value)) return null
  const { nome, turnos, natureza } = value
  const mods = lerModsOpcionais(value.mods, 1)
  const naturezaLida = NATUREZAS_DO_SELO.find((candidata) => candidata === natureza)
  if (!ehNomeDeSelo(nome) || (turnos !== null && !inteiroAte(turnos, 0, TURNOS_DO_SELO_MAX)) || mods === false) return null
  if (natureza !== undefined && naturezaLida === undefined) return null
  const selo: SeloParaJogador = { nome, turnos }
  if (mods !== undefined) selo.mods = mods
  if (naturezaLida !== undefined) selo.natureza = naturezaLida
  return selo
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
  const combate: CombateParaJogador = { personagemId, recargas, usos, overload, carga, concentrouNestaVez, armas, limiteDeArmas }
  return comPassivasLidas(combate, value)
}

/** Tipos de habilidade F3: um lembrete de passiva. Tipo em enum fechado; ids, chave e rodada no teto. */
function lerLembrete(value: unknown): LembreteDaPassiva | null {
  if (!isRecord(value)) return null
  const { cartaoId, tokenId, chave, rodada } = value
  const tipo = TIPOS_DO_LEMBRETE.find((candidato) => candidato === value.tipo)
  if (!textoAte(cartaoId, 1, CARTAO_ID_MAX) || !textoAte(tokenId, 1, ID_DA_BATALHA_MAX) || tipo === undefined) return null
  if (!textoAte(chave, 1, CHAVE_DA_LEMBRADA_MAX) || !inteiroAte(rodada, 1, RODADA_MAX)) return null
  return { cartaoId, tokenId, tipo, chave, rodada }
}

function lerChaveLembrada(value: unknown): string | null {
  return textoAte(value, 1, CHAVE_DA_LEMBRADA_MAX) ? value : null
}

/**
 * Tipos de habilidade F3: `lembretes`, `lembradas` e `passivasAtivas`, cada um ausente ou lista no teto.
 * F4: `evoluidas` também. Torto = `null` (derruba o combate).
 */
function comPassivasLidas(combate: CombateParaJogador, value: Record<string, unknown>): CombateParaJogador | null {
  const lembretes = value.lembretes === undefined ? undefined : lerLista(value.lembretes, LEMBRETES_MAX, lerLembrete)
  const lembradas = value.lembradas === undefined ? undefined : lerLista(value.lembradas, LEMBRADAS_MAX, lerChaveLembrada)
  const ativas = value.passivasAtivas === undefined ? undefined : lerLista(value.passivasAtivas, PASSIVAS_ATIVAS_MAX, lerCartaoId)
  const evoluidas = value.evoluidas === undefined ? undefined : lerLista(value.evoluidas, EVOLUIDAS_MAX, lerCartaoId)
  if (lembretes === null || lembradas === null || ativas === null || evoluidas === null) return null
  if (lembretes !== undefined) combate.lembretes = lembretes
  if (lembradas !== undefined) combate.lembradas = lembradas
  if (ativas !== undefined) combate.passivasAtivas = ativas
  if (evoluidas !== undefined) combate.evoluidas = evoluidas
  return combate
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
  const { golpeId, tokenId, atacante, nome, dano, perfurante, perfuracao, rolagem } = value
  if (!textoAte(golpeId, 1, ID_DA_BATALHA_MAX) || !textoAte(tokenId, 1, ID_DA_BATALHA_MAX) || !textoAte(atacante, 1, NOME_NA_CARTA_MAX)) return null
  if (!textoAte(nome, 0, NOME_DO_GOLPE_MAX) || (dano !== null && !inteiroAte(dano, 0, DANO_MAX))) return null
  const reacao: ReacaoParaJogador = { golpeId, tokenId, atacante, nome, dano }
  if (perfurante !== undefined) {
    if (perfurante !== true) return null
    reacao.perfurante = true
  }
  // A porcentagem só anda com o Perfurante (sem ele não há o que perfurar).
  if (perfuracao !== undefined) {
    if (reacao.perfurante !== true || !inteiroAte(perfuracao, PERFURACAO_MIN, PERFURACAO_MAX)) return null
    reacao.perfuracao = perfuracao
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
  // F3 (fatia J): o Judge, só `{ x, y }` finitos no teto; torto recusa o estado.
  const judge = opcional(value.judge, lerJudgeNaCena)
  if (judge === null) return null
  // F3 (fatia T): as imagens de forma, só de fichas com carta na lista.
  const aparencias = opcional(value.aparencias, (item) => lerAparencias(item, new Set(cartasLidas.map((carta) => carta.tokenId))))
  if (aparencias === null) return null
  const estado: EstadoParaJogador = { rodada, turno: { n, m }, vez, proxima, minhaVez, vezForaDaVista, cartas: cartasLidas, registro: linhas, regras: regrasLidas, ...daF2 }
  if (judge !== undefined) estado.judge = judge
  if (aparencias !== undefined) estado.aparencias = aparencias
  return estado
}

/** F3: tokenId → imagem da forma (referência de mídia ou a embutida). Token sem carta na lista = forjado; vazio também. */
function lerAparencias(value: unknown, tokensDasCartas: ReadonlySet<string>): Record<string, string> | null {
  if (!isRecord(value)) return null
  const entradas = Object.entries(value)
  if (entradas.length === 0 || entradas.length > APARENCIAS_MAX) return null
  const lidas: Record<string, string> = {}
  for (const [tokenId, imagem] of entradas) {
    if (!textoAte(tokenId, 1, ID_DA_BATALHA_MAX) || !tokensDasCartas.has(tokenId) || !ehImagemDaMesa(imagem)) return null
    lidas[tokenId] = imagem
  }
  return lidas
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
    case 'judge':
      // F3 (fatia J): um gesto só por enquanto; outro valor é forjado.
      return value.gesto === 'carta' ? { seq, tipo: 'judge', gesto: 'carta' } : null
    // F3 (fatia T): a forma ligou (números só a dono e aliado: quem monta é o host), desfez, selo acabou.
    case 'transformacao': {
      const { tokenId, forma, imagem } = value
      if (!textoAte(tokenId, 1, ID_DA_BATALHA_MAX) || !textoAte(forma, 0, NOME_DA_FORMA_MAX) || (imagem !== null && !ehImagemDaMesa(imagem))) return null
      const efeito: EfeitoParaJogador = { seq, tipo: 'transformacao', tokenId, forma, imagem }
      if (value.numeros !== undefined) {
        const numeros = lerLista(value.numeros, NUMEROS_DA_FORMA_MAX, lerNumeroDaForma)
        if (numeros === null || numeros.length === 0) return null
        efeito.numeros = numeros
      }
      return efeito
    }
    case 'forma': {
      const { tokenId, forma } = value
      if (!textoAte(tokenId, 1, ID_DA_BATALHA_MAX) || !textoAte(forma, 0, NOME_DA_FORMA_MAX) || value.ligou !== false) return null
      return { seq, tipo: 'forma', tokenId, forma, ligou: false }
    }
    case 'selo': {
      const { tokenId, nome } = value
      if (!textoAte(tokenId, 1, ID_DA_BATALHA_MAX) || !ehNomeDeSelo(nome) || value.acabou !== true) return null
      return { seq, tipo: 'selo', tokenId, nome, acabou: true }
    }
    default:
      return null
  }
}

/** F3: uma linha da prévia da forma ("FOR 160 → 220"). */
function lerNumeroDaForma(value: unknown): NumeroDaForma | null {
  if (!isRecord(value)) return null
  const { rotulo, de, para, nota } = value
  if (!textoAte(rotulo, 0, ROTULO_DO_NUMERO_MAX) || !inteiroAte(de, -NUMERO_DA_FORMA_MAX, NUMERO_DA_FORMA_MAX) || !inteiroAte(para, -NUMERO_DA_FORMA_MAX, NUMERO_DA_FORMA_MAX)) return null
  const numero: NumeroDaForma = { rotulo, de, para }
  if (nota !== undefined) {
    if (!textoAte(nota, 0, ROTULO_DO_NUMERO_MAX)) return null
    numero.nota = nota
  }
  return numero
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
