import type { CenarioBolha, DificuldadeBolha, ModoBolha } from '../minigames/bolha/tipos'
import type { BolhaPlacar } from './protocoloDaBolha'

/**
 * CONFERÊNCIA DO PLACAR DA BOLHA D'ÁGUA NO HOST. O jogo roda na máquina do
 * jogador, então o `bolha.fim` é a palavra dele: o host confere se o placar é
 * da partida que mandou (cenário, dificuldade, semente e modo do `comecar`) e
 * se os números fecham com a conta do próprio jogo. Barra o absurdo (vitória
 * em outra partida, 999 milhões de pontos), NÃO um trapaceiro cuidadoso: quem
 * refizer a conta do jogo passa por aqui.
 *
 * Os números vêm do repositório do jogo (jogos/bolha-d-agua): duração e espera
 * entre bolhas de `src/sim/ajustes.gd` (POR_DIFICULDADE), focos de
 * `src/sim/cenarios.gd` mais os sorteados de POR_CENARIO, e a conta de pontos e
 * estrelas de `src/sim/partida.gd` (`placar()`). Mudou lá, muda aqui.
 */

/** A partida que o host mandou no `bolha.comecar`. */
export interface PartidaDaBolha {
  semente: number
  dificuldade: DificuldadeBolha
  cenario: CenarioBolha
  modo: ModoBolha
}

/** ajustes.gd POR_DIFICULDADE: `tempo_s` (duração), `intervalo_s` (espera entre bolhas) e se o fogo espalha. */
const POR_DIFICULDADE: Readonly<Record<DificuldadeBolha, { duracaoS: number; intervaloS: number; espalha: boolean }>> = {
  facil: { duracaoS: 90, intervaloS: 0.5, espalha: false },
  normal: { duracaoS: 75, intervaloS: 0.55, espalha: true },
  dificil: { duracaoS: 70, intervaloS: 0.6, espalha: true },
}

/** cenarios.gd: focos do cenário; acesos no início = os fixos acesos + os `sorteados` de ajustes.gd POR_CENARIO. */
const POR_CENARIO: Readonly<Record<CenarioBolha, { focos: number; acesosNoInicio: Readonly<Record<DificuldadeBolha, number>> }>> = {
  clareira: { focos: 13, acesosNoInicio: { facil: 7, normal: 6, dificil: 6 } },
  casa: { focos: 19, acesosNoInicio: { facil: 5, normal: 5, dificil: 5 } },
}

// partida.gd placar(): vitória = 500 + round(max(0, duração - t) * 10) + precisão * 3;
// derrota = apagados * 40 + precisão; estrelas (só na vitória) = 1 + (t <= 75% da duração) + (precisão >= 75).
const PONTOS_BASE_DA_VITORIA = 500
const PONTOS_POR_SEGUNDO_QUE_SOBROU = 10
const PONTOS_POR_PRECISAO_NA_VITORIA = 3
const PONTOS_POR_FOCO_APAGADO = 40
const ESTRELA_RAPIDA_ATE = 0.75
const ESTRELA_DE_PRECISAO_DESDE = 75
const MOTIVO_DA_VITORIA = 'apagou'
const MOTIVO_DO_TEMPO = 'tempo'

// Folgas pequenas: o jogo arredonda o tempo a 0,01 s (o que mexe 1 ponto no bônus de
// tempo e a borda da estrela rápida) e termina no tique de 1/60 s depois da duração.
const FOLGA_TEMPO_S = 1
const FOLGA_PONTOS = 1
const FOLGA_BOLHAS = 2
const FOLGA_ARREDONDAMENTO_S = 0.01

/** Teto de bolhas no tempo jogado: uma a cada `intervalo_s`, a primeira já no 0. */
function bolhasNoTempo(tempoS: number, intervaloS: number): number {
  return Math.floor(tempoS / intervaloS) + 1 + FOLGA_BOLHAS
}

