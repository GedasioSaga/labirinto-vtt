import { createContext, useContext } from 'react'

/**
 * A página do livro da mesa está à vista? As páginas ficam todas montadas: a
 * que não é a aberta fica com `hidden`, e todas ficam `inert` com o livro
 * recolhido. Quem arma um modo que espera o mestre (o "clicar no token no
 * mapa" do Grupo) lê daqui para desarmar quando a página some: escondido, o
 * modo continuaria ligado sem ninguém ver.
 *
 * Fora do livro (um painel solto, um teste) vale `true`.
 */
const PaginaAVista = createContext(true)

export const PaginaAVistaProvider = PaginaAVista.Provider

export function usePaginaAVista(): boolean {
  return useContext(PaginaAVista)
}
