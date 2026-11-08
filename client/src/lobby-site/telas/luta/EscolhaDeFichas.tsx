import type { FichaDoSite } from '../../dados/sessaoDaCampanha'

/**
 * As fichas que vão para a luta, como botões de ligar e desligar (a mesma
 * pílula do treino, `.lo-tr-ficha`). No teto, as que estão fora ficam
 * desligadas com o motivo no rótulo.
 */
export function EscolhaDeFichas({ fichas, escolhidas, maximo, onMudar, desligado = false }: { fichas: readonly FichaDoSite[]; escolhidas: readonly string[]; maximo: number; onMudar(ids: string[]): void; desligado?: boolean }) {
  const cheio = escolhidas.length >= maximo
  return (
    <div className="lo-tr-fichas" role="group">
      {fichas.map(({ doc }) => {
        const dentro = escolhidas.includes(doc.id)
        return (
          <button
            key={doc.id}
            type="button"
            className="lo-tr-ficha"
            aria-pressed={dentro}
            disabled={desligado || (!dentro && cheio)}
            title={!dentro && cheio ? `No máximo ${maximo}` : undefined}
            onClick={() => onMudar(dentro ? escolhidas.filter((id) => id !== doc.id) : [...escolhidas, doc.id])}
          >
            {doc.nome}
          </button>
        )
      })}
    </div>
  )
}
