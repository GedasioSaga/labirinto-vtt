import { useRef, useState, type KeyboardEvent } from 'react'
import type { FloorPiece } from '../types/map'
import { linhasDeCamada, type LinhaDeCamada } from '../lib/camadasDoChao'
import { NOVA_CAMADA } from '../lib/camadasDoPincel'
import { ChevronDownIcon, ChevronUpIcon, EyeIcon, EyeOffIcon, LockIcon, UnlockIcon } from './icons'
import { CampoDeCorComPipeta } from './CampoDeCorComPipeta'

/**
 * Ferramenta Chão em Pincel de blocos ou Balde: a lista vira a lista das
 * camadas em que se pinta (`lib/camadasDoPincel.ts`).
 */
export interface PincelNasCamadas {
  /** A camada que recebe a tinta (já resolvida: id de peça ou `NOVA_CAMADA`). */
  ativaId: string
  /** "Camada 3": o nome que a camada nova vai ter. */
  nomeDaNova: string
  /** Cor com que a camada nova vai nascer (a tinta escolhida no menu). */
  corDaNova: string
  onAtivar: (id: string) => void
  onNovaCamada: () => void
}

export interface FloorLayersListProps {
  floor: FloorPiece[]
  /** Cor do chão do mapa: a da peça sem cor própria. */
  floorFillColor: string
  selectedPieceId: string | null
  onSelect: (id: string) => void
  onToggleLock: (id: string, locked: boolean) => void
  onColorChange: (id: string, color: string) => void
  /** `+1` sobe (pinta por cima da vizinha), `-1` desce. */
  onReorder: (id: string, delta: 1 | -1) => void
  /** Olho: escondida some do mestre e do jogador. Ausente = sem olho. */
  onToggleHidden?: (id: string, hidden: boolean) => void
  /** Nome novo; `undefined` volta ao nome automático. Ausente = sem renomear. */
  onRename?: (id: string, nome: string | undefined) => void
  pincel?: PincelNasCamadas
}

/**
 * "Camadas do chão": uma linha por peça, a de cima pinta por cima (pedido de
 * 28/09/2026 — mar embaixo, chão por cima). Cada linha tem a cor da camada,
 * o nome (clique seleciona a peça no mapa; clique duplo renomeia), o olho,
 * subir/descer e o cadeado.
 *
 * Com o pincel ou o balde na mão (pedido de 03/10/2026), o clique no nome de
 * uma camada do pincel a torna a ATIVA — onde a tinta cai —, e "Nova camada"
 * prepara uma camada que nasce na próxima pincelada.
 *
 * Só apresentação: ordem, trava, nome e olho vivem em `MapData.floor` via
 * mapStore; a camada ativa é preferência de sessão da store.
 */
