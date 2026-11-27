import type { SeloDaBatalha } from './combate'
import { tipoDoSelo } from './condicoes'
import { ehSeloDoCansaco } from './recursosDaBatalha'
import { normalizar } from './formula'

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
 * Rework das condições (E3, "só as negativas"): o selo de uma condição é negativo
 * ou positivo pelo TIPO dela (a congelada, ou a de fábrica pelo nome), não pela
 * cor: a positiva (Abençoado, Protegido) nunca sai na limpeza das negativas.
 * Selo sem condição: a natureza decide, como antes.
 *
 * Puro: sem store, sem rede.
 */

/** O selo como a limpeza o lê: os campos de sempre e, no host, a regra congelada da condição. */
type SeloDaLimpeza = Pick<SeloDaBatalha, 'nome' | 'origem' | 'natureza' | 'contador' | 'marca' | 'ajuste'> & Partial<Pick<SeloDaBatalha, 'regras'>>

/** O selo é negativo. */
export function seloNegativo(selo: SeloDaLimpeza): boolean {
  if (ehSeloDoCansaco(selo)) return true
  if (selo.contador !== undefined || selo.marca === true || selo.ajuste === true) return false
  const tipo = tipoDoSelo(selo)
  if (tipo !== null) return tipo === 'negativa'
  return selo.natureza === undefined || selo.natureza === 'debuff' || selo.natureza === 'condicao'
}

/** O selo é positivo (o que a limpeza "positivos" tira): o da condição positiva, senão o Buff. */
function seloPositivo(selo: SeloDaLimpeza): boolean {
  const tipo = tipoDoSelo(selo)
  return tipo === null ? selo.natureza === 'buff' : tipo === 'positiva'
}

/** Fase 5: quais selos a limpeza tira (ausente = os negativos, como a Revigorar). */
export type QuaisSelosTira = 'positivos' | 'todos' | { nomes: readonly string[] }

/** O que nunca sai por limpeza: o contador, a marca, o "Ajustar..." do mestre e o selo de passiva (tem dono). */
function seloDeRegra(selo: Pick<SeloDaBatalha, 'contador' | 'marca' | 'ajuste' | 'donoId'>): boolean {
  return selo.contador !== undefined || selo.marca === true || selo.ajuste === true || selo.donoId !== undefined
}

/**
 * Fase 5 (SISTEMA.md, `tirarSelos`): os selos do token que a limpeza tira. O
 * antídoto tira só os de nome igual (sem acento nem caixa: "Tira Envenenado"
 * deixa o Sangrando); "positivos" = os Buffs e as condições positivas; "todos" = negativos e positivos.
 */
export function selosQueALimpezaTira(selos: readonly SeloDaBatalha[] | undefined, tokenId: string, quais: QuaisSelosTira | undefined): SeloDaBatalha[] {
  if (quais === undefined) return debuffsDoToken(selos, tokenId)
  const doToken = (selos ?? []).filter((selo) => selo.tokenId === tokenId)
  if (quais === 'positivos') return doToken.filter((selo) => !seloDeRegra(selo) && seloPositivo(selo))
  if (quais === 'todos') return doToken.filter((selo) => seloNegativo(selo) || (!seloDeRegra(selo) && seloPositivo(selo)))
  const nomes = new Set(quais.nomes.map((nome) => normalizar(nome).trim()))
  return doToken.filter((selo) => !seloDeRegra(selo) && nomes.has(normalizar(selo.nome).trim()))
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
    // Nº 3 do levantamento: os turnos do espelho da pastilha são os do prazo da ficha (o espelho não conta): dobrar aqui não pegaria.
    if (antes.turnos === null || antes.turnos <= 0 || antes.daPastilha === true) return []
    const turnos = antes.turnos * 2
    const depois: SeloDaBatalha = { ...antes, turnos, total: Math.max(antes.total ?? 0, turnos) }
    return [{ antes, depois }]
  })
}
