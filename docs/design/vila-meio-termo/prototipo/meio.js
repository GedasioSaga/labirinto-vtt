/*
 * MEIO-TERMO — a mesma vila, entre a Textura (realista) e o Estilo Mother (cartoon).
 *
 * Pedido do usuário (21/10/2026): da Textura, o detalhe de material dos objetos
 * (barril, caixa, banco, poço, fogueira, troncos) e a porta, só polida; do Estilo
 * Mother, a árvore, as lajes da porta, as jardineiras, o campo florido do poço, o
 * arco com a flor, a placa de seta, o chão de grama com flores que não repete, o
 * barranco, a trilha de terra e a chaminé. A árvore da Textura saiu de vez.
 *
 * Reuso, sem cópia (o montar.cjs junta tudo):
 * - Textura (vila.js + objetos.js): os pintores das peças, chamados com os materiais
 *   trocados pelos da PALETA abaixo só durante o desenho;
 * - Estilo Mother (mother.js virado fábrica): uma segunda cópia, `Mm`, com esta paleta,
 *   um traço mais fino e um contorno mais claro; dela saem a árvore, o arco, a
 *   jardineira, a placa de seta, a sebe, o barranco, as trilhas, as lajes, as flores,
 *   o pino e o palheiro do estábulo;
 * - o telhado do app (TelhadoLab), com as cores daqui.
 * Novo aqui: o chão (grama gerada ponto a ponto, praça pedra a pedra, grão por cima),
 * as chaminés, a porta polida, a placa da casa e o levantamento do preto.
 *
 * Mesma colisão do Estilo Mother (mesmas peças no mesmo lugar). Determinístico:
 * nenhum Math.random; todo sorteio é `hash` de objetos.js.
 * Toda cor sai da PALETA (a prova confere que não há cor escrita fora dela).
 */
