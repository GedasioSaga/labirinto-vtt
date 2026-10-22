// A PORTA NOVA NO APP (faixa A3, 22/10/2026), não no laboratório:
//  1. o editor a 1440x900 com portas fechada, aberta, trancada e com cor
//     própria (com e sem cadeado), e a foto lado a lado com a do protótipo
//     aprovado (docs/design/porta-animacoes/app/provas/prototipo-1440x900.png);
//  2. 50 portas com as 7 animações abrindo e fechando por 4 s, medidas no app,
//     com o WebGL que o navegador do teste tiver (playwright.config.ts já pede
//     ANGLE em D3D11 e ignora a lista negra de GPU); a placa usada sai no relato.
//
// Com PROVA_PORTA_APP=1 as duas fotos vão para docs/design/porta-animacoes/app/provas/;
// sem, ficam na pasta de saída do teste (nada do repositório é tocado).
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'
import type { DoorState, Wall } from '../src/types/map'

test.use({ viewport: { width: 1440, height: 900 } })

const PROVAS = `${process.cwd().replace(/\\/g, '/')}/../docs/design/porta-animacoes/app/provas`
const GRAVAR_NO_REPOSITORIO = process.env.PROVA_PORTA_APP === '1'
/** A meta M9 de metas.json: quadro p95 até 20 ms e nenhuma tarefa longa de 200 ms ou mais. */
const QUADRO_P95_MAX_MS = 20
const TAREFA_LONGA_MAX_MS = 200
const MEDIDA_MS = 4000
/** Mais que a animação mais longa (Grade, 600 ms): cada troca anda o caminho inteiro. */
const TROCA_A_CADA_MS = 650
const MUSGO = '#5e8c4a'
const ARDOSIA = '#5b6b7a'

type Porta = Partial<DoorState>

declare global {
  interface Window {
    /** Quadros que as portas do pacote desenharam no meio do caminho: a medida só vale com porta andando. */
    __quadrosDePortaNoMeio?: number
  }
}

/** As cinco portas do pacote (Girar e Deslizar são embutidas). */
const DO_PACOTE = ['dupla', 'grade', 'arrombada', 'sanfona', 'cortina']

/** Um lado de sala; com porta, o lado vira parede, porta (no meio, de `vao`) e parede. */
function lado(id: string, x1: number, y1: number, x2: number, y2: number, porta?: Porta, vao = 40): Wall[] {
  const parede = (sufixo: string, a: number, b: number, c: number, d: number): Wall => ({ id: `${id}-${sufixo}`, x1: a, y1: b, x2: c, y2: d, blocksLight: true, blocksMove: true, door: null })
  if (porta === undefined) return [parede('p', x1, y1, x2, y2)]
  const comprimento = Math.hypot(x2 - x1, y2 - y1)
  const ux = (x2 - x1) / comprimento
  const uy = (y2 - y1) / comprimento
  const ini = (comprimento - vao) / 2
  const fim = ini + vao
  return [
    parede('a', x1, y1, x1 + ux * ini, y1 + uy * ini),
    { id, x1: x1 + ux * ini, y1: y1 + uy * ini, x2: x1 + ux * fim, y2: y1 + uy * fim, blocksLight: true, blocksMove: true, door: { open: false, locked: false, kind: 'normal', ...porta } },
    parede('b', x1 + ux * fim, y1 + uy * fim, x2, y2),
  ]
}

/** Sala retangular de paredes, com a porta de cada lado (topo, direita, baixo, esquerda). */
function sala(id: string, x0: number, y0: number, x1: number, y1: number, portas: { topo?: Porta; direita?: Porta; baixo?: Porta; esquerda?: Porta } = {}): Wall[] {
  return [
    ...lado(`${id}-topo`, x0, y0, x1, y0, portas.topo),
    ...lado(`${id}-direita`, x1, y0, x1, y1, portas.direita),
    ...lado(`${id}-baixo`, x0, y1, x1, y1, portas.baixo),
    ...lado(`${id}-esquerda`, x0, y0, x0, y1, portas.esquerda),
  ]
}

async function carregarMapa(page: Page, nome: string, walls: Wall[], salas: { x0: number; y0: number; x1: number; y1: number }[]): Promise<void> {
  await page.evaluate(
    async ({ nome, walls, salas }) => {
      const mapFactory = await import('/src/lib/mapFactory.ts')
      const store = (await import('/src/stores/mapStore.ts')).useMapStore.getState()
      const vazio = mapFactory.createEmptyMap(`map_${nome}`, nome, 30, 20, 64)
      const floor = salas.map((s, i) => ({ id: `chao-${i}`, shape: { kind: 'rect' as const, cx: (s.x0 + s.x1) / 2, cy: (s.y0 + s.y1) / 2, w: s.x1 - s.x0, h: s.y1 - s.y0 }, op: 'add' as const, modifiers: {} }))
      store.loadMap({ ...vazio, floor, walls })
      store.setActiveTool('select')
    },
    { nome, walls, salas },
  )
}

