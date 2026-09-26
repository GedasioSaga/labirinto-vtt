import { useId, useState } from 'react'
import { AdvancedField, AdvancedSection } from './AdvancedSection'
import { RevealToControls, type RevealToControlsProps } from './PlayerSecretControls'
import { Toggle } from './Toggle'
import './ItemTransformControls.css'

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
  /**
   * CONGELAR FICHA: o interruptor "Congelado", logo abaixo do "Travado". Só a
   * ficha liga — Objeto, Sala e Região não têm jogador que as mova. Ausente
   * (junto de `onCongeladoChange`) omite a linha, mesmo mecanismo de `secret`.
   */
  congelado?: boolean
  onCongeladoChange?: (congelado: boolean) => void
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
  /**
   * Os raros no Avançado (só a ficha liga; peça ficha-em-ordem-de-tarefa, no
   * molde do painel Design do Figma UI3): Travado e "Oculto para jogadores",
   * gestos de mesa, ficam à vista; Rotação e "Oculto no editor" vão para um
   * Avançado recolhido no fim da própria seção. Numa ficha redonda girar só
   * mexe na foto, e esconder no editor é arrumação de cena — raros ao lado do
   * que se mexe toda rodada. Com um dos dois fora do padrão (girada, oculta no
   * editor), o Avançado nasce aberto: o que está no item não se esconde atrás
   * de um clique. Default `false`: Objeto, Sala e Região continuam como estão.
   */
  rarosNoAvancado?: boolean
}

/** O que a Rotação muda numa ficha: a foto gira; o disco sem foto é redondo e fica igual. */
export const ROTACAO_DA_FICHA_HINT = 'Gira a foto da ficha. Sem foto, o disco fica igual.'

/** "Oculto no editor" é arrumação do mestre: a ficha vira fantasma no editor (`tokensRenderer.ts`), e segue clicável. */
export const OCULTO_NO_EDITOR_HINT = 'No editor, a ficha vira um fantasma transparente, ainda clicável.'

/** O que separa "Congelado" do "Travado" logo acima: este segura o mestre também; aquele, só o jogador. */
export const CONGELADO_HINT = 'O jogador não move esta ficha; você continua movendo.'

interface CampoDeRotacaoProps {
  id: string
  rotation: number
  onRotationChange: (rotation: number) => void
  describedBy?: string
}

/** Graus inteiros, com o "°" dentro do campo. */
function CampoDeRotacao({ id, rotation, onRotationChange, describedBy }: CampoDeRotacaoProps) {
  return (
    <div className="lb-field">
      <label className="lb-label" htmlFor={id}>
        Rotação
      </label>
      <div className="lb-inputgroup">
        <input
          id={id}
          className="lb-input"
          type="number"
          step={1}
          value={Math.round(rotation)}
          aria-describedby={describedBy}
          onChange={(event) => onRotationChange(Number(event.target.value))}
        />
        <span className="lb-inputgroup__suffix">°</span>
      </div>
    </div>
  )
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
  congelado,
  onCongeladoChange,
  hidden,
  onHiddenChange,
  secret,
  onSecretChange,
  reveal = null,
  rarosNoAvancado = false,
}: ItemTransformControlsProps) {
  const congeladoHintId = useId()
  // React.useId(): duas seções deste componente podem coexistir no DOM em
  // teoria (ex.: um dia mostrar Token e Prop juntos) — id fixo duplicaria
  // `htmlFor`/`id` e quebraria o clique no <label>. useId() gera um id único
  // por instância, mesmo padrão recomendado pra componente reusável do React.
  const rotationId = useId()
  const campoDeRotacao = (describedBy?: string) =>
    rotation !== undefined && onRotationChange !== undefined ? (
      <CampoDeRotacao id={rotationId} rotation={rotation} onRotationChange={onRotationChange} describedBy={describedBy} />
    ) : null
  const chaveOcultoNoEditor = (describedBy?: string) =>
    hidden !== undefined && onHiddenChange !== undefined ? (
      <Toggle label="Oculto no editor" checked={hidden} onChange={onHiddenChange} describedBy={describedBy} />
    ) : null

  // Girada ou oculta no editor: um raro FORA do padrão. Decide como o Avançado
  // nasce, e o valor que chega depois com ele fechado (um Ctrl+Z) o abre.
  const temRaroMarcado = (rotation !== undefined && Math.round(rotation) !== 0) || hidden === true
  // Congelado na montagem: desligar o raro com o Avançado aberto não o recolhe
  // debaixo do ponteiro. O painel remonta a seção a cada ficha (`key`).
  const [nasceAberto] = useState(temRaroMarcado)
  // Ajuste de estado no render (o molde do React para estado que segue uma
  // prop): cada vez que um raro passa a valer, um pedido novo de abrir.
  const [raroAntes, setRaroAntes] = useState(temRaroMarcado)
  const [pedidoDeAbrir, setPedidoDeAbrir] = useState(0)
  if (temRaroMarcado !== raroAntes) {
    setRaroAntes(temRaroMarcado)
    if (temRaroMarcado) setPedidoDeAbrir((pedido) => pedido + 1)
  }

  return (
    <section className={rarosNoAvancado ? 'lb-section lb-item-transform--raros' : 'lb-section'}>
      <h2 className="lb-eyebrow">{title}</h2>
      {!rarosNoAvancado && campoDeRotacao()}
      <Toggle label="Travado" checked={locked} onChange={onLockedChange} />
      {congelado !== undefined && onCongeladoChange !== undefined && (
        // O porquê fica à vista: sem ele, "Congelado" e "Travado" leriam como a mesma coisa.
        <div className="lb-item-transform__congelado">
          <Toggle label="Congelado" checked={congelado} onChange={onCongeladoChange} describedBy={congeladoHintId} />
          <p id={congeladoHintId} className="lb-field__hint">
            {CONGELADO_HINT}
          </p>
        </div>
      )}
      {!rarosNoAvancado && chaveOcultoNoEditor()}
      {secret !== undefined && onSecretChange !== undefined && (
        <Toggle label="Oculto para jogadores" checked={secret} onChange={onSecretChange} />
      )}
      {reveal !== null && secret === true && <RevealToControls {...reveal} />}
      {rarosNoAvancado && (
        <AdvancedSection nasceAberta={nasceAberto} pedidoDeAbrir={pedidoDeAbrir}>
          {rotation !== undefined && onRotationChange !== undefined && (
            <AdvancedField hint={ROTACAO_DA_FICHA_HINT}>{(hintId) => campoDeRotacao(hintId)}</AdvancedField>
          )}
          {hidden !== undefined && onHiddenChange !== undefined && (
            <AdvancedField hint={OCULTO_NO_EDITOR_HINT}>{(hintId) => chaveOcultoNoEditor(hintId)}</AdvancedField>
          )}
        </AdvancedSection>
      )}
    </section>
  )
}
