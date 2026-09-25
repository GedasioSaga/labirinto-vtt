import { useId } from 'react'
import type { EstadoDoMundo } from '../lib/estadoDoMundo'
import { gravarPosto, tirarPosto } from '../lib/rotinaDoNpc'
import type { PostoDaRotina, RotinaDoNpc, Token } from '../types/map'

/** Valor da lista de estado que quer dizer "a ficha não tem rotina". */
const NENHUMA = ''

export interface RotinaDaFichaControlsProps {
  token: Token
  estados: readonly EstadoDoMundo[]
  /** As cenas da aventura, para dizer ONDE fica cada posto. */
  cenas: readonly { id: string; name: string }[]
  /** A cena aberta: é nela que "Gravar aqui" grava o posto. */
  cenaAberta: string
  /** A rotina nova; `undefined` tira a rotina da ficha. */
  onChange: (rotina: RotinaDoNpc | undefined) => void
}

/** "Confessionário 77" — ou "esta cena", que é o que o mestre olha agora. */
function ondeFica(posto: PostoDaRotina, cenas: RotinaDaFichaControlsProps['cenas'], cenaAberta: string): string {
  if (posto.sceneId === cenaAberta) return 'Nesta cena'
  return cenas.find((cena) => cena.id === posto.sceneId)?.name ?? 'Cena que não existe mais'
}

/**
 * ROTINA DO NPC — o posto da ficha em cada turno. O mestre escolhe o estado
 * que faz de apito ("Apito"), arrasta a ficha até onde ela fica num turno e
 * toca "Gravar aqui" naquele turno; a cena aberta e o lugar da ficha viram o
 * posto. Trocar o estado em "Estado do mundo" leva a ficha ao posto, mesmo em
 * outra cena. Turno sem posto: a ficha fica onde está. Nada disto vai ao
 * jogador (`lib/fogFilter.ts`).
 */
export function RotinaDaFichaControls({ token, estados, cenas, cenaAberta, onChange }: RotinaDaFichaControlsProps) {
  const baseId = useId()
  const rotina = token.rotina
  if (estados.length === 0 && rotina === undefined) {
    return (
      <p className="lb-world-amarra__vazio">
        Para a ficha mudar de lugar a cada turno, crie um estado em "Estado do mundo" (por exemplo "Apito": Aurora, Meio, Brasa, Sombra).
      </p>
    )
  }

  const estado = rotina === undefined ? undefined : estados.find((e) => e.id === rotina.estadoId)
  const estadoId = `${baseId}-estado`
  // Estado que sumiu da aventura: os valores dos postos são tudo o que sobra dele.
  const valores = estado !== undefined ? estado.valores : rotina === undefined ? [] : rotina.postos.map((posto) => posto.valor)

  const escolherEstado = (id: string) => {
    if (id === NENHUMA) {
      onChange(undefined)
      return
    }
    if (id === rotina?.estadoId || !estados.some((e) => e.id === id)) return
    onChange({ estadoId: id, postos: [] })
  }

  return (
    <div className="lb-world-amarra">
      <div className="lb-field">
        <label className="lb-label" htmlFor={estadoId}>
          Rotina por
        </label>
        <select id={estadoId} className="lb-input" value={rotina?.estadoId ?? NENHUMA} onChange={(event) => escolherEstado(event.target.value)}>
          <option value={NENHUMA}>Nenhuma</option>
          {estados.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
          {rotina !== undefined && estado === undefined && <option value={rotina.estadoId}>Estado que não existe mais</option>}
        </select>
      </div>
      {rotina !== undefined && (
        <ul className="lb-world-amarra__valores">
          {valores.map((valor) => {
            const posto = rotina.postos.find((p) => p.valor === valor)
            return (
              <li key={valor} className="lb-rotina__turno">
                <span className="lb-label">
                  {valor}
                  {estado?.atual === valor && <span className="lb-world-amarra__agora"> (agora)</span>}
                </span>
                <span className="lb-rotina__onde">{posto === undefined ? 'Fica onde está' : ondeFica(posto, cenas, cenaAberta)}</span>
                <span className="lb-rotina__acoes">
                  <button
                    type="button"
                    className="lb-btn lb-btn--ghost"
                    aria-label={`Gravar aqui para ${valor}`}
                    onClick={() => onChange(gravarPosto(rotina, { valor, sceneId: cenaAberta, x: token.x, y: token.y }))}
                  >
                    Gravar aqui
                  </button>
                  {posto !== undefined && (
                    <button type="button" className="lb-btn lb-btn--ghost" aria-label={`Tirar posto de ${valor}`} onClick={() => onChange(tirarPosto(rotina, valor))}>
                      Tirar
                    </button>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
