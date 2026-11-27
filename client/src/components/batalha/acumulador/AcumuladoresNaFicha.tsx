import { useMemo } from 'react'
import type { Personagem } from '../../../lib/personagem'
import { acumuladoresNaFicha, ganhoNoNivel } from './acumuladoresDaFicha'
import './acumulador.css'

interface AcumuladoresNaFichaProps {
  personagem: Personagem
  /** Tocar num acumulador abre a habilidade dona dele no editor (o cartão onde a definição mora). */
  onAbrirDona: (cartaoId: string) => void
  /** A dona está na lista (pode abrir)? Fora dela (outra aba), o botão fica só para ler. */
  podeAbrir: (cartaoId: string) => boolean
}

/**
 * A FAIXA DOS ACUMULADORES no topo da lista de habilidades da ficha (rework das habilidades, D9 e
 * decisão 16 do protótipo aprovado): só mostra os que existem. O acumulador nasce e muda na peça
 * Acumulador da habilidade dona; tocar abre a dona no editor. Sem "+ Acumulador" e sem janela própria.
 */
export function AcumuladoresNaFicha({ personagem, onAbrirDona, podeAbrir }: AcumuladoresNaFichaProps) {
  const lista = useMemo(() => acumuladoresNaFicha(personagem), [personagem])
  return (
    <section className="lb-acu-faixa" aria-label="Acumuladores da ficha">
      <h5 className="lb-label lb-acu-faixa__tit">Acumuladores</h5>
      {lista.length === 0 ? (
        <span className="lb-acu-faixa__dica">Nenhum. Nascem dentro da habilidade que os usa (peça Acumulador).</span>
      ) : (
        <ul className="lb-acu-faixa__lista">
          {lista.map((item) => {
            const da = ganhoNoNivel(item.acumulador, 1)
            const abre = podeAbrir(item.cartaoId)
            const dona = item.cartaoNome.trim() === '' ? 'a habilidade sem nome' : item.cartaoNome
            return (
              <li key={item.acumulador.id}>
                <button
                  type="button"
                  className="lb-acu-faixa__chip"
                  disabled={!abre}
                  aria-label={`${item.acumulador.nome}, de ${dona}: abrir ${dona} no editor`}
                  title={abre ? undefined : `Mora em ${dona}, fora da lista de habilidades`}
                  onClick={() => onAbrirDona(item.cartaoId)}
                >
                  <b>{item.acumulador.nome}</b>
                  <small>
                    até {item.acumulador.maximo}
                    {da === null ? '' : ` · ${da} por nível`}
                    {item.origem === 'texto' ? ' · do texto' : ''}
                    {` · de ${dona}`}
                  </small>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {lista.length > 0 && <span className="lb-acu-faixa__dica">Tocar abre a habilidade dona.</span>}
    </section>
  )
}
