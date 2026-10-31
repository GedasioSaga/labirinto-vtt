import type { CartaoDaFicha } from '../personagem'
import { idValido } from '../sistemaDeRpg'
import {
  ALVO_DO_MOD_MAX,
  NOME_DO_SELO_MAX,
  SELOS_MAX,
  SELOS_POR_TOKEN_MAX,
  TURNOS_DO_SELO_MAX,
  type BonusDaBatalha,
  type ParteDoBonus,
  type SaidaDaReacao,
  type SeloDaBatalha,
  type SeloPedido,
} from './combate'
import { normalizar } from './formula'

/**
 * SELOS DE DURAÇÃO, F3 fatia T (seção 3.3 de
 * docs/planos/batalha-one-piece-f3-plano.md; respostas Q4 a Q6): "Atordoado 2"
 * na carta. O mestre põe à mão; a habilidade que diz "por N turnos" sugere o
 * selo no golpe, que só pega se o golpe acerta (Q6). Conta pela vez do alvo
 * (Q4): desconta no fim da vez dele, no máximo 1 vez por rodada. Todos que
 * veem a carta veem o selo, também o de NPC (Q5).
 *
 * Puro: sem store, sem rede. O id entra por parâmetro.
 */

/** Os prontos do "Pôr selo...", em botões. */
export const SELOS_PRONTOS = ['Atordoado', 'Cego', 'Sangrando', 'Queimando', 'Envenenado', 'Paralisado', 'Lento', 'Preso', 'Confuso', 'Marcado'] as const

/** O nome quando nem a palavra-chave nem a técnica dão um. */
const NOME_DO_SELO_PADRAO = 'Selo'

/** Os campos da técnica que a leitura do selo olha, nesta ordem. */
const CAMPOS_DO_SELO = ['efeito', 'descricao'] as const

/** Nome de selo que o fio aceita: de 1 a `NOME_DO_SELO_MAX`, sem quebra de linha e não só espaço. */
export function ehNomeDeSelo(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 1 && value.length <= NOME_DO_SELO_MAX && !/[\r\n]/.test(value) && value.trim().length > 0
}

export function novoIdDeSelo(): string {
  return `selo_${crypto.randomUUID()}`
}

/** O selo pedido dentro das regras (nome aparado no teto, turnos de 1 a 99 ou até tirar); torto = `null`. */
export function seloPedidoValido(selo: SeloPedido): SeloPedido | null {
  const nome = selo.nome.replace(/\s+/g, ' ').trim().slice(0, NOME_DO_SELO_MAX).trim()
  if (!ehNomeDeSelo(nome)) return null
  if (selo.turnos !== null && (!Number.isInteger(selo.turnos) || selo.turnos < 1 || selo.turnos > TURNOS_DO_SELO_MAX)) return null
  return { nome, turnos: selo.turnos }
}

/** "por 2 turnos", "durante 3 rodadas" (já sem acento e em minúsculas). */
const DURACAO = /\b(?:por|durante) (\d+) (?:turnos?|rodadas?)\b/

/** A palavra-chave e o selo que ela dá. A primeira que aparece no texto vence. */
const PALAVRAS_DO_SELO: readonly { sinal: RegExp; nome: (typeof SELOS_PRONTOS)[number] }[] = [
  { sinal: /atordo|\bstun/, nome: 'Atordoado' },
  { sinal: /\bceg[ao]/, nome: 'Cego' },
  { sinal: /sangra/, nome: 'Sangrando' },
  { sinal: /queima/, nome: 'Queimando' },
  { sinal: /envenena|veneno/, nome: 'Envenenado' },
  { sinal: /paralisa/, nome: 'Paralisado' },
  { sinal: /\blento\b|lentidao/, nome: 'Lento' },
  { sinal: /prende|imobiliza/, nome: 'Preso' },
  { sinal: /confunde/, nome: 'Confuso' },
  // Tipos de habilidade F1: a marca que a reação põe em quem atacou ("marca de tinta").
  { sinal: /\bmarca/, nome: 'Marcado' },
]

