// JORNADA: O MESTRE PINTA A PORTA, TRANCA, DESFAZ O ARRASTO E O JOGADOR VÊ A MESMA COR.
//
// A FEATURE (fatia 22, pedido de 21/10/2026: "poder mudar a cor dela"): a ficha
// da porta ganha "Cor da porta" na Aparência — a paleta do protótipo, "Outra
// cor…" (o seletor nativo) e "Cor padrão". A cor vale aberta, fechada e
// trancada; a trancada com cor própria ganha cadeado pequeno e contorno
// vermelho, porque a cor já não diz "trancada". Cada arrasto do seletor nativo
// (uma abertura da caixa) é UM Ctrl+Z. O jogador recebe a cor (é aparência),
// mas nunca o cadeado.
//
// COMO ESTE ARQUIVO PROVA, EM PIXEL DA TELA:
//   O EDITOR é o app em modo Tauri com disco de mentira (o mesmo molde de
//   task-jornada-danca-visao-de-jogador.spec.ts): só nele a página Grupo tem a
//   "Visão de jogador", a janela de teste que mostra a cena pelos olhos de uma
//   ficha, com o recorte do jogador de verdade (`lib/fogFilter.ts`).
//   GESTO REAL: o clique na porta, na bolinha da paleta, no "Trancada" e a
//   tecla Ctrl+Z são do mouse e do teclado. O seletor nativo de cor não abre
//   num teste: o arrasto lá dentro é reproduzido pelo que ele faz com a página,
//   um `input` com a cor nova por quadro no mesmo campo (`arrastarNoSeletor`),
//   e um `change` quando a caixa fecha (`fecharOSeletor`).
//   A store do editor é LIDA só para a mensagem de falha dizer o que o mapa tem.
//   MEDIDA: durante o arrasto, tarefa longa (PerformanceObserver) e o intervalo
//   entre quadros (requestAnimationFrame) — o pedido é nenhuma tarefa >= 200 ms
//   e quadro p95 <= 20 ms com a máquina livre. Com a máquina dividida, o teto
//   cresce na proporção da lentidão medida na hora por uma obra de referência
//   que não usa o app, até 30 ms: nunca aprova o arrasto a 30 quadros por
//   segundo (`arrastoDeRegime`).
import { test, expect, type Page } from '@playwright/test'
import { lentidaoEntre } from '../src/lib/caminhamento/relogio.fixture'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import { contentBounds, fitCamera } from '../src/pixi/world'
import type { MapData, Token, Wall } from '../src/types/map'
import { mostrarColunaDireita } from './helpers/colunaDireita'
import { pickTool } from './helpers/tools'

test.use({ trace: 'off', video: 'off' })

const AVENTURA = 'Casa da Porta Azul'
const ID_CENA = 'scene_porta'
const PASTA = 'C:/appdata/maps/map_porta'
const TOKEN = 'Lanterna'
const ID_DA_PORTA = 'porta-azul'

const GRADE = 50
const COLUNAS = 24
const LINHAS = 12
const LARGURA = COLUNAS * GRADE
const ALTURA = LINHAS * GRADE
/** Igual a `FIT_MARGIN` de pixi/PixiCanvas.tsx (enquadramento de abertura do editor). */
const FIT_MARGIN_MESTRE = 40

type Ponto = { x: number; y: number }
type Rgb = [number, number, number]

/** A porta: parede vertical em x=600, vão de y=250 a 350; a folha enche o vão inteiro (desde 22/10/2026). */
const PORTA_X = 600
const PORTA_Y1 = 250
const PORTA_Y2 = 350
const CENTRO_DA_PORTA: Ponto = { x: PORTA_X, y: (PORTA_Y1 + PORTA_Y2) / 2 }
/** Ponto da folha longe do cadeado (que fica no meio): a cor da porta em si. */
const NA_FOLHA: Ponto = { x: PORTA_X, y: 280 }
/** A ficha do jogador de teste, a duas casas e meia da porta: vê a porta sem cobrir a folha. */
const POS_TOKEN: Ponto = { x: 725, y: 300 }

/** As cores da jornada, como o Pixi as pinta (o creme e o vermelho da porta são os de 22/10/2026). */
const CREME_DA_PORTA: Rgb = [0xd9, 0xd2, 0xc0]
const AZUL_DA_PALETA = '#79a9cc'
const AZUL: Rgb = [0x79, 0xa9, 0xcc]
const VERMELHO_TRANCADA: Rgb = [0xe2, 0x64, 0x5a]
/** O corpo do cadeado (`DOOR_PADLOCK_FILL`, `pixi/drawDoors.ts`): um creme mais claro que o da porta. */
const CLARO_DO_CADEADO: Rgb = [0xf4, 0xea, 0xd8]
/** O arrasto no seletor nativo: 20 quadros indo do escuro ao rosa. */
const ARRASTO = Array.from({ length: 20 }, (_, i) => {
  const t = (i + 1) / 20
  const canal = (de: number, ate: number) => Math.round(de + (ate - de) * t).toString(16).padStart(2, '0')
  return `#${canal(0x20, 0xe0)}${canal(0x30, 0x5a)}${canal(0x40, 0x9c)}`
})
const ROSA: Rgb = [0xe0, 0x5a, 0x9c]
/** A segunda abertura do seletor: do rosa ao verde, em 6 quadros. */
const ARRASTO_VERDE = ['#c3658a', '#a67078', '#8a7b66', '#6d8664', '#56905a', '#3f9a52']
const VERDE: Rgb = [0x3f, 0x9a, 0x52]

