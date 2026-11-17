import { useMemo, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import { Dialogo } from '../../../components/grimorio/Dialogo'
import { NOME_DA_PASTA_MAX, type RecusaDaPasta } from '../../../lib/preparo/pastasDeVerbetes'
import { semAcento } from '../../../lib/preparo/enciclopedia'
import type { TextosDoArrasto } from './arrastarParaPasta'
import { IconeBandeja, IconeLupa, IconeMais, IconePasta, IconePilha, IconeSeta, IconeSubir } from './icones'

/**
 * A BARRA DAS PASTAS (E3): "Todos", "Sem pasta" e as pastas em árvore. Cada
 * linha é alvo do arrasto (`data-solta-pasta`). Teclado de árvore (WAI-ARIA
 * tree): setas andam, → abre e ← fecha, Enter escolhe, F2 renomeia, Delete
 * apaga, Shift+F10 abre o menu, letra pula.
 *
 * Pasta dentro de pasta (17/11): com `arrastoDaPasta` a própria linha arrasta
 * até outra pasta (fica dentro dela) ou até o vazio da barra (`alvoDoTopo`:
 * volta para cima). Em quantos níveis houver: o recuo encolhe depois do 3º
 * nível para o nome caber, e o nome cortado mostra o caminho inteiro ao parar
 * o ponteiro em cima.
 *
 * Serve também à barra das REGIÕES de Lugares (16/11): ali as linhas são os
 * lugares que têm lugares dentro, em quantos níveis houver, e renomear, apagar
 * e criar não existem (o nome é o do lugar, mudado na página dele). Por isso
 * essas ações são opcionais: sem a função, a tecla e o botão não aparecem.
 */

export const TODAS = 'todas'
export const SEM = 'sem'
/** O alvo "para cima, fora de todas as pastas": o vazio da barra, no arrasto de uma pasta. */
export const TOPO = 'topo'

/** Recuo da linha e o a mais de cada nível, em px: cheio até o 3º nível, curto do 4º ao 7º, e para ali. */
const RECUO_DA_LINHA = 4
const RECUO_DO_NIVEL = 14
const NIVEIS_DE_RECUO_CHEIO = 3
const RECUO_CURTO = 6
const NIVEIS_DE_RECUO_CURTO = 4
const SEPARADOR_DO_CAMINHO = ' › '

/** Quanto a linha entra: a pasta funda continua com lugar para o nome na barra de 236 px. */
export function recuoDoNivel(nivel: number): number {
  const cheios = Math.min(nivel, NIVEIS_DE_RECUO_CHEIO)
  return RECUO_DA_LINHA + cheios * RECUO_DO_NIVEL + Math.min(nivel - cheios, NIVEIS_DE_RECUO_CURTO) * RECUO_CURTO
}

/** Uma linha da árvore, em ordem de árvore (pai antes dos de dentro). A pasta de verdade (`PastaNaArvore`) já tem esta forma. */
export interface RamoDaArvore {
  readonly pasta: { readonly id: string; readonly nome: string; readonly paiId?: string }
  readonly nivel: number
}

interface LinhaDaArvore {
  readonly id: string
  readonly nome: string
  /** "Frota › 2.Capitães › Navio": a dica do nome cortado. */
  readonly caminho: string
  readonly nivel: number
  readonly ehPasta: boolean
  readonly doGrimorio: boolean
  readonly comSubpastas: boolean
  readonly paiId: string | undefined
}

/** A linha da pasta como alça do arrasto (`useArrastoParaPasta` da pasta). */
export interface ArrastoDaPasta {
  readonly aoApertar: (id: string, evento: PointerEvent<HTMLElement>) => void
  /** O clique que vem logo depois do soltar não escolhe a pasta. */
  readonly acabouDeSoltar: () => boolean
}

export interface ArvoreDasPastasProps {
  arvore: readonly RamoDaArvore[]
  /** Ids das pastas que vieram do Grimório (o pontinho). */
  doGrimorio?: ReadonlySet<string>
  escolhida: string
  abertas: ReadonlySet<string>
  contas: ReadonlyMap<string, number>
  renomeando?: string | null
  /** Travado (importação, restauração): só escolher e abrir. */
  travado: boolean
  rodape: string
  /** O título da barra ("Pastas", "Regiões"). */
  titulo?: string
  /** Os nomes das duas linhas fixas ("Todos" / "Sem pasta"). */
  rotuloDeTodas?: string
  rotuloDeSem?: string
  /** O ícone das linhas da árvore (a pasta, por padrão). */
  icone?: ReactNode
  aoEscolher: (id: string) => void
  aoAlternar: (id: string) => void
  aoRenomear?: (id: string) => void
  /** `null` = desistiu. */
  aoTerminarRenomear?: (id: string, nome: string | null) => void
  aoApagar?: (id: string) => void
  aoAbrirMenu?: (id: string, gatilho: HTMLElement) => void
  aoNovaPasta?: (gatilho: HTMLElement) => void
  /** A pasta arrasta até outra; sem ele, a linha só recebe. */
  arrastoDaPasta?: ArrastoDaPasta
  /** O id de alvo do vazio da barra (o `TOPO`); sem ele, o vazio não recebe nada. */
  alvoDoTopo?: string
}

const NENHUMA: ReadonlySet<string> = new Set()

function CampoDoNome({ id, nome, aoTerminar }: { id: string; nome: string; aoTerminar: (id: string, nome: string | null) => void }) {
  const campo = useRef<HTMLInputElement>(null)
  const terminou = useRef(false)
  useEffect(() => {
    campo.current?.focus()
    campo.current?.select()
  }, [])
  const terminar = (valor: string | null) => {
    if (terminou.current) return
    terminou.current = true
    aoTerminar(id, valor)
  }
  return (
    <input
      ref={campo}
      type="text"
      className="pp-arvore__campo"
      defaultValue={nome}
      maxLength={NOME_DA_PASTA_MAX}
      aria-label="Nome da pasta"
      onClick={(evento) => evento.stopPropagation()}
      onKeyDown={(evento) => {
        evento.stopPropagation()
        if (evento.key === 'Enter') {
          evento.preventDefault()
          terminar(evento.currentTarget.value)
        } else if (evento.key === 'Escape') {
          evento.preventDefault()
          terminar(null)
        }
      }}
      onBlur={(evento) => terminar(evento.currentTarget.value)}
    />
  )
}

export function ArvoreDasPastas(props: ArvoreDasPastasProps) {
  const { arvore, escolhida, abertas, contas, travado, rodape } = props
  const doGrimorio = props.doGrimorio ?? NENHUMA
  const renomeando = props.renomeando ?? null
  const titulo = props.titulo ?? 'Pastas'
  const [foco, setFoco] = useState(escolhida)
  const raiz = useRef<HTMLDivElement>(null)

  const rotuloDeTodas = props.rotuloDeTodas ?? 'Todos'
  const rotuloDeSem = props.rotuloDeSem ?? 'Sem pasta'
  const linhas: LinhaDaArvore[] = [
    { id: TODAS, nome: rotuloDeTodas, caminho: rotuloDeTodas, nivel: 0, ehPasta: false, doGrimorio: false, comSubpastas: false, paiId: undefined },
    { id: SEM, nome: rotuloDeSem, caminho: rotuloDeSem, nivel: 0, ehPasta: false, doGrimorio: false, comSubpastas: false, paiId: undefined },
  ]
  // Quem está abaixo de uma linha fechada some, em qualquer profundidade.
  let escondeAbaixoDe = Number.POSITIVE_INFINITY
  const nomesAcima: string[] = []
  for (const [indice, { pasta, nivel }] of arvore.entries()) {
    nomesAcima.length = Math.min(nomesAcima.length, nivel)
    nomesAcima.push(pasta.nome)
    if (nivel > escondeAbaixoDe) continue
    escondeAbaixoDe = Number.POSITIVE_INFINITY
    const comSubpastas = (arvore[indice + 1]?.nivel ?? -1) > nivel
    const caminho = nomesAcima.join(SEPARADOR_DO_CAMINHO)
    linhas.push({ id: pasta.id, nome: pasta.nome, caminho, nivel, ehPasta: true, doGrimorio: doGrimorio.has(pasta.id), comSubpastas, paiId: nivel > 0 ? pasta.paiId : undefined })
    if (comSubpastas && !abertas.has(pasta.id)) escondeAbaixoDe = nivel
  }
  const focado = linhas.some((linha) => linha.id === foco) ? foco : escolhida
  const editavel = (linha: LinhaDaArvore) => linha.ehPasta && !travado

  const focarLinha = (id: string | undefined) => {
    if (id === undefined) return
    setFoco(id)
    requestAnimationFrame(() => raiz.current?.querySelector<HTMLElement>(`[data-linha="${CSS.escape(id)}"]`)?.focus())
  }

  const aoTeclar = (linha: LinhaDaArvore, indice: number, evento: KeyboardEvent<HTMLDivElement>) => {
    const pai = linha.paiId
    switch (evento.key) {
      case 'ArrowDown':
        focarLinha(linhas[indice + 1]?.id)
        break
      case 'ArrowUp':
        focarLinha(linhas[indice - 1]?.id)
        break
      case 'Home':
        focarLinha(linhas[0]?.id)
        break
      case 'End':
        focarLinha(linhas[linhas.length - 1]?.id)
        break
      case 'ArrowRight':
        if (!linha.comSubpastas) return
        if (abertas.has(linha.id)) focarLinha(linhas[indice + 1]?.id)
        else props.aoAlternar(linha.id)
        break
      case 'ArrowLeft':
        if (linha.comSubpastas && abertas.has(linha.id)) props.aoAlternar(linha.id)
        else if (pai !== undefined) focarLinha(pai)
        else return
        break
      case 'Enter':
      case ' ':
        props.aoEscolher(linha.id)
        break
      case 'F2':
        if (!editavel(linha) || props.aoRenomear === undefined) return
        props.aoRenomear(linha.id)
        break
      case 'Delete':
        if (!editavel(linha) || props.aoApagar === undefined) return
        props.aoApagar(linha.id)
        break
      case 'ContextMenu':
        if (!linha.ehPasta || props.aoAbrirMenu === undefined) return
        props.aoAbrirMenu(linha.id, evento.currentTarget)
        break
      case 'F10':
        if (!evento.shiftKey || !linha.ehPasta || props.aoAbrirMenu === undefined) return
        props.aoAbrirMenu(linha.id, evento.currentTarget)
        break
      default: {
        if (evento.key.length !== 1 || evento.ctrlKey || evento.altKey || evento.metaKey || !/\S/.test(evento.key)) return
        const letra = semAcento(evento.key)
        const seguintes = [...linhas.slice(indice + 1), ...linhas.slice(0, indice + 1)]
        focarLinha(seguintes.find((outra) => semAcento(outra.nome).startsWith(letra))?.id)
      }
    }
    evento.preventDefault()
  }

  const abrirMenu = (id: string, evento: MouseEvent<HTMLButtonElement>) => {
    evento.stopPropagation()
    props.aoAbrirMenu?.(id, evento.currentTarget)
  }
  const { aoNovaPasta, aoAbrirMenu, aoTerminarRenomear, arrastoDaPasta } = props
  /** A pasta pega pela linha (não pelo botão "…" nem pelo campo do nome). */
  const apertar = (linha: LinhaDaArvore, evento: PointerEvent<HTMLDivElement>) => {
    if (arrastoDaPasta === undefined || !linha.ehPasta || travado || renomeando !== null) return
    if (evento.target instanceof Element && evento.target.closest('button, input') !== null) return
    arrastoDaPasta.aoApertar(linha.id, evento)
  }
  const soltouAgora = () => arrastoDaPasta?.acabouDeSoltar() === true

  return (
    <nav className="pp-pastas" aria-label={titulo} data-solta-pasta={props.alvoDoTopo}>
      <div className="pp-pastas__cab">
        <h3 className="pp-pastas__tit" id="pp-pastas-titulo">
          {titulo}
        </h3>
        {aoNovaPasta !== undefined && (
          <button type="button" className="gr-bt gr-bt--ic gr-bt--p" aria-label="Nova pasta" title="Nova pasta" disabled={travado} onClick={(evento) => aoNovaPasta(evento.currentTarget)}>
            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false" className="pp-ic">
              <path d="M10 4v12M4 10h12" />
            </svg>
          </button>
        )}
      </div>
      <div className="pp-arvore" role="tree" aria-labelledby="pp-pastas-titulo" ref={raiz}>
        {linhas.map((linha, indice) => (
          <div key={linha.id} role="none">
            {linha.id === SEM ? null : indice === 2 ? <div className="pp-arvore__sep" role="none" /> : null}
            <div
              className="pp-linha"
              role="treeitem"
              aria-level={linha.nivel + 1}
              aria-selected={escolhida === linha.id}
              aria-expanded={linha.comSubpastas ? abertas.has(linha.id) : undefined}
              tabIndex={focado === linha.id ? 0 : -1}
              data-linha={linha.id}
              data-solta-pasta={linha.id === TODAS ? undefined : linha.id}
              style={{ paddingInlineStart: recuoDoNivel(linha.nivel) }}
              onFocus={() => setFoco(linha.id)}
              onPointerDown={(evento) => apertar(linha, evento)}
              onClick={() => {
                if (!soltouAgora()) props.aoEscolher(linha.id)
              }}
              onKeyDown={(evento) => {
                if (evento.target === evento.currentTarget) aoTeclar(linha, indice, evento)
              }}
              onContextMenu={(evento) => {
                if (!linha.ehPasta || aoAbrirMenu === undefined) return
                evento.preventDefault()
                aoAbrirMenu(linha.id, evento.currentTarget)
              }}
            >
              {linha.comSubpastas ? (
                <span
                  className="pp-linha__seta"
                  aria-hidden="true"
                  onClick={(evento) => {
                    evento.stopPropagation()
                    if (!soltouAgora()) props.aoAlternar(linha.id)
                  }}
                >
                  <IconeSeta />
                </span>
              ) : (
                <span className="pp-linha__seta pp-linha__seta--vazia" aria-hidden="true" />
              )}
              {linha.id === TODAS ? <IconePilha /> : linha.id === SEM ? <IconeBandeja /> : (props.icone ?? <IconePasta />)}
              <span className="pp-linha__nome" title={linha.caminho}>
                {renomeando === linha.id && aoTerminarRenomear !== undefined ? <CampoDoNome id={linha.id} nome={linha.nome} aoTerminar={aoTerminarRenomear} /> : linha.nome}
              </span>
              {linha.doGrimorio && <span className="pp-grimorio" title="Veio do Grimório" />}
              <span className="pp-linha__conta">{contas.get(linha.id) ?? 0}</span>
              {linha.ehPasta && aoAbrirMenu !== undefined && (
                <button type="button" className="pp-linha__mais" tabIndex={-1} aria-label={`Ações da pasta ${linha.nome}`} aria-haspopup="menu" onClick={(evento) => abrirMenu(linha.id, evento)}>
                  <IconeMais />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="pp-pastas__pe">
        <p className="pr-quieto">{rodape}</p>
      </div>
    </nav>
  )
}

/** As frases do arrasto de uma pasta: "Pôr dentro de Frota", "Levar para o topo". */
export const TEXTOS_DO_ARRASTO_DA_PASTA: TextosDoArrasto = {
  semAlvo: 'Solte numa pasta',
  antesDoAlvo: (alvo) => (alvo === TOPO || alvo === SEM ? 'Levar para ' : 'Pôr dentro de '),
  anuncio: 'Arrastando a pasta. Solte sobre outra pasta para pôr dentro dela, no vazio da barra das pastas para levar ao topo, ou Esc para desistir.',
}

/**
 * Por que a pasta `nome` não vai para `destino` (`null` = o topo), em
 * português do mestre. `curta` = a dica do arrasto, ao lado do ponteiro.
 */
export function fraseDaRecusaDaPasta(recusa: RecusaDaPasta, nome: string, destino: string | null, curta: boolean): string {
  switch (recusa) {
    case 'ela-mesma':
      return curta ? 'Solte em outra pasta' : `A pasta ${nome} não cabe dentro dela mesma.`
    case 'dentro-dela':
      return curta ? `Não cabe: ${destino ?? ''} fica dentro de ${nome}` : `A pasta ${nome} não cabe em ${destino ?? ''}, porque ${destino ?? ''} fica dentro dela.`
    case 'ja-esta':
      if (destino === null) return curta ? 'Já está no topo' : `A pasta ${nome} já está no topo.`
      return curta ? `Já está dentro de ${destino}` : `A pasta ${nome} já está dentro de ${destino}.`
    case 'outro-tipo':
    case 'nao-existe':
      return curta ? 'Solte numa pasta' : 'Essa pasta não existe mais.'
  }
}

interface OpcaoDaEscolha {
  readonly id: string
  readonly nome: string
  readonly nivel: number
  /** As de cima ("Frota › 2.Capitães"); vazio = de cima. */
  readonly acima: string
}

export interface EscolherPastaProps {
  aberto: boolean
  /** "Mover a pasta Navio". */
  titulo: string
  arvore: readonly RamoDaArvore[]
  /** As que não aparecem: a pasta que muda e as de dentro dela (ali ela não cabe). */
  escondidas: ReadonlySet<string>
  /** Onde está agora (`null` = no topo): aparece apagada, com "Já está aqui". */
  atual: string | null
  /** `null` = para o topo. */
  aoEscolher: (destino: string | null) => void
  aoFechar: () => void
}

/**
 * O "Mover para…" da pasta: procurar pelo nome, "Para o topo" e as pastas
 * onde ela cabe, em árvore (na busca, com o caminho embaixo). Setas andam,
 * Enter na busca escolhe a primeira achada.
 */
export function EscolherPasta({ aberto, titulo, arvore, escondidas, atual, aoEscolher, aoFechar }: EscolherPastaProps) {
  const [busca, setBusca] = useState('')
  const campo = useRef<HTMLInputElement>(null)
  const lista = useRef<HTMLUListElement>(null)
  const opcoes = useMemo(() => {
    const nomes: string[] = []
    const saida: OpcaoDaEscolha[] = []
    for (const { pasta, nivel } of arvore) {
      nomes.length = Math.min(nomes.length, nivel)
      const acima = nomes.join(SEPARADOR_DO_CAMINHO)
      nomes.push(pasta.nome)
      if (!escondidas.has(pasta.id)) saida.push({ id: pasta.id, nome: pasta.nome, nivel, acima })
    }
    return saida
  }, [arvore, escondidas])
  const limpa = semAcento(busca.trim())
  const achadas = limpa === '' ? opcoes : opcoes.filter((opcao) => semAcento(opcao.nome).includes(limpa))
  const botoes = () => Array.from(lista.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])

  const teclarNaBusca = (evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === 'ArrowDown') {
      evento.preventDefault()
      botoes()[0]?.focus()
    } else if (evento.key === 'Enter' && limpa !== '') {
      evento.preventDefault()
      const primeira = achadas.find((opcao) => opcao.id !== atual)
      if (primeira !== undefined) aoEscolher(primeira.id)
    }
  }
  const teclarNaLista = (evento: KeyboardEvent<HTMLUListElement>) => {
    const todos = botoes()
    const daVez = todos.findIndex((botao) => botao === document.activeElement)
    const destino = evento.key === 'ArrowDown' ? daVez + 1 : evento.key === 'ArrowUp' ? daVez - 1 : evento.key === 'Home' ? 0 : evento.key === 'End' ? todos.length - 1 : null
    if (destino === null) return
    evento.preventDefault()
    if (destino < 0) campo.current?.focus()
    else todos[Math.min(destino, todos.length - 1)]?.focus()
  }

  return (
    <Dialogo aberto={aberto} pequeno titulo={titulo} onFechar={aoFechar} focoInicial={campo} descricao="Escolha onde ela fica. As pastas e os verbetes de dentro vão junto.">
      <label className="pp-busca pp-escolher__busca">
        <span className="pr-sr">Procurar pasta</span>
        <IconeLupa />
        <input ref={campo} type="search" placeholder="Procurar pasta pelo nome" value={busca} autoComplete="off" onChange={(evento) => setBusca(evento.target.value)} onKeyDown={teclarNaBusca} />
      </label>
      <ul className="pp-escolher" ref={lista} aria-label="Para onde" onKeyDown={teclarNaLista}>
        <li>
          <button type="button" className="pp-escolher__item" disabled={atual === null} onClick={() => aoEscolher(null)}>
            <IconeSubir />
            <span className="pp-escolher__texto">
              <span className="pp-escolher__nome">Para o topo</span>
              <span className="pp-escolher__caminho">Fora de outras pastas</span>
            </span>
            {atual === null && <span className="pp-escolher__detalhe">Já está aqui</span>}
          </button>
        </li>
        {achadas.map((opcao) => (
          <li key={opcao.id}>
            <button
              type="button"
              className="pp-escolher__item"
              disabled={opcao.id === atual}
              style={limpa === '' ? { paddingInlineStart: 10 + recuoDoNivel(opcao.nivel) - RECUO_DA_LINHA } : undefined}
              title={opcao.acima === '' ? opcao.nome : `${opcao.acima}${SEPARADOR_DO_CAMINHO}${opcao.nome}`}
              onClick={() => aoEscolher(opcao.id)}
            >
              <IconePasta />
              <span className="pp-escolher__texto">
                <span className="pp-escolher__nome">{opcao.nome}</span>
                {limpa !== '' && opcao.acima !== '' && <span className="pp-escolher__caminho">em {opcao.acima}</span>}
              </span>
              {opcao.id === atual && <span className="pp-escolher__detalhe">Já está aqui</span>}
            </button>
          </li>
        ))}
      </ul>
      {achadas.length === 0 && <p className="pr-quieto pp-escolher__vazio">{limpa === '' ? 'Não há outra pasta onde ela caiba.' : `Nenhuma pasta com "${busca.trim()}" no nome.`}</p>}
    </Dialogo>
  )
}
