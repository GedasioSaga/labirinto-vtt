/**
 * OS ÍCONES DAS PEÇAS (rework do editor de habilidades, E4; `GLIFOS` do protótipo aprovado,
 * docs/design/habilidades-rework/prototipo.html). Traço de 24 px, sem preenchimento: a cor vem do
 * `currentColor` de quem desenha (a cor da família, a do elemento). Decorativos: o nome da peça
 * sempre anda junto, então o ícone fica fora da leitura de tela.
 */

type Traco = { d: string } | { circulo: readonly [number, number, number] } | { caixa: readonly [number, number, number, number, number] }

const GLIFOS = {
  pergunta: [{ circulo: [12, 12, 8.5] }, { d: 'M9.6 9.4a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.7M12 16.8h.01' }],
  fogo: [{ d: 'M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.3 1.5 1 2.5 2 2.8C10.5 8.5 11 5.5 12 3z' }],
  gelo: [{ d: 'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9' }, { d: 'M9.5 4.5 12 6l2.5-1.5M9.5 19.5 12 18l2.5 1.5' }],
  raio: [{ d: 'M13 2.5 5.5 13.5H12l-1 8 7.5-11H12z' }],
  veneno: [{ d: 'M12 3.5c3 3.6 5.5 6.6 5.5 9.7a5.5 5.5 0 0 1-11 0c0-3.1 2.5-6.1 5.5-9.7z' }, { d: 'M10 13.5h.01M14 13.5h.01M10.5 16.5h3' }],
  luz: [{ circulo: [12, 12, 4] }, { d: 'M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8' }],
  trevas: [{ d: 'M19.5 14.5A8 8 0 1 1 9.5 4.5a6.5 6.5 0 0 0 10 10z' }],
  vento: [{ d: 'M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3M3 12h8' }],
  estrela: [{ d: 'm12 3 2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z' }],
  gatilho: [{ circulo: [12, 13, 7.5] }, { d: 'M12 9v4l2.5 2M9.5 2.5h5M12 2.5v3' }],
  raca: [{ d: 'M5 20c0-4 3-7 7-7s7 3 7 7' }, { d: 'M8 10.5a4 4 0 1 0 8 0' }, { d: 'M8.5 9 6 3.5 9.8 7M15.5 9 18 3.5 14.2 7' }],
  overload: [{ d: 'M12 2.5 14 9l6.5-1.5L16 12l4.5 4.5L14 15l-2 6.5L10 15l-6.5 1.5L8 12 3.5 7.5 10 9z' }],
  forma: [{ d: 'M4 6c2.5-1 5-1.5 8-1.5S17.5 5 20 6c0 7-3 13-8 13.5C7 19 4 13 4 6z' }, { d: 'M8 10.5c.8-.6 1.7-.6 2.5 0M13.5 10.5c.8-.6 1.7-.6 2.5 0M9.5 15c1.5 1 3.5 1 5 0' }],
  status: [{ d: 'M5 19.5h14' }, { d: 'M8 15V9M12 15V5.5M16 15v-4' }, { d: 'M10 7.5 12 5.5l2 2' }],
  elo: [{ d: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1' }, { d: 'M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1' }],
  acum: [{ caixa: [4, 15, 16, 4, 1] }, { caixa: [5.5, 10, 13, 4, 1] }, { caixa: [7, 5, 10, 4, 1] }],
  desce: [{ d: 'M12 4v12M6.5 10.5 12 16l5.5-5.5' }, { d: 'M5 20.5h14' }],
  marca: [{ circulo: [12, 12, 8] }, { circulo: [12, 12, 3.5] }, { d: 'M12 2v3M12 19v3M2 12h3M19 12h3' }],
  invocacao: [{ d: 'M6 19c0-3 2.5-5 6-5s6 2 6 5' }, { circulo: [12, 8.5, 3.5] }, { d: 'M4 5.5 6 7.5M20 5.5 18 7.5M12 1.5V3' }],
  devolve: [{ d: 'M9 8 4.5 12.5 9 17' }, { d: 'M4.5 12.5H15a4.5 4.5 0 0 0 0-9h-2' }, { d: 'M20 20.5 16.5 17' }],
  mais: [{ d: 'M12 5v14M5 12h14' }],
  x: [{ d: 'M6 6l12 12M18 6 6 18' }],
  cima: [{ d: 'm6 15 6-6 6 6' }],
  baixo: [{ d: 'm6 9 6 6 6-6' }],
  aviso: [{ d: 'M12 3.5 21 19.5H3z' }, { d: 'M12 10v4.5M12 17h.01' }],
} satisfies Record<string, readonly Traco[]>

/** Os nomes dos ícones que as peças usam. */
export type NomeDoGlifo = keyof typeof GLIFOS

export function ehNomeDoGlifo(nome: string): nome is NomeDoGlifo {
  return Object.hasOwn(GLIFOS, nome)
}

/** O ícone; nome desconhecido (vindo do registro) = a estrela. */
export function Glifo({ nome, className }: { nome: string; className?: string }) {
  const tracos: readonly Traco[] = ehNomeDoGlifo(nome) ? GLIFOS[nome] : GLIFOS.estrela
  return (
    <svg className={className === undefined ? 'lb-pc__ic' : `lb-pc__ic ${className}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {tracos.map((traco, indice) => {
        if ('d' in traco) return <path key={indice} d={traco.d} />
        if ('circulo' in traco) return <circle key={indice} cx={traco.circulo[0]} cy={traco.circulo[1]} r={traco.circulo[2]} />
        return <rect key={indice} x={traco.caixa[0]} y={traco.caixa[1]} width={traco.caixa[2]} height={traco.caixa[3]} rx={traco.caixa[4]} />
      })}
    </svg>
  )
}
