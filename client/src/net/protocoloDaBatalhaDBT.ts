import { lerJudgeNaCena } from '../lib/batalha/judge'
import { personagemDoArquivo, type Personagem } from '../lib/personagem'
import {
  APOSTA_DO_CHOQUE_MAX,
  BASICOS_ANUNCIADOS_MAX,
  BASICOS_ANUNCIADOS_MIN,
  CARGAS_KI_MAX,
  DETALHES_MAX,
  EFEITOS_DBT_GUARDADOS,
  KI_OCULTO_MAX,
  REGISTRO_DBT_JOGADOR_MAX,
  TEXTO_DBT_MAX,
  ALVOS_MAX,
  type EfeitoDBT,
  type ExtrasDaAcao,
  type Faixa,
  type IdDaCondicao,
  type NivelDeVoo,
  type OpcaoDaPendencia,
  type OpcaoDeAcao,
  type SituacaoDeMorte,
  type TipoDaLinhaDBT,
  type TipoDaPendencia,
} from '../lib/dbt/batalha/tipos'
import {
  ACOES_DBT_MAX,
  CARTAS_DBT_MAX,
  CHAVE_DBT_MAX,
  CONDICOES_DBT_MAX,
  FORMAS_DBT_MAX,
  ID_DBT_MAX,
  MEUS_DBT_MAX,
  NOME_DBT_MAX,
  NUMERO_DBT_MAX,
  OPCOES_DBT_MAX,
  PENDENCIAS_DBT_MAX,
  ROTULO_DBT_MAX,
  type CartaDBT,
  type CondicaoNaVistaDBT,
  type DeclaracaoDBT,
  type JanelaDBTParaJogador,
  type LadoNaVistaDBT,
  type LinhaDBTParaJogador,
  type MeuCombatenteDBT,
  type PendenciaDBTParaJogador,
  type RecursoNaVistaDBT,
  type VistaDBT,
} from '../lib/dbt/batalha/vista'

/**
 * BATALHA DRAGON BALL TALES — o fio (docs/planos/dbt-batalha.md, seção 17).
 * Prefixo próprio (`batalhaDBT.*`): o leitor estrito do One Piece
 * (`protocoloDaBatalha.ts`) derrubaria o estado DBT, e o DBT não importa nada
 * de lá.
 *
 * Do jogador para o host — só a CHAVE da opção que a vista mostrou e os
 * alvos; nunca d20, total, dano nem CA (o host rola). Campo a mais (um d20
 * forjado) é ignorado: o leitor monta a mensagem só com os campos conhecidos.
 *  - `batalhaDBT.declarar`: "transformar antes?" da fase de iniciativa (5.1);
 *  - `batalhaDBT.agir`: uma ação do turno, na vez dele;
 *  - `batalhaDBT.responder`: resposta a uma pendência (reação, teste,
 *    salvaguarda, aposta do Choque...);
 *  - `batalhaDBT.passar`: "Passar a vez";
 *  - `batalhaDBT.desfazer`: Desfazer a última linha dele (sem d20).
 *
 * Do host para o jogador:
 *  - `batalhaDBT.estado`: o recorte (`vistaParaJogadorDBT`), só quando muda;
 *    `null` uma vez ao sair;
 *  - `batalhaDBT.aliados`: os personagens dos aliados de equipe que estão na
 *    ordem (o perfil só leitura da carta), pelo `paraOFio`: sem dado de mestre
 *    nem o bloco de NPC da ficha;
 *  - `batalhaDBT.resultado`: a resposta a cada pedido, pelo `reqId`;
 *  - `batalhaDBT.efeitos`: as animações novas que a tela dele pode tocar.
 *
 * Entrada é hostil dos dois lados: campo torto derruba a mensagem inteira. O
 * host já corta nomes, textos e listas no teto (`vista.ts`), então acima do
 * teto aqui é mensagem forjada. Não importa `protocol.ts` (que importa daqui).
 */

