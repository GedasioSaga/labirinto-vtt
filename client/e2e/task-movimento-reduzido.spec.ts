// MOVIMENTO REDUZIDO (fatia 21 do design consolidado, 22/10/2026).
//
// Com `prefers-reduced-motion: reduce`, tudo na interface do mestre e do
// jogador troca na hora ou faz um fade de no máximo TETO_DO_FADE_MS. O spec
// varre os elementos à vista (e o ::before/::after de cada um) e falha com:
//  - transição ou animação CSS mais longa que TETO_DO_FADE_MS (o atraso não
//    conta: esperar e trocar na hora não é movimento);
//  - transform animado (transição de transform/translate/scale/rotate/all, ou
//    @keyframes que mexe em transform) com mais de 1 ms;
//  - animação do WAAPI correndo com mais de TETO_DO_FADE_MS ou com transform.
// O mestre tem uma regra global de 1 ms com !important (main.css); o jogador
// não, e cada peça dele responde por si (player.css).
//
// Exceções justificadas (fora da varredura, por escrito no PROGRESSO.md da
// fatia 21): o canvas do Pixi (não é DOM: a câmera e as portas têm o próprio
// teste de movimento reduzido) e o acordeão por grid-template-rows, que já vai
// a 0 ms no movimento reduzido e por isso nem aparece aqui.
//
// LAB_PLANTAR=1 planta uma transição de 300 ms na barra do mestre e nos botões do
// jogador: os dois testes de varredura têm de ficar VERMELHOS (prova de que
// mordem). O teste "o detector acha" faz o mesmo sempre, sem a variável.
import { test, expect, type Page, type WebSocketRoute } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import { createHostSession } from '../src/net/hostSession'
import type { HostMessage } from '../src/net/protocol'
import type { MapData } from '../src/types/map'
import { abrirPaginaDaMesa, livroDaMesa } from './helpers/colunaDireita'
import { abrirAventuraDeMentira } from './helpers/mestreDeMentira'

// O reducedMotion do test.use não chega à página neste config (medido: matchMedia dava false); emulateMedia chega.
test.use({ trace: 'off', video: 'off' })

/** O teto do fade no movimento reduzido (critério da fatia 21). */
const TETO_DO_FADE_MS = 160
const PLANTAR = process.env.LAB_PLANTAR === '1'
const PLANTA = 'transition: opacity 300ms ease !important;'
const AVENTURA = 'Calma'
const CODIGO = 'CALM01'
const PASTA = 'C:/appdata/maps/map_calma'

interface Infracao { onde: string; o_que: string; ms: number }

function disco(): Record<string, string> {
  const mapa: MapData = { ...createEmptyMap('map_calma', AVENTURA, 30, 20, 50), tokens: [{ id: 't1', characterId: null, name: 'Goblin', x: 300, y: 300, size: 1, image: null }] }
  const aventura = { version: 1, id: 'adv_calma', name: AVENTURA, startSceneId: 'scene_calma', scenes: [{ id: 'scene_calma', name: AVENTURA, file: 'map.json' }] }
  return { [`${PASTA}/map.json`]: serializeMap(mapa), [`${PASTA}/adventure.json`]: JSON.stringify(aventura, null, 2) }
}

