import { cleanPlayerName, nameSkeleton } from './chat'

/**
 * CONTAS DOS JOGADORES — o login próprio do app. O mestre cria, para cada
 * jogador, uma conta com NOME + PIN; o jogador digita os dois só na primeira
 * vez num aparelho e o mestre devolve um segredo do aparelho, que o navegador
 * dele guarda para entrar sozinho da próxima vez (`net/entradaComConta.ts`).
 * Sem serviço de fora: tudo mora no computador do mestre.
 *
 * É do APP, não da aventura (como o acervo de itens): a mesma Ana joga em
 * qualquer aventura. Mora em `appDataDir()/contas/contas.json`
 * (`lib/contasNoDisco.ts`).
 *
 * O que NUNCA fica guardado: o PIN e o segredo do aparelho. Do PIN fica o
 * PBKDF2-SHA256 com sal próprio de cada conta; do segredo do aparelho, o
 * SHA-256 (ele já é aleatório de 256 bits — não há dicionário a frear).
 * Nada disto vai ao jogador: a sala só sabe o id e o nome da conta.
 */

export const FORMATO_DAS_CONTAS = 1
export const PIN_MIN_DIGITOS = 4
export const PIN_MAX_DIGITOS = 12
/** Só dígitos: é o que o jogador digita no teclado numérico do celular. */
const PIN_PADRAO = /^\d{4,12}$/
/**
 * Iterações do PBKDF2 (a recomendação da OWASP para PBKDF2-HMAC-SHA256). O
 * número vai junto de cada conta: subir o padrão depois não invalida o PIN
 * de quem já tem conta.
 */
export const ITERACOES_DO_PIN = 600_000
/** Abaixo disso o arquivo foi mexido à mão: a conta não é lida. Acima, conferir travaria a sala. */
const ITERACOES_MIN = 100_000
const ITERACOES_MAX = 10_000_000
const SAL_BYTES = 16
const HASH_BITS = 256
const HASH_BYTES = HASH_BITS / 8
/** O segredo do aparelho: 32 bytes aleatórios, em base64url sem `=` (43 caracteres). */
export const APARELHO_TOKEN_BYTES = 32
export const APARELHO_TOKEN_PADRAO = /^[A-Za-z0-9_-]{43}$/
/** O mesmo teto do nome do `join` (`NAME_MAX_LENGTH`): a conta entra na sala com ele. */
export const NOME_DA_CONTA_MAX = 32
export const MAX_CONTAS = 64
/** Passou, sai o aparelho visto há mais tempo: celular trocado não fica lembrado para sempre. */
export const MAX_APARELHOS_POR_CONTA = 8
export const ROTULO_DO_APARELHO_MAX = 40
const ROTULO_PADRAO = 'Aparelho'
const ID_PADRAO = /^[A-Za-z0-9_-]{1,80}$/
/** O maior instante que `Date` representa. */
const DATA_MAX_MS = 8.64e15

export interface PinGuardado {
  algoritmo: 'PBKDF2-SHA256'
  iteracoes: number
  /** Base64 de `SAL_BYTES` aleatórios, um por conta (e novo a cada troca de PIN). */
  sal: string
  /** Base64 dos `HASH_BITS` derivados. */
  hash: string
}

export interface AparelhoDaConta {
  id: string
  /** Base64 do SHA-256 do segredo; o segredo em si só existiu na resposta ao jogador. */
  hash: string
  /** O que o mestre lê na lista ("Chrome no Android"). Veio do jogador: limpo e cortado. */
  rotulo: string
  criado: number
  vistoEm: number
}

export interface ContaDeJogador {
  id: string
  nome: string
  pin: PinGuardado
  aparelhos: AparelhoDaConta[]
  criada: number
}

export interface ArquivoDeContas {
  /** SÓ COM CONTA: a sala recusa quem entra só digitando o nome. Desligado por padrão. */
  soComConta: boolean
  contas: ContaDeJogador[]
}

/** O que a SALA sabe de cada conta: nada que ajude a adivinhar PIN ou segredo. */
export interface ContaNaSala {
  id: string
  nome: string
}

/** O que a sessão lê a cada `join` sem conta (`HostSessionOptions.contas`). */
export interface ContasNaSala {
  soComConta: boolean
  /** Os nomes das contas: digitar um deles não leva o assento nem as notas da conta. */
  nomes: readonly string[]
}

export function contasVazias(): ArquivoDeContas {
  return { soComConta: false, contas: [] }
}

