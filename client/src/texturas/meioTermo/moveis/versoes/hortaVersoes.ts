/**
 * As versões da HORTA (L07 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`; tema Vila e
 * fazenda). A 1ª, LEGUMES, é o desenho de hoje (`montarHorta`); aqui ficam as outras duas, no MESMO canteiro (a terra
 * escura revolvida, as tábuas baixas nas quatro estacas de canto e a faixa livre à direita, onde a de hoje põe o
 * regador):
 *
 * - ABÓBORAS: duas leiras largas, com um pé de abóbora em cada canto do canteiro (a horta esticada ganha mais pés,
 *   nunca um pé esticado): as folhas grandes de cinco lobos, ásperas e manchadas, de pé nos talos; as ramas que
 *   correm pela terra; e as abóboras deitadas na ponta das ramas, com os gomos saindo do cabinho, em quatro tons
 *   contidos (duas de casca laranja-queimado, uma creme e uma moranga verde-cinza). Uma rama passa por cima da
 *   tábua da direita e deixa uma abóbora fora do canteiro, na faixa do regador.
 * - REPOLHOS: o canteiro inteiro de repolhos em fileiras desencontradas, cada pé com as folhas de fora abertas (a
 *   nervura clara) e a cabeça fechada, e um ou outro repolho roxo no meio. Na faixa da direita, o caixote com dois
 *   repolhos já colhidos.
 *
 * A pegada e o lugar de material são os da horta: `madeira` (as tábuas, as estacas de canto e o caixote). A terra, as
 * plantas e as abóboras são fixas.
 *
 * Na 3/4 (o perfil da horta, `{ modo: 'derivado', espessura: 0 }`): as tábuas, as estacas e o caixote são colunas;
 * as folhas de abóbora, as abóboras e as cabeças dos repolhos sobem presas a um PINO (o tampo solto minúsculo e sem
 * sombra da horta de hoje), com a caixa centrada nele. A terra, as ramas e as folhas de fora dos repolhos ficam no
 * chão. Lê `c.giro` como a de hoje: a encosta clara das leiras fica do lado da luz NA TELA.
 */
import { hash, rgb } from '../../../ruido'
import { tomDoMeio } from '../../materiais'
import { caixa, cadeia, capsula, elipseGirada, type Caixa, type Forma, type Ponto } from '../formas'
import { contato, ruido, type CriarPeca, type MaterialDaPeca, type Peca, type Sombra, type Textura } from '../motor'
import type { ContextoDoMovel, MontarMovel } from '../contexto'
import type { VersoesDesenhadas } from '.'

const VOLTA = Math.PI * 2

// ---------- o canteiro (as mesmas medidas da horta de hoje) ----------

/** A faixa da direita (a do regador, na horta de hoje) e a folga em volta do canteiro, em casas. */
const FAIXA_DA_DIREITA = 0.3
const FOLGA_DA_PEGADA = 0.01
/** As tábuas (espessura e altura) e as estacas de canto (lado e altura), em casas. */
const TABUA = { espessura: 0.058, altura: 0.13 } as const
const ESTACA_DE_CANTO = { lado: 0.086, altura: 0.19 } as const
/** A terra revolvida: a lenha do Meio-Termo, escura mas acima do piso de luz no fundo do sulco. */
const TERRA: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('lenha', 0.9)) }
const LUZ_DA_LEIRA = 0.14
const ESCURO_DO_SULCO = 0.17
const TORTO_DA_LEIRA = 2
const LUZ_NO_CHAO = { x: -0.62, y: -0.48 } as const

interface Retangulo {
  readonly x0: number
  readonly y0: number
  readonly x1: number
  readonly y1: number
}

interface Obra {
  readonly L: Peca[]
  readonly sombras: Sombra[]
  readonly P: CriarPeca
  readonly g: number
  readonly giro: number
}

function circulo(cx: number, cy: number, r: number): Forma {
  return { b: [cx - r, cy - r, cx + r, cy + r], d: (x, y) => Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) - r }
}

