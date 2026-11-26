import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { filtrarAlvos, type AlvoDoEnvio } from '../lib/enviarParaPerto'
import { nomeDoPiso, pisoDe } from '../lib/pisos'
import { retratoNoToken } from '../lib/mudarFicha'
import { FotoBase } from './ItensDaAparenciaDaFicha'
import './MenuDaSelecao.css'

export interface SubmenuPertoDeProps {
  /** Os tokens do mapa, jogadores primeiro (`alvosParaPerto`). */
  alvos: readonly AlvoDoEnvio[]
  /** O piso que o editor mostra: o alvo de outro piso diz qual ao lado do nome. */
  pisoAtivo: number
  /** O mapa tem pisos: só então o piso do alvo aparece. */
  comPisos: boolean
  /** O item "Enviar para perto de ›" que abriu o submenu: ele abre na altura dele. */
  ancora: HTMLElement | null
  onEscolher: (tokenId: string) => void
  /** Esc (com a busca vazia) ou seta para a esquerda num item: fecha só o submenu. */
  onFechar: () => void
  /** Tab: fecha o menu inteiro. */
  onSair: () => void
}

const FOLGA_DA_BORDA = 8

/**
 * "Enviar para perto de ›" do botão direito (pedido de 25/11/2026): a busca no
 * alto, os JOGADORES e depois os NPCs do mapa, com o retrato pequeno e o nome
 * (cópias numeradas, "Zumbi 2"). Mesmo molde do "Ligar ficha ›"
 * (`SubmenuLigarFicha`): abre ao lado do pai com o foco na busca; da busca,
 * seta para baixo entra na lista e Enter escolhe o primeiro que bate; na
 * lista, setas andam e Home/End vão às pontas.
 */
export function SubmenuPertoDe({ alvos, pisoAtivo, comPisos, ancora, onEscolher, onFechar, onSair }: SubmenuPertoDeProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const buscaRef = useRef<HTMLInputElement | null>(null)
  const idDaBusca = useId()
  const [busca, setBusca] = useState('')
  const achados = filtrarAlvos(alvos, busca)
  const [primeiro] = achados

  // É um campo de digitar: o foco entra na busca também quando o ponteiro abriu o submenu.
  useEffect(() => {
    buscaRef.current?.focus()
  }, [])

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
        if (primeiro !== undefined) onEscolher(primeiro.token.id)
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
    <div ref={ref} className="lb-panel lb-portamenu lb-menusel__sub lb-ligar" role="menu" aria-label="Enviar para perto de" onKeyDown={onKeyDown}>
      <label className="gr-sr" htmlFor={idDaBusca}>
        Buscar jogador ou NPC
      </label>
      <input
        ref={buscaRef}
        id={idDaBusca}
        type="search"
        className="lb-input lb-ligar__busca"
        placeholder="Buscar jogador ou NPC"
        autoComplete="off"
        spellCheck={false}
        value={busca}
        onChange={(event) => setBusca(event.target.value)}
      />
      <div className="lb-ligar__lista">
        {achados.length === 0 ? (
          <p className="lb-ligar__vazio" role="status">
            {alvos.length === 0 ? 'Nenhum outro token no mapa.' : `Ninguém com “${busca.trim()}”.`}
          </p>
        ) : (
          achados.map((alvo, indice) => {
            const anterior = achados[indice - 1]
            // O título do grupo entra onde o grupo começa: Jogadores no alto, NPCs depois.
            const comecaGrupo = anterior === undefined || anterior.jogador !== alvo.jogador
            const piso = pisoDe(alvo.token)
            return (
              <Fragment key={alvo.token.id}>
                {comecaGrupo && <p className="lb-perto__grupo">{alvo.jogador ? 'Jogadores' : 'NPCs'}</p>}
                <button
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  className="lb-portamenu__item lb-ligar__item"
                  // Sem focar no hover: o mestre pode estar digitando na busca com o ponteiro passando pela lista.
                  onClick={() => onEscolher(alvo.token.id)}
                >
                  <span className="lb-ligar__retrato" aria-hidden="true">
                    <FotoBase token={alvo.token} retrato={retratoNoToken(alvo.token, alvo.personagem)} />
                  </span>
                  <span className="lb-ligar__nome">{alvo.nome}</span>
                  {comPisos && piso !== pisoAtivo && <span className="lb-ligar__tipo">{nomeDoPiso(piso)}</span>}
                </button>
              </Fragment>
            )
          })
        )}
      </div>
    </div>
  )
}
