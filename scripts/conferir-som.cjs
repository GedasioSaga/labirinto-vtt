'use strict'
/**
 * CONFERIR O SOM DE UMA TRANSIÇÃO (por medida, sem precisar ouvir).
 *
 *   node scripts/conferir-som.cjs portao-pesado
 *   node scripts/conferir-som.cjs client/src/animacoes/transicao/escada-madeira.ts
 *   node scripts/conferir-som.cjs porta escada-pedra escada-pedra-descendo portao-pesado
 *   node scripts/conferir-som.cjs <id> --saida C:/algum/lugar
 *
 * Alvo = id de uma transição embutida (porta, escada-pedra,
 * escada-pedra-descendo), id de uma do pacote (client/src/animacoes/transicao/<id>.ts)
 * ou o caminho do .ts de uma do pacote (o <id>.json ao lado dá a duração natural).
 *
 * Para cada alvo o som é RENDERIZADO OFFLINE no Edge (Playwright + Vite do
 * client): OfflineAudioContext estéreo a 48 kHz, o mesmo `criarSom` da cena e o
 * mesmo kit do motor, pela duração natural (o motor fecha o som ali, então o
 * corte do fim também é conferido). Sai, em --saida (padrão client/dist-som/):
 *   <id>.wav                    16 bits, para ouvir
 *   <id>-espectrograma.png      tempo x frequência (log, 20 Hz–16 kHz) + volume embaixo
 *   <id>-medidas.json           medidas, mediana das aprovadas e o veredito
 *
 * Referência (o que o mestre já aprovou): as 3 embutidas + portao-pesado. Elas
 * são renderizadas junto, a cada execução, e entram na tabela. REPROVA (código
 * de saída 1) se o alvo tiver: pico verdadeiro > -1 dBTP, amostra cortada,
 * clique, DC > 0,5% ou volume integrado fora de ±3 LU da mediana das aprovadas.
 * Erro da própria ferramenta sai com código 2.
 *
 * Cálculos (testados em scripts/som/medidas.test.cjs): scripts/som/medidas.cjs.
 */
const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const medidas = require('./som/medidas.cjs')

const RAIZ = path.resolve(__dirname, '..')
const CLIENT = path.join(RAIZ, 'client')
const CLIENT_SRC = path.join(CLIENT, 'src')
const PACOTE = path.join(CLIENT_SRC, 'animacoes', 'transicao')
const SAIDA_PADRAO = path.join(CLIENT, 'dist-som')
const EMBUTIDAS = ['porta', 'escada-pedra', 'escada-pedra-descendo']
const REFERENCIA = [...EMBUTIDAS, 'portao-pesado']
const CAUDA_S = 0.25 // silêncio depois do fim: o motor fecha o som ali, e o corte entra na conta
const PASSO_ENVOLTORIA_S = 0.01

const barra = (p) => p.split(path.sep).join('/')

/** Acha um módulo do workspace (o npm içou tudo para a raiz, mas pode estar em client/). */
function acharModulo(relativo) {
  for (const base of [path.join(CLIENT, 'node_modules'), path.join(RAIZ, 'node_modules')]) {
    const p = path.join(base, relativo)
    if (fs.existsSync(p)) return p
  }
  throw new Error(`não achei ${relativo} em client/node_modules nem em node_modules (rode npm install)`)
}

function lerArgumentos(argv) {
  const alvos = []
  let saida = SAIDA_PADRAO
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--saida') saida = path.resolve(argv[++i] ?? '')
    else if (argv[i] === '-h' || argv[i] === '--help') return null
    else alvos.push(argv[i])
  }
  return alvos.length ? { alvos, saida } : null
}

