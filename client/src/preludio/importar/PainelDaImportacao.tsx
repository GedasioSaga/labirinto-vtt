import { isTauri } from '@tauri-apps/api/core'
import { useEffect, useId, useRef, useState } from 'react'
import { aplicarImportacao, RecusaDaImportacao, type FaseDaAplicacao, type ResumoDaAplicacao } from '../../lib/preparo/importar/aplicar'
import { espacoLivreNoDisco, escolherPastaDoCofre, leitorDoCofreNoApp } from '../../lib/preparo/importar/noApp'
import { lerPreludio } from '../../lib/preparo/importar/noPreludio'
import { simularImportacao } from '../../lib/preparo/importar/simular'
import type { IndiceDoPreparo } from '../../lib/preparo/tipos'
import { contaDoGoogle } from '../copia/ponteDaCopia'
import { RelatorioDaImportacao, type SessaoDaImportacao } from './RelatorioDaImportacao'
import { textoDaFase, textoDoAndamento, textoDoResumo } from './textosDaImportacao'
import '../copia/copia.css'
import './importacao.css'

/**
 * IMPORTAR DO GRIMÓRIO, na tela do Prelúdio (docs/planos/preludio-2026-11-08.md
 * §4): escolher o cofre, ler o relatório da simulação, ligar cada campanha a
 * uma pasta do Labirinto e aplicar com o ok do mestre. Depois de aplicar, pede a
 * cópia no Google Drive (se houver login). O cofre só é lido.
 */

/** O que acontece com a cópia no Drive depois de aplicar. */
type CopiaDepois = 'pedida' | 'sem-login' | 'nada-mudou'

type Etapa =
  | { t: 'inicio' }
  | { t: 'lendo'; texto: string; feitos: number; total: number }
  | { t: 'relatorio'; sessao: SessaoDaImportacao; confirmando: boolean }
  | { t: 'aplicando'; texto: string; feitos: number; total: number }
  | { t: 'feito'; resumo: ResumoDaAplicacao; copia: CopiaDepois }

const INTERVALO_DO_ANDAMENTO_MS = 80
const SO_NO_APP = 'A importação do Grimório só funciona no app instalado do Labirinto.'

