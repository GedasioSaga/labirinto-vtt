import type { PapelDoDocumento } from '../../documentos/tipos'

/**
 * O PAPEL EM MINIATURA (o `svgPapelMapa` do protótipo v2): o mesmo desenho do
 * papel no chão (`pixi/drawDocumentos.ts`), para a escolha do papel e a linha
 * da biblioteca. Decorativo: o nome do papel vai no rótulo ao lado.
 */
function DesenhoDoPapel({ papel }: { papel: PapelDoDocumento }) {
  switch (papel) {
    case 'carta':
      return (
        <>
          <rect x="-17" y="-12" width="34" height="24" rx="2" fill="#f4eee1" stroke="#9a8e74" strokeWidth="2" />
          <path d="M-17-12 0 2 17-12" fill="none" stroke="#9a8e74" strokeWidth="2" />
          <circle cx="0" cy="3" r="4.5" fill="#b8473b" stroke="#7a241d" strokeWidth="1.5" />
        </>
      )
    case 'diario':
      return (
        <>
          <rect x="-14" y="-17" width="28" height="34" rx="2" fill="#f2ecdc" stroke="#8b8270" strokeWidth="2" />
          <path d="M-6-17v34" stroke="#c4574a" strokeWidth="1.5" />
          <path d="M-2-8h12M-2-2h12M-2 4h9" stroke="#7a8aa3" strokeWidth="1.6" />
        </>
      )
    case 'bilhete':
      return (
        <>
          <path d="M-15-14h30v22l-4 3-4-3-4 3-4-3-4 3-4-3-4 3-2-2z" fill="#ece0bd" stroke="#9a8a5e" strokeWidth="2" strokeLinejoin="round" />
          <path d="M-9-7h18M-9-1h14" stroke="#8b7a55" strokeWidth="1.6" />
        </>
      )
    case 'pergaminho':
      return (
        <>
          <rect x="-12" y="-14" width="24" height="28" fill="#ecdcb2" stroke="#9a7646" strokeWidth="2" />
          <rect x="-16" y="-18" width="32" height="7" rx="3.5" fill="#c7a46a" stroke="#8a673a" strokeWidth="2" />
          <rect x="-16" y="11" width="32" height="7" rx="3.5" fill="#c7a46a" stroke="#8a673a" strokeWidth="2" />
        </>
      )
    case 'imagem':
      return (
        <>
          <rect x="-15" y="-18" width="30" height="36" fill="#d8ccb0" stroke="#8b8270" strokeWidth="2" />
          <path d="M-11 12l7-9 5 6 4-4 6 7z" fill="#8b8270" />
          <circle cx="6" cy="-8" r="3.5" fill="#8b8270" />
        </>
      )
    case 'alfinete':
      return (
        <>
          <rect x="-15" y="-17" width="30" height="36" fill="#f1e8d2" stroke="#9a8e74" strokeWidth="2" transform="rotate(-4)" />
          <path d="M-9-6h18M-9 0h16M-9 6h18M-9 12h11" stroke="#8b7a60" strokeWidth="1.6" transform="rotate(-4)" />
          <circle cx="0" cy="-15" r="4" fill="#d2483b" stroke="#8e2a22" strokeWidth="1.5" />
        </>
      )
  }
}

export function IconeDoPapel({ papel }: { papel: PapelDoDocumento }) {
  return (
    <svg viewBox="-24 -24 48 48" aria-hidden="true" focusable="false">
      <DesenhoDoPapel papel={papel} />
    </svg>
  )
}

/** O marcador "Documentos" do livro: a folha com o canto dobrado e as linhas, no traço dos outros ícones do livro. */
export function IconeDosDocumentos() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v4h4" />
      <path d="M10 11h5M10 14h5M10 17h3" />
    </svg>
  )
}
