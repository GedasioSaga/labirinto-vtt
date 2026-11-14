/**
 * AS DUAS VISTAS das construções do parque (lote L19 de 14/11/2026: o carrossel, a tenda de circo, a casa na
 * árvore, a pérgola com trepadeira e o portal torii). Não é um objeto: não tem registro nem ficha.
 *
 * A vista de cima é de cima de verdade e a 3/4 é desenhada de frente, peça por peça, com a máquina da tenda de
 * adivinha (`tendaDeAdivinha.ts`, a do gancho com carne): cada peça é de uma vista só. A de cima nasce no lugar
 * (`dy` zero) e some quando a 3/4 a sobe; a de frente nasce deslocada a altura da ÂNCORA dela (uma sombra solta
 * de força zero num ponto do chão, que a 3/4 faz estrutura) e só aparece quando a 3/4 a traz de volta. Perfil da
 * 3/4 de quem usa: `{ modo: 'derivado', espessura: 0 }`, o da tenda de adivinha.
 *
 * Por cima da máquina, um PALCO de três dimensões pequeno: o desenho diz as faces planas, as formas deitadas, os
 * costados de cilindro e as figuras de pé no referencial do objeto (x e y no chão, y para o sul, z para cima, em
 * px do protótipo), e o palco põe cada coisa nas duas vistas. A projeção da 3/4 é a do motor: o ponto (x, y) a z
 * de altura vai para (x, y - z) na tela. Daí as regras:
 * - na 3/4 só se vê a face virada para quem olha (a normal com y + z > 0: o tampo, a face do sul e a água do
 *   norte que não passa de 45 graus); as de leste e de oeste ficam de quina e não se pintam;
 * - de cima só se vê a face virada para cima;
 * - a ordem de pintura é a da profundidade: de cima, a altura; na 3/4, y + z (o que está mais ao sul ou mais alto
 *   fica na frente), com um ajuste por peça onde a conta do meio erra;
 * - o tom de cada face sai da normal dela pela luz do motor (de cima à esquerda): o tampo fica em 1, a face do sul
 *   perto do tom da frente da 3/4 (0,74), e as águas de um telhado ficam claras do lado da luz nas duas vistas.
 *
 * GIRO: o quarto de volta do objeto chega só à 3/4 (a de cima é sempre sem giro). O palco gira os pontos para a
 * tela antes de projetar e devolve as peças desgiradas (a volta da 3/4 as põe onde foram desenhadas), como a tenda
 * de adivinha. Todas as sombras são de chão (z zero): sombra com altura viraria estrutura na 3/4 e subiria peça.
 */
import { capsula, poligono, type Caixa, type Forma, type Ponto } from './formas'
import { contato, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type Cena, type CriarPeca, type MaterialDaPeca, type OpcoesDaPeca, type Textura } from './motor'
import { QUARTO } from './contexto'

/** Ponto no referencial do objeto: x e y no chão (y para o sul) e z de altura, em px do protótipo. */
export type P3 = readonly [number, number, number]

// ---------- o giro (o de `tresQuartos.ts`) ----------

/** Os quartos de volta do giro do objeto (0 a 3). */
export function quartosDoGiro(giro: number): number {
  return ((Math.round(giro / 90) % 4) + 4) % 4
}

/** O ponto girado `q` quartos de volta no sentido da tela (y para baixo: horário). */
export function girarPonto(x: number, y: number, q: number): Ponto {
  return q === 1 ? [-y, x] : q === 2 ? [-x, -y] : q === 3 ? [y, -x] : [x, y]
}

/** A forma girada `q` quartos de volta no sentido da tela. */
export function girarForma(f: Forma, q: number): Forma {
  if (q === 0) return f
  const b = f.b
  const girada: Caixa = q === 1 ? [-b[3], b[0], -b[1], b[2]] : q === 2 ? [-b[2], -b[3], -b[0], -b[1]] : [b[1], -b[2], b[3], -b[0]]
  const volta = 4 - q
  return {
    b: girada,
    d: (x, y) => {
      const [mx, my] = girarPonto(x, y, volta)
      return f.d(mx, my)
    },
  }
}

/** A forma andada (dx, dy). */
export function deslocada(f: Forma, dx: number, dy: number): Forma {
  return { b: [f.b[0] + dx, f.b[1] + dy, f.b[2] + dx, f.b[3] + dy], d: (x, y) => f.d(x - dx, y - dy) }
}

