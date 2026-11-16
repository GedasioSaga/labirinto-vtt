import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'
import { enterEditor } from '../e2e/helpers/enterEditor'
import { createEmptyMap } from '../src/lib/mapFactory'
import { criarMovel } from '../src/lib/mobilia'
import type { Carimbo, MapData } from '../src/types/map'

/**
 * CARIMBO EDITÁVEL (Fase 2, 15/11/2026), critério (d): com 5.000 carimbos,
 * selecionar no laço, arrastar a seleção e desfazer sem tarefa longa de
 * 200 ms ou mais. Gesto de verdade no canvas (mouse), mapa sintético.
 *
 * Rodar (modo dev, a página importa a store pelo vite):
 *   LAB_DES_MODO=dev LAB_NAVEGADOR=msedge npx playwright test -c playwright.desempenho.config.ts carimbo-editavel
 * `LAB_CARIMBO_SAIDA`: pasta dos números e das fotos (padrão: tmp/fase-2-carimbo da árvore).
 */

const QUANTOS = 5000
const GRADE = 40
const CELULAS = 100
const ESCALA = 0.18
const TAREFA_LONGA_MAXIMA_MS = 200
const SAIDA = process.env.LAB_CARIMBO_SAIDA ?? join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', 'tmp', 'fase-2-carimbo')

interface JanelaDaMedida {
  __longas?: number[][]
  __quadros?: number[]
}

function mapaDeCarimbos(): MapData {
  const lado = CELULAS * GRADE
  const porLinha = Math.ceil(Math.sqrt(QUANTOS))
  const passo = lado / (porLinha + 1)
  const carimbos: Carimbo[] = []
  for (let i = 0; i < QUANTOS; i++) {
    const col = i % porLinha
    const lin = Math.floor(i / porLinha)
    carimbos.push({ id: `c${i}`, tipo: i % 3 === 0 ? 'arvore' : 'pinheiro', x: Math.round(passo * (col + 1)), y: Math.round(passo * (lin + 1)), tamanho: 36, giro: (i * 45) % 360 })
  }
  const base = createEmptyMap('m-carimbos-5000', 'Mata de 5.000', CELULAS, CELULAS, GRADE)
  return { ...base, carimbos, props: [criarMovel('barril', { x: lado / 2 + 20, y: lado / 2 + 20 }, GRADE, 'barril')] }
}

async function instalarColetor(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const alvo = window as unknown as JanelaDaMedida // as: os campos da medida pendurados no window da página (sem tipo no DOM)
    const longas: number[][] = []
    const quadros: number[] = []
    alvo.__longas = longas
    alvo.__quadros = quadros
    try {
      new PerformanceObserver((lista) => {
        for (const e of lista.getEntries()) longas.push([e.startTime, e.duration])
      }).observe({ entryTypes: ['longtask'] })
    } catch {
      // Sem a API, a lista fica vazia; o tempo de quadro continua medido.
    }
    const quadro = (t: number) => {
      quadros.push(t)
      requestAnimationFrame(quadro)
    }
    requestAnimationFrame(quadro)
  })
}

interface Medida {
  longtask_max_ms: number
  frame_p95_ms: number
  frame_max_ms: number
  duracao_ms: number
}

interface NoDoPerfil {
  id: number
  callFrame: { functionName: string; url: string; lineNumber: number }
}