/** Mesmo teto de `REQ_ID_MAX_LENGTH` (protocol.ts). */
const REQ_ID_MAX = 64
/** Ids de token, linha e pendência no pedido (o mesmo teto do One Piece). */
export const ID_NO_PEDIDO_DBT_MAX = 80
export const RODADA_DBT_MAX = 100_000
/** Teto de pedidos por jogador na janela: os mesmos números do One Piece, contados à parte. */
export const PEDIDOS_DBT_POR_JANELA = 20
export const JANELA_DOS_PEDIDOS_DBT_MS = 5_000
export const MOTIVO_DBT_MAX = 120
const NIVEL_DE_VOO_MAX = 3
/** Personagens num `batalhaDBT.aliados`: uma mesa não chega perto (o mesmo número do One Piece, contado à parte). */
export const ALIADOS_DBT_MAX = 64
/** Id de personagem: o mesmo teto de `PERSONAGEM_ID_MAX` (protocoloDoPersonagem.ts). */
const PERSONAGEM_ID_DBT_MAX = 128
/** Os campos só do mestre que o `paraOFio` tira: no fio, são mensagem forjada. */
const CAMPOS_DO_MESTRE = ['dono', 'combate', 'soCenario', 'nomeDoJogador', 'notaDoMestre'] as const

// ---- tipos ----

export interface BatalhaDBTDeclararMessage {
  type: 'batalhaDBT.declarar'
  reqId: string
  combatenteId: string
  transformacaoId: string | null
}

export interface BatalhaDBTAgirMessage {
  type: 'batalhaDBT.agir'
  reqId: string
  combatenteId: string
  vez: { rodada: number; turno: number }
  opcao: string
  alvos: string[]
  extras?: ExtrasDaAcao
}

export interface BatalhaDBTResponderMessage {
  type: 'batalhaDBT.responder'
  reqId: string
  pendenciaId: string
  combatenteId: string
  opcao: string
  aposta?: number
  atributo?: 'des' | 'for'
}

export interface BatalhaDBTPassarMessage {
  type: 'batalhaDBT.passar'
  reqId: string
  vez: { combatenteId: string; rodada: number; turno: number }
}

export interface BatalhaDBTDesfazerMessage {
  type: 'batalhaDBT.desfazer'
  reqId: string
  linhaId: string
}

/** Os pedidos de batalha DBT do jogador (entram na união `PlayerMessage`). */
export type BatalhaDBTPlayerMessage =
  | BatalhaDBTDeclararMessage
  | BatalhaDBTAgirMessage
  | BatalhaDBTResponderMessage
  | BatalhaDBTPassarMessage
  | BatalhaDBTDesfazerMessage

export interface BatalhaDBTEstadoMessage {
  type: 'batalhaDBT.estado'
  estado: VistaDBT | null
}

export interface BatalhaDBTResultadoMessage {
  type: 'batalhaDBT.resultado'
  reqId: string
  ok: boolean
  motivo?: string
}

/** Até `EFEITOS_DBT_GUARDADOS`, `seq` crescente. */
export interface BatalhaDBTEfeitosMessage {
  type: 'batalhaDBT.efeitos'
  efeitos: EfeitoDBT[]
}

/** Até `ALIADOS_DBT_MAX` personagens de jogador, sem id repetido. Lista vazia = nenhum aliado na ordem. */
export interface BatalhaDBTAliadosMessage {
  type: 'batalhaDBT.aliados'
  personagens: Personagem[]
}

/** As mensagens de batalha DBT do host (entram na união `HostMessage`). */
export type BatalhaDBTHostMessage = BatalhaDBTEstadoMessage | BatalhaDBTResultadoMessage | BatalhaDBTEfeitosMessage | BatalhaDBTAliadosMessage

// ---- leitores genéricos ----

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function textoAte(value: unknown, minimo: number, maximo: number): value is string {
  return typeof value === 'string' && value.length >= minimo && value.length <= maximo
}

function inteiroAte(value: unknown, minimo: number, maximo: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimo && value <= maximo
}

/** Número da ficha (PV, Ki, CA, dano): finito e dentro do teto; a ficha pode ter fração. */
function numeroDaFicha(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= NUMERO_DBT_MAX
}

function idDoPedido(value: unknown): value is string {
  return textoAte(value, 1, ID_NO_PEDIDO_DBT_MAX)
}

function idDoFio(value: unknown): value is string {
  return textoAte(value, 1, ID_DBT_MAX)
}

function umDe<T extends string>(conjunto: Readonly<Record<T, true>>, value: unknown): value is T {
  return typeof value === 'string' && Object.hasOwn(conjunto, value)
}

