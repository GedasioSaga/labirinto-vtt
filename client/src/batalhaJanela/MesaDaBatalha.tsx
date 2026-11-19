import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as TeclaDoReact, type ReactNode } from 'react'
import { iniciais } from '../components/FichaPecas'
import { Botao } from '../components/grimorio/Botao'
import type { AlvoNoEspelho, CartaNoEspelho, EspelhoDaBatalha, GolpeNoEspelho, PedidoDaMesa, PendenteNoEspelho, RecursoNoEspelho, RespostaDaMesa, VezNoEspelho } from './tipos'
import './mesaDaBatalha.css'

/**
 * A TELA DA MESA DA BATALHA, a mesma no diálogo do app e na janela à parte.
 * Lê só o espelho e manda pedidos (`enviar`); não sabe de store nem de fio.
 *
 * O olho lê nesta ordem: de quem é a vez (o nome grande no meio), o que ele
 * pode fazer e em quem, quem espera resposta (com o tempo), a ordem à
 * esquerda e o registro à direita. O pé tem Desfazer, Encerrar e Passar a
 * vez, sempre no mesmo lugar.
 */

export interface MesaDaBatalhaProps {
  espelho: EspelhoDaBatalha | null
  enviar: (pedido: PedidoDaMesa) => Promise<RespostaDaMesa>
  /** Os botões do topo de quem monta (Abrir em janela, Trazer para o app, Fechar). */
  acoesDoTopo?: ReactNode
  /** Presente = a fonte sumiu (a janela sem a principal): a frase no alto e tudo desligado. */
  semFonte?: string | null
  /** Ctrl+Z vale na página inteira (a janela à parte); sem isto, só com o foco dentro da mesa. */
  teclasNaPagina?: boolean
}

const NOME_DO_SISTEMA = { op: 'One Piece', dbt: 'Dragon Ball' } as const

function emCampoDeTexto(alvo: EventTarget | null): boolean {
  if (!(alvo instanceof HTMLElement)) return false
  return alvo.isContentEditable || alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.tagName === 'SELECT'
}

/** "há 8 s", "há 3 min". */
function haQuanto(desde: number, agora: number): string {
  const segundos = Math.max(0, Math.round((agora - desde) / 1000))
  if (segundos < 60) return `há ${segundos} s`
  const minutos = Math.floor(segundos / 60)
  return minutos < 60 ? `há ${minutos} min` : `há ${Math.floor(minutos / 60)} h`
}

/** O relógio da tela, de segundo em segundo, só enquanto alguém espera. */
function useAgora(ligado: boolean): number {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    if (!ligado) return
    setAgora(Date.now())
    const id = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [ligado])
  return agora
}

