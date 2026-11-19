import { useMapStore } from './mapStore'
import { useSessionStore } from './sessionStore'
import { useToastStore } from './toastStore'
import { acertarMochilasRecuperadas, hasUnsavedWork, mochilaMoraNaFicha, semAcertoDosBonecos, useAdventureStore } from './adventureStore'
import { scenePath, type OpenedMapFile, type SceneLoad } from '../lib/mapFileIO'
import { rpgDe, type PastaAberta } from '../lib/pastasDeMapas'
import type { AventuraNaCopia, PendingRecoveryCopy, RecoveryCopy } from '../lib/recoveryCopy'
import type { MapData } from '../types/map'

/**
 * SALVAMENTO AUTOMÁTICO da cópia de recuperação.
 *
 * Enquanto houver trabalho não salvo (`hasUnsavedWork`: o mapa aberto ou,
 * numa aventura, uma cena de fundo, a lista de cenas, as fichas, o RPG da
 * pasta), guarda esse trabalho na cópia de recuperação no máximo
 * `RECOVERY_INTERVAL_MS` depois de cada mudança. Se o app cair ou fechar sem
 * salvar, a tela inicial oferece "Recuperar" a partir dessa cópia.
 *
 * Nunca toca o arquivo do mapa: quem grava é `storage` (em produção,
 * `lib/recoveryCopy.ts`, pasta própria fora de `maps/`).
 *
 * Quando não sobra trabalho não salvo (Salvar, Início, ou desfazer até a
 * versão salva), a cópia é apagada — reabrir sem trabalho perdido não oferece
 * nada. Só apaga a cópia que ESTA abertura gravou (ou adotou ao recuperar):
 * abrir ou criar outro mapa também deixa tudo "salvo", e isso não pode sumir
 * com a cópia deixada por uma abertura que caiu antes de o mestre decidir o
 * que fazer com ela. Pelo mesmo motivo, a primeira cópia desta abertura não
 * grava por cima da que já estava lá: antes ela é posta de lado
 * (`RecoveryStorage.setAside`) e continua oferecida no menu.
 */

/** Uma mudança vira cópia em até 10 s — a régua promete no máximo 30 s. */
export const RECOVERY_INTERVAL_MS = 10_000

/** Teto de arquivos tentados até achar a aventura no disco: a cena criada depois do último Salvar ainda não tem arquivo. */
const MAX_REOPEN_TRIES = 8

const SCENE_NOT_RECOVERED = 'a cena não estava na cópia de recuperação nem abriu do disco'

export interface RecoveryStorage {
  write: (copy: RecoveryCopy) => Promise<void>
  clear: () => Promise<void>
  /**
   * Guarda em outro lugar a cópia que uma abertura ANTERIOR deixou, antes do
   * primeiro `write` desta. Ausente = não há onde guardar, e o `write` grava
   * por cima (como era antes de 18/11/2026).
   */
  setAside?: () => Promise<void>
  /** Apaga a cópia guardada por `setAside` (recuperada ou descartada pelo mestre). */
  clearSetAside?: () => Promise<void>
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
  /**
   * O mestre recuperou a cópia: ela passa a ser desta abertura (Salvar a
   * apaga). `pending` diz qual cópia e de onde ela foi lida; a que estava (ou
   * foi posta) de lado volta para o lugar da cópia desta abertura.
   */
  adoptExistingCopy: (pending?: PendingRecoveryCopy) => void
  /** "Descartar" do menu: a cópia que esperava o mestre é apagada, esteja onde estiver. */
  discardPreviousCopy: (pending: PendingRecoveryCopy) => void
  stop: () => void
  /** Resolve quando a última operação de disco enfileirada terminar. */
  idle: () => Promise<void>
}

/**
 * O trabalho do editor neste instante. Todo o estado é lido ANTES do primeiro
 * `await`: o caminho da cena sai do mesmo instante do mapa copiado. Também o
 * mapa aberto antes de a pasta dele mudar (`net/nuvem/mochilaPendenteNoApp.ts`).
 *
 * A aventura (lista de cenas, fichas, agenda, cabines) entra quando mudou
 * desde o último Salvar ou nunca foi gravada; o RPG da pasta, quando tem
 * mudança por gravar. Sem eles o "Recuperar" trazia os mapas de agora com as
 * fichas e a lista do último Salvar.
 */
