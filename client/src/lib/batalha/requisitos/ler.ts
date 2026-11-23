import { NOME_DO_GOLPE_MAX, NOME_DO_SELO_MAX, CARGA_MAX, DANO_MAX } from '../combate'
import { normalizar } from '../formula'
import {
  CASAS_DO_REQUISITO_MAX,
  CATEGORIA_MAX,
  CD_DO_REQUISITO_MAX,
  ID_DA_REFERENCIA_MAX,
  ID_DO_REQUISITO_MAX,
  LIGA_POR_MAX,
  MARCA_MAX,
  MARCAS_MAX,
  NIVEL_DO_ACUMULADOR_MAX,
  OPCOES_NO_UM_DESTES_MAX,
  NOME_DO_ACUMULADOR_MAX,
  PASSO_DO_ACUMULADOR_MAX,
  PECAS_NA_RAIZ_MAX,
  REGRAS_DO_ACUMULADOR_MAX,
  PESSOAS_DO_REQUISITO_MAX,
  QUANTIDADE_DO_REQUISITO_MAX,
  RECURSO_DO_REQUISITO_MAX,
  RODADA_DO_REQUISITO_MAX,
  TEXTO_DO_REQUISITO_MAX,
  TIPOS_DE_REQUISITO,
  VERSAO_DO_ACUMULADOR,
  VERSAO_DOS_REQUISITOS,
  ehNaoLido,
  ehTipoDeRequisito,
  ehUmDestes,
  type AcumuladorDaFicha,
  type DescidaDoAcumulador,
  type GanhoDoAcumulador,
  type GrupoDeRequisitos,
  type ObjetoJson,
  type OpcaoDoUmDestes,
  type PecaDoGrupo,
  type LadoDaVida,
  type QuantoPagaDeVida,
  type RecursoDoAliado,
  type Referencia,
  type Requisito,
  type RequisitoDo,
  type RequisitoNaoLido,
  type RequisitosDoCartao,
  type SeFalhar,
  type TipoDeRequisito,
  type TipoDoAlvo,
  type UmDestes,
  type PecaDoAcumulador,
  type QuandoSobe,
  type RegraNaoLida,
  type SubidaDoAcumulador,
  type ValorJson,
  type ValorPorNivel,
} from './modelo'

/**
 * REQUISITOS: O LEITOR (fase A de docs/design/habilidades/REQUISITOS.md §3.1). Lê o campo
 * `requisitos` como o disco e o fio o guardam (opaco, `RequisitosGuardados`). Nunca lança e nunca
 * derruba o resto do cartão:
 *
 * - peça de tipo, chave ou marca que este app não conhece = `naoLido` `appNovo` (o cartão fica
 *   cinza "atualize o app"; o mestre pode forçar); bloco de versão maior, idem, inteiro;
 * - peça com número fora da faixa, texto vazio ou contradição = `naoLido` `torto`;
 * - a peça não lida guarda o que veio (`bruto`) e `requisitosParaGuardar` a devolve igual: o app
 *   regrava sem apagar o que não entendeu;
 * - bloco que nem é objeto, ou de versão torta = ignorado, com aviso para o editor.
 *
 * Puro: sem store, sem rede.
 */

export interface RequisitosLidos {
  /** O bloco lido; `null` = sem bloco, bloco torto inteiro ou bloco de app mais novo. */
  bloco: RequisitosDoCartao | null
  /** Alguma parte é de um app mais novo: o cartão fica cinza "Requisito de app mais novo: atualize o app". */
  deAppNovo: boolean
  /** O que o editor avisa (peça torta, id refeito, teto passado). */
  avisos: readonly string[]
}

const NENHUM: RequisitosLidos = { bloco: null, deAppNovo: false, avisos: [] }

/** Profundidade e tamanho que o `bruto` guardado de uma peça não lida aceita (o resto vira `null`). */
const BRUTO_PROFUNDIDADE_MAX = 8
const BRUTO_ITENS_MAX = 256

const ID_VALIDO = /^[A-Za-z0-9_-]+$/
const ID_DA_REFERENCIA_VALIDO = /^\S+$/

class PecaTorta extends Error {}
class PecaDeAppNovo extends Error {}

function torta(motivo: string): never {
  throw new PecaTorta(motivo)
}

function deAppNovo(motivo: string): never {
  throw new PecaDeAppNovo(motivo)
}

function ehRegistro(valor: unknown): valor is Readonly<Record<string, unknown>> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

/** O valor como JSON puro: função, `undefined` e número não finito saem; fundo demais ou comprido demais é cortado. */
export function comoJson(valor: unknown, profundidade = 0): ValorJson {
  if (valor === null || typeof valor === 'string' || typeof valor === 'boolean') return valor
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null
  if (profundidade >= BRUTO_PROFUNDIDADE_MAX) return null
  if (Array.isArray(valor)) return valor.slice(0, BRUTO_ITENS_MAX).map((item) => comoJson(item, profundidade + 1))
  if (!ehRegistro(valor)) return null
  const objeto: ObjetoJson = {}
  for (const [chave, item] of Object.entries(valor).slice(0, BRUTO_ITENS_MAX)) {
    // `__proto__` lido do JSON é chave própria; gravá-la num objeto comum trocaria o protótipo dele em vez de criar a chave.
    if (chave === '__proto__' || item === undefined || typeof item === 'function' || typeof item === 'symbol' || typeof item === 'bigint') continue
    objeto[chave] = comoJson(item, profundidade + 1)
  }
  return objeto
}

/* ------------------------------------------------------------------ peças soltas ---------- */

