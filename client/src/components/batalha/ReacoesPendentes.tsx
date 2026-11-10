import { useEffect, useId, useState } from 'react'
import type { PedidoDeReacao } from '../../lib/batalha/combate'
import { porcentagemQuePerfura } from '../../lib/batalha/reacao'
import { chaveDaReacao, type ReacaoNaCaixa } from './CaixaDeReacao'
import { useReacaoNoCentro } from './centroDaReacao'
import { origemDoBonus } from './ContaComBonus'
import { formatarNumero, lerPerfuracao, saidasNaTela, textoDoPerfurante } from './dadosDoMenu'
import './batalha.css'
import './combate.css'

/**
 * AS REAÇÕES PENDENTES (mestre, aba Batalha): os golpes esperando reação. Os
 * de NPC numa linha curta cada (pedido de 10/11): a caixa REAÇÃO deles abre no
 * centro do mapa (`ReacaoNoCentro`: Rolar, modificador, Não reagir antes do
 * dado; depois as saídas, Passar e Rolar de novo; "Rolar todas" com mais de
 * um; antes do dado, "Usar técnica" com as técnicas de reação do NPC, que
 * `BatalhaDoMestre` põe em `tecnicas`), e a linha a traz para lá. Passar
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
  /** F2 (fatia B, o "perto" do Aplauso): os nomes das fichas de jogador que podem rebater no lugar dele ("May"); ausente = ninguém. */
  quemRebate?: string
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

/**
 * Pedido de 10/11: a reação do mestre numa linha curta (quem reage, o golpe, o dano). A carta abre no centro do mapa
 * (`ReacaoNoCentro`); a linha traz aquela reação para lá, aberta, e diz qual está lá.
 */
function LinhaDoMestre({ item }: { item: PendenteNaTela }) {
  const chave = chaveDaReacao(item)
  const noCentro = useReacaoNoCentro((state) => state.noCentro === chave)
  const aberta = useReacaoNoCentro((state) => state.naFrente)
  const rolagem = item.rolagem
  const onde = noCentro ? (aberta ? 'no centro' : 'recolhida: abrir') : 'trazer ao centro'
  return (
    <li>
      <button type="button" className="bt-pendente bt-pendente--linha" aria-current={noCentro ? 'true' : undefined} onClick={() => useReacaoNoCentro.getState().trazer(chave)}>
        <span>
          {item.por === undefined ? (
            <>
              <b>{item.alvo}</b> · {item.atacante} usa {item.nome}
            </>
          ) : (
            <>
              <b>{item.por.nome}</b> pode rebater por <b>{item.alvo}</b>
            </>
          )}
          {item.dano === null ? '' : `: ${formatarNumero(item.dano)}`}
          {rolagem !== undefined && <span className="bt-pendente__d20"> · d20 {rolagem.total}</span>}
        </span>
        <span className="bt-pendente__onde">{onde}</span>
      </button>
    </li>
  )
}

