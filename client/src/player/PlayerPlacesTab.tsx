import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { createPortal } from 'react-dom'
import type { Pin } from '../types/map'
import { buildFloorOutline } from '../lib/floorContour'
import { PIN_GLYPH } from '../lib/pins'
import { NAME_MAX_LENGTH } from '../net/protocol'
import { exploredOutline, pinLabel, placeLabel, type ExploredOutline, type PlaceSketch, type VisitedPlace } from './playerPlaces'

/**
 * Aba LUGARES do painel do jogador: os pontos conhecidos da cena (tocar centra
 * a câmera) e uma miniatura de cada lugar por onde ele passou, só com o que ele
 * explorou, com o nome que ELE deu. Nome de cena e de sala do mestre nunca
 * aparecem aqui: a miniatura não desenha texto nenhum.
 */

/** Preto do que ele nunca viu: o mesmo fundo da névoa. */
const UNSEEN = '#0b0b0d'
/** Chão explorado fora das peças de chão (pátio, rua sem chão desenhado): quase preto, só para dar a forma. */
const SEEN_GROUND = '#1c1c21'
/** Parede: linha fina clara, a mesma cor de `WALL_COLOR` (pixi/drawWalls.ts). */
const WALL = '#d8d2c4'
/** Porta: retângulo pequeno na cor de `DOOR_COLOR` (pixi/drawDoors.ts). */
const DOOR = '#d08c3a'
/** Folga em volta do explorado, em células: a borda não encosta no quadro. */
const FRAME_CELLS = 1
/** Lado maior do mapa dividido por isto dá o passo do contorno do chão: grosso o bastante para ser barato, fino para a miniatura. */
const FLOOR_STEP_DIVISOR = 200
const FLOOR_STEP_MIN = 4
/** Contornos de chão já calculados. O recorte chega de novo a cada passo da ficha, e o chão quase nunca muda. */
const FLOOR_CACHE_MAX = 16
const floorCache = new Map<string, string>()

function floorPath(sketch: PlaceSketch): string {
  if (sketch.floor.length === 0) return ''
  const step = Math.max(FLOOR_STEP_MIN, Math.max(sketch.width, sketch.height) / FLOOR_STEP_DIVISOR)
  const key = `${step}|${JSON.stringify(sketch.floor)}`
  const cached = floorCache.get(key)
  if (cached !== undefined) return cached
  const rings = buildFloorOutline(sketch.floor, { step }).flatMap((polygon) => [polygon.outer, ...polygon.holes])
  const path = rings
    .filter((ring) => ring.length >= 3)
    .map((ring) => `M${ring.map((p) => `${round(p.x)} ${round(p.y)}`).join('L')}Z`)
    .join('')
  floorCache.set(key, path)
  for (const old of floorCache.keys()) {
    if (floorCache.size <= FLOOR_CACHE_MAX) break
    floorCache.delete(old)
  }
  return path
}

function round(value: number): number {
  return Math.round(value * 10) / 10
}

const NOTHING_SEEN: ExploredOutline = { path: '', box: null }

interface PlaceMiniatureProps {
  place: VisitedPlace
  label: string
}

