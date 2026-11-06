import type { ReactNode } from 'react'
import { useId } from 'react'

/** Esperando o servidor (a lista de mesas, a base da campanha): o giro e o que se espera. */
export function Carregando({ texto }: { texto: string }) {
  return (
    <div className="lo-pagina">
      <p className="lo-carregando" role="status">
        <span className="lo-giro" aria-hidden="true" />
        {texto}
      </p>
    </div>
  )
}

/** Uma página que só diz o que houve e o que fazer (sem mesa, sem acesso, erro). */
export function AvisoDaPagina({ titulo, children, acoes }: { titulo: string; children: ReactNode; acoes?: ReactNode }) {
  const id = useId()
  return (
    <div className="lo-pagina">
      <section className="lo-porta lo-porta--pagina" aria-labelledby={id}>
        <h1 id={id}>{titulo}</h1>
        {children}
        {acoes !== undefined && <div className="lo-porta__acoes">{acoes}</div>}
      </section>
    </div>
  )
}
