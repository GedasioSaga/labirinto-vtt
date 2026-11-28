/**
 * As VERSÕES da cela com grade (L01 do plano de arte por tema, 28/11/2026): a 1ª, Fechada, é o desenho de
 * `MONTADORES` (`../celaComGrade.ts`); as outras duas mexem só na PORTA da frente, entre os dois batentes:
 *
 * - **Aberta:** a folha girou nas dobradiças para dentro da cela, um pouco além do esquadro, e ficou parada junto do
 *   batente da esquerda, com as barras, o trilho rebitado e as dobradiças. O cadeado foi aberto e largado no chão, na
 *   frente da porta, com a alça solta. A sombra da folha risca as lajes de dentro, como a das grades do fundo.
 * - **Arrombada:** o cadeado aguentou (continua no batente da direita, como hoje); quem cedeu foram as dobradiças. A
 *   folha foi arrancada e caiu deitada nas lajes, um pouco torta: a barra do meio entortada, a da direita partida (o
 *   pedaço solto ao lado) e os restos das dobradiças nos montantes. No batente da esquerda ficam os nós com o toco
 *   torcido de cada folha de dobradiça.
 *
 * Tudo o mais é o desenho de hoje, peça por peça: a cena sai do desenho base e daqui saem só as peças da porta (pela
 * semente delas e pelo lugar das sombras). Na 3/4 a folha aberta sobe com a grade (cada barra uma coluna, o trilho um
 * tampo no alto, as dobradiças em pinos); a folha caída fica rente às lajes. Lugares de material: `grade` e `piso`.
 */
import type { VersoesDesenhadas } from '.'
import { montarCelaComGrade } from '../celaComGrade'
import { G, type ContextoDoMovel, type MontarMovel } from '../contexto'
import { barra, cadeia, caixa, capsula, dentroDe, elipse, poligono, uniao, type Forma, type Ponto } from '../formas'
import { contato, SOMBRA_X, SOMBRA_Y, type Cena, type CriarPeca, type MaterialDaPeca, type Peca, type Sombra } from '../motor'
import { comMeioEm } from '../varalDeBandeirinhas'

/**
 * As medidas da cela, copiadas de `../celaComGrade.ts` (lá não são exportadas): se a cela mudar, estas mudam junto,
 * e a folha das versões mostra na hora a porta velha aparecendo de novo.
 */
const MEIO_LADO_DE_PARTIDA = G
const MARGEM = 5
const ALTURA_DA_GRADE = 1.15
const ESPACO_DAS_BARRAS = 0.18
const RAIO_DA_BARRA = 0.95
const MEIO_TRILHO = 1.4
const MEIA_PORTA = 0.36
const FOLGA_DA_PORTA = 1.1
const DOBRADICAS: readonly number[] = [0.2, 0.74]
const RAIO_DO_REBITE = 0.72
const TOM_DO_TRILHO = 0.96
const TOM_DO_POSTE = 1.04
const TOM_DO_REBITE = 1.3
const BRILHO_DO_FERRO = 0.32
const SOMBRA_DA_BARRA = { suave: 1.1, forca: 0.3 } as const
const SOMBRA_DO_TRILHO = { suave: 2, forca: 0.24, solta: true } as const
const REJUNTE: MaterialDaPeca = { classe: 'liso', rgb: [0x55, 0x4f, 0x48] }
/** A sombra pintada nas lajes (a do chão do mapa fica por baixo delas), no escuro e na força das da grade de hoje. */
const SOMBRA_NO_PISO: MaterialDaPeca = { classe: 'liso', rgb: [0x1d, 0x1b, 0x19] }
const ALFA_DA_SOMBRA_NO_PISO = 0.3

/** As sementes das peças da porta no desenho base: as barras do 5º trecho, o trilho e os rebites dele, as dobradiças e o cadeado. */
const SEMENTES_DA_PORTA = { barras: [13660, 13700], trilho: 13624, rebites: 13634, dobradicas: [13480, 13484], cadeado: [13490, 13494] } as const

/** O quanto a folha aberta girou para dentro (passa um pouco do esquadro, encostando no ar perto do batente). */
const ABERTURA = (100 * Math.PI) / 180

interface MedidasDaCela {
  readonly k: number
  readonly X: number
  readonly Y: number
  readonly altura: number
  readonly espaco: number
  readonly porta: number
  readonly folga: number
  readonly rb: number
  readonly mt: number
}

