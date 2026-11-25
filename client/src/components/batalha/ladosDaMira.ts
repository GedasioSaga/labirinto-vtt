import type { Direcao } from '../../lib/batalha/area'

/**
 * OS LADOS DA MIRA, em texto: o seletor da área, a frase do lado e a nota da área. Sem conta nenhuma,
 * para servir ao menu da vez (`MiraDoGolpe`) e à Mesa da batalha, que roda também na janela à parte: o
 * pacote dela não leva a regra da mira (a conta chega pronta no espelho). Conserto de 25/11/2026 do
 * levantamento das mecânicas duplicadas (item 16): a Mesa vira a forma com os mesmos lados do menu.
 */

/** Construtor C3: cada lado no seletor da área (o mapa visto de cima, como na tela), na ordem das setas do teclado. */
export const LADOS_DA_AREA: readonly { direcao: Direcao; seta: string; rotulo: string }[] = [
  { direcao: 'oeste', seta: '←', rotulo: 'Esquerda' },
  { direcao: 'norte', seta: '↑', rotulo: 'Cima' },
  { direcao: 'sul', seta: '↓', rotulo: 'Baixo' },
  { direcao: 'leste', seta: '→', rotulo: 'Direita' },
]

/** Fase E do alcance: para onde a forma olha, como a frase do protótipo diz. */
export const NOME_DO_LADO: Readonly<Record<Direcao, string>> = { norte: 'para cima', sul: 'para baixo', leste: 'para a direita', oeste: 'para a esquerda' }

/**
 * Construtor C3: a nota da área pela grade: quantas fichas ela pega daqui, e que dá para mudar.
 * Com a área vazia, a nota não convida a marcar à mão: vale nas três entradas, e no site o servidor recusa alvo de fora da área.
 */
export function textoDaAreaNaMira(naArea: number, comFrente: boolean): string {
  if (naArea === 0) return comFrente ? 'Ninguém na área deste lado. Vire a área para pegar alguém.' : 'Ninguém na área: todos os alvos estão fora da área.'
  return `A área pega ${naArea} ${naArea === 1 ? 'ficha' : 'fichas'}. Clique numa ficha para tirar ou pôr.`
}
