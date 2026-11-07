import { ehIdDeMidia } from '../../lib/midia'
import { segmentoValido } from '../../lib/nuvem/caminho'
import { ehRegistro, lerJsonSeguro, proprio } from '../../lib/nuvem/json'
import {
  ErroDoEu,
  RELOGIO_DO_NAVEGADOR,
  type CampanhaDoEu,
  type Canal,
  type Eu,
  type FonteDoLobby,
  type MotivoDoFechamento,
  type OuvinteDoCanal,
  type Relogio,
  type RespostaDaFoto,
  type RespostaDoBilhete,
} from './fonte'
import { lerMensagemDoServidor, lerSalaDaMesa } from './mensagens'

/**
 * A FONTE REAL (§5.4): `GET /api/eu` e o WebSocket `/api/c/:id/ws`, os dois na
 * mesma origem do site (o Access na frente, o portão do Pages repassa ao DO).
 * O socket em si é injetado (`AbrirFio`): no navegador é o `WebSocket`; no
 * teste, um servidor falso que fala o mesmo protocolo.
 */

/** O ping que o DO responde sem acordar (`setWebSocketAutoResponse`, `lobby/nuvem/src/sala.ts`). Texto exato, fora do JSON. */
export const PING = 'ping'
export const PONG = 'pong'
/** De quanto em quanto tempo o site manda o ping. */
export const INTERVALO_DO_PING_MS = 25_000
/** Sem ouvir nada (nem o pong) por este tempo, o canal é dado como caído: proxies às vezes deixam o socket meio-morto. */
export const SILENCIO_MAX_MS = 60_000
/** O servidor fecha com este código quem não está na campanha (`FECHAR_SEM_ACESSO`, `sala.ts`). */
export const CODIGO_SEM_ACESSO = 4004
const CODIGO_NORMAL = 1000

/** O socket cru: texto de ida e volta. */
export interface Fio {
  enviar(texto: string): void
  fechar(): void
}

export interface OuvinteDoFio {
  aoAbrir(): void
  aoReceber(texto: string): void
  aoFechar(codigo: number): void
}

/** Abre o socket. O ouvinte só é chamado depois que esta função volta (como o `WebSocket`): nunca de dentro dela. */
export type AbrirFio = (url: string, ouvinte: OuvinteDoFio) => Fio
export type Buscar = (url: string, pedido: RequestInit) => Promise<Response>

/** O `WebSocket` do navegador. Mensagem binária não faz parte do protocolo: fica de fora. */
export function abrirWebSocket(url: string, ouvinte: OuvinteDoFio): Fio {
  const ws = new WebSocket(url)
  ws.onopen = () => ouvinte.aoAbrir()
  ws.onmessage = (evento: MessageEvent<unknown>) => {
    if (typeof evento.data === 'string') ouvinte.aoReceber(evento.data)
  }
  ws.onclose = (evento) => ouvinte.aoFechar(evento.code)
  return {
    enviar: (texto) => ws.send(texto),
    fechar() {
      ws.onopen = null
      ws.onmessage = null
      ws.onclose = null
      ws.close(CODIGO_NORMAL)
    },
  }
}

export interface OpcoesDaFonteReal {
  /** `location.origin` do site: o `/api` mora na mesma origem. */
  origem: string
  buscar?: Buscar
  abrirFio?: AbrirFio
  relogio?: Relogio
}

function lerCampanhaDoEu(bruto: unknown): CampanhaDoEu | null {
  if (!ehRegistro(bruto)) return null
  const campanhaId = proprio(bruto, 'campanhaId')
  // O Diretório manda o nome em `nome` (lobby/nuvem/src/diretorio.ts); `nomeDaCampanha` fica aceito por compatibilidade.
  const nomeNoFio = proprio(bruto, 'nome')
  const nomeDaCampanha = typeof nomeNoFio === 'string' ? nomeNoFio : proprio(bruto, 'nomeDaCampanha')
  const papel = proprio(bruto, 'papel')
  if (!segmentoValido(campanhaId) || typeof nomeDaCampanha !== 'string' || (papel !== 'mestre' && papel !== 'jogador')) return null
  return { campanhaId, nomeDaCampanha, papel }
}

