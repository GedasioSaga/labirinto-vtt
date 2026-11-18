import { startTransition, useState, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from 'react'
import { isEditableTarget } from '../lib/keymap'
import { normalizeForSearch } from '../lib/mapObjects'
import { CloseIcon, SearchIcon } from './icons'

/**
 * A BUSCA DO ACERVO DE ITENS (pedido de 18/11/2026: busca "Nos dois
 * acervos"), igual à do acervo de tokens (`TokenLibraryPanel`, 18/11): sem
 * acento nem maiúscula, cada palavra em qualquer ponto do nome; o × e o Esc
 * limpam, o segundo Esc sai do campo; Ctrl+F ou "/" com o foco no painel
 * trazem o cursor; a seta para baixo desce ao primeiro achado. As peças
 * moram aqui (e não importadas do de tokens) porque lá elas são internas.
 */

/** Nome acessível do campo; a lupa e o placeholder dizem o resto a quem enxerga. */
export const BUSCAR_ITEM = 'Buscar item'

/** As palavras da busca, sem acento e em minúsculas ("polvora" acha a "Pólvora"). Lista vazia = sem busca. */
export function palavrasDaBusca(busca: string): string[] {
  return normalizeForSearch(busca)
    .split(/\s+/)
    .filter((palavra) => palavra !== '')
}

/** O nome tem todas as palavras, cada uma em qualquer ponto dele? */
export function nomeCasa(nome: string, palavras: readonly string[]): boolean {
  const alvo = normalizeForSearch(nome)
  return palavras.every((palavra) => alvo.includes(palavra))
}

/**
 * A tecla leva à busca? Ctrl+F (Cmd+F) de qualquer ponto do painel; "/" só
 * fora de campo de texto, onde ele é texto (o nome da pasta nova). Nenhum dos
 * dois é atalho do mapa (`resolveShortcut`, lib/keymap.ts).
 */
export function ehAtalhoDaBusca(event: ReactKeyboardEvent<HTMLElement>): boolean {
  if (event.altKey) return false
  if (event.ctrlKey || event.metaKey) return !event.shiftKey && event.key.toLowerCase() === 'f'
  if (event.key !== '/') return false
  const alvo = event.target
  if (!(alvo instanceof HTMLElement)) return true
  return !isEditableTarget(alvo.tagName, alvo instanceof HTMLInputElement ? alvo.type : undefined, alvo.isContentEditable)
}

interface CampoDeBuscaProps {
  campoRef: RefObject<HTMLInputElement | null>
  /** O texto mudou. Chega numa transição: a lista se refaz cedendo a vez, e a tecla não espera por ela. */
  onMudar: (texto: string) => void
  /** Seta para baixo: o foco desce para o primeiro achado; `false` quando não há nenhum. */
  onDescer: () => boolean
}

/** O campo, dono do próprio texto: a tecla refaz só o campo, e a lista vem depois, numa transição (o de tokens mediu 182 → 78 ms). */
export function CampoDeBusca({ campoRef, onMudar, onDescer }: CampoDeBuscaProps) {
  const [texto, setTexto] = useState('')

  const mudar = (novo: string) => {
    setTexto(novo)
    startTransition(() => onMudar(novo))
  }

  const limpar = () => {
    mudar('')
    // O × sai da tela junto com o texto: o foco fica no campo, não cai no body.
    campoRef.current?.focus()
  }

  const tecla = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      // Não chega ao mapa (lá o Esc larga a seleção). O primeiro apaga a busca; o segundo, com o campo vazio, sai dele.
      event.preventDefault()
      event.stopPropagation()
      if (texto !== '') mudar('')
      else event.currentTarget.blur()
      return
    }
    if (event.key === 'ArrowDown' && onDescer()) event.preventDefault()
  }

  return (
    <div className="lb-objetos__campo lb-acervo__campo">
      <span className="lb-objetos__lupa" aria-hidden="true">
        <SearchIcon size={14} />
      </span>
      <input
        ref={campoRef}
        type="search"
        className="lb-input lb-objetos__busca"
        aria-label={BUSCAR_ITEM}
        aria-keyshortcuts="Control+F /"
        placeholder="Buscar pelo nome"
        title="Buscar pelo nome (Ctrl+F ou /, com o foco no acervo)"
        value={texto}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => mudar(event.target.value)}
        onKeyDown={tecla}
      />
      {texto !== '' && (
        <button type="button" className="lb-iconbtn lb-iconbtn--sm lb-objetos__limpar" aria-label="Limpar busca" title="Limpar busca (Esc)" onClick={limpar}>
          <CloseIcon size={14} />
        </button>
      )}
    </div>
  )
}
