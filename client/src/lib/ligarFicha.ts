import type { MapData, Token } from '../types/map'
import { nomeDaProximaCopia } from './fichasNoAcervo'
import { ehInvocadoTemporario, novaVariacao, trocarForca } from './livros/combate'
import { textoDeBusca } from './pastasDeFichas'
import { forcaDe, type Personagem } from './personagem'

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
  /** O nome numerado da cópia ("Zumbi 2"), só no token que levava o nome da ficha. Ausente = o nome fica como está. */
  name?: string
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
    // Cópia NUMERADA (decisão de 25/11/2026): três tokens "Zumbi" ligam "Zumbi 2" e "Zumbi 3", não três "Zumbi".
    const copia = novaVariacao(ficha, nomeDaCopiaDoToken(token, ficha, [...personagens, ...copias]))
    copias.push(copia)
    ligacoes.push({ tokenId: token.id, personagemId: copia.id })
  }
  return { ligacoes, copias, jaLigados }
}

/** O token que ainda vai nascer: não está no mapa, então não conta como "já usa a ficha". */
const TOKEN_QUE_VAI_NASCER = '__token-novo__'

/**
 * NPCs NO ACERVO, decisão 8: a ficha do token NOVO que a ficha põe no mapa
 * ("+" ou arrasto). A mesma regra do "Ligar ficha" (`planejarLigacao`): NPC
 * que nenhum token do mapa usa entra ele mesmo; NPC que JÁ está no mapa ganha
 * uma CÓPIA (`nomeDaCopia`, "Goblin 2"), cada token com a própria vida. A
 * cópia leva a mochila do modelo com vagas novas: uma mochila por ficha, e a
 * da cópia não divide item com a do modelo. Jogador: sempre a mesma ficha.
 */
export function fichaDoTokenNovo(
  ficha: Personagem,
  doMapa: readonly Pick<Token, 'id' | 'characterId'>[],
  personagens: readonly Personagem[],
  nomeDaCopia: string,
): { personagemId: string; copia: Personagem | null } {
  const plano = planejarLigacao(ficha, [{ id: TOKEN_QUE_VAI_NASCER, name: nomeDaCopia, characterId: null }], doMapa, personagens)
  const copia = plano.copias[0]
  if (copia === undefined) return { personagemId: ficha.id, copia: null }
  const comMochila = comVagasNovas(copia)
  return { personagemId: comMochila.id, copia: comMochila }
}

/**
 * A cópia com a mochila do modelo em vagas novas: uma mochila por ficha, e a
 * da cópia não divide item com a do modelo. Mesmo formato de
 * `mochilaComVagasNovas` (lib/tokenLibrary.ts), sem trazer o disco do acervo
 * para esta conta pura.
 */
function comVagasNovas(copia: Personagem): Personagem {
  if (copia.mochila === undefined) return copia
  return { ...copia, mochila: copia.mochila.map((vaga) => ({ ...vaga, id: `item_${crypto.randomUUID()}` })) }
}

// ───────────────────────────────────────────────────────────────────────────
// UMA FICHA POR TOKEN DE NPC (bug de 25/11/2026: "se uma ficha toma o dano
// todas as outras também tomam"). Decisão do dono: a ficha de NPC posta
// várias vezes é o MODELO; cada token é uma cópia numerada ("Zumbi 2") com
// vida, recursos, mochila e posição próprios, e nome, foto, regras e técnicas
// vindos do modelo (a VARIAÇÃO, `sincronizarVariacoes`). Jogador: uma só.
// ───────────────────────────────────────────────────────────────────────────

/** A ficha é de um token só na cena: NPC e monstro. O jogador é um só em todo token; o invocado temporário já nasce um por token. */
export function fichaDeUmTokenSo(personagem: Personagem): boolean {
  return personagem.tipo !== 'jogador' && !ehInvocadoTemporario(personagem)
}

export interface OpcoesDasFichasProprias {
  /** Só estes tokens podem trocar de ficha (os que acabaram de nascer de Ctrl+D, Ctrl+V ou Alt+arrastar). Ausente = qualquer um da cena. */
  quemMuda?: ReadonlySet<string>
  /** Tokens que NÃO trocam de ficha: os que já estão na ordem da batalha (a carta lê pelo personagem). */
  fixos?: ReadonlySet<string>
  /**
   * `true`: a cópia fica com a vida, os cartões ligados e o estado da mesa
   * Dragon Ball ATUAIS da ficha (o token já estava no mapa, mostrando essa
   * vida). `false`: nasce cheia, como a do "+" do acervo.
   */
  herdarEstado: boolean
}

export interface PlanoDasFichasProprias {
  /** Token → a cópia nova (e o nome numerado, se o token levava o nome da ficha). */
  mudancas: MudancaDaLigacao[]
  /** As cópias que nascem para isso, na ordem dos tokens. */
  copias: Personagem[]
}

