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
 *    apaga o registro e a chave;
 *  - `reconferir`, quando a pasta aberta muda (ou é publicada) com a sala no
 *    ar: a sala segue a campanha da pasta de agora, ou sai do Lobby.
 *
 * Quem liga tudo isso ao app é o `App.tsx` (`handleStartRoom`,
 * `handleStopRoom`, o túnel da ponte e a pasta da aventura aberta).
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
 * aceita a forma exata de `urlDaSalaValida` (lobby/nuvem/src/salaAberta.ts):
 * IP de rede local (RFC 1918) com porta de 1 a 65535 e o túnel rápido. O
 * `127.0.0.1` de "sem rede", a porta 0, o octeto acima de 255 e o zero à
 * esquerda ficam de fora AQUI, senão o pedido inteiro seria recusado (400) e
 * o túnel cairia junto.
 */
const FORMA_DA_LAN = /^http:\/\/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3}):(\d{1,5})\/player$/
const FORMA_DO_TUNEL = /^https:\/\/([a-z0-9]+(?:-[a-z0-9]+)+)\.trycloudflare\.com\/player$/
/** Sem zero à esquerda: `010` não é `10` para todo leitor de URL, e o Lobby recusa. */
const FORMA_DO_NUMERO = /^(?:0|[1-9]\d*)$/
const OCTETO_MAX = 255
const PORTA_MAX = 65_535
/** Um rótulo de DNS tem até 63 caracteres: o nome do túnel acima disso o Lobby recusa. */
const ROTULO_MAX = 63

function numeroAte(texto: string, maximo: number): number | null {
  if (!FORMA_DO_NUMERO.test(texto)) return null
  const numero = Number(texto)
  return numero <= maximo ? numero : null
}

function daRedeLocal(url: string): boolean {
  const achado = FORMA_DA_LAN.exec(url)
  if (achado === null) return false
  const [primeiro, segundo, ...resto] = achado.slice(1, 5).map((octeto) => numeroAte(octeto, OCTETO_MAX))
  const porta = numeroAte(achado[5], PORTA_MAX)
  if (primeiro === null || segundo === null || resto.some((octeto) => octeto === null) || porta === null || porta === 0) return false
  return primeiro === 10 || (primeiro === 172 && segundo >= 16 && segundo <= 31) || (primeiro === 192 && segundo === 168)
}

function doTunel(url: string): boolean {
  const achado = FORMA_DO_TUNEL.exec(url)
  return achado !== null && achado[1].length <= ROTULO_MAX
}

/** Os endereços que vão ao Lobby: o túnel primeiro (o corte do teto nunca o leva), depois a rede local, sem repetir. */
export function enderecosDaSala(urlsDaLan: readonly string[], tunel: string | null): EnderecoDaSala[] {
  const enderecos: EnderecoDaSala[] = []
  if (tunel !== null && doTunel(tunel)) enderecos.push({ tipo: 'tunel', url: tunel })
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
  /**
   * A campanha publicada da pasta aberta AGORA (relida a cada `abrir` e
   * `reconferir`); `null` = a pasta não está no Lobby, e nada é publicado.
   * Rejeitar (disco ilegível) conta como `null`.
   */
  campanhaId: () => string | null | Promise<string | null>
  now?: () => number
  /** Chama `fazer` a cada `ms` e devolve como parar. Padrão: `setInterval`. */
  repetir?: (fazer: () => void, ms: number) => () => void
}

export interface SalaNoLobby {
  /** Logo depois do `net_start_room`: publica o código e os endereços da rede local, e começa a batida. A mesma sala de novo não muda nada. */
  abrir(codigo: string, urlsDaLan: readonly string[]): Promise<void>
  /** O link público ficou pronto (`url`, com `/player`) ou caiu (`null`): os endereços mudam já. */
  trocarTunel(url: string | null): Promise<void>
  /**
   * A pasta aberta mudou, ou foi publicada (ou saiu do Lobby) com a sala no ar:
   * a campanha é relida. A mesma, nada muda; outra, a sala sai da de antes e
   * entra nesta (com chave nova); nenhuma, a sala sai do Lobby.
   */
  reconferir(): Promise<void>
  /** No `net_stop_room`: para a batida e tira a sala do Lobby (a chave some junto). */
  fechar(): Promise<void>
  /** Com o que o host confere o bilhete agora; `null` = a sala não está no Lobby. */
  regrasDoBilhete(): RegrasDoBilhete | null
}

