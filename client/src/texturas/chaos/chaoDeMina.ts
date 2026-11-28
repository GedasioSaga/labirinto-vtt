import { empacotar, fbm, hash, luz, misturar, passoSuave, rgb, valor, vizinhos, type Rgb } from '../ruido'

/**
 * CHÃO DE MINA (L04 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`; tema Cavernas e mina):
 * a terra batida escura das galerias, pisada por botas e carrinhos, com o PEDRISCO da rocha que caiu das paredes e do
 * minério que sobrou da carga. A terra é parda-escura em manchas largas (a mais funda, úmida; a mais seca, de pó), com
 * um grão fino. O pedrisco vem em duas medidas, cada pedra um domo achatado e torto, acesa do lado da luz (de cima à
 * esquerda), com a quina do lado de lá no escuro e a sombra curta embaixo à direita: muitas miúdas e umas poucas
 * maiores. A cor de cada pedra é sorteada: a maioria cinza da rocha, umas de ferrugem (o minério de ferro) e umas de
 * carvão. Sem junta nem desenho que se repita à vista. Ladrilho de 8 casas, que dá a volta.
 */

/** A terra batida: a comum, a funda (úmida) e a de pó (seca). */
const TERRA: Rgb = rgb('#544a3f')
const TERRA_UMIDA: Rgb = rgb('#463e36')
const TERRA_DE_PO: Rgb = rgb('#62594d')
/** As pedras do pedrisco: a rocha, a de ferrugem e a de carvão; a sombra delas no chão. */
const PEDRA: Rgb = rgb('#6c6660')
const PEDRA_FERRUGEM: Rgb = rgb('#6c5648')
const PEDRA_CARVAO: Rgb = rgb('#403c3a')
const SOMBRA: Rgb = rgb('#2c2722')
/** O quanto cada cor de pedra aparece (o resto é a rocha cinza). */
const PARTE = { ferrugem: 0.2, carvao: 0.14 } as const
/**
 * As duas medidas do pedrisco: células por lado do ladrilho, quanto das células tem pedra, o raio (em células) e o
 * quanto a pedra é achatada de um lado.
 */
const MIUDO = { celulas: 72, parte: 0.4, raio: [0.16, 0.32], achata: 0.62, semente: 4301 } as const
const GRAUDO = { celulas: 18, parte: 0.34, raio: [0.14, 0.26], achata: 0.7, semente: 4311 } as const
/**
 * Onde o pedrisco junta: as manchas (células por lado do ladrilho), o quanto fica onde é limpo (fração da parte) e o
 * quanto sobe onde junta.
 */
const JUNTA = { celulas: 5, limpo: 0.25, cheio: 1.5, semente: 4331 } as const
/** A luz na pedra (o quanto a banda da luz acende e a do lado de lá apaga) e a quina escura da beira. */
const LUZ_NA_PEDRA = { claro: 0.22, escuro: 0.32, quina: 0.82, forcaDaQuina: 0.22 } as const
/**
 * A pedra lascada: o quanto a forma é quadrada (o resto é redondo, os cantos gastos), até onde vai o topo chato (em
 * raios) e a luz dele.
 */
const FACETA = { quina: 0.45, topo: 0.5, luzDoTopo: 0.05 } as const
/** A sombra da pedra: para onde ela cai (em raios) e a força. */
const SOMBRA_DA_PEDRA = { desvio: 0.32, raio: 1.08, forca: 0.42 } as const

function naVolta(t: number): number {
  return t - Math.floor(t)
}

type Pedrisco = typeof MIUDO | typeof GRAUDO

interface NaPedra {
  /** A cor da pedra no ponto, ou nula fora dela. */
  readonly cor: Rgb | null
  /** O quanto a sombra das pedras escurece o chão no ponto (0 a 1). */
  readonly sombra: number
}

/** A cor de uma pedra sorteada pela célula: a rocha cinza, a de ferrugem ou a de carvão, cada uma num tom. */
function corDaPedra(ix: number, iy: number, semente: number): Rgb {
  const s = hash(ix, iy, semente + 3)
  const base = s < PARTE.ferrugem ? PEDRA_FERRUGEM : s < PARTE.ferrugem + PARTE.carvao ? PEDRA_CARVAO : PEDRA
  return luz(base, (hash(ix, iy, semente + 4) - 0.5) * 0.24)
}

/**
 * Quanto pedrisco junta em volta da célula (0 a 1): manchas largas, onde a pedra caiu e ninguém varreu, e trechos
 * quase limpos, os da pisada. Lido no meio da célula, para a pedra sair inteira. Na 1ª folha (28/11/2026) o pedrisco
 * vinha igual em toda parte e o chão lia granilite.
 */
function juntaPedra(ix: number, iy: number, celulas: number): number {
  return passoSuave(0.2, 0.8, valor(((ix + 0.5) / celulas) * JUNTA.celulas, ((iy + 0.5) / celulas) * JUNTA.celulas, JUNTA.celulas, JUNTA.semente))
}

