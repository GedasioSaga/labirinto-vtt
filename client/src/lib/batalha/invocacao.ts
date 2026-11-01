import type { Ajuste } from '../ajusteDaFicha'
import type { CartaoDaFicha, Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { gastarAcao, motivoDaTecnica, type AcoesDaVez } from './acoes'
import {
  BLOCOS_DO_INVOCADO_MAX,
  CARGA_MAX,
  combateVazio,
  DANO_MAX,
  INVOCACOES_PENDENTES_MAX,
  INVOCADOS_MAX,
  NOME_DO_INVOCADO_MAX,
  type AcaoDaTecnica,
  type CombateDoPersonagem,
  type InvocacaoPendente,
  type InvocadoNaBatalha,
  type NumerosDoInvocado,
  type PedidoDeInvocacao,
} from './combate'
import { overloadNaBatalha } from './escolhaEEvolucao'
import { normalizar } from './formula'
import { ajustesDoCusto, depoisDaTecnica } from './golpe'
import { CAMPO_DA_ACAO, CAMPO_DO_CUSTO, CAMPO_DO_EFEITO, CAMPO_DO_TEMPO, lerAcao, lerCusto, lerTempo, tecnicaPorId, tecnicasDe, type LeituraDoCusto, type LeituraDoTempo } from './leituraDaFicha'
import { lerTipo } from './tiposDaHabilidade'
import { cartaDaVez, inserirCarta, removerCarta, type AutorDaAcao, type CartaDaOrdem, type CartaNoLugar, type GastoDaVez, type TurnosDaCena } from './turnos'

/**
 * INVOCAÇÃO, F1 (docs/planos/batalha-invocacao-plano.md, com as decisões do
 * usuário): a técnica de Tipo Invocação (Chamado do Lobo) põe um invocado no
 * mapa. Aqui mora a parte pura:
 *  - a leitura do texto: HP, blocos, dano, máximo em campo, "concentração
 *    Nx" e "só pode ter 1" (decisão 1). Os extras que dizem números viram as
 *    OPÇÕES ("LOBOS COMUNS", "ULTRA LOBO"); sem nenhum, a própria técnica é a
 *    opção única. Leitura de texto erra: tudo é sugestão, e o mestre ajusta
 *    os números ao colocar;
 *  - o Ultra (decisão 10): exige a carga de Concentrar e gasta toda ela; sem
 *    números próprios, sugere a soma dos comuns + 1 ("mais forte que os 3
 *    juntos": 3 x 40 + 1 = 121 HP, 3 x 30 + 1 = 91 de dano); ao entrar, os
 *    comuns do mesmo dono saem (`comunsQueSaem`);
 *  - o motivo de recusa (`motivoDaInvocacao`) e o pedido aceito
 *    (`pedirInvocacao`): 1 invocado por uso (decisão 4), o máximo conta os
 *    colocados e os pendentes;
 *  - a carta do BANDO (decisão 3): uma por dono, logo depois da carta dele,
 *    id fixo `bando_<tokenId do dono>` (some e volta com o mesmo id). Os
 *    invocados não têm carta própria: agem na vez do bando, cada um com o
 *    gasto dele (`chaveDoGastoDoInvocado`) e o movimento fixo do texto.
 *
 * Puro: sem store, sem rede.
 */

/** A chave da opção única (a técnica sem extras de opção). */
export const OPCAO_PRINCIPAL = 'principal'
/** O prefixo do id (e do tokenId) da carta do bando: não é token do mapa. */
export const PREFIXO_DO_BANDO = 'bando_'

/** Uma opção da invocação, como o menu a mostra e o pedido a escolhe (`chave`). */
export interface OpcaoDaInvocacao {
  /** O nome do extra normalizado ("lobos comuns"); `OPCAO_PRINCIPAL` na opção única. */
  chave: string
  /** O nome do extra como está na ficha ("LOBOS COMUNS"); na opção única, o nome da técnica. */
  rotulo: string
  /** O nome do invocado no mapa ("Lobo", "Ultra Lobo"). */
  nome: string
  /** A opção forte (decisão 10): no máximo 1 (se o texto não diz outro), e ao entrar os comuns do mesmo dono saem. */
  ultra: boolean
  /** `null` = o texto não diz HP e dano (o mestre digita ao colocar). */
  numeros: NumerosDoInvocado | null
  /** Os números são a sugestão do Ultra (soma dos comuns + 1), não lidos. */
  sugeridos: boolean
  /** Quantos deste tipo o dono pode ter em campo (colocados + pendentes); `null` = o texto não limita. */
  maximo: number | null
  /** A carga de Concentrar exigida (e gasta inteira); 0 = nenhuma. */
  carga: number
  texto: string
}

export interface LeituraDaInvocacao {
  cartaoId: string
  nome: string
  /** A imagem do cartão (`midia:` ou embutida); `null` = disco de iniciais (decisão 6). */
  imagem: string | null
  opcoes: OpcaoDaInvocacao[]
}

/** O que um texto diz (normalizado). `null` = não diz. */
interface LidoDoTexto {
  hp: number | null
  dano: number | null
  blocos: number | null
  maximo: number | null
  carga: number
  /** "os 3 lobos juntos" = 3. */
  juntos: number | null
  maisForte: boolean
}

const NUMERO_POR_EXTENSO: Readonly<Record<string, number>> = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6 }

