import { useEffect, useMemo, useRef, useState } from 'react'
import { LUTAS_DA_SERIE, type ResultadoDaSerie } from '../../../lib/treino/cemLutas'
import { rodarSerieNoWorker, type LutasNoWorker } from '../../../lib/treino/lutasNoWorker'
import { sementeNova } from '../../../lib/treino/sorteio'
import { useSistemaDoLobby } from '../contexto'
import { Icone } from '../Icone'
import { assentarAnimacao } from './ArenaDaLuta'
import { assinaturaDaMontagem, lutadoresDaMontagem, problemaDaMontagem, quemLutou, type MontagemDaLuta } from './lutaDeTreino'
import { contar } from './textosDoTreino'

/**
 * AS 100 LUTAS (fatia T7, sobre o worker da T4): o robô joga os dois lados
 * 100 vezes, cada luta com uma semente tirada da semente da série, num Web
 * Worker (a página não trava). A barra mostra quantas já acabaram; "Cancelar"
 * fecha o worker na hora. No fim: vitórias, derrotas, empates e a duração média.
 */

export interface Progresso {
  feitas: number
  total: number
}

/** A barra de progresso das lutas (role progressbar, com o número escrito ao lado). */
export function BarraDasLutas({ progresso, rotulo }: { progresso: Progresso; rotulo: string }) {
  const parte = progresso.total > 0 ? progresso.feitas / progresso.total : 0
  return (
    <div className="lo-tr-progresso">
      <div className="lo-tr-progresso__barra" role="progressbar" aria-label={rotulo} aria-valuemin={0} aria-valuemax={progresso.total} aria-valuenow={progresso.feitas}>
        <span style={{ transform: `scaleX(${parte.toFixed(3)})` }} />
      </div>
      <span className="lo-tr-progresso__conta">
        {progresso.feitas} de {progresso.total}
      </span>
    </div>
  )
}

/** Os quatro números de uma série. */
export function NumerosDaSerie({ resultado, titulo }: { resultado: ResultadoDaSerie; titulo?: string }) {
  const empates = resultado.empates.todosCaidos + resultado.empates.tempo
  const total = resultado.lutas.length
  const media = total === 0 ? 0 : resultado.lutas.reduce((soma, luta) => soma + luta.rodada, 0) / total
  return (
    <div className="lo-tr-numeros-bloco">
      {titulo !== undefined && <h4 className="lo-tr-numeros__titulo">{titulo}</h4>}
      <dl className="lo-tr-numeros">
        <div className="lo-tr-numero" data-tom="vitoria">
          <dt>Vitórias</dt>
          <dd>{resultado.vitorias.a}</dd>
        </div>
        <div className="lo-tr-numero" data-tom="derrota">
          <dt>Derrotas</dt>
          <dd>{resultado.vitorias.b}</dd>
        </div>
        <div className="lo-tr-numero">
          <dt>Empates</dt>
          <dd>{empates}</dd>
        </div>
        <div className="lo-tr-numero">
          <dt>Duração média</dt>
          <dd>
            {media.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} <small>{media === 1 ? 'rodada' : 'rodadas'}</small>
          </dd>
        </div>
      </dl>
    </div>
  )
}

/**
 * O resultado guardado é de uma montagem que já mudou: o aviso diz com quem
 * foi e pede para rodar de novo. Os números ficam, apagados (CSS
 * `data-velho`), para a pessoa ainda comparar de olho.
 */
export function AvisoDeMontagemVelha({ quem, oQue, refazer }: { quem: string; oQue: string; refazer: string }) {
  return (
    <div className="lo-linha-aviso" data-tom="mare">
      <Icone nome="alerta" />
      <p>
        {oQue} com a montagem de antes: <b>{quem}</b>. {refazer}
      </p>
    </div>
  )
}

interface ResultadoDasLutas {
  serie: ResultadoDaSerie
  ms: number
  /** A montagem com que as lutas rodaram (`assinaturaDaMontagem`) e quem lutou, em texto. */
  assinatura: string
  quem: string
}

