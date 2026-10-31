import type { CartaoDaFicha } from '../personagem'
import { idValido, type SistemaDeRpg } from '../sistemaDeRpg'
import {
  ALVO_DA_REACAO,
  ALVO_DO_DANO,
  ALVO_DO_MOD_MAX,
  DANO_MAX,
  MODIFICADOR_DA_REACAO_MAX,
  MODS_POR_SELO_MAX,
  NOME_DO_SELO_MAX,
  partesDoBonus,
  SELOS_MAX,
  SELOS_POR_TOKEN_MAX,
  TURNOS_DO_SELO_MAX,
  type BonusDaBatalha,
  type ModDoSelo,
  type NaturezaDoSelo,
  type ParteDoBonus,
  type SaidaDaReacao,
  type SeloDaBatalha,
  type SeloDoGolpe,
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

/**
 * O selo pedido dentro das regras (nome aparado no teto, turnos de 1 a 99 ou
 * até tirar); torto = `null`. Os mods passam por `modsValidos` (o que não
 * vale sai calado; o selo fica).
 */
export function seloPedidoValido(selo: SeloPedido, sistema: SistemaDeRpg | null): SeloPedido | null {
  const nome = selo.nome.replace(/\s+/g, ' ').trim().slice(0, NOME_DO_SELO_MAX).trim()
  if (!ehNomeDeSelo(nome)) return null
  if (selo.turnos !== null && (!Number.isInteger(selo.turnos) || selo.turnos < 1 || selo.turnos > TURNOS_DO_SELO_MAX)) return null
  const mods = modsValidos(selo.mods, sistema)
  return mods.length === 0 ? { nome, turnos: selo.turnos } : { nome, turnos: selo.turnos, mods }
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
  return { nome: nomeDoSelo(normal, nomeDaTecnica), turnos }
}

/** O nome do selo: a primeira palavra-chave do texto (já normalizado); nenhuma = o nome da técnica no teto. */
function nomeDoSelo(normal: string, nomeDaTecnica: string): string {
  let achado: { indice: number; nome: string } | null = null
  for (const { sinal, nome } of PALAVRAS_DO_SELO) {
    const indice = normal.search(sinal)
    if (indice !== -1 && (achado === null || indice < achado.indice)) achado = { indice, nome }
  }
  const nome = achado?.nome ?? (nomeDaTecnica.replace(/\s+/g, ' ').trim().slice(0, NOME_DO_SELO_MAX).trim() || NOME_DO_SELO_PADRAO)
  return ehNomeDeSelo(nome) ? nome : NOME_DO_SELO_PADRAO
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
 * nesta rodada): "Atordoado 1" vale a próxima vez inteira dela. Mods,
 * natureza (fora "condicao", que é a ausência) e cartaoId vêm do pedido.
 */
export function criarSelo(tokenId: string, pedido: SeloDoGolpe, onde: OndeNasceOSelo): SeloDaBatalha {
  const selo: SeloDaBatalha = { id: onde.id, tokenId, nome: pedido.nome, turnos: pedido.turnos, total: pedido.turnos }
  if (pedido.mods !== undefined && pedido.mods.length > 0) selo.mods = pedido.mods
  if (pedido.natureza !== undefined && pedido.natureza !== 'condicao') selo.natureza = pedido.natureza
  if (pedido.cartaoId !== undefined) selo.cartaoId = pedido.cartaoId
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

/** A soma de um alvo do bônus; sem selo, 0. As partes com o nome de cada selo: `partesDoBonus` (combate.ts). */
export function totalDoBonus(bonus: BonusDaBatalha | undefined, alvo: string): number {
  return partesDoBonus(bonus, alvo).reduce((soma, parte) => soma + parte.delta, 0)
}

/** O modificador inicial da caixa de reação: a soma do "reacao", no teto do modificador (o campo segue editável). */
export function bonusDaReacao(bonus: BonusDaBatalha | undefined): number {
  return Math.max(-MODIFICADOR_DA_REACAO_MAX, Math.min(MODIFICADOR_DA_REACAO_MAX, totalDoBonus(bonus, ALVO_DA_REACAO)))
}

/** Um alvo que a linha "atributo / delta" oferece. `curto` = o da pílula ("FOR +20"). */
export interface AlvoDeMod {
  id: string
  rotulo: string
  curto: string
}

/** As opções da linha "atributo / delta" (mira e "Pôr selo..."): os atributos do sistema, Dano e Reação. */
export function alvosDeMod(sistema: SistemaDeRpg | null): AlvoDeMod[] {
  const atributos = (sistema?.atributos ?? []).map((atributo): AlvoDeMod => ({ id: atributo.id, rotulo: atributo.nome, curto: atributo.abreviacao || atributo.nome }))
  return [...atributos, { id: ALVO_DO_DANO, rotulo: 'Dano', curto: 'Dano' }, { id: ALVO_DA_REACAO, rotulo: 'Reação', curto: 'Reação' }]
}

/** Os mods que valem: alvo de `alvosDeMod`, delta inteiro e não 0 dentro de ±`DANO_MAX`, até `MODS_POR_SELO_MAX`. O resto sai calado. */
export function modsValidos(mods: readonly ModDoSelo[] | undefined, sistema: SistemaDeRpg | null): ModDoSelo[] {
  const alvos = new Set(alvosDeMod(sistema).map((alvo) => alvo.id))
  return (mods ?? [])
    .filter((mod) => alvos.has(mod.alvo) && Number.isInteger(mod.delta) && mod.delta !== 0 && Math.abs(mod.delta) <= DANO_MAX)
    .slice(0, MODS_POR_SELO_MAX)
    .map((mod) => ({ alvo: mod.alvo, delta: mod.delta }))
}

function comSinal(numero: number): string {
  return numero < 0 ? String(numero) : `+${numero}`
}

/** "FOR +20", "Dano +30", "Reação -2". Alvo fora do sistema: o próprio id. */
export function textoDoMod(mod: ModDoSelo, sistema: SistemaDeRpg | null): string {
  const alvo = alvosDeMod(sistema).find((candidato) => candidato.id === mod.alvo)
  return `${alvo?.curto ?? mod.alvo} ${comSinal(mod.delta)}`
}

/** "FOR +20, Dano +30" (o título da pílula); sem mods, vazio. */
export function textoDosMods(mods: readonly ModDoSelo[] | undefined, sistema: SistemaDeRpg | null): string {
  return (mods ?? []).map((mod) => textoDoMod(mod, sistema)).join(', ')
}

/** "Fúria 2 (FOR +20)", "Cego" (sem mods, como `textoDoSelo`): o selo na linha do registro. */
export function textoDoSeloComMods(selo: Pick<SeloDaBatalha, 'nome' | 'turnos' | 'mods'>, sistema: SistemaDeRpg | null): string {
  const mods = textoDosMods(selo.mods, sistema)
  return mods.length === 0 ? textoDoSelo(selo) : `${textoDoSelo(selo)} (${mods})`
}

/** Os mesmos mods, na mesma ordem (ausente = lista vazia). */
export function modsIguais(a: readonly ModDoSelo[] | undefined, b: readonly ModDoSelo[] | undefined): boolean {
  const [x, y] = [a ?? [], b ?? []]
  return x.length === y.length && x.every((mod, i) => mod.alvo === y[i]?.alvo && mod.delta === y[i]?.delta)
}

/**
 * O selo editado pelo mestre: nome, turnos e mods novos (o `total` passa a
 * ser os turnos novos; a marca "já contou nesta rodada" fica). O selo de
 * técnica guarda a cor do Tipo; o posto à mão segue o sinal dos mods novos.
 */
export function seloEditado(antes: SeloDaBatalha, pedido: SeloPedido): SeloDaBatalha {
  const depois: SeloDaBatalha = { ...antes, nome: pedido.nome, turnos: pedido.turnos, total: pedido.turnos }
  delete depois.mods
  delete depois.natureza
  if (pedido.mods !== undefined && pedido.mods.length > 0) depois.mods = pedido.mods
  const natureza = antes.cartaoId !== undefined ? antes.natureza : naturezaDosMods(pedido.mods)
  if (natureza !== undefined && natureza !== 'condicao') depois.natureza = natureza
  return depois
}

/**
 * A cor do selo que o MESTRE põe à mão: só somas = buff, só perdas = debuff;
 * sem mods ou misturado = condição (ausente). O selo de técnica leva a do
 * Tipo (`naturezaDoTipo`).
 */
export function naturezaDosMods(mods: readonly ModDoSelo[] | undefined): NaturezaDoSelo | undefined {
  if (mods === undefined || mods.length === 0) return undefined
  if (mods.every((mod) => mod.delta > 0)) return 'buff'
  if (mods.every((mod) => mod.delta < 0)) return 'debuff'
  return undefined
}

// ---- lerMods: o texto do Efeito vira linhas "atributo / delta" (sugestão editável, nunca aplicada escondida) ----

/** Entre o número e o alvo: "+20 de Força", "+3 na reação", "+8 em reação", "+20 pontos de Força". */
const LIGA_DO_ALVO = String.raw`(?: pontos?)? (?:(?:de|em|na|no|nos|nas|a|ao|do|da) )?`
/** Número inteiro sem porcentagem logo depois ("+20%" e "+1,5" não são mod). */
const INTEIRO = String.raw`(\d+)(?![.,]\d)(?! ?%)`
/** "ganha", "ganhando", "recebe", "aumenta", "soma", "perde", "reduz", "diminui", "tira". */
const VERBO = '(ganh|receb|aument|soma|adicion|perd|reduz|diminu|tira|subtra)'
const VERBO_QUE_TIRA = /^(?:perd|reduz|diminu|tira|subtra)/

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** O alvo como o texto (normalizado) o escreve e o id dele: nome, abreviação ou id do atributo; "dano"; "reação" ou "dado de reação". */
interface AlvosDoTexto {
  padrao: string
  idDe: (escrito: string) => string | null
}

function alvosDoTexto(sistema: SistemaDeRpg): AlvosDoTexto {
  const porEscrita = new Map<string, string>()
  for (const atributo of sistema.atributos) {
    for (const escrita of [atributo.nome, atributo.abreviacao, atributo.id]) {
      const normal = normalizar(escrita)
      if (normal.length > 0 && !porEscrita.has(normal)) porEscrita.set(normal, atributo.id)
    }
  }
  // O mais comprido primeiro: "forca" antes de "for".
  const escritas = [...porEscrita.keys()].sort((a, b) => b.length - a.length).map(escaparRegex)
  const padrao = ['(?:(?:o |no |do )?dado de )?reac(?:ao|oes)', 'danos?', ...escritas].join('|')
  return {
    padrao,
    idDe: (escrito) => (/reac/.test(escrito) ? ALVO_DA_REACAO : /^danos?$/.test(escrito) ? ALVO_DO_DANO : (porEscrita.get(escrito) ?? null)),
  }
}

interface ModAchado {
  inicio: number
  fim: number
  mod: ModDoSelo
}

/** Um mod achado, se o número cabe no teto e o alvo existe. */
function achado(alvos: AlvosDoTexto, inicio: number, fim: number, escrito: string, numero: string, negativo: boolean): ModAchado | null {
  const alvo = alvos.idDe(escrito)
  const valor = Number.parseInt(numero, 10)
  if (alvo === null || !(valor > 0) || valor > DANO_MAX) return null
  return { inicio, fim, mod: { alvo, delta: negativo ? -valor : valor } }
}

/** Todas as ocorrências de `regex` (com /g) em `texto`. */
function ocorrencias(regex: RegExp, texto: string): RegExpExecArray[] {
  const lista: RegExpExecArray[] = []
  for (let achou = regex.exec(texto); achou !== null; achou = regex.exec(texto)) lista.push(achou)
  return lista
}

/** "+20 de Força", "-15 de Agilidade", "+3 na reação", "+30 de dano". Depois de atributo, número ou ")" é conta ("Força + 45 de dano"): não é mod. */
function comSinalAntes(normal: string, alvos: AlvosDoTexto): ModAchado[] {
  const conta = new RegExp(String.raw`(?:\d|\)|\b(?:${alvos.padrao}))$`)
  const regex = new RegExp(String.raw`([+-]) ?${INTEIRO}${LIGA_DO_ALVO}\b(${alvos.padrao})\b`, 'g')
  return ocorrencias(regex, normal).flatMap((m) => {
    const [, sinal = '+', numero = '', escrito = ''] = m
    if (conta.test(normal.slice(0, m.index).trimEnd())) return []
    return achado(alvos, m.index, m.index + m[0].length, escrito, numero, sinal === '-') ?? []
  })
}

/** "perde 15 de Agilidade", "ganhando 10 de força". "Recebe 40 de dano" é tomar dano, não mod. */
function comVerbo(normal: string, alvos: AlvosDoTexto): ModAchado[] {
  const regex = new RegExp(String.raw`\b${VERBO}\w* (?:(?:mais|menos|ate|em) )?${INTEIRO}${LIGA_DO_ALVO}\b(${alvos.padrao})\b`, 'g')
  return ocorrencias(regex, normal).flatMap((m) => {
    const [, verbo = '', numero = '', escrito = ''] = m
    if (verbo === 'receb' && alvos.idDe(escrito) === ALVO_DO_DANO) return []
    return achado(alvos, m.index, m.index + m[0].length, escrito, numero, VERBO_QUE_TIRA.test(verbo)) ?? []
  })
}

/** "FOR +20", "Agilidade: -15": o sinal colado no número. Seguido de outro alvo ("FOR +20 de dano") é conta. */
function comAlvoAntes(normal: string, alvos: AlvosDoTexto): ModAchado[] {
  const regex = new RegExp(String.raw`\b(${alvos.padrao}):? ?([+-])${INTEIRO}(?! ?(?:(?:de|em|na|no) )?\b(?:${alvos.padrao})\b)`, 'g')
  return ocorrencias(regex, normal).flatMap((m) => {
    const [, escrito = '', sinal = '+', numero = ''] = m
    return achado(alvos, m.index, m.index + m[0].length, escrito, numero, sinal === '-') ?? []
  })
}

/** "reduz a Agilidade em 10", "aumenta o dano em 30". */
function comAlvoNoMeio(normal: string, alvos: AlvosDoTexto): ModAchado[] {
  const regex = new RegExp(String.raw`\b(aument|reduz|diminu|soma)\w* (?:(?:o|a|os|as|sua|seu|suas|seus) )?\b(${alvos.padrao})\b em ${INTEIRO}`, 'g')
  return ocorrencias(regex, normal).flatMap((m) => {
    const [, verbo = '', escrito = '', numero = ''] = m
    return achado(alvos, m.index, m.index + m[0].length, escrito, numero, VERBO_QUE_TIRA.test(verbo)) ?? []
  })
}

/**
 * Os mods que um texto sugere, na ordem do texto, um por alvo (o primeiro),
 * até `MODS_POR_SELO_MAX`. Atributo pelo nome ou pela abreviação do sistema
 * (sem acento nem caixa).
 * Ex. (aceite, seção 4c): "Ganha +20 de Força por 2 turnos" = [forca +20];
 * "O alvo perde 15 de Agilidade durante 3 rodadas" = [agilidade -15]; "+3 na
 * reação" = [reacao +3]; "FOR +20" = [forca +20]; "+30 de dano" = [dano
 * +30]; "Causa 40 de dano" = [] (é dano, não mod). Porcentagem, fração e
 * recurso (SP, HP) ficam de fora. A duração é de `lerDuracao`.
 */
export function lerMods(texto: string, sistema: SistemaDeRpg): ModDoSelo[] {
  const normal = normalizar(texto)
  if (normal.length === 0) return []
  const alvos = alvosDoTexto(sistema)
  const todos = [...comSinalAntes(normal, alvos), ...comVerbo(normal, alvos), ...comAlvoAntes(normal, alvos), ...comAlvoNoMeio(normal, alvos)].sort((a, b) => a.inicio - b.inicio)
  // O mesmo trecho lido por duas regras conta uma vez só (a que começa antes).
  // Um alvo uma vez só: tabela de níveis ("Nível 1: + 10 de dano / Nível 2: + 20...") não vira soma.
  const mods: ModDoSelo[] = []
  let fim = -1
  for (const item of todos) {
    if (item.inicio < fim || mods.some((mod) => mod.alvo === item.mod.alvo)) continue
    mods.push(item.mod)
    fim = item.fim
  }
  return mods.slice(0, MODS_POR_SELO_MAX)
}

/**
 * Buff/Debuff: o selo sugerido com mods. Mods do primeiro campo (Efeito,
 * Descrição) que tem algum; turnos e nome de `seloDaTecnica` ("por N
 * turnos"); sem duração, até tirar com o nome da palavra-chave ou da técnica.
 * Sempre há selo: o Buff sem número ainda marca quem o recebeu.
 */
export function seloComMods(cartao: CartaoDaFicha, sistema: SistemaDeRpg): SeloPedido {
  const textos = CAMPOS_DO_SELO.map((campo) => cartao.campos[campo] ?? '')
  const comMods = textos.find((texto) => lerMods(texto, sistema).length > 0) ?? textos[0] ?? ''
  const mods = lerMods(comMods, sistema)
  const duracao = seloDaTecnica(cartao)
  const selo: SeloPedido = duracao ?? { nome: nomeDoSelo(normalizar(comMods), cartao.nome), turnos: null }
  return mods.length === 0 ? selo : { ...selo, mods }
}
