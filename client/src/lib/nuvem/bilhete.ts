import { ehRegistro, lerJsonSeguro, proprio } from './json'

/**
 * BILHETE DE ENTRADA NA MESA (pedido de 06/11/2026: "Entrar na mesa agora" no
 * site do Lobby). Quando o mestre abre a sala no app, o Lobby guarda o código
 * dela e uma chave de 32 bytes sorteada a cada abertura; o jogador que clica no
 * botão recebe do Lobby um bilhete assinado com essa chave e o leva à tela do
 * jogador no fragmento `#entrar=`. O host (o app do mestre, que recebeu a
 * mesma chave na resposta de `/sala`) confere e deixa entrar na conta, sem
 * código digitado nem PIN.
 *
 * Forma: `v1.<b64url(payload)>.<b64url(HMAC-SHA256(chave, "v1." + payloadB64))>`,
 * com o payload `{ s: código da sala, c: contaId, n: nome (só para a tela),
 * j: 16 bytes aleatórios, e: vale até, em ms }`.
 *
 * Puro (WebCrypto, sem DOM, sem Tauri): o MESMO módulo assina no Worker do
 * Lobby e confere no app. O que fica fora daqui, com o host: a conta `c` existir
 * em `contas.json` e o `j` não ter sido usado (guardado em memória até vencer).
 */

export const VERSAO_DO_BILHETE = 'v1'
/** Dois minutos: o bastante para a aba abrir e a página do jogador carregar; vazado, vale pouco. */
export const VALIDADE_DO_BILHETE_MS = 120_000
/** Quanto o relógio do Lobby (já corrigido pela diferença guardada no app) pode discordar do host. */
export const FOLGA_DO_RELOGIO_MS = 30_000
export const CHAVE_DA_SALA_BYTES = 32
/** O nome no bilhete é só para "Entrando como Fulano…": o que vale na sala é o da conta no app. */
export const NOME_DO_BILHETE_MAX = 32

const JTI_BYTES = 16
/** 16 bytes em base64url sem `=`. */
const FORMA_DO_JTI = /^[A-Za-z0-9_-]{22}$/
/** O HMAC-SHA256 tem 32 bytes. */
const ASSINATURA_BYTES = 32
/** O bilhete tem ~200 caracteres; o teto só barra lixo antes de decodificar. */
const TAMANHO_MAX_DO_BILHETE = 1024
/** O código da sala é conferido por igualdade com o da sala aberta; a forma só barra o que viraria caminho ou HTML. */
const FORMA_DO_CODIGO = /^[A-Za-z0-9]{1,16}$/
/** A mesma forma do id da conta em `contas.json` (`conta_<uuid>`). */
const FORMA_DO_CONTA_ID = /^[A-Za-z0-9_-]{1,80}$/
const FORMA_DO_BASE64URL = /^[A-Za-z0-9_-]*$/
const ALGORITMO_DA_CHAVE: HmacImportParams = { name: 'HMAC', hash: 'SHA-256' }

export interface DadosDoBilhete {
  sala: string
  contaId: string
  nome: string
  /** Identificador único do bilhete: o host recusa o segundo uso. */
  jti: string
  /** Vale até este instante (ms desde 1970, no relógio do Lobby). */
  validoAte: number
}

/** O que o Lobby pede para assinar; o `jti` e o prazo nascem aqui. */
export interface PedidoDeBilhete {
  sala: string
  contaId: string
  nome: string
}

export interface RegrasDoBilhete {
  /** A chave da sala aberta agora, em base64url (`novaChaveDaSala`). */
  chave: string
  /** O código da sala aberta agora. */
  sala: string
  /** Agora no relógio do Lobby (ms): o app soma ao seu a diferença que guardou da resposta de `/sala`. */
  agoraMs: number
}

/**
 * - `formato`: não tem a forma de um bilhete v1 (ou a assinatura não está no base64url canônico).
 * - `assinatura`: o HMAC não bate: bilhete mexido, ou assinado com a chave de outra abertura.
 * - `outra-sala`: assinado para outro código de sala.
 * - `vencido`: passou do prazo, ou promete valer mais do que um bilhete vale (relógios em desacordo além da folga).
 */
export type MotivoDaRecusa = 'formato' | 'assinatura' | 'outra-sala' | 'vencido'

export type ResultadoDoBilhete = { ok: true; dados: DadosDoBilhete } | { ok: false; motivo: MotivoDaRecusa }

