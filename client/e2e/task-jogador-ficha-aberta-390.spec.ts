// A FICHA DE PERSONAGEM ABERTA NO CELULAR (fatia 19b do design consolidado).
//
// A fatia 19b pôs a ficha de personagem do jogador no papel do grimório, e
// ninguém a tinha visto aberta no celular. O QUE PROVA, no Chromium de
// verdade, a 390 x 844 com toque, com uma ficha de sistema (One Piece) ligada
// à ficha do jogador no mapa:
// 1. O atalho "Ficha" da faixa de couro abre a ficha de personagem dela, com
//    o nome do personagem como nome do diálogo.
// 2. Nada rola de lado: nem a página, nem o miolo da ficha, e nenhum pedaço
//    dela passa da borda da tela.
// 3. O topo e o fundo ficam à vista: o cabeçalho (com o "Fechar", que é o que
//    o dedo acerta no meio dele) dentro da tela, e o fim do miolo alcançável
//    rolando, dentro da tela também.
// 4. O "Fechar" fecha, e a faixa volta.
// As fotos (a folha do Painel, no mesmo estado do print do protótipo
// `docs/design/consolidado/provas/jogador-390.png`, e a ficha aberta) ficam
// na pasta do teste: são a prova para quem compara lado a lado.
//
// COMO: `player.html` inteiro, com o host feito pelo próprio teste no
// WebSocket roteado (como task-hud-do-jogador-sem-sobreposicao.spec.ts).
import { test, expect, type Page, type WebSocketRoute } from '@playwright/test'
import { createExploration, encodeExploration } from '../src/lib/exploration'
import { resumoDoLivro, sistemaSemLivro } from '../src/lib/livroDeRegras'
import { addToken, createEmptyMap } from '../src/lib/mapFactory'
import { novoPersonagem, type Personagem } from '../src/lib/personagem'
import { SISTEMA_ONE_PIECE } from '../src/lib/sistemaOnePiece'
import type { MapData, RegionPoint } from '../src/types/map'

const TELA = { width: 390, height: 844 }
// Escala 2, como o print do protótipo (780 x 1688): as duas fotos se comparam pixel a pixel.
test.use({ trace: 'off', video: 'off', viewport: TELA, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })

/** Meio pixel de folga nas bordas: caixas com fração de pixel. */
const FOLGA = 0.5
const LADO = 1000
const VISAO_TODA: RegionPoint[][] = [
  [
    { x: 0, y: 0 },
    { x: LADO, y: 0 },
    { x: LADO, y: LADO },
    { x: 0, y: LADO },
  ],
]

const LUFFY: Personagem = { ...novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Luffy'), id: 'pers_luffy' }

function mapaDoJogador(): MapData {
  return addToken(createEmptyMap('m1', 'Cais', 20, 20, 50), { id: 'ficha-ana', characterId: null, name: 'Ana', x: 225, y: 225, size: 1, image: null })
}

/** O host de mentira: a cada `join` responde com a sessão, a cena, o sistema da aventura e o personagem ligado à ficha dela. */
class HostDeMentira {
  ligar(ws: WebSocketRoute): void {
    const mandar = (msg: object) => ws.send(JSON.stringify(msg))
    ws.onMessage((bruto) => {
      const msg: unknown = JSON.parse(typeof bruto === 'string' ? bruto : bruto.toString('utf8'))
      if (typeof msg !== 'object' || msg === null || !('type' in msg) || msg.type !== 'join') return
      const map = mapaDoJogador()
      mandar({ type: 'welcome', playerId: 'p-ana', resumeToken: 'tok-ana', name: 'Ana' })
      mandar({ type: 'snapshot', rev: 1, map, vision: VISAO_TODA, explored: encodeExploration(createExploration(map)), ownTokens: ['ficha-ana'], concealed: [], sceneName: 'Cais do Porto' })
      // Como o host manda: o sistema sem o livro, e o resumo do livro à parte.
      mandar({ type: 'rpg.sistema', sistema: sistemaSemLivro(SISTEMA_ONE_PIECE), livro: resumoDoLivro(SISTEMA_ONE_PIECE) })
      mandar({ type: 'personagens', personagens: [LUFFY], tokens: [{ tokenId: 'ficha-ana', nome: 'Ana', personagemId: LUFFY.id }] })
    })
  }
}

async function jogadorEntra(page: Page): Promise<void> {
  const host = new HostDeMentira()
  await page.routeWebSocket(
    (url) => url.pathname === '/ws',
    (ws) => host.ligar(ws),
  )
  await page.goto('/player.html')
  await page.getByLabel('Código da sala').fill('FICHA1')
  await page.getByLabel('Seu nome').fill('Ana')
  await page.getByRole('button', { name: 'Entrar' }).tap()
  await expect(page.getByRole('group', { name: 'Zoom do mapa' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ficha de personagem' })).toBeVisible()
}

/** Mede só depois das entradas: no meio delas a caixa ainda não está no lugar. As que repetem para sempre não contam. */
async function esperarAsEntradas(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animacao) => animacao.effect?.getComputedTiming().iterations !== Number.POSITIVE_INFINITY)
        .map((animacao) => animacao.finished),
    ),
  )
}

