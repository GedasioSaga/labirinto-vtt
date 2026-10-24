import { ehIdDeAudio, MIDIA_AUDIO_MAX_BYTES } from '../lib/midia'
import { PRAZO_DO_CARREGAMENTO_MS, type CarregadorDeBytes } from '../lib/sons/aoVivo/motor'

/**
 * SONS AO VIVO, fatia F5 (contrato em `docs/planos/sons-f5-plano-tecnico-2026-10-23.md`,
 * seção 3): de onde o jogador e a tela da mesa trazem os bytes do áudio que o
 * motor toca. O servidor da sala serve `/sons/<id>` só à conexão a quem o host
 * liberou aquele id, e a conexão se prova pela chave que recebeu no primeiro
 * frame (`midia.chave`). Qualquer recusa do servidor é o mesmo 404.
 *
 * A URL é montada SÓ do id já conferido (`ehIdDeAudio`), na mesma origem; a
 * chave vai no cabeçalho, nunca na URL nem na mensagem de erro (que pode virar
 * log). 429 (muita gente buscando ao mesmo tempo) ganha UMA nova tentativa,
 * dentro do prazo que o motor dá ao carregamento.
 */

export const CABECALHO_DA_CHAVE_DA_MIDIA = 'X-Labirinto-Chave'
/** Espera antes da nova tentativa quando o 429 não diz quanto (`Retry-After`). */
export const ESPERA_PADRAO_DO_429_MS = 1000
const STATUS_OK = 200
const STATUS_MUITOS_PEDIDOS = 429

/** O `fetch` da página (ou o do teste). */
export type BuscarNaSala = (url: string, init: RequestInit) => Promise<Response>

export interface OpcoesDoCarregadorDaSala {
  /** A chave da conexão de agora (`midia.chave`); `null` = sem chave, e nada sai para a rede. */
  chave: () => string | null
  buscar: BuscarNaSala
  /** Espera entre as tentativas; o teste passa uma que não espera. */
  esperar?: (ms: number) => Promise<void>
  /** Relógio em ms, monotônico. */
  agora?: () => number
}

/**
 * O pedido de um áudio à sala, com a chave no cabeçalho: mesma origem, sem
 * credencial, sem cache e sem seguir redirecionamento. É o mesmo para os sons
 * ao vivo e para a música da dança (F5d), que passam pela mesma rota.
 */
export function pedidoDeAudioNaSala(chave: string, sinal: AbortSignal): RequestInit {
  return {
    method: 'GET',
    headers: { [CABECALHO_DA_CHAVE_DA_MIDIA]: chave },
    cache: 'no-store',
    credentials: 'omit',
    redirect: 'error',
    mode: 'same-origin',
    signal: sinal,
  }
}

/** `Retry-After` em segundos; data HTTP ou lixo viram a espera padrão. */
export function esperaDoRetryAfter(valor: string | null): number {
  if (valor === null || !/^\d+$/.test(valor.trim())) return ESPERA_PADRAO_DO_429_MS
  return Number(valor.trim()) * 1000
}

/** O tipo sem parâmetros e em minúscula: `Audio/MPEG; x=y` vira `audio/mpeg`. */
function tipoDaResposta(resposta: Response): string {
  return (resposta.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase()
}

/** Larga o corpo que não vai ser lido (a conexão volta para o navegador). */
function largarCorpo(resposta: Response): void {
  // Corpo ausente (204, 404 vazio) é caso legítimo: nada a largar.
  resposta.body?.cancel().catch(() => undefined)
}

/** O corpo inteiro, parando de ler logo que passar do teto. */
async function lerComTeto(resposta: Response, teto: number): Promise<Uint8Array> {
  const corpo = resposta.body
  if (corpo === null) throw new Error('a sala mandou o som sem corpo')
  const leitor = corpo.getReader()
  const pedacos: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await leitor.read()
    if (done) break
    total += value.byteLength
    if (total > teto) {
      await leitor.cancel().catch(() => undefined)
      throw new Error('o som da sala passa do teto')
    }
    pedacos.push(value)
  }
  if (total === 0) throw new Error('a sala mandou o som vazio')
  const bytes = new Uint8Array(total)
  let posicao = 0
  for (const pedaco of pedacos) {
    bytes.set(pedaco, posicao)
    posicao += pedaco.byteLength
  }
  return bytes
}

/** Confere a resposta 200 (tipo e tamanho) e lê o corpo. */
async function bytesDaResposta(resposta: Response): Promise<Uint8Array> {
  if (resposta.status !== STATUS_OK) {
    largarCorpo(resposta)
    throw new Error(`a sala não entregou o som (${resposta.status})`)
  }
  if (!tipoDaResposta(resposta).startsWith('audio/')) {
    largarCorpo(resposta)
    throw new Error('a sala mandou algo que não é áudio')
  }
  const declarado = resposta.headers.get('Content-Length')
  if (declarado !== null && Number(declarado) > MIDIA_AUDIO_MAX_BYTES) {
    largarCorpo(resposta)
    throw new Error('o som da sala passa do teto')
  }
  return lerComTeto(resposta, MIDIA_AUDIO_MAX_BYTES)
}

export function criarCarregadorDaSala({
  chave,
  buscar,
  esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  agora = () => performance.now(),
}: OpcoesDoCarregadorDaSala): CarregadorDeBytes {
  /** Um pedido com a chave de AGORA; `null` = sem chave (a conexão caiu), e nada sai. */
  function pedir(id: string, sinal: AbortSignal): Promise<Response> | null {
    const chaveAgora = chave()
    if (chaveAgora === null) return null
    return buscar(`/sons/${id}`, pedidoDeAudioNaSala(chaveAgora, sinal))
  }

  return (id) => {
    // Antes de qualquer espera: id torto ou sem chave não chegam à rede.
    if (!ehIdDeAudio(id)) return Promise.reject(new Error('isso não é um id de áudio'))
    const inicio = agora()
    // O motor desiste em `PRAZO_DO_CARREGAMENTO_MS`; o pedido para junto, sem prender a conexão.
    const cancelar = new AbortController()
    const prazo = setTimeout(() => cancelar.abort(), PRAZO_DO_CARREGAMENTO_MS)
    const primeiro = pedir(id, cancelar.signal)
    if (primeiro === null) {
      clearTimeout(prazo)
      return Promise.reject(new Error('sem a chave da sala'))
    }
    const carregar = async (): Promise<Uint8Array> => {
      const resposta = await primeiro
      if (resposta.status !== STATUS_MUITOS_PEDIDOS) return bytesDaResposta(resposta)
      largarCorpo(resposta)
      const espera = esperaDoRetryAfter(resposta.headers.get('Retry-After'))
      if (agora() - inicio + espera >= PRAZO_DO_CARREGAMENTO_MS) throw new Error('a sala pediu para esperar além do prazo')
      await esperar(espera)
      const segundo = pedir(id, cancelar.signal)
      if (segundo === null) throw new Error('sem a chave da sala')
      // UMA nova tentativa: o segundo 429 cai aqui como qualquer outra recusa.
      return bytesDaResposta(await segundo)
    }
    return carregar().finally(() => clearTimeout(prazo))
  }
}
