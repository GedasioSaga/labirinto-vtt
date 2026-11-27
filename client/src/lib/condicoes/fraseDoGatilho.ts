import type { GatilhoDaCondicao, PecaDoGatilho } from '../itens/modelo'

/**
 * O GATILHO EM PALAVRAS (pedido de 26/11), separado da conta (`gatilho.ts`): o editor do item e o
 * resumo dele leem só as frases, sem puxar o catálogo de condições (sem ciclo de import).
 */

function textoDaDuracaoDaPeca(duracao: Extract<PecaDoGatilho, { tipo: 'condicao' }>['duracao']): string {
  if (duracao === 'fim') return 'até o fim da batalha'
  return duracao === 1 ? 'por 1 turno' : `por ${duracao} turnos`
}

/** Uma peça em palavras: "Atordoado por 1 turno", "30 de dano", "cura 20", "tira Lento". */
export function fraseDaPecaDoGatilho(peca: PecaDoGatilho): string {
  switch (peca.tipo) {
    case 'condicao':
      return `${peca.nome}${peca.n === undefined ? '' : ` (${peca.n})`} ${textoDaDuracaoDaPeca(peca.duracao)}`
    case 'dano':
      return `${peca.valor} de dano`
    case 'curar':
      return `cura ${peca.fixo}`
    case 'tirar':
      return peca.nome === null ? 'tira as outras condições' : `tira ${peca.nome}`
  }
}

/** O gatilho em palavras: "depois de 3 turnos: Atordoado por 1 turno, e some" / "a cada 2 turnos: 30 de dano". */
export function fraseDoGatilho(gatilho: GatilhoDaCondicao): string {
  const quando = gatilho.vezes === 'cada' ? `a cada ${gatilho.turnos === 1 ? 'turno' : `${gatilho.turnos} turnos`}` : `depois de ${gatilho.turnos === 1 ? '1 turno' : `${gatilho.turnos} turnos`}`
  return `${quando}: ${gatilho.pecas.map(fraseDaPecaDoGatilho).join(', ')}${gatilho.aoDisparar === 'some' ? ', e some' : ''}`
}
