// JORNADA DE USUÁRIO — "a casa tem TETO: de fora o jogador vê o telhado, não a
// mobília; ele entra e o teto abre; ele sai e o teto fecha. O mestre vê tudo".
//
// ESCRITA ANTES DA FEATURE EXISTIR, de propósito. Nenhum arquivo de produção é
// tocado por ela. Hoje ela sai VERMELHA, e por quatro motivos somados — cada um
// deles sozinho já bastaria:
//
//   1. não existe o campo `RoomMeta.roof` (client/src/types/map.ts:165-190 tem
//      `shape`, `name`, `labelOffset` e `nameHiddenFromPlayers`, mais nada);
//   2. não existe o interruptor "Teto fechado para jogadores" no painel da Sala
//      (client/src/components/RoomControls.tsx:73-79 só tem o irmão dele,
//      "Jogadores veem o nome");
//   3. `client/src/lib/fogFilter.ts:294-460` (`filterMapForPlayer`) não conhece
//      teto nenhum: desenho, prop, escada, pino e chão saem para o jogador pela
//      régua de VISÃO/EXPLORADO. Com a parede de baixo da Sala aberta, o jogador
//      parado LÁ FORA enxerga a mobília de dentro — é o vazamento que esta
//      jornada mede;
//   4. e o que ele viu VIRA MEMÓRIA (`isShapeKnown` = visível OU explorado),
//      então depois de sair da sala a mobília continua na tela dele para sempre.
//
// O QUE A FEATURE PROMETE, escrito como número mensurável:
//   * teto FECHADO (token do jogador fora do polígono da Sala): dentro do
//     polígono a tela do jogador é uma SILHUETA — pintada de ponta a ponta
//     (`aceso >= 0,90` do recorte) e sem NADA do interior (`marca <= 0,01`);
//   * teto ABERTO (token do jogador dentro do polígono): a mobília aparece
//     (`marca >= 0,20`);
//   * o jogador tira o token: a mobília some de novo (`marca <= 0,01`), inclusive
//     a que ele já tinha visto — teto fechado vence a memória;
//   * o MESTRE continua vendo a mobília o tempo todo, com o teto ligado.
//
// COMO A TELA É MEDIDA, sem ler store, banco nem payload:
//
// * A MOBÍLIA é um retângulo de desenho MAGENTA PURO (#ff00ff) opaco, posto
//   dentro da Sala pelo próprio mestre, com a ferramenta Retângulo e o seletor
//   de Cor do painel. "Chegou magenta aqui?" é medido em MAGENTIDADE —
//   `min(R,B) - G` —, pelo mesmo motivo que a jornada da luz mede vermelhidão:
//   para qualquer cinza neutro de valor v coberto por magenta com alpha a, a
//   foto dá R = B = v + a(255-v) e G = v(1-a), então `min(R,B) - G = 255·a`.
//   A conta MEDE o alpha do magenta na tela e não depende do tom do chão.
//   Nada mais na tela do jogador é magenta: token próprio é #3b82f6, token
//   alheio #9ca3af, parede #d8d2c4, névoa preta, fora do mapa #111111.
//
// * A SILHUETA é medida sem inventar cor nenhuma (a feature não promete uma):
//   `aceso` é a fração de pixels do recorte acima da névoa fechada, que é preto
//   puro. "Chapada e fechada" = `aceso` alto E `marca` zero no MESMO recorte.
//
// * A régua mundo→tela sai da PRÓPRIA FOTO, como em
//   `task-jornada-visao-sala-inteira.spec.ts`: fora do retângulo do mapa o fundo
//   é 0x111111 e dentro, onde o jogador nada conhece, a névoa é preto puro. A
//   borda entre os dois dá origem e escala. Se o app enquadrar diferente, a
//   régua acompanha; se ela não for reconhecida, o teste ERRA em voz alta em vez
//   de medir o lugar errado.
//
// GEOMETRIA (px de mundo; mapa 30x20 de grade 64 = 1920x1280; no mapa recém
// criado a câmera do editor é 1:1, então px do canvas do mestre = px de mundo):
//   Sala        520..1000 x 110..330, com a parede de BAIXO apagada pelo mestre;
//   mobília     570..950  x 150..250 (retângulo magenta);
//   recorte     540..980  x 130..310 (a Sala com 20 px de recuo das paredes);
//   FORA        (760, 480) — 150 px abaixo do vão, com linha de visão para
//               DENTRO da sala. É de propósito: se o teto só escondesse o que a
//               parede já esconde, ele não seria teto nenhum;
//   DENTRO      (760, 290) — dentro do polígono, abaixo da mobília;
//   NUNCA VISTO 1400..1700 x 900..1100 — o zero da régua, medido na mesma foto.
//
// A LANTERNA É ENCOLHIDA PARA 250 px pelo próprio controle do mestre ("Raio de
// visão", RoomPanel.tsx), ANTES de o personagem ser entregue — e isso não é
// detalhe. Com os 700 px de fábrica, o jogador parado LÁ FORA já ilumina a
// construção inteira: a medida "o polígono está pintado de ponta a ponta"
// devolvia 100% HOJE, sem teto nenhum, e aprovava a feature errada (medido em
// 18/09/2026: `de fora: aceso 100,0%`). Com 250 px, de fora só um pedaço da
// sala é alcançado pela lanterna, e 100% de polígono pintado passa a significar
// uma coisa só: alguém desenhou a silhueta da construção.
//
// GESTO REAL em todo passo: o mestre desenha a Sala e a mobília com
// move → down → vários move → PAUSA → up; liga o interruptor com clique; o
// jogador anda arrastando o PRÓPRIO token no canvas dele, e a tela dele é que
// diz se o token chegou. Nada de `dispatchEvent`, nada de escrever na store de
// ninguém, nenhuma asserção lida de store ou de payload.
//
// O mapa que o jogador recebe vem do caminho de produção inteiro: editor →
// `net/hostBridge.ts` (sessão real do mestre, recorte real de `lib/fogFilter.ts`)
// → WebSocket → `player/main.tsx`. Só o cano entre as duas abas é do teste,
// exatamente como em `task-jornada-visao-sala-inteira.spec.ts`.
//
// CONTROLES POSITIVOS (todo teto numérico tem um):
//  a. canto do mapa onde o token nunca chegou perto → a régua devolve ~0 aceso.
//     Se devolvesse número alto, ela estaria contando fundo/moldura e nenhum
//     teto daqui valeria nada;
//  b. a mobília TEM de aparecer na tela do jogador quando o token está DENTRO
//     (`marca >= 0,20`). Sem isso, uma tela que simplesmente não desenha nada —
//     que é a névoa de hoje — passaria em todos os tetos sem provar coisa nenhuma;
//  c. a mobília TEM de aparecer na tela do MESTRE com o teto ligado. É a prova
//     de que o retângulo magenta existe no mapa e de que a régua de magentidade
//     sabe achá-lo;
//  d. os recortes medidos não podem encostar no painel do jogador, que flutua
//     sobre o canvas — senão pixel de interface entraria na conta.
import { test, expect, type Page, type WebSocketRoute } from '@playwright/test'
import { createHostSession } from '../src/net/hostSession'
import { createEmptyMap } from '../src/lib/mapFactory'
import { enterEditor } from './helpers/enterEditor'
import { installTauriFsStub } from './helpers/tauriFsStub'
import { pickTool } from './helpers/tools'
import type { HostMessage } from '../src/net/protocol'
import type { Drawing, MapData, Region, Token } from '../src/types/map'

