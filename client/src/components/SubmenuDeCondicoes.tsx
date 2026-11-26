import { useEffect, useLayoutEffect, useMemo, useRef, type KeyboardEvent } from 'react'
import { catalogoDeCondicoes } from '../lib/condicoes/catalogo'
import { condicoesDe } from '../lib/condicoes/naFicha'
import type { Personagem } from '../lib/personagem'
import { porCondicaoNasFichas, tirarCondicaoDasFichas } from '../stores/condicoesDoMestre'
import { useCondicoesPropriasStore } from '../stores/condicoesPropriasStore'
import { ChipsDaFicha, FormDePorCondicao } from './condicoes/PorCondicao'
import './MenuDaSelecao.css'

export interface SubmenuDeCondicoesProps {
  /** As fichas dos tokens do clique (a mesma ficha uma vez só; no NPC, a cópia de cada token). */
  fichas: readonly Personagem[]
  /** O item "Condições ›" que abriu o painel: ele abre na altura dele. */
  ancora: HTMLElement | null
  /** Esc: fecha só o painel. */
  onFechar: () => void
  /** Pôs a condição: o menu inteiro fecha. */
  onPos: () => void
}

const FOLGA_DA_BORDA = 8

/**
 * "CONDIÇÕES ›" DO BOTÃO DIREITO (itens refeitos, E4b; o gesto do critério de pronto: "pôr
 * Envenenado 2 turnos, 3 de vida no Zumbi 1 pelo menu do token"). As condições de cada ficha, com
 * o ✕ que tira, e o "Pôr condição" (duração e número da regra). Grava na FICHA: no NPC, na cópia
 * daquele token, então o Zumbi 2 não acende. Mesmo molde do "Vida ›" (`SubmenuDaVida`): abre ao
 * lado do pai, à esquerda quando não cabe, com o foco dentro; Tab e as setas andam sem sair; Esc fecha.
 */
export function SubmenuDeCondicoes({ fichas, ancora, onFechar, onPos }: SubmenuDeCondicoesProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const criadas = useCondicoesPropriasStore((state) => state.catalogo)
  const catalogo = useMemo(() => catalogoDeCondicoes(criadas), [criadas])
  const [uma] = fichas
  const sozinha = fichas.length === 1 && uma !== undefined ? uma : null

  // O foco entra no primeiro campo também quando o ponteiro abriu o painel: é um formulário.
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('select, input, button:not(:disabled)')?.focus()
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
  }, [ancora, fichas])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Nenhuma tecla do painel vale para o menu pai nem para o editor (as setas moveriam o token).
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      onFechar()
      return
    }
    if (event.key !== 'Tab') return
    const lista = Array.from(ref.current?.querySelectorAll<HTMLElement>('select, input, button:not(:disabled)') ?? [])
    const agora = lista.findIndex((item) => item === document.activeElement)
    event.preventDefault()
    lista[(agora + (event.shiftKey ? -1 : 1) + lista.length) % lista.length]?.focus()
  }

  return (
    <div
      ref={ref}
      className="lb-panel lb-portamenu lb-menusel__sub lb-conds"
      role="dialog"
      aria-label={sozinha !== null ? `Condições de ${sozinha.nome}` : `Condições de ${fichas.length} fichas`}
      onKeyDown={onKeyDown}
    >
      {fichas.map((ficha) => (
        <div key={ficha.id} className="lb-conds__ficha">
          <p className="lb-vida__titulo">
            <span className="lb-vida__nome">{ficha.nome.trim() || 'Personagem sem nome'}</span>
          </p>
          <ChipsDaFicha
            condicoes={condicoesDe(ficha)}
            criadas={criadas}
            onTirar={(condicao, nome) => tirarCondicaoDasFichas([ficha.id], condicao.id, nome)}
          />
        </div>
      ))}
      <FormDePorCondicao
        alvos={fichas.map((ficha) => ({ id: ficha.id, nome: ficha.nome.trim() || 'Personagem sem nome' }))}
        catalogo={catalogo}
        compacto
        onPor={(ids, pedido) => {
          const pos = porCondicaoNasFichas(ids, pedido)
          if (pos) onPos()
          return pos
        }}
      />
    </div>
  )
}
