import { ALTURA_DA_FERRAMENTA_FOGO, ALTURAS_FOGO, type AlturaFogo, type DificuldadeFogo, type FerramentaFogo } from '../tipos'
import type { FogoAlturaNoPlacar, FogoMotivoDoFim, FogoResultado, FogoResumoDoPlacar } from '../../../net/protocoloDoFogo'

/** Os textos do Fogo na Floresta, no painel do mestre e na tela do jogador (português simples). */

export const NOME_DO_JOGO_FOGO = 'Fogo na Floresta'

export const NOME_DA_DIFICULDADE_FOGO: Record<DificuldadeFogo, string> = {
  facil: 'Fácil',
  normal: 'Normal',
  extremo: 'Extremo',
}

export const NOME_DA_FERRAMENTA_FOGO: Record<FerramentaFogo, string> = {
  bolha: 'Bolha de água',
  mangueira: 'Mangueira',
  areia: 'Areia',
}

/** O que cada ferramenta apaga, numa linha (o convite mostra ao escolher). */
export const DICA_DA_FERRAMENTA_FOGO: Record<FerramentaFogo, string> = {
  bolha: 'Apaga o fogo no alto da copa. Joga bolhas em arco; enche no lago ou no caminhão.',
  mangueira: 'Apaga o fogo do tronco. Jato curto e contínuo; enche no lago ou no caminhão.',
  areia: 'Abafa o fogo rasteiro e deixa uma barreira de areia no chão. Enche só no caminhão.',
}

export const NOME_DA_ALTURA_FOGO: Record<AlturaFogo, string> = {
  rasteiro: 'Rasteiro (no chão)',
  tronco: 'Tronco',
  copa: 'Copa (no alto)',
}

/** "Bolha de água (copa)": a ferramenta com a altura que ela apaga, para o seletor do mestre. */
export function rotuloDaFerramentaFogo(ferramenta: FerramentaFogo): string {
  return `${NOME_DA_FERRAMENTA_FOGO[ferramenta]} (${ALTURA_DA_FERRAMENTA_FOGO[ferramenta]})`
}

/** O fogo de cada altura, para entrar no meio da frase. */
const O_FOGO_DA_ALTURA: Record<AlturaFogo, string> = {
  rasteiro: 'o fogo rasteiro',
  tronco: 'o fogo do tronco',
  copa: 'o fogo da copa',
}

/** "a, b e c". */
function juntarComE(partes: readonly string[]): string {
  if (partes.length <= 1) return partes.join('')
  return `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`
}

/** O modo do JOGO (`placar.modo`) e as alturas que contaram, numa frase. */
export function fraseDoModoFogo(placar: Pick<FogoResumoDoPlacar, 'modo' | 'contam'>): string {
  const contou = juntarComE(placar.contam.map((a) => O_FOGO_DA_ALTURA[a]))
  if (placar.modo === 'solo') return `Sozinho: só contou ${contou}.`
  if (placar.contam.length === ALTURAS_FOGO.length) return 'Em equipe: o fogo das 3 alturas contou.'
  return `Em equipe: contou ${contou}.`
}

/** Uma altura no fim: "Copa (no alto): 45% viva, 30 de 120 queimaram (não contou)". */
export function linhaDaAlturaFogo(altura: AlturaFogo, dados: FogoAlturaNoPlacar, contou: boolean): string {
  const base = `${NOME_DA_ALTURA_FOGO[altura]}: ${dados.viva}% viva, ${dados.queimadas} de ${dados.inicial} queimaram`
  return contou ? base : `${base} (não contou)`
}

/** Como a partida acabou, numa frase. Motivo novo que o app não conhece: `null` (a tela não diz nada). */
export function fraseDoMotivoFogo(motivo: string): string | null {
  if (motivo === 'apagado') return 'O fogo que contava foi todo apagado.'
  if (motivo === 'tempo') return 'O tempo acabou.'
  if (motivo === 'vila') return 'A vila caiu: duas casas se perderam.'
  return null
}

/** O jogo mede o fogo tirado em milésimos: 1000 = uma altura acesa inteira numa célula do mapa (GDD seção 3). */
const FOGO_CERTO_POR_FOGO = 1000

/** "12 fogos apagados": o `fogoCerto` de um jogador em conta que se lê. */
export function fogosApagadosFogo(fogoCerto: number): string {
  const n = Math.round(fogoCerto / FOGO_CERTO_POR_FOGO)
  return `${n} ${n === 1 ? 'fogo apagado' : 'fogos apagados'}`
}

export const NOME_DO_RESULTADO_FOGO: Record<FogoResultado, string> = {
  venceu: 'Venceu',
  perdeu: 'Não venceu',
  saiu: 'Saiu',
}

export const MOTIVO_DO_ENCERRAMENTO_FOGO: Record<FogoMotivoDoFim, string> = {
  fora: 'O jogo começou sem você: da próxima vez, toque em Pronto antes.',
  mestre: 'O mestre encerrou o jogo.',
  saiu: 'Você saiu do jogo (a conexão caiu ou a página recarregou).',
  divergiu: 'As partidas dos aparelhos ficaram diferentes e o jogo foi encerrado. Nada foi ganho nem perdido.',
}

/** Por que o jogo não chegou neste aparelho (entra no aviso: "O jogo não carregou (...)"). */
export const ERRO_DO_JOGO_AUSENTE = 'o aparelho do mestre ainda não tem este jogo'
export const ERRO_DA_CARGA_DEMORADA = 'demorou demais para carregar'

/** O jogo é em primeira pessoa e não tem controle de toque nesta versão. */
export const AVISO_MOUSE_E_TECLADO_FOGO = 'Precisa de mouse e teclado: o jogo não funciona com toque (celular ou tablet).'

export const CONTROLES_DO_FOGO =
  'Clique no jogo para o mouse virar o olhar (Esc solta o mouse). WASD ou setas andam; clique ou Espaço usa a ferramenta; perto do caminhão, 1, 2 e 3 trocam de ferramenta.'