function naCaixa(f: Forma, b: Caixa): Forma {
  return { b, d: (x, y) => f.d(x, y) }
}

/** A forma com a caixa crescida até o meio dela cair em (cx, cy): a 3/4 a sobe com o pino que está ali. */
function comMeioEm(f: Forma, cx: number, cy: number): Forma {
  const mx = Math.max(cx - f.b[0], f.b[2] - cx)
  const my = Math.max(cy - f.b[1], f.b[3] - cy)
  return naCaixa(f, [cx - mx, cy - my, cx + mx, cy + my])
}

/** O pino: só diz à 3/4 a altura de quem tem o meio da caixa nele. Sem sombra no chão. */
function pino(x: number, y: number, z: number): Sombra {
  return { forma: circulo(x, y, 0.5), z, solta: true, forca: 0, suave: 0.1 }
}

/** O deslocamento no desenho que cai em (dx, dy) NA TELA depois do quarto de volta que a 3/4 pinta. */
function desgirado(dx: number, dy: number, giro: number): [number, number] {
  const quartos = ((Math.round(giro / 90) % 4) + 4) % 4
  return quartos === 1 ? [dy, -dx] : quartos === 2 ? [-dx, -dy] : quartos === 3 ? [-dy, dx] : [dx, dy]
}

/** A terra em leiras ao comprido (a conta da horta de hoje): a encosta da luz clara, o sulco escuro, os torrões. */
function texDaTerraEmLeiras(alto: number, leira: number, giro: number): Textura {
  const deCima = desgirado(LUZ_NO_CHAO.x, LUZ_NO_CHAO.y, giro)[1] / LUZ_NO_CHAO.y
  return (_u, _v, x, y, _p, s) => {
    const noLombo = (y + ruido(x * 0.045 + 17, y * 0.02 + 3) * TORTO_DA_LEIRA - alto) / leira
    const volta = (noLombo - Math.floor(noLombo) - 0.5) * VOLTA
    const sulco = (1 - Math.cos(volta)) / 2
    let luz = -Math.sin(volta) * LUZ_DA_LEIRA * deCima - ESCURO_DO_SULCO * sulco * sulco * sulco * sulco
    luz += ruido(x * 0.26 + 41, y * 0.4 + 7) * 0.15 + ruido(x * 0.8 + 5, y * 0.8 + 13) * 0.07
    const grao = hash(Math.floor(x * 0.9), Math.floor(y * 0.9), 57)
    if (grao > 0.94) luz -= 0.09
    else if (grao < 0.05) luz += 0.08
    s[3] += luz
  }
}

/** Topo de madeira cortada: anéis em volta do meio (as estacas de canto). */
function texDoTopo(cx: number, cy: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const longe = Math.hypot(x - cx, y - cy) + ruido(x * 0.2 + p.semente, y * 0.2) * 1.2
    s[3] += Math.sin(longe * 4.2) * 0.04 + ruido(x * 0.6, y * 0.6) * 0.05 + 0.05
  }
}

/** As quatro tábuas de canto e as quatro estacas (colunas baixas), como na horta de hoje. */
function cercar(o: Obra, madeira: MaterialDaPeca, { x0, y0, x1, y1 }: Retangulo): void {
  const { L, P, sombras, g } = o
  const lado = g * ESTACA_DE_CANTO.lado
  const grossa = g * TABUA.espessura
  const recuo = (lado - grossa) / 2
  const entra = lado - 0.4
  const tabuas: readonly (readonly [Forma, number])[] = [
    [caixa(x0 + entra, y0 + recuo, x1 - entra, y0 + recuo + grossa, 0.4), 0],
    [caixa(x0 + entra, y1 - recuo - grossa, x1 - entra, y1 - recuo, 0.4), 0],
    [caixa(x0 + recuo, y0 + entra, x0 + recuo + grossa, y1 - entra, 0.4), Math.PI / 2],
    [caixa(x1 - recuo - grossa, y0 + entra, x1 - recuo, y1 - entra, 0.4), Math.PI / 2],
  ]
  for (const [i, [tabua, eixo]] of tabuas.entries()) {
    sombras.push({ forma: tabua, z: g * TABUA.altura }, contato(tabua, 0.26))
    L.push(P(tabua, madeira, { eixo, tabua: 0, bisel: 0.9, contorno: 0.26, semente: 7510 + i }))
  }
  for (const [i, [ex, ey]] of ([[x0, y0], [x1 - lado, y0], [x0, y1 - lado], [x1 - lado, y1 - lado]] as const).entries()) {
    const estaca = caixa(ex, ey, ex + lado, ey + lado, 0.7)
    sombras.push({ forma: estaca, z: g * ESTACA_DE_CANTO.altura }, contato(estaca, 0.28))
    L.push(P(estaca, madeira, { tabua: 0, bisel: 0.9, contorno: 0.3, tom: 0.9, textura: texDoTopo(ex + lado / 2, ey + lado / 2), semente: 7520 + i }))
  }
}

