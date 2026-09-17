// Jornada de usuário: "o mestre acendeu uma tocha no salão; eu, JOGADOR, tenho
// de VER a luz na minha tela — e ela tem de PARAR na parede, não atravessar
// para o outro lado".
//
// Hoje a jornada é VERMELHA por três motivos somados, e um só já basta:
//   1. `client/src/player/PlayerView.tsx` não importa nem chama `drawLights`:
//      a tela do jogador NUNCA desenha luz, mesmo com a luz chegando no
//      payload (`lib/fogFilter.ts:395` já a manda quando a origem é visível).
//   2. `client/src/pixi/drawLights.ts:64-96` desenha um círculo cheio com
//      gradiente e não olha parede nenhuma — quando o jogador passar a
//      desenhar a luz do mesmo jeito, ela vazará para trás da parede.
//   3. o halo de hoje é fraco demais para ler no meio do mapa (alpha 0,35 no
//      centro, caindo para 0,12 em 60% do raio).
//
// COMO A TELA É MEDIDA, sem ler nada da store do app:
//
// * A câmera sai da PRÓPRIA FOTO. O jogador desenha o token dele em
//   OWN_TOKEN_COLOR (#3b82f6) e o do companheiro em OTHER_TOKEN_COLOR
//   (#9ca3af). Achando o centro de massa de cada uma dessas cores na foto e
//   sabendo onde os dois tokens estão no mundo, sai a escala (distância na
//   tela ÷ distância no mundo) e a origem. Nenhum `camera`, `scene` ou
//   zustand é lido: o mapeamento mundo→tela vem do que está desenhado.
//
// * A prova de que esse mapeamento está certo é a PAREDE: no ponto onde a
//   conta diz que ela está, a foto tem de mostrar a faixa clara de
//   `WALL_COLOR` (#d8d2c4) sobre o fundo (#2b2b2b). Se a conta estivesse
//   errada, o ponto "atrás da parede" poderia nem estar atrás de parede
//   nenhuma, e a medida de baixo não significaria nada.
//
// * "Chegou luz aqui?" é medido em VERMELHIDÃO — `R - (G+B)/2` — porque a luz
//   da cena é vermelha pura (#ff0000) e todo o resto do fundo do mapa é
//   cinza neutro (0x2b2b2b). Para qualquer cinza neutro de valor v coberto
//   por vermelho com alpha a, a foto dá R = v + a(255-v) e G = B = v(1-a),
//   então `R - (G+B)/2 = 255·a` — a vermelhidão MEDE o alpha da luz na tela,
//   sem depender do tom do chão.
//
// GEOMETRIA (px de mundo; mapa 20x12 de grade 50 = 1000x600):
//   parede horizontal em y=300, de x=400 a x=700 (bloqueia luz e visão);
//   luz em (550,250), raio 300 — 50 px ACIMA da parede;
//   ponto LIVRE   (550,100): 150 px da luz, sem parede no caminho;
//   ponto ATRÁS   (550,400): 150 px da luz, com a parede exatamente no meio;
//   ponto ESCURO  (950,560): 506 px da luz — fora do raio, a régua do "zero".
// LIVRE e ATRÁS estão à MESMA distância da luz: a única diferença entre os
// dois é a parede. É isso que torna a comparação honesta.
//
// O token do jogador fica em (950,200) e o do companheiro em (350,560), os
// dois escolhidos para que a VISÃO alcance os três pontos contornando a ponta
// direita da parede (x=700) — senão a névoa, e não a parede, seria a razão de
// o ponto ATRÁS estar escuro, e a jornada aprovaria a feature errada.
//
// Nenhum estado é injetado: o mapa chega pelo protocolo real, servido pela
// sessão de produção (`src/net/hostSession.ts`) atrás de `page.routeWebSocket`,
// como em `task-player-map.spec.ts`. Os gestos são reais: teclado no formulário
// de entrada, ponteiro no botão "Entrar" e nas caixas "Grade" e "Nomes" do
// painel (desligadas porque linha de grade e rótulo de nome sujam a foto).
import { test, expect, type Page, type WebSocketRoute } from '@playwright/test'
import { createHostSession } from '../src/net/hostSession'
import { createEmptyMap } from '../src/lib/mapFactory'
import type { HostMessage } from '../src/net/protocol'
import type { Light, MapData, Token, Wall } from '../src/types/map'

