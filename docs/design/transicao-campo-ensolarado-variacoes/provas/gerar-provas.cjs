// Provas do "Campo ensolarado" e das variações (três casas, vila), no Chromium do Playwright.
// Rodar da raiz do repo, sempre pela fila de suítes:
//   node ~/.claude/scripts/suite-lock.cjs --nome campo-variacoes -- node docs/design/transicao-campo-ensolarado-variacoes/provas/gerar-provas.cjs <modo> [saida]
// Modos:
//   digitais <arquivo.json>  hash dos pixels de 8 quadros fixos (normal e reduzido) de cada cena que existir
//   original <arquivo.json>  as digitais da aprovada como está no commit dela (git show) e como sai agora do
//                            wrapper sobre _campoEnsolarado.ts; sai com erro se algum dos 8 quadros mudar
//   comparar <prefixo>       a mesma cena com e sem uma troca de módulo (--troca <arquivo.ts>=<caminho>, --cena,
//                            --t): pixels diferentes, a caixa onde estão e uma imagem com a diferença em magenta
//   folhas                   folha de contato de 16 quadros por cena, com o tempo embaixo
//   quadros                  um quadro grande por cena (t = 2 s e 5,2 s) para conferir o fundo (vai para --pasta)
//   desempenho <arquivo>     montagem + 7 s em tempo real a 1280x720: p95 do quadro, maior tarefa longa,
//                            draw calls e triângulos, e o descarte (geometrias e texturas antes e depois)
// Nada de servidor: a página e os módulos saem do disco por page.route.
'use strict'
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const RAIZ = path.resolve(__dirname, '..', '..', '..', '..')
const PROVAS = __dirname
const TRANSICAO = path.join(RAIZ, 'client', 'src', 'animacoes', 'transicao')
const CENAS = [
  ['original', 'campo-ensolarado.ts'],
  ['tres-casas', 'campo-ensolarado-tres-casas.ts'],
  ['vila', 'campo-ensolarado-vila.ts'],
].filter(([, arquivo]) => fs.existsSync(path.join(TRANSICAO, arquivo)))
const DIGITAIS_T = [0.6, 1.5, 2.5, 3.5, 4.2, 5.0, 5.8, 6.7]
const FOLHA_T = Array.from({ length: 16 }, (_, i) => Math.round((0.3 + i * 0.44) * 100) / 100)
const ORIGEM = 'http://campo.prova'
/** O commit em que a aprovada entrou (12/10/2026); o arquivo dela não mudou até a divisão de 27/10. */
const COMMIT_DA_APROVADA = '07a2a7e2'
const ARQUIVO_DA_APROVADA = 'client/src/animacoes/transicao/campo-ensolarado.ts'

/**
 * Empacota as cenas num módulo ES. `trocas` (nome do arquivo → texto) substitui um módulo de
 * client/src/animacoes/transicao pelo texto dado, que resolve os imports dele a partir da mesma pasta.
 */
async function empacotar(trocas = {}) {
  const esbuild = require(path.join(RAIZ, 'node_modules', 'esbuild'))
  const linhas = CENAS.map(([nome, arquivo]) => `export { default as ${nome.replace('-', '_')} } from ${JSON.stringify(path.join(TRANSICAO, arquivo).split(path.sep).join('/'))}`)
  const trocar = {
    name: 'trocas',
    setup(build) {
      build.onLoad({ filter: /\.ts$/ }, (args) => {
        const texto = path.relative(TRANSICAO, path.dirname(args.path)) === '' ? trocas[path.basename(args.path)] : undefined
        return texto === undefined ? undefined : { contents: texto, loader: 'ts', resolveDir: TRANSICAO }
      })
    },
  }
  const r = await esbuild.build({
    stdin: { contents: linhas.join('\n'), resolveDir: RAIZ, sourcefile: 'entrada.js', loader: 'js' },
    bundle: true,
    format: 'esm',
    target: 'es2020',
    charset: 'utf8',
    write: false,
    plugins: [trocar],
  })
  return r.outputFiles[0].text
}