const SINAIS_DO_HP: readonly RegExp[] = [/(\d+)\s*(?:de\s+)?(?:hp|vida|pv)\b/, /\b(?:hp|vida|pv)\s*(?:de\s+)?(\d+)/]
const SINAIS_DO_DANO: readonly RegExp[] = [/(\d+)\s*(?:de\s+)?dano\b/, /\bdano\s*(?:de\s+)?(\d+)/]
const SINAIS_DOS_BLOCOS: readonly RegExp[] = [/(\d+)\s*(?:blocos?|casas?|quadrados?)\b/]
const SINAIS_DO_MAXIMO: readonly RegExp[] = [
  /\b(?:no\s+maximo|maximo\s+de)\s+(\d+|um|uma|dois|duas|tres|quatro|cinco|seis)\b/,
  /\b(?:so|apenas|somente)\s+(?:pode\s+(?:ter|haver|existir)\s+)?(\d+|um|uma|dois|duas|tres|quatro|cinco|seis)\b/,
]
const SINAIS_DA_CARGA: readonly RegExp[] = [/concentra\w*\s+(?:de\s+)?(\d)\s*(?:x|vezes)?\b/, /\b(\d)\s*x\s+(?:de\s+)?concentra/, /\bcarga\s+(?:de\s+)?(\d)\b/]
const SINAL_DOS_JUNTOS = /\b(\d+)\s+[a-z]+\s+juntos\b/
const SINAL_DO_MAIS_FORTE = /\bmais\s+forte/
const SINAL_DO_ULTRA = /\bultra\b/

function numeroDe(texto: string | undefined): number | null {
  if (texto === undefined) return null
  const porExtenso = NUMERO_POR_EXTENSO[texto]
  if (porExtenso !== undefined) return porExtenso
  const numero = Number.parseInt(texto, 10)
  return Number.isFinite(numero) ? numero : null
}

/** O primeiro sinal que bate, com o número dele. */
function primeiroNumero(normal: string, sinais: readonly RegExp[]): number | null {
  for (const sinal of sinais) {
    const numero = numeroDe(sinal.exec(normal)?.[1])
    if (numero !== null) return numero
  }
  return null
}

function lerTexto(texto: string): LidoDoTexto {
  const normal = normalizar(texto)
  const carga = primeiroNumero(normal, SINAIS_DA_CARGA)
  return {
    hp: primeiroNumero(normal, SINAIS_DO_HP),
    dano: primeiroNumero(normal, SINAIS_DO_DANO),
    blocos: primeiroNumero(normal, SINAIS_DOS_BLOCOS),
    maximo: primeiroNumero(normal, SINAIS_DO_MAXIMO),
    carga: carga === null ? 0 : Math.min(CARGA_MAX, Math.max(1, carga)),
    juntos: numeroDe(SINAL_DOS_JUNTOS.exec(normal)?.[1]),
    maisForte: SINAL_DO_MAIS_FORTE.test(normal),
  }
}

/** As palavras do nome do grupo que não entram no nome do invocado ("LOBOS COMUNS" = "Lobo"). */
const PALAVRAS_DO_GRUPO = new Set(['comum', 'comuns', 'normal', 'normais', 'basico', 'basicos'])

/** "Lobos" = "Lobo", "Leões" = "Leão", "Animais" = "Animal". Palavra curta fica. */
function singular(palavra: string): string {
  const normal = normalizar(palavra)
  if (normal.length <= 3 || !normal.endsWith('s') || normal.endsWith('ss')) return palavra
  if (normal.endsWith('oes') || normal.endsWith('aes')) return `${palavra.slice(0, -3)}ão`
  if (normal.endsWith('ais')) return `${palavra.slice(0, -2)}l`
  if (normal.endsWith('eis')) return `${palavra.slice(0, -3)}el`
  return palavra.slice(0, -1)
}

