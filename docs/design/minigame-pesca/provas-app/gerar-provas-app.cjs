'use strict'
/**
 * Provas da PESCA NO APP pela regra de teste de jogos (não é código do app).
 *
 *   node docs/design/minigame-pesca/provas-app/gerar-provas-app.cjs
 *   node docs/design/minigame-pesca/provas-app/gerar-provas-app.cjs --sem-conferir
 *
 * Sobe o Vite do client numa porta e num cache próprios (o cache da 1420 é do
 * servidor do e2e), abre a vitrine da pesca no Edge sem janela e usa SÓ o código
 * do app: o MotorDaPesca (tela/motor.ts), sim.ts e som.ts, carregados pelo Vite.
 * Grava aqui:
 *   (i)   robô que joga como gente: 240 lances por dificuldade pelo motor, com
 *         reação de 250 ± 60 ms (nunca abaixo de 120 ms) e erro na leitura do peixe;
 *   (ii)  grafico-movimento.png: peixe, barra e medidor a cada 0,1 s (Normal e
 *         Extremo, robô humano), com as propriedades conferidas em TODA puxada;
 *   (iii) folha-contato.png: 15 quadros da vitrine em tempo real, com o tempo embaixo;
 *   (iv)  onda-som.png e som/*.wav renderizados offline do som.ts; depois roda o
 *         scripts/conferir-som.cjs no adaptador som/sons-da-pesca-app.ts;
 *   (v)   travada: p95 do quadro na puxada e tarefas longas, pela vitrine;
 * e medidas.json com tudo. Os 4 prints de layout já existentes não são refeitos.
 *
 * Metas do robô humano, escritas ANTES de rodar (pedido de 18/10/2026):
 *   Normal >= 70% dos lances pegos; Extremo entre 15% e 40%.
 * Meta fora NÃO é motivo para mexer nos números do jogo (o usuário aprovou
 * jogando): fica registrada em medidas.json e no README.
 */
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { pathToFileURL } = require('node:url')
const { chromium } = require('playwright')
const medidas = require('../../../../scripts/som/medidas.cjs')

const SAIDA = __dirname
const RAIZ = path.resolve(SAIDA, '..', '..', '..', '..')
const CLIENT = path.join(RAIZ, 'client')
const SOM_DIR = path.join(SAIDA, 'som')
const VITRINE = '/src/minigames/pesca/tela/vitrine/vitrine.html'
const PORTA = 14283
const TAXA = 48000
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms))
const virg = (v, c = 1) => (v === null || v === undefined ? '—' : Number(v).toFixed(c).replace('.', ','))
const pct = (v) => Math.round(v * 1000) / 10

/** O jogador humano de mentira. Reação e erro valem para a fisgada e para a leitura do peixe. */
const HUMANO = {
  reacaoMedia: 0.25,
  reacaoDesvio: 0.06,
  /** Piso da reação: nunca reação zero. */
  reacaoMin: 0.12,
  /** Desvio do erro na posição lida do peixe, em fração da coluna (~5 px numa coluna de 180). */
  erroLeitura: 0.03,
  /** De quanto em quanto tempo o olho "relê" o peixe (sorteia de novo atraso e erro). */
  olhada: 0.15,
  /** A mão decide a 60 Hz (um quadro de tela), não a cada passo de 1/120 s. */
  passosPorDecisao: 2,
  /** Força pretendida no lance: sorteada entre estes limites a cada lance. */
  forcaMin: 0.35,
  forcaMax: 0.95,
  /** Erro do instante de soltar no lance (a rampa é previsível: a mão antecipa, com erro). */
  erroSoltar: 0.06,
}
const LANCES_POR_DIF = 240
const SEMENTE = 'provas-app-2026-10-18'
const METAS = { normal: { min: 0.7, max: 1 }, extremo: { min: 0.15, max: 0.4 } }

async function subirVite() {
  const vite = await import(pathToFileURL(require.resolve('vite', { paths: [CLIENT] })).href)
  const servidor = await vite.createServer({
    root: CLIENT,
    configFile: path.join(CLIENT, 'vite.config.ts'),
    logLevel: 'error',
    // Cache próprio: o node_modules/.vite-1420 é do servidor do e2e; reotimizar nele derruba o teste do outro.
    cacheDir: path.join(CLIENT, 'node_modules', '.vite-provas-pesca'),
    // Varre só a vitrine: sem isso a varredura falha no index.html e o Vite reotimiza no meio da página (React duplicado).
    optimizeDeps: { entries: ['src/minigames/pesca/tela/vitrine/vitrine.html'] },
    server: { port: PORTA, strictPort: false, hmr: false },
  })
  await servidor.listen()
  return servidor
}

// ======================================================================= (i) robô humano, roda NA PÁGINA