/** O casco convexo dos pontos (cadeia monótona), no sentido anti-horário. */
export function casco(pontos: readonly Ponto[]): Ponto[] {
  const p = [...pontos].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cruz = (o: Ponto, a: Ponto, b: Ponto): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const metade = (lista: readonly Ponto[]): Ponto[] => {
    const h: Ponto[] = []
    for (const ponto of lista) {
      while (h.length >= 2 && cruz(h[h.length - 2], h[h.length - 1], ponto) <= 0) h.pop()
      h.push(ponto)
    }
    return h
  }
  const baixo = metade(p)
  const cima = metade([...p].reverse())
  return [...baixo.slice(0, -1), ...cima.slice(0, -1)]
}

// ---------- a peça de uma vista só e a âncora (as da tenda de adivinha) ----------

/**
 * A peça só é pintada NO LUGAR em que foi desenhada (`dy` zero). A 3/4 sobe cada peça mexendo no `dy` dela: a da
 * vista de cima (nasce com `dy` zero) some quando sobe, e a de frente (nasce deslocada a altura da âncora) aparece
 * quando a 3/4 a traz de volta. Só vale sem giro.
 */
function soNoLugar(textura: Textura | null): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (p.dy !== 0) {
      s[5] = 0
      return
    }
    if (textura !== null) textura(u, v, x, y, p, s, escala)
  }
}

/** A mesma forma com a caixa de pintura centrada em (cx, cy): é o meio da caixa que a 3/4 lê para achar a âncora. */
function presa(forma: Forma, cx: number, cy: number): Forma {
  const mx = Math.max(cx - forma.b[0], forma.b[2] - cx)
  const my = Math.max(cy - forma.b[1], forma.b[3] - cy)
  return { b: [cx - mx, cy - my, cx + mx, cy + my], d: (x, y) => forma.d(x, y) }
}

/** A âncora só contém o próprio ponto, com esta folga de conta; fora dele está longe de tudo, e nada dela é pintado. */
const RAIO_DA_ANCORA = 1e-6
const FORA_DA_ANCORA = 1e3
const BORDA_DA_ANCORA = 0.05
/** Cada grupo aberto fica isto mais ao sul que o anterior: na mesma base, a 3/4 os pinta na ordem em que foram abertos. */
const PASSO_DA_ORDEM = 1e-3
/** O que só aparece de cima sobe quase nada na 3/4: o bastante para sair do lugar e sumir. */
const QUASE_NADA = 0.02
/** A base das âncoras da 3/4 fica isto ao sul do meio mais ao sul das peças de frente (a subida tem de ser positiva). */
const FOLGA_DA_BASE = 2

/** A âncora no ponto (x, y) do chão da pegada já girada; `q` = os quartos de volta que a 3/4 ainda vai dar na cena. */
function ancorar(cena: Cena, q: number, x: number, y: number, z: number): void {
  const ponto: Forma = {
    b: [x, y, x, y],
    d: (px, py) => (Math.abs(px - x) < RAIO_DA_ANCORA && Math.abs(py - y) < RAIO_DA_ANCORA ? -1 : FORA_DA_ANCORA),
  }
  cena.sombras.push({ forma: girarForma(ponto, (4 - q) % 4), z, solta: true, forca: 0, suave: BORDA_DA_ANCORA })
}

/** As opções de uma peça de uma vista só: sem deslocamento nem sombra própria (a sombra cairia na outra vista). */
export type OpcoesDaVista = Omit<OpcoesDaPeca, 'dx' | 'dy' | 'projeta' | 'polar' | 'arco' | 'curvaY'>

/** A peça da vista de cima, presa a uma âncora no meio da própria caixa (a caixa de pintura fica justa). */
function porDeCima(P: CriarPeca, cena: Cena, forma: Forma, mat: MaterialDaPeca, o: OpcoesDaVista): void {
  const x = (forma.b[0] + forma.b[2]) / 2
  const y = (forma.b[1] + forma.b[3]) / 2
  ancorar(cena, 0, x, y, QUASE_NADA)
  cena.partes.push(P(presa(forma, x, y), mat, { ...o, textura: soNoLugar(o.textura ?? texturaDaClasse(mat.classe)) }))
}

