import { motivoDasRespostas, type RespostasDoPedido } from '../perguntaNaHora'
import { avaliarDoCartao, type AvaliacaoDosRequisitos, type Gasto, type PerguntaDosRequisitos } from './avaliar'
import type { ContextoDosRequisitos } from './contexto'
import { fraseDoDeclarado, fraseDoForcado } from './frases'
import { lerRequisitos } from './ler'
import { PREFIXO_DA_RESPOSTA } from './modelo'

/**
 * REQUISITOS, fase C (docs/design/habilidades/REQUISITOS.md §6): o PORTÃO. Uma função para os cinco
 * caminhos (técnica, Atacar com arma, item, ligar a forma e Evoluir), a mesma no menu e no host: lê o
 * bloco do cartão, julga com o avaliador da B1 contra o retrato montado do estado de verdade
 * (`montar.ts`) e diz se o pedido passa, com os gastos e a nota da linha, ou por que não.
 *
 * - As respostas dos requisitos viajam no campo `respostas` do pedido, nas chaves `req.<id>` (a
 *   caixa "Cumpriu?" e a escolha do "Um destes"); o host confere cada uma contra a avaliação dele.
 * - O mestre força (`forcarRequisitos`): pula o que falta, as perguntas e os gastos do que falta; os
 *   gastos do que vale saem; o custo normal da técnica é do caminho, não daqui.
 * - O pedido ao aliado (G1, G2) sai como `perguntaAoAliado`: a rede da ajuda (pendência, aceite,
 *   prazo) é da fase E; até lá o host recusa com o motivo dela, sem gastar nada.
 *
 * Puro: sem store, sem rede, sem Pixi.
 */

export const MOTIVO_PEDE_AJUDA = 'Pede ajuda de um aliado: o pedido ainda não chega a ele'
export const MOTIVO_ESPERA_O_MESTRE = 'Espera o mestre decidir'
export const MOTIVO_SO_O_MESTRE_FORCA = 'Só o mestre usa mesmo assim'
export const MOTIVO_DO_TESTE_DO_REQUISITO = 'O teste do requisito: o mestre rola e usa mesmo assim'
export const MOTIVO_RESPOSTA_SEM_PERGUNTA = 'Resposta que a técnica não pergunta'

/** O que o pedido traz para o portão. */
export interface PedidoNoPortao {
  respostas?: RespostasDoPedido
  forcar?: boolean
  /** G1, G2: o aliado escolhido (fase E). */
  ajudaDe?: string
}

export type ResultadoDoPortao =
  /** O cartão não tem esse grupo: segue como hoje. */
  | { tipo: 'livre' }
  /** Passa: os gastos que saem na linha e a nota dela ("(declarou: ...)", "(o mestre forçou: ...)"). */
  | { tipo: 'passa'; avaliacao: AvaliacaoDosRequisitos; gastos: readonly Gasto[]; nota: string | null }
  | { tipo: 'recusa'; motivo: string; avaliacao: AvaliacaoDosRequisitos | null }
  /** Só falta o aliado aceitar (G1, G2): a fase E cria a pendência; nada é gasto antes do aceite. */
  | { tipo: 'perguntaAoAliado'; motivo: string; pergunta: Extract<PerguntaDosRequisitos, { tipo: 'aliado' }>; avaliacao: AvaliacaoDosRequisitos }

const LIVRE: ResultadoDoPortao = { tipo: 'livre' }

function ehDosRequisitos(chave: string): boolean {
  return chave.startsWith(PREFIXO_DA_RESPOSTA)
}

/** Só as respostas dos requisitos (`req.*`); nenhuma = `undefined`. */
export function respostasDosRequisitos(respostas: RespostasDoPedido | undefined): RespostasDoPedido | undefined {
  if (respostas === undefined) return undefined
  const dos = Object.entries(respostas).filter(([chave]) => ehDosRequisitos(chave))
  return dos.length === 0 ? undefined : Object.fromEntries(dos)
}

/** As respostas sem as dos requisitos (as da mecânica conferem estas); nenhuma = `undefined`. */
export function respostasSemOsRequisitos(respostas: RespostasDoPedido | undefined): RespostasDoPedido | undefined {
  if (respostas === undefined) return undefined
  const resto = Object.entries(respostas).filter(([chave]) => !ehDosRequisitos(chave))
  return resto.length === 0 ? undefined : Object.fromEntries(resto)
}

function recusa(motivo: string, avaliacao: AvaliacaoDosRequisitos | null): ResultadoDoPortao {
  return { tipo: 'recusa', motivo, avaliacao }
}

