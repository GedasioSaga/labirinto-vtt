/*
 * PÁGINA da vila: câmera, pino, teclado e toque, telhado que some ao entrar,
 * Antes/Depois, Grade e Nomes. O desenho do mapa está em vila.js.
 *
 * Desempenho: tudo o que não se mexe (chão, muro, sebes, praça) é pintado
 * uma vez num canvas; cada peça e cada telhado vira uma imagem guardada.
 * Cada quadro só cola imagens prontas. A primeira pintura sai em 1x; o que
 * fica mais nítido (2x) é gerado depois, uma imagem por vez, quando sobra tempo.
 */
;(function () {
  'use strict'

  const V = Vila
  const T_SCRIPT = performance.now()
  const $ = (s) => document.querySelector(s)
  const fontes = document.querySelector('[data-fontes]')
  if (fontes) fontes.media = 'all'

  const canvas = $('#mapa')
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    canvas.replaceWith(Object.assign(document.createElement('p'), { className: 'erro-canvas', textContent: 'Este navegador não desenha em canvas; o protótipo precisa dele.' }))
    return
  }
  const movimentoReduzido = matchMedia('(prefers-reduced-motion: reduce)')
  const TEMPO_DO_TELHADO = 0.3
  const SOBE_O_TELHADO = 6
  const CRESCE_O_TELHADO = 0.035
  const ZOOM_MIN = 0.35
  const ZOOM_MAX = 3
  const limitar = (v, a, b) => (v < a ? a : v > b ? b : v)
  const easeOut = (p) => 1 - (1 - p) * (1 - p) * (1 - p)

  // ---------- estado ----------

  const est = {
    modo: 'depois',
    grade: true,
    nomes: false,
    cam: { x: 0, y: 0, z: 1 },
    pino: V.INICIO_DO_PINO.slice(),
    teclas: new Set(),
    rota: null,
    wi: 1,
    destino: null,
    telhado: new Map(V.CASAS.map((c) => [c.id, 0])),
    onde: 'praca',
    seguir: true,
  }
  const medidas = { quadros: [], desenho: [], ultimoQuadro: 0 }
  let sujo = true

  const fis = { depois: V.montarFisica(V.obstaculosDepois()), antes: null }
  const nav = { depois: null, antes: null }
  const fisicaAtual = () => (est.modo === 'antes' ? (fis.antes ||= V.montarFisica(V.obstaculosAntes())) : fis.depois)
  const navAtual = () => {
    const m = est.modo
    if (!nav[m]) nav[m] = V.montarNavegacao(fisicaAtual())
    return nav[m]
  }

  // ---------- recursos (imagens) ----------

  const rec = { chao: new Map(), chaoAntes: null, sombras: new Map(), kChao: 1, S: 1 }
  const EXTERNAS = [...V.PECAS_DE_SEBE, ...V.PECAS, ...V.PLACAS, ...V.ARVORES_DE_FORA].sort((a, b) => (a.t === 'arvore') - (b.t === 'arvore') || a.y - b.y)
  const DE_DENTRO = new Map(V.CASAS.map((c) => [c.id, V.PECAS_DE_DENTRO.filter((p) => p.casa === c.id).sort((a, b) => !!b.plano - !!a.plano || a.y - b.y)]))

  /** A melhor imagem pronta da peça, nunca menor que 1x (gera a de 1x na hora se faltar). */
  function imagem(p) {
    for (let S = rec.S; S >= 1; S -= 1) if (V.temImagem(p, S)) return V.imagemDaPeca(p, S)
    return V.imagemDaPeca(p, 1)
  }
  function telhado(c) {
    const k = rec.S >= 2 && rec.telhados2 ? 2 : 1
    return V.imagemDoTelhado(c, k)
  }
  function chao() {
    if (est.modo === 'antes') return (rec.chaoAntes ||= V.pintarChaoAntes(1))
    return rec.chao.get(rec.kChao) || rec.chao.get(1)
  }
  function sombraDaCasa(c) {
    if (!rec.sombras.has(c.id)) rec.sombras.set(c.id, V.pintarSombraDaCasa(c, 1))
    return rec.sombras.get(c.id)
  }

  // ---------- fila de trabalho em segundo plano (uma imagem por vez) ----------

  const fila = []
  let filaRodando = false
  const ocioso = window.requestIdleCallback ? (f) => requestIdleCallback(f, { timeout: 120 }) : (f) => setTimeout(f, 16)
  function enfileirar(nome, f) {
    if (fila.some((t) => t.nome === nome)) return
    fila.push({ nome, f })
    if (!filaRodando) {
      filaRodando = true
      ocioso(rodarFila)
    }
  }
  function rodarFila() {
    const t = fila.shift()
    if (t) {
      t.f()
      sujo = true
    }
    if (fila.length) ocioso(rodarFila)
    else filaRodando = false
  }

  function resolucaoPedida() {
    const dpr = window.devicePixelRatio || 1
    return limitar(Math.ceil(dpr * est.cam.z - 0.1), 1, 2)
  }

  /** Pede as imagens mais nítidas quando o zoom ou a tela pedem; uma por vez, na fila. */
  function pedirNitidez() {
    const S = resolucaoPedida()
    if (S <= 1) return
    for (const p of EXTERNAS) if (!V.temImagem(p, 2)) enfileirar('p2:' + V.PECAS.indexOf(p) + ':' + p.x + ',' + p.y, () => V.imagemDaPeca(p, 2))
    for (const c of V.CASAS) enfileirar('t2:' + c.id, () => V.imagemDoTelhado(c, 2))
    enfileirar('t2:pronto', () => { rec.telhados2 = true })
    for (const nome of ['pedras', 'lajes', 'muro', 'grama', 'mato', 'terra', 'tabuas', 'palha']) enfileirar('l2:' + nome, () => V.ladrilho(nome, 2))
    enfileirar('c2', () => {
      rec.chao.set(2, V.pintarChaoDepois(2))
      rec.kChao = 2
    })
    enfileirar('S2', () => { rec.S = 2 })
  }

  // ---------- câmera ----------

  function tamanhoDaTela() {
    return { w: canvas.clientWidth || 1, h: canvas.clientHeight || 1 }
  }
  /** A vila inteira na tela. Na abertura do celular, em vez disso, fica perto do pino com a porta legível. */
  function enquadrar(abertura) {
    const { w, h } = tamanhoDaTela()
    const E = V.ENQUADRE
    const z = Math.min(w / (E.x1 - E.x0), h / (E.y1 - E.y0))
    if (abertura && z < 0.6) {
      // o enquadre inteiro deixaria a porta com 8 px
      est.cam.z = 0.75
      est.cam.x = est.pino[0]
      est.cam.y = est.pino[1] - 30
    } else {
      est.cam.z = z
      est.cam.x = (E.x0 + E.x1) / 2
      est.cam.y = (E.y0 + E.y1) / 2
    }
    prenderCamera()
    zoomMudou()
  }
  function prenderCamera() {
    const { w, h } = tamanhoDaTela()
    const M = V.MUNDO
    const meiaW = w / 2 / est.cam.z
    const meiaH = h / 2 / est.cam.z
    est.cam.x = M.w > 2 * meiaW ? limitar(est.cam.x, M.x0 + meiaW, M.x1 - meiaW) : (M.x0 + M.x1) / 2
    est.cam.y = M.h > 2 * meiaH ? limitar(est.cam.y, M.y0 + meiaH, M.y1 - meiaH) : (M.y0 + M.y1) / 2
  }
  function telaParaMundo(sx, sy) {
    const { w, h } = tamanhoDaTela()
    return [est.cam.x + (sx - w / 2) / est.cam.z, est.cam.y + (sy - h / 2) / est.cam.z]
  }
  function mundoParaTela(x, y) {
    const { w, h } = tamanhoDaTela()
    return [(x - est.cam.x) * est.cam.z + w / 2, (y - est.cam.y) * est.cam.z + h / 2]
  }
  function zoomEm(z, sx, sy) {
    const antes = telaParaMundo(sx, sy)
    est.cam.z = limitar(z, ZOOM_MIN, ZOOM_MAX)
    const depois = telaParaMundo(sx, sy)
    est.cam.x += antes[0] - depois[0]
    est.cam.y += antes[1] - depois[1]
    prenderCamera()
    zoomMudou()
  }
  function zoomMudou() {
    $('#z-valor').textContent = Math.round(est.cam.z * 100) + '%'
    $('#z-menos').disabled = est.cam.z <= ZOOM_MIN + 1e-6
    $('#z-mais').disabled = est.cam.z >= ZOOM_MAX - 1e-6
    sujo = true
    clearTimeout(zoomMudou.t)
    zoomMudou.t = setTimeout(pedirNitidez, 180)
  }

  /** Mantém o pino no miolo da tela: a câmera anda junto quando ele chega perto da beira. */
  function seguirPino(dt) {
    const { w, h } = tamanhoDaTela()
    const [sx, sy] = mundoParaTela(est.pino[0], est.pino[1])
    const mx = w * 0.28
    const my = h * 0.28
    let dx = 0
    let dy = 0
    if (sx < mx) dx = sx - mx
    else if (sx > w - mx) dx = sx - (w - mx)
    if (sy < my) dy = sy - my
    else if (sy > h - my) dy = sy - (h - my)
    if (!dx && !dy) return false
    const k = movimentoReduzido.matches ? 1 : 1 - Math.exp(-dt * 9)
    est.cam.x += (dx / est.cam.z) * k
    est.cam.y += (dy / est.cam.z) * k
    prenderCamera()
    return true
  }

  // ---------- desenho ----------

  function ajustarCanvas() {
    const dpr = window.devicePixelRatio || 1
    const w = Math.round(canvas.clientWidth * dpr)
    const h = Math.round(canvas.clientHeight * dpr)
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
      sujo = true
    }
  }

  function vistaNoMundo() {
    const { w, h } = tamanhoDaTela()
    const a = telaParaMundo(0, 0)
    const b = telaParaMundo(w, h)
    return [a[0], a[1], b[0], b[1]]
  }
  const visivel = (v, x0, y0, x1, y1) => x1 >= v[0] && x0 <= v[2] && y1 >= v[1] && y0 <= v[3]

  function desenharImagem(img, x, y) {
    ctx.drawImage(img.canvas, x + img.ox, y + img.oy, img.largura, img.altura)
  }

  function desenhar() {
    const t0 = performance.now()
    const dpr = window.devicePixelRatio || 1
    const s = dpr * est.cam.z
    const { w, h } = tamanhoDaTela()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = est.modo === 'antes' ? '#342e2b' : '#3b4631'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.setTransform(s, 0, 0, s, (w / 2 - est.cam.x * est.cam.z) * dpr, (h / 2 - est.cam.y * est.cam.z) * dpr)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'medium'
    const v = vistaNoMundo()
    const M = V.MUNDO
    const c0 = chao()
    ctx.drawImage(c0.canvas, M.x0, M.y0, c0.canvas.width / c0.k, c0.canvas.height / c0.k)
    if (est.grade) desenharGrade(v, s)
    if (est.modo === 'depois') {
      for (const c of V.CASAS) {
        const a = 1 - easeOut(est.telhado.get(c.id))
        if (a <= 0.002) continue
        const sh = sombraDaCasa(c)
        ctx.globalAlpha = a
        ctx.drawImage(sh.canvas, sh.x, sh.y, sh.w, sh.h)
      }
      ctx.globalAlpha = 1
      for (const c of V.CASAS) {
        if (est.telhado.get(c.id) <= 0.002) continue
        for (const p of DE_DENTRO.get(c.id)) desenharImagem(imagem(p), p.x, p.y)
      }
      for (const p of EXTERNAS) {
        const img = imagem(p)
        if (!visivel(v, p.x + img.ox, p.y + img.oy, p.x + img.ox + img.largura, p.y + img.oy + img.altura)) continue
        desenharImagem(img, p.x, p.y)
      }
    }
    desenharTelhados(v)
    if (est.modo === 'depois') {
      for (const c of V.CASAS) {
        desenharPorta(c)
        desenharPlaca(c)
      }
    } else {
      desenharAntes()
    }
    if (est.destino) desenharDestino()
    desenharPino()
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    if (est.modo === 'depois') desenharRotulos()
    medidas.desenho.push(performance.now() - t0)
    if (medidas.desenho.length > 2000) medidas.desenho.splice(0, 1000)
  }

  function desenharGrade(v, s) {
    const G = V.G
    const i0 = Math.floor(Math.max(v[0], V.MUNDO.x0) / G)
    const i1 = Math.ceil(Math.min(v[2], V.MUNDO.x1) / G)
    const j0 = Math.floor(Math.max(v[1], V.MUNDO.y0) / G)
    const j1 = Math.ceil(Math.min(v[3], V.MUNDO.y1) / G)
    ctx.beginPath()
    for (let i = i0; i <= i1; i += 1) {
      ctx.moveTo(i * G, j0 * G)
      ctx.lineTo(i * G, j1 * G)
    }
    for (let j = j0; j <= j1; j += 1) {
      ctx.moveTo(i0 * G, j * G)
      ctx.lineTo(i1 * G, j * G)
    }
    ctx.lineWidth = 1 / s
    ctx.strokeStyle = 'rgba(18, 14, 10, 0.2)'
    ctx.stroke()
  }

  function desenharTelhados(v) {
    const reduz = movimentoReduzido.matches
    for (const c of V.CASAS) {
      const p = est.modo === 'depois' ? est.telhado.get(c.id) : 0
      const e = easeOut(p)
      const a = 1 - e
      if (a <= 0.002) continue
      const t = telhado(c)
      if (!visivel(v, t.x, t.y, t.x + t.w, t.y + t.h)) continue
      ctx.save()
      ctx.globalAlpha = a
      if (!reduz && e > 0) {
        const [cx, cy] = c.centro
        const k = 1 + CRESCE_O_TELHADO * e
        ctx.translate(cx, cy - SOBE_O_TELHADO * e)
        ctx.scale(k, k)
        ctx.translate(-cx, -cy)
      }
      ctx.drawImage(t.canvas, t.x, t.y, t.w, t.h)
      ctx.restore()
    }
  }

  function retArredondado(x, y, w, h, r) {
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, r)
  }

  /** Porta de verdade, por cima do telhado: degrau de pedra, batente escuro, folha de tábua, dobradiças e maçaneta. */
  function desenharPorta(c) {
    ctx.save()
    ctx.translate(c.porta[0], c.porta[1])
    ctx.rotate(c.angulo)
    // degrau
    retArredondado(-18, 7.5, 36, 8, 1.6)
    ctx.fillStyle = '#9a9387'
    ctx.fill()
    ctx.fillStyle = 'rgba(255, 248, 232, 0.2)'
    ctx.fillRect(-17, 8, 34, 1.4)
    ctx.fillStyle = 'rgba(20, 16, 12, 0.32)'
    ctx.fillRect(-18, 14, 36, 1.5)
    // batente
    retArredondado(-16, -9, 32, 18, 1.6)
    ctx.fillStyle = '#3b2b20'
    ctx.fill()
    // folha
    retArredondado(-12.5, -6.5, 25, 15, 1)
    ctx.fillStyle = c.corDaFolha
    ctx.fill()
    ctx.fillStyle = 'rgba(20, 12, 6, 0.26)'
    ctx.fillRect(-4.4, -6.5, 1, 15)
    ctx.fillRect(3.6, -6.5, 1, 15)
    ctx.fillStyle = 'rgba(255, 236, 200, 0.16)'
    ctx.fillRect(-12.5, -6.5, 25, 1.3)
    ctx.fillStyle = '#2a2b2d'
    ctx.fillRect(-12.5, -4, 5.5, 1.5)
    ctx.fillRect(-12.5, 4.2, 5.5, 1.5)
    ctx.beginPath()
    ctx.arc(7.8, 1.4, 1.7, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  /** Placa da fachada: ícone chapado num quadro claro, preso por um suporte de ferro. */
  function desenharPlaca(c) {
    const [x, y] = V.centroDaPlaca(c)
    const r = 10
    ctx.save()
    ctx.fillStyle = 'rgba(14, 10, 6, 0.3)'
    retArredondado(x - r + 1.4, y - r + 1.8, 2 * r, 2 * r, 4)
    ctx.fill()
    ctx.strokeStyle = '#2a2b2d'
    ctx.lineWidth = 1.6
    const suporte = V.pontoDaPorta(c, 31 * c.placa, -5)
    ctx.beginPath()
    ctx.moveTo(suporte[0], suporte[1])
    ctx.lineTo(x, y)
    ctx.stroke()
    retArredondado(x - r, y - r, 2 * r, 2 * r, 4)
    ctx.fillStyle = '#e4d9c2'
    ctx.fill()
    ctx.lineWidth = 1.4
    ctx.strokeStyle = '#4a3a2c'
    ctx.stroke()
    ctx.translate(x - 7, y - 7)
    ctx.scale(14 / 16, 14 / 16)
    desenharIcone(ctx, c.icone, '#3a2f26', '#e4d9c2')
    ctx.restore()
  }

  /** Ícones chapados em 16 x 16: caneca, bigorna, sino, frasco, balança, ferradura e brasão. */
  function desenharIcone(g, tipo, tinta, fundo) {
    g.fillStyle = tinta
    g.strokeStyle = tinta
    g.lineCap = 'round'
    g.lineJoin = 'round'
    const p = new Path2D()
    if (tipo === 'caneca') {
      p.roundRect(2.5, 4.5, 8.5, 10, 1.4)
      g.fill(p)
      g.lineWidth = 1.8
      g.beginPath()
      g.arc(11.2, 9.3, 2.7, -Math.PI / 2, Math.PI / 2)
      g.stroke()
      g.beginPath()
      g.arc(4.2, 4.4, 1.9, 0, Math.PI * 2)
      g.arc(7, 3.7, 2.1, 0, Math.PI * 2)
      g.arc(9.6, 4.4, 1.8, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = fundo
      g.fillRect(5, 7.5, 1.3, 5)
      g.fillRect(8, 7.5, 1.3, 5)
    } else if (tipo === 'bigorna') {
      p.moveTo(0.8, 4.6)
      p.lineTo(12.2, 4.6)
      p.quadraticCurveTo(15.4, 4.8, 15.4, 6.4)
      p.lineTo(11.6, 7.6)
      p.lineTo(10.6, 9.6)
      p.lineTo(12.2, 11.2)
      p.lineTo(12.2, 13.6)
      p.lineTo(3.6, 13.6)
      p.lineTo(3.6, 11.2)
      p.lineTo(5.2, 9.6)
      p.lineTo(4.2, 7.6)
      p.quadraticCurveTo(1, 7.2, 0.8, 4.6)
      p.closePath()
      g.fill(p)
    } else if (tipo === 'sino') {
      p.moveTo(2.4, 12.4)
      p.quadraticCurveTo(3.6, 11, 3.9, 8)
      p.quadraticCurveTo(4.4, 3.6, 8, 3.4)
      p.quadraticCurveTo(11.6, 3.6, 12.1, 8)
      p.quadraticCurveTo(12.4, 11, 13.6, 12.4)
      p.closePath()
      g.fill(p)
      g.fillRect(2, 12, 12, 1.8)
      g.beginPath()
      g.arc(8, 14.6, 1.5, 0, Math.PI * 2)
      g.fill()
      g.lineWidth = 1.4
      g.beginPath()
      g.arc(8, 2.3, 1.3, 0, Math.PI * 2)
      g.stroke()
    } else if (tipo === 'frasco') {
      g.fillRect(6.1, 0.9, 3.8, 1.8)
      g.fillRect(6.6, 2.4, 2.8, 4)
      g.beginPath()
      g.arc(8, 10.4, 5, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = fundo
      g.beginPath()
      g.arc(6.1, 8.9, 1.2, 0, Math.PI * 2)
      g.fill()
    } else if (tipo === 'balanca') {
      g.fillRect(7.2, 2.6, 1.6, 10.6)
      g.fillRect(4.4, 13, 7.2, 1.8)
      g.fillRect(1.6, 3.6, 12.8, 1.4)
      g.beginPath()
      g.arc(8, 2.6, 1.4, 0, Math.PI * 2)
      g.fill()
      g.lineWidth = 0.9
      for (const cx of [3.2, 12.8]) {
        g.beginPath()
        g.moveTo(cx, 4.6)
        g.lineTo(cx - 2.4, 9.4)
        g.moveTo(cx, 4.6)
        g.lineTo(cx + 2.4, 9.4)
        g.stroke()
        g.beginPath()
        g.moveTo(cx - 3, 9.2)
        g.quadraticCurveTo(cx, 12.4, cx + 3, 9.2)
        g.closePath()
        g.fill()
      }
    } else if (tipo === 'ferradura') {
      g.lineWidth = 3.4
      g.lineCap = 'butt'
      g.beginPath()
      g.arc(8, 7.6, 5, Math.PI / 2 + 0.62, Math.PI / 2 - 0.62 + Math.PI * 2)
      g.stroke()
      g.fillStyle = fundo
      for (const a of [2.6, 3.4, 4.3, 5.1, 6, 6.8]) {
        g.beginPath()
        g.arc(8 + Math.cos(a) * 5, 7.6 + Math.sin(a) * 5, 0.75, 0, Math.PI * 2)
        g.fill()
      }
    } else if (tipo === 'brasao') {
      p.moveTo(2.6, 2.2)
      p.lineTo(13.4, 2.2)
      p.lineTo(13.4, 8)
      p.quadraticCurveTo(13.2, 12.6, 8, 14.8)
      p.quadraticCurveTo(2.8, 12.6, 2.6, 8)
      p.closePath()
      g.fill(p)
      g.fillStyle = fundo
      g.beginPath()
      g.moveTo(4.6, 9.4)
      g.lineTo(8, 6.1)
      g.lineTo(11.4, 9.4)
      g.lineTo(11.4, 11.2)
      g.lineTo(8, 7.9)
      g.lineTo(4.6, 11.2)
      g.closePath()
      g.fill()
    }
  }

  function desenharAntes() {
    // as portas de hoje: 5 px, quase invisíveis
    for (const c of V.CASAS) {
      ctx.fillStyle = '#e4bf91'
      ctx.fillRect(c.antes[0] - 2.5, c.antes[1] - 2.5, 5, 5)
      ctx.strokeStyle = '#8a6a44'
      ctx.lineWidth = 0.8
      ctx.strokeRect(c.antes[0] - 2.5, c.antes[1] - 2.5, 5, 5)
    }
    // o quadrado verde-limão com o círculo marrom, e o retângulo marrom solto
    // o brilho verde que vaza, como no print (camadas fracas no lugar do shadowBlur)
    for (let g = 8; g >= 2; g -= 2) {
      ctx.fillStyle = 'rgba(150, 210, 110, 0.09)'
      ctx.fillRect(534 - g, 346 - g, 105 + 2 * g, 99 + 2 * g)
    }
    ctx.fillStyle = '#86b469'
    ctx.fillRect(534, 346, 105, 99)
    ctx.strokeStyle = '#d6dacb'
    ctx.lineWidth = 2
    ctx.strokeRect(535, 347, 103, 97)
    ctx.beginPath()
    ctx.arc(586.5, 395.5, 31, 0, Math.PI * 2)
    ctx.fillStyle = '#4d3800'
    ctx.fill()
    ctx.strokeStyle = '#2a1f02'
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(586.5, 395.5, 19, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = '#523e07'
    ctx.fillRect(782, 297, 36, 17)
    ctx.strokeStyle = '#2f2404'
    ctx.strokeRect(782.5, 297.5, 35, 16)
    ctx.beginPath()
    ctx.moveTo(783, 305.5)
    ctx.lineTo(817, 305.5)
    ctx.stroke()
  }

  function desenharDestino() {
    const [x, y] = est.destino
    ctx.beginPath()
    ctx.arc(x, y, 7, 0, Math.PI * 2)
    ctx.lineWidth = 2
    ctx.strokeStyle = 'rgba(255, 246, 228, 0.85)'
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x, y, 2, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255, 246, 228, 0.85)'
    ctx.fill()
  }

  function desenharPino() {
    const [x, y] = est.pino
    ctx.beginPath()
    ctx.ellipse(x + 2.5, y + 3, 12, 11, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(12, 8, 4, 0.3)'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(x, y, 12, 0, Math.PI * 2)
    ctx.fillStyle = '#f6f3ec'
    ctx.fill()
    ctx.lineWidth = 1.6
    ctx.strokeStyle = '#2b2622'
    ctx.stroke()
    ctx.fillStyle = '#3a332d'
    ctx.beginPath()
    ctx.arc(x, y - 3.6, 2.9, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(x - 6, y + 6.4)
    ctx.quadraticCurveTo(x, y - 3, x + 6, y + 6.4)
    ctx.closePath()
    ctx.fill()
  }

  function rotulo(texto, sx, sy, tamanho) {
    ctx.font = `600 ${tamanho}px Barlow, system-ui, sans-serif`
    const w = ctx.measureText(texto).width + 14
    const h = tamanho + 9
    ctx.beginPath()
    ctx.roundRect(sx - w / 2, sy - h / 2, w, h, h / 2)
    ctx.fillStyle = 'rgba(24, 22, 18, 0.8)'
    ctx.fill()
    ctx.fillStyle = '#f3ece0'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(texto, sx, sy + 0.5)
  }

  function desenharRotulos() {
    for (const e of V.ESTRADAS) {
      const [sx, sy] = mundoParaTela(e.placa[0], e.placa[1] - 18)
      rotulo(`${e.nome}: outro mapa`, sx, sy, 12)
    }
    if (!est.nomes) return
    for (const c of V.CASAS) {
      if (est.telhado.get(c.id) > 0.5) continue
      const [sx, sy] = mundoParaTela(c.centro[0], c.centro[1])
      rotulo(c.nome, sx, sy, 14)
    }
  }

  // ---------- andar ----------

  function direcaoDasTeclas() {
    const t = est.teclas
    const dx = (t.has('direita') ? 1 : 0) - (t.has('esquerda') ? 1 : 0)
    const dy = (t.has('baixo') ? 1 : 0) - (t.has('cima') ? 1 : 0)
    return [dx, dy]
  }

  function irPara(alvo) {
    const n = navAtual()
    const rota = V.caminho(n, est.pino, alvo)
    if (!rota) {
      falar('Não há caminho até lá.')
      return false
    }
    est.rota = rota
    est.wi = 1
    est.destino = rota[rota.length - 1]
    est.seguir = true
    sujo = true
    return true
  }

  function atualizar(dt) {
    let mexeu = false
    const f = fisicaAtual()
    const [dx, dy] = direcaoDasTeclas()
    if (dx || dy) {
      est.rota = null
      est.destino = null
      est.pino = V.andar(f, est.pino, dx, dy, dt)
      est.seguir = true
      mexeu = true
    } else if (est.rota) {
      const n = navAtual()
      est.wi = V.proximoPonto(n, est.rota, est.wi, est.pino)
      const alvo = est.rota[est.wi]
      const dist = Math.hypot(alvo[0] - est.pino[0], alvo[1] - est.pino[1])
      const ultimo = est.wi === est.rota.length - 1
      if (ultimo && dist < 1.5) {
        est.rota = null
        est.destino = null
      } else {
        const passo = V.VELOCIDADE * dt
        if (dist <= passo) est.pino = V.resolver(f, alvo[0], alvo[1], V.RAIO_DO_PINO)
        else est.pino = V.andar(f, est.pino, alvo[0] - est.pino[0], alvo[1] - est.pino[1], dt)
      }
      mexeu = true
    }
    // telhado: some quando o centro do pino cruza a parede, volta quando sai
    let onde = 'praca'
    for (const c of V.CASAS) {
      const [x0, y0, x1, y1] = c.ret
      const dentro = est.modo === 'depois' && est.pino[0] > x0 && est.pino[0] < x1 && est.pino[1] > y0 && est.pino[1] < y1
      if (dentro) onde = c.id
      const p = est.telhado.get(c.id)
      const alvo = dentro ? 1 : 0
      if (p !== alvo) {
        const np = alvo > p ? Math.min(1, p + dt / TEMPO_DO_TELHADO) : Math.max(0, p - dt / TEMPO_DO_TELHADO)
        est.telhado.set(c.id, np)
        mexeu = true
      }
    }
    if (onde === 'praca' && est.modo === 'depois') {
      for (const e of V.ESTRADAS) if (Math.hypot(est.pino[0] - e.fim[0], est.pino[1] - e.fim[1]) < 46) onde = 'saida:' + e.nome
    }
    if (onde !== est.onde) {
      est.onde = onde
      if (onde === 'praca') falar(est.modo === 'antes' ? 'No mapa de hoje.' : 'Na praça.')
      else if (onde.startsWith('saida:')) falar(`Fim da ${onde.slice(6)}: no app, aqui o mestre liga o outro mapa.`)
      else falar(`Dentro: ${V.CASAS.find((c) => c.id === onde).nome}.`)
    }
    if (est.seguir && mexeu) mexeu = seguirPino(dt) || mexeu
    return mexeu
  }

  function falar(texto) {
    const el = $('#estado')
    if (el.textContent !== texto) el.textContent = texto
  }

  let ultimo = performance.now()
  function quadro(agora) {
    const dt = Math.min(0.05, Math.max(0, (agora - ultimo) / 1000))
    medidas.quadros.push(agora - ultimo)
    if (medidas.quadros.length > 2000) medidas.quadros.splice(0, 1000)
    ultimo = agora
    ajustarCanvas()
    if (atualizar(dt)) sujo = true
    if (sujo) {
      sujo = false
      desenhar()
    }
    requestAnimationFrame(quadro)
  }

  // ---------- teclado ----------

  const TECLAS = { ArrowUp: 'cima', ArrowDown: 'baixo', ArrowLeft: 'esquerda', ArrowRight: 'direita', KeyW: 'cima', KeyS: 'baixo', KeyA: 'esquerda', KeyD: 'direita' }
  function teclaDe(e) {
    return TECLAS[e.code] || TECLAS[e.key]
  }
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const alvo = e.target
    if (alvo instanceof HTMLElement && (alvo.closest('[role="radiogroup"]') || alvo.matches('input, textarea, select'))) return
    const t = teclaDe(e)
    if (!t) return
    e.preventDefault()
    est.teclas.add(t)
  })
  window.addEventListener('keyup', (e) => {
    const t = teclaDe(e)
    if (t) est.teclas.delete(t)
  })
  window.addEventListener('blur', () => est.teclas.clear())

  // ---------- toque e mouse ----------

  const toques = new Map()
  let gesto = null
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId)
    toques.set(e.pointerId, [e.offsetX, e.offsetY])
    if (toques.size === 1) gesto = { tipo: 'toque', x: e.offsetX, y: e.offsetY, cx: est.cam.x, cy: est.cam.y }
    else if (toques.size === 2) {
      const [a, b] = [...toques.values()]
      gesto = { tipo: 'pinca', d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, z: est.cam.z }
    }
  })
  canvas.addEventListener('pointermove', (e) => {
    if (!toques.has(e.pointerId) || !gesto) return
    toques.set(e.pointerId, [e.offsetX, e.offsetY])
    if (gesto.tipo === 'pinca' && toques.size >= 2) {
      const [a, b] = [...toques.values()]
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1
      zoomEm(gesto.z * (d / gesto.d), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
      return
    }
    if (gesto.tipo === 'toque' && Math.hypot(e.offsetX - gesto.x, e.offsetY - gesto.y) > 6) gesto.tipo = 'arrasto'
    if (gesto.tipo === 'arrasto') {
      canvas.dataset.arrastando = 'true'
      est.cam.x = gesto.cx - (e.offsetX - gesto.x) / est.cam.z
      est.cam.y = gesto.cy - (e.offsetY - gesto.y) / est.cam.z
      est.seguir = false
      prenderCamera()
      sujo = true
    }
  })
  function soltar(e) {
    if (!toques.has(e.pointerId)) return
    toques.delete(e.pointerId)
    if (gesto && gesto.tipo === 'toque' && e.type === 'pointerup' && toques.size === 0) {
      const alvo = telaParaMundo(e.offsetX, e.offsetY)
      irPara(alvo)
    }
    if (toques.size === 0) {
      gesto = null
      canvas.dataset.arrastando = 'false'
    } else if (gesto && gesto.tipo === 'pinca') gesto = { tipo: 'arrasto-fim' }
  }
  canvas.addEventListener('pointerup', soltar)
  canvas.addEventListener('pointercancel', soltar)
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault()
    zoomEm(est.cam.z * Math.exp(-e.deltaY * 0.0015), e.offsetX, e.offsetY)
  }, { passive: false })

  // ---------- botões ----------

  const radios = [...document.querySelectorAll('[data-modo]')]
  function mudarModo(modo, focar) {
    if (est.modo === modo) return
    est.modo = modo
    for (const b of radios) {
      const sim = b.dataset.modo === modo
      b.setAttribute('aria-checked', String(sim))
      b.tabIndex = sim ? 0 : -1
      if (sim && focar) b.focus()
    }
    est.rota = null
    est.destino = null
    est.pino = V.resolver(fisicaAtual(), est.pino[0], est.pino[1], V.RAIO_DO_PINO)
    const antes = modo === 'antes'
    $('#b-nomes').disabled = antes
    for (const b of document.querySelectorAll('.casa')) b.disabled = antes
    $('#aviso').hidden = !antes
    est.onde = null
    sujo = true
  }
  for (const b of radios) {
    b.addEventListener('click', () => mudarModo(b.dataset.modo, false))
    b.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
      e.preventDefault()
      const i = radios.indexOf(b)
      const prox = radios[(i + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? radios.length - 1 : 1)) % radios.length]
      mudarModo(prox.dataset.modo, true)
    })
  }
  function chave(id, campo) {
    const b = $(id)
    b.addEventListener('click', () => {
      est[campo] = !est[campo]
      b.setAttribute('aria-pressed', String(est[campo]))
      sujo = true
    })
  }
  chave('#b-grade', 'grade')
  chave('#b-nomes', 'nomes')
  const centroDaTela = () => {
    const { w, h } = tamanhoDaTela()
    return [w / 2, h / 2]
  }
  $('#z-mais').addEventListener('click', () => zoomEm(est.cam.z * 1.25, ...centroDaTela()))
  $('#z-menos').addEventListener('click', () => zoomEm(est.cam.z / 1.25, ...centroDaTela()))
  $('#z-valor').addEventListener('click', () => zoomEm(1, ...centroDaTela()))
  $('#z-enquadrar').addEventListener('click', () => {
    est.seguir = false
    enquadrar()
  })

  const lista = $('#casas')
  const dpr0 = window.devicePixelRatio || 1
  for (const c of V.CASAS) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'casa'
    const ic = document.createElement('canvas')
    ic.width = Math.round(32 * dpr0)
    ic.height = Math.round(32 * dpr0)
    ic.setAttribute('aria-hidden', 'true')
    const g = ic.getContext('2d')
    g.scale(dpr0, dpr0)
    g.beginPath()
    g.roundRect(1, 1, 30, 30, 6)
    g.fillStyle = '#e4d9c2'
    g.fill()
    g.strokeStyle = '#4a3a2c'
    g.lineWidth = 1.5
    g.stroke()
    g.translate(6, 6)
    g.scale(20 / 16, 20 / 16)
    desenharIcone(g, c.icone, '#3a2f26', '#e4d9c2')
    const lado = { N: 'norte', S: 'sul', E: 'leste', W: 'oeste' }[c.lado]
    const txt = document.createElement('span')
    txt.innerHTML = `${c.nome}<small>porta a ${lado}</small>`
    b.append(ic, txt)
    b.setAttribute('aria-label', `${c.nome}: levar o pino até a porta`)
    b.addEventListener('click', () => {
      if (irPara(c.dentro)) canvas.focus({ preventScroll: true })
    })
    lista.append(b)
  }

  // ---------- início ----------

  const tempos = {}
  function medir(nome, f) {
    const t = performance.now()
    f()
    tempos[nome] = Math.round((performance.now() - t) * 10) / 10
  }
  /**
   * A primeira pintura em etapas curtas (cada uma bem abaixo de 200 ms), uma
   * tarefa depois da outra pelo MessageChannel, sem esperar quadro nem ócio.
   */
  const ETAPAS = [
    () => medir('ladrilhos', () => { for (const nome of ['pedras', 'lajes', 'muro', 'grama', 'mato', 'terra', 'tabuas', 'palha']) V.ladrilho(nome, 1) }),
    () => medir('chao', () => rec.chao.set(1, V.pintarChaoDepois(1))),
    () => {
      medir('telhados', () => { for (const c of V.CASAS) V.imagemDoTelhado(c, 1) })
      medir('sombras', () => { for (const c of V.CASAS) sombraDaCasa(c) })
    },
    () => medir('pecas', () => { for (const p of EXTERNAS.slice(0, 60)) V.imagemDaPeca(p, 1) }),
    () => medir('pecas2', () => { for (const p of EXTERNAS.slice(60)) V.imagemDaPeca(p, 1) }),
    () => medir('desenho', () => {
      ajustarCanvas()
      enquadrar(true)
      desenhar()
      sujo = false
    }),
  ]

  window.__vila = {
    primeiraPintura: null,
    primeiraPinturaDesdeAbertura: null,
    tempos,
    est,
    medidas,
    V,
    pronto: false,
    fila: () => fila.length,
    navegacao: () => navAtual(),
    fisica: () => fisicaAtual(),
    robo: (semente, i, extra) => V.robo(fis.depois, nav.depois || (nav.depois = V.montarNavegacao(fis.depois)), { semente, casa: V.CASAS[i], inicio: V.INICIO_DO_PINO, ...extra }),
    paraTela: mundoParaTela,
    paraMundo: telaParaMundo,
    redesenhar: () => {
      sujo = true
    },
    /** Só para as provas e os prints de detalhe: põe a câmera num ponto e zoom. */
    camera: (x, y, z) => {
      est.seguir = false
      est.cam.x = x
      est.cam.y = y
      est.cam.z = z
      prenderCamera()
      zoomMudou()
    },
  }

  function depoisDaPrimeiraPintura() {
    const agora = performance.now()
    window.__vila.primeiraPintura = agora - T_SCRIPT
    window.__vila.primeiraPinturaDesdeAbertura = agora
    // em segundo plano: os móveis de dentro, a navegação e o chão de antes
    for (const p of V.PECAS_DE_DENTRO) enfileirar('d1:' + p.casa + p.x + ',' + p.y, () => V.imagemDaPeca(p, 1))
    enfileirar('nav', () => navAtual())
    enfileirar('antes', () => { rec.chaoAntes ||= V.pintarChaoAntes(1) })
    pedirNitidez()
    enfileirar('pronto', () => { window.__vila.pronto = true })
    new ResizeObserver(() => {
      ajustarCanvas()
      prenderCamera()
      sujo = true
    }).observe(canvas)
    ultimo = performance.now()
    requestAnimationFrame(quadro)
  }

  const canal = new MessageChannel()
  canal.port1.onmessage = () => {
    ETAPAS.shift()()
    if (ETAPAS.length) canal.port2.postMessage(0)
    else depoisDaPrimeiraPintura()
  }
  canal.port2.postMessage(0)
})()