/** Lista até o teto; um item torto derruba a lista inteira. */
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

function ehNivelDeVoo(value: unknown): value is NivelDeVoo {
  return inteiroAte(value, 0, NIVEL_DE_VOO_MAX)
}

// Records completos: o compilador acusa o tipo novo que o fio ainda não conhece.
const CONDICOES: Readonly<Record<IdDaCondicao, true>> = {
  atordoado: true,
  desnorteado: true,
  quebrado: true,
  enraizado: true,
  envenenado: true,
  sangrando: true,
  silenciado: true,
  sobrecarregado: true,
  'quebra-de-guarda': true,
  caido: true,
  desequilibrado: true,
  exposto: true,
  paralisado: true,
  intimidado: true,
  cego: true,
  'lacuna-mental': true,
  instavel: true,
  'confusao-mental': true,
  'controle-mental': true,
  'alucinacao-sensorial': true,
  personalizada: true,
}
const TIPOS_DE_PENDENCIA: Readonly<Record<TipoDaPendencia, true>> = {
  declaracao: true,
  confirmar: true,
  reacao: true,
  teste: true,
  salvaguarda: true,
  choque: true,
  apoioAoChoque: true,
  acaoGratuita: true,
  inicioDoTurno: true,
  queda: true,
  ataqueForcado: true,
}
const TIPOS_DE_LINHA: Readonly<Record<TipoDaLinhaDBT, true>> = {
  inicio: true,
  iniciativa: true,
  vez: true,
  acao: true,
  tecnica: true,
  reacao: true,
  dano: true,
  cura: true,
  condicao: true,
  teste: true,
  transformacao: true,
  movimento: true,
  voo: true,
  choque: true,
  morte: true,
  ficha: true,
  mestre: true,
}
const FAIXAS: Readonly<Record<Faixa, true>> = { erro: true, minimo: true, medio: true, completo: true }
const SITUACOES: Readonly<Record<SituacaoDeMorte, true>> = { 'de-pe': true, salvaguarda: true, inconsciente: true, morto: true }
const LADOS: Readonly<Record<LadoNaVistaDBT, true>> = { eu: true, aliado: true, outro: true }
const ALVOS_DA_ACAO: Readonly<Record<OpcaoDeAcao['alvo'], true>> = { nenhum: true, inimigo: true, aliado: true, qualquer: true }
const TIPOS_DE_EFEITO: Readonly<Record<EfeitoDBT['tipo'], true>> = { rolagem: true, dano: true, cura: true, condicao: true, transformacao: true }
const FASES: Readonly<Record<VistaDBT['fase'], true>> = { iniciativa: true, combate: true }
const MODOS: Readonly<Record<VistaDBT['modo'], true>> = { automatico: true, manual: true }

// ---- jogador → host ----

function cabecalho(value: unknown, tipo: BatalhaDBTPlayerMessage['type']): (Record<string, unknown> & { reqId: string }) | null {
  if (!isRecord(value) || value.type !== tipo || !textoAte(value.reqId, 1, REQ_ID_MAX)) return null
  return { ...value, reqId: value.reqId }
}

export function parseBatalhaDBTDeclarar(value: unknown): BatalhaDBTDeclararMessage | null {
  const msg = cabecalho(value, 'batalhaDBT.declarar')
  if (msg === null) return null
  const { reqId, combatenteId, transformacaoId } = msg
  if (!idDoPedido(combatenteId) || !(transformacaoId === null || idDoFio(transformacaoId))) return null
  return { type: 'batalhaDBT.declarar', reqId, combatenteId, transformacaoId }
}

/** Os extras da ação: só os campos conhecidos, cada um no intervalo da regra (seção 17). */
function lerExtras(value: unknown): ExtrasDaAcao | null {
  if (!isRecord(value)) return null
  const extras: ExtrasDaAcao = {}
  const { modo, cargasKi, basicos, nivelDeVoo, textoOculto, kiOculto } = value
  if (modo !== undefined) {
    if (modo !== 'dano' && modo !== 'agarrar') return null
    extras.modo = modo
  }
  if (cargasKi !== undefined) {
    if (!inteiroAte(cargasKi, 0, CARGAS_KI_MAX)) return null
    extras.cargasKi = cargasKi
  }
  if (basicos !== undefined) {
    if (!inteiroAte(basicos, BASICOS_ANUNCIADOS_MIN, BASICOS_ANUNCIADOS_MAX)) return null
    extras.basicos = basicos
  }
  if (nivelDeVoo !== undefined) {
    if (!ehNivelDeVoo(nivelDeVoo)) return null
    extras.nivelDeVoo = nivelDeVoo
  }
  if (textoOculto !== undefined) {
    if (!textoAte(textoOculto, 0, TEXTO_DBT_MAX)) return null
    extras.textoOculto = textoOculto
  }
  if (kiOculto !== undefined) {
    if (!inteiroAte(kiOculto, 0, KI_OCULTO_MAX)) return null
    extras.kiOculto = kiOculto
  }
  return extras
}

