/**
 * As versões da CERCA (L07 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`; tema Vila e
 * fazenda). A 1ª, TÁBUAS, é o desenho de hoje (`montarCerca`); aqui ficam as outras três:
 *
 * - ESTACAS: a paliçada. Entre os mourões de sempre, estacas roliças encostadas umas nas outras, cada uma com a
 *   ponta lavrada a machado (as facetas pegam a luz cada uma de um jeito) e um nada mais alta que o mourão; por
 *   trás delas corre a travessa que as segura, do lugar `ligacao` (a vara, a corda ou o arame).
 * - VIME: a cerca trançada. Entre os mourões, varinhas de pé a cada tanto e as varas de vime passando uma por
 *   dentro e outra por fora de cada uma (as duas fiadas de cima em ondas opostas, a trança), sobre o painel
 *   trançado de baixo. Com corda ou arame no lugar `ligacao`, o painel vai amarrado em cada mourão.
 * - TÁBUAS COM NEVE: a cerca de hoje, inteira, com a neve assentada no topo de cada mourão e em montinhos ao longo
 *   das varas, da corda ou do arame (no arame, a neve faz ponte entre os dois fios).
 *
 * As três saem da MESMA geometria da cerca (`geometriaDaCerca`): os mourões no mesmo lugar, um a cada ~1 casa pela
 * reta ou pelo ARCO da cerca curva, e o que fica entre eles anda pelo mesmo caminho (reto de mourão a mourão, ou pelo
 * arco). Esticada, a cerca ganha mais estacas e mais varinhas, nunca estacas esticadas; curva, as estacas e a trança
 * seguem a volta. A pegada e os lugares de material são os da cerca: `madeira` (mourões, estacas e varinhas) e
 * `ligacao` (a travessa da paliçada, as amarras do vime e a ligação da cerca com neve). O vime e a neve são fixos.
 *
 * Na 3/4 (perfil derivado, o da cerca): cada estaca, cada varinha, cada mourão e o painel de vime são COLUNAS (a
 * sombra presa ao chão com altura); a travessa da paliçada é um tampo solto, como as varas de hoje. A neve sobe com
 * o mourão ou com a vara em que está (o meio da caixa de cada montinho cai em cima dela).
 */
import { geometriaDaCerca, type GeometriaDaCerca } from '../../../../lib/mobilia'
import { hash } from '../../../ruido'
import { comMeioEm } from '../andaimeDaTresQuartos'
import { montarCerca } from '../cerca'
import { cadeia, capsula, elipse, type Forma, type Ponto } from '../formas'
import { contato, ruido, type Cena, type MaterialDaPeca, type Textura } from '../motor'
import type { ContextoDoMovel, MontarMovel } from '../contexto'
import type { VersoesDesenhadas } from '.'

const VOLTA = Math.PI * 2

// ---------- o caminho da cerca ----------

/** Um ponto do caminho: onde fica, a normal (na curva, para fora do arco) e o rumo do caminho ali (radianos). */
interface PontoDoCaminho {
  readonly x: number
  readonly y: number
  readonly nx: number
  readonly ny: number
  readonly rumo: number
}

/**
 * O caminho que liga os mourões, de t = 0 (o primeiro) a t = 1 (o último): a reta de ponta a ponta ou o arco da cerca
 * curva. Nos dois, o comprimento anda por igual com t, e o mourão `i` de `n` fica em t = i / (n - 1), como em
 * `geometriaDaCerca` (e nas ligações de `cerca.ts`).
 */
interface Caminho {
  readonly comprimento: number
  /** Reto de ponta a ponta: um trecho dele é uma cápsula só, sem pontos no meio. */
  readonly reto: boolean
  em(t: number): PontoDoCaminho
}

