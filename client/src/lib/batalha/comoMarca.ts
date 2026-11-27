/**
 * COMO SE PAGA A MARCA (pedido do dono de 27/11/2026: "para marcar paga x e/ou passa num teste de
 * percepção"): a regra única de o que a pergunta "Marcar?" pede. Uma coisa, um lugar: a peça Marca do
 * editor (o seletor entre o custo e o teste), a leitura do motor (as opções do "Marcar?" da técnica) e o
 * lembrete da passiva de marca (os botões Pagar / Teste) leem daqui.
 *
 * Puro e sem import: entra em qualquer camada sem fechar ciclo.
 */

/** 'e' = paga o SP E passa no teste; 'ou' = um dos dois, à escolha de quem marca, na hora. */
export type ComoPagaAMarca = 'e' | 'ou'

/** O que a marca pede de fato: os dois juntos, um dos dois, só o SP, só o teste, ou nada. */
export type PedidoDaMarca = 'e' | 'ou' | 'soPaga' | 'soTeste' | 'nada'

/** A peça e a leitura antigas, sem o campo: 'e', como sempre foi. */
export const COMO_PAGA_PADRAO: ComoPagaAMarca = 'e'

/**
 * O que a marca pede, pelo SP (`paga` > 0), pelo teste (`teste` não vazio) e pelo `como`. Com um dos
 * dois vazio o `como` não conta: "só paga" ou "só teste".
 */
export function pedidoDaMarca(paga: number | null, teste: string | null, como: ComoPagaAMarca | undefined): PedidoDaMarca {
  const comSp = paga !== null && paga > 0
  const comTeste = teste !== null && teste !== ''
  if (comSp && comTeste) return (como ?? COMO_PAGA_PADRAO) === 'ou' ? 'ou' : 'e'
  if (comSp) return 'soPaga'
  if (comTeste) return 'soTeste'
  return 'nada'
}

/** "30 SP e teste de Percepção", "30 SP ou teste de Percepção", "30 SP", "teste de Percepção", '' (nada). */
export function textoDoPedidoDaMarca(pedido: PedidoDaMarca, sp: string, teste: string): string {
  switch (pedido) {
    case 'e':
      return `${sp} e ${teste}`
    case 'ou':
      return `${sp} ou ${teste}`
    case 'soPaga':
      return sp
    case 'soTeste':
      return teste
    case 'nada':
      return ''
  }
}

/** O SP se paga nesta resposta? 'sp' = pagou; 'teste' = passou no teste. Na 'ou', o teste não paga; na 'e', passar também paga. */
export function pagaNaResposta(pedido: PedidoDaMarca, resposta: 'sp' | 'teste'): boolean {
  if (pedido === 'soPaga' || pedido === 'e') return true
  return pedido === 'ou' && resposta === 'sp'
}
