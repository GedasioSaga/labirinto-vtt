import { exists, mkdir, readTextFile, remove, writeTextFile } from '@tauri-apps/plugin-fs'
import { appDataDir, join } from '@tauri-apps/api/path'
import type { MapData, ModeloDeCamadas } from '../types/map'
import { parseAdventure, type Adventure } from './adventure'
import { lerModeloDeCamadas } from './camadas/arquivo'
import { deserializeMap, serializeMap } from './mapFile'
import { rpgDoArquivo, type RpgDaPasta } from './pastasDeMapas'

/**
 * CÓPIA DE RECUPERAÇÃO — o trabalho não salvo que o salvamento automático
 * guarda enquanto o mestre edita (ver `stores/recoveryAutosave.ts`).
 *
 * Mora numa pasta PRÓPRIA em `%APPDATA%`, fora de `%APPDATA%/maps`: assim
 * nunca grava por cima de um `map.json` salvo (o mapa salvo só muda quando o
 * mestre manda salvar) e nunca aparece como mapa na tela "Carregar Mapa"
 * (`listSavedMaps` só lê `maps/`). Uma cópia por abertura do app: a desta
 * (`copia-de-recuperacao.json`) e, ao lado, a GUARDADA (`copia-guardada.json`)
 * — a que uma abertura anterior deixou e o mestre ainda não recuperou. Quem
 * edita outro mapa antes de recuperar não grava por cima dela: ela é posta de
 * lado (`setAsideRecoveryCopy`) e o menu continua a oferecê-la.
 *
 * A cópia é um RETRATO do trabalho não salvo: os mapas e, quando mudaram
 * desde o último Salvar, a aventura (lista de cenas, fichas, agenda, cabines)
 * e o RPG da pasta de mapas. Os campos novos são opcionais: a cópia de uma
 * versão anterior do app continua abrindo, só com os mapas.
 *
 * Grava direto no arquivo final, sem arquivo temporário + renomear: a
 * capability do app (`desktop/src-tauri/capabilities/default.json`) não
 * libera `fs:allow-rename`. Uma queda no meio da escrita deixa o JSON
 * cortado — `parseRecoveryCopy` trata isso como "sem cópia", nunca como erro.
 */

export interface RecoveryCopy {
  /** Quando a cópia foi feita, em ms desde a época (`Date.now()`). */
  savedAtMs: number
  /**
   * Arquivo de onde o mapa aberto veio (numa aventura, o da cena aberta);
   * `null` = mapa novo, ou aventura ainda nunca gravada.
   */
  mapPath: string | null
  /** O mapa que estava aberto no editor. */
  map: MapData
  /** Aventura: as cenas de FUNDO com mudança não salva, por id de cena. */
  scenes: Record<string, MapData>
  /**
   * MOCHILA NA FICHA: a cópia foi feita com a mochila já morando na ficha
   * (depois da migração). A cópia não guarda as fichas — o "Recuperar" leva a
   * mochila dos bonecos recuperados para elas (`acertarMochilasRecuperadas`).
   * Ausente = antes da migração: a mochila estava nos bonecos, e a migração
   * da abertura já os junta com a hora da cópia.
   */
  mochilaNaFicha?: true
  /**
   * A AVENTURA como estava na memória, quando a lista de cenas ou o que mora
   * no `adventure.json` (fichas, HP, agenda, cabines, estados) mudou desde o
   * último Salvar, ou quando ela nunca foi gravada. Ausente = mapa solto, ou
   * aventura igual à do disco (e toda cópia de antes de 18/11/2026).
   */
  aventura?: AventuraNaCopia
  /**
   * O RPG DA PASTA de mapas (o `rpg.json` dela) como estava na memória, quando
   * tinha mudança por gravar. Ausente = fora das pastas, ou pasta igual à do disco.
   */
  pasta?: PastaNaCopia
}

/** A aventura dentro da cópia (`RecoveryCopy.aventura`). */
export interface AventuraNaCopia {
  /** O que o próximo Salvar gravaria no `adventure.json`. */
  dados: Adventure
  /** A cena que estava aberta (a de `RecoveryCopy.map`). */
  activeSceneId: string
  /** Pasta da aventura; `null` = ela ainda não tinha sido gravada nenhuma vez. */
  dir: string | null
  /** Com `dir` nulo: o arquivo do mapa solto que virou a primeira cena (`null` = nunca salvo). */
  rootPath: string | null
  /** Com `dir` nulo: o id do mapa da primeira cena, de onde o primeiro Salvar tira a pasta. */
  rootMapId: string | null
}

/** O RPG da pasta de mapas dentro da cópia (`RecoveryCopy.pasta`). */
export interface PastaNaCopia {
  pastaId: string
  rpg: RpgDaPasta
}

