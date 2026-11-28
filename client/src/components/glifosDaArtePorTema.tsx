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
    // A onda 2 (L04 a L06).
    case 'carrinhoDeMina':
      // A tina de lado: a boca larga, o fundo estreito, as duas rodas e o trilho.
      return (
        <>
          <path d="M3 7h18l-2 9H5z" /><circle cx="8" cy="18" r="2" /><circle cx="16" cy="18" r="2" /><path d="M2 21h20" />
        </>
      )
    case 'trilhoDeMina':
      // Os dois trilhos de cima e os dormentes atravessados.
      return (
        <>
          <path d="M8 2v20M16 2v20" /><path d="M5 5h14M5 10h14M5 15h14M5 20h14" />
        </>
      )
    case 'escoraDeMina':
      // Os dois esteios, a trave por cima e o teto de rocha.
      return (
        <>
          <path d="M3 4l3 2 4-1 4 1 4-1 3 1" /><path d="M4 8h16" /><path d="M6 8v13M18 8v13" />
        </>
      )
    case 'pilhaDeMinerio':
      // O monte de pedras quebradas, uma no alto.
      return (
        <>
          <path d="M3 20l3-6 4 1 2-4 4 2 3 3 2 4z" /><path d="M10 11l2-4 3 2-1 3" />
        </>
      )
    case 'cano':
      // O tubo deitado com os dois flanges.
      return (
        <>
          <path d="M4 9h16M4 15h16" /><path d="M4 7v10M7 7v10M17 7v10M20 7v10" />
        </>
      )
    case 'saidaDeEsgoto':
      // A boca do tubo na parede, o fio de água e a poça.
      return (
        <>
          <path d="M3 3h18" /><path d="M9 3v6h6V3" /><path d="M12 9v7" /><ellipse cx="12" cy="18.5" rx="6" ry="2.5" />
        </>
      )
    case 'comporta':
      // Os dois pilares, a folha baixada e o volante em cima.
      return (
        <>
          <path d="M4 4v17M20 4v17" /><rect x="7" y="9" width="10" height="10" /><circle cx="12" cy="5" r="2" /><path d="M12 7v2" />
        </>
      )
    case 'fonteDeParede':
      // A parede, a bica, o fio de água e o cocho em meia-lua.
      return (
        <>
          <path d="M3 3h18" /><path d="M12 3v4" /><path d="M10 7h4" /><path d="M12 7v6" /><path d="M5 13h14a7 7 0 0 1-14 0z" />
        </>
      )
    // A onda 3 (L07 a L09).
    case 'rodaDeCarroca':
      // O aro, o cubo e os raios em cruz e em xis.
      return (
        <>
          <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2" /><path d="M12 3v7M12 14v7M3 12h7M14 12h7M6 6l4.5 4.5M13.5 13.5L18 18M18 6l-4.5 4.5M10.5 13.5L6 18" />
        </>
      )
    case 'bancoDeTronco':
      // O tronco deitado, com os anéis na ponta e os dois tocos por baixo.
      return (
        <>
          <path d="M5 8h14M5 14h14" /><ellipse cx="19" cy="11" rx="2" ry="3" /><path d="M5 8a2 3 0 0 0 0 6" /><path d="M7 14v5M16 14v5" />
        </>
      )
    case 'casinhaDeCachorro':
      // O telhado de duas águas, as paredes e a porta em arco.
      return (
        <>
          <path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M9 20v-4a3 3 0 0 1 6 0v4" />
        </>
      )
    default:
      return null
  }
}