/** id embutido, id do pacote ou caminho do .ts -> { id, embutida, fonte, duracaoNaturalS }. */
function resolverAlvo(alvo) {
  if (EMBUTIDAS.includes(alvo)) return { id: alvo, embutida: true, fonte: `embutida (${alvo})` }
  let fonte = path.resolve(alvo)
  if (!fs.existsSync(fonte)) fonte = path.join(PACOTE, `${alvo}.ts`)
  if (!fs.existsSync(fonte) || path.extname(fonte) !== '.ts') {
    throw new Error(`"${alvo}" não é transição embutida (${EMBUTIDAS.join(', ')}) nem achei ${barra(path.relative(RAIZ, fonte))}`)
  }
  const id = path.basename(fonte, '.ts')
  const json = fonte.replace(/\.ts$/, '.json')
  if (!fs.existsSync(json)) throw new Error(`falta ${barra(path.relative(RAIZ, json))} (com duracaoNaturalS) ao lado da fonte`)
  const meta = JSON.parse(fs.readFileSync(json, 'utf8'))
  if (!(meta.duracaoNaturalS > 0)) throw new Error(`${barra(json)} sem duracaoNaturalS válida`)
  return { id, embutida: false, fonte: barra(path.relative(RAIZ, fonte)), caminho: fonte, duracaoNaturalS: meta.duracaoNaturalS }
}

/** Gera a entrada da página: importa as cenas pedidas e entrega para scripts/som/pagina.js. */
function escreverEntrada(pasta, transicoes) {
  fs.rmSync(pasta, { recursive: true, force: true })
  fs.mkdirSync(pasta, { recursive: true })
  const linhas = [
    `import { instalar } from ${JSON.stringify(barra(path.join(__dirname, 'som', 'pagina.js')))}`,
    `import { resolverFabricaDaCena } from '@app/transicoes/motor'`,
    `import { TRANSICOES_EMBUTIDAS } from '@app/transicoes/catalogo'`,
  ]
  const entradas = []
  transicoes.forEach((t, k) => {
    if (t.embutida) {
      // Mesmo caminho do app: o switch do motor e a duração do catálogo.
      entradas.push(`${JSON.stringify(t.id)}: { fabrica: () => resolverFabricaDaCena(${JSON.stringify(t.id)}), duracaoNaturalS: TRANSICOES_EMBUTIDAS.find((e) => e.id === ${JSON.stringify(t.id)}).duracaoNaturalS }`)
    } else {
      linhas.push(`import cena${k} from ${JSON.stringify(barra(t.caminho))}`)
      entradas.push(`${JSON.stringify(t.id)}: { fabrica: async () => cena${k}, duracaoNaturalS: ${t.duracaoNaturalS} }`)
    }
  })
  linhas.push(`instalar({\n  ${entradas.join(',\n  ')}\n})`)
  fs.writeFileSync(path.join(pasta, 'entrada.js'), `${linhas.join('\n')}\n`)
  fs.writeFileSync(
    path.join(pasta, 'index.html'),
    '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>conferir-som</title><link rel="icon" href="data:,"></head><body><script type="module" src="./entrada.js"></script></body></html>\n',
  )
}

async function construir(pasta, destino) {
  const { build } = await import(pathToFileURL(acharModulo('vite/dist/node/index.js')).href)
  await build({
    configFile: false,
    root: pasta,
    base: './',
    logLevel: 'error',
    publicDir: false,
    resolve: { alias: { '@app': barra(CLIENT_SRC) } },
    build: { outDir: destino, emptyOutDir: true, target: 'es2022', reportCompressedSize: false, chunkSizeWarningLimit: 100000 },
  })
}

const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' }

/** Servidor local só para a página construída; fecha no fim (finally). */
function servir(raiz) {
  const servidor = http.createServer((req, res) => {
    let arquivo = path.normalize(path.join(raiz, decodeURIComponent(new URL(req.url, 'http://x').pathname)))
    if (!arquivo.startsWith(raiz)) return res.writeHead(403).end()
    if (fs.existsSync(arquivo) && fs.statSync(arquivo).isDirectory()) arquivo = path.join(arquivo, 'index.html')
    if (!fs.existsSync(arquivo)) return res.writeHead(404).end()
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo)] || 'application/octet-stream' })
    fs.createReadStream(arquivo).pipe(res)
  })
  return new Promise((ok) => servidor.listen(0, '127.0.0.1', () => ok(servidor)))
}

function deBase64(b64) {
  const buf = Buffer.from(b64, 'base64')
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4)
}

const virg = (v, c = 1) => (v === null || v === undefined ? '—' : v.toFixed(c).replace('.', ','))

