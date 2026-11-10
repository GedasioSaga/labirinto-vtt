import { useSyncExternalStore } from 'react'
import { TIPOS_MOBILIA, type TipoMobilia } from '../lib/mobilia/tipos'

/**
 * "USADOS HÁ POUCO" da ficha da ferramenta Objeto: os últimos móveis que o
 * mestre PÔS no mapa (`porMovelNoPonto`), o mais novo primeiro. Conta o móvel
 * posto, não a escolha: andar pela grade com as setas troca a escolha a cada
 * tecla e encheria a lista de passagem.
 *
 * Fica no localStorage de quem usa (preferência deste computador, como as
 * seções abertas `lb-section:*`), não no mapa. Sem armazenamento, vale
 * enquanto o app está aberto.
 */
export const QUANTOS_USADOS = 6

const CHAVE = 'lb-objeto:usados'
const TIPOS_CONHECIDOS: ReadonlySet<string> = new Set(TIPOS_MOBILIA)

function ehTipoConhecido(valor: unknown): valor is TipoMobilia {
  return typeof valor === 'string' && TIPOS_CONHECIDOS.has(valor)
}

function ler(): readonly TipoMobilia[] {
  try {
    const bruto = window.localStorage.getItem(CHAVE)
    if (bruto === null) return []
    const lido: unknown = JSON.parse(bruto)
    // Tipo que saiu do app (ou lixo na chave) não vira botão.
    return Array.isArray(lido) ? lido.filter(ehTipoConhecido).slice(0, QUANTOS_USADOS) : []
  } catch {
    return []
  }
}

function gravar(lista: readonly TipoMobilia[]): void {
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(lista))
  } catch {
    // Sem armazenamento a lista vale só enquanto o app está aberto.
  }
}

let usados: readonly TipoMobilia[] | null = null
const ouvintes = new Set<() => void>()

function atuais(): readonly TipoMobilia[] {
  if (usados === null) usados = ler()
  return usados
}

/** O móvel que acabou de ir para o mapa sobe para o começo da lista. */
export function lembrarObjetoUsado(tipo: TipoMobilia): void {
  const antes = atuais()
  if (antes[0] === tipo) return
  usados = [tipo, ...antes.filter((t) => t !== tipo)].slice(0, QUANTOS_USADOS)
  gravar(usados)
  for (const ouvir of ouvintes) ouvir()
}

function assinar(ouvir: () => void): () => void {
  ouvintes.add(ouvir)
  return () => ouvintes.delete(ouvir)
}

/** Os últimos móveis postos, o mais novo primeiro (no máximo `QUANTOS_USADOS`). */
export function useObjetosUsados(): readonly TipoMobilia[] {
  return useSyncExternalStore(assinar, atuais, atuais)
}
