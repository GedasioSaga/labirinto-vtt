import type { ReactNode } from 'react'

/*
 * OS DESENHOS da ficha Conteúdo (redesign aprovado pelo mestre em 21/11/2026,
 * docs/design/bau/conteudo-do-bau.html): o que não é item do acervo nem
 * documento ganha a própria miniatura na vaga — as moedas, a ferramenta do
 * minigame de cada objeto (cadeado, pé de cabra, marreta), o bicho da
 * armadilha e o próprio objeto (o convite do vazio e o cartão de aberto).
 * Mesma grade de 48 do `IconeDoPapel`, para as vagas ficarem iguais.
 */

export type DesenhoDoConteudo = 'moedas' | 'cadeado' | 'pe-de-cabra' | 'marreta' | 'cobra' | 'aranha' | 'nada' | 'bau' | 'bau-aberto' | 'caixa' | 'barril'

const DESENHOS: Record<DesenhoDoConteudo, ReactNode> = {
  moedas: (
    <>
      <g stroke="#6e4610" strokeWidth="2" strokeLinejoin="round">
        <path d="M-16 12 V16 A11 4 0 0 0 6 16 V12" fill="#c98a24" />
        <ellipse cx="-5" cy="12" rx="11" ry="4" fill="#f2c560" />
        <path d="M-16 6 V10 A11 4 0 0 0 6 10 V6" fill="#c98a24" />
        <ellipse cx="-5" cy="6" rx="11" ry="4" fill="#f2c560" />
        <path d="M-15 0 V4 A11 4 0 0 0 7 4 V0" fill="#c98a24" />
        <ellipse cx="-4" cy="0" rx="11" ry="4" fill="#f2c560" />
        <circle cx="11" cy="-9" r="9" fill="#f2c560" />
      </g>
      <circle cx="11" cy="-9" r="5.5" fill="none" stroke="#c98a24" strokeWidth="1.6" />
    </>
  ),
  cadeado: (
    <>
      <path d="M-8 -3 V-9 A8 8 0 0 1 8 -9 V-3" fill="none" stroke="#41484d" strokeWidth="6" />
      <path d="M-8 -3 V-9 A8 8 0 0 1 8 -9 V-3" fill="none" stroke="#a8b0b5" strokeWidth="3" />
      <rect x="-13" y="-4" width="26" height="22" rx="3.5" fill="#e0a44a" stroke="#6e4610" strokeWidth="2" />
      <circle cx="0" cy="5" r="3.4" fill="#2a1f0e" />
      <path d="M-1.6 7 H1.6 L2.4 12 H-2.4 Z" fill="#2a1f0e" />
    </>
  ),
  'pe-de-cabra': (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M-15 17 L9 -11 C12 -15 18 -15 18 -10" stroke="#3d2420" strokeWidth="7" />
      <path d="M-15 17 L9 -11 C12 -15 18 -15 18 -10" stroke="#b0473a" strokeWidth="4" />
      <path d="M-15 17 L-19 15 M-15 17 L-14 21" stroke="#41484d" strokeWidth="3" />
    </g>
  ),
  marreta: (
    <>
      <path d="M-14 18 L6 -4" stroke="#43290f" strokeWidth="7" strokeLinecap="round" />
      <path d="M-14 18 L6 -4" stroke="#a87a45" strokeWidth="4" strokeLinecap="round" />
      <g transform="rotate(-48 6 -4)">
        <rect x="-5" y="-12" width="22" height="13" rx="2.5" fill="#8f979d" stroke="#41484d" strokeWidth="2" />
      </g>
    </>
  ),
  cobra: (
    <>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M-17 16 C-8 18 4 12 -2 6 C-8 0 -12 -8 0 -10 C7 -11 9 -15 7 -18" stroke="#33461a" strokeWidth="8" />
        <path d="M-17 16 C-8 18 4 12 -2 6 C-8 0 -12 -8 0 -10 C7 -11 9 -15 7 -18" stroke="#7b9a3e" strokeWidth="5" />
      </g>
      <ellipse cx="9" cy="-17" rx="6" ry="4.5" fill="#7b9a3e" stroke="#33461a" strokeWidth="2" transform="rotate(-20 9 -17)" />
      <circle cx="10.5" cy="-18.5" r="1.3" fill="#f3e27a" />
      <path d="M14.5 -19.5 L19 -21 M14.5 -19.5 L18.5 -17" stroke="#d2483b" strokeWidth="1.4" strokeLinecap="round" />
    </>
  ),
  aranha: (
    <>
      <g fill="none" stroke="#2a201d" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M-4 -2 L-12 -10 L-17 -6 M-4 1 L-14 -2 L-19 3 M-4 3 L-13 7 L-16 14 M-3 5 L-8 12 L-9 19" />
        <path d="M4 -2 L12 -10 L17 -6 M4 1 L14 -2 L19 3 M4 3 L13 7 L16 14 M3 5 L8 12 L9 19" />
      </g>
      <ellipse cx="0" cy="6" rx="7" ry="8.5" fill="#4a3a35" stroke="#2a201d" strokeWidth="2" />
      <circle cx="0" cy="-5" r="4.6" fill="#4a3a35" stroke="#2a201d" strokeWidth="2" />
      <path d="M-2 4 L0 9 L2 4" fill="none" stroke="#d2483b" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="-1.6" cy="-6" r="1" fill="#e2645a" />
      <circle cx="1.6" cy="-6" r="1" fill="#e2645a" />
    </>
  ),
  nada: <circle cx="0" cy="0" r="11" fill="none" stroke="#858480" strokeWidth="2" strokeDasharray="3 3.4" />,
  bau: (
    <>
      <path d="M-18 -2 V-7 C-18 -14 -12 -16 0 -16 C12 -16 18 -14 18 -7 V-2 Z" fill="#8a5a2f" stroke="#43290f" strokeWidth="2" strokeLinejoin="round" />
      <rect x="-18" y="-2" width="36" height="18" rx="2" fill="#74491f" stroke="#43290f" strokeWidth="2" />
      <path d="M-11 -15.5 V16 M11 -15.5 V16" stroke="#c8963e" strokeWidth="2.4" />
      <rect x="-3.5" y="-5" width="7" height="8" rx="1.5" fill="#e0a44a" stroke="#6e4610" strokeWidth="1.6" />
    </>
  ),
  'bau-aberto': (
    <>
      <path d="M-18 -4 L-15 -19 C-6 -22 6 -22 15 -19 L18 -4 Z" fill="#5e3a19" stroke="#43290f" strokeWidth="2" strokeLinejoin="round" />
      <path d="M-15 -4 L-13 -16 C-5 -18 5 -18 13 -16 L15 -4 Z" fill="#2a1a0c" />
      <rect x="-18" y="-4" width="36" height="20" rx="2" fill="#74491f" stroke="#43290f" strokeWidth="2" />
      <path d="M-11 -4 V16 M11 -4 V16" stroke="#c8963e" strokeWidth="2.4" />
    </>
  ),
  caixa: (
    <>
      <rect x="-17" y="-15" width="34" height="31" rx="1.5" fill="#a87a45" stroke="#4e3216" strokeWidth="2" />
      <path d="M-17 -5 H17 M-17 6 H17" stroke="#7a5428" strokeWidth="1.8" />
      <path d="M-15 -13 L15 14" stroke="#7a5428" strokeWidth="3.4" strokeLinecap="round" />
    </>
  ),
  barril: (
    <>
      <path d="M-11 -18 H11 C16 -10 16 10 11 18 H-11 C-16 10 -16 -10 -11 -18 Z" fill="#8a5a2f" stroke="#43290f" strokeWidth="2" strokeLinejoin="round" />
      <path d="M-13.6 -10 H13.6 M-13.6 10 H13.6" stroke="#9aa3a8" strokeWidth="3" />
      <path d="M-4 -18 C-6 -6 -6 6 -4 18 M4 -18 C6 -6 6 6 4 18" stroke="#6b4424" strokeWidth="1.4" fill="none" />
    </>
  ),
}

