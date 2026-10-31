import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from 'react'
import {
  ALVOS_MAX,
  CUSTO_MAX,
  DANO_MAX,
  MULTIPLICADOR_DA_SURPRESA,
  NOME_DO_SELO_MAX,
  TURNOS_DO_SELO_MAX,
  type AcaoDaTecnica,
  type PedidoDeAcao,
  type PedidoDeAlvo,
  type SeloPedido,
} from '../../lib/batalha/combate'
import { ehNomeDeSelo, textoDoSelo } from '../../lib/batalha/selos'
import { iniciais } from '../FichaPecas'
import { useImagemDaMesa } from '../ImagemDaMesa'
import { contaDoGolpe, formatarNumero, lerInteiro, textoDaAcao, type AlvoNaMira, type GolpeNaTela } from './dadosDoMenu'
import './batalha.css'
import './combate.css'

/**
 * A MIRA DO GOLPE (o `.menu--alvo` e o `.mira` do protótipo aprovado): os
 * alvos que ele vê, na ordem (Espaço ou clique marca vários; clicar na ficha
 * no mapa também, S4), o dano que chega em cada um, editável, com a conta ao
 * lado ("205 × 2 concentração = 410"; "editado" quando mudou), o custo
 * perguntado quando a ficha não diz, a ação perguntada quando a ficha não diz,
 * Surpresa (×1,5, sem reação), Perfurante (Q4), a nota da reação e Lançar.
 * F3: o selo que a técnica sugere ("por 1 turno" = "Selo: Atordoado · 1
 * turno") vem marcado, com nome e turnos editáveis e o desmarcar; pega só no
 * alvo que o golpe acerta (Q6).
 *
 * Esc volta à lista; Enter num campo lança.
 */

/** S4: a posição da ficha na tela (coordenadas da janela), pela câmera; `null` = fora da tela. */
export type ConsultaDaFicha = (tokenId: string) => { x: number; y: number; raio: number } | null

/** O que a mira devolve para virar `PedidoDeAcao`. */
export interface EscolhaDaMira {
  alvos: PedidoDeAlvo[]
  surpresa: boolean
  perfurante: boolean
  /** O custo confirmado; `null` = o da ficha. */
  custo: number | null
  /** A ação escolhida; `null` = a da ficha. */
  acao: AcaoDaTecnica | null
  /** F3: o selo sugerido, se ficou marcado (editado ou não); `null` = sem selo. */
  selo: SeloPedido | null
}

/** O pedido de um golpe da mira (o mesmo no menu do jogador e no painel do NPC). */
export function pedidoDoGolpe(golpe: GolpeNaTela, escolha: EscolhaDaMira): PedidoDeAcao {
  const selo = escolha.selo === null ? {} : { selo: escolha.selo }
  if (golpe.tipo === 'atacar') return { tipo: 'atacar', armaId: golpe.armaId, alvos: escolha.alvos, surpresa: escolha.surpresa, perfurante: escolha.perfurante, ...selo }
  return {
    tipo: 'habilidade',
    cartaoId: golpe.cartaoId ?? '',
    armaId: golpe.armaId,
    alvos: escolha.alvos,
    surpresa: escolha.surpresa,
    perfurante: escolha.perfurante,
    custo: escolha.custo,
    acao: escolha.acao,
    ...selo,
  }
}

/** "1 turno", "2 turnos", "até tirar". */
function textoDosTurnos(turnos: number | null): string {
  return turnos === null ? 'até tirar' : `${turnos} ${turnos === 1 ? 'turno' : 'turnos'}`
}

