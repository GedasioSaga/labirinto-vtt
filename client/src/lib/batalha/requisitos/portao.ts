import { motivoDasRespostas, type RespostasDoPedido } from '../perguntaNaHora'
import { avaliarDoCartao, type AvaliacaoDosRequisitos, type Gasto, type PerguntaDosRequisitos } from './avaliar'
import type { ContextoDosRequisitos } from './contexto'
import { fraseDoAprovado, fraseDoDeclarado, fraseDoForcado } from './frases'
import { lerRequisitos, type RequisitosLidos } from './ler'
import { ehNaoLido, ehUmDestes, PREFIXO_DA_RESPOSTA, type RequisitoDo } from './modelo'

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
 *   prazo) é da fase E (`stores/batalha/ajuda.ts`): a store cria a pendência e, no aceite, roda o
 *   pedido de novo com `ajudaAceita`.
 *
 * Puro: sem store, sem rede, sem Pixi.
 */

export const MOTIVO_PEDE_AJUDA = 'Pede ajuda de um aliado: escolha a quem pedir'
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
  /** Fase E: o aliado escolhido aceitou (só o host põe, ao rodar o pedido congelado no aceite). */
  ajudaAceita?: boolean
  /** H1, H2 (fase D): os testes que o host rolou (id do requisito → passou). */
  testes?: Readonly<Record<string, boolean>>
  /** J2: o mestre aprovou (só o host põe, ao rodar o pedido congelado na aprovação). */
  mestreDeixou?: boolean
}

/** Um requisito que o host rola (H1 teste, H2 disputa). */
export type RequisitoDeTeste = RequisitoDo<'teste' | 'disputa'>

export type ResultadoDoPortao =
  /** O cartão não tem esse grupo: segue como hoje. */
  | { tipo: 'livre' }
  /** Passa: os gastos que saem na linha e a nota dela ("(declarou: ...)", "(o mestre forçou: ...)"). */
  | { tipo: 'passa'; avaliacao: AvaliacaoDosRequisitos; gastos: readonly Gasto[]; nota: string | null }
  | { tipo: 'recusa'; motivo: string; avaliacao: AvaliacaoDosRequisitos | null }
  /** Só falta o aliado aceitar (G1, G2): a fase E cria a pendência; nada é gasto antes do aceite. */
  | { tipo: 'perguntaAoAliado'; motivo: string; pergunta: Extract<PerguntaDosRequisitos, { tipo: 'aliado' }>; avaliacao: AvaliacaoDosRequisitos }
  /** J2: só falta o mestre aprovar. A store cria a pendência (a mesma rede da ajuda); nada é gasto antes. */
  | { tipo: 'perguntaAoMestre'; motivo: string; pergunta: Extract<PerguntaDosRequisitos, { tipo: 'mestre' }>; avaliacao: AvaliacaoDosRequisitos }
  /**
   * Fase D (H1, H2): só faltam os testes, que o HOST rola na hora do pedido. Quem não rola trata como
   * recusa (`motivoDoPortao` dá o motivo); quem rola chama de novo com `testes` e sai `passa` ou `recusa`.
   */
  | { tipo: 'teste'; motivo: string; testes: readonly RequisitoDeTeste[]; avaliacao: AvaliacaoDosRequisitos }

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
      return { tipo: 'perguntaAoMestre', motivo: MOTIVO_ESPERA_O_MESTRE, pergunta, avaliacao: av }
    case 'teste':
      return { tipo: 'teste', motivo: MOTIVO_DO_TESTE_DO_REQUISITO, testes: av.perguntas.flatMap((outra) => (outra.tipo === 'teste' ? [outra.requisito] : [])), avaliacao: av }
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
  const lidos = lerRequisitos(requisitos)
  const avaliacao = avaliarDoCartao(lidos, para, ctx, { respostas: doReq, ...(pedido.ajudaDe === undefined ? {} : { ajudaDe: pedido.ajudaDe }), ...(pedido.ajudaAceita === true ? { ajudaAceita: true } : {}), ...(pedido.testes === undefined ? {} : { testes: pedido.testes }), ...(pedido.mestreDeixou === true ? { mestreDeixou: true } : {}) })
  if (avaliacao === null) return doReq === undefined ? LIVRE : recusa(MOTIVO_RESPOSTA_SEM_PERGUNTA, null)
  if (pedido.forcar === true) return forcado(avaliacao)
  if (avaliacao.veredito === 'falta') return recusa(avaliacao.motivo ?? 'Falta um requisito', avaliacao)
  // Toda caixa e toda escolha respondidas, e só elas (resposta sem pergunta = recusa).
  const dasRespostas = motivoDasRespostas(avaliacao.perguntasNaHora, doReq)
  const [primeira] = avaliacao.perguntas
  // O teste (o último na ordem das perguntas) espera as respostas conferidas: o host só rola um pedido que já vale.
  if (avaliacao.veredito === 'pergunta' && primeira !== undefined && primeira.tipo !== 'escolha' && primeira.tipo !== 'caixa' && primeira.tipo !== 'teste') return daPergunta(primeira, avaliacao)
  if (dasRespostas !== null) return recusa(dasRespostas, avaliacao)
  if (avaliacao.veredito === 'pergunta' && primeira !== undefined) return daPergunta(primeira, avaliacao)
  const aprovados = pedido.mestreDeixou === true ? aprovadosPeloMestre(lidos, para, avaliacao) : []
  const nota = juntarNotas([avaliacao.declarados.length > 0 ? fraseDoDeclarado(avaliacao.declarados) : null, aprovados.length > 0 ? fraseDoAprovado(aprovados) : null])
  return { tipo: 'passa', avaliacao, gastos: avaliacao.gastos, nota }
}

