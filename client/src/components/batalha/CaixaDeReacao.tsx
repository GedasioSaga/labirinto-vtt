import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { MODIFICADOR_DA_REACAO_MAX, PERFURACAO_MAX, VANTAGENS_DO_DADO, type ParteDoBonus, type PedidoDeReacao, type RolagemDaReacao, type SaidaDaReacao, type VantagemDoDado } from '../../lib/batalha/combate'
import { danoFinal, divisaoDoDano, porcentagemQuePerfura, saidaDoPassar, saidasDaRolagem } from '../../lib/batalha/reacao'
import type { ReacaoComTecnica } from '../../lib/batalha/reacaoComTecnica'
import { origemDoBonus } from './ContaComBonus'
import { formatarNumero, lerModificadorDaReacao, movimentoReduzido, saidasNaTela, TEXTO_DA_SAIDA } from './dadosDoMenu'
import { devolverFocoAoMenu } from './ListaDeTecnicas'
import { TecnicasDaReacao } from './TecnicasDaReacao'
import './batalha.css'
import './combate.css'

/**
 * A CAIXA REAÇÃO (o `.reacao` do protótipo aprovado): quem ataca, com o quê
 * e quanto; o modificador (lembrado por ficha nesta sessão); Rolar 1d20 (o
 * dado é rolado no host); o d20 animado (160 ms entra, 8 números em 380 ms,
 * pousa em 200 ms); depois só as saídas que o TOTAL liberou (Q3), com o dano
 * de cada uma, e Passar (toma o golpe inteiro sem usar a reação) quando o
 * dado liberou alguma; Rerolar (Ponto Saga, sem limite: decisão 10); Não
 * reagir, só antes do dado. No 20, Contra-atacar zera o dano e dá uma ação a
 * mais (Q6). No 1 natural e abaixo de 10 o único botão já é receber o golpe.
 *
 * Tipos de habilidade F1: antes do d20, "Usar técnica" (`TecnicasDaReacao`)
 * com as técnicas de reação de quem reage, no lugar do dado.
 *
 * Tipos de habilidade F2: o modificador começa com o "+3 na reação" dos
 * selos de quem reage (`bonusDaReacao`), com a origem ao lado ("+3 (Foco)");
 * o campo segue editável. O lembrado por ficha guarda só a parte digitada à
 * mão: quando o selo sai, o modificador volta sem ele.
 *
 * Com mais de um golpe esperando, uma linha por golpe e "Rolar todas". Esc
 * recolhe (o botão REAÇÃO reabre). O mestre (pedido de 10/11, `ReacaoNoCentro`)
 * vê uma por vez sobre o mapa, com "1 de 2" na `conta` e o "Rolar todas" da
 * fila inteira (`todas`).
 */

export interface ReacaoNaCaixa {
  /** `null` = reação livre (o botão REAÇÃO sem golpe esperando). */
  golpeId: string | null
  tokenId: string
  /** Quem reage, quando não é óbvio (o NPC no mestre; a ficha dele, se tem mais de uma). */
  alvo?: string
  atacante: string
  /** O nome do golpe. */
  nome: string
  /** O dano que chega; `null` = golpe sem dano. */
  dano: number | null
  perfurante?: boolean
  /** Com `perfurante`, quando é parcial: quanto do dano vai direto ao HP (1 a 99); ausente = tudo. */
  perfuracao?: number
  /** Conserto das fichas F1: golpe Overload. O d20 não defende: só outra Overload (as `tecnicas` já vêm só as Overload). */
  overload?: boolean
  /** F2 (revisão da fatia E): golpe Surpresa. O d20 não defende: só a técnica que vale contra ela (as `tecnicas` já vêm só essas). */
  surpresa?: boolean
  rolagem?: RolagemDaReacao
  /** Tipos de habilidade F1: as técnicas de reação de quem reage (`reacoesParaOAlvo`); ausente ou vazia = sem a seção Usar técnica. */
  tecnicas?: readonly ReacaoComTecnica[]
  /** Tipos de habilidade F2: o "reacao" dos selos de quem reage: o total (`bonusDaReacao`) e as partes ("+3 (Foco)"). Ausente = nenhum. */
  bonus?: BonusDaReacaoNaTela
  /** Conserto das fichas F1 (S4): o que sai do dano de quem reage ("Resiliente −20%"), `avisoDasReducoes`. Ausente = nada. */
  reducao?: string
  /** F2 (fatia A): as saídas que os selos de quem reage tiram (Aéreo: Esquiva e Contra-ataque). Ausente = nenhuma. */
  semSaidas?: readonly SaidaDaReacao[]
  /**
   * F2 (fatia B, o "perto" do Aplauso): a ficha que rebate no lugar do alvo
   * (`alvo` é o nome dele). Com ela, só a técnica que rebate: o dado, o Não
   * reagir e o Passar sem dano são do alvo e ficam fora.
   */
  por?: { tokenId: string; nome: string }
}

