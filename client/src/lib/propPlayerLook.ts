import { isTokenPhotoData } from './tokenPhoto'

/**
 * OBJETO COM RÓTULO OU IMAGEM — o que o jogador fica sabendo do móvel além da
 * silhueta. Regra única para os três lados que tocam os campos: o arquivo
 * (`lib/mapFile.ts`), o recorte do jogador (`lib/fogFilter.ts`) e a tela dele
 * (`pixi/drawPropLooks.ts`).
 *
 * Módulo puro (sem Pixi, Tauri ou React): a página do jogador importa daqui.
 */

/** Teto do rótulo, em caracteres: é um nome de móvel escrito no mapa, não uma descrição. */
export const PROP_PLAYER_LABEL_MAX = 32

/**
 * Rótulo como o jogador pode recebê-lo: texto, sem espaço sobrando nas pontas
 * nem repetido no meio, cortado no teto. Vazio, só espaço ou o que não é texto
 * (arquivo editado à mão) é "sem rótulo".
 */
export function propPlayerLabel(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const limpo = value.replace(/\s+/g, ' ').trim().slice(0, PROP_PLAYER_LABEL_MAX).trim()
  return limpo === '' ? undefined : limpo
}

/**
 * Imagem como o jogador pode recebê-la: só a cópia auto-contida que cabe no
 * teto da foto da ficha. Caminho do disco do mestre, endereço de rede ou
 * esquema executável não passam (`isTokenPhotoData`).
 */
export function propPlayerImage(value: unknown): string | undefined {
  return isTokenPhotoData(value) ? value : undefined
}
