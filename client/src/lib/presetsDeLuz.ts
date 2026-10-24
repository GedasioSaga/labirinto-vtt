import type { Light, Periodo } from '../types/map'
import type { Point } from '../pixi/world'
import { buildLightAt } from './drawingFactory'

/**
 * PRESETS DE LUZ (Luz L3, decisão D4): a ferramenta Luz cria uma `Light`
 * normal (sem vínculo com o móvel: o lampião de mobília continua só desenho)
 * que já nasce acesa à tarde e à noite. O mestre muda depois no painel da luz
 * ("Acesa em"), e o raio pela alça do círculo.
 *
 * Os números vêm do protótipo aprovado em 24/10/2026
 * (`docs/design/luz/prototipo-dia-tarde-noite.html`): luz quente com calor de
 * 55% (`#ffba7b`, a mistura de `#ffe2b4` e `#ff9a4c`), lampião de 3,5 casas a
 * 85% e fogueira de 5 casas a 95%. A tocha não está no protótipo: 2,5 casas
 * (ordem do plano da L3), com a força da Luz de sempre. A Luz de sempre
 * (`buildLightAt`: 4 casas, `#ffaa33`, 80%) não muda de cara.
 */
export type PresetDeLuz = 'luz' | 'tocha' | 'lampiao' | 'fogueira'

export interface PresetDeLuzInfo {
  id: PresetDeLuz
  rotulo: string
}

/** Os presets na ordem do painel da ferramenta. */
export const PRESETS_DE_LUZ: readonly PresetDeLuzInfo[] = [
  { id: 'luz', rotulo: 'Luz' },
  { id: 'tocha', rotulo: 'Tocha' },
  { id: 'lampiao', rotulo: 'Lampião' },
  { id: 'fogueira', rotulo: 'Fogueira' },
]

/** O preset da ferramenta antes de o mestre escolher: a Luz de sempre. */
export const PRESET_DE_LUZ_PADRAO: PresetDeLuz = 'luz'

/** Toda luz nova acende sozinha à tarde e à noite. */
const ACESA_EM_DA_LUZ_NOVA: readonly Periodo[] = ['tarde', 'noite']

/** Luz quente do protótipo com calor de 55%. */
const COR_DA_LUZ_QUENTE = '#ffba7b'

const CHAMAS: Readonly<Record<Exclude<PresetDeLuz, 'luz'>, { casas: number; intensidade: number }>> = {
  tocha: { casas: 2.5, intensidade: 0.8 },
  lampiao: { casas: 3.5, intensidade: 0.85 },
  fogueira: { casas: 5, intensidade: 0.95 },
}

/** A luz nova do preset no ponto; `raioArrastado` (arrasto da ferramenta) troca o alcance do preset. */
export function luzDoPreset(id: string, ponto: Point, grid: number, preset: PresetDeLuz, raioArrastado?: number): Light {
  const acesaEm = [...ACESA_EM_DA_LUZ_NOVA]
  if (preset === 'luz') return { ...buildLightAt(id, ponto, grid, raioArrastado), acesaEm }
  const { casas, intensidade } = CHAMAS[preset]
  return { id, x: ponto.x, y: ponto.y, radius: raioArrastado ?? casas * grid, color: COR_DA_LUZ_QUENTE, intensity: intensidade, acesaEm }
}
