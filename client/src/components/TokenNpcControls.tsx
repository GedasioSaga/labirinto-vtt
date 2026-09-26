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
 * Entra junto das outras chaves (peça P4 do laudo do painel): com "Ficha de
 * jogador", que o PropertiesPanel monta logo abaixo, forma um par de
 * interruptores sem divisória entre eles (`lb-token-chaves`, TokenControls.css).
 */
export function TokenNpcControls({ npc, onNpcChange }: TokenNpcControlsProps) {
  const hintId = useId()
  return (
    <section className="lb-section lb-token-chaves">
      <Toggle label="Ficha de NPC" checked={npc} onChange={onNpcChange} describedBy={hintId} />
      <p className="lb-field__hint" id={hintId}>
        {TOKEN_NPC_HINT}
      </p>
    </section>
  )
}
