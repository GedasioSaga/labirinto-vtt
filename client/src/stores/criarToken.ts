import * as mapFactory from '../lib/mapFactory'
import {
  extrasDaPeca,
  fichaQueEntra,
  IMAGEM_SUMIU_DO_ACERVO,
  luzesDaPecaNoMapa,
  mochilaComVagasNovas,
  pecaDoAcervo,
  type ExtrasDaPeca,
  type ItemDoAcervoNaTela,
} from '../lib/tokenLibrary'
import { tamanhoPadraoDaCena } from '../lib/tamanhoAoEntrar'
import { findTokenSpawn, tokenRadiusFor, wallClearanceForScale } from '../lib/tokenPlacement'
import { viewportCenterWorld, type Point } from '../pixi/world'
import type { CarriedItem, Token } from '../types/map'
import { personagensAtivos, sistemaAtivo, useAdventureStore } from './adventureStore'
import { useMapStore } from './mapStore'
import { useToastStore } from './toastStore'

/** Toda peça nova nasce ocupando uma célula; o painel muda o tamanho depois. */
export const NEW_TOKEN_SIZE = 1
/** Diz por que nenhuma peça apareceu, com o que fazer a seguir — silêncio aqui é o defeito que esta mudança conserta. */
export const NO_TOKEN_SPOT_TEXT = 'Sem lugar livre para a peça aqui: as paredes em volta não deixam espaço. Mova a vista para um trecho vazio e tente de novo.'

/** Como a peça nova nasce. Tudo ausente = ficha comum de uma célula, sem foto, no centro da vista. */
export interface OpcoesDaFichaNova {
  at?: Point
  size?: number
  id?: string
  image?: string | null
  imageData?: string | null
  npc?: boolean
  /** A ficha de personagem ligada (`Token.characterId`); ausente = sem personagem. */
  characterId?: string
  /** O piso em edição; ausente ou 0 = o térreo (o campo não é gravado). */
  piso?: number
  /** A mochila com que a peça nasce (a do acervo); ausente ou vazia = sem o campo. */
  mochila?: CarriedItem[]
  /** A bolsa com que a peça nasce; ausente = sem o campo. */
  moedas?: number
}

/** Área do canvas em px de tela; `null` = o canvas ainda não está montado. */
export interface TamanhoDaVista {
  width: number
  height: number
}

/**
 * Token nasce no centro da área visível do canvas (câmera da store, que o
 * PixiCanvas mantém em dia a cada pan/zoom) e já selecionado, para o painel
 * mostrar o Nome dele. Sem o canvas montado cai em (0,0), como antes.
 * `at` (ferramenta Token, clique no mapa) troca o centro pelo ponto clicado.
 *
 * O ponto pedido é só o PEDIDO: `findTokenSpawn` (lib/tokenPlacement.ts)
 * empurra a peça para o lugar livre mais perto quando o disco cairia em
 * cima da linha de uma parede — antes disto, com a vista enquadrada numa
 * parede, a peça nascia atravessada nela e o app não dizia nada. Vale
 * também para o clique da ferramenta Token: o usuário aponta mais ou menos,
 * o app assenta a peça onde ela cabe. Sem lugar livre por perto ele não
 * cria peça nenhuma e FALA por quê (toast), em vez de largar na parede.
 *
 * Lê mapa e câmera de `getState()`: o handler do App também vai como prop
 * para dentro do PixiCanvas, e lá um valor capturado no render pode ser de
 * um render anterior. Mora fora do App para o teste passar pelo MESMO código
 * que o botão e o acervo usam, sem montar o editor inteiro.
 */