function caminhoDa(geo: GeometriaDaCerca): Caminho {
  const p0 = geo.mouroes[0]
  const p1 = geo.mouroes[geo.mouroes.length - 1]
  const arco = geo.arco
  if (arco === null) {
    const dx = p1.x - p0.x
    const dy = p1.y - p0.y
    const l = Math.hypot(dx, dy) || 1
    const rumo = Math.atan2(dy, dx)
    return { comprimento: l, reto: true, em: (t) => ({ x: p0.x + dx * t, y: p0.y + dy * t, nx: -dy / l, ny: dx / l, rumo }) }
  }
  const { center, radius, startAngle, sweep } = arco
  const sentido = Math.sign(sweep) || 1
  return {
    comprimento: radius * Math.abs(sweep),
    reto: false,
    em: (t) => {
      const a = startAngle + sweep * t
      const co = Math.cos(a)
      const si = Math.sin(a)
      return { x: center.x + co * radius, y: center.y + si * radius, nx: co, ny: si, rumo: a + (sentido * Math.PI) / 2 }
    },
  }
}

/** O t de cada mourão. */
function tDosMouroes(geo: GeometriaDaCerca): number[] {
  const n = geo.mouroes.length
  return geo.mouroes.map((_m, i) => (n > 1 ? i / (n - 1) : 0))
}

/**
 * Menor passo (px) entre dois pontos de um trecho do arco: a corda de 4 px num arco de raio 60 se afasta 0,03 px da
 * curva, e cada ponto a mais custa uma conta por pixel (e a varredura da 3/4 repete a conta pela altura da coluna).
 */
const PASSO_NO_ARCO = 4

/** Os pontos do caminho de `t0` a `t1`, afastados `lado` px pela normal: as duas pontas no reto, um a cada ~`passo` px no arco. */
function trecho(cam: Caminho, t0: number, t1: number, lado: number, passo: number): Ponto[] {
  const n = cam.reto ? 1 : Math.max(1, Math.ceil((Math.abs(t1 - t0) * cam.comprimento) / Math.max(passo, PASSO_NO_ARCO)))
  const pontos: Ponto[] = []
  for (let k = 0; k <= n; k += 1) {
    const p = cam.em(t0 + ((t1 - t0) * k) / n)
    pontos.push([p.x + p.nx * lado, p.y + p.ny * lado])
  }
  return pontos
}

/** Uma cápsula pelos pontos (dois pontos = a cápsula reta). */
function fita(pontos: readonly Ponto[], raio: number): Forma {
  if (pontos.length === 2) return capsula(pontos[0][0], pontos[0][1], pontos[1][0], pontos[1][1], raio)
  return cadeia(pontos, raio)
}

/** A forma com a borda irregular (a neve, o vime de baixo): a distância ganha um ruído suave. A caixa cresce junto. */
function irregular(f: Forma, amplitude: number, escala: number, semente: number): Forma {
  return {
    b: [f.b[0] - amplitude, f.b[1] - amplitude, f.b[2] + amplitude, f.b[3] + amplitude],
    d: (x, y) => f.d(x, y) - ruido(x * escala + semente, y * escala + semente * 0.37) * 2 * amplitude,
  }
}

// ---------- o mourão (o mesmo de hoje) ----------

/** Altura do mourão em casas (a da cerca de hoje) e a força do contato. */
const ALTURA_DO_MOURAO = 0.72

/** Topo de madeira cortada: anéis em volta do centro do mourão (a conta de `cerca.ts`). */
function texTopo(cx: number, cy: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const raio = Math.hypot(x - cx, y - cy) + ruido(x * 0.2 + p.semente, y * 0.2) * 1.4
    s[3] += Math.sin(raio * 4.2) * 0.035 + ruido(x * 0.6, y * 0.6) * 0.05 + 0.06
  }
}

