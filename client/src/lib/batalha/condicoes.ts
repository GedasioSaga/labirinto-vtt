import type { LembreteDaPassiva, SeloDaBatalha } from './combate'
import { normalizar } from './formula'

/**
 * CONDIÇÕES QUE A REGRA APLICA, conserto das fichas F1 (fatia S4; regras do
 * sistema em docs/auditoria-fichas/respostas-do-grilling.md):
 *  - Atordoado e Paralisado: na vez do dono só "Passar a vez" fica liberado,
 *    e ele não reage (o golpe nele resolve sem caixa de reação);
 *  - Sangrando (de qualquer fonte): no começo da vez da vítima, um lembrete
 *    "Aplicar / pular" para o MESTRE; Aplicar tira 10 direto no HP (ignora o
 *    Escudo).
 *
 * O selo é achado pelo NOME ("Atordoado 2", "Sangrando"), sem acento nem
 * caixa: vale o posto à mão e o que o golpe sugeriu.
 *
 * Puro: sem store, sem rede.
 */

/** Os selos que travam a vez, na ordem em que o texto os procura. */
const SELOS_QUE_TRAVAM: readonly { sinal: RegExp; nome: string }[] = [
  { sinal: /^atordoad/, nome: 'Atordoado' },
  { sinal: /^paralisad/, nome: 'Paralisado' },
]

/** O nome da condição que trava ("Atordoado"), se o selo é uma; `null` = não trava. */
function condicaoQueTrava(nomeDoSelo: string): string | null {
  const normal = normalizar(nomeDoSelo).trim()
  return SELOS_QUE_TRAVAM.find((trava) => trava.sinal.test(normal))?.nome ?? null
}

/** "Atordoado: nesta vez só dá para passar a vez". */
export function motivoDaTrava(condicao: string): string {
  return `${condicao}: nesta vez só dá para passar a vez`
}

/**
 * Por que a ficha não age nem reage agora (Atordoado ou Paralisado), ou
 * `null`. `selos` = os da ficha (o jogador passa os da carta dele).
 */
export function travaDosSelos(selos: readonly Pick<SeloDaBatalha, 'nome'>[] | undefined): string | null {
  for (const selo of selos ?? []) {
    const condicao = condicaoQueTrava(selo.nome)
    if (condicao !== null) return motivoDaTrava(condicao)
  }
  return null
}

/** A trava da ficha `tokenId` entre os selos da cena; `null` = livre. */
export function travaDoToken(selos: readonly Pick<SeloDaBatalha, 'tokenId' | 'nome'>[] | undefined, tokenId: string): string | null {
  return travaDosSelos((selos ?? []).filter((selo) => selo.tokenId === tokenId))
}

// ───────────────────────────────────────────────────────────────────────────
// Sangramento
// ───────────────────────────────────────────────────────────────────────────

/** Regra do sistema (respostas do Alexei e do Siegfried): o Sangramento tira 10 por vez, direto no HP. */
export const DANO_DO_SANGRAMENTO = 10

/** O selo é de sangramento ("Sangrando", "Sangramento 3"). */
export function ehSeloDeSangramento(selo: Pick<SeloDaBatalha, 'nome'>): boolean {
  return /^sangr/.test(normalizar(selo.nome).trim())
}

/** Os selos de sangramento da ficha, na ordem em que foram postos. */
export function sangramentosDoToken(selos: readonly SeloDaBatalha[] | undefined, tokenId: string): SeloDaBatalha[] {
  return (selos ?? []).filter((selo) => selo.tokenId === tokenId && ehSeloDeSangramento(selo))
}

/** A chave do lembrete do sangramento: o `cartaoId` do lembrete é o id do SELO. */
export function chaveDoSangramento(seloId: string): string {
  return `${seloId}:sangra`
}

/** O lembrete é o de um sangramento (e não o de uma passiva ou forma). */
export function ehLembreteDoSangramento(lembrete: Pick<LembreteDaPassiva, 'cartaoId' | 'chave'>): boolean {
  return lembrete.chave === chaveDoSangramento(lembrete.cartaoId)
}
