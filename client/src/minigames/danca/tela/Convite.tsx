import { useEffect, useId, useRef } from 'react'
import type { DancaStatus } from '../../../net/protocoloDaDanca'
import type { DancaDoJogador } from '../../../player/estadoDaDanca'
import { DIF } from '../regras'
import { DIFICULDADES_DANCA, type DificuldadeDanca } from '../tipos'
import type { EstadoDaMusica } from './musicaImportada'
import { Retrato } from './Palco'
import type { PreferenciasDaDanca } from './preferencias'
import { fmtMs, notaSobreColegas, textoDaMusica, textoDoPremio, textoDoStatus } from './textos'

const DESCRICAO: Readonly<Record<DificuldadeDanca, string>> = {
  diversao: 'Setas só na batida, janela larga e ninguém cai no meio da música.',
  expert: 'Mais setas, saltos e setas para segurar. A vida pode acabar.',
}

interface ConviteProps {
  danca: DancaDoJogador
  euId: string | undefined
  dif: DificuldadeDanca
  aoMudarDif: (dif: DificuldadeDanca) => void
  prefs: PreferenciasDaDanca
  aoMudarPrefs: (prefs: PreferenciasDaDanca) => void
  /** Só para música importada; `null` na demo (sintetizada aqui, sempre pronta). */
  musica: EstadoDaMusica | null
  aoBaixarDeNovo: () => void
  somCalado: boolean
  aoLigarSom: () => void
  erro: string | null
  controle: string | null
  aoPronto: () => void
  aoAjustarAtraso: () => void
}

/**
 * CONVITE: a desafiante, a fala, a escolha do ritmo, o que está em jogo e o
 * "Estou pronto". Depois do Pronto, o botão vira a espera pelo mestre, com
 * quem já está pronto; trocar o ritmo ainda vale (o Pronto sai de novo).
 */
