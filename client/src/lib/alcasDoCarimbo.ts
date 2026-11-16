import type { Carimbo } from '../types/map'
import type { Point } from '../pixi/world'
import { boxCorners, type Corner } from './objectTransform'
import {
  caixaDoCarimbo, carimboDestravado, ehTipoImportado, normalizarGiro, radianosDoImportado, TAMANHO_DO_CARIMBO_MAX, TAMANHO_DO_CARIMBO_MIN, varianteDoGiro,
} from './carimbos'
import { normalizeRotation, rotatePointAround, rotationTrig, roomRotateHandle, snapRoomRotation, type RoomRotateHandle } from './roomRotation'
import { camadaTravadaDoItem } from './camadas/trava'
import type { CamposDeCamadas } from './camadas/consulta'

/**
 * ALÇAS DO CARIMBO (pedido de 16/11/2026: "em carimbo permita fazer as mesmas
 * coisa que um objeto"): a conta pura das alças do carimbo selecionado
 * sozinho, sem Pixi — o desenho (`pixi/drawEditHandles.ts`), o cursor
 * (`lib/hoverHitTest.ts`) e os gestos (`pixi/carimboAlcaGesture.ts`,
 * `pixi/roomRotateGesture.ts`) leem daqui, então o que se vê é o que pega.
 *
 * - CANTOS: os quatro chips da caixa do corpo (`caixaDoCarimbo`), a mesma que o
 *   contorno amarelo da seleção desenha — o chip cai na quina do contorno.
 *   Puxar um canto muda o `tamanho`, proporcional, e o carimbo cresce a partir
 *   do PÉ (`x`/`y`): a árvore fica plantada onde estava, como no controle
 *   "Tamanho" da ficha.
 * - GIRAR: a bolinha no palito da sala e do objeto (`roomRotateHandle`), em
 *   volta do meio da caixa. O da biblioteca anda de 45 em 45 graus: ele tem oito
 *   desenhos (`varianteDoGiro`), e girar entre eles mantém a sombra certa, com a
 *   luz parada. O importado gira livre (Shift: de 15 em 15, como o objeto): o
 *   primeiro arrasto liga o `giroLivre` dele, e a imagem que só inclinava uns
 *   graus passa a girar de verdade. Sem arrasto, o mapa de antes fica igual.
 */

/** O giro da biblioteca anda de desenho em desenho: oito, um a cada 45 graus. */
export const PASSO_DO_GIRO_DA_BIBLIOTECA = 45

/**
 * O carimbo mostra alças? Travado não (o cadeado da ficha segura), e na camada
 * travada também não: controle que não faz nada é pior que nenhum — a mesma
 * regra do objeto travado. A seleção continua visível pelo contorno.
 */
export function carimboComAlcas(map: CamposDeCamadas, c: Carimbo): boolean {
  return carimboDestravado(c) && camadaTravadaDoItem(map, 'carimbo', c) === null
}

/** O meio da caixa do corpo: em volta dele a bolinha de girar anda. */
export function centroDoCarimbo(c: Carimbo): Point {
  const caixa = caixaDoCarimbo(c)
  return { x: (caixa.minX + caixa.maxX) / 2, y: (caixa.minY + caixa.maxY) / 2 }
}

/**
 * O ângulo que a tela mostra, em graus de −180 a 180: no da biblioteca, o do
 * desenho escolhido (o giro 137 desenha o de 135); no importado com giro
 * livre, o giro dele; no importado de antes, a inclinação que a imagem tem
 * (`radianosDoImportado`), para a bolinha sair de onde a imagem aponta.
 */
export function anguloVisivelDoCarimbo(c: Pick<Carimbo, 'tipo' | 'giro' | 'giroLivre'>): number {
  if (!ehTipoImportado(c.tipo)) return normalizeRotation(varianteDoGiro(c.giro) * PASSO_DO_GIRO_DA_BIBLIOTECA)
  return normalizeRotation(c.giroLivre === true ? c.giro : (radianosDoImportado(c) * 180) / Math.PI)
}

/**
 * A alça de girar: a da sala, apontando do meio da caixa para onde o carimbo
 * está virado (o ângulo que a tela mostra) — e, no arrasto, acompanhando a mão.
 * O palito nasce na BORDA do contorno amarelo, nessa direção: a caixa do
 * carimbo não gira junto (a da biblioteca é a mesma nos oito desenhos), e o
 * retângulo girado deixaria o palito solto no ar, longe do contorno (visto na
 * prova de 16/11/2026 com o giro de 90°).
 */
