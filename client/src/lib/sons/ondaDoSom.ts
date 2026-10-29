import { idDaRefDeAudio } from '../midia'
import type { CarregadorDeBytes } from './aoVivo/motor'
import type { FonteDoSom } from './biblioteca'

/**
 * A ONDA E A DURAÇÃO de um som de arquivo, para a faixa do trecho de A até B
 * no lápis da aba Sons. Só do mestre: nada disto vai pela rede nem para o
 * `sons.json`. Lida uma vez por áudio e lembrada (o lápis abre e fecha muitas
 * vezes na mesma mesa).
 *
 *  - Até `ONDA_ATE_BYTES` o arquivo é decodificado num `OfflineAudioContext`
 *    e vira `BARRAS_DA_ONDA` picos de 0 a 1.
 *  - Acima, decodificar 15 MB de MP3 ocuparia centenas de MB por um instante:
 *    só a duração, pelos metadados de um `<audio>`, e a faixa fica lisa.
 *  - YouTube não tem onda nem duração aqui (só o player saberia): `null`.
 */

/** Barras da onda na faixa: o painel tem 262 px, uma barra a cada ~2,5 px. */
export const BARRAS_DA_ONDA = 96
export const ONDA_ATE_BYTES = 3 * 1024 * 1024
/** Os metadados do `<audio>` que não chegam neste tempo viram falha: a faixa some e os campos de tempo ficam. */
const PRAZO_DOS_METADADOS_MS = 8000

export interface OndaDoSom {
  duracaoS: number
  /** `BARRAS_DA_ONDA` picos de 0 a 1; `null` = arquivo grande demais para a onda (só a duração). */
  picos: Float32Array | null
}

const lembradas = new Map<string, Promise<OndaDoSom>>()

/** Picos de 0 a 1 por barra: o maior valor absoluto de qualquer canal no pedaço da barra, normalizado pelo maior de todos. */
export function picosDoAudio(canais: readonly Float32Array[], barras: number = BARRAS_DA_ONDA): Float32Array {
  const picos = new Float32Array(barras)
  const quadros = canais[0]?.length ?? 0
  if (quadros === 0) return picos
  // Amostra salteada: 3 minutos têm 8 milhões de quadros, e 4 mil por barra bastam para achar o pico.
  const passo = Math.max(1, Math.floor(quadros / barras / 4000))
  let maior = 0
  for (let barra = 0; barra < barras; barra++) {
    const de = Math.floor((barra * quadros) / barras)
    const ate = Math.floor(((barra + 1) * quadros) / barras)
    let pico = 0
    for (const canal of canais) {
      for (let i = de; i < ate; i += passo) {
        const valor = Math.abs(canal[i] ?? 0)
        if (valor > pico) pico = valor
      }
    }
    picos[barra] = pico
    if (pico > maior) maior = pico
  }
  if (maior > 0) for (let barra = 0; barra < barras; barra++) picos[barra] = (picos[barra] ?? 0) / maior
  return picos
}

async function ondaDecodificada(bytes: Uint8Array): Promise<OndaDoSom> {
  const ctx = new OfflineAudioContext(1, 1, 44100)
  // `slice`: o decodificador toma posse do ArrayBuffer, e os bytes podem ser do cache do motor.
  const buffer = await ctx.decodeAudioData(bytes.slice().buffer)
  const canais = Array.from({ length: buffer.numberOfChannels }, (_, canal) => buffer.getChannelData(canal))
  return { duracaoS: buffer.duration, picos: picosDoAudio(canais) }
}

function duracaoPelosMetadados(bytes: Uint8Array): Promise<OndaDoSom> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([bytes.slice()]))
    const elemento = new Audio()
    const acabar = (): void => {
      clearTimeout(prazo)
      elemento.removeAttribute('src')
      URL.revokeObjectURL(url)
    }
    const prazo = setTimeout(() => {
      acabar()
      reject(new Error('os metadados do áudio não chegaram'))
    }, PRAZO_DOS_METADADOS_MS)
    elemento.preload = 'metadata'
    elemento.addEventListener('loadedmetadata', () => {
      const duracaoS = elemento.duration
      acabar()
      if (Number.isFinite(duracaoS) && duracaoS > 0) resolve({ duracaoS, picos: null })
      else reject(new Error('o áudio não diz a duração'))
    })
    elemento.addEventListener('error', () => {
      acabar()
      reject(new Error('o áudio não abriu'))
    })
    elemento.src = url
  })
}

/**
 * A onda do som de arquivo, lida pelo `carregar` (o do mestre lê a pasta da
 * aventura); `null` para o YouTube e para a referência torta. Rejeita quando
 * o arquivo não abre: quem chama mostra só os campos de tempo. A falha não
 * fica lembrada (o arquivo pode voltar à pasta).
 */
export function lerOndaDoSom(fonte: FonteDoSom, carregar: CarregadorDeBytes): Promise<OndaDoSom> | null {
  if (fonte.tipo !== 'arquivo') return null
  const id = idDaRefDeAudio(fonte.ref)
  if (id === null) return null
  const lembrada = lembradas.get(id)
  if (lembrada !== undefined) return lembrada
  const lendo = carregar(id).then((bytes) => (bytes.length <= ONDA_ATE_BYTES ? ondaDecodificada(bytes) : duracaoPelosMetadados(bytes)))
  lembradas.set(id, lendo)
  lendo.catch(() => lembradas.delete(id))
  return lendo
}

/** Pré-enche a onda de um áudio (quem já a tem: as provas visuais, fora do app, sem disco). */
export function lembrarOndaDoSom(idDaMidia: string, onda: OndaDoSom): void {
  lembradas.set(idDaMidia, Promise.resolve(onda))
}
