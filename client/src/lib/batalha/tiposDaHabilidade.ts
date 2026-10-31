import type { CartaoDaFicha } from '../personagem'
import type { SeloPedido } from './combate'
import { normalizar } from './formula'
import { CAMPO_DA_ACAO, lerAcao } from './leituraDaFicha'
import { lerDuracao, type SELOS_PRONTOS } from './selos'

/**
 * TIPOS DE HABILIDADE, F1 (docs/planos/batalha-tipos-de-habilidade-plano.md,
 * com as "Decisões do usuário" do fim): COMO a habilidade entra em jogo. Um
 * campo Tipo por habilidade, com as 7 opções de `TIPOS_DE_HABILIDADE`; vazio
 * (ou fora da lista) = deduzido da Ação. E a leitura da técnica de reação: o
 * que ela faz no lugar do d20 (`modoDaReacao`) e o selo que põe em quem atacou.
 *
 * Leitura de texto erra: tudo aqui é SUGESTÃO marcada na tela, que quem
 * reage e o mestre trocam (decisão 2).
 *
 * Puro: sem store, sem rede.
 */

/** O campo Tipo da aba Habilidades (`lib/sistemaOnePiece.ts`), logo depois da Ação. */
export const CAMPO_DO_TIPO = 'tipo'

/**
 * As opções do campo Tipo, na ordem da caixa de escolha. Para pôr um tipo
 * novo, uma linha aqui (decisão 1: "pode ser que eu peça pra você pôr mais").
 * A ficha guarda o RÓTULO; ficha com texto fora da lista mostra "(fora da
 * lista)" na caixa e não perde o valor (`escolhaDoCampo`).
 */
export const TIPOS_DE_HABILIDADE = [
  { id: 'ativa', rotulo: 'Ativa' },
  { id: 'passiva', rotulo: 'Passiva' },
  { id: 'reacao', rotulo: 'Reação' },
  { id: 'buff', rotulo: 'Buff' },
  { id: 'debuff', rotulo: 'Debuff' },
  { id: 'evolucao', rotulo: 'Evolução' },
  { id: 'escolha', rotulo: 'Escolha' },
] as const satisfies readonly { id: string; rotulo: string }[]

export type TipoDaHabilidade = (typeof TIPOS_DE_HABILIDADE)[number]['id']

/** O tipo de um texto do campo ("Reação", "reacao", " BUFF "); `null` = vazio ou fora da lista. */
export function tipoDoTexto(texto: string): TipoDaHabilidade | null {
  const normal = normalizar(texto)
  if (normal.length === 0) return null
  return TIPOS_DE_HABILIDADE.find((tipo) => normalizar(tipo.rotulo) === normal || tipo.id === normal)?.id ?? null
}

/** O rótulo da lista ("reacao" = "Reação"). */
export function rotuloDoTipo(tipo: TipoDaHabilidade): string {
  return TIPOS_DE_HABILIDADE.find((candidato) => candidato.id === tipo)?.rotulo ?? tipo
}

export interface LeituraDoTipo {
  tipo: TipoDaHabilidade
  /** Deduzido da Ação: o campo Tipo está vazio ou fora da lista. */
  inferido: boolean
  /** Aparece também na caixa REAÇÃO: Tipo Reação, ou Ação dupla ("Reação/Ação Completa"). */
  tambemReacao: boolean
  /** O texto do campo Tipo que não está na lista (a tela mostra "(fora da lista)"); ausente = vazio ou da lista. */
  foraDaLista?: string
}

/**
 * O tipo da habilidade. O campo Tipo preenchido com uma opção da lista vence.
 * Senão, pela Ação: "Passiva..." = passiva; "Reação" sozinha = reacao; o
 * resto (as duplas "Reação/Ação Completa" inclusive) = ativa. Ex.: Passo de
 * Valsa (Ação "Reação", Tipo vazio) = reacao, inferido; Giro da Lança
 * ("Reação/Ação Completa") = ativa com `tambemReacao`; Fortaleza ("Passiva")
 * = passiva.
 */
