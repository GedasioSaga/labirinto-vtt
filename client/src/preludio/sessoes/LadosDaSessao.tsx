import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import type { AbaDaSessao } from '../estado/preludio'
import { alternarLado, divisaoGuardada, guardarDivisao, PASSO_DO_TECLADO, prenderProporcao, PROPORCAO_MAXIMA, PROPORCAO_MINIMA, type Divisao } from './divisao'

/**
 * A SESSÃO LADO A LADO (fatia F3c, o `Workspace.tsx` do Grimório): o roteiro
 * à esquerda e o quadro à direita, com a divisória no meio. Arrastar a
 * divisória muda a largura na hora (as setas também, com ela em foco; o duplo
 * clique volta ao meio de sempre); cada lado recolhe numa faixa estreita que o
 * traz de volta; a divisão fica guardada por sessão. Em tela estreita, a
 * sessão volta às abas Roteiro e Quadro (`PaginaDaSessao`).
 */

const RECOLHER = (
  <svg viewBox="0 0 20 20" aria-hidden="true">
    <rect x="3.5" y="4" width="13" height="12" rx="1.5" />
    <path d="M8 4v12" />
  </svg>
)

interface LadosProps {
  readonly sessaoId: string
  readonly aba: AbaDaSessao
  readonly alvo?: string
  /** O roteiro (a folha da sessão), que rola por conta própria. */
  readonly roteiro: ReactNode
  /** O quadro da sessão, com o começo da barra que este lado manda (o título e o recolher). */
  readonly quadro: (cabeca: ReactNode) => ReactNode
}

function Faixa({ rotulo, aoAbrir }: { rotulo: string; aoAbrir: () => void }) {
  return (
    <button type="button" className="pr-lados__faixa" aria-label={`Abrir ${rotulo.toLowerCase()}`} title={`Abrir ${rotulo.toLowerCase()}`} onClick={aoAbrir}>
      {RECOLHER}
      <span>{rotulo}</span>
    </button>
  )
}

