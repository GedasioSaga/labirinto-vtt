import type { LembreteDaPassiva, ModDoSelo, SaidaDaReacao, SeloDaBatalha } from './combate'
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

/**
 * O que o selo FAZ, pelo nome (conserto das fichas F2, fatia A; seção 6 de
 * docs/planos/construtor-de-mecanicas-2026-11-08.md: "tabela nome →
 * comportamento", que a peça `selo` do construtor reusa). Respostas do
 * grilling: Aéreo (May), Cego (Harvey), Ferido por prata (Vincent),
 * Queimando (Aira), Sangrando (Alexei e Siegfried), Atordoado (Jimboy).
 */
export interface ComportamentoDoSelo {
  /** O nome que a tela mostra ("Aéreo"). */
  nome: string
  sinal: RegExp
  /** Na vez do dono só "Passar a vez", e ele não reage. */
  trava?: true
  /** As saídas da reação que o selo tira (Aéreo: Esquiva e Contra-ataque; Defender e Receber ficam). */
  tiraSaidas?: readonly SaidaDaReacao[]
  /** O atributo que fica em 0 enquanto o selo existe (Cego: Percepção). */
  zera?: string
  /** O que tira no começo da vez da vítima, direto no HP, pelo lembrete "Aplicar / pular" do mestre. O selo pode trazer o dele (`SeloDaBatalha.porVez`). */
  porVez?: number
  /** O verbo da linha do registro quando o mestre aplica ("Ilo sangra: -10 HP"). */
  verbo?: string
  /** Um acerto novo com o mesmo selo renova os turnos dele em vez de pôr outro (Queimando). */
  renova?: true
  /** O selo só lembra o mestre disto (o app não aplica nada). */
  lembrete?: string
}

/** A tabela, na ordem em que o nome é procurado. */
const COMPORTAMENTOS_DOS_SELOS: readonly ComportamentoDoSelo[] = [
  { nome: 'Atordoado', sinal: /^atordoad/, trava: true },
  { nome: 'Paralisado', sinal: /^paralisad/, trava: true },
  { nome: 'Aéreo', sinal: /^aere[oa]/, tiraSaidas: ['esquiva', 'contra'] },
  { nome: 'Cego', sinal: /^ceg[oa]/, zera: 'percepcao' },
  { nome: 'Ferido por prata', sinal: /^ferid[oa] por prata/, lembrete: 'a cura que recebe cai pela metade (o mestre corta à mão)' },
  { nome: 'Sangrando', sinal: /^sangr/, porVez: 10, verbo: 'sangra' },
  { nome: 'Queimando', sinal: /^queima/, porVez: 10, verbo: 'queima', renova: true },
]

/** O comportamento do selo pelo nome (sem acento nem caixa); `null` = selo comum. */
export function comportamentoDoSelo(nomeDoSelo: string): ComportamentoDoSelo | null {
  const normal = normalizar(nomeDoSelo).trim()
  return COMPORTAMENTOS_DOS_SELOS.find((comportamento) => comportamento.sinal.test(normal)) ?? null
}

/** O nome da condição que trava ("Atordoado"), se o selo é uma; `null` = não trava. */
function condicaoQueTrava(nomeDoSelo: string): string | null {
  const comportamento = comportamentoDoSelo(nomeDoSelo)
  return comportamento?.trava === true ? comportamento.nome : null
}

/**
 * As saídas da reação que o d20 liberou, sem as que os selos de quem reage
 * tiram (Aéreo: só Defender e Receber). A melhor que sobra fica primeiro.
 */
export function saidasComOsSelos(saidas: readonly SaidaDaReacao[], selos: readonly Pick<SeloDaBatalha, 'nome'>[] | undefined): SaidaDaReacao[] {
  const tiradas = new Set(saidasTiradas(selos))
  return saidas.filter((saida) => !tiradas.has(saida))
}

