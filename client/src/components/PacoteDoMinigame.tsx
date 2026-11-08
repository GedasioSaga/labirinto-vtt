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
 * mostra o painel. Quem baixa e confere é `minigames/pacoteDeMinigames.ts`.
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
    case 'pronto':
    case 'dispensado':
      return children
    case 'conferindo':
      return (
        <p className="lb-label" role="status">
          Conferindo o {nome}…
        </p>
      )
    case 'baixando':
      return (
        <div className="lb-pacote-jogo">
          <span className="lb-pacote-jogo__titulo" role="status">
            {fase.primeiraVez ? `Baixando o ${nome} (só na primeira vez)` : `Baixando a versão nova do ${nome}`}
          </span>
          <progress
            className="lb-pacote-jogo__barra"
            max={fase.total ?? undefined}
            value={fase.total === null ? undefined : fase.baixado}
            aria-label={`Download do ${nome}`}
          />
          <span className="lb-pacote-jogo__conta">{fase.total === null ? 'Começando…' : `${megas(fase.baixado)} de ${megas(fase.total)} MB`}</span>
        </div>
      )
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
