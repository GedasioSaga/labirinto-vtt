import { empacotar, fbm, hash, luz, misturar, passoSuave, rgb, valor, vizinhos, type Rgb } from '../ruido'

/**
 * CINZAS (L09 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`; temas Lava e Inferno): o chão
 * coberto de cinza depois do fogo. A cinza é um pó cinza-quente, fofo, em manchas largas: a mais clara (a cinza nova,
 * solta, que o vento junta), a mais escura (a queimada, úmida) e, aqui e ali, a cinza avermelhada do chão do inferno.
 * Por cima, um grão fino de pó e os flocos claros. Os pedaços de CARVÃO meio enterrados, foscos, com um nada de luz do
 * lado de cima à esquerda. E as BRASINHAS: pontos de brasa que ainda não apagaram, juntos em poucos lugares (não em
 * toda parte), cada um com o miolo claro, a beira vinho e o halo quente na cinza em volta. Sem junta nem desenho que se
 * repita à vista. Ladrilho de 8 casas, que dá a volta.
 *
 * Conta barata por pixel (dois `vizinhos` e três `fbm`, como o chão de mina): o ladrilho sai em fatias, sem tabela.
 */

/** A cinza: a comum, a nova (clara), a queimada (escura) e a avermelhada. */
const CINZA: Rgb = rgb('#625c57')
const CINZA_NOVA: Rgb = rgb('#78726b')
const CINZA_QUEIMADA: Rgb = rgb('#4c4743')
const CINZA_AVERMELHADA: Rgb = rgb('#634f48')
/** Os flocos claros e o carvão. */
const FLOCO: Rgb = rgb('#8e8880')
const CARVAO: Rgb = rgb('#3e3936')
/** A brasinha: a beira funda, o meio e o miolo; o halo quente que ela deixa na cinza. */
const BRASA_FUNDA: Rgb = rgb('#7a3c2c')
const BRASA: Rgb = rgb('#b0623c')
const BRASA_CLARA: Rgb = rgb('#d29a6c')
const HALO: Rgb = rgb('#6e4a3c')

/** O carvão: células por lado do ladrilho, quanto das células tem um pedaço, o raio (em células) e o achatado. */
const CARVOES = { celulas: 44, parte: 0.22, raio: [0.14, 0.3], achata: 0.55, semente: 5301 } as const
/** As brasinhas: as células, quanto delas acende onde a mancha junta, o raio do miolo e o do halo (em células). */
const BRASINHAS = { celulas: 64, parte: 0.6, raio: [0.1, 0.18], halo: 0.8, semente: 5311 } as const
/** Onde as brasinhas juntam: as manchas (células por lado do ladrilho) e o limiar (só nas mais fortes). */
const JUNTA = { celulas: 6, de: 0.55, ate: 0.75, semente: 5321 } as const
/**
 * O peso das manchas largas (a queimada, a nova, a avermelhada). Mais fortes (0,7, 0,6 e 0,65 na 1ª folha,
 * 28/11/2026), o mesmo desenho escuro voltava a cada 8 casas e o 3 x 3 lia papel de parede.
 */
const PESO_DAS_MANCHAS = { queimada: 0.45, nova: 0.4, avermelhada: 0.4 } as const
/** A luz do carvão: o quanto o lado de cima à esquerda acende e a quina escura. */
const LUZ_NO_CARVAO = { claro: 0.2, quina: 0.8 } as const

function naVolta(t: number): number {
  return t - Math.floor(t)
}

/** Onde as brasinhas juntam (0 a 1), lido no meio da célula para a brasinha sair inteira. */
function juntaBrasa(ix: number, iy: number): number {
  const n = BRASINHAS.celulas
  return passoSuave(JUNTA.de, JUNTA.ate, valor(((ix + 0.5) / n) * JUNTA.celulas, ((iy + 0.5) / n) * JUNTA.celulas, JUNTA.celulas, JUNTA.semente))
}

