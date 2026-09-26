import { useId, useRef, useState, type FormEvent } from 'react'
import { CABINE_NOME_MAX, cabineDaParada, cabineNaParada, type CabineDeTransporte } from '../lib/cabine'
import type { PinDestination } from '../types/map'

export interface PinCabineControlsProps {
  /** As cabines da aventura. */
  cabines: readonly CabineDeTransporte[]
  /** Este pino como parada: a cena aberta e o id dele. */
  parada: PinDestination
  /** Nome da cena, para "A cabine está em outra parada (Topo do Farol)". Só o mestre lê. */
  nomeDaCena: (sceneId: string) => string
  /** Cria uma cabine com este pino como primeira parada e a cabine nele. */
  onCriar: (nome: string) => void
  /** Este pino passa a ser parada de `cabineId` (`null` = de nenhuma). */
  onEscolher: (cabineId: string | null) => void
  /** "Trazer a cabine para cá". */
  onTrazer: (cabineId: string) => void
  /** "Atender a próxima chamada": a cabine vai à parada da primeira chamada da fila. */
  onAtender: (cabineId: string) => void
  /** "Limpar a fila". */
  onLimparFila: (cabineId: string) => void
  /**
   * OCUPANTE: id da cabine → nome de quem embarcou nela e espera o "Deixar
   * ir" (estado da sessão, do host). Ausente ou sem a cabine = ninguém dentro.
   */
  ocupantes?: Readonly<Record<string, string>>
}

/** Valor da lista que quer dizer "não é parada de cabine nenhuma". */
const NENHUMA = ''

/** Onde a cabine está, dito ao mestre (que pode saber a cena). */
function ondeEsta(cabine: CabineDeTransporte, aqui: boolean, nomeDaCena: (sceneId: string) => string): string {
  if (aqui) return 'A cabine está aqui.'
  if (cabine.atual === null) return 'A cabine não está em parada nenhuma.'
  return `A cabine está em outra parada (${nomeDaCena(cabine.atual.sceneId)}).`
}

/**
 * CABINE DE TRANSPORTE no painel do pino de viagem: elevador, paternoster,
 * cesto. O mestre diz de qual cabine este pino é parada (ou cria uma nova
 * aqui), lê onde a cabine está e a traz. O jogador só passa com a cabine na
 * parada e lê só "aqui/longe" — nunca o nome da cabine (`lib/fogFilter.ts`).
 */
export function PinCabineControls({ cabines, parada, nomeDaCena, onCriar, onEscolher, onTrazer, onAtender, onLimparFila, ocupantes }: PinCabineControlsProps) {
  const baseId = useId()
  const listaId = `${baseId}-cabine`
  const nomeId = `${baseId}-nome`
  const erroId = `${baseId}-erro`
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const nomeRef = useRef<HTMLInputElement | null>(null)

  const cabine = cabineDaParada(cabines, parada.sceneId, parada.pinId)
  const aqui = cabineNaParada(cabines, parada.sceneId, parada.pinId) === 'aqui'
  const fila = cabine?.fila ?? []
  const ocupante = cabine === null ? undefined : ocupantes?.[cabine.id]

  const criar = (event: FormEvent) => {
    event.preventDefault()
    if (nome.trim().length === 0) {
      setErro('Dê um nome à cabine.')
      nomeRef.current?.focus()
      return
    }
    onCriar(nome.trim())
    setNome('')
    setErro(null)
  }

  return (
    <div className="lb-world-amarra">
      <div className="lb-field">
        <label className="lb-label" htmlFor={listaId}>
          Cabine (elevador, cesto)
        </label>
        <select id={listaId} className="lb-input" value={cabine?.id ?? NENHUMA} onChange={(event) => onEscolher(event.target.value === NENHUMA ? null : event.target.value)}>
          <option value={NENHUMA}>Nenhuma</option>
          {cabines.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </div>
      {cabine !== null ? (
        <>
          <p className="lb-travel__hint" role="status">
            {ondeEsta(cabine, aqui, nomeDaCena)} O jogador só passa com a cabine aqui.
          </p>
          {ocupante !== undefined && <p className="lb-travel__hint">Na cabine: {ocupante}, esperando você deixar ir.</p>}
          <button type="button" className="lb-btn lb-btn--block" disabled={aqui} onClick={() => onTrazer(cabine.id)}>
            Trazer a cabine para cá
          </button>
          {fila.length === 0 ? (
            <p className="lb-travel__hint">Ninguém chamou a cabine.</p>
          ) : (
            <>
              {/* Quem chamou primeiro está no alto: é quem "Atender" atende. */}
              <p className="lb-label" aria-hidden="true">
                Fila de chamadas
              </p>
              <ol className="lb-travel__hint" aria-label="Fila de chamadas">
                {fila.map((chamada) => (
                  <li key={`${chamada.parada.sceneId}|${chamada.parada.pinId}`}>
                    {nomeDaCena(chamada.parada.sceneId)} · {chamada.nome}
                  </li>
                ))}
              </ol>
              <button type="button" className="lb-btn lb-btn--block" onClick={() => onAtender(cabine.id)}>
                Atender a próxima chamada
              </button>
              <button type="button" className="lb-btn lb-btn--block" onClick={() => onLimparFila(cabine.id)}>
                Limpar a fila
              </button>
            </>
          )}
        </>
      ) : (
        <form className="lb-world__form" onSubmit={criar} noValidate>
          <div className="lb-field">
            <label className="lb-label" htmlFor={nomeId}>
              Nova cabine
            </label>
            <input
              ref={nomeRef}
              id={nomeId}
              className="lb-input"
              value={nome}
              maxLength={CABINE_NOME_MAX}
              placeholder="Espinha"
              aria-invalid={erro !== null}
              aria-describedby={erro !== null ? erroId : undefined}
              onChange={(e) => {
                setNome(e.target.value)
                if (erro !== null) setErro(null)
              }}
            />
          </div>
          {erro !== null && (
            <p id={erroId} className="lb-world__erro">
              {erro}
            </p>
          )}
          <button type="submit" className="lb-btn">
            Criar cabine aqui
          </button>
        </form>
      )}
    </div>
  )
}
