import type { ReactNode } from 'react'
import type { FalhaDoVerComo, VerComoNoSite } from '../dados/lobbyStore'
import { useDoSite, useSite } from './contexto'
import { Icone } from './Icone'
import { Rosto } from './Rosto'

/**
 * VER COMO JOGADOR (pedido do mestre, 07/11/2026): a escolha no menu da conta
 * e a faixa fixa no alto de toda tela enquanto a vista está aberta. A faixa
 * tem a cor do latão, a do mestre: é a lente dele sobre a mesa, nunca a
 * mesa do jogador de verdade. Só leitura: o store já não deixa nada sair
 * (`sessao()` e as outras partes ficam `null`); as telas desligam os
 * controles com o motivo (`useSoLeitura`).
 */

/** O "ver como" pedido ou aberto: as telas mostram os controles de gravar desligados, com este nome no motivo. */
export function useSoLeitura(): { nome: string } | null {
  const nome = useDoSite((estado) => (estado.verComo !== null && estado.verComo.t !== 'erro' ? estado.verComo.nome : null))
  return nome === null ? null : { nome }
}

/** O motivo curto que cada controle desligado mostra no "ver como". */
export function motivoDaSoLeitura(nome: string): string {
  return `Só leitura: você está vendo como ${nome}.`
}

/** O aviso no lugar (ou ao lado) dos controles desligados do "ver como". */
export function AvisoDeSoLeitura({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <p className="lo-soleitura" id={id}>
      <Icone nome="olho" />
      <span>{children}</span>
    </p>
  )
}

function textoDaFalha(motivo: FalhaDoVerComo, nome: string): string {
  switch (motivo) {
    case 'so-mestre':
      return 'Só o mestre da mesa vê como um jogador.'
    case 'nao-e-jogador':
      return `${nome} não é mais jogador desta mesa.`
    case 'torta':
      return 'A vista chegou fora do formato. Recarregue a página e tente de novo.'
    case 'sem-resposta':
      return 'O servidor não respondeu a tempo. Se o Lobby acabou de ser atualizado, o servidor pode ainda não ter o "Ver como".'
    case 'sem-canal':
      return 'Sem conexão com a mesa agora. Tente de novo quando ela voltar.'
  }
}

/** A faixa fixa do "ver como", no alto da cabeça (acima da marca), em toda tela da mesa. */
export function FaixaDoVerComo({ verComo }: { verComo: VerComoNoSite }) {
  const site = useSite()
  const semRede = useDoSite((estado) => estado.campanha !== null && estado.campanha.conexao !== 'em-dia')

  if (verComo.t === 'erro') {
    return (
      <div className="lo-vercomo" data-estado="erro" role="alert">
        <div className="lo-vercomo__dentro">
          <p className="lo-vercomo__principal">
            <Icone nome="alerta" />
            <span>Não deu para ver como {verComo.nome}</span>
          </p>
          <span className="lo-vercomo__extra">{textoDaFalha(verComo.motivo, verComo.nome)}</span>
          <span className="lo-vercomo__acoes">
            {verComo.motivo !== 'nao-e-jogador' && verComo.motivo !== 'so-mestre' && (
              <button type="button" className="lo-btn lo-vercomo__acao" onClick={() => site.verComo(verComo.contaId)}>
                Tentar de novo
              </button>
            )}
            <button type="button" className="lo-btn lo-btn--fantasma lo-vercomo__acao" onClick={() => site.voltarASerMestre()}>
              Fechar
            </button>
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="lo-vercomo" data-estado={verComo.t} role="status" aria-live="polite">
      <div className="lo-vercomo__dentro">
        <p className="lo-vercomo__principal">
          {verComo.t === 'pedindo' ? <span className="lo-giro" aria-hidden="true" /> : <Icone nome="olho" />}
          <span>{verComo.t === 'pedindo' ? `Abrindo a vista de ${verComo.nome}…` : `Vendo como ${verComo.nome} — só leitura`}</span>
        </p>
        <span className="lo-vercomo__extra">
          {verComo.t === 'pronto' && semRede ? 'Sem conexão: a vista pode estar atrasada.' : `O que ${verComo.nome} vê nesta mesa. Nada do que você fizer aqui grava em nome dele.`}
        </span>
        <span className="lo-vercomo__acoes">
          <button type="button" className="lo-btn lo-btn--primario lo-vercomo__acao" onClick={() => site.voltarASerMestre()}>
            Voltar a ser mestre
          </button>
        </span>
      </div>
    </div>
  )
}

/**
 * A escolha no menu da conta, só para o mestre de uma mesa aberta: os
 * jogadores ativos da mesa (sem e-mail, como o `estado` os traz). O que
 * está aberto aparece marcado; clicar de novo nele não pede de novo.
 */
export function EscolherQuemVer({ aoEscolher }: { aoEscolher(): void }) {
  const site = useSite()
  const verComo = useDoSite((estado) => estado.verComo)
  const campanha = useDoSite((estado) => estado.campanha)
  if (campanha === null) return null
  const souMestre = (verComo?.mestre ?? campanha.eu)?.papel === 'mestre'
  if (!souMestre) return null
  const jogadores = campanha.membros.filter((membro) => membro.papel === 'jogador')
  const atual = verComo !== null && verComo.t !== 'erro' ? verComo.contaId : null

  return (
    <div className="lo-menu__vercomo" role="group" aria-labelledby="lo-menu-vercomo-titulo">
      <p className="lo-menu__rotulo" id="lo-menu-vercomo-titulo">
        Ver como jogador
      </p>
      {jogadores.length === 0 ? (
        <p className="lo-motivo lo-menu__nota">Esta mesa ainda não tem jogador para ver.</p>
      ) : (
        <ul className="lo-menu__jogadores">
          {jogadores.map((jogador) => (
            <li key={jogador.contaId}>
              <button
                type="button"
                className="lo-btn lo-btn--fantasma lo-menu__jogador"
                aria-pressed={atual === jogador.contaId}
                onClick={() => {
                  aoEscolher()
                  if (atual !== jogador.contaId) site.verComo(jogador.contaId)
                }}
              >
                <Rosto contaId={jogador.contaId} nome={jogador.nome} className="lo-menu__jogador-rosto" />
                <span>{jogador.nome}</span>
                {atual === jogador.contaId && <Icone nome="olho" />}
              </button>
            </li>
          ))}
        </ul>
      )}
      {atual !== null && (
        <button
          type="button"
          className="lo-btn lo-btn--fantasma"
          onClick={() => {
            aoEscolher()
            site.voltarASerMestre()
          }}
        >
          <Icone nome="voltar" /> Voltar a ser mestre
        </button>
      )}
    </div>
  )
}