const codificador = new TextEncoder()
const decodificador = new TextDecoder('utf-8', { fatal: true })

function recusa(motivo: MotivoDaRecusa): ResultadoDoBilhete {
  return { ok: false, motivo }
}

function paraBase64Url(bytes: Uint8Array): string {
  let binario = ''
  for (const byte of bytes) binario += String.fromCharCode(byte)
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** `null` = não é base64url canônico: caractere de fora, comprimento impossível, ou bits de sobra no fim. */
function bytesDoBase64Url(trecho: string): Uint8Array | null {
  if (!FORMA_DO_BASE64URL.test(trecho)) return null
  let binario: string
  try {
    binario = atob(trecho.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (trecho.length % 4)) % 4))
  } catch {
    // Resto 1 no comprimento: não existe em base64.
    return null
  }
  const bytes = new Uint8Array(binario.length)
  for (let indice = 0; indice < binario.length; indice += 1) bytes[indice] = binario.charCodeAt(indice)
  // O atob ignora os bits de sobra do último caractere: dois textos dariam os mesmos bytes. Só o canônico vale.
  return paraBase64Url(bytes) === trecho ? bytes : null
}

function bytesAleatorios(quantos: number): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(quantos))
}

/** A chave de uma abertura de sala: 32 bytes aleatórios em base64url sem `=`. Quem sorteia é o Lobby. */
export function novaChaveDaSala(): string {
  return paraBase64Url(bytesAleatorios(CHAVE_DA_SALA_BYTES))
}

/** Para quem recebe a chave de fora (a resposta de `/sala` no app): 32 bytes em base64url canônico. */
export function chaveDaSalaValida(chave: string): boolean {
  const bytes = bytesDoBase64Url(chave)
  return bytes !== null && bytes.length === CHAVE_DA_SALA_BYTES
}

/** Chave fora da forma é erro de programa (quem a recebe de fora confere com `chaveDaSalaValida`), não bilhete ruim: lança `TypeError`. */
async function importarChave(chave: string): Promise<CryptoKey> {
  const bytes = bytesDoBase64Url(chave)
  if (bytes === null || bytes.length !== CHAVE_DA_SALA_BYTES) throw new TypeError(`bilhete: a chave da sala não tem ${CHAVE_DA_SALA_BYTES} bytes em base64url`)
  return globalThis.crypto.subtle.importKey('raw', bytes, ALGORITMO_DA_CHAVE, false, ['sign', 'verify'])
}

function tamanhoDoNome(nome: string): number {
  return Array.from(nome).length
}

function dadosNaForma(dados: DadosDoBilhete): boolean {
  const tamanho = tamanhoDoNome(dados.nome)
  return (
    FORMA_DO_CODIGO.test(dados.sala) &&
    FORMA_DO_CONTA_ID.test(dados.contaId) &&
    dados.nome.trim().length > 0 &&
    tamanho <= NOME_DO_BILHETE_MAX &&
    FORMA_DO_JTI.test(dados.jti) &&
    Number.isSafeInteger(dados.validoAte) &&
    dados.validoAte > 0
  )
}

/** O texto que o HMAC cobre: a versão e o payload COMO VIERAM, sem decodificar e codificar de novo. */
function textoAssinado(trechoDoPayload: string): Uint8Array {
  return codificador.encode(`${VERSAO_DO_BILHETE}.${trechoDoPayload}`)
}

interface PartesDoBilhete {
  trechoDoPayload: string
  assinatura: Uint8Array
}

function partesDoBilhete(bilhete: string): PartesDoBilhete | null {
  if (bilhete.length > TAMANHO_MAX_DO_BILHETE) return null
  const partes = bilhete.split('.')
  if (partes.length !== 3 || partes[0] !== VERSAO_DO_BILHETE) return null
  const [, trechoDoPayload, trechoDaAssinatura] = partes
  const assinatura = bytesDoBase64Url(trechoDaAssinatura)
  if (trechoDoPayload.length === 0 || assinatura === null || assinatura.length !== ASSINATURA_BYTES) return null
  return { trechoDoPayload, assinatura }
}

