import { selectionOfItem } from '../lib/selectionModel'
import { IMAGEM_SUMIU_DO_ACERVO, pecaDoAcervo, type ItemDoAcervoNaTela } from '../lib/tokenLibrary'
import { findTokenSpawn, tokenRadiusFor, wallClearanceForScale } from '../lib/tokenPlacement'
import { viewportCenterWorld, type Point } from '../pixi/world'
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
  const { map: currentMap, camera, addToken, setSelection } = useMapStore.getState()
  const size = opts.size ?? NEW_TOKEN_SIZE
  const requested = opts.at ?? (vista ? viewportCenterWorld(camera, vista.width, vista.height) : { x: 0, y: 0 })
  const spot = findTokenSpawn(requested, currentMap.walls, {
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
    characterId: null,
    name,
    x: spot.x,
    y: spot.y,
    size,
    image: opts.image ?? null,
    imageData: opts.imageData ?? null,
    // Só grava a marca quando ela vale: ficha comum continua sem o campo,
    // igual ao mapa salvo antes dele existir.
    ...(opts.npc === true ? { npc: true } : {}),
  })
  setSelection(selectionOfItem({ kind: 'token', id }))
  return id
}

/**
 * ACERVO — a peça nasce no mapa com o que `trazerDoAcervo` já copiou para a
 * pasta do mapa (`foto`) e com a marca de NPC de `pecaDoAcervo`. Foto
 * ausente não impede a peça: ela entra com o nome certo e o círculo
 * genérico, e o toast diz o que sumiu — não colocar a peça seria punir a
 * pessoa por um problema do disco.
 */
export function colocarPecaDoAcervo(
  item: Pick<ItemDoAcervoNaTela, 'nome' | 'tamanho'>,
  tokenId: string,
  foto: { image: string | null; imageData: string | null },
  at: Point | undefined,
  vista: TamanhoDaVista | null,
): string | null {
  const id = criarToken(item.nome, { at, ...pecaDoAcervo(item, tokenId, foto) }, vista)
  if (id === null) return null
  if (foto.image === null && foto.imageData === null) useToastStore.getState().push('error', IMAGEM_SUMIU_DO_ACERVO)
  return id
}

/** Interruptor "Ficha de NPC" do painel: `updateToken` passa por `withHistory`, então marcar errado se desfaz com Ctrl+Z. */
export function marcarFichaNpc(tokenId: string, npc: boolean): void {
  useMapStore.getState().updateToken(tokenId, { npc })
}
