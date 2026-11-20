'use strict'
/**
 * Provas da cena "Canhão do chão" da Alavanca (não é código do app).
 *
 *   node docs/design/minigames/provas-canhao/gerar-provas.cjs
 *
 * Abre ../alavanca-da-ponte.html?cena=canhao no Edge (Playwright do repo, sem
 * janela) e grava aqui: testes.json, a folha de contato, 3 prints e os .wav em
 * som/. As metas estão em metas.json, escritas antes das provas.
 *
 * O jogo é o mesmo da ponte: a prova principal é que a cena não mexe nos
 * números (bloco SIM idêntico ao do commit aprovado, as mesmas 400 partidas por
 * caso, a mesma partida ao vivo nas duas cenas).
 */
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const { chromium } = require('playwright')
const medidas = require('../../../../scripts/som/medidas.cjs')

const PROVAS = __dirname
const PAGINA = path.join(PROVAS, '..', 'alavanca-da-ponte.html')
const SOM_DIR = path.join(PROVAS, 'som')
const META = JSON.parse(fs.readFileSync(path.join(PROVAS, 'metas.json'), 'utf8'))
const PONTE = JSON.parse(fs.readFileSync(path.join(PROVAS, '..', 'provas-alavanca', 'testes.json'), 'utf8'))
const N = PONTE.metas.roboHumano.rodadasPorCaso
const salvarPng = (nome, dataUrl) => fs.writeFileSync(path.join(PROVAS, nome), Buffer.from(dataUrl.split(',')[1], 'base64'))
const quant = (arr, q) => { const s = [...arr].sort((a, b) => a - b); return s.length ? +s[Math.min(s.length - 1, Math.floor(q * s.length))].toFixed(1) : null }
const blocoSim = (html) => { const a = html.indexOf('// ==== SIM:INICIO ===='), b = html.indexOf('// ==== SIM:FIM ===='); return a >= 0 && b > a ? html.slice(a, b) : null }