export function ReacoesPendentes({ itens, onPedir, onTrocarPerfurante }: ReacoesPendentesProps) {
  if (itens.length === 0) return null
  const doMestre = itens.filter((item) => item.doMestre)
  const deJogador = itens.filter((item) => !item.doMestre)
  const golpes = new Map<string, PendenteNaTela>()
  for (const item of itens) if (item.dano !== null && !golpes.has(item.golpeId)) golpes.set(item.golpeId, item)
  // Conserto das fichas F1 (bug 2): o mestre vê quantos golpes esperam e o que acontece com eles na virada.
  const quantosGolpes = new Set(itens.map((item) => item.golpeId)).size

  return (
    <section className="bt-secao bt-pendentes-secao" aria-label="Reações esperando">
      <h3 className="bt-secao__titulo">
        Reações esperando · {itens.length}
        {quantosGolpes !== itens.length && ` em ${quantosGolpes} ${quantosGolpes === 1 ? 'golpe' : 'golpes'}`}
      </h3>
      {/* Pedido de 10/11: a regra da virada vai na carta do centro; aqui só fica com golpe esperando jogador, que não tem carta. */}
      {deJogador.length > 0 && <p className="bt-vez__dica">Quem não reagir toma o golpe na virada da rodada. O golpe da última vez da rodada espera a virada seguinte.</p>}
      {doMestre.length > 0 && (
        <ul className="bt-pendentes" aria-label="Reações dos NPCs: a carta abre no centro do mapa">
          {doMestre.map((item) => (
            <LinhaDoMestre key={chaveDaReacao(item)} item={item} />
          ))}
        </ul>
      )}
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
                  {rolagem === undefined ? `esperando ${item.alvo}${item.quemRebate === undefined ? '' : ` (ou ${item.quemRebate} rebater)`}` : <span className="bt-pendente__d20">d20 {rolagem.d20}{rolagem.modificador === 0 ? '' : ` ${rolagem.modificador > 0 ? '+' : '−'} ${Math.abs(rolagem.modificador)}`} = {rolagem.total}</span>}
                </span>
                <span className="bt-pendente__acoes">
                  {/* F2 (revisão da fatia E, Recuperação de forças): a técnica que só o mestre usa, por ele, depois de confirmar na mesa. */}
                  {rolagem === undefined &&
                    (item.tecnicas ?? []).map((tecnica) => {
                      const saida = tecnica.sugerida ?? tecnica.saidas[0]
                      if (saida === undefined) return null
                      const daTabela = tecnica.daTabela?.[saida]
                      return (
                        <button
                          key={tecnica.cartao.id}
                          type="button"
                          className="bt-botao bt-botao--p"
                          disabled={tecnica.motivo !== null}
                          title={tecnica.motivo ?? 'Só o mestre usa: confira na mesa se vale para este golpe'}
                          onClick={() => onPedir({ tipo: 'tecnica', golpeId: item.golpeId, tokenId: item.tokenId, cartaoId: tecnica.cartao.id, saida, custo: null })}
                        >
                          Usar {tecnica.nome} por {item.alvo}
                          {daTabela === undefined ? '' : ` · ${daTabela.rotulo}`}
                        </button>
                      )
                    })}
                  {rolagem === undefined && (item.overload === true || item.surpresa === true) ? null : rolagem === undefined ? (
                    <button
                      type="button"
                      className="bt-botao bt-botao--p"
                      title={item.bonus === undefined ? undefined : `Rola com ${origemDoBonus(item.bonus.partes)}, dos selos de ${item.alvo}`}
                      onClick={() => onPedir({ tipo: 'rolar', golpeId: item.golpeId, tokenId: item.tokenId, modificador: item.bonus?.total ?? 0 })}
                    >
                      Rolar por {item.alvo}
                      {item.bonus !== undefined && (
                        <span className="bt-bonus" data-sinal={item.bonus.total < 0 ? 'menos' : 'mais'}>
                          {origemDoBonus(item.bonus.partes)}
                        </span>
                      )}
                    </button>
                  ) : (
                    saidasNaTela(rolagem, item.dano, item.semSaidas).map((saida) => (
                      <button key={saida.saida} type="button" className="bt-botao bt-botao--p" onClick={() => onPedir({ tipo: 'escolher', golpeId: item.golpeId, tokenId: item.tokenId, saida: saida.saida })}>
                        {saida.rotulo}
                        {saida.dano === null ? '' : ` · ${formatarNumero(saida.dano)}`}
                      </button>
                    ))
                  )}
                  <button type="button" className="bt-botao bt-botao--p bt-botao--fantasma" onClick={() => onPedir({ tipo: 'naoReagir', golpeId: item.golpeId, tokenId: item.tokenId })}>
                    Não reagir por {item.alvo}
                  </button>
                  {/* R3 (lote de 01/11): o mestre decide na mesa que o golpe não pegou (antes ou depois do dado). */}
                  <button
                    type="button"
                    className="bt-botao bt-botao--p bt-botao--fantasma"
                    title="O golpe não pega: sem dano, sem selo. Vai ao registro, com Desfazer."
                    onClick={() => onPedir({ tipo: 'semDano', golpeId: item.golpeId, tokenId: item.tokenId })}
                  >
                    Passar sem dano
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