/** Distância de cor por canal: o antisserrilhado e o vídeo tremem poucos pontos. */
const PARECIDA = 30
const ESPERA = 10_000
const PINTURA_MS = 400
const TAREFA_LONGA_MS = 200
const QUADRO_P95_MS = 20
/** Arrastos de regime na mesma abertura antes de reprovar: a carga de outro teste só soma tempo, uma regressão reprova todos. */
const RODADAS_DE_REGIME = 3
/**
 * A obra de referência (`msDaReferencia`, lib/caminhamento/relogio.fixture.ts)
 * nesta página, com a máquina livre: 2,0 a 2,3 ms no Chromium 1243 em
 * 22/10/2026 (a mais rápida de antes e depois, 4 jornadas com a CPU a 5-23%).
 * Fica o lado alto: compensa menos, nunca mais do que a carga. Numa máquina
 * mais lenta, ou noutro Chromium, ela pode ler carga onde não há: o teto para
 * em `LENTIDAO_MAX_DA_MEDIDA` mesmo assim.
 */
const MS_DA_REFERENCIA_LIVRE_NO_NAVEGADOR = 2.3
/**
 * Até onde a lentidão alarga o teto do p95: 20 ms x 1,5 = 30 ms. O intervalo
 * entre quadros só vem em múltiplos do vsync (8,3 ms nesta máquina de 120 Hz,
 * 16,7 ms a 60 Hz) e o arrasto a 30 quadros por segundo dá 33,3 ms nos dois:
 * sem o limite, uma lentidão de 1,67 já o aprovava. Acima de 1,5 a medida não
 * compensa mais; se nenhum arrasto cumprir, a falha diz que a máquina estava
 * ocupada demais para medir.
 */
const LENTIDAO_MAX_DA_MEDIDA = 1.5

function parede(id: string, x1: number, y1: number, x2: number, y2: number, door: Wall['door'] = null): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door }
}

function mapaDaPorta(): MapData {
  const base = createEmptyMap('map_porta', AVENTURA, COLUNAS, LINHAS, GRADE)
  const ficha: Token = { id: 'tok-lanterna', characterId: null, name: TOKEN, x: POS_TOKEN.x, y: POS_TOKEN.y, size: 1, image: null, color: '#3cff00' }
  return {
    ...base,
    floor: [{ id: 'chao', shape: { kind: 'rect', cx: LARGURA / 2, cy: ALTURA / 2, w: LARGURA - 20, h: ALTURA - 20 }, op: 'add', modifiers: {} }],
    walls: [
      parede('w-n', 0, 0, LARGURA, 0),
      parede('w-l', LARGURA, 0, LARGURA, ALTURA),
      parede('w-s', LARGURA, ALTURA, 0, ALTURA),
      parede('w-o', 0, ALTURA, 0, 0),
      parede('w-cima', PORTA_X, 0, PORTA_X, PORTA_Y1),
      parede(ID_DA_PORTA, PORTA_X, PORTA_Y1, PORTA_X, PORTA_Y2, { open: false, locked: false, kind: 'normal' }),
      parede('w-baixo', PORTA_X, PORTA_Y2, PORTA_X, ALTURA),
    ],
    tokens: [ficha],
  }
}

function discoDaAventura(mapa: MapData): Record<string, string> {
  const aventura = { version: 1, id: 'adv_porta', name: AVENTURA, startSceneId: ID_CENA, scenes: [{ id: ID_CENA, name: AVENTURA, file: 'map.json' }] }
  return { [`${PASTA}/map.json`]: serializeMap(mapa), [`${PASTA}/adventure.json`]: JSON.stringify(aventura, null, 2) }
}

// ───────────────────────────────────────────────────────────────────────────
// O editor: app em modo Tauri com disco de mentira; a Visão de jogador vira popup
// ───────────────────────────────────────────────────────────────────────────

type HandlerTauri = (evento: { event: string; id: number; payload: unknown }) => void
type JanelaComDisco = {
  isTauri: boolean
  __TAURI_INTERNALS__: {
    metadata: { currentWindow: { label: string }; currentWebview: { windowLabel: string; label: string } }
    invoke: (cmd: string, args?: unknown) => Promise<unknown>
    transformCallback: (cb: HandlerTauri) => number
    convertFileSrc: (filePath: string) => string
  }
}

