import type { MapData } from '../types/map'
import { cleanSceneName, sceneFileFor, type Adventure } from '../lib/adventure'
import { gravarRpgDaPasta, rpgDe } from '../lib/pastasDeMapas'
import { mapDirFor, saveAdventureToDisk, scenePath } from '../lib/mapFileIO'
import { levarMidiaDaAventura } from '../lib/midiaDaPasta'
import { storedTokensOfScene, withStoredTokens, type StoredToken } from '../lib/storedTokens'
import { dirname } from '@tauri-apps/api/path'
import { useMapStore } from './mapStore'
import { useSessionStore } from './sessionStore'
import type { AdventureState, SceneSlot } from './adventureStore'

/**
 * PERSISTÊNCIA DA AVENTURA: o que está por salvar (as bandeiras `dirty`,
 * `structureDirty` e `pastaSuja`), a gravação no disco (`flush`, `gravarPasta`)
 * e a cena que volta da cópia de recuperação. Recebe o `get`/`set` do
 * `useAdventureStore`; saiu de lá sem mudar comportamento.
 */

type LerEstado = () => AdventureState
type GravarEstado = (patch: Partial<AdventureState>) => void

/** Há trabalho por salvar fora do mapa aberto (o `isDirty` dele é do `useSessionStore`): cenas, lista, pasta. */
export function temTrabalhoPorSalvar(state: AdventureState): boolean {
  const { adventure, cache, dirty, structureDirty, pastaSuja } = state
  // Mudança esperando uma cena que ainda está vindo do disco também é trabalho não salvo.
  const waiting = Object.values(cache).some((slot) => slot.status === 'carregando' && slot.pending.length > 0)
  // O HP mexido na ficha da pasta também: o mapa solto que herda não tem aventura, mas tem o que salvar.
  return (adventure !== null && (structureDirty || waiting || Object.keys(dirty).length > 0)) || pastaSuja
}

/** `flush` da store: grava a cena aberta, as de fundo com mudança e o `adventure.json`; devolve o caminho da cena aberta. */
export async function gravarAventura(get: LerEstado, set: GravarEstado, stored: readonly StoredToken[]): Promise<string> {
  const state = get()
  const { adventure, activeSceneId } = state
  if (adventure === null || activeSceneId === null) throw new Error('Não há aventura aberta para gravar.')

  let dir = state.dir
  if (dir === null) {
    if (state.rootPath !== null) dir = await dirname(state.rootPath)
    else if (state.rootMapId !== null) dir = await mapDirFor(state.rootMapId)
    else throw new Error('A aventura não tem pasta para gravar.')
  }

  const live = useMapStore.getState().map
  const writes: { file: string; map: MapData }[] = []
  /** Cena → mapa exato que foi para o disco. */
  const written = new Map<string, MapData>()
  const scenes = { ids: new Set(adventure.scenes.map((entry) => entry.id)), activeId: activeSceneId }
  // A ficha guardada saiu do mapa do editor, mas não do arquivo.
  const forDisk = (sceneId: string, map: MapData) => withStoredTokens(map, storedTokensOfScene(stored, sceneId, scenes))
  let activeFile: string | null = null
  for (const entry of adventure.scenes) {
    if (entry.id === activeSceneId) {
      activeFile = entry.file
      writes.push({ file: entry.file, map: forDisk(entry.id, live) })
      written.set(entry.id, live)
      continue
    }
    const slot = state.cache[entry.id]
    if (slot !== undefined && slot.status === 'ok' && state.dirty[entry.id] === true) {
      writes.push({ file: entry.file, map: forDisk(entry.id, slot.map) })
      written.set(entry.id, slot.map)
    }
  }
  if (activeFile === null) throw new Error('A cena aberta não está na lista da aventura.')

  await saveAdventureToDisk(dir, adventure, writes)
  // Retratos e imagens de item vão junto para a pasta (`lib/midiaDaPasta.ts`):
  // a aventura copiada para outro computador abre com eles. Nunca lança — o
  // que não foi vira aviso, e a gravação acima já valeu.
  await levarMidiaDaAventura(dir, {
    personagens: adventure.personagens,
    mapas: cenasComoNoDisco(adventure, state.cache, writes, written),
    tokens: stored.map((entry) => entry.token),
  })

  // O editor não trava enquanto o disco grava: só sai de "pendente" o que
  // continua IGUAL (mesma referência) ao que foi escrito. Mudança feita no
  // meio — cena de fundo, cena aberta, nome ou cena nova — fica pendente.
  // Isso inclui a cena de fundo que chegou do disco durante a gravação com
  // mudança esperando por ela, e a cena nova do portal antigo que veio junto.
  const after = get()
  // Outra aventura (ou mapa solto) entrou no meio: o estado já não é desta gravação.
  if (after.adventure === null || after.adventure.id !== adventure.id) return scenePath(dir, activeFile)
  const nowOf = (sceneId: string): MapData | undefined => {
    if (sceneId === after.activeSceneId) return useMapStore.getState().map
    const slot = after.cache[sceneId]
    return slot !== undefined && slot.status === 'ok' ? slot.map : undefined
  }
  const dirty: Record<string, true> = {}
  for (const sceneId of Object.keys(after.dirty)) {
    const sent = written.get(sceneId)
    // Pendente antes e não escrito = não tinha o que escrever (cena fora do ar): sai, como sempre saiu.
    // Cena "carregando" nunca está em `dirty` (a mudança dela espera em `pending`); a que chega
    // durante a gravação entra em `dirty` só agora, e por isso continua pendente.
    if (sent === undefined ? state.dirty[sceneId] !== true : nowOf(sceneId) !== sent) dirty[sceneId] = true
  }
  // A lista gravada é a de antes do `await`: se ela mudou, a nova ainda não foi.
  // O "Desfazer" de cena apagada vale até gravar (caça 12/11, E3, decisão 13).
  set({ dir, rootPath: null, rootMapId: null, dirty, structureDirty: after.structureDirty && after.adventure !== adventure, cenaApagada: null })
  const activeSent = after.activeSceneId === null ? undefined : written.get(after.activeSceneId)
  if (activeSent !== undefined) useSessionStore.getState().markSaved(activeSent)
  return scenePath(dir, activeFile)
}