/** Joga `n` lances pelo MotorDaPesca do app com o jogador humano de mentira. Roda dentro da página (Vite). */
async function jogarComoGente({ dif, n, semente, humano, gravarGrafico }) {
  const [{ MotorDaPesca }, S] = await Promise.all([import('/src/minigames/pesca/tela/motor.ts'), import('/src/minigames/pesca/sim.ts')])
  const { DIF, DT, rngDe } = S
  const r = rngDe(`${semente}|humano|${dif}`)
  const gauss = () => {
    let u = 0
    while (u === 0) u = r()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r())
  }
  const reacao = () => Math.max(humano.reacaoMin, humano.reacaoMedia + humano.reacaoDesvio * gauss())
  const ambiente = { agora: () => 0, quadro: () => 0, cancelarQuadro: () => undefined, controles: () => [] }
  const m = new MotorDaPesca(ambiente, false)
  const resultados = []
  /** A primeira puxada e a primeira que pegou: amostras a cada 0,1 s e os sons que o motor pediu. */
  let grafico = null
  let primeiroPegou = null
  let atual = null
  m.ganchos = {
    som: (nome, v) => {
      const e = m.J.puxada
      if (atual !== null && e !== null) atual.sons.push([nome, Math.round(e.t * 1000) / 1000, v === undefined ? null : v])
    },
    fimDoLance: (res) => resultados.push(res),
    quadro: () => undefined,
    confirmar: () => undefined,
  }
  m.comecar(dif, n, `robo-humano|${semente}`)
  const d = DIF[dif]
  const prop = { passos: 0, peixeFora: 0, barraAcimaDoTopo: 0, barraAbaixoDoFundo: 0, medidorNaoSubiuDentro: 0, medidorSubiuFora: 0, maxTopo: 0, minPeixe: 1, maxPeixe: 0 }
  const reacoesFisgada = []
  const forcas = []
  let tempoEsgotado = 0
  for (let lance = 1; lance <= n; lance++) {
    const alvo = humano.forcaMin + r() * (humano.forcaMax - humano.forcaMin)
    const soltarEm = Math.max(0.05, alvo * d.ciclo + humano.erroSoltar * gauss())
    const apertarEm = reacao()
    let reacaoDaFisgada = null
    const hist = []
    let olhadaEm = -Infinity
    let atraso = humano.reacaoMedia
    let erro = 0
    let passos = 0
    for (; m.J.fase !== 'resultado' && passos < 120 * 150; passos++) {
      const J = m.J
      const e = J.puxada
      if (J.fase === 'lance') {
        if (!J.carregando && !m.segurando && J.tFase >= apertarEm) m.apertar('robo')
        else if (J.carregando && J.tCarga >= soltarEm) {
          forcas.push(J.forca)
          m.soltar('robo')
        }
      } else if (J.fase === 'fisgada') {
        if (reacaoDaFisgada === null) {
          reacaoDaFisgada = reacao()
          reacoesFisgada.push(reacaoDaFisgada)
        }
        if (J.tFase >= reacaoDaFisgada && !m.segurando) m.apertar('robo')
      } else if (J.fase === 'puxada' && e !== null) {
        if (gravarGrafico && atual === null && (grafico === null || primeiroPegou === null)) atual = { lance, peixe: e.peixe.nome, comp: e.peixe.comp, amostras: [], sons: [], fim: null, t: 0, perfeito: false }
        hist.push(e.p.y)
        if (e.t - olhadaEm >= humano.olhada) {
          olhadaEm = e.t
          atraso = reacao()
          erro = humano.erroLeitura * gauss()
        }
        if (passos % humano.passosPorDecisao === 0) {
          const visto = hist[Math.max(0, hist.length - 1 - Math.round(atraso / DT))] + erro
          const quer = visto > e.b.y + e.b.tam / 2 + e.b.v * 0.12
          if (quer && !m.segurando) m.apertar('robo')
          else if (!quer && m.segurando) m.soltar('robo')
        }
        if (atual !== null && Math.round(e.t / DT) % 12 === 0) atual.amostras.push([Math.round(e.t * 100) / 100, e.p.y, e.b.y, e.b.y + e.b.tam, e.m, m.segurando ? 1 : 0])
        const mAntes = e.m
        m.tick()
        prop.passos++
        if (e.p.y < 0 || e.p.y > 1) prop.peixeFora++
        prop.minPeixe = Math.min(prop.minPeixe, e.p.y)
        prop.maxPeixe = Math.max(prop.maxPeixe, e.p.y)
        prop.maxTopo = Math.max(prop.maxTopo, e.b.y + e.b.tam)
        if (e.b.y + e.b.tam > 1 + 1e-9) prop.barraAcimaDoTopo++
        if (e.b.y < -1e-9) prop.barraAbaixoDoFundo++
        if (e.dentro && !(e.m > mAntes || e.m === 1)) prop.medidorNaoSubiuDentro++
        if (!e.dentro && e.m > mAntes) prop.medidorSubiuFora++
        if (atual !== null && e.fim !== null) {
          atual.amostras.push([Math.round(e.t * 100) / 100, e.p.y, e.b.y, e.b.y + e.b.tam, e.m, m.segurando ? 1 : 0])
          atual.fim = e.fim
          atual.t = e.t
          atual.perfeito = e.fim === 'pegou' && e.perfeito
          if (grafico === null) grafico = atual
          if (primeiroPegou === null && e.fim === 'pegou') primeiroPegou = atual
          atual = null
        }
        continue
      } else if (m.segurando) m.soltar('robo')
      m.tick()
    }
    if (m.J.fase !== 'resultado') tempoEsgotado++
    if (!m.proximoLance()) break
  }
  const porPeixe = {}
  for (const x of resultados) {
    const k = porPeixe[x.peixe.nome] ?? (porPeixe[x.peixe.nome] = { lances: 0, pegou: 0, escapou: 0, fugiu: 0 })
    k.lances++
    k[x.tipo]++
  }
  const conta = (tipo) => resultados.filter((x) => x.tipo === tipo).length
  const pegos = resultados.filter((x) => x.tipo === 'pegou')
  const ordenadas = [...reacoesFisgada].sort((a, b) => a - b)
  return {
    dif,
    lances: resultados.length,
    tempoEsgotado,
    pegou: conta('pegou'),
    escapou: conta('escapou'),
    fugiu: conta('fugiu'),
    perfeitos: pegos.filter((x) => x.perfeito).length,
    puxadaMediaPegouS: pegos.length ? pegos.reduce((s, x) => s + x.tempo, 0) / pegos.length : null,
    forcaMedia: forcas.length ? forcas.reduce((a, b) => a + b, 0) / forcas.length : null,
    reacaoFisgada: {
      media: ordenadas.reduce((a, b) => a + b, 0) / Math.max(1, ordenadas.length),
      p95: ordenadas[Math.floor(ordenadas.length * 0.95)] ?? null,
      max: ordenadas[ordenadas.length - 1] ?? null,
      min: ordenadas[0] ?? null,
      janela: d.janela,
    },
    porPeixe,
    propriedades: prop,
    grafico,
    primeiroPegou,
    assinatura: resultados.map((x) => `${x.tipo[0]}${x.peixe.id}${Math.round(x.tempo * 100)}`).join(','),
  }
}