/** Os mourões da cerca, como os de hoje: a sombra da coluna, a casca por baixo e o topo cortado com os anéis. */
function mouroes(c: ContextoDoMovel, cena: Cena, geo: GeometriaDaCerca, sombras: boolean): void {
  const rp = geo.raio
  const H = c.g * ALTURA_DO_MOURAO
  geo.mouroes.forEach(({ x, y }, i) => {
    if (sombras) cena.sombras.push({ forma: elipse(x, y, rp, rp), z: H }, contato(elipse(x, y, rp, rp)))
    cena.partes.push(c.peca(elipse(x, y, rp, rp), c.m.madeira, { polar: { cx: x, cy: y, r: rp }, tabua: 2.4, bisel: 1, tom: 0.66, semente: 80 + i }))
    cena.partes.push(c.peca(elipse(x, y, rp * 0.81, rp * 0.81), c.m.madeira, { textura: texTopo(x, y), bisel: 0.9, semente: 90 + i }))
  })
}

// ---------- estacas (a paliçada) ----------

/** A estaca: o raio em fração do raio do mourão, o passo entre duas (em raios dela) e a altura em casas. */
const ESTACA = { raio: 0.6, passo: 1.86, altura: 0.8, variaAltura: 0.08 } as const
/** Facetas da ponta lavrada e quanto a luz muda de uma para a outra. */
const FACETAS = 5
const LUZ_DA_FACETA = 0.2
/** A luz do motor no chão (cima à esquerda), em vetor unitário: a faceta virada para lá clareia. */
const LUZ_X = -0.79
const LUZ_Y = -0.61
/** A travessa atrás das estacas: a altura (fração da do mourão) e o raio de cada ligação (px do protótipo). */
const ALTURA_DA_TRAVESSA = 0.56
const RAIO_DA_TRAVESSA = { varas: 1.7, corda: 1.35, arame: 0.85 } as const

/** A ponta lavrada vista de cima: cada faceta, do pé ao bico, pega a luz pelo rumo dela; o bico fica no meio. */
function texDaPonta(cx: number, cy: number, r: number, fase: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const dx = x - cx
    const dy = y - cy
    const longe = Math.min(1, Math.hypot(dx, dy) / (r * 0.45))
    let a = Math.atan2(dy, dx) - fase
    a -= Math.floor(a / VOLTA) * VOLTA
    const meio = fase + (Math.floor(a / (VOLTA / FACETAS)) + 0.5) * (VOLTA / FACETAS)
    const virada = Math.cos(meio) * LUZ_X + Math.sin(meio) * LUZ_Y
    s[3] += virada * LUZ_DA_FACETA * longe + ruido(x * 0.7 + p.semente, y * 0.7) * 0.06 + 0.04
  }
}

/** A ligação que o lugar `ligacao` escolhe: a classe do material diz qual (vara de madeira, corda ou arame). */
function tipoDaLigacao(m: MaterialDaPeca): 'varas' | 'corda' | 'arame' {
  return m.classe === 'metal' ? 'arame' : m.classe === 'corda' ? 'corda' : 'varas'
}

