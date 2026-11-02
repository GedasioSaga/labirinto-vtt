import { atributoComposto, maximoComposto } from '../../ajusteDaFicha'
import { MOTOR_PADRAO, motorDoSistema } from '../../motores'
import { numeroDaFicha, type Personagem } from '../../personagem'
import type { SistemaDeRpg } from '../../sistemaDeRpg'
import { MOVIMENTOS_MARCIAIS } from '../dados/movimentosMarciais'
import { RANKS_DE_TECNICA } from '../dados/ranks'
import { ROTULOS } from '../dados/rotulos'
import { TALENTOS } from '../dados/talentos'
import { ATRIBUTO_INICIAL, LIMITES_DBT, RANKS, type ContadorDBT, type FichaDBT, type RotuloDBT, type RotuloEscolhidoDBT, type TecnicaDBT } from '../modelo'
import { caDaFicha, deslocamento, epBase } from '../regras/ficha'
import { catalogoDeRotulos, indexarRanks, montarTecnica, nomeNormalizado } from '../regras/tecnicas'
import type { Atributo, IdDaCondicao, Rank } from './tipos'

/**
 * CONTRATO COM A FICHA (docs/planos/dbt-batalha.md, seção 3): o ÚNICO arquivo
 * da batalha que lê `modelo.ts` e `regras/*`. O motor recebe a forma abaixo;
 * se a ficha mudar de forma, ajusta-se só aqui. As contas puras das regras
 * que o motor usa saem daqui também (mesma porta).
 */
export { modificador } from '../regras/atributos'
export { danoDoEstagio, estagioPelaMargem, limiaresPelaDiferencaDeEP, MULTIPLICADOR_DO_CRITICO, NATURAL_DO_CRITICO, NATURAL_DO_ERRO_CRITICO, vitoriaAutomatica } from '../regras/dano'
export { CONDICOES } from '../dados/condicoes'

export interface TecnicaLida {
  id: string
  nome: string
  rank: Rank
  tipo: 'fisica' | 'ki' | 'magica' | 'hibrida'
  atributoDeAcerto: Atributo
  /** Custo de usar, já com a Exaustiva (o montador multiplica) ou o Ki à mão. */
  ki: number
  dano: { minimo: number; medio: number; completo: number }
  basica: boolean
  reativa: boolean
  defensiva: boolean
  /** CA somada pela barreira; 0 = não é barreira. */
  barreira: number
  cura: boolean
  salvaguarda: { atributo: Atributo } | null
  exaustiva: boolean
  /** Margem de crítico a mais (Golpe Crítico). */
  golpeCritico: number
  precisao: number
  dificuldade: number
  /** Estágios a mais no acerto (Técnica Devastadora). */
  estagiosExtras: number
  acumulacao: boolean
  rajadaContinua: boolean
  sangria: boolean
  esforcoSupremo: boolean
  verbal: boolean
  somatica: boolean
  previsivel: boolean
  efeitoNegativo: { condicao: IdDaCondicao } | null
  alcance: { tipo: 'toque' | 'curto' | 'longo' | 'area'; metros: number | null; queimaRoupa: boolean }
  /** Técnica especial: o mestre confirma efeito e dano. */
  especial: boolean
  uso: 'acao' | 'reacao' | 'ambos'
  /** Rótulos de tipo de dano (o efeito do gatilho é do mestre no v1). */
  gatilhos: readonly string[]
}

export interface TransformacaoLida {
  id: string
  nome: string
  estagio: number
  epBonus: number
  ki: number
  maxima: boolean
}

export interface MovimentoLido {
  id: string
  nome: string
  ki: number | null
  reacao: boolean
}

export interface FichaLida {
  personagemId: string
  nome: string
  jogador: boolean
  atributos: Readonly<Record<Atributo, number>>
  epBase: number
  /** 10 + mod DES + EP base + armadura (sem transformação, sem condição). */
  caBase: number
  pv: { atual: number; max: number }
  pk: { atual: number; max: number }
  /** Exaustão de batalhas anteriores (até Descanso Longo): `FichaDBT.kiBloqueado`. */
  pkBloqueadosDaFicha: number
  armaduraKiPorTurno: number
  /** Pelo PDL (tabela da p. 58); null = abaixo do Rank E. */
  rankMaximo: Rank | null
  usosTransfMaximaDesdeDescanso: number
  choqueDisponivel: boolean
  deslocamentoM: number
  /** Só as ativas. */
  tecnicas: readonly TecnicaLida[]
  transformacoes: readonly TransformacaoLida[]
  /** Movimentos marciais e talentos ativos com [KI: X]. */
  movimentos: readonly MovimentoLido[]
}

