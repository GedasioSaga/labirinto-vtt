import { empacotar, fbm, hash, luz, misturar, passoSuave, rgb, valor, type Rgb } from '../ruido'

/**
 * MÁRMORE NEGRO (lote das referências, 15/11/2026: "mármore preto com veios"; cartão Pisos de pedra): o chão do
 * templo, da cripta rica e do salão do culto. Placas grandes de 2 x 2 casas de mármore negro polido. Os veios são
 * claros e tortos, em três famílias que se cruzam: os PRINCIPAIS (dois ou três por placa) atravessam a placa de lado
 * a lado, quebrados em zigue-zague miúdo como a pedra trincou, engrossando, afinando e quase sumindo, com um halo
 * leitoso em volta; os SECUNDÁRIOS correm de través, mais finos e só em parte da placa; e a TEIA, fios curtos e
 * apagados que ligam uns aos outros. A pedra tem as nuvens largas de grafite dela. Cada placa é cortada de um ponto
 * diferente do bloco, então o veio muda de rumo na junta, e é isso (mais que a junta escura e fina, com o fio polido
 * da beira de cima à esquerda) que faz a placa se ler.
 *
 * O veio é a conta do Mármore branco (`marmore.ts`): a linha onde um campo que cresce no rumo da placa, torcido por
 * ruído, passa de inteiro; aqui a torção tem mais oitavas (o veio quebra em vez de ondular) e há a terceira família.
 *
 * Contido de propósito: o veio vai a ~0,5 de luz, não a branco (o 1% mais claro cai nele e a régua de faixa de luz
 * é 0,4 sobre o negro de ~0,15). A placa começa na casa ímpar: a emenda do ladrilho cai no meio dela.
 */

const CASAS = 8
/** Placas de 2 x 2 casas: 4 por lado do ladrilho. */
const PLACA = 2
const PLACAS = CASAS / PLACA
const DESLOCA = 1
const SEMENTE = 7100

/** Uma família de veios: quantos por placa (no rumo dela), a meia largura do miolo e do halo (casas) e as forças. */
interface Familia {
  readonly porPlaca: readonly [number, number]
  readonly miolo: number
  readonly halo: number
  readonly forcaMiolo: number
  readonly forcaHalo: number
}
const PRINCIPAL: Familia = { porPlaca: [1.6, 2.6], miolo: 0.011, halo: 0.07, forcaMiolo: 0.82, forcaHalo: 0.2 }
const SECUNDARIO: Familia = { porPlaca: [3, 4.5], miolo: 0.007, halo: 0.035, forcaMiolo: 0.5, forcaHalo: 0.12 }
const TEIA: Familia = { porPlaca: [6, 8], miolo: 0.0055, halo: 0.02, forcaMiolo: 0.3, forcaHalo: 0.06 }
/** A torção do veio, em voltas do campo, e as oitavas dela (mais oitavas: o veio quebra em zigue-zague). */
const ONDA = { forca: 0.85, oitavas: 4, ganho: 0.55 } as const
/** As nuvens de grafite e o grão do polido. */
const GRAO = 0.012
/** A junta (casas a partir da beira da placa) e o fio polido da beira. */
const JUNTA = { fio: 0.003, fim: 0.012, forca: 0.6 } as const
const BEIRADA = { largura: 0.025, luz: 0.06 } as const

const TONS: readonly Rgb[] = [rgb('#26272a'), rgb('#28282b'), rgb('#252629'), rgb('#27272b')]
/** O grafite das nuvens: um nada mais claro que o negro. */
const GRAFITE = rgb('#36373b')
/** O veio: cinza-pérola, um tico quente; o halo é o mesmo veio, fraco. */
const COR_DO_VEIO = rgb('#8c8a85')
const COR_DA_JUNTA = rgb('#18181a')

function naVolta(t: number): number {
  return t - Math.floor(t)
}

function voltaInteira(n: number, m: number): number {
  const r = n % m
  return r < 0 ? r + m : r
}

/** Quanto do veio cobre o ponto a `d` casas do meio dele: miolo forte e fino, halo fraco e largo. */
function veioNaDistancia(f: Familia, d: number, grossura: number): number {
  return Math.max(passoSuave(f.miolo * grossura, f.miolo * grossura * 0.35, d) * f.forcaMiolo, passoSuave(f.halo * grossura, 0, d) * f.forcaHalo)
}

