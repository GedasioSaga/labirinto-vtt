import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { MODIFICADOR_DA_REACAO_MAX, PERFURACAO_MAX, type ParteDoBonus, type PedidoDeReacao, type RolagemDaReacao, type SaidaDaReacao } from '../../lib/batalha/combate'
import { danoFinal, divisaoDoDano, porcentagemQuePerfura, saidaDoPassar, saidasPossiveis } from '../../lib/batalha/reacao'
import type { ReacaoComTecnica } from '../../lib/batalha/reacaoComTecnica'
import { origemDoBonus } from './ContaComBonus'
import { formatarNumero, lerModificadorDaReacao, movimentoReduzido, saidasNaTela, TEXTO_DA_SAIDA } from './dadosDoMenu'
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
 * Com mais de um golpe esperando (o mestre, um por NPC atingido), uma linha
 * por golpe e "Rolar todas". Esc recolhe (o botão REAÇÃO reabre).
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
  rolagem?: RolagemDaReacao
  /** Tipos de habilidade F1: as técnicas de reação de quem reage (`reacoesParaOAlvo`); ausente ou vazia = sem a seção Usar técnica. */
  tecnicas?: readonly ReacaoComTecnica[]
  /** Tipos de habilidade F2: o "reacao" dos selos de quem reage: o total (`bonusDaReacao`) e as partes ("+3 (Foco)"). Ausente = nenhum. */
  bonus?: BonusDaReacaoNaTela
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
}

/** O modificador de reação lembrado por ficha durante a sessão (some ao recarregar a página). */
const modificadorLembrado = new Map<string, number>()
const PUNCH = 'cubic-bezier(0.34, 1.56, 0.64, 1)'
const NUMEROS_DO_GIRO = 8
const PASSO_DO_GIRO_MS = 48

