// JORNADA DE USUÁRIO do COPIAR E COLAR (item 8 de
// docs/features-candidatas-2026-09-21.md) — escrita para SAIR VERMELHA no
// código de hoje. É a régua da feature, não a feature.
//
// A FEATURE:
//   - Ctrl+C copia a seleção (sala, porta, marcador, desenho) sem mudar nada
//     no mapa;
//   - Ctrl+V cola a cópia PERTO DO CURSOR, onde quer que o ponteiro esteja no
//     mapa — inclusive depois de trocar de cena ou de abrir OUTRO mapa;
//   - Ctrl+X recorta: tira a seleção do mapa, e o Ctrl+V seguinte a devolve
//     perto do cursor;
//   - a sala colada leva o nome junto.
//
// ONDE ISSO MORRE HOJE: `client/src/lib/keymap.ts:236` só conhece
// `if (lower === 'd') return { kind: 'duplicate' }` (Ctrl+D, cópia deslocada
// uma célula, no mesmo mapa); Ctrl+C, Ctrl+V e Ctrl+X caem no
// `return null` de `keymap.ts:241`. Não existe área de transferência no app:
// `stores/mapStore.ts:1026` (`duplicateSelected`) clona e insere na hora, e
// nada sobrevive à troca de cena (`stores/adventureStore`) nem ao Início.
// Reaproveitar uma sala pronta de outro mapa hoje é redesenhar tudo.
//
// COMO ESTE ARQUIVO PROVA, sem mentir (preparo herdado de
// task-jornada-visao-geral-das-cenas.spec.ts, só o lado do mestre):
//   DISCO DE MENTIRA. Uma aventura de duas cenas (Salão, Cripta) e um mapa
//   avulso ("Mapa Avulso"), abertos pelo menu "Carregar Mapa existente" como
//   na mesa. No Salão há um DESENHO (retângulo laranja cheio) e uma SALA azul
//   chamada "Despensa". Nenhum transporte de rede é falsificado: não há
//   jogador nesta régua.
//   GESTO REAL. Tecla V (Selecionar), clique de ponteiro em cima do item,
//   Ctrl+C / Ctrl+X / Ctrl+V pelo teclado, e o ponteiro MOVIDO (hover real,
//   `page.mouse.move` em passos) até o ponto onde a colagem deve cair. Troca
//   de cena por clique na lista Cenas; troca de mapa pelo botão "Início" da
//   barra "Ações do mapa" e pela lista "Carregar Mapa existente".
//   PROVA NA TELA. Cor lida em pixel na foto da página, contando só onde o
//   CANVAS do mapa está por cima (rail e painéis não contam): o desenho é
//   laranja, a sala é azul, e cada chão tem cor própria (Salão verde-água,
//   Cripta magenta, Mapa Avulso vermelho-escuro). "Perto do cursor" = pixels
//   da cor DENTRO de uma janela em volta do ponto do ponteiro, que estava
//   vazia daquela cor antes do Ctrl+V. O nome da sala colada é lido no campo
//   "Nome" do painel da Sala depois de clicar nela. O único `evaluate` é a
//   LEITURA de pixel (decodificar a foto num canvas solto e perguntar
//   `elementFromPoint`); ele não toca no app. Nada é lido da store.
//
// SUPOSIÇÕES (as únicas que esta régua dita além das frases do pedido):
//   - "perto do cursor": a cópia colada cai com pelo menos METADE dos pixels
//     dela dentro de um quadrado de lado 3x o tamanho do item, centrado no
//     ponteiro (cabe "canto no cursor", "centro no cursor" e ajuste à grade);
//   - a sala colada mantém o nome começando por "Despensa" (pode ganhar
//     sufixo, como "(cópia)"), lido no campo "Nome" do painel da Sala;
//   - colar seleciona ou não a cópia, tanto faz: a régua não olha seleção;
//   - a área de transferência pode ser do app ou do sistema: a página tem
//     permissão de clipboard, para uma implementação com
//     `navigator.clipboard` não sair vermelha por falta dela.
//
// FORA DESTA RÉGUA, de propósito: porta solta e marcador (pino). O caminho é o
// mesmo (seleção → Ctrl+C → Ctrl+V no cursor), e desenho + sala já exigem a
// área de transferência entre cenas e entre mapas; porta e pino só teriam uma
// leitura de pixel mais frágil (traço fino, cabeça dourada que colide com a
// cor de seleção). Lado do jogador também fica fora: copiar e colar é gesto do
// editor, e o que o jogador recebe continua saindo do recorte de névoa de hoje.
//
// CONTROLE POSITIVO (verde hoje): teste 1. Ele prova que o disco falso, as
// duas cenas, o classificador de cor, o clique que seleciona (Ctrl+D, que
// existe, duplica o desenho selecionado) e o painel da Sala com o campo
// "Nome" funcionam. Sem ele, o vermelho dos testes 2 a 6 poderia ser a
// infraestrutura quebrada, e não a feature ausente.
import { test, expect, type Locator, type Page } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import type { Drawing, MapData, Region } from '../src/types/map'