function tabela(linhas) {
  const cab = ['transição', 'pico dBFS', 'pico verd. dBTP', 'LUFS int.', 'LUFS 3s máx', 'DC %', 'cortes', 'cliques', 'ataques', 'pulsos trem', 'silêncios', 'L−R dB', 'veredito']
  const corpo = linhas.map(({ id, ref, m, motivos }) => [
    `${id}${ref ? ' (ref)' : ''}`,
    virg(m.picoDbfs),
    virg(m.picoVerdadeiroDbtp),
    virg(m.lufsIntegrado),
    virg(m.lufsCurtoPrazoMax),
    virg(m.dcPct, 3),
    String(m.cortes),
    String(m.cliques.length),
    String(m.ataques.length),
    String(m.trensDePulsos.reduce((s, t) => s + t.pulsos, 0)),
    String(m.silenciosNoMeio.length),
    virg(m.equilibrioLRdb),
    motivos === null ? '' : motivos.length ? 'REPROVADO' : 'aprovado',
  ])
  const larg = cab.map((c, i) => Math.max(c.length, ...corpo.map((l) => l[i].length)))
  const fmt = (l) => l.map((c, i) => (i === 0 ? c.padEnd(larg[i]) : c.padStart(larg[i]))).join('  ')
  return [fmt(cab), larg.map((n) => '-'.repeat(n)).join('  '), ...corpo.map(fmt)].join('\n')
}

