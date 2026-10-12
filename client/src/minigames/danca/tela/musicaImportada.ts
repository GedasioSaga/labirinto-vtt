import { idDaRefDeAudio, URL_DA_MIDIA_NA_SALA } from '../../../lib/midia'

/**
 * MÚSICA IMPORTADA PELO MESTRE: baixada da sala (`/media/<id>`) assim que o
 * convite chega, decodificada e guardada até o "começar". O "Estou pronto" só
 * libera com ela pronta. As setas não saem daqui: vêm prontas no convite
 * (decodificar o mesmo mp3 em navegadores diferentes daria setas diferentes).
 */

export type EstadoDaMusica =
  | { fase: 'baixando'; fracao: number | null }
  | { fase: 'decodificando' }
  | { fase: 'pronta'; buffer: AudioBuffer }
  | { fase: 'erro'; mensagem: string }

export interface FontesDaMusica {
  buscar: typeof fetch
  /** Decodifica os bytes. O padrão usa um contexto OFFLINE: decodificar não precisa de gesto nem liga o som. */
  decodificar: (bytes: ArrayBuffer) => Promise<AudioBuffer>
  base: string
}

/** Taxa do contexto que decodifica; o contexto de verdade reamostra ao tocar, se for outra. */
const TAXA_DA_DECODIFICACAO = 48000

function decodificarNoNavegador(bytes: ArrayBuffer): Promise<AudioBuffer> {
  const Offline = globalThis.OfflineAudioContext
  if (typeof Offline !== 'function') return Promise.reject(new Error('sem OfflineAudioContext'))
  return new Offline(2, 1, TAXA_DA_DECODIFICACAO).decodeAudioData(bytes)
}

export const FONTES_DO_NAVEGADOR: FontesDaMusica = {
  buscar: (...args) => fetch(...args),
  decodificar: decodificarNoNavegador,
  base: URL_DA_MIDIA_NA_SALA,
}

export class ErroDaMusica extends Error {}

const MENSAGEM_DE_REDE = 'Não deu para baixar a música do mestre. Confira a conexão com a sala e tente de novo.'

/** Lê o corpo contando os bytes; sem `Content-Length` a fração fica `null` (a tela mostra só "baixando"). */
async function lerComProgresso(resposta: Response, aoProgredir: (fracao: number | null) => void): Promise<ArrayBuffer> {
  const total = Number(resposta.headers.get('content-length')) || 0
  const leitor = resposta.body?.getReader()
  if (leitor === undefined) return resposta.arrayBuffer()
  const pedacos: Uint8Array[] = []
  let recebidos = 0
  for (;;) {
    const { done, value } = await leitor.read()
    if (done) break
    pedacos.push(value)
    recebidos += value.byteLength
    aoProgredir(total > 0 ? Math.min(1, recebidos / total) : null)
  }
  const tudo = new Uint8Array(recebidos)
  let pos = 0
  for (const p of pedacos) {
    tudo.set(p, pos)
    pos += p.byteLength
  }
  return tudo.buffer
}

/**
 * Baixa e decodifica a música `midia` (`midia:<sha256>.<ext>`). Lança
 * `ErroDaMusica` com a frase para o jogador; o `AbortError` do `sinal` passa
 * adiante sem frase (a tela saiu ou pediu de novo).
 */
export async function baixarMusica(
  midia: string,
  aoProgredir: (estado: EstadoDaMusica) => void,
  sinal: AbortSignal,
  fontes: FontesDaMusica = FONTES_DO_NAVEGADOR,
): Promise<AudioBuffer> {
  const id = idDaRefDeAudio(midia)
  if (id === null) throw new ErroDaMusica('A música do mestre veio num formato que este aparelho não reconhece.')
  aoProgredir({ fase: 'baixando', fracao: 0 })
  let resposta: Response
  try {
    resposta = await fontes.buscar(`${fontes.base}${id}`, { signal: sinal })
  } catch (erro) {
    if (sinal.aborted) throw erro
    throw new ErroDaMusica(MENSAGEM_DE_REDE)
  }
  if (resposta.status === 404) throw new ErroDaMusica('A música não está mais na sala. Peça ao mestre para importar de novo.')
  if (!resposta.ok) throw new ErroDaMusica(MENSAGEM_DE_REDE)
  let bytes: ArrayBuffer
  try {
    bytes = await lerComProgresso(resposta, (fracao) => aoProgredir({ fase: 'baixando', fracao }))
  } catch (erro) {
    if (sinal.aborted) throw erro
    throw new ErroDaMusica(MENSAGEM_DE_REDE)
  }
  aoProgredir({ fase: 'decodificando' })
  try {
    return await fontes.decodificar(bytes)
  } catch {
    throw new ErroDaMusica('Este navegador não conseguiu abrir a música. Peça ao mestre outra versão do arquivo, ou a faixa demo.')
  }
}