function comMaiuscula(palavra: string): string {
  const minuscula = palavra.toLocaleLowerCase('pt-BR')
  return minuscula.charAt(0).toLocaleUpperCase('pt-BR') + minuscula.slice(1)
}

/** O nome do invocado tirado do nome da opção ("LOBOS COMUNS" = "Lobo", "ULTRA LOBO" = "Ultra Lobo"); vazio = não deu. */
function nomeDoRotulo(rotulo: string): string {
  return rotulo
    .trim()
    .split(/\s+/)
    .filter((palavra) => palavra.length > 0 && !PALAVRAS_DO_GRUPO.has(normalizar(palavra)))
    .map((palavra) => comMaiuscula(singular(palavra)))
    .join(' ')
}

/** "Transforma um objeto ... em um lobo." = "Lobo"; vazio = o texto não diz. */
function nomeDaDescricao(texto: string): string {
  const achado = /\bem\s+(?:um|uma)\s+([A-Za-zÀ-ÿ]+)/i.exec(texto)?.[1]
  return achado === undefined ? '' : comMaiuscula(achado)
}

function noTetoDoNome(nome: string, reserva: string): string {
  const limpo = nome.trim() || reserva.trim() || 'Invocado'
  return limpo.slice(0, NOME_DO_INVOCADO_MAX)
}

/** A chave do extra, única na técnica ("lobos comuns", "lobos comuns 2"). */
function chaveUnica(nome: string, usadas: Set<string>): string {
  const base = normalizar(nome) || 'opcao'
  let chave = base
  for (let n = 2; usadas.has(chave); n += 1) chave = `${base} ${n}`
  usadas.add(chave)
  return chave
}

/** Os números completos (HP e dano lidos); `blocos` ausente vem de `blocosReserva`. */
function numerosLidos(lido: LidoDoTexto, blocosReserva: number | null): NumerosDoInvocado | null {
  if (lido.hp === null || lido.dano === null) return null
  return { hp: lido.hp, dano: lido.dano, blocos: lido.blocos ?? blocosReserva ?? 0 }
}

/**
 * A sugestão do Ultra (decisão 10): os `quantos` comuns juntos + 1. Ex.: 3
 * lobos de 40 HP e 30 de dano = 121 HP e 91 de dano; anda o mesmo que o comum.
 */
export function sugestaoDoUltra(comum: NumerosDoInvocado, quantos: number): NumerosDoInvocado {
  const n = Math.max(1, Math.trunc(quantos))
  return { hp: comum.hp * n + 1, dano: comum.dano * n + 1, blocos: comum.blocos }
}

/** A técnica é de Tipo Invocação. */
export function ehInvocacao(cartao: Pick<CartaoDaFicha, 'campos'>): boolean {
  return lerTipo(cartao).tipo === 'invocacao'
}

interface Candidata {
  nome: string
  texto: string
  lido: LidoDoTexto
  ultra: boolean
}

/**
 * A leitura da técnica de Tipo Invocação; `null` = não é invocação. Os
 * extras com HP, dano ou blocos (ou que falam de Ultra / "mais forte") são as
 * opções, na ordem da ficha; sem nenhum, a opção única sai do Efeito (ou da
 * Descrição). Ex.: Chamado do Lobo = [LOBOS COMUNS (Lobo, 40 HP, 3 blocos,
 * 30 de dano, máximo 3), ULTRA LOBO (Ultra Lobo, carga 3, máximo 1, sugere
 * 121 HP e 91 de dano)].
 */
