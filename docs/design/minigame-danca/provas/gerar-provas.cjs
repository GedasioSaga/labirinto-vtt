'use strict'
/**
 * Provas do protótipo da Pista de Dança (não é código do app).
 *
 *   node docs/design/minigame-danca/provas/gerar-provas.cjs
 *
 * Monta um invólucro com doctype em volta de prototipo/index.html, abre no Edge
 * (Playwright, sem janela) e grava em provas/: testes.json, prints, folhas de
 * contato, gráfico do movimento, onda do som e os .wav. Também escreve o
 * adaptador som/faixa-demo.ts para o scripts/conferir-som.cjs medir a faixa.
 */
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('playwright')
const medidas = require('../../../../scripts/som/medidas.cjs')

const PROVAS = __dirname
const PROTO = path.join(PROVAS, '..', 'prototipo', 'index.html')
const PAGINA = path.join(PROVAS, 'pagina-de-teste.html')
const MP3 = process.env.MP3_REFERENCIA || path.join(PROVAS, '..', '..', '..', '..', 'Minigames', 'Dança', 'AudioCleaner_Download_MOTHER 3 - Funky Monkey Dance_Open Sesame! (The Good Part).mp3')
const salvarPng = (nome, dataUrl) => fs.writeFileSync(path.join(PROVAS, nome), Buffer.from(dataUrl.split(',')[1], 'base64'))

function montarPagina() {
  const corpo = fs.readFileSync(PROTO, 'utf8')
  fs.writeFileSync(PAGINA, `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>\n${corpo}\n</body></html>\n`)
  // Adaptador para o conferir-som: o MESMO bloco de som do protótipo, extraído entre os marcadores.
  const ini = corpo.indexOf('// ==== SOM:INICIO'), fim = corpo.indexOf('// ==== SOM:FIM ====')
  const bloco = corpo.slice(corpo.indexOf('\n', ini) + 1, fim)
  fs.mkdirSync(path.join(PROVAS, 'som'), { recursive: true })
  const cab = '// GERADO por gerar-provas.cjs a partir de prototipo/index.html (bloco SOM). Não editar à mão.\n// @ts-nocheck\n'
  fs.writeFileSync(path.join(PROVAS, 'som', 'faixa-demo.ts'), `${cab}${bloco}\nexport default function criar() {\n  return {\n    criarSom(kit) { const g = kit.ctx.createGain(); g.gain.value = SOM.GANHO; g.connect(kit.destino); SOM.agendar(kit.ctx, g, SOM.eventos(), kit.ctx.currentTime); return { atualizar() {} } },\n    atualizar() {},\n    descartar() {},\n  }\n}\n`)
  fs.writeFileSync(path.join(PROVAS, 'som', 'acerto-e-erro.ts'), `${cab}${bloco}\nexport default function criar() {\n  return {\n    criarSom(kit) { const g = kit.ctx.createGain(); g.gain.value = SOM.GANHO * 2; g.connect(kit.destino); const t = kit.ctx.currentTime; SOM.acerto(kit.ctx, g, t + 0.1, true); SOM.acerto(kit.ctx, g, t + 0.35, false); SOM.erro(kit.ctx, g, t + 0.6, true); SOM.erro(kit.ctx, g, t + 0.9, false); return { atualizar() {} } },\n    atualizar() {},\n    descartar() {},\n  }\n}\n`)
  return bloco
}

