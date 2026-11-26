import { mapaComAsLigacoes, planejarFichasProprias, type MudancaDaLigacao, type PlanoDasFichasProprias } from '../lib/ligarFicha'
import { personagensAtivos, useAdventureStore } from './adventureStore'
import { useMapStore } from './mapStore'

/**
 * UMA FICHA POR TOKEN DE NPC (bug de 25/11/2026: "jogo a mesma ficha do mesmo
 * monstro várias vezes, tipo os zumbis [...] se uma ficha toma o dano todas
 * as outras também tomam"). A batalha, a barra do mapa e o ajuste rápido leem
 * pela ficha do token (`characterId`): dois tokens com a mesma ficha dividiam
 * a vida. Aqui cada token de NPC repetido ganha a CÓPIA dele (a variação do
 * modelo, `planejarFichasProprias`), por três portas:
 *
 *  - Ctrl+D, Ctrl+V e Alt+arrastar (`comFichaPropriaNasCopias`): a cópia do
 *    token nasce cheia, no MESMO passo do Ctrl+Z do clone.
 *  - a cena aberta com ficha repetida, de save antigo (`useFichaPropriaPorToken`)
 *    e a entrada da batalha (`separarFichasRepetidasDaCena`): a cópia fica com
 *    a vida de agora, fora do Ctrl+Z e em todo o histórico do mapa.
 */

/**
 * As cópias entram na lista (a aventura ou a pasta); devolve só as mudanças
 * cuja cópia está lá de verdade: a pasta publicada no Lobby pode recusar a
 * gravação, e token ligado a ficha que não existe ficaria "sem ficha".
 */
function guardarCopias(plano: PlanoDasFichasProprias): MudancaDaLigacao[] {
  if (plano.copias.length === 0) return []
  if (!useAdventureStore.getState().adicionarPersonagens(plano.copias)) return []
  const naLista = new Set(personagensAtivos(useAdventureStore.getState()).map((personagem) => personagem.id))
  return plano.mudancas.filter((mudanca) => mudanca.characterId !== null && naLista.has(mudanca.characterId))
}

/**
 * Roda `clonar` (Ctrl+D, Ctrl+V, Alt+arrastar) e dá ficha própria a cada
 * token de NPC que nasceu dele e divide a ficha com outro token da cena. O
 * mapa muda sem passo novo, como as tochas da peça (`colocarTochasDaPeca`):
 * o Ctrl+Z do clone tira o token e a ligação juntos. A cópia da ficha fica na
 * lista depois do Ctrl+Z, como a do "+" do acervo.
 */
export function comFichaPropriaNasCopias<T>(clonar: () => T): T {
  const antes = new Set(useMapStore.getState().map.tokens.map((token) => token.id))
  const resultado = clonar()
  const { map } = useMapStore.getState()
  const novos = new Set(map.tokens.filter((token) => !antes.has(token.id)).map((token) => token.id))
  if (novos.size === 0) return resultado
  const plano = planejarFichasProprias(map.tokens, personagensAtivos(useAdventureStore.getState()), { quemMuda: novos, herdarEstado: false })
  const mudancas = guardarCopias(plano)
  if (mudancas.length > 0) useMapStore.setState((state) => ({ map: mapaComAsLigacoes(state.map, mudancas) }))
  return resultado
}

/**
 * A rede de segurança: todo token de NPC da cena aberta que divide a ficha
 * com outro (menos um, que fica com ela) ganha a cópia com a vida, os
 * cartões ligados e o estado da mesa de AGORA. `fixos`: os tokens que já
 * estão na ordem da batalha não trocam de ficha. Devolve quantos tokens
 * ganharam ficha própria.
 */
export function separarFichasRepetidasDaCena(fixos?: ReadonlySet<string>): number {
  const { map } = useMapStore.getState()
  const plano = planejarFichasProprias(map.tokens, personagensAtivos(useAdventureStore.getState()), { ...(fixos === undefined ? {} : { fixos }), herdarEstado: true })
  const mudancas = guardarCopias(plano)
  useMapStore.getState().religarFichasEmTodoOHistorico(mudancas)
  return mudancas.length
}