export async function captureEditorWork(getLooseMapPath: () => string | null, savedAtMs: number): Promise<RecoveryCopy> {
  const map = useMapStore.getState().map
  const adventureState = useAdventureStore.getState()
  const { adventure, dir, rootPath, rootMapId, activeSceneId, cache, dirty, structureDirty, pasta, pastaSuja } = adventureState
  // MOCHILA NA FICHA: sem as fichas na cópia, o "Recuperar" leva a mochila dos bonecos para elas (`restoreRecoveryCopy`).
  const daFicha: Pick<RecoveryCopy, 'mochilaNaFicha'> = mochilaMoraNaFicha(adventureState) ? { mochilaNaFicha: true } : {}
  const daPasta: Pick<RecoveryCopy, 'pasta'> = pasta !== null && pastaSuja ? { pasta: { pastaId: pasta.pastaId, rpg: rpgDe(pasta) } } : {}
  if (adventure === null || activeSceneId === null) return { savedAtMs, mapPath: getLooseMapPath(), map, scenes: {}, ...daFicha, ...daPasta }

  // Aventura nunca gravada: no disco não há nada dela, então TODA cena lida vai na cópia, não só as com mudança.
  const nuncaGravada = dir === null
  const scenes: Record<string, MapData> = {}
  for (const sceneId of Object.keys(nuncaGravada ? cache : dirty)) {
    const slot = cache[sceneId]
    if (sceneId !== activeSceneId && slot !== undefined && slot.status === 'ok') scenes[sceneId] = slot.map
  }
  const entry = adventure.scenes.find((scene) => scene.id === activeSceneId)
  // Aventura nunca gravada (`dir === null`): não há arquivo onde reabrir a cena.
  const mapPath = dir !== null && entry !== undefined ? await scenePath(dir, entry.file) : null
  const daAventura: Pick<RecoveryCopy, 'aventura'> =
    structureDirty || nuncaGravada ? { aventura: { dados: adventure, activeSceneId, dir, rootPath, rootMapId } } : {}
  return { savedAtMs, mapPath, map, scenes, ...daFicha, ...daAventura, ...daPasta }
}

/** Abre `path` sem lançar: arquivo sumido ou ilegível é só "não há". */
async function openOrNull(path: string, openFile: (path: string) => Promise<OpenedMapFile>): Promise<OpenedMapFile | null> {
  try {
    return await openFile(path)
  } catch {
    return null
  }
}

/**
 * A aventura da cópia como está no DISCO, para trazer as cenas que a cópia não
 * levou (as sem mudança). Tenta a cena aberta e depois as outras: a criada
 * depois do último Salvar ainda não tem arquivo. `null` = nenhuma abriu.
 */
async function adventureOnDisk(copy: RecoveryCopy, retrato: AventuraNaCopia, dir: string, openFile: (path: string) => Promise<OpenedMapFile>): Promise<OpenedMapFile | null> {
  const candidates: string[] = copy.mapPath === null ? [] : [copy.mapPath]
  for (const entry of retrato.dados.scenes) {
    if (candidates.length >= MAX_REOPEN_TRIES) break
    try {
      const path = await scenePath(dir, entry.file)
      if (!candidates.includes(path)) candidates.push(path)
    } catch {
      // Cena com caminho inválido não é candidata; as outras continuam valendo.
    }
  }
  for (const path of candidates) {
    const opened = await openOrNull(path, openFile)
    if (opened !== null && opened.adventure !== null && opened.adventure.id === retrato.dados.id) return opened
  }
  return null
}

/**
 * A aventura RECUPERADA, na forma que `adventureStore.open` recebe: a lista, as
 * fichas e o resto do `adventure.json` são os da cópia; cada cena é a da cópia
 * quando ela a levou, senão a do disco. A cena que não está em nenhum dos dois
 * fica na lista como indisponível (com o motivo), em vez de sumir.
 */
function recoveredAdventure(copy: RecoveryCopy, retrato: AventuraNaCopia, disk: OpenedMapFile | null, path: string): OpenedMapFile {
  const fromDisk = new Map<string, SceneLoad>()
  if (disk !== null) for (const load of disk.scenes) fromDisk.set(load.entry.id, load)
  const convertedOnDisk = new Set(disk === null ? [] : disk.changedSceneIds)
  const changedSceneIds: string[] = []
  const scenes = retrato.dados.scenes.map((entry): SceneLoad => {
    if (entry.id === retrato.activeSceneId) {
      changedSceneIds.push(entry.id)
      return { entry, status: 'ok', map: copy.map }
    }
    const recovered = copy.scenes[entry.id]
    if (recovered !== undefined) {
      changedSceneIds.push(entry.id)
      return { entry, status: 'ok', map: recovered }
    }
    const load = fromDisk.get(entry.id)
    if (load === undefined) return { entry, status: 'indisponivel', reason: SCENE_NOT_RECOVERED }
    if (convertedOnDisk.has(entry.id)) changedSceneIds.push(entry.id)
    if (load.status === 'ok') return { entry, status: 'ok', map: load.map }
    if (load.status === 'indisponivel') return { entry, status: 'indisponivel', reason: load.reason }
    return { entry, status: 'pendente' }
  })
  // O editor abre com a cena como está no disco e recebe a da cópia por cima (`restoreRecoveryCopy`): ela entra como NÃO salva.
  const onDisk = fromDisk.get(retrato.activeSceneId)
  return {
    path,
    map: onDisk !== undefined && onDisk.status === 'ok' ? onDisk.map : copy.map,
    adventure: retrato.dados,
    adventureDir: retrato.dir,
    activeSceneId: retrato.activeSceneId,
    scenes,
    changedSceneIds,
    adventureChanged: true,
    legacySources: [],
  }
}