// Disco apertado nesta máquina: sem trace e sem vídeo. O screenshot de falha fica.
// Permissão de clipboard: colar pela área de transferência do sistema é uma
// implementação válida e não pode falhar por falta de permissão.
test.use({ trace: 'off', video: 'off', permissions: ['clipboard-read', 'clipboard-write'] })

const AVENTURA = 'Aventura do Salão e da Cripta'
const SALAO = 'Salão'
const CRIPTA = 'Cripta'
const AVULSO = 'Mapa Avulso'
const ID_SALAO = 'scene_salao'
const ID_CRIPTA = 'scene_cripta'
const PASTA = 'C:/appdata/maps/map_salao_cripta'
const PASTA_AVULSO = 'C:/appdata/maps/map_avulso'
const NOME_DA_SALA = 'Despensa'

const GRADE = 50
const COLUNAS = 20
const LINHAS = 16
const LARGURA = COLUNAS * GRADE
const ALTURA = LINHAS * GRADE

/** Chão de cada mapa/cena: cores que nada mais no app usa. */
const CHAO_SALAO = '#1e8c8c'
const CHAO_CRIPTA = '#8c1e8c'
const CHAO_AVULSO = '#8c1414'
/** O desenho: retângulo laranja cheio, pequeno, no alto à direita do Salão. */
const COR_DO_DESENHO = '#ff5a00'
const DESENHO = { x: 820, y: 100, lado: 60 }
/** A sala: quadrado azul no alto, no meio do Salão. */
const COR_DA_SALA = '#1e32d2'
const SALA = { x: 420, y: 80, lado: 200 }

/** Espera curta por elemento: a feature ausente tem de falhar rápido. */
const ESPERA = 6000
/** Espera de quem LÊ PIXEL: cada leitura custa segundos (foto + decodificação). */
const ESPERA_TELA = 15_000
/** Folga para o Pixi pintar antes da foto. */
const PINTURA_MS = 400

/** Pixels do chão sobre o canvas para dizer "este mapa/cena está aberto". */
const PIXELS_DE_CENA = 2000
/** Pixels mínimos do desenho laranja no editor. */
const PIXELS_DO_DESENHO = 200
/** Pixels mínimos da sala azul no editor. */
const PIXELS_DA_SALA = 2000
/** Pixels máximos para dizer "esta cor NÃO está aqui" (antisserrilhado). */
const RESIDUO = 3
/** Metade da cópia dentro da janela do cursor = "colou perto do cursor". */
const FRACAO_PERTO_DO_CURSOR = 0.5
/** Lado da janela em volta do cursor, em múltiplos do tamanho do item na tela. */
const JANELA_EM_TAMANHOS = 3
/** Ctrl+D duplica deslocando uma célula: a cópia cobre quase o dobro de pixels. */
const FATOR_DUPLICADO = 1.6

type Cor = 'verdeAgua' | 'magenta' | 'vermelhoEscuro' | 'laranja' | 'azul'
type Foto = Awaited<ReturnType<Page['screenshot']>>
type Ponto = { x: number; y: number }
type Janela = { x1: number; y1: number; x2: number; y2: number }

// ───────────────────────────────────────────────────────────────────────────
// O disco: aventura (Salão com desenho e sala, Cripta vazia) e um mapa avulso
// ───────────────────────────────────────────────────────────────────────────

function chaoInteiro(id: string): MapData['floor'] {
  return [{ id: `${id}-chao`, shape: { kind: 'rect', cx: LARGURA / 2, cy: ALTURA / 2, w: LARGURA - 20, h: ALTURA - 20 }, op: 'add', modifiers: {} }]
}

/**
 * Dois tracinhos brancos nos cantos opostos do mapa. O app enquadra ao abrir
 * pelo CONTEÚDO (`pixi/world.ts` `contentBounds`, que não conta o chão): sem
 * eles o Salão abria a 261% em volta do desenho e da sala, e a cópia do Ctrl+D
 * saía da tela. Branco não entra em nenhuma cor que a régua conta.
 */