/**
 * Desgaste entre batalhas sem campo próprio na ficha: o `satisfies` de
 * `lib/personagem.ts` exigiria mexer na costura para um campo novo da
 * FichaDBT viajar. Os contadores da ficha já viajam (disco e rede) e aparecem
 * na ficha; o PK bloqueado usa o `kiBloqueado` que a ficha já tem.
 */
export const CONTADOR_USOS_TRANSF_MAXIMA = 'dbt-usos-transf-maxima'
export const CONTADOR_CHOQUE_USADO = 'dbt-choque-usado'
export const NOME_DO_CONTADOR: Readonly<Record<string, string>> = {
  [CONTADOR_USOS_TRANSF_MAXIMA]: 'Usos da transformação máxima',
  [CONTADOR_CHOQUE_USADO]: 'Choque de Poder usado',
}

function comContador(contadores: readonly ContadorDBT[], id: string, atual: number): ContadorDBT[] {
  if (contadores.some((contador) => contador.id === id)) return contadores.map((contador) => (contador.id === id ? { ...contador, atual } : contador))
  // Ficha no teto de contadores: o número não entra (o mestre anota à mão).
  if (contadores.length >= LIMITES_DBT.contadores) return [...contadores]
  return [...contadores, { id, nome: NOME_DO_CONTADOR[id] ?? id, atual, maximo: null }]
}

/** "Aplicar e encerrar" (seção 13): o desgaste da batalha entra na ficha até o Descanso Longo. */
export function fichaDepoisDoFim(ficha: FichaDBT, fim: { pkBloqueados: number; usosTransfMaxima: number; choqueUsado: boolean }): FichaDBT {
  const usos = contador(ficha, CONTADOR_USOS_TRANSF_MAXIMA) + fim.usosTransfMaxima
  const choque = contador(ficha, CONTADOR_CHOQUE_USADO) > 0 || fim.choqueUsado ? 1 : 0
  let contadores = comContador(ficha.contadores, CONTADOR_USOS_TRANSF_MAXIMA, usos)
  contadores = comContador(contadores, CONTADOR_CHOQUE_USADO, choque)
  return { ...ficha, kiBloqueado: fim.pkBloqueados, contadores }
}

const CATALOGO = catalogoDeRotulos(ROTULOS)
const POR_NOME = new Map(ROTULOS.map((rotulo) => [nomeNormalizado(rotulo.nome), rotulo]))
const TABELA_DE_RANKS = indexarRanks(RANKS_DE_TECNICA)
const MOVIMENTO_POR_ID = new Map(MOVIMENTOS_MARCIAIS.map((movimento) => [movimento.id, movimento]))
const TALENTO_POR_ID = new Map(TALENTOS.map((talento) => [talento.id, talento]))

const ALVO_UNICO: ReadonlySet<string> = new Set(['toque', 'avanco_ate_impacto', 'projetil_alvo_unico', 'parabolico_ate_alvo_ou_ponto', 'raio_de_fragmentacao'])
/** Até aqui é "curto": acima disso a técnica sofre desvantagem com inimigo adjacente (7.1). */
const ALCANCE_CURTO_M = 3
const KI_IMPRESSO = /\[KI:\s*(\d+)\]/i
const REACAO = /rea[cç][aã]o/i

const IDS_DAS_CONDICOES: readonly IdDaCondicao[] = [
  'atordoado',
  'desnorteado',
  'quebrado',
  'enraizado',
  'envenenado',
  'sangrando',
  'silenciado',
  'sobrecarregado',
  'quebra-de-guarda',
  'caido',
  'desequilibrado',
  'exposto',
  'paralisado',
  'intimidado',
  'cego',
  'lacuna-mental',
  'instavel',
  'confusao-mental',
  'controle-mental',
  'alucinacao-sensorial',
]

