import type { PinKind } from '../types/map'
import { PIN_GLYPH, PIN_KIND_LABELS, PIN_KIND_ORDER } from '../lib/pins'
import { Toggle } from './Toggle'

export interface PinControlsProps {
  kind: PinKind
  onKindChange: (kind: PinKind) => void
  /** `null` = nenhum pino selecionado: só o tipo do próximo aparece. */
  description: string | null
  onDescriptionChange: (description: string) => void
  /** Pino travado não se move no arrasto — continua clicável para destravar aqui. */
  locked: boolean
  onLockedChange: (locked: boolean) => void
  image: string | null
  onChooseImage: () => void
  onClearImage: () => void
  onDelete: () => void
}

/**
 * Painel do ponto de interesse. Dois estados, um componente só:
 *
 * - com a ferramenta Pino na mão e nada selecionado, aparece só o TIPO — é a
 *   preferência do próximo pino, do mesmo jeito que `DoorKindControls` mostra
 *   o tipo da próxima porta;
 * - com um pino selecionado, aparecem também a descrição, a imagem e o botão
 *   de excluir, porque aí existe um pino concreto para editar.
 *
 * O título é "Ponto de interesse", não "Pino": o botão da barra já se chama
 * "Pino" e dois rótulos idênticos na mesma tela confundem quem lê por leitor
 * de tela (e o `getByRole` dos specs).
 */
export function PinControls({
  kind,
  onKindChange,
  description,
  onDescriptionChange,
  locked,
  onLockedChange,
  image,
  onChooseImage,
  onClearImage,
  onDelete,
}: PinControlsProps) {
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Ponto de interesse</h2>
      <div className="lb-seg" role="radiogroup" aria-label="Tipo do pino">
        {PIN_KIND_ORDER.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={kind === option}
            className="lb-seg__option"
            onClick={() => onKindChange(option)}
          >
            <span className="lb-pin-glyph" aria-hidden="true">
              {PIN_GLYPH[option]}
            </span>
            {PIN_KIND_LABELS[option]}
          </button>
        ))}
      </div>
      {description !== null && (
        <>
          <div className="lb-field">
            <label className="lb-label" htmlFor="lb-pin-description">
              Descrição
            </label>
            <textarea
              id="lb-pin-description"
              className="lb-input lb-textarea"
              rows={4}
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
            />
          </div>
          {/* Mesmo rótulo de `ItemTransformControls` ("Travado"), porque é a
              mesma promessa: o item fica onde está quando alguém esbarra nele
              arrastando. O pino não usa aquele componente porque não tem
              rotação nem "oculto no editor" separado do resto do painel. */}
          <Toggle label="Travado" checked={locked} onChange={onLockedChange} />
          {/* Só o nome do arquivo, nunca o caminho inteiro: o cartão do jogador
              recebe a imagem embutida, e mostrar a pasta do mestre aqui só
              enche a coluna. Data URL não tem nome, então diz o que é. */}
          {image !== null && <span className="lb-label">Imagem escolhida</span>}
          <button type="button" className="lb-btn lb-btn--block" onClick={onChooseImage}>
            {image === null ? 'Escolher imagem...' : 'Trocar imagem...'}
          </button>
          {image !== null && (
            <button type="button" className="lb-btn lb-btn--ghost" onClick={onClearImage}>
              Remover imagem
            </button>
          )}
          <button type="button" className="lb-btn lb-btn--ghost lb-btn--block" onClick={onDelete}>
            Excluir ponto de interesse
          </button>
        </>
      )}
    </section>
  )
}