export function lerInvocacao(cartao: CartaoDaFicha): LeituraDaInvocacao | null {
  if (!ehInvocacao(cartao)) return null
  const descricao = cartao.campos.descricao ?? ''
  const candidatas: Candidata[] = []
  for (const extra of cartao.extras) {
    const texto = extra.valor.trim()
    if (texto.length === 0) continue
    const lido = lerTexto(texto)
    const ultra = SINAL_DO_ULTRA.test(normalizar(extra.nome)) || lido.maisForte
    if (!ultra && lido.hp === null && lido.dano === null && lido.blocos === null) continue
    candidatas.push({ nome: extra.nome.trim(), texto, lido, ultra })
  }
  const nomeDaTecnica = cartao.nome.trim()
  if (candidatas.length === 0) {
    const texto = (cartao.campos[CAMPO_DO_EFEITO] ?? '').trim() || descricao.trim()
    const lido = lerTexto(texto)
    const opcao: OpcaoDaInvocacao = {
      chave: OPCAO_PRINCIPAL,
      rotulo: nomeDaTecnica || 'Invocação',
      nome: noTetoDoNome(nomeDaDescricao(descricao) || nomeDaDescricao(texto), nomeDaTecnica),
      ultra: false,
      numeros: numerosLidos(lido, null),
      sugeridos: false,
      maximo: lido.maximo,
      carga: lido.carga,
      texto,
    }
    return { cartaoId: cartao.id, nome: nomeDaTecnica, imagem: cartao.imagem, opcoes: [opcao] }
  }
  const usadas = new Set<string>()
  const comuns = candidatas.filter((candidata) => !candidata.ultra)
  const primeiroComum = comuns.map((candidata) => ({ candidata, numeros: numerosLidos(candidata.lido, null) })).find(({ numeros }) => numeros !== null)
  const opcoes = candidatas.map((candidata): OpcaoDaInvocacao => {
    const { lido } = candidata
    const proprios = numerosLidos(lido, primeiroComum?.numeros?.blocos ?? null)
    let numeros = proprios
    let sugeridos = false
    if (numeros === null && candidata.ultra && primeiroComum?.numeros !== undefined && primeiroComum.numeros !== null) {
      numeros = sugestaoDoUltra(primeiroComum.numeros, lido.juntos ?? primeiroComum.candidata.lido.maximo ?? 1)
      sugeridos = true
    }
    const nome = nomeDoRotulo(candidata.nome) || nomeDaDescricao(descricao)
    return {
      chave: chaveUnica(candidata.nome, usadas),
      rotulo: candidata.nome || nomeDaTecnica,
      nome: noTetoDoNome(nome, nomeDaTecnica),
      ultra: candidata.ultra,
      numeros,
      sugeridos,
      // O Ultra é um só quando o texto não diz outro número (decisão 10).
      maximo: lido.maximo ?? (candidata.ultra ? 1 : null),
      carga: lido.carga,
      texto: candidata.texto,
    }
  })
  return { cartaoId: cartao.id, nome: nomeDaTecnica, imagem: cartao.imagem, opcoes }
}

/** A opção do pedido, pela chave exata; `null` = não é opção desta técnica. */
export function opcaoDaInvocacao(leitura: LeituraDaInvocacao, chave: string): OpcaoDaInvocacao | null {
  return leitura.opcoes.find((opcao) => opcao.chave === chave) ?? null
}

// ───────────────────────────────────────────────────────────────────────────
// Quem está em campo
// ───────────────────────────────────────────────────────────────────────────

const SEM_INVOCADOS: readonly InvocadoNaBatalha[] = []
const SEM_PENDENTES: readonly InvocacaoPendente[] = []

/** O invocado do token; `null` = o token não é invocado (ou já saiu). */
export function invocadoDoToken(turnos: Pick<TurnosDaCena, 'invocados'>, tokenId: string): InvocadoNaBatalha | null {
  return (turnos.invocados ?? SEM_INVOCADOS).find((invocado) => invocado.tokenId === tokenId) ?? null
}

/** O token é de um invocado em campo (não reage, decisão 8). */
export function ehInvocado(turnos: Pick<TurnosDaCena, 'invocados'>, tokenId: string): boolean {
  return invocadoDoToken(turnos, tokenId) !== null
}

/** A pendência pelo id; `null` = não existe (já posta, cancelada ou desfeita). */
export function pendenciaPorId(turnos: Pick<TurnosDaCena, 'invocacoes'>, id: string): InvocacaoPendente | null {
  return (turnos.invocacoes ?? SEM_PENDENTES).find((pendente) => pendente.id === id) ?? null
}

/** Quantos desta opção o dono tem em campo: colocados + pendentes (decisão do plano). */
export function quantosNoCampo(turnos: Pick<TurnosDaCena, 'invocados' | 'invocacoes'>, donoPersonagemId: string, cartaoId: string, opcao: string): number {
  const mesma = (de: { donoPersonagemId: string; cartaoId: string; opcao: string }): boolean => de.donoPersonagemId === donoPersonagemId && de.cartaoId === cartaoId && de.opcao === opcao
  return (turnos.invocados ?? SEM_INVOCADOS).filter(mesma).length + (turnos.invocacoes ?? SEM_PENDENTES).filter(mesma).length
}

/** Ultra entrando: os comuns (não-Ultra) do MESMO dono e da MESMA técnica, que saem (decisão 10). Comum entrando: nenhum. */
export function comunsQueSaem(turnos: Pick<TurnosDaCena, 'invocados'>, pendente: Pick<InvocacaoPendente, 'ultra' | 'donoPersonagemId' | 'cartaoId'>): InvocadoNaBatalha[] {
  if (!pendente.ultra) return []
  return (turnos.invocados ?? SEM_INVOCADOS).filter((invocado) => !invocado.ultra && invocado.donoPersonagemId === pendente.donoPersonagemId && invocado.cartaoId === pendente.cartaoId)
}

