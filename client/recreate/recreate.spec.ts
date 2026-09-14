import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { enterEditor } from '../e2e/helpers/enterEditor'
import { SILHOUETTE_MIN_IOU, TARGETS } from './targets'
import type { RecreateVariant } from './renderFloorPng'

const ROOT = resolve(process.cwd(), '..')
const ENV = process.env
const MEASURE = ENV.RECREATE_MEASURE === '1'
const ONLY = ENV.RECREATE_ONLY
/** Com tag, a rodada é uma variante de experimento: saída em Tentativa/variantes/<tag>, sem sobrescrever a tentativa principal. */
const TAG = ENV.RECREATE_TAG
const OUT = TAG ? resolve(ROOT, 'Tentativa', 'variantes', TAG) : resolve(ROOT, 'Tentativa')

function numberEnv(name: string, fallback: number): number {
  const raw = ENV[name]
  const value = raw === undefined ? NaN : Number(raw)
  return Number.isFinite(value) ? value : fallback
}

// Padrão = melhor variante medida até agora ("semborda", 13/09/2026): sem antialias, sem
// contorno no chão, traço da borda vetorizado como linha. Ver Tentativa/variantes/.
const VARIANT: RecreateVariant = {
  antialias: ENV.RECREATE_AA === '1',
  inset: numberEnv('RECREATE_INSET', 0),
  strokeColor: ENV.RECREATE_STROKE && ENV.RECREATE_STROKE !== 'none' ? ENV.RECREATE_STROKE : null,
  strokeWidth: numberEnv('RECREATE_STROKE_WIDTH', 1),
  details: ENV.RECREATE_DETAILS !== '0',
  borderRadius: numberEnv('RECREATE_BORDER_RADIUS', 0),
  coverage: ENV.RECREATE_COVERAGE === '1',
  raster: ENV.RECREATE_RASTER === '1',
  strokeAlpha: numberEnv('RECREATE_STROKE_ALPHA', 0.955),
  lineAlpha: numberEnv('RECREATE_LINE_ALPHA', 0.955),
  subpixelLines: ENV.RECREATE_SUBPIXEL === '1',
  lineWidth: numberEnv('RECREATE_LINE_WIDTH', 1),
  lineDetection: ENV.RECREATE_LINE_DETECT === 'weight' || ENV.RECREATE_LINE_DETECT === 'auto' ? ENV.RECREATE_LINE_DETECT : 'gray',
  autoWidth: ENV.RECREATE_AUTO_WIDTH === '1',
  calibrate: ENV.RECREATE_CALIBRATE === '1',
  dark: ENV.RECREATE_DARK === '1',
  dotted: ENV.RECREATE_DOTTED === '1',
  pattern: ENV.RECREATE_PATTERN === 'rooks' || ENV.RECREATE_PATTERN === 'analytic' ? ENV.RECREATE_PATTERN : 'grid',
  refineFloor: ENV.RECREATE_REFINE_FLOOR === '1',
  thinLines: ENV.RECREATE_THIN === '1',
  calibMetric: ENV.RECREATE_CALIB_METRIC === 'error' ? 'error' : 'match',
  calibAlpha: ENV.RECREATE_CALIB_ALPHA === '1',
  topologyGuard: ENV.RECREATE_TOPOLOGY === '1',
  analyticShapes: ENV.RECREATE_ANALYTIC_SHAPES === '1',
  calibLines: ENV.RECREATE_CALIB_LINES === '1',
}

function dataUrl(path: string): string {
  return `data:image/png;base64,${readFileSync(path).toString('base64')}`
}

function writeDataUrl(path: string, url: string): void {
  writeFileSync(path, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'))
}

for (const target of TARGETS.filter((t) => !ONLY || t.name === ONLY)) {
  test(`recria ${target.name}`, async ({ page }) => {
    mkdirSync(OUT, { recursive: true })
    const targetUrl = dataUrl(resolve(ROOT, 'Objetivo', target.file))
    await enterEditor(page)

    if (MEASURE) {
      const rings = await page.evaluate(
        async ({ url, t }) => {
          const mod = await import('/recreate/measureTarget.ts')
          return mod.measureTarget(url, t.width, t.height, t.traceRect, 1.5)
        },
        { url: targetUrl, t: target },
      )
      mkdirSync(resolve(OUT, 'medidas'), { recursive: true })
      writeFileSync(resolve(OUT, 'medidas', `${target.name}.json`), JSON.stringify(rings))
    }

    const counts = await page.evaluate(
      async ({ url, t, variant }) => {
        const mod = await import('/recreate/renderFloorPng.ts')
        return mod.recreateIntoStore(t, url, variant)
      },
      { url: targetUrl, t: target, variant: VARIANT },
    )
    expect(counts.pieces).toBeGreaterThan(0)

    const attemptUrl = await page.evaluate(
      async ({ t, variant }) => {
        const mod = await import('/recreate/renderFloorPng.ts')
        return mod.renderStoreMapPng(t.width, t.height, variant, t.traceRect)
      },
      { t: target, variant: VARIANT },
    )
    writeDataUrl(resolve(OUT, `${target.name}.png`), attemptUrl)

    const report = await page.evaluate(
      async ({ url, attempt, t }) => {
        const mod = await import('/recreate/compareMasks.ts')
        return mod.compareFloorMasks(url, attempt, t.width, t.height, t.crop)
      },
      { url: targetUrl, attempt: attemptUrl, t: target },
    )
    writeDataUrl(resolve(OUT, `${target.name}-diff.png`), report.diffUrl)
    writeDataUrl(resolve(OUT, `${target.name}-cor.png`), report.colorDiffUrl)
    const { diffUrl: _diff, colorDiffUrl: _colorDiff, targetHoleBoxes, attemptHoleBoxes, ...summary } = report
    const header = { variant: VARIANT, ...counts }
    writeFileSync(resolve(OUT, `${target.name}.json`), JSON.stringify({ ...header, ...summary, targetHoleBoxes, attemptHoleBoxes }, null, 2))
    console.log(`[recreate] ${TAG ?? 'principal'} ${target.name} ${JSON.stringify({ ...counts, iou: summary.iou, holes: `${summary.attemptHoles}/${summary.targetHoles}`, islands: `${summary.attemptIslands}/${summary.targetIslands}`, cor: summary.inkColorMatch })}`)

    expect.soft(summary.iou, 'IoU da silhueta').toBeGreaterThanOrEqual(SILHOUETTE_MIN_IOU)
    expect.soft(summary.attemptIslands, 'quantidade de ilhas').toBe(summary.targetIslands)
    expect.soft(summary.attemptHoles, 'quantidade de buracos').toBe(summary.targetHoles)
  })
}