export function pinValido(pin: string): boolean {
  return PIN_PADRAO.test(pin)
}

/** O nome como a conta o guarda: a mesma limpeza do nome do `join` (`cleanPlayerName`). */
export function nomeDaContaLimpo(nome: string): string {
  return cleanPlayerName(nome)
}

/** A chave que diz se dois nomes são o mesmo: o esqueleto do nome (`nameSkeleton`), como na sala. */
export function chaveDoNome(nome: string): string {
  return nameSkeleton(cleanPlayerName(nome))
}

export type ProblemaDaConta = 'nome_vazio' | 'nome_longo' | 'nome_repetido' | 'pin_invalido' | 'contas_demais'

export const TEXTO_DO_PROBLEMA: Record<ProblemaDaConta, string> = {
  nome_vazio: 'Digite o nome do jogador.',
  nome_longo: `O nome tem no máximo ${NOME_DA_CONTA_MAX} caracteres.`,
  nome_repetido: 'Já existe uma conta com esse nome.',
  pin_invalido: `O PIN tem de ${PIN_MIN_DIGITOS} a ${PIN_MAX_DIGITOS} números.`,
  contas_demais: `O limite é de ${MAX_CONTAS} contas.`,
}

/** Por que a conta nova não pode ser criada; `null` = pode. */
export function problemaDaNovaConta(arquivo: ArquivoDeContas, nome: string, pin: string): ProblemaDaConta | null {
  const limpo = nomeDaContaLimpo(nome)
  if (limpo.length === 0) return 'nome_vazio'
  if (limpo.length > NOME_DA_CONTA_MAX) return 'nome_longo'
  const chave = chaveDoNome(limpo)
  if (arquivo.contas.some((conta) => chaveDoNome(conta.nome) === chave)) return 'nome_repetido'
  if (!pinValido(pin)) return 'pin_invalido'
  if (arquivo.contas.length >= MAX_CONTAS) return 'contas_demais'
  return null
}

// ---------------------------------------------------------------------------
// Criptografia (WebCrypto: a mesma no app, no navegador e no Node dos testes)

function subtle(): SubtleCrypto {
  return globalThis.crypto.subtle
}

function bytesAleatorios(quantos: number): Uint8Array<ArrayBuffer> {
  return globalThis.crypto.getRandomValues(new Uint8Array(quantos))
}

function paraBase64(bytes: Uint8Array): string {
  let binario = ''
  for (const byte of bytes) binario += String.fromCharCode(byte)
  return btoa(binario)
}

