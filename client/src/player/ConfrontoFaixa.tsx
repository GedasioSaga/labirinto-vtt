import type { PlayerConfronto } from '../lib/confronto'
import type { Token } from '../types/map'

interface ConfrontoFaixaProps {
  confronto: PlayerConfronto
  /** As fichas do mapa que ele recebeu: o nome vem daqui, já recortado pelo host. */
  tokens: readonly Token[]
}

/** "Sua vez · 4 casas" / "Vez de: Rato 1" / "Vez de outro". */
function textoDaVez(confronto: PlayerConfronto, nomeDaVez: string | null): string {
  if (confronto.suaVez) {
    const restam = confronto.restam ?? confronto.passo
    return `Sua vez · ${restam} ${restam === 1 ? 'casa' : 'casas'}`
  }
  return nomeDaVez === null ? 'Vez de outro' : `Vez de: ${nomeDaVez}`
}

/**
 * CONFRONTO na tela do jogador: faixa no alto com de quem é a vez e a fila.
 * Só lê o que o host mandou (`PlayerConfronto`): a fila já vem sem ficha
 * escondida, e o nome é o da ficha que chegou no recorte — o jogador nunca vê
 * id cru nem nome de trabalho do mestre. Ficha da fila que não está no mapa
 * recebido (saiu da visão entre dois snapshots) fica de fora.
 */
export function ConfrontoFaixa({ confronto, tokens }: ConfrontoFaixaProps) {
  const nomes = new Map(tokens.map((t) => [t.id, t.name]))
  const fila = confronto.fila.flatMap((id) => {
    const nome = nomes.get(id)
    return nome === undefined ? [] : [{ id, nome }]
  })
  const nomeDaVez = confronto.vez === null ? null : nomes.get(confronto.vez) ?? null
  return (
    <section className={confronto.suaVez ? 'pp-confronto pp-confronto--sua' : 'pp-confronto'} aria-label="Confronto">
      <p className="pp-confronto__vez" role="status" aria-live="polite">
        {textoDaVez(confronto, nomeDaVez)}
      </p>
      {fila.length > 0 && (
        <ol className="pp-confronto__fila" aria-label="Ordem da vez">
          {fila.map((item) => (
            <li key={item.id} className="pp-confronto__item" aria-current={item.id === confronto.vez ? 'true' : undefined}>
              {item.nome}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