/** A foto da tela na pasta do teste (também quando ele passa). */
async function fotografar(page: Page, nome: string): Promise<void> {
  const caminho = test.info().outputPath(`${nome}.png`)
  await page.screenshot({ path: caminho })
  await test.info().attach(nome, { path: caminho, contentType: 'image/png' })
}

interface Caixa {
  esquerda: number
  direita: number
  topo: number
  fundo: number
}

interface MedidasDaFicha {
  tela: { largura: number; altura: number }
  paginaRolaDeLado: boolean
  ficha: Caixa
  cabecalho: Caixa
  mioloRolaDeLado: boolean
  /** Pedaços da ficha (classe e caixa) que passam da borda da tela. */
  vazados: string[]
  dedoAcertaOFechar: boolean
  miolo: Caixa
  /** Depois de rolar o miolo até o fim: quanto ainda faltava rolar e o pé do conteúdo mais baixo. */
  faltaRolar: number
  peDoConteudo: number
}

/** As caixas da ficha aberta, com o miolo rolado até o fim. Só lê e rola o miolo. */
async function medirAFicha(page: Page): Promise<MedidasDaFicha> {
  return page.evaluate(() => {
    const caixa = (el: Element) => {
      const r = el.getBoundingClientRect()
      return { esquerda: r.left, direita: r.right, topo: r.top, fundo: r.bottom }
    }
    const ficha = document.querySelector('.pp-ficha')
    const cabecalho = document.querySelector('.pp-ficha__topo')
    const miolo = document.querySelector<HTMLElement>('.pp-ficha__corpo')
    const fechar = document.querySelector('.pp-ficha__fechar')
    if (ficha === null || cabecalho === null || miolo === null || fechar === null) throw new Error('a ficha aberta sem cabeçalho, miolo ou Fechar')
    const largura = window.innerWidth
    const visiveis = Array.from(ficha.querySelectorAll<HTMLElement>('*')).filter((el) => {
      const r = el.getBoundingClientRect()
      // O texto só para leitor de tela é uma caixa de 1 px recortada: não aparece.
      return r.width > 1 && r.height > 1 && getComputedStyle(el).visibility !== 'hidden'
    })
    const vazados = visiveis
      .filter((el) => {
        const r = el.getBoundingClientRect()
        return r.left < -0.5 || r.right > largura + 0.5
      })
      .map((el) => `${el.className || el.tagName} [${Math.round(el.getBoundingClientRect().left)}, ${Math.round(el.getBoundingClientRect().right)}]`)
    const f = fechar.getBoundingClientRect()
    const noMeio = document.elementFromPoint(f.left + f.width / 2, f.top + f.height / 2)
    miolo.scrollTop = miolo.scrollHeight
    const conteudo = Array.from(miolo.querySelectorAll<HTMLElement>('*')).filter((el) => el.getBoundingClientRect().height > 1)
    return {
      tela: { largura, altura: window.innerHeight },
      paginaRolaDeLado: document.documentElement.scrollWidth > largura || document.body.scrollWidth > largura,
      ficha: caixa(ficha),
      cabecalho: caixa(cabecalho),
      mioloRolaDeLado: miolo.scrollWidth > miolo.clientWidth + 0.5,
      vazados,
      dedoAcertaOFechar: noMeio !== null && fechar.contains(noMeio),
      miolo: caixa(miolo),
      faltaRolar: miolo.scrollHeight - miolo.clientHeight - miolo.scrollTop,
      peDoConteudo: Math.max(...conteudo.map((el) => el.getBoundingClientRect().bottom)),
    }
  })
}