/** O corpo do `/api/eu`; `null` = fora do formato. */
export function lerEu(bruto: unknown): Eu | null {
  if (!ehRegistro(bruto)) return null
  const email = proprio(bruto, 'email')
  const lista = proprio(bruto, 'campanhas')
  if (typeof email !== 'string' || email.length === 0 || !Array.isArray(lista)) return null
  const brutas: readonly unknown[] = lista
  const campanhas: CampanhaDoEu[] = []
  for (const bruta of brutas) {
    const campanha = lerCampanhaDoEu(bruta)
    if (campanha === null) return null
    campanhas.push(campanha)
  }
  return { email, campanhas }
}

/** `http:` vira `ws:` e `https:` vira `wss:` (o `wrangler pages dev` local é http). */
export function enderecoDoCanal(origem: string, campanhaId: string): string {
  const url = new URL(`/api/c/${encodeURIComponent(campanhaId)}/ws`, origem)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
}

async function buscarEu(origem: string, buscar: Buscar): Promise<Eu> {
  let resposta: Response
  try {
    // `manual`: sem login, o Access redireciona para a tela dele (outra origem); seguir daria erro de CORS em vez de "entre de novo".
    resposta = await buscar(new URL('/api/eu', origem).toString(), { credentials: 'same-origin', redirect: 'manual', headers: { Accept: 'application/json' } })
  } catch (erro) {
    throw new ErroDoEu('rede', erro instanceof Error ? erro.message : 'Sem conexão com o Lobby')
  }
  if (resposta.type === 'opaqueredirect' || resposta.status === 401 || resposta.status === 403) throw new ErroDoEu('sem-login', 'Entre de novo para ver suas mesas')
  if (!resposta.ok) throw new ErroDoEu('servidor', `O Lobby respondeu ${resposta.status}`)
  let corpo: unknown
  try {
    corpo = lerJsonSeguro(await resposta.text())
  } catch (erro) {
    if (!(erro instanceof SyntaxError)) throw erro
    throw new ErroDoEu('formato', 'Resposta do Lobby fora do formato')
  }
  const eu = lerEu(corpo)
  if (eu === null) throw new ErroDoEu('formato', 'Resposta do Lobby fora do formato')
  return eu
}

/** Sem resposta do convite neste tempo, o botão volta e diz que não chegou (a aba em branco fecha). */
export const PRAZO_DO_BILHETE_MS = 15_000

/** O corpo da recusa (`{ erro, detalhe, tentarDepoisDe? }`, lobby/nuvem/src/http.ts) ou do convite. */
function lerCorpoDoBilhete(status: number, corpo: unknown): RespostaDoBilhete {
  const registro: Record<string, unknown> = ehRegistro(corpo) ? corpo : {}
  const erro = proprio(registro, 'erro')
  if (status >= 200 && status < 300) {
    const bilhete = proprio(registro, 'bilhete')
    const sala = lerSalaDaMesa(proprio(registro, 'sala'))
    return typeof bilhete === 'string' && sala !== null ? { ok: true, bilhete, sala } : { ok: false, motivo: 'servidor' }
  }
  switch (status) {
    case 401:
      return { ok: false, motivo: 'sem-login' }
    case 403:
      // O mestre entra pelo app; outro 403 é o Access ou o portão pedindo login de novo, como no `/api/eu`.
      return { ok: false, motivo: erro === 'mestre' ? 'fora-da-mesa' : 'sem-login' }
    case 404:
      return { ok: false, motivo: 'fora-da-mesa' }
    case 409:
      return { ok: false, motivo: erro === 'conta-sem-convite' ? 'sem-convite' : 'sem-sala' }
    case 429: {
      const tentarDepoisDe = proprio(registro, 'tentarDepoisDe')
      return typeof tentarDepoisDe === 'number' && Number.isFinite(tentarDepoisDe) ? { ok: false, motivo: 'ritmo', tentarDepoisDe } : { ok: false, motivo: 'servidor' }
    }
    default:
      return { ok: false, motivo: 'servidor' }
  }
}

