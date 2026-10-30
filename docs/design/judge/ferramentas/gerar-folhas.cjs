// Gera as folhas de quadros do Judge abrindo o próprio protótipo num navegador sem janela.
// A página fotografa o 3D (a mesma função de pose do modo ao vivo) e devolve o PNG; aqui só salvamos.
//
// Uso, na raiz do repositório:
//   node docs/design/judge/ferramentas/gerar-folhas.cjs            -> salva as 3 folhas padrão em folhas/
//   node docs/design/judge/ferramentas/gerar-folhas.cjs --medir    -> só mede o KB de todas as resoluções, sem salvar
//
// Precisa do playwright do repositório (node_modules) e de um Chrome ou Edge instalado.
const path = require('path')
const fs = require('fs')

const RAIZ = path.resolve(__dirname, '..', '..', '..', '..')
const PASTA = path.resolve(__dirname, '..')
const { chromium } = require(path.join(RAIZ, 'node_modules', 'playwright'))

const PADRAO = [
  ['lowpoly', 48],
  ['sprite', 16],
  ['detalhado', 48],
]
const TODAS = [['lowpoly', 32], ['lowpoly', 48], ['lowpoly', 64], ['sprite', 16], ['detalhado', 32], ['detalhado', 48], ['detalhado', 64]]

async function abrirNavegador() {
  const args = ['--ignore-gpu-blocklist']
  const tentativas = [{}, { channel: 'chrome' }, { channel: 'msedge' }]
  let ultimoErro = null
  for (const t of tentativas) {
    try {
      return await chromium.launch({ ...t, args })
    } catch (erro) {
      ultimoErro = erro
    }
  }
  throw new Error('Nenhum navegador abriu (playwright, Chrome ou Edge). Último erro: ' + ultimoErro.message)
}

;(async () => {
  const medir = process.argv.includes('--medir')
  const lista = medir ? TODAS : PADRAO
  const navegador = await abrirNavegador()
  const pagina = await navegador.newPage({ viewport: { width: 1440, height: 940 } })
  const erros = []
  pagina.on('pageerror', (e) => erros.push(e.message))
  const url = 'file:///' + path.join(PASTA, 'prototipo.html').split(path.sep).join('/')
  await pagina.goto(url)
  await pagina.waitForFunction(() => window.JudgePrototipo !== undefined, null, { timeout: 30000 })
  if (!medir) fs.mkdirSync(path.join(PASTA, 'folhas'), { recursive: true })
  for (const [estilo, px] of lista) {
    const r = await pagina.evaluate(([e, p]) => window.JudgePrototipo.folhaEmBase64(e, p), [estilo, px])
    const nome = `judge-${estilo}-${px}px.png`
    if (!medir) fs.writeFileSync(path.join(PASTA, 'folhas', nome), Buffer.from(r.base64, 'base64'))
    console.log(`${nome}: ${r.kb.toFixed(1)} KB, ${r.largura} x ${r.altura} px${medir ? ' (só medido)' : ''}`)
  }
  await navegador.close()
  if (erros.length) {
    console.error('Erros na página:\n' + erros.join('\n'))
    process.exit(1)
  }
})().catch((erro) => {
  console.error(erro.message)
  process.exit(1)
})