test('portas no app a 1440x900: fechada, aberta, trancada e com cor própria, lado a lado com o protótipo', async ({ page, context }) => {
  test.setTimeout(120_000)
  const erros: string[] = []
  page.on('pageerror', (e) => erros.push(e.message))
  await enterEditor(page)
  const salas = [
    { x0: 420, y0: 240, x1: 760, y1: 510 },
    { x0: 820, y0: 220, x1: 1060, y1: 450 },
    { x0: 520, y0: 580, x1: 760, y1: 750 },
  ]
  await carregarMapa(page, 'Portas A3 no app', [
    ...sala('a', salas[0].x0, salas[0].y0, salas[0].x1, salas[0].y1, { direita: {}, baixo: { open: true } }),
    ...sala('b', salas[1].x0, salas[1].y0, salas[1].x1, salas[1].y1, { esquerda: { locked: true }, baixo: { open: true, cor: ARDOSIA } }),
    ...sala('c', salas[2].x0, salas[2].y0, salas[2].x1, salas[2].y1, { topo: { cor: MUSGO }, direita: { cor: MUSGO, locked: true } }),
  ], salas)
  // Tira o foco de qualquer campo e deixa o Pixi pintar.
  await page.mouse.click(1080, 800)
  await page.waitForTimeout(600)
  await expect(page.locator('canvas')).toBeVisible()

  const app = GRAVAR_NO_REPOSITORIO ? `${PROVAS}/app-1440x900.png` : test.info().outputPath('app-1440x900.png')
  await page.screenshot({ path: app })

  // Lado a lado: as duas fotos servidas do disco para uma página só, e a foto dela.
  const lado = await context.newPage()
  await lado.setViewportSize({ width: 2880, height: 940 })
  await lado.route('http://prova.local/prototipo.png', (r) => r.fulfill({ path: `${PROVAS}/prototipo-1440x900.png` }))
  await lado.route('http://prova.local/app.png', (r) => r.fulfill({ path: app }))
  await lado.setContent(
    `<body style="margin:0;background:#111;color:#ddd;font:16px system-ui">` +
      `<div style="display:flex"><figure style="margin:0"><figcaption style="height:40px;line-height:40px;padding-left:12px">Protótipo aprovado (porta-animacoes)</figcaption><img src="http://prova.local/prototipo.png" width="1440" height="900"></figure>` +
      `<figure style="margin:0"><figcaption style="height:40px;line-height:40px;padding-left:12px">App, 22/10/2026: fechada, aberta, trancada, cor própria e cor própria trancada (cadeado)</figcaption><img src="http://prova.local/app.png" width="1440" height="900"></figure></div></body>`,
  )
  await lado.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0))
  await lado.screenshot({ path: GRAVAR_NO_REPOSITORIO ? `${PROVAS}/app-e-prototipo-1440x900.png` : test.info().outputPath('app-e-prototipo-1440x900.png') })
  await lado.close()
  expect(erros).toEqual([])
})

