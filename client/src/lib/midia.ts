import { isTokenPhotoData } from './tokenPhoto'

/**
 * MÍDIA DA MESA (entrega 4 dos sistemas de RPG) — a imagem que viaja por
 * REFERÊNCIA, e não embutida em cada mensagem: a do item do acervo e o retrato
 * (e a imagem de cartão) da ficha de personagem. Regras puras; o disco do
 * mestre fica em `lib/midiaNoDisco.ts`.
 *
 * O mestre grava cada imagem UMA vez em `<appData>/midia/<sha256>.<ext>`: o
 * nome é o hash do conteúdo (`idDosBytes`). No dado (ficha, mochila, acervo)
 * a imagem é a referência `midia:<id>`; o jogador a carrega por URL da sala
 * (`/media/<id>`, servida pelo Rust em `desktop/src-tauri/src/net/media.rs`),
 * o mestre pela ponte de arquivos do Tauri. A imagem embutida de antes
 * (`data:image/...`) continua valendo onde já valia: quem lê aceita as duas.
 */

/** Como a referência começa no dado gravado e nas mensagens. */
const PREFIXO_DA_REF = 'midia:'
/** `<64 hex minúsculos>.<ext>` — a MESMA forma que o Rust aceita (`tipo_do_id`). */
const FORMA_DO_ID = /^[0-9a-f]{64}\.(webp|png|jpg|gif)$/

/** Teto de uma imagem gravada: o mesmo do Rust (`MIDIA_MAX_BYTES`). */
export const MIDIA_MAX_BYTES = 2 * 1024 * 1024

/** Os formatos da foto do token (`tokenPhoto.ts`), pela extensão do id. */
export type TipoDeMidia = 'webp' | 'png' | 'jpg' | 'gif'

/** Onde o jogador busca a imagem: a rota da sala que serviu a página dele. */
export const URL_DA_MIDIA_NA_SALA = '/media/'

export function ehIdDeMidia(value: unknown): value is string {
  return typeof value === 'string' && FORMA_DO_ID.test(value)
}

/** `midia:<id>` com id na forma exata — nada de caminho, URL ou texto solto. */
export function ehRefDeMidia(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(PREFIXO_DA_REF) && ehIdDeMidia(value.slice(PREFIXO_DA_REF.length))
}

export function refDoId(id: string): string {
  return `${PREFIXO_DA_REF}${id}`
}

/** O id de uma referência válida; `null` para o resto. */
export function idDaRef(ref: unknown): string | null {
  return ehRefDeMidia(ref) ? ref.slice(PREFIXO_DA_REF.length) : null
}

/** A imagem que a ficha e a mochila aceitam: a referência, ou a embutida de antes. */
export function ehImagemDaMesa(value: unknown): value is string {
  return ehRefDeMidia(value) || isTokenPhotoData(value)
}

/** O tipo pela ASSINATURA dos bytes, não pelo nome — a mesma regra do Rust. */
export function tipoDosBytes(bytes: Uint8Array): TipoDeMidia | null {
  const comeca = (assinatura: readonly number[], desde = 0): boolean => assinatura.every((byte, i) => bytes[desde + i] === byte)
  if (comeca([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png'
  if (comeca([0xff, 0xd8, 0xff])) return 'jpg'
  if (comeca([0x47, 0x49, 0x46, 0x38])) return 'gif'
  // RIFF....WEBP
  if (comeca([0x52, 0x49, 0x46, 0x46]) && comeca([0x57, 0x45, 0x42, 0x50], 8)) return 'webp'
  return null
}

/** SHA-256 em hex minúsculo, como o Rust confere (`hash_hex`). */
export async function hashHex(bytes: Uint8Array): Promise<string> {
  // Cópia num ArrayBuffer próprio: `digest` não aceita a vista sobre um buffer compartilhado.
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice().buffer)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** O id do conteúdo; `null` quando os bytes não são de imagem aceita. */
export async function idDosBytes(bytes: Uint8Array): Promise<string | null> {
  const tipo = tipoDosBytes(bytes)
  return tipo === null ? null : `${await hashHex(bytes)}.${tipo}`
}

/** Os bytes de uma imagem embutida (`data:image/...;base64,...`); `null` para o resto. */
export function bytesDaDataUrl(dataUrl: unknown): Uint8Array | null {
  if (!isTokenPhotoData(dataUrl)) return null
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  try {
    const binario = atob(base64)
    return Uint8Array.from(binario, (letra) => letra.charCodeAt(0))
  } catch {
    return null
  }
}

/** De uma imagem da mesa (referência ou embutida) para o `src` do `<img>`; `null` = sem imagem. */
export type ResolverDeImagem = (valor: string | null | undefined) => string | null

/**
 * O resolvedor de quem busca a mídia em `base` + id: o jogador na sala
 * (`URL_DA_MIDIA_NA_SALA`), o mestre e a janela de teste pela ponte de
 * arquivos (`baseDaMidiaNoMestre`). A embutida passa como veio; o resto
 * (caminho de disco, URL de fora) não vira `src`.
 */
export function resolverComBase(base: string): ResolverDeImagem {
  return (valor) => {
    if (isTokenPhotoData(valor)) return valor
    const id = idDaRef(valor)
    return id === null ? null : `${base}${id}`
  }
}

/** Antes de saber de onde vem a mídia (o mestre ainda perguntando ao Tauri): só a embutida aparece. */
export const resolverSoEmbutida: ResolverDeImagem = (valor) => (isTokenPhotoData(valor) ? valor : null)

/**
 * A base que a janela de teste aceita do mestre: só a da ponte de arquivos do
 * Tauri (`convertFileSrc`), nunca uma URL de fora — a janela de teste não
 * carrega nada que não seja do computador do mestre.
 */
const BASES_LOCAIS = ['http://asset.localhost/', 'https://asset.localhost/', 'asset://localhost/'] as const
const BASE_MAX = 2048

export function ehBaseDeMidiaLocal(value: unknown): value is string {
  return typeof value === 'string' && value.length <= BASE_MAX && BASES_LOCAIS.some((inicio) => value.startsWith(inicio)) && !/[\s"'<>\\]/.test(value)
}
