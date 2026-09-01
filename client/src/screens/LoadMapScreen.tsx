import { useEffect, useState, type CSSProperties } from 'react'
import { MenuShell } from './MenuShell'
import {
  listSavedMaps,
  pickMapJsonToOpen,
  renameMap,
  duplicateMap,
  deleteMap,
  type SavedMapEntry,
} from '../lib/mapFileIO'
import { useToastStore } from '../stores/toastStore'

interface LoadMapScreenProps {
  onOpenPath: (path: string) => void
  onBack: () => void
}

type LoadState = 'loading' | 'empty' | 'ready'

/** Estado de edição de UMA linha por vez — renomear ou confirmar exclusão
 *  trocam o conteúdo daquele card específico, o resto da lista continua
 *  mostrando os 3 botões normais (Renomear/Duplicar/Excluir). */
type RowMode = { id: string; kind: 'rename'; draft: string } | { id: string; kind: 'delete-confirm' }

/** Mesmo padrão de `reportFileError` em `App.tsx:41` — toast de erro
 *  padronizado, módulo-escopo porque só chama `useToastStore.getState().push`. */
function reportMapFileError(action: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err)
  useToastStore.getState().push('error', `Não foi possível ${action}: ${message}`)
}

// main.css é proibido de tocar nesta frente (ver CONTRATO) — os botões abaixo
// reusam as classes já existentes (`lb-btn`, `lb-iconbtn`...) e só ajustam
// tamanho/layout com style inline, lendo os mesmos tokens (`var(--lb-*)`) que
// o resto do app usa via CSS.
const compactBtnStyle: CSSProperties = {
  minHeight: 30,
  padding: '0 var(--lb-space-3)',
  fontSize: 'var(--lb-font-size-sm)',
}

const rowActionsStyle: CSSProperties = {
  display: 'flex',
  gap: 'var(--lb-space-2)',
  flex: 'none',
}

/** `.lb-maplist__item` (main.css) já estiliza borda/fundo/hover para um
 *  container flex — só o botão "abrir" interno precisa de reset, porque
 *  agora o card não é mais um único `<button>` (não dá pra aninhar botão de
 *  Renomear/Duplicar/Excluir dentro de outro `<button>`, HTML inválido). */
function openButtonStyle(disabled: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'baseline',
    gap: 'var(--lb-space-4)',
    flex: 1,
    minWidth: 0,
    background: 'transparent',
    border: 'none',
    padding: 0,
    margin: 0,
    font: 'inherit',
    color: 'inherit',
    textAlign: 'left',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  }
}

/**
 * Lista os mapas em `%APPDATA%\com.labirinto.app\maps` e oferece "Procurar no
 * disco..." para o que estiver fora dessa pasta (ex.: `C:\Dev\labirinto\maps\L1.json`).
 * Sempre passa por `loadMapFromDisk` no chamador (`App.tsx`) — nunca lê o
 * arquivo direto aqui — porque é ele que concede o acesso de FS ao diretório
 * de origem (`grant_fs_access`) antes de ler.
 *
 * Item 23 do PLANO-REFINAMENTO.md: além de abrir, cada card tem Renomear,
 * Duplicar e Excluir — hoje essas três operações só existiam indo no
 * Explorer do Windows. Lista ordenada por recência (`listSavedMaps` já
 * devolve ordenado — ver `lib/mapFileIO.ts`).
 */