/** `null` = não é base64 (arquivo mexido à mão). */
function deBase64(texto: string): Uint8Array<ArrayBuffer> | null {
  try {
    const binario = atob(texto)
    const bytes = new Uint8Array(binario.length)
    for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

function paraBase64Url(bytes: Uint8Array): string {
  return paraBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function derivarPin(pin: string, sal: Uint8Array<ArrayBuffer>, iteracoes: number): Promise<Uint8Array> {
  const chave = await subtle().importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await subtle().deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: iteracoes }, chave, HASH_BITS)
  return new Uint8Array(bits)
}

/** O PIN como a conta o guarda: sal novo, PBKDF2. O PIN em si não sai daqui. */
export async function guardarPin(pin: string): Promise<PinGuardado> {
  const sal = bytesAleatorios(SAL_BYTES)
  const hash = await derivarPin(pin, sal, ITERACOES_DO_PIN)
  return { algoritmo: 'PBKDF2-SHA256', iteracoes: ITERACOES_DO_PIN, sal: paraBase64(sal), hash: paraBase64(hash) }
}

/**
 * Compara sem parar no primeiro byte diferente: o tempo da resposta não conta
 * quantos bytes acertaram. Tamanhos diferentes percorrem o maior e dão `false`.
 */
export function iguaisEmTempoConstante(a: Uint8Array, b: Uint8Array): boolean {
  const tamanho = Math.max(a.length, b.length)
  let diferenca = a.length ^ b.length
  for (let i = 0; i < tamanho; i += 1) diferenca |= (a[i] ?? 0) ^ (b[i] ?? 0)
  return diferenca === 0
}

export async function pinConfere(pin: string, guardado: PinGuardado): Promise<boolean> {
  const sal = deBase64(guardado.sal)
  const esperado = deBase64(guardado.hash)
  if (sal === null || esperado === null) return false
  return iguaisEmTempoConstante(await derivarPin(pin, sal, guardado.iteracoes), esperado)
}

/**
 * O MESMO custo de conferir um PIN, para o nome que não tem conta: sem isto,
 * a resposta rápida diria "esse nome não existe" a quem mede o tempo.
 */
export async function gastarComoConferir(pin: string): Promise<void> {
  await derivarPin(pin, new Uint8Array(SAL_BYTES), ITERACOES_DO_PIN)
}

/** Segredo novo do aparelho: vai UMA vez ao jogador; aqui só fica o hash. */
export function novoTokenDeAparelho(): string {
  return paraBase64Url(bytesAleatorios(APARELHO_TOKEN_BYTES))
}

export async function hashDoAparelho(token: string): Promise<string> {
  return paraBase64(new Uint8Array(await subtle().digest('SHA-256', new TextEncoder().encode(token))))
}

/** O aparelho cujo hash bate, conferindo TODOS (tempo igual achando ou não); `null` = nenhum. */
export function aparelhoDoHash(arquivo: ArquivoDeContas, hash: string): { conta: ContaDeJogador; aparelho: AparelhoDaConta } | null {
  const alvo = deBase64(hash)
  if (alvo === null) return null
  let achado: { conta: ContaDeJogador; aparelho: AparelhoDaConta } | null = null
  for (const conta of arquivo.contas) {
    for (const aparelho of conta.aparelhos) {
      const guardado = deBase64(aparelho.hash) ?? new Uint8Array(0)
      if (iguaisEmTempoConstante(guardado, alvo) && achado === null) achado = { conta, aparelho }
    }
  }
  return achado
}

export function novoIdDeConta(): string {
  return `conta_${crypto.randomUUID()}`
}

export function novoIdDeAparelho(): string {
  return `ap_${crypto.randomUUID()}`
}

/** O rótulo que o jogador mandou, como a lista do mestre o mostra. */
export function rotuloDoAparelho(bruto: string): string {
  return cleanPlayerName(bruto).slice(0, ROTULO_DO_APARELHO_MAX) || ROTULO_PADRAO
}

// ---------------------------------------------------------------------------
// Mudanças (sempre um arquivo novo: a troca de referência é o que avisa a tela)

export function comContaNova(arquivo: ArquivoDeContas, conta: ContaDeJogador): ArquivoDeContas {
  return { ...arquivo, contas: [...arquivo.contas, conta] }
}

const trocarConta = (arquivo: ArquivoDeContas, contaId: string, mudar: (conta: ContaDeJogador) => ContaDeJogador): ArquivoDeContas =>
  arquivo.contas.some((conta) => conta.id === contaId) ? { ...arquivo, contas: arquivo.contas.map((conta) => (conta.id === contaId ? mudar(conta) : conta)) } : arquivo

/** PIN novo. Os aparelhos lembrados continuam: quem esqueceu o PIN não perde o celular (o mestre os esquece à parte). */
export function comPinTrocado(arquivo: ArquivoDeContas, contaId: string, pin: PinGuardado): ArquivoDeContas {
  return trocarConta(arquivo, contaId, (conta) => ({ ...conta, pin }))
}

export function semConta(arquivo: ArquivoDeContas, contaId: string): ArquivoDeContas {
  const contas = arquivo.contas.filter((conta) => conta.id !== contaId)
  // Sem conta nenhuma, "Só com conta" deixaria a sala fechada para todos.
  return { soComConta: arquivo.soComConta && contas.length > 0, contas }
}

export function semAparelho(arquivo: ArquivoDeContas, contaId: string, aparelhoId: string): ArquivoDeContas {
  return trocarConta(arquivo, contaId, (conta) => ({ ...conta, aparelhos: conta.aparelhos.filter((aparelho) => aparelho.id !== aparelhoId) }))
}

export function comAparelho(arquivo: ArquivoDeContas, contaId: string, aparelho: AparelhoDaConta): ArquivoDeContas {
  return trocarConta(arquivo, contaId, (conta) => {
    const todos = [...conta.aparelhos, aparelho]
    if (todos.length <= MAX_APARELHOS_POR_CONTA) return { ...conta, aparelhos: todos }
    const maisAntigo = todos.reduce((antigo, atual) => (atual.vistoEm < antigo.vistoEm ? atual : antigo))
    return { ...conta, aparelhos: todos.filter((atual) => atual !== maisAntigo) }
  })
}

export function comVistoEm(arquivo: ArquivoDeContas, contaId: string, aparelhoId: string, quando: number): ArquivoDeContas {
  return trocarConta(arquivo, contaId, (conta) => ({
    ...conta,
    aparelhos: conta.aparelhos.map((aparelho) => (aparelho.id === aparelhoId ? { ...aparelho, vistoEm: quando } : aparelho)),
  }))
}

export function comSoComConta(arquivo: ArquivoDeContas, ligado: boolean): ArquivoDeContas {
  // Ligar sem conta nenhuma fecharia a sala para todo mundo.
  return { ...arquivo, soComConta: ligado && arquivo.contas.length > 0 }
}

export function contasNaSala(arquivo: ArquivoDeContas): ContasNaSala {
  return { soComConta: arquivo.soComConta, nomes: arquivo.contas.map((conta) => conta.nome) }
}

// ---------------------------------------------------------------------------
// Disco: leitura tolerante (o que estiver torto sai sozinho) e gravação

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function instante(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= DATA_MAX_MS ? value : 0
}

function base64De(value: unknown, bytes: number): string | null {
  if (typeof value !== 'string') return null
  return deBase64(value)?.length === bytes ? value : null
}

function pinDoArquivo(value: unknown): PinGuardado | null {
  if (!isRecord(value) || value.algoritmo !== 'PBKDF2-SHA256') return null
  const { iteracoes } = value
  if (typeof iteracoes !== 'number' || !Number.isInteger(iteracoes) || iteracoes < ITERACOES_MIN || iteracoes > ITERACOES_MAX) return null
  const sal = base64De(value.sal, SAL_BYTES)
  const hash = base64De(value.hash, HASH_BYTES)
  if (sal === null || hash === null) return null
  return { algoritmo: 'PBKDF2-SHA256', iteracoes, sal, hash }
}

function aparelhoDoArquivo(value: unknown): AparelhoDaConta | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !ID_PADRAO.test(value.id)) return null
  const hash = base64De(value.hash, HASH_BYTES)
  if (hash === null) return null
  const rotulo = typeof value.rotulo === 'string' ? rotuloDoAparelho(value.rotulo) : ROTULO_PADRAO
  return { id: value.id, hash, rotulo, criado: instante(value.criado), vistoEm: instante(value.vistoEm) }
}

