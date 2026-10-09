import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type DragEvent } from 'react'
import { MenuShell } from './MenuShell'
import {
  listSavedMaps,
  pickMapJsonToOpen,
  renameMap,
  duplicateMap,
  deleteMap,
  type SavedMapEntry,
} from '../lib/mapFileIO'
import {
  alternarRecolhida,
  apagarPasta,
  criarPasta,
  INDICE_VAZIO,
  lerIndiceDasPastas,
  lerRpgDaPasta,
  lugarDoMapa,
  moverMapa,
  mudarIndiceDasPastas,
  renomearPasta,
  type IndiceDasPastas,
  type PastaDeMapas,
  type RpgDaPasta,
} from '../lib/pastasDeMapas'
import { acompanharIndice, editarRpgDaPasta } from '../stores/rpgDaPasta'
import { sistemaPorId, useRpgStore } from '../stores/rpgStore'
import { useToastStore } from '../stores/toastStore'
import { PastaDeMapasConfig } from './PastaDeMapasConfig'

interface LoadMapScreenProps {
  onOpenPath: (path: string) => void
  onBack: () => void
}

type LoadState = 'loading' | 'empty' | 'ready'

/** Estado de edição de UMA linha por vez — renomear, mover para pasta ou
 *  confirmar exclusão trocam o conteúdo daquele card específico, o resto da
 *  lista continua mostrando os botões normais. `destino` do mover: id da
 *  pasta, ou `''` = fora das pastas. */
type RowMode =
  | { id: string; kind: 'rename'; draft: string }
  | { id: string; kind: 'delete-confirm' }
  | { id: string; kind: 'move'; destino: string }

/** O mesmo para o cabeçalho de UMA pasta por vez. */
type FolderMode = { id: string; kind: 'rename'; draft: string } | { id: string; kind: 'delete-confirm' } | { id: string; kind: 'config' }

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

/** Os mapas de dentro da pasta ficam recuados: lê-se de relance quem é de quem. */
const dentroDaPastaStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--lb-space-2)',
  paddingLeft: 'var(--lb-space-4)',
}

/** O grupo (cabeçalho + mapas) que recebe o mapa arrastado. */
function grupoStyle(alvo: boolean): CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--lb-space-2)',
    borderRadius: 'var(--lb-radius-md)',
    outline: alvo ? '2px dashed var(--lb-color-brass)' : 'none',
    outlineOffset: 2,
  }
}

/** Tipo do dado do arrasto: só a CHAVE do mapa (a pasta dele em `maps`). Outro arrasto (arquivo, texto) não é aceito. */
const MIME_DO_MAPA = 'application/x-labirinto-mapa'

/** Id estável do "Excluir" de uma linha: o botão é desmontado enquanto a
 *  pergunta está aberta, e é por este id que o foco volta a ele. */
function deleteButtonId(mapId: string): string {
  return `lb-del-${mapId}`
}

