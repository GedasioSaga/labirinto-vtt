import { idDaRefDeAudio, MIDIA_AUDIO_MAX_BYTES } from '../../../lib/midia'
import { esperaDoRetryAfter, pedidoDeAudioNaSala, type BuscarNaSala } from '../../../player/carregadorDeSons'

/**
 * MÚSICA IMPORTADA PELO MESTRE: baixada assim que o convite chega, decodificada
 * e guardada até o "começar". O "Estou pronto" só libera com ela pronta. As
 * setas não saem daqui: vêm prontas no convite (decodificar o mesmo mp3 em
 * navegadores diferentes daria setas diferentes).
 *
 * De onde (SONS F5d, 24/10/2026): na sala, pela MESMA rota dos sons ao vivo,
 * `/sons/<id>` com a chave da conexão (`midia.chave`) no cabeçalho. O servidor
 * só entrega a quem o mestre liberou a música, no `net_send` do convite;
 * `/media/<id>` não serve mais áudio. A Visão de jogador não tem sala: lê da
 * mídia do mestre neste computador (base local), sem chave.
 */

export type EstadoDaMusica =
  | { fase: 'baixando'; fracao: number | null }
  | { fase: 'decodificando' }
  | { fase: 'pronta'; buffer: AudioBuffer }
  | { fase: 'erro'; mensagem: string }

/** A sala (`/sons/<id>` com a chave de agora; `null` = sem chave) ou uma base local (a Visão de jogador). */
export type OrigemDaMusica = { tipo: 'sala'; chave: () => string | null } | { tipo: 'local'; base: string }

export interface FontesDaMusica {
  buscar: BuscarNaSala
  /** Decodifica os bytes. O padrão usa um contexto OFFLINE: decodificar não precisa de gesto nem liga o som. */
  decodificar: (bytes: ArrayBuffer) => Promise<AudioBuffer>
  origem: OrigemDaMusica
  /** Espera antes da nova tentativa do 429; o teste passa uma que não espera. */
  esperar?: (ms: number) => Promise<void>
}

/** Taxa do contexto que decodifica; o contexto de verdade reamostra ao tocar, se for outra. */
const TAXA_DA_DECODIFICACAO = 48000
/** O servidor pede no máximo 10 s (`Retry-After`); pedido maior que isso é a sala ocupada, sem esperar. */
const ESPERA_MAX_DO_429_MS = 10_000
const STATUS_NAO_ACHOU = 404
const STATUS_MUITOS_PEDIDOS = 429

function decodificarNoNavegador(bytes: ArrayBuffer): Promise<AudioBuffer> {
  const Offline = globalThis.OfflineAudioContext
  if (typeof Offline !== 'function') return Promise.reject(new Error('sem OfflineAudioContext'))
  return new Offline(2, 1, TAXA_DA_DECODIFICACAO).decodeAudioData(bytes)
}

const DO_NAVEGADOR: Omit<FontesDaMusica, 'origem'> = {
  buscar: (url, init) => fetch(url, init),
  decodificar: decodificarNoNavegador,
}

/** A sala de verdade: a chave é lida a cada pedido, porque muda a cada socket. */
export function fontesDaSala(chave: () => string | null): FontesDaMusica {
  return { ...DO_NAVEGADOR, origem: { tipo: 'sala', chave } }
}

/** A Visão de jogador: a mídia do mestre neste computador, pela ponte de arquivos. */
export function fontesLocais(base: string): FontesDaMusica {
  return { ...DO_NAVEGADOR, origem: { tipo: 'local', base } }
}

/** Sem conexão para dar a chave (a vitrine, o teste da tela): a música importada falha com a frase dela. */
export const FONTES_SEM_SALA: FontesDaMusica = fontesDaSala(() => null)

export class ErroDaMusica extends Error {}

const MENSAGEM_DE_REDE = 'Não deu para baixar a música do mestre. Confira a conexão com a sala e tente de novo.'
const MENSAGEM_SEM_CHAVE = 'A conexão com a sala ainda não está pronta para trazer a música. Tente de novo em instantes.'
const MENSAGEM_NAO_CHEGOU = 'A música não chegou da sala. Peça ao mestre para chamar para dançar de novo.'
const MENSAGEM_OCUPADA = 'A sala está ocupada mandando outros arquivos. Tente de novo em alguns segundos.'
const MENSAGEM_NAO_E_MUSICA = 'A sala não mandou a música certa. Tente de novo; se repetir, peça ao mestre para importar outra vez.'
const MENSAGEM_GRANDE = 'A música passa do tamanho que a mesa aceita. Peça ao mestre um arquivo menor, ou a faixa demo.'
const MENSAGEM_SUMIU_DO_COMPUTADOR = 'A música não está mais na sala. Peça ao mestre para importar de novo.'

/** Larga o corpo que não vai ser lido (a conexão volta para o navegador). */
function largarCorpo(resposta: Response): void {
  // Corpo ausente (404 vazio) é caso legítimo: nada a largar.
  resposta.body?.cancel().catch(() => undefined)
}