export function lerTipo(cartao: Pick<CartaoDaFicha, 'campos'>): LeituraDoTipo {
  const acao = lerAcao(cartao.campos[CAMPO_DA_ACAO] ?? '')
  const texto = (cartao.campos[CAMPO_DO_TIPO] ?? '').trim()
  const escrito = tipoDoTexto(texto)
  const tipo: TipoDaHabilidade = escrito ?? (acao.acao === 'passiva' ? 'passiva' : acao.soReacao === true ? 'reacao' : 'ativa')
  const leitura: LeituraDoTipo = { tipo, inferido: escrito === null, tambemReacao: tipo === 'reacao' || acao.tambemReacao }
  if (escrito === null && texto.length > 0) leitura.foraDaLista = texto
  return leitura
}

// ───────────────────────────────────────────────────────────────────────────
// Reação automática (seção 4f)
// ───────────────────────────────────────────────────────────────────────────

/**
 * O que o texto da técnica de reação diz que ela faz. "rolar" = rola o d20
 * com a técnica; "escolher" = o texto não diz (a caixa mostra Esquiva,
 * Metade, Contra e Receber, sem nenhuma marcada).
 */
export type ModoDaReacao = 'esquiva' | 'metade' | 'contra' | 'rolar' | 'escolher'

/** O extra com o texto do modo reação (Giro da Lança, Aplauso). */
const NOME_DO_EXTRA_DA_REACAO = 'reacao'

/** Os sinais de cada modo, na ordem em que vencem: "rola 1d20" com "esquiva" no texto é rolar. */
const SINAIS_DO_MODO: readonly { sinal: RegExp; modo: Exclude<ModoDaReacao, 'escolher'> }[] = [
  { sinal: /\brola|\b1?d20\b|\bteste\b/, modo: 'rolar' },
  { sinal: /rebat|devolve|contra-? ?ata/, modo: 'contra' },
  { sinal: /esquiv|desvi|\banula|\bevita/, modo: 'esquiva' },
  { sinal: /metade|reduz/, modo: 'metade' },
]

/** Os textos que a leitura da reação olha, nesta ordem: o extra "Reação", o Efeito, a Descrição. Vazios saem. */
function textosDaReacao(cartao: CartaoDaFicha): string[] {
  const extra = cartao.extras.find((candidato) => normalizar(candidato.nome) === NOME_DO_EXTRA_DA_REACAO)?.valor ?? ''
  return [extra, cartao.campos.efeito ?? '', cartao.campos.descricao ?? ''].filter((texto) => texto.trim().length > 0)
}

function modoDoTexto(texto: string): ModoDaReacao {
  const normal = normalizar(texto)
  return SINAIS_DO_MODO.find(({ sinal }) => sinal.test(normal))?.modo ?? 'escolher'
}

/**
 * O modo da técnica de reação: o primeiro texto (extra "Reação", Efeito,
 * Descrição) que diz algo. Ex.: Passo de Valsa ("esquivar") = esquiva;
 * Recuperação de forças ("Anula o dano") = esquiva; Aplauso (extra Reação
 * "Rebate...") = contra; Giro da Lança ("rola 1d20 de reação") = rolar;
 * Armadura Humana (o texto não diz) = escolher.
 */
export function modoDaReacao(cartao: CartaoDaFicha): ModoDaReacao {
  for (const texto of textosDaReacao(cartao)) {
    const modo = modoDoTexto(texto)
    if (modo !== 'escolher') return modo
  }
  return 'escolher'
}

/** A saída que já vem marcada na caixa (uma das `SaidaDaTecnica`); `null` = "escolher" (nenhuma marcada). */
export function saidaSugerida(modo: ModoDaReacao): Exclude<ModoDaReacao, 'escolher'> | null {
  return modo === 'escolher' ? null : modo
}

/** "marca", "marcar", "marcado": a técnica marca quem atacou (Passo de Valsa: "marca de tinta"). */
const SINAL_DA_MARCA = /\bmarca/

/** O nome do selo que a reação põe em quem atacou. */
export const SELO_DA_MARCA: (typeof SELOS_PRONTOS)[number] = 'Marcado'

/**
 * O selo que a técnica de reação sugere em QUEM ATACOU: "Marcado" quando o
 * texto fala de marca, com os turnos de "por N turnos" (sem número = até
 * tirar). `null` = o texto não marca ninguém. Vai marcado na caixa; quem
 * reage desmarca.
 */
export function seloDaReacao(cartao: CartaoDaFicha): SeloPedido | null {
  for (const texto of textosDaReacao(cartao)) {
    if (!SINAL_DA_MARCA.test(normalizar(texto))) continue
    return { nome: SELO_DA_MARCA, turnos: lerDuracao(texto, cartao.nome)?.turnos ?? null }
  }
  return null
}
