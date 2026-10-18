'use strict'
/**
 * Provas do protótipo da Barraca de Tiro (não é código do app).
 *
 *   node docs/design/minigame-tiro/provas/gerar-provas.cjs            (tudo, inclusive o conferir-som)
 *   node docs/design/minigame-tiro/provas/gerar-provas.cjs --sem-conferir
 *
 * Monta um invólucro com doctype em volta de prototipo/index.html, abre no Edge
 * (Playwright do repo, sem janela) e grava em provas/: testes.json, 4 prints, a
 * folha de contato, o gráfico do movimento, a onda do som e os .wav. Escreve o
 * adaptador som/sons-do-tiro.ts (o MESMO bloco SOM do protótipo) e roda o
 * scripts/conferir-som.cjs nele; a saída fica em som/conferir-som.txt.
 *
 * Metas do robô humano (escritas antes de calibrar, não mudam): em 200 rodadas,
 * bronze em >= 70% no Normal e entre 15% e 40% no Extremo.
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
const META = { normalMin: 0.7, extremoMin: 0.15, extremoMax: 0.4, rodadas: 200 }

function montarPagina() {
  const corpo = fs.readFileSync(PROTO, 'utf8')
  fs.writeFileSync(PAGINA, `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>\n${corpo}\n</body></html>\n`)
  const ini = corpo.indexOf('// ==== SOM:INICIO'), fim = corpo.indexOf('// ==== SOM:FIM ====')
  const bloco = corpo.slice(corpo.indexOf('\n', ini) + 1, fim)
  const dur = Number((/DURACAO_SEQ = ([\d.]+)/.exec(bloco) || [])[1])
  fs.mkdirSync(SOM_DIR, { recursive: true })
  const cab = '// GERADO por gerar-provas.cjs a partir de prototipo/index.html (bloco SOM). Não editar à mão.\n// @ts-nocheck\n'
  fs.writeFileSync(path.join(SOM_DIR, 'sons-do-tiro.ts'), `${cab}${bloco}\nexport default function criar() {\n  return {\n    criarSom(kit) { const e = SOM.cadeia(kit.ctx, kit.destino); SOM.sequencia(kit.ctx, e, kit.ctx.currentTime); return { atualizar() {} } },\n    atualizar() {},\n    descartar() {},\n  }\n}\n`)
  fs.writeFileSync(path.join(SOM_DIR, 'sons-do-tiro.json'), JSON.stringify({ duracaoNaturalS: dur }) + '\n')
  fs.writeFileSync(path.join(SOM_DIR, '.gitignore'), '.pagina/\n.pagina-dist/\n')
}

/** Leva o jogador (passo fixo, robô jogando) até a tela pedida. Roda dentro da página. */
const PREPARAR = `(alvo) => {
  const B = window.BarracaDeTiro, J = B.jogo
  B.trocarVisao('jogador'); J.manual = true; J.pausado = false; B.config.tentativas = 5; J.usadas = 0
  if (alvo === 'convite') { B.irPara('convite'); return B.tela }
  B.comecar(); const robo = B.SIM.criarRobo({}, 'layout'); B.rodar(1.3); B.rodar(6, robo)
  if (alvo === 'rodada') return J.fase
  if (alvo === 'mestre') { B.trocarVisao('mestre'); B.pintarPlacar(); return B.visao }
  B.rodar(40, robo); return B.tela
}`

