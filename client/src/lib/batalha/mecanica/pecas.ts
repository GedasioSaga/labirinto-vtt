import { NOME_DO_SELO_MAX } from '../combate'
import type { TipoQueBate } from './modelo'

/**
 * AS PEÇAS DA VERSÃO 5 (rework do editor de habilidades, E1; docs/design/habilidades-rework/PLANO.md
 * D1 a D3, protótipo aprovado `prototipo.html`, `PECAS` e `pecaNova`). A `mecanica` da versão 5 é a 4
 * com a lista `pecas`: as famílias do protótipo, menos o Acumulador, que mora no `cartao.acumulador`
 * (D9). Cada peça guarda só o que difere do padrão (`PECA_DE_PARTIDA`, o `pecaNova` do protótipo):
 * o leitor completa o resto e `pecaParaGuardar` tira o que é igual ao padrão.
 *
 * Tudo ou nada, como as outras peças: família desconhecida, chave desconhecida ou número fora da faixa
 * = a mecânica inteira é inválida (o cartão fica à mão). O motor nunca lê a peça crua: a tradução para
 * a linha da tabela à mão (`MecanicaAMao`) mora em `leitura.ts` (D3), e o "Muda atributo" vira selo dos
 * Efeitos na leitura do motor (`pecasParaOMotor`, `golpe.ts`).
 *
 * Fora da peça, de propósito (uma coisa, um lugar): os usos por batalha da forma (`limite.usosPorBatalha`
 * da mecânica), a defesa da reação que devolve (`reacao.defesa`), a técnica que a forma libera (o
 * requisito B3 da técnica liberada, D8) e o acumulador (`cartao.acumulador`, D9). A tela da peça mostra
 * e muda esses lugares.
 *
 * API pública (estável para E2 a E7):
 * - tipos: `FamiliaDaPeca`, `PecaDaMecanica` e uma interface por família (`PecaPergunta` ... `PecaDevolve`),
 *   `CondicaoDaPeca`, `RespostaDaPeca`, `PerguntaDaPeca`, `ElementoDaPeca`, `EfeitoDoGatilho`,
 *   `QuandoOGatilhoDispara`, `ModDaForma`, `ItemDoStatus`;
 * - dados: `FAMILIAS_DAS_PECAS` (a ordem da tela), `PECA_DE_PARTIDA`, `ELEMENTOS_DE_FABRICA`,
 *   `NOME_DA_FADIGA`, `ATRIBUTO_DA_VELOCIDADE` e os tetos (`PECAS_MAX` ...);
 * - funções: `lerPecas` (nunca lança), `pecaNova`, `pecaParaGuardar`, `pecasParaGuardar`, `pecasDo`,
 *   `motivoDasPecasComOUso`.
 *
 * Puro: sem store, sem rede.
 */

// ─── Os tetos ───────────────────────────────────────────────────────────────

/** Teto de peças numa mecânica. */
export const PECAS_MAX = 8
/** Teto de gatilhos ("Dispara sozinha") numa passiva; as outras famílias entram uma vez só. */
export const GATILHOS_MAX = 5
/** Até 3 perguntas por técnica, de 2 a 6 respostas cada (decisão 8 do protótipo). */
export const PERGUNTAS_MAX = 3
export const RESPOSTAS_POR_PERGUNTA_MIN = 2
export const RESPOSTAS_POR_PERGUNTA_MAX = 6
/** O texto da pergunta e o aviso ao mestre (os tetos do protótipo). */
export const TEXTO_DA_PERGUNTA_MAX = 60
export const AVISO_DO_GATILHO_MAX = 80
/** Nomes curtos: resposta, elemento, grupo da forma, criatura. */
export const NOME_CURTO_MAX = 24
/** Teto do id de atributo (o mesmo `ATRIBUTO_MAX` do modelo). */
export const ATRIBUTO_DA_PECA_MAX = 64
/** Elementos do Imbuir: os 7 de fábrica e alguns próprios. */
export const ELEMENTOS_MAX = 10
export const EFEITOS_DO_GATILHO_MAX = 5
export const MODS_DA_FORMA_MAX = 8
export const ITENS_DO_STATUS_MAX = 6
/** Turnos de uma condição posta por peça. */
export const TURNOS_DA_PECA_MAX = 20

/** O nome da condição comum que a forma deixa no dono quando acaba (D10; a E5 a põe no catálogo de fábrica). */
export const NOME_DA_FADIGA = 'Fadiga'
/** "Velocidade" nas peças = a Agilidade que ordena a vez (D10, como na Ignição: `agilidadeDe`, turnos.ts). */
export const ATRIBUTO_DA_VELOCIDADE = 'velocidade'
/** O id do atributo que a Velocidade mexe no motor. */
const ATRIBUTO_DA_AGILIDADE = 'agilidade'

/** Os nomes dos atributos que as peças oferecem (`ATRIBUTOS` do protótipo). Fora da lista, o id com a 1ª letra maiúscula. */
const NOMES_DOS_ATRIBUTOS: Readonly<Record<string, string>> = {
  forca: 'Força',
  agilidade: 'Agilidade',
  percepcao: 'Percepção',
  resistencia: 'Resistência',
  intuicao: 'Intuição',
  espirito: 'Espírito',
  carisma: 'Carisma',
  determinacao: 'Determinação',
  velocidade: 'Velocidade',
  ca: 'CA',
  escudo: 'Escudo',
  sp: 'SP',
  vida: 'Vida',
  dano: 'Dano',
  alcance: 'Alcance',
}

/** O nome do atributo da peça na frase e na fórmula ("Determinação * 50 / 100"). */
export function nomeDoAtributoDaPeca(id: string): string {
  return NOMES_DOS_ATRIBUTOS[id] ?? `${id.charAt(0).toLocaleUpperCase('pt-BR')}${id.slice(1)}`
}

/** O id que o motor mexe: a Velocidade é a Agilidade (D10); o resto passa igual. */
export function atributoNoMotor(id: string): string {
  return id === ATRIBUTO_DA_VELOCIDADE ? ATRIBUTO_DA_AGILIDADE : id
}

// ─── Os tipos ───────────────────────────────────────────────────────────────

/** As famílias guardadas na `mecanica` (o Acumulador do protótipo mora no `cartao.acumulador`, D9). */
export type FamiliaDaPeca = 'pergunta' | 'imbuir' | 'gatilho' | 'raca' | 'transformacao' | 'status' | 'diminui' | 'marca' | 'invocacao' | 'devolve'