export function parseBatalhaDBTAgir(value: unknown): BatalhaDBTAgirMessage | null {
  const msg = cabecalho(value, 'batalhaDBT.agir')
  if (msg === null) return null
  const { reqId, combatenteId, vez, opcao, alvos } = msg
  if (!idDoPedido(combatenteId) || !textoAte(opcao, 1, CHAVE_DBT_MAX) || !isRecord(vez)) return null
  const { rodada, turno } = vez
  if (!inteiroAte(rodada, 1, RODADA_DBT_MAX) || !inteiroAte(turno, 0, RODADA_DBT_MAX)) return null
  const lidos = lerLista(alvos, ALVOS_MAX, (alvo) => (idDoPedido(alvo) ? alvo : null))
  if (lidos === null || new Set(lidos).size !== lidos.length) return null
  const saida: BatalhaDBTAgirMessage = { type: 'batalhaDBT.agir', reqId, combatenteId, vez: { rodada, turno }, opcao, alvos: lidos }
  if (msg.extras !== undefined) {
    const extras = lerExtras(msg.extras)
    if (extras === null) return null
    saida.extras = extras
  }
  return saida
}

export function parseBatalhaDBTResponder(value: unknown): BatalhaDBTResponderMessage | null {
  const msg = cabecalho(value, 'batalhaDBT.responder')
  if (msg === null) return null
  const { reqId, pendenciaId, combatenteId, opcao, aposta, atributo } = msg
  if (!idDoPedido(pendenciaId) || !idDoPedido(combatenteId) || !textoAte(opcao, 1, CHAVE_DBT_MAX)) return null
  const saida: BatalhaDBTResponderMessage = { type: 'batalhaDBT.responder', reqId, pendenciaId, combatenteId, opcao }
  if (aposta !== undefined) {
    if (!inteiroAte(aposta, 0, APOSTA_DO_CHOQUE_MAX)) return null
    saida.aposta = aposta
  }
  if (atributo !== undefined) {
    if (atributo !== 'des' && atributo !== 'for') return null
    saida.atributo = atributo
  }
  return saida
}

export function parseBatalhaDBTPassar(value: unknown): BatalhaDBTPassarMessage | null {
  const msg = cabecalho(value, 'batalhaDBT.passar')
  if (msg === null || !isRecord(msg.vez)) return null
  const { combatenteId, rodada, turno } = msg.vez
  if (!idDoPedido(combatenteId) || !inteiroAte(rodada, 1, RODADA_DBT_MAX) || !inteiroAte(turno, 0, RODADA_DBT_MAX)) return null
  return { type: 'batalhaDBT.passar', reqId: msg.reqId, vez: { combatenteId, rodada, turno } }
}

export function parseBatalhaDBTDesfazer(value: unknown): BatalhaDBTDesfazerMessage | null {
  const msg = cabecalho(value, 'batalhaDBT.desfazer')
  if (msg === null || !idDoPedido(msg.linhaId)) return null
  return { type: 'batalhaDBT.desfazer', reqId: msg.reqId, linhaId: msg.linhaId }
}

/** Despacho do `protocol.ts` (e do jogador, antes de mandar: pedido torto não sai). */
export function parseBatalhaDBTPlayerMessage(value: unknown): BatalhaDBTPlayerMessage | null {
  if (!isRecord(value)) return null
  switch (value.type) {
    case 'batalhaDBT.declarar':
      return parseBatalhaDBTDeclarar(value)
    case 'batalhaDBT.agir':
      return parseBatalhaDBTAgir(value)
    case 'batalhaDBT.responder':
      return parseBatalhaDBTResponder(value)
    case 'batalhaDBT.passar':
      return parseBatalhaDBTPassar(value)
    case 'batalhaDBT.desfazer':
      return parseBatalhaDBTDesfazer(value)
    default:
      return null
  }
}

