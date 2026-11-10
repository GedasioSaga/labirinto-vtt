import { ladoDoNpc, type LadoDoNpc } from '../../lib/batalha/equipes'
import { fichaDaEscolha, modelosDeNpc, quemPodeEntrar, type CandidatoDaBatalha, type EscolhaDaBatalha } from '../../lib/livros/combate'
import type { Personagem } from '../../lib/personagem'
import { equipesAtivas, personagensAtivos, sistemaAtivo, useAdventureStore } from '../../stores/adventureStore'
import { useMapStore } from '../../stores/mapStore'
import { sistemaPorId, useRpgStore } from '../../stores/rpgStore'
import { useToastStore } from '../../stores/toastStore'
import { fichasSelecionadasNoMapa } from './escolhaNoMapa'
import { porNpcNoLado } from './ladoDoNpcNaTela'
import { nomesNumerados } from './nomesNumerados'

/**
 * Conserto de 09/11/2026 (achados 2 e 3): o que a lista de quem entra precisa
 * ler e fazer, num lugar só, para o "Iniciar batalha" e o "Incluir na batalha"
 * usarem a MESMA lista: os candidatos da cena, quem já vem marcado, e a
 * criação das fichas de quem entra sem ficha.
 */

/** A ficha da lista não pôde ser gravada (o mapa não tem onde guardar personagem): nada começa pela metade. */
const NAO_CRIOU_AS_FICHAS = 'Não deu para criar as fichas: este mapa não guarda personagens. Ninguém entrou.'

/** A foto da cena no momento em que a lista abre (ela não é modal: token que sair do mapa no meio fica de fora ao confirmar). */
export interface ListaDeQuemEntra {
  candidatos: CandidatoDaBatalha[]
  jogadoresSemFicha: number
  personagens: readonly Personagem[]
  modelos: Personagem[]
  /** O nome de cada token com o número dos repetidos ("Urso 1", "Urso 2"), pela ordem do mapa. */
  rotulos: ReadonlyMap<string, string>
  /** Quem vem marcado; ausente = todos com ficha de combate. */
  marcadosDePartida?: ReadonlySet<string>
  /** O lado de cada NPC com ficha quando a lista abriu. */
  ladoDe: (personagemId: string) => LadoDoNpc
}

/** O nome de cada ficha do mapa com o número dos repetidos; ficha sem nome não entra (segue com o nome da carta). */
export function rotulosDoMapa(): Map<string, string> {
  return nomesNumerados(
    useMapStore
      .getState()
      .map.tokens.filter((token) => token.name.trim() !== '')
      .map((token) => ({ id: token.id, nome: token.name })),
  )
}

/**
 * Lê a cena para a lista. O "Incluir" passa `jaNaOrdem` (quem já está na ordem
 * não aparece; a ficha escondida aparece, com "(escondida)" no nome, como no
 * "Fora da ordem" de antes). Chame ANTES de a lista tomar a seleção do mapa:
 * se o mestre tinha fichas selecionadas, só elas vêm marcadas (no Iniciar, com
 * os jogadores). Sem seleção: no Iniciar, todos com ficha de combate; no
 * Incluir, ninguém.
 */
