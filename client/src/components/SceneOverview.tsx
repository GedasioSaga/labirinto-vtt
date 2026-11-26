import { memo, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { SceneListItem } from '../stores/adventureStore'
import type { MapData } from '../types/map'
import { SECRET_ITEM_ALPHA } from '../pixi/constants'
import { WALL_COLOR, WALL_INTERIOR_ALPHA } from '../pixi/drawWalls'
import { theme } from '../theme'
import { CampoTexto } from './grimorio/CampoTexto'
import { Dialogo } from './grimorio/Dialogo'
import { sceneArt, type ArtFrame, type ArtToken, type SceneArt } from './sceneOverviewArt'
import { sceneTree, type SceneTreeRow } from '../lib/adventure'
import { planoDaMiniatura, type QuadroDaMiniatura } from '../lib/miniaturaDaCena'
import { semAcento } from '../lib/semAcento'
import { useMiniaturaDaCena } from './MiniaturaDaCena'

/** Ficha "Oculta no editor": o mesmo fantasma do editor (`HIDDEN_TOKEN_GHOST_ALPHA`, tokensRenderer.ts). */
const GHOST_TOKEN_OPACITY = 0.3
/**
 * Contorno do disco da ficha: o CLARO das bolinhas da lista de Cenas e do
 * painel Grupo (`.lb-cenas__pessoa`), e não o preto do editor. Na miniatura a
 * ficha tem 10 px, e a cor dela pode ser escura sobre chão escuro; e o preto
 * misturado a uma ficha laranja na borda dá pixels vermelho-escuros, que se
 * leem como o chão de outra cena.
 */
const TOKEN_OUTLINE = theme.color.parchmentFaint
const WALL_STROKE = `#${WALL_COLOR.toString(16).padStart(6, '0')}`

const CARD = '.lb-visao__cena'

/** "1 token", "3 tokens" — a contagem da lista de Cenas; `null` = a cena não abriu, não há mapa para contar. */
export function tokenCountLabel(count: number | null): string {
  if (count === null) return 'indisponível'
  return count === 1 ? '1 token' : `${count} tokens`
}

/**
 * Nome acessível da miniatura: o nome da cena e a contagem que a legenda
 * mostra, e quem está lá — o que a imagem diz a quem enxerga, o leitor de tela
 * diz em palavras.
 */
function sceneLabel(scene: SceneListItem, map: MapData | undefined): string {
  if (!scene.available) return `${scene.name}, arquivo não encontrado`
  const count = tokenCountLabel(scene.tokenCount)
  const names = (map?.tokens ?? []).map((token) => token.name.trim()).filter((name) => name.length > 0)
  return names.length > 0 ? `${scene.name}, ${count}: ${names.join(', ')}` : `${scene.name}, ${count}`
}

function viewBoxOf(frame: ArtFrame): string {
  return `${frame.x} ${frame.y} ${frame.width} ${frame.height}`
}

/**
 * A arte de cada mapa, guardada em memória pelo próprio `MapData` (a store é
 * imutável: mapa novo = chave nova, e o velho sai com o lixo). A lista de
 * Cenas e a Visão geral leem daqui: rolar, recolher pasta ou reabrir a janela
 * não recalcula o desenho de quem não mudou.
 */
const artesGuardadas = new WeakMap<MapData, Map<number, SceneArt | null>>()

/** A arte da cena (`sceneArt`), calculada uma vez por mapa e piso. */
export function arteDaCena(map: MapData, piso: number): SceneArt | null {
  let porPiso = artesGuardadas.get(map)
  if (porPiso === undefined) {
    porPiso = new Map()
    artesGuardadas.set(map, porPiso)
  }
  if (!porPiso.has(piso)) porPiso.set(piso, sceneArt(map, piso))
  return porPiso.get(piso) ?? null
}

/** A arte já está calculada? A lista usa para desenhar na hora, sem esperar a vez. */
export function arteJaPronta(map: MapData, piso: number): boolean {
  return artesGuardadas.get(map)?.has(piso) === true
}

/**
 * O mapa da cena em miniatura. `memo` pelo `MapData`: a store é imutável, então
 * a miniatura só redesenha quando AQUELA cena muda — uma ficha andando no
 * Salão não redesenha a Cripta. `piso`: o andar que o editor mostra dela.
 * `falta`: o que entra quando o mapa não tem área (na lista, nada: o quadro vazio).
 * `semNomes`: sem o `<title>` de cada ficha — a 40 px a bolinha tem 2 px, e o
 * nome do jogador já está nos retratos da linha.
 */
export const SceneThumbnail = memo(function SceneThumbnail({
  map,
  piso,
  falta,
  semNomes = false,
}: {
  map: MapData
  piso: number
  falta?: ReactNode
  semNomes?: boolean
}) {
  const art = useMemo(() => arteDaCena(map, piso), [map, piso])
  if (art === null) return falta === undefined ? <span className="lb-visao__falta">Mapa sem área para mostrar</span> : <>{falta}</>
  const fundo = art.mapRect ?? art.frame
  return (
    <svg viewBox={viewBoxOf(art.frame)} preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      <rect x={fundo.x} y={fundo.y} width={fundo.width} height={fundo.height} fill={art.background} />
      {art.floor.map((shape) => (
        <path key={shape.key} d={shape.d} fill={shape.color} fillRule="evenodd" />
      ))}
      {art.floorEdge && <path d={art.floorEdge.d} fill="none" stroke={art.floorEdge.color} strokeWidth={1} vectorEffect="non-scaling-stroke" />}
      {art.lines.map((line) => (
        <path
          key={line.key}
          d={line.d}
          fill="none"
          stroke={line.color}
          // Pontilhado não se lê a 200 px: vira o mesmo fio, mais apagado.
          strokeOpacity={line.dotted ? 0.55 : 1}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {art.markers.map((marker) => (
        <path key={marker.key} d={marker.d} fill={marker.color} />
      ))}
      {art.regions.map((region) => (
        <path
          key={region.key}
          d={region.d}
          fill={region.filled ? region.color : 'none'}
          fillRule="evenodd"
          stroke={region.filled ? undefined : region.color}
          strokeWidth={region.filled ? undefined : 1}
          vectorEffect={region.filled ? undefined : 'non-scaling-stroke'}
          opacity={region.faded ? SECRET_ITEM_ALPHA : undefined}
        />
      ))}
      {art.walls.map((walls) => (
        <path
          key={walls.key}
          d={walls.d}
          fill="none"
          stroke={WALL_STROKE}
          strokeOpacity={walls.interior ? WALL_INTERIOR_ALPHA : 1}
          strokeLinecap="round"
          strokeWidth={walls.width ?? 1}
          vectorEffect={walls.width === null ? 'non-scaling-stroke' : undefined}
        />
      ))}
      {art.doors.map((doors) =>
        doors.filled ? (
          <path key={doors.key} d={doors.d} fill={doors.color} />
        ) : (
          <path key={doors.key} d={doors.d} fill="none" stroke={doors.color} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ),
      )}
      <DiscosDasFichas tokens={art.tokens} semNomes={semNomes} />
    </svg>
  )
})

/** As fichas da cena em disco, em px de mundo: no desenho chapado e por cima da miniatura nova. */
function DiscosDasFichas({ tokens, semNomes }: { tokens: readonly ArtToken[]; semNomes: boolean }) {
  return (
    <>
      {tokens.map((token) => (
        <circle
          key={token.id}
          cx={token.cx}
          cy={token.cy}
          r={token.r}
          fill={token.color}
          stroke={TOKEN_OUTLINE}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          opacity={token.ghost ? GHOST_TOKEN_OPACITY : undefined}
        >
          {!semNomes && <title>{token.name}</title>}
        </circle>
      ))}
    </>
  )
}

/** O que a miniatura nova enquadra (piso e quadro de `planoDaMiniatura`), uma vez por mapa. */
const enquadramentosGuardados = new WeakMap<MapData, { piso: number; quadro: QuadroDaMiniatura } | null>()

function enquadramentoDaMiniatura(map: MapData): { piso: number; quadro: QuadroDaMiniatura } | null {
  let guardado = enquadramentosGuardados.get(map)
  if (guardado === undefined) {
    const plano = planoDaMiniatura(map)
    guardado = plano === null ? null : { piso: plano.piso, quadro: plano.quadro }
    enquadramentosGuardados.set(map, guardado)
  }
  return guardado
}

/**
 * As fichas por cima da miniatura nova, que vem sem elas (na lista de 40 px a
 * ficha era só um ponto). Mesmo quadro da imagem: o disco cai onde a ficha está
 * no chão pintado. As fichas são as de agora; a imagem da cena aberta, a do
 * último Salvar.
 */
function FichasSobreAMiniatura({ map }: { map: MapData }) {
  const enquadramento = enquadramentoDaMiniatura(map)
  if (enquadramento === null) return null
  const tokens = arteDaCena(map, enquadramento.piso)?.tokens ?? []
  if (tokens.length === 0) return null
  const { quadro } = enquadramento
  return (
    <svg
      className="lb-visao__fichas"
      viewBox={`${quadro.x} ${quadro.y} ${quadro.width} ${quadro.height}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <DiscosDasFichas tokens={tokens} semNomes={false} />
    </svg>
  )
}

/**
 * O poço do mapa no cartão da Visão geral. A imagem é a MESMA da lista de Cenas
 * (`stores/miniaturasDasCenas.ts`: o canvas do editor pinta chão com textura,
 * carimbos, paredes e objetos; sem fichas), pedida enquanto o cartão está à
 * vista. Enquanto ela não existe — ou na cena vazia, ou quando a cena aberta
 * está num piso que não é o térreo (a imagem mostra o térreo, ou o primeiro
 * piso com algo desenhado) — fica o desenho
 * chapado de antes (`SceneThumbnail`), que não espera a fila.
 */
function MapaDoCartao({ scene, map, piso }: { scene: SceneListItem; map: MapData | undefined; piso: number }) {
  const outroPiso = piso !== 0
  const { caixaRef, pronta, nasceuSemImagem } = useMiniaturaDaCena(scene.id, scene.available && !outroPiso ? map : undefined, scene.active)
  const imagem = !outroPiso && typeof pronta?.url === 'string' ? pronta.url : null
  return (
    <span ref={caixaRef} className="lb-visao__mapa" data-chegou={nasceuSemImagem && imagem !== null ? 'true' : undefined}>
      {!scene.available ? (
        <span className="lb-visao__falta">Arquivo não encontrado</span>
      ) : imagem !== null ? (
        <>
          <img src={imagem} alt="" draggable={false} decoding="async" />
          {map && <FichasSobreAMiniatura map={map} />}
        </>
      ) : map ? (
        <SceneThumbnail map={map} piso={piso} />
      ) : (
        <span className="lb-visao__falta">Sem prévia</span>
      )}
    </span>
  )
}

/** Quantas miniaturas cabem numa linha da grade (as da primeira linha dividem o mesmo topo). */
function columnsOf(cards: readonly HTMLElement[]): number {
  if (cards.length === 0) return 1
  const top = cards[0].offsetTop
  const firstBelow = cards.findIndex((card) => card.offsetTop !== top)
  return firstBelow > 0 ? firstBelow : cards.length
}

/**
 * Para onde a tecla leva o foco na grade: setas andam uma miniatura (para os
 * lados) ou uma linha (para cima e para baixo), pulando a cena que não abre;
 * Home e End vão à primeira e à última que abrem. `null` = tecla que não é da grade.
 */
function nextCard(cards: readonly HTMLButtonElement[], from: number, key: string): number | null {
  const enabled = (index: number) => !cards[index].disabled
  if (key === 'Home' || key === 'End') {
    const order = cards.map((_, index) => index)
    const found = (key === 'Home' ? order : order.reverse()).find(enabled)
    return found ?? from
  }
  const columns = columnsOf(cards)
  const steps: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns }
  const step = steps[key]
  if (step === undefined) return null
  for (let index = from + step; index >= 0 && index < cards.length; index += step) {
    if (enabled(index)) return index
  }
  return from
}

export interface SceneOverviewDialogProps {
  scenes: readonly SceneListItem[]
  /** O mapa de cada cena que abriu (`sceneMaps`, adventureStore.ts), pelo id da lista. */
  maps: ReadonlyMap<string, MapData>
  /**
   * PISOS NA MESMA CENA: o piso em edição na cena aberta — a miniatura dela
   * mostra esse andar. As outras mostram o térreo, onde abrem (`loadMap`
   * volta o editor ao piso 0). Ausente = térreo.
   */
  pisoAberto?: number
  /** Clique numa miniatura. Quem chama troca de cena (ou não, se já é a aberta) e fecha. */
  onPick: (sceneId: string) => void
  onClose: () => void
  /** Aberta pelo ícone de expandir do cabeçalho: janela maior, miniaturas maiores. */
  expandida?: boolean
}

type Row = SceneTreeRow<SceneListItem>

/**
 * VISÃO GERAL DAS CENAS (G14): uma miniatura por cena da aventura (a imagem da
 * lista de Cenas, `MapaDoCartao`), e o nome da cena como legenda. A cena aberta vem
 * destacada (`aria-current`, borda de latão, como na lista de Cenas). Clicar
 * abre a cena; Esc, o X e o clique no fundo fecham sem trocar.
 *
 * Casca do Grimório (`Dialogo`, fatia 20): portal no `body`, foco preso
 * dentro e devolvido a quem abriu, Esc e fundo fecham.
 */
export function SceneOverviewDialog({ scenes, maps, pisoAberto = 0, onPick, onClose, expandida = false }: SceneOverviewDialogProps) {
  const gridRef = useRef<HTMLDivElement>(null)
  // O foco começa na cena aberta: é dela que as setas partem, como numa lista que já tem um item escolhido.
  const cenaDoFoco = useRef<HTMLButtonElement>(null)
  const rows = useMemo(() => sceneTree(scenes), [scenes])
  const byId = useMemo(() => new Map(rows.map((row) => [row.entry.id, row])), [rows])
  // FILTRAR CENAS (qualidade de vida, 26/11/2026): com muitas cenas, achar uma pelo nome.
  // Com texto, a grade vira uma lista só das que batem, sem os grupos.
  const [filtro, setFiltro] = useState('')
  const termo = semAcento(filtro.trim())
  const filtradas = termo === '' ? null : rows.filter((row) => semAcento(row.entry.name).includes(termo))
  const temGrupos = rows.some((row) => row.childIds.length > 0)
  // Sem cena aberta que abra, o Dialogo foca a primeira miniatura que abre, na ordem da tela.
  const focoId = scenes.find((scene) => scene.active && scene.available)?.id

  function onGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const cards = Array.from(gridRef.current?.querySelectorAll<HTMLButtonElement>(CARD) ?? [])
    const from = cards.findIndex((card) => card === document.activeElement)
    if (from === -1) return
    const target = nextCard(cards, from, event.key)
    if (target === null) return
    event.preventDefault()
    cards[target].focus()
  }

  /** Uma miniatura: clicar abre a cena. */
  function renderCard(scene: SceneListItem) {
    const map = maps.get(scene.id)
    return (
      <li key={scene.id || 'cena-solta'} className="lb-visao__item">
        <button
          ref={scene.id === focoId ? cenaDoFoco : undefined}
          type="button"
          className="lb-visao__cena"
          aria-current={scene.active ? 'true' : undefined}
          aria-label={sceneLabel(scene, map)}
          disabled={!scene.available}
          onClick={() => onPick(scene.id)}
        >
          <MapaDoCartao scene={scene} map={map} piso={scene.active ? pisoAberto : 0} />
          <span className="lb-visao__legenda">
            <span className="lb-visao__nome">{scene.name}</span>
            <span className="lb-visao__conta">{tokenCountLabel(scene.tokenCount)}</span>
          </span>
        </button>
      </li>
    )
  }

  /**
   * CENAS DENTRO DE CENAS: as de dentro de `row` numa grade logo abaixo dela,
   * recuadas; cada uma que também tem cenas dentro abre o seu sub-grupo depois,
   * e assim por diante.
   */
  function renderSubgrupo(row: Row) {
    const filhos = row.childIds.map((id) => byId.get(id)).filter((child): child is Row => child !== undefined)
    if (filhos.length === 0) return null
    return (
      <div className="lb-visao__sub">
        <p className="lb-visao__sub-titulo">Dentro de {row.entry.name}</p>
        <ul className="lb-visao__grade">{filhos.map((child) => renderCard(child.entry))}</ul>
        {filhos.map((child) => (
          <div key={child.entry.id}>{renderSubgrupo(child)}</div>
        ))}
      </div>
    )
  }

  return (
    <Dialogo
      aberto
      titulo="Visão geral das cenas"
      descricao="Clique numa cena para abri-la no editor."
      onFechar={onClose}
      classe={`lb-visao${expandida ? ' lb-visao--expandida' : ''}`}
      focoInicial={focoId === undefined ? undefined : cenaDoFoco}
    >
        {rows.length > 1 && (
          <div className="lb-visao__filtro">
            <CampoTexto rotulo="Filtrar cenas" placeholder="Nome da cena" valor={filtro} onChange={setFiltro} />
          </div>
        )}
        <div ref={gridRef} className="lb-scroll lb-visao__corpo" role="group" aria-label="Miniaturas das cenas" onKeyDown={onGridKeyDown}>
          {filtradas !== null ? (
            filtradas.length === 0 ? (
              <p className="lb-visao__falta">Nenhuma cena com “{filtro.trim()}”.</p>
            ) : (
              <ul className="lb-visao__grade">{filtradas.map((row) => renderCard(row.entry))}</ul>
            )
          ) : temGrupos ? (
            <>
              {rows
                .filter((row) => row.depth === 0 && row.childIds.length > 0)
                .map((row) => (
                  <section key={row.entry.id} className="lb-visao__grupo" aria-label={row.entry.name}>
                    <h3 className="lb-eyebrow lb-visao__grupo-titulo">{row.entry.name}</h3>
                    <ul className="lb-visao__grade">{renderCard(row.entry)}</ul>
                    {renderSubgrupo(row)}
                  </section>
                ))}
              {rows.some((row) => row.depth === 0 && row.childIds.length === 0) && (
                <section className="lb-visao__grupo" aria-label="Outras cenas">
                  <h3 className="lb-eyebrow lb-visao__grupo-titulo">Outras cenas</h3>
                  <ul className="lb-visao__grade">
                    {rows.filter((row) => row.depth === 0 && row.childIds.length === 0).map((row) => renderCard(row.entry))}
                  </ul>
                </section>
              )}
            </>
          ) : (
            <ul className="lb-visao__grade">{rows.map((row) => renderCard(row.entry))}</ul>
          )}
        </div>
    </Dialogo>
  )
}
