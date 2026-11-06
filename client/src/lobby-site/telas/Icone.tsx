/**
 * Os ícones do protótipo aprovado (docs/design/lobby/prototipo.html, o
 * `<symbol>` de cada um), como componente: traço de 1,75 na cor do texto.
 * Sempre decorativos: quem precisa de nome é o botão, pelo texto ou pelo
 * `aria-label`.
 */

const TRACOS = {
  visto: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  alerta: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.4v.2" />
    </>
  ),
  'sem-rede': <path d="M3 3l18 18M8.6 16.4a5 5 0 0 1 6.8 0M5.2 12.7a10 10 0 0 1 3.9-2.4M18.8 12.7a10 10 0 0 0-2.7-1.9M2 8.9a15 15 0 0 1 4.3-2.8M22 8.9A15 15 0 0 0 11 5.1M12 20h.01" />,
  voltar: <path d="M15 6l-6 6 6 6" />,
  menos: <path d="M6 12h12" />,
  mais: <path d="M12 6v12M6 12h12" />,
  tirar: <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" />,
  mapas: <path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5" />,
  moeda: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
    </>
  ),
  olho: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  copiar: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
    </>
  ),
  sair: <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />,
  entrar: <path d="M10 4h9v16h-9M4 12h10M10 8l4 4-4 4" />,
  ir: <path d="M9 6l6 6-6 6" />,
  desfazer: <path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" />,
  convite: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3.5 6l8.5 7 8.5-7" />
    </>
  ),
  /** Chat (C2): o balão de fala. */
  conversa: <path d="M4 5.5h16v10H10l-4.5 3.5v-3.5H4z" />,
  /** Baixar a conversa (C2). */
  baixar: <path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14" />,
  /** Mural (M2): o quadro de avisos. */
  mural: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 9h8M8 13h5" />
    </>
  ),
  /** Aviso fixado (M2): o pino. */
  fixar: <path d="M12 16.5V21M8.5 3.5h7M10 3.5v5.2l-3 3.3v1.5h10V12l-3-3.3V3.5" />,
  /** Editar a notícia (M2): o lápis. */
  editar: <path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19zM14.5 6.5l3 3" />,
} as const

export type NomeDoIcone = keyof typeof TRACOS

export function Icone({ nome, className }: { nome: NomeDoIcone; className?: string }) {
  return (
    <svg className={className === undefined ? 'lo-ic' : `lo-ic ${className}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {TRACOS[nome]}
    </svg>
  )
}
