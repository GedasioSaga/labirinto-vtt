import type { ReactElement } from 'react'
import { MenuShell } from './MenuShell'
import { MenuCard } from '../components/MenuCard'
import { DungeonMapIcon, IsometricMapIcon, WorldMapIcon } from '../components/icons'
import { MAP_TYPES, type MapTypeDef } from '../lib/mapTypes'

interface MapTypePickerProps {
  onPickDungeon: () => void
  onBack: () => void
}

const ICONS: Record<MapTypeDef['id'], ReactElement> = {
  dungeon: <DungeonMapIcon />,
  isometric: <IsometricMapIcon />,
  world: <WorldMapIcon />,
}

/** Só o Dungeon Map tem `onClick` — os outros dois são `<button disabled>`. */
export function MapTypePicker({ onPickDungeon, onBack }: MapTypePickerProps) {
  return (
    <MenuShell title="Criar Mapas" onBack={onBack} wide crumbs={['Labirinto']}>
      <div className="lb-menu__grid">
        {MAP_TYPES.map((type) => (
          <MenuCard
            key={type.id}
            layout="tile"
            icon={ICONS[type.id]}
            title={type.name}
            description={type.description}
            badge={type.badge}
            disabled={!type.available}
            onClick={type.id === 'dungeon' ? onPickDungeon : undefined}
          />
        ))}
      </div>
    </MenuShell>
  )
}
