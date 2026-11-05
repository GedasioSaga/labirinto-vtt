import { ITEM_QUANTIDADE_MAX } from '../items'
import { MOEDAS_MAX } from '../troca'
import { aplicarOp } from './aplicar'
import { alvoDoCaminho, segmentoValido } from './caminho'
import { ehRegistro, jsonIgual, proprio } from './json'
import { processarInversa, reenvio, resultadoSemOp, type LeitorDaCampanha, type ResultadoDoProcessamento, type SemOp } from './lote'
import { membroAtivo, podeDesfazer } from './permissao'
import type { Identidade, Mudanca, Op, OpGravada } from './tipos'

/**
 * DESFAZER (docs/planos/lobby-jogadores-2026-11-05.md §5.3). O servidor monta
 * a inversa SÓ a partir da `OpGravada` alvo — caminho e valor que vierem no
 * pedido são ignorados:
 *
 * - `definir` → definir o `antes` (ausente = tira a chave);
 * - `somar` → somar `-delta`, ou definir o `antes` se o teto cortou a soma;
 * - `criar` → `apagar`; `apagar` → `criar` com o `antes`;
 * - `ordenar` → a ordem de antes.
 *
 * A inversa usa `baseRev` = rev do alvo e passa pelo mesmo detector de
 * conflito: se alguém mudou o campo depois, vem "Depois disso, Fulano mudou
 * para Z. Confirmar?"; a confirmação (`confirmar`, com um `novoOpId` novo)
 * usa a rev de agora. Cada um desfaz o seu; o mestre desfaz qualquer um.
 * Desfazer o desfazer = refazer. Nada a fazer (já desfeita, já foi tirado, já
 * está assim) volta `nada-a-desfazer` e não grava nada.
 */

export interface PedidoDeDesfazer {
  /** A op que se quer desfazer. */
  opId: string
  /** O `opId` da inversa: o mesmo pedido de novo recebe a mesma resposta. */
  novoOpId: string
  confirmar: boolean
}

/** Corrente de desfazer o desfazer mais funda que isto é dado torto, não uso real. */
const PROFUNDIDADE_MAX = 64

function lerPedido(entrada: unknown): PedidoDeDesfazer | { erro: string; novoOpId: string | null } {
  if (!ehRegistro(entrada)) return { erro: 'Pedido fora do formato', novoOpId: null }
  const novoOpId = proprio(entrada, 'novoOpId')
  if (!segmentoValido(novoOpId)) return { erro: 'Pedido sem id', novoOpId: null }
  const opId = proprio(entrada, 'opId')
  const confirmar = proprio(entrada, 'confirmar')
  if (!segmentoValido(opId) || (confirmar !== undefined && confirmar !== true)) return { erro: 'Pedido fora do formato', novoOpId }
  return { opId, novoOpId, confirmar: confirmar === true }
}

/** A soma bateu no teto (pilha 9999, moedas 999.999): voltar somando o contrário daria outro número. */
function somaCortadaPeloTeto(alvo: OpGravada, delta: number): boolean {
  const regra = alvoDoCaminho(alvo.caminho)?.regra
  if (regra !== 'quantidade' && regra !== 'moedas') return false
  const teto = regra === 'quantidade' ? ITEM_QUANTIDADE_MAX : MOEDAS_MAX
  // Ausente vale 1 na pilha e 0 nas moedas (`quantidadeDe`, `Personagem.moedas`).
  const ausente = regra === 'quantidade' ? 1 : 0
  const antes = typeof alvo.antes === 'number' ? alvo.antes : ausente
  return antes + delta > teto
}

function definirAntes(alvo: OpGravada): Mudanca {
  const { fichaId, caminho, antes } = alvo
  return antes === undefined ? { fichaId, caminho, acao: 'definir' } : { fichaId, caminho, acao: 'definir', valor: antes }
}

/**
 * A volta da op gravada, só por ela. `null` = a op não mudou nada (criar o
 * que já existia, apagar o que já tinha saído): não há o que desfazer.
 */
export function mudancaInversa(alvo: OpGravada): Mudanca | null {
  const { fichaId, caminho, antes } = alvo
  switch (alvo.acao) {
    case 'definir':
      return definirAntes(alvo)
    case 'somar':
      if (alvo.delta === undefined) return null
      return somaCortadaPeloTeto(alvo, alvo.delta) ? definirAntes(alvo) : { fichaId, caminho, acao: 'somar', delta: -alvo.delta }
    case 'criar':
      // Com `antes`, o criar foi eco: a coisa já existia e continua de quem a criou.
      return antes === undefined ? { fichaId, caminho, acao: 'apagar' } : null
    case 'apagar':
      return antes === undefined ? null : { fichaId, caminho, acao: 'criar', valor: antes }
    case 'ordenar':
      return antes === undefined ? null : { fichaId, caminho, acao: 'ordenar', valor: antes }
  }
}

