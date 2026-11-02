import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { casasDoDeslocamento, metrosPorCasa, temCondicao } from '../../../lib/dbt/batalha/contas'
import { entrantesDaCena } from '../../../lib/dbt/batalha/inicio'
import { fichasDaCena } from '../../../lib/dbt/batalha/leitura'
import { turnoNoM } from '../../../lib/dbt/batalha/ordem'
import type { AcaoDoMestreDBT, AutorDBT, ComandoDBT, ModoDaBatalha, OpcaoDeAcao } from '../../../lib/dbt/batalha/tipos'
import { equipesAtivas, personagensAtivos, sistemaAtivo, useAdventureStore } from '../../../stores/adventureStore'
import { useBatalhaDBTStore } from '../../../stores/batalhaDBTStore'
import { useMapStore } from '../../../stores/mapStore'
import { sistemaPorId, useRpgStore } from '../../../stores/rpgStore'
import { Segmentos } from '../ficha/pecas'
import '../ficha/fichaDBT.css'
import './batalhaDBT.css'
import { avisosDoMestre, candidatosDoAlvo, cartasDaBatalha, fichaDoCombatente, linhaParaDesfazer, opcoesDaVez, tituloDaPendencia, type Fichas } from './dadosDaBatalhaDBT'
import { MenuDeAcoesDBT, type CandidatoAoAlvo } from './MenuDeAcoesDBT'
import { useMiraDBT } from './miraDBT'
import { OrdemDoMestreDBT } from './OrdemDoMestreDBT'
import { PainelIniciativaDBT } from './PainelIniciativaDBT'
import { PendenciaDoMestreDBT, type RespostaDoMestre } from './PendenciaDBT'
import { Secao } from './pecasDaBatalhaDBT'
import { RegistroDBT, linhasDoMestreDBT } from './RegistroDBT'

/**
 * O PAINEL DO MESTRE na batalha DBT (seção 19, `PainelDoMestreDBT`), de cima
 * para baixo na ordem em que o olho precisa: a leitura da rodada e da vez
 * (com o modo e o Desfazer), o que o motor recusou, os avisos, a pendência
 * ativa (o cartão manual, a reação, o Choque), as ações de quem tem a vez,
 * a ordem e o registro. Tudo chama a `batalhaDBTStore` direto; o host avisa
 * os jogadores pelo `deveAvisarJogadoresDBT` do App.
 *
 * Ctrl+Z com o foco dentro do painel desfaz a última linha (fora dele, o
 * Ctrl+Z continua sendo do editor do mapa).
 */

export interface PainelDoMestreDBTProps {
  /** A cena aberta (`tableSceneKey`). */
  sceneKey: string
}

const MESTRE: AutorDBT = { tipo: 'mestre' }
const SEM_FICHAS: Fichas = new Map()
const MODOS = [
  { valor: 'automatico' as const, texto: 'Automático' },
  { valor: 'manual' as const, texto: 'Manual' },
]

function emCampoDeTexto(alvo: EventTarget | null): boolean {
  if (!(alvo instanceof HTMLElement)) return false
  return alvo.isContentEditable || alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.tagName === 'SELECT'
}