function registro(valor: unknown, onde: string): Readonly<Record<string, unknown>> {
  if (!ehRegistro(valor)) torta(`${onde} não é um objeto`)
  return valor
}

/** A primeira chave fora da lista; `__proto__` nunca é dado (o `comoJson` também a tira), então não conta. */
function chaveDesconhecida(valor: Readonly<Record<string, unknown>>, permitidas: readonly string[]): string | undefined {
  return Object.keys(valor).find((chave) => chave !== '__proto__' && !permitidas.includes(chave))
}

function soChaves(peca: Readonly<Record<string, unknown>>, permitidas: readonly string[], onde: string): void {
  const desconhecida = chaveDesconhecida(peca, permitidas)
  if (desconhecida !== undefined) deAppNovo(`${onde}: chave "${desconhecida}" de app mais novo`)
}

function inteiro(valor: unknown, minimo: number, maximo: number, onde: string): number {
  if (typeof valor !== 'number' || !Number.isInteger(valor) || valor < minimo || valor > maximo) torta(`${onde} precisa ser inteiro de ${minimo} a ${maximo}`)
  return valor
}

/** Texto numa linha, aparado e com os espaços juntados; vazio ou comprido demais = torto. */
function texto(valor: unknown, maximo: number, onde: string): string {
  if (typeof valor !== 'string') torta(`${onde} não é texto`)
  const aparado = valor.replace(/\s+/g, ' ').trim()
  if (aparado.length === 0 || aparado.length > maximo) torta(`${onde} precisa ter de 1 a ${maximo} letras`)
  return aparado
}

function textoOpcional(valor: unknown, maximo: number, onde: string): string | undefined {
  return valor === undefined ? undefined : texto(valor, maximo, onde)
}

/** Uma das opções conhecidas; texto fora da lista = de app mais novo; outra coisa = torto. */
function umDe<T extends string>(valor: unknown, opcoes: readonly T[], onde: string): T {
  const achada = opcoes.find((opcao) => opcao === valor)
  if (achada !== undefined) return achada
  if (typeof valor === 'string') deAppNovo(`${onde}: "${valor}" de app mais novo`)
  return torta(`${onde} fora da lista`)
}

/** A marca `true`; ausente = `false`; outra coisa = torto. */
function marcaVerdadeira(valor: unknown, onde: string): boolean {
  if (valor === undefined) return false
  if (valor !== true) torta(`${onde} só aceita true`)
  return true
}

function referencia(valor: unknown, onde: string): Referencia {
  const peca = registro(valor, onde)
  soChaves(peca, ['id', 'nome'], onde)
  const nome = texto(peca.nome, NOME_DO_GOLPE_MAX, `${onde} (nome)`)
  if (peca.id === undefined) return { nome }
  if (typeof peca.id !== 'string' || peca.id.length < 1 || peca.id.length > ID_DA_REFERENCIA_MAX || !ID_DA_REFERENCIA_VALIDO.test(peca.id)) torta(`${onde} (id) torto`)
  return { id: peca.id, nome }
}

function referenciaOpcional(valor: unknown, onde: string): Referencia | undefined {
  return valor === undefined ? undefined : referencia(valor, onde)
}

/* ------------------------------------------------------------------ um requisito ---------- */

/** As chaves de cada tipo, além de `id`, `tipo`, `nao` e `gasta`. */
const CHAVES_DO_TIPO: Readonly<Record<TipoDeRequisito, readonly string[]>> = {
  sp: ['n'],
  vida: ['porcento', 'lado'],
  escudo: [],
  contador: ['acumulador', 'nivel'],
  concentracao: ['n'],
  pagaVida: ['porcento', 'hp'],
  reacaoLivre: [],
  ligada: ['cartao', 'opcao'],
  selo: ['nome'],
  naForma: ['forma'],
  parado: [],
  andou: ['casas'],
  apanhou: [],
  acertou: [],
  errou: [],
  rodada: ['n', 'ate'],
  depoisDe: ['cartao'],
  jaUsada: ['cartao'],
  ordemNaVez: ['qual'],
  alvoComSelo: ['nome'],
  alvoVida: ['porcento', 'lado'],
  alvoMarcado: [],
  alvoTipo: ['quem'],
  alvoJaAgiu: [],
  aliadoPerto: ['casas'],
  sozinho: ['casas'],
  semInimigoColado: [],
  inimigosPerto: ['n', 'casas'],
  luz: ['onde'],
  item: ['item', 'quantidade'],
  armaNaMao: ['arma', 'categoria'],
  municao: ['n'],
  pedirAoAliado: ['recurso', 'n'],
  ajudaDeAliado: ['marca'],
  aliadoUsou: ['cartao'],
  aliadosDePe: ['quantos'],
  aliadoCaiu: [],
  teste: ['atributo', 'cd', 'seFalhar'],
  disputa: ['atributo', 'doAlvo', 'seFalhar'],
  personalizado: ['texto'],
  mestreDecide: ['texto'],
}

const LADOS: readonly LadoDaVida[] = ['abaixo', 'acima']
const SE_FALHAR: readonly SeFalhar[] = ['perdeAAcao', 'naoGasta']
const ORDENS_NA_VEZ: readonly RequisitoDo<'ordemNaVez'>['qual'][] = ['primeira', 'ultima']
const TIPOS_DO_ALVO: readonly TipoDoAlvo[] = ['npc', 'jogador', 'invocacao']
const LUZES: readonly RequisitoDo<'luz'>['onde'][] = ['luz', 'escuro']
const RECURSOS_DO_ALIADO: readonly RecursoDoAliado[] = ['sp', 'hp', 'escudo']

