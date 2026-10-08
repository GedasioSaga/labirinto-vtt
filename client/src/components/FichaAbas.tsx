import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { camposVisiveis, cartoesDaAba, novoCartao, paragrafosDoCartao, type CartaoDaFicha, type Personagem } from '../lib/personagem'
import { abaTemCatalogo, cartaoDoCatalogo, itensDaAba, type ItemEscolhivel } from '../lib/livroDeRegras'
import { abaDoSistema, type AbaDoSistema, type AtributoDoSistema, type SistemaDeRpg } from '../lib/sistemaDeRpg'
import { EscolherDoLivro, type EstadoDaEscolha, type LivroDaFicha } from './EscolherDoLivro'
import { CampoNumero, IniciaisDoNome } from './FichaPecas'

/**
 * As abas da ficha de personagem (Habilidades, Perícias...): os cartões de
 * cada uma, lidos ou editados. Tudo vem do molde da aba no sistema
 * (`AbaDoSistema`): esta tela não sabe o que é uma "habilidade".
 */

export interface FichaAbasProps {
  personagem: Personagem
  sistema: SistemaDeRpg
  editando: boolean
  onChange: (personagem: Personagem) => void
  escolherImagem: () => Promise<string | null>
  /** O livro que vem à parte (o jogador pede ao mestre); ausente = os catálogos vêm no próprio `sistema`. */
  livro?: LivroDaFicha
}