const ATRIBUTO_POR_PALAVRA: readonly [string, Atributo][] = [
  ['for', 'for'],
  ['forca', 'for'],
  ['des', 'des'],
  ['destreza', 'des'],
  ['con', 'con'],
  ['constituicao', 'con'],
  ['int', 'int'],
  ['inteligencia', 'int'],
  ['sab', 'sab'],
  ['sabedoria', 'sab'],
  ['pod', 'pod'],
  ['poder', 'pod'],
  ['pre', 'pre'],
  ['presenca', 'pre'],
]

/**
 * O rótulo pelo id; senão pelo nome, tolerante: as técnicas prontas trazem
 * o nome abreviado ("Estocada" para "Alcance – Estocada", "Básica").
 */
export function rotuloTolerante(idOuNome: string): RotuloDBT | null {
  const porId = CATALOGO.get(idOuNome)
  if (porId !== undefined) return porId
  const alvo = nomeNormalizado(idOuNome)
  if (alvo === '') return null
  const exato = POR_NOME.get(alvo)
  if (exato !== undefined) return exato
  for (const [nome, rotulo] of POR_NOME) if (nome.endsWith(` ${alvo}`) || nome.startsWith(`${alvo} `)) return rotulo
  return null
}

interface RotuloLido {
  nome: string
  rotulo: RotuloDBT | null
  escolhido: RotuloEscolhidoDBT | null
}

/** "Rótulos positivos (3): Estocada, Técnica Básica." da descrição da técnica pronta (`tecnicaDaPronta`). */
function rotulosImpressos(descricao: string): RotuloLido[] {
  const lidos: RotuloLido[] = []
  for (const linha of descricao.split('\n')) {
    const achado = /^R[oó]tulos (positivos|negativos)[^:]*:(.*)$/i.exec(linha.trim())
    if (achado === null) continue
    for (const pedaco of achado[2].split(',')) {
      const nome = pedaco.replace(/\.$/, '').trim()
      if (nome !== '') lidos.push({ nome: nomeNormalizado(nome), rotulo: rotuloTolerante(nome), escolhido: null })
    }
  }
  return lidos
}

function rotulosDaTecnica(tecnica: TecnicaDBT): RotuloLido[] {
  if (tecnica.rotulos.length === 0) return rotulosImpressos(tecnica.descricao)
  return tecnica.rotulos.map((escolhido) => {
    const rotulo = rotuloTolerante(escolhido.rotuloId)
    return { nome: nomeNormalizado(rotulo?.nome ?? escolhido.rotuloId), rotulo, escolhido }
  })
}

function contar(lidos: readonly RotuloLido[], nome: string): number {
  return lidos.filter((lido) => lido.nome === nome || lido.nome.endsWith(` ${nome}`)).length
}

function atributoDoTexto(texto: string, padrao: Atributo): Atributo {
  const palavras = new Set(nomeNormalizado(texto).split(' '))
  return ATRIBUTO_POR_PALAVRA.find(([palavra]) => palavras.has(palavra))?.[1] ?? padrao
}

function condicaoDoTexto(texto: string): IdDaCondicao | null {
  const limpo = ` ${nomeNormalizado(texto)} `
  return IDS_DAS_CONDICOES.find((id) => limpo.includes(` ${id.replace(/-/g, ' ')} `)) ?? null
}

function alcanceDaTecnica(tecnica: TecnicaDBT, lidos: readonly RotuloLido[]): TecnicaLida['alcance'] {
  const queimaRoupa = contar(lidos, 'tecnica a queima roupa') > 0
  for (const lido of lidos) {
    const alcance = lido.rotulo?.alcance
    if (alcance === undefined || alcance === null) continue
    const extras = lido.escolhido?.pontosExtras ?? 0
    const metros = alcance.inicialM === null ? null : alcance.inicialM + extras * (alcance.porPontoExtraM ?? 0)
    if (alcance.forma === 'toque') return { tipo: 'toque', metros, queimaRoupa }
    if (!ALVO_UNICO.has(alcance.forma)) return { tipo: 'area', metros, queimaRoupa }
    return { tipo: metros !== null && metros <= ALCANCE_CURTO_M ? 'curto' : 'longo', metros, queimaRoupa }
  }
  // Sem rótulo de alcance: a física é corpo a corpo; o resto, à distância.
  return { tipo: tecnica.tipo === 'fisica' ? 'toque' : 'longo', metros: null, queimaRoupa }
}

