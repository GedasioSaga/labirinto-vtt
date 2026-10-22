// pagina.js — a tela: estado, câmera, camadas que ficam prontas aos poucos (sem travar), quadro a quadro,
// entrada por mouse, toque e teclado, as ferramentas de medição e a API que as provas usam (window.Batalha).
;(function () {
  'use strict'
  const N = Nucleo
  const Pt = Pintor
  const t0Pagina = performance.now()
  const movimentoReduzido = window.matchMedia('(prefers-reduced-motion: reduce)')
  const reduzido = () => movimentoReduzido.matches || document.documentElement.dataset.movimento === 'reduzido'

  const $ = (id) => document.getElementById(id)
  const canvas = $('mapa')
  const ctx = canvas.getContext('2d')
  const MAPAS = { vila: N.vila(), baia: N.baia() }

  const est = {
    mapa: MAPAS.vila,
    rot: 0,
    periodo: 'dia',
    batalha: false,
    ferramenta: 'mover',
    rastro: false,
    degrau: 1,
    sel: null,
    alcance: null,
    hover: -1,
    cursor: -1,
    previa: null,
    medida: { a: null, b: null, fixo: false },
    anims: new Map(),
    rotulos: [],
    cam: { cx: 0, cy: 0, zoom: 1, w: 800, h: 600 },
    dpr: 1,
    arraste: null,
    primeiraPintura: null,
    quadros: [],
    tarefas: [],
    passeio: false,
  }

  // ---------- fila de fundo: trabalho pesado em pedaços, sem tarefa longa ----------
  const fila = []
  let agendado = false
  const canal = new MessageChannel()
  canal.port1.onmessage = () => {
    agendado = false
    const inicio = performance.now()
    while (fila.length && performance.now() - inicio < 24) {
      const job = fila[0]
      if (job.fn()) fila.shift()
    }
    if (fila.length) agendar()
  }
  function agendar() {
    if (agendado) return
    agendado = true
    canal.port2.postMessage(0)
  }
  function enfileirar(chave, fn, frente = false) {
    if (fila.some((j) => j.chave === chave)) return
    const job = { chave, fn }
    if (frente) fila.unshift(job)
    else fila.push(job)
    agendar()
  }

  // ---------- camadas (estática, grade, máscara da água) ----------
  const camadas = new Map()
  const MAX_PIXELS = 26e6
  function escalaPara(zoom, m, rot) {
    const met = N.preparo(m, rot).met
    const alvo = zoom * est.dpr
    let s = alvo <= 1.15 ? 1 : alvo <= 1.6 ? 1.5 : alvo <= 2.2 ? 2 : 3
    while (s > 1 && met.largura * met.altura * s * s > MAX_PIXELS) s -= 0.5
    return s
  }
  const chaveDaCamada = (m, rot, periodo, s) => `${m.id}|${rot}|${periodo}|${s}`
  /** Faz (ou continua) uma camada; devolve true quando pronta. Cada chamada pinta no máximo ~18 ms de colunas. */
  function passoDaCamada(m, rot, periodo, s) {
    const chave = chaveDaCamada(m, rot, periodo, s)
    let L = camadas.get(chave)
    const P = N.preparo(m, rot)
    if (!L) {
      const luz = Pt.mapaDeLuz(m, periodo, 24)
      if (!luz.pronto) return false
      const met = P.met
      L = { chave, m, rot, periodo, s, canvas: Pt.tela(met.largura * s, met.altura * s), feito: 0, pronto: false, usado: performance.now() }
      camadas.set(chave, L)
      podarCamadas()
    }
    if (L.pronto) return true
    const g = L.canvas.getContext('2d')
    const inicio = performance.now()
    while (L.feito < P.ordem.length && performance.now() - inicio < 18) {
      const k1 = Math.min(P.ordem.length, L.feito + 24)
      Pt.pintarColunas(g, m, rot, periodo, s, L.feito, k1)
      L.feito = k1
    }
    if (L.feito < P.ordem.length) return false
    L.grade = Pt.tela(L.canvas.width, L.canvas.height)
    Pt.pintarGrade(L.grade.getContext('2d'), m, rot, periodo, s)
    if (m.c.some((c) => c.agua)) {
      L.agua = Pt.tela(L.canvas.width, L.canvas.height)
      Pt.pintarMascaraDaAgua(L.agua.getContext('2d'), m, rot, s)
    }
    L.pronto = true
    return true
  }
  function podarCamadas() {
    // guarda poucas camadas: a de agora, as 4 rotações na escala 1 e a última de cada escala
    let total = 0
    const lista = [...camadas.values()].sort((a, b) => b.usado - a.usado)
    for (const L of lista) {
      const px = L.canvas.width * L.canvas.height
      total += px
      if (total > 60e6 && !(L.s === 1 && L.m === est.mapa && L.periodo === est.periodo)) camadas.delete(L.chave)
    }
  }
  /** A melhor camada pronta para desenhar agora (a da escala certa, ou outra pronta enquanto aquela é pintada). */
  function camadaParaDesenhar() {
    const m = est.mapa
    const s = escalaPara(est.cam.zoom, m, est.rot)
    const certa = camadas.get(chaveDaCamada(m, est.rot, est.periodo, s))
    if (certa && certa.pronto) { certa.usado = performance.now(); return certa }
    enfileirar('cam:' + chaveDaCamada(m, est.rot, est.periodo, s), () => passoDaCamada(m, est.rot, est.periodo, s), true)
    let melhor = null
    for (const L of camadas.values()) {
      if (L.m !== m || L.rot !== est.rot || L.periodo !== est.periodo || !L.pronto) continue
      if (!melhor || Math.abs(L.s - s) < Math.abs(melhor.s - s)) melhor = L
    }
    return melhor
  }
  function prepararFundo() {
    // depois da primeira pintura: as outras 3 rotações e os outros períodos ficam prontos aos poucos
    const m = est.mapa
    for (let r = 1; r < 4; r++) {
      const rot = (est.rot + r) & 3
      enfileirar('cam:' + chaveDaCamada(m, rot, est.periodo, 1), () => passoDaCamada(m, rot, est.periodo, 1))
    }
  }

  // ---------- câmera ----------
  function medirTela() {
    const r = canvas.getBoundingClientRect()
    est.dpr = Math.min(3, window.devicePixelRatio || 1)
    est.cam.w = r.width
    est.cam.h = r.height
    canvas.width = Math.round(r.width * est.dpr)
    canvas.height = Math.round(r.height * est.dpr)
  }
  function enquadrar() {
    const met = N.preparo(est.mapa, est.rot).met
    const topo = met.oy - 3.2 * N.LH
    const alto = met.altura - topo
    est.cam.zoom = Math.max(0.45, Math.min(3, Math.min(est.cam.w / met.largura, est.cam.h / alto) * 0.97))
    est.cam.cx = met.largura / 2
    est.cam.cy = topo + alto / 2
    aoMudarZoom()
  }
  const ZOOM_MIN = 0.45
  const ZOOM_MAX = 3
  function zoomEm(z, sx, sy) {
    const novo = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z))
    const [lx, ly] = N.telaParaCamada(est.cam, sx, sy)
    est.cam.zoom = novo
    est.cam.cx = lx - (sx - est.cam.w / 2) / novo
    est.cam.cy = ly - (sy - est.cam.h / 2) / novo
    aoMudarZoom()
  }
  function aoMudarZoom() {
    $('z-valor').textContent = Math.round(est.cam.zoom * 100) + '%'
    $('z-menos').disabled = est.cam.zoom <= ZOOM_MIN + 1e-6
    $('z-mais').disabled = est.cam.zoom >= ZOOM_MAX - 1e-6
    marcasSujas = true
  }
  /** Gira 90° mantendo no centro da tela o mesmo ponto do mundo. Sem animação: é ação de teclado e de repetição. */
  function girar(d) {
    const m = est.mapa
    const i = N.blocoNoPonto(m, est.rot, est.cam.cx, est.cam.cy)
    let px = m.W / 2
    let py = m.H / 2
    let z = 1
    if (i >= 0) {
      px = (i % m.W) + 0.5
      py = ((i / m.W) | 0) + 0.5
      z = N.alturaEmPe(m.c[i])
    }
    est.rot = (est.rot + d + 4) & 3
    const [lx, ly] = N.pontoDoMundo(m, est.rot, px, py, z)
    est.cam.cx = lx
    est.cam.cy = ly
    marcasSujas = true
    aguaSuja = true
    $('rot-valor').textContent = ['Norte', 'Leste', 'Sul', 'Oeste'][est.rot]
    anunciar(`Câmera girada: vista ${['norte', 'leste', 'sul', 'oeste'][est.rot]}.`)
    prepararFundo()
  }

  // ---------- unidades e objetos ----------
  function posicaoDa(u) {
    const a = est.anims.get(u.id)
    if (a) return a.estado
    const c = N.cel(est.mapa, u.x, u.y)
    return { x: u.x + 0.5, y: u.y + 0.5, z: N.alturaEmPe(c), dir8: u.dir8 ?? [0, 1, 2, 3][u.dir] ?? 1, pose: 'parado', fase: 0, ex: 1, ey: 1 }
  }
  const objetosFixos = new Map()
  function objetosDoGiro(m, rot) {
    const k = m.id + '|' + rot
    if (objetosFixos.has(k)) return objetosFixos.get(k)
    const lista = m.props.map((p) => {
      const tp = N.PROPS[p.tipo]
      const z = N.alturaEmPe(N.cel(m, p.x, p.y))
      const q = N.quadroDoObjeto(m, rot, { x: p.x + 0.5, y: p.y + 0.5, z }, tp.w, tp.h, tp.r)
      q.occ = N.ocludentes(m, rot, q)
      return { tipo: 'prop', p, z, ...q }
    })
    objetosFixos.set(k, lista)
    return lista
  }
  function quadroDaUnidade(u) {
    const e = posicaoDa(u)
    const tp = N.TIPOS[u.tipo]
    const q = N.quadroDoObjeto(est.mapa, est.rot, e, tp.w, tp.h + 6, Math.min(0.42, Math.max(0.25, tp.w / 2 / N.ML / 2)))
    return { tipo: 'unidade', u, e, ...q }
  }
  function unidadeEm(i) {
    const m = est.mapa
    return m.unidades.find((u) => u.y * m.W + u.x === i && !est.anims.has(u.id)) || null
  }

  // ---------- regras e seleção ----------
  function calcularAlcance() {
    const u = est.sel
    if (!u) { est.alcance = null; return }
    const ocup = N.ocupadas(est.mapa, u)
    est.alcance = N.alcance(est.mapa, u.x, u.y, { mov: est.batalha ? u.mov : Infinity, degrau: est.degrau, ocupadas: ocup })
  }
  function selecionar(u) {
    est.sel = u
    est.previa = null
    calcularAlcance()
    marcasSujas = true
    atualizarPainel()
    if (u) {
      const n = contarAlcance()
      anunciar(est.batalha ? `${u.nome} selecionada: alcança ${n} blocos (movimento ${u.mov}).` : `${u.nome} selecionada. Toque num bloco para ela ir até lá.`)
    }
  }
  function contarAlcance() {
    if (!est.alcance) return 0
    let n = 0
    est.alcance.dist.forEach((d) => { if (d > 0) n++ })
    return n
  }
  function caminhoPara(i) {
    if (!est.sel || !est.alcance || i < 0) return null
    if (est.alcance.dist[i] <= 0) return null
    return N.caminhoAte(est.mapa, est.alcance, i)
  }
  function andar(u, caminho) {
    const plano = N.planoDeMovimento(est.mapa, caminho, { reduzido: reduzido() })
    const n = caminho.length - 1
    est.anims.set(u.id, { plano, inicio: performance.now(), estado: N.estadoNoTempo(plano, 0), n })
    const [fx, fy] = caminho[caminho.length - 1]
    u.rastro = caminho.map((c) => c.slice())
    u.x = fx
    u.y = fy
    est.previa = null
    est.alcance = null
    marcasSujas = true
    anunciar(`${u.nome} andando ${n} ${n === 1 ? 'bloco' : 'blocos'}…`)
  }
  function aoChegar(u, a) {
    est.anims.delete(u.id)
    u.dir8 = a.estado.dir8
    const n = a.n
    est.rotulos.push({ u, texto: `andou ${n} ${n === 1 ? 'bloco' : 'blocos'}`, inicio: performance.now() })
    est.ultimaChegada = { id: u.id, n, x: u.x, y: u.y }
    anunciar(`${u.nome} andou ${n} ${n === 1 ? 'bloco' : 'blocos'} e está em ${u.x}, ${u.y}.`)
    if (est.sel === u) calcularAlcance()
    marcasSujas = true
    atualizarPainel()
  }

  // ---------- marcas (alcance, caminho, área, cursor, rastro) ----------
  let marcasSujas = true
  let aguaSuja = true
  const marcasCache = { canvas: null, chave: '' }
  function montarMarcas() {
    const m = est.mapa
    const marcas = new Map()
    const por = (i, tipo) => {
      if (i < 0) return
      if (!marcas.has(i)) marcas.set(i, [])
      marcas.get(i).push(tipo)
    }
    if (est.rastro) for (const u of m.unidades) for (const [x, y] of u.rastro) por(y * m.W + x, 'rastro')
    if (est.ferramenta === 'mover' && est.sel && est.alcance && est.batalha) {
      est.alcance.dist.forEach((d, i) => { if (d > 0) por(i, 'alcance') })
    }
    if (est.previa) for (const [x, y] of est.previa.slice(1)) por(y * m.W + x, 'caminho')
    if (est.sel && est.ferramenta === 'mover') por(est.sel.y * m.W + est.sel.x, 'origem')
    const r = resultadoDaMedida()
    if (r && r.celulas) for (const [x, y] of r.celulas) por(y * m.W + x, 'area')
    if (r && r.a) por(r.a[1] * m.W + r.a[0], 'origem')
    const alvo = est.cursor >= 0 ? est.cursor : est.hover
    if (alvo >= 0) por(alvo, 'cursor')
    return marcas
  }
  function camadaDeMarcas(L) {
    const chave = `${L.chave}`
    if (!marcasSujas && marcasCache.chave === chave && marcasCache.canvas) return marcasCache.canvas
    if (!marcasCache.canvas || marcasCache.canvas.width !== L.canvas.width || marcasCache.canvas.height !== L.canvas.height) {
      marcasCache.canvas = Pt.tela(L.canvas.width, L.canvas.height)
    }
    const g = marcasCache.canvas.getContext('2d')
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.clearRect(0, 0, marcasCache.canvas.width, marcasCache.canvas.height)
    Pt.pintarMarcas(g, est.mapa, est.rot, L.s, montarMarcas())
    marcasCache.chave = chave
    marcasSujas = false
    return marcasCache.canvas
  }

  // ---------- medição ----------
  function resultadoDaMedida() {
    const f = est.ferramenta
    const md = est.medida
    if (f === 'mover' || !md.a) return null
    const m = est.mapa
    const b = md.b
    if (f === 'regua') {
      if (!b) return { a: md.a }
      const r = N.regua(m, md.a, b)
      const sobe = r.desnivel > 0 ? `sobe ${fmt(r.desnivel)}` : r.desnivel < 0 ? `desce ${fmt(-r.desnivel)}` : 'mesma altura'
      return { a: md.a, b, texto: `${r.blocos} ${r.blocos === 1 ? 'bloco' : 'blocos'} · ${sobe}`, linha: true, r }
    }
    if (f === 'circulo') {
      const raio = b ? Math.max(1, Math.min(12, Math.round(Math.hypot(b[0] - md.a[0], b[1] - md.a[1])))) : 1
      const cel = N.circulo(m, md.a, raio)
      return { a: md.a, celulas: cel, texto: `raio ${raio} · ${cel.length} blocos atingidos`, raio }
    }
    if (f === 'cone') {
      if (!b) return { a: md.a }
      const dir = N.direcao8(b[0] - md.a[0], b[1] - md.a[1])
      const L = Math.max(1, Math.min(12, Math.max(Math.abs(b[0] - md.a[0]), Math.abs(b[1] - md.a[1]))))
      const cel = N.cone(m, md.a, dir, L)
      return { a: md.a, celulas: cel, texto: `cone de ${L} ${L === 1 ? 'bloco' : 'blocos'} para ${['leste', 'sul', 'oeste', 'norte', 'sudeste', 'sudoeste', 'noroeste', 'nordeste'][dir]} · ${cel.length} blocos`, dir, L }
    }
    if (f === 'visao') {
      if (!b) return { a: md.a }
      const v = N.visao(m, md.a, b)
      const texto = v.livre ? 'Vê: nada barra a linha' : `Barrada por ${v.bloqueio.tipo} em ${v.bloqueio.x}, ${v.bloqueio.y} (altura ${v.bloqueio.h}; a linha passa a ${fmt(v.bloqueio.zLinha)})`
      return { a: md.a, b, texto, visao: v }
    }
    return null
  }
  const fmt = (n) => (Math.round(n * 10) / 10).toLocaleString('pt-BR')

  // ---------- desenho do quadro ----------
  let ultimoQuadro = 0
  const aguaCache = { canvas: null, quando: 0 }
  function quadro(agora) {
    requestAnimationFrame(quadro)
    if (ultimoQuadro) {
      est.quadros.push(agora - ultimoQuadro)
      if (est.quadros.length > 4000) est.quadros.splice(0, 2000)
    }
    ultimoQuadro = agora
    if (est.passeio) passear(agora)
    for (const u of est.mapa.unidades) {
      const a = est.anims.get(u.id)
      if (!a) continue
      a.estado = N.estadoNoTempo(a.plano, agora - a.inicio)
      if (a.estado.fim) aoChegar(u, a)
    }
    const L = camadaParaDesenhar()
    const cam = est.cam
    const dpr = est.dpr
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    const P = Pt.PERIODOS[est.periodo]
    const ceu = ctx.createLinearGradient(0, 0, 0, canvas.height)
    ceu.addColorStop(0, P.ceu[0])
    ceu.addColorStop(1, P.ceu[1])
    ctx.fillStyle = ceu
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    if (est.periodo === 'noite') estrelas()
    if (!L) return
    if (est.primeiraPintura === null && L.s >= 1) {
      est.primeiraPintura = performance.now() - t0Pagina
      document.documentElement.dataset.pronto = 'sim'
      setTimeout(prepararFundo, 0)
    }
    const k = L.s
    const mundo = () => ctx.setTransform(dpr * cam.zoom, 0, 0, dpr * cam.zoom, dpr * (cam.w / 2 - cam.cx * cam.zoom), dpr * (cam.h / 2 - cam.cy * cam.zoom))
    mundo()
    ctx.imageSmoothingEnabled = true
    const W = L.canvas.width / k
    const H = L.canvas.height / k
    ctx.drawImage(L.canvas, 0, 0, W, H)
    if (L.agua) desenharAgua(L, agora, mundo)
    if (est.batalha && L.grade) ctx.drawImage(L.grade, 0, 0, W, H)
    const marcas = camadaDeMarcas(L)
    const pulso = reduzido() ? 1 : 0.86 + 0.14 * Math.sin(agora / 420)
    ctx.globalAlpha = pulso
    ctx.drawImage(marcas, 0, 0, W, H)
    ctx.globalAlpha = 1
    // objetos e unidades na ordem de profundidade; depois de cada um, o que está na frente dele volta por cima
    const lista = objetosDoGiro(est.mapa, est.rot).slice()
    for (const u of est.mapa.unidades) {
      const q = quadroDaUnidade(u)
      q.occ = N.ocludentes(est.mapa, est.rot, q)
      lista.push(q)
    }
    N.ordenarObjetos(lista)
    const S = escalaPara(cam.zoom, est.mapa, est.rot)
    for (const o of lista) {
      if (o.ret[2] < (cam.cx - cam.w / 2 / cam.zoom) || o.ret[0] > cam.cx + cam.w / 2 / cam.zoom) continue
      if (o.tipo === 'prop') desenharProp(o, S, agora)
      else desenharUnidade(o, S, agora)
      if (o.occ.length) repor(L, marcas, o, W, H)
    }
    desenharLuzes(agora)
    desenharSobreposicoes(agora)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
  }
  function repor(L, marcas, o, W, H) {
    const P = N.preparo(est.mapa, est.rot)
    const [x0, y0, x1, y1] = o.ret
    ctx.save()
    ctx.beginPath()
    ctx.rect(x0 - 1, y0 - 1, x1 - x0 + 2, y1 - y0 + 2)
    ctx.clip()
    ctx.beginPath()
    for (const i of o.occ) for (const h of P.hex[i]) {
      ctx.moveTo(h[0][0], h[0][1])
      for (let k = 1; k < 6; k++) ctx.lineTo(h[k][0], h[k][1])
      ctx.closePath()
    }
    ctx.clip()
    ctx.drawImage(L.canvas, 0, 0, W, H)
    if (est.batalha && L.grade) ctx.drawImage(L.grade, 0, 0, W, H)
    ctx.drawImage(marcas, 0, 0, W, H)
    ctx.restore()
  }
  function estrelas() {
    ctx.fillStyle = 'rgba(230,236,255,0.7)'
    for (let k = 0; k < 60; k++) {
      const x = N.hash(k, 1, 5) * canvas.width
      const y = N.hash(k, 2, 5) * canvas.height * 0.5
      const r = (0.6 + N.hash(k, 3, 5)) * est.dpr * 0.7
      ctx.fillRect(x, y, r, r)
    }
  }
  function desenharAgua(L, agora, mundo) {
    // brilho que corre devagar, a 15 quadros por segundo, só onde a água aparece
    const cam = est.cam
    const dpr = est.dpr
    if (!aguaCache.canvas || aguaCache.canvas.width !== canvas.width || aguaCache.canvas.height !== canvas.height) {
      aguaCache.canvas = Pt.tela(canvas.width, canvas.height)
      aguaSuja = true
    }
    const passou = agora - aguaCache.quando
    const chaveCam = `${cam.cx.toFixed(1)}|${cam.cy.toFixed(1)}|${cam.zoom}|${est.rot}|${L.chave}`
    if (aguaSuja || aguaCache.chaveCam !== chaveCam || (!reduzido() && passou > 66)) {
      const g = aguaCache.canvas.getContext('2d')
      g.setTransform(1, 0, 0, 1, 0, 0)
      g.clearRect(0, 0, canvas.width, canvas.height)
      g.setTransform(dpr * cam.zoom, 0, 0, dpr * cam.zoom, dpr * (cam.w / 2 - cam.cx * cam.zoom), dpr * (cam.h / 2 - cam.cy * cam.zoom))
      const m = est.mapa
      const t = reduzido() ? 0 : agora / 1000
      g.lineCap = 'round'
      const noite = est.periodo === 'noite'
      for (let i = 0; i < m.c.length; i++) {
        if (!m.c[i].agua) continue
        const x = i % m.W
        const y = (i / m.W) | 0
        for (let k = 0; k < 3; k++) {
          const fase = N.hash(x * 3 + k, y, 7) * 6.283
          const a = 0.5 + 0.5 * Math.sin(t * 1.3 + fase)
          if (a < 0.25) continue
          const px = x + 0.15 + 0.7 * ((N.hash(x, y * 3 + k, 8) + t * 0.05) % 1)
          const py = y + 0.15 + 0.7 * N.hash(x + k, y, 9)
          const [sx, sy] = N.pontoDoMundo(m, est.rot, px, py, N.AGUA_Z)
          g.strokeStyle = noite ? `rgba(200,215,255,${(a * 0.35).toFixed(3)})` : `rgba(255,255,248,${(a * 0.55).toFixed(3)})`
          g.lineWidth = 1.4
          g.beginPath()
          g.moveTo(sx - 4, sy)
          g.lineTo(sx + 4, sy)
          g.stroke()
        }
      }
      g.setTransform(dpr * cam.zoom / L.s, 0, 0, dpr * cam.zoom / L.s, dpr * (cam.w / 2 - cam.cx * cam.zoom), dpr * (cam.h / 2 - cam.cy * cam.zoom))
      g.globalCompositeOperation = 'destination-in'
      g.drawImage(L.agua, 0, 0)
      g.globalCompositeOperation = 'source-over'
      aguaCache.quando = agora
      aguaCache.chaveCam = chaveCam
      aguaSuja = false
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.drawImage(aguaCache.canvas, 0, 0)
    mundo()
  }
  function sombraNoChao(px, py, zChao, rx, ry, alfa) {
    const m = est.mapa
    const [sx, sy] = N.pontoDoMundo(m, est.rot, px, py, zChao)
    const P = Pt.PERIODOS[est.periodo]
    ctx.fillStyle = `rgba(36,26,48,${alfa.toFixed(3)})`
    ctx.beginPath()
    ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2)
    ctx.fill()
    if (est.periodo === 'tarde') {
      // sombra comprida para o lado contrário do sol (no mundo), projetada na tela
      const comp = Math.min(1.3, 0.45 / Math.tan(P.elev))
      const [ex, ey] = N.pontoDoMundo(m, est.rot, px - Math.cos(P.az) * comp, py - Math.sin(P.az) * comp, zChao)
      ctx.strokeStyle = `rgba(70,34,40,${(alfa * 0.7).toFixed(3)})`
      ctx.lineWidth = ry * 1.5
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(ex, ey)
      ctx.stroke()
    }
  }
  function desenharProp(o, S, agora) {
    const p = o.p
    const eixo = (p.dir + est.rot) & 1 ? 'v' : 'u'
    const tp = N.PROPS[p.tipo]
    sombraNoChao(p.x + 0.5, p.y + 0.5, o.z, Math.min(26, tp.w * 0.32), Math.min(12, tp.w * 0.14), 0.24)
    const sp = Pt.spriteDoObjeto(p, eixo, S, est.periodo)
    ctx.drawImage(sp.c, o.sx - sp.ax, o.sy - sp.ay, sp.c.width / S, sp.c.height / S)
    if (p.tipo === 'palmeira') {
      // a copa balança de leve com o vento (parada com movimento reduzido)
      const v = p.variante || 0
      const inclina = [5, -7, 9][v % 3]
      const alto = [86, 80, 92][v % 3]
      const cp = Pt.spriteDaCopa(p, S, est.periodo)
      const ang = reduzido() ? 0 : Math.sin(agora / 1700 + p.x * 1.3 + p.y) * 0.035
      ctx.save()
      ctx.translate(o.sx + inclina, o.sy - alto)
      ctx.rotate(ang)
      ctx.drawImage(cp.c, -cp.ax, -cp.ay, cp.c.width / S, cp.c.height / S)
      ctx.restore()
    }
    if (est.periodo !== 'dia' && (p.tipo === 'tocha' || p.tipo === 'lampiao')) {
      const fl = reduzido() ? 1 : 0.9 + 0.1 * Math.sin(agora / 90 + p.x * 3) * Math.sin(agora / 37 + p.y)
      const [fx, fy] = p.tipo === 'tocha' ? [o.sx, o.sy - 38] : [o.sx, o.sy - 64]
      if (p.tipo === 'tocha') {
        ctx.fillStyle = Pt.PALETA.brasa
        ctx.beginPath()
        ctx.moveTo(fx - 6, fy + 3)
        ctx.quadraticCurveTo(fx - 5, fy - 9 * fl, fx, fy - 16 * fl)
        ctx.quadraticCurveTo(fx + 5, fy - 9 * fl, fx + 6, fy + 3)
        ctx.fill()
        ctx.fillStyle = Pt.PALETA.chama
        ctx.beginPath()
        ctx.moveTo(fx - 3, fy + 3)
        ctx.quadraticCurveTo(fx - 2, fy - 5 * fl, fx, fy - 10 * fl)
        ctx.quadraticCurveTo(fx + 2, fy - 5 * fl, fx + 3, fy + 3)
        ctx.fill()
      } else {
        ctx.fillStyle = Pt.PALETA.chama
        ctx.fillRect(fx - 4, fy - 5, 8, 9)
      }
    }
  }
  const QUADRO_DA_POSE = { parado: 0, agacha: 5, ar: 6, pousa: 5 }
  function desenharUnidade(o, S, agora) {
    const u = o.u
    const e = o.e
    const m = est.mapa
    const chao = N.alturaNoPonto(m, e.x, e.y)
    const acima = Math.max(0, e.z - chao)
    const tp = N.TIPOS[u.tipo]
    sombraNoChao(e.x, e.y, chao, (tp.w * 0.36) / (1 + acima * 0.6), (tp.w * 0.15) / (1 + acima * 0.6), 0.32 / (1 + acima))
    // anel do lado (aliado azul, inimigo vermelho)
    const [rx, ry] = N.pontoDoMundo(m, est.rot, e.x, e.y, chao)
    const cor = u.lado === 'aliado' ? Pt.PALETA.aliado : Pt.PALETA.inimigo
    ctx.strokeStyle = cor
    ctx.globalAlpha = est.sel === u ? 1 : 0.75
    ctx.lineWidth = est.sel === u ? 2.4 : 1.6
    ctx.beginPath()
    ctx.ellipse(rx, ry, tp.w * 0.42, tp.w * 0.19, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 1
    const vista = N.vistaDaDirecao(e.dir8, est.rot)
    let quadroN = QUADRO_DA_POSE[e.pose] ?? 0
    if (e.pose === 'anda') quadroN = 1 + (Math.floor(e.fase * 4) % 4)
    if (reduzido() && e.pose === 'anda') quadroN = 0
    const sp = Pt.spriteDaUnidade(u.tipo, vista.frente, quadroN, S, est.periodo)
    let ex = e.ex
    let ey = e.ey
    let bob = 0
    if (e.pose === 'parado' && !reduzido()) {
      const f = Math.sin(agora / 420 + u.x * 1.7 + u.y)
      ey = 1 + 0.014 * f
      ex = 1 - 0.006 * f
    }
    if (e.pose === 'anda' && !reduzido()) bob = Math.abs(Math.sin(e.fase * Math.PI * 2)) * 1.2
    const w = (sp.c.width / S) * ex
    const h = (sp.c.height / S) * ey
    ctx.save()
    ctx.translate(o.sx, o.sy - bob)
    if (vista.espelho) ctx.scale(-1, 1)
    ctx.drawImage(sp.c, -sp.ax * ex, -sp.ay * ey, w, h)
    // à noite, perto de um lampião, a luz quente volta a cor de dia por cima
    if (est.periodo !== 'dia') {
      const luz = Pt.luzNoPonto(m, Pt.PERIODOS[est.periodo], e.x, e.y, e.z + 1, 0, 0, 1).brilho
      const k = Math.min(0.75, (luz[0] + luz[1]) * 0.9)
      if (k > 0.02) {
        const dia = Pt.spriteDaUnidade(u.tipo, vista.frente, quadroN, S, 'dia')
        ctx.globalAlpha = k
        ctx.drawImage(dia.c, -dia.ax * ex, -dia.ay * ey, w, h)
        ctx.globalAlpha = 1
      }
    }
    ctx.restore()
    if (est.sel === u && !est.anims.has(u.id)) {
      // ponteiro sobre a cabeça, quicando de leve
      const q = reduzido() ? 0 : Math.abs(Math.sin(agora / 380)) * 3
      const y = o.sy - tp.h - 12 - q
      ctx.fillStyle = cor
      ctx.strokeStyle = '#fffaf0'
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.moveTo(o.sx - 6, y - 8)
      ctx.lineTo(o.sx + 6, y - 8)
      ctx.lineTo(o.sx, y)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
  }
  function desenharLuzes(agora) {
    if (est.periodo === 'dia') return
    const m = est.mapa
    ctx.globalCompositeOperation = 'lighter'
    for (const p of m.props) {
      if (p.tipo !== 'tocha' && p.tipo !== 'lampiao') continue
      const z = N.alturaEmPe(N.cel(m, p.x, p.y))
      const [sx, sy] = N.pontoDoMundo(m, est.rot, p.x + 0.5, p.y + 0.5, z)
      const fy = sy - (p.tipo === 'tocha' ? 42 : 64)
      const fl = reduzido() ? 1 : 0.92 + 0.08 * Math.sin(agora / 110 + p.x)
      const r = (est.periodo === 'noite' ? 46 : 26) * fl
      const g = ctx.createRadialGradient(sx, fy, 0, sx, fy, r)
      const a = est.periodo === 'noite' ? 0.42 : 0.18
      g.addColorStop(0, `rgba(255,190,110,${a})`)
      g.addColorStop(1, 'rgba(255,150,70,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(sx, fy, r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalCompositeOperation = 'source-over'
  }
  function pontoAlto(x, y, extra = 0.04) {
    return N.pontoDoMundo(est.mapa, est.rot, x + 0.5, y + 0.5, N.alturaEmPe(N.cel(est.mapa, x, y)) + extra)
  }
  function pilula(texto, x, y, cor = 'rgba(28,30,40,0.86)') {
    ctx.font = '600 12px Barlow, system-ui, sans-serif'
    const w = ctx.measureText(texto).width + 16
    ctx.fillStyle = cor
    ctx.beginPath()
    ctx.roundRect(x - w / 2, y - 11, w, 22, 11)
    ctx.fill()
    ctx.fillStyle = '#fbf6ea'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(texto, x, y + 0.5)
  }
  function desenharSobreposicoes(agora) {
    const m = est.mapa
    // cursor escondido atrás de algo: contorno tracejado por cima de tudo
    const alvo = est.cursor >= 0 ? est.cursor : est.hover
    if (alvo >= 0) {
      const x = alvo % m.W
      const y = (alvo / m.W) | 0
      const [lx, ly] = N.pontoDoBloco(m, est.rot, x, y)
      if (N.blocoNoPonto(m, est.rot, lx, ly) !== alvo) {
        const P = N.preparo(m, est.rot)
        ctx.setLineDash([4, 3])
        ctx.strokeStyle = 'rgba(255,255,255,0.95)'
        ctx.lineWidth = 1.6
        for (const b of P.caixas[alvo]) {
          const pts = [[b.u0, b.v0], [b.u1, b.v0], [b.u1, b.v1], [b.u0, b.v1]].map(([u, v]) => N.proj(P.met, u, v, b.z))
          ctx.beginPath()
          ctx.moveTo(...pts[0])
          for (let k = 1; k < 4; k++) ctx.lineTo(...pts[k])
          ctx.closePath()
          ctx.stroke()
        }
        ctx.setLineDash([])
      }
    }
    // caminho: linha por cima dos blocos e a contagem no destino
    const cam = est.previa
    if (cam && cam.length > 1) {
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      const pts = cam.map(([x, y]) => pontoAlto(x, y, 0.06))
      for (const [cor, w] of [['rgba(30,60,120,0.55)', 5], ['#fbf8ee', 2.4]]) {
        ctx.strokeStyle = cor
        ctx.lineWidth = w
        ctx.beginPath()
        ctx.moveTo(...pts[0])
        for (const p of pts.slice(1)) ctx.lineTo(...p)
        ctx.stroke()
      }
      const fim = pts[pts.length - 1]
      const n = cam.length - 1
      pilula(`${n} ${n === 1 ? 'bloco' : 'blocos'}`, fim[0], fim[1] - 30, 'rgba(36,72,150,0.92)')
    }
    // rastro: o número de cada passo
    if (est.rastro) {
      for (const u of m.unidades) {
        if (u.rastro.length < 2) continue
        u.rastro.forEach(([x, y], k) => {
          if (!k) return
          const [sx, sy] = pontoAlto(x, y, 0.05)
          ctx.font = '700 11px Barlow, system-ui, sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = 'rgba(80,52,10,0.85)'
          ctx.fillText(String(k), sx, sy + 0.5)
        })
      }
    }
    // medição
    const r = resultadoDaMedida()
    if (r) {
      const [ax, ay] = r.visao ? N.pontoDoMundo(m, est.rot, r.a[0] + 0.5, r.a[1] + 0.5, r.visao.za) : pontoAlto(r.a[0], r.a[1], 0.08)
      if (r.b && (r.linha || r.visao)) {
        const [bx, by] = r.visao ? N.pontoDoMundo(m, est.rot, r.b[0] + 0.5, r.b[1] + 0.5, r.visao.zb) : pontoAlto(r.b[0], r.b[1], 0.08)
        ctx.lineCap = 'round'
        if (r.visao && !r.visao.livre) {
          const f = r.visao.bloqueio.f
          const mx = ax + (bx - ax) * f
          const my = ay + (by - ay) * f
          linha(ax, ay, mx, my, '#e9fbe7', 'rgba(40,110,60,0.7)')
          linha(mx, my, bx, by, '#ffd9d2', 'rgba(150,40,30,0.75)', true)
          ctx.fillStyle = '#d4644f'
          ctx.strokeStyle = '#fffaf0'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(mx, my, 5, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
        } else {
          linha(ax, ay, bx, by, r.visao ? '#e9fbe7' : '#fbf8ee', r.visao ? 'rgba(40,110,60,0.7)' : 'rgba(30,40,60,0.6)', !r.visao)
        }
        for (const [px, py] of [[ax, ay], [bx, by]]) {
          ctx.fillStyle = '#fbf8ee'
          ctx.beginPath()
          ctx.arc(px, py, 3.2, 0, Math.PI * 2)
          ctx.fill()
        }
        if (r.texto) pilula(r.texto, (ax + bx) / 2, Math.min(ay, by) - 22, r.visao && !r.visao.livre ? 'rgba(150,50,40,0.92)' : 'rgba(28,30,40,0.86)')
      } else if (r.texto) {
        pilula(r.texto, ax, ay - 34)
      }
    }
    // "andou N blocos" sobre a unidade que chegou: entra rápido (200 ms), fica, sai (300 ms)
    est.rotulos = est.rotulos.filter((l) => agora - l.inicio < 2100)
    for (const l of est.rotulos) {
      const t = agora - l.inicio
      const ent = Math.min(1, t / 200)
      const ease = 1 - Math.pow(1 - ent, 3)
      const sai = t > 1800 ? 1 - (t - 1800) / 300 : 1
      const [sx, sy] = pontoAlto(l.u.x, l.u.y, 0)
      const tp = N.TIPOS[l.u.tipo]
      ctx.globalAlpha = Math.max(0, ease * sai)
      pilula(l.texto, sx, sy - tp.h - 22 + (reduzido() ? 0 : (1 - ease) * 6))
      ctx.globalAlpha = 1
    }
  }
  function linha(ax, ay, bx, by, cor, fundo, tracejada) {
    ctx.lineCap = 'round'
    ctx.strokeStyle = fundo
    ctx.lineWidth = 5
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(ax, ay)
    ctx.lineTo(bx, by)
    ctx.stroke()
    ctx.strokeStyle = cor
    ctx.lineWidth = 2.2
    if (tracejada) ctx.setLineDash([7, 5])
    ctx.beginPath()
    ctx.moveTo(ax, ay)
    ctx.lineTo(bx, by)
    ctx.stroke()
    ctx.setLineDash([])
  }

  // ---------- entrada ----------
  function pontoNoCanvas(ev) {
    const r = canvas.getBoundingClientRect()
    return [ev.clientX - r.left, ev.clientY - r.top]
  }
  /** O que está sob o ponto da tela: primeiro uma unidade (pelo desenho), senão o bloco. */
  function alvoNaTela(sx, sy) {
    const [lx, ly] = N.telaParaCamada(est.cam, sx, sy)
    const m = est.mapa
    const qs = m.unidades.filter((u) => !est.anims.has(u.id)).map(quadroDaUnidade)
    N.ordenarObjetos(qs).reverse()
    for (const q of qs) {
      const [x0, y0, x1, y1] = q.ret
      if (lx >= x0 + 6 && lx <= x1 - 6 && ly >= y0 + 8 && ly <= y1) {
        // a unidade só conta se não estiver escondida atrás de uma coluna nesse ponto
        const i = N.blocoNoPonto(m, est.rot, lx, ly)
        const P = N.preparo(m, est.rot)
        const coberta = i >= 0 && q.occ === undefined && N.ocludentes(m, est.rot, q).includes(i) && N.dentroDoConvexo(P.hex[i][0], lx, ly)
        if (!coberta) return { unidade: q.u, i: q.u.y * m.W + q.u.x }
      }
    }
    return { unidade: null, i: N.blocoNoPonto(m, est.rot, lx, ly) }
  }
  function aoPassar(i) {
    if (i === est.hover) return
    est.hover = i
    est.cursor = -1
    marcasSujas = true
    atualizarSob(i)
    const md = est.medida
    if (est.ferramenta !== 'mover' && md.a && !md.fixo && i >= 0) md.b = [i % est.mapa.W, (i / est.mapa.W) | 0]
    if (est.ferramenta === 'mover' && est.sel && !est.anims.has(est.sel.id)) est.previa = caminhoPara(i)
    atualizarLeitura()
  }
  function atualizarSob(i) {
    const m = est.mapa
    const chip = $('sob')
    if (i < 0) { chip.textContent = 'Aponte um bloco: posição e altura'; return }
    const c = m.c[i]
    const nomes = { areia: 'areia', terra: 'terra batida', calcada: 'calçada', laje: 'laje', grama: 'grama', musgo: 'pedra com musgo', pedra: 'piso de pedra', telhado: 'telhado', ruina: 'muro de ruína', degrau: 'escada', agua: 'água', rocha: 'rocha' }
    const alt = c.escada >= 0 ? `${fmt(c.h - 1)} a ${c.h}` : c.agua ? '0' : String(c.h)
    chip.textContent = `${i % m.W}, ${(i / m.W) | 0} · altura ${alt} · ${nomes[c.topo] || c.topo}`
  }
  function clicar(alvo) {
    const m = est.mapa
    const { unidade, i } = alvo
    if (i < 0) return
    const x = i % m.W
    const y = (i / m.W) | 0
    if (est.ferramenta !== 'mover') {
      const md = est.medida
      if (!md.a || md.fixo) { est.medida = { a: [x, y], b: est.ferramenta === 'circulo' ? null : null, fixo: false } }
      else { md.b = [x, y]; md.fixo = true }
      marcasSujas = true
      atualizarLeitura()
      const r = resultadoDaMedida()
      anunciar(r && r.texto ? r.texto : 'Primeiro ponto marcado. Escolha o segundo.')
      return
    }
    if (unidade && !est.anims.has(unidade.id)) {
      selecionar(est.sel === unidade ? null : unidade)
      if (!est.sel) anunciar('Seleção desfeita.')
      return
    }
    if (est.sel && !est.anims.has(est.sel.id)) {
      const cam = caminhoPara(i)
      if (cam) { andar(est.sel, cam); return }
      const ocupada = m.unidades.some((u) => u.y * m.W + u.x === i)
      anunciar(ocupada ? 'Esse bloco está ocupado.' : est.batalha ? `Fora do alcance de ${est.sel.nome}.` : 'Não há caminho até esse bloco.')
      return
    }
    anunciar(`Bloco ${x}, ${y}. Toque numa unidade para ver o alcance.`)
  }
  const ponteiros = new Map()
  let pinca = null
  canvas.addEventListener('pointerdown', (ev) => {
    canvas.focus({ preventScroll: true })
    canvas.setPointerCapture(ev.pointerId)
    const [sx, sy] = pontoNoCanvas(ev)
    ponteiros.set(ev.pointerId, { sx, sy })
    if (ponteiros.size === 2) {
      const [a, b] = [...ponteiros.values()]
      pinca = { d: Math.hypot(a.sx - b.sx, a.sy - b.sy), zoom: est.cam.zoom }
      est.arraste = null
      return
    }
    if (ponteiros.size > 2) return
    const alvo = alvoNaTela(sx, sy)
    est.arraste = { id: ev.pointerId, sx, sy, cx: est.cam.cx, cy: est.cam.cy, alvo, modo: null, tipo: ev.pointerType }
  })
  canvas.addEventListener('pointermove', (ev) => {
    const [sx, sy] = pontoNoCanvas(ev)
    if (ponteiros.has(ev.pointerId)) ponteiros.set(ev.pointerId, { sx, sy })
    if (pinca && ponteiros.size === 2) {
      const [a, b] = [...ponteiros.values()]
      const d = Math.hypot(a.sx - b.sx, a.sy - b.sy)
      zoomEm(pinca.zoom * (d / Math.max(1, pinca.d)), (a.sx + b.sx) / 2, (a.sy + b.sy) / 2)
      return
    }
    const a = est.arraste
    if (a && a.id === ev.pointerId) {
      const dist = Math.hypot(sx - a.sx, sy - a.sy)
      if (!a.modo && dist > 6) {
        const pode = est.ferramenta === 'mover' && a.alvo.unidade && !est.anims.has(a.alvo.unidade.id)
        a.modo = pode ? 'unidade' : 'mapa'
        if (pode) {
          selecionar(a.alvo.unidade)
          canvas.dataset.arrastando = 'unidade'
        } else canvas.dataset.arrastando = 'mapa'
      }
      if (a.modo === 'mapa') {
        est.cam.cx = a.cx - (sx - a.sx) / est.cam.zoom
        est.cam.cy = a.cy - (sy - a.sy) / est.cam.zoom
        return
      }
      if (a.modo === 'unidade') {
        // a unidade encaixa no bloco sob o dedo: o caminho e a contagem aparecem durante o arraste
        const { i } = alvoNaTelaSemUnidade(sx, sy)
        aoPassar(i)
        return
      }
    }
    if (ev.pointerType === 'mouse' && !ev.buttons) aoPassar(alvoNaTelaSemUnidade(sx, sy).i)
  })
  function alvoNaTelaSemUnidade(sx, sy) {
    const [lx, ly] = N.telaParaCamada(est.cam, sx, sy)
    return { i: N.blocoNoPonto(est.mapa, est.rot, lx, ly) }
  }
  function soltar(ev) {
    ponteiros.delete(ev.pointerId)
    if (pinca) {
      if (ponteiros.size < 2) pinca = null
      est.arraste = null
      return
    }
    const a = est.arraste
    if (!a || a.id !== ev.pointerId) return
    est.arraste = null
    delete canvas.dataset.arrastando
    if (ev.type === 'pointercancel') return
    if (!a.modo) {
      if (a.tipo !== 'mouse') aoPassar(a.alvo.i)
      clicar(a.alvo)
      return
    }
    if (a.modo === 'unidade') {
      const [sx, sy] = pontoNoCanvas(ev)
      const { i } = alvoNaTelaSemUnidade(sx, sy)
      const cam = caminhoPara(i)
      if (cam) andar(est.sel, cam)
      else if (i !== est.sel.y * est.mapa.W + est.sel.x) anunciar('Ali ela não chega: a unidade voltou ao lugar.')
      est.previa = null
      marcasSujas = true
    }
  }
  canvas.addEventListener('pointerup', soltar)
  canvas.addEventListener('pointercancel', soltar)
  canvas.addEventListener('pointerleave', (ev) => {
    if (ev.pointerType === 'mouse' && !est.arraste) aoPassar(-1)
  })
  canvas.addEventListener('wheel', (ev) => {
    ev.preventDefault()
    const [sx, sy] = pontoNoCanvas(ev)
    zoomEm(est.cam.zoom * Math.exp(-ev.deltaY * 0.0015), sx, sy)
  }, { passive: false })
  canvas.addEventListener('keydown', (ev) => {
    const m = est.mapa
    const k = ev.key
    if (k === 'q' || k === 'Q') { girar(-1); ev.preventDefault(); return }
    if (k === 'e' || k === 'E') { girar(1); ev.preventDefault(); return }
    if (k === '+' || k === '=') { zoomEm(est.cam.zoom * 1.2, est.cam.w / 2, est.cam.h / 2); return }
    if (k === '-') { zoomEm(est.cam.zoom / 1.2, est.cam.w / 2, est.cam.h / 2); return }
    if (k === 'Escape') {
      if (est.ferramenta !== 'mover' && est.medida.a) { est.medida = { a: null, b: null, fixo: false }; anunciar('Medição cancelada.') }
      else if (est.sel) { selecionar(null); anunciar('Seleção desfeita.') }
      est.previa = null
      marcasSujas = true
      atualizarLeitura()
      return
    }
    const setas = { ArrowUp: 3, ArrowRight: 0, ArrowDown: 1, ArrowLeft: 2 }
    if (k in setas) {
      ev.preventDefault()
      // as setas andam pelos eixos da tela isométrica: cima = -v, direita = +u (girado de volta para o mundo)
      const dr = setas[k]
      const dw = (dr - est.rot + 4) & 3
      let i = est.cursor >= 0 ? est.cursor : est.hover >= 0 ? est.hover : est.sel ? est.sel.y * m.W + est.sel.x : ((m.H / 2) | 0) * m.W + ((m.W / 2) | 0)
      const x = Math.max(0, Math.min(m.W - 1, (i % m.W) + N.DX[dw]))
      const y = Math.max(0, Math.min(m.H - 1, ((i / m.W) | 0) + N.DY[dw]))
      i = y * m.W + x
      est.hover = -1
      aoPassar(i)
      est.cursor = i
      est.hover = -1
      marcasSujas = true
      return
    }
    if (k === 'Enter' || k === ' ') {
      ev.preventDefault()
      const i = est.cursor >= 0 ? est.cursor : est.hover
      if (i < 0) return
      clicar({ unidade: unidadeEm(i), i })
    }
  })

  // ---------- controles ----------
  function anunciar(t) {
    $('estado').textContent = t
  }
  function grupoDeRadio(id, aoEscolher) {
    const g = $(id)
    const bs = [...g.querySelectorAll('[role="radio"]')]
    const marcar = (b, foco) => {
      for (const o of bs) {
        const sim = o === b
        o.setAttribute('aria-checked', String(sim))
        o.tabIndex = sim ? 0 : -1
      }
      if (foco) b.focus()
      aoEscolher(b.dataset.valor)
    }
    bs.forEach((b, k) => {
      b.addEventListener('click', () => marcar(b, false))
      b.addEventListener('keydown', (ev) => {
        const d = ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? 1 : ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? -1 : 0
        if (!d) return
        ev.preventDefault()
        marcar(bs[(k + d + bs.length) % bs.length], true)
      })
    })
    return { escolher: (v) => { const b = bs.find((o) => o.dataset.valor === v); if (b) marcar(b, false) } }
  }
  const grupoMapa = grupoDeRadio('g-mapa', (v) => trocarMapa(v))
  const grupoHora = grupoDeRadio('g-hora', (v) => {
    if (est.periodo === v) return
    est.periodo = v
    aguaSuja = true
    marcasSujas = true
    anunciar(`${Pt.PERIODOS[v].nome}: ${v === 'dia' ? 'sol alto, sombras curtas' : v === 'tarde' ? 'sol baixo, sombras longas e quentes' : 'luar azulado, lampiões e braseiros acesos'}.`)
    prepararFundo()
  })
  const grupoFerramenta = grupoDeRadio('g-ferramenta', (v) => {
    est.ferramenta = v
    est.medida = { a: null, b: null, fixo: false }
    est.previa = null
    marcasSujas = true
    canvas.dataset.ferramenta = v
    atualizarLeitura()
    const dicas = { mover: 'Mover: toque numa unidade e depois no destino.', regua: 'Régua: toque no primeiro bloco e depois no segundo.', circulo: 'Círculo: toque no centro; o raio segue o ponteiro até o segundo toque.', cone: 'Cone: toque na origem; a direção e o comprimento seguem o ponteiro.', visao: 'Linha de visão: toque em quem olha e depois no alvo.' }
    anunciar(dicas[v])
  })
  const grupoDegrau = grupoDeRadio('g-degrau', (v) => {
    est.degrau = Number(v)
    calcularAlcance()
    marcasSujas = true
    atualizarPainel()
  })
  void grupoHora; void grupoFerramenta; void grupoDegrau
  $('b-batalha').addEventListener('click', () => {
    est.batalha = !est.batalha
    $('b-batalha').setAttribute('aria-pressed', String(est.batalha))
    calcularAlcance()
    marcasSujas = true
    anunciar(est.batalha ? 'Modo batalha: grade ligada; a unidade selecionada mostra o alcance de movimento.' : 'Modo livre: sem grade; a unidade anda até qualquer bloco que tenha caminho.')
  })
  $('b-rastro').addEventListener('click', () => {
    est.rastro = !est.rastro
    $('b-rastro').setAttribute('aria-pressed', String(est.rastro))
    marcasSujas = true
    const n = est.mapa.unidades.filter((u) => u.rastro.length > 1).length
    anunciar(est.rastro ? (n ? `Caminho andado de ${n} ${n === 1 ? 'unidade' : 'unidades'}, numerado passo a passo.` : 'Caminho andado: nenhuma unidade andou ainda.') : 'Caminho andado escondido.')
  })
  $('rot-esq').addEventListener('click', () => girar(-1))
  $('rot-dir').addEventListener('click', () => girar(1))
  $('z-menos').addEventListener('click', () => zoomEm(est.cam.zoom / 1.25, est.cam.w / 2, est.cam.h / 2))
  $('z-mais').addEventListener('click', () => zoomEm(est.cam.zoom * 1.25, est.cam.w / 2, est.cam.h / 2))
  $('z-valor').addEventListener('click', () => zoomEm(1, est.cam.w / 2, est.cam.h / 2))
  $('z-enquadrar').addEventListener('click', enquadrar)
  const TEMAS = ['auto', 'light', 'dark']
  $('b-tema').addEventListener('click', () => {
    const atual = document.documentElement.dataset.theme || 'auto'
    const prox = TEMAS[(TEMAS.indexOf(atual) + 1) % 3]
    if (prox === 'auto') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = prox
    $('b-tema').textContent = { auto: 'Tema: automático', light: 'Tema: claro', dark: 'Tema: escuro' }[prox]
  })

  function trocarMapa(id) {
    if (est.mapa.id === id) return
    est.mapa = MAPAS[id]
    est.sel = null
    est.alcance = null
    est.previa = null
    est.hover = -1
    est.cursor = -1
    est.medida = { a: null, b: null, fixo: false }
    est.anims.clear()
    marcasSujas = true
    aguaSuja = true
    enquadrar()
    montarListaDeUnidades()
    atualizarPainel()
    anunciar(`${est.mapa.nome}.`)
    prepararFundo()
  }
  function montarListaDeUnidades() {
    const box = $('unidades')
    box.textContent = ''
    for (const u of est.mapa.unidades) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'unidade'
      b.dataset.lado = u.lado
      b.dataset.id = u.id
      const s = Pt.spriteDaUnidade(u.tipo, true, 0, 2, 'dia')
      const mini = document.createElement('canvas')
      mini.width = 64
      mini.height = 64
      const g = mini.getContext('2d')
      const k = Math.min(64 / s.c.width, 64 / s.c.height) * 1.0
      g.drawImage(s.c, (64 - s.c.width * k) / 2, 64 - s.c.height * k, s.c.width * k, s.c.height * k)
      mini.setAttribute('aria-hidden', 'true')
      const txt = document.createElement('span')
      txt.innerHTML = `${u.nome}<small>${u.lado === 'aliado' ? 'Aliada' : 'Inimiga'} · movimento ${u.mov}</small>`
      b.append(mini, txt)
      b.addEventListener('click', () => {
        if (est.ferramenta !== 'mover') grupoFerramenta.escolher('mover')
        selecionar(est.sel === u ? null : u)
        canvas.focus({ preventScroll: true })
      })
      box.append(b)
    }
  }
  function atualizarPainel() {
    for (const b of document.querySelectorAll('.unidade')) b.setAttribute('aria-pressed', String(!!est.sel && b.dataset.id === est.sel.id))
    const u = est.sel
    $('sel-nome').textContent = u ? u.nome : 'Nenhuma unidade'
    $('sel-info').textContent = u
      ? `${u.lado === 'aliado' ? 'Aliada' : 'Inimiga'} · em ${u.x}, ${u.y}, altura ${fmt(N.alturaEmPe(N.cel(est.mapa, u.x, u.y)))} · ${est.batalha ? `alcança ${contarAlcance()} blocos (movimento ${u.mov}, degrau ${est.degrau})` : 'modo livre'}`
      : 'Toque numa unidade no mapa ou na lista.'
  }
  function atualizarLeitura() {
    const r = resultadoDaMedida()
    const el = $('leitura')
    if (est.ferramenta === 'mover') {
      el.textContent = est.previa ? `Caminho de ${est.previa.length - 1} ${est.previa.length === 2 ? 'bloco' : 'blocos'} até ${est.previa[est.previa.length - 1].join(', ')}.` : ''
      return
    }
    el.textContent = r && r.texto ? r.texto : est.medida.a ? 'Escolha o segundo ponto.' : 'Escolha o primeiro ponto.'
  }

  // ---------- passeio automático (só para a prova de desempenho) ----------
  function passear() {
    const m = est.mapa
    const sorte = est.sortePasseio || (est.sortePasseio = N.rng(99))
    for (const u of m.unidades) {
      if (est.anims.has(u.id)) continue
      const r = N.alcance(m, u.x, u.y, { mov: 4, degrau: 2, ocupadas: N.ocupadas(m, u) })
      const op = []
      r.dist.forEach((d, i) => { if (d > 1) op.push(i) })
      if (!op.length) continue
      const j = op[Math.floor(sorte() * op.length)]
      andar(u, N.caminhoAte(m, r, j))
    }
  }

  // ---------- folha de contato e amostras do salto (provas) ----------
  function cenaDeTira() {
    const m = { id: 'tira', nome: 'tira', W: 4, H: 1, c: [1, 1, 2, 2].map((h) => ({ h, chao: h, topo: 'calcada', lado: 'muro', escada: -1, predio: -1, agua: false })), props: [], unidades: [], predios: [], portas: [], propEm: new Int32Array(4).fill(-1), _cache: {} }
    return m
  }
  function folhaDeContato(tipo, quadros = 16) {
    const m = cenaDeTira()
    const plano = N.planoDeMovimento(m, [[0, 0], [1, 0], [2, 0], [3, 0]], {})
    const salto = plano.segs[1]
    const fases = [
      { nome: 'Andar (2 blocos planos e 1 depois do salto)', ini: 0, fim: plano.segs[0].dur * 1 + 0.001, extra: plano.segs[2] },
      { nome: 'Salto (sobe 1 nível)', ini: salto.t0, fim: salto.t0 + salto.dur },
    ]
    const cw = 150
    const ch = 150
    const folha = Pt.tela(cw * 8, (ch + 22) * 4 + 40)
    folha.id = 'folha-' + tipo
    const g = folha.getContext('2d')
    g.fillStyle = '#f4f1e8'
    g.fillRect(0, 0, folha.width, folha.height)
    const camada = Pt.tela(N.preparo(m, 0).met.largura * 2, N.preparo(m, 0).met.altura * 2)
    Pt.pintarColunas(camada.getContext('2d'), m, 0, 'dia', 2, 0, 4)
    let linha = 0
    for (const f of fases) {
      g.fillStyle = '#2b2f2a'
      g.font = '600 15px Barlow, system-ui, sans-serif'
      g.textAlign = 'left'
      g.fillText(f.nome, 8, 20 + linha * (ch + 22) + (linha ? 10 : 0))
      for (let k = 0; k < quadros; k++) {
        const t = f.ini + ((f.fim - f.ini) * k) / (quadros - 1)
        const e = N.estadoNoTempo(plano, t)
        const col = k % 8
        const row = linha + Math.floor(k / 8)
        const ox = col * cw
        const oy = 30 + row * (ch + 22) + (linha ? 10 : 0)
        const [px, py] = N.pontoDoMundo(m, 0, e.x, e.y, e.z)
        g.save()
        g.beginPath()
        g.rect(ox + 2, oy, cw - 4, ch)
        g.clip()
        const zoom = 1.1
        g.setTransform(zoom, 0, 0, zoom, ox + cw / 2 - px * zoom, oy + ch * 0.72 - py * zoom)
        g.drawImage(camada, 0, 0, camada.width / 2, camada.height / 2)
        const chao = N.alturaNoPonto(m, e.x, e.y)
        const [gx, gy] = N.pontoDoMundo(m, 0, e.x, e.y, chao)
        g.fillStyle = 'rgba(36,26,48,0.3)'
        g.beginPath()
        g.ellipse(gx, gy, 14 / (1 + (e.z - chao) * 0.6), 6 / (1 + (e.z - chao) * 0.6), 0, 0, Math.PI * 2)
        g.fill()
        const vista = N.vistaDaDirecao(e.dir8, 0)
        const qn = e.pose === 'anda' ? 1 + (Math.floor(e.fase * 4) % 4) : QUADRO_DA_POSE[e.pose] ?? 0
        const sp = Pt.spriteDaUnidade(tipo, vista.frente, qn, 2, 'dia')
        g.translate(px, py)
        if (vista.espelho) g.scale(-1, 1)
        g.drawImage(sp.c, -sp.ax * e.ex, -sp.ay * e.ey, (sp.c.width / 2) * e.ex, (sp.c.height / 2) * e.ey)
        g.restore()
        g.fillStyle = '#3a3f39'
        g.font = '500 12px Barlow, system-ui, sans-serif'
        g.textAlign = 'center'
        g.fillText(`${Math.round(t)} ms · ${e.pose}`, ox + cw / 2, oy + ch + 14)
      }
      linha += 2
    }
    folha.style.cssText = 'position:fixed;left:0;top:0;z-index:99'
    document.body.append(folha)
    return folha.id
  }
  function amostrasDoSalto(passoMs = 1000 / 60) {
    const m = cenaDeTira()
    const plano = N.planoDeMovimento(m, [[1, 0], [2, 0]], {})
    const s = plano.segs[0]
    const out = []
    for (let t = 0; t <= plano.total + 1e-9; t += passoMs) {
      const e = N.estadoNoTempo(plano, Math.min(t, plano.total - 1e-6))
      out.push({ t: Math.round(t * 10) / 10, x: e.x, z: e.z, ey: e.ey, pose: e.pose })
    }
    return { amostras: out, seg: { agacha: s.agacha, ar: s.ar, pousa: s.pousa, az: s.az, bz: s.bz, arco: s.arco } }
  }

  // ---------- API das provas ----------
  window.Batalha = {
    N, Pt, est,
    pronto: () => est.primeiraPintura !== null && !fila.length,
    filaVazia: () => !fila.length,
    projetar(x, y) {
      const [lx, ly] = N.pontoDoBloco(est.mapa, est.rot, x, y)
      const [sx, sy] = N.camadaParaTela(est.cam, lx, ly)
      const r = canvas.getBoundingClientRect()
      return [sx + r.left, sy + r.top]
    },
    projetarMundo(px, py, z) {
      const [lx, ly] = N.pontoDoMundo(est.mapa, est.rot, px, py, z)
      const [sx, sy] = N.camadaParaTela(est.cam, lx, ly)
      const r = canvas.getBoundingClientRect()
      return [sx + r.left, sy + r.top]
    },
    blocoNaTela(cx, cy) {
      const r = canvas.getBoundingClientRect()
      const [lx, ly] = N.telaParaCamada(est.cam, cx - r.left, cy - r.top)
      return N.blocoNoPonto(est.mapa, est.rot, lx, ly)
    },
    girar, enquadrar, zoomEm: (z) => zoomEm(z, est.cam.w / 2, est.cam.h / 2),
    centrarEm(x, y) {
      const [lx, ly] = N.pontoDoBloco(est.mapa, est.rot, x, y)
      est.cam.cx = lx
      est.cam.cy = ly
    },
    selecionarPorId(id) { selecionar(est.mapa.unidades.find((u) => u.id === id) || null) },
    carregarMapaDeTeste(n) {
      MAPAS['teste' + n] = MAPAS['teste' + n] || N.mapaDeTeste(n)
      est.mapa = MAPAS['teste' + n]
      est.sel = null
      est.anims.clear()
      marcasSujas = true
      enquadrar()
      prepararFundo()
    },
    passeio(on) { est.passeio = on },
    animando: () => est.anims.size > 0,
    zerarQuadros() { est.quadros = [] },
    folhaDeContato, amostrasDoSalto,
  }

  // ---------- partida ----------
  medirTela()
  enquadrar()
  // começa mais perto que o "ver tudo" (as unidades precisam ser lidas), sem passar de 110%
  zoomEm(Math.min(1.1, est.cam.zoom * 1.5), est.cam.w / 2, est.cam.h / 2)
  montarListaDeUnidades()
  atualizarPainel()
  atualizarSob(-1)
  new ResizeObserver(() => { medirTela(); aguaSuja = true }).observe(canvas)
  // primeira pintura: luz, atlas e camada do giro atual entram na frente da fila
  const m0 = est.mapa
  const s0 = escalaPara(est.cam.zoom, m0, 0)
  enfileirar('cam:' + chaveDaCamada(m0, 0, 'dia', s0), () => passoDaCamada(m0, 0, 'dia', s0), true)
  requestAnimationFrame(quadro)
  void grupoMapa
})()
