/**
 * PERGUNTA NA HORA (conserto das fichas F2, fatia A; seção 2 de
 * docs/planos/construtor-de-mecanicas-2026-11-08.md, "respostas no pedido"):
 * a técnica pergunta algo curto a quem usa, ou ao mestre, antes de sair
 * ("cortante ou perfurante?", "qual atributo?", "quantos turnos?", "qual
 * arma?"). A resposta viaja no campo genérico `respostas` do pedido, nunca num
 * campo novo por mecânica, e o host confere cada uma contra a pergunta.
 *
 * Puro: sem store, sem rede.
 */

/** Respostas no pedido: a chave da pergunta → a opção escolhida (texto) ou o número digitado. */
export type RespostasDoPedido = Readonly<Record<string, string | number>>

/** Quantas respostas um pedido leva, no máximo (o fio recusa acima). */
export const RESPOSTAS_MAX = 8
/** O tamanho máximo da chave e da opção no fio. */
export const RESPOSTA_TEXTO_MAX = 40
/** O maior número que uma resposta numérica aceita (turnos, quantos alvos). */
export const RESPOSTA_NUMERO_MAX = 99

/** Uma opção curta: o valor que vai no pedido e o rótulo do botão. */
export interface OpcaoDaPergunta {
  valor: string
  rotulo: string
}

/** Quem responde: quem usa a técnica, ou o mestre (o mestre sempre pode responder por quem usa). */
export type QuemResponde = 'quemUsa' | 'mestre'

export type PerguntaNaHora =
  | { chave: string; texto: string; para: QuemResponde; tipo: 'opcoes'; opcoes: readonly OpcaoDaPergunta[] }
  | { chave: string; texto: string; para: QuemResponde; tipo: 'numero'; minimo: number; maximo: number }

/** As respostas que o fio aceita: até `RESPOSTAS_MAX`, chave e texto curtos, número inteiro de 0 a `RESPOSTA_NUMERO_MAX`. `null` = torto. */
export function lerRespostas(value: unknown): RespostasDoPedido | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const entradas = Object.entries(value)
  if (entradas.length > RESPOSTAS_MAX) return null
  const respostas: Record<string, string | number> = {}
  for (const [chave, resposta] of entradas) {
    if (chave.length < 1 || chave.length > RESPOSTA_TEXTO_MAX) return null
    const texto = typeof resposta === 'string' && resposta.length >= 1 && resposta.length <= RESPOSTA_TEXTO_MAX
    const numero = typeof resposta === 'number' && Number.isInteger(resposta) && resposta >= 0 && resposta <= RESPOSTA_NUMERO_MAX
    if (!texto && !numero) return null
    respostas[chave] = resposta
  }
  return respostas
}

/**
 * Por que as respostas não valem para estas perguntas, ou `null` (valem):
 * toda pergunta respondida, opção que existe, número na faixa, nada a mais.
 */
export function motivoDasRespostas(perguntas: readonly PerguntaNaHora[], respostas: RespostasDoPedido | undefined): string | null {
  const dadas = respostas ?? {}
  for (const chave of Object.keys(dadas)) {
    if (!perguntas.some((pergunta) => pergunta.chave === chave)) return 'Resposta que a técnica não pergunta'
  }
  for (const pergunta of perguntas) {
    const resposta = dadas[pergunta.chave]
    if (resposta === undefined) return `Responda: ${pergunta.texto}`
    if (pergunta.tipo === 'opcoes' && !pergunta.opcoes.some((opcao) => opcao.valor === resposta)) return `Resposta fora das opções: ${pergunta.texto}`
    if (pergunta.tipo === 'numero' && (typeof resposta !== 'number' || resposta < pergunta.minimo || resposta > pergunta.maximo)) return `Número fora da faixa (${pergunta.minimo} a ${pergunta.maximo}): ${pergunta.texto}`
  }
  return null
}
