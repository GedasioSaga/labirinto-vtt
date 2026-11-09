import { useEffect, useMemo } from 'react'
import { compararTitulos } from '../../lib/preparo/enciclopedia'
import { useContasStore } from '../../stores/contasStore'

/**
 * OS JOGADORES A QUEM SE REVELA: as contas do app (Contas dos jogadores, na
 * aba Jogo). O id da conta é o mesmo que o Lobby conhece (`membrosDasContas`),
 * e é por ele que "revelado a fulano" vai valer no site (F5). Daqui só se lê.
 */

export interface ContaDoJogo {
  readonly id: string
  readonly nome: string
}

/** As contas em ordem de nome; lê o arquivo de contas na primeira vez. */
export function useContasDoJogo(): readonly ContaDoJogo[] {
  const arquivo = useContasStore((estado) => estado.arquivo)
  const carregar = useContasStore((estado) => estado.carregar)
  useEffect(() => {
    void carregar()
  }, [carregar])
  return useMemo(() => arquivo.contas.map(({ id, nome }) => ({ id, nome })).sort((a, b) => compararTitulos(a.nome, b.nome)), [arquivo])
}