export function criarToken(name: string, opts: OpcoesDaFichaNova, vista: TamanhoDaVista | null): string | null {
  const { map: currentMap, camera, addToken } = useMapStore.getState()
  // TAMANHO AO ENTRAR (`lib/tamanhoAoEntrar.ts`): na cena com padrão, toda ficha
  // nova nasce nele — também a do acervo e a do personagem do livro. Sem padrão,
  // o tamanho pedido (o do acervo) ou uma casa.
  const size = tamanhoPadraoDaCena(currentMap) ?? opts.size ?? NEW_TOKEN_SIZE
  const requested = opts.at ?? (vista ? viewportCenterWorld(camera, vista.width, vista.height) : { x: 0, y: 0 })
  const pisoDaFicha = opts.piso ?? 0
  const spot = findTokenSpawn(requested, currentMap.walls, {
    // Caça 12/11 (E8): dois "+ Token" seguidos não nascem um em cima do outro.
    ocupadas: currentMap.tokens.filter((token) => (token.piso ?? 0) === pisoDaFicha),
    // O raio acompanha o TAMANHO da peça: o NPC de 2 células vindo do acervo
    // precisa de mais espaço livre que o disco de uma célula, e medir pelo
    // tamanho fixo o assentaria encostado na parede.
    radius: tokenRadiusFor(currentMap.grid, size),
    clearance: wallClearanceForScale(camera.scale),
  })
  if (spot === null) {
    useToastStore.getState().push('error', NO_TOKEN_SPOT_TEXT)
    return null
  }
  // A foto entra JUNTO com a peça, num `addToken` só: criar a peça e depois
  // chamar `setTokenImage` empilhava DUAS entradas de desfazer para um clique
  // (o primeiro Ctrl+Z tirava só a foto), e a segunda, chegando depois da
  // cópia do arquivo, ainda podia rodar sobre um mapa que já não tinha esse
  // token — um no-op silencioso que mesmo assim zerava o Refazer.
  const id = opts.id ?? crypto.randomUUID()
  addToken({
    id,
    characterId: opts.characterId ?? null,
    name,
    x: spot.x,
    y: spot.y,
    size,
    image: opts.image ?? null,
    imageData: opts.imageData ?? null,
    // Só grava a marca quando ela vale: ficha comum continua sem o campo,
    // igual ao mapa salvo antes dele existir.
    ...(opts.npc === true ? { npc: true } : {}),
    ...(opts.piso !== undefined && opts.piso !== 0 ? { piso: opts.piso } : {}),
    ...(opts.mochila !== undefined && opts.mochila.length > 0 ? { mochila: opts.mochila } : {}),
    ...(opts.moedas !== undefined ? { moedas: opts.moedas } : {}),
  })
  // Caça 12/11 (E7, decisão 15): a ficha nova não é selecionada; o painel fica onde estava.
  return id
}

/** Por que a ficha da peça não entrou na mesa aberta. */
export type FichaDeFora = 'sem-sistema' | 'outro-sistema' | 'recusada'

/** A peça tinha ficha e a mesa aberta não a recebeu: a peça entra, a ficha não, e o mestre ouve por quê. */
export function fichaFicouNaEstante(nome: string, motivo: FichaDeFora): string {
  if (motivo === 'sem-sistema') {
    return `${nome} entrou sem a ficha: esta mesa não tem sistema de RPG (o mapa solto não guarda fichas). Abra a peça numa aventura com sistema para ela vir com a ficha.`
  }
  if (motivo === 'outro-sistema') return `${nome} entrou sem a ficha: ela foi feita em outro sistema de RPG. O resto da peça veio junto.`
  return `${nome} entrou sem a ficha: esta mesa não aceitou a ficha nova agora. O resto da peça veio junto.`
}

/**
 * ACERVO — a peça nasce no mapa com o que `trazerDoAcervo` já copiou para a
 * pasta do mapa (`foto`) e com a marca de NPC de `pecaDoAcervo`. Foto
 * ausente não impede a peça: ela entra com o nome certo e o círculo
 * genérico, e o toast diz o que sumiu — não colocar a peça seria punir a
 * pessoa por um problema do disco.
 *
 * O QUE A PEÇA LEVA (análise de 18/11/2026, §2.4): a mochila e a bolsa com
 * vagas novas; a ficha, como personagem NOVO da aventura (a mesma peça posta
 * duas vezes são dois goblins, cada um com a sua vida), quando o sistema é o
 * mesmo; e as tochas presas no centro dela. Com ficha, a mochila mora na ficha
 * (a dona, `lib/mochila/espelho.ts`) e a peça a mostra.
 */
