// gerar-provas.cjs — as provas do protótipo contra as metas de provas/metas.json (escritas antes do código).
// Rodar da raiz do repo, sob o trinco das suítes pesadas:
//   node <trinco> -- node docs/design/batalha-isometrica/provas/gerar-provas.cjs [node|navegador|tudo] [--referencias <pasta>]
// --referencias: pasta com os prints de referência do usuário (fora do repo), só para conferir que nenhum foi copiado.
'use strict'
const fs = require('fs')
const os = require('os')
const path = require('path')
const vm = require('vm')
const crypto = require('crypto')
const { pathToFileURL } = require('url')

const PROVAS = __dirname
const PROTO = path.join(PROVAS, '..', 'prototipo')
const PASTA = path.join(PROVAS, '..')
const RAIZ = path.resolve(PROVAS, '..', '..', '..', '..')
const PRINTS = path.join(PROVAS, 'prints')
const SAIDA = path.join(PROVAS, 'testes.json')
const METAS = JSON.parse(fs.readFileSync(path.join(PROVAS, 'metas.json'), 'utf8'))

const modo = ['node', 'navegador', 'desempenho', 'tudo'].includes(process.argv[2]) ? process.argv[2] : 'tudo'
const iRef = process.argv.indexOf('--referencias')
const PASTA_REFERENCIAS = iRef > 0 ? process.argv[iRef + 1] : null

/** O núcleo é um script de navegador (var Nucleo); a raiz do repo é ESM, então ele entra por vm, não por require. */
function carregarNucleo() {
  const src = fs.readFileSync(path.join(PROTO, 'nucleo.js'), 'utf8')
  return vm.runInNewContext(src + '\n;Nucleo', { console })
}
const N = carregarNucleo()
const pct = (a, b) => (b ? Math.round((a / b) * 100000) / 1000 : 100)
const log = (...a) => console.log('[provas]', ...a)

// ======================================================================================
// (a) Clique: bloco -> tela -> bloco, contra o raio da câmera
// ======================================================================================
function provaClique() {
  const M = METAS.a_picking
  const r = { casos: 0, certos: 0, voltamASiMesmos: 0, escondidosDevolvemQuemCobre: 0, aoAcaso: 0, aoAcasoCertos: 0, falhas: [] }
  const sorte = N.rng(11)
  for (const nome of M.mapas) {
    const m = N[nome]()
    for (const rot of M.rotacoes) {
      const P = N.preparo(m, rot)
      for (const zoom of M.zooms) {
        const cam = { cx: P.met.largura / 2, cy: P.met.altura / 2, zoom, w: 1280, h: 800 }
        // o clique de verdade cai no centro de um pixel da tela
        const clicar = (sx, sy) => {
          const [lx, ly] = N.telaParaCamada(cam, Math.floor(sx) + 0.5, Math.floor(sy) + 0.5)
          return { pega: N.blocoNoPonto(m, rot, lx, ly), raio: N.raioNoPonto(m, rot, lx, ly, true) }
        }
        const conferir = (pega, raio) => (raio.length ? raio.includes(pega) : pega === -1)
        for (let i = 0; i < m.c.length; i++) {
          const [lx, ly] = N.pontoDoBloco(m, rot, i % m.W, (i / m.W) | 0)
          const [sx, sy] = N.camadaParaTela(cam, lx, ly)
          const { pega, raio } = clicar(sx, sy)
          r.casos++
          if (conferir(pega, raio)) {
            r.certos++
            if (pega === i) r.voltamASiMesmos++
            else r.escondidosDevolvemQuemCobre++
          } else if (r.falhas.length < 12) r.falhas.push({ mapa: nome, rot, zoom, bloco: i, pega, raio })
        }
        for (let k = 0; k < 2500; k++) {
          const [sx, sy] = N.camadaParaTela(cam, sorte() * P.met.largura, sorte() * P.met.altura)
          const { pega, raio } = clicar(sx, sy)
          r.aoAcaso++
          if (conferir(pega, raio)) r.aoAcasoCertos++
          else if (r.falhas.length < 12) r.falhas.push({ mapa: nome, rot, zoom, ponto: [sx, sy], pega, raio })
        }
      }
    }
  }
  r.percentual = pct(r.certos, r.casos)
  r.percentualAoAcaso = pct(r.aoAcasoCertos, r.aoAcaso)
  r.passou = r.certos === r.casos && r.aoAcasoCertos === r.aoAcaso
  return r
}

