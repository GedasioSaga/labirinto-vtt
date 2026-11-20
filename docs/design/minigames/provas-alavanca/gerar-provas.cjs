'use strict'
/**
 * Provas do protótipo da Alavanca da ponte (não é código do app).
 *
 *   node docs/design/minigames/provas-alavanca/gerar-provas.cjs
 *
 * Abre ../alavanca-da-ponte.html no Edge (Playwright do repo, sem janela) e grava
 * aqui: testes.json, 3 prints (1440 e 1024), a folha de contato, o gráfico do
 * movimento (com a envoltória do som na mesma linha do tempo) e os .wav em som/.
 *
 * Metas (escritas antes de codar, em metas.json; não mudam): robô que joga como
 * gente, 400 partidas por caso. Fácil 1 jogador >= 90%; Normal 1 jogador entre
 * 65% e 80%; Difícil 1 jogador entre 25% e 45%; Normal 3 jogadores >= 90%. Um
 * robô que aperta 4 X por segundo perde no Normal.
 */
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require('playwright')
const medidas = require('../../../../scripts/som/medidas.cjs')

const PROVAS = __dirname
const PAGINA = path.join(PROVAS, '..', 'alavanca-da-ponte.html')
const SOM_DIR = path.join(PROVAS, 'som')
const META = JSON.parse(fs.readFileSync(path.join(PROVAS, 'metas.json'), 'utf8'))
const N = META.roboHumano.rodadasPorCaso
const LUFS_TIRO = -19.29 // rodada do tiro, docs/design/minigame-tiro/provas/som/medidas.json
const pct = (v) => Math.round(v * 1000) / 10
const salvarPng = (nome, dataUrl) => fs.writeFileSync(path.join(PROVAS, nome), Buffer.from(dataUrl.split(',')[1], 'base64'))
const quant = (arr, q) => { const s = [...arr].sort((a, b) => a - b); return s.length ? +s[Math.min(s.length - 1, Math.floor(q * s.length))].toFixed(1) : null }