/** As famílias na ordem da tela (`ORDEM_DAS_PECAS` do protótipo, sem o Acumulador). */
export const FAMILIAS_DAS_PECAS: readonly FamiliaDaPeca[] = ['pergunta', 'imbuir', 'gatilho', 'raca', 'transformacao', 'status', 'diminui', 'marca', 'invocacao', 'devolve']

/** Uma condição que a peça põe: o nome (o comportamento vem dele, como no selo dos Efeitos) e por quantos turnos de quem a tem. */
export interface CondicaoDaPeca {
  nome: string
  turnos: number
}

/** Uma resposta da Pergunta na hora: o que ela muda no golpe. */
export interface RespostaDaPeca {
  nome: string
  /** Troca como o golpe bate (o selo e a perfuração do tipo, `mecanica/golpe.ts`). Ausente = não troca. */
  bate?: TipoQueBate
  /** Soma no dano de cada alvo (negativo tira); 0 = não muda. */
  dano: number
  /** A condição que deixa no acerto; ausente = nenhuma. */
  condicao?: CondicaoDaPeca
  /** A parte do dano que passa do Escudo, de 0 (nada) a 100 (tudo). */
  perfuracao: number
}

export interface PerguntaDaPeca {
  texto: string
  respostas: readonly RespostaDaPeca[]
}

/** Antes de bater, a batalha pergunta; cada resposta muda o golpe (mecânica 1). */
export interface PecaPergunta {
  tipo: 'pergunta'
  perguntas: readonly PerguntaDaPeca[]
  /** NPC: vale a primeira resposta, ou o mestre responde. */
  npc: 'primeira' | 'mestre'
}

export type IdDoElemento = 'fogo' | 'gelo' | 'eletricidade' | 'veneno' | 'luz' | 'trevas' | 'vento'

/** Um elemento que o dono pode pôr no golpe. Os de fábrica completam o que faltar pela `ELEMENTOS_DE_FABRICA`. */
export interface ElementoDaPeca {
  /** O de fábrica, ou `proprio` (nome do mestre; mais de um, desde que com nomes diferentes). */
  id: IdDoElemento | 'proprio'
  nome: string
  /** O dano a mais (negativo tira). */
  dano: number
  condicao?: CondicaoDaPeca
  /** O SP que o golpe com o elemento custa ("Não" é sempre grátis). */
  sp: number
  /** O alvo reage com desvantagem. */
  desvantagem: boolean
}

/** A cada golpe do dono, com a técnica "Ligar e manter" ligada, ele escolhe um elemento (mecânica 2). Só os elementos ligados entram. */
export interface PecaImbuir {
  tipo: 'imbuir'
  elementos: readonly ElementoDaPeca[]
}

/** Quando o gatilho dispara (`GATILHOS` do protótipo). */
export type QuandoOGatilhoDispara = 'inicio' | 'comeco' | 'rodada' | 'vidaAbaixo' | 'aoReceber' | 'aoAcertar' | 'aoCair'

/** O que o gatilho faz (`EFEITOS_DO_GATILHO` do protótipo). */
export type EfeitoDoGatilho =
  | { tipo: 'atributo'; atributo: string; valor: number; turnos: number }
  | { tipo: 'recuperar'; recurso: 'hp' | 'sp'; valor: number; turnos: number }
  | { tipo: 'escudo'; valor: number }
  | { tipo: 'condSi'; condicao: CondicaoDaPeca }
  | { tipo: 'condAlvo'; condicao: CondicaoDaPeca }
  | { tipo: 'aviso'; texto: string }

/** Quando algo acontece, faz o efeito sem gastar ação (mecânica 3; só na passiva). */
export interface PecaGatilho {
  tipo: 'gatilho'
  quando: QuandoOGatilhoDispara
  /** A rodada ("na rodada N") ou a % da vida ("abaixo de N%"); nos outros gatilhos não conta. */
  n: number
  vezes: 'sempre' | 'umaPorBatalha'
  /** "Pergunta antes de disparar" (o "Ativar / Agora não" de hoje); desligado = dispara sozinha, com Desfazer (D6). */
  pergunta: boolean
  /** Só no "Ao cair": em vez de cair, fica com esta vida. Ausente = cai. */
  ficaCom?: number
  efeitos: readonly EfeitoDoGatilho[]
}

/** Sempre ligada: corta dano, soma dano, proíbe desviar (mecânica 4; só na passiva). */
export interface PecaRaca {
  tipo: 'raca'
  corta: boolean
  /** A % de todo dano que o dono recebe que cai (antes do Escudo, decisão 13). */
  cortaPorcento: number
  soma: boolean
  somaValor: number
  /** Em que golpes soma: os físicos (Impacto, Cortante, Perfurante) ou só os corpo a corpo. */
  somaEm: 'fisico' | 'corpo'
  naoDesvia: boolean
  /** Quem não pode desviar: o próprio dono (grande demais) ou quem o dono acerta. */
  naoDesviaQuem: 'dono' | 'alvo'
}

/** Um atributo que a forma muda enquanto dura, ou que a Fadiga tira. */
export interface ModDaForma {
  atributo: string
  valor: number
}

/**
 * A forma (mecânica 5, D5 e D10): dura alguns turnos, dá ações a mais, muda atributos, marca e deixa a
 * Fadiga no fim. Os `mods` viram os `modificadores` do cartão ao gravar (o app de antes e o site leem
 * por eles); os usos por batalha moram em `limite.usosPorBatalha`.
 */
export interface PecaTransformacao {
  tipo: 'transformacao'
  /** Quantas vezes do dono dura depois da vez em que ligou; 0 = até desligar. */
  dura: number
  /** Ações a mais em cada vez do dono enquanto dura (ataca `acoes + 1` vezes). */
  acoes: number
  mods: readonly ModDaForma[]
  /** O dano recebido, em %: -10 = leva 10% a menos. */
  danoRecebido: number
  deslocamento: number
  /** O teto do deslocamento; 0 = sem teto. */
  deslocamentoMax: number
  /** Formas do mesmo grupo trocam uma pela outra; '' = sem grupo. */
  grupo: string
  /** Só na Overload: os golpes enquanto dura também não erram (só outra Overload defende). */
  naoErra: boolean
  /** Cada acerto do dono deixa uma marca no alvo; o próximo golpe DELE na marca dá o dobro e ela some (D10). */
  marca: boolean
  /** Quando acaba, vem a Fadiga (`NOME_DA_FADIGA`), por `fadigaTurnos`, tirando `fadigaMods`. */
  fadiga: boolean
  fadigaTurnos: number
  fadigaMods: readonly ModDaForma[]
}

