import { useEffect, useRef } from 'react'
import type { DancaDesfechoMessage, DancaPlacarAoVivo, DancaStatus } from '../../../net/protocoloDaDanca'
import type { ResultadoDaDanca } from '../partida'
import type { Julgamento } from '../regras'
import type { DificuldadeDanca, LetraDanca } from '../tipos'
import { fmtInt, fmtPct, listaDeNomes, textoDoDesfecho, textoDoStatus, tituloDoResultado } from './textos'

const CONTAS: readonly { j: Julgamento; nome: string; cor: string }[] = [
  { j: 'perfeito', nome: 'Perfeito', cor: 'var(--dz-perfeito)' },
  { j: 'bom', nome: 'Bom', cor: 'var(--dz-bom)' },
  { j: 'ok', nome: 'Ok', cor: 'var(--dz-ok)' },
  { j: 'errou', nome: 'Errou', cor: 'var(--dz-errou)' },
]

interface ResultadoProps {
  resultado: ResultadoDaDanca | null
  dif: DificuldadeDanca
  notaMin: LetraDanca
  desfecho: Omit<DancaDesfechoMessage, 'type' | 'sessao'> | undefined
  euId: string | undefined
  /** Quem dançou (o "começar"), na ordem do mestre. */
  participantes: readonly { playerId: string; nome: string }[]
  status: Readonly<Record<string, DancaStatus>>
  placares: Readonly<Record<string, DancaPlacarAoVivo>>
  aoFechar: () => void
}

/**
 * RESULTADO: a nota, os números e as contagens deste aparelho aparecem assim
 * que a música acaba; o bloco do desfecho e a mesa esperam o mestre ("Esperando
 * os outros terminarem…") e se completam quando o desfecho chega, sem trocar
 * de tela.
 */
export function Resultado({ resultado, dif, notaMin, desfecho, euId, participantes, status, placares, aoFechar }: ResultadoProps) {
  const tituloRef = useRef<HTMLHeadingElement>(null)
  const minhaLinha = desfecho?.mesa.find((l) => l.playerId === euId)
  const motivo = resultado?.motivo ?? (minhaLinha?.letra === 'Falhou' ? 'falhou' : 'fim')
  const falhou = motivo === 'falhou'
  const passou = desfecho !== undefined ? desfecho.seu.passou : (resultado?.passou ?? false)
  const letra = falhou ? 'Falhou' : (resultado?.letra ?? (minhaLinha !== undefined && minhaLinha.letra !== 'Saiu' ? minhaLinha.letra : '—'))
  const precisao = resultado?.precisao ?? minhaLinha?.precisao ?? 0
  const titulo = tituloDoResultado(motivo, desfecho)
  const contagem = resultado?.contagem
  const total = contagem === undefined ? 1 : Math.max(1, contagem.perfeito + contagem.bom + contagem.ok + contagem.errou)
  const desfechoTexto = desfecho !== undefined ? textoDoDesfecho(desfecho) : null
  const aindaDancando = participantes.filter((p) => p.playerId !== euId && status[p.playerId] === 'dancando').map((p) => p.nome)

  useEffect(() => {
    tituloRef.current?.focus({ preventScroll: true })
  }, [])

  return (
    <div className="dz-tela">
      <div className="dz-res-topo">
        <div className="dz-letra" data-estado={falhou ? 'falhou' : passou ? 'passou' : 'nao'}>
          {letra}
        </div>
        <div>
          <h2 ref={tituloRef} tabIndex={-1}>
            {titulo}
          </h2>
          <p className="dz-nota">Precisava de {notaMin} ou melhor.</p>
        </div>
      </div>
      <dl className="dz-numeros">
        <div>
          <dt>Precisão</dt>
          <dd>{fmtPct(precisao)}</dd>
        </div>
        <div>
          <dt>Combo máximo</dt>
          <dd>{resultado !== null ? resultado.comboMax : '—'}</dd>
        </div>
        <div>
          <dt>Pontos</dt>
          <dd>{resultado !== null ? fmtInt(resultado.pontos) : '—'}</dd>
        </div>
      </dl>
      {contagem !== undefined && (
        <ul className="dz-contas">
          {CONTAS.map(({ j, nome, cor }) => (
            <li key={j}>
              <span style={{ color: cor }}>{nome}</span>
              <i>
                <i style={{ background: cor, transform: `scaleX(${contagem[j] / total})` }} />
              </i>
              <b>{contagem[j]}</b>
            </li>
          ))}
          {dif === 'expert' && resultado !== null && (
            <li data-seg>
              <span>Seguradas</span>
              <span />
              <b>
                {resultado.seguradas.inteiras} de {resultado.seguradas.total}
              </b>
            </li>
          )}
        </ul>
      )}
      <p className="dz-desfecho" data-tom={desfechoTexto?.tom ?? 'espera'} role="status">
        {desfechoTexto !== null
          ? desfechoTexto.texto
          : aindaDancando.length > 0
            ? `Esperando os outros terminarem… ${listaDeNomes(aindaDancando)} ${aindaDancando.length === 1 ? 'ainda dança' : 'ainda dançam'}.`
            : 'Esperando os outros terminarem…'}
      </p>
      <div>
        <p className="dz-rotulo" style={{ marginBottom: 6 }}>
          Na mesa
        </p>
        <ol className="dz-mesa">
          {desfecho !== undefined
            ? desfecho.mesa.map((l) => (
                <li key={l.playerId}>
                  <span>{l.playerId === euId ? 'Você' : l.nome}</span>
                  <span className="dz-mesa__letra">{l.letra}</span>
                  <span className="dz-mesa__num">{fmtPct(l.precisao)}</span>
                </li>
              ))
            : participantes.map((p) => {
                const eu = p.playerId === euId
                const placar = placares[p.playerId]
                const st = status[p.playerId]
                return (
                  <li key={p.playerId}>
                    <span>{eu ? 'Você' : p.nome}</span>
                    {eu ? (
                      <span className="dz-mesa__letra">{letra}</span>
                    ) : (
                      <span className="dz-mesa__letra" data-estado="espera">
                        {st !== undefined ? textoDoStatus(st) : 'dançando'}
                      </span>
                    )}
                    <span className="dz-mesa__num">{eu ? fmtPct(precisao) : placar !== undefined && placar.julgadas > 0 ? fmtPct(placar.precisao) : '—'}</span>
                  </li>
                )
              })}
        </ol>
      </div>
      <button type="button" className="dz-btn dz-btn--primario dz-btn--bloco" onClick={aoFechar}>
        Voltar ao mapa
      </button>
    </div>
  )
}
