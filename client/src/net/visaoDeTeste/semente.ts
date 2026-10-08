import { nameSkeleton } from '../../lib/chat'
import type { SavedSceneMemory, SavedSeat, SavedSeatExploration } from '../../lib/savedTable'

/**
 * VISÃO DE JOGADOR — a memória do dono da ficha, para o teste começar com o
 * que ele já explorou. Só LEITURA: daqui sai uma cópia, e nada do que o teste
 * fizer com ela volta à mesa de verdade.
 *
 * O modelo é o da mesa gravada (`lib/savedTable.ts`): por cena, o explorado e
 * as portas vistas. Cômodo lembrado, marcas e barras de pino não entram (a mesa
 * também não os grava): voltam a ser lembrados quando a ficha os vir de novo.
 *
 * LIMITAÇÃO DECLARADA: só o TÉRREO de cada cena. A mesa grava uma memória por
 * mapa, e a sessão deixa de fora a dos andares de cima (`hostSession.ts`,
 * `savedExploration`): copiada como térreo, abriria no térreo o que o dono só
 * viu lá em cima. Quem testa a ficha num andar de cima começa ele do zero.
 */
export interface SementeDoDono {
  /** O nome do assento do dono (o que a mesa gravaria). */
  nome: string
  /** Raio ajustado pelo mestre para o dono; `null` = o global. */
  visionRadius: number | null
  /** "Fator de visão" do dono agora; `null` = x1,0 (ou o dono não está na sala). */
  visionFactor: number | null
  /** A memória dele, cena por cena, da usada há mais tempo à mais recente. Vazia = nada explorado. */
  cenas: SavedSceneMemory[]
}

/** Cópia funda de uma cena: o teste nunca segura o objeto da sessão de verdade. */
function copiarCena(cena: SavedSceneMemory): SavedSceneMemory {
  return { ...cena, explored: { ...cena.explored }, doors: cena.doors.map((porta) => ({ ...porta })) }
}

/**
 * Da mesa e do explorado (gravados, ou como a sala viva os gravaria agora), a
 * memória de quem tem a ficha `tokenId`. O explorado acha o assento pelo nome
 * normalizado, a mesma regra do "Retomar a mesa". Ficha sem dono = `null`: o
 * teste começa do zero.
 */
export function sementeDosAssentos(
  assentos: readonly SavedSeat[],
  explorado: readonly SavedSeatExploration[],
  tokenId: string,
  visionFactor: number | null,
): SementeDoDono | null {
  const assento = assentos.find((seat) => seat.tokenIds.includes(tokenId))
  if (assento === undefined) return null
  const chave = nameSkeleton(assento.name)
  const memoria = explorado.find((seat) => nameSkeleton(seat.name) === chave)
  return {
    nome: assento.name,
    visionRadius: assento.visionRadius,
    visionFactor,
    cenas: memoria === undefined ? [] : memoria.scenes.map(copiarCena),
  }
}
