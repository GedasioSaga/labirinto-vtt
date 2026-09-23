// JORNADA DE USUÁRIO do AGRUPAR OBJETOS (item 18 de
// docs/features-candidatas-2026-09-21.md) — escrita para SAIR VERMELHA no
// código de hoje. É a régua da feature, não a feature.
//
// A FEATURE:
//   - o mestre seleciona vários itens (aqui: arrastando um retângulo no vazio
//     em volta de uma casa inteira — a sala, a porta e um móvel) e aperta
//     Ctrl+G: os itens viram UM GRUPO;
//   - depois de desmarcar, UM clique em qualquer membro seleciona o grupo
//     inteiro (o painel diz quantos itens estão selecionados, como já diz
//     hoje para a seleção de vários);
//   - arrastar a partir de um membro move a casa inteira junto, e o que está
//     fora do grupo (uma árvore) fica onde estava;
//   - Ctrl+Shift+G desagrupa: o clique seguinte num membro volta a pegar só
//     ele, e arrastá-lo não leva o resto.
//
// ONDE ISSO MORRE HOJE:
//   - `client/src/lib/keymap.ts:239-241`: com Ctrl, o atalho só conhece
//     Z/Y/D/S/O/A/0; Ctrl+G e Ctrl+Shift+G caem no `return null` da linha 241;
//   - `client/src/types/map.ts:754` (`MapData`) não tem nenhuma noção de grupo,
//     nem `lib/selectionModel.ts` (seleção é só uma lista de `{kind,id}`);
//   - `client/src/pixi/PixiCanvas.tsx:3384`: o "arrastar tudo junto" só existe
//     enquanto a seleção de vários está VIVA (`selection.length > 1`); desmarcou,
//     o próximo clique pega um item só e mover a casa volta a ser parede por
//     parede (a dor do item 18).
//
// COMO ESTE ARQUIVO PROVA, sem mentir (preparo herdado de
// task-jornada-copiar-e-colar.spec.ts, só o lado do mestre):
//   DISCO DE MENTIRA. Um mapa avulso ("Vila do Agrupar") no disco falso do
//   Tauri, aberto pelo menu "Carregar Mapa existente", como na mesa. Nele: a
//   CASA — uma sala azul "Casa", uma mesa vermelha (desenho cheio) dentro dela
//   e uma porta (parede solta com porta, sem vínculo com a sala) logo abaixo —
//   e, longe dela, uma ÁRVORE magenta (desenho cheio) que não entra no grupo.
//   Nenhum transporte de rede é falsificado: não há jogador nesta régua.
//   GESTO REAL. Tecla V (Selecionar); retângulo de seleção arrastado pelo
//   ponteiro no vazio; Ctrl+G e Ctrl+Shift+G pelo teclado; clique e arrasto
//   de ponteiro em passos, com PAUSA antes de soltar.
//   PROVA NA TELA. Texto visível ("3 itens") e cor lida em pixel na foto da
//   página, contando só onde o CANVAS do mapa está por cima: a posição de cada
//   peça é o centro de massa da cor dela (sala azul, mesa vermelha, porta
//   cor de madeira, árvore magenta). O único `evaluate` é a LEITURA de pixel
//   (decodificar a foto num canvas solto e perguntar `elementFromPoint`); ele
//   não toca no app. Nada é lido da store.
//
// SUPOSIÇÕES (as únicas que esta régua dita além das frases do pedido):
//   - o atalho de agrupar é Ctrl+G e o de desagrupar é Ctrl+Shift+G, com o foco
//     no mapa (nenhum campo de texto focado);
//   - "clicar seleciona o grupo": com o grupo selecionado por UM clique, o
//     painel mostra um texto visível com "3 itens" (a mesma contagem que o app
//     já mostra hoje para a seleção de vários: "3 itens selecionados"), e com
//     UM item só selecionado esse texto não aparece;
//   - "move tudo junto": cada peça da casa anda o mesmo deslocamento do
//     ponteiro (tolerância de 15% ou 8 px, para caber o encaixe na grade) e a
//     árvore não anda (até 3 px);
//   - a porta é uma parede solta com porta (`door`), desenhada na cor de
//     madeira de `pixi/drawDoors.ts` (`DOOR_COLOR`).
//
// FORA DESTA RÉGUA, de propósito: o lado do JOGADOR. Agrupar é gesto do editor;
// o que o jogador recebe depois de mover a casa é o mesmo mapa movido de hoje
// (o arrasto de seleção de vários já existe e já chega a ele). Também fica de
// fora grupo dentro de grupo e o grupo sobreviver a salvar e reabrir.
//
// CONTROLE POSITIVO (verde hoje): teste 1. Ele prova que o disco falso, o
// classificador de cor, o retângulo de seleção ("3 itens selecionados"), o
// arrasto da seleção de vários (a casa inteira anda e a árvore fica) e o
// clique que pega um item só funcionam. Sem ele, o vermelho dos testes 2 a 4
// poderia ser a infraestrutura quebrada, e não a feature ausente.
import { test, expect, type Page } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import type { Drawing, MapData, Region, Wall } from '../src/types/map'