async function main() {
  montarPagina()
  const navegador = await chromium.launch({ channel: 'msedge', args: ['--autoplay-policy=no-user-gesture-required'] }).catch(() => chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }))
  const ctx = await navegador.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  await ctx.addInitScript(() => {
    // Controle falso para o teste da Gamepad API: os testes mexem em window.__pad.
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
  await page.waitForFunction(() => window.BarracaDeTiro)
  const R = { metas: META, testes: [] }
  const ok = (nome, passou, detalhe) => { R.testes.push({ nome, passou: !!passou, detalhe }); console.log(`${passou ? 'PASSOU' : 'FALHOU'}  ${nome}${detalhe ? '  — ' + JSON.stringify(detalhe) : ''}`) }
  const preparar = (alvo) => page.evaluate(`(${PREPARAR})(${JSON.stringify(alvo)})`)

  // ---------- 1. simulação pura (bloco SIM): semente, robô humano, proibidos, munição
  const puras = await page.evaluate((N) => {
    const S = window.BarracaDeTiro.SIM, igual = (a, b) => JSON.stringify(a) === JSON.stringify(b)
    const mesma = igual(S.simular('normal', 'semente-a', {}).amostras, S.simular('normal', 'semente-a', {}).amostras) && igual(S.simular('extremo', 'semente-a', {}).amostras, S.simular('extremo', 'semente-a', {}).amostras)
    const outra = !igual(S.simular('normal', 'semente-a', {}).amostras, S.simular('normal', 'semente-b', {}).amostras)
    const robo = {}, reacoes = []
    for (const dif of ['normal', 'extremo']) {
      const pts = [], med = { bronze: 0, prata: 0, ouro: 0 }
      let prec = 0, proib = 0, secos = 0, tiros = 0
      for (let i = 0; i < N; i++) {
        const r = S.simular(dif, `robo|${dif}|${i}`, {})
        pts.push(r.pontos); prec += r.precisao; proib += r.proibidos; secos += r.secos; tiros += r.tiros
        if (r.medalha) for (const k of S.MEDALHAS.slice(0, S.MEDALHAS.indexOf(r.medalha) + 1)) med[k]++
        for (const v of r.reacoes) reacoes.push(v)
      }
      pts.sort((a, b) => a - b)
      robo[dif] = { bronze: med.bronze / N, prata: med.prata / N, ouro: med.ouro / N, medalhas: S.DIF[dif].medalhas, pontos: { p10: pts[Math.floor(N * 0.1)], p50: pts[Math.floor(N * 0.5)], p90: pts[Math.floor(N * 0.9)] }, precisaoMedia: +(prec / N).toFixed(3), tirosPorRodada: +(tiros / N).toFixed(1), proibidosPorRodada: +(proib / N).toFixed(2), secosPorRodada: +(secos / N).toFixed(2) }
    }
    const media = reacoes.reduce((a, b) => a + b, 0) / reacoes.length
    const dp = Math.sqrt(reacoes.reduce((a, b) => a + (b - media) ** 2, 0) / reacoes.length)
    // agendas: proibidos só no Extremo; ritmo e velocidade
    const contar = { normal: {}, extremo: {} }, ritmo = {}
    for (const dif of ['normal', 'extremo']) {
      let n = 0
      for (let i = 0; i < 200; i++) { const ag = S.agenda(dif, `ag|${i}`); n += ag.length; for (const a of ag) contar[dif][a.tipo] = (contar[dif][a.tipo] || 0) + 1 }
      ritmo[dif] = +(n / 200 / S.DIF[dif].tempo).toFixed(2)
    }
    // munição, direto na simulação
    const M = S.criarRodada('normal', 'municao'), passos = (s, ent) => { for (let i = 0; i < Math.round(s / S.DT); i++) S.passo(M, ent && i === 0 ? ent : { x: M.mira.x, y: M.mira.y }) }
    for (let k = 0; k < 6; k++) passos(0.3, { x: 128, y: 3, atirar: true })
    const antesSeco = { balas: M.balas, tiros: M.tiros }
    passos(0.3, { x: 128, y: 3, atirar: true })
    const seco = { balas: M.balas, tiros: M.tiros, secos: M.secos, evento: M.ev[M.ev.length - 1].nome }
    passos(0.1, { x: 128, y: 3, recarregar: true })
    const durante = M.recarga > 0
    passos(0.1, { x: 128, y: 3, atirar: true })
    const travado = { tiros: M.tiros, evento: M.ev.filter((e) => e.nome === 'travado').length }
    passos(1.0)
    const recarga = { balas: M.balas, pronto: M.ev.some((e) => e.nome === 'pronto'), recargas: M.recargas }
    return { mesma, outra, robo, reacao: { n: reacoes.length, min: +Math.min(...reacoes).toFixed(3), media: +media.toFixed(3), dp: +dp.toFixed(3) }, contar, ritmo, DIF: S.DIF, municao: { antesSeco, seco, durante, travado, recarga } }
  }, META.rodadas)
  ok('mesma semente = mesma rodada (Normal e Extremo); outra semente = outra rodada', puras.mesma && puras.outra)
  R.robo = puras.robo
  const rn = puras.robo.normal, rx = puras.robo.extremo
  ok(`robô humano no Normal: bronze em >= ${pct(META.normalMin)}% de ${META.rodadas} rodadas`, rn.bronze >= META.normalMin, { bronze: pct(rn.bronze) + '%', prata: pct(rn.prata) + '%', ouro: pct(rn.ouro) + '%', medalhas: rn.medalhas, pontos: rn.pontos, precisao: pct(rn.precisaoMedia) + '%' })
  ok(`robô humano no Extremo: bronze entre ${pct(META.extremoMin)}% e ${pct(META.extremoMax)}% de ${META.rodadas} rodadas`, rx.bronze >= META.extremoMin && rx.bronze <= META.extremoMax, { bronze: pct(rx.bronze) + '%', prata: pct(rx.prata) + '%', ouro: pct(rx.ouro) + '%', medalhas: rx.medalhas, pontos: rx.pontos, precisao: pct(rx.precisaoMedia) + '%', proibidosPorRodada: rx.proibidosPorRodada })
  ok('robô nunca reage em zero: reação mínima >= 130 ms, média 250 ± 20 ms, desvio 60 ± 15 ms', puras.reacao.min >= 0.13 && Math.abs(puras.reacao.media - 0.25) <= 0.02 && Math.abs(puras.reacao.dp - 0.06) <= 0.015, puras.reacao)
  const cn = puras.contar.normal, cx = puras.contar.extremo
  ok('alvo proibido só existe no Extremo (200 agendas de cada)', !cn.aldeao && !cn.gato && cx.aldeao > 0 && cx.gato > 0, { normal: cn, extremo: cx })
  const D = puras.DIF
  ok('Extremo: alvos menores e mais rápidos, mais surgindo, recarga mais lenta, menos tempo', D.extremo.escala < D.normal.escala && D.extremo.vel >= 1.4 * D.normal.vel && puras.ritmo.extremo >= 1.4 * puras.ritmo.normal && D.extremo.recarga > D.normal.recarga && D.extremo.tempo < D.normal.tempo && D.extremo.janela[1] < D.normal.janela[0], { escala: [D.normal.escala, D.extremo.escala], velocidade: [D.normal.vel, D.extremo.vel], alvosPorSegundo: [puras.ritmo.normal, puras.ritmo.extremo], recarga: [D.normal.recarga, D.extremo.recarga], tempo: [D.normal.tempo, D.extremo.tempo] })
  const mu = puras.municao
  ok('atirar sem bala dá clique seco e não conta tiro', mu.antesSeco.balas === 0 && mu.antesSeco.tiros === 6 && mu.seco.tiros === 6 && mu.seco.secos === 1 && mu.seco.evento === 'seco', mu)
  ok('recarga repõe 6 balas; tiro durante a recarga não sai', mu.durante && mu.travado.tiros === 6 && mu.travado.evento === 1 && mu.recarga.balas === 6 && mu.recarga.pronto, mu)

  // ---------- 2. gráfico do movimento: dados a cada 0,1 s, propriedades viram teste
  const graf = await page.evaluate(() => {
    const S = window.BarracaDeTiro.SIM
    return ['normal', 'extremo'].map((dif) => { const r = S.simular(dif, 'grafico|1', {}); return { dif, tempo: S.DIF[dif].tempo, medalhas: S.DIF[dif].medalhas, pontos: r.pontos, medalha: r.medalha, precisao: r.precisao, amostras: r.amostras, eventos: r.eventos } })
  })
  const props = graf.map((g) => {
    const am = g.amostras, ev = g.eventos, falhas = []
    let maxVel = 0
    for (let i = 1; i < am.length; i++) {
      const [t0, x0, y0, b0, p0] = am[i - 1], [t1, x1, y1, b1, p1] = am[i]
      const no = ev.filter((e) => e.t > t0 - 1e-6 && e.t <= t1 + 1e-6)
      if (b1 < 0 || b1 > 6) falhas.push(`balas ${b1} em ${t1}`)
      if (b1 > b0 && (b1 !== 6 || !no.some((e) => e.nome === 'pronto'))) falhas.push(`balas subiram sem recarga em ${t1}`)
      if (p1 !== p0 && !no.some((e) => e.nome === 'acerto' || e.nome === 'proibido')) falhas.push(`pontos mudaram sem acerto em ${t1}`)
      if (p1 < p0 && !no.some((e) => e.nome === 'proibido')) falhas.push(`pontos caíram sem proibido em ${t1}`)
      maxVel = Math.max(maxVel, Math.hypot(x1 - x0, y1 - y0) / (t1 - t0))
    }
    // velocidade constante nos trilhos: a mesma diferença de x em toda amostra do mesmo alvo
    const vel = new Map()
    for (let i = 1; i < am.length; i++) {
      const antes = new Map(am[i - 1][7].map((a) => [a[0], a]))
      for (const a of am[i][7]) {
        const b = antes.get(a[0])
        if (!b || !['anel', 'garrafa', 'gato'].includes(a[1]) || a[4] === 2 || b[4] === 2) continue
        const v = (a[2] - b[2]) / (am[i][0] - am[i - 1][0])
        const m = vel.get(a[0]) || [Infinity, -Infinity]
        vel.set(a[0], [Math.min(m[0], v), Math.max(m[1], v)])
      }
    }
    const trilhoVariou = [...vel.values()].filter(([a, b]) => b - a > 2.5).length
    const proibNoNormal = g.dif === 'normal' && am.some((a) => a[7].some((x) => x[1] === 'aldeao' || x[1] === 'gato'))
    return { dif: g.dif, amostras: am.length, fimEm: am[am.length - 1][0], falhas: falhas.slice(0, 5), maxVelMira: Math.round(maxVel), trilhoVariou, proibNoNormal, pontos: g.pontos, medalha: g.medalha }
  })
  ok('gráfico do movimento: balas entre 0 e 6 e só sobem para 6 na recarga; pontos só mudam com acerto; mira sem teleporte (<= 600 px/s); trilhos em velocidade constante; nada proibido no Normal; fim no tempo certo', props.every((p, i) => !p.falhas.length && p.maxVelMira <= 600 && !p.trilhoVariou && !p.proibNoNormal && Math.abs(p.fimEm - graf[i].tempo) < 0.02 && p.amostras >= graf[i].tempo * 10), props)

  // ---------- 3. entrada: mouse, teclado, toque e controle falso (passo fixo)
  const entrada = await page.evaluate(async () => {
    const B = window.BarracaDeTiro, J = B.jogo, S = B.SIM, quadro = () => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)))
    const palco = document.querySelector('#palco'), out = {}
    B.trocarVisao('jogador'); J.manual = true; B.config.tentativas = 5; B.prefs.dif = 'normal'; B.config.permitida = 'escolha'
    const preparar = () => { J.usadas = 0; B.irPara('convite'); B.comecar(); B.rodar(1.3) }
    const alvoPronto = () => { for (let k = 0; k < 400; k++) { const a = J.R.alvos.find((x) => x.faixa === 'pop' && S.atingivel(x) && x.idade < S.SUBIR + 0.6); if (a) return a; B.rodar(0.05) } return null }
    const pe = (tipo, x, y, extra = {}) => { const p = B.paraTela(x, y); palco.dispatchEvent(new PointerEvent(tipo, Object.assign({ clientX: p.x, clientY: p.y, pointerId: 1, pointerType: 'mouse', isPrimary: true, bubbles: true, cancelable: true, button: 0 }, extra))) }
    const tecla = (tipo, code) => dispatchEvent(new KeyboardEvent(tipo, { code, bubbles: true, cancelable: true }))
    // mouse: mira, clique esquerdo atira, direito recarrega
    preparar(); let a = alvoPronto()
    pe('pointermove', a.x, a.y)
    const miraMouse = Math.abs(J.mira.x - a.x) < 0.6 && Math.abs(J.mira.y - a.y) < 0.6
    pe('pointerdown', a.x, a.y); pe('pointerup', a.x, a.y); B.rodar(1 / 60)
    out.mouse = { mira: miraMouse, tiros: J.R.tiros, acertos: J.R.acertos, balas: J.R.balas }
    pe('pointerdown', 128, 70, { button: 2 }); B.rodar(1 / 60)
    out.mouse.direitoRecarrega = J.R.recarga > 0
    // teclado: Espaço atira na mira, setas mexem, R recarrega, Esc pausa e volta
    preparar(); a = alvoPronto(); J.mira.x = a.x; J.mira.y = a.y
    tecla('keydown', 'Space'); tecla('keyup', 'Space'); B.rodar(1 / 60)
    const espaco = J.R.tiros === 1 && J.R.acertos === 1
    const x0 = J.mira.x; tecla('keydown', 'ArrowLeft'); B.rodar(0.5); tecla('keyup', 'ArrowLeft')
    const seta = +(x0 - J.mira.x).toFixed(1)
    tecla('keydown', 'KeyR'); B.rodar(1 / 60); const rIniciou = J.R.recarga > 0; B.rodar(S.DIF.normal.recarga + 0.05)
    const balasDepois = J.R.balas
    tecla('keydown', 'Escape'); const pausou = J.pausado; const tAntes = J.R.t; B.rodar(0.5); const parado = J.R.t === tAntes
    tecla('keydown', 'Escape'); const voltou = !J.pausado
    out.teclado = { espaco, setaAndouPx: seta, rIniciou, balasDepois, pausou, parado, voltou }
    // toque: toca onde atira; botão Recarregar na tela
    preparar(); a = alvoPronto()
    pe('pointerdown', a.x, a.y, { pointerType: 'touch', pointerId: 9 }); pe('pointerup', a.x, a.y, { pointerType: 'touch', pointerId: 9 }); B.rodar(1 / 60)
    out.toque = { miraNoToque: Math.abs(J.mira.x - a.x) < 0.6, tiros: J.R.tiros, acertos: J.R.acertos, touchAction: getComputedStyle(palco).touchAction }
    document.querySelector('#bRecarregar').click(); B.rodar(1 / 60)
    out.toque.botaoRecarrega = J.R.recarga > 0
    // controle: analógico mira, RT e A atiram, X recarrega, Start pausa e volta
    preparar(); a = alvoPronto()
    const ax0 = J.mira.x; window.__pad.axes = [1, 0, 0, 0]; await quadro(); B.rodar(0.3); window.__pad.axes = [0, 0, 0, 0]; await quadro()
    const analogico = +(J.mira.x - ax0).toFixed(1)
    J.mira.x = a.x; J.mira.y = a.y
    window.__pad.buttons[7] = { pressed: false, value: 0.8 }; await quadro(); B.rodar(1 / 60); const rt = J.R.tiros
    window.__pad.buttons[7] = { pressed: false, value: 0 }; await quadro(); B.rodar(0.3)
    window.__pad.buttons[0] = { pressed: true, value: 1 }; await quadro(); B.rodar(1 / 60); const botaoA = J.R.tiros
    window.__pad.buttons[0] = { pressed: false, value: 0 }; await quadro()
    window.__pad.buttons[2] = { pressed: true, value: 1 }; await quadro(); B.rodar(1 / 60); const botaoX = J.R.recarga > 0
    window.__pad.buttons[2] = { pressed: false, value: 0 }; await quadro()
    window.__pad.buttons[9] = { pressed: true, value: 1 }; await quadro(); const start = J.pausado
    window.__pad.buttons[9] = { pressed: false, value: 0 }; await quadro(); window.__pad.buttons[9] = { pressed: true, value: 1 }; await quadro(); const startVolta = !J.pausado
    window.__pad.buttons[9] = { pressed: false, value: 0 }; await quadro()
    out.controle = { analogicoAndouPx: analogico, rtAtira: rt === 1, aAtira: botaoA === 2, xRecarrega: botaoX, startPausa: start, startVolta }
    return out
  })
  const em = entrada.mouse, et = entrada.teclado, eq = entrada.toque, ec = entrada.controle
  ok('mouse: mira segue o ponteiro, clique esquerdo atira e acerta, botão direito recarrega', em.mira && em.tiros === 1 && em.acertos === 1 && em.balas === 5 && em.direitoRecarrega, em)
  ok('teclado: Espaço atira na mira, setas mexem a mira, R recarrega até 6, Esc pausa e continua', et.espaco && et.setaAndouPx > 40 && et.rIniciou && et.balasDepois === 6 && et.pausou && et.parado && et.voltou, et)
  ok('toque: toca onde atira (touch-action none) e o botão Recarregar da tela recarrega', eq.miraNoToque && eq.tiros === 1 && eq.acertos === 1 && eq.touchAction === 'none' && eq.botaoRecarrega, eq)
  ok('controle falso (Gamepad API): analógico mira, RT e A atiram, X recarrega, Start pausa e volta', ec.analogicoAndouPx > 20 && ec.rtAtira && ec.aAtira && ec.xRecarrega && ec.startPausa && ec.startVolta, ec)

  // ---------- 4. movimento reduzido: sem tremor de tela
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const reduzido = await page.evaluate(() => {
    const B = window.BarracaDeTiro, J = B.jogo
    J.usadas = 0; B.irPara('convite'); B.comecar(); B.rodar(1.3); J.mira.x = 128; J.mira.y = 3; B.pedirTiro(); B.rodar(1 / 120)
    return { tiros: J.R.tiros, tremor: J.tremor, coice: J.coice }
  })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  ok('prefers-reduced-motion desliga o tremor de tela no tiro (o coice fica de 1 px)', reduzido.tiros === 1 && reduzido.tremor === 0, reduzido)

  // ---------- 5. mestre: placar ao vivo, pausar e encerrar para todos, chamar, tentativas, jogo e campos
  const mestre = await page.evaluate(async () => {
    const B = window.BarracaDeTiro, J = B.jogo, cfg = B.config, $ = (s) => document.querySelector(s), esperar = (ms) => new Promise((ok) => setTimeout(ok, ms))
    const mudar = (sel, v, ev = 'change') => { const el = $(sel); el.value = v; el.dispatchEvent(new Event(ev)) }
    B.trocarVisao('jogador'); J.manual = false; J.usadas = 0; cfg.tentativas = 3; B.irPara('convite'); B.comecar(); B.trocarVisao('mestre'); await esperar(1700)
    const linhas = [...document.querySelectorAll('#placar li')].map((li) => li.querySelector('.pl__nome').textContent + ': ' + li.querySelector('.pl__status').textContent + ' | ' + li.querySelector('.pl__nums').textContent)
    $('#bPausaTodos').click(); const tb = B.bots.map((b) => b.R && b.R.t), tj = J.R.t; await esperar(300)
    const parado = B.bots.every((b, i) => (b.R && b.R.t) === tb[i]) && J.R.t === tj
    B.trocarVisao('jogador'); const overlay = !$('#pausa').hidden && $('#bContinuar').disabled; B.trocarVisao('mestre')
    $('#bPausaTodos').click(); await esperar(250); const voltou = J.R.t > tj && B.bots.some((b, i) => b.R && b.R.t > tb[i])
    $('#bEncerrar').click(); await esperar(100)
    const encerrou = { tela: B.tela, tipo: J.resultado && J.resultado.tipo, bots: B.bots.map((b) => b.fase), botao: $('#bEncerrar').textContent, deNovoDesligado: $('#rDeNovo').disabled }
    $('#bEncerrar').click(); await esperar(100)
    const reabriu = cfg.aberto && J.usadas === 0 && !$('#rDeNovo').disabled
    // como começa: mestre chama
    $('[data-inicio="mestre"]').click(); B.irPara('convite')
    const chama = { antes: $('#bAtirar').disabled, aviso: $('#cAviso').textContent, chamarVisivel: !$('#bChamar').hidden }
    $('#bChamar').click(); chama.depois = !$('#bAtirar').disabled; chama.bots = B.bots.map((b) => b.fase)
    $('[data-inicio="pino"]').click()
    // tentativas
    mudar('#mTent', '1'); J.manual = true; J.usadas = 0; B.trocarVisao('jogador'); B.irPara('convite'); B.comecar(); B.rodar(1.3 + 40 + 1.1); B.trocarVisao('mestre')
    const tentativas = { tela: B.tela, deNovoDesligado: $('#rDeNovo').disabled, motivo: $('#rTent').textContent }
    mudar('#mTent', '3'); tentativas.liberouDeNovo = !$('#rDeNovo').disabled
    // jogo marcado: dança e pesca fecham o convite com o motivo
    $('[data-jogo="danca"]').click(); B.irPara('convite')
    const fechado = { desligado: $('#bAtirar').disabled, aviso: $('#cAviso').textContent, campos: $('#fsTiro').disabled, nota: $('#notaJogo').textContent }
    $('[data-jogo="pesca"]').click(); fechado.pesca = $('#cAviso').textContent
    $('[data-jogo="tiro"]').click(); fechado.reabre = !$('#bAtirar').disabled
    // campos mudam o convite, o topo e a meta
    mudar('#mNome', 'Velho Bargo', 'input'); mudar('#mBarraca', 'Tenda do Estampido', 'input'); $('[data-meta="prata"]').click()
    const campos = { nome: $('#cNome').textContent, topo: $('.migalhas b').textContent, meta: $('#cMeta').textContent }
    mudar('#mNome', 'Tia Ferrolha', 'input'); mudar('#mBarraca', 'Barraca do Ferrolho', 'input'); $('[data-meta="bronze"]').click()
    J.manual = false
    return { linhas, parado, overlay, voltou, encerrou, reabriu, chama, tentativas, fechado, campos }
  })
  ok('mestre: placar ao vivo com você e 2 simulados (pontos, precisão, balas, tempo); pausar, continuar, encerrar e reabrir valem para todos', mestre.linhas.length === 3 && mestre.linhas.every((l) => /Pontos .*Precisão .*Balas .*Tempo/.test(l)) && mestre.parado && mestre.overlay && mestre.voltou && mestre.encerrou.tipo === 'encerrado' && mestre.encerrou.tela === 'resultado' && mestre.encerrou.bots.every((f) => f === 'encerrado') && mestre.encerrou.deNovoDesligado && mestre.reabriu, mestre)
  ok('mestre: "Mestre chama" fecha o convite até o chamado; tentativas acabam e voltam; Dança ou Pesca fecham o convite com o motivo; campos mudam convite, topo e meta', mestre.chama.antes && mestre.chama.chamarVisivel && /chamar/.test(mestre.chama.aviso) && mestre.chama.depois && mestre.tentativas.tela === 'resultado' && mestre.tentativas.deNovoDesligado && /tentativas/.test(mestre.tentativas.motivo) && mestre.tentativas.liberouDeNovo && mestre.fechado.desligado && /Dança/.test(mestre.fechado.aviso) && /Pesca/.test(mestre.fechado.pesca) && mestre.fechado.campos && mestre.fechado.reabre && mestre.campos.nome === 'Velho Bargo' && mestre.campos.topo === 'Tenda do Estampido' && /Prata/.test(mestre.campos.meta), { chama: mestre.chama, tentativas: mestre.tentativas, fechado: mestre.fechado, campos: mestre.campos })

  // ---------- 6. uma rodada inteira no Normal em tempo real: o robô joga por eventos de mouse e tecla; medição de quadro
  await page.evaluate(() => { const B = window.BarracaDeTiro; B.trocarVisao('jogador'); B.jogo.manual = false; B.jogo.usadas = 0; B.config.tentativas = 5; B.prefs.dif = 'normal'; B.irPara('convite'); B.amostras.intervalos.length = 0; B.amostras.trabalho.length = 0; window.__longas.length = 0 })
  const fluxo = page.evaluate(() => new Promise((ok) => {
    const B = window.BarracaDeTiro, J = B.jogo, palco = document.querySelector('#palco'), robo = B.SIM.criarRobo({}, 'tempo-real'), t0 = performance.now()
    const pe = (tipo, x, y) => { const p = B.paraTela(x, y); palco.dispatchEvent(new PointerEvent(tipo, { clientX: p.x, clientY: p.y, pointerId: 1, pointerType: 'mouse', isPrimary: true, bubbles: true, cancelable: true, button: 0 })) }
    document.querySelector('#bAtirar').click()
    const passo = () => {
      if (B.tela === 'resultado') { const r = J.resultado; return ok({ pontos: r.pontos, medalha: r.medalha, tiros: r.tiros, acertos: r.acertos, recargas: r.recargas, s: +((performance.now() - t0) / 1000).toFixed(1) }) }
      if (performance.now() - t0 > 70000) return ok({ erro: 'tempo esgotado', fase: J.fase })
      if (J.fase === 'rodada') {
        const o = robo.decidir(J.R)
        pe('pointermove', o.x, o.y)
        if (o.atirar) { pe('pointerdown', o.x, o.y); pe('pointerup', o.x, o.y) }
        if (o.recarregar) dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', bubbles: true }))
      }
      requestAnimationFrame(passo)
    }
    requestAnimationFrame(passo)
  }))
  await page.waitForFunction(() => { const J = window.BarracaDeTiro.jogo; return J.fase === 'rodada' && J.R.t > 8 && J.fx.some((f) => f.tipo === 'txt') }, null, { timeout: 40000 })
  await page.screenshot({ path: path.join(PROVAS, 'jogador-1440-rodada.png') })
  const resFluxo = await fluxo
  const des = await page.evaluate(() => ({ intervalos: window.BarracaDeTiro.amostras.intervalos.slice(), trabalho: window.BarracaDeTiro.amostras.trabalho.slice(), longas: window.__longas.slice() }))
  const quant = (arr, q) => { const s = [...arr].sort((a, b) => a - b); return s.length ? +s[Math.min(s.length - 1, Math.floor(q * s.length))].toFixed(1) : null }
  R.desempenho = { quadros: des.intervalos.length, intervaloP50: quant(des.intervalos, 0.5), intervaloP95: quant(des.intervalos, 0.95), trabalhoP95: quant(des.trabalho, 0.95), trabalhoMax: des.trabalho.length ? +Math.max(...des.trabalho).toFixed(1) : null, tarefasLongas: des.longas.map((d) => Math.round(d)) }
  ok('rodada inteira no Normal em tempo real, jogada por eventos de mouse e tecla R, chega ao resultado', !resFluxo.erro && resFluxo.tiros > 20 && resFluxo.acertos > 10, resFluxo)
  ok('quadro durante a rodada: p95 do intervalo <= 20 ms e nenhuma tarefa longa >= 200 ms', R.desempenho.quadros > 1000 && R.desempenho.intervaloP95 <= 20 && !des.longas.some((d) => d >= 200), R.desempenho)
  await page.waitForTimeout(600)
  await page.screenshot({ path: path.join(PROVAS, 'resultado-1440.png') })
  await preparar('mestre'); await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(PROVAS, 'mestre-1440.png') })

  // ---------- 7. sem rolagem horizontal em 1440, 1024 e 390 px
  const larguras = { 1440: 900, 1024: 768, 390: 844 }, rolagem = []
  for (const [w, h] of Object.entries(larguras)) {
    await page.setViewportSize({ width: +w, height: h })
    for (const tela of ['convite', 'rodada', 'resultado', 'mestre']) {
      await preparar(tela); await page.waitForTimeout(120)
      const r = await page.evaluate(() => { const els = [document.documentElement, ...document.querySelectorAll('.tela, .mestre, .coluna, .painel, .hud, .palco, .arma, .marcas, .escada, .numeros, .botoes, .cartoes')].filter((e) => e.offsetParent !== null || e === document.documentElement); const pior = els.find((e) => e.scrollWidth > e.clientWidth + 1); return { ok: !pior, onde: pior ? (pior.id || pior.className) : null, largura: document.documentElement.scrollWidth } })
      rolagem.push({ largura: +w, tela, ...r })
      if (+w === 390 && tela === 'rodada') await page.screenshot({ path: path.join(PROVAS, 'jogador-390-rodada.png') })
    }
  }
  ok('sem rolagem horizontal em 1440, 1024 e 390 px (convite, rodada, resultado, mestre)', rolagem.every((r) => r.ok), rolagem.filter((r) => !r.ok))
  await page.setViewportSize({ width: 1440, height: 900 })

  // ---------- 8. folha de contato: o mesmo desenho do jogo, quadro a quadro, com o tempo embaixo
  const folha = await page.evaluate(() => {
    const B = window.BarracaDeTiro, J = B.jogo, S = B.SIM
    B.trocarVisao('jogador'); J.manual = true; B.config.tentativas = 9; J.usadas = 0; B.prefs.dif = 'normal'; B.config.permitida = 'escolha'
    const quadros = [], cv = document.createElement('canvas'); cv.width = 256; cv.height = 144
    const cap = (rotulo, extra) => {
      B.desenharPalco(cv.getContext('2d'))
      const c = document.createElement('canvas'); c.width = 512; c.height = 288 + 30
      const g = c.getContext('2d'); g.imageSmoothingEnabled = false
      g.fillStyle = '#1a1a1e'; g.fillRect(0, 0, c.width, c.height); g.drawImage(cv, 0, 0, 512, 288)
      if (extra) extra(g)
      const r = J.R
      g.font = '600 13px Segoe UI, sans-serif'
      if (r) {
        for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(14 + i * 14, 303, 5, 0, Math.PI * 2); g.fillStyle = i < r.balas ? '#d9a84f' : '#0f0f12'; g.fill(); g.strokeStyle = '#4a4852'; g.stroke() }
        g.fillStyle = '#eceae4'; g.fillText(`Pontos ${r.pontos}   Combo ×${String(S.mult(r.combo)).replace('.', ',')} (${r.combo})   Tempo ${Math.max(0, Math.ceil(r.D.tempo - r.t))} s${r.recarga > 0 ? '   recarregando' : ''}`, 100, 308)
      } else { g.fillStyle = '#a2a09a'; g.fillText('Convite: a feirante atrás do balcão, a barraca vazia', 10, 308) }
      quadros.push({ c, rotulo, tempo: r ? `t = ${(J.fase === 'contagem' ? -(1.2 - J.tFase) : r.t).toFixed(2).replace('.', ',')} s` : 'antes da rodada' })
    }
    const texto = (s) => (g) => { g.font = '600 44px Georgia, serif'; g.textAlign = 'center'; g.fillStyle = '#000'; g.fillText(s, 258, 162); g.fillStyle = '#f6efdc'; g.fillText(s, 256, 160); g.textAlign = 'left' }
    const robo = S.criarRobo({}, 'folha')
    const um = () => B.rodar(S.DT, robo)
    const ate = (cond, max = 45) => { for (let k = 0; k < max / S.DT && !cond(); k++) um() }
    const novoEv = (nome, filtro) => { const i0 = J.R.ev.length; ate(() => J.R.ev.slice(i0).some((e) => e.nome === nome && (!filtro || filtro(e)))) }
    B.irPara('convite'); cap('Convite')
    B.comecar(); B.rodar(0.6); cap('Contagem: "Prontos…"', texto('Prontos…'))
    B.rodar(0.6 + 1.6, robo); cap('Já! Alvos entram nos trilhos')
    novoEv('acerto'); cap('Tiro: clarão no cano, coice, acerto')
    B.rodar(0.12, robo); cap('Alvo gira no trilho, +pontos')
    B.rodar(0.2, robo); cap('Alvo deitado; o trilho segue')
    novoEv('erro'); B.rodar(S.DT * 4); cap('Erro: poeira e buraco na parede')
    ate(() => J.R.balas === 0 && J.R.recarga <= 0); J.fila.atirar = 1; B.rodar(S.DT * 2); cap('Sem bala: clique seco (não conta tiro)')
    J.fila.recarregar = true; B.rodar(0.35); cap('Recarga: arma abaixada, tambor girando')
    ate(() => J.R.ev.length && J.R.ev[J.R.ev.length - 1].nome === 'pronto', 3); B.rodar(S.DT * 2); cap('Engatilhou: seis balas')
    ate(() => J.R.combo >= 5); cap('Combo de 5: pontos valem ×1,5')
    ate(() => J.fase === 'fim'); B.rodar(0.1); cap('Sino: fim da rodada')
    B.rodar(1.0); const res = J.resultado
    const med = document.createElement('canvas'); med.width = 32; med.height = 40; B.desenharMedalha(med.getContext('2d'), res.medalha)
    cap('Resultado', (g) => { g.fillStyle = 'rgba(20,20,23,0.86)'; g.fillRect(0, 0, 512, 288); g.imageSmoothingEnabled = false; g.drawImage(med, 40, 64, 128, 160); g.fillStyle = '#eceae4'; g.font = '600 30px Georgia, serif'; g.fillText(res.medalha ? res.medalha[0].toUpperCase() + res.medalha.slice(1) : 'Sem medalha', 200, 110); g.font = '15px Segoe UI, sans-serif'; g.fillStyle = '#a2a09a'; g.fillText(`${res.pontos} pontos, ${Math.round((res.acertos / res.tiros) * 100)}% de precisão`, 200, 140); g.fillText(`combo máximo ${res.comboMax}, ${res.recargas} recargas`, 200, 162); g.fillText(res.passou ? 'Passou na meta (bronze)' : 'Não passou na meta', 200, 192) })
    // Extremo: o alvo proibido
    B.prefs.dif = 'extremo'; B.irPara('convite'); B.comecar(); B.rodar(1.3)
    const roboX = S.criarRobo({ confunde: 0 }, 'folha-x')
    let alvo = null
    for (let k = 0; k < 30 / S.DT && !alvo; k++) { B.rodar(S.DT, roboX); alvo = J.R.alvos.find((a) => a.tipo === 'aldeao' && S.atingivel(a) && a.sub === 1) }
    let proib = 0
    if (alvo) { B.rodar(0.25, roboX); if (alvo.estado === 'ativo') { J.mira.x = alvo.x; J.mira.y = alvo.y; ate(() => J.R.cao <= 0 && J.R.recarga <= 0 && J.R.balas > 0, 2); J.mira.x = alvo.x; J.mira.y = alvo.y; J.fila.atirar = 1; B.rodar(S.DT * 2); proib = J.R.proibidos } }
    cap('Extremo: aldeão acertado, −50 e combo zera')
    B.rodar(0.18); cap('O aldeão cai atrás do caixote')
    B.prefs.dif = 'normal'
    const col = 4, fw = 512, fh = 318, linhas = Math.ceil(quadros.length / col)
    const f = document.createElement('canvas'); f.width = col * (fw + 14) + 14; f.height = 46 + linhas * (fh + 46)
    const g = f.getContext('2d'); g.imageSmoothingEnabled = false
    g.fillStyle = '#121214'; g.fillRect(0, 0, f.width, f.height)
    g.fillStyle = '#eceae4'; g.font = '600 16px Segoe UI, sans-serif'; g.fillText(`Ciclo do jogador: convite, contagem, tiros, acerto e queda, erro, clique seco, recarga, combo, sino, resultado (Normal) e alvo proibido (Extremo); ${quadros.length} quadros, palco 2× com balas, pontos e tempo embaixo`, 14, 28)
    quadros.forEach((q, i) => {
      const x = 14 + (i % col) * (fw + 14), y = 42 + Math.floor(i / col) * (fh + 46)
      g.drawImage(q.c, x, y)
      g.fillStyle = '#a2a09a'; g.font = '13px Segoe UI, sans-serif'; g.fillText(q.rotulo, x, y + fh + 17)
      g.fillStyle = '#e0a44a'; g.fillText(q.tempo, x, y + fh + 34)
    })
    return { png: f.toDataURL('image/png'), quadros: quadros.length, rotulos: quadros.map((q) => q.rotulo), proibidoAcertado: proib, medalha: res.medalha, pontos: res.pontos }
  })
  salvarPng('folha-contato.png', folha.png)
  R.folha = { quadros: folha.quadros, proibidoAcertado: folha.proibidoAcertado, medalha: folha.medalha, pontos: folha.pontos }
  ok('folha de contato com 12 a 16 quadros, inclusive o alvo proibido acertado no Extremo', folha.quadros >= 12 && folha.quadros <= 16 && folha.proibidoAcertado === 1, R.folha)

  // ---------- 9. gráfico do movimento (o mesmo robô e a mesma semente no Normal e no Extremo)
  const grafico = await page.evaluate((graf) => {
    const COR = { anel: '#2a78d6', garrafa: '#eb6834', goblin: '#1baf7a', rato: '#eda100', morcego: '#e87ba4', moeda: '#008300', aldeao: '#e34948', gato: '#6250d6' }
    const NOME = { anel: 'alvo de anel', garrafa: 'garrafa', goblin: 'goblin de papelão', rato: 'rato', morcego: 'morcego', moeda: 'moeda', aldeao: 'aldeão (proibido)', gato: 'gato de lata (proibido)' }
    const INK = '#0b0b0b', MUTED = '#52514e', GRID = '#e6e6e3', SURF = '#fcfcfb', FIM = 40
    const x0 = 70, lw = 1180, hA = 220, hB = 60, hC = 110, bloco = 34 + hA + 44 + hB + 30 + hC + 70
    const c = document.createElement('canvas'); c.width = x0 + lw + 40; c.height = 20 + graf.length * bloco
    const g = c.getContext('2d'); g.fillStyle = SURF; g.fillRect(0, 0, c.width, c.height)
    const X = (t) => x0 + (t / FIM) * lw
    const eixoT = (y) => { g.fillStyle = MUTED; g.font = '11px Segoe UI, sans-serif'; for (let t = 0; t <= FIM; t += 5) g.fillText(t + ' s', X(t) - 8, y + 14) }
    const grade = (y, h, marcas, fmt) => { g.strokeStyle = GRID; g.lineWidth = 1; g.fillStyle = MUTED; g.font = '11px Segoe UI, sans-serif'; marcas.forEach((m) => { const yy = Math.round(y + h - m.k * h) + 0.5; g.beginPath(); g.moveTo(x0, yy); g.lineTo(x0 + lw, yy); g.stroke(); g.fillText(fmt(m), 6, yy + 4) }) }
    graf.forEach((d, k) => {
      const y0 = 20 + k * bloco, am = d.amostras, ev = d.eventos
      g.fillStyle = INK; g.font = '600 14px Segoe UI, sans-serif'
      g.fillText(`${d.dif === 'normal' ? 'Normal' : 'Extremo'} (${d.tempo} s): robô humano, semente "grafico|1": ${d.pontos} pontos, ${d.medalha || 'sem medalha'}, ${Math.round(d.precisao * 100)}% de precisão`, x0, y0 + 14)
      // A: posição horizontal dos alvos e da mira
      const yA = y0 + 30, YA = (v) => yA + hA - (v / 256) * hA
      grade(yA, hA, [0, 64, 128, 192, 256].map((v) => ({ k: v / 256, v })), (m) => m.v + ' px')
      const tracos = new Map()
      am.forEach((a) => a[7].forEach((t) => { if (t[4] === 2) return; if (!tracos.has(t[0])) tracos.set(t[0], { tipo: t[1], pts: [] }); tracos.get(t[0]).pts.push([a[0], t[2]]) }))
      for (const { tipo, pts } of tracos.values()) {
        g.strokeStyle = COR[tipo]; g.lineWidth = 2; g.setLineDash(tipo === 'aldeao' || tipo === 'gato' ? [5, 3] : [])
        g.beginPath(); let ant = null
        pts.forEach(([t, x]) => { const px = X(t), py = YA(Math.max(0, Math.min(256, x))); if (ant && t - ant < 0.15) g.lineTo(px, py); else g.moveTo(px, py); ant = t }); g.stroke()
      }
      g.setLineDash([])
      g.strokeStyle = INK; g.lineWidth = 2.5; g.beginPath(); am.forEach((a, i) => (i ? g.lineTo(X(a[0]), YA(a[1])) : g.moveTo(X(a[0]), YA(a[1])))); g.stroke()
      ev.forEach((e) => {
        if (!['acerto', 'erro', 'proibido'].includes(e.nome)) return
        const px = X(e.t), py = YA(e.x)
        g.beginPath(); g.arc(px, py, 4, 0, Math.PI * 2); g.lineWidth = 2
        if (e.nome === 'acerto') { g.fillStyle = INK; g.fill(); g.strokeStyle = SURF; g.stroke() }
        else if (e.nome === 'erro') { g.fillStyle = SURF; g.fill(); g.strokeStyle = INK; g.stroke() }
        else { g.strokeStyle = '#e34948'; g.beginPath(); g.moveTo(px - 4, py - 4); g.lineTo(px + 4, py + 4); g.moveTo(px + 4, py - 4); g.lineTo(px - 4, py + 4); g.stroke() }
      })
      eixoT(yA + hA)
      let lx = x0, ly = yA + hA + 32
      g.font = '12px Segoe UI, sans-serif'
      const item = (desenho, txt) => { desenho(lx, ly); g.fillStyle = INK; g.fillText(txt, lx + 24, ly + 4); lx += 34 + g.measureText(txt).width }
      item((x, y) => { g.strokeStyle = INK; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 18, y); g.stroke() }, 'mira do robô')
      item((x, y) => { g.fillStyle = INK; g.beginPath(); g.arc(x + 9, y, 4, 0, 7); g.fill() }, 'acerto')
      item((x, y) => { g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.arc(x + 9, y, 4, 0, 7); g.stroke() }, 'erro')
      if (ev.some((e) => e.nome === 'proibido')) item((x, y) => { g.strokeStyle = '#e34948'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 5, y - 4); g.lineTo(x + 13, y + 4); g.moveTo(x + 13, y - 4); g.lineTo(x + 5, y + 4); g.stroke() }, 'tiro no proibido')
      for (const tipo of Object.keys(COR)) if ([...tracos.values()].some((t) => t.tipo === tipo)) item((x, y) => { g.strokeStyle = COR[tipo]; g.lineWidth = 2; g.setLineDash(tipo === 'aldeao' || tipo === 'gato' ? [5, 3] : []); g.beginPath(); g.moveTo(x, y); g.lineTo(x + 18, y); g.stroke(); g.setLineDash([]) }, NOME[tipo])
      // B: balas no tambor
      const yB = yA + hA + 50, YB = (v) => yB + hB - (v / 6) * hB
      g.fillStyle = INK; g.font = '600 12px Segoe UI, sans-serif'; g.fillText('Balas no tambor (faixa cinza = recarregando)', x0, yB - 6)
      grade(yB, hB, [0, 3, 6].map((v) => ({ k: v / 6, v })), (m) => String(m.v))
      g.fillStyle = 'rgba(82,81,78,0.14)'; let ini = null
      ev.forEach((e) => { if (e.nome === 'recarga') ini = e.t; if (e.nome === 'pronto' && ini !== null) { g.fillRect(X(ini), yB, X(e.t) - X(ini), hB); ini = null } })
      g.strokeStyle = MUTED; g.lineWidth = 2; g.beginPath(); am.forEach((a, i) => { if (i) g.lineTo(X(a[0]), YB(am[i - 1][3])); i ? g.lineTo(X(a[0]), YB(a[3])) : g.moveTo(X(a[0]), YB(a[3])) }); g.stroke()
      // C: pontos e as medalhas
      const yC = yB + hB + 30, top = Math.max(d.medalhas[2] * 1.15, d.pontos * 1.05), YC = (v) => yC + hC - (v / top) * hC
      g.fillStyle = INK; g.font = '600 12px Segoe UI, sans-serif'; g.fillText('Pontos (linhas tracejadas: bronze, prata e ouro desta dificuldade)', x0, yC - 6)
      grade(yC, hC, [0, 0.5, 1].map((k) => ({ k, v: Math.round(top * k) })), (m) => String(m.v))
      d.medalhas.forEach((m, i) => { g.strokeStyle = MUTED; g.setLineDash([3, 4]); g.lineWidth = 1; g.beginPath(); g.moveTo(x0, YC(m) + 0.5); g.lineTo(x0 + lw, YC(m) + 0.5); g.stroke(); g.setLineDash([]); g.fillStyle = MUTED; g.font = '11px Segoe UI, sans-serif'; g.fillText(['bronze', 'prata', 'ouro'][i] + ' ' + m, x0 + lw - 70, YC(m) - 3) })
      g.strokeStyle = '#2a78d6'; g.lineWidth = 2; g.beginPath(); am.forEach((a, i) => (i ? g.lineTo(X(a[0]), YC(a[4])) : g.moveTo(X(a[0]), YC(a[4])))); g.stroke()
      eixoT(yC + hC)
      g.fillStyle = MUTED; g.font = '11px Segoe UI, sans-serif'; g.fillText(`${am.length} amostras, uma a cada 0,1 s; eixo do tempo igual nas duas dificuldades (0 a 40 s)`, x0, yC + hC + 34)
    })
    return c.toDataURL('image/png')
  }, graf)
  salvarPng('grafico-movimento.png', grafico)
  R.grafico = graf.map((d) => ({ dif: d.dif, pontos: d.pontos, medalha: d.medalha, precisao: +d.precisao.toFixed(3), amostras: d.amostras.length }))

  // ---------- 10. som: catálogo e a rodada do gráfico, renderizados offline; .wav, medidas e envoltória
  const ATRASO = 1.3 // a contagem (1,2 s) e o realejo vêm antes do "Já!" (t = 0 da rodada)
  const som = await page.evaluate(async ({ eventos, tempo, atraso }) => {
    const B = window.BarracaDeTiro, S = B.SOM
    const para16 = (buf) => { const n = buf.length, l = buf.getChannelData(0), r = buf.getChannelData(1), a = new Int16Array(n * 2); for (let i = 0; i < n; i++) { a[2 * i] = Math.max(-32768, Math.min(32767, Math.round(l[i] * 32767))); a[2 * i + 1] = Math.max(-32768, Math.min(32767, Math.round(r[i] * 32767))) } const u = new Uint8Array(a.buffer); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s) }
    const f32 = (buf) => [0, 1].map((c) => { const u = new Uint8Array(buf.getChannelData(c).buffer); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s) })
    const off1 = new OfflineAudioContext(2, Math.round(48000 * S.DURACAO_SEQ), 48000)
    S.sequencia(off1, S.cadeia(off1, off1.destination), 0)
    const cat = await off1.startRendering()
    const dur = tempo + atraso + 2.2, off2 = new OfflineAudioContext(2, Math.round(48000 * dur), 48000), saida = S.cadeia(off2, off2.destination)
    S.realejo(off2, saida, 0.1); S.engatilhar(off2, saida, atraso)
    const linha = []
    for (const e of eventos) for (const [nome, v] of B.sonsDoEvento(e)) { S[nome](off2, saida, atraso + e.t, v); linha.push([nome, e.t]) }
    const rod = await off2.startRendering()
    return { catalogo: f32(cat), rodada: para16(rod), seq: S.SEQ, linha }
  }, { eventos: graf[0].eventos, tempo: graf[0].tempo, atraso: ATRASO })
  const deB64 = (s) => { const b = Buffer.from(s, 'base64'); return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4) }
  const catalogo = som.catalogo.map(deB64)
  const b16 = Buffer.from(som.rodada, 'base64'), i16 = new Int16Array(b16.buffer, b16.byteOffset, b16.byteLength / 2)
  const rodada = [new Float32Array(i16.length / 2), new Float32Array(i16.length / 2)]
  for (let i = 0; i < rodada[0].length; i++) { rodada[0][i] = i16[2 * i] / 32767; rodada[1][i] = i16[2 * i + 1] / 32767 }
  fs.writeFileSync(path.join(SOM_DIR, 'sons-do-tiro.wav'), medidas.wav16(catalogo, 48000))
  fs.writeFileSync(path.join(SOM_DIR, 'rodada-normal.wav'), medidas.wav16(rodada, 48000))
  const resumo = (m) => Object.fromEntries(Object.entries(m).filter(([k, v]) => (typeof v !== 'object' || v === null) && k !== 'taxa' && k !== 'canais'))
  const mCat = medidas.medirTudo(catalogo, 48000), mRod = medidas.medirTudo(rodada, 48000)
  R.som = { catalogo: { ...resumo(mCat), cliques: mCat.cliques.length }, rodada: { ...resumo(mRod), cliques: mRod.cliques.length, cliquesEm: mRod.cliques.map((c) => +(c.t - ATRASO).toFixed(3)), sons: som.linha.length } }
  fs.writeFileSync(path.join(SOM_DIR, 'medidas.json'), JSON.stringify({ catalogo: mCat, rodada: mRod }, null, 2))
  console.log('som:', JSON.stringify(R.som))
  ok('som do catálogo medido: pico verdadeiro <= -1 dBTP, nenhuma amostra cortada, nenhum clique', mCat.picoVerdadeiroDbtp <= -1 && mCat.cortes === 0 && mCat.cliques.length === 0, R.som.catalogo)
  ok('som de uma rodada inteira medido (tiros encostados): pico verdadeiro <= -1 dBTP, nenhuma amostra cortada', mRod.picoVerdadeiroDbtp <= -1 && mRod.cortes === 0, R.som.rodada)
  const envC = medidas.envoltoria(catalogo, 48000, 0.005), envR = medidas.envoltoria(rodada, 48000, 0.01)
  const onda = await page.evaluate(({ envC, envR, seq, linha, durC, durR, atraso }) => {
    const x0 = 70, lw = 1180, hh = 120, c = document.createElement('canvas'); c.width = x0 + lw + 40; c.height = 2 * (hh + 130) + 20
    const g = c.getContext('2d'), nivel = (db) => Math.min(1, Math.max(0, (db + 60) / 60))
    g.fillStyle = '#fcfcfb'; g.fillRect(0, 0, c.width, c.height)
    const faixa = (y0, arr, dur, titulo, marcas, t0, passo, X) => {
      g.fillStyle = '#0b0b0b'; g.font = '600 13px Segoe UI, sans-serif'; g.fillText(titulo, x0, y0 - 40)
      g.fillStyle = '#b7791f'; const n = arr.length
      for (let i = 0; i < n; i++) { const v = nivel(arr[i]), x = x0 + (i / n) * lw; g.fillRect(x, y0 + hh / 2 - (v * hh) / 2, Math.max(1, lw / n), Math.max(1, v * hh)) }
      marcas(y0)
      g.fillStyle = '#52514e'; g.font = '11px Segoe UI, sans-serif'
      for (let t = Math.ceil(t0); t <= dur + t0 + 1e-9; t += passo) { const x = X(t); g.fillRect(x, y0 + hh + 4, 1, 5); g.fillText(String(t).replace('.', ',') + ' s', x - 8, y0 + hh + 20) }
    }
    const XC = (t) => x0 + (t / durC) * lw
    const nomes = { realejo: 'realejo', engatilhar: 'engatilhar', tiro: 'tiro', madeira: '+madeira', ricochete: '+ricochete', vidro: '+vidro', moeda: '+moeda', proibido: '+proibido', seco: 'clique seco', tambor: 'tambor (recarga)', sino: 'sino do fim' }
    faixa(70, envC.pico, durC, 'Catálogo: todos os sons, um depois do outro (envoltória do pico a cada 5 ms, de −60 dBFS no meio a 0 dBFS na borda; 48 kHz, cadeia do jogo)', (y0) => {
      let ult = -1
      seq.forEach(([nome, t], i) => { g.fillStyle = 'rgba(42,120,214,0.9)'; g.fillRect(XC(t), y0 + hh + 10, 1, 6); if (nome === 'tiro' || t !== ult) { g.fillStyle = '#0b0b0b'; g.font = '11px Segoe UI, sans-serif'; g.fillText(nomes[nome], XC(t) - 2, y0 - 8 - (i % 2) * 13) } ult = t })
    }, 0, 1, XC)
    const XR = (t) => x0 + ((t + atraso) / durR) * lw
    faixa(70 + hh + 130, envR.pico, durR, 'Rodada Normal do gráfico (mesmos eventos, mesma semente): envoltória a cada 10 ms; t = 0 é o "Já!", o realejo toca na contagem', (y0) => {
      g.fillStyle = 'rgba(42,120,214,0.7)'
      linha.forEach(([nome, t]) => { if (nome === 'tiro' || nome === 'tambor' || nome === 'sino' || nome === 'seco') g.fillRect(XR(t), y0 + hh + 10, 1, nome === 'tiro' ? 4 : 8) })
      g.fillStyle = '#52514e'; g.font = '11px Segoe UI, sans-serif'; g.fillText('traços azuis: cada tiro (curto), recarga, clique seco e sino (longos); eixo do tempo igual ao do gráfico do movimento', x0, y0 + hh + 40)
    }, -atraso, 5, XR)
    return c.toDataURL('image/png')
  }, { envC, envR, seq: som.seq, linha: som.linha, durC: catalogo[0].length / 48000, durR: rodada[0].length / 48000, atraso: ATRASO })
  salvarPng('onda-som.png', onda)

  R.errosConsole = erros
  ok('nenhum erro no console', erros.length === 0, erros)
  await navegador.close()

  // ---------- 11. conferir-som (medir não é ouvir)
  if (!process.argv.includes('--sem-conferir')) {
    const cs = spawnSync(process.execPath, [path.join(RAIZ, 'scripts', 'conferir-som.cjs'), path.join(SOM_DIR, 'sons-do-tiro.ts'), '--saida', SOM_DIR], { cwd: RAIZ, encoding: 'utf8', timeout: 300000 })
    fs.writeFileSync(path.join(SOM_DIR, 'conferir-som.txt'), (cs.stdout || '') + (cs.stderr || ''))
    const aprovado = /sons-do-tiro: aprovado/.test(cs.stdout || '')
    R.conferirSom = { codigo: cs.status, veredito: aprovado ? 'aprovado nas medidas' : 'ver som/conferir-som.txt' }
    ok('conferir-som do catálogo: aprovado nas medidas (pico, cortes, cliques, DC e volume perto da mediana das aprovadas)', aprovado, R.conferirSom)
  }
  fs.writeFileSync(path.join(PROVAS, 'testes.json'), JSON.stringify(R, null, 2))
  const falhas = R.testes.filter((t) => !t.passou).length
  console.log(`\n${R.testes.length - falhas} de ${R.testes.length} testes passaram.`)
  process.exitCode = falhas ? 1 : 0
}
main().catch((e) => { console.error(e); process.exitCode = 2 })
