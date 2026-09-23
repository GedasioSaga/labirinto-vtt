import { exists, mkdir, readTextFile, remove, writeTextFile } from '@tauri-apps/plugin-fs'
import { appDataDir, join } from '@tauri-apps/api/path'
import type { MapData } from '../types/map'
import { deserializeMap } from './mapFile'

/**
 * CÓPIA DE RECUPERAÇÃO — o trabalho não salvo que o salvamento automático
 * guarda enquanto o mestre edita (ver `stores/recoveryAutosave.ts`).
 *
 * Mora numa pasta PRÓPRIA em `%APPDATA%`, fora de `%APPDATA%/maps`: assim
 * nunca grava por cima de um `map.json` salvo (o mapa salvo só muda quando o
 * mestre manda salvar) e nunca aparece como mapa na tela "Carregar Mapa"
 * (`listSavedMaps` só lê `maps/`). Uma cópia só, a da última sessão que
 * editou sem salvar.
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
}

const RECOVERY_FORMAT_VERSION = 1
const RECOVERY_DIR_NAME = 'recuperacao'
const RECOVERY_FILE_NAME = 'copia-de-recuperacao.json'

export function serializeRecoveryCopy(copy: RecoveryCopy): string {
  return JSON.stringify({ versao: RECOVERY_FORMAT_VERSION, savedAtMs: copy.savedAtMs, mapPath: copy.mapPath, map: copy.map, scenes: copy.scenes })
}

/** Mesma normalização de um map.json aberto do disco (campos novos com valor padrão, `id` obrigatório). */
function parseMap(raw: unknown): MapData | null {
  if (!isRecord(raw)) return null
  try {
    return deserializeMap(JSON.stringify(raw))
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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
  const map = parseMap(parsed.map)
  if (map === null) return null
  // Cena de fundo ilegível fica de fora; o mapa aberto, que é o principal, volta.
  const scenes: Record<string, MapData> = {}
  if (isRecord(parsed.scenes)) {
    for (const [sceneId, raw] of Object.entries(parsed.scenes)) {
      const scene = parseMap(raw)
      if (scene !== null) scenes[sceneId] = scene
    }
  }
  return { savedAtMs, mapPath, map, scenes }
}

async function recoveryPaths(): Promise<{ dir: string; file: string }> {
  const dir = await join(await appDataDir(), RECOVERY_DIR_NAME)
  return { dir, file: await join(dir, RECOVERY_FILE_NAME) }
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
