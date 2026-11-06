import { chaveDaSalaValida, type RegrasDoBilhete } from '../../lib/nuvem/bilhete'
import { ehRegistro, proprio, type Json } from '../../lib/nuvem/json'
import type { PedidoDaR1 } from './comandosDaR1'

/**
 * A SALA ABERTA NO LOBBY (pedido de 06/11/2026, "Entrar na mesa agora", fatia
 * B4): quando o mestre abre a sala no app, o Lobby fica sabendo o código e os
 * endereços da página do jogador, e o site mostra o botão. Pelas rotas da B3
 * (`comandosDaR1.ts`, `abrirSala`/`fecharSala`):
 *
 *  - `abrir`, logo depois do `net_start_room`: `POST /api/c/:id/sala` com
 *    `{ codigo, enderecos }`. Volta `{ chave, agora, expiraEm }`: a chave
 *    (sorteada pelo Lobby a cada abertura) confere os bilhetes, e `agora`, o
 *    relógio do Lobby, dá a diferença para o relógio deste computador;
 *  - a batida, a cada `BATIDA_DA_SALA_MS`: a mesma rota, que renova o prazo
 *    de 10 min do Lobby e troca os endereços (o túnel que ficou pronto ou caiu,
 *    `trocarTunel`), mantendo a chave;
 *  - `fechar`, no `net_stop_room`: `POST /api/c/:id/sala/fechar`; o Lobby
 *    apaga o registro e a chave.
 *
 * Sem internet, com a pasta sem campanha no Lobby ou sem endereço que o
 * Lobby aceite, nada é publicado: o site não mostra o botão, e código, nome e
 * PIN seguem como sempre. Falha do Lobby nunca derruba a sala: a próxima
 * batida tenta de novo. A chave fica só em memória, nunca em disco nem em log.
 */

/** O Lobby dá 10 min de prazo; a batida a cada 4 aguenta uma perdida. */
export const BATIDA_DA_SALA_MS = 4 * 60_000
/** O teto do Worker (`ENDERECOS_MAX`, lobby/nuvem/src/salaAberta.ts): acima disso, o pedido inteiro é recusado. */
export const ENDERECOS_DA_SALA_MAX = 4

export type TipoDoEndereco = 'lan' | 'tunel'

export interface EnderecoDaSala {
  tipo: TipoDoEndereco
  /** Termina em `/player`: o site navega para `<url>#entrar=<bilhete>`. */
  url: string
}

/**
 * O que o Rust dá (`player_urls` e o túnel, `/player` no fim). O Lobby só
 * aceita IP de rede local (RFC 1918) e o túnel rápido: o `127.0.0.1` de "sem
 * rede" fica de fora AQUI, senão o pedido inteiro seria recusado.
 */
const FORMA_DA_LAN = /^http:\/\/(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}:\d{1,5}\/player$/
const FORMA_DO_TUNEL = /^https:\/\/[a-z0-9]+(?:-[a-z0-9]+)+\.trycloudflare\.com\/player$/

function daRedeLocal(url: string): boolean {
  const achado = FORMA_DA_LAN.exec(url)
  if (achado === null) return false
  const primeiro = Number(achado[1])
  const segundo = Number(achado[2])
  return primeiro === 10 || (primeiro === 172 && segundo >= 16 && segundo <= 31) || (primeiro === 192 && segundo === 168)
}

/** Os endereços que vão ao Lobby: o túnel primeiro (o corte do teto nunca o leva), depois a rede local, sem repetir. */
export function enderecosDaSala(urlsDaLan: readonly string[], tunel: string | null): EnderecoDaSala[] {
  const enderecos: EnderecoDaSala[] = []
  if (tunel !== null && FORMA_DO_TUNEL.test(tunel)) enderecos.push({ tipo: 'tunel', url: tunel })
  for (const url of new Set(urlsDaLan)) if (daRedeLocal(url)) enderecos.push({ tipo: 'lan', url })
  return enderecos.slice(0, ENDERECOS_DA_SALA_MAX)
}

interface Publicada {
  chave: string
  /** Relógio do Lobby menos o deste computador, em ms. */
  diferencaMs: number
}

/** `null` = resposta fora do formato (Worker de outra versão): fica valendo a publicação de antes. */
function lerPublicada(corpo: unknown, enviadoEm: number, recebidoEm: number): Publicada | null {
  if (!ehRegistro(corpo)) return null
  const chave = proprio(corpo, 'chave')
  const agora = proprio(corpo, 'agora')
  if (typeof chave !== 'string' || !chaveDaSalaValida(chave) || typeof agora !== 'number' || !Number.isFinite(agora)) return null
  // O Lobby leu o relógio em algum ponto da ida e volta: o meio dela erra no máximo metade do tempo do pedido.
  return { chave, diferencaMs: agora - (enviadoEm + recebidoEm) / 2 }
}