/** O "não ter" e o "gasta" da peça, conferidos contra o tipo. Os dois juntos = torto (não se gasta o que falta). */
function marcasDaPeca(peca: Readonly<Record<string, unknown>>, tipo: TipoDeRequisito, onde: string): { nao?: true; gasta?: true } {
  const nao = marcaVerdadeira(peca.nao, `${onde} (não ter)`)
  const gasta = marcaVerdadeira(peca.gasta, `${onde} (gasta)`)
  const ficha = TIPOS_DE_REQUISITO[tipo]
  if (nao && !ficha.aceitaNao) deAppNovo(`${onde}: "não ter" de app mais novo`)
  if (gasta && !ficha.aceitaGasta) deAppNovo(`${onde}: "gasta" de app mais novo`)
  if (nao && gasta) torta(`${onde}: "não ter" e "gasta" juntos`)
  return { ...(nao ? { nao: true } : {}), ...(gasta ? { gasta: true } : {}) }
}

function quantoPagaDeVida(peca: Readonly<Record<string, unknown>>, onde: string): QuantoPagaDeVida {
  if ((peca.porcento === undefined) === (peca.hp === undefined)) torta(`${onde}: diga a porcentagem ou o HP, um dos dois`)
  return peca.porcento !== undefined ? { porcento: inteiro(peca.porcento, 1, 100, `${onde} (%)`) } : { hp: inteiro(peca.hp, 1, RECURSO_DO_REQUISITO_MAX, `${onde} (HP)`) }
}

/** Os números de cada tipo; `id` fica vazio (quem dá é `DistribuidorDeIds`). Lança `PecaTorta` ou `PecaDeAppNovo`. */
function requisitoLido(valor: unknown): Requisito {
  const peca = registro(valor, 'requisito')
  if (typeof peca.tipo !== 'string') torta('requisito sem tipo')
  const tipo = peca.tipo
  if (!ehTipoDeRequisito(tipo)) return deAppNovo(`requisito "${tipo}" de app mais novo`)
  const onde = `requisito ${TIPOS_DE_REQUISITO[tipo].letra}`
  soChaves(peca, ['id', 'tipo', 'nao', 'gasta', ...CHAVES_DO_TIPO[tipo]], onde)
  const marcas = marcasDaPeca(peca, tipo, onde)
  const id = ''
  switch (tipo) {
    case 'sp':
      return { id, tipo, n: inteiro(peca.n, 1, RECURSO_DO_REQUISITO_MAX, `${onde} (SP)`), ...marcas }
    case 'vida':
    case 'alvoVida':
      return { id, tipo, porcento: inteiro(peca.porcento, 1, 100, `${onde} (%)`), lado: umDe(peca.lado, LADOS, `${onde} (abaixo ou acima)`) }
    case 'escudo':
    case 'apanhou':
    case 'acertou':
    case 'errou':
    case 'alvoMarcado':
    case 'alvoJaAgiu':
    case 'semInimigoColado':
    case 'aliadoCaiu':
      return { id, tipo, ...marcas }
    case 'contador':
      return { id, tipo, acumulador: referencia(peca.acumulador, `${onde} (acumulador)`), nivel: inteiro(peca.nivel, 1, NIVEL_DO_ACUMULADOR_MAX, `${onde} (nível)`), ...marcas }
    case 'concentracao':
      return { id, tipo, n: inteiro(peca.n, 1, CARGA_MAX, `${onde} (cargas)`), ...marcas }
    case 'pagaVida':
      return { id, tipo, ...quantoPagaDeVida(peca, onde) }
    case 'reacaoLivre':
    case 'parado':
      return { id, tipo }
    case 'ligada': {
      const opcao = textoOpcional(peca.opcao, NOME_DO_GOLPE_MAX, `${onde} (opção)`)
      return { id, tipo, cartao: referencia(peca.cartao, `${onde} (técnica)`), ...(opcao === undefined ? {} : { opcao }), ...marcas }
    }
    case 'selo':
    case 'alvoComSelo':
      return { id, tipo, nome: texto(peca.nome, NOME_DO_SELO_MAX, `${onde} (selo)`), ...marcas }
    case 'naForma': {
      const forma = referenciaOpcional(peca.forma, `${onde} (forma)`)
      return { id, tipo, ...(forma === undefined ? {} : { forma }), ...marcas }
    }
    case 'andou':
    case 'aliadoPerto':
    case 'sozinho':
      return { id, tipo, casas: inteiro(peca.casas, 1, CASAS_DO_REQUISITO_MAX, `${onde} (casas)`) }
    case 'rodada':
      return { id, tipo, n: inteiro(peca.n, 1, RODADA_DO_REQUISITO_MAX, `${onde} (rodada)`), ...(marcaVerdadeira(peca.ate, `${onde} (até)`) ? { ate: true } : {}) }
    case 'depoisDe':
    case 'jaUsada':
    case 'aliadoUsou':
      return { id, tipo, cartao: referencia(peca.cartao, `${onde} (técnica)`), ...marcas }
    case 'ordemNaVez':
      return { id, tipo, qual: umDe(peca.qual, ORDENS_NA_VEZ, `${onde} (qual ação)`), ...marcas }
    case 'alvoTipo':
      return { id, tipo, quem: umDe(peca.quem, TIPOS_DO_ALVO, `${onde} (tipo do alvo)`), ...marcas }
    case 'inimigosPerto': {
      const n = inteiro(peca.n, 1, PESSOAS_DO_REQUISITO_MAX, `${onde} (inimigos)`)
      return peca.casas === undefined ? { id, tipo, n } : { id, tipo, n, casas: inteiro(peca.casas, 1, CASAS_DO_REQUISITO_MAX, `${onde} (casas)`) }
    }
    case 'luz':
      return { id, tipo, onde: umDe(peca.onde, LUZES, `${onde} (luz ou escuro)`) }
    case 'item':
      return { id, tipo, item: referencia(peca.item, `${onde} (item)`), quantidade: inteiro(peca.quantidade, 1, QUANTIDADE_DO_REQUISITO_MAX, `${onde} (quantidade)`), ...marcas }
    case 'armaNaMao': {
      const arma = referenciaOpcional(peca.arma, `${onde} (arma)`)
      const categoria = textoOpcional(peca.categoria, CATEGORIA_MAX, `${onde} (categoria)`)
      if (arma !== undefined && categoria !== undefined) torta(`${onde}: a arma ou a categoria, uma das duas`)
      return { id, tipo, ...(arma === undefined ? {} : { arma }), ...(categoria === undefined ? {} : { categoria }), ...marcas }
    }
    case 'municao':
      return { id, tipo, n: inteiro(peca.n, 1, QUANTIDADE_DO_REQUISITO_MAX, `${onde} (balas)`), ...marcas }
    case 'pedirAoAliado':
      return { id, tipo, recurso: umDe(peca.recurso, RECURSOS_DO_ALIADO, `${onde} (recurso)`), n: inteiro(peca.n, 1, RECURSO_DO_REQUISITO_MAX, `${onde} (quanto)`), ...marcas }
    case 'ajudaDeAliado':
      return { id, tipo, marca: texto(peca.marca, MARCA_MAX, `${onde} (marca)`) }
    case 'aliadosDePe':
      return { id, tipo, quantos: peca.quantos === 'todos' ? 'todos' : inteiro(peca.quantos, 1, PESSOAS_DO_REQUISITO_MAX, `${onde} (aliados)`) }
    case 'teste':
      return { id, tipo, atributo: referencia(peca.atributo, `${onde} (atributo)`), cd: inteiro(peca.cd, 1, CD_DO_REQUISITO_MAX, `${onde} (CD)`), seFalhar: umDe(peca.seFalhar, SE_FALHAR, `${onde} (se falhar)`) }
    case 'disputa': {
      const doAlvo = referenciaOpcional(peca.doAlvo, `${onde} (atributo do alvo)`)
      return { id, tipo, atributo: referencia(peca.atributo, `${onde} (atributo)`), ...(doAlvo === undefined ? {} : { doAlvo }), seFalhar: umDe(peca.seFalhar, SE_FALHAR, `${onde} (se falhar)`) }
    }
    case 'personalizado':
      return { id, tipo, texto: texto(peca.texto, TEXTO_DO_REQUISITO_MAX, `${onde} (texto)`) }
    case 'mestreDecide': {
      const escrito = textoOpcional(peca.texto, TEXTO_DO_REQUISITO_MAX, `${onde} (texto)`)
      return escrito === undefined ? { id, tipo } : { id, tipo, texto: escrito }
    }
  }
}