/** S4: o dado da reação: um d20 (normal) ou dois, ficando o maior (vantagem) ou o menor (desvantagem). */
const ROTULO_DO_DADO: Record<VantagemDoDado, string> = { vantagem: 'Vantagem: 2 dados, fica o maior', desvantagem: 'Desvantagem: 2 dados, fica o menor' }

/** "15" ou "15 (vantagem: 15 e 7)": o d20 que valeu e, com dois dados, os dois. F2 (revisão da fatia E): o Marcado mostra o dado da esquiva. */
function textoDoD20(rolagem: RolagemDaReacao): string {
  const { d20, vantagem, d20DaEsquiva } = rolagem
  const dados = vantagem === undefined ? String(d20) : `${d20} (${vantagem.modo}: ${d20} e ${vantagem.outro})`
  return d20DaEsquiva === undefined ? dados : `${dados} (para esquivar, marcado: ${d20DaEsquiva})`
}

/** O bônus de reação como a caixa o mostra. */
export interface BonusDaReacaoNaTela {
  total: number
  partes: readonly ParteDoBonus[]
}

/** O modificador que a caixa abre: o digitado à mão da última vez mais o bônus dos selos, no teto. */
export function modificadorInicial(tokenId: string, bonus: BonusDaReacaoNaTela | undefined): number {
  const soma = (modificadorLembrado.get(tokenId) ?? 0) + (bonus?.total ?? 0)
  return Math.max(-MODIFICADOR_DA_REACAO_MAX, Math.min(MODIFICADOR_DA_REACAO_MAX, soma))
}

/** ", perfurante (direto no HP)" ou ", perfurante 30% (60 direto no HP, o resto pelo Escudo)". */
function textoDoPerfuranteNaCaixa(reacao: ReacaoNaCaixa, dano: number): string {
  if (reacao.perfurante !== true) return ''
  const porcentagem = porcentagemQuePerfura(true, reacao.perfuracao)
  if (porcentagem >= PERFURACAO_MAX) return ', perfurante (direto no HP)'
  return `, perfurante ${porcentagem}% (${formatarNumero(divisaoDoDano(dano, porcentagem).direto)} direto no HP, o resto pelo Escudo)`
}

export interface CaixaDeReacaoProps {
  reacoes: readonly ReacaoNaCaixa[]
  /** O pedido saiu? */
  onPedir: (pedido: PedidoDeReacao) => boolean
  /** Esc ou "Depois": recolhe. Ausente = a caixa não recolhe. */
  onFechar?: () => void
  /** O botão que recolhe; ausente = "Depois". */
  rotuloDoFechar?: string
  /** Pedido de 10/11 (a reação do mestre no centro): no lugar de "N golpes esperando", ao lado do título ("1 de 2" e as setas). */
  conta?: ReactNode
  /** O "Rolar todas" conta estas (o centro mostra uma por vez, mas rola todas as da fila); ausente = as `reacoes`. */
  todas?: readonly ReacaoNaCaixa[]
  /** A dica do pé (as teclas e a regra da virada); ausente = nenhuma. */
  dica?: ReactNode
  /** Enter no Modificador rola (o foco já nasce no Rolar 1d20, que o Enter aperta). */
  rolarComEnter?: boolean
  /** Ao abrir, se nenhum botão pegou o foco (Overload, Surpresa: sem o Rolar), a caixa pega. */
  focoNaCaixa?: boolean
  /**
   * Perguntada antes de cada foco que a caixa daria sozinha (ao abrir, na reação seguinte, quando o dado volta):
   * `false` = o foco fica onde está (o mestre digitando em outro lugar). Ausente = a caixa sempre foca, como antes.
   */
  podeFocar?: () => boolean
}

