/*
 * OBJETOS DO MAPA — textura e volume dos 11 móveis, desenhados pelo código.
 *
 * Nada de imagem: cada móvel é uma lista de PEÇAS (tampo, aro, travesseiro,
 * pedra...). Cada peça tem uma forma dada por distância (negativa dentro), um
 * chanfro (o bisel: a borda arredonda até `bisel` px para dentro) e um
 * material. A pintura é por pixel, como a do telhado (`client/src/texturas/
 * telhado.ts`): a textura do material dá a variação de tom, a normal do
 * chanfro dá a luz (de cima à esquerda, a mesma do telhado e do relevo), e a
 * sombra no chão sai da mesma forma, afastada para baixo à direita pela altura.
 *
 * Duas vistas, com as MESMAS peças:
 * - 'cima' (de cima com volume): tudo no chão, o volume vem da luz, do
 *   chanfro e da sombra;
 * - '34' (3/4): o tampo sobe pela altura do móvel e a frente aparece embaixo
 *   dele (`face: 'frente'`, mais escura que o tampo).
 *
 * Cor contida de propósito (pedido de 09/10: "não ficar estourado"): toda
 * variação de textura é pequena (alguns %), o veio nunca é reto (reta fina vira
 * hachura) e os tons partem dos do telhado aprovado em 19/10.
 *
 * Mesma entrada, mesma imagem: nenhum `Math.random`, todo sorteio é `hash`.
 */
