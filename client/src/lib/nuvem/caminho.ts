import type { CarriedItem } from '../../types/map'
import { ITEM_QUANTIDADE_MAX, readCarriedItems } from '../items'
import { ehImagemDaMesa } from '../midia'
import { personagemDoArquivo } from '../personagem'
import type { CampoDaFichaDBT, CampoExtra, CartaoDaFicha, MarcaDeCombate, Modificador, Personagem } from '../personagem'
import { MOEDAS_MAX } from '../troca'
import { bytesDoJson, bytesDoTexto, CHAVES_PROIBIDAS, ehRegistro, jsonIgual, problemaNoValor, proprio, type Json } from './json'
import type { Acao, MotivoNegado, Mudanca } from './tipos'

/**
 * CAMINHO E ESQUEMA (docs/planos/lobby-jogadores-2026-11-05.md §4.7): a tabela
 * única de campos que uma op pode tocar, com as ações, o tipo, o teto e quem
 * escreve. Op fora da tabela = `negado`. O emissor (app e site) passa cada op
 * por aqui ANTES de aplicar e de pôr na fila; o servidor passa de novo.
 *
 * Regra de ouro dos valores compostos (cartão, item, campos do mestre): o
 * valor tem de ser EXATAMENTE o que o leitor do disco do app leria
 * (`personagemDoArquivo`, `readCarriedItems`). O leitor é tolerante — tira o
 * campo torto em silêncio —, então aqui o que ele mudaria vira recusa: objeto
 * em campo de texto, número que não é finito, chave a mais.
 */

const KIB = 1024

export const TETOS_DO_CAMINHO = {
  segmentos: 24,
  nome: 120,
  descricaoBytes: 16 * KIB,
  etiqueta: 60,
  etiquetas: 30,
  escolha: 200,
  numero: 1e7,
  cartaoBytes: 32 * KIB,
  campoDoCartaoBytes: 8 * KIB,
  itemBytes: 4 * KIB,
  docBytes: 256 * KIB,
  idsNaOrdem: 1000,
} as const