// ======================================================================================
// (b) Ordem de pintura: buffer de identificadores (o algoritmo do pintor) contra o z-buffer analítico
// ======================================================================================
function preencherConvexo(buf, W, H, pts, id) {
  let y0 = Infinity
  let y1 = -Infinity
  for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]) }
  for (let y = Math.max(0, Math.ceil(y0 - 0.5)); y <= Math.min(H - 1, Math.floor(y1 - 0.5)); y++) {
    const yc = y + 0.5
    let xl = Infinity
    let xr = -Infinity
    for (let k = 0; k < pts.length; k++) {
      const a = pts[k]
      const b = pts[(k + 1) % pts.length]
      if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) {
        const x = a[0] + ((yc - a[1]) / (b[1] - a[1])) * (b[0] - a[0])
        xl = Math.min(xl, x)
        xr = Math.max(xr, x)
      }
    }
    if (xl > xr) continue
    const o = y * W
    for (let x = Math.max(0, Math.ceil(xl - 0.5)); x <= Math.min(W - 1, Math.floor(xr - 0.5)); x++) buf[o + x] = id
  }
}
/** Objetos e unidades parados, com a mesma caixa e a mesma pegada que a página usa. O desenho conta como retângulo cheio. */
function objetosDoMapa(m, rot) {
  const lista = []
  m.props.forEach((p) => {
    const tp = N.PROPS[p.tipo]
    const z = N.alturaEmPe(N.cel(m, p.x, p.y))
    lista.push(N.quadroDoObjeto(m, rot, { x: p.x + 0.5, y: p.y + 0.5, z }, tp.w, tp.h, tp.r))
  })
  m.unidades.forEach((u) => {
    const tp = N.TIPOS[u.tipo]
    const z = N.alturaEmPe(N.cel(m, u.x, u.y))
    lista.push(N.quadroDoObjeto(m, rot, { x: u.x + 0.5, y: u.y + 0.5, z }, tp.w, tp.h + 6, Math.min(0.42, Math.max(0.25, tp.w / 2 / N.ML / 2))))
  })
  lista.forEach((o, k) => {
    o.id = m.c.length + k
    o.occ = N.ocludentes(m, rot, o)
    o.clip = N.silhuetasNaFrente(m, rot, o, o.occ)
  })
  return N.ordenarObjetos(lista)
}
function provaOrdem() {
  const M = METAS.b_ordem_de_pintura
  const r = { amostras: 0, divergentes: 0, amostrasDeObjeto: 0, divergentesDeObjeto: 0, porCaso: [] }
  for (const nome of M.mapas) {
    const m = N[nome]()
    for (const rot of M.rotacoes) {
      const P = N.preparo(m, rot)
      const W = Math.ceil(P.met.largura)
      const H = Math.ceil(P.met.altura)
      // 1) camada estática: colunas na ordem de pintura, cada caixa por cima da anterior
      const estatica = new Int32Array(W * H).fill(-1)
      for (const i of P.ordem) for (const h of P.hex[i]) preencherConvexo(estatica, W, H, h, i)
      // 2) objetos em ordem de profundidade; depois de cada um, a camada estática volta dentro das colunas da frente
      const id = estatica.slice()
      const objs = objetosDoMapa(m, rot)
      for (const o of objs) {
        const [x0, y0, x1] = o.ret
        for (let y = Math.max(0, Math.ceil(y0 - 0.5)); y <= Math.min(H - 1, Math.floor(o.sy - 0.5)); y++) {
          for (let x = Math.max(0, Math.ceil(x0 - 0.5)); x <= Math.min(W - 1, Math.floor(x1 - 0.5)); x++) id[y * W + x] = o.id
        }
        if (!o.clip.length) continue
        const [rx0, ry0, rx1, ry1] = [o.ret[0] - 1, o.ret[1] - 1, o.ret[2] + 1, o.ret[3] + 1]
        for (let y = Math.max(0, Math.floor(ry0)); y <= Math.min(H - 1, Math.ceil(ry1)); y++) {
          for (let x = Math.max(0, Math.floor(rx0)); x <= Math.min(W - 1, Math.ceil(rx1)); x++) {
            const cx = x + 0.5
            const cy = y + 0.5
            if (cx < rx0 || cx > rx1 || cy < ry0 || cy > ry1) continue
            if (o.clip.some((h) => N.dentroDoConvexo(h, cx, cy))) id[y * W + x] = estatica[y * W + x]
          }
        }
      }
      // 3) referência: para cada pixel (1 em cada 2 nos dois eixos), o sólido mais perto da câmera
      let amostras = 0
      let diverg = 0
      let amObj = 0
      let divObj = 0
      const exemplos = []
      for (let y = 0; y < H; y += 2) {
        for (let x = 0; x < W; x += 2) {
          const lx = x + 0.5
          const ly = y + 0.5
          let zMelhor = -Infinity
          let melhores = []
          const considerar = (z, quem) => {
            if (z > zMelhor + 1e-9) { zMelhor = z; melhores = [quem] } else if (z > zMelhor - 1e-9) melhores.push(quem)
          }
          for (let i = 0; i < m.c.length; i++) {
            const o4 = i * 4
            if (lx < P.bb[o4] || lx > P.bb[o4 + 2] || ly < P.bb[o4 + 1] || ly > P.bb[o4 + 3]) continue
            for (const b of P.caixas[i]) {
              const z = N.entradaNaCaixa(P.met, b, lx, ly)
              if (z !== null) considerar(z, i)
            }
          }
          for (const o of objs) {
            if (lx < o.ret[0] || lx > o.ret[2] || ly < o.ret[1] || ly > o.sy) continue
            // o objeto é um painel em pé, de frente para a câmera, passando pelo centro da pegada
            considerar(((o.pu + o.pv) * N.MA - (ly - P.met.oy)) / N.LH, o.id)
          }
          const visto = id[y * W + x]
          if (!melhores.length && visto === -1) continue
          amostras++
          const ehObj = visto >= m.c.length || melhores.some((q) => q >= m.c.length)
          if (ehObj) amObj++
          if (!melhores.includes(visto)) {
            diverg++
            if (ehObj) divObj++
            if (exemplos.length < 3) exemplos.push({ x, y, visto, esperado: melhores })
          }
        }
      }
      r.amostras += amostras
      r.divergentes += diverg
      r.amostrasDeObjeto += amObj
      r.divergentesDeObjeto += divObj
      r.porCaso.push({ mapa: nome, rot, amostras, divergentes: diverg, fracao: diverg / amostras, exemplos })
    }
  }
  r.fracao = r.divergentes / r.amostras
  r.fracaoMaxPorCaso = Math.max(...r.porCaso.map((c) => c.fracao))
  r.fracaoNosObjetos = r.amostrasDeObjeto ? r.divergentesDeObjeto / r.amostrasDeObjeto : 0
  r.passou = r.fracaoMaxPorCaso <= M.meta_divergencia_max
  return r
}

// ======================================================================================
// (c) Alcance: busca do protótipo contra uma relaxação escrita aqui, a partir das regras em texto
// ======================================================================================
function mapaAleatorio(sorte, semente) {
  const W = 6 + Math.floor(sorte() * 9)
  const H = 6 + Math.floor(sorte() * 9)
  const c = []
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const h = Math.min(4, Math.floor(N.ruido(x * 0.45, y * 0.45, semente) * 5.2))
      c.push({ h, chao: h, topo: 'calcada', lado: 'muro', escada: -1, predio: -1, agua: false })
    }
  }
  const propEm = new Int32Array(W * H).fill(-1)
  c.forEach((cel, i) => {
    const s = sorte()
    if (s < 0.06) Object.assign(cel, { h: 0, chao: 0, agua: true })
    else if (s < 0.14) propEm[i] = 0
    else if (s < 0.27 && cel.h >= 1) Object.assign(cel, { escada: Math.floor(sorte() * 4), chao: cel.h - 1 })
  })
  return { id: 'acaso' + semente, W, H, c, propEm, props: [], unidades: [], _cache: {} }
}
/** Regras reescritas do texto: "a escada desce na direção dir até h - 1: a borda baixa fica do lado dir, a alta do lado oposto, os lados ficam no meio". */
function bordaRef(c, d) {
  if (c.escada === -1) return c.h
  const oposta = (c.escada + 2) % 4
  if (d === c.escada) return c.h - 1
  if (d === oposta) return c.h
  return c.h - 0.5
}
function alcanceRef(m, x0, y0, mov, degrau, ocup) {
  const livre = (x, y) => x >= 0 && y >= 0 && x < m.W && y < m.H && !m.c[y * m.W + x].agua && m.propEm[y * m.W + x] === -1
  const DIR = { '1,0': 0, '0,1': 1, '-1,0': 2, '0,-1': 3 }
  const reto = (x, y, nx, ny) => {
    if (!livre(nx, ny)) return false
    const d = DIR[`${nx - x},${ny - y}`]
    return Math.abs(bordaRef(m.c[y * m.W + x], d) - bordaRef(m.c[ny * m.W + nx], (d + 2) % 4)) <= degrau
  }
  const pode = (x, y, dx, dy) => {
    if (!dx || !dy) return reto(x, y, x + dx, y + dy)
    // diagonal sem cortar quina: os dois caminhos retos pelos cantos têm de valer
    return reto(x, y, x + dx, y) && reto(x + dx, y, x + dx, y + dy) && reto(x, y, x, y + dy) && reto(x, y + dy, x + dx, y + dy)
  }
  const dist = new Array(m.W * m.H).fill(Infinity)
  dist[y0 * m.W + x0] = 0
  let mudou = true
  while (mudou) {
    mudou = false
    for (let i = 0; i < dist.length; i++) {
      if (!(dist[i] < mov)) continue
      const x = i % m.W
      const y = (i / m.W) | 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= m.W || ny >= m.H) continue
          const j = ny * m.W + nx
          if (ocup.has(j) || !pode(x, y, dx, dy)) continue
          if (dist[i] + 1 < dist[j]) { dist[j] = dist[i] + 1; mudou = true }
        }
      }
    }
  }
  return { dist: dist.map((d) => (d === Infinity ? -1 : d)), pode }
}
function provaAlcance() {
  const M = METAS.c_alcance
  const r = { mapas: 0, iguais: 0, blocosConferidos: 0, caminhosConferidos: 0, caminhosValidos: 0, falhas: [] }
  for (let k = 1; k <= M.mapas_aleatorios; k++) {
    const sorte = N.rng(1000 + k)
    const m = mapaAleatorio(sorte, k)
    const livres = []
    m.c.forEach((c, i) => { if (!c.agua && m.propEm[i] === -1) livres.push(i) })
    if (!livres.length) continue
    const o = livres[Math.floor(sorte() * livres.length)]
    const ocup = new Set()
    for (const i of livres) if (i !== o && sorte() < 0.1) ocup.add(i)
    const degrau = 1 + Math.floor(sorte() * 3)
    const mov = sorte() < 0.2 ? Infinity : 2 + Math.floor(sorte() * 6)
    const x0 = o % m.W
    const y0 = (o / m.W) | 0
    const meu = N.alcance(m, x0, y0, { mov, degrau, ocupadas: ocup })
    const ref = alcanceRef(m, x0, y0, mov, degrau, ocup)
    r.mapas++
    let igual = true
    for (let i = 0; i < ref.dist.length; i++) {
      r.blocosConferidos++
      if (meu.dist[i] !== ref.dist[i]) {
        igual = false
        if (r.falhas.length < 8) r.falhas.push({ mapa: k, bloco: i, protótipo: meu.dist[i], referencia: ref.dist[i], degrau, mov })
      }
      if (meu.dist[i] > 0) {
        // o caminho desenhado: tamanho igual à distância, cada passo vale pelas regras e não pisa em ocupado
        const cam = N.caminhoAte(m, meu, i)
        r.caminhosConferidos++
        let ok = cam.length - 1 === meu.dist[i]
        for (let s = 1; s < cam.length && ok; s++) {
          const [ax, ay] = cam[s - 1]
          const [bx, by] = cam[s]
          ok = Math.max(Math.abs(bx - ax), Math.abs(by - ay)) === 1 && ref.pode(ax, ay, bx - ax, by - ay) && !ocup.has(by * m.W + bx)
        }
        if (ok) r.caminhosValidos++
      }
    }
    if (igual) r.iguais++
  }
  r.percentual = pct(r.iguais, r.mapas)
  r.passou = r.iguais === r.mapas && r.caminhosValidos === r.caminhosConferidos
  return r
}

