/**
 * PÍER (lote 12 dos objetos novos, 11/11/2026; grupo Porto e navio, a campanha é
 * de piratas). Um TRECHO do cais de madeira sobre a água, visto de cima: as
 * tábuas de través (ao lado menor), gastas e desiguais, com as frestas escuras
 * em que se vê a água lá embaixo e as longarinas por baixo; os pregos em fila
 * em cima de cada longarina, com a ferrugem escorrida; uma tábua nova, mais
 * clara, e uma quebrada, com o rombo aberto para a água. Nas duas bordas
 * compridas as ESTACAS grossas a intervalos, com o topo redondo (os anéis do
 * cerne e as rachas) e uma volta de corda em algumas; um CUNHO de ferro com a
 * amarra em oito, que desce pela borda para a água.
 *
 * Objeto de chão: o token anda em cima e o que o mestre põe em cima aparece por
 * cima. O trecho se reparte pelo tamanho: a tábua e o vão das estacas são
 * medidas fixas (o trecho maior ganha mais tábuas e mais estacas, nunca tábua
 * esticada), e as duas pontas cortam no meio de uma fresta e no meio do vão das
 * estacas, para emendar noutro trecho sem degrau (a água por baixo, as
 * longarinas e a sombra na água vão de ponta a ponta, sem borda). Não é a ponte
 * (`ponte.ts`): sem guarda-corpo nem postes quadrados, as estacas redondas de
 * fora e a tábua sempre de través ao lado menor.
 *
 * Na 3/4 só as estacas sobem (colunas de 0,46 a 0,6 casa, cada uma com o topo
 * dela); o tabuado fica no chão, rente.
 */
