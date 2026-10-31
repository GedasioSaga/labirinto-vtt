import { useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent, type ReactNode, type Ref, type UIEvent } from 'react'
import { CUSTO_MAX } from '../../lib/batalha/combate'
import { ContaComBonus } from './ContaComBonus'
import { lerInteiro, textoDaCarga, type EvolucaoNaTela, type GolpeNaTela, type LinhaDaLeitura, type PipDaVez } from './dadosDoMenu'
import './batalha.css'
import './combate.css'

/**
 * AS TIRAS DO MENU DE BATALHA (o `.tira` do protótipo aprovado) e a LISTA DE
 * TÉCNICAS (Atacar com as armas, Habilidades): tiras com nome, descrição,
 * custo à direita ("45 SP", "? SP"), chips Ação · Dano · Tempo, apagadas com
 * o motivo, e a LEITURA da escolhida (pedido de 30/10: "expandir para a pessoa
 * ler a habilidade"): o texto inteiro da ficha (descrição, efeito, dano com a
 * fórmula e a conta, ação, custo, tempo, os extras) numa caixa ao lado da
 * lista quando cabe, ou aberta no lugar, sob a tira, quando não cabe; com
 * rolagem própria.
 *
 * Teclado: setas sobem e descem (a seleção e a leitura seguem o foco), seta
 * para a direita ou Espaço abrem e fecham a leitura, PageUp e PageDown rolam
 * o texto, Enter escolhe, seta para a esquerda fecha a leitura (ou volta), Esc
 * volta. O mouse escolhe a tira passando por cima; no toque, o primeiro toque
 * lê e o segundo escolhe. Tira apagada recebe foco (para o motivo ser lido) e
 * não escolhe.
 *
 * Tipos de habilidade F4: as marcas "Evolui", "Evoluída", "Evoluiu" e "2
 * opções" nos chips; no alto da leitura da técnica que ainda evolui, o
 * Evoluir (custo em SP opcional, o motivo quando não pode). Dentro dele as
 * teclas são do campo; Esc volta à tira.
 */

const GIROS = [-3, -1.6, -2.6, -1.2, -3.4, -2] as const