function conferirVitoria(placar: BolhaPlacar, duracaoS: number, acesosNoInicio: number): string | null {
  if (placar.motivo !== MOTIVO_DA_VITORIA) return 'vitória com outro motivo'
  if (placar.fogoNoFim !== 0) return 'vitória com fogo aceso'
  if (placar.focosApagados < acesosNoInicio) return 'vitória sem apagar os focos do início'
  const rapidaAte = duracaoS * ESTRELA_RAPIDA_ATE
  const deResgate = placar.precisao >= ESTRELA_DE_PRECISAO_DESDE ? 1 : 0
  const naBorda = Math.abs(placar.tempoS - rapidaAte) <= FOLGA_ARREDONDAMENTO_S
  const esperadas = 1 + (placar.tempoS <= rapidaAte ? 1 : 0) + deResgate
  if (placar.estrelas !== esperadas && !(naBorda && placar.estrelas >= 1 + deResgate && placar.estrelas <= 2 + deResgate)) return 'estrelas fora da conta do jogo'
  const sobrou = Math.round(Math.max(0, duracaoS - placar.tempoS) * PONTOS_POR_SEGUNDO_QUE_SOBROU)
  const pontos = PONTOS_BASE_DA_VITORIA + sobrou + placar.precisao * PONTOS_POR_PRECISAO_NA_VITORIA
  if (Math.abs(placar.pontos - pontos) > FOLGA_PONTOS) return 'pontos fora da conta do jogo'
  return null
}

function conferirDerrota(placar: BolhaPlacar, duracaoS: number): string | null {
  if (placar.motivo === MOTIVO_DA_VITORIA) return 'derrota que diz que apagou'
  if (placar.motivo === MOTIVO_DO_TEMPO && placar.tempoS < duracaoS - FOLGA_ARREDONDAMENTO_S) return 'acabou o tempo antes da hora'
  if (placar.estrelas !== 0) return 'estrelas numa derrota'
  if (placar.pontos !== placar.focosApagados * PONTOS_POR_FOCO_APAGADO + placar.precisao) return 'pontos fora da conta do jogo'
  return null
}

/**
 * `null` = o placar fecha com a partida; texto = por que foi recusado (curto,
 * para a linha do mestre). Quem é recusado conta como não apagou, sem prêmio.
 */
export function conferirPlacarDaBolha(placar: BolhaPlacar, partida: PartidaDaBolha): string | null {
  if (placar.cenario !== partida.cenario) return 'outro cenário'
  if (placar.dificuldade !== partida.dificuldade) return 'outra dificuldade'
  if (placar.semente !== partida.semente) return 'outra semente'
  if (placar.modo !== partida.modo) return 'outro modo'
  const { duracaoS, intervaloS, espalha } = POR_DIFICULDADE[partida.dificuldade]
  const cenario = POR_CENARIO[partida.cenario]
  const acesosNoInicio = cenario.acesosNoInicio[partida.dificuldade]
  if (placar.tempoS > duracaoS + FOLGA_TEMPO_S) return 'tempo além da partida'
  if (placar.bolhas > bolhasNoTempo(placar.tempoS, intervaloS)) return 'bolhas demais para o tempo'
  if (placar.acertos > placar.bolhas) return 'mais acertos que bolhas'
  const precisao = placar.bolhas === 0 ? 0 : Math.round((100 * placar.acertos) / placar.bolhas)
  if (placar.precisao !== precisao) return 'precisão não bate com acertos e bolhas'
  // Sem espalhar (fácil), nenhum foco pega do vizinho.
  if (!espalha && placar.focosQuePegaram > 0) return 'fogo que pegou sem espalhar'
  // Cada foco apagado estava aceso: os do início mais os que pegaram depois.
  if (placar.focosApagados > acesosNoInicio + placar.focosQuePegaram) return 'mais focos apagados que acesos'
  // Um respingo não apaga mais focos do que o cenário tem.
  if (placar.focosApagados > placar.acertos * cenario.focos) return 'mais focos apagados que acertos'
  return placar.vitoria ? conferirVitoria(placar, duracaoS, acesosNoInicio) : conferirDerrota(placar, duracaoS)
}
