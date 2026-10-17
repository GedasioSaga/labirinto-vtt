import { useState, type ReactNode } from 'react'
import { Ficha } from '../grimorio/Ficha'
import { IconeDoLivro, type NomeDoIcone } from './icones'

/** localStorage pode faltar ou lançar (janela privada): sem escolha gravada vale a do protótipo. */
function lerAberta(chave: string, padrao: boolean): boolean {
  try {
    const gravada = window.localStorage.getItem(chave)
    return gravada === null ? padrao : gravada === '1'
  } catch {
    return padrao
  }
}

function gravarAberta(chave: string, aberta: boolean): void {
  try {
    window.localStorage.setItem(chave, aberta ? '1' : '0')
  } catch {
    // Sem armazenamento a escolha vale enquanto a ficha estiver montada.
  }
}

export interface FichaLembradaProps {
  /** Começo da chave lembrada, da família `lb-section:<id>` das seções recolhíveis ("lb-section:ficha-token-"). */
  prefixo: string
  id: string
  titulo: string
  icone: NomeDoIcone
  /** Aberta sem escolha gravada (como no protótipo). */
  padrao: boolean
  resumo?: string
  children: ReactNode
}

/**
 * Ficha recolhível cuja escolha vale para todo item do mesmo tipo e entre
 * sessões: o mestre abre "No mapa" (token) ou "Aparência" (porta) uma vez.
 */
export function FichaLembrada({ prefixo, id, titulo, icone, padrao, resumo, children }: FichaLembradaProps) {
  const chave = prefixo + id
  const [aberta, setAberta] = useState(() => lerAberta(chave, padrao))
  return (
    <Ficha
      titulo={titulo}
      icone={<IconeDoLivro nome={icone} />}
      resumo={resumo}
      aberta={aberta}
      onAlternar={(nova) => {
        setAberta(nova)
        gravarAberta(chave, nova)
      }}
    >
      {children}
    </Ficha>
  )
}
