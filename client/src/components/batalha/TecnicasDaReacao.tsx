import { useId, useState } from 'react'
import { CUSTO_MAX, type PedidoDeReacao, type SaidaDaTecnica } from '../../lib/batalha/combate'
import { danoFinal } from '../../lib/batalha/reacao'
import type { PedidoDeTecnica, ReacaoComTecnica } from '../../lib/batalha/reacaoComTecnica'
import { formatarNumero, lerInteiro, lerModificadorDaReacao, textoDoCusto, TEXTO_DA_SAIDA } from './dadosDoMenu'

/**
 * USAR TÉCNICA, dentro da caixa REAÇÃO (tipos de habilidade F1, seção 4f de
 * docs/planos/batalha-tipos-de-habilidade-plano.md; decisão 2): antes do d20,
 * um cartão por técnica de reação. A saída lida do texto vem marcada e em
 * destaque no botão; as outras ficam à mão para trocar ("(à mão)" no botão e
 * no registro). "Rolar 1d20" rola com a técnica (o campo de modificador
 * aparece). O selo que a técnica põe em quem atacou ("Marcado") vem ligado.
 * Custo que a ficha não fecha pede o número. Apagada: o motivo, sem controles.
 *
 * Serve ao jogador (a caixa dele) e ao mestre (Reações pendentes, por NPC).
 */

export interface TecnicasDaReacaoProps {
  tecnicas: readonly ReacaoComTecnica[]
  golpeId: string
  tokenId: string
  atacante: string
  /** O dano que chega; `null` = golpe sem dano. */
  dano: number | null
  /** O modificador da caixa, para começar o "Rolar 1d20" da técnica. */
  modificadorInicial: string
  /** Rolando (a volta do host ainda não chegou): os botões esperam. */
  esperando: boolean
  onPedir: (pedido: PedidoDeReacao) => void
}

/** O texto curto de cada saída no cartão. */
const ROTULO_DA_SAIDA: Record<SaidaDaTecnica, string> = {
  esquiva: TEXTO_DA_SAIDA.esquiva.botao,
  metade: TEXTO_DA_SAIDA.metade.botao,
  contra: TEXTO_DA_SAIDA.contra.botao,
  cheio: 'Receber',
  rolar: 'Rolar 1d20',
}

/** "Esquivar · 0", "Defender · 50", "Rolar 1d20". */
function rotuloComDano(saida: SaidaDaTecnica, dano: number | null): string {
  if (saida === 'rolar' || dano === null) return ROTULO_DA_SAIDA[saida]
  return `${ROTULO_DA_SAIDA[saida]} · ${formatarNumero(danoFinal(dano, saida))}`
}

function textoDosTurnos(turnos: number | null): string {
  return turnos === null ? 'até tirar' : `${turnos} ${turnos === 1 ? 'turno' : 'turnos'}`
}

