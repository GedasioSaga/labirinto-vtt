import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { fichasParaLigar, grupoDaFicha } from '../lib/pastasDeFichas'
import type { Personagem } from '../lib/personagem'
import { ImagemOuIniciais } from './FichaPecas'
import './MenuDaSelecao.css'

export interface SubmenuLigarFichaProps {
  personagens: readonly Personagem[]
  /** Quantos tokens a escolha vai ligar (o título diz). */
  quantos: number
  /** O item "Ligar ficha ›" que abriu o submenu: ele abre na altura dele. */
  ancora: HTMLElement | null
  /** Abriu pelo teclado: o foco entra direto na busca. Pelo ponteiro, também (é um campo de digitar). */
  focar: boolean
  onEscolher: (personagemId: string) => void
  /** Esc (com a busca vazia) ou seta para a esquerda num item: fecha só o submenu. */
  onFechar: () => void
  /** Tab: fecha o menu inteiro. */
  onSair: () => void
}

const FOLGA_DA_BORDA = 8
const ROTULO_DO_GRUPO = { jogadores: 'Jogador', npcs: 'NPC', inimigos: 'Inimigo' } as const

/**
 * "Ligar ficha ›" do menu do botão direito (pedido de 09/11/2026): a busca
 * no alto e as fichas da lista, em ordem de nome. Mesmo molde do "Enviar
 * para cena ›" (`SubmenuDeCenas`): abre ao lado do pai, à esquerda quando
 * não cabe. Da busca, seta para baixo entra na lista; Enter na busca escolhe
 * a primeira que bate; na lista, setas andam e Home/End vão às pontas.
 */
export function SubmenuLigarFicha({ personagens, quantos, ancora, focar, onEscolher, onFechar, onSair }: SubmenuLigarFichaProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const buscaRef = useRef<HTMLInputElement | null>(null)
  const idDaBusca = useId()
  const [busca, setBusca] = useState('')
  const fichas = fichasParaLigar(personagens, busca)

  useEffect(() => {
    if (focar) buscaRef.current?.focus()
  }, [focar])

  useLayoutEffect(() => {
    const submenu = ref.current
    const menu = submenu?.offsetParent
    const caixa = menu instanceof HTMLElement ? menu.offsetParent : null
    if (!submenu || !(menu instanceof HTMLElement) || !(caixa instanceof HTMLElement)) return
    const cabeADireita = menu.offsetLeft + menu.offsetWidth + submenu.offsetWidth + FOLGA_DA_BORDA <= caixa.clientWidth
    submenu.dataset.lado = cabeADireita ? 'direita' : 'esquerda'
    const base = ancora?.offsetTop ?? 0
    const sobra = caixa.clientHeight - FOLGA_DA_BORDA - (menu.offsetTop + base + submenu.offsetHeight)
    submenu.style.top = `${base + Math.min(0, sobra)}px`
  }, [ancora])

  const itens = () => Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation()
    const lista = itens()
    const naBusca = document.activeElement === buscaRef.current
    const agora = lista.findIndex((item) => item === document.activeElement)
    switch (event.key) {
      case 'Escape':
        event.preventDefault()
        if (naBusca && busca !== '') setBusca('')
        else onFechar()
        return
      case 'ArrowLeft':
        if (naBusca) return
        event.preventDefault()
        onFechar()
        return
      case 'Tab':
        onSair()
        return
      case 'Enter':
        if (!naBusca) return
        event.preventDefault()
        if (fichas.length > 0) onEscolher(fichas[0].id)
        return
      case 'ArrowDown':
        event.preventDefault()
        lista[naBusca ? 0 : Math.min(lista.length - 1, agora + 1)]?.focus()
        return
      case 'ArrowUp':
        event.preventDefault()
        if (agora <= 0) buscaRef.current?.focus()
        else lista[agora - 1]?.focus()
        return
      case 'Home':
        if (naBusca) return
        event.preventDefault()
        lista[0]?.focus()
        return
      case 'End':
        if (naBusca) return
        event.preventDefault()
        lista[lista.length - 1]?.focus()
        return
    }
  }

  return (
    <div ref={ref} className="lb-panel lb-portamenu lb-menusel__sub lb-ligar" role="menu" aria-label={quantos > 1 ? `Ligar ficha a ${quantos} tokens` : 'Ligar ficha ao token'} onKeyDown={onKeyDown}>
      <label className="gr-sr" htmlFor={idDaBusca}>
        Buscar ficha
      </label>
      <input
        ref={buscaRef}
        id={idDaBusca}
        type="search"
        className="lb-input lb-ligar__busca"
        placeholder="Buscar ficha"
        autoComplete="off"
        spellCheck={false}
        value={busca}
        onChange={(event) => setBusca(event.target.value)}
      />
      {quantos > 1 && <p className="lb-ligar__nota">Cada um dos {quantos} tokens fica com a própria vida.</p>}
      <div className="lb-ligar__lista">
        {fichas.length === 0 ? (
          <p className="lb-ligar__vazio" role="status">
            {personagens.length === 0 ? 'Nenhuma ficha na lista de Personagens.' : `Nenhuma ficha com “${busca.trim()}”.`}
          </p>
        ) : (
          fichas.map((ficha) => (
            <button
              key={ficha.id}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className="lb-portamenu__item lb-ligar__item"
              // Sem focar no hover: o mestre pode estar digitando na busca com o ponteiro passando pela lista.
              onClick={() => onEscolher(ficha.id)}
            >
              <span className="lb-ligar__retrato" aria-hidden="true">
                <ImagemOuIniciais imagem={ficha.retrato} nome={ficha.nome} />
              </span>
              <span className="lb-ligar__nome">{ficha.nome || 'Personagem sem nome'}</span>
              <span className="lb-ligar__tipo">{ROTULO_DO_GRUPO[grupoDaFicha(ficha)]}</span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
