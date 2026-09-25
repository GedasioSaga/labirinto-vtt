import { useEffect, useId, useState } from 'react'
import type { DoorSide, DoorState } from '../types/map'
import { ITEM_NAME_MAX_LENGTH } from '../lib/items'
import { Toggle } from './Toggle'

export interface WallDoorControlsProps {
  door: DoorState | null
  onToggleDoor: () => void
  onToggleOpen: () => void
  /** `DoorState.locked` existe no schema desde sempre e nunca teve UI (grep:
   *  só tipo e teste) — este é o primeiro leitor/escritor com interface. */
  onToggleLocked: () => void
  /** Liga/desliga `DoorState.secret`: para o jogador a porta vira parede comum. */
  onToggleSecret: () => void
  /** "Revelar passagem": tira o segredo da porta e o oculto da sala ligada, num clique. */
  onRevealPassage: () => void
  /**
   * CHAVE ABRE PORTA: o nome do item que abre a porta trancada ("" tira).
   * Chega só ao sair do campo ou no Enter. Sem ele, o campo não aparece.
   */
  onKeyChange?: (nome: string) => void
  /** Porta de um lado: 'left'/'right' só abre de lá; `null` abre dos dois lados. */
  onOpensFromChange: (side: DoorSide | null) => void
}

/**
 * "Abre com": o item da mochila que destranca a porta (ou o pino de viagem
 * trancado, `PinTravelControls`) sem pedir ao mestre. O nome só vale ao sair
 * do campo (ou Enter): cada letra não vira um passo do desfazer — o mesmo
 * molde do nome do item pegável no pino.
 */
export function DoorKeyField({
  value,
  onChange,
  placeholder = 'Nome do item (vazio: só o mestre abre)',
}: {
  value: string
  onChange: (nome: string) => void
  placeholder?: string
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const commit = () => {
    if (draft.trim() === value) return
    onChange(draft)
  }
  return (
    <label className="lb-field">
      <span className="lb-label">Abre com</span>
      <input
        className="lb-input"
        type="text"
        aria-label="Abre com"
        placeholder={placeholder}
        value={draft}
        maxLength={ITEM_NAME_MAX_LENGTH}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit()
        }}
      />
    </label>
  )
}

/**
 * Vira a parede selecionada em porta (ou de volta em parede sólida), e alterna aberta e trancada.
 *
 * Rótulos fixos (auditoria 14/09): antes o toggle trocava o próprio texto
 * com o estado ("Fechada" desligado, "Aberta" ligado) e não dava para saber o
 * que ligar significava. O rótulo nomeia o estado LIGADO; o switch mostra se está.
 *
 * PORTA SECRETA: "Secreta" esconde a porta dos jogadores (chega a eles como
 * parede); com ela ligada aparece "Revelar passagem", o gesto de mesa de
 * mostrar a passagem — desliga o segredo da porta e da sala do outro lado.
 */
export function WallDoorControls({ door, onToggleDoor, onToggleOpen, onToggleLocked, onToggleSecret, onRevealPassage, onKeyChange, onOpensFromChange }: WallDoorControlsProps) {
  const secret = door?.secret === true
  const secretHintId = `${useId()}-secreta`
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Porta</h2>
      <button type="button" className="lb-btn lb-btn--block" onClick={onToggleDoor}>
        {door === null ? 'Virar porta' : 'Virar parede sólida'}
      </button>
      {door !== null && (
        <div className="lb-field">
          <Toggle label="Aberta" checked={door.open} onChange={onToggleOpen} />
          <Toggle label="Trancada" checked={door.locked} onChange={onToggleLocked} />
          <Toggle label="Secreta" checked={secret} onChange={onToggleSecret} describedBy={secretHintId} />
          <p id={secretHintId} className="lb-field__hint">
            {secret ? 'Os jogadores veem só a parede.' : 'Para os jogadores, vira parede até você revelar.'}
          </p>
          {secret && (
            <button type="button" className="lb-btn lb-btn--block" onClick={onRevealPassage}>
              Revelar passagem
            </button>
          )}
          <OpensFromField opensFrom={door.opensFrom} onOpensFromChange={onOpensFromChange} />
        </div>
      )}
      {door !== null && door.locked && onKeyChange !== undefined && <DoorKeyField value={door.abreCom ?? ''} onChange={onKeyChange} />}
    </section>
  )
}

/** Lado que "Só deste lado" liga primeiro; "Trocar o lado" inverte. */
const FIRST_SIDE: DoorSide = 'right'

function otherSide(side: DoorSide): DoorSide {
  return side === 'right' ? 'left' : 'right'
}

/**
 * PORTA DE UM LADO: "Abre por" (Os dois lados | Só deste lado). Com um lado só,
 * a seta no mapa (`pixi/drawDoors.ts`) aponta de onde abre, e "Trocar o lado"
 * inverte. Mesmo segmento de `DoorKindControls`.
 */
function OpensFromField({ opensFrom, onOpensFromChange }: { opensFrom: DoorSide | undefined; onOpensFromChange: (side: DoorSide | null) => void }) {
  const hintId = `${useId()}-lado`
  const oneSide = opensFrom !== undefined
  return (
    <>
      <div className="lb-seg" role="radiogroup" aria-label="Abre por" aria-describedby={hintId}>
        <button type="button" role="radio" aria-checked={!oneSide} className="lb-seg__option" onClick={() => onOpensFromChange(null)}>
          Os dois lados
        </button>
        <button type="button" role="radio" aria-checked={oneSide} className="lb-seg__option" onClick={() => onOpensFromChange(opensFrom ?? FIRST_SIDE)}>
          Só deste lado
        </button>
      </div>
      <p id={hintId} className="lb-field__hint">
        {oneSide ? 'A seta no mapa mostra o lado que abre. Do outro, o jogador lê "Não abre deste lado".' : 'Qualquer jogador encostado abre.'}
      </p>
      {oneSide && (
        <button type="button" className="lb-btn lb-btn--block" onClick={() => onOpensFromChange(otherSide(opensFrom))}>
          Trocar o lado
        </button>
      )}
    </>
  )
}