function Barras({ recursos, rotulo }: { recursos: readonly RecursoNoEspelho[]; rotulo: string }) {
  if (recursos.length === 0) return null
  return (
    <ul className="mb-barras" aria-label={rotulo}>
      {recursos.map((recurso) => {
        const parte = recurso.maximo <= 0 ? 0 : Math.max(0, Math.min(1, recurso.atual / recurso.maximo))
        return (
          <li key={recurso.rotulo} className="mb-barra" data-tom={recurso.tom}>
            <span className="mb-barra__rotulo">{recurso.rotulo}</span>
            <span className="mb-barra__trilho" aria-hidden="true">
              <span className="mb-barra__cheio" style={{ transform: `scaleX(${parte})` }} />
            </span>
            <span className="mb-barra__num">
              {recurso.atual}
              <small>/{recurso.maximo}</small>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function Carta({ carta, ocupado, onDarVez }: { carta: CartaNoEspelho; ocupado: boolean; onDarVez: () => void }) {
  const estilo = carta.cor === null ? undefined : ({ '--mb-lado': carta.cor } as CSSProperties)
  return (
    <li className="mb-carta" data-vez={carta.vez ? 'sim' : undefined} data-caiu={carta.caiu ? 'sim' : undefined} aria-current={carta.vez ? 'step' : undefined}>
      <span className="mb-carta__marca" style={estilo} aria-hidden="true">
        {iniciais(carta.nome)}
      </span>
      <span className="mb-carta__corpo">
        <span className="mb-carta__nome">
          {carta.nome}
          {carta.vez && <span className="mb-sr"> (a vez)</span>}
          {carta.proxima && <span className="mb-carta__depois">depois</span>}
        </span>
        <small className="mb-carta__sub">
          {[carta.npc ? 'NPC' : 'Jogador', carta.lado, carta.iniciativa === null ? null : `Iniciativa ${carta.iniciativa}`, carta.caiu ? 'caiu' : null].filter(Boolean).join(' · ')}
        </small>
        <Barras recursos={carta.recursos} rotulo={`Recursos de ${carta.nome}`} />
        {carta.marcas.length > 0 && (
          <span className="mb-pilulas">
            {carta.marcas.map((marca, indice) => (
              <span key={`${marca}-${indice}`} className="mb-pilula">
                {marca}
              </span>
            ))}
          </span>
        )}
      </span>
      {!carta.vez && (
        <button type="button" className="mb-carta__dar" disabled={ocupado} onClick={onDarVez} aria-label={`Dar a vez a ${carta.nome}`}>
          Dar a vez
        </button>
      )}
    </li>
  )
}

interface VezProps {
  vez: VezNoEspelho
  ocupado: string | null
  desligado: boolean
  onAgir: (golpe: GolpeNoEspelho, alvos: readonly string[]) => void
}

function alvosDoGolpe(golpe: GolpeNoEspelho | null, alvos: readonly AlvoNoEspelho[]): AlvoNoEspelho[] {
  if (golpe === null || golpe.alvo === 'nenhum') return []
  const permitidos = golpe.alvosPermitidos === null ? null : new Set(golpe.alvosPermitidos)
  return alvos.filter((alvo) => alvo.motivo === null && (permitidos === null || permitidos.has(alvo.id)))
}

const executavel = (golpe: GolpeNoEspelho) => golpe.motivo === null && golpe.noMapa === null

/** O combatente da vez: as ações dele, os alvos e o Executar. Remontado a cada vez nova (a escolha não passa de uma vez à outra). */
function VezDaMesa({ vez, ocupado, desligado, onAgir }: VezProps) {
  const idDosGolpes = useId()
  const idDosAlvos = useId()
  const [escolhido, setEscolhido] = useState<string | null>(() => {
    const sugerido = vez.golpes.find((golpe) => golpe.chave === vez.sugestao.golpe && executavel(golpe))
    return (sugerido ?? vez.golpes.find(executavel))?.chave ?? null
  })
  const golpe = vez.golpes.find((candidato) => candidato.chave === escolhido) ?? null
  const possiveis = useMemo(() => alvosDoGolpe(golpe, vez.alvos), [golpe, vez.alvos])
  const [marcados, setMarcados] = useState<readonly string[]>(() => (vez.sugestao.alvo === null ? [] : [vez.sugestao.alvo]))
  // Trocar de ação deixa só os alvos que ainda valem (e no máximo o teto dela).
  const validos = marcados.filter((id) => possiveis.some((alvo) => alvo.id === id)).slice(0, Math.max(golpe?.alvosMax ?? 0, 0))
  const umSo = golpe?.alvo === 'um'

  const alternar = (id: string) => {
    if (umSo) {
      setMarcados([id])
      return
    }
    setMarcados(validos.includes(id) ? validos.filter((outro) => outro !== id) : [...validos, id])
  }

  const faltaAlvo = golpe !== null && golpe.alvo !== 'nenhum' && validos.length === 0
  const podeExecutar = golpe !== null && executavel(golpe) && !faltaAlvo && !desligado && ocupado === null
  const porQueNao = golpe === null ? 'Escolha uma ação.' : (golpe.motivo ?? golpe.noMapa ?? (faltaAlvo ? (possiveis.length === 0 ? 'Ninguém pode ser alvo desta ação.' : 'Marque o alvo.') : null))

  return (
    <div className="mb-vez__dentro">
      <header className="mb-vez__cabeca">
        <span className="mb-vez__rotulo">A vez é de</span>
        <h2 className="mb-vez__quem">{vez.quem}</h2>
        <p className="mb-vez__desc">{vez.descricao}</p>
        <Barras recursos={vez.recursos} rotulo={`Recursos de ${vez.quem}`} />
      </header>
      {vez.aviso !== null && <p className="mb-vez__aviso">{vez.aviso}</p>}
      {vez.golpes.length > 0 && (
        <div className="mb-vez__acoes">
          <fieldset className="mb-golpes" aria-describedby={idDosGolpes}>
            <legend>Ações</legend>
            <p id={idDosGolpes} className="mb-sr">
              Escolha a ação; as apagadas dizem o porquê.
            </p>
            {vez.golpes.map((item) => {
              const apagado = item.motivo !== null || item.noMapa !== null
              return (
                <label key={item.chave} className="mb-golpe" data-apagado={apagado ? 'sim' : undefined}>
                  <input type="radio" name={`mb-golpe-${vez.chave}`} checked={escolhido === item.chave} disabled={desligado} onChange={() => setEscolhido(item.chave)} />
                  <span className="mb-golpe__corpo">
                    <span className="mb-golpe__nome">
                      {item.nome}
                      {vez.sugestao.golpe === item.chave && <span className="mb-golpe__sug">sugestão</span>}
                    </span>
                    <small>{item.motivo ?? item.noMapa ?? item.detalhe}</small>
                  </span>
                </label>
              )
            })}
          </fieldset>
          <fieldset className="mb-alvos" aria-describedby={idDosAlvos} disabled={golpe === null || golpe.alvo === 'nenhum' || desligado}>
            <legend>{golpe?.alvo === 'nenhum' ? 'Sem alvo' : umSo ? 'Alvo' : `Alvos${golpe !== null && golpe.alvosMax < 24 ? ` (até ${golpe.alvosMax})` : ''}`}</legend>
            <p id={idDosAlvos} className="mb-sr">
              {umSo ? 'Escolha um alvo.' : 'Marque um ou mais alvos.'}
            </p>
            {golpe !== null && golpe.alvo !== 'nenhum' && possiveis.length === 0 && <p className="mb-vazio">Ninguém pode ser alvo desta ação agora.</p>}
            {possiveis.map((alvo) => (
              <label key={alvo.id} className="mb-alvo" data-lado={alvo.lado} data-caiu={alvo.caiu ? 'sim' : undefined}>
                <input type={umSo ? 'radio' : 'checkbox'} name={`mb-alvo-${vez.chave}`} checked={validos.includes(alvo.id)} onChange={() => alternar(alvo.id)} />
                <span className="mb-alvo__nome">{alvo.nome}</span>
                <small>{[alvo.lado === 'eu' ? 'ele mesmo' : alvo.lado === 'aliado' ? 'aliado' : 'outro lado', alvo.caiu ? 'caiu' : null, alvo.detalhe].filter(Boolean).join(' · ')}</small>
              </label>
            ))}
          </fieldset>
          <div className="mb-executar">
            <Botao variante="latao" tamanho="alto" largo disabled={!podeExecutar} onClick={() => golpe !== null && onAgir(golpe, golpe.alvo === 'nenhum' ? [] : validos)}>
              {ocupado === 'agir' ? 'Executando…' : golpe === null ? 'Executar' : `Executar ${golpe.nome}`}
            </Botao>
            {porQueNao !== null && !podeExecutar && <small className="mb-executar__porque">{porQueNao}</small>}
          </div>
        </div>
      )}
    </div>
  )
}

function Pendente({ item, agora, ocupado, desligado, onResponder }: { item: PendenteNoEspelho; agora: number; ocupado: boolean; desligado: boolean; onResponder: (chave: string) => void }) {
  return (
    <li className="mb-pendente" data-mestre={item.doMestre ? 'sim' : undefined} data-ativa={item.ativa ? 'sim' : undefined}>
      <span className="mb-pendente__titulo">{item.titulo}</span>
      <small className="mb-pendente__quem">
        {item.quem}
        {item.desde !== null && <span className="mb-pendente__tempo"> · {haQuanto(item.desde, agora)}</span>}
      </small>
      {item.respostas.length > 0 && (
        <span className="mb-pendente__respostas">
          {item.respostas.map((resposta) => (
            <Botao key={resposta.chave} tamanho="p" disabled={ocupado || desligado || resposta.bloqueio !== null} title={resposta.bloqueio ?? undefined} onClick={() => onResponder(resposta.chave)}>
              {resposta.rotulo}
            </Botao>
          ))}
        </span>
      )}
      {item.nota !== null && <small className="mb-pendente__nota">{item.nota}</small>}
    </li>
  )
}

export function MesaDaBatalha({ espelho, enviar, acoesDoTopo, semFonte = null, teclasNaPagina = false }: MesaDaBatalhaProps) {
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [status, setStatus] = useState<{ texto: string; erro: boolean } | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const continuarRef = useRef<HTMLButtonElement>(null)
  const encerrarRef = useRef<HTMLButtonElement>(null)
  const raizRef = useRef<HTMLDivElement>(null)
  const algumEsperando = (espelho?.pendentes ?? []).some((item) => item.desde !== null)
  const agora = useAgora(algumEsperando)
  const desligado = semFonte !== null || espelho === null

  const pedir = async (chave: string, pedido: PedidoDaMesa, feito: string | null) => {
    setOcupado(chave)
    try {
      const resposta = await enviar(pedido)
      setStatus(resposta.ok ? (feito === null ? null : { texto: feito, erro: false }) : { texto: resposta.motivo ?? 'Não deu.', erro: true })
      return resposta.ok
    } finally {
      setOcupado(null)
    }
  }

  const desfazerUltima = () => {
    if (espelho?.desfazer == null || ocupado !== null || desligado) return
    void pedir('desfazer', { acao: 'desfazer', sceneKey: espelho.sceneKey, linhaId: espelho.desfazer.linhaId }, `Desfeito: ${espelho.desfazer.texto}`)
  }
  const desfazerAgora = useRef(desfazerUltima)
  desfazerAgora.current = desfazerUltima

  // A confirmação do Encerrar começa no botão seguro; saiu dela, o foco volta ao Encerrar.
  useEffect(() => {
    if (confirmando) continuarRef.current?.focus()
  }, [confirmando])

  // Na janela à parte, o Ctrl+Z da página inteira desfaz a última linha (não há editor de mapa aqui).
  useEffect(() => {
    if (!teclasNaPagina) return
    const aoTeclar = (evento: KeyboardEvent) => {
      if ((evento.key === 'z' || evento.key === 'Z') && (evento.ctrlKey || evento.metaKey) && !evento.shiftKey && !evento.altKey && !emCampoDeTexto(evento.target)) {
        evento.preventDefault()
        desfazerAgora.current()
      }
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [teclasNaPagina])

  const teclas = (evento: TeclaDoReact<HTMLDivElement>) => {
    if (teclasNaPagina) return
    if ((evento.key === 'z' || evento.key === 'Z') && (evento.ctrlKey || evento.metaKey) && !evento.shiftKey && !evento.altKey && !emCampoDeTexto(evento.target)) {
      evento.preventDefault()
      evento.stopPropagation()
      desfazerUltima()
    }
  }

  const topo = (
    <header className="mb-topo">
      <div className="mb-topo__leitura">
        {espelho !== null && (
          <span className="mb-rodada" aria-label={espelho.fase === 'iniciativa' ? 'Iniciativa' : `Rodada ${espelho.rodada}`}>
            <b aria-hidden="true">{espelho.fase === 'iniciativa' ? '0' : espelho.rodada}</b>
            <span aria-hidden="true">{espelho.fase === 'iniciativa' ? 'iniciativa' : 'rodada'}</span>
          </span>
        )}
        <p className="mb-topo__vez">
          {espelho === null ? 'Sem batalha' : espelho.fase === 'iniciativa' ? 'Antes do combate' : espelho.vez === null ? 'Sem vez' : `Vez de ${espelho.vez.quem}`}
          <small>{espelho === null ? 'Na cena aberta' : [NOME_DO_SISTEMA[espelho.sistema], espelho.turno === null ? null : `turno ${espelho.turno.n} de ${espelho.turno.m}`].filter(Boolean).join(', ')}</small>
        </p>
      </div>
      {acoesDoTopo !== undefined && <div className="mb-topo__acoes">{acoesDoTopo}</div>}
    </header>
  )

  if (espelho === null) {
    return (
      <div className="mb" ref={raizRef}>
        {topo}
        {semFonte !== null && (
          <p className="mb-semfonte" role="alert">
            {semFonte}
          </p>
        )}
        <div className="mb-vazia">
          <p>Nenhuma batalha na cena aberta.</p>
          <small>Inicie pela página Batalha do livro do mestre (Shift+B): a ordem, a vez e as reações aparecem aqui na hora.</small>
        </div>
      </div>
    )
  }

  const { sceneKey } = espelho
  const vez = espelho.vez

  return (
    <div className="mb" ref={raizRef} onKeyDown={teclas} data-sistema={espelho.sistema}>
      {topo}
      {semFonte !== null && (
        <p className="mb-semfonte" role="alert">
          {semFonte}
        </p>
      )}
      {espelho.avisos.length > 0 && (
        <ul className="mb-avisos">
          {espelho.avisos.map((aviso) => (
            <li key={aviso}>{aviso}</li>
          ))}
        </ul>
      )}
      <div className="mb-corpo">
        <section className="mb-coluna mb-ordem" aria-label="Ordem dos turnos">
          <h3 className="mb-titulo">
            Ordem <small>{espelho.ordem.length}</small>
          </h3>
          {espelho.ordem.length === 0 ? (
            <p className="mb-vazio">Ninguém na ordem. Inclua fichas pela página Batalha do livro.</p>
          ) : (
            <ol className="mb-cartas">
              {espelho.ordem.map((carta) => (
                <Carta key={carta.id} carta={carta} ocupado={ocupado !== null || desligado} onDarVez={() => void pedir('darVez', { acao: 'darVez', sceneKey, cartaId: carta.id }, `A vez foi para ${carta.nome}.`)} />
              ))}
            </ol>
          )}
        </section>

        <section className="mb-coluna mb-vez" aria-label={vez === null ? 'A vez' : `Vez de ${vez.quem}`}>
          {vez !== null ? (
            <VezDaMesa
              key={vez.chave}
              vez={vez}
              ocupado={ocupado}
              desligado={desligado}
              onAgir={(golpe, alvos) => void pedir('agir', { acao: 'agir', sceneKey, vez: vez.chave, golpe: golpe.chave, alvos }, `${vez.quem} usou ${golpe.nome}.`)}
            />
          ) : espelho.fase === 'iniciativa' ? (
            <div className="mb-vez__dentro">
              <header className="mb-vez__cabeca">
                <span className="mb-vez__rotulo">Antes do combate</span>
                <h2 className="mb-vez__quem">Iniciativa</h2>
                <p className="mb-vez__desc">Cada um declara a forma, a iniciativa é rolada e a batalha começa. As formas se declaram no livro; rolar e começar dá daqui.</p>
              </header>
              <div className="mb-iniciativa">
                <Botao variante="latao" disabled={ocupado !== null || desligado} onClick={() => void pedir('rolar', { acao: 'iniciativa', sceneKey, passo: 'rolar' }, 'Iniciativa rolada.')}>
                  {ocupado === 'rolar' ? 'Rolando…' : 'Rolar a iniciativa'}
                </Botao>
                <Botao variante="primario" disabled={ocupado !== null || desligado} onClick={() => void pedir('comecar', { acao: 'iniciativa', sceneKey, passo: 'comecar' }, 'A batalha começou.')}>
                  {ocupado === 'comecar' ? 'Começando…' : 'Começar a batalha'}
                </Botao>
              </div>
            </div>
          ) : (
            <div className="mb-vazia">
              <p>Sem vez agora.</p>
              <small>Dê a vez a alguém na ordem.</small>
            </div>
          )}
        </section>

        <div className="mb-coluna mb-lado">
          <section className="mb-espera" aria-label="Esperando resposta">
            <h3 className="mb-titulo">
              Esperando <small>{espelho.pendentes.length}</small>
            </h3>
            {espelho.pendentes.length === 0 ? (
              <p className="mb-vazio">Ninguém esperando reação.</p>
            ) : (
              <ul className="mb-pendentes">
                {espelho.pendentes.map((item) => (
                  <Pendente
                    key={item.id}
                    item={item}
                    agora={agora}
                    ocupado={ocupado !== null}
                    desligado={desligado}
                    onResponder={(resposta) => void pedir('responder', { acao: 'responder', sceneKey, pendente: item.id, resposta }, 'Respondido.')}
                  />
                ))}
              </ul>
            )}
          </section>
          <section className="mb-registro" aria-label="Registro">
            <h3 className="mb-titulo">Registro</h3>
            {espelho.registro.length === 0 ? (
              <p className="mb-vazio">Nada aconteceu ainda nesta batalha.</p>
            ) : (
              <ol className="mb-linhas">
                {espelho.registro.map((linha) => (
                  <li key={linha.id} className="mb-linha" data-desfeita={linha.desfeita ? 'sim' : undefined}>
                    <span className="mb-linha__texto">
                      <small className="mb-linha__quem">
                        R{linha.rodada} · {linha.autor}
                      </small>
                      {linha.texto}
                    </span>
                    {linha.podeDesfazer && (
                      <button type="button" className="mb-linha__desfazer" disabled={ocupado !== null || desligado} aria-label={`Desfazer: ${linha.texto}`} onClick={() => void pedir('desfazer', { acao: 'desfazer', sceneKey, linhaId: linha.id }, `Desfeito: ${linha.texto}`)}>
                        Desfazer
                      </button>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>

      <footer className="mb-pe">
        <p className="mb-status" role="status" data-erro={status?.erro ? 'sim' : undefined}>
          {status?.texto ?? ''}
        </p>
        {confirmando ? (
          <div className="mb-confirma" role="group" aria-label="Encerrar a batalha?">
            <span className="mb-confirma__texto">{espelho.avisoDoEncerrar}</span>
            <Botao
              ref={continuarRef}
              variante="fantasma"
              onClick={() => {
                setConfirmando(false)
                requestAnimationFrame(() => encerrarRef.current?.focus())
              }}
              onKeyDown={(evento) => {
                if (evento.key === 'Escape') {
                  evento.stopPropagation()
                  setConfirmando(false)
                }
              }}
            >
              Continuar a batalha
            </Botao>
            <Botao
              variante="perigo"
              disabled={ocupado !== null || desligado}
              onClick={() => {
                void pedir('encerrar', { acao: 'encerrar', sceneKey }, 'Batalha encerrada.').then(() => setConfirmando(false))
              }}
            >
              {ocupado === 'encerrar' ? 'Encerrando…' : 'Encerrar a batalha'}
            </Botao>
          </div>
        ) : (
          <div className="mb-pe__acoes">
            <Botao
              variante="fantasma"
              disabled={espelho.desfazer === null || ocupado !== null || desligado}
              title={espelho.desfazer === null ? 'Nada para desfazer' : `Desfazer: ${espelho.desfazer.texto} (Ctrl+Z)`}
              aria-keyshortcuts="Control+Z"
              onClick={desfazerUltima}
            >
              {ocupado === 'desfazer' ? 'Desfazendo…' : 'Desfazer'}
            </Botao>
            <Botao ref={encerrarRef} variante="perigo" disabled={desligado} onClick={() => setConfirmando(true)}>
              Encerrar…
            </Botao>
            <Botao
              variante="primario"
              disabled={!espelho.podePassar || vez === null || ocupado !== null || desligado}
              onClick={() => vez !== null && void pedir('passar', { acao: 'passar', sceneKey, vez: vez.chave }, `${vez.quem} passou a vez.`)}
            >
              {ocupado === 'passar' ? 'Passando…' : 'Passar a vez'}
            </Botao>
          </div>
        )}
      </footer>
    </div>
  )
}
