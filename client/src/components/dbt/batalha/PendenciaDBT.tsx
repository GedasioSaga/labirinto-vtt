import { useState, type ReactNode } from 'react'
import type { AcaoDoMestreDBT, ComandoDBT, EdicoesDoMestre, NucleoDBT, Pendencia } from '../../../lib/dbt/batalha/tipos'
import { CaixaDeReacaoDBT, golpeDoAtaque, respostasDaJanela } from './CaixaDeReacaoDBT'
import { ChoqueDePoderDBT } from './ChoqueDePoderDBT'
import { ConfirmacaoDBT } from './ConfirmacaoDBT'
import { detalheDaPendencia, nomeDoCombatente, opcoesDeQuem, opcoesDoMestre, quemResponde, tituloDaPendencia, type Fichas } from './dadosDaBatalhaDBT'
import { RespostasDaPendencia } from './pecasDaBatalhaDBT'

/**
 * A PENDÊNCIA DA VEZ no painel do mestre (seção 1.6, `PendenciaDBT`): a fila
 * é do motor e a ativa é a primeira. Cada tipo ganha o cartão dele (manual,
 * reação, Choque); o resto é título, apoio e as respostas de
 * `opcoesDaPendencia`. O mestre sempre pode responder por qualquer um, e
 * "Descartar" tira uma pendência travada.
 */

export type RespostaDoMestre = Omit<Extract<ComandoDBT, { tipo: 'responder' }>, 'tipo'>

export interface PendenciaDoMestreDBTProps {
  nucleo: NucleoDBT
  fichas: Fichas
  pendencia: Pendencia
  responder: (resposta: RespostaDoMestre) => boolean
  mestre: (acao: AcaoDoMestreDBT) => boolean
  /** Quando esta pendência apareceu (relógio local), para o "espera há". */
  desde: number | null
}

export function PendenciaDoMestreDBT({ nucleo, fichas, pendencia, responder, mestre, desde }: PendenciaDoMestreDBTProps) {
  const descartar = (
    <button type="button" className="dbf-btn dbf-btn--xs dbf-btn--ghost dbf-btn--perigo" onClick={() => mestre({ tipo: 'descartarPendencia', pendenciaId: pendencia.id })}>
      Descartar esta pendência
    </button>
  )

  switch (pendencia.tipo) {
    case 'confirmar':
      return (
        <ConfirmacaoDBT
          key={pendencia.id}
          pendencia={pendencia}
          nucleo={nucleo}
          fichas={fichas}
          opcoes={opcoesDoMestre(nucleo, fichas, pendencia)}
          onConfirmar={(edicoes) => responder({ pendenciaId: pendencia.id, combatenteId: null, opcao: 'confirmar', edicoes })}
          onCancelar={() => responder({ pendenciaId: pendencia.id, combatenteId: null, opcao: 'cancelar' })}
        />
      )
    case 'reacao':
      return <ReacaoNoMestre key={pendencia.id} nucleo={nucleo} fichas={fichas} pendencia={pendencia} responder={responder} desde={desde} rodape={descartar} />
    case 'choque': {
      const { choque } = pendencia
      const tecnicaDe = (id: string, tecnicaId: string) => {
        const c = Object.hasOwn(nucleo.combatentes, id) ? nucleo.combatentes[id] : undefined
        const ficha = c?.personagemId === null || c === undefined ? null : (fichas.get(c.personagemId) ?? null)
        return ficha?.tecnicas.find((tecnica) => tecnica.id === tecnicaId)?.nome ?? tecnicaId
      }
      const apostar = (combatenteId: string) => (aposta: number) => responder({ pendenciaId: pendencia.id, combatenteId, opcao: 'apostar', aposta })
      return (
        <>
          <ChoqueDePoderDBT
            key={pendencia.id}
            atacante={{ nome: nomeDoCombatente(nucleo, choque.atacanteId), tecnica: tecnicaDe(choque.atacanteId, choque.tecnicaAtacante), pontos: choque.placar.atacante, apostou: choque.apostas.atacante !== null, onApostar: apostar(choque.atacanteId) }}
            defensor={{ nome: nomeDoCombatente(nucleo, choque.defensorId), tecnica: tecnicaDe(choque.defensorId, choque.tecnicaDefensor), pontos: choque.placar.defensor, apostou: choque.apostas.defensor !== null, onApostar: apostar(choque.defensorId) }}
            rolagens={choque.rolagens}
          />
          {descartar}
        </>
      )
    }
    case 'declaracao':
      // A fase de iniciativa mostra a declaração na tabela dela.
      return null
    default:
      return <PendenciaSimples key={pendencia.id} nucleo={nucleo} fichas={fichas} pendencia={pendencia} responder={responder} rodape={descartar} />
  }
}