/**
 * O selo que um texto sugere: número + "turno(s)" ou "rodada(s)" depois de
 * "por" ou "durante" ("Atordoa o alvo por 1 turno" = Atordoado, 1). Nome: a
 * primeira palavra-chave do texto; nenhuma = o nome da técnica (no teto).
 * Sem número de turnos = `null` ("-15 (Por turno)" não é selo).
 */
export function lerDuracao(texto: string, nomeDaTecnica: string): SeloPedido | null {
  const normal = normalizar(texto)
  const numero = DURACAO.exec(normal)?.[1]
  if (numero === undefined) return null
  const turnos = Math.min(TURNOS_DO_SELO_MAX, Number.parseInt(numero, 10))
  if (!(turnos >= 1)) return null
  let achado: { indice: number; nome: string } | null = null
  for (const { sinal, nome } of PALAVRAS_DO_SELO) {
    const indice = normal.search(sinal)
    if (indice !== -1 && (achado === null || indice < achado.indice)) achado = { indice, nome }
  }
  const nome = achado?.nome ?? (nomeDaTecnica.replace(/\s+/g, ' ').trim().slice(0, NOME_DO_SELO_MAX).trim() || NOME_DO_SELO_PADRAO)
  return { nome: ehNomeDeSelo(nome) ? nome : NOME_DO_SELO_PADRAO, turnos }
}

/** O selo que a técnica sugere: lê o Efeito e, sem nada lá, a Descrição. */
export function seloDaTecnica(cartao: CartaoDaFicha): SeloPedido | null {
  for (const campo of CAMPOS_DO_SELO) {
    const selo = lerDuracao(cartao.campos[campo] ?? '', cartao.nome)
    if (selo !== null) return selo
  }
  return null
}

/** O que a criação do selo precisa saber da cena. */
export interface OndeNasceOSelo {
  id: string
  rodada: number
  /** O token da carta da vez agora; `null` = nenhuma. */
  tokenDaVez: string | null
  /** A técnica que o pôs. */
  origem?: string
}

/**
 * O selo novo. Posto na ficha DA VEZ, a vez de agora não conta (já marcado
 * nesta rodada): "Atordoado 1" vale a próxima vez inteira dela.
 */
export function criarSelo(tokenId: string, pedido: SeloPedido, onde: OndeNasceOSelo): SeloDaBatalha {
  const selo: SeloDaBatalha = { id: onde.id, tokenId, nome: pedido.nome, turnos: pedido.turnos, total: pedido.turnos }
  if (onde.tokenDaVez === tokenId) selo.contadoNaRodada = onde.rodada
  if (onde.origem !== undefined && onde.origem.trim().length > 0) selo.origem = onde.origem.trim()
  return selo
}

/** A lista com o selo no fim; acima do teto da ficha ou da cena = `null`. */
export function comSeloNovo(selos: readonly SeloDaBatalha[] | undefined, selo: SeloDaBatalha): SeloDaBatalha[] | null {
  const lista = selos ?? []
  if (lista.length >= SELOS_MAX || selosDoToken(lista, selo.tokenId).length >= SELOS_POR_TOKEN_MAX) return null
  return [...lista, selo]
}

/**
 * A carta de `tokenIdQueSai` passou a vez na `rodada`: os selos dela
 * descontam 1 (só se `contadoNaRodada !== rodada`); os que chegam a 0 saem e
 * vêm em `acabaram`. Selo sem turnos nunca desconta. Nada mudou = a MESMA
 * lista em `selos`.
 */
export function contarSelos(selos: readonly SeloDaBatalha[], tokenIdQueSai: string, rodada: number): { selos: readonly SeloDaBatalha[]; acabaram: SeloDaBatalha[] } {
  const acabaram: SeloDaBatalha[] = []
  let mudou = false
  const ficam: SeloDaBatalha[] = []
  for (const selo of selos) {
    if (selo.tokenId !== tokenIdQueSai || selo.turnos === null || selo.contadoNaRodada === rodada) {
      ficam.push(selo)
      continue
    }
    mudou = true
    const turnos = selo.turnos - 1
    if (turnos <= 0) acabaram.push({ ...selo, turnos: 0, contadoNaRodada: rodada })
    else ficam.push({ ...selo, turnos, contadoNaRodada: rodada })
  }
  return { selos: mudou ? ficam : selos, acabaram }
}