export function alcaDeGirarDoCarimbo(c: Carimbo, cameraScale: number): RoomRotateHandle | null {
  const angulo = anguloVisivelDoCarimbo(c)
  const caixa = caixaDoCarimbo(c)
  const centro = centroDoCarimbo(c)
  const meiaLargura = (caixa.maxX - caixa.minX) / 2
  const meiaAltura = (caixa.maxY - caixa.minY) / 2
  const trig = rotationTrig(angulo)
  // Do meio até a borda da caixa, na direção do giro: a reta sai pelo lado que encontrar primeiro.
  const ateOLado = trig.sin === 0 ? Infinity : meiaLargura / Math.abs(trig.sin)
  const ateOTopo = trig.cos === 0 ? Infinity : meiaAltura / Math.abs(trig.cos)
  const ateABorda = Math.min(ateOLado, ateOTopo)
  // No sistema do carimbo girado, o topo deste retângulo cai na borda: `roomRotateHandle` põe o palito ali.
  const noSistemaDoGiro = { minX: centro.x - meiaLargura, maxX: centro.x + meiaLargura, minY: centro.y - ateABorda, maxY: centro.y + ateABorda }
  const cantos = boxCorners(noSistemaDoGiro).map((canto) => rotatePointAround(canto, centro, trig))
  return roomRotateHandle(cantos, angulo, cameraScale)
}

/** Hit-test da bolinha de girar — a mesma conta do desenho. */
export function naAlcaDeGirarDoCarimbo(c: Carimbo, ponto: Point, cameraScale: number): boolean {
  const alca = alcaDeGirarDoCarimbo(c, cameraScale)
  return alca !== null && Math.hypot(ponto.x - alca.knob.x, ponto.y - alca.knob.y) <= alca.hitRadius
}

/**
 * Onde o giro do arrasto para, a partir do ângulo `bruto` (o do começo mais o
 * que a mão andou), em graus de −180 a 180. Biblioteca: o desenho mais perto,
 * de 45 em 45 (o Shift não muda nada). Importado: grau inteiro; Shift, de 15 em 15.
 */
export function giroDoCarimboNoArrasto(c: Pick<Carimbo, 'tipo'>, bruto: number, shift: boolean): number {
  if (ehTipoImportado(c.tipo)) return snapRoomRotation(bruto, shift)
  return normalizeRotation(Math.round(bruto / PASSO_DO_GIRO_DA_BIBLIOTECA) * PASSO_DO_GIRO_DA_BIBLIOTECA)
}

/** O giro que o arrasto grava: o número e se a imagem do importado gira livre. */
export interface GiroGravado {
  giro: number
  giroLivre: boolean
}

/** O giro do carimbo como ele estava: o que o Esc e o "foi e voltou" devolvem. */
export function giroDeAntesDoCarimbo(inicial: Pick<Carimbo, 'giro' | 'giroLivre'>): GiroGravado {
  return { giro: inicial.giro, giroLivre: inicial.giroLivre === true }
}

/**
 * O giro a gravar quando o arrasto está no ângulo `angulo`. No ângulo do
 * começo, o giro de antes, sem mudar um grau: o 137 da árvore do spray fica
 * 137 (ele já desenha o de 135), e voltar ao começo não vira passo no Ctrl+Z.
 * Fora dele, o ângulo, com o giro livre ligado: no importado, a imagem passa a
 * girar de verdade (`comMudancaDoCarimbo` tira o campo do da biblioteca).
 */
export function giroGravadoDoCarimbo(inicial: Pick<Carimbo, 'tipo' | 'giro' | 'giroLivre'>, angulo: number): GiroGravado {
  return angulo === anguloVisivelDoCarimbo(inicial) ? giroDeAntesDoCarimbo(inicial) : { giro: normalizarGiro(angulo), giroLivre: true }
}

/** A faixa do tamanho, em px de mundo: de 40% a 250% do natural do tipo, como o controle da ficha. */
export interface FaixaDoTamanho {
  min: number
  max: number
}

/**
 * A faixa do arrasto: a da ficha, alargada até o tamanho de agora — o spray
 * varia ±18% em volta do escolhido, e o carimbo que já nasceu acima de 250% não
 * pode encolher de repente só porque a mão pegou o canto.
 */
export function faixaDoTamanhoDoCarimbo(natural: number, tamanhoAgora: number): FaixaDoTamanho {
  return {
    min: Math.min((natural * TAMANHO_DO_CARIMBO_MIN) / 100, tamanhoAgora),
    max: Math.max((natural * TAMANHO_DO_CARIMBO_MAX) / 100, tamanhoAgora),
  }
}

/**
 * O tamanho com o canto `canto` puxado até `ponto`. O pé (`x`/`y`) fica parado
 * e a caixa cresce em volta dele, então o canto anda na reta pé-canto: a conta
 * projeta o ponteiro nessa reta (puxar de lado não muda nada) e vê quantas
 * vezes o canto de antes cabe ali. `inicial` é o carimbo do pointerdown, para
 * o tamanho não acumular erro de quadro em quadro.
 */
export function tamanhoPeloCanto(inicial: Carimbo, canto: Corner, ponto: Point, faixa: FaixaDoTamanho): number {
  const quina = boxCorners(caixaDoCarimbo(inicial))[canto]
  const vx = quina.x - inicial.x
  const vy = quina.y - inicial.y
  const comprimento2 = vx * vx + vy * vy
  if (!(comprimento2 > 0)) return inicial.tamanho
  const fator = ((ponto.x - inicial.x) * vx + (ponto.y - inicial.y) * vy) / comprimento2
  return Math.min(faixa.max, Math.max(faixa.min, inicial.tamanho * fator))
}
