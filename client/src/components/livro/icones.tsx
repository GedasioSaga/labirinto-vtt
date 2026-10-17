import type { ReactNode } from 'react'

/*
 * Os ícones de traço do livro do mestre, com os mesmos desenhos do protótipo
 * (docs/design/consolidado/prototipo/js/icones.js): 24 px de caixa, traço de
 * 1,6 na cor do texto. Só os que as lombadas, os topos e a página Mesa usam.
 */

const caminho = (d: string) => <path d={d} />
/** O pontinho cheio do protótipo (reticências, os dados da Mesa). */
const ponto = (x: number, y: number) => <circle key={`${x}-${y}`} cx={x} cy={y} r={1.1} fill="currentColor" stroke="none" />

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
  // Livro da mesa (fatia 4): lombada, topo da Sala e página Mesa.
  mesa: (
    <>
      <rect x="4.5" y="4.5" width="15" height="15" rx="3" />
      {ponto(9, 9)}
      {ponto(12, 12)}
      {ponto(15, 15)}
    </>
  ),
  grupo: (
    <>
      <circle cx="9" cy="9" r="3" />
      <circle cx="16.5" cy="8.2" r="2.4" />
      {caminho('M3.5 18.5c.8-2.8 2.8-4.3 5.5-4.3s4.7 1.5 5.5 4.3 M15.6 13.3c2.4-.2 4.2 1.1 4.9 3.7')}
    </>
  ),
  chat: caminho('M4.5 5.5h15v10.5H10l-4 3.5v-3.5H4.5z'),
  recolherDir: caminho('M11 7l5 5-5 5 M6 7l5 5-5 5'),
  reticencias: (
    <>
      {ponto(6, 12)}
      {ponto(12, 12)}
      {ponto(18, 12)}
    </>
  ),
  olho: (
    <>
      {caminho('M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z')}
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  olhoFechado: caminho('M3.5 3.5l17 17 M10.6 5.6A10 10 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16.6 16.6 0 0 1-2.6 3.4 M6.4 6.9C3.9 8.6 2.5 12 2.5 12s3.5 6.5 9.5 6.5a9.6 9.6 0 0 0 4.2-1 M9.9 10a2.8 2.8 0 0 0 4 4'),
  laser: (
    <>
      <circle cx="12" cy="12" r="2.2" />
      {caminho('M12 3v4M12 17v4M3 12h4M17 12h4')}
    </>
  ),
  som: caminho('M4.5 9.5h3.5l4.5-4v13l-4.5-4H4.5z M15.5 9a4.2 4.2 0 0 1 0 6 M18 6.5a7.8 7.8 0 0 1 0 11'),
  somMudo: caminho('M4.5 9.5h3.5l4.5-4v13l-4.5-4H4.5z M16 9.5l5 5 M21 9.5l-5 5'),
  convidar: (
    <>
      <circle cx="9.5" cy="8.5" r="3.2" />
      {caminho('M3.5 19c.8-3 3.1-4.6 6-4.6s5.2 1.6 6 4.6 M18.5 7.5v6 M15.5 10.5h6')}
    </>
  ),
  copiar: caminho('M8.5 8.5h11v11h-11z M15.5 8.5v-4h-11v11h4'),
  caderno: caminho('M6 3.5h11.5a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6z M9 3.5v17 M12 8h4 M12 11.5h4'),
  rota: (
    <>
      <circle cx="6" cy="6" r="2" />
      <circle cx="18" cy="18" r="2" />
      {caminho('M8 6h6.5a3 3 0 0 1 0 6h-5a3 3 0 0 0 0 6H16')}
    </>
  ),
  pausa: caminho('M8 5.5v13M16 5.5v13'),
  ruido: caminho('M4 12h1.5 M8 8.5v7 M11.5 5.5v13 M15 8.5v7 M18.5 11v2'),
  monitor: caminho('M3.5 5h17v11h-17z M8.5 20h7 M12 16v4'),
  livro: caminho('M12 6.5c-2-1.5-5-2-8-1.5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-13c-3-.5-6 0-8 1.5z M12 6.5v13'),
  dispensar: caminho('M14.5 4.5h4v15h-4 M9.5 8l-4 4 4 4 M5.5 12h10'),
  // Os da página Grupo (fatia 5): linha do jogador, título de cada cena e o pé da lista.
  mira: (
    <>
      <circle cx="12" cy="12" r="6.5" />
      <circle cx="12" cy="12" r="1.5" />
      {caminho('M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3')}
    </>
  ),
  carta: caminho('M4 6.5h16v11H4z M4 7l8 6 8-6'),
  seta: caminho('M4.5 12h14 M13 6.5l5.5 5.5-5.5 5.5'),
  /** "Travado" (a trava da ficha do token). */
  cadeado: caminho('M6 11h12v9H6z M8.5 11V8a3.5 3.5 0 0 1 7 0v3'),
  floco: caminho('M12 3v18 M4.2 7.5l15.6 9 M4.2 16.5l15.6-9 M9.5 4.5L12 7l2.5-2.5 M9.5 19.5L12 17l2.5 2.5'),
  /** O floco riscado: "Descongelar". */
  degelo: caminho('M12 3v18 M4.2 7.5l15.6 9 M4.2 16.5l15.6-9 M9.5 4.5L12 7l2.5-2.5 M9.5 19.5L12 17l2.5 2.5 M3.5 20.5l17-17'),
  seguir: caminho('M4.5 12h10 M10.5 7l5 5-5 5 M19.5 5v14'),
  /** Apagar a seleção (cabeça da ficha). */
  lixo: caminho('M4.5 7h15 M9.5 7V4.5h5V7 M6.5 7l1 12.5h9l1-12.5 M10.5 10.5v6 M13.5 10.5v6'),
  /** Endireitar (Mais ações). */
  regua: caminho('M3.5 16.5l13-13 4 4-13 13z M7.5 12.5l2 2 M10.5 9.5l2 2 M13.5 6.5l2 2'),
  /** Voltar da sub-ficha para a ficha do item. */
  esq: caminho('M15 6l-6 6 6 6'),
  /* Ficha do token (fatia 9): Condições e os cartões de Comportamento. */
  estrela: caminho('M12 4l2.3 4.9 5.2.6-3.9 3.6 1.1 5.2L12 15.7l-4.7 2.6 1.1-5.2-3.9-3.6 5.2-.6z'),
  elo: caminho('M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'),
  carroca: (
    <>
      {caminho('M3.5 14.5h17 M5.5 14.5V9h13v5.5 M9 9V6h6v3')}
      <circle cx="7.5" cy="17.5" r="2" />
      <circle cx="16.5" cy="17.5" r="2" />
    </>
  ),
  relogio: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      {caminho('M12 7.5V12l3 2')}
    </>
  ),
  lampiao: caminho('M9 4.5h6 M12 2.5v2 M8 8.5h8l-1 10H9z M8 8.5l1.2-4h5.6l1.2 4 M12 12v3'),
  pessoa: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      {caminho('M5 20c1-3.8 3.6-5.6 7-5.6s6 1.8 7 5.6')}
    </>
  ),
  /* Ficha da porta (fatia 11): o estado, as fichas e o "Mais ações". */
  parede: caminho('M3.5 6.5h17v11h-17z M3.5 12h17 M9 6.5V12 M15 12v5.5'),
  porta: (
    <>
      {caminho('M6.5 20.5V4.5h11v16 M4 20.5h16')}
      {ponto(14.6, 12.6)}
    </>
  ),
  portaAberta: caminho('M2.5 16h5 M16.5 16h5 M7.5 16l3.1-8.5'),
  portaFechada: caminho('M2.5 16h5 M16.5 16h5 M7.5 16h9'),
  chave: (
    <>
      <circle cx="8" cy="15.5" r="3.5" />
      {caminho('M10.5 13l8-8 M16 7.5l2.5 2.5 M13.8 9.7l1.8 1.8')}
    </>
  ),
  pulso: caminho('M3.5 12.5h4l2.5-6 4 11 2.5-5h4'),
  troca: caminho('M4.5 8.5h14l-3.5-3.5 M19.5 15.5h-14l3.5 3.5'),
  // A ficha do pino (fatia 12): os tipos, os recursos e o "Tirar do pino".
  exclamacao: caminho('M12 5v9.5 M12 18.6v.2'),
  interrogacao: caminho('M9 9a3 3 0 1 1 4.3 2.7c-.8.4-1.3 1-1.3 1.9V15 M12 18.6v.2'),
  viagem: caminho('M5.5 19.5L12 4l6.5 15.5L12 16z'),
  alavanca: (
    <>
      {caminho('M5 19.5h14 M12 19.5l4-12.5')}
      <circle cx="16.6" cy="5.6" r="2" />
    </>
  ),
  play: caminho('M7.5 5.5l11 6.5-11 6.5z'),
  filme: caminho('M4 6.5h16v13H4z M4 10.5h16 M8 6.5l-1.5 4 M13 6.5l-1.5 4 M18 6.5l-1.5 4'),
  joia: caminho('M7 4.5h10l3.5 4.5L12 20 3.5 9z M3.5 9h17 M9.5 4.5L12 9l2.5-4.5'),
  peca: caminho('M5 8h4a2 2 0 1 1 4 0h4v4a2 2 0 1 1 0 4v4H5z'),
  loja: caminho('M4.5 9.5l1.5-5h12l1.5 5 M4.5 9.5v10h15v-10 M4.5 9.5h15 M10 19.5v-5h4v5'),
  cabine: caminho('M6.5 3.5h11v17h-11z M12 3.5v17 M8.3 9.5l1.2-1.4 1.2 1.4 M13.3 14.5l1.2 1.4 1.2-1.4'),
  x: caminho('M6.5 6.5l11 11M17.5 6.5l-11 11'),
  nevoa: caminho('M4 9h12 M7 12.5h13 M4 16h10'),
  luz: (
    <>
      <circle cx="12" cy="12" r="3.5" />
      {caminho('M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8')}
    </>
  ),
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
