import type { VideoDoYoutube } from '../biblioteca'

/**
 * A CONVERSA COM O PLAYER DO YOUTUBE por `postMessage` (Sistema 4, fatia F6).
 *
 * Por que não o `iframe_api` oficial: ele é um `<script>` de youtube.com que
 * roda NA ORIGEM DO APP. No mestre (Tauri) isso dá a um script de terceiro o
 * `__TAURI_INTERNALS__.invoke`, com o disco da aventura; no jogador, o
 * `localStorage` e a página inteira. Aqui o player fica isolado no iframe
 * (outra origem, com sandbox) e a página só troca com ele o protocolo que o
 * próprio `iframe_api` usa por baixo (`listening`, `command`, `onReady`,
 * `onStateChange`, `onError`, `infoDelivery`), com a superfície do `YT.Player`
 * oficial (`playVideo`, `seekTo`, `loadVideoById`...): trocar de volta para o
 * oficial é trocar só este arquivo. Risco registrado no plano: o protocolo não
 * é documentado; se o YouTube mudar, quebra aqui (e o teste de medição acusa).
 *
 * Segurança: a mensagem só vale vinda DESTE iframe (`source`) e da origem do
 * player (`origin`); o texto é JSON com teto de tamanho; nada vira HTML. O
 * player só responde à origem passada em `origin=` no endereço.
 */

/** O host do player sem cookies de rastreio até o play. */
export const HOST_DO_PLAYER = 'https://www.youtube-nocookie.com'
/** Os estados do player (`YT.PlayerState`). */
export const ESTADO_DO_YOUTUBE = { naoComecou: -1, terminou: 0, tocando: 1, pausado: 2, carregando: 3, pronto: 5 } as const
/** O `listening` repete até o player responder (ele só conversa depois de ouvir um). */
export const ESCUTA_A_CADA_MS = 250
/** Mensagem maior que isto não é do player (o `infoDelivery` mais gordo fica em poucos KB). */
export const MENSAGEM_DO_PLAYER_MAX = 256 * 1024

export interface CarregamentoDoVideo {
  videoId: VideoDoYoutube
  startSeconds?: number
  endSeconds?: number
}

/** A parte do `YT.Player` oficial que os sons usam. */
export interface PlayerYT {
  playVideo(): void
  pauseVideo(): void
  seekTo(segundos: number, permitirAvancar: boolean): void
  /** De 0 a 100. */
  setVolume(volume: number): void
  loadVideoById(carregamento: CarregamentoDoVideo): void
  /** Em segundos; 0 enquanto o player não contou. */
  getDuration(): number
  destroy(): void
}

export interface EventosDoPlayerYT {
  onReady(): void
  onStateChange(estado: number): void
  onError(codigo: number): void
}

interface MensagemDoPlayer {
  event: string
  info: unknown
}

function ehRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

/** O texto do player como mensagem: JSON em texto, objeto, com `event` em texto. O resto é `null`. */
export function mensagemDoPlayer(data: unknown): MensagemDoPlayer | null {
  if (typeof data !== 'string' || data.length > MENSAGEM_DO_PLAYER_MAX) return null
  let bruto: unknown
  try {
    bruto = JSON.parse(data)
  } catch {
    return null
  }
  if (!ehRegistro(bruto) || typeof bruto.event !== 'string') return null
  return { event: bruto.event, info: bruto.info }
}

let proximoId = 0

/**
 * Liga um `PlayerYT` ao iframe do player (`playerEscondido.ts` o cria com o
 * endereço montado do id conferido). Os comandos dados antes do `onReady`
 * esperam na fila e saem na ordem. `destroy` tira o iframe e os ouvintes.
 */
export function criarPlayerPorMensagens(janela: Window, iframe: HTMLIFrameElement, eventos: EventosDoPlayerYT, host: string = HOST_DO_PLAYER): PlayerYT {
  proximoId += 1
  const id = proximoId
  let ouvido = false
  let pronto = false
  let destruido = false
  let duracaoS = 0
  let ultimoEstado: number | null = null
  const fila: Record<string, unknown>[] = []

  const mandar = (mensagem: Record<string, unknown>): void => {
    // Sem janela (iframe já fora da página) não há a quem mandar; o alvo é SÓ a origem do player.
    iframe.contentWindow?.postMessage(JSON.stringify({ ...mensagem, id, channel: 'widget' }), host)
  }
  const comando = (func: string, args: unknown[] = []): void => {
    if (destruido) return
    const mensagem = { event: 'command', func, args }
    if (pronto) mandar(mensagem)
    else fila.push(mensagem)
  }
  const escutar = (): void => {
    if (!ouvido && !destruido) mandar({ event: 'listening' })
  }
  const mudarEstado = (estado: unknown): void => {
    // O estado chega pelo `onStateChange` e pelo `infoDelivery`: o mesmo valor duas vezes é um aviso só.
    if (typeof estado !== 'number' || estado === ultimoEstado) return
    ultimoEstado = estado
    eventos.onStateChange(estado)
  }

  const aoMensagem = (evento: MessageEvent): void => {
    if (destruido || evento.origin !== host || evento.source !== iframe.contentWindow) return
    const mensagem = mensagemDoPlayer(evento.data)
    if (mensagem === null) return
    ouvido = true
    switch (mensagem.event) {
      case 'onReady':
        if (pronto) return
        pronto = true
        // O player só manda estado e erro a quem pediu.
        mandar({ event: 'command', func: 'addEventListener', args: ['onStateChange'] })
        mandar({ event: 'command', func: 'addEventListener', args: ['onError'] })
        for (const pendente of fila.splice(0)) mandar(pendente)
        eventos.onReady()
        return
      case 'onStateChange':
        mudarEstado(mensagem.info)
        return
      case 'onError':
        if (typeof mensagem.info === 'number') eventos.onError(mensagem.info)
        return
      case 'infoDelivery':
        if (!ehRegistro(mensagem.info)) return
        if (typeof mensagem.info.duration === 'number' && Number.isFinite(mensagem.info.duration) && mensagem.info.duration > 0) duracaoS = mensagem.info.duration
        mudarEstado(mensagem.info.playerState)
        return
      default:
        // `initialDelivery`, `apiInfoDelivery` e o resto: nada que os sons usem.
        return
    }
  }

  janela.addEventListener('message', aoMensagem)
  iframe.addEventListener('load', escutar)
  const repetir = janela.setInterval(() => {
    if (ouvido || destruido) janela.clearInterval(repetir)
    else escutar()
  }, ESCUTA_A_CADA_MS)

  return {
    playVideo: () => comando('playVideo'),
    pauseVideo: () => comando('pauseVideo'),
    seekTo: (segundos, permitirAvancar) => comando('seekTo', [segundos, permitirAvancar]),
    setVolume: (volume) => comando('setVolume', [volume]),
    loadVideoById: (carregamento) => {
      // Vídeo novo: o estado de antes não vale para ele (o ENDED do anterior não pode engolir o do próximo).
      ultimoEstado = null
      comando('loadVideoById', [carregamento])
    },
    getDuration: () => duracaoS,
    destroy: () => {
      if (destruido) return
      destruido = true
      janela.clearInterval(repetir)
      janela.removeEventListener('message', aoMensagem)
      iframe.removeEventListener('load', escutar)
      iframe.remove()
    },
  }
}