function dadosDoPayload(trechoDoPayload: string): DadosDoBilhete | null {
  const bytes = bytesDoBase64Url(trechoDoPayload)
  if (bytes === null) return null
  let valor: unknown
  try {
    valor = lerJsonSeguro(decodificador.decode(bytes))
  } catch {
    // UTF-8 ou JSON torto: bilhete torto.
    return null
  }
  if (!ehRegistro(valor)) return null
  const sala = proprio(valor, 's')
  const contaId = proprio(valor, 'c')
  const nome = proprio(valor, 'n')
  const jti = proprio(valor, 'j')
  const validoAte = proprio(valor, 'e')
  if (typeof sala !== 'string' || typeof contaId !== 'string' || typeof nome !== 'string' || typeof jti !== 'string' || typeof validoAte !== 'number') return null
  const dados: DadosDoBilhete = { sala, contaId, nome, jti, validoAte }
  return dadosNaForma(dados) ? dados : null
}

/**
 * Assina um bilhete para a conta entrar na sala, valendo `VALIDADE_DO_BILHETE_MS`
 * a partir de `agoraMs` (o relógio do Lobby). O nome passa aparado e cortado em
 * `NOME_DO_BILHETE_MAX` caracteres. Sala, conta ou nome fora da forma (nome
 * vazio, por exemplo) lançam `TypeError`: quem chama já conferiu o membro e a
 * sala, então é erro de programa.
 */
export async function assinarBilhete(chave: string, pedido: PedidoDeBilhete, agoraMs: number): Promise<string> {
  const dados: DadosDoBilhete = {
    sala: pedido.sala,
    contaId: pedido.contaId,
    nome: Array.from(pedido.nome.trim()).slice(0, NOME_DO_BILHETE_MAX).join(''),
    jti: paraBase64Url(bytesAleatorios(JTI_BYTES)),
    validoAte: agoraMs + VALIDADE_DO_BILHETE_MS,
  }
  if (!dadosNaForma(dados)) throw new TypeError('bilhete: sala, conta, nome ou instante fora da forma')
  const payload = { s: dados.sala, c: dados.contaId, n: dados.nome, j: dados.jti, e: dados.validoAte }
  const trechoDoPayload = paraBase64Url(codificador.encode(JSON.stringify(payload)))
  const assinatura = await globalThis.crypto.subtle.sign('HMAC', await importarChave(chave), textoAssinado(trechoDoPayload))
  return `${VERSAO_DO_BILHETE}.${trechoDoPayload}.${paraBase64Url(new Uint8Array(assinatura))}`
}

/**
 * Confere o bilhete, nesta ordem: forma, HMAC (o `verify` do WebCrypto compara
 * em tempo constante), sala igual à aberta agora e prazo com a folga do
 * relógio. O payload só é lido DEPOIS do HMAC bater. Não confere a conta nem o
 * reuso do `jti`: isso é do host, que tem `contas.json` e a lista dos usados.
 * `agoraMs` que não é número finito lança `TypeError`, como a chave fora da
 * forma: com `NaN` as duas comparações do prazo dariam falso e nenhum bilhete
 * venceria mais (relógio do Lobby que chegou sem o `agora`, por exemplo).
 */
export async function conferirBilhete(bilhete: string, regras: RegrasDoBilhete): Promise<ResultadoDoBilhete> {
  if (!Number.isFinite(regras.agoraMs)) throw new TypeError('bilhete: agoraMs não é um instante (número finito em ms)')
  const partes = partesDoBilhete(bilhete)
  if (partes === null) return recusa('formato')
  const chave = await importarChave(regras.chave)
  if (!(await globalThis.crypto.subtle.verify('HMAC', chave, partes.assinatura, textoAssinado(partes.trechoDoPayload)))) return recusa('assinatura')
  const dados = dadosDoPayload(partes.trechoDoPayload)
  if (dados === null) return recusa('formato')
  if (dados.sala !== regras.sala) return recusa('outra-sala')
  if (regras.agoraMs > dados.validoAte + FOLGA_DO_RELOGIO_MS) return recusa('vencido')
  if (dados.validoAte - regras.agoraMs > VALIDADE_DO_BILHETE_MS + FOLGA_DO_RELOGIO_MS) return recusa('vencido')
  return { ok: true, dados }
}

/**
 * O que o bilhete DIZ, sem conferir nada: só para a tela do jogador mostrar
 * "Entrando como Fulano…" e mandar o `join` com o código e o nome dele. O
 * jogador não tem a chave; quem decide se entra é o host (`conferirBilhete`).
 * `null` = não tem a forma de um bilhete v1.
 */
export function lerBilheteSemConferir(bilhete: string): DadosDoBilhete | null {
  const partes = partesDoBilhete(bilhete)
  return partes === null ? null : dadosDoPayload(partes.trechoDoPayload)
}