/** Uma linha do "Muda atributo". */
export interface ItemDoStatus {
  atributo: string
  /** Fixo, ou uma parte de outro atributo de quem usa (`porcento`% de `de`). */
  modo: 'fixo' | 'formula'
  valor: number
  porcento: number
  de: string
  /** Por alguns turnos, até o fim da batalha, ou para sempre (grava na ficha: o app lembra o mestre). */
  dura: 'turnos' | 'batalha' | 'permanente'
  turnos: number
}

/** Soma ou tira atributo do dono ou de um aliado (mecânica 6: vira o selo dos Efeitos na leitura do motor). */
export interface PecaStatus {
  tipo: 'status'
  quem: 'si' | 'aliado' | 'todos'
  itens: readonly ItemDoStatus[]
}

/** Ao acertar, o alvo perde atributo de uma vez, por turno ou a partir de um turno (mecânica 8, D10). */
export interface PecaDiminui {
  tipo: 'diminui'
  /** O atributo; `ATRIBUTO_DA_VELOCIDADE` = a Agilidade que ordena a vez. */
  atributo: string
  modo: 'fixo' | 'porcento'
  valor: number
  /** De uma vez (por `dura` turnos), a cada turno (somando), ou depois de `depoisDe` turnos. */
  ritmo: 'umaVez' | 'cadaTurno' | 'depois'
  dura: number
  depoisDe: number
  depoisVezes: 'uma' | 'cada'
  teto: boolean
  tetoValor: number
  /** Volta ao normal depois de `voltaEm` turnos do golpe, no fim da batalha, ou quando tirarem a condição. */
  volta: 'turnos' | 'batalha' | 'curar'
  voltaEm: number
  /** O nome da condição no alvo. */
  nome: string
}

/** Deixa uma marca no alvo; o próximo golpe nela dá mais dano. */
export interface PecaMarca {
  tipo: 'marca'
  quando: 'aoAcertar' | 'pergunta' | 'tiro'
  /** Só no "pergunta": o SP para marcar e o teste ('' = sem teste). */
  paga: number
  teste: string
  nome: string
  /** O próximo golpe na marca dá `vezes` × o dano. */
  vezes: number
  quem: 'dono' | 'todos'
  some: boolean
  turnos: number
}

/** Chama uma criatura com vida, dano e limite de quantas. */
export interface PecaInvocacao {
  tipo: 'invocacao'
  nome: string
  vida: number
  dano: number
  casas: number
  max: number
  /** Concentração (×); 0 = não usa. */
  concentracao: number
  ultra: boolean
  carga: number
}

/**
 * Na reação: devolve dano em quem bateu (o dano recebido ÷ `divide`, mais o atributo `soma`). A parte
 * que a reação segura mora em `reacao.defesa` da mecânica; com `escolha`, o jogador escolhe na hora entre
 * defender e devolver.
 */
export interface PecaDevolve {
  tipo: 'devolve'
  escolha: boolean
  divide: number
  /** O atributo de quem reage somado ao que volta; '' = nada. */
  soma: string
}

export type PecaDaMecanica = PecaPergunta | PecaImbuir | PecaGatilho | PecaRaca | PecaTransformacao | PecaStatus | PecaDiminui | PecaMarca | PecaInvocacao | PecaDevolve

/** A peça de uma família. */
export type PecaDa<F extends FamiliaDaPeca> = Extract<PecaDaMecanica, { tipo: F }>

// ─── Os padrões (o `pecaNova` do protótipo) ────────────────────────────────

/** Os 7 elementos de fábrica (`ELEMENTOS` do protótipo). A cor e o ícone são da tela (`components/batalha/editor/pecas/registro.ts`). */
export const ELEMENTOS_DE_FABRICA: readonly (ElementoDaPeca & { id: IdDoElemento })[] = [
  { id: 'fogo', nome: 'Fogo', dano: 10, condicao: { nome: 'Queimando', turnos: 3 }, sp: 5, desvantagem: false },
  { id: 'gelo', nome: 'Gelo', dano: 5, condicao: { nome: 'Congelado', turnos: 2 }, sp: 5, desvantagem: true },
  { id: 'eletricidade', nome: 'Eletricidade', dano: 10, condicao: { nome: 'Eletrizado', turnos: 2 }, sp: 5, desvantagem: false },
  { id: 'veneno', nome: 'Veneno', dano: 5, condicao: { nome: 'Envenenado', turnos: 3 }, sp: 5, desvantagem: false },
  { id: 'luz', nome: 'Luz', dano: 5, condicao: { nome: 'Cego', turnos: 1 }, sp: 10, desvantagem: false },
  { id: 'trevas', nome: 'Trevas', dano: 10, condicao: { nome: 'Enfraquecido', turnos: 2 }, sp: 10, desvantagem: false },
  { id: 'vento', nome: 'Vento', dano: 5, sp: 5, desvantagem: true },
]

const IDS_DOS_ELEMENTOS: readonly IdDoElemento[] = ELEMENTOS_DE_FABRICA.map((elemento) => elemento.id)

function elementoDeFabrica(id: IdDoElemento): ElementoDaPeca {
  const achado = ELEMENTOS_DE_FABRICA.find((elemento) => elemento.id === id)
  // A lista de ids sai da própria tabela: todo id dela tem a linha.
  if (achado === undefined) throw new Error(`elemento de fábrica sem linha: ${id}`)
  return achado
}