/** `LAB_CARIMBO_PERFIL=1`: o perfil de CPU do gesto, as 12 funções que mais gastaram sozinhas (para achar onde otimizar). */
async function comPerfil(page: Page, nome: string, gesto: () => Promise<void>): Promise<void> {
  if (process.env.LAB_CARIMBO_PERFIL !== '1') return gesto()
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Profiler.enable')
  await cdp.send('Profiler.start')
  await gesto()
  const { profile } = await cdp.send('Profiler.stop')
  const nos = new Map<number, NoDoPerfil>(profile.nodes.map((n) => [n.id, n]))
  const porFuncao = new Map<string, number>()
  const amostras = profile.samples ?? []
  const deltas = profile.timeDeltas ?? []
  amostras.forEach((id, i) => {
    const no = nos.get(id)
    if (no === undefined) return
    const chave = `${no.callFrame.functionName || '(anon)'} ${no.callFrame.url.split('/').pop() ?? ''}:${no.callFrame.lineNumber + 1}`
    porFuncao.set(chave, (porFuncao.get(chave) ?? 0) + (deltas[i] ?? 0) / 1000)
  })
  const top = [...porFuncao.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
  writeFileSync(join(SAIDA, `perfil-${nome}.json`), JSON.stringify(top.map(([f, ms]) => ({ f, ms: Math.round(ms) })), null, 2))
}

async function medir(page: Page, gesto: () => Promise<void>, nome = 'gesto'): Promise<Medida> {
  const inicio = await page.evaluate(() => performance.now())
  await comPerfil(page, nome, gesto)
  await page.waitForTimeout(400)
  const fim = await page.evaluate(() => performance.now())
  return page.evaluate(
    ([de, ate]) => {
      const janela = window as unknown as JanelaDaMedida // as: os campos que `instalarColetor` pendurou
      const longas = (janela.__longas ?? []).filter(([t]) => t >= de && t <= ate).map(([, d]) => d)
      const tempos = (janela.__quadros ?? []).filter((t) => t >= de && t <= ate)
      const deltas = tempos.slice(1).map((t, i) => t - tempos[i]).sort((a, b) => a - b)
      const p95 = deltas.length === 0 ? 0 : deltas[Math.min(deltas.length - 1, Math.floor(deltas.length * 0.95))]
      const r1 = (n: number) => Math.round(n * 10) / 10
      return { longtask_max_ms: r1(Math.max(0, ...longas)), frame_p95_ms: r1(p95), frame_max_ms: r1(Math.max(0, ...deltas)), duracao_ms: r1(ate - de) }
    },
    [inicio, fim],
  )
}

test('5.000 carimbos: laço, arrasto e Ctrl+Z sem tarefa longa de 200 ms', async ({ page }) => {
  test.setTimeout(300_000)
  mkdirSync(SAIDA, { recursive: true })
  await page.setViewportSize({ width: 1440, height: 900 })
  await instalarColetor(page)
  await enterEditor(page)
  const mapa = mapaDeCarimbos()
  await page.evaluate(async (m) => {
    const loja = await import('/src/stores/mapStore.ts')
    loja.useMapStore.getState().loadMap(m)
    loja.useMapStore.getState().setActiveTool('select')
    const aventura = await import('/src/stores/adventureStore.ts')
    aventura.useAdventureStore.setState({ cameraRequest: { camera: { x: 360, y: 40, scale: 0.18 } } })
  }, mapa)
  await page.waitForTimeout(4000)
  const canvas = page.locator('canvas').first()
  const caixa = await canvas.boundingBox()
  if (caixa === null) throw new Error('canvas sem caixa')
  const camera = await page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().camera)
  const naTela = (x: number, y: number) => ({ x: caixa.x + camera.x + x * camera.scale, y: caixa.y + camera.y + y * camera.scale })
  const lado = CELULAS * GRADE

  // 1. LAÇO: arrasto no vazio de fora a fora do mapa (da direita para a esquerda: pega o que toca).
  const de = naTela(lado + 10, lado + 10)
  const ate = naTela(-10, -10)
  const laco = await medir(page, async () => {
    await page.mouse.move(de.x, de.y)
    await page.mouse.down()
    for (let i = 1; i <= 20; i++) await page.mouse.move(de.x + ((ate.x - de.x) * i) / 20, de.y + ((ate.y - de.y) * i) / 20)
    await page.mouse.up()
  }, 'laco')
  const selecionados = await page.evaluate(async () => (await import('/src/stores/mapStore.ts')).useMapStore.getState().selection.length)
  await page.screenshot({ path: join(SAIDA, '1-laco-5000.png') })

  // 2. ARRASTO: pega a seleção pelo barril e anda 30 passos.
  const antes = await page.evaluate(async () => {
    const m = (await import('/src/stores/mapStore.ts')).useMapStore.getState().map
    return { c0: m.carimbos?.[0], barril: m.props[0], passado: (await import('/src/stores/mapStore.ts')).useMapStore.getState().past.length }
  })
  const pega = naTela(lado / 2 + 20, lado / 2 + 20)
  const arrasto = await medir(page, async () => {
    await page.mouse.move(pega.x, pega.y)
    await page.mouse.down()
    for (let i = 1; i <= 30; i++) await page.mouse.move(pega.x + i * 5, pega.y + i * 3)
    await page.mouse.up()
  }, 'arrasto')
  const depois = await page.evaluate(async () => {
    const loja = (await import('/src/stores/mapStore.ts')).useMapStore.getState()
    return { c0: loja.map.carimbos?.[0], barril: loja.map.props[0], passado: loja.past.length }
  })
  await page.screenshot({ path: join(SAIDA, '2-arrasto-5000.png') })

  // 3. CTRL+Z: um passo devolve tudo.
  const desfazer = await medir(page, async () => {
    await page.keyboard.press('Control+z')
    await page.waitForTimeout(300)
  }, 'desfazer')
  const desfeito = await page.evaluate(async () => {
    const m = (await import('/src/stores/mapStore.ts')).useMapStore.getState().map
    return { c0: m.carimbos?.[0], barril: m.props[0] }
  })

  // 4. A FICHA: um carimbo sozinho na seleção abre a ficha no livro, com as duas chaves.
  await page.evaluate(async () => {
    ;(await import('/src/stores/mapStore.ts')).useMapStore.getState().setSelection([{ kind: 'carimbo', id: 'c0' }])
  })
  const chaveDaPassagem = page.getByRole('checkbox', { name: 'Barra a passagem' })
  await expect(chaveDaPassagem).toBeVisible()
  await chaveDaPassagem.check({ force: true })
  await page.getByRole('button', { name: 'Girar 45° para a direita' }).click()
  const ligou = await page.evaluate(async () => {
    const c0 = (await import('/src/stores/mapStore.ts')).useMapStore.getState().map.carimbos?.[0]
    return c0?.barra === true && c0.giro === 45
  })
  await expect(page.getByText('O carimbo fica sempre na camada Terreno.')).toBeVisible()
  await page.screenshot({ path: join(SAIDA, '3-ficha-do-carimbo.png') })

  const numeros = {
    quando: new Date().toISOString(),
    carimbos: QUANTOS,
    escala: ESCALA,
    selecionados,
    passos_no_desfazer_do_arrasto: depois.passado - antes.passado,
    carimbo_andou: { de: antes.c0, para: depois.c0 },
    barril_andou: { de: { x: antes.barril?.x, y: antes.barril?.y }, para: { x: depois.barril?.x, y: depois.barril?.y } },
    desfeito_igual_ao_antes: JSON.stringify(desfeito.c0) === JSON.stringify(antes.c0) && desfeito.barril?.x === antes.barril?.x,
    ficha_ligou_barra_a_passagem: ligou,
    laco,
    arrasto,
    desfazer,
  }
  writeFileSync(join(SAIDA, 'numeros-5000.json'), JSON.stringify(numeros, null, 2))
  console.log(JSON.stringify(numeros))

  expect(selecionados).toBeGreaterThanOrEqual(QUANTOS)
  expect(depois.passado - antes.passado).toBe(1)
  expect(depois.c0?.x).not.toBe(antes.c0?.x)
  expect(depois.barril?.x).not.toBe(antes.barril?.x)
  expect(numeros.desfeito_igual_ao_antes).toBe(true)
  expect(ligou).toBe(true)
  for (const [nome, m] of Object.entries({ laco, arrasto, desfazer })) {
    expect.soft(m.longtask_max_ms, `${nome}: nenhuma tarefa longa >= ${TAREFA_LONGA_MAXIMA_MS} ms`).toBeLessThan(TAREFA_LONGA_MAXIMA_MS)
  }
})
