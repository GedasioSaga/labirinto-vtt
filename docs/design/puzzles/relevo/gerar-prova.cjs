/**
 * PROVA DO PAINEL EM RELEVO (28/11). Gera `prova.html` a partir do MESMO código
 * do app (`client/src/puzzles/relevo/arte.ts`, empacotado com o esbuild do
 * client) e, com `--fotos`, abre a página no Edge (Playwright, canal msedge),
 * mede o tempo de rasterizar cada painel (Blob -> <img> -> canvas 1600 x 1000,
 * como o app faz) e tira as folhas de contato em `provas/`.
 *
 *   node docs/design/puzzles/relevo/gerar-prova.cjs            # só a página
 *   node docs/design/puzzles/relevo/gerar-prova.cjs --fotos    # página + folhas + tempos (headless)
 *   node docs/design/puzzles/relevo/gerar-prova.cjs --fotos --janela   # idem, com janela (GPU de verdade)
 */
const fs = require('node:fs')
const path = require('node:path')

const AQUI = __dirname
const RAIZ = path.resolve(AQUI, '../../../..')
const CLIENT = path.join(RAIZ, 'client')
const requireDoClient = (m) => require(require.resolve(m, { paths: [CLIENT] }))

const esbuild = requireDoClient('esbuild')
const pacote = esbuild.buildSync({
  entryPoints: [path.join(CLIENT, 'src/puzzles/relevo/arte.ts')],
  bundle: true,
  format: 'iife',
  globalName: 'ArteDoRelevo',
  write: false,
  target: 'es2022',
  charset: 'utf8',
})
const codigoDaArte = pacote.outputFiles[0].text