export interface MiraDoGolpeProps {
  golpe: GolpeNaTela
  carga: number
  alvos: readonly AlvoNaMira[]
  /** A ficha clicada no mapa (S4); `seq` muda a cada clique, mesmo na mesma ficha. */
  alvoDoMapa?: { tokenId: string; seq: number } | null
  /** `false` = não saiu (a mira continua, com o aviso). */
  onLancar: (escolha: EscolhaDaMira) => boolean
  onVoltar: () => void
  /** As marcas sobre as fichas do mapa. */
  consulta?: ConsultaDaFicha | null
  /** Contra-ataque (Q6): sem Surpresa. */
  contra?: boolean
  /** O alvo já marcado ao abrir (a sugestão do NPC); ausente = o primeiro de outra equipe. */
  alvoInicial?: string | null
  /** "Executar" no mestre. */
  rotuloDoLancar?: string
  /** O painel do mestre não tem para onde voltar. */
  semVoltar?: boolean
  /** O mestre liga "Escolher no mapa" à mão (com ele ligado, o clique no mapa só mira). */
  mapa?: { ligado: boolean; onTrocar: (ligado: boolean) => void }
}

const ACOES_PERGUNTADAS: readonly AcaoDaTecnica[] = ['simples', 'completa', 'bonus', 'livre']
const NOTA_DA_REACAO = 'O alvo rola 1d20 para reagir: 10+ defende (metade), 15+ esquiva, 20 contra-ataca; 1 é crítico (×1,5).'

function primeiroAlvo(alvos: readonly AlvoNaMira[]): string | null {
  const validos = alvos.filter((alvo) => !alvo.motivo)
  return (validos.find((alvo) => alvo.lado === 'outro' && !alvo.caiu) ?? validos.find((alvo) => !alvo.caiu))?.tokenId ?? null
}