/**
 * O Ultra do MESMO dono e da MESMA técnica está em campo: o comum não entra
 * ao lado dele (decisão 10: o Ultra tira os comuns; o comum pendente de antes
 * não volta por trás). Ultra entrando: sempre `false`.
 */
export function ultraEmCampo(turnos: Pick<TurnosDaCena, 'invocados'>, de: Pick<InvocacaoPendente, 'ultra' | 'donoPersonagemId' | 'cartaoId'>): boolean {
  if (de.ultra) return false
  return (turnos.invocados ?? SEM_INVOCADOS).some((invocado) => invocado.ultra && invocado.donoPersonagemId === de.donoPersonagemId && invocado.cartaoId === de.cartaoId)
}

/** O motivo de recusar o comum com o Ultra em campo (a store recusa colocar; a regra do pedido, pedir). */
export const MOTIVO_DO_COMUM_COM_O_ULTRA = 'Com o Ultra em campo, os comuns não entram'

/** O espaço do número no fim do nome (" 61": os números não passam de `INVOCADOS_MAX` + 1). */
const SUFIXO_DO_NUMERO_MAX = 4

/** "Lobo 2" com a base "Lobo" = 2; outro nome, ou sem número no fim, `null`. */
function numeroNoFim(nome: string, base: string): number | null {
  if (!nome.startsWith(`${base} `)) return null
  const resto = nome.slice(base.length + 1)
  return /^\d{1,3}$/.test(resto) ? Number.parseInt(resto, 10) : null
}

/**
 * O nome do invocado no mapa com o número dele entre os do MESMO dono e do
 * mesmo nome ("Lobo 1", "Lobo 2", "Lobo 3"): o menor número livre, para a
 * lista "Quem age" e o mapa dizerem qual é qual. O Ultra (um só, decisão 10)
 * só ganha número se outro do dono já tem o mesmo nome. No teto do nome.
 */
export function nomeNumerado(turnos: Pick<TurnosDaCena, 'invocados'>, de: Pick<InvocacaoPendente, 'ultra' | 'donoTokenId'>, nome: string): string {
  const base = nome.length + SUFIXO_DO_NUMERO_MAX > NOME_DO_INVOCADO_MAX ? nome.slice(0, NOME_DO_INVOCADO_MAX - SUFIXO_DO_NUMERO_MAX).trimEnd() : nome
  const usados = new Set<number>()
  let mesmoNome = false
  for (const invocado of turnos.invocados ?? SEM_INVOCADOS) {
    if (invocado.donoTokenId !== de.donoTokenId) continue
    if (invocado.nome === nome) mesmoNome = true
    const numero = numeroNoFim(invocado.nome, base)
    if (numero !== null) usados.add(numero)
  }
  if (de.ultra && !mesmoNome && usados.size === 0) return nome
  let numero = 1
  while (usados.has(numero)) numero += 1
  return `${base} ${numero}`
}

// ───────────────────────────────────────────────────────────────────────────
// O pedido (o jogador pede, o mestre pede pelo NPC dele)
// ───────────────────────────────────────────────────────────────────────────

/** O que a regra do pedido precisa saber. */
export interface ContextoDaInvocacao {
  /** O personagem da ficha do dono. */
  personagem: Personagem | null
  sistema: SistemaDeRpg | null
  turnos: TurnosDaCena
  /** As ações da carta da vez (que é do dono); `null` = sem vez. */
  acoes: AcoesDaVez | null
}

interface TecnicaDaInvocacao {
  cartao: CartaoDaFicha
  custo: LeituraDoCusto
  acao: AcaoDaTecnica | 'passiva' | null
  tempo: LeituraDoTempo
  overload: boolean
  transformacao: boolean
}

/** A técnica do pedido com o que a tela confirmou (custo e ação), como `tecnicaPedida` do golpe. */
function tecnicaDoPedido(personagem: Personagem, sistema: SistemaDeRpg, pedido: PedidoDeInvocacao, evoluidas: readonly string[] | undefined): TecnicaDaInvocacao | null {
  const achada = tecnicaPorId(personagem, sistema, pedido.cartaoId)
  if (achada === null) return null
  const { cartao } = achada
  const lidaAcao = lerAcao(cartao.campos[CAMPO_DA_ACAO] ?? '')
  const lidoCusto = lerCusto(cartao.campos[CAMPO_DO_CUSTO] ?? '', personagem)
  const recurso = lidoCusto.tipo === 'nada' ? 'sp' : lidoCusto.recurso
  return {
    cartao,
    custo: pedido.custo === null ? lidoCusto : { tipo: 'valor', recurso, valor: pedido.custo, porTurno: false },
    acao: lidaAcao.acao ?? pedido.acao,
    tempo: lerTempo(cartao.campos[CAMPO_DO_TEMPO] ?? ''),
    overload: overloadNaBatalha(cartao, tecnicasDe(personagem, sistema), evoluidas),
    transformacao: lidaAcao.transformacao,
  }
}