/**
 * Cada cena como ficou no disco depois de `flush`, para saber que mídia a
 * aventura usa: a recém-gravada e a de fundo já lida (igual ao disco). A que
 * ainda está chegando do disco fica para a próxima gravação — lê-la aqui
 * esperaria a mesma leitura que já está em curso; a que não abre teve a mídia
 * levada na gravação em que abria.
 */
function cenasComoNoDisco(adventure: Adventure, cache: Record<string, SceneSlot>, writes: readonly { map: MapData }[], written: ReadonlyMap<string, MapData>): MapData[] {
  const mapas = writes.map((write) => write.map)
  for (const entry of adventure.scenes) {
    const slot = cache[entry.id]
    if (!written.has(entry.id) && slot !== undefined && slot.status === 'ok') mapas.push(slot.map)
  }
  return mapas
}

/** `gravarPasta` da store: o `rpg.json` da pasta, quando ele tem mudança. */
export async function gravarPastaSuja(get: LerEstado, set: GravarEstado): Promise<void> {
  const { pasta, pastaSuja } = get()
  if (pasta === null || !pastaSuja) return
  await gravarRpgDaPasta(pasta.pastaId, rpgDe(pasta))
  // Só sai de "pendente" o que continua IGUAL ao que foi escrito, como no `flush`.
  if (get().pasta === pasta) set({ pastaSuja: false })
}

/** `receberCenaRecuperada` da store: a cena de fundo que volta da cópia de recuperação, como NÃO salva. */
export function receberCenaDaCopia(get: LerEstado, set: GravarEstado, sceneId: string, map: MapData): boolean {
  const { adventure, activeSceneId, cache, dirty, structureDirty } = get()
  if (adventure === null || sceneId === activeSceneId) return false
  const naLista = adventure.scenes.some((entry) => entry.id === sceneId)
  const slot = cache[sceneId]
  // Ainda vindo do disco: a da cópia espera o mapa chegar, como toda mudança de cena de fundo.
  if (naLista && slot !== undefined && slot.status !== 'indisponivel') {
    get().updateBackgroundScene(sceneId, () => map)
    return true
  }
  set({
    adventure: naLista ? adventure : { ...adventure, scenes: [...adventure.scenes, { id: sceneId, name: cleanSceneName(map.name), file: sceneFileFor(sceneId) }] },
    cache: { ...cache, [sceneId]: { status: 'ok', map, past: [], future: [], camera: null } },
    dirty: { ...dirty, [sceneId]: true },
    structureDirty: structureDirty || !naLista,
  })
  return true
}
