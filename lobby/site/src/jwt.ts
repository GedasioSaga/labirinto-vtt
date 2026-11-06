import { ehRegistro, lerJsonSeguro, proprio } from '../../nuvem/src/nucleo'

/**
 * Validação do JWT do Cloudflare Access (`Cf-Access-Jwt-Assertion`), plano §6.2:
 * só RS256, `kid` presente nas certs do time, `iss` exato, `aud` contém o AUD
 * da aplicação, `exp` e (quando vem) `nbf`. Feita à mão com WebCrypto, sem
 * dependência nova: a forma do token está na doc do Access
 * (cloudflare-one/.../authorization-cookie/validating-json).
 */

export type MotivoDaRecusa = 'formato' | 'algoritmo' | 'chave' | 'assinatura' | 'emissor' | 'audiencia' | 'expirado' | 'ainda-nao-vale'

export type ResultadoDoJwt =
  | { ok: true; payload: Readonly<Record<string, unknown>> }
  | { ok: false; motivo: MotivoDaRecusa }

export interface RegrasDoJwt {
  /** `https://<time>.cloudflareaccess.com` (no teste local, `http://127.0.0.1:<porta>`). */
  emissor: string
  aud: string
  /** Segundos desde 1970. */
  agora: number
  chaveDoKid: (kid: string) => Promise<CryptoKey | null>
}

/** As certs do time não responderam direito: o portão responde 503, nunca deixa passar. */
export class AccessIndisponivel extends Error {}

/** O JWT do Access tem ~1–2 KB; o teto só barra lixo antes de decodificar. */
const TAMANHO_MAX_DO_TOKEN = 8192
/** Tolerância para o relógio deste servidor estar um pouco atrás do Access (só no `nbf`). */
const FOLGA_DO_NBF_S = 30
/** O Access usa 64 hex; a forma aceita é mais larga, mas sem nada que vire caminho ou HTML. */
const FORMA_DO_KID = /^[A-Za-z0-9_-]{1,128}$/
const FORMA_DO_BASE64URL = /^[A-Za-z0-9_-]+$/
const ALGORITMO_RS256 = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }

const decodificador = new TextDecoder('utf-8', { fatal: true })
const codificador = new TextEncoder()

function recusa(motivo: MotivoDaRecusa): ResultadoDoJwt {
  return { ok: false, motivo }
}

function bytesDoBase64Url(trecho: string): Uint8Array | null {
  if (!FORMA_DO_BASE64URL.test(trecho)) return null
  const base64 = trecho.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (trecho.length % 4)) % 4)
  let binario: string
  try {
    binario = atob(base64)
  } catch {
    // Comprimento impossível em base64 (resto 1): o mesmo que token torto.
    return null
  }
  const bytes = new Uint8Array(binario.length)
  for (let indice = 0; indice < binario.length; indice += 1) bytes[indice] = binario.charCodeAt(indice)
  return bytes
}

function registroDoTrecho(trecho: string): Readonly<Record<string, unknown>> | null {
  const bytes = bytesDoBase64Url(trecho)
  if (bytes === null) return null
  try {
    const valor = lerJsonSeguro(decodificador.decode(bytes))
    return ehRegistro(valor) ? valor : null
  } catch {
    // UTF-8 ou JSON inválido: token torto.
    return null
  }
}

function audienciaContem(aud: unknown, esperada: string): boolean {
  if (typeof aud === 'string') return aud === esperada
  return Array.isArray(aud) && aud.includes(esperada)
}

function numeroFinito(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor)
}

/** O payload do JWT, se ele passa em todas as regras; senão, o primeiro motivo da recusa. */
export async function validarJwtDoAccess(token: string, regras: RegrasDoJwt): Promise<ResultadoDoJwt> {
  if (token.length > TAMANHO_MAX_DO_TOKEN) return recusa('formato')
  const partes = token.split('.')
  if (partes.length !== 3) return recusa('formato')
  const [trechoDoCabecalho, trechoDoPayload, trechoDaAssinatura] = partes
  const cabecalho = registroDoTrecho(trechoDoCabecalho)
  const payload = registroDoTrecho(trechoDoPayload)
  const assinatura = bytesDoBase64Url(trechoDaAssinatura)
  if (cabecalho === null || payload === null || assinatura === null) return recusa('formato')
  // Só RS256: `none` e HS256 (a chave pública usada como segredo) são os ataques clássicos.
  // `crit` pede regras que este validador não conhece: recusa em vez de ignorar.
  if (proprio(cabecalho, 'alg') !== 'RS256' || proprio(cabecalho, 'crit') !== undefined) return recusa('algoritmo')
  const kid = proprio(cabecalho, 'kid')
  if (typeof kid !== 'string' || !FORMA_DO_KID.test(kid)) return recusa('chave')
  const chave = await regras.chaveDoKid(kid)
  if (chave === null) return recusa('chave')
  const assinado = codificador.encode(`${trechoDoCabecalho}.${trechoDoPayload}`)
  if (!(await crypto.subtle.verify(ALGORITMO_RS256, chave, assinatura, assinado))) return recusa('assinatura')
  if (proprio(payload, 'iss') !== regras.emissor) return recusa('emissor')
  if (!audienciaContem(proprio(payload, 'aud'), regras.aud)) return recusa('audiencia')
  const exp = proprio(payload, 'exp')
  if (!numeroFinito(exp) || regras.agora >= exp) return recusa('expirado')
  const nbf = proprio(payload, 'nbf')
  if (nbf !== undefined && (!numeroFinito(nbf) || regras.agora + FOLGA_DO_NBF_S < nbf)) return recusa('ainda-nao-vale')
  return { ok: true, payload }
}