/** O pedrisco de uma medida no ponto (u, v): a pedra que cobre o ponto (a de cima) e a sombra das vizinhas. */
function pedrisco(u: number, v: number, p: Pedrisco): NaPedra {
  let cor: Rgb | null = null
  let maisPerto = Infinity
  let sombra = 0
  vizinhos(u, v, p.celulas, p.semente, 0.34, ({ dx, dy, ix, iy }) => {
    if (hash(ix, iy, p.semente + 1) > p.parte * (JUNTA.limpo + (1 - JUNTA.limpo) * juntaPedra(ix, iy, p.celulas)) * JUNTA.cheio) return
    const raio = p.raio[0] + (p.raio[1] - p.raio[0]) * hash(ix, iy, p.semente + 2)
    // A pedra torta: girada e achatada de um lado.
    const giro = hash(ix, iy, p.semente + 5) * Math.PI
    const [c, s] = [Math.cos(giro), Math.sin(giro)]
    const achata = p.achata + (1 - p.achata) * hash(ix, iy, p.semente + 6)
    // A pedra lascada: um quadrado de cantos gastos no referencial dela (a redonda da 1ª folha lia confeito).
    const local = (x: number, y: number): readonly [number, number, number] => {
      const lx = (x * c + y * s) / raio
      const ly = (-x * s + y * c) / (raio * achata)
      return [Math.max(Math.abs(lx), Math.abs(ly)) * FACETA.quina + Math.hypot(lx, ly) * (1 - FACETA.quina), lx, ly]
    }
    const [d, lx, ly] = local(dx, dy)
    if (d < 1 && d < maisPerto) {
      maisPerto = d
      let tom = corDaPedra(ix, iy, p.semente)
      if (d > FACETA.topo) {
        // A rampa: a normal dela no referencial da pedra, de volta para o chão; a que olha para cima à esquerda acende.
        const [nx, ny] = Math.abs(lx) > Math.abs(ly) ? [Math.sign(lx), 0] : [0, Math.sign(ly)]
        const voltada = -(nx * c - ny * s + (nx * s + ny * c)) / Math.SQRT2
        tom = luz(tom, voltada > 0 ? voltada * LUZ_NA_PEDRA.claro : voltada * LUZ_NA_PEDRA.escuro)
      } else {
        tom = luz(tom, FACETA.luzDoTopo)
      }
      // A quina da beira, no tom escuro da própria pedra.
      tom = luz(tom, -passoSuave(LUZ_NA_PEDRA.quina, 1, d) * LUZ_NA_PEDRA.forcaDaQuina)
      cor = tom
    }
    // A sombra curta, embaixo à direita (fora da pedra; dentro dela a pedra cobre).
    const [ds] = local(dx - raio * SOMBRA_DA_PEDRA.desvio, dy - raio * SOMBRA_DA_PEDRA.desvio)
    sombra = Math.max(sombra, passoSuave(SOMBRA_DA_PEDRA.raio, 0.55, ds) * SOMBRA_DA_PEDRA.forca)
  })
  return { cor, sombra }
}

/** A cor do chão de mina no ponto (u, v) do ladrilho. */
export function texturaChaoDeMina(u: number, v: number): number {
  const uu = naVolta(u)
  const vv = naVolta(v)
  // A terra: manchas largas de úmida e de pó, a pisada (um ondulado médio) e o grão fino.
  // As manchas miúdas e fracas: graúdas e fortes, elas se repetiam à vista de ladrilho em ladrilho.
  const mancha = fbm(uu, vv, 5, 3, 4321)
  let c = misturar(TERRA, TERRA_UMIDA, passoSuave(-0.1, -0.75, mancha) * 0.6)
  c = misturar(c, TERRA_DE_PO, passoSuave(0.2, 0.8, mancha) * 0.55)
  c = luz(c, fbm(uu, vv, 12, 3, 4322) * 0.06 + (valor(uu * 512, vv * 512, 512, 4323) - 0.5) * 0.08 + (valor(uu * 160, vv * 160, 160, 4324) - 0.5) * 0.05)

  // O pedrisco: o miúdo em toda parte, o graúdo por cima, cada um com a sombra dele.
  const miudo = pedrisco(uu, vv, MIUDO)
  const graudo = pedrisco(uu, vv, GRAUDO)
  c = misturar(c, SOMBRA, Math.max(miudo.sombra, graudo.sombra) * 0.6)
  if (graudo.cor !== null) c = graudo.cor
  else if (miudo.cor !== null) c = miudo.cor
  // Uma pitada do pó da terra por cima de tudo (o pedrisco não fica limpo).
  c = misturar(c, TERRA_DE_PO, (valor(uu * 384, vv * 384, 384, 4325) - 0.4) * 0.18)
  return empacotar(c)
}
