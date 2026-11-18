import { guardarMidia, urlDoVideoNoMestre } from './midiaNoDisco'

/**
 * MINIATURA DA CUTSCENE (18/11/2026, pedido do mestre): o quadro de ~1 s do
 * vídeo, em 320x180, gravado como imagem da mídia da mesa (`midia:<sha>.webp`).
 *
 * O vídeo é lido do disco pela ponte de arquivos do Tauri, com um `<video>`
 * fora da página: o elemento pede só os pedaços de que precisa (Range), e não
 * o arquivo inteiro de até 500 MB. `crossOrigin` porque a ponte é outra origem
 * (`asset.localhost`) e responde com a origem da janela: sem ele o canvas
 * ficaria "sujo" e não daria para ler o quadro.
 *
 * Nada aqui lança: o vídeo que não abre, não decodifica ou não deixa ler o
 * quadro devolve `null`, e a linha fica com o ícone no lugar da miniatura.
 */

export const MINIATURA_LARGURA = 320
export const MINIATURA_ALTURA = 180
/** O quadro sai deste segundo; no vídeo curto, de 10% dele. */
const SEGUNDO_DA_MINIATURA = 1
const FRACAO_DO_VIDEO_CURTO = 0.1
/** Qualidade do webp: a miniatura de 320x180 fica em ~10 KB. */
const QUALIDADE_DO_WEBP = 0.8
/** O vídeo que não abre nem salta neste prazo (arquivo sumido, codec que a webview não lê) desiste. */
const PRAZO_DO_VIDEO_MS = 15_000
/** Sem ociosidade (a mesa ocupada o tempo todo), a vez chega mesmo assim depois disto. */
const ESPERA_MAX_DA_OCIOSIDADE_MS = 2_000
/** `HTMLMediaElement.HAVE_CURRENT_DATA`: o quadro de agora já está decodificado. */
const TEM_O_QUADRO = 2

/** O segundo do quadro: 1 s, ou 10% do vídeo mais curto que 10 s; duração desconhecida = 1 s. */
export function segundoDaMiniatura(duracao: number): number {
  if (!Number.isFinite(duracao) || duracao <= 0) return SEGUNDO_DA_MINIATURA
  return Math.min(SEGUNDO_DA_MINIATURA, duracao * FRACAO_DO_VIDEO_CURTO)
}

/**
 * O quadro que o vídeo mostra agora, cortado ao centro para 16:9 (como `object-fit: cover`)
 * e codificado em webp. `null` = o vídeo ainda não tem quadro, ou o canvas ficou
 * "sujo" (a ponte respondeu sem a origem da janela) e não deixa ler.
 */
export async function quadroComoImagem(video: HTMLVideoElement): Promise<Uint8Array | null> {
  const { videoWidth: largura, videoHeight: altura } = video
  if (largura === 0 || altura === 0 || video.readyState < TEM_O_QUADRO) return null
  const canvas = document.createElement('canvas')
  canvas.width = MINIATURA_LARGURA
  canvas.height = MINIATURA_ALTURA
  const contexto = canvas.getContext('2d')
  if (contexto === null) return null
  const escala = Math.max(MINIATURA_LARGURA / largura, MINIATURA_ALTURA / altura)
  const corteL = MINIATURA_LARGURA / escala
  const corteA = MINIATURA_ALTURA / escala
  try {
    contexto.drawImage(video, (largura - corteL) / 2, (altura - corteA) / 2, corteL, corteA, 0, 0, MINIATURA_LARGURA, MINIATURA_ALTURA)
    // `toBlob` lança SecurityError no canvas sujo; a webview que não codifica webp devolve png, que a mídia também aceita.
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', QUALIDADE_DO_WEBP))
    return blob === null ? null : new Uint8Array(await blob.arrayBuffer())
  } catch {
    return null
  }
}

/** Espera um evento do vídeo; o `error` dele, ou o prazo, rejeitam. */
function esperarDoVideo(video: HTMLVideoElement, evento: 'loadedmetadata' | 'seeked' | 'loadeddata', prazoMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const limpar = () => {
      window.clearTimeout(prazo)
      video.removeEventListener(evento, aoChegar)
      video.removeEventListener('error', aoFalhar)
    }
    const aoChegar = () => {
      limpar()
      resolve()
    }
    const aoFalhar = () => {
      limpar()
      reject(new Error('o vídeo não abriu'))
    }
    const prazo = window.setTimeout(aoFalhar, prazoMs)
    video.addEventListener(evento, aoChegar)
    video.addEventListener('error', aoFalhar)
  })
}

/** Os bytes da miniatura do vídeo em `url`; `null` = não deu (o motivo não interessa: a linha fica com o ícone). */
async function bytesDaMiniatura(url: string): Promise<Uint8Array | null> {
  const video = document.createElement('video')
  video.crossOrigin = 'anonymous'
  video.muted = true
  video.playsInline = true
  video.preload = 'metadata'
  try {
    const metadados = esperarDoVideo(video, 'loadedmetadata', PRAZO_DO_VIDEO_MS)
    video.src = url
    await metadados
    const salto = esperarDoVideo(video, 'seeked', PRAZO_DO_VIDEO_MS)
    video.currentTime = segundoDaMiniatura(video.duration)
    await salto
    if (video.readyState < TEM_O_QUADRO) await esperarDoVideo(video, 'loadeddata', PRAZO_DO_VIDEO_MS)
    return await quadroComoImagem(video)
  } catch {
    return null
  } finally {
    // Solta o decodificador e a leitura do arquivo na hora, sem esperar o coletor de lixo.
    video.removeAttribute('src')
    video.load()
  }
}

/** A vez da próxima miniatura: quando a webview fica ociosa, para nunca disputar quadro com o mapa. */
function quandoOcioso(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(() => resolve(), { timeout: ESPERA_MAX_DA_OCIOSIDADE_MS })
    else window.setTimeout(resolve, 0)
  })
}

/** Uma miniatura por vez: 30 vídeos antigos não abrem 30 decodificadores juntos. */
let fila: Promise<unknown> = Promise.resolve()
/** Um pedido por vídeo nesta sessão: o que falhou não tenta de novo a cada mudança da lista. */
const pedidos = new Map<string, Promise<string | null>>()

/**
 * Tira (na fila, um vídeo por vez, quando a webview está ociosa) e guarda a
 * miniatura do vídeo `video` da mídia da mesa; devolve a referência
 * `midia:<id>`, ou `null` quando não deu. Nunca rejeita.
 */
export function pedirMiniaturaDoVideo(video: string): Promise<string | null> {
  const pedido = pedidos.get(video)
  if (pedido !== undefined) return pedido
  const novo = fila.then(quandoOcioso).then(async () => {
    try {
      const url = await urlDoVideoNoMestre(video)
      if (url === null) return null
      const bytes = await bytesDaMiniatura(url)
      return bytes === null ? null : await guardarMidia(bytes)
    } catch {
      // Sem o disco do app (navegador puro), ou a imagem recusada pela mídia: fica o ícone.
      return null
    }
  })
  fila = novo
  pedidos.set(video, novo)
  return novo
}

/** O quadro de agora do vídeo que o mestre está assistindo, gravado como imagem da mídia; `null` = não deu. */
export async function guardarQuadroDoVideo(video: HTMLVideoElement): Promise<string | null> {
  const bytes = await quadroComoImagem(video)
  if (bytes === null) return null
  try {
    return await guardarMidia(bytes)
  } catch {
    return null
  }
}
