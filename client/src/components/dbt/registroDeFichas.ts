import { createElement, lazy, Suspense, type ComponentType } from 'react'
import { motorDoSistema } from '../../lib/motores'
import type { MotorDoSistema, SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { FichaDePersonagem, type FichaDePersonagemProps } from '../FichaDePersonagem'

/**
 * REGISTRO DE FICHAS (plano docs/planos/sistema-dragon-ball.md, item 7): o
 * ponto único que diz qual ficha desenha o personagem de um sistema. Toda
 * ficha tem a MESMA interface (`FichaDePersonagemProps`), então quem hospeda
 * (a janela do mestre, a do jogador, o perfil da carta na batalha) só troca
 * o componente. O motor padrão é a ficha de sempre, intocada.
 */

/** A ficha Dragon Ball só baixa quando um sistema dela abre: a mesa de One Piece nunca carrega o código. */
const FichaDBTPreguicosa = lazy(() => import('./ficha/FichaDBT').then((modulo) => ({ default: modulo.FichaDBT })))

/** O carregamento leva um instante na primeira vez; a ficha aparece no lugar do aviso. */
function FichaDBTComEspera(props: FichaDePersonagemProps) {
  return createElement(Suspense, { fallback: createElement('p', { className: 'lb-field__hint', 'aria-busy': true }, 'Abrindo a ficha…') }, createElement(FichaDBTPreguicosa, props))
}

const FICHA_DO_MOTOR: Readonly<Record<MotorDoSistema, ComponentType<FichaDePersonagemProps>>> = {
  padrao: FichaDePersonagem,
  'dragon-ball-tales': FichaDBTComEspera,
}

/** A ficha do sistema. Sempre a mesma referência por motor: a ficha aberta não remonta a cada desenho. */
export function fichaDoSistema(sistema: SistemaDeRpg): ComponentType<FichaDePersonagemProps> {
  return FICHA_DO_MOTOR[motorDoSistema(sistema)]
}

/** O que os hospedeiros montam no lugar de `FichaDePersonagem`: as mesmas props, a ficha do motor do `sistema`. */
export function FichaDoSistema(props: FichaDePersonagemProps) {
  return createElement(fichaDoSistema(props.sistema), props)
}