async function main() {
  fs.mkdirSync(SOM_DIR, { recursive: true })
  const R = { metas: META, testes: [] }
  const ok = (nome, passou, detalhe) => { R.testes.push({ nome, passou: !!passou, detalhe }); console.log(`${passou ? 'PASSOU' : 'FALHOU'}  ${nome}${detalhe ? '  — ' + JSON.stringify(detalhe) : ''}`) }

  // ---------- 1. os números: o bloco SIM é o mesmo do commit aprovado
  const raiz = path.join(PROVAS, '..', '..', '..', '..')
  const antes = execFileSync('git', ['show', `${META.numeros.blocoSimIgualAoCommit}:docs/design/minigames/alavanca-da-ponte.html`], { cwd: raiz, encoding: 'utf8', maxBuffer: 1 << 24 })
  const simAntes = blocoSim(antes), simAgora = blocoSim(fs.readFileSync(PAGINA, 'utf8'))
  ok(`o bloco SIM (física, dificuldades, robôs) é idêntico ao do commit ${META.numeros.blocoSimIgualAoCommit}, letra por letra`, simAntes && simAgora && simAntes === simAgora, { caracteres: simAgora ? simAgora.length : null })

  const navegador = await chromium.launch({ channel: 'msedge', args: ['--autoplay-policy=no-user-gesture-required'] }).catch(() => chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }))
  const ctx = await navegador.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  await ctx.addInitScript(() => {
    window.__longas = []
    try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__longas.push(e.duration))).observe({ type: 'longtask', buffered: true }) } catch {}
  })
  const page = await ctx.newPage()
  const erros = []
  page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()) })
  page.on('pageerror', (e) => erros.push(String(e)))
  await page.goto('file:///' + PAGINA.replace(/\\/g, '/') + '?cena=canhao')
  await page.waitForFunction(() => window.AlavancaDaPonte)

  // ---------- 2. os números: as mesmas 400 partidas por caso, com a página aberta no canhão
  const robo = await page.evaluate((N) => {
    const S = window.AlavancaDaPonte.SIM, casos = {}
    for (const [dif, n] of [['facil', 1], ['normal', 1], ['dificil', 1], ['normal', 3]]) {
      let v = 0
      for (let i = 0; i < N; i++) if (S.simular({ dif, jogadores: n }, `robo|${dif}|${n}|${i}`, { leve: true }).venceu) v++
      casos[`${dif}_${n}`] = v / N
    }
    return { cena: window.AlavancaDaPonte.J.cena, casos }
  }, N)
  const iguais = Object.entries(robo.casos).map(([k, v]) => ({ caso: k, canhao: v, ponte: PONTE.robo[k].vitoria }))
  ok(`robô humano, ${N} partidas por caso, página no canhão: a vitória é exatamente a da ponte (Fácil, Normal, Difícil, Normal com 3)`, robo.cena === 'canhao' && iguais.every((c) => c.canhao === c.ponte), iguais)

  // ---------- 3. a mesma partida ao vivo nas duas cenas
  const vivo = await page.evaluate(() => {
    const A = window.AlavancaDaPonte, J = A.J, S = A.SIM
    const jogar = (cena, semente) => {
      J.manual = true; A.escolherCena(cena); A.config.dif = 'normal'; A.config.jogadores = 1; A.config.tempo = null
      A.irPara('convite'); J.roboVoce = S.criarHumano(semente); A.comecar()
      for (let k = 0; k < 40 / S.DT && J.tela !== 'resultado'; k++) A.rodar(S.DT)
      const r = J.resultado; J.roboVoce = null
      return { cena: J.cena, tipo: r.tipo, tFim: +r.tFim.toFixed(4), giros: r.total, soltou: r.soltou, pMax: +r.pMax.toFixed(4) }
    }
    const out = []
    for (const semente of ['mesma|1', 'mesma|2', 'mesma|3']) out.push({ semente, ponte: jogar('ponte', semente), canhao: jogar('canhao', semente) })
    return out
  })
  const semCena = (o) => JSON.stringify({ ...o, cena: undefined })
  ok('a mesma semente jogada ao vivo dá o mesmo resultado nas duas cenas (desfecho, tempo, giros, catraca solta, ponto máximo)', vivo.every((v) => v.ponte.cena === 'ponte' && v.canhao.cena === 'canhao' && semCena(v.ponte) === semCena(v.canhao)), vivo)

  // ---------- 4. a cena amostrada a cada 0,1 s: folhas, plataforma, boca do cano, trava
  const cena = await page.evaluate(() => {
    const A = window.AlavancaDaPonte, J = A.J, S = A.SIM, B = A.BAL, C = A.CANO
    J.manual = true; A.escolherCena('canhao'); A.config.dif = 'normal'; A.config.jogadores = 1
    A.irPara('convite')
    let k = 0
    while (S.criarHumano(`cena|${k}`).ritmo < 6.8) k++
    J.roboVoce = S.criarHumano(`cena|${k}`); A.comecar()
    const det = J.detector, eventos = []
    J.detector = (p) => { const ev = det(p); for (const n of ev) eventos.push({ t: +J.P.t.toFixed(3), nome: n, p: +p.toFixed(4) }); return ev }
    A.rodar(0.8)
    // a rodada, amostrada a cada 0,1 s (12 passos), parando no passo exato em que ela acaba
    const amostras = []
    for (let i = 1; J.tela === 'rodada'; i++) { A.rodar(S.DT); if (i % 12 === 0 || J.tela !== 'rodada') { const e = A.estadoVisual(); amostras.push([+J.P.t.toFixed(2), +e.p.toFixed(4), e.cano, e.trava]) } }
    // o fim da vitória, a cada 1/120 s desde o passo em que o canhão chegou: os ferrolhos e o cano baixando
    const fim = []
    for (let i = 0; i < 0.7 / S.DT; i++) { A.rodar(S.DT); const e = A.estadoVisual(); fim.push([+((i + 1) * S.DT).toFixed(4), e.cano, e.trava]) }
    // geometria: onde fica a boca do cano
    const gs = Math.sin(C.guinada), gc = Math.cos(C.guinada), [mz, mh] = C.munhao
    const boca = (Hp, phi) => { const dz = mz + C.frente * Math.cos(phi), h = mh + C.frente * Math.sin(phi); return { X: B.xc + dz * gs, Z: B.zc + dz * gc, H: Hp + h } }
    J.roboVoce = null
    return { fimTipo: J.fimTipo, eventos, amostras, fim, bocaFechada: boca(-B.poco, C.ergue), bocaErguidaNoPoco: boca(-B.poco * 0.5, C.ergue), bocaNoFim: boca(0, C.mira), B, C, dentes: A.DENTES_CANO }
  })
  const B = cena.B, C = cena.C
  const primeiroAcima = cena.amostras.find((a) => a[1] >= META.cena.folhasAbertasEm)
  const folhas = cena.eventos.filter((e) => e.nome === 'folhasBatem')
  ok(`as folhas do alçapão batem abertas quando a plataforma passa de ${META.cena.folhasAbertasEm * 100}% (evento de som na hora certa, antes da amostra de 0,1 s que primeiro passa)`, folhas.length >= 1 && folhas[0].p >= META.cena.folhasAbertasEm && folhas[0].p < META.cena.folhasAbertasEm + 0.01 && primeiroAcima && folhas[0].t <= primeiroAcima[0] + 1e-6, { folhas, primeiroAcima })
  const bf = cena.bocaFechada, bn = cena.bocaNoFim, bp = cena.bocaErguidaNoPoco
  ok('com o alçapão fechado a boca do cano fica abaixo das lajes; erguido no poço, cabe no vão do alçapão', bf.H < 0 && bp.X > B.xc - B.meia && bp.X < B.xc + B.meia && bp.Z > B.z0 && bp.Z < B.z1, { bocaFechada: bf, bocaErguidaNoPoco: bp })
  ok('no fim a boca do cano fica dentro da ameia: entre os merlões, na espessura do parapeito e acima do peitoril', bn.Z >= B.zp && bn.Z <= B.zp + B.esp && bn.X - C.rFrente >= B.ameia - B.vao / 2 && bn.X + C.rFrente <= B.ameia + B.vao / 2 && bn.H - C.rFrente > B.peitoril, bn)
  const durante = cena.amostras.slice(0, -1).every((a) => a[2] === 1 && a[3] === 0)
  const tCano = (alvo) => { const i = cena.fim.findIndex((f) => f[1] <= alvo + 1e-9); return i < 0 ? null : cena.fim[i][0] }
  const marcas = [0.75, 0.5, 0.25, 0].map((alvo, i) => ({ alvo, chegou: tCano(alvo), clique: cena.dentes[i] }))
  const travaEm = (cena.fim.find((f) => f[2] >= 1) || [null])[0]
  const monotono = cena.fim.every((f, i) => i === 0 || f[1] <= cena.fim[i - 1][1] + 1e-9)
  ok(`vitória: o cano fica erguido a rodada toda; no topo os ferrolhos entram em ${Math.round(0.06 * 1000)} ms e o cano baixa em 4 dentes, cada um chegando no clique do som (± ${META.cena.toleranciaDoCliqueS * 1000} ms)`, cena.fimTipo === 'baixou' && durante && monotono && travaEm !== null && travaEm <= 0.07 && marcas.every((m) => m.chegou !== null && Math.abs(m.chegou - m.clique) <= META.cena.toleranciaDoCliqueS), { marcas, travaEm, monotono })

  // ---------- 5. troca de cena pelo mestre
  const troca = await page.evaluate(async () => {
    const A = window.AlavancaDaPonte, J = A.J, $ = (s) => document.querySelector(s)
    const quadro = () => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))) // o HUD se pinta no quadro
    J.manual = true; A.trocarVisao('mestre'); A.irPara('convite')
    const ler = () => ({ titulo: $('#cTitulo').textContent, migalha: $('#migalhaCena').textContent, aba: document.title, legenda: $('#dLegenda').textContent, cena: J.cena, desenho: A.estadoVisual().cena, botao: $('[data-cena="canhao"]').getAttribute('aria-pressed') })
    const out = { inicio: ler() }
    $('[data-cena="ponte"]').click(); out.ponte = ler()
    $('[data-cena="canhao"]').click(); out.canhao = ler()
    // no meio da rodada a troca espera a próxima rodada
    A.trocarVisao('jogador'); J.roboVoce = A.SIM.criarHumano('troca'); A.comecar(); A.rodar(2)
    $('[data-cena="ponte"]').click(); A.rodar(0.5)
    out.meio = { cena: J.cena, config: A.config.cena, tela: J.tela, rotulo: $('#rRotuloObjeto').textContent }
    A.encerrarPeloMestre(); A.irPara('convite'); out.depois = ler()
    $('[data-cena="canhao"]').click(); J.roboVoce = null
    // HUD e resultado no canhão
    A.config.dif = 'facil'; J.roboVoce = A.SIM.criarMetronomo(9); A.comecar(); A.rodar(1.5); await quadro()
    out.hud = { objeto: $('#rRotuloObjeto').textContent, forca: $('#rRotuloForca').textContent, aria: $('#mPonte').getAttribute('aria-label'), canvas: $('#cena').getAttribute('aria-label'), mestre: $('#mPRotulo').textContent }
    for (let k = 0; k < 30 / A.SIM.DT && J.tela !== 'fim'; k++) A.rodar(A.SIM.DT)
    await quadro()
    for (let k = 0; k < 30 / A.SIM.DT && J.tela !== 'resultado'; k++) A.rodar(A.SIM.DT)
    out.resultado = { titulo: $('#resTitulo').textContent, desfecho: $('#resDesfecho').textContent, canvas: $('#cena').getAttribute('aria-label') }
    J.roboVoce = null; A.config.dif = 'normal'; A.irPara('convite')
    return out
  })
  ok('a página aberta com ?cena=canhao já começa no canhão (título, migalha, aba do navegador, legenda do mestre, desenho)', troca.inicio.titulo === 'Canhão do chão' && troca.inicio.migalha === 'Canhão do chão' && /Canhão do chão/.test(troca.inicio.aba) && /canhão subir/.test(troca.inicio.legenda) && troca.inicio.desenho === 'canhao' && troca.inicio.botao === 'true', troca.inicio)
  ok('o mestre troca a cena no convite (ponte e volta) e o desenho troca junto', troca.ponte.titulo === 'Alavanca da ponte' && troca.ponte.desenho === 'ponte' && troca.ponte.botao === 'false' && troca.canhao.titulo === 'Canhão do chão' && troca.canhao.desenho === 'canhao', { ponte: troca.ponte, canhao: troca.canhao })
  ok('trocar no meio da rodada não troca o que está na tela: vale a partir da próxima rodada', troca.meio.cena === 'canhao' && troca.meio.config === 'ponte' && troca.meio.tela === 'rodada' && troca.meio.rotulo === 'Canhão' && troca.depois.cena === 'ponte' && troca.depois.desenho === 'ponte', { meio: troca.meio, depois: troca.depois })
  ok('no canhão o HUD, o mestre e o resultado falam do canhão (Canhão, Peso do canhão, "O canhão subiu!", desfecho no mapa)', troca.hud.objeto === 'Canhão' && troca.hud.forca === 'Peso do canhão' && troca.hud.aria === 'Canhão erguido' && /canhão está \d+% erguido/.test(troca.hud.canvas) && troca.hud.mestre === 'Canhão' && troca.resultado.titulo === 'O canhão subiu!' && /canhão sobe/.test(troca.resultado.desfecho) && /ameia/.test(troca.resultado.canvas), { hud: troca.hud, resultado: troca.resultado })

  // ---------- 6. movimento reduzido: sem tremor, o cano vai direto para a ameia
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const reduzido = await page.evaluate(() => {
    const A = window.AlavancaDaPonte, J = A.J, S = A.SIM
    J.manual = true; A.escolherCena('canhao'); A.config.jogadores = 1; A.config.dif = 'facil'; J.roboVoce = S.criarMetronomo(9); A.irPara('convite'); A.comecar(); A.rodar(0.85)
    let vibMax = 0, tremorMax = 0
    const canos = new Set()
    for (let k = 0; k < 30 / S.DT && J.tela !== 'resultado'; k++) { A.rodar(S.DT); const e = A.estadoVisual(); vibMax = Math.max(vibMax, e.vib); tremorMax = Math.max(tremorMax, e.tremor); canos.add(e.cano) }
    J.roboVoce = null; A.config.dif = 'normal'
    return { tela: J.tela, vibMax, tremorMax, trauma: J.trauma, canos: [...canos] }
  })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  ok('prefers-reduced-motion: o canhão sobe sem tremor de tela nem corrente vibrando, e o cano vai direto do erguido para a ameia (sem os 4 dentes)', reduzido.tela === 'resultado' && reduzido.vibMax === 0 && reduzido.tremorMax === 0 && reduzido.trauma === 0 && reduzido.canos.every((c) => c === 0 || c === 1), reduzido)

  // ---------- 7. rodada inteira em tempo real no canhão: desempenho e 2 prints
  const rodadaReal = async (largura, altura, prints) => {
    await page.setViewportSize({ width: largura, height: altura })
    await page.evaluate(() => { const A = window.AlavancaDaPonte; A.trocarVisao('jogador'); A.J.manual = false; A.J.roboVoce = null; A.escolherCena('canhao'); A.config.dif = 'normal'; A.config.jogadores = 1; A.irPara('convite'); A.amostras.intervalos.length = 0; A.amostras.trabalho.length = 0; window.__longas.length = 0 })
    const fluxo = page.evaluate((semente) => new Promise((ok) => {
      const A = window.AlavancaDaPonte, J = A.J, t0 = performance.now()
      let k = 0
      while (A.SIM.criarHumano(`${semente}|${k}`).ritmo < 6.8) k++
      const robo = A.SIM.criarHumano(`${semente}|${k}`)
      document.querySelector('#bComecar').click()
      const passo = () => {
        if (J.tela === 'resultado') { const r = J.resultado; return ok({ tipo: r.tipo, tFim: +r.tFim.toFixed(2), giros: r.total, s: +((performance.now() - t0) / 1000).toFixed(1) }) }
        if (performance.now() - t0 > 40000) return ok({ erro: 'tempo esgotado', tela: J.tela })
        if (J.tela === 'rodada') while (J.tela === 'rodada' && robo.decidir(J.P.t)) { dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyX', bubbles: true })); dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyX', bubbles: true })) }
        requestAnimationFrame(passo)
      }
      requestAnimationFrame(passo)
    }), 'tempo-real|1')
    if (prints.rodada) { await page.waitForFunction(() => { const J = window.AlavancaDaPonte.J; return J.tela === 'rodada' && J.P.p > 0.55 }, null, { timeout: 30000 }); await page.screenshot({ path: path.join(PROVAS, prints.rodada) }) }
    if (prints.ameia) { await page.waitForFunction(() => { const J = window.AlavancaDaPonte.J; return J.tela === 'fim' && J.fimTipo === 'baixou' && J.tFase > 0.9 }, null, { timeout: 30000, polling: 'raf' }); await page.screenshot({ path: path.join(PROVAS, prints.ameia) }) }
    const res = await fluxo
    const des = await page.evaluate(() => ({ intervalos: window.AlavancaDaPonte.amostras.intervalos.slice(), trabalho: window.AlavancaDaPonte.amostras.trabalho.slice(), longas: window.__longas.slice() }))
    return { res, desempenho: { largura, quadros: des.intervalos.length, intervaloP50: quant(des.intervalos, 0.5), intervaloP95: quant(des.intervalos, 0.95), trabalhoP95: quant(des.trabalho, 0.95), trabalhoMax: des.trabalho.length ? +Math.max(...des.trabalho).toFixed(1) : null, tarefasLongas: des.longas.map((d) => Math.round(d)) } }
  }
  const r1440 = await rodadaReal(1440, 900, { rodada: 'jogador-1440-subindo.png', ameia: 'jogador-1440-na-ameia.png' })
  const r1024 = await rodadaReal(1024, 768, {})
  R.desempenho = [r1440.desempenho, r1024.desempenho]
  ok('rodada inteira no canhão (Normal) em tempo real, jogada por eventos de teclado (X), vence e chega ao resultado em 1440 e 1024', [r1440, r1024].every((r) => !r.res.erro && r.res.tipo === 'baixou' && r.res.giros > 40), [r1440.res, r1024.res])
  ok(`quadro durante a rodada: p95 do intervalo <= ${META.quadro.p95MaxMs} ms e nenhuma tarefa longa >= ${META.quadro.tarefaLongaMaxMs} ms (1440 e 1024)`, R.desempenho.every((d) => d.quadros > 500 && d.intervaloP95 <= META.quadro.p95MaxMs && !d.tarefasLongas.some((x) => x >= META.quadro.tarefaLongaMaxMs)), R.desempenho)
  await page.evaluate(() => { const A = window.AlavancaDaPonte; A.J.manual = true; A.irPara('convite'); A.trocarVisao('mestre') })
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(PROVAS, 'mestre-1024-cena.png') })

  // ---------- 8. sem rolagem horizontal em 1440 e 1024, com os textos do canhão
  const rolagem = []
  for (const [w, h] of [[1440, 900], [1024, 768]]) {
    await page.setViewportSize({ width: w, height: h })
    for (const tela of ['convite', 'rodada', 'resultado', 'mestre']) {
      await page.evaluate((tela) => {
        const A = window.AlavancaDaPonte, J = A.J
        J.manual = true; A.trocarVisao(tela === 'mestre' ? 'mestre' : 'jogador')
        if (tela === 'mestre') return
        A.irPara('convite'); if (tela === 'convite') return
        J.roboVoce = A.SIM.criarHumano('layout'); A.comecar(); A.rodar(3)
        if (tela === 'resultado') A.rodar(30)
        J.roboVoce = null
      }, tela)
      await page.waitForTimeout(80)
      rolagem.push({ largura: w, tela, ...(await page.evaluate(() => { const els = [document.documentElement, ...document.querySelectorAll('.tela, .mestre, .coluna, .painel, .ficha, .equipe, .numeros, .vagas, .seg')].filter((e) => e.offsetParent !== null || e === document.documentElement); const pior = els.find((e) => e.scrollWidth > e.clientWidth + 1); return { ok: !pior, onde: pior ? (pior.id || pior.className) : null } })) })
    }
  }
  ok('sem rolagem horizontal em 1440 e 1024 com os textos do canhão (convite, rodada, resultado, mestre)', rolagem.every((r) => r.ok), rolagem.filter((r) => !r.ok))
  await page.setViewportSize({ width: 1440, height: 900 })

  // ---------- 9. folha de contato: o mesmo desenho do jogo, quadro a quadro
  const folha = await page.evaluate(() => {
    const A = window.AlavancaDaPonte, J = A.J, S = A.SIM, cfg = A.config
    A.trocarVisao('jogador'); J.manual = true; A.escolherCena('canhao'); cfg.jogadores = 1; cfg.dif = 'normal'; cfg.tempo = null
    const fw = 512, fh = 288, quadros = []
    const cap = (rotulo) => {
      const c = document.createElement('canvas'); c.width = fw; c.height = fh
      const e = A.estadoVisual()
      A.desenharCena(c.getContext('2d'), fw, fh, e)
      const P = J.P
      const t = !P ? 'antes da rodada' : J.tela === 'contagem' ? `contagem ${J.tFase.toFixed(2).replace('.', ',')} s` : J.tela === 'fim' ? `fim + ${(J.tFase + 0.07 - Math.max(0, J.congela)).toFixed(2).replace('.', ',')} s` : `t = ${P.t.toFixed(2).replace('.', ',')} s`
      const d = P ? `canhão ${Math.round(e.p * 100)}% · peso ${Math.round((P.forca / S.forcaMax(P.R)) * 100)}%${P.solta > 0 && J.tela === 'rodada' ? ' · solta' : ''}${e.cano < 1 ? ` · cano ${Math.round(e.cano * 100)}%` : ''}` : 'canhão 0%'
      quadros.push({ c, rotulo, t, d })
    }
    const robo = S.criarHumano('folha|3')
    J.roboVoce = robo
    const ate = (cond, max = 30) => { for (let k = 0; k < max / S.DT && !cond(); k++) A.rodar(S.DT) }
    A.irPara('convite'); cap('Convite: o alçapão fechado nas lajes')
    A.comecar(); A.rodar(0.3); cap('Contagem: "Prontos…"')
    ate(() => J.tela === 'rodada'); ate(() => J.P.p >= 0.07); cap('Os primeiros giros: as folhas se erguem')
    ate(() => J.P.p >= 0.2); A.rodar(S.DT * 2); cap('As folhas batem abertas nas lajes')
    ate(() => J.P.p >= 0.36); cap('A boca do canhão aparece no poço')
    robo.prox = J.P.t + 1.25
    ate(() => J.P.solta > 0.4); cap('Mão parada: a catraca soltou')
    ate(() => J.P.solta >= 1 && J.P.vel < -0.15, 2); A.rodar(0.12); cap('O peso puxa a plataforma de volta')
    ate(() => J.P.solta === 0); A.rodar(0.1); cap('Voltou a girar: a lingueta pega')
    ate(() => J.P.p >= 0.86); cap('Reta final: o reparo sai do poço')
    ate(() => J.tela === 'fim'); cap('Topo: os ferrolhos entram (clangor)')
    A.rodar(0.2); cap('O cano baixa dente a dente')
    A.rodar(1.0); cap('Travado, apontado pela ameia')
    cfg.dif = 'dificil'; J.roboVoce = S.criarMetronomo(4.5); A.irPara('convite'); A.comecar(); A.rodar(0.8)
    ate(() => J.P.t >= J.P.R.tempo - 0.9); cap('Difícil, 4,5/s: últimos segundos, o canhão empaca')
    ate(() => J.tela === 'fim'); A.rodar(0.35); cap('Tempo esgotado: o canhão despenca no poço')
    ate(() => J.bateu === true, 2); A.rodar(0.12); cap('Bate no fundo; o alçapão fecha')
    J.roboVoce = null; cfg.dif = 'normal'; A.irPara('convite')
    const col = 4, linhas = Math.ceil(quadros.length / col), rod = 46
    const f = document.createElement('canvas'); f.width = col * (fw + 14) + 14; f.height = 46 + linhas * (fh + rod + 8)
    const g = f.getContext('2d')
    g.fillStyle = '#121214'; g.fillRect(0, 0, f.width, f.height)
    g.fillStyle = '#eceae4'; g.font = '600 16px Segoe UI, sans-serif'
    g.fillText(`Canhão do chão: ${quadros.length} quadros (Normal: convite, folhas, poço, catraca solta e volta, reta final, trava, cano na ameia; Difícil: derrota). Embaixo: o que acontece, o tempo, o canhão e o peso.`, 14, 28)
    quadros.forEach((q, i) => {
      const x = 14 + (i % col) * (fw + 14), y = 42 + Math.floor(i / col) * (fh + rod + 8)
      g.drawImage(q.c, x, y)
      g.fillStyle = '#eceae4'; g.font = '600 13px Segoe UI, sans-serif'; g.fillText(`${i + 1}. ${q.rotulo}`, x, y + fh + 17)
      g.fillStyle = '#e0a44a'; g.font = '13px Segoe UI, sans-serif'; g.fillText(q.t, x, y + fh + 35)
      g.fillStyle = '#a2a09a'; g.fillText(q.d, x + 150, y + fh + 35)
    })
    return { png: f.toDataURL('image/png'), quadros: quadros.length, rotulos: quadros.map((q) => q.rotulo + ' | ' + q.t + ' | ' + q.d) }
  })
  salvarPng('folha-contato.png', folha.png)
  R.folha = { quadros: folha.quadros, rotulos: folha.rotulos }
  ok(`folha de contato com ${META.folhaDeContato.min} a ${META.folhaDeContato.max} quadros, com a catraca solta, a trava, o cano baixando e a derrota`, folha.quadros >= META.folhaDeContato.min && folha.quadros <= META.folhaDeContato.max && folha.rotulos.some((r) => / solta$/.test(r)) && folha.rotulos.some((r) => /cano \d+%/.test(r)) && folha.rotulos.some((r) => /fundo/.test(r)), R.folha)

  // ---------- 10. som: a vitória no Normal e a derrota no Difícil, renderizadas offline nas duas cenas
  const rodadas = await page.evaluate(() => {
    const S = window.AlavancaDaPonte.SIM, pegar = (r) => ({ fase: r.fase, tFim: r.tFim, eventos: r.eventos, trilha: r.trilha, R: r.R })
    let perde = null
    for (let i = 0; i < 50 && !perde; i++) { const r = S.simular({ dif: 'dificil', jogadores: 1 }, `grafico|perde|${i}`, { som: true }); if (!r.venceu) perde = pegar(r) }
    return { vence: pegar(S.simular({ dif: 'normal', jogadores: 1 }, 'grafico|1', { som: true })), perde }
  })
  const sons = []
  for (const [chave, nome] of [['vence', 'canhao-normal-vence'], ['perde', 'canhao-dificil-perde']]) {
    const res = rodadas[chave]
    const b64 = await page.evaluate(async (res) => {
      const para = (f) => { const u = new Uint8Array(f.buffer, f.byteOffset, f.byteLength); let s = ''; for (let k = 0; k < u.length; k += 0x8000) s += String.fromCharCode.apply(null, u.subarray(k, k + 0x8000)); return btoa(s) }
      const c = await window.AlavancaDaPonte.SOM.renderizar(res, OfflineAudioContext, 48000, 'canhao')
      const p = await window.AlavancaDaPonte.SOM.renderizar(res, OfflineAudioContext, 48000, 'ponte')
      return { e: para(c.canais[0]), d: para(c.canais[1]), pe: para(p.canais[0]), pd: para(p.canais[1]), inicio: c.inicio }
    }, res)
    const canal = (s) => { const b = Buffer.from(s, 'base64'); return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)) }
    const canais = [canal(b64.e), canal(b64.d)], ponte = [canal(b64.pe), canal(b64.pd)]
    fs.writeFileSync(path.join(SOM_DIR, `${nome}.wav`), medidas.wav16(canais, 48000))
    const m = medidas.medirTudo(canais, 48000)
    const ec = medidas.envoltoria(canais, 48000, 0.1).rms, ep = medidas.envoltoria(ponte, 48000, 0.1).rms
    let dif = 0
    for (let i = 0; i < Math.min(ec.length, ep.length); i++) if (Number.isFinite(ec[i]) && Number.isFinite(ep[i]) && ec[i] > -50) dif = Math.max(dif, Math.abs(ec[i] - ep[i]))
    sons.push({ nome, inicio: b64.inicio, medidas: m, diferencaDaPonteDb: +dif.toFixed(1) })
  }
  fs.writeFileSync(path.join(SOM_DIR, 'medidas.json'), JSON.stringify(Object.fromEntries(sons.map((s) => [s.nome, { ...s.medidas, diferencaDaPonteDb: s.diferencaDaPonteDb }])), null, 2) + '\n')
  R.som = sons.map((s) => ({ arquivo: `som/${s.nome}.wav`, lufsIntegrado: s.medidas.lufsIntegrado, picoVerdadeiroDbtp: s.medidas.picoVerdadeiroDbtp, cortes: s.medidas.cortes, cliques: s.medidas.cliques.length, dcPct: s.medidas.dcPct, diferencaDaPonteDb: s.diferencaDaPonteDb }))
  const MS = META.som
  ok(`som do canhão: pico verdadeiro <= ${MS.picoVerdadeiroMaxDbtp} dBTP, nenhum corte, nenhum clique fora de ataque, DC < 0,5%`, sons.every((s) => s.medidas.picoVerdadeiroDbtp <= MS.picoVerdadeiroMaxDbtp && s.medidas.cortes === 0 && s.medidas.cliques.length === 0 && Math.abs(s.medidas.dcPct) < 0.5), R.som)
  ok(`som do canhão: volume dentro de ${MS.luDoTiroMax} LU do tiro (${MS.lufsDoTiro} LUFS)`, sons.every((s) => Math.abs(s.medidas.lufsIntegrado - MS.lufsDoTiro) <= MS.luDoTiroMax), R.som.map((s) => ({ arquivo: s.arquivo, lufs: s.lufsIntegrado })))
  ok(`o som do canhão é outro, não o da ponte: a mesma rodada difere em pelo menos ${MS.diferencaDaPonteMinDb} dB em algum trecho de 0,1 s`, sons.every((s) => s.diferencaDaPonteDb >= MS.diferencaDaPonteMinDb), R.som.map((s) => ({ arquivo: s.arquivo, diferencaDaPonteDb: s.diferencaDaPonteDb })))

  R.errosNoConsole = erros
  ok('nenhum erro no console da página', erros.length === 0, erros.slice(0, 5))
  const passou = R.testes.filter((t) => t.passou).length
  R.resumo = `${passou} de ${R.testes.length}`
  fs.writeFileSync(path.join(PROVAS, 'testes.json'), JSON.stringify(R, null, 2) + '\n')
  console.log(`\n${R.resumo} testes passaram`)
  await navegador.close()
  process.exitCode = passou === R.testes.length ? 0 : 1
}

main().catch((e) => { console.error(e); process.exit(1) })
