import type { Wall } from '../types/map'
import type { WallStyleControlsProps } from './WallStyleControls'

/**
 * O interruptor "Grade de prisão" da parede selecionada (MT10), ou
 * `undefined` quando ele não entra: obra do Meio-Termo desligada (a grade nem
 * seria desenhada), nenhuma parede, parede com porta ou que não é janela (a
 * grade só vale na janela sem porta, a regra da MT9). `definir` é o
 * `definirGrade` da store (com Ctrl+Z).
 */
export function gradeDaParede(
  parede: Wall | null,
  obraLigada: boolean,
  definir: (id: string, ligada: boolean) => void,
): WallStyleControlsProps['grade'] {
  if (!obraLigada || parede === null || parede.door !== null || parede.janela !== true) return undefined
  return { ligada: parede.grade === true, onChange: (ligada) => definir(parede.id, ligada) }
}
