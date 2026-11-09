import { planejarLigacao, tokenSemImagem, type MudancaDaLigacao } from '../lib/ligarFicha'
import { personagensAtivos, useAdventureStore } from './adventureStore'
import { useMapStore } from './mapStore'
import { fotoDoRetrato } from './porPersonagemNoMapa'
import { useToastStore } from './toastStore'

/**
 * LIGAR FICHA AO TOKEN, as três portas (soltar a ficha do painel EM CIMA do
 * token, "Ligar ficha ›" no botão direito, e vários tokens selecionados de
 * uma vez) passam por aqui: a conta é `planejarLigacao`; as cópias entram na
 * lista dos personagens (a pasta ou a aventura) e os tokens mudam num passo
 * só do Ctrl+Z. A foto do retrato é lida ANTES, como no arrastar para o mapa;
 * se a cena trocou durante a leitura, nada muda na cena errada.
 */

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`
}

/** `true` = algum token mudou. */
export async function ligarFichaAosTokens(fichaId: string, tokenIds: readonly string[]): Promise<boolean> {
  const toast = useToastStore.getState()
  const ficha = personagensAtivos(useAdventureStore.getState()).find((personagem) => personagem.id === fichaId)
  if (ficha === undefined) {
    toast.push('error', 'Essa ficha não está mais na lista de personagens.')
    return false
  }
  const mapaId = useMapStore.getState().map.id
  const precisaDeFoto = useMapStore
    .getState()
    .map.tokens.some((token) => tokenIds.includes(token.id) && tokenSemImagem(token))
  const foto = precisaDeFoto ? await fotoDoRetrato(ficha.retrato) : null

  const { map } = useMapStore.getState()
  if (map.id !== mapaId) return false
  // Relida DEPOIS da foto: o mestre pode ter mexido nos tokens (ou na lista) enquanto ela chegava.
  const personagens = personagensAtivos(useAdventureStore.getState())
  const atual = personagens.find((personagem) => personagem.id === fichaId)
  const tokens = tokenIds.map((id) => map.tokens.find((token) => token.id === id)).filter((token) => token !== undefined)
  if (atual === undefined || tokens.length === 0) return false

  const plano = planejarLigacao(atual, tokens, map.tokens, personagens)
  if (plano.ligacoes.length === 0) {
    toast.push('info', tokens.length === 1 ? `Este token já usa a ficha de ${atual.nome}.` : `Esses tokens já usam a ficha de ${atual.nome}.`)
    return false
  }
  if (plano.copias.length > 0 && !useAdventureStore.getState().adicionarPersonagens(plano.copias)) {
    toast.push('error', 'Não deu para guardar as cópias da ficha: o mapa precisa estar numa aventura ou numa pasta com sistema de RPG.')
    return false
  }
  const porId = new Map(tokens.map((token) => [token.id, token]))
  const mudancas: MudancaDaLigacao[] = plano.ligacoes.map(({ tokenId, personagemId }) => {
    const token = porId.get(tokenId)
    const comFoto = foto !== null && token !== undefined && tokenSemImagem(token)
    return { tokenId, characterId: personagemId, npc: atual.tipo === 'npc', ...(comFoto ? { imageData: foto } : {}) }
  })
  useMapStore.getState().ligarFichasAosTokens(mudancas)

  const n = plano.ligacoes.length
  const quem = n === 1 ? `${tokens.length === 1 ? 'O token' : '1 token'} agora usa a ficha de ${atual.nome}` : `${n} tokens agora usam a ficha de ${atual.nome}`
  const vida = atual.tipo === 'npc' && n + plano.jaLigados > 1 ? ', cada um com a própria vida' : ''
  const ja = plano.jaLigados > 0 ? ` (${plural(plano.jaLigados, 'já estava', 'já estavam')} com ela)` : ''
  toast.push('info', `${quem}${vida}${ja}. Ctrl+Z desfaz.`)
  return true
}

/** "Desligar ficha": os tokens voltam a ser só tokens (a foto e o nome ficam). Um passo do Ctrl+Z. */
export function desligarFichaDosTokens(tokenIds: readonly string[]): boolean {
  const { map } = useMapStore.getState()
  const ligados = map.tokens.filter((token) => tokenIds.includes(token.id) && token.characterId !== null)
  if (ligados.length === 0) return false
  useMapStore.getState().ligarFichasAosTokens(ligados.map((token) => ({ tokenId: token.id, characterId: null })))
  useToastStore.getState().push('info', `${ligados.length === 1 ? 'Ficha desligada do token' : `Ficha desligada de ${ligados.length} tokens`}. Ctrl+Z desfaz.`)
  return true
}
