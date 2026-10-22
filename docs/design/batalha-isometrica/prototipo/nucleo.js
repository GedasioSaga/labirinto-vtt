// nucleo.js — a parte do mapa de batalha que não desenha: os dois mapas, a projeção isométrica 2:1, a ordem de
// pintura, o clique (tela -> bloco), o alcance, a medição e o movimento das unidades no tempo.
// Roda no navegador e no Node: as provas usam exatamente este código.
// eslint-disable-next-line no-var, no-unused-vars
var Nucleo = (function () {
  'use strict'

  // ---------- medidas da projeção, em px no zoom 100% ----------
  const TW = 64
  const TH = 32
  /** Altura de um nível (um bloco de altura) na tela. */
  const LH = 24
  const ML = TW / 2
  const MA = TH / 2
  /** Ao longo do raio da câmera, u+v cresce K a cada nível subido. */
  const K = LH / MA
  /** O diorama desce até aqui (em níveis) na borda do mapa. */
  const FUNDO = -1.25
  /** A superfície da água fica um pouco abaixo do nível 0. */
  const AGUA_Z = -0.3
  const ZMAX = 4
  const MARGEM_TOPO = (ZMAX + 3.6) * LH
  const MARGEM_BAIXO = -FUNDO * LH + 14
  const DX = [1, 0, -1, 0]
  const DY = [0, 1, 0, -1]
  /** Os 8 vizinhos: primeiro os 4 retos, depois as diagonais (a ordem escolhe o caminho entre os empatados). */
  const D8 = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [-1, -1], [1, -1]]
  const MS_POR_BLOCO = 260
  const MS_DIAGONAL = 340

  // ---------- acaso determinístico ----------
  function rng(semente) {
    let a = semente >>> 0 || 1
    return function () {
      a = (a + 0x6d2b79f5) | 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }
  function hash(x, y, s) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul((s | 0) + 1013, 2246822519)
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
  function ruido(x, y, s) {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const fx = x - xi
    const fy = y - yi
    const sx = fx * fx * (3 - 2 * fx)
    const sy = fy * fy * (3 - 2 * fy)
    const a = hash(xi, yi, s)
    const b = hash(xi + 1, yi, s)
    const c = hash(xi, yi + 1, s)
    const d = hash(xi + 1, yi + 1, s)
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
  }
  function fbm(x, y, s, oitavas = 3) {
    let t = 0
    let a = 1
    let f = 1
    let n = 0
    for (let o = 0; o < oitavas; o++) {
      t += a * ruido(x * f, y * f, s + o * 17)
      n += a
      a *= 0.5
      f *= 2
    }
    return t / n
  }

  // ---------- tipos de unidade e de objeto ----------
  /** w e h: caixa do desenho em px no zoom 100% (dos pés para cima). mov: blocos por movimento. */
  const TIPOS = {
    aventureira: { nome: 'Aventureira', mov: 4, w: 40, h: 60 },
    mago: { nome: 'Mago', mov: 3, w: 40, h: 72 },
    arqueiro: { nome: 'Arqueiro', mov: 4, w: 42, h: 60 },
    curandeira: { nome: 'Curandeira', mov: 3, w: 40, h: 62 },
    ladino: { nome: 'Ladino', mov: 5, w: 40, h: 58 },
    guarda: { nome: 'Guarda', mov: 3, w: 44, h: 66 },
    lobo: { nome: 'Lobo', mov: 5, w: 52, h: 42 },
    golem: { nome: 'Golem', mov: 3, w: 54, h: 62 },
  }
  /** r: meio lado da pegada no chão (em blocos), usado para decidir quem fica na frente. luz: altura e alcance à noite. */
  const PROPS = {
    palmeira: { nome: 'palmeira', w: 108, h: 118, r: 0.3 },
    vasos: { nome: 'vasos', w: 50, h: 42, r: 0.42 },
    barril: { nome: 'barris', w: 40, h: 36, r: 0.4 },
    caixas: { nome: 'caixotes', w: 44, h: 38, r: 0.42 },
    banco: { nome: 'banco', w: 52, h: 26, r: 0.42 },
    toldo: { nome: 'banca de feira', w: 64, h: 72, r: 0.46 },
    poco: { nome: 'poço', w: 58, h: 66, r: 0.46 },
    lampiao: { nome: 'lampião', w: 24, h: 80, r: 0.2, luz: { z: 3, raio: 3.8, forca: 1 } },
    tocha: { nome: 'braseiro', w: 28, h: 50, r: 0.25, luz: { z: 1.9, raio: 3.2, forca: 0.95 } },
    coluna: { nome: 'coluna quebrada', w: 34, h: 74, r: 0.32 },
    entulho: { nome: 'entulho', w: 50, h: 24, r: 0.44 },
    arbusto: { nome: 'arbusto', w: 46, h: 30, r: 0.42 },
  }

  // ---------- montagem dos mapas ----------
  function novoMapa(id, nome, W, H, base) {
    const c = []
    for (let i = 0; i < W * H; i++) c.push({ h: base.h, topo: base.topo, lado: base.lado, escada: -1, predio: -1, agua: false, chao: base.h })
    return { id, nome, W, H, c, props: [], unidades: [], predios: [], portas: [], propEm: null, _cache: {} }
  }
  const dentro = (m, x, y) => x >= 0 && y >= 0 && x < m.W && y < m.H
  const cel = (m, x, y) => m.c[y * m.W + x]
  function ret(m, x0, y0, w, h, f) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (dentro(m, x, y)) f(cel(m, x, y), x, y)
  }
  function terreno(m, x0, y0, w, h, dados) {
    ret(m, x0, y0, w, h, (c) => {
      Object.assign(c, dados)
      if ('h' in dados) c.chao = dados.h
    })
  }
  function agua(m, x0, y0, w, h) {
    ret(m, x0, y0, w, h, (c) => Object.assign(c, { h: 0, chao: 0, topo: 'agua', lado: 'agua', agua: true, escada: -1, predio: -1 }))
  }
  /** Prédio de blocos: andares sobre o chão; portas = [x, y, direção do lado de fora]. */
  function predio(m, x0, y0, w, d, chao, andares, portas, lado = 'parede') {
    const id = m.predios.length
    m.predios.push({ id, x0, y0, w, d, chao, andares, lado })
    ret(m, x0, y0, w, d, (c) => Object.assign(c, { h: chao + andares, chao, topo: lado === 'ruina' ? 'ruina' : 'telhado', lado, predio: id, escada: -1, agua: false }))
    for (const [x, y, dir] of portas) m.portas.push({ predio: id, x, y, dir })
  }
  /** Escada: o bloco tem altura h e desce na direção dir (0 +x, 1 +y, 2 -x, 3 -y) até o vizinho de altura h - 1. */
  function escada(m, x, y, h, dir, lado = 'muro') {
    Object.assign(cel(m, x, y), { h, chao: h - 1, escada: dir, topo: 'degrau', lado, agua: false, predio: -1 })
  }
  function prop(m, tipo, x, y, extra = {}) {
    m.props.push({ id: 'p' + m.props.length, tipo, x, y, dir: 0, ...extra })
  }
  function unidade(m, tipo, lado, x, y, dir) {
    const n = m.unidades.filter((u) => u.tipo === tipo).length
    m.unidades.push({ id: tipo + (n ? n + 1 : ''), tipo, nome: TIPOS[tipo].nome, lado, x, y, dir, mov: TIPOS[tipo].mov, rastro: [] })
  }
  function fechar(m) {
    m.propEm = new Int32Array(m.W * m.H).fill(-1)
    m.props.forEach((p, k) => {
      const i = p.y * m.W + p.x
      if (m.propEm[i] >= 0) throw new Error(`${m.id}: dois objetos em ${p.x},${p.y}`)
      if (m.c[i].agua) throw new Error(`${m.id}: objeto na água em ${p.x},${p.y}`)
      m.propEm[i] = k
    })
    for (const u of m.unidades) {
      const i = u.y * m.W + u.x
      if (m.propEm[i] >= 0 || m.c[i].agua) throw new Error(`${m.id}: unidade ${u.id} em bloco impedido`)
    }
    return m
  }

  function vila() {
    const m = novoMapa('vila', 'Vila do deserto', 24, 24, { h: 1, topo: 'areia', lado: 'arenito' })
    // manchas de grama e terra batida na areia (sorteio fixo por posição)
    ret(m, 0, 0, 24, 24, (c, x, y) => {
      const n = fbm(x * 0.21 + 3.1, y * 0.21 + 7.7, 5)
      if (n > 0.62) c.topo = 'grama'
      else if (n < 0.3) c.topo = 'terra'
    })
    // rua de calçamento: a principal desce do alto (nível 2) por degraus; a transversal corta a vila
    terreno(m, 9, 0, 3, 24, { topo: 'calcada' })
    terreno(m, 0, 15, 24, 2, { topo: 'calcada' })
    terreno(m, 9, 0, 3, 6, { h: 2, lado: 'muro' })
    for (let x = 9; x <= 11; x++) escada(m, x, 6, 2, 1)
    // praça elevada com degraus
    terreno(m, 12, 7, 8, 7, { h: 2, topo: 'calcada', lado: 'muro' })
    terreno(m, 13, 8, 6, 5, { topo: 'laje' })
    escada(m, 12, 9, 2, 2)
    escada(m, 12, 10, 2, 2)
    escada(m, 15, 13, 2, 1)
    escada(m, 16, 13, 2, 1)
    // oásis com grama em volta
    terreno(m, 1, 9, 6, 6, { topo: 'grama' })
    agua(m, 2, 10, 4, 4)
    // casas de arenito
    predio(m, 1, 2, 6, 5, 1, 2, [[6, 5, 0], [3, 6, 1]])
    predio(m, 13, 1, 7, 5, 1, 3, [[16, 5, 1], [13, 3, 2]])
    predio(m, 20, 6, 4, 7, 1, 2, [[22, 12, 1], [21, 6, 3]])
    predio(m, 1, 18, 5, 5, 1, 2, [[5, 20, 0], [3, 18, 3]])
    predio(m, 14, 18, 5, 4, 1, 1, [[16, 21, 1], [18, 19, 0]])
    escada(m, 13, 19, 2, 2, 'parede')
    predio(m, 20, 18, 3, 3, 1, 3, [[20, 19, 2], [21, 20, 1]])
    // a calçada passa rente às portas
    terreno(m, 7, 5, 2, 1, { topo: 'calcada' })
    terreno(m, 16, 6, 1, 1, { topo: 'calcada' })
    // praça
    prop(m, 'poco', 16, 10)
    prop(m, 'vasos', 13, 8)
    prop(m, 'vasos', 19, 8, { variante: 1 })
    prop(m, 'palmeira', 18, 12)
    prop(m, 'palmeira', 13, 12, { variante: 1 })
    prop(m, 'banco', 14, 10, { dir: 1 })
    prop(m, 'lampiao', 12, 13)
    prop(m, 'lampiao', 12, 7)
    // feira entre a praça e a rua
    prop(m, 'toldo', 18, 14)
    prop(m, 'toldo', 20, 14, { variante: 1 })
    prop(m, 'caixas', 19, 14)
    prop(m, 'barril', 21, 14)
    // oásis
    prop(m, 'palmeira', 1, 10, { variante: 2 })
    prop(m, 'palmeira', 6, 13)
    prop(m, 'palmeira', 2, 14, { variante: 1 })
    prop(m, 'arbusto', 6, 9)
    // casas e ruas
    prop(m, 'tocha', 7, 4)
    prop(m, 'tocha', 15, 6)
    prop(m, 'tocha', 17, 6)
    prop(m, 'vasos', 6, 17)
    prop(m, 'barril', 7, 17)
    prop(m, 'lampiao', 8, 14)
    prop(m, 'lampiao', 12, 17)
    prop(m, 'palmeira', 7, 21, { variante: 2 })
    prop(m, 'palmeira', 19, 17)
    prop(m, 'banco', 12, 22, { dir: 0 })
    prop(m, 'vasos', 22, 22, { variante: 1 })
    prop(m, 'caixas', 23, 16)
    prop(m, 'arbusto', 0, 6)
    prop(m, 'barril', 8, 1)
    // unidades: quatro aliadas na rua de baixo, quatro inimigas na praça e no alto
    unidade(m, 'aventureira', 'aliado', 10, 19, 3)
    unidade(m, 'mago', 'aliado', 9, 21, 3)
    unidade(m, 'arqueiro', 'aliado', 11, 21, 3)
    unidade(m, 'curandeira', 'aliado', 10, 22, 3)
    unidade(m, 'guarda', 'inimigo', 15, 11, 1)
    unidade(m, 'ladino', 'inimigo', 17, 9, 1)
    unidade(m, 'lobo', 'inimigo', 10, 3, 1)
    unidade(m, 'golem', 'inimigo', 7, 12, 0)
    return fechar(m)
  }

  function baia() {
    const m = novoMapa('baia', 'Baía das ruínas', 24, 24, { h: 0, topo: 'agua', lado: 'agua' })
    agua(m, 0, 0, 24, 24)
    // planalto das ruínas (nível 3), terraço (2), praia (1), água (0)
    terreno(m, 0, 0, 14, 12, { h: 3, topo: 'pedra', lado: 'rocha', agua: false })
    terreno(m, 14, 0, 4, 12, { h: 1, topo: 'grama', lado: 'rocha', agua: false })
    terreno(m, 0, 12, 18, 5, { h: 2, topo: 'grama', lado: 'rocha', agua: false })
    terreno(m, 6, 17, 14, 3, { h: 1, topo: 'areia', lado: 'arenito', agua: false })
    terreno(m, 18, 0, 2, 17, { h: 1, topo: 'areia', lado: 'arenito', agua: false })
    agua(m, 14, 18, 3, 2)
    ret(m, 0, 0, 14, 12, (c, x, y) => {
      if (fbm(x * 0.3 + 11, y * 0.3 + 2, 9) > 0.6) c.topo = 'musgo'
    })
    ret(m, 0, 12, 18, 5, (c, x, y) => {
      if (fbm(x * 0.35, y * 0.35 + 40, 4) < 0.36) c.topo = 'terra'
    })
    // ilhotas de pedra
    terreno(m, 21, 5, 1, 1, { h: 1, topo: 'rocha', lado: 'rocha', agua: false })
    terreno(m, 22, 13, 2, 1, { h: 1, topo: 'rocha', lado: 'rocha', agua: false })
    terreno(m, 3, 21, 1, 1, { h: 1, topo: 'rocha', lado: 'rocha', agua: false })
    // muros e colunas de ruína (nível 4)
    predio(m, 2, 1, 7, 1, 3, 1, [[5, 1, 1]], 'ruina')
    predio(m, 1, 1, 1, 7, 3, 1, [[1, 4, 0]], 'ruina')
    predio(m, 10, 2, 3, 1, 3, 1, [], 'ruina')
    predio(m, 5, 5, 1, 1, 3, 1, [], 'ruina')
    predio(m, 9, 5, 1, 1, 3, 1, [], 'ruina')
    predio(m, 5, 9, 1, 1, 3, 1, [], 'ruina')
    // degraus
    escada(m, 6, 11, 3, 1, 'rocha')
    escada(m, 7, 11, 3, 1, 'rocha')
    // do planalto (3) ao patamar (1): dois degraus em fila, porque o desnível é de 2
    escada(m, 13, 6, 3, 0, 'rocha')
    escada(m, 14, 6, 2, 0, 'rocha')
    escada(m, 9, 16, 2, 1, 'rocha')
    escada(m, 10, 16, 2, 1, 'rocha')
    // objetos
    prop(m, 'vasos', 3, 3)
    prop(m, 'vasos', 12, 4, { variante: 1 })
    prop(m, 'coluna', 7, 7)
    prop(m, 'coluna', 11, 9, { variante: 1 })
    prop(m, 'entulho', 3, 9)
    prop(m, 'entulho', 11, 6, { variante: 1 })
    prop(m, 'tocha', 4, 6)
    prop(m, 'tocha', 10, 10)
    prop(m, 'tocha', 13, 1)
    prop(m, 'palmeira', 15, 2)
    prop(m, 'palmeira', 16, 11, { variante: 1 })
    prop(m, 'palmeira', 2, 14, { variante: 2 })
    prop(m, 'palmeira', 13, 15)
    prop(m, 'palmeira', 19, 4, { variante: 1 })
    prop(m, 'palmeira', 8, 19, { variante: 2 })
    prop(m, 'arbusto', 5, 13)
    prop(m, 'arbusto', 15, 14, { variante: 1 })
    prop(m, 'barril', 12, 18)
    prop(m, 'caixas', 13, 18)
    prop(m, 'lampiao', 18, 16)
    prop(m, 'lampiao', 7, 16)
    // unidades
    unidade(m, 'aventureira', 'aliado', 10, 18, 3)
    unidade(m, 'arqueiro', 'aliado', 11, 19, 3)
    unidade(m, 'mago', 'aliado', 16, 14, 3)
    unidade(m, 'curandeira', 'aliado', 9, 19, 3)
    unidade(m, 'guarda', 'inimigo', 7, 4, 1)
    unidade(m, 'golem', 'inimigo', 4, 8, 0)
    unidade(m, 'ladino', 'inimigo', 15, 6, 1)
    unidade(m, 'lobo', 'inimigo', 10, 8, 1)
    return fechar(m)
  }

  /** Mapa de n x n só para a prova de desempenho: relevo por ruído, casas, água, objetos e 16 unidades. */
  function mapaDeTeste(n = 30, semente = 7) {
    const m = novoMapa('teste' + n, `Teste ${n} x ${n}`, n, n, { h: 1, topo: 'grama', lado: 'rocha' })
    ret(m, 0, 0, n, n, (c, x, y) => {
      const r = fbm(x * 0.12, y * 0.12, semente, 3)
      c.h = c.chao = Math.max(0, Math.min(3, Math.floor(r * 5) - 1))
      c.topo = c.h >= 3 ? 'pedra' : c.h === 2 ? 'calcada' : r > 0.45 ? 'grama' : 'areia'
      if (c.h === 0) Object.assign(c, { topo: 'agua', lado: 'agua', agua: true })
    })
    const sorte = rng(semente)
    for (let k = 0; k < 6; k++) {
      const x = 2 + Math.floor(sorte() * (n - 8))
      const y = 2 + Math.floor(sorte() * (n - 8))
      const c = cel(m, x, y)
      if (c.agua) continue
      predio(m, x, y, 3, 3, c.h, 1, [[x + 2, y + 1, 0]])
    }
    const livres = []
    m.c.forEach((c, i) => { if (!c.agua && c.predio < 0) livres.push(i) })
    const usados = new Set()
    const pegar = () => {
      for (;;) {
        const i = livres[Math.floor(sorte() * livres.length)]
        if (!usados.has(i)) { usados.add(i); return [i % n, (i / n) | 0] }
      }
    }
    const tiposDeProp = ['palmeira', 'vasos', 'barril', 'lampiao', 'arbusto', 'tocha']
    for (let k = 0; k < 40; k++) { const [x, y] = pegar(); prop(m, tiposDeProp[k % tiposDeProp.length], x, y) }
    const tipos = Object.keys(TIPOS)
    for (let k = 0; k < 16; k++) { const [x, y] = pegar(); unidade(m, tipos[k % 8], k % 2 ? 'inimigo' : 'aliado', x, y, k % 4) }
    return fechar(m)
  }

  // ---------- giro da câmera ----------
  /** Ponto contínuo do mundo -> coordenadas giradas (u, v). Centro do bloco x é x + 0,5. */
  function girarP(px, py, rot, W, H) {
    switch (rot & 3) {
      case 0: return [px, py]
      case 1: return [H - py, px]
      case 2: return [W - px, H - py]
      default: return [py, W - px]
    }
  }
  function desgirarP(pu, pv, rot, W, H) {
    switch (rot & 3) {
      case 0: return [pu, pv]
      case 1: return [pv, H - pu]
      case 2: return [W - pu, H - pv]
      default: return [W - pv, pu]
    }
  }
  function girarC(x, y, rot, W, H) {
    const [u, v] = girarP(x + 0.5, y + 0.5, rot, W, H)
    return [Math.floor(u), Math.floor(v)]
  }
  /** Direção do mundo (0 +x, 1 +y, 2 -x, 3 -y) -> direção girada (0 +u, 1 +v, 2 -u, 3 -v). */
  const dirGirada = (d, rot) => (d + rot) & 3

  function metricas(m, rot) {
    const Wr = rot & 1 ? m.H : m.W
    const Hr = rot & 1 ? m.W : m.H
    return { rot, Wr, Hr, ox: Hr * ML, oy: MARGEM_TOPO, largura: (Wr + Hr) * ML, altura: Math.ceil(MARGEM_TOPO + (Wr + Hr) * MA + MARGEM_BAIXO) }
  }
  function proj(met, u, v, z) {
    return [met.ox + (u - v) * ML, met.oy + (u + v) * MA - z * LH]
  }
  /** Ponto da camada -> (u, v) no plano de altura z. */
  function desproj(met, lx, ly, z) {
    const a = (lx - met.ox) / ML
    const b = (ly - met.oy) / MA + z * K
    return [(a + b) / 2, (b - a) / 2]
  }

  // ---------- alturas ----------
  function topoZ(c) {
    return c.agua ? c.h + AGUA_Z : c.h
  }
  /** Altura dos pés de quem está no centro do bloco. Na escada, o degrau do meio. */
  function alturaEmPe(c) {
    if (c.agua) return c.h + AGUA_Z
    return c.escada >= 0 ? c.h - 0.5 : c.h
  }
  /** Altura do chão num ponto do mundo (contínuo): rampa na escada (os degraus têm o centro nela). */
  function alturaNoPonto(m, px, py) {
    const x = Math.min(m.W - 1, Math.max(0, Math.floor(px)))
    const y = Math.min(m.H - 1, Math.max(0, Math.floor(py)))
    const c = cel(m, x, y)
    if (c.escada < 0) return topoZ(c)
    const fx = px - x
    const fy = py - y
    const s = c.escada === 0 ? fx : c.escada === 1 ? fy : c.escada === 2 ? 1 - fx : 1 - fy
    return c.h - Math.min(1, Math.max(0, s))
  }
  /** Altura da borda de um bloco na direção d: o que conta para o degrau máximo entre dois vizinhos. */
  function bordaAltura(c, d) {
    if (c.escada < 0) return c.h
    if (d === c.escada) return c.h - 1
    if (d === ((c.escada + 2) & 3)) return c.h
    return c.h - 0.5
  }

  // ---------- geometria das colunas (caixas 3D no espaço girado) ----------
  /** Caixas de uma coluna, de trás para a frente. Bloco comum: 1 caixa; escada: 3 degraus. */
  function caixas(m, i, rot) {
    const c = m.c[i]
    const x = i % m.W
    const y = (i / m.W) | 0
    const [u, v] = girarC(x, y, rot, m.W, m.H)
    if (c.escada < 0) return [{ u0: u, u1: u + 1, v0: v, v1: v + 1, z: topoZ(c), k: -1 }]
    const dr = dirGirada(c.escada, rot)
    const out = []
    for (let k = 0; k < 3; k++) {
      const s0 = k / 3
      const s1 = (k + 1) / 3
      const z = c.h - (k + 0.5) / 3
      let b
      if (dr === 0) b = { u0: u + s0, u1: u + s1, v0: v, v1: v + 1 }
      else if (dr === 1) b = { u0: u, u1: u + 1, v0: v + s0, v1: v + s1 }
      else if (dr === 2) b = { u0: u + 1 - s1, u1: u + 1 - s0, v0: v, v1: v + 1 }
      else b = { u0: u, u1: u + 1, v0: v + 1 - s1, v1: v + 1 - s0 }
      out.push({ ...b, z, k, s0, s1 })
    }
    out.sort((a, b) => a.u0 + a.v0 - (b.u0 + b.v0))
    return out
  }
  /** Silhueta da caixa na tela (6 pontos, horário com y para baixo), descendo até o fundo do diorama. */
  function hexagono(met, b) {
    const p = (u, v, z) => proj(met, u, v, z)
    return [p(b.u0, b.v0, b.z), p(b.u1, b.v0, b.z), p(b.u1, b.v0, FUNDO), p(b.u1, b.v1, FUNDO), p(b.u0, b.v1, FUNDO), p(b.u0, b.v1, b.z)]
  }
  function dentroDoConvexo(pts, x, y) {
    const n = pts.length
    for (let k = 0; k < n; k++) {
      const a = pts[k]
      const b = pts[(k + 1) % n]
      if ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]) < -1e-9) return false
    }
    return true
  }

  /** Tudo o que depende só do mapa e do giro: ordem de pintura, caixas, silhuetas e retângulos. */
  function preparo(m, rot) {
    const r = rot & 3
    if (m._cache[r]) return m._cache[r]
    const met = metricas(m, r)
    const N = m.W * m.H
    const uv = new Int32Array(N * 2)
    const ordem = []
    for (let i = 0; i < N; i++) {
      const [u, v] = girarC(i % m.W, (i / m.W) | 0, r, m.W, m.H)
      uv[i * 2] = u
      uv[i * 2 + 1] = v
      ordem.push(i)
    }
    ordem.sort((a, b) => uv[a * 2] + uv[a * 2 + 1] - (uv[b * 2] + uv[b * 2 + 1]) || uv[a * 2] - uv[b * 2])
    const cx = []
    const hx = []
    const bb = new Float64Array(N * 4)
    const naCelula = new Int32Array(met.Wr * met.Hr)
    for (let i = 0; i < N; i++) {
      const cs = caixas(m, i, r)
      cx[i] = cs
      hx[i] = cs.map((b) => hexagono(met, b))
      let x0 = Infinity
      let y0 = Infinity
      let x1 = -Infinity
      let y1 = -Infinity
      for (const h of hx[i]) for (const [px, py] of h) { x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py) }
      bb.set([x0, y0, x1, y1], i * 4)
      naCelula[uv[i * 2 + 1] * met.Wr + uv[i * 2]] = i
    }
    const pos = new Int32Array(N)
    ordem.forEach((i, k) => { pos[i] = k })
    m._cache[r] = { met, ordem, pos, uv, caixas: cx, hex: hx, bb, naCelula }
    return m._cache[r]
  }

  // ---------- clique: tela -> bloco ----------
  /** O bloco que aparece no ponto da camada: a primeira coluna, de frente para trás, cuja silhueta contém o ponto. */
  function blocoNoPonto(m, rot, lx, ly) {
    const P = preparo(m, rot)
    for (let k = P.ordem.length - 1; k >= 0; k--) {
      const i = P.ordem[k]
      const o = i * 4
      if (lx < P.bb[o] || lx > P.bb[o + 2] || ly < P.bb[o + 1] || ly > P.bb[o + 3]) continue
      for (const h of P.hex[i]) if (dentroDoConvexo(h, lx, ly)) return i
    }
    return -1
  }
  /** Referência das provas: o raio da câmera. Devolve o z de entrada do raio na caixa (ou null). */
  function entradaNaCaixa(met, b, lx, ly) {
    const a = (lx - met.ox) / ML
    const b0 = (ly - met.oy) / MA
    let lo = FUNDO
    let hi = b.z
    lo = Math.max(lo, (2 * b.u0 - a - b0) / K, (2 * b.v0 + a - b0) / K)
    hi = Math.min(hi, (2 * b.u1 - a - b0) / K, (2 * b.v1 + a - b0) / K)
    return lo <= hi + 1e-12 ? hi : null
  }
  /** O bloco que o raio encontra primeiro. Com empates (ponto exatamente na aresta de dois blocos), devolve todos. */
  function raioNoPonto(m, rot, lx, ly, todosEmpatados = false) {
    const P = preparo(m, rot)
    let melhores = []
    let zMelhor = -Infinity
    for (let i = 0; i < m.c.length; i++) {
      const o = i * 4
      if (lx < P.bb[o] || lx > P.bb[o + 2] || ly < P.bb[o + 1] || ly > P.bb[o + 3]) continue
      for (const b of P.caixas[i]) {
        const z = entradaNaCaixa(P.met, b, lx, ly)
        if (z === null) continue
        if (z > zMelhor + 1e-9) { zMelhor = z; melhores = [i] } else if (z > zMelhor - 1e-9 && !melhores.includes(i)) melhores.push(i)
      }
    }
    if (todosEmpatados) return melhores
    return melhores.length ? melhores[0] : -1
  }
  /** Centro do topo do bloco (altura em pé) na camada. */
  function pontoDoBloco(m, rot, x, y) {
    const P = preparo(m, rot)
    const [u, v] = girarP(x + 0.5, y + 0.5, rot, m.W, m.H)
    return proj(P.met, u, v, alturaEmPe(cel(m, x, y)))
  }
  /** Ponto do mundo (contínuo, com altura) na camada. */
  function pontoDoMundo(m, rot, px, py, z) {
    const P = preparo(m, rot)
    const [u, v] = girarP(px, py, rot, m.W, m.H)
    return proj(P.met, u, v, z)
  }

  // ---------- objetos e quem fica na frente deles ----------
  /**
   * Colunas que ficam NA FRENTE de um objeto e cruzam o retângulo dele na tela. O pintor desenha o objeto e
   * repõe, por cima, a camada estática dentro da silhueta dessas colunas. ob: {pu, pv, r, ret:[x0,y0,x1,y1]}.
   */
  function ocludentes(m, rot, ob) {
    const P = preparo(m, rot)
    const { Wr, Hr } = P.met
    const out = []
    const u0 = Math.max(0, Math.floor(ob.pu - ob.r) - 1)
    const v0 = Math.max(0, Math.floor(ob.pv - ob.r) - 1)
    const u1 = Math.min(Wr - 1, Math.floor(ob.pu + ob.r) + 8)
    const v1 = Math.min(Hr - 1, Math.floor(ob.pv + ob.r) + 8)
    for (let v = v0; v <= v1; v++) {
      for (let u = u0; u <= u1; u++) {
        const debaixo = u < ob.pu + ob.r && u + 1 > ob.pu - ob.r && v < ob.pv + ob.r && v + 1 > ob.pv - ob.r
        if (debaixo) continue
        if (!(u >= ob.pu + ob.r - 1e-9 || v >= ob.pv + ob.r - 1e-9)) continue
        const i = P.naCelula[v * Wr + u]
        const o = i * 4
        if (P.bb[o] >= ob.ret[2] || P.bb[o + 2] <= ob.ret[0] || P.bb[o + 1] >= ob.ret[3] || P.bb[o + 3] <= ob.ret[1]) continue
        out.push(i)
      }
    }
    out.sort((a, b) => P.pos[a] - P.pos[b])
    return out
  }
  /** Caixa de desenho e pegada de um objeto no giro rot. pos: {x, y, z} contínuos do mundo (centro em x + 0,5). */
  function quadroDoObjeto(m, rot, pos, w, h, r) {
    const P = preparo(m, rot)
    const [pu, pv] = girarP(pos.x, pos.y, rot, m.W, m.H)
    const [sx, sy] = proj(P.met, pu, pv, pos.z)
    return { pu, pv, r, sx, sy, ret: [sx - w / 2, sy - h, sx + w / 2, sy + 3] }
  }
  function ordenarObjetos(lista) {
    return lista.sort((a, b) => a.pu + a.pv - (b.pu + b.pv) || a.pu - b.pu)
  }

  // ---------- regras de movimento ----------
  function livreDeTerreno(m, x, y) {
    if (!dentro(m, x, y)) return false
    const i = y * m.W + x
    return !m.c[i].agua && m.propEm[i] < 0
  }
  function passoReto(m, x, y, d, degrau) {
    const nx = x + DX[d]
    const ny = y + DY[d]
    if (!livreDeTerreno(m, nx, ny)) return false
    return Math.abs(bordaAltura(cel(m, x, y), d) - bordaAltura(cel(m, nx, ny), (d + 2) & 3)) <= degrau + 1e-9
  }
  const dirDe = (dx, dy) => (dx > 0 ? 0 : dx < 0 ? 2 : dy > 0 ? 1 : 3)
  /** Um passo de (x, y) para (x+dx, y+dy). Diagonal: os dois caminhos retos pelas quinas têm de valer (sem cortar quina). */
  function passo(m, x, y, dx, dy, degrau) {
    if (dx === 0 || dy === 0) return passoReto(m, x, y, dirDe(dx, dy), degrau)
    const dU = dx > 0 ? 0 : 2
    const dV = dy > 0 ? 1 : 3
    return passoReto(m, x, y, dU, degrau) && passoReto(m, x + dx, y, dV, degrau) && passoReto(m, x, y, dV, degrau) && passoReto(m, x, y + dy, dU, degrau)
  }
  function ocupadas(m, exceto) {
    const s = new Set()
    for (const u of m.unidades) if (u !== exceto) s.add(u.y * m.W + u.x)
    return s
  }
  /** Busca em largura: distância em blocos (diagonal = 1) até cada bloco alcançável, e de onde se veio. */
  function alcance(m, x0, y0, opts) {
    const N = m.W * m.H
    const mov = opts.mov ?? Infinity
    const degrau = opts.degrau ?? 1
    const ocup = opts.ocupadas || new Set()
    const dist = new Int16Array(N).fill(-1)
    const prev = new Int32Array(N).fill(-1)
    const i0 = y0 * m.W + x0
    dist[i0] = 0
    const fila = [i0]
    for (let q = 0; q < fila.length; q++) {
      const i = fila[q]
      if (dist[i] >= mov) continue
      const x = i % m.W
      const y = (i / m.W) | 0
      for (const [dx, dy] of D8) {
        const nx = x + dx
        const ny = y + dy
        if (!dentro(m, nx, ny)) continue
        const j = ny * m.W + nx
        if (dist[j] >= 0 || ocup.has(j)) continue
        if (!passo(m, x, y, dx, dy, degrau)) continue
        dist[j] = dist[i] + 1
        prev[j] = i
        fila.push(j)
      }
    }
    return { dist, prev, origem: i0 }
  }
  function caminhoAte(m, res, j) {
    if (res.dist[j] < 0) return null
    const out = []
    for (let i = j; i >= 0; i = res.prev[i]) {
      out.push([i % m.W, (i / m.W) | 0])
      if (i === res.origem) break
    }
    return out.reverse()
  }

  // ---------- movimento no tempo (andar e saltar) ----------
  /**
   * Plano de um caminho: um trecho por bloco. Andar quando as bordas se encontram na mesma altura (chão plano e
   * escada); saltar em arco quando há desnível. reduzido: sem agachar nem amortecer e com arco baixo.
   */
  function planoDeMovimento(m, caminho, opts = {}) {
    const segs = []
    let t = 0
    let andados = 0
    for (let k = 0; k + 1 < caminho.length; k++) {
      const [ax, ay] = caminho[k]
      const [bx, by] = caminho[k + 1]
      const dx = bx - ax
      const dy = by - ay
      const cA = cel(m, ax, ay)
      const cB = cel(m, bx, by)
      const za = alturaEmPe(cA)
      const zb = alturaEmPe(cB)
      const diag = dx !== 0 && dy !== 0
      let salto
      let borda = (za + zb) / 2
      if (!diag) {
        const d = dirDe(dx, dy)
        const eA = bordaAltura(cA, d)
        const eB = bordaAltura(cB, (d + 2) & 3)
        salto = Math.abs(eA - eB) > 0.01
        borda = eA
      } else {
        salto = cA.escada < 0 && cB.escada < 0 && Math.abs(za - zb) > 0.01
      }
      const base = { ax: ax + 0.5, ay: ay + 0.5, az: za, bx: bx + 0.5, by: by + 0.5, bz: zb, dir8: D8.findIndex(([px, py]) => px === dx && py === dy), t0: t, n: k }
      if (salto) {
        const dz = Math.abs(zb - za)
        const s = { ...base, tipo: 'salto', agacha: opts.reduzido ? 0 : 70, ar: Math.round(240 + 70 * dz), pousa: opts.reduzido ? 0 : 90, arco: opts.reduzido ? 0.12 : 0.35 + 0.3 * dz }
        s.dur = s.agacha + s.ar + s.pousa
        segs.push(s)
      } else {
        segs.push({ ...base, tipo: 'anda', diag, borda, dur: diag ? MS_DIAGONAL : MS_POR_BLOCO, passo0: andados })
        andados++
      }
      t += segs[segs.length - 1].dur
    }
    return { segs, total: t, caminho }
  }
  const lerp = (a, b, f) => a + (b - a) * f
  /** Estado da unidade no instante t do plano: posição contínua, altura dos pés, direção, pose e esticão. */
  function estadoNoTempo(plano, t) {
    const segs = plano.segs
    if (!segs.length || t >= plano.total) {
      const [x, y] = plano.caminho[plano.caminho.length - 1]
      const ult = segs[segs.length - 1]
      return { x: x + 0.5, y: y + 0.5, z: ult ? ult.bz : 0, dir8: ult ? ult.dir8 : 1, pose: 'parado', fase: 0, ex: 1, ey: 1, fim: true }
    }
    let s = segs[0]
    for (const q of segs) { if (t >= q.t0) s = q; else break }
    const l = Math.max(0, t - s.t0)
    if (s.tipo === 'anda') {
      const f = Math.min(1, l / s.dur)
      let z
      if (s.diag) z = lerp(s.az, s.bz, f)
      else z = f < 0.5 ? lerp(s.az, s.borda, f * 2) : lerp(s.borda, s.bz, (f - 0.5) * 2)
      return { x: lerp(s.ax, s.bx, f), y: lerp(s.ay, s.by, f), z, dir8: s.dir8, pose: 'anda', fase: (s.passo0 + f) % 1, ex: 1, ey: 1, fim: false }
    }
    if (l < s.agacha) {
      const p = Math.sin((l / s.agacha) * Math.PI * 0.5)
      return { x: s.ax, y: s.ay, z: s.az, dir8: s.dir8, pose: 'agacha', fase: 0, ex: 1 + 0.06 * p, ey: 1 - 0.1 * p, fim: false }
    }
    if (l < s.agacha + s.ar) {
      const f = (l - s.agacha) / s.ar
      const z = lerp(s.az, s.bz, f) + s.arco * 4 * f * (1 - f)
      const e = s.agacha ? 0.05 * Math.sin(f * Math.PI) : 0
      return { x: lerp(s.ax, s.bx, f), y: lerp(s.ay, s.by, f), z, dir8: s.dir8, pose: 'ar', fase: f, ex: 1 - e * 0.6, ey: 1 + e, fim: false }
    }
    const p = Math.sin(((l - s.agacha - s.ar) / Math.max(1, s.pousa)) * Math.PI)
    return { x: s.bx, y: s.by, z: s.bz, dir8: s.dir8, pose: 'pousa', fase: 0, ex: 1 + 0.07 * p, ey: 1 - 0.12 * p, fim: false }
  }
  /** Para onde a unidade olha na tela: frente (descendo) ou costas, e se espelha. */
  function vistaDaDirecao(dir8, rot) {
    const [dx, dy] = D8[dir8] || D8[1]
    // girarP com W = H = 0 é a rotação pura do vetor (sem translação)
    const [du, dv] = girarP(dx, dy, rot, 0, 0)
    const sx = du - dv
    const sy = du + dv
    const frente = sy > 0 || (sy === 0 && sx > 0)
    return { frente, espelho: frente ? sx > 0 : sx < 0 }
  }

  // ---------- medição ----------
  function regua(m, a, b) {
    const ca = cel(m, a[0], a[1])
    const cb = cel(m, b[0], b[1])
    return { blocos: Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])), desnivel: alturaEmPe(cb) - alturaEmPe(ca), reta: Math.hypot(b[0] - a[0], b[1] - a[1]) }
  }
  /** Círculo de raio r blocos: o centro do bloco a até r + 0,5 do centro (r = 1 dá 3 x 3; r = 2, 21 blocos). */
  function circulo(m, c, r) {
    const out = []
    const lim = (r + 0.5) * (r + 0.5) + 1e-9
    for (let y = c[1] - r; y <= c[1] + r; y++) for (let x = c[0] - r; x <= c[0] + r; x++) {
      if (dentro(m, x, y) && (x - c[0]) ** 2 + (y - c[1]) ** 2 <= lim) out.push([x, y])
    }
    return out
  }
  /** Cone saindo do bloco o, numa das 8 direções, com comprimento L: largura igual à distância (meio ângulo de 26,57°). */
  function cone(m, o, dir8, L) {
    const [dx, dy] = D8[dir8]
    const n = Math.hypot(dx, dy)
    const ux = dx / n
    const uy = dy / n
    const cosMin = Math.cos(Math.atan(0.5)) - 1e-9
    const lim = (L + 0.5) * (L + 0.5) + 1e-9
    const out = []
    for (let y = o[1] - L; y <= o[1] + L; y++) for (let x = o[0] - L; x <= o[0] + L; x++) {
      if (!dentro(m, x, y) || (x === o[0] && y === o[1])) continue
      const vx = x - o[0]
      const vy = y - o[1]
      const d2 = vx * vx + vy * vy
      if (d2 > lim) continue
      if ((vx * ux + vy * uy) / Math.sqrt(d2) >= cosMin) out.push([x, y])
    }
    return out
  }
  /** Direção (0..7 de D8) mais perto do vetor (vx, vy). */
  function direcao8(vx, vy) {
    if (!vx && !vy) return 0
    let melhor = 0
    let m = -Infinity
    D8.forEach(([dx, dy], k) => {
      const p = (vx * dx + vy * dy) / Math.hypot(dx, dy)
      if (p > m + 1e-9) { m = p; melhor = k }
    })
    return melhor
  }
  /**
   * Linha de visão do olho de quem está em a (altura em pé + olho) até o peito de b (altura em pé + alvo).
   * Anda pela linha em passos de 1/48 de bloco; se a linha passa abaixo do topo de um bloco no meio, está barrada.
   */
  function visao(m, a, b, opts = {}) {
    const olho = opts.olho ?? 1.5
    const alvo = opts.alvo ?? 1
    const za = alturaEmPe(cel(m, a[0], a[1])) + olho
    const zb = alturaEmPe(cel(m, b[0], b[1])) + alvo
    const ax = a[0] + 0.5
    const ay = a[1] + 0.5
    const bx = b[0] + 0.5
    const by = b[1] + 0.5
    const len = Math.hypot(bx - ax, by - ay)
    const n = Math.max(1, Math.ceil(len * 48))
    for (let k = 1; k < n; k++) {
      const f = k / n
      const px = lerp(ax, bx, f)
      const py = lerp(ay, by, f)
      const x = Math.floor(px)
      const y = Math.floor(py)
      if ((x === a[0] && y === a[1]) || (x === b[0] && y === b[1])) continue
      const c = cel(m, x, y)
      const topo = c.agua ? topoZ(c) : alturaNoPonto(m, px, py)
      const zl = lerp(za, zb, f)
      if (zl < topo - 1e-9) {
        const tipo = c.predio >= 0 || c.lado === 'parede' || c.lado === 'ruina' ? 'parede' : 'desnível'
        return { livre: false, bloqueio: { x, y, h: c.h, tipo, zLinha: zl, f }, za, zb }
      }
    }
    return { livre: true, za, zb }
  }

  // ---------- câmera ----------
  function camadaParaTela(cam, lx, ly) {
    return [(lx - cam.cx) * cam.zoom + cam.w / 2, (ly - cam.cy) * cam.zoom + cam.h / 2]
  }
  function telaParaCamada(cam, sx, sy) {
    return [(sx - cam.w / 2) / cam.zoom + cam.cx, (sy - cam.h / 2) / cam.zoom + cam.cy]
  }

  return {
    TW, TH, LH, ML, MA, K, FUNDO, AGUA_Z, ZMAX, DX, DY, D8, MS_POR_BLOCO, MS_DIAGONAL, TIPOS, PROPS,
    rng, hash, ruido, fbm,
    vila, baia, mapaDeTeste, dentro, cel,
    girarP, desgirarP, girarC, dirGirada, metricas, proj, desproj,
    topoZ, alturaEmPe, alturaNoPonto, bordaAltura,
    caixas, hexagono, dentroDoConvexo, preparo, blocoNoPonto, entradaNaCaixa, raioNoPonto, pontoDoBloco, pontoDoMundo,
    ocludentes, quadroDoObjeto, ordenarObjetos,
    livreDeTerreno, passo, ocupadas, alcance, caminhoAte, planoDeMovimento, estadoNoTempo, vistaDaDirecao,
    regua, circulo, cone, direcao8, visao,
    camadaParaTela, telaParaCamada,
  }
})()
if (typeof module !== 'undefined') module.exports = Nucleo
