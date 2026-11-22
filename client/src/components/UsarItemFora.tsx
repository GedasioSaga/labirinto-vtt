import { useId, useState } from 'react'
import type { CarriedItem } from '../types/map'

/**
 * O "USAR" DA VAGA FORA DA BATALHA (SISTEMA.md §5.2, Fase 8): o botão, a
 * escolha de em quem (a própria ficha ou uma ficha de jogador na cena) e o
 * motivo, quando o item não se usa fora (granada, reforço). O mesmo no
 * mestre e no jogador; quem resolve é quem chama `onUsar`.
 */

export interface CandidatoDoUso {
  /** O id que `onUsar` recebe: o personagem (mestre) ou o token (jogador, pela rede). */
  id: string
  nome: string
}

export interface UsarItemForaProps {
  item: CarriedItem
  /** Por que não se usa fora da batalha; `null` = serve. */
  motivo: string | null
  /** Em quem pode: o primeiro é quem usa. Só um = sem escolha. */
  candidatos: readonly CandidatoDoUso[]
  /** Usa em `id`; devolve o motivo de não ter usado, ou `null` (usou). O jogador espera a resposta do host. */
  onUsar: (id: string) => string | null | Promise<string | null>
}

export function UsarItemFora({ item, motivo, candidatos, onUsar }: UsarItemForaProps) {
  const idBase = useId()
  const [escolhido, setEscolhido] = useState<string>(candidatos[0]?.id ?? '')
  const [recusa, setRecusa] = useState<string | null>(null)
  const [esperando, setEsperando] = useState(false)
  // O candidato escolhido saiu da cena: volta para quem usa.
  const alvo = candidatos.some((candidato) => candidato.id === escolhido) ? escolhido : (candidatos[0]?.id ?? '')
  const desligado = motivo !== null || alvo === '' || esperando
  const aviso = motivo ?? recusa
  return (
    <span className="lb-inv__usar">
      {motivo === null && candidatos.length > 1 && (
        <>
          <label className="lb-inv__usar-rotulo" htmlFor={`${idBase}-em`}>
            em
          </label>
          <select id={`${idBase}-em`} className="lb-input lb-inv__usar-em" value={alvo} onChange={(event) => setEscolhido(event.target.value)}>
            {candidatos.map((candidato, indice) => (
              <option key={candidato.id} value={candidato.id}>
                {indice === 0 ? `${candidato.nome} (si)` : candidato.nome}
              </option>
            ))}
          </select>
        </>
      )}
      <button
        type="button"
        className="lb-btn lb-btn--primary lb-btn--compact"
        disabled={desligado}
        aria-label={`Usar ${item.nome}`}
        aria-describedby={aviso === null ? undefined : `${idBase}-aviso`}
        onClick={() => {
          const resposta = onUsar(alvo)
          if (!(resposta instanceof Promise)) {
            setRecusa(resposta)
            return
          }
          setEsperando(true)
          void resposta.then((dita) => {
            setRecusa(dita)
            setEsperando(false)
          })
        }}
      >
        Usar
      </button>
      {aviso !== null && (
        <span id={`${idBase}-aviso`} className="lb-inv__usar-aviso" role={recusa === null ? undefined : 'alert'}>
          {aviso}
        </span>
      )}
    </span>
  )
}
