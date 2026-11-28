import { quantidadeDe } from '../lib/items'
import { ehRecusa, mochilaComArmaPadrao, mochilaComPenteAjustado, mochilaDesfeita, recarregarForaDaBatalha, type AcervoDaMochila } from '../lib/mochila/armaNaMochila'
import { useToastStore } from '../stores/toastStore'
import type { CarriedItem } from '../types/map'

/**
 * O PENTE PELA MÃO DO MESTRE, fora da batalha: o Recarregar (da mochila, na hora, sem gastar ação) e o
 * ajuste à mão (correção de mesa, sem mexer na mochila). Os dois lugares que mostram o pente usam daqui:
 * a grade da mochila (`MochilaDoMestre`) e o cartão da arma equipada (`EquipamentoDaFicha`). Toda
 * mudança grava com o Desfazer no aviso, que volta só as vagas que ela mexeu, sobre a mochila de AGORA.
 */

const SAIU_DA_MOCHILA = 'O item já não está na mochila.'

/** Onde a mochila do mestre grava: a ficha (já migrada) ou o boneco dono. */
export interface MochilaQueGrava {
  /** "Aira": quem carrega, para os avisos. */
  dono: string
  /** Grava a mochila inteira nova. `false` = não gravou (o aviso de quem recusou já saiu). */
  gravar: (mochila: CarriedItem[]) => boolean
  /** A mochila de agora, lida na hora (o Desfazer vem depois, e outra mudança pode ter entrado no meio). */
  mochilaDeAgora: () => readonly CarriedItem[]
}

/** Grava `nova` com o Desfazer que volta só as vagas que mudaram de `antes` para ela. `false` = não gravou. */
export function gravarComDesfazerDasVagas(mochila: MochilaQueGrava, antes: readonly CarriedItem[], nova: CarriedItem[], frase: string): boolean {
  if (!mochila.gravar(nova)) return false
  useToastStore.getState().push('info', frase, undefined, {
    actions: [{ label: 'Desfazer', run: () => void mochila.gravar(mochilaDesfeita(mochila.mochilaDeAgora(), antes, nova)) }],
  })
  return true
}

/**
 * RECARREGAR FORA DA BATALHA a arma `armaVagaId` com a pilha `balaVagaId` (`recarregarForaDaBatalha`),
 * com o aviso "pente 2 → 6" e o Desfazer. Devolve o motivo de não ter recarregado, ou `null` (gravou,
 * ou quem grava recusou e já avisou).
 */
export function recarregarPeloMestre(mochila: MochilaQueGrava, acervo: AcervoDaMochila, armaVagaId: string, balaVagaId: string): string | null {
  const antes = mochila.mochilaDeAgora()
  const arma = antes.find((vaga) => vaga.id === armaVagaId)
  const bala = antes.find((vaga) => vaga.id === balaVagaId)
  if (arma === undefined || bala === undefined) return SAIU_DA_MOCHILA
  const feito = recarregarForaDaBatalha(antes, armaVagaId, balaVagaId, acervo, `item_${crypto.randomUUID()}`)
  if (ehRecusa(feito)) return feito.recusa
  // Trocar de bala começa o pente do zero: as de antes voltaram para a mochila.
  const noPente = arma.pente !== undefined && arma.pente.balaId === bala.itemId ? arma.pente.n : 0
  const naMochila = quantidadeDe(bala)
  const trocou = feito.devolvidas > 0 ? ` As ${feito.devolvidas.toLocaleString('pt-BR')} balas de antes voltaram para a mochila.` : ''
  gravarComDesfazerDasVagas(
    mochila,
    antes,
    feito.mochila,
    `${arma.nome} recarregada: pente ${noPente} → ${noPente + feito.entraram}. ${bala.nome} na mochila: ${naMochila.toLocaleString('pt-BR')} → ${(naMochila - feito.entraram).toLocaleString('pt-BR')}.${trocou}`,
  )
  return null
}

/**
 * Rodada 3 (28/11/2026): o toque "Arma padrão" no cartão da arma equipada (`mochilaComArmaPadrao`), com o
 * aviso e o Desfazer. A técnica com "Dano da Arma" passa a usar esta arma. Devolve o motivo de não ter marcado, ou `null`.
 */
export function marcarArmaPadraoPeloMestre(mochila: MochilaQueGrava, acervo: Pick<AcervoDaMochila, 'item'>, armaVagaId: string, marcar: boolean): string | null {
  const antes = mochila.mochilaDeAgora()
  const arma = antes.find((vaga) => vaga.id === armaVagaId)
  if (arma === undefined) return SAIU_DA_MOCHILA
  const nova = mochilaComArmaPadrao(antes, armaVagaId, marcar, acervo)
  if (ehRecusa(nova)) return nova.recusa
  const frase = marcar ? `${arma.nome} é a arma padrão de ${mochila.dono}: a técnica com "Dano da Arma" usa ela.` : `${arma.nome} deixou de ser a arma padrão: vale a primeira equipada.`
  gravarComDesfazerDasVagas(mochila, antes, nova, frase)
  return null
}

/**
 * O PENTE À MÃO (correção de mesa): a arma `armaVagaId` fica com `n` balas no pente, sem tirar nem pôr
 * nada na mochila (`mochilaComPenteAjustado`), com o aviso e o Desfazer. O mesmo número: nada a gravar.
 * Devolve o motivo de não ter ajustado, ou `null`.
 */
export function ajustarPentePeloMestre(mochila: MochilaQueGrava, acervo: Pick<AcervoDaMochila, 'item'>, armaVagaId: string, n: number): string | null {
  const antes = mochila.mochilaDeAgora()
  const arma = antes.find((vaga) => vaga.id === armaVagaId)
  if (arma === undefined) return SAIU_DA_MOCHILA
  const nova = mochilaComPenteAjustado(antes, armaVagaId, n, acervo)
  if (ehRecusa(nova)) return nova.recusa
  // Pente vazio é sem o campo (`pente` ausente): conta 0.
  const de = arma.pente?.n ?? 0
  if (de === n) return null
  gravarComDesfazerDasVagas(mochila, antes, nova, `Pente de ${arma.nome} ajustado à mão: ${de} → ${n}. A mochila de ${mochila.dono} não mudou.`)
  return null
}
