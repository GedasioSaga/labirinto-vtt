import type { ClueEntry } from '../net/protocol'
import type { ColecaoProgresso } from '../lib/colecao'
import { PlayerClueList, PlayerColecaoList } from './PlayerClues'
import { placeLabel, type VisitedPlace } from './playerPlaces'

/** As pistas de um lugar, como a aba Lugares as mostra. `here` = o lugar onde ele está agora. */
export interface CluesOfPlace {
  key: string
  title: string
  here: boolean
  /** Da mais antiga à mais nova (a lista mostra a mais nova em cima). */
  clues: ClueEntry[]
}

/** O grupo das pistas sem lugar conhecido: mostradas por colega antes de ele ter lugar, ou de um lugar que ele já esqueceu. */
const OUTROS = 'Outros lugares'

/**
 * MINHAS PISTAS por mapa: o lugar onde ele está primeiro, depois os outros na
 * ordem da primeira visita, com o nome que ELE deu (`placeLabel`), e por
 * último as pistas de lugar desconhecido. Lugar sem pista não aparece.
 */
export function groupCluesByPlace(
  clues: readonly ClueEntry[],
  places: readonly VisitedPlace[],
  currentPlace: string | undefined,
  names: Readonly<Record<string, string>>,
): CluesOfPlace[] {
  const known = new Set(places.map((place) => place.id))
  const groups = places
    .map((place) => ({
      key: place.id,
      title: placeLabel(place, names),
      here: place.id === currentPlace,
      clues: clues.filter((clue) => clue.place === place.id),
    }))
    .filter((group) => group.clues.length > 0)
  const loose = clues.filter((clue) => clue.place === undefined || !known.has(clue.place))
  const ordered = [...groups.filter((group) => group.here), ...groups.filter((group) => !group.here)]
  return loose.length === 0 ? ordered : [...ordered, { key: '', title: OUTROS, here: false, clues: loose }]
}

interface PlayerCluesByPlaceProps {
  clues: readonly ClueEntry[]
  colecoes: readonly ColecaoProgresso[]
  places: readonly VisitedPlace[]
  currentPlace: string | undefined
  names: Readonly<Record<string, string>>
  onOpen: (clueId: string) => void
}

/**
 * MINHAS PISTAS na aba Lugares: as coleções no alto ("Letreiro 5 de 12") e,
 * embaixo, as pistas de cada lugar por onde ele passou. Tocar numa reabre o
 * cartão dela, como antes no Caderno.
 */
export function PlayerCluesByPlace({ clues, colecoes, places, currentPlace, names, onOpen }: PlayerCluesByPlaceProps) {
  if (clues.length === 0) {
    return (
      <>
        <PlayerColecaoList colecoes={colecoes} clues={clues} onOpen={onOpen} />
        <PlayerClueList clues={clues} onOpen={onOpen} />
      </>
    )
  }
  return (
    <>
      <PlayerColecaoList colecoes={colecoes} clues={clues} onOpen={onOpen} />
      {groupCluesByPlace(clues, places, currentPlace, names).map((group) => (
        <section key={group.key} className="pp-place-clues" aria-label={`Pistas: ${group.title}`}>
          <h3 className="pp-subheading">
            {group.title}
            {group.here && <span className="pp-subheading__here"> · você está aqui</span>}
          </h3>
          <PlayerClueList clues={group.clues} onOpen={onOpen} />
        </section>
      ))}
    </>
  )
}
