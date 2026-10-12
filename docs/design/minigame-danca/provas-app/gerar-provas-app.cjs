'use strict'
/**
 * Provas da TELA DA DANÇA no app (fase 3a). Não é código do app.
 *
 *   node docs/design/minigame-danca/provas-app/gerar-provas-app.cjs
 *
 * Sobe o Vite do client (desenvolvimento, porta própria), abre a vitrine
 * (client/src/minigames/danca/tela/vitrine/vitrine.html, fora do build) no Edge
 * sem janela e grava aqui: prints, folha de contato do fluxo e da porta, e
 * medidas.json (rolagem horizontal, movimento reduzido, erros de console).
 * A vitrine usa o DancaOverlay de verdade; o mestre e os colegas são de mentira.
 */
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { chromium } = require('playwright')

const SAIDA = __dirname
const CLIENT = path.resolve(SAIDA, '..', '..', '..', '..', 'client')
const VITRINE = '/src/minigames/danca/tela/vitrine/vitrine.html'
const PORTA = 14277
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms))

async function subirVite() {
  const vite = await import(pathToFileURL(require.resolve('vite', { paths: [CLIENT] })).href)
  const servidor = await vite.createServer({ root: CLIENT, configFile: path.join(CLIENT, 'vite.config.ts'), logLevel: 'error', server: { port: PORTA, strictPort: false, hmr: false } })
  await servidor.listen()
  return servidor
}

/** Mede rolagem horizontal da página e de cada área da tela da dança. */
function rolagem(page) {
  return page.evaluate(() => {
    const largas = [...document.querySelectorAll('.lb-danca, .lb-danca .dz-tela, .lb-danca .dz-coluna')].filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.className)
    return { pagina: document.documentElement.scrollWidth > innerWidth + 1, largas }
  })
}

async function folha(navegador, nome, quadros, colunas) {
  const page = await navegador.newPage({ viewport: { width: 1600, height: 900 } })
  const html = `<body style="margin:0;background:#121214;color:#eceae4;font:13px Bahnschrift,system-ui"><div style="display:grid;grid-template-columns:repeat(${colunas},1fr);gap:10px;padding:12px">${quadros
    .map((q) => `<figure style="margin:0"><img style="width:100%;display:block;border:1px solid #333" src="data:image/png;base64,${q.png.toString('base64')}"><figcaption style="padding:4px 2px">${q.rotulo}</figcaption></figure>`)
    .join('')}</div></body>`
  await page.setContent(html)
  await page.screenshot({ path: path.join(SAIDA, nome), fullPage: true })
  await page.close()
}