/**
 * O nome da cópia do token: o do token, se ninguém da lista o usa (o "Zumbi
 * da porta" que o mestre deu); senão o numerado do modelo ("Zumbi 2",
 * `nomeDaProximaCopia`), como a cópia do "+" do acervo.
 */
function nomeDaCopiaDoToken(token: Pick<Token, 'name'>, ficha: Personagem, lista: readonly Personagem[]): string {
  const proprio = token.name.trim()
  const usado = proprio === '' || lista.some((personagem) => textoDeBusca(personagem.nome) === textoDeBusca(proprio))
  return usado ? nomeDaProximaCopia(ficha, lista) : proprio
}

/**
 * A cópia de um token: variação do modelo-raiz (`novaVariacao`), com a força
 * da ficha de onde veio (a cheia continua cheia, `trocarForca`), "Só no
 * cenário" se ela era, retrato vazio (segue o do modelo, `sincronizarVariacoes`)
 * e a mochila do modelo em vagas novas.
 */
function copiaDoToken(ficha: Personagem, nome: string, herdarEstado: boolean): Personagem {
  const comForca = trocarForca(novaVariacao(ficha, nome), forcaDe(ficha))
  const copia: Personagem = comVagasNovas({ ...comForca, retrato: null, ...(ficha.soCenario === true ? { soCenario: true } : {}) })
  if (!herdarEstado) return copia
  copia.recursos = { ...ficha.recursos }
  copia.cartoesAtivos = [...ficha.cartoesAtivos]
  if (ficha.dbt !== undefined && copia.dbt !== undefined) {
    copia.dbt = { ...copia.dbt, transformacaoAtiva: ficha.dbt.transformacaoAtiva, kiBloqueado: ficha.dbt.kiBloqueado, contadores: ficha.dbt.contadores.map((contador) => ({ ...contador })) }
  }
  return copia
}

/**
 * Quais tokens de `tokens` (TODOS da cena, de todo piso, na ordem do mapa)
 * ganham cópia: entre os tokens de NPC com a MESMA ficha, um fica com ela —
 * o primeiro que não pode mudar (fixo ou fora de `quemMuda`), senão o
 * primeiro da cena — e cada um dos outros ganha a sua. Ficha que sumiu da
 * lista, de jogador ou de invocado: fica como está.
 */
export function planejarFichasProprias(tokens: readonly TokenDaLigacao[], personagens: readonly Personagem[], opcoes: OpcoesDasFichasProprias): PlanoDasFichasProprias {
  const porId = new Map(personagens.map((personagem) => [personagem.id, personagem]))
  const porFicha = new Map<string, { ficha: Personagem; tokens: TokenDaLigacao[] }>()
  for (const token of tokens) {
    const ficha = token.characterId === null ? undefined : porId.get(token.characterId)
    if (ficha === undefined || !fichaDeUmTokenSo(ficha)) continue
    const grupo = porFicha.get(ficha.id)
    if (grupo === undefined) porFicha.set(ficha.id, { ficha, tokens: [token] })
    else grupo.tokens.push(token)
  }
  const podeMudar = (token: TokenDaLigacao) => opcoes.fixos?.has(token.id) !== true && (opcoes.quemMuda === undefined || opcoes.quemMuda.has(token.id))
  const mudancas: MudancaDaLigacao[] = []
  const copias: Personagem[] = []
  for (const { ficha, tokens: daFicha } of porFicha.values()) {
    if (daFicha.length < 2) continue
    const mudam = daFicha.filter(podeMudar)
    // Todos podem mudar: o primeiro da cena fica com a ficha (o NPC que já estava lá).
    const ganhamCopia = mudam.length === daFicha.length ? mudam.slice(1) : mudam
    for (const token of ganhamCopia) {
      const nome = nomeDaCopiaDoToken(token, ficha, [...personagens, ...copias])
      // Só o token que levava o nome da ficha troca de nome; o nome que o mestre deu fica.
      const proprio = token.name.trim()
      const renomeia = proprio === '' || textoDeBusca(proprio) === textoDeBusca(ficha.nome)
      const copia = copiaDoToken(ficha, nome, opcoes.herdarEstado)
      copias.push(copia)
      mudancas.push({ tokenId: token.id, characterId: copia.id, ...(renomeia && nome !== token.name ? { name: nome } : {}) })
    }
  }
  return { mudancas, copias }
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
    if (mudanca.name !== undefined) novo.name = mudanca.name
    if (novo.characterId === token.characterId && novo.npc === token.npc && novo.imageData === token.imageData && novo.name === token.name) return token
    mudou = true
    return novo
  })
  return mudou ? { ...map, tokens } : map
}
