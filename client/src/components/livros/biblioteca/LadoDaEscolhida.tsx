import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { descreverAlcance } from '../../../lib/batalha/alcance/forma'
import type { MecanicaV1 } from '../../../lib/batalha/mecanica/modelo'
import type { FichaDaPrevia } from '../../../lib/batalha/mecanica/resumo'
import { pedacosDoPapel } from '../../../lib/batalha/mecanica/textoGerado'
import { normalizarParaBusca } from '../../../lib/buscaNoLivro'
import { ITEM_QUANTIDADE_MAX } from '../../../lib/items'
import type { GrupoDeFichas } from '../../../lib/livros/gruposDaBiblioteca'
import type { AlcanceDaLinha } from '../../../lib/livros/linhaDaBiblioteca'
import type { CartaoDaFicha, Personagem } from '../../../lib/personagem'
import { GlifoDoAlcance } from '../../batalha/alcance/EscolhaDaForma'
import { PapelDoCartao } from '../../batalha/editor/PapelDoCartao'
import { linhaCurtaDoPapel } from '../../batalha/editor/fraseDoPapel'
import { escolhasDaFicha, formatarNumero, Retrato } from '../comum'
import type { SistemaDeRpg } from '../../../lib/sistemaDeRpg'
import { IconeDaBiblioteca } from './IconeDaBiblioteca'
import '../../batalha/combate.css'

/**
 * A COLUNA DA DIREITA da biblioteca (protótipo `.lado`): o cartão de papel do
 * editor inteiro para a escolhida, o alcance, as ações com nome ("Dar a…",
 * "Testar", "Editar"), o teste no boneco, o "Quem tem" com "Tirar da ficha" e,
 * separado embaixo, "Apagar do livro" com confirmação que começa no Cancelar.
 */

/** O que dar a esta ficha faz: pode, ou o porquê de não poder ("Aira já tem"). */
export interface EstadoParaDar {
  pode: boolean
  /** A frase curta ao lado do nome ("na aba Habilidades", "já tem"). */
  frase: string
}

interface DarAProps {
  grupos: readonly GrupoDeFichas[]
  ultimaFicha: string | null
  estadoDe: (ficha: Personagem) => EstadoParaDar
  botaoRef: RefObject<HTMLButtonElement | null>
  /** `quantidade` = quantos dar de uma vez (1 quando a coisa não empilha). */
  onDar: (ficha: Personagem, quantidade: number) => void
  onFechar: () => void
  /** Aberto pela tecla D: aparece na hora. */
  instantaneo: boolean
  /** A coisa empilha: o menu mostra o "Quantos" no topo. */
  comQuantidade: boolean
}

/** O texto do "Quantos" como número: vazio ou zero = 1, acima do teto da pilha = o teto. */
function quantidadeDoTexto(texto: string): number {
  const lido = Number.parseInt(texto, 10)
  if (!Number.isSafeInteger(lido) || lido < 1) return 1
  return Math.min(lido, ITEM_QUANTIDADE_MAX)
}

/** Só algarismos, no máximo os do teto (9999 = 4): colar "40 balas" deixa "40". */
const ALGARISMOS_DO_TETO = String(ITEM_QUANTIDADE_MAX).length
/** Shift + seta anda de 10 em 10 no "Quantos". */
const PASSO_LARGO = 10

/**
 * "DAR A…" (protótipo `.dar`): a lista das fichas com busca, a última usada já
 * marcada (dar várias coisas à mesma pessoa é D e Enter). Setas andam, Enter
 * dá, Esc fecha e devolve o foco ao botão. Na coisa que empilha, o "Quantos"
 * no topo (começa em 1) diz quantos vão de uma vez; o foco continua na busca,
 * então D e Enter seguem dando 1.
 */