const RECOVERY_FORMAT_VERSION = 1
const RECOVERY_DIR_NAME = 'recuperacao'
const RECOVERY_FILE_NAME = 'copia-de-recuperacao.json'
/** A cópia de uma abertura anterior, posta de lado para não ser sobrescrita (`setAsideRecoveryCopy`). */
const SET_ASIDE_FILE_NAME = 'copia-guardada.json'

/**
 * O mapa e as cenas vão pelo mesmo `serializeMap` do `map.json` (o que não vai
 * ao arquivo do mapa também não vai à cópia — `modeloCamadas`, com os nomes das
 * camadas livres, inclusive). O MODELO de camadas da aventura vai à parte, em
 * `camadas`: camada livre criada e ainda não salva não se perde na recuperação.
 * O texto é montado em pedaços para cada mapa ser serializado uma vez só.
 */
export function serializeRecoveryCopy(copy: RecoveryCopy): string {
  const camadas = copy.map.modeloCamadas ?? Object.values(copy.scenes).find((scene) => scene.modeloCamadas !== undefined)?.modeloCamadas
  const cabecalho = JSON.stringify({
    versao: RECOVERY_FORMAT_VERSION,
    savedAtMs: copy.savedAtMs,
    mapPath: copy.mapPath,
    ...(camadas === undefined ? {} : { camadas }),
    ...(copy.mochilaNaFicha === true ? { mochilaNaFicha: true } : {}),
    ...(copy.aventura === undefined ? {} : { aventura: copy.aventura }),
    ...(copy.pasta === undefined ? {} : { pasta: copy.pasta }),
  })
  const cenas = Object.entries(copy.scenes).map(([sceneId, scene]) => `${JSON.stringify(sceneId)}:${serializeMap(scene)}`)
  // `cabecalho` é um objeto JSON não vazio: tira o `}` do fim e emenda mapa e cenas.
  return `${cabecalho.slice(0, -1)},"map":${serializeMap(copy.map)},"scenes":{${cenas.join(',')}}}`
}

