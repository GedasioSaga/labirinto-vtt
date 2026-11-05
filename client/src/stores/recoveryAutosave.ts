import { useMapStore } from './mapStore'
import { useSessionStore } from './sessionStore'
import { acertarMochilasRecuperadas, hasUnsavedWork, mochilaMoraNaFicha, semAcertoDosBonecos, useAdventureStore } from './adventureStore'
import { scenePath, type OpenedMapFile } from '../lib/mapFileIO'
import type { PastaAberta } from '../lib/pastasDeMapas'
import type { RecoveryCopy } from '../lib/recoveryCopy'
import type { MapData } from '../types/map'

/**
 * SALVAMENTO AUTOMÁTICO da cópia de recuperação.
 *
 * Enquanto houver trabalho não salvo (`hasUnsavedWork`: o mapa aberto ou,
 * numa aventura, uma cena de fundo), guarda esse trabalho na cópia de
 * recuperação no máximo `RECOVERY_INTERVAL_MS` depois de cada mudança. Se o
 * app cair ou fechar sem salvar, a tela inicial oferece "Recuperar" a partir
 * dessa cópia.
 *
 * Nunca toca o arquivo do mapa: quem grava é `storage` (em produção,
 * `lib/recoveryCopy.ts`, pasta própria fora de `maps/`).
 *
 * Quando não sobra trabalho não salvo (Salvar, Início, ou desfazer até a
 * versão salva), a cópia é apagada — reabrir sem trabalho perdido não oferece
 * nada. Só apaga a cópia que ESTA abertura gravou (ou adotou ao recuperar):
 * abrir ou criar outro mapa também deixa tudo "salvo", e isso não pode sumir
 * com a cópia deixada por uma abertura que caiu antes de o mestre decidir o
 * que fazer com ela.
 */

/** Uma mudança vira cópia em até 10 s — a régua promete no máximo 30 s. */
export const RECOVERY_INTERVAL_MS = 10_000

export interface RecoveryStorage {
  write: (copy: RecoveryCopy) => Promise<void>
  clear: () => Promise<void>
}

export interface RecoveryAutosaveOptions {
  storage: RecoveryStorage
  /** Origem do mapa SOLTO em edição (fora de aventura); `null` = mapa novo. */
  getLooseMapPath: () => string | null
  /** Chamado na primeira falha de disco de uma sequência de falhas. */
  onError?: (err: unknown) => void
  intervalMs?: number
  now?: () => number
}

export interface RecoveryAutosave {
  /** O mestre recuperou a cópia: ela passa a ser desta abertura (Salvar a apaga). */
  adoptExistingCopy: () => void
  stop: () => void
  /** Resolve quando a última operação de disco enfileirada terminar. */
  idle: () => Promise<void>
}

/**
 * O trabalho do editor neste instante. Todo o estado é lido ANTES do primeiro
 * `await`: o caminho da cena sai do mesmo instante do mapa copiado. Também o
 * mapa aberto antes de a pasta dele mudar (`net/nuvem/mochilaPendenteNoApp.ts`).
 */
export async function captureEditorWork(getLooseMapPath: () => string | null, savedAtMs: number): Promise<RecoveryCopy> {
  const map = useMapStore.getState().map
  const adventureState = useAdventureStore.getState()
  const { adventure, dir, activeSceneId, cache, dirty } = adventureState
  // MOCHILA NA FICHA: a cópia não leva as fichas; o "Recuperar" leva a mochila dos bonecos para elas (`restoreRecoveryCopy`).
  const daFicha: Pick<RecoveryCopy, 'mochilaNaFicha'> = mochilaMoraNaFicha(adventureState) ? { mochilaNaFicha: true } : {}
  if (adventure === null) return { savedAtMs, mapPath: getLooseMapPath(), map, scenes: {}, ...daFicha }

  const scenes: Record<string, MapData> = {}
  for (const sceneId of Object.keys(dirty)) {
    const slot = cache[sceneId]
    if (sceneId !== activeSceneId && slot !== undefined && slot.status === 'ok') scenes[sceneId] = slot.map
  }
  const entry = adventure.scenes.find((scene) => scene.id === activeSceneId)
  // Aventura nunca gravada (`dir === null`): não há arquivo onde reabrir, a
  // cena aberta volta como mapa novo.
  const mapPath = dir !== null && entry !== undefined ? await scenePath(dir, entry.file) : null
  return { savedAtMs, mapPath, map, scenes, ...daFicha }
}