async function main() {
  montarPagina()
  const navegador = await chromium.launch({ channel: 'msedge', args: ['--autoplay-policy=no-user-gesture-required'] }).catch(() => chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }))
  const ctx = await navegador.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  await ctx.addInitScript(() => {
    // Controle falso para o teste da Gamepad API: os testes ligam botões em window.__pad.
    window.__pad = { index: 0, id: 'Controle de teste', timestamp: 0, buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] }
    navigator.getGamepads = () => [window.__pad]
    window.__longas = []
    try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__longas.push(e.duration))).observe({ type: 'longtask', buffered: true }) } catch {}
  })
  const page = await ctx.newPage()
  const erros = []
  page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()) })
  page.on('pageerror', (e) => erros.push(String(e)))
  await page.goto('file:///' + PAGINA.replace(/\\/g, '/'))
  await page.waitForFunction(() => window.PistaDeDanca)
  const R = { testes: [] }
  const ok = (nome, passou, detalhe) => { R.testes.push({ nome, passou: !!passou, detalhe }); console.log(`${passou ? 'PASSOU' : 'FALHOU'}  ${nome}${detalhe ? '  — ' + JSON.stringify(detalhe) : ''}`) }

  // ---------- 1. funções puras
  const puras = await page.evaluate(async () => {
    const P = window.PistaDeDanca
    const bordas = {}
    for (const d of ['diversao', 'expert']) {
      const j = P.DIF[d].janelas, casos = []
      for (const [ms, esperado] of [[0, 'perfeito'], [j.perfeito, 'perfeito'], [-j.perfeito, 'perfeito'], [j.perfeito + 0.01, 'bom'], [j.bom, 'bom'], [-(j.bom + 0.01), 'ok'], [j.ok, 'ok'], [-j.ok, 'ok'], [j.ok + 0.01, null], [-(j.ok + 0.01), d === 'expert' ? 'errou' : null], [-Math.max(P.DIF[d].errouCedo, P.DIF[d].janelas.ok) - 0.01, null]]) casos.push({ ms, esperado, obtido: P.julgar(ms, d) })
      bordas[d] = casos
    }
    const g = P.gradeDemo()
    const div1 = P.gerarChart(g, 'diversao', P.PINO_ID), div2 = P.gerarChart(g, 'diversao', P.PINO_ID)
    const exp1 = P.gerarChart(g, 'expert', P.PINO_ID), exp2 = P.gerarChart(g, 'expert', P.PINO_ID)
    const outra = P.gerarChart(g, 'diversao', 'outro-pino')
    const resumo = (ns) => {
      const tempos = ns.map((n) => n.t), unicos = [...new Set(tempos)]
      let saltos = 0; for (const t of unicos) if (tempos.filter((x) => x === t).length > 1) saltos++
      let gapMin = Infinity; for (let i = 1; i < unicos.length; i++) gapMin = Math.min(gapMin, unicos[i] - unicos[i - 1])
      let seguidas = 1, maxSeguidas = 1; for (let i = 1; i < ns.length; i++) { seguidas = ns[i].lane === ns[i - 1].lane && ns[i].t !== ns[i - 1].t ? seguidas + 1 : 1; maxSeguidas = Math.max(maxSeguidas, seguidas) }
      const dur = unicos[unicos.length - 1] - unicos[0]
      let pico = 0; for (const t of unicos) pico = Math.max(pico, unicos.filter((x) => x >= t && x < t + 4).length / 4)
      const porComp = {}; for (const n of ns) { const c = Math.floor(n.t / (P.SOM.COMPASSO) + 1e-6); porComp[c] = (porComp[c] || 0) + 1 }
      return { setas: ns.length, saltos, seguradas: ns.filter((n) => n.len > 0).length, gapMinMs: Math.round(gapMin * 1000), maxMesmaSeguida: maxSeguidas, mediaPorS: +(unicos.length / dur).toFixed(2), picoPorS4s: +pico.toFixed(2), maxPorCompasso: Math.max(...Object.values(porComp)), quadros: { 4: ns.filter((n) => n.sub === 4).length, 8: ns.filter((n) => n.sub === 8).length, 16: ns.filter((n) => n.sub === 16).length } }
    }
    const tempoEventos = new Set(P.SOM.eventos().filter((e) => e.inst !== 'chimbal' && e.inst !== 'baqueta').map((e) => e.t.toFixed(6)))
    const casada = (ns) => ns.every((n) => tempoEventos.has(n.t.toFixed(6)))
    // detector de BPM: faixa demo e dois trilhos de cliques sintéticos
    const demo = await P.SOM.renderizar(48000)
    const an = await P.ANALISE.analisar(demo)
    const P0 = 60 / P.SOM.BPM, faseErr = (((an.primeiraBatida % P0) + P0 + P0 / 2) % P0) - P0 / 2
    const sint = []
    for (const [bpm, off] of [[95, 0.37], [140, 0.81]]) {
      const sr = 44100, dur = 30, buf = new AudioBuffer({ length: sr * dur, sampleRate: sr, numberOfChannels: 1 }), d = buf.getChannelData(0)
      let s = 1; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647 - 0.5 }
      for (let k = 0; ; k++) { const t = off + k * 60 / bpm; if (t > dur - 0.2) break; const i0 = Math.round(t * sr); for (let i = 0; i < 2000; i++) d[i0 + i] += (k % 2 ? 0.5 : 0.9) * rnd() * Math.exp(-i / 300) + (k % 4 === 0 ? 0.6 * Math.sin(i / sr * 2 * Math.PI * 60) * Math.exp(-i / 1500) : 0) }
      const a = await P.ANALISE.analisar(buf), Pp = 60 / bpm, fe = ((((a.primeiraBatida - off) % Pp) + Pp + Pp / 2) % Pp) - Pp / 2
      sint.push({ bpmReal: bpm, bpmAchado: +a.bpm.toFixed(2), erroFaseMs: Math.round(fe * 1000) })
    }
    const toques = P.ANALISE.ajustarToques([0.512, 1.03, 1.548, 2.061, 2.583, 3.098, 3.61, 4.131])
    return {
      bordas, deterministico: JSON.stringify(div1) === JSON.stringify(div2) && JSON.stringify(exp1) === JSON.stringify(exp2), sementeMuda: JSON.stringify(div1) !== JSON.stringify(outra),
      diversao: resumo(div1), expert: resumo(exp1), casadaDiv: casada(div1), casadaExp: casada(exp1),
      demoBpm: +an.bpm.toFixed(2), demoFaseErroMs: Math.round(faseErr * 1000), demoConfianca: +an.confianca.toFixed(2), sint,
      toquesBpm: toques ? +(60 / toques.periodo).toFixed(2) : null,
      teclas: { setas: ['ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowRight', 'KeyA', 'KeyS', 'KeyW', 'KeyD', 'KeyF'].map((c) => P.laneDaTecla(c, 'setas')), dfjk: ['KeyD', 'KeyF', 'KeyJ', 'KeyK', 'KeyA', 'ArrowUp'].map((c) => P.laneDaTecla(c, 'dfjk')) },
      controle: [12, 13, 14, 15, 0, 1, 2, 3].map((b) => { const pad = { buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: i === b })), axes: [0, 0] }; return P.lanesDoControle(pad).indexOf(true) }),
      eixos: [[-1, 0], [1, 0], [0, -1], [0, 1]].map(([x, y]) => P.lanesDoControle({ buttons: [], axes: [x, y] }).indexOf(true)),
    }
  })
  for (const d of ['diversao', 'expert']) { const falhas = puras.bordas[d].filter((c) => c.obtido !== c.esperado); ok(`julgamento nas bordas das janelas (${d})`, falhas.length === 0, falhas.length ? falhas : `${puras.bordas[d].length} casos`) }
  ok('coreografia determinística (mesma semente, mesmas setas) e semente diferente muda', puras.deterministico && puras.sementeMuda)
  const dv = puras.diversao, ex = puras.expert
  ok('Diversão: sem saltos, sem seguradas, só tempos fortes, intervalo ≥ 450 ms, ≤ 3 por compasso, nunca 4 iguais seguidas', dv.saltos === 0 && dv.seguradas === 0 && dv.quadros[8] === 0 && dv.quadros[16] === 0 && dv.gapMinMs >= 450 && dv.maxPorCompasso <= 3 && dv.maxMesmaSeguida <= 3, dv)
  ok('Expert: tem saltos, seguradas e colcheias/semicolcheias', ex.saltos > 0 && ex.seguradas > 0 && ex.quadros[8] > 0 && ex.quadros[16] > 0 && ex.maxMesmaSeguida <= 3, ex)
  ok('faixa demo: toda seta cai num ataque que a música toca', puras.casadaDiv && puras.casadaExp)
  ok('BPM da faixa demo detectado (116)', Math.abs(puras.demoBpm - 116) <= 0.3 && Math.abs(puras.demoFaseErroMs) <= 15, { bpm: puras.demoBpm, erroFaseMs: puras.demoFaseErroMs, confianca: puras.demoConfianca })
  ok('BPM de cliques sintéticos (95 e 140)', puras.sint.every((s) => Math.abs(s.bpmAchado - s.bpmReal) <= 0.5 && Math.abs(s.erroFaseMs) <= 20), puras.sint)
  ok('tempo batido à mão (8 toques ~116 BPM)', puras.toquesBpm && Math.abs(puras.toquesBpm - 116) < 1, puras.toquesBpm)
  ok('teclado: setas, WASD e DFJK', JSON.stringify(puras.teclas) === JSON.stringify({ setas: [0, 1, 2, 3, 0, 1, 2, 3, -1], dfjk: [0, 1, 2, 3, -1, 2] }), puras.teclas)
  ok('controle: direcional, losango de botões e analógico', JSON.stringify(puras.controle) === '[2,1,0,3,1,3,0,2]' && JSON.stringify(puras.eixos) === '[0,3,2,1]', { botoes: puras.controle, eixos: puras.eixos })
  R.puras = puras

  // ---------- 2. música da referência (só lida do disco local, nunca copiada para o repo)
  if (fs.existsSync(MP3)) {
    await page.locator('[data-visao="mestre"]').click()
    await page.setInputFiles('#fArquivo', MP3)
    await page.waitForFunction(() => window.PistaDeDanca.importada, null, { timeout: 60000 })
    R.referencia = await page.evaluate(() => { const a = window.PistaDeDanca.importada.analise; return { bpm: +a.bpm.toFixed(2), primeiraBatida: +a.primeiraBatida.toFixed(3), confianca: +a.confianca.toFixed(2), duracao: +a.duracao.toFixed(2), fase4: a.fase4 } })
    console.log('MP3 da referência:', R.referencia)
    await page.locator('input[name="musica"][value="demo"]').check()
    await page.locator('[data-visao="jogador"]').click()
  }

  // ---------- 3. jogo de verdade: jogador perfeito por eventos de teclado, Diversão, música demo
  const tocarPerfeito = (dif, modoTeclas) => page.evaluate(({ dif, modoTeclas }) => new Promise((ok) => {
    const P = window.PistaDeDanca
    P.prefs.teclas = modoTeclas
    const codigos = modoTeclas === 'dfjk' ? ['KeyD', 'KeyF', 'KeyJ', 'KeyK'] : ['ArrowLeft', 'KeyS', 'ArrowUp', 'KeyD']
    document.querySelector(`input[name="dif"][value="${dif}"]`).click()
    document.querySelector('#bEntrar').click()
    const espera = setInterval(() => {
      if (P.jogo.fase !== 'tocando' || !P.jogo.notas) return
      clearInterval(espera)
      window.__longas.length = 0; P.amostras.quadros.length = 0; P.amostras.trabalho.length = 0
      const feitas = new Set()
      const passo = () => {
        if (P.jogo.fase === 'fim') return ok(true)
        const st = P.tempoMusica(performance.now())
        P.jogo.notas.forEach((n, i) => {
          if (feitas.has(i) || n.t - st > 0.004) return
          feitas.add(i)
          window.dispatchEvent(new KeyboardEvent('keydown', { code: codigos[n.lane], bubbles: true }))
          setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: codigos[n.lane], bubbles: true })), n.len > 0 ? n.len * 1000 + 30 : 60)
        })
        setTimeout(passo, 2)
      }
      passo()
    }, 20)
  }), { dif, modoTeclas })
  await tocarPerfeito('diversao', 'setas')
  const jogada = await page.evaluate(() => {
    const P = window.PistaDeDanca, q = P.amostras.quadros.slice().sort((a, b) => a - b), w = P.amostras.trabalho.slice().sort((a, b) => a - b)
    const pct = (v, k) => v.length ? +v[Math.floor(v.length * k)].toFixed(2) : null
    return { placar: P.jogo.placar, motivo: P.jogo.motivo, letra: document.querySelector('#rLetra').textContent, titulo: document.querySelector('#rTitulo').textContent, quadroP95: pct(q, 0.95), quadroP50: pct(q, 0.5), trabalhoP95: pct(w, 0.95), trabalhoMax: w.length ? +w[w.length - 1].toFixed(2) : null, quadros: q.length, longas: window.__longas.slice() }
  })
  ok('Diversão inteira com toques por teclado (setas e WASD): termina, julga e dá nota', jogada.motivo === 'fim' && jogada.placar.perfeito > 0 && ['S', 'A'].includes(jogada.letra), { letra: jogada.letra, perfeito: jogada.placar.perfeito, bom: jogada.placar.bom, ok: jogada.placar.ok, errou: jogada.placar.errou })
  ok('tempo de quadro p95 < 20 ms e nenhuma tarefa longa ≥ 200 ms durante o jogo', jogada.quadroP95 < 20 && jogada.longas.every((d) => d < 200), { quadroP50: jogada.quadroP50, quadroP95: jogada.quadroP95, trabalhoP95: jogada.trabalhoP95, trabalhoMax: jogada.trabalhoMax, quadros: jogada.quadros, tarefasLongas: jogada.longas })
  R.jogada = jogada
  await page.waitForTimeout(3000)
  await page.screenshot({ path: path.join(PROVAS, 'resultado-1440.png') })

  // ---------- 4. Expert com DFJK: toques reais por ponteiro e controle, depois ninguém toca e a vida zera
  const expert = await page.evaluate(() => new Promise((ok) => {
    const P = window.PistaDeDanca
    P.prefs.teclas = 'dfjk'
    document.querySelector('input[name="dif"][value="expert"]').click()
    document.querySelector('#bEntrar').click()
    const marcas = {}
    const espera = setInterval(() => {
      if (P.jogo.fase !== 'tocando') return
      clearInterval(espera)
      const pad = document.querySelector('.pad[data-lane="2"]')
      pad.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7, bubbles: true }))
      marcas.ponteiro = P.jogo.apertadas[2]
      pad.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, bubbles: true }))
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyK', bubbles: true }))
      marcas.dfjk = P.jogo.apertadas[3]
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyK', bubbles: true }))
      window.__pad.buttons[14].pressed = true; window.__pad.timestamp = performance.now()
      requestAnimationFrame(() => requestAnimationFrame(() => {
        marcas.controle = P.jogo.apertadas[0]
        window.__pad.buttons[14].pressed = false
        const fim = setInterval(() => { if (P.jogo.fase === 'fim') { clearInterval(fim); ok({ marcas, motivo: P.jogo.motivo, vida: P.jogo.placar.vida, letra: document.querySelector('#rLetra').textContent, st: +P.jogo.st.toFixed(2) }) } }, 50)
      }))
    }, 20)
  }))
  ok('toque nos botões da tela, tecla K (DFJK) e direcional do controle chegam às trilhas', expert.marcas.ponteiro && expert.marcas.dfjk && expert.marcas.controle, expert.marcas)
  ok('Expert: vida zera e encerra com "Falhou"', expert.motivo === 'falhou' && expert.vida === 0 && expert.letra === 'Falhou', expert)

  // ---------- 5. rolagem horizontal nos 3 tamanhos e prints
  const rolagem = []
  for (const [w, h] of [[1440, 900], [1024, 768], [390, 844]]) {
    await page.setViewportSize({ width: w, height: h })
    for (const cena of ['convite', 'pista', 'resultado', 'mestre']) {
      await page.evaluate((cena) => { const P = window.PistaDeDanca; P.trocarVisao(cena === 'mestre' ? 'mestre' : 'jogador'); if (cena !== 'mestre') P.irPara(cena) }, cena)
      await page.waitForTimeout(120)
      const r = await page.evaluate(() => { const els = [document.documentElement, ...document.querySelectorAll('.tela, .mestre, .coluna, .painel, .hud')].filter((e) => e.offsetParent !== null || e === document.documentElement); const pior = els.find((e) => e.scrollWidth > e.clientWidth + 1); return { ok: !pior, onde: pior ? (pior.id || pior.className) : null, largura: document.documentElement.scrollWidth } })
      rolagem.push({ w, cena, ...r })
    }
  }
  const ruins = rolagem.filter((r) => !r.ok)
  ok('sem rolagem horizontal em 1440, 1024 e 390 (convite, pista, resultado, mestre)', ruins.length === 0, ruins.length ? ruins : `${rolagem.length} combinações`)

  // prints do jogo em andamento (Diversão, demo) em 1440 e 390, e o mestre em 1440
  const printJogo = async (w, h, nome) => {
    await page.setViewportSize({ width: w, height: h })
    await page.evaluate(() => { const P = window.PistaDeDanca; P.trocarVisao('jogador'); P.prefs.teclas = 'setas'; P.irPara('convite'); document.querySelector('input[name="dif"][value="diversao"]').click(); document.querySelector('#bEntrar').click() })
    await page.waitForFunction(() => window.PistaDeDanca.jogo.fase === 'tocando')
    await page.evaluate(() => new Promise((ok) => { const P = window.PistaDeDanca; const codigos = ['ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowRight']; const feitas = new Set(); const passo = () => { const st = P.tempoMusica(performance.now()); if (st > 21.6) return ok(); P.jogo.notas.forEach((n, i) => { if (!feitas.has(i) && n.t - st < 0.004) { feitas.add(i); window.dispatchEvent(new KeyboardEvent('keydown', { code: codigos[n.lane] })); setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: codigos[n.lane] })), 60) } }); setTimeout(passo, 2) }; passo() }))
    await page.screenshot({ path: path.join(PROVAS, nome) })
    await page.evaluate(() => window.PistaDeDanca.terminar('mestre'))
  }
  await printJogo(1440, 900, 'jogador-1440.png')
  await printJogo(390, 844, 'jogador-390.png')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.evaluate(() => window.PistaDeDanca.trocarVisao('mestre'))
  await page.waitForTimeout(150)
  await page.screenshot({ path: path.join(PROVAS, 'mestre-1440.png') })
  await page.evaluate(() => window.PistaDeDanca.trocarVisao('jogador'))

  // ---------- 6. folhas de contato e gráfico do movimento (desenhados na página, mesmas funções do jogo)
  const folhas = await page.evaluate(() => {
    const P = window.PistaDeDanca
    const S = { g: null, w: 200, h: 120 }
    const base = document.createElement('canvas'); base.width = S.w; base.height = S.h; S.g = base.getContext('2d')
    P.prepararCenario(S)
    const vazioPorta = P.estadoPorta(null)
    const quadroDe = (cena) => { P.desenharPalco(S, Object.assign({ porta: vazioPorta, runas: [0, 0, 0, 0], chao: 0, batida: 0, reduzido: false, holofote: 0, voce: { pose: P.POSE_PARADA, bob: 0 }, bots: [{ id: 'iara', pose: P.POSE_PARADA, bob: 0 }, { id: 'tome', pose: P.POSE_PARADA, bob: 0 }], poeira: [] }, cena)); return base }
    const folha = (titulo, itens, recorte) => {
      const esc = 3, col = 4, [rx, ry, rw, rh] = recorte, lw = rw * esc, lh = rh * esc, linhas = Math.ceil(itens.length / col)
      const c = document.createElement('canvas'); c.width = col * (lw + 12) + 12; c.height = 44 + linhas * (lh + 40); const g = c.getContext('2d')
      g.fillStyle = '#121214'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#eceae4'; g.font = '600 15px Segoe UI, sans-serif'; g.fillText(titulo, 12, 26)
      itens.forEach((it, i) => { const x = 12 + (i % col) * (lw + 12), y = 40 + Math.floor(i / col) * (lh + 40); g.imageSmoothingEnabled = false; g.drawImage(quadroDe(it.cena), rx, ry, rw, rh, x, y, lw, lh); g.fillStyle = '#a2a09a'; g.font = '12px Segoe UI, sans-serif'; g.fillText(it.rotulo, x, y + lh + 16); g.fillStyle = '#e0a44a'; g.fillText(it.tempo, x, y + lh + 31) })
      return c.toDataURL('image/png')
    }
    // poses: sequência tocada no tempo, amostrada pela mesma máquina de estados do jogo
    P.jogo.batidaS = P.SOM.PASSO * 4; P.jogo.grade0 = 0
    const d = P.novoDancarino(), seq = [[0.0, [0]], [0.26, [3]], [0.52, [2]], [0.78, [1]], [1.03, [1]], [1.29, [0, 3]], [1.55, [0, 2]], [1.81, [2, 3]], [2.07, [1, 2]], [2.33, [1, 3]], [2.59, 'erro'], [2.85, 'gentil']]
    const poses = seq.map(([t, l]) => {
      if (l === 'erro') P.dancar(d, 0, t, true, false); else if (l === 'gentil') P.dancar(d, 0, t, true, true); else l.forEach((x) => P.dancar(d, x, t, false))
      const rot = l === 'erro' ? 'Errou: tropeça (Expert)' : l === 'gentil' ? 'Errou: "ops" (Diversão)' : l.map((x) => '←↓↑→'[x]).join(' + ')
      return { rotulo: rot, tempo: `t = ${t.toFixed(2).replace('.', ',')} s`, cena: { voce: P.poseNoTempo(d, t + 0.05), holofote: Math.min(3, t), chao: t > 1.5 ? 0.7 : 0, batida: t / P.jogo.batidaS } }
    })
    const r = S.w / 2 - 50, folhaPoses = folha('Poses do dançarino (uma por seta; duas setas juntas = pose combinada)', poses, [r, 34, 100, 82])
    const porta = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1.2, 1.5, 1.8, 2.1, 2.4].map((s) => ({ rotulo: s === 0 ? 'fechada' : s < 0.6 ? 'runas acendem' : s < 0.9 ? 'fresta de luz' : 'folhas abrem', tempo: `t = ${s.toFixed(2).replace('.', ',')} s`, cena: { porta: P.estadoPorta(s, false), holofote: 2, voce: { pose: P.POSE_PARADA, bob: 0 } } }))
    const folhaPorta = folha('Porta abrindo (passou da nota mínima): 2,4 s', porta, [S.w / 2 - 40, 0, 80, 74])
    // gráfico do movimento: estado amostrado a cada 0,1 s, sem desenhar
    const curvas = []
    const amostra = (fim, f) => { const xs = []; for (let t = 0; t <= fim + 1e-9; t += 0.1) xs.push([+t.toFixed(2), f(t)]); return xs }
    curvas.push({ titulo: 'Porta: abertura das folhas e luz (0 a 1)', fim: 2.6, series: [['abertura', '#e0a44a', amostra(2.6, (t) => P.estadoPorta(t, false).abre)], ['luz', '#79a9cc', amostra(2.6, (t) => P.estadoPorta(t, false).luz)], ['runas (média)', '#ab93d6', amostra(2.6, (t) => P.estadoPorta(t, false).runas.reduce((a, b) => a + b, 0) / 4)], ['movimento reduzido', '#858480', amostra(2.6, (t) => P.estadoPorta(t, true).abre)]] })
    const d2 = P.novoDancarino(), roteiro = [[0, [0]], [0.5, [1]], [1.0, [2]], [1.5, [0, 3]], [2.0, 'erro']]
    const hip = [], mao = []
    for (let t = 0; t <= 3.0001; t += 0.1) {
      for (const [tt, l] of roteiro) if (tt <= t + 1e-9 && tt > t - 0.1 + 1e-9) { if (l === 'erro') P.dancar(d2, 0, tt, true, false); else l.forEach((x) => P.dancar(d2, x, tt, false)) }
      const pn = P.poseNoTempo(d2, t), pf = P.pontosFigura(0, 0, P.DIM.grande, pn.pose, pn.bob)
      hip.push([+t.toFixed(2), -pf.qY]); mao.push([+t.toFixed(2), -pf.dir.mao[1]])
    }
    curvas.push({ titulo: 'Dançarino: altura do quadril e da mão direita (px do palco); ← 0 s, ↓ 0,5 s, ↑ 1 s, ←+→ 1,5 s, erro 2 s', fim: 3, series: [['quadril', '#e0a44a', hip], ['mão direita', '#79a9cc', mao]] })
    let h = 0; const holo = amostra(5, (t) => { const alvo = t < 1 ? 0 : t < 2 ? 1 : t < 3 ? 2 : t < 4 ? 3 : 0; h += (alvo - h) * (1 - Math.exp(-0.1 / 0.12)); return h })
    curvas.push({ titulo: 'Holofote: nível pelo combo (10, 25, 50; erro em 4 s), troca suave de 0,12 s', fim: 5, series: [['nível', '#e0a44a', holo]] })
    return { folhaPoses, folhaPorta, curvas }
  })
  salvarPng('folha-poses.png', folhas.folhaPoses)
  salvarPng('folha-porta.png', folhas.folhaPorta)

  // julgamento e combo: o elemento de verdade, com a animação parada em cada instante
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.evaluate(() => { const P = window.PistaDeDanca; P.trocarVisao('jogador'); P.irPara('pista'); P.jogo.placar = { perfeito: 0, bom: 0, ok: 0, errou: 0, segOk: 0, segTotal: 0, combo: 24, comboMax: 24, peso: 0, julgadas: 0, vida: 60 }; P.jogo.dif = 'diversao'; P.atualizarHud(true); P.mostrarJulg('perfeito') })
  const caixa = await page.locator('#campo').boundingBox()
  const tempos = [0, 16, 33, 50, 66, 91, 150, 250, 400, 455, 520, 600, 650]
  const julgQuadros = [], julgCurva = []
  for (const t of tempos) {
    const est = await page.evaluate((t) => { const el = document.querySelector('#julg'); el.getAnimations().forEach((a) => { a.pause(); a.currentTime = t }); const cs = getComputedStyle(el); return { opacidade: +cs.opacity, transform: cs.transform } }, t)
    const m = /matrix\(([^,]+)/.exec(est.transform)
    julgCurva.push([t / 1000, est.opacidade, m ? +m[1] : 1])
    const png = await page.screenshot({ clip: { x: caixa.x + caixa.width / 2 - 110, y: caixa.y + caixa.height * 0.42 - 40, width: 220, height: 110 } })
    julgQuadros.push({ t, src: 'data:image/png;base64,' + png.toString('base64') })
  }
  const folhaJulg = await page.evaluate(async (qs) => {
    const imgs = await Promise.all(qs.map((q) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = q.src })))
    const col = 4, lw = 220, lh = 110, c = document.createElement('canvas'); c.width = col * (lw + 12) + 12; c.height = 44 + Math.ceil(qs.length / col) * (lh + 28); const g = c.getContext('2d')
    g.fillStyle = '#121214'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#eceae4'; g.font = '600 15px Segoe UI, sans-serif'; g.fillText('Julgamento e combo: "Perfeito" com combo 24 (animação de 650 ms)', 12, 26)
    imgs.forEach((im, i) => { const x = 12 + (i % col) * (lw + 12), y = 40 + Math.floor(i / col) * (lh + 28); g.drawImage(im, x, y); g.fillStyle = '#e0a44a'; g.font = '12px Segoe UI, sans-serif'; g.fillText(`t = ${qs[i].t} ms`, x, y + lh + 16) })
    return c.toDataURL('image/png')
  }, julgQuadros)
  salvarPng('folha-julgamento.png', folhaJulg)
  folhas.curvas.push({ titulo: 'Julgamento: opacidade e escala (WAAPI medida no navegador)', fim: 0.65, series: [['opacidade', '#e0a44a', julgCurva.map(([t, o]) => [t, o])], ['escala − 1 (×10)', '#79a9cc', julgCurva.map(([t, , s]) => [t, (s - 1) * 10])]] })
  const grafico = await page.evaluate((curvas) => {
    const lw = 640, lh = 170, c = document.createElement('canvas'); c.width = lw + 80; c.height = curvas.length * (lh + 70) + 20; const g = c.getContext('2d')
    g.fillStyle = '#fcfcfb'; g.fillRect(0, 0, c.width, c.height)
    curvas.forEach((cv, k) => {
      const x0 = 56, y0 = 30 + k * (lh + 70), todos = cv.series.flatMap((s) => s[2].map((p) => p[1])), mn = Math.min(0, ...todos), mx = Math.max(1, ...todos)
      const X = (t) => x0 + (t / cv.fim) * lw, Y = (v) => y0 + lh - ((v - mn) / (mx - mn)) * lh
      g.fillStyle = '#1d232b'; g.font = '600 13px Segoe UI, sans-serif'; g.fillText(cv.titulo, x0, y0 - 10)
      g.strokeStyle = '#d5d8dc'; g.lineWidth = 1; g.font = '11px Segoe UI, sans-serif'; g.fillStyle = '#5b6470'
      for (let i = 0; i <= 4; i++) { const v = mn + ((mx - mn) * i) / 4, y = Y(v); g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + lw, y); g.stroke(); g.fillText(v.toFixed(1).replace('.', ','), 18, y + 4) }
      const passo = cv.fim > 2 ? 0.5 : 0.1
      for (let t = 0; t <= cv.fim + 1e-9; t += passo) g.fillText(t.toFixed(1).replace('.', ',') + ' s', X(t) - 10, y0 + lh + 16)
      cv.series.forEach(([nome, cor, pts], i) => { g.strokeStyle = cor; g.lineWidth = 2; g.beginPath(); pts.forEach(([t, v], j) => (j ? g.lineTo(X(t), Y(v)) : g.moveTo(X(t), Y(v)))); g.stroke(); g.fillStyle = cor; pts.forEach(([t, v]) => g.fillRect(X(t) - 1.5, Y(v) - 1.5, 3, 3)); g.font = '12px Segoe UI, sans-serif'; g.fillText(nome, x0 + 8 + i * 150, y0 + lh + 34) })
    })
    return c.toDataURL('image/png')
  }, folhas.curvas)
  salvarPng('grafico-movimento.png', grafico)

  // ---------- 7. som: faixa demo e sons de acerto/erro renderizados offline, .wav e medidas
  const som = await page.evaluate(async () => {
    const P = window.PistaDeDanca, b64 = (f) => { const u = new Uint8Array(f.buffer, f.byteOffset, f.byteLength); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s) }
    const demo = await P.SOM.renderizar(48000)
    const off = new OfflineAudioContext(2, 48000 * 1.3, 48000), g = off.createGain(); g.gain.value = P.SOM.GANHO * 2; g.connect(off.destination)
    P.SOM.acerto(off, g, 0.1, true); P.SOM.acerto(off, g, 0.35, false); P.SOM.erro(off, g, 0.6, true); P.SOM.erro(off, g, 0.9, false)
    const fx = await off.startRendering()
    const notas = P.gerarChart(P.gradeDemo(), 'expert', P.PINO_ID).map((n) => n.t)
    return { taxa: 48000, demo: [0, 1].map((c) => b64(demo.getChannelData(c))), fx: [0, 1].map((c) => b64(fx.getChannelData(c))), notas }
  })
  const deB64 = (s) => { const b = Buffer.from(s, 'base64'); return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4) }
  const canaisDemo = som.demo.map(deB64), canaisFx = som.fx.map(deB64)
  fs.mkdirSync(path.join(PROVAS, 'som'), { recursive: true })
  fs.writeFileSync(path.join(PROVAS, 'som', 'faixa-demo.wav'), medidas.wav16(canaisDemo, som.taxa))
  fs.writeFileSync(path.join(PROVAS, 'som', 'acerto-e-erro.wav'), medidas.wav16(canaisFx, som.taxa))
  const mDemo = medidas.medirTudo(canaisDemo, som.taxa), mFx = medidas.medirTudo(canaisFx, som.taxa)
  const resumoSom = (m) => Object.fromEntries(Object.entries(m).filter(([, v]) => typeof v !== 'object' || v === null))
  R.som = { demo: resumoSom(mDemo), acertoErro: resumoSom(mFx) }
  console.log('som demo:', JSON.stringify(R.som.demo))
  console.log('som acerto/erro:', JSON.stringify(R.som.acertoErro))
  const envD = medidas.envoltoria(canaisDemo, som.taxa, 0.02), envF = medidas.envoltoria(canaisFx, som.taxa, 0.005)
  const onda = await page.evaluate(({ envD, envF, notas, durD }) => {
    const lw = 1100, lh = 150, c = document.createElement('canvas'); c.width = lw + 90; c.height = 2 * (lh + 80) + 20; const g = c.getContext('2d')
    g.fillStyle = '#fcfcfb'; g.fillRect(0, 0, c.width, c.height)
    const linha = (k, titulo, env, dur, marcas, rotMarcas) => {
      const x0 = 60, y0 = 34 + k * (lh + 80), arr = Array.isArray(env) ? env : (env.rms || env.pico || Object.values(env)[0]), n = arr.length, max = Math.max(...arr.map((v) => Math.abs(v)), 1e-6)
      g.fillStyle = '#1d232b'; g.font = '600 13px Segoe UI, sans-serif'; g.fillText(titulo, x0, y0 - 12)
      g.fillStyle = '#e0a44a'; for (let i = 0; i < n; i++) { const v = Math.abs(arr[i]) / max, x = x0 + (i / n) * lw; g.fillRect(x, y0 + lh / 2 - (v * lh) / 2, Math.max(1, lw / n), v * lh) }
      g.fillStyle = '#5b6470'; g.font = '11px Segoe UI, sans-serif'
      const passo = dur > 5 ? 5 : 0.1
      for (let t = 0; t <= dur + 1e-9; t += passo) { const x = x0 + (t / dur) * lw; g.fillRect(x, y0 + lh + 2, 1, 5); g.fillText(t.toFixed(passo < 1 ? 1 : 0).replace('.', ',') + ' s', x - 8, y0 + lh + 18) }
      g.fillStyle = 'rgba(121,169,204,0.9)'; for (const t of marcas) g.fillRect(x0 + (t / dur) * lw, y0 + lh + 24, 1, 8)
      g.fillStyle = '#1d232b'; g.fillText(rotMarcas, x0, y0 + lh + 48)
    }
    linha(0, 'Faixa demo "Gingado do Salão Fundo": envoltória (pico a cada 20 ms), 116 BPM', envD, durD, notas, 'traços azuis: setas do Expert, na mesma linha do tempo')
    linha(1, 'Sons do jogo: acerto Perfeito (0,1 s), acerto (0,35 s), erro gentil da Diversão (0,6 s), erro do Expert (0,9 s)', envF, 1.3, [0.1, 0.35, 0.6, 0.9], 'traços azuis: instante agendado de cada som')
    return c.toDataURL('image/png')
  }, { envD, envF, notas: som.notas, durD: canaisDemo[0].length / som.taxa })
  salvarPng('onda-som.png', onda)

  R.errosConsole = erros
  ok('sem erro no console', erros.length === 0, erros)
  fs.writeFileSync(path.join(PROVAS, 'testes.json'), JSON.stringify(R, null, 2))
  await navegador.close()
  const falhas = R.testes.filter((t) => !t.passou).length
  console.log(`\n${R.testes.length - falhas} de ${R.testes.length} testes passaram.`)
  process.exitCode = falhas ? 1 : 0
}
main().catch((e) => { console.error(e); process.exitCode = 2 })