function medidas(c: ContextoDoMovel): MedidasDaCela {
  const k = Math.min(c.hw, c.hh) / MEIO_LADO_DE_PARTIDA
  return {
    k,
    X: c.hw - MARGEM * k,
    Y: c.hh - MARGEM * k,
    altura: ALTURA_DA_GRADE * G * k,
    espaco: ESPACO_DAS_BARRAS * G * k,
    porta: MEIA_PORTA * G * k,
    folga: FOLGA_DA_PORTA * k,
    rb: Math.max(0.6, RAIO_DA_BARRA * k),
    mt: MEIO_TRILHO * k,
  }
}

function entre(s: number, faixa: readonly [number, number]): boolean {
  return s >= faixa[0] && s < faixa[1]
}

function ehDaPorta(semente: number, tirarOCadeado: boolean): boolean {
  const S = SEMENTES_DA_PORTA
  return entre(semente, S.barras) || semente === S.trilho || semente === S.rebites || entre(semente, S.dobradicas) || (tirarOCadeado && entre(semente, S.cadeado))
}

/** A sombra é da porta? As barras dela (colunas entre os batentes), o trilho dela e os pinos das dobradiças e do cadeado. */
function sombraDaPorta(s: Sombra, m: MedidasDaCela, tirarOCadeado: boolean): boolean {
  const cx = (s.forma.b[0] + s.forma.b[2]) / 2
  const cy = (s.forma.b[1] + s.forma.b[3]) / 2
  if (Math.abs(cy - m.Y) > 4 * m.k) return false
  if (s.solta !== true) return s.z > 0 && Math.abs(cx) < m.porta - 0.5 * m.k
  if (Math.abs(cx) < m.porta - m.k) return true
  if (cx < 0) return Math.abs(cx + m.porta) < 3 * m.k
  return tirarOCadeado && Math.abs(cx - m.porta) < m.k
}

/** A cela de hoje sem a porta (e sem o cadeado, se `tirarOCadeado`): o desenho base com as peças dela de fora. */
function celaSemAPorta(c: ContextoDoMovel, cena: Cena, m: MedidasDaCela, tirarOCadeado: boolean): void {
  const tiradas = new Set<Peca>()
  const P: CriarPeca = (forma, mat, o) => {
    const peca = c.peca(forma, mat, o)
    if (o?.semente !== undefined && ehDaPorta(o.semente, tirarOCadeado)) tiradas.add(peca)
    return peca
  }
  const base: Cena = { partes: [], sombras: [] }
  montarCelaComGrade({ ...c, peca: P }, base)
  if (base.corDoPiso !== undefined) cena.corDoPiso = base.corDoPiso
  cena.partes.push(...base.partes.filter((p) => !tiradas.has(p)))
  cena.sombras.push(...base.sombras.filter((s) => !sombraDaPorta(s, m, tirarOCadeado)))
}

/** O pino da 3/4: um ponto sem tinta que sobe a peça presa a ele até `z`. */
function pino(cena: Cena, x: number, y: number, z: number): void {
  cena.sombras.push({ forma: elipse(x, y, 0.1, 0.1), z, solta: true, forca: 0 })
}

/** A sombra pintada nas lajes de dentro, recortada no piso. */
function sombraNoPiso(P: CriarPeca, L: Peca[], forma: Forma, m: MedidasDaCela, suave: number, semente: number): void {
  const f = dentroDe(forma, caixa(-m.X, -m.Y, m.X, m.Y, 0))
  if (f.b[2] - f.b[0] < 0.5 || f.b[3] - f.b[1] < 0.5) return
  L.push(P(f, SOMBRA_NO_PISO, { bisel: 0, contorno: 0, alfa: ALFA_DA_SOMBRA_NO_PISO, suave, semente }))
}