const montarCercaDeEstacas: MontarMovel = (c, cena) => {
  const geo = geometriaDaCerca(c.w, c.h, c.curva)
  if (geo === null) return
  const P = c.peca
  const mad = c.m.madeira
  const lig = c.m.ligacao
  const tipo = tipoDaLigacao(lig)
  const cam = caminhoDa(geo)
  const rp = geo.raio
  const rs = rp * ESTACA.raio
  const H = c.g * ALTURA_DO_MOURAO
  const ts = tDosMouroes(geo)

  // As estacas de cada vão, repartidas por igual entre os dois mourões, com um nada de torto (feitas à mão).
  const estacas: { x: number; y: number; r: number; z: number; i: number }[] = []
  for (let v = 0; v < ts.length - 1; v += 1) {
    const ini = ts[v] + (rp * 0.96) / cam.comprimento
    const fim = ts[v + 1] - (rp * 0.96) / cam.comprimento
    const vao = (fim - ini) * cam.comprimento
    if (vao <= rs) continue
    const n = Math.max(1, Math.round(vao / (rs * ESTACA.passo)))
    for (let k = 0; k < n; k += 1) {
      const i = v * 64 + k
      const p = cam.em(ini + ((fim - ini) * (k + 0.5)) / n)
      const torto = (hash(i, 3, 701) - 0.5) * 0.8
      estacas.push({
        x: p.x + p.nx * torto,
        y: p.y + p.ny * torto,
        r: rs * (0.9 + 0.16 * hash(i, 4, 701)),
        z: c.g * (ESTACA.altura + (hash(i, 5, 701) - 0.5) * 2 * ESTACA.variaAltura),
        i,
      })
    }
  }

  // As sombras: cada estaca e cada mourão são colunas; a travessa é um tampo solto atrás delas, um pedaço por vão
  // (de mourão a mourão: a emenda fica debaixo do mourão; cada pedaço só conta perto dele, e a 3/4 fica leve).
  const raioDaTravessa = RAIO_DA_TRAVESSA[tipo]
  const atras = -(rs + raioDaTravessa * 0.35)
  const ladoDoMeio = atras - raioDaTravessa * 0.8
  const travessas = ts.slice(1).map((t1, v) => {
    const forma = fita(trecho(cam, ts[v], t1, atras, 1.6), raioDaTravessa)
    // O meio da caixa de cada pedaço vai para o meio do vão dele, na beira de trás da travessa: lá não há estaca nem
    // mourão, e a 3/4 o sobe com o tampo dele (com o meio caindo numa estaca, ele subia como a estaca e pintava a
    // frente dela com a corda).
    const noVao = cam.em((ts[v] + t1) / 2)
    return { forma, peca: comMeioEm(forma, noVao.x + noVao.nx * ladoDoMeio, noVao.y + noVao.ny * ladoDoMeio) }
  })
  for (const { forma } of travessas) cena.sombras.push({ forma, z: H * ALTURA_DA_TRAVESSA, forca: tipo === 'arame' ? 0.16 : 0.24, solta: true })
  for (const e of estacas) cena.sombras.push({ forma: elipse(e.x, e.y, e.r, e.r), z: e.z }, contato(elipse(e.x, e.y, e.r, e.r), 0.28))
  for (const { x, y } of geo.mouroes) cena.sombras.push({ forma: elipse(x, y, rp, rp), z: H }, contato(elipse(x, y, rp, rp)))

  // A travessa por trás (aparece na fresta entre as estacas e atrás delas), depois as estacas e os mourões.
  const veio = geo.arco === null ? { eixo: cam.em(0).rumo } : { arco: { cx: geo.arco.center.x, cy: geo.arco.center.y, r: geo.arco.radius, a0: geo.arco.startAngle + geo.arco.sweep / 2 } }
  for (const [v, { peca }] of travessas.entries()) {
    if (tipo === 'varas') cena.partes.push(P(peca, mad, { ...veio, tabua: 0, bisel: 0.9, contorno: 0.26, tom: 0.72, semente: 640 + v * 2 }))
    else cena.partes.push(P(peca, lig, { ...veio, bisel: raioDaTravessa, contorno: tipo === 'arame' ? 0.12 : 0.18, tom: 0.8, semente: 641 + v * 2 }))
  }
  for (const e of estacas) {
    // A casca em volta (o que sobra da roliça abaixo das facetas) e a ponta lavrada, mais clara (madeira nova).
    cena.partes.push(P(elipse(e.x, e.y, e.r, e.r), mad, { polar: { cx: e.x, cy: e.y, r: e.r }, tabua: 1.8, bisel: 0.8, tom: 0.62, contorno: 0.3, semente: 300 + e.i }))
    cena.partes.push(P(elipse(e.x - 0.15, e.y - 0.1, e.r * 0.8, e.r * 0.8), mad, { tabua: 0, bisel: 0.4, tom: 1.06, contorno: 0.12, textura: texDaPonta(e.x, e.y, e.r, hash(e.i, 6, 701) * VOLTA), semente: 400 + e.i }))
  }
  mouroes(c, cena, geo, false)
}

// ---------- vime (a cerca trançada) ----------

/**
 * O vime: a cor das varas de salgueiro, contida (palha queimada, sem amarelo). Classe `palha`: a frente que a 3/4
 * varre do painel sai trançada como o cesto (com `madeira` ela saía em tábuas de pé).
 */
