/**
 * Os ícones do mundo do livro de regras, com os MESMOS traços do protótipo
 * aprovado (docs/design/livros-de-regras/prototipo.html, os `<symbol>`).
 * Traço em `currentColor`: quem usa decide a cor pelo CSS (`.mu-ic`).
 */

const TRACOS = {
  jogadores: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19c.6-3.2 2.9-5 5.5-5s4.9 1.8 5.5 5" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M15.8 14.2c2.4.1 4.2 1.7 4.7 4.8" />
    </>
  ),
  npc: (
    <>
      <path d="M14.5 17.5 3 6V3h3l11.5 11.5" />
      <path d="m13 19 6-6M16 16l4 4M19 21l2-2" />
      <path d="M9.5 6.5 14 2h3v3l-4.5 4.5" />
      <path d="M5 14l4 4M7 17l-3 3M3 19l2 2" />
    </>
  ),
  balanca: (
    <>
      <path d="M12 4v16M8 20h8M5 7h14" />
      <path d="M5 7l-2.5 6a2.5 2.5 0 0 0 5 0z" />
      <path d="M19 7l-2.5 6a2.5 2.5 0 0 0 5 0z" />
    </>
  ),
  saude: <path d="M3 12h4l2-5 4 10 2-5h6" />,
  itens: (
    <>
      <path d="M5 8h14l-1 12H6z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </>
  ),
  nota: (
    <>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M13.5 6.5l4 4" />
    </>
  ),
  voltar: <path d="M10 6 4 12l6 6M4 12h16" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  mais: <path d="M12 5v14M5 12h14" />,
  elo: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </>
  ),
  livro: (
    <>
      <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
      <path d="M4 19V5M8 7h7" />
    </>
  ),
  bussola: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </>
  ),
  lixo: <path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" />,
  copia: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
    </>
  ),
  cenario: (
    <>
      <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z" />
      <path d="M9 4v14M15 6v14" />
    </>
  ),
  alerta: (
    <>
      <path d="M12 4 2.5 20h19z" />
      <path d="M12 10v4M12 17v.01" />
    </>
  ),
} as const

export type NomeDoIconeDoMundo = keyof typeof TRACOS

export function IconeDoMundo({ nome }: { nome: NomeDoIconeDoMundo }) {
  return (
    <svg className="mu-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {TRACOS[nome]}
    </svg>
  )
}
