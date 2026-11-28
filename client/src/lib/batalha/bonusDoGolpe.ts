import type { CartaoDaFicha } from '../personagem'
import type { BonusDaBatalha, ParteDoBonus } from './combate'
import { categoriaAtira, type ArmaDaFicha } from './leituraDaFicha'
import { mesmaReferencia } from './requisitos/contexto'
import type { Referencia } from './requisitos/modelo'

/**
 * O "VALE EM" DO DANO (pedido do dono de 28/11/2026, "como eu sei quais técnicas aumentam o dano?"): uma
 * parte do dano do bônus da batalha pode valer só em alguns golpes (`ParteDoBonus.soEm`, posta pelo
 * acumulador). Uma coisa, um lugar: a tela (a mira) e o host tiram, por esta função, as partes que não
 * valem no golpe de agora, então a linha do dano mostra "+15 (Carga Magnética 2)" só onde ela soma.
 * Decisão do Claude: "só físicos" = o golpe que não sai de arma que atira (o contrário do "só tiros").
 *
 * Puro: sem store, sem rede.
 */

/** O golpe para o "Vale em": a técnica que bate (`null` = o Atacar com a arma) e se ele sai de arma que atira. */
export interface GolpeDoBonus {
  tecnica: Referencia | null
  tiro: boolean
}

/**
 * A arma lida (`ArmaDaFicha`, que estende o cartão com a `categoria` lida); o menu das técnicas a recebe como
 * `CartaoDaFicha`. Guarda pela chave `categoria`, que só a leitura da arma põe: o cartão cru não atira.
 */
function ehArmaLida(arma: CartaoDaFicha): arma is ArmaDaFicha {
  return 'categoria' in arma
}

/** O golpe da técnica (ou do Atacar, sem técnica) com a arma da vez. */
export function golpeDoBonus(tecnica: { id: string; nome: string } | null, arma: CartaoDaFicha | null): GolpeDoBonus {
  return { tecnica: tecnica === null ? null : { id: tecnica.id, nome: tecnica.nome }, tiro: arma !== null && ehArmaLida(arma) && categoriaAtira(arma.categoria) }
}

/** A parte vale neste golpe: sem `soEm`, sempre. */
export function parteValeNoGolpe(parte: ParteDoBonus, golpe: GolpeDoBonus): boolean {
  const so = parte.soEm
  if (so === undefined) return true
  if ('tiros' in so) return golpe.tiro
  if ('fisicos' in so) return !golpe.tiro
  const tecnica = golpe.tecnica
  return tecnica !== null && so.tecnicas.some((ref) => mesmaReferencia(ref, tecnica))
}

/** O bônus para UM golpe: as partes com `soEm` que não valem nele saem. Nenhuma saiu = o MESMO bônus. */
export function bonusParaOGolpe(bonus: BonusDaBatalha | undefined, golpe: GolpeDoBonus): BonusDaBatalha | undefined {
  if (bonus === undefined) return undefined
  let mudou = false
  const filtrado: Record<string, readonly ParteDoBonus[]> = {}
  for (const [alvo, partes] of Object.entries(bonus)) {
    const ficam = partes.filter((parte) => parteValeNoGolpe(parte, golpe))
    if (ficam.length !== partes.length) mudou = true
    if (ficam.length > 0) filtrado[alvo] = ficam
  }
  return mudou ? filtrado : bonus
}
