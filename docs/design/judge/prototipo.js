/*
 * Protótipo do token Judge: cena de batalha falsa, 3 estilos e 2 jeitos de rodar.
 * Script clássico (abre por file://). Depende de vendor/three.min.js e modelo-judge.js.
 *
 * Os dois jeitos usam a MESMA função de pose (JudgeModelo.posar):
 *  - 3D ao vivo: um canvas WebGL por cima do mapa desenha o modelo a cada quadro.
 *  - Quadros da folha: a página "fotografa" o 3D em 8 direções x 20 quadros numa
 *    folha PNG e o mapa 2D só copia o retângulo certo, como o Pixi faria.
 */
(function () {
  'use strict'
  const T = THREE
  const M = window.JudgeModelo

  // ---------------- medidas ----------------
  const QUADRO_L = 3 // largura do quadro do Judge, em casas
  const QUADRO_A = 3.75 // altura (cabe o cartão erguido)
  const QUADRO_BASE = 0.62 // do pé do quadro até o centro da base
  const ELEVACAO = (30 * Math.PI) / 180 // câmera 3/4
  const COLS = 11
  const LINHAS = 8
  const JUDGE_LINHA_MIN = 3.5 // abaixo disso o modelo sairia pelo topo do mapa
  const ESTILOS = ['lowpoly', 'sprite', 'detalhado']
  const NOME = { lowpoly: 'Low-poly pintado', sprite: 'Cara de sprite', detalhado: 'Detalhado' }
  const N_DIR = 8
  const N_RESPIRO = 12
  const N_CARTAO = 8
  const PX_SPRITE = 16
  const PX_RETRATO = 60
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
  const LIMITE_OLHAR_AVE = 0.55
  const LIMITE_OLHAR_JUIZ = 0.5

  // ---------------- custo (medido fora da página) ----------------
  const TRES_KB = 726 // vendor/three.min.js, three 0.186.1
  const TRES_KB_GZ = 187
  const MODELO_KB = 26 // modelo-judge.js

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
  const estado = {
    estilo: 'lowpoly',
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
    cartao: { de: 0, para: 0, inicio: 0, dur: 1, curva: curvaSaida, fase: 'parado', descerEm: 0 },
    surgir: { inicio: -1 },
    anel: { ficha: null, inicio: -1e9, anterior: null },
    arrasto: null,
    encaixes: [],
  }

  // ---------------- 3D ----------------
  let mundos = null
  let vivo = null
  let foto = null
  const camera = criarCamera()
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
    return { renderer, w: 0, h: 0, rt: null }
  }

  /** Passo do sprite: contorno de 1 pixel na cor escurecida do vizinho (nunca preto puro). */
  const POS = (() => {
    const material = new T.ShaderMaterial({
      uniforms: { tCor: { value: null }, texel: { value: new T.Vector2(1, 1) } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: [
        'uniform sampler2D tCor; uniform vec2 texel; varying vec2 vUv;',
        // a cor dividida pelo canal mais forte: muda com o material, não com a sombra
        'vec3 matiz(vec3 c) { return c / max(max(c.r, c.g), max(c.b, 0.001)); }',
        'void main() {',
        '  vec4 c = texture2D(tCor, vUv);',
        '  if (c.a > 0.5) {',
        '    vec3 cor = c.rgb;',
        '    vec4 cima = texture2D(tCor, vUv + vec2(0.0, texel.y));',
        '    vec4 esq = texture2D(tCor, vUv - vec2(texel.x, 0.0));',
        '    float troca = 0.0;',
        '    if (cima.a > 0.5) troca = max(troca, distance(matiz(cima.rgb), matiz(cor)));',
        '    if (esq.a > 0.5) troca = max(troca, distance(matiz(esq.rgb), matiz(cor)));',
        '    if (troca > 0.34) cor *= 0.42;',
        '    gl_FragColor = vec4(cor, 1.0);',
        '  }',
        '  else {',
        '    vec4 m = texture2D(tCor, vUv + vec2(0.0, texel.y));',
        '    vec4 s = texture2D(tCor, vUv - vec2(0.0, texel.y)); if (s.a > m.a) m = s;',
        '    s = texture2D(tCor, vUv - vec2(texel.x, 0.0)); if (s.a > m.a) m = s;',
        '    s = texture2D(tCor, vUv + vec2(texel.x, 0.0)); if (s.a > m.a) m = s;',
        '    if (m.a < 0.5) discard;',
        '    gl_FragColor = vec4(m.rgb * 0.17, 1.0);',
        '  }',
        '  #include <colorspace_fragment>',
        '}',
      ].join('\n'),
      depthTest: false,
      depthWrite: false,
      blending: T.NoBlending,
    })
    const malha = new T.Mesh(new T.PlaneGeometry(2, 2), material)
    malha.frustumCulled = false
    const cena = new T.Scene()
    cena.add(malha)
    return { material, cena, camera: new T.Camera() }
  })()

  function pintar(p, estilo, w, h) {
    const r = p.renderer
    if (p.w !== w || p.h !== h) {
      r.setSize(w, h, false)
      p.w = w
      p.h = h
    }
    r.setClearColor(0x000000, 0)
    if (estilo === 'sprite') {
      if (!p.rt || p.rt.width !== w || p.rt.height !== h) {
        if (p.rt) p.rt.dispose()
        p.rt = new T.WebGLRenderTarget(w, h, { minFilter: T.NearestFilter, magFilter: T.NearestFilter, generateMipmaps: false })
      }
      r.setRenderTarget(p.rt)
      r.clear()
      r.render(mundos.sprite.cena, camera)
      r.setRenderTarget(null)
      POS.material.uniforms.tCor.value = p.rt.texture
      POS.material.uniforms.texel.value.set(1 / w, 1 / h)
      const planos = r.clippingPlanes
      r.clippingPlanes = []
      r.clear()
      r.render(POS.cena, POS.camera)
      r.clippingPlanes = planos
    } else {
      r.setRenderTarget(null)
      r.clear()
      r.render(mundos[estilo].cena, camera)
    }
  }

  // ---------------- folhas de quadros ----------------
  const folhas = new Map() // chave -> Promise da folha
  const prontas = new Map() // chave -> folha pronta
  const progresso = new Map() // chave -> 0..1
  const chaveFolha = (estilo, px) => estilo + ':' + px
  const pxDaFolha = (estilo) => (estilo === 'sprite' ? PX_SPRITE : estado.pxFolha)
  const proximoQuadro = () => new Promise((ok) => requestAnimationFrame(() => ok()))

  function obterFolha(estilo, px) {
    const chave = chaveFolha(estilo, px)
    if (!folhas.has(chave)) folhas.set(chave, fotografar(estilo, px))
    return folhas.get(chave)
  }

  async function fotografar(estilo, px) {
    const chave = chaveFolha(estilo, px)
    const fw = Math.round(QUADRO_L * px)
    const fh = Math.round(QUADRO_A * px)
    const colunas = N_RESPIRO + N_CARTAO
    const canvas = document.createElement('canvas')
    canvas.width = colunas * fw
    canvas.height = N_DIR * fh
    const ctx = canvas.getContext('2d')
    const total = N_DIR * colunas
    const rig = mundos[estilo].rig
    let feitos = 0
    progresso.set(chave, 0)
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
        pintar(foto, estilo, fw, fh)
        ctx.drawImage(foto.renderer.domElement, k * fw, d * fh)
        feitos++
        if (feitos % 12 === 0) {
          progresso.set(chave, feitos / total)
          atualizarPainelFolha()
          await proximoQuadro()
        }
      }
    }
    const blob = await new Promise((ok, erro) => canvas.toBlob((b) => (b ? ok(b) : erro(new Error('O navegador não gerou o PNG.'))), 'image/png'))
    const folha = { estilo, px, canvas, blob, kb: blob.size / 1024, fw, fh, colunas }
    prontas.set(chave, folha)
    progresso.set(chave, 1)
    atualizarPainelFolha()
    atualizarTabela()
    return folha
  }

  function folhaAtual() {
    return prontas.get(chaveFolha(estado.estilo, pxDaFolha(estado.estilo))) || null
  }

  // ---------------- mapa 2D ----------------
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
    const base = [220, 208, 182]
    const realce = [235, 226, 205]
    g.fillStyle = rgb(base, 0.6)
    g.fillRect(0, 0, COLS * casa, LINHAS * casa)
    const vao = Math.max(1.5, casa * 0.035)
    const raio = casa * 0.09
    for (let y = 0; y < LINHAS; y++) {
      for (let x = 0; x < COLS; x++) {
        const h = hash(x, y)
        const t = 0.25 + h * 0.55
        const tom = [0, 1, 2].map((i) => sombra[i] + (realce[i] - sombra[i]) * t)
        const px = x * casa + vao / 2
        const py = y * casa + vao / 2
        const lado = casa - vao
        g.fillStyle = rgb(tom)
        g.beginPath()
        g.roundRect(px, py, lado, lado, raio)
        g.fill()
        // realce no alto e sombra embaixo: a laje tem volume
        const grad = g.createLinearGradient(px, py, px, py + lado)
        grad.addColorStop(0, 'rgba(255, 250, 238, 0.22)')
        grad.addColorStop(0.35, 'rgba(255, 250, 238, 0)')
        grad.addColorStop(0.8, 'rgba(90, 76, 58, 0)')
        grad.addColorStop(1, 'rgba(90, 76, 58, 0.16)')
        g.fillStyle = grad
        g.fill()
        // grão
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

  function fichaDaVez() {
    return estado.fichas[estado.vez]
  }

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
    // sombra do modelo: o eixo maior segue para onde a ave olha
    const yaw = estado.jeito === 'folha' && folhaAtual() ? Math.round(pose.yaw / (Math.PI / 4)) * (Math.PI / 4) : pose.yaw
    const giro = Math.atan2(Math.cos(yaw), Math.sin(yaw))
    const tamanho = 0.35 + 0.65 * pose.surgir
    ctx.fillStyle = 'rgba(48, 38, 28, 0.3)'
    ctx.beginPath()
    ctx.ellipse(cx + casa * 0.06, cy + casa * 0.05, casa * 0.68 * tamanho, casa * 0.38 * tamanho, giro, 0, Math.PI * 2)
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
    ctx.strokeStyle = '#43639a'
    ctx.beginPath()
    ctx.arc(cx, cy, casa * 0.33 * escala, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  function desenharJudgeDaFolha(folha, pose, alfa) {
    const { casa, dpr, judge } = estado
    const dir = ((Math.round(pose.yaw / (Math.PI / 4)) % N_DIR) + N_DIR) % N_DIR
    const col = pose.cartao > 0.001 ? N_RESPIRO + Math.round(pose.cartao * (N_CARTAO - 1)) : Math.floor(pose.fase * N_RESPIRO) % N_RESPIRO
    const sx = col * folha.fw
    const sy = dir * folha.fh
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalAlpha = alfa
    // ancora: o centro da base do Judge, em pixels do aparelho
    const ax = judge.x * casa * dpr
    const ay = judge.y * casa * dpr
    let escala = (casa * dpr) / folha.px
    if (folha.estilo === 'sprite') escala = Math.max(1, Math.round(escala)) // pixel inteiro, sem borrão
    const w = folha.fw * escala
    const h = folha.fh * escala
    const dx = ax - w / 2
    let dy = ay - (QUADRO_A - QUADRO_BASE) * folha.px * escala
    if (pose.surgir < 1) {
      // sai do token: corta abaixo da base e sobe
      ctx.beginPath()
      ctx.rect(dx, 0, w, ay + casa * dpr * 0.18)
      ctx.clip()
      dy += (1 - pose.surgir) * 3.3 * Math.cos(ELEVACAO) * folha.px * escala
    }
    ctx.imageSmoothingEnabled = folha.estilo !== 'sprite'
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(folha.canvas, sx, sy, folha.fw, folha.fh, dx, dy, w, h)
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
  function valorCartao(agora) {
    const c = estado.cartao
    const t = clamp((agora - c.inicio) / c.dur, 0, 1)
    return c.de + (c.para - c.de) * c.curva(t)
  }

  function levantarCartao(agora) {
    const c = estado.cartao
    const atual = valorCartao(agora)
    c.de = estado.reduzir ? 1 : atual
    c.para = 1
    c.inicio = agora
    c.dur = estado.reduzir ? 1 : SUBIR_MS * (1 - atual * 0.6)
    c.curva = curvaSaida
    c.fase = 'subindo'
    c.descerEm = agora + c.dur + SEGURAR_MS
  }

  function atualizarCartao(agora) {
    const c = estado.cartao
    if (c.fase === 'subindo' && agora >= c.descerEm) {
      c.de = estado.reduzir ? 0 : valorCartao(agora)
      c.para = 0
      c.inicio = agora
      c.dur = estado.reduzir ? 1 : DESCER_MS
      c.curva = curvaMeio
      c.fase = 'descendo'
    } else if (c.fase === 'descendo' && agora - c.inicio >= c.dur) {
      c.fase = 'parado'
    }
    return valorCartao(agora)
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

  function passo(agora) {
    const dt = Math.min(0.05, Math.max(0, (agora - ultimo) / 1000))
    ultimo = agora
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
      fase: estado.reduzir ? 0 : (agora / 1000 / M.PERIODO_RESPIRO_S) % 1,
      cartao: atualizarCartao(agora),
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
      const p = progresso.get(chaveFolha(estado.estilo, pxDaFolha(estado.estilo))) || 0
      const texto = `Fotografando a folha ${Math.round(p * 100)}%. Enquanto isso, o 3D ao vivo segura o lugar.`
      if (selo.textContent !== texto) selo.textContent = texto // só reescreve quando o número muda
    }
    const rotulo = rotuloDoMapa(pose)
    if (rotulo !== rotuloAntes) {
      mapaCanvas.setAttribute('aria-label', rotulo)
      rotuloAntes = rotulo
    }
    requestAnimationFrame(passo)
  }

  function desenharVivo(pose, alfa) {
    const estilo = estado.estilo
    M.posar(mundos[estilo].rig, pose)
    vivo.renderer.clippingPlanes = pose.surgir < 1 ? [PLANO_CHAO] : []
    const { casa, dpr } = estado
    let w
    let h
    if (estilo === 'sprite') {
      const k = Math.max(1, Math.round((casa * dpr) / PX_SPRITE))
      w = Math.round((QUADRO_L * casa * dpr) / k)
      h = Math.round((QUADRO_A * casa * dpr) / k)
    } else {
      w = Math.round(QUADRO_L * casa * dpr)
      h = Math.round(QUADRO_A * casa * dpr)
    }
    vivoCanvas.classList.toggle('pixelado', estilo === 'sprite')
    vivoCanvas.style.opacity = String(alfa)
    posicionarVivo()
    pintar(vivo, estilo, w, h)
  }

  function rotuloDoMapa(pose) {
    const f = fichaDaVez()
    const dir = NOMES_DIR[((Math.round(pose.yaw / (Math.PI / 4)) % N_DIR) + N_DIR) % N_DIR]
    const cartao = pose.cartao > 0.5 ? ' Está com o cartão vermelho erguido.' : ''
    return `Mapa de batalha falso, ${COLS} por ${LINHAS} casas. A vez é de ${f.nome}. O Judge está montado na ave, olhando para ${dir}, na direção de ${f.nome}.${cartao}`
  }

  // ---------------- batalha falsa ----------------
  const aviso = $('#aviso')
  const btnProxima = $('#btn-proxima')
  const btnDesfazer = $('#btn-desfazer')
  const btnReiniciar = $('#btn-reiniciar')
  const motivoDesfazer = $('#motivo-desfazer')
  const listaOrdem = $('#ordem')

  function anunciar(texto) {
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
    estado.historico.push(estado.vez)
    estado.vez = (estado.vez + 1) % estado.fichas.length
    marcarVez(performance.now())
    const nome = fichaDaVez().nome
    anunciar(`Vez de ${nome}. O Judge virou para ${nome}.`)
  }

  function desfazer() {
    if (estado.historico.length === 0) return
    estado.vez = estado.historico.pop()
    const agora = performance.now()
    marcarVez(agora)
    levantarCartao(agora)
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
    estado.cartao.fase = 'parado'
    estado.cartao.de = estado.cartao.para = 0
    const agora = performance.now()
    estado.surgir.inicio = agora
    estado.anel.anterior = null
    marcarVez(agora + 260)
    apontarNaHora()
    anunciar(`A batalha começou. O Judge apareceu no canto e olha para ${fichaDaVez().nome}, que tem a vez.`)
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
    if (Math.abs(p.x - j.x) < 0.62 && p.y > j.y - 2.6 && p.y < j.y + 0.46) return j
    return null
  }

  mapaCanvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || estado.arrasto) return
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

  // ---------------- painel ----------------
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

  function atualizarTabela() {
    if (!mundos) return
    const estilo = estado.estilo
    const st = mundos[estilo].estatisticas
    const { casa, dpr } = estado
    const sprite = estilo === 'sprite'
    const k = sprite ? Math.max(1, Math.round((casa * dpr) / PX_SPRITE)) : 1
    const cw = Math.round((QUADRO_L * casa * dpr) / k)
    const ch = Math.round((QUADRO_A * casa * dpr) / k)
    const amostras = sprite ? 2 : 4 // antialias pede 4 amostras; o sprite usa só o alvo baixo
    const memVivo = cw * ch * 8 * amostras + st.bytes
    const chamadas = st.chamadas + (sprite ? 1 : 0)
    $('#th-vivo').classList.toggle('ativo', estado.jeito === 'vivo')
    $('#th-folha').classList.toggle('ativo', estado.jeito === 'folha')
    for (const linha of Object.values(tabela)) {
      linha[0].classList.toggle('ativo', estado.jeito === 'vivo')
      linha[1].classList.toggle('ativo', estado.jeito === 'folha')
    }
    tabela.baixar[0].textContent = `Nada novo: o three.js já vem no app (as transições de batalha usam). O modelo é código, uns ${MODELO_KB} KB.`
    tabela.memoria[0].textContent = `Cerca de ${fmtMB(memVivo)}: um canvas WebGL a mais por cima do mapa, a batalha inteira.`
    tabela.quadro[0].textContent = `Redesenha ${fmtNum(chamadas)} peças e ${fmtNum(st.triangulos)} triângulos.`
    tabela.giro[0].textContent = 'Qualquer ângulo, liso. A cabeça da ave e o elmo viram antes do corpo.'
    tabela.zoom[0].textContent = sprite ? 'Pixel sempre inteiro: o 3D é refeito em ~16 px por casa em qualquer zoom.' : 'Nítido em qualquer zoom.'
    tabela.mudar[0].textContent = 'Mexe no código e pronto.'
    const folha = folhaAtual()
    const px = pxDaFolha(estilo)
    const fw = Math.round(QUADRO_L * px)
    const fh = Math.round(QUADRO_A * px)
    const largura = fw * (N_RESPIRO + N_CARTAO)
    const altura = fh * N_DIR
    tabela.baixar[1].textContent = folha
      ? `Uma folha PNG de ${fmtKB(folha.kb)} (${fmtNum(largura)} x ${fmtNum(altura)} px).`
      : `Uma folha PNG de ${fmtNum(largura)} x ${fmtNum(altura)} px (pesando...).`
    tabela.memoria[1].textContent = `${fmtMB(largura * altura * 4)}: a folha aberta na placa de vídeo.`
    tabela.quadro[1].textContent = 'Copia 1 retângulo da folha. O app nem precisa de 3D.'
    tabela.giro[1].textContent = '8 direções, em passos de 45 graus. A cabeça não vira antes.'
    tabela.zoom[1].textContent = sprite ? 'Pixel inteiro em qualquer zoom: a baixa resolução é o estilo.' : `Nítido até ${px} px por casa; acima disso fica macio.`
    tabela.mudar[1].textContent = 'Mexe no código e fotografa a folha de novo.'
  }

  const folhaMini = $('#folha-mini')
  const folhaInfo = $('#folha-info')
  const btnVerFolha = $('#btn-ver-folha')
  const btnBaixar = $('#btn-baixar')
  const motivoFolha = $('#motivo-folha')

  function atualizarPainelFolha() {
    const estilo = estado.estilo
    const px = pxDaFolha(estilo)
    const folha = folhaAtual()
    const pronta = !!folha
    btnVerFolha.disabled = !pronta
    btnBaixar.disabled = !pronta
    motivoFolha.hidden = pronta
    const g = folhaMini.getContext('2d')
    if (!pronta) {
      const p = progresso.get(chaveFolha(estilo, px)) || 0
      motivoFolha.textContent = `Fotografando a folha: ${Math.round(p * 100)}%. Os botões liberam quando terminar.`
      folhaInfo.textContent = `${NOME[estilo]}, ${px} px por casa.`
      g.clearRect(0, 0, folhaMini.width, folhaMini.height)
      return
    }
    const largura = folhaMini.clientWidth || 320
    const escala = largura / folha.canvas.width
    folhaMini.width = Math.round(largura * estado.dpr)
    folhaMini.height = Math.round(folha.canvas.height * escala * estado.dpr)
    folhaMini.style.height = Math.round(folha.canvas.height * escala) + 'px'
    g.imageSmoothingEnabled = true
    g.imageSmoothingQuality = 'high'
    g.drawImage(folha.canvas, 0, 0, folhaMini.width, folhaMini.height)
    folhaInfo.textContent = `${NOME[estilo]}, ${px} px por casa: ${fmtKB(folha.kb)}, ${folha.canvas.width} x ${folha.canvas.height} px. Linhas: as 8 direções. Colunas: 12 quadros respirando e 8 do cartão.`
  }

  const dlg = $('#dlg-folha')
  btnVerFolha.addEventListener('click', () => {
    const folha = folhaAtual()
    if (!folha) return
    const tela = $('#dlg-canvas')
    const ampliar = folha.estilo === 'sprite' ? 2 : 1
    const margem = 64
    tela.width = folha.canvas.width * ampliar + margem
    tela.height = folha.canvas.height * ampliar + 28
    const g = tela.getContext('2d')
    g.fillStyle = '#141417'
    g.fillRect(0, 0, tela.width, tela.height)
    g.imageSmoothingEnabled = false
    // xadrez claro atrás do quadro, para ver o que é transparente
    g.fillStyle = '#1d1d22'
    g.fillRect(margem, 28, folha.canvas.width * ampliar, folha.canvas.height * ampliar)
    g.drawImage(folha.canvas, margem, 28, folha.canvas.width * ampliar, folha.canvas.height * ampliar)
    g.fillStyle = '#a2a09a'
    g.font = '12px Bahnschrift, "Segoe UI", sans-serif'
    g.textBaseline = 'middle'
    for (let d = 0; d < N_DIR; d++) g.fillText(NOMES_DIR[d], 6, 28 + (d + 0.5) * folha.fh * ampliar)
    g.fillText('respirando (12 quadros)', margem + 4, 14)
    g.fillText('cartão (8 quadros)', margem + N_RESPIRO * folha.fw * ampliar + 4, 14)
    g.strokeStyle = 'rgba(224, 164, 74, 0.6)'
    g.beginPath()
    g.moveTo(margem + N_RESPIRO * folha.fw * ampliar + 0.5, 22)
    g.lineTo(margem + N_RESPIRO * folha.fw * ampliar + 0.5, tela.height)
    g.stroke()
    $('#dlg-titulo').textContent = `Folha: ${NOME[folha.estilo]}, ${folha.px} px por casa, ${fmtKB(folha.kb)}`
    dlg.showModal()
  })
  $('#dlg-fechar').addEventListener('click', () => dlg.close())

  const dlgComparar = $('#dlg-comparar')
  const PX_COMPARAR = 96 // 6 x 16: o sprite amplia por inteiro e fica do mesmo tamanho
  $('#btn-comparar').addEventListener('click', () => {
    const tela = $('#comparar-canvas')
    const fw = QUADRO_L * PX_COMPARAR
    const fh = QUADRO_A * PX_COMPARAR
    const poses = [
      { yaw: 0.55, cartao: 1, fase: 0.3 },
      { yaw: 2.45, cartao: 0, fase: 0.3 },
    ]
    tela.width = fw * ESTILOS.length
    tela.height = fh * poses.length
    const g = tela.getContext('2d')
    ESTILOS.forEach((estilo, i) => {
      poses.forEach((p, j) => {
        const x = i * fw
        const y = j * fh
        // chão de pedra e a base do token, vistos na mesma 3/4 da câmera
        const fundo = g.createRadialGradient(x + fw / 2, y + fh * 0.8, 10, x + fw / 2, y + fh * 0.8, fw * 0.9)
        fundo.addColorStop(0, '#e3d8c0')
        fundo.addColorStop(1, '#b9ab90')
        g.fillStyle = fundo
        g.fillRect(x, y, fw, fh)
        const ax = x + fw / 2
        const ay = y + fh - QUADRO_BASE * PX_COMPARAR
        g.fillStyle = '#2b3240'
        g.strokeStyle = '#c9d0d9'
        g.lineWidth = 3
        g.beginPath()
        g.ellipse(ax, ay, PX_COMPARAR * 0.43, PX_COMPARAR * 0.43 * Math.sin(ELEVACAO), 0, 0, Math.PI * 2)
        g.fill()
        g.stroke()
        M.posar(mundos[estilo].rig, { ...p, olharAve: 0, olharJuiz: 0, surgir: 1 })
        if (estilo === 'sprite') {
          const k = PX_COMPARAR / PX_SPRITE
          pintar(foto, estilo, fw / k, fh / k)
          g.imageSmoothingEnabled = false
          g.drawImage(foto.renderer.domElement, 0, 0, fw / k, fh / k, x, y, fw, fh)
        } else {
          pintar(foto, estilo, fw, fh)
          g.drawImage(foto.renderer.domElement, x, y)
        }
      })
    })
    dlgComparar.showModal()
  })
  $('#dlg-comparar-fechar').addEventListener('click', () => dlgComparar.close())

  btnBaixar.addEventListener('click', () => {
    const folha = folhaAtual()
    if (!folha) return
    const url = URL.createObjectURL(folha.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `judge-${folha.estilo}-${folha.px}px.png`
    document.body.append(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    anunciar(`Baixando ${a.download} (${fmtKB(folha.kb)}).`)
  })

  function escolherEstilo(estilo) {
    estado.estilo = estilo
    const radio = document.querySelector(`input[name="estilo"][value="${estilo}"]`)
    if (radio) radio.checked = true
    const sprite = estilo === 'sprite'
    for (const r of document.querySelectorAll('input[name="pxfolha"]')) r.disabled = sprite
    $('#motivo-px').hidden = !sprite
    obterFolha(estilo, pxDaFolha(estilo))
    atualizarTabela()
    atualizarPainelFolha()
  }

  function escolherJeito(jeito) {
    estado.jeito = jeito
    const radio = document.querySelector(`input[name="jeito"][value="${jeito}"]`)
    if (radio) radio.checked = true
    if (jeito === 'folha') obterFolha(estado.estilo, pxDaFolha(estado.estilo))
    atualizarTabela()
  }

  for (const r of document.querySelectorAll('input[name="estilo"]')) r.addEventListener('change', () => escolherEstilo(r.value))
  for (const r of document.querySelectorAll('input[name="jeito"]')) r.addEventListener('change', () => escolherJeito(r.value))
  for (const r of document.querySelectorAll('input[name="pxfolha"]')) {
    r.addEventListener('change', () => {
      estado.pxFolha = Number(r.value)
      obterFolha(estado.estilo, pxDaFolha(estado.estilo))
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
    if (dlg.open || dlgComparar.open || e.altKey || e.repeat) return
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
    else if (k === '1' || k === '2' || k === '3') escolherEstilo(ESTILOS[Number(k) - 1])
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

  // ---------------- retratos dos estilos ----------------
  function pintarRetratos() {
    for (const estilo of ESTILOS) {
      const px = estilo === 'sprite' ? PX_SPRITE : PX_RETRATO
      const fw = Math.round(QUADRO_L * px)
      const fh = Math.round(QUADRO_A * px)
      M.posar(mundos[estilo].rig, { yaw: 0.55, fase: 0.3, cartao: 1, olharAve: 0, olharJuiz: 0, surgir: 1 })
      pintar(foto, estilo, fw, fh)
      const alvo = document.querySelector(`canvas[data-retrato="${estilo}"]`)
      alvo.width = fw
      alvo.height = fh
      alvo.getContext('2d').drawImage(foto.renderer.domElement, 0, 0)
    }
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
  function falhar(motivo) {
    document.body.classList.add('sem-webgl')
    $('#erro-webgl-motivo').textContent = motivo
    $('#erro-webgl').hidden = false
  }

  function iniciar() {
    try {
      vivo = criarPintor(vivoCanvas, false)
      foto = criarPintor(document.createElement('canvas'), true)
    } catch (erro) {
      falhar('Este navegador não liberou o WebGL, que o 3D precisa. Abra no Chrome ou no Edge do PC, com a aceleração de hardware ligada.')
      return
    }
    mundos = {}
    for (const estilo of ESTILOS) mundos[estilo] = M.criarCena(estilo)
    aplicarReduzir(estado.reduzir)
    zoomValor.textContent = `${estado.casa} px por casa`
    dimensionar()
    pintarRetratos()
    escolherEstilo(estado.estilo)
    escolherJeito(estado.jeito)
    desenharOrdem()
    iniciarBatalha()
    requestAnimationFrame((t) => {
      ultimo = t
      passo(t)
    })
    // as outras folhas saem em segundo plano, uma por vez
    ;(async () => {
      for (const estilo of ESTILOS) await obterFolha(estilo, pxDaFolha(estilo))
    })()
  }

  window.JudgePrototipo = {
    /** Usado por ferramentas/gerar-folhas.cjs para salvar as folhas em folhas/. */
    async folhaEmBase64(estilo, px) {
      const folha = await obterFolha(estilo, px)
      return { base64: await blobParaBase64(folha.blob), kb: folha.kb, largura: folha.canvas.width, altura: folha.canvas.height }
    },
    estatisticas() {
      const r = {}
      for (const e of ESTILOS) r[e] = mundos[e].estatisticas
      return r
    },
  }

  iniciar()
})()