// Disco da máquina apertado: nada de trace nem vídeo por causa desta jornada.
// As fotos que interessam são tiradas na mão, passo a passo.
test.use({ trace: 'off', video: 'off' })

const CODE = 'TETO01'
/** Mapa do formulário "Criar mapa" com os valores padrão (screens/NewDungeonMap.tsx:15-17). */
const MUNDO = { w: 30 * 64, h: 20 * 64 } // 1920 x 1280
/** Viewport do playwright.config.ts. */
const VIEW = { width: 1280, height: 800 }
/** Raio que o mestre escolhe no painel Jogo (VISION_RADIUS_MIN 50 + 4 passos de 50). */
const RAIO = 250

/** O rótulo do interruptor novo, irmão de "Jogadores veem o nome". */
const ROTULO_DO_TETO = 'Teto fechado para jogadores'
/** O irmão que JÁ existe (RoomControls.tsx:75) — prova de que o painel aberto é o da Sala. */
const ROTULO_IRMAO = 'Jogadores veem o nome'

type Retangulo = { x0: number; y0: number; x1: number; y1: number }
type Ponto = { x: number; y: number }

/** A construção. A parede de baixo é apagada pelo mestre: é por ali que se entra. */
const SALA: Retangulo = { x0: 520, y0: 110, x1: 1000, y1: 330 }
/** Meio da parede de baixo — onde a borracha clica. */
const VAO = { x: (SALA.x0 + SALA.x1) / 2, y: SALA.y1 }
/** A mobília: retângulo magenta opaco, dentro da Sala. */
const MOBILIA: Retangulo = { x0: 570, y0: 150, x1: 950, y1: 250 }
/** O interior da Sala com 20 px de recuo, para o recorte não medir a própria parede. */
const INTERIOR: Retangulo = { x0: 540, y0: 130, x1: 980, y1: 310 }
/** Canto do mapa onde o token nunca chegou perto: o zero da régua. */
const NUNCA_VISTO: Retangulo = { x0: 1400, y0: 900, x1: 1700, y1: 1100 }
/** Onde o mestre clica para selecionar a Sala: dentro dela, longe da mobília e da parede. */
const PONTO_DA_SALA: Ponto = { x: 760, y: 295 }

/** Token do jogador FORA da construção, com linha de visão para dentro pelo vão. */
const FORA: Ponto = { x: 760, y: 480 }
/** Token do jogador DENTRO do polígono da construção, abaixo da mobília. */
const DENTRO: Ponto = { x: 760, y: 290 }

/**
 * Silhueta pintada de ponta a ponta. A névoa fechada é preto puro, então
 * "aceso" é qualquer coisa desenhada. Com o teto fechado o polígono inteiro tem
 * de estar pintado: é isso que "silhueta da construção" quer dizer na tela.
 */
const PISO_DE_SILHUETA = 0.9
/**
 * Fração de magenta que conta como "a mobília apareceu". Cheia, ela ocupa
 * 380x100 de um recorte de 440x180, ou seja 48% — o piso é menos da metade
 * disso, para um pedaço da mobília coberto pelo token ou pela borda da visão
 * não derrubar a medida.
 */
const PISO_DE_MOBILIA = 0.2
/** Teto de magenta que conta como "nada do interior chegou". 1% é resíduo de antisserrilhado. */
const TETO_DE_MOBILIA = 0.01
/** Luminância mínima para o pixel contar como desenhado. Névoa fechada é preto puro (alfa 1). */
const LIMIAR_DE_LUZ = 10
/** Magentidade mínima (= 255·alpha) para o pixel contar como mobília: alpha 0,24. */
const LIMIAR_DE_MAGENTA = 60
/** Luminância que separa o lado de FORA do mapa (0x111111 ≈ 17) da névoa fechada (0). */
const LIMIAR_DA_MOLDURA = 8
/** Linha e coluna da foto usadas para achar a moldura do mapa: longe do painel, da Sala e da visão. */
const LINHA_DA_MOLDURA = 700
const COLUNA_DA_MOLDURA = 1100
/** O Pixi pinta no rAF seguinte; o snapshot ainda faz a volta pela rede falsa. */
const PINTURA_MS = 400
/** Um humano não solta o botão no mesmo quadro do último movimento. */
const PAUSA_ANTES_DE_SOLTAR_MS = 120

/** O que `locator.screenshot()` devolve — sem @types/node no tsconfig dos e2e. */
type Foto = Awaited<ReturnType<ReturnType<Page['locator']>['screenshot']>>

/** Régua mundo→tela, tirada da própria foto do jogador. */
interface Regua {
  origem: Ponto
  escala: number
}

interface Medida {
  /** Fração de pixels desenhados (acima da névoa fechada) dentro do recorte, de 0 a 1. */
  aceso: number
  /** Fração de pixels de MAGENTA (a mobília) dentro do recorte, de 0 a 1. */
  marca: number
}

async function caixaDoCanvas(page: Page) {
  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('canvas sem bounding box')
  return box
}

async function fotografar(page: Page): Promise<string> {
  const foto: Foto = await page.locator('canvas').screenshot()
  return foto.toString('base64')
}

/** Caixa do painel flutuante do jogador, em px de CSS dentro do canvas. */
async function caixaDoPainel(page: Page): Promise<Retangulo> {
  const painel = await page.getByRole('complementary', { name: 'Painel do jogador' }).boundingBox()
  const canvas = await caixaDoCanvas(page)
  if (!painel) throw new Error('painel do jogador sem bounding box')
  return {
    x0: painel.x - canvas.x,
    y0: painel.y - canvas.y,
    x1: painel.x - canvas.x + painel.width,
    y1: painel.y - canvas.y + painel.height,
  }
}