/** A varredura, dentro da página. Devolve cada infração com o elemento, a propriedade e a duração. */
async function varrer(page: Page): Promise<Infracao[]> {
  return page.evaluate((teto) => {
    const emMs = (lista: string) => lista.split(',').map((v) => (v.trim().endsWith('ms') ? parseFloat(v) : parseFloat(v) * 1000))
    const MEXE_NA_FORMA = /^(all|transform|translate|scale|rotate)$/
    const quadrosComForma = new Set<string>()
    const visitar = (regras: CSSRuleList) => {
      for (const regra of Array.from(regras)) {
        if (regra instanceof CSSKeyframesRule) {
          if (Array.from(regra.cssRules).some((q) => /(^|;)\s*(transform|translate|scale|rotate)\s*:/.test((q as CSSKeyframeRule).style.cssText))) quadrosComForma.add(regra.name)
        } else if ('cssRules' in regra) visitar((regra as CSSGroupingRule).cssRules)
      }
    }
    for (const folha of Array.from(document.styleSheets)) {
      try {
        visitar(folha.cssRules)
      } catch {
        // Folha de outra origem: não há nenhuma no app; se houver, fica de fora.
      }
    }
    const nome = (el: Element, pseudo: string | null) => {
      const classe = typeof el.className === 'string' && el.className.trim() !== '' ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : ''
      return `${el.tagName.toLowerCase()}${classe}${pseudo ?? ''}`
    }
    const achadas: { onde: string; o_que: string; ms: number }[] = []
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      if (el.closest('canvas, svg') !== null && el.tagName.toLowerCase() !== 'svg') continue
      const caixa = el.getBoundingClientRect()
      if (caixa.width === 0 && caixa.height === 0) continue
      if (!el.checkVisibility()) continue
      for (const pseudo of [null, '::before', '::after']) {
        const cs = getComputedStyle(el, pseudo)
        if (pseudo !== null && cs.content === 'none') continue
        const props = cs.transitionProperty.split(',').map((p) => p.trim())
        const duracoes = emMs(cs.transitionDuration)
        props.forEach((prop, i) => {
          const ms = duracoes[i % duracoes.length]
          if (ms > teto) achadas.push({ onde: nome(el, pseudo), o_que: `transição de ${prop}`, ms })
          else if (ms > 1 && MEXE_NA_FORMA.test(prop)) achadas.push({ onde: nome(el, pseudo), o_que: `transform animado (${prop})`, ms })
        })
        const animacoes = cs.animationName.split(',').map((a) => a.trim())
        const duracoesA = emMs(cs.animationDuration)
        animacoes.forEach((anim, i) => {
          if (anim === 'none') return
          const ms = duracoesA[i % duracoesA.length]
          if (ms > teto) achadas.push({ onde: nome(el, pseudo), o_que: `animação ${anim}`, ms })
          else if (ms > 1 && quadrosComForma.has(anim)) achadas.push({ onde: nome(el, pseudo), o_que: `animação ${anim} com transform`, ms })
        })
      }
    }
    for (const anim of document.getAnimations()) {
      if (anim instanceof CSSTransition || anim instanceof CSSAnimation) continue
      const efeito = anim.effect as KeyframeEffect | null
      if (efeito === null) continue
      const ms = Number(efeito.getTiming().duration) || 0
      const alvo = efeito.target
      const onde = alvo === null ? 'WAAPI' : nome(alvo, efeito.pseudoElement)
      const comForma = efeito.getKeyframes().some((q) => 'transform' in q || 'translate' in q || 'scale' in q || 'rotate' in q)
      if (ms > teto) achadas.push({ onde, o_que: 'animação WAAPI', ms })
      else if (ms > 1 && comForma) achadas.push({ onde, o_que: 'animação WAAPI com transform', ms })
    }
    return achadas
  }, TETO_DO_FADE_MS)
}

async function entrarComoMestre(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await abrirAventuraDeMentira(page, disco(), AVENTURA, CODIGO)
  await expect(page.getByRole('toolbar', { name: 'Ferramentas do mapa' })).toBeVisible()
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true)
}

