import { useEffect, useState } from 'react'
import { MenuShell } from './MenuShell'
import { listSavedMaps, pickMapJsonToOpen, type SavedMapEntry } from '../lib/mapFileIO'

interface LoadMapScreenProps {
  onOpenPath: (path: string) => void
  onBack: () => void
}

type LoadState = 'loading' | 'empty' | 'ready'

/**
 * Lista os mapas em `%APPDATA%\com.labirinto.app\maps` e oferece "Procurar no
 * disco..." para o que estiver fora dessa pasta (ex.: `C:\Dev\labirinto\maps\L1.json`).
 * Sempre passa por `loadMapFromDisk` no chamador (`App.tsx`) — nunca lê o
 * arquivo direto aqui — porque é ele que concede o acesso de FS ao diretório
 * de origem (`grant_fs_access`) antes de ler.
 */
export function LoadMapScreen({ onOpenPath, onBack }: LoadMapScreenProps) {
  const [maps, setMaps] = useState<SavedMapEntry[]>([])
  const [state, setState] = useState<LoadState>('loading')

  useEffect(() => {
    let cancelled = false
    listSavedMaps()
      .then((result) => {
        if (cancelled) return
        setMaps(result)
        setState(result.length === 0 ? 'empty' : 'ready')
      })
      .catch(() => {
        // Listar pode falhar por motivo alheio a um map.json pontual (permissão,
        // disco, IPC fora do runtime Tauri) — cair pro estado vazio mantém o
        // "Procurar no disco..." acessível em vez de travar em "Carregando...".
        if (cancelled) return
        setMaps([])
        setState('empty')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleBrowse = async () => {
    const path = await pickMapJsonToOpen()
    if (path) onOpenPath(path)
  }

  return (
    <MenuShell title="Carregar Mapa" onBack={onBack} wide crumbs={['Labirinto']}>
      {state === 'loading' && <p className="lb-options__note">Carregando mapas salvos...</p>}

      {state === 'empty' && (
        <div className="lb-empty">
          <p>Nenhum mapa salvo ainda</p>
          <button type="button" className="lb-btn lb-btn--primary" onClick={handleBrowse}>
            Procurar no disco...
          </button>
        </div>
      )}

      {state === 'ready' && (
        <>
          <div className="lb-maplist">
            {maps.map((map) => (
              <button
                key={map.path}
                type="button"
                className="lb-maplist__item"
                onClick={() => onOpenPath(map.path)}
              >
                <span className="lb-maplist__name">{map.name}</span>
                <span className="lb-maplist__meta">
                  {map.width} × {map.height} · grade {map.grid}
                </span>
              </button>
            ))}
          </div>
          <button type="button" className="lb-btn lb-btn--ghost lb-btn--block" onClick={handleBrowse}>
            Procurar no disco...
          </button>
        </>
      )}
    </MenuShell>
  )
}
