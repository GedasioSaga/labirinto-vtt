import { encaminhar } from '../../nuvem/src/encaminhar'
import { json } from '../../nuvem/src/http'
import { CABECALHO_DA_IDENTIDADE, emailNormalizado, type IdentidadeDoPortao } from '../../nuvem/src/identidade'
import { proprio } from '../../nuvem/src/nucleo'
import { AccessIndisponivel, chaveDoTime, validarJwtDoAccess } from './jwt'

/**
 * O portão do Lobby (plano §6.2): toda rota `/api/*` do site passa por aqui
 * (`_routes.json`). Valida o JWT do Access, monta a identidade (e-mail da
 * pessoa, ou o do mestre quando é o Service Token do app), confere o `Origin`
 * em POST e no upgrade do WebSocket, limpa os cabeçalhos de fora e repassa ao
 * DO pelo binding (`encaminhar`, lobby/nuvem). O Worker não tem rota pública
 * (§6.3): só chega lá quem passou por aqui.
 */

export interface AmbienteDoPortao {
  /** Ausentes nas prévias do Pages (`[env.preview]` do wrangler.toml): o portão responde 503. */
  CAMPANHA?: Env['CAMPANHA']
  DIRETORIO?: Env['DIRETORIO']
  /** AUD da aplicação do Access (segredo do Pages). */
  ACCESS_AUD?: string
  /** Domínio do time, `<time>.cloudflareaccess.com` (segredo do Pages). */
  ACCESS_TIME?: string
  /** `<Client ID do Service Token>=<e-mail do mestre>`, pares separados por vírgula (segredo do Pages). */
  MAPA_DO_APP?: string
}

// O `wrangler pages dev` compila com `process.env.NODE_ENV` = "development" e o deploy com
// "production": é substituição de texto do esbuild do wrangler na hora de compilar (o
// `process` some do código), não variável do Pages. Mesmo compilado para dev, o modo
// local só vale com o pedido em localhost.
declare const process: { readonly env: { readonly NODE_ENV?: string } }

function compiladoParaDev(): boolean {
  try {
    return process.env.NODE_ENV === 'development'
  } catch {
    // Compilado fora do wrangler, sem a substituição e sem `process` no runtime: nunca é dev.
    return false
  }
}

const COMPILADO_PARA_DEV = compiladoParaDev()
const HOSTS_LOCAIS: ReadonlySet<string> = new Set(['127.0.0.1', 'localhost', '[::1]'])

const FORMA_DO_TIME = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cloudflareaccess\.com$/
/** Só no teste local: as certs vêm do servidor falso do fumaca.mjs, em http. */
const FORMA_DO_TIME_LOCAL = /^(?:127\.0\.0\.1|localhost):\d{2,5}$/
const FORMA_DO_AUD = /^[A-Za-z0-9_.-]{1,256}$/
/** O Client ID do Service Token é `<32 hex>.access`; a forma aceita é mais larga, sem espaço nem `=`. */
const FORMA_DO_CLIENT_ID = /^[A-Za-z0-9._-]{1,128}$/

/** Nada disso chega ao DO: credencial do Access, cookie de sessão e identidade vinda de fora. */
const CABECALHOS_QUE_NAO_PASSAM = [
  CABECALHO_DA_IDENTIDADE,
  'Cf-Access-Jwt-Assertion',
  'Cf-Access-Authenticated-User-Email',
  'Cf-Access-Client-Id',
  'Cf-Access-Client-Secret',
  'Cookie',
]

interface ConfigDoPortao {
  aud: string
  emissor: string
  urlDasCerts: string
  /** `null` = MAPA_DO_APP ausente ou fora do formato: nenhum Service Token entra. */
  mapaDoApp: ReadonlyMap<string, string> | null
}

type Origem = IdentidadeDoPortao['origem']

interface Decisao {
  resposta: Response
  /** Para o log: de onde veio (nunca o e-mail). */
  origem: Origem | null
}

function lerMapaDoApp(texto: string | undefined): ReadonlyMap<string, string> | null {
  if (texto === undefined || texto.trim() === '') return null
  const mapa = new Map<string, string>()
  for (const par of texto.split(',')) {
    const separador = par.indexOf('=')
    if (separador < 0) return null
    const clientId = par.slice(0, separador).trim()
    const email = emailNormalizado(par.slice(separador + 1))
    if (!FORMA_DO_CLIENT_ID.test(clientId) || email === null) return null
    mapa.set(clientId, email)
  }
  return mapa
}

function lerConfig(env: AmbienteDoPortao, url: URL): ConfigDoPortao | null {
  const aud = (env.ACCESS_AUD ?? '').trim()
  // Tolera o domínio colado com https:// e barra no fim; o esquema real sai da forma abaixo.
  const time = (env.ACCESS_TIME ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '')
  if (!FORMA_DO_AUD.test(aud)) return null
  const local = COMPILADO_PARA_DEV && HOSTS_LOCAIS.has(url.hostname)
  let emissor: string
  if (FORMA_DO_TIME.test(time)) emissor = `https://${time}`
  else if (local && FORMA_DO_TIME_LOCAL.test(time)) emissor = `http://${time}`
  else return null
  return { aud, emissor, urlDasCerts: `${emissor}/cdn-cgi/access/certs`, mapaDoApp: lerMapaDoApp(env.MAPA_DO_APP) }
}