/** Mesma normalização de um map.json aberto do disco (campos novos com valor padrão, `id` obrigatório). */
function parseMap(raw: unknown, camadas: ModeloDeCamadas | undefined): MapData | null {
  if (!isRecord(raw)) return null
  try {
    const map = deserializeMap(JSON.stringify(raw))
    // O modelo volta para o mapa em memória (é dele que o Ctrl+Z e as camadas leem).
    return camadas === undefined ? map : { ...map, modeloCamadas: camadas }
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

/**
 * A aventura da cópia, pelo mesmo leitor tolerante do `adventure.json`. Fora
 * do formato (sem cena nenhuma, cena aberta que não está na lista) conta como
 * ausente: os mapas voltam pelo caminho de antes, sem a lista de cenas.
 */
function parseAdventureInCopy(raw: unknown): AventuraNaCopia | undefined {
  if (!isRecord(raw) || typeof raw.activeSceneId !== 'string') return undefined
  const { activeSceneId } = raw
  let dados: Adventure
  try {
    dados = parseAdventure(JSON.stringify(raw.dados))
  } catch {
    return undefined
  }
  if (!dados.scenes.some((scene) => scene.id === activeSceneId)) return undefined
  return { dados, activeSceneId, dir: textOrNull(raw.dir), rootPath: textOrNull(raw.rootPath), rootMapId: textOrNull(raw.rootMapId) }
}

/** O RPG da pasta da cópia, pelo mesmo leitor tolerante do `rpg.json`. Sem o id da pasta conta como ausente. */
function parseFolderInCopy(raw: unknown): PastaNaCopia | undefined {
  if (!isRecord(raw) || typeof raw.pastaId !== 'string' || raw.pastaId.length === 0 || !isRecord(raw.rpg)) return undefined
  return { pastaId: raw.pastaId, rpg: rpgDoArquivo(raw.rpg) }
}

/**
 * Lê o texto do arquivo de recuperação. Qualquer coisa fora do formato —
 * JSON cortado por uma queda, versão desconhecida, mapa sem `id` — devolve
 * `null`: sem cópia legível não há o que oferecer, e a tela inicial não pode
 * quebrar por causa disso.
 */
export function parseRecoveryCopy(text: string): RecoveryCopy | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  if (!isRecord(parsed) || parsed.versao !== RECOVERY_FORMAT_VERSION) return null
  const { savedAtMs, mapPath } = parsed
  if (typeof savedAtMs !== 'number' || !Number.isFinite(savedAtMs)) return null
  if (mapPath !== null && typeof mapPath !== 'string') return null
  // Modelo torto vira ausente (`lerModeloDeCamadas`): a cópia volta com as 13 padrão.
  const camadas = lerModeloDeCamadas(parsed.camadas)
  const map = parseMap(parsed.map, camadas)
  if (map === null) return null
  // Cena de fundo ilegível fica de fora; o mapa aberto, que é o principal, volta.
  const scenes: Record<string, MapData> = {}
  if (isRecord(parsed.scenes)) {
    for (const [sceneId, raw] of Object.entries(parsed.scenes)) {
      const scene = parseMap(raw, camadas)
      if (scene !== null) scenes[sceneId] = scene
    }
  }
  const aventura = parseAdventureInCopy(parsed.aventura)
  const pasta = parseFolderInCopy(parsed.pasta)
  return {
    savedAtMs,
    mapPath,
    map,
    scenes,
    ...(parsed.mochilaNaFicha === true ? { mochilaNaFicha: true } : {}),
    ...(aventura === undefined ? {} : { aventura }),
    ...(pasta === undefined ? {} : { pasta }),
  }
}

async function recoveryPaths(): Promise<{ dir: string; file: string; setAside: string }> {
  const dir = await join(await appDataDir(), RECOVERY_DIR_NAME)
  return { dir, file: await join(dir, RECOVERY_FILE_NAME), setAside: await join(dir, SET_ASIDE_FILE_NAME) }
}

export async function writeRecoveryCopy(copy: RecoveryCopy): Promise<void> {
  const { dir, file } = await recoveryPaths()
  if (!(await exists(dir))) await mkdir(dir, { recursive: true })
  await writeTextFile(file, serializeRecoveryCopy(copy))
}

export async function readRecoveryCopy(): Promise<RecoveryCopy | null> {
  const { file } = await recoveryPaths()
  if (!(await exists(file))) return null
  return parseRecoveryCopy(await readTextFile(file))
}

export async function clearRecoveryCopy(): Promise<void> {
  const { file } = await recoveryPaths()
  if (await exists(file)) await remove(file)
}

/**
 * Põe de lado a cópia que uma abertura ANTERIOR deixou, antes de esta abertura
 * gravar a dela por cima: sem isto, clicar "Carregar Mapa" em vez de
 * "Recuperar" e editar 10 s apagava o trabalho da queda sem pergunta. Só a
 * cópia legível vale o lugar (a cortada por uma queda não troca uma guardada
 * inteira). Um lugar só: guardar outra troca a guardada de antes.
 */
export async function setAsideRecoveryCopy(): Promise<void> {
  const { file, setAside } = await recoveryPaths()
  if (!(await exists(file))) return
  const text = await readTextFile(file)
  if (parseRecoveryCopy(text) === null) return
  await writeTextFile(setAside, text)
}

export async function clearSetAsideRecoveryCopy(): Promise<void> {
  const { setAside } = await recoveryPaths()
  if (await exists(setAside)) await remove(setAside)
}

/** A cópia que espera o mestre no menu, e de qual arquivo ela veio (`setAside` = a guardada). */
export interface PendingRecoveryCopy {
  copy: RecoveryCopy
  setAside: boolean
}

/**
 * O que o menu inicial oferece em "Recuperar": a cópia da última abertura que
 * fechou sem salvar; sem ela, a guardada de uma abertura mais antiga. `null` =
 * nada a oferecer.
 */
export async function readPendingRecoveryCopy(): Promise<PendingRecoveryCopy | null> {
  const copy = await readRecoveryCopy()
  if (copy !== null) return { copy, setAside: false }
  const { setAside } = await recoveryPaths()
  if (!(await exists(setAside))) return null
  const guardada = parseRecoveryCopy(await readTextFile(setAside))
  return guardada === null ? null : { copy: guardada, setAside: true }
}

/**
 * Hora da cópia para o mestre: "hoje às 14:05" ou "em 21/09 às 14:05".
 * `timeZone` ausente = fuso da máquina (o do app); o parâmetro existe para o
 * teste fixar o fuso.
 */
export function formatRecoveryTime(savedAtMs: number, nowMs: number, timeZone?: string): string {
  const hora = new Intl.DateTimeFormat('pt-BR', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(savedAtMs)
  // O ano entra na comparação (mesmo dia e mês de outro ano não é "hoje"),
  // mas não no texto mostrado.
  const diaComAno = new Intl.DateTimeFormat('pt-BR', { timeZone, day: '2-digit', month: '2-digit', year: 'numeric' })
  if (diaComAno.format(savedAtMs) === diaComAno.format(nowMs)) return `hoje às ${hora}`
  const dia = new Intl.DateTimeFormat('pt-BR', { timeZone, day: '2-digit', month: '2-digit' }).format(savedAtMs)
  return `em ${dia} às ${hora}`
}