test('50 portas com as 7 animações abrindo e fechando por 4 s: quadro p95 e tarefas longas', async ({ page }) => {
  test.setTimeout(120_000)
  await enterEditor(page)
  // As cinco do pacote pelo carregador de verdade, com os módulos fonte (o pacote compilado é provado em pacoteCompilado.test.ts).
  // A meta declarada de cada uma (`src/animacoes/porta/<id>.json`) vem do vite, como o script de pacote a lê do disco.
  const registradas = await page.evaluate(async (ids) => {
    const pacote = await import('/src/lib/pacoteDeAnimacoes.ts')
    const portas = await import('/src/portas/animacoesDePorta.ts')
    const animacoes = await Promise.all(
      ids.map(async (id) => {
        const resposta = await fetch(`/src/animacoes/porta/${id}.json`)
        const meta: unknown = await resposta.json()
        if (typeof meta !== 'object' || meta === null) throw new Error(`${id}.json não é um objeto`)
        return { id, tipo: 'porta', ...meta, arquivo: `porta-${id}.js` }
      }),
    )
    const indice = JSON.stringify({
      formato: 1,
      versao: 1,
      motorMinimo: '0.4.21',
      arquivos: ids.map((id) => ({ nome: `porta-${id}.js`, sha256: '0'.repeat(64), tamanho: 1 })),
      animacoes,
    })
    window.__quadrosDePortaNoMeio = 0
    const importar = async (arquivo: string): Promise<unknown> => {
      const modulo: { default: unknown } = await import(/* @vite-ignore */ `/src/animacoes/porta/${arquivo.replace(/^porta-|\.js$/g, '')}.ts`)
      const desenhar = modulo.default
      if (typeof desenhar !== 'function') return modulo
      return {
        default: (g: unknown, porta: unknown, progresso: number, abrindo: boolean): unknown => {
          if (progresso > 0 && progresso < 1) window.__quadrosDePortaNoMeio = (window.__quadrosDePortaNoMeio ?? 0) + 1
          return desenhar(g, porta, progresso, abrindo)
        },
      }
    }
    await pacote.carregarPacoteDeAnimacoes({ lerIndice: async () => indice, importar }, indice)
    return portas.listarAnimacoesDePorta().map((a) => a.id)
  }, DO_PACOTE)
  expect(registradas).toHaveLength(7)

  const walls: Wall[] = []
  for (let i = 0; i < 50; i += 1) {
    const x = 380 + (i % 10) * 72
    const y = 140 + Math.floor(i / 10) * 140
    walls.push({ id: `porta-${i}`, x1: x, y1: y, x2: x + 48, y2: y, blocksLight: true, blocksMove: true, door: { open: false, locked: false, kind: 'normal', animacao: registradas[i % 7] } })
  }
  await carregarMapa(page, '50 portas', walls, [{ x0: 340, y0: 100, x1: 1100, y1: 820 }])
  await page.mouse.click(1080, 860)
  await page.waitForTimeout(500)

  const medida = await page.evaluate(
    async ({ duracao, trocaACada }) => {
      const store = (await import('/src/stores/mapStore.ts')).useMapStore
      const gl = document.createElement('canvas').getContext('webgl')
      const info = gl?.getExtension('WEBGL_debug_renderer_info')
      const placa = gl && info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : 'sem WebGL'
      const longas: number[] = []
      const observador = new PerformanceObserver((lista) => {
        for (const e of lista.getEntries()) longas.push(e.duration)
      })
      let observando = true
      try {
        observador.observe({ type: 'longtask', buffered: false })
      } catch {
        observando = false
      }
      const trocar = () =>
        store.setState((s) => ({ map: { ...s.map, walls: s.map.walls.map((w) => (w.door === null ? w : { ...w, door: { ...w.door, open: !w.door.open } })) } }))
      const intervalos: number[] = []
      const noMeioAntes = window.__quadrosDePortaNoMeio ?? 0
      const inicio = performance.now()
      let ultimaTroca = inicio - trocaACada
      await new Promise<void>((pronto) => {
        let anterior = performance.now()
        const quadro = (agora: number) => {
          intervalos.push(agora - anterior)
          anterior = agora
          if (agora - ultimaTroca >= trocaACada) {
            ultimaTroca = agora
            trocar()
          }
          if (agora - inicio < duracao) requestAnimationFrame(quadro)
          else pronto()
        }
        requestAnimationFrame(quadro)
      })
      observador.disconnect()
      return { placa, intervalos: intervalos.slice(1), longas, observando, quadrosNoMeio: (window.__quadrosDePortaNoMeio ?? 0) - noMeioAntes }
    },
    { duracao: MEDIDA_MS, trocaACada: TROCA_A_CADA_MS },
  )
  const ordenados = [...medida.intervalos].sort((a, b) => a - b)
  const p95 = ordenados[Math.min(ordenados.length - 1, Math.floor(ordenados.length * 0.95))] ?? 0
  const longaMax = Math.max(0, ...medida.longas)
  const relato = `placa: ${medida.placa} | ${medida.intervalos.length} quadros, p95 ${p95.toFixed(1)} ms, máx ${Math.max(...medida.intervalos).toFixed(1)} ms | tarefas longas: ${medida.longas.length} (máx ${longaMax.toFixed(0)} ms, observador ${medida.observando ? 'ligado' : 'DESLIGADO'}) | desenhos das portas do pacote no meio do caminho: ${medida.quadrosNoMeio}`
  test.info().annotations.push({ type: '50 portas', description: relato })
  console.log(`[50 portas] ${relato}`)
  expect(medida.observando, relato).toBe(true)
  // Sem porta andando, o p95 seria o de um mapa parado.
  expect(medida.quadrosNoMeio, relato).toBeGreaterThan(0)
  expect(medida.intervalos.length, relato).toBeGreaterThan(100)
  expect(p95, relato).toBeLessThanOrEqual(QUADRO_P95_MAX_MS)
  expect(longaMax, relato).toBeLessThan(TAREFA_LONGA_MAX_MS)
})