// ---- host → jogador: o recorte ----

function lerRecurso(value: unknown): RecursoNaVistaDBT | null {
  if (!isRecord(value) || !numeroDaFicha(value.atual) || !numeroDaFicha(value.max)) return null
  return { atual: value.atual, max: value.max }
}

/** `null` vale; ausente ou torto, não. */
function lerRecursoOuNulo(value: unknown): RecursoNaVistaDBT | null | undefined {
  return value === null ? null : (lerRecurso(value) ?? undefined)
}

function lerCondicao(value: unknown): CondicaoNaVistaDBT | null {
  if (!isRecord(value) || !idDoFio(value.id) || !umDe(CONDICOES, value.condicao) || !textoAte(value.nome, 0, NOME_DBT_MAX)) return null
  return { id: value.id, condicao: value.condicao, nome: value.nome }
}

function lerCarta(value: unknown): CartaDBT | null {
  if (!isRecord(value)) return null
  const { tokenId, nome, lado, iniciativa, transformacao, voo, situacao, agarrado, agarradoPor } = value
  if (!idDoFio(tokenId) || !textoAte(nome, 0, NOME_DBT_MAX) || !umDe(LADOS, lado)) return null
  if (!(iniciativa === null || numeroDaFicha(iniciativa)) || !(transformacao === null || textoAte(transformacao, 0, NOME_DBT_MAX))) return null
  if (!ehNivelDeVoo(voo) || !umDe(SITUACOES, situacao) || typeof agarrado !== 'boolean' || !(agarradoPor === null || idDoFio(agarradoPor))) return null
  const pv = lerRecursoOuNulo(value.pv)
  const pk = lerRecursoOuNulo(value.pk)
  const condicoes = lerLista(value.condicoes, CONDICOES_DBT_MAX, lerCondicao)
  if (pv === undefined || pk === undefined || condicoes === null) return null
  // Vida de quem não é "eu" nem "aliado" no fio é forjada.
  if (lado === 'outro' && (pv !== null || pk !== null)) return null
  const carta: CartaDBT = { tokenId, nome, lado, iniciativa, pv, pk, condicoes, transformacao, voo, situacao, agarrado, agarradoPor }
  // Opcionais: ausente fica de fora; presente e torto derruba a carta.
  const { mesmoLado, personagemId } = value
  if (mesmoLado !== undefined) {
    if (typeof mesmoLado !== 'boolean') return null
    carta.mesmoLado = mesmoLado
  }
  if (personagemId !== undefined) {
    // O personagem do "outro" (inimigo, NPC) nunca sai do host: no fio é forjado.
    if (!idDoFio(personagemId) || lado === 'outro') return null
    carta.personagemId = personagemId
  }
  return carta
}

function lerOpcaoDeAcao(value: unknown): OpcaoDeAcao | null {
  if (!isRecord(value)) return null
  const { chave, rotulo, ki, gratis, bloqueio, alvo, alvosMax, tecnicaId } = value
  if (!textoAte(chave, 1, CHAVE_DBT_MAX) || !textoAte(rotulo, 0, ROTULO_DBT_MAX) || !numeroDaFicha(ki) || typeof gratis !== 'boolean') return null
  if (!(bloqueio === null || textoAte(bloqueio, 0, ROTULO_DBT_MAX)) || !umDe(ALVOS_DA_ACAO, alvo) || !inteiroAte(alvosMax, 0, ALVOS_MAX)) return null
  if (!(tecnicaId === null || idDoFio(tecnicaId))) return null
  return { chave, rotulo, ki, gratis, bloqueio, alvo, alvosMax, tecnicaId }
}

function lerOpcaoDaPendencia(value: unknown): OpcaoDaPendencia | null {
  if (!isRecord(value)) return null
  const { chave, rotulo, ki, gratis, bloqueio, pede } = value
  if (!textoAte(chave, 1, CHAVE_DBT_MAX) || !textoAte(rotulo, 0, ROTULO_DBT_MAX) || !numeroDaFicha(ki) || typeof gratis !== 'boolean') return null
  if (!(bloqueio === null || textoAte(bloqueio, 0, ROTULO_DBT_MAX)) || !(pede === null || pede === 'aposta' || pede === 'atributo')) return null
  return { chave, rotulo, ki, gratis, bloqueio, pede }
}