export function MiraDoGolpe({ golpe, carga, alvos, alvoDoMapa, onLancar, onVoltar, consulta, contra, alvoInicial, rotuloDoLancar, semVoltar, mapa }: MiraDoGolpeProps) {
  const idBase = useId()
  const [marcados, setMarcados] = useState<readonly string[]>(() => {
    const sugerido = alvoInicial !== undefined && alvoInicial !== null && alvos.some((alvo) => alvo.tokenId === alvoInicial && !alvo.motivo) ? alvoInicial : null
    const primeiro = sugerido ?? (alvoInicial === undefined ? primeiroAlvo(alvos) : null)
    return primeiro === null ? [] : [primeiro]
  })
  const [foco, setFoco] = useState<string | null>(() => marcados[0] ?? null)
  const [baseTexto, setBaseTexto] = useState(golpe.dano.valor === null ? '' : String(golpe.dano.valor))
  const [editados, setEditados] = useState<Readonly<Record<string, string>>>({})
  const [surpresa, setSurpresa] = useState(false)
  const [perfurante, setPerfurante] = useState(golpe.perfurante)
  const [custoTexto, setCustoTexto] = useState(golpe.custo.tipo === 'pergunta' && golpe.custo.sugestao !== null ? String(golpe.custo.sugestao) : '')
  const [acao, setAcao] = useState<AcaoDaTecnica | ''>('')
  // F3: o selo sugerido começa marcado; desmarcar tira do golpe.
  const sugerido = golpe.selo ?? null
  const [comSelo, setComSelo] = useState(sugerido !== null)
  const [seloNome, setSeloNome] = useState(sugerido?.nome ?? '')
  const [seloTurnos, setSeloTurnos] = useState(sugerido?.turnos === null || sugerido === null ? '' : String(sugerido.turnos))
  const [erro, setErro] = useState<string | null>(null)
  const caixas = useRef<Map<string, HTMLInputElement>>(new Map())

  // S4: clicar numa ficha no mapa marca ou desmarca o alvo.
  const ultimoSeq = useRef(alvoDoMapa?.seq ?? -1)
  useEffect(() => {
    if (alvoDoMapa === null || alvoDoMapa === undefined || alvoDoMapa.seq === ultimoSeq.current) return
    ultimoSeq.current = alvoDoMapa.seq
    if (!alvos.some((alvo) => alvo.tokenId === alvoDoMapa.tokenId)) return
    setFoco(alvoDoMapa.tokenId)
    setMarcados((antes) => (antes.includes(alvoDoMapa.tokenId) ? antes.filter((id) => id !== alvoDoMapa.tokenId) : [...antes, alvoDoMapa.tokenId].slice(-ALVOS_MAX)))
  }, [alvoDoMapa, alvos])

  const semDano = golpe.dano.semDano
  const base = semDano ? null : lerInteiro(baseTexto, DANO_MAX)
  const comSurpresa = surpresa && !contra
  const semReacao = comSurpresa || golpe.overload

  /** A BASE do alvo (a store aplica concentração e Surpresa): a editada, ou a do golpe. */
  const baseDe = (tokenId: string): number | null => {
    if (semDano) return null
    const editado = editados[tokenId]
    return editado === undefined ? base : lerInteiro(editado, DANO_MAX)
  }

  const alternar = (tokenId: string) => {
    if (alvos.find((alvo) => alvo.tokenId === tokenId)?.motivo) return
    setErro(null)
    setMarcados((antes) => (antes.includes(tokenId) ? antes.filter((id) => id !== tokenId) : [...antes, tokenId].slice(-ALVOS_MAX)))
  }

  const lancar = (evento?: FormEvent) => {
    evento?.preventDefault()
    if (marcados.length === 0) {
      setErro('Escolha ao menos um alvo (clique na ficha no mapa ou marque na lista).')
      return
    }
    const pedidoDeAlvos: PedidoDeAlvo[] = []
    for (const tokenId of marcados) {
      const dano = baseDe(tokenId)
      if (!semDano && dano === null) {
        setErro('Digite o dano: a ficha não dá um número para este golpe.')
        return
      }
      pedidoDeAlvos.push({ tokenId, dano })
    }
    let custo: number | null = null
    if (golpe.custo.tipo === 'pergunta') {
      custo = lerInteiro(custoTexto, CUSTO_MAX)
      if (custo === null) {
        setErro(`Confirme o custo: ${golpe.custo.texto}`)
        return
      }
    }
    if (golpe.acao === null && acao === '') {
      setErro('A ficha não diz a ação: escolha Simples, Completa, Bônus ou Livre.')
      return
    }
    let selo: SeloPedido | null = null
    if (sugerido !== null && comSelo) {
      const nome = seloNome.trim()
      if (!ehNomeDeSelo(nome)) {
        setErro(`Dê um nome ao selo (até ${NOME_DO_SELO_MAX} letras), ou desmarque o selo.`)
        return
      }
      const turnos = seloTurnos.trim() === '' ? null : lerInteiro(seloTurnos, TURNOS_DO_SELO_MAX)
      if (seloTurnos.trim() !== '' && (turnos === null || turnos < 1)) {
        setErro(`Os turnos do selo vão de 1 a ${TURNOS_DO_SELO_MAX} (vazio = até tirar).`)
        return
      }
      selo = { nome, turnos }
    }
    const saiu = onLancar({ alvos: pedidoDeAlvos, surpresa: comSurpresa, perfurante: !semDano && perfurante, custo, acao: golpe.acao === null && acao !== '' ? acao : null, selo })
    if (!saiu) setErro('O golpe não saiu: sem conexão com o mestre, ou a vez já passou. Tente de novo.')
  }

  const teclar = (evento: KeyboardEvent<HTMLFormElement>) => {
    if (evento.key === 'Escape') {
      evento.preventDefault()
      evento.stopPropagation()
      onVoltar()
      return
    }
    // Setas trocam o alvo em foco na lista (Espaço marca).
    const alvo = evento.target instanceof HTMLInputElement && evento.target.type === 'checkbox' ? evento.target.dataset.alvo : undefined
    if (alvo === undefined || (evento.key !== 'ArrowDown' && evento.key !== 'ArrowUp')) return
    evento.preventDefault()
    const i = alvos.findIndex((candidato) => candidato.tokenId === alvo)
    const proximo = alvos[(i + (evento.key === 'ArrowDown' ? 1 : -1) + alvos.length) % alvos.length]
    if (proximo !== undefined) caixas.current.get(proximo.tokenId)?.focus()
  }

  const marcadosSet = useMemo(() => new Set(marcados), [marcados])
  const verbo = rotuloDoLancar ?? 'Lançar'
  const textoDoLancar = marcados.length > 1 ? `${verbo} em ${marcados.length} alvos` : verbo

  return (
    <>
      <form className="bt-mira bt-papel" onSubmit={lancar} onKeyDown={teclar} aria-labelledby={`${idBase}-nome`} noValidate>
        <p className="bt-mira__rot">{contra ? 'Contra-ataque · mira' : 'Mira'}</p>
        <h3 className="bt-mira__nome" id={`${idBase}-nome`}>
          {golpe.nome}
        </h3>
        {!semDano && (
          <label className="bt-linha-campo">
            <span>Dano base</span>
            <input
              className="bt-num"
              inputMode="numeric"
              value={baseTexto}
              aria-invalid={base === null ? true : undefined}
              onChange={(evento) => {
                setErro(null)
                setBaseTexto(evento.target.value)
              }}
            />
            <small className="bt-mira__nota">{golpe.dano.conta}</small>
          </label>
        )}
        <fieldset className="bt-mira__alvos">
          <legend>{alvos.length === 0 ? 'Nenhuma ficha à vista para mirar' : 'Alvos · Espaço marca, setas trocam, clique na ficha no mapa'}</legend>
          {alvos.map((alvo) => {
            const marcado = marcadosSet.has(alvo.tokenId)
            const baseDoAlvo = marcado ? baseDe(alvo.tokenId) : null
            const conta = baseDoAlvo === null ? null : contaDoGolpe(baseDoAlvo, carga, comSurpresa)
            const editado = editados[alvo.tokenId] !== undefined
            return (
              <div key={alvo.tokenId} className="bt-alvo" data-apagado={alvo.motivo ? 'sim' : undefined}>
                <input
                  ref={(elemento) => {
                    if (elemento === null) caixas.current.delete(alvo.tokenId)
                    else caixas.current.set(alvo.tokenId, elemento)
                  }}
                  id={`${idBase}-${alvo.tokenId}`}
                  type="checkbox"
                  data-alvo={alvo.tokenId}
                  checked={marcado}
                  disabled={Boolean(alvo.motivo)}
                  onChange={() => alternar(alvo.tokenId)}
                  onFocus={() => setFoco(alvo.tokenId)}
                />
                <label className="bt-alvo__nome" htmlFor={`${idBase}-${alvo.tokenId}`}>
                  <MiniaturaDoAlvo imagem={alvo.imagem} nome={alvo.nome} cor={alvo.cor} caiu={alvo.caiu} />
                  <span className="bt-alvo__texto">
                    {alvo.nome} {alvo.lado !== 'outro' && <small>{alvo.lado === 'eu' ? '· você' : '· aliado'}</small>}
                    {alvo.caiu && <small> · caiu</small>}
                    {alvo.motivo && <small> · {alvo.motivo}</small>}
                  </span>
                </label>
                {marcado && !semDano ? (
                  <span className="bt-alvo__dano">
                    <input
                      className="bt-num"
                      inputMode="numeric"
                      aria-label={`Dano base em ${alvo.nome}`}
                      value={editados[alvo.tokenId] ?? baseTexto}
                      aria-invalid={baseDoAlvo === null ? true : undefined}
                      onChange={(evento) => {
                        setErro(null)
                        const texto = evento.target.value
                        setEditados((antes) => ({ ...antes, [alvo.tokenId]: texto }))
                      }}
                    />
                  </span>
                ) : (
                  <span />
                )}
                {marcado && !semDano && (
                  <span className="bt-alvo__conta">
                    {editado ? (
                      <>
                        <em>editado</em>
                        {conta !== null && ` · chega ${conta.conta}`}{' '}
                        <button
                          type="button"
                          className="bt-botao bt-botao--fantasma bt-botao--p"
                          onClick={() =>
                            setEditados((antes) => {
                              const { [alvo.tokenId]: _fora, ...resto } = antes
                              return resto
                            })
                          }
                        >
                          Voltar à conta
                        </button>
                      </>
                    ) : conta === null ? (
                      'Digite o dano base'
                    ) : (
                      `chega ${conta.conta}`
                    )}
                  </span>
                )}
              </div>
            )
          })}
        </fieldset>
        {golpe.custo.tipo === 'pergunta' && (
          <label className="bt-linha-campo">
            <span>Custo ({golpe.custo.recurso.toUpperCase()})</span>
            <input className="bt-num" inputMode="numeric" value={custoTexto} onChange={(evento) => setCustoTexto(evento.target.value)} />
            <small className="bt-mira__nota">A ficha diz: {golpe.custo.texto}</small>
          </label>
        )}
        {golpe.acao === null && (
          <label className="bt-linha-campo">
            <span>Ação</span>
            <select value={acao} onChange={(evento) => setAcao(evento.target.value as AcaoDaTecnica | '')}>
              <option value="">A ficha não diz: escolha</option>
              {ACOES_PERGUNTADAS.map((opcao) => (
                <option key={opcao} value={opcao}>
                  {textoDaAcao(opcao)}
                </option>
              ))}
            </select>
          </label>
        )}
        {!semDano && (
          <div className="bt-npc__chaves">
            {!contra && (
              <label className="bt-chave">
                <input type="checkbox" role="switch" checked={surpresa} onChange={(evento) => setSurpresa(evento.target.checked)} />
                <span className="bt-chave__trilho" aria-hidden="true" />
                Surpresa <small>×{formatarNumero(MULTIPLICADOR_DA_SURPRESA)}, sem reação</small>
              </label>
            )}
            <label className="bt-chave">
              <input type="checkbox" role="switch" checked={perfurante} onChange={(evento) => setPerfurante(evento.target.checked)} />
              <span className="bt-chave__trilho" aria-hidden="true" />
              Perfurante <small>direto no HP, sem gastar o Escudo</small>
            </label>
          </div>
        )}
        {sugerido !== null && (
          <div className="bt-mira__selo" data-marcado={comSelo ? 'sim' : 'nao'}>
            <label className="bt-chave">
              <input
                type="checkbox"
                role="switch"
                checked={comSelo}
                onChange={(evento) => {
                  setErro(null)
                  setComSelo(evento.target.checked)
                }}
              />
              <span className="bt-chave__trilho" aria-hidden="true" />
              Selo: {seloNome.trim() || sugerido.nome} · {textoDosTurnos(seloTurnos.trim() === '' ? null : lerInteiro(seloTurnos, TURNOS_DO_SELO_MAX))}
              <small>sugerido pela técnica; pega só se o golpe acertar</small>
            </label>
            {comSelo && (
              <div className="bt-mira__selo-campos">
                <label className="bt-linha-campo">
                  <span>Nome</span>
                  <input
                    className="bt-num bt-num--texto"
                    maxLength={NOME_DO_SELO_MAX}
                    value={seloNome}
                    aria-invalid={ehNomeDeSelo(seloNome.trim()) ? undefined : true}
                    onChange={(evento) => {
                      setErro(null)
                      setSeloNome(evento.target.value)
                    }}
                  />
                </label>
                <label className="bt-linha-campo">
                  <span>Turnos</span>
                  <input
                    className="bt-num"
                    inputMode="numeric"
                    value={seloTurnos}
                    placeholder="até tirar"
                    onChange={(evento) => {
                      setErro(null)
                      setSeloTurnos(evento.target.value)
                    }}
                  />
                  <small className="bt-mira__nota">vazio = até o mestre tirar</small>
                </label>
              </div>
            )}
            {!comSelo && <span className="bt-sr">{`Selo ${textoDoSelo(sugerido)} desmarcado: o golpe não põe selo.`}</span>}
          </div>
        )}
        <p className="bt-mira__nota">{semReacao ? (golpe.overload ? 'Overload: o alvo não reage.' : 'Surpresa: o alvo não reage.') : NOTA_DA_REACAO}</p>
        {erro !== null && (
          <p className="bt-mira__erro" role="alert">
            {erro}
          </p>
        )}
        <div className="bt-pendente__acoes">
          <button type="submit" className="bt-botao bt-botao--batalha">
            {textoDoLancar} <kbd>Enter</kbd>
          </button>
          {mapa !== undefined && (
            <button type="button" className="bt-botao" aria-pressed={mapa.ligado} onClick={() => mapa.onTrocar(!mapa.ligado)}>
              {mapa.ligado ? 'Clique na ficha no mapa…' : 'Escolher no mapa'}
            </button>
          )}
          {!semVoltar && (
            <button type="button" className="bt-botao" onClick={onVoltar}>
              Voltar <kbd>Esc</kbd>
            </button>
          )}
        </div>
      </form>
      {consulta !== undefined && consulta !== null && <MarcasDaMira consulta={consulta} tokenIds={alvos.map((alvo) => alvo.tokenId)} marcados={marcadosSet} foco={foco} />}
    </>
  )
}