/** O canteiro e a terra na pegada da horta: o retângulo das tábuas, o da terra e a faixa livre da direita. */
function canteiroDa(c: ContextoDoMovel): { canteiro: Retangulo; terra: Retangulo } {
  const { hw, hh, g } = c
  const folga = g * FOLGA_DA_PEGADA
  const canteiro: Retangulo = { x0: -hw + folga, y0: -hh + folga, x1: hw - g * FAIXA_DA_DIREITA, y1: hh - folga }
  const borda = (g * (ESTACA_DE_CANTO.lado + TABUA.espessura)) / 2
  return { canteiro, terra: { x0: canteiro.x0 + borda, y0: canteiro.y0 + borda, x1: canteiro.x1 - borda, y1: canteiro.y1 - borda } }
}

/** A terra em `leiras` leiras; a caixa cresce para o fundo, para o meio dela não cair no pino de nenhum pé. */
function porTerra(o: Obra, terra: Retangulo, leiras: number): void {
  const leira = (terra.y1 - terra.y0) / leiras
  const chao = caixa(terra.x0 - 0.5, terra.y0 - 0.5, terra.x1 + 0.5, terra.y1 + 0.5, 0.6)
  o.L.push(o.P(naCaixa(chao, [chao.b[0], chao.b[1] - leira / 2, chao.b[2], chao.b[3]]), TERRA, { bisel: 0, contorno: 0.1, recesso: { k: 2.2, forca: 0.3 }, textura: texDaTerraEmLeiras(terra.y0, leira, o.giro), semente: 7500 }))
}

/** Folha: luz manchada, sem listra. */
const texDeFolha: Textura = (_u, _v, x, y, p, s) => {
  s[3] += ruido(x * 0.5 + p.su, y * 0.5 + p.sv) * 0.1 + ruido(x * 1.3 + 7, y * 1.3) * 0.04
}

// ---------- abóboras ----------

/** A folha de abóbora: verde fechado e fosco; a rama, mais amarelada; o cabinho, pardo-esverdeado. */
const FOLHA_DA_ABOBORA: MaterialDaPeca = { classe: 'liso', rgb: rgb('#5b8450') }
const RAMA_DA_ABOBORA: MaterialDaPeca = { classe: 'liso', rgb: rgb('#748c4e') }
const CABINHO: MaterialDaPeca = { classe: 'liso', rgb: rgb('#76704a') }
/** As cascas, contidas: laranja-queimado (duas), creme e a moranga verde-cinza. */
const CASCAS: readonly MaterialDaPeca[] = [
  { classe: 'liso', rgb: rgb('#ad7748') },
  { classe: 'liso', rgb: rgb('#c4ad84') },
  { classe: 'liso', rgb: rgb('#a3714a') },
  { classe: 'liso', rgb: rgb('#848c6c') },
]
/** Um pé a cada tanto (casas), ao comprido e ao través; o raio da folha e da abóbora (casas). */
const PE_DE_ABOBORA = { passoX: 0.64, passoY: 0.6, folha: 0.135, abobora: 0.11 } as const
/** Quanto cada coisa sobe na 3/4 (casas): a folha nos talos e a abóbora deitada. */
const ALTURA_DA_FOLHA = 0.1
const ALTURA_DA_ABOBORA = 0.08
const GOMOS = 10
/** A sombra que a folha e a abóbora fazem na terra e no que está embaixo. */
const SOMBRA_DA_FOLHA = { dist: 1.5, forca: 0.28, suave: 1 } as const
const SOMBRA_DA_ABOBORA = { dist: 1.9, forca: 0.32, suave: 1.1 } as const