function lerVez(value: unknown): { rodada: number; turno: number } | null | undefined {
  if (value === null) return null
  if (!isRecord(value) || !inteiroAte(value.rodada, 0, RODADA_DBT_MAX) || !inteiroAte(value.turno, 0, RODADA_DBT_MAX)) return undefined
  return { rodada: value.rodada, turno: value.turno }
}

function lerMeu(value: unknown): MeuCombatenteDBT | null {
  if (!isRecord(value)) return null
  const { tokenId, personagemId, nome, epBase, epTotal, ca, deslocamento, voo, transformacao } = value
  if (!idDoFio(tokenId) || !idDoFio(personagemId) || !textoAte(nome, 0, NOME_DBT_MAX)) return null
  if (!numeroDaFicha(epBase) || !numeroDaFicha(epTotal) || !numeroDaFicha(ca) || !ehNivelDeVoo(voo) || !isRecord(deslocamento)) return null
  if (!inteiroAte(deslocamento.casas, 0, NUMERO_DBT_MAX) || !inteiroAte(deslocamento.andou, 0, NUMERO_DBT_MAX)) return null
  let forma: MeuCombatenteDBT['transformacao'] = null
  if (transformacao !== null) {
    if (!isRecord(transformacao) || !idDoFio(transformacao.id) || !textoAte(transformacao.nome, 0, NOME_DBT_MAX) || !numeroDaFicha(transformacao.estagio)) return null
    forma = { id: transformacao.id, nome: transformacao.nome, estagio: transformacao.estagio }
  }
  const pv = lerRecurso(value.pv)
  const pk = lerRecurso(value.pk)
  const vez = lerVez(value.vez)
  const acoes = lerLista(value.acoes, ACOES_DBT_MAX, lerOpcaoDeAcao)
  if (pv === null || pk === null || vez === undefined || acoes === null) return null
  return { tokenId, personagemId, nome, pv, pk, epBase, epTotal, ca, deslocamento: { casas: deslocamento.casas, andou: deslocamento.andou }, voo, transformacao: forma, vez, acoes }
}

function lerForma(value: unknown): DeclaracaoDBT['formas'][number] | null {
  if (!isRecord(value) || !idDoFio(value.id) || !textoAte(value.nome, 0, NOME_DBT_MAX) || !numeroDaFicha(value.estagio) || !numeroDaFicha(value.ki)) return null
  return { id: value.id, nome: value.nome, estagio: value.estagio, ki: value.ki }
}

function lerDeclaracao(value: unknown): DeclaracaoDBT | null {
  if (!isRecord(value) || !idDoFio(value.combatenteId)) return null
  const formas = lerLista(value.formas, FORMAS_DBT_MAX, lerForma)
  return formas === null ? null : { combatenteId: value.combatenteId, formas }
}

function lerPendencia(value: unknown): PendenciaDBTParaJogador | null {
  if (!isRecord(value)) return null
  const { id, tipo, combatenteId, ativa, texto } = value
  if (!idDoFio(id) || !umDe(TIPOS_DE_PENDENCIA, tipo) || !idDoFio(combatenteId) || typeof ativa !== 'boolean' || !textoAte(texto, 0, TEXTO_DBT_MAX)) return null
  const opcoes = lerLista(value.opcoes, OPCOES_DBT_MAX, lerOpcaoDaPendencia)
  return opcoes === null ? null : { id, tipo, combatenteId, ativa, texto, opcoes }
}

function lerJanela(value: unknown): JanelaDBTParaJogador | null | undefined {
  if (value === null) return null
  if (!isRecord(value)) return undefined
  const { pendenciaId, atacanteId, atacante, alvoId, alvo, tecnica, faixa, critico, danoPrevisto } = value
  if (!idDoFio(pendenciaId) || !(atacanteId === null || idDoFio(atacanteId)) || !textoAte(atacante, 0, NOME_DBT_MAX)) return undefined
  if (!(alvoId === null || idDoFio(alvoId)) || !textoAte(alvo, 0, NOME_DBT_MAX) || !textoAte(tecnica, 0, NOME_DBT_MAX)) return undefined
  if (!umDe(FAIXAS, faixa) || typeof critico !== 'boolean' || !(danoPrevisto === null || numeroDaFicha(danoPrevisto))) return undefined
  return { pendenciaId, atacanteId, atacante, alvoId, alvo, tecnica, faixa, critico, danoPrevisto }
}