/* ------------------------------------------------------------------ ids ------------------- */

/**
 * Os ids do bloco inteiro, únicos (viram a chave `req.<id>` das respostas). A peça com id torto,
 * ausente ou repetido ganha, no fim, o primeiro `r<n>` livre, na ordem em que apareceu.
 */
class DistribuidorDeIds {
  private readonly usados = new Set<string>()
  private readonly semId: { id: string }[] = []

  constructor(private readonly avisos: string[]) {}

  pedir(lido: unknown, peca: { id: string }): void {
    const valido = typeof lido === 'string' && lido.length <= ID_DO_REQUISITO_MAX && ID_VALIDO.test(lido)
    if (valido && !this.usados.has(lido)) {
      this.usados.add(lido)
      peca.id = lido
      return
    }
    this.semId.push(peca)
  }

  fechar(): void {
    let n = 1
    for (const peca of this.semId) {
      while (this.usados.has(`r${n}`)) n += 1
      peca.id = `r${n}`
      this.usados.add(peca.id)
      this.avisos.push(`Peça sem id próprio (ou repetido): ganhou "${peca.id}"`)
    }
  }
}

/* ------------------------------------------------------------------ grupos ---------------- */

interface Leitura {
  avisos: string[]
  ids: DistribuidorDeIds
  appNovo: boolean
}

function idLido(valor: unknown): unknown {
  return ehRegistro(valor) ? valor.id : undefined
}

function naoLido(valor: unknown, erro: PecaTorta | PecaDeAppNovo, leitura: Leitura): RequisitoNaoLido {
  const porque = erro instanceof PecaDeAppNovo ? 'appNovo' : 'torto'
  if (porque === 'appNovo') leitura.appNovo = true
  leitura.avisos.push(porque === 'appNovo' ? `Requisito de app mais novo (${erro.message}): atualize o app` : `Requisito torto (${erro.message}): refaça no editor`)
  const tipoLido = ehRegistro(valor) && typeof valor.tipo === 'string' ? valor.tipo : null
  return { id: '', tipo: 'naoLido', tipoLido, porque, motivo: erro.message, bruto: comoJson(valor) }
}

function lerRequisito(valor: unknown, leitura: Leitura): Requisito | RequisitoNaoLido {
  let peca: Requisito | RequisitoNaoLido
  try {
    peca = requisitoLido(valor)
  } catch (erro) {
    if (!(erro instanceof PecaTorta || erro instanceof PecaDeAppNovo)) throw erro
    peca = naoLido(valor, erro, leitura)
  }
  leitura.ids.pedir(idLido(valor), peca)
  return peca
}

