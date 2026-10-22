// pintor.js — tudo o que desenha: paleta Meio-Termo, texturas por código (determinísticas), luz de dia, tarde e
// noite com sombra projetada pelo relevo, a camada estática das colunas, as camadas de grade e de marcação, os
// objetos e as unidades. Usa o Nucleo para a geometria; nada aqui decide regra de jogo.
// eslint-disable-next-line no-var, no-unused-vars
var Pintor = (function () {
  'use strict'
  const N = Nucleo
  const { LH, ML, MA, FUNDO, ZMAX } = N

  // ---------- paleta: as cores base (todas as outras saem destas) ----------
  const PALETA = {
    areia: '#e3c88f', terra: '#c99b69', arenito: '#d4ae70',
    calcada: '#d8cbae', junta: '#a59579', laje: '#e1d6bc',
    grama: '#8cbf80', gramaEscura: '#6aa063', musgo: '#86a865',
    parede: '#e3c07e', telhado: '#e8cb8b', faixa: '#b77f4c',
    pedra: '#bdbcb1', ruina: '#adaca2', rocha: '#a88e74',
    agua: '#4d8dbf', aguaRasa: '#7bb8d4', espuma: '#eef5f1',
    portaAzul: '#5d86bf', portaClara: '#93b3da', madeira: '#9c7650', madeiraEscura: '#6e5238',
    folha: '#5d9850', folhaClara: '#8fc26c', tronco: '#9d7a52',
    vaso: '#b5a5c8', barro: '#c48a5f', tecido: '#c8645a', linho: '#f1ebdc', ferro: '#6c7074', latao: '#c49a52',
    chama: '#f7c55e', brasa: '#e5793f',
    pele: '#f0caa1', peleMorena: '#c98f66', loiro: '#f0cf6e', castanho: '#9a6a43', cabeloEscuro: '#4a4458',
    azul: '#4f78b8', verde: '#5f8f4e', vermelho: '#b8564a', roxo: '#7d5ea8', aco: '#c3c9cf', pelagem: '#8e909a',
    aliado: '#5b8fd8', inimigo: '#d4644f',
  }
  const C = PALETA

  // ---------- cor ----------
  const memo = new Map()
  function hexRgb(h) {
    const n = parseInt(h.slice(1), 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const rgbHex = (r) => '#' + r.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
  function misturar(a, b, f) {
    const x = hexRgb(a)
    const y = hexRgb(b)
    return rgbHex(x.map((v, k) => v + (y[k] - v) * f))
  }
  const clarear = (c, f) => misturar(c, '#fffaf0', f)
  /** Escurece puxando para um roxo frio, como sombra de luz de céu (nunca para o preto). */
  const escurecer = (c, f) => misturar(c, '#2e2a3e', f)
  function linear(v) {
    v /= 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  const luminancia = (r) => 0.2126 * linear(r[0]) + 0.7152 * linear(r[1]) + 0.0722 * linear(r[2])
  function paraHsl([r, g, b]) {
    r /= 255; g /= 255; b /= 255
    const mx = Math.max(r, g, b)
    const mn = Math.min(r, g, b)
    const l = (mx + mn) / 2
    if (mx === mn) return [0, 0, l]
    const d = mx - mn
    const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn)
    let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
    return [h / 6, s, l]
  }
  function deHsl(h, s, l) {
    if (!s) return [l * 255, l * 255, l * 255]
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    const f = (t) => {
      t = (t + 1) % 1
      return 255 * (t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p)
    }
    return [f(h + 1 / 3), f(h), f(h - 1 / 3)]
  }
  /** Piso de luminância do contorno: o traço nunca chega ao preto (prova h). */
  const PISO_DO_CONTORNO = 0.065
  /** Contorno: a própria cor com 52% da luz, nunca abaixo do piso. */
  function contorno(c) {
    const k = 'c' + c
    if (memo.has(k)) return memo.get(k)
    const [h, s, l] = paraHsl(hexRgb(c))
    let l2 = l * 0.52
    let r = deHsl(h, Math.min(1, s * 0.95), l2)
    while (luminancia(r) < PISO_DO_CONTORNO && l2 < 0.95) { l2 += 0.01; r = deHsl(h, Math.min(1, s * 0.95), l2) }
    const out = rgbHex(r)
    memo.set(k, out)
    return out
  }
  const rgba = (c, a) => {
    const [r, g, b] = hexRgb(c)
    return `rgba(${r},${g},${b},${a})`
  }

  // ---------- períodos do dia ----------
  const rad = Math.PI / 180
  /** sol: direção horizontal de onde vem a luz (no mundo), elevação, cor e força; amb: luz do céu (cor da sombra). */
  const PERIODOS = {
    // o sol vem da frente-esquerda da vista inicial (mundo +y, um pouco +x): a face esquerda acende, a sombra cai para trás
    dia: { nome: 'Dia', az: 70 * rad, elev: 52 * rad, cor: [1, 0.97, 0.9], forca: 0.38, amb: [0.69, 0.71, 0.78], tinta: [1, 0.99, 0.96], ceu: ['#9fc8e2', '#dcebee'], grade: 'rgba(58,44,28,0.34)', luzes: false },
    tarde: { nome: 'Tarde', az: 18 * rad, elev: 16 * rad, cor: [1, 0.72, 0.46], forca: 0.66, amb: [0.55, 0.46, 0.54], tinta: [1, 0.84, 0.7], ceu: ['#d98f6a', '#f4d39e'], grade: 'rgba(66,36,30,0.34)', luzes: true },
    noite: { nome: 'Noite', az: 115 * rad, elev: 40 * rad, cor: [0.55, 0.66, 0.95], forca: 0.22, amb: [0.25, 0.3, 0.45], tinta: [0.42, 0.48, 0.68], ceu: ['#141c34', '#2e3b62'], grade: 'rgba(214,226,255,0.26)', luzes: true },
  }
  const COR_DA_LUZ = [1, 0.66, 0.32]

  // ---------- canvas fora da tela ----------
  function tela(w, h) {
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.ceil(w))
    c.height = Math.max(1, Math.ceil(h))
    return c
  }

  // ---------- atlas dos topos (no espaço do mundo, contínuo entre blocos vizinhos) ----------
  const T = 48
  /** Material de topo que conta como "chão de pedra" (a grama não invade). */
  const DUROS = new Set(['telhado', 'ruina', 'degrau', 'agua', 'laje'])

  function pintarAtlas(m) {
    const atlas = tela(m.W * T, m.H * T)
    const g = atlas.getContext('2d')
    const H = N.hash
    // 1) fundo de cada material
    for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
      const c = N.cel(m, x, y)
      g.save()
      g.beginPath()
      g.rect(x * T, y * T, T, T)
      g.clip()
      pintarMaterial(g, m, c, x, y)
      g.restore()
    }
    // 2) a grama e o musgo invadem a borda dos vizinhos na mesma altura (borda irregular, sem quadrado)
    for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
      const c = N.cel(m, x, y)
      if (c.topo !== 'grama' && c.topo !== 'musgo') continue
      const cor = c.topo === 'grama' ? C.grama : C.musgo
      for (const [dx, dy] of N.D8) {
        const nx = x + dx
        const ny = y + dy
        if (!N.dentro(m, nx, ny)) continue
        const v = N.cel(m, nx, ny)
        if (v.topo === c.topo || DUROS.has(v.topo) || v.h !== c.h || v.escada >= 0 || v.predio >= 0) continue
        g.save()
        g.beginPath()
        g.rect(nx * T, ny * T, T, T)
        g.clip()
        for (let k = 0; k < 7; k++) {
          const f = (k + 0.5) / 7
          const px = (x + 0.5 + dx * 0.5) * T + (dy ? 0 : 0) + (dx === 0 ? (f - 0.5) * T : 0)
          const py = (y + 0.5 + dy * 0.5) * T + (dy === 0 ? (f - 0.5) * T : 0)
          if (dx && dy && k > 1) break
          const r = T * (0.07 + 0.11 * H(nx * 7 + k, ny * 5, 31))
          g.fillStyle = cor
          g.beginPath()
          g.ellipse(px + dx * r * 0.4, py + dy * r * 0.4, r * 1.2, r, 0, 0, Math.PI * 2)
          g.fill()
        }
        g.restore()
      }
    }
    // 3) grão leve por cima de tudo (multiplicador ±3,5%, fixo por posição)
    const img = g.getImageData(0, 0, atlas.width, atlas.height)
    const d = img.data
    for (let p = 0, k = 0; p < d.length; p += 4, k++) {
      const px = k % atlas.width
      const py = (k / atlas.width) | 0
      const n = 1 + (H(px >> 1, py >> 1, 77) - 0.5) * 0.07
      d[p] *= n
      d[p + 1] *= n
      d[p + 2] *= n
    }
    g.putImageData(img, 0, 0)
    return atlas
  }

  function manchas(g, x0, y0, cor, n, s, alfa) {
    for (let k = 0; k < n; k++) {
      const px = x0 + N.hash(x0 + k, y0, s) * T
      const py = y0 + N.hash(x0, y0 + k, s + 1) * T
      const r = T * (0.12 + 0.2 * N.hash(x0 + k, y0 + k, s + 2))
      g.fillStyle = rgba(cor, alfa)
      g.beginPath()
      g.ellipse(px, py, r * 1.3, r, N.hash(k, x0, s) * 3, 0, Math.PI * 2)
      g.fill()
    }
  }
  function pedrinhas(g, x0, y0, cor, n, s) {
    for (let k = 0; k < n; k++) {
      const px = x0 + 3 + N.hash(x0 + k * 3, y0, s) * (T - 6)
      const py = y0 + 3 + N.hash(x0, y0 + k * 3, s + 1) * (T - 6)
      const r = 1 + N.hash(k, y0, s) * 1.4
      g.fillStyle = cor
      g.beginPath()
      g.ellipse(px, py, r * 1.3, r, 0, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = rgba('#fffaf0', 0.35)
      g.beginPath()
      g.ellipse(px - 0.4, py - 0.5, r * 0.6, r * 0.4, 0, 0, Math.PI * 2)
      g.fill()
    }
  }
  /** Pedras arredondadas de uma grade global (contínua entre blocos): calçamento, lajes, piso de ruína, degraus. */
  function assentar(g, x, y, passo, base, junta, opts = {}) {
    const x0 = x * T
    const y0 = y * T
    g.fillStyle = junta
    g.fillRect(x0, y0, T, T)
    const linhas = Math.ceil(T / passo) + 2
    const fy0 = Math.floor(y0 / passo) - 1
    for (let r = 0; r < linhas; r++) {
      const ry = fy0 + r
      const desloc = opts.fiada ? (ry % 2) * passo * 0.5 : 0
      const fx0 = Math.floor((x0 - desloc) / passo) - 1
      for (let q = 0; q < linhas; q++) {
        const rx = fx0 + q
        const h1 = N.hash(rx, ry, opts.semente || 3)
        const h2 = N.hash(rx, ry, (opts.semente || 3) + 9)
        const cx = rx * passo + desloc + passo / 2 + (h1 - 0.5) * passo * (opts.jitter ?? 0.18)
        const cy = ry * passo + passo / 2 + (h2 - 0.5) * passo * (opts.jitter ?? 0.18)
        const w = passo * (opts.larg ?? 0.86) * (0.9 + 0.2 * h2)
        const h = passo * (opts.alt ?? 0.8) * (0.9 + 0.2 * h1)
        const tom = (N.hash(rx, ry, 41) - 0.5) * (opts.variacao ?? 0.14)
        const cor = tom > 0 ? clarear(base, tom) : escurecer(base, -tom)
        const rr = Math.min(w, h) * (opts.redondo ?? 0.38)
        g.fillStyle = cor
        g.beginPath()
        g.roundRect(cx - w / 2, cy - h / 2, w, h, rr)
        g.fill()
        // luz por cima e à esquerda, sombra embaixo e à direita: cada pedra tem volume
        g.fillStyle = rgba('#fffaf0', 0.22)
        g.beginPath()
        g.roundRect(cx - w / 2 + 1, cy - h / 2 + 0.8, w - 3, h * 0.38, rr * 0.7)
        g.fill()
        g.fillStyle = rgba(escurecer(base, 0.5), 0.16)
        g.beginPath()
        g.roundRect(cx - w / 2 + 2, cy + h * 0.12, w - 3, h * 0.36, rr * 0.7)
        g.fill()
      }
    }
  }

  function pintarMaterial(g, m, c, x, y) {
    const x0 = x * T
    const y0 = y * T
    const t = c.topo
    const variacao = (N.fbm(x * 0.4, y * 0.4, 13) - 0.5) * 0.16
    const tom = (base) => (variacao > 0 ? clarear(base, variacao) : escurecer(base, -variacao))
    if (t === 'areia' || t === 'terra' || t === 'rocha') {
      const base = t === 'areia' ? C.areia : t === 'terra' ? C.terra : misturar(C.rocha, C.pedra, 0.35)
      g.fillStyle = tom(base)
      g.fillRect(x0, y0, T, T)
      manchas(g, x0, y0, clarear(base, 0.3), 3, 5, 0.22)
      manchas(g, x0, y0, escurecer(base, 0.3), 2, 9, 0.12)
      pedrinhas(g, x0, y0, escurecer(base, 0.32), t === 'areia' ? 2 : 5, 17 + x)
      return
    }
    if (t === 'grama' || t === 'musgo') {
      const base = t === 'grama' ? C.grama : C.musgo
      if (t === 'musgo') {
        assentar(g, x, y, 24, C.pedra, escurecer(C.pedra, 0.32), { jitter: 0.3, semente: 7, redondo: 0.2, larg: 0.9, alt: 0.86 })
        g.fillStyle = rgba(base, 0.9)
        for (let k = 0; k < 9; k++) {
          const px = x0 + N.hash(x * 3 + k, y, 51) * T
          const py = y0 + N.hash(x, y * 3 + k, 52) * T
          const r = T * (0.12 + 0.12 * N.hash(k, x + y, 53))
          g.beginPath()
          g.ellipse(px, py, r * 1.25, r, 0, 0, Math.PI * 2)
          g.fill()
        }
      } else {
        g.fillStyle = tom(base)
        g.fillRect(x0, y0, T, T)
        manchas(g, x0, y0, clarear(base, 0.22), 3, 21, 0.3)
        manchas(g, x0, y0, C.gramaEscura, 2, 23, 0.28)
      }
      // tufos curtos em V (poucos, espalhados: textura, não hachura)
      for (let k = 0; k < 7; k++) {
        const px = x0 + 4 + N.hash(x * 11 + k, y, 61) * (T - 8)
        const py = y0 + 6 + N.hash(x, y * 11 + k, 62) * (T - 10)
        const cor = k % 3 === 0 ? clarear(C.folhaClara, 0.1) : C.gramaEscura
        g.strokeStyle = cor
        g.lineWidth = 1.3
        g.lineCap = 'round'
        g.beginPath()
        g.moveTo(px - 2.2, py - 3.2)
        g.lineTo(px, py)
        g.lineTo(px + 0.4, py - 4)
        g.moveTo(px, py)
        g.lineTo(px + 2.6, py - 2.8)
        g.stroke()
      }
      if (t === 'grama' && N.hash(x, y, 71) > 0.62) {
        const flor = [C.linho, C.chama, C.vaso][Math.floor(N.hash(x, y, 72) * 3)]
        for (let k = 0; k < 3; k++) {
          const px = x0 + 8 + N.hash(x + k, y, 73) * (T - 16)
          const py = y0 + 8 + N.hash(x, y + k, 74) * (T - 16)
          g.fillStyle = flor
          g.beginPath()
          g.arc(px, py, 1.5, 0, Math.PI * 2)
          g.fill()
        }
      }
      return
    }
    if (t === 'calcada') {
      assentar(g, x, y, 12, tom(C.calcada), C.junta, { fiada: true, semente: 3, jitter: 0.22, redondo: 0.45, variacao: 0.16 })
      return
    }
    if (t === 'laje') {
      assentar(g, x, y, 24, tom(C.laje), escurecer(C.laje, 0.22), { semente: 5, jitter: 0.04, redondo: 0.12, larg: 0.95, alt: 0.94, variacao: 0.08 })
      return
    }
    if (t === 'pedra') {
      assentar(g, x, y, 16, tom(C.pedra), escurecer(C.pedra, 0.34), { fiada: true, semente: 9, jitter: 0.3, redondo: 0.18, larg: 0.92, alt: 0.86 })
      if (N.hash(x, y, 81) > 0.7) {
        g.strokeStyle = rgba(escurecer(C.pedra, 0.45), 0.5)
        g.lineWidth = 1
        g.beginPath()
        let px = x0 + N.hash(x, y, 82) * T
        let py = y0
        g.moveTo(px, py)
        for (let k = 0; k < 4; k++) { px += (N.hash(x + k, y, 83) - 0.5) * 12; py += T / 4; g.lineTo(px, py) }
        g.stroke()
      }
      return
    }
    if (t === 'telhado' || t === 'ruina') {
      const base = t === 'telhado' ? C.telhado : C.ruina
      if (t === 'ruina') assentar(g, x, y, 16, tom(base), escurecer(base, 0.3), { fiada: true, semente: 11, jitter: 0.12, redondo: 0.15, larg: 0.94, alt: 0.9 })
      else {
        g.fillStyle = tom(base)
        g.fillRect(x0, y0, T, T)
        manchas(g, x0, y0, clarear(base, 0.35), 3, 91, 0.25)
        manchas(g, x0, y0, escurecer(base, 0.2), 2, 93, 0.12)
      }
      // borda alta do telhado (a mureta) onde o vizinho não é do mesmo prédio
      const borda = 6
      for (let d = 0; d < 4; d++) {
        const nx = x + N.DX[d]
        const ny = y + N.DY[d]
        const mesmo = N.dentro(m, nx, ny) && N.cel(m, nx, ny).predio === c.predio && N.cel(m, nx, ny).h === c.h
        if (mesmo) continue
        const r = d === 0 ? [x0 + T - borda, y0, borda, T] : d === 1 ? [x0, y0 + T - borda, T, borda] : d === 2 ? [x0, y0, borda, T] : [x0, y0, T, borda]
        g.fillStyle = clarear(base, 0.3)
        g.fillRect(...r)
        g.fillStyle = rgba(escurecer(base, 0.45), 0.35)
        const s = d === 0 ? [r[0] - 2, y0, 2, T] : d === 1 ? [x0, r[1] - 2, T, 2] : d === 2 ? [x0 + borda, y0, 2, T] : [x0, y0 + borda, T, 2]
        g.fillRect(...s)
      }
      if (t === 'ruina') {
        g.fillStyle = rgba(C.musgo, 0.85)
        for (let k = 0; k < 3; k++) {
          if (N.hash(x, y + k, 95) < 0.5) continue
          g.beginPath()
          g.ellipse(x0 + N.hash(x + k, y, 96) * T, y0 + N.hash(x, y + k, 97) * T, 7, 5, 0, 0, Math.PI * 2)
          g.fill()
        }
      }
      return
    }
    if (t === 'degrau') {
      // três pisadas de pedra; a quina de cada uma tem um filete de luz
      const pedra = c.lado === 'rocha' ? misturar(C.pedra, C.rocha, 0.3) : c.lado === 'parede' ? C.parede : C.laje
      g.fillStyle = escurecer(pedra, 0.2)
      g.fillRect(x0, y0, T, T)
      for (let k = 0; k < 3; k++) {
        const a = k / 3
        const b = (k + 1) / 3
        let r
        if (c.escada === 0) r = [x0 + a * T, y0, T / 3, T]
        else if (c.escada === 1) r = [x0, y0 + a * T, T, T / 3]
        else if (c.escada === 2) r = [x0 + (1 - b) * T, y0, T / 3, T]
        else r = [x0, y0 + (1 - b) * T, T, T / 3]
        g.fillStyle = k % 2 ? clarear(pedra, 0.06) : pedra
        g.fillRect(r[0] + 0.5, r[1] + 0.5, r[2] - 1, r[3] - 1)
        g.fillStyle = rgba('#fffaf0', 0.4)
        // o filete fica na quina de descida
        if (c.escada === 0) g.fillRect(r[0] + r[2] - 3, r[1], 2.5, r[3])
        else if (c.escada === 1) g.fillRect(r[0], r[1] + r[3] - 3, r[2], 2.5)
        else if (c.escada === 2) g.fillRect(r[0] + 0.5, r[1], 2.5, r[3])
        else g.fillRect(r[0], r[1] + 0.5, r[2], 2.5)
      }
      return
    }
    if (t === 'agua') {
      // o fundo da água é pintado depois, num passe só, para clarear perto da margem
      g.fillStyle = C.agua
      g.fillRect(x0, y0, T, T)
    }
  }

  /** A água: mais clara perto da margem, espuma na beira e marolas curtas. Pintada por cima do atlas. */
  function pintarAgua(m, atlas) {
    const g = atlas.getContext('2d')
    const S = 8
    const campo = tela(m.W * S, m.H * S)
    const cg = campo.getContext('2d')
    const img = cg.createImageData(campo.width, campo.height)
    const terra = (x, y) => N.dentro(m, x, y) && !N.cel(m, x, y).agua
    const funda = hexRgb(escurecer(C.agua, 0.18))
    const rasa = hexRgb(C.aguaRasa)
    for (let sy = 0; sy < campo.height; sy++) for (let sx = 0; sx < campo.width; sx++) {
      const px = (sx + 0.5) / S
      const py = (sy + 0.5) / S
      let dmin = 3
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const x = Math.floor(px) + dx
        const y = Math.floor(py) + dy
        if (!terra(x, y)) continue
        const qx = Math.max(x, Math.min(x + 1, px))
        const qy = Math.max(y, Math.min(y + 1, py))
        dmin = Math.min(dmin, Math.hypot(px - qx, py - qy))
      }
      const f = Math.min(1, dmin / 2.6) * (0.85 + 0.3 * (N.fbm(px * 0.5, py * 0.5, 3) - 0.5))
      const k = (sy * campo.width + sx) * 4
      for (let ch = 0; ch < 3; ch++) img.data[k + ch] = rasa[ch] + (funda[ch] - rasa[ch]) * Math.max(0, Math.min(1, f))
      img.data[k + 3] = 255
    }
    cg.putImageData(img, 0, 0)
    for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
      const c = N.cel(m, x, y)
      if (!c.agua) continue
      const x0 = x * T
      const y0 = y * T
      g.save()
      g.beginPath()
      g.rect(x0, y0, T, T)
      g.clip()
      g.imageSmoothingEnabled = true
      g.drawImage(campo, x * S, y * S, S, S, x0, y0, T, T)
      // marolas: arcos curtos e claros, poucos
      g.strokeStyle = rgba(C.espuma, 0.28)
      g.lineWidth = 1.2
      g.lineCap = 'round'
      for (let k = 0; k < 2; k++) {
        const px = x0 + 6 + N.hash(x * 5 + k, y, 101) * (T - 12)
        const py = y0 + 6 + N.hash(x, y * 5 + k, 102) * (T - 12)
        g.beginPath()
        g.arc(px, py + 6, 7, Math.PI * 1.2, Math.PI * 1.8)
        g.stroke()
      }
      // espuma na beira de terra
      for (let d = 0; d < 4; d++) {
        if (!terra(x + N.DX[d], y + N.DY[d])) continue
        for (let k = 0; k < 6; k++) {
          const f = (k + 0.5) / 6
          const ao = 3 + N.hash(x * 9 + k, y + d, 103) * 4
          const px = d === 0 ? x0 + T - ao : d === 2 ? x0 + ao : x0 + f * T
          const py = d === 1 ? y0 + T - ao : d === 3 ? y0 + ao : y0 + f * T
          g.fillStyle = rgba(C.espuma, 0.55 + 0.25 * N.hash(k, x + y, 104))
          g.beginPath()
          g.ellipse(px, py, d % 2 ? 5 : 2.4, d % 2 ? 2.4 : 5, 0, 0, Math.PI * 2)
          g.fill()
        }
      }
      g.restore()
    }
  }

  // ---------- luz ----------
  function prepararLuz(m) {
    if (m._luz) return m._luz
    const alt = new Float32Array(m.W * m.H)
    m.c.forEach((c, i) => { alt[i] = c.agua ? N.topoZ(c) : c.h })
    const lampadas = []
    for (const p of m.props) {
      const L = N.PROPS[p.tipo].luz
      if (L) lampadas.push({ x: p.x + 0.5, y: p.y + 0.5, z: N.alturaEmPe(N.cel(m, p.x, p.y)) + L.z, raio: L.raio, forca: L.forca })
    }
    m._luz = { alt, lampadas }
    return m._luz
  }
  /** Fração da luz do sol que chega ao ponto (0 = na sombra do relevo), com 3 raios para a borda ficar macia. */
  function visivelAoSol(m, P, px, py, pz) {
    const { alt } = prepararLuz(m)
    const tg = Math.tan(P.elev)
    let soma = 0
    for (const j of [-0.07, 0, 0.07]) {
      const cx = Math.cos(P.az + j)
      const cy = Math.sin(P.az + j)
      let livre = 1
      for (let t = 0.1; t < 16; t += 0.1) {
        const z = pz + t * tg
        if (z > ZMAX + 0.01) break
        const qx = px + cx * t
        const qy = py + cy * t
        if (qx < 0 || qy < 0 || qx >= m.W || qy >= m.H) break
        if (alt[(qy | 0) * m.W + (qx | 0)] > z) { livre = 0; break }
      }
      soma += livre
    }
    return soma / 3
  }
  /** Luz que multiplica a cor (céu + sol) e brilho que soma (lampiões), num ponto com normal (nx, ny, nz). */
  function luzNoPonto(m, P, px, py, pz, nx, ny, nz, ao = 1) {
    const sx = Math.cos(P.az) * Math.cos(P.elev)
    const sy = Math.sin(P.az) * Math.cos(P.elev)
    const sz = Math.sin(P.elev)
    const d = nx * sx + ny * sy + nz * sz
    const vis = d > 0 ? visivelAoSol(m, P, px + nx * 0.03, py + ny * 0.03, pz + 0.02) : 0
    const mul = [0, 1, 2].map((k) => Math.min(1, P.amb[k] * ao + P.cor[k] * P.forca * Math.max(0, d) * vis))
    const brilho = [0, 0, 0]
    if (P.luzes) {
      const k = P === PERIODOS.noite ? 1 : 0.35
      for (const L of prepararLuz(m).lampadas) {
        const dx = L.x - px
        const dy = L.y - py
        const dz = L.z - pz
        const dist = Math.hypot(dx, dy, dz * 0.7)
        if (dist >= L.raio) continue
        const vira = Math.max(0.3, (nx * dx + ny * dy + nz * dz) / (dist || 1))
        const f = (1 - dist / L.raio) ** 2 * L.forca * vira * k
        for (let ch = 0; ch < 3; ch++) brilho[ch] += COR_DA_LUZ[ch] * f
      }
    }
    return { mul, brilho }
  }
  /** Mapa de luz dos topos (8 amostras por bloco), mais o brilho dos lampiões. Calculado em faixas (fila de fundo). */
  function mapaDeLuz(m, periodo, faixa) {
    const chave = 'luz:' + periodo
    const P = PERIODOS[periodo]
    const S = 8
    let L = m._cache[chave]
    if (!L) {
      L = { mul: tela(m.W * S, m.H * S), glow: tela(m.W * S, m.H * S), feito: 0, temBrilho: false }
      L.imul = L.mul.getContext('2d').createImageData(L.mul.width, L.mul.height)
      L.iglow = L.glow.getContext('2d').createImageData(L.glow.width, L.glow.height)
      m._cache[chave] = L
    }
    const ate = Math.min(L.mul.height, faixa ? L.feito + faixa : L.mul.height)
    const { alt } = prepararLuz(m)
    for (let sy = L.feito; sy < ate; sy++) for (let sx = 0; sx < L.mul.width; sx++) {
      const px = (sx + 0.5) / S
      const py = (sy + 0.5) / S
      const x = px | 0
      const y = py | 0
      const pz = N.alturaNoPonto(m, px, py)
      // sombra de contato: perto do pé de um vizinho mais alto, menos céu
      let ao = 1
      for (let d = 0; d < 4; d++) {
        const nx = x + N.DX[d]
        const ny = y + N.DY[d]
        if (!N.dentro(m, nx, ny) || alt[ny * m.W + nx] <= pz + 0.4) continue
        const dist = d === 0 ? x + 1 - px : d === 2 ? px - x : d === 1 ? y + 1 - py : py - y
        if (dist < 0.4) ao = Math.min(ao, 0.72 + 0.28 * (dist / 0.4))
      }
      const { mul, brilho } = luzNoPonto(m, P, px, py, pz, 0, 0, 1, ao)
      const k = (sy * L.mul.width + sx) * 4
      for (let ch = 0; ch < 3; ch++) {
        L.imul.data[k + ch] = mul[ch] * 255
        L.iglow.data[k + ch] = Math.min(1, brilho[ch]) * 255
        if (brilho[ch] > 0.004) L.temBrilho = true
      }
      L.imul.data[k + 3] = 255
      L.iglow.data[k + 3] = 255
    }
    L.feito = ate
    if (L.feito >= L.mul.height && !L.pronto) {
      L.mul.getContext('2d').putImageData(L.imul, 0, 0)
      L.glow.getContext('2d').putImageData(L.iglow, 0, 0)
      L.pronto = true
    }
    return L
  }
  /** O atlas aceso: a cor dos topos vezes a luz, mais o brilho dos lampiões. */
  function atlasAceso(m, periodo) {
    const chave = 'atlas:' + periodo
    if (m._cache[chave]) return m._cache[chave]
    if (!m._cache.atlas) {
      m._cache.atlas = pintarAtlas(m)
      pintarAgua(m, m._cache.atlas)
    }
    const L = mapaDeLuz(m, periodo)
    const base = m._cache.atlas
    const out = tela(base.width, base.height)
    const g = out.getContext('2d')
    g.drawImage(base, 0, 0)
    g.globalCompositeOperation = 'multiply'
    g.imageSmoothingEnabled = true
    g.drawImage(L.mul, 0, 0, base.width, base.height)
    if (L.temBrilho) {
      g.globalCompositeOperation = 'lighter'
      g.drawImage(L.glow, 0, 0, base.width, base.height)
    }
    m._cache[chave] = out
    return out
  }

  // ---------- as faces (paredes, penhascos, muros) ----------
  /** Luz de uma face inteira, numa grade pequena (4 x n), esticada com suavização sobre a face. */
  const rascunho = { c: null }
  function grade(nx, ny) {
    if (!rascunho.c) rascunho.c = tela(8, 24)
    const c = rascunho.c
    if (c.width !== nx || c.height !== ny) { c.width = nx; c.height = ny }
    return c
  }
  function luzDaFace(m, periodo, f) {
    const chave = `fl:${periodo}:${f.i}:${f.dirW}:${f.zTop.toFixed(3)}:${f.zLow.toFixed(3)}:${f.a0.toFixed(3)}:${f.a1.toFixed(3)}`
    const cache = m._cache.faces || (m._cache.faces = new Map())
    if (cache.has(chave)) return cache.get(chave)
    const P = PERIODOS[periodo]
    const nx = 4
    const ny = Math.max(2, Math.min(24, Math.ceil((f.zTop - f.zLow) * 2) + 1))
    const mul = new Uint8ClampedArray(nx * ny * 4)
    const glow = new Uint8ClampedArray(nx * ny * 4)
    let temBrilho = false
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const fx = f.a0 + (f.a1 - f.a0) * (i / (nx - 1))
      const z = f.zTop - (f.zTop - f.zLow) * (j / (ny - 1))
      const px = f.ex0 + f.ux * fx
      const py = f.ey0 + f.uy * fx
      const ao = z - f.zLow < 0.35 ? 0.78 + 0.22 * ((z - f.zLow) / 0.35) : 1
      const { mul: l, brilho } = luzNoPonto(m, P, px, py, z, N.DX[f.dirW], N.DY[f.dirW], 0, ao)
      const k = (j * nx + i) * 4
      for (let ch = 0; ch < 3; ch++) {
        mul[k + ch] = l[ch] * 255
        glow[k + ch] = Math.min(1, brilho[ch]) * 255
        if (brilho[ch] > 0.004) temBrilho = true
      }
      mul[k + 3] = 255
      glow[k + 3] = 255
    }
    const out = { nx, ny, mul: new ImageData(mul, nx, ny), glow: temBrilho ? new ImageData(glow, nx, ny) : null }
    cache.set(chave, out)
    return out
  }

  function faixaZigueZague(g, larg, y, cor) {
    g.fillStyle = cor
    g.fillRect(0, y, larg, 7)
    g.fillStyle = clarear(C.parede, 0.35)
    for (let x = -2; x < larg; x += 8) {
      g.beginPath()
      g.moveTo(x, y + 6)
      g.lineTo(x + 4, y + 1.2)
      g.lineTo(x + 8, y + 6)
      g.closePath()
      g.fill()
    }
    g.fillStyle = rgba(contorno(cor), 0.5)
    g.fillRect(0, y + 7, larg, 1)
  }
  function arco(g, cx, base, w, h) {
    g.beginPath()
    g.moveTo(cx - w / 2, base)
    g.lineTo(cx - w / 2, base - h + w / 2)
    g.arc(cx, base - h + w / 2, w / 2, Math.PI, 0)
    g.lineTo(cx + w / 2, base)
    g.closePath()
  }
  function janela(g, cx, base, w, h, noite) {
    g.fillStyle = C.portaAzul
    arco(g, cx, base + 1.5, w + 4, h + 3)
    g.fill()
    g.fillStyle = noite ? misturar(C.chama, C.brasa, 0.25) : misturar(C.madeiraEscura, C.portaAzul, 0.35)
    arco(g, cx, base, w, h)
    g.fill()
    if (!noite) {
      g.fillStyle = rgba(C.portaClara, 0.55)
      g.fillRect(cx - w / 2 + 1.5, base - h + w / 2, 1.6, h - w / 2 - 1)
    }
    g.fillStyle = clarear(C.parede, 0.4)
    g.fillRect(cx - w / 2 - 3, base + 1.5, w + 6, 2.2)
  }
  function porta(g, cx, base, aberta) {
    const w = 15
    const h = 20
    g.fillStyle = C.portaAzul
    arco(g, cx, base, w + 7, h + 4)
    g.fill()
    g.strokeStyle = C.portaClara
    g.lineWidth = 1.2
    arco(g, cx, base, w + 4.5, h + 2.2)
    g.stroke()
    g.fillStyle = aberta ? misturar(C.madeiraEscura, '#2e2a3e', 0.4) : C.madeira
    arco(g, cx, base, w, h)
    g.fill()
    g.strokeStyle = rgba(contorno(C.madeira), 0.7)
    g.lineWidth = 1
    g.beginPath()
    g.moveTo(cx, base - h + 2)
    g.lineTo(cx, base)
    g.stroke()
    g.fillStyle = C.latao
    g.beginPath()
    g.arc(cx - 2.2, base - 8, 1, 0, Math.PI * 2)
    g.arc(cx + 2.2, base - 8, 1, 0, Math.PI * 2)
    g.fill()
  }
  function estratos(g, larg, alto, zTop, cores, semente, xm) {
    // faixas largas de tom (sem traço fino): a fronteira ondula com a posição no mundo
    const n = cores.length
    for (let b = -1; b < Math.ceil(zTop * 2 + 4); b++) {
      const zc = Math.floor(zTop * 2) / 2 - b * 0.5
      const yTop = (zTop - zc) * LH
      if (yTop > alto + 12) break
      g.fillStyle = cores[((b % n) + n) % n]
      g.beginPath()
      g.moveTo(-2, alto + 2)
      for (let x = -2; x <= larg + 2; x += 4) {
        const onda = (N.ruido((xm + x) * 0.06, zc * 3, semente) - 0.5) * 7
        g.lineTo(x, yTop + onda)
      }
      g.lineTo(larg + 2, alto + 2)
      g.closePath()
      g.fill()
    }
  }
  /** Pinta uma face no espaço dela: x da esquerda para a direita (32 por bloco), y para baixo (24 por nível). */
  function pintarFace(g, m, f, periodo) {
    const c = m.c[f.i]
    const larg = f.larg
    const alto = (f.zTop - f.zLow) * LH
    const xm = f.xm * 32
    const noite = periodo === 'noite'
    const mat = f.riser ? 'degrau' : c.lado
    if (mat === 'parede') {
      const grad = g.createLinearGradient(0, 0, 0, alto)
      grad.addColorStop(0, clarear(C.parede, 0.06))
      grad.addColorStop(1, escurecer(C.parede, 0.06))
      g.fillStyle = grad
      g.fillRect(0, 0, larg, alto)
      for (let k = 0; k < 3; k++) {
        g.fillStyle = rgba(k % 2 ? escurecer(C.parede, 0.4) : clarear(C.parede, 0.5), 0.07)
        g.beginPath()
        g.ellipse(N.hash(f.i, f.dirW + k, 3) * larg, N.hash(f.i + k, f.dirW, 4) * alto, 9, 5, 0, 0, Math.PI * 2)
        g.fill()
      }
      const chao = c.chao
      // andares visíveis
      for (let z = chao; z < c.h; z++) {
        const base = (f.zTop - z) * LH
        if (base < 0 || base - LH > alto) continue
        const centro = larg / 2
        if (larg < 20) continue
        if (z === chao) {
          const temPorta = m.portas.some((p) => p.x === f.cx && p.y === f.cy && p.dir === f.dirW)
          if (temPorta) porta(g, centro, base, false)
          else if (N.hash(f.cx * 3 + f.dirW, f.cy, 5) < 0.4) janela(g, centro, base - 7, 7, 9, noite)
          g.fillStyle = rgba(escurecer(C.parede, 0.5), 0.18)
          g.fillRect(0, base - 3, larg, 3)
        } else if (N.hash(f.cx + z * 7, f.cy * 3 + f.dirW, 6) < 0.62) {
          janela(g, centro, base - 6, 8, 11, noite)
        }
      }
      if (f.zTop >= c.h - 1e-6 && alto > 10) faixaZigueZague(g, larg, 3, C.faixa)
      return
    }
    if (mat === 'ruina') {
      g.fillStyle = C.ruina
      g.fillRect(0, 0, larg, alto)
      // blocos grandes em fiadas, com juntas macias
      for (let y = 0, r = 0; y < alto; y += 12, r++) {
        const desloc = (r % 2) * 9
        for (let x = -desloc; x < larg; x += 18) {
          const h = N.hash(Math.floor((xm + x) / 18), Math.floor((f.zTop * LH - y) / 12), 7)
          g.fillStyle = h > 0.5 ? clarear(C.ruina, (h - 0.5) * 0.3) : escurecer(C.ruina, (0.5 - h) * 0.25)
          g.fillRect(x + 1, y + 1, 16, 10)
          g.fillStyle = rgba('#fffaf0', 0.16)
          g.fillRect(x + 1, y + 1, 16, 2)
        }
      }
      const temArco = m.portas.some((p) => p.x === f.cx && p.y === f.cy && p.dir === f.dirW)
      if (temArco && larg > 20) {
        g.fillStyle = misturar(C.ruina, '#2e2a3e', 0.55)
        arco(g, larg / 2, alto, 18, Math.min(alto - 2, 22))
        g.fill()
        g.strokeStyle = clarear(C.ruina, 0.25)
        g.lineWidth = 2
        arco(g, larg / 2, alto, 21, Math.min(alto, 24))
        g.stroke()
      }
      g.fillStyle = rgba(C.musgo, 0.85)
      for (let k = 0; k < 3; k++) {
        if (N.hash(f.cx + k, f.cy, f.dirW + 9) < 0.45) continue
        g.beginPath()
        g.ellipse(N.hash(f.cx, f.cy + k, 11) * larg, 2 + N.hash(f.cy, f.cx + k, 12) * 6, 6, 3.5, 0, 0, Math.PI * 2)
        g.fill()
      }
      return
    }
    if (mat === 'rocha' || mat === 'arenito') {
      const base = mat === 'rocha' ? C.rocha : C.arenito
      estratos(g, larg, alto, f.zTop, [base, clarear(base, 0.16), escurecer(base, 0.12), clarear(base, 0.07)], mat === 'rocha' ? 21 : 23, xm)
      if (mat === 'rocha') {
        g.strokeStyle = rgba(contorno(base), 0.45)
        g.lineWidth = 1
        for (let k = 0; k < 2; k++) {
          if (N.hash(f.cx + k, f.cy, f.dirW + 31) < 0.5) continue
          let x = N.hash(f.cx, f.cy + k, 32) * larg
          let y = 4 + N.hash(f.cy + k, f.cx, 33) * Math.max(4, alto - 16)
          g.beginPath()
          g.moveTo(x, y)
          for (let s = 0; s < 3; s++) { x += (N.hash(k, s, f.i) - 0.5) * 6; y += 4; g.lineTo(x, y) }
          g.stroke()
        }
      } else {
        for (let k = 0; k < 4; k++) {
          g.fillStyle = rgba(escurecer(base, 0.35), 0.5)
          g.beginPath()
          g.arc(N.hash(f.i, k, 41) * larg, N.hash(k, f.i, 42) * alto, 1.2, 0, Math.PI * 2)
          g.fill()
        }
      }
      if ((c.topo === 'grama' || c.topo === 'musgo') && f.zTop >= c.h - 1e-6) {
        const verde = c.topo === 'grama' ? C.grama : C.musgo
        g.fillStyle = verde
        g.beginPath()
        g.moveTo(-1, -1)
        for (let x = -1; x <= larg + 1; x += 3) {
          const p = 2.5 + N.ruido((xm + x) * 0.25, f.cy, 5) * 4 + (N.hash(Math.floor(xm + x), f.cy, 6) > 0.86 ? 4 : 0)
          g.lineTo(x, p)
        }
        g.lineTo(larg + 1, -1)
        g.closePath()
        g.fill()
      }
      return
    }
    if (mat === 'muro' || mat === 'degrau') {
      const base = mat === 'degrau' ? escurecer(C.laje, 0.08) : misturar(C.calcada, C.arenito, 0.3)
      g.fillStyle = escurecer(base, 0.22)
      g.fillRect(0, 0, larg, alto)
      const fiada = 8
      for (let y = 0, r = 0; y < alto; y += fiada, r++) {
        const zLinha = Math.round((f.zTop * LH - y) / fiada)
        let x = -((zLinha * 7) % 13) - 4
        while (x < larg) {
          const w = 12 + N.hash(Math.floor((xm + x) / 4), zLinha, 9) * 9
          const h = N.hash(Math.floor(xm + x), zLinha, 10)
          g.fillStyle = h > 0.5 ? clarear(base, (h - 0.5) * 0.24) : escurecer(base, (0.5 - h) * 0.16)
          g.beginPath()
          g.roundRect(x + 0.8, y + 0.8, w - 1.6, fiada - 1.6, 1.5)
          g.fill()
          g.fillStyle = rgba('#fffaf0', 0.2)
          g.fillRect(x + 1.5, y + 1, w - 3, 1.2)
          x += w
        }
      }
      if (mat === 'muro' && f.zTop >= c.h - 1e-6) {
        g.fillStyle = clarear(base, 0.25)
        g.fillRect(0, 0, larg, 3)
      }
      return
    }
    if (mat === 'agua') {
      const grad = g.createLinearGradient(0, 0, 0, alto)
      grad.addColorStop(0, C.aguaRasa)
      grad.addColorStop(0.2, C.agua)
      grad.addColorStop(1, escurecer(C.agua, 0.35))
      g.fillStyle = grad
      g.fillRect(0, 0, larg, alto)
      g.fillStyle = rgba(C.espuma, 0.6)
      g.fillRect(0, 0, larg, 1.5)
      return
    }
    g.fillStyle = C.terra
    g.fillRect(0, 0, larg, alto)
  }

  // ---------- a camada estática (colunas na ordem de pintura) ----------
  /** Altura do que fica imediatamente na frente de uma face (o que esconde o pé dela). */
  function alturaNaFrente(m, P, i, b, dr) {
    const caixasDaColuna = P.caixas[i]
    const ib = caixasDaColuna.indexOf(b)
    // dentro da mesma escada: a caixa seguinte nessa direção
    for (const o of caixasDaColuna) {
      if (o === b) continue
      if (dr === 0 && Math.abs(o.u0 - b.u1) < 1e-9 && o.v0 === b.v0) return o.z
      if (dr === 1 && Math.abs(o.v0 - b.v1) < 1e-9 && o.u0 === b.u0) return o.z
    }
    void ib
    const u = P.uv[i * 2] + (dr === 0 ? 1 : 0)
    const v = P.uv[i * 2 + 1] + (dr === 1 ? 1 : 0)
    if (u >= P.met.Wr || v >= P.met.Hr) return FUNDO
    const j = P.naCelula[v * P.met.Wr + u]
    let z = Infinity
    for (const o of P.caixas[j]) z = Math.min(z, o.z)
    return Math.max(FUNDO, z)
  }
  /** Dados de uma face visível (dr 0 = +u, 1 = +v) da caixa b da coluna i. */
  function dadosDaFace(m, P, i, b, dr) {
    const rot = P.met.rot
    const zLow = alturaNaFrente(m, P, i, b, dr)
    if (zLow >= b.z - 1e-6) return null
    const x = i % m.W
    const y = (i / m.W) | 0
    const dirW = (dr - rot + 4) & 3
    // pontas da face no espaço girado (esquerda e direita como se vê de fora)
    const esq = dr === 0 ? [b.u1, b.v1] : [b.u0, b.v1]
    const dir = dr === 0 ? [b.u1, b.v0] : [b.u1, b.v1]
    const [ex0, ey0] = N.desgirarP(esq[0], esq[1], rot, m.W, m.H)
    const [ex1, ey1] = N.desgirarP(dir[0], dir[1], rot, m.W, m.H)
    const comp = Math.hypot(ex1 - ex0, ey1 - ey0)
    // posição da ponta esquerda ao longo da borda do bloco, para a textura não depender do giro
    const ux = (ex1 - ex0) / (comp || 1)
    const uy = (ey1 - ey0) / (comp || 1)
    const xm = ux ? ex0 : ey0
    const riser = b.k >= 0 && ((dr === 0 && b.u1 < P.uv[i * 2] + 1 - 1e-9) || (dr === 1 && b.v1 < P.uv[i * 2 + 1] + 1 - 1e-9))
    return { i, cx: x, cy: y, dirW, dr, b, zTop: b.z, zLow, esq, dir, larg: comp * 32, ex0, ey0, ux, uy, a0: 0, a1: comp, xm: ux > 0 || uy > 0 ? xm : -xm, riser }
  }

  /** Desenha as colunas da posição k0 à k1 da ordem de pintura numa camada (canvas na escala s). */
  function pintarColunas(ctx, m, rot, periodo, s, k0, k1, opts = {}) {
    const P = N.preparo(m, rot)
    const atlas = atlasAceso(m, periodo)
    const met = P.met
    for (let k = k0; k < k1; k++) {
      const i = P.ordem[k]
      const c = m.c[i]
      const x = i % m.W
      const y = (i / m.W) | 0
      for (const b of P.caixas[i]) {
        // topo: o pedaço do atlas desse bloco (ou da pisada da escada), levado ao losango pela transformação afim
        let fx0 = 0
        let fx1 = 1
        let fy0 = 0
        let fy1 = 1
        if (b.k >= 0) {
          if (c.escada === 0) { fx0 = b.s0; fx1 = b.s1 }
          else if (c.escada === 1) { fy0 = b.s0; fy1 = b.s1 }
          else if (c.escada === 2) { fx0 = 1 - b.s1; fx1 = 1 - b.s0 }
          else { fy0 = 1 - b.s1; fy1 = 1 - b.s0 }
        }
        const p = (fx, fy) => N.pontoDoMundo(m, rot, x + fx, y + fy, b.z)
        const o = p(fx0, fy0)
        const pa = p(fx1, fy0)
        const pb = p(fx0, fy1)
        const wT = (fx1 - fx0) * T
        const hT = (fy1 - fy0) * T
        const e = 0.6
        ctx.setTransform(s * (pa[0] - o[0]) / wT, s * (pa[1] - o[1]) / wT, s * (pb[0] - o[0]) / hT, s * (pb[1] - o[1]) / hT, s * o[0], s * o[1])
        ctx.drawImage(atlas, x * T + fx0 * T - e, y * T + fy0 * T - e, wT + 2 * e, hT + 2 * e, -e, -e, wT + 2 * e, hT + 2 * e)
        // faces da frente
        for (const dr of [0, 1]) {
          const f = dadosDaFace(m, P, i, b, dr)
          if (!f) continue
          desenharFace(ctx, m, met, f, periodo, s)
        }
        contornarCaixa(ctx, m, P, i, b, s)
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    void opts
  }
  function desenharFace(ctx, m, met, f, periodo, s) {
    const [lx, ly] = N.proj(met, f.esq[0], f.esq[1], f.zTop)
    const ay = f.dr === 0 ? -0.5 : 0.5
    const alto = (f.zTop - f.zLow) * LH
    ctx.setTransform(s, s * ay, 0, s, s * lx, s * ly)
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, f.larg, alto)
    ctx.clip()
    pintarFace(ctx, m, f, periodo)
    // luz: grade pequena multiplicada por cima (sombra do relevo, sol de frente ou de costas, lampiões)
    const L = luzDaFace(m, periodo, f)
    const gc = grade(L.nx, L.ny)
    const gg = gc.getContext('2d')
    gg.putImageData(L.mul, 0, 0)
    ctx.imageSmoothingEnabled = true
    ctx.globalCompositeOperation = 'multiply'
    const sx = f.larg / (L.nx - 1)
    const sy = alto / (L.ny - 1)
    ctx.drawImage(gc, 0, 0, L.nx, L.ny, -sx / 2, -sy / 2, f.larg + sx, alto + sy)
    if (L.glow) {
      gg.putImageData(L.glow, 0, 0)
      ctx.globalCompositeOperation = 'lighter'
      ctx.drawImage(gc, 0, 0, L.nx, L.ny, -sx / 2, -sy / 2, f.larg + sx, alto + sy)
    }
    ctx.globalCompositeOperation = 'source-over'
    // janelas acesas à noite brilham por cima da luz
    if (periodo === 'noite' && m.c[f.i].lado === 'parede' && !f.riser) {
      const c = m.c[f.i]
      for (let z = c.chao; z < c.h; z++) {
        const base = (f.zTop - z) * LH
        if (base < 0 || base - LH > alto || f.larg < 20) continue
        const temPorta = z === c.chao && m.portas.some((p) => p.x === f.cx && p.y === f.cy && p.dir === f.dirW)
        const acesa = z === c.chao ? !temPorta && N.hash(f.cx * 3 + f.dirW, f.cy, 5) < 0.4 : N.hash(f.cx + z * 7, f.cy * 3 + f.dirW, 6) < 0.62
        if (!acesa) continue
        const by = z === c.chao ? base - 7 : base - 6
        const h = z === c.chao ? 9 : 11
        const w = z === c.chao ? 7 : 8
        ctx.fillStyle = rgba(C.chama, 0.85)
        arco(ctx, f.larg / 2, by, w, h)
        ctx.fill()
        ctx.fillStyle = rgba(C.brasa, 0.35)
        ctx.fillRect(f.larg / 2 - w / 2, by - 3, w, 3)
      }
    }
    ctx.restore()
  }
  /** Contorno fino no tom escuro da própria cor, só nas arestas que são silhueta, e um filete de luz na quina do topo. */
  function contornarCaixa(ctx, m, P, i, b, s) {
    const met = P.met
    const c = m.c[i]
    const corTopo = c.agua ? C.agua : c.topo === 'grama' ? C.grama : c.topo === 'calcada' ? C.calcada : c.topo === 'telhado' ? C.telhado : c.lado === 'rocha' ? C.rocha : C.parede
    const corLado = c.agua ? C.agua : c.lado === 'rocha' ? C.rocha : c.lado === 'ruina' ? C.ruina : c.lado === 'arenito' ? C.arenito : C.parede
    ctx.setTransform(s, 0, 0, s, 0, 0)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const q = (u, v, z) => N.proj(met, u, v, z)
    const u = P.uv[i * 2]
    const v = P.uv[i * 2 + 1]
    const alturaEm = (du, dv) => {
      const uu = u + du
      const vv = v + dv
      if (uu < 0 || vv < 0 || uu >= met.Wr || vv >= met.Hr) return FUNDO
      let z = -Infinity
      for (const o of P.caixas[P.naCelula[vv * met.Wr + uu]]) z = Math.max(z, o.z)
      return z
    }
    const fU = dadosDaFace(m, P, i, b, 0)
    const fV = dadosDaFace(m, P, i, b, 1)
    ctx.lineWidth = 1.1
    // filete de luz na quina da frente do topo
    if (!c.agua) {
      ctx.strokeStyle = rgba('#fffaf0', 0.42)
      ctx.beginPath()
      if (fU) { const a = q(b.u1, b.v0, b.z); const d = q(b.u1, b.v1, b.z); ctx.moveTo(a[0] - 0.5, a[1] + 0.6); ctx.lineTo(d[0] - 0.5, d[1] + 0.6) }
      if (fV) { const a = q(b.u0, b.v1, b.z); const d = q(b.u1, b.v1, b.z); ctx.moveTo(a[0] + 0.5, a[1] + 0.6); ctx.lineTo(d[0] + 0.5, d[1] + 0.6) }
      ctx.stroke()
    }
    ctx.strokeStyle = rgba(contorno(corLado), 0.75)
    ctx.beginPath()
    // arestas de cima de cada face visível
    if (fU) { const a = q(b.u1, b.v0, b.z); const d = q(b.u1, b.v1, b.z); ctx.moveTo(...a); ctx.lineTo(...d) }
    if (fV) { const a = q(b.u0, b.v1, b.z); const d = q(b.u1, b.v1, b.z); ctx.moveTo(...a); ctx.lineTo(...d) }
    // quina vertical da frente
    if (fU && fV) { const z0 = Math.max(fU.zLow, fV.zLow); const a = q(b.u1, b.v1, b.z); const d = q(b.u1, b.v1, z0); ctx.moveTo(...a); ctx.lineTo(...d) }
    // pontas laterais quando o vizinho do lado é mais baixo
    if (fV && b.u0 === u && alturaEm(-1, 0) < b.z - 0.01) { const a = q(b.u0, b.v1, b.z); const d = q(b.u0, b.v1, fV.zLow); ctx.moveTo(...a); ctx.lineTo(...d) }
    if (fU && b.v0 === v && alturaEm(0, -1) < b.z - 0.01) { const a = q(b.u1, b.v0, b.z); const d = q(b.u1, b.v0, fU.zLow); ctx.moveTo(...a); ctx.lineTo(...d) }
    ctx.stroke()
    // arestas de trás do topo quando o vizinho de trás é mais baixo
    ctx.strokeStyle = rgba(contorno(corTopo), 0.6)
    ctx.beginPath()
    if (b.u0 === u && alturaEm(-1, 0) < b.z - 0.01) { const a = q(b.u0, b.v0, b.z); const d = q(b.u0, b.v1, b.z); ctx.moveTo(...a); ctx.lineTo(...d) }
    if (b.v0 === v && alturaEm(0, -1) < b.z - 0.01) { const a = q(b.u0, b.v0, b.z); const d = q(b.u1, b.v0, b.z); ctx.moveTo(...a); ctx.lineTo(...d) }
    ctx.stroke()
  }

  /** Grade do modo batalha: o contorno de cada topo, apagado onde uma coluna da frente cobre (mesma ordem de pintura). */
  function pintarGrade(ctx, m, rot, periodo, s) {
    const P = N.preparo(m, rot)
    ctx.setTransform(s, 0, 0, s, 0, 0)
    ctx.lineWidth = 1
    ctx.lineJoin = 'round'
    for (const i of P.ordem) {
      apagarSilhueta(ctx, P, i)
      const c = m.c[i]
      if (c.agua) continue
      ctx.strokeStyle = PERIODOS[periodo].grade
      ctx.beginPath()
      for (const b of P.caixas[i]) {
        const pts = [[b.u0, b.v0], [b.u1, b.v0], [b.u1, b.v1], [b.u0, b.v1]].map(([u, v]) => N.proj(P.met, u, v, b.z))
        ctx.moveTo(...pts[0])
        for (let k = 1; k < 4; k++) ctx.lineTo(...pts[k])
        ctx.closePath()
      }
      ctx.stroke()
    }
  }
  function apagarSilhueta(ctx, P, i) {
    ctx.globalCompositeOperation = 'destination-out'
    ctx.fillStyle = '#000'
    ctx.beginPath()
    for (const h of P.hex[i]) {
      ctx.moveTo(...h[0])
      for (let k = 1; k < 6; k++) ctx.lineTo(...h[k])
      ctx.closePath()
    }
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
  }
  function losango(ctx, P, b, recuo) {
    const pts = [[b.u0 + recuo, b.v0 + recuo], [b.u1 - recuo, b.v0 + recuo], [b.u1 - recuo, b.v1 - recuo], [b.u0 + recuo, b.v1 - recuo]].map(([u, v]) => N.proj(P.met, u, v, b.z))
    ctx.beginPath()
    ctx.moveTo(...pts[0])
    for (let k = 1; k < 4; k++) ctx.lineTo(...pts[k])
    ctx.closePath()
  }
  const ESTILOS = {
    alcance: { fundo: 'rgba(62,118,226,0.62)', miolo: 'rgba(150,196,255,0.4)', borda: 'rgba(255,255,255,0.92)' },
    caminho: { fundo: 'rgba(94,160,255,0.8)', miolo: 'rgba(214,234,255,0.66)', borda: 'rgba(255,255,255,1)' },
    area: { fundo: 'rgba(230,140,62,0.5)', miolo: 'rgba(255,214,150,0.36)', borda: 'rgba(255,246,226,0.9)' },
    alvo: { fundo: 'rgba(208,82,70,0.5)', miolo: 'rgba(255,170,150,0.34)', borda: 'rgba(255,236,230,0.92)' },
    rastro: { fundo: 'rgba(240,206,98,0.42)', miolo: 'rgba(255,240,190,0.32)', borda: 'rgba(255,248,224,0.8)' },
    cursor: { fundo: 'rgba(255,255,255,0.16)', miolo: null, borda: 'rgba(255,255,255,1)' },
    origem: { fundo: 'rgba(255,255,255,0.3)', miolo: null, borda: 'rgba(255,255,255,1)' },
  }
  /** Camada de marcação (alcance, caminho, área, cursor): quadrados nos topos, escondidos pelo que fica na frente. */
  function pintarMarcas(ctx, m, rot, s, marcas) {
    const P = N.preparo(m, rot)
    ctx.setTransform(s, 0, 0, s, 0, 0)
    for (const i of P.ordem) {
      apagarSilhueta(ctx, P, i)
      const lista = marcas.get(i)
      if (!lista) continue
      for (const tipo of lista) {
        const e = ESTILOS[tipo]
        for (const b of P.caixas[i]) {
          losango(ctx, P, b, 0.06)
          ctx.fillStyle = e.fundo
          ctx.fill()
          if (e.miolo) {
            losango(ctx, P, b, 0.26)
            ctx.fillStyle = e.miolo
            ctx.fill()
          }
        }
        ctx.strokeStyle = e.borda
        ctx.lineWidth = tipo === 'cursor' ? 2 : 1.5
        for (const b of P.caixas[i]) {
          losango(ctx, P, b, 0.06)
          ctx.stroke()
        }
      }
    }
  }
  /** Máscara da água visível (branco onde a água aparece), para o brilho animado não vazar para a terra. */
  function pintarMascaraDaAgua(ctx, m, rot, s) {
    const P = N.preparo(m, rot)
    ctx.setTransform(s, 0, 0, s, 0, 0)
    for (const i of P.ordem) {
      apagarSilhueta(ctx, P, i)
      if (!m.c[i].agua) continue
      ctx.fillStyle = '#fff'
      for (const b of P.caixas[i]) {
        losango(ctx, P, b, 0)
        ctx.fill()
      }
    }
  }

  // ---------- objetos (sprites desenhados por código) ----------
  function traco(g, cor, w = 1.2) {
    g.strokeStyle = contorno(cor)
    g.lineWidth = w
    g.lineJoin = 'round'
    g.lineCap = 'round'
  }
  function forma(g, cor, desenhar, w = 1.2) {
    g.beginPath()
    desenhar()
    g.fillStyle = cor
    g.fill()
    traco(g, cor, w)
    g.stroke()
  }
  function elipse(g, x, y, rx, ry, cor, w) {
    forma(g, cor, () => g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2), w)
  }
  function brilhoLado(g, desenhar, cor, lado = -1, alfa = 0.3) {
    g.save()
    g.beginPath()
    desenhar()
    g.clip()
    g.fillStyle = lado < 0 ? rgba('#fffaf0', alfa) : rgba(escurecer(cor, 0.6), alfa)
    g.fillRect(lado < 0 ? -200 : 0, -400, 200, 800)
    g.restore()
  }
  function caixaIso(g, cx, cy, w, d, h, cor) {
    // caixinha isométrica com centro do chão em (cx, cy): w ao longo de u, d ao longo de v (em px de meia largura)
    const top = [[cx, cy - h - (w + d) / 2], [cx + w, cy - h - (d - w) / 2 - w / 2 + w / 2 - d / 2 + d / 2], [cx + w - d, cy - h + (w + d) / 2 - d], [cx - d, cy - h]]
    void top
    const A = [cx - d, cy - d / 2]
    const B = [cx + w - d, cy + (w + d) / 2 - d]
    const Cc = [cx + w, cy + w / 2 - d / 2 + d / 2 - w / 2 + w / 2 - d / 2]
    void Cc
    const p = (u, v, z) => [cx + (u - v), cy + (u + v) / 2 - z]
    const t0 = p(-w / 2, -d / 2, h)
    const t1 = p(w / 2, -d / 2, h)
    const t2 = p(w / 2, d / 2, h)
    const t3 = p(-w / 2, d / 2, h)
    const b1 = p(w / 2, -d / 2, 0)
    const b2 = p(w / 2, d / 2, 0)
    const b3 = p(-w / 2, d / 2, 0)
    void A; void B
    forma(g, escurecer(cor, 0.12), () => { g.moveTo(...t3); g.lineTo(...t2); g.lineTo(...b2); g.lineTo(...b3); g.closePath() })
    forma(g, escurecer(cor, 0.24), () => { g.moveTo(...t2); g.lineTo(...t1); g.lineTo(...b1); g.lineTo(...b2); g.closePath() })
    forma(g, clarear(cor, 0.12), () => { g.moveTo(...t0); g.lineTo(...t1); g.lineTo(...t2); g.lineTo(...t3); g.closePath() })
  }

  function folhaDePalmeira(g, x0, y0, ang, comp, cair, cor) {
    const ex = x0 + Math.cos(ang) * comp
    const ey = y0 + Math.sin(ang) * comp * 0.55 + cair
    const mx = x0 + Math.cos(ang) * comp * 0.5
    const my = y0 + Math.sin(ang) * comp * 0.3 - 6
    const nx = -Math.sin(ang)
    const ny = Math.cos(ang) * 0.55
    const larg = 6.5
    g.beginPath()
    g.moveTo(x0, y0)
    // borda serrilhada: folíolos sugeridos por dentes largos, não por riscos
    const pts = 7
    for (let k = 1; k <= pts; k++) {
      const t = k / pts
      const bx = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * mx + t * t * ex
      const by = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * my + t * t * ey
      const w = larg * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (k % 2 ? 1.25 : 0.8)
      g.lineTo(bx + nx * w, by + ny * w - 1)
    }
    for (let k = pts; k >= 1; k--) {
      const t = k / pts
      const bx = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * mx + t * t * ex
      const by = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * my + t * t * ey
      const w = larg * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (k % 2 ? 0.8 : 1.25)
      g.lineTo(bx - nx * w, by - ny * w + 1.5)
    }
    g.closePath()
    g.fillStyle = cor
    g.fill()
    traco(g, cor, 1.1)
    g.stroke()
    g.strokeStyle = rgba(clarear(cor, 0.4), 0.7)
    g.lineWidth = 1
    g.beginPath()
    g.moveTo(x0, y0)
    g.quadraticCurveTo(mx, my, ex, ey)
    g.stroke()
  }
  const DESENHOS = {
    palmeira(g, p) {
      const v = p.variante || 0
      const inclina = [5, -7, 9][v % 3]
      const alto = [86, 80, 92][v % 3]
      // tronco curvo, afinando, com anéis largos
      const topo = [inclina, -alto]
      g.save()
      const seg = 9
      for (let k = 0; k < seg; k++) {
        const t0 = k / seg
        const t1 = (k + 1) / seg
        const x0 = inclina * t0 * t0
        const x1 = inclina * t1 * t1
        const y0 = -alto * t0
        const y1 = -alto * t1
        const w0 = 6 - t0 * 2.4
        const w1 = 6 - t1 * 2.4
        const cor = k % 2 ? C.tronco : escurecer(C.tronco, 0.1)
        forma(g, cor, () => { g.moveTo(x0 - w0, y0); g.lineTo(x1 - w1 - 0.6, y1); g.lineTo(x1 + w1 + 0.6, y1); g.lineTo(x0 + w0, y0); g.closePath() }, 1)
        g.fillStyle = rgba('#fffaf0', 0.18)
        g.fillRect(x0 - w0 + 1, y1, 2, y0 - y1)
      }
      g.restore()
      return { copa: topo }
    },
    copa(g, p) {
      const v = p.variante || 0
      const n = 8
      const atras = []
      const frente = []
      for (let k = 0; k < n; k++) {
        const ang = (k / n) * Math.PI * 2 + v * 0.4
        ;(Math.sin(ang) < 0 ? atras : frente).push(ang)
      }
      for (const ang of atras) folhaDePalmeira(g, 0, 0, ang, 40, 16, escurecer(C.folha, 0.12))
      elipse(g, -3, 4, 3.4, 3.4, C.tronco, 1)
      elipse(g, 3, 5, 3.2, 3.2, escurecer(C.tronco, 0.1), 1)
      for (const ang of frente) folhaDePalmeira(g, 0, 0, ang, 42, 18, k2(ang))
      function k2(a) { return Math.cos(a) < 0 ? C.folhaClara : C.folha }
      folhaDePalmeira(g, 0, -1, -Math.PI / 2 + 0.3, 24, 4, C.folhaClara)
    },
    vasos(g, p) {
      const lista = p.variante ? [[-9, 0, 1], [8, 3, 0.85]] : [[-11, -1, 0.85], [2, -4, 1.05], [11, 4, 0.75]]
      lista.sort((a, b) => a[1] - b[1])
      for (const [x, y, k] of lista) {
        const h = 30 * k
        const w = 9 * k
        const cor = C.vaso
        const corpo = () => {
          g.moveTo(x - w * 0.42, y - h)
          g.bezierCurveTo(x - w * 0.42, y - h * 0.82, x - w * 1.1, y - h * 0.7, x - w, y - h * 0.38)
          g.bezierCurveTo(x - w * 0.9, y - h * 0.08, x - w * 0.5, y, x, y)
          g.bezierCurveTo(x + w * 0.5, y, x + w * 0.9, y - h * 0.08, x + w, y - h * 0.38)
          g.bezierCurveTo(x + w * 1.1, y - h * 0.7, x + w * 0.42, y - h * 0.82, x + w * 0.42, y - h)
          g.closePath()
        }
        forma(g, cor, corpo)
        brilhoLado(g, corpo, cor, -1, 0.0)
        g.save()
        g.beginPath()
        corpo()
        g.clip()
        g.fillStyle = rgba(escurecer(cor, 0.6), 0.22)
        g.fillRect(x + w * 0.2, y - h - 2, w * 1.2, h + 4)
        g.fillStyle = rgba('#fffaf0', 0.35)
        g.beginPath()
        g.ellipse(x - w * 0.45, y - h * 0.45, w * 0.18, h * 0.2, 0, 0, Math.PI * 2)
        g.fill()
        g.fillStyle = rgba(escurecer(cor, 0.35), 0.5)
        g.fillRect(x - w, y - h * 0.55, w * 2, 1.4)
        g.restore()
        elipse(g, x, y - h, w * 0.5, w * 0.2, clarear(cor, 0.15), 1)
      }
    },
    barril(g) {
      for (const [x, y, k] of [[-7, -2, 1], [9, 3, 0.8]]) {
        const w = 10 * k
        const h = 26 * k
        const corpo = () => { g.moveTo(x - w, y - h); g.bezierCurveTo(x - w * 1.18, y - h * 0.6, x - w * 1.18, y - h * 0.4, x - w, y); g.lineTo(x + w, y); g.bezierCurveTo(x + w * 1.18, y - h * 0.4, x + w * 1.18, y - h * 0.6, x + w, y - h); g.closePath() }
        forma(g, C.madeira, corpo)
        g.save()
        g.beginPath()
        corpo()
        g.clip()
        g.fillStyle = rgba(escurecer(C.madeira, 0.6), 0.25)
        g.fillRect(x + w * 0.3, y - h, w, h)
        g.fillStyle = C.ferro
        g.fillRect(x - w * 1.2, y - h * 0.82, w * 2.4, 2)
        g.fillRect(x - w * 1.2, y - h * 0.22, w * 2.4, 2)
        g.restore()
        elipse(g, x, y - h, w, w * 0.42, clarear(C.madeira, 0.18), 1)
      }
    },
    caixas(g) {
      caixaIso(g, -4, 2, 20, 16, 15, C.madeira)
      caixaIso(g, 6, -2, 14, 12, 12, clarear(C.madeira, 0.1))
    },
    banco(g, p) {
      const ao = p.eixo === 'u'
      const w = ao ? 26 : 10
      const d = ao ? 10 : 26
      caixaIso(g, ao ? -8 : 0, ao ? -2 : 0, 6, 8, 8, misturar(C.calcada, C.arenito, 0.4))
      caixaIso(g, ao ? 8 : 0, ao ? 6 : 0, 6, 8, 8, misturar(C.calcada, C.arenito, 0.4))
      caixaIso(g, 0, 2, w, d, 12, C.laje)
    },
    toldo(g, p) {
      caixaIso(g, 0, 4, 22, 22, 14, C.madeira)
      const frutas = [C.chama, C.tecido, C.folhaClara, C.brasa]
      for (let k = 0; k < 6; k++) elipse(g, -8 + (k % 3) * 7 + (k > 2 ? 3 : 0), -12 + (k > 2 ? 4 : 0), 3, 2.6, frutas[(k + (p.variante || 0)) % 4], 1)
      for (const x of [-21, 21]) forma(g, C.madeiraEscura, () => g.rect(x - 1.5, -50, 3, 46))
      // cobertura em pirâmide baixa, listrada
      const topo = [0, -64]
      const cantos = [[-30, -44], [0, -30], [30, -44]]
      const cores = [C.tecido, C.linho]
      for (let s = 0; s < 2; s++) {
        const a = cantos[s]
        const b = cantos[s + 1]
        const n = 4
        for (let k = 0; k < n; k++) {
          const p0 = [a[0] + (b[0] - a[0]) * (k / n), a[1] + (b[1] - a[1]) * (k / n)]
          const p1 = [a[0] + (b[0] - a[0]) * ((k + 1) / n), a[1] + (b[1] - a[1]) * ((k + 1) / n)]
          const cor = cores[k % 2]
          forma(g, s ? escurecer(cor, 0.12) : cor, () => { g.moveTo(...topo); g.lineTo(...p0); g.lineTo(...p1); g.closePath() }, 1)
        }
      }
      g.fillStyle = C.tecido
      for (let k = 0; k < 8; k++) {
        const t = k / 8
        const x = -30 + 60 * t
        const y = t < 0.5 ? -44 + 28 * t : -30 - 28 * (t - 0.5)
        g.beginPath()
        g.arc(x + 3.75, y + 1, 3.6, 0, Math.PI)
        g.fill()
      }
    },
    poco(g) {
      // anel de pedra
      const borda = misturar(C.pedra, C.calcada, 0.4)
      forma(g, escurecer(borda, 0.15), () => { g.ellipse(0, -2, 22, 11, 0, 0, Math.PI); g.lineTo(-22, -16); g.ellipse(0, -16, 22, 11, 0, Math.PI, 0, true); g.closePath() })
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI
        g.strokeStyle = rgba(contorno(borda), 0.5)
        g.lineWidth = 1
        g.beginPath()
        g.moveTo(Math.cos(a) * 22, -16 + Math.sin(a) * 11)
        g.lineTo(Math.cos(a) * 22, -2 + Math.sin(a) * 11)
        g.stroke()
      }
      elipse(g, 0, -16, 22, 11, clarear(borda, 0.15), 1.2)
      elipse(g, 0, -16, 16, 7.5, misturar(C.agua, '#2e2a3e', 0.45), 1)
      // armação de madeira e telhadinho
      for (const x of [-18, 18]) forma(g, C.madeira, () => g.rect(x - 2, -52, 4, 38))
      forma(g, C.madeiraEscura, () => g.rect(-19, -46, 38, 3))
      forma(g, C.barro, () => { g.moveTo(-26, -50); g.lineTo(0, -64); g.lineTo(26, -50); g.lineTo(22, -47); g.lineTo(0, -59); g.lineTo(-22, -47); g.closePath() })
      g.strokeStyle = contorno(C.madeira)
      g.lineWidth = 1
      g.beginPath()
      g.moveTo(4, -44)
      g.lineTo(4, -30)
      g.stroke()
      caixaIso(g, 4, -24, 6, 6, 6, C.madeira)
    },
    lampiao(g) {
      forma(g, C.ferro, () => g.rect(-2, -66, 4, 66))
      forma(g, escurecer(C.ferro, 0.1), () => g.rect(-6, -4, 12, 4))
      forma(g, C.ferro, () => { g.moveTo(-8, -70); g.lineTo(0, -80); g.lineTo(8, -70); g.closePath() })
      forma(g, misturar(C.chama, C.linho, 0.5), () => g.rect(-6, -70, 12, 12))
      g.strokeStyle = contorno(C.ferro)
      g.lineWidth = 1
      g.beginPath()
      g.moveTo(0, -70)
      g.lineTo(0, -58)
      g.stroke()
    },
    tocha(g) {
      forma(g, misturar(C.pedra, C.ruina, 0.5), () => { g.moveTo(-6, 0); g.lineTo(-4, -26); g.lineTo(4, -26); g.lineTo(6, 0); g.closePath() })
      forma(g, C.ferro, () => { g.moveTo(-12, -34); g.lineTo(12, -34); g.lineTo(7, -25); g.lineTo(-7, -25); g.closePath() })
      elipse(g, 0, -34, 12, 4, escurecer(C.ferro, 0.2), 1)
      elipse(g, 0, -35, 8, 2.5, misturar(C.brasa, C.madeiraEscura, 0.5), 0.8)
    },
    coluna(g, p) {
      const alto = p.variante ? 46 : 62
      const cor = C.ruina
      forma(g, escurecer(cor, 0.1), () => g.rect(-15, -8, 30, 8))
      const corpo = () => { g.moveTo(-11, -8); g.lineTo(-11, -alto + 4); g.lineTo(-5, -alto); g.lineTo(1, -alto + 6); g.lineTo(6, -alto + 1); g.lineTo(11, -alto + 7); g.lineTo(11, -8); g.closePath() }
      forma(g, cor, corpo)
      g.save()
      g.beginPath()
      corpo()
      g.clip()
      for (const x of [-6, 0, 6]) { g.fillStyle = rgba(escurecer(cor, 0.5), 0.18); g.fillRect(x, -alto, 2.4, alto) }
      g.fillStyle = rgba(escurecer(cor, 0.6), 0.22)
      g.fillRect(4, -alto, 8, alto)
      g.fillStyle = rgba(C.musgo, 0.9)
      g.beginPath()
      g.ellipse(-6, -14, 7, 4, 0, 0, Math.PI * 2)
      g.fill()
      g.restore()
    },
    entulho(g, p) {
      const v = p.variante || 0
      caixaIso(g, -9, 2, 12, 10, 8, C.ruina)
      caixaIso(g, 8, 0, 10, 12, 6 + v * 3, escurecer(C.ruina, 0.06))
      caixaIso(g, 0, 8, 9, 8, 5, clarear(C.ruina, 0.08))
      elipse(g, -12, 8, 4, 2.4, C.musgo, 0.8)
    },
    arbusto(g, p) {
      const v = p.variante || 0
      const bolas = [[-10, -9, 10], [9, -10, 10], [0, -17, 12], [-2, -7, 11]]
      for (const [x, y, r] of bolas) elipse(g, x, y, r, r * 0.86, k(x), 1.1)
      function k(x) { return x < 0 ? C.folhaClara : C.folha }
      for (let q = 0; q < 4; q++) {
        g.fillStyle = v ? C.vaso : C.linho
        g.beginPath()
        g.arc(-10 + q * 6, -14 + (q % 2) * 6, 1.6, 0, Math.PI * 2)
        g.fill()
      }
    },
  }

  // ---------- unidades ----------
  /** Desenho de uma unidade: frente (olhando para baixo-esquerda) ou costas; quadro da passada; pés em (0, 0). */
  function desenharUnidade(g, tipo, frente, quadro) {
    if (tipo === 'lobo') return desenharLobo(g, frente, quadro)
    if (tipo === 'golem') return desenharGolem(g, frente, quadro)
    const E = ESTILO_DE[tipo]
    // passada: 0 parado, 1..4 andar (contato, passagem, contato, passagem), 5 agacha, 6 no ar
    const passo = quadro >= 1 && quadro <= 4 ? [0, 1, 0, -1][quadro - 1] : 0
    const ergue = quadro >= 1 && quadro <= 4 ? [0, 1, 0, 1][quadro - 1] : 0
    const agacha = quadro === 5 ? 3 : 0
    const ar = quadro === 6
    const quadril = -17 + agacha
    // pernas
    const pernas = [[-4.2, passo * 2.2], [4.2, -passo * 2.2]]
    for (const [x, d] of pernas) {
      const pe = ar ? -3 : -Math.max(0, d) * ergue * 1.2
      forma(g, E.calca, () => g.roundRect(x - 3, quadril, 6, -quadril + pe - 3, 2))
      forma(g, E.bota, () => g.roundRect(x - 3.6, pe - 5, 7.2, 5, 2.2))
    }
    // costas: capa ou cabelo comprido atrás
    if (!frente && E.capa) forma(g, E.capa, () => { g.moveTo(-9, -37); g.lineTo(9, -37); g.lineTo(11, -12 + agacha); g.lineTo(-11, -12 + agacha); g.closePath() })
    // tronco
    const tronco = () => { g.moveTo(-8, -36 + agacha); g.lineTo(8, -36 + agacha); g.lineTo(10.5, quadril + 3); g.lineTo(-10.5, quadril + 3); g.closePath() }
    forma(g, E.roupa, tronco)
    g.save()
    g.beginPath()
    tronco()
    g.clip()
    g.fillStyle = rgba(escurecer(E.roupa, 0.6), 0.22)
    g.fillRect(2, -40, 12, 30)
    if (E.detalhe) { g.fillStyle = E.detalhe; g.fillRect(-1.5, -36 + agacha, 3, 22) }
    g.restore()
    forma(g, E.cinto, () => g.rect(-9.5, quadril - 1, 19, 3.2), 1)
    // braços balançam ao contrário das pernas
    const braco = (lado, d) => {
      const x = lado * 10
      forma(g, E.roupa, () => g.roundRect(x - 2.6, -35 + agacha + d, 5.2, 13, 2.4))
      elipse(g, x, -21 + agacha + d, 2.6, 2.6, E.pele, 1)
    }
    braco(-1, -passo * 1.4 + (ar ? -3 : 0))
    braco(1, passo * 1.4 + (ar ? -3 : 0))
    // arma (atrás ou do lado)
    if (E.arma) E.arma(g, frente, agacha, passo)
    // cabeça
    const cy = -46 + agacha
    if (!frente && E.cabeloAtras) E.cabeloAtras(g, cy)
    elipse(g, 0, cy, 10.5, 10, E.pele, 1.2)
    if (frente) {
      // rosto virado para baixo-esquerda: olhos deslocados para a esquerda
      const olho = contorno(E.cabelo)
      g.fillStyle = olho
      g.beginPath()
      g.ellipse(-5.2, cy + 1.5, 1.3, 2, 0, 0, Math.PI * 2)
      g.ellipse(1.6, cy + 1.5, 1.3, 2, 0, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = rgba('#fffaf0', 0.9)
      g.fillRect(-5.6, cy + 0.4, 0.8, 0.8)
      g.fillRect(1.2, cy + 0.4, 0.8, 0.8)
      g.fillStyle = rgba(C.tecido, 0.28)
      g.beginPath()
      g.ellipse(-6.5, cy + 4.6, 2, 1.2, 0, 0, Math.PI * 2)
      g.ellipse(3.6, cy + 4.6, 2, 1.2, 0, 0, Math.PI * 2)
      g.fill()
    }
    E.cabeca(g, cy, frente)
  }
  const ESTILO_DE = {
    aventureira: {
      roupa: C.azul, calca: C.linho, bota: C.madeira, cinto: C.madeiraEscura, pele: C.pele, cabelo: C.loiro, detalhe: C.linho, capa: null,
      arma(g, frente) {
        const x = frente ? 11 : -11
        forma(g, C.aco, () => { g.moveTo(x - 1.4, -24); g.lineTo(x - 1.4, -48); g.lineTo(x, -51); g.lineTo(x + 1.4, -48); g.lineTo(x + 1.4, -24); g.closePath() }, 1)
        forma(g, C.latao, () => g.rect(x - 4, -24, 8, 2.4), 1)
      },
      cabeloAtras(g, cy) { forma(g, C.loiro, () => { g.moveTo(-3, cy); g.quadraticCurveTo(12, cy + 6, 4, cy + 20); g.quadraticCurveTo(-2, cy + 10, -3, cy) }) },
      cabeca(g, cy, frente) {
        forma(g, C.loiro, () => {
          g.moveTo(-11, cy + 2)
          g.quadraticCurveTo(-12, cy - 12, 0, cy - 12)
          g.quadraticCurveTo(12, cy - 12, 11, cy + 2)
          if (frente) { g.lineTo(8, cy - 3); g.lineTo(3, cy - 6); g.lineTo(-2, cy - 3); g.lineTo(-7, cy - 6); g.lineTo(-10, cy + 1) } else { g.lineTo(11, cy + 7); g.lineTo(-11, cy + 7) }
          g.closePath()
        })
        if (frente) forma(g, C.loiro, () => { g.moveTo(9, cy - 6); g.quadraticCurveTo(19, cy - 2, 14, cy + 12); g.quadraticCurveTo(12, cy + 2, 9, cy - 1); g.closePath() })
        forma(g, C.vermelho, () => g.rect(-10, cy - 8, 20, 2.6), 1)
      },
    },
    mago: {
      roupa: C.roxo, calca: escurecer(C.roxo, 0.2), bota: C.madeiraEscura, cinto: C.latao, pele: C.pele, cabelo: C.cabeloEscuro, detalhe: C.latao, capa: escurecer(C.roxo, 0.15),
      arma(g, frente) {
        const x = frente ? -13 : 13
        forma(g, C.madeira, () => g.rect(x - 1.3, -50, 2.6, 50), 1)
        elipse(g, x, -52, 3.6, 3.6, C.aguaRasa, 1)
      },
      cabeca(g, cy, frente) {
        forma(g, escurecer(C.roxo, 0.1), () => g.ellipse(0, cy - 6, 17, 5, 0, 0, Math.PI * 2))
        forma(g, C.roxo, () => { g.moveTo(-10, cy - 7); g.quadraticCurveTo(-4, cy - 20, 2, cy - 32); g.quadraticCurveTo(10, cy - 30, 14, cy - 26); g.quadraticCurveTo(8, cy - 22, 9, cy - 7); g.closePath() })
        forma(g, C.latao, () => g.rect(-9.5, cy - 10, 19, 3), 1)
        if (frente) {
          g.fillStyle = C.cabeloEscuro
          g.fillRect(-9, cy - 4, 18, 2.5)
          forma(g, C.linho, () => { g.moveTo(-5, cy + 6); g.quadraticCurveTo(-2, cy + 15, 1, cy + 6); g.closePath() }, 1)
        }
      },
    },
    arqueiro: {
      roupa: C.verde, calca: C.madeira, bota: C.madeiraEscura, cinto: C.madeiraEscura, pele: C.peleMorena, cabelo: C.castanho, detalhe: null, capa: escurecer(C.verde, 0.15),
      arma(g, frente) {
        const x = frente ? -12 : 10
        g.strokeStyle = contorno(C.madeira)
        g.lineWidth = 2.6
        g.beginPath()
        g.arc(x + 6, -32, 15, Math.PI * 0.62, Math.PI * 1.38)
        g.stroke()
        g.strokeStyle = C.madeira
        g.lineWidth = 1.5
        g.stroke()
        g.strokeStyle = rgba(C.linho, 0.8)
        g.lineWidth = 0.8
        g.beginPath()
        g.moveTo(x + 6 + Math.cos(Math.PI * 0.62) * 15, -32 + Math.sin(Math.PI * 0.62) * 15)
        g.lineTo(x + 6 + Math.cos(Math.PI * 1.38) * 15, -32 + Math.sin(Math.PI * 1.38) * 15)
        g.stroke()
        if (!frente) forma(g, C.madeira, () => g.rect(-6, -44, 5, 16), 1)
      },
      cabeca(g, cy, frente) {
        forma(g, C.verde, () => {
          g.moveTo(-12, cy + 4)
          g.quadraticCurveTo(-13, cy - 14, 0, cy - 14)
          g.quadraticCurveTo(13, cy - 14, 12, cy + 4)
          if (frente) { g.quadraticCurveTo(9, cy - 6, 0, cy - 6); g.quadraticCurveTo(-9, cy - 6, -12, cy + 4) } else g.quadraticCurveTo(0, cy + 10, -12, cy + 4)
          g.closePath()
        })
        if (frente) forma(g, C.castanho, () => { g.moveTo(-8, cy - 4); g.lineTo(8, cy - 4); g.lineTo(6, cy - 1); g.lineTo(-6, cy - 1); g.closePath() }, 1)
      },
    },
    curandeira: {
      roupa: C.linho, calca: C.linho, bota: C.madeira, cinto: C.tecido, pele: C.pele, cabelo: C.castanho, detalhe: C.tecido, capa: C.linho,
      arma(g, frente) {
        const x = frente ? 12 : -12
        forma(g, C.madeira, () => g.rect(x - 1.2, -50, 2.4, 50), 1)
        g.strokeStyle = contorno(C.latao)
        g.lineWidth = 2.6
        g.beginPath()
        g.arc(x, -54, 4.5, 0, Math.PI * 2)
        g.stroke()
        g.strokeStyle = C.latao
        g.lineWidth = 1.4
        g.stroke()
      },
      cabeca(g, cy, frente) {
        forma(g, C.linho, () => {
          g.moveTo(-13, cy + 8)
          g.quadraticCurveTo(-14, cy - 14, 0, cy - 15)
          g.quadraticCurveTo(14, cy - 14, 13, cy + 8)
          if (frente) { g.quadraticCurveTo(10, cy - 5, 0, cy - 7); g.quadraticCurveTo(-10, cy - 5, -13, cy + 8) } else g.quadraticCurveTo(0, cy + 12, -13, cy + 8)
          g.closePath()
        })
        forma(g, C.tecido, () => g.rect(-2, cy - 15, 4, 7), 0.8)
        forma(g, C.tecido, () => g.rect(-3.5, cy - 13, 7, 3), 0.8)
        if (frente) forma(g, C.castanho, () => { g.moveTo(-9, cy - 3); g.quadraticCurveTo(0, cy - 8, 9, cy - 3); g.lineTo(9, cy); g.lineTo(-9, cy); g.closePath() }, 1)
      },
    },
    ladino: {
      roupa: misturar(C.cabeloEscuro, C.madeira, 0.35), calca: C.cabeloEscuro, bota: C.madeiraEscura, cinto: C.vermelho, pele: C.peleMorena, cabelo: C.cabeloEscuro, detalhe: null, capa: C.vermelho,
      arma(g, frente) {
        const x = frente ? 12 : -12
        forma(g, C.aco, () => { g.moveTo(x - 1.2, -20); g.lineTo(x - 1.2, -32); g.lineTo(x, -34); g.lineTo(x + 1.2, -32); g.lineTo(x + 1.2, -20); g.closePath() }, 1)
        forma(g, C.madeiraEscura, () => g.rect(x - 3, -20, 6, 2), 1)
      },
      cabeca(g, cy, frente) {
        forma(g, C.cabeloEscuro, () => { g.moveTo(-11, cy + 3); g.quadraticCurveTo(-11, cy - 11, 0, cy - 11); g.quadraticCurveTo(11, cy - 11, 11, cy + 3); g.lineTo(frente ? 8 : 11, cy - 2); g.lineTo(frente ? -9 : -11, cy - 2); g.closePath() })
        forma(g, C.vermelho, () => { g.moveTo(-11, cy - 4); g.quadraticCurveTo(0, cy - 9, 11, cy - 4); g.lineTo(11, cy - 1); g.quadraticCurveTo(0, cy - 6, -11, cy - 1); g.closePath() }, 1)
        forma(g, C.vermelho, () => { g.moveTo(10, cy - 3); g.lineTo(18, cy + 3); g.lineTo(15, cy + 5); g.lineTo(10, cy); g.closePath() }, 1)
      },
    },
    guarda: {
      roupa: C.aco, calca: escurecer(C.aco, 0.2), bota: C.ferro, cinto: C.madeiraEscura, pele: C.pele, cabelo: C.castanho, detalhe: C.vermelho, capa: C.vermelho,
      arma(g, frente) {
        const xl = frente ? -14 : 14
        forma(g, C.madeira, () => g.rect(xl - 1.2, -64, 2.4, 62), 1)
        forma(g, C.aco, () => { g.moveTo(xl - 3, -62); g.lineTo(xl, -71); g.lineTo(xl + 3, -62); g.closePath() }, 1)
        if (frente) {
          const escudo = () => { g.moveTo(5, -36); g.lineTo(17, -36); g.lineTo(17, -24); g.quadraticCurveTo(17, -17, 11, -14); g.quadraticCurveTo(5, -17, 5, -24); g.closePath() }
          forma(g, C.vermelho, escudo)
          forma(g, C.latao, () => g.rect(10, -34, 2, 16), 0.8)
        }
      },
      cabeca(g, cy, frente) {
        forma(g, C.aco, () => { g.moveTo(-12, cy + 4); g.quadraticCurveTo(-12, cy - 13, 0, cy - 13); g.quadraticCurveTo(12, cy - 13, 12, cy + 4); if (frente) { g.lineTo(9, cy + 4); g.lineTo(9, cy - 2); g.lineTo(-9, cy - 2); g.lineTo(-9, cy + 4) } g.closePath() })
        forma(g, C.vermelho, () => { g.moveTo(-2, cy - 12); g.quadraticCurveTo(4, cy - 24, 13, cy - 19); g.quadraticCurveTo(6, cy - 16, 2, cy - 11); g.closePath() }, 1)
        g.fillStyle = rgba('#fffaf0', 0.45)
        g.fillRect(-8, cy - 10, 3, 6)
      },
    },
  }
  function desenharLobo(g, frente, quadro) {
    const passo = quadro >= 1 && quadro <= 4 ? [0, 1, 0, -1][quadro - 1] : 0
    const agacha = quadro === 5 ? 3 : 0
    const ar = quadro === 6
    const cor = C.pelagem
    const barriga = clarear(cor, 0.35)
    const s = frente ? 1 : -1
    // vista 3/4: frente = focinho para baixo-esquerda; costas = traseira e cauda
    const pata = (x, d) => forma(g, escurecer(cor, 0.1), () => g.roundRect(x - 2.5, -12 + agacha, 5, 12 - (ar ? 4 : Math.max(0, d) * 2), 2), 1)
    pata(8 * s, -passo)
    pata(-10 * s, passo)
    forma(g, cor, () => g.ellipse(2 * s, -17 + agacha, 17, 10, -0.18 * s, 0, Math.PI * 2))
    forma(g, cor, () => { g.moveTo(14 * s, -20 + agacha); g.quadraticCurveTo(26 * s, -24, 24 * s, -34 + (ar ? 4 : 0)); g.quadraticCurveTo(20 * s, -24, 12 * s, -14 + agacha); g.closePath() })
    pata(-4 * s, passo)
    pata(12 * s, -passo)
    g.save()
    g.beginPath()
    g.ellipse(2 * s, -17 + agacha, 17, 10, -0.18 * s, 0, Math.PI * 2)
    g.clip()
    g.fillStyle = rgba(barriga, 0.7)
    g.fillRect(-20, -12 + agacha, 40, 8)
    g.restore()
    if (frente) {
      forma(g, cor, () => g.ellipse(-12, -28 + agacha, 9, 8, 0, 0, Math.PI * 2))
      forma(g, barriga, () => { g.moveTo(-14, -28 + agacha); g.lineTo(-24, -22 + agacha); g.lineTo(-13, -20 + agacha); g.closePath() }, 1)
      elipse(g, -24, -22.5 + agacha, 1.8, 1.5, C.cabeloEscuro, 0.8)
      for (const x of [-17, -8]) forma(g, cor, () => { g.moveTo(x - 3, -33 + agacha); g.lineTo(x, -42 + agacha); g.lineTo(x + 3, -33 + agacha); g.closePath() }, 1)
      g.fillStyle = contorno(C.chama)
      g.beginPath()
      g.ellipse(-15, -29 + agacha, 1.3, 1.7, 0, 0, Math.PI * 2)
      g.fill()
    } else {
      forma(g, cor, () => g.ellipse(13, -29 + agacha, 8, 8, 0, 0, Math.PI * 2))
      for (const x of [9, 17]) forma(g, cor, () => { g.moveTo(x - 3, -33 + agacha); g.lineTo(x, -42 + agacha); g.lineTo(x + 3, -33 + agacha); g.closePath() }, 1)
    }
  }
  function desenharGolem(g, frente, quadro) {
    const passo = quadro >= 1 && quadro <= 4 ? [0, 1, 0, -1][quadro - 1] : 0
    const agacha = quadro === 5 ? 3 : 0
    const cor = misturar(C.pedra, C.rocha, 0.35)
    for (const [x, d] of [[-9, passo], [9, -passo]]) caixaIso(g, x, -Math.max(0, d) * 2, 7, 7, 13, escurecer(cor, 0.08))
    const corpo = () => { g.moveTo(-18, -18 + agacha); g.lineTo(-14, -44 + agacha); g.lineTo(0, -50 + agacha); g.lineTo(15, -44 + agacha); g.lineTo(19, -18 + agacha); g.lineTo(8, -10); g.lineTo(-8, -10); g.closePath() }
    forma(g, cor, corpo, 1.4)
    g.save()
    g.beginPath()
    corpo()
    g.clip()
    g.fillStyle = rgba(escurecer(cor, 0.6), 0.22)
    g.fillRect(4, -60, 20, 60)
    g.strokeStyle = rgba(contorno(cor), 0.55)
    g.lineWidth = 1
    g.beginPath()
    g.moveTo(-14, -32 + agacha)
    g.lineTo(-3, -28 + agacha)
    g.lineTo(6, -34 + agacha)
    g.moveTo(-6, -46 + agacha)
    g.lineTo(-2, -38 + agacha)
    g.stroke()
    g.fillStyle = rgba(C.musgo, 0.95)
    g.beginPath()
    g.ellipse(-6, -47 + agacha, 9, 4, 0, 0, Math.PI * 2)
    g.ellipse(12, -24 + agacha, 4, 3, 0, 0, Math.PI * 2)
    g.fill()
    g.restore()
    for (const lado of [-1, 1]) caixaIso(g, lado * 21, -14 + agacha + passo * lado * 1.5, 7, 7, 22, cor)
    if (frente) {
      g.fillStyle = C.aguaRasa
      g.beginPath()
      g.ellipse(-7, -36 + agacha, 2.3, 1.8, 0, 0, Math.PI * 2)
      g.ellipse(1, -36 + agacha, 2.3, 1.8, 0, 0, Math.PI * 2)
      g.fill()
    }
  }

  // ---------- cache de sprites ----------
  const sprites = new Map()
  /** Sprite numa escala s com a tinta do período; ancorado em (ax, ay) = pés. */
  function sprite(chave, w, h, ax, ay, s, periodo, desenhar) {
    const k = `${chave}|${s}|${periodo}`
    if (sprites.has(k)) return sprites.get(k)
    const c = tela(w * s, h * s)
    const g = c.getContext('2d')
    g.setTransform(s, 0, 0, s, ax * s, ay * s)
    desenhar(g)
    const t = PERIODOS[periodo].tinta
    if (t[0] < 0.999 || t[1] < 0.999 || t[2] < 0.999) {
      g.setTransform(1, 0, 0, 1, 0, 0)
      g.globalCompositeOperation = 'multiply'
      g.fillStyle = rgbHex(t.map((v) => v * 255))
      g.fillRect(0, 0, c.width, c.height)
      g.globalCompositeOperation = 'destination-in'
      g.globalAlpha = 1
      const mask = tela(c.width, c.height)
      const mg = mask.getContext('2d')
      mg.setTransform(s, 0, 0, s, ax * s, ay * s)
      desenhar(mg)
      g.drawImage(mask, 0, 0)
      g.globalCompositeOperation = 'source-over'
    }
    const out = { c, ax, ay, w, h }
    sprites.set(k, out)
    return out
  }
  function spriteDoObjeto(p, eixo, s, periodo) {
    const tp = N.PROPS[p.tipo]
    const parte = p.tipo === 'palmeira' ? 'tronco' : 'inteiro'
    return sprite(`p:${p.tipo}:${p.variante || 0}:${eixo}:${parte}`, tp.w + 8, tp.h + 12, (tp.w + 8) / 2, tp.h + 6, s, periodo, (g) => DESENHOS[p.tipo](g, { ...p, eixo }))
  }
  function spriteDaCopa(p, s, periodo) {
    return sprite(`copa:${p.variante || 0}`, 110, 70, 55, 30, s, periodo, (g) => DESENHOS.copa(g, p))
  }
  function spriteDaUnidade(tipo, frente, quadro, s, periodo) {
    const tp = N.TIPOS[tipo]
    return sprite(`u:${tipo}:${frente ? 'f' : 'c'}:${quadro}`, tp.w + 20, tp.h + 14, (tp.w + 20) / 2, tp.h + 8, s, periodo, (g) => desenharUnidade(g, tipo, frente, quadro))
  }
  function limparSprites() {
    sprites.clear()
  }

  return {
    PALETA, PERIODOS, T, PISO_DO_CONTORNO,
    hexRgb, rgbHex, misturar, clarear, escurecer, contorno, luminancia, rgba,
    tela, atlasAceso, mapaDeLuz, pintarColunas, pintarGrade, pintarMarcas, pintarMascaraDaAgua, apagarSilhueta,
    luzNoPonto, prepararLuz, spriteDoObjeto, spriteDaCopa, spriteDaUnidade, desenharUnidade, limparSprites, DESENHOS,
  }
})()
