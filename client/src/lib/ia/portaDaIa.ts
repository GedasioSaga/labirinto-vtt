import { invoke, isTauri } from '@tauri-apps/api/core'

/**
 * A PORTA DA IA (M4 do mundo do livro de regras, docs/planos/livros-de-regras-plano.md):
 * o único lugar do TypeScript que fala com o assistente. Não há fetch nem
 * chave aqui: a chave mora no Cofre do Windows e a chamada ao Google sai do
 * Rust (desktop/src-tauri/src/ia.rs). A webview só manda o pedido em campos
 * fechados e recebe o texto da resposta.
 *
 * Os 4 comandos (lista fechada, só na janela principal):
 *  - `ia_chaves_estado()` -> quantas chaves guardadas (0 a 3), nunca a chave;
 *  - `ia_chaves_guardar({ chaves })` -> quantas ficaram;
 *  - `ia_chaves_apagar()`;
 *  - `ia_gerar({ pedido })` -> `{ texto, trocouPara }`.
 * Erro de qualquer um chega como `{ codigo, mensagem, status, detalhe }`, com
 * a mensagem já pronta em português (`ErroDaIa`).
 */

/**
 * Os modelos que o app aceita, no MESMO texto e ordem da `MODELOS_GEMINI` do
 * Rust (desktop/src-tauri/src/ia.rs), que recusa qualquer outro. Mudou aqui,
 * muda lá. Vieram do projeto-rpg-v2.
 */
export const MODELOS_GEMINI = [
  'gemini-2.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-3-flash-preview',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-2.5-pro',
  'gemini-3.1-pro-preview',
] as const // as const: lista literal (os ids viram o tipo ModeloGemini), não é cast

export type ModeloGemini = (typeof MODELOS_GEMINI)[number]

/** O modelo de quem nunca escolheu: o mais barato e rápido da lista. */
export const MODELO_PADRAO: ModeloGemini = 'gemini-2.5-flash-lite'

/** Até 3 chaves: quando a cota de uma acaba, o Rust passa para a próxima. */
export const CHAVES_MAX = 3
/** Chave aceita pelo Rust: aparada, 30 a 100 caracteres, só letras, dígitos, hífen e sublinhado. */
export const CHAVE_MIN_CARACTERES = 30
export const CHAVE_MAX_CARACTERES = 100
const FORMA_DA_CHAVE = /^[A-Za-z0-9_-]+$/
/** Retratos por pergunta (o Rust recusa mais). */
export const IMAGENS_MAX = 4
/** Mensagens da conversa anterior que o Rust aceita num pedido. */
export const HISTORICO_MAX = 200

export function ehModeloGemini(valor: unknown): valor is ModeloGemini {
  return typeof valor === 'string' && MODELOS_GEMINI.some((modelo) => modelo === valor)
}

/** A chave digitada passa na regra do Rust? Vazia não conta (campo que o mestre deixou em branco). */
export function chaveTemForma(chave: string): boolean {
  const limpa = chave.trim()
  return limpa.length >= CHAVE_MIN_CARACTERES && limpa.length <= CHAVE_MAX_CARACTERES && FORMA_DA_CHAVE.test(limpa)
}

export type PapelNaConversa = 'user' | 'model'

export interface MensagemDaIa {
  papel: PapelNaConversa
  texto: string
}

export type TipoDaImagem = 'image/png' | 'image/jpeg' | 'image/webp'

export const TIPOS_DA_IMAGEM: readonly TipoDaImagem[] = ['image/png', 'image/jpeg', 'image/webp']

export interface ImagemDaIa {
  mimeType: TipoDaImagem
  /** Base64 puro, sem o prefixo `data:...;base64,`. */
  base64: string
}

/**
 * O esquema da resposta (`generationConfig.responseSchema` do Gemini), no
 * pedaço que o app usa. Presente no pedido = a resposta vem como texto JSON.
 */
export interface EsquemaDaIa {
  type: 'OBJECT' | 'ARRAY' | 'STRING' | 'INTEGER' | 'NUMBER' | 'BOOLEAN'
  description?: string
  enum?: string[]
  properties?: Record<string, EsquemaDaIa>
  required?: string[]
  items?: EsquemaDaIa
}

/** O pedido, campo a campo como o Rust lê (`PedidoIa`, camelCase, campo desconhecido é recusado). */
export interface PedidoDaIa {
  modelo: ModeloGemini
  /** Vazio ou ausente = sem instrução de sistema. */
  systemPrompt?: string
  /** A conversa anterior, em ordem, só texto. */
  historico?: MensagemDaIa[]
  /** A pergunta nova (com o contexto montado), depois do histórico. */
  texto: string
  /** Até `IMAGENS_MAX` retratos, presos à pergunta nova. */
  imagens?: ImagemDaIa[]
  esquemaResposta?: EsquemaDaIa
}

export interface RespostaDaIa {
  /** O texto do primeiro candidato (JSON em texto quando houve esquema). */
  texto: string
  /** Índice (0-based) da chave que virou a ativa depois de a cota acabar na anterior; `null` = não trocou. */
  trocouPara: number | null
}

/**
 * Os códigos estáveis do Rust (o TS decide por eles), mais os dois que só o
 * TS dá: `fora_do_app` (sem Tauri, no navegador) e `desconhecido` (erro que
 * não veio no formato da porta).
 */