// ======================================================================================
// (e) Medição com respostas conhecidas  +  propriedades do movimento
// ======================================================================================
function mapaPlano(W, H, h = 1) {
  const c = []
  for (let i = 0; i < W * H; i++) c.push({ h, chao: h, topo: 'calcada', lado: 'muro', escada: -1, predio: -1, agua: false })
  return { id: 'plano', W, H, c, propEm: new Int32Array(W * H).fill(-1), props: [], unidades: [], _cache: {} }
}
function provaMedicao() {
  const casos = []
  const caso = (nome, esperado, obtido) => casos.push({ nome, esperado, obtido, ok: JSON.stringify(esperado) === JSON.stringify(obtido) })
  let m = mapaPlano(12, 12)
  caso('Régua em linha reta: 0,0 até 3,0', 3, N.regua(m, [0, 0], [3, 0]).blocos)
  caso('Régua na diagonal conta 1 por passo: 0,0 até 3,2', 3, N.regua(m, [0, 0], [3, 2]).blocos)
  m.c[2 * 12 + 5].h = 3
  const rg = N.regua(m, [0, 0], [5, 2])
  caso('Régua até um bloco 2 níveis acima: 5 blocos, sobe 2', [5, 2], [rg.blocos, rg.desnivel])
  m = mapaPlano(12, 12)
  caso('Círculo de raio 1', 9, N.circulo(m, [6, 6], 1).length)
  caso('Círculo de raio 2', 21, N.circulo(m, [6, 6], 2).length)
  caso('Círculo de raio 3', 37, N.circulo(m, [6, 6], 3).length)
  caso('Círculo de raio 2 no canto corta o que sai do mapa (o quarto de 21, sem a quina 2,2)', 8, N.circulo(m, [0, 0], 2).length)
  caso('Cone reto de 3 blocos (leste)', 7, N.cone(m, [2, 6], 0, 3).length)
  caso('Cone diagonal de 3 blocos (sudeste)', 6, N.cone(m, [2, 2], 4, 3).length)
  caso('Cone de 1 bloco', 1, N.cone(m, [2, 6], 0, 1).length)
  caso('Visão no plano: nada barra', true, N.visao(m, [1, 1], [8, 8]).livre)
  // parede de prédio de 4 níveis no meio do caminho
  m = mapaPlano(12, 12)
  Object.assign(m.c[5 * 12 + 4], { h: 4, predio: 0, lado: 'parede' })
  let v = N.visao(m, [1, 5], [8, 5])
  caso('Visão barrada por parede em 4,5 (altura 4)', [false, 'parede', 4, 5, 4], [v.livre, v.bloqueio && v.bloqueio.tipo, v.bloqueio && v.bloqueio.x, v.bloqueio && v.bloqueio.y, v.bloqueio && v.bloqueio.h])
  // muro baixo: a linha passa por cima (olho a 2,5, peito do alvo a 2)
  m = mapaPlano(12, 12)
  Object.assign(m.c[5 * 12 + 4], { h: 2, predio: 0, lado: 'parede' })
  caso('Visão por cima de um muro de 1 nível', true, N.visao(m, [1, 5], [8, 5]).livre)
  // desnível: quem está embaixo (altura 0) não vê o alvo no alto do platô, 5 blocos para dentro da borda
  m = mapaPlano(12, 12, 0)
  for (let y = 0; y < 12; y++) for (let x = 4; x < 12; x++) Object.assign(m.c[y * 12 + x], { h: 3, chao: 3, lado: 'rocha' })
  v = N.visao(m, [1, 5], [9, 5])
  caso('Visão barrada pela borda do platô (desnível), em 4,5', [false, 'desnível', 4, 5], [v.livre, v.bloqueio && v.bloqueio.tipo, v.bloqueio && v.bloqueio.x, v.bloqueio && v.bloqueio.y])
  v = N.visao(m, [9, 5], [6, 5])
  caso('Visão no alto do platô: livre', true, v.livre)
  const ok = casos.filter((c) => c.ok).length
  return { casos, certos: ok, total: casos.length, percentual: pct(ok, casos.length), passou: ok === casos.length }
}
function tira(alturas) {
  const W = alturas.length
  return { id: 'tira', W, H: 1, c: alturas.map((h) => ({ h, chao: h, topo: 'calcada', lado: 'muro', escada: -1, predio: -1, agua: false })), propEm: new Int32Array(W).fill(-1), props: [], unidades: [], _cache: {} }
}
function propriedadesDoSalto(plano, s) {
  let zMax = -Infinity
  let tApice = 0
  let xMonotono = true
  let xAnt = -Infinity
  for (let t = s.t0; t <= s.t0 + s.dur; t += 0.5) {
    const e = N.estadoNoTempo(plano, Math.min(t, plano.total - 1e-6))
    if (e.z > zMax) { zMax = e.z; tApice = t - s.t0 }
    if (e.x < xAnt - 1e-12) xMonotono = false
    xAnt = e.x
  }
  const fim = N.estadoNoTempo(plano, plano.total)
  return { dur: s.dur, zMax, tApice, acimaDosDois: zMax > Math.max(s.az, s.bz) + 1e-6, pousoErro: Math.abs(fim.z - s.bz), xMonotono }
}
function provaMovimento() {
  const M = METAS.movimento
  const t5 = tira([1, 1, 1, 2, 2])
  const p = N.planoDeMovimento(t5, [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]])
  const plano2 = mapaPlano(2, 2)
  const diag = N.planoDeMovimento(plano2, [[0, 0], [1, 1]])
  const sobe1 = propriedadesDoSalto(p, p.segs[2])
  const t2 = tira([4, 1])
  const pd = N.planoDeMovimento(t2, [[0, 0], [1, 0]])
  const desce3 = propriedadesDoSalto(pd, pd.segs[0])
  const red = N.planoDeMovimento(t5, [[2, 0], [3, 0]], { reduzido: true })
  const casos = [
    { nome: 'Andar 1 bloco reto', esperado: M.andar_ms_por_bloco, obtido: p.segs[0].dur },
    { nome: 'Andar 1 bloco na diagonal', esperado: M.andar_diagonal_ms, obtido: diag.segs[0].dur },
    { nome: 'Degrau de 1 nível vira salto', esperado: 'salto', obtido: p.segs[2].tipo },
    { nome: 'Salto (sobe 1): ápice acima dos dois blocos', esperado: true, obtido: sobe1.acimaDosDois },
    { nome: 'Salto (sobe 1): pousa na altura exata (erro < 0,001)', esperado: true, obtido: sobe1.pousoErro < 0.001 },
    { nome: 'Salto (sobe 1): avanço nunca volta', esperado: true, obtido: sobe1.xMonotono },
    { nome: 'Salto (sobe 1): 300 a 650 ms', esperado: true, obtido: sobe1.dur >= 300 && sobe1.dur <= 650 },
    { nome: 'Salto (desce 3): ápice acima dos dois blocos', esperado: true, obtido: desce3.acimaDosDois },
    { nome: 'Salto (desce 3): pousa na altura exata', esperado: true, obtido: desce3.pousoErro < 0.001 },
    { nome: 'Salto (desce 3): 300 a 650 ms', esperado: true, obtido: desce3.dur >= 300 && desce3.dur <= 650 },
    { nome: 'Movimento reduzido: sem agachar nem amortecer', esperado: [0, 0], obtido: [red.segs[0].agacha, red.segs[0].pousa] },
  ]
  casos.forEach((c) => { c.ok = JSON.stringify(c.esperado) === JSON.stringify(c.obtido) })
  const ok = casos.filter((c) => c.ok).length
  return { casos, salto: { sobe1, desce3 }, certos: ok, total: casos.length, passou: ok === casos.length }
}

