import { useId } from 'react'
import { RevealToControls, type RevealToControlsProps } from './PlayerSecretControls'
import { Toggle } from './Toggle'

export interface ItemTransformControlsProps {
  /** Rótulo da seção — o tipo de entidade selecionada (ex.: "Token",
   *  "Objeto", "Escada"). Cada tipo que usa este controle renderiza sua
   *  própria seção, mesmo padrão de TokenImageControls/PortalControls. */
  title: string
  /** Ausente (junto de onRotationChange) pra entidades sem `rotation` no
   *  schema (Wall/Light/Region não têm o campo) — omite o input de graus. */
  rotation?: number
  onRotationChange?: (rotation: number) => void
  locked: boolean
  onLockedChange: (locked: boolean) => void
  /** Ausente (junto de onHiddenChange) pra entidade cujo render IGNORA
   *  `hidden` — é o caso de Region: `pixi/drawRegions.ts` desenha sem
   *  consultar o campo, então o interruptor ali seria um controle morto, que
   *  o mestre marca e nada muda na tela. Mesmo mecanismo de `rotation` acima
   *  e de `secret` abaixo: omitido → a linha não renderiza. */
  hidden?: boolean
  onHiddenChange?: (hidden: boolean) => void
  /** A5 — "Oculto para jogadores". Ausente (junto do callback) omite o toggle. */
  secret?: boolean
  onSecretChange?: (secret: boolean) => void
  /**
   * "Revelar para…" quem descobriu a ficha secreta. Só com a sala aberta, e
   * só aparece com o "Oculto para jogadores" ligado. Ausente/`null` omite.
   */
  reveal?: RevealToControlsProps | null
}

/**
 * Controle genérico de rotação/travar/ocultar — reusado por qualquer seção
 * de entidade que tenha esses campos (Wall, Light, Region, Token, Prop,
 * Stair, todos opcionais em types/map.ts). O chamador (PropertiesPanel) já
 * resolve `item.rotation ?? 0` / `!!item.locked` / `!!item.hidden` (veracidade,
 * nunca `=== null`) antes de passar pra cá — este componente só exibe e
 * repassa o valor editado, não faz a checagem de opcional.
 *
 * "Oculto no editor" é o rótulo do toggle de propósito, não "Invisível":
 * `hidden` aqui é só organização de cena do mestre (ver Token.hidden em
 * types/map.ts). "Oculto para jogadores" (`secret`, A5) é o outro toggle:
 * o item fica no editor, só não sai no recorte do jogador.
 */
export function ItemTransformControls({
  title,
  rotation,
  onRotationChange,
  locked,
  onLockedChange,
  hidden,
  onHiddenChange,
  secret,
  onSecretChange,
  reveal = null,
}: ItemTransformControlsProps) {
  const showRotation = rotation !== undefined && onRotationChange !== undefined
  // React.useId(): duas seções deste componente podem coexistir no DOM em
  // teoria (ex.: um dia mostrar Token e Prop juntos) — id fixo duplicaria
  // `htmlFor`/`id` e quebraria o clique no <label>. useId() gera um id único
  // por instância, mesmo padrão recomendado pra componente reusável do React.
  const rotationId = useId()

  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">{title}</h2>
      {showRotation && (
        <div className="lb-field">
          <label className="lb-label" htmlFor={rotationId}>
            Rotação
          </label>
          <div className="lb-inputgroup">
            <input
              id={rotationId}
              className="lb-input"
              type="number"
              step={1}
              value={Math.round(rotation)}
              onChange={(event) => onRotationChange(Number(event.target.value))}
            />
            <span className="lb-inputgroup__suffix">°</span>
          </div>
        </div>
      )}
      <Toggle label="Travado" checked={locked} onChange={onLockedChange} />
      {hidden !== undefined && onHiddenChange !== undefined && (
        <Toggle label="Oculto no editor" checked={hidden} onChange={onHiddenChange} />
      )}
      {secret !== undefined && onSecretChange !== undefined && (
        <Toggle label="Oculto para jogadores" checked={secret} onChange={onSecretChange} />
      )}
      {reveal !== null && secret === true && <RevealToControls {...reveal} />}
    </section>
  )
}