/**
 * A peça da 3/4, já na tela (com a pegada girada): a âncora fica em (x do meio, `chao`), e a peça nasce deslocada
 * a subida. Girada, a cena só serve à 3/4: a peça sai desgirada (a forma, o veio e o ponto que a textura lê) e a
 * volta da 3/4 a põe como foi desenhada.
 */
function porDeFrente(P: CriarPeca, cena: Cena, q: number, chao: number, forma: Forma, mat: MaterialDaPeca, o: OpcoesDaVista): void {
  const x = (forma.b[0] + forma.b[2]) / 2
  const meio = (forma.b[1] + forma.b[3]) / 2
  const z = chao - meio
  ancorar(cena, q, x, chao, z)
  const noMeio = presa(forma, x, meio)
  if (q === 0) {
    cena.partes.push(P(noMeio, mat, { ...o, dy: z, textura: soNoLugar(o.textura ?? texturaDaClasse(mat.classe)) }))
    return
  }
  const volta = (4 - q) % 4
  const [dx, dy] = girarPonto(0, z, volta)
  const textura = o.textura
  cena.partes.push(
    P(girarForma(noMeio, volta), mat, {
      ...o,
      dx,
      dy,
      eixo: (o.eixo ?? 0) - q * QUARTO,
      textura:
        textura === undefined
          ? undefined
          : (u, v, tx, ty, p, s, escala) => {
              const [sx, sy] = girarPonto(tx, ty, q)
              textura(u, v, sx, sy, p, s, escala)
            },
    }),
  )
}

// ---------- a luz das faces ----------

/** A luz do pintor (`motor.ts`), de cima à esquerda. */
const LUZ_X = -0.62
const LUZ_Y = -0.48
const LUZ_Z = 0.62
/** Quanto o tom da face segue a luz: o tampo fica em 1, a face do sul em ~0,69, a de leste em ~0,65. */
export const LADO_DA_FACE = 0.28
/** A face de quina (a normal quase deitada para quem olha) não se pinta: sairia um fio. */
const QUINA = 0.06
/** O costado de cilindro visto de frente: mais claro do lado da luz (a esquerda), mais escuro do outro. */
const LADO_DO_COSTADO = 0.2

/** O tom da face pela normal (de comprimento 1). */
export function tomDaNormal(nx: number, ny: number, nz: number, forca = LADO_DA_FACE): number {
  return 1 + forca * (nx * LUZ_X + ny * LUZ_Y + nz * LUZ_Z - LUZ_Z)
}

/** A textura do costado com a luz do lado: clara à esquerda do eixo `cx`, escura à direita. */
function costadoComLuz(cx: number, r: number, base: Textura | null): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (base !== null) base(u, v, x, y, p, s, escala)
    const f = 1 - LADO_DO_COSTADO * Math.max(-1, Math.min(1, (x - cx) / r))
    s[0] *= f
    s[1] *= f
    s[2] *= f
  }
}

// ---------- o palco ----------

/** O ajuste de uma coisa do palco: o ponto de dentro do sólido (vira a normal para fora), a ordem e a luz. */
export interface AjusteDoPalco {
  /** Um ponto de dentro do sólido, no referencial do objeto: a normal da face aponta para longe dele. Padrão: o chão no meio. */
  readonly dentro?: P3
  /** Somado à profundidade na 3/4 (px): o que tem de passar na frente das vizinhas sem estar mais ao sul. */
  readonly adiante?: number
  /** Somado à altura de cima (px): o que tem de ficar por cima de cima sem estar mais alto. */
  readonly acima?: number
  /** Quanto o tom segue a normal (0 = só o tom da opção). Padrão: `LADO_DA_FACE`. */
  readonly luz?: number
}

