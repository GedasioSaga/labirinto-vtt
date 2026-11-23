import { lerMecanica, type MecanicaV1 } from '../../../lib/batalha/mecanica/modelo'
import { guardarMecanica, mesmaMecanica, problemaDaMecanica } from '../../../lib/batalha/mecanica/modelos'
import type { FichaDaPrevia } from '../../../lib/batalha/mecanica/resumo'
import type { CartaoDaFicha } from '../../../lib/personagem'

/**
 * Onde o editor novo grava (ED3), com a mesma regra da fachada
 * `MecanicaDaTecnica`: o MESTRE grava a `mecanica`; o DONO, a
 * `mecanicaProposta` (igual à que vale = proposta nenhuma). Peça pela metade
 * fica só no rascunho do editor: o cartão guarda a última versão que vale.
 */
export type QuemEditaNoEditor = 'mestre' | 'dono'

type CampoDaMecanica = 'mecanica' | 'mecanicaProposta'

export function campoDeQuemEdita(quemEdita: QuemEditaNoEditor): CampoDaMecanica {
  return quemEdita === 'mestre' ? 'mecanica' : 'mecanicaProposta'
}

function semCampo(cartao: CartaoDaFicha, campo: CampoDaMecanica): CartaoDaFicha {
  const { [campo]: _fora, ...resto } = cartao
  return resto
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
 * peça faltando). `mecanica: null` = sem mecânica (o Ctrl+Z que volta ao texto).
 */
export function cartaoComAMecanica(cartao: CartaoDaFicha, mecanica: MecanicaV1 | null, quemEdita: QuemEditaNoEditor, ficha: FichaDaPrevia): CartaoDaFicha | null {
  const campo = campoDeQuemEdita(quemEdita)
  if (mecanica === null) return semCampo(cartao, campo)
  if (problemaDaMecanica(mecanica, ficha) !== null) return null
  const guardada = guardarMecanica(mecanica)
  if (quemEdita === 'dono') return mesmaMecanica(guardada, cartao.mecanica) ? semCampo(cartao, 'mecanicaProposta') : { ...cartao, mecanicaProposta: guardada }
  return { ...cartao, mecanica: guardada }
}

/** O cartão que o papel, o mapa e o Testar mostram: o rascunho completo no lugar da mecânica que vale. */
export function cartaoDaTela(cartao: CartaoDaFicha, mecanica: MecanicaV1 | null, ficha: FichaDaPrevia): CartaoDaFicha {
  if (mecanica === null || problemaDaMecanica(mecanica, ficha) !== null) return cartao
  return { ...cartao, mecanica: guardarMecanica(mecanica) }
}
