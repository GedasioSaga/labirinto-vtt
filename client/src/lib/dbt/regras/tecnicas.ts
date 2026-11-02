/**
 * DRAGON BALL TALES — o MONTADOR de técnica (Cap. IV, p. 56-92). Puro: recebe
 * a linha do rank e o catálogo de rótulos por parâmetro (lib/dbt/dados/ é de
 * outro módulo) e devolve orçamento, Ki, dano, faixa e a lista de avisos em
 * português para a tela. Nada aqui bloqueia: quem decide recusar é a tela,
 * pelo `valida`.
 */
import {
  ATRIBUTO_DO_TIPO,
  type FaixaDeDanoDBT,
  type IdAtributoDBT,
  type RankDBT,
  type RankDeTecnica,
  type RotuloDBT,
  type RotuloEscolhidoDBT,
  type TecnicaDBT,
  type TecnicaEspecialDBT,
  type TipoDeTecnicaDBT,
} from '../modelo'
import { SIGLA_DO_ATRIBUTO, milhar } from './atributos'

// ───────────────────────────────────────────────────────────────────────────
// Tabelas e catálogos recebidos
// ───────────────────────────────────────────────────────────────────────────

/** A tabela de rank (6.0.2, p. 58) indexada pelo rank. */
export type TabelaDeRanksDBT = Readonly<Record<RankDBT, RankDeTecnica>>

/** Indexa a lista do catálogo; null quando falta algum rank (catálogo torto). */
export function indexarRanks(lista: readonly RankDeTecnica[]): TabelaDeRanksDBT | null {
  const porRank = new Map(lista.map((linha) => [linha.rank, linha]))
  const E = porRank.get('E')
  const D = porRank.get('D')
  const C = porRank.get('C')
  const B = porRank.get('B')
  const A = porRank.get('A')
  const Z = porRank.get('Z')
  if (!E || !D || !C || !B || !A || !Z) return null
  return { E, D, C, B, A, Z }
}

/** O catálogo de rótulos pelo id, montado uma vez por quem chama o montador. */
export function catalogoDeRotulos(lista: readonly RotuloDBT[]): ReadonlyMap<string, RotuloDBT> {
  return new Map(lista.map((rotulo) => [rotulo.id, rotulo]))
}

/**
 * "Alcance – Engolfante" → "alcance engolfante": sem acento, sem traço, minúsculo.
 * Os rótulos não têm id no livro; os poucos com regra própria aqui são achados pelo nome.
 */