function motivoDe(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

/** A barra anda no máximo a cada 80 ms (mil imagens não viram mil desenhos da tela); fase nova e o fim sempre aparecem. */
function andamentoLimitado<F>(mostrar: (fase: F, feitos: number, total: number) => void): (fase: F, feitos: number, total: number) => void {
  let ultimo = 0
  let faseAnterior: F | null = null
  return (fase, feitos, total) => {
    const agora = performance.now()
    if (fase === faseAnterior && feitos < total && agora - ultimo < INTERVALO_DO_ANDAMENTO_MS) return
    ultimo = agora
    faseAnterior = fase
    mostrar(fase, feitos, total)
  }
}

/** A pasta que cada campanha do Grimório já tem no Prelúdio (na reimportação, a que o mestre ligou antes). */
function pastasIniciais(indice: IndiceDoPreparo): Map<string, string | null> {
  return new Map(indice.campanhas.filter((campanha) => campanha.origem?.grimorio !== undefined).map((campanha) => [campanha.id, campanha.pastaId ?? null]))
}

export interface PainelDaImportacaoProps {
  /** A importação gravou (no todo ou em parte): a tela relê o Prelúdio. */
  onAplicado: () => void
  /** Há login do Google: a tela pede a cópia no Drive ao painel da cópia. */
  onPedirCopia: () => void
  /** Gravando no Prelúdio: a tela trava a cópia e a saída até terminar. */
  onGravando: (gravando: boolean) => void
}

export function PainelDaImportacao({ onAplicado, onPedirCopia, onGravando }: PainelDaImportacaoProps) {
  const id = useId()
  const [etapa, setEtapa] = useState<Etapa>({ t: 'inicio' })
  const [erro, setErro] = useState<string | null>(null)
  const montado = useRef(true)

  useEffect(() => {
    montado.current = true
    return () => {
      montado.current = false
    }
  }, [])

  const simular = async (raiz: string, copias: string | null) => {
    setErro(null)
    setEtapa({ t: 'lendo', texto: 'Lendo o Prelúdio…', feitos: 0, total: 0 })
    try {
      const leitura = await lerPreludio()
      if (!leitura.ok) throw new Error(`O Prelúdio tem arquivos que esta versão não abre para editar: ${leitura.problemas.join(' ')}`)
      const { foto } = leitura
      const andar = andamentoLimitado<'cofre'>((_fase, feitos, total) => {
        if (montado.current) setEtapa({ t: 'lendo', texto: textoDoAndamento('Lendo o cofre', feitos, total), feitos, total })
      })
      const resultado = await simularImportacao(leitorDoCofreNoApp(raiz), {
        existentes: foto.vazio ? undefined : foto.noPreludio,
        espacoLivreBytes: await espacoLivreNoDisco(),
        copiasDeConflito: copias === null ? undefined : leitorDoCofreNoApp(copias),
        aoAvancar: (feitos, total) => andar('cofre', feitos, total),
      })
      if (!montado.current) return
      setEtapa({ t: 'relatorio', sessao: { raiz, copias, foto, resultado, pastas: pastasIniciais(resultado.plano.indice) }, confirmando: false })
    } catch (falha) {
      if (!montado.current) return
      setEtapa({ t: 'inicio' })
      setErro(`Não deu para simular: ${motivoDe(falha)}`)
    }
  }

  const escolher = async (titulo: string): Promise<string | null> => {
    if (!isTauri()) {
      setErro(SO_NO_APP)
      return null
    }
    try {
      return await escolherPastaDoCofre(titulo)
    } catch (falha) {
      setErro(`Não deu para abrir a escolha da pasta: ${motivoDe(falha)}`)
      return null
    }
  }

  const escolherCofre = async () => {
    const raiz = await escolher('A pasta do cofre do Grimório')
    if (raiz !== null) await simular(raiz, null)
  }

  const compararCopias = async (sessao: SessaoDaImportacao) => {
    const copias = await escolher('A pasta das cópias de conflito do Grimório')
    if (copias !== null) await simular(sessao.raiz, copias)
  }

  const pedirCopia = async (resumo: ResumoDaAplicacao): Promise<CopiaDepois> => {
    if (resumo.mudancas === 0) return 'nada-mudou'
    const conta = await contaDoGoogle()
    if (!conta.ok || conta.valor.email === null) return 'sem-login'
    onPedirCopia()
    return 'pedida'
  }

  const aplicar = async (sessao: SessaoDaImportacao) => {
    setErro(null)
    onGravando(true)
    setEtapa({ t: 'aplicando', texto: textoDaFase('conferindo', 0, 1), feitos: 0, total: 0 })
    const andar = andamentoLimitado<FaseDaAplicacao>((fase, feitos, total) => {
      if (montado.current) setEtapa({ t: 'aplicando', texto: textoDaFase(fase, feitos, total), feitos, total })
    })
    try {
      const resumo = await aplicarImportacao(sessao.resultado, leitorDoCofreNoApp(sessao.raiz), {
        foto: sessao.foto,
        pastas: sessao.pastas,
        espacoLivreBytes: await espacoLivreNoDisco(),
        aoAvancar: andar,
      })
      onAplicado()
      const copia = await pedirCopia(resumo)
      if (montado.current) setEtapa({ t: 'feito', resumo, copia })
    } catch (falha) {
      if (!montado.current) return
      if (falha instanceof RecusaDaImportacao) {
        setEtapa({ t: 'relatorio', sessao, confirmando: false })
        setErro(falha.message)
      } else {
        onAplicado()
        setEtapa({ t: 'inicio' })
        setErro(`A importação parou no meio: ${motivoDe(falha)}. O que já foi gravado fica no Prelúdio; simule e aplique de novo para completar.`)
      }
    } finally {
      onGravando(false)
    }
  }

  const titulo = `${id}-t`
  const trabalhando = etapa.t === 'lendo' || etapa.t === 'aplicando'
  return (
    <section className="pl-copia pl-imp" aria-labelledby={titulo} aria-busy={trabalhando}>
      <div className="pl-copia__cab">
        <h2 className="pl-copia__t" id={titulo}>
          Importar do Grimório
        </h2>
      </div>

      {etapa.t === 'inicio' && (
        <>
          <p className="pl-copia__dica">
            Escolha a pasta do cofre do Grimório. Primeiro vem um relatório do que entraria; o Prelúdio só muda quando você aplicar. O cofre só é lido, nunca gravado.
          </p>
          <div className="pl-copia__linha">
            <button type="button" className="lb-btn lb-btn--primary" onClick={() => void escolherCofre()}>
              Escolher a pasta do Grimório…
            </button>
          </div>
        </>
      )}

      {(etapa.t === 'lendo' || etapa.t === 'aplicando') && (
        <div className="pl-copia__andar" role="status">
          {etapa.total > 0 && <progress className="pl-copia__barra" value={etapa.feitos} max={etapa.total} aria-label="Andamento" />}
          <p className="pl-copia__dica">{etapa.texto}</p>
          {etapa.t === 'aplicando' && <p className="pl-copia__dica">Gravando no Prelúdio: fique nesta tela até terminar.</p>}
        </div>
      )}

      {etapa.t === 'relatorio' && (
        <RelatorioDaImportacao
          sessao={etapa.sessao}
          confirmando={etapa.confirmando}
          onPasta={(campanhaId, pastaId) => {
            const pastas = new Map(etapa.sessao.pastas)
            pastas.set(campanhaId, pastaId)
            setEtapa({ ...etapa, sessao: { ...etapa.sessao, pastas } })
          }}
          onCompararCopias={() => void compararCopias(etapa.sessao)}
          onConfirmar={(confirmando) => setEtapa({ ...etapa, confirmando })}
          onAplicar={() => void aplicar(etapa.sessao)}
          onFechar={() => {
            setErro(null)
            setEtapa({ t: 'inicio' })
          }}
        />
      )}

      {etapa.t === 'feito' && <Feito resumo={etapa.resumo} copia={etapa.copia} onFechar={() => setEtapa({ t: 'inicio' })} />}

      {erro !== null && (
        <p className="lb-field__error" role="alert">
          {erro}
        </p>
      )}
    </section>
  )
}

const FRASE_DA_COPIA: Readonly<Record<CopiaDepois, string>> = {
  pedida: 'A cópia no Google Drive começou: acompanhe no quadro de baixo.',
  'sem-login': 'Sem login do Google neste PC: a cópia no Drive fica para quando você entrar.',
  'nada-mudou': '',
}

function Feito({ resumo, copia, onFechar }: { resumo: ResumoDaAplicacao; copia: CopiaDepois; onFechar: () => void }) {
  const texto = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    texto.current?.focus()
  }, [])
  return (
    <div className="pl-copia__recado">
      <p className="pl-copia__ok" ref={texto} tabIndex={-1} role="status">
        {textoDoResumo(resumo)}
      </p>
      {resumo.pasta !== null && <p className="pl-copia__dica">O relatório e os originais ficaram em preparo/{resumo.pasta}.</p>}
      {copia !== 'nada-mudou' && <p className="pl-copia__dica">{FRASE_DA_COPIA[copia]}</p>}
      {resumo.preservados.length > 0 && (
        <details className="pl-imp__det">
          <summary>Ficaram como estavam, porque mudaram no Prelúdio ({resumo.preservados.length})</summary>
          <ul className="pl-copia__avisos">
            {resumo.preservados.map((item) => (
              <li key={item.id}>{item.titulo}</li>
            ))}
          </ul>
        </details>
      )}
      {resumo.avisos.length > 0 && (
        <ul className="pl-copia__avisos">
          {resumo.avisos.map((aviso) => (
            <li key={aviso}>{aviso}</li>
          ))}
        </ul>
      )}
      <div className="pl-copia__linha">
        <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={onFechar}>
          Fechar
        </button>
      </div>
    </div>
  )
}
