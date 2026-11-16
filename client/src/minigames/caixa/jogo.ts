/**
 * JOGO DA CAIXA: junta a simulação, a arte, o som e os robôs do arrombar com
 * pé de cabra num `JogoDeAbrir`, o contrato que a vitrine, as provas e o
 * porte para o app usam sem conhecer o jogo por dentro.
 */
import { COR } from '../abrir/desenho'
import type { CampoDoGrafico, JogoDeAbrir } from '../abrir/tipos'
import { BOCA, alvoEm, desenhar } from './arte'
import { roboHumano, roboRuim } from './robo'
import { abertura, amostra, criar, eventos, fim, passo, progresso, tempo } from './sim'
import type { Estado } from './sim'
import { DURACAO_SEQUENCIA, GANHO, SEQUENCIA, tocar } from './som'

/** Teclas que seguram o pé de cabra (event.code); todas valem o alvo único 0. */
export const TECLAS_DA_CAIXA: Readonly<Record<string, number>> = { Space: 0, Enter: 0, ArrowUp: 0, KeyW: 0 }

/** Linhas do gráfico do movimento da caixa. */
export const GRAFICO_DA_CAIXA: readonly CampoDoGrafico[] = [
  { chave: 'forca', rotulo: 'Força', min: 0, max: 1, cor: COR.ambar },
  { chave: 'faixaMin', rotulo: 'Faixa verde (baixo)', min: 0, max: 1, cor: COR.verde },
  { chave: 'faixaMax', rotulo: 'Faixa verde (alto)', min: 0, max: 1, cor: COR.verdeClaro },
  { chave: 'estagio', rotulo: 'Estágio da tábua', min: 0, max: 3, cor: COR.brasa },
  { chave: 'segurando', rotulo: 'Segurando', min: 0, max: 1, cor: COR.azul },
]

/** A caixa no contrato dos jogos de abrir. */
export const JOGO_CAIXA: JogoDeAbrir<Estado> = {
  id: 'caixa',
  nome: 'Caixa',
  instrucao: 'Segure para fazer força e solte com a barra na faixa verde: três trancos certos quebram a tábua.',
  objetivo: 'Segure para fazer força e solte na faixa verde. 3 trancos quebram a tábua.',
  // Faixa de parede acima da caixa (topo em y = 34) e do medidor (y = 36), à esquerda do halo da vela.
  areaDaDica: [4, 2, 200, 29],
  teclas: TECLAS_DA_CAIXA,
  grafico: GRAFICO_DA_CAIXA,
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