function contaDoArquivo(value: unknown): ContaDeJogador | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !ID_PADRAO.test(value.id) || typeof value.nome !== 'string') return null
  const nome = nomeDaContaLimpo(value.nome)
  if (nome.length === 0 || nome.length > NOME_DA_CONTA_MAX) return null
  const pin = pinDoArquivo(value.pin)
  if (pin === null) return null
  const vistos = new Set<string>()
  const aparelhos: AparelhoDaConta[] = []
  for (const bruto of Array.isArray(value.aparelhos) ? value.aparelhos : []) {
    const aparelho = aparelhoDoArquivo(bruto)
    if (aparelho === null || vistos.has(aparelho.id) || aparelhos.length >= MAX_APARELHOS_POR_CONTA) continue
    vistos.add(aparelho.id)
    aparelhos.push(aparelho)
  }
  return { id: value.id, nome, pin, aparelhos, criada: instante(value.criada) }
}

/** `'futuro'` = de uma versão mais nova do app: não é lido NEM regravado por cima. */
export type ContasLidas = ArquivoDeContas | 'futuro' | null

/**
 * O arquivo como veio do disco. Conta sem id, nome ou PIN válido sai; id ou
 * nome repetido (arquivo mexido à mão): a primeira vence. `null` = não é um
 * arquivo de contas.
 */
export function contasDoTexto(texto: string): ContasLidas {
  let value: unknown
  try {
    value = JSON.parse(texto)
  } catch {
    return null
  }
  if (!isRecord(value) || typeof value.formato !== 'number' || !Array.isArray(value.contas)) return null
  if (value.formato > FORMATO_DAS_CONTAS) return 'futuro'
  const ids = new Set<string>()
  const nomes = new Set<string>()
  const contas: ContaDeJogador[] = []
  for (const bruto of value.contas) {
    const conta = contaDoArquivo(bruto)
    if (conta === null || ids.has(conta.id) || nomes.has(chaveDoNome(conta.nome)) || contas.length >= MAX_CONTAS) continue
    ids.add(conta.id)
    nomes.add(chaveDoNome(conta.nome))
    contas.push(conta)
  }
  return comSoComConta({ soComConta: value.soComConta === true, contas }, value.soComConta === true)
}

export function serializarContas(arquivo: ArquivoDeContas): string {
  return `${JSON.stringify({ formato: FORMATO_DAS_CONTAS, soComConta: arquivo.soComConta, contas: arquivo.contas }, null, 2)}\n`
}