/** O que cada família traz ao nascer (o `pecaNova` do protótipo, sem os ids da tela). */
export const PECA_DE_PARTIDA: { readonly [F in FamiliaDaPeca]: PecaDa<F> } = {
  pergunta: {
    tipo: 'pergunta',
    perguntas: [
      {
        texto: 'Como o golpe bate?',
        respostas: [
          { nome: 'Impacto', bate: 'impacto', dano: 0, condicao: { nome: 'Atordoado', turnos: 1 }, perfuracao: 0 },
          { nome: 'Perfurante', bate: 'perfurante', dano: 0, perfuracao: 100 },
          { nome: 'Cortante', bate: 'cortante', dano: -5, condicao: { nome: 'Sangrando', turnos: 3 }, perfuracao: 0 },
        ],
      },
    ],
    npc: 'primeira',
  },
  imbuir: { tipo: 'imbuir', elementos: [elementoDeFabrica('fogo'), elementoDeFabrica('gelo')] },
  gatilho: { tipo: 'gatilho', quando: 'comeco', n: 2, vezes: 'sempre', pergunta: false, efeitos: [{ tipo: 'recuperar', recurso: 'hp', valor: 10, turnos: 1 }] },
  raca: { tipo: 'raca', corta: true, cortaPorcento: 30, soma: true, somaValor: 20, somaEm: 'fisico', naoDesvia: false, naoDesviaQuem: 'dono' },
  transformacao: {
    tipo: 'transformacao',
    dura: 3,
    acoes: 1,
    mods: [{ atributo: 'agilidade', valor: 20 }],
    danoRecebido: 0,
    deslocamento: 0,
    deslocamentoMax: 0,
    grupo: '',
    naoErra: true,
    marca: false,
    fadiga: true,
    fadigaTurnos: 2,
    fadigaMods: [{ atributo: 'agilidade', valor: -10 }],
  },
  status: { tipo: 'status', quem: 'si', itens: [{ atributo: 'forca', modo: 'fixo', valor: 10, porcento: 50, de: 'determinacao', dura: 'turnos', turnos: 3 }] },
  diminui: { tipo: 'diminui', atributo: ATRIBUTO_DA_VELOCIDADE, modo: 'fixo', valor: 10, ritmo: 'umaVez', dura: 3, depoisDe: 1, depoisVezes: 'cada', teto: false, tetoValor: 20, volta: 'turnos', voltaEm: 3, nome: 'Lento' },
  marca: { tipo: 'marca', quando: 'aoAcertar', paga: 40, teste: 'percepcao', nome: 'Marcado', vezes: 2, quem: 'dono', some: true, turnos: 3 },
  invocacao: { tipo: 'invocacao', nome: 'Lobo', vida: 80, dano: 20, casas: 1, max: 2, concentracao: 0, ultra: false, carga: 3 },
  devolve: { tipo: 'devolve', escolha: true, divide: 7, soma: 'forca' },
}

/** A peça nova da família, com o padrão (o editor põe na lista). */
export function pecaNova<F extends FamiliaDaPeca>(familia: F): PecaDa<F> {
  return PECA_DE_PARTIDA[familia]
}

/** As peças de uma família, na ordem da lista. */
export function pecasDo<F extends FamiliaDaPeca>(pecas: readonly PecaDaMecanica[] | undefined, familia: F): PecaDa<F>[] {
  return (pecas ?? []).filter((peca): peca is PecaDa<F> => peca.tipo === familia)
}

// ─── A leitura ──────────────────────────────────────────────────────────────

/** O que a leitura das peças dá. Nunca lança: a peça torta volta com o motivo em português simples. */
export type PecasLidas = { ok: true; pecas: readonly PecaDaMecanica[] } | { ok: false; motivo: string }

class PecaTorta extends Error {}

function torta(motivo: string): never {
  throw new PecaTorta(motivo)
}

type Cru = Readonly<Record<string, unknown>>

function registro(valor: unknown, onde: string): Cru {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) torta(`${onde} não é uma peça`)
  return { ...valor }
}

function soChaves(peca: Cru, permitidas: readonly string[], onde: string): void {
  const sobra = Object.keys(peca).find((chave) => !permitidas.includes(chave))
  if (sobra !== undefined) torta(`${onde} tem "${sobra}", que este app não conhece`)
}

function umDe<T extends string>(valor: unknown, opcoes: readonly T[], onde: string): T {
  const achada = opcoes.find((opcao) => opcao === valor)
  if (achada === undefined) torta(`${onde} fora da lista`)
  return achada
}

function inteiro(valor: unknown, minimo: number, maximo: number, onde: string): number {
  if (typeof valor !== 'number' || !Number.isInteger(valor) || valor < minimo || valor > maximo) torta(`${onde} precisa ser inteiro de ${minimo} a ${maximo}`)
  return valor
}

/** Texto numa linha; `vazio` = aceita '' (o "sem grupo", o "sem teste"). */
function texto(valor: unknown, maximo: number, onde: string, vazio = false): string {
  if (typeof valor !== 'string' || valor.length > maximo || /[\r\n]/.test(valor) || (!vazio && valor.trim().length === 0)) torta(`${onde} precisa ter ${vazio ? 'até' : `de 1 a`} ${maximo} letras, numa linha`)
  return valor
}

function simOuNao(valor: unknown, onde: string): boolean {
  if (typeof valor !== 'boolean') torta(`${onde} precisa ser sim ou não`)
  return valor
}

function lista(valor: unknown, minimo: number, maximo: number, onde: string): unknown[] {
  if (!Array.isArray(valor)) torta(`${onde} não é uma lista`)
  if (valor.length < minimo || valor.length > maximo) torta(`${onde} precisa ter de ${minimo} a ${maximo}`)
  return valor
}

const BATIDAS: readonly TipoQueBate[] = ['impacto', 'cortante', 'perfurante']
const ONDE: Readonly<Record<FamiliaDaPeca, string>> = {
  pergunta: 'a Pergunta na hora',
  imbuir: 'o Imbuir',
  gatilho: 'o Dispara sozinha',
  raca: 'a Passiva de raça',
  transformacao: 'a Transformação',
  status: 'o Muda atributo',
  diminui: 'o Diminui atributo',
  marca: 'a Marca',
  invocacao: 'a Invocação',
  devolve: 'o Devolve o golpe',
}

function condicao(valor: unknown, onde: string): CondicaoDaPeca {
  const peca = registro(valor, `${onde} (condição)`)
  soChaves(peca, ['nome', 'turnos'], `${onde} (condição)`)
  return { nome: texto(peca.nome, NOME_DO_SELO_MAX, `${onde} (nome da condição)`), turnos: inteiro(peca.turnos, 1, TURNOS_DA_PECA_MAX, `${onde} (turnos da condição)`) }
}

function atributo(valor: unknown, onde: string): string {
  return texto(valor, ATRIBUTO_DA_PECA_MAX, `${onde} (atributo)`)
}

