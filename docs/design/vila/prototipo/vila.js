/*
 * VILA — o mapa da vila desenhado pelo código, para comparar com o de hoje.
 *
 * Tudo aqui é determinístico: nenhum Math.random; todo sorteio é `hash`
 * (o mesmo de objetos.js). Mesma entrada, mesma imagem.
 *
 * Reuso, sem cópia:
 * - telhados: `pintarTelhado` do app (client/src/texturas/telhado.ts),
 *   empacotado pelo montar.cjs como `TelhadoLab`;
 * - móveis e peças: o pintor de objetos.js (protótipo dos objetos, 20/10),
 *   que o montar.cjs abre em `Objetos._i` (formas, materiais, `pintarCena`).
 *
 * Coordenadas em px do mapa. O print de hoje (1198 x 761) fica em 0..1198 x
 * 0..761; o mundo passa dele para caber o muro, a borda e as duas saídas.
 */
// eslint-disable-next-line no-var, no-unused-vars
var Vila = (function () {
  'use strict'

  const O = Objetos._i
  const { P, caixa, elipse, capsula, poligono, anel, pintarCena, MATERIAIS, contato, rgb, hash, ruido, SOMBRA_X, SOMBRA_Y, unir } = O
  const TAU = Math.PI * 2

  /** Px do mapa por quadrado da grade: o pino (24 px, como no print) ocupa um. */
  const G = 28
  const MUNDO = { x0: -160, y0: -150, x1: 1360, y1: 930 }
  MUNDO.w = MUNDO.x1 - MUNDO.x0
  MUNDO.h = MUNDO.y1 - MUNDO.y0
  /** O que a câmera enquadra ao abrir: o muro inteiro, quase o mesmo recorte do print. */
  const ENQUADRE = { x0: -58, y0: -60, x1: 1254, y1: 812 }
  const PRINT = { x0: 0, y0: 0, x1: 1198, y1: 761 }
  const CENTRO = [586, 395]
  const RAIO_DO_PINO = 11
  /** Centro de um quadrado, a 15 px de onde o pino está no print (504, 455). */
  const INICIO_DO_PINO = [518, 462]
  const VELOCIDADE = 160

  // ---------- as 7 casas: mesma ocupação e mesmas cores de telhado do print ----------

  /**
   * `ret` = parede (o telhado passa 8 px dela). `lado` = parede da porta;
   * `pos` = x (porta em N/S) ou y (porta em E/W) do centro da porta.
   * As 3 casas de baixo tinham a porta virada para fora da praça; aqui ela vai para o norte.
   */
  const CASAS = [
    { id: 'taverna', nome: 'Taverna', icone: 'caneca', ret: [80, 32, 434, 198], lado: 'S', pos: 248, modelo: 'telhas', cor: '#0b2b50', placa: 1, antes: [248, 197] },
    { id: 'guilda', nome: 'Casa da Guilda', icone: 'brasao', ret: [695, 8, 1036, 174], lado: 'S', pos: 827, modelo: 'telhas', cor: '#4a5868', placa: 1, antes: [827, 173] },
    { id: 'ferraria', nome: 'Ferraria', icone: 'bigorna', ret: [1047, 196, 1186, 406], lado: 'W', pos: 290, modelo: 'telhas', cor: '#35373b', placa: 1, antes: [1048, 290] },
    { id: 'boticario', nome: 'Boticário', icone: 'frasco', ret: [10, 242, 149, 430], lado: 'E', pos: 336, modelo: 'telhas', cor: '#8a5a46', placa: -1, antes: [148, 336] },
    { id: 'emporio', nome: 'Empório', icone: 'balanca', ret: [32, 608, 255, 740], lado: 'N', pos: 143, modelo: 'telhas', cor: '#35373b', placa: 1, antes: [75, 738] },
    { id: 'templo', nome: 'Templo', icone: 'sino', ret: [289, 566, 513, 740], lado: 'N', pos: 401, modelo: 'telhas', cor: '#606a50', placa: 1, antes: [397, 738] },
    { id: 'estabulo', nome: 'Estábulo', icone: 'ferradura', ret: [774, 570, 1178, 740], lado: 'N', pos: 848, modelo: 'madeira', cor: '#a3875f', placa: -1, antes: [848, 738] },
  ]
  /** Vão da porta na parede (o pino tem 22 px de largura) e o desenho em volta. */
  const VAO_DA_PORTA = 34
  const PORTA = { u0: -18, u1: 18, n0: -9, n1: 15 }

  for (const c of CASAS) {
    const [x0, y0, x1, y1] = c.ret
    const L = c.lado
    c.normal = L === 'S' ? [0, 1] : L === 'N' ? [0, -1] : L === 'E' ? [1, 0] : [-1, 0]
    c.eixo = L === 'S' || L === 'N' ? [1, 0] : [0, 1]
    c.porta = L === 'S' ? [c.pos, y1] : L === 'N' ? [c.pos, y0] : L === 'E' ? [x1, c.pos] : [x0, c.pos]
    c.angulo = L === 'S' ? 0 : L === 'N' ? Math.PI : L === 'E' ? -Math.PI / 2 : Math.PI / 2
    /** Onde o robô (e quem anda) tem de chegar: 26 px para dentro da porta. */
    c.dentro = [c.porta[0] - c.normal[0] * 26, c.porta[1] - c.normal[1] * 26]
    c.fora = [c.porta[0] + c.normal[0] * 30, c.porta[1] + c.normal[1] * 30]
    c.centro = [(x0 + x1) / 2, (y0 + y1) / 2]
    const lum = rgb(c.cor).reduce((a, b) => a + b, 0) / 765
    c.corDaFolha = lum > 0.45 ? '#5e4330' : '#a27a4a'
  }

  function pontoDaPorta(c, u, n) {
    return [c.porta[0] + c.eixo[0] * u + c.normal[0] * n, c.porta[1] + c.eixo[1] * u + c.normal[1] * n]
  }

  /** Caixa (em px do mapa) do desenho da porta: batente, folha e degrau. */
  function caixaDaPorta(c) {
    const a = pontoDaPorta(c, PORTA.u0, PORTA.n0)
    const b = pontoDaPorta(c, PORTA.u1, PORTA.n1)
    return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])]
  }

  /** Placa da fachada: 30 px ao lado da porta, por cima do beiral. */
  function centroDaPlaca(c) {
    return pontoDaPorta(c, 31 * c.placa, 5)
  }

  // ---------- muro, sebes, praça, caminhos, saídas ----------

  /** Dois trechos de muro: as aberturas são a trilha do norte (533..597) e o portão do sul (604..680). */
  const MURO = [
    [[533, -42], [-12, -42], [-40, -14], [-40, 764], [-12, 792], [604, 792]],
    [[680, 792], [1208, 792], [1236, 764], [1236, -14], [1208, -42], [597, -42]],
  ]
  const MEIA_LARGURA_DO_MURO = 4
  const PILARES = [[533, -42], [597, -42], [604, 792], [680, 792]]
  const SEBES = [
    [[-29, 452], [-29, 588]],
    [[1225, 424], [1225, 556]],
    [[352, -31], [508, -31]],
    [[300, 781], [496, 781]],
    [[800, 781], [1150, 781]],
  ]
  const MEIA_LARGURA_DA_SEBE = 7

  /** Contorno da praça (suavizado ao pintar). Passa por baixo das casas, que cobrem o resto. */
  const PRACA = [
    [120, 120], [430, 116], [478, 92], [524, 66], [612, 66], [662, 96], [700, 116], [1000, 110], [1096, 230], [1106, 360],
    [1096, 420], [1074, 470], [1050, 540], [1100, 604], [800, 636], [700, 606], [604, 618], [520, 606], [300, 622], [200, 640],
    [60, 640], [8, 600], [-6, 520], [6, 452], [58, 404], [58, 250],
  ]
  const RAIO_DO_ANEL = 66

  /** Estradas: pontos suavizados; `dentro` = de laje clara, `fora` = de terra, até a borda do mundo. */
  const ESTRADAS = [
    { nome: 'Estrada do Sul', largura: 44, dentro: [[586, 456], [598, 540], [634, 640], [642, 800]], fora: [[642, 786], [650, 842], [716, 898], [870, 950]], placa: [596, 846], seta: 0.55, fim: [860, 924] },
    { nome: 'Trilha do Bosque', largura: 32, dentro: [[586, 334], [580, 250], [567, 120], [565, -50]], fora: [[565, -36], [557, -96], [522, -170]], placa: [608, -98], seta: -1.85, fim: [528, -140] },
  ]

  /** Caminho de laje clara de cada porta até a praça: 2 quadrados de comprimento. */
  function caminhoDaPorta(c) {
    return [pontoDaPorta(c, 0, 12), pontoDaPorta(c, 0, 12 + 2 * G)]
  }
  const LARGURA_DO_CAMINHO = 26

  // ---------- peças da praça (31) e de dentro das casas ----------

  /**
   * `t` = tipo; `x`, `y` = centro; `col` = colisão (r = círculo, w/h = retângulo).
   * Os tipos de objetos.js (barril, caixa, baú, fogueira...) saem do pintor de lá;
   * os novos (poço, barraca, carroça...) são desenhados aqui com as mesmas formas e materiais.
   */
  const PECAS = [
    { t: 'poco', x: 586, y: 395, col: { r: 28 } },
    { t: 'banco', x: 500, y: 395, vertical: true, col: { w: 12, h: 42 } },
    { t: 'banco', x: 672, y: 395, vertical: true, col: { w: 12, h: 42 } },
    // feira (3 barracas) com caixas, barris e o baú
    { t: 'barraca', x: 62, y: 478, tecido: 'vinho', col: { w: 60, h: 56, dy: 4 } },
    { t: 'barraca', x: 226, y: 470, tecido: 'ocre', col: { w: 60, h: 56, dy: 4 } },
    { t: 'barraca', x: 306, y: 506, tecido: 'musgo', col: { w: 60, h: 56, dy: 4 } },
    { t: 'barril', x: 22, y: 532, col: { r: 10 } },
    { t: 'caixa', x: 102, y: 524, col: { w: 22, h: 22 } },
    { t: 'barril', x: 182, y: 520, col: { r: 10 } },
    { t: 'caixa', x: 268, y: 430, col: { w: 22, h: 22 } },
    { t: 'bau', x: 190, y: 432, col: { w: 28, h: 17 } },
    // canto da fogueira
    { t: 'fogueira', x: 1142, y: 490, col: { r: 14 } },
    { t: 'tronco', x: 1142, y: 452, ang: 0, comp: 40, col: { seg: [[-17, 0], [17, 0]], r: 5.5 } },
    { t: 'tronco', x: 1184, y: 500, ang: Math.PI / 2 - 0.25, comp: 36, col: { seg: [[0, -15], [0, 15]], r: 5.5 } },
    { t: 'carroca', x: 726, y: 526, col: { w: 64, h: 34, dx: 2 } },
    // lampiões, quadro de avisos e vasos
    { t: 'lampiao', x: 302, y: 230, col: { r: 5 } },
    { t: 'lampiao', x: 680, y: 452, col: { r: 5 } },
    { t: 'lampiao', x: 694, y: 606, col: { r: 5 } },
    { t: 'quadro', x: 940, y: 210, col: { w: 38, h: 12 } },
    { t: 'vaso', x: 216, y: 218, col: { r: 7.5 } },
    { t: 'vaso', x: 280, y: 218, col: { r: 7.5 } },
    { t: 'vaso', x: 795, y: 194, col: { r: 7.5 } },
    { t: 'vaso', x: 859, y: 194, col: { r: 7.5 } },
    // árvores nas bordas, dentro do muro
    { t: 'arvore', x: 10, y: 50, R: 22, semente: 1, col: { r: 12 } },
    { t: 'arvore', x: 14, y: 170, R: 19, semente: 2, col: { r: 10 } },
    { t: 'arvore', x: 478, y: 36, R: 22, semente: 3, col: { r: 12 } },
    { t: 'arvore', x: 656, y: 92, R: 20, semente: 4, col: { r: 11 } },
    { t: 'arvore', x: 1110, y: 64, R: 24, semente: 5, col: { r: 13 } },
    { t: 'arvore', x: 1192, y: 150, R: 19, semente: 6, col: { r: 10 } },
    { t: 'arvore', x: 556, y: 724, R: 21, semente: 7, col: { r: 11 } },
    { t: 'arvore', x: 734, y: 702, R: 19, semente: 8, col: { r: 10 } },
  ]

  /** Placas de direção, fora do muro (não contam como peça da praça). */
  const PLACAS = ESTRADAS.map((e) => ({ t: 'placa', x: e.placa[0], y: e.placa[1], ang: e.seta, col: { r: 4 } }))

  /** Linha de árvores fora do muro: espaçadas e sorteadas pelo hash, fora das estradas. */
  const ARVORES_DE_FORA = (() => {
    const lista = []
    const pontos = []
    for (let x = -120; x <= 1330; x += 64) pontos.push([x, -96], [x + 30, 884])
    for (let y = -40; y <= 840; y += 62) pontos.push([-104, y], [1300, y + 28])
    let i = 0
    for (const [bx, by] of pontos) {
      i += 1
      const x = bx + (hash(i, 1, 91) - 0.5) * 30
      const y = by + (hash(i, 2, 91) - 0.5) * 26
      const perto = ESTRADAS.some((e) => [...e.fora, ...e.dentro].some(([px, py]) => Math.hypot(px - x, py - y) < e.largura / 2 + 46))
      const perto2 = ESTRADAS.some((e) => Math.hypot(e.placa[0] - x, e.placa[1] - y) < 50)
      if (perto || perto2 || hash(i, 3, 91) < 0.12) continue
      // 3 tamanhos x 7 formas: 21 imagens para a linha inteira, em vez de uma por árvore
      const R = [22, 26, 30][Math.floor(hash(i, 4, 91) * 3)]
      lista.push({ t: 'arvore', x, y, R, semente: 100 + (i % 7), fora: true, col: { r: R * 0.55 } })
    }
    return lista
  })()

  /** Os móveis de dentro (tipos de objetos.js, tamanhos em px a 28 px por quadrado). */
  const M = (tipo, x, y, extra) => ({ t: tipo, x, y, movel: true, ...extra })
  const DENTRO = {
    taverna: [
      M('mesa', 150, 110), M('cadeira', 136, 86), M('cadeira', 164, 86), M('cadeira', 136, 134), M('cadeira', 164, 134),
      M('mesa', 340, 110), M('cadeira', 326, 86), M('cadeira', 354, 86), M('cadeira', 326, 134), M('cadeira', 354, 134),
      M('barril', 100, 52), M('barril', 122, 52), M('barril', 144, 52), M('aparador', 398, 46),
    ],
    guilda: [M('tapete', 865, 96, { plano: true }), M('mesa', 865, 50), M('cadeira', 851, 26), M('cadeira', 879, 26), M('bau', 728, 34), M('aparador', 990, 24), M('armario', 1010, 150)],
    ferraria: [M('fogueira', 1152, 230), M('mesa', 1140, 352), M('barril', 1166, 388), M('barril', 1144, 390), M('caixa', 1072, 222)],
    boticario: [M('armario', 38, 256), M('armario', 70, 256), M('mesa', 60, 336), M('cadeira', 60, 362), M('aparador', 68, 418)],
    emporio: [
      M('mesa', 143, 690), M('caixa', 58, 632), M('caixa', 58, 656), M('caixa', 82, 632), M('barril', 230, 632), M('barril', 230, 655),
      M('barril', 207, 632), M('caixa', 230, 716), M('barril', 56, 716),
    ],
    templo: [
      M('tapete', 401, 652, { plano: true }), M('mesa', 401, 712), { t: 'banco', x: 330, y: 640, col: { w: 44, h: 12 } }, { t: 'banco', x: 330, y: 674, col: { w: 44, h: 12 } },
      { t: 'banco', x: 472, y: 640, col: { w: 44, h: 12 } }, { t: 'banco', x: 472, y: 674, col: { w: 44, h: 12 } },
    ],
    estabulo: [M('cerca', 950, 664), M('cerca', 1006, 664), M('cerca', 1062, 664), M('cerca', 1118, 664), M('barril', 796, 716), M('caixa', 822, 716), M('caixa', 796, 692)],
  }
  const TAMANHO_DE_MOVEL = { barril: [20, 20], caixa: [22, 22], bau: [28, 17], mesa: [56, 28], cadeira: [14, 14], aparador: [56, 14], armario: [28, 14], fogueira: [28, 28], tapete: [84, 56], cerca: [56, 7], catre: [28, 56] }
  for (const [id, lista] of Object.entries(DENTRO)) {
    for (const m of lista) {
      m.casa = id
      if (m.movel) {
        const [w, h] = TAMANHO_DE_MOVEL[m.t]
        m.w = w
        m.h = h
        if (!m.plano) m.col = m.t === 'barril' ? { r: 9.5 } : { w: w - 2, h: h - 2 }
      }
    }
  }
  const PECAS_DE_DENTRO = Object.values(DENTRO).flat()
  // Na praça, barril, caixa, baú e fogueira também saem do pintor de objetos.js.
  for (const p of PECAS) {
    if (!TAMANHO_DE_MOVEL[p.t]) continue
    p.movel = true
    ;[p.w, p.h] = p.t === 'fogueira' ? [30, 30] : TAMANHO_DE_MOVEL[p.t]
  }

  // ---------- materiais novos (mesmo formato dos de objetos.js) ----------

  const liso = (hex) => ({ classe: 'liso', rgb: rgb(hex) })
  const AGUA = liso('#1d292c')
  const BRILHO_DA_AGUA = liso('#c7d2cf')
  const BARRO = liso('#8a5a46')
  const TERRA = liso('#3b2e24')
  const VIDRO = liso('#e2b46e')
  const PAPEL = liso('#d9cfb8')
  const FOLHAS = [liso('#4f6238'), liso('#56653b'), liso('#475a37')]
  const PRODUTOS = [liso('#8a4436'), liso('#6b7a3e'), liso('#a37a42'), liso('#7d5a8a'), liso('#9a6a3a')]

  /** Folhagem: tufos de ruído, sem listra; a luz vem do chanfro de cada tufo. */
  function texFolha(u, v, x, y, p, s) {
    s[3] += ruido(x * 0.42 + p.su, y * 0.42 + p.sv) * 0.3 + ruido(x * 1.05 + 7, y * 1.05) * 0.14
  }

  /** Água: a borda de pedra faz sombra do lado da luz (cima à esquerda). */
  function texAgua(u, v, x, y, p, s) {
    const d = Math.hypot(x + 4.2, y + 3.4) - p.raioDaAgua
    s[3] += -0.5 * Math.max(0, Math.min(1, 0.5 + d / 3)) + ruido(x * 0.3, y * 0.3) * 0.08
  }

  /** Vidro aceso do lampião: a cor própria vale mais que a luz. */
  function texVidro(u, v, x, y, p, s) {
    s[4] = 0.55
  }

  /** Setor de anel (as pedras da borda do poço), com folga entre elas. */
  function setor(r0, r1, a0, da, folga) {
    const am = a0 + da / 2
    const hw = da / 2
    const rm = (r0 + r1) / 2
    const hr = (r1 - r0) / 2
    const cs = [Math.cos(a0), Math.cos(a0 + da), Math.cos(am)]
    const sn = [Math.sin(a0), Math.sin(a0 + da), Math.sin(am)]
    const b = [Infinity, Infinity, -Infinity, -Infinity]
    for (let i = 0; i < 3; i += 1) for (const r of [r0, r1]) unir(b, cs[i] * r - 1, sn[i] * r - 1, cs[i] * r + 1, sn[i] * r + 1)
    return {
      b,
      d(x, y) {
        const rr = Math.hypot(x, y)
        let a = Math.atan2(y, x) - am
        a -= TAU * Math.round(a / TAU)
        return Math.max(Math.abs(rr - rm) - hr, (Math.abs(a) - hw) * rr + folga / 2)
      },
    }
  }

  // ---------- desenho das peças novas: listas de partes como em objetos.js ----------

  function poco(s) {
    const R = 26
    const r = 17
    s.sombras.push({ forma: elipse(0, 0, R, R), z: 7 }, contato(elipse(0, 0, R, R), 0.32))
    const L = s.partes
    L.push(P(elipse(0, 0, r + 0.6, r + 0.6), AGUA, { bisel: 0, contorno: 0, tex: texAgua, raioDaAgua: r }))
    L.push(P(elipse(4.5, 6, 5.5, 1.8, -0.55), BRILHO_DA_AGUA, { bisel: 0, contorno: 0, alfa: 0.16, suave: 1.8 }))
    const n = 12
    for (let i = 0; i < n; i += 1) {
      L.push(P(setor(r, R, (i / n) * TAU + 0.13, TAU / n, 0.9), MATERIAIS.granito, { bisel: 3.2, tom: 0.9 + 0.16 * hash(i, 3, 77), contorno: 0.26, semente: 300 + i }))
    }
    for (const sx of [-1, 1]) L.push(P(caixa(sx * 29 - 3.4, -5.6, sx * 29 + 3.4, 1.4, 1), MATERIAIS.nogueira, { bisel: 1.5, tabua: 0, semente: 320 + sx }))
    L.push(P(caixa(-31.5, -4.2, 31.5, -0.2, 0.8), MATERIAIS.carvalho, { bisel: 1.3, tabua: 0, eixo: 0, semente: 330, projeta: { dist: 3, forca: 0.32 } }))
    L.push(P(elipse(0, -2.2, 3.6, 3.6), MATERIAIS.corda, { bisel: 3, semente: 331 }))
    L.push(P(elipse(17.5, 15.5, 5.2, 5.2), MATERIAIS.carvalho, { bisel: 2.2, tabua: 2.4, semente: 340, projeta: { dist: 1.5, forca: 0.3 } }))
    L.push(P(anel(17.5, 15.5, 5.3, 5.3, 4.4, 4.4), MATERIAIS.ferro, { bisel: 0.6, semente: 341 }))
    L.push(P(elipse(17.5, 15.5, 3.6, 3.6), AGUA, { bisel: 0, contorno: 0.2, tom: 1.15 }))
  }

  function banco(s, o) {
    const v = !!o.vertical
    const comp = 21
    const lado = 5.4
    const f = v ? caixa(-lado, -comp, lado, comp, 1) : caixa(-comp, -lado, comp, lado, 1)
    s.sombras.push({ forma: f, z: 8 }, contato(f, 0.2))
    const L = s.partes
    for (const k of [-1, 1]) {
      const a = k < 0 ? -lado + 0.2 : 0.35
      const b = k < 0 ? -0.35 : lado - 0.2
      const tabua = v ? caixa(a, -comp, b, comp, 0.8) : caixa(-comp, a, comp, b, 0.8)
      L.push(P(tabua, MATERIAIS.carvalho, { bisel: 1.1, tabua: 0, eixo: v ? Math.PI / 2 : 0, semente: 360 + k + (o.semente || 0) }))
    }
  }

  function barraca(s, o) {
    const tecido = MATERIAIS[o.tecido]
    const hw = 30
    const hh = 23
    s.sombras.push({ forma: caixa(-hw, -hh, hw, hh + 3, 2), z: 30, solta: true, forca: 0.3 }, contato(caixa(-26, hh - 2, 26, hh + 8, 1), 0.25))
    const L = s.partes
    L.push(P(caixa(-26, hh - 2, 26, hh + 8.5, 1), MATERIAIS.pinho, { bisel: 1.2, tabua: 5, semente: 401 }))
    for (let i = 0; i < 7; i += 1) {
      const px = -21 + i * 7
      L.push(P(elipse(px, hh + 4.6, 2.9, 2.6), PRODUTOS[(i + o.semente) % PRODUTOS.length], { bisel: 2, contorno: 0.25, semente: 402 + i }))
    }
    L.push(P(caixa(-hw, -hh, hw, 0.6, 1.5), tecido, { bisel: 2.6, tom: 1.08, ruga: 1.1, semente: 410 + o.semente }))
    L.push(P(caixa(-hw, -0.6, hw, hh, 1.5), tecido, { bisel: 2.6, tom: 0.8, ruga: 1.1, semente: 411 + o.semente }))
    for (let i = 0; i < 6; i += 1) L.push(P(elipse(-hw + 5 + i * 10, hh, 5.2, 3), tecido, { bisel: 2, tom: 0.74, semente: 420 + i }))
    L.push(P(capsula(-hw + 1.5, 0, hw - 1.5, 0, 1.3), MATERIAIS.nogueira, { bisel: 1.3, tabua: 0, semente: 430 }))
  }

  function carroca(s) {
    const corpo = caixa(-27, -14, 31, 14, 1.2)
    s.sombras.push({ forma: corpo, z: 12, solta: true, forca: 0.3 }, contato(caixa(-8, -17.5, 10, 17.5, 1.5), 0.3))
    const L = s.partes
    for (const k of [-1, 1]) L.push(P(caixa(-52, k * 4 - 1.1, -24, k * 4 + 1.1, 0.8), MATERIAIS.nogueira, { bisel: 0.9, tabua: 0, semente: 450 + k }))
    L.push(P(caixa(-54, -5.5, -51, 5.5, 0.6), MATERIAIS.nogueira, { bisel: 0.8, tabua: 0, eixo: Math.PI / 2, semente: 452 }))
    for (const k of [-1, 1]) {
      L.push(P(caixa(-8, k > 0 ? 13.6 : -17.6, 10, k > 0 ? 17.6 : -13.6, 1.6), MATERIAIS.nogueira, { bisel: 1.6, tabua: 0, tom: 0.85, semente: 455 + k }))
      L.push(P(caixa(-8.5, k > 0 ? 16.6 : -18, 10.5, k > 0 ? 18 : -16.6, 0.6), MATERIAIS.ferro, { bisel: 0.6, semente: 457 + k }))
    }
    L.push(P(corpo, MATERIAIS.nogueira, { bisel: 1.6, tabua: 0, semente: 460 }))
    L.push(P(caixa(-24.5, -11.5, 28.5, 11.5, 0.6), MATERIAIS.carvalho, { bisel: 0.8, tabua: 5.6, eixo: 0, tom: 0.92, semente: 461 }))
    L.push(P(elipse(-12, -3.5, 8.5, 6.2, 0.3), MATERIAIS.linho, { bisel: 5, ruga: 1.5, tom: 0.8, semente: 462, projeta: { dist: 2, forca: 0.3 } }))
    L.push(P(elipse(-3, 5.5, 8, 5.8, -0.2), MATERIAIS.linho, { bisel: 5, ruga: 1.5, tom: 0.74, semente: 463, projeta: { dist: 2, forca: 0.3 } }))
    L.push(P(elipse(17, -1, 7.6, 7.6), MATERIAIS.carvalho, { bisel: 3, tabua: 3, semente: 464, projeta: { dist: 2.5, forca: 0.3 } }))
    L.push(P(anel(17, -1, 7.7, 7.7, 6.6, 6.6), MATERIAIS.ferro, { bisel: 0.6, semente: 465 }))
  }

  function lampiao(s) {
    s.sombras.push({ forma: capsula(0, 0, SOMBRA_X * 34, SOMBRA_Y * 34, 1.5), z: 0, suave: 1.6, forca: 0.2 })
    s.sombras.push({ forma: caixa(-6, -6, 6, 6, 1.6), z: 34, solta: true, forca: 0.22 })
    s.brilhos.push({ cx: 0, cy: 0, r: 30, cor: [226, 170, 96], forca: 0.12 })
    const L = s.partes
    L.push(P(elipse(0, 0, 4.2, 4.2), MATERIAIS.granito, { bisel: 2, semente: 469 }))
    L.push(P(caixa(-6.2, -6.2, 6.2, 6.2, 1.6), VIDRO, { bisel: 1, contorno: 0.12, tex: texVidro, semente: 470 }))
    L.push(P(caixa(-4.6, -4.6, 4.6, 4.6, 1.8), MATERIAIS.ferro, { bisel: 4.2, semente: 471 }))
    L.push(P(elipse(0, 0, 1.5, 1.5), MATERIAIS.ferro, { bisel: 1.5, tom: 0.8, semente: 472 }))
  }

  function quadro(s) {
    s.sombras.push({ forma: caixa(-20, -3, 20, 3, 1), z: 20, solta: true, forca: 0.24 }, contato(caixa(-17, 8, 17, 11), 0.22))
    const L = s.partes
    for (const sx of [-1, 1]) L.push(P(caixa(sx * 15 - 1.8, 6, sx * 15 + 1.8, 11, 0.6), MATERIAIS.nogueira, { bisel: 0.8, tabua: 0, eixo: Math.PI / 2, semente: 480 + sx }))
    L.push(P(caixa(-18, -8, 18, 8, 1.2), MATERIAIS.nogueira, { bisel: 1.2, tabua: 0, semente: 482 }))
    L.push(P(caixa(-15.5, -5.6, 15.5, 6, 0.5), MATERIAIS.carvalho, { bisel: 0.5, tabua: 4, tom: 0.78, semente: 483 }))
    L.push(P(poligono([[-13.5, -4.2], [-5.5, -4.8], [-5, 3.6], [-13, 4.1]]), PAPEL, { bisel: 0.4, contorno: 0.12, semente: 484 }))
    L.push(P(poligono([[-3.6, -3.6], [4.2, -3.9], [4.6, 4.6], [-3.4, 4.4]]), PAPEL, { bisel: 0.4, contorno: 0.12, tom: 0.95, semente: 485 }))
    L.push(P(poligono([[6.2, -4.4], [13.4, -3.6], [13, 2.4], [6.4, 2.1]]), PAPEL, { bisel: 0.4, contorno: 0.12, tom: 0.9, semente: 486 }))
    for (const [px, py] of [[-9.4, -3.2], [0.3, -2.6], [9.8, -2.8]]) L.push(P(elipse(px, py, 0.9, 0.9), MATERIAIS.latao, { bisel: 0.9, semente: 487 }))
    L.push(P(caixa(-20.5, -11.5, 20.5, -7.6, 1), MATERIAIS.nogueira, { bisel: 1.2, tabua: 0, tom: 1.08, semente: 488 }))
  }

  function vaso(s, o) {
    s.sombras.push({ forma: elipse(0, 0, 7.5, 7.5), z: 8 }, contato(elipse(0, 0, 7.5, 7.5), 0.25))
    const L = s.partes
    L.push(P(elipse(0, 0, 7.6, 7.6), BARRO, { bisel: 2.4, contorno: 0.24, semente: 490 }))
    L.push(P(elipse(0, 0, 5.8, 5.8), TERRA, { bisel: 0, contorno: 0, semente: 491 }))
    const folha = FOLHAS[(o.semente || 0) % FOLHAS.length]
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * TAU + 0.4
      L.push(P(elipse(Math.cos(a) * 2.6, Math.sin(a) * 2.6, 3.1, 3.1), folha, { bisel: 2.8, tex: texFolha, contorno: 0.2, tom: 0.95 + 0.1 * hash(i, 4, 93), semente: 492 + i }))
    }
    L.push(P(elipse(-0.6, -0.6, 3, 3), folha, { bisel: 2.8, tex: texFolha, contorno: 0.15, tom: 1.08, semente: 499 }))
  }

  /** Copa vista de cima: tufos redondos, cada um com o próprio chanfro; sem listra. */
  function arvore(s, o) {
    const R = o.R
    const sm = o.semente
    const folha = FOLHAS[sm % FOLHAS.length]
    const tufos = []
    const n = 6
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * TAU + hash(sm, i, 11) * 0.8
      const d = R * (0.42 + 0.12 * hash(sm, i, 12))
      tufos.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r: R * (0.5 + 0.1 * hash(sm, i, 13)) })
    }
    tufos.push({ x: -R * 0.08, y: -R * 0.1, r: R * 0.6 })
    s.sombras.push({ forma: elipse(0, 0, R * 0.98, R * 0.98), z: R * 1.3, solta: true, forca: o.fora ? 0.3 : 0.26, suave: 3 })
    s.sombras.push(contato(elipse(0, 0, R * 0.3, R * 0.3), 0.25))
    // Os tufos do lado da sombra primeiro: os de cima à esquerda ficam por cima.
    tufos.sort((a, b) => (a.x * -0.79 + a.y * -0.61) - (b.x * -0.79 + b.y * -0.61))
    tufos.forEach((t, i) => {
      s.partes.push(P(elipse(t.x, t.y, t.r, t.r * 0.96), folha, { bisel: t.r * 0.95, tex: texFolha, contorno: 0.3, tom: (o.fora ? 0.82 : 0.92) + 0.14 * hash(sm, i, 14), semente: sm * 7 + i }))
    })
  }

  function tronco(s, o) {
    const h = o.comp / 2
    const f = capsula(-h, 0, h, 0, 5.2)
    s.sombras.push({ forma: f, z: 9 }, contato(f, 0.25))
    s.partes.push(P(f, MATERIAIS.lenhaCarvalho, { bisel: 5.2, tabua: 0, eixo: 0, semente: 500 + Math.round(o.comp) }))
    s.partes.push(P(elipse(h - 0.6, 0, 2.6, 4.6), MATERIAIS.pinho, { bisel: 1.5, tabua: 0, tom: 1.05, semente: 502 }))
  }

  function placa(s, o) {
    const a = o.ang
    const c = Math.cos(a)
    const sn = Math.sin(a)
    const rot = (pts) => pts.map(([x, y]) => [x * c - y * sn, x * sn + y * c])
    const flecha = rot([[-6, -4.6], [16, -4.6], [22, 0], [16, 4.6], [-6, 4.6]])
    s.sombras.push({ forma: poligono(flecha), z: 22, solta: true, forca: 0.24 }, contato(elipse(0, 0, 3, 3), 0.3))
    s.sombras.push({ forma: capsula(0, 0, SOMBRA_X * 22, SOMBRA_Y * 22, 1.4), z: 0, suave: 1.4, forca: 0.18 })
    s.partes.push(P(poligono(flecha), MATERIAIS.pinho, { bisel: 1.2, tabua: 0, eixo: a, semente: 510 }))
    s.partes.push(P(elipse(0, 0, 2.6, 2.6), MATERIAIS.nogueira, { bisel: 2.2, semente: 511 }))
  }

  /** Sebe: fileira de tufos redondos, como a copa das árvores, só que baixa. */
  function sebe(s, o) {
    const n = Math.max(2, Math.round(o.comp / 8))
    const folha = FOLHAS[2]
    const h = o.comp / 2
    const corpo = o.vertical ? caixa(-7, -h - 6, 7, h + 6, 6) : caixa(-h - 6, -7, h + 6, 7, 6)
    s.sombras.push({ forma: corpo, z: 12 }, contato(corpo, 0.2))
    const tufos = []
    for (let i = 0; i <= n; i += 1) {
      const t = -h + (o.comp * i) / n
      const j = (hash(i, o.semente, 17) - 0.5) * 2.4
      const r = 6.2 + hash(i, o.semente, 18) * 1.8
      tufos.push(o.vertical ? { x: j, y: t, r } : { x: t, y: j, r })
    }
    tufos.sort((a, b) => (a.x * -0.79 + a.y * -0.61) - (b.x * -0.79 + b.y * -0.61))
    tufos.forEach((t, i) => s.partes.push(P(elipse(t.x, t.y, t.r, t.r), folha, { bisel: t.r * 0.95, tex: texFolha, contorno: 0.3, tom: 0.84 + 0.16 * hash(i, o.semente, 19), semente: 600 + o.semente * 50 + i })))
  }

  const DESENHOS = { poco, banco, barraca, carroca, lampiao, quadro, vaso, arvore, tronco, placa, sebe }
  const PECAS_DE_SEBE = SEBES.map(([a, b], i) => ({ t: 'sebe', x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, comp: Math.hypot(b[0] - a[0], b[1] - a[1]), vertical: a[0] === b[0], semente: i + 1 }))

  // ---------- imagens das peças (guardadas por chave e resolução) ----------

  const guardadas = new Map()

  function chaveDaPeca(p) {
    if (p.movel) return `m|${p.t}|${p.w}|${p.h}`
    return [p.t, p.vertical ? 'v' : '', p.tecido || '', p.R || '', p.semente || '', p.ang || '', p.comp || '', p.fora ? 'f' : ''].join('|')
  }

  function pintarDesenho(t, o, S) {
    const t0 = performance.now()
    const cena = { partes: [], sombras: [], brilhos: [] }
    DESENHOS[t](cena, o)
    const tudo = [Infinity, Infinity, -Infinity, -Infinity]
    for (const p of cena.partes) unir(tudo, p.forma.b[0] + p.dx, p.forma.b[1] + p.dy, p.forma.b[2] + p.dx, p.forma.b[3] + p.dy)
    const pecas = tudo.slice()
    for (const sh of cena.sombras) {
      const su = (sh.suave ?? 0.8 + 0.09 * sh.z) * 2
      const b = sh.forma.b
      unir(tudo, b[0] - su, b[1] - su, b[2] + su, b[3] + su)
      unir(tudo, b[0] + SOMBRA_X * sh.z - su, b[1] + SOMBRA_Y * sh.z - su, b[2] + SOMBRA_X * sh.z + su, b[3] + SOMBRA_Y * sh.z + su)
    }
    for (const g of cena.brilhos) unir(tudo, g.cx - g.r, g.cy - g.r, g.cx + g.r, g.cy + g.r)
    const x0 = Math.floor(tudo[0] - 1)
    const y0 = Math.floor(tudo[1] - 1)
    const W = Math.max(1, Math.ceil((tudo[2] + 1 - x0) * S))
    const H = Math.max(1, Math.ceil((tudo[3] + 1 - y0) * S))
    const canvas = pintarCena(W, H, x0, y0, S, cena.partes, cena.sombras, cena.brilhos)
    return { canvas, S, ox: x0, oy: y0, largura: W / S, altura: H / S, pecas, ms: performance.now() - t0 }
  }

  /** A imagem da peça na resolução S (1, 2 ou 3 px por px do mapa). */
  function imagemDaPeca(p, S) {
    const chave = chaveDaPeca(p) + '@' + S
    let img = guardadas.get(chave)
    if (!img) {
      if (p.movel) {
        img = Objetos.gerarSprite({ tipo: p.t, largura: p.w, altura: p.h, estilo: 'cima', vista: 'frente', materiais: {} }, S)
      } else {
        img = pintarDesenho(p.t, { ...p, semente: p.semente || Math.round(p.x + p.y) % 5 }, S)
      }
      guardadas.set(chave, img)
    }
    return img
  }
  const temImagem = (p, S) => guardadas.has(chaveDaPeca(p) + '@' + S)

  // ---------- texturas do chão: ladrilhos periódicos, pintados por pixel ----------

  const canvasDe = (w, h) => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    return c
  }
  const limitar = (v, a, b) => (v < a ? a : v > b ? b : v)

  /** Ruído de valor que fecha no período (para o ladrilho emendar sem costura). */
  function ruidoP(x, y, periodo, semente) {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    let fx = x - xi
    let fy = y - yi
    fx = fx * fx * (3 - 2 * fx)
    fy = fy * fy * (3 - 2 * fy)
    const x0 = ((xi % periodo) + periodo) % periodo
    const y0 = ((yi % periodo) + periodo) % periodo
    const x1 = (x0 + 1) % periodo
    const y1 = (y0 + 1) % periodo
    const a = hash(x0, y0, semente)
    const b = hash(x1, y0, semente)
    const c = hash(x0, y1, semente)
    const d = hash(x1, y1, semente)
    const ab = a + (b - a) * fx
    const cd = c + (d - c) * fx
    return ab + (cd - ab) * fy - 0.5
  }

  /**
   * Pedras (paralelepípedo, laje, pedra do muro): células de Voronoi que fecham
   * no ladrilho, cada pedra com o próprio tom, chanfro com a luz de cima à
   * esquerda e rejunte fino. `T` = lado do ladrilho em px do mapa; `k` = px por px.
   */
  function ladrilhoDePedras(T, k, o) {
    const N = Math.max(1, Math.round(T / o.celula))
    const c = T / N
    const W = Math.round(T * k)
    const img = new ImageData(W, W)
    const d = img.data
    const [br, bg, bb] = rgb(o.cor)
    const [mr, mg, mb] = rgb(o.rejunte)
    const fx = new Float32Array(N * N)
    const fy = new Float32Array(N * N)
    const tom = new Float32Array(N * N)
    for (let iy = 0; iy < N; iy += 1) {
      for (let ix = 0; ix < N; ix += 1) {
        const i = iy * N + ix
        fx[i] = (ix + 0.5 + (hash(ix, iy, o.semente) - 0.5) * o.solto) * c
        fy[i] = (iy + 0.5 + (hash(ix, iy, o.semente + 1) - 0.5) * o.solto) * c
        tom[i] = (hash(ix, iy, o.semente + 2) - 0.5) * 2 * o.variacao
      }
    }
    const meioRejunte = o.rejunteLarg / 2
    for (let py = 0, q = 0; py < W; py += 1) {
      const y = (py + 0.5) / k
      const iy = Math.floor(y / c)
      for (let px = 0; px < W; px += 1, q += 4) {
        const x = (px + 0.5) / k
        const ix = Math.floor(x / c)
        let d1 = Infinity
        let d2 = Infinity
        let ax = 0
        let ay = 0
        let bx = 0
        let by = 0
        let ia = 0
        for (let dy = -1; dy <= 1; dy += 1) {
          const cy = iy + dy
          const jy = ((cy % N) + N) % N
          for (let dx = -1; dx <= 1; dx += 1) {
            const cx = ix + dx
            const jx = ((cx % N) + N) % N
            const j = jy * N + jx
            const qx = fx[j] + (cx - jx) * c
            const qy = fy[j] + (cy - jy) * c
            const dd = (qx - x) * (qx - x) + (qy - y) * (qy - y)
            if (dd < d1) {
              d2 = d1
              bx = ax
              by = ay
              d1 = dd
              ax = qx
              ay = qy
              ia = j
            } else if (dd < d2) {
              d2 = dd
              bx = qx
              by = qy
            }
          }
        }
        const sep = Math.hypot(bx - ax, by - ay) || 1
        const e = (d2 - d1) / (2 * sep)
        const r1 = Math.sqrt(d1) || 1
        const dirx = (x - ax) / r1
        const diry = (y - ay) / r1
        const t = limitar(e / o.bisel, 0, 1)
        const borda = (1 - t) * (1 - t)
        let luz = 1 + tom[ia] + (dirx * -0.79 + diry * -0.61) * borda * o.relevo - borda * 0.1
        luz += ruidoP(x * 0.7, y * 0.7, Math.round(T * 0.7), o.semente + 5) * o.grao
        const m = limitar((meioRejunte - e) * k + 0.5, 0, 1)
        const rj = 1 + ruidoP(x * 0.5, y * 0.5, Math.round(T * 0.5), o.semente + 6) * 0.12
        d[q] = br * luz * (1 - m) + mr * rj * m
        d[q + 1] = bg * luz * (1 - m) + mg * rj * m
        d[q + 2] = bb * luz * (1 - m) + mb * rj * m
        d[q + 3] = 255
      }
    }
    const cv = canvasDe(W, W)
    cv.getContext('2d').putImageData(img, 0, 0)
    return cv
  }

  /** Chão macio (grama, mato, terra, sebe): ruído em duas escalas, sem listra. */
  function ladrilhoMacio(T, k, o) {
    const W = Math.round(T * k)
    const img = new ImageData(W, W)
    const d = img.data
    const base = rgb(o.cor)
    const outra = o.outra ? rgb(o.outra) : null
    const e1 = T / o.escala1
    const e2 = T / o.escala2
    for (let py = 0, q = 0; py < W; py += 1) {
      const y = (py + 0.5) / k
      for (let px = 0; px < W; px += 1, q += 4) {
        const x = (px + 0.5) / k
        const n1 = ruidoP(x / o.escala1, y / o.escala1, Math.round(e1), o.semente)
        const n2 = ruidoP(x / o.escala2, y / o.escala2, Math.round(e2), o.semente + 1)
        let r = base[0]
        let g = base[1]
        let b = base[2]
        if (outra) {
          const n3 = ruidoP(x / o.escala3, y / o.escala3, Math.round(T / o.escala3), o.semente + 2)
          const mix = limitar((n3 - o.limiar) * 4 + 0.5, 0, 1) * o.quanto
          r += (outra[0] - r) * mix
          g += (outra[1] - g) * mix
          b += (outra[2] - b) * mix
        }
        let luz = 1 + n1 * o.forca1 + n2 * o.forca2
        if (o.pintas) {
          const h = hash(Math.floor(x / 2.2), Math.floor(y / 2.2), o.semente + 3)
          if (h > 1 - o.pintas) luz -= 0.09
          else if (h < o.pintas * 0.6) luz += 0.06
        }
        d[q] = r * luz
        d[q + 1] = g * luz
        d[q + 2] = b * luz
        d[q + 3] = 255
      }
    }
    const cv = canvasDe(W, W)
    cv.getContext('2d').putImageData(img, 0, 0)
    return cv
  }

  /** Assoalho de tábuas (dentro das casas): tábua de 14 px, emenda de topo, veio fraco. */
  function ladrilhoDeTabuas(T, k, o) {
    const W = Math.round(T * k)
    const img = new ImageData(W, W)
    const d = img.data
    const [br, bg, bb] = rgb(o.cor)
    const L = 14
    const fileiras = Math.round(T / L)
    for (let py = 0, q = 0; py < W; py += 1) {
      const y = (py + 0.5) / k
      const f = Math.floor(y / L) % fileiras
      const fy = y - Math.floor(y / L) * L
      for (let px = 0; px < W; px += 1, q += 4) {
        const x = (px + 0.5) / k
        const desloc = hash(f, 1, o.semente) * T
        const xx = (x + desloc) % T
        const pedaco = xx < T * (0.35 + 0.3 * hash(f, 2, o.semente)) ? 0 : 1
        const emenda = pedaco === 0 ? xx : xx - T * (0.35 + 0.3 * hash(f, 2, o.semente))
        let luz = 1 + (hash(f, pedaco + 3, o.semente) - 0.5) * 0.16
        luz += ruidoP(x * 0.06, y * 0.9, Math.round(T * 0.06), o.semente + 4) * 0.08
        const junta = Math.min(fy, L - fy)
        if (junta < 0.6) luz *= 0.72
        else if (fy < 1.6) luz *= 1.04
        if (Math.abs(emenda) < 0.6 || Math.abs(xx) < 0.6) luz *= 0.8
        d[q] = br * luz
        d[q + 1] = bg * luz
        d[q + 2] = bb * luz
        d[q + 3] = 255
      }
    }
    const cv = canvasDe(W, W)
    cv.getContext('2d').putImageData(img, 0, 0)
    return cv
  }

  /** Receita de cada ladrilho: o chão aprovado do minimapa é chapado; aqui a textura é de poucos por cento. */
  const LADRILHOS = {
    pedras: (k) => ladrilhoDePedras(224, k, { celula: 10, cor: '#6f655b', rejunte: '#544a42', rejunteLarg: 1.2, bisel: 3.5, relevo: 0.14, variacao: 0.06, grao: 0.05, solto: 0.7, semente: 11 }),
    lajes: (k) => ladrilhoDePedras(224, k, { celula: 22, cor: '#867e72', rejunte: '#5f574e', rejunteLarg: 1.2, bisel: 3, relevo: 0.1, variacao: 0.05, grao: 0.045, solto: 0.6, semente: 23 }),
    muro: (k) => ladrilhoDePedras(48, k, { celula: 7, cor: '#88847c', rejunte: '#4e4a44', rejunteLarg: 1.1, bisel: 2.2, relevo: 0.2, variacao: 0.1, grao: 0.05, solto: 0.7, semente: 31 }),
    antes: (k) => ladrilhoDePedras(224, k, { celula: 9, cor: '#5f554f', rejunte: '#4d4540', rejunteLarg: 1, bisel: 2.5, relevo: 0.1, variacao: 0.05, grao: 0.04, solto: 0.8, semente: 41 }),
    grama: (k) => ladrilhoMacio(256, k, { cor: '#55663f', outra: '#66683f', escala1: 16, escala2: 4, escala3: 32, limiar: 0.18, quanto: 0.5, forca1: 0.11, forca2: 0.07, pintas: 0.05, semente: 51 }),
    mato: (k) => ladrilhoMacio(256, k, { cor: '#3b4631', outra: '#463f32', escala1: 18, escala2: 5, escala3: 42.67, limiar: 0.12, quanto: 0.7, forca1: 0.08, forca2: 0.05, pintas: 0.03, semente: 61 }),
    terra: (k) => ladrilhoMacio(128, k, { cor: '#6a5a46', escala1: 12.8, escala2: 3.2, forca1: 0.08, forca2: 0.06, pintas: 0.06, semente: 71 }),
    sebe: (k) => ladrilhoMacio(64, k, { cor: '#3d5130', outra: '#4a5c36', escala1: 4, escala2: 1.6, escala3: 8, limiar: 0.1, quanto: 0.6, forca1: 0.3, forca2: 0.16, semente: 81 }),
    tabuas: (k) => ladrilhoDeTabuas(112, k, { cor: '#9a7653', semente: 91 }),
    palha: (k) => ladrilhoMacio(128, k, { cor: '#8a7850', outra: '#76663f', escala1: 6.4, escala2: 2, escala3: 16, limiar: 0.1, quanto: 0.5, forca1: 0.12, forca2: 0.1, pintas: 0.08, semente: 95 }),
  }
  const ladrilhos = new Map()
  function ladrilho(nome, k) {
    const chave = nome + '@' + k
    if (!ladrilhos.has(chave)) ladrilhos.set(chave, LADRILHOS[nome](k))
    return ladrilhos.get(chave)
  }

  // ---------- caminhos no canvas ----------

  function contornoSuave(ctx, pts) {
    const n = pts.length
    const meio = (i) => [(pts[i][0] + pts[(i + 1) % n][0]) / 2, (pts[i][1] + pts[(i + 1) % n][1]) / 2]
    const a = meio(n - 1)
    ctx.moveTo(a[0], a[1])
    for (let i = 0; i < n; i += 1) {
      const b = meio(i)
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], b[0], b[1])
    }
    ctx.closePath()
  }

  function linhaSuave(ctx, pts) {
    ctx.moveTo(pts[0][0], pts[0][1])
    for (let i = 1; i < pts.length - 1; i += 1) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2
      const my = (pts[i][1] + pts[i + 1][1]) / 2
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], i === pts.length - 2 ? pts[i + 1][0] : mx, i === pts.length - 2 ? pts[i + 1][1] : my)
    }
    if (pts.length === 2) ctx.lineTo(pts[1][0], pts[1][1])
  }

  /** Pontos de uma linha suave (para a colisão e os testes "nada no caminho"). */
  function amostrarLinha(pts, passo = 6) {
    const saida = []
    const quad = (a, c, b, t) => [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]]
    if (pts.length === 2) {
      const l = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1])
      for (let s = 0; s <= l; s += passo) saida.push([pts[0][0] + ((pts[1][0] - pts[0][0]) * s) / l, pts[0][1] + ((pts[1][1] - pts[0][1]) * s) / l])
      return saida
    }
    let inicio = pts[0]
    for (let i = 1; i < pts.length - 1; i += 1) {
      const fim = i === pts.length - 2 ? pts[i + 1] : [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2]
      for (let t = 0; t < 1; t += 0.05) saida.push(quad(inicio, pts[i], fim, t))
      inicio = fim
    }
    saida.push(inicio)
    return saida
  }

  function padrao(ctx, nome, k) {
    const p = ctx.createPattern(ladrilho(nome, k), 'repeat')
    p.setTransform(new DOMMatrix([1 / k, 0, 0, 1 / k, 0, 0]))
    return p
  }

  // ---------- o chão de depois ----------

  /** Pinta o chão inteiro (tudo o que não muda: praça, caminhos, muro, sebes, frestas de parede e o dentro das casas). */
  function pintarChaoDepois(k) {
    const t0 = performance.now()
    const cv = canvasDe(Math.ceil(MUNDO.w * k), Math.ceil(MUNDO.h * k))
    const ctx = cv.getContext('2d')
    ctx.setTransform(k, 0, 0, k, -MUNDO.x0 * k, -MUNDO.y0 * k)
    // fora: mato e terra chapados
    ctx.fillStyle = padrao(ctx, 'mato', k)
    ctx.fillRect(MUNDO.x0, MUNDO.y0, MUNDO.w, MUNDO.h)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const e of ESTRADAS) {
      ctx.beginPath()
      linhaSuave(ctx, e.fora)
      ctx.globalAlpha = 0.4
      ctx.lineWidth = e.largura + 12
      ctx.strokeStyle = padrao(ctx, 'terra', k)
      ctx.stroke()
      ctx.globalAlpha = 1
      ctx.lineWidth = e.largura
      ctx.stroke()
    }
    // dentro do muro: grama
    ctx.beginPath()
    const laco = [...MURO[0], ...MURO[1]]
    ctx.moveTo(laco[0][0], laco[0][1])
    for (const [x, y] of laco.slice(1)) ctx.lineTo(x, y)
    ctx.closePath()
    ctx.fillStyle = padrao(ctx, 'grama', k)
    ctx.fill()
    // praça de paralelepípedo, com meio-fio fino
    ctx.beginPath()
    contornoSuave(ctx, PRACA)
    ctx.fillStyle = padrao(ctx, 'pedras', k)
    ctx.fill()
    ctx.lineWidth = 2.2
    ctx.strokeStyle = 'rgba(46, 39, 32, 0.32)'
    ctx.stroke()
    // estradas de dentro e caminhos das portas, de laje clara
    const lajes = padrao(ctx, 'lajes', k)
    const tracar = (pts, largura) => {
      ctx.beginPath()
      linhaSuave(ctx, pts)
      ctx.lineWidth = largura + 3
      ctx.strokeStyle = 'rgba(52, 45, 38, 0.3)'
      ctx.stroke()
      ctx.lineWidth = largura
      ctx.strokeStyle = lajes
      ctx.stroke()
    }
    for (const e of ESTRADAS) tracar(e.dentro, e.largura)
    for (const c of CASAS) tracar(caminhoDaPorta(c), LARGURA_DO_CAMINHO)
    // anel de laje em volta do poço
    ctx.beginPath()
    ctx.arc(CENTRO[0], CENTRO[1], RAIO_DO_ANEL + 1.6, 0, TAU)
    ctx.fillStyle = 'rgba(52, 45, 38, 0.32)'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(CENTRO[0], CENTRO[1], RAIO_DO_ANEL, 0, TAU)
    ctx.fillStyle = lajes
    ctx.fill()
    // casas: o dentro (assoalho, paredes finas) e a fresta de parede do lado da sombra
    for (const c of CASAS) pintarDentroDaCasa(ctx, c, k)
    // muro baixo de pedra, com sombra curta
    const pedraDoMuro = padrao(ctx, 'muro', k)
    const tracoDoMuro = (trecho) => {
      ctx.beginPath()
      ctx.moveTo(trecho[0][0], trecho[0][1])
      for (const [x, y] of trecho.slice(1)) ctx.lineTo(x, y)
    }
    ctx.lineCap = 'butt'
    for (const trecho of MURO) {
      tracoDoMuro(trecho)
      sombraEmCamadas(ctx, MEIA_LARGURA_DO_MURO * 2, 2.2, 2.8, 0.34)
      ctx.lineWidth = MEIA_LARGURA_DO_MURO * 2
      ctx.strokeStyle = pedraDoMuro
      ctx.stroke()
      ctx.save()
      ctx.translate(-0.8, -0.9)
      ctx.lineWidth = 1.2
      ctx.strokeStyle = 'rgba(232, 224, 206, 0.14)'
      ctx.stroke()
      ctx.restore()
    }
    for (const [x, y] of PILARES) {
      for (const [g, a] of [[3, 0.1], [1.5, 0.12], [0, 0.16]]) {
        ctx.fillStyle = `rgba(12, 10, 6, ${a})`
        ctx.fillRect(x - 7 + 3 - g, y - 7 + 3.6 - g, 14 + 2 * g, 14 + 2 * g)
      }
      ctx.fillStyle = pedraDoMuro
      ctx.fillRect(x - 7, y - 7, 14, 14)
      ctx.fillStyle = 'rgba(236, 228, 210, 0.16)'
      ctx.fillRect(x - 7, y - 7, 14, 2)
      ctx.fillRect(x - 7, y - 5, 2, 12)
      ctx.fillStyle = 'rgba(20, 16, 12, 0.22)'
      ctx.fillRect(x - 7, y + 5, 14, 2)
      ctx.fillRect(x + 5, y - 5, 2, 10)
    }
    // (as sebes são peças: tufos com luz, como as árvores)
    // o raster sai aqui, e não no primeiro quadro (o canvas é preguiçoso)
    ctx.getImageData(0, 0, 1, 1)
    return { canvas: cv, k, ms: performance.now() - t0 }
  }

  /** Sombra macia de um traço sem `shadowBlur` (caro): três traços deslocados, do mais largo ao mais estreito. */
  function sombraEmCamadas(ctx, largura, dx, dy, forca) {
    ctx.save()
    ctx.translate(dx, dy)
    for (const [extra, parte] of [[4, 0.3], [2, 0.32], [0, 0.38]]) {
      ctx.lineWidth = largura + extra
      ctx.strokeStyle = `rgba(12, 10, 6, ${forca * parte})`
      ctx.stroke()
    }
    ctx.restore()
  }

  /** Assoalho e paredes finas (estilo do minimapa), vistos quando o telhado some. */
  function pintarDentroDaCasa(ctx, c, k) {
    const [x0, y0, x1, y1] = c.ret
    ctx.save()
    ctx.beginPath()
    ctx.rect(x0, y0, x1 - x0, y1 - y0)
    ctx.clip()
    ctx.fillStyle = padrao(ctx, c.id === 'estabulo' ? 'palha' : c.id === 'templo' ? 'lajes' : 'tabuas', k)
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
    // sombra das paredes no chão de dentro (luz de cima à esquerda)
    ctx.fillStyle = 'rgba(20, 14, 8, 0.22)'
    ctx.fillRect(x0, y0, x1 - x0, 6)
    ctx.fillRect(x0, y0, 6, y1 - y0)
    ctx.restore()
    // fresta de parede do lado da sombra: sul e leste, 3 px além do beiral
    const B = 8
    ctx.fillStyle = '#7d7466'
    ctx.fillRect(x0 - B + 3, y1 + B - 1, x1 - x0 + 2 * B - 3, 4)
    ctx.fillStyle = '#6c6457'
    ctx.fillRect(x1 + B - 1, y0 - B + 4, 4, y1 - y0 + 2 * B - 1)
    ctx.fillStyle = 'rgba(28, 22, 16, 0.5)'
    ctx.fillRect(x0 - B + 3, y1 + B + 3, x1 - x0 + 2 * B + 1, 1)
    ctx.fillRect(x1 + B + 3, y0 - B + 4, 1, y1 - y0 + 2 * B)
    // paredes finas com o vão da porta
    ctx.strokeStyle = '#2a231d'
    ctx.lineWidth = 4
    ctx.lineCap = 'square'
    for (const [a, b] of paredesDaCasa(c)) {
      ctx.beginPath()
      ctx.moveTo(a[0], a[1])
      ctx.lineTo(b[0], b[1])
      ctx.stroke()
    }
  }

  /** As 4 paredes da casa como segmentos, com o vão da porta aberto. */
  function paredesDaCasa(c) {
    const [x0, y0, x1, y1] = c.ret
    const m = VAO_DA_PORTA / 2
    const lados = { N: [[x0, y0], [x1, y0]], S: [[x0, y1], [x1, y1]], W: [[x0, y0], [x0, y1]], E: [[x1, y0], [x1, y1]] }
    const segs = []
    for (const [L, [a, b]] of Object.entries(lados)) {
      if (L !== c.lado) {
        segs.push([a, b])
        continue
      }
      if (L === 'N' || L === 'S') {
        segs.push([a, [c.pos - m, a[1]]], [[c.pos + m, a[1]], b])
      } else {
        segs.push([a, [a[0], c.pos - m]], [[a[0], c.pos + m], b])
      }
    }
    return segs
  }

  /** Sombra do beiral no chão, por casa: some junto com o telhado. */
  function pintarSombraDaCasa(c, k) {
    const [x0, y0, x1, y1] = c.ret
    const B = 8
    const folga = 30
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
    // sombra macia sem shadowBlur: retângulos que crescem, cada um bem fraco
    const DX = 7
    const DY = 9
    for (let i = 6; i >= 0; i -= 1) {
      const g = i * 1.4
      ctx.fillStyle = `rgba(16, 11, 6, ${0.062})`
      ctx.beginPath()
      ctx.roundRect(x0 - B + DX - g, y0 - B + DY - g, x1 - x0 + 2 * B + 2 * g, y1 - y0 + 2 * B + 2 * g, g + 1)
      ctx.fill()
    }
    ctx.getImageData(0, 0, 1, 1)
    return { canvas: cv, x: ox, y: oy, w: W / k, h: H / k }
  }

  // ---------- o chão de antes (recriação do print) ----------

  const PRACA_ANTES = [
    [430, 0], [692, 0], [695, 174], [930, 174], [985, 200], [1022, 300], [1045, 430], [1040, 562], [775, 568], [800, 761],
    [525, 761], [513, 566], [289, 566], [255, 608], [0, 620], [0, 430], [10, 430], [10, 242], [150, 240], [40, 175], [80, 198], [80, 32], [430, 32],
  ]

  function pintarChaoAntes(k) {
    const t0 = performance.now()
    const cv = canvasDe(Math.ceil(MUNDO.w * k), Math.ceil(MUNDO.h * k))
    const ctx = cv.getContext('2d')
    ctx.setTransform(k, 0, 0, k, -MUNDO.x0 * k, -MUNDO.y0 * k)
    ctx.fillStyle = '#342e2b'
    ctx.fillRect(MUNDO.x0, MUNDO.y0, MUNDO.w, MUNDO.h)
    ctx.beginPath()
    ctx.moveTo(PRACA_ANTES[0][0], PRACA_ANTES[0][1])
    for (const [x, y] of PRACA_ANTES.slice(1)) ctx.lineTo(x, y)
    ctx.closePath()
    ctx.fillStyle = padrao(ctx, 'antes', k)
    ctx.fill()
    // a "linha diagonal solta" do print (borda da praça em cima à esquerda)
    ctx.strokeStyle = '#4a423d'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(40, 175)
    ctx.lineTo(150, 240)
    ctx.stroke()
    return { canvas: cv, k, ms: performance.now() - t0 }
  }

  // ---------- telhados (código do app) ----------

  const telhados = new Map()
  function imagemDoTelhado(c, k) {
    const chave = c.id + '@' + k
    if (telhados.has(chave)) return telhados.get(chave)
    const t0 = performance.now()
    const [x0, y0, x1, y1] = c.ret
    const img = TelhadoLab.pintarTelhado([{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }], c.modelo, c.cor, k)
    const cv = canvasDe(Math.max(1, img.largura), Math.max(1, img.altura))
    if (img.largura > 0) cv.getContext('2d').putImageData(new ImageData(img.pixels, img.largura, img.altura), 0, 0)
    const r = { canvas: cv, x: img.origemX, y: img.origemY, w: img.largura / img.escala, h: img.altura / img.escala, k, ms: performance.now() - t0 }
    telhados.set(chave, r)
    return r
  }

  // ---------- colisão ----------

  /** Formas sólidas: 0 = segmento com raio, 1 = retângulo, 2 = círculo. */
  function formaDaPeca(p) {
    const c = p.col
    if (!c) return null
    if (c.seg) {
      const ca = Math.cos(p.ang || 0)
      const sa = Math.sin(p.ang || 0)
      const [a, b] = c.seg.map(([x, y]) => [p.x + x * ca - y * sa, p.y + x * sa + y * ca])
      return { t: 0, ax: a[0], ay: a[1], bx: b[0], by: b[1], r: c.r }
    }
    if (c.r) return { t: 2, x: p.x, y: p.y, r: c.r }
    const cx = p.x + (c.dx || 0)
    const cy = p.y + (c.dy || 0)
    return { t: 1, x0: cx - c.w / 2, y0: cy - c.h / 2, x1: cx + c.w / 2, y1: cy + c.h / 2, r: 0 }
  }

  function obstaculosDepois() {
    const lista = []
    for (const trecho of MURO) for (let i = 0; i < trecho.length - 1; i += 1) lista.push({ t: 0, ax: trecho[i][0], ay: trecho[i][1], bx: trecho[i + 1][0], by: trecho[i + 1][1], r: MEIA_LARGURA_DO_MURO })
    for (const [x, y] of PILARES) lista.push({ t: 1, x0: x - 7, y0: y - 7, x1: x + 7, y1: y + 7, r: 0 })
    for (const s of SEBES) lista.push({ t: 0, ax: s[0][0], ay: s[0][1], bx: s[1][0], by: s[1][1], r: MEIA_LARGURA_DA_SEBE })
    for (const c of CASAS) for (const [a, b] of paredesDaCasa(c)) lista.push({ t: 0, ax: a[0], ay: a[1], bx: b[0], by: b[1], r: 2 })
    for (const p of [...PECAS, ...PLACAS, ...ARVORES_DE_FORA, ...PECAS_DE_DENTRO]) {
      const f = formaDaPeca(p)
      if (f) lista.push(f)
    }
    return lista
  }

  function obstaculosAntes() {
    const lista = CASAS.map((c) => ({ t: 1, x0: c.ret[0], y0: c.ret[1], x1: c.ret[2], y1: c.ret[3], r: 0 }))
    lista.push({ t: 1, x0: 534, y0: 346, x1: 639, y1: 445, r: 0 }, { t: 1, x0: 782, y0: 297, x1: 818, y1: 314, r: 0 })
    return lista
  }

  /** Grade de baldes de 64 px: cada ponto só testa as formas perto dele. */
  function montarFisica(lista) {
    const B = 64
    const nx = Math.ceil(MUNDO.w / B) + 1
    const ny = Math.ceil(MUNDO.h / B) + 1
    const baldes = Array.from({ length: nx * ny }, () => [])
    lista.forEach((f, i) => {
      let b
      if (f.t === 0) b = [Math.min(f.ax, f.bx) - f.r, Math.min(f.ay, f.by) - f.r, Math.max(f.ax, f.bx) + f.r, Math.max(f.ay, f.by) + f.r]
      else if (f.t === 1) b = [f.x0, f.y0, f.x1, f.y1]
      else b = [f.x - f.r, f.y - f.r, f.x + f.r, f.y + f.r]
      const m = RAIO_DO_PINO + 2
      const i0 = Math.max(0, Math.floor((b[0] - m - MUNDO.x0) / B))
      const i1 = Math.min(nx - 1, Math.floor((b[2] + m - MUNDO.x0) / B))
      const j0 = Math.max(0, Math.floor((b[1] - m - MUNDO.y0) / B))
      const j1 = Math.min(ny - 1, Math.floor((b[3] + m - MUNDO.y0) / B))
      for (let j = j0; j <= j1; j += 1) for (let ii = i0; ii <= i1; ii += 1) baldes[j * nx + ii].push(i)
    })
    const balde = (x, y) => {
      const i = Math.floor((x - MUNDO.x0) / B)
      const j = Math.floor((y - MUNDO.y0) / B)
      if (i < 0 || j < 0 || i >= nx || j >= ny) return []
      return baldes[j * nx + i]
    }
    return { lista, balde }
  }

  /** Ponto mais perto da forma (para medir a folga e empurrar o pino para fora). */
  function maisPerto(f, x, y) {
    if (f.t === 2) {
      const d = Math.hypot(x - f.x, y - f.y) || 1e-6
      return [f.x + ((x - f.x) / d) * 0, f.y, d - f.r, (x - f.x) / d, (y - f.y) / d]
    }
    if (f.t === 0) {
      const dx = f.bx - f.ax
      const dy = f.by - f.ay
      const l2 = dx * dx + dy * dy || 1e-9
      let h = ((x - f.ax) * dx + (y - f.ay) * dy) / l2
      h = h < 0 ? 0 : h > 1 ? 1 : h
      const qx = f.ax + dx * h
      const qy = f.ay + dy * h
      const d = Math.hypot(x - qx, y - qy) || 1e-6
      return [qx, qy, d - f.r, (x - qx) / d, (y - qy) / d]
    }
    const dentro = x > f.x0 && x < f.x1 && y > f.y0 && y < f.y1
    if (!dentro) {
      const qx = limitar(x, f.x0, f.x1)
      const qy = limitar(y, f.y0, f.y1)
      const d = Math.hypot(x - qx, y - qy) || 1e-6
      return [qx, qy, d, (x - qx) / d, (y - qy) / d]
    }
    const opcoes = [[x - f.x0, -1, 0], [f.x1 - x, 1, 0], [y - f.y0, 0, -1], [f.y1 - y, 0, 1]]
    opcoes.sort((a, b) => a[0] - b[0])
    return [x, y, -opcoes[0][0], opcoes[0][1], opcoes[0][2]]
  }

  /** Folga do círculo de raio r em (x, y): negativa = encosta em algo. */
  function folga(fis, x, y, r) {
    let menor = Math.min(x - MUNDO.x0, MUNDO.x1 - x, y - MUNDO.y0, MUNDO.y1 - y) - r
    for (const i of fis.balde(x, y)) {
      const d = maisPerto(fis.lista[i], x, y)[2] - r
      if (d < menor) menor = d
    }
    return menor
  }

  /** Empurra o círculo para fora de tudo que ele invade (desliza na parede, sem atravessar). */
  function resolver(fis, x, y, r) {
    for (let it = 0; it < 4; it += 1) {
      let mexeu = false
      for (const i of fis.balde(x, y)) {
        const [, , d, nx, ny] = maisPerto(fis.lista[i], x, y)
        const pen = r - d
        if (pen > 0) {
          x += nx * pen
          y += ny * pen
          mexeu = true
        }
      }
      x = limitar(x, MUNDO.x0 + r, MUNDO.x1 - r)
      y = limitar(y, MUNDO.y0 + r, MUNDO.y1 - r)
      if (!mexeu) break
    }
    return [x, y]
  }

  /** Um passo do pino: direção (-1..1) e tempo; sub-passos curtos para nunca atravessar parede fina. */
  function andar(fis, pos, dx, dy, dt) {
    const l = Math.hypot(dx, dy)
    if (l < 1e-6) return pos
    const vx = (dx / l) * VELOCIDADE
    const vy = (dy / l) * VELOCIDADE
    let [x, y] = pos
    const n = Math.max(1, Math.ceil((VELOCIDADE * dt) / 1.5))
    for (let i = 0; i < n; i += 1) [x, y] = resolver(fis, x + (vx * dt) / n, y + (vy * dt) / n, RAIO_DO_PINO)
    return [x, y]
  }

  // ---------- caminho (toque e robô): A* numa grade de 4 px ----------

  const CEL = 4
  function montarNavegacao(fis) {
    const t0 = performance.now()
    const W = Math.floor(MUNDO.w / CEL)
    const H = Math.floor(MUNDO.h / CEL)
    const livre = new Uint8Array(W * H)
    for (let j = 0; j < H; j += 1) {
      const y = MUNDO.y0 + (j + 0.5) * CEL
      for (let i = 0; i < W; i += 1) {
        const x = MUNDO.x0 + (i + 0.5) * CEL
        livre[j * W + i] = folga(fis, x, y, RAIO_DO_PINO + 1) >= 0 ? 1 : 0
      }
    }
    return { W, H, livre, ms: performance.now() - t0 }
  }

  const celula = (nav, x, y) => [limitar(Math.floor((x - MUNDO.x0) / CEL), 0, nav.W - 1), limitar(Math.floor((y - MUNDO.y0) / CEL), 0, nav.H - 1)]
  const centroDaCelula = (i, j) => [MUNDO.x0 + (i + 0.5) * CEL, MUNDO.y0 + (j + 0.5) * CEL]

  /** A célula livre mais perto (até `raio` células), para um toque em cima de uma peça. */
  function livreMaisPerto(nav, i, j, raio = 8) {
    if (nav.livre[j * nav.W + i]) return [i, j]
    for (let r = 1; r <= raio; r += 1) {
      let melhor = null
      for (let dj = -r; dj <= r; dj += 1) {
        for (let di = -r; di <= r; di += 1) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue
          const a = i + di
          const b = j + dj
          if (a < 0 || b < 0 || a >= nav.W || b >= nav.H || !nav.livre[b * nav.W + a]) continue
          const d = di * di + dj * dj
          if (!melhor || d < melhor[2]) melhor = [a, b, d]
        }
      }
      if (melhor) return [melhor[0], melhor[1]]
    }
    return null
  }

  function linhaLivre(nav, a, b) {
    const [i0, j0] = celula(nav, a[0], a[1])
    const [i1, j1] = celula(nav, b[0], b[1])
    const n = Math.max(Math.abs(i1 - i0), Math.abs(j1 - j0))
    for (let s = 0; s <= n; s += 1) {
      const i = Math.round(i0 + ((i1 - i0) * s) / (n || 1))
      const j = Math.round(j0 + ((j1 - j0) * s) / (n || 1))
      if (!nav.livre[j * nav.W + i]) return false
    }
    return true
  }

  /** Caminho de `a` até `b` em pontos (já esticado), ou null se não há. */
  function caminho(nav, a, b) {
    const [si, sj] = livreMaisPerto(nav, ...celula(nav, a[0], a[1])) || []
    const fim = livreMaisPerto(nav, ...celula(nav, b[0], b[1]))
    if (si === undefined || !fim) return null
    const { W, H, livre } = nav
    const N = W * H
    const g = new Float32Array(N).fill(Infinity)
    const veio = new Int32Array(N).fill(-1)
    const fechado = new Uint8Array(N)
    const heap = []
    const empurrar = (no, f) => {
      heap.push([f, no])
      let i = heap.length - 1
      while (i > 0) {
        const p = (i - 1) >> 1
        if (heap[p][0] <= heap[i][0]) break
        ;[heap[p], heap[i]] = [heap[i], heap[p]]
        i = p
      }
    }
    const tirar = () => {
      const topo = heap[0]
      const ultimo = heap.pop()
      if (heap.length) {
        heap[0] = ultimo
        let i = 0
        for (;;) {
          const l = 2 * i + 1
          const r = l + 1
          let m = i
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r
          if (m === i) break
          ;[heap[m], heap[i]] = [heap[i], heap[m]]
          i = m
        }
      }
      return topo
    }
    const [fi, fj] = fim
    const alvo = fj * W + fi
    const h = (i, j) => {
      const dx = Math.abs(i - fi)
      const dy = Math.abs(j - fj)
      return Math.max(dx, dy) + 0.4142 * Math.min(dx, dy)
    }
    const ini = sj * W + si
    g[ini] = 0
    empurrar(ini, h(si, sj))
    const VIZ = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]]
    while (heap.length) {
      const [, no] = tirar()
      if (fechado[no]) continue
      fechado[no] = 1
      if (no === alvo) break
      const i = no % W
      const j = (no - i) / W
      for (const [di, dj, custo] of VIZ) {
        const a2 = i + di
        const b2 = j + dj
        if (a2 < 0 || b2 < 0 || a2 >= W || b2 >= H) continue
        const viz = b2 * W + a2
        if (!livre[viz] || fechado[viz]) continue
        if (di && dj && (!livre[j * W + a2] || !livre[b2 * W + i])) continue
        const ng = g[no] + custo
        if (ng < g[viz]) {
          g[viz] = ng
          veio[viz] = no
          empurrar(viz, ng + h(a2, b2))
        }
      }
    }
    if (!fechado[alvo]) return null
    const nos = []
    for (let no = alvo; no !== -1; no = veio[no]) nos.push(centroDaCelula(no % W, Math.floor(no / W)))
    nos.reverse()
    // esticar: pula pontos enquanto a reta continua livre
    const pts = [nos[0]]
    let k = 0
    while (k < nos.length - 1) {
      let m = nos.length - 1
      while (m > k + 1 && !linhaLivre(nav, nos[k], nos[m])) m -= 1
      pts.push(nos[m])
      k = m
    }
    return pts
  }

  /** Avança o ponto da rota enquanto o seguinte já está à vista (ou o atual já foi alcançado). */
  function proximoPonto(nav, rota, wi, de) {
    let i = Math.min(Math.max(1, wi), rota.length - 1)
    while (i < rota.length - 1 && (Math.hypot(rota[i][0] - de[0], rota[i][1] - de[1]) < 10 || linhaLivre(nav, de, rota[i + 1]))) i += 1
    return i
  }

  // ---------- robô que anda como gente (prova) ----------

  function mulberry32(s) {
    let a = s >>> 0
    return () => {
      a = (a + 0x6d2b79f5) >>> 0
      let t = a
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  /**
   * O robô vê a própria posição com 250 ms de atraso, decide a cada 80-160 ms,
   * erra a direção (desvio-padrão de 16°) e aperta as teclas de 8 direções,
   * como no teclado. Às vezes hesita (solta tudo por 0,2 s). Se empaca 1,5 s,
   * olha de novo e refaz o caminho. Sucesso: entrar pela porta (26 px para dentro).
   */
  function robo(fis, nav, opcoes) {
    const rnd = mulberry32(opcoes.semente)
    const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(TAU * rnd())
    const dt = 1 / 60
    const atraso = Math.round((opcoes.atraso ?? 0.25) / dt)
    const ruidoRad = ((opcoes.ruidoGraus ?? 16) * Math.PI) / 180
    const casa = opcoes.casa
    const alvo = casa.dentro
    let pos = opcoes.inicio.slice()
    let rota = caminho(nav, pos, alvo)
    if (!rota) return { ok: false, tempo: 0, motivo: 'sem caminho' }
    const historico = []
    let tecla = [0, 0]
    let proxDecisao = 0
    let hesitaAte = -1
    let marco = { t: 0, pos: pos.slice() }
    let replanos = 0
    let lateralAte = -1
    let lateral = [0, 0]
    let wi = 1
    const [x0, y0, x1, y1] = casa.ret
    const dentroDaCasa = (p) => p[0] > x0 + 8 && p[0] < x1 - 8 && p[1] > y0 + 8 && p[1] < y1 - 8
    const tMax = opcoes.tempoMax ?? 90
    let andou = 0
    for (let passo = 0; passo * dt < tMax; passo += 1) {
      const t = passo * dt
      historico.push(pos)
      const visto = historico[Math.max(0, historico.length - 1 - atraso)]
      if (t >= proxDecisao) {
        proxDecisao = t + 0.08 + rnd() * 0.08
        if (rnd() < 0.03) hesitaAte = t + 0.2
        // mira no ponto mais adiante da rota que ele enxerga do lugar onde se vê
        wi = proximoPonto(nav, rota, wi, visto)
        const mira = rota[wi]
        const ang = Math.atan2(mira[1] - visto[1], mira[0] - visto[0]) + gauss() * ruidoRad
        const oito = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4)
        tecla = [Math.round(Math.cos(oito)), Math.round(Math.sin(oito))]
        if (Math.hypot(mira[0] - visto[0], mira[1] - visto[1]) < 3) tecla = [0, 0]
      }
      let dir = t < hesitaAte ? [0, 0] : tecla
      if (t < lateralAte) dir = lateral
      const antes = pos
      pos = andar(fis, pos, dir[0], dir[1], dt)
      andou += Math.hypot(pos[0] - antes[0], pos[1] - antes[1])
      if (dentroDaCasa(pos) && Math.hypot(pos[0] - alvo[0], pos[1] - alvo[1]) < 30) return { ok: true, tempo: Math.round(t * 100) / 100, replanos, andou: Math.round(andou) }
      if (t - marco.t >= 1.5) {
        if (Math.hypot(pos[0] - marco.pos[0], pos[1] - marco.pos[1]) < 6) {
          replanos += 1
          rota = caminho(nav, pos, alvo) || rota
          wi = 1
          const a = rnd() * TAU
          lateral = [Math.round(Math.cos(a)), Math.round(Math.sin(a))]
          lateralAte = t + 0.3
        }
        marco = { t, pos: pos.slice() }
      }
    }
    return { ok: false, tempo: tMax, replanos, andou: Math.round(andou), fim: pos.map(Math.round) }
  }

  return {
    G, MUNDO, ENQUADRE, PRINT, CENTRO, RAIO_DO_PINO, INICIO_DO_PINO, VELOCIDADE, CASAS, PORTA, VAO_DA_PORTA, PECAS, PLACAS, ARVORES_DE_FORA, PECAS_DE_SEBE,
    PECAS_DE_DENTRO, ESTRADAS, LARGURA_DO_CAMINHO, RAIO_DO_ANEL,
    pontoDaPorta, caixaDaPorta, centroDaPlaca, caminhoDaPorta, amostrarLinha,
    imagemDaPeca, temImagem, imagemDoTelhado, pintarChaoDepois, pintarChaoAntes, pintarSombraDaCasa, ladrilho,
    obstaculosDepois, obstaculosAntes, montarFisica, montarNavegacao, folga, resolver, andar, caminho, proximoPonto, robo, formaDaPeca,
  }
})()