const VIME: MaterialDaPeca = { classe: 'palha', rgb: [0xa6, 0x8c, 0x62] }
/** As varinhas de pé: uma a cada tanto (em casas), o raio (px do protótipo) e a altura (casas). */
const VARINHA = { passo: 0.22, raio: 1.55, altura: 0.68 } as const
/**
 * O painel trançado (a altura em casas e a meia largura em px) e as duas fiadas de cima: o raio, o afastamento do
 * meio (a fiada abraça a varinha: o raio dela mais quase o da fiada) e o passo dos pontos (px).
 */
const PAINEL = { altura: 0.6, meia: 3.1 } as const
const FIADA = { raio: 1.25, afasta: 2.5, passo: 1.7 } as const
/** A amarra do painel em cada mourão (com corda ou arame): quantas voltas e o raio de cada uma. */
const VOLTAS_DA_AMARRA = 2
const RAIO_DA_AMARRA = { corda: 0.75, arame: 0.5 } as const

/** O vime de baixo do painel: fios finos ao longo do caminho, que entram e saem (manchas, não listras). */
function texDoPainel(semente: number): Textura {
  return (_u, v, x, y, _p, s) => {
    s[3] += Math.sin(v * 2.6 + ruido(x * 0.18 + semente, y * 0.18) * 5) * 0.06 + ruido(x * 0.9, y * 0.9 + semente) * 0.08 - 0.04
  }
}

/** A vara de vime da fiada: lisa, com um nada de mancha ao longo (a trama do cesto só na frente do painel). */
function texDaVara(semente: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    s[3] += ruido(x * 0.35 + semente, y * 0.35) * 0.06
  }
}

/**
 * Onde o meio da caixa das peças do painel cai no vão: entre a 1ª e a 2ª varinha (no cruzamento das fiadas, longe
 * das duas), ou a um quinto do vão quando ele tem uma varinha só. Lá só há o painel, e a 3/4 sobe a peça com ele.
 */
function meioDoVao(n: number, passo: number, vao: number): number {
  return n >= 2 ? passo : vao * 0.2
}

