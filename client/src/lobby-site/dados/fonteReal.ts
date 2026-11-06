import { segmentoValido } from '../../lib/nuvem/caminho'
import { ehRegistro, lerJsonSeguro, proprio } from '../../lib/nuvem/json'
import { ErroDoEu, RELOGIO_DO_NAVEGADOR, type CampanhaDoEu, type Canal, type Eu, type FonteDoLobby, type MotivoDoFechamento, type OuvinteDoCanal, type Relogio } from './fonte'
import { lerMensagemDoServidor } from './mensagens'

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
  const nomeDaCampanha = proprio(bruto, 'nomeDaCampanha')
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
  }
}
