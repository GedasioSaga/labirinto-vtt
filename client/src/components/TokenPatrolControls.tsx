import { useId, useLayoutEffect, useRef } from 'react'
import type { TokenPatrol } from '../types/map'
import type { PatrolOp } from '../lib/npcPatrol'
import { OpcionalDaFicha, useSecaoLembrada } from './TokenConditionControls'
import './TokenControls.css'

export interface TokenPatrolControlsProps {
  /** Rota da ficha selecionada, já lida (`readTokenPatrol`); `null` = ficha sem rota. */
  patrol: TokenPatrol | null
  /** O que o botão pede à rota — quem aplica é o store (`patrolAction`), sobre a ficha atual. */
  onPatrolOp: (op: PatrolOp) => void
}

/** O que a linha "Patrulha" faz, lido antes de abrir (vira balão ao pairar, peça P3). */
export const PATRULHA_HINT = 'Marque a ronda de um NPC e faça-o andar um passo por clique.'

/** Pontos mínimos para haver para onde andar. */
const MIN_POINTS_TO_ADVANCE = 2

function patrolSummary(patrol: TokenPatrol): string {
  const count = patrol.pontos.length
  const points = count === 1 ? '1 ponto' : `${count} pontos`
  return `${points} · no ponto ${patrol.atual + 1}`
}

/**
 * ROTA DE PATRULHA — o mestre marca a ronda de um NPC e o faz andar um passo
 * por clique. A rota aparece no mapa do mestre (`pixi/drawNpcPatrol.ts`);
 * quem joga só vê a ficha andar, e só quando ela está na visão dele.
 *
 * Sem rota, o bloco é uma linha "Patrulha" com "+" (`OpcionalDaFicha`), e a
 * escolha de deixar aberto é lembrada. Com rota, o bloco fica à vista e o
 * resumo ("3 pontos · no ponto 2") mora no cabeçalho.
 *
 * Botões nativos: foco, Enter e Espaço já prontos. Cada clique passa pelo
 * histórico (`patrolAction`), então Ctrl+Z desfaz o passo ou o ponto.
 */
export function TokenPatrolControls({ patrol, onPatrolOp }: TokenPatrolControlsProps) {
  const [aberta, lembrarAberta] = useSecaoLembrada('ficha-patrulha')
  const reasonId = useId()
  const dicaId = useId()
  const secaoRef = useRef<HTMLElement>(null)
  const marcarRef = useRef<HTMLButtonElement>(null)
  /** O botão que o teclado usava ("Apagar rota", "Tirar último ponto") some quando a rota acaba: o foco vai para "Marcar ponto aqui". */
  const focoAoAcabar = useRef(false)
  const canAdvance = patrol !== null && patrol.pontos.length >= MIN_POINTS_TO_ADVANCE

  useLayoutEffect(() => {
    if (patrol !== null || !focoAoAcabar.current) return
    focoAoAcabar.current = false
    marcarRef.current?.focus()
  }, [patrol])

  function pedir(op: PatrolOp) {
    // Quem mexe na rota está usando o bloco: ele fica aberto, também quando a
    // rota acaba — os botões não somem debaixo do ponteiro.
    if (!aberta) lembrarAberta(true)
    const acaba = op === 'apagar' || (op === 'desfazer' && patrol !== null && patrol.pontos.length === 1)
    // Só quando o foco está aqui dentro: quem apagou pelo teclado continua no
    // bloco; quem usa o ponteiro (ou um navegador que não foca botão no
    // clique) não tem o foco puxado de outro lugar.
    if (acaba && secaoRef.current?.contains(document.activeElement) === true) {
      focoAoAcabar.current = true
    }
    onPatrolOp(op)
  }

  return (
    <section ref={secaoRef} className="lb-section lb-token-opt">
      <OpcionalDaFicha
        rotulo="Patrulha"
        preenchido={patrol !== null}
        aberta={aberta}
        onAbertaChange={lembrarAberta}
        resumo={patrol === null ? undefined : patrolSummary(patrol)}
        dicaId={dicaId}
      >
        <button type="button" className="lb-btn lb-btn--block" disabled={!canAdvance} aria-describedby={canAdvance ? undefined : reasonId} onClick={() => pedir('avancar')}>
          Avançar patrulha
        </button>
        {!canAdvance && (
          <span id={reasonId} className="lb-label">
            Marque pelo menos 2 pontos: ponha a ficha em cada lugar da ronda e clique em "Marcar ponto aqui".
          </span>
        )}
        <button ref={marcarRef} type="button" className="lb-btn lb-btn--ghost lb-btn--block" onClick={() => pedir('marcar')}>
          Marcar ponto aqui
        </button>
        {patrol !== null && (
          <>
            <button type="button" className="lb-btn lb-btn--ghost lb-btn--block" onClick={() => pedir('desfazer')}>
              Tirar último ponto
            </button>
            <button type="button" className="lb-btn lb-btn--ghost lb-btn--block" onClick={() => pedir('apagar')}>
              Apagar rota
            </button>
            {/* O mestre precisa saber o que sai para a mesa e o que fica com ele. */}
            <span className="lb-label">A rota só você vê. Quem joga vê o NPC andar só quando ele está na visão.</span>
          </>
        )}
      </OpcionalDaFicha>
      {/* Só enquanto a linha é botão: com rota o cabeçalho para, e frase sem
          controle que a leia ficaria solta no fluxo (a dica sob demanda só
          tira do fluxo a frase ligada a um controle ativo). */}
      {patrol === null && (
        <p id={dicaId} className="lb-field__hint">
          {PATRULHA_HINT}
        </p>
      )}
    </section>
  )
}