function deleteFolderButtonId(pastaId: string): string {
  return `lb-del-pasta-${pastaId}`
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

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`
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
 *
 * PASTAS DE MAPAS (`lib/pastasDeMapas.ts`): o mestre junta mapas em pastas
 * (criar, renomear, apagar — os mapas saem, nunca são apagados), move um mapa
 * arrastando o card até a pasta ou por "Mover…", recolhe e abre a pasta, e
 * configura nela o sistema universal e os jogadores principais.
 */
export function LoadMapScreen({ onOpenPath, onBack }: LoadMapScreenProps) {
  const [maps, setMaps] = useState<SavedMapEntry[]>([])
  const [state, setState] = useState<LoadState>('loading')
  const [rowMode, setRowMode] = useState<RowMode | null>(null)
  const [folderMode, setFolderMode] = useState<FolderMode | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [indice, setIndice] = useState<IndiceDasPastas>(INDICE_VAZIO)
  const [avisoDasPastas, setAvisoDasPastas] = useState<string | null>(null)
  /** O RPG de cada pasta como está no disco; `null` = ilegível. Ausente = ainda lendo. */
  const [rpgs, setRpgs] = useState<ReadonlyMap<string, RpgDaPasta | null>>(new Map())
  /** "Nova pasta": o nome sendo digitado; `null` = o botão, sem campo. */
  const [novaPasta, setNovaPasta] = useState<string | null>(null)
  /** Pasta sob o mapa arrastado (`''` = fora das pastas); `null` = nenhum arrasto em curso. */
  const [alvoDoArrasto, setAlvoDoArrasto] = useState<string | null>(null)
  const biblioteca = useRpgStore((rpg) => rpg.biblioteca)
  const carregarBiblioteca = useRpgStore((rpg) => rpg.carregarBiblioteca)
  /** Id do botão que recebe o foco depois da próxima troca de `rowMode`/`folderMode`. */
  const focoPendente = useRef<string | null>(null)
  const novaPastaRef = useRef<HTMLButtonElement | null>(null)

  // O "Excluir" só volta à linha no render que fecha a pergunta: aqui ele já existe.
  useLayoutEffect(() => {
    const alvo = focoPendente.current
    focoPendente.current = null
    if (alvo !== null) document.getElementById(alvo)?.focus()
  }, [rowMode, folderMode])

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

  // As pastas vêm à parte da lista: o índice ilegível só tira a organização, nunca os mapas.
  useEffect(() => {
    let cancelled = false
    void lerIndiceDasPastas().then(async ({ indice: lido, aviso }) => {
      if (cancelled) return
      setIndice(lido)
      setAvisoDasPastas(aviso)
      const lidos = await Promise.all(lido.pastas.map((pasta) => lerRpgDaPasta(pasta.id)))
      if (cancelled) return
      setRpgs(
        new Map(
          lido.pastas.map((pasta, i): [string, RpgDaPasta | null] => {
            const rpg = lidos[i]
            return [pasta.id, rpg.ok ? rpg.rpg : null]
          }),
        ),
      )
    })
    return () => {
      cancelled = true
    }
  }, [])

  // O nome do sistema universal no título da pasta: o importado só se acha depois de ler a biblioteca.
  useEffect(() => {
    void carregarBiblioteca()
  }, [carregarBiblioteca])

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

  /**
   * Toda mudança de pasta passa por aqui: grava sobre o índice do disco, a
   * tela passa a mostrar o gravado e o mapa aberto no editor acompanha
   * (`acompanharIndice`). `null` = não deu (o aviso já saiu).
   */
  const mudarPastas = async (mudar: (atual: IndiceDasPastas) => IndiceDasPastas, acao: string): Promise<IndiceDasPastas | null> => {
    try {
      const novo = await mudarIndiceDasPastas(mudar)
      setIndice(novo)
      setAvisoDasPastas(null)
      // Pasta nova não tem RPG no disco ainda: começa vazia, sem ida ao disco.
      setRpgs((antes) => {
        const faltando = novo.pastas.filter((pasta) => !antes.has(pasta.id))
        if (faltando.length === 0) return antes
        const depois = new Map(antes)
        for (const pasta of faltando) depois.set(pasta.id, { personagens: [] })
        return depois
      })
      await acompanharIndice(novo)
      return novo
    } catch (err) {
      reportMapFileError(acao, err)
      return null
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
      // O lugar dele na pasta sai junto: senão um mapa novo com a mesma pasta herdaria o lugar.
      if (lugarDoMapa(indice, map.id) !== null) await mudarPastas((atual) => moverMapa(atual, map.id, null), 'tirar o mapa apagado da pasta')
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
      // A cópia fica na mesma pasta do original: é onde o mestre vai procurá-la.
      const lugar = lugarDoMapa(indice, map.id)
      if (lugar !== null) await mudarPastas((atual) => moverMapa(atual, copia.id, lugar.pasta.id), 'pôr a cópia na pasta')
      await refreshMaps()
    } catch (err) {
      reportMapFileError('duplicar o mapa', err)
    } finally {
      setBusyId(null)
    }
  }

  /** Põe o mapa na pasta (`null` = fora das pastas). O mapa já ali não grava nada. */
  const moverPara = async (chave: string, pastaId: string | null) => {
    if ((lugarDoMapa(indice, chave)?.pasta.id ?? null) === pastaId) return
    setBusyId(chave)
    await mudarPastas((atual) => moverMapa(atual, chave, pastaId), 'mover o mapa')
    setBusyId(null)
  }

  const submitMove = async (map: SavedMapEntry) => {
    if (rowMode?.kind !== 'move' || rowMode.id !== map.id) return
    const destino = rowMode.destino
    setRowMode(null)
    await moverPara(map.id, destino === '' ? null : destino)
  }

  const submitNovaPasta = async () => {
    if (novaPasta === null) return
    const nome = novaPasta
    setNovaPasta(null)
    await mudarPastas((atual) => criarPasta(atual, nome).indice, 'criar a pasta')
  }

  const submitRenomearPasta = async (pastaId: string) => {
    if (folderMode?.kind !== 'rename' || folderMode.id !== pastaId) return
    const nome = folderMode.draft
    setFolderMode(null)
    await mudarPastas((atual) => renomearPasta(atual, pastaId, nome), 'renomear a pasta')
  }

  const confirmarApagarPasta = async (pasta: PastaDeMapas) => {
    setFolderMode(null)
    const feito = await mudarPastas((atual) => apagarPasta(atual, pasta.id), 'apagar a pasta')
    if (feito !== null) useToastStore.getState().push('info', `Pasta "${pasta.nome}" apagada. Os mapas dela continuam na lista.`)
    novaPastaRef.current?.focus()
  }

  const cancelarApagarPasta = (pastaId: string) => {
    focoPendente.current = deleteFolderButtonId(pastaId)
    setFolderMode(null)
  }

  /** O que a configuração da pasta grava: no disco e, se for a pasta do mapa aberto, na cópia do editor. */
  const mudarRpg = async (pastaId: string, mudar: (rpg: RpgDaPasta) => RpgDaPasta): Promise<void> => {
    const gravado = await editarRpgDaPasta(pastaId, mudar)
    setRpgs((antes) => new Map(antes).set(pastaId, gravado))
  }

  // ── Arrastar o card até a pasta ─────────────────────────────────────────
  // Só o alvo sob o ponteiro muda durante o arrasto (e só quando troca): a lista
  // não redesenha a cada `dragover`. Soltar fora de um alvo não muda nada.
  const alvoDeArrasto = (destino: string) => ({
    onDragOver: (event: DragEvent<HTMLElement>) => {
      if (!event.dataTransfer.types.includes(MIME_DO_MAPA)) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      if (alvoDoArrasto !== destino) setAlvoDoArrasto(destino)
    },
    onDragLeave: (event: DragEvent<HTMLElement>) => {
      // Passar de um filho para outro do mesmo grupo também dispara `dragleave`.
      if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return
      setAlvoDoArrasto((atual) => (atual === destino ? null : atual))
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      const chave = event.dataTransfer.getData(MIME_DO_MAPA)
      setAlvoDoArrasto(null)
      if (chave === '') return
      event.preventDefault()
      void moverPara(chave, destino === '' ? null : destino)
    },
  })

  const resumoDaPasta = (pasta: PastaDeMapas, quantos: number): string => {
    const partes = [plural(quantos, 'mapa', 'mapas')]
    const rpg = rpgs.get(pasta.id)
    if (rpg === null) partes.push('personagens ilegíveis')
    if (rpg !== undefined && rpg !== null && rpg.sistemaDeRpg !== undefined) partes.push(sistemaPorId(biblioteca, rpg.sistemaDeRpg)?.nome ?? rpg.sistemaDeRpg)
    if (rpg !== undefined && rpg !== null && rpg.personagens.length > 0) partes.push(plural(rpg.personagens.length, 'jogador', 'jogadores'))
    return partes.join(' · ')
  }

  const linhaDoMapa = (map: SavedMapEntry) => {
    const mode = rowMode?.id === map.id ? rowMode : null
    const isBusy = busyId === map.id

    return (
      <div
        key={map.path}
        className="lb-maplist__item"
        style={{ cursor: 'default' }}
        draggable={mode === null && !isBusy}
        onDragStart={(event) => {
          event.dataTransfer.setData(MIME_DO_MAPA, map.id)
          event.dataTransfer.effectAllowed = 'move'
        }}
        onDragEnd={() => setAlvoDoArrasto(null)}
      >
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
        ) : mode?.kind === 'move' ? (
          <div className="lb-field" style={{ flex: 1, minWidth: 0 }}>
            <label className="lb-label" htmlFor={`lb-mover-${map.id}`}>
              Mover &quot;{map.name}&quot; para
            </label>
            <div style={{ display: 'flex', gap: 'var(--lb-space-2)' }}>
              <select
                id={`lb-mover-${map.id}`}
                className="lb-input"
                value={mode.destino}
                autoFocus
                onChange={(event) => setRowMode({ id: map.id, kind: 'move', destino: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key !== 'Escape') return
                  // O Esc é deste campo: sem isto o `MenuShell` tiraria o mestre da tela.
                  event.stopPropagation()
                  cancelRowMode()
                }}
              >
                <option value="">Fora das pastas</option>
                {indice.pastas.map((pasta) => (
                  <option key={pasta.id} value={pasta.id}>
                    {pasta.nome}
                  </option>
                ))}
              </select>
              <button type="button" className="lb-btn lb-btn--primary" style={compactBtnStyle} onClick={() => void submitMove(map)}>
                Mover
              </button>
              <button type="button" className="lb-btn lb-btn--ghost" style={compactBtnStyle} onClick={cancelRowMode}>
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
              <button type="button" className="lb-btn lb-btn--danger" style={compactBtnStyle} disabled={isBusy} onClick={() => void confirmDelete(map)}>
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
              <button type="button" className="lb-btn lb-btn--ghost" style={compactBtnStyle} disabled={isBusy} onClick={() => void handleDuplicate(map)}>
                Duplicar
              </button>
              {/* O teclado também move: arrastar o card é só o atalho do mouse. */}
              <button
                type="button"
                className="lb-btn lb-btn--ghost"
                style={compactBtnStyle}
                disabled={isBusy}
                title="Mover para uma pasta (ou arraste o card até ela)"
                onClick={() => setRowMode({ id: map.id, kind: 'move', destino: lugarDoMapa(indice, map.id)?.pasta.id ?? '' })}
              >
                Mover…
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
  }

  const cabecalhoDaPasta = (pasta: PastaDeMapas, mapasDela: readonly SavedMapEntry[]) => {
    const mode = folderMode?.id === pasta.id ? folderMode : null
    const aberta = pasta.recolhida !== true
    if (mode?.kind === 'rename') {
      return (
        <div className="lb-maplist__item" style={{ cursor: 'default' }}>
          <div className="lb-field" style={{ flex: 1, minWidth: 0 }}>
            <label className="lb-label" htmlFor={`lb-pasta-nome-${pasta.id}`}>
              Novo nome da pasta &quot;{pasta.nome}&quot;
            </label>
            <div style={{ display: 'flex', gap: 'var(--lb-space-2)' }}>
              <input
                id={`lb-pasta-nome-${pasta.id}`}
                className="lb-input"
                value={mode.draft}
                autoFocus
                onChange={(event) => setFolderMode({ id: pasta.id, kind: 'rename', draft: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void submitRenomearPasta(pasta.id)
                  }
                  if (event.key === 'Escape') {
                    event.stopPropagation()
                    setFolderMode(null)
                  }
                }}
              />
              <button
                type="button"
                className="lb-btn lb-btn--primary"
                style={compactBtnStyle}
                disabled={mode.draft.trim().length === 0}
                onClick={() => void submitRenomearPasta(pasta.id)}
              >
                Salvar
              </button>
              <button type="button" className="lb-btn lb-btn--ghost" style={compactBtnStyle} onClick={() => setFolderMode(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )
    }
    if (mode?.kind === 'delete-confirm') {
      return (
        <div className="lb-maplist__item" style={{ cursor: 'default' }}>
          <div
            role="alertdialog"
            aria-modal="false"
            aria-labelledby={`lb-del-pasta-titulo-${pasta.id}`}
            aria-describedby={`lb-del-pasta-texto-${pasta.id}`}
            style={deleteConfirmStyle}
            onKeyDown={(event) => {
              if (event.key !== 'Escape') return
              event.preventDefault()
              event.stopPropagation()
              cancelarApagarPasta(pasta.id)
            }}
          >
            <p style={{ flex: 1, minWidth: 0, margin: 0 }}>
              <span id={`lb-del-pasta-titulo-${pasta.id}`}>Apagar a pasta &quot;{pasta.nome}&quot;?</span>{' '}
              <span id={`lb-del-pasta-texto-${pasta.id}`}>
                {mapasDela.length === 0 ? 'Ela está vazia.' : `Os ${plural(mapasDela.length, 'mapa', 'mapas')} dela voltam para a lista — nenhum mapa é apagado.`} Os
                personagens da pasta ficam guardados no disco, e cada mapa volta a usar o próprio sistema e personagens.
              </span>
            </p>
            <div style={rowActionsStyle}>
              <button type="button" className="lb-btn lb-btn--danger" style={compactBtnStyle} onClick={() => void confirmarApagarPasta(pasta)}>
                Apagar pasta
              </button>
              <button type="button" className="lb-btn lb-btn--ghost" style={compactBtnStyle} autoFocus onClick={() => cancelarApagarPasta(pasta.id)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )
    }
    return (
      <div className="lb-maplist__item" style={{ cursor: 'default' }}>
        <button
          type="button"
          style={openButtonStyle(false)}
          aria-expanded={aberta}
          aria-label={`${aberta ? 'Recolher' : 'Abrir'} a pasta ${pasta.nome}`}
          onClick={() => void mudarPastas((atual) => alternarRecolhida(atual, pasta.id), 'recolher a pasta')}
        >
          <span aria-hidden="true" style={{ flex: 'none', width: '1em' }}>
            {aberta ? '▾' : '▸'}
          </span>
          <span className="lb-maplist__name">{pasta.nome}</span>
          <span className="lb-maplist__meta">{resumoDaPasta(pasta, mapasDela.length)}</span>
        </button>
        <div style={rowActionsStyle}>
          <button
            type="button"
            className="lb-btn lb-btn--ghost"
            style={compactBtnStyle}
            aria-expanded={mode?.kind === 'config'}
            onClick={() => setFolderMode(mode?.kind === 'config' ? null : { id: pasta.id, kind: 'config' })}
          >
            Configurar
          </button>
          <button
            type="button"
            className="lb-btn lb-btn--ghost"
            style={compactBtnStyle}
            onClick={() => setFolderMode({ id: pasta.id, kind: 'rename', draft: pasta.nome })}
          >
            Renomear
          </button>
          <button
            id={deleteFolderButtonId(pasta.id)}
            type="button"
            className="lb-btn lb-btn--ghost"
            style={compactBtnStyle}
            onClick={() => setFolderMode({ id: pasta.id, kind: 'delete-confirm' })}
          >
            Excluir
          </button>
        </div>
      </div>
    )
  }

  const mapasDe = (pastaId: string) => maps.filter((map) => lugarDoMapa(indice, map.id)?.pasta.id === pastaId)
  const soltos = maps.filter((map) => lugarDoMapa(indice, map.id) === null)
  const temPastas = indice.pastas.length > 0

  const barraDasPastas =
    novaPasta === null ? (
      <button ref={novaPastaRef} type="button" className="lb-btn lb-btn--ghost" style={{ ...compactBtnStyle, alignSelf: 'flex-start' }} onClick={() => setNovaPasta('')}>
        + Nova pasta
      </button>
    ) : (
      <div className="lb-field">
        <label className="lb-label" htmlFor="lb-nova-pasta">
          Nome da pasta nova
        </label>
        <div style={{ display: 'flex', gap: 'var(--lb-space-2)' }}>
          <input
            id="lb-nova-pasta"
            className="lb-input"
            value={novaPasta}
            autoFocus
            placeholder="Campanha de Goa"
            onChange={(event) => setNovaPasta(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void submitNovaPasta()
              }
              if (event.key === 'Escape') {
                event.stopPropagation()
                setNovaPasta(null)
              }
            }}
          />
          <button type="button" className="lb-btn lb-btn--primary" style={compactBtnStyle} disabled={novaPasta.trim().length === 0} onClick={() => void submitNovaPasta()}>
            Criar
          </button>
          <button type="button" className="lb-btn lb-btn--ghost" style={compactBtnStyle} onClick={() => setNovaPasta(null)}>
            Cancelar
          </button>
        </div>
      </div>
    )

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
          {barraDasPastas}
          {avisoDasPastas !== null && <p className="lb-options__note">{avisoDasPastas}</p>}
          <div className="lb-maplist">
            {indice.pastas.map((pasta) => {
              const mapasDela = mapasDe(pasta.id)
              const rpg = rpgs.get(pasta.id)
              return (
                <section key={pasta.id} aria-label={`Pasta ${pasta.nome}`} style={grupoStyle(alvoDoArrasto === pasta.id)} {...alvoDeArrasto(pasta.id)}>
                  {cabecalhoDaPasta(pasta, mapasDela)}
                  {folderMode?.id === pasta.id && folderMode.kind === 'config' && rpg !== undefined && (
                    <PastaDeMapasConfig
                      pasta={pasta}
                      rpg={rpg}
                      mapas={mapasDela}
                      onMudar={(mudar) => mudarRpg(pasta.id, mudar)}
                      onFechar={() => setFolderMode(null)}
                    />
                  )}
                  {pasta.recolhida !== true && (
                    <div style={dentroDaPastaStyle}>
                      {mapasDela.length === 0 ? (
                        <p className="lb-options__note" style={{ margin: 0 }}>
                          Pasta vazia: arraste um mapa até aqui, ou use &quot;Mover…&quot; no mapa.
                        </p>
                      ) : (
                        mapasDela.map(linhaDoMapa)
                      )}
                    </div>
                  )}
                </section>
              )
            })}
            {temPastas ? (
              <section aria-label="Fora das pastas" style={grupoStyle(alvoDoArrasto === '')} {...alvoDeArrasto('')}>
                <p className="lb-label" style={{ margin: 0 }}>
                  Fora das pastas
                </p>
                {soltos.map(linhaDoMapa)}
              </section>
            ) : (
              soltos.map(linhaDoMapa)
            )}
          </div>
          <button type="button" className="lb-btn lb-btn--ghost lb-btn--block" onClick={handleBrowse}>
            Procurar no disco...
          </button>
        </>
      )}
    </MenuShell>
  )
}
