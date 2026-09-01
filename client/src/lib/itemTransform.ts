/**
 * Funções puras de transformação/estado compartilhadas por qualquer entidade
 * do schema que tenha `rotation`/`locked`/`hidden` (Wall, Light, Region,
 * Token, Prop, Stair — todos opcionais, ver types/map.ts). Nenhuma delas toca
 * PixiJS ou a store: hit-test/drag (PixiCanvas, território do integrador) e
 * os renderers (drawProps.ts, tokensRenderer.ts) chamam estas funções em vez
 * de reimplementar a checagem de veracidade em cada lugar.
 */

/** Só o campo que interessa pra isLocked/canInteract — permite passar Wall,
 *  Light, Region, Token, Prop ou Stair sem precisar de union manual aqui. */
export interface Lockable {
  locked?: boolean
}

/** Mesmo formato de Lockable, pro campo `hidden`. */
export interface Hideable {
  hidden?: boolean
}

/**
 * Checagem por veracidade (truthy), não `=== true`: `locked` é opcional no
 * schema e `undefined` === false é o contrato de compatibilidade (mapa
 * salvo antes desta fase, ou entidade criada via `page.evaluate` em spec e2e,
 * chega sem o campo — nunca `=== null`). Mesma classe de bug já documentada
 * em tokensRenderer.ts:114-121 e TokenImageControls.tsx:13-18.
 */
export function isLocked(item: Lockable): boolean {
  return !!item.locked
}

/** Inverso de isLocked — o que o hit-test/drag do PixiCanvas consulta pra
 *  decidir se um item pode ser movido ou editado. */
export function canInteract(item: Lockable): boolean {
  return !isLocked(item)
}

/** Mesma checagem por veracidade de isLocked, pro campo `hidden`. `hidden`
 *  aqui é só "não renderiza no editor" — não existe segunda tela/modo
 *  jogador neste app (ver comentário de Token.hidden em types/map.ts). */
export function isHidden(item: Hideable): boolean {
  return !!item.hidden
}

/**
 * Graus (sentido horário, mesmo padrão de Token.rotation/Prop.rotation/
 * Stair.rotation em types/map.ts) para radianos — o que
 * Sprite.rotation/Graphics.rotation do PixiJS esperam. `undefined` → 0
 * radiano: aparência idêntica à de hoje, sem linha de migração (o schema já
 * documenta `undefined === 0`).
 */
export function rotationToRadians(rotationDeg: number | undefined): number {
  return ((rotationDeg ?? 0) * Math.PI) / 180
}
