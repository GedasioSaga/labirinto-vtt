import { useId } from 'react'
import { Toggle } from './Toggle'
import './TokenControls.css'

export interface TokenNpcControlsProps {
  npc: boolean
  onNpcChange: (npc: boolean) => void
}

/** Texto que diz ao mestre o que a marca muda — é o único efeito visível dela. */
export const TOKEN_NPC_HINT = 'Não vira botão de "Atribuir" no card de quem espera personagem; continua na lista.'

/**
 * Marca de NPC da ficha selecionada. Sem ela o mestre não tinha como tirar o
 * Mordomo dos botões de um clique do painel da sala (`RoomPanel`): o campo
 * existia no mapa, mas nada no app o gravava. Mesmo interruptor (`Toggle`) do
 * "Travado"/"Oculto", com efeito imediato e sem botão Salvar.
 *
 * Abre o grupo "Comportamento" da ficha (peça ux-ficha-grupos), com "Ficha de
 * jogador" logo abaixo: as duas dizem de quem é a ficha, e o grupo tira a
 * divisória e o respiro entre as linhas (`lb-token-grupo`, TokenControls.css).
 */
export function TokenNpcControls({ npc, onNpcChange }: TokenNpcControlsProps) {
  const hintId = useId()
  return (
    <section className="lb-section">
      <Toggle label="Ficha de NPC" checked={npc} onChange={onNpcChange} describedBy={hintId} />
      <p className="lb-field__hint" id={hintId}>
        {TOKEN_NPC_HINT}
      </p>
    </section>
  )
}