function usoDaTecnica(tecnica: TecnicaDBT, defensiva: boolean, reativa: boolean, barreira: boolean): TecnicaLida['uso'] {
  const momento = tecnica.especial?.momento
  if (momento === 'reacao') return 'reacao'
  if (momento === 'acao-ou-reacao') return 'ambos'
  if (defensiva) return 'reacao'
  if (reativa || barreira) return 'ambos'
  return 'acao'
}

function lerTecnica(tecnica: TecnicaDBT): TecnicaLida {
  const lidos = rotulosDaTecnica(tecnica)
  const linhaDoRank = TABELA_DE_RANKS === null ? null : TABELA_DE_RANKS[tecnica.rank]
  const montada = linhaDoRank === null ? null : montarTecnica(tecnica, { rank: linhaDoRank, rotulos: CATALOGO })
  const ki = montada?.ki ?? tecnica.kiManual ?? 0
  const dano = montada?.faixa ?? tecnica.danoManual ?? { minimo: 0, medio: 0, completo: 0 }
  const defensiva = contar(lidos, 'tecnica defensiva') > 0 || tecnica.efeitoDaFaixa === 'mitigacao'
  const reativa = contar(lidos, 'tecnica reativa') > 0
  const barreiras = contar(lidos, 'tecnica de barreira') + contar(lidos, 'adicionar classe de armadura')
  const barreira = tecnica.efeitoDaFaixa === 'ca' ? Math.max(1, dano.completo) : barreiras
  const salvaguarda = lidos.find((lido) => lido.nome === 'adicionar salvaguarda')
  // A condição do Efeito Negativo vem na nota do rótulo; técnica pronta não traz nota (o mestre aplica).
  const notaDoNegativo = lidos.find((lido) => lido.nome === 'efeito negativo')?.escolhido?.nota
  const condicao = notaDoNegativo === undefined ? null : condicaoDoTexto(notaDoNegativo)
  return {
    id: tecnica.id,
    nome: tecnica.nome,
    rank: tecnica.rank,
    tipo: tecnica.tipo,
    atributoDeAcerto: tecnica.atributo,
    ki,
    dano: { minimo: dano.minimo, medio: dano.medio, completo: dano.completo },
    basica: contar(lidos, 'tecnica basica') > 0,
    reativa,
    defensiva,
    barreira,
    cura: tecnica.efeitoDaFaixa === 'cura' || contar(lidos, 'adicionar cura') > 0,
    salvaguarda: salvaguarda === undefined ? null : { atributo: atributoDoTexto(salvaguarda.escolhido?.nota ?? '', 'con') },
    exaustiva: contar(lidos, 'exaustiva') > 0,
    golpeCritico: contar(lidos, 'golpe critico'),
    precisao: montada?.acertoExtra ?? 0,
    dificuldade: contar(lidos, 'aumentar dificuldade'),
    estagiosExtras: contar(lidos, 'tecnica devastadora'),
    acumulacao: contar(lidos, 'tecnica de acumulacao ki') > 0,
    rajadaContinua: contar(lidos, 'rajada continua') > 0,
    sangria: contar(lidos, 'sangria') > 0,
    esforcoSupremo: contar(lidos, 'esforco supremo') > 0,
    verbal: contar(lidos, 'verbal') > 0,
    somatica: contar(lidos, 'somatica') > 0,
    previsivel: contar(lidos, 'previsivel') > 0,
    efeitoNegativo: condicao === null ? null : { condicao },
    alcance: alcanceDaTecnica(tecnica, lidos),
    especial: tecnica.especial !== null,
    uso: usoDaTecnica(tecnica, defensiva, reativa, barreira > 0),
    gatilhos: lidos.filter((lido) => lido.rotulo?.categoria === 'tipo_dano').map((lido) => lido.rotulo?.nome ?? lido.nome),
  }
}

/** O maior rank cujo PDL recomendado a ficha já passou (p. 58). */
function rankMaximoPorPdl(pdl: number): Rank | null {
  let maximo: Rank | null = null
  for (const rank of RANKS) {
    const linha = TABELA_DE_RANKS?.[rank]
    if (linha !== undefined && pdl >= linha.pdl) maximo = rank
  }
  return maximo
}

function contador(ficha: FichaDBT, id: string): number {
  return ficha.contadores.find((candidato) => candidato.id === id)?.atual ?? 0
}

function kiDoTexto(texto: string): number | null {
  const achado = KI_IMPRESSO.exec(texto)
  return achado === null ? null : Number(achado[1])
}