async function main() {
  const servidor = await subirVite()
  const url = `http://localhost:${servidor.config.server.port ?? PORTA}${VITRINE}`
  const args = ['--autoplay-policy=no-user-gesture-required']
  const navegador = await chromium.launch({ channel: 'msedge', args }).catch(() => chromium.launch({ args }))
  const R = { erros: [], rolagem: {}, movimentoReduzido: null, lotes: 0, fim: null, tempos: [] }
  const ligar = (page) => {
    page.on('console', (m) => m.type() === 'error' && R.erros.push(m.text()))
    page.on('pageerror', (e) => R.erros.push(String(e)))
  }
  try {
    // ---------------- 1440: o fluxo inteiro, com o jogador tocando por teclado
    const page = await navegador.newPage({ viewport: { width: 1440, height: 900 } })
    ligar(page)
    await page.goto(`${url}?auto=1`)
    await page.waitForSelector('.lb-danca .dz-npc')
    await espera(500)
    const fluxo = []
    let t0 = Date.now()
    const foto = async (rotulo, clip) => {
      const png = await page.screenshot(clip ? { clip } : {})
      fluxo.push({ rotulo: `${((Date.now() - t0) / 1000).toFixed(1).replace('.', ',')} s · ${rotulo}`, png })
      return png
    }
    fs.writeFileSync(path.join(SAIDA, 'convite-1440.png'), await foto('convite'))
    R.rolagem['convite-1440'] = await rolagem(page)
    await page.getByRole('button', { name: 'Estou pronto' }).click()
    await espera(300)
    await foto('pronto: esperando o mestre')
    t0 = Date.now()
    await page.evaluate(() => window.__vitrine.comecar())
    await espera(1200)
    await foto('começar: a música vem em 3 s')
    await espera(2250)
    await foto('contagem nas baquetas')
    await espera(520)
    await foto('contagem')
    await espera(6500)
    await foto('pista')
    await espera(9000)
    await foto('pista: combo alto')
    fs.writeFileSync(path.join(SAIDA, 'jogador-1440-pista.png'), fluxo.at(-1).png)
    R.rolagem['pista-1440'] = await rolagem(page)
    await page.setViewportSize({ width: 1024, height: 768 })
    await espera(300)
    R.rolagem['pista-1024'] = await rolagem(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.evaluate(() => window.__vitrine.pausar())
    await espera(400)
    await foto('o mestre pausou')
    await page.evaluate(() => window.__vitrine.retomar())
    await espera(500)
    await foto('retomada: 3, 2, 1')
    await page.waitForSelector('.dz-res-topo', { timeout: 90000 })
    await espera(300)
    await foto('fim: esperando os outros')
    await page.waitForSelector('.dz-desfecho[data-tom="bom"], .dz-desfecho[data-tom="ruim"]', { timeout: 30000 })
    // Porta: o palco a cada 0,3 s desde o desfecho (a porta começa 350 ms depois).
    const porta = []
    const tp = Date.now()
    for (let i = 0; i < 10; i += 1) {
      porta.push({ rotulo: `${((Date.now() - tp) / 1000).toFixed(1).replace('.', ',')} s`, png: await page.screenshot({ clip: { x: 0, y: 0, width: 1020, height: 900 } }) })
      await espera(240)
    }
    await foto('resultado com a porta aberta')
    fs.writeFileSync(path.join(SAIDA, 'resultado-1440.png'), fluxo.at(-1).png)
    R.rolagem['resultado-1440'] = await rolagem(page)
    await page.setViewportSize({ width: 1024, height: 768 })
    await espera(300)
    R.rolagem['resultado-1024'] = await rolagem(page)
    Object.assign(R, await page.evaluate(() => ({ lotes: window.__vitrine.lotes, fim: window.__vitrine.fim })))
    await folha(navegador, 'folha-fluxo.png', fluxo, 4)
    await folha(navegador, 'folha-porta.png', porta, 5)
    await page.close()

    // ---------------- 390: celular, pista e rolagem
    const cel = await navegador.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
    ligar(cel)
    await cel.goto(`${url}?auto=1&desfecho=0`)
    await cel.waitForSelector('.lb-danca .dz-npc')
    R.rolagem['convite-390'] = await rolagem(cel)
    await cel.getByRole('button', { name: 'Estou pronto' }).click()
    await cel.evaluate(() => window.__vitrine.comecar())
    await espera(13000)
    fs.writeFileSync(path.join(SAIDA, 'jogador-390-pista.png'), await cel.screenshot())
    R.rolagem['pista-390'] = await rolagem(cel)
    await cel.getByRole('button', { name: /Pausar/ }).click()
    await cel.getByRole('button', { name: 'Sair da dança' }).click()
    await cel.waitForSelector('.dz-res-topo')
    await cel.evaluate(() => window.__vitrine.desfecho())
    await espera(500)
    R.rolagem['resultado-390'] = await rolagem(cel)
    await cel.close()

    // ---------------- movimento reduzido: sem entrada animada da coluna
    const ctxR = await navegador.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
    const red = await ctxR.newPage()
    ligar(red)
    await red.goto(url)
    await red.waitForSelector('.lb-danca .dz-npc')
    R.movimentoReduzido = await red.evaluate(() => ({ tela: getComputedStyle(document.querySelector('.dz-tela')).animationName, raiz: getComputedStyle(document.querySelector('.lb-danca')).animationName }))
    await ctxR.close()
  } finally {
    await navegador.close()
    await servidor.close()
  }
  fs.writeFileSync(path.join(SAIDA, 'medidas.json'), `${JSON.stringify(R, null, 2)}\n`)
  console.log(JSON.stringify(R, null, 2))
}

main().catch((erro) => {
  console.error(erro)
  process.exit(1)
})
