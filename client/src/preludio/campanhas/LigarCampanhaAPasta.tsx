import { useEffect, useState } from 'react'
import { lerIndiceDasPastas, lerRpgDaPasta, type PastaDeMapas } from '../../lib/pastasDeMapas'
import { campanhaComPasta } from '../../lib/preparo/campanhaESistema'
import { pastaDeMesmoNome } from '../../lib/preparo/doVerbeteParaOMapa'
import type { Campanha } from '../../lib/preparo/tipos'
import { usePreludio } from '../estado/preludio'
import './campanhas.css'

/**
 * "LIGAR ALI MESMO" (pedido 6 de 17/11/2026): a campanha do verbete ainda não
 * tem pasta de mapas, e a ficha mora na pasta. No lugar do aviso, o botão
 * "Usar a pasta One Piece" quando há pasta com o nome da campanha; senão, a
 * lista das pastas. Liga a campanha uma vez (como a tela Campanhas e sistemas)
 * e o "Virar NPC" acende.
 */

type Pastas = { readonly t: 'lendo' } | { readonly t: 'lidas'; readonly pastas: readonly PastaDeMapas[] }

function usePastasDeMapas(): Pastas {
  const [pastas, setPastas] = useState<Pastas>({ t: 'lendo' })
  useEffect(() => {
    let vivo = true
    void lerIndiceDasPastas().then(({ indice }) => {
      if (vivo) setPastas({ t: 'lidas', pastas: indice.pastas })
    })
    return () => {
      vivo = false
    }
  }, [])
  return pastas
}

export interface LigarCampanhaAPastaProps {
  campanha: Campanha
  /** Ligou: quem abriu dá o retorno (acende o botão, põe o foco nele). */
  aoLigar: (pasta: PastaDeMapas) => void
}

export function LigarCampanhaAPasta({ campanha, aoLigar }: LigarCampanhaAPastaProps) {
  const pastas = usePastasDeMapas()
  const mudarCampanha = usePreludio((estado) => estado.mudarCampanha)
  const ir = usePreludio((estado) => estado.ir)
  const [ligando, setLigando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const ligar = async (pasta: PastaDeMapas) => {
    if (ligando) return
    setLigando(true)
    setErro(null)
    // O sistema da pasta decide se a campanha ainda guarda o seu (a mesma regra da tela Campanhas e sistemas).
    const rpg = await lerRpgDaPasta(pasta.id)
    const motivo = await mudarCampanha(campanha.id, (atual) => campanhaComPasta(atual, pasta.id, rpg.ok ? rpg.rpg.sistemaDeRpg : undefined))
    setLigando(false)
    if (motivo !== null) {
      setErro(motivo)
      return
    }
    aoLigar(pasta)
  }

  const lidas = pastas.t === 'lidas' ? pastas.pastas : []
  const sugerida = pastaDeMesmoNome(lidas, campanha.nome)
  return (
    <div className="pr-ligar-pasta">
      <p className="pr-virar-npc__motivo">
        A campanha <b>{campanha.nome}</b> ainda não tem pasta de mapas, e a ficha mora na pasta.
      </p>
      {pastas.t === 'lendo' ? (
        <p className="pr-virar-npc__motivo">Lendo as pastas de mapas…</p>
      ) : sugerida !== null ? (
        <button type="button" className="gr-bt gr-bt--p gr-bt--latao" disabled={ligando} onClick={() => void ligar(sugerida)}>
          {ligando ? 'Ligando…' : `Usar a pasta ${sugerida.nome}`}
        </button>
      ) : lidas.length === 0 ? (
        <p className="pr-virar-npc__motivo">Ainda não há pasta de mapas. Crie uma na tela Carregar mapa.</p>
      ) : (
        <label className="pr-campo">
          <span className="pr-campo__rotulo">
            Escolha a pasta de {campanha.nome}
          </span>
          <select
            className="pr-campo__entrada"
            value=""
            disabled={ligando}
            onChange={(evento) => {
              const pasta = lidas.find((uma) => uma.id === evento.target.value)
              if (pasta !== undefined) void ligar(pasta)
            }}
          >
            <option value="">{ligando ? 'Ligando…' : 'Escolha a pasta de mapas'}</option>
            {lidas.map((pasta) => (
              <option key={pasta.id} value={pasta.id}>
                {pasta.nome}
              </option>
            ))}
          </select>
        </label>
      )}
      {erro !== null && (
        <p className="pr-aviso" role="alert">
          {erro}
        </p>
      )}
      <p className="pr-virar-npc__motivo">
        Outra pasta ou outro sistema:{' '}
        <button type="button" className="pr-ligar-pasta__tela" onClick={() => ir({ secao: 'campanhas' })}>
          Campanhas e sistemas
        </button>
      </p>
    </div>
  )
}
