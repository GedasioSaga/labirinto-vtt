/**
 * CUTSCENE EM VÍDEO (14/11/2026): a tela do jogador (e da TV) baixa o vídeo
 * INTEIRO antes de avisar "pronta", para tocar junto com a mesa sem engasgar.
 *
 * - O corpo chega em pedaços; a cada ~16 MiB eles viram um `Blob` e são
 *   soltos: o navegador guarda o blob grande fora da memória da página (no
 *   Chrome, em disco quando passa do teto dele). Um vídeo de 500 MB nunca fica
 *   inteiro em `Uint8Array` aqui.
 * - Queda no meio: tenta de novo do byte onde parou (`Range`, que a sala serve,
 *   `desktop/src-tauri/src/net/server.rs`), até `TENTATIVAS_MAX` vezes.
 * - Página http da LAN não tem Cache API (só contexto seguro): por isso o blob.
 */

/** Pedaços juntados num blob a cada tanto (a memória da página fica nisso). */
const JUNTAR_A_CADA_BYTES = 16 * 1024 * 1024
/** Quedas toleradas na mesma baixa antes de desistir. */
const TENTATIVAS_MAX = 5
const ESPERA_ENTRE_TENTATIVAS_MS = 2000

export interface BaixaDoVideo {
  /** Para a baixa e solta o que já chegou. A URL entregue em `aoTerminar` é de quem a recebeu. */
  cancelar(): void
}

export interface AvisosDaBaixa {
  /** 0 a 99 enquanto chega (100 só com o vídeo inteiro, em `aoTerminar`). */
  aoAndar(pct: number): void
  /** O vídeo inteiro chegou: a URL (`blob:`) para o `<video>`. Quem recebe revoga. */
  aoTerminar(url: string): void
  /** Desistiu de vez (sem rede, 404). */
  aoFalhar(): void
}

function mimeDoVideo(video: string): string {
  return video.endsWith('.webm') ? 'video/webm' : 'video/mp4'
}

/** O total do arquivo: o `Content-Length` do 200, ou o "/total" do `Content-Range` do 206. */
function totalDaResposta(resposta: Response, jaRecebidos: number): number | null {
  const faixa = resposta.headers.get('content-range')
  const total = faixa === null ? null : Number(faixa.split('/')[1])
  if (total !== null && Number.isFinite(total) && total > 0) return total
  const comprimento = Number(resposta.headers.get('content-length'))
  return Number.isFinite(comprimento) && comprimento > 0 ? comprimento + jaRecebidos : null
}

const esperar = (ms: number, sinal: AbortSignal): Promise<void> =>
  new Promise((feito) => {
    const timer = setTimeout(feito, ms)
    sinal.addEventListener('abort', () => {
      clearTimeout(timer)
      feito()
    })
  })

export function baixarVideoDaCutscene(url: string, video: string, avisos: AvisosDaBaixa): BaixaDoVideo {
  const controle = new AbortController()
  const tipo = mimeDoVideo(video)
  const juntados: Blob[] = []
  let soltos: Uint8Array[] = []
  let bytesSoltos = 0
  let recebidos = 0
  let total: number | null = null
  let ultimoPct = -1

  const juntar = (): void => {
    if (soltos.length === 0) return
    juntados.push(new Blob(soltos as BlobPart[], { type: tipo }))
    soltos = []
    bytesSoltos = 0
  }

  const andar = (): void => {
    if (total === null) return
    const pct = Math.min(99, Math.floor((recebidos / total) * 100))
    if (pct === ultimoPct) return
    ultimoPct = pct
    avisos.aoAndar(pct)
  }

  /** Uma ida ao servidor, do byte `recebidos` em diante. `true` = chegou tudo. */
  const umaIda = async (): Promise<boolean> => {
    const cabecalhos: HeadersInit = recebidos > 0 ? { Range: `bytes=${recebidos}-` } : {}
    const resposta = await fetch(url, { headers: cabecalhos, signal: controle.signal, cache: 'no-store' })
    // Retomada que o servidor não aceitou (200 com tudo de novo): recomeça do zero.
    if (recebidos > 0 && resposta.status === 200) {
      juntados.length = 0
      soltos = []
      bytesSoltos = 0
      recebidos = 0
    }
    if (resposta.status !== 200 && resposta.status !== 206) throw new Error(`HTTP ${resposta.status}`)
    total = totalDaResposta(resposta, recebidos) ?? total
    if (resposta.body === null) throw new Error('sem corpo')
    const leitor = resposta.body.getReader()
    for (;;) {
      const { done, value } = await leitor.read()
      if (done) break
      soltos.push(value)
      bytesSoltos += value.byteLength
      recebidos += value.byteLength
      if (bytesSoltos >= JUNTAR_A_CADA_BYTES) juntar()
      andar()
    }
    return total === null || recebidos >= total
  }

  const baixar = async (): Promise<void> => {
    let quedas = 0
    for (;;) {
      if (controle.signal.aborted) return
      try {
        if (await umaIda()) break
      } catch {
        if (controle.signal.aborted) return
      }
      quedas += 1
      if (quedas >= TENTATIVAS_MAX) {
        avisos.aoFalhar()
        return
      }
      await esperar(ESPERA_ENTRE_TENTATIVAS_MS, controle.signal)
    }
    juntar()
    if (controle.signal.aborted) return
    const inteiro = new Blob(juntados, { type: tipo })
    juntados.length = 0
    avisos.aoTerminar(URL.createObjectURL(inteiro))
  }

  void baixar()
  return {
    cancelar: () => {
      controle.abort()
      juntados.length = 0
      soltos = []
    },
  }
}
