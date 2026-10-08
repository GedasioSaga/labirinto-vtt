/**
 * SISTEMA DE RPG: as regras de ficha de um jogo (One Piece, D&D...) como DADO,
 * e não como tela. A ficha de personagem (`lib/personagem.ts`) é desenhada a
 * partir daqui — quais atributos existem, como cada um vira rank, quais abas
 * de cartões a ficha tem e o que cada cartão mostra. Por isso um sistema novo
 * entra por arquivo (o "+" da grade de sistemas) e, na entrega 6, pelo editor
 * do app, sem tocar em componente nenhum.
 *
 * Tudo aqui é JSON puro: o sistema importado é o arquivo que a pessoa
 * escolheu, e o embutido (`lib/sistemas/onePiece.ts`) é o mesmo formato.
 *
 * Catálogos e livro de regras (entrega 3) ainda não existem no formato: quem
 * os trouxer estende `SistemaDeRpg` e `lerSistemaDeRpg` juntos.
 */

/** Versão do formato do arquivo de sistema. Arquivo de versão maior é recusado. */
export const FORMATO_DO_SISTEMA = 1

/**
 * Tabela de rank de um atributo: o rank começa em `inicial` e sobe um degrau a
 * cada limiar alcançado. Força do One Piece: inicial 1, limiares 40, 90, 150...
 * — 39 é R1, 40 é R2. Os limiares ficam em ordem crescente (a leitura ordena).
 */
export interface TabelaDeRank {
  inicial: number
  limiares: number[]
}

export interface AtributoDoSistema {
  /** Chave do valor na ficha (`Personagem.atributos[id]`). Nunca muda depois de criado. */
  id: string
  nome: string
  /** Rótulo curto dos chips ("PER · INT", "FOR +25"). */
  abreviacao: string
  /** Sem tabela, o atributo não mostra rank. */
  rank?: TabelaDeRank
}

/** Cor do quadrinho do recurso na ficha: vida (vermelho), energia (azul) ou neutro. */
export type TomDoRecurso = 'vida' | 'energia' | 'neutro'

export interface RecursoDoSistema {
  /** Chave do valor na ficha (`Personagem.recursos[id]`). */
  id: string
  nome: string
  tom: TomDoRecurso
}

/** Lista fechada da ficha (Raça, Ofício): o valor escolhido aparece como chip no topo. */
export interface EscolhaDoSistema {
  /** Chave do valor na ficha (`Personagem.escolhas[id]`). */
  id: string
  rotulo: string
  opcoes: string[]
}

/**
 * Como o campo aparece no cartão:
 *  - `paragrafo`: texto corrido, sem rótulo (a descrição);
 *  - `linha`: "Rótulo: valor" na lista de campos do cartão;
 *  - `destaque`: bloco "Rótulo: valor" com fundo próprio (o Efeito da vantagem).
 * Campo vazio não aparece em nenhuma das três.
 */
export type FormaDoCampo = 'paragrafo' | 'linha' | 'destaque'

export interface CampoDoCartao {
  /** Chave do valor no cartão (`CartaoDaFicha.campos[id]`). */
  id: string
  rotulo: string
  forma: FormaDoCampo
}

/**
 * Uma aba da ficha (Habilidades, Perícias...) e o molde dos cartões dela. Os
 * opcionais ligam partes do cartão que só algumas abas têm.
 */
export interface AbaDoSistema {
  id: string
  nome: string
  /** O nome de UM cartão: "+ Habilidade" e o nome do cartão novo. */
  item: string
  /** O que a aba diz quando não tem cartão nenhum. */
  vazio: string
  campos: CampoDoCartao[]
  /** Linhas livres "nome: valor" depois dos campos fixos (os campos extras da técnica). */
  extras?: boolean
  /** O cartão escolhe atributos do sistema (a perícia "Percepção · Intuição"). */
  atributos?: boolean
  /** O cartão tem imagem própria (a transformação). */
  imagem?: boolean
  /** O cartão soma ou tira pontos de atributos (os modificadores da transformação). */
  modificadores?: boolean
  /** Cartões de OUTRA aba dentro deste (as técnicas próprias da transformação). */
  subcartoes?: { aba: string; rotulo: string }
}