function resposta(valor: unknown, onde: string): RespostaDaPeca {
  const peca = registro(valor, onde)
  soChaves(peca, ['nome', 'bate', 'dano', 'condicao', 'perfuracao'], onde)
  const lida: RespostaDaPeca = { nome: texto(peca.nome, NOME_CURTO_MAX, `${onde} (nome)`), dano: inteiro(peca.dano ?? 0, -200, 200, `${onde} (dano)`), perfuracao: inteiro(peca.perfuracao ?? 0, 0, 100, `${onde} (% que passa do Escudo)`) }
  if (peca.bate !== undefined) lida.bate = umDe(peca.bate, BATIDAS, `${onde} (como bate)`)
  if (peca.condicao !== undefined) lida.condicao = condicao(peca.condicao, onde)
  return lida
}

function lerPergunta(peca: Cru, onde: string): PecaPergunta {
  soChaves(peca, ['tipo', 'perguntas', 'npc'], onde)
  const partida = PECA_DE_PARTIDA.pergunta
  const perguntas =
    peca.perguntas === undefined
      ? partida.perguntas
      : lista(peca.perguntas, 1, PERGUNTAS_MAX, `${onde} (perguntas)`).map((item, i): PerguntaDaPeca => {
          const ondeDela = `${onde} (pergunta ${i + 1})`
          const pergunta = registro(item, ondeDela)
          soChaves(pergunta, ['texto', 'respostas'], ondeDela)
          const respostas = lista(pergunta.respostas, RESPOSTAS_POR_PERGUNTA_MIN, RESPOSTAS_POR_PERGUNTA_MAX, `${ondeDela} (respostas)`).map((r, j) => resposta(r, `${ondeDela} (resposta ${j + 1})`))
          if (new Set(respostas.map((r) => r.nome.trim().toLocaleLowerCase('pt-BR'))).size !== respostas.length) torta(`${ondeDela}: duas respostas com o mesmo nome`)
          return { texto: texto(pergunta.texto, TEXTO_DA_PERGUNTA_MAX, `${ondeDela} (texto)`), respostas }
        })
  return { tipo: 'pergunta', perguntas, npc: umDe(peca.npc ?? partida.npc, ['primeira', 'mestre'] as const, `${onde} (NPC)`) }
}

function elemento(valor: unknown, onde: string): ElementoDaPeca {
  const peca = registro(valor, onde)
  soChaves(peca, ['id', 'nome', 'dano', 'condicao', 'sp', 'desvantagem'], onde)
  const id = umDe(peca.id, [...IDS_DOS_ELEMENTOS, 'proprio'] as const, `${onde} (qual elemento)`)
  // O de fábrica completa pela tabela; o próprio nasce neutro (o nome é obrigatório).
  const base: ElementoDaPeca = id === 'proprio' ? { id, nome: '', dano: 0, sp: 0, desvantagem: false } : elementoDeFabrica(id)
  const lido: ElementoDaPeca = {
    id,
    nome: texto(peca.nome ?? base.nome, NOME_CURTO_MAX, `${onde} (nome)`),
    dano: inteiro(peca.dano ?? base.dano, -200, 200, `${onde} (dano)`),
    sp: inteiro(peca.sp ?? base.sp, 0, 200, `${onde} (SP)`),
    desvantagem: simOuNao(peca.desvantagem ?? base.desvantagem, `${onde} (desvantagem)`),
  }
  // `condicao: null` tira a condição de fábrica (o Fogo sem queimar).
  if (peca.condicao === undefined && base.condicao !== undefined) lido.condicao = base.condicao
  else if (peca.condicao !== undefined && peca.condicao !== null) lido.condicao = condicao(peca.condicao, onde)
  return lido
}

function lerImbuir(peca: Cru, onde: string): PecaImbuir {
  soChaves(peca, ['tipo', 'elementos'], onde)
  if (peca.elementos === undefined) return PECA_DE_PARTIDA.imbuir
  const elementos = lista(peca.elementos, 0, ELEMENTOS_MAX, `${onde} (elementos)`).map((item, i) => elemento(item, `${onde} (elemento ${i + 1})`))
  const deFabrica = elementos.filter((item) => item.id !== 'proprio').map((item) => item.id)
  if (new Set(deFabrica).size !== deFabrica.length) torta(`${onde}: o mesmo elemento duas vezes`)
  if (new Set(elementos.map((item) => item.nome.trim().toLocaleLowerCase('pt-BR'))).size !== elementos.length) torta(`${onde}: dois elementos com o mesmo nome`)
  return { tipo: 'imbuir', elementos }
}

const QUANDOS: readonly QuandoOGatilhoDispara[] = ['inicio', 'comeco', 'rodada', 'vidaAbaixo', 'aoReceber', 'aoAcertar', 'aoCair']

function efeitoDoGatilho(valor: unknown, onde: string): EfeitoDoGatilho {
  const peca = registro(valor, onde)
  const tipo = umDe(peca.tipo, ['atributo', 'recuperar', 'escudo', 'condSi', 'condAlvo', 'aviso'] as const, `${onde} (tipo)`)
  switch (tipo) {
    case 'atributo': {
      soChaves(peca, ['tipo', 'atributo', 'valor', 'turnos'], onde)
      const valorLido = inteiro(peca.valor, -200, 200, `${onde} (quanto sobe)`)
      if (valorLido === 0) torta(`${onde}: o quanto sobe não pode ser 0`)
      return { tipo, atributo: atributo(peca.atributo, onde), valor: valorLido, turnos: inteiro(peca.turnos, 1, TURNOS_DA_PECA_MAX, `${onde} (turnos)`) }
    }
    case 'recuperar':
      soChaves(peca, ['tipo', 'recurso', 'valor', 'turnos'], onde)
      return { tipo, recurso: umDe(peca.recurso, ['hp', 'sp'] as const, `${onde} (vida ou SP)`), valor: inteiro(peca.valor, 1, 500, `${onde} (quanto recupera)`), turnos: inteiro(peca.turnos, 1, TURNOS_DA_PECA_MAX, `${onde} (turnos)`) }
    case 'escudo':
      soChaves(peca, ['tipo', 'valor'], onde)
      return { tipo, valor: inteiro(peca.valor, 1, 500, `${onde} (Escudo)`) }
    case 'condSi':
    case 'condAlvo':
      soChaves(peca, ['tipo', 'condicao'], onde)
      return { tipo, condicao: condicao(peca.condicao, onde) }
    case 'aviso':
      soChaves(peca, ['tipo', 'texto'], onde)
      return { tipo, texto: texto(peca.texto, AVISO_DO_GATILHO_MAX, `${onde} (texto do aviso)`) }
  }
}