/** Desenho do lugar em estilo minimapa: chão chapado, parede linha fina clara, porta retângulo pequeno. Só dentro do explorado. */
export function PlaceMiniature({ place, label }: PlaceMiniatureProps) {
  const clipId = useId()
  const { sketch, explored } = place
  const outline = useMemo(() => (explored === null ? NOTHING_SEEN : exploredOutline(explored)), [explored])
  const floor = useMemo(() => floorPath(sketch), [sketch])
  const box = outline.box
  if (box === null || explored === null) {
    return (
      <svg className="pp-place__art" viewBox="0 0 4 3" role="img" aria-label={`${label}: nada explorado ainda`}>
        <rect x={0} y={0} width={4} height={3} fill={UNSEEN} />
      </svg>
    )
  }
  const frame = explored.cell * FRAME_CELLS
  const viewBox = `${box.x - frame} ${box.y - frame} ${box.width + 2 * frame} ${box.height + 2 * frame}`
  const walls = sketch.walls
    .filter((wall) => !wall.door)
    .map((wall) => `M${round(wall.x1)} ${round(wall.y1)}L${round(wall.x2)} ${round(wall.y2)}`)
    .join('')
  return (
    <svg className="pp-place__art" viewBox={viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Mapa de ${label}, só o que você explorou`}>
      <defs>
        <clipPath id={clipId}>
          <path d={outline.path} />
        </clipPath>
      </defs>
      <rect x={box.x - frame} y={box.y - frame} width={box.width + 2 * frame} height={box.height + 2 * frame} fill={UNSEEN} />
      <g clipPath={`url(#${clipId})`}>
        <path d={outline.path} fill={SEEN_GROUND} />
        {floor !== '' && <path d={floor} fill={sketch.floorColor} fillRule="evenodd" />}
        {sketch.rooms.map((room, index) => (
          <polygon key={index} points={room.points.map((p) => `${round(p.x)},${round(p.y)}`).join(' ')} fill={room.color} />
        ))}
        {walls !== '' && <path d={walls} fill="none" stroke={WALL} strokeWidth={1} vectorEffect="non-scaling-stroke" strokeLinecap="round" />}
        {sketch.walls.filter((wall) => wall.door).map((wall, index) => (
          <DoorMark key={index} x1={wall.x1} y1={wall.y1} x2={wall.x2} y2={wall.y2} />
        ))}
      </g>
      {/* Zona oculta por cima de tudo, como `redrawConcealed` na tela principal. Um polígono por zona:
          num caminho só, duas zonas sobrepostas de sentidos opostos abririam um buraco na interseção. */}
      {place.concealed.map((ring, index) => (
        <polygon key={index} className="pp-place__concealed" points={ring.map((p) => `${p.x},${p.y}`).join(' ')} fill={UNSEEN} />
      ))}
    </svg>
  )
}

/** Proporção da porta sobre o vão, e a espessura dela em fração do vão (com piso e teto em px de mundo). */
const DOOR_LENGTH_SHARE = 0.7
const DOOR_THICKNESS_SHARE = 0.22
const DOOR_THICKNESS_MIN = 3
const DOOR_THICKNESS_MAX = 10

function DoorMark({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  const length = Math.hypot(x2 - x1, y2 - y1)
  if (!(length > 0)) return null
  const width = length * DOOR_LENGTH_SHARE
  const thickness = Math.min(DOOR_THICKNESS_MAX, Math.max(DOOR_THICKNESS_MIN, length * DOOR_THICKNESS_SHARE))
  const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI
  const cx = (x1 + x2) / 2
  const cy = (y1 + y2) / 2
  return (
    <rect
      x={round(cx - width / 2)}
      y={round(cy - thickness / 2)}
      width={round(width)}
      height={round(thickness)}
      fill={DOOR}
      transform={`rotate(${round(angle)} ${round(cx)} ${round(cy)})`}
    />
  )
}

interface PlayerPlacesProps {
  pins: readonly Pin[]
  places: readonly VisitedPlace[]
  /** Id do lugar onde ele está agora: ganha o "Você está aqui". */
  currentPlace: string | undefined
  names: Readonly<Record<string, string>>
  onFocusPin: (pin: Pin) => void
  /** Nome novo (já aparado); vazio = voltar ao "Lugar N". */
  onRename: (placeId: string, name: string) => void
}

export function PlayerPlacesTab({ pins, places, currentPlace, names, onFocusPin, onRename }: PlayerPlacesProps) {
  const headingId = useId()
  const [openId, setOpenId] = useState<string | null>(null)
  const openers = useRef(new Map<string, HTMLButtonElement>())
  const open = openId === null ? undefined : places.find((place) => place.id === openId)

  // Estável entre snapshots: o visor religa o teclado (e devolve o foco ao "Fechar") quando `onClose` muda.
  const close = useCallback(() => {
    const opener = openId === null ? undefined : openers.current.get(openId)
    setOpenId(null)
    // Fechar devolve o foco à miniatura que abriu: quem veio pelo teclado continua de onde saiu.
    opener?.focus()
  }, [openId])

  return (
    <>
      <section className="pp-section" aria-labelledby={`${headingId}-pins`}>
        <h2 id={`${headingId}-pins`} className="pp-heading">
          Pontos conhecidos
        </h2>
        {pins.length === 0 ? (
          <p className="pp-empty">Nenhum ponto conhecido nesta cena.</p>
        ) : (
          <ul className="pp-list">
            {pins.map((pin) => {
              const label = pinLabel(pin)
              return (
                <li key={pin.id}>
                  <button type="button" className="pp-character pp-place-pin" aria-label={`Centralizar em ${label}`} onClick={() => onFocusPin(pin)}>
                    <span className="pp-place-pin__glyph" aria-hidden="true">
                      {PIN_GLYPH[pin.kind]}
                    </span>
                    <span className="pp-character__name pp-place-pin__name">{label}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="pp-section" aria-labelledby={`${headingId}-places`}>
        <h2 id={`${headingId}-places`} className="pp-heading">
          Onde já estive
        </h2>
        {places.length === 0 ? (
          <p className="pp-empty">Os lugares por onde você passar aparecem aqui.</p>
        ) : (
          <ul className="pp-places">
            {places.map((place) => {
              const label = placeLabel(place, names)
              const here = place.id === currentPlace
              return (
                <li key={place.id} className={here ? 'pp-place pp-place--here' : 'pp-place'}>
                  <button
                    ref={(el) => {
                      if (el === null) openers.current.delete(place.id)
                      else openers.current.set(place.id, el)
                    }}
                    type="button"
                    className="pp-place__open"
                    aria-label={`Abrir ${label} em tamanho grande`}
                    onClick={() => setOpenId(place.id)}
                  >
                    <PlaceMiniature place={place} label={label} />
                  </button>
                  <PlaceNameField placeId={place.id} label={label} defaultLabel={placeLabel(place, {})} custom={names[place.id]} onRename={onRename} />
                  {here && <span className="pp-place__here">Você está aqui</span>}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {open !== undefined && <PlaceViewer place={open} label={placeLabel(open, names)} onClose={close} />}
    </>
  )
}

interface PlaceNameFieldProps {
  placeId: string
  label: string
  defaultLabel: string
  custom: string | undefined
  onRename: (placeId: string, name: string) => void
}

/** O nome do lugar, editável ali mesmo. Enter ou sair do campo aplica; vazio (ou "Lugar N" de novo) volta ao número. */
function PlaceNameField({ placeId, label, defaultLabel, custom, onRename }: PlaceNameFieldProps) {
  const fieldId = useId()
  const [draft, setDraft] = useState(label)

  // O nome gravado manda: renomear em outra aba, ou o lugar trocar de número, recarrega o rascunho.
  useEffect(() => {
    setDraft(label)
  }, [label])

  function apply() {
    const cleaned = draft.trim()
    if (cleaned === '' || cleaned === defaultLabel) {
      setDraft(defaultLabel)
      if (custom !== undefined) onRename(placeId, '')
      return
    }
    if (cleaned !== custom) onRename(placeId, cleaned)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    // Enter num formulário de um campo só recarregaria a página.
    event.preventDefault()
    apply()
  }

  return (
    <form className="pp-place__name" onSubmit={submit}>
      <label className="pp-visually-hidden" htmlFor={fieldId}>
        Nome de {label}
      </label>
      <input
        id={fieldId}
        className="pp-input pp-place__input"
        type="text"
        value={draft}
        maxLength={NAME_MAX_LENGTH}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={apply}
      />
    </form>
  )
}

interface PlaceViewerProps {
  place: VisitedPlace
  label: string
  onClose: () => void
}

/**
 * O lugar em tamanho grande. Modal de verdade: o foco entra no "Fechar", o Tab
 * não sai dele, Escape e tocar fora fecham — e o Escape para aqui, sem fechar
 * junto a gaveta do painel que está por baixo.
 */
function PlaceViewer({ place, label, onClose }: PlaceViewerProps) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // O painel (gaveta) e os modos do mapa ouvem o Escape na janela: este é só do visor.
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key === 'Tab') {
        // O único controle do visor é o "Fechar": o Tab fica nele.
        event.preventDefault()
        closeRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return createPortal(
    <div
      className="pp-place-viewer__backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="pp-place-viewer" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId} className="pp-place-viewer__title">
          {label}
        </h2>
        <div className="pp-place-viewer__art">
          <PlaceMiniature place={place} label={label} />
        </div>
        <button ref={closeRef} type="button" className="pp-button pp-place-viewer__close" onClick={onClose}>
          Fechar
        </button>
      </div>
    </div>,
    document.body,
  )
}
