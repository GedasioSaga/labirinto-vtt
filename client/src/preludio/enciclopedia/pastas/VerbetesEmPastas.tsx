import { useCallback, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { MenuItem, MenuRotulo, MenuSeparador, Pop } from '../../../components/grimorio/Pop'
import { compararTitulos, naCampanha, ROTULO_DO_TIPO, semAcento, verbeteNovo } from '../../../lib/preparo/enciclopedia'
import {
  arvoreDasPastas,
  comAsPastasDoTipo,
  comPasta,
  comPastaIdComoEstava,
  contasComAsDeDentro,
  momentoDoVerbete,
  nomeDaPastaLimpo,
  pastaDoVerbete,
  pastaEDeDentro,
  pastaMovida,
  pastaNova,
  pastasAcimaDe,
  pastasDoTipo,
  recusaParaMoverAPasta,
  renomeada,
  semAPasta,
  veioDoGrimorio,
} from '../../../lib/preparo/pastasDeVerbetes'
import { tipoDaFichaLigada } from '../../../lib/preparo/fichaDoVerbete'
import type { PastaDeVerbetes, TipoDeVerbete, Verbete } from '../../../lib/preparo/tipos'
import { usePreludio } from '../../estado/preludio'
import { useTiposDasFichasLigadas } from '../tiposDasFichas'
import { lugarDoVerbete, resumoDe } from '../ListaDeVerbetes'
import { useArrastoParaPasta } from './arrastarParaPasta'
import { ArvoreDasPastas, EscolherPasta, fraseDaRecusaDaPasta, recuoDoNivel, SEM, TEXTOS_DO_ARRASTO_DA_PASTA, TODAS, TOPO } from './ArvoreDasPastas'
import { CartaoDoVerbete } from './CartaoDoVerbete'
import { IconeLivro, IconePasta, IconeSubir } from './icones'
import { AvisoDaLista, BarraDosMarcados, campanhaDoVerbete, FerramentasDaLista, GrupoDaLista, passaNaBusca, plural, quando, teclaDosMarcados, useCtrlZDaLista, type Aviso, type Ordem, type Vista } from './partesDaLista'
import './pastas.css'

/**
 * OS VERBETES EM PASTAS (E3, protótipo aprovado em 16/11, tela 1): a lista de
 * Personagens (e de Itens e Facções) com as pastas do Grimório de verdade.
 *
 * - À esquerda, as pastas: "Todos", "Sem pasta" e a árvore, em quantos níveis
 *   houver; criar, renomear (F2) e apagar (as de dentro e os verbetes sobem,
 *   com Desfazer). Pasta dentro de pasta (17/11): arrastar a pasta até outra
 *   (fica dentro) ou até o vazio da barra (volta para o topo), ou pelo menu
 *   "Mover para…" e "Tirar de…". Toda mudança tem Desfazer no aviso, e o
 *   Ctrl+Z da página desfaz a última.
 * - À direita, os grupos recolhíveis por pasta, com a conta; arrastar o retrato
 *   até uma pasta (a pasta fechada abre se o retrato parar em cima), marcar
 *   vários e "Mover para…".
 * - Organizar: busca pelo nome e apelido, campanha, "Já é NPC" / "Sem ficha"
 *   (NPC = tem ficha ligada, `liga.fichas`, e ela não é de jogador; a de jogador mostra o selo "Jogador"), A–Z ou Recentes, retratos ou lista.
 *
 * As mudanças passam pela loja do Prelúdio: o verbete pelo salvar automático,
 * as pastas pelo índice (`mudarPastas`).
 */

/** Os tipos que ganham a lista com pastas (o Lugar tem a dele, em regiões: `LugaresEmRegioes`). */
export const TIPOS_COM_PASTAS: readonly TipoDeVerbete[] = ['personagem', 'item', 'faccao']

type FiltroDaFicha = 'todos' | 'npc' | 'sem'

type Menu = { readonly t: 'verbete'; readonly id: string } | { readonly t: 'pasta'; readonly id: string } | { readonly t: 'mover'; readonly ids: readonly string[] }

interface Grupo {
  readonly id: string
  readonly membros: readonly Verbete[]
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
  /** O "Mover para…" de uma pasta (`chave` refaz a busca a cada vez que abre). */
  const [movendo, setMovendo] = useState<{ readonly id: string; readonly chave: number; readonly aberto: boolean } | null>(null)
  const [anuncio, setAnuncio] = useState('')
  const gatilho = useRef<HTMLElement | null>(null)
  const proximoMenu = useRef<Menu | null>(null)
  const raiz = useRef<HTMLDivElement>(null)
  /** O Desfazer do último aviso, para o Ctrl+Z (vale uma vez só, pelo aviso ou pela tecla). */
  const ultimoDesfazer = useRef<(() => void) | null>(null)

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
    const moradas = doTipo.map((verbete) => pastaDe.get(verbete.id) ?? null)
    const saida = contasComAsDeDentro(
      pastasNaTela,
      moradas.filter((pasta): pasta is string => pasta !== null),
    )
    saida.set(TODAS, doTipo.length)
    saida.set(SEM, moradas.filter((pasta) => pasta === null).length)
    return saida
  }, [doTipo, pastaDe, pastasNaTela])

  const limpa = semAcento(busca.trim())
  const base = useMemo(() => doTipo.filter(naEscolhida), [doTipo, naEscolhida])
  // NPC = ficha ligada que não é de jogador (pedido 6 de 17/11): o personagem com ficha de jogador não conta nem aparece em "Já é NPC".
  const tipos = useTiposDasFichasLigadas(base)
  const npcs = useMemo(() => base.filter((verbete) => tipoDaFichaLigada(verbete, tipos) === 'npc').length, [base, tipos])
  const semFicha = useMemo(() => base.filter((verbete) => tipoDaFichaLigada(verbete, tipos) === null).length, [base, tipos])
  const grupos = useMemo((): Grupo[] => {
    const daFicha = (verbete: Verbete) => (filtro === 'npc' ? tipoDaFichaLigada(verbete, tipos) === 'npc' : tipoDaFichaLigada(verbete, tipos) === null)
    const passa = (verbete: Verbete) => passaNaBusca(verbete, limpa) && (!comFicha || filtro === 'todos' || daFicha(verbete))
    const filtradas = base.filter(passa)
    const ordenar = (lista: Verbete[]) =>
      lista.sort(ordem === 'az' ? (a, b) => compararTitulos(a.titulo, b.titulo) : (a, b) => momentoDoVerbete(b) - momentoDoVerbete(a) || compararTitulos(a.titulo, b.titulo))
    const ids = atual === TODAS ? [...arvore.map(({ pasta }) => pasta.id), SEM] : atual === SEM ? [SEM] : arvore.map(({ pasta }) => pasta.id).filter((id) => dentro?.has(id) === true)
    return ids
      .map((id) => ({ id, membros: ordenar(filtradas.filter((verbete) => (pastaDe.get(verbete.id) ?? null) === (id === SEM ? null : id))) }))
      .filter((grupo) => grupo.membros.length > 0 || (grupo.id === atual && !arvore.some(({ pasta }) => pasta.paiId === grupo.id)))
  }, [base, limpa, comFicha, filtro, tipos, ordem, atual, arvore, dentro, pastaDe])
  const visiveis = useMemo(() => grupos.flatMap((grupo) => grupo.membros.map((verbete) => verbete.id)), [grupos])

  // ─── Ações ─────────────────────────────────────────────────────────────────
  const anunciar = useCallback((texto: string) => setAnuncio(texto), [])
  const avisar = useCallback((texto: string, desfazer?: () => void) => {
    if (desfazer === undefined) {
      setAviso({ chave: Date.now(), texto })
      return
    }
    // Uma vez só: o botão do aviso e o Ctrl+Z não desfazem duas vezes.
    const umaVez = () => {
      if (ultimoDesfazer.current !== umaVez) return
      ultimoDesfazer.current = null
      desfazer()
    }
    ultimoDesfazer.current = umaVez
    setAviso({ chave: Date.now(), texto, desfazer: umaVez })
  }, [])
  useCtrlZDaLista(raiz, () => {
    if (movendo?.aberto === true || menu !== null) return
    const desfazer = ultimoDesfazer.current
    if (desfazer === null) avisar('Nada para desfazer aqui.')
    else desfazer()
  })

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
        avisar('Desfeito.')
      })
    },
    [avisar, guardarAsDoGrimorio, mudarVerbete, nomeDoDestino, pastasAgora, um, varios],
  )

  /** A pasta e as de cima dela abertas: a que acabou de chegar fica à vista. */
  const abrirAte = useCallback(
    (id: string | null) => {
      if (id === null) return
      const abrir = new Set([id, ...pastasAcimaDe(pastasAgora(), id).map((pasta) => pasta.id)])
      setFechadas((antes) => new Set([...antes].filter((fechada) => !abrir.has(fechada))))
    },
    [pastasAgora],
  )

  /**
   * Põe a pasta dentro de `destino` (`null` = no topo). Grava todas as pastas
   * do tipo: as do Grimório vão junto para o índice (como em
   * `guardarAsDoGrimorio`), e os verbetes continuam nas mesmas pastas.
   */
  const moverPasta = useCallback(
    (id: string, destino: string | null) => {
      if (usePreludio.getState().travado) return
      const agora = pastasAgora()
      const nomeEm = (lista: readonly PastaDeVerbetes[], pastaId: string | null) => (pastaId === null ? null : (lista.find((pasta) => pasta.id === pastaId)?.nome ?? 'a pasta'))
      const nome = nomeEm(agora, id) ?? ''
      const feito = pastaMovida(agora, id, destino)
      if (feito.t === 'recusada') {
        avisar(fraseDaRecusaDaPasta(feito.recusa, nome, nomeEm(agora, destino), false))
        return
      }
      if (!gravarPastas(feito.pastas)) return
      abrirAte(destino)
      const { paiAntes } = feito
      const onde = (pastaId: string | null, lista: readonly PastaDeVerbetes[]) => (pastaId === null ? 'para o topo' : `para dentro de ${nomeEm(lista, pastaId) ?? ''}`)
      avisar(`Pasta ${nome} foi ${onde(destino, agora)}.`, () => {
        const depois = pastasAgora()
        const volta = pastaMovida(depois, id, paiAntes)
        if (volta.t === 'recusada') {
          avisar(volta.recusa === 'ja-esta' ? fraseDaRecusaDaPasta('ja-esta', nome, nomeEm(depois, paiAntes), false) : `Não deu para desfazer: a pasta ${nome} mudou depois.`)
          return
        }
        if (!gravarPastas(volta.pastas)) return
        abrirAte(paiAntes)
        avisar(`Pasta ${nome} voltou ${onde(paiAntes, depois)}.`)
      })
    },
    [abrirAte, avisar, gravarPastas, pastasAgora],
  )

  /** O pai que vale de uma pasta (o que aponta para pasta apagada conta como "no topo"). */
  const paiNaTela = (id: string): PastaDeVerbetes | undefined => {
    const paiId = pastasNaTela.find((pasta) => pasta.id === id)?.paiId
    return paiId === undefined ? undefined : pastasNaTela.find((pasta) => pasta.id === paiId)
  }

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
    avisar(`Pasta renomeada para ${nome}.`, () => {
      if (gravarPastas(renomeada(pastasAgora(), id, antes.nome))) avisar('Desfeito.')
    })
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
      avisar('Desfeito.')
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
    aceita: (alvo) => alvo !== TOPO,
    aoParar: (alvo) => setFechadas((antes) => new Set([...antes].filter((id) => id !== alvo))),
    aoSoltar: (ids, alvo) => mover(ids, alvo === SEM ? null : alvo),
    anunciar,
  })
  const { aoApertar: apertarNoArrasto, acabouDeSoltar } = arrasto
  const aoApertar = useCallback((id: string, evento: PointerEvent<HTMLElement>) => {
    if (!travado) apertarNoArrasto(id, evento)
  }, [apertarNoArrasto, travado])

  // A pasta arrastada: até outra pasta (fica dentro dela) ou até o vazio da barra e "Sem pasta" (vai para o topo).
  const destinoDaPasta = (alvo: string) => (alvo === TOPO || alvo === SEM ? null : alvo)
  const arrastoDaPasta = useArrastoParaPasta({
    idsDoArrasto: (id) => [id],
    rotuloDoArrasto: (ids) => nomeDaPasta.get(ids[0] ?? '') ?? 'Pasta',
    nomeDoAlvo: (alvo) => (alvo === TOPO || alvo === SEM ? 'o topo' : (nomeDaPasta.get(alvo) ?? 'a pasta')),
    textos: TEXTOS_DO_ARRASTO_DA_PASTA,
    recusa: (ids, alvo) => {
      const id = ids[0] ?? ''
      const destino = destinoDaPasta(alvo)
      const recusa = recusaParaMoverAPasta(pastasAgora(), id, destino)
      return recusa === null ? null : fraseDaRecusaDaPasta(recusa, nomeDaPasta.get(id) ?? '', destino === null ? null : (nomeDaPasta.get(destino) ?? ''), true)
    },
    aoParar: (alvo) => setFechadas((antes) => new Set([...antes].filter((id) => id !== alvo))),
    aoSoltar: (ids, alvo) => moverPasta(ids[0] ?? '', destinoDaPasta(alvo)),
    anunciar,
    fantasma: 'pasta',
    atributoDoArrastado: 'data-linha',
  })
  const { aoApertar: apertarNaPasta, acabouDeSoltar: acabouDeSoltarAPasta } = arrastoDaPasta
  const alcaDaPasta = useMemo(
    () => ({
      aoApertar: (id: string, evento: PointerEvent<HTMLElement>) => {
        if (!travado && id !== nova?.pasta.id) apertarNaPasta(id, evento)
      },
      acabouDeSoltar: acabouDeSoltarAPasta,
    }),
    [acabouDeSoltarAPasta, apertarNaPasta, nova, travado],
  )
  const aoAbrir = useCallback(
    (id: string) => {
      if (!acabouDeSoltar()) abrirVerbete(id)
    },
    [abrirVerbete, acabouDeSoltar],
  )
  const aoMenuDoVerbete = useCallback((id: string, elemento: HTMLElement) => abrirMenu({ t: 'verbete', id }, elemento), [])

  const subDe = (verbete: Verbete): string => {
    if (ordem === 'rec') return quando(momentoDoVerbete(verbete))
    if (campanhaId === null) return campanhaDoVerbete(verbete, campanhas)
    return comFicha ? (tipoDaFichaLigada(verbete, tipos) === null ? 'sem ficha' : 'tem ficha') : ''
  }

  const aoTeclarNaPagina = (evento: KeyboardEvent<HTMLDivElement>) =>
    teclaDosMarcados(evento, {
      marcados: marcados.size,
      // A janela "Mover para…" da pasta mora num portal, mas a tecla dela sobe até aqui pela árvore do React.
      menuAberto: menu !== null || movendo?.aberto === true,
      aoDesmarcar: () => {
        setMarcados(new Set())
        anunciar('Nada marcado.')
      },
      aoMarcarTodos: () => {
        setMarcados(new Set(visiveis))
        anunciar(`${plural(visiveis.length, 'marcado', 'marcados')}.`)
      },
    })

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
      const pai = paiNaTela(pasta.id)
      const avo = pai === undefined ? undefined : paiNaTela(pai.id)
      return (
        <>
          <MenuItem atalho="F2" disabled={travado} onClick={() => setRenomeando(pasta.id)}>
            Renomear
          </MenuItem>
          <MenuItem disabled={travado} onClick={() => comecarPasta(pasta.id, [])}>
            Nova pasta dentro
          </MenuItem>
          <MenuSeparador />
          <MenuItem icone={<IconePasta />} disabled={travado} onClick={() => setMovendo({ id: pasta.id, chave: Date.now(), aberto: true })}>
            Mover para…
          </MenuItem>
          {pai !== undefined && (
            <MenuItem icone={<IconeSubir />} disabled={travado} detalhe={avo === undefined ? 'Vai para o topo.' : `Vai para dentro de ${avo.nome}.`} onClick={() => moverPasta(pasta.id, avo?.id ?? null)}>
              Tirar de {pai.nome}
            </MenuItem>
          )}
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
            {nivel > 0 ? (
              <span className="pp-menu__sub" style={{ paddingLeft: recuoDoNivel(nivel) - recuoDoNivel(0) }}>
                {pasta.nome}
              </span>
            ) : (
              pasta.nome
            )}
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
        rodape={`${deGrimorio === 1 ? '1 pasta veio' : `${deGrimorio} pastas vieram`} do Grimório. Arraste um retrato ou uma pasta até outra pasta; solte a pasta no vazio daqui para levá-la ao topo. F2 renomeia, Ctrl+Z desfaz.`}
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
        arrastoDaPasta={alcaDaPasta}
        alvoDoTopo={TOPO}
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

        <FerramentasDaLista
          um={um}
          busca={busca}
          aoBuscar={setBusca}
          campanhas={campanhas}
          campanhaId={campanhaId}
          aoEscolherCampanha={escolherCampanha}
          ordem={ordem}
          aoOrdenar={setOrdem}
          vista={vista}
          aoVer={setVista}
          rotuloDaGrade="Retratos"
        >
          {comFicha && (
            <div className="pp-seg" role="group" aria-label="Ficha de NPC">
              <button type="button" aria-pressed={filtro === 'todos'} onClick={() => setFiltro('todos')}>
                Todos <b>{base.length}</b>
              </button>
              <button type="button" aria-pressed={filtro === 'npc'} onClick={() => setFiltro('npc')}>
                Já é NPC <b>{npcs}</b>
              </button>
              <button type="button" aria-pressed={filtro === 'sem'} onClick={() => setFiltro('sem')}>
                Sem ficha <b>{semFicha}</b>
              </button>
            </div>
          )}
        </FerramentasDaLista>

        <div className="pp-resultado">
          {grupos.length === 0 ? (
            <div className="pr-vazio pp-vazio">
              <p className="pr-vazio__texto">
                {limpa !== ''
                  ? `Nada com "${busca.trim()}" no nome ou nos apelidos${atual !== TODAS ? ' nesta pasta' : ''}.`
                  : filtro === 'npc'
                    ? 'Ninguém aqui já é NPC.'
                    : filtro === 'sem'
                      ? 'Todos aqui já têm ficha.'
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
              const acima = grupo.id === SEM ? [] : pastasAcimaDe(pastasNaTela, grupo.id)
              return (
                <GrupoDaLista
                  key={grupo.id}
                  alvo={grupo.id}
                  nome={nome}
                  caminho={acima.length === 0 ? undefined : `em ${acima.map((pasta) => pasta.nome).join(' › ')}`}
                  conta={grupo.membros.length}
                  fechado={fechado}
                  aoAlternar={() => setGruposFechados((antes) => (antes.has(grupo.id) ? new Set([...antes].filter((id) => id !== grupo.id)) : new Set([...antes, grupo.id])))}
                >
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
                              npc={comFicha && tipoDaFichaLigada(verbete, tipos) !== null}
                              fichaDeJogador={tipoDaFichaLigada(verbete, tipos) === 'jogador'}
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
                </GrupoDaLista>
              )
            })
          )}
        </div>

        <BarraDosMarcados
          rotulo={`${rotulo.varios} marcados`}
          quantos={marcados.size}
          travado={travado}
          aoMover={(elemento) => abrirMenu({ t: 'mover', ids: [...marcados] }, elemento)}
          aoDesmarcar={() => setMarcados(new Set())}
        />
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

      {movendo !== null && (
        <EscolherPasta
          key={movendo.chave}
          aberto={movendo.aberto}
          titulo={`Mover a pasta ${nomeDaPasta.get(movendo.id) ?? ''}`}
          arvore={arvore}
          escondidas={pastaEDeDentro(pastasNaTela, movendo.id)}
          atual={paiNaTela(movendo.id)?.id ?? null}
          aoEscolher={(destino) => {
            setMovendo({ ...movendo, aberto: false })
            moverPasta(movendo.id, destino)
          }}
          aoFechar={() => setMovendo({ ...movendo, aberto: false })}
        />
      )}

      <AvisoDaLista aviso={aviso} aoFechar={(chave) => setAviso((agora) => (agora?.chave === chave ? null : agora))} />
      <p className="pr-sr" role="status">
        {anuncio}
      </p>
    </div>
  )
}