async function editorAbreAventura(mestre: Page, mapa: MapData): Promise<void> {
  await mestre.addInitScript((arquivos: Record<string, string>) => {
    // Só o editor: o popup da Visão de jogador é outra página e não leva o disco.
    if (location.pathname.indexOf('visao-jogador') !== -1) return
    performance.setResourceTimingBufferSize(10_000)
    const textos: Record<string, string> = { ...arquivos }
    const semBarraFinal = (p: string): string => p.replace(/[/]+$/, '')
    const existe = (caminho: string): boolean => {
      const c = semBarraFinal(caminho)
      return Object.keys(textos).some((p) => p === c || p.indexOf(`${c}/`) === 0)
    }
    const alvo = window as unknown as JanelaComDisco // cast: o teste INSTALA a ponte do Tauri na janela (o tipo Window não a declara); só escrita, nada lido dela
    const callbacks = new Map<number, HandlerTauri>()
    let proximoId = 1
    let janelaDeTeste: Window | null = null
    alvo.isTauri = true
    alvo.__TAURI_INTERNALS__ = {
      metadata: { currentWindow: { label: 'main' }, currentWebview: { windowLabel: 'main', label: 'main' } },
      convertFileSrc: (caminho: string) => String(caminho),
      transformCallback: (cb) => {
        const id = proximoId
        proximoId += 1
        callbacks.set(id, cb)
        return id
      },
      invoke: async (cmd, args) => {
        const campo = (nome: string): unknown => (typeof args === 'object' && args !== null ? Reflect.get(args, nome) : undefined)
        switch (cmd) {
          case 'abrir_visao_jogador':
            if (janelaDeTeste !== null) janelaDeTeste.close()
            janelaDeTeste = window.open(`/visao-jogador.html?sessao=${encodeURIComponent(String(campo('sessao')))}`, 'visao-jogador', 'popup,width=1280,height=800')
            return null
          case 'mostrar_visao_jogador':
            return janelaDeTeste !== null && !janelaDeTeste.closed
          case 'fechar_visao_jogador':
            if (janelaDeTeste !== null) janelaDeTeste.close()
            janelaDeTeste = null
            return null
          case 'plugin:event|listen':
            return Number(campo('handler'))
          case 'plugin:path|resolve_directory':
            return 'C:/appdata'
          case 'plugin:path|join': {
            const partes = campo('paths')
            return Array.isArray(partes) ? partes.map(String).join('/') : ''
          }
          case 'plugin:path|dirname': {
            const p = String(campo('path'))
            return p.slice(0, Math.max(0, p.lastIndexOf('/')))
          }
          case 'plugin:fs|exists':
            return existe(String(campo('path')))
          case 'plugin:fs|read_text_file': {
            const caminho = String(campo('path'))
            if (!(caminho in textos)) throw new Error(`arquivo não existe: ${caminho}`)
            return Array.from(new TextEncoder().encode(textos[caminho]))
          }
          case 'plugin:fs|read_dir': {
            const prefixo = `${semBarraFinal(String(campo('path')))}/`
            const filhos = new Map<string, boolean>()
            for (const p of Object.keys(textos)) {
              if (p.indexOf(prefixo) !== 0) continue
              const resto = p.slice(prefixo.length)
              const corte = resto.indexOf('/')
              const nome = corte === -1 ? resto : resto.slice(0, corte)
              filhos.set(nome, (filhos.get(nome) ?? false) || corte !== -1)
            }
            return Array.from(filhos.entries()).map(([name, isDirectory]) => ({ name, isDirectory, isFile: !isDirectory, isSymlink: false }))
          }
          default:
            return null
        }
      },
    }
  }, discoDaAventura(mapa))

  await mestre.goto('/')
  await mestre.getByRole('button', { name: /Carregar Mapa existente/ }).click()
  await mestre.getByRole('button', { name: new RegExp(AVENTURA) }).click()
  await mestre.waitForSelector('canvas')
}

async function naTelaDoMestre(mestre: Page, mapa: MapData, p: Ponto): Promise<Ponto> {
  const caixa = await mestre.locator('canvas').first().boundingBox()
  if (!caixa) throw new Error('régua: o canvas do mestre não tem caixa')
  const limites = contentBounds(mapa)
  if (!limites) throw new Error('régua: a cena não tem conteúdo para o editor enquadrar')
  const c = fitCamera(limites, { width: caixa.width, height: caixa.height }, FIT_MARGIN_MESTRE)
  return { x: caixa.x + p.x * c.scale + c.x, y: caixa.y + p.y * c.scale + c.y }
}

/** A porta como está no mapa do EDITOR: só para a mensagem de falha dizer o que o mapa tem. */
async function portaNoEditor(mestre: Page): Promise<string> {
  return mestre.evaluate(async (id) => {
    const carregada = performance
      .getEntriesByType('resource')
      .map((e) => e.name)
      .find((nome) => new URL(nome).pathname === '/src/stores/mapStore.ts')
    const modulo: typeof import('/src/stores/mapStore.ts') = await import(/* @vite-ignore */ carregada ?? '/src/stores/mapStore.ts')
    return JSON.stringify(modulo.useMapStore.getState().map.walls.find((w) => w.id === id)?.door ?? null)
  }, ID_DA_PORTA)
}

