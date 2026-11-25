import type { Drawing, FloorPiece, MapData, PinceladaDeTextura, Region } from '../types/map'
import { pecasQueLimitam } from './terrenoDoChao'
import { comAguasComoChao } from './agua/comoChao'
import { celulasDoChaoPintado, formasDeChao, type FormaDeChao } from './chaoPintado'
import { pisoDe } from './pisos'
import type { Caixa } from './texturas'

/**
 * FORA DO CHÃO: LIVRE / BLOQUEADO, por cena (`MapData.offFloor`, pedido do
 * mestre de 12/11/2026: "eu quero me mover fora do chão e ver tudo").
 *
 * "Chão" são as peças da ferramenta Chão (`MapData.floor`) e, numa cena que
 * tem alguma peça de Chão de verdade, também Sala, região com fundo, desenho
 * cheio e textura pintada (`comFormasComoChao`, levantamento de 25/11/2026,
 * Nº 19: o jogador não enxergava nem andava na área pintada além das peças).
 * O fundo do mapa não é Chão.
 *
 * - BLOQUEADO (`'blocked'`, e campo AUSENTE numa cena com Chão de antes, ver
 *   `foraDoChaoLivre`): a regra de sempre. A borda do Chão barra a visão e o passo do jogador. É o que serve
 *   ao convés do barco, à lagoa e ao subterrâneo, onde a borda é o limite.
 * - LIVRE (`'free'`): para limite de visão e de movimento a cena se comporta
 *   EXATAMENTE como uma cena sem nenhuma peça de Chão. As peças continuam no
 *   mapa como pintura (desenho, cor, textura, clique do mestre). Parede, porta
 *   fechada, janela, grade, escuridão, raio de visão, borda do mapa, zona
 *   oculta, sala secreta e teto fechado valem como valem na cena sem Chão.
 *
 * UM PONTO DE DECISÃO: quem usa o Chão como LIMITE pergunta a `chaoQueLimita`,
 * nunca a `map.floor` direto. Quem o usa como pintura (desenhar, mandar a peça
 * ao jogador, esconder a peça que está em zona oculta) continua em `map.floor`.
 */

/** O valor da opção gravado na cena. */
export type OffFloor = NonNullable<MapData['offFloor']>

/**
 * A lista vazia de TODA cena livre, sempre a mesma: quem guarda cache pela
 * referência do Chão (contorno da visão, chão compilado, recorte das luzes)
 * percebe a troca da opção sem olhar mais nada. Ninguém escreve nela.
 */
const SEM_CHAO_QUE_LIMITE: FloorPiece[] = []

/**
 * Uma peça de Chão "de antes": soma, não está escondida, conta como Chão e não
 * tem material. A pintura de pedra, terra, cascalho etc. da ferramenta Chão e
 * caminho (0.5.62, `material`) não conta.
 */
function ehChaoDeAntes(peca: FloorPiece): boolean {
  return peca.op === 'add' && peca.hidden !== true && peca.soPintura !== true && peca.material === undefined
}

const chaoDeAntesGuardado = new WeakMap<readonly FloorPiece[], boolean>()

function temChaoDeAntes(floor: readonly FloorPiece[]): boolean {
  let tem = chaoDeAntesGuardado.get(floor)
  if (tem === undefined) {
    tem = floor.some(ehChaoDeAntes)
    chaoDeAntesGuardado.set(floor, tem)
  }
  return tem
}

/**
 * A cena está em "Fora do Chão: livre"? `'free'` = livre e `'blocked'` =
 * bloqueado, sempre. Campo AUSENTE (cena de antes da opção): bloqueado só se a
 * cena tem Chão de antes (`ehChaoDeAntes`). A cena antiga SEM Chão sempre foi
 * livre; com a pintura de material ela virava um cercado do tamanho da pintura,
 * e a ficha não andava fora dele (pedido do mestre de 13/11/2026: "O Token não
 * consegue andar sem chão"). A água também não cerca essa cena: ela só conta
 * como Chão onde a cena é bloqueada. Sem `floor` na mão, ausente = bloqueado.
 */
