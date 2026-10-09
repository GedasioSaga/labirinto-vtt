import { useCallback, useEffect, useRef, useState } from 'react'
import {
  decidirDepoisDaProcura,
  MENSAGEM_FALHA_NA_INSTALACAO,
  MENSAGEM_SALA_ABERTA,
  memoriaDaAbertura,
  percentualBaixado,
  portaDoTauri,
  textoEmDia,
  type AtualizacaoAchada,
  type FaseDaAtualizacao,
  type MemoriaDaAbertura,
  type OrigemDaProcura,
  type PortaDoAtualizador,
} from '../lib/atualizacao'
import './AvisoDeAtualizacao.css'

export interface AtualizacaoDoApp {
  /** `false` fora do app instalado: a tela não mostra nada de atualização. */
  disponivel: boolean
  fase: FaseDaAtualizacao
  procurar: (origem: OrigemDaProcura) => Promise<void>
  atualizarAgora: () => Promise<void>
  depois: () => void
}

/**
 * Estado da atualização na tela inicial. A procura da ABERTURA roda uma vez
 * por processo (`memoria.jaProcurou`) e em silêncio; só uma versão nova vira
 * aviso. `porta`/`memoria` existem para o teste trocar o mundo de fora.
 */
export function useAtualizacaoDoApp(
  porta: PortaDoAtualizador = portaDoTauri,
  memoria: MemoriaDaAbertura = memoriaDaAbertura,
): AtualizacaoDoApp {
  const disponivel = porta.disponivel()
  const [fase, setFase] = useState<FaseDaAtualizacao>({ tipo: 'parado' })
  const achadaRef = useRef<AtualizacaoAchada | null>(null)
  // A procura termina depois que a tela pode ter saído (o mestre clicou numa porta).
  const montadoRef = useRef(true)
  useEffect(() => {
    montadoRef.current = true
    return () => {
      montadoRef.current = false
    }
  }, [])
  const mudar = useCallback((proxima: FaseDaAtualizacao) => {
    if (montadoRef.current) setFase(proxima)
  }, [])

  const procurar = useCallback(
    async (origem: OrigemDaProcura) => {
      if (!disponivel) return
      if (origem === 'botao') mudar({ tipo: 'procurando' })
      let achada: AtualizacaoAchada | null = null
      let falhou = false
      let salaAberta = false
      let versaoAtual: string | null = null
      try {
        ;[salaAberta, achada] = await Promise.all([porta.salaAberta(), porta.procurar()])
        if (achada === null && origem === 'botao') versaoAtual = await porta.versaoAtual().catch(() => null)
      } catch (erro) {
        // Sem internet ou release sem `latest.json`: na abertura, só o console sabe.
        console.warn('atualização: a procura falhou', erro)
        falhou = true
      }
      achadaRef.current = achada
      mudar(
        decidirDepoisDaProcura({
          origem,
          salaAberta,
          adiadaNestaAbertura: memoria.adiada,
          achada: achada && { versao: achada.versao, notas: achada.notas },
          versaoAtual,
          falhou,
        }),
      )
    },
    [disponivel, porta, memoria, mudar],
  )

  useEffect(() => {
    if (!disponivel || memoria.jaProcurou) return
    memoria.jaProcurou = true
    void procurar('abertura')
  }, [disponivel, memoria, procurar])

  const atualizarAgora = useCallback(async () => {
    const achada = achadaRef.current
    if (achada === null || fase.tipo !== 'disponivel') return
    const { versao, notas } = fase
    // A sala pode ter aberto entre o aviso e o clique: confere de novo.
    if (await porta.salaAberta()) {
      mudar({ tipo: 'aviso', mensagem: MENSAGEM_SALA_ABERTA })
      return
    }
    mudar({ tipo: 'baixando', versao, notas, percentual: null })
    try {
      await achada.instalar((baixado, total) => {
        mudar({ tipo: 'baixando', versao, notas, percentual: percentualBaixado(baixado, total) })
      })
      // No Windows o instalador já fechou o app antes de chegar aqui.
      mudar({ tipo: 'reiniciando', versao })
      await porta.reiniciar()
    } catch (erro) {
      console.warn('atualização: a instalação falhou', erro)
      mudar({ tipo: 'aviso', mensagem: MENSAGEM_FALHA_NA_INSTALACAO })
    }
  }, [fase, porta, mudar])

  const depois = useCallback(() => {
    memoria.adiada = true
    mudar({ tipo: 'parado' })
  }, [memoria, mudar])

  return { disponivel, fase, procurar, atualizarAgora, depois }
}

/**
 * O aviso "Versão X pronta". Painel na própria tela, como a oferta de
 * recuperação, e não modal: o menu continua clicável e o mestre decide.
 */
export function AvisoDeAtualizacao({ atualizacao }: { atualizacao: AtualizacaoDoApp }) {
  const { fase } = atualizacao
  if (fase.tipo !== 'disponivel' && fase.tipo !== 'baixando' && fase.tipo !== 'reiniciando') return null
  const baixando = fase.tipo === 'baixando'
  return (
    <section className="lb-recovery lb-home__recovery lb-atualizacao" aria-labelledby="lb-atualizacao-titulo">
      <div className="lb-recovery__body">
        <h2 id="lb-atualizacao-titulo" className="lb-recovery__title">
          Versão {fase.versao} pronta
        </h2>
        {fase.tipo !== 'reiniciando' && fase.notas && <p className="lb-recovery__text lb-atualizacao__notas">{fase.notas}</p>}
        {baixando && (
          <div className="lb-atualizacao__progresso" role="status">
            <progress
              className="lb-atualizacao__barra"
              max={100}
              value={fase.percentual ?? undefined}
              aria-label="Baixando a atualização"
            />
            <span className="lb-recovery__text">{fase.percentual === null ? 'Baixando…' : `Baixando… ${fase.percentual}%`}</span>
          </div>
        )}
        {fase.tipo === 'reiniciando' && (
          <p className="lb-recovery__text" role="status">
            Instalando. O app vai reiniciar.
          </p>
        )}
      </div>
      {fase.tipo === 'disponivel' && (
        <div className="lb-recovery__actions">
          <button type="button" className="lb-btn lb-btn--primary" onClick={() => void atualizacao.atualizarAgora()}>
            Atualizar agora
          </button>
          <button type="button" className="lb-btn lb-btn--ghost" onClick={atualizacao.depois}>
            Depois
          </button>
        </div>
      )}
    </section>
  )
}

/** "Procurar atualizações" + a resposta curta quando não há aviso a mostrar. */
export function BotaoProcurarAtualizacao({ atualizacao }: { atualizacao: AtualizacaoDoApp }) {
  if (!atualizacao.disponivel) return null
  const { fase } = atualizacao
  const ocupado = fase.tipo === 'procurando' || fase.tipo === 'baixando' || fase.tipo === 'reiniciando'
  const resposta = fase.tipo === 'em-dia' ? textoEmDia(fase.versaoAtual) : fase.tipo === 'aviso' ? fase.mensagem : null
  return (
    <div className="lb-atualizacao__procurar">
      <button
        type="button"
        className="lb-btn lb-btn--ghost lb-btn--compact"
        disabled={ocupado}
        onClick={() => void atualizacao.procurar('botao')}
      >
        {fase.tipo === 'procurando' ? 'Procurando…' : 'Procurar atualizações'}
      </button>
      <span className="lb-atualizacao__resposta" role="status">
        {resposta}
      </span>
    </div>
  )
}
