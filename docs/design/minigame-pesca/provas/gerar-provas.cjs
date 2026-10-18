'use strict'
/**
 * Provas do protótipo do Poço de Pesca (não é código do app).
 *
 *   node docs/design/minigame-pesca/provas/gerar-provas.cjs            (tudo, inclusive o conferir-som)
 *   node docs/design/minigame-pesca/provas/gerar-provas.cjs --sem-conferir
 *
 * Monta um invólucro com doctype em volta de prototipo/index.html, abre no Edge
 * (Playwright do repo, sem janela) e grava em provas/: testes.json, 4 prints, a
 * folha de contato, o gráfico do movimento, a onda do som e o .wav. Escreve o
 * adaptador som/sons-da-pesca.ts (o MESMO bloco SOM do protótipo) e roda o
 * scripts/conferir-som.cjs nele; a saída fica em som/conferir-som.txt.
 */
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { chromium } = require('playwright')
const medidas = require('../../../../scripts/som/medidas.cjs')

const PROVAS = __dirname
const RAIZ = path.resolve(PROVAS, '..', '..', '..', '..')
const PROTO = path.join(PROVAS, '..', 'prototipo', 'index.html')
const PAGINA = path.join(PROVAS, 'pagina-de-teste.html')
const SOM_DIR = path.join(PROVAS, 'som')
const salvarPng = (nome, dataUrl) => fs.writeFileSync(path.join(PROVAS, nome), Buffer.from(dataUrl.split(',')[1], 'base64'))
const pct = (v) => Math.round(v * 1000) / 10

function montarPagina() {
  const corpo = fs.readFileSync(PROTO, 'utf8')
  fs.writeFileSync(PAGINA, `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>\n${corpo}\n</body></html>\n`)
  const ini = corpo.indexOf('// ==== SOM:INICIO'), fim = corpo.indexOf('// ==== SOM:FIM ====')
  const bloco = corpo.slice(corpo.indexOf('\n', ini) + 1, fim)
  fs.mkdirSync(SOM_DIR, { recursive: true })
  const cab = '// GERADO por gerar-provas.cjs a partir de prototipo/index.html (bloco SOM). Não editar à mão.\n// @ts-nocheck\n'
  fs.writeFileSync(path.join(SOM_DIR, 'sons-da-pesca.ts'), `${cab}${bloco}\nexport default function criar() {\n  return {\n    criarSom(kit) { const g = kit.ctx.createGain(); g.gain.value = SOM.GANHO; g.connect(kit.destino); SOM.sequencia(kit.ctx, g, kit.ctx.currentTime); return { atualizar() {} } },\n    atualizar() {},\n    descartar() {},\n  }\n}\n`)
  fs.writeFileSync(path.join(SOM_DIR, 'sons-da-pesca.json'), JSON.stringify({ duracaoNaturalS: 6.4 }) + '\n')
  fs.writeFileSync(path.join(SOM_DIR, '.gitignore'), '.pagina/\n.pagina-dist/\n')
}