// ======================================================================= (ii) gráfico, desenhado NA PÁGINA

function desenharGrafico({ casos, lw, x0 }) {
  const lh = 230
  const c = document.createElement('canvas')
  c.width = lw + x0 + 30
  c.height = 34 + casos.length * (lh + 112)
  const g = c.getContext('2d')
  g.fillStyle = '#fcfcfb'
  g.fillRect(0, 0, c.width, c.height)
  const FISH = '#b7791f', BAR = '#3d8b55', MED = '#2f6a9e', INK = '#1d232b', MUTED = '#5b6470', GRID = '#e6e6e3', SEG = '#8a8f98'
  casos.forEach((caso, k) => {
    const { dif, nota, lance, peixe, comp, fim, t, perfeito, amostras, dominio } = caso
    const y0 = 44 + k * (lh + 112)
    const X = (s) => x0 + (s / dominio) * lw
    const Y = (v) => y0 + lh - v * lh
    g.fillStyle = INK
    g.font = '600 14px Segoe UI, sans-serif'
    const desfecho = fim === 'pegou' ? `pegou em ${t.toFixed(1).replace('.', ',')} s${perfeito ? ', perfeito' : ''}` : `escapou em ${t.toFixed(1).replace('.', ',')} s`
    g.fillText(`${dif === 'normal' ? 'Normal' : 'Extremo'}, ${nota} (lance ${lance}): ${peixe} (${comp}), robô humano (reação 250 ± 60 ms, erro de leitura ± 0,03): ${desfecho}`, x0, y0 - 16)
    g.strokeStyle = GRID
    g.lineWidth = 1
    g.font = '11px Segoe UI, sans-serif'
    g.fillStyle = MUTED
    for (let i = 0; i <= 4; i++) {
      const y = Math.round(Y(i / 4)) + 0.5
      g.beginPath()
      g.moveTo(x0, y)
      g.lineTo(x0 + lw, y)
      g.stroke()
      g.fillText(['fundo 0', '0,25', '0,5', '0,75', 'topo 1'][i], 8, y + 4)
    }
    const passo = dominio > 20 ? 2 : 1
    for (let s = 0; s <= dominio + 1e-9; s += passo) g.fillText(`${s} s`, X(s) - 6, y0 + lh + 30)
    g.fillStyle = 'rgba(61,139,85,0.2)'
    g.beginPath()
    amostras.forEach(([s, , b]) => g.lineTo(X(s), Y(b)))
    ;[...amostras].reverse().forEach(([s, , , topo]) => g.lineTo(X(s), Y(topo)))
    g.closePath()
    g.fill()
    const linha = (idx, cor, larg, tra) => {
      g.strokeStyle = cor
      g.lineWidth = larg
      g.setLineDash(tra ?? [])
      g.beginPath()
      amostras.forEach((a, i) => (i ? g.lineTo(X(a[0]), Y(a[idx])) : g.moveTo(X(a[0]), Y(a[idx]))))
      g.stroke()
      g.setLineDash([])
    }
    linha(2, BAR, 1)
    linha(3, BAR, 1)
    linha(1, FISH, 2)
    linha(4, MED, 2, [6, 4])
    // Faixa embaixo: quando a mão segura o botão.
    g.fillStyle = SEG
    for (let i = 0; i < amostras.length - 1; i++) if (amostras[i][5]) g.fillRect(X(amostras[i][0]), y0 + lh + 6, Math.max(1, X(amostras[i + 1][0]) - X(amostras[i][0])), 8)
    const ly = y0 + lh + 56
    g.fillStyle = 'rgba(61,139,85,0.35)'
    g.fillRect(x0, ly - 9, 18, 10)
    g.strokeStyle = BAR
    g.strokeRect(x0 + 0.5, ly - 8.5, 17, 9)
    g.fillStyle = INK
    g.font = '12px Segoe UI, sans-serif'
    g.fillText('barra verde', x0 + 24, ly)
    g.strokeStyle = FISH
    g.lineWidth = 2
    g.beginPath()
    g.moveTo(x0 + 110, ly - 4)
    g.lineTo(x0 + 130, ly - 4)
    g.stroke()
    g.fillText('peixe', x0 + 136, ly)
    g.strokeStyle = MED
    g.setLineDash([6, 4])
    g.beginPath()
    g.moveTo(x0 + 190, ly - 4)
    g.lineTo(x0 + 210, ly - 4)
    g.stroke()
    g.setLineDash([])
    g.fillText('medidor (0 escapa, 1 pega)', x0 + 216, ly)
    g.fillStyle = SEG
    g.fillRect(x0 + 400, ly - 8, 18, 8)
    g.fillStyle = INK
    g.fillText('segurando o botão', x0 + 424, ly)
    g.fillStyle = MUTED
    g.fillText(`${amostras.length} amostras, uma a cada 0,1 s; 0 s = fisgou; MotorDaPesca do app`, x0 + 580, ly)
  })
  return c.toDataURL('image/png')
}

