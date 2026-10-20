/*
 * Página do protótipo: a sala de exemplo (no estilo do mapa do app: chão
 * chapado, parede fina, porta pequena), a câmera com o zoom do app (50% a
 * 200%), o painel do objeto (folha de baixo no celular) e o catálogo.
 *
 * A imagem de cada móvel é gerada UMA vez por móvel + material + desenho
 * (`Objetos.gerarSprite`) e guardada; cada quadro só cola as imagens prontas.
 * Nada se mexe sozinho: a tela só é redesenhada quando algo muda.
 */
;(function () {
  'use strict'
  const T0 = performance.now()
  const { G, ROTULO, RANURAS, MATERIAIS } = Objetos

  // As fontes chegam sem segurar o script: o mapa não espera a rede.
  for (const l of document.querySelectorAll('link[data-fontes]')) l.media = 'all'

  const dpr = () => Math.min(3, window.devicePixelRatio || 1)
  /**
   * Pixels de imagem por px do mapa. Pelo menos 2 (a textura fina, como a
   * trama do linho, é feita com folga e reduzida, então não serrilha) e no
   * máximo 3 (a cama, a imagem mais cara, sai em ~45 ms; a 4 passaria de 50).
   */
  const S_MIN = 2
  const S_MAX = 3
  const resolucaoPara = (k) => Math.min(S_MAX, Math.max(S_MIN, Math.ceil(k * 1.5 - 0.01)))
  /** Depois de quanto tempo parada a câmera pode gastar tempo gerando a imagem mais nítida. */
  const CAMERA_PARADA_MS = 180
  const ZOOM_MIN = 0.5
  const ZOOM_MAX = 2
  const PASSOS_DO_ZOOM = [0.5, 0.67, 0.8, 1, 1.25, 1.5, 2]
  const COR_FORA = '#1c1e1b'
  const COR_PAREDE = '#d8d2c4'
  const COR_PORTA = '#d08c3a'
  const COR_GRADE = 'rgba(255, 255, 255, 0.09)'
  const COR_SELECAO = '#f4ecdc'
  const PAREDE_PX = 2
  const PORTA_PX = 5
  const ARRASTO_MINIMO_PX = 6
  const reduzMovimento = window.matchMedia('(prefers-reduced-motion: reduce)')
  const modoFolha = window.matchMedia('(max-width: 959px)')

  // ---------- a sala de exemplo (em casas) ----------

  const AREAS = [
    { id: 'casa', x: 0, y: 0, w: 8, h: 8, chao: '#a8776a' },
    { id: 'patio', x: 8, y: 0, w: 5, h: 8, chao: '#857655' },
  ]
  const COR_DO_CHAO = Object.fromEntries(AREAS.map((a) => [a.id, a.chao]))
  const MAPA_W = 13 * G
  const MAPA_H = 8 * G
  const PAREDES = [
    [0, 0, 13, 0], [13, 0, 13, 8], [13, 8, 11, 8], [10, 8, 0, 8], [0, 8, 0, 0], [8, 0, 8, 8],
  ]
  const PORTAS = [
    { x: 8, y: 5.5, vertical: true },
    { x: 3.5, y: 8, vertical: false },
  ]
  const INICIAIS = [
    { id: 'tapete', tipo: 'tapete', cx: 4.5, cy: 3.85 },
    { id: 'cama', tipo: 'catre', cx: 0.56, cy: 1.06 },
    { id: 'bau', tipo: 'bau', cx: 0.56, cy: 2.64 },
    { id: 'armario', tipo: 'armario', cx: 2.1, cy: 0.28, encostado: true },
    { id: 'aparador', tipo: 'aparador', cx: 4.6, cy: 0.28, encostado: true },
    { id: 'mesa', tipo: 'mesa', cx: 4.5, cy: 4.02 },
    { id: 'cadeira', tipo: 'cadeira', cx: 4.5, cy: 3.18 },
    { id: 'barril', tipo: 'barril', cx: 0.44, cy: 7.5 },
    { id: 'caixa', tipo: 'caixa', cx: 1.36, cy: 7.52 },
    { id: 'fogueira', tipo: 'fogueira', cx: 10.5, cy: 4.75 },
    { id: 'cerca-curva', tipo: 'cerca', cx: 10.5, cy: 5.1, casas: 3, curva: 150, materiais: { madeira: 'pinho', ligacao: 'corda' } },
    { id: 'cerca', tipo: 'cerca', cx: 10.5, cy: 1.5 },
  ]

  function medir(obj) {
    const [w, h] = Objetos.tamanhoEmCasas(obj.tipo, obj.vista, obj.forma)
    obj.largura = (obj.casas || w) * G
    obj.altura = h * G
    // Móvel encostado na parede de cima mantém a beira de cima quando muda de tamanho (o app mantém o centro).
    if (obj.encostado && obj.topo !== undefined) obj.cy = obj.topo + obj.altura / 2
  }

  function criarObjeto(o) {
    const obj = {
      id: o.id, tipo: o.tipo, cx: o.cx * G, cy: o.cy * G, vista: 'frente', forma: 'retangular', curva: o.curva || 0,
      casas: o.casas || null, encostado: !!o.encostado, area: o.cx >= 8 ? 'patio' : 'casa', materiais: {},
    }
    for (const r of RANURAS[o.tipo]) obj.materiais[r.id] = (o.materiais && o.materiais[r.id]) || r.padrao
    medir(obj)
    if (obj.encostado) obj.topo = obj.cy - obj.altura / 2
    return obj
  }

  const objetos = INICIAIS.map(criarObjeto)
  const porId = new Map(objetos.map((o) => [o.id, o]))
  /** O objeto de cada tipo no catálogo (a cerca do catálogo é a reta). */
  const doCatalogo = Objetos.TIPOS.map((tipo) => objetos.find((o) => o.tipo === tipo && !o.curva))

  // ---------- estado e imagens ----------

  const estado = { estilo: 'cima', zoom: 1, panX: 0, panY: 0, selecionado: null }
  const cache = new Map()
  const tempos = []
  let primeiraPintura = null
  let primeiraPinturaDesdeAbertura = null
  /** Quando a sala ficou toda na resolução certa (desde a abertura da página). */
  let salaNitida = null
  /** Quanto cada quadro levou para desenhar (os últimos 600), para a prova de travada. */
  const duracoes = []
  const desenhados = new Map()

  function defDe(obj, estilo = estado.estilo) {
    return { tipo: obj.tipo, largura: obj.largura, altura: obj.altura, vista: obj.vista, forma: obj.forma, curva: obj.curva, estilo, materiais: { ...obj.materiais } }
  }

  function gerar(def, chave, S) {
    const sp = Objetos.gerarSprite(def, S)
    sp.chave = chave
    cache.set(`${chave}@${S}`, sp)
    tempos.push({ chave, S, ms: sp.ms })
    return sp
  }

  /**
   * A imagem do objeto para a escala de tela `k` (px de tela por px do mapa).
   * Se já existe uma pelo menos tão nítida, usa. Se só existe uma menos
   * nítida, usa ela agora e pede a melhor para quando a câmera parar (gerar
   * no meio do gesto travaria o zoom). Se não existe nenhuma, gera já.
   * Sem `k`, serve qualquer uma (clique e seleção só precisam da forma).
   */
  function spriteDe(obj, estilo = estado.estilo, k = null) {
    const def = defDe(obj, estilo)
    const chave = Objetos.chaveDe(def)
    const alvo = k === null ? S_MIN : resolucaoPara(k)
    for (let S = alvo; S <= S_MAX; S += 1) {
      const sp = cache.get(`${chave}@${S}`)
      if (sp) return sp
    }
    for (let S = alvo - 1; S >= 1; S -= 1) {
      const sp = cache.get(`${chave}@${S}`)
      if (sp) {
        pedirMaisNitida(def, chave, alvo)
        return sp
      }
    }
    if (primeiraPintura === null && k !== null) {
      // Primeira pintura: a sala aparece já com tudo em 1x (4 vezes mais rápido) e fica nítida aos poucos, logo em seguida.
      pedirMaisNitida(def, chave, alvo)
      return gerar(def, chave, 1)
    }
    return gerar(def, chave, alvo)
  }

  // Fila de imagens para depois: as mais nítidas (zoom) primeiro, depois o outro desenho.
  const fila = []
  const naFila = new Set()
  let ultimoMovimento = 0
  let filaAgendada = false
  function enfileirar(def, chave, S, frente) {
    const id = `${chave}@${S}`
    if (cache.has(id) || naFila.has(id)) return
    naFila.add(id)
    if (frente) fila.unshift({ def, chave, S, id })
    else fila.push({ def, chave, S, id })
    agendarFila()
  }
  const pedirMaisNitida = (def, chave, S) => enfileirar(def, chave, S, true)
  function agendarFila(espera = 0) {
    if (filaAgendada || fila.length === 0) return
    filaAgendada = true
    setTimeout(trabalharNaFila, espera)
  }
  /** Uma imagem por vez, só com a câmera parada: nenhuma tarefa longa, nenhum quadro perdido no gesto. */
  function trabalharNaFila() {
    filaAgendada = false
    const parada = performance.now() - ultimoMovimento
    if (parada < CAMERA_PARADA_MS) {
      agendarFila(CAMERA_PARADA_MS - parada)
      return
    }
    const item = fila.shift()
    if (!item) return
    naFila.delete(item.id)
    if (!cache.has(item.id)) {
      gerar(item.def, item.chave, item.S)
      if (item.def.estilo === estado.estilo) aposGerar(item.chave)
    }
    agendarFila()
  }
  /** Imagem mais nítida pronta: redesenha o mapa e, se for dele, a prévia e o cartão. */
  function aposGerar(chave) {
    pedirQuadro()
    const atual = (o) => Objetos.chaveDe(defDe(o)) === chave
    if (estado.selecionado && atual(estado.selecionado)) desenharPrevia(estado.selecionado)
    for (const o of doCatalogo) if (atual(o)) atualizarCartao(o)
  }
  const cameraMexeu = () => {
    ultimoMovimento = performance.now()
  }

  function emOrdem() {
    return [...objetos].sort((a, b) => {
      const ta = a.tipo === 'tapete'
      const tb = b.tipo === 'tapete'
      if (ta !== tb) return ta ? -1 : 1
      return a.cy + a.altura / 2 - (b.cy + b.altura / 2) || a.cx - b.cx
    })
  }

  // ---------- mapa ----------

  const mapa = document.getElementById('mapa')
  const ctx = mapa.getContext('2d')
  if (!ctx) {
    mapa.replaceWith(Object.assign(document.createElement('p'), { className: 'erro-canvas', textContent: 'Este navegador não desenha em canvas 2D, então o mapa não aparece. Abra num Chrome, Edge, Firefox ou Safari atual.' }))
    return
  }
  let cssW = 0
  let cssH = 0
  let quadroPedido = false

  function pedirQuadro() {
    if (quadroPedido) return
    quadroPedido = true
    requestAnimationFrame(desenhar)
  }

  function desenhar() {
    const inicio = performance.now()
    quadroPedido = false
    const d = dpr()
    const W = mapa.width
    const H = mapa.height
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = COR_FORA
    ctx.fillRect(0, 0, W, H)
    const k = estado.zoom * d
    const ox = estado.panX * d
    const oy = estado.panY * d
    const X = (cx) => Math.round(ox + cx * G * k)
    const Y = (cy) => Math.round(oy + cy * G * k)
    for (const a of AREAS) {
      ctx.fillStyle = a.chao
      ctx.fillRect(X(a.x), Y(a.y), X(a.x + a.w) - X(a.x), Y(a.y + a.h) - Y(a.y))
    }
    ctx.fillStyle = COR_GRADE
    const linha = Math.max(1, Math.round(d))
    for (const a of AREAS) {
      for (let i = 1; i < a.w; i += 1) ctx.fillRect(X(a.x + i), Y(a.y), linha, Y(a.y + a.h) - Y(a.y))
      for (let j = 1; j < a.h; j += 1) ctx.fillRect(X(a.x), Y(a.y + j), X(a.x + a.w) - X(a.x), linha)
    }
    ctx.fillStyle = COR_PAREDE
    const pw = Math.max(1, Math.round(PAREDE_PX * d))
    for (const [ax, ay, bx, by] of PAREDES) {
      const x0 = X(Math.min(ax, bx))
      const x1 = X(Math.max(ax, bx))
      const y0 = Y(Math.min(ay, by))
      const y1 = Y(Math.max(ay, by))
      if (ay === by) ctx.fillRect(x0 - pw / 2, y0 - pw / 2, x1 - x0 + pw, pw)
      else ctx.fillRect(x0 - pw / 2, y0 - pw / 2, pw, y1 - y0 + pw)
    }
    ctx.fillStyle = COR_PORTA
    const tw = Math.max(2, Math.round(PORTA_PX * d))
    const comprimento = Math.round(0.6 * G * k)
    for (const p of PORTAS) {
      if (p.vertical) ctx.fillRect(X(p.x) - tw / 2, Y(p.y) - comprimento / 2, tw, comprimento)
      else ctx.fillRect(X(p.x) - comprimento / 2, Y(p.y) - tw / 2, comprimento, tw)
    }
    ctx.setTransform(k, 0, 0, k, ox, oy)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    desenhados.clear()
    let tudoNitido = true
    for (const obj of emOrdem()) {
      const sp = spriteDe(obj, estado.estilo, k)
      const nv = Objetos.nivel(sp, k)
      ctx.drawImage(nv.canvas, obj.cx + sp.ox, obj.cy + sp.oy, sp.largura, sp.altura)
      desenhados.set(obj.id, sp.chave)
      if (sp.S < resolucaoPara(k)) tudoNitido = false
    }
    if (tudoNitido && salaNitida === null && primeiraPintura !== null) salaNitida = performance.now()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    const sel = estado.selecionado
    if (sel) {
      const sp = spriteDe(sel)
      const m = 4 * d
      const x0 = ox + (sel.cx + sp.pecas[0]) * k - m
      const y0 = oy + (sel.cy + sp.pecas[1]) * k - m
      const x1 = ox + (sel.cx + sp.pecas[2]) * k + m
      const y1 = oy + (sel.cy + sp.pecas[3]) * k + m
      ctx.lineWidth = 3 * d
      ctx.strokeStyle = 'rgba(12, 10, 8, 0.45)'
      ctx.setLineDash([])
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0)
      ctx.lineWidth = 1.5 * d
      ctx.strokeStyle = COR_SELECAO
      ctx.setLineDash([5 * d, 4 * d])
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0)
      ctx.setLineDash([])
    }
    const fim = performance.now()
    duracoes.push(fim - inicio)
    if (duracoes.length > 600) duracoes.shift()
    if (primeiraPintura === null) {
      primeiraPintura = fim - T0
      primeiraPinturaDesdeAbertura = fim
    }
  }

  function limitarCamera() {
    cameraMexeu()
    const margem = 64
    const mw = MAPA_W * estado.zoom
    const mh = MAPA_H * estado.zoom
    estado.panX = Math.min(cssW - margem, Math.max(margem - mw, estado.panX))
    estado.panY = Math.min(cssH - margem, Math.max(margem - mh, estado.panY))
  }

  function zoomEm(sx, sy, z) {
    const novo = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z))
    const wx = (sx - estado.panX) / estado.zoom
    const wy = (sy - estado.panY) / estado.zoom
    estado.zoom = novo
    estado.panX = sx - wx * novo
    estado.panY = sy - wy * novo
    limitarCamera()
    atualizarZoom()
    pedirQuadro()
  }

  function passoDeZoom(direcao) {
    const z = estado.zoom
    const alvo = direcao > 0 ? PASSOS_DO_ZOOM.find((p) => p > z + 0.01) ?? ZOOM_MAX : [...PASSOS_DO_ZOOM].reverse().find((p) => p < z - 0.01) ?? ZOOM_MIN
    zoomEm(cssW / 2, cssH / 2, alvo)
  }

  const zoomValor = document.getElementById('zoom-valor')
  const zoomMenos = document.getElementById('zoom-menos')
  const zoomMais = document.getElementById('zoom-mais')
  function atualizarZoom() {
    zoomValor.textContent = `${Math.round(estado.zoom * 100)}%`
    zoomMenos.disabled = estado.zoom <= ZOOM_MIN + 1e-6
    zoomMais.disabled = estado.zoom >= ZOOM_MAX - 1e-6
  }
  zoomMenos.addEventListener('click', () => passoDeZoom(-1))
  zoomMais.addEventListener('click', () => passoDeZoom(1))
  zoomValor.addEventListener('click', () => zoomEm(cssW / 2, cssH / 2, 1))

  let medido = false
  /** O maior zoom (até 100%) em que a sala inteira cabe no mapa. */
  const zoomQueCabe = (w, h) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.min(1, Math.floor(Math.min((w - 24) / MAPA_W, (h - 24) / MAPA_H) * 20) / 20)))

  function ajustarTamanho() {
    const w = mapa.clientWidth
    const h = mapa.clientHeight
    if (!w || !h) return
    const centroX = medido ? (cssW / 2 - estado.panX) / estado.zoom : MAPA_W / 2
    const centroY = medido ? (cssH / 2 - estado.panY) / estado.zoom : MAPA_H / 2
    if (!medido) estado.zoom = zoomQueCabe(w, h)
    cssW = w
    cssH = h
    mapa.width = Math.round(w * dpr())
    mapa.height = Math.round(h * dpr())
    estado.panX = cssW / 2 - centroX * estado.zoom
    estado.panY = cssH / 2 - centroY * estado.zoom
    medido = true
    limitarCamera()
    atualizarZoom()
    desenhar()
  }

  function objetoEm(sx, sy) {
    const wx = (sx - estado.panX) / estado.zoom
    const wy = (sy - estado.panY) / estado.zoom
    const lista = emOrdem()
    for (let i = lista.length - 1; i >= 0; i -= 1) {
      const o = lista[i]
      if (Objetos.acertou(spriteDe(o), wx - o.cx, wy - o.cy, 3 / estado.zoom)) return o
    }
    return null
  }

  // Arrastar anda pelo mapa; toque sem arrastar escolhe o objeto; dois dedos fazem pinça.
  const ponteiros = new Map()
  let gesto = null
  const posicao = (e) => {
    const r = mapa.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  mapa.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    mapa.setPointerCapture(e.pointerId)
    const p = posicao(e)
    ponteiros.set(e.pointerId, p)
    if (ponteiros.size === 1) {
      gesto = { tipo: 'toque', x0: p.x, y0: p.y, panX: estado.panX, panY: estado.panY, moveu: false }
    } else if (ponteiros.size === 2) {
      const [a, b] = [...ponteiros.values()]
      const mx = (a.x + b.x) / 2
      const my = (a.y + b.y) / 2
      gesto = { tipo: 'pinca', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: estado.zoom, wx: (mx - estado.panX) / estado.zoom, wy: (my - estado.panY) / estado.zoom }
    }
  })
  mapa.addEventListener('pointermove', (e) => {
    const p = posicao(e)
    if (!ponteiros.has(e.pointerId)) {
      if (e.pointerType === 'mouse') mapa.dataset.sobre = objetoEm(p.x, p.y) ? 'objeto' : ''
      return
    }
    ponteiros.set(e.pointerId, p)
    if (!gesto) return
    if (gesto.tipo === 'toque') {
      const dx = p.x - gesto.x0
      const dy = p.y - gesto.y0
      if (!gesto.moveu && Math.hypot(dx, dy) > ARRASTO_MINIMO_PX) {
        gesto.moveu = true
        mapa.dataset.arrastando = 'true'
      }
      if (gesto.moveu) {
        estado.panX = gesto.panX + dx
        estado.panY = gesto.panY + dy
        limitarCamera()
        pedirQuadro()
      }
    } else if (gesto.tipo === 'pinca' && ponteiros.size >= 2) {
      const [a, b] = [...ponteiros.values()]
      const mx = (a.x + b.x) / 2
      const my = (a.y + b.y) / 2
      const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, (gesto.z0 * Math.hypot(a.x - b.x, a.y - b.y)) / gesto.d0))
      estado.zoom = z
      estado.panX = mx - gesto.wx * z
      estado.panY = my - gesto.wy * z
      limitarCamera()
      atualizarZoom()
      pedirQuadro()
    }
  })
  function soltar(e) {
    if (!ponteiros.has(e.pointerId)) return
    const p = posicao(e)
    ponteiros.delete(e.pointerId)
    if (gesto && gesto.tipo === 'toque' && !gesto.moveu && e.type === 'pointerup') {
      const obj = objetoEm(p.x, p.y)
      if (obj) selecionar(obj, { origem: 'mapa' })
      else fecharPainel()
    }
    if (ponteiros.size === 0) {
      gesto = null
      mapa.dataset.arrastando = 'false'
    } else if (gesto && gesto.tipo === 'pinca') gesto = null
  }
  mapa.addEventListener('pointerup', soltar)
  mapa.addEventListener('pointercancel', soltar)
  mapa.addEventListener('wheel', (e) => {
    e.preventDefault()
    const p = posicao(e)
    const fator = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0018))
    zoomEm(p.x, p.y, estado.zoom * fator)
  }, { passive: false })
  mapa.addEventListener('keydown', (e) => {
    const passo = 48
    const acoes = {
      ArrowLeft: () => { estado.panX += passo },
      ArrowRight: () => { estado.panX -= passo },
      ArrowUp: () => { estado.panY += passo },
      ArrowDown: () => { estado.panY -= passo },
    }
    if (acoes[e.key]) {
      e.preventDefault()
      acoes[e.key]()
      limitarCamera()
      pedirQuadro()
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault()
      passoDeZoom(1)
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault()
      passoDeZoom(-1)
    } else if (e.key === '0') {
      e.preventDefault()
      zoomEm(cssW / 2, cssH / 2, 1)
    }
  })

  // ---------- grupos de opção (setas trocam, uma parada só do Tab) ----------

  function radioGrupo(grupo, aoEscolher) {
    const botoes = () => [...grupo.querySelectorAll('[role="radio"]')]
    const marcar = (alvo) => {
      for (const b of botoes()) {
        const sim = b === alvo
        b.setAttribute('aria-checked', String(sim))
        b.tabIndex = sim ? 0 : -1
      }
    }
    grupo.addEventListener('click', (e) => {
      const b = e.target.closest('[role="radio"]')
      if (!b || !grupo.contains(b) || b.getAttribute('aria-checked') === 'true') return
      marcar(b)
      aoEscolher(b)
    })
    grupo.addEventListener('keydown', (e) => {
      const lista = botoes()
      const i = lista.indexOf(document.activeElement)
      if (i < 0) return
      let j = null
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % lista.length
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + lista.length) % lista.length
      else if (e.key === 'Home') j = 0
      else if (e.key === 'End') j = lista.length - 1
      if (j === null) return
      e.preventDefault()
      lista[j].focus()
      marcar(lista[j])
      aoEscolher(lista[j])
    })
    return { marcar }
  }

  const el = (tag, classe, texto) => {
    const n = document.createElement(tag)
    if (classe) n.className = classe
    if (texto !== undefined) n.textContent = texto
    return n
  }

  // ---------- desenho escolhido ----------

  const grupoEstilo = document.getElementById('grupo-estilo')
  radioGrupo(grupoEstilo, (b) => definirEstilo(b.dataset.estilo))

  function definirEstilo(estilo) {
    if (estilo !== 'cima' && estilo !== '34') return
    estado.estilo = estilo
    for (const b of grupoEstilo.querySelectorAll('[role="radio"]')) {
      const sim = b.dataset.estilo === estilo
      b.setAttribute('aria-checked', String(sim))
      b.tabIndex = sim ? 0 : -1
    }
    for (const o of objetos) spriteDe(o, estilo, estado.zoom * dpr())
    desenhar()
    atualizarCatalogo()
    if (estado.selecionado) desenharPrevia(estado.selecionado)
  }

  // ---------- painel do objeto ----------

  const painel = document.getElementById('painel')
  const painelVazio = document.getElementById('painel-vazio')
  const painelObjeto = document.getElementById('painel-objeto')
  const titulo = document.getElementById('painel-titulo')
  const sub = document.getElementById('painel-sub')
  const ranhuras = document.getElementById('ranhuras')
  const opcoes = document.getElementById('opcoes')
  const previa = document.getElementById('previa')
  const legendaPrevia = document.getElementById('previa-legenda')
  let quemAbriu = null

  function atualizarInerte() {
    painel.inert = modoFolha.matches && painel.dataset.aberto !== 'true'
  }
  modoFolha.addEventListener('change', atualizarInerte)

  const casas = (px) => (px / G).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
  function tamanhoEmTexto(obj) {
    const base = `${casas(obj.largura)} × ${casas(obj.altura)} casa${obj.largura / G === 1 && obj.altura / G === 1 ? '' : 's'}`
    if (obj.tipo === 'cerca') return obj.curva > 0 ? `${base}, curva de ${obj.curva}°` : `${base}, reta`
    return base
  }

  function selecionar(obj, { origem = 'mapa', viaTeclado = false, centrar = false } = {}) {
    estado.selecionado = obj
    quemAbriu = viaTeclado ? document.activeElement : null
    montarPainel(obj)
    painel.dataset.aberto = 'true'
    atualizarInerte()
    if (centrar && !estaNaTela(obj)) centrarEm(obj)
    if (modoFolha.matches) mostrarMapaAcimaDaFolha()
    marcarCatalogo()
    pedirQuadro()
    if (viaTeclado) titulo.focus({ preventScroll: modoFolha.matches })
    else if (origem === 'mapa' && !modoFolha.matches) painel.scrollTop = 0
  }

  function fecharPainel() {
    if (!estado.selecionado) return
    estado.selecionado = null
    painel.dataset.aberto = 'false'
    painel.style.transform = ''
    painelObjeto.hidden = true
    painelVazio.hidden = false
    atualizarInerte()
    marcarCatalogo()
    pedirQuadro()
    if (quemAbriu && document.contains(quemAbriu)) quemAbriu.focus()
    quemAbriu = null
  }
  document.getElementById('fechar').addEventListener('click', fecharPainel)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && estado.selecionado) {
      e.preventDefault()
      fecharPainel()
    }
  })

  /** O objeto inteiro (com folga de 12 px) está dentro do mapa? Então escolher pelo catálogo não mexe na câmera. */
  function estaNaTela(obj) {
    const sp = spriteDe(obj)
    const folga = 12
    const x0 = estado.panX + (obj.cx + sp.pecas[0]) * estado.zoom
    const y0 = estado.panY + (obj.cy + sp.pecas[1]) * estado.zoom
    const x1 = estado.panX + (obj.cx + sp.pecas[2]) * estado.zoom
    const y1 = estado.panY + (obj.cy + sp.pecas[3]) * estado.zoom
    return x0 >= folga && y0 >= folga && x1 <= cssW - folga && y1 <= cssH - folga
  }

  /** No celular a folha cobre a metade de baixo: rola a página até o mapa ficar inteiro acima dela. */
  function mostrarMapaAcimaDaFolha() {
    requestAnimationFrame(() => {
      const r = mapa.getBoundingClientRect()
      const topoDaFolha = window.innerHeight - painel.offsetHeight
      if (r.top >= 8 && r.bottom <= topoDaFolha - 8) return
      window.scrollBy({ top: r.top - 8, behavior: reduzMovimento.matches ? 'auto' : 'smooth' })
    })
  }

  function centrarEm(obj) {
    const alvoX = cssW / 2 - obj.cx * estado.zoom
    const alvoY = cssH / 2 - obj.cy * estado.zoom
    const deX = estado.panX
    const deY = estado.panY
    if (reduzMovimento.matches) {
      estado.panX = alvoX
      estado.panY = alvoY
      limitarCamera()
      pedirQuadro()
      return
    }
    const inicio = performance.now()
    const DURACAO = 220
    const passo = (agora) => {
      const t = Math.min(1, (agora - inicio) / DURACAO)
      const e = 1 - Math.pow(1 - t, 3)
      estado.panX = deX + (alvoX - deX) * e
      estado.panY = deY + (alvoY - deY) * e
      limitarCamera()
      desenhar()
      if (t < 1) requestAnimationFrame(passo)
    }
    requestAnimationFrame(passo)
  }

  const amostras = new Map()
  function amostraDe(id, madeira) {
    const chave = MATERIAIS[id].classe === 'ref' ? `${id}:${madeira}` : id
    let a = amostras.get(chave)
    if (!a) {
      a = Objetos.gerarAmostra(id, madeira, Math.min(3, Math.max(1, Math.ceil(dpr()))))
      amostras.set(chave, a)
    }
    return a
  }

  function pintarAmostra(botao, obj) {
    const canvas = botao.querySelector('canvas')
    const a = amostraDe(botao.dataset.mat, obj.materiais.madeira)
    canvas.width = a.canvas.width
    canvas.height = a.canvas.height
    canvas.getContext('2d').drawImage(a.canvas, 0, 0)
  }

  function campoDeMaterial(obj, r) {
    const campo = el('div', 'campo')
    const rotulo = el('span', 'campo-rotulo')
    rotulo.id = `rotulo-${r.id}`
    const saida = el('output', '', MATERIAIS[obj.materiais[r.id]].nome)
    rotulo.append(`${r.nome}: `, saida)
    const grupo = el('div', 'amostras')
    grupo.setAttribute('role', 'radiogroup')
    grupo.setAttribute('aria-labelledby', rotulo.id)
    grupo.dataset.ranhura = r.id
    for (const id of r.opcoes) {
      const b = el('button', 'amostra')
      b.type = 'button'
      b.setAttribute('role', 'radio')
      const sim = obj.materiais[r.id] === id
      b.setAttribute('aria-checked', String(sim))
      b.tabIndex = sim ? 0 : -1
      b.setAttribute('aria-label', MATERIAIS[id].nome)
      b.title = MATERIAIS[id].nome
      b.dataset.mat = id
      b.append(el('canvas'))
      pintarAmostra(b, obj)
      grupo.append(b)
    }
    radioGrupo(grupo, (b) => escolherMaterial(obj, r.id, b.dataset.mat, saida))
    campo.append(rotulo, grupo)
    return campo
  }

  function escolherMaterial(obj, ranhura, id, saida) {
    obj.materiais[ranhura] = id
    if (saida) saida.textContent = MATERIAIS[id].nome
    if (ranhura === 'madeira') {
      for (const b of ranhuras.querySelectorAll('.amostra')) if (MATERIAIS[b.dataset.mat].classe === 'ref') pintarAmostra(b, obj)
    }
    mudou(obj)
  }

  /** Algo do objeto mudou: gera a imagem nova já, redesenha o mapa, a prévia e o cartão. */
  function mudou(obj) {
    desenhar()
    // O outro desenho deste objeto fica pronto em segundo plano, para a troca de desenho ser na hora.
    const outro = defDe(obj, estado.estilo === 'cima' ? '34' : 'cima')
    enfileirar(outro, Objetos.chaveDe(outro), resolucaoPara(estado.zoom * dpr()), false)
    if (estado.selecionado === obj) {
      sub.textContent = tamanhoEmTexto(obj)
      desenharPrevia(obj)
    }
    atualizarCartao(obj)
  }

  function grupoSegmentado(rotuloTexto, id, valores, atual, aoEscolher) {
    const campo = el('div', 'campo')
    const rotulo = el('span', 'campo-rotulo', rotuloTexto)
    rotulo.id = `rotulo-${id}`
    const grupo = el('div', 'segmentado')
    grupo.setAttribute('role', 'radiogroup')
    grupo.setAttribute('aria-labelledby', rotulo.id)
    grupo.id = `grupo-${id}`
    for (const [valor, nome] of valores) {
      const b = el('button', '', nome)
      b.type = 'button'
      b.setAttribute('role', 'radio')
      b.setAttribute('aria-checked', String(valor === atual))
      b.tabIndex = valor === atual ? 0 : -1
      b.dataset.valor = valor
      grupo.append(b)
    }
    radioGrupo(grupo, (b) => aoEscolher(b.dataset.valor))
    campo.append(rotulo, grupo)
    return campo
  }

  function opcoesDe(obj) {
    const lista = []
    if (Objetos.aceitaVista(obj.tipo)) {
      lista.push(grupoSegmentado('Vista', 'vista', [['frente', 'Frente'], ['lado', 'Lado']], obj.vista, (v) => {
        obj.vista = v
        medir(obj)
        mudou(obj)
      }))
    }
    if (obj.tipo === 'tapete') {
      lista.push(grupoSegmentado('Forma', 'forma', [['retangular', 'Retangular'], ['redondo', 'Redondo']], obj.forma, (v) => {
        obj.forma = v
        medir(obj)
        mudou(obj)
      }))
    }
    if (obj.tipo === 'cerca') {
      const campo = el('div', 'campo')
      const rotulo = el('label', 'campo-rotulo')
      rotulo.htmlFor = 'curva'
      const saida = el('output', '', obj.curva > 0 ? `${obj.curva}°` : 'Reta')
      rotulo.append('Curva: ', saida)
      const linha = el('div', 'curva')
      const entrada = el('input')
      Object.assign(entrada, { type: 'range', id: 'curva', min: '0', max: '180', step: '5', value: String(obj.curva) })
      entrada.setAttribute('aria-valuetext', obj.curva > 0 ? `${obj.curva} graus` : 'reta')
      let pendente = false
      entrada.addEventListener('input', () => {
        obj.curva = Number(entrada.value)
        saida.textContent = obj.curva > 0 ? `${obj.curva}°` : 'Reta'
        entrada.setAttribute('aria-valuetext', obj.curva > 0 ? `${obj.curva} graus` : 'reta')
        if (pendente) return
        pendente = true
        requestAnimationFrame(() => {
          pendente = false
          mudou(obj)
        })
      })
      linha.append(entrada)
      campo.append(rotulo, linha)
      lista.push(campo)
    }
    return lista
  }

  function montarPainel(obj) {
    painelVazio.hidden = true
    painelObjeto.hidden = false
    titulo.textContent = obj.id === 'cerca-curva' ? 'Cerca (curva)' : ROTULO[obj.tipo]
    sub.textContent = tamanhoEmTexto(obj)
    ranhuras.replaceChildren(...RANURAS[obj.tipo].map((r) => campoDeMaterial(obj, r)))
    opcoes.replaceChildren(...opcoesDe(obj))
    desenharPrevia(obj)
  }

  function desenharPrevia(obj) {
    const d = dpr()
    const w = previa.clientWidth
    const h = previa.clientHeight
    if (!w || !h) return
    previa.width = Math.round(w * d)
    previa.height = Math.round(h * d)
    const c = previa.getContext('2d')
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.fillStyle = COR_DO_CHAO[obj.area]
    c.fillRect(0, 0, previa.width, previa.height)
    const forma = spriteDe(obj)
    const escala = Math.min(2, (w - 20) / forma.largura, (h - 16) / forma.altura)
    const k = escala * d
    const sp = spriteDe(obj, estado.estilo, k)
    const nv = Objetos.nivel(sp, k)
    c.imageSmoothingEnabled = true
    c.imageSmoothingQuality = 'high'
    c.drawImage(nv.canvas, (previa.width - sp.largura * k) / 2, (previa.height - sp.altura * k) / 2, sp.largura * k, sp.altura * k)
    const pct = Math.round(escala * 100)
    legendaPrevia.textContent = pct >= 200 ? 'De perto, no zoom de 200%' : `De perto, no zoom de ${pct}% (o maior que cabe aqui)`
  }

  // Folha de baixo no celular: arrastar pela alça desce junto com o dedo; soltar depois da metade ou num arremesso fecha.
  {
    let arrasto = null
    const comecar = (e) => {
      if (!modoFolha.matches || painel.dataset.aberto !== 'true' || e.target.closest('button')) return
      arrasto = { y0: e.clientY, t0: performance.now(), dy: 0, id: e.pointerId }
      e.currentTarget.setPointerCapture(e.pointerId)
      painel.dataset.arrastando = 'true'
    }
    const mover = (e) => {
      if (!arrasto || e.pointerId !== arrasto.id) return
      arrasto.dy = Math.max(0, e.clientY - arrasto.y0)
      painel.style.transform = `translateY(${arrasto.dy}px)`
    }
    const terminar = (e) => {
      if (!arrasto || e.pointerId !== arrasto.id) return
      const velocidade = arrasto.dy / Math.max(1, performance.now() - arrasto.t0)
      const fecha = arrasto.dy > Math.min(140, painel.offsetHeight * 0.35) || (velocidade > 0.5 && arrasto.dy > 12)
      painel.dataset.arrastando = 'false'
      painel.style.transform = ''
      arrasto = null
      if (fecha) fecharPainel()
    }
    for (const alvo of [document.getElementById('alca'), painel.querySelector('.painel-cabeca')]) {
      alvo.addEventListener('pointerdown', comecar)
      alvo.addEventListener('pointermove', mover)
      alvo.addEventListener('pointerup', terminar)
      alvo.addEventListener('pointercancel', terminar)
    }
  }

  // ---------- catálogo ----------

  const cartoes = document.getElementById('cartoes')
  const cartaoDe = new Map()

  function nomesDosMateriais(obj) {
    return RANURAS[obj.tipo].map((r) => MATERIAIS[obj.materiais[r.id]].nome).join(', ')
  }

  function montarCatalogo() {
    for (const obj of doCatalogo) {
      const li = el('li')
      const b = el('button', 'cartao')
      b.type = 'button'
      b.setAttribute('aria-pressed', 'false')
      b.dataset.id = obj.id
      const canvas = el('canvas')
      canvas.setAttribute('aria-hidden', 'true')
      const nome = el('span', 'cartao-nome', ROTULO[obj.tipo])
      const mat = el('span', 'cartao-mat', nomesDosMateriais(obj))
      b.append(canvas, nome, mat)
      b.addEventListener('click', (e) => selecionar(obj, { origem: 'catalogo', viaTeclado: e.detail === 0, centrar: true }))
      li.append(b)
      cartoes.append(li)
      cartaoDe.set(obj.id, { b, canvas, mat })
    }
  }

  function atualizarCartao(obj) {
    const c = cartaoDe.get(obj.id)
    if (!c) return
    c.mat.textContent = nomesDosMateriais(obj)
    const d = dpr()
    const w = c.canvas.clientWidth
    const h = c.canvas.clientHeight
    if (!w || !h) return
    c.canvas.width = Math.round(w * d)
    c.canvas.height = Math.round(h * d)
    const g = c.canvas.getContext('2d')
    g.fillStyle = COR_DO_CHAO[obj.area]
    g.fillRect(0, 0, c.canvas.width, c.canvas.height)
    const forma = spriteDe(obj)
    const escala = Math.min(1.25, (w - 10) / forma.largura, (h - 8) / forma.altura)
    const k = escala * d
    const sp = spriteDe(obj, estado.estilo, k)
    const nv = Objetos.nivel(sp, k)
    g.imageSmoothingEnabled = true
    g.imageSmoothingQuality = 'high'
    g.drawImage(nv.canvas, (c.canvas.width - sp.largura * k) / 2, (c.canvas.height - sp.altura * k) / 2, sp.largura * k, sp.altura * k)
  }

  function atualizarCatalogo() {
    for (const obj of doCatalogo) atualizarCartao(obj)
  }

  function marcarCatalogo() {
    for (const [id, c] of cartaoDe) c.b.setAttribute('aria-pressed', String(estado.selecionado !== null && estado.selecionado.id === id))
  }

  // ---------- início ----------

  montarCatalogo()
  atualizarInerte()
  ajustarTamanho()
  atualizarCatalogo()
  new ResizeObserver(() => {
    if (mapa.clientWidth !== cssW || mapa.clientHeight !== cssH) ajustarTamanho()
  }).observe(mapa)
  new ResizeObserver(() => {
    atualizarCatalogo()
    if (estado.selecionado) desenharPrevia(estado.selecionado)
  }).observe(cartoes)

  // Depois da primeira pintura, gera o outro desenho aos poucos (uma imagem por vez), para a troca ser na hora.
  {
    const S = resolucaoPara(estado.zoom * dpr())
    const outro = estado.estilo === 'cima' ? '34' : 'cima'
    for (const o of objetos) {
      const def = defDe(o, outro)
      enfileirar(def, Objetos.chaveDe(def), S, false)
    }
  }

  // ---------- gancho para as provas (gerar-provas.cjs) ----------

  window.__objetos = {
    S_MIN,
    S_MAX,
    get resolucaoAtual() { return resolucaoPara(estado.zoom * dpr()) },
    get primeiraPintura() { return primeiraPintura },
    get primeiraPinturaDesdeAbertura() { return primeiraPinturaDesdeAbertura },
    get salaNitida() { return salaNitida },
    inicioDoScript: T0,
    duracoes: () => duracoes.slice(),
    get filaPendente() { return fila.length },
    tempos: () => tempos.slice(),
    estado: () => ({ estilo: estado.estilo, zoom: estado.zoom, panX: estado.panX, panY: estado.panY, selecionado: estado.selecionado && estado.selecionado.id }),
    objetos: () => objetos.map((o) => ({ id: o.id, tipo: o.tipo, desenhado: desenhados.get(o.id) || null, cx: o.cx, cy: o.cy, largura: o.largura, altura: o.altura, materiais: { ...o.materiais }, vista: o.vista, forma: o.forma, curva: o.curva })),
    /** Centro do objeto na tela, em px CSS do canvas. */
    ondeNaTela: (id) => {
      const o = porId.get(id)
      return { x: estado.panX + o.cx * estado.zoom, y: estado.panY + o.cy * estado.zoom }
    },
    /** Média de cor dos pixels do mapa na caixa do objeto (para provar que algo mudou no desenho). */
    corNoMapa: (id) => {
      const o = porId.get(id)
      const sp = spriteDe(o)
      const d = dpr()
      const k = estado.zoom * d
      const x0 = Math.max(0, Math.floor(estado.panX * d + (o.cx + sp.pecas[0]) * k))
      const y0 = Math.max(0, Math.floor(estado.panY * d + (o.cy + sp.pecas[1]) * k))
      const x1 = Math.min(mapa.width, Math.ceil(estado.panX * d + (o.cx + sp.pecas[2]) * k))
      const y1 = Math.min(mapa.height, Math.ceil(estado.panY * d + (o.cy + sp.pecas[3]) * k))
      if (x1 <= x0 || y1 <= y0) return null
      const px = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data
      let r = 0
      let g = 0
      let b = 0
      const n = px.length / 4
      for (let i = 0; i < px.length; i += 4) {
        r += px[i]
        g += px[i + 1]
        b += px[i + 2]
      }
      return { r: r / n, g: g / n, b: b / n, pixels: n }
    },
    definirEstilo,
    zoomEm: (z) => zoomEm(cssW / 2, cssH / 2, z),
    andar: (dx, dy) => {
      estado.panX += dx
      estado.panY += dy
      limitarCamera()
      pedirQuadro()
    },
    selecionar: (id) => selecionar(porId.get(id), { origem: 'catalogo', centrar: false }),
    fechar: fecharPainel,
    redesenhar: desenhar,
    /** Volta a câmera para a sala inteira, como ao abrir. */
    enquadrar: () => {
      estado.zoom = zoomQueCabe(cssW, cssH)
      estado.panX = cssW / 2 - (MAPA_W / 2) * estado.zoom
      estado.panY = cssH / 2 - (MAPA_H / 2) * estado.zoom
      limitarCamera()
      atualizarZoom()
      desenhar()
    },
    /** Gera uma imagem avulsa e mede: tempo, pixels cobertos e cor (saturação e brilho dos pixels opacos). */
    gerar: (def, S) => {
      const sp = Objetos.gerarSprite(def, S)
      const dados = sp.canvas.getContext('2d').getImageData(0, 0, sp.canvas.width, sp.canvas.height).data
      let opacos = 0
      let somaSat = 0
      let somaLum = 0
      const sats = []
      for (let i = 0; i < dados.length; i += 4) {
        if (dados[i + 3] < 242) continue
        const r = dados[i] / 255
        const g = dados[i + 1] / 255
        const b = dados[i + 2] / 255
        const mx = Math.max(r, g, b)
        const mn = Math.min(r, g, b)
        const sat = mx > 0 ? (mx - mn) / mx : 0
        opacos += 1
        somaSat += sat
        somaLum += 0.2126 * r + 0.7152 * g + 0.0722 * b
        if (opacos % 7 === 0) sats.push(sat)
      }
      sats.sort((a, b) => a - b)
      const areaPegada = def.largura * def.altura * S * S
      return {
        ms: sp.ms, largura: sp.canvas.width, altura: sp.canvas.height, opacos, cobertura: opacos / areaPegada,
        satMedia: opacos ? somaSat / opacos : 0, sat95: sats.length ? sats[Math.floor(sats.length * 0.95)] : 0, lumMedia: opacos ? somaLum / opacos : 0,
      }
    },
    /** Todas as combinações: cada tipo x cada material de cada escolha x desenho x vista x forma. */
    combinacoes: () => {
      const lista = new Map()
      for (const tipo of Objetos.TIPOS) {
        const vistas = Objetos.aceitaVista(tipo) ? ['frente', 'lado'] : ['frente']
        const formas = tipo === 'tapete' ? ['retangular', 'redondo'] : ['retangular']
        const curvas = tipo === 'cerca' ? [0, 150] : [0]
        for (const estilo of ['cima', '34']) for (const vista of vistas) for (const forma of formas) for (const curva of curvas) {
          const [w, h] = Objetos.tamanhoEmCasas(tipo, vista, forma)
          const largura = (tipo === 'cerca' && curva ? 3 : w) * G
          const padrao = Object.fromEntries(RANURAS[tipo].map((r) => [r.id, r.padrao]))
          for (const r of RANURAS[tipo]) for (const id of r.opcoes) {
            const def = { tipo, largura, altura: h * G, vista, forma, curva, estilo, materiais: { ...padrao, [r.id]: id } }
            lista.set(Objetos.chaveDe(def), def)
          }
        }
      }
      return [...lista.values()]
    },
    /** Imagens prontas para as folhas de prova: cada def num ladrilho do chão, na escala pedida. */
    ladrilhos: (defs, escala) => defs.map((def) => {
      const sp = Objetos.gerarSprite(def, Math.max(1, Math.ceil(escala)))
      const pad = 6
      const c = document.createElement('canvas')
      c.width = Math.ceil(sp.largura * escala + pad * 2)
      c.height = Math.ceil(sp.altura * escala + pad * 2)
      const g = c.getContext('2d')
      g.fillStyle = def.chao || '#a8776a'
      g.fillRect(0, 0, c.width, c.height)
      g.imageSmoothingQuality = 'high'
      g.drawImage(Objetos.nivel(sp, escala).canvas, pad, pad, sp.largura * escala, sp.altura * escala)
      return c.toDataURL('image/png')
    }),
  }
})()
