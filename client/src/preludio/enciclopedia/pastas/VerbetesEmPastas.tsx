import { useCallback, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { MenuItem, MenuRotulo, MenuSeparador, Pop } from '../../../components/grimorio/Pop'
import { Torrada, Torradas } from '../../../components/grimorio/Torrada'
import { compararTitulos, naCampanha, ROTULO_DO_TIPO, semAcento, verbeteNovo } from '../../../lib/preparo/enciclopedia'
import {
  arvoreDasPastas,
  comAsPastasDoTipo,
  comPasta,
  comPastaIdComoEstava,
  momentoDoVerbete,
  nomeDaPastaLimpo,
  pastaDoVerbete,
  pastaEDeDentro,
  pastaNova,
  pastasDoTipo,
  renomeada,
  semAPasta,
  veioDoGrimorio,
} from '../../../lib/preparo/pastasDeVerbetes'
import type { PastaDeVerbetes, TipoDeVerbete, Verbete } from '../../../lib/preparo/tipos'
import { usePreludio } from '../../estado/preludio'
import { lugarDoVerbete, resumoDe } from '../ListaDeVerbetes'
import { useArrastoParaPasta } from './arrastarParaPasta'
import { ArvoreDasPastas, SEM, TODAS } from './ArvoreDasPastas'
import { CartaoDoVerbete } from './CartaoDoVerbete'
import { IconeGrade, IconeLista, IconeLivro, IconeLupa, IconePasta, IconeSeta } from './icones'
import './pastas.css'

/**
 * OS VERBETES EM PASTAS (E3, protótipo aprovado em 16/11, tela 1): a lista de
 * Personagens (e de Itens e Facções) com as pastas do Grimório de verdade.
 *
 * - À esquerda, as pastas: "Todos", "Sem pasta" e a árvore (um nível de
 *   subpasta); criar, renomear (F2) e apagar (as de dentro e os verbetes
 *   sobem, com Desfazer).
 * - À direita, os grupos recolhíveis por pasta, com a conta; arrastar o retrato
 *   até uma pasta (a pasta fechada abre se o retrato parar em cima), marcar
 *   vários e "Mover para…".
 * - Organizar: busca pelo nome e apelido, campanha, "Já é NPC" / "Sem ficha"
 *   (NPC = tem ficha ligada, `liga.fichas`), A–Z ou Recentes, retratos ou lista.
 *
 * As mudanças passam pela loja do Prelúdio: o verbete pelo salvar automático,
 * as pastas pelo índice (`mudarPastas`).
 */

/** Os tipos que ganham a lista com pastas (o Lugar fica em árvore, lugar dentro de lugar). */
export const TIPOS_COM_PASTAS: readonly TipoDeVerbete[] = ['personagem', 'item', 'faccao']

type FiltroDaFicha = 'todos' | 'npc' | 'sem'
type Ordem = 'az' | 'rec'
type Vista = 'grade' | 'lista'

type Menu = { readonly t: 'verbete'; readonly id: string } | { readonly t: 'pasta'; readonly id: string } | { readonly t: 'mover'; readonly ids: readonly string[] }

interface Aviso {
  readonly chave: number
  readonly texto: string
  readonly desfazer?: () => void
}

interface Grupo {
  readonly id: string
  readonly membros: readonly Verbete[]
}

const QUANDO = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })
const DIA_MS = 86_400_000
const UNIDADES: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * DIA_MS],
  ['month', 30 * DIA_MS],
  ['week', 7 * DIA_MS],
  ['day', DIA_MS],
]