export function FichaAbas({ personagem, sistema, editando, onChange, escolherImagem, livro }: FichaAbasProps) {
  const idBase = useId()
  const [ativaId, setAtivaId] = useState(sistema.abas[0]?.id ?? '')
  const refs = useRef(new Map<string, HTMLButtonElement>())
  const ativa = sistema.abas.find((aba) => aba.id === ativaId) ?? sistema.abas[0]
  if (ativa === undefined) return <p className="lb-ficha__vazio">Este sistema não tem abas.</p>

  // Setas andam entre as abas, Home/End vão às pontas: o padrão de abas da WAI-ARIA.
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const ids = sistema.abas.map((aba) => aba.id)
    const at = ids.indexOf(ativaId)
    const alvo =
      event.key === 'ArrowRight' ? ids[(at + 1) % ids.length] : event.key === 'ArrowLeft' ? ids[(at - 1 + ids.length) % ids.length] : event.key === 'Home' ? ids[0] : event.key === 'End' ? ids[ids.length - 1] : undefined
    if (alvo === undefined) return
    event.preventDefault()
    setAtivaId(alvo)
    refs.current.get(alvo)?.focus()
  }

  const cartoes = cartoesDaAba(personagem, ativa.id)
  const trocarCartoes = (novos: CartaoDaFicha[]) => onChange({ ...personagem, abas: { ...personagem.abas, [ativa.id]: novos } })

  return (
    <div className="lb-ficha__abas">
      <div className="lb-ficha__abas-lista" role="tablist" aria-label={`Abas da ficha de ${personagem.nome}`} onKeyDown={onKeyDown}>
        {sistema.abas.map((aba) => {
          const quantos = cartoesDaAba(personagem, aba.id).length
          return (
            <button
              key={aba.id}
              ref={(el) => {
                if (el === null) refs.current.delete(aba.id)
                else refs.current.set(aba.id, el)
              }}
              type="button"
              role="tab"
              id={`${idBase}-aba-${aba.id}`}
              className="lb-ficha__aba"
              aria-selected={aba.id === ativa.id}
              aria-controls={`${idBase}-painel`}
              tabIndex={aba.id === ativa.id ? 0 : -1}
              onClick={() => setAtivaId(aba.id)}
            >
              {aba.nome}
              {quantos > 0 && <span className="lb-ficha__aba-conta">{quantos}</span>}
            </button>
          )
        })}
      </div>
      <div id={`${idBase}-painel`} className="lb-ficha__painel" role="tabpanel" aria-labelledby={`${idBase}-aba-${ativa.id}`}>
        {editando ? (
          <ListaEditavel key={ativa.id} aba={ativa} sistema={sistema} cartoes={cartoes} onChange={trocarCartoes} escolherImagem={escolherImagem} livro={livro} />
        ) : cartoes.length === 0 ? (
          <p className="lb-ficha__vazio">{ativa.vazio}</p>
        ) : (
          <ul className="lb-ficha__cartoes">
            {cartoes.map((cartao) => (
              <CartaoLido key={cartao.id} cartao={cartao} aba={ativa} sistema={sistema} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Leitura
// ───────────────────────────────────────────────────────────────────────────

function abreviacao(sistema: SistemaDeRpg, atributoId: string): string {
  return sistema.atributos.find((atributo) => atributo.id === atributoId)?.abreviacao ?? atributoId.slice(0, 3).toUpperCase()
}

/** "Rótulo: valor" com o rótulo em destaque, como o dono da mesa lê a técnica no Discord. */
function LinhasDoCartao({ linhas, denso }: { linhas: { rotulo: string; valor: string }[]; denso?: boolean }) {
  if (linhas.length === 0) return null
  return (
    <dl className={`lb-cartao__linhas${denso === true ? ' lb-cartao__linhas--denso' : ''}`}>
      {linhas.map((linha, i) => (
        <div key={`${linha.rotulo}-${i}`} className="lb-cartao__linha">
          <dt>{linha.rotulo.length > 0 ? `${linha.rotulo}:` : '—'}</dt>
          <dd>{linha.valor}</dd>
        </div>
      ))}
    </dl>
  )
}

function CartaoLido({ cartao, aba, sistema }: { cartao: CartaoDaFicha; aba: AbaDoSistema; sistema: SistemaDeRpg }) {
  const sub = aba.subcartoes === undefined ? undefined : abaDoSistema(sistema, aba.subcartoes.aba)
  const atributos = aba.atributos === true ? cartao.atributos.map((id) => abreviacao(sistema, id)) : []
  return (
    <li className="lb-cartao">
      <div className="lb-cartao__corpo">
        {aba.imagem === true && (
          <div className="lb-cartao__imagem">{cartao.imagem !== null ? <img src={cartao.imagem} alt="" /> : <IniciaisDoNome nome={cartao.nome} />}</div>
        )}
        <div className="lb-cartao__texto">
          <div className="lb-cartao__topo">
            <h4 className="lb-cartao__nome">{cartao.nome}</h4>
            {atributos.length > 0 && <span className="lb-ficha__chip lb-ficha__chip--atributos">{atributos.join(' · ')}</span>}
          </div>
          {paragrafosDoCartao(aba, cartao).map((paragrafo, i) => (
            <p key={i} className="lb-cartao__paragrafo">
              {paragrafo}
            </p>
          ))}
          {aba.modificadores === true && cartao.modificadores.length > 0 && (
            <div className="lb-cartao__mods">
              {cartao.modificadores.map((mod, i) => (
                <span key={`${mod.atributo}-${i}`} className="lb-cartao__mod" data-sinal={mod.delta >= 0 ? 'mais' : 'menos'}>
                  {abreviacao(sistema, mod.atributo)} {mod.delta >= 0 ? '+' : ''}
                  {mod.delta}
                </span>
              ))}
            </div>
          )}
          <LinhasDoCartao linhas={camposVisiveis(aba, cartao, 'linha')} />
          {camposVisiveis(aba, cartao, 'destaque').map((campo, i) => (
            <p key={`${campo.rotulo}-${i}`} className="lb-cartao__destaque">
              <span className="lb-cartao__destaque-rotulo">{campo.rotulo}: </span>
              {campo.valor}
            </p>
          ))}
        </div>
      </div>
      {sub !== undefined && cartao.subcartoes.length > 0 && (
        <div className="lb-cartao__subs">
          {cartao.subcartoes.map((subcartao) => (
            <div key={subcartao.id} className="lb-cartao__sub">
              <span className="lb-cartao__sub-nome">{subcartao.nome}</span>
              {paragrafosDoCartao(sub, subcartao).map((paragrafo, i) => (
                <span key={i} className="lb-cartao__sub-texto">
                  {' — '}
                  {paragrafo}
                </span>
              ))}
              <LinhasDoCartao linhas={camposVisiveis(sub, subcartao, 'linha')} denso />
            </div>
          ))}
        </div>
      )}
    </li>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Edição
// ───────────────────────────────────────────────────────────────────────────

interface ListaEditavelProps {
  aba: AbaDoSistema
  sistema: SistemaDeRpg
  cartoes: CartaoDaFicha[]
  onChange: (cartoes: CartaoDaFicha[]) => void
  escolherImagem: () => Promise<string | null>
  /** Dentro de outro cartão (técnicas da transformação): botões menores, e sem "Escolher do livro". */
  aninhada?: boolean
  livro?: LivroDaFicha
}

function ListaEditavel({ aba, sistema, cartoes, onChange, escolherImagem, aninhada = false, livro }: ListaEditavelProps) {
  // O cartão que acabou de nascer abre aberto; os outros ficam fechados numa linha cada.
  const [recemCriado, setRecemCriado] = useState<string | null>(null)
  const [escolhendo, setEscolhendo] = useState(false)
  const botaoDoLivro = useRef<HTMLButtonElement>(null)
  // Os itens do catálogo da aba: no sistema (mestre, ou o livro do jogador que já chegou) ou ainda no mestre.
  const itens = itensDaAba(sistema.catalogos, aba.id)
  const noMestre = livro !== undefined && itens.length === 0 && abaTemCatalogo(livro.resumo, aba.id)
  const ofereceLivro = !aninhada && (itens.length > 0 || noMestre)
  const estadoDaEscolha: EstadoDaEscolha = !noMestre || livro.estado === 'pronto' ? 'pronto' : livro.estado === 'falhou' ? 'falhou' : 'chegando'
  const pedirLivro = () => {
    if (noMestre && (livro.estado === 'ausente' || livro.estado === 'falhou')) livro.pedir()
  }
  const fecharEscolha = () => {
    setEscolhendo(false)
    botaoDoLivro.current?.focus()
  }
  const escolher = (item: ItemEscolhivel) => {
    const cartao = cartaoDoCatalogo(aba, sistema, item)
    setRecemCriado(cartao.id)
    onChange([...cartoes, cartao])
    fecharEscolha()
  }
  const trocar = (id: string, cartao: CartaoDaFicha) => onChange(cartoes.map((atual) => (atual.id === id ? cartao : atual)))
  const mover = (indice: number, delta: -1 | 1) => {
    const alvo = indice + delta
    if (alvo < 0 || alvo >= cartoes.length) return
    const novos = [...cartoes]
    novos[indice] = cartoes[alvo]
    novos[alvo] = cartoes[indice]
    onChange(novos)
  }
  const adicionar = () => {
    const cartao = novoCartao(aba.item)
    setRecemCriado(cartao.id)
    onChange([...cartoes, cartao])
  }
  return (
    <div className={`lb-cartoes-edit${aninhada ? ' lb-cartoes-edit--aninhada' : ''}`}>
      {cartoes.length === 0 && <p className="lb-ficha__vazio">{aba.vazio}</p>}
      {cartoes.map((cartao, indice) => (
        <CartaoEditavel
          key={cartao.id}
          cartao={cartao}
          aba={aba}
          sistema={sistema}
          aberto={cartao.id === recemCriado}
          onChange={(novo) => trocar(cartao.id, novo)}
          onRemover={() => onChange(cartoes.filter((atual) => atual.id !== cartao.id))}
          onSubir={indice > 0 ? () => mover(indice, -1) : undefined}
          onDescer={indice < cartoes.length - 1 ? () => mover(indice, 1) : undefined}
          escolherImagem={escolherImagem}
        />
      ))}
      <div className="lb-cartoes-edit__botoes">
        <button type="button" className={`lb-btn${aninhada ? ' lb-btn--compact' : ''} lb-cartoes-edit__mais`} onClick={adicionar}>
          + {aba.item}
        </button>
        {ofereceLivro && (
          <button
            ref={botaoDoLivro}
            type="button"
            className="lb-btn lb-btn--ghost"
            aria-expanded={escolhendo}
            onClick={() => {
              if (escolhendo) {
                setEscolhendo(false)
                return
              }
              setEscolhendo(true)
              pedirLivro()
            }}
          >
            Escolher do livro
          </button>
        )}
      </div>
      {ofereceLivro && escolhendo && (
        <EscolherDoLivro
          aba={aba}
          sistema={sistema}
          itens={itens}
          estado={estadoDaEscolha}
          nomesNaFicha={new Set(cartoes.map((cartao) => cartao.nome.toLocaleLowerCase('pt-BR')))}
          onTentarDeNovo={pedirLivro}
          onEscolher={escolher}
          onFechar={fecharEscolha}
        />
      )}
    </div>
  )
}

interface CartaoEditavelProps {
  cartao: CartaoDaFicha
  aba: AbaDoSistema
  sistema: SistemaDeRpg
  aberto: boolean
  onChange: (cartao: CartaoDaFicha) => void
  onRemover: () => void
  onSubir: (() => void) | undefined
  onDescer: (() => void) | undefined
  escolherImagem: () => Promise<string | null>
}

function CartaoEditavel({ cartao, aba, sistema, aberto, onChange, onRemover, onSubir, onDescer, escolherImagem }: CartaoEditavelProps) {
  const [erroDaImagem, setErroDaImagem] = useState<string | null>(null)
  const sub = aba.subcartoes === undefined ? undefined : abaDoSistema(sistema, aba.subcartoes.aba)
  const trocarCampo = (campoId: string, valor: string) => onChange({ ...cartao, campos: { ...cartao.campos, [campoId]: valor } })
  const pedirImagem = async () => {
    setErroDaImagem(null)
    try {
      const imagem = await escolherImagem()
      if (imagem !== null) onChange({ ...cartao, imagem })
    } catch (erro) {
      setErroDaImagem(erro instanceof Error ? erro.message : String(erro))
    }
  }

  return (
    <details className="lb-cartao lb-cartao--edit" open={aberto}>
      <summary className="lb-cartao__resumo">
        <span className="lb-cartao__nome">{cartao.nome}</span>
      </summary>
      <div className="lb-cartao__form">
        <label className="lb-field">
          <span className="lb-label">Nome</span>
          <input className="lb-input" value={cartao.nome} onChange={(event) => onChange({ ...cartao, nome: event.target.value })} />
        </label>
        {aba.campos.map((campo) => (
          <label key={campo.id} className="lb-field">
            <span className="lb-label">{campo.rotulo}</span>
            {campo.forma === 'linha' ? (
              <input className="lb-input" value={cartao.campos[campo.id] ?? ''} onChange={(event) => trocarCampo(campo.id, event.target.value)} />
            ) : (
              <textarea className="lb-input lb-textarea" value={cartao.campos[campo.id] ?? ''} onChange={(event) => trocarCampo(campo.id, event.target.value)} />
            )}
          </label>
        ))}
        {aba.atributos === true && <EscolhaDeAtributos sistema={sistema} escolhidos={cartao.atributos} onChange={(atributos) => onChange({ ...cartao, atributos })} />}
        {aba.imagem === true && (
          <div className="lb-field">
            <span className="lb-label">Imagem</span>
            <div className="lb-cartao__imagem-edit">
              <div className="lb-cartao__imagem">{cartao.imagem !== null ? <img src={cartao.imagem} alt="" /> : <IniciaisDoNome nome={cartao.nome} />}</div>
              <button type="button" className="lb-btn lb-btn--compact" onClick={() => void pedirImagem()}>
                {cartao.imagem === null ? 'Escolher imagem…' : 'Trocar imagem…'}
              </button>
              {cartao.imagem !== null && (
                <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={() => onChange({ ...cartao, imagem: null })}>
                  Tirar
                </button>
              )}
            </div>
            {erroDaImagem !== null && (
              <p className="lb-field__error" role="alert">
                {erroDaImagem}
              </p>
            )}
          </div>
        )}
        {aba.modificadores === true && (
          <fieldset className="lb-cartao__grupo">
            <legend className="lb-label">Modificadores</legend>
            {cartao.modificadores.map((mod, i) => (
              <div key={i} className="lb-cartao__par">
                <select
                  className="lb-input"
                  aria-label={`Atributo do modificador ${i + 1}`}
                  value={mod.atributo}
                  onChange={(event) => onChange({ ...cartao, modificadores: cartao.modificadores.map((atual, j) => (j === i ? { ...atual, atributo: event.target.value } : atual)) })}
                >
                  {opcoesDeAtributo(sistema.atributos, mod.atributo).map((atributo) => (
                    <option key={atributo.id} value={atributo.id}>
                      {atributo.nome}
                    </option>
                  ))}
                </select>
                <CampoNumero
                  rotulo={`Pontos do modificador ${i + 1}`}
                  valor={mod.delta}
                  onChange={(delta) => onChange({ ...cartao, modificadores: cartao.modificadores.map((atual, j) => (j === i ? { ...atual, delta } : atual)) })}
                />
                <button
                  type="button"
                  className="lb-btn lb-btn--ghost lb-btn--compact"
                  aria-label={`Tirar o modificador ${i + 1}`}
                  onClick={() => onChange({ ...cartao, modificadores: cartao.modificadores.filter((_, j) => j !== i) })}
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              className="lb-btn lb-btn--compact lb-cartao__acrescentar"
              disabled={sistema.atributos.length === 0}
              onClick={() => onChange({ ...cartao, modificadores: [...cartao.modificadores, { atributo: sistema.atributos[0]?.id ?? '', delta: 0 }] })}
            >
              + Modificador
            </button>
          </fieldset>
        )}
        {aba.extras === true && (
          <fieldset className="lb-cartao__grupo">
            <legend className="lb-label">Campos extras</legend>
            {cartao.extras.map((extra, i) => (
              <div key={i} className="lb-cartao__par">
                <input
                  className="lb-input"
                  aria-label={`Nome do campo extra ${i + 1}`}
                  placeholder="Nome"
                  value={extra.nome}
                  onChange={(event) => onChange({ ...cartao, extras: cartao.extras.map((atual, j) => (j === i ? { ...atual, nome: event.target.value } : atual)) })}
                />
                <input
                  className="lb-input"
                  aria-label={`Valor do campo extra ${i + 1}`}
                  placeholder="Valor"
                  value={extra.valor}
                  onChange={(event) => onChange({ ...cartao, extras: cartao.extras.map((atual, j) => (j === i ? { ...atual, valor: event.target.value } : atual)) })}
                />
                <button
                  type="button"
                  className="lb-btn lb-btn--ghost lb-btn--compact"
                  aria-label={`Tirar o campo extra ${i + 1}`}
                  onClick={() => onChange({ ...cartao, extras: cartao.extras.filter((_, j) => j !== i) })}
                >
                  ×
                </button>
              </div>
            ))}
            <button type="button" className="lb-btn lb-btn--compact lb-cartao__acrescentar" onClick={() => onChange({ ...cartao, extras: [...cartao.extras, { nome: '', valor: '' }] })}>
              + Campo
            </button>
          </fieldset>
        )}
        {sub !== undefined && aba.subcartoes !== undefined && (
          <fieldset className="lb-cartao__grupo">
            <legend className="lb-label">{aba.subcartoes.rotulo}</legend>
            <ListaEditavel aba={sub} sistema={sistema} cartoes={cartao.subcartoes} onChange={(subcartoes) => onChange({ ...cartao, subcartoes })} escolherImagem={escolherImagem} aninhada />
          </fieldset>
        )}
        <div className="lb-cartao__acoes">
          <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" disabled={onSubir === undefined} onClick={onSubir}>
            Subir
          </button>
          <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" disabled={onDescer === undefined} onClick={onDescer}>
            Descer
          </button>
          <button type="button" className="lb-btn lb-btn--danger lb-btn--compact" onClick={onRemover}>
            Remover {cartao.nome}
          </button>
        </div>
      </div>
    </details>
  )
}

/** Os atributos do sistema e, se for o caso, o do arquivo que o sistema não conhece — o `select` não troca o valor sozinho. */
function opcoesDeAtributo(atributos: readonly AtributoDoSistema[], atual: string): { id: string; nome: string }[] {
  const conhecidos = atributos.map((atributo) => ({ id: atributo.id, nome: atributo.nome }))
  return atributos.some((atributo) => atributo.id === atual) ? conhecidos : [...conhecidos, { id: atual, nome: atual }]
}

function EscolhaDeAtributos({ sistema, escolhidos, onChange }: { sistema: SistemaDeRpg; escolhidos: string[]; onChange: (atributos: string[]) => void }) {
  return (
    <fieldset className="lb-cartao__grupo">
      <legend className="lb-label">Atributos</legend>
      <div className="lb-cartao__atributos">
        {sistema.atributos.map((atributo) => {
          const marcado = escolhidos.includes(atributo.id)
          return (
            <button
              key={atributo.id}
              type="button"
              className="lb-ficha__chip lb-ficha__chip--botao"
              aria-pressed={marcado}
              title={atributo.nome}
              onClick={() => onChange(marcado ? escolhidos.filter((id) => id !== atributo.id) : [...escolhidos, atributo.id])}
            >
              {atributo.abreviacao}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
