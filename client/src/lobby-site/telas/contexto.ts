import { createContext, useContext, useLayoutEffect, useState } from 'react'
import { useStore } from 'zustand'
import type { EstadoDoSite, Site } from '../dados/lobbyStore'
import type { FonteDaDemo } from '../dados/fonteDemo'
import type { Rota } from '../dados/rotas'
import type { EstadoDaCampanha } from '../dados/sessaoDaCampanha'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { SISTEMA_ONE_PIECE } from '../../lib/sistemaOnePiece'

/**
 * O site (a camada de dados da S2) para as telas: cada tela lê o pedaço do
 * store que usa (`useDoSite`) e age pela sessão da campanha aberta.
 */
export const SiteContexto = createContext<Site | null>(null)

export function useSite(): Site {
  const site = useContext(SiteContexto)
  if (site === null) throw new Error('tela do Lobby fora do <SiteContexto>')
  return site
}

export function useDoSite<T>(seletor: (estado: EstadoDoSite) => T): T {
  return useStore(useSite().store, seletor)
}

function ehFonteDaDemo(fonte: Site['fonte']): fonte is FonteDaDemo {
  return fonte.demo && 'simularMudancaDoMestre' in fonte && typeof fonte.simularMudancaDoMestre === 'function'
}

/** A fonte demo, quando é ela (o botão de dev "simular mestre mudou" só existe nela). */
export function fonteDaDemo(site: Site): FonteDaDemo | null {
  return ehFonteDaDemo(site.fonte) ? site.fonte : null
}

/** Navegar sem recarregar; Ctrl/Cmd/Shift/meio abrem em outra aba, como qualquer link. */
export function aoClicarNoLink(site: Site, rota: Rota) {
  return (evento: { button: number; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean; preventDefault(): void }) => {
    if (evento.button !== 0 || evento.ctrlKey || evento.metaKey || evento.shiftKey || evento.altKey) return
    evento.preventDefault()
    site.irPara(rota)
  }
}

/** A hora de agora, andando de minuto em minuto: o "há 6 min" do histórico não fica parado. */
export function useAgora(passoMs = 30_000): number {
  const [agora, setAgora] = useState(() => Date.now())
  // Antes de pintar: quando o passo muda (o chat passa de minuto em minuto para segundo em segundo), a hora do
  // passo antigo pode ter quase um minuto, e a tela mostraria "vai sozinha em 26 s" por um quadro.
  useLayoutEffect(() => {
    setAgora(Date.now())
    const id = setInterval(() => setAgora(Date.now()), passoMs)
    return () => clearInterval(id)
  }, [passoMs])
  return agora
}

/**
 * O sistema quando o `estado` não traz o da campanha (DO de antes da F1, ou um
 * sistema que este site não lê): a v1 do Lobby é da mesa de One Piece.
 */
export const SISTEMA_DE_RECUO: SistemaDeRpg = SISTEMA_ONE_PIECE

/** O sistema das fichas de uma campanha: o que o mestre publicou (o `estado` traz); sem ele, o de recuo. */
export function sistemaDaCampanha(campanha: Pick<EstadoDaCampanha, 'sistema'> | null): SistemaDeRpg {
  if (campanha === null || campanha.sistema === null) return SISTEMA_DE_RECUO
  return campanha.sistema
}

/** O sistema da campanha aberta no site, para as telas: rótulos, abas, recursos e atributos. */
export function useSistemaDoLobby(): SistemaDeRpg {
  return useDoSite((estado) => sistemaDaCampanha(estado.campanha))
}