function cruza(a: Retangulo, b: Retangulo): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1
}

/**
 * Lê da foto do JOGADOR a moldura do mapa e o token azul dele.
 *
 * Moldura: fora do retângulo do mapa o fundo é 0x111111 (player/PlayerView.tsx)
 * e dentro, onde o jogador nada conhece, a névoa é preto puro. A borda entre os
 * dois dá origem e escala da câmera sem perguntar nada ao app.
 *
 * Token: 0x3b82f6 (`OWN_TOKEN_COLOR`). Pixel dentro da caixa do painel é
 * ignorado: o rádio do personagem no painel é do mesmo azul e puxaria o centro.
 * O magenta da mobília não entra nesse filtro (b - r = 0 nele).
 */
async function lerTela(page: Page, b64: string, painel: Retangulo) {
  const box = await caixaDoCanvas(page)
  return page.evaluate(
    async ({ foto, painel: semPainel, larguraCss, limiarMoldura, linha, coluna }) => {
      const blob = await (await fetch(`data:image/png;base64,${foto}`)).blob()
      const bmp = await createImageBitmap(blob)
      const canvas2d = document.createElement('canvas')
      canvas2d.width = bmp.width
      canvas2d.height = bmp.height
      const ctx = canvas2d.getContext('2d')
      if (!ctx) throw new Error('sem contexto 2d para ler a foto')
      ctx.drawImage(bmp, 0, 0)
      const { data, width, height } = ctx.getImageData(0, 0, bmp.width, bmp.height)
      const escalaFoto = bmp.width / larguraCss
      const luz = (px: number, py: number): number => {
        const i = (py * width + px) * 4
        return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      }

      const py = Math.round(linha * escalaFoto)
      let esquerda = -1
      let direita = -1
      for (let px = 0; px < width; px += 1) {
        if (luz(px, py) >= limiarMoldura) continue
        if (esquerda < 0) esquerda = px
        direita = px
      }
      const px = Math.round(coluna * escalaFoto)
      let topo = -1
      for (let y = 0; y < height; y += 1) {
        if (luz(px, y) < limiarMoldura) {
          topo = y
          break
        }
      }

      let somaX = 0
      let somaY = 0
      let n = 0
      for (let y = 0; y < height; y += 1) {
        const yCss = y / escalaFoto
        for (let x = 0; x < width; x += 1) {
          const xCss = x / escalaFoto
          if (xCss >= semPainel.x0 && xCss <= semPainel.x1 && yCss >= semPainel.y0 && yCss <= semPainel.y1) continue
          const i = (y * width + x) * 4
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          if (b > 170 && b - r > 60 && b - g > 40) {
            somaX += x
            somaY += y
            n += 1
          }
        }
      }

      return {
        moldura: { esquerda: esquerda / escalaFoto, direita: direita / escalaFoto, topo: topo / escalaFoto },
        token: n === 0 ? null : { x: somaX / n / escalaFoto, y: somaY / n / escalaFoto },
      }
    },
    { foto: b64, painel, larguraCss: box.width, limiarMoldura: LIMIAR_DA_MOLDURA, linha: LINHA_DA_MOLDURA, coluna: COLUNA_DA_MOLDURA },
  )
}

function reguaDe(moldura: { esquerda: number; direita: number; topo: number }): Regua {
  const escala = (moldura.direita - moldura.esquerda + 1) / MUNDO.w
  if (!(escala > 0.5 && escala < 0.7)) {
    throw new Error(`a moldura do mapa não foi reconhecida na foto (escala ${escala.toFixed(3)}): a régua mundo→tela não vale`)
  }
  return { origem: { x: moldura.esquerda, y: moldura.topo }, escala }
}

function paraTela(regua: Regua, p: Ponto): Ponto {
  return { x: regua.origem.x + p.x * regua.escala, y: regua.origem.y + p.y * regua.escala }
}

function recorteNaTela(regua: Regua, r: Retangulo): Retangulo {
  const a = paraTela(regua, { x: r.x0, y: r.y0 })
  const b = paraTela(regua, { x: r.x1, y: r.y1 })
  return { x0: a.x, y0: a.y, x1: b.x, y1: b.y }
}

/**
 * Régua de pixel: dentro de cada recorte conta o que está DESENHADO (acima da
 * névoa) e o que está MAGENTA (a mobília). Nenhum estado do app entra nesta
 * conta — só a imagem que a pessoa vê.
 *
 * Magentidade = `min(R,B) - G` = 255·alpha do magenta sobre qualquer cinza
 * neutro (ver cabeçalho): mede a tinta, não o tom do chão de baixo.
 */
async function medir(page: Page, b64: string, recortes: Retangulo[]): Promise<Medida[]> {
  const box = await caixaDoCanvas(page)
  return page.evaluate(
    async ({ foto, recortes: rects, larguraCss, limiarLuz, limiarMagenta }) => {
      const blob = await (await fetch(`data:image/png;base64,${foto}`)).blob()
      const bmp = await createImageBitmap(blob)
      const canvas2d = document.createElement('canvas')
      canvas2d.width = bmp.width
      canvas2d.height = bmp.height
      const ctx = canvas2d.getContext('2d')
      if (!ctx) throw new Error('sem contexto 2d para ler a foto')
      ctx.drawImage(bmp, 0, 0)
      const { data, width, height } = ctx.getImageData(0, 0, bmp.width, bmp.height)
      const escalaFoto = bmp.width / larguraCss
      return rects.map((r) => {
        const px0 = Math.max(0, Math.round(r.x0 * escalaFoto))
        const px1 = Math.min(width, Math.round(r.x1 * escalaFoto))
        const py0 = Math.max(0, Math.round(r.y0 * escalaFoto))
        const py1 = Math.min(height, Math.round(r.y1 * escalaFoto))
        let acesos = 0
        let magentas = 0
        let total = 0
        for (let px = px0; px < px1; px += 1) {
          for (let py = py0; py < py1; py += 1) {
            const i = (py * width + px) * 4
            const vermelho = data[i]
            const verde = data[i + 1]
            const azul = data[i + 2]
            total += 1
            if (0.299 * vermelho + 0.587 * verde + 0.114 * azul > limiarLuz) acesos += 1
            if (Math.min(vermelho, azul) - verde >= limiarMagenta) magentas += 1
          }
        }
        return {
          aceso: total === 0 ? 0 : acesos / total,
          marca: total === 0 ? 0 : magentas / total,
        }
      })
    },
    { foto: b64, recortes, larguraCss: box.width, limiarLuz: LIMIAR_DE_LUZ, limiarMagenta: LIMIAR_DE_MAGENTA },
  )
}

