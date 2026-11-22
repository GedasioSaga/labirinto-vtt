/**
 * A descrição diz um EFEITO com número ("Cura 50 HP", "causa 30 de dano",
 * "recupera 20 de SP")? Regra do dono ("não posso ter nada que um lugar diz
 * uma coisa e em outro diz outra"): no item com efeito, essa descrição é a
 * versão velha do que a frase do efeito diz. Só número junto de verbo ou de
 * recurso de jogo: a descrição de cor ("uma garrafa verde") não conta. Puro e
 * sem dependência (vai ao app do jogador e ao site, no InventarioDaFicha).
 */
const EFEITO_COM_NUMERO: readonly RegExp[] = [
  /\b(cura|curam|recupera|restaura|regenera|causa|ganha|devolve)\b[^.;]{0,24}\d/,
  /\d+\s*%?\s*(de\s+)?(hp|sp|pv|pm|vida|dano|escudo|mana|energia)\b/,
]

/** Tira os acentos e põe em minúsculas, para as pistas acima. */
function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function descricaoDizOEfeito(descricao: string | undefined): boolean {
  if (descricao === undefined) return false
  const texto = semAcento(descricao)
  return EFEITO_COM_NUMERO.some((padrao) => padrao.test(texto))
}