// ======================================================================================
// Gráfico do salto (SVG): altura dos pés e avanço no tempo, com as três fases
// ======================================================================================
function graficoDoSalto() {
  const t5 = tira([1, 1, 1, 2, 2])
  const plano = N.planoDeMovimento(t5, [[2, 0], [3, 0]])
  const s = plano.segs[0]
  const pts = []
  for (let t = 0; t <= s.dur; t += 2) {
    const e = N.estadoNoTempo(plano, Math.min(t, plano.total - 1e-6))
    pts.push({ t, z: e.z, x: e.x - s.ax, ey: e.ey })
  }
  const W = 760
  const H = 470
  const esq = 64
  const dir = 24
  const largura = W - esq - dir
  const paineis = [
    { titulo: 'Altura dos pés (níveis)', y0: 70, alto: 190, min: 0.8, max: 2.8, passo: 0.5, valor: (p) => p.z },
    { titulo: 'Avanço até o bloco seguinte (blocos)', y0: 320, alto: 100, min: 0, max: 1, passo: 0.5, valor: (p) => p.x },
  ]
  const tx = (t) => esq + (t / s.dur) * largura
  const fmt = (n) => String(Math.round(n * 100) / 100).replace('.', ',')
  const tinta = '#1e231f'
  const suave = '#5b635c'
  const grade = '#dfe3dc'
  const serie = '#3f74c4'
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Barlow, system-ui, sans-serif">`
  svg += `<rect width="${W}" height="${H}" fill="#f7f8f4"/>`
  svg += `<text x="${esq}" y="28" font-size="18" font-weight="600" fill="${tinta}">Um salto de 1 nível, quadro a quadro (${s.dur} ms)</text>`
  svg += `<text x="${esq}" y="48" font-size="13" fill="${suave}">Da tira das provas: bloco na altura 1 para bloco na altura 2. Curva amostrada a cada 2 ms pela mesma função que a página usa.</text>`
  const fases = [['agacha', 0, s.agacha], ['no ar', s.agacha, s.agacha + s.ar], ['pousa', s.agacha + s.ar, s.dur]]
  for (const pn of paineis) {
    const ty = (v) => pn.y0 + pn.alto - ((v - pn.min) / (pn.max - pn.min)) * pn.alto
    fases.forEach(([nome, a, b], k) => {
      if (k !== 1) svg += `<rect x="${tx(a)}" y="${pn.y0}" width="${tx(b) - tx(a)}" height="${pn.alto}" fill="#eceee8"/>`
      if (pn === paineis[0]) svg += `<text x="${(tx(a) + tx(b)) / 2}" y="${pn.y0 + 16}" font-size="12" text-anchor="middle" fill="${suave}">${nome} · ${b - a} ms</text>`
    })
    for (let v = pn.min; v <= pn.max + 1e-9; v += pn.passo) {
      svg += `<line x1="${esq}" x2="${W - dir}" y1="${ty(v)}" y2="${ty(v)}" stroke="${grade}" stroke-width="1"/>`
      svg += `<text x="${esq - 8}" y="${ty(v) + 4}" font-size="12" text-anchor="end" fill="${suave}">${fmt(v)}</text>`
    }
    svg += `<text x="${esq}" y="${pn.y0 - 8}" font-size="13" font-weight="600" fill="${tinta}">${pn.titulo}</text>`
    const d = pts.map((p, k) => `${k ? 'L' : 'M'}${tx(p.t).toFixed(1)},${ty(pn.valor(p)).toFixed(1)}`).join('')
    svg += `<path d="${d}" fill="none" stroke="${serie}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`
    if (pn === paineis[0]) {
      // referências: altura de saída, de chegada e o ápice
      for (const [v, rot] of [[s.az, 'sai de 1'], [s.bz, 'chega a 2']]) {
        svg += `<line x1="${esq}" x2="${W - dir}" y1="${ty(v)}" y2="${ty(v)}" stroke="${suave}" stroke-width="1" stroke-dasharray="4 4"/>`
        svg += `<text x="${W - dir - 4}" y="${ty(v) - 5}" font-size="12" text-anchor="end" fill="${suave}">${rot}</text>`
      }
      const ap = pts.reduce((a, b) => (b.z > a.z ? b : a))
      svg += `<circle cx="${tx(ap.t)}" cy="${ty(ap.z)}" r="4.5" fill="${serie}" stroke="#f7f8f4" stroke-width="2"/>`
      svg += `<text x="${tx(ap.t) + 9}" y="${ty(ap.z) - 8}" font-size="12" fill="${tinta}">ápice ${fmt(ap.z)} aos ${ap.t} ms</text>`
    }
  }
  for (let t = 0; t <= s.dur; t += 50) {
    svg += `<text x="${tx(t)}" y="${paineis[1].y0 + paineis[1].alto + 18}" font-size="12" text-anchor="middle" fill="${suave}">${t}</text>`
  }
  svg += `<text x="${esq + largura / 2}" y="${H - 8}" font-size="12" text-anchor="middle" fill="${suave}">tempo desde o início do salto (ms)</text>`
  svg += '</svg>'
  fs.writeFileSync(path.join(PROVAS, 'grafico-do-salto.svg'), svg)
  return { arquivo: 'grafico-do-salto.svg', duracao: s.dur, fases: fases.map(([n, a, b]) => ({ fase: n, ms: b - a })) }
}