/** Lista com teto: o que passa do teto fica de fora, com aviso (o disco guarda até o editor regravar). */
function comTeto(valor: readonly unknown[], maximo: number, onde: string, leitura: Pick<Leitura, 'avisos'>): readonly unknown[] {
  if (valor.length <= maximo) return valor
  leitura.avisos.push(`${onde}: passou de ${maximo}; os ${valor.length - maximo} do fim ficaram de fora`)
  return valor.slice(0, maximo)
}

function lerUmDestes(valor: Readonly<Record<string, unknown>>, leitura: Leitura): UmDestes | RequisitoNaoLido {
  const opcoesLidas = valor.umDestes
  if (!Array.isArray(opcoesLidas)) {
    const peca = naoLido(valor, new PecaTorta('"Um destes" sem a lista de opções'), leitura)
    leitura.ids.pedir(valor.id, peca)
    return peca
  }
  const desconhecida = chaveDesconhecida(valor, ['id', 'umDestes'])
  if (desconhecida !== undefined) {
    leitura.appNovo = true
    leitura.avisos.push(`"Um destes": chave "${desconhecida}" de app mais novo: atualize o app`)
  }
  // O mesmo objeto do começo ao fim: o `r<n>` de quem chegou sem id é posto nele só no `fechar`.
  const grupo: UmDestes = { id: '', umDestes: [] }
  leitura.ids.pedir(valor.id, grupo)
  const opcoes: OpcaoDoUmDestes[] = comTeto(opcoesLidas, OPCOES_NO_UM_DESTES_MAX, '"Um destes"', leitura).map((opcao) => {
    if (!ehRegistro(opcao) || !('umDestes' in opcao)) return lerRequisito(opcao, leitura)
    const peca = naoLido(opcao, new PecaTorta('grupo dentro de grupo'), leitura)
    leitura.ids.pedir(opcao.id, peca)
    return peca
  })
  if (opcoes.length === 0) leitura.avisos.push('"Um destes" vazio: nunca vale até ganhar uma opção')
  grupo.umDestes = opcoes
  return grupo
}

/** A raiz "Todos estes"; `null` = torta inteira (ignorada com aviso). */
function lerGrupo(valor: unknown, onde: string, leitura: Leitura): GrupoDeRequisitos | null {
  if (!ehRegistro(valor) || !Array.isArray(valor.todos)) {
    leitura.avisos.push(`${onde}: torto, ignorado`)
    return null
  }
  const desconhecida = chaveDesconhecida(valor, ['todos'])
  if (desconhecida !== undefined) {
    leitura.appNovo = true
    leitura.avisos.push(`${onde}: chave "${desconhecida}" de app mais novo: atualize o app`)
  }
  const todos: PecaDoGrupo[] = comTeto(valor.todos, PECAS_NA_RAIZ_MAX, onde, leitura).map((peca) =>
    ehRegistro(peca) && 'umDestes' in peca ? lerUmDestes(peca, leitura) : lerRequisito(peca, leitura),
  )
  return { todos }
}

/* ------------------------------------------------------------------ o bloco --------------- */

const CHAVES_DO_BLOCO = ['v', 'usar', 'evoluir', 'aoUsar', 'forma']

function lerEvoluir(valor: unknown, leitura: Leitura): RequisitosDoCartao['evoluir'] {
  if (!ehRegistro(valor)) {
    leitura.avisos.push('Para evoluir: torto, ignorado')
    return undefined
  }
  const desconhecida = chaveDesconhecida(valor, ['grupo', 'dura'])
  if (desconhecida !== undefined || (valor.dura !== undefined && valor.dura !== 'umUso')) {
    leitura.appNovo = true
    leitura.avisos.push('Para evoluir: parte de app mais novo: atualize o app')
  }
  const grupo = lerGrupo(valor.grupo, 'Para evoluir', leitura)
  return grupo === null ? undefined : { grupo, dura: 'umUso' }
}

function lerAoUsar(valor: unknown, leitura: Leitura): RequisitosDoCartao['aoUsar'] {
  if (!ehRegistro(valor)) {
    leitura.avisos.push('Ao usar: torto, ignorado')
    return undefined
  }
  if (chaveDesconhecida(valor, ['sobeParte']) !== undefined) {
    leitura.appNovo = true
    leitura.avisos.push('Ao usar: parte de app mais novo: atualize o app')
  }
  return valor.sobeParte === true ? { sobeParte: true } : undefined
}

function lerForma(valor: unknown, leitura: Leitura): RequisitosDoCartao['forma'] {
  if (!ehRegistro(valor)) {
    leitura.avisos.push('Forma: torta, ignorada')
    return undefined
  }
  if (chaveDesconhecida(valor, ['partesEmOrdem', 'soLigaPor']) !== undefined) {
    leitura.appNovo = true
    leitura.avisos.push('Forma: parte de app mais novo: atualize o app')
  }
  const soLigaPor: Referencia[] = []
  if (Array.isArray(valor.soLigaPor)) {
    for (const ref of comTeto(valor.soLigaPor, LIGA_POR_MAX, 'Só liga com', leitura)) {
      try {
        soLigaPor.push(referencia(ref, 'Só liga com'))
      } catch (erro) {
        if (!(erro instanceof PecaTorta || erro instanceof PecaDeAppNovo)) throw erro
        leitura.avisos.push(`Só liga com: ${erro.message}, ficou de fora`)
      }
    }
  } else if (valor.soLigaPor !== undefined) leitura.avisos.push('Só liga com: torto, ignorado')
  const forma: NonNullable<RequisitosDoCartao['forma']> = {}
  if (valor.partesEmOrdem === true) forma.partesEmOrdem = true
  if (soLigaPor.length > 0) forma.soLigaPor = soLigaPor
  return Object.keys(forma).length === 0 ? undefined : forma
}