/** A folha de cinco lobos, com o recorte do talo do lado de `a` + π (distância aproximada, boa para a borda). */
function folhaLobada(cx: number, cy: number, R: number, a: number): Forma {
  return {
    b: [cx - R * 1.02, cy - R * 1.02, cx + R * 1.02, cy + R * 1.02],
    d: (x, y) => {
      const dx = x - cx
      const dy = y - cy
      const t = Math.atan2(dy, dx) - a
      const recorte = Math.max(0, Math.cos(t - Math.PI)) ** 10
      const r = R * (0.84 + 0.15 * Math.cos(5 * t)) * (1 - 0.4 * recorte)
      return (Math.hypot(dx, dy) - r) * 0.92
    },
  }
}

/** As nervuras saindo do pé da folha para os cinco lobos, mais claras, e as manchas prateadas da folha de abóbora. */
function texDaFolhaLobada(cx: number, cy: number, R: number, a: number): Textura {
  const bx = cx - Math.cos(a) * R * 0.55
  const by = cy - Math.sin(a) * R * 0.55
  const rumos = [-2, -1, 0, 1, 2].map((k) => a + k * 0.9)
  return (_u, _v, x, y, p, s) => {
    let luz = ruido(x * 0.55 + p.su, y * 0.55 + p.sv) * 0.1
    const mancha = ruido(x * 0.35 + 9 + p.su, y * 0.35)
    if (mancha > 0.22) luz += (mancha - 0.22) * 0.5
    const dx = x - bx
    const dy = y - by
    for (const r of rumos) {
      const ao = dx * Math.cos(r) + dy * Math.sin(r)
      if (ao < 0) continue
      const atraves = Math.abs(-dx * Math.sin(r) + dy * Math.cos(r))
      if (atraves < 0.5) luz += 0.09 * (1 - atraves / 0.5) * Math.max(0, 1 - ao / (R * 1.4))
    }
    s[3] += luz
  }
}

/** Os gomos da abóbora vista de cima: sulcos saindo do cabinho, e o claro do ombro virado para a luz. */
function texDosGomos(cx: number, cy: number, r: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const dx = x - cx
    const dy = y - cy
    const longe = Math.min(1, Math.hypot(dx, dy) / (r * 0.3))
    const sulco = Math.abs(Math.cos((Math.atan2(dy, dx) * GOMOS) / 2 + p.su)) ** 7
    s[3] += -sulco * 0.16 * longe + ruido(x * 0.8 + p.semente, y * 0.8) * 0.05
  }
}

/** Uma rama: anda do pé em passos curtos, virando aos poucos, e acaba em (fim); `torce` = o quanto ela serpenteia. */
function rama(de: Ponto, ate: Ponto, torce: number, sem: number): Ponto[] {
  const pontos: Ponto[] = []
  const passos = Math.max(4, Math.ceil(Math.hypot(ate[0] - de[0], ate[1] - de[1]) / 1.6))
  const nx = -(ate[1] - de[1])
  const ny = ate[0] - de[0]
  const l = Math.hypot(nx, ny) || 1
  for (let k = 0; k <= passos; k += 1) {
    const t = k / passos
    const desvio = Math.sin(t * Math.PI * 2 + sem) * torce * Math.sin(t * Math.PI)
    pontos.push([de[0] + (ate[0] - de[0]) * t + (nx / l) * desvio, de[1] + (ate[1] - de[1]) * t + (ny / l) * desvio])
  }
  return pontos
}