async function main() {
  fs.mkdirSync(SOM_DIR, { recursive: true })
  const navegador = await chromium.launch({ channel: 'msedge', args: ['--autoplay-policy=no-user-gesture-required'] }).catch(() => chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }))
  const ctx = await navegador.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  await ctx.addInitScript(() => {
    window.__pad = { index: 0, id: 'Controle de teste', buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] }
    navigator.getGamepads = () => [window.__pad]
    window.__longas = []
    try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__longas.push(e.duration))).observe({ type: 'longtask', buffered: true }) } catch {}
  })
  const page = await ctx.newPage()
  const erros = []
  page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()) })
  page.on('pageerror', (e) => erros.push(String(e)))
  await page.goto('file:///' + PAGINA.replace(/\\/g, '/'))
  await page.waitForFunction(() => window.AlavancaDaPonte)
  const R = { metas: META, testes: [] }
  const ok = (nome, passou, detalhe) => { R.testes.push({ nome, passou: !!passou, detalhe }); console.log(`${passou ? 'PASSOU' : 'FALHOU'}  ${nome}${detalhe ? '  — ' + JSON.stringify(detalhe) : ''}`) }

  // ---------- 1. simulação pura: semente, robô humano, metrônomo, reação
  const puras = await page.evaluate((N) => {
    const S = window.AlavancaDaPonte.SIM, igual = (a, b) => JSON.stringify(a) === JSON.stringify(b)
    const mesma = igual(S.simular({ dif: 'normal', jogadores: 1 }, 'semente-a').amostras, S.simular({ dif: 'normal', jogadores: 1 }, 'semente-a').amostras)
    const outra = !igual(S.simular({ dif: 'normal', jogadores: 1 }, 'semente-a').amostras, S.simular({ dif: 'normal', jogadores: 1 }, 'semente-b').amostras)
    const casos = {}, reacoes = []
    for (const [dif, n] of [['facil', 1], ['normal', 1], ['dificil', 1], ['normal', 3]]) {
      let v = 0, giros = 0
      const t = []
      for (let i = 0; i < N; i++) {
        const r = S.simular({ dif, jogadores: n }, `robo|${dif}|${n}|${i}`, { leve: true })
        if (r.venceu) { v++; t.push(r.tFim) }
        giros += r.giros.reduce((a, b) => a + b, 0) / r.tFim / n
        if (n === 1) reacoes.push(...r.reacoes)
      }
      t.sort((a, b) => a - b)
      casos[`${dif}_${n}`] = { vitoria: v / N, tempo: S.regras({ dif, jogadores: n }).tempo, tempoDaVitoriaP50: t.length ? +t[Math.floor(t.length / 2)].toFixed(1) : null, girosPorSegundoPorJogador: +(giros / N).toFixed(2) }
    }
    const metro = S.simular({ dif: 'normal', jogadores: 1 }, 'metronomo', { robos: [S.criarMetronomo(4)] })
    const minimo = {}
    for (const dif of ['facil', 'normal', 'dificil']) {
      let lo = 2, hi = 12
      for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (S.simular({ dif, jogadores: 1 }, 'x', { leve: true, robos: [S.criarMetronomo(m)] }).venceu) hi = m; else lo = m }
      minimo[dif] = +hi.toFixed(2)
    }
    const media = reacoes.reduce((a, b) => a + b, 0) / reacoes.length
    const dp = Math.sqrt(reacoes.reduce((a, b) => a + (b - media) ** 2, 0) / reacoes.length)
    return { mesma, outra, casos, metro: { venceu: metro.venceu, pMax: +metro.pMax.toFixed(3), fase: metro.fase }, minimo, reacao: { n: reacoes.length, min: +Math.min(...reacoes).toFixed(3), media: +media.toFixed(3), dp: +dp.toFixed(3) }, DIF: S.DIF }
  }, N)
  R.robo = puras.casos
  R.ritmoMinimoParaVencer = puras.minimo
  ok('mesma semente = mesma partida; outra semente = outra partida', puras.mesma && puras.outra)
  const c = puras.casos, V = META.vitoria
  ok(`robô humano, Fácil, 1 jogador: vitória >= ${pct(V.facil_1.min)}% (${N} partidas)`, c.facil_1.vitoria >= V.facil_1.min, { vitoria: pct(c.facil_1.vitoria) + '%', ...c.facil_1 })
  ok(`robô humano, Normal, 1 jogador: vitória entre ${pct(V.normal_1.min)}% e ${pct(V.normal_1.max)}%`, c.normal_1.vitoria >= V.normal_1.min && c.normal_1.vitoria <= V.normal_1.max, { vitoria: pct(c.normal_1.vitoria) + '%', ...c.normal_1 })
  ok(`robô humano, Difícil, 1 jogador: vitória entre ${pct(V.dificil_1.min)}% e ${pct(V.dificil_1.max)}%`, c.dificil_1.vitoria >= V.dificil_1.min && c.dificil_1.vitoria <= V.dificil_1.max, { vitoria: pct(c.dificil_1.vitoria) + '%', ...c.dificil_1 })
  ok(`robô humano, Normal, 3 jogadores: vitória >= ${pct(V.normal_3.min)}%`, c.normal_3.vitoria >= V.normal_3.min, { vitoria: pct(c.normal_3.vitoria) + '%', ...c.normal_3 })
  ok('robô que aperta 4 X por segundo perde no Normal (a ponte empaca antes do chão)', !puras.metro.venceu && puras.metro.pMax < 0.95, { ...puras.metro, ritmoMinimoParaVencer: puras.minimo })
  ok('robô nunca reage em zero: reação mínima >= 130 ms, média 250 ± 20 ms, desvio 60 ± 15 ms', puras.reacao.min >= 0.13 && Math.abs(puras.reacao.media - 0.25) <= 0.02 && Math.abs(puras.reacao.dp - 0.06) <= 0.015, puras.reacao)
  const D = puras.DIF
  ok('Difícil pede mais que o Normal, que pede mais que o Fácil (ritmo mínimo para vencer sobe)', puras.minimo.facil < puras.minimo.normal && puras.minimo.normal < puras.minimo.dificil && D.dificil.folga < D.normal.folga && D.normal.folga < D.facil.folga, puras.minimo)

  // ---------- 2. gráfico do movimento: amostras a cada 0,1 s viram teste
  const graf = await page.evaluate(() => {
    const S = window.AlavancaDaPonte.SIM
    const casos = [
      { titulo: 'Normal, 1 jogador, robô humano (semente "grafico|1")', cfg: { dif: 'normal', jogadores: 1 }, semente: 'grafico|1' },
      { titulo: 'Difícil, 1 jogador, robô humano (semente "grafico|perde")', cfg: { dif: 'dificil', jogadores: 1 }, semente: 'grafico|perde' },
      { titulo: 'Normal, robô metrônomo de 4 X por segundo', cfg: { dif: 'normal', jogadores: 1 }, semente: 'metro', metro: 4 },
    ]
    return casos.map((k) => {
      const r = S.simular(k.cfg, k.semente, { som: true, robos: k.metro ? [S.criarMetronomo(k.metro)] : undefined })
      return { titulo: k.titulo, cfg: k.cfg, venceu: r.venceu, fase: r.fase, tFim: r.tFim, R: r.R, amostras: r.amostras, giros: r.eventos.filter((e) => e.nome === 'giro').map((e) => +e.t.toFixed(3)), soltou: r.eventos.filter((e) => e.nome === 'soltou').map((e) => +e.t.toFixed(3)), trilha: r.trilha, eventos: r.eventos, ritmo: r.ritmos[0] }
    })
  })
  // achar uma semente do Difícil que perde, para o gráfico mostrar os dois desfechos
  if (graf[1].venceu) {
    const outra = await page.evaluate(() => {
      const S = window.AlavancaDaPonte.SIM
      for (let i = 0; i < 50; i++) { const r = S.simular({ dif: 'dificil', jogadores: 1 }, `grafico|perde|${i}`, { som: true }); if (!r.venceu) return { semente: `grafico|perde|${i}`, r } }
      return null
    })
    if (outra) { const r = outra.r; graf[1] = { ...graf[1], titulo: `Difícil, 1 jogador, robô humano (semente "${outra.semente}")`, venceu: r.venceu, fase: r.fase, tFim: r.tFim, amostras: r.amostras, giros: r.eventos.filter((e) => e.nome === 'giro').map((e) => +e.t.toFixed(3)), soltou: r.eventos.filter((e) => e.nome === 'soltou').map((e) => +e.t.toFixed(3)), trilha: r.trilha, eventos: r.eventos, ritmo: r.ritmos[0] } }
  }
  const props = graf.map((g) => {
    const am = g.amostras, Rr = g.R, falhas = []
    let maxSalto = 0
    for (let i = 0; i < am.length; i++) {
      const [t, p, forca, solta] = am[i]
      if (p < 0 || p > 1) falhas.push(`p fora de 0..1 em ${t}`)
      const esperada = Rr.puxaBase + Rr.puxaFundo * p + Rr.solta * solta
      if (Math.abs(esperada - forca) > 2e-3) falhas.push(`força ${forca} diferente de base + fundo·p + solta (${esperada.toFixed(4)}) em ${t}`)
      if (solta > 0 && g.giros.some((tg) => tg > t - Rr.folga + 1e-6 && tg <= t + 1e-6)) falhas.push(`catraca solta com giro há menos de ${Rr.folga} s em ${t}`)
      if (i === 0) continue
      const [t0, p0] = am[i - 1]
      if (i < am.length - 1 && Math.abs(t - t0 - 0.1) > 1e-6) falhas.push(`amostra fora do passo de 0,1 s em ${t}`)
      maxSalto = Math.max(maxSalto, Math.abs(p - p0))
      const girouPerto = g.giros.some((tg) => tg > t0 - 0.35 && tg <= t + 1e-6)
      if (p > p0 + 1e-6 && !girouPerto) falhas.push(`ponte desceu sem giro em ${t}`)
    }
    const ult = am[am.length - 1]
    const fimCerto = g.venceu ? ult[1] === 1 && g.tFim <= Rr.tempo + 1e-6 : Math.abs(g.tFim - Rr.tempo) < 0.01 && ult[1] < 1
    return { caso: g.titulo, venceu: g.venceu, tFim: +g.tFim.toFixed(2), amostras: am.length, maxSaltoPor01s: +maxSalto.toFixed(3), falhas: falhas.slice(0, 4), fimCerto, soltou: g.soltou.length, pMax: Math.max(...am.map((a) => a[1])) }
  })
  ok('gráfico do movimento: amostras a cada 0,1 s; ponte entre 0 e 1 e só desce com giro nos últimos 0,35 s; força = base + fundo·ponte + catraca solta; catraca só solta depois da folga sem giro; sem salto (<= 0,12 por 0,1 s); fim no tempo certo', props.every((p) => !p.falhas.length && p.maxSaltoPor01s <= 0.12 && p.fimCerto && p.amostras >= Math.floor(p.tFim * 10)), props)
  ok('o gráfico tem os dois desfechos: o Normal vence, o Difícil perde e o metrônomo de 4/s empaca abaixo de 95%', props[0].venceu && !props[1].venceu && !props[2].venceu && props[2].pMax < 0.95, props.map((p) => ({ caso: p.caso, venceu: p.venceu, pMax: p.pMax })))

  // ---------- 3. entrada: teclado (X, repetição, outras teclas), botão, controle, pausa
  const entrada = await page.evaluate(async () => {
    const A = window.AlavancaDaPonte, J = A.J, cfg = A.config, quadro = () => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)))
    const tecla = (code, extra = {}) => { dispatchEvent(new KeyboardEvent('keydown', Object.assign({ code, bubbles: true, cancelable: true }, extra))); dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true })) }
    const giros = () => J.P.giros.reduce((a, b) => a + b, 0)
    J.manual = true; J.roboVoce = null; cfg.jogadores = 1; cfg.dif = 'normal'; cfg.tempo = null
    const out = {}
    A.irPara('convite'); tecla('KeyX'); out.xNoConviteNaoComeca = J.tela === 'convite'
    A.comecar(); tecla('KeyX'); A.rodar(0.2); out.xNaContagemIgnorado = J.tela === 'contagem' && J.fila.length === 0
    A.rodar(1.0)
    tecla('KeyX'); A.rodar(1 / 60); out.umX = giros()
    tecla('KeyX', { repeat: true }); tecla('KeyX', { repeat: true }); A.rodar(1 / 60); out.segurarNaoConta = giros()
    tecla('KeyM'); A.rodar(1 / 60); out.mSemJogador2 = giros()
    document.querySelector('#bGirar').dispatchEvent(new PointerEvent('pointerdown', { pointerId: 3, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, button: 0 })); A.rodar(1 / 60); out.botaoToque = giros()
    window.__pad.buttons[2] = { pressed: true, value: 1 }; await quadro(); window.__pad.buttons[2] = { pressed: false, value: 0 }; await quadro(); A.rodar(1 / 60); out.controleX = giros()
    out.touchAction = getComputedStyle(document.querySelector('#bGirar')).touchAction
    tecla('Escape'); const t0 = J.P.t; A.rodar(0.5); out.escPausa = J.pausado && J.P.t === t0 && !document.querySelector('#pausa').hidden
    tecla('KeyX'); out.xPausadoIgnorado = J.fila.length === 0
    tecla('Escape'); A.rodar(0.1); out.escVolta = !J.pausado && J.P.t > t0
    // 2 jogadores na mesma máquina: M gira pelo jogador 2
    cfg.jogadores = 2; cfg.modos[1] = 'tecla'; A.irPara('convite'); A.comecar(); A.rodar(1.0)
    tecla('KeyX'); tecla('KeyM'); A.rodar(1 / 60); out.doisJogadores = J.P.giros.slice()
    cfg.jogadores = 1; cfg.modos[1] = 'bot'; A.irPara('convite')
    return out
  })
  ok('teclado: X no convite e na contagem não gira; cada X gira uma vez; segurar o X (repetição) não gira; M sem jogador 2 não gira', entrada.xNoConviteNaoComeca && entrada.xNaContagemIgnorado && entrada.umX === 1 && entrada.segurarNaoConta === 1 && entrada.mSemJogador2 === 1, entrada)
  ok('toque e controle: o botão Girar gira no toque (touch-action manipulation) e o X do controle gira', entrada.botaoToque === 2 && entrada.controleX === 3 && entrada.touchAction === 'manipulation', { botaoToque: entrada.botaoToque, controleX: entrada.controleX, touchAction: entrada.touchAction })
  ok('Esc pausa (o tempo para e X não conta) e Esc continua; com 2 jogadores, X e M giram cada um o seu', entrada.escPausa && entrada.xPausadoIgnorado && entrada.escVolta && entrada.doisJogadores[0] === 1 && entrada.doisJogadores[1] === 1, { escPausa: entrada.escPausa, xPausadoIgnorado: entrada.xPausadoIgnorado, escVolta: entrada.escVolta, doisJogadores: entrada.doisJogadores })

  // ---------- 4. movimento reduzido: sem tremor no pouso
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const reduzido = await page.evaluate(() => {
    const A = window.AlavancaDaPonte, J = A.J
    J.manual = true; A.config.jogadores = 1; A.config.dif = 'facil'; J.roboVoce = A.SIM.criarMetronomo(9); A.irPara('convite'); A.comecar(); A.rodar(0.85)
    const cena0 = J.tCena
    let vibMax = 0
    for (let k = 0; k < 30 / A.SIM.DT && J.tela === 'rodada'; k++) { A.rodar(A.SIM.DT); vibMax = Math.max(vibMax, A.estadoVisual().vib) }
    const tela = J.tela, tremor = A.estadoVisual().tremor
    J.roboVoce = null; A.config.dif = 'normal'
    return { tela, tremor, vibMax, trauma: J.trauma, ambienteParado: J.tCena === cena0 }
  })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  ok('prefers-reduced-motion: a ponte desce sem tremor de tela, sem a corrente vibrar e com água e tocha paradas', reduzido.tela === 'fim' && reduzido.tremor === 0 && reduzido.trauma === 0 && reduzido.vibMax === 0 && reduzido.ambienteParado, reduzido)

  // ---------- 5. mestre: dificuldade, tempo, jogadores e bots, desfecho, chance, pausar e encerrar
  const mestre = await page.evaluate(async () => {
    const A = window.AlavancaDaPonte, J = A.J, cfg = A.config, $ = (s) => document.querySelector(s), esperar = (ms) => new Promise((ok) => setTimeout(ok, ms))
    const mudar = (sel, v, ev = 'input') => { const el = $(sel); el.value = v; el.dispatchEvent(new Event(ev)) }
    J.manual = true; A.irPara('convite'); A.trocarVisao('mestre')
    const out = {}
    $('[data-dif="dificil"]').click(); out.dificil = { conviteDif: $('#cDif').textContent, conviteTempo: $('#cTempo').textContent, slider: $('#mTempo').value }
    mudar('#mTempo', '24'); out.tempo = { config: cfg.tempo, convite: $('#cTempo').textContent, padraoLigado: !$('#mTempoPadrao').disabled }
    $('#mTempoPadrao').click(); out.tempo.voltou = $('#cTempo').textContent
    $('[data-dif="normal"]').click()
    await esperar(400); out.chance = $('#mChance').textContent
    out.chanceEsperada = Math.round(A.SIM.estimar({ dif: 'normal', jogadores: 1, tempo: null }, 200, 'mestre') * 100) + '%'
    $('[data-n="3"]').click(); out.vagas = document.querySelectorAll('#mVagas li').length; out.equipeConvite = $('#cEquipe').textContent
    const r2 = document.querySelector('#mVagas li [data-modo="tecla"]'); r2.click(); out.teclaNoConvite = [...document.querySelectorAll('#cTeclas li')].some((li) => /M/.test(li.textContent)); document.querySelector('#mVagas li [data-modo="bot"]').click()
    document.querySelector('input[name="desfecho"][value="porta"]').click(); document.querySelector('input[name="desfecho"][value="porta"]').dispatchEvent(new Event('change'))
    out.portaLigada = !$('#mPorta').disabled
    mudar('#mPorta', 'Porta da Capela'); out.desfechoConvite = $('#cDesfecho').textContent
    // rodada com 3 (você + 2 bots): os bots giram, o mestre pausa e encerra
    A.trocarVisao('jogador'); A.irPara('convite'); A.comecar(); A.rodar(0.8 + 3)
    out.equipeRodada = document.querySelectorAll('#rEquipe li').length; out.girosBots = J.P.giros.slice(1)
    A.trocarVisao('mestre'); $('#bPausaTodos').click(); const t0 = J.P.t; A.rodar(0.5)
    out.pausa = { parado: J.P.t === t0, overlay: !$('#pausa').hidden, continuarDesligado: $('#bContinuar').disabled, botao: $('#bPausaTodos').textContent }
    $('#bPausaTodos').click(); A.rodar(0.2); out.pausa.voltou = J.P.t > t0
    $('#bEncerrar').click(); out.encerrou = { tela: J.tela, titulo: $('#resTitulo').textContent, desfecho: $('#resDesfecho').textContent }
    // vitória com desfecho de porta: o resultado diz qual porta abre
    cfg.jogadores = 1; cfg.dif = 'facil'; J.roboVoce = A.SIM.criarMetronomo(9); A.trocarVisao('jogador'); A.irPara('convite'); A.comecar(); A.rodar(0.8)
    for (let k = 0; k < 30 / A.SIM.DT && J.tela !== 'resultado'; k++) A.rodar(A.SIM.DT)
    out.vitoria = { tela: J.tela, titulo: $('#resTitulo').textContent, desfecho: $('#resDesfecho').textContent }
    J.roboVoce = null; cfg.dif = 'normal'; cfg.desfecho = 'ponte'; document.querySelector('input[name="desfecho"][value="ponte"]').checked = true; cfg.porta = 'Portão de Valverde'; $('#mPorta').value = cfg.porta
    $('[data-n="1"]').click(); A.aoMudarConfig(false)
    return out
  })
  ok('mestre: Difícil muda o convite (15 s); o tempo vai para 24 s e "Padrão" volta; a chance estimada é a da simulação', mestre.dificil.conviteDif === 'Difícil' && mestre.dificil.conviteTempo === '15 s' && mestre.tempo.config === 24 && mestre.tempo.convite === '24 s' && mestre.tempo.padraoLigado && mestre.tempo.voltou === '15 s' && mestre.chance === mestre.chanceEsperada, { dificil: mestre.dificil, tempo: mestre.tempo, chance: mestre.chance, esperada: mestre.chanceEsperada })
  ok('mestre: 3 jogadores abrem 2 vagas (bot ou tecla M/Q); na rodada os 2 bots giram de verdade', mestre.vagas === 2 && /Bia/.test(mestre.equipeConvite) && mestre.teclaNoConvite && mestre.equipeRodada === 3 && mestre.girosBots.every((g) => g > 8), { vagas: mestre.vagas, equipeConvite: mestre.equipeConvite, teclaNoConvite: mestre.teclaNoConvite, equipeRodada: mestre.equipeRodada, girosBots: mestre.girosBots })
  ok('mestre: pausar para todos para o tempo e trava o "Continuar" do jogador; continuar volta; encerrar leva ao resultado', mestre.pausa.parado && mestre.pausa.overlay && mestre.pausa.continuarDesligado && mestre.pausa.voltou && mestre.encerrou.tela === 'resultado' && /Encerrada/.test(mestre.encerrou.titulo), { pausa: mestre.pausa, encerrou: mestre.encerrou })
  ok('mestre: desfecho "abrir uma porta" com nome aparece no convite e no resultado da vitória', mestre.portaLigada && /Porta da Capela/.test(mestre.desfechoConvite) && mestre.vitoria.tela === 'resultado' && mestre.vitoria.titulo === 'A ponte desceu!' && /Porta da Capela/.test(mestre.vitoria.desfecho), { desfechoConvite: mestre.desfechoConvite, vitoria: mestre.vitoria })

  // ---------- 6. rodada inteira em tempo real (Normal): o robô humano aperta X por evento de teclado
  const rodadaReal = async (largura, altura, prints) => {
    await page.setViewportSize({ width: largura, height: altura })
    await page.evaluate(() => { const A = window.AlavancaDaPonte; A.trocarVisao('jogador'); A.J.manual = false; A.J.roboVoce = null; A.config.dif = 'normal'; A.config.jogadores = 1; A.irPara('convite'); A.amostras.intervalos.length = 0; A.amostras.trabalho.length = 0; window.__longas.length = 0 })
    const fluxo = page.evaluate((semente) => new Promise((ok) => {
      // um robô humano de ritmo bom (>= 6,8/s), para o print do resultado mostrar a vitória
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
    if (prints.rodada) { await page.waitForFunction(() => { const J = window.AlavancaDaPonte.J; return J.tela === 'rodada' && J.P.p > 0.45 }, null, { timeout: 30000 }); await page.screenshot({ path: path.join(PROVAS, prints.rodada) }) }
    const res = await fluxo
    const des = await page.evaluate(() => ({ intervalos: window.AlavancaDaPonte.amostras.intervalos.slice(), trabalho: window.AlavancaDaPonte.amostras.trabalho.slice(), longas: window.__longas.slice() }))
    if (prints.resultado) { await page.waitForTimeout(300); await page.screenshot({ path: path.join(PROVAS, prints.resultado) }) }
    return { res, desempenho: { largura, quadros: des.intervalos.length, intervaloP50: quant(des.intervalos, 0.5), intervaloP95: quant(des.intervalos, 0.95), trabalhoP95: quant(des.trabalho, 0.95), trabalhoMax: des.trabalho.length ? +Math.max(...des.trabalho).toFixed(1) : null, tarefasLongas: des.longas.map((d) => Math.round(d)) } }
  }
  const r1440 = await rodadaReal(1440, 900, { rodada: 'jogador-1440-rodada.png' })
  const r1024 = await rodadaReal(1024, 768, { resultado: 'resultado-1024.png' })
  R.desempenho = [r1440.desempenho, r1024.desempenho]
  ok('rodada inteira no Normal em tempo real, jogada por eventos de teclado (X), chega ao resultado em 1440 e 1024', [r1440, r1024].every((r) => !r.res.erro && r.res.giros > 40), [r1440.res, r1024.res])
  ok('quadro durante a rodada: p95 do intervalo <= 20 ms e nenhuma tarefa longa >= 200 ms (1440 e 1024)', R.desempenho.every((d) => d.quadros > 500 && d.intervaloP95 <= META.quadro.p95MaxMs && !d.tarefasLongas.some((x) => x >= META.quadro.tarefaLongaMaxMs)), R.desempenho)
  await page.evaluate(() => { const A = window.AlavancaDaPonte; A.J.manual = true; A.trocarVisao('mestre') })
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(PROVAS, 'mestre-1024.png') })

  // ---------- 7. sem rolagem horizontal em 1440 e 1024
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
  ok('sem rolagem horizontal em 1440 e 1024 (convite, rodada, resultado, mestre)', rolagem.every((r) => r.ok), rolagem.filter((r) => !r.ok))
  await page.setViewportSize({ width: 1440, height: 900 })

  // ---------- 8. folha de contato: o mesmo desenho do jogo, quadro a quadro
  const folha = await page.evaluate(() => {
    const A = window.AlavancaDaPonte, J = A.J, S = A.SIM, cfg = A.config
    A.trocarVisao('jogador'); J.manual = true; cfg.jogadores = 1; cfg.dif = 'normal'; cfg.tempo = null
    const fw = 512, fh = 288, quadros = []
    const cap = (rotulo) => {
      const c = document.createElement('canvas'); c.width = fw; c.height = fh
      A.desenharCena(c.getContext('2d'), fw, fh, A.estadoVisual())
      const P = J.P
      const t = !P ? 'antes da rodada' : J.tela === 'contagem' ? `contagem ${J.tFase.toFixed(2).replace('.', ',')} s` : J.tela === 'fim' ? `fim + ${J.tFase.toFixed(2).replace('.', ',')} s` : `t = ${P.t.toFixed(2).replace('.', ',')} s`
      const d = P ? `ponte ${Math.round(A.estadoVisual().p * 100)}% · corrente ${Math.round((P.forca / S.forcaMax(P.R)) * 100)}%${P.solta > 0 && J.tela === 'rodada' ? ' · solta' : ''}` : 'ponte 0%'
      quadros.push({ c, rotulo, t, d })
    }
    const robo = S.criarHumano('folha|3')
    J.roboVoce = robo
    const ate = (cond, max = 30) => { for (let k = 0; k < max / S.DT && !cond(); k++) A.rodar(S.DT) }
    A.irPara('convite'); cap('Convite: a ponte erguida')
    A.comecar(); A.rodar(0.3); cap('Contagem: "Prontos…"')
    ate(() => J.tela === 'rodada'); ate(() => J.P.giros[0] >= 3); cap('Já! Os primeiros giros')
    const g0 = J.P.giros[0]; ate(() => J.P.giros[0] > g0); A.rodar(S.DT * 3); cap('Giro: manivela, clique da catraca')
    ate(() => J.P.p >= 0.35); cap('A ponte desce; a corrente paga')
    robo.prox = J.P.t + 1.25
    ate(() => J.P.solta > 0.4); cap('Mão parada: a catraca soltou')
    ate(() => J.P.solta >= 1 && J.P.vel < -0.15, 2); A.rodar(0.12); cap('A corrente puxa a ponte de volta')
    ate(() => J.P.giros[0] > 0 && J.P.solta === 0); A.rodar(0.1); cap('Voltou a girar: a lingueta pega')
    ate(() => J.P.p >= 0.86); cap('Reta final: a corrente pesa mais')
    ate(() => J.tela === 'fim'); cap('Pouso: a ponte toca a margem')
    A.rodar(0.25); cap('Poeira e tremor do pouso')
    A.rodar(1.4); cap('Ponte assentada: o portão aberto')
    // derrota: Difícil com um metrônomo lento demais
    cfg.dif = 'dificil'; J.roboVoce = S.criarMetronomo(4.5); A.irPara('convite'); A.comecar(); A.rodar(0.8)
    ate(() => J.P.t >= J.P.R.tempo - 0.9); cap('Difícil, 4,5/s: últimos segundos, a ponte empaca')
    ate(() => J.tela === 'fim'); A.rodar(0.4); cap('Tempo esgotado: a ponte sobe')
    ate(() => J.bateu === true, 2); A.rodar(0.06); cap('A ponte bate no portão')
    J.roboVoce = null; cfg.dif = 'normal'; A.irPara('convite')
    const col = 4, linhas = Math.ceil(quadros.length / col), rod = 46
    const f = document.createElement('canvas'); f.width = col * (fw + 14) + 14; f.height = 46 + linhas * (fh + rod + 8)
    const g = f.getContext('2d')
    g.fillStyle = '#121214'; g.fillRect(0, 0, f.width, f.height)
    g.fillStyle = '#eceae4'; g.font = '600 16px Segoe UI, sans-serif'
    g.fillText(`Alavanca da ponte: ${quadros.length} quadros (Normal: convite, contagem, giros, catraca solta e volta, reta final, pouso; Difícil: derrota). Embaixo: o que acontece, o tempo, a ponte e a força da corrente.`, 14, 28)
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
  ok(`folha de contato com ${META.folhaDeContato.min} a ${META.folhaDeContato.max} quadros, com a catraca solta, o pouso e a derrota`, folha.quadros >= META.folhaDeContato.min && folha.quadros <= META.folhaDeContato.max && folha.rotulos.some((r) => / solta$/.test(r)) && folha.rotulos.some((r) => /bate no port/.test(r)), R.folha)

  // ---------- 9. som: as 2 rodadas do gráfico (vitória no Normal, derrota no Difícil), renderizadas offline
  const sons = []
  for (const [i, nome] of [[0, 'rodada-normal-vence'], [1, 'rodada-dificil-perde']]) {
    const g = graf[i]
    const b64 = await page.evaluate(async (res) => {
      const r = await window.AlavancaDaPonte.SOM.renderizar(res, OfflineAudioContext, 48000)
      const para = (f) => { const u = new Uint8Array(f.buffer, f.byteOffset, f.byteLength); let s = ''; for (let k = 0; k < u.length; k += 0x8000) s += String.fromCharCode.apply(null, u.subarray(k, k + 0x8000)); return btoa(s) }
      return { e: para(r.canais[0]), d: para(r.canais[1]), inicio: r.inicio }
    }, { fase: g.fase, tFim: g.tFim, eventos: g.eventos, trilha: g.trilha, R: g.R })
    const canal = (s) => { const b = Buffer.from(s, 'base64'); return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)) }
    const canais = [canal(b64.e), canal(b64.d)]
    fs.writeFileSync(path.join(SOM_DIR, `${nome}.wav`), medidas.wav16(canais, 48000))
    const m = medidas.medirTudo(canais, 48000)
    const env = medidas.envoltoria(canais, 48000, 0.1)
    sons.push({ nome, inicio: b64.inicio, medidas: m, env })
  }
  fs.writeFileSync(path.join(SOM_DIR, 'medidas.json'), JSON.stringify(Object.fromEntries(sons.map((s) => [s.nome, s.medidas])), null, 2) + '\n')
  R.som = sons.map((s) => ({ arquivo: `som/${s.nome}.wav`, lufsIntegrado: s.medidas.lufsIntegrado, picoVerdadeiroDbtp: s.medidas.picoVerdadeiroDbtp, cortes: s.medidas.cortes, cliques: s.medidas.cliques.length, ataques: s.medidas.ataques.length, dcPct: s.medidas.dcPct, silenciosNoMeio: s.medidas.silenciosNoMeio.length }))
  ok(`som: pico verdadeiro <= ${META.som.picoVerdadeiroMaxDbtp} dBTP, nenhum corte, nenhum clique fora de ataque, DC < 0,5%`, sons.every((s) => s.medidas.picoVerdadeiroDbtp <= META.som.picoVerdadeiroMaxDbtp && s.medidas.cortes === 0 && s.medidas.cliques.length === 0 && Math.abs(s.medidas.dcPct) < 0.5), R.som)
  ok(`som: volume dentro de 3 LU do tiro (${LUFS_TIRO} LUFS)`, sons.every((s) => Math.abs(s.medidas.lufsIntegrado - LUFS_TIRO) <= 3), R.som.map((s) => ({ arquivo: s.arquivo, lufs: s.lufsIntegrado })))

  // ---------- 10. gráfico do movimento (PNG): ponte, força, giros e o som na mesma linha do tempo
  const grafico = await page.evaluate(({ graf, envs }) => {
    const INK = '#0b0b0b', MUTED = '#52514e', GRID = '#e6e6e3', SURF = '#fcfcfb', AZUL = '#2a78d6', LARANJA = '#eb6834', SOLTA = 'rgba(227, 73, 72, 0.16)', VERDE = '#1baf7a'
    const x0 = 86, lw = 1150, FIM = 21, hP = 120, hF = 70, hG = 18, hS = 60
    const blocoDe = (k) => 50 + hP + 30 + hF + 26 + hG + (envs[k] ? 30 + hS : 0) + 56
    const c = document.createElement('canvas'); c.width = x0 + lw + 40; c.height = 24 + graf.reduce((a, _, k) => a + blocoDe(k), 0)
    const g = c.getContext('2d'); g.fillStyle = SURF; g.fillRect(0, 0, c.width, c.height)
    const X = (t) => x0 + (t / FIM) * lw
    const txt = (s, x, y, cor = MUTED, f = '11px Segoe UI, sans-serif') => { g.fillStyle = cor; g.font = f; g.fillText(s, x, y) }
    const grade = (y, h, marcas) => { g.strokeStyle = GRID; g.lineWidth = 1; for (const [k, rot] of marcas) { const yy = Math.round(y + h - k * h) + 0.5; g.beginPath(); g.moveTo(x0, yy); g.lineTo(x0 + lw, yy); g.stroke(); txt(rot, 8, yy + 4) } }
    const eixoT = (y) => { for (let t = 0; t <= FIM; t += 1) { g.strokeStyle = GRID; g.beginPath(); g.moveTo(X(t) + 0.5, y); g.lineTo(X(t) + 0.5, y + 4); g.stroke(); if (t % 2 === 0) txt(t + ' s', X(t) - 8, y + 16) } }
    const linha = (pts, y, h, cor) => { g.strokeStyle = cor; g.lineWidth = 2; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([t, v], i) => { const xx = X(t), yy = y + h - v * h; if (i) g.lineTo(xx, yy); else g.moveTo(xx, yy) }); g.stroke() }
    let y0 = 24
    graf.forEach((d, k) => {
      const am = d.amostras, Rr = d.R, fmax = Rr.puxaBase + Rr.puxaFundo + Rr.solta
      txt(`${d.titulo}: ${d.venceu ? `venceu em ${d.tFim.toFixed(1).replace('.', ',')} s` : `perdeu (tempo de ${Rr.tempo} s)`}${d.ritmo ? `, ritmo próprio ${d.ritmo.toFixed(1).replace('.', ',')}/s` : ''}`, x0, y0 + 14, INK, '600 14px Segoe UI, sans-serif')
      let y = y0 + 44
      // faixas da catraca solta e o limite de tempo, atrás de tudo
      const faixas = (yy, hh) => { g.fillStyle = SOLTA; for (let i = 1; i < am.length; i++) if (am[i][3] > 0) g.fillRect(X(am[i - 1][0]), yy, X(am[i][0]) - X(am[i - 1][0]) + 0.5, hh); g.strokeStyle = MUTED; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(X(Rr.tempo) + 0.5, yy); g.lineTo(X(Rr.tempo) + 0.5, yy + hh); g.stroke(); g.setLineDash([]) }
      txt('Ponte baixada (%)', x0, y - 4, INK, '600 12px Segoe UI, sans-serif')
      faixas(y, hP); grade(y, hP, [[0, '0%'], [0.5, '50%'], [1, '100%']])
      linha(am.map((a) => [a[0], a[1]]), y, hP, AZUL)
      txt(`tempo limite ${Rr.tempo} s`, X(Rr.tempo) + 4, y + 12)
      y += hP + 30
      txt('Força da corrente (% da força máxima; faixa vermelha = catraca solta)', x0, y - 4, INK, '600 12px Segoe UI, sans-serif')
      faixas(y, hF); grade(y, hF, [[0, '0%'], [0.5, '50%'], [1, '100%']])
      linha(am.map((a) => [a[0], a[2] / fmax]), y, hF, LARANJA)
      y += hF + 26
      txt('Giros (cada traço é um X)', x0, y - 4, INK, '600 12px Segoe UI, sans-serif')
      g.strokeStyle = VERDE; g.lineWidth = 1
      for (const t of d.giros) { g.beginPath(); g.moveTo(X(t) + 0.5, y); g.lineTo(X(t) + 0.5, y + hG); g.stroke() }
      y += hG
      if (envs[k]) {
        y += 30
        txt('Som renderizado: envoltória (dBFS, mesma linha do tempo; o som começa 1 s antes, na contagem)', x0, y - 4, INK, '600 12px Segoe UI, sans-serif')
        grade(y, hS, [[0, '-60'], [0.5, '-30'], [1, '0']])
        const e = envs[k]
        linha(e.pontos.map(([t, db]) => [t - e.inicio, Math.max(0, Math.min(1, (db + 60) / 60))]).filter(([t]) => t >= 0 && t <= FIM), y, hS, MUTED)
        y += hS
      }
      eixoT(y + 4)
      y0 += blocoDe(k)
    })
    return c.toDataURL('image/png')
  }, { graf, envs: [0, 1].map((i) => ({ inicio: sons[i].inicio, pontos: sons[i].env.rms.map((v, k) => [k * 0.1 + 0.05, Number.isFinite(v) ? v : -120]) })).concat([null]) })
  salvarPng('grafico-movimento.png', grafico)

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