// Disco apertado nesta máquina: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })

const MAPA = 'Vila do Agrupar'
const PASTA = 'C:/appdata/maps/map_vila_agrupar'
const NOME_DA_CASA = 'Casa'

const GRADE = 50
const COLUNAS = 20
const LINHAS = 16
const LARGURA = COLUNAS * GRADE
const ALTURA = LINHAS * GRADE

// Tudo o que o ponteiro toca fica na parte do canvas que NENHUM painel cobre:
// medido em 23/09, o mapa abre a ~94% com o painel lateral por cima até
// x≈280 px e a dica da ferramenta Selecionar até y≈180 px. Um laço que começou
// em cima do painel virou seleção de TEXTO da página, não retângulo no mapa.
/** A casa: sala azul (mundo). */
const CASA = { x: 280, y: 260, w: 300, h: 250 }
const COR_DA_CASA = '#1e32d2'
/** A mesa: desenho vermelho cheio, dentro da casa, longe do nome no meio. */
const MESA = { x: 310, y: 290, lado: 60 }
const COR_DA_MESA = '#d21e1e'
/** A porta: parede solta com porta, logo abaixo da casa. */
const PORTA = { x1: 380, y1: 550, x2: 480, y2: 550 }
/** A árvore: desenho magenta cheio, fora do grupo. */
const ARVORE = { cx: 850, cy: 300, raio: 45 }
const COR_DA_ARVORE = '#d21ed2'
/** Retângulo de seleção (mundo): cobre a casa inteira e nada mais. */
const LACO = { x1: 240, y1: 220, x2: 620, y2: 600 }
/** Ponto vazio, fora de tudo (mundo): clicar aqui desmarca. */
const VAZIO = { x: 900, y: 690 }
/** Quanto a casa é arrastada (mundo): quatro células para baixo. */
const DESLOCAMENTO = { dx: 0, dy: 200 }

/** Espera curta por elemento: a feature ausente tem de falhar rápido. */
const ESPERA = 6000
/**
 * Espera de quem LÊ PIXEL: cada leitura custa segundos (foto + decodificação),
 * e sob carga (várias pistas rodando Playwright) 15 s davam uma leitura só.
 */
const ESPERA_TELA = 40_000
/** Folga para o Pixi pintar antes da foto. */
const PINTURA_MS = 400
/** Botão parado antes de soltar o arrasto. */
const PAUSA_ANTES_DE_SOLTAR_MS = 150

const PIXELS_DA_CASA = 1500
const PIXELS_DA_MESA = 150
const PIXELS_DA_PORTA = 40
const PIXELS_DA_ARVORE = 300
/** Tolerância do "andou o mesmo tanto": fração do deslocamento, com piso em px. */
const FOLGA_FRACAO = 0.15
const FOLGA_MINIMA_PX = 8
/** "Não andou": até isto de desvio do centro de massa. */
const PARADO_PX = 3