const PAGINA = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#000}canvas{display:block}</style></head>
<body><canvas id="c" width="1280" height="720" style="width:1280px;height:720px"></canvas>
<script type="module">
import * as THREE from '/three.module.js'
import * as cenasA from '/cenas.js'
THREE.ColorManagement.enabled = false
const canvas = document.getElementById('c')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setClearColor(0x000000, 1)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap
renderer.setPixelRatio(1)
renderer.setSize(1280, 720, false)
const gl = renderer.getContext()
const nomeDe = (n) => n.replace('-', '_')
// 'b' é o pacote com as trocas (modos original e comparar); sem ele, só o 'a'.
const pacotes = { a: cenasA }
window.carregarB = async () => { pacotes.b = await import('/cenas-b.js') }
window.nomes = Object.keys(cenasA)
function abrir(nome, reduzirMovimento, pacote = 'a') {
  const cena = pacotes[pacote][nomeDe(nome)](THREE, { reduzirMovimento })
  cena.ajustarTela(1280 / 720)
  return cena
}
async function hash(bytes) {
  const d = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
function quadro(cena, t) {
  cena.atualizar(t)
  renderer.render(cena.scene, cena.camera)
}
function lerPixels() {
  const px = new Uint8Array(1280 * 720 * 4)
  gl.readPixels(0, 0, 1280, 720, gl.RGBA, gl.UNSIGNED_BYTE, px)
  return px
}
window.digitais = async (nome, tempos, pacote = 'a') => {
  const saida = {}
  for (const reduzir of [false, true]) {
    const lista = []
    for (const volta of [0, 1]) {
      const cena = abrir(nome, reduzir, pacote)
      for (const [i, t] of tempos.entries()) {
        quadro(cena, t)
        const h = await hash(lerPixels())
        if (volta === 0) lista.push({ t, sha256: h })
        else if (lista[i].sha256 !== h) lista[i].instavel = true
      }
      cena.descartar()
    }
    saida[reduzir ? 'reduzido' : 'normal'] = lista
  }
  return saida
}
// Mesma cena e mesmo tempo nos dois pacotes: quantos pixels mudam, onde, e o quadro 'b' apagado com a diferença em magenta.
window.comparar = (nome, t) => {
  const cenaA = abrir(nome, false, 'a')
  quadro(cenaA, t)
  const a = lerPixels()
  cenaA.descartar()
  const cenaB = abrir(nome, false, 'b')
  quadro(cenaB, t)
  const b = lerPixels()
  const fotoB = canvas.toDataURL('image/png')
  cenaB.descartar()
  const img = new ImageData(1280, 720)
  let diferentes = 0, maiorDelta = 0, x0 = 1280, y0 = 720, x1 = -1, y1 = -1
  for (let y = 0; y < 720; y++) {
    for (let x = 0; x < 1280; x++) {
      const i = ((719 - y) * 1280 + x) * 4 // readPixels vem de baixo para cima
      const o = (y * 1280 + x) * 4
      const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]))
      if (d > 0) {
        diferentes++
        maiorDelta = Math.max(maiorDelta, d)
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y)
        img.data.set([255, 0, 255, 255], o)
      } else img.data.set([b[i] * 0.45, b[i + 1] * 0.45, b[i + 2] * 0.45, 255], o)
    }
  }
  const c = document.createElement('canvas')
  c.width = 1280
  c.height = 720
  c.getContext('2d').putImageData(img, 0, 0)
  return { t, diferentes, maiorDelta, caixa: diferentes ? { x0, y0, x1, y1 } : null, diferenca: c.toDataURL('image/png'), depois: fotoB }
}
window.folha = (nome, tempos, rotulo) => {
  const cols = 4, w = 320, h = 180, faixa = 24, topo = 34
  const linhas = Math.ceil(tempos.length / cols)
  const f = document.createElement('canvas')
  f.width = cols * w
  f.height = topo + linhas * (h + faixa)
  const g = f.getContext('2d')
  g.fillStyle = '#16140f'
  g.fillRect(0, 0, f.width, f.height)
  g.fillStyle = '#efe9dd'
  g.font = '600 16px system-ui, sans-serif'
  g.fillText(rotulo, 10, 22)
  const cena = abrir(nome, false)
  for (const [i, t] of tempos.entries()) {
    quadro(cena, t)
    const x = (i % cols) * w, y = topo + Math.floor(i / cols) * (h + faixa)
    g.drawImage(canvas, x, y, w, h)
    g.fillStyle = '#efe9dd'
    g.font = '14px system-ui, sans-serif'
    g.fillText(t.toFixed(2).replace('.', ',') + ' s', x + 8, y + h + 17)
  }
  cena.descartar()
  return f.toDataURL('image/png')
}
window.quadroGrande = (nome, t, recorte) => {
  const cena = abrir(nome, false)
  quadro(cena, t)
  let url = canvas.toDataURL('image/png')
  if (recorte) {
    const [x, y, w, h, k] = recorte
    const r = document.createElement('canvas')
    r.width = w * k
    r.height = h * k
    const g = r.getContext('2d')
    g.imageSmoothingEnabled = false
    g.drawImage(canvas, x, y, w, h, 0, 0, w * k, h * k)
    url = r.toDataURL('image/png')
  }
  cena.descartar()
  return url
}
window.medir = (nome, segundos) => new Promise((pronto) => {
  const longas = []
  const obs = new PerformanceObserver((l) => { for (const e of l.getEntries()) longas.push({ inicio: e.startTime, ms: e.duration }) })
  obs.observe({ type: 'longtask', buffered: false })
  const memAntes = { ...renderer.info.memory }
  const t0 = performance.now()
  const cena = abrir(nome, false)
  const montagemMs = performance.now() - t0
  quadro(cena, 0.01)
  const primeiroQuadroMs = performance.now() - t0 - montagemMs
  const memAberta = { ...renderer.info.memory }
  const deltas = [], trabalho = []
  let calls = 0, triangulos = 0, inicio = 0, anterior = 0
  const passo = (agora) => {
    if (!inicio) { inicio = agora; anterior = agora }
    const t = (agora - inicio) / 1000
    if (t >= segundos) {
      setTimeout(() => {
        obs.disconnect()
        const fimMontagem = t0 + montagemMs + primeiroQuadroMs
        cena.descartar()
        renderer.renderLists.dispose()
        const memDepois = { ...renderer.info.memory }
        pronto({ montagemMs, primeiroQuadroMs, deltas, trabalho, calls, triangulos, memAntes, memAberta, memDepois,
          longasNaMontagem: longas.filter((l) => l.inicio <= fimMontagem).map((l) => l.ms),
          longasTocando: longas.filter((l) => l.inicio > fimMontagem).map((l) => l.ms) })
      }, 300)
      return
    }
    if (agora !== anterior) deltas.push(agora - anterior)
    anterior = agora
    const a = performance.now()
    quadro(cena, t)
    trabalho.push(performance.now() - a)
    calls = Math.max(calls, renderer.info.render.calls)
    triangulos = Math.max(triangulos, renderer.info.render.triangles)
    requestAnimationFrame(passo)
  }
  requestAnimationFrame(passo)
})
const dbg = gl.getExtension('WEBGL_debug_renderer_info')
window.gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
window.pronta = true
</script></body></html>`

async function abrirPagina(bundle, bundleB = null) {
  const { chromium } = require(path.join(RAIZ, 'node_modules', 'playwright'))
  const navegador = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'] })
  const pagina = await navegador.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
  const erros = []
  pagina.on('pageerror', (e) => erros.push(String(e)))
  pagina.on('console', (m) => {
    if (m.type() === 'error') erros.push(m.text())
  })
  const tres = path.join(RAIZ, 'node_modules', 'three', 'build')
  await pagina.route(`${ORIGEM}/**`, (rota) => {
    const url = new URL(rota.request().url())
    const js = (corpo) => rota.fulfill({ status: 200, contentType: 'text/javascript', body: corpo })
    if (url.pathname === '/') return rota.fulfill({ status: 200, contentType: 'text/html', body: PAGINA })
    if (url.pathname === '/cenas.js') return js(bundle)
    if (url.pathname === '/cenas-b.js' && bundleB !== null) return js(bundleB)
    if (url.pathname === '/three.module.js' || url.pathname === '/three.core.js') return js(fs.readFileSync(path.join(tres, url.pathname.slice(1)), 'utf8'))
    return rota.fulfill({ status: 404, body: '' })
  })
  await pagina.goto(`${ORIGEM}/`)
  await pagina.waitForFunction(() => window.pronta === true || false, null, { timeout: 60000 }).catch(() => {
    throw new Error(`página não abriu: ${erros.join(' | ')}`)
  })
  if (bundleB !== null) await pagina.evaluate(() => window.carregarB())
  return { navegador, pagina, erros, gpu: await pagina.evaluate(() => window.gpu), nomes: await pagina.evaluate(() => window.nomes) }
}

function salvarPng(dataUrl, arquivo) {
  fs.writeFileSync(arquivo, Buffer.from(dataUrl.split(',')[1], 'base64'))
}

const p95 = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * 0.95))] : 0
}
const r2 = (x) => Math.round(x * 100) / 100
const arg = (nome) => (process.argv.includes(nome) ? process.argv[process.argv.indexOf(nome) + 1] : null)

/** `--troca a.ts=caminho` (pode repetir) vira { 'a.ts': texto }. */
function lerTrocas() {
  const trocas = {}
  process.argv.forEach((a, i) => {
    if (a !== '--troca') return
    const [arquivo, caminho] = process.argv[i + 1].split('=')
    trocas[arquivo] = fs.readFileSync(path.resolve(caminho), 'utf8')
  })
  return trocas
}