// ───────────────────────────────────────────────────────────────────────────
// Régua de pixel: só LÊ a foto da tela (o PNG decodificado num canvas 2D descartável)
// ───────────────────────────────────────────────────────────────────────────

type Foto = Awaited<ReturnType<Page['screenshot']>>
type Caixa = { x: number; y: number; w: number; h: number }

const distancia = (a: Rgb, b: Rgb): number => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]))
const emTexto = (c: Rgb): string => c.join(',')

/** As cores dos pontos e, por caixa, quantos pixels ficam perto de cada cor pedida. */
async function lerFoto(page: Page, foto: Foto, pontos: Ponto[], contagens: { caixa: Caixa | null; cor: Rgb; tolerancia: number }[]) {
  return page.evaluate(
    async ({ b64, pontos, contagens }) => {
      const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob()
      const bmp = await createImageBitmap(blob)
      const canvas = document.createElement('canvas')
      canvas.width = bmp.width
      canvas.height = bmp.height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('sem contexto 2d para ler a foto')
      ctx.drawImage(bmp, 0, 0)
      const { data, width, height } = ctx.getImageData(0, 0, bmp.width, bmp.height)
      const em = (x: number, y: number): [number, number, number] => {
        const i = (Math.min(height - 1, Math.max(0, Math.round(y))) * width + Math.min(width - 1, Math.max(0, Math.round(x)))) * 4
        return [data[i], data[i + 1], data[i + 2]]
      }
      const cores = pontos.map((p) => em(p.x, p.y))
      const quantos = contagens.map(({ caixa, cor, tolerancia }) => {
        const c = caixa ?? { x: 0, y: 0, w: width, h: height }
        let n = 0
        for (let y = Math.max(0, Math.floor(c.y)); y < Math.min(height, Math.ceil(c.y + c.h)); y += 1) {
          for (let x = Math.max(0, Math.floor(c.x)); x < Math.min(width, Math.ceil(c.x + c.w)); x += 1) {
            const [r, g, b] = em(x, y)
            if (Math.max(Math.abs(r - cor[0]), Math.abs(g - cor[1]), Math.abs(b - cor[2])) <= tolerancia) n += 1
          }
        }
        return n
      })
      return { cores, quantos }
    },
    { b64: foto.toString('base64'), pontos, contagens },
  )
}

const caixaEm = (p: Ponto, meia: number): Caixa => ({ x: p.x - meia, y: p.y - meia, w: meia * 2, h: meia * 2 })

/**
 * Na tela do jogador a câmera é a dele (segue a ficha): a porta é achada pela
 * cor. Devolve quantos pixels têm a cor dela, a caixa que eles ocupam e, nessa
 * caixa com folga, quantos têm o claro do cadeado e o creme de sempre.
 */
async function acharAPortaPelaCor(page: Page, foto: Foto, cor: Rgb, folga: number) {
  return page.evaluate(
    async ({ b64, cor, folga, parecida, cadeado, creme }) => {
      const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob()
      const bmp = await createImageBitmap(blob)
      const canvas = document.createElement('canvas')
      canvas.width = bmp.width
      canvas.height = bmp.height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('sem contexto 2d para ler a foto')
      ctx.drawImage(bmp, 0, 0)
      const { data, width, height } = ctx.getImageData(0, 0, bmp.width, bmp.height)
      const perto = (i: number, alvo: number[], tolerancia: number) => Math.max(Math.abs(data[i] - alvo[0]), Math.abs(data[i + 1] - alvo[1]), Math.abs(data[i + 2] - alvo[2])) <= tolerancia
      let n = 0
      let minX = width
      let minY = height
      let maxX = -1
      let maxY = -1
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          if (!perto((y * width + x) * 4, cor, parecida)) continue
          n += 1
          minX = Math.min(minX, x)
          minY = Math.min(minY, y)
          maxX = Math.max(maxX, x)
          maxY = Math.max(maxY, y)
        }
      }
      let claros = 0
      let cremes = 0
      // A folga só na ESPESSURA da porta: nas pontas do vão começa a parede, que na
      // tela do jogador é clara (perto do creme da porta) e não diz nada da cor dela.
      const deitada = maxX - minX > maxY - minY
      const folgaX = deitada ? 0 : folga
      const folgaY = deitada ? folga : 0
      for (let y = Math.max(0, minY - folgaY); y <= Math.min(height - 1, maxY + folgaY); y += 1) {
        for (let x = Math.max(0, minX - folgaX); x <= Math.min(width - 1, maxX + folgaX); x += 1) {
          const i = (y * width + x) * 4
          if (perto(i, cadeado, 12)) claros += 1
          if (perto(i, creme, 12)) cremes += 1
        }
      }
      return { pixels: n, caixa: n === 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }, claros, cremes }
    },
    { b64: foto.toString('base64'), cor, folga, parecida: PARECIDA, cadeado: CLARO_DO_CADEADO, creme: CREME_DA_PORTA },
  )
}