// eslint-disable-next-line no-var, no-unused-vars
var Objetos = (function () {
  'use strict'

  /** Px do mapa por casa no zoom 100% (o protótipo usa 56; o app aceita qualquer grade). */
  const G = 56
  const TAU = Math.PI * 2

  // ---------- ruído (o mesmo hash de texturas/ruido.ts) ----------

  function hash(ix, iy, semente) {
    let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263) ^ Math.imul(semente | 0, 1442695041)
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }

  /** Tabela de 256 x 256 valores sorteados uma vez: o ruído suave lê dela em vez de sortear por pixel. */
  const LADO_DA_TABELA = 256
  const MASCARA = LADO_DA_TABELA - 1
  const TABELA = new Float32Array(LADO_DA_TABELA * LADO_DA_TABELA)
  for (let y = 0; y < LADO_DA_TABELA; y += 1) {
    for (let x = 0; x < LADO_DA_TABELA; x += 1) TABELA[y * LADO_DA_TABELA + x] = hash(x, y, 4219) - 0.5
  }

  /** Ruído de valor suave, entre -0,5 e 0,5, com período de 256 unidades (maior que qualquer móvel). */
  function ruido(x, y) {
    const xf = Math.floor(x)
    const yf = Math.floor(y)
    let fx = x - xf
    let fy = y - yf
    fx = fx * fx * (3 - 2 * fx)
    fy = fy * fy * (3 - 2 * fy)
    const x0 = xf & MASCARA
    const x1 = (xf + 1) & MASCARA
    const y0 = (yf & MASCARA) * LADO_DA_TABELA
    const y1 = ((yf + 1) & MASCARA) * LADO_DA_TABELA
    const a = TABELA[y0 + x0]
    const b = TABELA[y0 + x1]
    const c = TABELA[y1 + x0]
    const d = TABELA[y1 + x1]
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
  }

  /**
   * A inclinação do ruído no ponto (a derivada exata da mesma interpolação),
   * em `INCLINACAO`. Uma leitura só no lugar das quatro de uma diferença:
   * o amassado do lençol e do cobertor é a maior parte do custo da cama.
   */
  const INCLINACAO = new Float64Array(2)
  function inclinacaoDoRuido(x, y) {
    const xf = Math.floor(x)
    const yf = Math.floor(y)
    const fx = x - xf
    const fy = y - yf
    const sx = fx * fx * (3 - 2 * fx)
    const sy = fy * fy * (3 - 2 * fy)
    const x0 = xf & MASCARA
    const x1 = (xf + 1) & MASCARA
    const y0 = (yf & MASCARA) * LADO_DA_TABELA
    const y1 = ((yf + 1) & MASCARA) * LADO_DA_TABELA
    const a = TABELA[y0 + x0]
    const b = TABELA[y0 + x1]
    const c = TABELA[y1 + x0]
    const d = TABELA[y1 + x1]
    const k = a - b - c + d
    INCLINACAO[0] = 6 * fx * (1 - fx) * (b - a + k * sy)
    INCLINACAO[1] = 6 * fy * (1 - fy) * (c - a + k * sx)
  }

  const limitar = (t, a, b) => (t < a ? a : t > b ? b : t)
  const suave01 = (t) => {
    const x = limitar(t, 0, 1)
    return x * x * (3 - 2 * x)
  }
  const misturar = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
  const escalar = (c, k) => [c[0] * k, c[1] * k, c[2] * k]
  function rgb(hex) {
    const n = parseInt(hex.slice(1), 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }

  // ---------- formas: distância com sinal (negativa dentro), em px do mapa ----------

  function caixa(x0, y0, x1, y1, raio = 0) {
    const cx = (x0 + x1) / 2
    const cy = (y0 + y1) / 2
    const r = Math.min(raio, (x1 - x0) / 2, (y1 - y0) / 2)
    const hx = (x1 - x0) / 2 - r
    const hy = (y1 - y0) / 2 - r
    return {
      b: [x0, y0, x1, y1],
      d(x, y) {
        const qx = Math.abs(x - cx) - hx
        const qy = Math.abs(y - cy) - hy
        const ox = qx > 0 ? qx : 0
        const oy = qy > 0 ? qy : 0
        const dentro = qx > qy ? qx : qy
        return Math.sqrt(ox * ox + oy * oy) + (dentro < 0 ? dentro : 0) - r
      },
    }
  }

  function elipse(cx, cy, rx, ry, angulo = 0) {
    const c = Math.cos(angulo)
    const s = Math.sin(angulo)
    const ex = Math.sqrt(rx * rx * c * c + ry * ry * s * s)
    const ey = Math.sqrt(rx * rx * s * s + ry * ry * c * c)
    const menor = Math.min(rx, ry)
    return {
      b: [cx - ex, cy - ey, cx + ex, cy + ey],
      d(x, y) {
        let px = x - cx
        let py = y - cy
        if (angulo !== 0) {
          const u = px * c + py * s
          py = -px * s + py * c
          px = u
        }
        // Aproximação de distância à elipse (a de Inigo Quilez): boa perto da borda, onde importa.
        const k0 = Math.sqrt((px * px) / (rx * rx) + (py * py) / (ry * ry))
        const k1 = Math.sqrt((px * px) / (rx * rx * rx * rx) + (py * py) / (ry * ry * ry * ry))
        return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -menor
      },
    }
  }

  function capsula(ax, ay, bx, by, r) {
    const dx = bx - ax
    const dy = by - ay
    const l2 = dx * dx + dy * dy || 1e-9
    return {
      b: [Math.min(ax, bx) - r, Math.min(ay, by) - r, Math.max(ax, bx) + r, Math.max(ay, by) + r],
      d(x, y) {
        const px = x - ax
        const py = y - ay
        let h = (px * dx + py * dy) / l2
        h = h < 0 ? 0 : h > 1 ? 1 : h
        const qx = px - dx * h
        const qy = py - dy * h
        return Math.sqrt(qx * qx + qy * qy) - r
      },
    }
  }

  function poligono(pts) {
    const n = pts.length
    const X = new Float64Array(n)
    const Y = new Float64Array(n)
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    for (let i = 0; i < n; i += 1) {
      X[i] = pts[i][0]
      Y[i] = pts[i][1]
      x0 = Math.min(x0, X[i])
      y0 = Math.min(y0, Y[i])
      x1 = Math.max(x1, X[i])
      y1 = Math.max(y1, Y[i])
    }
    return {
      b: [x0, y0, x1, y1],
      d(x, y) {
        let d = (x - X[0]) * (x - X[0]) + (y - Y[0]) * (y - Y[0])
        let s = 1
        for (let i = 0, j = n - 1; i < n; j = i, i += 1) {
          const ex = X[j] - X[i]
          const ey = Y[j] - Y[i]
          const wx = x - X[i]
          const wy = y - Y[i]
          let h = (wx * ex + wy * ey) / (ex * ex + ey * ey || 1e-12)
          h = h < 0 ? 0 : h > 1 ? 1 : h
          const bx = wx - ex * h
          const by = wy - ey * h
          const dd = bx * bx + by * by
          if (dd < d) d = dd
          const c1 = y >= Y[i]
          const c2 = y < Y[j]
          const c3 = ex * wy > ey * wx
          if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s
        }
        return s * Math.sqrt(d)
      },
    }
  }

  const uniao = (a, b) => ({
    b: [Math.min(a.b[0], b.b[0]), Math.min(a.b[1], b.b[1]), Math.max(a.b[2], b.b[2]), Math.max(a.b[3], b.b[3])],
    d: (x, y) => Math.min(a.d(x, y), b.d(x, y)),
  })
  const menos = (a, b) => ({ b: a.b, d: (x, y) => Math.max(a.d(x, y), -b.d(x, y)) })
  const dentroDe = (a, b) => ({
    b: [Math.max(a.b[0], b.b[0]), Math.max(a.b[1], b.b[1]), Math.min(a.b[2], b.b[2]), Math.min(a.b[3], b.b[3])],
    d: (x, y) => Math.max(a.d(x, y), b.d(x, y)),
  })
  const anel = (cx, cy, rxF, ryF, rxD, ryD) => menos(elipse(cx, cy, rxF, ryF), elipse(cx, cy, rxD, ryD))

  /** Tábua reta de `larg` px entre dois pontos (pontas retas). */
  function barra(ax, ay, bx, by, larg) {
    const dx = bx - ax
    const dy = by - ay
    const l = Math.hypot(dx, dy) || 1
    const nx = (-dy / l) * (larg / 2)
    const ny = (dx / l) * (larg / 2)
    return poligono([[ax + nx, ay + ny], [bx + nx, by + ny], [bx - nx, by - ny], [ax - nx, ay - ny]])
  }

  /**
   * Lateral de um cilindro em pé na vista 3/4: do arco da frente do topo (a `H`
   * px de altura) ao arco da frente da base. `raio(z)` é o fator do raio na
   * altura z (o bojo do barril).
   */
  /**
   * Lateral de um cilindro reto (mourão, beira do tapete redondo): retângulo até a base mais o arco da base.
   * A parte de cima fica escondida pela tampa, pintada por cima; sem polígono, sai muitas vezes mais barato.
   */
  const ladoReto = (cx, cy, rx, ry, H) => uniao(caixa(cx - rx, cy - H, cx + rx, cy), elipse(cx, cy, rx, ry))

  function ladoDoCilindro(cx, cy, rx, ry, H, raio, n = 16) {
    const pts = []
    for (let k = n; k >= 0; k -= 1) {
      const z = (H * k) / n
      pts.push([cx + rx * raio(z), cy - z])
    }
    for (let k = 1; k < n; k += 1) {
      const a = (Math.PI * k) / n
      pts.push([cx + rx * raio(0) * Math.cos(a), cy + ry * raio(0) * Math.sin(a)])
    }
    for (let k = 0; k <= n; k += 1) {
      const z = (H * k) / n
      pts.push([cx - rx * raio(z), cy - z])
    }
    for (let k = n - 1; k > 0; k -= 1) {
      const a = (Math.PI * k) / n
      pts.push([cx + rx * raio(H) * Math.cos(a), cy - H + ry * raio(H) * Math.sin(a)])
    }
    return poligono(pts)
  }

  /** Faixa em volta de um cilindro em pé (o aro), entre as alturas `za` e `zb`, na vista 3/4. */
  function faixaDoCilindro(cx, cy, rx, ry, za, zb, raio, n = 18) {
    const pts = []
    for (let k = 0; k <= n; k += 1) {
      const a = (Math.PI * k) / n
      pts.push([cx + rx * raio(zb) * Math.cos(a), cy - zb + ry * raio(zb) * Math.sin(a)])
    }
    for (let k = n; k >= 0; k -= 1) {
      const a = (Math.PI * k) / n
      pts.push([cx + rx * raio(za) * Math.cos(a), cy - za + ry * raio(za) * Math.sin(a)])
    }
    return poligono(pts)
  }

  /** Chama parada em forma de gota: base embaixo, ponta `alt` px acima. */
  function gota(cx, base, larg, alt, n = 32) {
    const pts = []
    for (let k = 0; k < n; k += 1) {
      const t = (TAU * k) / n
      pts.push([cx + (larg / 2) * Math.sin(t) * Math.pow(Math.abs(Math.sin(t / 2)), 1.4), base - (alt * (1 + Math.cos(t))) / 2])
    }
    return poligono(pts)
  }

  // ---------- materiais ----------

  /**
   * Cada material tem nome, classe (que escolhe a textura) e o tom em luz
   * neutra. Madeiras com os tons do telhado de madeira (19/10); cerejeira e
   * madeira velha completam. Tecidos e pedras contidos, sem cor de fruta.
   */
  const MATERIAIS = {
    carvalho: { nome: 'Carvalho', classe: 'madeira', cor: '#8b6b47' },
    nogueira: { nome: 'Nogueira', classe: 'madeira', cor: '#5f4532' },
    pinho: { nome: 'Pinho', classe: 'madeira', cor: '#a3875f' },
    cerejeira: { nome: 'Cerejeira', classe: 'madeira', cor: '#7c4b37' },
    velha: { nome: 'Madeira velha', classe: 'madeira', cor: '#7b776e' },
    ferro: { nome: 'Ferro', classe: 'metal', cor: '#4c4e51' },
    latao: { nome: 'Latão', classe: 'metal', cor: '#9c8044' },
    linho: { nome: 'Linho cru', classe: 'tecido', fio: 'linho', cor: '#c1b59c' },
    vinho: { nome: 'Lã vinho', classe: 'tecido', fio: 'la', cor: '#6d3337' },
    azul: { nome: 'Lã azul', classe: 'tecido', fio: 'la', cor: '#41526a' },
    musgo: { nome: 'Lã musgo', classe: 'tecido', fio: 'la', cor: '#5a6344' },
    ocre: { nome: 'Lã ocre', classe: 'tecido', fio: 'la', cor: '#977842' },
    granito: { nome: 'Granito', classe: 'pedra', tipo: 'granito', cor: '#7e7b76' },
    arenito: { nome: 'Arenito', classe: 'pedra', tipo: 'arenito', cor: '#9a8669' },
    ardosia: { nome: 'Ardósia', classe: 'pedra', tipo: 'ardosia', cor: '#585d61' },
    palha: { nome: 'Palha', classe: 'palha', cor: '#b0995f' },
    corda: { nome: 'Corda', classe: 'corda', cor: '#a08a62' },
    arame: { nome: 'Arame', classe: 'metal', cor: '#56585b' },
    lenhaCarvalho: { nome: 'Carvalho', classe: 'casca', cor: '#55453a' },
    lenhaPinho: { nome: 'Pinho', classe: 'casca', cor: '#6c4c3a' },
    lenhaBetula: { nome: 'Bétula', classe: 'casca', tipo: 'betula', cor: '#cbc4b4' },
    // Escolhas que usam a madeira do próprio móvel (assento da cadeira, varas da cerca).
    mesma: { nome: 'Madeira', classe: 'ref' },
    varas: { nome: 'Varas', classe: 'ref' },
  }
  for (const m of Object.values(MATERIAIS)) if (m.cor) m.rgb = rgb(m.cor)

  /** Materiais fixos, que o mestre não escolhe. */
  const LENCOL = { nome: 'Lençol', classe: 'tecido', fio: 'linho', rgb: rgb('#cbc2ad') }
  const PREGO = { nome: 'Prego', classe: 'metal', rgb: rgb('#3a3b3d') }
  const BURACO = { nome: 'Fechadura', classe: 'liso', rgb: rgb('#1e1814') }
  const CINZA = { nome: 'Cinza', classe: 'brasas', rgb: rgb('#625c55') }
  const CHAMA = { nome: 'Chama', classe: 'chama', rgb: rgb('#d88a44') }
  const CREME = [232, 223, 202]

  const MADEIRAS = ['carvalho', 'nogueira', 'pinho', 'cerejeira', 'velha']
  const METAIS = ['ferro', 'latao']
  const TECIDOS = ['linho', 'vinho', 'azul', 'musgo', 'ocre']

  const r = (id, nome, opcoes, padrao) => ({ id, nome, opcoes, padrao })
  /** As escolhas de material de cada móvel (a cama tem as três cores de hoje: madeira, cobertor e travesseiro). */
  const RANURAS = {
    barril: [r('madeira', 'Madeira', MADEIRAS, 'carvalho'), r('aros', 'Aros', METAIS, 'ferro')],
    caixa: [r('madeira', 'Madeira', MADEIRAS, 'pinho')],
    bau: [r('madeira', 'Madeira', MADEIRAS, 'nogueira'), r('ferragens', 'Ferragens', METAIS, 'latao')],
    catre: [r('madeira', 'Madeira', MADEIRAS, 'carvalho'), r('cobertor', 'Cobertor', TECIDOS, 'vinho'), r('travesseiro', 'Travesseiro', TECIDOS, 'linho')],
    mesa: [r('madeira', 'Madeira', MADEIRAS, 'carvalho')],
    cadeira: [r('madeira', 'Madeira', MADEIRAS, 'carvalho'), r('assento', 'Assento', ['mesma', 'palha'], 'palha')],
    cerca: [r('madeira', 'Mourões', MADEIRAS, 'carvalho'), r('ligacao', 'Entre os mourões', ['varas', 'corda', 'arame'], 'varas')],
    armario: [r('madeira', 'Madeira', MADEIRAS, 'pinho'), r('puxadores', 'Puxadores', METAIS, 'ferro')],
    aparador: [r('madeira', 'Madeira', MADEIRAS, 'nogueira'), r('puxadores', 'Puxadores', METAIS, 'latao')],
    fogueira: [r('pedras', 'Pedras', ['granito', 'arenito', 'ardosia'], 'granito'), r('lenha', 'Lenha', ['lenhaCarvalho', 'lenhaPinho', 'lenhaBetula'], 'lenhaCarvalho')],
    tapete: [r('tecido', 'Tecido', TECIDOS, 'azul')],
  }

  const TIPOS = ['barril', 'caixa', 'bau', 'catre', 'mesa', 'cadeira', 'cerca', 'armario', 'aparador', 'fogueira', 'tapete']
  const ROTULO = {
    barril: 'Barril', caixa: 'Caixa', bau: 'Baú', catre: 'Cama', mesa: 'Mesa', cadeira: 'Cadeira', cerca: 'Cerca',
    armario: 'Armário de cozinha', aparador: 'Aparador', fogueira: 'Fogueira', tapete: 'Tapete',
  }
  /** Os mesmos de `TIPOS_COM_VISTA` (client/src/lib/mobilia.ts:115). */
  const TIPOS_COM_VISTA = ['cadeira', 'bau', 'armario', 'aparador', 'fogueira', 'tapete']
  /** Tamanhos padrão em casas, copiados de `lib/mobilia.ts` (frente, lado e tapete por forma). */
  const TAMANHO_EM_CASAS = {
    barril: [0.7, 0.7], caixa: [0.8, 0.8], bau: [1, 0.6], catre: [1, 2], mesa: [2, 1], cadeira: [0.5, 0.5],
    cerca: [2, 0.25], armario: [1, 0.5], aparador: [2, 0.5], fogueira: [1, 1],
  }
  const TAMANHO_DE_LADO_EM_CASAS = { bau: [0.6, 0.6], cadeira: [0.5, 0.75], armario: [1, 1.5], aparador: [2, 0.9], fogueira: [1, 1.25] }
  const TAMANHO_DO_TAPETE_EM_CASAS = { retangular: { frente: [3, 2], lado: [3, 0.25] }, redondo: { frente: [2, 2], lado: [2, 0.25] } }

  const aceitaVista = (tipo) => TIPOS_COM_VISTA.includes(tipo)
  function tamanhoEmCasas(tipo, vista, forma) {
    if (tipo === 'tapete') return TAMANHO_DO_TAPETE_EM_CASAS[forma === 'redondo' ? 'redondo' : 'retangular'][vista === 'lado' ? 'lado' : 'frente']
    if (vista === 'lado' && aceitaVista(tipo)) return TAMANHO_DE_LADO_EM_CASAS[tipo]
    return TAMANHO_EM_CASAS[tipo]
  }

  // ---------- texturas: cada uma soma variação de luz (e às vezes troca a cor) no ponto ----------
  // `s` = [r, g, b, luz, emissão, alfa]. (u, v) = coordenadas do material: u ao longo do veio.

  function texMadeira(u, v, x, y, p, s) {
    const W = p.tabua
    let j = 0
    let dentro = 99
    let fora = 99
    if (W > 0) {
      const fv = v / W
      j = Math.floor(fv)
      dentro = (fv - j) * W
      fora = W - dentro
    }
    const hj = hash(j, p.semente, 811)
    let luz = (hj - 0.5) * 0.12
    // Veio: linhas ao longo da tábua, onduladas pelo ruído (veio reto e fino vira hachura no zoom 50%).
    const onda = ruido(u * 0.03 + hj * 97, j * 3.7 + p.semente) * 9 + ruido(u * 0.09 + 40, v * 0.05 + j * 5.1) * 2.2
    luz += Math.sin((v + onda) * 3.3) * 0.026
    luz += ruido(u * 0.018 + hj * 31, v * 0.22 + j * 9) * 0.1
    luz += ruido(u * 0.35 + p.semente * 3, v * 2.4) * 0.05
    if (W > 0) {
      // Emenda de topo de vez em quando, em lugar sorteado por tábua.
      const L = 60 + hash(j, p.semente, 812) * 90
      const uu = u / L + hash(j, p.semente, 813)
      const fu = (uu - Math.floor(uu)) * L
      const ateTopo = fu < L - fu ? fu : L - fu
      if (ateTopo < 0.7) luz -= 0.22 * (1 - ateTopo / 0.7)
      // Fresta escura entre tábuas; a beira de cima pega um pouco de luz.
      const ate = dentro < fora ? dentro : fora
      if (ate < 0.75) luz -= 0.3 * (1 - ate / 0.75) * (1 - ate / 0.75)
      else if (dentro < 1.6) luz += 0.03
    }
    s[3] += luz
  }

  /** Topo de madeira cortada (mourão, ponta da tora): anéis em volta do centro. */
  function texTopo(u, v, x, y, p, s) {
    const cx = p.centro[0]
    const cy = p.centro[1]
    const raio = Math.hypot(x - cx, y - cy) + ruido(x * 0.2 + p.semente, y * 0.2) * 1.4
    s[3] += Math.sin(raio * 4.2) * 0.035 + ruido(x * 0.6, y * 0.6) * 0.05 + 0.06
  }

  function texMetal(u, v, x, y, p, s) {
    s[3] += ruido(u * 0.16 + p.semente * 7, v * 0.16) * 0.12 + ruido(u * 0.05, v * 1.3 + p.semente) * 0.05 + ruido(u * 0.7, v * 0.7) * 0.03
  }

  function texTecido(u, v, x, y, p, s) {
    if (p.mat.fio === 'linho') {
      const tela = ((Math.floor(u * 1.4) + Math.floor(v * 1.4)) & 1) === 1 ? 0.012 : -0.012
      s[3] += ruido(u * 0.05 + p.semente * 5, v * 1.15) * 0.08 + ruido(u * 0.6, v * 0.6) * 0.04 + tela
    } else {
      s[3] += ruido(u * 0.5 + p.semente * 5, v * 0.5) * 0.08 + ruido(u * 0.12, v * 0.12 + p.semente) * 0.07 + Math.sin((u + v) * 2.6) * 0.012
    }
  }

  function texPedra(u, v, x, y, p, s) {
    const t = p.mat.tipo
    let luz = ruido(u * 0.09 + p.semente * 13, v * 0.09) * 0.16 + (hash(p.semente, 1, 707) - 0.5) * 0.12
    if (t === 'granito') {
      luz += ruido(u * 0.4, v * 0.4) * 0.06
      const h = hash(Math.floor(u * 1.5), Math.floor(v * 1.5), p.semente)
      if (h > 0.93) luz -= 0.17
      else if (h < 0.05) luz += 0.11
    } else if (t === 'arenito') {
      luz += ruido(u * 1.1, v * 1.1) * 0.06 + ruido(u * 0.03, v * 0.45 + p.semente) * 0.07
    } else {
      luz += ruido(u * 0.04, v * 0.55 + p.semente) * 0.09 + ruido(u * 0.35, v * 0.35) * 0.03
    }
    s[3] += luz
  }

  /** Palha trançada em cesto: fios de 1,4 px, cada quadrado de 2,8 px vira de lado. */
  function texPalha(u, v, x, y, p, s) {
    const c = 2.8
    const i = Math.floor(u / c)
    const j = Math.floor(v / c)
    const deitada = ((i + j) & 1) === 0
    const atravessa = deitada ? v : u
    const aoLongo = deitada ? u : v
    const k = atravessa / (c / 2)
    const fk = k - Math.floor(k)
    let luz = (Math.sin(fk * Math.PI) - 0.64) * 0.2 + (hash(i, j, 77) - 0.5) * 0.07
    const fe = aoLongo / c - Math.floor(aoLongo / c)
    const borda = fe < 1 - fe ? fe : 1 - fe
    if (borda < 0.16) luz -= 0.13 * (1 - borda / 0.16)
    s[3] += luz
  }

  function texCorda(u, v, x, y, p, s) {
    s[3] += Math.sin((u * 0.75 + v * 1.25) * 1.6) * 0.09 + ruido(u * 0.6, v * 0.6) * 0.05
  }

  /** Casca da lenha. Bétula: branca com riscos escuros de través; as outras: fendas ao longo da tora. */
  function texCasca(u, v, x, y, p, s) {
    if (p.mat.tipo === 'betula') {
      let luz = ruido(u * 0.08 + p.semente * 3, v * 0.3) * 0.08
      const marca = ruido(u * 0.55 + p.semente * 9, v * 0.07 + p.semente)
      if (marca > 0.2) luz -= 0.4 * Math.min(1, (marca - 0.2) / 0.08)
      s[3] += luz
    } else {
      const fenda = ruido(u * 0.07 + p.semente * 5, v * 0.9 + p.semente)
      let luz = fenda * 0.22 + ruido(u * 0.5, v * 0.5) * 0.06
      if (fenda < -0.12) luz -= 0.16
      s[3] += luz
    }
  }

  const BRASA_CARVAO = [44, 34, 28]
  const BRASA_VIVA = [158, 64, 38]
  const BRASA_QUENTE = [208, 118, 58]

  /** Cor da brasa por "calor" de 0 a 1: carvão, vermelho apagado e laranja só no miolo. */
  function corDaBrasa(q) {
    return q < 0.5 ? misturar(BRASA_CARVAO, BRASA_VIVA, q * 2) : misturar(BRASA_VIVA, BRASA_QUENTE, (q - 0.5) * 2)
  }

  /** Lenha: a casca, queimada perto do centro do fogo, com brasa parada nas partes mais quentes. */
  function texLenha(u, v, x, y, p, s) {
    texCasca(u, v, x, y, p, s)
    const f = p.fogo
    const d = Math.hypot(x - f[0], y - f[1])
    if (d >= f[2]) return
    const k = 1 - d / f[2]
    s[3] -= 0.5 * k
    const n = ruido(x * 0.8 + 5, y * 0.8) + k * 0.5 - 0.42
    if (n > 0) {
      const q = Math.min(1, n / 0.35)
      const c = corDaBrasa(q * 0.85)
      const t = Math.min(1, n / 0.12)
      s[0] += (c[0] - s[0]) * t
      s[1] += (c[1] - s[1]) * t
      s[2] += (c[2] - s[2]) * t
      s[4] = t * (0.3 + 0.6 * q)
    }
  }

  /** Leito de cinza com brasas paradas: mais brasa no meio, carvão em volta. */
  function texBrasas(u, v, x, y, p, s) {
    const b = p.brasas
    const rr = Math.hypot(x - b[0], y - b[1]) / b[2]
    const n = ruido(x * 0.3 + 11, y * 0.3) + ruido(x * 0.85 + 3, y * 0.85 + 7) * 0.5
    s[3] += ruido(x * 0.12, y * 0.12) * 0.16 + n * 0.08 + (rr - 0.5) * 0.06
    const calor = (1 - rr) * 1.1 + n * 0.8 - 0.68
    if (calor > 0) {
      const q = Math.min(1, calor / 0.55)
      const t = Math.min(1, calor / 0.18)
      const c = corDaBrasa(q)
      s[0] += (c[0] - s[0]) * t
      s[1] += (c[1] - s[1]) * t
      s[2] += (c[2] - s[2]) * t
      s[4] = t * (0.25 + 0.65 * q)
    }
  }

  /** Chama parada: cor pela altura dentro da gota, some na ponta. */
  function texChama(u, v, x, y, p, s) {
    const c = p.chama
    const f = limitar((c.base - y) / c.alt, 0, 1)
    const cor = misturar(c.de, c.ate, f)
    const n = ruido(x * 0.35 + 3, y * 0.18) * 0.12
    s[0] = cor[0] * (1 + n)
    s[1] = cor[1] * (1 + n)
    s[2] = cor[2] * (1 + n)
    s[4] = 1
    s[5] = 1 - suave01((f - 0.62) / 0.38) * 0.85
  }

  /** Quanto um pixel de lado 1/S está dentro de uma área a `dist` px da borda (negativo dentro): a borda sai suave sem supersample. */
  function cobre(dist, S) {
    const k = 0.5 - dist * S
    return k <= 0 ? 0 : k >= 1 ? 1 : k
  }

  /** Puxa a cor do ponto (s[0..2]) para `c` em `k`; nada a fazer quando k é 0, o caso da maior parte do tapete. */
  function tingir(s, c, k) {
    if (k <= 0) return
    s[0] += (c[0] - s[0]) * k
    s[1] += (c[1] - s[1]) * k
    s[2] += (c[2] - s[2]) * k
  }

  /** O desenho do tapete: campo, borda com fio claro, medalhão com miolo e cantos. Bordas das áreas suavizadas pelo tamanho do pixel. */
  function texTapete(u, v, x, y, p, s) {
    const t = p.tapete
    const S = p.S
    s[0] = t.campo[0]
    s[1] = t.campo[1]
    s[2] = t.campo[2]
    let de
    if (t.redondo) {
      const raio = Math.sqrt((x / t.hw) * (x / t.hw) + (y / t.hh) * (y / t.hh))
      de = (1 - raio) * t.menor
      const rm = t.medalhao
      const dm = (raio - rm) * t.menor
      tingir(s, t.escuro, cobre(dm, S))
      tingir(s, t.claro, cobre(Math.abs(dm) - 0.5, S))
      tingir(s, t.miolo, cobre((raio - rm * 0.42) * t.menor, S))
      tingir(s, t.escuro, cobre(Math.abs((raio - rm * 0.2) * t.menor) - 0.5, S) * 0.7)
    } else {
      const ax = Math.abs(x)
      const ay = Math.abs(y)
      de = Math.min(t.hw - ax, t.hh - ay)
      const g = t.geo
      const q = ax / g.mx + ay / g.my
      const dm = (q - 1) * g.escalaM
      const dc = ((g.fhw - ax) / g.cx + (g.fhh - ay) / g.cy - 1) * g.escalaC
      tingir(s, t.escuro, cobre(dc, S))
      tingir(s, t.claro, cobre(Math.abs(dc) - 0.45, S))
      tingir(s, t.escuro, cobre(dm, S))
      tingir(s, t.claro, cobre(Math.abs(dm) - 0.5, S))
      tingir(s, t.miolo, cobre((q / 0.42 - 1) * g.escalaM * 0.42, S))
    }
    const B = t.borda
    const kB = cobre(de - B, S)
    tingir(s, t.escuro, kB)
    if (kB > 0) tingir(s, t.meio, cobre(Math.abs(de - B / 2) - 0.45, S) * kB)
    tingir(s, t.claro, cobre(Math.abs(de - B - 0.75) - 0.55, S))
    s[3] += ruido(u * 0.5 + 9, v * 0.5) * 0.08 + ruido(u * 0.12, v * 0.12 + 3) * 0.06 + Math.sin((u + v) * 2.6) * 0.012
  }

  /** As medidas do medalhão e dos cantos do tapete retangular, calculadas uma vez por tapete (não por pixel). */
  function geometriaDoTapete(hw, hh, borda) {
    const fhw = hw - borda
    const fhh = hh - borda
    const mx = 0.42 * fhw
    const my = 0.62 * fhh
    const cx = 0.24 * fhw
    const cy = 0.36 * fhh
    return { fhw, fhh, mx, my, cx, cy, escalaM: (mx * my) / Math.hypot(mx, my), escalaC: (cx * cy) / Math.hypot(cx, cy) }
  }

  /** O tapete de lado: a faixa deitada, com a borda escura nas pontas e um fio claro. */
  function texTapeteLado(u, v, x, y, p, s) {
    const t = p.tapete
    const S = p.S
    const de = t.hw - Math.abs(x)
    s[0] = t.campo[0]
    s[1] = t.campo[1]
    s[2] = t.campo[2]
    tingir(s, t.escuro, cobre(de - t.borda, S))
    tingir(s, t.claro, cobre(Math.abs(de - t.borda - 0.7) - 0.5, S))
    s[3] += ruido(u * 0.5 + 9, v * 0.5) * 0.08 + ruido(u * 0.12, v * 0.12 + 3) * 0.05
  }

  /** Franja: fios de 1,6 px saindo da ponta, cada um de um comprimento. */
  function texFranja(u, v, x, y, p, s) {
    const f = p.franja
    const k = Math.floor(y / 1.6)
    const fy = y / 1.6 - k
    let alfa = limitar((0.6 - Math.abs(fy - 0.5)) * 4, 0, 1)
    const fora = Math.abs(x) - f.corpo
    const comprimento = f.comprimento * (0.72 + 0.28 * hash(k, f.lado, 515))
    alfa *= limitar((comprimento - fora) * p.S + 0.5, 0, 1)
    s[5] = alfa
    s[3] += ruido(x * 0.3, k * 3.1) * 0.08 + (hash(k, f.lado, 516) - 0.5) * 0.08
  }

  const TEXTURA = {
    madeira: texMadeira, metal: texMetal, tecido: texTecido, pedra: texPedra, palha: texPalha, corda: texCorda,
    casca: texCasca, brasas: texBrasas, chama: texChama, liso: null,
  }

  // ---------- luz ----------

  /** De onde vem a luz: cima à esquerda, um pouco mais da esquerda (a do telhado), 52° acima do chão. */
  const LX = -0.62
  const LY = -0.48
  const LZ = 0.62
  /** A mesma direção só no chão, para saber de que lado a borda faz sombra. */
  const RX = -0.79
  const RY = -0.61
  /** Meio-caminho entre a luz e o olho: onde o metal brilha. */
  const HX = -0.344
  const HY = -0.267
  const HZ = 0.9
  const FORCA_DA_LUZ = 0.9
  /** Parte somada (não multiplicada) da variação de textura: madeira escura ainda mostra o veio (como no telhado). */
  const LUZ_SOMADA = 22
  /** A frente de um móvel na vista 3/4 recebe menos luz que o tampo. */
  const FRENTE = 0.74
  /** Sombra no chão: quanto ela anda (para baixo à direita) por px de altura do móvel. */
  const SOMBRA_X = 0.27
  const SOMBRA_Y = 0.21
  const SOMBRA_COR = [14, 11, 8]

  /** Uma peça pronta para pintar. */
  function P(forma, mat, o = {}) {
    const p = {
      forma, mat, dx: 0, dy: 0, bisel: 1, eixo: 0, tabua: 8, semente: 1, contorno: 0.22, face: 'topo',
      luz: 0, tom: 1, alfa: 1, suave: 0, ruga: 0,
    }
    Object.assign(p, o)
    p.base = escalar(mat.rgb, p.tom)
    if (p.tex === undefined) p.tex = TEXTURA[mat.classe] || null
    if (p.metal === undefined) p.metal = mat.classe === 'metal' ? 0.42 : 0
    p.su = p.semente * 37.17
    p.sv = p.semente * 11.31
    return p
  }

  const SAIDA = new Float32Array(6)
  const E = 0.3

  function pintarParte(alvo, p) {
    const { buf, W, H, x0, y0, S } = alvo
    const f = p.forma
    const b = f.b
    const inv = 1 / S
    const largAA = p.suave > 0 ? p.suave * S : 1
    const folga = p.suave + 2 * inv
    const px0 = Math.max(0, Math.floor((b[0] + p.dx - folga - x0) * S))
    const px1 = Math.min(W, Math.ceil((b[2] + p.dx + folga - x0) * S))
    const py0 = Math.max(0, Math.floor((b[1] + p.dy - folga - y0) * S))
    const py1 = Math.min(H, Math.ceil((b[3] + p.dy + folga - y0) * S))
    if (px1 <= px0 || py1 <= py0) return
    p.S = S
    const [br, bg, bb] = p.base
    const { bisel, tex, metal, contorno, ruga, alfa, luz: luzFixa } = p
    const cosE = Math.cos(p.eixo)
    const sinE = Math.sin(p.eixo)
    const frente = p.face === 'frente'
    const cil = p.cilindro
    const polar = p.polar
    const curva = p.curvaY
    const rec = p.recesso
    const KR = 0.11
    const M = alvo.sombra
    for (let py = py0; py < py1; py += 1) {
      const y = y0 + (py + 0.5) * inv - p.dy
      let o = (py * W + px0) * 4
      for (let px = px0; px < px1; px += 1, o += 4) {
        // Pintando da frente para trás: pixel já coberto pelas peças de cima não precisa de textura nem de luz.
        const resta = 1 - buf[o + 3]
        if (resta <= 0.004) continue
        const x = x0 + (px + 0.5) * inv - p.dx
        const d = f.d(x, y)
        let cob = 0.5 - (d * S) / largAA
        if (cob <= 0) continue
        if (cob > 1) cob = 1
        const t = -d
        let nx = 0
        let ny = 0
        if (bisel > 0 && t < bisel) {
          const gx = f.d(x + E, y) - f.d(x - E, y)
          const gy = f.d(x, y + E) - f.d(x, y - E)
          const gl = Math.sqrt(gx * gx + gy * gy)
          if (gl > 1e-6) {
            let q = (bisel - (t > 0 ? t : 0)) / bisel
            if (q > 0.95) q = 0.95
            const inc = q / Math.sqrt(1 - q * q) / gl
            nx = inc * gx
            ny = inc * gy
          }
        }
        if (ruga > 0) {
          inclinacaoDoRuido(x * KR + p.su, y * KR)
          nx -= INCLINACAO[0] * KR * ruga
          ny -= INCLINACAO[1] * KR * ruga
        }
        if (curva) {
          let q = (y - curva.c) / curva.r
          q = q > 0.97 ? 0.97 : q < -0.97 ? -0.97 : q
          ny += (curva.forca * q) / Math.sqrt(1 - q * q)
        }
        let u
        let v
        if (polar) {
          const rx = x - polar.cx
          const ry = y - polar.cy
          u = Math.sqrt(rx * rx + ry * ry)
          v = Math.atan2(ry, rx) * polar.r
        } else if (cil) {
          u = y
          v = Math.asin(limitar((x - cil.cx) / cil.r, -1, 1)) * cil.r
        } else {
          u = x * cosE + y * sinE
          v = -x * sinE + y * cosE
        }
        u += p.su
        v += p.sv
        SAIDA[0] = br
        SAIDA[1] = bg
        SAIDA[2] = bb
        SAIDA[3] = luzFixa
        SAIDA[4] = 0
        SAIDA[5] = 1
        if (tex) tex(u, v, x, y, p, SAIDA)
        const nlen = Math.sqrt(nx * nx + ny * ny + 1)
        const nl = (nx * LX + ny * LY + LZ) / nlen
        let fl = 1 + FORCA_DA_LUZ * (nl - LZ)
        let qc = 0
        if (cil) {
          qc = limitar((x - cil.cx) / cil.r, -1, 1)
          fl *= 0.88 - 0.27 * qc - 0.17 * qc * qc
        } else if (frente) fl *= FRENTE
        if (rec) {
          const sh = limitar(0.5 + f.d(x + RX * rec.k, y + RY * rec.k) / 0.9, 0, 1)
          fl *= 1 - rec.forca * sh
        }
        if (contorno > 0 && t < 0.85) fl *= 1 - contorno * (1 - (t > 0 ? t : 0) / 0.85)
        fl = fl < 0.28 ? 0.28 : fl > 1.5 ? 1.5 : fl
        const luz = SAIDA[3]
        const somada = LUZ_SOMADA * luz
        let cr = (SAIDA[0] * (1 + luz) + somada) * fl
        let cg = (SAIDA[1] * (1 + luz) + somada) * fl
        let cb = (SAIDA[2] * (1 + luz) + somada) * fl
        if (metal > 0) {
          const nh = cil ? 1 - Math.abs(qc + 0.42) * 1.6 : (nx * HX + ny * HY + HZ) / nlen
          if (nh > 0) {
            const brilho = Math.pow(nh, 18) * metal * 255
            cr += brilho
            cg += brilho * 0.96
            cb += brilho * 0.88
          }
        }
        const em = SAIDA[4]
        if (em > 0) {
          cr += (SAIDA[0] - cr) * em
          cg += (SAIDA[1] - cg) * em
          cb += (SAIDA[2] - cb) * em
        }
        cr = cr < 0 ? 0 : cr > 255 ? 255 : cr
        cg = cg < 0 ? 0 : cg > 255 ? 255 : cg
        cb = cb < 0 ? 0 : cb > 255 ? 255 : cb
        const a = cob * alfa * SAIDA[5]
        if (a <= 0) continue
        // Por baixo do que já está pintado; a sombra das peças de cima (M) escurece só a cor.
        const k = resta * a
        const m = k * M[o >> 2]
        buf[o] += cr * m
        buf[o + 1] += cg * m
        buf[o + 2] += cb * m
        buf[o + 3] += k
      }
    }
  }

  /**
   * Sombra que a peça faz nas peças de baixo (o travesseiro no lençol, a cinta
   * na tampa). Como a pintura vai da frente para trás, a sombra é guardada
   * num multiplicador por pixel que as peças pintadas depois (as de baixo) usam.
   */
  function projetar(alvo, p) {
    const { sombra: M, W, H, x0, y0, S } = alvo
    const { dist, forca } = p.projeta
    const su = p.projeta.suave || 0.9
    const ox = -RX * dist
    const oy = -RY * dist
    const f = p.forma
    const b = f.b
    const inv = 1 / S
    const px0 = Math.max(0, Math.floor((b[0] + p.dx + ox - su * 2 - x0) * S))
    const px1 = Math.min(W, Math.ceil((b[2] + p.dx + ox + su * 2 - x0) * S))
    const py0 = Math.max(0, Math.floor((b[1] + p.dy + oy - su * 2 - y0) * S))
    const py1 = Math.min(H, Math.ceil((b[3] + p.dy + oy + su * 2 - y0) * S))
    for (let py = py0; py < py1; py += 1) {
      const y = y0 + (py + 0.5) * inv - p.dy - oy
      for (let px = px0; px < px1; px += 1) {
        const x = x0 + (px + 0.5) * inv - p.dx - ox
        const k = suave01(0.5 - f.d(x, y) / (2 * su))
        if (k <= 0) continue
        M[py * W + px] *= 1 - forca * k
      }
    }
  }

  /** Quantos px de altura cada amostra da sombra cobre: a sombra é a forma arrastada do pé até o topo, não só o topo afastado. */
  const PASSO_DA_SOMBRA = 7
  const BORDA_DA_SOMBRA_NO_PE = 0.8

  /**
   * Sombra no chão: a forma da peça arrastada do pé (no chão) até a altura
   * `z`, para baixo à direita; fica mais suave quanto mais longe do pé.
   * Assim a sombra de um armário alto sai do pé dele, não flutua ao lado.
   * Sombras que se cruzam não somam.
   */
  function pintarSombras(alvo, sombras) {
    const { buf, W, H, x0, y0, S } = alvo
    const mapa = new Float32Array(W * H)
    const inv = 1 / S
    for (const s of sombras) {
      const ox = SOMBRA_X * s.z
      const oy = SOMBRA_Y * s.z
      const su = s.suave ?? BORDA_DA_SOMBRA_NO_PE + 0.09 * s.z
      const fo = s.forca ?? Math.max(0.16, 0.34 - 0.0022 * s.z)
      const n = !s.solta && s.z > PASSO_DA_SOMBRA ? Math.min(8, Math.ceil(s.z / PASSO_DA_SOMBRA)) : 0
      const su0 = Math.min(su, BORDA_DA_SOMBRA_NO_PE)
      const b = s.forma.b
      const px0 = Math.max(0, Math.floor((b[0] + Math.min(0, ox) - su * 2 - x0) * S))
      const px1 = Math.min(W, Math.ceil((b[2] + Math.max(0, ox) + su * 2 - x0) * S))
      const py0 = Math.max(0, Math.floor((b[1] + Math.min(0, oy) - su * 2 - y0) * S))
      const py1 = Math.min(H, Math.ceil((b[3] + Math.max(0, oy) + su * 2 - y0) * S))
      for (let py = py0; py < py1; py += 1) {
        const y = y0 + (py + 0.5) * inv
        for (let px = px0; px < px1; px += 1) {
          const x = x0 + (px + 0.5) * inv
          let k = 0.5 - s.forma.d(x - ox, y - oy) / (2 * su)
          for (let j = 0; j < n; j += 1) {
            const t = j / n
            const suJ = su0 + (su - su0) * t
            const kj = 0.5 - s.forma.d(x - ox * t, y - oy * t) / (2 * suJ)
            if (kj > k) k = kj
          }
          if (k <= 0) continue
          const a = fo * suave01(k)
          const i = py * W + px
          if (a > mapa[i]) mapa[i] = a
        }
      }
    }
    for (let i = 0, o = 0; i < mapa.length; i += 1, o += 4) {
      const a = mapa[i]
      if (a <= 0) continue
      buf[o] = SOMBRA_COR[0] * a
      buf[o + 1] = SOMBRA_COR[1] * a
      buf[o + 2] = SOMBRA_COR[2] * a
      buf[o + 3] = a
    }
  }

  /** Brilho quente parado em volta da fogueira (por cima do chão, por baixo das pedras). */
  function pintarBrilhos(alvo, brilhos) {
    const { buf, W, H, x0, y0, S } = alvo
    const inv = 1 / S
    for (const g of brilhos) {
      const px0 = Math.max(0, Math.floor((g.cx - g.r - x0) * S))
      const px1 = Math.min(W, Math.ceil((g.cx + g.r - x0) * S))
      const py0 = Math.max(0, Math.floor((g.cy - g.r - y0) * S))
      const py1 = Math.min(H, Math.ceil((g.cy + g.r - y0) * S))
      for (let py = py0; py < py1; py += 1) {
        const y = y0 + (py + 0.5) * inv
        for (let px = px0; px < px1; px += 1) {
          const x = x0 + (px + 0.5) * inv
          const k = 1 - Math.hypot((x - g.cx) / g.r, (y - g.cy) / (g.r * (g.achatar || 1)))
          if (k <= 0) continue
          const a = g.forca * k * k
          const o = (py * W + px) * 4
          const ia = 1 - a
          buf[o] = g.cor[0] * a + buf[o] * ia
          buf[o + 1] = g.cor[1] * a + buf[o + 1] * ia
          buf[o + 2] = g.cor[2] * a + buf[o + 2] * ia
          buf[o + 3] = a + buf[o + 3] * ia
        }
      }
    }
  }

  // ---------- os móveis ----------

  const contato = (forma, forca = 0.3) => ({ forma, z: 0, suave: 1.3, forca })
  const faceDe = (c) => (c.tres ? 'frente' : 'topo')
  const QUARTO = Math.PI / 2

  function barril(c, s) {
    const { hw, hh } = c
    const H = c.g * 0.62
    const mad = c.m.madeira
    const aro = c.m.aros
    const R = Math.min(hw, hh)
    const polar = { cx: 0, cy: 0, r: R }
    s.sombras.push({ forma: elipse(0, 0, hw, hh), z: H }, contato(elipse(0, 0, hw, hh)))
    if (!c.tres) {
      // De cima: o bojo (aduelas saindo do centro), dois aros, a borda das aduelas e a tampa afundada.
      s.partes.push(
        P(elipse(0, 0, hw, hh), mad, { polar, tabua: 5.6, bisel: R * 0.3, semente: 3 }),
        P(anel(0, 0, hw * 0.985, hh * 0.985, hw * 0.93, hh * 0.93), aro, { bisel: 0.9, contorno: 0.3, semente: 4 }),
        P(anel(0, 0, hw * 0.885, hh * 0.885, hw * 0.835, hh * 0.835), aro, { bisel: 0.8, contorno: 0.3, semente: 5 }),
        P(anel(0, 0, hw * 0.836, hh * 0.836, hw * 0.7, hh * 0.7), mad, { polar, tabua: 5.6, bisel: 1, luz: 0.07, semente: 3 }),
        P(elipse(0, 0, hw * 0.705, hh * 0.705), mad, { tabua: hh * 0.47, bisel: 0.5, recesso: { k: 2.4, forca: 0.36 }, semente: 6, tom: 0.93 }),
        P(elipse(hw * 0.3, hh * 0.2, R * 0.09, R * 0.09), mad, { tabua: 0, bisel: R * 0.09, tom: 0.62, contorno: 0.15 }),
      )
      return
    }
    const raio = (z) => 0.9 + 0.1 * Math.sin((Math.PI * z) / H)
    const cil = { cx: 0, r: hw }
    s.partes.push(P(ladoDoCilindro(0, 0, hw, hh, H, raio), mad, { face: 'frente', cilindro: cil, tabua: 5.6, bisel: 0, semente: 3, contorno: 0.2 }))
    for (const [za, zb] of [[0.12 * H, 0.21 * H], [0.79 * H, 0.88 * H]]) {
      s.partes.push(P(faixaDoCilindro(0, 0, hw * 1.012, hh * 1.012, za, zb, raio), aro, { face: 'frente', cilindro: cil, bisel: 0.7, contorno: 0.25, semente: 4 }))
    }
    const k = raio(H)
    const dy = -H
    s.partes.push(
      P(anel(0, 0, hw * k, hh * k, hw * k * 0.78, hh * k * 0.78), mad, { dy, polar, tabua: 5.6, bisel: 1, luz: 0.07, semente: 3 }),
      P(elipse(0, 0, hw * k * 0.785, hh * k * 0.785), mad, { dy, tabua: hh * 0.42, bisel: 0.5, recesso: { k: 2.4, forca: 0.36 }, semente: 6, tom: 0.93 }),
      P(elipse(hw * 0.27, hh * 0.18, R * 0.085, R * 0.085), mad, { dy, tabua: 0, bisel: R * 0.085, tom: 0.62, contorno: 0.15 }),
    )
  }

  /** Um lado de caixote: moldura de 4 tábuas, tábuas afundadas no meio e o X das ripas por cima. */
  function caixote(L, x0, y0, x1, y1, mad, o, sem) {
    const m = Math.min(x1 - x0, y1 - y0) * 0.17
    const ix0 = x0 + m
    const iy0 = y0 + m
    const ix1 = x1 - m
    const iy1 = y1 - m
    const dentro = caixa(ix0, iy0, ix1, iy1)
    L.push(P(dentro, mad, { ...o, tabua: (iy1 - iy0) / 3, bisel: 0.5, recesso: { k: 2, forca: 0.34 }, tom: 0.9, semente: sem }))
    const larg = m * 0.9
    const a1 = Math.atan2(iy1 - iy0, ix1 - ix0)
    L.push(P(dentroDe(barra(ix0, iy0, ix1, iy1, larg), dentro), mad, { ...o, eixo: a1, tabua: 0, bisel: 0.9, semente: sem + 1 }))
    L.push(P(dentroDe(barra(ix1, iy0, ix0, iy1, larg), dentro), mad, { ...o, eixo: Math.PI - a1, tabua: 0, bisel: 0.9, semente: sem + 2, projeta: { dist: 1.1, forca: 0.3, suave: 0.7 } }))
    L.push(P(caixa(x0, y0, ix0, y1, 0.6), mad, { ...o, eixo: QUARTO, tabua: 0, bisel: 1, semente: sem + 3 }))
    L.push(P(caixa(ix1, y0, x1, y1, 0.6), mad, { ...o, eixo: QUARTO, tabua: 0, bisel: 1, semente: sem + 4 }))
    L.push(P(caixa(ix0, y0, ix1, iy0, 0.3), mad, { ...o, tabua: 0, bisel: 1, semente: sem + 5 }))
    L.push(P(caixa(ix0, iy1, ix1, y1, 0.3), mad, { ...o, tabua: 0, bisel: 1, semente: sem + 6 }))
    for (const [px, py] of [[x0 + m / 2, y0 + m / 2], [x1 - m / 2, y0 + m / 2], [x0 + m / 2, y1 - m / 2], [x1 - m / 2, y1 - m / 2]]) {
      L.push(P(elipse(px, py, 0.6, 0.6), PREGO, { ...o, bisel: 0.6, contorno: 0, metal: 0.2 }))
    }
  }

  function caixaDeMadeira(c, s) {
    const { hw, hh } = c
    const H = c.g * 0.5
    s.sombras.push({ forma: caixa(-hw, -hh, hw, hh), z: H }, contato(caixa(-hw, -hh, hw, hh)))
    if (!c.tres) {
      caixote(s.partes, -hw, -hh, hw, hh, c.m.madeira, {}, 10)
      return
    }
    caixote(s.partes, -hw, hh - H, hw, hh, c.m.madeira, { face: 'frente' }, 20)
    caixote(s.partes, -hw, -hh, hw, hh, c.m.madeira, { dy: -H }, 10)
  }

  function bau(c, s) {
    if (c.vista === 'lado') return bauDeLado(c, s)
    const { hw, hh, w, h } = c
    const H = c.g * 0.55
    const mad = c.m.madeira
    const fer = c.m.ferragens
    s.sombras.push({ forma: caixa(-hw, -hh, hw, hh, 2), z: H }, contato(caixa(-hw, -hh, hw, hh, 2)))
    const tampa = (o, arco) => {
      s.partes.push(P(caixa(-hw, -hh, hw, hh, 2), mad, { ...o, tabua: h / 4, bisel: 1.2, curvaY: arco, semente: 2 }))
      for (const sx of [-1, 1]) {
        const xc = sx * 0.3 * w
        s.partes.push(P(caixa(xc - 0.045 * w, -hh, xc + 0.045 * w, hh, 0.5), fer, { ...o, bisel: 0.8, curvaY: arco, projeta: { dist: 0.8, forca: 0.25, suave: 0.7 }, semente: 3 + sx }))
        for (const fy of [-0.32, 0, 0.32]) s.partes.push(P(elipse(xc, fy * h, 0.9, 0.9), fer, { ...o, bisel: 0.9, contorno: 0.1, tom: 0.9 }))
      }
      const cw = 0.13 * w
      const ch = 0.2 * h
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const xa = sx * hw
        const ya = sy * hh
        s.partes.push(P(poligono([[xa, ya], [xa - sx * cw, ya], [xa, ya - sy * ch]]), fer, { ...o, bisel: 0.7, curvaY: arco, contorno: 0.2 }))
      }
    }
    if (!c.tres) {
      tampa({}, { c: 0, r: hh, forca: 0.55 })
      // Fecho na frente, com o buraco da fechadura.
      s.partes.push(P(caixa(-0.065 * w, hh - 0.26 * h, 0.065 * w, hh + 0.6, 0.8), fer, { bisel: 0.9, projeta: { dist: 0.9, forca: 0.3 } }))
      s.partes.push(P(elipse(0, hh - 0.12 * h, 0.75, 1.15), BURACO, { bisel: 0, contorno: 0 }))
      return
    }
    const costura = hh - H * 0.62
    const frente = { face: 'frente' }
    s.partes.push(P(caixa(-hw, costura, hw, hh, 0.6), mad, { ...frente, tabua: (hh - costura) / 3, bisel: 0.8, semente: 8 }))
    s.partes.push(P(caixa(-hw, hh - H, hw, costura, 0.8), mad, { ...frente, tabua: (costura - hh + H) / 2, bisel: 0.8, curvaY: { c: costura, r: costura - hh + H, forca: 0.9 }, semente: 9 }))
    for (const sx of [-1, 1]) {
      const xc = sx * 0.3 * w
      s.partes.push(P(caixa(xc - 0.045 * w, costura + 0.4, xc + 0.045 * w, hh, 0.4), fer, { ...frente, bisel: 0.7, projeta: { dist: 0.7, forca: 0.25 } }))
      s.partes.push(P(caixa(xc - 0.045 * w, hh - H, xc + 0.045 * w, costura - 0.4, 0.4), fer, { ...frente, bisel: 0.7, curvaY: { c: costura, r: costura - hh + H, forca: 0.9 } }))
    }
    for (const sx of [-1, 1]) s.partes.push(P(caixa(sx > 0 ? hw - 0.12 * w : -hw, hh - 0.36 * H, sx > 0 ? hw : -hw + 0.12 * w, hh, 0.4), fer, { ...frente, bisel: 0.7 }))
    s.partes.push(P(caixa(-0.065 * w, costura - 3, 0.065 * w, costura + 5.5, 0.8), fer, { ...frente, bisel: 0.9, projeta: { dist: 0.9, forca: 0.3 } }))
    s.partes.push(P(elipse(0, costura + 2, 0.75, 1.15), BURACO, { bisel: 0, contorno: 0 }))
    tampa({ dy: -H }, { c: 0, r: hh, forca: 0.35 })
  }

  /** Baú de lado: o corpo, a tampa em arco com a cinta de ferro e a alça na lateral. */
  function bauDeLado(c, s) {
    const { hw, hh, h } = c
    const mad = c.m.madeira
    const fer = c.m.ferragens
    const face = faceDe(c)
    const costura = -hh + h * 0.4
    const raio = costura + hh
    const corpo = caixa(-hw, costura, hw, hh, 0.6)
    const arco = dentroDe(elipse(0, costura, hw, raio), caixa(-hw, -hh - 1, hw, costura + 0.5))
    sombraDeLado(c, s, uniao(corpo, arco), 12)
    s.partes.push(P(corpo, mad, { face, tabua: (hh - costura) / 3, bisel: 0.9, semente: 8 }))
    s.partes.push(P(arco, mad, { face, tabua: raio / 2, bisel: 1, semente: 9 }))
    s.partes.push(P(dentroDe(anel(0, costura, hw, raio, hw - 2.4, raio - 2.4), caixa(-hw, -hh - 1, hw, costura)), fer, { face, bisel: 0.8, contorno: 0.25 }))
    s.partes.push(P(caixa(-hw, costura - 0.4, hw, costura + 1.6, 0.3), fer, { face, bisel: 0.6, tom: 0.92 }))
    const ya = costura + (hh - costura) * 0.5
    s.partes.push(P(caixa(-3.4, ya - 3.4, 3.4, ya - 1.6, 0.5), fer, { face, bisel: 0.6 }))
    s.partes.push(P(anel(0, ya + 0.2, 3.1, 3.1, 1.9, 1.9), fer, { face, bisel: 0.6, projeta: { dist: 0.8, forca: 0.3 } }))
    for (const sx of [-1, 1]) {
      const xa = sx * hw
      s.partes.push(P(poligono([[xa, hh], [xa - sx * 5, hh], [xa, hh - 5]]), fer, { face, bisel: 0.6 }))
    }
  }

  function cama(c, s) {
    const { hw, hh, w, h } = c
    const mad = c.m.madeira
    const zM = c.g * 0.34
    const zH = c.g * 0.72
    const zF = c.g * 0.44
    const zR = c.g * 0.24
    const yCab = -hh + 0.075 * h
    const yPe = hh - 0.05 * h
    const beira = 0.07 * w
    const poste = 0.13 * w
    s.sombras.push(
      { forma: caixa(-hw, -hh, hw, hh, 1.5), z: zM },
      { forma: caixa(-hw, -hh, hw, yCab), z: zH },
      { forma: caixa(-hw, yPe, hw, hh), z: zF },
      contato(caixa(-hw, -hh, hw, hh, 1.5)),
    )
    const tres = c.tres
    const dM = tres ? -zM : 0
    const cama3 = (z) => (tres ? -z : 0)
    const L = s.partes
    const cabeceira = () => {
      if (tres) {
        L.push(P(caixa(-hw, yCab - zH, hw, yCab, 0.6), mad, { face: 'frente', tabua: zH / 3.4, bisel: 0.9, semente: 30 }))
        for (const x0 of [-hw, hw - poste]) L.push(P(caixa(x0, yCab - zH - 3, x0 + poste, yCab, 0.8), mad, { face: 'frente', eixo: QUARTO, tabua: 0, bisel: 1.2, semente: 31 }))
      }
      L.push(P(caixa(-hw, -hh, hw, yCab, 1), mad, { dy: cama3(zH), tabua: 0, bisel: 1.3, semente: 32, projeta: tres ? undefined : { dist: 3.2, forca: 0.32, suave: 1.6 } }))
      for (const x0 of [-hw, hw - poste]) L.push(P(caixa(x0, -hh, x0 + poste, -hh + poste, 1.5), mad, { dy: cama3(zH + 3), tabua: 0, bisel: 2.4, semente: 33 }))
    }
    if (tres) cabeceira()
    L.push(P(caixa(-hw, tres ? yCab : -hh, hw, hh, 1.5), mad, { dy: cama3(zR), eixo: QUARTO, tabua: 0, bisel: 1.1, semente: 34 }))
    L.push(P(caixa(-hw + beira, yCab, hw - beira, yPe, 2), LENCOL, { dy: dM, bisel: 2.4, ruga: 1.2, semente: 35 }))
    const yTr = yCab + 1.5
    L.push(P(caixa(-hw + 0.12 * w, yTr, hw - 0.12 * w, yTr + 0.16 * h, 4), c.m.travesseiro, { dy: dM - (tres ? 1 : 0), bisel: 0.07 * h, ruga: 1.5, semente: 36, projeta: { dist: 1.6, forca: 0.3, suave: 1.2 } }))
    const yDobra = -hh + 0.42 * h
    L.push(P(caixa(-hw + beira * 0.6, yDobra, hw - beira * 0.6, yPe + 0.5, 2), c.m.cobertor, { dy: dM - (tres ? 0.5 : 0), bisel: 2.6, ruga: 2.2, eixo: QUARTO, semente: 37, projeta: { dist: 1.2, forca: 0.28 } }))
    L.push(P(caixa(-hw + beira * 0.6 - 0.3, yDobra - 0.5, hw - beira * 0.6 + 0.3, yDobra + 0.075 * h, 2), c.m.cobertor, { dy: dM - (tres ? 1 : 0), tom: 1.1, bisel: 2.4, ruga: 1, semente: 38, projeta: { dist: 1.4, forca: 0.34 } }))
    if (tres) {
      L.push(P(caixa(-hw, hh - zF, hw, hh, 0.6), mad, { face: 'frente', tabua: zF / 3, bisel: 0.9, semente: 39 }))
      for (const x0 of [-hw, hw - poste]) L.push(P(caixa(x0, hh - zF - 3, x0 + poste, hh, 0.8), mad, { face: 'frente', eixo: QUARTO, tabua: 0, bisel: 1.2, semente: 40 }))
    }
    L.push(P(caixa(-hw, yPe, hw, hh, 1), mad, { dy: cama3(zF), tabua: 0, bisel: 1.2, semente: 41 }))
    for (const x0 of [-hw, hw - poste]) L.push(P(caixa(x0, hh - poste, x0 + poste, hh, 1.5), mad, { dy: cama3(zF + 3), tabua: 0, bisel: 2.4, semente: 42 }))
    if (!tres) cabeceira()
  }

  function mesa(c, s) {
    const { hw, hh, w, h } = c
    const mad = c.m.madeira
    const H = c.g * 0.5
    const esp = 4
    const ponta = 0.06 * w
    s.sombras.push({ forma: caixa(-hw, -hh, hw, hh, 1.5), z: H, solta: true })
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const lx = sx * (hw - 0.065 * w)
      const ly = sy * (hh - 0.1 * h)
      s.sombras.push(contato(caixa(lx - 3, ly - 3, lx + 3, ly + 3), 0.32), { forma: caixa(lx - 2.5, ly - 2.5, lx + 2.5, ly + 2.5), z: H - 4, forca: 0.26 })
    }
    const tampo = (o) => {
      s.partes.push(P(caixa(-hw + ponta, -hh, hw - ponta, hh, 0), mad, { ...o, tabua: h / 4.2, bisel: 1.2, semente: 50 }))
      s.partes.push(P(caixa(-hw, -hh, -hw + ponta, hh, 1.5), mad, { ...o, eixo: QUARTO, tabua: 0, bisel: 1.3, semente: 51 }))
      s.partes.push(P(caixa(hw - ponta, -hh, hw, hh, 1.5), mad, { ...o, eixo: QUARTO, tabua: 0, bisel: 1.3, semente: 52 }))
    }
    if (!c.tres) {
      tampo({})
      return
    }
    const frente = { face: 'frente' }
    const yf = hh - 2
    s.partes.push(P(caixa(-hw + 0.09 * w, yf - (H - esp), hw - 0.09 * w, yf - (H - esp) + 0.17 * c.g, 0.4), mad, { ...frente, tabua: 0, bisel: 0.7, tom: 0.8, semente: 53 }))
    for (const sx of [-1, 1]) {
      const x0 = sx < 0 ? -hw + 0.035 * w : hw - 0.035 * w - 0.06 * w
      s.partes.push(P(caixa(x0, yf - (H - esp), x0 + 0.06 * w, yf, 0.5), mad, { ...frente, eixo: QUARTO, tabua: 0, bisel: 0.9, tom: 0.86, semente: 54 + sx }))
    }
    s.partes.push(P(caixa(-hw, hh - H, hw, hh - H + esp, 0.6), mad, { ...frente, tabua: 0, bisel: 0.8, semente: 56 }))
    tampo({ dy: -H })
  }

  function assento(L, c, o, x0, y0, x1, y1) {
    const mad = c.m.madeira
    if (c.m.assento.classe === 'palha') {
      const m = Math.min(x1 - x0, y1 - y0) * 0.16
      L.push(P(menos(caixa(x0, y0, x1, y1, 1.4), caixa(x0 + m, y0 + m, x1 - m, y1 - m)), mad, { ...o, tabua: 0, bisel: 0.9, semente: 61 }))
      L.push(P(caixa(x0 + m, y0 + m, x1 - m, y1 - m, 0.4), c.m.assento, { ...o, bisel: 0.7, recesso: { k: 1.2, forca: 0.3 }, contorno: 0.1, semente: 62 }))
    } else {
      L.push(P(caixa(x0, y0, x1, y1, 1.4), mad, { ...o, tabua: (y1 - y0) / 2, bisel: 1.1, semente: 61 }))
    }
  }

  function cadeira(c, s) {
    if (c.vista === 'lado') return cadeiraDeLado(c, s)
    const { hw, hh, w, h } = c
    const mad = c.m.madeira
    const zS = c.g * 0.27
    const zE = c.g * 0.62
    const yAss = -hh + 0.18 * h
    const yTrilho = -hh + 0.16 * h
    const posteL = 0.18 * w
    s.sombras.push({ forma: caixa(-hw, yAss, hw, hh, 1.4), z: zS, solta: true }, { forma: caixa(-hw, -hh, hw, yTrilho, 1.2), z: zE, solta: true })
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const lx = sx * (hw - 2.2)
      const ly = sy * (hh - 2.2)
      s.sombras.push(contato(caixa(lx - 1.8, ly - 1.8, lx + 1.8, ly + 1.8), 0.3), { forma: caixa(lx - 1.6, ly - 1.6, lx + 1.6, ly + 1.6), z: sy < 0 ? zE : zS, forca: 0.24 })
    }
    const L = s.partes
    if (!c.tres) {
      assento(L, c, {}, -hw, yAss, hw, hh)
      L.push(P(caixa(-hw, -hh, hw, yTrilho, 1.2), mad, { tabua: 0, bisel: 1.2, semente: 63, projeta: { dist: (zE - zS) * 0.3, forca: 0.32, suave: 1.4 } }))
      for (const x0 of [-hw, hw - posteL]) L.push(P(caixa(x0, -hh, x0 + posteL, -hh + 0.2 * h, 1.2), mad, { tabua: 0, bisel: 1.6, semente: 64 }))
      return
    }
    const frente = { face: 'frente' }
    const yb = yTrilho
    for (const x0 of [-hw, hw - posteL]) L.push(P(caixa(x0, yb - zE, x0 + posteL, yb - zS + 2, 0.6), mad, { ...frente, eixo: QUARTO, tabua: 0, bisel: 0.9, semente: 65 }))
    L.push(P(caixa(-hw, yb - zE, hw, yb - zE + 5, 0.8), mad, { ...frente, tabua: 0, bisel: 1, semente: 66 }))
    L.push(P(caixa(-hw + posteL, yb - zE + 9.5, hw - posteL, yb - zE + 13, 0.6), mad, { ...frente, tabua: 0, bisel: 0.8, tom: 0.95, semente: 67 }))
    L.push(P(caixa(-hw, -hh, hw, yb, 1), mad, { dy: -zE, tabua: 0, bisel: 1.1, semente: 68 }))
    assento(L, c, { dy: -zS }, -hw, yAss, hw, hh)
    L.push(P(caixa(-hw, hh - zS, hw, hh - zS + 2.6, 0.5), mad, { ...frente, tabua: 0, bisel: 0.7, semente: 69 }))
    for (const x0 of [-hw + 0.5, hw - 0.5 - 0.16 * w]) L.push(P(caixa(x0, hh - zS + 2.6, x0 + 0.16 * w, hh, 0.4), mad, { ...frente, eixo: QUARTO, tabua: 0, bisel: 0.7, tom: 0.85, semente: 70 }))
    L.push(P(caixa(-hw + 0.16 * w, hh - 5.5, hw - 0.16 * w, hh - 3.8, 0.3), mad, { ...frente, tabua: 0, bisel: 0.5, tom: 0.78, semente: 71 }))
  }

  /** Cadeira de lado: o L do encosto e do assento, as duas pernas e a travessa. */
  function cadeiraDeLado(c, s) {
    const { hw, hh, w, h } = c
    const mad = c.m.madeira
    const face = faceDe(c)
    const fimEncosto = -hw + w * 0.2
    const topoAss = -hh + h * 0.5
    const baseAss = topoAss + h * 0.14
    const recuo = (w * 0.2) / 2
    const poste = caixa(-hw, -hh, fimEncosto, hh, 1)
    const sentar = caixa(fimEncosto - 0.5, topoAss, hw, baseAss, 1)
    const perna = caixa(hw - recuo - 1.8, baseAss - 0.5, hw - recuo + 1.8, hh, 0.6)
    sombraDeLado(c, s, uniao(uniao(poste, sentar), perna), 10)
    s.partes.push(P(caixa(fimEncosto - 0.5, hh - 9, hw - recuo, hh - 7.2, 0.3), mad, { face, tabua: 0, bisel: 0.5, tom: 0.82, semente: 72 }))
    s.partes.push(P(perna, mad, { face, eixo: QUARTO, tabua: 0, bisel: 0.8, semente: 73 }))
    s.partes.push(P(poste, mad, { face, eixo: QUARTO, tabua: 0, bisel: 1, semente: 74 }))
    s.partes.push(P(sentar, mad, { face, tabua: 0, bisel: 1, semente: 75 }))
    if (c.m.assento.classe === 'palha') s.partes.push(P(caixa(fimEncosto, topoAss - 1.6, hw - 1.4, topoAss + 0.6, 0.6), c.m.assento, { face, bisel: 0.6, contorno: 0.1 }))
  }

  /** Mourões a cada ~1 casa pela reta ou pelo arco (a mesma régua de `tracosDaCerca` do app). */
  function geometriaDaCerca(c) {
    const esp = Math.min(c.h, c.g * 0.25)
    const rp = 0.45 * esp
    const L = Math.max(0, c.w - 2 * rp)
    const teta = (limitar(c.curva, 0, 180) * Math.PI) / 180
    const pontos = []
    if (teta < 0.02) {
      const n = Math.max(2, Math.ceil(L / c.g) + 1)
      for (let i = 0; i < n; i += 1) pontos.push([-L / 2 + (L * i) / (n - 1), 0])
    } else {
      const R = L / 2 / Math.sin(teta / 2)
      const cy = R * Math.cos(teta / 2)
      const n = Math.max(2, Math.ceil((R * teta) / (c.g * 0.85)) + 1)
      for (let i = 0; i < n; i += 1) {
        const a = -Math.PI / 2 - teta / 2 + (teta * i) / (n - 1)
        pontos.push([R * Math.cos(a), cy + R * Math.sin(a)])
      }
    }
    return { pontos, rp }
  }

  function encurtar(a, b, k) {
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const l = Math.hypot(dx, dy) || 1
    return [a[0] + (dx / l) * k, a[1] + (dy / l) * k, b[0] - (dx / l) * k, b[1] - (dy / l) * k]
  }

  function cerca(c, s) {
    const { pontos, rp } = geometriaDaCerca(c)
    const H = c.g * 0.72
    const mad = c.m.madeira
    const lig = c.ids.ligacao
    const L = s.partes
    const segs = []
    for (let i = 0; i + 1 < pontos.length; i += 1) segs.push([pontos[i], pontos[i + 1]])
    for (const [px, py] of pontos) s.sombras.push({ forma: elipse(px, py, rp, rp), z: H }, contato(elipse(px, py, rp, rp)))
    for (const [a, b] of segs) {
      const [ax, ay, bx, by] = encurtar(a, b, rp * 0.5)
      s.sombras.push({ forma: capsula(ax, ay, bx, by, lig === 'arame' ? 0.6 : 1.6), z: H * 0.7, forca: lig === 'arame' ? 0.18 : 0.26, solta: true })
    }
    const topo = (px, py, i, dy) => {
      L.push(P(anel(px, py, rp, rp, rp * 0.8, rp * 0.8), mad, { dy, polar: { cx: px, cy: py, r: rp }, tabua: 2.4, bisel: 1, tom: 0.66, semente: 80 + i }))
      L.push(P(elipse(px, py, rp * 0.81, rp * 0.81), mad, { dy, tex: texTopo, centro: [px, py], bisel: 0.9, semente: 90 + i }))
    }
    const ligacao = (a, b, i, z) => {
      const [ax, ay, bx, by] = encurtar(a, b, rp * 0.55)
      const ang = Math.atan2(by - ay, bx - ax)
      if (lig === 'varas') {
        for (const zv of z === null ? [0] : [0.68 * H, 0.34 * H]) {
          L.push(P(capsula(ax, ay - zv, bx, by - zv, 1.8), mad, { eixo: ang, tabua: 0, bisel: 0.9, contorno: 0.26, tom: 0.94, semente: 100 + i }))
        }
      } else if (lig === 'corda') {
        const zc = z === null ? 0 : 0.78 * H
        const mx = (ax + bx) / 2
        const my = (ay + by) / 2 - zc + (z === null ? 0 : 2.6)
        L.push(P(capsula(ax, ay - zc, mx, my, 1.3), c.m.ligacao, { eixo: ang, bisel: 1.3, contorno: 0.18, semente: 110 + i }))
        L.push(P(capsula(mx, my, bx, by - zc, 1.3), c.m.ligacao, { eixo: ang, bisel: 1.3, contorno: 0.18, semente: 111 + i }))
      } else {
        const alturas = z === null ? [-0.7, 0.7] : [0.8 * H, 0.45 * H]
        for (const zv of alturas) {
          const oy = z === null ? zv : -zv
          L.push(P(capsula(ax, ay + oy, bx, by + oy, 0.55), c.m.ligacao, { eixo: ang, bisel: 0.55, contorno: 0.1, semente: 120 + i }))
        }
      }
    }
    if (!c.tres) {
      segs.forEach(([a, b], i) => ligacao(a, b, i, null))
      pontos.forEach(([px, py], i) => topo(px, py, i, 0))
      return
    }
    const elementos = []
    pontos.forEach(([px, py], i) => elementos.push({
      y: py,
      desenhar: () => {
        L.push(P(ladoReto(px, py, rp, rp, H), mad, { face: 'frente', cilindro: { cx: px, r: rp }, tabua: 0, bisel: 0, tom: 0.92, contorno: 0.2, semente: 70 + i }))
        topo(px, py, i, -H)
      },
    }))
    segs.forEach(([a, b], i) => elementos.push({ y: (a[1] + b[1]) / 2 - 0.01, desenhar: () => ligacao(a, b, i, H) }))
    elementos.sort((p, q) => p.y - q.y).forEach((e) => e.desenhar())
  }

  function armario(c, s) {
    if (c.vista === 'lado') return armarioDeLado(c, s)
    const { hw, hh, w, h } = c
    const mad = c.m.madeira
    const pux = c.m.puxadores
    const zB = c.g * 0.9
    const zA = c.g * 1.52
    const yDegrau = -hh + 0.45 * h
    s.sombras.push({ forma: caixa(-hw, -hh, hw, hh, 1), z: zB }, { forma: caixa(-hw, -hh, hw, yDegrau, 1), z: zA }, contato(caixa(-hw, -hh, hw, hh, 1)))
    const L = s.partes
    if (!c.tres) {
      L.push(P(caixa(-hw, yDegrau - 1, hw, hh, 1), mad, { tabua: 6.5, bisel: 1.3, semente: 130 }))
      L.push(P(caixa(-hw, -hh, hw, yDegrau, 1), mad, { tabua: 0, bisel: 1.4, semente: 131, projeta: { dist: (zA - zB) * 0.3, forca: 0.33, suave: 2.2 } }))
      for (const sx of [-1, 1]) {
        const xc = sx * 0.25 * w
        L.push(P(caixa(xc - 0.8, hh - 0.18 * h, xc + 0.8, hh + 1.2, 0.5), pux, { bisel: 0.7, contorno: 0.2, projeta: { dist: 0.8, forca: 0.3 } }))
      }
      return
    }
    const frente = { face: 'frente' }
    const topoFrente = hh - zB
    L.push(P(caixa(-hw, topoFrente, hw, hh, 0.5), mad, { ...frente, tabua: 0, bisel: 0.6, tom: 0.88, semente: 132 }))
    L.push(P(caixa(-hw - 0.6, topoFrente, hw + 0.6, topoFrente + 3, 0.6), mad, { ...frente, tabua: 0, bisel: 0.8, luz: 0.04, semente: 133 }))
    gavetas(L, mad, pux, frente, -hw, topoFrente + 3.8, hw, hh - 4.5, w)
    L.push(P(caixa(-hw + 1, hh - 4.5, hw - 1, hh, 0.3), mad, { ...frente, tabua: 0, bisel: 0.4, tom: 0.58, semente: 134 }))
    L.push(P(caixa(-hw, -hh, hw, hh, 1), mad, { dy: -zB, tabua: 6.5, bisel: 1.3, semente: 130 }))
    const topoA = yDegrau - zA
    const baseA = yDegrau - zB
    const nicho = baseA - 0.42 * (zA - zB)
    L.push(P(caixa(-hw, topoA, hw, baseA, 0.5), mad, { ...frente, tabua: 0, bisel: 0.6, tom: 0.9, semente: 135 }))
    L.push(P(caixa(-hw + 3, nicho, hw - 3, baseA, 0.3), mad, { ...frente, tabua: 0, bisel: 0, tom: 0.42, recesso: { k: 3.5, forca: 0.4 }, contorno: 0, semente: 136 }))
    L.push(P(caixa(-0.34 * w, topoA + 3, 0.34 * w, nicho - 2.2, 1), mad, { ...frente, eixo: QUARTO, tabua: 0, bisel: 1.4, semente: 137 }))
    L.push(P(elipse(0.25 * w, (topoA + nicho) / 2, 1.1, 1.1), pux, { ...frente, bisel: 1.1, contorno: 0.1, projeta: { dist: 0.8, forca: 0.3 } }))
    L.push(P(caixa(-hw - 0.6, topoA, hw + 0.6, topoA + 2.2, 0.5), mad, { ...frente, tabua: 0, bisel: 0.7, luz: 0.05, semente: 138 }))
    L.push(P(caixa(-hw, -hh, hw, yDegrau, 1), mad, { dy: -zA, tabua: 0, bisel: 1.4, semente: 131 }))
  }

  /** Duas gavetas em relevo, cada uma com um puxador deitado no meio. */
  function gavetas(L, mad, pux, o, x0, y0, x1, y1, w) {
    const meio = (y0 + y1) / 2
    for (const [a, b] of [[y0 + 0.7, meio - 0.7], [meio + 0.7, y1 - 0.7]]) {
      L.push(P(caixa(x0 + 2.2, a, x1 - 2.2, b, 1), mad, { ...o, tabua: 0, bisel: 1.3, semente: 140 + Math.round(a) }))
      const yc = (a + b) / 2
      L.push(P(caixa(-0.08 * w, yc - 1, 0.08 * w, yc + 1, 0.8), pux, { ...o, bisel: 0.9, contorno: 0.15, projeta: { dist: 0.8, forca: 0.3 } }))
    }
  }

  /** Armário de cozinha de lado: a frente em pé, como em `ARMARIO_DE_LADO` (lib/mobilia.ts:337). */
  function armarioDeLado(c, s) {
    const { hw, hh, w, h } = c
    const mad = c.m.madeira
    const pux = c.m.puxadores
    const o = { face: faceDe(c) }
    const nA = (f) => -hh + f * h
    sombraDeLado(c, s, caixa(-hw, -hh, hw, hh, 1), 18)
    const L = s.partes
    L.push(P(caixa(-hw, -hh, hw, hh, 0.6), mad, { ...o, tabua: 0, bisel: 0.8, tom: 0.88, semente: 150 }))
    L.push(P(caixa(-hw, -hh, hw, nA(0.04), 0.5), mad, { ...o, tabua: 0, bisel: 0.7, luz: 0.05, semente: 151 }))
    L.push(P(caixa(-0.34 * w, nA(0.06), 0.34 * w, nA(0.25), 1), mad, { ...o, eixo: QUARTO, tabua: 0, bisel: 1.4, semente: 152 }))
    L.push(P(elipse(0.25 * w, nA(0.155), 1.1, 1.1), pux, { ...o, bisel: 1.1, contorno: 0.1, projeta: { dist: 0.8, forca: 0.3 } }))
    L.push(P(caixa(-hw, nA(0.285), hw, nA(0.31), 0.3), mad, { ...o, tabua: 0, bisel: 0.6, luz: 0.04, semente: 153 }))
    L.push(P(caixa(-0.42 * w, nA(0.31), 0.42 * w, nA(0.555), 0.3), mad, { ...o, tabua: 0, bisel: 0, tom: 0.42, recesso: { k: 3.5, forca: 0.4 }, contorno: 0, semente: 154 }))
    L.push(P(caixa(-hw - 0.4, nA(0.555), hw + 0.4, nA(0.59), 0.5), mad, { ...o, tabua: 0, bisel: 0.8, luz: 0.05, semente: 155 }))
    gavetas(L, mad, pux, o, -hw, nA(0.59), hw, nA(0.94), w)
    L.push(P(caixa(-hw + 1, nA(0.94), hw - 1, hh, 0.3), mad, { ...o, tabua: 0, bisel: 0.4, tom: 0.58, semente: 156 }))
  }

  /** Duas portas em relevo que se encontram no meio, com um puxador em pé de cada lado do encontro. */
  function portasDoAparador(L, mad, pux, o, x0, y0, x1, y1, w) {
    for (const [a, b] of [[x0 + 2, -0.7], [0.7, x1 - 2]]) L.push(P(caixa(a, y0 + 2, b, y1 - 1.5, 1), mad, { ...o, eixo: QUARTO, tabua: 0, bisel: 1.3, semente: 160 + Math.round(a) }))
    const xp = 0.045 * w
    const ya = y0 + (y1 - y0) * 0.3
    const yb = y0 + (y1 - y0) * 0.58
    for (const sx of [-1, 1]) L.push(P(caixa(sx * xp - 0.9, ya, sx * xp + 0.9, yb, 0.6), pux, { ...o, bisel: 0.8, contorno: 0.15, projeta: { dist: 0.8, forca: 0.3 } }))
  }

  function aparador(c, s) {
    if (c.vista === 'lado') return aparadorDeLado(c, s)
    const { hw, hh, w, h } = c
    const mad = c.m.madeira
    const pux = c.m.puxadores
    const H = c.g * 0.62
    const esp = 5
    const sobra = 0.035 * w
    s.sombras.push({ forma: caixa(-hw, -hh, hw, hh, 1.2), z: H }, contato(caixa(-hw + sobra, -hh, hw - sobra, hh)))
    const L = s.partes
    if (!c.tres) {
      L.push(P(caixa(-hw, -hh, hw, hh, 1.4), mad, { tabua: 7, bisel: 1.6, semente: 170 }))
      for (const sx of [-1, 1]) {
        const xc = sx * 0.045 * w
        L.push(P(caixa(xc - 0.8, hh - 0.28 * h, xc + 0.8, hh + 1, 0.5), pux, { bisel: 0.7, contorno: 0.2, projeta: { dist: 0.8, forca: 0.3 } }))
      }
      return
    }
    const frente = { face: 'frente' }
    const topoCorpo = hh - (H - esp)
    const rodape = hh - 0.12 * (H - esp)
    L.push(P(caixa(-hw + sobra, topoCorpo, hw - sobra, hh, 0.4), mad, { ...frente, tabua: 0, bisel: 0.6, tom: 0.88, semente: 171 }))
    portasDoAparador(L, mad, pux, frente, -hw + sobra, topoCorpo, hw - sobra, rodape, w)
    L.push(P(caixa(-hw + sobra, rodape, hw - sobra, hh, 0.3), mad, { ...frente, tabua: 0, bisel: 0.4, tom: 0.58, semente: 172 }))
    L.push(P(caixa(-hw, hh - H, hw, hh - H + esp, 0.8), mad, { ...frente, tabua: 0, bisel: 0.9, luz: 0.03, semente: 173 }))
    L.push(P(caixa(-hw, -hh, hw, hh, 1.4), mad, { dy: -H, tabua: 7, bisel: 1.6, semente: 170 }))
  }

  /** Aparador de lado: o tampo sobrando dos dois lados, as portas, os puxadores e o rodapé (`APARADOR_DE_LADO`). */
  function aparadorDeLado(c, s) {
    const { hw, hh, w, h } = c
    const mad = c.m.madeira
    const pux = c.m.puxadores
    const o = { face: faceDe(c) }
    const nA = (f) => -hh + f * h
    const meioCorpo = hw - 0.035 * w
    const tampo = caixa(-hw, -hh, hw, nA(0.14), 0.8)
    const corpo = caixa(-meioCorpo, nA(0.14), meioCorpo, hh, 0.4)
    sombraDeLado(c, s, uniao(tampo, corpo), 12)
    const L = s.partes
    L.push(P(corpo, mad, { ...o, tabua: 0, bisel: 0.6, tom: 0.88, semente: 180 }))
    portasDoAparador(L, mad, pux, o, -meioCorpo, nA(0.14), meioCorpo, nA(0.88), w)
    L.push(P(caixa(-meioCorpo, nA(0.88), meioCorpo, hh, 0.3), mad, { ...o, tabua: 0, bisel: 0.4, tom: 0.58, semente: 181 }))
    L.push(P(tampo, mad, { ...o, tabua: 0, bisel: 1, luz: 0.03, semente: 182 }))
  }

  /** Chama parada em três camadas, do laranja de fora ao amarelo baixo do miolo. */
  function chama(L, cx, base, larg, alt) {
    const camadas = [
      [1, 1, [214, 124, 58], [178, 74, 42], 0.9],
      [0.62, 0.66, [232, 164, 82], [214, 120, 58], 0.95],
      [0.3, 0.32, [242, 206, 136], [234, 170, 92], 1],
    ]
    for (const [kl, ka, de, ate, alfa] of camadas) {
      L.push(P(gota(cx, base, larg * kl, alt * ka), CHAMA, { tex: texChama, chama: { base, alt: alt * ka, de, ate }, bisel: 0, contorno: 0, suave: 1.1, alfa }))
    }
  }

  function fogueira(c, s) {
    if (c.vista === 'lado') return fogueiraDeLado(c, s)
    const { hw, hh } = c
    const R = Math.min(hw, hh)
    const pedra = c.m.pedras
    const lenha = c.m.lenha
    const tres = c.tres
    s.brilhos.push({ cx: 0, cy: tres ? -4 : 0, r: c.g * 1.15, cor: [214, 124, 58], forca: 0.16, achatar: 0.85 })
    const pedras = []
    const raioMedio = 0.81
    for (let i = 0; i < 8; i += 1) {
      const a = ((i + 0.5) / 8) * TAU + (hash(i, 3, 901) - 0.5) * 0.18
      const tang = 0.33 * R * (0.9 + 0.2 * hash(i, 4, 901))
      const rad = 0.21 * R * (0.9 + 0.2 * hash(i, 5, 901))
      const px = Math.cos(a) * hw * raioMedio
      const py = Math.sin(a) * hh * raioMedio
      pedras.push({ px, py, a, tang, rad, i })
      s.sombras.push({ forma: elipse(px, py, tang, rad, a + QUARTO), z: 7, forca: 0.3 })
    }
    const L = s.partes
    const dyChao = tres ? -1 : 0
    const desenharPedra = (p) => {
      const ry = tres ? p.rad * 1.3 : p.rad
      L.push(P(elipse(p.px, p.py, p.tang, ry, p.a + QUARTO), pedra, { dy: tres ? -ry * 0.55 : 0, bisel: Math.min(p.tang, ry) * 0.92, contorno: 0.2, semente: 200 + p.i }))
    }
    L.push(P(elipse(0, 0, hw * 0.76, hh * 0.76), CINZA, { dy: dyChao, tex: texBrasas, brasas: [0, 0, R * 0.76], bisel: 0, contorno: 0, semente: 210 }))
    if (tres) pedras.filter((p) => p.py < 0).sort((a, b) => a.py - b.py).forEach(desenharPedra)
    const comprimento = 0.56 * 2 * R
    const raio = 0.058 * 2 * R
    const dyLenha = tres ? -raio - 1 : 0
    for (const [k, graus] of [[0, 35], [1, -35]]) {
      const ang = (graus * Math.PI) / 180
      const ax = (-Math.cos(ang) * comprimento) / 2
      const ay = (-Math.sin(ang) * comprimento) / 2
      L.push(P(capsula(ax, ay, -ax, -ay, raio), lenha, { dy: dyLenha, eixo: ang, tex: texLenha, fogo: [0, 0, R * 0.42], bisel: raio, contorno: 0.2, semente: 220 + k, projeta: k ? { dist: 1.2, forca: 0.35 } : undefined }))
    }
    L.push(P(elipse(0, 0, 3.4, 2.7), CINZA, { dy: dyLenha - raio * 0.6, tex: texBrasas, brasas: [0, 0, 2.2], bisel: 0, contorno: 0, suave: 0.8, semente: 230 }))
    if (tres) {
      chama(L, 0, dyLenha - raio * 0.4, 0.36 * 2 * R, 0.44 * c.g)
      pedras.filter((p) => p.py >= 0).sort((a, b) => a.py - b.py).forEach(desenharPedra)
    } else pedras.forEach(desenharPedra)
  }

  /** Fogueira de lado: quatro pedras em domo na frente, lenha em X, brasa e a chama parada (`FOGUEIRA_DE_LADO`). */
  function fogueiraDeLado(c, s) {
    const { hw, hh, w, h } = c
    const pedra = c.m.pedras
    const lenha = c.m.lenha
    const face = faceDe(c)
    const nA = (f) => -hh + f * h
    const picos = [0.81, 0.79, 0.82, 0.8]
    const formas = picos.map((pico, i) => {
      const cx = (-0.375 + 0.25 * i) * w
      const topo = nA(pico)
      return elipse(cx, (topo + hh) / 2 + 0.6, 0.155 * w, (hh - topo) / 2 + 0.6)
    })
    sombraDeLado(c, s, formas.reduce(uniao), 7)
    s.brilhos.push({ cx: 0, cy: nA(0.72), r: c.g * 0.95, cor: [214, 124, 58], forca: 0.14, achatar: 0.8 })
    const L = s.partes
    const raio = 0.035 * w * 1.3
    for (const [k, sx] of [[0, 1], [1, -1]]) {
      L.push(P(capsula(-sx * 0.26 * w, nA(0.79), sx * 0.26 * w, nA(0.56), raio), lenha, { face, eixo: Math.atan2(nA(0.56) - nA(0.79), 2 * sx * 0.26 * w), tex: texLenha, fogo: [0, nA(0.675), 0.2 * w], bisel: raio, contorno: 0.2, semente: 240 + k, projeta: k ? { dist: 1, forca: 0.3 } : undefined }))
    }
    L.push(P(elipse(0, nA(0.735), 6.5, 2.6), CINZA, { tex: texBrasas, brasas: [0, nA(0.735), 6], bisel: 0, contorno: 0, suave: 0.8, semente: 250 }))
    chama(L, 0, nA(0.7), 0.32 * w, 0.46 * h)
    formas.forEach((forma, i) => L.push(P(forma, pedra, { face, bisel: Math.min(0.155 * w, 6) * 0.9, contorno: 0.2, semente: 260 + i })))
  }

  /** Cores do desenho do tapete a partir do tecido: borda e medalhão mais escuros (como no app, x0,70), fio claro puxado para o creme. */
  function coresDoTapete(base) {
    return {
      campo: base,
      escuro: escalar(base, 0.7),
      meio: escalar(base, 0.8),
      claro: misturar(base, CREME, 0.38),
      miolo: misturar(base, CREME, 0.2),
    }
  }

  function tapete(c, s) {
    const { hw, hh, w } = c
    const tecido = c.m.tecido
    const cores = coresDoTapete(tecido.rgb)
    const L = s.partes
    if (c.vista === 'lado') {
      const face = faceDe(c)
      const fr = 0.04 * w
      const topo = -hh + 0.6 * c.h
      const corpoHW = hw - fr
      sombraDeLado(c, s, caixa(-corpoHW, topo, corpoHW, hh), 2)
      for (const lado of [-1, 1]) {
        L.push(P(caixa(lado < 0 ? -hw : corpoHW - 1, hh - 1.6, lado < 0 ? -corpoHW + 1 : hw, hh, 0), MATERIAIS.linho, { face, tex: texFranja, franja: { corpo: corpoHW, comprimento: fr, lado }, bisel: 0, contorno: 0, eixo: 0 }))
      }
      L.push(P(caixa(-corpoHW, topo, corpoHW, hh, 0.8), tecido, { face, tex: texTapeteLado, tapete: { ...cores, hw: corpoHW, borda: 0.08 * w }, bisel: 0.9, contorno: 0.18 }))
      return
    }
    const redondo = c.forma === 'redondo'
    const tres = c.tres
    const esp = 1.6
    const dy = tres ? -esp : 0
    if (redondo) {
      const corpo = elipse(0, 0, hw, hh)
      s.sombras.push({ forma: corpo, z: 1.5, forca: 0.22, suave: 1.2 })
      if (tres) L.push(P(ladoReto(0, 0, hw, hh, esp), tecido, { face: 'frente', tom: 0.62, bisel: 0, contorno: 0.1 }))
      L.push(P(corpo, tecido, { dy, tex: texTapete, tapete: { ...cores, redondo: true, hw, hh, menor: Math.min(hw, hh), borda: 0.24 * Math.min(hw, hh), medalhao: 0.6 }, bisel: 1.4, contorno: 0.16 }))
      return
    }
    const fr = 0.06 * w
    const corpoHW = hw - fr
    const corpo = caixa(-corpoHW, -hh, corpoHW, hh, 1.2)
    s.sombras.push({ forma: corpo, z: 1.5, forca: 0.22, suave: 1.2 })
    for (const lado of [-1, 1]) {
      const x0 = lado < 0 ? -hw : corpoHW - 1
      const x1 = lado < 0 ? -corpoHW + 1 : hw
      L.push(P(caixa(x0, -hh + 1.5, x1, hh - 1.5, 0), MATERIAIS.linho, { tex: texFranja, franja: { corpo: corpoHW, comprimento: fr, lado }, bisel: 0, contorno: 0 }))
    }
    if (tres) L.push(P(caixa(-corpoHW, hh - esp, corpoHW, hh, 0.4), tecido, { face: 'frente', tom: 0.62, bisel: 0, contorno: 0.1 }))
    L.push(P(corpo, tecido, { dy, tex: texTapete, tapete: { ...cores, hw: corpoHW, hh, borda: 0.12 * Math.min(2 * corpoHW, 2 * hh), menor: Math.min(corpoHW, hh), geo: geometriaDoTapete(corpoHW, hh, 0.12 * Math.min(2 * corpoHW, 2 * hh)) }, bisel: 1.4, contorno: 0.16 }))
  }

  /**
   * Sombra de um móvel na vista de lado: de cima, o recorte em pé faz sombra
   * afastada como os outros; em 3/4 ele está de pé no chão, então a sombra é
   * uma mancha curta na base.
   */
  function sombraDeLado(c, s, forma, altura) {
    if (c.tres) {
      const b = forma.b
      const largura = (b[2] - b[0]) / 2
      s.sombras.push({ forma: elipse((b[0] + b[2]) / 2 + 1.5, b[3] - 0.5, largura * 0.98, Math.max(2.2, largura * 0.12)), z: 0, suave: 1.6, forca: 0.32 })
    } else {
      s.sombras.push({ forma, z: altura }, contato(forma, 0.24))
    }
  }

  const CONSTRUTORES = {
    barril, caixa: caixaDeMadeira, bau, catre: cama, mesa, cadeira, cerca, armario, aparador, fogueira, tapete,
  }

  // ---------- a imagem de cada móvel ----------

  /** O material de cada escolha; "Madeira" do assento e "Varas" da cerca usam a madeira do próprio móvel. */
  function materiaisDe(tipo, escolhidos) {
    const ids = {}
    const m = {}
    for (const rr of RANURAS[tipo]) {
      const id = escolhidos && MATERIAIS[escolhidos[rr.id]] && rr.opcoes.includes(escolhidos[rr.id]) ? escolhidos[rr.id] : rr.padrao
      ids[rr.id] = id
    }
    for (const rr of RANURAS[tipo]) {
      const id = ids[rr.id]
      m[rr.id] = MATERIAIS[id].classe === 'ref' ? MATERIAIS[ids.madeira] : MATERIAIS[id]
    }
    return { ids, m }
  }

  function montar(def) {
    const w = def.largura
    const h = def.altura
    const { ids, m } = materiaisDe(def.tipo, def.materiais)
    const c = {
      w, h, hw: w / 2, hh: h / 2, g: G, tres: def.estilo === '34',
      vista: aceitaVista(def.tipo) && def.vista === 'lado' ? 'lado' : 'frente',
      forma: def.forma === 'redondo' ? 'redondo' : 'retangular', curva: def.curva || 0, m, ids,
    }
    const saida = { partes: [], sombras: [], brilhos: [] }
    CONSTRUTORES[def.tipo](c, saida)
    return saida
  }

  function chaveDe(def) {
    const { ids } = materiaisDe(def.tipo, def.materiais)
    const mats = RANURAS[def.tipo].map((rr) => ids[rr.id]).join(',')
    return [def.tipo, def.largura.toFixed(2), def.altura.toFixed(2), def.vista || 'frente', def.forma || 'retangular', def.curva || 0, def.estilo, mats].join('|')
  }

  function unir(b, x0, y0, x1, y1) {
    if (x0 < b[0]) b[0] = x0
    if (y0 < b[1]) b[1] = y0
    if (x1 > b[2]) b[2] = x1
    if (y1 > b[3]) b[3] = y1
  }

  /**
   * Ruído de arredondamento: meio tom para cima ou para baixo, sorteado por
   * pixel. Sem ele, o brilho da fogueira e a borda da sombra (degradês longos
   * e fracos) viram anéis de 8 bits.
   */
  const LADO_DO_PONTILHADO = 64
  const PONTILHADO = new Float32Array(LADO_DO_PONTILHADO * LADO_DO_PONTILHADO * 2)
  for (let i = 0; i < PONTILHADO.length; i += 1) PONTILHADO[i] = hash(i, 17, 9001) - 0.5

  /**
   * Pinta as peças da frente para trás (a última da lista fica por cima) e
   * depois o chão (sombras e brilho) por baixo de tudo; devolve o canvas.
   */
  function pintarCena(W, H, x0, y0, S, partes, sombras, brilhos) {
    const alvo = { buf: new Float32Array(W * H * 4), sombra: new Float32Array(W * H).fill(1), W, H, x0, y0, S }
    for (let i = partes.length - 1; i >= 0; i -= 1) {
      const p = partes[i]
      pintarParte(alvo, p)
      if (p.projeta) projetar(alvo, p)
    }
    const chao = { buf: new Float32Array(W * H * 4), W, H, x0, y0, S }
    pintarSombras(chao, sombras)
    pintarBrilhos(chao, brilhos)
    const buf = alvo.buf
    const baixo = chao.buf
    const imagem = new ImageData(W, H)
    const d = imagem.data
    for (let py = 0, o = 0; py < H; py += 1) {
      const linha = (py & (LADO_DO_PONTILHADO - 1)) * LADO_DO_PONTILHADO
      for (let px = 0; px < W; px += 1, o += 4) {
        const resta = 1 - buf[o + 3]
        const a = buf[o + 3] + resta * baixo[o + 3]
        if (a <= 0.002) continue
        const q = (linha + (px & (LADO_DO_PONTILHADO - 1))) * 2
        const pr = PONTILHADO[q]
        d[o] = (buf[o] + resta * baixo[o]) / a + pr
        d[o + 1] = (buf[o + 1] + resta * baixo[o + 1]) / a + pr
        d[o + 2] = (buf[o + 2] + resta * baixo[o + 2]) / a + pr
        d[o + 3] = a * 255 + PONTILHADO[q + 1]
      }
    }
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    canvas.getContext('2d').putImageData(imagem, 0, 0)
    return canvas
  }

  /**
   * Gera a imagem do móvel em `S` pixels por px do mapa. Devolve o canvas e
   * onde ele fica em relação ao centro do móvel (`ox`, `oy`, em px do mapa),
   * a caixa das peças (sem a sombra, para a seleção) e quanto tempo levou.
   */
  function gerarSprite(def, S) {
    const t0 = performance.now()
    const cena = montar(def)
    const pecas = [Infinity, Infinity, -Infinity, -Infinity]
    for (const p of cena.partes) unir(pecas, p.forma.b[0] + p.dx, p.forma.b[1] + p.dy, p.forma.b[2] + p.dx, p.forma.b[3] + p.dy)
    const tudo = pecas.slice()
    for (const s of cena.sombras) {
      const su = (s.suave ?? 0.8 + 0.09 * s.z) * 2
      const b = s.forma.b
      unir(tudo, b[0] - su, b[1] - su, b[2] + su, b[3] + su)
      unir(tudo, b[0] + SOMBRA_X * s.z - su, b[1] + SOMBRA_Y * s.z - su, b[2] + SOMBRA_X * s.z + su, b[3] + SOMBRA_Y * s.z + su)
    }
    for (const g of cena.brilhos) unir(tudo, g.cx - g.r, g.cy - g.r, g.cx + g.r, g.cy + g.r)
    const x0 = Math.floor(tudo[0] - 1)
    const y0 = Math.floor(tudo[1] - 1)
    const W = Math.max(1, Math.ceil((tudo[2] + 1 - x0) * S))
    const H = Math.max(1, Math.ceil((tudo[3] + 1 - y0) * S))
    const canvas = pintarCena(W, H, x0, y0, S, cena.partes, cena.sombras, cena.brilhos)
    return {
      canvas, S, ox: x0, oy: y0, largura: W / S, altura: H / S, pecas, niveis: [canvas],
      formas: cena.partes.map((p) => [p.forma, p.dx, p.dy]),
      ms: performance.now() - t0,
    }
  }

  /** O ponto (px do mapa, relativo ao centro do móvel) cai numa peça? Clique no chão dentro do arco da cerca não pega a cerca. */
  function acertou(sprite, x, y, folga = 2) {
    for (const [f, dx, dy] of sprite.formas) if (f.d(x - dx, y - dy) < folga) return true
    return false
  }

  /**
   * A imagem na resolução mais perto da pedida, nunca menor: metade, um quarto
   * e um oitavo saem da anterior pela média (o veio fino não cintila no zoom 50%).
   */
  function nivel(sprite, escala) {
    let k = 0
    while (k < 3 && sprite.S / 2 ** (k + 1) >= escala * 0.98) k += 1
    for (let i = 1; i <= k; i += 1) {
      if (sprite.niveis[i]) continue
      const anterior = sprite.niveis[i - 1]
      const c = document.createElement('canvas')
      c.width = Math.max(1, Math.ceil(anterior.width / 2))
      c.height = Math.max(1, Math.ceil(anterior.height / 2))
      const ctx = c.getContext('2d')
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(anterior, 0, 0, c.width, c.height)
      sprite.niveis[i] = c
    }
    return { canvas: sprite.niveis[k], escala: sprite.S / 2 ** k }
  }

  /** Amostra do material para o botão: um pedaço de verdade, com a mesma textura e luz. */
  function gerarAmostra(id, madeira, S, larg = 52, alt = 44) {
    const t0 = performance.now()
    const bruto = MATERIAIS[id]
    const mat = bruto.classe === 'ref' ? MATERIAIS[madeira] || MATERIAIS.carvalho : bruto
    const partes = []
    const sombras = []
    const cx = larg / 2
    const cy = alt / 2
    const classe = bruto.classe === 'ref' ? (id === 'varas' ? 'varas' : 'madeira') : mat.classe
    if (classe === 'madeira') {
      const f = caixa(5, 6, larg - 5, alt - 6, 2)
      partes.push(P(f, mat, { tabua: 8.5, bisel: 1.6, semente: 7 }))
      sombras.push({ forma: f, z: 6 })
    } else if (classe === 'varas') {
      for (const [k, y] of [[0, cy - 6], [1, cy + 6]]) {
        const f = capsula(6, y, larg - 6, y, 3.4)
        partes.push(P(f, mat, { tabua: 0, bisel: 3.4, semente: 8 + k }))
        sombras.push({ forma: f, z: 5 })
      }
    } else if (classe === 'metal') {
      const f = caixa(7, 8, larg - 7, alt - 8, 2.5)
      partes.push(P(f, mat, { bisel: 2.6, semente: 9 }))
      for (const px of [12, larg - 12]) partes.push(P(elipse(px, cy, 2, 2), mat, { bisel: 2, tom: 0.9, contorno: 0.1 }))
      sombras.push({ forma: f, z: 5 })
    } else if (classe === 'tecido') {
      const f = caixa(5, 6, larg - 5, alt - 6, 6)
      partes.push(P(f, mat, { bisel: 7, ruga: 2, semente: 10 }))
      sombras.push({ forma: f, z: 5 })
    } else if (classe === 'pedra') {
      const f = elipse(cx, cy, 18, 13, -0.15)
      partes.push(P(f, mat, { bisel: 12, semente: 11 }))
      sombras.push({ forma: f, z: 8 })
    } else if (classe === 'palha') {
      const f = caixa(6, 7, larg - 6, alt - 7, 2)
      partes.push(P(f, mat, { bisel: 1.2, semente: 12 }))
      sombras.push({ forma: f, z: 4 })
    } else if (classe === 'corda') {
      const f = capsula(6, cy, larg - 6, cy, 4.2)
      partes.push(P(f, mat, { bisel: 4.2, semente: 13 }))
      sombras.push({ forma: f, z: 4 })
    } else if (classe === 'casca') {
      for (const [k, y] of [[0, cy - 7], [1, cy + 6]]) {
        const f = capsula(8, y, larg - 8, y, 5)
        partes.push(P(f, mat, { tabua: 0, bisel: 5, semente: 14 + k }))
        sombras.push({ forma: f, z: 5 })
      }
    }
    const x0 = 0
    const y0 = 0
    const W = Math.ceil(larg * S)
    const H = Math.ceil(alt * S)
    const canvas = pintarCena(W, H, x0, y0, S, partes, sombras, [])
    return { canvas, ms: performance.now() - t0 }
  }

  return {
    G, TIPOS, ROTULO, RANURAS, MATERIAIS, TIPOS_COM_VISTA,
    aceitaVista, tamanhoEmCasas, materiaisDe, chaveDe, gerarSprite, gerarAmostra, nivel, acertou,
  }
})()