function juntarNotas(notas: readonly (string | null)[]): string | null {
  const ficam = notas.filter((nota): nota is string => nota !== null && nota !== '')
  return ficam.length === 0 ? null : ficam.join(' ')
}

/** O mestre forçou: o que faltava vai à nota; as perguntas sem resposta também foram puladas. */
function forcado(av: AvaliacaoDosRequisitos): ResultadoDoPortao {
  const pulou = av.veredito !== 'cumpre'
  const nota = !pulou ? null : av.faltas.length > 0 ? fraseDoForcado(av.faltas) : '(o mestre forçou)'
  return { tipo: 'passa', avaliacao: av, gastos: av.gastos, nota: juntarNotas([nota, av.declarados.length > 0 ? fraseDoDeclarado(av.declarados) : null]) }
}

function daPergunta(pergunta: PerguntaDosRequisitos, av: AvaliacaoDosRequisitos): ResultadoDoPortao {
  switch (pergunta.tipo) {
    case 'aliado':
      return { tipo: 'perguntaAoAliado', motivo: MOTIVO_PEDE_AJUDA, pergunta, avaliacao: av }
    case 'mestre':
      return recusa(MOTIVO_ESPERA_O_MESTRE, av)
    case 'teste':
      return recusa(MOTIVO_DO_TESTE_DO_REQUISITO, av)
    case 'escolha':
    case 'caixa':
      return recusa(`Responda: ${pergunta.pergunta.texto}`, av)
  }
}

/**
 * O portão do host. `requisitos` = o campo do cartão como guardado (`undefined` = sem bloco);
 * `para` = usar (técnica, arma, item, ligar a forma) ou evoluir. `ctx` vem do montador com os alvos
 * do pedido.
 */
export function portaoDosRequisitos(requisitos: unknown, para: 'usar' | 'evoluir', ctx: ContextoDosRequisitos, pedido: PedidoNoPortao, autorEhMestre: boolean): ResultadoDoPortao {
  const doReq = respostasDosRequisitos(pedido.respostas)
  if (requisitos === undefined) return doReq === undefined ? LIVRE : recusa(MOTIVO_RESPOSTA_SEM_PERGUNTA, null)
  if (pedido.forcar === true && !autorEhMestre) return recusa(MOTIVO_SO_O_MESTRE_FORCA, null)
  const avaliacao = avaliarDoCartao(lerRequisitos(requisitos), para, ctx, { respostas: doReq, ...(pedido.ajudaDe === undefined ? {} : { ajudaDe: pedido.ajudaDe }) })
  if (avaliacao === null) return doReq === undefined ? LIVRE : recusa(MOTIVO_RESPOSTA_SEM_PERGUNTA, null)
  if (pedido.forcar === true) return forcado(avaliacao)
  if (avaliacao.veredito === 'falta') return recusa(avaliacao.motivo ?? 'Falta um requisito', avaliacao)
  // Toda caixa e toda escolha respondidas, e só elas (resposta sem pergunta = recusa).
  const dasRespostas = motivoDasRespostas(avaliacao.perguntasNaHora, doReq)
  const [primeira] = avaliacao.perguntas
  if (avaliacao.veredito === 'pergunta' && primeira !== undefined && primeira.tipo !== 'escolha' && primeira.tipo !== 'caixa') return daPergunta(primeira, avaliacao)
  if (dasRespostas !== null) return recusa(dasRespostas, avaliacao)
  if (avaliacao.veredito === 'pergunta' && primeira !== undefined) return daPergunta(primeira, avaliacao)
  return { tipo: 'passa', avaliacao, gastos: avaliacao.gastos, nota: avaliacao.declarados.length > 0 ? fraseDoDeclarado(avaliacao.declarados) : null }
}

/** O motivo da recusa do portão (o que `podeAgir` devolve); passa ou livre = `null`. */
export function motivoDoPortao(resultado: ResultadoDoPortao): string | null {
  return resultado.tipo === 'recusa' || resultado.tipo === 'perguntaAoAliado' ? resultado.motivo : null
}

/**
 * O cinza do MENU (antes da mira, sem respostas): só o que FALTA apaga; o que pergunta ou não se sabe
 * fica clicável ("o mestre confere"). Sem bloco ou sem retrato = `null`.
 */
export function motivoDosRequisitosNoMenu(requisitos: unknown, para: 'usar' | 'evoluir', ctx: ContextoDosRequisitos | undefined): string | null {
  if (requisitos === undefined || ctx === undefined) return null
  const avaliacao = avaliarDoCartao(lerRequisitos(requisitos), para, ctx)
  return avaliacao !== null && avaliacao.veredito === 'falta' ? (avaliacao.motivo ?? 'Falta um requisito') : null
}
