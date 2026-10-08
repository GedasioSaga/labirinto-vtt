import { isTokenPhotoData } from './tokenPhoto'
import type { AbaDoSistema, SistemaDeRpg } from './sistemaDeRpg'

/**
 * PERSONAGEM e a FICHA DE PERSONAGEM dele — não confundir com "ficha", que
 * neste código é o TOKEN no mapa. O personagem mora na AVENTURA
 * (`Adventure.personagens`, lib/adventure.ts), não na cena: ele cruza cenas,
 * e o token que o representa num mapa aponta para ele por `Token.characterId`.
 *
 * A forma é genérica: números e textos guardados pela CHAVE que o sistema de
 * RPG define (`lib/sistemaDeRpg.ts`). Trocar o sistema da aventura não apaga
 * nada — o que o sistema novo não conhece só deixa de aparecer.
 *
 * Só do mestre: a aventura nunca vai pela rede, e o recorte do jogador
 * (`lib/fogFilter.ts`, `tokenForPlayer`) zera o `characterId` do token. A
 * entrega 2 (jogador vê e edita a ficha dele) decide o que sai daqui.
 */

export type TipoDePersonagem = 'jogador' | 'npc'

/** Linha livre "nome: valor" do cartão (os campos extras da técnica). */
export interface CampoExtra {
  nome: string
  valor: string
}

/** Pontos que um cartão soma ou tira de um atributo (a transformação). */
export interface Modificador {
  atributo: string
  delta: number
}

/**
 * Um cartão de uma aba. Todas as partes existem sempre, vazias quando a aba
 * não as usa: a ficha guarda o que vier e o molde da aba (`AbaDoSistema`)
 * decide o que aparece. Assim a tela nunca precisa perguntar "tem o campo?".
 */
export interface CartaoDaFicha {
  id: string
  nome: string
  /** Valor de cada campo da aba, pela chave do campo (`CampoDoCartao.id`). */
  campos: Record<string, string>
  extras: CampoExtra[]
  /** Ids de atributos do sistema (a perícia). */
  atributos: string[]
  /** Imagem pequena embutida (`data:image/...`), como a foto do token. */
  imagem: string | null
  modificadores: Modificador[]
  /** Cartões de outra aba dentro deste (técnicas da transformação). */
  subcartoes: CartaoDaFicha[]
}

/**
 * Que número da ficha um ajuste rápido mexe (`lib/ajusteDaFicha.ts`):
 *  - `recurso`: o atual do HP (ou o valor do Escudo);
 *  - `maximo` / `modRecurso`: o máximo base e o modificador dele (HP 600 +100);
 *  - `atributo` / `modAtributo`: o valor base e o modificador ("60 (+5)");
 *  - `cartao`: ligar ou desligar uma transformação (1 = ligada, 0 = desligada).
 */
export type ParteDoAjuste = 'recurso' | 'maximo' | 'modRecurso' | 'atributo' | 'modAtributo' | 'cartao'

export const PARTES_DO_AJUSTE: readonly ParteDoAjuste[] = ['recurso', 'maximo', 'modRecurso', 'atributo', 'modAtributo', 'cartao']

/**
 * Uma linha do "Histórico" da ficha: quem mudou o quê, de quanto para quanto
 * e quando. Quem grava é sempre o host (o mestre, ou o host ao aceitar o
 * pedido do jogador): o jogador nunca manda histórico pronto.
 */
export interface RegistroDaFicha {
  /** "Mestre" ou o nome do jogador na mesa. */
  quem: string
  parte: ParteDoAjuste
  /** Id do recurso, do atributo ou do cartão. */
  chave: string
  /**
   * O nome na hora (HP, Força, Forma Híbrida): o histórico continua legível
   * depois que o cartão some ou o sistema da aventura troca.
   */
  rotulo: string
  de: number
  para: number
  /** `Date.now()` de quem gravou. */
  quando: number
}