function porRama(o: Obra, pontos: readonly Ponto[], sem: number): void {
  o.L.push(o.P(cadeia(pontos, 0.62), RAMA_DA_ABOBORA, { bisel: 0.6, contorno: 0.26, tom: 0.92, semente: sem, projeta: { dist: 0.8, forca: 0.26, suave: 0.6 } }))
}

function porAbobora(o: Obra, x: number, y: number, r: number, casca: MaterialDaPeca, sem: number): void {
  const { L, P, sombras, g } = o
  sombras.push(pino(x, y, g * ALTURA_DA_ABOBORA))
  const giro = hash(sem, 1, 811) * Math.PI
  const corpo = elipseGirada(x, y, r, r * 0.86, giro)
  L.push(P(comMeioEm(corpo, x, y), casca, { bisel: r * 0.62, contorno: 0.28, textura: texDosGomos(x, y, r), semente: sem, projeta: SOMBRA_DA_ABOBORA }))
  // O cabinho, um nada para o lado da luz (o alto da abóbora), torto.
  const a = hash(sem, 2, 811) * VOLTA
  const cx = x - r * 0.12
  const cy = y - r * 0.14
  L.push(P(comMeioEm(capsula(cx, cy, cx + Math.cos(a) * r * 0.32, cy + Math.sin(a) * r * 0.32, r * 0.13), x, y), CABINHO, { bisel: r * 0.1, contorno: 0.3, semente: sem + 1 }))
}

function porFolha(o: Obra, x: number, y: number, R: number, a: number, sem: number): void {
  o.sombras.push(pino(x, y, o.g * ALTURA_DA_FOLHA * (0.75 + 0.5 * hash(sem, 3, 812))))
  o.L.push(o.P(comMeioEm(folhaLobada(x, y, R, a), x, y), FOLHA_DA_ABOBORA, { bisel: R * 0.3, contorno: 0.26, tom: 0.9 + 0.16 * hash(sem, 4, 812), textura: texDaFolhaLobada(x, y, R, a), semente: sem, projeta: SOMBRA_DA_FOLHA }))
}

