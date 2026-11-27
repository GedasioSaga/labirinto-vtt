import { useId } from 'react'
import type { CondicaoDoCatalogo } from '../../../lib/condicoes/catalogo'
import './editor.css'

/**
 * COMEÇAR DE (rework das condições, PLANO.md E6; `blocoComecar` do protótipo, prototipo.html:1309): só na
 * condição nova. Copia o tipo, as peças, o prazo e as saídas de uma pronta (de fábrica ou criada); o nome
 * e a pastilha continuam os do mestre. "Do zero" volta à condição vazia. O editor guarda o passo no Ctrl+Z.
 * A de fábrica que uma criada de mesmo nome encobre aparece como "(de fábrica)": é o único lugar dela.
 */

export interface ComecarDeProps {
  /** As de fábrica (com as sombreadas) e as criadas, na ordem do catálogo. */
  opcoes: readonly CondicaoDoCatalogo[]
  /** O id da escolhida; '' = do zero. */
  valor: string
  aoEscolher: (base: CondicaoDoCatalogo | null) => void
}

function rotuloDaOpcao(condicao: CondicaoDoCatalogo): string {
  return condicao.sombreada === true ? `${condicao.nome} (de fábrica)` : condicao.nome
}

export function ComecarDe({ opcoes, valor, aoEscolher }: ComecarDeProps) {
  const id = useId()
  const grupo = (tipo: 'negativa' | 'positiva') => opcoes.filter((condicao) => condicao.montada.tipo === tipo)
  return (
    <div className="lb-cde-frase">
      <label className="lb-cde-rot" htmlFor={id}>
        Começar de
      </label>
      <select
        id={id}
        className="lb-pc__sel"
        value={valor}
        onChange={(evento) => aoEscolher(opcoes.find((condicao) => condicao.id === evento.target.value) ?? null)}
      >
        <option value="">Do zero</option>
        <optgroup label="Negativas">
          {grupo('negativa').map((condicao) => (
            <option key={condicao.id} value={condicao.id}>
              {rotuloDaOpcao(condicao)}
            </option>
          ))}
        </optgroup>
        <optgroup label="Positivas">
          {grupo('positiva').map((condicao) => (
            <option key={condicao.id} value={condicao.id}>
              {rotuloDaOpcao(condicao)}
            </option>
          ))}
        </optgroup>
      </select>
    </div>
  )
}
