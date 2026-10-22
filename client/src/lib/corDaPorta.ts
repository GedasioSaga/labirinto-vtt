import type { DoorState } from '../types/map'
import { PIN_CORES } from './pins'
import { parseHexColor } from './tokenColor'

/**
 * COR DA PORTA (fatia 22) — as regras puras de `DoorState.cor`, as mesmas da
 * cor do pino (`lib/pins.ts`): só `#rrggbb` minúsculo entra no mapa e no
 * disco; qualquer outra coisa vira AUSENTE, e a porta volta a ser a de sempre.
 * Puro: sem DOM, sem Pixi, sem store (o disco e o recorte do jogador usam).
 */

/** O laranja de fábrica (`DOOR_COLOR`, `pixi/drawDoors.ts`) em CSS: o valor que "Outra cor…" mostra sem cor própria. */
export const COR_DA_PORTA_PADRAO = '#d08c3a'

/** Paleta da Aparência: a do protótipo consolidado, a mesma do pino e do token (a primeira é a porta do protótipo). */
export const CORES_DA_PORTA: readonly string[] = PIN_CORES

/** `#rrggbb` minúsculo, ou `undefined` para qualquer outra coisa (nome de cor, hex curto, `javascript:`). */
export function normalizarCorDaPorta(value: unknown): string | undefined {
  return typeof value === 'string' && parseHexColor(value) !== null ? value.toLowerCase() : undefined
}

/**
 * A porta com a cor que a Aparência escolheu. `null` ("Cor padrão") e cor torta
 * TIRAM o campo: a porta volta ao laranja, e o arquivo sai como o de antes.
 */
export function portaComCor(door: DoorState, cor: string | null): DoorState {
  const { cor: _anterior, ...semCor } = door
  const normalizada = normalizarCorDaPorta(cor)
  return normalizada === undefined ? semCor : { ...semCor, cor: normalizada }
}

/**
 * Chave de agrupamento do desfazer (`typingKey` de `setWallDoor`): o seletor
 * nativo de "Outra cor…" manda uma cor por quadro do arrasto, e cada abertura
 * dele (`abertura`, de `CorDaPorta`) vira UM Ctrl+Z — abrir de novo é outra
 * chave, e o Ctrl+Z não pula a cor do arrasto de antes. A bolinha da paleta e o
 * "Cor padrão" (`abertura` ausente) são escolhas inteiras, um passo cada.
 */
export function chaveDaCorDaPorta(wallId: string, abertura: string | undefined): string | undefined {
  return abertura === undefined ? undefined : `porta-cor:${wallId}:${abertura}`
}

/**
 * A cor própria como número do Pixi, ou `null` quando não há (ausente, ou
 * torta: recorte de um host antigo, arquivo editado à mão). Quem desenha cai
 * no laranja/vermelho de sempre com `null`.
 */
export function corPropriaDaPorta(door: Pick<DoorState, 'cor'>): number | null {
  return parseHexColor(door.cor)
}