export function LadosDaSessao({ sessaoId, aba, alvo, roteiro, quadro }: LadosProps) {
  const [divisao, setDivisao] = useState<Divisao>(() => divisaoGuardada(sessaoId))
  const [arrastando, setArrastando] = useState(false)
  const casca = useRef<HTMLDivElement>(null)
  const ladoDoRoteiro = useRef<HTMLElement>(null)
  const ladoDoQuadro = useRef<HTMLElement>(null)
  const divisoria = useRef<HTMLDivElement>(null)
  const arrasto = useRef<{ proporcao: number; quadro: number } | null>(null)
  const { proporcao, recolhido } = divisao

  useEffect(() => {
    guardarDivisao(sessaoId, divisao)
  }, [sessaoId, divisao])

  // Ir ao quadro (a aba Quadro, uma citação do roteiro) com o quadro recolhido: ele abre.
  useEffect(() => {
    if (aba === 'quadro') setDivisao((antes) => (antes.recolhido === 'quadro' ? { ...antes, recolhido: 'nenhum' } : antes))
  }, [aba, alvo])

  const recolher = (lado: 'roteiro' | 'quadro') => setDivisao((antes) => ({ ...antes, recolhido: alternarLado(antes.recolhido, lado) }))

  /** Durante o arrasto, a largura muda direto no estilo (sem redesenhar a sessão a cada quadro); ao soltar, vira estado. */
  const aplicar = (fracao: number) => {
    if (ladoDoRoteiro.current !== null) ladoDoRoteiro.current.style.flexGrow = String(fracao)
    if (ladoDoQuadro.current !== null) ladoDoQuadro.current.style.flexGrow = String(1 - fracao)
    divisoria.current?.setAttribute('aria-valuenow', String(Math.round(fracao * 100)))
  }

  const aoPressionar = (evento: PointerEvent<HTMLDivElement>) => {
    if (evento.button !== 0 || arrasto.current !== null) return
    evento.preventDefault()
    evento.currentTarget.setPointerCapture(evento.pointerId)
    arrasto.current = { proporcao, quadro: 0 }
    setArrastando(true)
  }

  const aoMover = (evento: PointerEvent<HTMLDivElement>) => {
    const atual = arrasto.current
    const caixa = casca.current?.getBoundingClientRect()
    if (atual === null || caixa === undefined || caixa.width <= 0) return
    atual.proporcao = prenderProporcao((evento.clientX - caixa.left) / caixa.width)
    if (atual.quadro !== 0) return
    atual.quadro = requestAnimationFrame(() => {
      atual.quadro = 0
      aplicar(atual.proporcao)
    })
  }

  const aoSoltar = (evento: PointerEvent<HTMLDivElement>) => {
    const atual = arrasto.current
    if (atual === null) return
    if (atual.quadro !== 0) cancelAnimationFrame(atual.quadro)
    if (evento.currentTarget.hasPointerCapture(evento.pointerId)) evento.currentTarget.releasePointerCapture(evento.pointerId)
    arrasto.current = null
    setArrastando(false)
    setDivisao((antes) => ({ ...antes, proporcao: atual.proporcao }))
  }

  const aoTeclar = (evento: KeyboardEvent<HTMLDivElement>) => {
    const destino =
      evento.key === 'ArrowLeft'
        ? proporcao - PASSO_DO_TECLADO
        : evento.key === 'ArrowRight'
          ? proporcao + PASSO_DO_TECLADO
          : evento.key === 'Home'
            ? PROPORCAO_MINIMA
            : evento.key === 'End'
              ? PROPORCAO_MAXIMA
              : null
    if (destino === null) return
    evento.preventDefault()
    setDivisao((antes) => ({ ...antes, proporcao: prenderProporcao(destino) }))
  }

  const cabecaDoQuadro = (
    <div className="pr-lados__titulo-do-quadro">
      <span className="pr-lados__titulo">Quadro</span>
      <button type="button" className="pr-lados__recolher" aria-label="Recolher o quadro" title="Recolher o quadro" onClick={() => recolher('quadro')}>
        {RECOLHER}
      </button>
    </div>
  )

  const crescerRoteiro = recolhido === 'nenhum' ? proporcao : recolhido === 'quadro' ? 1 : 0
  return (
    <div ref={casca} className={`pr-lados${arrastando ? ' pr-lados--arrastando' : ''}`}>
      <section ref={ladoDoRoteiro} className={`pr-lados__lado pr-lados__roteiro${recolhido === 'roteiro' ? ' pr-lados__lado--recolhido' : ''}`} style={{ flexGrow: crescerRoteiro }} aria-label="Roteiro">
        {recolhido === 'roteiro' ? (
          <Faixa rotulo="Roteiro" aoAbrir={() => recolher('roteiro')} />
        ) : (
          <>
            <div className="pr-lados__cabeca">
              <span className="pr-lados__titulo">Roteiro</span>
              <button type="button" className="pr-lados__recolher" aria-label="Recolher o roteiro" title="Recolher o roteiro" onClick={() => recolher('roteiro')}>
                {RECOLHER}
              </button>
            </div>
            <div className="pr-lados__rolagem">{roteiro}</div>
          </>
        )}
      </section>
      {recolhido === 'nenhum' && (
        <div
          ref={divisoria}
          className="pr-lados__divisoria"
          role="separator"
          aria-orientation="vertical"
          aria-label="Divisão entre o roteiro e o quadro"
          aria-valuemin={Math.round(PROPORCAO_MINIMA * 100)}
          aria-valuemax={Math.round(PROPORCAO_MAXIMA * 100)}
          aria-valuenow={Math.round(proporcao * 100)}
          title="Arraste para mudar a largura (setas também; duplo clique volta ao meio)"
          tabIndex={0}
          onPointerDown={aoPressionar}
          onPointerMove={aoMover}
          onPointerUp={aoSoltar}
          onPointerCancel={aoSoltar}
          onKeyDown={aoTeclar}
          onDoubleClick={() => setDivisao((antes) => ({ ...antes, proporcao: 0.5 }))}
        />
      )}
      <section ref={ladoDoQuadro} className={`pr-lados__lado pr-lados__quadro${recolhido === 'quadro' ? ' pr-lados__lado--recolhido' : ''}`} style={{ flexGrow: 1 - crescerRoteiro }} aria-label="Quadro da sessão">
        {recolhido === 'quadro' ? <Faixa rotulo="Quadro" aoAbrir={() => recolher('quadro')} /> : quadro(cabecaDoQuadro)}
      </section>
    </div>
  )
}