// ======================================================================= (iv) som, NA PÁGINA

/** Renderiza offline uma lista de [som, instante, v] com o som.ts do app, no barramento do jogo (GANHO). */
async function renderizarSons({ eventos, duracao, taxa }) {
  const SOM = await import('/src/minigames/pesca/som.ts')
  const off = new OfflineAudioContext(2, Math.round(taxa * duracao), taxa)
  const fx = off.createGain()
  fx.gain.value = SOM.GANHO
  fx.connect(off.destination)
  for (const [nome, t, v] of eventos) SOM.SONS[nome](off, fx, t, v === null ? undefined : v)
  const buf = await off.startRendering()
  const b64 = (f) => {
    const u = new Uint8Array(f.buffer, f.byteOffset, f.byteLength)
    let s = ''
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000))
    return btoa(s)
  }
  return [0, 1].map((c) => b64(buf.getChannelData(c)))
}

async function lerSequencia() {
  const SOM = await import('/src/minigames/pesca/som.ts')
  return { seq: SOM.SEQ.map(([n, t, v]) => [n, t, v === undefined ? null : v]), dur: SOM.DURACAO_SEQ, nomes: Object.keys(SOM.SONS) }
}

function desenharOnda({ paineis, lw, x0 }) {
  const lh = 150
  const c = document.createElement('canvas')
  c.width = lw + x0 + 30
  c.height = 20 + paineis.length * (lh + 150)
  const g = c.getContext('2d')
  g.fillStyle = '#fcfcfb'
  g.fillRect(0, 0, c.width, c.height)
  const nivel = (db) => Math.min(1, Math.max(0, (db + 60) / 60))
  const NOMES = { lance: 'lance', splash: 'splash', beliscada: 'beliscada', fisgada: '"!" fisgada', catraca: 'catraca', bau: 'baú', pegou: 'pegou', escapou: 'escapou' }
  paineis.forEach((p, k) => {
    const y0 = 90 + k * (lh + 150)
    const X = (t) => x0 + (t / p.dominio) * lw
    g.fillStyle = '#1d232b'
    g.font = '600 13px Segoe UI, sans-serif'
    g.fillText(p.titulo, x0, y0 - 66)
    const arr = p.pico
    const n = arr.length
    g.fillStyle = '#b7791f'
    for (let i = 0; i < n; i++) {
      const t = i * p.passo
      if (t > p.dominio) break
      const v = nivel(arr[i] ?? -120)
      g.fillRect(X(t), y0 + lh / 2 - (v * lh) / 2, Math.max(1, (p.passo / p.dominio) * lw), Math.max(1, v * lh))
    }
    let ultimo = ''
    let alt = 0
    g.font = '11px Segoe UI, sans-serif'
    p.eventos.forEach(([nome, t]) => {
      g.fillStyle = 'rgba(47,106,158,0.9)'
      g.fillRect(X(t), y0 + lh + 6, 1, 8)
      if (nome !== ultimo) {
        alt = 1 - alt
        g.fillStyle = '#1d232b'
        g.fillText(NOMES[nome] ?? nome, X(t) - 2, y0 - 26 - alt * 14)
        g.fillStyle = 'rgba(47,106,158,0.5)'
        g.fillRect(X(t), y0 - 22 - alt * 14, 1, 22 + alt * 14)
      }
      ultimo = nome
    })
    g.fillStyle = '#5b6470'
    const passoEixo = p.dominio > 12 ? 1 : 0.5
    for (let t = 0; t <= p.dominio + 1e-9; t += passoEixo) {
      g.fillRect(X(t), y0 + lh + 18, 1, 5)
      g.fillText(`${t.toFixed(1).replace('.', ',')} s`, X(t) - 8, y0 + lh + 34)
    }
    g.fillText(p.rodape, x0, y0 + lh + 56)
  })
  return c.toDataURL('image/png')
}

// ======================================================================= folha de contato

async function montarFolha(navegador, nome, titulo, quadros, colunas) {
  const page = await navegador.newPage({ viewport: { width: 1600, height: 900 } })
  const html = `<body style="margin:0;background:#121214;color:#eceae4;font:13px 'Segoe UI',system-ui"><p style="margin:12px 14px 0;font-weight:600;font-size:15px">${titulo}</p><div style="display:grid;grid-template-columns:repeat(${colunas},1fr);gap:10px;padding:12px">${quadros
    .map((q) => `<figure style="margin:0"><img style="width:100%;display:block;border:1px solid #333" src="data:image/png;base64,${q.png.toString('base64')}"><figcaption style="padding:4px 2px;color:#a2a09a">${q.rotulo}<br><b style="color:#e0a44a;font-weight:600">${q.tempo}</b></figcaption></figure>`)
    .join('')}</div></body>`
  await page.setContent(html)
  await page.screenshot({ path: path.join(SAIDA, nome), fullPage: true })
  await page.close()
}

