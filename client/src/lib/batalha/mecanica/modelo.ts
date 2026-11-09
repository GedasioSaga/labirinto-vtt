import { NOME_DO_SELO_MAX, TURNOS_DO_SELO_MAX, DANO_MAX, CUSTO_MAX } from '../combate'

/**
 * AS PEÇAS DA TÉCNICA MONTADA (construtor de mecânicas, fatia C1; seção 1 de
 * docs/planos/construtor-de-mecanicas-2026-11-08.md). O dado mora no próprio
 * cartão (`CartaoDaFicha.mecanica`), versionado como a ficha DBT: `versao` e
 * um leitor que recusa versão futura. Sem o campo, o cartão abre e joga igual
 * a hoje (as 11 fichas não migram: seguem a mecânica à mão da F2).
 *
 * Tudo ou nada por cartão: com peças, Custo, Dano e Efeito em texto viram só
 * descrição. Peça torta = "mecânica inválida" (o cartão vira à mão); versão
 * maior que a do app = "atualize o app". Nos dois casos NÃO volta para o
 * texto, que pode estar velho.
 *
 * Esta fatia aceita só as peças que o motor já executa. As fatias seguintes
 * (área num ponto livre e alcance, C4 teste e disputa, C5 selos vivos, C6 perguntas)
 * acrescentam variantes opcionais; até lá, um cartão com elas é recusado
 * aqui, e não executado pela metade.
 *
 * Puro: sem store, sem rede.
 */

export const VERSAO_DA_MECANICA = 1

/** Teto de uma fórmula ("(Força + Espírito) * 1,5 + 100"), na gramática de `lerDano`. */
export const FORMULA_MAX = 200
/** Teto de efeitos por técnica. */
export const EFEITOS_MAX = 8
/** Teto de custos (um por momento: ao usar, por vez, depois). */
export const CUSTOS_MAX = 3
/** Teto dos multiplicadores extras (furtivo, ponto vital, marca). */
export const EXTRAS_MAX = 4
/** Teto de um multiplicador extra (×10). */
export const VEZES_MAX = 10
/** Teto do texto de um lembrete à mão. */
export const TEXTO_A_MAO_MAX = 200
/** Teto da recarga e dos usos por batalha. */
export const LIMITE_MAX = 20
/** Teto de alvos, de casas e do lado do quadrado. */
export const CASAS_MAX = 20

/** Um número da peça: fixo ou fórmula da ficha de quem usa. */
export type NumeroSimples = { fixo: number } | { formula: string }
/** Um número que muda com a Concentração guardada (carga 0, 1, 2 e 3). */
export type Numero = NumeroSimples | { porCarga: readonly [NumeroSimples, NumeroSimples, NumeroSimples, NumeroSimples] }

/** Quanto custa: `aoUsar` bloqueia sem o recurso; `porTurno` = técnica mantida (lembrete "Aplicar / pular"), só fixo; `depois` cobra sem bloquear, só HP fixo. */
export interface Custo {
  recurso: 'sp' | 'hp'
  quanto: NumeroSimples | { porcento: number; de: 'maximo' | 'atual' }
  quando: 'aoUsar' | 'porTurno' | 'depois'
}

/** A ação que a técnica gasta; `perguntar` = quem usa escolhe na hora (a mira pergunta). */
export type AcaoDaMecanica = 'simples' | 'bonus' | 'completa' | 'livre' | 'perguntar'

/** `overload`: herda as regras da F1 (1 por batalha, gasta a Completa, só outra Overload defende). */
export interface Limite {
  recarga?: number
  usosPorBatalha?: number
  overload?: true
}

/** O desenho do alvo. `quadrado` com `centro: 'si'` = em volta de quem usa (lado ímpar: 3x3 = raio 1). */
export type FormaDoAlvo =
  | { tipo: 'um' }
  | { tipo: 'varios'; max: number; dividirDano?: true }
  | { tipo: 'linha'; casas: number }
  | { tipo: 'quadrado'; lado: number; centro: 'si' | 'frente' }
  | { tipo: 'raio'; casas: number }

