import { useCallback, useEffect, useRef, useState } from 'react'
import {
  memoriaDaProcuraDeAnimacoes,
  portaDoPacoteNoApp,
  procurarAnimacoesNovas,
  textoDaProcura,
  type MemoriaDaProcuraDeAnimacoes,
  type PortaDoPacote,
} from '../lib/pacoteDeAnimacoes'
import { useToastStore } from '../stores/toastStore'
import './ProcurarAnimacoes.css'

export type FaseDaProcuraDeAnimacoes = { tipo: 'parado' } | { tipo: 'procurando' } | { tipo: 'resposta'; texto: string }

export interface ProcuraDeAnimacoes {
  /** `false` fora do app instalado: nada de botão. */
  disponivel: boolean
  fase: FaseDaProcuraDeAnimacoes
  procurar: () => Promise<void>
}

/** A procura PEDIDA (um botão): sempre termina numa frase curta para a pessoa. */
export function useProcuraDeAnimacoes(porta: PortaDoPacote = portaDoPacoteNoApp): ProcuraDeAnimacoes {
  const disponivel = porta.disponivel()
  const [fase, setFase] = useState<FaseDaProcuraDeAnimacoes>({ tipo: 'parado' })
  // A procura pode terminar depois que o painel fechou (o mestre clicou fora).
  const montadoRef = useRef(true)
  useEffect(() => {
    montadoRef.current = true
    return () => {
      montadoRef.current = false
    }
  }, [])
  const procurar = useCallback(async () => {
    if (!disponivel) return
    setFase({ tipo: 'procurando' })
    const resultado = await procurarAnimacoesNovas(porta)
    const texto = textoDaProcura(resultado, 'botao')
    if (montadoRef.current) setFase(texto === null ? { tipo: 'parado' } : { tipo: 'resposta', texto })
  }, [disponivel, porta])
  return { disponivel, fase, procurar }
}

/**
 * A procura da ABERTURA do app, uma vez por processo e em silêncio: só
 * animação nova vira aviso ("Animações novas: ..."). Mora na tela inicial,
 * junto da procura do atualizador.
 */
export function useProcuraDeAnimacoesNaAbertura(porta: PortaDoPacote = portaDoPacoteNoApp, memoria: MemoriaDaProcuraDeAnimacoes = memoriaDaProcuraDeAnimacoes): void {
  useEffect(() => {
    if (!porta.disponivel() || memoria.jaProcurou) return
    memoria.jaProcurou = true
    void procurarAnimacoesNovas(porta).then((resultado) => {
      const texto = textoDaProcura(resultado, 'abertura')
      if (texto !== null) useToastStore.getState().push('info', texto)
    })
  }, [porta, memoria])
}

/** A resposta da procura, para quem mostra o botão por conta própria (tela inicial). */
export function textoDaFase(fase: FaseDaProcuraDeAnimacoes): string | null {
  return fase.tipo === 'resposta' ? fase.texto : null
}

/**
 * "Procurar animações novas": o mesmo botão nas três galerias (transição,
 * porta, estilo do cenário) e na biblioteca de texturas, que chegam no mesmo
 * pacote (`rotulo` diz o que se procura). Só no app; a resposta fica ao lado, curta.
 */
export function BotaoProcurarAnimacoes({ porta = portaDoPacoteNoApp, rotulo = 'Procurar animações novas' }: { porta?: PortaDoPacote; rotulo?: string }) {
  const procura = useProcuraDeAnimacoes(porta)
  if (!procura.disponivel) return null
  const procurando = procura.fase.tipo === 'procurando'
  return (
    <div className="lb-procurar-animacoes">
      <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" disabled={procurando} onClick={() => void procura.procurar()}>
        {procurando ? 'Procurando…' : rotulo}
      </button>
      <span className="lb-procurar-animacoes__resposta" role="status">
        {textoDaFase(procura.fase)}
      </span>
    </div>
  )
}