/** A folha aberta: girou `ABERTURA` para dentro no eixo das dobradiças, no batente da esquerda. */
function folhaAberta(c: ContextoDoMovel, cena: Cena, m: MedidasDaCela): void {
  const P = c.peca
  const ferro = c.m.grade
  const L = cena.partes
  const { k } = m
  const ux = Math.cos(-ABERTURA)
  const uy = Math.sin(-ABERTURA)
  const hx = -m.porta
  const hy = m.Y
  const comprido = 2 * m.porta
  const ponto = (t: number): Ponto => [hx + ux * t, hy + uy * t]
  const n = Math.max(2, Math.round(comprido / m.espaco))
  const barras: Ponto[] = Array.from({ length: n - 1 }, (_, i) => ponto((comprido * (i + 1)) / n))
  // Os montantes da folha (no lugar dos batentes, quando fechada): o do eixo e o da ponta, mais grossos.
  const montantes: Ponto[] = [ponto(m.folga + m.rb), ponto(comprido - m.folga)]
  const [sx, sy] = [SOMBRA_X * m.altura, SOMBRA_Y * m.altura]
  // A sombra da folha nas lajes: cada barra e o trilho, deitados para baixo à direita.
  ;[...barras, ...montantes].forEach(([x, y], i) => sombraNoPiso(P, L, capsula(x, y, x + sx, y + sy, m.rb * 1.1), m, 1.1, 14000 + i))
  const [ax, ay] = ponto(m.folga)
  const [bx, by] = ponto(comprido - m.folga * 0.4)
  sombraNoPiso(P, L, barra(ax + sx, ay + sy, bx + sx, by + sy, 2 * m.mt), m, 2, 14010)
  barras.forEach(([x, y], i) => {
    const forma = elipse(x, y, m.rb, m.rb)
    cena.sombras.push({ forma, z: m.altura, ...SOMBRA_DA_BARRA })
    L.push(P(forma, ferro, { tabua: 0, bisel: m.rb, tom: TOM_DO_POSTE, metal: BRILHO_DO_FERRO, contorno: 0.24, semente: 14020 + i }))
  })
  montantes.forEach(([x, y], i) => {
    const r = m.rb * 1.3
    const forma = elipse(x, y, r, r)
    cena.sombras.push({ forma, z: m.altura, ...SOMBRA_DA_BARRA })
    L.push(P(forma, ferro, { tabua: 0, bisel: r, tom: TOM_DO_POSTE, metal: BRILHO_DO_FERRO, contorno: 0.26, semente: 14030 + i }))
  })
  // O trilho de cima da folha (tampo da 3/4), com a caixa de pintura num vão entre duas barras, e os rebites.
  const trilho = barra(ax, ay, bx, by, 2 * m.mt)
  cena.sombras.push({ forma: trilho, z: m.altura, ...SOMBRA_DO_TRILHO })
  const [vx, vy] = ponto(comprido / n / 2)
  L.push(P(comMeioEm(trilho, vx, vy), ferro, { tabua: 0, bisel: m.mt * 0.9, tom: TOM_DO_TRILHO, metal: BRILHO_DO_FERRO, contorno: 0.3, semente: 14040 }))
  const cabecas = [...barras, ...montantes].map(([x, y]) => elipse(x, y, RAIO_DO_REBITE * k, RAIO_DO_REBITE * k)).reduce(uniao)
  L.push(P(comMeioEm(cabecas, vx, vy), ferro, { tabua: 0, bisel: RAIO_DO_REBITE * k, tom: TOM_DO_REBITE, metal: 0.5, contorno: 0.22, semente: 14041 }))
  // As dobradiças: o nó no batente e a folha dela correndo pela porta aberta, cada par num pino da altura dele.
  DOBRADICAS.forEach((fz, i) => {
    const px = hx + (2.4 + 0.6 * i) * k
    const py = hy - 2.4 * k
    pino(cena, px, py, m.altura * fz)
    const folha = barra(hx - ux * 0.4 * k, hy - uy * 0.4 * k, hx + ux * 7 * k, hy + uy * 7 * k, 1.1 * k)
    const junta = elipse(hx - 0.8 * k, hy, 1.45 * k, 1.45 * k)
    L.push(P(comMeioEm(folha, px, py), ferro, { tabua: 0, bisel: 0.45 * k, tom: 0.94, metal: BRILHO_DO_FERRO, contorno: 0.28, semente: 14050 + i * 2 }))
    L.push(P(comMeioEm(junta, px, py), ferro, { tabua: 0, bisel: 1.1 * k, tom: 1.16, metal: 0.45, contorno: 0.28, semente: 14051 + i * 2 }))
  })
}

/** O ponto (x, y) do desenho local, girado `angulo` e posto em (cx, cy). */
function posto(x: number, y: number, cx: number, cy: number, angulo: number): Ponto {
  const co = Math.cos(angulo)
  const si = Math.sin(angulo)
  return [cx + x * co - y * si, cy + x * si + y * co]
}