/** Linhas do histórico guardadas por personagem: passou, as mais velhas saem. */
export const HISTORICO_MAX = 100
/** Nome de quem mudou e rótulo do registro: o mesmo teto do nome do personagem. */
const REGISTRO_TEXTO_MAX = 80
/** O maior instante que `Date` representa. */
const DATA_MAX_MS = 8.64e15

export interface Personagem {
  id: string
  tipo: TipoDePersonagem
  nome: string
  /** Uma linha (ou um parágrafo) sob o nome na ficha. */
  descricao: string
  /**
   * Retrato pequeno embutido (`data:image/...;base64,...`), reduzido pelo
   * mesmo caminho da foto do token (`buildTokenPhotoData`: até 256 px e 48 mil
   * caracteres). A entrega 4 troca isto por mídia servida por id.
   */
  retrato: string | null
  /** Valor de cada lista do sistema (Raça, Ofício), pela chave da lista. */
  escolhas: Record<string, string>
  etiquetas: string[]
  /** O valor de cada recurso; no recurso de atual e máximo (HP), o ATUAL. */
  recursos: Record<string, number>
  /**
   * O máximo BASE de cada recurso de atual e máximo. Chave ausente = o máximo
   * é o próprio atual: a ficha de antes guardava um número só (HP 600 vira
   * 600/600), e quem muda o atual grava o máximo antes (`lib/ajusteDaFicha.ts`).
   */
  maximos: Record<string, number>
  /** O modificador do máximo (HP 600 +100). Ausente = 0. */
  modificadoresDosRecursos: Record<string, number>
  /** O valor BASE de cada atributo (o que sobe de nível). */
  atributos: Record<string, number>
  /** O modificador de cada atributo, separado da base ("60 (+5)"). Ausente = 0. */
  modificadoresDosAtributos: Record<string, number>
  /** Ids dos cartões ligados agora (as transformações): os modificadores deles entram nos totais. */
  cartoesAtivos: string[]
  /** O "Histórico" dos ajustes rápidos, do mais velho ao mais novo, no máximo `HISTORICO_MAX`. */
  historico: RegistroDaFicha[]
  /** Cartões de cada aba, pela chave da aba. */
  abas: Record<string, CartaoDaFicha[]>
}

export const PERSONAGEM_SEM_NOME = 'Personagem sem nome'
export const CARTAO_SEM_NOME = 'Sem nome'

export function novoIdDePersonagem(): string {
  return `pers_${crypto.randomUUID()}`
}

export function novoIdDeCartao(): string {
  return `cart_${crypto.randomUUID()}`
}

/** Cartão vazio, já com o nome da aba ("Habilidade"), pronto para editar. */
export function novoCartao(nome: string): CartaoDaFicha {
  return { id: novoIdDeCartao(), nome, campos: {}, extras: [], atributos: [], imagem: null, modificadores: [], subcartoes: [] }
}

/**
 * Personagem novo do sistema: todo recurso e atributo em 0 (a ficha mostra o
 * número, nunca um buraco), toda aba vazia.
 */
export function novoPersonagem(sistema: SistemaDeRpg, tipo: TipoDePersonagem, nome: string): Personagem {
  return {
    id: novoIdDePersonagem(),
    tipo,
    nome: nome.trim() || PERSONAGEM_SEM_NOME,
    descricao: '',
    retrato: null,
    escolhas: {},
    etiquetas: [],
    recursos: Object.fromEntries(sistema.recursos.map((recurso) => [recurso.id, 0])),
    // Sem máximo gravado: o HP é de um número só até alguém digitar o máximo (0/0 agora; 600 vira 600/600).
    maximos: {},
    modificadoresDosRecursos: {},
    atributos: Object.fromEntries(sistema.atributos.map((atributo) => [atributo.id, 0])),
    modificadoresDosAtributos: {},
    cartoesAtivos: [],
    historico: [],
    abas: Object.fromEntries(sistema.abas.map((aba) => [aba.id, []])),
  }
}

/** Os cartões da aba no personagem; aba que ele ainda não tem é lista vazia. */
export function cartoesDaAba(personagem: Personagem, abaId: string): CartaoDaFicha[] {
  return personagem.abas[abaId] ?? []
}