/** Relógio congelável: o motor só anda em quadros que passam pelo requestAnimationFrame embrulhado. */
function instalarRelogio() {
  const raf = window.requestAnimationFrame.bind(window)
  let congelado = false
  let desde = 0
  let desconto = 0
  window.__rafOriginal = raf
  window.__congelado = () => congelado
  window.__relogio = () => performance.now() - desconto - (congelado ? performance.now() - desde : 0)
  window.__congelar = () => {
    if (congelado) return
    congelado = true
    desde = performance.now()
  }
  window.__soltar = () => {
    if (!congelado) return
    desconto += performance.now() - desde
    congelado = false
  }
  window.requestAnimationFrame = (f) => {
    const embrulho = (t) => (congelado ? raf(embrulho) : f(t - desconto))
    return raf(embrulho)
  }
}

/** Vigia, a cada quadro, a próxima condição da folha; quando bate, congela o jogo para o print. */
function vigiar(condicoes) {
  const fs = condicoes.map(([rotulo, expr, esperaMs]) => ({ rotulo, f: new Function('J', 'd', `return (${expr})`), esperaMs }))
  const v = window.__vitrinePesca
  const t0 = window.__relogio()
  let i = 0
  window.__fotos = { pronta: null, feito: false }
  const pct = (x) => Math.round(x * 100)
  const olhar = () => {
    if (i >= fs.length) {
      window.__fotos.feito = true
      return
    }
    if (!window.__congelado() && window.__fotos.pronta === null) {
      const J = v.motor.J
      let k = -1
      for (let j = i; j < fs.length && k < 0; j++) {
        try {
          if (fs[j].f(J, document)) k = j
        } catch {
          // condição que lê algo ainda inexistente (ex.: J.puxada nula) é só "ainda não".
        }
      }
      if (k >= 0) {
        i = k + 1
        window.__congelar()
        const res = v.motor.lerInstantaneo().resultados.at(-1)
        const rotulo = fs[k].rotulo
          .replace('{forca}', String(pct(J.forca)))
          .replace('{dist}', String(pct(J.dist)))
          .replace('{medidor}', J.puxada ? String(pct(J.puxada.m)) : '?')
          .replace('{desfecho}', res ? res.tipo : '?')
          .replace('{peixe}', res ? `${res.peixe.nome}, ${res.cm} cm` : '?')
        window.__fotos.pronta = { rotulo, t: (window.__relogio() - t0) / 1000, esperaMs: fs[k].esperaMs, pulou: k - (i - 1) }
      }
    }
    window.__rafOriginal(olhar)
  }
  window.__rafOriginal(olhar)
}

const CONDICOES_DA_FOLHA = [
  ['Lance: parado', "J.fase === 'lance' && !J.carregando && J.tFase > 0.2", 0],
  ['Segurando: força {forca}%', "J.fase === 'lance' && J.carregando && J.forca > 0.4", 0],
  ['Segurando: força {forca}%', "J.fase === 'lance' && J.carregando && J.forca > 0.75", 0],
  ['Soltou: a boia voa ({dist}%)', "J.fase === 'voo' && J.tFase > 0.2", 0],
  ['Boia na água: espera', "J.fase === 'espera' && J.tFase > 0.15", 0],
  ['Espera: a boia balança', "J.fase === 'espera' && J.tFase > 1.2", 0],
  ['Fisgada: "!"', "J.fase === 'fisgada' && J.tFase > 0.03", 0],
  ['Puxada: medidor {medidor}%', "J.fase === 'puxada' && J.puxada.t > 0.5", 0],
  ['Puxada: medidor {medidor}%', "J.fase === 'puxada' && J.puxada.t > 2", 0],
  ['Puxada: medidor {medidor}%', "J.fase === 'puxada' && J.puxada.t > 4", 0],
  ['Puxada: medidor {medidor}%', "J.fase === 'puxada' && J.puxada.t > 6.5", 0],
  ['Fim da puxada: {desfecho}', "J.fase === 'final' && J.tFase > 0.15", 0],
  ['O peixe vem para a mão', "J.fase === 'final' && J.tFase > 0.75", 0],
  ['Resultado: {peixe}', "!!d.querySelector('.pz-tela--resultado') && !d.querySelector('.pz-cesto')", 500],
  ['Cesto', "!!d.querySelector('.pz-cesto')", 500],
]

// ======================================================================= principal