function DarA({ grupos, ultimaFicha, estadoDe, botaoRef, onDar, onFechar, instantaneo, comQuantidade }: DarAProps) {
  const listaId = useId()
  const [filtro, setFiltro] = useState('')
  const [textoDaQuantidade, setTextoDaQuantidade] = useState('1')
  const quantidade = comQuantidade ? quantidadeDoTexto(textoDaQuantidade) : 1
  const selecionarAoSoltar = useRef(false)
  const todas = grupos.flatMap((grupo) => grupo.fichas)
  const inicial = todas.find((ficha) => ficha.id === ultimaFicha && estadoDe(ficha).pode) ?? todas.find((ficha) => estadoDe(ficha).pode)
  const [marcada, setMarcada] = useState<string | null>(inicial?.id ?? null)
  const campoRef = useRef<HTMLInputElement>(null)
  const caixaRef = useRef<HTMLDivElement>(null)
  const termo = normalizarParaBusca(filtro.trim())
  const visiveis = grupos
    .map((grupo) => ({ ...grupo, fichas: grupo.fichas.filter((ficha) => termo === '' || normalizarParaBusca(ficha.nome).includes(termo)) }))
    .filter((grupo) => grupo.fichas.length > 0)
  const ordem = visiveis.flatMap((grupo) => grupo.fichas)

  // O foco vai à busca só ao abrir: o `onFechar` muda a cada render de quem abre, e refocar ali tiraria o foco do "Quantos" no meio da digitação.
  useEffect(() => {
    campoRef.current?.focus()
  }, [])
  useEffect(() => {
    const aoClicar = (event: PointerEvent) => {
      const alvo = event.target
      if (alvo instanceof Node && (caixaRef.current?.contains(alvo) === true || botaoRef.current?.contains(alvo) === true)) return
      onFechar()
    }
    window.addEventListener('pointerdown', aoClicar, true)
    return () => window.removeEventListener('pointerdown', aoClicar, true)
  }, [botaoRef, onFechar])

  const fechar = () => {
    onFechar()
    botaoRef.current?.focus()
  }
  const mudarQuantidade = (nova: number) => setTextoDaQuantidade(String(Math.min(Math.max(nova, 1), ITEM_QUANTIDADE_MAX)))
  /*
   * No "Quantos": setas sobem e descem (Shift, de 10 em 10); o Enter só firma o
   * número e leva o foco à busca, onde a ficha marcada está à vista (o Enter de
   * lá é que dá); o Esc fecha como na busca.
   */
  const teclarNaQuantidade = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      fechar()
    } else if (event.key === 'Enter') {
      event.preventDefault()
      mudarQuantidade(quantidade)
      campoRef.current?.focus()
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      const passo = event.shiftKey ? PASSO_LARGO : 1
      mudarQuantidade(quantidade + (event.key === 'ArrowUp' ? passo : -passo))
    }
  }
  const teclar = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      fechar()
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const ficha = ordem.find((atual) => atual.id === marcada)
      if (ficha !== undefined && estadoDe(ficha).pode) onDar(ficha, quantidade)
      return
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    if (ordem.length === 0) return
    const atual = ordem.findIndex((ficha) => ficha.id === marcada)
    const passo = event.key === 'ArrowDown' ? 1 : -1
    const proximo = ordem[(atual + passo + ordem.length) % ordem.length]
    if (proximo !== undefined) {
      setMarcada(proximo.id)
      caixaRef.current?.querySelector<HTMLElement>(`[data-ficha="${CSS.escape(proximo.id)}"]`)?.scrollIntoView({ block: 'nearest' })
    }
  }

  return (
    <div className="mu-bib-pop mu-bib-dar" data-lado="esq" data-instantaneo={instantaneo ? '' : undefined} ref={caixaRef}>
      {comQuantidade && (
        <div className="mu-bib-dar__qtd">
          <label htmlFor={`${listaId}-qtd`}>Quantos</label>
          <span className="mu-bib-dar__passo" role="group" aria-label="Quantos dar">
            {/* O pointerdown sem padrão deixa o foco onde estava (a busca): o Enter depois do clique ainda dá. */}
            <button type="button" className="mu-bt mu-bt--ic mu-bt--p" aria-label="Um a menos" disabled={quantidade <= 1} onPointerDown={(event) => event.preventDefault()} onClick={() => mudarQuantidade(quantidade - 1)}>
              <IconeDaBiblioteca nome="menos" />
            </button>
            <input
              id={`${listaId}-qtd`}
              className="mu-bib-dar__n mu-bib-num"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              aria-describedby={`${listaId}-qtd-dica`}
              value={textoDaQuantidade}
              onChange={(event) => setTextoDaQuantidade(event.target.value.replace(/\D/g, '').slice(0, ALGARISMOS_DO_TETO))}
              // Entrar no campo seleciona o número: digitar 40 troca o 1, não vira 140. O clique que dá o foco não desfaz a seleção ao soltar.
              onPointerDown={(event) => {
                selecionarAoSoltar.current = document.activeElement !== event.currentTarget
              }}
              onMouseUp={(event) => {
                if (!selecionarAoSoltar.current) return
                selecionarAoSoltar.current = false
                event.preventDefault()
              }}
              onFocus={(event) => event.target.select()}
              onBlur={() => mudarQuantidade(quantidade)}
              onKeyDown={teclarNaQuantidade}
            />
            <button type="button" className="mu-bt mu-bt--ic mu-bt--p" aria-label="Um a mais" disabled={quantidade >= ITEM_QUANTIDADE_MAX} onPointerDown={(event) => event.preventDefault()} onClick={() => mudarQuantidade(quantidade + 1)}>
              <IconeDaBiblioteca nome="mais" />
            </button>
          </span>
          <span className="mu-it-sr" id={`${listaId}-qtd-dica`}>
            Empilha: quem já tem soma na mesma vaga, até {formatarNumero(ITEM_QUANTIDADE_MAX)}.
          </span>
        </div>
      )}
      <label className="mu-it-sr" htmlFor={`${listaId}-busca`}>
        Buscar ficha
      </label>
      <input
        ref={campoRef}
        id={`${listaId}-busca`}
        className="mu-entrada"
        type="search"
        placeholder="Buscar ficha"
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-expanded="true"
        aria-controls={listaId}
        aria-activedescendant={marcada === null ? undefined : `${listaId}-${marcada}`}
        value={filtro}
        onChange={(event) => setFiltro(event.target.value)}
        onKeyDown={teclar}
      />
      <div className="mu-bib-dar__lista" role="listbox" id={listaId} aria-label="Dar a">
        {visiveis.length === 0 && <p className="mu-bib-dar__vazio">{todas.length === 0 ? 'Nenhuma ficha nesta pasta ainda.' : 'Nenhuma ficha com esse nome.'}</p>}
        {visiveis.map((grupo) => (
          <div key={grupo.rotulo} role="group" aria-label={grupo.rotulo}>
            <p className="mu-bib-dar__grupo" aria-hidden="true">
              {grupo.rotulo}
            </p>
            {grupo.fichas.map((ficha) => {
              const estado = estadoDe(ficha)
              return (
                <div
                  key={ficha.id}
                  id={`${listaId}-${ficha.id}`}
                  data-ficha={ficha.id}
                  className="mu-bib-dar__op"
                  role="option"
                  aria-selected={marcada === ficha.id}
                  aria-disabled={!estado.pode}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setMarcada(ficha.id)
                    if (estado.pode) onDar(ficha, quantidade)
                  }}
                >
                  <span className="mu-bib-av" aria-hidden="true">
                    <Retrato imagem={ficha.retrato} nome={ficha.nome} tamanho="p" />
                  </span>
                  <span>{ficha.nome}</span>
                  <small>{estado.pode && quantidade > 1 ? `+${formatarNumero(quantidade)} ${estado.frase}` : estado.frase}</small>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

/** O papel: a frase gerada em pedaços coloridos (a mesma do editor) ou o texto escrito; a descrição só quando diz outra coisa. */
function PapelDaEscolhida({ cartao, pecas, frase, linhaCurta, ficha, selo }: { cartao: CartaoDaFicha; pecas: MecanicaV1 | null; frase: string; linhaCurta: string; ficha: FichaDaPrevia; selo: { texto: string; cor: 'over' | 'acervo' } | null }) {
  const descricao = (cartao.campos.descricao ?? '').trim()
  const repete = descricao !== '' && normalizarParaBusca(descricao) === normalizarParaBusca(frase)
  const doPapel = repete ? { ...cartao, campos: { ...cartao.campos, descricao: '' } } : cartao
  const pedacos = pecas === null ? null : pedacosDoPapel(pecas, ficha)
  const fraseNoPapel: ReactNode =
    pedacos === null
      ? frase || 'Sem efeito escrito.'
      : pedacos.map((pedaco, indice) =>
          pedaco.cor === undefined ? (
            <span key={indice}>{pedaco.texto}</span>
          ) : (
            <span key={indice} className="mu-bib-pd" data-cor={pedaco.cor}>
              {pedaco.texto}
            </span>
          ),
        )
  return (
    <div className="mu-bib-papel" data-selo={selo === null ? undefined : ''} aria-label={`Cartão de ${cartao.nome}`} role="group">
      {selo !== null && (
        <span className="mu-bib-papel__selo" data-c={selo.cor}>
          {selo.texto}
        </span>
      )}
      <PapelDoCartao cartao={doPapel} linhaCurta={pecas === null ? linhaCurta : linhaCurtaDoPapel(pecas, ficha)} frase={fraseNoPapel} />
    </div>
  )
}

export interface LadoDaEscolhidaProps {
  /** O cartão que a escolhida vira na ficha (o mesmo que o "Dar a…" põe); a coisa do Acervo vem como cartão só com a descrição. */
  cartao: CartaoDaFicha
  pecas: MecanicaV1 | null
  frase: string
  linhaCurta: string
  selo: { texto: string; cor: 'over' | 'acervo' } | null
  ficha: FichaDaPrevia
  sistema: SistemaDeRpg
  alcance: AlcanceDaLinha
  donos: readonly Personagem[]
  /** "na aba Habilidades", "na mochila": onde a coisa entra na ficha. */
  ondeEntra: string
  /** Onde a coisa mora ("Mora no livro desta pasta."). */
  ondeMora: string
  podeGravar: boolean
  motivoDoTeste: string | null
  motivoDoEditar: string | null
  /** "Apagar do livro"; `null` = esta não se apaga daqui (a do livro de regras, a do Acervo). */
  rotuloDoApagar: string | null
  teste: ReactNode
  extra: ReactNode
  gruposParaDar: readonly GrupoDeFichas[]
  ultimaFicha: string | null
  estadoParaDar: (ficha: Personagem) => EstadoParaDar
  /** O "Dar a…" aberto, e por onde: pela tecla D abre sem animar (atalho de teclado não anima). */
  darAberto: false | 'clique' | 'tecla'
  /** A escolhida empilha na mochila: o "Dar a…" pergunta quantos (a que não empilha vai uma por vez). */
  darComQuantidade: boolean
  confirmandoApagar: boolean
  onAbrirDar: (aberto: boolean) => void
  onDar: (ficha: Personagem, quantidade: number) => void
  onTestar: () => void
  onEditar: () => void
  onTirar: (ficha: Personagem) => void
  onPedirApagar: (pedir: boolean) => void
  onApagar: () => void
  onDarAlcance: (() => void) | null
}

export function LadoDaEscolhida(props: LadoDaEscolhidaProps) {
  const { cartao, pecas, frase, linhaCurta, selo, ficha, sistema, alcance, donos, ondeEntra, ondeMora, podeGravar, motivoDoTeste, motivoDoEditar, rotuloDoApagar, teste, extra } = props
  const motivoId = useId()
  const quemId = useId()
  const darRef = useRef<HTMLButtonElement>(null)
  const cancelarRef = useRef<HTMLButtonElement>(null)

  // A confirmação de apagar começa no Cancelar (o Enter sem querer não apaga).
  useEffect(() => {
    if (props.confirmandoApagar) cancelarRef.current?.focus()
  }, [props.confirmandoApagar])

  return (
    <>
      <PapelDaEscolhida cartao={cartao} pecas={pecas} frase={frase} linhaCurta={linhaCurta} ficha={ficha} selo={selo} />
      {alcance !== null &&
        (alcance === 'falta' ? (
          <div className="mu-bib-alc mu-bib-alc--falta">
            <p>
              <b>Sem alcance ainda:</b> a mesa não confere a distância deste.{' '}
              {props.onDarAlcance !== null && (
                <>
                  <button type="button" className="mu-bib-link" onClick={props.onDarAlcance}>
                    Dar alcance aos antigos
                  </button>{' '}
                  propõe um pelo texto.
                </>
              )}
            </p>
          </div>
        ) : (
          <div className="mu-bib-alc">
            <GlifoDoAlcance forma={alcance.forma} cor={alcance.cor} />
            <p>
              <b>Alcance:</b> {descreverAlcance(alcance.forma)}.
              <br />
              <span className="mu-bib-dica">{alcance.cor === 'verde' ? 'Verde: não dá dano.' : 'Azul: onde pega.'}</span>
            </p>
          </div>
        ))}
      <div className="mu-bib-acoes">
        <span className="mu-bib-ancora">
          <button
            ref={darRef}
            type="button"
            className="mu-bt mu-bt--latao"
            aria-haspopup="listbox"
            aria-expanded={props.darAberto !== false}
            aria-keyshortcuts="D"
            aria-disabled={!podeGravar}
            onClick={() => {
              if (podeGravar) props.onAbrirDar(props.darAberto === false)
            }}
          >
            <IconeDaBiblioteca nome="dar" />
            Dar a…
          </button>
          {props.darAberto !== false && podeGravar && <DarA instantaneo={props.darAberto === 'tecla'} comQuantidade={props.darComQuantidade} grupos={props.gruposParaDar} ultimaFicha={props.ultimaFicha} estadoDe={props.estadoParaDar} botaoRef={darRef} onDar={props.onDar} onFechar={() => props.onAbrirDar(false)} />}
        </span>
        <button type="button" className="mu-bt" aria-keyshortcuts="T" aria-disabled={motivoDoTeste !== null} aria-describedby={motivoDoTeste === null ? undefined : motivoId} onClick={() => motivoDoTeste === null && props.onTestar()}>
          <IconeDaBiblioteca nome="play" />
          Testar
        </button>
        <button type="button" className="mu-bt" aria-keyshortcuts="E" aria-disabled={motivoDoEditar !== null} title={motivoDoEditar ?? undefined} onClick={() => motivoDoEditar === null && props.onEditar()}>
          <IconeDaBiblioteca nome="lapis" />
          Editar
        </button>
      </div>
      {motivoDoTeste !== null && (
        <p className="mu-bib-motivo" id={motivoId}>
          {motivoDoTeste}
        </p>
      )}
      {teste}
      {extra}
      <section className="mu-bib-sec" aria-labelledby={quemId}>
        <div className="mu-bib-sec__tit">
          <h3 id={quemId}>Quem tem</h3>
          <span className="mu-bib-dica">{donos.length > 0 ? `${donos.length} ${donos.length === 1 ? 'ficha' : 'fichas'}, ${ondeEntra}` : 'só no livro'}</span>
        </div>
        {donos.length > 0 ? (
          <ul className="mu-bib-quem">
            {donos.map((dono) => (
              <li key={dono.id}>
                <span className="mu-bib-av" aria-hidden="true">
                  <Retrato imagem={dono.retrato} nome={dono.nome} tamanho="p" />
                </span>
                <span>
                  {dono.nome}
                  <span className="mu-bib-quem__onde">{escolhasDaFicha(dono, sistema) || (dono.tipo === 'jogador' ? 'Jogador' : 'NPC')}</span>
                </span>
                <button type="button" className="mu-bt mu-bt--p mu-bt--fantasma" aria-disabled={!podeGravar} aria-label={`Tirar ${cartao.nome} da ficha de ${dono.nome}`} onClick={() => podeGravar && props.onTirar(dono)}>
                  Tirar da ficha
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mu-bib-dica">Ninguém tem ainda. Use “Dar a…” ou arraste a linha até um nome da coluna Fichas.</p>
        )}
      </section>
      <div className="mu-bib-rodape">
        <span className="mu-bib-dica">{ondeMora}</span>
        {rotuloDoApagar !== null && !props.confirmandoApagar && (
          <button type="button" className="mu-bt mu-bt--p mu-bt--perigo" aria-disabled={!podeGravar} onClick={() => podeGravar && props.onPedirApagar(true)}>
            <IconeDaBiblioteca nome="lixo" />
            {rotuloDoApagar}
          </button>
        )}
      </div>
      {rotuloDoApagar !== null && props.confirmandoApagar && (
        <div className="mu-bib-confirma" role="alertdialog" aria-label={`${rotuloDoApagar}?`}>
          <p>
            {cartao.nome} sai do livro. {donos.length > 0 ? `As ${donos.length === 1 ? 'cópia na ficha continua' : `${donos.length} cópias nas fichas continuam`}.` : ''} O aviso tem Desfazer.
          </p>
          <div className="mu-bib-confirma__acoes">
            <button
              ref={cancelarRef}
              type="button"
              className="mu-bt mu-bt--p"
              onClick={() => props.onPedirApagar(false)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.stopPropagation()
                  props.onPedirApagar(false)
                }
              }}
            >
              Cancelar
            </button>
            <button type="button" className="mu-bt mu-bt--p mu-bt--perigo" onClick={props.onApagar}>
              {rotuloDoApagar}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
