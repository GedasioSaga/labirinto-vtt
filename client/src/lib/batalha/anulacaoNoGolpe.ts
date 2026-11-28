import type { Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { anulaAindaVale, anulaTudo, danoDepoisDoCorte, golpeAtravessa, lembradasComOUso, nomeDaExcecao, PORCENTO_QUE_ANULA, textoDoAnulado, textoDoAnuladoEmParte, textoDoLimiteDoAnula, type CorteDoAnula, type ExcecaoDoAnula, type OQueOGolpeTem, type RegraDoAnula } from './anulaODano'
import { pedidoDaMarca } from './comoMarca'
import { combateVazio, LEMBRADAS_MAX, type CombateDoPersonagem, type GolpeDaBatalha } from './combate'
import { regrasDoSelo } from './condicoes'
import { tentarSair, type SaidaPagando, type Tentativa } from './condicoesNaVez'
import { modificadorDoTeste } from './marca'
import { cartoesLigados } from './mecanicasAMao'
import { anulasDasPassivas } from './passivas'
import { numeroDoRecurso } from './recursosDaBatalha'
import type { ReducaoDoDano } from './reducaoDoDano'
import { bonusDaBatalha, selosDoToken } from './selos'
import type { TurnosDaCena } from './turnos'

/**
 * O GOLPE QUE NÃO TIRA NADA (pedidos do dono de 27/11/2026, "Intangível"): a função única do motor que
 * decide o "toma 0" das três fontes, antes do dano entrar na ficha. Na ordem, a primeira que vale ganha:
 *  1. um corte de 100% do dano que o alvo recebe (a Passiva de raça com 100%, um selo com −100%): de graça;
 *  2. a condição Intangível do alvo (a regra congelada do selo, ou a de fábrica pelo nome), a não ser que
 *     o golpe tenha a exceção dela;
 *  3. o "Ao ser atingido (antes do dano)" das passivas montadas do alvo: o limite (lembrado no combate), a
 *     exceção e o que paga e/ou testa, sozinho, pela regra da saída das condições (`tentarSair`: na "ou",
 *     quem tem o SP paga, quem não tem rola). O SP só é cobrado quando anula.
 * As fontes que não valeram deixam o motivo no registro ("Corpo de Fumaça não anulou: o golpe tem Haki").
 *
 * Puro: o d20 entra por parâmetro; quem chama grava o combate e cobra o SP (`acertoComMarca`, store do golpe).
 */

export interface PedidoDaAnulacao {
  turnos: TurnosDaCena
  golpe: Pick<GolpeDaBatalha, 'nome' | 'atacanteTokenId'> & Partial<Pick<GolpeDaBatalha, 'tipos'>>
  alvoTokenId: string
  /** A ficha de quem toma o golpe. */
  alvo: Personagem
  sistema: SistemaDeRpg
  /** A ficha de quem bate (as formas ligadas dele contam na exceção pelo nome); ausente = sem ficha. */
  atacante?: Personagem
  /** Os cortes do dano que o alvo recebe (a forma, a raça, a Determinação, os selos dele). */
  reducoes: readonly ReducaoDoDano[]
  /** O nome do alvo no registro. */
  nomeDoAlvo: string
  rolarD20: () => number
  /** O dano do golpe neste alvo agora (depois da marca): o corte em parte sai dele (pedido de 28/11/2026). */
  dano: number
}

export type AnulacaoNoGolpe =
  /**
   * Anulou: o texto do registro, o SP a cobrar do alvo (0 = nada), o combate dele com o uso contado (`null` =
   * não mudou) e o `dano` que sobra (0 = tudo; o corte em parte deixa o resto, que segue pelos cortes do dano).
   */
  | { anulou: true; texto: string; paga: number; combate: CombateDoPersonagem | null; dano: number }
  /** Nenhuma fonte valeu, e alguma tentou: o motivo, para o registro. */
  | { anulou: false; texto: string }

/** O que o golpe leva para as exceções: os tipos dele e os nomes da técnica, das condições e das formas ligadas de quem bate. */
function oQueOGolpeTem(pedido: PedidoDaAnulacao): OQueOGolpeTem {
  // A chave da forma ligada sem cartão (só o id) ou sem nome não tem o que comparar.
  const formas = pedido.atacante === undefined ? [] : cartoesLigados(pedido.atacante).flatMap((chave): string[] => (typeof chave === 'string' || chave.nome === undefined ? [] : [chave.nome]))
  const condicoes = selosDoToken(pedido.turnos.selos, pedido.golpe.atacanteTokenId).map((selo): string => selo.nome)
  return { tipos: pedido.golpe.tipos ?? [], nomes: [pedido.golpe.nome, ...condicoes, ...formas] }
}

function naoAnulouPorque(nome: string, exceto: ExcecaoDoAnula): string {
  return `${nome} não anulou: o golpe tem ${nomeDaExcecao(exceto)}`
}

/** O que a regra pede, na forma da saída paga das condições; `null` = de graça (sem SP e sem teste). */
function saidaDoAnula(regra: RegraDoAnula): SaidaPagando | null {
  const pedido = pedidoDaMarca(regra.paga, regra.teste, regra.como)
  if (pedido === 'nada') return null
  const como = pedido === 'soPaga' ? 'pagar' : pedido === 'soTeste' ? 'teste' : pedido
  return { tipo: 'pagar', como, paga: 'sp', v: regra.paga, ...(regra.teste === '' ? {} : { atr: regra.teste, cd: regra.cd }) }
}

/** "teste de 5 + 2 = 7 contra CD 12, não passou", "não tem 20 SP": por que a tentativa não anulou (sem cobrar). */
function motivoDaTentativa(tentativa: Tentativa): string {
  const { teste } = tentativa
  if (teste === null) return tentativa.texto
  return `teste ${teste.d20} ${teste.modificador < 0 ? '-' : '+'} ${Math.abs(teste.modificador)} = ${teste.total} contra CD ${teste.cd}, não passou`
}

/** O que o corte deixa do dano e a linha do registro: tudo = "Intangível: X tomou 0 de dano"; em parte = "X anulou 15 do dano (45 → 30)". */
function comOCorte(nomeDoAlvo: string, de: string, dano: number, corte: CorteDoAnula | undefined): { texto: string; dano: number } {
  if (anulaTudo(corte)) return { texto: textoDoAnulado(nomeDoAlvo, de), dano: 0 }
  const depois = danoDepoisDoCorte(dano, corte)
  return { texto: textoDoAnuladoEmParte(nomeDoAlvo, de, dano, depois), dano: depois }
}

/** O "toma 0" (ou o corte em parte) deste golpe neste alvo; `null` = nenhuma fonte (o dano segue como sempre). */
export function anulacaoNoGolpe(pedido: PedidoDaAnulacao): AnulacaoNoGolpe | null {
  const { turnos, alvo, sistema, nomeDoAlvo } = pedido
  const total = pedido.reducoes.find((reducao) => reducao.porcento >= PORCENTO_QUE_ANULA)
  if (total !== undefined) return { anulou: true, texto: textoDoAnulado(nomeDoAlvo, total.nome), paga: 0, combate: null, dano: 0 }
  const temOGolpe = oQueOGolpeTem(pedido)
  const motivos: string[] = []
  for (const selo of selosDoToken(turnos.selos, pedido.alvoTokenId)) {
    const anula = regrasDoSelo(selo)?.anula
    if (anula === undefined) continue
    if (anula.exceto === undefined || !golpeAtravessa(anula.exceto, temOGolpe)) return { anulou: true, paga: 0, combate: null, ...comOCorte(nomeDoAlvo, selo.nome, pedido.dano, anula.corte) }
    motivos.push(naoAnulouPorque(selo.nome, anula.exceto))
  }
  const combate = turnos.combate?.[alvo.id] ?? combateVazio()
  const lembradas = combate.lembradas ?? []
  for (const { nome, chave, regra } of anulasDasPassivas(alvo, sistema)) {
    if (!anulaAindaVale(lembradas, chave, regra, turnos.rodada)) {
      motivos.push(`${nome} já anulou ${textoDoLimiteDoAnula(regra)}`)
      continue
    }
    if (regra.exceto !== undefined && golpeAtravessa(regra.exceto, temOGolpe)) {
      motivos.push(naoAnulouPorque(nome, regra.exceto))
      continue
    }
    const saida = saidaDoAnula(regra)
    const recursos = { sp: numeroDoRecurso(alvo, sistema, 'sp'), vida: numeroDoRecurso(alvo, sistema, 'hp') }
    const rolar = (atributo: string): { d20: number; modificador: number } => ({ d20: pedido.rolarD20(), modificador: modificadorDoTeste(alvo, sistema, atributo, bonusDaBatalha(turnos.selos, pedido.alvoTokenId)) })
    const tentativa = saida === null ? null : tentarSair(saida, recursos, rolar)
    if (tentativa !== null && !tentativa.sai) {
      motivos.push(`${nome} não anulou: ${motivoDaTentativa(tentativa)}`)
      continue
    }
    const paga = tentativa?.paga?.recurso === 'sp' ? tentativa.paga.quanto : 0
    const comOUso = lembradasComOUso(lembradas, chave, regra, turnos.rodada)
    const depois: CombateDoPersonagem | null = comOUso === lembradas ? null : { ...combate, lembradas: comOUso.slice(-LEMBRADAS_MAX) }
    const cortado = comOCorte(nomeDoAlvo, nome, pedido.dano, regra.corte)
    return { anulou: true, texto: `${cortado.texto}${tentativa === null ? '' : ` (${tentativa.texto})`}`, paga, combate: depois, dano: cortado.dano }
  }
  return motivos.length === 0 ? null : { anulou: false, texto: motivos.join('; ') }
}
