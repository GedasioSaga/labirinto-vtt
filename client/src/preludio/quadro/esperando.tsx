import type { ReactNode } from 'react'

/**
 * Enquanto o quadro abre (o editor baixando ou o arquivo sendo lido): a barra,
 * com as abas da sessão quando houver, já aparece no lugar. Fica fora do
 * pedaço do tldraw: o Prelúdio mostra isto sem baixar o editor.
 */
export function QuadroEsperando({ cabeca }: { cabeca?: ReactNode }) {
  if (cabeca === undefined) {
    return (
      <p className="pr-quieto pr-palco__abrindo" role="status">
        Abrindo o quadro…
      </p>
    )
  }
  return (
    <div className="pr-quadro">
      <div className="pr-quadro__barra">{cabeca}</div>
      <p className="pr-quieto pr-palco__abrindo" role="status">
        Abrindo o quadro…
      </p>
    </div>
  )
}