function movimentosDaFicha(ficha: FichaDBT): MovimentoLido[] {
  const movimentos = ficha.movimentos.map((movimento): MovimentoLido => {
    const doLivro = movimento.livroId === null ? undefined : MOVIMENTO_POR_ID.get(movimento.livroId)
    const efeito = `${doLivro?.efeito ?? ''} ${movimento.efeito}`
    return { id: movimento.id, nome: movimento.nome, ki: movimento.custoKi ?? doLivro?.custoKi ?? kiDoTexto(efeito), reacao: REACAO.test(efeito) }
  })
  const talentos = ficha.talentos.flatMap((talento): MovimentoLido[] => {
    const doLivro = talento.livroId === null ? undefined : TALENTO_POR_ID.get(talento.livroId)
    const efeito = `${doLivro?.efeito ?? ''} ${talento.efeito}`
    const ki = talento.custoKi ?? kiDoTexto(efeito)
    return ki === null ? [] : [{ id: talento.id, nome: talento.nome, ki, reacao: REACAO.test(efeito) }]
  })
  return [...movimentos, ...talentos]
}

function transformacoesDaFicha(ficha: FichaDBT): TransformacaoLida[] {
  const maiorEstagio = ficha.transformacoes.reduce((maior, forma) => Math.max(maior, forma.estagio), 0)
  return ficha.transformacoes.map((forma) => ({ id: forma.id, nome: forma.nome, estagio: forma.estagio, epBonus: forma.ep, ki: forma.custoKi, maxima: forma.estagio === maiorEstagio }))
}

/** A ficha pela batalha; null = sem `dbt` (combatente manual) ou sistema de outro motor. */
export function lerFichaParaBatalha(personagem: Personagem, sistema: SistemaDeRpg | null): FichaLida | null {
  const ficha = personagem.dbt
  if (ficha === undefined) return null
  if (sistema !== null && motorDoSistema(sistema) === MOTOR_PADRAO) return null
  const valor = (id: Atributo): number => (personagem.atributos[id] === undefined ? ATRIBUTO_INICIAL : atributoComposto(personagem, id).total)
  const atributos: Record<Atributo, number> = { for: valor('for'), des: valor('des'), con: valor('con'), int: valor('int'), sab: valor('sab'), pod: valor('pod'), pre: valor('pre') }
  const base = epBase(ficha)
  return {
    personagemId: personagem.id,
    nome: personagem.nome,
    jogador: personagem.tipo === 'jogador',
    atributos,
    epBase: base.valor,
    caBase: caDaFicha(ficha, atributos, base).valor,
    pv: { atual: numeroDaFicha(personagem.recursos, 'pv'), max: maximoComposto(personagem, 'pv').total },
    pk: { atual: numeroDaFicha(personagem.recursos, 'pk'), max: maximoComposto(personagem, 'pk').total },
    pkBloqueadosDaFicha: ficha.kiBloqueado,
    armaduraKiPorTurno: ficha.inventario.reduce((soma, item) => (item.equipado ? soma + item.kiPorTurno : soma), 0),
    rankMaximo: rankMaximoPorPdl(ficha.pdl),
    usosTransfMaximaDesdeDescanso: contador(ficha, CONTADOR_USOS_TRANSF_MAXIMA),
    choqueDisponivel: contador(ficha, CONTADOR_CHOQUE_USADO) === 0,
    deslocamentoM: deslocamento(ficha).valor,
    tecnicas: ficha.tecnicas.filter((tecnica) => tecnica.ativa).map(lerTecnica),
    transformacoes: transformacoesDaFicha(ficha),
    movimentos: movimentosDaFicha(ficha),
  }
}

/** As fichas de quem está na batalha, por personagem. */
export function fichasDaCena(
  personagens: readonly Personagem[],
  sistema: SistemaDeRpg | null,
  combatentes: readonly { personagemId: string | null }[],
): Map<string, FichaLida | null> {
  const ids = new Set(combatentes.flatMap((combatente) => (combatente.personagemId === null ? [] : [combatente.personagemId])))
  const fichas = new Map<string, FichaLida | null>()
  for (const personagem of personagens) if (ids.has(personagem.id)) fichas.set(personagem.id, lerFichaParaBatalha(personagem, sistema))
  return fichas
}
