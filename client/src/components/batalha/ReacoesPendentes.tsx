import { useEffect, useId, useState } from 'react'
import type { PedidoDeReacao } from '../../lib/batalha/combate'
import { porcentagemQuePerfura } from '../../lib/batalha/reacao'
import { CaixaDeReacao, type ReacaoNaCaixa } from './CaixaDeReacao'
import { formatarNumero, lerPerfuracao, saidasNaTela, textoDoPerfurante } from './dadosDoMenu'
import './batalha.css'
import './combate.css'

/**
 * AS REAÇÕES PENDENTES (mestre, aba Batalha): os golpes esperando reação. Os
 * de NPC na caixa REAÇÃO (Rolar, modificador, Não reagir antes do dado; depois
 * as saídas, Passar e Rolar de novo; "Rolar todas" com mais de um; antes do
 * dado, "Usar técnica" com as técnicas de reação do NPC, que
 * `BatalhaDoMestre` põe em `tecnicas`). Passar
 * mantém o crítico do 1 natural, como no jogador. Os de jogador, "Esperando Lia", com
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
  /** `perfuracao` (1 a 100) troca também quanto perfura; ausente = fica a do golpe. */
  onTrocarPerfurante: (golpeId: string, perfurante: boolean, perfuracao?: number) => boolean
}

/**
 * O Perfurante de um golpe esperando reação, com quanto perfura ao lado (só
 * ligado). O número vale ao sair do campo ou no Enter (cada troca reescreve a
 * linha do registro); Esc ou número torto voltam ao do golpe.
 */
function PerfuranteDoGolpe({ item, onTrocar }: { item: PendenteNaTela; onTrocar: ReacoesPendentesProps['onTrocarPerfurante'] }) {
  const idTexto = useId()
  const porcentagem = porcentagemQuePerfura(true, item.perfuracao)
  const [texto, setTexto] = useState(String(porcentagem))
  // O golpe trocou por fora (o registro desfeito, outra janela): o campo acompanha.
  useEffect(() => setTexto(String(porcentagem)), [porcentagem])
  const lida = lerPerfuracao(texto)
  const confirmar = () => {
    if (lida === null) setTexto(String(porcentagem))
    else if (lida !== porcentagem && !onTrocar(item.golpeId, true, lida)) setTexto(String(porcentagem))
  }
  return (
    <span className="bt-perfura">
      <label className="bt-chave">
        <input type="checkbox" role="switch" checked={item.perfurante} aria-describedby={idTexto} onChange={(evento) => onTrocar(item.golpeId, evento.target.checked)} />
        <span className="bt-chave__trilho" aria-hidden="true" />
        {item.nome}: perfurante
      </label>
      {item.perfurante && (
        <label className="bt-perfura__quanto">
          <span className="bt-sr">Quanto {item.nome} perfura, em %</span>
          <input
            className="bt-num"
            inputMode="numeric"
            maxLength={3}
            value={texto}
            aria-invalid={lida === null ? true : undefined}
            aria-describedby={idTexto}
            onFocus={(evento) => evento.target.select()}
            onChange={(evento) => setTexto(evento.target.value)}
            onBlur={confirmar}
            onKeyDown={(evento) => {
              if (evento.key === 'Enter') {
                evento.preventDefault()
                confirmar()
              } else if (evento.key === 'Escape' && texto !== String(porcentagem)) {
                evento.preventDefault()
                evento.stopPropagation()
                setTexto(String(porcentagem))
              }
            }}
          />
          <span aria-hidden="true">%</span>
        </label>
      )}
      <small id={idTexto} className="bt-perfura__texto">
        {item.perfurante ? textoDoPerfurante(lida ?? porcentagem) : 'direto no HP'}
      </small>
    </span>
  )
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
      {doMestre.length > 0 && <CaixaDeReacao reacoes={doMestre} onPedir={onPedir} />}
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
            <PerfuranteDoGolpe key={item.golpeId} item={item} onTrocar={onTrocarPerfurante} />
          ))}
        </div>
      )}
    </section>
  )
}
