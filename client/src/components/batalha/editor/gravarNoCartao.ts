import { motivoDaArmaNasPecas } from '../../../lib/batalha/mecanica/arma'
import { lerMecanica, type MecanicaV1 } from '../../../lib/batalha/mecanica/modelo'
import { guardarMecanica, mesmaMecanica, problemaDaMecanica } from '../../../lib/batalha/mecanica/modelos'
import type { FichaDaPrevia } from '../../../lib/batalha/mecanica/resumo'
import { pecasDoEfeito } from '../../../lib/leituraDoItem'
import type { CartaoDaFicha } from '../../../lib/personagem'

/**
 * Onde o editor novo grava (ED3), com a regra de sempre: o MESTRE grava a
 * `mecanica`; o DONO, a `mecanicaProposta` (igual à que vale = proposta
 * nenhuma). Peça pela metade fica só no rascunho do editor: o cartão guarda a
 * última versão que vale.
 */
export type QuemEditaNoEditor = 'mestre' | 'dono'

/**
 * ED7: o que o editor monta. `tecnica` = a habilidade (todas as linhas); `arma` = o "O que ela faz" da
 * arma, que o Atacar executa só em parte (`motivoDaArmaNasPecas`); `item` = o efeito do item do Acervo.
 */
export type DoQueNoEditor = 'tecnica' | 'arma' | 'item'

type CampoDaMecanica = 'mecanica' | 'mecanicaProposta'

export function campoDeQuemEdita(quemEdita: QuemEditaNoEditor): CampoDaMecanica {
  return quemEdita === 'mestre' ? 'mecanica' : 'mecanicaProposta'
}

function semCampo(cartao: CartaoDaFicha, campo: CampoDaMecanica): CartaoDaFicha {
  const { [campo]: _fora, ...resto } = cartao
  return resto
}

/**
 * O que falta para a mecânica valer onde ela vai: o da técnica e, na arma, a peça que o Atacar não
 * executa (a mira só marca 1 ou vários alvos: alvo ou anel); no item, o efeito que passa do tamanho
 * que a vaga guarda. `null` = vale.
 */
export function problemaNoEditor(mecanica: MecanicaV1, ficha: FichaDaPrevia, doQue: DoQueNoEditor): string | null {
  const daTecnica = problemaDaMecanica(mecanica, ficha)
  if (daTecnica !== null) return daTecnica
  if (doQue === 'arma') return motivoDaArmaNasPecas(mecanica)
  if (doQue === 'item' && pecasDoEfeito(guardarMecanica(mecanica)) === null) return 'no item, o efeito passou do tamanho que a mochila guarda'
  return null
}

/** A mecânica que o editor abre: a proposta do dono (se for ele), senão a que vale; `null` = o cartão é só texto (ou a mecânica não se lê aqui). */
export function mecanicaQueAbre(cartao: CartaoDaFicha, quemEdita: QuemEditaNoEditor): MecanicaV1 | null {
  if (quemEdita === 'dono') {
    const proposta = lerMecanica(cartao.mecanicaProposta)
    if (proposta.tipo === 'pecas') return proposta.mecanica
  }
  const valendo = lerMecanica(cartao.mecanica)
  return valendo.tipo === 'pecas' ? valendo.mecanica : null
}

/**
 * O cartão com a mecânica do editor; `null` = não muda (a mecânica ainda tem
 * peça faltando, ou a arma não a executa). `mecanica: null` = sem mecânica
 * (o Ctrl+Z que volta ao texto, ou "Tirar" na arma e no item).
 */
export function cartaoComAMecanica(cartao: CartaoDaFicha, mecanica: MecanicaV1 | null, quemEdita: QuemEditaNoEditor, ficha: FichaDaPrevia, doQue: DoQueNoEditor = 'tecnica'): CartaoDaFicha | null {
  const campo = campoDeQuemEdita(quemEdita)
  if (mecanica === null) return semCampo(cartao, campo)
  if (problemaNoEditor(mecanica, ficha, doQue) !== null) return null
  const guardada = guardarMecanica(mecanica)
  if (quemEdita === 'dono') return mesmaMecanica(guardada, cartao.mecanica) ? semCampo(cartao, 'mecanicaProposta') : { ...cartao, mecanicaProposta: guardada }
  return { ...cartao, mecanica: guardada }
}

/** O cartão que o papel, o mapa e o Testar mostram: o rascunho completo no lugar da mecânica que vale. */
export function cartaoDaTela(cartao: CartaoDaFicha, mecanica: MecanicaV1 | null, ficha: FichaDaPrevia, doQue: DoQueNoEditor = 'tecnica'): CartaoDaFicha {
  if (mecanica === null || problemaNoEditor(mecanica, ficha, doQue) !== null) return cartao
  return { ...cartao, mecanica: guardarMecanica(mecanica) }
}
