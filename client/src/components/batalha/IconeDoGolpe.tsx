import type { TipoDoGolpe } from '../../lib/batalha/mecanica/modelo'
import type { TipoNaTira } from './requisitosNoMenu'

/**
 * REQUISITOS G (EDITOR.md §6): o ícone do tipo do golpe na tira (ED1: como bate e o que causa). Traço de
 * 1,8 px na cor do texto, 14 px: lê na tinta e no papel da tira escolhida. Decorativo; o nome vai no
 * título e no rótulo do grupo.
 */
const DESENHO: Readonly<Record<TipoDoGolpe, string>> = {
  // um punho de estrela: o impacto
  impacto: 'M8 1.5l1.6 3.6 3.9-.9-2.4 3.2 2.4 3.2-3.9-.9L8 13.3l-1.6-3.6-3.9.9 2.4-3.2-2.4-3.2 3.9.9z',
  // dois cortes em diagonal
  cortante: 'M3 13L13 3M6 14l8-8',
  // a ponta da lança
  perfurante: 'M2 14l8.5-8.5M8 3h5v5M13 3l-3 3',
  // a chama
  queimadura: 'M8 14.5c-2.8 0-4.5-1.9-4.5-4.3 0-2.6 2.2-3.7 2.5-6.7 1.4 1 2 2.4 1.9 3.8.9-.5 1.5-1.4 1.7-2.6 1.7 1.4 2.9 3.2 2.9 5.4 0 2.5-1.7 4.4-4.5 4.4z',
  // a gota
  veneno: 'M8 1.8c2.2 3 4.3 5.4 4.3 7.9A4.3 4.3 0 0 1 8 14a4.3 4.3 0 0 1-4.3-4.3C3.7 7.2 5.8 4.8 8 1.8zM6.2 10.4l3.6-2.2',
  // o floco
  congelamento: 'M8 1.5v13M2.4 4.75l11.2 6.5M2.4 11.25l11.2-6.5M6.3 2.6L8 4.2l1.7-1.6M6.3 13.4L8 11.8l1.7 1.6',
  // o raio
  choque: 'M9.3 1.5L3.8 9h3.6l-.9 5.5L12.2 7H8.6z',
  // o olho riscado
  cegueira: 'M1.8 8s2.3-4 6.2-4 6.2 4 6.2 4-2.3 4-6.2 4-6.2-4-6.2-4zM8 9.8a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6zM2.5 13.5l11-11',
  // a seta para baixo
  enfraquecer: 'M8 2v10.5M4 8.5l4 4 4-4M3.5 14.5h9',
  // um selo qualquer
  outro: 'M8 2.2a5.8 5.8 0 1 0 0 11.6A5.8 5.8 0 0 0 8 2.2zM8 5.6v4.8M5.6 8h4.8',
}

export function IconeDoGolpe({ tipo }: { tipo: TipoDoGolpe }) {
  return (
    <svg className="bt-golpe-ic" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <path d={DESENHO[tipo]} />
    </svg>
  )
}

/** Os ícones do golpe juntos num chip só ("Impacto, Queimadura"). Vazio = nada. */
export function TiposDoGolpe({ tipos }: { tipos: readonly TipoNaTira[] | undefined }) {
  if (tipos === undefined || tipos.length === 0) return null
  const nomes = tipos.map((tipo) => tipo.nome).join(', ')
  return (
    <span className="bt-etq bt-etq--golpe" title={`Golpe: ${nomes}`} role="img" aria-label={`Golpe: ${nomes}`}>
      {tipos.map((tipo) => (
        <IconeDoGolpe key={`${tipo.tipo}:${tipo.nome}`} tipo={tipo.tipo} />
      ))}
    </span>
  )
}