// ======================================================================================
// (i) Origem: nada de imagem no protótipo, nada dos prints de referência no repo
// ======================================================================================
function listar(d) {
  const out = []
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) out.push(...listar(p))
    else out.push(p)
  }
  return out
}
const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')
function provaOrigem() {
  const IMG = /\.(png|jpe?g|gif|webp|bmp|svg|ico|avif)$/i
  const arquivosProto = listar(PROTO)
  const imagens = arquivosProto.filter((p) => IMG.test(p)).map((p) => path.relative(PASTA, p))
  const html = fs.readFileSync(path.join(PROTO, 'index.html'), 'utf8')
  const dataImage = (html.match(/data:image/g) || []).length
  const tagImg = (html.match(/<img/gi) || []).length
  const novaImagem = (html.match(/new Image\(/g) || []).length
  const r = { imagensNoPrototipo: imagens, dataImage, tagImg, novaImagem }
  if (PASTA_REFERENCIAS && fs.existsSync(PASTA_REFERENCIAS)) {
    const refs = fs.readdirSync(PASTA_REFERENCIAS).filter((n) => IMG.test(n)).map((n) => sha(path.join(PASTA_REFERENCIAS, n)))
    const meus = listar(PASTA).map((p) => ({ p, h: sha(p) }))
    r.referenciasConferidas = refs.length
    r.copiasDeReferencia = meus.filter((m) => refs.includes(m.h)).map((m) => path.relative(PASTA, m.p))
  } else {
    r.referenciasConferidas = 0
    r.copiasDeReferencia = 'não conferido (pasta de referências não informada)'
  }
  r.passou = !imagens.length && !dataImage && !tagImg && !novaImagem && Array.isArray(r.copiasDeReferencia) && !r.copiasDeReferencia.length
  return r
}

// ======================================================================================
// Navegador: robô, desempenho, página, cor e prints
// ======================================================================================
function opcoesDoNavegador(chromium) {
  if (fs.existsSync(chromium.executablePath())) return {}
  const base = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright')
  if (!fs.existsSync(base)) return {}
  for (const p of fs.readdirSync(base).filter((n) => n.startsWith('chromium_headless_shell-')).sort().reverse()) {
    const e = path.join(base, p, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe')
    if (fs.existsSync(e)) return { executablePath: e }
  }
  return {}
}
function erroNoDisco(sorte, raio) {
  const a = sorte() * Math.PI * 2
  const r = raio * Math.sqrt(sorte())
  return [Math.cos(a) * r, Math.sin(a) * r]
}
const percentil = (xs, p) => {
  const s = xs.slice().sort((a, b) => a - b)
  return s.length ? s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] : null
}

async function navegador(res) {
  const { chromium } = require(path.join(RAIZ, 'node_modules', 'playwright'))
  require(path.join(PROTO, 'montar.cjs')).montar()
  const corpo = fs.readFileSync(path.join(PROTO, 'index.html'), 'utf8')
  const arq = path.join(os.tmpdir(), 'batalha-isometrica-provas.html')
  fs.writeFileSync(arq, `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>body{margin:0}</style></head><body>${corpo}</body></html>`)
  const url = pathToFileURL(arq).href
  const nav = await chromium.launch(opcoesDoNavegador(chromium))
  const erros = []
  async function abrir(o = {}) {
    const ctx = await nav.newContext({ viewport: { width: o.w || 1440, height: o.h || 1000 }, deviceScaleFactor: o.dpr || 1, hasTouch: !!o.toque, isMobile: !!o.toque })
    await ctx.addInitScript(() => {
      window.__longas = []
      try {
        new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__longas.push({ t: e.startTime, d: e.duration }) }).observe({ type: 'longtask', buffered: true })
      } catch (e) { /* sem observador de tarefas longas neste navegador */ }
    })
    const pg = await ctx.newPage()
    pg.on('pageerror', (e) => erros.push(String(e)))
    pg.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()) })
    await pg.goto(url)
    await pg.waitForFunction(() => window.Batalha && window.Batalha.pronto(), null, { timeout: 30000 })
    return { ctx, pg }
  }
  const quieto = (pg, ms = 60000) => pg.waitForFunction(() => window.Batalha.filaVazia(), null, { timeout: ms })
  // recorte < 1: só o miolo do canvas (as medidas ficam no centro), para o texto continuar legível na montagem
  const tela = (pg, recorte = 1) => pg.evaluate((k) => {
    const c = document.getElementById('mapa')
    if (k >= 1) return c.toDataURL('image/png')
    const w = Math.round(c.width * k)
    const h = Math.round(c.height * k)
    const t = document.createElement('canvas')
    t.width = w
    t.height = h
    t.getContext('2d').drawImage(c, (c.width - w) / 2, (c.height - h) / 2, w, h, 0, 0, w, h)
    return t.toDataURL('image/png')
  }, recorte)
  async function compor(pg, imagens, colunas, legendas, arquivo, larguraDaCelula) {
    const b64 = await pg.evaluate(async ({ imagens, colunas, legendas, lc }) => {
      const imgs = await Promise.all(imagens.map((src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src })))
      const ac = Math.round((lc * imgs[0].height) / imgs[0].width)
      const linhas = Math.ceil(imgs.length / colunas)
      const gap = 14
      const rot = 30
      const c = document.createElement('canvas')
      c.width = colunas * lc + (colunas + 1) * gap
      c.height = linhas * (ac + rot) + (linhas + 1) * gap
      const g = c.getContext('2d')
      g.fillStyle = '#eceee8'
      g.fillRect(0, 0, c.width, c.height)
      imgs.forEach((im, k) => {
        const x = gap + (k % colunas) * (lc + gap)
        const y = gap + Math.floor(k / colunas) * (ac + rot + gap)
        g.drawImage(im, x, y + rot, lc, ac)
        g.fillStyle = '#1e231f'
        g.font = '600 17px Barlow, system-ui, sans-serif'
        g.fillText(legendas[k], x + 2, y + 21)
      })
      return c.toDataURL('image/jpeg', 0.86).split(',')[1]
    }, { imagens, colunas, legendas, lc: larguraDaCelula })
    fs.writeFileSync(path.join(PRINTS, arquivo), Buffer.from(b64, 'base64'))
  }
  const foto = async (pg, arquivo, alvo = '.moldura') => pg.locator(alvo).screenshot({ path: path.join(PRINTS, arquivo), type: 'jpeg', quality: 86 })
  const clicarBloco = async (pg, x, y) => {
    const [cx, cy] = await pg.evaluate(([x, y]) => Batalha.projetar(x, y), [x, y])
    await pg.mouse.move(cx, cy, { steps: 4 })
    await pg.mouse.click(cx, cy)
    await pg.waitForTimeout(120)
  }
  const esperarParada = (pg) => pg.waitForFunction(() => !window.Batalha.animando(), null, { timeout: 20000 })

  fs.mkdirSync(PRINTS, { recursive: true })
  if (modo !== 'desempenho') for (const f of fs.readdirSync(PRINTS)) fs.unlinkSync(path.join(PRINTS, f))
  const vila = N.vila()

  // ---------- (f) desempenho e primeira pintura: 3 rodadas, cada uma numa página nova; vale a pior ----------
  const rodadas = []
  for (let rodada = 0; rodada < 3; rodada++) {
    const { ctx, pg } = await abrir()
    const primeira = await pg.evaluate(() => Batalha.est.primeiraPintura)
    await quieto(pg)
    await pg.evaluate(() => Batalha.carregarMapaDeTeste(30))
    await quieto(pg)
    await pg.evaluate(() => { window.__longas = []; Batalha.zerarQuadros(); Batalha.passeio(true) })
    const animando = []
    for (let k = 0; k < 8; k++) {
      await pg.waitForTimeout(1500)
      animando.push(await pg.evaluate(() => Batalha.est.anims.size))
      await pg.evaluate(() => Batalha.girar(1))
    }
    const d = await pg.evaluate(() => ({ quadros: Batalha.est.quadros.slice(2), custos: Batalha.est.custos.slice(2), longas: window.__longas.slice(), unidades: Batalha.est.mapa.unidades.length, W: Batalha.est.mapa.W }))
    const M = METAS.f_desempenho
    const f = {
      mapa: `${d.W} x ${d.W}`, unidades: d.unidades, unidadesAnimandoMin: Math.min(...animando), giros: 8,
      quadros: d.quadros.length, p50_ms: percentil(d.quadros, 50), p95_ms: percentil(d.quadros, 95), max_ms: Math.max(...d.quadros),
      custoDoScript_p95_ms: percentil(d.custos, 95), custoDoScript_max_ms: Math.max(...d.custos),
      tarefasLongas: d.longas.length, tarefaLongaMax_ms: d.longas.length ? Math.max(...d.longas.map((l) => l.d)) : 0,
      primeiraPintura_ms: Math.round(primeira),
    }
    f.passou = f.p95_ms <= M.p95_quadro_ms_max && f.tarefaLongaMax_ms < M.tarefa_longa_ms_proibida && f.primeiraPintura_ms <= M.primeira_pintura_ms_max && f.unidadesAnimandoMin >= 12
    rodadas.push(f)
    log('desempenho', rodada + 1, JSON.stringify(f))
    await ctx.close()
  }
  res.f_desempenho = {
    rodadas,
    p95_pior_ms: Math.max(...rodadas.map((r) => r.p95_ms)),
    primeiraPintura_pior_ms: Math.max(...rodadas.map((r) => r.primeiraPintura_ms)),
    tarefasLongas: rodadas.reduce((a, r) => a + r.tarefasLongas, 0),
    passou: rodadas.every((r) => r.passou),
  }
  if (modo === 'desempenho') { await nav.close(); return }

  // ---------- (d) robô com atraso de gente ----------
  {
    const M = METAS.d_robo
    const r = { sementes: [], comandos: 0, chegaram: 0, contagemCerta: 0, previaCerta: 0, porArraste: 0, cliquesNaUnidade: 0, errosAoSelecionar: 0, alvosEscondidosEvitados: 0 }
    for (const semente of M.sementes) {
      const { ctx, pg } = await abrir()
      const sorte = N.rng(semente)
      await pg.click('#b-batalha')
      const rot = (semente - 1) % 4
      for (let k = 0; k < rot; k++) await pg.evaluate(() => Batalha.girar(1))
      await quieto(pg)
      const ids = await pg.evaluate(() => Batalha.est.mapa.unidades.map((u) => u.id))
      const reg = { semente, rot, comandos: [] }
      for (let c = 0; c < M.comandos_por_semente; c++) {
        let feito = false
        for (let tentativaDeUnidade = 0; tentativaDeUnidade < 8 && !feito; tentativaDeUnidade++) {
          const id = ids[Math.floor(sorte() * ids.length)]
          const u = await pg.evaluate((id) => Batalha.unidade(id), id)
          await pg.evaluate(([x, y]) => Batalha.centrarEm(x, y), [u.x, u.y])
          await pg.waitForTimeout(M.atraso_de_reacao_ms)
          const arrastar = c % 3 === 2
          // 1) mirar no corpo da unidade, com erro de até meio bloco
          let sel = await pg.evaluate(() => Batalha.est.sel && Batalha.est.sel.id)
          let pontoDaUnidade = null
          for (let t = 0; t < 6 && (sel !== id || arrastar); t++) {
            if (sel && sel !== id) { await pg.keyboard.press('Escape'); await pg.waitForTimeout(80) }
            const [ex, ey] = erroNoDisco(sorte, M.erro_de_clique_max_blocos)
            const p = await pg.evaluate(([x, y, z]) => Batalha.projetarMundo(x, y, z), [u.x + 0.5 + ex, u.y + 0.5 + ey, u.z + 1])
            const alvo = await pg.evaluate(([x, y]) => Batalha.alvoNaTela(x, y), p)
            if (arrastar) {
              if (alvo.unidade === id) { pontoDaUnidade = p; break }
              r.errosAoSelecionar++
              continue
            }
            r.cliquesNaUnidade++
            await pg.mouse.move(p[0], p[1], { steps: 5 })
            await pg.mouse.click(p[0], p[1])
            await pg.waitForTimeout(120)
            sel = await pg.evaluate(() => Batalha.est.sel && Batalha.est.sel.id)
            if (sel !== id) r.errosAoSelecionar++
          }
          if (arrastar && !pontoDaUnidade) continue
          if (!arrastar && sel !== id) continue
          if (arrastar && sel !== id) {
            // o arraste seleciona sozinho; para ler o alcance antes, a unidade é escolhida como a pessoa veria
            await pg.evaluate((id) => Batalha.selecionarPorId(id), id)
          }
          const dist = await pg.evaluate(() => Array.from(Batalha.est.alcance ? Batalha.est.alcance.dist : []))
          const opcoes = []
          dist.forEach((d, i) => { if (d > 0) opcoes.push(i) })
          if (!opcoes.length) continue
          // 2) escolher um destino que dá para ver e mirar nele, com erro de até 0,45 bloco (fica dentro do bloco)
          let destino = -1
          let ponto = null
          for (let t = 0; t < 30 && destino < 0; t++) {
            const j = opcoes[Math.floor(sorte() * opcoes.length)]
            const [ex, ey] = erroNoDisco(sorte, 0.45)
            const jx = j % vila.W
            const jy = (j / vila.W) | 0
            const p = await pg.evaluate(([x, y, ex, ey]) => {
              const m = Batalha.est.mapa
              return Batalha.projetarMundo(x + 0.5 + ex, y + 0.5 + ey, Batalha.N.alturaNoPonto(m, x + 0.5 + ex, y + 0.5 + ey) + 0.01)
            }, [jx, jy, ex, ey])
            const alvo = await pg.evaluate(([x, y]) => Batalha.alvoNaTela(x, y), p)
            const dentroDaTela = await pg.evaluate(([x, y]) => {
              const r = document.getElementById('mapa').getBoundingClientRect()
              return x > r.left + 4 && x < r.right - 4 && y > r.top + 4 && y < r.bottom - 4
            }, p)
            if (alvo.unidade || alvo.i !== j || !dentroDaTela) { r.alvosEscondidosEvitados++; continue }
            destino = j
            ponto = p
          }
          if (destino < 0) continue
          const esperado = dist[destino]
          if (arrastar) {
            await pg.mouse.move(pontoDaUnidade[0], pontoDaUnidade[1], { steps: 4 })
            await pg.mouse.down()
            await pg.mouse.move(ponto[0], ponto[1], { steps: 10 })
            await pg.waitForTimeout(M.atraso_de_reacao_ms)
          } else {
            await pg.mouse.move(ponto[0], ponto[1], { steps: 8 })
            await pg.waitForTimeout(M.atraso_de_reacao_ms)
          }
          const previa = await pg.evaluate(() => (Batalha.est.previa ? Batalha.est.previa.length - 1 : null))
          if (arrastar) { await pg.mouse.up(); r.porArraste++ } else await pg.mouse.click(ponto[0], ponto[1])
          await pg.waitForTimeout(60)
          await esperarParada(pg)
          await pg.waitForTimeout(60)
          const fim = await pg.evaluate((id) => {
            const u = Batalha.est.mapa.unidades.find((o) => o.id === id)
            const ult = Batalha.est.rotulos[Batalha.est.rotulos.length - 1]
            return { x: u.x, y: u.y, passos: u.rastro.length - 1, chegada: Batalha.est.ultimaChegada, rotulo: ult && ult.u.id === id ? ult.texto : null, estado: document.getElementById('estado').textContent }
          }, id)
          const chegou = fim.y * vila.W + fim.x === destino && fim.chegada && fim.chegada.id === id
          const texto = `andou ${esperado} ${esperado === 1 ? 'bloco' : 'blocos'}`
          const contagem = chegou && fim.chegada.n === esperado && fim.passos === esperado && fim.rotulo === texto && fim.estado.includes(texto)
          r.comandos++
          if (chegou) r.chegaram++
          if (contagem) r.contagemCerta++
          if (previa === esperado) r.previaCerta++
          reg.comandos.push({ unidade: id, destino: [destino % vila.W, (destino / vila.W) | 0], blocos: esperado, arraste: arrastar, chegou, contagem, previa })
          feito = true
        }
      }
      r.sementes.push(reg)
      await ctx.close()
    }
    r.fracaoChegaram = r.comandos ? r.chegaram / r.comandos : 0
    r.fracaoContagem = r.comandos ? r.contagemCerta / r.comandos : 0
    r.passou = r.comandos === M.sementes.length * M.comandos_por_semente && r.fracaoChegaram >= M.meta_chegam && r.fracaoContagem >= M.meta_contagem_igual_ao_caminho
    res.d_robo = r
    log('robô', r.comandos, 'comandos;', r.chegaram, 'chegaram;', r.contagemCerta, 'contagem certa;', r.porArraste, 'por arraste')
  }

  // ---------- prints, cor (h) e folha de contato ----------
  {
    const { ctx, pg } = await abrir()
    await quieto(pg)
    await foto(pg, '1-vila-de-dia.jpg')
    // cor: paleta, contorno e pixels nos três períodos
    const cor = { periodos: {} }
    const base = await pg.evaluate(() => {
      const P = Batalha.Pt
      const cores = Object.values(P.PALETA)
      return { cores: cores.length, contornoMin: Math.min(...cores.map((c) => P.luminancia(P.hexRgb(P.contorno(c))))) }
    })
    Object.assign(cor, base)
    const medirPixels = () => pg.evaluate(() => {
      const c = document.getElementById('mapa')
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
      const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
      let min = 1
      let pretos = 0
      for (let k = 0; k < d.length; k += 4) {
        if (!d[k] && !d[k + 1] && !d[k + 2]) pretos++
        const l = 0.2126 * lin(d[k]) + 0.7152 * lin(d[k + 1]) + 0.0722 * lin(d[k + 2])
        if (l < min) min = l
      }
      return { luminanciaMin: Math.round(min * 10000) / 10000, pretosPuros: pretos }
    })
    const periodos = []
    for (const p of ['dia', 'tarde', 'noite']) {
      await pg.click(`#g-hora [data-valor=${p}]`)
      await quieto(pg)
      await pg.waitForTimeout(300)
      cor.periodos[p] = await medirPixels()
    }
    // 7: a mesma cena nos três períodos
    await pg.evaluate(() => { Batalha.zoomEm(1.45); Batalha.centrarEm(14, 12) })
    for (const p of ['dia', 'tarde', 'noite']) {
      await pg.click(`#g-hora [data-valor=${p}]`)
      await quieto(pg)
      await pg.waitForTimeout(350)
      periodos.push(await tela(pg))
    }
    await compor(pg, periodos, 3, ['Dia', 'Tarde', 'Noite'], '7-tres-periodos.jpg', 620)
    await pg.click('#g-hora [data-valor=dia]')
    // 6: os quatro giros, mapa inteiro
    await pg.evaluate(() => Batalha.enquadrar())
    const giros = []
    for (let k = 0; k < 4; k++) {
      await quieto(pg)
      await pg.waitForTimeout(300)
      giros.push(await tela(pg))
      await pg.evaluate(() => Batalha.girar(1))
    }
    await compor(pg, giros, 2, ['Vista norte', 'Vista leste (E)', 'Vista sul (E E)', 'Vista oeste (Q)'], '6-quatro-giros.jpg', 700)
    // 3: alcance azul e o caminho até um destino
    await pg.evaluate(() => { Batalha.zoomEm(1.6) })
    await pg.click('#b-batalha')
    const av = vila.unidades.find((u) => u.id === 'aventureira')
    await pg.evaluate(([x, y]) => { Batalha.centrarEm(x + 1, y - 1); Batalha.selecionarPorId('aventureira') }, [av.x, av.y])
    const alvo3 = await pg.evaluate(() => {
      const d = Batalha.est.alcance.dist
      const m = Batalha.est.mapa
      let melhor = -1
      // um destino a 4 blocos que aparece na tela (não escondido atrás de prédio) e sem unidade em cima
      d.forEach((v, i) => {
        if (v !== 4) return
        const a = Batalha.alvoNaTela(...Batalha.projetar(i % m.W, (i / m.W) | 0))
        if (!a.unidade && a.i === i && (melhor < 0 || (i % m.W) > (melhor % m.W))) melhor = i
      })
      return melhor
    })
    if (alvo3 >= 0) {
      const [cx, cy] = await pg.evaluate(([x, y]) => Batalha.projetar(x, y), [alvo3 % vila.W, (alvo3 / vila.W) | 0])
      await pg.mouse.move(cx, cy, { steps: 6 })
    }
    await pg.waitForTimeout(500)
    await foto(pg, '3-alcance-azul.jpg')
    await pg.evaluate(() => Batalha.selecionarPorId(null))
    await pg.mouse.move(5, 5)
    // 4: as cinco ferramentas, na vila de dia
    const ferr = []
    const legendas = []
    const guarda = vila.unidades.find((u) => u.id === 'guarda')
    const usar = async (valor) => { await pg.click(`#g-ferramenta [data-valor=${valor}]`); await pg.waitForTimeout(80) }
    const centrar = (a, b, z = 1.25) => pg.evaluate(([x, y, z]) => { Batalha.zoomEm(z); Batalha.centrarEm(x, y) }, [Math.round((a[0] + b[0]) / 2), Math.round((a[1] + b[1]) / 2), z])
    const A = [av.x, av.y]
    const B = [guarda.x, guarda.y]
    await usar('regua'); await centrar(A, B); await clicarBloco(pg, ...A); await clicarBloco(pg, ...B)
    await pg.mouse.move(5, 5); ferr.push(await tela(pg, 0.62)); legendas.push('Régua: blocos e desnível')
    await usar('circulo'); await centrar(A, A); await clicarBloco(pg, ...A); await clicarBloco(pg, A[0] + 2, A[1])
    await pg.mouse.move(5, 5); ferr.push(await tela(pg, 0.62)); legendas.push('Círculo: raio e blocos atingidos')
    const dirCone = [Math.sign(B[0] - A[0]) || 1, Math.sign(B[1] - A[1])]
    const fimCone = [A[0] + dirCone[0] * 4, A[1] + dirCone[1] * 4]
    await usar('cone'); await centrar(A, fimCone); await clicarBloco(pg, ...A); await clicarBloco(pg, ...fimCone)
    await pg.mouse.move(5, 5); ferr.push(await tela(pg, 0.62)); legendas.push('Cone: direção e comprimento')
    // visão: o alvo mais perto, a 4 a 8 blocos, escondido atrás de uma parede de prédio
    let alvoVisao = null
    for (let raio = 4; raio <= 8 && !alvoVisao; raio++) {
      for (let y = A[1] - raio; y <= A[1] + raio && !alvoVisao; y++) {
        for (let x = A[0] - raio; x <= A[0] + raio && !alvoVisao; x++) {
          if (!N.dentro(vila, x, y) || Math.max(Math.abs(x - A[0]), Math.abs(y - A[1])) !== raio) continue
          const c = N.cel(vila, x, y)
          if (c.agua || c.predio >= 0) continue
          const v = N.visao(vila, A, [x, y])
          if (!v.livre && v.bloqueio.tipo === 'parede') alvoVisao = [x, y]
        }
      }
    }
    if (alvoVisao) {
      await usar('visao'); await centrar(A, alvoVisao); await clicarBloco(pg, ...A); await clicarBloco(pg, ...alvoVisao)
      await pg.mouse.move(5, 5); ferr.push(await tela(pg, 0.62)); legendas.push('Visão: o que barra e em que altura')
    }
    // caminho andado: o arqueiro anda duas vezes e o rastro aparece numerado
    await usar('mover')
    await pg.evaluate(() => Batalha.selecionarPorId(null))
    const arq2 = vila.unidades.find((u) => u.id === 'arqueiro')
    await pg.evaluate(([x, y]) => { Batalha.zoomEm(1.25); Batalha.centrarEm(x + 1, y - 1) }, [arq2.x, arq2.y])
    for (const passos of [4]) {
      await pg.evaluate(() => Batalha.selecionarPorId('arqueiro'))
      const j = await pg.evaluate((n) => {
        const d = Batalha.est.alcance.dist
        const m = Batalha.est.mapa
        let melhor = -1
        d.forEach((v, i) => { if (v === n && Batalha.blocoNaTela(...Batalha.projetar(i % m.W, (i / m.W) | 0)) === i && (melhor < 0 || i % m.W > melhor % m.W)) melhor = i })
        return melhor
      }, passos)
      if (j >= 0) { await clicarBloco(pg, j % vila.W, (j / vila.W) | 0); await esperarParada(pg) }
    }
    await pg.click('#b-rastro')
    await pg.evaluate(() => {
      Batalha.selecionarPorId(null)
      // a câmera vai para o meio do percurso, para ele caber no recorte
      const u = Batalha.est.mapa.unidades.find((o) => o.id === 'arqueiro')
      const meio = u.rastro[Math.floor(u.rastro.length / 2)] || [u.x, u.y]
      Batalha.centrarEm(meio[0], meio[1])
    })
    await pg.mouse.move(5, 5)
    await pg.waitForTimeout(2300)
    ferr.push(await tela(pg, 0.62)); legendas.push('Caminho andado: o último percurso, numerado')
    await compor(pg, ferr, 3, legendas, '4-cinco-ferramentas.jpg', 560)
    // folha de contato: andar e saltar, 16 quadros cada
    const folhaId = await pg.evaluate(() => Batalha.folhaDeContato('aventureira'))
    const folha = await pg.evaluate((id) => document.getElementById(id).toDataURL('image/jpeg', 0.9).split(',')[1], folhaId)
    fs.writeFileSync(path.join(PROVAS, 'folha-de-contato.jpg'), Buffer.from(folha, 'base64'))
    await pg.evaluate((id) => document.getElementById(id).remove(), folhaId)
    // 2: baía de noite
    await pg.click('#b-rastro')
    await pg.click('#g-mapa [data-valor=baia]')
    await pg.click('#g-hora [data-valor=noite]')
    await quieto(pg)
    await pg.waitForTimeout(600)
    cor.periodos.baiaNoite = await medirPixels()
    await foto(pg, '2-baia-de-noite.jpg')
    const H = METAS.h_cor
    const pisoOk = (p, piso) => cor.periodos[p].luminanciaMin >= piso && cor.periodos[p].pretosPuros === 0
    cor.passou = cor.cores <= H.cores_base_max && cor.contornoMin >= H.piso_luminancia_do_contorno &&
      pisoOk('dia', H.piso_luminancia_pixel_dia_e_tarde) && pisoOk('tarde', H.piso_luminancia_pixel_dia_e_tarde) &&
      pisoOk('noite', H.piso_luminancia_pixel_noite) && pisoOk('baiaNoite', H.piso_luminancia_pixel_noite)
    res.h_cor = cor
    log('cor', JSON.stringify(cor))
    await ctx.close()
  }

  // ---------- (g) celular 390: sem rolagem lateral, toque seleciona e o toque no destino faz andar ----------
  {
    const { ctx, pg } = await abrir({ w: 390, h: 844, dpr: 2, toque: true })
    await quieto(pg)
    const largura = await pg.evaluate(() => ({ rolagem: document.scrollingElement.scrollWidth, janela: window.innerWidth }))
    await pg.click('#b-batalha')
    const av = vila.unidades.find((u) => u.id === 'aventureira')
    await pg.evaluate(([x, y]) => Batalha.centrarEm(x + 1, y - 1), [av.x, av.y])
    await pg.evaluate(() => document.getElementById('mapa').scrollIntoView({ block: 'center' }))
    await pg.waitForTimeout(200)
    const pu = await pg.evaluate(([x, y, z]) => Batalha.projetarMundo(x + 0.5, y + 0.5, z + 1), [av.x, av.y, N.alturaEmPe(N.cel(vila, av.x, av.y))])
    await pg.touchscreen.tap(pu[0], pu[1])
    await pg.waitForTimeout(200)
    const selecionou = await pg.evaluate(() => Batalha.est.sel && Batalha.est.sel.id)
    let andou = null
    const j = await pg.evaluate(() => {
      if (!Batalha.est.alcance) return -1
      const d = Batalha.est.alcance.dist
      const m = Batalha.est.mapa
      let melhor = -1
      d.forEach((v, i) => {
        if (v !== 3) return
        const p = Batalha.projetar(i % m.W, (i / m.W) | 0)
        const r = document.getElementById('mapa').getBoundingClientRect()
        const a = Batalha.alvoNaTela(p[0], p[1])
        if (!a.unidade && a.i === i && p[0] > r.left + 10 && p[0] < r.right - 10 && p[1] > r.top + 10 && p[1] < r.bottom - 10) melhor = i
      })
      return melhor
    })
    if (j >= 0) {
      const p = await pg.evaluate(([x, y]) => Batalha.projetar(x, y), [j % vila.W, (j / vila.W) | 0])
      await pg.touchscreen.tap(p[0], p[1])
      await pg.waitForTimeout(100)
      await esperarParada(pg)
      andou = await pg.evaluate(() => Batalha.est.ultimaChegada)
      await pg.evaluate(() => Batalha.selecionarPorId('aventureira'))
    }
    await pg.evaluate(() => window.scrollTo(0, 0))
    await pg.waitForTimeout(400)
    const alto = await pg.evaluate(() => Math.min(document.scrollingElement.scrollHeight, 1500))
    await pg.screenshot({ path: path.join(PRINTS, '5-celular-390.jpg'), type: 'jpeg', quality: 72, clip: { x: 0, y: 0, width: 390, height: alto }, fullPage: true })
    res.g_pagina = {
      larguraDaJanela: largura.janela, larguraDaRolagem: largura.rolagem, rolagemLateral: largura.rolagem > largura.janela,
      toqueSelecionou: selecionou === 'aventureira', toqueFezAndar: !!(andou && andou.id === 'aventureira' && andou.n === 3),
    }
    await ctx.close()
  }
  await nav.close()
  res.g_pagina.errosNoConsole = erros
  res.g_pagina.passou = !erros.length && !res.g_pagina.rolagemLateral && res.g_pagina.toqueSelecionou && res.g_pagina.toqueFezAndar
}

