import type { CarriedItem } from '../../types/map'
import type { EquipamentoDoItem } from '../itens/modelo'

/**
 * O QUE A ROUPA VESTIDA DÁ (itens refeitos, decisão 8): a CA e o Escudo somados das vagas de
 * equipamento em uso. Sem regra inventada: só o que o mestre escreveu em "Como veste" (os bônus de
 * Vantagem e de atributo o mestre narra; aqui só os dois números que a ficha e a batalha mostram).
 * O Escudo da roupa enche no começo da batalha (`escudoNoComeco`); a CA aparece na ficha e na carta da
 * batalha (o sistema não tem CA própria, então é o número da roupa). Puro.
 */
export interface BonusDaRoupa {
  ca: number
  escudo: number
}

/** O bloco de roupa do item no Acervo de agora; `undefined` = fora do Acervo (ou o app sem ele): vale a cópia da vaga. */
export type EquipamentoNoAcervo = (itemId: string) => EquipamentoDoItem | undefined

/** A roupa da vaga: a do Acervo de agora vence o instantâneo da regra da vaga. `undefined` = não é roupa. */
export function equipamentoDaVaga(vaga: Pick<CarriedItem, 'itemId' | 'regra'>, noAcervo: EquipamentoNoAcervo): EquipamentoDoItem | undefined {
  const doAcervo = vaga.itemId === undefined ? undefined : noAcervo(vaga.itemId)
  return doAcervo ?? vaga.regra?.equipamento
}

/** A CA e o Escudo de uma roupa (os bônus de mesmo campo somam). */
export function bonusDoEquipamento(equipamento: EquipamentoDoItem): BonusDaRoupa {
  let ca = 0
  let escudo = 0
  for (const bonus of equipamento.bonus) {
    if (bonus.campo === 'ca') ca += bonus.n
    else if (bonus.campo === 'escudo') escudo += bonus.n
  }
  return { ca, escudo }
}

/** O que as roupas vestidas da mochila dão juntas. Mochila ausente (a ficha de antes) = nada. */
export function bonusDaRoupa(mochila: readonly CarriedItem[] | undefined, noAcervo: EquipamentoNoAcervo): BonusDaRoupa {
  let ca = 0
  let escudo = 0
  for (const vaga of mochila ?? []) {
    if (vaga.equipado !== true) continue
    const equipamento = equipamentoDaVaga(vaga, noAcervo)
    if (equipamento === undefined) continue
    const deste = bonusDoEquipamento(equipamento)
    ca += deste.ca
    escudo += deste.escudo
  }
  return { ca, escudo }
}

/** "+2" ou "−1": o bônus com o sinal, como a ficha mostra. */
export function comSinal(n: number): string {
  return n < 0 ? `−${Math.abs(n)}` : `+${n}`
}

/** "CA +2 · Escudo +5": o que a roupa dá, em uma linha; vazio = nada. */
export function textoDoBonusDaRoupa(bonus: BonusDaRoupa): string {
  const partes: string[] = []
  if (bonus.ca !== 0) partes.push(`CA ${comSinal(bonus.ca)}`)
  if (bonus.escudo !== 0) partes.push(`Escudo ${comSinal(bonus.escudo)}`)
  return partes.join(' · ')
}