async function principal() {
  const [modo, saida] = process.argv.slice(2)
  const pasta = arg('--pasta') ?? PROVAS
  const bundle = await empacotar()
  let bundleB = null
  let aprovadaGit = null
  if (modo === 'original') {
    aprovadaGit = execFileSync('git', ['show', `${COMMIT_DA_APROVADA}:${ARQUIVO_DA_APROVADA}`], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
    bundleB = await empacotar({ 'campo-ensolarado.ts': aprovadaGit })
  } else if (modo === 'comparar') {
    const trocas = lerTrocas()
    if (Object.keys(trocas).length === 0) throw new Error('comparar pede --troca <arquivo.ts>=<caminho>')
    bundleB = await empacotar(trocas)
  }
  const { navegador, pagina, erros, gpu, nomes } = await abrirPagina(bundle, bundleB)
  const cenas = CENAS.filter(([nome]) => nomes.includes(nome.replace('-', '_')))
  try {
    if (modo === 'digitais') {
      const r = { geradoEm: new Date().toISOString(), gpu, resolucao: '1280x720', tempos: DIGITAIS_T, cenas: {} }
      for (const [nome] of cenas) r.cenas[nome] = await pagina.evaluate(([n, ts]) => window.digitais(n, ts), [nome, DIGITAIS_T])
      fs.writeFileSync(saida, JSON.stringify(r, null, 2) + '\n')
      console.log(`digitais de ${cenas.map((c) => c[0]).join(', ')} em ${saida} (gpu: ${gpu})`)
    } else if (modo === 'original') {
      // 'a' = o wrapper novo sobre _campoEnsolarado.ts; 'b' = o arquivo do commit da aprovada, inteiro.
      const nova = await pagina.evaluate(([ts]) => window.digitais('original', ts, 'a'), [DIGITAIS_T])
      const aprovada = await pagina.evaluate(([ts]) => window.digitais('original', ts, 'b'), [DIGITAIS_T])
      const quadros = []
      for (const modoDeMovimento of ['normal', 'reduzido']) {
        for (const [i, q] of aprovada[modoDeMovimento].entries()) {
          const n = nova[modoDeMovimento][i]
          quadros.push({ movimento: modoDeMovimento, t: q.t, aprovada: q.sha256, nova: n.sha256, igual: q.sha256 === n.sha256, instavel: Boolean(q.instavel || n.instavel) })
        }
      }
      const iguais = quadros.every((q) => q.igual && !q.instavel)
      const r = {
        geradoEm: new Date().toISOString(),
        gpu,
        resolucao: '1280x720',
        tempos: DIGITAIS_T,
        aprovada: `git show ${COMMIT_DA_APROVADA}:${ARQUIVO_DA_APROVADA} (igual ao de HEAD antes da divisão)`,
        nova: 'client/src/animacoes/transicao/campo-ensolarado.ts = criarCampo(\'nenhum\') de _campoEnsolarado.ts',
        iguais,
        quadros,
      }
      fs.writeFileSync(saida, JSON.stringify(r, null, 2) + '\n')
      console.log(`original: ${quadros.filter((q) => q.igual).length}/${quadros.length} quadros iguais${iguais ? '' : ' (DIFERENTE)'} em ${saida} (gpu: ${gpu})`)
      if (!iguais) process.exitCode = 1
    } else if (modo === 'comparar') {
      const cena = arg('--cena') ?? 'vila'
      const tempos = (arg('--t') ?? '2,5.2').split(',').map(Number)
      const resumo = { geradoEm: new Date().toISOString(), gpu, cena, a: 'o código de agora', b: `com a troca ${Object.keys(lerTrocas()).join(', ')}`, quadros: [] }
      for (const t of tempos) {
        const r = await pagina.evaluate(([n, tt]) => window.comparar(n, tt), [cena, t])
        salvarPng(r.diferenca, `${saida}-diferenca-${t}.png`)
        if (process.argv.includes('--fotos')) salvarPng(r.depois, `${saida}-troca-${t}.png`)
        resumo.quadros.push({ t, pixelsDiferentes: r.diferentes, maiorDelta: r.maiorDelta, caixa: r.caixa })
        console.log(`t=${t}: ${r.diferentes} pixels diferentes, maior delta ${r.maiorDelta}, caixa ${JSON.stringify(r.caixa)}`)
      }
      fs.writeFileSync(`${saida}.json`, JSON.stringify(resumo, null, 2) + '\n')
    } else if (modo === 'folhas') {
      const rotulos = { original: 'Campo ensolarado (original)', 'tres-casas': 'Campo ensolarado: três casas', vila: 'Campo ensolarado: vila' }
      for (const [nome] of cenas) {
        const url = await pagina.evaluate(([n, ts, r]) => window.folha(n, ts, r), [nome, FOLHA_T, rotulos[nome]])
        salvarPng(url, path.join(pasta, `folha-de-contato-${nome}.png`))
      }
      console.log(`folhas em ${pasta}`)
    } else if (modo === 'quadros') {
      const tempos = (arg('--t') ?? '2,5.2').split(',').map(Number)
      const recorte = arg('--recorte')?.split(',').map(Number) ?? null
      for (const [nome] of cenas) {
        if (arg('--so') !== null && arg('--so') !== nome) continue
        for (const t of tempos) salvarPng(await pagina.evaluate(([n, tt, rc]) => window.quadroGrande(n, tt, rc), [nome, t, recorte]), path.join(pasta, `${recorte ? 'recorte' : 'quadro'}-${nome}-${t}.png`))
      }
      console.log(`quadros em ${pasta}`)
    } else if (modo === 'desempenho') {
      const r = { geradoEm: new Date().toISOString(), gpu, resolucao: '1280x720', voltas: 3, cenas: {} }
      for (const [nome] of cenas) {
        const voltas = []
        for (let v = 0; v < 3; v++) voltas.push(await pagina.evaluate((n) => window.medir(n, 7), nome))
        const deltas = voltas.flatMap((v) => v.deltas)
        const trabalho = voltas.flatMap((v) => v.trabalho)
        r.cenas[nome] = {
          quadros: deltas.length,
          p95QuadroMs: r2(p95(deltas)),
          medianaQuadroMs: r2([...deltas].sort((a, b) => a - b)[Math.floor(deltas.length / 2)]),
          p95TrabalhoPorQuadroMs: r2(p95(trabalho)),
          montagemMs: voltas.map((v) => r2(v.montagemMs)),
          primeiroQuadroMs: voltas.map((v) => r2(v.primeiroQuadroMs)),
          maiorTarefaLongaTocandoMs: r2(Math.max(0, ...voltas.flatMap((v) => v.longasTocando))),
          tarefasLongasTocando: voltas.reduce((s, v) => s + v.longasTocando.length, 0),
          tarefasLongasTocando200ms: voltas.reduce((s, v) => s + v.longasTocando.filter((x) => x >= 200).length, 0),
          maiorTarefaLongaNaMontagemMs: r2(Math.max(0, ...voltas.flatMap((v) => v.longasNaMontagem))),
          drawCallsMax: Math.max(...voltas.map((v) => v.calls)),
          triangulosMax: Math.max(...voltas.map((v) => v.triangulos)),
          memoria: voltas.map((v) => ({ antes: v.memAntes, aberta: v.memAberta, depoisDoDescarte: v.memDepois })),
        }
        console.log(nome, JSON.stringify({ ...r.cenas[nome], memoria: undefined }))
      }
      fs.writeFileSync(saida, JSON.stringify(r, null, 2) + '\n')
    } else {
      throw new Error(`modo desconhecido: ${modo}`)
    }
    if (erros.length) console.log('erros da página:', erros.join(' | '))
  } finally {
    await navegador.close()
  }
}

principal().catch((e) => {
  console.error(e)
  process.exit(1)
})