const CODIGO = 'LUZ123'
const GRADE = 50
const CLIENTE = 'c1'

/** Cor da luz da cena: vermelho puro, que nada mais na tela do jogador usa. */
const COR_DA_LUZ = '#ff0000'
const LUZ = { x: 550, y: 250 }
const RAIO_DA_LUZ = 300

/** Mesma distância da luz que o ponto ATRÁS, porém sem parede no caminho. */
const P_LIVRE = { x: 550, y: 100 }
/** Mesma distância da luz que o ponto LIVRE, com a parede exatamente no meio. */
const P_ATRAS = { x: 550, y: 400 }
/** Fora do raio da luz: o zero da régua, medido na mesma foto. */
const P_ESCURO = { x: 950, y: 560 }
/** Meio da parede: onde a foto tem de mostrar a faixa clara, provando o mapeamento. */
const P_PAREDE = { x: 550, y: 300 }

const MEU_TOKEN = { id: 'tok-eu', x: 950, y: 200 }
const OUTRO_TOKEN = { id: 'tok-amigo', x: 350, y: 560 }

/** #3b82f6 — OWN_TOKEN_COLOR de player/PlayerView.tsx. */
const COR_TOKEN_PROPRIO: Cor = [0x3b, 0x82, 0xf6]
/** #9ca3af — OTHER_TOKEN_COLOR de player/PlayerView.tsx. */
const COR_TOKEN_ALHEIO: Cor = [0x9c, 0xa3, 0xaf]

/**
 * O painel do jogador é `position: fixed` no canto superior esquerdo, 248 px de
 * largura (player.css `.pp-panel`), e a foto do canvas o inclui. Tudo que a
 * jornada mede ou procura fica à direita desta coluna.
 */
const BORDA_DO_PAINEL_CSS = 300

/**
 * Piso de vermelhidão no ponto LIVRE, acima do ponto ESCURO da mesma foto.
 *
 * Vermelhidão = 255·alpha (ver cabeçalho). O gradiente de HOJE
 * (drawLights.ts, LIGHT_GRADIENT_STOPS: 0,35 no centro → 0,12 em 60% do raio)
 * entrega, a meio raio, alpha = 0,35 + (0,12-0,35)·(0,5/0,6) = 0,158, ou seja
 * 40 de vermelhidão — e isso no canvas do MESTRE, porque na tela do jogador
 * hoje o valor é 0: a luz não é desenhada. A bar pede 70, ~1,75x o halo atual:
 * é o "mais visível que hoje" escrito como número, não como opinião.
 */
const PISO_DE_LUZ_NO_PONTO_LIVRE = 70

/**
 * Teto de vermelhidão atrás da parede, acima do ponto ESCURO da mesma foto.
 * 15 corresponde a alpha 0,06 — o resíduo de antisserrilhado que qualquer
 * recorte por raycast deixa na borda. Um desenho que ignore a parede põe 70+
 * aqui (o mesmo valor do ponto LIVRE, que está à mesma distância da luz).
 */
const TETO_DE_LUZ_ATRAS_DA_PAREDE = 15

type Cor = [number, number, number]
/** O que `locator.screenshot()` devolve — sem @types/node no tsconfig dos e2e. */
type Foto = Awaited<ReturnType<ReturnType<Page['locator']>['screenshot']>>
interface Ponto {
  x: number
  y: number
}

function token(id: string, nome: string, x: number, y: number): Token {
  return { id, characterId: null, name: nome, x, y, size: 1, image: null }
}

function parede(): Wall {
  return { id: 'w-meio', x1: 400, y1: 300, x2: 700, y2: 300, blocksLight: true, blocksMove: true, door: null, thickness: 'thick' }
}