/** Arrasto de ponteiro de verdade, com pausa antes de soltar. */
async function arrastar(page: Page, de: Ponto, ate: Ponto, passos = 14): Promise<void> {
  await page.mouse.move(de.x, de.y)
  await page.mouse.down()
  await page.mouse.move(ate.x, ate.y, { steps: passos })
  await page.waitForTimeout(PAUSA_ANTES_DE_SOLTAR_MS)
  await page.mouse.up()
  await page.waitForTimeout(PINTURA_MS)
}

/** Onde está o token do jogador e qual é a régua mundo→tela, tudo lido da foto dele. */
async function olhar(page: Page, painel: Retangulo): Promise<{ regua: Regua; token: Ponto }> {
  const lido = await lerTela(page, await fotografar(page), painel)
  if (lido.token === null) throw new Error('o token azul do jogador não está desenhado na tela dele')
  return { regua: reguaDe(lido.moldura), token: { x: lido.token.x, y: lido.token.y } }
}

/** O jogador arrasta o PRÓPRIO token até o destino; a tela dele confirma que o token chegou. */
async function andarAte(page: Page, painel: Retangulo, destino: Ponto, onde: string): Promise<void> {
  const box = await caixaDoCanvas(page)
  const antes = await olhar(page, painel)
  const alvo = paraTela(antes.regua, destino)
  await arrastar(page, { x: box.x + antes.token.x, y: box.y + antes.token.y }, { x: box.x + alvo.x, y: box.y + alvo.y })
  await expect
    .poll(
      async () => {
        const agora = await olhar(page, painel)
        const mira = paraTela(agora.regua, destino)
        return Math.round(Math.hypot(agora.token.x - mira.x, agora.token.y - mira.y))
      },
      { timeout: 20_000, message: `o token do jogador não chegou em ${onde} pelo arrasto` },
    )
    .toBeLessThan(12)
  await page.waitForTimeout(PINTURA_MS)
}

type EventoTauri = { event: string; id: number; payload: unknown }
type HandlerTauri = (evento: EventoTauri) => void
type JanelaDoMestre = {
  isTauri: boolean
  __emitTauri: (event: string, payload: unknown) => void
  __jornadaNetSend: (payload: { clientId: string; msg: unknown }) => void
  __TAURI_INTERNALS__: {
    invoke: (cmd: string, args?: unknown, options?: { headers?: Record<string, string> }) => Promise<unknown>
    transformCallback: (cb: HandlerTauri) => number
  }
}

/**
 * Transporte do mestre (`net_*` / `net:*`) falsificado por cima do stub de
 * Tauri, como em `task-jornada-entrada-jogador.spec.ts` e
 * `task-jornada-visao-sala-inteira.spec.ts`. O que corre por dentro — sessão do
 * mestre, recorte de névoa, memória do jogador — é o código de produção; só o
 * cano entre as duas abas é do teste.
 */
