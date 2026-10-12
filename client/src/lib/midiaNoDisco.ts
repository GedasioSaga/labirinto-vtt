import { exists, readFile, writeFile } from '@tauri-apps/plugin-fs'
import { appDataDir, join } from '@tauri-apps/api/path'
import { convertFileSrc } from '@tauri-apps/api/core'
import { ensureDir } from './mapFileIO'
import { bytesDaDataUrl, idDaRef, idDaRefDeAudio, idDoAudio, idDosBytes, MIDIA_AUDIO_MAX_BYTES, MIDIA_MAX_BYTES, refDoId } from './midia'

/**
 * MÍDIA DA MESA no disco do mestre: `<appData>/midia/<sha256>.<ext>`, irmã de
 * `tokens` e `maps`. É GLOBAL DO APP, como o acervo de tokens: a imagem do
 * item serve a todas as aventuras, e o mesmo retrato gravado duas vezes é um
 * arquivo só (o nome é o conteúdo). A pasta é a que a sala serve em
 * `/media/{id}` (`desktop/src-tauri/src/net/media.rs`, `PASTA_DE_MIDIA`).
 */

/** Nome da pasta dentro de `appDataDir()` — o mesmo `PASTA_DE_MIDIA` do Rust. */
export const PASTA_DE_MIDIA = 'midia'

export const MIDIA_NAO_E_IMAGEM = 'essa imagem não é PNG, JPG, WebP nem GIF'
export const MIDIA_GRANDE_DEMAIS = `essa imagem passa de ${MIDIA_MAX_BYTES / (1024 * 1024)} MB depois de reduzida`
export const AUDIO_NAO_E_AUDIO = 'esse áudio não é MP3, OGG, WAV nem M4A'
export const AUDIO_GRANDE_DEMAIS = `esse áudio passa de ${MIDIA_AUDIO_MAX_BYTES / (1024 * 1024)} MB`

export async function pastaDaMidia(): Promise<string> {
  return join(await appDataDir(), PASTA_DE_MIDIA)
}

/**
 * Grava os bytes (se ainda não estão lá) e devolve a referência `midia:<id>`.
 * Lança com a frase pronta quando não é imagem aceita ou passa do teto: o
 * Rust recusaria servir, e a imagem sumiria da tela do jogador sem aviso.
 */
export async function guardarMidia(bytes: Uint8Array): Promise<string> {
  if (bytes.length > MIDIA_MAX_BYTES) throw new Error(MIDIA_GRANDE_DEMAIS)
  const id = await idDosBytes(bytes)
  if (id === null) throw new Error(MIDIA_NAO_E_IMAGEM)
  return gravarNaPasta(id, bytes)
}

/**
 * A música importada do minigame, na mesma pasta: grava (se ainda não está lá)
 * e devolve a referência `midia:<id>.<mp3|ogg|wav|m4a>`. Lança com a frase
 * pronta quando não é áudio aceito ou passa de 15 MB — o Rust recusaria
 * servir, e a música faltaria no aparelho do jogador sem aviso.
 */
export async function guardarAudio(bytes: Uint8Array): Promise<string> {
  if (bytes.length > MIDIA_AUDIO_MAX_BYTES) throw new Error(AUDIO_GRANDE_DEMAIS)
  const id = await idDoAudio(bytes)
  if (id === null) throw new Error(AUDIO_NAO_E_AUDIO)
  return gravarNaPasta(id, bytes)
}

/** A música guardada sumiu da pasta (apagada à mão, ou o mapa veio de outro computador). */
export const AUDIO_GUARDADO_SUMIU = 'a música não está mais guardada neste computador'

/**
 * Os bytes de uma música JÁ guardada, lidos de volta da pasta da mídia: o
 * painel do mestre precisa do áudio para "Conferir com metrônomo" e para
 * refazer as setas depois de reabrir o app, e o pino guarda só a referência.
 * Pelo `plugin-fs` (o escopo `$APPDATA/**` já cobre a pasta), não pela URL
 * da ponte de arquivos: `urlDaMidiaNoMestre` só aceita imagem, de propósito.
 * `null` = não é referência de áudio; lança com a frase pronta quando o
 * arquivo não está lá.
 */
export async function lerAudioGuardado(ref: unknown): Promise<Uint8Array | null> {
  const id = idDaRefDeAudio(ref)
  if (id === null) return null
  const caminho = await join(await pastaDaMidia(), id)
  if (!(await exists(caminho))) throw new Error(AUDIO_GUARDADO_SUMIU)
  return readFile(caminho)
}

async function gravarNaPasta(id: string, bytes: Uint8Array): Promise<string> {
  const pasta = await pastaDaMidia()
  const caminho = await join(pasta, id)
  // Mesmo conteúdo = mesmo nome: o arquivo que já existe é este mesmo.
  if (!(await exists(caminho))) {
    await ensureDir(pasta)
    await writeFile(caminho, bytes)
  }
  return refDoId(id)
}

/** A imagem embutida (`data:image/...`) gravada como mídia; `null` quando não é imagem embutida. */
export async function guardarDataUrl(dataUrl: string): Promise<string | null> {
  const bytes = bytesDaDataUrl(dataUrl)
  return bytes === null ? null : guardarMidia(bytes)
}

/**
 * O começo das URLs da mídia NESTE computador, pela ponte de arquivos do Tauri
 * (`convertFileSrc`): o mestre e a janela da Visão de jogador carregam a
 * imagem do disco, sem sala aberta. `convertFileSrc` codifica o caminho
 * inteiro; o id (hex, ponto e extensão) não muda codificado, então a base é a
 * URL de um arquivo de nome conhecido sem esse nome.
 */
export async function baseDaMidiaNoMestre(): Promise<string> {
  const marca = 'x'
  const url = convertFileSrc(await join(await pastaDaMidia(), marca))
  baseConhecida = url.slice(0, -marca.length)
  return baseConhecida
}

/** A última base calculada; `null` antes da primeira. Para quem precisa dela já (a config da janela de teste). */
let baseConhecida: string | null = null

/**
 * A URL de uma referência de mídia NESTE computador, para quem desenha no
 * canvas do mestre (o item no chão, `pixi/drawProps.ts`). `null` = não é
 * referência de mídia.
 */
export async function urlDaMidiaNoMestre(ref: unknown): Promise<string | null> {
  const id = idDaRef(ref)
  if (id === null) return null
  const base = baseConhecida ?? (await baseDaMidiaNoMestre())
  return `${base}${id}`
}

export function baseDaMidiaConhecida(): string | null {
  return baseConhecida
}
