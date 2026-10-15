import type { ReactNode } from 'react'

/*
 * Os ícones de traço do livro do mestre, com os mesmos desenhos do protótipo
 * (docs/design/consolidado/prototipo/js/icones.js): 24 px de caixa, traço de
 * 1,6 na cor do texto. Só os que a lombada e o topo usam.
 */

const caminho = (d: string) => <path d={d} />

/** A engrenagem de 8 dentes do protótipo, calculada uma vez. */
function dentesDaEngrenagem(): string {
  const dentes = 8
  const pontos: string[] = []
  const ponto = (angulo: number, raio: number) => `${(12 + Math.cos(angulo) * raio).toFixed(2)} ${(12 + Math.sin(angulo) * raio).toFixed(2)}`
  for (let i = 0; i < dentes; i++) {
    const a = (i / dentes) * Math.PI * 2
    const meio = Math.PI / dentes
    const largura = meio * 0.42
    const rampa = meio * 0.2
    pontos.push(ponto(a - largura - rampa, 7.1), ponto(a - largura, 9.4), ponto(a + largura, 9.4), ponto(a + largura + rampa, 7.1))
  }
  return `M${pontos.join('L')}Z`
}

const DESENHOS = {
  selo: caminho('M7.5 5.5h9 M7.5 5.5v13h9 M10.5 9v6'),
  ficha: caminho('M6 3.5h12v17H6z M9 8h6 M9 11.5h6 M9 15h3.5'),
  cena: caminho('M3.5 6.5l5.5-2 6 2 5.5-2v13l-5.5 2-6-2-5.5 2z M9 4.5v13 M15 6.5v13'),
  aventura: caminho('M5 6.5a2 2 0 0 1 2-2h11.5v13H7a2 2 0 0 0-2 2z M5 19.5a2 2 0 0 1 2-2h11.5v2.5H7 M9 8.5h6'),
  acervo: caminho('M4 4.5h16v15H4z M4 12h16 M10 8.2h4 M10 15.7h4'),
  recolherEsq: caminho('M13 7l-5 5 5 5 M18 7l-5 5 5 5'),
  desfazer: caminho('M9 6.5L4.5 11 9 15.5 M4.5 11H14a5 5 0 0 1 0 10h-2.5'),
  refazer: caminho('M15 6.5l4.5 4.5-4.5 4.5 M19.5 11H10a5 5 0 0 0 0 10h2.5'),
  salvar: caminho('M5 4h11l3 3v13H5z M8 4v4.5h7V4 M8 20v-6h8v6'),
  arquivo: caminho('M4 7.5V5.5h6l2 2h8v11.5H4z M4 10h16'),
  ajuda: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      {caminho('M9.6 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.2.9-1.2 1.8 M12 16.6v.01')}
    </>
  ),
  mais: caminho('M12 5v14 M5 12h14'),
  busca: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      {caminho('M15 15l5 5')}
    </>
  ),
  engrenagem: (
    <>
      {caminho(dentesDaEngrenagem())}
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  voltar: caminho('M10.5 5.5L4 12l6.5 6.5 M4.5 12H20'),
  cenas: caminho('M12 3.5l8.5 4.5L12 12.5 3.5 8z M3.5 12.3l8.5 4.5 8.5-4.5 M3.5 16.3l8.5 4.5 8.5-4.5'),
  pasta: caminho('M3.5 6.5h6l2 2h9v10.5h-17z'),
  importar: caminho('M12 4v11 M7.5 10.5L12 15l4.5-4.5 M4.5 14.5v5h15v-5'),
  exportar: caminho('M12 15V4 M7.5 8.5L12 4l4.5 4.5 M4.5 14.5v5h15v-5'),
  imagem: (
    <>
      {caminho('M4.5 5.5h15v13h-15z M4.5 15.5l4-4 3.5 3.5 2.5-2.5 5 5')}
      <circle cx="15.5" cy="9" r="1.5" />
    </>
  ),
  varinha: caminho('M4.5 19.5l11-11 M15 4.5l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8z'),
  casa: caminho('M4 11l8-6.5 8 6.5 M6.5 9v10.5h11V9'),
  baixo: caminho('M6 9l6 6 6-6'),
} satisfies Record<string, ReactNode>

export type NomeDoIcone = keyof typeof DESENHOS

/** Ícone de traço do livro; o tamanho vem do CSS de quem o usa (20 px na lombada, 16 nos botões pequenos). */
export function IconeDoLivro({ nome }: { nome: NomeDoIcone }) {
  return (
    <svg
      className="gr-ic"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {DESENHOS[nome]}
    </svg>
  )
}