/**
 * Lê o campo `requisitos` de um cartão, entrada do catálogo, item do Acervo ou vaga da mochila.
 * Nunca lança. Ausente = sem bloco.
 */
export function lerRequisitos(valor: unknown): RequisitosLidos {
  if (valor === undefined || valor === null) return NENHUM
  if (!ehRegistro(valor)) return { ...NENHUM, avisos: ['Requisitos tortos: ignorados'] }
  const avisos: string[] = []
  if (valor.v !== undefined && (typeof valor.v !== 'number' || !Number.isInteger(valor.v) || valor.v < 1)) return { ...NENHUM, avisos: ['Requisitos com versão torta: ignorados'] }
  if (typeof valor.v === 'number' && valor.v > VERSAO_DOS_REQUISITOS) return { bloco: null, deAppNovo: true, avisos: [`Requisitos da versão ${valor.v}, de app mais novo: atualize o app`] }
  if (valor.v === undefined) avisos.push('Requisitos sem versão: lidos como a versão 1')
  const leitura: Leitura = { avisos, ids: new DistribuidorDeIds(avisos), appNovo: false }
  const desconhecida = chaveDesconhecida(valor, CHAVES_DO_BLOCO)
  if (desconhecida !== undefined) {
    leitura.appNovo = true
    avisos.push(`Requisitos: chave "${desconhecida}" de app mais novo: atualize o app`)
  }
  const usar = valor.usar === undefined ? null : lerGrupo(valor.usar, 'Para usar', leitura)
  const evoluir = valor.evoluir === undefined ? undefined : lerEvoluir(valor.evoluir, leitura)
  const aoUsar = valor.aoUsar === undefined ? undefined : lerAoUsar(valor.aoUsar, leitura)
  const forma = valor.forma === undefined ? undefined : lerForma(valor.forma, leitura)
  leitura.ids.fechar()
  const bloco: RequisitosDoCartao = {
    v: VERSAO_DOS_REQUISITOS,
    ...(usar === null ? {} : { usar }),
    ...(evoluir === undefined ? {} : { evoluir }),
    ...(aoUsar === undefined ? {} : { aoUsar }),
    ...(forma === undefined ? {} : { forma }),
  }
  return { bloco, deAppNovo: leitura.appNovo, avisos }
}

/* ------------------------------------------------------------------ o acumulador ---------- */

export interface AcumuladorLido {
  /** `null` = ausente, torto (id, nome ou máximo que não valem) ou de versão mais nova. */
  acumulador: AcumuladorDaFicha | null
  /** Alguma parte é de um app mais novo (a regra fica guardada e não roda). */
  deAppNovo: boolean
  avisos: readonly string[]
}

const QUANDO_SOBE: readonly QuandoSobe['quando'][] = ['gastaReacao', 'acerta', 'apanha', 'usaTecnica', 'comecoDaVez', 'derruba', 'esquiva', 'gastaSp']
const QUANDO_DESCE: readonly DescidaDoAcumulador['quando'][] = ['fimDaBatalha', 'rodadaSemUso', 'apanha']
const GANHOS: readonly GanhoDoAcumulador['ganho'][] = ['nada', 'dano', 'atributo']

interface LeituraDoAcumulador {
  avisos: string[]
  appNovo: boolean
}

function regraNaoLida(valor: unknown, erro: PecaTorta | PecaDeAppNovo, leitura: LeituraDoAcumulador): RegraNaoLida {
  const porque = erro instanceof PecaDeAppNovo ? 'appNovo' : 'torto'
  if (porque === 'appNovo') leitura.appNovo = true
  leitura.avisos.push(porque === 'appNovo' ? `Acumulador: ${erro.message}: atualize o app` : `Acumulador: ${erro.message}: refaça no editor`)
  return { porque, motivo: erro.message, bruto: comoJson(valor) }
}

/** Lê com `ler`; a regra torta ou de app mais novo volta como `naoLida` (o resto do acumulador fica). */
function ouNaoLida<T>(valor: unknown, ler: (valor: unknown) => T, leitura: LeituraDoAcumulador): T | RegraNaoLida {
  try {
    return ler(valor)
  } catch (erro) {
    if (!(erro instanceof PecaTorta || erro instanceof PecaDeAppNovo)) throw erro
    return regraNaoLida(valor, erro, leitura)
  }
}

function subidaLida(valor: unknown): SubidaDoAcumulador {
  const peca = registro(valor, 'regra de subir')
  const quando = umDe(peca.quando, QUANDO_SOBE, 'regra de subir (quando)')
  const onde = `regra de subir "${quando}"`
  switch (quando) {
    case 'usaTecnica':
      soChaves(peca, ['quando', 'quanto', 'tecnica'], onde)
      return { quando, tecnica: referencia(peca.tecnica, `${onde} (técnica)`), quanto: inteiro(peca.quanto, 1, PASSO_DO_ACUMULADOR_MAX, `${onde} (quanto)`) }
    case 'gastaSp':
      soChaves(peca, ['quando', 'quanto', 'cada'], onde)
      return { quando, cada: inteiro(peca.cada, 1, RECURSO_DO_REQUISITO_MAX, `${onde} (a cada quanto SP)`), quanto: inteiro(peca.quanto, 1, PASSO_DO_ACUMULADOR_MAX, `${onde} (quanto)`) }
    default:
      soChaves(peca, ['quando', 'quanto'], onde)
      return { quando, quanto: inteiro(peca.quanto, 1, PASSO_DO_ACUMULADOR_MAX, `${onde} (quanto)`) }
  }
}