function lerGatilho(peca: Cru, onde: string): PecaGatilho {
  soChaves(peca, ['tipo', 'quando', 'n', 'vezes', 'pergunta', 'ficaCom', 'efeitos'], onde)
  const partida = PECA_DE_PARTIDA.gatilho
  const quando = umDe(peca.quando ?? partida.quando, QUANDOS, `${onde} (quando)`)
  const efeitos = peca.efeitos === undefined ? partida.efeitos : lista(peca.efeitos, 1, EFEITOS_DO_GATILHO_MAX, `${onde} (efeitos)`).map((item, i) => efeitoDoGatilho(item, `${onde} (efeito ${i + 1})`))
  const lido: PecaGatilho = {
    tipo: 'gatilho',
    quando,
    n: inteiro(peca.n ?? partida.n, 1, 99, `${onde} (rodada ou %)`),
    vezes: umDe(peca.vezes ?? partida.vezes, ['sempre', 'umaPorBatalha'] as const, `${onde} (quantas vezes)`),
    pergunta: simOuNao(peca.pergunta ?? partida.pergunta, `${onde} (pergunta antes)`),
    efeitos,
  }
  if (peca.ficaCom !== undefined) {
    if (quando !== 'aoCair') torta(`${onde}: o "fica com N de vida" só vale no "Ao cair"`)
    lido.ficaCom = inteiro(peca.ficaCom, 1, 9999, `${onde} (vida que fica)`)
  }
  return lido
}

function lerRaca(peca: Cru, onde: string): PecaRaca {
  soChaves(peca, ['tipo', 'corta', 'cortaPorcento', 'soma', 'somaValor', 'somaEm', 'naoDesvia', 'naoDesviaQuem'], onde)
  const partida = PECA_DE_PARTIDA.raca
  return {
    tipo: 'raca',
    corta: simOuNao(peca.corta ?? partida.corta, `${onde} (corta)`),
    cortaPorcento: inteiro(peca.cortaPorcento ?? partida.cortaPorcento, 1, 90, `${onde} (% cortada)`),
    soma: simOuNao(peca.soma ?? partida.soma, `${onde} (soma)`),
    somaValor: inteiro(peca.somaValor ?? partida.somaValor, 1, 200, `${onde} (dano somado)`),
    somaEm: umDe(peca.somaEm ?? partida.somaEm, ['fisico', 'corpo'] as const, `${onde} (em que golpes)`),
    naoDesvia: simOuNao(peca.naoDesvia ?? partida.naoDesvia, `${onde} (não desvia)`),
    naoDesviaQuem: umDe(peca.naoDesviaQuem ?? partida.naoDesviaQuem, ['dono', 'alvo'] as const, `${onde} (quem não desvia)`),
  }
}

function modsDaForma(valor: unknown, minimo: number, onde: string): ModDaForma[] {
  const mods = lista(valor, minimo, MODS_DA_FORMA_MAX, onde).map((item, i): ModDaForma => {
    const ondeDele = `${onde} (atributo ${i + 1})`
    const peca = registro(item, ondeDele)
    soChaves(peca, ['atributo', 'valor'], ondeDele)
    const valorLido = inteiro(peca.valor, -200, 200, `${ondeDele} (quanto)`)
    if (valorLido === 0) torta(`${ondeDele}: o quanto não pode ser 0`)
    return { atributo: atributo(peca.atributo, ondeDele), valor: valorLido }
  })
  if (new Set(mods.map((mod) => mod.atributo)).size !== mods.length) torta(`${onde}: o mesmo atributo duas vezes`)
  return mods
}

function lerTransformacao(peca: Cru, onde: string): PecaTransformacao {
  soChaves(peca, ['tipo', 'dura', 'acoes', 'mods', 'danoRecebido', 'deslocamento', 'deslocamentoMax', 'grupo', 'naoErra', 'marca', 'fadiga', 'fadigaTurnos', 'fadigaMods'], onde)
  const partida = PECA_DE_PARTIDA.transformacao
  return {
    tipo: 'transformacao',
    dura: inteiro(peca.dura ?? partida.dura, 0, 20, `${onde} (quanto dura)`),
    acoes: inteiro(peca.acoes ?? partida.acoes, 0, 3, `${onde} (ações a mais)`),
    mods: peca.mods === undefined ? partida.mods : modsDaForma(peca.mods, 0, `${onde} (atributos)`),
    danoRecebido: inteiro(peca.danoRecebido ?? partida.danoRecebido, -90, 200, `${onde} (dano recebido)`),
    deslocamento: inteiro(peca.deslocamento ?? partida.deslocamento, -6, 6, `${onde} (deslocamento)`),
    deslocamentoMax: inteiro(peca.deslocamentoMax ?? partida.deslocamentoMax, 0, 12, `${onde} (deslocamento máximo)`),
    grupo: texto(peca.grupo ?? partida.grupo, NOME_CURTO_MAX, `${onde} (grupo)`, true),
    naoErra: simOuNao(peca.naoErra ?? partida.naoErra, `${onde} (não erra)`),
    marca: simOuNao(peca.marca ?? partida.marca, `${onde} (marca)`),
    fadiga: simOuNao(peca.fadiga ?? partida.fadiga, `${onde} (fadiga)`),
    fadigaTurnos: inteiro(peca.fadigaTurnos ?? partida.fadigaTurnos, 1, 10, `${onde} (turnos da Fadiga)`),
    fadigaMods: peca.fadigaMods === undefined ? partida.fadigaMods : modsDaForma(peca.fadigaMods, 0, `${onde} (o que a Fadiga tira)`),
  }
}

function itemDoStatus(valor: unknown, onde: string): ItemDoStatus {
  const peca = registro(valor, onde)
  soChaves(peca, ['atributo', 'modo', 'valor', 'porcento', 'de', 'dura', 'turnos'], onde)
  const base = PECA_DE_PARTIDA.status.itens[0]
  // O padrão de cada linha é o da primeira linha de partida (o que o "+ Atributo" põe).
  if (base === undefined) torta(`${onde}: a peça de partida não tem linha`)
  const modo = umDe(peca.modo ?? base.modo, ['fixo', 'formula'] as const, `${onde} (fixo ou fórmula)`)
  const lido: ItemDoStatus = {
    atributo: atributo(peca.atributo ?? base.atributo, onde),
    modo,
    valor: inteiro(peca.valor ?? base.valor, -200, 200, `${onde} (quanto)`),
    porcento: inteiro(peca.porcento ?? base.porcento, -200, 200, `${onde} (%)`),
    de: atributo(peca.de ?? base.de, `${onde} (de qual atributo)`),
    dura: umDe(peca.dura ?? base.dura, ['turnos', 'batalha', 'permanente'] as const, `${onde} (quanto tempo)`),
    turnos: inteiro(peca.turnos ?? base.turnos, 1, TURNOS_DA_PECA_MAX, `${onde} (turnos)`),
  }
  if ((modo === 'fixo' ? lido.valor : lido.porcento) === 0) torta(`${onde}: o quanto não pode ser 0`)
  return lido
}

