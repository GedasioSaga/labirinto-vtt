/*
 * Protótipo do Judge v2, "modelo pronto": vista grande girável, cena de batalha falsa (a da v1)
 * e folha de quadros fotografada do mesmo 3D.
 * Script clássico (abre por file://). Depende de ../vendor/three.min.js, gltf-loader.js,
 * modelos-embutidos.js e modelo-judge-pronto.js.
 *
 * As três vistas usam a MESMA função de pose (JudgeModelo.posar) e o mesmo rig:
 * cada uma posa e desenha na sua vez, então nada vaza de uma para a outra.
 */
(function () {
  'use strict'
  const T = THREE
  const M = window.JudgeModelo

  // ---------------- medidas ----------------
  const QUADRO_L = 3 // largura do quadro do Judge, em casas
  const QUADRO_A = 3.75 // altura (cabe o cartão erguido e as asas)
  const QUADRO_BASE = 0.62 // do pé do quadro até o centro da base
  const ELEVACAO = (30 * Math.PI) / 180 // câmera 3/4
  const COLS = 11
  const LINHAS = 8
  const JUDGE_LINHA_MIN = 3.5 // acima disso o modelo sairia pelo topo do mapa
  const N_DIR = 8
  const N_RESPIRO = 12
  const N_CARTAO = 8
  const NOMES_DIR = ['sul', 'sudeste', 'leste', 'nordeste', 'norte', 'noroeste', 'oeste', 'sudoeste']

  // ---------------- tempo ----------------
  const SUBIR_MS = 420
  const SEGURAR_MS = 1100
  const DESCER_MS = 380
  const SURGIR_MS = 760
  const BASE_MS = 200
  const ANEL_MS = 240
  const ENCAIXE_MS = 160
  const FADE_REDUZIDO_MS = 200
  const MOLA_CORPO = 7 // rad/s: um giro de 90 graus assenta em ~0,7 s, sem passar do ponto
  const MOLA_CABECA = 16
  const MOLA_ELMO = 12
  const MOLA_VISTA = 16 // passo de 22,5 graus pelas setas assenta em ~0,35 s: segue a tecla sem atraso
  const LIMITE_OLHAR_AVE = 0.55
  const LIMITE_OLHAR_JUIZ = 0.5
  const YAW_VISTA = 0.75 // a vista grande abre em 3/4, a ave de perfil para a direita, como na pintura

  // ---------------- custo ----------------
  const TRES_KB = 726 // ../vendor/three.min.js, three 0.186.1 (já vem no app)
  const LOADER_KB = 47 // gltf-loader.js
  const TEXTURAS_BYTES = Math.round(1024 * 1024 * 4 * 1.33) // a textura de penas da ave, com mipmaps

  const curvaSaida = bezier(0.23, 1, 0.32, 1)
  const curvaMeio = bezier(0.77, 0, 0.175, 1)

  const FICHAS_INICIAIS = [
    { id: 'lia', nome: 'Lia', lado: 'grupo', x: 6.5, y: 1.5 },
    { id: 'goblin', nome: 'Goblin', lado: 'inimigo', x: 4.5, y: 6.5 },
    { id: 'taro', nome: 'Taro', lado: 'grupo', x: 8.5, y: 4.5 },
    { id: 'ogro', nome: 'Ogro', lado: 'inimigo', x: 2.5, y: 7.5 },
    { id: 'nha', nome: 'Nhá', lado: 'grupo', x: 9.5, y: 6.5 },
  ]
  const JUDGE_INICIAL = { x: 1.5, y: 3.5 }
  const COR_FICHA = { grupo: [91, 134, 173], inimigo: [178, 87, 76] }

  const $ = (sel) => document.querySelector(sel)
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
  const embrulhar = (a) => Math.atan2(Math.sin(a), Math.cos(a))
  const rgb = (c, f = 1) => `rgb(${Math.round(c[0] * f)}, ${Math.round(c[1] * f)}, ${Math.round(c[2] * f)})`

  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1
    const bx = 3 * (x2 - x1) - cx
    const ax = 1 - cx - bx
    const cy = 3 * y1
    const by = 3 * (y2 - y1) - cy
    const ay = 1 - cy - by
    const sx = (t) => ((ax * t + bx) * t + cx) * t
    const sy = (t) => ((ay * t + by) * t + cy) * t
    return (x) => {
      if (x <= 0) return 0
      if (x >= 1) return 1
      let lo = 0
      let hi = 1
      let t = x
      for (let i = 0; i < 24; i++) {
        const v = sx(t)
        if (Math.abs(v - x) < 1e-5) break
        if (v < x) lo = t
        else hi = t
        t = (lo + hi) / 2
      }
      return sy(t)
    }
  }

  // ---------------- estado ----------------
  const reduzirSistema = window.matchMedia('(prefers-reduced-motion: reduce)')
  const novoCartao = () => ({ de: 0, para: 0, inicio: 0, dur: 1, curva: curvaSaida, fase: 'parado', descerEm: 0 })
  const estado = {
    jeito: 'vivo',
    pxFolha: 48,
    casa: 64,
    dpr: Math.min(2, window.devicePixelRatio || 1),
    reduzir: reduzirSistema.matches,
    fichas: FICHAS_INICIAIS.map((f) => ({ ...f })),
    judge: { ...JUDGE_INICIAL, id: 'judge', nome: 'Judge' },
    vez: 0,
    historico: [],
    yaw: { x: 0, v: 0 },
    olharAve: { x: 0, v: 0 },
    olharJuiz: { x: 0, v: 0 },
    cartao: novoCartao(),
    surgir: { inicio: -1 },
    anel: { ficha: null, inicio: -1e9, anterior: null },
    arrasto: null,
    encaixes: [],
  }
  const vista = {
    yaw: { x: YAW_VISTA, v: 0 },
    yawAlvo: YAW_VISTA,
    elev: { x: 0.2, v: 0 },
    elevAlvo: 0.2,
    arrasto: null,
    erguido: false,
    cartao: novoCartao(),
    visivel: true,
  }

  // ---------------- 3D ----------------
  let rig = null
  let vivo = null
  let foto = null
  let pintorVista = null
  let sombraVista = null
  const camera = criarCamera()
  const vistaCam = new T.PerspectiveCamera(26, 1, 0.1, 60)
  const VISTA_ALVO = new T.Vector3(0, 1.12, 0)
  const VISTA_DIST = 6.6
  const PLANO_CHAO = new T.Plane(new T.Vector3(0, 1, 0), 0)

  function criarCamera() {
    const cam = new T.OrthographicCamera(-QUADRO_L / 2, QUADRO_L / 2, QUADRO_A - QUADRO_BASE, -QUADRO_BASE, 0.1, 60)
    cam.position.set(0, Math.sin(ELEVACAO) * 25, Math.cos(ELEVACAO) * 25)
    cam.lookAt(0, 0, 0)
    cam.updateProjectionMatrix()
    cam.updateMatrixWorld()
    return cam
  }

  function criarPintor(canvas, preservar) {
    const renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: preservar })
    renderer.setPixelRatio(1)
    renderer.setClearColor(0x000000, 0)
    renderer.toneMapping = T.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    return { renderer, w: 0, h: 0, env: M.criarAmbiente(renderer) }
  }

  function pintar(p, w, h, cam, comSombra) {
    const r = p.renderer
    if (p.w !== w || p.h !== h) {
      r.setSize(w, h, false)
      p.w = w
      p.h = h
    }
    rig.cena.environment = p.env
    sombraVista.visible = !!comSombra
    r.setClearColor(0x000000, 0)
    r.clear()
    r.render(rig.cena, cam)
  }

  /** Sombra macia no chão, só na vista grande (no mapa quem faz a sombra é o 2D). */
  function criarSombraVista() {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')
    const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64)
    grad.addColorStop(0, 'rgba(14, 16, 24, 0.55)')
    grad.addColorStop(0.55, 'rgba(14, 16, 24, 0.22)')
    grad.addColorStop(1, 'rgba(14, 16, 24, 0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 128, 128)
    const malha = new T.Mesh(new T.PlaneGeometry(2.6, 2.1), new T.MeshBasicMaterial({ map: new T.CanvasTexture(c), transparent: true, depthWrite: false }))
    malha.rotation.x = -Math.PI / 2
    malha.position.y = 0.002
    malha.renderOrder = -1
    return malha
  }

  // ---------------- folha de quadros ----------------
  const folhas = new Map() // px -> Promise da folha
  const prontas = new Map() // px -> folha pronta
  const progresso = new Map() // px -> 0..1
  const proximoQuadro = () => new Promise((ok) => requestAnimationFrame(() => ok()))

  function obterFolha(px) {
    if (!folhas.has(px)) folhas.set(px, fotografar(px))
    return folhas.get(px)
  }

  async function fotografar(px) {
    const fw = Math.round(QUADRO_L * px)
    const fh = Math.round(QUADRO_A * px)
    const colunas = N_RESPIRO + N_CARTAO
    const canvas = document.createElement('canvas')
    canvas.width = colunas * fw
    canvas.height = N_DIR * fh
    const g = canvas.getContext('2d')
    const total = N_DIR * colunas
    let feitos = 0
    progresso.set(px, 0)
    for (let d = 0; d < N_DIR; d++) {
      for (let k = 0; k < colunas; k++) {
        const ehCartao = k >= N_RESPIRO
        M.posar(rig, {
          yaw: (d * Math.PI) / 4,
          fase: ehCartao ? 0 : k / N_RESPIRO,
          cartao: ehCartao ? (k - N_RESPIRO) / (N_CARTAO - 1) : 0,
          olharAve: 0,
          olharJuiz: 0,
          surgir: 1,
        })
        foto.renderer.clippingPlanes = []
        pintar(foto, fw, fh, camera, false)
        g.drawImage(foto.renderer.domElement, k * fw, d * fh)
        feitos++
        if (feitos % 10 === 0) {
          progresso.set(px, feitos / total)
          atualizarPainelFolha()
          await proximoQuadro()
        }
      }
    }
    const blob = await new Promise((ok, erro) => canvas.toBlob((b) => (b ? ok(b) : erro(new Error('O navegador não gerou o PNG.'))), 'image/png'))
    const folha = { px, canvas, blob, kb: blob.size / 1024, fw, fh, colunas }
    prontas.set(px, folha)
    progresso.set(px, 1)
    atualizarPainelFolha()
    atualizarTabela()
    return folha
  }

  const folhaAtual = () => prontas.get(estado.pxFolha) || null

  // ---------------- mapa 2D (igual à v1) ----------------
  const mapa = $('#mapa')
  const mapaCanvas = $('#mapa-canvas')
  const ctx = mapaCanvas.getContext('2d')
  const vivoCanvas = $('#judge-vivo')
  const selo = $('#selo')
  let chao = null

  function hash(x, y, s) {
    let h = (x * 374761393 + y * 668265263 + (s || 0) * 2147483647) | 0
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295
  }

  /** Chão de lajes da praça (paleta do Meio-Termo), gerado por posição: nada repete. */
  function desenharChao() {
    const { casa, dpr } = estado
    const c = document.createElement('canvas')
    c.width = Math.round(COLS * casa * dpr)
    c.height = Math.round(LINHAS * casa * dpr)
    const g = c.getContext('2d')
    g.scale(dpr, dpr)
    const sombra = [188, 174, 148]
    const realce = [235, 226, 205]
    g.fillStyle = rgb([220, 208, 182], 0.6)
    g.fillRect(0, 0, COLS * casa, LINHAS * casa)
    const vao = Math.max(1.5, casa * 0.035)
    const raio = casa * 0.09
    for (let y = 0; y < LINHAS; y++) {
      for (let x = 0; x < COLS; x++) {
        const t = 0.25 + hash(x, y) * 0.55
        const tom = [0, 1, 2].map((i) => sombra[i] + (realce[i] - sombra[i]) * t)
        const px = x * casa + vao / 2
        const py = y * casa + vao / 2
        const lado = casa - vao
        g.fillStyle = rgb(tom)
        g.beginPath()
        g.roundRect(px, py, lado, lado, raio)
        g.fill()
        const grad = g.createLinearGradient(px, py, px, py + lado)
        grad.addColorStop(0, 'rgba(255, 250, 238, 0.22)')
        grad.addColorStop(0.35, 'rgba(255, 250, 238, 0)')
        grad.addColorStop(0.8, 'rgba(90, 76, 58, 0)')
        grad.addColorStop(1, 'rgba(90, 76, 58, 0.16)')
        g.fillStyle = grad
        g.fill()
        for (let i = 0; i < 7; i++) {
          const gx = px + hash(x, y, i + 1) * lado
          const gy = py + hash(x, y, i + 31) * lado
          g.fillStyle = i % 2 ? 'rgba(255, 252, 240, 0.25)' : 'rgba(110, 96, 74, 0.18)'
          g.fillRect(gx, gy, casa * 0.03, casa * 0.03)
        }
      }
    }
    chao = c
  }

  function dimensionar() {
    const { casa, dpr } = estado
    mapaCanvas.width = Math.round(COLS * casa * dpr)
    mapaCanvas.height = Math.round(LINHAS * casa * dpr)
    mapaCanvas.style.width = COLS * casa + 'px'
    mapaCanvas.style.height = LINHAS * casa + 'px'
    mapa.style.width = COLS * casa + 'px'
    mapa.style.height = LINHAS * casa + 'px'
    vivoCanvas.style.width = QUADRO_L * casa + 'px'
    vivoCanvas.style.height = QUADRO_A * casa + 'px'
    desenharChao()
  }

  function posicionarVivo() {
    const { casa, judge } = estado
    const x = (judge.x - QUADRO_L / 2) * casa
    const y = (judge.y - (QUADRO_A - QUADRO_BASE)) * casa
    vivoCanvas.style.transform = `translate(${x}px, ${y}px)`
  }

  const fichaDaVez = () => estado.fichas[estado.vez]

  function yawDesejado() {
    const f = fichaDaVez()
    const j = estado.judge
    return Math.atan2(f.x - j.x, f.y - j.y)
  }

  function desenharFicha(f, agora) {
    const { casa } = estado
    const cx = f.x * casa
    const cy = f.y * casa
    const r = casa * 0.38
    const erguida = estado.arrasto && estado.arrasto.alvo === f
    const cor = COR_FICHA[f.lado]
    ctx.fillStyle = erguida ? 'rgba(48, 38, 28, 0.22)' : 'rgba(48, 38, 28, 0.3)'
    ctx.beginPath()
    ctx.ellipse(cx + r * 0.1, cy + r * (erguida ? 0.38 : 0.2), r * 1.02, r * 0.72, 0, 0, Math.PI * 2)
    ctx.fill()
    const sobe = erguida ? casa * 0.06 : 0
    ctx.fillStyle = rgb(cor)
    ctx.beginPath()
    ctx.arc(cx, cy - sobe, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.lineWidth = Math.max(2, casa * 0.045)
    ctx.strokeStyle = rgb(cor, 0.6)
    ctx.stroke()
    ctx.lineWidth = Math.max(1, casa * 0.02)
    ctx.strokeStyle = 'rgba(255, 250, 238, 0.45)'
    ctx.beginPath()
    ctx.arc(cx, cy - sobe, r * 0.8, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = '#fbf7ec'
    ctx.font = `600 ${Math.round(casa * 0.34)}px Bahnschrift, "Segoe UI", system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(f.nome[0], cx, cy - sobe + casa * 0.015)
    // anel da vez: entra do 1,18x para o tamanho certo
    const anel = estado.anel
    if (anel.ficha === f.id || anel.anterior === f.id) {
      const t = clamp((agora - anel.inicio) / (anel.ficha === f.id ? ANEL_MS : ANEL_MS * 0.7), 0, 1)
      const entrando = anel.ficha === f.id
      const k = entrando ? curvaSaida(t) : 1 - curvaSaida(t)
      if (k > 0.01) {
        const escala = estado.reduzir ? 1 : entrando ? 1.18 - 0.18 * k : 1
        ctx.save()
        ctx.globalAlpha = k
        ctx.lineWidth = Math.max(2.5, casa * 0.055)
        ctx.strokeStyle = '#e0a44a'
        ctx.shadowColor = 'rgba(243, 186, 102, 0.55)'
        ctx.shadowBlur = casa * 0.18
        ctx.beginPath()
        ctx.arc(cx, cy - sobe, (r + casa * 0.085) * escala, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      }
    }
  }

  function desenharBaseJudge(pose, agora) {
    const { casa, judge } = estado
    const cx = judge.x * casa
    const cy = judge.y * casa
    const s = estado.surgir
    const t = s.inicio < 0 ? 1 : clamp((agora - s.inicio) / BASE_MS, 0, 1)
    const k = estado.reduzir ? t : curvaSaida(t)
    if (k <= 0) return
    ctx.save()
    ctx.globalAlpha = k
    // sombra do modelo: o eixo maior segue o corpo da ave
    const yaw = estado.jeito === 'folha' && folhaAtual() ? Math.round(pose.yaw / (Math.PI / 4)) * (Math.PI / 4) : pose.yaw
    const giro = Math.atan2(Math.cos(yaw), Math.sin(yaw))
    const tamanho = 0.35 + 0.65 * pose.surgir
    ctx.fillStyle = 'rgba(48, 38, 28, 0.3)'
    ctx.beginPath()
    ctx.ellipse(cx + casa * 0.06, cy + casa * 0.05, casa * 0.9 * tamanho, casa * 0.42 * tamanho, giro, 0, Math.PI * 2)
    ctx.fill()
    const escala = estado.reduzir ? 1 : 0.92 + 0.08 * k
    ctx.fillStyle = '#2b3240'
    ctx.beginPath()
    ctx.arc(cx, cy, casa * 0.43 * escala, 0, Math.PI * 2)
    ctx.fill()
    ctx.lineWidth = Math.max(2, casa * 0.05)
    ctx.strokeStyle = '#c9d0d9'
    ctx.stroke()
    ctx.lineWidth = Math.max(1, casa * 0.03)
    ctx.strokeStyle = '#2d58b0'
    ctx.beginPath()
    ctx.arc(cx, cy, casa * 0.33 * escala, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  function desenharJudgeDaFolha(folha, pose, alfa) {
    const { casa, dpr, judge } = estado
    const dir = ((Math.round(pose.yaw / (Math.PI / 4)) % N_DIR) + N_DIR) % N_DIR
    const col = pose.cartao > 0.001 ? N_RESPIRO + Math.round(pose.cartao * (N_CARTAO - 1)) : Math.floor(pose.fase * N_RESPIRO) % N_RESPIRO
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalAlpha = alfa
    const ax = judge.x * casa * dpr
    const ay = judge.y * casa * dpr
    const escala = (casa * dpr) / folha.px
    const w = folha.fw * escala
    const h = folha.fh * escala
    const dx = ax - w / 2
    let dy = ay - (QUADRO_A - QUADRO_BASE) * folha.px * escala
    if (pose.surgir < 1) {
      // sai do token: corta abaixo da base e sobe
      ctx.beginPath()
      ctx.rect(dx, 0, w, ay + casa * dpr * 0.18)
      ctx.clip()
      dy += (1 - pose.surgir) * M.ALTURA_SURGIR * Math.cos(ELEVACAO) * folha.px * escala
    }
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(folha.canvas, col * folha.fw, dir * folha.fh, folha.fw, folha.fh, dx, dy, w, h)
    ctx.restore()
  }

  function desenharMapa(pose, agora, usarFolha, alfaJudge) {
    const { casa, dpr } = estado
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.drawImage(chao, 0, 0, COLS * casa, LINHAS * casa)
    const arr = estado.arrasto
    if (arr) {
      const cx = Math.floor(arr.alvo.x)
      const cy = Math.floor(arr.alvo.y)
      const livre = casaLivre(cx, cy, arr.alvo) && (arr.alvo !== estado.judge || cy + 0.5 >= JUDGE_LINHA_MIN)
      ctx.lineWidth = 2
      ctx.strokeStyle = livre ? 'rgba(224, 164, 74, 0.95)' : 'rgba(226, 100, 90, 0.95)'
      ctx.fillStyle = livre ? 'rgba(224, 164, 74, 0.16)' : 'rgba(226, 100, 90, 0.16)'
      ctx.beginPath()
      ctx.roundRect(cx * casa + 3, cy * casa + 3, casa - 6, casa - 6, casa * 0.1)
      ctx.fill()
      ctx.stroke()
    }
    desenharBaseJudge(pose, agora)
    const ordem = estado.fichas.slice().sort((a, b) => a.y - b.y)
    for (const f of ordem) if (!(arr && arr.alvo === f)) desenharFicha(f, agora)
    if (usarFolha) desenharJudgeDaFolha(usarFolha, pose, alfaJudge)
    if (arr && arr.alvo !== estado.judge) desenharFicha(arr.alvo, agora)
  }

  function casaLivre(cx, cy, quem) {
    if (cx < 0 || cy < 0 || cx >= COLS || cy >= LINHAS) return false
    const todos = estado.fichas.concat([estado.judge])
    return !todos.some((o) => o !== quem && Math.floor(o.x) === cx && Math.floor(o.y) === cy)
  }

  // ---------------- animação ----------------
  function valorCartao(c, agora) {
    const t = clamp((agora - c.inicio) / c.dur, 0, 1)
    return c.de + (c.para - c.de) * c.curva(t)
  }

  /** Cartão sobe. Com segurar, desce sozinho depois (o "Desfazer"); sem, fica no alto (a vista grande). */
  function levantarCartao(c, agora, segurar) {
    const atual = valorCartao(c, agora)
    c.de = estado.reduzir ? 1 : atual
    c.para = 1
    c.inicio = agora
    c.dur = estado.reduzir ? 1 : SUBIR_MS * (1 - atual * 0.6)
    c.curva = curvaSaida
    c.fase = 'subindo'
    c.descerEm = segurar ? agora + c.dur + SEGURAR_MS : Infinity
  }

  function baixarCartao(c, agora) {
    c.de = estado.reduzir ? 0 : valorCartao(c, agora)
    c.para = 0
    c.inicio = agora
    c.dur = estado.reduzir ? 1 : DESCER_MS
    c.curva = curvaMeio
    c.fase = 'descendo'
  }

  function atualizarCartao(c, agora) {
    if (c.fase === 'subindo' && agora >= c.descerEm) baixarCartao(c, agora)
    else if (c.fase === 'descendo' && agora - c.inicio >= c.dur) c.fase = 'parado'
    return valorCartao(c, agora)
  }

  function valorSurgir(agora) {
    const s = estado.surgir
    if (s.inicio < 0 || estado.reduzir) return 1
    const t = clamp((agora - s.inicio - 140) / SURGIR_MS, 0, 1)
    return curvaSaida(t)
  }

  function alfaJudge(agora) {
    const s = estado.surgir
    if (s.inicio < 0 || !estado.reduzir) return 1
    return clamp((agora - s.inicio) / FADE_REDUZIDO_MS, 0, 1)
  }

  /** Mola com amortecimento crítico: chega no alvo sem passar e sem "pulo". */
  function mola(m, alvo, w, dt) {
    const passos = Math.max(1, Math.ceil(dt / (1 / 120)))
    const h = dt / passos
    for (let i = 0; i < passos; i++) {
      const a = -2 * w * m.v - w * w * (m.x - alvo)
      m.v += a * h
      m.x += m.v * h
    }
  }

  function apontarNaHora() {
    estado.yaw.x = yawDesejado()
    estado.yaw.v = 0
    estado.olharAve.x = estado.olharAve.v = 0
    estado.olharJuiz.x = estado.olharJuiz.v = 0
  }

  function animarEncaixes(agora) {
    estado.encaixes = estado.encaixes.filter((e) => {
      const t = clamp((agora - e.inicio) / ENCAIXE_MS, 0, 1)
      const k = estado.reduzir ? 1 : curvaSaida(t)
      e.quem.x = e.de.x + (e.para.x - e.de.x) * k
      e.quem.y = e.de.y + (e.para.y - e.de.y) * k
      return t < 1
    })
  }

  let ultimo = performance.now()
  let rotuloAntes = ''
  let mapaVisivel = true

  function passo(agora) {
    const dt = Math.min(0.05, Math.max(0, (agora - ultimo) / 1000))
    ultimo = agora
    const fase = estado.reduzir ? 0 : (agora / 1000 / M.PERIODO_RESPIRO_S) % 1
    if (vista.visivel) desenharVista(agora, dt, fase)
    if (mapaVisivel) desenharBatalha(agora, dt, fase)
    requestAnimationFrame(passo)
  }

  function desenharBatalha(agora, dt, fase) {
    animarEncaixes(agora)
    const yaw = estado.yaw
    const alvo = yaw.x + embrulhar(yawDesejado() - yaw.x)
    if (estado.reduzir) {
      yaw.x = alvo
      yaw.v = 0
      estado.olharAve.x = estado.olharJuiz.x = 0
    } else {
      mola(yaw, alvo, MOLA_CORPO, dt)
      const falta = embrulhar(alvo - yaw.x)
      mola(estado.olharAve, clamp(falta, -LIMITE_OLHAR_AVE, LIMITE_OLHAR_AVE), MOLA_CABECA, dt)
      mola(estado.olharJuiz, clamp(falta, -LIMITE_OLHAR_JUIZ, LIMITE_OLHAR_JUIZ), MOLA_ELMO, dt)
    }
    const pose = {
      yaw: yaw.x,
      fase,
      cartao: atualizarCartao(estado.cartao, agora),
      olharAve: estado.olharAve.x,
      olharJuiz: estado.olharJuiz.x,
      surgir: valorSurgir(agora),
    }
    const folha = estado.jeito === 'folha' ? folhaAtual() : null
    const alfa = alfaJudge(agora)
    desenharMapa(pose, agora, folha, alfa)
    const mostrarVivo = !folha
    vivoCanvas.hidden = !mostrarVivo
    if (mostrarVivo) desenharVivo(pose, alfa)
    selo.hidden = !(estado.jeito === 'folha' && !folha)
    if (!selo.hidden) {
      const p = progresso.get(estado.pxFolha) || 0
      const texto = `Fotografando a folha ${Math.round(p * 100)}%. Enquanto isso, o 3D ao vivo segura o lugar.`
      if (selo.textContent !== texto) selo.textContent = texto
    }
    const rotulo = rotuloDoMapa(pose)
    if (rotulo !== rotuloAntes) {
      mapaCanvas.setAttribute('aria-label', rotulo)
      rotuloAntes = rotulo
    }
  }

  function desenharVivo(pose, alfa) {
    M.posar(rig, pose)
    vivo.renderer.clippingPlanes = pose.surgir < 1 ? [PLANO_CHAO] : []
    const { casa, dpr } = estado
    vivoCanvas.style.opacity = String(alfa)
    posicionarVivo()
    pintar(vivo, Math.round(QUADRO_L * casa * dpr), Math.round(QUADRO_A * casa * dpr), camera, false)
  }

  function rotuloDoMapa(pose) {
    const f = fichaDaVez()
    const dir = NOMES_DIR[((Math.round(pose.yaw / (Math.PI / 4)) % N_DIR) + N_DIR) % N_DIR]
    const cartao = pose.cartao > 0.5 ? ' Está com o cartão vermelho erguido.' : ''
    return `Mapa de batalha falso, ${COLS} por ${LINHAS} casas. A vez é de ${f.nome}. O Judge está montado na ave, olhando para ${dir}, na direção de ${f.nome}.${cartao}`
  }

  // ---------------- vista grande ----------------
  const vistaCanvas = $('#vista-canvas')
  const btnVistaCartao = $('#btn-vista-cartao')

  function desenharVista(agora, dt, fase) {
    if (estado.reduzir || vista.arrasto) {
      if (estado.reduzir) {
        vista.yaw.x = vista.yawAlvo
        vista.elev.x = vista.elevAlvo
      } else {
        vista.yaw.x = vista.yawAlvo // arrastando: o modelo segue o dedo, sem atraso
        vista.elev.x = vista.elevAlvo
      }
      vista.yaw.v = vista.elev.v = 0
    } else {
      mola(vista.yaw, vista.yawAlvo, MOLA_VISTA, dt)
      mola(vista.elev, vista.elevAlvo, MOLA_VISTA, dt)
    }
    const lado = Math.max(1, Math.round(vistaCanvas.clientWidth * estado.dpr))
    const el = vista.elev.x
    vistaCam.position.set(0, VISTA_ALVO.y + Math.sin(el) * VISTA_DIST, Math.cos(el) * VISTA_DIST)
    vistaCam.lookAt(VISTA_ALVO)
    vistaCam.updateMatrixWorld()
    M.posar(rig, {
      yaw: vista.yaw.x,
      fase,
      cartao: atualizarCartao(vista.cartao, agora),
      olharAve: 0,
      olharJuiz: 0,
      surgir: 1,
      quatCamera: vistaCam.quaternion,
    })
    pintorVista.renderer.clippingPlanes = []
    pintar(pintorVista, lado, lado, vistaCam, true)
  }

  function vistaErguer(erguer) {
    vista.erguido = erguer
    const agora = performance.now()
    if (erguer) levantarCartao(vista.cartao, agora, false)
    else baixarCartao(vista.cartao, agora)
    btnVistaCartao.setAttribute('aria-pressed', String(erguer))
    btnVistaCartao.firstChild.textContent = erguer ? 'Baixar o cartão ' : 'Erguer o cartão '
  }

  function vistaDeFrente() {
    // volta para a 3/4 de frente pelo caminho mais curto
    vista.yawAlvo = vista.yaw.x + embrulhar(YAW_VISTA - vista.yaw.x)
    vista.elevAlvo = 0.2
  }

  vistaCanvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || vista.arrasto || !rig) return
    e.preventDefault()
    vistaCanvas.setPointerCapture(e.pointerId)
    vistaCanvas.focus({ preventScroll: true })
    vista.arrasto = { id: e.pointerId, x: e.clientX, y: e.clientY }
  })
  vistaCanvas.addEventListener('pointermove', (e) => {
    const a = vista.arrasto
    if (!a || e.pointerId !== a.id) return
    const largura = vistaCanvas.clientWidth || 600
    vista.yawAlvo += ((e.clientX - a.x) / largura) * Math.PI * 1.6
    vista.elevAlvo = clamp(vista.elevAlvo + ((e.clientY - a.y) / largura) * 1.4, -0.05, 0.95)
    a.x = e.clientX
    a.y = e.clientY
  })
  const soltarVista = (e) => {
    if (vista.arrasto && e.pointerId === vista.arrasto.id) vista.arrasto = null
  }
  vistaCanvas.addEventListener('pointerup', soltarVista)
  vistaCanvas.addEventListener('pointercancel', soltarVista)
  vistaCanvas.addEventListener('keydown', (e) => {
    const passoGiro = Math.PI / 8
    if (e.key === 'ArrowLeft') vista.yawAlvo -= passoGiro
    else if (e.key === 'ArrowRight') vista.yawAlvo += passoGiro
    else if (e.key === 'ArrowUp') vista.elevAlvo = clamp(vista.elevAlvo + 0.12, -0.05, 0.95)
    else if (e.key === 'ArrowDown') vista.elevAlvo = clamp(vista.elevAlvo - 0.12, -0.05, 0.95)
    else if (e.key === 'Home') vistaDeFrente()
    else return
    e.preventDefault()
    e.stopPropagation()
  })
  btnVistaCartao.addEventListener('click', () => vistaErguer(!vista.erguido))
  $('#btn-vista-frente').addEventListener('click', vistaDeFrente)

  // ---------------- batalha falsa (igual à v1) ----------------
  const aviso = $('#aviso')
  const btnProxima = $('#btn-proxima')
  const btnDesfazer = $('#btn-desfazer')
  const btnReiniciar = $('#btn-reiniciar')
  const motivoDesfazer = $('#motivo-desfazer')
  const listaOrdem = $('#ordem')

  const anunciar = (texto) => {
    aviso.textContent = texto
  }

  function marcarVez(agora) {
    estado.anel.anterior = estado.anel.ficha
    estado.anel.ficha = fichaDaVez().id
    estado.anel.inicio = agora
    desenharOrdem()
  }

  function desenharOrdem() {
    listaOrdem.replaceChildren(
      ...estado.fichas.map((f, i) => {
        const li = document.createElement('li')
        li.className = 'ordem-item'
        if (i === estado.vez) li.setAttribute('aria-current', 'true')
        const ponto = document.createElement('span')
        ponto.className = 'ordem-ponto'
        ponto.style.setProperty('--cor', rgb(COR_FICHA[f.lado]))
        ponto.textContent = f.nome[0]
        ponto.setAttribute('aria-hidden', 'true')
        li.append(ponto, document.createTextNode(f.nome))
        return li
      })
    )
    const vazio = estado.historico.length === 0
    btnDesfazer.disabled = vazio
    motivoDesfazer.hidden = !vazio
  }

  function proximaVez() {
    if (!rig) return
    estado.historico.push(estado.vez)
    estado.vez = (estado.vez + 1) % estado.fichas.length
    marcarVez(performance.now())
    const nome = fichaDaVez().nome
    anunciar(`Vez de ${nome}. O Judge virou para ${nome}.`)
  }

  function desfazer() {
    if (!rig || estado.historico.length === 0) return
    estado.vez = estado.historico.pop()
    const agora = performance.now()
    marcarVez(agora)
    levantarCartao(estado.cartao, agora, true)
    const nome = fichaDaVez().nome
    anunciar(`Desfeito: a vez voltou para ${nome}. O Judge ergueu o cartão vermelho.`)
  }

  function iniciarBatalha() {
    estado.fichas = FICHAS_INICIAIS.map((f) => ({ ...f }))
    Object.assign(estado.judge, JUDGE_INICIAL)
    estado.encaixes = []
    estado.arrasto = null
    estado.vez = 0
    estado.historico = []
    estado.cartao = novoCartao()
    const agora = performance.now()
    estado.surgir.inicio = agora
    estado.anel.anterior = null
    marcarVez(agora + 260)
    apontarNaHora()
    anunciar(`A batalha começou. O Judge saiu do token no canto e olha para ${fichaDaVez().nome}, que tem a vez.`)
  }

  btnProxima.addEventListener('click', proximaVez)
  btnDesfazer.addEventListener('click', desfazer)
  btnReiniciar.addEventListener('click', iniciarBatalha)

  // ---------------- arrastar fichas ----------------
  function pontoNoMapa(e) {
    const r = mapaCanvas.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * COLS, y: ((e.clientY - r.top) / r.height) * LINHAS }
  }

  function quemEsta(p) {
    const ficha = estado.fichas.find((f) => Math.hypot(f.x - p.x, f.y - p.y) < 0.44)
    if (ficha) return ficha
    const j = estado.judge
    // o Judge se pega pela base ou pelo corpo, que sobe acima da base
    if (Math.abs(p.x - j.x) < 0.7 && p.y > j.y - 2.4 && p.y < j.y + 0.46) return j
    return null
  }

  mapaCanvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || estado.arrasto || !rig) return
    const p = pontoNoMapa(e)
    const alvo = quemEsta(p)
    if (!alvo) return
    e.preventDefault()
    mapaCanvas.setPointerCapture(e.pointerId)
    estado.encaixes = estado.encaixes.filter((x) => x.quem !== alvo)
    estado.arrasto = { alvo, id: e.pointerId, dx: p.x - alvo.x, dy: p.y - alvo.y, origem: { x: alvo.x, y: alvo.y } }
    mapaCanvas.style.cursor = 'grabbing'
  })

  mapaCanvas.addEventListener('pointermove', (e) => {
    const p = pontoNoMapa(e)
    const arr = estado.arrasto
    if (arr && e.pointerId === arr.id) {
      arr.alvo.x = clamp(p.x - arr.dx, 0.5, COLS - 0.5)
      arr.alvo.y = clamp(p.y - arr.dy, arr.alvo === estado.judge ? JUDGE_LINHA_MIN : 0.5, LINHAS - 0.5)
      return
    }
    mapaCanvas.style.cursor = quemEsta(p) ? 'grab' : 'default'
  })

  function soltar(e, cancelou) {
    const arr = estado.arrasto
    if (!arr || e.pointerId !== arr.id) return
    estado.arrasto = null
    mapaCanvas.style.cursor = 'grab'
    const cx = Math.floor(arr.alvo.x)
    const cy = Math.floor(arr.alvo.y)
    const ok = !cancelou && casaLivre(cx, cy, arr.alvo)
    const para = ok ? { x: cx + 0.5, y: cy + 0.5 } : arr.origem
    estado.encaixes.push({ quem: arr.alvo, de: { x: arr.alvo.x, y: arr.alvo.y }, para, inicio: performance.now() })
    if (!cancelou && !ok) anunciar('Essa casa está ocupada. A ficha voltou para onde estava.')
    else if (ok && (para.x !== arr.origem.x || para.y !== arr.origem.y)) {
      anunciar(arr.alvo === estado.judge ? 'O Judge mudou de lugar e continua olhando para quem tem a vez.' : `${arr.alvo.nome} andou.`)
    }
  }
  mapaCanvas.addEventListener('pointerup', (e) => soltar(e, false))
  mapaCanvas.addEventListener('pointercancel', (e) => soltar(e, true))

  // ---------------- painel: custos ----------------
  const tabela = {
    baixar: [$('#t-baixar-vivo'), $('#t-baixar-folha')],
    memoria: [$('#t-memoria-vivo'), $('#t-memoria-folha')],
    quadro: [$('#t-quadro-vivo'), $('#t-quadro-folha')],
    giro: [$('#t-giro-vivo'), $('#t-giro-folha')],
    zoom: [$('#t-zoom-vivo'), $('#t-zoom-folha')],
    mudar: [$('#t-mudar-vivo'), $('#t-mudar-folha')],
  }
  const fmtNum = (n) => Math.round(n).toLocaleString('pt-BR')
  function fmtKB(kb) {
    if (kb < 1000) return `${fmtNum(kb)} KB`
    return `${(kb / 1024).toFixed(1).replace('.', ',')} MB`
  }
  const fmtMB = (bytes) => `${(bytes / 1048576).toFixed(1).replace('.', ',')} MB`

  /** Peso real dos .glb, medido do base64 embutido (os mesmos bytes de modelos/*.glb). */
  function kbDosModelos() {
    let bytes = 0
    for (const b64 of Object.values(window.JudgeModelosGLB || {})) bytes += Math.floor((b64.length * 3) / 4) - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0)
    return bytes / 1024
  }

  function atualizarTabela() {
    if (!rig) return
    const st = rig.estatisticas
    const { casa, dpr } = estado
    const cw = Math.round(QUADRO_L * casa * dpr)
    const ch = Math.round(QUADRO_A * casa * dpr)
    const memVivo = cw * ch * 8 * 4 + st.bytes + TEXTURAS_BYTES
    const ehVivo = estado.jeito === 'vivo'
    $('#th-vivo').classList.toggle('ativo', ehVivo)
    $('#th-folha').classList.toggle('ativo', !ehVivo)
    for (const linha of Object.values(tabela)) {
      linha[0].classList.toggle('ativo', ehVivo)
      linha[1].classList.toggle('ativo', !ehVivo)
    }
    const kbModelos = kbDosModelos()
    tabela.baixar[0].textContent = `Os 3 modelos: ${fmtKB(kbModelos)} em .glb, mais o GLTFLoader (${LOADER_KB} KB), que o app ainda não tem. O three.js (${TRES_KB} KB) já vem no app.`
    tabela.memoria[0].textContent = `Cerca de ${fmtMB(memVivo)}: um canvas WebGL a mais por cima do mapa e a textura de penas, a batalha inteira.`
    tabela.quadro[0].textContent = `Redesenha ${fmtNum(st.chamadas)} peças e ${fmtNum(st.triangulos)} triângulos, com 89 ossos movendo a pele.`
    tabela.giro[0].textContent = 'Qualquer ângulo, liso. A cabeça da ave e o elmo viram antes do corpo.'
    tabela.zoom[0].textContent = 'Nítido em qualquer zoom.'
    tabela.mudar[0].textContent = 'Mexe no código e pronto.'
    const folha = folhaAtual()
    const px = estado.pxFolha
    const largura = Math.round(QUADRO_L * px) * (N_RESPIRO + N_CARTAO)
    const altura = Math.round(QUADRO_A * px) * N_DIR
    tabela.baixar[1].textContent = folha
      ? `Uma folha PNG de ${fmtKB(folha.kb)} (${fmtNum(largura)} x ${fmtNum(altura)} px). Os modelos não vão para o app.`
      : `Uma folha PNG de ${fmtNum(largura)} x ${fmtNum(altura)} px (pesando...).`
    tabela.memoria[1].textContent = `${fmtMB(largura * altura * 4)}: a folha aberta na placa de vídeo.`
    tabela.quadro[1].textContent = 'Copia 1 retângulo da folha. O app nem precisa de 3D.'
    tabela.giro[1].textContent = '8 direções, em passos de 45 graus. A cabeça não vira antes.'
    tabela.zoom[1].textContent = `Nítido até ${px} px por casa; acima disso fica macio.`
    tabela.mudar[1].textContent = 'Mexe no código e fotografa a folha de novo.'
  }

  // ---------------- a folha, grande ----------------
  const folhaCanvas = $('#folha-canvas')
  const folhaInfo = $('#folha-info')
  const btnVerFolha = $('#btn-ver-folha')
  const btnBaixar = $('#btn-baixar')
  const motivoFolha = $('#motivo-folha')
  const MARGEM_ESQ = 74
  const MARGEM_TOPO = 24

  /** Desenha a folha com os nomes das direções e das colunas. escala 1 = tamanho real. */
  function desenharFolhaRotulada(tela, folha, escala, dpr) {
    const w = Math.round(folha.canvas.width * escala)
    const h = Math.round(folha.canvas.height * escala)
    tela.width = Math.round((w + MARGEM_ESQ) * dpr)
    tela.height = Math.round((h + MARGEM_TOPO) * dpr)
    tela.style.width = w + MARGEM_ESQ + 'px'
    tela.style.height = h + MARGEM_TOPO + 'px'
    const g = tela.getContext('2d')
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.fillStyle = '#141417'
    g.fillRect(0, 0, w + MARGEM_ESQ, h + MARGEM_TOPO)
    g.fillStyle = '#1d1d22'
    g.fillRect(MARGEM_ESQ, MARGEM_TOPO, w, h)
    g.imageSmoothingEnabled = true
    g.imageSmoothingQuality = 'high'
    g.drawImage(folha.canvas, MARGEM_ESQ, MARGEM_TOPO, w, h)
    g.fillStyle = '#a2a09a'
    g.font = '12px Bahnschrift, "Segoe UI", sans-serif'
    g.textBaseline = 'middle'
    const fh = folha.fh * escala
    const fw = folha.fw * escala
    for (let d = 0; d < N_DIR; d++) g.fillText(NOMES_DIR[d], 8, MARGEM_TOPO + (d + 0.5) * fh)
    g.fillText('parado, respirando (12 quadros)', MARGEM_ESQ + 4, 12)
    g.fillText('erguendo o cartão (8 quadros)', MARGEM_ESQ + N_RESPIRO * fw + 6, 12)
    g.strokeStyle = 'rgba(224, 164, 74, 0.6)'
    g.beginPath()
    g.moveTo(MARGEM_ESQ + N_RESPIRO * fw + 0.5, 4)
    g.lineTo(MARGEM_ESQ + N_RESPIRO * fw + 0.5, h + MARGEM_TOPO)
    g.stroke()
  }

  function atualizarPainelFolha() {
    const px = estado.pxFolha
    const folha = folhaAtual()
    const pronta = !!folha
    btnVerFolha.disabled = !pronta
    btnBaixar.disabled = !pronta
    motivoFolha.hidden = pronta
    if (!pronta) {
      const p = progresso.get(px) || 0
      motivoFolha.textContent = `Fotografando a folha de ${px} px por casa: ${Math.round(p * 100)}%. Os botões liberam quando terminar.`
      return
    }
    const largura = (folhaCanvas.parentElement.clientWidth || 900) - 24 - MARGEM_ESQ
    const escala = Math.min(1, largura / folha.canvas.width)
    desenharFolhaRotulada(folhaCanvas, folha, escala, estado.dpr)
    const texto = `${px} px por casa: ${fmtKB(folha.kb)} em PNG, ${fmtNum(folha.canvas.width)} x ${fmtNum(folha.canvas.height)} px. Linhas: as 8 direções. Colunas: 12 quadros parado, respirando, e 8 erguendo o cartão.`
    folhaInfo.textContent = texto
    folhaCanvas.setAttribute('aria-label', `Folha de quadros do Judge, ${texto}`)
  }

  const dlg = $('#dlg-folha')
  btnVerFolha.addEventListener('click', () => {
    const folha = folhaAtual()
    if (!folha) return
    desenharFolhaRotulada($('#dlg-canvas'), folha, 1, 1)
    $('#dlg-titulo').textContent = `Folha em tamanho real: ${folha.px} px por casa, ${fmtKB(folha.kb)}`
    dlg.showModal()
  })
  $('#dlg-fechar').addEventListener('click', () => dlg.close())

  btnBaixar.addEventListener('click', () => {
    const folha = folhaAtual()
    if (!folha) return
    const url = URL.createObjectURL(folha.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `judge-pronto-${folha.px}px.png`
    document.body.append(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    anunciar(`Baixando ${a.download} (${fmtKB(folha.kb)}).`)
  })

  function escolherJeito(jeito) {
    estado.jeito = jeito
    const radio = document.querySelector(`input[name="jeito"][value="${jeito}"]`)
    if (radio) radio.checked = true
    if (jeito === 'folha') obterFolha(estado.pxFolha)
    atualizarTabela()
  }

  for (const r of document.querySelectorAll('input[name="jeito"]')) r.addEventListener('change', () => escolherJeito(r.value))
  for (const r of document.querySelectorAll('input[name="pxfolha"]')) {
    r.addEventListener('change', () => {
      estado.pxFolha = Number(r.value)
      if (rig) obterFolha(estado.pxFolha)
      atualizarTabela()
      atualizarPainelFolha()
    })
  }

  const zoom = $('#zoom')
  const zoomValor = $('#zoom-valor')
  zoom.addEventListener('input', () => {
    estado.casa = Number(zoom.value)
    zoomValor.textContent = `${estado.casa} px por casa`
    dimensionar()
    atualizarTabela()
  })

  const caixaReduzir = $('#reduzir')
  function aplicarReduzir(v) {
    estado.reduzir = v
    caixaReduzir.checked = v
    document.documentElement.classList.toggle('reduzir', v)
  }
  caixaReduzir.addEventListener('change', () => aplicarReduzir(caixaReduzir.checked))
  reduzirSistema.addEventListener('change', (e) => aplicarReduzir(e.matches))

  document.addEventListener('keydown', (e) => {
    if (!rig || dlg.open || e.altKey || e.repeat) return
    const alvo = e.target
    if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA')) {
      if (alvo.type === 'range') return
    }
    const k = e.key.toLowerCase()
    if (k === 'z' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      desfazer()
      return
    }
    if (e.ctrlKey || e.metaKey) return
    if (k === 'n') proximaVez()
    else if (k === 'z') desfazer()
    else if (k === 'r') iniciarBatalha()
    else if (k === 'm') escolherJeito(estado.jeito === 'vivo' ? 'folha' : 'vivo')
    else if (k === 'c') vistaErguer(!vista.erguido)
    else if (k === 'f') vistaDeFrente()
  })

  window.addEventListener('resize', () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    if (dpr !== estado.dpr) {
      estado.dpr = dpr
      dimensionar()
      atualizarTabela()
    }
    atualizarPainelFolha()
  })

  // só desenha o que está na tela
  function observarVisibilidade() {
    if (!('IntersectionObserver' in window)) return
    const obs = new IntersectionObserver((itens) => {
      for (const it of itens) {
        if (it.target === vistaCanvas) vista.visivel = it.isIntersecting
        else mapaVisivel = it.isIntersecting
      }
    })
    obs.observe(vistaCanvas)
    obs.observe(mapaCanvas)
  }

  function blobParaBase64(blob) {
    return new Promise((ok, erro) => {
      const leitor = new FileReader()
      leitor.onload = () => ok(String(leitor.result).split(',')[1])
      leitor.onerror = () => erro(leitor.error)
      leitor.readAsDataURL(blob)
    })
  }

  // ---------------- início ----------------
  const carregando = $('#carregando')
  function falhar(motivo) {
    $('#erro-webgl-motivo').textContent = motivo
    $('#erro-webgl').hidden = false
    carregando.textContent = 'O 3D não abriu. O motivo está no alto da página.'
  }

  const botoesDaBatalha = [btnProxima, btnReiniciar, btnVistaCartao, $('#btn-vista-frente')]
  for (const b of botoesDaBatalha) b.disabled = true

  async function iniciar() {
    try {
      vivo = criarPintor(vivoCanvas, false)
      foto = criarPintor(document.createElement('canvas'), true)
      pintorVista = criarPintor(vistaCanvas, false)
    } catch (erro) {
      falhar('Este navegador não liberou o WebGL, que o 3D precisa. Abra no Chrome ou no Edge do PC, com a aceleração de hardware ligada.')
      return
    }
    try {
      await M.preparar()
      rig = M.criarCena()
    } catch (erro) {
      falhar('Os modelos não abriram: ' + (erro && erro.message ? erro.message : String(erro)))
      return
    }
    sombraVista = criarSombraVista()
    rig.cena.add(sombraVista)
    for (const b of botoesDaBatalha) b.disabled = false
    carregando.textContent = 'Modelos prontos.'
    carregando.dataset.pronto = 'true'
    const st = rig.estatisticas
    $('#n-triangulos').textContent = fmtNum(st.triangulos)
    $('#n-pecas').textContent = fmtNum(st.chamadas)
    $('#n-kb').textContent = fmtKB(kbDosModelos())
    aplicarReduzir(estado.reduzir)
    zoomValor.textContent = `${estado.casa} px por casa`
    dimensionar()
    escolherJeito(estado.jeito)
    desenharOrdem()
    iniciarBatalha()
    observarVisibilidade() // depois do dimensionar: o mapa já tem tamanho
    requestAnimationFrame((t) => {
      ultimo = t
      passo(t)
    })
    obterFolha(estado.pxFolha)
    atualizarPainelFolha()
  }

  window.JudgePrototipo = {
    /** Para ferramentas: a folha em PNG (base64) e o peso. */
    async folhaEmBase64(px) {
      const folha = await obterFolha(px)
      return { base64: await blobParaBase64(folha.blob), kb: folha.kb, largura: folha.canvas.width, altura: folha.canvas.height }
    },
    estatisticas: () => rig && rig.estatisticas,
  }

  iniciar()
})()
