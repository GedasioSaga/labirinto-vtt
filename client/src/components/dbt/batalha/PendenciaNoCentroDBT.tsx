import { useCallback, useEffect, useMemo, useState } from 'react'
import { fichasDaCena } from '../../../lib/dbt/batalha/leitura'
import type { AcaoDoMestreDBT, AutorDBT, ComandoDBT, NucleoDBT, Pendencia } from '../../../lib/dbt/batalha/tipos'
import { personagensAtivos, sistemaAtivo, useAdventureStore } from '../../../stores/adventureStore'
import { useBatalhaDBTStore } from '../../../stores/batalhaDBTStore'
import { sistemaPorId, useRpgStore } from '../../../stores/rpgStore'
import '../ficha/fichaDBT.css'
import './batalhaDBT.css'
import { tituloDaPendencia, type Fichas } from './dadosDaBatalhaDBT'
import { PendenciaDoMestreDBT, type RespostaDoMestre } from './PendenciaDBT'

/**
 * A PENDÊNCIA DO MESTRE NO MEIO DO MAPA (conserto de 18/11/2026, "às vezes as
 * coisas da batalha ficam na lateral em vez do meio"). Na batalha Dragon Ball
 * tudo o que esperava o mestre (confirmar o golpe no modo manual, a reação e o
 * teste do NPC, o Choque de Poder) morava só na página Batalha do livro, na
 * coluna da direita: com o livro em outra página, ou recolhido, o pedido não
 * aparecia em lugar nenhum do mapa. Aqui a pendência ATIVA que é do mestre
 * abre sobre o mapa, no mesmo lugar da carta REAÇÃO do One Piece
 * (`ReacaoNoCentro`), com o mesmo cartão da página (`PendenciaDoMestreDBT`):
 * a regra não muda, as respostas saem pelo mesmo `comando` da store.
 *
 * A página do livro continua com o cartão dela (a fila, a ordem, o registro).
 * "Recolher" deixa só o aviso curto, para o mestre ver o mapa; pendência nova
 * abre de novo. Montada por `EfeitosDoMestreDBT`, que já mora na área do mapa.
 */

const MESTRE: AutorDBT = { tipo: 'mestre' }
const SEM_FICHAS: Fichas = new Map()

/** A pendência espera o MESTRE: é dele (confirmar, Choque, o alvo NPC), ou de um combatente que é NPC. A declaração fica na tabela da iniciativa. */
export function pendenciaEsperaOMestre(nucleo: NucleoDBT, pendencia: Pendencia | undefined): pendencia is Pendencia {
  if (pendencia === undefined || pendencia.tipo === 'declaracao') return false
  if (pendencia.responde.tipo === 'mestre') return true
  const quem = pendencia.responde.id
  return Object.hasOwn(nucleo.combatentes, quem) && nucleo.combatentes[quem].npc
}

export function PendenciaNoCentroDBT({ sceneKey }: { sceneKey: string }) {
  const cena = useBatalhaDBTStore((state) => (Object.hasOwn(state.cenas, sceneKey) ? state.cenas[sceneKey] : undefined))
  const personagens = useAdventureStore(personagensAtivos)
  const sistemaId = useAdventureStore(sistemaAtivo)
  const biblioteca = useRpgStore((state) => state.biblioteca)
  const [recusa, setRecusa] = useState<string | null>(null)
  /** A pendência que o mestre recolheu: fica só o aviso curto até outra chegar. */
  const [recolhida, setRecolhida] = useState<string | null>(null)
  const [desde, setDesde] = useState<{ id: string; quando: number } | null>(null)

  const sistema = useMemo(() => sistemaPorId(biblioteca, sistemaId) ?? null, [biblioteca, sistemaId])
  const combatentes = cena?.combatentes
  const fichas = useMemo<Fichas>(() => (combatentes === undefined ? SEM_FICHAS : fichasDaCena(personagens, sistema, Object.values(combatentes))), [personagens, sistema, combatentes])

  const enviar = useCallback(
    (comando: ComandoDBT): boolean => {
      const resposta = useBatalhaDBTStore.getState().comando(sceneKey, MESTRE, comando)
      setRecusa(resposta.ok ? null : (resposta.motivo ?? 'O motor recusou'))
      return resposta.ok
    },
    [sceneKey],
  )
  const mestre = useCallback((acao: AcaoDoMestreDBT) => enviar({ tipo: 'mestre', acao }), [enviar])
  const responder = useCallback((resposta: RespostaDoMestre) => enviar({ tipo: 'responder', ...resposta }), [enviar])

  const ativaId = cena?.pendencias[0]?.id ?? null
  // O "espera há" conta de quando ela apareceu nesta tela; a recusa da pendência de antes não vale para a nova.
  useEffect(() => {
    setRecusa(null)
    if (ativaId === null) setDesde(null)
    else setDesde((antes) => (antes?.id === ativaId ? antes : { id: ativaId, quando: Date.now() }))
  }, [ativaId])

  const ativa = cena?.pendencias[0]
  if (cena === undefined || !pendenciaEsperaOMestre(cena, ativa)) return null

  if (recolhida === ativa.id) {
    return (
      <div className="dbb-centro-do-mestre" data-recolhida="sim">
        <button type="button" className="dbf dbf-btn dbf-btn--sm" onClick={() => setRecolhida(null)}>
          Esperando você: {tituloDaPendencia(cena, ativa)}
        </button>
      </div>
    )
  }

  const naFila = cena.pendencias.length - 1
  return (
    <div className="dbb-centro-do-mestre">
      <section className="dbf dbb" aria-label="A batalha espera o mestre">
        <div className="dbb-centro-do-mestre__topo">
          <span className="dbf-tag dbf-tag--wait">Esperando você{naFila > 0 ? `, mais ${naFila} na fila` : ''}</span>
          <button type="button" className="dbf-btn dbf-btn--xs dbf-btn--ghost" onClick={() => setRecolhida(ativa.id)}>
            Recolher
          </button>
        </div>
        {recusa !== null && (
          <p className="dbb-status" role="status">
            {recusa}
          </p>
        )}
        <PendenciaDoMestreDBT nucleo={cena} fichas={fichas} pendencia={ativa} responder={responder} mestre={mestre} desde={desde?.id === ativa.id ? desde.quando : null} />
      </section>
    </div>
  )
}