function marcosDosCantos(id: string): Drawing[] {
  const traco = (sufixo: string, x: number, y: number): Drawing => ({
    id: `${id}-marco-${sufixo}`,
    kind: 'line',
    x1: x,
    y1: y,
    x2: x + 20,
    y2: y,
    color: '#ffffff',
    width: 2,
  })
  return [traco('a', 15, 15), traco('b', LARGURA - 35, ALTURA - 15)]
}

function mapa(id: string, nome: string, chao: string, extras: Partial<MapData> = {}): MapData {
  const base = createEmptyMap(id, nome, COLUNAS, LINHAS, GRADE)
  const desenhos = [...marcosDosCantos(id), ...(extras.drawings ?? [])]
  return { ...base, floor: chaoInteiro(id), floorStyle: { ...base.floorStyle, fillColor: chao }, ...extras, drawings: desenhos }
}

function desenhoLaranja(): Drawing {
  const { x, y, lado } = DESENHO
  return { id: 'des-laranja', kind: 'rect', x, y, w: lado, h: lado, color: COR_DO_DESENHO, width: 2, filled: true, fillAlpha: 1 }
}

function salaAzul(): Region {
  const { x, y, lado } = SALA
  return {
    id: 'sala-despensa',
    points: [
      { x, y },
      { x: x + lado, y },
      { x: x + lado, y: y + lado },
      { x, y: y + lado },
    ],
    tag: '',
    fillColor: COR_DA_SALA,
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: NOME_DA_SALA },
  }
}

function discoDeMentira(): Record<string, string> {
  const aventura = {
    version: 1,
    id: 'adv_salao_cripta',
    name: AVENTURA,
    startSceneId: ID_SALAO,
    scenes: [
      { id: ID_SALAO, name: SALAO, file: 'map.json' },
      { id: ID_CRIPTA, name: CRIPTA, file: `scenes/${ID_CRIPTA}/map.json` },
    ],
  }
  return {
    [`${PASTA}/map.json`]: serializeMap(mapa('map_salao_cripta', AVENTURA, CHAO_SALAO, { drawings: [desenhoLaranja()], regions: [salaAzul()] })),
    [`${PASTA}/adventure.json`]: JSON.stringify(aventura, null, 2),
    [`${PASTA}/scenes/${ID_CRIPTA}/map.json`]: serializeMap(mapa('map_cripta', CRIPTA, CHAO_CRIPTA)),
    [`${PASTA_AVULSO}/map.json`]: serializeMap(mapa('map_avulso', AVULSO, CHAO_AVULSO)),
  }
}

// ───────────────────────────────────────────────────────────────────────────
// O mestre: app em modo Tauri com disco de mentira (só disco; sem rede)
// ───────────────────────────────────────────────────────────────────────────

type JanelaDoMestre = {
  isTauri: boolean
  __TAURI_INTERNALS__: {
    metadata: { currentWindow: { label: string }; currentWebview: { windowLabel: string; label: string } }
    invoke: (cmd: string, args?: unknown, options?: { headers?: Record<string, string> }) => Promise<unknown>
    transformCallback: () => number
    convertFileSrc: (filePath: string) => string
  }
}

async function instalarDisco(page: Page): Promise<void> {
  await page.addInitScript(
    ({ arquivos }: { arquivos: Record<string, string> }) => {
      const alvo = window as unknown as JanelaDoMestre
      const textos: Record<string, string> = { ...arquivos }
      const pastas = new Set<string>()
      const semBarraFinal = (p: string): string => p.replace(/[/]+$/, '')
      const todos = (): string[] => Object.keys(textos).concat(Array.from(pastas))
      const existe = (caminho: string): boolean => {
        const c = semBarraFinal(caminho)
        return todos().some((p) => p === c || p.indexOf(`${c}/`) === 0)
      }
      alvo.isTauri = true
      alvo.__TAURI_INTERNALS__ = {
        metadata: { currentWindow: { label: 'main' }, currentWebview: { windowLabel: 'main', label: 'main' } },
        convertFileSrc: (caminho: string) => String(caminho),
        transformCallback: () => 0,
        invoke: async (cmd, args, options) => {
          const a = (args ?? {}) as Record<string, unknown>
          switch (cmd) {
            case 'plugin:path|resolve_directory':
              return 'C:/appdata'
            case 'plugin:path|join':
              return (a.paths as string[]).join('/')
            case 'plugin:path|dirname': {
              const p = String(a.path)
              return p.slice(0, Math.max(0, p.lastIndexOf('/')))
            }
            case 'plugin:fs|exists':
              return existe(String(a.path))
            case 'plugin:fs|mkdir':
              pastas.add(semBarraFinal(String(a.path)))
              return null
            case 'plugin:fs|write_text_file':
              textos[decodeURIComponent(options?.headers?.path ?? '')] = new TextDecoder().decode(args as Uint8Array)
              return null
            case 'plugin:fs|read_text_file': {
              const caminho = String(a.path)
              if (!(caminho in textos)) throw new Error(`arquivo não existe: ${caminho}`)
              return Array.from(new TextEncoder().encode(textos[caminho]))
            }
            case 'plugin:fs|rename': {
              const de = String(a.oldPath)
              if (de in textos) {
                textos[String(a.newPath)] = textos[de]
                delete textos[de]
              }
              return null
            }
            case 'plugin:fs|read_dir': {
              const prefixo = `${semBarraFinal(String(a.path))}/`
              const filhos = new Map<string, boolean>()
              for (const p of todos()) {
                if (p.indexOf(prefixo) !== 0) continue
                const resto = p.slice(prefixo.length)
                if (resto.length === 0) continue
                const corte = resto.indexOf('/')
                const nome = corte === -1 ? resto : resto.slice(0, corte)
                filhos.set(nome, (filhos.get(nome) ?? false) || corte !== -1 || pastas.has(p))
              }
              return Array.from(filhos.entries()).map(([name, isDirectory]) => ({ name, isDirectory, isFile: !isDirectory, isSymlink: false }))
            }
            default:
              return null
          }
        },
      }
    },
    { arquivos: discoDeMentira() },
  )
}

