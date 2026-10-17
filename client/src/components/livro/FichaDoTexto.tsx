import { Essencial } from '../grimorio/Cartoes'
import { PlayerSecretControls, type PlayerSecretControlsProps } from '../PlayerSecretControls'
import { TextLabelControls, type TextLabelControlsProps } from '../TextLabelControls'
import './fichaDoItem.css'

/*
 * FICHA DO TEXTO (fatia 16b do design consolidado; decisão 4.1). O rótulo é
 * curto: tudo cabe no essencial — o campo do texto (agora com nome,
 * pendência da fatia 0), Cor, Tamanho da fonte, Fonte e o "Oculto para
 * jogadores". Os controles e os handlers são os de antes.
 */

export interface FichaDoTextoProps {
  rotulo: TextLabelControlsProps
  /** Oculto para jogadores (grupo `playerVisibility`). */
  jogadores?: PlayerSecretControlsProps
}

export function FichaDoTexto({ rotulo, jogadores }: FichaDoTextoProps) {
  return (
    <section className="lb-ficha-do-texto">
      {/* O título do bloco de antes, só para o leitor de tela: a cabeça já diz o tipo. */}
      <h2 className="gr-sr">Rótulo de texto</h2>
      <Essencial>
        <TextLabelControls {...rotulo} semTitulo />
        {jogadores !== undefined && <PlayerSecretControls {...jogadores} embutido />}
      </Essencial>
    </section>
  )
}