function lerLinha(value: unknown): LinhaDBTParaJogador | null {
  if (!isRecord(value)) return null
  const { id, rodada, tipo, autor, texto, desfeita, podeDesfazer } = value
  if (!idDoFio(id) || !inteiroAte(rodada, 0, RODADA_DBT_MAX) || !umDe(TIPOS_DE_LINHA, tipo) || !textoAte(autor, 0, NOME_DBT_MAX) || !textoAte(texto, 0, TEXTO_DBT_MAX)) return null
  if (typeof desfeita !== 'boolean' || typeof podeDesfazer !== 'boolean') return null
  const detalhes = lerLista(value.detalhes, DETALHES_MAX, (detalhe) => (textoAte(detalhe, 0, TEXTO_DBT_MAX) ? detalhe : null))
  return detalhes === null ? null : { id, rodada, tipo, autor, texto, detalhes, desfeita, podeDesfazer }
}

/** "Turno N de M", mais os opcionais: ausente fica de fora; presente e torto derruba o recorte. */
function lerTurno(value: Record<string, unknown>): VistaDBT['turno'] | null {
  const { n, m, basicosUsados, ateMinhaVez } = value
  if (!inteiroAte(n, 0, RODADA_DBT_MAX) || !inteiroAte(m, 0, RODADA_DBT_MAX)) return null
  const turno: VistaDBT['turno'] = { n, m }
  if (basicosUsados !== undefined) {
    if (!inteiroAte(basicosUsados, 0, RODADA_DBT_MAX)) return null
    turno.basicosUsados = basicosUsados
  }
  if (ateMinhaVez !== undefined) {
    // 1 = o próximo; nunca passa do tamanho da ordem.
    if (!(ateMinhaVez === null || inteiroAte(ateMinhaVez, 1, m))) return null
    turno.ateMinhaVez = ateMinhaVez
  }
  return turno
}

/** O recorte inteiro; um campo torto derruba tudo (a faixa de antes fica até o próximo). */
export function lerVistaDBT(value: unknown): VistaDBT | null {
  if (!isRecord(value)) return null
  const { fase, rodada, modo, vez, minhaVez, turno, aguardando } = value
  if (!umDe(FASES, fase) || !inteiroAte(rodada, 0, RODADA_DBT_MAX) || !umDe(MODOS, modo) || !(vez === null || idDoFio(vez)) || typeof minhaVez !== 'boolean') return null
  if (!isRecord(turno)) return null
  if (!(aguardando === null || textoAte(aguardando, 0, TEXTO_DBT_MAX))) return null
  const cartas = lerLista(value.cartas, CARTAS_DBT_MAX, lerCarta)
  const meus = lerLista(value.meus, MEUS_DBT_MAX, lerMeu)
  const declaracoes = lerLista(value.declaracoes, MEUS_DBT_MAX, lerDeclaracao)
  const pendencias = lerLista(value.pendencias, PENDENCIAS_DBT_MAX, lerPendencia)
  const janela = lerJanela(value.janela)
  const registro = lerLista(value.registro, REGISTRO_DBT_JOGADOR_MAX, lerLinha)
  if (cartas === null || meus === null || declaracoes === null || pendencias === null || janela === undefined || registro === null) return null
  const turnoLido = lerTurno(turno)
  if (turnoLido === null) return null
  const vista: VistaDBT = { fase, rodada, modo, vez, minhaVez, turno: turnoLido, cartas, meus, declaracoes, pendencias, janela, aguardando, registro }
  if (value.judge !== undefined) {
    const judge = lerJudgeNaCena(value.judge)
    if (judge === null) return null
    vista.judge = judge
  }
  return vista
}

export function parseBatalhaDBTEstado(value: unknown): BatalhaDBTEstadoMessage | null {
  if (!isRecord(value) || value.type !== 'batalhaDBT.estado' || !('estado' in value)) return null
  if (value.estado === null) return { type: 'batalhaDBT.estado', estado: null }
  const estado = lerVistaDBT(value.estado)
  return estado === null ? null : { type: 'batalhaDBT.estado', estado }
}

