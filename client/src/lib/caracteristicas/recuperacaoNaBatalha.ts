import type { Ajuste } from '../ajusteDaFicha'
import type { ContextoDaFormula } from '../batalha/formula'
import { ajusteDoRecurso, maximoDoRecurso, numeroDoRecurso } from '../batalha/recursosDaBatalha'
import type { ParteDaFicha } from '../batalha/registro'
import type { Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { quantosDaRecuperacao, textoDaRecuperacao } from './recuperacao'
import type { RecursoDaRecuperacao } from './tipos'

/**
 * O "Recupera por turno" das DUAS linhas (27/11/2026) no começo da vez da ficha: um ajuste por linha
 * que recupera, cada um limitado ao máximo do recurso dele, e o texto do registro pelo que a mesa
 * gravou ("Recupera: +10 Vida, +5 SP"). O começo da vez da batalha (`stores/batalha/vez.ts`) lê por
 * aqui; o `ajusteDaRecuperacao` antigo, de uma linha só, saiu.
 *
 * Puro: sem store, sem rede.
 */

/** O ajuste de uma linha: o recurso (para o texto) e o valor novo dele na ficha. */
export interface AjusteDaRecuperacao {
  recurso: RecursoDaRecuperacao
  ajuste: Ajuste
}

/**
 * Os ajustes do começo da vez, Vida antes do SP. `corte` = a regra dos selos na cura (Cura reduzida),
 * só na Vida. Linha cheia, ou recurso que o sistema não tem, fica de fora; vazia = nada a gravar.
 */
export function ajustesDaRecuperacao(personagem: Personagem, sistema: SistemaDeRpg, corte: (cura: number) => number, bonusDaBatalha?: ContextoDaFormula['bonusDaBatalha']): AjusteDaRecuperacao[] {
  const ajustes: AjusteDaRecuperacao[] = []
  for (const lida of quantosDaRecuperacao(personagem, sistema, bonusDaBatalha)) {
    const quanto = lida.recurso === 'hp' ? corte(lida.quanto) : lida.quanto
    const maximo = maximoDoRecurso(personagem, sistema, lida.recurso)
    const cabe = maximo === null ? quanto : Math.min(quanto, maximo - numeroDoRecurso(personagem, sistema, lida.recurso))
    if (cabe <= 0) continue
    const ajuste = ajusteDoRecurso(personagem, sistema, lida.recurso, cabe)
    if (ajuste !== null) ajustes.push({ recurso: lida.recurso, ajuste })
  }
  return ajustes
}

/**
 * "Recupera: +10 Vida, +5 SP" pelo que a mesa gravou (`partes`, o retorno do `mexerNaFicha`): o ganho
 * de cada linha é o que mudou na chave do ajuste dela. Nada mudou = ''.
 */
export function textoDaRecuperacaoGravada(ajustes: readonly AjusteDaRecuperacao[], partes: readonly ParteDaFicha[]): string {
  return textoDaRecuperacao(
    ajustes.map(({ recurso, ajuste }) => ({
      recurso,
      ganho: partes.reduce((soma, parte) => (parte.parte === 'recurso' && parte.chave === ajuste.chave ? soma + parte.para - parte.de : soma), 0),
    })),
  )
}
