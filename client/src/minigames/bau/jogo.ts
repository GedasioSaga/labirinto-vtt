/**
 * JOGO DO BAÚ, "FECHOS TEIMOSOS": junta simulação, arte, som e robôs no
 * contrato `JogoDeAbrir` que a vitrine, as provas e o porte para o app usam.
 */
import { COR } from '../abrir/desenho'
import { BOCA, alvoEm, desenhar } from './arte'
import { roboHumano, roboRuim } from './robo'
import { abertura, amostra, criar, eventos, fim, passo, progresso, tempo } from './sim'
import { DURACAO_SEQUENCIA, GANHO, SEQUENCIA, tocar } from './som'
import type { JogoDeAbrir } from '../abrir/tipos'
import type { Estado } from './sim'

/**
 * Teclas por `event.code`: números 1-4, A S D F (mão esquerda em repouso) e
 * as setas na ordem esquerda, baixo, direita, cima. Índice além do número de
 * fechos é ignorado pela simulação.
 */
export const TECLAS_DO_BAU: Readonly<Record<string, number>> = {
  Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3,
  KeyA: 0, KeyS: 1, KeyD: 2, KeyF: 3,
  ArrowLeft: 0, ArrowDown: 1, ArrowRight: 2, ArrowUp: 3,
}

/** O Baú no contrato dos jogos de abrir. */
export const JOGO_BAU: JogoDeAbrir<Estado> = {
  id: 'bau',
  nome: 'Baú',
  instrucao: 'Toque no fecho quando a barrinha dele estiver no âmbar; com todos abertos a tampa sobe. Fecho que acende: toque já.',
  objetivo: 'Mantenha os fechos abertos até a tampa subir. Toque no fecho quando a barra ficar âmbar.',
  // Faixa de parede acima da tampa: os alvos dos fechos começam em y = 30 e o halo da vela em x = 208.
  areaDaDica: [4, 2, 200, 27],
  teclas: TECLAS_DO_BAU,
  // a3 só existe no Difícil (4 fechos); no Normal a amostra não tem essa chave.
  grafico: [
    { chave: 'a0', rotulo: 'Fecho 1', min: 0, max: 1, cor: COR.ouro },
    { chave: 'a1', rotulo: 'Fecho 2', min: 0, max: 1, cor: COR.verde },
    { chave: 'a2', rotulo: 'Fecho 3', min: 0, max: 1, cor: COR.azul },
    { chave: 'a3', rotulo: 'Fecho 4', min: 0, max: 1, cor: COR.rosa },
    { chave: 'tampa', rotulo: 'Tampa', min: 0, max: 1, cor: COR.pinho },
    { chave: 'aviso', rotulo: 'Aviso', min: 0, max: 1, cor: COR.brasa },
  ],
  ganho: GANHO,
  boca: BOCA,
  sequencia: SEQUENCIA,
  duracaoSequencia: DURACAO_SEQUENCIA,
  criar,
  passo,
  eventos,
  tempo,
  fim,
  progresso,
  abertura,
  amostra,
  desenhar,
  alvoEm,
  tocar,
  roboHumano,
  roboRuim,
}
