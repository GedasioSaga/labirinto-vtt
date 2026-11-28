/**
 * A RÉGUA DOS ANÉIS (28/11): com 5 ou 6 anéis, cada anel fica estreito demais
 * para o dedo (uns 35 px a 1440 x 900). Em vez de mexer no desenho do medalhão,
 * a régua ao lado dele dá dois botões de 44 px por anel (girar para a esquerda e
 * para a direita), na ordem de fora para dentro. Apontar uma linha acende o anel
 * dela no medalhão; o desenhinho de círculos no meio diz qual é.
 *
 * Só aparece quando a faixa do anel, medida na tela, fica abaixo de 44 px (o
 * mesmo medalhão de 4 anéis numa janela pequena também ganha a régua).
 */
import { useLayoutEffect, useState, type RefObject } from 'react'
import type { MaterialDasGiratorias } from '../tipos'
import { LADO_DO_DISCO, RAIO_DO_DISCO, RAIO_DO_MIOLO } from './arte'

/** O menor alvo de toque que cabe no dedo, em px. */
export const ALVO_DE_TOQUE_PX = 44

/** A largura de cada anel na tela, em px; `Infinity` enquanto não deu para medir. */
export function useFaixaDoAnel(caixa: RefObject<HTMLDivElement | null>, aneis: number): number {
  const [lado, setLado] = useState(0)
  useLayoutEffect(() => {
    const el = caixa.current
    if (el === null) return
    const medir = () => setLado(el.getBoundingClientRect().width)
    medir()
    if (typeof ResizeObserver === 'undefined') return
    const observador = new ResizeObserver(medir)
    observador.observe(el)
    return () => observador.disconnect()
  }, [caixa])
  if (lado === 0) return Number.POSITIVE_INFINITY
  return ((RAIO_DO_DISCO - RAIO_DO_MIOLO) / aneis) * (lado / LADO_DO_DISCO)
}

interface PropsDaRegua {
  total: number
  material: MaterialDasGiratorias
  rotulo: (anel: number) => string
  /** Gira o anel um dente; `peloTeclado` = Enter ou Espaço no botão (o anel não anima). */
  onGirar: (anel: number, passo: 1 | -1, peloTeclado: boolean) => void
  /** A linha apontada (mouse ou foco): o medalhão acende o anel dela. */
  onApontar: (anel: number | null) => void
}

/** Os anéis em miniatura, com o anel `anel` aceso. */
function AneisEmMiniatura({ total, anel }: { total: number; anel: number }) {
  const passo = 7 / total
  return (
    <svg className="qpz-giro-regua__aneis" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {Array.from({ length: total }, (_, k) => (
        <circle key={k} cx="12" cy="12" r={(10.5 - k * passo).toFixed(2)} className={k === anel ? 'is-este' : undefined} />
      ))}
      <circle cx="12" cy="12" r="2" className="qpz-giro-regua__miolo" />
    </svg>
  )
}

/** A seta curva: `1` = sentido do relógio. */
function SetaDeGiro({ sentido }: { sentido: 1 | -1 }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={sentido === -1 ? { transform: 'scaleX(-1)' } : undefined}>
      <path d="M19.4 14.6A7.6 7.6 0 1 1 17.2 6.6" />
      <path d="M18.6 2.8v4.5h-4.5" />
    </svg>
  )
}

export function ReguaDosAneis({ total, material, rotulo, onGirar, onApontar }: PropsDaRegua) {
  return (
    <div className="qpz-giro-regua" data-material={material} role="group" aria-label="Girar os anéis, de fora para dentro" onPointerLeave={() => onApontar(null)}>
      {Array.from({ length: total }, (_, k) => (
        <div key={k} className="qpz-giro-regua__linha" onPointerEnter={() => onApontar(k)} onFocus={() => onApontar(k)} onBlur={() => onApontar(null)}>
          <button type="button" className="qpz-giro-regua__botao" aria-label={`${rotulo(k)}: girar para a esquerda`} onClick={(evento) => onGirar(k, -1, evento.detail === 0)}>
            <SetaDeGiro sentido={-1} />
          </button>
          <AneisEmMiniatura total={total} anel={k} />
          <button type="button" className="qpz-giro-regua__botao" aria-label={`${rotulo(k)}: girar para a direita`} onClick={(evento) => onGirar(k, 1, evento.detail === 0)}>
            <SetaDeGiro sentido={1} />
          </button>
        </div>
      ))}
    </div>
  )
}
