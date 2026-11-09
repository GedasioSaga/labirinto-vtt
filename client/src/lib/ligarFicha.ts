import type { MapData, Token } from '../types/map'
import { novaVariacao } from './livros/combate'
import type { Personagem } from './personagem'

/**
 * LIGAR FICHA AO TOKEN (pedido de 09/11/2026: "eu criei token sem ficha mas
 * eu queria alocar essas fichas iguais a um npc/inimigo"). A conta pura:
 * qual personagem cada token passa a usar.
 *
 * CADA TOKEN COM A PRÓPRIA VIDA, como os monstros iguais: reaproveita a
 * VARIAÇÃO do mundo do livro (`novaVariacao`, `sincronizarVariacoes`), o
 * mesmo caminho do "Como <modelo>" da caixa "Quem entra na batalha?". A cópia
 * recebe do modelo atributos, máximos, abas (técnicas) e a ficha Dragon Ball,
 * e fica com o próprio HP/SP atual. Assim a barra do mapa, a batalha e a rede
 * já leem a vida de cada um sem saber desta tela.
 *
 *  - JOGADOR: é um só; todo token aponta para a mesma ficha.
 *  - NPC: o primeiro token usa a própria ficha se nenhum outro token do mapa
 *    a usa (o NPC único, como o lojista, continua ELE); daí em diante, cada
 *    token ganha uma cópia com o nome do token.
 */

/** O que muda em um token: um `addToken` a menos, um passo do Ctrl+Z só para todos (`ligarFichasAosTokens`). */
export interface MudancaDaLigacao {
  tokenId: string
  characterId: string | null
  /** A marca de NPC do token (a mesma regra do arrastar para o mapa). Ausente = fica como está. */
  npc?: boolean
  /** A foto do retrato, só no token SEM imagem própria. Ausente = a foto fica como está. */
  imageData?: string
}

export interface PlanoDaLigacao {
  /** Token → personagem que ele passa a usar (a ficha ou uma cópia nova). */
  ligacoes: { tokenId: string; personagemId: string }[]
  /** As cópias que nascem para isso, na ordem dos tokens. */
  copias: Personagem[]
  /** Tokens que já usavam esta ficha (ou uma cópia dela): ficam como estão. */
  jaLigados: number
}

type TokenDaLigacao = Pick<Token, 'id' | 'name' | 'characterId'>

/** A família da ficha: ela, o modelo-raiz e toda cópia do mesmo modelo. Token ligado a qualquer uma já está "com esta ficha". */
function familiaDa(ficha: Personagem, personagens: readonly Personagem[]): Set<string> {
  const raiz = ficha.combate?.modeloId ?? ficha.id
  const familia = new Set<string>([ficha.id, raiz])
  for (const personagem of personagens) if (personagem.combate?.modeloId === raiz) familia.add(personagem.id)
  return familia
}

/**
 * Quem cada token de `tokens` passa a usar. `doMapa` são TODOS os tokens da
 * cena (de todo piso): é por eles que se sabe se a ficha do NPC já está em
 * outro token. Token repetido em `tokens` conta uma vez.
 */
export function planejarLigacao(ficha: Personagem, tokens: readonly TokenDaLigacao[], doMapa: readonly Pick<Token, 'id' | 'characterId'>[], personagens: readonly Personagem[]): PlanoDaLigacao {
  const familia = familiaDa(ficha, personagens)
  const vistos = new Set<string>()
  const alvos: TokenDaLigacao[] = []
  let jaLigados = 0
  for (const token of tokens) {
    if (vistos.has(token.id)) continue
    vistos.add(token.id)
    if (token.characterId !== null && familia.has(token.characterId)) jaLigados += 1
    else alvos.push(token)
  }
  if (ficha.tipo === 'jogador') return { ligacoes: alvos.map((token) => ({ tokenId: token.id, personagemId: ficha.id })), copias: [], jaLigados }

  // A ficha está livre se nenhum token que FICA como está já a usa (os que mudam agora vão trocar de ficha).
  const mudam = new Set(alvos.map((token) => token.id))
  const usa = (token: Pick<Token, 'id' | 'characterId'>) => token.characterId === ficha.id && !mudam.has(token.id)
  let livre = !doMapa.some(usa) && !tokens.some(usa)
  const ligacoes: PlanoDaLigacao['ligacoes'] = []
  const copias: Personagem[] = []
  for (const token of alvos) {
    if (livre) {
      livre = false
      ligacoes.push({ tokenId: token.id, personagemId: ficha.id })
      continue
    }
    const copia = novaVariacao(ficha, token.name)
    copias.push(copia)
    ligacoes.push({ tokenId: token.id, personagemId: copia.id })
  }
  return { ligacoes, copias, jaLigados }
}

/** O token mostra o retrato da ficha só se não tem imagem própria (a que o mestre escolheu fica). */
export function tokenSemImagem(token: Pick<Token, 'image' | 'imageData'>): boolean {
  return token.image === null && (token.imageData ?? null) === null
}

/** O mapa com as mudanças aplicadas. Nenhum token mudou = o MESMO mapa (não gasta Ctrl+Z). */
export function mapaComAsLigacoes(map: MapData, mudancas: readonly MudancaDaLigacao[]): MapData {
  if (mudancas.length === 0) return map
  const porToken = new Map(mudancas.map((mudanca) => [mudanca.tokenId, mudanca]))
  let mudou = false
  const tokens = map.tokens.map((token) => {
    const mudanca = porToken.get(token.id)
    if (mudanca === undefined) return token
    const novo: Token = { ...token, characterId: mudanca.characterId }
    if (mudanca.npc !== undefined) novo.npc = mudanca.npc
    if (mudanca.imageData !== undefined) novo.imageData = mudanca.imageData
    if (novo.characterId === token.characterId && novo.npc === token.npc && novo.imageData === token.imageData) return token
    mudou = true
    return novo
  })
  return mudou ? { ...map, tokens } : map
}