function luz(): Light {
  return { id: 'luz-tocha', x: LUZ.x, y: LUZ.y, radius: RAIO_DA_LUZ, color: COR_DA_LUZ, intensity: 1 }
}

function montarMapa(): MapData {
  return {
    ...createEmptyMap('m-luz', 'Tocha atrás da parede', 20, 12, GRADE),
    walls: [parede()],
    lights: [luz()],
    tokens: [token(MEU_TOKEN.id, 'Ana', MEU_TOKEN.x, MEU_TOKEN.y), token(OUTRO_TOKEN.id, 'Bia', OUTRO_TOKEN.x, OUTRO_TOKEN.y)],
  }
}

async function fotoDoCanvas(page: Page): Promise<{ foto: Foto; largura: number }> {
  const canvas = page.locator('canvas')
  const caixa = await canvas.boundingBox()
  if (!caixa) throw new Error('canvas sem bounding box')
  return { foto: await canvas.screenshot(), largura: caixa.width }
}

/**
 * Centro de massa dos pixels de uma cor na FOTO, em px CSS do canvas. Decodifica
 * o PNG com o próprio decodificador do navegador num canvas 2D descartável —
 * nada do app é lido nem tocado.
 */
async function centroDaCor(page: Page, foto: Foto, larguraCss: number, cor: Cor, tolerancia: number): Promise<{ x: number; y: number; pixels: number } | null> {
  return page.evaluate(
    async ({ b64, larguraCss, cor, tolerancia, minX }) => {
      const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob()
      const bmp = await createImageBitmap(blob)
      const canvas = document.createElement('canvas')
      canvas.width = bmp.width
      canvas.height = bmp.height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('sem contexto 2d para ler a foto')
      ctx.drawImage(bmp, 0, 0)
      const { data, width, height } = ctx.getImageData(0, 0, bmp.width, bmp.height)
      const escala = bmp.width / larguraCss
      const inicio = Math.round(minX * escala)
      let somaX = 0
      let somaY = 0
      let pixels = 0
      for (let y = 0; y < height; y += 1) {
        for (let x = inicio; x < width; x += 1) {
          const i = (y * width + x) * 4
          if (Math.abs(data[i] - cor[0]) > tolerancia) continue
          if (Math.abs(data[i + 1] - cor[1]) > tolerancia) continue
          if (Math.abs(data[i + 2] - cor[2]) > tolerancia) continue
          somaX += x
          somaY += y
          pixels += 1
        }
      }
      return pixels === 0 ? null : { x: somaX / pixels / escala, y: somaY / pixels / escala, pixels }
    },
    { b64: foto.toString('base64'), larguraCss, cor, tolerancia, minX: BORDA_DO_PAINEL_CSS },
  )
}

interface Amostra {
  /** Média de `R - (G+B)/2` numa janela de 11x11 px CSS: o alpha da luz vermelha, x255. */
  vermelhidao: number
  /** Maior distância de cor, na mesma janela, até a cor do pixel central da referência. */
  contrasteMaximo: number
  rgb: Cor
}

