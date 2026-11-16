import type { DesfechoDoObjetoNoJogador } from './JogoDeAbrirOverlay'

/** Textos do cartão de resultado e do leitor de tela. Funções puras (o teste lê daqui). */

const QUEM: Readonly<Record<'cobra' | 'aranha', string>> = { cobra: 'A cobra', aranha: 'A aranha' }

/** "A cobra picou: -8 PV. Envenenado por 3 turnos." ou null sem armadilha. */
export function linhaDaArmadilha(d: Pick<DesfechoDoObjetoNoJogador, 'armadilha' | 'dano' | 'efeito' | 'turnos'>): string | null {
  if (d.armadilha === null) return null
  const quem = QUEM[d.armadilha]
  const partes = [d.dano > 0 ? `${quem} picou: -${d.dano} PV.` : `${quem} pulou, mas não picou.`]
  if (d.efeito !== null && d.turnos > 0) partes.push(`${d.efeito} por ${d.turnos} ${d.turnos === 1 ? 'turno' : 'turnos'}.`)
  return partes.join(' ')
}

export function textoDasMoedas(n: number): string {
  return `${n} ${n === 1 ? 'moeda' : 'moedas'}`
}

/** O que a pessoa achou, numa frase só (leitor de tela). */
export function resumoDoAchado(d: Pick<DesfechoDoObjetoNoJogador, 'itens' | 'moedas'>): string {
  const partes = d.itens.map((i) => (i.quantidade > 1 ? `${i.nome} (${i.quantidade})` : i.nome))
  if (d.moedas > 0) partes.push(textoDasMoedas(d.moedas))
  return partes.length === 0 ? 'Estava vazio.' : `Achou: ${partes.join(', ')}.`
}

/** O que o leitor de tela fala quando o bicho aparece (o mesmo da vitrine aprovada). */
export const FRASE_DO_SUSTO: Readonly<Record<'cobra' | 'aranha', string>> = {
  cobra: 'Uma cobra saltou lá de dentro!',
  aranha: 'Tinha uma aranha lá dentro.',
}