export function lerQuemPodeEntrar(opcoes: { jaNaOrdem?: ReadonlySet<string> } = {}): ListaDeQuemEntra {
  const incluindo = opcoes.jaNaOrdem !== undefined
  const aventura = useAdventureStore.getState()
  const sistema = sistemaPorId(useRpgStore.getState().biblioteca, sistemaAtivo(aventura)) ?? null
  const daCena = useMapStore.getState().map.tokens.filter((token) => opcoes.jaNaOrdem?.has(token.id) !== true)
  const escondidas = new Set(daCena.filter((token) => token.hidden === true).map((token) => token.id))
  // `quemPodeEntrar` deixa a ficha escondida de fora (o Iniciar não a põe na ordem); o Incluir a mostra.
  const tokens = incluindo ? daCena.map((token) => ({ ...token, hidden: false })) : daCena
  const personagens = personagensAtivos(aventura)
  const equipes = equipesAtivas(aventura)
  const todos = quemPodeEntrar(tokens, personagens, sistema)
  const ehNpc = new Set(tokens.filter((token) => token.npc === true).map((token) => token.id))
  // Token de JOGADOR sem ficha não ganha ficha mínima: fica fora da lista, e ela diz quantos.
  const candidatos = todos.filter((candidato) => candidato.situacao !== 'semFicha' || ehNpc.has(candidato.tokenId))
  const naLista = new Set(candidatos.filter((candidato) => candidato.situacao !== 'semHp').map((candidato) => candidato.tokenId))
  const selecionadas = fichasSelecionadasNoMapa().filter((tokenId) => naLista.has(tokenId))
  const jogadores = candidatos.filter((candidato) => candidato.situacao === 'combate' && personagens.find((personagem) => personagem.id === candidato.personagemId)?.tipo === 'jogador').map((candidato) => candidato.tokenId)
  const marcados = selecionadas.length > 0 ? new Set(incluindo ? selecionadas : [...selecionadas, ...jogadores]) : incluindo ? new Set<string>() : undefined
  const rotulos = rotulosDoMapa()
  if (incluindo) for (const candidato of candidatos) if (escondidas.has(candidato.tokenId)) rotulos.set(candidato.tokenId, `${rotulos.get(candidato.tokenId) ?? candidato.nome} (escondida)`)
  return {
    candidatos,
    jogadoresSemFicha: todos.length - candidatos.length,
    personagens,
    modelos: modelosDeNpc(personagens),
    rotulos,
    ...(marcados === undefined ? {} : { marcadosDePartida: marcados }),
    ladoDe: (personagemId) => ladoDoNpc(personagemId, equipes, personagens),
  }
}

/**
 * O confirmar da lista: cria as fichas escolhidas (mínima ou variação do
 * modelo, com o nome do token; ficam nos NPCs de combate, decisão D3), liga
 * cada token à ficha nova e põe cada NPC no lado escolhido. Devolve os tokens
 * que entram, com a ficha de agora; `null` = não deu para gravar as fichas.
 */
export function prepararQuemEntra(escolhas: readonly EscolhaDaBatalha[], lados: ReadonlyMap<string, LadoDoNpc>): { id: string; characterId: string; name: string }[] | null {
  const aventura = useAdventureStore.getState()
  const sistema = sistemaPorId(useRpgStore.getState().biblioteca, sistemaAtivo(aventura))
  const porToken = new Map(useMapStore.getState().map.tokens.map((token) => [token.id, token]))
  const personagens = personagensAtivos(aventura)
  const novas = new Map<string, Personagem>()
  for (const escolha of escolhas) {
    const token = porToken.get(escolha.tokenId)
    if (sistema === undefined || token === undefined) continue
    const ficha = fichaDaEscolha(escolha.como, sistema, token.name, personagens)
    if (ficha !== null) novas.set(escolha.tokenId, ficha)
  }
  if (novas.size > 0) {
    if (!aventura.adicionarPersonagens([...novas.values()])) {
      useToastStore.getState().push('error', NAO_CRIOU_AS_FICHAS)
      return null
    }
    // Cada ligação é um passo do desfazer do mapa, como o "Ligar token" da ficha.
    for (const [tokenId, ficha] of novas) useMapStore.getState().updateToken(tokenId, { characterId: ficha.id })
  }
  const rotulos = rotulosDoMapa()
  const entram: { id: string; characterId: string; name: string }[] = []
  for (const escolha of escolhas) {
    const token = porToken.get(escolha.tokenId)
    const characterId = novas.get(escolha.tokenId)?.id ?? token?.characterId ?? null
    // Token que saiu do mapa com a lista aberta, ou sem ficha: fica de fora.
    if (token === undefined || characterId === null) continue
    const lado = lados.get(escolha.tokenId)
    if (lado !== undefined) porNpcNoLado(characterId, lado)
    // Achado 4: o nome numerado vai na carta, e dela para o registro ("Urso 2 usa Mão nua").
    entram.push({ id: token.id, characterId, name: rotulos.get(token.id) ?? token.name })
  }
  return entram
}
