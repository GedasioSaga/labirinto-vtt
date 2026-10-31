/**
 * Os ícones do Assistente do mestre, com os MESMOS traços do protótipo
 * aprovado (docs/design/livros-de-regras/prototipo.html: `i-ia`,
 * `i-engrenagem`, `i-enviar`). Mesma classe `.mu-ic` dos ícones do mundo:
 * traço em `currentColor`, a cor vem do CSS de quem usa.
 */

const TRACOS = {
  /** As duas faíscas do assistente. */
  ia: (
    <>
      <path d="M11 3l1.8 4.7 4.7 1.8-4.7 1.8L11 16l-1.8-4.7L4.5 9.5l4.7-1.8z" />
      <path d="M18.5 14l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
    </>
  ),
  engrenagem: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
    </>
  ),
  enviar: (
    <>
      <path d="M4 12 20 4l-6 16-3-7z" />
      <path d="M11 13l9-9" />
    </>
  ),
} as const // as const: mapa literal (as chaves viram o tipo do nome do ícone), não é cast

export type NomeDoIconeDaIa = keyof typeof TRACOS

export function IconeDaIa({ nome }: { nome: NomeDoIconeDaIa }) {
  return (
    <svg className="mu-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {TRACOS[nome]}
    </svg>
  )
}