const montarHortaDeAboboras: MontarMovel = (c, cena) => {
  const { g, peca: P } = c
  const o: Obra = { L: cena.partes, sombras: cena.sombras, P, g, giro: c.giro }
  const { canteiro, terra } = canteiroDa(c)
  porTerra(o, terra, 2)
  const largura = terra.x1 - terra.x0
  const altura = terra.y1 - terra.y0
  const colunas = Math.max(2, Math.round(largura / (g * PE_DE_ABOBORA.passoX)))
  const linhas = Math.max(2, Math.round(altura / (g * PE_DE_ABOBORA.passoY)))
  const R = g * PE_DE_ABOBORA.folha
  const rA = g * PE_DE_ABOBORA.abobora
  const pes: { x: number; y: number; i: number }[] = []
  for (let l = 0; l < linhas; l += 1) {
    for (let k = 0; k < colunas; k += 1) {
      const i = l * 16 + k
      pes.push({
        x: terra.x0 + (largura * (k + 0.5)) / colunas + (hash(i, 1, 813) - 0.5) * R * 0.8,
        y: terra.y0 + (altura * (l + 0.5)) / linhas + (hash(i, 2, 813) - 0.5) * R * 0.6,
        i,
      })
    }
  }
  // As abóboras: uma por pé, na ponta de uma rama que sai para o lado de fora da célula, sem cair na tábua.
  const dentro = (x: number, y: number, r: number): [number, number] => [
    Math.min(terra.x1 - r - 0.6, Math.max(terra.x0 + r + 0.6, x)),
    Math.min(terra.y1 - r - 0.6, Math.max(terra.y0 + r + 0.6, y)),
  ]
  const aboboras = pes.map((p, n) => {
    const rumo = hash(p.i, 3, 813) * VOLTA
    const longe = R * (1.5 + 0.5 * hash(p.i, 4, 813))
    const r = rA * (0.82 + 0.3 * hash(p.i, 5, 813))
    const [x, y] = dentro(p.x + Math.cos(rumo) * longe, p.y + Math.sin(rumo) * longe * 0.8, r)
    return { x, y, r, casca: CASCAS[(n + Math.floor(hash(p.i, 6, 813) * 2)) % CASCAS.length], de: p }
  })
  // A rama que sai do pé da direita de baixo, passa por cima da tábua e deixa uma abóbora na faixa livre.
  const ultimo = pes[pes.length - 1]
  const fora = { x: c.hw - (g * FAIXA_DA_DIREITA) / 2, y: Math.min(c.hh - rA - 1.5, ultimo.y + R * 0.9), r: rA * 0.95 }

  // A ordem: as ramas no chão, as abóboras, a tábua e as estacas, as folhas por cima, e a rama e a abóbora de fora.
  pes.forEach((p, n) => {
    const a = aboboras[n]
    porRama(o, rama([p.x, p.y], [a.x, a.y], R * 0.35, p.i), 8000 + p.i * 10)
    const outra = hash(p.i, 7, 813) * VOLTA
    const [ox, oy] = dentro(p.x + Math.cos(outra) * R * 1.7, p.y + Math.sin(outra) * R * 1.3, 1)
    porRama(o, rama([p.x, p.y], [ox, oy], R * 0.4, p.i + 3), 8001 + p.i * 10)
  })
  // A rama que corre de um pé ao do lado na mesma leira (a abóbora se espalha pelo chão), com uma folha nova no meio.
  const folhasDaRama: { x: number; y: number; a: number; i: number }[] = []
  for (const p of pes) {
    const vizinho = pes.find((q) => q.i === p.i + 1)
    if (vizinho === undefined) continue
    const pontos = rama([p.x + R * 0.3, p.y], [vizinho.x - R * 0.3, vizinho.y], R * 0.45, p.i + 11)
    porRama(o, pontos, 8700 + p.i)
    const [mx, my] = pontos[Math.floor(pontos.length / 2)]
    folhasDaRama.push({ x: mx, y: my, a: Math.atan2(vizinho.y - p.y, vizinho.x - p.x) + (hash(p.i, 12, 813) < 0.5 ? 1.2 : -1.2), i: p.i })
  }
  for (const [n, a] of aboboras.entries()) porAbobora(o, a.x, a.y, a.r, a.casca, 8200 + n * 10)
  cercar(o, c.m.madeira, canteiro)
  for (const f of folhasDaRama) porFolha(o, f.x, f.y, R * 0.58, f.a, 8800 + f.i)
  for (const p of pes) {
    const folhas = 5 + Math.floor(hash(p.i, 8, 813) * 2)
    const fase = hash(p.i, 9, 813) * VOLTA
    for (let k = 0; k < folhas; k += 1) {
      const a = fase + (k / folhas) * VOLTA + (hash(p.i, 20 + k, 813) - 0.5) * 0.5
      const longe = R * (0.62 + 0.25 * hash(p.i, 30 + k, 813))
      porFolha(o, p.x + Math.cos(a) * longe, p.y + Math.sin(a) * longe * 0.85, R * (0.82 + 0.24 * hash(p.i, 40 + k, 813)), a, 8400 + p.i * 16 + k)
    }
    // A folha nova do meio, menor e mais clara.
    porFolha(o, p.x, p.y, R * 0.62, fase + 1, 8390 + p.i)
  }
  const passa: Ponto[] = rama([ultimo.x + R * 0.4, ultimo.y + R * 0.3], [fora.x - fora.r * 0.6, fora.y], R * 0.3, 5)
  porRama(o, passa, 8600)
  porAbobora(o, fora.x, fora.y, fora.r, CASCAS[0], 8610)
  porFolha(o, (canteiro.x1 + fora.x) / 2 + 1, fora.y - fora.r * 1.25, R * 0.6, -0.6, 8620)
}

// ---------- repolhos ----------