/** O cadeado aberto largado no chão, na frente da porta: o corpo deitado, o buraco da chave e a alça solta de um lado. */
function cadeadoNoChao(c: ContextoDoMovel, cena: Cena, m: MedidasDaCela): void {
  const P = c.peca
  const ferro = c.m.grade
  const { k } = m
  const cx = -0.25 * m.porta
  const cy = m.Y + 3.1 * k
  const a = 0.42
  const p = (x: number, y: number): Ponto => posto(x * k, y * k, cx, cy, a)
  const [c0, c1] = [p(-1.9, 0), p(1.9, 0)]
  const corpo = barra(c0[0], c0[1], c1[0], c1[1], 2.6 * k)
  cena.sombras.push(contato(corpo, 0.32))
  const alca = cadeia([p(-1.1, -1), p(-1.1, -2.3), p(-0.2, -3.1), p(0.9, -2.9), p(1.6, -2.2)], 0.42 * k)
  cena.partes.push(P(alca, ferro, { tabua: 0, bisel: 0.42 * k, tom: 1.2, metal: 0.5, contorno: 0.26, projeta: { dist: 0.5 * k, forca: 0.3 }, semente: 14060 }))
  cena.partes.push(P(corpo, ferro, { tabua: 0, bisel: 1 * k, tom: 0.88, metal: 0.4, contorno: 0.3, semente: 14061 }))
  const [fx, fy] = p(0.2, 0.2)
  cena.partes.push(P(elipse(fx, fy, 0.5 * k, 0.5 * k), REJUNTE, { tabua: 0, bisel: 0, tom: 0.6, contorno: 0, semente: 14062 }))
}

/** O toco de cada dobradiça arrancada: o nó no batente da esquerda e a ponta da folha dela, torcida para fora. */
function dobradicasArrancadas(c: ContextoDoMovel, cena: Cena, m: MedidasDaCela): void {
  const P = c.peca
  const ferro = c.m.grade
  const { k, porta, Y } = m
  DOBRADICAS.forEach((fz, i) => {
    const px = -porta + (1.4 + 0.6 * i) * k
    const py = Y + 1.75 * k
    pino(cena, px, py, m.altura * fz)
    const toco = poligono([
      [-porta - 0.4 * k, Y + 1.3 * k],
      [-porta + 2.4 * k, Y + 1.5 * k],
      [-porta + 3.3 * k, Y + 2.9 * k],
      [-porta + 2.1 * k, Y + 2.5 * k],
      [-porta - 0.4 * k, Y + 2.4 * k],
    ])
    const junta = elipse(-porta - 0.8 * k, Y + 2 * k, 1.45 * k, 1.45 * k)
    cena.partes.push(P(comMeioEm(toco, px, py), ferro, { tabua: 0, bisel: 0.45 * k, tom: 0.9, metal: BRILHO_DO_FERRO, contorno: 0.3, semente: 14070 + i * 2 }))
    cena.partes.push(P(comMeioEm(junta, px, py), ferro, { tabua: 0, bisel: 1.1 * k, tom: 1.1, metal: 0.45, contorno: 0.28, semente: 14071 + i * 2 }))
  })
}

/**
 * A folha arrancada, deitada nas lajes de dentro e um pouco torta. Medidas da folha (frações dela e px de partida):
 * o lugar do pé, o giro, os montantes, as travessas e as barras (a do meio entortada, a da direita partida).
 */
const FOLHA_CAIDA = { peX: -4, peY: -5, giro: 0.2, montante: 2.2, travessa: 2.6, travessas: [0.035, 0.5, 0.965], barras: [-0.25, 0, 0.25], torta: 3.6, partida: 0.36 } as const

