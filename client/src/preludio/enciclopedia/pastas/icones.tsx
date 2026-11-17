/** Os ícones das pastas e de Campanhas e sistemas (E3), com o traço de 1,6 do app (`.pp-ic`). */

export function IconeSeta() {
  return (
    <svg className="pp-ic" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M6 8l4 4 4-4" />
    </svg>
  )
}

export function IconePasta() {
  return (
    <svg className="pp-ic pp-linha__icone" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M2.5 5.5a1 1 0 0 1 1-1h4l1.6 1.8h7.4a1 1 0 0 1 1 1v8.2a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1z" />
    </svg>
  )
}

/** Sair da pasta de cima: a seta que sobe e vira para a esquerda ("Tirar de", "Para o topo"). */
export function IconeSubir() {
  return (
    <svg className="pp-ic" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M16 16H9a4 4 0 0 1-4-4V4" />
      <path d="M2 7l3-3 3 3" />
    </svg>
  )
}

export function IconePilha() {
  return (
    <svg className="pp-ic pp-linha__icone" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <rect x="3" y="3" width="6" height="6" rx="1" />
      <rect x="11" y="3" width="6" height="6" rx="1" />
      <rect x="3" y="11" width="6" height="6" rx="1" />
      <rect x="11" y="11" width="6" height="6" rx="1" />
    </svg>
  )
}

export function IconeBandeja() {
  return (
    <svg className="pp-ic pp-linha__icone" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M3 11l2.2-6.2a1 1 0 0 1 .9-.6h7.8a1 1 0 0 1 .9.6L17 11v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
      <path d="M3 11h4l1 2h4l1-2h4" />
    </svg>
  )
}

export function IconeMais() {
  return (
    <svg className="pp-ic" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle cx="5" cy="10" r=".9" fill="currentColor" />
      <circle cx="10" cy="10" r=".9" fill="currentColor" />
      <circle cx="15" cy="10" r=".9" fill="currentColor" />
    </svg>
  )
}

export function IconeCerto() {
  return (
    <svg className="pp-ic" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M4.5 10.5l3.5 3.5 7.5-8" />
    </svg>
  )
}

export function IconeEscudo() {
  return (
    <svg className="pp-ic" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M10 2.5l6 2.2v4.6c0 4-2.7 6.7-6 8.2-3.3-1.5-6-4.2-6-8.2V4.7z" />
    </svg>
  )
}

export function IconeLupa() {
  return (
    <svg className="pp-ic" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="M13 13l4 4" />
    </svg>
  )
}

export function IconeGrade() {
  return (
    <svg className="pp-ic" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <rect x="3" y="3" width="6" height="7" rx="1" />
      <rect x="11" y="3" width="6" height="7" rx="1" />
      <rect x="3" y="12" width="6" height="5" rx="1" />
      <rect x="11" y="12" width="6" height="5" rx="1" />
    </svg>
  )
}

export function IconeLista() {
  return (
    <svg className="pp-ic" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M7 5h10M7 10h10M7 15h10" />
      <circle cx="3.5" cy="5" r=".8" fill="currentColor" />
      <circle cx="3.5" cy="10" r=".8" fill="currentColor" />
      <circle cx="3.5" cy="15" r=".8" fill="currentColor" />
    </svg>
  )
}

export function IconeCadeado() {
  return (
    <svg className="pp-ic" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <rect x="4.5" y="9" width="11" height="8" rx="1.5" />
      <path d="M7 9V6.5a3 3 0 0 1 6 0V9" />
    </svg>
  )
}

/** A região na barra de Lugares: o mapa dobrado (a pasta dos lugares). */
export function IconeMapa() {
  return (
    <svg className="pp-ic pp-linha__icone" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M2.5 5.2l4.6-1.9 5.8 1.9 4.6-1.9v11.5l-4.6 1.9-5.8-1.9-4.6 1.9z" />
      <path d="M7.1 3.3v11.5M12.9 5.2v11.5" />
    </svg>
  )
}

/** O selo "N dentro" do cartão do lugar: o marcador de lugar. */
export function IconeLugar() {
  return (
    <svg className="pp-ic" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M10 17.5s5.5-5 5.5-9.3a5.5 5.5 0 0 0-11 0c0 4.3 5.5 9.3 5.5 9.3z" />
      <circle cx="10" cy="8.2" r="1.9" />
    </svg>
  )
}

export function IconeLivro() {
  return (
    <svg className="pp-ic" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M4 3.5h9a2 2 0 0 1 2 2v11H6a2 2 0 0 1-2-2z" />
      <path d="M4 14.5a2 2 0 0 1 2-2h9" />
    </svg>
  )
}
