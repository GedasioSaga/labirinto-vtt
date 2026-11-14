import { empacotar, fbm, hash, luz, misturar, passoSuave, rgb, valor, type Rgb } from '../ruido'

/**
 * MÁRMORE (pedido de 14/11/2026: "texturas novas de madeira, pedra, base militar"; cartão Pisos de pedra): o chão
 * de templo e de palácio. Placas quadradas de uma casa de mármore branco-acinzentado, polidas e planas; em cada
 * uma, um ou dois veios cinza que atravessam a placa de lado a lado, macios (miolo fino e um halo largo e fraco,
 * engrossando e afinando ao longo do caminho), um veio secundário mais fino e apagado noutro rumo, e as nuvens
 * leves da pedra. Cada placa é cortada de um ponto diferente do bloco: os veios mudam de rumo na junta, e é isso
 * (mais que a junta, quase invisível) que faz a placa se ler.
 */

const CASAS = 8
/** Veios principais por casa, ao longo do rumo da placa (1 a 2 cruzam a placa). */
const VEIOS_POR_CASA = [1.1, 1.8] as const
/** Os secundários, mais juntos. */
const SECUNDARIOS_POR_CASA = [2.4, 3.4] as const
/** Meia largura do miolo do veio e do halo, em casas. */
const VEIO_MIOLO = 0.012
const VEIO_HALO = 0.11
/**
 * O quanto o veio serpenteia, em voltas do campo (1 = a distância entre dois veios), e o ganho e as oitavas do ruído
 * que o torce: poucas, para a curva ser larga e corrida (oitava miúda dá dobra miúda, e o veio vira rachadura).
 */
const VEIO_ONDA = 0.9
const VEIO_GANHO = 0.5
const VEIO_OITAVAS = 2
/** Quanto o miolo e o halo escurecem (fração do caminho até a cor do veio). */
const VEIO_FORCA = { miolo: 0.3, halo: 0.13 } as const
/** O secundário: mais fino e mais fraco que o principal, e só em parte da placa. */
const SECUNDARIO = { grossura: 0.6, forca: 0.25 } as const
/** A junta, em casas a partir da borda da placa: no `fio`, a cor dela (misturada pela metade); no `fim`, a placa. */
const JUNTA = { fio: 0.004, fim: 0.02, forca: 0.45 } as const
/** O polimento: um fio de luz na beirada de cima à esquerda, um de sombra na de baixo à direita. */
const BEIRADA = { largura: 0.03, luz: 0.025 } as const

/** Branco-acinzentado de mármore, nada de branco puro; uma placa ou outra um nada mais creme. */
const TONS: readonly Rgb[] = [rgb('#d8d5ce'), rgb('#d6d4cf'), rgb('#dad7d0'), rgb('#d4d2cc'), rgb('#d8d4cb'), rgb('#d9d7d2')]
/** O cinza do veio: neutro, para o veio parecer pedra e não sujeira. */
const COR_DO_VEIO = rgb('#8e8c89')
/** A junta: só um cinza um pouco mais fundo que a placa. */
const COR_DA_JUNTA = rgb('#b4b0a8')

function naVolta(t: number): number {
  return t - Math.floor(t)
}

/** Quanto do veio cobre o ponto que está a `d` casas do meio dele (miolo forte e fino, halo fraco e largo). */
function veioNaDistancia(d: number, grossura: number): number {
  return passoSuave(VEIO_MIOLO * grossura, 0, d) * VEIO_FORCA.miolo + passoSuave(VEIO_HALO * grossura, 0, d) * VEIO_FORCA.halo
}

/**
 * A distância (em casas) do ponto (lx, ly) da placa ao veio mais perto de uma família de veios paralelos e tortos:
 * o campo cresce no rumo (rx, ry) e o veio é onde ele passa de inteiro. `onda` é a torção do ruído naquele ponto.
 */
function distanciaAoVeio(lx: number, ly: number, rx: number, ry: number, frequencia: number, fase: number, onda: number): number {
  const campo = (lx * rx + ly * ry) * frequencia + fase + onda
  return Math.abs(campo - Math.round(campo)) / frequencia
}