export function Convite({ danca, euId, dif, aoMudarDif, prefs, aoMudarPrefs, musica, aoBaixarDeNovo, somCalado, aoLigarSom, erro, controle, aoPronto, aoAjustarAtraso }: ConviteProps) {
  const { convite } = danca
  const so = convite.permitida === 'escolha' ? null : convite.permitida
  const idTeclas = useId()
  const prontoRef = useRef<HTMLButtonElement>(null)
  const musicaPronta = musica === null || musica.fase === 'pronta'
  const pronto = danca.pronto !== undefined
  const outros = convite.participantes.filter((p) => p.playerId !== euId)

  const esperaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Entrou na tela: o foco vai para a ação principal (o Pronto), como o "Pular" da transição.
    prontoRef.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    // O botão some no Pronto: o foco vai para a espera, e não para o fim da página.
    if (pronto) esperaRef.current?.focus({ preventScroll: true })
  }, [pronto])

  const statusDe = (playerId: string): DancaStatus => {
    const doMestre = danca.estado?.participantes.find((p) => p.playerId === playerId)?.status
    if (doMestre !== undefined) return doMestre
    return playerId === euId && pronto ? 'pronto' : 'convidado'
  }

  return (
    <div className="dz-tela">
      <div className="dz-npc">
        <Retrato />
        <div>
          <h1>{convite.npc || 'Desafiante'}</h1>
          <p>desafia você para uma dança</p>
        </div>
      </div>
      <p className="dz-fala">{convite.fala}</p>

      <fieldset className="dz-cartoes">
        <legend className="dz-rotulo">Escolha o ritmo</legend>
        {DIFICULDADES_DANCA.map((d) => {
          const travado = so !== null && so !== d
          return (
            <label key={d} className="dz-cartao" data-travado={travado ? '1' : '0'}>
              <input type="radio" name={`dz-dif-${danca.sessao}`} value={d} checked={dif === d} disabled={travado} onChange={() => aoMudarDif(d)} />
              <b>{DIF[d].nome}</b>
              <span>{DESCRICAO[d]}</span>
            </label>
          )
        })}
        {so !== null && <p className="dz-trava">O mestre deixou só a {DIF[so].nome}.</p>}
      </fieldset>

      <dl className="dz-fatos">
        <dt>Para vencer</dt>
        <dd>
          Todos com nota {convite.notaMin} ou melhor
        </dd>
        <dt>Prêmio</dt>
        <dd>{textoDoPremio(convite.premio)}</dd>
        <dt>Música</dt>
        <dd>
          {textoDaMusica(convite.musica)}
          {musica !== null && musica.fase === 'baixando' && (
            <>
              <span className="dz-nota" role="status">
                {' '}
                Baixando{musica.fracao !== null ? ` ${Math.round(musica.fracao * 100)}%` : '…'}
              </span>
              <span className="dz-progresso" aria-hidden="true">
                <i style={{ transform: `scaleX(${musica.fracao ?? 0})` }} />
              </span>
            </>
          )}
          {musica !== null && musica.fase === 'decodificando' && (
            <span className="dz-nota" role="status">
              {' '}
              Preparando…
            </span>
          )}
        </dd>
      </dl>

      {musica !== null && musica.fase === 'erro' && (
        <div className="dz-aviso" role="alert">
          <p>{musica.mensagem}</p>
          <button type="button" className="dz-btn dz-btn--pequeno" onClick={aoBaixarDeNovo}>
            Tentar de novo
          </button>
        </div>
      )}
      {somCalado && (
        <div className="dz-aviso" role="status">
          <p>O som da mesa está desligado. A dança precisa da música para você acertar o tempo.</p>
          <button type="button" className="dz-btn dz-btn--pequeno" onClick={aoLigarSom}>
            Ligar o som
          </button>
        </div>
      )}
      {erro !== null && (
        <p className="dz-aviso" role="alert">
          {erro}
        </p>
      )}

      {pronto ? (
        <div ref={esperaRef} className="dz-espera" role="status" tabIndex={-1}>
          <h2>Esperando o mestre começar</h2>
          <ul>
            {convite.participantes.map((p) => {
              const status = statusDe(p.playerId)
              return (
                <li key={p.playerId} data-pronto={status === 'pronto' ? '1' : '0'}>
                  <span>{p.playerId === euId ? 'Você' : p.nome}</span>
                  <span>{textoDoStatus(status)}</span>
                </li>
              )
            })}
          </ul>
          {so === null && <p className="dz-nota">Ainda dá para trocar o ritmo: o mestre recebe a troca.</p>}
        </div>
      ) : (
        <button ref={prontoRef} type="button" className="dz-btn dz-btn--primario dz-btn--bloco" disabled={!musicaPronta} onClick={aoPronto}>
          {musicaPronta ? 'Estou pronto' : 'Esperando a música baixar'}
        </button>
      )}

      <div className="dz-ajustes">
        <button type="button" className="dz-btn dz-btn--fantasma dz-btn--pequeno" onClick={aoAjustarAtraso}>
          Ajustar atraso <kbd>{fmtMs(prefs.ajusteMs)}</kbd>
        </button>
        <button
          type="button"
          className="dz-alternar"
          role="switch"
          aria-checked={prefs.somAcerto}
          onClick={() => aoMudarPrefs({ ...prefs, somAcerto: !prefs.somAcerto })}
        >
          Som do acerto: <span>{prefs.somAcerto ? 'ligado' : 'desligado'}</span>
        </button>
      </div>
      <div className="dz-ajuste">
        <span className="dz-rotulo" id={idTeclas}>
          Teclas
        </span>
        <div className="dz-seg" role="group" aria-labelledby={idTeclas}>
          <button type="button" aria-pressed={prefs.teclas === 'setas'} onClick={() => aoMudarPrefs({ ...prefs, teclas: 'setas' })}>
            Setas e WASD
          </button>
          <button type="button" aria-pressed={prefs.teclas === 'dfjk'} onClick={() => aoMudarPrefs({ ...prefs, teclas: 'dfjk' })}>
            Setas e DFJK
          </button>
        </div>
      </div>
      {controle !== null && <p className="dz-controle">Controle conectado: {controle}</p>}
      <p className="dz-nota">{notaSobreColegas(outros.map((p) => p.nome))}</p>
    </div>
  )
}