/** Valor do número na ficha; chave que o personagem não tem (sistema trocado, ficha antiga) vale 0. */
export function numeroDaFicha(valores: Record<string, number>, id: string): number {
  return valores[id] ?? 0
}

/**
 * Os campos do cartão que aparecem, na ordem da aba: os fixos com valor e
 * depois os extras com valor. Campo sem valor não entra — é a regra do
 * projeto-rpg-v2 (CamposTecnica.tsx): a lista mostra o que foi escrito.
 */
export function camposVisiveis(aba: AbaDoSistema, cartao: CartaoDaFicha, forma: 'linha' | 'destaque'): { rotulo: string; valor: string }[] {
  const fixos = aba.campos
    .filter((campo) => campo.forma === forma)
    .map((campo) => ({ rotulo: campo.rotulo, valor: (cartao.campos[campo.id] ?? '').trim() }))
  const extras = forma === 'linha' && aba.extras === true ? cartao.extras.map((extra) => ({ rotulo: extra.nome.trim(), valor: extra.valor.trim() })) : []
  return [...fixos, ...extras].filter((campo) => campo.valor.length > 0)
}

/** Texto corrido do cartão: os campos `paragrafo` com valor, na ordem da aba. */
export function paragrafosDoCartao(aba: AbaDoSistema, cartao: CartaoDaFicha): string[] {
  return aba.campos
    .filter((campo) => campo.forma === 'paragrafo')
    .map((campo) => (cartao.campos[campo.id] ?? '').trim())
    .filter((valor) => valor.length > 0)
}

// ───────────────────────────────────────────────────────────────────────────
// Leitura tolerante (adventure.json)
// ───────────────────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function textoDe(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function textos(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {}
  return Object.fromEntries(Object.entries(value).filter((par): par is [string, string] => typeof par[1] === 'string'))
}

function numeros(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {}
  return Object.fromEntries(Object.entries(value).filter((par): par is [string, number] => typeof par[1] === 'number' && Number.isFinite(par[1])))
}

