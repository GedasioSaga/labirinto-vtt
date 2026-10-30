import type { PedidoDeReacao } from '../../lib/batalha/combate'
import { CaixaDeReacao, type ReacaoNaCaixa } from './CaixaDeReacao'
import { formatarNumero, saidasNaTela } from './dadosDoMenu'
import './batalha.css'
import './combate.css'

/**
 * AS REAÇÕES PENDENTES (mestre, aba Batalha): os golpes esperando reação. Os
 * de NPC na caixa REAÇÃO (Rolar, modificador, as saídas, Rolar de novo, Não
 * reagir; "Rolar todas" com mais de um). Os de jogador, "Esperando Lia", com
 * "Rolar por ela" e "Não reagir por ela". Perfurante (Q4) por golpe: o
 * mestre decide no fim.
 */

export interface PendenteNaTela extends ReacaoNaCaixa {
  golpeId: string
  /** O nome de quem reage. */
  alvo: string
  /** Alvo do mestre (NPC ou ficha sem personagem); `false` = de jogador. */
  doMestre: boolean
  perfurante: boolean
}

export interface ReacoesPendentesProps {
  itens: readonly PendenteNaTela[]
  onPedir: (pedido: PedidoDeReacao) => boolean
  onTrocarPerfurante: (golpeId: string, perfurante: boolean) => boolean
}

export function ReacoesPendentes({ itens, onPedir, onTrocarPerfurante }: ReacoesPendentesProps) {
  if (itens.length === 0) return null
  const doMestre = itens.filter((item) => item.doMestre)
  const deJogador = itens.filter((item) => !item.doMestre)
  const golpes = new Map<string, PendenteNaTela>()
  for (const item of itens) if (item.dano !== null && !golpes.has(item.golpeId)) golpes.set(item.golpeId, item)

  return (
    <section className="bt-secao bt-pendentes-secao" aria-label="Reações esperando">
      <h3 className="bt-secao__titulo">Reações esperando · {itens.length}</h3>
      {doMestre.length > 0 && <CaixaDeReacao reacoes={doMestre} onPedir={onPedir} naoReagirDepoisDoDado />}
      {deJogador.length > 0 && (
        <ul className="bt-pendentes">
          {deJogador.map((item) => {
            const rolagem = item.rolagem
            return (
              <li key={`${item.golpeId}:${item.tokenId}`} className="bt-pendente">
                <span>
                  <b>{item.atacante}</b> usa <b>{item.nome}</b> em <b>{item.alvo}</b>
                  {item.dano === null ? '' : `: ${formatarNumero(item.dano)}`}
                  {' · '}
                  {rolagem === undefined ? `esperando ${item.alvo}` : <span className="bt-pendente__d20">d20 {rolagem.d20}{rolagem.modificador === 0 ? '' : ` ${rolagem.modificador > 0 ? '+' : '−'} ${Math.abs(rolagem.modificador)}`} = {rolagem.total}</span>}
                </span>
                <span className="bt-pendente__acoes">
                  {rolagem === undefined ? (
                    <button type="button" className="bt-botao bt-botao--p" onClick={() => onPedir({ tipo: 'rolar', golpeId: item.golpeId, tokenId: item.tokenId, modificador: 0 })}>
                      Rolar por {item.alvo}
                    </button>
                  ) : (
                    saidasNaTela(rolagem.d20, rolagem.total, item.dano).map((saida) => (
                      <button key={saida.saida} type="button" className="bt-botao bt-botao--p" onClick={() => onPedir({ tipo: 'escolher', golpeId: item.golpeId, tokenId: item.tokenId, saida: saida.saida })}>
                        {saida.rotulo}
                        {saida.dano === null ? '' : ` · ${formatarNumero(saida.dano)}`}
                      </button>
                    ))
                  )}
                  <button type="button" className="bt-botao bt-botao--p bt-botao--fantasma" onClick={() => onPedir({ tipo: 'naoReagir', golpeId: item.golpeId, tokenId: item.tokenId })}>
                    Não reagir por {item.alvo}
                  </button>
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {golpes.size > 0 && (
        <div className="bt-npc__chaves bt-sobre-escuro">
          {[...golpes.values()].map((item) => (
            <label key={item.golpeId} className="bt-chave">
              <input type="checkbox" role="switch" checked={item.perfurante} onChange={(evento) => onTrocarPerfurante(item.golpeId, evento.target.checked)} />
              <span className="bt-chave__trilho" aria-hidden="true" />
              {item.nome}: perfurante <small>direto no HP</small>
            </label>
          ))}
        </div>
      )}
    </section>
  )
}
