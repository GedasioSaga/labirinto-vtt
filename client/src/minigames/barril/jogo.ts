/**
 * JOGO DO BARRIL: junta a simulação, a arte, o som e os robôs no contrato
 * `JogoDeAbrir`, que a vitrine, as provas e o porte para o app usam sem
 * conhecer o barril por dentro.
 */
import { COR } from '../abrir/desenho'
import { BOCA, alvoEm, desenhar } from './arte'
import { roboHumano, roboRuim } from './robo'
import { abertura, amostra, criar, eventos, fim, passo, progresso, tempo } from './sim'
import { DURACAO_SEQUENCIA, GANHO, SEQUENCIA, tocar } from './som'
import type { CampoDoGrafico, JogoDeAbrir } from '../abrir/tipos'
import type { Estado } from './sim'

/** Linhas do gráfico do movimento: o brilho de cada aro, o progresso e as marcas de golpe. */
const GRAFICO: readonly CampoDoGrafico[] = [
  { chave: 'b0', rotulo: 'brilho do aro de cima', min: 0, max: 1, cor: COR.ouro },
  { chave: 'b1', rotulo: 'brilho do aro do meio', min: 0, max: 1, cor: COR.ambar },
  { chave: 'b2', rotulo: 'brilho do aro de baixo', min: 0, max: 1, cor: COR.chama },
  { chave: 'progresso', rotulo: 'progresso', min: 0, max: 1, cor: COR.verde },
  { chave: 'golpe', rotulo: 'golpe certo', min: 0, max: 1, cor: COR.verdeClaro },
  { chave: 'escorrega', rotulo: 'escorregão', min: 0, max: 1, cor: COR.brasa },
]

/** O barril: golpes no ritmo dos aros; martelar sem ritmo escorrega e não progride. */
export const JOGO_BARRIL: JogoDeAbrir<Estado> = {
  id: 'barril',
  nome: 'Barril',
  instrucao: 'Bata quando o aro brilhar: clique, toque ou Espaço no pico do brilho. Fora do tempo, o martelo escorrega.',
  objetivo: 'Bata quando o aro brilhar até o barril quebrar. Fora do ritmo, o martelo escorrega.',
  // O barril ocupa o alto do meio (topo em y = 16): a dica fica na parede à esquerda dele.
  areaDaDica: [4, 2, 68, 90],
  teclas: { Space: 0, Enter: 0, ArrowUp: 0, KeyW: 0 },
  grafico: GRAFICO,
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