/**
 * A miniatura redonda do alvo, à esquerda do nome: a foto (forma, token ou
 * retrato, pelo resolvedor da tela) ou, sem ela, as iniciais no disco da cor
 * da equipe, no anel da mesma cor. Foto que não carrega volta às iniciais.
 * Decorativa (o nome já está no rótulo): fica fora da leitura de tela.
 */
function MiniaturaDoAlvo({ imagem, nome, cor, caiu }: { imagem: string | null | undefined; nome: string; cor: string | null | undefined; caiu: boolean }) {
  const src = useImagemDaMesa()(imagem)
  const [falhou, setFalhou] = useState<string | null>(null)
  const estilo = cor ? ({ '--lado': cor } as CSSProperties) : undefined
  return (
    <span className="bt-alvo__foto" style={estilo} data-caiu={caiu ? 'sim' : undefined} aria-hidden="true">
      {src !== null && falhou !== src ? <img src={src} alt="" draggable={false} onError={() => setFalhou(src)} /> : <span className="bt-alvo__iniciais">{iniciais(nome)}</span>}
    </span>
  )
}

/**
 * As marcas da mira sobre as fichas do mapa (S4): anel em quem pode ser alvo,
 * anel de papel em quem está marcado. A câmera anda: a posição é relida a
 * cada quadro enquanto a mira está aberta (poucas fichas, só transform).
 */