/** Um desenho na grade de 48, decorativo (a linha já diz o nome). */
export function Desenho({ nome }: { nome: DesenhoDoConteudo }) {
  return (
    <svg viewBox="-24 -24 48 48" aria-hidden="true" focusable="false">
      {DESENHOS[nome]}
    </svg>
  )
}

/** Os traços finos dos botões da ficha (o "+", o "−", a lixeira, a lupa e o visto). */
export type IconeDoConteudo = 'mais' | 'menos' | 'lixo' | 'lupa' | 'certo'

const ICONES: Record<IconeDoConteudo, ReactNode> = {
  mais: <path d="M12 5v14M5 12h14" strokeWidth="2.2" />,
  menos: <path d="M5 12h14" strokeWidth="2.2" />,
  lixo: (
    <path
      d="M4 7h16M10 11v6M14 11v6M6 7l1 12.5c.1.8.7 1.5 1.6 1.5h6.8c.9 0 1.5-.7 1.6-1.5L18 7M9 7V4.5c0-.3.2-.5.5-.5h5c.3 0 .5.2.5.5V7"
      strokeWidth="1.9"
      strokeLinejoin="round"
    />
  ),
  lupa: (
    <>
      <circle cx="11" cy="11" r="6.5" strokeWidth="2" />
      <path d="m16 16 4.5 4.5" strokeWidth="2" />
    </>
  ),
  certo: <path d="m5 12.5 4.5 4.5L19 7.5" strokeWidth="2.4" strokeLinejoin="round" />,
}

export function Icone({ nome }: { nome: IconeDoConteudo }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" aria-hidden="true" focusable="false">
      {ICONES[nome]}
    </svg>
  )
}
