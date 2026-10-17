import { useEffect, useState } from 'react'
import type { DoorSide, DoorState } from '../types/map'
import { ITEM_NAME_MAX_LENGTH } from '../lib/items'

export interface WallDoorControlsProps {
  door: DoorState | null
  onToggleDoor: () => void
  onToggleOpen: () => void
  /** `DoorState.locked` existe no schema desde sempre e nunca teve UI (grep:
   *  só tipo e teste) — este é o primeiro leitor/escritor com interface. */
  onToggleLocked: () => void
  /** Liga/desliga `DoorState.semEspiar`: desligado, o jogador não espia por esta porta (quem recusa é o host). */
  onToggleSemEspiar: () => void
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
  /**
   * PORTA ANIMADA: "Animação ao abrir" — id do registro
   * (`portas/animacoesDePorta.ts`), ou `null` = "Sem animação". Sem ele, o
   * seletor não aparece.
   */
  onAnimacaoChange?: (id: string | null) => void
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
 * "Virar porta" da parede lisa selecionada. A porta selecionada tem ficha
 * própria (`livro/FichaDaPorta.tsx`, fatia 11): aberta, trancada, secreta,
 * quem abre e a aparência moram lá, e "Virar parede sólida" no "Mais ações"
 * da cabeça. As props são a ligação inteira da porta (o App monta uma vez e a
 * ficha usa o resto).
 */
export function WallDoorControls({ door, onToggleDoor }: WallDoorControlsProps) {
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Porta</h2>
      <button type="button" className="lb-btn lb-btn--block" onClick={onToggleDoor}>
        {door === null ? 'Virar porta' : 'Virar parede sólida'}
      </button>
    </section>
  )
}