/**
 * Cópia COM a aventura (`RecoveryCopy.aventura`): a lista de cenas, as fichas e
 * o resto voltam como estavam na memória, não como o último Salvar deixou. A
 * cena criada depois do último Salvar volta no lugar dela, aberta ou de fundo.
 */
async function reopenWithAdventure(
  copy: RecoveryCopy,
  retrato: AventuraNaCopia,
  openFile: (path: string) => Promise<OpenedMapFile>,
  pastaDoArquivo: (path: string) => Promise<PastaAberta | null>,
): Promise<string | null> {
  const { dir } = retrato
  // Aventura nunca gravada: as cenas vieram todas na cópia. Abrir o arquivo do mapa solto de onde ela nasceu
  // serve para o app voltar a ter acesso à pasta dele (o primeiro Salvar grava lá).
  const disk = dir !== null ? await adventureOnDisk(copy, retrato, dir, openFile) : retrato.rootPath !== null ? await openOrNull(retrato.rootPath, openFile) : null
  const origem = dir !== null ? (copy.mapPath ?? (disk === null ? null : disk.path)) : retrato.rootPath
  const daPasta = disk !== null ? disk.path : origem
  const pasta = daPasta === null ? null : await pastaDoArquivo(daPasta)
  // Só a aventura do disco empresta cenas: o mapa solto de onde ela nasceu não tem a lista.
  const emprestada = dir !== null ? disk : null
  // Sem arquivo de origem (aventura nascida de mapa nunca salvo) o caminho vai vazio: `open` não o lê, e não há cena por buscar no disco.
  void useAdventureStore.getState().open(recoveredAdventure(copy, retrato, emprestada, origem ?? ''), pasta)
  if (dir === null) useAdventureStore.setState({ rootPath: retrato.rootPath, rootMapId: retrato.rootMapId })
  return origem
}

/**
 * Cópia SEM a aventura (mapa solto, aventura igual à do disco, ou cópia feita
 * por uma versão anterior do app): reabre o arquivo de onde o trabalho veio e
 * põe por cima as cenas de fundo com mudança. Nenhuma é descartada calada: a
 * que não está na lista do disco entra no fim dela; sem aventura onde pôr, o
 * mestre é avisado.
 */
async function reopenFromFile(
  copy: RecoveryCopy,
  openFile: (path: string) => Promise<OpenedMapFile>,
  pastaDoArquivo: (path: string) => Promise<PastaAberta | null>,
): Promise<string | null> {
  const opened = copy.mapPath === null ? null : await openOrNull(copy.mapPath, openFile)
  const sceneIds = Object.keys(copy.scenes)
  if (opened === null) {
    useAdventureStore.getState().reset()
    if (sceneIds.length > 0) warnScenesLeftBehind(sceneIds.length)
    return null
  }
  void useAdventureStore.getState().open(opened, await pastaDoArquivo(opened.path))
  let leftBehind = 0
  // O trabalho recuperado CHEGA (não é edição sobre o mapa do disco): a mochila dele é acertada no fim (`acertarMochilasRecuperadas`).
  semAcertoDosBonecos(() => {
    for (const [sceneId, sceneMap] of Object.entries(copy.scenes)) {
      if (!useAdventureStore.getState().receberCenaRecuperada(sceneId, sceneMap)) leftBehind += 1
    }
  })
  if (leftBehind > 0) warnScenesLeftBehind(leftBehind)
  return opened.path
}

function warnScenesLeftBehind(count: number): void {
  const quantas = count === 1 ? '1 cena de fundo com mudança não pôde voltar' : `${count} cenas de fundo com mudança não puderam voltar`
  useToastStore.getState().push('error', `Recuperar: ${quantas} (o arquivo da aventura não abriu). A cena aberta voltou.`)
}