function dentroDaTela(c: Caixa, tela: { largura: number; altura: number }): boolean {
  return c.esquerda >= -FOLGA && c.topo >= -FOLGA && c.direita <= tela.largura + FOLGA && c.fundo <= tela.altura + FOLGA
}

test('a ficha de personagem aberta cabe em 390 x 844: sem rolagem lateral, topo e fundo à vista', async ({ page }) => {
  await jogadorEntra(page)

  // A folha do Painel na aba Jogo: o mesmo estado do print do protótipo, para o lado a lado.
  await page.locator('.pp-bar > .pp-toggle').tap()
  await expect(page.getByRole('complementary', { name: 'Painel do jogador' })).toBeVisible()
  await esperarAsEntradas(page)
  await fotografar(page, 'painel-390x844')
  await page.locator('.pp-bar > .pp-toggle').tap()
  await expect(page.getByRole('complementary', { name: 'Painel do jogador' })).toBeHidden()

  await page.getByRole('button', { name: 'Ficha de personagem' }).tap()
  const dialogo = page.getByRole('dialog', { name: 'Luffy' })
  await expect(dialogo).toBeVisible()
  await expect(dialogo.getByText('Ficha de personagem · One Piece')).toBeVisible()
  await esperarAsEntradas(page)
  await fotografar(page, 'ficha-aberta-390x844')

  const m = await medirAFicha(page)
  expect(m.tela).toEqual({ largura: TELA.width, altura: TELA.height })
  expect(m.paginaRolaDeLado, 'a página rola de lado com a ficha aberta').toBe(false)
  expect(m.mioloRolaDeLado, 'o miolo da ficha rola de lado').toBe(false)
  expect(m.vazados, 'pedaços da ficha que passam da borda da tela').toEqual([])
  expect(dentroDaTela(m.ficha, m.tela), `a ficha inteira dentro da tela: ${JSON.stringify(m.ficha)}`).toBe(true)
  expect(dentroDaTela(m.cabecalho, m.tela), `o cabeçalho (topo) dentro da tela: ${JSON.stringify(m.cabecalho)}`).toBe(true)
  expect(m.dedoAcertaOFechar, 'o dedo no meio do "Fechar" acerta o "Fechar"').toBe(true)
  expect(dentroDaTela(m.miolo, m.tela), `o miolo dentro da tela: ${JSON.stringify(m.miolo)}`).toBe(true)
  expect(m.faltaRolar, 'o miolo rola até o fim').toBeLessThanOrEqual(1)
  expect(m.peDoConteudo, 'o fim do conteúdo à vista, dentro do miolo e da tela').toBeLessThanOrEqual(Math.min(m.miolo.fundo, m.tela.altura) + FOLGA)

  await dialogo.getByRole('button', { name: 'Fechar a ficha' }).tap()
  await expect(dialogo).toBeHidden()
  await expect(page.getByRole('button', { name: 'Ficha de personagem' })).toBeVisible()
})