/** A folha (longe do cadeado), e os pixels do cadeado e do contorno vermelho em volta da porta. */
async function lerAPorta(mestre: Page, mapa: MapData) {
  await mestre.waitForTimeout(PINTURA_MS)
  const folha = await naTelaDoMestre(mestre, mapa, NA_FOLHA)
  const centro = await naTelaDoMestre(mestre, mapa, CENTRO_DA_PORTA)
  const { cores, quantos } = await lerFoto(mestre, await mestre.screenshot(), [folha], [
    { caixa: caixaEm(centro, 6), cor: CLARO_DO_CADEADO, tolerancia: 12 },
    // O contorno vermelho ao lado da folha, numa faixa curta longe do cadeado e da moldura de seleção.
    { caixa: { x: folha.x - 6, y: folha.y - 3, w: 12, h: 6 }, cor: VERMELHO_TRANCADA, tolerancia: PARECIDA },
  ])
  return { folha: cores[0], cadeado: quantos[0], aro: quantos[1] }
}

// ───────────────────────────────────────────────────────────────────────────
// Medida durante o arrasto: tarefa longa e intervalo entre quadros
// ───────────────────────────────────────────────────────────────────────────

interface MedidaDaPorta {
  tarefas: number[]
  quadros: number[]
  ativa: boolean
}

declare global {
  interface Window {
    __medidaDaPorta?: MedidaDaPorta
  }
}

/**
 * O ARRASTO NO SELETOR NATIVO, quadro a quadro: a caixa do Windows não abre
 * num teste, e o que ela faz com a página é isto — um `input` com a cor nova
 * a cada quadro, no mesmo `<input type="color">`. Cada cor sai num
 * `requestAnimationFrame` (o ritmo de um arrasto de verdade), e a medida
 * anota o intervalo entre quadros e toda tarefa longa no caminho. `cores`
 * vazio mede a tela parada, a régua do próprio navegador.
 */
async function arrastarNoSeletor(page: Page, rotulo: string, cores: readonly string[], quadrosParados: number) {
  return page.evaluate(
    async ({ rotulo, cores, quadrosParados }) => {
      const entrada = document.querySelector(`input[type="color"][aria-label="${rotulo}"]`)
      if (!(entrada instanceof HTMLInputElement)) throw new Error(`sem o seletor "${rotulo}"`)
      const definirValor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      if (definirValor === undefined) throw new Error('sem o setter de value')
      const medida: MedidaDaPorta = { tarefas: [], quadros: [], ativa: true }
      window.__medidaDaPorta = medida
      const observador = new PerformanceObserver((lista) => {
        for (const e of lista.getEntries()) medida.tarefas.push(e.duration)
      })
      observador.observe({ type: 'longtask' })
      const quadro = () => new Promise<number>((resolve) => requestAnimationFrame(resolve))
      let antes = await quadro()
      const passos = cores.length === 0 ? Array.from({ length: quadrosParados }, () => null) : cores
      const sincrono: number[] = []
      for (const cor of passos) {
        if (cor !== null) {
          const t0 = performance.now()
          definirValor.call(entrada, cor)
          entrada.dispatchEvent(new Event('input', { bubbles: true }))
          sincrono.push(performance.now() - t0)
        }
        const agora = await quadro()
        medida.quadros.push(agora - antes)
        antes = agora
      }
      // Dois quadros a mais: o último `input` também precisa ser pintado.
      for (let i = 0; i < 2; i += 1) {
        const agora = await quadro()
        medida.quadros.push(agora - antes)
        antes = agora
      }
      observador.disconnect()
      medida.ativa = false
      const ordenados = [...medida.quadros].sort((a, b) => a - b)
      const p95 = ordenados[Math.min(ordenados.length - 1, Math.floor(ordenados.length * 0.95))] ?? 0
      return { tarefaMaisLongaMs: Math.max(0, ...medida.tarefas), quadroP95Ms: p95, quadros: ordenados.length, sincrono: sincrono.map((v) => Math.round(v * 10) / 10), todos: medida.quadros.map((v) => Math.round(v)) }
    },
    { rotulo, cores, quadrosParados },
  )
}

/** Ms da obra de referência na página agora: a mesma conta, livre ou com a máquina dividida, sem tocar o app. */
async function msDaReferenciaNaPagina(page: Page): Promise<number> {
  return page.evaluate(async () => (await import('/src/lib/caminhamento/relogio.fixture.ts')).msDaReferencia())
}

type Arrasto = Awaited<ReturnType<typeof arrastarNoSeletor>>
interface RodadaDeRegime {
  medida: Arrasto
  /** Quanto a máquina está mais lenta que livre (nunca abaixo de 1): a referência antes e depois, a mais rápida. Sem o limite. */
  lentidao: number
  quadroP95MaxMs: number
  referenciaMs: [number, number]
}