function descidaLida(valor: unknown): DescidaDoAcumulador {
  const peca = registro(valor, 'regra de cair')
  const quando = umDe(peca.quando, QUANDO_DESCE, 'regra de cair (quando)')
  const onde = `regra de cair "${quando}"`
  switch (quando) {
    case 'fimDaBatalha':
      soChaves(peca, ['quando'], onde)
      return { quando }
    case 'rodadaSemUso':
      soChaves(peca, ['quando', 'quanto'], onde)
      return { quando, quanto: inteiro(peca.quanto, 1, PASSO_DO_ACUMULADOR_MAX, `${onde} (quanto)`) }
    case 'apanha':
      soChaves(peca, ['quando', 'quanto'], onde)
      return { quando, quanto: peca.quanto === 'tudo' ? 'tudo' : inteiro(peca.quanto, 1, PASSO_DO_ACUMULADOR_MAX, `${onde} (quanto)`) }
  }
}

/** `cada` x o nível, ou o total de cada nível (tantos quanto o máximo), um dos dois. */
function valorPorNivel(peca: Readonly<Record<string, unknown>>, maximo: number, onde: string): ValorPorNivel {
  if ((peca.cada === undefined) === (peca.niveis === undefined)) torta(`${onde}: diga "cada nível" ou o valor de cada nível, um dos dois`)
  if (peca.cada !== undefined) return { cada: inteiro(peca.cada, 1, DANO_MAX, `${onde} (cada nível)`) }
  if (!Array.isArray(peca.niveis) || peca.niveis.length !== maximo) torta(`${onde}: um valor para cada um dos ${maximo} níveis`)
  return { niveis: peca.niveis.map((valor: unknown, indice) => inteiro(valor, 0, DANO_MAX, `${onde} (nível ${indice + 1})`)) }
}

function ganhoLido(maximo: number): (valor: unknown) => GanhoDoAcumulador {
  return (valor) => {
    const peca = registro(valor, 'o que cada nível dá')
    const ganho = umDe(peca.ganho, GANHOS, 'o que cada nível dá')
    const onde = `o que cada nível dá ("${ganho}")`
    switch (ganho) {
      case 'nada':
        soChaves(peca, ['ganho'], onde)
        return { ganho }
      case 'dano':
        soChaves(peca, ['ganho', 'cada', 'niveis'], onde)
        return { ganho, ...valorPorNivel(peca, maximo, onde) }
      case 'atributo':
        soChaves(peca, ['ganho', 'atributo', 'cada', 'niveis'], onde)
        return { ganho, atributo: referencia(peca.atributo, `${onde} (atributo)`), ...valorPorNivel(peca, maximo, onde) }
    }
  }
}

function regrasLidas<T>(valor: unknown, onde: string, ler: (valor: unknown) => T, leitura: LeituraDoAcumulador): (T | RegraNaoLida)[] {
  if (valor === undefined) return []
  if (!Array.isArray(valor)) {
    leitura.avisos.push(`Acumulador: ${onde} torto, ignorado`)
    return []
  }
  return comTeto(valor, REGRAS_DO_ACUMULADOR_MAX, `Acumulador: ${onde}`, leitura).map((regra) => ouNaoLida(regra, ler, leitura))
}

function ehRegraNaoLida<T extends object>(regra: T | RegraNaoLida): regra is RegraNaoLida {
  return 'bruto' in regra
}

const CHAVES_DO_ACUMULADOR = ['v', 'id', 'nome', 'maximo', 'sobe', 'desce', 'ganho']

/**
 * Lê a definição de um acumulador (`AcumuladorDaFicha`). Nunca lança. Sem id, nome ou máximo que
 * valham = ignorado com aviso; regra de subir ou de cair, ou o ganho, torta ou de app mais novo =
 * guardada como veio (`naoLida`) e o resto fica. Sem ganho = "nada" (só conta).
 */
export function lerAcumulador(valor: unknown): AcumuladorLido {
  if (valor === undefined || valor === null) return { acumulador: null, deAppNovo: false, avisos: [] }
  if (!ehRegistro(valor)) return { acumulador: null, deAppNovo: false, avisos: ['Acumulador torto: ignorado'] }
  if (valor.v !== undefined && (typeof valor.v !== 'number' || !Number.isInteger(valor.v) || valor.v < 1)) return { acumulador: null, deAppNovo: false, avisos: ['Acumulador com versão torta: ignorado'] }
  if (typeof valor.v === 'number' && valor.v > VERSAO_DO_ACUMULADOR) return { acumulador: null, deAppNovo: true, avisos: [`Acumulador da versão ${valor.v}, de app mais novo: atualize o app`] }
  const leitura: LeituraDoAcumulador = { avisos: valor.v === undefined ? ['Acumulador sem versão: lido como a versão 1'] : [], appNovo: false }
  const desconhecida = chaveDesconhecida(valor, CHAVES_DO_ACUMULADOR)
  if (desconhecida !== undefined) {
    leitura.appNovo = true
    leitura.avisos.push(`Acumulador: chave "${desconhecida}" de app mais novo: atualize o app`)
  }
  let base: Pick<AcumuladorDaFicha, 'id' | 'nome' | 'maximo'>
  try {
    if (typeof valor.id !== 'string' || valor.id.length > ID_DO_REQUISITO_MAX || !ID_VALIDO.test(valor.id)) torta('id torto')
    base = { id: valor.id, nome: texto(valor.nome, NOME_DO_ACUMULADOR_MAX, 'nome'), maximo: inteiro(valor.maximo, 1, NIVEL_DO_ACUMULADOR_MAX, 'nível máximo') }
  } catch (erro) {
    if (!(erro instanceof PecaTorta || erro instanceof PecaDeAppNovo)) throw erro
    return { acumulador: null, deAppNovo: leitura.appNovo, avisos: [...leitura.avisos, `Acumulador torto (${erro.message}): ignorado`] }
  }
  const sobe = regrasLidas(valor.sobe, 'regras de subir', subidaLida, leitura).map((regra): AcumuladorDaFicha['sobe'][number] => (ehRegraNaoLida(regra) ? { quando: 'naoLida', ...regra } : regra))
  const desce = regrasLidas(valor.desce, 'regras de cair', descidaLida, leitura).map((regra): AcumuladorDaFicha['desce'][number] => (ehRegraNaoLida(regra) ? { quando: 'naoLida', ...regra } : regra))
  const ganho: GanhoDoAcumulador | RegraNaoLida = valor.ganho === undefined ? { ganho: 'nada' } : ouNaoLida(valor.ganho, ganhoLido(base.maximo), leitura)
  return { acumulador: { v: VERSAO_DO_ACUMULADOR, ...base, sobe, desce, ganho: ehRegraNaoLida(ganho) ? { ganho: 'naoLido', ...ganho } : ganho }, deAppNovo: leitura.appNovo, avisos: leitura.avisos }
}