/** Leva o jogador, em modo manual (passo fixo), até a fase pedida. Roda dentro da página. */
const PREPARAR = `(alvo) => {
  const P = window.PocoDePesca, J = P.jogo, pol = P.SIM.politicaSegue(0.12)
  P.trocarVisao('jogador'); J.manual = true; J.pausado = false
  P.comecar()
  if (alvo === 'lance') return J.fase
  P.fonteApertou('prep'); P.rodar(1.2); P.fonteSoltou('prep')
  for (let k = 0; k < 400 && J.fase !== 'fisgada'; k++) P.rodar(0.05)
  P.fonteApertou('prep'); P.fonteSoltou('prep')
  P.rodar(1.5, pol)
  if (alvo === 'mestre') { P.trocarVisao('mestre'); P.pintarPlacar(); return P.visao }
  if (alvo === 'puxada') return J.fase
  for (let k = 0; k < 1200 && P.tela !== 'resultado'; k++) P.rodar(0.05, pol)
  return P.tela
}`

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
  await page.waitForFunction(() => window.PocoDePesca)
  const R = { testes: [] }
  const ok = (nome, passou, detalhe) => { R.testes.push({ nome, passou: !!passou, detalhe }); console.log(`${passou ? 'PASSOU' : 'FALHOU'}  ${nome}${detalhe ? '  — ' + JSON.stringify(detalhe) : ''}`) }
  const preparar = (alvo) => page.evaluate(`(${PREPARAR})(${JSON.stringify(alvo)})`)

  // ---------- 1. simulação pura (bloco SIM)
  const puras = await page.evaluate(() => {
    const S = window.PocoDePesca.SIM, igual = (a, b) => JSON.stringify(a) === JSON.stringify(b)
    const a1 = S.simular('normal', 'carpa-runa', 'semente-a', S.politicaSegue(0.12)), a2 = S.simular('normal', 'carpa-runa', 'semente-a', S.politicaSegue(0.12))
    const x1 = S.simular('extremo', 'lampreia', 'semente-a', S.politicaSegue(0.12)), x2 = S.simular('extremo', 'lampreia', 'semente-a', S.politicaSegue(0.12))
    const b1 = S.simular('normal', 'carpa-runa', 'semente-b', S.politicaSegue(0.12))
    const robo = {}
    for (const dif of ['normal', 'extremo']) {
      const lista = S.cardapio(dif), por = {}
      let peg = 0, perf = 0, tempo = 0
      const N = 240
      for (let i = 0; i < N; i++) {
        const p = lista[i % lista.length], r = S.simular(dif, p.id, `robo|${dif}|${i}`, S.politicaSegue(0.12))
        const k = por[p.id] || (por[p.id] = { tentou: 0, pegou: 0 }); k.tentou++
        if (r.fim === 'pegou') { peg++; k.pegou++; tempo += r.t; if (r.perfeito) perf++ }
      }
      robo[dif] = { taxa: peg / N, perfeitas: perf, tempoMedioS: +(tempo / Math.max(1, peg)).toFixed(1), porPeixe: Object.fromEntries(Object.entries(por).map(([k, v]) => [k, Math.round((v.pegou / v.tentou) * 100) + '%'])) }
    }
    let foraNoNormal = 0, lendarioPerto = 0
    const extremoLonge = {}
    for (let i = 0; i < 6000; i++) {
      const s = S.sortear('normal', i / 6000, 'n' + i); if (s.peixe.onde !== 'ambos') foraNoNormal++
      const e = S.sortear('extremo', 0.8 + (i % 21) / 100, 'x' + i); extremoLonge[e.peixe.rar] = (extremoLonge[e.peixe.rar] || 0) + 1
      if (S.sortear('extremo', (i % 61) / 100, 'p' + i).peixe.rar === 'lendario') lendarioPerto++
    }
    const foge = S.simular('normal', 'carpa-runa', 'foge', S.politicaFoge())
    return { mesma: igual(a1.amostras, a2.amostras) && igual(x1.amostras, x2.amostras), outra: !igual(a1.amostras, b1.amostras), robo, foraNoNormal, extremoLonge, lendarioPerto, foge: { fim: foge.fim, t: +foge.t.toFixed(2), medidorFinal: foge.amostras[foge.amostras.length - 1][4] } }
  })
  ok('mesma semente = mesma puxada (Normal e Extremo); outra semente = outra puxada', puras.mesma && puras.outra)
  R.robo = puras.robo
  ok('robô que segue o peixe pega a maioria no Normal (>= 75%)', puras.robo.normal.taxa >= 0.75, { taxa: pct(puras.robo.normal.taxa) + '%', perfeitas: puras.robo.normal.perfeitas, tempoMedioS: puras.robo.normal.tempoMedioS })
  ok('mesmo robô pega bem menos no Extremo, mas pega (entre 5% e Normal − 30 pontos)', puras.robo.extremo.taxa > 0.05 && puras.robo.extremo.taxa <= puras.robo.normal.taxa - 0.3, { taxa: pct(puras.robo.extremo.taxa) + '%', porPeixe: puras.robo.extremo.porPeixe })
  ok('raros e lendário nunca saem no Normal (6.000 sorteios)', puras.foraNoNormal === 0, { foraNoNormal: puras.foraNoNormal })
  ok('no Extremo longe saem raros e o lendário; lendário nunca com lance até 60%', (puras.extremoLonge.raro || 0) > 0 && (puras.extremoLonge.lendario || 0) > 0 && puras.lendarioPerto === 0, { extremoLonge: puras.extremoLonge, lendarioPerto: puras.lendarioPerto })
  ok('medidor zerado = escapou', puras.foge.fim === 'escapou' && puras.foge.medidorFinal === 0, puras.foge)

  // ---------- 2. entrada: teclado, toque, controle; fisgada perdida; puxou cedo
  const entrada = await page.evaluate(async () => {
    const P = window.PocoDePesca, J = P.jogo, quadro = () => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)))
    const out = {}
    P.trocarVisao('jogador'); J.manual = true; P.prefs.dif = 'normal'; P.config.permitida = 'escolha'
    for (const code of ['Space', 'ArrowUp', 'KeyW']) {
      P.comecar()
      dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }))
      const carregou = J.carregando; P.rodar(0.6); const forca = J.forca
      dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }))
      out['tecla ' + code] = { carregou, forca: +forca.toFixed(2), depois: J.fase }
    }
    P.comecar()
    const campo = document.querySelector('#campo')
    campo.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, button: 0 }))
    const toqueCarregou = J.carregando; P.rodar(0.5)
    campo.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, button: 0 }))
    out.toque = { carregou: toqueCarregou, depois: J.fase, touchAction: getComputedStyle(campo).touchAction }
    P.comecar()
    window.__pad.buttons[0] = { pressed: true, value: 1 }; await quadro()
    const padA = J.carregando; P.rodar(0.4)
    window.__pad.buttons[0] = { pressed: false, value: 0 }; await quadro()
    const depoisA = J.fase
    P.comecar()
    window.__pad.buttons[7] = { pressed: false, value: 0.8 }; await quadro()
    const padRT = J.carregando
    window.__pad.buttons[7] = { pressed: false, value: 0 }; await quadro()
    window.__pad.buttons[9] = { pressed: true, value: 1 }; await quadro()
    const pausouStart = J.pausado
    window.__pad.buttons[9] = { pressed: false, value: 0 }; await quadro()
    dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }))
    out.controle = { botaoA: padA, depoisA, gatilhoRT: padRT, startPausa: pausouStart, escContinua: !J.pausado }
    // fisgada perdida: lança e não aperta na janela
    P.comecar(); P.fonteApertou('t'); P.rodar(1.0); P.fonteSoltou('t')
    for (let k = 0; k < 400 && J.fase !== 'fisgada'; k++) P.rodar(0.05)
    const janela = P.SIM.DIF[J.dif].janela, viuFisgada = J.fase === 'fisgada'
    P.rodar(janela - 0.05); const aindaAberta = J.fase === 'fisgada'
    P.rodar(0.1); const tipo = J.resultado && J.resultado.tipo
    P.rodar(1.4)
    out.fisgadaPerdida = { viuFisgada, aindaAberta, tipo, tela: P.tela, titulo: document.querySelector('#rTitulo').textContent }
    // puxou cedo: aperta durante a espera
    P.comecar(); P.fonteApertou('t'); P.rodar(0.8); P.fonteSoltou('t'); P.rodar(0.8)
    const fEspera = J.fase; P.fonteApertou('t'); const cedo = J.fase; P.fonteSoltou('t'); P.rodar(1.2)
    out.cedo = { antes: fEspera, depois: cedo, volta: J.fase }
    return out
  })
  const teclasOk = ['Space', 'ArrowUp', 'KeyW'].every((c) => entrada['tecla ' + c].carregou && entrada['tecla ' + c].forca > 0.3 && entrada['tecla ' + c].depois === 'voo')
  ok('teclado: Espaço, Seta para cima e W seguram e soltam o lance', teclasOk, ['Space', 'ArrowUp', 'KeyW'].map((c) => entrada['tecla ' + c]))
  ok('toque na tela (pointerdown/pointerup, touch-action none) segura e solta', entrada.toque.carregou && entrada.toque.depois === 'voo' && entrada.toque.touchAction === 'none', entrada.toque)
  ok('controle falso (Gamepad API): A e RT seguram, Start pausa', entrada.controle.botaoA && entrada.controle.depoisA === 'voo' && entrada.controle.gatilhoRT && entrada.controle.startPausa && entrada.controle.escContinua, entrada.controle)
  ok('fisgada perdida = peixe foge (resultado "Fugiu")', entrada.fisgadaPerdida.viuFisgada && entrada.fisgadaPerdida.aindaAberta && entrada.fisgadaPerdida.tipo === 'fugiu' && entrada.fisgadaPerdida.tela === 'resultado', entrada.fisgadaPerdida)
  ok('apertar durante a espera recolhe a linha vazia e volta ao lance', entrada.cedo.antes === 'espera' && entrada.cedo.depois === 'cedo' && entrada.cedo.volta === 'lance', entrada.cedo)

  // ---------- 3. uma pesca inteira em tempo real, por eventos de teclado (robô na página), com medição de quadro
  await page.evaluate(() => { const P = window.PocoDePesca; P.trocarVisao('jogador'); P.jogo.manual = false; P.amostras.intervalos.length = 0; P.amostras.trabalho.length = 0; window.__longas.length = 0 })
  const fluxo = page.evaluate(() => new Promise((ok) => {
    const P = window.PocoDePesca, J = P.jogo, t0 = performance.now()
    let seg = false
    const tecla = (tipo) => dispatchEvent(new KeyboardEvent(tipo, { code: 'Space', bubbles: true }))
    const por = (q) => { if (q && !seg) { tecla('keydown'); seg = true } else if (!q && seg) { tecla('keyup'); seg = false } }
    P.comecar()
    const passo = () => {
      if (P.tela === 'resultado') { por(false); return ok({ tipo: J.resultado.tipo, peixe: J.resultado.peixe && J.resultado.peixe.nome, s: +((performance.now() - t0) / 1000).toFixed(1) }) }
      if (performance.now() - t0 > 60000) { por(false); return ok({ tipo: 'tempo esgotado', fase: J.fase }) }
      if (J.fase === 'lance') por(!(J.carregando && J.forca >= 0.85))
      else if (J.fase === 'fisgada') por(true)
      else if (J.fase === 'puxada') { const e = J.puxada; por(e.p.y > e.b.y + e.b.tam / 2 + e.b.v * 0.12) }
      else por(false)
      requestAnimationFrame(passo)
    }
    requestAnimationFrame(passo)
  }))
  await page.waitForFunction(() => window.PocoDePesca.jogo.fase === 'puxada' && window.PocoDePesca.jogo.puxada.t > 2.5, null, { timeout: 30000 })
  await page.screenshot({ path: path.join(PROVAS, 'jogador-1440-puxada.png') })
  const resFluxo = await fluxo
  const des = await page.evaluate(() => ({ intervalos: window.PocoDePesca.amostras.intervalos.slice(), trabalho: window.PocoDePesca.amostras.trabalho.slice(), longas: window.__longas.slice() }))
  const p = (arr, q) => { const s = [...arr].sort((a, b) => a - b); return s.length ? +s[Math.min(s.length - 1, Math.floor(q * s.length))].toFixed(1) : null }
  R.desempenho = { quadros: des.intervalos.length, intervaloP50: p(des.intervalos, 0.5), intervaloP95: p(des.intervalos, 0.95), trabalhoP95: p(des.trabalho, 0.95), trabalhoMax: des.trabalho.length ? +Math.max(...des.trabalho).toFixed(1) : null, tarefasLongas: des.longas.map((d) => Math.round(d)) }
  ok('pesca inteira no Normal por eventos de teclado em tempo real termina com "Pegou"', resFluxo.tipo === 'pegou', resFluxo)
  ok('quadro durante a puxada: p95 do intervalo <= 20 ms e nenhuma tarefa longa >= 200 ms', R.desempenho.quadros > 100 && R.desempenho.intervaloP95 <= 20 && !des.longas.some((d) => d >= 200), R.desempenho)
  await page.waitForTimeout(600)
  await page.screenshot({ path: path.join(PROVAS, 'resultado-1440.png') })

  // ---------- 4. mestre: placar ao vivo, pausar e encerrar para todos
  const mestre = await page.evaluate(async () => {
    const P = window.PocoDePesca, J = P.jogo, esperar = (ms) => new Promise((ok) => setTimeout(ok, ms))
    P.trocarVisao('jogador'); J.manual = false; P.comecar(); P.trocarVisao('mestre'); await esperar(400)
    const linhas = [...document.querySelectorAll('#placar li')].map((li) => li.querySelector('.pl__nome').textContent + ': ' + li.querySelector('.pl__status').textContent)
    document.querySelector('#bPausaTodos').click(); const tb = P.bots.map((b) => b.tFase), tj = J.t; await esperar(300)
    const parado = P.bots.every((b, i) => b.tFase === tb[i]) && J.t === tj && P.config.pausaTodos
    P.trocarVisao('jogador'); const overlay = !document.querySelector('#pausa').hidden; P.trocarVisao('mestre')
    document.querySelector('#bPausaTodos').click(); await esperar(200)
    const voltou = P.bots.some((b, i) => b.tFase !== tb[i])
    document.querySelector('#bEncerrar').click(); await esperar(100)
    const encerrou = { tela: P.tela, tipo: J.resultado && J.resultado.tipo, bots: P.bots.map((b) => b.fase), botao: document.querySelector('#bEncerrar').textContent, pescarDesligado: document.querySelector('#bPescar').disabled }
    document.querySelector('#bEncerrar').click(); await esperar(100)
    const reabriu = P.config.aberto && P.bots.every((b) => b.fase !== 'encerrado')
    document.querySelector('#mNome').value = 'Dona Ziza'; document.querySelector('#mNome').dispatchEvent(new Event('input'))
    document.querySelector('#mLago').value = 'Cisterna Negra'; document.querySelector('#mLago').dispatchEvent(new Event('input'))
    const nomeNoConvite = document.querySelector('#cNome').textContent, lagoNoTopo = document.querySelector('.migalhas b').textContent
    document.querySelector('#mNome').value = 'Bento, o barqueiro'; document.querySelector('#mNome').dispatchEvent(new Event('input'))
    document.querySelector('#mLago').value = 'Poço Afogado'; document.querySelector('#mLago').dispatchEvent(new Event('input'))
    return { linhas, parado, overlay, voltou, encerrou, reabriu, nomeNoConvite, lagoNoTopo }
  })
  ok('mestre: placar ao vivo com você e 2 simulados; pausar, continuar, encerrar e reabrir valem para todos; campos mudam o convite', mestre.linhas.length === 3 && mestre.parado && mestre.overlay && mestre.voltou && mestre.encerrou.tipo === 'encerrado' && mestre.encerrou.bots.every((f) => f === 'encerrado') && mestre.encerrou.pescarDesligado && mestre.reabriu && mestre.nomeNoConvite === 'Dona Ziza' && mestre.lagoNoTopo === 'Cisterna Negra', mestre)
  await preparar('mestre'); await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(PROVAS, 'mestre-1440.png') })

  // ---------- 5. sem rolagem horizontal em 1440, 1024 e 390 px
  const larguras = { 1440: 900, 1024: 768, 390: 844 }, rolagem = []
  for (const [w, h] of Object.entries(larguras)) {
    await page.setViewportSize({ width: +w, height: h })
    for (const tela of ['lance', 'puxada', 'resultado', 'mestre']) {
      await preparar(tela); await page.waitForTimeout(120)
      const r = await page.evaluate(() => { const els = [document.documentElement, ...document.querySelectorAll('.tela, .mestre, .coluna, .painel, .hud, .campo')].filter((e) => e.offsetParent !== null || e === document.documentElement); const pior = els.find((e) => e.scrollWidth > e.clientWidth + 1); return { ok: !pior, onde: pior ? (pior.id || pior.className) : null, largura: document.documentElement.scrollWidth } })
      rolagem.push({ largura: +w, tela, ...r })
      if (+w === 390 && tela === 'puxada') await page.screenshot({ path: path.join(PROVAS, 'jogador-390-puxada.png') })
    }
  }
  ok('sem rolagem horizontal em 1440, 1024 e 390 px (lance, puxada, resultado, mestre)', rolagem.every((r) => r.ok), rolagem.filter((r) => !r.ok))
  await page.setViewportSize({ width: 1440, height: 900 })

  // ---------- 6. folha de contato: a mesma função de desenho do jogo, quadro a quadro, com o tempo embaixo
  const folha = await page.evaluate(() => {
    const P = window.PocoDePesca, J = P.jogo, S = P.SIM, pol = S.politicaSegue(0.12)
    P.trocarVisao('jogador'); J.manual = true; P.prefs.dif = 'normal'; P.config.permitida = 'escolha'; J.n = 0; J.t = 0
    P.comecar()
    const cl = document.createElement('canvas'); cl.width = P.W; cl.height = P.H
    const ci = document.createElement('canvas'); ci.width = P.IW; ci.height = P.IH
    const quadros = []
    let t = 0
    const cap = (rotulo) => {
      P.desenharLago(cl.getContext('2d'), J); P.desenharInstr(ci.getContext('2d'), J)
      const c = document.createElement('canvas'); c.width = P.W * 2 + 10 + Math.round(P.IW * 1.35); c.height = P.H * 2
      const g = c.getContext('2d'); g.imageSmoothingEnabled = false
      g.fillStyle = '#1a1a1e'; g.fillRect(0, 0, c.width, c.height)
      g.drawImage(cl, 0, 0, P.W * 2, P.H * 2); g.drawImage(ci, P.W * 2 + 10, 0, Math.round(P.IW * 1.35), P.H * 2)
      quadros.push({ c, rotulo, tempo: `t = ${t.toFixed(2).replace('.', ',')} s` })
    }
    const anda = (s, politica) => { P.rodar(s, politica); t += s }
    const ate = (cond, politica) => { for (let k = 0; k < 1200 && !cond(); k++) anda(0.05, politica) }
    cap('Lance: parado')
    P.fonteApertou('f'); anda(0.5); cap(`Segurando: força ${Math.round(J.forca * 100)}%`)
    anda(0.6); cap(`Segurando: força ${Math.round(J.forca * 100)}%`)
    anda(0.15); P.fonteSoltou('f'); const dist = Math.round(J.dist * 100)
    anda(0.25); cap(`Soltou: a boia voa (${dist}%)`)
    ate(() => J.fase === 'espera'); anda(0.15); cap('Boia cai: respingo')
    anda(1.0); cap('Espera: boia balança')
    ate(() => J.fase === 'fisgada'); anda(0.03); cap('Fisgada: "!" e a boia afunda')
    anda(0.25); cap(`Janela correndo (${String(S.DIF.normal.janela).replace('.', ',')} s)`)
    P.fonteApertou('f'); P.fonteSoltou('f')
    anda(0.5, pol); cap('Puxada: barra sobe com o peixe')
    anda(1.5, pol); cap(`Puxada: medidor ${Math.round(J.puxada.m * 100)}%`)
    anda(1.5, pol); cap(`Puxada: medidor ${Math.round(J.puxada.m * 100)}%`)
    ate(() => J.fase !== 'puxada' || J.puxada.m > 0.93, pol); cap(`Medidor ${Math.round(J.puxada.m * 100)}%: quase`)
    ate(() => J.fase === 'final', pol); anda(0.2); cap('Pegou: o peixe salta')
    anda(0.35); cap('O peixe vem para a mão')
    anda(0.5); cap(`Na mão: ${J.resultado.peixe.nome}, ${J.resultado.cm} cm`)
    const col = 4, fw = quadros[0].c.width, fh = quadros[0].c.height, linhas = Math.ceil(quadros.length / col)
    const f = document.createElement('canvas'); f.width = col * (fw + 14) + 14; f.height = 46 + linhas * (fh + 44)
    const g = f.getContext('2d'); g.imageSmoothingEnabled = false
    g.fillStyle = '#121214'; g.fillRect(0, 0, f.width, f.height)
    g.fillStyle = '#eceae4'; g.font = '600 16px Segoe UI, sans-serif'; g.fillText(`Ciclo do jogador no Normal: lance, espera, fisgada, puxada, pegou (lago à esquerda, coluna de pesca à direita; ${quadros.length} quadros)`, 14, 28)
    quadros.forEach((q, i) => {
      const x = 14 + (i % col) * (fw + 14), y = 42 + Math.floor(i / col) * (fh + 44)
      g.drawImage(q.c, x, y)
      g.fillStyle = '#a2a09a'; g.font = '13px Segoe UI, sans-serif'; g.fillText(q.rotulo, x, y + fh + 17)
      g.fillStyle = '#e0a44a'; g.fillText(q.tempo, x, y + fh + 33)
    })
    return { png: f.toDataURL('image/png'), quadros: quadros.length, peixe: J.resultado.peixe.nome }
  })
  salvarPng('folha-contato.png', folha.png)
  R.folha = { quadros: folha.quadros, peixe: folha.peixe }

  // ---------- 7. gráfico do movimento: peixe, barra e medidor a cada 0,1 s, mesmo robô, Normal e Extremo
  const grafico = await page.evaluate(() => {
    const S = window.PocoDePesca.SIM, peixe = 'bagre', semente = 'grafico|7'
    const casos = ['normal', 'extremo'].map((dif) => ({ dif, r: S.simular(dif, peixe, semente, S.politicaSegue(0.12)) }))
    const fim = Math.min(40, Math.ceil(Math.max(...casos.map((c) => c.r.t))))
    const lw = 1180, lh = 230, x0 = 64, c = document.createElement('canvas'); c.width = lw + x0 + 30; c.height = 30 + casos.length * (lh + 96)
    const g = c.getContext('2d')
    g.fillStyle = '#fcfcfb'; g.fillRect(0, 0, c.width, c.height)
    const FISH = '#b7791f', BAR = '#3d8b55', MED = '#2f6a9e', INK = '#1d232b', MUTED = '#5b6470', GRID = '#e6e6e3'
    casos.forEach(({ dif, r }, k) => {
      const y0 = 40 + k * (lh + 96), X = (t) => x0 + (t / fim) * lw, Y = (v) => y0 + lh - v * lh, am = r.amostras.filter((a) => a[0] <= fim)
      g.fillStyle = INK; g.font = '600 14px Segoe UI, sans-serif'
      const desfecho = r.fim === 'pegou' ? `pegou em ${r.t.toFixed(1).replace('.', ',')} s${r.perfeito ? ', perfeito' : ''}` : r.fim === 'escapou' ? `escapou em ${r.t.toFixed(1).replace('.', ',')} s` : 'passou de 40 s'
      g.fillText(`${dif === 'normal' ? 'Normal' : 'Extremo'}: Bagre-de-pedra (afunda), robô que segue o peixe com 0,12 s de atraso: ${desfecho}`, x0, y0 - 14)
      g.strokeStyle = GRID; g.lineWidth = 1; g.font = '11px Segoe UI, sans-serif'; g.fillStyle = MUTED
      for (let i = 0; i <= 4; i++) { const y = Math.round(Y(i / 4)) + 0.5; g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + lw, y); g.stroke(); g.fillText(['fundo 0', '0,25', '0,5', '0,75', 'topo 1'][i], 8, y + 4) }
      const passo = fim > 20 ? 2 : 1
      for (let t = 0; t <= fim + 1e-9; t += passo) g.fillText(t + ' s', X(t) - 6, y0 + lh + 16)
      g.fillStyle = 'rgba(61,139,85,0.2)'; g.beginPath(); am.forEach(([t, , b]) => g.lineTo(X(t), Y(b))); [...am].reverse().forEach(([t, , , topo]) => g.lineTo(X(t), Y(topo))); g.closePath(); g.fill()
      const linha = (idx, cor, larg, tra) => { g.strokeStyle = cor; g.lineWidth = larg; g.setLineDash(tra || []); g.beginPath(); am.forEach((a, i) => (i ? g.lineTo(X(a[0]), Y(a[idx])) : g.moveTo(X(a[0]), Y(a[idx])))); g.stroke(); g.setLineDash([]) }
      linha(2, BAR, 1); linha(3, BAR, 1); linha(1, FISH, 2); linha(4, MED, 2, [6, 4])
      const ly = y0 + lh + 40
      g.fillStyle = 'rgba(61,139,85,0.35)'; g.fillRect(x0, ly - 9, 18, 10); g.strokeStyle = BAR; g.strokeRect(x0 + 0.5, ly - 8.5, 17, 9)
      g.fillStyle = INK; g.font = '12px Segoe UI, sans-serif'; g.fillText('barra verde (de baixo a cima)', x0 + 24, ly)
      g.strokeStyle = FISH; g.lineWidth = 2; g.beginPath(); g.moveTo(x0 + 230, ly - 4); g.lineTo(x0 + 250, ly - 4); g.stroke(); g.fillText('posição do peixe', x0 + 256, ly)
      g.strokeStyle = MED; g.setLineDash([6, 4]); g.beginPath(); g.moveTo(x0 + 390, ly - 4); g.lineTo(x0 + 410, ly - 4); g.stroke(); g.setLineDash([]); g.fillText('medidor de captura (0 escapa, 1 pega)', x0 + 416, ly)
      g.fillStyle = MUTED; g.fillText(`${am.length} amostras, uma a cada 0,1 s; eixo vertical em fração da coluna de água`, x0 + 700, ly)
    })
    return { png: c.toDataURL('image/png'), resumo: casos.map(({ dif, r }) => ({ dif, fim: r.fim, t: +r.t.toFixed(1), perfeito: r.perfeito, amostras: r.amostras.length })) }
  })
  salvarPng('grafico-movimento.png', grafico.png)
  R.grafico = grafico.resumo

  // ---------- 8. som: o ciclo inteiro renderizado offline, .wav, medidas e envoltória
  const som = await page.evaluate(async () => {
    const P = window.PocoDePesca, b64 = (f) => { const u = new Uint8Array(f.buffer, f.byteOffset, f.byteLength); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s) }
    const off = new OfflineAudioContext(2, Math.round(48000 * P.SOM.DURACAO_SEQ), 48000), g = off.createGain()
    g.gain.value = P.SOM.GANHO; g.connect(off.destination); P.SOM.sequencia(off, g, 0)
    const buf = await off.startRendering()
    return { taxa: 48000, canais: [0, 1].map((c) => b64(buf.getChannelData(c))), seq: P.SOM.SEQ }
  })
  const deB64 = (s) => { const b = Buffer.from(s, 'base64'); return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4) }
  const canais = som.canais.map(deB64)
  fs.writeFileSync(path.join(SOM_DIR, 'sons-da-pesca.wav'), medidas.wav16(canais, som.taxa))
  const m = medidas.medirTudo(canais, som.taxa)
  R.som = Object.fromEntries(Object.entries(m).filter(([, v]) => typeof v !== 'object' || v === null))
  console.log('som:', JSON.stringify(R.som))
  const env = medidas.envoltoria(canais, som.taxa, 0.005)
  const onda = await page.evaluate(({ env, seq, dur }) => {
    const lw = 1180, lh = 170, x0 = 60, c = document.createElement('canvas'); c.width = lw + 100; c.height = lh + 150
    const g = c.getContext('2d'), arr = env.pico, n = arr.length, nivel = (db) => Math.min(1, Math.max(0, (db + 60) / 60))
    g.fillStyle = '#fcfcfb'; g.fillRect(0, 0, c.width, c.height)
    const y0 = 70, X = (t) => x0 + (t / dur) * lw
    g.fillStyle = '#1d232b'; g.font = '600 13px Segoe UI, sans-serif'; g.fillText('Sons da pesca na linha do tempo de um ciclo: envoltória do pico a cada 5 ms, de −60 dBFS (linha do meio) a 0 dBFS (borda), 48 kHz, ganho do jogo', x0, 22)
    g.fillStyle = '#b7791f'; for (let i = 0; i < n; i++) { const v = nivel(arr[i]), x = x0 + (i / n) * lw; g.fillRect(x, y0 + lh / 2 - (v * lh) / 2, Math.max(1, lw / n), Math.max(1, v * lh)) }
    const nomes = { lance: 'lance (zunido)', splash: 'splash da boia', beliscada: 'beliscada', fisgada: '"!" fisgada', catraca: 'catraca ×18', bau: 'baú', pegou: 'pegou (fanfarra)', escapou: 'escapou' }
    let ultimo = ''
    g.font = '11px Segoe UI, sans-serif'
    seq.forEach(([nome, t], i) => {
      g.fillStyle = 'rgba(47,106,158,0.9)'; g.fillRect(X(t), y0 + lh + 6, 1, 8)
      if (nome !== ultimo) { g.fillStyle = '#1d232b'; g.fillText(nomes[nome], X(t) - 2, 50 - (i % 2) * 14); g.fillStyle = 'rgba(47,106,158,0.5)'; g.fillRect(X(t), 54 - (i % 2) * 14, 1, y0 - 54 + (i % 2) * 14) }
      ultimo = nome
    })
    g.fillStyle = '#5b6470'
    for (let t = 0; t <= dur + 1e-9; t += 0.5) { const x = X(t); g.fillRect(x, y0 + lh + 18, 1, 5); g.fillText(t.toFixed(1).replace('.', ',') + ' s', x - 8, y0 + lh + 34) }
    g.fillText('traços azuis: instante agendado de cada som (bloco SOM do protótipo, SOM.SEQ)', x0, y0 + lh + 58)
    return c.toDataURL('image/png')
  }, { env, seq: som.seq, dur: canais[0].length / som.taxa })
  salvarPng('onda-som.png', onda)

  R.errosConsole = erros
  ok('nenhum erro no console', erros.length === 0, erros)
  await navegador.close()

  // ---------- 9. conferir-som (medir não é ouvir)
  if (!process.argv.includes('--sem-conferir')) {
    const cs = spawnSync(process.execPath, [path.join(RAIZ, 'scripts', 'conferir-som.cjs'), path.join(SOM_DIR, 'sons-da-pesca.ts'), '--saida', SOM_DIR], { cwd: RAIZ, encoding: 'utf8', timeout: 240000 })
    fs.writeFileSync(path.join(SOM_DIR, 'conferir-som.txt'), (cs.stdout || '') + (cs.stderr || ''))
    R.conferirSom = { codigo: cs.status, veredito: /sons-da-pesca: aprovado/.test(cs.stdout || '') ? 'aprovado nas medidas' : 'ver som/conferir-som.txt' }
    console.log('conferir-som:', R.conferirSom)
  }
  fs.writeFileSync(path.join(PROVAS, 'testes.json'), JSON.stringify(R, null, 2))
  const falhas = R.testes.filter((t) => !t.passou).length
  console.log(`\n${R.testes.length - falhas} de ${R.testes.length} testes passaram.`)
  process.exitCode = falhas ? 1 : 0
}
main().catch((e) => { console.error(e); process.exitCode = 2 })