function PendenciaSimples({
  nucleo,
  fichas,
  pendencia,
  responder,
  rodape,
}: {
  nucleo: NucleoDBT
  fichas: Fichas
  pendencia: Pendencia
  responder: (resposta: RespostaDoMestre) => boolean
  rodape: ReactNode
}) {
  const [d20, setD20] = useState('')
  const quem = quemResponde(pendencia)
  const doJogador = quem !== null && Object.hasOwn(nucleo.combatentes, quem) && !nucleo.combatentes[quem].npc
  const detalhe = detalheDaPendencia(nucleo, pendencia)
  const d20Manual = pendencia.tipo === 'salvaguarda' && nucleo.opcoes.modo === 'manual'
  return (
    <section className="dbb-cartao" aria-label={tituloDaPendencia(nucleo, pendencia)}>
      <p className="dbb-cartao__t">{tituloDaPendencia(nucleo, pendencia)}</p>
      {detalhe !== null && <p className="dbb-cartao__d">{detalhe}</p>}
      {doJogador && <p className="dbb-espera">Esperando {nomeDoCombatente(nucleo, quem)} na tela do jogador. Você pode responder por ele.</p>}
      {d20Manual && (
        <label className="dbb-campo">
          d20 rolado à mesa (vazio = o app rola)
          <input className="dbf-inp" type="number" inputMode="numeric" min={1} max={20} value={d20} onChange={(evento) => setD20(evento.target.value)} />
        </label>
      )}
      <RespostasDaPendencia
        opcoes={opcoesDoMestre(nucleo, fichas, pendencia)}
        onResponder={(opcao, extra) => {
          const edicoes: EdicoesDoMestre = {}
          const valor = Number(d20)
          if (d20Manual && d20.trim() !== '' && Number.isFinite(valor)) edicoes.d20 = Math.trunc(valor)
          responder({ pendenciaId: pendencia.id, combatenteId: quem, opcao: opcao.chave, ...extra, ...(edicoes.d20 === undefined ? {} : { edicoes }) })
        }}
      />
      {rodape}
    </section>
  )
}

function ReacaoNoMestre({
  nucleo,
  fichas,
  pendencia,
  responder,
  desde,
  rodape,
}: {
  nucleo: NucleoDBT
  fichas: Fichas
  pendencia: Extract<Pendencia, { tipo: 'reacao' }>
  responder: (resposta: RespostaDoMestre) => boolean
  desde: number | null
  rodape: ReactNode
}) {
  const { janela } = pendencia
  const alvoId = janela.ataque.alvoId
  const [reator, setReator] = useState(alvoId)
  // Quem pode reagir além do alvo: todo combatente de pé, menos o atacante.
  const outros = nucleo.ordem.cartas.filter((id) => id !== janela.ataque.atacanteId && Object.hasOwn(nucleo.combatentes, id) && nucleo.combatentes[id].morte.situacao === 'de-pe')
  const doAlvo = reator === alvoId
  const opcoes = doAlvo ? opcoesDoMestre(nucleo, fichas, pendencia) : opcoesDeQuem(nucleo, fichas, pendencia, reator)
  const alvoJogador = Object.hasOwn(nucleo.combatentes, alvoId) && !nucleo.combatentes[alvoId].npc
  return (
    <>
      {outros.length > 1 && (
        <label className="dbb-campo">
          Reage por
          <select className="dbf-sel" value={reator} onChange={(evento) => setReator(evento.target.value)}>
            {outros.map((id) => (
              <option key={id} value={id}>
                {nomeDoCombatente(nucleo, id)}
                {id === alvoId ? ' (alvo)' : janela.convidados.includes(id) ? ' (na janela)' : ''}
              </option>
            ))}
          </select>
        </label>
      )}
      {doAlvo && alvoJogador && <p className="dbb-espera">Esperando {nomeDoCombatente(nucleo, alvoId)} decidir na tela do jogador. Você pode responder por ele.</p>}
      <CaixaDeReacaoDBT
        golpe={golpeDoAtaque(nucleo, janela.ataque)}
        reator={nomeDoCombatente(nucleo, reator)}
        opcoes={opcoes}
        respostas={respostasDaJanela(nucleo, janela)}
        desde={desde}
        onResponder={(opcao) => responder({ pendenciaId: pendencia.id, combatenteId: doAlvo ? null : reator, opcao: opcao.chave })}
      />
      {rodape}
    </>
  )
}