export function LoadMapScreen({ onOpenPath, onBack }: LoadMapScreenProps) {
  const [maps, setMaps] = useState<SavedMapEntry[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [rowMode, setRowMode] = useState<RowMode | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

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

  /** Mesma lista, chamada de novo depois de renomear/duplicar/excluir — sem o
   *  guard de `cancelled` do efeito de montagem porque só roda em resposta a
   *  uma ação do usuário nesta tela, então o componente está montado. */
  const refreshMaps = async (): Promise<void> => {
    try {
      const result = await listSavedMaps()
      setMaps(result)
      setState(result.length === 0 ? 'empty' : 'ready')
    } catch (err) {
      reportMapFileError('atualizar a lista de mapas', err)
    }
  }

  const handleBrowse = async () => {
    const path = await pickMapJsonToOpen()
    if (path) onOpenPath(path)
  }

  const cancelRowMode = () => setRowMode(null)

  const submitRename = async (id: string) => {
    if (rowMode?.kind !== 'rename' || rowMode.id !== id) return
    const draft = rowMode.draft
    setBusyId(id)
    try {
      await renameMap(id, draft)
      setRowMode(null)
      await refreshMaps()
    } catch (err) {
      reportMapFileError('renomear o mapa', err)
    } finally {
      setBusyId(null)
    }
  }

  const confirmDelete = async (id: string) => {
    setBusyId(id)
    try {
      await deleteMap(id)
      setRowMode(null)
      await refreshMaps()
    } catch (err) {
      reportMapFileError('excluir o mapa', err)
      setRowMode(null)
    } finally {
      setBusyId(null)
    }
  }

  const handleDuplicate = async (map: SavedMapEntry) => {
    setBusyId(map.id)
    try {
      await duplicateMap(map.id)
      await refreshMaps()
    } catch (err) {
      reportMapFileError('duplicar o mapa', err)
    } finally {
      setBusyId(null)
    }
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
            {maps.map((map) => {
              const mode = rowMode?.id === map.id ? rowMode : null
              const isBusy = busyId === map.id

              return (
                <div key={map.path} className="lb-maplist__item" style={{ cursor: 'default' }}>
                  {mode?.kind === 'rename' ? (
                    <div className="lb-field" style={{ flex: 1, minWidth: 0 }}>
                      <label className="lb-label" htmlFor={`lb-rename-${map.id}`}>
                        Novo nome para &quot;{map.name}&quot;
                      </label>
                      <div style={{ display: 'flex', gap: 'var(--lb-space-2)' }}>
                        <input
                          id={`lb-rename-${map.id}`}
                          className="lb-input"
                          value={mode.draft}
                          disabled={isBusy}
                          autoFocus
                          onChange={(event) => setRowMode({ id: map.id, kind: 'rename', draft: event.target.value })}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              void submitRename(map.id)
                            }
                            if (event.key === 'Escape') {
                              // Sem isto o Escape também navegaria pra trás —
                              // `MenuShell` (:36) ouve Escape no `window` pra
                              // voltar, e este evento chegaria lá por bubbling.
                              event.stopPropagation()
                              cancelRowMode()
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="lb-btn lb-btn--primary"
                          style={compactBtnStyle}
                          disabled={isBusy || mode.draft.trim().length === 0}
                          onClick={() => void submitRename(map.id)}
                        >
                          Salvar
                        </button>
                        <button type="button" className="lb-btn lb-btn--ghost" style={compactBtnStyle} disabled={isBusy} onClick={cancelRowMode}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : mode?.kind === 'delete-confirm' ? (
                    <>
                      <p style={{ flex: 1, minWidth: 0, margin: 0, color: 'var(--lb-color-ember)' }}>
                        Apagar &quot;{map.name}&quot;? O arquivo é removido do disco e a ação não tem volta.
                      </p>
                      <div style={rowActionsStyle}>
                        <button
                          type="button"
                          className="lb-btn lb-btn--danger"
                          style={compactBtnStyle}
                          disabled={isBusy}
                          onClick={() => void confirmDelete(map.id)}
                        >
                          Apagar
                        </button>
                        <button type="button" className="lb-btn lb-btn--ghost" style={compactBtnStyle} disabled={isBusy} onClick={cancelRowMode}>
                          Cancelar
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <button type="button" style={openButtonStyle(isBusy)} disabled={isBusy} onClick={() => onOpenPath(map.path)}>
                        <span className="lb-maplist__name">{map.name}</span>
                        <span className="lb-maplist__meta">
                          {map.width} × {map.height} · grade {map.grid}
                        </span>
                      </button>
                      <div style={rowActionsStyle}>
                        <button
                          type="button"
                          className="lb-btn lb-btn--ghost"
                          style={compactBtnStyle}
                          disabled={isBusy}
                          onClick={() => setRowMode({ id: map.id, kind: 'rename', draft: map.name })}
                        >
                          Renomear
                        </button>
                        <button
                          type="button"
                          className="lb-btn lb-btn--ghost"
                          style={compactBtnStyle}
                          disabled={isBusy}
                          onClick={() => void handleDuplicate(map)}
                        >
                          Duplicar
                        </button>
                        <button
                          type="button"
                          className="lb-btn lb-btn--ghost"
                          style={compactBtnStyle}
                          disabled={isBusy}
                          onClick={() => setRowMode({ id: map.id, kind: 'delete-confirm' })}
                        >
                          Excluir
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
          <button type="button" className="lb-btn lb-btn--ghost lb-btn--block" onClick={handleBrowse}>
            Procurar no disco...
          </button>
        </>
      )}
    </MenuShell>
  )
}