/** O combate do personagem na batalha (vazio se ainda não agiu). */
function combateDo(turnos: TurnosDaCena, personagemId: string): CombateDoPersonagem {
  return turnos.combate?.[personagemId] ?? combateVazio()
}

/**
 * Por que o pedido não vale, ou `null` (pode). Mesma regra no mestre e no
 * jogador: na vez de uma carta do personagem; técnica dele, de Tipo
 * Invocação, com a opção pedida; teto de pendências e de invocados; máximo
 * da opção (colocados + pendentes); a carga de Concentrar que a opção exige;
 * e a regra de toda técnica (recarga, usos, Overload, ação, SP), pela
 * `motivoDaTecnica`. A carga NÃO vira Completa aqui: na invocação ela é
 * exigência, não o "Atenção 3" do golpe.
 */
export function motivoDaInvocacao(ctx: ContextoDaInvocacao, pedido: PedidoDeInvocacao): string | null {
  const { personagem, sistema, turnos } = ctx
  if (personagem === null || sistema === null) return 'Ficha sem personagem não invoca'
  const daVez = cartaDaVez(turnos)
  if (daVez === null || daVez.personagemId !== personagem.id) return 'Só na vez de quem invoca'
  const combate = combateDo(turnos, personagem.id)
  const tecnica = tecnicaDoPedido(personagem, sistema, pedido, combate.evoluidas)
  if (tecnica === null) return 'Técnica não encontrada na ficha'
  const leitura = lerInvocacao(tecnica.cartao)
  if (leitura === null) return 'A técnica não é de Tipo Invocação'
  const opcao = opcaoDaInvocacao(leitura, pedido.opcao)
  if (opcao === null) return 'Opção não encontrada na técnica'
  if ((turnos.invocacoes?.length ?? 0) >= INVOCACOES_PENDENTES_MAX) return 'Invocações demais esperando o mestre'
  if ((turnos.invocados?.length ?? 0) + (turnos.invocacoes?.length ?? 0) >= INVOCADOS_MAX) return 'Invocados demais em campo'
  if (opcao.maximo !== null && quantosNoCampo(turnos, personagem.id, tecnica.cartao.id, opcao.chave) >= opcao.maximo) return `No máximo ${opcao.maximo} em campo`
  // Decisão 10: o comum pedido com o Ultra em campo pagaria por uma pendência que nunca entra.
  if (ultraEmCampo(turnos, { ultra: opcao.ultra, donoPersonagemId: personagem.id, cartaoId: tecnica.cartao.id })) return MOTIVO_DO_COMUM_COM_O_ULTRA
  if (combate.carga < opcao.carga) return `Precisa de concentração ${opcao.carga} (tem ${combate.carga})`
  if (tecnica.acao === null) return 'Escolha a ação da técnica'
  if (tecnica.custo.tipo === 'pergunta') return 'Confirme o custo'
  return motivoDaTecnica(tecnica, personagem, sistema, { ...combate, carga: 0 }, ctx.acoes, false, true)
}

/** O pedido aceito, para a store aplicar (o custo pela aventura, o resto nos turnos). */
export interface InvocacaoPedida {
  pendente: InvocacaoPendente
  /** O combate do dono depois: recarga, usos, Overload e a carga gasta (a opção que exige concentração gasta TODA a carga). */
  combate: CombateDoPersonagem
  /** O gasto novo da carta da vez. */
  gasto: GastoDaVez
  /** O custo (SP ou HP), para `aplicarAjustes`. */
  custo: readonly Ajuste[]
  /** O que foi cobrado, para o texto da linha; `null` = técnica sem custo. */
  pago: { recurso: 'sp' | 'hp'; valor: number } | null
  acao: AcaoDaTecnica
  opcao: OpcaoDaInvocacao
  /** O nome da técnica (para a linha). */
  tecnica: string
}

const GASTO_ZERO: GastoDaVez = { simples: 0, movimento: 0, bonus: 0, blocos: 0 }

/**
 * O pedido aceito. Só depois de `motivoDaInvocacao` devolver `null` (aqui
 * não se confere de novo; `null` = o mesmo que recusa).
 */
