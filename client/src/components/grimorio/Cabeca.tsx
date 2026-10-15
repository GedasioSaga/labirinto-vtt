import type { ReactNode } from 'react'
import { Tecla } from './Botao'
import './grimorio.css'

export interface CabecaProps {
  /** `CabecaRetrato` (token) ou `CabecaMedalha` (os outros tipos e a ferramenta). */
  marca: ReactNode
  nome: string
  tipo: string
  /** Onde o item está ("Armazém 3"); vem depois de " · " no tipo. */
  onde?: string
  /** Botões da direita: Apagar e Mais ações. */
  acoes?: ReactNode
  /** Tecla da ferramenta, no lugar das ações (ficha da ferramenta). */
  atalho?: string
}

/** Topo da ficha (o `.cabeca`): marca, nome em serifa, tipo e as ações. */
export function Cabeca({ marca, nome, tipo, onde, acoes, atalho }: CabecaProps) {
  return (
    <div className="gr-cabeca">
      {marca}
      <div>
        <div className="gr-cabeca__nome">{nome}</div>
        <div className="gr-cabeca__tipo">{onde ? `${tipo} · ${onde}` : tipo}</div>
      </div>
      {acoes && <div className="gr-cabeca__acoes">{acoes}</div>}
      {atalho && <Tecla>{atalho}</Tecla>}
    </div>
  )
}

/** Retrato redondo do token, na cor dele, com as iniciais. Decorativo: o nome está ao lado. */
export function CabecaRetrato({ cor, iniciais }: { cor: string; iniciais: string }) {
  return (
    <span className="gr-cabeca__retrato" style={{ background: cor }} aria-hidden="true">
      {iniciais}
    </span>
  )
}

/** Medalha de latão com o ícone do tipo. Decorativa: o nome está ao lado. */
export function CabecaMedalha({ children }: { children: ReactNode }) {
  return (
    <span className="gr-cabeca__med" aria-hidden="true">
      {children}
    </span>
  )
}
