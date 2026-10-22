import { useId, type KeyboardEvent, type ReactNode } from 'react'
import { Dialogo } from './grimorio/Dialogo'
import { SHORTCUT_COLUMN_TITLES, shortcutColumns, type ShortcutCombo, type ShortcutGroup } from './shortcutSheet'
import './ShortcutsDialog.css'

export interface ShortcutsDialogProps {
  onClose: () => void
}

/** Letras e flags são fixas enquanto o app roda: a tela é montada uma vez. */
const COLUMNS = shortcutColumns()

/**
 * Tela de atalhos: o que cada letra e cada combinação faz no editor, em duas
 * colunas como no protótipo (Ferramentas e Geral), cada uma com seus assuntos.
 * Abre pela tecla `?` com o foco no mapa (sem pino selecionado — com pino, o
 * `?` é dele) e pelo botão do topo do livro; fecha com Esc, com o `?` de novo,
 * no X ou no fundo.
 *
 * Casca do Grimório (`Dialogo`): portal no `body`, foco preso dentro e
 * devolvido a quem abriu. Abre parada (`semEntrada`), de propósito: a tela
 * abre sobretudo pelo teclado, e movimento em resposta a tecla só atrasa a leitura.
 */
export function ShortcutsDialog({ onClose }: ShortcutsDialogProps) {
  // A mesma tecla que abriu fecha. Segurada, o teclado repete o `?`: sem a
  // trava a janela fecharia e o mapa a abriria de novo, piscando.
  const fecharNoMesmoAtalho = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== '?' || event.ctrlKey || event.metaKey || event.altKey) return
    event.preventDefault()
    if (!event.repeat) onClose()
  }

  return (
    <Dialogo
      aberto
      titulo="Atalhos do teclado"
      descricao="Valem fora dos campos de texto. Num campo, as letras escrevem."
      onFechar={onClose}
      classe="lb-shortcuts"
      semEntrada
      aoTeclar={fecharNoMesmoAtalho}
    >
      {/* O foco entra pela lista — é ela que rola nas setas quando a janela é baixa. */}
      <div className="lb-shortcuts__body" tabIndex={0}>
        {COLUMNS.map((groups, index) => (
          <ShortcutColumnView key={SHORTCUT_COLUMN_TITLES[index]} title={SHORTCUT_COLUMN_TITLES[index]} groups={groups} wide={index > 0} />
        ))}
      </div>
    </Dialogo>
  )
}

/** Uma coluna do protótipo: o título ("Ferramentas", "Geral") e os assuntos dela. */
function ShortcutColumnView({ title, groups, wide }: { title: string; groups: readonly ShortcutGroup[]; wide: boolean }) {
  return (
    <div className={`lb-shortcuts__column${wide ? ' lb-shortcuts__column--wide' : ''}`}>
      <h3 className="lb-shortcuts__column-title">{title}</h3>
      <div className="lb-shortcuts__groups">
        {groups.map((group) => (
          <ShortcutGroupView key={group.title} group={group} />
        ))}
      </div>
    </div>
  )
}

/** Um assunto: título e as linhas "o que faz — tecla". */
function ShortcutGroupView({ group }: { group: ShortcutGroup }) {
  const headingId = useId()
  return (
    <div className="lb-shortcuts__group" role="group" aria-labelledby={headingId}>
      <h4 id={headingId} className="lb-eyebrow">
        {group.title}
      </h4>
      <ul className="lb-shortcuts__list">
        {group.rows.map((row) => (
          // O espaço em TEXTO entre as duas metades não é enfeite: sem ele a
          // linha se lê "PinoY" — para leitor de tela e para quem busca a
          // tecla no texto —, e a distância visual vem do CSS.
          <li key={`${row.what}|${row.combo.keys.join('+')}`} className="lb-shortcuts__row">
            <span className="lb-shortcuts__what">{row.what}</span> <Keys combo={row.combo} />
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * As teclas como estão no teclado — cada uma numa tecla desenhada, unidas por
 * "+" — e o gesto por extenso ("segurar L + arrastar", "Alt (tocar)").
 */
function Keys({ combo }: { combo: ShortcutCombo }) {
  const parts: ReactNode[] = []
  if (combo.hold) parts.push(<span key="hold">segurar</span>)
  combo.keys.forEach((key, index) => {
    if (index > 0) parts.push(<span key={`plus-${index}`}>+</span>)
    parts.push(
      <kbd key={`key-${index}`} className="lb-key">
        {key}
      </kbd>,
    )
  })
  // Só "Alt" não diria que é apertar e soltar logo: segurado, o Alt é das guias de medir.
  if (combo.tap) parts.push(<span key="tap">(tocar)</span>)
  if (combo.mouse) {
    if (combo.keys.length > 0) parts.push(<span key="plus-mouse">+</span>)
    parts.push(<span key="mouse">{combo.mouse}</span>)
  }
  // Espaço em texto entre as peças, pelo mesmo motivo da linha: "Ctrl + Z".
  return <span className="lb-shortcuts__keys">{parts.flatMap((part, index) => (index === 0 ? [part] : [' ', part]))}</span>
}