// ======================================================================================
async function principal() {
  let res = {}
  if (modo !== 'tudo' && fs.existsSync(SAIDA)) res = JSON.parse(fs.readFileSync(SAIDA, 'utf8')).resultados || {}
  const t0 = Date.now()
  if (modo === 'node' || modo === 'tudo') {
    res.a_clique = provaClique(); log('clique', res.a_clique.percentual, '%', res.a_clique.casos, 'blocos;', res.a_clique.aoAcaso, 'pontos ao acaso')
    res.b_ordem = provaOrdem(); log('ordem', (res.b_ordem.fracao * 100).toFixed(4), '% divergente; pior caso', (res.b_ordem.fracaoMaxPorCaso * 100).toFixed(4), '%')
    res.c_alcance = provaAlcance(); log('alcance', res.c_alcance.iguais, '/', res.c_alcance.mapas)
    res.e_medicao = provaMedicao(); log('medição', res.e_medicao.certos, '/', res.e_medicao.total)
    res.movimento = provaMovimento(); log('movimento', res.movimento.certos, '/', res.movimento.total)
    res.grafico = graficoDoSalto()
  }
  if (modo !== 'node') await navegador(res)
  res.i_origem = provaOrigem()
  const resumo = Object.fromEntries(Object.entries(res).filter(([, v]) => v && typeof v.passou === 'boolean').map(([k, v]) => [k, v.passou]))
  fs.writeFileSync(SAIDA, JSON.stringify({ gerado_em: new Date().toISOString(), modo, segundos: Math.round((Date.now() - t0) / 1000), resumo, resultados: res }, null, 1))
  log('resumo', JSON.stringify(resumo))
}
principal().catch((e) => { console.error(e); process.exit(1) })
