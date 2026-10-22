/**
 * Os ícones da tela do jogador, com os traços do protótipo do grimório
 * (docs/design/consolidado/prototipo/js/icones.js): grade de 24, traço de
 * 1,6 na cor do texto, ponta redonda. Só os que a tela do jogador usa, aqui
 * e não em `components/icons.tsx`, para a página do celular não carregar os
 * ícones do editor. O tamanho vem do CSS de quem usa.
 */
const TRACOS = {
  /** A divisa do "Painel": aponta para baixo, e o CSS a vira quando a folha está aberta. */
  divisa: <path d="M6 9l6 6 6-6" />,
  mira: (
    <>
      <circle cx="12" cy="12" r="6.5" />
      <circle cx="12" cy="12" r="1.5" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
    </>
  ),
  mochila: <path d="M6 9a6 6 0 0 1 12 0v11H6z M9.5 9V5.5h5V9 M9 14h6" />,
  ficha: <path d="M6 3.5h12v17H6z M9 8h6 M9 11.5h6 M9 15h3.5" />,
  bandeira: <path d="M6 20.5V4 M6 4.5h11l-2 4 2 4H6" />,
  regua: <path d="M3.5 16.5l13-13 4 4-13 13z M7.5 12.5l2 2 M10.5 9.5l2 2 M13.5 6.5l2 2" />,
  laser: (
    <>
      <circle cx="12" cy="12" r="2.2" />
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
    </>
  ),
  marcador: <path d="M7 3.5h10v17l-5-3.5-5 3.5z" />,
  mapa: <path d="M3.5 6.5l5.5-2 6 2 5.5-2v13l-5.5 2-6-2-5.5 2z M9 4.5v13 M15 6.5v13" />,
  relogio: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  mao: (
    <path d="M8 11V5.5a1.5 1.5 0 0 1 3 0V11 M11 10V4.5a1.5 1.5 0 0 1 3 0V10 M14 10V6a1.5 1.5 0 0 1 3 0v7c0 4-2.5 7-6 7-2.5 0-4-1.3-5.4-3.5L4 13.2a1.4 1.4 0 0 1 2.4-1.5L8 13.5" />
  ),
  sair: <path d="M14.5 4.5h4v15h-4 M9.5 8l-4 4 4 4 M5.5 12h10" />,
} as const

export type NomeDoIcone = keyof typeof TRACOS

export function IconeDoJogador({ nome, className }: { nome: NomeDoIcone; className?: string }) {
  return (
    <svg className={className === undefined ? 'pp-ic' : `pp-ic ${className}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {TRACOS[nome]}
    </svg>
  )
}