export interface DepsDaSalaNoLobby {
  /** O `pedir` da R1 (`comandosDaR1().pedir`): rejeita com o `Err` dela. */
  pedir: (pedido: PedidoDaR1) => Promise<unknown>
  /** A campanha publicada da pasta aberta; `null` = a pasta não está no Lobby, e nada é publicado. */
  campanhaId: () => string | null
  now?: () => number
  /** Chama `fazer` a cada `ms` e devolve como parar. Padrão: `setInterval`. */
  repetir?: (fazer: () => void, ms: number) => () => void
}

export interface SalaNoLobby {
  /** Logo depois do `net_start_room`: publica o código e os endereços da rede local, e começa a batida. */
  abrir(codigo: string, urlsDaLan: readonly string[]): Promise<void>
  /** O link público ficou pronto (`url`, com `/player`) ou caiu (`null`): os endereços mudam já. */
  trocarTunel(url: string | null): Promise<void>
  /** No `net_stop_room`: para a batida e tira a sala do Lobby (a chave some junto). */
  fechar(): Promise<void>
  /** Com o que o host confere o bilhete agora; `null` = a sala não está no Lobby. */
  regrasDoBilhete(): RegrasDoBilhete | null
}

interface SalaAberta {
  campanhaId: string
  codigo: string
  urlsDaLan: readonly string[]
  tunel: string | null
  publicada: Publicada | null
  /** Algum `abrirSala` saiu: no fim, o `fecharSala` vai (mesmo que a resposta não tenha voltado). */
  pediuAbrir: boolean
  /** Os pedidos desta sala, um de cada vez e na ordem; nunca rejeita. */
  fila: Promise<void>
  pararBatida: () => void
}

const repetirComIntervalo = (fazer: () => void, ms: number): (() => void) => {
  const id = setInterval(fazer, ms)
  return () => clearInterval(id)
}

export function criarSalaNoLobby(deps: DepsDaSalaNoLobby): SalaNoLobby {
  const now = deps.now ?? Date.now
  const repetir = deps.repetir ?? repetirComIntervalo
  let aberta: SalaAberta | null = null

  const pedirSemFalha = async (pedido: PedidoDaR1): Promise<{ ok: true; corpo: unknown } | { ok: false }> => {
    try {
      return { ok: true, corpo: await deps.pedir(pedido) }
    } catch {
      // Sem internet, sem credencial, Lobby fora do ar ou ritmo: a sala segue pelo código e PIN, e a batida tenta de novo.
      return { ok: false }
    }
  }

  const fecharNoLobby = async (sala: SalaAberta) => {
    sala.publicada = null
    // Sem resposta, o Lobby esquece a sala sozinho quando o prazo passa sem batida.
    await pedirSemFalha({ rota: 'fecharSala', campanhaId: sala.campanhaId })
  }

  const publicar = async (sala: SalaAberta) => {
    // Fechou (ou abriu outra) enquanto esperava a vez.
    if (aberta !== sala) return
    const enderecos = enderecosDaSala(sala.urlsDaLan, sala.tunel)
    if (enderecos.length === 0) {
      // Sem rede local e sem túnel, o jogador não teria para onde ir: o botão some.
      if (sala.pediuAbrir) await fecharNoLobby(sala)
      sala.pediuAbrir = false
      return
    }
    const corpo: Json = { codigo: sala.codigo, enderecos: enderecos.map(({ tipo, url }) => ({ tipo, url })) }
    sala.pediuAbrir = true
    const enviadoEm = now()
    const resposta = await pedirSemFalha({ rota: 'abrirSala', campanhaId: sala.campanhaId, corpo })
    if (!resposta.ok || aberta !== sala) return
    const lida = lerPublicada(resposta.corpo, enviadoEm, now())
    if (lida !== null) sala.publicada = lida
  }

  /** Entra na fila da sala: um pedido termina antes de o seguinte sair, e o `fechar` chega depois de todos. */
  const enfileirar = (sala: SalaAberta): Promise<void> => {
    sala.fila = sala.fila.then(() => publicar(sala))
    return sala.fila
  }

  const fechar = async () => {
    const sala = aberta
    if (sala === null) return
    aberta = null
    sala.pararBatida()
    await sala.fila
    if (sala.pediuAbrir) await fecharNoLobby(sala)
  }

  return {
    async abrir(codigo, urlsDaLan) {
      await fechar()
      const campanhaId = deps.campanhaId()
      if (campanhaId === null) return
      const sala: SalaAberta = {
        campanhaId,
        codigo,
        urlsDaLan: [...urlsDaLan],
        tunel: null,
        publicada: null,
        pediuAbrir: false,
        fila: Promise.resolve(),
        pararBatida: () => undefined,
      }
      aberta = sala
      sala.pararBatida = repetir(() => {
        void enfileirar(sala)
      }, BATIDA_DA_SALA_MS)
      await enfileirar(sala)
    },

    async trocarTunel(url) {
      const sala = aberta
      if (sala === null || sala.tunel === url) return
      sala.tunel = url
      await enfileirar(sala)
    },

    fechar,

    regrasDoBilhete() {
      const sala = aberta
      if (sala === null || sala.publicada === null) return null
      return { chave: sala.publicada.chave, sala: sala.codigo, agoraMs: now() + sala.publicada.diferencaMs }
    },
  }
}