/** O carvão no ponto: a cor do pedaço que cobre o ponto, ou nula fora dele. */
function carvao(u: number, v: number): Rgb | null {
  let cor: Rgb | null = null
  let maisPerto = Infinity
  vizinhos(u, v, CARVOES.celulas, CARVOES.semente, 0.36, ({ dx, dy, ix, iy }) => {
    if (hash(ix, iy, CARVOES.semente + 1) > CARVOES.parte) return
    const raio = CARVOES.raio[0] + (CARVOES.raio[1] - CARVOES.raio[0]) * hash(ix, iy, CARVOES.semente + 2)
    const giro = hash(ix, iy, CARVOES.semente + 3) * Math.PI
    const [c, s] = [Math.cos(giro), Math.sin(giro)]
    const lx = (dx * c + dy * s) / raio
    const ly = (-dx * s + dy * c) / (raio * CARVOES.achata)
    // O pedaço lascado: um quadrado de cantos gastos, torto.
    const d = Math.max(Math.abs(lx), Math.abs(ly)) * 0.5 + Math.hypot(lx, ly) * 0.5
    if (d >= 1 || d >= maisPerto) return
    maisPerto = d
    const voltado = -(dx + dy) / (raio * Math.SQRT2)
    const tom = luz(CARVAO, (hash(ix, iy, CARVOES.semente + 4) - 0.5) * 0.2 + Math.max(0, voltado) * LUZ_NO_CARVAO.claro)
    cor = luz(tom, -passoSuave(LUZ_NO_CARVAO.quina, 1, d) * 0.2)
  })
  return cor
}

/** As brasinhas no ponto: a cor da que cobre o ponto (ou nula) e o halo quente das vizinhas (0 a 1). */
function brasinhas(u: number, v: number): { readonly cor: Rgb | null; readonly halo: number } {
  let cor: Rgb | null = null
  let halo = 0
  vizinhos(u, v, BRASINHAS.celulas, BRASINHAS.semente, 0.4, ({ dx, dy, ix, iy }) => {
    if (hash(ix, iy, BRASINHAS.semente + 1) > BRASINHAS.parte * juntaBrasa(ix, iy)) return
    const raio = BRASINHAS.raio[0] + (BRASINHAS.raio[1] - BRASINHAS.raio[0]) * hash(ix, iy, BRASINHAS.semente + 2)
    const d = Math.hypot(dx, dy * 1.15)
    halo = Math.max(halo, passoSuave(BRASINHAS.halo, 0, d) * (0.6 + 0.4 * hash(ix, iy, BRASINHAS.semente + 3)))
    if (d >= raio) return
    const t = d / raio
    cor = t < 0.45 ? misturar(BRASA_CLARA, BRASA, t / 0.45) : misturar(BRASA, BRASA_FUNDA, (t - 0.45) / 0.55)
  })
  return { cor, halo }
}

/** A cor das cinzas no ponto (u, v) do ladrilho. */
export function texturaCinzas(u: number, v: number): number {
  const uu = naVolta(u)
  const vv = naVolta(v)
  // A cinza: as manchas largas de nova e de queimada, a avermelhada em poucos lugares, o grão e os flocos.
  const mancha = fbm(uu, vv, 4, 3, 5331)
  let c = misturar(CINZA, CINZA_QUEIMADA, passoSuave(-0.1, -0.7, mancha) * PESO_DAS_MANCHAS.queimada)
  c = misturar(c, CINZA_NOVA, passoSuave(0.15, 0.75, mancha) * PESO_DAS_MANCHAS.nova)
  c = misturar(c, CINZA_AVERMELHADA, passoSuave(0.25, 0.8, fbm(uu, vv, 3, 2, 5332)) * PESO_DAS_MANCHAS.avermelhada)
  // As manchas do meio (8 por ladrilho) desmancham a repetição das largas.
  c = luz(c, fbm(uu, vv, 8, 2, 5337) * 0.05 + fbm(uu, vv, 14, 3, 5333) * 0.05 + (valor(uu * 512, vv * 512, 512, 5334) - 0.5) * 0.09 + (valor(uu * 192, vv * 192, 192, 5335) - 0.5) * 0.05)
  const floco = valor(uu * 640, vv * 640, 640, 5336)
  c = misturar(c, FLOCO, passoSuave(0.86, 0.96, floco) * 0.7)

  const pedaco = carvao(uu, vv)
  if (pedaco !== null) c = pedaco
  const brasa = brasinhas(uu, vv)
  c = misturar(c, HALO, brasa.halo * 0.6)
  if (brasa.cor !== null) c = brasa.cor
  return empacotar(c)
}