/**
 * O ARRASTO DE REGIME, julgado contra a carga da máquina na hora (o molde de
 * lib/caminhamento/relogio.fixture.ts): a obra de referência é medida antes e
 * depois do arrasto, e o teto do quadro p95 cresce na mesma proporção da
 * lentidão medida (máquina livre = os 20 ms de sempre), até
 * `LENTIDAO_MAX_DA_MEDIDA`. Até `RODADAS_DE_REGIME` arrastos, na mesma
 * abertura da caixa; vale o primeiro que cumpre. Uma regressão de verdade pesa
 * no arrasto e não na referência, e reprova todos; aí o julgado é o da máquina
 * menos carregada, o que menos compensa.
 */
async function arrastoDeRegime(page: Page, rotulo: string): Promise<{ escolhida: RodadaDeRegime; todas: RodadaDeRegime[] }> {
  const cumpre = (r: RodadaDeRegime) => r.medida.quadroP95Ms <= r.quadroP95MaxMs && r.medida.tarefaMaisLongaMs < TAREFA_LONGA_MS
  const todas: RodadaDeRegime[] = []
  for (let i = 0; i < RODADAS_DE_REGIME; i += 1) {
    const antes = await msDaReferenciaNaPagina(page)
    const medida = await arrastarNoSeletor(page, rotulo, ARRASTO, 0)
    const depois = await msDaReferenciaNaPagina(page)
    const lentidao = lentidaoEntre(antes, depois, MS_DA_REFERENCIA_LIVRE_NO_NAVEGADOR)
    const rodada: RodadaDeRegime = { medida, lentidao, quadroP95MaxMs: QUADRO_P95_MS * Math.min(lentidao, LENTIDAO_MAX_DA_MEDIDA), referenciaMs: [antes, depois] }
    todas.push(rodada)
    if (cumpre(rodada)) return { escolhida: rodada, todas }
  }
  const [primeira, ...resto] = todas
  if (primeira === undefined) throw new Error('nenhum arrasto de regime rodou')
  return { escolhida: resto.reduce((menos, r) => (r.lentidao < menos.lentidao ? r : menos), primeira), todas }
}

/**
 * A CAIXA FECHA: o que ela faz com a página ao fechar é UM `change` no mesmo
 * `<input type="color">`, depois dos `input` do arrasto
 * (`ColorInputType::DidEndChooser`, no Chromium). É o fim de um arrasto.
 */
async function fecharOSeletor(page: Page, rotulo: string) {
  await page.evaluate((rotulo) => {
    const entrada = document.querySelector(`input[type="color"][aria-label="${rotulo}"]`)
    if (!(entrada instanceof HTMLInputElement)) throw new Error(`sem o seletor "${rotulo}"`)
    entrada.dispatchEvent(new Event('change', { bubbles: true }))
  }, rotulo)
}

// ───────────────────────────────────────────────────────────────────────────
// A jornada
// ───────────────────────────────────────────────────────────────────────────

