/*
 * Gera as imagens da folha da Pintura: abre fonte/gerar.html num Chromium sem janela
 * (Playwright do repo), chama gerarTudo() e grava os PNG na pasta de cima.
 * Uso, da raiz do repo: node docs/design/pintura-objeto/fonte/gerar.cjs
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const PASTA = path.resolve(__dirname, '..');
const RAIZ_DO_REPO = path.resolve(__dirname, '..', '..', '..', '..');
const { chromium } = require(path.join(RAIZ_DO_REPO, 'node_modules', 'playwright'));

/**
 * O Chromium que o Playwright do repo pede pode não estar baixado. Sem baixar nada, usa o
 * mais novo já instalado em %LOCALAPPDATA%/ms-playwright (headless shell primeiro).
 */
function chromiumInstalado() {
  const base = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (!fs.existsSync(base)) return undefined;
  const candidatos = [];
  for (const pasta of fs.readdirSync(base)) {
    const m = /^(chromium_headless_shell|chromium)-(\d+)$/.exec(pasta);
    if (!m) continue;
    const exe = m[1] === 'chromium'
      ? path.join(base, pasta, 'chrome-win64', 'chrome.exe')
      : path.join(base, pasta, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
    if (fs.existsSync(exe)) candidatos.push({ exe, versao: Number(m[2]), shell: m[1] !== 'chromium' });
  }
  candidatos.sort((a, b) => b.versao - a.versao || Number(b.shell) - Number(a.shell));
  return candidatos.length ? candidatos[0].exe : undefined;
}

async function principal() {
  let navegador;
  try {
    navegador = await chromium.launch();
  } catch (e) {
    const exe = chromiumInstalado();
    if (!exe) throw e;
    console.log('Usando o Chromium já instalado: ' + exe);
    navegador = await chromium.launch({ executablePath: exe });
  }
  try {
    const pagina = await navegador.newPage();
    const erros = [];
    pagina.on('pageerror', (e) => erros.push(e.message));
    pagina.on('console', (m) => {
      if (m.type() === 'error') erros.push(m.text());
    });
    await pagina.goto(pathToFileURL(path.join(__dirname, 'gerar.html')).href);
    await pagina.waitForFunction(() => window.pronto === true && typeof window.gerarTudo === 'function');
    const inicio = Date.now();
    const saidas = await pagina.evaluate(() => window.gerarTudo());
    for (const [nome, dataUrl] of Object.entries(saidas)) {
      const bytes = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
      fs.writeFileSync(path.join(PASTA, nome), bytes);
      console.log(nome + '  ' + Math.round(bytes.length / 1024) + ' KB');
    }
    console.log('desenho em ' + (Date.now() - inicio) + ' ms');
    if (erros.length) {
      console.error('Erros na página:\n' + erros.join('\n'));
      process.exitCode = 1;
    }
  } finally {
    await navegador.close();
  }
}

principal().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