/** J2: os "o mestre decide" do grupo que valeram neste pedido (a opção escolhida, no "Um destes"), para a nota da linha. */
function aprovadosPeloMestre(lidos: RequisitosLidos, para: 'usar' | 'evoluir', avaliacao: AvaliacaoDosRequisitos): RequisitoDo<'mestreDecide'>[] {
  const grupo = para === 'usar' ? lidos.bloco?.usar : lidos.bloco?.evoluir?.grupo
  const valeram = new Set<string>()
  for (const item of avaliacao.itens) {
    if (item.estado !== 'ok') continue
    if (item.tipo === 'requisito') valeram.add(item.id)
    else if (item.escolhida !== null) valeram.add(item.escolhida)
  }
  const aprovados: RequisitoDo<'mestreDecide'>[] = []
  for (const peca of grupo?.todos ?? []) {
    for (const opcao of ehUmDestes(peca) ? peca.umDestes : [peca]) {
      if (!ehNaoLido(opcao) && opcao.tipo === 'mestreDecide' && valeram.has(opcao.id)) aprovados.push(opcao)
    }
  }
  return aprovados
}

/** O motivo da recusa do portão (o que `podeAgir` devolve); passa ou livre = `null`. O teste não rolado recusa. */
export function motivoDoPortao(resultado: ResultadoDoPortao): string | null {
  return resultado.tipo === 'recusa' || resultado.tipo === 'perguntaAoAliado' || resultado.tipo === 'perguntaAoMestre' || resultado.tipo === 'teste' ? resultado.motivo : null
}

/** Fase D: os testes como se todos passassem (o host confere o resto do pedido ANTES de rolar o dado). */
export function testesQuePassam(testes: readonly RequisitoDeTeste[]): Record<string, boolean> {
  return Object.fromEntries(testes.map((teste) => [teste.id, true]))
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

/**
 * Fase E (decisão do dono, 23/11): no G1 que gasta, o aliado PAGA o custo da técnica; nada passa
 * para quem pede. O SP que o aliado paga sai do custo de quem pede (o Vagn fica com os 120 SP e o
 * aliado vai de 80 a 55). Vale quando o pedido já foi aceito (`passa` com o gasto do aliado) e ao
 * criar a pendência (`perguntaAoAliado`), para o custo de quem pede não recusar o pedido antes.
 */
export function spPagoPeloAliado(resultado: ResultadoDoPortao): number {
  if (resultado.tipo === 'passa') return resultado.gastos.reduce((soma, gasto) => (gasto.recurso === 'doAliado' && gasto.de === 'sp' ? soma + gasto.n : soma), 0)
  if (resultado.tipo !== 'perguntaAoAliado') return 0
  const { requisito } = resultado.pergunta
  return requisito.tipo === 'pedirAoAliado' && requisito.gasta === true && requisito.recurso === 'sp' ? requisito.n : 0
}