/** Os selos de uma ficha, na ordem em que foram postos. */
export function selosDoToken(selos: readonly SeloDaBatalha[] | undefined, tokenId: string): SeloDaBatalha[] {
  return (selos ?? []).filter((selo) => selo.tokenId === tokenId)
}

/** Q6: o selo sugerido pega quando o golpe acerta (Receber, Defender, Crítico, Não reagir, Passar, sem reação); não em Esquivar nem Contra-atacar. */
export function pegaOSelo(saida: SaidaDaReacao): boolean {
  return saida !== 'esquiva' && saida !== 'contra'
}

/** "Atordoado 2"; sem turnos (até tirar), só o nome: "Cego". */
export function textoDoSelo(selo: Pick<SeloDaBatalha, 'nome' | 'turnos'>): string {
  return selo.turnos === null ? selo.nome : `${selo.nome} ${selo.turnos}`
}

/** "Atordoado acabou em Ilo · Cego acabou em Ilo": o pedaço que vai no fim da linha da vez. */
export function textoDosQueAcabaram(acabaram: readonly SeloDaBatalha[], nomeDe: (tokenId: string) => string): string {
  return acabaram.map((selo) => `${selo.nome} acabou em ${nomeDe(selo.tokenId)}`).join(' · ')
}

// ───────────────────────────────────────────────────────────────────────────
// Tipos de habilidade F2: o que os selos somam (Buff/Debuff, seção 4c)
// ───────────────────────────────────────────────────────────────────────────

/** Alvo de mod que o fio aceita: a forma de um id de atributo (letras, números, - e _), no teto. */
export function ehAlvoDeMod(value: unknown): value is string {
  return typeof value === 'string' && value.length <= ALVO_DO_MOD_MAX && idValido(value)
}

/** O que um selo precisa ter para somar: de quem é, o nome (que a conta mostra) e os mods. */
export type SeloQueSoma = Pick<SeloDaBatalha, 'tokenId' | 'nome' | 'mods'>

/**
 * O bônus dos selos da ficha `tokenId`: por alvo, as partes "+20 (Fúria)" na
 * ordem em que os selos foram postos; delta 0 não entra. A MESMA conta em
 * todas as telas (menu, mira, painel do NPC, caixa de reação). O jogador
 * passa `selosParaOBonus(estado.cartas)`.
 */
export function bonusDaBatalha(selos: readonly SeloQueSoma[] | undefined, tokenId: string): BonusDaBatalha {
  // Map e não objeto: o alvo veio do fio, e "constructor" num objeto já existe.
  const porAlvo = new Map<string, ParteDoBonus[]>()
  for (const selo of selos ?? []) {
    if (selo.tokenId !== tokenId) continue
    for (const mod of selo.mods ?? []) {
      if (mod.delta === 0) continue
      const partes = porAlvo.get(mod.alvo) ?? []
      partes.push({ nome: selo.nome, delta: mod.delta })
      porAlvo.set(mod.alvo, partes)
    }
  }
  return Object.fromEntries(porAlvo)
}

/** As partes de um alvo do bônus ("forca", "dano", "reacao"); nenhuma = lista vazia. Só as do próprio objeto. */
export function partesDoBonus(bonus: BonusDaBatalha | undefined, alvo: string): readonly ParteDoBonus[] {
  return bonus !== undefined && Object.hasOwn(bonus, alvo) ? (bonus[alvo] ?? []) : []
}

/** A soma de um alvo do bônus; sem selo, 0. */
export function totalDoBonus(bonus: BonusDaBatalha | undefined, alvo: string): number {
  return partesDoBonus(bonus, alvo).reduce((soma, parte) => soma + parte.delta, 0)
}