function quando(ms: number): string {
  if (ms === 0) return 'sem data'
  const passou = ms - Date.now()
  for (const [unidade, tamanho] of UNIDADES) if (Math.abs(passou) >= tamanho) return QUANDO.format(Math.round(passou / tamanho), unidade)
  return 'hoje'
}

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`
}

export function ehNpc(verbete: Verbete): boolean {
  return (verbete.liga?.fichas.length ?? 0) > 0
}

function passaNaBusca(verbete: Verbete, busca: string): boolean {
  return busca === '' || semAcento(verbete.titulo).includes(busca) || verbete.apelidos.some((apelido) => semAcento(apelido).includes(busca))
}

export function VerbetesEmPastas({ tipo }: { tipo: TipoDeVerbete }) {
  const verbetes = usePreludio((estado) => estado.verbetes)
  const guardadas = usePreludio((estado) => estado.pastas)
  const campanhas = usePreludio((estado) => estado.campanhas)
  const campanhaId = usePreludio((estado) => estado.campanhaId)
  const travado = usePreludio((estado) => estado.travado)
  const ir = usePreludio((estado) => estado.ir)
  const criarVerbete = usePreludio((estado) => estado.criarVerbete)
  const mudarVerbete = usePreludio((estado) => estado.mudarVerbete)
  const mudarPastas = usePreludio((estado) => estado.mudarPastas)
  const escolherCampanha = usePreludio((estado) => estado.escolherCampanha)

  const [escolhida, setEscolhida] = useState(TODAS)
  const [fechadas, setFechadas] = useState<ReadonlySet<string>>(new Set())
  const [gruposFechados, setGruposFechados] = useState<ReadonlySet<string>>(new Set())
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<FiltroDaFicha>('todos')
  const [ordem, setOrdem] = useState<Ordem>('az')
  const [vista, setVista] = useState<Vista>('grade')
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(new Set())
  const [renomeando, setRenomeando] = useState<string | null>(null)
  const [nova, setNova] = useState<{ readonly pasta: PastaDeVerbetes; readonly levar: readonly string[] } | null>(null)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [menu, setMenu] = useState<Menu | null>(null)
  const [anuncio, setAnuncio] = useState('')
  const gatilho = useRef<HTMLElement | null>(null)
  const proximoMenu = useRef<Menu | null>(null)
  const raiz = useRef<HTMLDivElement>(null)

  const rotulo = ROTULO_DO_TIPO[tipo]
  const varios = rotulo.varios.toLowerCase()
  const um = rotulo.um.toLowerCase()
  const comFicha = tipo === 'personagem'

  // ─── O que a tela mostra ───────────────────────────────────────────────────
  const pastas = useMemo(() => pastasDoTipo(guardadas, verbetes.values(), tipo), [guardadas, verbetes, tipo])
  const pastasNaTela = useMemo(() => (nova === null ? pastas : [...pastas, nova.pasta]), [pastas, nova])
  const arvore = useMemo(() => arvoreDasPastas(pastasNaTela), [pastasNaTela])
  const idsDasPastas = useMemo(() => new Set(pastas.map((pasta) => pasta.id)), [pastas])
  const doGrimorio = useMemo(() => new Set(pastas.filter(veioDoGrimorio).map((pasta) => pasta.id)), [pastas])
  const nomeDaPasta = useMemo(() => new Map(pastasNaTela.map((pasta) => [pasta.id, pasta.nome])), [pastasNaTela])
  const doTipo = useMemo(() => [...verbetes.values()].filter((verbete) => verbete.tipo === tipo && naCampanha(verbete, campanhaId)), [verbetes, tipo, campanhaId])
  const pastaDe = useMemo(() => new Map(doTipo.map((verbete) => [verbete.id, pastaDoVerbete(verbete, idsDasPastas)])), [doTipo, idsDasPastas])

  const atual = escolhida === TODAS || escolhida === SEM || nomeDaPasta.has(escolhida) ? escolhida : TODAS
  const dentro = useMemo(() => (atual === TODAS || atual === SEM ? null : pastaEDeDentro(pastasNaTela, atual)), [atual, pastasNaTela])
  const naEscolhida = useCallback(
    (verbete: Verbete) => {
      const pasta = pastaDe.get(verbete.id) ?? null
      if (atual === TODAS) return true
      if (atual === SEM) return pasta === null
      return pasta !== null && dentro !== null && dentro.has(pasta)
    },
    [atual, dentro, pastaDe],
  )

  const contas = useMemo(() => {
    const saida = new Map<string, number>([
      [TODAS, doTipo.length],
      [SEM, 0],
    ])
    for (const pasta of doTipo.map((verbete) => pastaDe.get(verbete.id) ?? null)) {
      if (pasta === null) {
        saida.set(SEM, (saida.get(SEM) ?? 0) + 1)
        continue
      }
      saida.set(pasta, (saida.get(pasta) ?? 0) + 1)
      const pai = pastasNaTela.find((uma) => uma.id === pasta)?.paiId
      if (pai !== undefined) saida.set(pai, (saida.get(pai) ?? 0) + 1)
    }
    return saida
  }, [doTipo, pastaDe, pastasNaTela])

  const limpa = semAcento(busca.trim())
  const base = useMemo(() => doTipo.filter(naEscolhida), [doTipo, naEscolhida])
  const npcs = useMemo(() => base.filter(ehNpc).length, [base])
  const grupos = useMemo((): Grupo[] => {
    const passa = (verbete: Verbete) => passaNaBusca(verbete, limpa) && (!comFicha || filtro === 'todos' || (filtro === 'npc') === ehNpc(verbete))
    const filtradas = base.filter(passa)
    const ordenar = (lista: Verbete[]) =>
      lista.sort(ordem === 'az' ? (a, b) => compararTitulos(a.titulo, b.titulo) : (a, b) => momentoDoVerbete(b) - momentoDoVerbete(a) || compararTitulos(a.titulo, b.titulo))
    const ids = atual === TODAS ? [...arvore.map(({ pasta }) => pasta.id), SEM] : atual === SEM ? [SEM] : arvore.map(({ pasta }) => pasta.id).filter((id) => dentro?.has(id) === true)
    return ids
      .map((id) => ({ id, membros: ordenar(filtradas.filter((verbete) => (pastaDe.get(verbete.id) ?? null) === (id === SEM ? null : id))) }))
      .filter((grupo) => grupo.membros.length > 0 || (grupo.id === atual && !arvore.some(({ pasta }) => pasta.paiId === grupo.id)))
  }, [base, limpa, comFicha, filtro, ordem, atual, arvore, dentro, pastaDe])
  const visiveis = useMemo(() => grupos.flatMap((grupo) => grupo.membros.map((verbete) => verbete.id)), [grupos])

  // ─── Ações ─────────────────────────────────────────────────────────────────
  const anunciar = useCallback((texto: string) => setAnuncio(texto), [])
  const avisar = useCallback((texto: string, desfazer?: () => void) => setAviso({ chave: Date.now(), texto, desfazer }), [])

  /** As pastas do tipo como estão agora na loja (o que a tela leu pode ter ficado para trás dentro de um gesto). */
  const pastasAgora = useCallback(() => {
    const estado = usePreludio.getState()
    return pastasDoTipo(estado.pastas, estado.verbetes.values(), tipo)
  }, [tipo])

  const gravarPastas = useCallback((doTipoAgora: readonly PastaDeVerbetes[]) => mudarPastas(comAsPastasDoTipo(usePreludio.getState().pastas, tipo, doTipoAgora)), [mudarPastas, tipo])

  /** Antes de tirar alguém de uma pasta do Grimório, as pastas vão para o índice: a pasta que esvaziar não some. */
  const guardarAsDoGrimorio = useCallback(() => {
    const agora = pastasAgora()
    const noIndice = new Set(usePreludio.getState().pastas.map((pasta) => pasta.id))
    return agora.every((pasta) => noIndice.has(pasta.id)) || gravarPastas(agora)
  }, [gravarPastas, pastasAgora])

  const nomeDoDestino = useCallback((id: string | null) => (id === null ? 'Sem pasta' : (nomeDaPasta.get(id) ?? 'a pasta')), [nomeDaPasta])

  const mover = useCallback(
    (ids: readonly string[], destino: string | null) => {
      const estado = usePreludio.getState()
      const validas = new Set(pastasAgora().map((pasta) => pasta.id))
      const deVerdade = ids.filter((id) => estado.verbetes.has(id))
      if (deVerdade.length === 0 || estado.travado) return
      const pastaAtualDe = (id: string) => {
        const verbete = estado.verbetes.get(id)
        return verbete === undefined ? null : pastaDoVerbete(verbete, validas)
      }
      if (deVerdade.every((id) => pastaAtualDe(id) === destino)) {
        avisar(`Já estava em ${nomeDoDestino(destino)}.`)
        return
      }
      if (!guardarAsDoGrimorio()) return
      const antes = deVerdade.map((id): [string, string | undefined] => [id, estado.verbetes.get(id)?.pastaId])
      for (const id of deVerdade) mudarVerbete(id, (verbete) => comPasta(verbete, destino))
      setMarcados(new Set())
      const quem = deVerdade.length === 1 ? `${estado.verbetes.get(deVerdade[0])?.titulo || 'Sem nome'} foi` : `${plural(deVerdade.length, um, varios)} foram`
      avisar(`${quem} para ${nomeDoDestino(destino)}.`, () => {
        for (const [id, pastaId] of antes) mudarVerbete(id, (verbete) => comPastaIdComoEstava(verbete, pastaId))
        anunciar('Desfeito.')
      })
    },
    [anunciar, avisar, guardarAsDoGrimorio, mudarVerbete, nomeDoDestino, pastasAgora, um, varios],
  )

  const comecarPasta = (paiId: string | undefined, levar: readonly string[]) => {
    if (travado) return
    const pasta = pastaNova(tipo, 'Nova pasta', paiId)
    setNova({ pasta, levar })
    setRenomeando(pasta.id)
    if (paiId !== undefined) setFechadas((antes) => new Set([...antes].filter((id) => id !== paiId)))
  }

  const terminarRenomear = (id: string, bruto: string | null) => {
    setRenomeando(null)
    const nome = bruto === null ? '' : nomeDaPastaLimpo(bruto)
    if (nova !== null && nova.pasta.id === id) {
      setNova(null)
      if (nome === '') return
      const criada: PastaDeVerbetes = { ...nova.pasta, nome }
      if (!gravarPastas([...pastasAgora(), criada])) return
      if (nova.levar.length > 0) mover(nova.levar, criada.id)
      else avisar(`Pasta ${nome} criada. Arraste retratos para ela.`)
      return
    }
    const agora = pastasAgora()
    const antes = agora.find((pasta) => pasta.id === id)
    if (nome === '' || antes === undefined || antes.nome === nome) return
    if (!gravarPastas(renomeada(agora, id, nome))) return
    avisar(`Pasta renomeada para ${nome}.`, () => gravarPastas(renomeada(pastasAgora(), id, antes.nome)))
  }

  const apagar = (id: string) => {
    const estado = usePreludio.getState()
    const agora = pastasAgora()
    const apagada = agora.find((pasta) => pasta.id === id)
    if (apagada === undefined || estado.travado) return
    const validas = new Set(agora.map((pasta) => pasta.id))
    const membros = [...estado.verbetes.values()].filter((verbete) => verbete.tipo === tipo && pastaDoVerbete(verbete, validas) === id)
    const antes = membros.map((verbete): [string, string | undefined] => [verbete.id, verbete.pastaId])
    const destino = apagada.paiId ?? null
    if (!gravarPastas(semAPasta(agora, id))) return
    for (const verbete of membros) mudarVerbete(verbete.id, (atualDoVerbete) => comPasta(atualDoVerbete, destino))
    if (atual === id) setEscolhida(destino ?? TODAS)
    const foram = membros.length === 0 ? '' : ` ${plural(membros.length, `${um} foi`, `${varios} foram`)} para ${nomeDoDestino(destino)}.`
    avisar(`Pasta ${apagada.nome} apagada.${foram}`, () => {
      gravarPastas(agora)
      for (const [verbeteId, pastaId] of antes) mudarVerbete(verbeteId, (verbete) => comPastaIdComoEstava(verbete, pastaId))
      anunciar('Desfeito.')
    })
  }

  const criar = async () => {
    const pastaAtual = atual === TODAS || atual === SEM ? null : atual
    const novo = comPasta(verbeteNovo(tipo, `${rotulo.um} sem nome`, { campanhas: campanhaId === null ? [] : [campanhaId] }), pastaAtual)
    if (pastaAtual !== null && !guardarAsDoGrimorio()) return
    await criarVerbete(novo)
    ir(lugarDoVerbete(novo, usePreludio.getState().verbetes))
  }

  const abrirVerbete = useCallback(
    (id: string) => {
      const verbete = verbetes.get(id)
      if (verbete !== undefined) ir(lugarDoVerbete(verbete, verbetes))
    },
    [ir, verbetes],
  )

  const abrirMenu = (novo: Menu, elemento: HTMLElement) => {
    gatilho.current = elemento
    setMenu(novo)
  }

  const marcar = useCallback((id: string, marcado: boolean) => {
    setMarcados((antes) => {
      const depois = new Set(antes)
      if (marcado) depois.add(id)
      else depois.delete(id)
      return depois
    })
  }, [])

  const arrasto = useArrastoParaPasta({
    idsDoArrasto: (id) => (marcados.has(id) ? [...marcados] : [id]),
    rotuloDoArrasto: (ids) => (ids.length === 1 ? (verbetes.get(ids[0])?.titulo ?? '') || 'Sem nome' : plural(ids.length, um, varios)),
    nomeDoAlvo: (alvo) => nomeDoDestino(alvo === SEM ? null : alvo),
    aoParar: (alvo) => setFechadas((antes) => new Set([...antes].filter((id) => id !== alvo))),
    aoSoltar: (ids, alvo) => mover(ids, alvo === SEM ? null : alvo),
    anunciar,
  })
  const { aoApertar: apertarNoArrasto, acabouDeSoltar } = arrasto
  const aoApertar = useCallback((id: string, evento: PointerEvent<HTMLElement>) => {
    if (!travado) apertarNoArrasto(id, evento)
  }, [apertarNoArrasto, travado])
  const aoAbrir = useCallback(
    (id: string) => {
      if (!acabouDeSoltar()) abrirVerbete(id)
    },
    [abrirVerbete, acabouDeSoltar],
  )
  const aoMenuDoVerbete = useCallback((id: string, elemento: HTMLElement) => abrirMenu({ t: 'verbete', id }, elemento), [])

  const subDe = (verbete: Verbete): string => {
    if (ordem === 'rec') return quando(momentoDoVerbete(verbete))
    if (campanhaId === null) return verbete.campanhas.map((id) => campanhas.find((campanha) => campanha.id === id)?.nome).find((nome) => nome !== undefined) ?? 'sem campanha'
    return comFicha ? (ehNpc(verbete) ? 'tem ficha' : 'sem ficha') : ''
  }

  const aoTeclarNaPagina = (evento: KeyboardEvent<HTMLDivElement>) => {
    const emCampo = evento.target instanceof HTMLInputElement && evento.target.type !== 'checkbox'
    if (evento.key === 'Escape' && marcados.size > 0 && !emCampo && menu === null) {
      evento.preventDefault()
      setMarcados(new Set())
      anunciar('Nada marcado.')
    } else if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 'a' && !emCampo && evento.target instanceof Element && evento.target.closest('.pp-resultado') !== null) {
      evento.preventDefault()
      setMarcados(new Set(visiveis))
      anunciar(`${plural(visiveis.length, 'marcado', 'marcados')}.`)
    }
  }

  // ─── O menu (um só, do verbete, da pasta ou o "Mover para…") ──────────────
  const conteudoDoMenu = () => {
    if (menu === null) return null
    if (menu.t === 'verbete') {
      const ids = marcados.has(menu.id) ? [...marcados] : [menu.id]
      return (
        <>
          <MenuItem icone={<IconeLivro />} onClick={() => abrirVerbete(menu.id)}>
            Abrir o verbete
          </MenuItem>
          <MenuSeparador />
          <MenuItem
            icone={<IconePasta />}
            onClick={() => {
              proximoMenu.current = { t: 'mover', ids }
            }}
          >
            {ids.length > 1 ? `Mover os ${ids.length} marcados para…` : 'Mover para…'}
          </MenuItem>
        </>
      )
    }
    if (menu.t === 'pasta') {
      const pasta = pastasNaTela.find((uma) => uma.id === menu.id)
      if (pasta === undefined) return null
      return (
        <>
          <MenuItem atalho="F2" disabled={travado} onClick={() => setRenomeando(pasta.id)}>
            Renomear
          </MenuItem>
          <MenuItem disabled={travado || pasta.paiId !== undefined} detalhe={pasta.paiId !== undefined ? 'Um nível só de subpasta.' : undefined} onClick={() => comecarPasta(pasta.id, [])}>
            Nova pasta dentro
          </MenuItem>
          <MenuSeparador />
          <MenuItem perigo disabled={travado} onClick={() => apagar(pasta.id)}>
            Apagar a pasta
          </MenuItem>
        </>
      )
    }
    const estado = usePreludio.getState()
    const daqui = new Set(menu.ids.map((id) => pastaDe.get(id) ?? null))
    const unica = daqui.size === 1 ? [...daqui][0] : undefined
    return (
      <>
        <MenuRotulo>{menu.ids.length === 1 ? `Mover ${estado.verbetes.get(menu.ids[0])?.titulo || 'Sem nome'} para` : `Mover ${plural(menu.ids.length, um, varios)} para`}</MenuRotulo>
        <MenuItem disabled={travado || unica === null} onClick={() => mover(menu.ids, null)}>
          Sem pasta
        </MenuItem>
        <MenuSeparador />
        {arvore.map(({ pasta, nivel }) => (
          <MenuItem key={pasta.id} icone={<IconePasta />} disabled={travado || unica === pasta.id} onClick={() => mover(menu.ids, pasta.id)}>
            {nivel === 1 ? <span className="pp-menu__sub">{pasta.nome}</span> : pasta.nome}
          </MenuItem>
        ))}
        <MenuSeparador />
        <MenuItem disabled={travado} onClick={() => comecarPasta(undefined, menu.ids)}>
          Nova pasta com eles…
        </MenuItem>
      </>
    )
  }

  const titulo = atual === TODAS ? rotulo.varios : nomeDoDestino(atual === SEM ? null : atual)
  const campanha = campanhas.find((uma) => uma.id === campanhaId)
  const onde = atual === TODAS ? (campanha === undefined ? 'em todas as campanhas' : `em ${campanha.nome}`) : `em ${titulo}`
  const deGrimorio = doGrimorio.size

  return (
    <div className={`pp${marcados.size > 0 ? ' e-selecionando' : ''}`} ref={raiz} onKeyDown={aoTeclarNaPagina}>
      <ArvoreDasPastas
        arvore={arvore}
        doGrimorio={doGrimorio}
        escolhida={atual}
        abertas={new Set(arvore.filter(({ pasta }) => !fechadas.has(pasta.id)).map(({ pasta }) => pasta.id))}
        contas={contas}
        renomeando={renomeando}
        travado={travado}
        rodape={`${deGrimorio === 1 ? '1 pasta veio' : `${deGrimorio} pastas vieram`} do Grimório. Arraste um retrato para uma pasta, ou use Mover para. F2 renomeia.`}
        aoEscolher={(id) => {
          setEscolhida(id)
          setMarcados(new Set())
        }}
        aoAlternar={(id) => setFechadas((antes) => (antes.has(id) ? new Set([...antes].filter((uma) => uma !== id)) : new Set([...antes, id])))}
        aoRenomear={setRenomeando}
        aoTerminarRenomear={terminarRenomear}
        aoApagar={apagar}
        aoAbrirMenu={(id, elemento) => abrirMenu({ t: 'pasta', id }, elemento)}
        aoNovaPasta={() => comecarPasta(undefined, [])}
      />

      <div className="pp-conteudo">
        <header className="pp-cab">
          <div>
            <h2 className="pp-cab__tit">{titulo}</h2>
            <p className="pp-cab__conta">
              {plural(base.length, um, varios)} {onde}
            </p>
          </div>
          <div className="pp-cab__acoes">
            <button type="button" className="gr-bt gr-bt--p" disabled={travado} onClick={() => comecarPasta(undefined, [])}>
              + Nova pasta
            </button>
            <button type="button" className="gr-bt gr-bt--p gr-bt--latao" disabled={travado} onClick={() => void criar()}>
              + {rotulo.novo}
            </button>
          </div>
        </header>

        <div className="pp-ferr" role="toolbar" aria-label="Organizar a lista">
          <label className="pp-busca">
            <span className="pr-sr">Procurar {um}</span>
            <IconeLupa />
            <input type="search" placeholder="Procurar pelo nome ou apelido" value={busca} autoComplete="off" onChange={(evento) => setBusca(evento.target.value)} />
          </label>
          <label className="pp-filtro">
            Campanha
            <select value={campanhaId ?? ''} disabled={campanhas.length === 0} onChange={(evento) => escolherCampanha(evento.target.value === '' ? null : evento.target.value)}>
              <option value="">Todas</option>
              {campanhas.map((uma) => (
                <option key={uma.id} value={uma.id}>
                  {uma.nome}
                </option>
              ))}
            </select>
          </label>
          {comFicha && (
            <div className="pp-seg" role="group" aria-label="Ficha de NPC">
              <button type="button" aria-pressed={filtro === 'todos'} onClick={() => setFiltro('todos')}>
                Todos <b>{base.length}</b>
              </button>
              <button type="button" aria-pressed={filtro === 'npc'} onClick={() => setFiltro('npc')}>
                Já é NPC <b>{npcs}</b>
              </button>
              <button type="button" aria-pressed={filtro === 'sem'} onClick={() => setFiltro('sem')}>
                Sem ficha <b>{base.length - npcs}</b>
              </button>
            </div>
          )}
          <div className="pp-seg" role="group" aria-label="Ordem">
            <button type="button" aria-pressed={ordem === 'az'} onClick={() => setOrdem('az')}>
              A–Z
            </button>
            <button type="button" aria-pressed={ordem === 'rec'} onClick={() => setOrdem('rec')}>
              Recentes
            </button>
          </div>
          <div className="pp-seg pp-seg--ic" role="group" aria-label="Vista">
            <button type="button" aria-pressed={vista === 'grade'} aria-label="Retratos" title="Retratos" onClick={() => setVista('grade')}>
              <IconeGrade />
            </button>
            <button type="button" aria-pressed={vista === 'lista'} aria-label="Lista" title="Lista" onClick={() => setVista('lista')}>
              <IconeLista />
            </button>
          </div>
        </div>

        <div className="pp-resultado">
          {grupos.length === 0 ? (
            <div className="pr-vazio pp-vazio">
              <p className="pr-vazio__texto">
                {limpa !== ''
                  ? `Nada com "${busca.trim()}" no nome ou nos apelidos${atual !== TODAS ? ' nesta pasta' : ''}.`
                  : filtro === 'npc'
                    ? 'Ninguém aqui já é NPC.'
                    : filtro === 'sem'
                      ? 'Todos aqui já têm ficha de NPC.'
                      : `Nenhum ${um} aqui.`}
              </p>
              <div className="pp-vazio__acoes">
                {limpa !== '' && (
                  <button type="button" className="gr-bt gr-bt--p" onClick={() => setBusca('')}>
                    Limpar a busca
                  </button>
                )}
                {filtro !== 'todos' && (
                  <button type="button" className="gr-bt gr-bt--p" onClick={() => setFiltro('todos')}>
                    Mostrar todos
                  </button>
                )}
                {atual !== TODAS && (
                  <button type="button" className="gr-bt gr-bt--p" onClick={() => setEscolhida(TODAS)}>
                    Procurar em todas as pastas
                  </button>
                )}
              </div>
            </div>
          ) : (
            grupos.map((grupo) => {
              const fechado = gruposFechados.has(grupo.id) && limpa === ''
              const nome = nomeDoDestino(grupo.id === SEM ? null : grupo.id)
              const pai = pastasNaTela.find((pasta) => pasta.id === grupo.id)?.paiId
              return (
                <section key={grupo.id} className={`pp-grupo${fechado ? ' e-fechado' : ''}`} data-solta-pasta={grupo.id} aria-label={nome}>
                  <h3 className="pp-grupo__h">
                    <button
                      type="button"
                      className="pp-grupo__cab"
                      aria-expanded={!fechado}
                      onClick={() => setGruposFechados((antes) => (antes.has(grupo.id) ? new Set([...antes].filter((id) => id !== grupo.id)) : new Set([...antes, grupo.id])))}
                    >
                      <span className="pp-grupo__seta" aria-hidden="true">
                        <IconeSeta />
                      </span>
                      <span className="pp-grupo__nome">{nome}</span>
                      {pai !== undefined && <span className="pp-grupo__caminho">em {nomeDaPasta.get(pai)}</span>}
                      <span className="pp-grupo__conta">{grupo.membros.length}</span>
                    </button>
                  </h3>
                  <div className="pp-grupo__corpo" inert={fechado}>
                    <div className="pp-grupo__miolo">
                      {grupo.membros.length === 0 ? (
                        <p className="pr-quieto pp-grupo__vazio">Esta pasta está vazia. Arraste retratos para cá, ou marque {varios} e use Mover para.</p>
                      ) : (
                        <ul className={vista === 'grade' ? 'pp-cartas' : 'pp-linhas'} aria-label={nome}>
                          {grupo.membros.map((verbete) => (
                            <CartaoDoVerbete
                              key={verbete.id}
                              verbete={verbete}
                              vista={vista}
                              marcado={marcados.has(verbete.id)}
                              npc={comFicha && ehNpc(verbete)}
                              sub={subDe(verbete)}
                              resumo={vista === 'lista' ? resumoDe(verbete) : ''}
                              busca={busca}
                              aoMarcar={marcar}
                              aoAbrir={aoAbrir}
                              aoMenu={aoMenuDoVerbete}
                              aoApertar={aoApertar}
                            />
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </section>
              )
            })
          )}
        </div>

        <div className={`pp-barra-sel${marcados.size > 0 ? '' : ' e-fora'}`} role="region" aria-label={`${rotulo.varios} marcados`}>
          <span className="pp-barra-sel__conta">{plural(marcados.size, 'marcado', 'marcados')}</span>
          <button
            type="button"
            className="gr-bt gr-bt--p gr-bt--primario"
            aria-haspopup="menu"
            disabled={travado || marcados.size === 0}
            onClick={(evento) => abrirMenu({ t: 'mover', ids: [...marcados] }, evento.currentTarget)}
          >
            Mover para…
          </button>
          <button type="button" className="gr-bt gr-bt--p gr-bt--fantasma" disabled={marcados.size === 0} onClick={() => setMarcados(new Set())}>
            Desmarcar <kbd className="gr-kbd">Esc</kbd>
          </button>
        </div>
      </div>

      <Pop
        key={menu === null ? 'nenhum' : menu.t === 'mover' ? `mover:${menu.ids.join(',')}` : `${menu.t}:${menu.id}`}
        aberto={menu !== null}
        gatilho={gatilho}
        rotulo={menu?.t === 'pasta' ? 'Ações da pasta' : menu?.t === 'mover' ? 'Mover para' : 'Ações'}
        onFechar={() => {
          setMenu(proximoMenu.current)
          proximoMenu.current = null
        }}
      >
        {conteudoDoMenu()}
      </Pop>

      {aviso !== null && (
        <Torradas>
          <Torrada
            key={aviso.chave}
            mensagem={aviso.texto}
            acao={aviso.desfazer === undefined ? undefined : { rotulo: 'Desfazer', onClick: aviso.desfazer }}
            onFechar={() => setAviso((agora) => (agora?.chave === aviso.chave ? null : agora))}
          />
        </Torradas>
      )}
      <p className="pr-sr" role="status">
        {anuncio}
      </p>
    </div>
  )
}