function UmaTecnica({ tecnica, golpeId, tokenId, atacante, dano, modificadorInicial, esperando, onPedir }: Omit<TecnicasDaReacaoProps, 'tecnicas'> & { tecnica: ReacaoComTecnica }) {
  const id = useId()
  const [saida, setSaida] = useState<SaidaDaTecnica | null>(tecnica.sugerida)
  const [modTexto, setModTexto] = useState(modificadorInicial)
  const [comSelo, setComSelo] = useState(tecnica.seloNoAtacante !== null)
  const [custoTexto, setCustoTexto] = useState(tecnica.custo.tipo === 'pergunta' && tecnica.custo.sugestao !== null ? String(tecnica.custo.sugestao) : '')
  const [erro, setErro] = useState<string | null>(null)

  const custoNaTela = textoDoCusto(tecnica.custo)
  const apagada = tecnica.motivo !== null
  const aMao = saida !== null && tecnica.sugerida !== null && saida !== tecnica.sugerida

  const usar = () => {
    if (saida === null) {
      setErro('O texto da técnica não diz o que ela faz: escolha a saída.')
      return
    }
    let custo: number | null = null
    if (tecnica.custo.tipo === 'pergunta') {
      custo = lerInteiro(custoTexto, CUSTO_MAX)
      if (custo === null) {
        setErro(`Confirme o custo: ${tecnica.custo.texto}`)
        return
      }
    }
    setErro(null)
    const pedido: PedidoDeTecnica = { tipo: 'tecnica', golpeId, tokenId, cartaoId: tecnica.cartao.id, saida, custo }
    if (saida === 'rolar') pedido.modificador = lerModificadorDaReacao(modTexto)
    if (comSelo && tecnica.seloNoAtacante !== null) pedido.seloNoAtacante = tecnica.seloNoAtacante
    onPedir(pedido)
  }

  return (
    <li className="bt-tec" data-apagada={apagada ? 'sim' : 'nao'}>
      <div className="bt-tec__cabeca">
        <span className="bt-tec__nome" id={`${id}-nome`}>
          {tecnica.nome}
        </span>
        {tecnica.forma !== undefined && <span className="bt-etq bt-etq--forma">{tecnica.forma}</span>}
        {custoNaTela !== null && (
          <span className="bt-etq" title={tecnica.custo.tipo === 'pergunta' ? `A ficha diz: ${tecnica.custo.texto}` : undefined}>
            {custoNaTela}
          </span>
        )}
        {tecnica.overload && <span className="bt-etq bt-etq--over">Overload</span>}
      </div>
      {apagada ? (
        <p className="bt-tec__motivo" id={`${id}-motivo`}>
          {tecnica.motivo}
        </p>
      ) : (
        <>
          <fieldset className="bt-tec__saidas" aria-labelledby={`${id}-nome ${id}-leg`}>
            <legend className="bt-sr" id={`${id}-leg`}>
              o que ela faz
            </legend>
            {tecnica.saidas.map((opcao) => (
              <label key={opcao} className="bt-tec__saida" data-sugerida={opcao === tecnica.sugerida ? 'sim' : 'nao'}>
                <input
                  type="radio"
                  className="bt-sr"
                  name={`${id}-saida`}
                  checked={saida === opcao}
                  onChange={() => {
                    setErro(null)
                    setSaida(opcao)
                  }}
                />
                {rotuloComDano(opcao, dano)}
                {opcao === tecnica.sugerida && <span className="bt-tec__lida">pelo texto</span>}
              </label>
            ))}
          </fieldset>
          {(saida === 'rolar' || tecnica.custo.tipo === 'pergunta' || tecnica.seloNoAtacante !== null) && (
            <div className="bt-tec__extras">
              {saida === 'rolar' && (
                <label className="bt-mod">
                  Modificador
                  <input className="bt-num" inputMode="numeric" value={modTexto} placeholder="0" onChange={(evento) => setModTexto(evento.target.value)} />
                </label>
              )}
              {tecnica.custo.tipo === 'pergunta' && (
                <label className="bt-mod" title={`A ficha diz: ${tecnica.custo.texto}`}>
                  Custo ({tecnica.custo.recurso.toUpperCase()})
                  <input className="bt-num" inputMode="numeric" value={custoTexto} placeholder="?" onChange={(evento) => setCustoTexto(evento.target.value)} />
                </label>
              )}
              {tecnica.seloNoAtacante !== null && (
                <label className="bt-chave">
                  <input type="checkbox" role="switch" checked={comSelo} onChange={(evento) => setComSelo(evento.target.checked)} />
                  <span className="bt-chave__trilho" aria-hidden="true" />
                  {tecnica.seloNoAtacante.nome} em {atacante} · {textoDosTurnos(tecnica.seloNoAtacante.turnos)}
                </label>
              )}
            </div>
          )}
        </>
      )}
      <div className="bt-tec__pe">
        <button
          type="button"
          className={apagada ? 'bt-botao' : 'bt-botao bt-botao--batalha'}
          disabled={apagada || esperando || saida === null}
          aria-describedby={apagada ? `${id}-motivo` : undefined}
          onClick={usar}
        >
          {esperando && saida === 'rolar' ? 'Rolando…' : `Usar ${tecnica.nome}`}
          {!apagada && saida !== null && <span className="bt-tec__res">{ROTULO_DA_SAIDA[saida]}</span>}
        </button>
        {aMao && <span className="bt-tec__mao">(à mão)</span>}
        {!apagada && saida === null && <span className="bt-tec__mao">O texto não diz: escolha a saída</span>}
      </div>
      {erro !== null && (
        <p className="bt-form__erro" role="alert">
          {erro}
        </p>
      )}
    </li>
  )
}

export function TecnicasDaReacao({ tecnicas, ...resto }: TecnicasDaReacaoProps) {
  if (tecnicas.length === 0) return null
  return (
    <section className="bt-tecs bt-sobre-escuro" aria-label="Usar técnica">
      <p className="bt-tecs__titulo">
        Usar técnica <span>· no lugar do d20, sem gastar a ação da vez</span>
      </p>
      <ul className="bt-tecs__lista">
        {tecnicas.map((tecnica) => (
          <UmaTecnica key={tecnica.cartao.id} tecnica={tecnica} {...resto} />
        ))}
      </ul>
    </section>
  )
}