/** Abre um mapa da lista "Carregar Mapa existente" (a tela de menu já tem de estar à vista). */
async function abrirDaLista(page: Page, nome: string): Promise<void> {
  await page.getByRole('button', { name: /Carregar Mapa existente/ }).click()
  await page.getByRole('button', { name: new RegExp(nome) }).click()
  await page.waitForSelector('canvas')
}

async function mestreAbreAventura(page: Page): Promise<Locator> {
  await instalarDisco(page)
  await page.goto('/')
  await abrirDaLista(page, AVENTURA)
  const lista = await secaoCenas(page)
  for (const nome of [SALAO, CRIPTA]) {
    await expect(entradaDaCena(lista, nome), `a lista de Cenas deveria ter "${nome}"`).toBeVisible({ timeout: ESPERA })
  }
  await editorMostraChao(page, 'verdeAgua', SALAO)
  return lista
}

/** A seção "Cenas" da aba Mapa, aberta (mesmo gesto de task-jornada-cenas-com-gente). */
async function secaoCenas(page: Page): Promise<Locator> {
  await page.getByRole('tab', { name: 'Mapa' }).click()
  const painel = page.getByRole('tabpanel', { name: 'Mapa' })
  const cabecalho = painel.getByRole('button', { name: 'Cenas', exact: true })
  await expect(cabecalho, 'a aba Mapa do rail deveria ter uma seção "Cenas"').toBeVisible({ timeout: 10_000 })
  if ((await cabecalho.getAttribute('aria-expanded')) === 'false') await cabecalho.click()
  await expect(cabecalho).toHaveAttribute('aria-expanded', 'true')
  const corpo = await cabecalho.getAttribute('aria-controls')
  return corpo ? page.locator(`[id="${corpo}"]`) : painel
}

function entradaDaCena(lista: Locator, nome: string): Locator {
  return lista.getByRole('button', { name: nome, exact: true })
}

async function abrirCena(page: Page, lista: Locator, nome: string, chao: Cor): Promise<void> {
  await secaoCenas(page)
  await entradaDaCena(lista, nome).click()
  await expect(entradaDaCena(lista, nome), `clicada, "${nome}" deveria ficar marcada na lista`).toHaveAttribute('aria-current', 'true')
  await editorMostraChao(page, chao, nome)
}

// ───────────────────────────────────────────────────────────────────────────
// Leitura de pixel (só LÊ a foto; coordenadas devolvidas em px CSS da página)
// ───────────────────────────────────────────────────────────────────────────

interface Mancha {
  n: number
  x1: number
  y1: number
  x2: number
  y2: number
  cx: number
  cy: number
}
type Leitura = Record<Cor, Mancha>

/**
 * Para cada cor da régua: quantos pixels, a caixa que os envolve e o centro de
 * massa, contando só onde o CANVAS do mapa está por cima. Com `janela` (px CSS),
 * conta só dentro dela. Decodifica a foto num canvas solto — nada do app é tocado.
 */