const montarCercaDeVime: MontarMovel = (c, cena) => {
  const geo = geometriaDaCerca(c.w, c.h, c.curva)
  if (geo === null) return
  const P = c.peca
  const mad = c.m.madeira
  const lig = c.m.ligacao
  const tipo = tipoDaLigacao(lig)
  const cam = caminhoDa(geo)
  const rp = geo.raio
  const ts = tDosMouroes(geo)
  const veio = geo.arco === null ? { eixo: cam.em(0).rumo } : { arco: { cx: geo.arco.center.x, cy: geo.arco.center.y, r: geo.arco.radius, a0: geo.arco.startAngle + geo.arco.sweep / 2 } }

  // Em cada vão: o painel de baixo (a coluna que a 3/4 varre: o painel trançado é fechado), um pedaço por vão, de
  // mourão a mourão (a emenda fica debaixo do mourão, e cada pedaço só conta perto dele: a 3/4 da curva fica leve);
  // as varinhas; e as duas fiadas de cima, em ondas opostas: uma passa por dentro e a outra por fora de cada varinha
  // (abraçando-a) e as duas se cruzam entre uma varinha e a outra. O painel e as fiadas sobem com o pedaço do painel
  // na 3/4: o meio da caixa de cada um cai no vão, longe de mourão e de varinha.
  const pecasDoPainel: { forma: Forma; tom: number; semente: number; vara: boolean }[] = []
  const varinhas: { x: number; y: number; i: number }[] = []
  for (let v = 0; v < ts.length - 1; v += 1) {
    const ini = ts[v] + (rp * 0.7) / cam.comprimento
    const fim = ts[v + 1] - (rp * 0.7) / cam.comprimento
    const vao = (fim - ini) * cam.comprimento
    if (vao <= 0) continue
    const n = Math.max(1, Math.round(vao / (c.g * VARINHA.passo)))
    const passo = vao / n
    for (let k = 0; k < n; k += 1) {
      const p = cam.em(ini + ((k + 0.5) * passo) / cam.comprimento)
      varinhas.push({ x: p.x, y: p.y, i: v * 64 + k })
    }
    const meio = cam.em(ini + meioDoVao(n, passo, vao) / cam.comprimento)
    // A estrutura (a coluna e a sombra) é a faixa lisa; só a peça ganha a beira irregular (0,35 px: a varredura da
    // 3/4 conta a forma da coluna muitas vezes por pixel, e o ruído dela custava mais que a diferença que fazia).
    const faixa = fita(trecho(cam, ts[v], ts[v + 1], 0, 1.4), PAINEL.meia)
    cena.sombras.push({ forma: faixa, z: c.g * PAINEL.altura }, contato(faixa, 0.3))
    pecasDoPainel.push({ forma: comMeioEm(irregular(faixa, 0.35, 0.5, 11 + v * 3), meio.x, meio.y), tom: 0.7, semente: 500 + v, vara: false })
    for (const fase of [0, Math.PI]) {
      const pontos: Ponto[] = []
      const amostras = Math.max(4, Math.ceil(vao / FIADA.passo))
      for (let j = 0; j <= amostras; j += 1) {
        const s = (vao * j) / amostras
        const p = cam.em(ini + s / cam.comprimento)
        const lado = Math.sin((Math.PI * s) / passo + fase) * FIADA.afasta
        pontos.push([p.x + p.nx * lado, p.y + p.ny * lado])
      }
      pecasDoPainel.push({ forma: comMeioEm(cadeia(pontos, FIADA.raio), meio.x, meio.y), tom: fase === 0 ? 1.02 : 0.9, semente: 520 + v * 2 + (fase === 0 ? 0 : 1), vara: true })
    }
  }
  // Os pedaços do painel por baixo, as fiadas por cima.
  for (const p of [...pecasDoPainel.filter((q) => !q.vara), ...pecasDoPainel.filter((q) => q.vara)]) {
    const desenho = p.vara ? { tabua: 0, bisel: FIADA.raio, contorno: 0.24, textura: texDaVara(p.semente) } : { tabua: 0, bisel: 1.6, contorno: 0.24, textura: texDoPainel(5) }
    cena.partes.push(P(p.forma, VIME, { ...veio, ...desenho, tom: p.tom, semente: p.semente }))
  }
  for (const w of varinhas) {
    const r = VARINHA.raio
    cena.sombras.push({ forma: elipse(w.x, w.y, r, r), z: c.g * VARINHA.altura }, contato(elipse(w.x, w.y, r, r), 0.24))
    cena.partes.push(P(elipse(w.x, w.y, r, r), mad, { tabua: 0, bisel: 0.7, tom: 0.92, contorno: 0.3, textura: texTopo(w.x, w.y), semente: 560 + w.i }))
  }
  mouroes(c, cena, geo, true)

  // A amarra (só com corda ou arame): voltas que passam por cima do painel, coladas em cada mourão.
  if (tipo === 'varas') return
  const raio = RAIO_DA_AMARRA[tipo]
  ts.forEach((t, i) => {
    for (const lado of [-1, 1]) {
      const tm = t + (lado * (rp + 1.1)) / cam.comprimento
      if (tm <= 0 || tm >= 1) continue
      for (let k = 0; k < VOLTAS_DA_AMARRA; k += 1) {
        const tk = tm + (lado * k * (raio * 2.2)) / cam.comprimento
        const p = cam.em(tk)
        const a: Ponto = [p.x - p.nx * (PAINEL.meia + 0.6), p.y - p.ny * (PAINEL.meia + 0.6)]
        const b: Ponto = [p.x + p.nx * (PAINEL.meia + 0.6), p.y + p.ny * (PAINEL.meia + 0.6)]
        cena.partes.push(P(capsula(a[0], a[1], b[0], b[1], raio), lig, { eixo: p.rumo + Math.PI / 2, bisel: raio, contorno: 0.2, tom: 0.95, semente: 600 + i * 8 + k + (lado + 1) * 2 }))
      }
    }
  })
}