test('cor da porta: o mestre pinta pela ficha, tranca (cadeado), desfaz o arrasto de uma vez e o jogador vê a mesma cor', async ({ page: mestre }) => {
  test.setTimeout(180_000)
  const erros: string[] = []
  mestre.on('pageerror', (e) => erros.push(e.message))
  const mapa = mapaDaPorta()
  await editorAbreAventura(mestre, mapa)

  // CONTROLE: a porta de sempre, creme, sem cadeado nem contorno vermelho.
  const antes = await lerAPorta(mestre, mapa)
  expect(distancia(antes.folha, CREME_DA_PORTA), `a régua não acha a porta creme de sempre em ${emTexto(antes.folha)}`).toBeLessThanOrEqual(PARECIDA)
  expect(antes.aro, 'a porta de sempre não tem o contorno vermelho').toBe(0)
  expect(antes.cadeado, 'a porta de sempre não tem cadeado').toBe(0)

  // 1. Selecionar a porta no mapa e escolher o azul da paleta na Aparência.
  await pickTool(mestre, 'Selecionar')
  const centro = await naTelaDoMestre(mestre, mapa, CENTRO_DA_PORTA)
  await mestre.mouse.click(centro.x, centro.y)
  const aparencia = mestre.getByRole('button', { name: /^Aparência/ })
  await expect(aparencia, 'clicar na porta não abriu a ficha da porta').toBeVisible({ timeout: ESPERA })
  if ((await aparencia.getAttribute('aria-expanded')) !== 'true') await aparencia.click()
  const campo = mestre.getByRole('radiogroup', { name: 'Cor da porta' })
  await expect(campo, 'a Aparência da porta não tem "Cor da porta"').toBeVisible({ timeout: ESPERA })
  await campo.getByRole('radio', { name: `Cor ${AZUL_DA_PALETA}` }).click()
  await expect(campo.getByRole('radio', { name: `Cor ${AZUL_DA_PALETA}` })).toHaveAttribute('aria-checked', 'true')
  const azul = await lerAPorta(mestre, mapa)
  expect(distancia(azul.folha, AZUL), `escolher o azul não pintou a porta: ${emTexto(azul.folha)} | porta ${await portaNoEditor(mestre)}`).toBeLessThanOrEqual(PARECIDA)

  // 2. Arrastar no seletor nativo e desfazer: cada abertura da caixa é UM Ctrl+Z.
  const outra = campo.getByRole('textbox', { name: 'Outra cor…' })
  await expect(outra, 'a Aparência da porta não tem "Outra cor…"').toBeVisible()
  // Primeira abertura: duas idas e voltas de 20 quadros com a caixa aberta, sem
  // o `change` do fechamento no meio — o mestre que arrasta duas vezes antes de
  // fechar. A primeira é o arrasto "frio" (as primeiras cores da sessão pagam o
  // aquecimento do motor JS e do React de desenvolvimento), a segunda, o de
  // regime; as duas são anotadas, e o p95 julgado é o de regime, contra a
  // carga da máquina na hora (`arrastoDeRegime`). Por serem da mesma abertura,
  // todos são um passo só do desfazer.
  const parada = await arrastarNoSeletor(mestre, 'Outra cor…', [], ARRASTO.length)
  const frio = await arrastarNoSeletor(mestre, 'Outra cor…', ARRASTO, 0)
  const regime = await arrastoDeRegime(mestre, 'Outra cor…')
  const medida = regime.escolhida.medida
  await fecharOSeletor(mestre, 'Outra cor…')
  console.log(`[medida] tela parada: quadro p95 ${parada.quadroP95Ms.toFixed(1)} ms em ${parada.quadros} quadros`)
  console.log(`[medida] arrasto frio: tarefa mais longa ${frio.tarefaMaisLongaMs.toFixed(1)} ms, quadro p95 ${frio.quadroP95Ms.toFixed(1)} ms; custo síncrono por cor ${JSON.stringify(frio.sincrono)} ms; quadros ${JSON.stringify(frio.todos)} ms`)
  for (const [i, r] of regime.todas.entries()) {
    console.log(`[medida] arrasto de regime ${i + 1}/${regime.todas.length}: quadro p95 ${r.medida.quadroP95Ms.toFixed(1)} ms (teto ${r.quadroP95MaxMs.toFixed(1)} ms, lentidão ${r.lentidao.toFixed(2)}, referência ${r.referenciaMs.map((v) => v.toFixed(2)).join('/')} ms), tarefa mais longa ${r.medida.tarefaMaisLongaMs.toFixed(1)} ms; custo síncrono por cor ${JSON.stringify(r.medida.sincrono)} ms`)
  }
  expect(frio.tarefaMaisLongaMs, 'o primeiro arrasto da cor travou a tela').toBeLessThan(TAREFA_LONGA_MS)
  const rosa = await lerAPorta(mestre, mapa)
  expect(distancia(rosa.folha, ROSA), `o arrasto não deixou a porta no rosa do fim: ${emTexto(rosa.folha)} | porta ${await portaNoEditor(mestre)}`).toBeLessThanOrEqual(PARECIDA)
  // Segunda abertura: até o verde, e a caixa fecha de novo. É outro passo do desfazer.
  const segunda = await arrastarNoSeletor(mestre, 'Outra cor…', ARRASTO_VERDE, 0)
  await fecharOSeletor(mestre, 'Outra cor…')
  console.log(`[medida] segunda abertura, ${ARRASTO_VERDE.length} cores: tarefa mais longa ${segunda.tarefaMaisLongaMs.toFixed(1)} ms`)
  expect(segunda.tarefaMaisLongaMs, 'o segundo arrasto da cor travou a tela').toBeLessThan(TAREFA_LONGA_MS)
  const verde = await lerAPorta(mestre, mapa)
  expect(distancia(verde.folha, VERDE), `o segundo arrasto não deixou a porta no verde do fim: ${emTexto(verde.folha)} | porta ${await portaNoEditor(mestre)}`).toBeLessThanOrEqual(PARECIDA)
  await outra.blur()
  await mestre.keyboard.press('Control+z')
  const semOVerde = await lerAPorta(mestre, mapa)
  expect(distancia(semOVerde.folha, ROSA), `o primeiro Ctrl+Z deveria desfazer só o segundo arrasto e voltar ao rosa: ${emTexto(semOVerde.folha)} | porta ${await portaNoEditor(mestre)}`).toBeLessThanOrEqual(PARECIDA)
  await mestre.keyboard.press('Control+z')
  const desfeito = await lerAPorta(mestre, mapa)
  expect(distancia(desfeito.folha, AZUL), `o segundo Ctrl+Z deveria desfazer o primeiro arrasto inteiro e voltar ao azul: ${emTexto(desfeito.folha)} | porta ${await portaNoEditor(mestre)}`).toBeLessThanOrEqual(PARECIDA)
  const lentidao = regime.escolhida.lentidao
  console.log(`[medida] arrasto de regime julgado, ${ARRASTO.length} cores: tarefa mais longa ${medida.tarefaMaisLongaMs.toFixed(1)} ms, quadro p95 ${medida.quadroP95Ms.toFixed(1)} ms em ${medida.quadros} quadros, teto ${regime.escolhida.quadroP95MaxMs.toFixed(1)} ms (lentidão ${lentidao.toFixed(2)})`)
  expect(medida.tarefaMaisLongaMs, 'o arrasto da cor travou a tela').toBeLessThan(TAREFA_LONGA_MS)
  const teto = regime.escolhida.quadroP95MaxMs
  const porque =
    lentidao > LENTIDAO_MAX_DA_MEDIDA
      ? `máquina ocupada demais para medir: ${lentidao.toFixed(2)}x mais lenta que livre nos ${regime.todas.length} arrastos, acima dos ${LENTIDAO_MAX_DA_MEDIDA}x que a medida compensa (teto parado em ${teto.toFixed(1)} ms); rode de novo com a máquina livre`
      : `o arrasto da cor perdeu quadros em ${regime.todas.length} arrastos (máquina ${lentidao.toFixed(2)}x mais lenta que livre)`
  expect(medida.quadroP95Ms, porque).toBeLessThanOrEqual(teto)

  // 3. Trancar: a folha continua azul, e aparecem o cadeado e o contorno vermelho.
  await mestre.getByRole('checkbox', { name: 'Trancada' }).click()
  const trancada = await lerAPorta(mestre, mapa)
  const diz = `folha ${emTexto(trancada.folha)}, cadeado ${trancada.cadeado} px, contorno ${trancada.aro} px | porta ${await portaNoEditor(mestre)}`
  expect(distancia(trancada.folha, AZUL), `trancar trocou a cor própria da porta: ${diz}`).toBeLessThanOrEqual(PARECIDA)
  expect(trancada.cadeado, `a porta trancada com cor própria não mostra o cadeado: ${diz}`).toBeGreaterThanOrEqual(8)
  expect(trancada.aro, `a porta trancada com cor própria não tem o contorno vermelho: ${diz}`).toBeGreaterThanOrEqual(2)
  await mestre.screenshot({ path: test.info().outputPath('01-editor-porta-azul-trancada.png') })

  // 4. A Visão de jogador: a porta chega azul (fechada comum, sem cadeado e sem o creme).
  await mostrarColunaDireita(mestre)
  await mestre.getByRole('tab', { name: 'Grupo' }).click()
  await mestre.getByRole('button', { name: /Visão de jogador/ }).click()
  const escolha = mestre.getByRole('dialog', { name: 'Escolher a ficha' })
  await expect(escolha, 'o botão "Visão de jogador" não abriu a escolha da ficha').toBeVisible({ timeout: ESPERA })
  const [popup] = await Promise.all([mestre.waitForEvent('popup'), escolha.getByRole('option', { name: new RegExp(`^${TOKEN},`) }).click()])
  popup.on('pageerror', (e) => erros.push(`popup: ${e.message}`))
  await popup.waitForLoadState('domcontentloaded')
  await expect(popup.locator('header.vj-barra'), 'a barra do teste não apareceu no popup').toBeVisible({ timeout: ESPERA })
  const telaDoJogador = popup.locator('canvas').first()
  await expect(telaDoJogador).toBeVisible({ timeout: ESPERA })
  // A última leitura do poll fica guardada aqui: é ela que as conferências de baixo julgam.
  const lido: { ultima: Awaited<ReturnType<typeof acharAPortaPelaCor>> | null } = { ultima: null }
  await expect
    .poll(
      async () => {
        lido.ultima = await acharAPortaPelaCor(popup, await telaDoJogador.screenshot(), AZUL, 8)
        return lido.ultima.pixels
      },
      { message: 'a porta azul não apareceu na tela do jogador de teste', timeout: ESPERA },
    )
    .toBeGreaterThanOrEqual(20)
  await popup.screenshot({ path: test.info().outputPath('02-visao-de-jogador-porta-azul.png') })
  const leitura = lido.ultima
  if (leitura === null || leitura.caixa === null) throw new Error('o poll passou sem leitura da tela do jogador')
  const naTela = JSON.stringify(leitura)
  console.log(`[jogador] porta pela cor: ${naTela}`)
  // A porta é uma barra fina: a caixa da cor é comprida num sentido e estreita no outro (não é a ficha nem o chão).
  expect(Math.min(leitura.caixa.w, leitura.caixa.h), `o azul da tela do jogador não tem forma de porta (${naTela})`).toBeLessThanOrEqual(12)
  expect(Math.max(leitura.caixa.w, leitura.caixa.h), `o azul da tela do jogador não tem forma de porta (${naTela})`).toBeGreaterThanOrEqual(20)
  expect(leitura.cremes, `a porta do jogador ainda sai creme em volta (${naTela})`).toBeLessThan(5)
  expect(leitura.claros, `o jogador não pode ver o cadeado: a trancada chega fechada comum (${naTela})`).toBe(0)

  expect(erros, 'o editor ou a janela de teste jogou erro').toEqual([])
})
