import { ehVideoDoYoutube, type VideoDoYoutube } from '../biblioteca'

/**
 * O LINK DO YOUTUBE que o mestre cola na aba Sons (Sistema 4, fatia F6; plano em
 * `docs/planos/sons-ao-vivo-2026-10-23.md`, seção 3). Puro: daqui só sai o id
 * de 11 caracteres, já conferido, e o início em segundos. O endereço do player
 * escondido é montado a partir do id (`playerEscondido.ts`), nunca do texto
 * colado: domínio, caminho e parâmetros do link morrem aqui.
 *
 * Aceita os 8 formatos que o YouTube dá para copiar: `watch?v=`, `youtu.be/`,
 * `shorts/`, `embed/`, `live/`, `music.youtube.com`, `m.youtube.com` e o
 * `youtube-nocookie.com/embed/`, com ou sem `t=`, `list=`, `si=`. Recusa o resto:
 * outro domínio (inclusive o que só termina em youtube.com), id fora da forma,
 * esquema que não é http(s), usuário ou senha no link, porta e texto com HTML.
 */

/** Teto do texto colado: link de verdade cabe com folga; texto enorme nem é olhado. */
export const LINK_DO_YOUTUBE_MAX = 2048
/** Teto do início e do fim em segundos (12 h): a live gravada longa cabe, o número absurdo não. */
export const SEGUNDOS_DO_YOUTUBE_MAX = 12 * 60 * 60

export interface LinkDoYoutube {
  video: VideoDoYoutube
  /** Do `t=` (ou `start=` do embed); ausente = do começo. */
  inicioS?: number
}

/** Hosts aceitos com o id em `watch?v=` ou em `/shorts|embed|live/<id>`. Comparação exata: `youtube.com.golpe.net` não passa. */
const HOSTS_DO_YOUTUBE: ReadonlySet<string> = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'])
/** O link curto: o id é o caminho inteiro. */
const HOST_CURTO = 'youtu.be'
const CAMINHOS_COM_ID: ReadonlySet<string> = new Set(['shorts', 'embed', 'live'])
/** Espaço no meio, aspas, sinais de HTML e barra invertida não são de link colado. */
const CARACTERE_ESTRANHO = /[\s<>"'`\\]/
const TEM_ESQUEMA = /^[a-z][a-z0-9+.-]*:/i
/** `1:30` ou `1:02:03`. */
const TEMPO_DE_RELOGIO = /^(?:(\d{1,2}):)?(\d{1,3}):(\d{2})$/
/** `90`, `90s`, `1m30s`, `1h2m3s`. */
const TEMPO_POR_UNIDADE = /^(?:(\d{1,2})h)?(?:(\d{1,4})m)?(?:(\d{1,6})s?)?$/

function numero(texto: string | undefined): number {
  return texto === undefined ? 0 : Number(texto)
}

/**
 * Segundos de um tempo do YouTube (`90`, `1m30s`, `1:30`, `1:02:03`); `null`
 * para o que não é tempo, o negativo e o que passa de 12 h. Serve ao `t=` do
 * link e aos campos "Começa em" e "Termina em" da aba.
 */
export function segundosDoTempo(bruto: string | null): number | null {
  if (bruto === null) return null
  const texto = bruto.trim().toLowerCase()
  if (texto === '') return null
  let total: number | null = null
  const relogio = TEMPO_DE_RELOGIO.exec(texto)
  if (relogio !== null) {
    const [, horas, minutos, segundos] = relogio
    const temHoras = horas !== undefined
    if (numero(segundos) >= 60 || (temHoras && numero(minutos) >= 60)) return null
    total = numero(horas) * 3600 + numero(minutos) * 60 + numero(segundos)
  } else {
    const unidades = TEMPO_POR_UNIDADE.exec(texto)
    if (unidades !== null) total = numero(unidades[1]) * 3600 + numero(unidades[2]) * 60 + numero(unidades[3])
  }
  return total !== null && Number.isFinite(total) && total <= SEGUNDOS_DO_YOUTUBE_MAX ? total : null
}

/** `90` vira `1:30`; `3723` vira `1:02:03`. */
export function textoDoTempo(segundos: number): string {
  const inteiro = Math.max(0, Math.floor(segundos))
  const horas = Math.floor(inteiro / 3600)
  const minutos = Math.floor((inteiro % 3600) / 60)
  const resto = String(inteiro % 60).padStart(2, '0')
  return horas > 0 ? `${horas}:${String(minutos).padStart(2, '0')}:${resto}` : `${minutos}:${resto}`
}

/** O id do vídeo no caminho e na busca de um link já aberto pelo `URL`; `null` = forma que não é de vídeo. */
function idNoLink(url: URL): string | null {
  // Uma barra no fim (`/shorts/<id>/`) ainda é o mesmo vídeo.
  const partes = url.pathname.replace(/\/$/, '').split('/').slice(1)
  if (url.hostname === HOST_CURTO) return partes.length === 1 ? (partes[0] ?? null) : null
  if (!HOSTS_DO_YOUTUBE.has(url.hostname)) return null
  if (partes.length === 1 && partes[0] === 'watch') return url.searchParams.get('v')
  if (partes.length === 2 && CAMINHOS_COM_ID.has(partes[0] ?? '')) return partes[1] ?? null
  return null
}

/** O link colado como id de vídeo (e início); `null` = não é link de vídeo do YouTube que a aba aceite. */
export function lerLinkDoYoutube(colado: string): LinkDoYoutube | null {
  const texto = colado.trim()
  if (texto === '' || texto.length > LINK_DO_YOUTUBE_MAX || CARACTERE_ESTRANHO.test(texto)) return null
  // Sem esquema (`youtu.be/<id>`), vale https; com esquema, só http e https passam (nada de javascript: nem data:).
  let url: URL
  try {
    url = new URL(TEM_ESQUEMA.test(texto) ? texto : `https://${texto}`)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.username !== '' || url.password !== '' || url.port !== '') return null
  const video = idNoLink(url)
  if (!ehVideoDoYoutube(video)) return null
  const inicioS = segundosDoTempo(url.searchParams.get('t') ?? url.searchParams.get('start'))
  return inicioS === null || inicioS === 0 ? { video } : { video, inicioS }
}
