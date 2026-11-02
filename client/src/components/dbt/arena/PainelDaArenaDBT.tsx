import { useCallback, useEffect, useMemo, useState } from 'react'
import { CENA_DA_ARENA } from '../../../lib/arena/tipos'
import { casasDoDeslocamento, metrosPorCasa, temCondicao } from '../../../lib/dbt/batalha/contas'
import { fichasDaCena } from '../../../lib/dbt/batalha/leitura'
import { turnoNoM } from '../../../lib/dbt/batalha/ordem'
import type { AcaoDoMestreDBT, AutorDBT, ComandoDBT, ModoDaBatalha, OpcaoDeAcao } from '../../../lib/dbt/batalha/tipos'
import { numeroDaFicha } from '../../../lib/personagem'
import type { SistemaDeRpg } from '../../../lib/sistemaDeRpg'
import type { CenaDBT } from '../../../stores/batalhaDBTStore'
import { batalhaDaArenaDBT, useArenaDBTStore, type SessaoDaArenaDBT } from '../../../stores/arenaDBTStore'
import { avisosDoMestre, candidatosDoAlvo, cartasDaBatalha, fichaDoCombatente, opcoesDaVez, tituloDaPendencia, type Fichas } from '../batalha/dadosDaBatalhaDBT'
import { MenuDeAcoesDBT, type CandidatoAoAlvo, type MiraDoMenu } from '../batalha/MenuDeAcoesDBT'
import { OrdemDoMestreDBT } from '../batalha/OrdemDoMestreDBT'
import { PainelIniciativaDBT } from '../batalha/PainelIniciativaDBT'
import { PendenciaDoMestreDBT, type RespostaDoMestre } from '../batalha/PendenciaDBT'
import { Secao } from '../batalha/pecasDaBatalhaDBT'
import { RegistroDBT, linhasDoMestreDBT } from '../batalha/RegistroDBT'
import { Segmentos } from '../ficha/pecas'
import { BonecoDaArenaDBT } from './BonecoDaArenaDBT'

/**
 * O PAINEL DO MESTRE NA ARENA DRAGON BALL: o mesmo painel da batalha DBT
 * (`PainelDoMestreDBT`, seção 19), montado das mesmas peças, mas sobre a
 * `batalhaDaArenaDBT` e as cópias da arena (o de verdade lê a aventura e o
 * mapa). De cima para baixo: a rodada e a vez com o modo Automático/Manual,
 * o que o motor recusou, os avisos, a iniciativa, a pendência ativa, as
 * ações de quem tem a vez (o mestre joga todos os lados), os bonecos de
 * treino, a ordem e o registro com o Desfazer de cada linha.
 *
 * "Abrir a ficha" fica fora do menu da carta: a cópia não é ficha da pasta.
 */

export interface PainelDaArenaDBTProps {
  sessao: SessaoDaArenaDBT
  cena: CenaDBT
  sistema: SistemaDeRpg
  /** "Escolher no palco": o clique na ficha do palco vira o alvo. */
  mira: MiraDoMenu
}

const MESTRE: AutorDBT = { tipo: 'mestre' }
const METROS_POR_CASA = metrosPorCasa(null)
const SEM_ENTRANTES: readonly never[] = []
const MODOS = [
  { valor: 'automatico' as const, texto: 'Automático' },
  { valor: 'manual' as const, texto: 'Manual' },
]