async function main() {
  const R = { geradoEm: new Date().toISOString(), testes: [], metas: {}, erros: [] }
  const ok = (nome, passou, detalhe) => {
    R.testes.push({ nome, passou: !!passou, detalhe })
    console.log(`${passou ? 'PASSOU' : 'FALHOU'}  ${nome}${detalhe ? `  — ${JSON.stringify(detalhe)}` : ''}`)
  }
  fs.mkdirSync(SOM_DIR, { recursive: true })
  const servidor = await subirVite()
  const url = `http://localhost:${servidor.config.server.port ?? PORTA}${VITRINE}`
  const args = ['--autoplay-policy=no-user-gesture-required']
  const navegador = await chromium.launch({ channel: 'msedge', args }).catch(() => chromium.launch({ args }))
  const ligar = (page, onde) => {
    page.on('console', (m) => m.type() === 'error' && R.erros.push(`${onde}: ${m.text()}`))
    page.on('pageerror', (e) => R.erros.push(`${onde}: ${String(e)}`))
  }
  try {
    // ------------------------------------------------ (i) robô humano + (ii) gráfico + (iv) som
    const page = await navegador.newPage({ viewport: { width: 1440, height: 900 } })
    ligar(page, 'robô')
    await page.goto(`${url}?tela=convite&mudo=1`)
    await page.waitForFunction(() => Reflect.has(window, '__vitrinePesca'))
    const robo = {}
    for (const dif of ['normal', 'extremo']) {
      robo[dif] = await page.evaluate(jogarComoGente, { dif, n: LANCES_POR_DIF, semente: SEMENTE, humano: HUMANO, gravarGrafico: true })
    }
    const repetido = await page.evaluate(jogarComoGente, { dif: 'extremo', n: 40, semente: SEMENTE, humano: HUMANO, gravarGrafico: false })
    const outra = await page.evaluate(jogarComoGente, { dif: 'extremo', n: 40, semente: `${SEMENTE}-b`, humano: HUMANO, gravarGrafico: false })
    const primeiros40 = robo.extremo.assinatura.split(',').slice(0, 40).join(',')
    ok('mesma semente = mesmos 40 lances do robô humano; outra semente = outros', repetido.assinatura === primeiros40 && outra.assinatura !== primeiros40)
    R.roboHumano = { modelo: HUMANO, lancesPorDificuldade: LANCES_POR_DIF, semente: SEMENTE, motor: 'client/src/minigames/pesca/tela/motor.ts (MotorDaPesca, passo fixo 1/120 s, sorteio do peixe pelo lance como no jogo)' }
    for (const dif of ['normal', 'extremo']) {
      const x = robo[dif]
      const taxa = x.pegou / x.lances
      const puxadas = x.pegou + x.escapou
      R.roboHumano[dif] = {
        lances: x.lances,
        pegouPct: pct(taxa),
        escapouPct: pct(x.escapou / x.lances),
        fugiuPct: pct(x.fugiu / x.lances),
        pegouDasPuxadasPct: pct(x.pegou / Math.max(1, puxadas)),
        perfeitos: x.perfeitos,
        puxadaMediaPegouS: x.puxadaMediaPegouS === null ? null : Math.round(x.puxadaMediaPegouS * 10) / 10,
        forcaMediaDoLance: Math.round(x.forcaMedia * 100) / 100,
        reacaoFisgadaS: Object.fromEntries(Object.entries(x.reacaoFisgada).map(([k, v]) => [k, v === null ? null : Math.round(v * 1000) / 1000])),
        tempoEsgotado: x.tempoEsgotado,
        porPeixe: Object.fromEntries(Object.entries(x.porPeixe).map(([k, v]) => [k, `${v.pegou}/${v.lances} pegos, ${v.fugiu} fugiram`])),
      }
      const meta = METAS[dif]
      R.metas[dif] = { meta: dif === 'normal' ? '>= 70% pegos' : 'entre 15% e 40% pegos', valorPct: pct(taxa), bateu: taxa >= meta.min && taxa <= meta.max }
      console.log(`META ${dif}: ${R.metas[dif].meta} -> ${virg(pct(taxa))}% ${R.metas[dif].bateu ? 'BATEU' : 'FORA DA META'} (fugiu ${virg(pct(x.fugiu / x.lances))}%)`)
      const p = x.propriedades
      ok(`${dif}: peixe dentro de 0..1 em todos os ${p.passos} passos de puxada`, p.peixeFora === 0, { min: Math.round(p.minPeixe * 1000) / 1000, max: Math.round(p.maxPeixe * 1000) / 1000 })
      ok(`${dif}: a barra nunca passa do topo nem do fundo`, p.barraAcimaDoTopo === 0 && p.barraAbaixoDoFundo === 0, { topoMax: Math.round(p.maxTopo * 1e6) / 1e6 })
      ok(`${dif}: medidor sobe a cada passo com o peixe dentro e nunca sobe com ele fora`, p.medidorNaoSubiuDentro === 0 && p.medidorSubiuFora === 0, { naoSubiuDentro: p.medidorNaoSubiuDentro, subiuFora: p.medidorSubiuFora })
      ok(`${dif}: nenhum lance passou de 150 s`, x.tempoEsgotado === 0)
    }

    // Sensibilidade no Extremo: o mesmo jogador com reação mais rápida ou leitura perfeita (só para decidir números; o jogo não muda).
    const VARIACOES = [
      ['reação 200 ± 50 ms', { reacaoMedia: 0.2, reacaoDesvio: 0.05 }],
      ['reação 150 ± 40 ms', { reacaoMedia: 0.15, reacaoDesvio: 0.04 }],
      ['reação 250 ± 60 ms, sem erro de leitura', { erroLeitura: 0 }],
      ['reação 120 ms fixa, sem erro (o robô do protótipo)', { reacaoMedia: 0.12, reacaoDesvio: 0, erroLeitura: 0 }],
    ]
    R.sensibilidadeExtremo = {}
    for (const [rotulo, mudanca] of VARIACOES) {
      const x = await page.evaluate(jogarComoGente, { dif: 'extremo', n: LANCES_POR_DIF, semente: SEMENTE, humano: { ...HUMANO, ...mudanca }, gravarGrafico: false })
      R.sensibilidadeExtremo[rotulo] = { pegouPct: pct(x.pegou / x.lances), fugiuPct: pct(x.fugiu / x.lances) }
    }
    console.log('sensibilidade no Extremo:', JSON.stringify(R.sensibilidadeExtremo))

    // (ii) gráfico: a primeira puxada de cada dificuldade e, se for outra, a primeira que pegou no Extremo
    const linhaDoGrafico = (dif, gr, nota) => ({ dif, nota, peixe: gr.peixe, comp: gr.comp, fim: gr.fim, t: gr.t, perfeito: gr.perfeito, amostras: gr.amostras, dominio: Math.ceil(gr.t + 1), lance: gr.lance })
    const casos = [linhaDoGrafico('normal', robo.normal.grafico, 'primeira puxada'), linhaDoGrafico('extremo', robo.extremo.grafico, 'primeira puxada')]
    const pegouX = robo.extremo.primeiroPegou
    if (pegouX !== null && pegouX !== robo.extremo.grafico && pegouX.lance !== robo.extremo.grafico.lance) casos.push(linhaDoGrafico('extremo', pegouX, 'primeira que pegou'))
    const LW = 1180
    const X0 = 64
    const pngGrafico = await page.evaluate(desenharGrafico, { casos, lw: LW, x0: X0 })
    fs.writeFileSync(path.join(SAIDA, 'grafico-movimento.png'), Buffer.from(pngGrafico.split(',')[1], 'base64'))
    R.grafico = casos.map((c) => ({ dif: c.dif, nota: c.nota, lance: c.lance, peixe: c.peixe, fim: c.fim, t: Math.round(c.t * 10) / 10, perfeito: c.perfeito, amostras: c.amostras.length }))

    // (iv) som: cada som, a sequência do som.ts e os sons da puxada Normal do gráfico
    const deB64 = (s) => {
      const b = Buffer.from(s, 'base64')
      return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4)
    }
    const { seq, dur, nomes } = await page.evaluate(lerSequencia)
    const DURACAO_DO_SOM = { lance: 0.8, splash: 0.7, beliscada: 0.25, fisgada: 0.35, catraca: 0.12, pegou: 0.9, escapou: 0.8, bau: 0.9 }
    const resumo = (m) => ({ picoDbfs: m.picoDbfs, picoVerdadeiroDbtp: m.picoVerdadeiroDbtp, lufsIntegrado: m.lufsIntegrado, lufsCurtoPrazoMax: m.lufsCurtoPrazoMax, dcPct: m.dcPct, cortes: m.cortes, cliques: m.cliques.length, silenciosNoMeio: m.silenciosNoMeio.length })
    R.som = { taxa: TAXA, ganho: 'GANHO do som.ts (barramento fx da tela), volume 1', porSom: {} }
    for (const nome of nomes) {
      const canais = (await page.evaluate(renderizarSons, { eventos: [[nome, 0.01, null]], duracao: DURACAO_DO_SOM[nome] ?? 0.8, taxa: TAXA })).map(deB64)
      fs.writeFileSync(path.join(SOM_DIR, `${nome}.wav`), medidas.wav16(canais, TAXA))
      R.som.porSom[nome] = resumo(medidas.medirTudo(canais, TAXA))
    }
    const canaisSeq = (await page.evaluate(renderizarSons, { eventos: seq, duracao: dur, taxa: TAXA })).map(deB64)
    fs.writeFileSync(path.join(SOM_DIR, 'sequencia.wav'), medidas.wav16(canaisSeq, TAXA))
    R.som.sequencia = resumo(medidas.medirTudo(canaisSeq, TAXA))
    const grN = robo.normal.grafico
    const domN = casos[0].dominio
    const canaisPux = (await page.evaluate(renderizarSons, { eventos: grN.sons.map(([n, t, v]) => [n, t + 0.005, v]), duracao: domN, taxa: TAXA })).map(deB64)
    fs.writeFileSync(path.join(SOM_DIR, 'puxada-normal-do-grafico.wav'), medidas.wav16(canaisPux, TAXA))
    R.som.puxadaNormalDoGrafico = { ...resumo(medidas.medirTudo(canaisPux, TAXA)), eventos: grN.sons.length, catracas: grN.sons.filter((s) => s[0] === 'catraca').length }
    const PASSO_ENV = 0.005
    const envPux = medidas.envoltoria(canaisPux, TAXA, PASSO_ENV)
    const envSeq = medidas.envoltoria(canaisSeq, TAXA, PASSO_ENV)
    const pngOnda = await page.evaluate(desenharOnda, {
      lw: LW,
      x0: X0,
      paineis: [
        {
          titulo: `Sons da puxada Normal do gráfico (${grN.peixe}), mesma linha do tempo do gráfico do movimento (0 s = fisgou): envoltória do pico a cada 5 ms, −60 a 0 dBFS`,
          dominio: domN,
          passo: PASSO_ENV,
          pico: envPux.pico.map((v) => (Number.isFinite(v) ? v : -120)),
          eventos: grN.sons,
          rodape: `traços azuis: cada som que o MotorDaPesca pediu nesta puxada (${grN.sons.length}; ${R.som.puxadaNormalDoGrafico.catracas} dentes de catraca), tocado pelo som.ts com o GANHO da tela`,
        },
        {
          titulo: 'Todos os sons da pesca na sequência de provas do som.ts (SEQ): envoltória do pico a cada 5 ms, −60 a 0 dBFS',
          dominio: dur,
          passo: PASSO_ENV,
          pico: envSeq.pico.map((v) => (Number.isFinite(v) ? v : -120)),
          eventos: seq,
          rodape: 'traços azuis: instante de cada som em SOM.SEQ (client/src/minigames/pesca/som.ts)',
        },
      ],
    })
    fs.writeFileSync(path.join(SAIDA, 'onda-som.png'), Buffer.from(pngOnda.split(',')[1], 'base64'))
    const todos = [...Object.values(R.som.porSom), R.som.sequencia, R.som.puxadaNormalDoGrafico]
    const acimaDoLimite = Object.entries(R.som.porSom).filter(([, m]) => m.picoVerdadeiroDbtp > -1).map(([nome, m]) => `${nome} ${m.picoVerdadeiroDbtp} dBTP`)
    ok('som do app: nenhum corte, nenhum clique, pico verdadeiro <= -1 dBTP (cada som na força máxima, a sequência e a puxada)', todos.every((m) => m.cortes === 0 && m.cliques === 0 && m.picoVerdadeiroDbtp <= -1), { picoMaxDbtp: Math.max(...todos.map((m) => m.picoVerdadeiroDbtp)), acimaDoLimite })
    await page.close()

    // ------------------------------------------------ (iii) folha de contato pela vitrine, em tempo real
    const ctxFolha = await navegador.newContext({ viewport: { width: 1280, height: 800 } })
    await ctxFolha.addInitScript(instalarRelogio)
    const pf = await ctxFolha.newPage()
    ligar(pf, 'folha')
    await pf.goto(`${url}?tela=jogo&lances=1&mudo=1`)
    await pf.waitForFunction(() => Reflect.has(window, '__vitrinePesca') && document.querySelector('.pz-tela--jogo') !== null)
    await pf.evaluate(vigiar, CONDICOES_DA_FOLHA)
    const quadros = []
    const pulados = []
    for (;;) {
      const h = await pf.waitForFunction(() => window.__fotos.pronta ?? (window.__fotos.feito ? 'fim' : null), null, { timeout: 60000, polling: 30 })
      const f = await h.jsonValue()
      if (f === 'fim') break
      if (f.esperaMs) await espera(f.esperaMs)
      quadros.push({ rotulo: f.rotulo, tempo: `t = ${virg(f.t, 2)} s`, png: await pf.screenshot() })
      if (f.pulou > 0) pulados.push(f.rotulo)
      await pf.evaluate(() => {
        window.__fotos.pronta = null
        window.__soltar()
      })
    }
    await montarFolha(navegador, 'folha-contato.png', `Vitrine da pesca (PescaOverlay + MotorDaPesca do app), 1 lance no Normal com o robô da vitrine; tempo = relógio do jogo desde o começo do lance, ${quadros.length} quadros`, quadros, 4)
    R.folha = { quadros: quadros.length, rotulos: quadros.map((q) => `${q.tempo} · ${q.rotulo}`), condicoesPuladas: CONDICOES_DA_FOLHA.length - quadros.length }
    ok('folha de contato com 12 a 16 quadros', quadros.length >= 12 && quadros.length <= 16, { quadros: quadros.length })
    await ctxFolha.close()

    // ------------------------------------------------ (v) travada: 3 lances em tempo real, com som, sem prints
    const ctxT = await navegador.newContext({ viewport: { width: 1440, height: 900 } })
    await ctxT.addInitScript(() => {
      window.__longas = []
      try {
        new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__longas.push(e.duration))).observe({ type: 'longtask', buffered: true })
      } catch {
        // sem longtask neste navegador: fica só o quadro.
      }
    })
    const pt = await ctxT.newPage()
    ligar(pt, 'travada')
    const t0 = Date.now()
    await pt.goto(`${url}?tela=jogo&lances=3`)
    await pt.waitForSelector('.pz-cesto', { timeout: 150000 })
    const medida = await pt.evaluate(() => ({ ...window.__vitrinePesca.medida(), longas: window.__longas.map((d) => Math.round(d)), resultados: window.__vitrinePesca.motor.lerInstantaneo().resultados.map((r) => r.tipo) }))
    R.travada = { ...medida, duracaoS: Math.round((Date.now() - t0) / 100) / 10, onde: 'vitrine ?tela=jogo&lances=3, 1440x900, Edge sem janela, som ligado, robô da vitrine' }
    ok('travada: p95 do intervalo de quadro na puxada <= 20 ms e nenhuma tarefa longa >= 200 ms', medida.quadros > 100 && medida.p95IntervaloMs <= 20 && !medida.longas.some((d) => d >= 200), R.travada)
    await ctxT.close()
  } finally {
    await navegador.close()
    await servidor.close()
  }
  ok('nenhum erro no console das páginas', R.erros.length === 0, R.erros)

  // ------------------------------------------------ conferir-som no adaptador (outro navegador, depois que o meu fechou)
  if (!process.argv.includes('--sem-conferir')) {
    const cs = spawnSync(process.execPath, [path.join(RAIZ, 'scripts', 'conferir-som.cjs'), path.join(SOM_DIR, 'sons-da-pesca-app.ts'), '--saida', SOM_DIR], { cwd: RAIZ, encoding: 'utf8', timeout: 300000 })
    fs.writeFileSync(path.join(SOM_DIR, 'conferir-som.txt'), (cs.stdout ?? '') + (cs.stderr ?? ''))
    R.conferirSom = { codigo: cs.status, veredito: /sons-da-pesca-app: aprovado/.test(cs.stdout ?? '') ? 'aprovado nas medidas' : 'ver som/conferir-som.txt', aviso: 'medir não é ouvir: ouça som/*.wav' }
    ok('conferir-som (scripts/conferir-som.cjs) aprova o som do app', cs.status === 0, R.conferirSom)
  }
  fs.writeFileSync(path.join(SAIDA, 'medidas.json'), `${JSON.stringify(R, null, 2)}\n`)
  const falhas = R.testes.filter((t) => !t.passou).length
  console.log(`\n${R.testes.length - falhas} de ${R.testes.length} testes passaram. Metas: ${Object.entries(R.metas).map(([k, v]) => `${k} ${v.valorPct}% ${v.bateu ? 'bateu' : 'FORA'}`).join(', ')}`)
  process.exitCode = falhas ? 1 : 0
}

main().catch((erro) => {
  console.error(erro)
  process.exitCode = 2
})