const PAGINA = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Prova do painel em relevo</title>
<style>
  body { margin: 0; background: #15120f; color: #e9e1d4; font: 14px/1.4 system-ui, sans-serif; }
  section { padding: 16px 20px 22px; width: max-content; }
  h2 { margin: 0 0 10px; font-size: 17px; font-weight: 600; }
  .grade { display: grid; gap: 10px; }
  .metais { grid-template-columns: 110px repeat(3, 400px); align-items: center; }
  .metais canvas { width: 400px; height: 250px; display: block; }
  .rot { font-size: 13px; color: #cbbfae; }
  .placas { grid-template-columns: repeat(3, 520px); }
  .placas figure { margin: 0; }
  .placas canvas { width: 520px; height: 312px; display: block; }
  .placas figcaption { font-size: 11.5px; color: #cbbfae; margin-top: 4px; columns: 2; column-gap: 12px; }
  .placas figcaption b { color: #f3d08a; font-weight: 600; }
  #detalhe canvas.grande { width: 1600px; height: 1000px; display: block; }
  #detalhe .linha { display: flex; gap: 14px; margin-top: 12px; align-items: flex-start; }
  #detalhe .linha canvas { width: 640px; height: 400px; }
  table { border-collapse: collapse; font-size: 12.5px; }
  td, th { padding: 2px 10px; text-align: right; }
  th { color: #cbbfae; font-weight: 500; }
</style></head>
<body>
<section id="metais"><h2>Os seis relevos nos três metais</h2><div class="grade metais" id="gradeMetais"></div></section>
<section id="placas"><h2>As 12 placas de cada cena (as que faltam por padrão em destaque)</h2><div class="grade placas" id="gradePlacas"></div></section>
<section id="detalhe"><h2 id="tituloDetalhe">Detalhe em 100%</h2><canvas class="grande" id="grande" width="1600" height="1000"></canvas>
  <div class="linha"><canvas id="semCena" width="1600" height="1000"></canvas><div><h2>Tempo de rasterização por painel (ms)</h2><table id="tempos"></table><p id="gpu" class="rot"></p></div></div>
</section>
<script>${codigoDaArte}</script>
<script>
const A = ArteDoRelevo
const CENAS = ['cavaleiro', 'dragao', 'navio', 'leao', 'serpente', 'solELua']
const METAIS = ['bronze', 'ferro', 'prata']
const LACUNAS_PADRAO = 4

async function rasterizar(cena, metal) {
  const t0 = performance.now()
  const svg = A.svgDoPainel(cena, metal)
  const t1 = performance.now()
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  const img = new Image()
  img.src = url
  await img.decode()
  const cv = document.createElement('canvas')
  cv.width = 1600
  cv.height = 1000
  const ctx = cv.getContext('2d')
  ctx.drawImage(img, 0, 0)
  ctx.getImageData(800, 500, 1, 1)
  const t2 = performance.now()
  URL.revokeObjectURL(url)
  return { cv, gerar: t1 - t0, raster: t2 - t1, bytes: new Blob([svg]).size }
}

function gpu() {
  try {
    const gl = document.createElement('canvas').getContext('webgl')
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    return gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER)
  } catch (e) { return 'sem WebGL' }
}

function copiar(destino, origem, sx = 0, sy = 0, sw = 1600, sh = 1000) {
  destino.getContext('2d').drawImage(origem, sx, sy, sw, sh, 0, 0, destino.width, destino.height)
}

function desenharGrade(cv, cena) {
  const g = cv.getContext('2d')
  const ex = cv.width / 1200, ey = cv.height / 720
  const faltam = A.ORDEM_DAS_PLACAS[cena].slice(0, LACUNAS_PADRAO)
  g.lineWidth = 2
  for (let k = 0; k < 12; k++) {
    const col = k % 4, lin = Math.floor(k / 4)
    const x = col * 300 * ex, y = lin * 240 * ey, w = 300 * ex, h = 240 * ey
    if (faltam.includes(k)) { g.fillStyle = 'rgba(243, 208, 138, 0.16)'; g.fillRect(x, y, w, h) }
    g.strokeStyle = 'rgba(255, 240, 200, 0.85)'
    g.strokeRect(x + 1, y + 1, w - 2, h - 2)
    g.fillStyle = 'rgba(0,0,0,0.6)'
    g.fillRect(x + 6, y + 6, 34, 26)
    g.fillStyle = faltam.includes(k) ? '#f3d08a' : '#fff'
    g.font = '600 18px system-ui'
    g.fillText(String(k), x + 12, y + 26)
  }
}

async function principal() {
  const tempos = []
  // aquecimento: um SVG sem filtro, para separar o custo de ligar o navegador
  // do custo do primeiro painel (que ainda paga a compilação dos filtros)
  {
    const t0 = performance.now()
    const url = URL.createObjectURL(new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><rect width="1600" height="1000" fill="#345"/></svg>'], { type: 'image/svg+xml' }))
    const img = new Image()
    img.src = url
    await img.decode()
    const cv = document.createElement('canvas')
    cv.width = 1600
    cv.height = 1000
    cv.getContext('2d').drawImage(img, 0, 0)
    cv.getContext('2d').getImageData(1, 1, 1, 1)
    tempos.push({ cena: 'aquecimento', metal: '-', gerar: 0, raster: performance.now() - t0, kb: 0 })
  }
  const gradeM = document.getElementById('gradeMetais')
  gradeM.insertAdjacentHTML('beforeend', '<div></div>' + METAIS.map((m) => '<div class="rot">' + A.NOME_DO_METAL[m] + '</div>').join(''))
  const porCena = {}
  for (const cena of CENAS) {
    gradeM.insertAdjacentHTML('beforeend', '<div class="rot">' + A.NOME_DA_CENA[cena] + '</div>')
    for (const metal of METAIS) {
      const r = await rasterizar(cena, metal)
      tempos.push({ cena, metal, gerar: r.gerar, raster: r.raster, kb: r.bytes / 1024 })
      const mini = document.createElement('canvas')
      mini.width = 800
      mini.height = 500
      copiar(mini, r.cv)
      gradeM.appendChild(mini)
      if (metal === 'bronze') porCena[cena] = r.cv
      if (cena === 'cavaleiro' && metal === 'ferro') copiar(document.getElementById('grande'), r.cv)
    }
  }
  const gradeP = document.getElementById('gradePlacas')
  for (const cena of CENAS) {
    const fig = document.createElement('figure')
    const cv = document.createElement('canvas')
    cv.width = 1040
    cv.height = 624
    copiar(cv, porCena[cena], 200, 160, 1200, 720)
    desenharGrade(cv, cena)
    fig.appendChild(cv)
    const ordem = A.ORDEM_DAS_PLACAS[cena]
    const desc = A.DESCRICAO_DAS_PLACAS[cena]
    fig.insertAdjacentHTML('beforeend', '<figcaption>' + desc.map((d, k) => (ordem.indexOf(k) < LACUNAS_PADRAO ? '<b>' + k + ' ' + d + '</b>' : k + ' ' + d)).join('<br>') + '</figcaption>')
    gradeP.appendChild(fig)
  }
  for (const metal of METAIS) {
    const r = await rasterizar(null, metal)
    tempos.push({ cena: 'sem cena', metal, gerar: r.gerar, raster: r.raster, kb: r.bytes / 1024 })
    if (metal === 'ferro') copiar(document.getElementById('semCena'), r.cv)
  }
  // segunda volta: o primeiro painel paga o aquecimento do navegador
  for (const metal of METAIS) {
    const r = await rasterizar('cavaleiro', metal)
    tempos.push({ cena: 'cavaleiro (2ª vez)', metal, gerar: r.gerar, raster: r.raster, kb: r.bytes / 1024 })
  }
  document.getElementById('tempos').innerHTML = '<tr><th>cena</th><th>metal</th><th>gerar</th><th>raster</th><th>KB</th></tr>' +
    tempos.map((t) => '<tr><td>' + t.cena + '</td><td>' + t.metal + '</td><td>' + t.gerar.toFixed(1) + '</td><td>' + t.raster.toFixed(0) + '</td><td>' + t.kb.toFixed(1) + '</td></tr>').join('')
  document.getElementById('gpu').textContent = 'Renderizador: ' + gpu()
  window.__tempos = tempos
  window.__gpu = gpu()
  window.__pronto = true
}
principal().catch((e) => { window.__erro = String(e && e.stack || e); window.__pronto = true })
</script>
</body></html>
`

const arquivoDaPagina = path.join(AQUI, 'prova.html')
fs.writeFileSync(arquivoDaPagina, PAGINA)
console.log('página:', path.relative(RAIZ, arquivoDaPagina), (PAGINA.length / 1024).toFixed(0) + ' KB')

async function fotografar(comJanela) {
  const { chromium } = requireDoClient('playwright')
  const provas = path.join(AQUI, 'provas')
  fs.mkdirSync(provas, { recursive: true })
  const canal = process.env.LAB_NAVEGADOR || 'msedge'
  const lancar = { channel: canal, headless: !comJanela }
  const tela = { viewport: { width: 1680, height: 1100 }, deviceScaleFactor: 1 }
  // `--perfil <pasta>`: perfil persistente, como o WebView2 do app — da segunda
  // vez em diante os shaders dos filtros já vêm do cache de disco da GPU.
  const iPerfil = process.argv.indexOf('--perfil')
  const navegador = iPerfil > 0 ? await chromium.launchPersistentContext(process.argv[iPerfil + 1], { ...lancar, ...tela }) : await chromium.launch(lancar)
  try {
    const pagina = iPerfil > 0 ? navegador.pages()[0] || (await navegador.newPage()) : await navegador.newPage(tela)
    pagina.on('pageerror', (e) => console.log('erro na página:', e.message))
    await pagina.goto('file:///' + arquivoDaPagina.replace(/\\/g, '/'))
    await pagina.waitForFunction(() => window.__pronto === true, null, { timeout: 180000 })
    const erro = await pagina.evaluate(() => window.__erro)
    if (erro) throw new Error(erro)
    const tempos = await pagina.evaluate(() => window.__tempos)
    const gpu = await pagina.evaluate(() => window.__gpu)
    if (!process.argv.includes('--sem-folhas')) {
      await pagina.locator('#metais').screenshot({ path: path.join(provas, 'folha-1-metais.png') })
      await pagina.locator('#placas').screenshot({ path: path.join(provas, 'folha-2-placas.png') })
      await pagina.locator('#detalhe').screenshot({ path: path.join(provas, 'folha-3-detalhe.png') })
    }
    console.log('renderizador:', gpu, comJanela ? '(com janela)' : '(headless)')
    for (const t of tempos) console.log(`${t.cena.padEnd(20)} ${t.metal.padEnd(7)} gerar ${t.gerar.toFixed(1).padStart(6)} ms  raster ${t.raster.toFixed(0).padStart(5)} ms  ${t.kb.toFixed(1).padStart(6)} KB`)
    const r = tempos.map((t) => t.raster).sort((a, b) => a - b)
    console.log(`raster: mediana ${r[Math.floor(r.length / 2)].toFixed(0)} ms, pior ${r[r.length - 1].toFixed(0)} ms`)
  } finally {
    await navegador.close()
  }
}

if (process.argv.includes('--fotos')) {
  fotografar(process.argv.includes('--janela')).catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
}