// ---------- tábuas com neve ----------

/** A neve: branco frio e fosco, abaixo do teto de 245 mesmo no bisel claro. */
const NEVE: MaterialDaPeca = { classe: 'liso', rgb: [0xd9, 0xdf, 0xe5] }
/** A neve em cima de cada ligação: o raio do montinho (px do protótipo) e o recuo dos mourões (fração do raio deles). */
const NEVE_NA_LIGACAO = { varas: 1.55, corda: 1.2, arame: 1.5 } as const
const RECUO_DA_LIGACAO = 0.55

/** A neve fofa: um claro de cima à esquerda, a beira mais fria e uns grãos de luz espalhados (sem brilho de gelo). */
function texDaNeve(semente: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    s[3] += ruido(x * 0.45 + semente, y * 0.45) * 0.07 + (hash(Math.floor(x * 1.3), Math.floor(y * 1.3), semente) > 0.93 ? 0.04 : 0)
  }
}

/** Os montinhos de um vão: dois ou três pedaços com falhas (a vara aparece entre eles), cada um com a borda fofa. */
function montinhos(cam: Caminho, t0: number, t1: number, raio: number, vao: number): Forma[] {
  const formas: Forma[] = []
  const partes = hash(vao, 1, 733) < 0.5 ? 2 : 3
  for (let k = 0; k < partes; k += 1) {
    const de = (k + 0.08 + 0.12 * hash(vao, 10 + k, 733)) / partes
    const ate = (k + 0.86 - 0.12 * hash(vao, 20 + k, 733)) / partes
    const a = t0 + (t1 - t0) * de
    const b = t0 + (t1 - t0) * ate
    // Um nada para trás do eixo (a neve se assenta por cima, e o lado da frente da vara fica de fora).
    formas.push(irregular(fita(trecho(cam, a, b, -0.35, 1.2), raio * (0.85 + 0.25 * hash(vao, 30 + k, 733))), 0.35, 0.8, 40 + vao * 7 + k))
  }
  return formas
}

const montarCercaComNeve: MontarMovel = (c, cena) => {
  montarCerca(c, cena)
  const geo = geometriaDaCerca(c.w, c.h, c.curva)
  if (geo === null) return
  const P = c.peca
  const cam = caminhoDa(geo)
  const rp = geo.raio
  const ts = tDosMouroes(geo)
  const tipo = tipoDaLigacao(c.m.ligacao)
  // A neve das ligações primeiro (os mourões ficam por cima, como a madeira deles).
  for (let v = 0; v < ts.length - 1; v += 1) {
    const recuo = (rp * RECUO_DA_LIGACAO) / cam.comprimento
    for (const [k, forma] of montinhos(cam, ts[v] + recuo, ts[v + 1] - recuo, NEVE_NA_LIGACAO[tipo], v).entries()) {
      cena.partes.push(P(forma, NEVE, { bisel: 0.9, contorno: 0.14, tom: 0.98, textura: texDaNeve(70 + v), semente: 700 + v * 4 + k }))
    }
  }
  // O chapéu de neve de cada mourão: quase o topo inteiro, um nada para o lado de onde vem o vento (cima à esquerda).
  geo.mouroes.forEach(({ x, y }, i) => {
    const r = rp * (0.84 + 0.08 * hash(i, 2, 734))
    const chapeu = irregular(elipse(x - 0.3, y - 0.35, r, r * 0.96), 0.4, 0.9, 13 + i * 5)
    cena.partes.push(P(chapeu, NEVE, { bisel: r * 0.55, contorno: 0.16, textura: texDaNeve(90 + i), semente: 760 + i }))
  })
}

export const versoesDoCerca: VersoesDesenhadas = {
  estacas: montarCercaDeEstacas,
  vime: montarCercaDeVime,
  comNeve: montarCercaComNeve,
}