function chaveDa(reacao: ReacaoNaCaixa): string {
  return `${reacao.golpeId ?? 'livre'}:${reacao.tokenId}`
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

  const saida = rolagem === undefined || mostrado !== String(rolagem.d20) ? undefined : saidasPossiveis(rolagem.d20, rolagem.total)[0]
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
}: {
  reacao: ReacaoNaCaixa
  sozinha: boolean
  onPedir: (pedido: PedidoDeReacao) => boolean
  focar: boolean
}) {
  const [modTexto, setModTexto] = useState(() => {
    const inicial = modificadorInicial(reacao.tokenId, reacao.bonus)
    return inicial === 0 ? '' : String(inicial)
  })
  const origem = reacao.bonus === undefined ? '' : origemDoBonus(reacao.bonus.partes)
  const idDaOrigem = useId()
  const [esperando, setEsperando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
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
    if (focar) primeiro.current?.focus({ preventScroll: true })
  }, [focar, chaveDaRolagem])

  const modificador = lerModificadorDaReacao(modTexto)
  const pedir = (pedido: PedidoDeReacao) => {
    if (esperando) return
    // Só a parte à mão fica lembrada: o bônus do selo volta sozinho enquanto o selo existir.
    modificadorLembrado.set(reacao.tokenId, modificador - (reacao.bonus?.total ?? 0))
    const saiu = onPedir(pedido)
    setErro(saiu ? null : 'Não saiu: sem conexão com o mestre. Tente de novo.')
    // Só o dado espera a volta do host (também a técnica que rola); escolher, Passar, Não reagir e a técnica sem dado resolvem e a caixa sai.
    if (saiu && (pedido.tipo === 'rolar' || pedido.tipo === 'rerolar' || (pedido.tipo === 'tecnica' && pedido.saida === 'rolar'))) setEsperando(true)
  }
  const golpeId = reacao.golpeId
  const saidas = rolagem === undefined ? [] : saidasNaTela(rolagem.d20, rolagem.total, reacao.dano)
  // Passar só quando o dado liberou uma reação: no 1 natural e abaixo de 10 o único botão já é receber o golpe.
  const passar = rolagem === undefined || saidas.some((saida) => saida.saida === 'cheio' || saida.saida === 'critico') ? null : saidaDoPassar(rolagem.d20)
  const textoDoModificador = rolagem === undefined || rolagem.modificador === 0 ? '' : ` ${rolagem.modificador > 0 ? '+' : '−'} ${Math.abs(rolagem.modificador)}`

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
      <div className="bt-reacao__linha">
        <DadoDaReacao rolagem={rolagem} />
        <div className="bt-reacao__opcoes">
          {rolagem === undefined ? (
            <>
              <button ref={primeiro} type="button" className="bt-botao bt-botao--batalha" disabled={esperando} onClick={() => pedir({ tipo: 'rolar', golpeId, tokenId: reacao.tokenId, modificador })}>
                {esperando ? 'Rolando…' : 'Rolar 1d20'}
              </button>
              <label className="bt-mod">
                Modificador
                <input
                  className="bt-num"
                  inputMode="numeric"
                  value={modTexto}
                  placeholder="0"
                  aria-describedby={origem === '' ? undefined : idDaOrigem}
                  onChange={(evento) => setModTexto(evento.target.value)}
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
              Total {rolagem.d20}
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
              <button type="button" className="bt-botao bt-botao--fantasma" disabled={esperando} onClick={() => pedir({ tipo: 'rerolar', golpeId, tokenId: reacao.tokenId, modificador })}>
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
          onPedir={pedir}
        />
      )}
      <div className="bt-reacao__pe">
        <span className="bt-reacao__regra">
          {rolagem === undefined
            ? '10+ defende (metade) · 15+ esquiva · 20 contra-ataca · 1 é falha crítica (×1,5). Conta o total.'
            : `d20 ${rolagem.d20}${textoDoModificador} = ${rolagem.total} · ${TEXTO_DA_SAIDA[saidasPossiveis(rolagem.d20, rolagem.total)[0] ?? 'cheio'].selo}`}
        </span>
        {golpeId !== null && rolagem === undefined && (
          <button type="button" className="bt-botao bt-botao--p" onClick={() => pedir({ tipo: 'naoReagir', golpeId, tokenId: reacao.tokenId })}>
            Não reagir
          </button>
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

export function CaixaDeReacao({ reacoes, onPedir, onFechar }: CaixaDeReacaoProps) {
  const sozinha = reacoes.length === 1
  const naoRoladas = reacoes.filter((reacao) => reacao.rolagem === undefined && reacao.golpeId !== null)
  const teclar = (evento: KeyboardEvent<HTMLDivElement>) => {
    // A caixa não deixa a tecla virar atalho do mapa atrás dela.
    evento.stopPropagation()
    if (evento.key === 'Escape' && onFechar !== undefined) {
      evento.preventDefault()
      onFechar()
    }
  }
  if (reacoes.length === 0) return null
  return (
    <div className="bt-reacao" role="dialog" aria-label="Reação" onKeyDown={teclar}>
      <div className="bt-reacao__topo">
        <h3 className="bt-reacao__titulo">REAÇÃO</h3>
        <span className="bt-reacao__conta">{sozinha ? '' : `${reacoes.length} golpes esperando`}</span>
      </div>
      {sozinha ? (
        <UmaReacao reacao={reacoes[0] as ReacaoNaCaixa} sozinha onPedir={onPedir} focar />
      ) : (
        <ul className="bt-reacao__lista">
          {reacoes.map((reacao, i) => (
            <li key={chaveDa(reacao)} className="bt-reacao__item">
              <UmaReacao reacao={reacao} sozinha={false} onPedir={onPedir} focar={i === 0} />
            </li>
          ))}
        </ul>
      )}
      {(naoRoladas.length > 1 || onFechar !== undefined) && (
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
              Rolar todas
            </button>
          ) : (
            <span />
          )}
          {onFechar !== undefined && (
            <button type="button" className="bt-botao bt-botao--fantasma bt-botao--p" onClick={onFechar}>
              Depois <kbd>Esc</kbd>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