async function lerCores(page: Page, foto: Foto, janela: Janela | null): Promise<Leitura> {
  return page.evaluate(
    async ({ b64, jan }) => {
      const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob())
      const tela = document.createElement('canvas')
      tela.width = bmp.width
      tela.height = bmp.height
      const ctx = tela.getContext('2d')
      if (!ctx) throw new Error('sem contexto 2d')
      ctx.drawImage(bmp, 0, 0)
      const { data, width, height } = ctx.getImageData(0, 0, bmp.width, bmp.height)
      const escalaX = window.innerWidth / width
      const escalaY = window.innerHeight / height
      const noCanvas = new Map<number, boolean>()
      const canvasPorCima = (x: number, y: number): boolean => {
        const chave = (y >> 3) * 65536 + (x >> 3)
        let v = noCanvas.get(chave)
        if (v === undefined) {
          v = document.elementFromPoint(((x >> 3) * 8 + 4) * escalaX, ((y >> 3) * 8 + 4) * escalaY)?.tagName === 'CANVAS'
          noCanvas.set(chave, v)
        }
        return v
      }
      const x0 = jan ? Math.max(0, Math.floor(jan.x1 / escalaX)) : 0
      const y0 = jan ? Math.max(0, Math.floor(jan.y1 / escalaY)) : 0
      const xf = jan ? Math.min(width - 1, Math.ceil(jan.x2 / escalaX)) : width - 1
      const yf = jan ? Math.min(height - 1, Math.ceil(jan.y2 / escalaY)) : height - 1
      const vazia = () => ({ n: 0, x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity, sx: 0, sy: 0 })
      const r = { verdeAgua: vazia(), magenta: vazia(), vermelhoEscuro: vazia(), laranja: vazia(), azul: vazia() }
      for (let y = y0; y <= yf; y += 1) {
        for (let x = x0; x <= xf; x += 1) {
          const i = (y * width + x) * 4
          const R = data[i]
          const G = data[i + 1]
          const B = data[i + 2]
          let alvoCor: keyof typeof r | null = null
          if (R > 200 && G > 50 && G < 140 && B < 60) alvoCor = 'laranja'
          else if (B > 150 && B > R * 2.5 && B > G * 2) alvoCor = 'azul'
          else if (G >= 110 && G > R * 1.8 + 8 && B > R * 1.8 + 8 && Math.abs(G - B) < 30) alvoCor = 'verdeAgua'
          else if (R > G * 1.8 + 8 && B > G * 1.8 + 8 && Math.abs(R - B) < 30) alvoCor = 'magenta'
          else if (R >= 90 && R <= 190 && R > G * 2.5 + 10 && R > B * 2.5 + 10) alvoCor = 'vermelhoEscuro'
          if (alvoCor === null || !canvasPorCima(x, y)) continue
          const m = r[alvoCor]
          m.n += 1
          m.sx += x
          m.sy += y
          if (x < m.x1) m.x1 = x
          if (y < m.y1) m.y1 = y
          if (x > m.x2) m.x2 = x
          if (y > m.y2) m.y2 = y
        }
      }
      // Devolve em px CSS: é neles que o ponteiro da página anda.
      const fechar = (m: ReturnType<typeof vazia>) => ({
        n: m.n,
        x1: m.x1 * escalaX,
        y1: m.y1 * escalaY,
        x2: (m.x2 + 1) * escalaX,
        y2: (m.y2 + 1) * escalaY,
        cx: m.n > 0 ? ((m.sx / m.n) + 0.5) * escalaX : NaN,
        cy: m.n > 0 ? ((m.sy / m.n) + 0.5) * escalaY : NaN,
      })
      return {
        verdeAgua: fechar(r.verdeAgua),
        magenta: fechar(r.magenta),
        vermelhoEscuro: fechar(r.vermelhoEscuro),
        laranja: fechar(r.laranja),
        azul: fechar(r.azul),
      }
    },
    { b64: foto.toString('base64'), jan: janela },
  )
}