/** Lê a foto nos pontos de TELA pedidos. `referencia` é a cor com que o contraste é medido. */
async function amostrar(page: Page, foto: Foto, larguraCss: number, pontos: Ponto[], referencia: Cor): Promise<Amostra[]> {
  return page.evaluate(
    async ({ b64, larguraCss, pontos, referencia }) => {
      const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob()
      const bmp = await createImageBitmap(blob)
      const canvas = document.createElement('canvas')
      canvas.width = bmp.width
      canvas.height = bmp.height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('sem contexto 2d para ler a foto')
      ctx.drawImage(bmp, 0, 0)
      const { data, width, height } = ctx.getImageData(0, 0, bmp.width, bmp.height)
      const escala = bmp.width / larguraCss
      const em = (x: number, y: number): [number, number, number] => {
        const cx = Math.min(width - 1, Math.max(0, Math.round(x)))
        const cy = Math.min(height - 1, Math.max(0, Math.round(y)))
        const i = (cy * width + cx) * 4
        return [data[i], data[i + 1], data[i + 2]]
      }
      const raio = Math.max(1, Math.round(5 * escala))
      return pontos.map((p) => {
        const px = p.x * escala
        const py = p.y * escala
        let soma = 0
        let n = 0
        let contrasteMaximo = 0
        for (let dy = -raio; dy <= raio; dy += 1) {
          for (let dx = -raio; dx <= raio; dx += 1) {
            const [r, g, b] = em(px + dx, py + dy)
            soma += r - (g + b) / 2
            n += 1
            const distancia = Math.max(Math.abs(r - referencia[0]), Math.abs(g - referencia[1]), Math.abs(b - referencia[2]))
            if (distancia > contrasteMaximo) contrasteMaximo = distancia
          }
        }
        return { vermelhidao: Math.round((soma / n) * 10) / 10, contrasteMaximo, rgb: em(px, py) }
      })
    },
    { b64: foto.toString('base64'), larguraCss, pontos, referencia },
  )
}

