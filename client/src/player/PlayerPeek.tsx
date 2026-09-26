import { useEffect } from 'react'
import type { RegionPoint } from '../types/map'
import type { Espiada } from '../lib/espiar'

interface PlayerPeekProps {
  view: Espiada
  /** Quanto tempo o quadro fica: a barra de baixo encolhe nesse tempo. Quem o tira é a conexão. */
  durationMs: number
  onClose: () => void
  /** A cor do chão do mapa do jogador: o recorte fala a mesma língua do mapa dele. */
  floorColor?: string
}

/** Chão de mapa novo (`lib/mapFile.ts`, DEFAULT_FLOOR_STYLE): o marrom chapado do minimapa. */
const CHAO_PADRAO = '#a8776a'
/** Espessuras em frações de casa: parede em linha fina, porta como retângulo curto e grosso. */
const PAREDE_CASAS = 0.06
const PORTA_CASAS = 0.2
/** Raio da ficha em frações do tamanho dela (em casas): o disco do mapa, um pouco menor. */
const FICHA_CASAS = 0.35

function ringsPath(rings: readonly RegionPoint[][]): string {
  return rings
    .filter((ring) => ring.length >= 3)
    .map((ring) => `M${ring.map((p) => `${p.x} ${p.y}`).join('L')}Z`)
    .join('')
}

function isTextField(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || (target instanceof HTMLElement && target.isContentEditable)
}

/**
 * ESPIAR PELA PASSAGEM — o quadro redondo com o que se vê do outro lado, por
 * alguns segundos. Linguagem do minimapa Resident Evil: chão chapado, parede
 * em linha fina clara, porta como retângulo pequeno, fichas em ponto de cor;
 * sem grade, sem textura, sem nome — nem da cena, nem de ficha.
 *
 * Não tapa o mapa (fica no alto, como o recado) e não rouba o foco: quem está
 * digitando continua digitando. Fecha pelo botão, por Escape fora de campo de
 * texto, ou sozinho no fim do tempo (`playerConnection`).
 */
export function PlayerPeek({ view, durationMs, onClose, floorColor = CHAO_PADRAO }: PlayerPeekProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isTextField(event.target)) onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const { raio, grid } = view
  const lado = raio * 2
  const fichas = view.tokens.length
  const descricao = fichas === 0 ? 'Do outro lado: ninguém à vista' : fichas === 1 ? 'Do outro lado: uma ficha à vista' : `Do outro lado: ${fichas} fichas à vista`

  return (
    <section className="pp-peek" aria-label="Espiando pela passagem">
      <p className="pp-peek__title" aria-live="polite">
        Espiando pela passagem
      </p>
      <svg className="pp-peek__view" viewBox={`${-raio} ${-raio} ${lado} ${lado}`} role="img" aria-label={descricao}>
        <defs>
          <clipPath id="pp-peek-clip">
            <circle cx={0} cy={0} r={raio} />
          </clipPath>
        </defs>
        <g clipPath="url(#pp-peek-clip)">
          <rect className="pp-peek__fog" x={-raio} y={-raio} width={lado} height={lado} />
          <path className="pp-peek__floor" d={ringsPath(view.vision)} fill={floorColor} />
          {view.roofs.map((ring, i) => (
            <path key={`t${i}`} className="pp-peek__roof" d={ringsPath([ring])} strokeWidth={grid * PAREDE_CASAS} />
          ))}
          {view.concealed.map((ring, i) => (
            <path key={`z${i}`} className="pp-peek__concealed" d={ringsPath([ring])} />
          ))}
          {view.walls.map((w, i) => (
            <line key={`w${i}`} className="pp-peek__wall" x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} strokeWidth={grid * PAREDE_CASAS} />
          ))}
          {view.doors.map((d, i) => (
            <line
              key={`d${i}`}
              className={d.open ? 'pp-peek__door pp-peek__door--open' : 'pp-peek__door'}
              x1={d.x1}
              y1={d.y1}
              x2={d.x2}
              y2={d.y2}
              strokeWidth={grid * PORTA_CASAS}
            />
          ))}
          {view.tokens.map((t, i) => (
            <circle key={`f${i}`} className="pp-peek__token" cx={t.x} cy={t.y} r={t.size * grid * FICHA_CASAS} fill={t.color} />
          ))}
          {/* De onde se olha: o pino do outro lado. Decorativo. */}
          <circle className="pp-peek__eye" cx={0} cy={0} r={grid * 0.12} aria-hidden="true" />
        </g>
        <circle className="pp-peek__rim" cx={0} cy={0} r={raio} />
      </svg>
      <div className="pp-peek__timer" aria-hidden="true">
        <span className="pp-peek__timer-bar" style={{ animationDuration: `${durationMs}ms` }} />
      </div>
      <button type="button" className="pp-note__close" onClick={onClose}>
        Fechar
      </button>
    </section>
  )
}
