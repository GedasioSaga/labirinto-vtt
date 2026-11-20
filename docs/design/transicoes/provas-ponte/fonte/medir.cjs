// Mede o protótipo montado (docs/design/transicoes/ponte-levadica.html) num Edge de verdade, com GPU:
// - tempo entre quadros (rAF) enquanto cada versão toca, com p50/p95/máx;
// - tarefas longas (PerformanceObserver 'longtask') desde a abertura da página, montagem incluída;
// - os controles: trocar de versão, Pular, Esc, movimento reduzido, nome do lugar;
// - 3 prints da página em provas-ponte/: a vista de dentro da passagem (claro), o vale com o nome
//   (escuro) e a fachada com o arco de perto (escuro).
// three@0.186.1 da CDN é servido do node_modules local (mesma versão), para medir sem rede.
// Rodar da raiz do repo: node docs/design/transicoes/provas-ponte/fonte/medir.cjs
'use strict'
const fs = require('fs')
const path = require('path')
const { pathToFileURL } = require('url')

const PASTA = __dirname
const RAIZ = path.resolve(PASTA, '..', '..', '..', '..', '..')
const PROVAS = path.resolve(PASTA, '..')
const PAGINA = path.resolve(PROVAS, '..', 'ponte-levadica.html')
const THREE_LOCAL = path.join(RAIZ, 'node_modules', 'three', 'build')
const CDN = 'https://cdn.jsdelivr.net/npm/three@0.186.1/build/'
const ARGS_DO_NAVEGADOR = ['--use-angle=d3d11', '--ignore-gpu-blocklist']
const DURACAO_MS = 4800
const LIMITE_TAREFA_LONGA_MS = 200

const espera = (ms) => new Promise((r) => setTimeout(r, ms))
const percentil = (xs, p) => {
  if (xs.length === 0) return null
  const o = [...xs].sort((a, b) => a - b)
  return o[Math.min(o.length - 1, Math.ceil((p / 100) * o.length) - 1)]
}
const arred = (n) => (n == null ? null : Math.round(n * 10) / 10)

async function abrir(chromium, esquema) {
  const navegador = await chromium.launch({ channel: 'msedge', headless: true, args: ARGS_DO_NAVEGADOR })
  const pagina = await navegador.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1, colorScheme: esquema })
  const erros = []
  pagina.on('pageerror', (e) => erros.push(String(e.message)))
  pagina.on('console', (m) => {
    if (m.type() === 'error') erros.push(m.text())
  })
  await pagina.route(`${CDN}**`, (rota) => {
    const arquivo = path.join(THREE_LOCAL, path.basename(new URL(rota.request().url()).pathname))
    if (!fs.existsSync(arquivo)) return rota.abort()
    return rota.fulfill({ path: arquivo, contentType: 'text/javascript; charset=utf-8' })
  })
  await pagina.addInitScript(() => {
    window.__longas = []
    new PerformanceObserver((lista) => {
      for (const e of lista.getEntries()) window.__longas.push({ inicio: e.startTime, duracao: e.duration })
    }).observe({ type: 'longtask', buffered: true })
    window.__quadros = []
    let antes = 0
    const laco = (agora) => {
      if (antes) window.__quadros.push({ t: agora, dt: agora - antes })
      antes = agora
      requestAnimationFrame(laco)
    }
    requestAnimationFrame(laco)
  })
  return { navegador, pagina, erros }
}

/** Faz a ação e espera a volta nova começar (a remontagem atrás da cortina leva um tempo). */
async function largarCom(pagina, acao) {
  const antes = await pagina.evaluate(() => performance.getEntriesByName('ponte:largada').length)
  await acao()
  await pagina.waitForFunction((n) => performance.getEntriesByName('ponte:largada').length > n, antes)
}