test('o jogador vê a luz do mestre, forte, e ela para na parede em vez de atravessar', async ({ page }) => {
  // Visão por software com vários workers: mesma folga de task-player-map.
  test.setTimeout(90_000)

  const mapa = montarMapa()
  const sessao = createHostSession({
    code: CODIGO,
    visionRadius: 2000,
    randomId: (() => {
      let n = 0
      return () => `id-${++n}`
    })(),
  })
  const enviadas: HostMessage[] = []
  let idDoJogador: string | null = null
  let socket: WebSocketRoute | null = null
  const errosDePagina: string[] = []
  page.on('pageerror', (erro) => errosDePagina.push(erro.message))

  const despachar = (saida: { clientId: string; msg: HostMessage }[]) => {
    for (const { clientId, msg } of saida) {
      if (clientId !== CLIENTE || socket === null) continue
      enviadas.push(msg)
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

  // ---------------------------------------------------------------------
  // O GESTO: entrar na sala como qualquer jogador entra.
  // ---------------------------------------------------------------------
  await page.goto('/player.html')
  await page.getByLabel('Código da sala').fill(CODIGO)
  await page.getByLabel('Seu nome').fill('Ana')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('status')).toHaveText(/Aguardando o mestre/)
  if (idDoJogador === null) throw new Error('o mestre não mandou welcome')

  // O mestre entrega o personagem e manda o mapa — a luz vai junto no payload
  // (lib/fogFilter.ts:395), porque a origem dela é visível para este jogador.
  sessao.assignToken(idDoJogador, MEU_TOKEN.id)
  despachar(sessao.broadcast(mapa).outbound)

  const vista = page.locator('[data-explored-cells]')
  await expect(vista).toHaveAttribute('data-own-tokens', MEU_TOKEN.id)
  await expect(vista).toHaveAttribute('data-tokens-count', '2')
  const ultimo = [...enviadas].reverse().find((m) => m.type === 'snapshot')
  if (ultimo?.type !== 'snapshot') throw new Error('sem snapshot')
  expect(ultimo.map.lights.map((l) => l.id)).toEqual(['luz-tocha'])

  // Grade e nomes desligados pelo painel, com clique de verdade: linha de grade
  // e rótulo branco entrariam nas janelas de amostragem e mascarariam a medida.
  await page.getByLabel('Grade').uncheck()
  await page.getByLabel('Nomes').uncheck()
  await expect(page.getByLabel('Grade')).not.toBeChecked()
  await page.waitForTimeout(500) // primeiro quadro estável do Pixi

  const { foto, largura } = await fotoDoCanvas(page)
  await page.screenshot({ path: `${test.info().project.outputDir}/luz-parede/tela-do-jogador.png` })

  // ---------------------------------------------------------------------
  // CÂMERA PELA PRÓPRIA FOTO: os dois tokens são as âncoras.
  // ---------------------------------------------------------------------
  const meu = await centroDaCor(page, foto, largura, COR_TOKEN_PROPRIO, 12)
  const outro = await centroDaCor(page, foto, largura, COR_TOKEN_ALHEIO, 12)
  expect(meu?.pixels ?? 0, 'o token do jogador (azul #3b82f6) não aparece na foto da tela').toBeGreaterThan(300)
  expect(outro?.pixels ?? 0, 'o token do companheiro (cinza #9ca3af) não aparece na foto da tela').toBeGreaterThan(300)
  if (!meu || !outro) throw new Error('sem âncora de câmera')

  const distanciaMundo = Math.hypot(MEU_TOKEN.x - OUTRO_TOKEN.x, MEU_TOKEN.y - OUTRO_TOKEN.y)
  const distanciaTela = Math.hypot(meu.x - outro.x, meu.y - outro.y)
  const escala = distanciaTela / distanciaMundo
  expect(escala, `escala implausível (${escala.toFixed(3)}): as âncoras de câmera não são os dois tokens`).toBeGreaterThan(0.3)
  const origemX = (meu.x - MEU_TOKEN.x * escala + (outro.x - OUTRO_TOKEN.x * escala)) / 2
  const origemY = (meu.y - MEU_TOKEN.y * escala + (outro.y - OUTRO_TOKEN.y * escala)) / 2
  const naTela = (p: Ponto): Ponto => ({ x: origemX + p.x * escala, y: origemY + p.y * escala })

  const [naParede, escuro, livre, atras] = await amostrar(
    page,
    foto,
    largura,
    [P_PAREDE, P_ESCURO, P_LIVRE, P_ATRAS].map(naTela),
    [0x2b, 0x2b, 0x2b],
  )

  // CALIBRAÇÃO DO MAPEAMENTO. Onde a conta diz que está a parede, a foto tem de
  // mostrar a faixa clara de WALL_COLOR (#d8d2c4) sobre o fundo (#2b2b2b) — 172
  // de distância no pior canal. Sem isto, "atrás da parede" poderia ser um
  // lugar qualquer da tela, e o teto lá embaixo aprovaria qualquer coisa.
  expect(
    naParede.contrasteMaximo,
    `o mapeamento mundo→tela não bate: em (${P_PAREDE.x},${P_PAREDE.y}) não há faixa de parede na foto (escala=${escala.toFixed(3)}, tela=${JSON.stringify(naTela(P_PAREDE))})`,
  ).toBeGreaterThan(60)

  const regua = `livre=${livre.vermelhidao}, atrás=${atras.vermelhidao}, escuro=${escuro.vermelhidao} (vermelhidão = 255·alpha)`

  // ---------------------------------------------------------------------
  // A DOR 1 — a luz TEM DE APARECER na tela do jogador, e forte.
  // Este piso é também o controle positivo do teto abaixo: sem ele, uma tela
  // que simplesmente não desenha luz nenhuma (que é o app de HOJE) passaria no
  // teto "não vazou atrás da parede" sem ter provado nada.
  // ---------------------------------------------------------------------
  expect(
    livre.vermelhidao - escuro.vermelhidao,
    `a luz não chega ao jogador com força em (${P_LIVRE.x},${P_LIVRE.y}), a 150 px da tocha e sem parede no caminho — ${regua}`,
  ).toBeGreaterThan(PISO_DE_LUZ_NO_PONTO_LIVRE)

  // ---------------------------------------------------------------------
  // A DOR 2 — à MESMA distância da tocha, mas com a parede no meio, a luz não
  // pode aparecer. É o mesmo raio, a mesma tela, a mesma foto: o que muda é só
  // a parede.
  // ---------------------------------------------------------------------
  expect(
    atras.vermelhidao - escuro.vermelhidao,
    `a luz atravessou a parede: em (${P_ATRAS.x},${P_ATRAS.y}) há brilho vermelho na tela do jogador — ${regua}`,
  ).toBeLessThan(TETO_DE_LUZ_ATRAS_DA_PAREDE)

  await expect(page.locator('canvas')).toBeVisible()
  expect(errosDePagina).toEqual([])
})