export function PainelDoMestreDBT({ sceneKey }: PainelDoMestreDBTProps) {
  const cena = useBatalhaDBTStore((state) => (Object.hasOwn(state.cenas, sceneKey) ? state.cenas[sceneKey] : undefined))
  const personagens = useAdventureStore(personagensAtivos)
  const equipes = useAdventureStore(equipesAtivas)
  const sistemaId = useAdventureStore(sistemaAtivo)
  const biblioteca = useRpgStore((state) => state.biblioteca)
  const tokens = useMapStore((state) => state.map.tokens)
  const escala = useMapStore((state) => state.map.scale)
  const mira = useMiraDBT()
  const [recusa, setRecusa] = useState<string | null>(null)
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

  const registro = cena?.registro
  const ultima = useMemo(() => (registro === undefined ? null : linhaParaDesfazer(registro)), [registro])
  const desfazer = useCallback(
    (linhaId: string) => {
      const ok = useBatalhaDBTStore.getState().desfazer(sceneKey, linhaId, MESTRE)
      setRecusa(ok ? null : 'Só a última linha de pé se desfaz: desfaça as de cima primeiro.')
    },
    [sceneKey],
  )

  // O "espera há" da pendência ativa conta de quando ela apareceu nesta tela.
  const ativaId = cena?.pendencias[0]?.id ?? null
  useEffect(() => {
    if (ativaId === null) setDesde(null)
    else setDesde((antes) => (antes?.id === ativaId ? antes : { id: ativaId, quando: Date.now() }))
  }, [ativaId])

  const cartas = useMemo(() => (cena === undefined ? [] : cartasDaBatalha(cena, fichas)), [cena, fichas])
  const avisos = useMemo(() => (cena === undefined ? [] : avisosDoMestre(cena, fichas)), [cena, fichas])
  const daVez = useMemo(() => (cena === undefined ? null : opcoesDaVez(cena, fichas)), [cena, fichas])
  const linhas = useMemo(() => (registro === undefined ? [] : linhasDoMestreDBT(registro)), [registro])
  const deFora = useMemo(() => {
    if (combatentes === undefined) return []
    return entrantesDaCena(tokens, personagens, equipes, new Set(tokens.map((token) => token.id))).filter((entrante) => !Object.hasOwn(combatentes, entrante.tokenId))
  }, [tokens, personagens, equipes, combatentes])

  if (cena === undefined) return null

  const teclas = (evento: KeyboardEvent<HTMLDivElement>) => {
    const z = evento.key === 'z' || evento.key === 'Z'
    if (!z || !(evento.ctrlKey || evento.metaKey) || evento.shiftKey || evento.altKey || emCampoDeTexto(evento.target)) return
    evento.preventDefault()
    if (ultima !== null) desfazer(ultima.id)
  }

  const vez = cena.ordem.vez === null || !Object.hasOwn(cena.combatentes, cena.ordem.vez) ? null : cena.combatentes[cena.ordem.vez]
  const { n, m } = turnoNoM(cena)
  const ativa = cena.pendencias[0]
  const fila = cena.pendencias.slice(1)
  const fichaDaVez = fichaDoCombatente(vez ?? undefined, fichas)
  const turno = cena.turno !== null && vez !== null && cena.turno.combatenteId === vez.id ? cena.turno : null
  const casas = vez === null || fichaDaVez === null ? null : casasDoDeslocamento(metrosPorCasa(escala), fichaDaVez.deslocamentoM, temCondicao(vez, 'caido'))

  const candidatos = (opcao: OpcaoDeAcao): CandidatoAoAlvo[] =>
    vez === null
      ? []
      : candidatosDoAlvo(cena, vez.id, opcao.alvo).map((c) => {
          const carta = cartas.find((candidata) => candidata.id === c.id)
          return { id: c.id, nome: c.nome, detalhe: carta === undefined || carta.manual ? 'sem ficha' : `CA ${carta.ca ?? 0}, EP ${carta.ep ?? 0}${carta.pv === null ? '' : `, PV ${carta.pv.atual}`}` }
        })

  return (
    <div className="dbf dbb" onKeyDown={teclas} role="region" aria-label="Painel da batalha Dragon Ball">
      <div className="dbb-leitura">
        <span className="dbb-leitura__rodada" aria-label={cena.fase === 'iniciativa' ? 'Iniciativa' : `Rodada ${cena.ordem.rodada}`}>
          <b aria-hidden="true">{cena.fase === 'iniciativa' ? '0' : cena.ordem.rodada}</b>
          <span aria-hidden="true">{cena.fase === 'iniciativa' ? 'iniciativa' : 'rodada'}</span>
        </span>
        <p className="dbb-leitura__vez">
          {cena.fase === 'iniciativa' ? 'Antes do combate' : vez === null ? 'Sem vez' : `Vez de ${vez.nome}`}
          <small>{cena.fase === 'iniciativa' ? 'Declarar formas, rolar e começar' : `Turno ${n} de ${m}${ativa === undefined ? '' : `, esperando: ${tituloDaPendencia(cena, ativa)}`}`}</small>
        </p>
        <div className="dbb-leitura__ctl" style={{ gridColumn: '2' }}>
          <Segmentos<ModoDaBatalha> rotulo="Modo da batalha" opcoes={MODOS} valor={cena.opcoes.modo} onTrocar={(modo) => mestre({ tipo: 'modo', modo })} />
          <button
            type="button"
            className="dbf-btn dbf-btn--sm"
            disabled={ultima === null}
            aria-keyshortcuts="Control+Z"
            title={ultima === null ? 'Nada para desfazer' : `Desfazer: ${ultima.texto} (Ctrl+Z com o foco no painel)`}
            onClick={() => {
              if (ultima !== null) desfazer(ultima.id)
            }}
          >
            Desfazer
          </button>
        </div>
      </div>

      {recusa !== null && (
        <p className="dbb-status" role="status">
          {recusa}
        </p>
      )}
      {avisos.map((aviso) => (
        <p key={aviso.id} className="dbf-aviso dbf-aviso--amber">
          {aviso.texto}
        </p>
      ))}

      {cena.fase === 'iniciativa' && <PainelIniciativaDBT nucleo={cena} fichas={fichas} enviar={enviar} />}

      {ativa !== undefined && ativa.tipo !== 'declaracao' && (
        <Secao titulo="Agora" nota={fila.length === 0 ? undefined : `mais ${fila.length} na fila`}>
          <PendenciaDoMestreDBT nucleo={cena} fichas={fichas} pendencia={ativa} responder={responder} mestre={mestre} desde={desde?.id === ativa.id ? desde.quando : null} />
          {fila.length > 0 && (
            <ul className="dbb-conta" aria-label="Na fila">
              {fila.map((pendencia) => (
                <li key={pendencia.id}>{tituloDaPendencia(cena, pendencia)}</li>
              ))}
            </ul>
          )}
        </Secao>
      )}

      {cena.fase === 'combate' && vez !== null && daVez !== null && (
        <Secao titulo={`Ações de ${vez.nome}`} nota={vez.npc ? undefined : 'O jogador escolhe na tela dele; você pode agir por ele'}>
          <MenuDeAcoesDBT
            key={`${vez.id}-${vez.turnosJogados}`}
            opcoes={daVez.opcoes}
            candidatos={candidatos}
            tecnica={(tecnicaId) => {
              const tecnica = fichaDaVez?.tecnicas.find((candidata) => candidata.id === tecnicaId)
              return tecnica === undefined ? null : { basica: tecnica.basica, acumulacao: tecnica.acumulacao }
            }}
            podeAnunciarBasicos={(turno?.basicosUsados ?? 0) === 0}
            mira={{ ligada: mira.mirando, onLigar: mira.mirar, alvo: mira.alvo }}
            onAgir={(opcao, alvos, extras) => {
              enviar({ tipo: 'agir', combatenteId: vez.id, vez: { rodada: cena.ordem.rodada, turno: vez.turnosJogados }, opcao: opcao.chave, alvos, extras })
            }}
          />
          <div className="dbb-cartao__acoes">
            {casas !== null && turno !== null && (
              <span className={`dbf-tag${turno.andou > casas ? ' dbf-tag--wait' : ''}`} title="Andar além do deslocamento cobra Ki (Correr)">
                Andou {turno.andou} de {casas} casas
              </span>
            )}
            <button type="button" className="dbf-btn dbf-btn--sm" onClick={() => enviar({ tipo: 'passar', vez: { combatenteId: vez.id, rodada: cena.ordem.rodada, turno: vez.turnosJogados } })}>
              Passar a vez
            </button>
          </div>
        </Secao>
      )}

      {cena.fase === 'combate' && (
        <Secao titulo="Ordem" nota="⋯ abre o menu de cada um">
          <OrdemDoMestreDBT cartas={cartas} combate vez={cena.ordem.vez} personagemDe={(id) => cena.combatentes[id]?.personagemId ?? null} deFora={deFora} mestre={mestre} />
        </Secao>
      )}

      <Secao titulo="Registro" nota={ultima === null ? undefined : 'Ctrl+Z desfaz a de cima'}>
        <RegistroDBT linhas={linhas} onDesfazer={desfazer} />
      </Secao>
    </div>
  )
}