export const CODIGOS_DO_ERRO = [
  'janela',
  'cofre',
  'chaves_invalidas',
  'sem_chave',
  'modelo_invalido',
  'corpo_invalido',
  'chave_recusada',
  'modelo_indisponivel',
  'servidor',
  'http',
  'cota_esgotada',
  'rede',
  'resposta_invalida',
  'fora_do_app',
  'desconhecido',
] as const // as const: lista literal (os códigos viram o tipo CodigoDoErroDaIa), não é cast

export type CodigoDoErroDaIa = (typeof CODIGOS_DO_ERRO)[number]

function ehCodigoDoErro(valor: unknown): valor is CodigoDoErroDaIa {
  return typeof valor === 'string' && CODIGOS_DO_ERRO.some((codigo) => codigo === valor)
}

/** Erros que se resolvem na engrenagem (pôr ou trocar a chave). */
export const ERROS_DA_CHAVE: readonly CodigoDoErroDaIa[] = ['sem_chave', 'chave_recusada', 'chaves_invalidas']
/** Erros que se resolvem escolhendo outro modelo na engrenagem. */
export const ERROS_DO_MODELO: readonly CodigoDoErroDaIa[] = ['modelo_invalido', 'modelo_indisponivel']

const MENSAGEM_FORA_DO_APP = 'A IA só funciona no app instalado.'
const MENSAGEM_DESCONHECIDA = 'A IA não respondeu do jeito esperado. Tente de novo.'

/** O erro da porta: `message` é a frase pronta para o mestre; `codigo` decide o que a tela oferece. */
export class ErroDaIa extends Error {
  readonly codigo: CodigoDoErroDaIa
  /** O status HTTP do Google, quando o erro veio de lá. */
  readonly status: number | null
  /** Até 300 caracteres do corpo do erro do Google, já com a chave mascarada pelo Rust. */
  readonly detalhe: string | null

  constructor(codigo: CodigoDoErroDaIa, mensagem: string, status: number | null = null, detalhe: string | null = null) {
    super(mensagem)
    this.name = 'ErroDaIa'
    this.codigo = codigo
    this.status = status
    this.detalhe = detalhe
  }
}

function isRecord(valor: unknown): valor is Record<string, unknown> {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor)
}

/** Qualquer coisa que um comando rejeitou, como `ErroDaIa`. O formato do Rust passa inteiro; o resto vira `desconhecido`. */
export function erroDaIa(erro: unknown): ErroDaIa {
  if (erro instanceof ErroDaIa) return erro
  if (isRecord(erro) && ehCodigoDoErro(erro.codigo) && typeof erro.mensagem === 'string' && erro.mensagem.trim().length > 0) {
    const status = typeof erro.status === 'number' && Number.isInteger(erro.status) ? erro.status : null
    const detalhe = typeof erro.detalhe === 'string' && erro.detalhe.length > 0 ? erro.detalhe : null
    return new ErroDaIa(erro.codigo, erro.mensagem, status, detalhe)
  }
  return new ErroDaIa('desconhecido', MENSAGEM_DESCONHECIDA)
}

function exigirApp(): void {
  if (!isTauri()) throw new ErroDaIa('fora_do_app', MENSAGEM_FORA_DO_APP)
}

/** Contagem de chaves válida (0 a `CHAVES_MAX`); o resto é resposta fora do formato. */
function contagemDeChaves(valor: unknown): number {
  if (typeof valor === 'number' && Number.isInteger(valor) && valor >= 0 && valor <= CHAVES_MAX) return valor
  throw new ErroDaIa('desconhecido', MENSAGEM_DESCONHECIDA)
}

/** Chama o comando e devolve o valor cru (a validação é de quem chama); rejeição vira `ErroDaIa`. */
async function chamar(comando: string, argumentos?: Record<string, unknown>): Promise<unknown> {
  exigirApp()
  try {
    return await invoke<unknown>(comando, argumentos)
  } catch (erro) {
    throw erroDaIa(erro)
  }
}

/** Quantas chaves estão guardadas neste computador (0 a 3). Lança `ErroDaIa`. */
export async function estadoDasChaves(): Promise<number> {
  return contagemDeChaves(await chamar('ia_chaves_estado'))
}

/**
 * Troca as chaves guardadas pelas desta lista (a primeira vira a ativa).
 * Campos em branco saem antes; depois disso a chave não volta mais ao JS.
 * Devolve quantas ficaram. Lança `ErroDaIa`.
 */
export async function guardarChaves(chaves: readonly string[]): Promise<number> {
  const preenchidas = chaves.map((chave) => chave.trim()).filter((chave) => chave.length > 0)
  return contagemDeChaves(await chamar('ia_chaves_guardar', { chaves: preenchidas }))
}

/** Apaga a credencial do cofre (apagar o que não existe não é erro). Lança `ErroDaIa`. */
export async function apagarChaves(): Promise<void> {
  await chamar('ia_chaves_apagar')
}

/** Pergunta à IA. Lança `ErroDaIa` (sem chave, cota esgotada em todas, rede, Google...). */
export async function gerarNaIa(pedido: PedidoDaIa): Promise<RespostaDaIa> {
  const resposta = await chamar('ia_gerar', { pedido })
  if (!isRecord(resposta) || typeof resposta.texto !== 'string') throw new ErroDaIa('resposta_invalida', MENSAGEM_DESCONHECIDA)
  const troca = resposta.trocouPara
  const trocouPara = typeof troca === 'number' && Number.isInteger(troca) && troca >= 0 && troca < CHAVES_MAX ? troca : null
  return { texto: resposta.texto, trocouPara }
}
