import type { FloorPiece, MapData } from '../types/map'

/**
 * FORA DO CHÃO: LIVRE / BLOQUEADO, por cena (`MapData.offFloor`, pedido do
 * mestre de 12/11/2026: "eu quero me mover fora do chão e ver tudo").
 *
 * "Chão" é só a lista de peças da ferramenta Chão (`MapData.floor`). Sala,
 * desenho preenchido, textura e fundo do mapa parecem piso para quem olha, mas
 * não são Chão: numa cena com alguma peça de Chão, o jogador não enxergava nem
 * andava além da borda dela, mesmo com "piso" pintado lá.
 *
 * - BLOQUEADO (`'blocked'`, e campo AUSENTE: todo mapa de antes): a regra de
 *   sempre. A borda do Chão barra a visão e o passo do jogador. É o que serve
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

/** A cena está em "Fora do Chão: livre"? Ausente e `'blocked'` = bloqueado. */
export function foraDoChaoLivre(map: Pick<MapData, 'offFloor'>): boolean {
  return map.offFloor === 'free'
}

/**
 * As peças de Chão que LIMITAM a visão e o passo do jogador nesta cena: as da
 * cena, ou nenhuma quando ela está livre. Devolve a própria `map.floor` (a
 * mesma referência) na cena bloqueada.
 */
export function chaoQueLimita(map: Pick<MapData, 'floor' | 'offFloor'>): FloorPiece[] {
  return foraDoChaoLivre(map) ? SEM_CHAO_QUE_LIMITE : map.floor
}

/**
 * A cena tem Chão de verdade: alguma peça que soma e não está escondida, a
 * mesma conta de `compileFloor` (`bounds`). Sem nenhuma, a borda não existe e
 * a opção não muda nada: a janela da cena mostra o controle desligado.
 */
export function cenaTemChao(map: Pick<MapData, 'floor'>): boolean {
  return map.floor.some((peca) => peca.op === 'add' && peca.hidden !== true)
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
