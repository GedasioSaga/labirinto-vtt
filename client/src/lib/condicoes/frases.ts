import type { RegraDaCondicao } from '../../types/map'
import { N_DA_CURA_MAX, N_DA_VIDA_MAX } from '../condicoesProprias'
import type { CondicaoNaFicha } from '../itens/modelo'
import type { CondicaoDoCatalogo } from './catalogo'
import { duracaoDe, type DuracaoDaCondicao } from './naFicha'

/**
 * AS FRASES DAS CONDIÇÕES (sistema de itens refeito, etapa E4b): o que o mestre lê no "Pôr
 * condição", nos chips da ficha e na tela Condições. Um lugar só, para o menu do token, o painel
 * da ficha e a página do livro dizerem a mesma coisa. Puro: sem store, sem React.
 */

/** As durações que o "Pôr condição" oferece, na ordem do protótipo aprovado. */
export const OPCOES_DE_DURACAO: readonly { valor: string; texto: string }[] = [
  { valor: '1', texto: '1 turno' },
  { valor: '2', texto: '2 turnos' },
  { valor: '3', texto: '3 turnos' },
  { valor: '5', texto: '5 turnos' },
  { valor: 'fim', texto: 'até o fim da batalha' },
  { valor: 'tirar', texto: 'até alguém tirar' },
]

/** A duração de uma opção do `<select>`; `null` = valor que o formulário não oferece. */
export function duracaoDaOpcao(valor: string): DuracaoDaCondicao | null {
  if (valor === 'fim' || valor === 'tirar') return valor
  const turnos = Number.parseInt(valor, 10)
  return Number.isInteger(turnos) && turnos >= 1 ? turnos : null
}

/** "1 turno", "3 turnos", "até o fim da batalha", "até alguém tirar". */
export function fraseDaDuracao(duracao: DuracaoDaCondicao): string {
  if (duracao === 'fim') return 'até o fim da batalha'
  if (duracao === 'tirar') return 'até alguém tirar'
  return duracao === 1 ? '1 turno' : `${duracao} turnos`
}

/** O prazo da condição posta, como o chip mostra ("faltam 2 turnos"). */
export function fraseDoPrazo(condicao: CondicaoNaFicha): string {
  const duracao = duracaoDe(condicao)
  if (typeof duracao !== 'number') return fraseDaDuracao(duracao)
  return duracao === 1 ? 'falta 1 turno' : `faltam ${duracao} turnos`
}

/** O número da regra que vale na condição posta: o próprio dela, senão o do catálogo. */
export function numeroQueVale(condicao: Pick<CondicaoNaFicha, 'n'>, doCatalogo: Pick<CondicaoDoCatalogo, 'n'>): number {
  return condicao.n ?? doCatalogo.n
}

/** O que a regra faz, em frase: "tira 3 de vida no começo da vez", "corta 50% da cura", "o mestre narra". */
export function fraseDaRegra(regra: RegraDaCondicao, n: number): string {
  if (regra === 'vida') return `tira ${n} de vida no começo da vez`
  if (regra === 'cura') return `corta ${n}% da cura`
  return 'o mestre narra'
}

/** O rótulo do campo do número da regra; `null` = a regra não tem número (narra). */
export function rotuloDoNumero(regra: RegraDaCondicao): string | null {
  if (regra === 'vida') return 'Vida por vez'
  if (regra === 'cura') return 'Quanto a cura cai (%)'
  return null
}

/** O teto do número da regra (o mesmo do leitor da condição criada). */
export function tetoDoNumero(regra: RegraDaCondicao): number {
  return regra === 'cura' ? N_DA_CURA_MAX : N_DA_VIDA_MAX
}

/** Os nomes das regras, para o seletor da tela Condições. */
export const NOMES_DAS_REGRAS: Record<RegraDaCondicao, string> = {
  vida: 'Tira vida',
  cura: 'Corta a cura',
  narra: 'O mestre narra',
}