const FORMA_DO_SEGMENTO = /^[A-Za-z0-9_:.#-]{1,80}$/

/** O segmento que troca a ordem de uma lista de cartões. Id de cartão nunca começa com `#`. */
export const ORDEM = '#ordem'

export function segmentoValido(segmento: unknown): segmento is string {
  return typeof segmento === 'string' && FORMA_DO_SEGMENTO.test(segmento) && !CHAVES_PROIBIDAS.has(segmento)
}

function segmentosValidos(caminho: readonly unknown[]): caminho is readonly string[] {
  return caminho.every(segmentoValido)
}

/** Guarda de tipo a partir de uma tabela completa (`Record`): campo novo no tipo do app não compila sem entrar aqui. */
function guardaDe<T extends string>(tabela: Readonly<Record<T, unknown>>): (valor: string) => valor is T {
  return (valor: string): valor is T => Object.hasOwn(tabela, valor)
}

function chavesDe<T extends string>(tabela: Readonly<Record<T, unknown>>, guarda: (valor: string) => valor is T): readonly T[] {
  return Object.keys(tabela).filter(guarda)
}

export type MapaNumerico = 'recursos' | 'maximos' | 'modificadoresDosRecursos' | 'atributos' | 'modificadoresDosAtributos'
const MAPA_NUMERICO: Record<MapaNumerico, true> = {
  recursos: true,
  maximos: true,
  modificadoresDosRecursos: true,
  atributos: true,
  modificadoresDosAtributos: true,
}
const ehMapaNumerico = guardaDe(MAPA_NUMERICO)
export const MAPAS_NUMERICOS = chavesDe(MAPA_NUMERICO, ehMapaNumerico)

/** Partes do cartão trocadas inteiras por `definir`; `imagem`, `campos` e `subcartoes` têm caminho próprio. */
export type CampoSimplesDoCartao = Exclude<keyof CartaoDaFicha, 'id' | 'imagem' | 'campos' | 'subcartoes'>
const CAMPO_SIMPLES_DO_CARTAO: Record<CampoSimplesDoCartao, true> = { nome: true, aMao: true, extras: true, modificadores: true, atributos: true }
const ehCampoSimplesDoCartao = guardaDe(CAMPO_SIMPLES_DO_CARTAO)
export const CAMPOS_SIMPLES_DO_CARTAO = chavesDe(CAMPO_SIMPLES_DO_CARTAO, ehCampoSimplesDoCartao)

/** Partes do item trocadas por `definir`; a `quantidade` soma. */
export type CampoDoItem = Exclude<keyof CarriedItem, 'id' | 'quantidade'>
const CAMPO_DO_ITEM: Record<CampoDoItem, true> = {
  nome: true,
  itemId: true,
  imagem: true,
  descricao: true,
  categoria: true,
  preco: true,
  empilhavel: true,
}
const ehCampoDoItem = guardaDe(CAMPO_DO_ITEM)
export const CAMPOS_DO_ITEM = chavesDe(CAMPO_DO_ITEM, ehCampoDoItem)

/** Só do mestre e nunca difundidos ao jogador (§6.4). */
export type CampoDoMestre = 'dono' | 'combate' | 'soCenario' | 'nomeDoJogador' | 'notaDoMestre'
const CAMPO_DO_MESTRE: Record<CampoDoMestre, true> = { dono: true, combate: true, soCenario: true, nomeDoJogador: true, notaDoMestre: true }
const ehCampoDoMestre = guardaDe(CAMPO_DO_MESTRE)
export const CAMPOS_DO_MESTRE = chavesDe(CAMPO_DO_MESTRE, ehCampoDoMestre)

/** O tipo de cada campo de topo da ficha Dragon Ball; o detalhe é conferido pelo leitor dela ao aplicar. */
type TipoDoCampoDbt = 'texto' | 'numero' | 'lista' | 'registro' | 'textoOuNulo' | 'registroOuNulo'
const TIPO_DO_CAMPO_DBT: Record<CampoDaFichaDBT, TipoDoCampoDbt> = {
  raca: 'texto',
  variante: 'texto',
  racaLivre: 'registroOuNulo',
  pdl: 'numero',
  epInicial: 'numero',
  aumentos: 'lista',
  periciasTreinadas: 'lista',
  talentos: 'lista',
  movimentos: 'lista',
  tecnicas: 'lista',
  transformacoes: 'lista',
  transformacaoAtiva: 'textoOuNulo',
  inventario: 'lista',
  caracteristicas: 'lista',
  contadores: 'lista',
  tamanho: 'texto',
  idade: 'texto',
  personalidade: 'texto',
  historia: 'texto',
  notas: 'texto',
  kiBloqueado: 'numero',
  ajustes: 'registro',
  npc: 'registro',
}
const ehCampoDbt = guardaDe(TIPO_DO_CAMPO_DBT)
export const CAMPOS_DBT = chavesDe(TIPO_DO_CAMPO_DBT, ehCampoDbt)

export type NomeDaRegra =
  | 'ficha'
  | 'texto'
  | 'retrato'
  | 'etiqueta'
  | 'escolha'
  | 'numero'
  | 'cartaoAtivo'
  | 'cartao'
  | 'ordemDosCartoes'
  | 'campoDoCartao'
  | 'imagemDoCartao'
  | 'textoDoCartao'
  | 'vaga'
  | 'quantidade'
  | 'campoDoItem'
  | 'moedas'
  | 'dbt'
  | 'npcDoDbt'
  | 'doMestre'

/** `donoOuMestre`: o dono da ficha (qualquer conta dele) e o mestre. Ficha sem dono: só o mestre (§6.4, permissão na N2). */
export type QuemEscreve = 'mestre' | 'donoOuMestre'

export interface RegraDoEsquema {
  /** O caminho como na tabela 4.7, para a mensagem de recusa. */
  caminho: string
  acoes: readonly Acao[]
  quem: QuemEscreve
  /** `false` = a projeção do jogador tira (§6.4). */
  visivelAoJogador: boolean
}

/**
 * A tabela 4.7. Desvios dela, todos para o desfazer (§5.3) funcionar:
 * `quantidade` e `moedas` também aceitam `definir` (a volta de uma soma que o
 * teto cortou), e `definir` sem valor tira a chave (a volta de um campo que
 * não existia). Imagem (retrato e cartão) é só do mestre na v1 (pergunta 12.4).
 */
export const ESQUEMA_DO_CAMINHO: Readonly<Record<NomeDaRegra, RegraDoEsquema>> = {
  ficha: { caminho: '[]', acoes: ['criar', 'apagar'], quem: 'mestre', visivelAoJogador: true },
  texto: { caminho: "['nome'] | ['descricao']", acoes: ['definir'], quem: 'donoOuMestre', visivelAoJogador: true },
  retrato: { caminho: "['retrato']", acoes: ['definir'], quem: 'mestre', visivelAoJogador: true },
  etiqueta: { caminho: "['etiquetas', chaveDaEtiqueta]", acoes: ['criar', 'apagar'], quem: 'donoOuMestre', visivelAoJogador: true },
  escolha: { caminho: "['escolhas', k]", acoes: ['definir'], quem: 'donoOuMestre', visivelAoJogador: true },
  numero: { caminho: "['recursos' | 'maximos' | 'modificadoresDosRecursos' | 'atributos' | 'modificadoresDosAtributos', k]", acoes: ['definir'], quem: 'donoOuMestre', visivelAoJogador: true },
  cartaoAtivo: { caminho: "['cartoesAtivos', cartaoId]", acoes: ['definir'], quem: 'donoOuMestre', visivelAoJogador: true },
  cartao: { caminho: "['abas', aba, cartaoId]", acoes: ['criar', 'apagar'], quem: 'donoOuMestre', visivelAoJogador: true },
  ordemDosCartoes: { caminho: "['abas', aba, '#ordem']", acoes: ['ordenar'], quem: 'donoOuMestre', visivelAoJogador: true },
  campoDoCartao: { caminho: "['abas', aba, cartaoId, 'nome' | 'aMao' | 'extras' | 'modificadores' | 'atributos']", acoes: ['definir'], quem: 'donoOuMestre', visivelAoJogador: true },
  imagemDoCartao: { caminho: "['abas', aba, cartaoId, 'imagem']", acoes: ['definir'], quem: 'mestre', visivelAoJogador: true },
  textoDoCartao: { caminho: "['abas', aba, cartaoId, 'campos', campoId]", acoes: ['definir'], quem: 'donoOuMestre', visivelAoJogador: true },
  vaga: { caminho: "['mochila', vagaId]", acoes: ['criar', 'apagar'], quem: 'donoOuMestre', visivelAoJogador: true },
  quantidade: { caminho: "['mochila', vagaId, 'quantidade']", acoes: ['somar', 'definir'], quem: 'donoOuMestre', visivelAoJogador: true },
  campoDoItem: { caminho: "['mochila', vagaId, campo]", acoes: ['definir'], quem: 'donoOuMestre', visivelAoJogador: true },
  moedas: { caminho: "['moedas']", acoes: ['somar', 'definir'], quem: 'donoOuMestre', visivelAoJogador: true },
  dbt: { caminho: "['dbt', chaveDeTopo]", acoes: ['definir'], quem: 'donoOuMestre', visivelAoJogador: true },
  npcDoDbt: { caminho: "['dbt', 'npc']", acoes: ['definir'], quem: 'mestre', visivelAoJogador: false },
  doMestre: { caminho: "['dono'] | ['combate'] | ['soCenario'] | ['nomeDoJogador'] | ['notaDoMestre']", acoes: ['definir'], quem: 'mestre', visivelAoJogador: false },
}

/**
 * Onde o caminho aponta. Nos cartões, `trilha` são os ids do cartão de cima
 * até o alvo (subcartões no meio); na ordem, os ids do cartão dono da lista
 * (vazia = a lista da aba).
 */
export type Alvo =
  | { regra: 'ficha' }
  | { regra: 'texto'; campo: 'nome' | 'descricao' }
  | { regra: 'retrato' }
  | { regra: 'etiqueta'; chave: string }
  | { regra: 'escolha'; chave: string }
  | { regra: 'numero'; mapa: MapaNumerico; chave: string }
  | { regra: 'cartaoAtivo'; cartaoId: string }
  | { regra: 'cartao'; aba: string; trilha: string[] }
  | { regra: 'ordemDosCartoes'; aba: string; trilha: string[] }
  | { regra: 'campoDoCartao'; aba: string; trilha: string[]; campo: CampoSimplesDoCartao }
  | { regra: 'imagemDoCartao'; aba: string; trilha: string[] }
  | { regra: 'textoDoCartao'; aba: string; trilha: string[]; campoId: string }
  | { regra: 'vaga'; vagaId: string }
  | { regra: 'quantidade'; vagaId: string }
  | { regra: 'campoDoItem'; vagaId: string; campo: CampoDoItem }
  | { regra: 'moedas' }
  | { regra: 'dbt'; campo: CampoDaFichaDBT }
  | { regra: 'npcDoDbt' }
  | { regra: 'doMestre'; campo: CampoDoMestre }

function alvoNaLista(aba: string, dono: readonly string[], resto: readonly string[]): Alvo | null {
  if (resto.length === 0) return null
  const [primeiro, ...depois] = resto
  if (primeiro === ORDEM) return depois.length === 0 ? { regra: 'ordemDosCartoes', aba, trilha: [...dono] } : null
  if (primeiro.startsWith('#')) return null
  const trilha = [...dono, primeiro]
  if (depois.length === 0) return { regra: 'cartao', aba, trilha }
  const [campo, ...mais] = depois
  if (campo === 'subcartoes') return alvoNaLista(aba, trilha, mais)
  if (campo === 'campos') return mais.length === 1 ? { regra: 'textoDoCartao', aba, trilha, campoId: mais[0] } : null
  if (mais.length > 0) return null
  if (campo === 'imagem') return { regra: 'imagemDoCartao', aba, trilha }
  return ehCampoSimplesDoCartao(campo) ? { regra: 'campoDoCartao', aba, trilha, campo } : null
}

function alvoNaMochila(resto: readonly string[]): Alvo | null {
  if (resto.length === 0 || resto.length > 2) return null
  const [vagaId, campo] = resto
  if (resto.length === 1) return { regra: 'vaga', vagaId }
  if (campo === 'quantidade') return { regra: 'quantidade', vagaId }
  return ehCampoDoItem(campo) ? { regra: 'campoDoItem', vagaId, campo } : null
}

function alvoNoDbt(resto: readonly string[]): Alvo | null {
  if (resto.length !== 1) return null
  const campo = resto[0]
  if (campo === 'npc') return { regra: 'npcDoDbt' }
  return ehCampoDbt(campo) ? { regra: 'dbt', campo } : null
}

/** Para onde o caminho aponta na tabela 4.7; `null` = fora dela (segmento torto, chave proibida, campo que não existe). */
export function alvoDoCaminho(caminho: readonly unknown[]): Alvo | null {
  if (caminho.length > TETOS_DO_CAMINHO.segmentos || !segmentosValidos(caminho)) return null
  if (caminho.length === 0) return { regra: 'ficha' }
  const [topo, ...resto] = caminho
  const umaChave = resto.length === 1 ? resto[0] : undefined
  switch (topo) {
    case 'nome':
    case 'descricao':
      return resto.length === 0 ? { regra: 'texto', campo: topo } : null
    case 'retrato':
      return resto.length === 0 ? { regra: 'retrato' } : null
    case 'moedas':
      return resto.length === 0 ? { regra: 'moedas' } : null
    case 'etiquetas':
      return umaChave === undefined ? null : { regra: 'etiqueta', chave: umaChave }
    case 'escolhas':
      return umaChave === undefined ? null : { regra: 'escolha', chave: umaChave }
    case 'cartoesAtivos':
      return umaChave === undefined ? null : { regra: 'cartaoAtivo', cartaoId: umaChave }
    case 'abas':
      return resto.length >= 2 ? alvoNaLista(resto[0], [], resto.slice(1)) : null
    case 'mochila':
      return alvoNaMochila(resto)
    case 'dbt':
      return alvoNoDbt(resto)
    default:
      if (ehMapaNumerico(topo)) return umaChave === undefined ? null : { regra: 'numero', mapa: topo, chave: umaChave }
      if (ehCampoDoMestre(topo)) return resto.length === 0 ? { regra: 'doMestre', campo: topo } : null
      return null
  }
}

/** Quem pode escrever no caminho; `null` = caminho fora da tabela. */
export function quemEscreve(caminho: readonly unknown[]): QuemEscreve | null {
  const alvo = alvoDoCaminho(caminho)
  return alvo === null ? null : ESQUEMA_DO_CAMINHO[alvo.regra].quem
}

// ───────────────────────────────────────────────────────────────────────────
// Etiqueta: texto livre ("Chapéu de Palha") não cabe no segmento
// ───────────────────────────────────────────────────────────────────────────

const FNV_PRIMO = 0x01000193
const FNV_BASE = 0x811c9dc5
/** Segunda base, para 64 bits de chave com duas passadas de 32: com até 30 etiquetas, colisão não acontece na prática. */
const FNV_BASE_2 = 0x2b4e8f13

function fnv1a(texto: string, base: number): string {
  let hash = base
  for (let indice = 0; indice < texto.length; indice++) {
    hash ^= texto.charCodeAt(indice)
    hash = Math.imul(hash, FNV_PRIMO)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/**
 * O segmento de uma etiqueta. A tabela 4.7 diz `['etiquetas', etiqueta]`, mas
 * a etiqueta tem acento e espaço, que o segmento não aceita: o caminho leva o
 * hash do texto, e o `criar` leva o texto no valor (o servidor confere que batem).
 */
export function chaveDaEtiqueta(etiqueta: string): string {
  return `et_${fnv1a(etiqueta, FNV_BASE)}${fnv1a(etiqueta, FNV_BASE_2)}`
}

// ───────────────────────────────────────────────────────────────────────────
// Leitura da mudança: caminho + ação + valor já com o tipo do app
// ───────────────────────────────────────────────────────────────────────────

export type MudancaNoCartao =
  | { campo: 'nome'; valor: string }
  | { campo: 'aMao'; valor: true | undefined }
  | { campo: 'extras'; valor: CampoExtra[] }
  | { campo: 'modificadores'; valor: Modificador[] }
  | { campo: 'atributos'; valor: string[] }

export type MudancaDoMestre =
  | { campo: 'dono'; valor: string | undefined }
  | { campo: 'combate'; valor: MarcaDeCombate | undefined }
  | { campo: 'soCenario'; valor: true | undefined }
  | { campo: 'nomeDoJogador'; valor: string | undefined }
  | { campo: 'notaDoMestre'; valor: string | undefined }

/** A mudança conferida, com o valor no tipo do app: `aplicar` não precisa de cast. */
export type MudancaLida =
  | { regra: 'ficha'; acao: 'criar'; doc: Personagem }
  | { regra: 'ficha'; acao: 'apagar' }
  | { regra: 'texto'; campo: 'nome' | 'descricao'; valor: string }
  | { regra: 'retrato'; valor: string | null }
  | { regra: 'etiqueta'; acao: 'criar'; chave: string; texto: string }
  | { regra: 'etiqueta'; acao: 'apagar'; chave: string }
  | { regra: 'escolha'; chave: string; valor: string | undefined }
  | { regra: 'numero'; mapa: MapaNumerico; chave: string; valor: number | undefined }
  | { regra: 'cartaoAtivo'; cartaoId: string; valor: boolean }
  | { regra: 'cartao'; acao: 'criar'; aba: string; trilha: string[]; cartao: CartaoDaFicha }
  | { regra: 'cartao'; acao: 'apagar'; aba: string; trilha: string[] }
  | { regra: 'ordemDosCartoes'; aba: string; trilha: string[]; ids: string[] }
  | { regra: 'campoDoCartao'; aba: string; trilha: string[]; mudar: MudancaNoCartao }
  | { regra: 'imagemDoCartao'; aba: string; trilha: string[]; valor: string | null }
  | { regra: 'textoDoCartao'; aba: string; trilha: string[]; campoId: string; valor: string | undefined }
  | { regra: 'vaga'; acao: 'criar'; item: CarriedItem }
  | { regra: 'vaga'; acao: 'apagar'; vagaId: string }
  | { regra: 'quantidade'; vagaId: string; acao: 'somar'; delta: number }
  | { regra: 'quantidade'; vagaId: string; acao: 'definir'; valor: number }
  | { regra: 'campoDoItem'; vagaId: string; campo: CampoDoItem; valor: Json | undefined }
  | { regra: 'moedas'; acao: 'somar'; delta: number }
  | { regra: 'moedas'; acao: 'definir'; valor: number }
  | { regra: 'dbt'; campo: CampoDaFichaDBT; valor: Json | undefined }
  | { regra: 'doMestre'; mudar: MudancaDoMestre }

export interface RecusaDoEsquema {
  ok: false
  motivo: MotivoNegado
  /** Em português, para a tela ("Texto grande demais: máximo 16 KiB"). */
  detalhe: string
}

export type LeituraDaMudanca = { ok: true; lida: MudancaLida } | RecusaDoEsquema

function recusa(motivo: MotivoNegado, detalhe: string): RecusaDoEsquema {
  return { ok: false, motivo, detalhe }
}

function aceita(lida: MudancaLida): LeituraDaMudanca {
  return { ok: true, lida }
}

const FORA_DO_FORMATO = 'Valor fora do formato deste campo'

/** O último id da trilha: o cartão alvo. */
function ultimo(trilha: readonly string[]): string | undefined {
  return trilha[trilha.length - 1]
}

/**
 * Confere uma mudança contra a tabela 4.7, sem olhar a ficha: segmento,
 * campo, ação, tipo e teto. O que depende da ficha (o cartão existe? a soma
 * passa do teto?) é conferido em `aplicar`.
 */
export function lerMudanca(m: Mudanca): LeituraDaMudanca {
  if (!segmentoValido(m.fichaId)) return recusa('fora-do-esquema', 'Ficha sem id válido')
  const alvo = alvoDoCaminho(m.caminho)
  if (alvo === null) return recusa('fora-do-esquema', 'Campo fora da tabela do Lobby')
  const regra = ESQUEMA_DO_CAMINHO[alvo.regra]
  if (!regra.acoes.includes(m.acao)) return recusa('fora-do-esquema', `A ação "${m.acao}" não vale em ${regra.caminho}`)
  if (m.valor !== undefined) {
    const problema = problemaNoValor(m.valor)
    if (problema !== null) return recusa('fora-do-esquema', problema)
  }
  if (m.acao === 'somar') {
    if (m.valor !== undefined || typeof m.delta !== 'number' || !Number.isSafeInteger(m.delta)) return recusa('fora-do-esquema', 'A soma leva só um número inteiro')
    return lerSoma(alvo, m.delta)
  }
  if (m.delta !== undefined) return recusa('fora-do-esquema', 'Só a soma leva número a somar')
  if (m.acao === 'apagar' && m.valor !== undefined) return recusa('fora-do-esquema', 'Apagar não leva valor')
  return lerNoAlvo(m, alvo)
}

function lerSoma(alvo: Alvo, delta: number): LeituraDaMudanca {
  if (alvo.regra === 'quantidade') {
    if (Math.abs(delta) > ITEM_QUANTIDADE_MAX) return recusa('acima-do-teto', `Quantidade grande demais: máximo ${ITEM_QUANTIDADE_MAX}`)
    return aceita({ regra: 'quantidade', vagaId: alvo.vagaId, acao: 'somar', delta })
  }
  if (alvo.regra === 'moedas') {
    if (Math.abs(delta) > MOEDAS_MAX) return recusa('acima-do-teto', `Moedas demais: máximo ${MOEDAS_MAX}`)
    return aceita({ regra: 'moedas', acao: 'somar', delta })
  }
  return recusa('fora-do-esquema', 'Este campo não soma')
}

function lerNoAlvo(m: Mudanca, alvo: Alvo): LeituraDaMudanca {
  const valor = m.valor
  switch (alvo.regra) {
    case 'ficha':
      return lerFicha(m)
    case 'texto':
      return lerTexto(alvo.campo, valor)
    case 'retrato':
      return valor === null || ehImagemDaMesa(valor) ? aceita({ regra: 'retrato', valor }) : recusa('fora-do-esquema', 'Imagem que não é da mesa')
    case 'etiqueta':
      return lerEtiqueta(m.acao, alvo.chave, valor)
    case 'escolha':
      if (valor !== undefined && typeof valor !== 'string') return recusa('fora-do-esquema', FORA_DO_FORMATO)
      if (valor !== undefined && valor.length > TETOS_DO_CAMINHO.escolha) return recusa('acima-do-teto', `Texto grande demais: máximo ${TETOS_DO_CAMINHO.escolha} letras`)
      return aceita({ regra: 'escolha', chave: alvo.chave, valor })
    case 'numero':
      if (valor !== undefined && (typeof valor !== 'number' || !Number.isFinite(valor))) return recusa('fora-do-esquema', 'Esperava um número')
      if (valor !== undefined && Math.abs(valor) > TETOS_DO_CAMINHO.numero) return recusa('acima-do-teto', 'Número grande demais: máximo 10.000.000')
      return aceita({ regra: 'numero', mapa: alvo.mapa, chave: alvo.chave, valor })
    case 'cartaoAtivo':
      return typeof valor === 'boolean' ? aceita({ regra: 'cartaoAtivo', cartaoId: alvo.cartaoId, valor }) : recusa('fora-do-esquema', 'Esperava ligado ou desligado')
    case 'cartao':
      return m.acao === 'criar' ? lerCartaoNovo(alvo.aba, alvo.trilha, valor) : aceita({ regra: 'cartao', acao: 'apagar', aba: alvo.aba, trilha: alvo.trilha })
    case 'ordemDosCartoes':
      return lerOrdem(alvo.aba, alvo.trilha, valor)
    case 'campoDoCartao':
      return lerCampoDoCartao(alvo.aba, alvo.trilha, alvo.campo, valor)
    case 'imagemDoCartao':
      return valor === null || ehImagemDaMesa(valor)
        ? aceita({ regra: 'imagemDoCartao', aba: alvo.aba, trilha: alvo.trilha, valor })
        : recusa('fora-do-esquema', 'Imagem que não é da mesa')
    case 'textoDoCartao':
      if (valor !== undefined && typeof valor !== 'string') return recusa('fora-do-esquema', FORA_DO_FORMATO)
      if (valor !== undefined && bytesDoTexto(valor) > TETOS_DO_CAMINHO.campoDoCartaoBytes) return recusa('acima-do-teto', 'Texto grande demais: máximo 8 KiB')
      return aceita({ regra: 'textoDoCartao', aba: alvo.aba, trilha: alvo.trilha, campoId: alvo.campoId, valor })
    case 'vaga':
      return m.acao === 'criar' ? lerItemNovo(alvo.vagaId, valor) : aceita({ regra: 'vaga', acao: 'apagar', vagaId: alvo.vagaId })
    case 'quantidade':
      if (typeof valor !== 'number' || !Number.isSafeInteger(valor) || valor < 1) return recusa('fora-do-esquema', 'Quantidade inteira de 1 para cima')
      if (valor > ITEM_QUANTIDADE_MAX) return recusa('acima-do-teto', `Quantidade grande demais: máximo ${ITEM_QUANTIDADE_MAX}`)
      return aceita({ regra: 'quantidade', vagaId: alvo.vagaId, acao: 'definir', valor })
    case 'campoDoItem':
      return lerCampoDoItem(alvo.vagaId, alvo.campo, valor)
    case 'moedas':
      if (typeof valor !== 'number' || !Number.isSafeInteger(valor) || valor < 0) return recusa('fora-do-esquema', 'Moedas: inteiro de 0 para cima')
      if (valor > MOEDAS_MAX) return recusa('acima-do-teto', `Moedas demais: máximo ${MOEDAS_MAX}`)
      return aceita({ regra: 'moedas', acao: 'definir', valor })
    case 'dbt':
      return lerCampoDbt(alvo.campo, valor)
    case 'npcDoDbt':
      return lerCampoDbt('npc', valor)
    case 'doMestre':
      return lerDoMestre(m.fichaId, alvo.campo, valor)
  }
}

function lerFicha(m: Mudanca): LeituraDaMudanca {
  if (m.acao === 'apagar') return aceita({ regra: 'ficha', acao: 'apagar' })
  if (!ehRegistro(m.valor)) return recusa('fora-do-esquema', 'Ficha que não é ficha')
  if (bytesDoJson(m.valor) > TETOS_DO_CAMINHO.docBytes) return recusa('doc-grande', 'Ficha grande demais: máximo 256 KiB')
  // Só o mestre cria ficha: o leitor do disco normaliza (nome aparado, campo torto fora), como ao abrir a pasta.
  const doc = personagemDoArquivo(m.valor)
  if (doc === null || doc.id !== m.fichaId) return recusa('fora-do-esquema', 'A ficha não bate com o id da op')
  return aceita({ regra: 'ficha', acao: 'criar', doc })
}

function lerTexto(campo: 'nome' | 'descricao', valor: Json | undefined): LeituraDaMudanca {
  if (typeof valor !== 'string') return recusa('fora-do-esquema', 'Esperava texto')
  if (campo === 'nome') {
    if (valor.trim() === '') return recusa('fora-do-esquema', 'O nome não pode ficar vazio')
    if (valor.length > TETOS_DO_CAMINHO.nome) return recusa('acima-do-teto', `Nome grande demais: máximo ${TETOS_DO_CAMINHO.nome} letras`)
  } else if (bytesDoTexto(valor) > TETOS_DO_CAMINHO.descricaoBytes) {
    return recusa('acima-do-teto', 'Texto grande demais: máximo 16 KiB')
  }
  return aceita({ regra: 'texto', campo, valor })
}

function lerEtiqueta(acao: Acao, chave: string, valor: Json | undefined): LeituraDaMudanca {
  if (acao === 'apagar') return aceita({ regra: 'etiqueta', acao: 'apagar', chave })
  if (typeof valor !== 'string' || valor.trim() === '') return recusa('fora-do-esquema', 'Etiqueta sem texto')
  if (valor.length > TETOS_DO_CAMINHO.etiqueta) return recusa('acima-do-teto', `Etiqueta grande demais: máximo ${TETOS_DO_CAMINHO.etiqueta} letras`)
  if (chaveDaEtiqueta(valor) !== chave) return recusa('fora-do-esquema', 'A etiqueta não bate com o caminho')
  return aceita({ regra: 'etiqueta', acao: 'criar', chave, texto: valor })
}

function lerOrdem(aba: string, trilha: string[], valor: Json | undefined): LeituraDaMudanca {
  if (!Array.isArray(valor)) return recusa('fora-do-esquema', 'A ordem é uma lista de ids')
  if (valor.length > TETOS_DO_CAMINHO.idsNaOrdem) return recusa('acima-do-teto', `Cartões demais: máximo ${TETOS_DO_CAMINHO.idsNaOrdem}`)
  const ids = valor.filter(segmentoValido)
  if (ids.length !== valor.length || new Set(ids).size !== ids.length) return recusa('fora-do-esquema', 'A ordem tem id torto ou repetido')
  return aceita({ regra: 'ordemDosCartoes', aba, trilha, ids })
}

// ── Cartão: o leitor do disco é o juiz ──────────────────────────────────────

const ABA_DE_LEITURA = 'leitura'
const CARTAO_DE_LEITURA: CartaoDaFicha = { id: 'leitura', nome: 'leitura', campos: {}, extras: [], atributos: [], imagem: null, modificadores: [], subcartoes: [] }

/** O cartão como `personagemDoArquivo` o lê (o leitor de cartão não é exportado); `null` = o leitor não aceita. */
function cartaoPeloLeitor(valor: unknown): CartaoDaFicha | null {
  const lido = personagemDoArquivo({ id: ABA_DE_LEITURA, abas: { [ABA_DE_LEITURA]: [valor] } })
  if (lido === null) return null
  return proprio(lido.abas, ABA_DE_LEITURA)?.[0] ?? null
}

/** O cartão tem de ser endereçável por caminho: ids e chaves de campo no formato do segmento, subcartões sem id repetido. */
function problemaDeEndereco(cartao: CartaoDaFicha): string | null {
  if (!segmentoValido(cartao.id) || cartao.id.startsWith('#')) return 'Cartão com id torto'
  if (!Object.keys(cartao.campos).every(segmentoValido)) return 'Campo do cartão com chave torta'
  if (cartao.nome.length > TETOS_DO_CAMINHO.nome) return 'Nome do cartão grande demais'
  if (new Set(cartao.subcartoes.map((sub) => sub.id)).size !== cartao.subcartoes.length) return 'Subcartão com id repetido'
  for (const sub of cartao.subcartoes) {
    const problema = problemaDeEndereco(sub)
    if (problema !== null) return problema
  }
  return null
}

function lerCartaoNovo(aba: string, trilha: string[], valor: Json | undefined): LeituraDaMudanca {
  const cartao = cartaoPeloLeitor(valor)
  if (cartao === null || !jsonIgual(cartao, valor)) return recusa('fora-do-esquema', 'Cartão fora do formato da ficha')
  if (cartao.id !== ultimo(trilha)) return recusa('fora-do-esquema', 'O cartão não bate com o caminho')
  const problema = problemaDeEndereco(cartao)
  if (problema !== null) return recusa('fora-do-esquema', problema)
  if (bytesDoJson(valor) > TETOS_DO_CAMINHO.cartaoBytes) return recusa('acima-do-teto', 'Cartão grande demais: máximo 32 KiB')
  return aceita({ regra: 'cartao', acao: 'criar', aba, trilha, cartao })
}

function mudancaNoCartao(campo: CampoSimplesDoCartao, valor: Json | undefined): MudancaNoCartao | null {
  const lido = cartaoPeloLeitor({ ...CARTAO_DE_LEITURA, [campo]: valor })
  if (lido === null || !jsonIgual(lido[campo], valor)) return null
  switch (campo) {
    case 'nome':
      return { campo, valor: lido.nome }
    case 'aMao':
      return { campo, valor: lido.aMao }
    case 'extras':
      return { campo, valor: lido.extras }
    case 'modificadores':
      return { campo, valor: lido.modificadores }
    case 'atributos':
      return { campo, valor: lido.atributos }
  }
}

function lerCampoDoCartao(aba: string, trilha: string[], campo: CampoSimplesDoCartao, valor: Json | undefined): LeituraDaMudanca {
  const mudar = mudancaNoCartao(campo, valor)
  if (mudar === null) return recusa('fora-do-esquema', FORA_DO_FORMATO)
  if (mudar.campo === 'nome' && mudar.valor.length > TETOS_DO_CAMINHO.nome) return recusa('acima-do-teto', `Nome grande demais: máximo ${TETOS_DO_CAMINHO.nome} letras`)
  if (bytesDoJson(valor) > TETOS_DO_CAMINHO.cartaoBytes) return recusa('acima-do-teto', 'Cartão grande demais: máximo 32 KiB')
  return aceita({ regra: 'campoDoCartao', aba, trilha, mudar })
}

// ── Item da mochila: `readCarriedItems` é o juiz ────────────────────────────

/** O item como a mochila do disco o lê; `null` = o leitor não aceita. */
export function itemPeloLeitor(valor: unknown): CarriedItem | null {
  return readCarriedItems([valor])?.[0] ?? null
}

function lerItemNovo(vagaId: string, valor: Json | undefined): LeituraDaMudanca {
  const item = itemPeloLeitor(valor)
  if (item === null || !jsonIgual(item, valor)) return recusa('fora-do-esquema', 'Item fora do formato da mochila')
  if (item.id !== vagaId) return recusa('fora-do-esquema', 'O item não bate com o caminho')
  if (bytesDoJson(valor) > TETOS_DO_CAMINHO.itemBytes) return recusa('acima-do-teto', 'Item grande demais: máximo 4 KiB')
  return aceita({ regra: 'vaga', acao: 'criar', item })
}

function lerCampoDoItem(vagaId: string, campo: CampoDoItem, valor: Json | undefined): LeituraDaMudanca {
  const lido = itemPeloLeitor({ id: 'leitura', nome: 'leitura', [campo]: valor })
  if (lido === null || !jsonIgual(lido[campo], valor)) return recusa('fora-do-esquema', FORA_DO_FORMATO)
  if (bytesDoJson(valor) > TETOS_DO_CAMINHO.itemBytes) return recusa('acima-do-teto', 'Item grande demais: máximo 4 KiB')
  return aceita({ regra: 'campoDoItem', vagaId, campo, valor })
}

// ── Dragon Ball e campos do mestre ──────────────────────────────────────────

function valorDoTipo(tipo: TipoDoCampoDbt, valor: Json): boolean {
  switch (tipo) {
    case 'texto':
      return typeof valor === 'string'
    case 'numero':
      return typeof valor === 'number'
    case 'lista':
      return Array.isArray(valor)
    case 'registro':
      return ehRegistro(valor)
    case 'textoOuNulo':
      return valor === null || typeof valor === 'string'
    case 'registroOuNulo':
      return valor === null || ehRegistro(valor)
  }
}

/** Só o tipo de topo; o leitor da ficha Dragon Ball confere o resto ao aplicar, contra a ficha de agora. */
function lerCampoDbt(campo: CampoDaFichaDBT, valor: Json | undefined): LeituraDaMudanca {
  // Só o bloco do NPC pode sumir (a ficha de jogador não o tem); os outros campos existem sempre.
  const podeFaltar = campo === 'npc'
  if (valor === undefined ? !podeFaltar : !valorDoTipo(TIPO_DO_CAMPO_DBT[campo], valor)) return recusa('fora-do-esquema', FORA_DO_FORMATO)
  if (bytesDoJson(valor) > TETOS_DO_CAMINHO.docBytes) return recusa('doc-grande', 'Ficha grande demais: máximo 256 KiB')
  return aceita({ regra: 'dbt', campo, valor })
}

/** Campo do mestre pelo leitor do disco: o que ele não guardaria igual (dono torto, nota em branco, força fora do passo) é recusado. */
function mudancaDoMestre(fichaId: string, campo: CampoDoMestre, valor: Json | undefined): MudancaDoMestre | null {
  const lido = personagemDoArquivo({ id: fichaId, [campo]: valor })
  if (lido === null || !jsonIgual(lido[campo], valor)) return null
  switch (campo) {
    case 'dono':
      return { campo, valor: lido.dono }
    case 'combate':
      return { campo, valor: lido.combate }
    case 'soCenario':
      return { campo, valor: lido.soCenario }
    case 'nomeDoJogador':
      return { campo, valor: lido.nomeDoJogador }
    case 'notaDoMestre':
      return { campo, valor: lido.notaDoMestre }
  }
}

function lerDoMestre(fichaId: string, campo: CampoDoMestre, valor: Json | undefined): LeituraDaMudanca {
  const mudar = mudancaDoMestre(fichaId, campo, valor)
  return mudar === null ? recusa('fora-do-esquema', FORA_DO_FORMATO) : aceita({ regra: 'doMestre', mudar })
}