/** A distância (casas) do ponto (lx, ly) da placa ao veio mais perto da família que corre no rumo (rx, ry). */
function distanciaAoVeio(lx: number, ly: number, rx: number, ry: number, porPlaca: number, fase: number, onda: number): number {
  const campo = (lx * rx + ly * ry) * porPlaca + fase + onda
  return (Math.abs(campo - Math.round(campo)) / porPlaca) * PLACA
}

export function texturaMarmoreNegro(u: number, v: number): number {
  const uu = naVolta(u)
  const vv = naVolta(v)
  const x = uu * CASAS + DESLOCA
  const y = vv * CASAS + DESLOCA
  const ix = Math.floor(x / PLACA)
  const iy = Math.floor(y / PLACA)
  const placa = voltaInteira(iy, PLACAS) * PLACAS + voltaInteira(ix, PLACAS)
  const lx = x / PLACA - ix
  const ly = y / PLACA - iy
  // Onde a placa foi cortada do bloco: o deslocamento do ruído dela (segue a volta do ladrilho).
  const pu = uu + hash(placa, 0, SEMENTE)
  const pv = vv + hash(placa, 1, SEMENTE)

  let c = TONS[Math.floor(hash(placa, 2, SEMENTE) * TONS.length) % TONS.length]
  c = misturar(c, GRAFITE, passoSuave(-0.1, 0.7, fbm(pu, pv, 4, 3, SEMENTE + 3)) * 0.7)
  c = luz(c, (valor(uu * 384, vv * 384, 384, SEMENTE + 4) - 0.5) * GRAO)

  // O rumo dos veios da placa: quase reto vira diagonal, para o veio atravessar a placa e não correr rente à junta.
  let rx = hash(placa, 5, SEMENTE) - 0.5
  let ry = hash(placa, 6, SEMENTE) - 0.5
  if (Math.abs(rx) < 0.12) rx = rx < 0 ? -0.3 : 0.3
  if (Math.abs(ry) < 0.12) ry = ry < 0 ? -0.3 : 0.3
  const tamanho = Math.sqrt(rx * rx + ry * ry)
  rx /= tamanho
  ry /= tamanho
  const onda = fbm(pu, pv, 2, ONDA.oitavas, SEMENTE + 7, ONDA.ganho) * ONDA.forca
  const grossura = 0.55 + 0.95 * valor(pu * 20, pv * 20, 20, SEMENTE + 8)
  const presenca = passoSuave(0.08, 0.42, valor(pu * 10, pv * 10, 10, SEMENTE + 9))
  const sorteio = (k: number, f: Familia) => f.porPlaca[0] + (f.porPlaca[1] - f.porPlaca[0]) * hash(placa, k, SEMENTE)
  const principal = veioNaDistancia(PRINCIPAL, distanciaAoVeio(lx, ly, rx, ry, sorteio(10, PRINCIPAL), hash(placa, 11, SEMENTE), onda), grossura) * presenca
  // O secundário corre de través (o rumo girado de ~60°, sem seno: a mesma conta em todo navegador), só em parte.
  const sx = rx * 0.5 - ry * 0.866
  const sy = rx * 0.866 + ry * 0.5
  const soEmParte = passoSuave(0.42, 0.7, valor(pv * 8, pu * 8, 8, SEMENTE + 12))
  const secundario = veioNaDistancia(SECUNDARIO, distanciaAoVeio(lx, ly, sx, sy, sorteio(13, SECUNDARIO), hash(placa, 14, SEMENTE), onda * 0.8), grossura) * soEmParte
  // A teia: o rumo girado do outro lado, fios curtos (aparece e some depressa).
  const tx = rx * 0.5 + ry * 0.866
  const ty = -rx * 0.866 + ry * 0.5
  const curtos = passoSuave(0.55, 0.8, valor(pu * 24, pv * 24, 24, SEMENTE + 15))
  const teia = veioNaDistancia(TEIA, distanciaAoVeio(lx, ly, tx, ty, sorteio(16, TEIA), hash(placa, 17, SEMENTE), onda * 1.3), 1) * curtos
  c = misturar(c, COR_DO_VEIO, Math.max(principal, secundario, teia))

  // O fio polido da beira de cima à esquerda e a junta escura e fina.
  const cima = Math.min(lx, ly) * PLACA
  const baixo = Math.min(1 - lx, 1 - ly) * PLACA
  c = luz(c, passoSuave(BEIRADA.largura, 0, cima) * BEIRADA.luz - passoSuave(BEIRADA.largura, 0, baixo) * BEIRADA.luz * 0.5)
  return empacotar(misturar(c, COR_DA_JUNTA, passoSuave(JUNTA.fim, JUNTA.fio, Math.min(cima, baixo)) * JUNTA.forca))
}