/** PRNG pequeno e determinístico (o mesmo rasgo para a mesma tira a cada render). */
function mulberry32(semente: number): () => number {
  let a = semente >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A borda rasgada da tira (protótipo `rasgo`): pontos aleatórios em volta, com a mesma semente. */
function rasgo(semente: number, amplitude = 4): string {
  const r = mulberry32(semente)
  const n = 28
  const pontos: string[] = []
  for (let i = 0; i <= n; i += 1) pontos.push(`${((i / n) * 100).toFixed(2)}% ${(r() * amplitude).toFixed(1)}px`)
  for (let i = 1; i <= 3; i += 1) pontos.push(`calc(100% - ${(r() * amplitude * 1.6).toFixed(1)}px) ${i * 25}%`)
  for (let i = n; i >= 0; i -= 1) pontos.push(`${((i / n) * 100).toFixed(2)}% calc(100% - ${(r() * amplitude).toFixed(1)}px)`)
  for (let i = 3; i >= 1; i -= 1) pontos.push(`${(r() * amplitude * 1.6).toFixed(1)}px ${i * 25}%`)
  return `polygon(${pontos.join(',')})`
}

function sementeDe(texto: string): number {
  let h = 2166136261
  for (let i = 0; i < texto.length; i += 1) h = Math.imul(h ^ texto.charCodeAt(i), 16777619)
  return h >>> 0
}

export interface TiraProps {
  indice: number
  /** Dá a semente do rasgo. */
  chave: string
  nome: string
  /** À direita: o custo, a carga, o atalho. */
  lado?: string | null
  /** A linha de baixo; com `motivo`, o motivo toma o lugar. */
  detalhe?: string | null
  motivo?: string | null
  chips?: ReactNode
  esta: boolean
  forma?: boolean
  /** Tipos de habilidade F3: a tira da passiva (a sombra dourada). */
  passiva?: boolean
  pequena?: boolean
  expandida?: boolean
  controla?: string
  /** O id da leitura aberta desta tira (o leitor de tela lê o texto inteiro depois do nome). */
  descritaPor?: string
  onEscolher: () => void
  onFoco: () => void
  /** O mouse passou por cima (só mouse: no toque o "hover" vem junto do toque). */
  onApontar?: () => void
  refDaTira?: (elemento: HTMLButtonElement | null) => void
}

export function Tira({ indice, chave, nome, lado, detalhe, motivo, chips, esta, forma, passiva, pequena, expandida, controla, descritaPor, onEscolher, onFoco, onApontar, refDaTira }: TiraProps) {
  const estilo = useMemo(() => {
    const semente = sementeDe(chave)
    return {
      '--giro': `${GIROS[indice % GIROS.length]}deg`,
      '--rasgo': rasgo(semente),
      '--rasgo2': rasgo(semente + 101, 5),
      '--i': indice,
    } as CSSProperties
  }, [chave, indice])
  const classe = ['bt-tira', forma ? 'bt-tira--forma' : '', passiva ? 'bt-tira--passiva' : '', pequena ? 'bt-tira--pequena' : ''].filter(Boolean).join(' ')
  const linha = motivo ?? detalhe ?? null
  return (
    <button
      ref={refDaTira}
      type="button"
      className={classe}
      style={estilo}
      data-esta={esta ? 'sim' : 'nao'}
      data-tira={chave}
      aria-disabled={motivo ? true : undefined}
      aria-expanded={expandida}
      aria-controls={controla}
      aria-describedby={descritaPor}
      onFocus={onFoco}
      onPointerEnter={(evento) => {
        if (evento.pointerType === 'mouse') onApontar?.()
      }}
      onClick={() => {
        if (!motivo) onEscolher()
      }}
    >
      <span className="bt-tira__nome">{nome}</span>
      <span className="bt-tira__lado">{lado ?? ''}</span>
      {linha !== null && linha !== '' && <span className="bt-tira__det">{linha}</span>}
      {chips !== undefined && chips !== null && <span className="bt-tira__chips">{chips}</span>}
    </button>
  )
}

/** As setas andam entre as tiras; Home e End vão às pontas. Devolve se tratou a tecla. */
export function andarComSetas(evento: KeyboardEvent, tiras: readonly (HTMLButtonElement | null)[], atual: number): boolean {
  const total = tiras.length
  if (total === 0) return false
  let proxima: number | null = null
  if (evento.key === 'ArrowDown') proxima = (atual + 1) % total
  else if (evento.key === 'ArrowUp') proxima = (atual - 1 + total) % total
  else if (evento.key === 'Home') proxima = 0
  else if (evento.key === 'End') proxima = total - 1
  if (proxima === null) return false
  evento.preventDefault()
  tiras[proxima]?.focus()
  return true
}

/**
 * A coluna das tiras só rola para cima e para baixo. O foco que anda pelas
 * setas rola a coluna até a tira, e a ponta girada da tira em papel (com a
 * sombra) podia rolar a coluna para o lado também: a borda esquerda das tiras
 * sumia, cortando a primeira letra. Volta para o começo na hora.
 */
export function semRolarDeLado(evento: UIEvent<HTMLElement>) {
  const coluna = evento.currentTarget
  if (coluna.scrollLeft !== 0) coluna.scrollLeft = 0
}

/** A cabeça do menu: o nome e a economia da vez ("Simples 1 · Bônus 0 · Mov 2/4"). */
export function CabecaDaVez({ quem, pips, carga, titulo }: { quem: string; pips: readonly PipDaVez[] | null; carga: number; titulo?: string }) {
  const textoCarga = textoDaCarga(carga)
  return (
    <div className="bt-vez__cabeca">
      <h2 className="bt-vez__quem">{titulo === undefined ? quem : `${titulo}`}</h2>
      <div className="bt-vez__economia" aria-label={[...(pips ?? []).map((pip) => pip.texto), textoCarga].filter(Boolean).join(', ')}>
        {(pips ?? []).map((pip) => (
          <span key={pip.id} className="bt-pip" data-gasto={pip.gasto ? 'sim' : 'nao'} data-passou={pip.passou ? 'sim' : 'nao'} aria-hidden="true">
            {pip.texto}
          </span>
        ))}
        {textoCarga !== null && (
          <span className="bt-pip bt-pip--carga" aria-hidden="true">
            Carga {carga}
          </span>
        )}
      </div>
    </div>
  )
}

/** Tipos de habilidade F4: a marca da evolução ("Evolui", "Evoluída", "Evoluiu"), com o que ela quer dizer no título. */
export function MarcaDaEvolucao({ evolucao }: { evolucao: EvolucaoNaTela }) {
  const marca = evolucao.marca === 'Evolui' ? 'evolui' : evolucao.marca === 'Evoluída' ? 'evoluida' : 'evoluiu'
  return (
    <span className="bt-etq bt-etq--evolucao" data-marca={marca} title={evolucao.dica}>
      {evolucao.marca}
    </span>
  )
}

/** Tipos de habilidade F4: "2 opções", com as opções no título. */
export function MarcaDasOpcoes({ golpe }: { golpe: GolpeNaTela }) {
  if (golpe.opcoes === undefined) return null
  return (
    <span className="bt-etq bt-etq--opcoes" title={`Um ou outro: ${golpe.opcoes.map((opcao) => opcao.rotulo).join(' ou ')}. A escolha é na mira.`}>
      {golpe.opcoes.length} opções
    </span>
  )
}

/** Os chips Ação · Dano · Tempo de um golpe. */
export function ChipsDoGolpe({ golpe }: { golpe: GolpeNaTela }) {
  return (
    <>
      {golpe.tipoTexto !== undefined && (
        <span
          className="bt-etq bt-etq--tipo"
          data-natureza={golpe.alvosDeMod === undefined ? undefined : golpe.selo?.natureza}
          title={golpe.tipoInferido === true ? `Tipo: ${golpe.tipoTexto} (pela Ação; o campo Tipo da ficha está vazio)` : `Tipo: ${golpe.tipoTexto}`}
        >
          {golpe.tipoTexto}
        </span>
      )}
      {golpe.evolucao !== undefined && <MarcaDaEvolucao evolucao={golpe.evolucao} />}
      <MarcaDasOpcoes golpe={golpe} />
      {golpe.forma !== undefined && <span className="bt-etq bt-etq--forma">{golpe.forma}</span>}
      {golpe.categoria !== undefined && <span className="bt-etq bt-etq--categoria">{golpe.categoria}</span>}
      {golpe.capacidade !== undefined && <span className="bt-etq" title={`Capacidade: ${golpe.capacidade}`}>Cap. {golpe.capacidade}</span>}
      <span className="bt-etq">{golpe.acaoTexto}</span>
      {!golpe.dano.semDano && <span className="bt-etq bt-etq--dano">{golpe.dano.valor === null ? 'Dano: fórmula' : `Dano ${golpe.dano.valor}`}</span>}
      {golpe.tempoTexto !== null && <span className={golpe.overload ? 'bt-etq bt-etq--over' : 'bt-etq'}>{golpe.tempoTexto}</span>}
      {golpe.overload && golpe.tempoTexto !== 'Overload' && <span className="bt-etq bt-etq--over">Overload</span>}
      {golpe.perfurante && <span className="bt-etq">Perfurante</span>}
      {golpe.balas !== undefined && <span className="bt-etq">{golpe.balas.length === 1 ? '1 tipo de bala' : `${golpe.balas.length} tipos de bala`}</span>}
    </>
  )
}

export interface ListaDeTecnicasProps {
  /** "Atacar" ou "Habilidades". */
  titulo: string
  pips: readonly PipDaVez[] | null
  carga: number
  golpes: readonly GolpeNaTela[]
  onEscolher: (golpe: GolpeNaTela) => void
  onVoltar: () => void
  /** "Escolher armas" no topo (o limite da ficha, Q1/Q8). `pendente` = ainda não escolheu. */
  armas?: { pendente: boolean; onAbrir: () => void }
  /** Aberta pelo teclado: as tiras entram na hora. */
  instantaneo?: boolean
  /** O que dizer sem golpe nenhum. */
  vazio: string
  /** Tipos de habilidade F4: o Evoluir na leitura da técnica que ainda evolui. Ausente = sem o botão. */
  evoluir?: EvoluirNaTela
}

/**
 * Tipos de habilidade F4: o Evoluir da leitura. `motivo` = por que não evolui
 * agora, com o custo digitado (`null` = pode); `onEvoluir` pede (`false` =
 * não saiu). Quem monta decide a regra (o mestre sempre; o jogador, na vez).
 */
export interface EvoluirNaTela {
  motivo: (cartaoId: string, custo: number | null) => string | null
  onEvoluir: (cartaoId: string, custo: number | null) => boolean
}

/** A leitura ao lado da lista: largura entre o mínimo e o máximo, com o vão até a lista e a folga até a borda da janela. */
const LEITURA_MIN = 280
const LEITURA_MAX = 420
const LEITURA_ALTURA_MIN = 160
const LEITURA_ALTURA_MAX = 600
const VAO_DA_LEITURA = 20
const FOLGA_DA_JANELA = 16

/** Onde a leitura mora: ao lado da lista (com a medida) ou no lugar, sob a tira. */
type LugarDaLeitura = { tipo: 'lado'; largura: number; topo: number; altura: number } | { tipo: 'lugar' }

function mesmoLugar(a: LugarDaLeitura, b: LugarDaLeitura): boolean {
  if (a.tipo === 'lugar' || b.tipo === 'lugar') return a.tipo === b.tipo
  return a.largura === b.largura && a.topo === b.topo && a.altura === b.altura
}

export function ListaDeTecnicas({ titulo, pips, carga, golpes, onEscolher, onVoltar, armas, instantaneo, vazio, evoluir }: ListaDeTecnicasProps) {
  const raiz = useRef<HTMLDivElement>(null)
  const coluna = useRef<HTMLUListElement>(null)
  const leitura = useRef<HTMLDivElement>(null)
  const tiras = useRef<(HTMLButtonElement | null)[]>([])
  /** O último toque (não mouse) numa tira: o primeiro toque lê, o segundo escolhe. */
  const toque = useRef<{ indice: number; jaLia: boolean } | null>(null)
  const [atual, setAtual] = useState(0)
  /** `null` = o padrão do lugar: aberta ao lado; fechada no lugar (aberta, ela empurra as tiras). */
  const [lendoEscolhido, setLendo] = useState<boolean | null>(null)
  const [lugar, setLugar] = useState<LugarDaLeitura>({ tipo: 'lugar' })
  const temArmas = armas !== undefined
  const total = golpes.length + (temArmas ? 1 : 0)
  tiras.current.length = total
  const golpeAtual = golpes[atual - (temArmas ? 1 : 0)]
  const lendo = lendoEscolhido ?? lugar.tipo === 'lado'
  const idDaLeitura = golpeAtual === undefined ? undefined : `bt-leitura-${golpeAtual.chave}`
  const chaveAtual = golpeAtual?.chave ?? null

  // Cabe ao lado? A sobra à direita da lista na janela (o livro aberto empurra a lista para a direita).
  useLayoutEffect(() => {
    const el = raiz.current
    if (el === null) return
    const medir = () => {
      const caixa = el.getBoundingClientRect()
      const sobra = Math.floor(window.innerWidth - caixa.right - VAO_DA_LEITURA - FOLGA_DA_JANELA)
      const topo = coluna.current?.offsetTop ?? 0
      const altura = Math.min(LEITURA_ALTURA_MAX, Math.max(LEITURA_ALTURA_MIN, Math.floor(window.innerHeight - caixa.top - topo - FOLGA_DA_JANELA)))
      const novo: LugarDaLeitura = sobra < LEITURA_MIN ? { tipo: 'lugar' } : { tipo: 'lado', largura: Math.min(LEITURA_MAX, sobra), topo, altura }
      setLugar((antes) => (mesmoLugar(antes, novo) ? antes : novo))
    }
    medir()
    window.addEventListener('resize', medir)
    const observador = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(medir)
    observador?.observe(el)
    return () => {
      window.removeEventListener('resize', medir)
      observador?.disconnect()
    }
  }, [])

  // Outra técnica: o texto começa do alto. No lugar, a leitura aberta fica à vista na coluna.
  useLayoutEffect(() => {
    const caixa = leitura.current
    if (caixa === null) return
    caixa.scrollTop = 0
    if (lugar.tipo === 'lugar') caixa.scrollIntoView({ block: 'nearest' })
  }, [chaveAtual, lendo, lugar.tipo])

  const escolher = (golpe: GolpeNaTela, indice: number) => {
    const tocou = toque.current
    toque.current = null
    // Sem mouse não há "passar por cima": o primeiro toque numa tira abre a leitura dela; o segundo escolhe.
    if (tocou !== null && tocou.indice === indice && !tocou.jaLia) {
      setAtual(indice)
      setLendo(true)
      return
    }
    onEscolher(golpe)
  }

  // Evoluiu: o bloco some da leitura; o foco volta à tira (a marca nova está nela).
  const evoluirAqui: EvoluirNaTela | undefined =
    evoluir === undefined
      ? undefined
      : {
          motivo: evoluir.motivo,
          onEvoluir: (cartaoId, custo) => {
            const saiu = evoluir.onEvoluir(cartaoId, custo)
            if (saiu) tiras.current[atual]?.focus()
            return saiu
          },
        }

  const teclar = (evento: KeyboardEvent<HTMLDivElement>) => {
    toque.current = null
    // No Evoluir as teclas são do campo e do botão (seta não troca de tira); Esc volta à tira.
    if (evento.target instanceof HTMLElement && evento.target.closest('.bt-evoluir') !== null) {
      if (evento.key === 'Escape') {
        evento.preventDefault()
        evento.stopPropagation()
        tiras.current[atual]?.focus()
      }
      return
    }
    if (andarComSetas(evento, tiras.current, atual)) return
    if (evento.key === 'Escape' || evento.key === 'ArrowLeft') {
      evento.preventDefault()
      evento.stopPropagation()
      if (lendo && golpeAtual !== undefined && evento.key === 'ArrowLeft') setLendo(false)
      else onVoltar()
      return
    }
    // → e Espaço numa tira de técnica abrem e fecham a leitura (Espaço ali não escolhe; "Escolher armas" e os botões seguem normais).
    const naTira = evento.target instanceof HTMLElement && evento.target.classList.contains('bt-tira')
    if ((evento.key === 'ArrowRight' || evento.key === ' ') && naTira && golpeAtual !== undefined) {
      evento.preventDefault()
      setLendo(!lendo)
      return
    }
    if ((evento.key === 'PageDown' || evento.key === 'PageUp') && lendo && leitura.current !== null) {
      evento.preventDefault()
      const passo = Math.round(leitura.current.clientHeight * 0.8)
      leitura.current.scrollBy({ top: evento.key === 'PageDown' ? passo : -passo })
    }
  }

  return (
    <div ref={raiz} className="bt-vez bt-vez--lista" data-instantaneo={instantaneo ? 'sim' : 'nao'} onKeyDown={teclar}>
      <CabecaDaVez quem={titulo} pips={pips} carga={carga} />
      {total === 0 ? (
        <p className="bt-vez__aviso">{vazio}</p>
      ) : (
        <ul ref={coluna} className="bt-vez__tiras" aria-label={titulo} onScroll={semRolarDeLado}>
          {temArmas && (
            <li>
              <Tira
                indice={0}
                chave="escolher-armas"
                nome={armas.pendente ? 'Escolher armas' : 'Trocar armas'}
                detalhe={armas.pendente ? 'A ficha tem limite de armas por batalha: escolha antes de atacar' : 'Troque as armas levadas, sempre dentro do limite'}
                pequena
                esta={atual === 0}
                onFoco={() => setAtual(0)}
                onApontar={() => setAtual(0)}
                onEscolher={armas.onAbrir}
                refDaTira={(elemento) => {
                  tiras.current[0] = elemento
                }}
              />
            </li>
          )}
          {golpes.map((golpe, i) => {
            const indice = i + (temArmas ? 1 : 0)
            const aberta = lendo && atual === indice
            const id = `bt-leitura-${golpe.chave}`
            return (
              <li
                key={golpe.chave}
                onPointerDown={(evento) => {
                  toque.current = evento.pointerType === 'mouse' ? null : { indice, jaLia: aberta }
                }}
              >
                <Tira
                  indice={indice}
                  chave={golpe.chave}
                  nome={golpe.nome}
                  lado={golpe.custoTexto}
                  detalhe={golpe.descricao || null}
                  motivo={golpe.motivo}
                  chips={<ChipsDoGolpe golpe={golpe} />}
                  forma={golpe.forma !== undefined}
                  esta={atual === indice}
                  expandida={aberta}
                  controla={aberta ? id : undefined}
                  descritaPor={aberta ? id : undefined}
                  onFoco={() => setAtual(indice)}
                  onApontar={() => setAtual(indice)}
                  onEscolher={() => escolher(golpe, indice)}
                  refDaTira={(elemento) => {
                    tiras.current[indice] = elemento
                  }}
                />
                {aberta && lugar.tipo === 'lugar' && <DetalheDoGolpe id={id} golpe={golpe} refDaCaixa={leitura} evoluir={evoluirAqui} />}
              </li>
            )
          })}
        </ul>
      )}
      {lendo && lugar.tipo === 'lado' && golpeAtual !== undefined && (
        <DetalheDoGolpe
          id={idDaLeitura}
          golpe={golpeAtual}
          comNome
          className="bt-detalhe--lado"
          style={{ left: `calc(100% + ${VAO_DA_LEITURA}px)`, top: lugar.topo, width: lugar.largura, maxHeight: lugar.altura }}
          refDaCaixa={leitura}
          evoluir={evoluirAqui}
        />
      )}
      <p className="bt-vez__dica">
        <kbd>↑</kbd> <kbd>↓</kbd> escolhe · <kbd>→</kbd> ou <kbd>Espaço</kbd> lê · <kbd>Enter</kbd> usa · <kbd>Esc</kbd> volta
      </p>
      <div className="bt-vez__rodape">
        <button type="button" className="bt-botao bt-botao--p" onClick={onVoltar}>
          Voltar
        </button>
        {golpeAtual !== undefined && (
          <button type="button" className="bt-botao bt-botao--p" aria-expanded={lendo} aria-controls={lendo ? idDaLeitura : undefined} onClick={() => setLendo(!lendo)}>
            {lendo ? 'Fechar o texto' : 'Ler o texto'}
          </button>
        )}
      </div>
    </div>
  )
}

export interface DetalheDoGolpeProps {
  id?: string
  golpe: GolpeNaTela
  /** A leitura ao lado da lista traz o nome e o custo no alto (no lugar, a tira logo acima já diz). */
  comNome?: boolean
  className?: string
  style?: CSSProperties
  refDaCaixa?: Ref<HTMLDivElement>
  /** Tipos de habilidade F4: o Evoluir, na técnica que ainda evolui. Ausente = só a leitura. */
  evoluir?: EvoluirNaTela
}

/**
 * As linhas da leitura: o texto da ficha; o custo que a mira pergunta; o
 * tempo como está nesta batalha ("1/2 usos"), quando difere da ficha; e o que
 * impede agora (o motivo). Ficha sem texto nenhum: a ação e a conta do dano.
 */
function linhasDoGolpe(golpe: GolpeNaTela): LinhaDaLeitura[] {
  const linhas: LinhaDaLeitura[] =
    golpe.leitura.length > 0
      ? golpe.leitura.map((linha) => (linha.campo === 'custo' && golpe.custo.tipo === 'pergunta' ? { ...linha, texto: `${linha.texto} (você confirma na mira)` } : linha))
      : [
          { rotulo: 'Ação', texto: golpe.acaoTexto },
          { rotulo: 'Dano', texto: golpe.dano.conta },
        ]
  const tempoDaFicha = golpe.leitura.find((linha) => linha.campo === 'tempo')?.texto ?? null
  if (golpe.tempoTexto !== null && golpe.tempoTexto !== tempoDaFicha) linhas.push({ rotulo: 'Nesta batalha', texto: golpe.tempoTexto })
  // Tipos de habilidade F4: o "Evolui para" escrito que não acha técnica: sem link, evoluir troca o efeito pelo da Evolução.
  const naoAchada = golpe.evolucao?.paraNaoAchada ?? null
  if (naoAchada !== null) linhas.push({ rotulo: 'Evolução', texto: `"${naoAchada}" não está entre as técnicas: evoluir troca o efeito pelo da Evolução` })
  if (golpe.motivo !== null) linhas.push({ rotulo: 'Agora', texto: golpe.motivo, campo: 'motivo' })
  return linhas
}

/** A leitura inteira de um golpe (na lista do jogador e na seta do painel do NPC no mestre), com rolagem própria. */
export function DetalheDoGolpe({ id, golpe, comNome, className, style, refDaCaixa, evoluir }: DetalheDoGolpeProps) {
  const evolucao = golpe.evolucao
  return (
    <div ref={refDaCaixa} className={className === undefined ? 'bt-detalhe' : `bt-detalhe ${className}`} id={id} style={style}>
      {comNome && (
        <p className="bt-detalhe__nome">
          <span>{golpe.nome}</span>
          {golpe.custoTexto !== null && <span className="bt-detalhe__custo">{golpe.custoTexto}</span>}
        </p>
      )}
      {evoluir !== undefined && evolucao?.podeEvoluir === true && golpe.cartaoId !== null && <EvoluirDaTecnica key={golpe.chave} cartaoId={golpe.cartaoId} evolucao={evolucao} evoluir={evoluir} />}
      <dl>
        {linhasDoGolpe(golpe).map((linha, i) => (
          <div key={`${i}:${linha.rotulo}`} className="bt-detalhe__linha" data-agora={linha.campo === 'motivo' ? 'sim' : undefined}>
            <dt>{linha.rotulo}</dt>
            {/* Tipos de habilidade F2: a conta do dano pinta o bônus dos selos de quem age ("+20 (Fúria)"). */}
            <dd>{linha.texto === golpe.dano.conta ? <ContaComBonus conta={linha.texto} bonus={golpe.bonus} /> : linha.texto}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** O custo digitado no Evoluir: só algarismos (o `lerInteiro` sozinho aceitaria "12a"). */
const SO_ALGARISMOS = /^[0-9]+$/

/**
 * Tipos de habilidade F4: o Evoluir no alto da leitura (é a única ação dela):
 * o destino ("Vira SUPER CAÇA AS BRUXAS!" ou "o efeito vira o da Evolução"),
 * o custo em SP opcional e o motivo quando não pode. A condição da Evolution
 * o app não confere: ela está no texto logo abaixo, e quem aperta decide.
 */
function EvoluirDaTecnica({ cartaoId, evolucao, evoluir }: { cartaoId: string; evolucao: EvolucaoNaTela; evoluir: EvoluirNaTela }) {
  const id = useId()
  const [custoTexto, setCustoTexto] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const limpo = custoTexto.trim()
  const custo = limpo === '' ? null : lerInteiro(limpo, CUSTO_MAX)
  const torto = limpo !== '' && (!SO_ALGARISMOS.test(limpo) || Number(limpo) > CUSTO_MAX)
  const motivo = torto ? `O custo é um número de 0 a ${CUSTO_MAX} (vazio = sem custo)` : evoluir.motivo(cartaoId, custo)
  const destino = evolucao.para !== null ? `vira ${evolucao.para}` : evolucao.overload ? 'o efeito vira o da Evolução, como Overload' : 'o efeito vira o da Evolução'

  const enviar = (evento: FormEvent) => {
    evento.preventDefault()
    if (motivo !== null) {
      setErro(motivo)
      return
    }
    const saiu = evoluir.onEvoluir(cartaoId, custo)
    setErro(saiu ? null : 'Não evoluiu: sem conexão com o mestre, ou a regra recusou. Tente de novo.')
  }

  return (
    <form className="bt-evoluir" onSubmit={enviar} aria-labelledby={`${id}-titulo`} noValidate>
      <p className="bt-evoluir__titulo" id={`${id}-titulo`}>
        Evoluir <span className="bt-evoluir__destino">· {destino}</span>
      </p>
      <div className="bt-evoluir__linha">
        <label className="bt-evoluir__custo">
          <span>Custo SP</span>
          <input
            className="bt-num"
            inputMode="numeric"
            value={custoTexto}
            placeholder="0"
            aria-invalid={torto ? true : undefined}
            onChange={(evento) => {
              setErro(null)
              setCustoTexto(evento.target.value)
            }}
          />
        </label>
        <button type="submit" className="bt-botao bt-botao--evoluir" disabled={motivo !== null} aria-describedby={`${id}-nota`}>
          Evoluir
        </button>
      </div>
      <p className={motivo === null ? 'bt-evoluir__nota' : 'bt-evoluir__nota bt-evoluir__nota--motivo'} id={`${id}-nota`}>
        {motivo ?? (evolucao.condicoes === '' ? 'Só nesta batalha, sem gastar ação.' : 'Só nesta batalha, sem gastar ação. A condição está no texto: o app não confere.')}
      </p>
      {erro !== null && erro !== motivo && (
        <p className="bt-evoluir__nota bt-evoluir__nota--motivo" role="alert">
          {erro}
        </p>
      )}
    </form>
  )
}