/** O repolho verde (o da horta de hoje) e o roxo, contido (lilás acinzentado, sem vinho). */
interface TonsDoRepolho {
  readonly folha: MaterialDaPeca
  readonly cabeca: MaterialDaPeca
}
const REPOLHO_VERDE: TonsDoRepolho = { folha: { classe: 'liso', rgb: rgb('#628a6c') }, cabeca: { classe: 'liso', rgb: rgb('#a6c295') } }
const REPOLHO_ROXO: TonsDoRepolho = { folha: { classe: 'liso', rgb: rgb('#6f6781') }, cabeca: { classe: 'liso', rgb: rgb('#8f84a0') } }
/** O raio do pé com as folhas de fora e quanto a cabeça sobe (casas); o passo na fileira e o das fileiras. */
const REPOLHO = { raio: 0.128, altura: 0.1, passo: 0.31, fileira: 0.34 } as const
const FOLHAS_DO_REPOLHO = 7
const TONS_DAS_FOLHAS: readonly number[] = [0.95, 1.04, 0.9, 1, 0.93, 1.06, 0.98]
const SOMBRA_DA_FOLHA_DO_REPOLHO = { dist: 1.2, forca: 0.24, suave: 0.9 } as const
/** Um repolho roxo a cada tanto (o sorteio). */
const CHANCE_DO_ROXO = 0.16

/** A folha de fora: a nervura clara do pé para a ponta e umas nervuras finas de lado. */
function texDaFolhaDeRepolho(cx: number, cy: number, a: number): Textura {
  const co = Math.cos(a)
  const si = Math.sin(a)
  return (_u, _v, x, y, p, s) => {
    const ao = (x - cx) * co + (y - cy) * si
    const atraves = -(x - cx) * si + (y - cy) * co
    const meio = Math.abs(atraves)
    let luz = ruido(x * 0.5 + p.su, y * 0.5 + p.sv) * 0.08 + (meio < 0.5 ? 0.11 * (1 - meio / 0.5) : 0)
    // As de lado: arcos que saem da nervura do meio para a borda (finos, só um claro leve).
    const lado = Math.abs(Math.sin(ao * 1.1 - meio * 0.8))
    if (meio > 0.8 && lado < 0.12) luz += 0.04
    s[3] += luz
  }
}

function plantarRepolho(o: Obra, x: number, y: number, roxo: boolean, sem: number): void {
  const { L, P, sombras, g } = o
  const tons = roxo ? REPOLHO_ROXO : REPOLHO_VERDE
  const R = g * REPOLHO.raio * (0.92 + 0.14 * hash(sem, 1, 814))
  const fase = hash(sem, 2, 814) * VOLTA
  for (let k = 0; k < FOLHAS_DO_REPOLHO; k += 1) {
    const a = fase + (k / FOLHAS_DO_REPOLHO) * VOLTA + (hash(sem, 10 + k, 814) - 0.5) * 0.35
    const longe = R * (0.5 + 0.08 * hash(sem, 20 + k, 814))
    const folha = elipseGirada(x + Math.cos(a) * longe, y + Math.sin(a) * longe, R * 0.5, R * 0.62, a)
    L.push(P(folha, tons.folha, { bisel: 1.1, contorno: 0.24, tom: TONS_DAS_FOLHAS[k % TONS_DAS_FOLHAS.length], textura: texDaFolhaDeRepolho(x, y, a), semente: sem + k, projeta: SOMBRA_DA_FOLHA_DO_REPOLHO }))
  }
  sombras.push(pino(x, y, g * REPOLHO.altura))
  L.push(P(comMeioEm(circulo(x, y, R * 0.62), x, y), tons.cabeca, { bisel: R * 0.5, contorno: 0.24, textura: texDeFolha, semente: sem + 10, projeta: SOMBRA_DA_FOLHA_DO_REPOLHO }))
  // As duas folhas que fecham a cabeça, cada uma mais clara, em meia-lua.
  L.push(P(comMeioEm(elipseGirada(x - R * 0.12, y - R * 0.06, R * 0.46, R * 0.38, fase), x, y), tons.cabeca, { bisel: 1.3, contorno: 0.2, tom: 1.05, textura: texDeFolha, semente: sem + 11 }))
  L.push(P(comMeioEm(elipseGirada(x + R * 0.05, y + R * 0.06, R * 0.24, R * 0.2, fase + 1), x, y), tons.cabeca, { bisel: 0.9, contorno: 0.2, tom: 1.1, semente: sem + 12 }))
}

