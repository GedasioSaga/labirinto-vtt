/*
 * Judge v2: vista grande, batalha falsa e folha de quadros.
 * Script clássico (abre por file://). Depende de ../vendor/three.min.js, escultura.js e modelo.js.
 *
 * Três canvas WebGL, cada um com a sua cópia do Judge (as malhas são esculpidas uma vez
 * e compartilhadas):
 *  - vista grande: gira com o mouse, luz de pintura, pincelada opcional;
 *  - 3D ao vivo na mesa: um canvas por cima do mapa, como seria no app;
 *  - fotógrafo: tira a folha de quadros (8 direções x 20 quadros) que o mapa pode usar no lugar.
 * Os dois jeitos da mesa usam a MESMA função de pose (JudgeV2.posar).
 */
;(function () {
  'use strict'
  const T = THREE
  const J = window.JudgeV2
  const E = window.Escultura

  // ---------------- medidas da mesa ----------------
  const QUADRO_L = 3 // largura do quadro do Judge, em casas
  const QUADRO_A = 3.75 // altura (cabe o cartão erguido)
  const QUADRO_BASE = 0.62 // do pé do quadro até o centro da base
  const ELEVACAO = (30 * Math.PI) / 180 // câmera 3/4 da mesa
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
  const VOLTA_VISTA_MS = 300
  const MOLA_CORPO = 7 // rad/s: um giro de 90 graus assenta em ~0,7 s, sem passar do ponto
  const MOLA_CABECA = 16
  const MOLA_ELMO = 12
  const LIMITE_OLHAR_AVE = 0.55
  const LIMITE_OLHAR_JUIZ = 0.5

  // ---------------- vista grande ----------------
  const VISTA_INICIAL = { yaw: 0.95, elev: 0.1, dist: 6.6 }
  const ELEV_MIN = -0.12
  const ELEV_MAX = 0.62
  const DIST_MIN = 3.6
  const DIST_MAX = 10
  const ALVO_Y = 1.32 // a câmera mira no meio do Judge com o cartão erguido
  const ALTURA_BASE = 0.05 // espessura da base do token na vista grande
  const ATRITO_GIRO = 4.5 // o giro solto perde velocidade assim (1/s)

  // ---------------- custo (medido fora da página) ----------------
  const MODELO_KB = 97 // escultura.js + modelo.js

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
    pronto: false,
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
    segundosEsculpir: 0,
  }

  /** O cartão: sobe com ease-out, segura e desce com ease-in-out (interrompível). */
  function novoCartao() {
    return { de: 0, para: 0, inicio: 0, dur: 1, curva: null, fase: 'parado', descerEm: 0 }
  }
  function valorCartao(c, agora) {
    if (!c.curva) return c.para
    const t = clamp((agora - c.inicio) / c.dur, 0, 1)
    return c.de + (c.para - c.de) * c.curva(t)
  }
  function moverCartao(c, agora, para, segurar) {
    const atual = valorCartao(c, agora)
    const sobe = para > atual
    c.de = estado.reduzir ? para : atual
    c.para = para
    c.inicio = agora
    // reduzido: sem varrer o braço, o cartão só aparece ou some
    c.dur = estado.reduzir ? 1 : sobe ? SUBIR_MS * (1 - atual * 0.6) : DESCER_MS * Math.max(0.3, atual)
    c.curva = sobe ? curvaSaida : curvaMeio
    c.fase = sobe ? 'subindo' : 'descendo'
    c.descerEm = segurar ? agora + c.dur + SEGURAR_MS : Infinity
  }
  function atualizarCartao(c, agora) {
    if (c.fase === 'subindo' && agora >= c.descerEm) moverCartao(c, agora, 0, false)
    else if (c.fase === 'descendo' && agora - c.inicio >= c.dur) c.fase = 'parado'
    return valorCartao(c, agora)
  }

  // ---------------- 3D: recursos e cenas ----------------
  let rec = null // malhas esculpidas, compartilhadas pelas três cenas
  let grande = null
  let vivo = null
  let foto = null
  const cameraMesa = criarCameraMesa()
  const PLANO_CHAO = new T.Plane(new T.Vector3(0, 1, 0), 0)

  function criarCameraMesa() {
    const cam = new T.OrthographicCamera(-QUADRO_L / 2, QUADRO_L / 2, QUADRO_A - QUADRO_BASE, -QUADRO_BASE, 0.1, 60)
    cam.position.set(0, Math.sin(ELEVACAO) * 25, Math.cos(ELEVACAO) * 25)
    cam.lookAt(0, 0, 0)
    cam.updateProjectionMatrix()
    cam.updateMatrixWorld()
    return cam
  }

  function criarRenderer(canvas, opcoes) {
    const r = new T.WebGLRenderer({ canvas, antialias: true, alpha: opcoes.alpha, premultipliedAlpha: true, preserveDrawingBuffer: !!opcoes.preservar })
    J.prepararRenderer(r)
    r.setPixelRatio(1)
    if (opcoes.alpha) r.setClearColor(0x000000, 0)
    return r
  }

  /** Uma cena com luz de pintura e uma cópia do Judge. */
  function criarMundo(renderer, tamanhoSombra) {
    const cena = new T.Scene()
    const luzes = J.montarLuzes(cena, renderer, rec, tamanhoSombra)
    const rig = J.criarJudge(rec)
    return { renderer, cena, luzes, rig, w: 0, h: 0 }
  }

  function tamanho(m, w, h) {
    if (m.w === w && m.h === h) return
    m.renderer.setSize(w, h, false)
    m.w = w
    m.h = h
  }

  // ---------------- pincelada (filtro de Kuwahara) ----------------
  const KUWAHARA = [
    'uniform sampler2D tCor;',
    'uniform vec2 texel;',
    'varying vec2 vUv;',
    'vec4 setor(vec2 dir) {',
    '  vec3 soma = vec3(0.0);',
    '  vec3 soma2 = vec3(0.0);',
    '  for (int j = 0; j <= 3; j++) {',
    '    for (int i = 0; i <= 3; i++) {',
    '      vec3 c = texture2D(tCor, vUv + vec2(float(i) * dir.x, float(j) * dir.y) * texel).rgb;',
    '      soma += c;',
    '      soma2 += c * c;',
    '    }',
    '  }',
    '  vec3 m = soma / 16.0;',
    '  vec3 v = abs(soma2 / 16.0 - m * m);',
    '  return vec4(m, v.r + v.g + v.b);',
    '}',
    'void main() {',
    '  vec4 a = setor(vec2(-1.0, -1.0));',
    '  vec4 b = setor(vec2(1.0, -1.0));',
    '  vec4 c = setor(vec2(-1.0, 1.0));',
    '  vec4 d = setor(vec2(1.0, 1.0));',
    // pesos suaves: o setor mais liso manda, sem quinas de bloco
    '  float wa = 1.0 / pow(0.002 + a.w * 12.0, 2.0);',
    '  float wb = 1.0 / pow(0.002 + b.w * 12.0, 2.0);',
    '  float wc = 1.0 / pow(0.002 + c.w * 12.0, 2.0);',
    '  float wd = 1.0 / pow(0.002 + d.w * 12.0, 2.0);',
    '  vec3 cor = (a.rgb * wa + b.rgb * wb + c.rgb * wc + d.rgb * wd) / (wa + wb + wc + wd);',
    '  gl_FragColor = vec4(cor, 1.0);',
    '  #include <tonemapping_fragment>',
    '  #include <colorspace_fragment>',
    '}',
  ].join('\n')

  function criarPincelada() {
    const material = new T.ShaderMaterial({
      uniforms: { tCor: { value: null }, texel: { value: new T.Vector2(1, 1) } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: KUWAHARA,
      depthTest: false,
      depthWrite: false,
    })
    const malha = new T.Mesh(new T.PlaneGeometry(2, 2), material)
    malha.frustumCulled = false
    const cena = new T.Scene()
    cena.add(malha)
    return { material, cena, camera: new T.Camera(), rt: null }
  }

  // ======================================================================
  // Vista grande
  // ======================================================================
  const vistaEl = $('#vista')
  const vistaCanvas = $('#vista-canvas')
  const vistaRotulo = $('#vista-rotulo')
  const btnCartaoGrande = $('#btn-cartao-grande')
  const btnPincelada = $('#btn-pincelada')
  const btnVistaInicial = $('#btn-vista-inicial')
  const vista = {
    yaw: VISTA_INICIAL.yaw,
    elev: VISTA_INICIAL.elev,
    dist: VISTA_INICIAL.dist,
    alvoY: ALVO_Y, // altura para onde a câmera mira (fixa na página; dá para mirar nos pés ao conferir)
    giro: 0, // velocidade do giro solto (rad/s)
    arrasto: null,
    volta: null,
    cartao: novoCartao(),
    erguido: true,
    pincelada: false,
    visivel: true,
  }
  vista.cartao.para = 1 // abre como na pintura: cartão no alto

  function montarGrande() {
    const renderer = criarRenderer(vistaCanvas, { alpha: false })
    const m = criarMundo(renderer, 2048)
    m.cena.background = E.texturaFundo()
    // a base do token, maior, e um chão de lajes que some nas bordas
    const pedestal = new T.Group()
    pedestal.position.y = ALTURA_BASE
    pedestal.add(m.rig.raiz)
    m.cena.add(pedestal)
    const matBase = new T.MeshStandardMaterial({ color: 0x2b3240, roughness: 0.55, metalness: 0.35 })
    const base = new T.Mesh(new T.CylinderGeometry(0.62, 0.66, ALTURA_BASE, 72), matBase)
    base.position.y = ALTURA_BASE / 2
    base.receiveShadow = true
    base.castShadow = true
    const aro = new T.Mesh(new T.TorusGeometry(0.62, 0.018, 10, 96), new T.MeshStandardMaterial({ color: 0xc9d0d9, roughness: 0.3, metalness: 1 }))
    aro.rotation.x = Math.PI / 2
    aro.position.y = ALTURA_BASE
    const anel = new T.Mesh(new T.RingGeometry(0.47, 0.5, 96), new T.MeshStandardMaterial({ color: 0x43639a, roughness: 0.6 }))
    anel.rotation.x = -Math.PI / 2
    anel.position.y = ALTURA_BASE + 0.001
    anel.receiveShadow = true
    const texChao = E.texturaChao()
    texChao.wrapS = texChao.wrapT = T.RepeatWrapping
    texChao.repeat.set(3, 3)
    const chao = new T.Mesh(
      new T.CircleGeometry(4.2, 96),
      new T.MeshStandardMaterial({ map: texChao, alphaMap: E.texturaSumir(), transparent: true, roughness: 0.92, color: 0x9aa3b8, depthWrite: false })
    )
    chao.rotation.x = -Math.PI / 2
    chao.receiveShadow = true
    m.cena.add(base, aro, anel, chao)
    m.camera = new T.PerspectiveCamera(28, 1, 0.1, 60)
    m.pincelada = criarPincelada()
    return m
  }

  function posicionarCameraGrande() {
    const c = grande.camera
    const ce = Math.cos(vista.elev)
    c.position.set(0, vista.alvoY + Math.sin(vista.elev) * vista.dist, ce * vista.dist)
    c.lookAt(0, vista.alvoY, 0)
  }

  function nomeDaVista() {
    // a câmera está em +z; o Judge olha para (sin yaw, cos yaw)
    const passo = ((Math.round(embrulhar(vista.yaw) / (Math.PI / 4)) % 8) + 8) % 8
    const nomes = [
      'de frente',
      'três quartos, olhando para a direita',
      'de lado, olhando para a direita',
      'de costas, três quartos à direita',
      'de costas',
      'de costas, três quartos à esquerda',
      'de lado, olhando para a esquerda',
      'três quartos, olhando para a esquerda',
    ]
    return nomes[passo]
  }

  function desenharGrande(agora, dt) {
    if (!grande || !vista.visivel) return
    const w = Math.max(1, Math.round(vistaCanvas.clientWidth * estado.dpr))
    const h = Math.max(1, Math.round(vistaCanvas.clientHeight * estado.dpr))
    tamanho(grande, w, h)
    if (grande.camera.aspect !== w / h) {
      grande.camera.aspect = w / h
      grande.camera.updateProjectionMatrix()
    }
    // giro solto depois de soltar o arrasto, e a volta para a vista inicial
    if (vista.volta) {
      const v = vista.volta
      const t = clamp((agora - v.inicio) / VOLTA_VISTA_MS, 0, 1)
      const k = curvaSaida(t)
      vista.yaw = v.de.yaw + (v.para.yaw - v.de.yaw) * k
      vista.elev = v.de.elev + (v.para.elev - v.de.elev) * k
      vista.dist = v.de.dist + (v.para.dist - v.de.dist) * k
      if (t >= 1) vista.volta = null
    } else if (!vista.arrasto && vista.giro !== 0) {
      vista.yaw += vista.giro * dt
      vista.giro *= Math.exp(-ATRITO_GIRO * dt)
      if (Math.abs(vista.giro) < 0.02) vista.giro = 0
    }
    posicionarCameraGrande()
    const c = atualizarCartao(vista.cartao, agora)
    J.posar(grande.rig, {
      yaw: vista.yaw,
      fase: estado.reduzir ? 0.25 : (agora / 1000 / J.PERIODO_RESPIRO_S) % 1,
      cartao: c,
      olharAve: 0,
      olharJuiz: 0,
      surgir: 1,
      inclinacaoCartao: -vista.elev - 0.12,
    })
    const r = grande.renderer
    if (vista.pincelada) {
      const p = grande.pincelada
      if (!p.rt || p.rt.width !== w || p.rt.height !== h) {
        if (p.rt) p.rt.dispose()
        p.rt = new T.WebGLRenderTarget(w, h, { type: T.HalfFloatType, samples: 4 })
      }
      r.setRenderTarget(p.rt)
      r.render(grande.cena, grande.camera)
      r.setRenderTarget(null)
      p.material.uniforms.tCor.value = p.rt.texture
      // o pincel cresce um pouco com a tela, para não sumir em monitor de alta densidade
      p.material.uniforms.texel.value.set(estado.dpr / w, estado.dpr / h)
      r.render(p.cena, p.camera)
    } else {
      r.setRenderTarget(null)
      r.render(grande.cena, grande.camera)
    }
  }

  function anunciarVista() {
    const texto = `Vista: ${nomeDaVista()}.`
    if (vistaRotulo.textContent !== texto) vistaRotulo.textContent = texto
  }

  function girarVista(passo) {
    // teclado: passo de 45 graus na hora, sem animação
    vista.volta = null
    vista.giro = 0
    vista.yaw = Math.round(vista.yaw / (Math.PI / 4)) * (Math.PI / 4) + passo * (Math.PI / 4)
    anunciarVista()
  }

  function voltarVista() {
    vista.giro = 0
    vista.alvoY = ALVO_Y
    const para = { yaw: vista.yaw + embrulhar(VISTA_INICIAL.yaw - vista.yaw), elev: VISTA_INICIAL.elev, dist: VISTA_INICIAL.dist }
    if (estado.reduzir) {
      Object.assign(vista, para)
      vista.volta = null
    } else {
      vista.volta = { de: { yaw: vista.yaw, elev: vista.elev, dist: vista.dist }, para, inicio: performance.now() }
    }
    vistaRotulo.textContent = 'Vista inicial: três quartos, olhando para a direita, como na pintura.'
  }

  function alternarCartaoGrande() {
    vista.erguido = !vista.erguido
    moverCartao(vista.cartao, performance.now(), vista.erguido ? 1 : 0, false)
    btnCartaoGrande.setAttribute('aria-pressed', String(vista.erguido))
    btnCartaoGrande.querySelector('.rotulo').textContent = vista.erguido ? 'Baixar o cartão' : 'Erguer o cartão'
  }

  function alternarPincelada() {
    vista.pincelada = !vista.pincelada
    btnPincelada.setAttribute('aria-pressed', String(vista.pincelada))
  }

  vistaEl.addEventListener('pointerdown', (e) => {
    if (!grande || e.button !== 0 || vista.arrasto) return
    e.preventDefault()
    vistaEl.focus({ preventScroll: true })
    vistaEl.setPointerCapture(e.pointerId)
    vista.volta = null
    vista.giro = 0
    vista.arrasto = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw: vista.yaw, elev: vista.elev, ultX: e.clientX, ultT: performance.now(), vel: 0 }
    vistaEl.classList.add('arrastando')
  })
  vistaEl.addEventListener('pointermove', (e) => {
    const a = vista.arrasto
    if (!a || e.pointerId !== a.id) return
    const agora = performance.now()
    vista.yaw = a.yaw + (e.clientX - a.x) * 0.0095
    vista.elev = clamp(a.elev + (e.clientY - a.y) * 0.005, ELEV_MIN, ELEV_MAX)
    const dt = Math.max(1, agora - a.ultT) / 1000
    const vel = ((e.clientX - a.ultX) * 0.0095) / dt
    a.vel = a.vel * 0.6 + vel * 0.4 // média curta: o último gesto manda
    a.ultX = e.clientX
    a.ultT = agora
  })
  function soltarVista(e) {
    const a = vista.arrasto
    if (!a || e.pointerId !== a.id) return
    vista.arrasto = null
    vistaEl.classList.remove('arrastando')
    // o giro continua com o embalo da mão e para sozinho (sem embalo no movimento reduzido)
    const parado = performance.now() - a.ultT > 90
    vista.giro = estado.reduzir || parado ? 0 : clamp(a.vel, -9, 9)
    anunciarVista()
  }
  vistaEl.addEventListener('pointerup', soltarVista)
  vistaEl.addEventListener('pointercancel', soltarVista)
  vistaEl.addEventListener(
    'wheel',
    (e) => {
      if (!grande) return
      e.preventDefault()
      vista.volta = null
      vista.dist = clamp(vista.dist * Math.exp(e.deltaY * 0.0012), DIST_MIN, DIST_MAX)
    },
    { passive: false }
  )
  vistaEl.addEventListener('dblclick', voltarVista)
  vistaEl.addEventListener('keydown', (e) => {
    if (!grande || e.altKey || e.ctrlKey || e.metaKey) return
    let usou = true
    if (e.key === 'ArrowLeft') girarVista(-1)
    else if (e.key === 'ArrowRight') girarVista(1)
    else if (e.key === 'ArrowUp') vista.elev = clamp(vista.elev + 0.1, ELEV_MIN, ELEV_MAX)
    else if (e.key === 'ArrowDown') vista.elev = clamp(vista.elev - 0.1, ELEV_MIN, ELEV_MAX)
    else if (e.key === '+' || e.key === '=') vista.dist = clamp(vista.dist / 1.15, DIST_MIN, DIST_MAX)
    else if (e.key === '-' || e.key === '_') vista.dist = clamp(vista.dist * 1.15, DIST_MIN, DIST_MAX)
    else if (e.key === 'Home') voltarVista()
    else usou = false
    if (usou) {
      e.preventDefault()
      e.stopPropagation()
    }
  })
  btnCartaoGrande.addEventListener('click', alternarCartaoGrande)
  btnPincelada.addEventListener('click', alternarPincelada)
  btnVistaInicial.addEventListener('click', voltarVista)

  // ======================================================================
  // Mesa: mapa 2D com o Judge por cima (3D ao vivo ou quadros da folha)
  // ======================================================================
  const mapa = $('#mapa')
  const mapaCanvas = $('#mapa-canvas')
  const ctx = mapaCanvas.getContext('2d')
  const vivoCanvas = $('#judge-vivo')
  const selo = $('#selo')
  let chao = null
  let mesaVisivel = true

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
    const tamanhoSombra = 0.35 + 0.65 * pose.surgir
    ctx.fillStyle = 'rgba(48, 38, 28, 0.3)'
    ctx.beginPath()
    ctx.ellipse(cx + casa * 0.06, cy + casa * 0.05, casa * 0.78 * tamanhoSombra, casa * 0.4 * tamanhoSombra, giro, 0, Math.PI * 2)
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
    // âncora: o centro da base do Judge, em pixels do aparelho
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
      dy += (1 - pose.surgir) * 3.4 * Math.cos(ELEVACAO) * folha.px * escala
    }
    ctx.imageSmoothingEnabled = true
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
    if (estado.pronto) desenharBaseJudge(pose, agora)
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

  function poseDaMesa(agora, dt) {
    const yaw = estado.yaw
    const alvo = yaw.x + embrulhar(yawDesejado() - yaw.x)
    if (estado.reduzir) {
      yaw.x = alvo
      yaw.v = 0
      estado.olharAve.x = estado.olharJuiz.x = 0
    } else {
      mola(yaw, alvo, MOLA_CORPO, dt)
      // a cabeça da ave e o elmo chegam antes do corpo
      const falta = embrulhar(alvo - yaw.x)
      mola(estado.olharAve, clamp(falta, -LIMITE_OLHAR_AVE, LIMITE_OLHAR_AVE), MOLA_CABECA, dt)
      mola(estado.olharJuiz, clamp(falta, -LIMITE_OLHAR_JUIZ, LIMITE_OLHAR_JUIZ), MOLA_ELMO, dt)
    }
    return {
      yaw: yaw.x,
      fase: estado.reduzir ? 0 : (agora / 1000 / J.PERIODO_RESPIRO_S) % 1,
      cartao: atualizarCartao(estado.cartao, agora),
      olharAve: estado.olharAve.x,
      olharJuiz: estado.olharJuiz.x,
      surgir: valorSurgir(agora),
    }
  }

  function desenharVivo(pose, alfa) {
    J.posar(vivo.rig, pose)
    vivo.renderer.clippingPlanes = pose.surgir < 1 ? [PLANO_CHAO] : []
    const { casa, dpr } = estado
    const w = Math.round(QUADRO_L * casa * dpr)
    const h = Math.round(QUADRO_A * casa * dpr)
    vivoCanvas.style.opacity = String(alfa)
    posicionarVivo()
    tamanho(vivo, w, h)
    vivo.renderer.render(vivo.cena, cameraMesa)
  }

  function rotuloDoMapa(pose) {
    const f = fichaDaVez()
    if (!estado.pronto) return `Mapa de batalha falso, ${COLS} por ${LINHAS} casas. A vez é de ${f.nome}. O Judge ainda está sendo esculpido.`
    const dir = NOMES_DIR[((Math.round(pose.yaw / (Math.PI / 4)) % N_DIR) + N_DIR) % N_DIR]
    const cartao = pose.cartao > 0.5 ? ' Está com o cartão vermelho erguido.' : ''
    return `Mapa de batalha falso, ${COLS} por ${LINHAS} casas. A vez é de ${f.nome}. O Judge está montado no grifo, olhando para ${dir}, na direção de ${f.nome}.${cartao}`
  }

  // ---------------- laço de quadros ----------------
  let ultimo = performance.now()
  let rotuloAntes = ''

  function passo(agora) {
    const dt = Math.min(0.05, Math.max(0, (agora - ultimo) / 1000))
    ultimo = agora
    animarEncaixes(agora)
    if (estado.pronto) {
      const pose = poseDaMesa(agora, dt)
      const folha = estado.jeito === 'folha' ? folhaAtual() : null
      const alfa = alfaJudge(agora)
      if (mesaVisivel) {
        desenharMapa(pose, agora, folha, alfa)
        const mostrarVivo = !folha
        vivoCanvas.hidden = !mostrarVivo
        if (mostrarVivo) desenharVivo(pose, alfa)
      }
      selo.hidden = !(estado.jeito === 'folha' && !folha)
      if (!selo.hidden) {
        const p = progressoFolha.get(estado.pxFolha) || 0
        const texto = `Fotografando a folha ${Math.round(p * 100)}%. Enquanto isso, o 3D ao vivo segura o lugar.`
        if (selo.textContent !== texto) selo.textContent = texto
      }
      desenharGrande(agora, dt)
      const rotulo = rotuloDoMapa(pose)
      if (rotulo !== rotuloAntes) {
        mapaCanvas.setAttribute('aria-label', rotulo)
        rotuloAntes = rotulo
      }
    } else if (mesaVisivel) {
      desenharMapa(null, agora, null, 1)
    }
    requestAnimationFrame(passo)
  }

  // ---------------- batalha falsa ----------------
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
    btnDesfazer.disabled = vazio || !estado.pronto
    motivoDesfazer.hidden = !vazio
  }

  function proximaVez() {
    if (!estado.pronto) return
    estado.historico.push(estado.vez)
    estado.vez = (estado.vez + 1) % estado.fichas.length
    marcarVez(performance.now())
    const nome = fichaDaVez().nome
    anunciar(`Vez de ${nome}. O Judge virou para ${nome}.`)
  }

  function desfazer() {
    if (!estado.pronto || estado.historico.length === 0) return
    estado.vez = estado.historico.pop()
    const agora = performance.now()
    marcarVez(agora)
    moverCartao(estado.cartao, agora, 1, true)
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
  btnReiniciar.addEventListener('click', () => {
    if (estado.pronto) iniciarBatalha()
  })

  // ---------------- arrastar fichas ----------------
  function pontoNoMapa(e) {
    const r = mapaCanvas.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * COLS, y: ((e.clientY - r.top) / r.height) * LINHAS }
  }

  function quemEsta(p) {
    const ficha = estado.fichas.find((f) => Math.hypot(f.x - p.x, f.y - p.y) < 0.44)
    if (ficha) return ficha
    if (!estado.pronto) return null
    const j = estado.judge
    // o Judge se pega pela base ou pelo corpo, que sobe acima da base
    if (Math.abs(p.x - j.x) < 0.7 && p.y > j.y - 2.5 && p.y < j.y + 0.46) return j
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

  // ======================================================================
  // Folha de quadros
  // ======================================================================
  const folhas = new Map() // px -> Promise da folha
  const prontas = new Map() // px -> folha pronta
  const progressoFolha = new Map() // px -> 0..1
  const proximoQuadro = () => new Promise((ok) => requestAnimationFrame(() => ok()))
  let filaFoto = Promise.resolve()

  function obterFolha(px) {
    if (!folhas.has(px)) {
      // uma folha por vez: o fotógrafo é um canvas só
      const p = filaFoto.then(() => fotografar(px))
      filaFoto = p.catch(() => {})
      folhas.set(px, p)
    }
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
    progressoFolha.set(px, 0)
    tamanho(foto, fw, fh)
    for (let d = 0; d < N_DIR; d++) {
      for (let k = 0; k < colunas; k++) {
        const ehCartao = k >= N_RESPIRO
        J.posar(foto.rig, {
          yaw: (d * Math.PI) / 4,
          fase: ehCartao ? 0 : k / N_RESPIRO,
          cartao: ehCartao ? (k - N_RESPIRO) / (N_CARTAO - 1) : 0,
          olharAve: 0,
          olharJuiz: 0,
          surgir: 1,
        })
        foto.renderer.render(foto.cena, cameraMesa)
        g.drawImage(foto.renderer.domElement, k * fw, d * fh)
        feitos++
        if (feitos % 8 === 0) {
          progressoFolha.set(px, feitos / total)
          if (px === estado.pxFolha) atualizarPainelFolha()
          await proximoQuadro()
        }
      }
    }
    const blob = await new Promise((ok, erro) => canvas.toBlob((b) => (b ? ok(b) : erro(new Error('O navegador não gerou o PNG.'))), 'image/png'))
    const folha = { px, canvas, blob, kb: blob.size / 1024, fw, fh, colunas }
    prontas.set(px, folha)
    progressoFolha.set(px, 1)
    atualizarPainelFolha()
    atualizarTabela()
    return folha
  }

  const folhaAtual = () => prontas.get(estado.pxFolha) || null

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
  const fmtDec = (n, casas) => n.toFixed(casas).replace('.', ',')
  const fmtKB = (kb) => (kb < 1000 ? `${fmtNum(kb)} KB` : `${fmtDec(kb / 1024, 1)} MB`)
  const fmtMB = (bytes) => `${fmtDec(bytes / 1048576, 1)} MB`

  function bytesDasMalhas() {
    let total = 0
    const somar = (g) => {
      for (const nome in g.attributes) total += g.attributes[nome].array.byteLength
      if (g.index) total += g.index.array.byteLength
    }
    for (const s of rec.solidos) somar(s.geo)
    for (const s of rec.penas) somar(s.geo)
    somar(rec.capa.geo)
    return total
  }

  function atualizarTabela() {
    if (!estado.pronto) return
    const { casa, dpr } = estado
    const st = J.contar(vivo.rig.raiz)
    const cw = Math.round(QUADRO_L * casa * dpr)
    const ch = Math.round(QUADRO_A * casa * dpr)
    const memVivo = cw * ch * 8 * 4 + bytesDasMalhas() + 1024 * 1024 * 4 // canvas com MSAA + malhas + mapa de sombra
    $('#th-vivo').classList.toggle('ativo', estado.jeito === 'vivo')
    $('#th-folha').classList.toggle('ativo', estado.jeito === 'folha')
    for (const linha of Object.values(tabela)) {
      linha[0].classList.toggle('ativo', estado.jeito === 'vivo')
      linha[1].classList.toggle('ativo', estado.jeito === 'folha')
    }
    tabela.baixar[0].textContent = `Nada além do código (uns ${MODELO_KB} KB): o three.js já vem no app. O modelo é esculpido ao abrir: neste PC levou ${fmtDec(estado.segundosEsculpir, 1)} s.`
    tabela.memoria[0].textContent = `Cerca de ${fmtMB(memVivo)}: as malhas, a sombra e um canvas WebGL a mais por cima do mapa, a batalha inteira.`
    tabela.quadro[0].textContent = `Redesenha ${fmtNum(st.pecas)} peças e ${fmtNum(st.triangulos)} triângulos, com sombra e penas recortadas.`
    tabela.giro[0].textContent = 'Qualquer ângulo, liso. A cabeça da ave e o elmo viram antes do corpo.'
    tabela.zoom[0].textContent = 'Nítido em qualquer zoom.'
    tabela.mudar[0].textContent = 'Mexe no código e pronto.'
    const folha = folhaAtual()
    const px = estado.pxFolha
    const largura = Math.round(QUADRO_L * px) * (N_RESPIRO + N_CARTAO)
    const altura = Math.round(QUADRO_A * px) * N_DIR
    tabela.baixar[1].textContent = folha
      ? `Uma folha PNG de ${fmtKB(folha.kb)} (${fmtNum(largura)} x ${fmtNum(altura)} px).`
      : `Uma folha PNG de ${fmtNum(largura)} x ${fmtNum(altura)} px (pesando...).`
    tabela.memoria[1].textContent = `${fmtMB(largura * altura * 4)}: a folha aberta na placa de vídeo.`
    tabela.quadro[1].textContent = 'Copia 1 retângulo da folha. O app nem precisa de 3D.'
    tabela.giro[1].textContent = '8 direções, em passos de 45 graus. A cabeça não vira antes.'
    tabela.zoom[1].textContent = `Nítido até ${px} px por casa; acima disso fica macio.`
    tabela.mudar[1].textContent = 'Mexe no código e fotografa a folha de novo.'
  }

  const folhaMini = $('#folha-mini')
  const folhaInfo = $('#folha-info')
  const btnVerFolha = $('#btn-ver-folha')
  const btnBaixar = $('#btn-baixar')
  const motivoFolha = $('#motivo-folha')

  function atualizarPainelFolha() {
    const px = estado.pxFolha
    const folha = folhaAtual()
    const pronta = !!folha
    btnVerFolha.disabled = !pronta
    btnBaixar.disabled = !pronta
    motivoFolha.hidden = pronta
    const g = folhaMini.getContext('2d')
    if (!pronta) {
      const p = progressoFolha.get(px) || 0
      motivoFolha.textContent = estado.pronto
        ? `Fotografando a folha: ${Math.round(p * 100)}%. Os botões liberam quando terminar.`
        : 'A folha sai depois que o Judge for esculpido.'
      folhaInfo.textContent = `${px} px por casa.`
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
    folhaInfo.textContent = `${px} px por casa: ${fmtKB(folha.kb)}, ${fmtNum(folha.canvas.width)} x ${fmtNum(folha.canvas.height)} px. Linhas: as 8 direções. Colunas: 12 quadros respirando e 8 do cartão subindo.`
  }

  const dlg = $('#dlg-folha')
  btnVerFolha.addEventListener('click', () => {
    const folha = folhaAtual()
    if (!folha) return
    const tela = $('#dlg-canvas')
    const margem = 64
    tela.width = folha.canvas.width + margem
    tela.height = folha.canvas.height + 28
    const g = tela.getContext('2d')
    g.fillStyle = '#141417'
    g.fillRect(0, 0, tela.width, tela.height)
    // fundo um pouco mais claro atrás dos quadros, para ver o que é transparente
    g.fillStyle = '#1d1d22'
    g.fillRect(margem, 28, folha.canvas.width, folha.canvas.height)
    g.drawImage(folha.canvas, margem, 28)
    g.fillStyle = '#a2a09a'
    g.font = '12px Bahnschrift, "Segoe UI", sans-serif'
    g.textBaseline = 'middle'
    for (let d = 0; d < N_DIR; d++) g.fillText(NOMES_DIR[d], 6, 28 + (d + 0.5) * folha.fh)
    g.fillText('respirando (12 quadros)', margem + 4, 14)
    g.fillText('cartão (8 quadros)', margem + N_RESPIRO * folha.fw + 4, 14)
    g.strokeStyle = 'rgba(224, 164, 74, 0.6)'
    g.beginPath()
    g.moveTo(margem + N_RESPIRO * folha.fw + 0.5, 22)
    g.lineTo(margem + N_RESPIRO * folha.fw + 0.5, tela.height)
    g.stroke()
    $('#dlg-titulo').textContent = `Folha do Judge v2: ${folha.px} px por casa, ${fmtKB(folha.kb)}`
    dlg.showModal()
  })
  $('#dlg-fechar').addEventListener('click', () => dlg.close())

  btnBaixar.addEventListener('click', () => {
    const folha = folhaAtual()
    if (!folha) return
    const url = URL.createObjectURL(folha.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `judge-v2-${folha.px}px.png`
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
    if (jeito === 'folha' && estado.pronto) obterFolha(estado.pxFolha)
    atualizarTabela()
  }

  for (const r of document.querySelectorAll('input[name="jeito"]')) r.addEventListener('change', () => escolherJeito(r.value))
  for (const r of document.querySelectorAll('input[name="pxfolha"]')) {
    r.addEventListener('change', () => {
      estado.pxFolha = Number(r.value)
      if (estado.pronto) obterFolha(estado.pxFolha)
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
    if (v) vista.giro = 0
  }
  caixaReduzir.addEventListener('change', () => aplicarReduzir(caixaReduzir.checked))
  reduzirSistema.addEventListener('change', (e) => aplicarReduzir(e.matches))

  document.addEventListener('keydown', (e) => {
    if (dlg.open || e.altKey || e.repeat) return
    const k = e.key.toLowerCase()
    if (k === 'z' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      desfazer()
      return
    }
    if (e.ctrlKey || e.metaKey) return
    if (e.target instanceof HTMLInputElement && e.target.type === 'range') return
    if (k === 'n') proximaVez()
    else if (k === 'z') desfazer()
    else if (k === 'r') {
      if (estado.pronto) iniciarBatalha()
    } else if (k === 'm') escolherJeito(estado.jeito === 'vivo' ? 'folha' : 'vivo')
    else if (k === 'c' && estado.pronto) alternarCartaoGrande()
    else if (k === 'p' && estado.pronto) alternarPincelada()
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

  // fora da tela, a cena não redesenha (a pose continua andando)
  if ('IntersectionObserver' in window) {
    const olho = new IntersectionObserver((itens) => {
      for (const it of itens) {
        if (it.target === vistaEl) vista.visivel = it.isIntersecting
        else mesaVisivel = it.isIntersecting
      }
    })
    olho.observe(vistaEl)
    olho.observe(mapa)
  }

  // ---------------- início ----------------
  const carregando = $('#carregando')
  const carregandoBarra = $('#carregando-barra')
  const carregandoTexto = $('#carregando-texto')

  function falhar(motivo) {
    document.body.classList.add('sem-webgl')
    $('#erro-webgl-motivo').textContent = motivo
    $('#erro-webgl').hidden = false
    carregando.hidden = true
  }

  async function iniciar() {
    aplicarReduzir(estado.reduzir)
    zoomValor.textContent = `${estado.casa} px por casa`
    dimensionar()
    desenharOrdem()
    atualizarPainelFolha()
    requestAnimationFrame((t) => {
      ultimo = t
      passo(t)
    })
    const t0 = performance.now()
    try {
      rec = await J.esculpir((fracao, texto) => {
        carregandoBarra.style.transform = `scaleX(${fracao})`
        carregandoTexto.textContent = `${texto}... ${Math.round(fracao * 100)}%`
      })
    } catch (erro) {
      falhar('O modelo não terminou de ser esculpido: ' + (erro && erro.message ? erro.message : String(erro)))
      return
    }
    estado.segundosEsculpir = (performance.now() - t0) / 1000
    try {
      grande = montarGrande()
      vivo = criarMundo(criarRenderer(vivoCanvas, { alpha: true }), 1024)
      vivo.cena.add(vivo.rig.raiz)
      foto = criarMundo(criarRenderer(document.createElement('canvas'), { alpha: true, preservar: true }), 1024)
      foto.cena.add(foto.rig.raiz)
    } catch (erro) {
      falhar('Este navegador não liberou o WebGL, que o 3D precisa. Abra no Chrome ou no Edge do PC, com a aceleração de hardware ligada.')
      return
    }
    estado.pronto = true
    carregando.classList.add('saindo')
    setTimeout(() => {
      carregando.hidden = true
    }, 220)
    const st = J.contar(grande.rig.raiz)
    $('#vista-numeros').textContent = `Esculpido em ${fmtDec(estado.segundosEsculpir, 1)} s neste PC: ${fmtNum(st.pecas)} peças, ${fmtNum(st.triangulos)} triângulos.`
    anunciarVista()
    iniciarBatalha()
    atualizarTabela()
    atualizarPainelFolha()
    // a folha padrão sai em segundo plano
    obterFolha(estado.pxFolha)
  }

  window.JudgeV2Prototipo = {
    /** Para conferir a página por fora (prints): estado e atalhos. */
    pronto: () => estado.pronto,
    vista,
    estado,
    girarVista,
    proximaVez,
    desfazer,
    alternarPincelada,
    alternarCartaoGrande,
    obterFolha,
  }

  iniciar()
})()