export function pedirInvocacao(
  ctx: ContextoDaInvocacao & { autor: AutorDaAcao; donoTokenId: string },
  pedido: PedidoDeInvocacao,
  ids: { pendente: string; linha: string },
): InvocacaoPedida | null {
  const { personagem, sistema, turnos } = ctx
  const daVez = cartaDaVez(turnos)
  if (personagem === null || sistema === null || daVez === null) return null
  const combateAntes = combateDo(turnos, personagem.id)
  const tecnica = tecnicaDoPedido(personagem, sistema, pedido, combateAntes.evoluidas)
  const leitura = tecnica === null ? null : lerInvocacao(tecnica.cartao)
  const opcao = leitura === null ? null : opcaoDaInvocacao(leitura, pedido.opcao)
  if (tecnica === null || leitura === null || opcao === null || tecnica.acao === null || tecnica.acao === 'passiva') return null
  let combate = depoisDaTecnica(combateAntes, tecnica)
  if (opcao.carga > 0 && combate.carga !== 0) combate = { ...combate, carga: 0 }
  const pendente: InvocacaoPendente = {
    id: ids.pendente,
    linhaId: ids.linha,
    rodada: turnos.rodada,
    autor: ctx.autor,
    donoTokenId: ctx.donoTokenId,
    donoPersonagemId: personagem.id,
    cartaoId: tecnica.cartao.id,
    opcao: opcao.chave,
    rotulo: opcao.rotulo,
    ultra: opcao.ultra,
    nome: opcao.nome,
    numeros: opcao.numeros,
    sugeridos: opcao.sugeridos,
    imagem: leitura.imagem,
  }
  return {
    pendente,
    combate,
    gasto: gastarAcao(turnos.gastos[daVez.id] ?? GASTO_ZERO, tecnica.acao),
    custo: ajustesDoCusto(personagem, sistema, tecnica.custo),
    pago: tecnica.custo.tipo === 'valor' && tecnica.custo.valor > 0 ? { recurso: tecnica.custo.recurso, valor: tecnica.custo.valor } : null,
    acao: tecnica.acao,
    opcao,
    tecnica: leitura.nome || 'a técnica',
  }
}

export function novoIdDeInvocacao(): string {
  return `invocacao_${crypto.randomUUID()}`
}

// ───────────────────────────────────────────────────────────────────────────
// Colocar no mapa (o mestre)
// ───────────────────────────────────────────────────────────────────────────

/** Os números no teto: HP de 1 a `DANO_MAX`, dano de 0 a `DANO_MAX`, blocos de 0 a `BLOCOS_DO_INVOCADO_MAX`, todos inteiros. `null` = torto. */
export function numerosValidos(numeros: NumerosDoInvocado): NumerosDoInvocado | null {
  const { hp, dano, blocos } = numeros
  if (!Number.isInteger(hp) || hp < 1 || hp > DANO_MAX) return null
  if (!Number.isInteger(dano) || dano < 0 || dano > DANO_MAX) return null
  if (!Number.isInteger(blocos) || blocos < 0 || blocos > BLOCOS_DO_INVOCADO_MAX) return null
  return { hp, dano, blocos }
}

/** O nome que o mestre digitou ao colocar (no teto) ou o da pendência. */
export function nomeDaColocacao(pendente: Pick<InvocacaoPendente, 'nome'>, digitado: string | undefined): string {
  return noTetoDoNome(digitado ?? '', pendente.nome)
}

/** O invocado que nasce da pendência. */
export function invocadoDaPendencia(
  pendente: InvocacaoPendente,
  feito: { tokenId: string; personagemId: string; linhaId: string; nome: string; numeros: NumerosDoInvocado },
): InvocadoNaBatalha {
  return {
    tokenId: feito.tokenId,
    personagemId: feito.personagemId,
    donoTokenId: pendente.donoTokenId,
    donoPersonagemId: pendente.donoPersonagemId,
    cartaoId: pendente.cartaoId,
    opcao: pendente.opcao,
    ultra: pendente.ultra,
    nome: feito.nome,
    blocos: feito.numeros.blocos,
    dano: feito.numeros.dano,
    pedidoId: pendente.id,
    linhaDoPedido: pendente.linhaId,
    linhaId: feito.linhaId,
  }
}

// ───────────────────────────────────────────────────────────────────────────
// A carta do bando (decisão 3)
// ───────────────────────────────────────────────────────────────────────────

/** O id fixo (e o tokenId) da carta do bando de um dono. */
export function idDoBando(donoTokenId: string): string {
  return `${PREFIXO_DO_BANDO}${donoTokenId}`
}