/** O caixote de tábuas com dois repolhos colhidos, na faixa da direita: uma coluna baixa, o fundo afundado. */
function caixoteComRepolhos(o: Obra, madeira: MaterialDaPeca, x0: number, y0: number, x1: number, y1: number): void {
  const { L, P, sombras, g } = o
  const corpo = caixa(x0, y0, x1, y1, 0.8)
  sombras.push({ forma: corpo, z: g * 0.2 }, contato(corpo, 0.32))
  L.push(P(corpo, madeira, { eixo: Math.PI / 2, tabua: 0, bisel: 0.9, tom: 0.92, contorno: 0.3, semente: 7900 }))
  L.push(P(caixa(x0 + 1.5, y0 + 1.5, x1 - 1.5, y1 - 1.5, 0.4), madeira, { eixo: Math.PI / 2, tabua: (x1 - x0 - 3) / 3, bisel: 0.4, tom: 0.62, recesso: { k: 1.8, forca: 0.38 }, contorno: 0.2, semente: 7901 }))
  const cx = (x0 + x1) / 2
  const r = Math.min(x1 - x0, (y1 - y0) / 2) * 0.4
  for (const [k, [dx, dy]] of ([[-0.1, -0.25], [0.12, 0.24]] as const).entries()) {
    const x = cx + dx * (x1 - x0)
    const y = (y0 + y1) / 2 + dy * (y1 - y0)
    L.push(P(circulo(x, y, r), REPOLHO_VERDE.cabeca, { bisel: r * 0.5, contorno: 0.24, tom: 0.98, textura: texDeFolha, semente: 7910 + k, projeta: SOMBRA_DA_FOLHA_DO_REPOLHO }))
    L.push(P(elipseGirada(x - r * 0.15, y - r * 0.1, r * 0.66, r * 0.52, k), REPOLHO_VERDE.cabeca, { bisel: 1.1, contorno: 0.2, tom: 1.06, textura: texDeFolha, semente: 7912 + k }))
  }
}

const montarHortaDeRepolhos: MontarMovel = (c, cena) => {
  const { g, hw, hh, peca: P } = c
  const o: Obra = { L: cena.partes, sombras: cena.sombras, P, g, giro: c.giro }
  const { canteiro, terra } = canteiroDa(c)
  const leiras = Math.max(2, Math.round((terra.y1 - terra.y0) / (g * REPOLHO.fileira)))
  porTerra(o, terra, leiras)
  const leira = (terra.y1 - terra.y0) / leiras
  const passo = g * REPOLHO.passo
  for (let i = 0; i < leiras; i += 1) {
    const y = terra.y0 + (i + 0.5) * leira
    // As fileiras desencontradas: a de número ímpar começa meio passo adiante.
    const recuo = i % 2 === 0 ? passo * 0.5 : passo
    const n = Math.max(1, Math.floor((terra.x1 - terra.x0 - recuo - passo * 0.4) / passo) + 1)
    for (let j = 0; j < n; j += 1) {
      const sem = 7600 + i * 400 + j * 30
      const x = terra.x0 + recuo + j * passo + (hash(i, j, 815) - 0.5) * passo * 0.12
      plantarRepolho(o, x, y + (hash(j, i, 816) - 0.5) * leira * 0.12, hash(i * 31 + j, 7, 817) < CHANCE_DO_ROXO, sem)
    }
  }
  cercar(o, c.m.madeira, canteiro)
  const faixa = g * FAIXA_DA_DIREITA
  caixoteComRepolhos(o, c.m.madeira, hw - faixa + 1.6, hh * 0.08, hw - 1.2, hh * 0.08 + faixa * 1.25)
}

export const versoesDoHorta: VersoesDesenhadas = {
  aboboras: montarHortaDeAboboras,
  repolhos: montarHortaDeRepolhos,
}