/** Lê o corpo contando os bytes, parando logo que passa do teto; sem `Content-Length` a fração fica `null`. */
async function lerComProgresso(resposta: Response, aoProgredir: (fracao: number | null) => void): Promise<ArrayBuffer> {
  const declarado = Number(resposta.headers.get('content-length')) || 0
  if (declarado > MIDIA_AUDIO_MAX_BYTES) {
    largarCorpo(resposta)
    throw new ErroDaMusica(MENSAGEM_GRANDE)
  }
  const leitor = resposta.body?.getReader()
  if (leitor === undefined) return resposta.arrayBuffer()
  const pedacos: Uint8Array[] = []
  let recebidos = 0
  for (;;) {
    const { done, value } = await leitor.read()
    if (done) break
    recebidos += value.byteLength
    if (recebidos > MIDIA_AUDIO_MAX_BYTES) {
      await leitor.cancel().catch(() => undefined)
      throw new ErroDaMusica(MENSAGEM_GRANDE)
    }
    pedacos.push(value)
    aoProgredir(declarado > 0 ? Math.min(1, recebidos / declarado) : null)
  }
  const tudo = new Uint8Array(recebidos)
  let pos = 0
  for (const p of pedacos) {
    tudo.set(p, pos)
    pos += p.byteLength
  }
  return tudo.buffer
}

/** Um pedido; a rede que cai vira a frase de rede, e o cancelamento passa adiante sem frase. */
async function pedir(fontes: FontesDaMusica, url: string, init: RequestInit, sinal: AbortSignal): Promise<Response> {
  try {
    return await fontes.buscar(url, init)
  } catch (erro) {
    if (sinal.aborted) throw erro
    throw new ErroDaMusica(MENSAGEM_DE_REDE)
  }
}

function esperarNoRelogio(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * A resposta da sala, já conferida: 200 com tipo de áudio. Qualquer recusa do
 * servidor é o mesmo 404 (não liberada a esta conexão, fora da pasta da
 * aventura, chave velha). O 429 ganha UMA nova tentativa, com a chave de agora.
 */
async function respostaDaSala(id: string, chave: () => string | null, fontes: FontesDaMusica, sinal: AbortSignal): Promise<Response> {
  const tentar = (): Promise<Response> => {
    const agora = chave()
    if (agora === null) throw new ErroDaMusica(MENSAGEM_SEM_CHAVE)
    return pedir(fontes, `/sons/${id}`, pedidoDeAudioNaSala(agora, sinal), sinal)
  }
  let resposta = await tentar()
  if (resposta.status === STATUS_MUITOS_PEDIDOS) {
    largarCorpo(resposta)
    const espera = esperaDoRetryAfter(resposta.headers.get('Retry-After'))
    if (espera > ESPERA_MAX_DO_429_MS) throw new ErroDaMusica(MENSAGEM_OCUPADA)
    await (fontes.esperar ?? esperarNoRelogio)(espera)
    sinal.throwIfAborted()
    resposta = await tentar()
    if (resposta.status === STATUS_MUITOS_PEDIDOS) {
      largarCorpo(resposta)
      throw new ErroDaMusica(MENSAGEM_OCUPADA)
    }
  }
  if (resposta.status === STATUS_NAO_ACHOU) {
    largarCorpo(resposta)
    throw new ErroDaMusica(MENSAGEM_NAO_CHEGOU)
  }
  if (!resposta.ok) {
    largarCorpo(resposta)
    throw new ErroDaMusica(MENSAGEM_DE_REDE)
  }
  const tipo = (resposta.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase()
  if (!tipo.startsWith('audio/')) {
    largarCorpo(resposta)
    throw new ErroDaMusica(MENSAGEM_NAO_E_MUSICA)
  }
  return resposta
}

/** A resposta da mídia do mestre neste computador (Visão de jogador): a ponte de arquivos não diz o tipo. */
async function respostaLocal(id: string, base: string, fontes: FontesDaMusica, sinal: AbortSignal): Promise<Response> {
  const resposta = await pedir(fontes, `${base}${id}`, { signal: sinal }, sinal)
  if (resposta.status === STATUS_NAO_ACHOU) throw new ErroDaMusica(MENSAGEM_SUMIU_DO_COMPUTADOR)
  if (!resposta.ok) throw new ErroDaMusica(MENSAGEM_DE_REDE)
  return resposta
}

/**
 * Baixa e decodifica a música `midia` (`midia:<sha256>.<ext>`). Lança
 * `ErroDaMusica` com a frase para o jogador (sem chave nem caminho); o
 * `AbortError` do `sinal` passa adiante sem frase (a tela saiu ou pediu de novo).
 */
export async function baixarMusica(
  midia: string,
  aoProgredir: (estado: EstadoDaMusica) => void,
  sinal: AbortSignal,
  fontes: FontesDaMusica = FONTES_SEM_SALA,
): Promise<AudioBuffer> {
  const id = idDaRefDeAudio(midia)
  if (id === null) throw new ErroDaMusica('A música do mestre veio num formato que este aparelho não reconhece.')
  aoProgredir({ fase: 'baixando', fracao: 0 })
  const { origem } = fontes
  const resposta = origem.tipo === 'sala' ? await respostaDaSala(id, origem.chave, fontes, sinal) : await respostaLocal(id, origem.base, fontes, sinal)
  let bytes: ArrayBuffer
  try {
    bytes = await lerComProgresso(resposta, (fracao) => aoProgredir({ fase: 'baixando', fracao }))
  } catch (erro) {
    if (sinal.aborted || erro instanceof ErroDaMusica) throw erro
    throw new ErroDaMusica(MENSAGEM_DE_REDE)
  }
  aoProgredir({ fase: 'decodificando' })
  try {
    return await fontes.decodificar(bytes)
  } catch {
    throw new ErroDaMusica('Este navegador não conseguiu abrir a música. Peça ao mestre outra versão do arquivo, ou a faixa demo.')
  }
}