/** Os invocados que agem na carta do bando; carta que não é de bando = nenhum. */
export function membrosDoBando(turnos: Pick<TurnosDaCena, 'invocados'>, carta: Pick<CartaDaOrdem, 'bando'>): InvocadoNaBatalha[] {
  const { bando } = carta
  if (bando === undefined) return []
  return (turnos.invocados ?? SEM_INVOCADOS).filter((invocado) => invocado.donoTokenId === bando.donoTokenId)
}

/**
 * A ordem com os bandos em dia: cada dono com invocado em campo tem UMA
 * carta de bando, logo depois das cartas dele (a original e as extras; sem
 * carta, no fim); a de dono sem invocado sai, MENOS a que está com a vez: o
 * último membro que cai na vez do próprio bando não anda a vez sem linha (o
 * Desfazer não a traria de volta); ela sai quando a vez passar
 * (`semBandosVazios`). O id é fixo, então a carta que sai e volta é a mesma.
 * `nomeDoBando` = o texto da carta ("Bando de Ryoko"). Nada a mudar = o MESMO objeto.
 */
export function comBandosEmDia(turnos: TurnosDaCena, nomeDoBando: (donoTokenId: string) => string): TurnosDaCena {
  const donos = [...new Set((turnos.invocados ?? SEM_INVOCADOS).map((invocado) => invocado.donoTokenId))]
  let novos = turnos
  for (const carta of turnos.cartas) {
    if (carta.bando === undefined || donos.includes(carta.bando.donoTokenId) || carta.id === turnos.vez) continue
    novos = removerCarta(novos, carta.id)?.turnos ?? novos
  }
  for (const donoTokenId of donos) {
    const id = idDoBando(donoTokenId)
    if (novos.cartas.some((carta) => carta.id === id)) continue
    const carta: CartaDaOrdem = { id, tokenId: id, personagemId: null, nome: nomeDoBando(donoTokenId), bando: { donoTokenId } }
    let depoisDoDono = -1
    novos.cartas.forEach((candidata, indice) => {
      if (candidata.tokenId === donoTokenId) depoisDoDono = indice + 1
    })
    novos = inserirCarta(novos, carta, depoisDoDono < 0 ? undefined : depoisDoDono)
  }
  return novos
}

/**
 * Depois de a vez andar (passar ou dar a vez): as cartas de bando sem
 * ninguém que não estão com a vez saem (a que `comBandosEmDia` guardou
 * enquanto era a vez dela), cada uma com o lugar que tinha em `antes` (a
 * ordem de antes de a vez andar), para a reversão "vez" pô-las de volta no
 * mesmo lugar. Nenhuma = os MESMOS turnos.
 */
export function semBandosVazios(turnos: TurnosDaCena, antes: readonly CartaDaOrdem[]): { turnos: TurnosDaCena; removidas: CartaNoLugar[] } {
  const donos = new Set((turnos.invocados ?? SEM_INVOCADOS).map((invocado) => invocado.donoTokenId))
  const removidas: CartaNoLugar[] = []
  let novos = turnos
  for (const carta of turnos.cartas) {
    if (carta.bando === undefined || donos.has(carta.bando.donoTokenId) || carta.id === turnos.vez) continue
    const feito = removerCarta(novos, carta.id)
    if (feito === null) continue
    novos = feito.turnos
    const indice = antes.findIndex((candidata) => candidata.id === carta.id)
    removidas.push({ carta, indice: indice < 0 ? feito.removida.indice : indice })
  }
  return { turnos: novos, removidas }
}

/** A chave do gasto de um invocado na vez do bando (`TurnosDaCena.gastos`): cada um tem a Simples e o movimento dele. */
export function chaveDoGastoDoInvocado(cartaId: string, tokenId: string): string {
  return `${cartaId}|${tokenId}`
}

/**
 * As ações de um invocado na vez do bando: 1 Simples (o golpe), 1 Movimento
 * e o limite de blocos FIXO do texto (decisão 3; conta e não trava, como o
 * "Mov 2/4" de sempre).
 */
export function acoesDoInvocado(turnos: Pick<TurnosDaCena, 'gastos'>, cartaId: string, invocado: Pick<InvocadoNaBatalha, 'tokenId' | 'blocos'>): AcoesDaVez {
  const gasto = turnos.gastos[chaveDoGastoDoInvocado(cartaId, invocado.tokenId)] ?? GASTO_ZERO
  return {
    simples: { usadas: gasto.simples, total: 1 },
    movimento: { usadas: gasto.movimento, total: 1 },
    bonus: { usadas: gasto.bonus, total: 0 },
    blocos: { andados: gasto.blocos, limite: invocado.blocos },
  }
}
