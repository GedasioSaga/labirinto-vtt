import type { MotorDoSistema, SistemaDeRpg } from './sistemaDeRpg'

/**
 * MOTOR POR SISTEMA (plano docs/planos/sistema-dragon-ball.md, item 1): o
 * ponto único que diz qual motor de regras roda um sistema. Todo lugar que
 * monta ficha, batalha, mundo do livro, comparar ou arena pergunta aqui e
 * escolhe a versão; o ramo `padrao` é o código de sempre, intocado.
 */

export const MOTOR_PADRAO: MotorDoSistema = 'padrao'
export const MOTOR_DRAGON_BALL: MotorDoSistema = 'dragon-ball-tales'

/** Quem tem motor: o sistema e o rascunho do editor (`RascunhoDoSistema.motor`). */
type ComMotor = Pick<SistemaDeRpg, 'motor'>

/** O motor do sistema; sem sistema (aventura sem sistema, sistema fora da biblioteca) é o padrão. */
export function motorDoSistema(sistema: ComMotor | null | undefined): MotorDoSistema {
  return sistema?.motor ?? MOTOR_PADRAO
}

/**
 * O editor de sistema só sabe mudar o motor padrão: os outros leem atributos,
 * recursos e regras por id fixo, e uma cópia editada quebraria calada. Esses
 * só se duplicam.
 */
export function editavelNoEditor(sistema: ComMotor | null | undefined): boolean {
  return motorDoSistema(sistema) === MOTOR_PADRAO
}

/** O nome do motor para a pessoa ler ("as regras do Dragon Ball Tales"). */
export function nomeDoMotor(motor: MotorDoSistema): string {
  return motor === 'dragon-ball-tales' ? 'Dragon Ball Tales' : 'padrão'
}
