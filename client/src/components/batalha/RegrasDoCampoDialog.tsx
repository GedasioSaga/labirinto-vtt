import type { RegrasDaBatalha } from '../../lib/batalha/regrasDoCampo'
import { JanelaDaBatalha } from './JanelaDaBatalha'
import './batalha.css'

/**
 * As REGRAS DO CAMPO desta batalha (decisão 7), só leitura, igual para o
 * mestre e o jogador: o botão "Regras do campo" da faixa abre esta janela.
 * Mudar a regra é coisa do mestre, no painel da batalha.
 */

export interface RegrasDoCampoDialogProps {
  regras: RegrasDaBatalha | null
  onFechar: () => void
  /** Só o mestre: frase de onde mudar. */
  doMestre?: boolean
}

export function RegrasDoCampoDialog({ regras, onFechar, doMestre }: RegrasDoCampoDialogProps) {
  return (
    <JanelaDaBatalha titulo="Regras do campo" descricao="Valem só nesta batalha." onFechar={onFechar}>
      {regras === null ? (
        <p className="bt-regras__vazio">
          Esta batalha não tem regras do campo.{' '}
          {doMestre ? 'Escolha uma no painel da batalha, no livro da mesa.' : 'O mestre escolhe uma quando quiser.'}
        </p>
      ) : (
        <>
          <h3 className="bt-regras__nome">{regras.nome}</h3>
          <p className="bt-regras__blocos">
            {regras.blocosPorRank} {regras.blocosPorRank === 1 ? 'bloco' : 'blocos'} por rank de Agilidade
          </p>
          {regras.texto.trim().length > 0 ? <p className="bt-regras__texto">{regras.texto}</p> : <p className="bt-regras__vazio">Sem texto: só os blocos por rank.</p>}
        </>
      )}
    </JanelaDaBatalha>
  )
}