/** A sala aberta no app, no Lobby ou não. */
interface SalaDoApp {
  codigo: string
  urlsDaLan: readonly string[]
}

interface SalaAberta {
  campanhaId: string
  /** A sala do app que esta publicação mostra: outra (ou nenhuma) = a publicação já não vale. */
  mesa: SalaDoApp
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

function mesmaSalaDoApp(sala: SalaDoApp, codigo: string, urlsDaLan: readonly string[]): boolean {
  return sala.codigo === codigo && sala.urlsDaLan.length === urlsDaLan.length && sala.urlsDaLan.every((url, i) => url === urlsDaLan[i])
}

export function criarSalaNoLobby(deps: DepsDaSalaNoLobby): SalaNoLobby {
  const now = deps.now ?? Date.now
  const repetir = deps.repetir ?? repetirComIntervalo
  /** A publicação no Lobby agora. */
  let aberta: SalaAberta | null = null
  /** A sala aberta no app; `null` desde o `fechar`, na hora (o bilhete deixa de valer antes de o Lobby saber). */
  let naMesa: SalaDoApp | null = null
  /** O link público de agora: vale também para a sala que ainda vai ao Lobby. */
  let tunel: string | null = null
  /** `abrir`, `reconferir` e `fechar`, um de cada vez e na ordem; nunca rejeita. */
  let passos: Promise<void> = Promise.resolve()

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
    const enderecos = enderecosDaSala(sala.mesa.urlsDaLan, tunel)
    if (enderecos.length === 0) {
      // Sem rede local e sem túnel, o jogador não teria para onde ir: o botão some.
      if (sala.pediuAbrir) await fecharNoLobby(sala)
      sala.pediuAbrir = false
      return
    }
    const corpo: Json = { codigo: sala.mesa.codigo, enderecos: enderecos.map(({ tipo, url }) => ({ tipo, url })) }
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

  /** Para a batida e tira a publicação do Lobby, depois de qualquer pedido dela que ainda estava no ar. */
  const tirarDoLobby = async () => {
    const sala = aberta
    if (sala === null) return
    aberta = null
    sala.pararBatida()
    await sala.fila
    if (sala.pediuAbrir) await fecharNoLobby(sala)
  }

  const campanhaAgora = async (): Promise<string | null> => {
    try {
      return await deps.campanhaId()
    } catch {
      // Lista de campanhas ilegível: a sala segue só pelo código e PIN, como numa pasta fora do Lobby.
      return null
    }
  }

  /** Deixa o Lobby de acordo com a sala do app e a pasta aberta agora. */
  const acompanhar = async () => {
    const mesa = naMesa
    const campanhaId = mesa === null ? null : await campanhaAgora()
    // A sala do app mudou enquanto a campanha era lida: o passo seguinte, já na fila, acerta.
    if (mesa !== naMesa) return
    if (aberta !== null && aberta.mesa === mesa && aberta.campanhaId === campanhaId) return
    await tirarDoLobby()
    if (mesa === null || campanhaId === null || mesa !== naMesa) return
    const sala: SalaAberta = { campanhaId, mesa, publicada: null, pediuAbrir: false, fila: Promise.resolve(), pararBatida: () => undefined }
    aberta = sala
    sala.pararBatida = repetir(() => {
      void enfileirar(sala)
    }, BATIDA_DA_SALA_MS)
    await enfileirar(sala)
  }

  const passo = (): Promise<void> => {
    passos = passos.then(acompanhar)
    return passos
  }

  return {
    abrir(codigo, urlsDaLan) {
      if (naMesa === null || !mesmaSalaDoApp(naMesa, codigo, urlsDaLan)) naMesa = { codigo, urlsDaLan: [...urlsDaLan] }
      return passo()
    },

    async trocarTunel(url) {
      if (tunel === url) return
      tunel = url
      const sala = aberta
      if (sala !== null) await enfileirar(sala)
    },

    reconferir: passo,

    fechar() {
      naMesa = null
      // O Rust derruba o link público junto com a sala.
      tunel = null
      return passo()
    },

    regrasDoBilhete() {
      const sala = aberta
      if (sala === null || sala.publicada === null || sala.mesa !== naMesa) return null
      return { chave: sala.publicada.chave, sala: sala.mesa.codigo, agoraMs: now() + sala.publicada.diferencaMs }
    },
  }
}
