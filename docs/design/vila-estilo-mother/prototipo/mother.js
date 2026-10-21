/*
 * ESTILO MOTHER — a mesma vila de vila.js, pintada como um livro de histórias.
 *
 * Inspiração: o print que o usuário mandou (21/10/2026). Daqui sai só o estilo
 * (paleta, formas, contorno, densidade de detalhe); nenhum sprite, mapa, nome ou
 * texto do jogo. A vista é só de cima e o traço é desenhado, não pixel art.
 *
 * Reuso, sem cópia: casas, portas, peças, estradas do sul e do norte, colisão,
 * A*, robô, câmera e controles vêm de docs/design/vila/prototipo (vila.js e
 * pagina.js), lidos pelo montar.cjs. Aqui ficam os pintores (chão, barranco,
 * telhados, peças, porta, placa, pino), a paleta e o que muda no cenário:
 * barranco com 4 saídas, ilha de grama do poço, arco do portão, 2 jardineiras,
 * flores, tufos e cogumelos.
 *
 * Determinístico: nenhum Math.random; todo sorteio é `hash` (o mesmo de objetos.js).
 * Toda cor sai da PALETA (a prova confere que não há cor escrita fora dela).
 */
// eslint-disable-next-line no-var, no-unused-vars
var Mae = (function () {
  'use strict'

  const V = Vila
  const VI = Vila._i
  const { hash } = Objetos._i
  const TAU = Math.PI * 2
  const BEIRAL = TelhadoLab.BEIRAL_PX

  // <PALETA> as únicas cores do mapa no Estilo Mother.
  // Base amostrada do print por getImageData (as marcadas com *), o resto escolhido no mesmo tom.
  // Cada cor vira 4 tons: base, realce, sombra e contorno (o escuro da própria cor).
  const PALETA = {
    // * as três, com 10% menos saturação: no print são #80f0b8, #60d098 e #28a868, mas a 100% numa tela
    //   de 1440 o menta puro, ao lado da praça quase branca, ofuscava (decisão anotada no README)
    grama: { base: '#86eab8', sombra: '#66ca98', contorno: '#2ea268' },
    terra: { base: '#f8b868', realce: '#f8c878', sombra: '#e8a058' }, // * base e realce
    praca: { base: '#d8f8e8', realce: '#e8fcf4', sombra: '#c8e8d8' }, // * base e sombra (rejunte)
    barranco: { base: '#b87058', realce: '#d08870', sombra: '#a06040' }, // * as três
    agua: { base: '#68b0d8' },
    rosa: { base: '#f4a8d8' },
    amarelo: { base: '#f8e060' }, // *
    violeta: { base: '#b078e0' }, // *
    branco: { base: '#f8f8f0' }, // *
    laranja: { base: '#f86830' }, // *
    madeiraClara: { base: '#f8c890', sombra: '#e0a870' }, // * as duas
    madeira: { base: '#d09060' }, // *
    madeiraEscura: { base: '#a06828' }, // *
    reboco: { base: '#f8f8d8' }, // *
    pedra: { base: '#c4d0c8' },
    metal: { base: '#7a8a8c' },
    folha: { base: '#48c088' },
    folhaEscura: { base: '#38a878' },
    fogo: { base: '#f89820' }, // *
    papel: { base: '#f8f0c0' }, // *
    // os 7 telhados: as famílias de cor do app (azul, azul-claro, cinza, terracota, verde, palha, ardósia), em tom doce
    telhaAzul: { base: '#7896d6' },
    telhaAzulClara: { base: '#94bce4' },
    telhaCinza: { base: '#a8b0b8' },
    telhaTerracota: { base: '#e08058' },
    telhaVerde: { base: '#a0c878' },
    palha: { base: '#f8d850', realce: '#f8f080', sombra: '#e8c040', contorno: '#b07810' }, // * sombra e contorno
    ardosia: { base: '#687878', realce: '#a0b0a8', sombra: '#586868' }, // * as três
  }
  // </PALETA>

  /** Luminância mínima de um contorno derivado (o #303030 do print tem 0,030; o preto, 0). */
  const PISO_DO_CONTORNO = 0.065

  // ---------- tons ----------

  const limitar = (v, a, b) => (v < a ? a : v > b ? b : v)
  const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const rgbHex = (c) => '#' + c.map((v) => Math.round(limitar(v, 0, 255)).toString(16).padStart(2, '0')).join('')
  function luminancia(h) {
    const [r, g, b] = hexRgb(h).map((v) => {
      const u = v / 255
      return u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  function paraHsl([r, g, b]) {
    r /= 255
    g /= 255
    b /= 255
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const l = (max + min) / 2
    if (max === min) return [0, 0, l]
    const d = max - min
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
    return [h * 60, s, l]
  }
  function deHsl(h, s, l) {
    const hh = (((h % 360) + 360) % 360) / 360
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    const f = (t) => {
      const u = (t + 1) % 1
      if (u < 1 / 6) return p + (q - p) * 6 * u
      if (u < 1 / 2) return q
      if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6
      return p
    }
    return rgbHex([f(hh + 1 / 3) * 255, f(hh) * 255, f(hh - 1 / 3) * 255])
  }
  const misturar = (a, b, t) => {
    const x = hexRgb(a)
    const y = hexRgb(b)
    return rgbHex(x.map((v, i) => v + (y[i] - v) * t))
  }
  /** Distância de matiz com sinal, para puxar o realce para o amarelo. */
  const rumo = (h, alvo) => ((alvo - h + 540) % 360) - 180

  const cacheDeTons = new Map()
  /** Base, realce (luz de cima à esquerda), sombra e contorno de uma cor da paleta; `linha` é o traço do padrão. */
  function tons(nome) {
    const pronto = cacheDeTons.get(nome)
    if (pronto) return pronto
    const c = PALETA[nome]
    if (!c) throw new Error('cor fora da paleta: ' + nome)
    const [h, s, l] = paraHsl(hexRgb(c.base))
    const quente = h < 90 || h > 330
    const realce = c.realce || deHsl(h + rumo(h, 55) * 0.12, s, limitar(l + 0.09, 0, 0.95))
    const sombra = c.sombra || deHsl(h + (quente ? -4 : 0), limitar(s + 0.05, 0, 1), limitar(l - 0.12, 0.05, 1))
    let contorno = c.contorno
    if (!contorno) {
      const sc = limitar(s + 0.12, 0, 0.85)
      let lc = l * 0.5
      contorno = deHsl(h + (quente ? -6 : 0), sc, lc)
      while (luminancia(contorno) < PISO_DO_CONTORNO && lc < 0.6) {
        lc += 0.01
        contorno = deHsl(h + (quente ? -6 : 0), sc, lc)
      }
    }
    const t = { base: c.base, realce, sombra, contorno, linha: misturar(sombra, contorno, 0.45) }
    cacheDeTons.set(nome, t)
    return t
  }
  const tinta = (hex, alfa) => {
    const [r, g, b] = hexRgb(hex)
    return `rgba(${r}, ${g}, ${b}, ${alfa})`
  }
  /** A sombra no chão é o escuro da ardósia, transparente: fria e nunca preta. */
  const sombraDoChao = (alfa) => tinta(tons('ardosia').contorno, alfa)

  // ---------- formas ----------

  const canvasDe = (w, h) => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    return c
  }
  function circulo(x, y, r) {
    const p = new Path2D()
    p.arc(x, y, r, 0, TAU)
    return p
  }
  function elipse(x, y, rx, ry, a = 0) {
    const p = new Path2D()
    p.ellipse(x, y, rx, ry, a, 0, TAU)
    return p
  }
  function ret(x, y, w, h, r = 0) {
    const p = new Path2D()
    if (r) p.roundRect(x, y, w, h, r)
    else p.rect(x, y, w, h)
    return p
  }
  function poligono(pts) {
    const p = new Path2D()
    p.moveTo(pts[0][0], pts[0][1])
    for (let i = 1; i < pts.length; i += 1) p.lineTo(pts[i][0], pts[i][1])
    p.closePath()
    return p
  }
  function capsula(x0, y0, x1, y1, r) {
    const a = Math.atan2(y1 - y0, x1 - x0)
    const p = new Path2D()
    p.arc(x1, y1, r, a - Math.PI / 2, a + Math.PI / 2)
    p.arc(x0, y0, r, a + Math.PI / 2, a + (3 * Math.PI) / 2)
    p.closePath()
    return p
  }
  function setor(r0, r1, a0, a1) {
    const p = new Path2D()
    p.arc(0, 0, r1, a0, a1)
    p.arc(0, 0, r0, a1, a0, true)
    p.closePath()
    return p
  }
  /** Meia-lua de baixo (babado do toldo). */
  function babado(x, y, r) {
    const p = new Path2D()
    p.arc(x, y, r, 0, Math.PI)
    p.closePath()
    return p
  }
  /** Chama vista de cima: estrela de pontas redondas. */
  function chama(x, y, r) {
    const p = new Path2D()
    for (let i = 0; i <= 10; i += 1) {
      const a = (i / 10) * TAU - Math.PI / 2
      const rr = i % 2 ? r * 0.6 : r
      if (i) p.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
      else p.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
    }
    p.closePath()
    return p
  }

  /**
   * O traço do estilo: base chapada, um realce no alto à esquerda, uma sombra
   * embaixo à direita (as duas por dentro da forma) e o contorno colorido.
   */
  function pintar(g, forma, cor, o = {}) {
    const t = tons(cor)
    g.fillStyle = t.base
    g.fill(forma)
    const luz = o.luz ?? 1.4
    if (luz > 0) {
      g.save()
      g.clip(forma)
      g.lineWidth = luz * 1.7
      g.translate(luz, luz)
      g.strokeStyle = t.realce
      g.stroke(forma)
      g.translate(-2 * luz, -2 * luz)
      g.strokeStyle = t.sombra
      g.stroke(forma)
      g.restore()
    }
    const lc = o.contorno ?? 1.4
    if (lc > 0) {
      g.lineWidth = lc
      g.strokeStyle = t.contorno
      g.stroke(forma)
    }
  }
  function tracos(g, cor, largura, f) {
    g.beginPath()
    f(g)
    g.lineWidth = largura
    g.strokeStyle = cor
    g.stroke()
  }
  function dentro(g, forma, f) {
    g.save()
    g.clip(forma)
    f()
    g.restore()
  }
  function sombraNoChao(g, forma, dx = 2.2, dy = 2.8, alfa = 0.22) {
    g.save()
    g.translate(dx, dy)
    g.fillStyle = sombraDoChao(alfa)
    g.fill(forma)
    g.restore()
  }
  /** Sombra de uma forma girada: o deslocamento é do mundo (luz fixa), a forma gira. */
  function sombraGirada(g, ang, forma, dx = 2.2, dy = 2.8) {
    g.save()
    g.translate(dx, dy)
    g.rotate(ang)
    g.fillStyle = sombraDoChao(0.22)
    g.fill(forma)
    g.restore()
  }

  /**
   * Copa, sebe, folhagem: tufos redondos com um só contorno por fora.
   * Primeiro o contorno de cada tufo, depois o miolo por cima: só a silhueta fica.
   */
  function folhagem(g, lobos, cor, o = {}) {
    const t = tons(cor)
    const uniao = new Path2D()
    for (const l of lobos) uniao.addPath(circulo(l.x, l.y, l.r))
    g.lineWidth = o.contorno ?? 2.4
    g.strokeStyle = t.contorno
    for (const l of lobos) g.stroke(circulo(l.x, l.y, l.r))
    g.fillStyle = t.sombra
    g.fill(uniao)
    g.save()
    g.clip(uniao)
    g.fillStyle = t.base
    for (const l of lobos) g.fill(circulo(l.x - l.r * 0.15, l.y - l.r * 0.17, l.r * 0.88))
    g.fillStyle = t.realce
    for (const l of lobos) if (l.luz) g.fill(circulo(l.x - l.r * 0.36, l.y - l.r * 0.4, l.r * 0.3))
    g.restore()
  }
  const ordemDaLuz = (a, b) => b.x + b.y - (a.x + a.y)

  function florzinha(g, x, y, cor, r = 1.5) {
    const t = tons(cor)
    g.fillStyle = t.contorno
    g.fill(circulo(x, y, r * 1.9))
    g.fillStyle = t.base
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * TAU + 0.4
      g.fill(circulo(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9, r * 0.85))
    }
    g.fillStyle = cor === 'amarelo' ? tons('laranja').base : tons('amarelo').base
    g.fill(circulo(x, y, r * 0.55))
  }

  // ---------- cenário: o que muda em volta das casas ----------

  const CENTRO = V.CENTRO
  const RAIO_DA_ILHA = 56

  /** Estradas de terra. Sul e norte são as de vila.js (as do "outro mapa"); leste e oeste são novas, como no print. */
  const ESTRADAS = [
    ...V.ESTRADAS.map((e) => ({ nome: e.nome, largura: e.largura, pts: [...e.dentro, ...e.fora.slice(1)], fim: e.fim, outroMapa: true })),
    { nome: 'Saída do Leste', largura: 30, pts: [[1040, 536], [1150, 534], [1236, 535], [1300, 540], [1372, 546]], fim: [1334, 542], outroMapa: false },
    { nome: 'Saída do Oeste', largura: 30, pts: [[14, 500], [-40, 500], [-100, 495], [-172, 488]], fim: [-138, 492], outroMapa: false },
  ]

  /** O barranco segue o muro de vila.js, aberto em 4 saídas (norte, oeste, sul, leste). */
  const BARRANCO = [
    [[533, -42], [-12, -42], [-40, -14], [-40, 470]],
    [[-40, 530], [-40, 764], [-12, 792], [604, 792]],
    [[680, 792], [1208, 792], [1236, 764], [1236, 565]],
    [[1236, 505], [1236, -14], [1208, -42], [597, -42]],
  ]
  const MEIA_FAIXA = 6.5

  /** Sebes ao pé do barranco; as dos lados saíram de onde agora há saída. */
  const SEBES = [
    [[352, -31], [508, -31]],
    [[300, 781], [496, 781]],
    [[800, 781], [1150, 781]],
    [[-29, 290], [-29, 420]],
    [[1225, 600], [1225, 740]],
  ]
  const PECAS_DE_SEBE = SEBES.map(([a, b], i) => ({ t: 'sebe', x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, comp: Math.hypot(b[0] - a[0], b[1] - a[1]), vertical: a[0] === b[0], semente: i + 1 }))

  /** Peças da praça: as 31 de vila.js, no mesmo lugar, mais o arco do portão e duas jardineiras. */
  const ARCO = { t: 'arco', x: 635, y: 700 }
  const POSTES_DO_ARCO = [-34, 34].map((dx) => ({ t: 2, x: ARCO.x + dx, y: ARCO.y, r: 4.5 }))
  const PECAS = [...V.PECAS, ARCO, { t: 'jardineira', x: 490, y: 492, col: { w: 30, h: 12 } }, { t: 'jardineira', x: 682, y: 492, col: { w: 30, h: 12 } }]

  const amostrasDasEstradas = ESTRADAS.map((e) => V.amostrarLinha(e.pts, 3))
  function longeDasEstradas(x, y, folga) {
    return ESTRADAS.every((e, i) => amostrasDasEstradas[i].every(([px, py]) => Math.hypot(px - x, py - y) >= e.largura / 2 + folga))
  }
  /** Fora do muro ficam menos árvores (o campo do print é aberto) e nenhuma em cima das saídas novas. */
  const ARVORES_DE_FORA = V.ARVORES_DE_FORA.filter((a, i) => hash(i, 5, 93) > 0.4 && longeDasEstradas(a.x, a.y, a.R + 4))

  const EXTERNAS = [...PECAS_DE_SEBE, ...PECAS, ...V.PLACAS, ...ARVORES_DE_FORA].sort((a, b) => (a.t === 'arvore') - (b.t === 'arvore') || a.y - b.y)

  // ---------- colisão: as casas e as peças de vila.js; o barranco no lugar do muro ----------

  function obstaculos() {
    const lista = []
    for (const trecho of BARRANCO) {
      for (let i = 0; i < trecho.length - 1; i += 1) lista.push({ t: 0, ax: trecho[i][0], ay: trecho[i][1], bx: trecho[i + 1][0], by: trecho[i + 1][1], r: MEIA_FAIXA + 1.5 })
    }
    for (const s of SEBES) lista.push({ t: 0, ax: s[0][0], ay: s[0][1], bx: s[1][0], by: s[1][1], r: 7 })
    for (const c of V.CASAS) for (const [a, b] of VI.paredesDaCasa(c)) lista.push({ t: 0, ax: a[0], ay: a[1], bx: b[0], by: b[1], r: 2 })
    lista.push(...formasDasPecas(), ...V.PECAS_DE_DENTRO.map(V.formaDaPeca).filter(Boolean))
    return lista
  }
  /** Só as peças de fora (para a prova "nada em cima da porta nem do caminho"). */
  function formasDasPecas() {
    return [...PECAS, ...V.PLACAS, ...ARVORES_DE_FORA].map(V.formaDaPeca).filter(Boolean).concat(POSTES_DO_ARCO)
  }
  let fis = null
  const fisica = () => fis || (fis = V.montarFisica(obstaculos()))

  // ---------- linhas tortas (o traço desenhado) ----------

  /** Ruído suave de 1 dimensão, em -1..1. */
  function ruido1(x, semente) {
    const i = Math.floor(x)
    const f = x - i
    const u = f * f * (3 - 2 * f)
    return (hash(i, semente, 1) * (1 - u) + hash(i + 1, semente, 1) * u) * 2 - 1
  }
  /** Pontos de um polígono suavizado (o mesmo desenho de contornoSuave de vila.js). */
  function amostrarFechado(pts, passos) {
    const n = pts.length
    const meio = (i) => [(pts[i % n][0] + pts[(i + 1) % n][0]) / 2, (pts[i % n][1] + pts[(i + 1) % n][1]) / 2]
    const saida = []
    for (let i = 0; i < n; i += 1) {
      const a = meio(i + n - 1)
      const c = pts[i]
      const b = meio(i)
      for (let s = 0; s < passos; s += 1) {
        const t = s / passos
        saida.push([(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]])
      }
    }
    return saida
  }
  /** Normais (unitárias) de uma linha de pontos, pela diferença central. */
  function normais(pts, fechado) {
    const n = pts.length
    return pts.map((p, i) => {
      const a = fechado ? pts[(i - 1 + n) % n] : pts[Math.max(0, i - 1)]
      const b = fechado ? pts[(i + 1) % n] : pts[Math.min(n - 1, i + 1)]
      const tx = b[0] - a[0]
      const ty = b[1] - a[1]
      const l = Math.hypot(tx, ty) || 1
      return [-ty / l, tx / l]
    })
  }
  /** Comprimento de arco acumulado. */
  function arcos(pts) {
    let s = 0
    return pts.map((p, i) => (i ? (s += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1])) : 0))
  }
  /** Desloca cada ponto na normal por um ruído suave: borda irregular, mas sem serrilhado. */
  function ondular(pts, amp, periodo, semente, fechado) {
    const ns = normais(pts, fechado)
    const ss = arcos(pts)
    return pts.map((p, i) => {
      const w = ruido1(ss[i] / periodo, semente) * amp + ruido1(ss[i] / (periodo * 0.31), semente + 7) * amp * 0.3
      return [p[0] + ns[i][0] * w, p[1] + ns[i][1] * w]
    })
  }
  function dentroDoPoligono(pts, x, y) {
    let d = false
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
      const [xi, yi] = pts[i]
      const [xj, yj] = pts[j]
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d
    }
    return d
  }
  function caminhoDe(pts, fechar) {
    const p = new Path2D()
    p.moveTo(pts[0][0], pts[0][1])
    for (let i = 1; i < pts.length; i += 1) p.lineTo(pts[i][0], pts[i][1])
    if (fechar) p.closePath()
    return p
  }

  // ---------- o cenário, calculado uma vez ----------

  let cenario = null
  function montarCenario() {
    if (cenario) return cenario
    const t0 = performance.now()
    const praca = ondular(amostrarFechado(VI.PRACA, 14), 2.6, 15, 211, true)
    const ilha = ondular(Array.from({ length: 96 }, (_, i) => [CENTRO[0] + Math.cos((i / 96) * TAU) * RAIO_DA_ILHA, CENTRO[1] + Math.sin((i / 96) * TAU) * RAIO_DA_ILHA]), 2.4, 12, 223, true)
    const estradas = ESTRADAS.map((e, i) => bordasDaEstrada(e, amostrasDasEstradas[i], 300 + i * 10))
    const barranco = BARRANCO.map((trecho, i) => faixaDoBarranco(trecho, 400 + i * 10))
    cenario = { praca, ilha, estradas, barranco }
    cenario.detalhes = espalharDetalhes(cenario)
    cenario.ms = performance.now() - t0
    return cenario
  }

  function bordasDaEstrada(e, amostras, semente) {
    const ns = normais(amostras, false)
    const ss = arcos(amostras)
    const hw = e.largura / 2
    const lado = (sinal, meia, sem, amp) => amostras.map((p, i) => {
      const w = meia + ruido1(ss[i] / 13, sem) * amp + ruido1(ss[i] / 4.6, sem + 3) * amp * 0.35
      return [p[0] + ns[i][0] * w * sinal, p[1] + ns[i][1] * w * sinal]
    })
    const esquerda = lado(1, hw, semente, 2.4)
    const direita = lado(-1, hw, semente + 1, 2.4)
    const mioloE = lado(1, hw * 0.4, semente + 2, 2.2)
    const mioloD = lado(-1, hw * 0.4, semente + 4, 2.2)
    const pedrinhas = []
    for (let i = 4; i < amostras.length - 4; i += 7) {
      if (hash(i, semente, 5) > 0.42) continue
      const d = (hash(i, semente, 6) - 0.5) * 2 * hw * 0.75
      pedrinhas.push([amostras[i][0] + ns[i][0] * d, amostras[i][1] + ns[i][1] * d, 1 + hash(i, semente, 7) * 0.9])
    }
    return { forma: caminhoDe([...esquerda, ...direita.reverse()], true), miolo: caminhoDe([...mioloE, ...mioloD.reverse()], true), pedrinhas }
  }

  /** Um trecho do barranco: faixa de terra com a beira de baixo em zigue-zague e a grama felpuda por cima. */
  function faixaDoBarranco(trecho, semente) {
    const pts = []
    for (let i = 0; i < trecho.length - 1; i += 1) {
      const [a, b] = [trecho[i], trecho[i + 1]]
      const l = Math.hypot(b[0] - a[0], b[1] - a[1])
      const n = Math.max(1, Math.round(l / 2.5))
      for (let s = i ? 1 : 0; s <= n; s += 1) pts.push([a[0] + ((b[0] - a[0]) * s) / n, a[1] + ((b[1] - a[1]) * s) / n])
    }
    // normais suavizadas (as quinas chanfradas viram curva) e viradas para dentro da vila
    const m = pts.length
    const ns = pts.map((p, i) => {
      const a = pts[Math.max(0, i - 4)]
      const b = pts[Math.min(m - 1, i + 4)]
      const tx = b[0] - a[0]
      const ty = b[1] - a[1]
      const l = Math.hypot(tx, ty) || 1
      let nx = -ty / l
      let ny = tx / l
      if (nx * (CENTRO[0] - p[0]) + ny * (CENTRO[1] - p[1]) < 0) {
        nx = -nx
        ny = -ny
      }
      return [nx, ny]
    })
    const ss = arcos(pts)
    const meio = pts.map((p, i) => {
      const w = ruido1(ss[i] / 46, semente) * 1.6
      return [p[0] + ns[i][0] * w, p[1] + ns[i][1] * w]
    })
    const dentroDaVila = []
    const fora = []
    for (let i = 0; i < m; i += 1) {
      const f = ss[i] / 9 + 0.25
      const tri = 1 - 4 * Math.abs(f - Math.floor(f) - 0.5)
      const zig = tri * 1.5 * (0.65 + 0.7 * hash(Math.floor(ss[i] / 9), semente, 2))
      const wi = MEIA_FAIXA + zig
      const wo = MEIA_FAIXA + ruido1(ss[i] / 17, semente + 5) * 0.8
      dentroDaVila.push([meio[i][0] + ns[i][0] * wi, meio[i][1] + ns[i][1] * wi])
      fora.push([meio[i][0] - ns[i][0] * wo, meio[i][1] - ns[i][1] * wo])
    }
    // pontas redondas nas saídas: de fora (−n), passando pela ponta (`dir`), até dentro (+n)
    const ponta = (i, dir) => {
      const [cx, cy] = meio[i]
      const [nx, ny] = ns[i]
      const r = MEIA_FAIXA + 0.6
      const lista = []
      for (let k = 1; k < 8; k += 1) {
        const a = (k / 8) * Math.PI
        const ux = -nx * Math.cos(a) + dir[0] * Math.sin(a)
        const uy = -ny * Math.cos(a) + dir[1] * Math.sin(a)
        lista.push([cx + ux * r, cy + uy * r])
      }
      return lista
    }
    const unit = (a, b) => {
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
      return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]
    }
    const pontaInicial = ponta(0, unit(pts[Math.min(m - 1, 2)], pts[0]))
    const pontaFinal = ponta(m - 1, unit(pts[Math.max(0, m - 3)], pts[m - 1])).reverse()
    const contorno = [fora[0], ...pontaInicial, ...dentroDaVila, ...pontaFinal, fora[m - 1]]
    const faixa = caminhoDe([...contorno, ...fora.slice().reverse()], true)
    // realce: traços longos na metade de cima da faixa; sombra: junto da beira de baixo
    const realces = []
    let atual = null
    for (let i = 0; i < m; i += 1) {
      const liga = hash(Math.floor(ss[i] / 26), semente, 9) > 0.32
      if (liga) {
        if (!atual) realces.push((atual = []))
        atual.push([meio[i][0] - ns[i][0] * 1.9, meio[i][1] - ns[i][1] * 1.9])
      } else atual = null
    }
    const sombra = dentroDaVila.map((p, i) => [p[0] - ns[i][0] * 1.5, p[1] - ns[i][1] * 1.5])
    const tufos = []
    for (let i = 0; i < m; i += 2) tufos.push([fora[i][0] + ns[i][0] * 0.4, fora[i][1] + ns[i][1] * 0.4, 3.8 + hash(i, semente, 4) * 1.6])
    return { faixa, contorno, realces, sombra, tufos }
  }

  /** Flores, tufos e cogumelos: em grupinhos, só na grama, longe de caminho, casa e peça. */
  function espalharDetalhes(cen) {
    const f = fisica()
    const casas = V.CASAS.map((c) => [c.ret[0] - BEIRAL - 8, c.ret[1] - BEIRAL - 8, c.ret[2] + BEIRAL + 10, c.ret[3] + BEIRAL + 10])
    const M = V.MUNDO
    const lista = []
    const CORES = ['rosa', 'amarelo', 'violeta', 'branco']
    const PASSO = 18
    let i = 0
    for (let y = M.y0 + 8; y < M.y1 - 8; y += PASSO) {
      for (let x = M.x0 + 8; x < M.x1 - 8; x += PASSO) {
        i += 1
        const r = hash(i, 1, 501)
        const tipo = r < 0.12 ? 'flores' : r < 0.27 ? 'tufo' : r > 0.994 ? 'cogumelo' : null
        if (!tipo) continue
        const px = x + (hash(i, 2, 501) - 0.5) * PASSO * 0.9
        const py = y + (hash(i, 3, 501) - 0.5) * PASSO * 0.9
        const naIlha = Math.hypot(px - CENTRO[0], py - CENTRO[1]) < RAIO_DA_ILHA - 8
        if (dentroDoPoligono(cen.praca, px, py) && !(naIlha && tipo === 'tufo')) continue
        if (naIlha && Math.hypot(px - CENTRO[0], py - CENTRO[1]) < 34) continue
        if (casas.some((b) => px > b[0] && px < b[2] && py > b[1] && py < b[3])) continue
        if (V.folga(f, px, py, tipo === 'flores' ? 8 : 5) < 0) continue
        if (!longeDasEstradas(px, py, 6)) continue
        if (tipo === 'flores') {
          const n = 2 + Math.floor(hash(i, 4, 501) * 4)
          const cor = CORES[Math.floor(hash(i, 5, 501) * 4)]
          for (let k = 0; k < n; k += 1) {
            const a = hash(i, 10 + k, 501) * TAU
            const d = 2 + hash(i, 20 + k, 501) * 5.5
            const c = hash(i, 30 + k, 501) < 0.25 ? CORES[Math.floor(hash(i, 40 + k, 501) * 4)] : cor
            lista.push({ t: 'flor', x: px + Math.cos(a) * d, y: py + Math.sin(a) * d, cor: c })
          }
        } else lista.push({ t: tipo, x: px, y: py, v: Math.floor(hash(i, 6, 501) * 3) })
      }
    }
    // o anel de flores em volta do poço, como no print
    for (let k = 0; k < 14; k += 1) {
      const a = (k / 14) * TAU + 0.15
      const d = 42 + hash(k, 1, 503) * 6
      lista.push({ t: 'flor', x: CENTRO[0] + Math.cos(a) * d, y: CENTRO[1] + Math.sin(a) * d, cor: CORES[k % 4] })
    }
    return lista
  }

  // ---------- ladrilho da praça: pedras redondas em fileiras, rejunte fino ----------

  const ladrilhos = new Map()
  const LADO_DO_LADRILHO = 168
  function ladrilhoDaPraca(k) {
    if (ladrilhos.has(k)) return ladrilhos.get(k)
    const T = LADO_DO_LADRILHO
    const W = Math.round(T * k)
    const cv = canvasDe(W, W)
    const g = cv.getContext('2d')
    g.scale(k, k)
    const t = tons('praca')
    g.fillStyle = t.sombra
    g.fillRect(0, 0, T, T)
    const FILEIRAS = 14
    const h = T / FILEIRAS
    const POR_FILEIRA = 9
    for (let j = 0; j < FILEIRAS; j += 1) {
      const pesos = Array.from({ length: POR_FILEIRA }, (_, i) => 0.8 + hash(i, j, 601) * 0.45)
      const soma = pesos.reduce((a, b) => a + b, 0)
      let x = (j % 2) * (T / POR_FILEIRA / 2) + hash(j, 1, 602) * 3
      for (let i = 0; i < POR_FILEIRA; i += 1) {
        const w = (pesos[i] / soma) * T
        // a fileira emenda nos lados do ladrilho: a pedra que passa da borda aparece do outro lado
        for (const dx of [-T, 0]) {
          const pedra = ret(x + dx + 0.9, j * h + 0.9, w - 1.8, h - 1.8, Math.min(4.6, (h - 1.8) / 2))
          g.fillStyle = hash(i, j, 603) < 0.12 ? t.realce : t.base
          g.fill(pedra)
          g.save()
          g.clip(pedra)
          g.translate(1.1, 1.1)
          g.lineWidth = 1.5
          g.strokeStyle = t.realce
          g.stroke(pedra)
          g.restore()
        }
        x += w
      }
    }
    ladrilhos.set(k, cv)
    return cv
  }
  function padraoDaPraca(ctx, k) {
    const p = ctx.createPattern(ladrilhoDaPraca(k), 'repeat')
    p.setTransform(new DOMMatrix([1 / k, 0, 0, 1 / k, 0, 0]))
    return p
  }

  /** Flor, tufo e cogumelo viram imagens pequenas uma vez por resolução: o chão só cola. */
  const carimbos = new Map()
  function carimbo(nome, k) {
    const chave = nome + '@' + k
    if (carimbos.has(chave)) return carimbos.get(chave)
    const L = 12
    const cv = canvasDe(Math.ceil(L * k), Math.ceil(L * k))
    const g = cv.getContext('2d')
    g.setTransform(k, 0, 0, k, (L / 2) * k, (L / 2) * k)
    g.lineCap = 'round'
    g.lineJoin = 'round'
    const [tipo, v] = nome.split(':')
    if (tipo === 'flor') {
      g.fillStyle = tons('grama').contorno
      g.fill(elipse(-1.7, 2.4, 1.2, 0.8, 0.5))
      g.fill(elipse(1.7, 2.4, 1.2, 0.8, -0.5))
      florzinha(g, 0, 0, v, 1.5)
    } else if (tipo === 'tufo') {
      const t = tons('grama')
      tracos(g, t.sombra, 1.15, (q) => {
        const s = Number(v) * 0.3 + 0.85
        q.moveTo(-2.6 * s, 1.6)
        q.lineTo(-3.4 * s, -1.4)
        q.moveTo(0, 1.6)
        q.lineTo(0, -2.6 * s)
        q.moveTo(2.6 * s, 1.6)
        q.lineTo(3.4 * s, -1.4)
      })
    } else {
      // cogumelo: chapéu (rosa, laranja ou madeira clara) com pintas e um pé creme
      pintar(g, ret(-1.3, 0.6, 2.6, 3.4, 1), 'reboco', { luz: 0, contorno: 0.9 })
      const chapeu = ['rosa', 'laranja', 'madeiraClara'][Number(v)]
      pintar(g, elipse(0, 0, 3.6, 2.6), chapeu, { luz: 0.7, contorno: 1 })
      g.fillStyle = tons('branco').base
      g.fill(circulo(-1.3, -0.5, 0.6))
      g.fill(circulo(1.1, 0.3, 0.5))
    }
    const r = { canvas: cv, L }
    carimbos.set(chave, r)
    return r
  }

  // ---------- o chão inteiro (tudo o que não se mexe) ----------

  const chaos = new Map()
  function chao(k) {
    if (!chaos.has(k)) chaos.set(k, pintarChao(k))
    return chaos.get(k)
  }
  const api = { S: 1, telhados2: false }
  function chaoPronto() {
    return (api.S >= 2 && chaos.get(2)) || chao(1)
  }

  function pintarChao(k) {
    const t0 = performance.now()
    const cen = montarCenario()
    const M = V.MUNDO
    const cv = canvasDe(Math.ceil(M.w * k), Math.ceil(M.h * k))
    const ctx = cv.getContext('2d')
    ctx.setTransform(k, 0, 0, k, -M.x0 * k, -M.y0 * k)
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    // grama lisa, sem textura (a assinatura do estilo)
    ctx.fillStyle = tons('grama').base
    ctx.fillRect(M.x0, M.y0, M.w, M.h)
    // estradas de terra: filete escuro, terra, miolo claro, pedrinhas
    const te = tons('terra')
    ctx.lineWidth = 3.2
    ctx.strokeStyle = te.sombra
    for (const e of cen.estradas) ctx.stroke(e.forma)
    ctx.fillStyle = te.base
    for (const e of cen.estradas) ctx.fill(e.forma)
    ctx.fillStyle = te.realce
    for (const e of cen.estradas) ctx.fill(e.miolo)
    ctx.fillStyle = te.sombra
    for (const e of cen.estradas) for (const [x, y, r] of e.pedrinhas) ctx.fill(elipse(x, y, r, r * 0.7, x * 0.1))
    // praça: rejunte por fora e pedra por dentro
    const praca = caminhoDe(cen.praca, true)
    ctx.lineWidth = 3
    ctx.strokeStyle = tons('praca').sombra
    ctx.stroke(praca)
    ctx.fillStyle = padraoDaPraca(ctx, k)
    ctx.fill(praca)
    // a ilha de grama do poço
    const ilha = caminhoDe(cen.ilha, true)
    ctx.lineWidth = 2.4
    ctx.strokeStyle = tons('grama').sombra
    ctx.stroke(ilha)
    ctx.fillStyle = tons('grama').base
    ctx.fill(ilha)
    // soleira de lajes da porta até a praça
    for (const c of V.CASAS) pintarSoleira(ctx, c)
    // barranco e grama felpuda
    for (const b of cen.barranco) pintarBarranco(ctx, b)
    // casas por dentro e a fresta de parede no lado da sombra
    for (const c of V.CASAS) pintarDentroDaCasa(ctx, c, k)
    // flores, tufos e cogumelos
    for (const d of cen.detalhes) {
      const img = carimbo(d.t === 'flor' ? 'flor:' + d.cor : d.t + ':' + d.v, k)
      ctx.drawImage(img.canvas, d.x - img.L / 2, d.y - img.L / 2, img.L, img.L)
    }
    // o raster sai aqui, e não no primeiro quadro (o canvas é preguiçoso)
    ctx.getImageData(0, 0, 1, 1)
    return { canvas: cv, k, ms: performance.now() - t0 }
  }

  function pintarSoleira(ctx, c) {
    for (let i = 0; i < 3; i += 1) {
      const [x, y] = V.pontoDaPorta(c, (hash(i, 1, c.pos) - 0.5) * 3, 24 + i * 18)
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(c.angulo + (hash(i, 2, c.pos) - 0.5) * 0.12)
      pintar(ctx, ret(-12, -7.5, 24, 15, 3.5), 'pedra', { luz: 1, contorno: 1.2 })
      ctx.restore()
    }
  }

  function pintarBarranco(ctx, b) {
    const t = tons('barranco')
    const tg = tons('grama')
    ctx.fillStyle = t.base
    ctx.fill(b.faixa)
    ctx.save()
    ctx.clip(b.faixa)
    ctx.lineWidth = 3
    ctx.strokeStyle = t.sombra
    ctx.stroke(caminhoDe(b.sombra, false))
    ctx.lineWidth = 1.5
    ctx.strokeStyle = t.realce
    for (const r of b.realces) if (r.length > 2) ctx.stroke(caminhoDe(r, false))
    // grama felpuda por cima: contorno verde-escuro, beira verde-média, miolo menta
    ctx.lineWidth = 2.2
    ctx.strokeStyle = tg.contorno
    for (const [x, y, r] of b.tufos) ctx.stroke(circulo(x, y, r))
    ctx.fillStyle = tg.sombra
    for (const [x, y, r] of b.tufos) ctx.fill(circulo(x, y, r - 0.5))
    ctx.fillStyle = tg.base
    for (const [x, y, r] of b.tufos) ctx.fill(circulo(x - 0.4, y - 0.5, r - 1.7))
    ctx.restore()
    ctx.lineWidth = 2
    ctx.strokeStyle = t.contorno
    ctx.stroke(caminhoDe(b.contorno, false))
  }

  /** Assoalho, paredes e a fresta de parede creme com viga, vistos quando o telhado some. */
  function pintarDentroDaCasa(ctx, c, k) {
    const [x0, y0, x1, y1] = c.ret
    ctx.save()
    ctx.beginPath()
    ctx.rect(x0, y0, x1 - x0, y1 - y0)
    ctx.clip()
    if (c.id === 'templo') {
      ctx.fillStyle = padraoDaPraca(ctx, k)
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
    } else if (c.id === 'estabulo') {
      ctx.fillStyle = tons('terra').base
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
      tracos(ctx, tons('palha').sombra, 1.1, (q) => {
        for (let i = 0; i < 160; i += 1) {
          const x = x0 + hash(i, 1, 701) * (x1 - x0)
          const y = y0 + hash(i, 2, 701) * (y1 - y0)
          const a = hash(i, 3, 701) * Math.PI
          q.moveTo(x - Math.cos(a) * 3, y - Math.sin(a) * 3)
          q.lineTo(x + Math.cos(a) * 3, y + Math.sin(a) * 3)
        }
      })
    } else {
      const t = tons('madeiraClara')
      ctx.fillStyle = t.base
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
      tracos(ctx, t.sombra, 1, (q) => {
        for (let y = y0 + 9, f = 0; y < y1; y += 9, f += 1) {
          q.moveTo(x0, y)
          q.lineTo(x1, y)
          for (let x = x0 + 14 + hash(f, 1, 711) * 40; x < x1; x += 46 + hash(f, Math.round(x), 712) * 20) {
            q.moveTo(x, y - 9)
            q.lineTo(x, y)
          }
        }
      })
    }
    ctx.fillStyle = sombraDoChao(0.2)
    ctx.fillRect(x0, y0, x1 - x0, 6)
    ctx.fillRect(x0, y0, 6, y1 - y0)
    ctx.restore()
    // fresta de parede (reboco creme e vigas) no lado da sombra: sul e leste, 3 px além do beiral
    const B = BEIRAL
    ctx.fillStyle = tons('reboco').base
    ctx.fillRect(x0 - B + 3, y1 + B - 1, x1 - x0 + 2 * B - 3, 4)
    ctx.fillRect(x1 + B - 1, y0 - B + 4, 4, y1 - y0 + 2 * B - 1)
    const viga = tons('madeira')
    ctx.fillStyle = viga.base
    for (let x = x0 - B + 18; x < x1 + B - 6; x += 42) ctx.fillRect(x, y1 + B - 1, 2, 4)
    for (let y = y0 - B + 18; y < y1 + B - 6; y += 42) ctx.fillRect(x1 + B - 1, y, 4, 2)
    ctx.fillStyle = viga.contorno
    ctx.fillRect(x0 - B + 3, y1 + B + 3, x1 - x0 + 2 * B + 1, 1.2)
    ctx.fillRect(x1 + B + 3, y0 - B + 4, 1.2, y1 - y0 + 2 * B)
    // paredes com o vão da porta
    ctx.strokeStyle = viga.contorno
    ctx.lineWidth = 4
    ctx.lineCap = 'square'
    for (const [a, b] of VI.paredesDaCasa(c)) {
      ctx.beginPath()
      ctx.moveTo(a[0], a[1])
      ctx.lineTo(b[0], b[1])
      ctx.stroke()
    }
    ctx.lineCap = 'round'
  }

  /** Sombra do beiral no chão, por casa (some junto com o telhado): fria e macia. */
  function pintarSombraDaCasa(c, k) {
    const [x0, y0, x1, y1] = c.ret
    const B = BEIRAL
    const folga = 24
    const W = Math.ceil((x1 - x0 + 2 * B + 2 * folga) * k)
    const H = Math.ceil((y1 - y0 + 2 * B + 2 * folga) * k)
    const cv = canvasDe(W, H)
    const ctx = cv.getContext('2d')
    const ox = x0 - B - folga
    const oy = y0 - B - folga
    ctx.setTransform(k, 0, 0, k, -ox * k, -oy * k)
    ctx.beginPath()
    ctx.rect(ox, oy, W / k, H / k)
    ctx.rect(x0, y0, x1 - x0, y1 - y0)
    ctx.clip('evenodd')
    for (let i = 4; i >= 0; i -= 1) {
      const g = i * 1.3
      ctx.fillStyle = sombraDoChao(0.07)
      ctx.beginPath()
      ctx.roundRect(x0 - B + 5 - g, y0 - B + 6 - g, x1 - x0 + 2 * B + 2 * g, y1 - y0 + 2 * B + 2 * g, g + 2)
      ctx.fill()
    }
    ctx.getImageData(0, 0, 1, 1)
    return { canvas: cv, x: ox, y: oy, w: W / k, h: H / k }
  }

  // ---------- telhados: um pintor novo, só deste protótipo (o do app não mudou) ----------

  /** Cor e padrão de cada casa. As cores são as do app; o padrão segue o material. */
  const TELHADOS = {
    taverna: ['telhaAzul', 'escamas'],
    guilda: ['telhaAzulClara', 'escamas'],
    ferraria: ['telhaCinza', 'tabuas'],
    boticario: ['telhaTerracota', 'escamas'],
    emporio: ['ardosia', 'ardosia'],
    templo: ['telhaVerde', 'escamas'],
    estabulo: ['palha', 'espinha'],
  }
  const CHAMINES = { taverna: [312, 72], guilda: [985, 50], ferraria: [1160, 300] }

  /** As 4 águas de um telhado de 4 águas visto de cima, com o beiral e o fundo (do beiral ao cume). */
  function aguasDoTelhado(X0, Y0, X1, Y1) {
    const w = X1 - X0
    const h = Y1 - Y0
    const cx = (X0 + X1) / 2
    const cy = (Y0 + Y1) / 2
    if (w >= h) {
      const a = X0 + h / 2
      const b = X1 - h / 2
      return {
        cume: [[a, cy], [b, cy]],
        espigoes: [[[X0, Y0], [a, cy]], [[X0, Y1], [a, cy]], [[X1, Y0], [b, cy]], [[X1, Y1], [b, cy]]],
        aguas: [
          { lado: 'N', pts: [[X0, Y0], [X1, Y0], [b, cy], [a, cy]], beiral: [[X0, Y0], [X1, Y0]], fundo: h / 2 },
          { lado: 'S', pts: [[X1, Y1], [X0, Y1], [a, cy], [b, cy]], beiral: [[X1, Y1], [X0, Y1]], fundo: h / 2 },
          { lado: 'W', pts: [[X0, Y1], [X0, Y0], [a, cy]], beiral: [[X0, Y1], [X0, Y0]], fundo: h / 2 },
          { lado: 'E', pts: [[X1, Y0], [X1, Y1], [b, cy]], beiral: [[X1, Y0], [X1, Y1]], fundo: h / 2 },
        ],
      }
    }
    const a = Y0 + w / 2
    const b = Y1 - w / 2
    return {
      cume: [[cx, a], [cx, b]],
      espigoes: [[[X0, Y0], [cx, a]], [[X1, Y0], [cx, a]], [[X0, Y1], [cx, b]], [[X1, Y1], [cx, b]]],
      aguas: [
        { lado: 'W', pts: [[X0, Y1], [X0, Y0], [cx, a], [cx, b]], beiral: [[X0, Y1], [X0, Y0]], fundo: w / 2 },
        { lado: 'E', pts: [[X1, Y0], [X1, Y1], [cx, b], [cx, a]], beiral: [[X1, Y0], [X1, Y1]], fundo: w / 2 },
        { lado: 'N', pts: [[X0, Y0], [X1, Y0], [cx, a]], beiral: [[X0, Y0], [X1, Y0]], fundo: w / 2 },
        { lado: 'S', pts: [[X1, Y1], [X0, Y1], [cx, b]], beiral: [[X1, Y1], [X0, Y1]], fundo: w / 2 },
      ],
    }
  }

  /** O padrão desenhado à mão, no plano da água: u ao longo do beiral, v do beiral para o cume. */
  function padraoDaAgua(g, padrao, L, F, semente) {
    g.beginPath()
    if (padrao === 'escamas') {
      const R = 5.2
      for (let j = 0, v = 1.4; v < F + R; j += 1, v += 7.2) {
        for (let u = -2 * R + (j % 2) * R; u < L + 2 * R; u += 2 * R) {
          const cu = u + (hash(j, Math.round(u), semente) - 0.5) * 0.9
          g.moveTo(cu - R, v + R)
          g.arc(cu, v + R, R, Math.PI, 0)
        }
      }
    } else if (padrao === 'espinha') {
      for (let i = 0, u = 4; u < L; i += 1, u += 9) {
        for (let v = 7; v < F + 3; v += 5) {
          const j = (hash(i, Math.round(v * 10), semente) - 0.5) * 0.8
          g.moveTo(u - 4 + j, v)
          g.lineTo(u + j, v + 3)
          g.lineTo(u + 4 + j, v)
        }
      }
      // a franja da palha no beiral
      for (let u = -2; u < L + 4; u += 5) {
        g.moveTo(u, 4)
        g.arc(u + 2.5, 4, 2.5, Math.PI, 0)
      }
    } else if (padrao === 'tabuas') {
      for (let i = 0, u = 4; u < L + 9; i += 1, u += 8.5) {
        const w = (hash(i, 1, semente) - 0.5) * 0.9
        g.moveTo(u + w, -1)
        g.lineTo(u - w, F + 2)
        const e = 8 + hash(i, 2, semente) * Math.max(1, F - 14)
        g.moveTo(u + w - 7.9, e)
        g.lineTo(u + w - 0.6, e)
      }
    } else {
      for (let j = 0, v = 6.5; v < F + 8; j += 1, v += 7.5) {
        g.moveTo(-2, v)
        g.lineTo(L + 2, v)
        for (let u = (j % 2) * 5.5 + hash(j, 1, semente) * 2; u < L; u += 11) {
          g.moveTo(u, v - 7.5)
          g.lineTo(u, v)
        }
      }
    }
  }

  function pintarTelhado(g, c, X0, Y0, X1, Y1) {
    const [cor, padrao] = TELHADOS[c.id]
    const t = tons(cor)
    const geo = aguasDoTelhado(X0, Y0, X1, Y1)
    const semente = Math.round(X0 + Y0)
    for (const ag of geo.aguas) {
      const forma = poligono(ag.pts)
      const lit = ag.lado === 'N' || ag.lado === 'W'
      g.fillStyle = lit ? t.base : misturar(t.base, t.sombra, 0.6)
      g.fill(forma)
      g.save()
      g.clip(forma)
      // o padrão no plano da água
      const [e0, e1] = ag.beiral
      const L = Math.hypot(e1[0] - e0[0], e1[1] - e0[1])
      const ax = (e1[0] - e0[0]) / L
      const ay = (e1[1] - e0[1]) / L
      g.save()
      g.transform(ax, ay, -ay, ax, e0[0], e0[1])
      padraoDaAgua(g, padrao, L, ag.fundo, semente + ag.lado.charCodeAt(0))
      g.lineWidth = 1.2
      g.strokeStyle = t.linha
      g.stroke()
      g.restore()
      // um realce junto do cume e dos espigões; uma sombra junto do beiral
      tracos(g, lit ? t.realce : t.base, 3, (q) => {
        const p = ag.pts
        q.moveTo(p[1][0], p[1][1])
        for (let i = 2; i < p.length; i += 1) q.lineTo(p[i][0], p[i][1])
        q.lineTo(p[0][0], p[0][1])
      })
      tracos(g, lit ? t.sombra : t.linha, 5, (q) => {
        q.moveTo(e0[0], e0[1])
        q.lineTo(e1[0], e1[1])
      })
      g.restore()
    }
    // espigões e cumeeira, no contorno da própria cor
    tracos(g, t.contorno, 1.3, (q) => {
      for (const [a, b] of geo.espigoes) {
        q.moveTo(a[0], a[1])
        q.lineTo(b[0], b[1])
      }
      q.moveTo(geo.cume[0][0], geo.cume[0][1])
      q.lineTo(geo.cume[1][0], geo.cume[1][1])
    })
    const [ca, cb] = geo.cume
    if (padrao === 'espinha') {
      // cumeeira de palha amarrada: uma faixa mais grossa
      const f = capsula(ca[0], ca[1], cb[0], cb[1], 3.4)
      pintar(g, f, cor, { luz: 0.9, contorno: 1.3 })
      tracos(g, t.linha, 1, (q) => {
        const l = Math.hypot(cb[0] - ca[0], cb[1] - ca[1])
        for (let s = 6; s < l - 2; s += 9) {
          const x = ca[0] + ((cb[0] - ca[0]) * s) / l
          const y = ca[1] + ((cb[1] - ca[1]) * s) / l
          q.moveTo(x - (cb[1] - ca[1] ? 3 : 0), y - (cb[1] - ca[1] ? 0 : 3))
          q.lineTo(x + (cb[1] - ca[1] ? 3 : 0), y + (cb[1] - ca[1] ? 0 : 3))
        }
      })
    } else if (padrao === 'escamas') {
      // telhas de cumeeira redondas
      const l = Math.hypot(cb[0] - ca[0], cb[1] - ca[1])
      for (let s = 0; s <= l; s += 6.5) pintar(g, circulo(ca[0] + ((cb[0] - ca[0]) * s) / (l || 1), ca[1] + ((cb[1] - ca[1]) * s) / (l || 1), 2.5), cor, { luz: 0.6, contorno: 1 })
    } else {
      const f = capsula(ca[0], ca[1], cb[0], cb[1], 2)
      pintar(g, f, cor, { luz: 0.6, contorno: 1.1 })
    }
    const ch = CHAMINES[c.id]
    if (ch) {
      sombraNoChao(g, ret(ch[0] - 6, ch[1] - 6, 12, 12, 1.5), 3, 4, 0.25)
      pintar(g, ret(ch[0] - 6, ch[1] - 6, 12, 12, 1.5), 'pedra', { luz: 1.1, contorno: 1.4 })
      pintar(g, ret(ch[0] - 3.2, ch[1] - 3.2, 6.4, 6.4, 1), 'metal', { luz: 0, contorno: 1 })
    }
    // o beiral: contorno de fora
    g.lineWidth = 2
    g.strokeStyle = t.contorno
    g.stroke(ret(X0, Y0, X1 - X0, Y1 - Y0, 2))
  }

  const telhados = new Map()
  function imagemDoTelhado(c, k) {
    const chave = c.id + '@' + k
    if (telhados.has(chave)) return telhados.get(chave)
    const t0 = performance.now()
    const [x0, y0, x1, y1] = c.ret
    const X0 = x0 - BEIRAL
    const Y0 = y0 - BEIRAL
    const X1 = x1 + BEIRAL
    const Y1 = y1 + BEIRAL
    const m = 3
    const W = Math.ceil((X1 - X0 + 2 * m) * k)
    const H = Math.ceil((Y1 - Y0 + 2 * m) * k)
    const cv = canvasDe(W, H)
    const g = cv.getContext('2d')
    g.setTransform(k, 0, 0, k, -(X0 - m) * k, -(Y0 - m) * k)
    g.lineJoin = 'round'
    g.lineCap = 'round'
    pintarTelhado(g, c, X0, Y0, X1, Y1)
    g.getImageData(0, 0, 1, 1)
    const r = { canvas: cv, x: X0 - m, y: Y0 - m, w: W / k, h: H / k, k, ms: performance.now() - t0 }
    telhados.set(chave, r)
    return r
  }

  // ---------- as peças: listas de formas com o traço do estilo ----------

  const PRODUTOS = ['laranja', 'amarelo', 'rosa', 'violeta', 'folha']
  const TECIDOS = { vinho: 'telhaTerracota', ocre: 'palha', musgo: 'telhaVerde' }
  const sementeDe = (p) => p.semente ?? Math.round(p.x + p.y) % 7
  const meioBanco = (p) => (p.col ? Math.max(p.col.w || 0, p.col.h || 0) / 2 : 21)

  const DESENHOS = {
    poco: {
      caixa: () => [-35, -28, 31, 28],
      pintar(g) {
        sombraNoChao(g, circulo(0, 0, 26.5), 2.5, 3)
        const agua = circulo(0, 0, 17.5)
        const ta = tons('agua')
        g.fillStyle = ta.sombra
        g.fill(agua)
        dentro(g, agua, () => {
          g.fillStyle = ta.base
          g.fill(circulo(3.2, 3.8, 17))
          g.fillStyle = ta.realce
          g.fill(elipse(6, 7.5, 5, 1.8, -0.6))
        })
        const n = 10
        for (let i = 0; i < n; i += 1) {
          const a0 = (i / n) * TAU + 0.2
          pintar(g, setor(16.5, 26, a0 + 0.035, a0 + TAU / n - 0.035), 'madeiraClara', { luz: 1.1, contorno: 1.3 })
        }
        for (const sx of [-1, 1]) pintar(g, ret(sx * 29 - 3.6, -5.6, 7.2, 7.2, 1.4), 'madeiraEscura', { luz: 1 })
        pintar(g, ret(-31, -4.4, 62, 4.8, 1.2), 'madeira', { luz: 1 })
        pintar(g, circulo(0, -2, 4), 'madeiraClara', { luz: 1 })
        pintar(g, circulo(17.5, 15.5, 5.4), 'madeira', { luz: 1 })
        g.fillStyle = ta.base
        g.fill(circulo(17.5, 15.5, 3.2))
        g.lineWidth = 1.2
        g.strokeStyle = tons('metal').base
        g.stroke(circulo(17.5, 15.5, 4.4))
      },
    },
    banco: {
      caixa: (p) => {
        const c = meioBanco(p) + 1
        return p.vertical ? [-6.5, -c, 6.5, c] : [-c, -6.5, c, 6.5]
      },
      pintar(g, p) {
        const c = meioBanco(p)
        const a = p.vertical ? Math.PI / 2 : 0
        sombraGirada(g, a, ret(-c, -5.6, 2 * c, 11.2, 2))
        g.save()
        g.rotate(a)
        for (const k of [-1, 1]) pintar(g, ret(-c, k < 0 ? -5.6 : 0.4, 2 * c, 5.2, 1.6), 'madeira', { luz: 1 })
        for (const sx of [-1, 1]) pintar(g, ret(sx * (c - 3.5) - 1.6, -6.4, 3.2, 12.8, 1), 'madeiraEscura', { luz: 0, contorno: 1 })
        g.restore()
      },
    },
    barraca: {
      caixa: () => [-31, -24, 31, 35],
      pintar(g, p) {
        const cor = TECIDOS[p.tecido] || 'telhaTerracota'
        const t = tons(cor)
        const s = sementeDe(p)
        sombraNoChao(g, ret(-30, -23, 60, 52, 3), 3, 3.5)
        pintar(g, ret(-26, 23, 52, 11, 2), 'madeiraClara', { luz: 1 })
        for (let i = 0; i < 7; i += 1) pintar(g, circulo(-21 + i * 7, 29, 2.7), PRODUTOS[(i + s) % PRODUTOS.length], { luz: 0.8, contorno: 1 })
        const toldo = ret(-30, -23, 60, 44, 3)
        g.fillStyle = t.base
        g.fill(toldo)
        dentro(g, toldo, () => {
          g.fillStyle = tons('reboco').base
          for (let x = -25; x < 30; x += 12) g.fillRect(x, -23, 6, 44)
          g.fillStyle = tinta(t.contorno, 0.16)
          g.fillRect(-30, 0, 60, 21)
        })
        tracos(g, t.contorno, 1.2, (q) => {
          q.moveTo(-30, 0)
          q.lineTo(30, 0)
        })
        for (let i = 0; i < 6; i += 1) pintar(g, babado(-25 + i * 10, 21, 5), i % 2 ? 'reboco' : cor, { luz: 0, contorno: 1.1 })
        g.lineWidth = 1.5
        g.strokeStyle = t.contorno
        g.stroke(toldo)
      },
    },
    barril: {
      caixa: () => [-10.5, -10.5, 10.5, 10.5],
      pintar(g) {
        const f = circulo(0, 0, 9.8)
        sombraNoChao(g, f, 2, 2.5)
        pintar(g, f, 'madeira', { luz: 1.3 })
        dentro(g, f, () => tracos(g, tons('madeira').linha, 1, (q) => {
          q.moveTo(-3.2, -10)
          q.lineTo(-3.2, 10)
          q.moveTo(3.2, -10)
          q.lineTo(3.2, 10)
        }))
        g.lineWidth = 1.6
        g.strokeStyle = tons('metal').base
        g.stroke(circulo(0, 0, 7.6))
        pintar(g, circulo(4.6, -4.2, 1.3), 'madeiraEscura', { luz: 0, contorno: 0.8 })
      },
    },
    caixa: {
      caixa: () => [-11.5, -11.5, 11.5, 11.5],
      pintar(g) {
        const f = ret(-11, -11, 22, 22, 1.6)
        sombraNoChao(g, f, 2, 2.5)
        pintar(g, f, 'madeiraClara', { luz: 1.2 })
        dentro(g, f, () => tracos(g, tons('madeiraClara').linha, 1, (q) => {
          q.moveTo(-11, -3.7)
          q.lineTo(11, -3.7)
          q.moveTo(-11, 3.7)
          q.lineTo(11, 3.7)
        }))
        g.fillStyle = tons('metal').base
        for (const [x, y] of [[-8, -8], [8, -8], [-8, 8], [8, 8]]) g.fill(circulo(x, y, 0.9))
      },
    },
    bau: {
      caixa: () => [-14.5, -9, 14.5, 9],
      pintar(g) {
        const f = ret(-14, -8.5, 28, 17, 3)
        sombraNoChao(g, f, 2, 2.5)
        pintar(g, f, 'madeiraEscura', { luz: 1.2 })
        for (const x of [-8, 8]) pintar(g, ret(x - 1.6, -8.5, 3.2, 17, 0.6), 'metal', { luz: 0, contorno: 0.9 })
        pintar(g, ret(-2.4, 3.6, 4.8, 4.6, 1), 'amarelo', { luz: 0, contorno: 1 })
      },
    },
    fogueira: {
      caixa: () => [-17, -17, 17, 17],
      pintar(g) {
        g.fillStyle = tinta(tons('fogo').base, 0.14)
        g.fill(circulo(0, 0, 16.5))
        for (let i = 0; i < 9; i += 1) {
          const a = (i / 9) * TAU + 0.3
          pintar(g, elipse(Math.cos(a) * 11.5, Math.sin(a) * 11.5, 3.4, 2.8, a), 'pedra', { luz: 0.9, contorno: 1.1 })
        }
        for (const a of [0.5, 2.6, 4.7]) pintar(g, capsula(Math.cos(a) * -7, Math.sin(a) * -7, Math.cos(a) * 7, Math.sin(a) * 7, 2.4), 'madeiraEscura', { luz: 0.9, contorno: 1.1 })
        pintar(g, chama(0, 0, 7.5), 'fogo', { luz: 0, contorno: 1.2 })
        g.fillStyle = tons('amarelo').base
        g.fill(chama(0.5, 0.6, 3.8))
      },
    },
    tronco: {
      caixa: (p) => {
        const h = p.comp / 2 + 6
        return [-h, -h, h, h]
      },
      pintar(g, p) {
        const h = p.comp / 2
        const f = capsula(-h, 0, h, 0, 5.2)
        sombraGirada(g, p.ang || 0, f)
        g.save()
        g.rotate(p.ang || 0)
        pintar(g, f, 'madeiraEscura', { luz: 1.2 })
        tracos(g, tons('madeiraEscura').linha, 0.9, (q) => {
          q.moveTo(-h + 4, -1.6)
          q.lineTo(h - 9, -1.9)
          q.moveTo(-h + 8, 1.9)
          q.lineTo(h - 7, 1.6)
        })
        pintar(g, elipse(h - 0.6, 0, 2.6, 4.4), 'madeiraClara', { luz: 0, contorno: 1 })
        g.restore()
      },
    },
    carroca: {
      caixa: () => [-56, -20, 36, 20],
      pintar(g) {
        sombraNoChao(g, ret(-27, -18, 58, 36, 2), 3, 3.5)
        for (const k of [-1, 1]) pintar(g, ret(-53, k * 4 - 1.2, 28, 2.4, 1), 'madeiraEscura', { luz: 0, contorno: 1 })
        pintar(g, ret(-55, -5.5, 3, 11, 1), 'madeiraEscura', { luz: 0, contorno: 1 })
        for (const y of [-17.8, 13.8]) {
          pintar(g, ret(-8, y, 18, 4, 1.6), 'madeiraEscura', { luz: 0.8 })
          tracos(g, tons('metal').base, 1, (q) => {
            q.moveTo(-7, y + 2)
            q.lineTo(9, y + 2)
          })
        }
        const corpo = ret(-27, -14, 58, 28, 2)
        pintar(g, corpo, 'madeira', { luz: 1.3 })
        dentro(g, corpo, () => tracos(g, tons('madeira').linha, 1, (q) => {
          for (const y of [-7, 0, 7]) {
            q.moveTo(-27, y)
            q.lineTo(31, y)
          }
        }))
        pintar(g, elipse(-12, -3.5, 8.5, 6.2, 0.3), 'papel', { luz: 1.3 })
        pintar(g, elipse(-3, 5.5, 8, 5.8, -0.2), 'papel', { luz: 1.3 })
        pintar(g, circulo(17, -1, 7.6), 'madeira', { luz: 1.2 })
        g.lineWidth = 1.4
        g.strokeStyle = tons('metal').base
        g.stroke(circulo(17, -1, 5.8))
      },
    },
    lampiao: {
      caixa: () => [-22, -22, 22, 22],
      pintar(g) {
        g.fillStyle = tinta(tons('amarelo').base, 0.12)
        g.fill(circulo(0, 0, 18))
        sombraNoChao(g, ret(-6.4, -6.4, 12.8, 12.8, 2), 3, 4)
        pintar(g, ret(-6.4, -6.4, 12.8, 12.8, 2), 'metal', { luz: 1 })
        pintar(g, ret(-4, -4, 8, 8, 1.4), 'amarelo', { luz: 0, contorno: 1 })
        pintar(g, circulo(0, 0, 2), 'metal', { luz: 0, contorno: 0.9 })
      },
    },
    quadro: {
      caixa: () => [-22, -14, 22, 13],
      pintar(g) {
        sombraNoChao(g, ret(-19, -10, 38, 18, 2), 2.5, 3)
        for (const sx of [-1, 1]) pintar(g, ret(sx * 15 - 1.8, 6, 3.6, 5.5, 0.8), 'madeiraEscura', { luz: 0, contorno: 1 })
        pintar(g, ret(-18.5, -8.5, 37, 16, 2), 'madeira', { luz: 1.2 })
        const papeis = [[[-14.5, -5.5], [-6, -6], [-5.5, 4.6], [-14, 5]], [[-4, -4.6], [4.4, -5], [4.8, 5.4], [-3.6, 5.2]], [[6.4, -5.6], [14.4, -4.6], [14, 3.4], [6.6, 3]]]
        papeis.forEach((pp, i) => pintar(g, poligono(pp), 'papel', { luz: 0.7, contorno: 1 }))
        ;[['rosa', -10, -4], ['violeta', 0.4, -3.4], ['laranja', 10.4, -3.6]].forEach(([cor, x, y]) => pintar(g, circulo(x, y, 1.2), cor, { luz: 0, contorno: 0.8 }))
        pintar(g, ret(-21, -12.5, 42, 4.6, 1.5), 'madeiraEscura', { luz: 0.8 })
      },
    },
    vaso: {
      caixa: () => [-9.5, -9.5, 9.5, 9.5],
      pintar(g, p) {
        const s = sementeDe(p)
        sombraNoChao(g, circulo(0, 0, 7.6), 2, 2.4)
        pintar(g, circulo(0, 0, 7.6), 'telhaTerracota', { luz: 1.2 })
        g.fillStyle = tons('madeiraEscura').sombra
        g.fill(circulo(0, 0, 5.6))
        const lobos = []
        for (let i = 0; i < 5; i += 1) {
          const a = (i / 5) * TAU + 0.4
          lobos.push({ x: Math.cos(a) * 2.5, y: Math.sin(a) * 2.5, r: 3, luz: i === 3 })
        }
        lobos.push({ x: -0.5, y: -0.5, r: 3, luz: true })
        folhagem(g, lobos.sort(ordemDaLuz), 'folha', { contorno: 1.4 })
        florzinha(g, 1.6, -1.2, ['rosa', 'amarelo', 'violeta', 'branco'][s % 4], 1.4)
      },
    },
    arvore: {
      caixa: (p) => [-p.R * 1.15, -p.R * 1.15, p.R * 1.3, p.R * 1.35],
      pintar(g, p) {
        const R = p.R
        const sm = p.semente
        g.fillStyle = sombraDoChao(0.2)
        g.fill(elipse(R * 0.2, R * 0.26, R * 0.98, R * 0.92))
        const lobos = []
        for (let i = 0; i < 7; i += 1) {
          const a = (i / 7) * TAU + hash(sm, i, 11) * 0.7
          const d = R * (0.44 + 0.1 * hash(sm, i, 12))
          lobos.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r: R * (0.46 + 0.1 * hash(sm, i, 13)), luz: true })
        }
        lobos.push({ x: -R * 0.06, y: -R * 0.08, r: R * 0.58, luz: true })
        folhagem(g, lobos.sort(ordemDaLuz), sm % 3 === 0 ? 'folhaEscura' : 'folha')
        if (hash(sm, 7, 14) < 0.4) {
          const cor = hash(sm, 8, 14) < 0.5 ? 'rosa' : 'branco'
          for (let i = 0; i < 5; i += 1) {
            const a = hash(sm, 20 + i, 14) * TAU
            const d = R * (0.2 + 0.55 * hash(sm, 30 + i, 14))
            florzinha(g, Math.cos(a) * d, Math.sin(a) * d, cor, 1.3)
          }
        }
      },
    },
    placa: {
      caixa: () => [-25, -25, 25, 25],
      pintar(g, p) {
        const flecha = poligono([[-6, -4.8], [15, -4.8], [21, 0], [15, 4.8], [-6, 4.8]])
        sombraGirada(g, p.ang, flecha, 3, 4)
        g.save()
        g.rotate(p.ang)
        pintar(g, flecha, 'madeiraClara', { luz: 1 })
        tracos(g, tons('madeiraClara').linha, 1, (q) => {
          q.moveTo(-3, 0)
          q.lineTo(14, 0)
        })
        g.restore()
        pintar(g, circulo(0, 0, 2.6), 'madeiraEscura', { luz: 0, contorno: 1 })
      },
    },
    sebe: {
      caixa: (p) => {
        const h = p.comp / 2 + 10
        return p.vertical ? [-11, -h, 11, h] : [-h, -11, h, 11]
      },
      pintar(g, p) {
        const n = Math.max(2, Math.round(p.comp / 8))
        const h = p.comp / 2
        const lobos = []
        for (let i = 0; i <= n; i += 1) {
          const t = -h + (p.comp * i) / n
          const j = (hash(i, p.semente, 17) - 0.5) * 2.4
          const r = 6 + hash(i, p.semente, 18) * 2.2
          const luz = hash(i, p.semente, 19) < 0.6
          lobos.push(p.vertical ? { x: j, y: t, r, luz } : { x: t, y: j, r, luz })
        }
        const uniao = new Path2D()
        for (const l of lobos) uniao.addPath(circulo(l.x, l.y, l.r))
        sombraNoChao(g, uniao, 2.5, 3)
        folhagem(g, lobos.sort(ordemDaLuz), 'folhaEscura')
        lobos.forEach((l, i) => {
          if (hash(i, p.semente, 21) < 0.3) florzinha(g, l.x + 1, l.y - 1, ['branco', 'rosa', 'amarelo'][i % 3], 1.3)
        })
      },
    },
    arco: {
      caixa: () => [-42, -8, 42, 14],
      pintar(g) {
        sombraNoChao(g, ret(-40, -3.2, 80, 6.4, 2), 3, 5)
        for (const sx of [-34, 34]) pintar(g, ret(sx - 4, -4, 8, 8, 1.5), 'madeiraEscura', { luz: 1 })
        pintar(g, ret(-40, -3.2, 80, 6.4, 2), 'madeira', { luz: 1.1 })
        tracos(g, tons('metal').base, 1, (q) => {
          q.moveTo(-8, 2)
          q.lineTo(-8, 4)
          q.moveTo(8, 2)
          q.lineTo(8, 4)
        })
        pintar(g, ret(-13, 3.5, 26, 10, 2.5), 'madeiraClara', { luz: 1 })
        florzinha(g, 0, 8.5, 'rosa', 1.6)
      },
    },
    jardineira: {
      caixa: () => [-16, -8, 16, 8],
      pintar(g) {
        const f = ret(-15, -6, 30, 12, 2)
        sombraNoChao(g, f, 2, 2.5)
        pintar(g, f, 'madeira', { luz: 1 })
        g.fillStyle = tons('madeiraEscura').sombra
        g.fill(ret(-12.5, -3.6, 25, 7.2, 1.5))
        for (let i = 0; i < 7; i += 1) pintar(g, circulo(-10.5 + i * 3.5, i % 2 ? 1.2 : -1.2, 2.1), i === 3 ? 'amarelo' : 'laranja', { luz: 0.6, contorno: 0.9 })
      },
    },
    // ---- de dentro das casas (mesmos tipos e tamanhos de vila.js) ----
    mesa: {
      caixa: (p) => [-p.w / 2 - 1, -p.h / 2 - 1, p.w / 2 + 1, p.h / 2 + 1],
      pintar(g, p) {
        const f = ret(-p.w / 2, -p.h / 2, p.w, p.h, 3)
        sombraNoChao(g, f, 2, 2.5)
        pintar(g, f, 'madeira', { luz: 1.2 })
        dentro(g, f, () => tracos(g, tons('madeira').linha, 1, (q) => {
          q.moveTo(-p.w / 2, -p.h / 6)
          q.lineTo(p.w / 2, -p.h / 6)
          q.moveTo(-p.w / 2, p.h / 6)
          q.lineTo(p.w / 2, p.h / 6)
        }))
        pintar(g, circulo(-p.w * 0.22, 0, 3.2), 'branco', { luz: 0.6, contorno: 1 })
        pintar(g, circulo(p.w * 0.2, -1, 2.4), 'pedra', { luz: 0.6, contorno: 1 })
      },
    },
    cadeira: {
      caixa: () => [-7.5, -7.5, 7.5, 7.5],
      pintar(g) {
        const f = ret(-7, -7, 14, 14, 2.5)
        sombraNoChao(g, f, 1.5, 2)
        pintar(g, f, 'madeiraClara', { luz: 1 })
        pintar(g, ret(-7, -7, 14, 3.4, 1.2), 'madeira', { luz: 0, contorno: 1 })
      },
    },
    aparador: {
      caixa: (p) => [-p.w / 2 - 1, -p.h / 2 - 1, p.w / 2 + 1, p.h / 2 + 1],
      pintar(g, p) {
        const f = ret(-p.w / 2, -p.h / 2, p.w, p.h, 2)
        sombraNoChao(g, f, 2, 2.5)
        pintar(g, f, 'madeiraEscura', { luz: 1 })
        pintar(g, circulo(-p.w * 0.25, 0, 3), 'agua', { luz: 0.6, contorno: 1 })
        pintar(g, circulo(p.w * 0.05, 0, 2.6), 'rosa', { luz: 0.6, contorno: 1 })
        pintar(g, ret(p.w * 0.2, -3, 8, 6, 1), 'papel', { luz: 0.5, contorno: 1 })
      },
    },
    armario: {
      caixa: (p) => [-p.w / 2 - 1, -p.h / 2 - 1, p.w / 2 + 1, p.h / 2 + 1],
      pintar(g, p) {
        const f = ret(-p.w / 2, -p.h / 2, p.w, p.h, 2)
        sombraNoChao(g, f, 2, 2.5)
        pintar(g, f, 'madeiraEscura', { luz: 1 })
        tracos(g, tons('madeiraEscura').linha, 1, (q) => {
          q.moveTo(0, -p.h / 2 + 2)
          q.lineTo(0, p.h / 2 - 2)
        })
        g.fillStyle = tons('amarelo').base
        g.fill(circulo(-2, 0, 1))
        g.fill(circulo(2, 0, 1))
      },
    },
    tapete: {
      caixa: (p) => [-p.w / 2 - 1, -p.h / 2 - 1, p.w / 2 + 1, p.h / 2 + 1],
      pintar(g, p) {
        pintar(g, ret(-p.w / 2, -p.h / 2, p.w, p.h, 4), 'telhaTerracota', { luz: 0, contorno: 1.4 })
        g.lineWidth = 1.4
        g.strokeStyle = tons('amarelo').base
        g.stroke(ret(-p.w / 2 + 5, -p.h / 2 + 5, p.w - 10, p.h - 10, 2))
        g.fillStyle = tons('reboco').base
        for (let x = -p.w / 2 + 14; x < p.w / 2 - 10; x += 14) g.fill(poligono([[x, -3], [x + 3, 0], [x, 3], [x - 3, 0]]))
      },
    },
    cerca: {
      caixa: (p) => [-p.w / 2 - 1, -p.h / 2 - 1, p.w / 2 + 1, p.h / 2 + 1],
      pintar(g, p) {
        for (const y of [-2.2, 1.2]) pintar(g, ret(-p.w / 2, y, p.w, 1.8, 0.6), 'madeira', { luz: 0, contorno: 0.9 })
        for (const x of [-p.w / 2 + 2.5, 0, p.w / 2 - 2.5]) pintar(g, ret(x - 2.5, -3.5, 5, 7, 1), 'madeiraEscura', { luz: 0.6, contorno: 1 })
      },
    },
  }

  const guardadas = new Map()
  function chaveDaPeca(p) {
    return [p.t, p.w || '', p.h || '', p.vertical ? 'v' : '', p.tecido || '', p.R || '', sementeDe(p), p.ang ?? '', p.comp || '', p.col ? `${p.col.w || ''}x${p.col.h || ''}` : ''].join('|')
  }
  /** A imagem da peça na resolução S (1 ou 2 px por px do mapa), no formato de vila.js. */
  function imagemDaPeca(p, S) {
    const chave = chaveDaPeca(p) + '@' + S
    const pronta = guardadas.get(chave)
    if (pronta) return pronta
    const d = DESENHOS[p.t]
    if (!d) throw new Error('peça sem pintor no Estilo Mother: ' + p.t)
    const cx = d.caixa(p)
    const x0 = Math.floor(cx[0] - 2)
    const y0 = Math.floor(cx[1] - 2)
    const W = Math.max(1, Math.ceil((cx[2] + 6 - x0) * S))
    const H = Math.max(1, Math.ceil((cx[3] + 6 - y0) * S))
    const cv = canvasDe(W, H)
    const g = cv.getContext('2d')
    g.setTransform(S, 0, 0, S, -x0 * S, -y0 * S)
    g.lineJoin = 'round'
    g.lineCap = 'round'
    d.pintar(g, p)
    const img = { canvas: cv, S, ox: x0, oy: y0, largura: W / S, altura: H / S, pecas: cx }
    guardadas.set(chave, img)
    return img
  }
  const temImagem = (p, S) => guardadas.has(chaveDaPeca(p) + '@' + S)

  // ---------- porta, placa, pino e marcas (desenhados por cima, a cada quadro) ----------

  const corDaFolha = () => tons('madeiraEscura').base

  /**
   * Porta e placa vão por cima do telhado a cada quadro; desenhadas uma vez por casa e resolução,
   * o quadro só cola 7 imagens (com clip e traço por quadro, o desenho do mapa passava de 20 ms).
   */
  const portas = new Map()
  function desenharPortaEPlaca(ctx, c, desenharIcone) {
    const k = api.S
    const chave = c.id + '@' + k
    let img = portas.get(chave)
    if (!img) {
      const [px, py] = c.porta
      const [sx, sy] = V.centroDaPlaca(c)
      const [tx, ty] = V.pontoDaPorta(c, 31 * c.placa, -5)
      const x0 = Math.floor(Math.min(px - 24, sx - 14, tx - 3))
      const y0 = Math.floor(Math.min(py - 24, sy - 14, ty - 3))
      const x1 = Math.ceil(Math.max(px + 24, sx + 14, tx + 3))
      const y1 = Math.ceil(Math.max(py + 24, sy + 14, ty + 3))
      const cv = canvasDe(Math.ceil((x1 - x0) * k), Math.ceil((y1 - y0) * k))
      const g = cv.getContext('2d')
      g.setTransform(k, 0, 0, k, -x0 * k, -y0 * k)
      pintarPortaEPlaca(g, c, desenharIcone)
      img = { canvas: cv, x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
      portas.set(chave, img)
    }
    ctx.drawImage(img.canvas, img.x, img.y, img.w, img.h)
  }

  /** Porta em arco no beiral (36 x 24 px, como na Textura): degrau de pedra, batente escuro, folha de tábua. */
  function pintarPortaEPlaca(ctx, c, desenharIcone) {
    ctx.save()
    ctx.translate(c.porta[0], c.porta[1])
    ctx.rotate(c.angulo)
    ctx.lineJoin = 'round'
    pintar(ctx, ret(-18, 7.5, 36, 8, 2.4), 'pedra', { luz: 1, contorno: 1.3 })
    const folhaT = tons('madeiraEscura')
    ctx.fillStyle = folhaT.contorno
    ctx.fill(ret(-16, -9, 32, 18, [7, 7, 1.6, 1.6]))
    const folha = ret(-12.5, -6.5, 25, 15, [5, 5, 1, 1])
    pintar(ctx, folha, 'madeiraEscura', { luz: 1, contorno: 0 })
    dentro(ctx, folha, () => tracos(ctx, folhaT.linha, 1, (q) => {
      q.moveTo(-4.6, -7)
      q.lineTo(-4.6, 9)
      q.moveTo(4.4, -7)
      q.lineTo(4.4, 9)
    }))
    pintar(ctx, circulo(8, 1.6, 1.6), 'amarelo', { luz: 0, contorno: 0.9 })
    ctx.restore()
    // placa de madeira presa por um suporte, com o ícone da função
    const [x, y] = V.centroDaPlaca(c)
    const suporte = V.pontoDaPorta(c, 31 * c.placa, -5)
    tracos(ctx, tons('metal').base, 1.6, (q) => {
      q.moveTo(suporte[0], suporte[1])
      q.lineTo(x, y)
    })
    ctx.save()
    ctx.fillStyle = sombraDoChao(0.28)
    ctx.fill(ret(x - 10.5 + 1.6, y - 10 + 2, 21, 20, 4))
    pintar(ctx, ret(x - 10.5, y - 10, 21, 20, 4), 'madeiraClara', { luz: 1.1, contorno: 1.5 })
    ctx.translate(x - 7, y - 7)
    ctx.scale(14 / 16, 14 / 16)
    desenharIcone(ctx, c.icone, tons('madeira').contorno, tons('madeiraClara').base)
    ctx.restore()
  }

  function desenharPino(ctx, x, y) {
    const tinta1 = tons('madeira').contorno
    ctx.fillStyle = sombraDoChao(0.32)
    ctx.beginPath()
    ctx.ellipse(x + 2.5, y + 3, 12, 11, 0, 0, TAU)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(x, y, 12, 0, TAU)
    ctx.fillStyle = tons('reboco').base
    ctx.fill()
    ctx.lineWidth = 1.8
    ctx.strokeStyle = tinta1
    ctx.stroke()
    ctx.fillStyle = tinta1
    ctx.beginPath()
    ctx.arc(x, y - 3.6, 2.9, 0, TAU)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(x - 6, y + 6.4)
    ctx.quadraticCurveTo(x, y - 3, x + 6, y + 6.4)
    ctx.closePath()
    ctx.fill()
  }

  function desenharDestino(ctx, x, y) {
    const cor = tinta(tons('madeira').contorno, 0.85)
    ctx.beginPath()
    ctx.arc(x, y, 7, 0, TAU)
    ctx.lineWidth = 2
    ctx.strokeStyle = cor
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x, y, 2, 0, TAU)
    ctx.fillStyle = cor
    ctx.fill()
  }

  // ---------- trabalho em segundo plano (a fila é a de pagina.js) ----------

  function prepararLadrilhos(k) {
    ladrilhoDaPraca(k)
    montarCenario()
  }

  function pedirNitidez(enfileirar) {
    if (api.S >= 2) return
    EXTERNAS.forEach((p, i) => {
      if (!temImagem(p, 2)) enfileirar('m2:' + i, () => imagemDaPeca(p, 2))
    })
    V.PECAS_DE_DENTRO.forEach((p, i) => {
      if (!temImagem(p, 2)) enfileirar('md2:' + i, () => imagemDaPeca(p, 2))
    })
    for (const c of V.CASAS) enfileirar('mt2:' + c.id, () => imagemDoTelhado(c, 2))
    enfileirar('mt2:pronto', () => {
      api.telhados2 = true
    })
    enfileirar('ml2', () => ladrilhoDaPraca(2))
    enfileirar('mc2', () => chao(2))
    enfileirar('mS2', () => {
      api.S = 2
    })
  }

  /** Para a prova: todas as cores que a paleta gera (base, realce, sombra, contorno, linha). */
  function tonsDaPaleta() {
    return Object.keys(PALETA).map((nome) => ({ nome, ...tons(nome), lumContorno: luminancia(tons(nome).contorno) }))
  }

  return Object.assign(api, {
    PALETA, PISO_DO_CONTORNO, ESTRADAS, BARRANCO, SEBES, PECAS, ARCO, EXTERNAS, ARVORES_DE_FORA, RAIO_DA_ILHA, TELHADOS,
    FUNDO: tons('grama').base,
    COR_DA_GRADE: tinta(tons('grama').contorno, 0.2),
    ROTULO: { fundo: tinta(tons('madeira').contorno, 0.9), texto: tons('reboco').base },
    tons, luminancia, tonsDaPaleta, corDaFolha, fisica, obstaculos, formasDasPecas, montarCenario,
    imagemDaPeca, temImagem, imagemDoTelhado, pintarSombraDaCasa, chao, chaoPronto, prepararLadrilhos, pedirNitidez,
    desenharPortaEPlaca, desenharPino, desenharDestino,
    tempoDoCenario: () => (cenario ? cenario.ms : null),
  })
})()