export function foraDoChaoLivre(map: Pick<MapData, 'offFloor'> & Partial<Pick<MapData, 'floor'>>): boolean {
  if (map.offFloor !== undefined) return map.offFloor === 'free'
  return map.floor !== undefined && !temChaoDeAntes(map.floor)
}

/** Prefixo do id das peças de mentira das formas e da tinta (nunca colide com peça de verdade, que é uuid). */
export const PREFIXO_DA_PECA_DE_FORMA = 'chao:'

/** O que a cena tem além das peças: as formas e a tinta que também são Chão. */
type CamposDoChao = Partial<Pick<MapData, 'regions' | 'drawings' | 'texturas' | 'grid' | 'width' | 'height'>>

const SEM_REGIOES: Region[] = []
const SEM_DESENHOS: Drawing[] = []

function comPisoDe(piso: number | undefined): { piso?: number } {
  return piso === undefined || piso === 0 ? {} : { piso }
}

/** A forma cheia como peça de Chão de mentira (só para o limite, nunca desenhada). */
function pecaDaForma(forma: FormaDeChao, i: number): FloorPiece {
  const points = forma.pontos.map((p) => ({ x: p.x, y: p.y }))
  return { id: `${PREFIXO_DA_PECA_DE_FORMA}forma:${i}`, op: 'add', modifiers: {}, shape: { kind: 'poly', points }, ...comPisoDe(forma.piso) }
}

/**
 * A tinta como peças de blocos de meia casa, uma por piso: a célula entra
 * quando o centro dela tem chão pintado pela regra de `lib/chaoPintado.ts`.
 * A Borracha e o Esvaziar tiram, e o passo de depois vale por cima.
 */
function pecasDaTinta(texturas: readonly PinceladaDeTextura[], regioes: readonly Region[], desenhos: readonly Drawing[], grid: number, area: Caixa): FloorPiece[] {
  const lado = grid / 2
  const porPiso = new Map<number, PinceladaDeTextura[]>()
  for (const passo of texturas) {
    const piso = pisoDe(passo)
    const lista = porPiso.get(piso)
    if (lista === undefined) porPiso.set(piso, [passo])
    else lista.push(passo)
  }
  return [...porPiso].flatMap(([piso, passos]): FloorPiece[] => {
    const cells = celulasDoChaoPintado(passos, regioes, desenhos, lado, area)
    if (cells.length === 0) return []
    return [{ id: `${PREFIXO_DA_PECA_DE_FORMA}tinta:${piso}`, op: 'add', modifiers: {}, shape: { kind: 'blocos', cell: lado, cells }, ...comPisoDe(piso) }]
  })
}

/** O retângulo do mapa em px de mundo, com o lado da casa; `null` sem grade ou tamanho que sirva. */
function areaDaCena(map: CamposDoChao): (Caixa & { grid: number }) | null {
  const { grid, width, height } = map
  if (grid === undefined || width === undefined || height === undefined || !(grid > 0) || !(width > 0) || !(height > 0)) return null
  return { minX: 0, minY: 0, maxX: width * grid, maxY: height * grid, grid }
}

/** A tinta e as formas cheias da cena como peças de mentira, a tinta primeiro. */
function formasETintaComoPecas(map: CamposDoChao): FloorPiece[] {
  const regioes = map.regions ?? SEM_REGIOES
  const desenhos = map.drawings ?? SEM_DESENHOS
  const area = areaDaCena(map)
  const daTinta = map.texturas === undefined || area === null ? [] : pecasDaTinta(map.texturas, regioes, desenhos, area.grid, area)
  return [...daTinta, ...formasDeChao(regioes, desenhos).map(pecaDaForma)]
}

const comFormasGuardadas = new WeakMap<FloorPiece[], CamposDoChao & { pecas: FloorPiece[] }>()