export function nomeNormalizado(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// ───────────────────────────────────────────────────────────────────────────
// Constantes do livro
// ───────────────────────────────────────────────────────────────────────────

/** Custo do rótulo base de tipo, em pontos positivos (p. 61). Conta no orçamento. */
export const CUSTO_DO_TIPO: Readonly<Record<TipoDeTecnicaDBT, number>> = {
  fisica: 0,
  ki: 0,
  magica: 1,
  hibrida: 2,
}

export const NOME_DO_TIPO: Readonly<Record<TipoDeTecnicaDBT, string>> = {
  fisica: 'Técnica Física',
  ki: 'Técnica de Ki',
  magica: 'Técnica Mágica',
  hibrida: 'Técnica Híbrida',
}

/** Aumentar Dano por Ki: cada 1 Ki investido soma +4 no dano base (p. 74). */
export const DANO_POR_KI_INVESTIDO = 4

const AUMENTAR_DANO_POR_KI = 'aumentar dano por ki'
const EFEITO_NEGATIVO = 'efeito negativo'
const AUMENTAR_PRECISAO = 'aumentar precisao'
const DIMINUIR_PRECISAO = 'diminuir precisao'

/**
 * Formas de alcance de alvo único. Qualquer outro alcance é área, e aí o
 * Efeito Negativo consome antes todos os positivos base (p. 76). O Arco cai
 * num ponto: só vira área quando outro alcance de área entra junto. A
 * Fragmentação tem raio, mas divide o dano de um acerto só e continua sendo
 * alvo único (p. 71).
 */
const FORMAS_DE_ALVO_UNICO: ReadonlySet<string> = new Set(['toque', 'avanco_ate_impacto', 'projetil_alvo_unico', 'parabolico_ate_alvo_ou_ponto', 'raio_de_fragmentacao'])

/** Os três estágios de efeito: ¼, ½ e inteiro, arredondando para baixo (p. 59: ¼ de 50 = 12; o NPC Esfera de Ki D imprime 08-17-34). */
export function faixaDoDano(base: number): FaixaDeDanoDBT {
  return { minimo: Math.floor(base / 4), medio: Math.floor(base / 2), completo: base }
}

// ───────────────────────────────────────────────────────────────────────────
// O resultado
// ───────────────────────────────────────────────────────────────────────────

export type GravidadeDoAvisoDBT = 'erro' | 'atencao'

export type CodigoDoAvisoDBT =
  | 'orcamento'
  | 'negativos'
  | 'rotulo-desconhecido'
  | 'tipo-repetido'
  | 'nao-acumula'
  | 'escolha-pendente'
  | 'valor-fora-da-faixa'
  | 'extras-ignorados'
  | 'efeito-negativo-em-area'
  | 'teto-do-ki'
  | 'teto-do-dano'
  | 'atributo-do-tipo'
  | 'magica-sem-mago'
  | 'pdl-baixo'
  | 'especial-com-rotulos'
  | 'especial-ki-baixo'
  | 'especial-pendente'

export interface AvisoDaTecnicaDBT {
  /** 'erro' quebra regra do livro (a técnica não é válida); 'atencao' é lembrete ou ajuste automático. */
  gravidade: GravidadeDoAvisoDBT
  codigo: CodigoDoAvisoDBT
  texto: string
}

/** Uma linha da conta: o que cada rótulo escolhido custou. */
export interface RotuloNaTecnicaDBT {
  rotuloId: string
  /** Do catálogo; o próprio id quando o rótulo não está no livro. */
  nome: string
  /** Com sinal: negativo devolve pontos. */
  pontos: number
  ki: number
  /** Só Aumentar Dano por Ki. */
  dano: number
}

export interface TecnicaMontadaDBT {
  /** Pontos positivos grátis do rank. */
  pontosBase: number
  custoDoTipo: number
  /** Soma dos positivos, com o tipo. */
  positivos: number
  /** Soma dos negativos, em valor absoluto. */
  negativos: number
  /** Teto de negativos = pontos base (p. 60, contado em pontos como no exemplo da p. 86). */
  limiteDeNegativos: number
  /** Pontos base + negativos até o limite. */
  orcamento: number
  /** orçamento − positivos; negativo = estourou. */
  sobra: number
  rotulos: RotuloNaTecnicaDBT[]
  /** Ki mínimo do rank + rótulos, com teto do rank, antes do multiplicador. */
  kiCalculado: number
  /** Exaustiva dobra o Ki no uso. */
  multiplicadorDoKi: number
  /** O que custa usar: `kiManual` vence; senão a conta × multiplicador. */
  ki: number
  /** Dano base (o "completo"). */
  danoBase: number
  /** `danoManual` vence. */
  faixa: FaixaDeDanoDBT
  /** +1 por Aumentar Precisão, −1 por Diminuir Precisão (p. 74, 80). */
  acertoExtra: number
  manual: { ki: boolean; dano: boolean }
  formulaDoKi: string
  formulaDoDano: string
  avisos: AvisoDaTecnicaDBT[]
  /** Restrições de combinação do livro, em texto, para o mestre conferir (não são checadas por máquina). */
  lembretes: string[]
  /** Nenhum aviso de gravidade 'erro'. */
  valida: boolean
}

export interface ContextoDoMontadorDBT {
  /** A linha do rank da técnica. */
  rank: RankDeTecnica
  /** `catalogoDeRotulos(ROTULOS)`. */
  rotulos: ReadonlyMap<string, RotuloDBT>
  /** PDL de quem aprende: abaixo do recomendado do rank vira aviso. Ausente = não confere. */
  pdl?: number
  /** Tem Mago de Ki (ou raça/talento que libera): false vira aviso na técnica mágica. Ausente = não confere. */
  podeUsarMagica?: boolean
}

// ───────────────────────────────────────────────────────────────────────────
// O montador
// ───────────────────────────────────────────────────────────────────────────

function aviso(gravidade: GravidadeDoAvisoDBT, codigo: CodigoDoAvisoDBT, texto: string): AvisoDaTecnicaDBT {
  return { gravidade, codigo, texto }
}

function ehRotuloDeTipo(rotulo: RotuloDBT): boolean {
  return rotulo.categoria === 'base' && rotulo.alcance === null && nomeNormalizado(rotulo.nome).startsWith('tecnica')
}

/** Pontos investidos acima do mínimo só existem no custo "X a Variável". */
function aceitaPontosExtras(rotulo: RotuloDBT): boolean {
  return rotulo.custo.tipo === 'variavel' && rotulo.custo.minimo !== null
}

/** Custo em pontos, com sinal (6.0.3, p. 60). */
function pontosDoRotulo(escolhido: RotuloEscolhidoDBT, rotulo: RotuloDBT, pontosBase: number, avisos: AvisoDaTecnicaDBT[]): number {
  const sinal = rotulo.categoria === 'negativo' ? -1 : 1
  const custo = rotulo.custo
  switch (custo.tipo) {
    case 'fixo':
      return custo.pontos
    case 'consome-tudo':
      return pontosBase
    case 'faixa': {
      if (escolhido.variavel === null) {
        avisos.push(aviso('atencao', 'escolha-pendente', `${rotulo.nome}: escolha o valor (${rotulo.custoTexto}); por enquanto conta ${custo.minimo}.`))
        return custo.minimo
      }
      const preso = Math.min(Math.max(custo.minimo, custo.maximo), Math.max(Math.min(custo.minimo, custo.maximo), escolhido.variavel))
      if (preso !== escolhido.variavel) {
        avisos.push(aviso('atencao', 'valor-fora-da-faixa', `${rotulo.nome}: o valor vai de ${custo.minimo} a ${custo.maximo}; conta ${preso}.`))
      }
      return preso
    }
    case 'variavel':
      // "Carregamento (-1 a Variável)": cada ponto extra afunda mais o negativo.
      if (custo.minimo !== null) return custo.minimo + sinal * Math.max(0, escolhido.pontosExtras)
      if (escolhido.variavel === null) {
        avisos.push(aviso('atencao', 'escolha-pendente', `${rotulo.nome}: escolha quantos pontos (${rotulo.custoTexto}); por enquanto conta 0.`))
        return 0
      }
      return sinal * Math.abs(escolhido.variavel)
    case 'igual-ao-efeito-negativo':
      if (escolhido.variavel === null) {
        avisos.push(aviso('atencao', 'escolha-pendente', `${rotulo.nome}: escolha a condição; o rótulo devolve o valor dela. Por enquanto conta 0.`))
        return 0
      }
      return -Math.abs(escolhido.variavel)
  }
}

/** Ki por unidade investida fora dos pontos (Fragmentação: +4 por 1,5 m de raio): o maior número em `outros`. */
function kiPorUnidadeInvestida(rotulo: RotuloDBT): number {
  const outros = rotulo.modificadorDeKi === null ? {} : rotulo.modificadorDeKi.outros
  let maior = 0
  for (const valor of Object.values(outros)) if (typeof valor === 'number' && valor > maior) maior = valor
  return maior
}

interface ContaDoRotulo {
  ki: number
  dano: number
  multiplicador: number
}

/** Ki e dano que o rótulo soma (6.1-6.5, campos de `ModificadorDeKiDoRotuloDBT`). */
function contaDoRotulo(escolhido: RotuloEscolhidoDBT, rotulo: RotuloDBT, pontos: number, extras: number): ContaDoRotulo {
  const mod = rotulo.modificadorDeKi
  let ki = 0
  let dano = 0
  if (mod !== null) {
    ki += mod.inicial ?? 0
    ki += (mod.porPontoExtra ?? 0) * extras
    ki += mod.porRotulo ?? 0
    // Dreno de Ki: +3 Ki por ponto negativo que devolve.
    if (pontos < 0) ki += (mod.porPontoNegativo ?? 0) * Math.abs(pontos)
  }
  const investimento = Math.max(0, escolhido.investimento)
  if (investimento > 0) {
    if (nomeNormalizado(rotulo.nome) === AUMENTAR_DANO_POR_KI) {
      ki += investimento
      dano += DANO_POR_KI_INVESTIDO * investimento
    } else {
      ki += investimento * kiPorUnidadeInvestida(rotulo)
    }
  }
  return { ki, dano, multiplicador: mod === null ? 1 : (mod.multiplicador ?? 1) }
}

function ehAlcanceDeArea(rotulo: RotuloDBT): boolean {
  return rotulo.alcance !== null && !FORMAS_DE_ALVO_UNICO.has(rotulo.alcance.forma)
}

function avisosDoTipo(tecnica: TecnicaDBT, contexto: ContextoDoMontadorDBT): AvisoDaTecnicaDBT[] {
  const avisos: AvisoDaTecnicaDBT[] = []
  const atributoDoTipo = ATRIBUTO_DO_TIPO[tecnica.tipo]
  const permitidosNaHibrida: readonly IdAtributoDBT[] = ['for', 'int', 'pre']
  if (tecnica.tipo === 'hibrida') {
    if (!permitidosNaHibrida.includes(tecnica.atributo)) {
      avisos.push(aviso('atencao', 'atributo-do-tipo', `Técnica Híbrida acerta com FOR, INT ou PRE, conforme o tipo base; esta usa ${SIGLA_DO_ATRIBUTO[tecnica.atributo]} (p. 61).`))
    }
  } else if (tecnica.atributo !== atributoDoTipo) {
    avisos.push(aviso('atencao', 'atributo-do-tipo', `${NOME_DO_TIPO[tecnica.tipo]} acerta com ${SIGLA_DO_ATRIBUTO[atributoDoTipo]}; esta usa ${SIGLA_DO_ATRIBUTO[tecnica.atributo]} (p. 61).`))
  }
  if (tecnica.tipo === 'magica' && contexto.podeUsarMagica === false) {
    avisos.push(aviso('atencao', 'magica-sem-mago', 'Técnica Mágica pede o talento Mago de Ki, salvo raça ou talento que libere (p. 61).'))
  }
  if (contexto.pdl !== undefined && contexto.pdl < contexto.rank.pdl) {
    avisos.push(aviso('atencao', 'pdl-baixo', `O rank ${contexto.rank.rank} pede ${milhar(contexto.rank.pdl)} PDL para aprender (p. 59); a ficha tem ${milhar(contexto.pdl)}.`))
  }
  return avisos
}

function lembretesDosRotulos(usados: readonly RotuloDBT[]): string[] {
  const vistos = new Set<string>()
  const lembretes: string[] = []
  for (const rotulo of usados) {
    if (vistos.has(rotulo.id)) continue
    vistos.add(rotulo.id)
    for (const restricao of rotulo.restricoes) lembretes.push(`${rotulo.nome}: ${restricao}`)
  }
  return lembretes
}

/** Monta a técnica: orçamento de rótulos, Ki, dano, faixa e avisos. Técnica especial segue regra própria. */
export function montarTecnica(tecnica: TecnicaDBT, contexto: ContextoDoMontadorDBT): TecnicaMontadaDBT {
  if (tecnica.especial !== null) return montarEspecial(tecnica, tecnica.especial, contexto)

  const rank = contexto.rank
  const pontosBase = rank.pontosDeRotuloBase
  const avisos = avisosDoTipo(tecnica, contexto)
  const custoDoTipo = CUSTO_DO_TIPO[tecnica.tipo]

  // Primeiro os rótulos que existem e contam (o tipo repetido na lista não conta de novo).
  const validos: { escolhido: RotuloEscolhidoDBT; rotulo: RotuloDBT }[] = []
  for (const escolhido of tecnica.rotulos) {
    const rotulo = contexto.rotulos.get(escolhido.rotuloId)
    if (rotulo === undefined) {
      avisos.push(aviso('erro', 'rotulo-desconhecido', `O rótulo "${escolhido.rotuloId}" não está no livro.`))
    } else if (ehRotuloDeTipo(rotulo)) {
      avisos.push(aviso('atencao', 'tipo-repetido', `O tipo já vem do campo Tipo: "${rotulo.nome}" na lista de rótulos não conta.`))
    } else {
      validos.push({ escolhido, rotulo })
    }
  }

  const emArea = validos.some(({ rotulo }) => ehAlcanceDeArea(rotulo))
  const copias = new Map<string, number>()
  const linhas: RotuloNaTecnicaDBT[] = []
  let somaKi = 0
  let somaDano = 0
  let multiplicadorDoKi = 1
  let acertoExtra = 0
  for (const { escolhido, rotulo } of validos) {
    copias.set(rotulo.id, (copias.get(rotulo.id) ?? 0) + 1)
    const extras = aceitaPontosExtras(rotulo) ? Math.max(0, escolhido.pontosExtras) : 0
    if (!aceitaPontosExtras(rotulo) && escolhido.pontosExtras > 0) {
      avisos.push(aviso('atencao', 'extras-ignorados', `${rotulo.nome} não aceita pontos extras (${rotulo.custoTexto}); os ${escolhido.pontosExtras} não contam.`))
    }
    let pontos = pontosDoRotulo(escolhido, rotulo, pontosBase, avisos)
    const nome = nomeNormalizado(rotulo.nome)
    if (nome === EFEITO_NEGATIVO && emArea) {
      pontos += pontosBase
      avisos.push(aviso('atencao', 'efeito-negativo-em-area', `Em técnica de área, o Efeito Negativo consome antes todos os ${pontosBase} positivos base e depois o valor da condição (p. ${rotulo.pagina}).`))
    }
    if (nome === AUMENTAR_PRECISAO) acertoExtra += 1
    if (nome === DIMINUIR_PRECISAO) acertoExtra -= 1
    const conta = contaDoRotulo(escolhido, rotulo, pontos, extras)
    somaKi += conta.ki
    somaDano += conta.dano
    multiplicadorDoKi *= conta.multiplicador
    linhas.push({ rotuloId: rotulo.id, nome: rotulo.nome, pontos, ki: conta.ki, dano: conta.dano })
  }
  for (const { rotulo } of validos) {
    const quantas = copias.get(rotulo.id) ?? 0
    if (rotulo.acumula === false && quantas > 1) {
      avisos.push(aviso('erro', 'nao-acumula', `${rotulo.nome} não acumula: entra uma vez só (está ${quantas} vezes).`))
      copias.delete(rotulo.id)
    }
  }

  // Orçamento (p. 60): positivos ≤ base + negativos, e negativos ≤ base (em pontos, como no exemplo da p. 86).
  const positivos = custoDoTipo + linhas.reduce((soma, linha) => soma + Math.max(0, linha.pontos), 0)
  const negativos = linhas.reduce((soma, linha) => soma + Math.max(0, -linha.pontos), 0)
  const orcamento = pontosBase + Math.min(negativos, pontosBase)
  if (negativos > pontosBase) {
    avisos.push(aviso('erro', 'negativos', `Os negativos somam ${negativos} pontos; o rank ${rank.rank} aceita no máximo ${pontosBase} (p. 60).`))
  }
  if (positivos > orcamento) {
    avisos.push(aviso('erro', 'orcamento', `Os positivos custam ${positivos} pontos e o orçamento do rank ${rank.rank} é ${orcamento} (${pontosBase} do rank + ${Math.min(negativos, pontosBase)} de negativos).`))
  }

  // Ki = mínimo do rank + rótulos, com teto do rank (p. 58-59).
  const kiSemTeto = rank.kiMin + somaKi
  const kiCalculado = Math.min(rank.kiMax, kiSemTeto)
  if (kiSemTeto > rank.kiMax) {
    avisos.push(aviso('atencao', 'teto-do-ki', `O Ki passou do teto do rank ${rank.rank} (${rank.kiMax}): fica ${rank.kiMax} (p. 58).`))
  }
  const partesDoKi = linhas.filter((linha) => linha.ki !== 0).map((linha) => ` + ${linha.nome} ${linha.ki}`)
  let formulaDoKi = `Ki mínimo do rank ${rank.rank} ${rank.kiMin}${partesDoKi.join('')} = ${kiSemTeto}`
  if (kiSemTeto > rank.kiMax) formulaDoKi += `, teto ${rank.kiMax}`
  if (multiplicadorDoKi !== 1) formulaDoKi += `; × ${multiplicadorDoKi} no uso = ${kiCalculado * multiplicadorDoKi}`

  // Dano base = mínimo do rank + Aumentar Dano por Ki, com teto (p. 59, 74).
  const danoSemTeto = rank.danoMin + somaDano
  const danoBase = Math.min(rank.danoMax, danoSemTeto)
  if (danoSemTeto > rank.danoMax) {
    avisos.push(aviso('atencao', 'teto-do-dano', `O dano passou do teto do rank ${rank.rank} (${rank.danoMax}): fica ${rank.danoMax}; o Ki investido além disso não soma dano (p. 74).`))
  }
  const partesDoDano = linhas.filter((linha) => linha.dano !== 0).map((linha) => ` + ${linha.nome} ${linha.dano}`)
  let formulaDoDano = `Dano mínimo do rank ${rank.rank} ${rank.danoMin}${partesDoDano.join('')} = ${danoSemTeto}`
  if (danoSemTeto > rank.danoMax) formulaDoDano += `, teto ${rank.danoMax}`

  return fechar({
    pontosBase,
    custoDoTipo,
    positivos,
    negativos,
    limiteDeNegativos: pontosBase,
    orcamento,
    sobra: orcamento - positivos,
    rotulos: linhas,
    kiCalculado,
    multiplicadorDoKi,
    danoBase,
    acertoExtra,
    formulaDoKi,
    formulaDoDano,
    avisos,
    lembretes: lembretesDosRotulos(validos.map(({ rotulo }) => rotulo)),
    tecnica,
  })
}

type ContaAntesDoManual = Omit<TecnicaMontadaDBT, 'ki' | 'faixa' | 'manual' | 'valida'> & { tecnica: TecnicaDBT }

/** Aplica os valores à mão (vencem a conta), a faixa e o `valida`. */
function fechar(conta: ContaAntesDoManual): TecnicaMontadaDBT {
  const { tecnica, ...resto } = conta
  const kiManual = tecnica.kiManual
  const danoManual = tecnica.danoManual
  const faixa = danoManual ?? faixaDoDano(conta.danoBase)
  const formulaDaFaixa = `faixa ${faixa.minimo} / ${faixa.medio} / ${faixa.completo}`
  return {
    ...resto,
    ki: kiManual ?? conta.kiCalculado * conta.multiplicadorDoKi,
    danoBase: faixa.completo,
    faixa,
    manual: { ki: kiManual !== null, dano: danoManual !== null },
    formulaDoKi: kiManual === null ? conta.formulaDoKi : `${conta.formulaDoKi} · fixado à mão em ${kiManual}`,
    formulaDoDano:
      danoManual === null
        ? `${conta.formulaDoDano} · ${formulaDaFaixa} (¼, ½ e inteiro, para baixo)`
        : `${conta.formulaDoDano} · fixado à mão: ${formulaDaFaixa}`,
    valida: !conta.avisos.some((a) => a.gravidade === 'erro'),
  }
}

/**
 * Técnica especial (p. 87-92): sem rótulos, sem orçamento, sem ST. Ki mínimo
 * por rank (p. 88-89); a ofensiva tem dano definido pelo narrador (sem valor
 * à mão, vale o dano mínimo do rank); a não ofensiva não tem faixa de dano.
 */
function montarEspecial(tecnica: TecnicaDBT, especial: TecnicaEspecialDBT, contexto: ContextoDoMontadorDBT): TecnicaMontadaDBT {
  const rank = contexto.rank
  const avisos = avisosDoTipo(tecnica, contexto)
  if (tecnica.rotulos.length > 0) {
    avisos.push(aviso('atencao', 'especial-com-rotulos', 'Técnica especial não usa rótulos nem orçamento (p. 87): os rótulos da lista não contam.'))
  }
  const kiMinimo = rank.kiMinimoDaEspecial
  if (tecnica.kiManual !== null && tecnica.kiManual < kiMinimo) {
    avisos.push(aviso('erro', 'especial-ki-baixo', `Técnica especial de rank ${rank.rank} custa no mínimo ${kiMinimo} de Ki (p. 88-89).`))
  }
  if (!especial.aprovada) avisos.push(aviso('atencao', 'especial-pendente', 'Aguardando o mestre aprovar a técnica especial (p. 87).'))
  const danoBase = especial.ofensiva ? rank.danoMin : 0
  return fechar({
    pontosBase: rank.pontosDeRotuloBase,
    custoDoTipo: 0,
    positivos: 0,
    negativos: 0,
    limiteDeNegativos: rank.pontosDeRotuloBase,
    orcamento: 0,
    sobra: 0,
    rotulos: [],
    kiCalculado: kiMinimo,
    multiplicadorDoKi: 1,
    danoBase,
    acertoExtra: 0,
    formulaDoKi: `Ki mínimo da técnica especial de rank ${rank.rank} = ${kiMinimo}`,
    formulaDoDano: especial.ofensiva ? `Definido pelo narrador; sem valor, dano mínimo do rank ${rank.rank} ${rank.danoMin}` : 'Técnica especial não ofensiva: sem dano',
    avisos,
    lembretes: [
      especial.ofensiva
        ? 'Técnica especial ofensiva: só o narrador cria (p. 87).'
        : 'Técnica especial não ofensiva: o jogador cria com aprovação, 1 por ponto de Escala de Poder (p. 87).',
    ],
    tecnica,
  })
}

// ───────────────────────────────────────────────────────────────────────────
// Contas da lista de técnicas da ficha
// ───────────────────────────────────────────────────────────────────────────

/** ST ocupados: técnicas ativas pelo custo do rank (p. 109). Especiais e transformações não gastam ST. */
export function slotsUsados(tecnicas: readonly TecnicaDBT[], ranks: TabelaDeRanksDBT): number {
  return tecnicas.reduce((soma, tecnica) => (tecnica.ativa && tecnica.especial === null ? soma + ranks[tecnica.rank].slots : soma), 0)
}

/** Especiais não ofensivas: no máximo 1 por ponto de Escala de Poder base (p. 87). */
export function especiaisNaoOfensivas(tecnicas: readonly TecnicaDBT[], epBase: number): { usadas: number; limite: number; passou: boolean } {
  const usadas = tecnicas.filter((tecnica) => tecnica.especial !== null && !tecnica.especial.ofensiva).length
  const limite = Math.max(0, epBase)
  return { usadas, limite, passou: usadas > limite }
}