export type QuemOAlvoPega = 'inimigos' | 'aliados' | 'todos' | 'si' | 'escolha'

export interface AlvoDaMecanica {
  quem: QuemOAlvoPega
  forma: FormaDoAlvo
}

/** Como acerta: o alvo reage com o d20 de sempre, ou não erra (sem reação). */
export type Teste = { tipo: 'reacao' } | { tipo: 'naoErra' }

/** Um multiplicador a mais, na ordem da lista, depois da Concentração e da Surpresa. */
export interface MultiplicadorExtra {
  nome: string
  vezes: number
}

export interface DanoDaMecanica {
  base: NumeroSimples
  /** `padrao` = a arma escolhida na mira entra no "Dano da arma"; ausente ou `nenhuma` = sem arma. */
  arma?: 'nenhuma' | 'padrao'
  perfurante?: boolean
  multiplicadores: { concentracao: boolean; surpresa: boolean; extra?: readonly MultiplicadorExtra[] }
}

export type Efeito =
  | { tipo: 'selo'; nome: string; duracao: number | 'ateTirar'; natureza?: 'buff' | 'debuff' }
  | { tipo: 'cura'; recurso: 'hp'; quanto: Numero; emQuem: 'alvo' }
  | { tipo: 'tirarSelos'; quais: 'negativos' }
  /** Porta de escape: o app não executa nada, só lembra o mestre. */
  | { tipo: 'aMao'; texto: string }

export interface MecanicaV1 {
  versao: 1
  acao: AcaoDaMecanica
  custos: readonly Custo[]
  limite: Limite
  alvo: AlvoDaMecanica
  teste: Teste
  dano?: DanoDaMecanica
  efeitos: readonly Efeito[]
}

/** O que a leitura do campo `mecanica` dá. */
export type MecanicaLida =
  /** O cartão não tem o campo: segue pelo texto (as fichas de hoje). */
  | { tipo: 'nenhuma' }
  | { tipo: 'pecas'; mecanica: MecanicaV1 }
  /** Peça torta: o cartão vira à mão. `motivo` em português simples. */
  | { tipo: 'invalida'; motivo: string }
  /** Feita num app mais novo: o cartão vira à mão até atualizar. */
  | { tipo: 'futura'; versao: number }

/** O aviso do cartão com mecânica que este app não executa. */
export function avisoDaMecanica(lida: Extract<MecanicaLida, { tipo: 'invalida' | 'futura' }>): string {
  return lida.tipo === 'futura' ? 'Mecânica feita num app mais novo: atualize o app. Por enquanto, à mão.' : `Mecânica inválida (${lida.motivo}): à mão.`
}

// ─── Leitura ────────────────────────────────────────────────────────────────

/** A peça torta: sai da leitura com o motivo (nunca escapa de `lerMecanica`). */
class PecaTorta extends Error {}

function torta(motivo: string): never {
  throw new PecaTorta(motivo)
}

function registro(valor: unknown, onde: string): Record<string, unknown> {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) torta(`${onde} não é uma peça`)
  return { ...valor }
}

