/**
 * Monta os painéis da mesa de prova de um carimbo ou trecho do Desenhado (onda 3;
 * CONTRATO.md, seção 9). Quem chama é comum/mesa_carimbo.gd, que antes grava os chãos
 * (a grama aprovada, pela montagem de comum/compor.gdshader) e a grama do Atual.
 *
 * Abre o Chromium do Playwright, carrega a página (ferramentas/carimbo_pagina.ts, já
 * empacotada pelo esbuild) e chama `mesaDoCarimbo`: o Desenhado pela conta do contrato e
 * o Atual com o código do app, os dois no Canvas 2D, nos mesmos objetos.
 *
 * Uso: node carimbo.mjs --textura=<exportado/id> --paineis=<pasta> --pagina=<carimbo_pagina.js> [--sem-atual]
 * Lê em <paineis>: cena.json, chao-bosque-100.png, chao-soz-100.png, chao-soz-300.png e
 * atual-chao/atual-100.png. Grava em <paineis>: os painéis (.png) e paineis.json.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium, type Browser } from 'playwright'

function argumentos(): Map<string, string> {
  const m = new Map<string, string>()
  for (const a of process.argv.slice(2)) {
    const i = a.indexOf('=')
    if (a.startsWith('--')) m.set(i < 0 ? a.slice(2) : a.slice(2, i), i < 0 ? '' : a.slice(i + 1))
  }
  return m
}

/**
 * O Chromium que o Playwright quer pode não estar baixado (o pacote atualizou e o
 * navegador não): nesse caso usa o headless shell mais novo que já está na máquina, sem
 * baixar nada.
 */
async function abrirNavegador(): Promise<Browser> {
  try {
    return await chromium.launch({ headless: true })
  } catch (e) {
    const raiz = join(process.env.LOCALAPPDATA ?? '', 'ms-playwright')
    const candidatos = existsSync(raiz)
      ? readdirSync(raiz)
          .filter((n) => /^chromium_headless_shell-\d+$/.test(n))
          .map((n) => ({ n: Number(n.split('-')[1]), exe: join(raiz, n, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe') }))
          .filter((c) => existsSync(c.exe))
          .sort((a, b) => b.n - a.n)
      : []
    if (candidatos.length === 0) throw e
    return chromium.launch({ headless: true, executablePath: candidatos[0].exe })
  }
}

function dataUrl(caminho: string): string {
  return `data:image/png;base64,${readFileSync(caminho).toString('base64')}`
}

async function principal(): Promise<void> {
  const args = argumentos()
  const textura = args.get('textura')
  const paineis = args.get('paineis')
  const pagina = args.get('pagina')
  if (textura === undefined || paineis === undefined || pagina === undefined) throw new Error('uso: --textura=<pasta> --paineis=<pasta> --pagina=<js> [--sem-atual]')
  const params = JSON.parse(readFileSync(join(textura, 'textura.json'), 'utf8'))
  const cena = JSON.parse(readFileSync(join(paineis, 'cena.json'), 'utf8'))
  const sprites = params.tipo === 'carimbo' ? (params.sprite.arquivos as string[]).map((a) => dataUrl(join(textura, a))) : []
  const trecho = params.tipo === 'trecho' ? { cor: dataUrl(join(textura, params.trecho.arquivos.cor)), relevo: dataUrl(join(textura, params.trecho.arquivos.relevo)) } : null
  const atual = join(paineis, 'atual-chao', 'atual-100.png')
  const dados = {
    params,
    sprites,
    trecho,
    chao: { bosque100: dataUrl(join(paineis, 'chao-bosque-100.png')), soz100: dataUrl(join(paineis, 'chao-soz-100.png')), soz300: dataUrl(join(paineis, 'chao-soz-300.png')) },
    atualChao: existsSync(atual) ? dataUrl(atual) : null,
    cena,
    semAtual: args.has('sem-atual'),
  }
  const navegador = await abrirNavegador()
  try {
    const p = await navegador.newPage({ deviceScaleFactor: 1 })
    const erros: string[] = []
    p.on('pageerror', (e) => erros.push(String(e)))
    await p.setContent('<!doctype html><meta charset="utf-8"><body></body>')
    await p.addScriptTag({ path: pagina })
    const nomeDaFuncao = params.tipo === 'trecho' ? 'mesaDoTrecho' : 'mesaDoCarimbo'
    const r = (await p.evaluate(([f, d]) => (window as unknown as Record<string, (x: unknown) => Promise<unknown>>)[f as string](d), [nomeDaFuncao, dados] as const)) as {
      imagens: Record<string, string>
      info: Record<string, unknown>
    }
    if (erros.length > 0) throw new Error(erros.join('; '))
    const nomes: string[] = []
    for (const [nome, url] of Object.entries(r.imagens)) {
      writeFileSync(join(paineis, `${nome}.png`), Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'))
      nomes.push(nome)
    }
    writeFileSync(join(paineis, 'paineis.json'), JSON.stringify({ ...r.info, paineis: nomes }, null, 2))
    console.log(`carimbo: ${params.id} (${params.tipo}) ${nomes.length} painéis, ${String(r.info.objetos ?? '?')} objetos, Atual ${r.info.atual ? 'sim' : 'não'} -> ${paineis}`)
  } finally {
    await navegador.close()
  }
}

principal().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e))
  process.exit(1)
})