export interface SistemaDeRpg {
  formato: number
  id: string
  nome: string
  versao: string
  descricao: string
  /** Cor da capa na grade de sistemas, `#rrggbb`. */
  cor: string
  escolhas: EscolhaDoSistema[]
  recursos: RecursoDoSistema[]
  atributos: AtributoDoSistema[]
  abas: AbaDoSistema[]
}

/** Rank do valor na tabela; `null` quando o atributo não tem tabela ou o valor não é número. */
export function rankDoValor(tabela: TabelaDeRank | undefined, valor: number): number | null {
  if (tabela === undefined || !Number.isFinite(valor)) return null
  let rank = tabela.inicial
  for (const limiar of tabela.limiares) {
    if (valor < limiar) break
    rank += 1
  }
  return rank
}

/** "R7": o chip do rank na ficha. */
export function rotuloDoRank(rank: number): string {
  return `R${rank}`
}

/** A aba do sistema pelo id, para o cartão de dentro (`subcartoes`) achar o molde dele. */
export function abaDoSistema(sistema: SistemaDeRpg, abaId: string): AbaDoSistema | undefined {
  return sistema.abas.find((aba) => aba.id === abaId)
}

// ───────────────────────────────────────────────────────────────────────────
// Leitura tolerante do arquivo
// ───────────────────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function texto(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function lista(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

/**
 * Id que vira nome de arquivo na biblioteca (`<appData>/sistemas/<id>.json`)
 * e chave dentro da ficha: só letra, número, `-` e `_`. Qualquer outra coisa
 * poderia sair da pasta (`..`) ou quebrar o nome do arquivo no Windows.
 */
const ID_VALIDO = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/

export function idValido(value: unknown): value is string {
  return typeof value === 'string' && ID_VALIDO.test(value)
}

const COR_VALIDA = /^#[0-9a-fA-F]{6}$/
const COR_PADRAO = '#7a6a52'

const TONS: readonly TomDoRecurso[] = ['vida', 'energia', 'neutro']
const FORMAS: readonly FormaDoCampo[] = ['paragrafo', 'linha', 'destaque']

/** Itens com id válido e sem id repetido: o primeiro vence, o resto sai. */
function semRepetidos<T extends { id: string }>(itens: (T | null)[]): T[] {
  const vistos = new Set<string>()
  const fora: T[] = []
  for (const item of itens) {
    if (item === null || vistos.has(item.id)) continue
    vistos.add(item.id)
    fora.push(item)
  }
  return fora
}

function tabelaDoArquivo(value: unknown): TabelaDeRank | undefined {
  if (!isRecord(value)) return undefined
  const { inicial, limiares } = value
  if (typeof inicial !== 'number' || !Number.isInteger(inicial)) return undefined
  const numeros = lista(limiares).filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
  // Tabela com qualquer limiar torto não é a tabela que o autor quis: sem rank, em vez de rank errado.
  if (numeros.length !== lista(limiares).length) return undefined
  return { inicial, limiares: [...numeros].sort((a, b) => a - b) }
}

function atributoDoArquivo(value: unknown): AtributoDoSistema | null {
  if (!isRecord(value) || !idValido(value.id)) return null
  const nome = texto(value.nome) || value.id
  const abreviacao = texto(value.abreviacao) || nome.slice(0, 3).toUpperCase()
  const rank = tabelaDoArquivo(value.rank)
  return rank === undefined ? { id: value.id, nome, abreviacao } : { id: value.id, nome, abreviacao, rank }
}

function recursoDoArquivo(value: unknown): RecursoDoSistema | null {
  if (!isRecord(value) || !idValido(value.id)) return null
  const tom = TONS.find((candidato) => candidato === value.tom) ?? 'neutro'
  return { id: value.id, nome: texto(value.nome) || value.id, tom }
}

function escolhaDoArquivo(value: unknown): EscolhaDoSistema | null {
  if (!isRecord(value) || !idValido(value.id)) return null
  const opcoes = [...new Set(lista(value.opcoes).map(texto).filter((opcao) => opcao.length > 0))]
  return { id: value.id, rotulo: texto(value.rotulo) || value.id, opcoes }
}