/**
 * A cor do mármore no ponto (u, v) do ladrilho.
 * A emenda do ladrilho cai no meio das placas, nunca numa junta. O ruído de cada placa é o do ladrilho deslocado
 * por ela: segue repetindo no ladrilho e muda de placa para placa.
 */
export function texturaMarmore(u: number, v: number): number {
  const uu = naVolta(u)
  const vv = naVolta(v)
  const x = uu * CASAS + 0.5
  const y = vv * CASAS + 0.5
  const placa = (Math.floor(y) % CASAS) * CASAS + (Math.floor(x) % CASAS)
  const lx = x - Math.floor(x)
  const ly = y - Math.floor(y)
  // Onde a placa foi cortada do bloco: o deslocamento do ruído dela.
  const ou = hash(placa, 0, 1801)
  const ov = hash(placa, 1, 1801)

  let c = TONS[Math.floor(hash(placa, 2, 1801) * TONS.length) % TONS.length]
  // As nuvens da pedra: largas e fracas.
  c = luz(c, fbm(uu + ou, vv + ov, 6, 3, 1802) * 0.025 + (hash(placa, 3, 1801) - 0.5) * 0.016)

  // O rumo dos veios da placa: quase reto (raro) vira diagonal, para o veio atravessar a placa e não correr rente à junta.
  let rx = hash(placa, 4, 1801) - 0.5
  let ry = hash(placa, 5, 1801) - 0.5
  if (Math.abs(rx) < 0.12) rx = rx < 0 ? -0.3 : 0.3
  if (Math.abs(ry) < 0.12) ry = ry < 0 ? -0.3 : 0.3
  const tamanho = Math.sqrt(rx * rx + ry * ry)
  rx /= tamanho
  ry /= tamanho
  const onda = fbm(uu + ou, vv + ov, 3, VEIO_OITAVAS, 1803, VEIO_GANHO) * VEIO_ONDA
  // A grossura e a força mudam ao longo do veio: engrossa, afina e, de vez em quando, quase some.
  const grossura = 0.6 + 0.9 * valor((uu + ou) * 24, (vv + ov) * 24, 24, 1804)
  const presenca = passoSuave(0.1, 0.4, valor((uu + ov) * 12, (vv + ou) * 12, 12, 1805))
  const frequencia = VEIOS_POR_CASA[0] + (VEIOS_POR_CASA[1] - VEIOS_POR_CASA[0]) * hash(placa, 6, 1801)
  const principal = veioNaDistancia(distanciaAoVeio(lx, ly, rx, ry, frequencia, hash(placa, 7, 1801), onda), grossura)
  // O secundário corre de través (o rumo girado de um terço de volta, sem seno: a mesma conta em todo navegador).
  const sx = rx * 0.5 - ry * 0.866
  const sy = rx * 0.866 + ry * 0.5
  const fs = SECUNDARIOS_POR_CASA[0] + (SECUNDARIOS_POR_CASA[1] - SECUNDARIOS_POR_CASA[0]) * hash(placa, 8, 1801)
  const soEmParte = passoSuave(0.45, 0.7, valor((uu + ov) * 10, (vv + ou) * 10, 10, 1806))
  const secundario = veioNaDistancia(distanciaAoVeio(lx, ly, sx, sy, fs, hash(placa, 9, 1801), onda * 0.8), grossura * SECUNDARIO.grossura) * SECUNDARIO.forca * soEmParte
  c = misturar(c, COR_DO_VEIO, Math.max(principal * presenca, secundario))

  // A beirada polida e a junta quase invisível.
  const cima = Math.min(lx, ly)
  const baixo = Math.min(1 - lx, 1 - ly)
  c = luz(c, passoSuave(BEIRADA.largura, 0, cima) * BEIRADA.luz - passoSuave(BEIRADA.largura, 0, baixo) * BEIRADA.luz)
  const borda = Math.min(cima, baixo)
  return empacotar(misturar(c, COR_DA_JUNTA, passoSuave(JUNTA.fim, JUNTA.fio, borda) * JUNTA.forca))
}