export function MarcasDaMira({ consulta, tokenIds, marcados, foco }: { consulta: ConsultaDaFicha; tokenIds: readonly string[]; marcados: ReadonlySet<string>; foco: string | null }) {
  const camada = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let quadro = 0
    const desenhar = () => {
      const raiz = camada.current
      if (raiz !== null) {
        for (const marca of Array.from(raiz.children) as HTMLElement[]) {
          const posicao = consulta(marca.dataset.alvo ?? '')
          if (posicao === null) {
            marca.style.opacity = '0'
            continue
          }
          const lado = posicao.raio * 2 + 12
          marca.style.opacity = '1'
          marca.style.width = `${lado}px`
          marca.style.height = `${lado}px`
          marca.style.transform = `translate(${posicao.x - lado / 2}px, ${posicao.y - lado / 2}px)`
        }
      }
      quadro = window.requestAnimationFrame(desenhar)
    }
    quadro = window.requestAnimationFrame(desenhar)
    return () => window.cancelAnimationFrame(quadro)
  }, [consulta])
  return (
    <div ref={camada} className="bt-marcas-da-mira" aria-hidden="true">
      {tokenIds.map((tokenId) => (
        <span key={tokenId} className="bt-marca-mira" data-alvo={tokenId} data-foco={marcados.has(tokenId) || foco === tokenId ? 'sim' : 'nao'} style={{ opacity: 0 }} />
      ))}
    </div>
  )
}