/** A definição como o disco a guarda; a regra não lida volta como veio. */
export function acumuladorParaGuardar(acumulador: AcumuladorDaFicha): ObjetoJson {
  return {
    v: acumulador.v,
    id: acumulador.id,
    nome: acumulador.nome,
    maximo: acumulador.maximo,
    sobe: acumulador.sobe.map((regra) => (regra.quando === 'naoLida' ? regra.bruto : comoJson(regra))),
    desce: acumulador.desce.map((regra) => (regra.quando === 'naoLida' ? regra.bruto : comoJson(regra))),
    ganho: acumulador.ganho.ganho === 'naoLido' ? acumulador.ganho.bruto : comoJson(acumulador.ganho),
  }
}

/** A peça "+N <acumulador>" lida, ou por que não (o motor decide o que fazer com a não lida). */
export type PecaDoAcumuladorLida = { peca: PecaDoAcumulador } | { peca: null; porque: 'appNovo' | 'torto'; motivo: string }

/** Lê a peça de efeito "+N <acumulador>". Nunca lança. */
export function lerPecaDoAcumulador(valor: unknown): PecaDoAcumuladorLida {
  try {
    const peca = registro(valor, 'peça do acumulador')
    if (peca.tipo !== 'acumulador') torta('não é a peça do acumulador')
    soChaves(peca, ['tipo', 'acumulador', 'quanto'], 'peça do acumulador')
    return { peca: { tipo: 'acumulador', acumulador: referencia(peca.acumulador, 'peça do acumulador (acumulador)'), quanto: inteiro(peca.quanto, 1, PASSO_DO_ACUMULADOR_MAX, 'peça do acumulador (quanto)') } }
  } catch (erro) {
    if (!(erro instanceof PecaTorta || erro instanceof PecaDeAppNovo)) throw erro
    return { peca: null, porque: erro instanceof PecaDeAppNovo ? 'appNovo' : 'torto', motivo: erro.message }
  }
}

/* ------------------------------------------------------------------ gravar ---------------- */

function pecaParaGuardar(peca: PecaDoGrupo): ValorJson {
  if (ehNaoLido(peca)) return peca.bruto
  if (ehUmDestes(peca)) return { id: peca.id, umDestes: peca.umDestes.map((opcao) => (ehNaoLido(opcao) ? opcao.bruto : comoJson(opcao))) }
  return comoJson(peca)
}

function grupoParaGuardar(grupo: GrupoDeRequisitos): ObjetoJson {
  return { todos: grupo.todos.map(pecaParaGuardar) }
}

/**
 * O bloco como o disco e o fio o guardam (JSON puro, sem `undefined`). A peça não lida volta
 * como veio. `lerRequisitos` do resultado devolve o mesmo bloco.
 */
export function requisitosParaGuardar(bloco: RequisitosDoCartao): ObjetoJson {
  const guardado: ObjetoJson = { v: bloco.v }
  if (bloco.usar !== undefined) guardado.usar = grupoParaGuardar(bloco.usar)
  if (bloco.evoluir !== undefined) guardado.evoluir = { grupo: grupoParaGuardar(bloco.evoluir.grupo), dura: bloco.evoluir.dura }
  if (bloco.aoUsar !== undefined) guardado.aoUsar = { sobeParte: true }
  if (bloco.forma !== undefined) guardado.forma = comoJson(bloco.forma)
  return guardado
}

/* ------------------------------------------------------------------ marcas ---------------- */

/** A mesma marca, sem olhar maiúscula nem acento ("fogo" = "Fogo"). */
export function mesmaMarca(a: string, b: string): boolean {
  return normalizar(a) === normalizar(b)
}

/**
 * As marcas do cartão (`CartaoDaFicha.marcas`), tolerante: o que não é texto sai, o texto é
 * aparado e cortado no teto, a repetida (sem olhar maiúscula nem acento) sai, até `MARCAS_MAX`.
 */
export function lerMarcas(valor: unknown): string[] {
  if (!Array.isArray(valor)) return []
  const marcas: string[] = []
  for (const item of valor) {
    if (typeof item !== 'string') continue
    const marca = item.replace(/\s+/g, ' ').trim().slice(0, MARCA_MAX).trim()
    if (marca.length === 0 || marcas.some((outra) => mesmaMarca(outra, marca))) continue
    marcas.push(marca)
    if (marcas.length === MARCAS_MAX) break
  }
  return marcas
}