export function CemLutas({ montagem }: { montagem: MontagemDaLuta }) {
  const sistema = useSistemaDoLobby()
  const [semente, setSemente] = useState(() => sementeNova())
  const [progresso, setProgresso] = useState<Progresso | null>(null)
  const [resultado, setResultado] = useState<ResultadoDasLutas | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const emCurso = useRef<LutasNoWorker<ResultadoDaSerie> | null>(null)
  const problema = problemaDaMontagem(montagem)
  // A montagem é um objeto novo a cada render da tela de cima; o texto só é refeito quando ela muda.
  const assinatura = useMemo(() => assinaturaDaMontagem(montagem), [montagem])

  // Sair da tela no meio: o worker fecha (as lutas são um laço síncrono lá dentro; fechar é o único jeito de parar).
  useEffect(() => () => emCurso.current?.cancelar(), [])

  function rodar(comSemente: number) {
    const montada = lutadoresDaMontagem(montagem)
    if (!montada.ok) {
      setErro('Não deu para montar a luta com essas fichas.')
      return
    }
    emCurso.current?.cancelar()
    setSemente(comSemente)
    setErro(null)
    setResultado(null)
    setProgresso({ feitas: 0, total: LUTAS_DA_SERIE })
    // Tirada agora: se a montagem mudar com as lutas rodando, o resultado chega dizendo com qual foi.
    const daCorrida = { assinatura, quem: quemLutou(montagem) }
    const corrida = rodarSerieNoWorker({ sistema, lutadores: montada.lutadores, semente: comSemente }, (feitas, total) => setProgresso({ feitas, total }))
    emCurso.current = corrida
    corrida.saida
      .then((saida) => {
        if (emCurso.current !== corrida) return
        emCurso.current = null
        setProgresso(null)
        if (saida.ok) setResultado({ serie: saida.valor, ms: saida.ms, ...daCorrida })
        else if (saida.motivo === 'falhou') setErro(`As lutas pararam com erro: ${saida.detalhe}`)
      })
      .catch((falha: unknown) => {
        if (emCurso.current !== corrida) return
        emCurso.current = null
        setProgresso(null)
        setErro(`As lutas pararam com erro: ${falha instanceof Error ? falha.message : String(falha)}`)
      })
  }

  return (
    <div className="lo-tr-cem">
      <p className="lo-tr-explica">
        O robô joga os dois lados {LUTAS_DA_SERIE} vezes, com o mesmo golpe mais forte no alvo mais ferido e a melhor defesa. Bom para ver se a luta é justa antes de encarar.
      </p>
      <div className="lo-tr-semente" role="group" aria-label="Semente das 100 lutas">
        <p className="lo-tr-semente__texto">
          Semente <span className="lo-tr-semente__numero">{semente}</span>
        </p>
        <div className="lo-tr-semente__botoes">
          {progresso === null ? (
            <button type="button" className="lo-btn lo-btn--primario" disabled={problema !== null} onClick={() => rodar(semente)}>
              Rodar {LUTAS_DA_SERIE} lutas
            </button>
          ) : (
            <button
              type="button"
              className="lo-btn"
              onClick={() => {
                emCurso.current?.cancelar()
                emCurso.current = null
                setProgresso(null)
              }}
            >
              Cancelar
            </button>
          )}
          <button type="button" className="lo-btn" disabled={problema !== null || progresso !== null} onClick={() => rodar(sementeNova())}>
            Nova semente
          </button>
        </div>
      </div>
      {problema !== null && <p className="lo-motivo">{problema}</p>}
      {progresso !== null && <BarraDasLutas progresso={progresso} rotulo="Lutas feitas" />}
      {erro !== null && (
        <p className="lo-linha-aviso" role="alert">
          {erro}
        </p>
      )}
      {resultado !== null && (
        <div className="lo-tr-resultado" role="status" data-velho={resultado.assinatura !== assinatura ? '1' : undefined} onAnimationEnd={assentarAnimacao}>
          {resultado.assinatura !== assinatura && <AvisoDeMontagemVelha quem={resultado.quem} oQue="Estas lutas foram" refazer={`Rode as ${LUTAS_DA_SERIE} lutas de novo para ver a de agora.`} />}
          <NumerosDaSerie resultado={resultado.serie} />
          <p className="lo-motivo">
            {contar(resultado.serie.lutas.length, 'luta', 'lutas')} de {resultado.quem}, em {(resultado.ms / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} s, semente {resultado.serie.semente}.
          </p>
        </div>
      )}
    </div>
  )
}