// ── Certs do time (cache por isolate) ────────────────────────────────────────

/** O Access gira as chaves a cada ~6 semanas e publica a nova antes de usar: 10 min de cache basta. */
const VALIDADE_DAS_CHAVES_MS = 10 * 60 * 1000
/** `kid` desconhecido força nova busca, mas no máximo uma a cada 30 s (token inventado não vira rajada no Access). */
const ESPERA_ENTRE_BUSCAS_MS = 30 * 1000
const TAMANHO_MAX_DAS_CERTS = 64 * 1024

interface ChavesEmCache {
  url: string
  chaves: ReadonlyMap<string, CryptoKey>
  buscadasEm: number
}

let emCache: ChavesEmCache | null = null

async function importarChave(item: unknown): Promise<{ kid: string; chave: CryptoKey } | null> {
  if (!ehRegistro(item)) return null
  const kid = proprio(item, 'kid')
  const n = proprio(item, 'n')
  const e = proprio(item, 'e')
  const alg = proprio(item, 'alg')
  const uso = proprio(item, 'use')
  if (typeof kid !== 'string' || !FORMA_DO_KID.test(kid) || proprio(item, 'kty') !== 'RSA') return null
  if (typeof n !== 'string' || typeof e !== 'string') return null
  if ((alg !== undefined && alg !== 'RS256') || (uso !== undefined && uso !== 'sig')) return null
  try {
    const chave = await crypto.subtle.importKey('jwk', { kty: 'RSA', n, e, alg: 'RS256', ext: true }, ALGORITMO_RS256, false, ['verify'])
    return { kid, chave }
  } catch {
    // Chave que o WebCrypto não aceita fica de fora; as outras do mesmo conjunto continuam valendo.
    return null
  }
}

async function buscarChaves(url: string): Promise<Map<string, CryptoKey>> {
  const resposta = await fetch(url, { headers: { accept: 'application/json' } })
  if (resposta.status !== 200) throw new AccessIndisponivel(`certs do Access: status ${resposta.status}`)
  const texto = await resposta.text()
  if (texto.length > TAMANHO_MAX_DAS_CERTS) throw new AccessIndisponivel('certs do Access: resposta grande demais')
  let corpo: unknown
  try {
    corpo = lerJsonSeguro(texto)
  } catch {
    throw new AccessIndisponivel('certs do Access: JSON inválido')
  }
  const lista = ehRegistro(corpo) ? proprio(corpo, 'keys') : undefined
  if (!Array.isArray(lista)) throw new AccessIndisponivel('certs do Access: sem a lista keys')
  const itens: readonly unknown[] = lista
  const chaves = new Map<string, CryptoKey>()
  for (const importada of await Promise.all(itens.map(importarChave))) {
    if (importada !== null) chaves.set(importada.kid, importada.chave)
  }
  return chaves
}

/** A chave pública do `kid` nas certs do time (`null` = o time não tem esse `kid`). */
export async function chaveDoTime(urlDasCerts: string, kid: string, agoraMs: number): Promise<CryptoKey | null> {
  const atual = emCache !== null && emCache.url === urlDasCerts ? emCache : null
  const conhecida = atual === null ? undefined : atual.chaves.get(kid)
  const idade = atual === null ? Number.POSITIVE_INFINITY : agoraMs - atual.buscadasEm
  if (conhecida !== undefined && idade < VALIDADE_DAS_CHAVES_MS) return conhecida
  if (conhecida === undefined && idade < ESPERA_ENTRE_BUSCAS_MS) return null
  try {
    const chaves = await buscarChaves(urlDasCerts)
    emCache = { url: urlDasCerts, chaves, buscadasEm: agoraMs }
    return chaves.get(kid) ?? null
  } catch (erro) {
    // Access fora do ar: a chave que já era conhecida continua valendo (o Access mantém a anterior publicada).
    if (conhecida !== undefined) return conhecida
    throw erro
  }
}