/**
 * "Recuperar": reabre o arquivo de onde o trabalho veio (numa aventura, a
 * aventura inteira, com a cena aberta) e põe por cima o que não tinha sido
 * salvo — o mapa aberto e as cenas de fundo com mudança. Tudo entra como NÃO
 * salvo: o arquivo em disco só muda quando o mestre mandar salvar. Arquivo
 * de origem sumido, ou mapa nunca salvo: volta como mapa novo.
 *
 * Devolve o caminho de origem que o editor passa a usar (`null` = mapa novo).
 * `openFile` é `openMapFile` em produção; `pastaDoArquivo`, `pastaAbertaDoArquivo`
 * (a pasta do mapa, como na abertura normal: o mapa que herda volta com as
 * fichas da pasta). Ausente, o mapa volta sem pasta.
 *
 * MOCHILA NA FICHA: as fichas vêm do disco, do último Salvar. Cópia feita
 * com a mochila já na ficha (`mochilaNaFicha`): a mochila dos bonecos
 * recuperados volta para elas, o mapa aberto primeiro — a Poção pega depois
 * do último Salvar não some na troca de cena. Nos dois casos, os bonecos
 * recuperados passam a mostrar as fichas (`acertarMochilasRecuperadas`).
 */
export async function restoreRecoveryCopy(
  copy: RecoveryCopy,
  openFile: (path: string) => Promise<OpenedMapFile>,
  pastaDoArquivo: (path: string) => Promise<PastaAberta | null> = async () => null,
): Promise<string | null> {
  let opened: OpenedMapFile | null = null
  if (copy.mapPath !== null) {
    try {
      opened = await openFile(copy.mapPath)
    } catch {
      opened = null
    }
  }
  if (opened === null) {
    useAdventureStore.getState().reset()
  } else {
    useAdventureStore.getState().open(opened, await pastaDoArquivo(opened.path))
    // O trabalho recuperado CHEGA (não é edição sobre o mapa do disco): a mochila dele é acertada no fim (`acertarMochilasRecuperadas`).
    semAcertoDosBonecos(() => {
      for (const [sceneId, sceneMap] of Object.entries(copy.scenes)) {
        useAdventureStore.getState().updateBackgroundScene(sceneId, () => sceneMap)
      }
    })
  }
  semAcertoDosBonecos(() => useMapStore.getState().loadMap(copy.map))
  acertarMochilasRecuperadas([copy.map, ...Object.values(copy.scenes)], copy.mochilaNaFicha === true)
  return opened === null ? null : opened.path
}

export function startRecoveryAutosave(options: RecoveryAutosaveOptions): RecoveryAutosave {
  const { storage, getLooseMapPath, onError, intervalMs = RECOVERY_INTERVAL_MS, now = Date.now } = options
  let timer: ReturnType<typeof setTimeout> | null = null
  let ownsCopy = false
  let failing = false
  let stopped = false
  // Fila: gravar e apagar nunca se cruzam — um "apagar" pedido depois de um
  // "gravar" em andamento roda depois dele, e não é desfeito por ele.
  let queue: Promise<void> = Promise.resolve()

  const enqueue = (op: () => Promise<void>): void => {
    queue = queue.then(op).then(
      () => {
        failing = false
      },
      (err: unknown) => {
        if (!failing) onError?.(err)
        failing = true
      },
    )
  }

  const cancelTimer = (): void => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }

  const flush = (): void => {
    timer = null
    if (stopped || !hasUnsavedWork()) return
    ownsCopy = true
    const copy = captureEditorWork(getLooseMapPath, now())
    // A falha é tratada quando a fila chega nesta cópia (`await copy` abaixo
    // cai no `onError`); isto só evita o aviso de rejeição não tratada
    // enquanto a cópia espera a vez.
    copy.catch(() => undefined)
    enqueue(async () => storage.write(await copy))
  }

  /** Toda mudança no editor passa por aqui: agenda a cópia ou, sem trabalho pendente, apaga a desta abertura. */
  const onChange = (): void => {
    if (stopped) return
    if (hasUnsavedWork()) {
      if (timer === null) timer = setTimeout(flush, intervalMs)
      return
    }
    cancelTimer()
    if (!ownsCopy) return
    ownsCopy = false
    enqueue(() => storage.clear())
  }

  const unsubscribers = [
    useMapStore.subscribe((state) => state.map, onChange),
    useSessionStore.subscribe(onChange),
    useAdventureStore.subscribe(onChange),
  ]

  return {
    adoptExistingCopy: () => {
      ownsCopy = true
    },
    stop: () => {
      stopped = true
      cancelTimer()
      for (const unsubscribe of unsubscribers) unsubscribe()
    },
    idle: () => queue,
  }
}