export function parseBatalhaDBTResultado(value: unknown): BatalhaDBTResultadoMessage | null {
  if (!isRecord(value) || value.type !== 'batalhaDBT.resultado') return null
  const { reqId, ok, motivo } = value
  if (!textoAte(reqId, 1, REQ_ID_MAX) || typeof ok !== 'boolean') return null
  if (motivo === undefined) return { type: 'batalhaDBT.resultado', reqId, ok }
  return textoAte(motivo, 0, MOTIVO_DBT_MAX) ? { type: 'batalhaDBT.resultado', reqId, ok, motivo } : null
}

function lerEfeito(value: unknown): EfeitoDBT | null {
  if (!isRecord(value)) return null
  const { seq, tipo, d20, faixa, numero } = value
  if (!inteiroAte(seq, 1, Number.MAX_SAFE_INTEGER) || !umDe(TIPOS_DE_EFEITO, tipo)) return null
  if (!(d20 === null || inteiroAte(d20, 1, 20)) || !(faixa === null || umDe(FAIXAS, faixa)) || !(numero === null || numeroDaFicha(numero))) return null
  const tokenIds = lerLista(value.tokenIds, ALVOS_MAX + 1, (id) => (idDoFio(id) ? id : null))
  if (tokenIds === null || tokenIds.length === 0) return null
  const efeito: EfeitoDBT = { seq, tipo, tokenIds, d20, faixa, numero }
  // Opcionais do golpe: ausente fica de fora; presente e torto derruba o efeito.
  const { critico, erroCritico, alvoId } = value
  if (critico !== undefined) {
    if (typeof critico !== 'boolean') return null
    efeito.critico = critico
  }
  if (erroCritico !== undefined) {
    if (typeof erroCritico !== 'boolean') return null
    efeito.erroCritico = erroCritico
  }
  if (alvoId !== undefined) {
    // O alvo é uma das fichas do efeito; fora delas é forjado.
    if (!idDoFio(alvoId) || !tokenIds.includes(alvoId)) return null
    efeito.alvoId = alvoId
  }
  return efeito
}

/** Os efeitos novos; o `seq` sobe estritamente (fora de ordem = forjado). */
export function parseBatalhaDBTEfeitos(value: unknown): BatalhaDBTEfeitosMessage | null {
  if (!isRecord(value) || value.type !== 'batalhaDBT.efeitos') return null
  const efeitos = lerLista(value.efeitos, EFEITOS_DBT_GUARDADOS, lerEfeito)
  if (efeitos === null) return null
  for (let i = 1; i < efeitos.length; i += 1) if (efeitos[i].seq <= efeitos[i - 1].seq) return null
  return { type: 'batalhaDBT.efeitos', efeitos }
}

/**
 * Um aliado: só personagem de JOGADOR (o host nunca manda NPC), sem campo de
 * mestre e sem o bloco de NPC da ficha (o `paraOFio` tira os dois). A ficha
 * Dragon Ball que veio e não se lê derruba: o perfil mostraria a ficha sem ela.
 */
function lerAliado(value: unknown): Personagem | null {
  if (!isRecord(value) || !textoAte(value.id, 1, PERSONAGEM_ID_DBT_MAX) || value.tipo !== 'jogador') return null
  if (CAMPOS_DO_MESTRE.some((campo) => value[campo] !== undefined)) return null
  if (isRecord(value.dbt) && value.dbt.npc !== undefined) return null
  const personagem = personagemDoArquivo(value)
  if (personagem === null || (value.dbt !== undefined && personagem.dbt === undefined)) return null
  return personagem
}

/** Os aliados na ordem: um personagem torto, de mestre ou repetido derruba a mensagem inteira. */
export function parseBatalhaDBTAliados(value: unknown): BatalhaDBTAliadosMessage | null {
  if (!isRecord(value) || value.type !== 'batalhaDBT.aliados') return null
  const personagens = lerLista(value.personagens, ALIADOS_DBT_MAX, lerAliado)
  if (personagens === null || new Set(personagens.map((personagem) => personagem.id)).size !== personagens.length) return null
  return { type: 'batalhaDBT.aliados', personagens }
}