import { hash, type Rgb } from '../../ruido'
import { cadeia, caixa, capsula, dentroDe, elipse, menos, poligono, type Caixa, type Forma, type Ponto } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type Cena, type MaterialDaPeca, type Textura } from './motor'
import { G, PREGO, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

// ---------- as medidas (px do protótipo) ----------

/** O passo de partida de uma tábua com a fresta: o trecho reparte o comprimento no número inteiro mais perto. */
const TABUA = 0.2 * G
const FRESTA = 1.3
/** O quanto o tabuado fica para dentro da pegada nas bordas compridas. */
const MARGEM = 1.5
/** As pontas das tábuas: cada uma recua até isto da borda e entorta até isto de um canto ao outro. */
const PONTA_DESIGUAL = 2.6
const TORTO = 0.9
/** A água por baixo fica para dentro da ponta mais curta: as pontas das tábuas sobram por cima da água do mapa. */
const AGUA_PARA_DENTRO = PONTA_DESIGUAL + 0.8
/** As três longarinas por baixo, em frações da meia largura, e a largura de cada uma. */
const LONGARINAS: readonly number[] = [-0.7, 0, 0.7]
const LARGURA_DA_LONGARINA = 4.4
/** Os pregos: o raio da cabeça, o quanto ficam para dentro da beira da tábua e o comprimento da ferrugem escorrida. */
const RAIO_DO_PREGO = 0.78
const PREGO_PARA_DENTRO = 2.1
const FERRUGEM = 2.8
/** O tom das tábuas gastas (de partida e quanto varia), o da tábua nova e o das longarinas, na sombra do tabuado. */
const TOM_GASTO = 0.86
const TOM_QUE_VARIA = 0.16
const TOM_DA_NOVA = 1.2
const TOM_DA_LONGARINA = 0.6
/** O caminho gasto pelos pés no meio do tabuado: o quanto clareia. */
const GASTO_NO_MEIO = 0.07
/** O rombo da tábua quebrada: a largura (fração da meia largura) e o comprimento das lascas. */
const LARGURA_DO_ROMBO = 0.42
const LASCA = 3.4
const LASCAS = 6
/** As estacas: o vão de partida, o raio, a altura acima do tabuado (de partida e quanto varia). */
const VAO_DAS_ESTACAS = G
const RAIO_DA_ESTACA = 0.14 * G
const ALTURA_DA_ESTACA = 0.46 * G
const ALTURA_QUE_VARIA = 0.14 * G
/** A altura do tabuado sobre a água: a sombra que ele faz na água, do lado de baixo da luz. */
const ALTURA_DO_TABULADO = 0.4 * G
/** O cabo: o raio da volta na estaca e o da amarra. */
const RAIO_DO_CABO = 1.2
const PONTOS_DA_VOLTA = 28
/** O cunho: meio comprimento dos chifres, meia largura e o raio deles; meia base. */
const CUNHO = { meio: 8.6, raio: 1.5, base: 3.4, meiaBase: 2.4 }
/** A sombra da estaca no tabuado: um rastro arrastado pela luz, transparente. */
const ALFA_DO_RASTRO = 0.34

// ---------- as cores fixas ----------

/** A água vista pelas frestas, lá embaixo e na sombra do tabuado: verde-azulada escura, acima do piso de luz. */
const AGUA_DE_BAIXO: MaterialDaPeca = { classe: 'liso', rgb: [0x2c, 0x46, 0x4a] }
const SOMBRA_NO_TABULADO: MaterialDaPeca = { classe: 'liso', rgb: [0x2b, 0x25, 0x20] }
/** O cânhamo das amarras (o do vergueiro do canhão) e a cor da torção. */
const TOM_DO_CABO: Rgb = [0xc4, 0xac, 0x7e]
const TORCAO_DO_CABO: Rgb = [0x8e, 0x76, 0x50]
const CABO: MaterialDaPeca = { classe: 'liso', rgb: TOM_DO_CABO }
const FERRO_DO_CUNHO: MaterialDaPeca = { classe: 'metal', rgb: [0x55, 0x58, 0x5a] }
/** A ferrugem que escorre do prego e a cabeça dele. */
const COR_DA_FERRUGEM: Rgb = [0x7a, 0x4e, 0x30]

const VEIO = texturaDaClasse('madeira')
const VOLTA_INTEIRA = Math.PI * 2

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

function misturarEm(s: Float32Array, cor: Rgb, t: number): void {
  s[0] += (cor[0] - s[0]) * t
  s[1] += (cor[1] - s[1]) * t
  s[2] += (cor[2] - s[2]) * t
}

// ---------- o referencial do cais ----------

/** O trecho no referencial dele: `u` ao comprido (o lado maior da pegada), `v` de través. */
interface Regua {
  readonly hu: number
  readonly hv: number
  /** Do referencial do cais para a pegada, e de volta. */
  readonly ponto: (u: number, v: number) => Ponto
  readonly uv: (x: number, y: number) => Ponto
  readonly caixa: (u0: number, v0: number, u1: number, v1: number, raio?: number) => Forma
  readonly poligono: (pontos: readonly Ponto[]) => Forma
  /** O veio de través (ao longo de `v`, a tábua) e o de ao comprido (a longarina). */
  readonly eixoDeTraves: number
  readonly eixoAoComprido: number
}

function novaRegua(c: ContextoDoMovel): Regua {
  const deitado = c.w > c.h
  const ponto = (u: number, v: number): Ponto => (deitado ? [u, v] : [v, u])
  return {
    hu: deitado ? c.hw : c.hh,
    hv: deitado ? c.hh : c.hw,
    ponto,
    uv: ponto,
    caixa: (u0, v0, u1, v1, raio = 0) => (deitado ? caixa(u0, v0, u1, v1, raio) : caixa(v0, u0, v1, u1, raio)),
    poligono: (pontos) => poligono(pontos.map(([u, v]) => ponto(u, v))),
    eixoDeTraves: deitado ? QUARTO : 0,
    eixoAoComprido: deitado ? 0 : QUARTO,
  }
}

/** Os quartos de volta do giro do objeto (0 a 3). */
function quartosDoGiro(giro: number): number {
  return ((Math.round(giro / 90) % 4) + 4) % 4
}

/**
 * Para onde cai a sombra (para baixo à direita NA TELA), no referencial do
 * objeto: girado, a 3/4 gira a cena depois, e a sombra pintada tem de cair no
 * lugar na tela (como o `desgirarPonto` de `tresQuartos.ts`).
 */
function sombraNoObjeto(q: number): Ponto {
  const x = SOMBRA_X
  const y = SOMBRA_Y
  return q === 1 ? [y, -x] : q === 2 ? [-x, -y] : q === 3 ? [-y, x] : [x, y]
}

/** A mesma forma com a caixa de pintura centrada em (cx, cy): a 3/4 lê o meio da caixa para saber com quem a peça sobe. */
function presa(forma: Forma, cx: number, cy: number): Forma {
  const mx = Math.max(cx - forma.b[0], forma.b[2] - cx)
  const my = Math.max(cy - forma.b[1], forma.b[3] - cy)
  return { b: [cx - mx, cy - my, cx + mx, cy + my], d: (x, y) => forma.d(x, y) }
}

// ---------- as texturas ----------

/** A água lá embaixo: marolas compridas, e um brilho onde a marola sobe (só se vê no rombo e nas frestas largas). */
const texDaAgua: Textura = (_u, _v, x, y, _p, s) => {
  const marola = ruido(x * 0.21, y * 0.55)
  s[3] += marola * 0.1 + (marola > 0.3 ? (marola - 0.3) * 0.8 : 0)
}

/**
 * Uma tábua: o veio da madeira, o caminho gasto no meio (mais claro) e os
 * pregos, dois em cima de cada longarina (um perto de cada beira), com a
 * ferrugem escorrida ao longo do veio; a tábua nova não tem ferrugem.
 */
function texDaTabua(r: Regua, meio: number, passo: number, meiaLargura: number, nova: boolean): Textura {
  const pregos = [meio - (passo / 2 - FRESTA / 2 - PREGO_PARA_DENTRO), meio + (passo / 2 - FRESTA / 2 - PREGO_PARA_DENTRO)]
  return (u, v, x, y, p, s, escala) => {
    if (VEIO !== null) VEIO(u, v, x, y, p, s, escala)
    const [pu, pv] = r.uv(x, y)
    const noMeio = pv / meiaLargura
    s[3] += GASTO_NO_MEIO * Math.max(0, 1 - noMeio * noMeio * 2.4)
    for (const f of LONGARINAS) {
      const dv = pv - f * meiaLargura
      if (dv < -RAIO_DO_PREGO - 0.4 || dv > FERRUGEM + 0.4) continue
      for (const up of pregos) {
        const du = pu - up
        const longe = Math.hypot(du, dv)
        if (longe < RAIO_DO_PREGO) {
          misturarEm(s, PREGO.rgb, 0.92)
          // A cabeça batida pega luz do lado de cima à esquerda.
          s[3] += du + dv < 0 ? 0.16 : -0.08
          return
        }
        if (!nova && dv > 0 && dv < FERRUGEM && Math.abs(du) < 0.75) misturarEm(s, COR_DA_FERRUGEM, 0.5 * (1 - dv / FERRUGEM))
      }
    }
  }
}

/**
 * O topo cortado da estaca: os anéis do cerne, a medula escura e duas rachas de
 * sol desiguais, que entram da beira (uma comprida, quase até o meio, e uma
 * curta), cada uma um pouco torta.
 */
function texDoTopo(cx: number, cy: number, raio: number, sorteio: number): Textura {
  const rachas: readonly (readonly [number, number])[] = [
    [sorteio * VOLTA_INTEIRA, 0.3],
    [(sorteio + 0.43 + sorteio * 0.2) * VOLTA_INTEIRA, 0.62],
  ]
  return (_u, _v, x, y, p, s) => {
    const dx = x - cx
    const dy = y - cy
    const longe = Math.hypot(dx, dy)
    const anel = longe + ruido(x * 0.25 + p.semente, y * 0.25) * 1.1
    s[3] += Math.sin(anel * 3.4) * 0.05 + ruido(x * 0.7, y * 0.7) * 0.05
    if (longe < 1) s[3] -= 0.14
    const angulo = Math.atan2(dy, dx)
    for (const [a, de] of rachas) {
      if (longe < raio * de) continue
      let da = angulo - a - ruido(longe * 0.5, a) * 0.12
      da -= Math.round(da / VOLTA_INTEIRA) * VOLTA_INTEIRA
      // A racha abre para fora: um fio onde começa, larga na beira.
      if (Math.abs(da) * longe < 0.12 + ((longe - raio * de) / raio) * 0.5) s[3] -= 0.3
    }
  }
}

/** A torção do cabo ao longo do caminho dele (a do vergueiro do canhão). */
function texDoCabo(caminho: readonly Ponto[], raio: number, apagaDe = Infinity): Textura {
  const ate: number[] = [0]
  for (let i = 1; i < caminho.length; i += 1) ate.push(ate[i - 1] + Math.hypot(caminho[i][0] - caminho[i - 1][0], caminho[i][1] - caminho[i - 1][1]))
  const total = ate[ate.length - 1]
  return (_u, _v, x, y, _p, s) => {
    let menor = Infinity
    let aoLongo = 0
    let atraves = 0
    for (let i = 1; i < caminho.length; i += 1) {
      const [ax, ay] = caminho[i - 1]
      const dx = caminho[i][0] - ax
      const dy = caminho[i][1] - ay
      const comprimento = ate[i] - ate[i - 1] || 1e-9
      const h = limitar(((x - ax) * dx + (y - ay) * dy) / (comprimento * comprimento), 0, 1)
      const qx = x - ax - dx * h
      const qy = y - ay - dy * h
      const d2 = qx * qx + qy * qy
      if (d2 >= menor) continue
      menor = d2
      aoLongo = ate[i - 1] + h * comprimento
      atraves = (qy * dx - qx * dy) / comprimento
    }
    const faixa = Math.sin((aoLongo / 3.4) * VOLTA_INTEIRA + (atraves / raio) * 1.2)
    misturarEm(s, TORCAO_DO_CABO, limitar((faixa - 0.2) / 0.8, 0, 1))
    s[3] += 0.06
    // A ponta que desce para a água some aos poucos.
    if (aoLongo > apagaDe) s[5] = limitar(1 - (aoLongo - apagaDe) / (total - apagaDe), 0, 1)
  }
}

// ---------- o tabuado ----------

/** O rombo da tábua quebrada: atravessa a tábua, com as lascas das duas beiras entrando nele. */
function rombo(r: Regua, u0: number, u1: number, meiaLargura: number, i: number): Forma {
  const largura = meiaLargura * LARGURA_DO_ROMBO
  const meio = meiaLargura * (0.3 - hash(i, 11, 9130) * 0.55)
  const v0 = meio - largura / 2
  const v1 = meio + largura / 2
  const em = (k: number): number => u0 - 1 + ((u1 - u0 + 2) * k) / LASCAS
  const pontos: Ponto[] = []
  for (let k = 0; k <= LASCAS; k += 1) pontos.push([em(k), v0 + (k % 2 === 1 ? LASCA * (0.5 + hash(i, k, 9131) * 0.5) : 0)])
  for (let k = LASCAS; k >= 0; k -= 1) pontos.push([em(k), v1 - (k % 2 === 1 ? LASCA * (0.5 + hash(i, k, 9132) * 0.5) : 0)])
  return r.poligono(pontos)
}

function montarTabuado(c: ContextoDoMovel, cena: Cena, r: Regua): void {
  const P = c.peca
  const L = cena.partes
  const comprido = 2 * r.hu
  const borda = r.hv - MARGEM
  const aguaV = borda - AGUA_PARA_DENTRO
  // A água lá embaixo e as longarinas vão de ponta a ponta, sem borda nas pontas (emendam no trecho vizinho).
  L.push(P(r.caixa(-r.hu, -aguaV, r.hu, aguaV), AGUA_DE_BAIXO, { tabua: 0, bisel: 0, contorno: 0, textura: texDaAgua, semente: 9100 }))
  LONGARINAS.forEach((f, i) => {
    const v = f * aguaV
    L.push(P(r.caixa(-r.hu, v - LARGURA_DA_LONGARINA / 2, r.hu, v + LARGURA_DA_LONGARINA / 2), c.m.madeira, { eixo: r.eixoAoComprido, tabua: 0, bisel: 0.6, tom: TOM_DA_LONGARINA, contorno: 0, semente: 9101 + i }))
  })
  const n = Math.max(2, Math.round(comprido / TABUA))
  const passo = comprido / n
  // A tábua nova e a quebrada, sorteadas longe das pontas (a ponta do trecho fica igual à do vizinho).
  const nova = n >= 4 ? 1 + Math.floor(hash(n, 7, 9105) * (n - 2)) : -1
  let quebrada = n >= 4 ? 1 + Math.floor(hash(n, 8, 9106) * (n - 2)) : -1
  if (quebrada === nova) quebrada = nova + 1 < n - 1 ? nova + 1 : nova - 1
  for (let i = 0; i < n; i += 1) {
    const u0 = -r.hu + i * passo + FRESTA / 2
    const u1 = u0 + passo - FRESTA
    const sorte = (k: number): number => hash(i, k, 9110)
    const va0 = -borda + sorte(1) * PONTA_DESIGUAL
    const va1 = Math.max(-borda, va0 + (sorte(2) - 0.5) * 2 * TORTO)
    const vb0 = borda - sorte(3) * PONTA_DESIGUAL
    const vb1 = Math.min(borda, vb0 + (sorte(4) - 0.5) * 2 * TORTO)
    let forma = r.poligono([[u0, va0], [u1, va1], [u1, vb1], [u0, vb0]])
    if (i === quebrada) forma = menos(forma, rombo(r, u0, u1, borda, i))
    const tom = i === nova ? TOM_DA_NOVA : TOM_GASTO + sorte(5) * TOM_QUE_VARIA
    L.push(P(forma, c.m.madeira, {
      eixo: r.eixoDeTraves,
      tabua: 0,
      bisel: 0.9,
      tom,
      contorno: i === nova ? 0.2 : 0.26,
      semente: 9120 + i,
      textura: texDaTabua(r, (u0 + u1) / 2, passo, borda, i === nova),
    }))
  }
}

// ---------- o cunho e a amarra ----------

function montarCunho(c: ContextoDoMovel, cena: Cena, r: Regua, u: number, v: number): void {
  const P = c.peca
  const L = cena.partes
  L.push(P(r.caixa(u - CUNHO.base, v - CUNHO.meiaBase, u + CUNHO.base, v + CUNHO.meiaBase, 1), FERRO_DO_CUNHO, { tabua: 0, bisel: 0.8, tom: 0.82, contorno: 0.3, metal: 0.3, semente: 9170, projeta: { dist: 0.8, forca: 0.32 } }))
  const [ax, ay] = r.ponto(u - CUNHO.meio, v)
  const [bx, by] = r.ponto(u + CUNHO.meio, v)
  L.push(P(capsula(ax, ay, bx, by, CUNHO.raio), FERRO_DO_CUNHO, { tabua: 0, bisel: CUNHO.raio, tom: 1.08, contorno: 0.3, metal: 0.55, semente: 9171, projeta: { dist: 1.1, forca: 0.34 } }))
  // A amarra em oito por cima dos chifres e a ponta que sai pela borda e desce para a água.
  const pedaco = (pontos: readonly Ponto[], semente: number, apagaDe = Infinity): void => {
    const caminho = pontos.map(([pu, pv]) => r.ponto(pu, pv))
    L.push(P(cadeia(caminho, RAIO_DO_CABO), CABO, { bisel: RAIO_DO_CABO, contorno: 0.3, textura: texDoCabo(caminho, RAIO_DO_CABO, apagaDe), semente, projeta: { dist: 0.7, forca: 0.3 } }))
  }
  pedaco([[u - 6.4, v + 3.1], [u - 1, v + 0.4], [u + 6.4, v - 3.1]], 9172)
  pedaco([[u - 6.4, v - 3.1], [u + 1, v - 0.2], [u + 6.4, v + 3.1]], 9173)
  const fora = r.hv + 3
  const ponta: Ponto[] = [[u + 6.4, v + 3.1], [u + 8.6, v + 7], [u + 9.6, (v + fora) / 2 + 2], [u + 10.2, fora]]
  const comprimento = ponta.reduce((soma, [pu, pv], i) => (i === 0 ? 0 : soma + Math.hypot(pu - ponta[i - 1][0], pv - ponta[i - 1][1])), 0)
  pedaco(ponta, 9174, comprimento - 7)
}

// ---------- as estacas ----------

function montarEstacas(c: ContextoDoMovel, cena: Cena, r: Regua, q: number): void {
  const P = c.peca
  const L = cena.partes
  const n = Math.max(1, Math.round((2 * r.hu) / VAO_DAS_ESTACAS))
  const vao = (2 * r.hu) / n
  const raio = RAIO_DA_ESTACA
  const [sx, sy] = sombraNoObjeto(q)
  const [, sv] = r.uv(sx, sy)
  const tabulado = r.caixa(-r.hu, -(r.hv - MARGEM), r.hu, r.hv - MARGEM)
  const topos: { forma: Forma; cx: number; cy: number; sorte: (k: number) => number; i: number }[] = []
  for (const lado of [-1, 1]) {
    for (let k = 0; k < n; k += 1) {
      const i = k * 2 + (lado > 0 ? 1 : 0)
      const sorte = (j: number): number => hash(i, j, 9140)
      const [cx, cy] = r.ponto(-r.hu + (k + 0.5) * vao, lado * (r.hv - raio))
      const z = ALTURA_DA_ESTACA + sorte(1) * ALTURA_QUE_VARIA
      const forma = elipse(cx, cy, raio, raio)
      cena.sombras.push({ forma, z }, contato(forma, 0.3))
      // A sombra da estaca no tabuado (do lado de dentro da luz): o rastro arrastado, que fica no chão na 3/4.
      if (sv * lado < 0) {
        const ponta: Ponto = [cx + sx * z, cy + sy * z]
        const rastro = dentroDe(capsula(cx, cy, ponta[0], ponta[1], raio * 0.92), tabulado)
        L.push(P(presa(rastro, ponta[0] + sx * 6, ponta[1] + sy * 6), SOMBRA_NO_TABULADO, { tabua: 0, bisel: 0, contorno: 0, alfa: ALFA_DO_RASTRO, suave: 1.2, semente: 9150 + i }))
      }
      topos.push({ forma, cx, cy, sorte, i })
    }
  }
  for (const { forma, cx, cy, sorte, i } of topos) {
    // Uma volta de cabo em algumas: por fora do topo, que a cobre pela metade de dentro.
    if (sorte(2) < 0.5) {
      const rv = raio + RAIO_DO_CABO * 0.55
      const caminho: Ponto[] = []
      for (let j = 0; j <= PONTOS_DA_VOLTA; j += 1) {
        const a = (j / PONTOS_DA_VOLTA) * VOLTA_INTEIRA + sorte(4) * VOLTA_INTEIRA
        caminho.push([cx + Math.cos(a) * rv, cy + Math.sin(a) * rv])
      }
      L.push(P(cadeia(caminho, RAIO_DO_CABO), CABO, { bisel: RAIO_DO_CABO, contorno: 0.3, textura: texDoCabo(caminho, RAIO_DO_CABO), semente: 9160 + i, projeta: { dist: 0.8, forca: 0.3 } }))
    }
    // O topo leva a maior caixa da estaca: a frente dela na 3/4 sai de madeira, e não do cabo da volta.
    const caixaDoTopo: Caixa = [cx - raio - 3, cy - raio - 3, cx + raio + 3, cy + raio + 3]
    L.push(P({ b: caixaDoTopo, d: forma.d }, c.m.madeira, { tabua: 0, bisel: raio * 0.42, tom: 0.92, contorno: 0.3, semente: 9180 + i, textura: texDoTopo(cx, cy, raio, sorte(3)), projeta: { dist: 1.2, forca: 0.3 } }))
  }
}

export const montarPier: MontarMovel = (c, cena) => {
  const r = novaRegua(c)
  const q = quartosDoGiro(c.giro)
  // A sombra do tabuado na água, do lado de baixo da luz: só entre as duas pontas do trecho, que emenda no vizinho.
  const [sx, sy] = sombraNoObjeto(q)
  const [su, sv] = r.uv(sx * ALTURA_DO_TABULADO, sy * ALTURA_DO_TABULADO)
  const meia = r.hv - MARGEM - PONTA_DESIGUAL / 2
  const largo = 2 * r.hv + 4 * ALTURA_DO_TABULADO
  cena.sombras.push({ forma: dentroDe(r.caixa(-r.hu + su, -meia + sv, r.hu + su, meia + sv), r.caixa(-r.hu, -largo, r.hu, largo)), z: 0, suave: 1.6, forca: 0.34 })
  montarTabuado(c, cena, r)
  const n = Math.max(1, Math.round((2 * r.hu) / VAO_DAS_ESTACAS))
  const vao = (2 * r.hu) / n
  // O cunho fica entre a primeira e a segunda estaca do lado de baixo, por dentro delas.
  montarCunho(c, cena, r, n >= 2 ? -r.hu + vao : 0, r.hv - 2 * RAIO_DA_ESTACA - 5)
  montarEstacas(c, cena, r, q)
}