/**
 * "Recuperar": reabre o arquivo de onde o trabalho veio (numa aventura, a
 * aventura inteira, com a cena aberta) e põe por cima o que não tinha sido
 * salvo — o mapa aberto, as cenas de fundo com mudança e, quando a cópia os
 * levou, a aventura (lista de cenas, fichas, agenda, cabines) e o RPG da pasta.
 * Tudo entra como NÃO salvo: o arquivo em disco só muda quando o mestre mandar
 * salvar. Arquivo de origem sumido, ou mapa nunca salvo: volta como mapa novo.
 *
 * Devolve o caminho de origem que o editor passa a usar (`null` = mapa novo).
 * `openFile` é `openMapFile` em produção; `pastaDoArquivo`, `pastaAbertaDoArquivo`
 * (a pasta do mapa, como na abertura normal: o mapa que herda volta com as
 * fichas da pasta). Ausente, o mapa volta sem pasta.
 *
 * MOCHILA NA FICHA: sem as fichas na cópia, elas vêm do disco, do último
 * Salvar. Cópia feita com a mochila já na ficha (`mochilaNaFicha`): a mochila
 * dos bonecos recuperados volta para elas, o mapa aberto primeiro — a Poção
 * pega depois do último Salvar não some na troca de cena. Nos dois casos, os
 * bonecos recuperados passam a mostrar as fichas (`acertarMochilasRecuperadas`).
 */
export async function restoreRecoveryCopy(
  copy: RecoveryCopy,
  openFile: (path: string) => Promise<OpenedMapFile>,
  pastaDoArquivo: (path: string) => Promise<PastaAberta | null> = async () => null,
): Promise<string | null> {
  const origem =
    copy.aventura === undefined ? await reopenFromFile(copy, openFile, pastaDoArquivo) : await reopenWithAdventure(copy, copy.aventura, openFile, pastaDoArquivo)
  semAcertoDosBonecos(() => useMapStore.getState().loadMap(copy.map))
  // As fichas da pasta voltam antes do acerto das mochilas: é com elas que os bonecos recuperados são comparados.
  if (copy.pasta !== undefined) useAdventureStore.getState().reporRpgDaPasta(copy.pasta.pastaId, copy.pasta.rpg)
  acertarMochilasRecuperadas([copy.map, ...Object.values(copy.scenes)], copy.mochilaNaFicha === true)
  return origem
}

export function startRecoveryAutosave(options: RecoveryAutosaveOptions): RecoveryAutosave {
  const { storage, getLooseMapPath, onError, intervalMs = RECOVERY_INTERVAL_MS, now = Date.now } = options
  let timer: ReturnType<typeof setTimeout> | null = null
  let ownsCopy = false
  // A cópia que já estava no disco quando esta abertura começou saiu do caminho (guardada, recuperada ou descartada)?
  // Só então o `write` desta abertura pode usar o arquivo. Lido e escrito DENTRO da fila, na ordem das operações.
  let previousHandled = false
  /** `setAside` rodou nesta abertura: a cópia que o menu ainda oferece está no arquivo guardado, não mais no principal. */
  let movedAside = false
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
    enqueue(async () => {
      // A cópia de uma abertura anterior que o mestre ainda não recuperou sai da frente primeiro.
      // Não deu para guardar: esta não grava por cima (a próxima mudança tenta de novo).
      if (!previousHandled) {
        if (storage.setAside !== undefined) {
          await storage.setAside()
          movedAside = true
        }
        previousHandled = true
      }
      await storage.write(await copy)
    })
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
    enqueue(async () => {
      // Sem cópia desta abertura no arquivo (o primeiro `write` não chegou a rodar), o que está lá é de uma abertura anterior: fica.
      if (previousHandled) await storage.clear()
    })
  }

  const unsubscribers = [
    useMapStore.subscribe((state) => state.map, onChange),
    useSessionStore.subscribe(onChange),
    useAdventureStore.subscribe(onChange),
  ]

  return {
    adoptExistingCopy: (pending) => {
      ownsCopy = true
      enqueue(async () => {
        const setAside = pending !== undefined && (pending.setAside || movedAside)
        previousHandled = true
        if (pending === undefined || !setAside) return
        // A recuperada volta para o arquivo desta abertura já (a queda nos 10 s seguintes não a perde) e sai do guardado.
        await storage.write(pending.copy)
        if (storage.clearSetAside !== undefined) await storage.clearSetAside()
        movedAside = false
      })
    },
    discardPreviousCopy: (pending) => {
      enqueue(async () => {
        if (pending.setAside || movedAside) {
          if (storage.clearSetAside !== undefined) await storage.clearSetAside()
          movedAside = false
          return
        }
        // Ainda no arquivo principal, e esta abertura não gravou nada lá.
        if (!previousHandled) await storage.clear()
        previousHandled = true
      })
    },
    stop: () => {
      stopped = true
      cancelTimer()
      for (const unsubscribe of unsubscribers) unsubscribe()
    },
    idle: () => queue,
  }
}