/**
 * As peças que limitam com as formas e a tinta da cena NA FRENTE: o buraco
 * (Subtrair) de depois tira também delas, e a peça que soma continua somando.
 * Só onde há Chão de verdade (`cenaTemChao`): sem nenhuma peça, a borda não
 * existe e a cena segue como a sem Chão, como sempre foi. As mesmas listas
 * devolvem a MESMA lista (contorno e chão compilado são guardados por ela).
 */
function comFormasComoChao(floor: FloorPiece[], map: CamposDoChao & Pick<MapData, 'floor'>): FloorPiece[] {
  const guardada = comFormasGuardadas.get(floor)
  const mesma =
    guardada !== undefined &&
    guardada.regions === map.regions &&
    guardada.drawings === map.drawings &&
    guardada.texturas === map.texturas &&
    guardada.grid === map.grid &&
    guardada.width === map.width &&
    guardada.height === map.height
  if (mesma) return guardada.pecas
  const extras = cenaTemChao(map) ? formasETintaComoPecas(map) : []
  const pecas = extras.length === 0 ? floor : [...extras, ...floor]
  comFormasGuardadas.set(floor, { regions: map.regions, drawings: map.drawings, texturas: map.texturas, grid: map.grid, width: map.width, height: map.height, pecas })
  return pecas
}

/**
 * As peças de Chão que LIMITAM a visão e o passo do jogador nesta cena: as da
 * cena menos as de "Conta como Chão" desligado (`soPintura`, CHÃO E CAMINHO
 * de 12/11/2026), mais Sala, região com fundo, desenho cheio e textura
 * pintada (`comFormasComoChao`) e a água, ou nenhuma quando ela está livre.
 * Na cena bloqueada sem nada além das peças, a própria `map.floor` (a mesma
 * referência); com algo a mais, uma lista guardada pelas listas do mapa.
 */
export function chaoQueLimita(map: Pick<MapData, 'floor' | 'offFloor'> & Partial<Pick<MapData, 'aguas' | 'grid' | 'regions' | 'drawings' | 'texturas' | 'width' | 'height'>>): FloorPiece[] {
  if (foraDoChaoLivre(map)) return SEM_CHAO_QUE_LIMITE
  // ÁGUA (decisão do mestre de 12/11/2026): rio, lago e mar contam como Chão (`lib/agua/comoChao.ts`).
  return comAguasComoChao(comFormasComoChao(pecasQueLimitam(map.floor), map), map.aguas, map.grid)
}

/**
 * A cena tem Chão de verdade: alguma peça que soma, não está escondida e conta
 * como Chão (sem `soPintura`), a mesma conta de `compileFloor` (`bounds`).
 * Sem nenhuma, a borda não existe e a opção não muda nada: a janela da cena
 * mostra o controle desligado.
 */
export function cenaTemChao(map: Pick<MapData, 'floor'>): boolean {
  return map.floor.some((peca) => peca.op === 'add' && peca.hidden !== true && peca.soPintura !== true)
}

/**
 * O valor do arquivo, só se servir. O resto (texto qualquer, booleano, arquivo
 * editado à mão) é AUSENTE, que é bloqueado: valor torto nunca abre a visão.
 */
export function readOffFloor(value: unknown): OffFloor | undefined {
  return value === 'free' || value === 'blocked' ? value : undefined
}

/**
 * A cena que NASCE agora, do zero (mapa novo, cena nova da aventura): livre.
 * `herdado` é o que VALE na cena de baixo quando o andar nasce de uma escada
 * (quem chama resolve: cena de antes, sem o campo, vale `'blocked'`), e o andar
 * novo nasce com esse valor gravado. Mapa aberto do disco não passa por aqui:
 * campo ausente continua ausente.
 */
export function comForaDoChaoDeCenaNova(map: MapData, herdado?: OffFloor): MapData {
  return { ...map, offFloor: herdado ?? 'free' }
}