export function colocarPecaDoAcervo(
  item: Pick<ItemDoAcervoNaTela, 'nome' | 'tamanho'> & ExtrasDaPeca,
  tokenId: string,
  foto: { image: string | null; imageData: string | null },
  at: Point | undefined,
  vista: TamanhoDaVista | null,
): string | null {
  const aventura = useAdventureStore.getState()
  const sistemaId = sistemaAtivo(aventura)
  const mochila = mochilaComVagasNovas(item.mochila ?? [])
  const ficha = fichaQueEntra(item, sistemaId, { mochila, moedas: item.moedas })
  // A ficha entra ANTES da peça, para a peça já nascer ligada a ela: sem um
  // instante em que o `characterId` aponta para ninguém.
  const fichaEntrou = ficha !== null && aventura.adicionarPersonagens([ficha])
  const id = criarToken(
    item.nome,
    {
      at,
      ...pecaDoAcervo(item, tokenId, foto),
      ...(ficha !== null && fichaEntrou ? { characterId: ficha.id } : {}),
      mochila,
      moedas: item.moedas,
    },
    vista,
  )
  if (id === null) {
    // Sem lugar para a peça: a ficha que acabou de entrar sai (nada fica pela metade).
    if (ficha !== null && fichaEntrou) useAdventureStore.getState().apagarPersonagem(ficha.id)
    return null
  }
  colocarTochasDaPeca(id, item)
  if (foto.image === null && foto.imageData === null) useToastStore.getState().push('error', IMAGEM_SUMIU_DO_ACERVO)
  if (item.ficha !== undefined && !fichaEntrou) {
    const motivo: FichaDeFora = sistemaId === undefined ? 'sem-sistema' : ficha === null ? 'outro-sistema' : 'recusada'
    useToastStore.getState().push('info', fichaFicouNaEstante(item.nome, motivo))
  }
  return id
}

/**
 * As tochas da peça entram no MESMO passo do desfazer dela: `criarToken` já
 * pôs o mapa de antes em `past`, e este `setState` só troca o mapa de agora,
 * sem passo novo. Um Ctrl+Z tira a peça e as tochas juntas, como um clique as
 * pôs; com `addLight` seriam um passo por tocha, e o primeiro Ctrl+Z deixaria
 * a peça no escuro.
 */
function colocarTochasDaPeca(tokenId: string, extras: Pick<ExtrasDaPeca, 'luzes'>): void {
  const luzes = extras.luzes ?? []
  if (luzes.length === 0) return
  useMapStore.setState((state) => {
    const peca = state.map.tokens.find((token) => token.id === tokenId)
    if (peca === undefined) return {}
    const novas = luzesDaPecaNoMapa(luzes, peca, state.map.grid)
    return { map: novas.reduce((mapa, luz) => mapFactory.addLight(mapa, luz), state.map) }
  })
}

/**
 * O que a peça leva para a estante, lido da mesa aberta AGORA: as tochas do
 * mapa aberto, a ficha da lista em uso e o sistema dela (`extrasDaPeca`).
 * `getState()`, e não valor do render, pelo mesmo motivo de `criarToken`.
 */
export function extrasDoTokenParaOAcervo(token: Token): ExtrasDaPeca {
  const { map } = useMapStore.getState()
  const aventura = useAdventureStore.getState()
  return extrasDaPeca(token, {
    luzes: map.lights,
    grade: map.grid,
    personagens: personagensAtivos(aventura),
    sistemaId: sistemaAtivo(aventura),
  })
}

/** Interruptor "Ficha de NPC" do painel: `updateToken` passa por `withHistory`, então marcar errado se desfaz com Ctrl+Z. */
export function marcarFichaNpc(tokenId: string, npc: boolean): void {
  useMapStore.getState().updateToken(tokenId, { npc })
}
