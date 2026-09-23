import { useId, useState } from 'react'
import type { Token } from '../types/map'
import { tokenPublicNameMode, type TokenPublicNameMode } from '../lib/tokenPublicName'

export interface TokenNameControlsProps {
  name: string
  onNameChange: (name: string) => void
  /** `Token.publicName` da ficha selecionada — ausente é "O mesmo". */
  publicName: Token['publicName']
  /** `undefined` = "O mesmo", texto = "Outro", `null` = "Nenhum". */
  onPublicNameChange: (publicName: Token['publicName']) => void
}

const PUBLIC_NAME_OPTIONS: Array<{ mode: TokenPublicNameMode; label: string }> = [
  { mode: 'same', label: 'O mesmo' },
  { mode: 'other', label: 'Outro' },
  { mode: 'none', label: 'Nenhum' },
]

/** O valor que cada escolha grava. "Outro" começa vazio: o nome de trabalho some da mesa na hora. */
function publicNameFor(mode: TokenPublicNameMode, current: Token['publicName']): Token['publicName'] {
  if (mode === 'same') return undefined
  if (mode === 'none') return null
  return typeof current === 'string' ? current : ''
}

/**
 * Nome do Token selecionado — é o texto que aparece embaixo do token no mapa
 * e na lista "Atribuir token" da aba de jogo. Mesmo formato do campo Nome de
 * `RoomControls`.
 *
 * "Nome para os jogadores" (O mesmo | Outro | Nenhum): o que a mesa lê embaixo
 * da ficha. "Nome" continua sendo o do mestre e o que o DONO da ficha vê; a
 * troca acontece no recorte do jogador (`lib/tokenPublicName.ts`). A caixa do
 * "Outro" grava ao sair dela (Tab, clique fora ou Enter) — uma entrada de
 * Ctrl+Z por nome, não uma por tecla; Esc desiste do que foi digitado.
 */
export function TokenNameControls({ name, onNameChange, publicName, onPublicNameChange }: TokenNameControlsProps) {
  const otherId = useId()
  const hintId = useId()
  const mode = tokenPublicNameMode(publicName)
  /** Texto em edição na caixa do "Outro"; `null` = mostrando o valor gravado. */
  const [draft, setDraft] = useState<string | null>(null)
  const savedOther = typeof publicName === 'string' ? publicName : ''

  const commitDraft = () => {
    if (draft !== null && draft !== savedOther) onPublicNameChange(draft)
    setDraft(null)
  }

  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Token</h2>
      <div className="lb-field">
        <label className="lb-label" htmlFor="lb-token-name">
          Nome
        </label>
        <input id="lb-token-name" className="lb-input" value={name} onChange={(event) => onNameChange(event.target.value)} />
      </div>
      <div className="lb-field">
        <span className="lb-label">Nome para os jogadores</span>
        <div className="lb-seg" role="radiogroup" aria-label="Nome para os jogadores" aria-describedby={hintId}>
          {PUBLIC_NAME_OPTIONS.map((option) => (
            <button
              key={option.mode}
              type="button"
              role="radio"
              aria-checked={mode === option.mode}
              className="lb-seg__option"
              onClick={() => {
                if (option.mode === mode) return
                setDraft(null)
                onPublicNameChange(publicNameFor(option.mode, publicName))
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
        {mode === 'other' && (
          <>
            <label className="lb-label" htmlFor={otherId}>
              Outro nome para os jogadores
            </label>
            <input
              id={otherId}
              className="lb-input"
              value={draft ?? savedOther}
              placeholder="Ex.: Estivador"
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commitDraft}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
                if (event.key === 'Escape') setDraft(null)
              }}
            />
          </>
        )}
        <p id={hintId} className="lb-field__hint">
          {mode === 'none'
            ? 'A ficha aparece sem nome para a mesa.'
            : mode === 'other'
              ? 'A mesa lê este nome embaixo da ficha; o nome acima fica só com você.'
              : 'A mesa lê o nome acima embaixo da ficha.'}{' '}
          Quem joga com esta ficha sempre vê o nome real.
        </p>
      </div>
    </section>
  )
}
