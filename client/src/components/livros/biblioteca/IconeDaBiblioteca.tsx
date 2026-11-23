import type { ReactNode } from 'react'
import type { IconeDaLinha } from '../../../lib/livros/linhaDaBiblioteca'

/**
 * Os ícones da biblioteca, com os MESMOS traços do protótipo aprovado
 * (docs/design/biblioteca/prototipo.html, `IC`): o tipo do golpe (os do
 * editor), os grupos da lista e os das ações do papel. Traço em
 * `currentColor`; a cor do grupo vem do CSS (`data-icone`).
 */

export type IconeDaBiblioteca = IconeDaLinha | 'ferramenta' | 'seta' | 'lapis' | 'play' | 'dar' | 'lixo' | 'x' | 'todas' | 'pessoas' | 'livro' | 'mais' | 'busca' | 'alerta'

const TRACOS: Readonly<Record<IconeDaBiblioteca, ReactNode>> = {
  impacto: (
    <>
      <path d="M8 1.8v2.4M8 11.8v2.4M1.8 8h2.4M11.8 8h2.4M3.6 3.6l1.7 1.7M10.7 10.7l1.7 1.7M3.6 12.4l1.7-1.7M10.7 5.3l1.7-1.7" />
      <circle cx="8" cy="8" r="2" />
    </>
  ),
  cortante: <path d="M2.5 13.5 13 3M5 13.8 13.6 5.2" />,
  perfurante: <path d="M2 8h9.5M9 4.5 13.5 8 9 11.5M2 5.5v5" />,
  queimadura: <path d="M8 14c2.6 0 4.3-1.8 4.3-4.2 0-2.6-2.1-3.8-2.6-6.6-1.2 1-1.6 2.3-1.6 3.4C7.3 5.6 6 4.6 5.8 2.6 4.3 4.2 3.7 6.6 3.7 9.8 3.7 12.2 5.4 14 8 14Z" />,
  veneno: <path d="M8 2.2c2 2.7 4.2 5.1 4.2 7.4A4.2 4.2 0 0 1 3.8 9.6C3.8 7.3 6 4.9 8 2.2ZM6.3 10.2c.3.9 1 1.5 1.9 1.6" />,
  choque: <path d="M9.2 1.8 3.8 9h3.6l-.8 5.2L12.2 7H8.6l.6-5.2Z" />,
  cegueira: <path d="M1.8 8s2.3-4 6.2-4 6.2 4 6.2 4-2.3 4-6.2 4-6.2-4-6.2-4ZM2.5 13.5 13.5 2.5" />,
  ataque: (
    <>
      <circle cx="8" cy="8" r="5" />
      <path d="M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3" />
    </>
  ),
  apoio: <path d="M8 13.2S2.5 10 2.5 6.3A2.8 2.8 0 0 1 8 5a2.8 2.8 0 0 1 5.5 1.3C13.5 10 8 13.2 8 13.2Z" />,
  reacao: <path d="M8 2.3 13 4v3.8c0 3-2.2 5-5 5.9-2.8-.9-5-2.9-5-5.9V4Z" />,
  passiva: <path d="M4.6 10.4a2.4 2.4 0 1 1 0-4.8c2.3 0 4.5 4.8 6.8 4.8a2.4 2.4 0 1 0 0-4.8c-2.3 0-4.5 4.8-6.8 4.8Z" />,
  pericia: <path d="M8 4.2C6.5 3 4.5 2.8 2.5 3.2v9.3c2-.4 4-.2 5.5 1 1.5-1.2 3.5-1.4 5.5-1V3.2c-2-.4-4-.2-5.5 1ZM8 4.2v9.3" />,
  vantagem: <path d="M8 13V3.5M4 7.5l4-4 4 4" />,
  desvantagem: <path d="M8 3v9.5M4 8.5l4 4 4-4" />,
  espada: <path d="M13.5 2.5 6 10M13.5 2.5h-3M13.5 2.5v3M4 8l4 4M3 13l2-2" />,
  fogo: <path d="M2 5.5h11v2.5H8.5l-1 1.2V12H4.8l.7-4H2Z" />,
  frasco: <path d="M6.3 2.5h3.4M7 2.5v3.2L3.8 11.6A1.3 1.3 0 0 0 5 13.5h6a1.3 1.3 0 0 0 1.2-1.9L9 5.7V2.5M5 10h6" />,
  balas: <path d="M4 13V7.2C4 5.5 4.9 4 5.5 4S7 5.5 7 7.2V13ZM9 13V7.2C9 5.5 9.9 4 10.5 4S12 5.5 12 7.2V13Z" />,
  caixa: <path d="M2.5 5.5 8 3l5.5 2.5v5.5L8 13.5 2.5 11ZM2.5 5.5 8 8l5.5-2.5M8 8v5.5" />,
  ferramenta: <path d="M10.4 2.4a3.2 3.2 0 0 0-3.8 4.2l-4 4a1.4 1.4 0 0 0 2 2l4-4a3.2 3.2 0 0 0 4.2-3.8l-1.9 1.9-1.6-.4-.4-1.6Z" />,
  seta: <path d="m4 6 4 4 4-4" />,
  lapis: <path d="M10.5 2.8 13.2 5.5 5.6 13.1 2.5 13.5 2.9 10.4Z" />,
  play: <path d="M5 3.2v9.6L12.6 8Z" />,
  dar: <path d="M2.5 8h8M7.5 4.8l3.2 3.2-3.2 3.2M13.5 3v10" />,
  lixo: <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" />,
  x: <path d="M4 4l8 8M12 4l-8 8" />,
  todas: (
    <>
      <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="2.5" y="9" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="9" width="4.5" height="4.5" rx="1" />
    </>
  ),
  pessoas: (
    <>
      <circle cx="6" cy="5.5" r="2.2" />
      <path d="M2 13c0-2.2 1.8-3.8 4-3.8s4 1.6 4 3.8" />
      <circle cx="11.3" cy="6" r="1.8" />
      <path d="M11 9.3c1.7 0 3 1.4 3 3.2" />
    </>
  ),
  livro: <path d="M3 2.5h8.5a1.5 1.5 0 0 1 1.5 1.5v9.5H4.5A1.5 1.5 0 0 1 3 12ZM3 12a1.5 1.5 0 0 1 1.5-1.5H13" />,
  mais: <path d="M8 3.5v9M3.5 8h9" />,
  busca: (
    <>
      <circle cx="7" cy="7" r="4.5" />
      <path d="m10.5 10.5 3 3" />
    </>
  ),
  alerta: <path d="M8 2.5 14 13H2ZM8 6.5v3M8 11.3v.1" />,
}

export function IconeDaBiblioteca({ nome }: { nome: IconeDaBiblioteca }) {
  return (
    <svg className="mu-bib-ic" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {TRACOS[nome]}
    </svg>
  )
}