/** Conserto das fichas F1: o lugar do "Rolar 1d20" num golpe Overload. */
const TEXTO_DO_OVERLOAD = 'Overload: o dado não defende'
/** F2 (revisão da fatia E): o lugar do "Rolar 1d20" num golpe Surpresa (só a técnica que vale contra ela defende). */
const TEXTO_DA_SURPRESA = 'Surpresa: o dado não defende'

/** O modificador de reação lembrado por ficha durante a sessão (some ao recarregar a página). */
const modificadorLembrado = new Map<string, number>()
const PUNCH = 'cubic-bezier(0.34, 1.56, 0.64, 1)'
const NUMEROS_DO_GIRO = 8
const PASSO_DO_GIRO_MS = 48

/** Uma reação esperando: o golpe, quem reage e, no "perto" do Aplauso, quem rebate. */
export function chaveDaReacao(reacao: ReacaoNaCaixa): string {
  return `${reacao.golpeId ?? 'livre'}:${reacao.tokenId}${reacao.por === undefined ? '' : `:${reacao.por.tokenId}`}`
}

/** O d20 que gira e pousa quando a rolagem do host chega. */
export function DadoDaReacao({ rolagem }: { rolagem: RolagemDaReacao | undefined }) {
  const dado = useRef<HTMLDivElement>(null)
  const [mostrado, setMostrado] = useState<string>(rolagem === undefined ? 'd20' : String(rolagem.d20))
  const chave = rolagem === undefined ? null : `${rolagem.d20}:${rolagem.vezes}`
  const primeira = useRef(true)

  useLayoutEffect(() => {
    if (rolagem === undefined) {
      setMostrado('d20')
      return
    }
    // A rolagem que já estava lá ao montar não gira de novo.
    if (primeira.current || movimentoReduzido() || dado.current === null) {
      primeira.current = false
      setMostrado(String(rolagem.d20))
      return
    }
    const elemento = dado.current
    const animacoes: Animation[] = [elemento.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(-360deg)' }], { duration: NUMEROS_DO_GIRO * PASSO_DO_GIRO_MS, easing: 'cubic-bezier(0.2, 0.6, 0.35, 1)' })]
    let passo = 0
    const giro = window.setInterval(() => {
      passo += 1
      if (passo >= NUMEROS_DO_GIRO) {
        window.clearInterval(giro)
        setMostrado(String(rolagem.d20))
        animacoes.push(elemento.animate([{ transform: 'scale(1.4)' }, { transform: 'scale(1)' }], { duration: 200, easing: PUNCH }))
        return
      }
      setMostrado(String(1 + Math.floor(Math.random() * 20)))
    }, PASSO_DO_GIRO_MS)
    return () => {
      window.clearInterval(giro)
      for (const animacao of animacoes) animacao.cancel()
      setMostrado(String(rolagem.d20))
    }
    // Só a rolagem nova (d20 e vezes) gira; `rolagem` muda de objeto a cada estado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave])

  const saida = rolagem === undefined || mostrado !== String(rolagem.d20) ? undefined : saidasDaRolagem(rolagem)[0]
  return (
    <div ref={dado} className="bt-dado" data-s={saida ?? ''} aria-hidden="true">
      {mostrado}
    </div>
  )
}

function UmaReacao({
  reacao,
  sozinha,
  onPedir,
  focar,
  rolarComEnter = false,
  podeFocar,
}: {
  reacao: ReacaoNaCaixa
  sozinha: boolean
  onPedir: (pedido: PedidoDeReacao) => boolean
  focar: boolean
  rolarComEnter?: boolean
  podeFocar?: () => boolean
}) {
  const [modTexto, setModTexto] = useState(() => {
    const inicial = modificadorInicial(reacao.tokenId, reacao.bonus)
    return inicial === 0 ? '' : String(inicial)
  })
  const origem = reacao.bonus === undefined ? '' : origemDoBonus(reacao.bonus.partes)
  const idDaOrigem = useId()
  const [esperando, setEsperando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  // S4: `null` = dado normal; vantagem e desvantagem rolam dois d20 no host.
  const [dado, setDado] = useState<VantagemDoDado | null>(null)
  const comDado = dado === null ? {} : { vantagem: dado }
  const idDoDado = useId()
  const primeiro = useRef<HTMLButtonElement>(null)
  const rolagem = reacao.rolagem
  const chaveDaRolagem = rolagem === undefined ? null : `${rolagem.d20}:${rolagem.vezes}`

  // A rolagem nova (ou o prazo) solta o botão.
  useEffect(() => setEsperando(false), [chaveDaRolagem])
  useEffect(() => {
    if (!esperando) return
    const prazo = window.setTimeout(() => setEsperando(false), 4000)
    return () => window.clearTimeout(prazo)
  }, [esperando])
  useEffect(() => {
    if (!focar || primeiro.current === null) return
    if (podeFocar !== undefined && !podeFocar()) return
    primeiro.current.focus({ preventScroll: true })
    // `podeFocar` muda a cada render de quem monta; o foco só anda ao abrir e quando o dado volta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focar, chaveDaRolagem])

  const modificador = lerModificadorDaReacao(modTexto)
  const pedir = (pedido: PedidoDeReacao) => {
    if (esperando) return
    // Só a parte à mão fica lembrada: o bônus do selo volta sozinho enquanto o selo existir.
    modificadorLembrado.set(reacao.tokenId, modificador - (reacao.bonus?.total ?? 0))
    const saiu = onPedir(pedido)
    setErro(saiu ? null : 'Não saiu: sem conexão com o mestre. Tente de novo.')
    // Só o dado espera a volta do host (também a técnica que rola); escolher, Passar, Passar sem dano, Não reagir e a técnica sem dado resolvem e a caixa sai.
    if (saiu && (pedido.tipo === 'rolar' || pedido.tipo === 'rerolar' || (pedido.tipo === 'tecnica' && pedido.saida === 'rolar'))) setEsperando(true)
  }
  const golpeId = reacao.golpeId
  const overload = reacao.overload === true && golpeId !== null
  const surpresa = reacao.surpresa === true && golpeId !== null
  // Overload e Surpresa: no lugar do dado, o aviso (a técnica que vale contra eles fica na seção Usar técnica).
  const semDado = overload || surpresa
  const saidas = rolagem === undefined ? [] : saidasNaTela(rolagem, reacao.dano, reacao.semSaidas)
  // Passar só quando o dado liberou uma reação: no 1 natural e abaixo de 10 o único botão já é receber o golpe.
  const passar = rolagem === undefined || saidas.some((saida) => saida.saida === 'cheio' || saida.saida === 'critico') ? null : saidaDoPassar(rolagem.d20)
  const textoDoModificador = rolagem === undefined || rolagem.modificador === 0 ? '' : ` ${rolagem.modificador > 0 ? '+' : '−'} ${Math.abs(rolagem.modificador)}`

  // F2 (fatia B, o "perto" do Aplauso): a ficha dele rebate no lugar do alvo. Só a técnica: o dado e o Não reagir são do alvo.
  const por = reacao.por
  if (por !== undefined && golpeId !== null) {
    const alvo = reacao.alvo ?? 'um aliado'
    return (
      <>
        <p className="bt-reacao__texto">
          Perto de <b>{por.nome}</b>: <b>{reacao.atacante}</b> usa <b>{reacao.nome}</b> em <b>{alvo}</b>
          {reacao.dano === null ? '.' : <>: <b>{formatarNumero(reacao.dano)}</b> de dano.</>}
        </p>
        {reacao.tecnicas !== undefined && (
          <TecnicasDaReacao tecnicas={reacao.tecnicas} golpeId={golpeId} tokenId={reacao.tokenId} por={por.tokenId} atacante={reacao.atacante} dano={reacao.dano} modificadorInicial="" esperando={esperando} onPedir={pedir} />
        )}
        <div className="bt-reacao__pe">
          <span className="bt-reacao__regra">
            Rebater: {alvo} não toma o golpe e o dano volta em {reacao.atacante}. Se não quiser rebater, é só fechar.
          </span>
        </div>
        {erro !== null && (
          <p className="bt-form__erro" role="alert">
            {erro}
          </p>
        )}
      </>
    )
  }

  return (
    <>
      {golpeId === null ? (
        <p className="bt-reacao__texto">Reação livre: 1d20 + modificador, vai ao registro.</p>
      ) : (
        <p className="bt-reacao__texto">
          {reacao.alvo !== undefined && !sozinha && (
            <>
              <b>{reacao.alvo}</b> ·{' '}
            </>
          )}
          <b>{reacao.atacante}</b> usa <b>{reacao.nome}</b> em {reacao.alvo === undefined ? 'você' : reacao.alvo}
          {reacao.dano === null ? ' (sem dano).' : <>: <b>{formatarNumero(reacao.dano)}</b> de dano{textoDoPerfuranteNaCaixa(reacao, reacao.dano)}.</>}
        </p>
      )}
      {golpeId !== null && reacao.dano !== null && reacao.reducao !== undefined && <p className="bt-reacao__texto">Menos dano em {reacao.alvo ?? 'você'}: {reacao.reducao}. O app já desconta.</p>}
      <div className="bt-reacao__linha">
        <DadoDaReacao rolagem={rolagem} />
        <div className="bt-reacao__opcoes">
          {semDado && rolagem === undefined ? (
            <span className="bt-dado-rotulo">{overload ? TEXTO_DO_OVERLOAD : TEXTO_DA_SURPRESA}</span>
          ) : rolagem === undefined ? (
            <>
              <button ref={primeiro} type="button" className="bt-botao bt-botao--batalha" disabled={esperando} onClick={() => pedir({ tipo: 'rolar', golpeId, tokenId: reacao.tokenId, modificador, ...comDado })}>
                {esperando ? 'Rolando…' : dado === null ? 'Rolar 1d20' : 'Rolar 2d20'}
              </button>
              {/* D8: o dado em chips (nada de seletor nativo branco), como a mira. */}
              <fieldset id={idDoDado} className="bt-escolha bt-reacao__dado" disabled={esperando}>
                <legend>Dado</legend>
                <div className="bt-escolha__chips">
                  <label className="bt-escolha__chip">
                    <input type="radio" className="bt-sr" name={`${idDoDado}-modo`} checked={dado === null} onChange={() => setDado(null)} />
                    Normal: 1 dado
                  </label>
                  {VANTAGENS_DO_DADO.map((modo) => (
                    <label key={modo} className="bt-escolha__chip">
                      <input type="radio" className="bt-sr" name={`${idDoDado}-modo`} checked={dado === modo} onChange={() => setDado(modo)} />
                      {ROTULO_DO_DADO[modo]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="bt-mod">
                Modificador
                <input
                  className="bt-num"
                  inputMode="numeric"
                  value={modTexto}
                  placeholder="0"
                  aria-describedby={origem === '' ? undefined : idDaOrigem}
                  onChange={(evento) => setModTexto(evento.target.value)}
                  onKeyDown={
                    rolarComEnter
                      ? (evento) => {
                          if (evento.key !== 'Enter' || esperando) return
                          evento.preventDefault()
                          pedir({ tipo: 'rolar', golpeId, tokenId: reacao.tokenId, modificador, ...comDado })
                        }
                      : undefined
                  }
                />
                {origem !== '' && (
                  <small id={idDaOrigem} className="bt-mod__origem" title="Vem dos selos de quem reage; o campo segue editável">
                    <span className="bt-bonus" data-sinal={(reacao.bonus?.total ?? 0) < 0 ? 'menos' : 'mais'}>
                      {origem}
                    </span>
                  </small>
                )}
              </label>
            </>
          ) : golpeId === null ? (
            <span className="bt-dado-rotulo">
              Total {textoDoD20(rolagem)}
              {textoDoModificador} = {rolagem.total}
            </span>
          ) : (
            <>
              {saidas.map((saida, i) => (
                <button
                  key={saida.saida}
                  ref={i === 0 ? primeiro : undefined}
                  type="button"
                  className={i === 0 ? 'bt-botao bt-botao--batalha' : 'bt-botao'}
                  onClick={() => pedir({ tipo: 'escolher', golpeId, tokenId: reacao.tokenId, saida: saida.saida })}
                >
                  {rotuloDaSaida(saida.saida, saida.dano)}
                </button>
              ))}
              {passar !== null && (
                <button type="button" className="bt-botao" title="Toma o golpe inteiro sem usar a reação" onClick={() => pedir({ tipo: 'passar', golpeId, tokenId: reacao.tokenId })}>
                  {rotuloDaSaida(passar, reacao.dano === null ? null : danoFinal(reacao.dano, passar))}
                </button>
              )}
              <button type="button" className="bt-botao bt-botao--fantasma" disabled={esperando} onClick={() => pedir({ tipo: 'rerolar', golpeId, tokenId: reacao.tokenId, modificador, ...comDado })}>
                {esperando ? 'Rolando…' : 'Rolar de novo'}
              </button>
            </>
          )}
        </div>
      </div>
      {golpeId !== null && rolagem === undefined && reacao.tecnicas !== undefined && (
        <TecnicasDaReacao
          tecnicas={reacao.tecnicas}
          golpeId={golpeId}
          tokenId={reacao.tokenId}
          atacante={reacao.atacante}
          dano={reacao.dano}
          modificadorInicial={modTexto}
          esperando={esperando}
          onPedir={(pedido) => pedir(pedido.tipo === 'tecnica' && pedido.saida === 'rolar' ? { ...pedido, ...comDado } : pedido)}
        />
      )}
      <div className="bt-reacao__pe">
        <span className="bt-reacao__regra">
          {overload && rolagem === undefined
            ? 'Overload não erra: só uma técnica Overload defende. Sem ela, receba o golpe.'
            : surpresa && rolagem === undefined
            ? 'Surpresa não deixa reagir: só a técnica que vale contra ela defende. Sem ela, receba o golpe.'
            : rolagem === undefined
            ? '10+ defende (metade) · 15+ esquiva · 20 contra-ataca · 1 é falha crítica (×1,5). Conta o total.'
            : `d20 ${textoDoD20(rolagem)}${textoDoModificador} = ${rolagem.total} · ${TEXTO_DA_SAIDA[saidasDaRolagem(rolagem)[0] ?? 'cheio'].selo}`}
        </span>
        {golpeId !== null && (
          <span className="bt-reacao__pe-acoes">
            {/* R3 (lote de 01/11): o golpe não pegou na mesa: sem dano e sem selo, antes ou depois do dado; vai ao registro e o mestre desfaz. */}
            <button
              type="button"
              className="bt-botao bt-botao--p bt-botao--fantasma"
              disabled={esperando}
              title="O golpe não pega: sem dano, sem selo. Vai ao registro e o mestre pode desfazer."
              onClick={() => pedir({ tipo: 'semDano', golpeId, tokenId: reacao.tokenId })}
            >
              Passar sem tomar dano
            </button>
            {rolagem === undefined && (
              <button type="button" className="bt-botao bt-botao--p" onClick={() => pedir({ tipo: 'naoReagir', golpeId, tokenId: reacao.tokenId })}>
                Não reagir
              </button>
            )}
          </span>
        )}
      </div>
      {erro !== null && (
        <p className="bt-form__erro" role="alert">
          {erro}
        </p>
      )}
    </>
  )
}

function rotuloDaSaida(saida: SaidaDaReacao, dano: number | null): string {
  const nome = TEXTO_DA_SAIDA[saida].botao
  if (saida === 'contra') return `${nome} · 0 e ganha uma ação`
  if (dano === null) return nome
  return `${nome} · ${formatarNumero(dano)}`
}

export function CaixaDeReacao({ reacoes, onPedir, onFechar, rotuloDoFechar = 'Depois', conta, todas = reacoes, dica, rolarComEnter = false, focoNaCaixa = false, podeFocar }: CaixaDeReacaoProps) {
  const sozinha = reacoes.length === 1
  // T3: quem tinha o foco aqui dentro. A caixa que some com ele (a última reação resolvida pelo teclado) devolve o foco ao menu da vez.
  const ultimoFoco = useRef<Element | null>(null)
  const caixa = useRef<HTMLDivElement>(null)
  const vazia = reacoes.length === 0
  useEffect(() => {
    if (vazia) return
    return () => {
      const perdido = ultimoFoco.current !== null && !ultimoFoco.current.isConnected
      ultimoFoco.current = null
      if (perdido) devolverFocoAoMenu()
    }
  }, [vazia])
  // O Rolar 1d20 pega o foco no efeito da reação (que roda antes deste); sem ele (Overload, Surpresa), a própria caixa: o Esc
  // recolhe e o Tab entra nos botões, e nenhum Enter resolve o golpe sem querer.
  const chaveDaPrimeira = reacoes[0] === undefined ? null : chaveDaReacao(reacoes[0])
  useEffect(() => {
    const elemento = caixa.current
    if (!focoNaCaixa || elemento === null || elemento.contains(document.activeElement)) return
    if (podeFocar !== undefined && !podeFocar()) return
    elemento.focus({ preventScroll: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focoNaCaixa, chaveDaPrimeira])
  // O golpe Overload não rola (só outra Overload defende): fica fora do "Rolar todas".
  const naoRoladas = todas.filter((reacao) => reacao.rolagem === undefined && reacao.golpeId !== null && reacao.overload !== true && reacao.surpresa !== true)
  const teclar = (evento: KeyboardEvent<HTMLDivElement>) => {
    // A caixa não deixa a tecla virar atalho do mapa atrás dela.
    evento.stopPropagation()
    if (evento.key === 'Escape' && onFechar !== undefined) {
      evento.preventDefault()
      onFechar()
    }
  }
  if (reacoes.length === 0) return null
  const comPe = naoRoladas.length > 1 || onFechar !== undefined
  // A dica vai no pé, entre o "Rolar todas" e o recolher (uma linha a menos na tela baixa); sem pé, embaixo de tudo.
  const textoDaDica = dica === undefined ? null : <p className="bt-reacao__dica">{dica}</p>
  return (
    <div
      ref={caixa}
      className="bt-reacao"
      role="dialog"
      aria-label="Reação"
      tabIndex={focoNaCaixa ? -1 : undefined}
      onKeyDown={teclar}
      onFocus={(evento) => (ultimoFoco.current = evento.target)}
    >
      <div className="bt-reacao__topo">
        <h3 className="bt-reacao__titulo">REAÇÃO</h3>
        <span className="bt-reacao__conta">{conta ?? (sozinha ? '' : `${reacoes.length} golpes esperando`)}</span>
      </div>
      {sozinha ? (
        // A chave: a reação seguinte que toma o lugar nasce limpa (modificador, dado, "Rolando…") e pega o foco.
        <UmaReacao key={chaveDaReacao(reacoes[0] as ReacaoNaCaixa)} reacao={reacoes[0] as ReacaoNaCaixa} sozinha onPedir={onPedir} focar rolarComEnter={rolarComEnter} podeFocar={podeFocar} />
      ) : (
        <ul className="bt-reacao__lista">
          {reacoes.map((reacao, i) => (
            <li key={chaveDaReacao(reacao)} className="bt-reacao__item">
              <UmaReacao reacao={reacao} sozinha={false} onPedir={onPedir} focar={i === 0} rolarComEnter={rolarComEnter} podeFocar={podeFocar} />
            </li>
          ))}
        </ul>
      )}
      {comPe && (
        <div className="bt-reacao__pe">
          {naoRoladas.length > 1 ? (
            <button
              type="button"
              className="bt-botao bt-botao--batalha"
              onClick={() => {
                for (const reacao of naoRoladas) {
                  if (reacao.golpeId === null) continue
                  onPedir({ tipo: 'rolar', golpeId: reacao.golpeId, tokenId: reacao.tokenId, modificador: modificadorInicial(reacao.tokenId, reacao.bonus) })
                }
              }}
            >
              {/* No centro do mestre só uma está à vista: o número diz que o dado sai para a fila inteira. */}
              {todas === reacoes ? 'Rolar todas' : `Rolar todas (${naoRoladas.length})`}
            </button>
          ) : textoDaDica === null ? (
            <span />
          ) : null}
          {textoDaDica}
          {onFechar !== undefined && (
            <button type="button" className="bt-botao bt-botao--fantasma bt-botao--p" onClick={onFechar}>
              {rotuloDoFechar} <kbd>Esc</kbd>
            </button>
          )}
        </div>
      )}
      {!comPe && textoDaDica}
    </div>
  )
}
