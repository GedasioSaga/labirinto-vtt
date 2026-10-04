import type { FloorModifiers, FloorPiece } from '../types/map'

/**
 * As peças têm o MESMO desenho (forma, operação, giro, modificadores e
 * visibilidade), mesmo que a cor, o nome ou a trava mudem.
 *
 * Existe para o contorno do chão (campo de distância + marching squares, o
 * cálculo caro) não ser refeito quando só a cor muda: trocar a cor de um chão
 * grande refazia o contorno inteiro a cada evento do seletor (medido
 * 03/10/2026: ~30 s por evento num balde de 100 × 100 casas). A store é
 * imutável e `updateFloorPiece` espalha o patch por cima da peça, então a
 * forma e os modificadores de uma peça que só trocou de cor são os MESMOS
 * objetos — comparar por referência basta, e o campo a campo dos modificadores
 * cobre quem recria o objeto sem mudar nada.
 */
export function mesmaGeometriaDaPeca(a: FloorPiece, b: FloorPiece): boolean {
  if (a === b) return true
  return (
    a.shape === b.shape &&
    a.op === b.op &&
    (a.rotation ?? 0) === (b.rotation ?? 0) &&
    !!a.hidden === !!b.hidden &&
    mesmosModificadores(a.modifiers, b.modifiers)
  )
}

/** Mesma lista de peças, na mesma ordem, com o mesmo desenho cada uma. */
export function mesmaGeometriaDoChao(a: readonly FloorPiece[], b: readonly FloorPiece[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (!mesmaGeometriaDaPeca(a[i], b[i])) return false
  }
  return true
}

function mesmosModificadores(a: FloorModifiers, b: FloorModifiers): boolean {
  if (a === b) return true
  const ra = a.noise
  const rb = b.noise
  const mesmoRuido =
    ra === rb ||
    (ra !== undefined && rb !== undefined && ra.amplitude === rb.amplitude && ra.scale === rb.scale && ra.seed === rb.seed)
  return mesmoRuido && (a.rounding ?? 0) === (b.rounding ?? 0) && (a.grow ?? 0) === (b.grow ?? 0)
}