/**
 * A op está desfeita agora: alguma op a desfaz e essa não foi desfeita
 * também (desfazer o desfazer = refazer, e a op volta a valer).
 */
export function estaDesfeita(leitor: Pick<LeitorDaCampanha, 'desfeitasDe'>, op: Pick<OpGravada, 'opId'>, profundidade = 0): boolean {
  if (profundidade > PROFUNDIDADE_MAX) return false
  return leitor.desfeitasDe(op.opId).some((desfez) => !estaDesfeita(leitor, desfez, profundidade + 1))
}

function nadaADesfazer(novoOpId: string, detalhe: string): SemOp {
  return { t: 'negar', opId: novoOpId, motivo: 'nada-a-desfazer', detalhe }
}

/** O pedido de desfazer, antes de virar op: quem pede, o alvo, se já foi desfeita, se ainda há o que fazer. */
function inversaOuRecusa(leitor: LeitorDaCampanha, quem: Identidade, pedido: PedidoDeDesfazer, agora: number): Op | SemOp {
  const { novoOpId } = pedido
  const membro = leitor.membro(quem.contaId)
  if (!membroAtivo(membro)) return { t: 'negar', opId: novoOpId, motivo: 'sem-permissao', detalhe: 'Você não está nesta campanha' }
  const repetido = reenvio(leitor.opGravada(novoOpId), leitor.recusada(novoOpId), membro.contaId)
  if (repetido.t === 'dada') return repetido
  if (repetido.t === 'alheia') return { t: 'negar', opId: novoOpId, motivo: 'sem-permissao', detalhe: 'Este id de mudança é de outra pessoa' }
  const alvo = leitor.opGravada(pedido.opId)
  // Op que não existe e op que ele não pode desfazer têm a mesma resposta: não revela nada da alheia.
  if (alvo === undefined) return { t: 'negar', opId: novoOpId, motivo: 'sem-permissao', detalhe: 'Mudança não encontrada' }
  const ficha = leitor.ficha(alvo.fichaId)
  const permissao = podeDesfazer(membro, ficha, alvo)
  if (!permissao.ok) return { t: 'negar', opId: novoOpId, motivo: permissao.motivo, detalhe: permissao.detalhe }
  if (estaDesfeita(leitor, alvo)) return nadaADesfazer(novoOpId, 'Essa mudança já foi desfeita')
  const inversa = mudancaInversa(alvo)
  if (inversa === null) return nadaADesfazer(novoOpId, 'Essa mudança não mudou nada')
  if (ficha !== undefined && !ficha.apagada) {
    const ensaio = aplicarOp(ficha.doc, inversa)
    if (!ensaio.ok && ensaio.motivo === 'alvo-inexistente') return nadaADesfazer(novoOpId, 'Já foi tirado')
    if (ensaio.ok && (ensaio.semEfeito === true || jsonIgual(ensaio.antes, ensaio.depois))) return nadaADesfazer(novoOpId, 'Já está como estava antes')
  }
  return {
    ...inversa,
    opId: novoOpId,
    loteId: novoOpId,
    baseRev: pedido.confirmar ? leitor.revAtual() : alvo.rev,
    clienteId: quem.clienteId,
    quandoCliente: agora,
    desfaz: alvo.opId,
  }
}

function ehSemOp(valor: Op | SemOp): valor is SemOp {
  return 't' in valor
}

/**
 * O pedido `desfazer{opId, novoOpId, confirmar?}` (§5.4). Devolve o mesmo
 * resultado de `processarLote`, com uma resposta para `novoOpId`: `ack`,
 * `conflito` (alguém mudou depois: pedir a confirmação), `negado`
 * (`sem-permissao` ou `nada-a-desfazer`) ou `adiado`.
 */
export function processarDesfazer(leitor: LeitorDaCampanha, quem: Identidade, entrada: unknown, agora: number): ResultadoDoProcessamento {
  const pedido = lerPedido(entrada)
  if ('erro' in pedido) {
    const saida: SemOp = pedido.novoOpId === null ? { t: 'malformado' } : { t: 'negar', opId: pedido.novoOpId, motivo: 'fora-do-esquema', detalhe: pedido.erro }
    return resultadoSemOp(leitor, quem, saida, agora)
  }
  const inversa = inversaOuRecusa(leitor, quem, pedido, agora)
  return ehSemOp(inversa) ? resultadoSemOp(leitor, quem, inversa, agora) : processarInversa(leitor, quem, inversa, agora)
}