function lerStatus(peca: Cru, onde: string): PecaStatus {
  soChaves(peca, ['tipo', 'quem', 'itens'], onde)
  const partida = PECA_DE_PARTIDA.status
  const itens = peca.itens === undefined ? partida.itens : lista(peca.itens, 1, ITENS_DO_STATUS_MAX, `${onde} (atributos)`).map((item, i) => itemDoStatus(item, `${onde} (linha ${i + 1})`))
  return { tipo: 'status', quem: umDe(peca.quem ?? partida.quem, ['si', 'aliado', 'todos'] as const, `${onde} (em quem)`), itens }
}

function lerDiminui(peca: Cru, onde: string): PecaDiminui {
  soChaves(peca, ['tipo', 'atributo', 'modo', 'valor', 'ritmo', 'dura', 'depoisDe', 'depoisVezes', 'teto', 'tetoValor', 'volta', 'voltaEm', 'nome'], onde)
  const partida = PECA_DE_PARTIDA.diminui
  return {
    tipo: 'diminui',
    atributo: atributo(peca.atributo ?? partida.atributo, onde),
    modo: umDe(peca.modo ?? partida.modo, ['fixo', 'porcento'] as const, `${onde} (pontos ou %)`),
    valor: inteiro(peca.valor ?? partida.valor, 1, 500, `${onde} (quanto perde)`),
    ritmo: umDe(peca.ritmo ?? partida.ritmo, ['umaVez', 'cadaTurno', 'depois'] as const, `${onde} (ritmo)`),
    dura: inteiro(peca.dura ?? partida.dura, 1, TURNOS_DA_PECA_MAX, `${onde} (turnos)`),
    depoisDe: inteiro(peca.depoisDe ?? partida.depoisDe, 1, TURNOS_DA_PECA_MAX, `${onde} (depois de quantos turnos)`),
    depoisVezes: umDe(peca.depoisVezes ?? partida.depoisVezes, ['uma', 'cada'] as const, `${onde} (quantas vezes)`),
    teto: simOuNao(peca.teto ?? partida.teto, `${onde} (teto)`),
    tetoValor: inteiro(peca.tetoValor ?? partida.tetoValor, 1, 500, `${onde} (teto da perda)`),
    volta: umDe(peca.volta ?? partida.volta, ['turnos', 'batalha', 'curar'] as const, `${onde} (quando volta)`),
    voltaEm: inteiro(peca.voltaEm ?? partida.voltaEm, 1, TURNOS_DA_PECA_MAX, `${onde} (volta depois de)`),
    nome: texto(peca.nome ?? partida.nome, NOME_DO_SELO_MAX, `${onde} (nome da condição)`),
  }
}

function lerMarca(peca: Cru, onde: string): PecaMarca {
  soChaves(peca, ['tipo', 'quando', 'paga', 'teste', 'nome', 'vezes', 'quem', 'some', 'turnos'], onde)
  const partida = PECA_DE_PARTIDA.marca
  return {
    tipo: 'marca',
    quando: umDe(peca.quando ?? partida.quando, ['aoAcertar', 'pergunta', 'tiro'] as const, `${onde} (quando marca)`),
    paga: inteiro(peca.paga ?? partida.paga, 0, 200, `${onde} (SP para marcar)`),
    teste: texto(peca.teste ?? partida.teste, ATRIBUTO_DA_PECA_MAX, `${onde} (teste)`, true),
    nome: texto(peca.nome ?? partida.nome, NOME_DO_SELO_MAX, `${onde} (nome)`),
    vezes: inteiro(peca.vezes ?? partida.vezes, 2, 5, `${onde} (vezes o dano)`),
    quem: umDe(peca.quem ?? partida.quem, ['dono', 'todos'] as const, `${onde} (quem aproveita)`),
    some: simOuNao(peca.some ?? partida.some, `${onde} (some)`),
    turnos: inteiro(peca.turnos ?? partida.turnos, 1, 10, `${onde} (turnos)`),
  }
}

function lerInvocacao(peca: Cru, onde: string): PecaInvocacao {
  soChaves(peca, ['tipo', 'nome', 'vida', 'dano', 'casas', 'max', 'concentracao', 'ultra', 'carga'], onde)
  const partida = PECA_DE_PARTIDA.invocacao
  return {
    tipo: 'invocacao',
    nome: texto(peca.nome ?? partida.nome, NOME_CURTO_MAX, `${onde} (nome)`),
    vida: inteiro(peca.vida ?? partida.vida, 1, 999, `${onde} (vida)`),
    dano: inteiro(peca.dano ?? partida.dano, 0, 300, `${onde} (dano)`),
    casas: inteiro(peca.casas ?? partida.casas, 1, 4, `${onde} (blocos)`),
    max: inteiro(peca.max ?? partida.max, 1, 6, `${onde} (quantas ao mesmo tempo)`),
    concentracao: inteiro(peca.concentracao ?? partida.concentracao, 0, 5, `${onde} (Concentração)`),
    ultra: simOuNao(peca.ultra ?? partida.ultra, `${onde} (Ultra)`),
    carga: inteiro(peca.carga ?? partida.carga, 1, 10, `${onde} (carga da Ultra)`),
  }
}

function lerDevolve(peca: Cru, onde: string): PecaDevolve {
  soChaves(peca, ['tipo', 'escolha', 'divide', 'soma'], onde)
  const partida = PECA_DE_PARTIDA.devolve
  return {
    tipo: 'devolve',
    escolha: simOuNao(peca.escolha ?? partida.escolha, `${onde} (duas saídas)`),
    divide: inteiro(peca.divide ?? partida.divide, 1, 20, `${onde} (divide por)`),
    soma: texto(peca.soma ?? partida.soma, ATRIBUTO_DA_PECA_MAX, `${onde} (atributo somado)`, true),
  }
}