function folhaCaida(c: ContextoDoMovel, cena: Cena, m: MedidasDaCela): void {
  const P = c.peca
  const ferro = c.m.grade
  const L = cena.partes
  const { k } = m
  const F = FOLHA_CAIDA
  const largura = 2 * (m.porta - m.folga)
  const comprido = m.altura * 0.96
  const ox = F.peX * k
  const oy = m.Y + F.peY * k
  // (s, t): s de um montante ao outro (meia largura para cada lado), t do pé (0) à cabeça (`comprido`).
  const em = (s: number, t: number): Ponto => posto(s, -t, ox, oy, F.giro)
  const sombra = { dist: 0.9 * k, forca: 0.36 } as const
  const lisa = { tabua: 0, metal: BRILHO_DO_FERRO, contorno: 0.28, projeta: sombra } as const
  const meia = largura / 2
  // As barras primeiro (as travessas são chatas e pregadas por cima delas).
  const t0 = comprido * F.travessas[0]
  const t1 = comprido * F.travessas[2]
  F.barras.forEach((f, i) => {
    const s = f * largura
    let forma: Forma
    if (i === 1) {
      forma = cadeia([em(s, t0), em(s + 0.4 * F.torta * k, comprido * 0.32), em(s + F.torta * k, comprido * 0.5), em(s + 0.5 * F.torta * k, comprido * 0.68), em(s, t1)], m.rb)
    } else if (i === 2) {
      const [a, b] = [em(s, t0), em(s + 0.3 * k, comprido * F.partida)]
      forma = capsula(a[0], a[1], b[0], b[1], m.rb)
    } else {
      const [a, b] = [em(s, t0), em(s, t1)]
      forma = capsula(a[0], a[1], b[0], b[1], m.rb)
    }
    L.push(P(forma, ferro, { ...lisa, bisel: m.rb, tom: TOM_DO_POSTE, semente: 14080 + i }))
  })
  // O pedaço partido da barra da direita, largado ao lado da folha, e o toco dele que ficou preso na travessa de cima.
  const [p0, p1] = [em(meia + 3.4 * k, comprido * 0.5), em(meia + 6.2 * k, comprido * 0.86)]
  L.push(P(capsula(p0[0], p0[1], p1[0], p1[1], m.rb), ferro, { ...lisa, bisel: m.rb, tom: 0.98, semente: 14083 }))
  const [q0, q1] = [em(0.25 * largura, t1), em(0.25 * largura - 0.4 * k, comprido * 0.88)]
  L.push(P(capsula(q0[0], q0[1], q1[0], q1[1], m.rb), ferro, { ...lisa, bisel: m.rb, tom: 0.98, semente: 14084 }))
  // Os montantes, de ponta a ponta, e as três travessas por cima deles.
  for (const lado of [-1, 1]) {
    const s = lado * (meia - F.montante * 0.5 * k)
    const [a, b] = [em(s, 0), em(s, comprido)]
    L.push(P(barra(a[0], a[1], b[0], b[1], F.montante * k), ferro, { ...lisa, bisel: 0.8 * k, tom: 0.92, semente: 14085 + (lado > 0 ? 1 : 0) }))
  }
  F.travessas.forEach((f, i) => {
    const t = comprido * f
    const [a, b] = [em(-meia, t), em(meia, t)]
    L.push(P(barra(a[0], a[1], b[0], b[1], F.travessa * k), ferro, { ...lisa, bisel: 0.9 * k, tom: TOM_DO_TRILHO, semente: 14090 + i }))
    const cabecas = [-meia + F.montante * 0.5 * k, ...F.barras.map((x) => x * largura), meia - F.montante * 0.5 * k].map((s) => {
      const [x, y] = em(s, t)
      return elipse(x, y, RAIO_DO_REBITE * k, RAIO_DO_REBITE * k)
    })
    L.push(P(cabecas.reduce(uniao), ferro, { tabua: 0, bisel: RAIO_DO_REBITE * k, tom: TOM_DO_REBITE, metal: 0.5, contorno: 0.22, semente: 14095 + i }))
  })
  // Os restos das folhas das dobradiças, arrancados junto com a porta, no montante da esquerda.
  DOBRADICAS.forEach((fz, i) => {
    const t = comprido * fz
    const [a, b] = [em(-meia - 1.8 * k, t + 0.6 * k), em(-meia + 3.6 * k, t)]
    L.push(P(barra(a[0], a[1], b[0], b[1], 1.2 * k), ferro, { ...lisa, bisel: 0.45 * k, tom: 0.9, semente: 14100 + i }))
  })
}

const montarCelaAberta: MontarMovel = (c, cena) => {
  const m = medidas(c)
  celaSemAPorta(c, cena, m, true)
  folhaAberta(c, cena, m)
  cadeadoNoChao(c, cena, m)
}

const montarCelaArrombada: MontarMovel = (c, cena) => {
  const m = medidas(c)
  celaSemAPorta(c, cena, m, false)
  folhaCaida(c, cena, m)
  dobradicasArrancadas(c, cena, m)
}

export const versoesDoCelaComGrade: VersoesDesenhadas = {
  aberta: montarCelaAberta,
  arrombada: montarCelaArrombada,
}