/** As saídas que os selos de quem reage tiram (Aéreo: Esquiva e Contra-ataque); nenhuma = vazio. */
export function saidasTiradas(selos: readonly Pick<SeloDaBatalha, 'nome'>[] | undefined): SaidaDaReacao[] {
  return [...new Set((selos ?? []).flatMap((selo) => comportamentoDoSelo(selo.nome)?.tiraSaidas ?? []))]
}

/**
 * Os mods que o selo novo leva por fazer o que diz: Cego põe a Percepção do
 * alvo em 0 (o total de agora, com os selos que ele já tem, em negativo).
 * Selo sem atributo para zerar, ou já em 0: os mods do pedido, iguais.
 */
export function modsDoComportamento(nomeDoSelo: string, mods: readonly ModDoSelo[] | undefined, totalDoAtributo: (atributoId: string) => number | null): readonly ModDoSelo[] | undefined {
  const zera = comportamentoDoSelo(nomeDoSelo)?.zera
  if (zera === undefined) return mods
  const total = totalDoAtributo(zera)
  if (total === null || total === 0) return mods
  return [...(mods ?? []).filter((mod) => mod.alvo !== zera), { alvo: zera, delta: -total }]
}

/** Quanto o selo tira por vez (o dele, ou o da tabela); `null` = não tira. */
export function danoPorVezDoSelo(selo: Pick<SeloDaBatalha, 'nome' | 'porVez'>): number | null {
  const daTabela = comportamentoDoSelo(selo.nome)?.porVez
  if (daTabela === undefined) return null
  return selo.porVez !== undefined && Number.isInteger(selo.porVez) && selo.porVez > 0 ? selo.porVez : daTabela
}

/** "Atordoado: nesta vez só dá para passar a vez". */
export function motivoDaTrava(condicao: string): string {
  return `${condicao}: nesta vez só dá para passar a vez`
}

/** A condição que trava ("Atordoado") entre os selos da ficha; `null` = livre. */
function condicaoDosSelos(selos: readonly Pick<SeloDaBatalha, 'nome'>[] | undefined): string | null {
  for (const selo of selos ?? []) {
    const condicao = condicaoQueTrava(selo.nome)
    if (condicao !== null) return condicao
  }
  return null
}

/**
 * Por que a ficha não age nem reage agora (Atordoado ou Paralisado), ou
 * `null`. `selos` = os da ficha (o jogador passa os da carta dele).
 */
export function travaDosSelos(selos: readonly Pick<SeloDaBatalha, 'nome'>[] | undefined): string | null {
  const condicao = condicaoDosSelos(selos)
  return condicao === null ? null : motivoDaTrava(condicao)
}

/**
 * Por que a ficha não carrega o contador (a Polaridade) agora: carregar gasta
 * a reação, e quem está Atordoado ou Paralisado não reage. `null` = livre.
 * `selos` = os da ficha, como em `travaDosSelos`.
 */
export function travaDoContador(selos: readonly Pick<SeloDaBatalha, 'nome'>[] | undefined): string | null {
  const condicao = condicaoDosSelos(selos)
  return condicao === null ? null : `${condicao}: não reage, então não dá para carregar`
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
  return comportamentoDoSelo(selo.nome)?.nome === 'Sangrando'
}

/**
 * Os selos da ficha que tiram por vez (Sangrando, Queimando), na ordem em que
 * foram postos: cada um pede "Aplicar / pular" ao mestre no começo da vez.
 */
export function sangramentosDoToken(selos: readonly SeloDaBatalha[] | undefined, tokenId: string): SeloDaBatalha[] {
  return (selos ?? []).filter((selo) => selo.tokenId === tokenId && danoPorVezDoSelo(selo) !== null)
}

/** A chave do lembrete do sangramento: o `cartaoId` do lembrete é o id do SELO. */
export function chaveDoSangramento(seloId: string): string {
  return `${seloId}:sangra`
}

/** O lembrete é o de um sangramento (e não o de uma passiva ou forma). */
export function ehLembreteDoSangramento(lembrete: Pick<LembreteDaPassiva, 'cartaoId' | 'chave'>): boolean {
  return lembrete.chave === chaveDoSangramento(lembrete.cartaoId)
}
