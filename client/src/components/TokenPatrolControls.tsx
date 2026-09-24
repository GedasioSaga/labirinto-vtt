import { useId } from 'react'
import type { TokenPatrol } from '../types/map'
import type { PatrolOp } from '../lib/npcPatrol'

export interface TokenPatrolControlsProps {
  /** Rota da ficha selecionada, já lida (`readTokenPatrol`); `null` = ficha sem rota. */
  patrol: TokenPatrol | null
  /** O que o botão pede à rota — quem aplica é o store (`patrolAction`), sobre a ficha atual. */
  onPatrolOp: (op: PatrolOp) => void
}

/** Pontos mínimos para haver para onde andar. */
const MIN_POINTS_TO_ADVANCE = 2

function patrolSummary(patrol: TokenPatrol | null): string {
  if (patrol === null) return 'Sem rota.'
  const count = patrol.pontos.length
  const points = count === 1 ? '1 ponto' : `${count} pontos`
  return `${points} · no ponto ${patrol.atual + 1}`
}

/**
 * ROTA DE PATRULHA — o mestre marca a ronda de um NPC e o faz andar um passo
 * por clique. A rota aparece no mapa do mestre (`pixi/drawNpcPatrol.ts`);
 * quem joga só vê a ficha andar, e só quando ela está na visão dele.
 *
 * Botões nativos: foco, Enter e Espaço já prontos. Cada clique passa pelo
 * histórico (`patrolAction`), então Ctrl+Z desfaz o passo ou o ponto.
 */
export function TokenPatrolControls({ patrol, onPatrolOp }: TokenPatrolControlsProps) {
  const reasonId = useId()
  const canAdvance = patrol !== null && patrol.pontos.length >= MIN_POINTS_TO_ADVANCE
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Patrulha</h2>
      <span className="lb-label">{patrolSummary(patrol)}</span>
      <button type="button" className="lb-btn lb-btn--block" disabled={!canAdvance} aria-describedby={canAdvance ? undefined : reasonId} onClick={() => onPatrolOp('avancar')}>
        Avançar patrulha
      </button>
      {!canAdvance && (
        <span id={reasonId} className="lb-label">
          Marque pelo menos 2 pontos: ponha a ficha em cada lugar da ronda e clique em "Marcar ponto aqui".
        </span>
      )}
      <button type="button" className="lb-btn lb-btn--ghost lb-btn--block" onClick={() => onPatrolOp('marcar')}>
        Marcar ponto aqui
      </button>
      {patrol !== null && (
        <>
          <button type="button" className="lb-btn lb-btn--ghost lb-btn--block" onClick={() => onPatrolOp('desfazer')}>
            Tirar último ponto
          </button>
          <button type="button" className="lb-btn lb-btn--ghost lb-btn--block" onClick={() => onPatrolOp('apagar')}>
            Apagar rota
          </button>
          {/* O mestre precisa saber o que sai para a mesa e o que fica com ele. */}
          <span className="lb-label">A rota só você vê. Quem joga vê o NPC andar só quando ele está na visão.</span>
        </>
      )}
    </section>
  )
}