export function FloorLayersList({
  floor,
  floorFillColor,
  selectedPieceId,
  onSelect,
  onToggleLock,
  onColorChange,
  onReorder,
  onToggleHidden,
  onRename,
  pincel,
}: FloorLayersListProps) {
  const linhas = linhasDeCamada(floor, floorFillColor)
  const ultimo = floor.length - 1
  const [renomeando, setRenomeandoState] = useState<string | null>(null)
  // O Enter fecha o campo e o blur que vem depois não pode gravar de novo.
  const renomeandoRef = useRef<string | null>(null)
  const setRenomeando = (id: string | null) => {
    renomeandoRef.current = id
    setRenomeandoState(id)
  }
  const ativa = pincel ? linhas.find((linha) => linha.id === pincel.ativaId) : undefined
  const novaNaFrente = pincel !== undefined && ativa === undefined
  const nomeDaAtiva = ativa?.nome ?? pincel?.nomeDaNova

  const confirmarNome = (linha: LinhaDeCamada, texto: string) => {
    if (renomeandoRef.current !== linha.id) return
    setRenomeando(null)
    const nome = texto.trim()
    if (nome === linha.nome) return
    onRename?.(linha.id, nome === '' ? undefined : nome)
  }

  return (
    <div className="lb-floor-layers__wrap">
      {pincel && (
        <div className="lb-floor-layers__head">
          <p className="lb-floor-layers__ativa" aria-live="polite">
            Pintando em <strong>{nomeDaAtiva}</strong>
          </p>
          <button
            type="button"
            className="lb-btn lb-btn--ghost lb-floor-layers__nova"
            disabled={pincel.ativaId === NOVA_CAMADA}
            onClick={pincel.onNovaCamada}
          >
            + Nova camada
          </button>
        </div>
      )}
      <ul className="lb-layers lb-floor-layers" aria-label="Camadas do chão">
        {novaNaFrente && pincel && (
          <li className="lb-layers__row lb-floor-layers__row--nova" data-ativa="">
            <span className="lb-floor-layers__swatch" style={{ background: pincel.corDaNova }} aria-hidden="true" />
            <span className="lb-layers__name">{pincel.nomeDaNova}</span>
            <span className="lb-floor-layers__dica">pinte para criar</span>
          </li>
        )}
        {linhas.map((linha) => {
          const ehAtiva = pincel !== undefined && linha.id === pincel.ativaId
          const ativavel = pincel !== undefined && linha.pincel
          return (
            <li
              key={linha.id}
              className="lb-layers__row"
              data-selected={linha.id === selectedPieceId || undefined}
              data-ativa={ehAtiva ? '' : undefined}
              data-hidden={linha.hidden ? '' : undefined}
            >
              {linha.op === 'add' ? (
                <CampoDeCorComPipeta
                  className="lb-floor-layers__swatch"
                  value={linha.cor}
                  aria-label={`Cor de ${linha.nome}`}
                  title={`Cor de ${linha.nome}`}
                  rotuloDaPipeta={`Pegar do mapa a cor de ${linha.nome}`}
                  compacto
                  onChange={(cor) => onColorChange(linha.id, cor)}
                />
              ) : (
                <span className="lb-floor-layers__swatch lb-floor-layers__swatch--hole" aria-hidden="true" />
              )}
              {renomeando === linha.id ? (
                <input
                  className="lb-input lb-floor-layers__rename"
                  aria-label={`Nome de ${linha.nome}`}
                  defaultValue={linha.nome}
                  autoFocus
                  onFocus={(e) => e.currentTarget.select()}
                  onBlur={(e) => confirmarNome(linha, e.currentTarget.value)}
                  onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === 'Enter') confirmarNome(linha, e.currentTarget.value)
                    if (e.key === 'Escape') {
                      e.stopPropagation()
                      setRenomeando(null)
                    }
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="lb-layers__name lb-floor-layers__pick"
                  aria-pressed={ativavel ? ehAtiva : linha.id === selectedPieceId}
                  title={onRename ? `${ativavel ? 'Pintar' : 'Selecionar'} · clique duplo para renomear` : undefined}
                  onClick={() => (ativavel ? pincel.onAtivar(linha.id) : onSelect(linha.id))}
                  onDoubleClick={onRename ? () => setRenomeando(linha.id) : undefined}
                  onKeyDown={(e) => {
                    if (e.key === 'F2' && onRename) setRenomeando(linha.id)
                  }}
                >
                  {linha.nome}
                </button>
              )}
              {onToggleHidden && (
                <button
                  type="button"
                  className="lb-iconbtn lb-iconbtn--sm"
                  aria-pressed={linha.hidden}
                  aria-label={linha.hidden ? `Mostrar ${linha.nome}` : `Esconder ${linha.nome}`}
                  title={linha.hidden ? `Mostrar ${linha.nome}` : `Esconder ${linha.nome} (some para os jogadores também)`}
                  onClick={() => onToggleHidden(linha.id, !linha.hidden)}
                >
                  {linha.hidden ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                </button>
              )}
              <button
                type="button"
                className="lb-iconbtn lb-iconbtn--sm"
                aria-label={`Subir ${linha.nome}`}
                title={`Subir ${linha.nome}`}
                disabled={linha.index === ultimo}
                onClick={() => onReorder(linha.id, 1)}
              >
                <ChevronUpIcon size={16} />
              </button>
              <button
                type="button"
                className="lb-iconbtn lb-iconbtn--sm"
                aria-label={`Descer ${linha.nome}`}
                title={`Descer ${linha.nome}`}
                disabled={linha.index === 0}
                onClick={() => onReorder(linha.id, -1)}
              >
                <ChevronDownIcon size={16} />
              </button>
              <button
                type="button"
                className="lb-iconbtn lb-iconbtn--sm"
                aria-pressed={linha.locked}
                aria-label={linha.locked ? `Destravar ${linha.nome}` : `Travar ${linha.nome}`}
                title={linha.locked ? `Destravar ${linha.nome}` : `Travar ${linha.nome}`}
                onClick={() => onToggleLock(linha.id, !linha.locked)}
              >
                {linha.locked ? <LockIcon size={16} /> : <UnlockIcon size={16} />}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