/** Toca uma versão do início e devolve os intervalos entre quadros só da janela em que ela tocou. */
async function tocarEMedir(pagina, versao) {
  const antes = await pagina.evaluate(() => performance.getEntriesByName('ponte:largada').length)
  const clique = await pagina.evaluate(() => performance.now())
  await pagina.click(`[data-versao="${versao}"]`)
  await pagina.waitForFunction((n) => performance.getEntriesByName('ponte:largada').length > n, antes)
  await espera(DURACAO_MS + 400)
  const { quadros, tempo, cortina, largada } = await pagina.evaluate((dur) => {
    const marcas = performance.getEntriesByName('ponte:largada')
    const largada = marcas[marcas.length - 1].startTime
    return {
      largada,
      quadros: window.__quadros.filter((q) => q.t > largada && q.t <= largada + dur).map((q) => q.dt),
      tempo: document.getElementById('tempo').textContent,
      cortina: getComputedStyle(document.getElementById('cortina')).opacity,
    }
  }, DURACAO_MS)
  return { versao, cliqueAteLargadaMs: Math.round(largada - clique), quadros: quadros.length, p50: arred(percentil(quadros, 50)), p95: arred(percentil(quadros, 95)), max: arred(Math.max(...quadros)), tempoNoFim: tempo, cortinaNoFim: Number(cortina) }
}