function listaDeTextos(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function extraDoArquivo(value: unknown): CampoExtra | null {
  if (!isRecord(value)) return null
  return { nome: textoDe(value.nome), valor: textoDe(value.valor) }
}

function modificadorDoArquivo(value: unknown): Modificador | null {
  if (!isRecord(value) || typeof value.atributo !== 'string') return null
  if (typeof value.delta !== 'number' || !Number.isFinite(value.delta)) return null
  return { atributo: value.atributo, delta: value.delta }
}

/** Imagem só na forma auto-contida da foto do token: caminho de disco ou URL cai para `null`. */
function imagemDoArquivo(value: unknown): string | null {
  return isTokenPhotoData(value) ? value : null
}

function semNulos<T>(itens: (T | null)[]): T[] {
  return itens.filter((item): item is T => item !== null)
}

function cartaoDoArquivo(value: unknown): CartaoDaFicha | null {
  if (!isRecord(value)) return null
  return {
    id: typeof value.id === 'string' && value.id.length > 0 ? value.id : novoIdDeCartao(),
    nome: textoDe(value.nome) || CARTAO_SEM_NOME,
    campos: textos(value.campos),
    extras: semNulos((Array.isArray(value.extras) ? value.extras : []).map(extraDoArquivo)),
    atributos: listaDeTextos(value.atributos),
    imagem: imagemDoArquivo(value.imagem),
    modificadores: semNulos((Array.isArray(value.modificadores) ? value.modificadores : []).map(modificadorDoArquivo)),
    subcartoes: semNulos((Array.isArray(value.subcartoes) ? value.subcartoes : []).map(cartaoDoArquivo)),
  }
}

/** Corta em `max` unidades UTF-16 sem deixar meio emoji no fim. */
function cortado(valor: string, max: number): string {
  if (valor.length <= max) return valor
  const ultima = valor.charCodeAt(max - 1)
  return valor.slice(0, ultima >= 0xd800 && ultima <= 0xdbff ? max - 1 : max)
}

function numeroFinito(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function registroDoArquivo(value: unknown): RegistroDaFicha | null {
  if (!isRecord(value) || typeof value.chave !== 'string' || value.chave.length === 0) return null
  const parte = PARTES_DO_AJUSTE.find((candidata) => candidata === value.parte)
  if (parte === undefined || !numeroFinito(value.de) || !numeroFinito(value.para) || !numeroFinito(value.quando)) return null
  // Fora do alcance de `Date` (8,64e15 ms), a hora do registro quebraria a tela ao formatar.
  if (Math.abs(value.quando) > DATA_MAX_MS) return null
  return {
    quem: cortado(textoDe(value.quem), REGISTRO_TEXTO_MAX) || 'Alguém',
    parte,
    chave: value.chave,
    rotulo: cortado(textoDe(value.rotulo), REGISTRO_TEXTO_MAX) || value.chave,
    de: value.de,
    para: value.para,
    quando: value.quando,
  }
}

/** O histórico do arquivo: linha torta sai, e só as `HISTORICO_MAX` mais novas ficam. */
function historicoDoArquivo(value: unknown): RegistroDaFicha[] {
  return Array.isArray(value) ? semNulos(value.map(registroDoArquivo)).slice(-HISTORICO_MAX) : []
}

function abasDoArquivo(value: unknown): Record<string, CartaoDaFicha[]> {
  if (!isRecord(value)) return {}
  return Object.fromEntries(
    Object.entries(value)
      .filter((par): par is [string, unknown[]] => Array.isArray(par[1]))
      .map(([abaId, cartoes]) => [abaId, semNulos(cartoes.map(cartaoDoArquivo))]),
  )
}

/**
 * Um personagem do `adventure.json`. Sem `id` ele sai (o token que apontava
 * para ele não teria como achar a cópia de id novo); o resto é tolerante:
 * nome vazio vira "Personagem sem nome", tipo desconhecido vira NPC (não
 * promove ninguém a jogador por engano), retrato que não é imagem embutida sai.
 * Ficha de antes dos ajustes rápidos (sem máximos, modificadores, cartões
 * ligados nem histórico) abre com tudo vazio: o HP de um número só vira
 * atual = máximo, os modificadores valem 0 e nada está ligado.
 */
export function personagemDoArquivo(value: unknown): Personagem | null {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.length === 0) return null
  return {
    id: value.id,
    tipo: value.tipo === 'jogador' ? 'jogador' : 'npc',
    nome: textoDe(value.nome).trim() || PERSONAGEM_SEM_NOME,
    descricao: textoDe(value.descricao),
    retrato: imagemDoArquivo(value.retrato),
    escolhas: textos(value.escolhas),
    etiquetas: listaDeTextos(value.etiquetas),
    recursos: numeros(value.recursos),
    maximos: numeros(value.maximos),
    modificadoresDosRecursos: numeros(value.modificadoresDosRecursos),
    atributos: numeros(value.atributos),
    modificadoresDosAtributos: numeros(value.modificadoresDosAtributos),
    cartoesAtivos: [...new Set(listaDeTextos(value.cartoesAtivos))],
    historico: historicoDoArquivo(value.historico),
    abas: abasDoArquivo(value.abas),
  }
}

/**
 * `Adventure.personagens` como veio do disco. Ausente (aventura antiga) ou
 * que não é lista = `undefined`: a aventura abre sem a chave e grava sem ela.
 * Id repetido (arquivo editado à mão): o primeiro vence.
 */
export function personagensDoArquivo(value: unknown): Personagem[] | undefined {
  if (!Array.isArray(value)) return undefined
  const vistos = new Set<string>()
  const lidos: Personagem[] = []
  for (const bruto of value) {
    const personagem = personagemDoArquivo(bruto)
    if (personagem === null || vistos.has(personagem.id)) continue
    vistos.add(personagem.id)
    lidos.push(personagem)
  }
  return lidos
}

/** `Adventure.sistemaDeRpg`: só texto não vazio; o resto é "aventura sem sistema". */
export function sistemaDaAventuraDoArquivo(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}
