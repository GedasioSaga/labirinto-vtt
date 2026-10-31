import { NOME_DO_SELO_MAX, type SaidaDaReacao, type SeloDaBatalha, type SeloPedido } from './combate'

/**
 * SELOS DE DURAÇÃO, F3 fatia T (seção 3.3 de
 * docs/planos/batalha-one-piece-f3-plano.md; respostas Q4 a Q6): "Atordoado 2"
 * na carta. O mestre põe à mão; a habilidade que diz "por N turnos" sugere o
 * selo no golpe, que só pega se o golpe acerta (Q6). Conta pela vez do alvo
 * (Q4): desconta no fim da vez dele, no máximo 1 vez por rodada. Todos que
 * veem a carta veem o selo, também o de NPC (Q5).
 *
 * FASE 0 (o contrato): `lerDuracao` devolve `null` (nada sugerido) e
 * `contarSelos` não desconta nada. A regra chega na fase 1 (T-A).
 * `selosDoToken`, `pegaOSelo` e `textoDoSelo` já valem.
 *
 * Puro: sem store, sem rede.
 */

/** Os prontos do "Pôr selo...", em botões. */
export const SELOS_PRONTOS = ['Atordoado', 'Cego', 'Sangrando', 'Queimando', 'Envenenado', 'Paralisado', 'Lento', 'Preso', 'Confuso'] as const

/** Nome de selo que o fio aceita: de 1 a `NOME_DO_SELO_MAX`, sem quebra de linha e não só espaço. */
export function ehNomeDeSelo(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 1 && value.length <= NOME_DO_SELO_MAX && !/[\r\n]/.test(value) && value.trim().length > 0
}

export function novoIdDeSelo(): string {
  return `selo_${crypto.randomUUID()}`
}

/**
 * O selo que o texto da técnica sugere ("Atordoa o alvo por 1 turno" =
 * Atordoado, 1). Lê o Efeito e depois a Descrição; sem número de turnos =
 * `null`. FASE 0: sempre `null`.
 */
export function lerDuracao(_texto: string, _nomeDaTecnica: string): SeloPedido | null {
  return null
}

/**
 * A carta de `tokenIdQueSai` passou a vez na `rodada`: os selos dela
 * descontam 1 (só se `contadoNaRodada !== rodada`); os que chegam a 0 saem e
 * vêm em `acabaram`. Selo sem turnos nunca desconta. FASE 0: nada muda.
 */
export function contarSelos(selos: readonly SeloDaBatalha[], _tokenIdQueSai: string, _rodada: number): { selos: SeloDaBatalha[]; acabaram: SeloDaBatalha[] } {
  return { selos: [...selos], acabaram: [] }
}

/** Os selos de uma ficha, na ordem em que foram postos. */
export function selosDoToken(selos: readonly SeloDaBatalha[] | undefined, tokenId: string): SeloDaBatalha[] {
  return (selos ?? []).filter((selo) => selo.tokenId === tokenId)
}

/** Q6: o selo sugerido pega quando o golpe acerta (Receber, Defender, Crítico, Não reagir, Passar, sem reação); não em Esquivar nem Contra-atacar. */
export function pegaOSelo(saida: SaidaDaReacao): boolean {
  return saida !== 'esquiva' && saida !== 'contra'
}

/** "Atordoado 2"; sem turnos (até tirar), só o nome: "Cego". */
export function textoDoSelo(selo: Pick<SeloDaBatalha, 'nome' | 'turnos'>): string {
  return selo.turnos === null ? selo.nome : `${selo.nome} ${selo.turnos}`
}
