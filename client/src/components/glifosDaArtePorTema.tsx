/**
 * Os ícones das peças novas do plano de arte por tema (28/11/2026, `docs/design/arte-temas/PLANO.md`, lotes L01 a
 * L03): um desenho por objeto na grade de 24 do `Icon` (`icons.tsx`), de cima ou de frente como o objeto se lê
 * melhor. Moram aqui para não crescer o `glifoDoMovel` nem o da leva de 24/11, que chama este no fim.
 */
import type { ReactNode } from 'react'
import type { TipoMobilia } from '../types/map'

export function glifoDaArtePorTema(tipo: TipoMobilia): ReactNode {
  switch (tipo) {
    case 'placaDePressao':
      // A laje quadrada solta no chão, a fresta em volta e o anel do meio.
      return (
        <>
          <rect x="4" y="4" width="16" height="16" /><rect x="7" y="7" width="10" height="10" /><circle cx="12" cy="12" r="2" />
        </>
      )
    case 'escadaDeMao':
      // Os dois banzos e os degraus.
      return (
        <>
          <path d="M8 3v18M16 3v18" /><path d="M8 7h8M8 11h8M8 15h8M8 19h8" />
        </>
      )
    case 'correntePendurada':
      // O gancho no teto, os elos descendo e o gancho da ponta.
      return (
        <>
          <path d="M9 3h6" /><path d="M12 3v2" /><rect x="10.5" y="5" width="3" height="4" rx="1.5" /><rect x="10.5" y="9.5" width="3" height="4" rx="1.5" />
          <path d="M12 13.5v2a3 3 0 1 1-3 3" />
        </>
      )
    case 'portaoDeJaula':
      // A soleira, os dois postes e as barras da folha.
      return (
        <>
          <path d="M3 4h18" /><path d="M5 4v16M19 4v16" /><path d="M5 9h14M5 17h14" /><path d="M9.5 4v16M14.5 4v16" />
        </>
      )
    case 'laminaPendular':
      // A viga, o braço e a lâmina em meia-lua.
      return (
        <>
          <path d="M3 4h18" /><circle cx="12" cy="6" r="1.2" /><path d="M12 7.2V15" /><path d="M6 15c2 5 10 5 12 0-3 1.5-9 1.5-12 0z" />
        </>
      )
    case 'pecaDeXadrez':
      // O peão de frente: a bola, o colar e a base larga.
      return (
        <>
          <circle cx="12" cy="6.5" r="3" /><path d="M9.5 10.5h5" /><path d="M10.5 10.5 9 17h6l-1.5-6.5" /><path d="M6.5 20.5h11l-1-3.5h-9z" />
        </>
      )
    default:
      return null
  }
}
