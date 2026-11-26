import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { quantoDaVida, type FichaComVida } from '../lib/vidaPeloMenu'
import type { SentidoDaVida } from '../stores/vidaPeloMenu'
import './MenuDaSelecao.css'

export interface SubmenuDaVidaProps {
  /** As fichas que o número mexe (a mesma ficha uma vez só). */
  fichas: readonly FichaComVida[]
  /** O nome da vida no sistema ("HP", "PV"). */
  nomeDoRecurso: string
  /** Alguma delas está numa batalha: o aviso embaixo diz que vai pelo registro. */
  naBatalha: boolean
  /** O item "Vida ›" que abriu o painel: ele abre na altura dele. */
  ancora: HTMLElement | null
  onAplicar: (sentido: SentidoDaVida, quanto: number) => void
  /** Esc (com o campo vazio): fecha só o painel. */
  onFechar: () => void
}

const FOLGA_DA_BORDA = 8
/** Quantos algarismos o campo aceita: o teto da ficha (1 000 000) tem 7. */
const ALGARISMOS_MAX = 7
/** Os atalhos, da esquerda para a direita como numa régua: −10, −5, +5, +10. */
const ATALHOS: readonly { sentido: SentidoDaVida; quanto: number }[] = [
  { sentido: 'tirar', quanto: 10 },
  { sentido: 'tirar', quanto: 5 },
  { sentido: 'dar', quanto: 5 },
  { sentido: 'dar', quanto: 10 },
]

/**
 * "Vida ›" do botão direito (pedido de 25/11/2026): o número no alto, o campo
 * com "Tirar" e "Dar", e os atalhos −10, −5, +5, +10. Enter no campo tira
 * (o mais usado: o mestre digita o dano do golpe). Mesmo molde do "Ligar
 * ficha ›" (`SubmenuLigarFicha`): abre ao lado do pai, à esquerda quando não
 * cabe, com o foco no campo. Setas e Tab andam entre o campo e os botões sem
 * sair do painel; Esc limpa o campo e, vazio, fecha o painel.
 */
export function SubmenuDaVida({ fichas, nomeDoRecurso, naBatalha, ancora, onAplicar, onFechar }: SubmenuDaVidaProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const campoRef = useRef<HTMLInputElement | null>(null)
  const idDoCampo = useId()
  const [texto, setTexto] = useState('')
  const quanto = quantoDaVida(texto)
  const [uma] = fichas
  const sozinha = fichas.length === 1 && uma !== undefined ? uma : null

  // É um campo de digitar: o foco entra nele também quando o ponteiro abriu o painel.
  useEffect(() => {
    campoRef.current?.focus()
  }, [])

  useLayoutEffect(() => {
    const painel = ref.current
    const menu = painel?.offsetParent
    const caixa = menu instanceof HTMLElement ? menu.offsetParent : null
    if (!painel || !(menu instanceof HTMLElement) || !(caixa instanceof HTMLElement)) return
    const cabeADireita = menu.offsetLeft + menu.offsetWidth + painel.offsetWidth + FOLGA_DA_BORDA <= caixa.clientWidth
    painel.dataset.lado = cabeADireita ? 'direita' : 'esquerda'
    const base = ancora?.offsetTop ?? 0
    const sobra = caixa.clientHeight - FOLGA_DA_BORDA - (menu.offsetTop + base + painel.offsetHeight)
    painel.style.top = `${base + Math.min(0, sobra)}px`
  }, [ancora])

  const focaveis = () => Array.from(ref.current?.querySelectorAll<HTMLElement>('input, button:not(:disabled)') ?? [])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Nenhuma tecla do painel vale para o menu pai nem para o editor.
    event.stopPropagation()
    const lista = focaveis()
    const agora = lista.findIndex((item) => item === document.activeElement)
    const noCampo = document.activeElement === campoRef.current
    const andar = (passo: 1 | -1) => {
      event.preventDefault()
      lista[(agora + passo + lista.length) % lista.length]?.focus()
    }
    switch (event.key) {
      case 'Escape':
        event.preventDefault()
        if (noCampo && texto !== '') setTexto('')
        else onFechar()
        return
      case 'Enter':
        if (!noCampo) return
        event.preventDefault()
        if (quanto !== null) onAplicar('tirar', quanto)
        return
      case 'Tab':
        andar(event.shiftKey ? -1 : 1)
        return
      case 'ArrowDown':
        andar(1)
        return
      case 'ArrowUp':
        andar(-1)
        return
      case 'ArrowRight':
        if (!noCampo) andar(1)
        return
      case 'ArrowLeft':
        if (!noCampo) andar(-1)
        return
    }
  }

  return (
    <div
      ref={ref}
      className="lb-panel lb-portamenu lb-menusel__sub lb-vida"
      role="dialog"
      aria-label={sozinha !== null ? `${nomeDoRecurso} de ${sozinha.nome}` : `${nomeDoRecurso} de ${fichas.length} fichas`}
      onKeyDown={onKeyDown}
    >
      <p className="lb-vida__titulo">
        <span className="lb-vida__nome">{sozinha !== null ? sozinha.nome : `${fichas.length} fichas`}</span>
        {sozinha !== null && (
          <span className="lb-vida__valor">
            {nomeDoRecurso} {sozinha.atual}/{sozinha.maximo}
          </span>
        )}
      </p>
      {sozinha === null && (
        <ul className="lb-vida__lista">
          {fichas.map((ficha) => (
            <li key={ficha.personagemId}>
              <span className="lb-vida__nome">{ficha.nome}</span>
              <span className="lb-vida__valor">
                {ficha.atual}/{ficha.maximo}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="lb-vida__linha">
        <label className="gr-sr" htmlFor={idDoCampo}>
          Quanto de {nomeDoRecurso}
        </label>
        <input
          ref={campoRef}
          id={idDoCampo}
          type="text"
          inputMode="numeric"
          className="lb-input lb-vida__campo"
          placeholder="0"
          autoComplete="off"
          spellCheck={false}
          maxLength={ALGARISMOS_MAX}
          value={texto}
          // Só algarismos: o sinal é o botão (Tirar ou Dar), não o número.
          onChange={(event) => setTexto(event.target.value.replace(/\D/g, ''))}
        />
        <button type="button" className="lb-btn lb-btn--danger lb-vida__botao" disabled={quanto === null} onClick={() => quanto !== null && onAplicar('tirar', quanto)}>
          Tirar
        </button>
        <button type="button" className="lb-btn lb-vida__botao" disabled={quanto === null} onClick={() => quanto !== null && onAplicar('dar', quanto)}>
          Dar
        </button>
      </div>
      <div className="lb-vida__atalhos" role="group" aria-label="Atalhos">
        {ATALHOS.map(({ sentido, quanto: passo }) => (
          <button
            key={`${sentido}-${passo}`}
            type="button"
            className="lb-btn lb-btn--ghost lb-vida__botao lb-vida__atalho"
            data-sentido={sentido}
            aria-label={`${sentido === 'tirar' ? 'Tirar' : 'Dar'} ${passo} de ${nomeDoRecurso}`}
            onClick={() => onAplicar(sentido, passo)}
          >
            {sentido === 'tirar' ? '−' : '+'}
            {passo}
          </button>
        ))}
      </div>
      {naBatalha && <p className="lb-ligar__nota">Na batalha: vai pelo registro dela (Escudo, redução e o Desfazer de lá).</p>}
    </div>
  )
}