/** A contagem do grupo no painel (suposição: mesma contagem da seleção de vários). */
const TEXTO_DO_GRUPO = /(^|\D)3 itens\b/

type Cor = 'azul' | 'vermelho' | 'madeira' | 'magenta'
type Foto = Awaited<ReturnType<Page['screenshot']>>
type Ponto = { x: number; y: number }

// ───────────────────────────────────────────────────────────────────────────
// O disco: um mapa avulso com a casa e a árvore
// ───────────────────────────────────────────────────────────────────────────

/**
 * Dois tracinhos brancos nos cantos opostos do mapa. O app enquadra ao abrir
 * pelo CONTEÚDO (`pixi/world.ts` `contentBounds`, que não conta o chão): sem
 * eles o mapa abria com zoom em volta da casa e da árvore, e o arrasto saía da
 * tela. Branco não entra em nenhuma cor que a régua conta.
 */
function marcosDosCantos(): Drawing[] {
  const traco = (sufixo: string, x: number, y: number): Drawing => ({
    id: `marco-${sufixo}`,
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

function salaDaCasa(): Region {
  const { x, y, w, h } = CASA
  return {
    id: 'sala-casa',
    points: [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ],
    tag: '',
    fillColor: COR_DA_CASA,
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: NOME_DA_CASA },
  }
}

function mesa(): Drawing {
  const { x, y, lado } = MESA
  return { id: 'des-mesa', kind: 'rect', x, y, w: lado, h: lado, color: COR_DA_MESA, width: 2, filled: true, fillAlpha: 1 }
}

function arvore(): Drawing {
  const { cx, cy, raio } = ARVORE
  return { id: 'des-arvore', kind: 'circle', cx, cy, radius: raio, color: COR_DA_ARVORE, width: 2, filled: true, fillAlpha: 1 }
}

function porta(): Wall {
  return { id: 'parede-porta', ...PORTA, blocksLight: true, blocksMove: true, door: { open: false, locked: false, kind: 'normal' } }
}

function discoDeMentira(): Record<string, string> {
  const base = createEmptyMap('map_vila_agrupar', MAPA, COLUNAS, LINHAS, GRADE)
  const mapa: MapData = {
    ...base,
    // SEM peça de chão, de propósito: a peça de chão é item selecionável, e o
    // laço que começava "no vazio" em cima dela pegava e arrastava o chão
    // inteiro (medido em 23/09). Fora de qualquer peça é vazio de verdade.
    floor: [],
    regions: [salaDaCasa()],
    walls: [porta()],
    drawings: [...marcosDosCantos(), mesa(), arvore()],
  }
  return { [`${PASTA}/map.json`]: serializeMap(mapa) }
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
 * massa, contando só onde o CANVAS do mapa está por cima (rail e painéis não
 * contam). Decodifica a foto num canvas solto — nada do app é tocado.
 */
async function lerCores(page: Page, foto: Foto): Promise<Leitura> {
  return page.evaluate(
    async ({ b64 }) => {
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
      const vazia = () => ({ n: 0, x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity, sx: 0, sy: 0 })
      const r = { azul: vazia(), vermelho: vazia(), madeira: vazia(), magenta: vazia() }
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const i = (y * width + x) * 4
          const R = data[i]
          const G = data[i + 1]
          const B = data[i + 2]
          let alvoCor: keyof typeof r | null = null
          if (R > 170 && G < 60 && B < 60) alvoCor = 'vermelho'
          else if (R >= 180 && R <= 235 && G >= 110 && G <= 170 && B >= 25 && B <= 95 && R - G > 45 && G - B > 50) alvoCor = 'madeira'
          else if (B > 150 && B > R * 2.5 && B > G * 2) alvoCor = 'azul'
          else if (R > 150 && B > 150 && R > G * 2.5 && B > G * 2.5 && Math.abs(R - B) < 40) alvoCor = 'magenta'
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
      const fechar = (m: ReturnType<typeof vazia>) => ({
        n: m.n,
        x1: m.x1 * escalaX,
        y1: m.y1 * escalaY,
        x2: (m.x2 + 1) * escalaX,
        y2: (m.y2 + 1) * escalaY,
        cx: m.n > 0 ? (m.sx / m.n + 0.5) * escalaX : NaN,
        cy: m.n > 0 ? (m.sy / m.n + 0.5) * escalaY : NaN,
      })
      return {
        azul: fechar(r.azul),
        vermelho: fechar(r.vermelho),
        madeira: fechar(r.madeira),
        magenta: fechar(r.magenta),
      }
    },
    { b64: foto.toString('base64') },
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

async function editor(page: Page): Promise<Leitura> {
  await page.waitForTimeout(PINTURA_MS)
  return lerCores(page, await foto(page))
}

/** A casa e a árvore à vista, com o mínimo de pixels de cada peça. */
async function mapaAVista(page: Page): Promise<Leitura> {
  const minimos: Record<Cor, number> = {
    azul: PIXELS_DA_CASA,
    vermelho: PIXELS_DA_MESA,
    madeira: PIXELS_DA_PORTA,
    magenta: PIXELS_DA_ARVORE,
  }
  const guarda: { ultima: Leitura | null } = { ultima: null }
  await expect
    .poll(
      async () => {
        const l = await editor(page)
        guarda.ultima = l
        return (Object.keys(minimos) as Cor[]).filter((c) => l[c].n <= minimos[c]).map((c) => `${c}=${l[c].n}`)
      },
      {
        timeout: ESPERA_TELA,
        intervals: [250, 500],
        message: 'o editor deveria mostrar a casa azul, a mesa vermelha, a porta de madeira e a árvore magenta (lista = cores abaixo do mínimo)',
      },
    )
    .toEqual([])
  if (!guarda.ultima) throw new Error('sem leitura')
  return guarda.ultima
}

async function mestreAbreOMapa(page: Page): Promise<Leitura> {
  await instalarDisco(page)
  await page.goto('/')
  await page.getByRole('button', { name: /Carregar Mapa existente/ }).click()
  await page.getByRole('button', { name: new RegExp(MAPA) }).click()
  await page.waitForSelector('canvas')
  return mapaAVista(page)
}

// ───────────────────────────────────────────────────────────────────────────
// Mundo → tela, calibrado pela própria casa azul na foto
// ───────────────────────────────────────────────────────────────────────────

interface Tela {
  escala: number
  ponto: (mundo: Ponto) => Ponto
}

/** A sala azul tem caixa conhecida no mundo: a caixa dela na foto dá escala e origem. */
function telaPelaCasa(l: Leitura): Tela {
  const escala = (l.azul.x2 - l.azul.x1) / CASA.w
  const escalaY = (l.azul.y2 - l.azul.y1) / CASA.h
  expect(Math.abs(escala - escalaY) / escala, 'a casa azul deveria aparecer sem distorção (mesma escala nos dois eixos)').toBeLessThan(0.1)
  return {
    escala,
    ponto: (m) => ({ x: l.azul.x1 + (m.x - CASA.x) * escala, y: l.azul.y1 + (m.y - CASA.y) * escala }),
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Gestos (todos pelo ponteiro e pelo teclado de verdade)
// ───────────────────────────────────────────────────────────────────────────

async function ferramentaSelecionar(page: Page): Promise<void> {
  await page.keyboard.press('v')
}

/** Clique curto de ponteiro no ponto. */
async function clicarEm(page: Page, p: Ponto): Promise<void> {
  await page.mouse.move(p.x, p.y, { steps: 4 })
  await page.mouse.down()
  await page.waitForTimeout(80)
  await page.mouse.up()
  await page.waitForTimeout(150)
}

/** Arrasto de ponteiro em passos, com pausa antes de soltar. */
async function arrastar(page: Page, de: Ponto, ate: Ponto): Promise<void> {
  await page.mouse.move(de.x, de.y, { steps: 4 })
  await page.mouse.down()
  await page.waitForTimeout(80)
  await page.mouse.move(de.x + (ate.x - de.x) * 0.3, de.y + (ate.y - de.y) * 0.3, { steps: 6 })
  await page.mouse.move(ate.x, ate.y, { steps: 12 })
  await page.waitForTimeout(PAUSA_ANTES_DE_SOLTAR_MS)
  await page.mouse.up()
  await page.waitForTimeout(200)
}

/** Retângulo de seleção arrastado no vazio em volta da casa inteira. */
async function lacarACasa(page: Page, tela: Tela): Promise<void> {
  await ferramentaSelecionar(page)
  await arrastar(page, tela.ponto({ x: LACO.x1, y: LACO.y1 }), tela.ponto({ x: LACO.x2, y: LACO.y2 }))
}

async function desmarcar(page: Page, tela: Tela): Promise<void> {
  await clicarEm(page, tela.ponto(VAZIO))
  await expect(page.getByText(TEXTO_DO_GRUPO).first(), 'clicar no vazio deveria desmarcar tudo').toHaveCount(0, { timeout: ESPERA })
}

/** O centro da mesa vermelha na tela. */
function centroDaMesa(l: Leitura): Ponto {
  return { x: l.vermelho.cx, y: l.vermelho.cy }
}

/** Arrasta a partir da mesa, DESLOCAMENTO de mundo; devolve o deslocamento na tela. */
async function arrastarAMesa(page: Page, tela: Tela, antes: Leitura): Promise<Ponto> {
  const de = centroDaMesa(antes)
  const passo = { x: DESLOCAMENTO.dx * tela.escala, y: DESLOCAMENTO.dy * tela.escala }
  await arrastar(page, de, { x: de.x + passo.x, y: de.y + passo.y })
  return passo
}

function folga(passo: Ponto): number {
  return Math.max(FOLGA_MINIMA_PX, Math.hypot(passo.x, passo.y) * FOLGA_FRACAO)
}

const NOMES: Record<Cor, string> = {
  azul: 'a sala azul da casa',
  vermelho: 'a mesa vermelha',
  madeira: 'a porta',
  magenta: 'a árvore de fora',
}

/** Quanto o centro de massa de uma peça andou entre duas leituras. */
function andou(antes: Leitura, depois: Leitura, cor: Cor): Ponto {
  return { x: depois[cor].cx - antes[cor].cx, y: depois[cor].cy - antes[cor].cy }
}

function descrever(p: Ponto): string {
  return `(${p.x.toFixed(1)}, ${p.y.toFixed(1)}) px`
}

/** Cada peça da lista andou o passo; a árvore ficou. Mensagem diz qual falhou. */
async function conferirMovimento(page: Page, antes: Leitura, passo: Ponto, juntas: Cor[], paradas: Cor[]): Promise<void> {
  const depois = await mapaAVista(page)
  const tol = folga(passo)
  for (const cor of juntas) {
    const d = andou(antes, depois, cor)
    const erro = Math.hypot(d.x - passo.x, d.y - passo.y)
    expect(erro, `${NOMES[cor]} deveria ter andado ${descrever(passo)} junto com o arrasto; andou ${descrever(d)}`).toBeLessThanOrEqual(tol)
  }
  for (const cor of paradas) {
    const d = andou(antes, depois, cor)
    expect(Math.hypot(d.x, d.y), `${NOMES[cor]} deveria ter ficado parada; andou ${descrever(d)}`).toBeLessThanOrEqual(cor === 'magenta' ? PARADO_PX : tol)
  }
}

/** Com a casa laçada: Ctrl+G agrupa, desmarca e UM clique na mesa pega o grupo inteiro. */
async function agruparEClicarNaMesa(page: Page, tela: Tela, antes: Leitura): Promise<void> {
  await lacarACasa(page, tela)
  await expect(page.getByText(TEXTO_DO_GRUPO).first(), 'o laço em volta da casa deveria selecionar 3 itens').toBeVisible({ timeout: ESPERA })
  await page.keyboard.press('Control+g')
  await desmarcar(page, tela)
  await clicarEm(page, centroDaMesa(antes))
  await expect(
    page.getByText(TEXTO_DO_GRUPO).first(),
    'depois do Ctrl+G, UM clique na mesa deveria selecionar a casa inteira (o painel diria "3 itens"); hoje pega só a mesa',
  ).toBeVisible({ timeout: ESPERA })
}

// ───────────────────────────────────────────────────────────────────────────
// As jornadas
// ───────────────────────────────────────────────────────────────────────────

test('1. controle: o laço seleciona a casa (3 itens), arrastar a seleção viva move a casa e deixa a árvore, e um clique na mesa pega só ela', async ({ page }) => {
  test.setTimeout(240_000)
  const inicio = await mestreAbreOMapa(page)
  const tela = telaPelaCasa(inicio)

  await lacarACasa(page, tela)
  await expect(page.getByText('3 itens selecionados', { exact: false }).first(), 'o laço em volta da casa deveria selecionar sala, porta e mesa').toBeVisible({ timeout: ESPERA })

  const passo = await arrastarAMesa(page, tela, inicio)
  await conferirMovimento(page, inicio, passo, ['azul', 'vermelho', 'madeira'], ['magenta'])

  // A câmera não mudou: a calibragem do começo continua valendo (a casa andou,
  // a origem do mundo não). O ponto vazio fica longe de onde a casa foi parar.
  const movida = await mapaAVista(page)
  await desmarcar(page, tela)
  await clicarEm(page, centroDaMesa(movida))
  await expect(page.getByText(TEXTO_DO_GRUPO).first(), 'sem grupo, um clique na mesa pega só a mesa').toHaveCount(0, { timeout: ESPERA })
})

test('2. Ctrl+G agrupa: depois de desmarcar, UM clique na mesa seleciona a casa inteira', async ({ page }) => {
  test.setTimeout(240_000)
  const inicio = await mestreAbreOMapa(page)
  const tela = telaPelaCasa(inicio)

  await agruparEClicarNaMesa(page, tela, inicio)
})

test('3. arrastar a partir de um membro do grupo move a casa inteira junto e a árvore fica', async ({ page }) => {
  test.setTimeout(240_000)
  const inicio = await mestreAbreOMapa(page)
  const tela = telaPelaCasa(inicio)

  await lacarACasa(page, tela)
  await expect(page.getByText(TEXTO_DO_GRUPO).first(), 'o laço em volta da casa deveria selecionar 3 itens').toBeVisible({ timeout: ESPERA })
  await page.keyboard.press('Control+g')
  await desmarcar(page, tela)

  // Arrasto que COMEÇA na mesa, com nada selecionado: só o grupo explica a casa andar.
  const passo = await arrastarAMesa(page, tela, inicio)
  await conferirMovimento(page, inicio, passo, ['vermelho', 'azul', 'madeira'], ['magenta'])
})

test('4. Ctrl+Shift+G desagrupa: o clique seguinte na mesa pega só ela e arrastá-la não leva a casa', async ({ page }) => {
  test.setTimeout(240_000)
  const inicio = await mestreAbreOMapa(page)
  const tela = telaPelaCasa(inicio)

  await agruparEClicarNaMesa(page, tela, inicio)
  await page.keyboard.press('Control+Shift+g')
  await desmarcar(page, tela)

  await clicarEm(page, centroDaMesa(inicio))
  await expect(page.getByText(TEXTO_DO_GRUPO).first(), 'desagrupada, um clique na mesa deveria pegar só a mesa').toHaveCount(0, { timeout: ESPERA })
  await desmarcar(page, tela)

  const passo = await arrastarAMesa(page, tela, inicio)
  await conferirMovimento(page, inicio, passo, ['vermelho'], ['azul', 'madeira', 'magenta'])
})