async function mestreNoTauri(page: Page, aoEnviar: (msg: unknown) => void): Promise<void> {
  await installTauriFsStub(page)
  await page.exposeFunction('__jornadaNetSend', (payload: { clientId: string; msg: unknown }) => aoEnviar(payload.msg))
  await page.addInitScript((codigo: string) => {
    const alvo = window as unknown as JanelaDoMestre
    const internals = alvo.__TAURI_INTERNALS__
    const base = internals.invoke.bind(internals)
    const callbacks = new Map<number, HandlerTauri>()
    const ouvintes = new Map<number, { event: string; handler: HandlerTauri }>()
    let proximoId = 1
    alvo.isTauri = true // sem isto o App fica no modo navegador, sem as abas Mapa | Jogo
    alvo.__emitTauri = (event, payload) => {
      for (const [id, ouvinte] of ouvintes) if (ouvinte.event === event) ouvinte.handler({ event, id, payload })
    }
    internals.transformCallback = (cb: HandlerTauri) => {
      const id = proximoId
      proximoId += 1
      callbacks.set(id, cb)
      return id
    }
    internals.invoke = async (cmd, args, options) => {
      const a = (args ?? {}) as Record<string, unknown>
      switch (cmd) {
        case 'net_start_room':
          return { code: codigo, urls: ['http://192.168.0.7:1420/player.html'], qrSvg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>' }
        case 'net_send':
          alvo.__jornadaNetSend({ clientId: String(a.clientId), msg: a.msg })
          return null
        case 'net_kick':
        case 'net_stop_room':
          return null
        case 'plugin:event|listen': {
          const id = Number(a.handler)
          const cb = callbacks.get(id)
          if (cb) ouvintes.set(id, { event: String(a.event), handler: cb })
          return id
        }
        case 'plugin:event|unlisten':
          ouvintes.delete(Number(a.eventId))
          return null
        default:
          return base(cmd, args, options)
      }
    }
  }, CODE)
}

async function ferramenta(page: Page, label: string): Promise<void> {
  await page.getByRole('button', { name: label, exact: true }).click()
}

function botaoDeSelecao(page: Page) {
  return page.getByRole('button', { name: /Apagar|Nada selecionado/ })
}

/**
 * O interruptor VISÍVEL do painel (`components/Toggle.tsx`), pelo rótulo que a
 * pessoa lê. A caixinha `<input>` de verdade é 1x1 px, `opacity: 0` e
 * `pointer-events: none` (main.css:433-440): quem recebe o clique é o trilho,
 * então é nele que o ponteiro bate — mesmo padrão de
 * `task-jornada-previa-honesta.spec.ts:168` e `task-portao-estilo-minimapa.spec.ts:90`.
 */
function interruptor(page: Page, rotulo: string) {
  return page.locator('label.lb-switch').filter({ hasText: rotulo })
}

/** A caixinha por trás do interruptor — só para LER ligado/desligado. */
function estadoDo(page: Page, rotulo: string) {
  return interruptor(page, rotulo).locator('input')
}

/** Clique de ponteiro no trilho, que é onde a pessoa clica. */
async function clicarInterruptor(page: Page, rotulo: string): Promise<void> {
  await interruptor(page, rotulo).locator('.lb-switch__track').click()
  await page.waitForTimeout(PINTURA_MS)
}

const noCanvas = (box: { x: number; y: number }, p: Ponto): Ponto => ({ x: box.x + p.x, y: box.y + p.y })

/**
 * O mestre monta a construção: Sala, vão de entrada e mobília magenta dentro.
 * Tudo por gesto de ponteiro e pelos controles do painel; devolve a caixa do
 * canvas do editor, que com a câmera 1:1 do mapa novo é o próprio mundo.
 */
async function construirACasa(page: Page) {
  const box = await caixaDoCanvas(page)

  // 1. A Sala, arrastando. O app pede o nome sobre o canvas; Enter grava o que ele sugeriu.
  await ferramenta(page, 'Sala')
  await arrastar(page, noCanvas(box, { x: SALA.x0, y: SALA.y0 }), noCanvas(box, { x: SALA.x1, y: SALA.y1 }))
  await page.keyboard.press('Enter')
  await page.keyboard.press('Escape')

  // 2. O vão: a borracha tira a parede de baixo com um clique em cima dela. Sem
  //    isso o jogador não entra — e, mais importante, a parede esconderia o
  //    interior sozinha e o teto não estaria provando nada.
  await ferramenta(page, 'Borracha')
  await page.mouse.click(box.x + VAO.x, box.y + VAO.y)
  await ferramenta(page, 'Selecionar')
  await page.mouse.click(box.x + VAO.x, box.y + VAO.y)
  await expect(botaoDeSelecao(page), 'a borracha tinha de ter tirado a parede de baixo da Sala').not.toHaveText(
    'Apagar parede selecionada',
  )
  await page.keyboard.press('Escape')

  // 3. A mobília: retângulo MAGENTA OPACO dentro da Sala, pelos controles do painel.
  await pickTool(page, 'Retângulo')
  await page.locator('#lb-draw-color').fill('#ff00ff')
  await clicarInterruptor(page, 'Preenchido')
  await expect(estadoDo(page, 'Preenchido'), 'o mestre não conseguiu ligar o preenchimento da forma').toBeChecked()
  const opacidade = page.locator('#lb-draw-fillalpha')
  await opacidade.click()
  await opacidade.press('End')
  await expect(opacidade, 'o mestre não conseguiu deixar a mobília opaca').toHaveValue('1')
  await arrastar(page, noCanvas(box, { x: MOBILIA.x0, y: MOBILIA.y0 }), noCanvas(box, { x: MOBILIA.x1, y: MOBILIA.y1 }))
  await page.keyboard.press('Escape')

  return box
}

/** Abre o painel da Sala clicando dentro dela, longe da mobília e das paredes. */
async function abrirOPainelDaSala(page: Page, box: { x: number; y: number }): Promise<void> {
  await ferramenta(page, 'Selecionar')
  await page.mouse.click(box.x + PONTO_DA_SALA.x, box.y + PONTO_DA_SALA.y)
  await expect(page.locator('#lb-room-name'), 'o clique dentro da construção tinha de abrir o painel da Sala').toBeVisible()
}

function interruptorDoTeto(page: Page) {
  return interruptor(page, ROTULO_DO_TETO)
}

/**
 * Liga o teto, e é aqui que a feature nasce ou não existe.
 *
 * A checagem é `soft` DE PROPÓSITO nas duas jornadas longas: com ela dura, o
 * teste morreria neste ponto e a rodada de hoje não mostraria NENHUM dos
 * números que provam o vazamento (o interior aparecendo de fora, a mobília
 * sobrevivendo na memória). Soft, a jornada corre inteira, imprime os quatro
 * vermelhos de uma vez e continua reprovando no fim — `expect.soft` reprova o
 * teste. O clique só acontece quando o interruptor está na tela; quando a
 * feature existir, ele sempre estará, e o gesto é o mesmo de qualquer pessoa.
 * A versão DURA deste mesmo contrato é o primeiro teste deste arquivo.
 */
async function ligarOTeto(page: Page): Promise<void> {
  await expect
    .soft(interruptorDoTeto(page), `o painel da Sala não tem o interruptor "${ROTULO_DO_TETO}" — a construção não tem teto`)
    .toHaveCount(1)
  if ((await interruptorDoTeto(page).count()) === 0) return
  await clicarInterruptor(page, ROTULO_DO_TETO)
  await expect.soft(estadoDo(page, ROTULO_DO_TETO), 'o interruptor do teto não ficou ligado').toBeChecked()
}

// ---------------------------------------------------------------------------
// 1. O MESTRE LIGA O TETO. Jornada curta, DURA e só no editor: se o interruptor
//    não existe, não há o que medir nas outras duas.
// ---------------------------------------------------------------------------
test('o mestre liga "Teto fechado para jogadores" numa Sala e o interruptor fica ligado', async ({ page }) => {
  test.setTimeout(120_000)

  await enterEditor(page)
  const box = await construirACasa(page)
  await abrirOPainelDaSala(page, box)

  // O painel aberto é mesmo o da Sala: o irmão que já existe está na tela.
  await expect(interruptor(page, ROTULO_IRMAO)).toBeVisible()

  // A DOR. Hoje o painel da Sala tem UM interruptor só.
  await expect(
    interruptorDoTeto(page),
    `o painel da Sala não tem o interruptor "${ROTULO_DO_TETO}", irmão de "${ROTULO_IRMAO}" — a Sala não tem teto para ligar`,
  ).toHaveCount(1)
  await expect(interruptorDoTeto(page), `o interruptor "${ROTULO_DO_TETO}" não está na tela do mestre`).toBeVisible()

  // Nasce desligado: uma construção sem teto é o que o app sempre fez.
  await expect(estadoDo(page, ROTULO_DO_TETO), 'o teto não pode nascer ligado: mapa antigo ficaria fechado sozinho').not.toBeChecked()

  await clicarInterruptor(page, ROTULO_DO_TETO)
  await expect(estadoDo(page, ROTULO_DO_TETO), 'o clique não ligou o teto').toBeChecked()

  // E fica ligado: o mestre tira a seleção, clica de novo na Sala e o interruptor
  // continua lá. Sem isto, "ligou" seria só um estado de componente que some.
  await page.keyboard.press('Escape')
  await abrirOPainelDaSala(page, box)
  await expect(estadoDo(page, ROTULO_DO_TETO), 'o teto desligou sozinho ao reabrir o painel da Sala').toBeChecked()

  // "Oculto para jogadores" é OUTRA coisa, e as duas convivem: o teto ligado não
  // pode ter escondido a Sala inteira do editor nem trocado o irmão de lugar.
  await expect(interruptor(page, ROTULO_IRMAO)).toBeVisible()
  await expect(estadoDo(page, ROTULO_IRMAO), 'ligar o teto mexeu no interruptor do nome').toBeChecked()

  await page.screenshot({ path: `${test.info().project.outputDir}/teto-de-construcao/1-painel-da-sala.png` })
})

// ---------------------------------------------------------------------------
// 2. A JORNADA DO JOGADOR: de fora só a silhueta; entrou, o teto abriu; saiu, fechou.
// ---------------------------------------------------------------------------
test('com o teto ligado, o jogador vê a silhueta da construção e não o que está dentro; entrar abre o teto e sair fecha', async ({
  page,
  context,
}) => {
  // Duas abas com Pixi/WebGL, mapa 1920x1280 e leitura de foto pixel a pixel.
  test.setTimeout(240_000)
  // Só a página do JOGADOR: é a tela medida. Exceção do lado do mestre vem do
  // cano falso de Tauri deste teste (unlisten), não do app.
  const errosDoJogador: string[] = []
  const fotos = `${test.info().project.outputDir}/teto-de-construcao`

  let socket: WebSocketRoute | null = null
  await mestreNoTauri(page, (msg) => {
    if (socket !== null) socket.send(JSON.stringify(msg))
  })
  await enterEditor(page)

  const box = await construirACasa(page)
  await abrirOPainelDaSala(page, box)
  await ligarOTeto(page)
  await page.keyboard.press('Escape')
  await page.screenshot({ path: `${fotos}/2-mapa-do-mestre.png` })

  // O token do jogador, criado pelo painel Seleção, nasce no centro da área
  // visível — abaixo da construção, do lado de fora dela.
  await page.getByRole('button', { name: 'Adicionar token' }).click()
  await page.getByLabel('Nome do novo token').fill('Heroi')
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Apagar token selecionado' })).toBeVisible()

  // O mestre abre a sala.
  await page.getByRole('tab', { name: 'Jogo' }).click()
  await page.getByRole('button', { name: 'Abrir sala' }).click()
  await expect(page.getByText(CODE)).toBeVisible()

  // O jogador entra pela página dele, em outra aba.
  const playerPage = await context.newPage()
  playerPage.on('pageerror', (e) => errosDoJogador.push(e.message))
  await playerPage.setViewportSize(VIEW)
  await playerPage.routeWebSocket(
    (url) => url.pathname === '/ws',
    (ws) => {
      socket = ws
      page
        .evaluate(() => (window as unknown as JanelaDoMestre).__emitTauri('net:peer', { clientId: '7', event: 'connected', name: 'Ana' }))
        .catch(() => {})
      ws.onMessage((raw) => {
        const texto = typeof raw === 'string' ? raw : raw.toString('utf8')
        page
          .evaluate(
            (t: string) => (window as unknown as JanelaDoMestre).__emitTauri('net:message', { clientId: '7', msg: JSON.parse(t) }),
            texto,
          )
          .catch(() => {})
      })
    },
  )
  await playerPage.goto('/player.html')
  await playerPage.getByLabel('Código da sala').fill(CODE)
  await playerPage.getByLabel('Seu nome').fill('Ana')
  await playerPage.getByRole('button', { name: 'Entrar' }).click()
  await expect(playerPage.getByRole('status')).toHaveText(/Aguardando o mestre/)

  // O mestre encolhe a lanterna do jogador para 250 px pelo controle que existe
  // na tela dele e SÓ ENTÃO entrega o personagem: assim nenhum quadro é visto
  // com o raio de fábrica (700 px), que ilumina a construção inteira de fora e
  // faria a medida da silhueta devolver 100% sem teto nenhum.
  const raio = page.getByLabel('Raio de visão')
  await raio.click()
  await raio.press('Home')
  for (let passo = 0; passo < 4; passo += 1) await raio.press('ArrowRight')
  await expect(page.getByText(`${RAIO} px`), 'o mestre não conseguiu deixar a lanterna do jogador em 250 px').toBeVisible()

  // O mestre entrega o personagem.
  await page.getByRole('button', { name: /Heroi/ }).click({ timeout: 10_000 })
  await expect(playerPage.locator('canvas')).toBeVisible({ timeout: 15_000 })

  // O jogador desliga os nomes no painel dele: rótulo branco dentro da
  // construção mancharia a conta de pixel desenhado.
  await playerPage.getByLabel('Nomes').uncheck()
  await expect(playerPage.getByLabel('Nomes')).not.toBeChecked()
  await playerPage.waitForTimeout(PINTURA_MS)
  const painel = await caixaDoPainel(playerPage)

  // -------------------------------------------------------------------------
  // MOMENTO A — token FORA, com o vão aberto bem na frente dele.
  // -------------------------------------------------------------------------
  await andarAte(playerPage, painel, FORA, 'o campo em frente à construção')
  const daRua = await olhar(playerPage, painel)
  const recorteInterior = recorteNaTela(daRua.regua, INTERIOR)
  const recorteEscuro = recorteNaTela(daRua.regua, NUNCA_VISTO)
  // Controle positivo (d): interface flutuante não pode entrar em recorte nenhum.
  for (const [nome, recorte] of [
    ['interior da construção', recorteInterior],
    ['canto nunca visto', recorteEscuro],
  ] as const) {
    expect(cruza(recorte, painel), `o recorte do ${nome} encosta no painel do jogador: a conta contaria pixel de interface`).toBe(false)
  }
  const [deFora, escuro] = await medir(playerPage, await fotografar(playerPage), [recorteInterior, recorteEscuro])
  await playerPage.screenshot({ path: `${fotos}/3-jogador-de-fora.png` })

  // Controle positivo (c): com o teto LIGADO, o mestre continua vendo a mobília.
  const [noMestre] = await medir(page, await fotografar(page), [INTERIOR])
  await page.screenshot({ path: `${fotos}/4-mestre-com-teto-ligado.png` })

  // -------------------------------------------------------------------------
  // MOMENTO B — o jogador entra: o teto abre.
  // -------------------------------------------------------------------------
  await andarAte(playerPage, painel, DENTRO, 'dentro da construção')
  const [deDentro] = await medir(playerPage, await fotografar(playerPage), [recorteInterior])
  await playerPage.screenshot({ path: `${fotos}/5-jogador-de-dentro.png` })

  // -------------------------------------------------------------------------
  // MOMENTO C — ele tira o token: o teto fecha de novo.
  // -------------------------------------------------------------------------
  await andarAte(playerPage, painel, FORA, 'de volta ao campo, fora da construção')
  const [deVolta] = await medir(playerPage, await fotografar(playerPage), [recorteInterior])
  await playerPage.screenshot({ path: `${fotos}/6-jogador-saiu.png` })

  const pct = (n: number) => `${(n * 100).toFixed(1)}%`
  const regua =
    `de fora: aceso ${pct(deFora.aceso)}, mobília ${pct(deFora.marca)} | ` +
    `de dentro: mobília ${pct(deDentro.marca)} | ` +
    `depois de sair: aceso ${pct(deVolta.aceso)}, mobília ${pct(deVolta.marca)} | ` +
    `canto nunca visto: aceso ${pct(escuro.aceso)} | mestre: mobília ${pct(noMestre.marca)}`

  // Controle positivo (a): onde ninguém pisou, a régua devolve ~0.
  expect(Number(escuro.aceso.toFixed(3)), `controle: canto nunca visitado tinha de estar apagado — ${regua}`).toBeLessThan(0.02)
  // Controle positivo (b): a mobília TEM de aparecer com o token dentro. Sem
  // este piso, uma tela que não desenha nada passaria em todos os tetos.
  expect
    .soft(
      Number(deDentro.marca.toFixed(3)),
      `o teto não abriu: com o token DENTRO da construção o jogador continua sem ver a mobília — ${regua}`,
    )
    .toBeGreaterThan(PISO_DE_MOBILIA)
  // Controle positivo (c): o mestre vê a mobília o tempo todo, com o teto ligado.
  expect
    .soft(Number(noMestre.marca.toFixed(3)), `o teto apagou a mobília na tela do MESTRE — ele tem de ver tudo, sempre — ${regua}`)
    .toBeGreaterThan(PISO_DE_MOBILIA)

  // A DOR 1 — de fora, o jogador tem de ver a CONSTRUÇÃO: o polígono inteiro
  // pintado. Hoje ele vê névoa onde a visão não chega e um pedaço de chão onde
  // chega; construção nenhuma.
  expect
    .soft(
      Number(deFora.aceso.toFixed(3)),
      `com o token FORA, a construção não aparece inteira na tela do jogador: só ${pct(deFora.aceso)} do polígono está pintado — ${regua}`,
    )
    .toBeGreaterThan(PISO_DE_SILHUETA)

  // A DOR 2 — e ele NÃO pode ver o que está dentro, mesmo com o vão de frente
  // para ele. Hoje a mobília vaza pelo vão.
  expect
    .soft(
      Number(deFora.marca.toFixed(3)),
      `o teto vazou: com o token FORA, a mobília de dentro da construção aparece na tela do jogador — ${regua}`,
    )
    .toBeLessThan(TETO_DE_MOBILIA)

  // A DOR 3 — ele saiu, o teto fecha: a mobília some, inclusive a que ele já
  // tinha visto. Hoje ela fica na memória do jogador para sempre
  // (`isShapeKnown` = visível OU explorado, lib/fogFilter.ts).
  expect
    .soft(
      Number(deVolta.marca.toFixed(3)),
      `o teto não fechou: depois de SAIR, a mobília continua na tela do jogador (memória do explorado) — ${regua}`,
    )
    .toBeLessThan(TETO_DE_MOBILIA)

  // E a silhueta volta a cobrir o polígono inteiro.
  expect
    .soft(
      Number(deVolta.aceso.toFixed(3)),
      `depois de sair, a construção não voltou a aparecer inteira: ${pct(deVolta.aceso)} do polígono pintado — ${regua}`,
    )
    .toBeGreaterThan(PISO_DE_SILHUETA)

  expect(errosDoJogador, 'exceção na página do jogador derruba o render e falsifica a foto').toEqual([])
})

// ---------------------------------------------------------------------------
// 3. O MESTRE VÊ TUDO, SEMPRE. Jornada curta e só no editor: o teto é promessa
//    feita ao jogador, nunca cegueira imposta a quem conduz a mesa.
// ---------------------------------------------------------------------------
test('com o teto ligado, o mestre continua vendo o que está dentro da construção', async ({ page }) => {
  test.setTimeout(120_000)
  const fotos = `${test.info().project.outputDir}/teto-de-construcao`

  await enterEditor(page)
  const box = await construirACasa(page)

  // Antes: a mobília está na tela do mestre. É a régua contra a qual o depois
  // é medido — e a prova de que o retângulo magenta existe mesmo no mapa.
  const [antes] = await medir(page, await fotografar(page), [INTERIOR])
  await page.screenshot({ path: `${fotos}/7-mestre-sem-teto.png` })

  await abrirOPainelDaSala(page, box)
  await ligarOTeto(page)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(PINTURA_MS)

  const [depois] = await medir(page, await fotografar(page), [INTERIOR])
  await page.screenshot({ path: `${fotos}/8-mestre-com-teto.png` })

  const pct = (n: number) => `${(n * 100).toFixed(1)}%`
  const regua = `mestre antes do teto: mobília ${pct(antes.marca)} | depois do teto: mobília ${pct(depois.marca)}`

  // Controle positivo: sem o teto, a mobília está lá. Sem isto, "continua
  // vendo" seria medido contra uma tela que nunca teve nada.
  expect(Number(antes.marca.toFixed(3)), `controle: a mobília magenta nem apareceu na tela do mestre — ${regua}`).toBeGreaterThan(
    PISO_DE_MOBILIA,
  )

  // A DOR — ligar o teto não pode tirar NADA da tela de quem conduz a mesa.
  expect(
    Number((antes.marca - depois.marca).toFixed(3)),
    `ligar o teto escondeu a mobília do MESTRE: ele via ${pct(antes.marca)} do recorte e passou a ver ${pct(depois.marca)} — ${regua}`,
  ).toBeLessThan(0.02)
})

// ---------------------------------------------------------------------------
// 4. O CONTROLE POSITIVO DO ARQUIVO INTEIRO — e a regressão que a feature não
//    pode quebrar: Sala SEM teto continua entregando o interior ao jogador.
//
//    Esta é a única jornada VERDE do arquivo, e é de propósito. As três de cima
//    medem magenta na tela do jogador para dizer "o interior vazou" ou "o
//    interior sumiu". Se a régua de magenta simplesmente não soubesse achar um
//    desenho na tela do jogador, as três ficariam verdes no dia em que a
//    feature escondesse TUDO — inclusive o que ela não devia esconder. Aqui a
//    mesma régua, na mesma tela, com o MESMO desenho, tem de ACHAR.
//
//    E é o contrato de compatibilidade escrito como teste: `RoomMeta.roof` nasce
//    opcional, `undefined === false`, então a Sala de todo mapa que já existe
//    continua aberta. No dia em que o campo entrar, esta jornada tem de
//    continuar verde sem uma linha de migração.
//
//    Aqui não há nem stub de Tauri nem editor: o mapa vem do protocolo real,
//    servido pela sessão de produção do mestre (`src/net/hostSession.ts`) atrás
//    de `page.routeWebSocket`, como em `task-player-map.spec.ts` e
//    `task-jornada-luz-que-para-na-parede.spec.ts`. O recorte de névoa é o de
//    produção; a tela é a de produção.
// ---------------------------------------------------------------------------
const CLIENTE = 'c1'
const MEU_TOKEN = { id: 'tok-eu', x: DENTRO.x, y: DENTRO.y }

function salaComMobilia(): MapData {
  const sala: Region = {
    id: 'sala-casa',
    points: [
      { x: SALA.x0, y: SALA.y0 },
      { x: SALA.x1, y: SALA.y0 },
      { x: SALA.x1, y: SALA.y1 },
      { x: SALA.x0, y: SALA.y1 },
    ],
    tag: '',
    fillColor: '#a98276',
    fillPattern: 'solid',
    data: {},
    // Sala DE VERDADE (`room` definido) e SEM teto: é este o mapa de hoje, e o
    // que todo mapa já salvo vai continuar sendo depois da feature.
    room: { shape: 'rect', name: 'Casa' },
  }
  const mobilia: Drawing = {
    id: 'des-mobilia',
    kind: 'rect',
    x: MOBILIA.x0,
    y: MOBILIA.y0,
    w: MOBILIA.x1 - MOBILIA.x0,
    h: MOBILIA.y1 - MOBILIA.y0,
    color: '#ff00ff',
    width: 4,
    filled: true,
    fillAlpha: 1,
  }
  const token: Token = { id: MEU_TOKEN.id, characterId: null, name: 'Ana', x: MEU_TOKEN.x, y: MEU_TOKEN.y, size: 1, image: null }
  return { ...createEmptyMap('m-teto', 'Casa sem teto', 30, 20, 64), regions: [sala], drawings: [mobilia], tokens: [token] }
}

test('controle: uma Sala SEM teto continua entregando o interior dela ao jogador', async ({ page }) => {
  // Visão por software com vários workers: mesma folga de task-player-map.
  test.setTimeout(120_000)

  const mapa = salaComMobilia()
  const sessao = createHostSession({
    code: CODE,
    // O mesmo raio curto das outras jornadas: com a lanterna de fábrica o mapa
    // inteiro acende e a moldura (fundo #111111 contra névoa preta) some da
    // foto — sem moldura não há régua mundo->tela.
    visionRadius: RAIO,
    randomId: (() => {
      let n = 0
      return () => `id-${++n}`
    })(),
  })
  let idDoJogador: string | null = null
  let socket: WebSocketRoute | null = null
  const errosDePagina: string[] = []
  page.on('pageerror', (erro) => errosDePagina.push(erro.message))

  const despachar = (saida: { clientId: string; msg: HostMessage }[]) => {
    for (const { clientId, msg } of saida) {
      if (clientId !== CLIENTE || socket === null) continue
      socket.send(JSON.stringify(msg))
      if (msg.type === 'welcome') idDoJogador = msg.playerId
    }
  }

  await page.routeWebSocket(
    (url) => url.pathname === '/ws',
    (ws) => {
      socket = ws
      ws.onMessage((cru) => {
        const texto = typeof cru === 'string' ? cru : cru.toString('utf8')
        despachar(sessao.handleMessage(CLIENTE, texto, mapa).outbound)
      })
    },
  )

  // O GESTO: entrar na sala como qualquer jogador entra.
  await page.goto('/player.html')
  await page.getByLabel('Código da sala').fill(CODE)
  await page.getByLabel('Seu nome').fill('Ana')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('status')).toHaveText(/Aguardando o mestre/)
  if (idDoJogador === null) throw new Error('o mestre não mandou welcome')

  sessao.assignToken(idDoJogador, MEU_TOKEN.id)
  despachar(sessao.broadcast(mapa).outbound)
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15_000 })

  // Grade e nomes desligados pelo painel, com clique de verdade: linha de grade
  // e rótulo branco entrariam nos recortes e sujariam a conta.
  await page.getByLabel('Grade').uncheck()
  await page.getByLabel('Nomes').uncheck()
  await expect(page.getByLabel('Nomes')).not.toBeChecked()
  await page.waitForTimeout(PINTURA_MS)

  const painel = await caixaDoPainel(page)
  const visto = await olhar(page, painel)
  const recorteInterior = recorteNaTela(visto.regua, INTERIOR)
  const recorteEscuro = recorteNaTela(visto.regua, NUNCA_VISTO)
  expect(
    cruza(recorteInterior, painel),
    'o recorte do interior encosta no painel do jogador: a conta contaria pixel de interface',
  ).toBe(false)

  const [dentro, escuro] = await medir(page, await fotografar(page), [recorteInterior, recorteEscuro])
  await page.screenshot({ path: `${test.info().project.outputDir}/teto-de-construcao/9-sala-sem-teto.png` })

  const pct = (n: number) => `${(n * 100).toFixed(1)}%`
  const regua = `interior: aceso ${pct(dentro.aceso)}, mobília ${pct(dentro.marca)} | canto nunca visto: aceso ${pct(escuro.aceso)}`

  // A régua sabe achar magenta na tela do JOGADOR, pelo caminho de produção.
  expect(
    Number(dentro.marca.toFixed(3)),
    `a régua de magenta não achou a mobília na tela do jogador numa Sala SEM teto — se ela é cega aqui, os tetos das outras jornadas não valem nada — ${regua}`,
  ).toBeGreaterThan(PISO_DE_MOBILIA)

  // E a régua não pinta o mapa inteiro de "conhecido": onde ninguém pisou continua apagado.
  expect(Number(escuro.aceso.toFixed(3)), `controle: canto nunca visitado tinha de estar apagado — ${regua}`).toBeLessThan(0.02)

  expect(errosDePagina, 'exceção na página do jogador derruba o render e falsifica a foto').toEqual([])
})
