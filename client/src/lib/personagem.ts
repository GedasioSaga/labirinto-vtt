import { cleanPlayerName } from './chat'
import { ehImagemDaMesa } from './midia'
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
  /**
   * A imagem do cartão: referência de mídia (`midia:<id>`, `lib/midia.ts`) ou,
   * na ficha de antes, a embutida pequena (`data:image/...`) — esta é
   * gravada como mídia assim que a aventura a vê (`stores/midiaDosPersonagens.ts`).
   */
  imagem: string | null
  modificadores: Modificador[]
  /** Cartões de outra aba dentro deste (técnicas da transformação). */
  subcartoes: CartaoDaFicha[]
  /**
   * MUNDO DO LIVRO (M2, decisão 6): o golpe é À MÃO de propósito — na batalha
   * o número é digitado. A Saúde da ficha o mostra em cinza e fora da
   * porcentagem (`lib/livros/saude.ts`). Ausente = a leitura decide. É dado da
   * ficha (vai ao jogador e volta na edição dele), não do mestre.
   */
  aMao?: true
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
   * O retrato: referência de mídia (`midia:<id>`), que o jogador busca por URL
   * da sala em vez de recebê-lo dentro de cada envio da ficha. A embutida de
   * antes (`data:image/...`, até 256 px) ainda é lida e vira mídia assim que a
   * aventura a vê (`stores/midiaDosPersonagens.ts`).
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
  /**
   * CONTAS DOS JOGADORES: o id da conta a quem o mestre deu este personagem
   * (`lib/contasDosJogadores.ts`). Quem entra com a conta recebe as fichas
   * (tokens) ligadas a ele. Ausente = de ninguém. Só o mestre muda: a edição
   * do jogador parte do personagem gravado e não toca nele, e ele não vai ao
   * jogador (`hostSession.ts`, `personagensUpdate`).
   */
  dono?: string
  /*
   * MUNDO DO LIVRO DE REGRAS (M1, docs/planos/livros-de-regras-plano.md §2.1).
   * Os quatro campos abaixo são SÓ DO MESTRE: `paraOFio` tira todos antes de
   * qualquer envio, e a edição do jogador parte do personagem gravado, então
   * ele não consegue gravá-los. Ausentes = ficha de antes do mundo do livro.
   */
  /**
   * NPC DE COMBATE: a força (multiplica HP e dano, nunca Escudo nem SP) e, na
   * variação, o modelo de quem ela copia a ficha (`lib/livros/combate.ts`,
   * `sincronizarVariacoes`). Ausente num NPC = força 1 e NPC único.
   */
  combate?: MarcaDeCombate
  /** NPC só de decoração: fica fora da ordem dos turnos (lista "Só no cenário"). Ausente = entra (decisão D5). */
  soCenario?: true
  /**
   * O nome com que o jogador entra na mesa SEM conta: quem entra com ele
   * recebe os tokens desta ficha. Já passado por `cleanPlayerName`, no máximo
   * `NOME_DO_JOGADOR_MAX`. Ignorado quando há `dono`: a conta ganha (decisão D1).
   */
  nomeDoJogador?: string
  /** A anotação do mestre, no máximo `NOTA_DO_MESTRE_MAX`. Entra na IA só quando a ficha é citada (M4). */
  notaDoMestre?: string
}

/** A marca de NPC de combate (`Personagem.combate`). */
export interface MarcaDeCombate {
  /** De `FORCA_MIN` a `FORCA_MAX`, no passo `FORCA_PASSO` (`forcaNoPasso`). */
  forca: number
  /** Id do personagem-modelo: presente = é variação dele. */
  modeloId?: string
  /**
   * Nasceu na caixa "Quem entra na batalha?" (decisão D3): fica no bestiário
   * depois da luta, com o selo "criado na batalha" (apagar é 1 clique). O
   * registro da batalha e o Desfazer apontam para ela.
   */
  criadoNaBatalha?: true
}

export const FORCA_MIN = 0.5
export const FORCA_MAX = 2
export const FORCA_PASSO = 0.05
export const FORCA_PADRAO = 1
/** O mesmo teto do nome do `join` (`NAME_MAX_LENGTH`): é o nome digitado na entrada. */
export const NOME_DO_JOGADOR_MAX = 32
export const NOTA_DO_MESTRE_MAX = 4000
/** Teto do id do modelo lido do disco: id maior que isso não é de personagem nenhum. */
const MODELO_ID_MAX = 120

/** O id de conta que `dono` aceita (o de `novoIdDeConta`, ou um à mão no mesmo alfabeto). */
const DONO_PADRAO = /^[A-Za-z0-9_-]{1,80}$/

/**
 * A força dentro da faixa e no passo do deslizante. O arredondamento passa
 * por centésimos para 1,15 não virar 1,1499999 e sair do passo na volta.
 * Número que não é finito vale `FORCA_PADRAO`.
 */
export function forcaNoPasso(valor: number): number {
  if (!Number.isFinite(valor)) return FORCA_PADRAO
  const limitada = Math.min(FORCA_MAX, Math.max(FORCA_MIN, valor))
  return Math.round(Math.round(limitada / FORCA_PASSO) * FORCA_PASSO * 100) / 100
}

/**
 * O recurso que a força multiplica (decisão D3 do protótipo: só HP e dano;
 * Escudo e SP intocados). Os dois funis que a aplicam: `maximoComposto`
 * (lib/ajusteDaFicha.ts) e o dano (lib/batalha/formula.ts).
 */
