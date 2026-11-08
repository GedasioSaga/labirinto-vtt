import { useEffect, useSyncExternalStore, type ReactNode } from 'react'
import {
  NOME_DO_JOGO_DO_PACOTE,
  faseDoPacote,
  ouvirPacote,
  portaDoPacoteDeMinigamesNoApp,
  prepararMinigame,
  type JogoDoPacote,
  type MotivoDaFalha,
  type PortaDoPacoteDeMinigames,
} from '../minigames/pacoteDeMinigames'
import './PacoteDoMinigame.css'

/**
 * O JOGO BAIXADO NA PRIMEIRA VEZ, no painel do pino: enquanto o pacote não
 * está no computador do mestre, mostra o download (com a barra) ou o porquê
 * de não ter dado, e esconde o que chama os jogadores; com o jogo pronto, só
 * mostra o painel. Procurando ou baixando versão nova, o painel fica à vista
 * e travado (um `fieldset disabled`, sem desmontar: o que estava nele fica).
 * Quem baixa e confere é `minigames/pacoteDeMinigames.ts`.
 */

export interface PacoteDoMinigameProps {
  jogo: JogoDoPacote
  /** Há partida aberta: não procura versão nova agora (ver `prepararMinigame`). */
  ocupado: boolean
  /** O painel que só vale com o jogo no computador (chamar, começar). */
  children: ReactNode
  porta?: PortaDoPacoteDeMinigames
  /**
   * Em dev o Vite serve o jogo (`FOGO_WEB_DIR`): sem o pacote, o painel
   * continua; no app instalado, sem o pacote os jogadores dariam com 404.
   */
  dispensarSemPacote?: boolean
}

const BYTES_POR_MB = 1024 * 1024

function megas(bytes: number): string {
  return (bytes / BYTES_POR_MB).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

interface BarraDoDownloadProps {
  titulo: string
  nome: string
  baixado: number
  /** Nulo = ainda sem resposta do GitHub: a barra fica indeterminada. */
  total: number | null
}

function BarraDoDownload({ titulo, nome, baixado, total }: BarraDoDownloadProps) {
  return (
    <div className="lb-pacote-jogo">
      <span className="lb-pacote-jogo__titulo" role="status">
        {titulo}
      </span>
      <progress className="lb-pacote-jogo__barra" max={total ?? undefined} value={total === null ? undefined : baixado} aria-label={`Download do ${nome}`} />
      <span className="lb-pacote-jogo__conta">{total === null ? 'Começando…' : `${megas(baixado)} de ${megas(total)} MB`}</span>
    </div>
  )
}

function textoDaFalha(motivo: MotivoDaFalha, nome: string): string {
  switch (motivo) {
    case 'sem_internet':
      return `Sem internet para baixar o ${nome}. Só a primeira vez precisa de internet.`
    case 'invalido':
      return `O ${nome} baixado não passou na conferência de segurança e foi apagado.`
    case 'app_velho':
      return `Esta versão do ${nome} pede o app novo. Atualize o app para jogar.`
    case 'disco':
      return `Não deu para guardar o ${nome} neste computador.`
  }
}

export function PacoteDoMinigame({ jogo, ocupado, children, porta = portaDoPacoteDeMinigamesNoApp, dispensarSemPacote = import.meta.env.DEV }: PacoteDoMinigameProps) {
  const fase = useSyncExternalStore(
    (ouvinte) => ouvirPacote(jogo, ouvinte),
    () => faseDoPacote(jogo),
  )
  useEffect(() => {
    void prepararMinigame(jogo, { porta, ocupado })
  }, [jogo, porta, ocupado])

  // Fora do app não há pacote: o painel aparece já, sem piscar o "Conferindo".
  if (!porta.disponivel()) return children
  const nome = NOME_DO_JOGO_DO_PACOTE[jogo]
  switch (fase.tipo) {
    case 'dispensado':
      return children
    // Os dois com a mesma árvore: entre um e outro o React reaproveita o
    // fieldset, e o painel (o que o mestre marcou, um convite) não desmonta.
    case 'pronto':
    case 'atualizando':
      return (
        <>
          {fase.tipo === 'atualizando' &&
            (fase.total === null ? (
              <p className="lb-label" role="status">
                Procurando versão nova do {nome}… Dá para chamar quando terminar.
              </p>
            ) : (
              <BarraDoDownload titulo={`Baixando a versão nova do ${nome}`} nome={nome} baixado={fase.baixado} total={fase.total} />
            ))}
          <fieldset className="lb-pacote-jogo__painel" disabled={fase.tipo === 'atualizando'} aria-busy={fase.tipo === 'atualizando'}>
            {children}
          </fieldset>
        </>
      )
    case 'conferindo':
      return (
        <p className="lb-label" role="status">
          Conferindo o {nome}…
        </p>
      )
    case 'baixando':
      return <BarraDoDownload titulo={`Baixando o ${nome} (só na primeira vez)`} nome={nome} baixado={fase.baixado} total={fase.total} />
    case 'sem_suporte':
      if (dispensarSemPacote) return children
      return (
        <p className="lb-minigame__aviso" role="alert">
          Esta versão do app ainda não baixa o {nome}. Atualize o app para jogar.
        </p>
      )
    case 'falhou':
      return (
        <>
          <div className="lb-pacote-jogo">
            <p className="lb-minigame__aviso" role="alert">
              {textoDaFalha(fase.motivo, nome)}
            </p>
            {fase.motivo !== 'app_velho' && (
              <button type="button" className="lb-btn lb-btn--block" onClick={() => void prepararMinigame(jogo, { porta, ocupado })}>
                Tentar de novo
              </button>
            )}
          </div>
          {dispensarSemPacote && children}
        </>
      )
  }
}
