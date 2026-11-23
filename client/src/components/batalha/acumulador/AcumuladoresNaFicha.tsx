import { lazy, Suspense, useMemo, useState } from 'react'
import type { Personagem } from '../../../lib/personagem'
import type { SistemaDeRpg } from '../../../lib/sistemaDeRpg'
import { acumuladoresNaFicha, comAcumuladorNovo, ganhoNoNivel } from './acumuladoresDaFicha'
import './acumulador.css'

const EditorDoAcumulador = lazy(() => import('./EditorDoAcumulador').then((modulo) => ({ default: modulo.EditorDoAcumulador })))

interface AcumuladoresNaFichaProps {
  personagem: Personagem
  sistema: SistemaDeRpg
  onChange: (personagem: Personagem) => void
}

/**
 * A FAIXA DOS ACUMULADORES no topo da aba Habilidades, na ficha em edição do mestre (ED6): um botão
 * por acumulador (abre o editor nele) e o "+ Acumulador". O editor carrega só ao abrir.
 */
export function AcumuladoresNaFicha({ personagem, sistema, onChange }: AcumuladoresNaFichaProps) {
  // `false` = fechado; senão aberto no id (`null` = no primeiro), `novo` = acabou de ser criado.
  const [aberto, setAberto] = useState<{ id: string | null; novo: boolean } | false>(false)
  const lista = useMemo(() => acumuladoresNaFicha(personagem), [personagem])
  const criar = () => {
    const novo = comAcumuladorNovo(personagem)
    onChange(novo.personagem)
    setAberto({ id: novo.id, novo: true })
  }
  return (
    <section className="lb-acu-faixa" aria-label="Acumuladores da ficha">
      <h5 className="lb-label lb-acu-faixa__tit">Acumuladores</h5>
      {lista.length === 0 ? (
        <span className="lb-acu-faixa__dica">Nenhum. Um medidor que sobe e cai na batalha: Polaridade, Fúria, Cargas.</span>
      ) : (
        <ul className="lb-acu-faixa__lista">
          {lista.map((item) => {
            const da = ganhoNoNivel(item.acumulador, 1)
            return (
              <li key={item.acumulador.id}>
                <button type="button" className="lb-acu-faixa__chip" onClick={() => setAberto({ id: item.acumulador.id, novo: false })}>
                  <b>{item.acumulador.nome}</b>
                  <small>
                    até {item.acumulador.maximo}
                    {da === null ? '' : ` · ${da} por nível`}
                    {item.origem === 'texto' ? ' · do texto' : ''}
                  </small>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <button type="button" className="lb-btn lb-btn--compact" onClick={criar}>
        + Acumulador
      </button>
      {aberto !== false && (
        <Suspense fallback={null}>
          <EditorDoAcumulador personagem={personagem} sistema={sistema} inicial={aberto.id} nomeEmFoco={aberto.novo} onChange={onChange} onFechar={() => setAberto(false)} />
        </Suspense>
      )}
    </section>
  )
}