export interface Palco {
  /** Os quartos de volta que a 3/4 ainda vai dar (sempre 0 na vista de cima). */
  readonly q: number
  /** O ponto do chão do objeto na tela (girado). */
  noChao(x: number, y: number): Ponto
  /** O ponto do objeto na tela da 3/4 (girado e subido z). */
  naTela(p: P3): Ponto
  /** Peça só da vista de cima, no referencial do objeto; `z` = a altura (a mais alta fica por cima). */
  deCima(forma: Forma, mat: MaterialDaPeca, o: OpcoesDaVista, z: number): void
  /** Peça só da 3/4, já na tela; `fundo` = a profundidade (y + z do lugar dela, no objeto girado). */
  deFrente(forma: Forma, mat: MaterialDaPeca, o: OpcoesDaVista, fundo: number): void
  /** Face plana pelos pontos: entra de cima se virada para cima e na 3/4 se virada para quem olha. */
  face(pontos: readonly P3[], mat: MaterialDaPeca, o?: OpcoesDaVista, a?: AjusteDoPalco): void
  /** Forma deitada na altura z (o tampo, o disco, a laje): de cima ela mesma; na 3/4 girada e subida. */
  plano(forma: Forma, z: number, mat: MaterialDaPeca, o?: OpcoesDaVista, a?: AjusteDoPalco): void
  /** O costado de um cilindro de pé (o poste, o tronco, o tambor), do pé ao alto: só na 3/4 (de cima, o topo é um `plano`). */
  costado(x: number, y: number, r: number, z0: number, z1: number, mat: MaterialDaPeca, o?: OpcoesDaVista, a?: AjusteDoPalco): void
  /** A sombra no chão do que vai do pé às alturas dos pontos: o casco dos pontos caídos para baixo à direita na tela. */
  sombra(pontos: readonly P3[], forca: number, suave: number): void
  /** O contato no pé (forma no referencial do objeto). */
  contato(forma: Forma, forca: number): void
  /** Põe tudo na cena, cada vista na sua ordem. */
  fechar(): void
}

interface NaFila {
  readonly forma: Forma
  readonly mat: MaterialDaPeca
  readonly o: OpcoesDaVista
  readonly fundo: number
  readonly i: number
}

function porOrdem(a: NaFila, b: NaFila): number {
  return a.fundo - b.fundo || a.i - b.i
}

export function novoPalco(P: CriarPeca, cena: Cena, giro: number): Palco {
  const q = quartosDoGiro(giro)
  const volta = (4 - q) % 4
  const deCima: NaFila[] = []
  const deFrente: NaFila[] = []
  let n = 0
  const naTela = (p: P3): Ponto => {
    const [x, y] = girarPonto(p[0], p[1], q)
    return [x, y - p[2]]
  }
  return {
    q,
    noChao: (x, y) => girarPonto(x, y, q),
    naTela,
    deCima(forma, mat, o, z) {
      if (q === 0) deCima.push({ forma, mat, o, fundo: z, i: (n += 1) })
    },
    deFrente(forma, mat, o, fundo) {
      deFrente.push({ forma, mat, o, fundo, i: (n += 1) })
    },
    face(pontos, mat, o = {}, a = {}) {
      const g = pontos.map((p): P3 => {
        const [x, y] = girarPonto(p[0], p[1], q)
        return [x, y, p[2]]
      })
      // A normal de Newell (vale para o polígono quase plano) e o meio da face.
      let nx = 0
      let ny = 0
      let nz = 0
      let mx = 0
      let my = 0
      let mz = 0
      for (let i = 0; i < g.length; i += 1) {
        const p = g[i]
        const s = g[(i + 1) % g.length]
        nx += (p[1] - s[1]) * (p[2] + s[2])
        ny += (p[2] - s[2]) * (p[0] + s[0])
        nz += (p[0] - s[0]) * (p[1] + s[1])
        mx += p[0] / g.length
        my += p[1] / g.length
        mz += p[2] / g.length
      }
      const l = Math.hypot(nx, ny, nz)
      if (l < 1e-9) return
      const dentro = a.dentro ?? [0, 0, 0]
      const [dx, dy] = girarPonto(dentro[0], dentro[1], q)
      const sinal = nx * (mx - dx) + ny * (my - dy) + nz * (mz - dentro[2]) < 0 ? -1 / l : 1 / l
      nx *= sinal
      ny *= sinal
      nz *= sinal
      const vista: OpcoesDaVista = { ...o, tom: (o.tom ?? 1) * tomDaNormal(nx, ny, nz, a.luz ?? LADO_DA_FACE) }
      if (q === 0 && nz > QUINA) deCima.push({ forma: poligono(g.map((p): Ponto => [p[0], p[1]])), mat, o: vista, fundo: mz + (a.acima ?? 0), i: (n += 1) })
      if (ny + nz > QUINA) deFrente.push({ forma: poligono(g.map((p): Ponto => [p[0], p[1] - p[2]])), mat, o: vista, fundo: my + mz + (a.adiante ?? 0), i: (n += 1) })
    },
    plano(forma, z, mat, o = {}, a = {}) {
      if (q === 0) deCima.push({ forma, mat, o, fundo: z + (a.acima ?? 0), i: (n += 1) })
      const [, gy] = girarPonto((forma.b[0] + forma.b[2]) / 2, (forma.b[1] + forma.b[3]) / 2, q)
      deFrente.push({ forma: deslocada(girarForma(forma, q), 0, -z), mat, o: { ...o, eixo: (o.eixo ?? 0) + q * QUARTO }, fundo: gy + z + (a.adiante ?? 0), i: (n += 1) })
    },
    costado(x, y, r, z0, z1, mat, o = {}, a = {}) {
      const [gx, gy] = girarPonto(x, y, q)
      const base = o.textura ?? texturaDaClasse(mat.classe)
      deFrente.push({
        forma: capsula(gx, gy - z0, gx, gy - z1, r),
        mat,
        o: { eixo: QUARTO, ...o, textura: costadoComLuz(gx, r, base) },
        fundo: gy + r + (z0 + z1) / 2 + (a.adiante ?? 0),
        i: (n += 1),
      })
    },
    sombra(pontos, forca, suave) {
      const caidos = pontos.map((p): Ponto => {
        const [x, y] = girarPonto(p[0], p[1], q)
        return [x + SOMBRA_X * p[2], y + SOMBRA_Y * p[2]]
      })
      cena.sombras.push({ forma: girarForma(poligono(casco(caidos)), volta), z: 0, forca, suave })
    },
    contato(forma, forca) {
      cena.sombras.push(contato(forma, forca))
    },
    fechar() {
      // De cima: da mais baixa para a mais alta (a ordem das partes é a de baixo para cima).
      for (const item of [...deCima].sort(porOrdem)) porDeCima(P, cena, item.forma, item.mat, item.o)
      if (deFrente.length === 0) return
      // Na 3/4: do fundo para a frente, todas as âncoras na mesma base (a 3/4 pinta na ordem em que foram abertas).
      let base = -Infinity
      for (const item of deFrente) base = Math.max(base, (item.forma.b[1] + item.forma.b[3]) / 2)
      base += FOLGA_DA_BASE
      ;[...deFrente].sort(porOrdem).forEach((item, k) => porDeFrente(P, cena, q, base + k * PASSO_DA_ORDEM, item.forma, item.mat, item.o))
    },
  }
}