async function main() {
  if (!fs.existsSync(PAGINA)) throw new Error(`falta ${PAGINA}: rode montar.cjs antes`)
  const { chromium } = require(path.join(RAIZ, 'node_modules', 'playwright'))
  const url = pathToFileURL(PAGINA).href
  const resultado = { pagina: 'docs/design/transicoes/ponte-levadica.html', geradoEm: new Date().toISOString(), navegador: 'Edge headless (Playwright, channel msedge) com GPU (ANGLE d3d11)', viewport: '1280x1000, DPR 1', versoes: [], controles: {}, tarefasLongas: {}, prints: [] }

  // Tema claro: abertura (montagem + 1ª volta automática), as duas versões, e os controles.
  {
    const { navegador, pagina, erros } = await abrir(chromium, 'light')
    const t0 = Date.now()
    await pagina.goto(url, { waitUntil: 'load' })
    await pagina.waitForFunction(() => window.__quadros.length > 30)
    resultado.abrirAtePrimeirosQuadrosMs = Date.now() - t0
    await espera(DURACAO_MS)
    const webgl = await pagina.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl2')
      const ext = gl && gl.getExtension('WEBGL_debug_renderer_info')
      return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'desconhecido'
    })
    resultado.gpu = webgl
    for (const versao of ['entrando', 'saindo']) resultado.versoes.push(await tocarEMedir(pagina, versao))

    // Print 1 (claro): entrando aos ~3,9 s, com o nome.
    await largarCom(pagina, () => pagina.click('[data-versao="entrando"]'))
    await espera(3900)
    const print1 = path.join(PROVAS, 'pagina-entrando-claro.png')
    await pagina.screenshot({ path: print1, fullPage: true })
    resultado.prints.push(path.basename(print1))
    await espera(1400)

    // Pular: clique no meio da volta; a cortina fecha e o tempo diz "Pulado".
    await largarCom(pagina, () => pagina.click('[data-versao="saindo"]'))
    await espera(1500)
    const pularVisivel = await pagina.isVisible('#pular')
    await pagina.click('#pular')
    await espera(400)
    resultado.controles.pular = await pagina.evaluate((v) => ({
      visivelDuranteAVolta: v,
      escondidoDepois: document.getElementById('pular').dataset.escondido === 'true',
      cortina: Number(getComputedStyle(document.getElementById('cortina')).opacity),
      tempo: document.getElementById('tempo').textContent,
    }), pularVisivel)

    // Esc: mesma coisa pelo teclado.
    await largarCom(pagina, () => pagina.click('#repetir'))
    await espera(1200)
    await pagina.keyboard.press('Escape')
    await espera(400)
    resultado.controles.esc = await pagina.evaluate(() => ({
      cortina: Number(getComputedStyle(document.getElementById('cortina')).opacity),
      tempo: document.getElementById('tempo').textContent,
    }))

    // Nome do lugar: digitar troca o texto da versão e recomeça; vazio = sem placa (a cena continua tocando).
    await largarCom(pagina, () => pagina.fill('#nome', 'Forte da Colina'))
    await espera(900)
    resultado.controles.nome = await pagina.evaluate(() => ({ campo: document.getElementById('nome').value, tocando: document.getElementById('tempo').textContent }))
    await largarCom(pagina, () => pagina.fill('#nome', ''))
    await espera(600)
    resultado.controles.nomeVazio = await pagina.evaluate(() => document.getElementById('tempo').textContent)

    // Movimento reduzido: remonta e toca; troca de versão guarda o nome de cada uma.
    await largarCom(pagina, () => pagina.check('#reduzir'))
    await espera(1200)
    resultado.controles.movimentoReduzido = await pagina.evaluate(() => ({ marcado: document.getElementById('reduzir').checked, tempo: document.getElementById('tempo').textContent }))
    await largarCom(pagina, () => pagina.click('[data-versao="entrando"]'))
    await espera(300)
    resultado.controles.nomeGuardadoPorVersao = await pagina.evaluate(() => document.getElementById('nome').value)
    resultado.controles.telaCheia = await pagina.evaluate(() => ({ apiDisponivel: !!document.fullscreenEnabled, botaoDesligado: document.getElementById('tela-cheia').disabled }))
    await espera(DURACAO_MS)

    resultado.preparo = await pagina.evaluate(() =>
      performance.getEntriesByType('measure').filter((m) => m.name.startsWith('ponte:')).map((m) => ({ etapa: m.name.slice(6), inicioMs: Math.round(m.startTime), duracaoMs: Math.round(m.duration * 10) / 10 })),
    )
    const longas = await pagina.evaluate(() => window.__longas)
    resultado.tarefasLongas.claro = { total: longas.length, maiorMs: arred(Math.max(0, ...longas.map((l) => l.duracao))), acimaDe200ms: longas.filter((l) => l.duracao >= LIMITE_TAREFA_LONGA_MS).length, lista: longas.map((l) => ({ inicioMs: arred(l.inicio), duracaoMs: arred(l.duracao) })) }
    resultado.errosNoConsole = [...erros]
    await navegador.close()
  }

  // Tema escuro: print da saída com o nome (e as tarefas longas de mais uma abertura a frio).
  {
    const { navegador, pagina, erros } = await abrir(chromium, 'dark')
    await pagina.goto(url, { waitUntil: 'load' })
    await pagina.waitForFunction(() => window.__quadros.length > 30)
    await espera(DURACAO_MS)
    await largarCom(pagina, () => pagina.click('[data-versao="saindo"]'))
    await espera(3900)
    const print2 = path.join(PROVAS, 'pagina-saindo-escuro.png')
    await pagina.screenshot({ path: print2, fullPage: true })
    resultado.prints.push(path.basename(print2))
    await espera(1400)
    // Print 3 (escuro): entrando aos ~1,5 s, a fachada e o arco de perto.
    await largarCom(pagina, () => pagina.click('[data-versao="entrando"]'))
    await espera(1500)
    const print3 = path.join(PROVAS, 'pagina-entrando-fachada-escuro.png')
    await pagina.screenshot({ path: print3, fullPage: true })
    resultado.prints.push(path.basename(print3))
    await espera(DURACAO_MS - 1500 + 400)
    const longas = await pagina.evaluate(() => window.__longas)
    resultado.tarefasLongas.escuro = { total: longas.length, maiorMs: arred(Math.max(0, ...longas.map((l) => l.duracao))), acimaDe200ms: longas.filter((l) => l.duracao >= LIMITE_TAREFA_LONGA_MS).length, lista: longas.map((l) => ({ inicioMs: arred(l.inicio), duracaoMs: arred(l.duracao) })) }
    resultado.errosNoConsole.push(...erros)
    await navegador.close()
  }

  fs.writeFileSync(path.join(PROVAS, 'medidas-tempo-real.json'), JSON.stringify(resultado, null, 2) + '\n')
  console.log(JSON.stringify({ gpu: resultado.gpu, versoes: resultado.versoes, longas: { claro: resultado.tarefasLongas.claro.maiorMs, escuro: resultado.tarefasLongas.escuro.maiorMs }, controles: resultado.controles, erros: resultado.errosNoConsole }, null, 1))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