async function entrarComoJogador(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 390, height: 844 })
  const mapa: MapData = { ...createEmptyMap('m-calma', AVENTURA, 20, 12, 50), tokens: [{ id: 'tok-a', characterId: null, name: 'Heroi', x: 250, y: 300, size: 1, image: null }] }
  const sessao = createHostSession({ code: CODIGO, visionRadius: 2000, randomId: (() => { let n = 0; return () => `id-${++n}` })() })
  let socket: WebSocketRoute | null = null
  let jogador: string | null = null
  const enviar = (saida: { clientId: string; msg: HostMessage }[]) => {
    for (const { clientId, msg } of saida) {
      if (clientId !== 'c1' || socket === null) continue
      socket.send(JSON.stringify(msg))
      if (msg.type === 'welcome') jogador = msg.playerId
    }
  }
  await page.routeWebSocket((url) => url.pathname === '/ws', (ws) => {
    socket = ws
    ws.onMessage((raw) => enviar(sessao.handleMessage('c1', typeof raw === 'string' ? raw : raw.toString('utf8'), mapa).outbound))
  })
  await page.goto('/player.html')
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true)
  await page.getByLabel('Código da sala').fill(CODIGO)
  await page.getByLabel('Seu nome').fill('Ana')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('status')).toHaveText(/Aguardando o mestre/)
  const id: string | null = jogador
  if (id === null) throw new Error('o mestre de mentira não mandou welcome')
  sessao.assignToken(id, 'tok-a')
  enviar(sessao.broadcast(mapa).outbound)
  await expect(page.getByRole('button', { name: 'Minha ficha' })).toBeVisible()
}

/** Varre a tela no estado de agora; o nome do estado entra na mensagem. */
async function semMovimento(page: Page, estado: string): Promise<void> {
  const achadas = await varrer(page)
  expect(achadas, `${estado}: ${JSON.stringify(achadas)}`).toEqual([])
}

test('mestre a 1440: editor, ficha do token aberta, página Cenas e diálogo Configurar cena, sem movimento além do fade de 160 ms', async ({ page }) => {
  test.setTimeout(90_000)
  await entrarComoMestre(page)
  if (PLANTAR) await page.addStyleTag({ content: `.lb-toolbar { ${PLANTA} }` })
  await semMovimento(page, 'editor aberto')

  await page.evaluate(async () => {
    const store = (await import('/src/stores/mapStore.ts')).useMapStore.getState()
    store.setActiveTool('select')
    store.setSelection([{ kind: 'token', id: 't1' }])
  })
  await expect(page.getByRole('complementary', { name: 'Livro do mestre' }).getByText('Goblin').first()).toBeVisible()
  await semMovimento(page, 'ficha do token aberta')

  await abrirPaginaDaMesa(page, 'Cenas')
  await semMovimento(page, 'livro da mesa na página Cenas')

  await livroDaMesa(page).getByRole('button', { name: `Configurar ${AVENTURA}` }).click()
  await expect(page.getByRole('dialog').first()).toBeVisible()
  await semMovimento(page, 'diálogo Configurar cena')
})

test('jogador a 390: mapa e a folha Painel, sem movimento além do fade de 160 ms', async ({ page }) => {
  test.setTimeout(90_000)
  await entrarComoJogador(page)
  if (PLANTAR) await page.addStyleTag({ content: `button { ${PLANTA} }` })
  await semMovimento(page, 'jogador no mapa')

  await page.getByRole('button', { name: 'Painel' }).click()
  await expect(page.getByRole('complementary', { name: 'Painel do jogador' })).toBeVisible()
  await semMovimento(page, 'folha Painel aberta')
})

test('o detector acha a transição de 300 ms plantada, no mestre e no jogador', async ({ page, browser }) => {
  test.setTimeout(90_000)
  await entrarComoMestre(page)
  await page.addStyleTag({ content: `.lb-toolbar { ${PLANTA} }` })
  const doMestre = await varrer(page)
  expect(doMestre.some((i) => i.onde.startsWith('div.lb-toolbar') && i.ms === 300), JSON.stringify(doMestre)).toBe(true)

  const contexto = await browser.newContext()
  const jogador = await contexto.newPage()
  await entrarComoJogador(jogador)
  await jogador.addStyleTag({ content: `button { ${PLANTA} }` })
  const doJogador = await varrer(jogador)
  await contexto.close()
  expect(doJogador.some((i) => i.onde.startsWith('button') && i.ms === 300), JSON.stringify(doJogador)).toBe(true)
})