async function foto(page: Page): Promise<Foto> {
  for (let tentativa = 1; tentativa <= 3; tentativa += 1) {
    try {
      return await page.screenshot()
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }
  throw new Error('não consegui fotografar')
}

/** O editor inteiro (só onde o canvas está por cima), ou só a janela dada. */
async function editor(page: Page, janela: Janela | null = null): Promise<Leitura> {
  await page.waitForTimeout(PINTURA_MS)
  return lerCores(page, await foto(page), janela)
}

async function editorMostraChao(page: Page, cor: Cor, nome: string): Promise<void> {
  await expect
    .poll(async () => (await editor(page))[cor].n, { timeout: ESPERA_TELA, message: `o editor deveria mostrar o chão de "${nome}"` })
    .toBeGreaterThan(PIXELS_DE_CENA)
}

/** A mancha de uma cor, esperando ela aparecer com pelo menos `minimo` pixels. */
async function manchaVisivel(page: Page, cor: Cor, minimo: number, oQue: string): Promise<Mancha> {
  await expect
    .poll(async () => (await editor(page))[cor].n, { timeout: ESPERA_TELA, message: `o editor deveria mostrar ${oQue}` })
    .toBeGreaterThan(minimo)
  return (await editor(page))[cor]
}

/**
 * O ponto onde a colagem deve cair: dentro do chão visível do mapa aberto,
 * embaixo e à esquerda — longe do desenho (alto à direita) e da sala (alto, no
 * meio), para a janela do cursor começar vazia das duas cores.
 */
async function pontoDeColar(page: Page, chao: Cor): Promise<Ponto> {
  const m = (await editor(page))[chao]
  expect(m.n, 'o chão do mapa aberto deveria estar à vista para escolher onde colar').toBeGreaterThan(PIXELS_DE_CENA)
  return { x: Math.round(m.x1 + (m.x2 - m.x1) * 0.35), y: Math.round(m.y1 + (m.y2 - m.y1) * 0.6) }
}

function janelaEmVolta(p: Ponto, tamanhoDoItem: number): Janela {
  const meio = (tamanhoDoItem * JANELA_EM_TAMANHOS) / 2
  return { x1: p.x - meio, y1: p.y - meio, x2: p.x + meio, y2: p.y + meio }
}

function tamanhoNaTela(m: Mancha): number {
  return Math.max(m.x2 - m.x1, m.y2 - m.y1)
}

/** Ponteiro de verdade até o ponto, em passos (hover real, como a mão). */
async function levarOPonteiro(page: Page, p: Ponto): Promise<void> {
  await page.mouse.move(p.x - 40, p.y - 30, { steps: 4 })
  await page.mouse.move(p.x, p.y, { steps: 6 })
  await page.waitForTimeout(150)
}

/** Ferramenta Selecionar (V) e clique de ponteiro no ponto. */
async function selecionarEm(page: Page, p: Ponto): Promise<void> {
  await page.keyboard.press('v')
  await page.mouse.move(p.x, p.y, { steps: 4 })
  await page.mouse.down()
  await page.waitForTimeout(80)
  await page.mouse.up()
  await page.waitForTimeout(150)
}

/** Clica no desenho laranja (centro da mancha) e devolve a mancha. */
async function selecionarDesenho(page: Page): Promise<Mancha> {
  const laranja = await manchaVisivel(page, 'laranja', PIXELS_DO_DESENHO, 'o desenho laranja do Salão')
  await selecionarEm(page, { x: laranja.cx, y: laranja.cy })
  return laranja
}

/** Clica dentro da sala azul, longe do nome no meio, e devolve a mancha. */
async function selecionarSala(page: Page, sala: Mancha): Promise<void> {
  await selecionarEm(page, { x: sala.x1 + (sala.x2 - sala.x1) * 0.2, y: sala.y1 + (sala.y2 - sala.y1) * 0.8 })
}

/** O campo "Nome" do painel da Sala (aparece com uma sala selecionada). */
function campoNomeDaSala(page: Page): Locator {
  return page.getByRole('textbox', { name: 'Nome', exact: true })
}

/** Espera a cor aparecer, com pelo menos `minimo` pixels, DENTRO da janela do cursor. */
async function apareceNaJanela(page: Page, cor: Cor, janela: Janela, minimo: number, oQue: string): Promise<Mancha> {
  await expect
    .poll(async () => (await editor(page, janela))[cor].n, { timeout: ESPERA_TELA, message: oQue })
    .toBeGreaterThanOrEqual(minimo)
  return (await editor(page, janela))[cor]
}

// ───────────────────────────────────────────────────────────────────────────
// As jornadas
// ───────────────────────────────────────────────────────────────────────────

test('1. controle: o Salão mostra o desenho e a sala, o clique seleciona, Ctrl+D duplica o desenho e o painel da Sala mostra o nome', async ({ page }) => {
  test.setTimeout(180_000)
  const lista = await mestreAbreAventura(page)

  const sala = await manchaVisivel(page, 'azul', PIXELS_DA_SALA, `a sala azul "${NOME_DA_SALA}" do Salão`)
  await selecionarSala(page, sala)
  await expect(campoNomeDaSala(page), `com a sala selecionada, o painel da Sala deveria mostrar o nome "${NOME_DA_SALA}"`).toHaveValue(
    NOME_DA_SALA,
    { timeout: ESPERA },
  )

  const antes = await selecionarDesenho(page)
  await page.keyboard.press('Control+d')
  await expect
    .poll(async () => (await editor(page)).laranja.n, {
      timeout: ESPERA_TELA,
      message: 'Ctrl+D com o desenho selecionado deveria pôr uma segunda cópia laranja na tela (prova que clique e teclado chegam ao editor)',
    })
    .toBeGreaterThan(antes.n * FATOR_DUPLICADO)

  // A Cripta abre vazia: nem laranja nem azul. É lá que os testes 3 e 5 colam.
  await abrirCena(page, lista, CRIPTA, 'magenta')
  const cripta = await editor(page)
  expect(cripta.laranja.n, `a "${CRIPTA}" não tem desenho e não deveria ter laranja`).toBeLessThanOrEqual(RESIDUO)
  expect(cripta.azul.n, `a "${CRIPTA}" não tem sala e não deveria ter azul`).toBeLessThanOrEqual(RESIDUO)
})

test('2. Ctrl+C no desenho e Ctrl+V com o ponteiro em outro ponto colam uma cópia ali, e o original fica', async ({ page }) => {
  test.setTimeout(180_000)
  await mestreAbreAventura(page)
  const original = await selecionarDesenho(page)
  const tamanho = tamanhoNaTela(original)

  await page.keyboard.press('Control+c')
  const depoisDoCopiar = await editor(page)
  expect(depoisDoCopiar.laranja.n, 'Ctrl+C não muda o mapa: o desenho continua um só').toBeLessThan(original.n * FATOR_DUPLICADO)

  const alvo = await pontoDeColar(page, 'verdeAgua')
  const janela = janelaEmVolta(alvo, tamanho)
  expect((await editor(page, janela)).laranja.n, 'antes de colar, a janela em volta do cursor não tem laranja').toBeLessThanOrEqual(RESIDUO)
  await levarOPonteiro(page, alvo)
  await page.keyboard.press('Control+v')

  await apareceNaJanela(
    page,
    'laranja',
    janela,
    original.n * FRACAO_PERTO_DO_CURSOR,
    `Ctrl+V deveria colar o desenho laranja perto do cursor, em (${alvo.x}, ${alvo.y})`,
  )
  const noOriginal = await editor(page, { x1: original.x1 - 2, y1: original.y1 - 2, x2: original.x2 + 2, y2: original.y2 + 2 })
  expect(noOriginal.laranja.n, 'copiar não tira o original do lugar').toBeGreaterThan(original.n * 0.8)
})

test('3. Ctrl+C no Salão, troca para a Cripta, Ctrl+V cola o desenho na Cripta perto do cursor', async ({ page }) => {
  test.setTimeout(180_000)
  const lista = await mestreAbreAventura(page)
  const original = await selecionarDesenho(page)
  await page.keyboard.press('Control+c')

  await abrirCena(page, lista, CRIPTA, 'magenta')
  expect((await editor(page)).laranja.n, `a "${CRIPTA}" começa sem laranja`).toBeLessThanOrEqual(RESIDUO)
  const alvo = await pontoDeColar(page, 'magenta')
  const janela = janelaEmVolta(alvo, tamanhoNaTela(original))
  await levarOPonteiro(page, alvo)
  await page.keyboard.press('Control+v')

  await apareceNaJanela(
    page,
    'laranja',
    janela,
    original.n * FRACAO_PERTO_DO_CURSOR,
    `copiado no "${SALAO}", o desenho deveria colar na "${CRIPTA}" perto do cursor, em (${alvo.x}, ${alvo.y})`,
  )

  // De volta ao Salão: o original continua lá, sozinho.
  await abrirCena(page, lista, SALAO, 'verdeAgua')
  const salao = await editor(page)
  expect(salao.laranja.n, `o desenho original continua no "${SALAO}"`).toBeGreaterThan(original.n * 0.8)
  expect(salao.laranja.n, `colar na "${CRIPTA}" não põe cópia no "${SALAO}"`).toBeLessThan(original.n * FATOR_DUPLICADO)
})

test('4. Ctrl+X recorta o desenho da tela, e Ctrl+V o devolve perto do cursor', async ({ page }) => {
  test.setTimeout(180_000)
  await mestreAbreAventura(page)
  const original = await selecionarDesenho(page)
  const noOriginal: Janela = { x1: original.x1 - 2, y1: original.y1 - 2, x2: original.x2 + 2, y2: original.y2 + 2 }
  // Controle positivo: sem o desenho à vista antes, "Ctrl+X tira da tela" passaria com o mapa vazio.
  expect(original.n, 'o desenho laranja deveria estar à vista antes do Ctrl+X').toBeGreaterThan(PIXELS_DO_DESENHO)

  await page.keyboard.press('Control+x')
  await expect
    .poll(async () => (await editor(page)).laranja.n, { timeout: ESPERA_TELA, message: 'Ctrl+X deveria tirar o desenho laranja da tela' })
    .toBeLessThanOrEqual(RESIDUO)

  const alvo = await pontoDeColar(page, 'verdeAgua')
  const janela = janelaEmVolta(alvo, tamanhoNaTela(original))
  await levarOPonteiro(page, alvo)
  await page.keyboard.press('Control+v')

  await apareceNaJanela(
    page,
    'laranja',
    janela,
    original.n * FRACAO_PERTO_DO_CURSOR,
    `depois de Ctrl+X, Ctrl+V deveria devolver o desenho perto do cursor, em (${alvo.x}, ${alvo.y})`,
  )
  expect((await editor(page, noOriginal)).laranja.n, 'recortado, o desenho não volta ao lugar de antes').toBeLessThanOrEqual(RESIDUO)
})

test('5. Ctrl+C na sala "Despensa", troca para a Cripta, Ctrl+V cola a sala perto do cursor e com o nome', async ({ page }) => {
  test.setTimeout(180_000)
  const lista = await mestreAbreAventura(page)
  const sala = await manchaVisivel(page, 'azul', PIXELS_DA_SALA, `a sala azul "${NOME_DA_SALA}" do Salão`)
  expect(sala.n, 'a sala azul deveria estar à vista antes do Ctrl+C').toBeGreaterThan(PIXELS_DA_SALA)
  await selecionarSala(page, sala)
  await expect(campoNomeDaSala(page), 'a sala do Salão deveria estar selecionada').toHaveValue(NOME_DA_SALA, { timeout: ESPERA })
  await page.keyboard.press('Control+c')

  await abrirCena(page, lista, CRIPTA, 'magenta')
  expect((await editor(page)).azul.n, `a "${CRIPTA}" começa sem sala azul`).toBeLessThanOrEqual(RESIDUO)
  const alvo = await pontoDeColar(page, 'magenta')
  const janela = janelaEmVolta(alvo, tamanhoNaTela(sala))
  await levarOPonteiro(page, alvo)
  await page.keyboard.press('Control+v')

  const colada = await apareceNaJanela(
    page,
    'azul',
    janela,
    sala.n * FRACAO_PERTO_DO_CURSOR,
    `copiada no "${SALAO}", a sala deveria colar na "${CRIPTA}" perto do cursor, em (${alvo.x}, ${alvo.y})`,
  )

  // Clique na sala colada: o painel da Sala mostra o nome que veio junto.
  await selecionarSala(page, colada)
  await expect(campoNomeDaSala(page), `a sala colada deveria levar o nome "${NOME_DA_SALA}"`).toHaveValue(new RegExp(`^${NOME_DA_SALA}`), {
    timeout: ESPERA,
  })
})

test('6. Ctrl+C no Salão, Início, abre o "Mapa Avulso", Ctrl+V cola o desenho no outro mapa perto do cursor', async ({ page }) => {
  test.setTimeout(180_000)
  await mestreAbreAventura(page)
  const original = await selecionarDesenho(page)
  expect(original.n, 'o desenho laranja deveria estar à vista antes do Ctrl+C').toBeGreaterThan(PIXELS_DO_DESENHO)
  await page.keyboard.press('Control+c')

  // Início salva e volta ao menu; de lá, o outro mapa pela lista.
  await page.getByRole('toolbar', { name: 'Ações do mapa' }).getByRole('button', { name: 'Início', exact: true }).click()
  await abrirDaLista(page, AVULSO)
  await editorMostraChao(page, 'vermelhoEscuro', AVULSO)
  expect((await editor(page)).laranja.n, `o "${AVULSO}" começa sem laranja`).toBeLessThanOrEqual(RESIDUO)

  const alvo = await pontoDeColar(page, 'vermelhoEscuro')
  const janela = janelaEmVolta(alvo, tamanhoNaTela(original))
  await levarOPonteiro(page, alvo)
  await page.keyboard.press('Control+v')

  await apareceNaJanela(
    page,
    'laranja',
    janela,
    original.n * FRACAO_PERTO_DO_CURSOR,
    `copiado no "${SALAO}", o desenho deveria colar no "${AVULSO}" perto do cursor, em (${alvo.x}, ${alvo.y})`,
  )
})