/** Só as chaves conhecidas: chave de fatia futura não roda pela metade. */
function soChaves(peca: Record<string, unknown>, permitidas: readonly string[], onde: string): void {
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

function texto(valor: unknown, maximo: number, onde: string): string {
  if (typeof valor !== 'string' || valor.trim().length === 0 || valor.length > maximo || /[\r\n]/.test(valor)) torta(`${onde} precisa ter de 1 a ${maximo} letras, numa linha`)
  return valor
}

function lista(valor: unknown, maximo: number, onde: string): unknown[] {
  if (!Array.isArray(valor)) torta(`${onde} não é uma lista`)
  if (valor.length > maximo) torta(`${onde} passa de ${maximo}`)
  return valor
}

function numeroSimples(valor: unknown, maximo: number, onde: string): NumeroSimples {
  const peca = registro(valor, onde)
  if ('fixo' in peca) {
    soChaves(peca, ['fixo'], onde)
    return { fixo: inteiro(peca.fixo, 0, maximo, onde) }
  }
  soChaves(peca, ['formula'], onde)
  return { formula: texto(peca.formula, FORMULA_MAX, `${onde} (fórmula)`) }
}

function numero(valor: unknown, maximo: number, onde: string): Numero {
  const peca = registro(valor, onde)
  if (!('porCarga' in peca)) return numeroSimples(peca, maximo, onde)
  soChaves(peca, ['porCarga'], onde)
  const cargas = lista(peca.porCarga, 4, `${onde} por carga`).map((item, carga) => numeroSimples(item, maximo, `${onde} na carga ${carga}`))
  const [zero, um, dois, tres] = cargas
  if (zero === undefined || um === undefined || dois === undefined || tres === undefined) torta(`${onde} por carga precisa de 4 números (carga 0 a 3)`)
  return { porCarga: [zero, um, dois, tres] }
}

function quantoDoCusto(valor: unknown, onde: string): Custo['quanto'] {
  const quanto = registro(valor, `${onde} (quanto)`)
  if (!('porcento' in quanto)) return numeroSimples(quanto, CUSTO_MAX, onde)
  soChaves(quanto, ['porcento', 'de'], onde)
  return { porcento: inteiro(quanto.porcento, 1, 100, `${onde} (porcentagem)`), de: umDe(quanto.de, ['maximo', 'atual'] as const, `${onde} (de quê)`) }
}

function custo(valor: unknown, indice: number): Custo {
  const onde = `custo ${indice + 1}`
  const peca = registro(valor, onde)
  soChaves(peca, ['recurso', 'quanto', 'quando'], onde)
  const lido = quantoDoCusto(peca.quanto, onde)
  const quando = umDe(peca.quando, ['aoUsar', 'porTurno', 'depois'] as const, `${onde} (quando)`)
  // A técnica mantida cobra o mesmo número a cada vez (`MantidaAMao.custoPorVez`): só o fixo cabe nela.
  if (quando === 'porTurno' && !('fixo' in lido)) torta(`${onde}: o custo por vez precisa ser um número fixo`)
  const recurso = umDe(peca.recurso, ['sp', 'hp'] as const, `${onde} (recurso)`)
  // O "depois" cobra pelo `custoEmHp` da linha (Sai Dai Rin): só HP fixo. Outro "depois" seria lido e nunca cobrado.
  if (quando === 'depois' && (recurso !== 'hp' || !('fixo' in lido))) torta(`${onde}: o custo depois de usar, por enquanto, só aceita HP em número fixo`)
  return { recurso, quanto: lido, quando }
}

function limite(valor: unknown): Limite {
  const peca = registro(valor ?? {}, 'limite')
  soChaves(peca, ['recarga', 'usosPorBatalha', 'overload'], 'limite')
  const lido: Limite = {}
  if (peca.recarga !== undefined) lido.recarga = inteiro(peca.recarga, 1, LIMITE_MAX, 'recarga')
  if (peca.usosPorBatalha !== undefined) lido.usosPorBatalha = inteiro(peca.usosPorBatalha, 1, LIMITE_MAX, 'usos por batalha')
  // O motor guarda um Tempo só por técnica (`LeituraDoTempo`).
  if (lido.recarga !== undefined && lido.usosPorBatalha !== undefined) torta('recarga e usos por batalha juntos')
  if (peca.overload !== undefined) {
    if (peca.overload !== true) torta('overload só aceita "sim"')
    lido.overload = true
  }
  return lido
}

function forma(valor: unknown): FormaDoAlvo {
  const peca = registro(valor, 'forma do alvo')
  const tipo = umDe(peca.tipo, ['um', 'varios', 'linha', 'quadrado', 'raio'] as const, 'forma do alvo')
  switch (tipo) {
    case 'um':
      soChaves(peca, ['tipo'], 'alvo')
      return { tipo }
    case 'varios': {
      soChaves(peca, ['tipo', 'max', 'dividirDano'], 'alvo')
      const lida: FormaDoAlvo = { tipo, max: inteiro(peca.max, 2, CASAS_MAX, 'máximo de alvos') }
      if (peca.dividirDano === true) lida.dividirDano = true
      else if (peca.dividirDano !== undefined) torta('dividir o dano só aceita "sim"')
      return lida
    }
    case 'linha':
    case 'raio':
      soChaves(peca, ['tipo', 'casas'], 'alvo')
      return { tipo, casas: inteiro(peca.casas, 1, CASAS_MAX, 'casas') }
    case 'quadrado': {
      soChaves(peca, ['tipo', 'lado', 'centro'], 'alvo')
      const lado = inteiro(peca.lado, 1, CASAS_MAX, 'lado do quadrado')
      const centro = umDe(peca.centro, ['si', 'frente'] as const, 'centro do quadrado')
      if (centro === 'si' && lado % 2 === 0) torta('o quadrado em volta de quem usa precisa de lado ímpar (3x3, 5x5)')
      return { tipo, lado, centro }
    }
  }
}

function alvo(valor: unknown): AlvoDaMecanica {
  const peca = registro(valor, 'alvo')
  soChaves(peca, ['quem', 'forma'], 'alvo')
  const quem = umDe(peca.quem, ['inimigos', 'aliados', 'todos', 'si', 'escolha'] as const, 'quem o alvo pega')
  const lida = forma(peca.forma)
  // Construtor C3: a área marca os inimigos, os aliados (a cura em área) ou todos; "em si" não tem área.
  if (quem === 'si' && lida.tipo !== 'um') torta('"em si" é um alvo só')
  return { quem, forma: lida }
}

function teste(valor: unknown): Teste {
  const peca = registro(valor ?? { tipo: 'reacao' }, 'teste')
  soChaves(peca, ['tipo'], 'teste')
  return { tipo: umDe(peca.tipo, ['reacao', 'naoErra'] as const, 'teste') }
}

function multiplicador(valor: unknown, indice: number): MultiplicadorExtra {
  const onde = `multiplicador ${indice + 1}`
  const peca = registro(valor, onde)
  soChaves(peca, ['nome', 'vezes'], onde)
  const vezes = peca.vezes
  if (typeof vezes !== 'number' || !Number.isFinite(vezes) || vezes <= 0 || vezes > VEZES_MAX) torta(`${onde}: vezes de 0 a ${VEZES_MAX}`)
  return { nome: texto(peca.nome, NOME_DO_SELO_MAX, `${onde} (nome)`), vezes }
}

function dano(valor: unknown): DanoDaMecanica {
  const peca = registro(valor, 'dano')
  soChaves(peca, ['base', 'arma', 'perfurante', 'multiplicadores'], 'dano')
  const mult = registro(peca.multiplicadores ?? {}, 'multiplicadores')
  soChaves(mult, ['concentracao', 'surpresa', 'extra'], 'multiplicadores')
  const lido: DanoDaMecanica = {
    base: numeroSimples(peca.base, DANO_MAX, 'dano base'),
    multiplicadores: { concentracao: mult.concentracao !== false, surpresa: mult.surpresa !== false },
  }
  if (mult.extra !== undefined) lido.multiplicadores.extra = lista(mult.extra, EXTRAS_MAX, 'multiplicadores extras').map(multiplicador)
  if (peca.arma !== undefined) lido.arma = umDe(peca.arma, ['nenhuma', 'padrao'] as const, 'arma')
  if (peca.perfurante !== undefined) {
    if (typeof peca.perfurante !== 'boolean') torta('perfurante só aceita sim ou não')
    lido.perfurante = peca.perfurante
  }
  return lido
}

function efeito(valor: unknown, indice: number): Efeito {
  const onde = `efeito ${indice + 1}`
  const peca = registro(valor, onde)
  const tipo = umDe(peca.tipo, ['selo', 'cura', 'tirarSelos', 'aMao'] as const, onde)
  switch (tipo) {
    case 'selo': {
      soChaves(peca, ['tipo', 'nome', 'duracao', 'natureza'], onde)
      const duracao = peca.duracao === 'ateTirar' ? 'ateTirar' : inteiro(peca.duracao, 1, TURNOS_DO_SELO_MAX, `${onde} (duração)`)
      const lido: Efeito = { tipo, nome: texto(peca.nome, NOME_DO_SELO_MAX, `${onde} (nome do selo)`), duracao }
      if (peca.natureza !== undefined) lido.natureza = umDe(peca.natureza, ['buff', 'debuff'] as const, `${onde} (natureza)`)
      return lido
    }
    case 'cura':
      soChaves(peca, ['tipo', 'recurso', 'quanto', 'emQuem'], onde)
      return { tipo, recurso: umDe(peca.recurso, ['hp'] as const, `${onde} (recurso)`), quanto: numero(peca.quanto, DANO_MAX, `${onde} (quanto)`), emQuem: umDe(peca.emQuem, ['alvo'] as const, `${onde} (em quem)`) }
    case 'tirarSelos':
      soChaves(peca, ['tipo', 'quais'], onde)
      return { tipo, quais: umDe(peca.quais, ['negativos'] as const, `${onde} (quais)`) }
    case 'aMao':
      soChaves(peca, ['tipo', 'texto'], onde)
      return { tipo, texto: texto(peca.texto, TEXTO_A_MAO_MAX, `${onde} (texto)`) }
  }
}

/** Um de cada: selo, cura e tirar selos (a fatia C5 abre mais de um selo). */
function conferirEfeitos(efeitos: readonly Efeito[], quem: QuemOAlvoPega): void {
  for (const tipo of ['selo', 'cura', 'tirarSelos'] as const) {
    if (efeitos.filter((item) => item.tipo === tipo).length > 1) torta(`mais de um efeito "${tipo}"`)
  }
  // A cura e a limpeza de hoje (`LimpezaAMao`) valem em quem usa ou num aliado.
  const limpa = efeitos.some((item) => item.tipo === 'cura' || item.tipo === 'tirarSelos')
  if (limpa && quem !== 'aliados' && quem !== 'si') torta('cura e tirar selos só pegam em quem usa ou num aliado')
}

function mecanicaV1(peca: Record<string, unknown>): MecanicaV1 {
  soChaves(peca, ['versao', 'acao', 'custos', 'limite', 'alvo', 'teste', 'dano', 'efeitos'], 'mecânica')
  const custos = lista(peca.custos ?? [], CUSTOS_MAX, 'custos').map(custo)
  for (const quando of ['aoUsar', 'porTurno', 'depois'] as const) {
    if (custos.filter((item) => item.quando === quando).length > 1) torta('dois custos no mesmo momento')
  }
  const lidoAlvo = alvo(peca.alvo)
  const efeitos = lista(peca.efeitos ?? [], EFEITOS_MAX, 'efeitos').map(efeito)
  conferirEfeitos(efeitos, lidoAlvo.quem)
  const mecanica: MecanicaV1 = {
    versao: VERSAO_DA_MECANICA,
    acao: umDe(peca.acao, ['simples', 'bonus', 'completa', 'livre', 'perguntar'] as const, 'ação'),
    custos,
    limite: limite(peca.limite),
    alvo: lidoAlvo,
    teste: teste(peca.teste),
    efeitos,
  }
  if (peca.dano !== undefined) mecanica.dano = dano(peca.dano)
  return mecanica
}

/**
 * Lê o campo `mecanica` do cartão. Nunca lança. Ausente = `nenhuma` (segue o
 * texto); versão maior que `VERSAO_DA_MECANICA` = `futura`; qualquer peça
 * torta, chave desconhecida ou teto passado = `invalida` com o motivo.
 */
export function lerMecanica(valor: unknown): MecanicaLida {
  if (valor === undefined) return { tipo: 'nenhuma' }
  try {
    const peca = registro(valor, 'mecânica')
    const versao = inteiro(peca.versao, 1, Number.MAX_SAFE_INTEGER, 'versão')
    if (versao > VERSAO_DA_MECANICA) return { tipo: 'futura', versao }
    return { tipo: 'pecas', mecanica: mecanicaV1(peca) }
  } catch (erro) {
    if (erro instanceof PecaTorta) return { tipo: 'invalida', motivo: erro.message }
    throw erro
  }
}
