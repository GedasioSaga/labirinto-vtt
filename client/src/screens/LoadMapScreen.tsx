import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
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

/** A pergunta "Apagar X?" ocupa o card no mesmo arranjo de `.lb-maplist__item`:
 *  o texto estica e os botões ficam na ponta. */
const deleteConfirmStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--lb-space-4)',
  flex: 1,
  minWidth: 0,
}

/** Id estável do "Excluir" de uma linha: o botão é desmontado enquanto a
 *  pergunta está aberta, e é por este id que o foco volta a ele. */
function deleteButtonId(mapId: string): string {
  return `lb-del-${mapId}`
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
  /** Id do botão que recebe o foco depois da próxima troca de `rowMode`. */
  const focoPendente = useRef<string | null>(null)

  // O "Excluir" só volta à linha no render que fecha a pergunta: aqui ele já existe.
  useLayoutEffect(() => {
    const alvo = focoPendente.current
    focoPendente.current = null
    if (alvo !== null) document.getElementById(alvo)?.focus()
  }, [rowMode])

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

  /** Fecha a pergunta "Apagar X?" sem apagar. O foco volta ao "Excluir" que
   *  a abriu: o botão clicado saiu da tela, e o foco cairia no `body`. */
  const cancelDelete = (mapId: string) => {
    focoPendente.current = deleteButtonId(mapId)
    setRowMode(null)
  }

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

  const confirmDelete = async (map: SavedMapEntry) => {
    setBusyId(map.id)
    try {
      await deleteMap(map.id)
      // A linha some da lista: sem o aviso, nada diz que o arquivo saiu do disco.
      useToastStore.getState().push('info', `"${map.name}" apagado.`)
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
      const copia = await duplicateMap(map.id)
      // O nome da cópia é o que o mestre vai procurar na lista.
      useToastStore.getState().push('info', `Cópia criada: "${copia.name}".`)
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
                    <div
                      role="alertdialog"
                      aria-modal="false"
                      aria-labelledby={`lb-del-titulo-${map.id}`}
                      aria-describedby={`lb-del-texto-${map.id}`}
                      style={deleteConfirmStyle}
                      onKeyDown={(event) => {
                        if (event.key !== 'Escape') return
                        // O Esc é desta pergunta: sem isto ele subiria até o
                        // `MenuShell` (:36), que ouve Escape no `window` e
                        // tiraria o mestre da tela em vez de cancelar.
                        event.preventDefault()
                        event.stopPropagation()
                        // Apagando, o Cancelar está desligado; o Esc espera junto.
                        if (!isBusy) cancelDelete(map.id)
                      }}
                    >
                      <p style={{ flex: 1, minWidth: 0, margin: 0, color: 'var(--lb-color-ember)' }}>
                        <span id={`lb-del-titulo-${map.id}`}>Apagar &quot;{map.name}&quot;?</span>{' '}
                        <span id={`lb-del-texto-${map.id}`}>O arquivo é removido do disco e a ação não tem volta.</span>
                      </p>
                      <div style={rowActionsStyle}>
                        <button
                          type="button"
                          className="lb-btn lb-btn--danger"
                          style={compactBtnStyle}
                          disabled={isBusy}
                          onClick={() => void confirmDelete(map)}
                        >
                          Apagar
                        </button>
                        {/* O foco começa no botão seguro (convenção de confirmação destrutiva). */}
                        <button
                          type="button"
                          className="lb-btn lb-btn--ghost"
                          style={compactBtnStyle}
                          disabled={isBusy}
                          autoFocus
                          onClick={() => cancelDelete(map.id)}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
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
                          id={deleteButtonId(map.id)}
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