// eslint-disable-next-line no-var, no-unused-vars
var Meio = (function () {
  'use strict'

  const V = Vila
  const VI = Vila._i
  const OI = Objetos._i
  const { hash } = OI
  const TAU = Math.PI * 2

  // <PALETA> as únicas cores do mapa no Meio-termo: 38 cores base, cada uma com realce, sombra e contorno derivados.
  const PALETA = {
    // chão: entre o oliva escuro da Textura e o menta do Estilo Mother
    grama: { base: '#8cbf80', realce: '#a2cc92', sombra: '#76ac6d' },
    terra: { base: '#dda56c', realce: '#e7b882', sombra: '#c78d58' },
    praca: { base: '#dcd0b6', realce: '#ebe2cd', sombra: '#bcae94' },
    barranco: { base: '#aa745c', realce: '#c28b71', sombra: '#915f4a' },
    // flores, frutas e o fogo
    rosa: { base: '#e8a2c4' },
    amarelo: { base: '#f0d266' },
    violeta: { base: '#a87fcb' },
    branco: { base: '#f3efe2' },
    laranja: { base: '#e6793f' },
    fogo: { base: '#e39446' },
    // o que vem do Estilo Mother: madeira das placas e da jardineira, pedra das lajes, copas
    madeiraClara: { base: '#e2b98a' },
    madeira: { base: '#b9895f' },
    madeiraEscura: { base: '#8d6239' },
    reboco: { base: '#efe7cf' },
    pedra: { base: '#c3c0b2' },
    metal: { base: '#767a77' },
    folha: { base: '#55ae74' },
    folhaEscura: { base: '#469a63' },
    palha: { base: '#d6b56a' },
    ardosia: { base: '#5f6a66' },
    // telhados do app, no meio do caminho entre as cores da Textura e as do Estilo Mother
    telhaAzul: { base: '#43639a' },
    telhaAzulClara: { base: '#7189a6' },
    telhaMadeira: { base: '#867a6a' },
    telhaTerracota: { base: '#b56e50' },
    telhaVerde: { base: '#7f9a64' },
    // os materiais da Textura, mais claros e quentes para conviver com o chão
    carvalho: { base: '#a07b51' },
    nogueira: { base: '#775739' },
    pinho: { base: '#b9995f' },
    ferro: { base: '#5d6164' },
    latao: { base: '#b89552' },
    linho: { base: '#d4c7a5' },
    vinho: { base: '#8f4a49' },
    musgo: { base: '#6f7d4b' },
    ocre: { base: '#b2904f' },
    granito: { base: '#9a968b' },
    corda: { base: '#b49c6d' },
    lenha: { base: '#6e5745' },
    agua: { base: '#40707e' },
  }
  // </PALETA>

  /** Contorno derivado: nunca abaixo desta luminância (o preto puro tem 0). */
  const PISO_DO_CONTORNO = 0.06
  /** Nenhum pixel opaco de peça ou telhado fica abaixo desta luminância (a prova usa 0,03). */
  const PISO_DE_LUZ = 0.045
  /** O traço do Estilo Mother, mais fino (72%) e mais claro (o contorno guarda 60% da luz da cor, e não 50%). */
  const Mm = fabricarMother({ paleta: PALETA, piso: PISO_DO_CONTORNO, traco: 0.72, escuroDoContorno: 0.6, fisica: () => Mae.fisica() })
  const MI = Mm._i
  const tons = Mm.tons
  const { tinta, circulo, ret, pintar, tracos, sombraNoChao, caminhoDe, misturar, hexRgb } = MI

  const canvasDe = (w, h) => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    return c
  }
  const limitar = (v, a, b) => (v < a ? a : v > b ? b : v)

  // ---------- o preto levantado: nenhum pixel opaco abaixo do piso de luz ----------

  const LINEAR = new Float32Array(256)
  for (let i = 0; i < 256; i += 1) {
    const u = i / 255
    LINEAR[i] = u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4
  }
  let corDoPiso = null
  /** Mistura os pixels escuros demais na sombra quente da nogueira (o escuro da paleta), sem mexer no resto. */
  function levantarPixels(d) {
    if (!corDoPiso) {
      const [r, g, b] = hexRgb(tons('nogueira').contorno)
      corDoPiso = [r, g, b, 0.2126 * LINEAR[r] + 0.7152 * LINEAR[g] + 0.0722 * LINEAR[b]]
    }
    const [pr, pg, pb, lp] = corDoPiso
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 160) continue
      const L = 0.2126 * LINEAR[d[i]] + 0.7152 * LINEAR[d[i + 1]] + 0.0722 * LINEAR[d[i + 2]]
      if (L >= PISO_DE_LUZ) continue
      const t = Math.min(1, ((PISO_DE_LUZ - L) / Math.max(0.001, lp - L)) * 1.25)
      d[i] += (pr - d[i]) * t
      d[i + 1] += (pg - d[i + 1]) * t
      d[i + 2] += (pb - d[i + 2]) * t
    }
  }
  function levantarCanvas(cv) {
    const g = cv.getContext('2d')
    const img = g.getImageData(0, 0, cv.width, cv.height)
    levantarPixels(img.data)
    g.putImageData(img, 0, 0)
  }
  /** Grão leve de madeira e pedra nas peças desenhadas a traço (arco, jardineira, placa, palha): ±4% de luz. */
  function granular(cv, forca, semente) {
    const g = cv.getContext('2d')
    const img = g.getImageData(0, 0, cv.width, cv.height)
    const d = img.data
    const W = cv.width
    for (let i = 0, p = 0; i < d.length; i += 4, p += 1) {
      if (d[i + 3] < 200) continue
      const x = p % W
      const y = (p - x) / W
      const k = 1 + (hash(x >> 1, y, semente) - 0.5) * forca * 2
      d[i] = limitar(d[i] * k, 0, 255)
      d[i + 1] = limitar(d[i + 1] * k, 0, 255)
      d[i + 2] = limitar(d[i + 2] * k, 0, 255)
    }
    g.putImageData(img, 0, 0)
  }

  // ---------- os materiais da Textura, trocados pelos da paleta só durante o desenho ----------

  /** Material (ou cor interna) da Textura -> [cor da paleta, fator de luz]. */
  const TROCA = {
    carvalho: ['carvalho', 1], nogueira: ['nogueira', 1], pinho: ['pinho', 1], cerejeira: ['nogueira', 1.12], velha: ['granito', 0.85],
    ferro: ['ferro', 1], latao: ['latao', 1], linho: ['linho', 1], vinho: ['vinho', 1], azul: ['telhaAzul', 1], musgo: ['musgo', 1],
    ocre: ['ocre', 1], granito: ['granito', 1], arenito: ['pinho', 0.95], ardosia: ['ardosia', 1], palha: ['palha', 1], corda: ['corda', 1],
    arame: ['ferro', 1.05], lenhaCarvalho: ['lenha', 1], lenhaPinho: ['lenha', 1.1], lenhaBetula: ['linho', 1],
  }
  const TROCA_INTERNA = { LENCOL: ['linho', 1.03], PREGO: ['ferro', 0.85], BURACO: ['nogueira', 0.6], CINZA: ['granito', 0.72], CHAMA: ['fogo', 1] }
  const TROCA_DA_VILA = { AGUA: ['agua', 1], BRILHO_DA_AGUA: ['reboco', 1], BARRO: ['telhaTerracota', 1], TERRA: ['nogueira', 0.7], VIDRO: ['amarelo', 1], PAPEL: ['linho', 1.05] }
  const FOLHAS_DO_MEIO = [['folha', 0.92], ['folha', 1], ['folhaEscura', 1]]
  const PRODUTOS_DO_MEIO = [['vinho', 1], ['musgo', 1], ['ocre', 1], ['violeta', 1], ['laranja', 1]]

  const corDe = ([nome, fator]) => OI.escalar(OI.rgb(tons(nome).base), fator).map((v) => limitar(Math.round(v), 0, 255))
  let trocas = null
  function montarTrocas() {
    const lista = []
    for (const [nome, par] of Object.entries(TROCA)) if (OI.MATERIAIS[nome] && OI.MATERIAIS[nome].rgb) lista.push([OI.MATERIAIS[nome], corDe(par)])
    for (const [nome, par] of Object.entries(TROCA_INTERNA)) lista.push([OI.INTERNAS[nome], corDe(par)])
    for (const [nome, par] of Object.entries(TROCA_DA_VILA)) lista.push([VI.LISOS[nome], corDe(par)])
    VI.FOLHAS.forEach((m, i) => lista.push([m, corDe(FOLHAS_DO_MEIO[i % FOLHAS_DO_MEIO.length])]))
    VI.PRODUTOS.forEach((m, i) => lista.push([m, corDe(PRODUTOS_DO_MEIO[i % PRODUTOS_DO_MEIO.length])]))
    return { lista, sombra: hexRgb(tons('ardosia').contorno) }
  }
  /** Roda `f` com os materiais da Textura na paleta do Meio-termo e devolve tudo como estava. */
  function comMateriaisDoMeio(f) {
    trocas ||= montarTrocas()
    const antes = trocas.lista.map(([m]) => m.rgb)
    const sombraAntes = OI.SOMBRA_COR.slice()
    for (const [m, cor] of trocas.lista) m.rgb = cor
    OI.SOMBRA_COR.splice(0, 3, ...trocas.sombra)
    try {
      return f()
    } finally {
      trocas.lista.forEach(([m], i) => {
        m.rgb = antes[i]
      })
      OI.SOMBRA_COR.splice(0, 3, ...sombraAntes)
    }
  }

  // ---------- as peças: cada tipo com o pintor do lado de onde veio ----------

  /** Do Estilo Mother (o resto, e todo móvel, é da Textura). */
  const DO_MOTHER = new Set(['arvore', 'arco', 'jardineira', 'placa', 'sebe'])
  /** As de madeira a traço ganham o grão; a árvore e a sebe ficam lisas como no Mother. */
  const COM_GRAO = new Set(['arco', 'jardineira', 'placa'])

  const guardadas = new Map()
  const sementeDaTextura = (p) => p.semente || Math.round(p.x + p.y) % 5
  function chaveDaPeca(p) {
    if (DO_MOTHER.has(p.t)) return ['m', p.t, p.R || '', p.semente ?? Math.round(p.x + p.y) % 7, p.ang ?? '', p.comp || '', p.vertical ? 'v' : ''].join('|')
    if (p.movel) return `t|m|${p.t}|${p.w}|${p.h}`
    return ['t', p.t, p.vertical ? 'v' : '', p.tecido || '', p.R || '', sementeDaTextura(p), p.ang || '', p.comp || ''].join('|')
  }
  function pintarPeca(p, S) {
    if (DO_MOTHER.has(p.t)) {
      const img = Mm.imagemDaPeca(p, S)
      if (COM_GRAO.has(p.t)) granular(img.canvas, 0.045, 901)
      return img
    }
    const img = comMateriaisDoMeio(() => (p.movel
      ? Objetos.gerarSprite({ tipo: p.t, largura: p.w, altura: p.h, estilo: 'cima', vista: 'frente', materiais: {} }, S)
      : VI.pintarDesenho(p.t, { ...p, semente: sementeDaTextura(p) }, S)))
    levantarCanvas(img.canvas)
    return img
  }
  /** A imagem da peça na resolução S (1 ou 2 px por px do mapa), no formato de vila.js. */
  function imagemDaPeca(p, S) {
    const chave = chaveDaPeca(p) + '@' + S
    let img = guardadas.get(chave)
    if (!img) {
      img = pintarPeca(p, S)
      guardadas.set(chave, img)
    }
    return img
  }
  const temImagem = (p, S) => guardadas.has(chaveDaPeca(p) + '@' + S)

  // ---------- o chão: gerado ponto a ponto, sem ladrilho que repete ----------

  const M = V.MUNDO

  /** Ruído de valor suave em 2 dimensões, em -1..1. */
  function ruido2(x, y, s) {
    const i = Math.floor(x)
    const j = Math.floor(y)
    const fx = x - i
    const fy = y - j
    const u = fx * fx * (3 - 2 * fx)
    const v = fy * fy * (3 - 2 * fy)
    const a = hash(i, j, s)
    const b = hash(i + 1, j, s)
    const c = hash(i, j + 1, s)
    const d = hash(i + 1, j + 1, s)
    return ((a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v) * 2 - 1
  }

  /**
   * As manchas da grama: três escalas de ruído (230, 80 e 27 px) numa imagem de 1/4 do mundo,
   * esticada com suavização. Clareia para o amarelo no claro e escurece para o verde fundo no escuro.
   */
  const PASSO_DAS_MANCHAS = 4
  let manchas = null
  function pintarManchas() {
    if (manchas) return manchas
    const W = Math.ceil(M.w / PASSO_DAS_MANCHAS)
    const H = Math.ceil(M.h / PASSO_DAS_MANCHAS)
    const cv = canvasDe(W, H)
    const g = cv.getContext('2d')
    const img = g.createImageData(W, H)
    const d = img.data
    const t = tons('grama')
    const base = hexRgb(t.base)
    const claro = hexRgb(t.realce)
    const escuro = hexRgb(t.sombra)
    for (let j = 0, o = 0; j < H; j += 1) {
      const y = M.y0 + (j + 0.5) * PASSO_DAS_MANCHAS
      for (let i = 0; i < W; i += 1, o += 4) {
        const x = M.x0 + (i + 0.5) * PASSO_DAS_MANCHAS
        const n = ruido2(x / 230, y / 230, 811) * 0.5 + ruido2(x / 80, y / 80, 812) * 0.32 + ruido2(x / 27, y / 27, 813) * 0.18
        const alvo = n > 0 ? claro : escuro
        const k = limitar(Math.abs(n) * 1.5, 0, 1)
        d[o] = base[0] + (alvo[0] - base[0]) * k
        d[o + 1] = base[1] + (alvo[1] - base[1]) * k
        d[o + 2] = base[2] + (alvo[2] - base[2]) * k
        d[o + 3] = 255
      }
    }
    g.putImageData(img, 0, 0)
    manchas = cv
    return cv
  }

  /** O grão de papel por cima de tudo: ruído branco em meia resolução, esticado (fica com 2 px, macio). */
  const FORCA_DO_GRAO = 22
  let grao = null
  function pintarGrao() {
    if (grao) return grao
    const W = Math.ceil(M.w / 2)
    const H = Math.ceil(M.h / 2)
    const cv = canvasDe(W, H)
    const g = cv.getContext('2d')
    const img = g.createImageData(W, H)
    const d = img.data
    for (let j = 0, o = 0; j < H; j += 1) {
      for (let i = 0; i < W; i += 1, o += 4) {
        const v = 128 + (hash(i, j, 821) - 0.5) * FORCA_DO_GRAO
        d[o] = v
        d[o + 1] = v
        d[o + 2] = v
        d[o + 3] = 255
      }
    }
    g.putImageData(img, 0, 0)
    grao = cv
    return cv
  }

  /** Só a grama, com flores e tufos, sem estrada, praça nem barranco (é ela que a prova de repetição olha). */
  function pintarGrama(ctx, cen, k) {
    ctx.fillStyle = tons('grama').base
    ctx.fillRect(M.x0, M.y0, M.w, M.h)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(pintarManchas(), M.x0, M.y0, M.w, M.h)
  }
  function pintarDetalhes(ctx, cen, k) {
    for (const d of cen.detalhes) {
      const img = MI.carimbo(d.t === 'flor' ? 'flor:' + d.cor : d.t + ':' + d.v, k)
      ctx.drawImage(img.canvas, d.x - img.L / 2, d.y - img.L / 2, img.L, img.L)
    }
  }
  function pintarGrao2(ctx) {
    ctx.save()
    ctx.globalCompositeOperation = 'soft-light'
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(pintarGrao(), M.x0, M.y0, M.w, M.h)
    ctx.restore()
  }

  /** Estradas de terra (o desenho do Estilo Mother, na terra mais calma). */
  function pintarEstradas(ctx, cen) {
    const te = tons('terra')
    ctx.lineWidth = 2.4
    ctx.strokeStyle = te.sombra
    for (const e of cen.estradas) ctx.stroke(e.forma)
    ctx.fillStyle = te.base
    for (const e of cen.estradas) ctx.fill(e.forma)
    ctx.fillStyle = te.realce
    for (const e of cen.estradas) ctx.fill(e.miolo)
    ctx.fillStyle = te.sombra
    for (const e of cen.estradas) for (const [x, y, r] of e.pedrinhas) ctx.fill(MI.elipse(x, y, r, r * 0.7, x * 0.1))
  }

  /**
   * A praça, pedra a pedra: fileiras tortas de pedras de largura sorteada pela posição.
   * Nenhuma fileira é igual a outra (o sorteio usa a fileira e a pedra), então nada se repete.
   * A ilha do poço fica de fora (furo), e a grama aparece por baixo.
   */
  const ALTURA_DA_FILEIRA = 12
  function pintarPraca(ctx, cen) {
    const t = tons('praca')
    const contorno = caminhoDe(cen.praca, true)
    ctx.lineWidth = 3
    ctx.strokeStyle = t.sombra
    ctx.stroke(contorno)
    const recorte = new Path2D()
    recorte.addPath(contorno)
    recorte.addPath(caminhoDe(cen.ilha, true))
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    for (const [x, y] of cen.praca) {
      x0 = Math.min(x0, x)
      y0 = Math.min(y0, y)
      x1 = Math.max(x1, x)
      y1 = Math.max(y1, y)
    }
    ctx.save()
    ctx.clip(recorte, 'evenodd')
    // rejunte e aro de luz macios: a pedra lê como pedra sem virar uma grade de linhas fortes
    ctx.fillStyle = misturar(t.base, t.sombra, 0.72)
    ctx.fillRect(x0 - 6, y0 - 6, x1 - x0 + 12, y1 - y0 + 12)
    const luz = new Path2D()
    const tons4 = [new Path2D(), new Path2D(), new Path2D(), new Path2D()]
    const H = ALTURA_DA_FILEIRA
    for (let j = 0, y = y0 - 4; y < y1 + 4; j += 1, y += H) {
      let x = x0 - 6 - hash(j, 1, 831) * 22
      for (let i = 0; x < x1 + 6; i += 1) {
        const w = 13 + hash(i, j, 832) * 12
        const dy = (hash(i, j, 833) - 0.5) * 1.4
        const r = hash(i, j, 834)
        luz.roundRect(x + 0.8, y + 0.8 + dy, w - 1.8, H - 1.8, 4)
        tons4[r < 0.12 ? 1 : r > 0.93 ? 2 : r > 0.87 ? 3 : 0].roundRect(x + 1.5, y + 1.5 + dy, w - 2.6, H - 2.6, 3.6)
        x += w
      }
    }
    ctx.fillStyle = misturar(t.base, t.realce, 0.6)
    ctx.fill(luz)
    const cores = [t.base, misturar(t.base, t.realce, 0.4), misturar(t.base, t.sombra, 0.22), misturar(t.base, tons('terra').base, 0.08)]
    tons4.forEach((p, i) => {
      ctx.fillStyle = cores[i]
      ctx.fill(p)
    })
    ctx.restore()
    // a beira da ilha: uma linha fina de grama funda, como no Mother
    const ilha = caminhoDe(cen.ilha, true)
    ctx.lineWidth = 2
    ctx.strokeStyle = tons('grama').sombra
    ctx.stroke(ilha)
    ctx.lineWidth = 0.8
    ctx.strokeStyle = tinta(tons('grama').contorno, 0.5)
    ctx.stroke(ilha)
  }

  const chaos = new Map()
  const api = { S: 1, telhados2: false }
  function chao(k) {
    if (!chaos.has(k)) for (const etapa of etapasDoChao(k)) etapa()
    return chaos.get(k)
  }
  function chaoPronto() {
    return (api.S >= 2 && chaos.get(2)) || chao(1)
  }

  /** Uma faixa horizontal do chão (do y0 ao y1 do mundo), com todas as camadas, num canvas próprio. */
  function pintarFaixa(k, y0, y1) {
    const cen = Mm.montarCenario()
    const cv = canvasDe(Math.ceil(M.w * k), Math.ceil((y1 - y0) * k))
    const ctx = cv.getContext('2d')
    ctx.setTransform(k, 0, 0, k, -M.x0 * k, -y0 * k)
    ctx.beginPath()
    ctx.rect(M.x0, y0, M.w, y1 - y0)
    ctx.clip()
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    pintarGrama(ctx, cen, k)
    pintarEstradas(ctx, cen)
    pintarPraca(ctx, cen)
    for (const c of V.CASAS) MI.pintarSoleira(ctx, c)
    for (const b of cen.barranco) MI.pintarBarranco(ctx, b)
    for (const c of V.CASAS) MI.pintarDentroDaCasa(ctx, c, k)
    pintarDetalhes(ctx, cen, k)
    pintarGrao2(ctx)
    // o raster sai aqui, e não no primeiro quadro (o canvas é preguiçoso). Uma leitura só por canvas:
    // o Chrome tira da placa de vídeo o canvas lido várias vezes, e aí todo quadro fica mais lento.
    ctx.getImageData(0, 0, 1, 1)
    return cv
  }

  /**
   * O chão 1x sai numa passada só (vai na primeira pintura). O 2x sai em 4 faixas, uma por tarefa
   * da fila, e uma última tarefa cola as faixas: nenhuma vira tarefa longa.
   */
  const FAIXAS_DO_2X = 4
  const tempoDasEtapas = new Map()
  function etapasDoChao(k) {
    const medir = (nome, f) => () => {
      const t0 = performance.now()
      f()
      tempoDasEtapas.set(nome + '@' + k, Math.round((performance.now() - t0) * 10) / 10)
    }
    if (k === 1) return [medir('inteiro', () => chaos.set(1, { canvas: pintarFaixa(1, M.y0, M.y1), k: 1 }))]
    const faixas = []
    const etapas = []
    for (let i = 0; i < FAIXAS_DO_2X; i += 1) {
      const a = M.y0 + (M.h * i) / FAIXAS_DO_2X
      const b = M.y0 + (M.h * (i + 1)) / FAIXAS_DO_2X
      etapas.push(medir('faixa' + i, () => {
        faixas[i] = { canvas: pintarFaixa(k, a, b), y: a }
      }))
    }
    etapas.push(medir('colar', () => {
      const cv = canvasDe(Math.ceil(M.w * k), Math.ceil(M.h * k))
      const g = cv.getContext('2d')
      for (const f of faixas) g.drawImage(f.canvas, 0, Math.round((f.y - M.y0) * k))
      g.getImageData(0, 0, 1, 1)
      chaos.set(k, { canvas: cv, k })
    }))
    return etapas
  }

  /** Para a prova de repetição: só a grama (manchas, flores, tufos e grão), o mundo inteiro, a 1x. */
  function camadaDaGrama() {
    const cen = Mm.montarCenario()
    const cv = canvasDe(Math.ceil(M.w), Math.ceil(M.h))
    const ctx = cv.getContext('2d', { willReadFrequently: true })
    ctx.setTransform(1, 0, 0, 1, -M.x0, -M.y0)
    pintarGrama(ctx, cen, 1)
    pintarDetalhes(ctx, cen, 1)
    pintarGrao2(ctx)
    return cv
  }

  // ---------- telhados: os do app (telha e madeira) e a palha do Mother, todos com chaminé ----------

  /** [modelo, cor]: 'telhas' e 'madeira' são o pintor do app; 'palha' é o do Estilo Mother. */
  const TELHADOS = {
    taverna: ['telhas', 'telhaAzul'],
    guilda: ['telhas', 'telhaAzulClara'],
    ferraria: ['madeira', 'telhaMadeira'],
    boticario: ['telhas', 'telhaTerracota'],
    emporio: ['telhas', 'ardosia'],
    templo: ['telhas', 'telhaVerde'],
    estabulo: ['palha', 'palha'],
  }

  /**
   * Chaminé na água de trás (o lado oposto à porta), a meio caminho entre o cume e o beiral
   * e na metade da casa mais longe da porta: nunca em cima da porta nem da placa.
   */
  function posicaoDaChamine(c) {
    const [x0, y0, x1, y1] = c.ret
    const [cx, cy] = c.centro
    const [nx, ny] = c.normal
    const [ex, ey] = c.eixo
    const meiaFundo = nx ? (x1 - x0) / 2 : (y1 - y0) / 2
    const meiaFrente = nx ? (y1 - y0) / 2 : (x1 - x0) / 2
    const daPorta = (c.porta[0] - cx) * ex + (c.porta[1] - cy) * ey
    const lado = daPorta > 0 ? -1 : 1
    return [cx - nx * meiaFundo * 0.46 + ex * lado * meiaFrente * 0.52, cy - ny * meiaFundo * 0.46 + ey * lado * meiaFrente * 0.52]
  }
  const LADO_DA_CHAMINE = 11
  function desenharChamine(g, c) {
    const [x, y] = posicaoDaChamine(c)
    const h = LADO_DA_CHAMINE / 2
    sombraNoChao(g, ret(x - h, y - h, 2 * h, 2 * h, 1.6), 3.4, 4.2, 0.3)
    // o volume: a face do lado da sombra aparece embaixo e à direita
    pintar(g, ret(x - h + 1.2, y - h + 1.6, 2 * h, 2 * h, 1.6), 'pedra', { luz: 0, contorno: 1 })
    g.fillStyle = tinta(tons('pedra').contorno, 0.45)
    g.fill(ret(x - h + 1.2, y - h + 1.6, 2 * h, 2 * h, 1.6))
    const corpo = ret(x - h, y - h, 2 * h, 2 * h, 1.6)
    pintar(g, corpo, 'pedra', { luz: 1, contorno: 1.3 })
    MI.dentro(g, corpo, () => tracos(g, tinta(tons('pedra').contorno, 0.4), 0.7, (q) => {
      q.moveTo(x - h, y - 1.2)
      q.lineTo(x + h, y - 1.2)
      q.moveTo(x - 1, y - h)
      q.lineTo(x - 1, y - 1.2)
      q.moveTo(x + 2.2, y - 1.2)
      q.lineTo(x + 2.2, y + h)
    }))
    pintar(g, ret(x - 2.8, y - 2.8, 5.6, 5.6, 1), 'metal', { luz: 0, contorno: 1.1 })
    g.fillStyle = tons('metal').contorno
    g.fill(ret(x - 1.9, y - 1.9, 3.8, 3.8, 0.8))
  }

  const telhados = new Map()
  function imagemDoTelhado(c, k) {
    const chave = c.id + '@' + k
    if (!telhados.has(chave)) telhados.set(chave, pintarTelhadoDoMeio(c, k, true))
    return telhados.get(chave)
  }
  /** Para a prova de presença da chaminé: o mesmo telhado, sem ela (não fica guardado). */
  const telhadoSemChamine = (c) => pintarTelhadoDoMeio(c, 1, false)
  function pintarTelhadoDoMeio(c, k, comChamine) {
    const t0 = performance.now()
    const [modelo, cor] = TELHADOS[c.id]
    let cv
    let r
    if (modelo === 'palha') {
      const m = Mm.imagemDoTelhado(c, k)
      cv = canvasDe(m.canvas.width, m.canvas.height)
      cv.getContext('2d').drawImage(m.canvas, 0, 0)
      granular(cv, 0.05, 911)
      r = { canvas: cv, x: m.x, y: m.y, w: m.w, h: m.h }
    } else {
      const [x0, y0, x1, y1] = c.ret
      const img = TelhadoLab.pintarTelhado([{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }], modelo, tons(cor).base, k)
      levantarPixels(img.pixels)
      cv = canvasDe(Math.max(1, img.largura), Math.max(1, img.altura))
      if (img.largura > 0) cv.getContext('2d').putImageData(new ImageData(img.pixels, img.largura, img.altura), 0, 0)
      r = { canvas: cv, x: img.origemX, y: img.origemY, w: img.largura / img.escala, h: img.altura / img.escala }
    }
    const g = cv.getContext('2d')
    const e = cv.width / r.w
    g.setTransform(e, 0, 0, e, -r.x * e, -r.y * e)
    g.lineJoin = 'round'
    g.lineCap = 'round'
    if (comChamine) desenharChamine(g, c)
    g.getImageData(0, 0, 1, 1)
    return Object.assign(r, { k, e, ms: performance.now() - t0 })
  }

  // ---------- a porta do Resident Evil, polida, e a placa da casa ----------

  /** Folha clara nos telhados de cor, nogueira no telhado claro do estábulo (a mesma regra da Textura). */
  const madeiraDaFolha = (c) => (c.id === 'estabulo' ? 'nogueira' : 'pinho')
  /** A cor da tábua do meio da folha (a prova lê esse pixel por cima do telhado). */
  const corDaFolha = (c) => tons(madeiraDaFolha(c)).base

  /**
   * 36 x 24 px, como na Textura: degrau de pedra, batente escuro, folha de três tábuas,
   * dobradiças e maçaneta. O polimento: veio e um nó na madeira, batente com chanfro,
   * soleira, junta no degrau, um ponto de luz quente no degrau e o brilho do latão.
   */
  function pintarPorta(g, c) {
    g.save()
    g.translate(c.porta[0], c.porta[1])
    g.rotate(c.angulo)
    // degrau: duas pedras, realce em cima, sombra em baixo e um pingo de luz que vem da fresta
    const tp = tons('pedra')
    g.fillStyle = MI.sombraDoChao(0.3)
    g.fill(ret(-17, 9, 36, 8, 2.4))
    g.fillStyle = tp.base
    g.fill(ret(-18, 7.5, 36, 8, 2.2))
    g.fillStyle = tp.realce
    g.fillRect(-16.6, 8.2, 33.2, 1.2)
    g.fillStyle = tp.sombra
    g.fillRect(-17, 13.4, 34, 1.4)
    g.fillStyle = tinta(tp.contorno, 0.6)
    g.fillRect(4.6, 8.4, 0.8, 6.4)
    for (const [x, y] of [[-12, 11.6], [-6.5, 10.4], [9.5, 12], [13.6, 10.6]]) g.fillRect(x, y, 0.8, 0.8)
    const luz = g.createRadialGradient(0, 9.2, 0, 0, 9.2, 11)
    luz.addColorStop(0, tinta(tons('amarelo').base, 0.34))
    luz.addColorStop(1, tinta(tons('amarelo').base, 0))
    g.fillStyle = luz
    g.fill(ret(-18, 7.5, 36, 8, 2.2))
    g.lineWidth = 0.8
    g.strokeStyle = tp.contorno
    g.stroke(ret(-18, 7.5, 36, 8, 2.2))
    // batente escuro com chanfro (luz em cima à esquerda)
    const tb = tons('nogueira')
    g.fillStyle = tb.contorno
    g.fill(ret(-16, -9, 32, 18, 1.8))
    g.fillStyle = tinta(tb.base, 0.85)
    g.fillRect(-15.2, -8.3, 30.4, 1)
    g.fillRect(-15.2, -8.3, 1, 15.6)
    g.fillStyle = tinta(tb.sombra, 0.9)
    g.fillRect(14.2, -7.6, 1, 15.6)
    // soleira de madeira sob a folha
    g.fillStyle = tb.sombra
    g.fillRect(-13.4, 8.4, 26.8, 1.3)
    // a folha: três tábuas, a do meio na cor da madeira, as dos lados um pouco mais claras e mais escuras
    const tf = tons(madeiraDaFolha(c))
    const tabuas = [[-12.5, -4.2, misturar(tf.base, tf.sombra, 0.22)], [-4.2, 4.2, tf.base], [4.2, 12.5, misturar(tf.base, tf.realce, 0.25)]]
    for (const [a, b, cor] of tabuas) {
      g.fillStyle = cor
      g.fillRect(a, -6.5, b - a, 15)
    }
    // veio: linhas finas e onduladas ao longo de cada tábua (longe do ponto que a prova lê)
    tracos(g, tinta(tf.contorno, 0.28), 0.5, (q) => {
      for (const [u, fase] of [[-10.4, 0.3], [-7.2, 1.7], [2.6, 0.9], [6.8, 2.4], [10.2, 0.2]]) {
        q.moveTo(u, -6.3)
        for (let n = -6.3; n <= 8.3; n += 1.2) q.lineTo(u + Math.sin(n * 0.7 + fase) * 0.45, n)
      }
    })
    g.fillStyle = tinta(tf.contorno, 0.4)
    g.fill(MI.elipse(-8.6, 3.2, 1.1, 0.8, 0.3))
    // juntas entre as tábuas, realce no topo, sombra no pé
    g.fillStyle = tinta(tf.contorno, 0.6)
    g.fillRect(-4.6, -6.5, 0.8, 15)
    g.fillRect(3.8, -6.5, 0.8, 15)
    g.fillStyle = tinta(tf.realce, 0.7)
    g.fillRect(-12.5, -6.5, 25, 1)
    g.fillStyle = tinta(tf.contorno, 0.35)
    g.fillRect(-12.5, 7.3, 25, 1.2)
    // dobradiças de ferro, com ponta redonda e rebite
    const tm = tons('ferro')
    for (const y of [-3.8, 4.4]) {
      g.fillStyle = tm.base
      g.fill(ret(-12.9, y - 0.9, 6.6, 1.8, 0.9))
      g.fillStyle = tinta(tm.realce, 0.8)
      g.fillRect(-12.4, y - 0.85, 5.4, 0.5)
      g.fill(circulo(-7.6, y, 0.45))
    }
    // maçaneta de latão: espelho, argola e o brilho
    const tl = tons('latao')
    g.fillStyle = tl.sombra
    g.fill(ret(6.7, -0.9, 2.4, 4.6, 0.8))
    g.fillStyle = tl.base
    g.fill(circulo(7.9, 1.4, 1.5))
    g.lineWidth = 0.5
    g.strokeStyle = tl.contorno
    g.stroke(circulo(7.9, 1.4, 1.5))
    g.fillStyle = tinta(tons('branco').base, 0.85)
    g.fill(circulo(7.5, 0.9, 0.45))
    g.restore()
  }

  /** Placa de madeira clara com o ícone da função, presa ao lado da porta por um suporte de ferro. */
  function pintarPlaca(g, c, desenharIcone) {
    const [x, y] = V.centroDaPlaca(c)
    const suporte = V.pontoDaPorta(c, 31 * c.placa, -5)
    tracos(g, tons('ferro').base, 1.5, (q) => {
      q.moveTo(suporte[0], suporte[1])
      q.lineTo(x, y)
    })
    g.save()
    g.fillStyle = MI.sombraDoChao(0.3)
    g.fill(ret(x - 10.5 + 1.6, y - 10 + 2, 21, 20, 3.5))
    pintar(g, ret(x - 10.5, y - 10, 21, 20, 3.5), 'madeiraClara', { luz: 1, contorno: 1.4 })
    g.translate(x - 7, y - 7)
    g.scale(14 / 16, 14 / 16)
    desenharIcone(g, c.icone, tons('madeira').contorno, tons('madeiraClara').base)
    g.restore()
  }

  /** Porta e placa vão por cima do telhado a cada quadro: desenhadas uma vez por casa e resolução, depois só coladas. */
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
      g.lineJoin = 'round'
      g.lineCap = 'round'
      pintarPorta(g, c)
      pintarPlaca(g, c, desenharIcone)
      img = { canvas: cv, x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
      portas.set(chave, img)
    }
    ctx.drawImage(img.canvas, img.x, img.y, img.w, img.h)
  }

  // ---------- trabalho em segundo plano (a fila é a de pagina.js) ----------

  function prepararLadrilhos(k) {
    Mm.prepararLadrilhos(k)
    pintarManchas()
    pintarGrao()
  }

  let etapasDoChao2 = null
  function pedirNitidez(enfileirar) {
    if (api.S >= 2) return
    Mae.EXTERNAS.forEach((p, i) => {
      if (!temImagem(p, 2)) enfileirar('e2:' + i, () => imagemDaPeca(p, 2))
    })
    V.PECAS_DE_DENTRO.forEach((p, i) => {
      if (!temImagem(p, 2)) enfileirar('ed2:' + i, () => imagemDaPeca(p, 2))
    })
    for (const c of V.CASAS) enfileirar('et2:' + c.id, () => imagemDoTelhado(c, 2))
    enfileirar('et2:pronto', () => {
      api.telhados2 = true
    })
    enfileirar('el2', () => Mm.prepararLadrilhos(2))
    if (!chaos.has(2)) {
      etapasDoChao2 ||= etapasDoChao(2)
      etapasDoChao2.forEach((f, i) => enfileirar('ec2:' + i, f))
    }
    enfileirar('eS2', () => {
      api.S = 2
    })
  }

  return Object.assign(api, {
    PALETA, PISO_DO_CONTORNO, PISO_DE_LUZ, TELHADOS, Mm,
    EXTERNAS: Mae.EXTERNAS,
    FUNDO: Mm.FUNDO,
    COR_DA_GRADE: Mm.COR_DA_GRADE,
    ROTULO: Mm.ROTULO,
    tons, tonsDaPaleta: Mm.tonsDaPaleta, luminancia: Mm.luminancia, corDaFolha, fisica: () => Mae.fisica(),
    imagemDaPeca, temImagem, imagemDoTelhado, pintarSombraDaCasa: Mm.pintarSombraDaCasa, chao, chaoPronto, prepararLadrilhos, pedirNitidez,
    desenharPortaEPlaca, desenharPino: Mm.desenharPino, desenharDestino: Mm.desenharDestino,
    posicaoDaChamine, camadaDaGrama, telhadoSemChamine, LADO_DA_CHAMINE, tempoDasEtapas,
  })
})()