export function PainelDaArenaDBT({ sessao, cena, sistema, mira }: PainelDaArenaDBTProps) {
  const [recusa, setRecusa] = useState<string | null>(null)
  const [desde, setDesde] = useState<{ id: string; quando: number } | null>(null)
  const { combatentes, registro } = cena
  const fichas = useMemo<Fichas>(() => fichasDaCena(sessao.copias, sistema, Object.values(combatentes)), [sessao.copias, sistema, combatentes])

  const enviar = useCallback((comando: ComandoDBT): boolean => {
    const resposta = batalhaDaArenaDBT.getState().comando(CENA_DA_ARENA, MESTRE, comando)
    setRecusa(resposta.ok ? null : (resposta.motivo ?? 'O motor recusou'))
    return resposta.ok
  }, [])
  const mestre = useCallback((acao: AcaoDoMestreDBT) => enviar({ tipo: 'mestre', acao }), [enviar])
  const responder = useCallback((resposta: RespostaDoMestre) => enviar({ tipo: 'responder', ...resposta }), [enviar])
  const desfazerLinha = useCallback((linhaId: string) => {
    const ok = useArenaDBTStore.getState().desfazerLinha(linhaId)
    setRecusa(ok ? null : 'Só a última linha de pé se desfaz: desfaça as de cima primeiro.')
  }, [])

  // O "espera há" da pendência ativa conta de quando ela apareceu nesta tela.
  const ativaId = cena.pendencias[0]?.id ?? null
  useEffect(() => {
    if (ativaId === null) setDesde(null)
    else setDesde((antes) => (antes?.id === ativaId ? antes : { id: ativaId, quando: Date.now() }))
  }, [ativaId])

  const cartas = useMemo(() => cartasDaBatalha(cena, fichas), [cena, fichas])
  const avisos = useMemo(() => avisosDoMestre(cena, fichas), [cena, fichas])
  const daVez = useMemo(() => opcoesDaVez(cena, fichas), [cena, fichas])
  const linhas = useMemo(() => linhasDoMestreDBT(registro), [registro])

  const vez = cena.ordem.vez === null || !Object.hasOwn(cena.combatentes, cena.ordem.vez) ? null : cena.combatentes[cena.ordem.vez]
  const { n, m } = turnoNoM(cena)
  const ativa = cena.pendencias[0]
  const fila = cena.pendencias.slice(1)
  const fichaDaVez = fichaDoCombatente(vez ?? undefined, fichas)
  const turno = cena.turno !== null && vez !== null && cena.turno.combatenteId === vez.id ? cena.turno : null
  const casas = vez === null || fichaDaVez === null ? null : casasDoDeslocamento(METROS_POR_CASA, fichaDaVez.deslocamentoM, temCondicao(vez, 'caido'))
  const bonecoDaVez = vez !== null && Object.hasOwn(sessao.bonecoDe, vez.id)

  const candidatos = (opcao: OpcaoDeAcao): CandidatoAoAlvo[] =>
    vez === null
      ? []
      : candidatosDoAlvo(cena, vez.id, opcao.alvo).map((c) => {
          const carta = cartas.find((candidata) => candidata.id === c.id)
          return { id: c.id, nome: c.nome, detalhe: carta === undefined || carta.manual ? 'sem ficha' : `CA ${carta.ca ?? 0}, EP ${carta.ep ?? 0}${carta.pv === null ? '' : `, PV ${carta.pv.atual}`}` }
        })

  /** O PV de agora de cada boneco, pela cópia dele. */
  const pvDoBoneco = (bonecoId: string): number | undefined => {
    const tokenId = Object.keys(sessao.bonecoDe).find((id) => sessao.bonecoDe[id] === bonecoId)
    const personagemId = sessao.tokens.find((token) => token.id === tokenId)?.characterId
    const copia = sessao.copias.find((candidata) => candidata.id === personagemId)
    return copia === undefined ? undefined : numeroDaFicha(copia.recursos, 'pv')
  }

  return (
    <div className="dbf dbb dba-painel" role="region" aria-label="Painel da batalha da arena">
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

      {cena.fase === 'combate' && vez !== null && daVez !== null && !bonecoDaVez && (
        <Secao titulo={`Ações de ${vez.nome}`}>
          <MenuDeAcoesDBT
            key={`${vez.id}-${vez.turnosJogados}`}
            opcoes={daVez.opcoes}
            candidatos={candidatos}
            tecnica={(tecnicaId) => {
              const tecnica = fichaDaVez?.tecnicas.find((candidata) => candidata.id === tecnicaId)
              return tecnica === undefined ? null : { basica: tecnica.basica, acumulacao: tecnica.acumulacao }
            }}
            podeAnunciarBasicos={(turno?.basicosUsados ?? 0) === 0}
            mira={mira}
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
      {cena.fase === 'combate' && vez !== null && bonecoDaVez && (
        <div className="dbb-cartao__acoes">
          <p className="dba-nota" role="status">
            Vez de {vez.nome}: boneco de treino não age, a vez passa sozinha.
          </p>
          {/* Se o motor recusar o passo automático (algo pendente), o mestre passa à mão. */}
          <button type="button" className="dbf-btn dbf-btn--sm" onClick={() => enviar({ tipo: 'passar', vez: { combatenteId: vez.id, rodada: cena.ordem.rodada, turno: vez.turnosJogados } })}>
            Passar a vez
          </button>
        </div>
      )}

      {sessao.montagem.bonecos.length > 0 && (
        <Secao titulo="Bonecos de treino" nota="Fora do registro; o Desfazer do alto volta">
          <ul className="dba-bonecos">
            {sessao.montagem.bonecos.map((boneco) => (
              <BonecoDaArenaDBT
                key={boneco.id}
                boneco={boneco}
                momento="luta"
                pvAtual={pvDoBoneco(boneco.id)}
                onAjustar={(ajuste) => useArenaDBTStore.getState().ajustarBoneco(boneco.id, ajuste)}
              />
            ))}
          </ul>
        </Secao>
      )}

      {cena.fase === 'combate' && (
        <Secao titulo="Ordem" nota="⋯ abre o menu de cada um">
          <OrdemDoMestreDBT cartas={cartas} combate vez={cena.ordem.vez} personagemDe={() => null} deFora={SEM_ENTRANTES} mestre={mestre} />
        </Secao>
      )}

      <Secao titulo="Registro" nota="Ctrl+Z desfaz a última coisa feita na arena">
        <RegistroDBT linhas={linhas} onDesfazer={desfazerLinha} />
      </Secao>
    </div>
  )
}