const LEITORES: { readonly [F in FamiliaDaPeca]: (peca: Cru, onde: string) => PecaDa<F> } = {
  pergunta: lerPergunta,
  imbuir: lerImbuir,
  gatilho: lerGatilho,
  raca: lerRaca,
  transformacao: lerTransformacao,
  status: lerStatus,
  diminui: lerDiminui,
  marca: lerMarca,
  invocacao: lerInvocacao,
  devolve: lerDevolve,
}

function pecaLida(valor: unknown, indice: number): PecaDaMecanica {
  const peca = registro(valor, `peça ${indice + 1}`)
  const familia = umDe(peca.tipo, FAMILIAS_DAS_PECAS, `peça ${indice + 1} (família)`)
  return LEITORES[familia](peca, `${ONDE[familia]} (peça ${indice + 1})`)
}

/**
 * Lê o campo `pecas` da mecânica. Nunca lança: família ou chave desconhecida, número fora da faixa ou
 * família repetida (só o gatilho repete, até `GATILHOS_MAX`) = `{ ok: false, motivo }`.
 */
export function lerPecas(valor: unknown): PecasLidas {
  try {
    const pecas = lista(valor, 0, PECAS_MAX, 'peças').map(pecaLida)
    for (const familia of FAMILIAS_DAS_PECAS) {
      const quantas = pecasDo(pecas, familia).length
      const teto = familia === 'gatilho' ? GATILHOS_MAX : 1
      if (quantas > teto) torta(`${ONDE[familia]} entra ${teto === 1 ? 'uma vez só' : `até ${teto} vezes`} na mesma técnica`)
    }
    return { ok: true, pecas }
  } catch (erro) {
    if (erro instanceof PecaTorta) return { ok: false, motivo: erro.message }
    throw erro
  }
}

/** O que a mecânica diz de como entra em jogo, para conferir as peças (o `uso` e a Overload). */
export interface UsoParaAsPecas {
  uso?: 'ativa' | 'reacao' | 'ativaOuReacao' | 'passiva' | 'manter'
  overload: boolean
}

/**
 * Por que as peças não combinam com o jeito de usar, ou `null` (combinam). A peça que não teria como
 * rodar vira o motivo (tudo ou nada): Imbuir só na "Ligar e manter" (pergunta com ela ligada, D7);
 * Dispara sozinha e Passiva de raça só na passiva; Transformação na "Ligar e manter" ou na Overload;
 * Devolve só no lugar da reação; as peças do golpe (Pergunta, Diminui, Marca) e as de uso (Muda
 * atributo, Invocação) nunca na passiva nem na técnica só de reação.
 */
export function motivoDasPecasComOUso(pecas: readonly PecaDaMecanica[], { uso, overload }: UsoParaAsPecas): string | null {
  const passiva = uso === 'passiva'
  const deReacao = uso === 'reacao' || uso === 'ativaOuReacao'
  for (const peca of pecas) {
    const nome = ONDE[peca.tipo]
    switch (peca.tipo) {
      case 'imbuir':
        if (uso !== 'manter') return `${nome} só vale na técnica "Ligar e manter"`
        break
      case 'gatilho':
      case 'raca':
        if (!passiva) return `${nome} só vale na passiva`
        break
      case 'transformacao':
        if (uso !== 'manter' && !overload) return `${nome} só vale na "Ligar e manter" ou na Overload`
        break
      case 'devolve':
        if (!deReacao) return `${nome} só vale no lugar da reação`
        break
      case 'pergunta':
      case 'diminui':
      case 'marca':
      case 'status':
      case 'invocacao':
        if (passiva || uso === 'reacao') return `${nome} não vale na passiva nem na técnica só de reação`
        break
    }
  }
  return null
}

// ─── Gravar: só o que difere do padrão ─────────────────────────────────────

/** Igualdade de valor (JSON: número, texto, sim/não, lista, objeto). */
function iguais(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    const listaB: readonly unknown[] = b
    return a.every((item: unknown, i) => iguais(item, listaB[i]))
  }
  const chaves = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const chave of chaves) {
    const deA: unknown = Reflect.get(a, chave)
    const deB: unknown = Reflect.get(b, chave)
    if (!iguais(deA, deB)) return false
  }
  return true
}

/** Os campos de `valor` diferentes dos de `padrao` (o que vale guardar). */
function soOQueMuda(valor: object, padrao: object, fora: readonly string[]): Record<string, unknown> {
  const guardado: Record<string, unknown> = {}
  for (const chave of Object.keys(valor)) {
    const deValor: unknown = Reflect.get(valor, chave)
    if (fora.includes(chave) || deValor === undefined || iguais(deValor, Reflect.get(padrao, chave))) continue
    guardado[chave] = deValor
  }
  return guardado
}

/** O elemento do Imbuir como o disco o guarda: o de fábrica só com o que mudou (`condicao: null` = tirou a condição de fábrica). */
function elementoParaGuardar(elemento: ElementoDaPeca): Record<string, unknown> {
  if (elemento.id === 'proprio') return { ...elemento }
  const fabrica = elementoDeFabrica(elemento.id)
  const guardado: Record<string, unknown> = { id: elemento.id, ...soOQueMuda(elemento, fabrica, ['id']) }
  if (elemento.condicao === undefined && fabrica.condicao !== undefined) guardado.condicao = null
  return guardado
}

/**
 * A peça como o disco a guarda: a família e só os campos diferentes do padrão (`PECA_DE_PARTIDA`). As
 * listas vão inteiras quando diferem (os elementos do Imbuir, cada um só com o que mudou da fábrica).
 * O leitor devolve a MESMA peça (ida e volta sem perda).
 */
export function pecaParaGuardar(peca: PecaDaMecanica): Record<string, unknown> {
  const guardada: Record<string, unknown> = { tipo: peca.tipo, ...soOQueMuda(peca, PECA_DE_PARTIDA[peca.tipo], ['tipo']) }
  if (peca.tipo === 'imbuir' && guardada.elementos !== undefined) guardada.elementos = peca.elementos.map(elementoParaGuardar)
  return guardada
}

/** As peças como o disco as guarda (`pecaParaGuardar` em cada uma). */
export function pecasParaGuardar(pecas: readonly PecaDaMecanica[]): Record<string, unknown>[] {
  return pecas.map(pecaParaGuardar)
}
