import type { FloorPiece } from '../types/map'
import { linhasDeCamada } from '../lib/camadasDoChao'
import { ChevronDownIcon, ChevronUpIcon, LockIcon, UnlockIcon } from './icons'
import { CampoDeCorComPipeta } from './CampoDeCorComPipeta'

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
}

/**
 * "Camadas do chão": uma linha por peça, a de cima pinta por cima (pedido de
 * 28/09/2026 — mar embaixo, chão por cima). Cada linha tem a cor da camada,
 * o nome (clique seleciona a peça no mapa), o cadeado e subir/descer.
 *
 * Só apresentação: a ordem e a trava vivem em `MapData.floor` via mapStore.
 */
export function FloorLayersList({
  floor,
  floorFillColor,
  selectedPieceId,
  onSelect,
  onToggleLock,
  onColorChange,
  onReorder,
}: FloorLayersListProps) {
  const linhas = linhasDeCamada(floor, floorFillColor)
  const ultimo = floor.length - 1
  return (
    <ul className="lb-layers lb-floor-layers" aria-label="Camadas do chão">
      {linhas.map((linha) => (
        <li key={linha.id} className="lb-layers__row" data-selected={linha.id === selectedPieceId || undefined}>
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
          <button
            type="button"
            className="lb-layers__name lb-floor-layers__pick"
            aria-pressed={linha.id === selectedPieceId}
            onClick={() => onSelect(linha.id)}
          >
            {linha.nome}
          </button>
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
      ))}
    </ul>
  )
}