export const RECURSO_QUE_A_FORCA_MULTIPLICA = 'hp'

/**
 * A força com que o personagem luta: a do NPC de combate; 1 para jogador e
 * para NPC sem marca. Mora aqui, junto do tipo, e não em lib/livros/combate.ts:
 * ajusteDaFicha.ts e formula.ts a leem, e o mundo do livro lê os dois — morar
 * lá fecharia um ciclo de imports.
 */
export function forcaDe(personagem: Personagem): number {
  if (personagem.tipo !== 'npc' || personagem.combate === undefined) return FORCA_PADRAO
  return forcaNoPasso(personagem.combate.forca)
}

/** O número depois da força, inteiro: a MESMA conta no HP máximo e no dano, para a ficha, a batalha e o Comparar baterem. */
export function aplicarForca(valor: number, forca: number): number {
  return forca === FORCA_PADRAO ? valor : Math.round(valor * forca)
}

/** O nome de entrada como a ficha o guarda: a limpeza do `join` e o teto; vazio = sem ligação. */
export function nomeDoJogadorLimpo(nome: string): string {
  return cortado(cleanPlayerName(nome), NOME_DO_JOGADOR_MAX).trim()
}

/**
 * MUNDO DO LIVRO (M2, Anotações): a ficha com a nota do mestre trocada, como
 * a leitura do disco a guardaria — cortada em `NOTA_DO_MESTRE_MAX`; em branco
 * = sem nota (o campo sai). Texto igual ao de agora devolve a MESMA referência.
 * Funil único da nota: a página Anotações (`mundo.mudar`) e a janela de ficha
 * do mestre, que aplica a nota DEPOIS de `salvarSobreOAtual` (aquele preserva
 * a nota de agora, para o Salvar comum não a apagar).
 */
export function comNotaDoMestre(personagem: Personagem, texto: string): Personagem {
  const nota = cortado(texto, NOTA_DO_MESTRE_MAX)
  if (nota.trim().length === 0) {
    if (personagem.notaDoMestre === undefined) return personagem
    const { notaDoMestre: _antiga, ...semNota } = personagem
    return semNota
  }
  return personagem.notaDoMestre === nota ? personagem : { ...personagem, notaDoMestre: nota }
}

/**
 * O personagem como ele vai pela rede, a QUALQUER jogador: sem a conta dona
 * e sem nada do mundo do livro (força, modelo, cenário, nome de entrada,
 * anotação). É o funil único de `Personagem` para o fio (`net/hostSession.ts`:
 * lista do jogador e batalha). Sem nenhum desses campos devolve a MESMA
 * referência: o host compara por referência para não reenviar.
 */
export function paraOFio(personagem: Personagem): Personagem {
  const { dono, combate, soCenario, nomeDoJogador, notaDoMestre, ...publico } = personagem
  if (dono === undefined && combate === undefined && soCenario === undefined && nomeDoJogador === undefined && notaDoMestre === undefined) return personagem
  return publico
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

/** Imagem só como referência de mídia ou embutida: caminho de disco ou URL cai para `null`. */
function imagemDoArquivo(value: unknown): string | null {
  return ehImagemDaMesa(value) ? value : null
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
    // Só o `true` conta: qualquer outro valor (ficha de antes, valor torto) é "a leitura decide".
    ...(value.aMao === true ? { aMao: true } : {}),
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
 * promove ninguém a jogador por engano), retrato que não é mídia nem imagem
 * embutida sai.
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
    ...(typeof value.dono === 'string' && DONO_PADRAO.test(value.dono) ? { dono: value.dono } : {}),
    ...camposDoMundoDoArquivo(value),
  }
}

/** A marca de combate do disco: força torta vale a padrão; modelo que não é texto curto sai. */
function marcaDeCombateDoArquivo(value: unknown): MarcaDeCombate | undefined {
  if (!isRecord(value)) return undefined
  const marca: MarcaDeCombate = { forca: numeroFinito(value.forca) ? forcaNoPasso(value.forca) : FORCA_PADRAO }
  if (typeof value.modeloId === 'string' && value.modeloId.length > 0 && value.modeloId.length <= MODELO_ID_MAX) marca.modeloId = value.modeloId
  if (value.criadoNaBatalha === true) marca.criadoNaBatalha = true
  return marca
}

/**
 * Os campos do mundo do livro (§2.1), tolerantes: valor torto sai e a chave
 * nem aparece (nada de `soCenario: undefined` gravado de volta). O jogador
 * nunca os recebe (`paraOFio`), então esta leitura só vê o disco do mestre.
 */
function camposDoMundoDoArquivo(value: Record<string, unknown>): Pick<Personagem, 'combate' | 'soCenario' | 'nomeDoJogador' | 'notaDoMestre'> {
  const campos: Pick<Personagem, 'combate' | 'soCenario' | 'nomeDoJogador' | 'notaDoMestre'> = {}
  const combate = marcaDeCombateDoArquivo(value.combate)
  if (combate !== undefined) campos.combate = combate
  if (value.soCenario === true) campos.soCenario = true
  const nome = typeof value.nomeDoJogador === 'string' ? nomeDoJogadorLimpo(value.nomeDoJogador) : ''
  if (nome.length > 0) campos.nomeDoJogador = nome
  const nota = typeof value.notaDoMestre === 'string' ? cortado(value.notaDoMestre, NOTA_DO_MESTRE_MAX) : ''
  if (nota.trim().length > 0) campos.notaDoMestre = nota
  return campos
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
