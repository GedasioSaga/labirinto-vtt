import { ehRegistro, lerJsonSeguro, proprio } from '../../lib/nuvem/json'
import { RELOGIO_DO_NAVEGADOR, type Relogio } from './fonte'
import type { Buscar } from './fonteReal'

/**
 * A VERSÃO NOVA DO LABIRINTO, vista pelo site (fatia M2, cartão do mural).
 * A publicação (S4, `scripts/publicar-versao.cjs`) carimba cada build do site
 * com `/versao.json` (`versaoDoApp`: o app e o site saem juntos). O site lê o
 * carimbo ao abrir (a versão desta página) e de novo de tempos em tempos;
 * quando o servidor passa a servir uma versão MAIOR, a página aberta é velha:
 * o mural mostra o cartão "Saiu a versão X" com o botão de recarregar.
 *
 * Diferente do `/api/versao` (a versão do FORMATO, que a sessão confere, S4):
 * aqui é só aviso, nada trava.
 */

export const ROTA_DO_CARIMBO = '/versao.json'
/** De quanto em quanto tempo o site pergunta de novo. */
export const INTERVALO_DA_CONFERENCIA_MS = 10 * 60_000

const FORMA_DA_VERSAO = /^\d{1,6}(?:\.\d{1,6}){0,3}$/

export interface VersaoNova {
  /** A versão desta página (a do carimbo quando ela abriu). */
  aberta: string
  /** A que o servidor serve agora. */
  nova: string
}

/** O `versaoDoApp` do carimbo; `null` = fora do formato. */
export function lerCarimbo(bruto: unknown): string | null {
  if (!ehRegistro(bruto)) return null
  const versao = proprio(bruto, 'versaoDoApp')
  return typeof versao === 'string' && FORMA_DA_VERSAO.test(versao) ? versao : null
}

/** Negativo = `a` é mais velha; zero = iguais; positivo = `a` é mais nova (parte por parte, como número). */
export function compararVersoes(a: string, b: string): number {
  const partesA = a.split('.').map(Number)
  const partesB = b.split('.').map(Number)
  for (let i = 0; i < Math.max(partesA.length, partesB.length); i += 1) {
    const diferenca = (partesA[i] ?? 0) - (partesB[i] ?? 0)
    if (diferenca !== 0) return diferenca
  }
  return 0
}

/** O carimbo que o servidor serve agora; `null` = sem rede, sem carimbo (build sem publicação) ou resposta torta. */
export async function buscarCarimbo(origem: string, buscar: Buscar): Promise<string | null> {
  let resposta: Response
  try {
    // `no-store`: depois de uma publicação, uma resposta guardada esconderia justamente a versão nova.
    resposta = await buscar(new URL(ROTA_DO_CARIMBO, origem).toString(), { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } })
  } catch (erro) {
    if (erro instanceof TypeError) return null
    throw erro
  }
  if (!resposta.ok) return null
  try {
    // O Pages devolve o `index.html` para caminho sem arquivo: HTML aqui é "sem carimbo", não erro.
    return lerCarimbo(lerJsonSeguro(await resposta.text()))
  } catch (erro) {
    if (erro instanceof SyntaxError || erro instanceof TypeError) return null
    throw erro
  }
}

export interface OpcoesDaVigia {
  origem: string
  aoAchar(versao: VersaoNova): void
  buscar?: Buscar
  relogio?: Relogio
}

/** Lê o carimbo agora e a cada `INTERVALO_DA_CONFERENCIA_MS`; devolve quem para. */
export function vigiarVersaoDoSite(opcoes: OpcoesDaVigia): () => void {
  const relogio = opcoes.relogio ?? RELOGIO_DO_NAVEGADOR
  const buscar: Buscar = opcoes.buscar ?? ((url, pedido) => fetch(url, pedido))
  let aberta: string | null = null
  let parado = false
  let cancelar: (() => void) | null = null

  function conferir(): void {
    buscarCarimbo(opcoes.origem, buscar)
      .then((atual) => {
        if (parado || atual === null) return
        if (aberta === null) aberta = atual
        else if (compararVersoes(atual, aberta) > 0) opcoes.aoAchar({ aberta, nova: atual })
      })
      .catch((erro: unknown) => {
        // Só aviso: sem ele o site segue igual.
        console.warn('[lobby] a conferência do carimbo falhou', erro)
      })
      .finally(() => {
        if (!parado) cancelar = relogio.depois(INTERVALO_DA_CONFERENCIA_MS, conferir)
      })
  }

  conferir()
  return () => {
    parado = true
    cancelar?.()
  }
}