async function main() {
  const args = lerArgumentos(process.argv.slice(2))
  if (!args) {
    console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^'use strict'\n\/\*\*\n?/, '').replace(/^ \* ?/gm, ''))
    return 2
  }
  const alvos = args.alvos.map(resolverAlvo)
  const idsAlvo = new Set(alvos.map((a) => a.id))
  const referencias = REFERENCIA.map(resolverAlvo)
  const todas = [...alvos, ...referencias.filter((r) => !idsAlvo.has(r.id))]
  fs.mkdirSync(args.saida, { recursive: true })
  const pasta = path.join(args.saida, '.pagina')
  const construida = path.join(args.saida, '.pagina-dist')
  escreverEntrada(pasta, todas)
  console.log(`montando a página de renderização (${todas.length} transições)...`)
  await construir(pasta, construida)

  const { chromium } = require(acharModulo('playwright'))
  const servidor = await servir(construida)
  let navegador
  const resultado = new Map()
  try {
    navegador = await chromium.launch({ channel: 'msedge' })
    const pagina = await navegador.newPage({ viewport: { width: 1400, height: 900 } })
    const erros = []
    pagina.on('pageerror', (e) => erros.push(e.message))
    pagina.on('console', (m) => m.type() === 'error' && erros.push(m.text()))
    await pagina.goto(`http://127.0.0.1:${servidor.address().port}/`)
    await pagina.waitForFunction(() => window.__pronto, null, { timeout: 60000 }).catch(() => {
      throw new Error(`a página não montou: ${erros.join(' | ') || 'sem erro no console'}`)
    })
    for (const t of todas) {
      const r = await pagina.evaluate((id) => window.__renderizar(id), t.id)
      if (r.semSom) {
        resultado.set(t.id, { t, semSom: true })
        continue
      }
      const cauda = Math.round(CAUDA_S * r.taxa)
      const canais = r.canais.map((b64) => {
        const bruto = deBase64(b64)
        const c = new Float32Array(bruto.length + cauda)
        c.set(bruto)
        return c
      })
      const duracaoNaturalS = (canais[0].length - cauda) / r.taxa
      const m = medidas.medirTudo(canais, r.taxa)
      m.duracaoNaturalS = Math.round(duracaoNaturalS * 1000) / 1000
      resultado.set(t.id, { t, canais, taxa: r.taxa, m })
    }

    const lufsRef = REFERENCIA.map((id) => resultado.get(id)?.m?.lufsIntegrado)
    const medianaLufs = medidas.mediana(lufsRef)
    const linhas = []
    for (const t of todas) {
      const r = resultado.get(t.id)
      if (r.semSom) continue
      const ehAlvo = idsAlvo.has(t.id)
      const motivos = ehAlvo ? medidas.julgar(r.m, medianaLufs) : null
      linhas.push({ id: t.id, ref: REFERENCIA.includes(t.id), m: r.m, motivos })
      if (!ehAlvo) continue
      r.motivos = motivos
      fs.writeFileSync(path.join(args.saida, `${t.id}.wav`), medidas.wav16(r.canais, r.taxa))
      const espectro = medidas.espectrograma(r.canais, r.taxa)
      const env = medidas.envoltoria(r.canais, r.taxa, PASSO_ENVOLTORIA_S)
      const nulo = (arr) => arr.map((v) => (Number.isFinite(v) ? Math.round(v * 10) / 10 : null))
      const png = await pagina.evaluate((d) => window.__desenhar(d), {
        titulo: `${t.id} · espectrograma e volume`,
        subtitulo: `${t.fonte} · ${virg(r.m.duracaoNaturalS, 2)} s de cena + ${virg(CAUDA_S, 2)} s depois do fim (o app fecha o som no fim) · 48 kHz estéreo, volume 1 · LUFS ${virg(r.m.lufsIntegrado)} · pico verd. ${virg(r.m.picoVerdadeiroDbtp)} dBTP`,
        espectro: { ...espectro, db: espectro.db.map((col) => col.map((v) => Math.round(v))) },
        envoltoria: { rms: nulo(env.rms), pico: nulo(env.pico) },
        passoEnvS: PASSO_ENVOLTORIA_S,
        duracaoS: r.canais[0].length / r.taxa,
        fimNaturalS: r.m.duracaoNaturalS,
        cliques: r.m.cliques.map((c) => c.t),
      })
      fs.writeFileSync(path.join(args.saida, `${t.id}-espectrograma.png`), Buffer.from(png.split(',')[1], 'base64'))
      const json = {
        id: t.id,
        fonte: t.fonte,
        geradoEm: new Date().toISOString(),
        veredito: motivos.length ? 'REPROVADO' : 'aprovado',
        motivos,
        referencia: { ids: REFERENCIA, medianaLufsIntegrado: medianaLufs, toleranciaLU: medidas.TOLERANCIA_LU },
        medidas: r.m,
      }
      fs.writeFileSync(path.join(args.saida, `${t.id}-medidas.json`), `${JSON.stringify(json, null, 2)}\n`)
    }
    if (erros.length) console.log(`avisos do navegador: ${erros.join(' | ')}`)

    console.log(`\nMediana do volume integrado das aprovadas (${REFERENCIA.join(', ')}): ${virg(medianaLufs)} LUFS\n`)
    console.log(tabela(linhas))
    console.log('\nCentróide espectral por segundo (Hz; mais alto = mais agudo/brilhante):')
    for (const l of linhas) console.log(`  ${l.id.padEnd(22)} ${l.m.centroideHzPorSegundo.map((v) => (v === null ? '—' : String(v))).join(' ')}`)
    for (const t of todas) {
      const r = resultado.get(t.id)
      if (r.semSom) console.log(`\n${t.id}: a cena não tem criarSom (nada a conferir).`)
    }
    let reprovou = false
    for (const a of alvos) {
      const r = resultado.get(a.id)
      if (r.semSom) continue
      const base = barra(path.relative(process.cwd(), path.join(args.saida, a.id)))
      if (r.motivos.length) {
        reprovou = true
        console.log(`\n${a.id}: REPROVADO`)
        for (const mot of r.motivos) console.log(`  - ${mot}`)
      } else console.log(`\n${a.id}: aprovado nas medidas`)
      if (r.m.silenciosNoMeio.length) console.log(`  (silêncio total no meio: ${r.m.silenciosNoMeio.map((s) => `${virg(s.inicio, 2)}–${virg(s.fim, 2)} s`).join(', ')}; confira se é de propósito)`)
      console.log(`  ${base}.wav · ${base}-espectrograma.png · ${base}-medidas.json`)
    }
    return reprovou ? 1 : 0
  } finally {
    await navegador?.close()
    servidor.close()
  }
}

main().then(
  (codigo) => process.exit(codigo),
  (erro) => {
    console.error(`conferir-som: ${erro.message}`)
    process.exit(2)
  },
)
