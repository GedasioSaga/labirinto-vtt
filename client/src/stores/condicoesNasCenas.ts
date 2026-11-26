import type { CondicaoPropria, MapData } from '../types/map'
import { fichasComCondicao, tirarCondicaoPropriaDasFichas, trocarCondicaoPropriaNasFichas } from '../lib/condicoesProprias'
import { condicoesDe, tirarCondicao } from '../lib/condicoes/naFicha'
import { useAdventureStore } from './adventureStore'
import { useMapStore } from './mapStore'
import { mesaDaAventura } from './mesaDaAventura'

/**
 * CONDIÇÃO CRIADA EM TODAS AS CENAS. Editar ou excluir uma condição da lista
 * vale para a aventura aberta inteira, e não só para a cena que está na tela:
 * a marca vai inteira dentro de cada ficha (`Token.condicoesProprias`), então a
 * cena que ficasse de fora continuaria mostrando o nome e a cor antigos — ou
 * uma condição que nem existe mais —, também para quem joga.
 *
 * A cena aberta muda pelo histórico dela (Ctrl+Z desfaz). As de fundo mudam
 * pelo `updateBackgroundScene`, o mesmo caminho do "Apagar cena…" e do pino de
 * viagem: ficam marcadas para o Salvar, e a que ainda está vindo do disco
 * recebe a mudança quando chega. A cena que não abriu (arquivo sumido) não tem
 * como ser alcançada: ela é contada, para o aviso dizer quantas ficaram.
 *
 * Outros mapas da mesma pasta do Carregar Mapa não estão abertos e não são
 * tocados aqui; neles a marca antiga continua na ficha até o mestre trocar.
 */

/** Onde uma condição criada está marcada, na aventura aberta. */
export interface AlcanceDaCondicao {
  /** Fichas que a levam, somando a cena aberta e as de fundo que abriram. */
  fichas: number
  /** Em quantas cenas essas fichas estão. */
  cenas: number
  /** Cenas da aventura que não abriram: não dá para ver nem mudar o que há nelas. */
  cenasFechadas: number
}

/** O id de cada cena de fundo da aventura aberta (mapa solto: nenhuma). */
function cenasDeFundo(): string[] {
  const { adventure, activeSceneId } = useAdventureStore.getState()
  if (adventure === null) return []
  return adventure.scenes.filter((cena) => cena.id !== activeSceneId).map((cena) => cena.id)
}

/** CONDIÇÕES NA FICHA (E4a): as fichas de personagem da aventura (ou da pasta) que levam a condição no `Personagem.condicoes`. */
function personagensComCondicao(condicaoId: string): string[] {
  return mesaDaAventura
    .personagens()
    .filter((personagem) => condicoesDe(personagem).some((condicao) => condicao.condId === condicaoId))
    .map((personagem) => personagem.id)
}

/**
 * Quantas fichas levam a condição, em quantas cenas, e quantas cenas não dá para alcançar. As
 * fichas de personagem que a levam (E4a) entram na conta de fichas: elas não moram em cena.
 */
export function alcanceDaCondicao(condicaoId: string): AlcanceDaCondicao {
  const { cache } = useAdventureStore.getState()
  const alcance: AlcanceDaCondicao = { fichas: personagensComCondicao(condicaoId).length, cenas: 0, cenasFechadas: 0 }
  const contar = (map: MapData): void => {
    const fichas = fichasComCondicao(map, condicaoId)
    if (fichas === 0) return
    alcance.fichas += fichas
    alcance.cenas += 1
  }
  contar(useMapStore.getState().map)
  for (const id of cenasDeFundo()) {
    const slot = cache[id]
    if (slot !== undefined && slot.status === 'ok') contar(slot.map)
    // A que está vindo do disco ainda vai receber a mudança (`pending`): só a que não abriu fica de fora.
    else if (slot === undefined || slot.status === 'indisponivel') alcance.cenasFechadas += 1
  }
  return alcance
}

function emTodasAsCenas(naAberta: () => void, mudar: (map: MapData) => MapData): void {
  naAberta()
  const { updateBackgroundScene } = useAdventureStore.getState()
  for (const id of cenasDeFundo()) updateBackgroundScene(id, mudar)
}

/** O mestre editou a condição: toda ficha que a leva, em toda cena da aventura, passa a mostrar o nome, a cor e o símbolo novos. */
export function trocarCondicaoEmTodasAsCenas(condicao: CondicaoPropria): void {
  emTodasAsCenas(
    () => useMapStore.getState().trocarCondicaoPropriaNasFichas(condicao),
    (map) => trocarCondicaoPropriaNasFichas(map, condicao),
  )
}

/**
 * O mestre excluiu a condição: ela sai de toda ficha, em toda cena da aventura, e (E4a) de toda
 * ficha de personagem que a leva. Editar não precisa disto: a ficha de personagem guarda só o id,
 * e o nome e a cor novos valem sozinhos.
 */
export function tirarCondicaoDeTodasAsCenas(condicaoId: string): void {
  emTodasAsCenas(
    () => useMapStore.getState().tirarCondicaoPropriaDasFichas(condicaoId),
    (map) => tirarCondicaoPropriaDasFichas(map, condicaoId),
  )
  for (const personagemId of personagensComCondicao(condicaoId)) mesaDaAventura.ajustarPersonagem(personagemId, (atual) => tirarCondicao(atual, condicaoId))
}
