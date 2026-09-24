import type { NoteEntry } from '../net/protocol'
import { letterTitle } from '../lib/correio'

/** "20:30": hora e minuto no relógio de quem lê, com zero à esquerda. */
export function formatNoteTime(at: number): string {
  const when = new Date(at)
  return `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`
}

/**
 * CADERNO do jogador: os recados que ele recebeu, o mais novo em cima, cada
 * um como "20:30 · Mestre: texto" — ou, no bilhete de um colega (CORREIO),
 * "20:30 · Bilhete de Ana, pelo pombo: texto". O texto entra como filho de texto do React
 * (nunca `innerHTML`): HTML do mestre aparece literal.
 *
 * Meta e texto ficam no MESMO parágrafo de propósito: nenhum elemento do
 * caderno tem, sozinho, o texto exato do recado — quem procura o cartão pelo
 * texto não acha o caderno no lugar.
 */
export function PlayerNotebook({ notes }: { notes: NoteEntry[] }) {
  if (notes.length === 0) {
    return <p className="pp-empty">Nenhum recado ainda. Os recados do mestre ficam guardados aqui, mesmo depois de fechar o cartão.</p>
  }
  return (
    <ol className="pp-notebook">
      {[...notes].reverse().map((note) => (
        <li key={note.id} className="pp-notebook__item">
          <span className="pp-notebook__meta">
            {formatNoteTime(note.at)} · {note.from !== undefined && note.via !== undefined ? letterTitle(note.from, note.via) : 'Mestre'}:
          </span>{' '}
          {note.text}
        </li>
      ))}
    </ol>
  )
}