/**
 * `POST /api/c/:id/bilhete`, sem corpo: o DO tira a conta do e-mail do Access,
 * nunca do pedido, e o navegador manda o `Origin` que o portão confere.
 * `manual` pelo mesmo motivo do `/api/eu`: sem login, o Access redireciona.
 */
async function pedirBilheteReal(origem: string, campanhaId: string, buscar: Buscar): Promise<RespostaDoBilhete> {
  if (!segmentoValido(campanhaId)) return { ok: false, motivo: 'fora-da-mesa' }
  let resposta: Response
  try {
    resposta = await buscar(new URL(`/api/c/${encodeURIComponent(campanhaId)}/bilhete`, origem).toString(), {
      method: 'POST',
      credentials: 'same-origin',
      redirect: 'manual',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(PRAZO_DO_BILHETE_MS),
    })
  } catch {
    return { ok: false, motivo: 'rede' }
  }
  if (resposta.type === 'opaqueredirect') return { ok: false, motivo: 'sem-login' }
  let corpo: unknown = null
  try {
    corpo = lerJsonSeguro(await resposta.text())
  } catch (erro) {
    // Corpo que não é JSON: decide o status. O resto (a rede caiu no meio do corpo) é "não chegou".
    if (!(erro instanceof SyntaxError)) return { ok: false, motivo: 'rede' }
  }
  return lerCorpoDoBilhete(resposta.status, corpo)
}

/** Sem resposta da foto neste tempo, o diálogo volta e diz que não chegou. */
export const PRAZO_DA_FOTO_MS = 20_000

/** O corpo da troca da foto (`{ foto }`) ou da recusa (`{ erro, detalhe, tentarDepoisDe? }`). */
export function lerCorpoDaFoto(status: number, corpo: unknown): RespostaDaFoto {
  const registro: Record<string, unknown> = ehRegistro(corpo) ? corpo : {}
  const erro = proprio(registro, 'erro')
  if (status >= 200 && status < 300) {
    const foto = proprio(registro, 'foto')
    if (foto === null) return { ok: true, foto: null }
    return ehIdDeMidia(foto) ? { ok: true, foto } : { ok: false, motivo: 'servidor' }
  }
  switch (status) {
    case 401:
    case 403:
      return { ok: false, motivo: 'sem-login' }
    case 404:
      return { ok: false, motivo: 'fora-da-mesa' }
    case 400:
      return { ok: false, motivo: erro === 'foto-tipo' ? 'tipo' : 'servidor' }
    case 413:
      return { ok: false, motivo: erro === 'campanha-cheia' ? 'cheia' : 'grande' }
    case 429: {
      const tentarDepoisDe = proprio(registro, 'tentarDepoisDe')
      return typeof tentarDepoisDe === 'number' && Number.isFinite(tentarDepoisDe) ? { ok: false, motivo: 'ritmo', tentarDepoisDe } : { ok: false, motivo: 'servidor' }
    }
    default:
      return { ok: false, motivo: 'servidor' }
  }
}

/** `PUT` (com a imagem) ou `DELETE` `/api/c/:id/foto`: a conta sai do e-mail do Access, nunca do pedido. */
async function trocarFotoReal(origem: string, campanhaId: string, imagem: Blob | null, buscar: Buscar): Promise<RespostaDaFoto> {
  if (!segmentoValido(campanhaId)) return { ok: false, motivo: 'fora-da-mesa' }
  let resposta: Response
  try {
    resposta = await buscar(new URL(`/api/c/${encodeURIComponent(campanhaId)}/foto`, origem).toString(), {
      method: imagem === null ? 'DELETE' : 'PUT',
      credentials: 'same-origin',
      redirect: 'manual',
      cache: 'no-store',
      headers: imagem === null ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': imagem.type },
      body: imagem,
      signal: AbortSignal.timeout(PRAZO_DA_FOTO_MS),
    })
  } catch {
    return { ok: false, motivo: 'rede' }
  }
  if (resposta.type === 'opaqueredirect') return { ok: false, motivo: 'sem-login' }
  let corpo: unknown = null
  try {
    corpo = lerJsonSeguro(await resposta.text())
  } catch (erro) {
    if (!(erro instanceof SyntaxError)) return { ok: false, motivo: 'rede' }
  }
  return lerCorpoDaFoto(resposta.status, corpo)
}