/**
 * Um BLOCO reto (a viga, a tábua, a estaca quadrada), no referencial do objeto: a face de cima e as quatro de pé; o
 * palco mostra as que se veem. As de leste e oeste levam o veio de través.
 */
export function bloco(palco: Palco, x0: number, y0: number, x1: number, y1: number, z0: number, z1: number, mat: MaterialDaPeca, o: OpcoesDaVista, a: AjusteDoPalco = {}): void {
  const ajuste: AjusteDoPalco = { ...a, dentro: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2] }
  const deTraves: OpcoesDaVista = { ...o, eixo: (o.eixo ?? 0) + QUARTO }
  palco.face([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], mat, o, ajuste)
  palco.face([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], mat, o, ajuste)
  palco.face([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], mat, o, ajuste)
  palco.face([[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], mat, deTraves, ajuste)
  palco.face([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], mat, deTraves, ajuste)
}

/**
 * A SANEFA do beiral: os panos que pendem do beiral pelos pontos do contorno (fechado), cada um uma face de pé de
 * `faixa` px com um bico recortado embaixo, nas cores alternadas. Só a 3/4 a vê (de cima ela fica de quina).
 */
export function sanefa(palco: Palco, contorno: readonly Ponto[], z: number, faixa: number, bico: number, cores: readonly MaterialDaPeca[], o: OpcoesDaVista, dentro: P3): void {
  const n = contorno.length
  for (let i = 0; i < n; i += 1) {
    const [ax, ay] = contorno[i]
    const [bx, by] = contorno[(i + 1) % n]
    const mat = cores[i % cores.length]
    palco.face([[ax, ay, z], [bx, by, z], [bx, by, z - faixa], [ax, ay, z - faixa]], mat, o, { dentro })
    palco.face([[ax, ay, z - faixa], [bx, by, z - faixa], [(ax + bx) / 2, (ay + by) / 2, z - faixa - bico]], mat, o, { dentro, adiante: -0.01 })
  }
}
