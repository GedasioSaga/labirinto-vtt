import type { SeloDaBatalha } from './combate'
import { ehSeloDoCansaco } from './recursosDaBatalha'

/**
 * OS SELOS NEGATIVOS DE UM TOKEN (conserto das fichas F2, fatia D; respostas
 * do Guilherme): a Explosão DOBRA os turnos que faltam de cada um (Atordoado
 * 2 vira 4, inclusive os postos à mão); o Revigorar TIRA todos, até o
 * cansaço do Overload (a metade dos atributos).
 *
 * Negativo = Debuff, condição (Atordoado, Sangramento, Queimando...) ou o
 * cansaço do Overload. Nunca: Buff, passiva, o contador (Polaridade), a marca
 * nem o "Ajustar..." do mestre (que pode ser bônus).
 *
 * Puro: sem store, sem rede.
 */

/** O selo é negativo. */
export function seloNegativo(selo: Pick<SeloDaBatalha, 'nome' | 'origem' | 'natureza' | 'contador' | 'marca' | 'ajuste'>): boolean {
  if (ehSeloDoCansaco(selo)) return true
  if (selo.contador !== undefined || selo.marca === true || selo.ajuste === true) return false
  return selo.natureza === undefined || selo.natureza === 'debuff' || selo.natureza === 'condicao'
}

/** Os selos negativos do token, na ordem da cena. */
export function debuffsDoToken(selos: readonly SeloDaBatalha[] | undefined, tokenId: string): SeloDaBatalha[] {
  return (selos ?? []).filter((selo) => selo.tokenId === tokenId && seloNegativo(selo))
}

/**
 * Explosão: cada selo negativo do token com os turnos que faltam dobrados
 * (`antes` e `depois`, para a reversão). Selo sem turnos (até o mestre tirar)
 * fica como está e não entra na lista.
 */
export function debuffsDobrados(selos: readonly SeloDaBatalha[] | undefined, tokenId: string): { antes: SeloDaBatalha; depois: SeloDaBatalha }[] {
  return debuffsDoToken(selos, tokenId).flatMap((antes) => {
    if (antes.turnos === null || antes.turnos <= 0) return []
    const turnos = antes.turnos * 2
    const depois: SeloDaBatalha = { ...antes, turnos, total: Math.max(antes.total ?? 0, turnos) }
    return [{ antes, depois }]
  })
}