function campoDoArquivo(value: unknown): CampoDoCartao | null {
  if (!isRecord(value) || !idValido(value.id)) return null
  const forma = FORMAS.find((candidata) => candidata === value.forma) ?? 'linha'
  return { id: value.id, rotulo: texto(value.rotulo) || value.id, forma }
}

function abaDoArquivo(value: unknown): AbaDoSistema | null {
  if (!isRecord(value) || !idValido(value.id)) return null
  const nome = texto(value.nome) || value.id
  const aba: AbaDoSistema = {
    id: value.id,
    nome,
    item: texto(value.item) || nome,
    vazio: texto(value.vazio) || `Nada em ${nome}.`,
    campos: semRepetidos(lista(value.campos).map(campoDoArquivo)),
  }
  // Só `true` liga cada parte: qualquer outra coisa vinda do arquivo fica desligada.
  if (value.extras === true) aba.extras = true
  if (value.atributos === true) aba.atributos = true
  if (value.imagem === true) aba.imagem = true
  if (value.modificadores === true) aba.modificadores = true
  const sub = value.subcartoes
  if (isRecord(sub) && idValido(sub.aba) && sub.aba !== value.id) aba.subcartoes = { aba: sub.aba, rotulo: texto(sub.rotulo) || sub.aba }
  return aba
}

/** Resultado da leitura: o sistema, ou a razão em português de não dar para usar o arquivo. */
export type SistemaLido = { ok: true; sistema: SistemaDeRpg } | { ok: false; erro: string }

/**
 * Lê um sistema vindo de arquivo. Recusa (com a razão) o que não dá para usar:
 * sem id, sem nome, de formato futuro ou sem atributo nenhum. O resto é
 * tolerante: atributo, recurso, aba ou campo torto sai sozinho; subcartão que
 * aponta para aba inexistente é desligado.
 */
export function lerSistemaDeRpg(value: unknown): SistemaLido {
  if (!isRecord(value)) return { ok: false, erro: 'o arquivo não descreve um sistema de RPG (não é um objeto JSON)' }
  const formato = typeof value.formato === 'number' ? value.formato : FORMATO_DO_SISTEMA
  if (formato > FORMATO_DO_SISTEMA) return { ok: false, erro: `o sistema é do formato ${formato}, mais novo que este Labirinto (formato ${FORMATO_DO_SISTEMA})` }
  if (!idValido(value.id)) return { ok: false, erro: 'o sistema não tem um id válido (letras, números, - e _)' }
  const nome = texto(value.nome)
  if (nome.length === 0) return { ok: false, erro: 'o sistema não tem nome' }
  const atributos = semRepetidos(lista(value.atributos).map(atributoDoArquivo))
  if (atributos.length === 0) return { ok: false, erro: `o sistema "${nome}" não tem nenhum atributo` }

  const abasLidas = semRepetidos(lista(value.abas).map(abaDoArquivo))
  const idsDasAbas = new Set(abasLidas.map((aba) => aba.id))
  const abas = abasLidas.map((aba) => {
    if (aba.subcartoes === undefined || idsDasAbas.has(aba.subcartoes.aba)) return aba
    const { subcartoes: _orfao, ...semSub } = aba
    return semSub
  })
  const cor = typeof value.cor === 'string' && COR_VALIDA.test(value.cor) ? value.cor : COR_PADRAO
  return {
    ok: true,
    sistema: {
      formato: FORMATO_DO_SISTEMA,
      id: value.id,
      nome,
      versao: texto(value.versao) || '1',
      descricao: texto(value.descricao),
      cor,
      escolhas: semRepetidos(lista(value.escolhas).map(escolhaDoArquivo)),
      recursos: semRepetidos(lista(value.recursos).map(recursoDoArquivo)),
      atributos,
      abas,
    },
  }
}

/** O texto do arquivo, inteiro: JSON quebrado também é recusado com a razão. */
export function lerSistemaDoTexto(json: string): SistemaLido {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch (error) {
    return { ok: false, erro: `o arquivo não é JSON válido (${error instanceof Error ? error.message : String(error)})` }
  }
  return lerSistemaDeRpg(parsed)
}

export function serializarSistema(sistema: SistemaDeRpg): string {
  return JSON.stringify(sistema, null, 2)
}
