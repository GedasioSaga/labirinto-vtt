import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type MouseEvent, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { chaveDoNome } from '../../../lib/contasDosJogadores'
import { carregarNpcsProntos, INDICE_DOS_NPCS_PRONTOS, type ResumoDeNpcProntoDBT } from '../../../lib/dbt/dados/npcsProntos'
import { CATEGORIAS_DE_NPC, RANKS, type CategoriaDeNpcDBT, type ColecaoDeNpcProntoDBT, type NpcProntoDBT, type RankDBT } from '../../../lib/dbt/modelo'
import { NOME_DA_CATEGORIA } from '../../../lib/dbt/regras/ficha'
import { nomeNormalizado, type TabelaDeRanksDBT } from '../../../lib/dbt/regras/tecnicas'
import { modelosDeNpc, novaVariacao, soltarDoModelo } from '../../../lib/livros/combate'
import type { Personagem } from '../../../lib/personagem'
import type { SistemaDeRpg } from '../../../lib/sistemaDeRpg'
import { PERSONAGEM_NOME_MAX } from '../../../net/protocoloDoPersonagem'
import { gravarNoMundo, movimentoReduzido } from '../../livros/comum'
import { EP_MAXIMA, ND_MAXIMO, ND_SUGERIDO, notacaoDoNpc, personagemDeNpcEmBranco, personagemDoNpcPronto, variacaoInteira } from './contasDoMundo'
import { ResumoDoNpcDBT } from './ResumoDoNpcDBT'
import '../../livros/mundo.css'
import './mundoDBT.css'

/**
 * "Novo NPC" do bestiário Dragon Ball (plano docs/planos/sistema-dragon-ball.md,
 * item 9): um dos NPCs prontos das sagas e do Enma Daioh (busca e filtros,
 * prévia com a ficha que vai ser gravada), um NPC em branco (categoria, rank,
 * EP e atributos 8) ou a cópia de um NPC da pasta. O ND escolhido aqui dá
 * o PV (ND × vida por golpe). Grava pelo funil do mundo, com Desfazer.
 *
 * Cópia, não variação: sincronizarVariacoes (lib/livros/combate.ts) não leva
 * o bloco `dbt` do modelo, então uma variação ficaria com o PV do modelo e o
 * ND dela. A cópia nasce solta e cada uma se ajusta na própria ficha.
 */

export type ModoDoNovoNpcDBT = { tipo: 'novo'; modeloId?: string }

export interface NovoNpcDBTDialogProps {
  modo: ModoDoNovoNpcDBT
  sistema: SistemaDeRpg
  personagens: readonly Personagem[]
  ranks: TabelaDeRanksDBT
  onClose: () => void
  /** Gravou: o NPC novo e se a ficha dele deve abrir para preencher. */
  onFeito: (personagemId: string, abrirFicha: boolean) => void
}

const SAIDA_MS = 150
const PRONTO = 'pronto'
const BRANCO = 'branco'
const PREFIXO_DO_MODELO = 'modelo:'
const EP_DO_NPC_EM_BRANCO = 1
const FOCAVEIS = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const NOME_DA_COLECAO: Readonly<Record<ColecaoDeNpcProntoDBT, string>> = {
  saiyajins: 'Saiyajins',
  freeza: 'Freeza',
  'super-heroes': 'Super Heroes',
  'zero-humanos': 'Zero Humanos',
  broly: 'Broly',
  enma: 'Enma Daioh',
}

/** O grupo do filtro: a saga impressa ou, sem saga (Broly, Enma Daioh), a coleção. */
const grupoDoPronto = (resumo: ResumoDeNpcProntoDBT): string => resumo.saga ?? NOME_DA_COLECAO[resumo.colecao]
const GRUPOS = [...new Set(INDICE_DOS_NPCS_PRONTOS.map(grupoDoPronto))]

type FichasProntas = { estado: 'lendo' } | { estado: 'erro'; motivo: string } | { estado: 'lidas'; porId: ReadonlyMap<string, NpcProntoDBT> }

/** Campo vazio = null (escolher depois); inteiro dentro da faixa = ele; o resto é inválido. */
function lerInteiro(texto: string, minimo: number, maximo: number): number | null | 'invalido' {
  const limpo = texto.trim()
  if (limpo === '') return null
  const n = Number(limpo)
  return Number.isInteger(n) && n >= minimo && n <= maximo ? n : 'invalido'
}

function mensagemDoErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

interface EscolhaDoProntoProps {
  escolhidoId: string | null
  onEscolher: (resumo: ResumoDeNpcProntoDBT) => void
  buscaRef: RefObject<HTMLInputElement | null>
}

/** Busca, filtros (saga, categoria, rank) e a lista dos 41 NPCs prontos, com setas para andar nela. */
function EscolhaDoPronto({ escolhidoId, onEscolher, buscaRef }: EscolhaDoProntoProps) {
  const id = useId()
  const [busca, setBusca] = useState('')
  const [grupo, setGrupo] = useState('')
  const [categoria, setCategoria] = useState('')
  const [rank, setRank] = useState('')
  const listaRef = useRef<HTMLUListElement>(null)
  const procurado = nomeNormalizado(busca)
  const filtrados = INDICE_DOS_NPCS_PRONTOS.filter(
    (resumo) =>
      (procurado === '' || nomeNormalizado(resumo.nome).includes(procurado)) &&
      (grupo === '' || grupoDoPronto(resumo) === grupo) &&
      (categoria === '' || resumo.categoria === categoria) &&
      (rank === '' || resumo.rank === rank),
  )
  const indiceDoEscolhido = filtrados.findIndex((resumo) => resumo.id === escolhidoId)
  // Com o escolhido fora do filtro, a lista entra pelo primeiro (um item sempre recebe o Tab).
  const indiceComFoco = indiceDoEscolhido === -1 ? 0 : indiceDoEscolhido

  const aoTeclarNaLista = (event: KeyboardEvent<HTMLUListElement>) => {
    let j: number | null = null
    if (event.key === 'ArrowDown') j = Math.min(filtrados.length - 1, indiceComFoco + 1)
    else if (event.key === 'ArrowUp') j = Math.max(0, indiceComFoco - 1)
    else if (event.key === 'Home') j = 0
    else if (event.key === 'End') j = filtrados.length - 1
    const destino = j === null ? undefined : filtrados[j]
    if (destino === undefined) return
    event.preventDefault()
    escolherEFocar(destino)
  }

  const escolherEFocar = (resumo: ResumoDeNpcProntoDBT) => {
    onEscolher(resumo)
    listaRef.current?.querySelector<HTMLButtonElement>(`[data-pronto="${CSS.escape(resumo.id)}"]`)?.focus()
  }

  // Enter na busca escolhe o primeiro da lista em vez de enviar o formulário (criaria o NPC sem querer).
  const aoTeclarNaBusca = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    const primeiro = filtrados[0]
    if (primeiro !== undefined) escolherEFocar(primeiro)
  }

  return (
    <div>
      <div className="mu-campo">
        <label htmlFor={`${id}-busca`}>Procurar NPC pronto</label>
        <input
          ref={buscaRef}
          className="mu-entrada"
          id={`${id}-busca`}
          type="search"
          value={busca}
          autoComplete="off"
          placeholder="Ex.: Vegeta"
          onChange={(event) => setBusca(event.target.value)}
          onKeyDown={aoTeclarNaBusca}
        />
      </div>
      <div className="dbm-pronto__filtros">
        <select className="mu-seletor" aria-label="Saga" value={grupo} onChange={(event) => setGrupo(event.target.value)}>
          <option value="">Todas as sagas</option>
          {GRUPOS.map((nome) => (
            <option key={nome} value={nome}>
              {nome}
            </option>
          ))}
        </select>
        <select className="mu-seletor" aria-label="Categoria" value={categoria} onChange={(event) => setCategoria(event.target.value)}>
          <option value="">Toda categoria</option>
          {CATEGORIAS_DE_NPC.map((valor) => (
            <option key={valor} value={valor}>
              {NOME_DA_CATEGORIA[valor]}
            </option>
          ))}
        </select>
        <select className="mu-seletor" aria-label="Rank" value={rank} onChange={(event) => setRank(event.target.value)}>
          <option value="">Todo rank</option>
          {RANKS.map((valor) => (
            <option key={valor} value={valor}>
              Rank {valor}
            </option>
          ))}
        </select>
      </div>
      {filtrados.length === 0 ? (
        <p className="mu-pg-nota" role="status">
          Nenhum NPC pronto com esse nome e esses filtros.
        </p>
      ) : (
        <ul ref={listaRef} className="dbm-pronto__lista" aria-label={`NPCs prontos: ${filtrados.length} de ${INDICE_DOS_NPCS_PRONTOS.length}`} onKeyDown={aoTeclarNaLista}>
          {filtrados.map((resumo, i) => (
            <li key={resumo.id}>
              <button
                type="button"
                className="dbm-pronto__item"
                data-pronto={resumo.id}
                aria-pressed={resumo.id === escolhidoId}
                tabIndex={i === indiceComFoco ? 0 : -1}
                onClick={() => onEscolher(resumo)}
              >
                <span className="dbm-pronto__nome">{resumo.nome}</span>
                <span className="dbm-pronto__ep">EP {resumo.ep}</span>
                <span className="dbm-pronto__sub">
                  {grupoDoPronto(resumo)} · {NOME_DA_CATEGORIA[resumo.categoria]} · Rank {resumo.rank}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function NovoNpcDBTDialog({ modo, sistema, personagens, ranks, onClose, onFeito }: NovoNpcDBTDialogProps) {
  const id = useId()
  const dialogRef = useRef<HTMLFormElement>(null)
  const nomeRef = useRef<HTMLInputElement>(null)
  const buscaRef = useRef<HTMLInputElement>(null)
  const apertouNoFundo = useRef(false)
  const modelos = modelosDeNpc(personagens)
  const primeiroPronto = INDICE_DOS_NPCS_PRONTOS[0]

  /** O nome que ainda não existe na pasta: "Saibaman", "Saibaman 2", "Saibaman 3"... */
  const nomeLivre = (base: string): string => {
    const usados = new Set(personagens.map((personagem) => chaveDoNome(personagem.nome)))
    let candidato = base
    for (let n = 2; usados.has(chaveDoNome(candidato)); n++) candidato = `${base} ${n}`
    return candidato.slice(0, PERSONAGEM_NOME_MAX)
  }

  const [comeco, setComeco] = useState(() => (modo.modeloId !== undefined ? `${PREFIXO_DO_MODELO}${modo.modeloId}` : PRONTO))
  const [prontoId, setProntoId] = useState<string | null>(primeiroPronto?.id ?? null)
  const [nome, setNome] = useState(() => {
    const modeloInicial = modo.modeloId === undefined ? undefined : modelos.find((modelo) => modelo.id === modo.modeloId)
    if (modeloInicial !== undefined) return nomeLivre(modeloInicial.nome)
    return modo.modeloId === undefined && primeiroPronto !== undefined ? nomeLivre(primeiroPronto.nome) : ''
  })
  /** O mestre digitou o nome: escolher outro NPC pronto não troca mais. */
  const [nomeMexido, setNomeMexido] = useState(false)
  const [ndTexto, setNdTexto] = useState(String(ND_SUGERIDO))
  const [categoria, setCategoria] = useState<CategoriaDeNpcDBT>('comum')
  const [rank, setRank] = useState<RankDBT>('E')
  const [epTexto, setEpTexto] = useState(String(EP_DO_NPC_EM_BRANCO))
  const [fichas, setFichas] = useState<FichasProntas>({ estado: 'lendo' })
  const [leitura, setLeitura] = useState(0)
  const [erro, setErro] = useState<string | null>(null)
  const [gravando, setGravando] = useState(false)
  const [saindo, setSaindo] = useState(false)

  const modeloEscolhido = comeco.startsWith(PREFIXO_DO_MODELO) ? modelos.find((modelo) => `${PREFIXO_DO_MODELO}${modelo.id}` === comeco) : undefined
  const nd = lerInteiro(ndTexto, 1, ND_MAXIMO)
  const ep = lerInteiro(epTexto, 0, EP_MAXIMA)
  const npcPronto = fichas.estado === 'lidas' && prontoId !== null ? fichas.porId.get(prontoId) : undefined

  // As fichas completas só baixam com o diálogo aberto (o módulo é grande); a lista usa o índice leve enquanto isso.
  useEffect(() => {
    let vivo = true
    carregarNpcsProntos().then(
      (lista) => {
        if (vivo) setFichas({ estado: 'lidas', porId: new Map(lista.map((npc) => [npc.id, npc])) })
      },
      (motivo: unknown) => {
        if (vivo) setFichas({ estado: 'erro', motivo: mensagemDoErro(motivo) })
      },
    )
    return () => {
      vivo = false
    }
  }, [leitura])

  useEffect(() => {
    const abriu = document.activeElement
    if (comeco === PRONTO) buscaRef.current?.focus()
    else {
      nomeRef.current?.focus()
      nomeRef.current?.select()
    }
    return () => {
      if (abriu instanceof HTMLElement && abriu !== document.body && abriu.isConnected) abriu.focus()
    }
    // Só na abertura: trocar o começo depois não rouba o foco do seletor.
  }, [])

  const nomeLimpo = nome.trim().slice(0, PERSONAGEM_NOME_MAX)
  const ndDaFicha = nd === 'invalido' ? null : nd
  const previa = useMemo((): Personagem | null => {
    if (comeco === PRONTO) return npcPronto === undefined ? null : personagemDoNpcPronto(sistema, npcPronto, ndDaFicha, nomeLimpo || npcPronto.nome)
    if (comeco === BRANCO) return personagemDeNpcEmBranco(sistema, nomeLimpo, { categoria, rank, nd: ndDaFicha, ep: ep === 'invalido' || ep === null ? EP_DO_NPC_EM_BRANCO : ep })
    return modeloEscolhido ?? null
  }, [comeco, npcPronto, sistema, ndDaFicha, nomeLimpo, categoria, rank, ep, modeloEscolhido])

  const fechar = () => {
    if (saindo) return
    setSaindo(true)
    window.setTimeout(onClose, movimentoReduzido() ? 0 : SAIDA_MS)
  }

  const trocarComeco = (novo: string) => {
    setComeco(novo)
    setErro(null)
    if (nomeMexido) return
    const modelo = novo.startsWith(PREFIXO_DO_MODELO) ? modelos.find((candidato) => `${PREFIXO_DO_MODELO}${candidato.id}` === novo) : undefined
    const resumo = INDICE_DOS_NPCS_PRONTOS.find((candidato) => candidato.id === prontoId)
    if (novo === PRONTO && resumo !== undefined) setNome(nomeLivre(resumo.nome))
    else if (modelo !== undefined) setNome(nomeLivre(modelo.nome))
    else setNome('')
  }

  const escolherPronto = (resumo: ResumoDeNpcProntoDBT) => {
    setProntoId(resumo.id)
    if (!nomeMexido) setNome(nomeLivre(resumo.nome))
  }

  /** A ficha que o formulário monta, ou a frase do que falta. */
  const montar = (): { ficha: Personagem } | { erro: string } => {
    if (nomeLimpo.length === 0) return { erro: 'Dê um nome ao NPC.' }
    if (personagens.some((personagem) => chaveDoNome(personagem.nome) === chaveDoNome(nomeLimpo))) return { erro: `Já existe “${nomeLimpo}” neste livro. Use outro nome.` }
    if (modeloEscolhido !== undefined) return { ficha: variacaoInteira(soltarDoModelo(novaVariacao(modeloEscolhido, nomeLimpo))) }
    if (nd === 'invalido') return { erro: `O ND é um número inteiro de 1 a ${ND_MAXIMO}, ou em branco para escolher depois.` }
    if (comeco === BRANCO) {
      if (ep === 'invalido') return { erro: `A EP é um número inteiro de 0 a ${EP_MAXIMA}.` }
      return { ficha: personagemDeNpcEmBranco(sistema, nomeLimpo, { categoria, rank, nd, ep: ep ?? EP_DO_NPC_EM_BRANCO }) }
    }
    if (comeco === PRONTO) {
      if (npcPronto === undefined) return { erro: fichas.estado === 'lidas' ? 'Escolha um NPC pronto na lista.' : 'As fichas do livro ainda não abriram.' }
      return { ficha: personagemDoNpcPronto(sistema, npcPronto, nd, nomeLimpo) }
    }
    return { erro: 'Esse modelo não está mais no bestiário. Escolha outro começo.' }
  }

  const enviar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (gravando) return
    const montado = montar()
    if ('erro' in montado) {
      setErro(montado.erro)
      nomeRef.current?.focus()
      return
    }
    const { ficha } = montado
    setGravando(true)
    const de = modeloEscolhido !== undefined ? ` como cópia de ${modeloEscolhido.nome}` : npcPronto !== undefined && comeco === PRONTO ? ` a partir de ${npcPronto.nome}` : ''
    const gravou = await gravarNoMundo((lista) => [...lista, ficha], {
      texto: `${ficha.nome} entrou no bestiário${de}.`,
      desfazer: (lista) => lista.filter((personagem) => personagem.id !== ficha.id),
    })
    setGravando(false)
    if (!gravou) return
    onFeito(ficha.id, comeco === BRANCO)
    fechar()
  }

  function aoTeclar(event: KeyboardEvent<HTMLFormElement>) {
    // Janela modal: nenhuma tecla daqui vale para o mundo (Esc fecharia ele) nem para o editor atrás.
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      fechar()
      return
    }
    if (event.key !== 'Tab') return
    const itens = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCAVEIS) ?? [])
    const primeiro = itens[0]
    const ultimo = itens[itens.length - 1]
    if (primeiro === undefined || ultimo === undefined) return
    if (event.shiftKey && document.activeElement === primeiro) {
      event.preventDefault()
      ultimo.focus()
    } else if (!event.shiftKey && document.activeElement === ultimo) {
      event.preventDefault()
      primeiro.focus()
    }
  }

  function aoClicarNoFundo(event: MouseEvent<HTMLDivElement>) {
    if (apertouNoFundo.current && event.target === event.currentTarget) fechar()
    apertouNoFundo.current = false
  }

  let dica: string
  if (comeco === PRONTO) dica = 'Ficha impressa do livro: atributos, PK, CA, EP, técnicas, passivas e transformações. O PV sai do ND.'
  else if (comeco === BRANCO) dica = 'Atributos em 8 e nenhuma técnica: a ficha abre em seguida para você preencher.'
  else dica = modeloEscolhido === undefined ? '' : `Copia a ficha de ${modeloEscolhido.nome} com outro nome. Depois cada um se ajusta na própria ficha.`

  return createPortal(
    <div
      className={saindo ? 'mu-modal-fundo mu-modal-fundo--saindo' : 'mu-modal-fundo'}
      onMouseDown={(event) => (apertouNoFundo.current = event.target === event.currentTarget)}
      onClick={aoClicarNoFundo}
    >
      <form
        ref={dialogRef}
        className="mu-modal dbm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-tit`}
        aria-describedby={`${id}-sub`}
        noValidate
        onSubmit={(event) => void enviar(event)}
        onKeyDown={aoTeclar}
      >
        <div className="mu-modal__cab">
          <h2 className="mu-modal__tit" id={`${id}-tit`}>
            Novo NPC de combate
          </h2>
          <p className="mu-modal__sub" id={`${id}-sub`}>
            Um NPC pronto das sagas, uma ficha em branco ou a cópia de um NPC que já está aqui.
          </p>
        </div>
        <div className="mu-modal__corpo dbm">
          <div className="mu-campo">
            <label htmlFor={`${id}-comeco`}>Começa de</label>
            <select className="mu-seletor" id={`${id}-comeco`} value={comeco} aria-describedby={`${id}-dica`} onChange={(event) => trocarComeco(event.target.value)}>
              <option value={PRONTO}>NPC pronto do livro</option>
              <option value={BRANCO}>Ficha em branco</option>
              {modelos.length > 0 && (
                <optgroup label="Cópia de um NPC da pasta">
                  {modelos.map((modelo) => (
                    <option key={modelo.id} value={`${PREFIXO_DO_MODELO}${modelo.id}`}>
                      Como {modelo.nome}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <span className="mu-campo__dica" id={`${id}-dica`}>
              {dica}
            </span>
          </div>

          <div className="dbm-pronto">
            {comeco === PRONTO ? (
              <EscolhaDoPronto escolhidoId={prontoId} onEscolher={escolherPronto} buscaRef={buscaRef} />
            ) : comeco === BRANCO ? (
              <div className="dbm-linha">
                <div className="mu-campo">
                  <label htmlFor={`${id}-cat`}>Categoria</label>
                  <select className="mu-seletor" id={`${id}-cat`} value={categoria} onChange={(event) => setCategoria(CATEGORIAS_DE_NPC.find((valor) => valor === event.target.value) ?? 'comum')}>
                    {CATEGORIAS_DE_NPC.map((valor) => (
                      <option key={valor} value={valor}>
                        {NOME_DA_CATEGORIA[valor]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mu-campo">
                  <label htmlFor={`${id}-rank`}>Rank</label>
                  <select className="mu-seletor" id={`${id}-rank`} value={rank} onChange={(event) => setRank(RANKS.find((valor) => valor === event.target.value) ?? 'E')}>
                    {RANKS.map((valor) => (
                      <option key={valor} value={valor}>
                        Rank {valor}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mu-campo">
                  <label htmlFor={`${id}-ep`}>EP</label>
                  <input className="mu-entrada" id={`${id}-ep`} inputMode="numeric" value={epTexto} onChange={(event) => setEpTexto(event.target.value)} aria-describedby={`${id}-ep-dica`} />
                  <span className="mu-campo__dica" id={`${id}-ep-dica`}>
                    Escala de Poder: igual à do grupo é combate equilibrado.
                  </span>
                </div>
              </div>
            ) : (
              <p className="mu-pg-nota">A cópia nasce com a ficha inteira do original e PV e PK cheios.</p>
            )}
            <PreviaDoNpc previa={previa} ranks={ranks} fichas={fichas} pedirPronto={comeco === PRONTO} onTentarDeNovo={() => {
                setFichas({ estado: 'lendo' })
                setLeitura((n) => n + 1)
              }}
            />
          </div>

          <div className="dbm-linha">
            <div className="mu-campo">
              <label htmlFor={`${id}-nome`}>Nome</label>
              <input
                ref={nomeRef}
                className="mu-entrada"
                id={`${id}-nome`}
                value={nome}
                maxLength={PERSONAGEM_NOME_MAX}
                autoComplete="off"
                aria-invalid={erro !== null}
                aria-describedby={erro !== null ? `${id}-erro` : undefined}
                onChange={(event) => {
                  setNome(event.target.value)
                  setNomeMexido(true)
                  setErro(null)
                }}
              />
              {erro !== null && (
                <span className="mu-campo__erro" id={`${id}-erro`} role="alert">
                  {erro}
                </span>
              )}
            </div>
            {modeloEscolhido === undefined && (
              <div className="mu-campo">
                <label htmlFor={`${id}-nd`}>ND (golpes que aguenta)</label>
                <input
                  className="mu-entrada"
                  id={`${id}-nd`}
                  inputMode="numeric"
                  value={ndTexto}
                  aria-invalid={nd === 'invalido'}
                  aria-describedby={`${id}-nd-dica`}
                  onChange={(event) => {
                    setNdTexto(event.target.value)
                    setErro(null)
                  }}
                />
                <span className="mu-campo__dica" id={`${id}-nd-dica`}>
                  PV = ND × vida por golpe do rank. Em branco: escolhe depois na ficha.
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="mu-modal__pe">
          <button type="button" className="mu-bt" onClick={fechar}>
            Cancelar
          </button>
          <button type="submit" className="mu-bt mu-bt--primario" disabled={gravando}>
            {gravando ? 'Guardando…' : 'Criar no bestiário'}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  )
}

interface PreviaDoNpcProps {
  previa: Personagem | null
  ranks: TabelaDeRanksDBT
  fichas: FichasProntas
  /** O começo é um NPC pronto: a prévia depende das fichas do livro. */
  pedirPronto: boolean
  onTentarDeNovo: () => void
}

/** A ficha que vai ser gravada, com os números já calculados (o ND entra na hora). */
function PreviaDoNpc({ previa, ranks, fichas, pedirPronto, onTentarDeNovo }: PreviaDoNpcProps) {
  if (pedirPronto && fichas.estado === 'lendo') {
    return (
      <div className="dbm-previa" aria-busy="true">
        <p className="mu-pg-nota">Abrindo as fichas do livro…</p>
      </div>
    )
  }
  if (pedirPronto && fichas.estado === 'erro') {
    return (
      <div className="dbm-previa" role="alert">
        <p className="mu-pg-nota">Não deu para abrir as fichas prontas: {fichas.motivo}.</p>
        <button type="button" className="mu-bt mu-bt--p" onClick={onTentarDeNovo}>
          Tentar de novo
        </button>
      </div>
    )
  }
  if (previa === null) {
    return (
      <div className="dbm-previa">
        <p className="mu-pg-nota">Escolha um NPC na lista para ver a ficha.</p>
      </div>
    )
  }
  const npc = previa.dbt?.npc
  return (
    <section className="dbm-previa" aria-label={`Prévia de ${previa.nome}`} aria-live="polite">
      <div>
        <h3 className="dbm-previa__nome">{previa.nome}</h3>
        {npc !== undefined && <p className="dbm-notacao">{notacaoDoNpc(npc)}</p>}
      </div>
      <ResumoDoNpcDBT personagem={previa} ranks={ranks} />
    </section>
  )
}