type IdentidadeOuRecusa = { ok: true; identidade: IdentidadeDoPortao } | { ok: false; detalhe: string }

/**
 * Pessoa: claim `email`. Service Token: `common_name` (o Client ID) sem `email`,
 * trocado pelo e-mail do mestre no MAPA_DO_APP. Os dois juntos = recusa.
 * Nunca usa `Cf-Access-Authenticated-User-Email` (cabeçalho, não assinado aqui).
 */
function identidadeDoToken(payload: Readonly<Record<string, unknown>>, mapaDoApp: ConfigDoPortao['mapaDoApp']): IdentidadeOuRecusa {
  const email = proprio(payload, 'email')
  const nomeDoServico = proprio(payload, 'common_name')
  if (email !== undefined && nomeDoServico !== undefined) return { ok: false, detalhe: 'email-e-common-name' }
  if (email !== undefined) {
    const normalizado = emailNormalizado(email)
    return normalizado === null ? { ok: false, detalhe: 'email-invalido' } : { ok: true, identidade: { email: normalizado, origem: 'site' } }
  }
  if (typeof nomeDoServico !== 'string') return { ok: false, detalhe: 'sem-identidade' }
  const doMestre = mapaDoApp === null ? undefined : mapaDoApp.get(nomeDoServico)
  return doMestre === undefined ? { ok: false, detalhe: 'service-token-fora-do-mapa' } : { ok: true, identidade: { email: doMestre, origem: 'app' } }
}

/**
 * `Origin` em POST (e qualquer método que muda) e no upgrade do WebSocket: tem de
 * ser este mesmo site. Sem `Origin` só passa o app, que fala pelo Rust e não manda
 * Origin de navegador; navegador sempre manda nesses pedidos.
 */
function origemAceita(request: Request, url: URL, origem: Origem): boolean {
  const muda = request.method !== 'GET' && request.method !== 'HEAD'
  const abreSocket = (request.headers.get('Upgrade') ?? '').toLowerCase() === 'websocket'
  if (!muda && !abreSocket) return true
  const enviada = request.headers.get('Origin')
  if (enviada === null) return origem === 'app'
  return enviada === url.origin
}

function pedidoLimpo(request: Request): Request {
  const cabecalhos = new Headers(request.headers)
  for (const nome of CABECALHOS_QUE_NAO_PASSAM) cabecalhos.delete(nome)
  return new Request(request.url, { method: request.method, headers: cabecalhos, body: request.body })
}

function semAcesso(detalhe: string): Decisao {
  return { resposta: json({ erro: 'sem-acesso', detalhe }, 401), origem: null }
}

async function decidir(request: Request, url: URL, env: AmbienteDoPortao): Promise<Decisao> {
  const config = lerConfig(env, url)
  if (config === null) return { resposta: json({ erro: 'portao-sem-configuracao' }, 503), origem: null }
  if (env.CAMPANHA === undefined || env.DIRETORIO === undefined) return { resposta: json({ erro: 'sem-servidor' }, 503), origem: null }
  const token = request.headers.get('Cf-Access-Jwt-Assertion')
  if (token === null) return semAcesso('sem-token')
  const agoraMs = Date.now()
  let validado
  try {
    validado = await validarJwtDoAccess(token, {
      emissor: config.emissor,
      aud: config.aud,
      agora: Math.floor(agoraMs / 1000),
      chaveDoKid: (kid) => chaveDoTime(config.urlDasCerts, kid, agoraMs),
    })
  } catch (erro) {
    if (erro instanceof AccessIndisponivel) return { resposta: json({ erro: 'access-indisponivel' }, 503), origem: null }
    throw erro
  }
  if (!validado.ok) return semAcesso(validado.motivo)
  const quem = identidadeDoToken(validado.payload, config.mapaDoApp)
  if (!quem.ok) return semAcesso(quem.detalhe)
  const origem = quem.identidade.origem
  if (!origemAceita(request, url, origem)) return { resposta: json({ erro: 'origem-recusada' }, 403), origem }
  const resposta = await encaminhar(pedidoLimpo(request), { CAMPANHA: env.CAMPANHA, DIRETORIO: env.DIRETORIO }, quem.identidade)
  return { resposta, origem }
}

/** Só rota, status e origem: nunca o pedido, os cabeçalhos nem o e-mail (§6.2). */
function registrar(request: Request, url: URL, status: number, origem: Origem | null): void {
  console.log(JSON.stringify({ portao: { rota: `${request.method} ${url.pathname}`, status, origem } }))
}

export async function atenderPeloPortao(request: Request, env: AmbienteDoPortao): Promise<Response> {
  const url = new URL(request.url)
  try {
    const { resposta, origem } = await decidir(request, url, env)
    registrar(request, url, resposta.status, origem)
    return resposta
  } catch (erro) {
    // Só o nome do erro: a mensagem pode trazer pedaço do pedido.
    console.log(JSON.stringify({ portao: { rota: `${request.method} ${url.pathname}`, status: 500, erro: erro instanceof Error ? erro.name : 'desconhecido' } }))
    return json({ erro: 'erro-interno' }, 500)
  }
}
