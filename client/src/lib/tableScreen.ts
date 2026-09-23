import { JOIN_CODE_LENGTH, TABLE_KEY_MAX_LENGTH } from '../net/protocol'

/**
 * TELA DA MESA — o endereço da página de espectador é o MESMO do jogador
 * (`/player`), com o código da sala em `?mesa=` e a chave da tela em
 * `?chave=`. A TV abre o link e entra sozinha, sem ninguém digitar código com
 * o controle remoto. A chave só existe neste link (aba Jogo do mestre): o
 * código sozinho, que todo jogador tem, não faz ninguém virar tela.
 */
export const TABLE_SCREEN_PARAM = 'mesa'
export const TABLE_KEY_PARAM = 'chave'

/**
 * Link da tela da mesa a partir de um endereço de jogador. Só `http`/`https`:
 * qualquer outra coisa (texto solto, `javascript:`) não vira link na aba Jogo.
 */
export function tableScreenUrl(playerUrl: string, code: string, tableKey: string): string | null {
  let url: URL
  try {
    url = new URL(playerUrl)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  url.searchParams.set(TABLE_SCREEN_PARAM, code)
  url.searchParams.set(TABLE_KEY_PARAM, tableKey)
  return url.toString()
}

/** A chave da tela no link (`?chave=`); vazio quando o link veio sem ela (a sala recusa com `bad_table_key`). */
export function tableKeyFromSearch(search: string): string {
  return (new URLSearchParams(search).get(TABLE_KEY_PARAM) ?? '').trim().slice(0, TABLE_KEY_MAX_LENGTH)
}

/**
 * A página é a tela da mesa? `null` = não (é a do jogador). Com `?mesa`, o
 * código normalizado como no formulário do jogador (só `A-Z0-9`, no
 * comprimento do código) — vazio quando o link veio sem ele e a tela precisa
 * pedir.
 */
export function tableCodeFromSearch(search: string): string | null {
  const value = new URLSearchParams(search).get(TABLE_SCREEN_PARAM)
  if (value === null) return null
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, JOIN_CODE_LENGTH)
}
