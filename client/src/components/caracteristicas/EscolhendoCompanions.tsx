import { useMemo, useState } from 'react'
import { gruposParaEscolha } from '../../lib/caracteristicas/companions'
import { personagensAtivos, sistemaAtivo, useAdventureStore } from '../../stores/adventureStore'
import { useBatalhaStore } from '../../stores/batalhaStore'
import { MESTRE } from '../../stores/batalha/cena'
import { sistemaPorId, useRpgStore } from '../../stores/rpgStore'
import { useToastStore } from '../../stores/toastStore'
import { EscolhaDosCompanions } from './EscolhaDosCompanions'
import './caracteristicas.css'

const SEM_DONOS: readonly string[] = []

/**
 * No painel do mestre: "Aira escolhendo…" para cada dono que ainda não disse
 * quem vai, com o "Escolher por ela" (decisão do dono, 23/11 21h59): abre o
 * mesmo diálogo do jogador e decide no lugar dele.
 */
export function EscolhendoCompanions({ sceneKey }: { sceneKey: string }) {
  const escolhendo = useBatalhaStore((state) => (Object.hasOwn(state.cenas, sceneKey) ? (state.cenas[sceneKey]?.turnos.escolhendoCompanions ?? SEM_DONOS) : SEM_DONOS))
  const personagens = useAdventureStore(personagensAtivos)
  const sistemaId = useAdventureStore(sistemaAtivo)
  const biblioteca = useRpgStore((state) => state.biblioteca)
  const sistema = useMemo(() => sistemaPorId(biblioteca, sistemaId) ?? null, [biblioteca, sistemaId])
  const [aberto, setAberto] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  if (escolhendo.length === 0) return null
  const donoAberto = aberto === null ? undefined : personagens.find((personagem) => personagem.id === aberto)

  function entrar(donoId: string, escolhidos: string[]) {
    const motivo = useBatalhaStore.getState().escolherCompanions(sceneKey, MESTRE, donoId, escolhidos)
    if (motivo === null) {
      setAberto(null)
      setErro(null)
      return
    }
    setErro(motivo)
    useToastStore.getState().push('error', motivo)
  }

  return (
    <div className="lb-carac-esperando-lista">
      {escolhendo.map((donoId) => {
        const dono = personagens.find((personagem) => personagem.id === donoId)
        if (dono === undefined) return null
        return (
          <div key={donoId} className="lb-carac-esperando" role="status">
            <span>{dono.nome} escolhendo os companions…</span>
            <button type="button" className="lb-btn lb-btn--compact" onClick={() => setAberto(donoId)}>
              Escolher por {dono.nome}
            </button>
          </div>
        )
      })}
      {donoAberto !== undefined && (
        <EscolhaDosCompanions
          donoNome={donoAberto.nome}
          grupos={gruposParaEscolha(donoAberto, personagens, sistema)}
          quem="mestre"
          erro={erro}
          onEntrar={(escolhidos) => entrar(donoAberto.id, escolhidos)}
          onFechar={() => {
            setAberto(null)
            setErro(null)
          }}
        />
      )}
    </div>
  )
}