function abrirCanalReal(url: string, ouvinte: OuvinteDoCanal, abrirFio: AbrirFio, relogio: Relogio): Canal {
  let aberto = false
  let encerrado = false
  let ultimaVida = relogio.agora()
  let pararPing: (() => void) | null = null

  function pararOPing(): void {
    pararPing?.()
    pararPing = null
  }
  /** Fecha o fio por decisão deste lado e avisa a sessão (o `aoFechar` do fio não vem depois do nosso `fechar`). */
  function encerrar(motivo: MotivoDoFechamento): void {
    if (encerrado) return
    encerrado = true
    aberto = false
    pararOPing()
    fio.fechar()
    ouvinte.aoFechar(motivo)
  }
  function agendarPing(): void {
    pararPing = relogio.depois(INTERVALO_DO_PING_MS, () => {
      if (relogio.agora() - ultimaVida > SILENCIO_MAX_MS) {
        encerrar('rede')
        return
      }
      try {
        fio.enviar(PING)
      } catch {
        // O fio já está fechando: o `aoFechar` dele vem logo em seguida.
      }
      agendarPing()
    })
  }

  const fio = abrirFio(url, {
    aoAbrir() {
      if (encerrado) return
      aberto = true
      ultimaVida = relogio.agora()
      agendarPing()
      ouvinte.aoAbrir()
    },
    aoReceber(texto) {
      if (encerrado) return
      ultimaVida = relogio.agora()
      if (texto === PONG) return
      const mensagem = lerMensagemDoServidor(texto)
      // Mensagem torta: perder um pedaço do log faria a ficha divergir calada. Fechar faz a sessão voltar e pedir de novo.
      if (mensagem === null) encerrar('rede')
      else ouvinte.aoReceber(mensagem)
    },
    aoFechar(codigo) {
      if (encerrado) return
      encerrado = true
      aberto = false
      pararOPing()
      ouvinte.aoFechar(codigo === CODIGO_SEM_ACESSO ? 'sem-acesso' : 'rede')
    },
  })

  return {
    enviar(mensagem) {
      if (!aberto) return false
      try {
        fio.enviar(JSON.stringify(mensagem))
        return true
      } catch {
        // Fechando no meio: a mensagem não saiu; a sessão manda de novo quando o canal voltar.
        return false
      }
    },
    fechar() {
      if (encerrado) return
      encerrado = true
      aberto = false
      pararOPing()
      fio.fechar()
    },
  }
}

export function criarFonteReal(opcoes: OpcoesDaFonteReal): FonteDoLobby {
  const buscar: Buscar = opcoes.buscar ?? ((url, pedido) => fetch(url, pedido))
  const abrirFio = opcoes.abrirFio ?? abrirWebSocket
  const relogio = opcoes.relogio ?? RELOGIO_DO_NAVEGADOR
  return {
    demo: false,
    buscarEu: () => buscarEu(opcoes.origem, buscar),
    abrirCanal(campanhaId, ouvinte) {
      if (!segmentoValido(campanhaId)) throw new TypeError(`abrirCanal: campanha inválida (${campanhaId})`)
      return abrirCanalReal(enderecoDoCanal(opcoes.origem, campanhaId), ouvinte, abrirFio, relogio)
    },
    pedirBilhete: (campanhaId) => pedirBilheteReal(opcoes.origem, campanhaId, buscar),
    trocarFoto: (campanhaId, imagem) => trocarFotoReal(opcoes.origem, campanhaId, imagem, buscar),
    enderecoDaFoto: (campanhaId, foto) => (segmentoValido(campanhaId) && ehIdDeMidia(foto) ? `/api/c/${encodeURIComponent(campanhaId)}/midia/${foto}` : null),
  }
}
