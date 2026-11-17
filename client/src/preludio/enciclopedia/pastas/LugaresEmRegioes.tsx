import { useCallback, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { MenuItem, MenuSeparador, Pop } from '../../../components/grimorio/Pop'
import { compararTitulos, naCampanha, semAcento, verbeteNovo } from '../../../lib/preparo/enciclopedia'
import { estaNaLixeira } from '../../../lib/preparo/lixeira'
import { lugarEDeDentro, organizarLugares } from '../../../lib/preparo/lugaresEmRegioes'
import { momentoDoVerbete } from '../../../lib/preparo/pastasDeVerbetes'
import type { Verbete } from '../../../lib/preparo/tipos'
import { usePreludio } from '../../estado/preludio'
import { EscolherLugar } from '../EscolherLugar'
import { BotaoDaLixeira, IconeLixeira } from '../Lixeira'
import { mandarParaALixeira, restaurarDaLixeira } from '../lixeiraDoPreludio'
import { lugarDoVerbete, resumoDe } from '../ListaDeVerbetes'
import { fraseDaRecusa, moverLugares, planoAgora } from '../moverLugares'
import { useArrastoParaPasta, type TextosDoArrasto } from './arrastarParaPasta'
import { ArvoreDasPastas, SEM, TODAS, type RamoDaArvore } from './ArvoreDasPastas'
import { CartaoDoVerbete } from './CartaoDoVerbete'
import { IconeLivro, IconeMapa } from './icones'
import { AvisoDaLista, BarraDosMarcados, campanhaDoVerbete, FerramentasDaLista, GrupoDaLista, passaNaBusca, plural, quando, teclaDosMarcados, type Aviso, type Ordem, type Vista } from './partesDaLista'
import './pastas.css'

/**
 * OS LUGARES EM REGIÕES (pedido de 16/11, 21h25: "organiza melhor aqui também,
 * coloca as imagens"). A cara e as ferramentas da lista de Personagens (E3),
 * mas a organização é a que os lugares já têm, lugar dentro de lugar (`paiId`):
 *
 * - À esquerda, as REGIÕES: "Todos", "Sem região" e os lugares que têm lugares
 *   dentro, em árvore, com a conta (o lugar e os de dentro).
 * - À direita, um grupo recolhível por região de cima com tudo o que está
 *   dentro dela numa grade só, na ordem da árvore (o Castelo e logo depois os
 *   cômodos dele). Cada cartão diz onde fica ("Reino de Goa › Castelo").
 *   Escolha do designer: o caminho no cartão em vez de grupos dentro de grupos.
 *   Com 98 lugares e 2-3 níveis, grupos aninhados viram uma escada de grupos
 *   de 1-3 cartões, difícil de varrer com o olho; uma grade por região com o
 *   caminho mantém as imagens juntas e a hierarquia legível.
 * - Arrastar um cartão para cima de outro lugar (cartão, grupo ou linha da
 *   barra) põe dentro dele; para "Sem região", tira de onde estava. Nunca
 *   cria laço, e tem Desfazer. Sem mouse: "Mover para…" (no "…" do cartão ou
 *   na barra dos marcados) abre a escolha com TODOS os lugares e uma busca
 *   (pedido de 17/11: sub-cenário fácil como no Grimório).
 * - "Excluir" (17/11) manda o lugar para a Lixeira, com Desfazer; o que estava
 *   dentro dele sobe um nível e volta ao restaurar (`lib/preparo/lixeira.ts`).
 *
 * A mudança é só o `paiId` do verbete, pela loja do Prelúdio (salvar automático).
 */

/** O "…" de um cartão: o lugar dele. */
interface Menu {
  readonly id: string
}

interface Grupo {
  readonly id: string
  readonly membros: readonly Verbete[]
}

/** No cartão, só os dois últimos nomes do caminho: o pai direto é o que mais diz, e o grupo já diz a região. */
const NOMES_NO_CARTAO = 2

/** Nenhum lugar à espera (sempre a mesma lista: a janela fechada não redesenha). */
const SEM_IDS: readonly string[] = []

function nomeDe(verbete: Verbete | undefined): string {
  return verbete?.titulo || 'Sem nome'
}

export function LugaresEmRegioes() {
  const verbetes = usePreludio((estado) => estado.verbetes)
  const campanhas = usePreludio((estado) => estado.campanhas)
  const campanhaId = usePreludio((estado) => estado.campanhaId)
  const travado = usePreludio((estado) => estado.travado)
  const ir = usePreludio((estado) => estado.ir)
  const criarVerbete = usePreludio((estado) => estado.criarVerbete)
  const escolherCampanha = usePreludio((estado) => estado.escolherCampanha)

  const [escolhida, setEscolhida] = useState(TODAS)
  const [fechadas, setFechadas] = useState<ReadonlySet<string>>(new Set())
  const [gruposFechados, setGruposFechados] = useState<ReadonlySet<string>>(new Set())
  const [busca, setBusca] = useState('')
  const [ordem, setOrdem] = useState<Ordem>('az')
  const [vista, setVista] = useState<Vista>('grade')
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(new Set())
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [menu, setMenu] = useState<Menu | null>(null)
  /** Os lugares à espera de um lugar de cima, na janela "Pôr dentro de…". */
  const [escolhendo, setEscolhendo] = useState<readonly string[] | null>(null)
  const [anuncio, setAnuncio] = useState('')
  const gatilho = useRef<HTMLElement | null>(null)

  // ─── O que a tela mostra ───────────────────────────────────────────────────
  const lugares = useMemo(() => [...verbetes.values()].filter((verbete) => verbete.tipo === 'lugar' && !estaNaLixeira(verbete) && naCampanha(verbete, campanhaId)), [verbetes, campanhaId])
  const organizados = useMemo(() => organizarLugares(lugares), [lugares])
  const porId = useMemo(() => new Map(organizados.emOrdem.map((verbete) => [verbete.id, verbete])), [organizados])
  const arvore = useMemo((): RamoDaArvore[] => organizados.regioes.map((regiao) => ({ pasta: regiao, nivel: regiao.nivel })), [organizados])
  const ehRegiao = useMemo(() => new Set(organizados.regioes.map((regiao) => regiao.id)), [organizados])
  const deCima = useMemo(() => organizados.emOrdem.filter((verbete) => organizados.raizDe.get(verbete.id) === verbete.id), [organizados])
  const soltos = useMemo(() => deCima.filter((verbete) => !ehRegiao.has(verbete.id)), [deCima, ehRegiao])
  const temRegioes = organizados.regioes.length > 0

  const atual = escolhida === TODAS || escolhida === SEM || ehRegiao.has(escolhida) ? escolhida : TODAS
  const contas = useMemo(() => {
    const saida = new Map<string, number>([
      [TODAS, lugares.length],
      [SEM, soltos.length],
    ])
    for (const regiao of organizados.regioes) saida.set(regiao.id, 1 + (organizados.dentroDe.get(regiao.id) ?? 0))
    return saida
  }, [lugares.length, soltos.length, organizados])

  const limpa = semAcento(busca.trim())
  const grupos = useMemo((): Grupo[] => {
    const passa = (verbete: Verbete) => passaNaBusca(verbete, limpa)
    // A–Z é a ordem da árvore (irmãs em A–Z, o de dentro logo depois do pai); Recentes, o último mexido primeiro.
    const ordenar = (lista: Verbete[]) => (ordem === 'az' ? lista : lista.sort((a, b) => momentoDoVerbete(b) - momentoDoVerbete(a) || compararTitulos(a.titulo, b.titulo)))
    const daRegiao = (id: string): Grupo => ({
      id,
      membros: ordenar(
        lugarEDeDentro(organizados, id)
          .map((umId) => porId.get(umId))
          .filter((verbete): verbete is Verbete => verbete !== undefined && passa(verbete)),
      ),
    })
    const semRegiao: Grupo = { id: SEM, membros: ordenar(soltos.filter(passa)) }
    const todos = atual === TODAS ? [...deCima.filter((verbete) => ehRegiao.has(verbete.id)).map((verbete) => daRegiao(verbete.id)), semRegiao] : atual === SEM ? [semRegiao] : [daRegiao(atual)]
    return todos.filter((grupo) => grupo.membros.length > 0)
  }, [limpa, ordem, organizados, porId, soltos, atual, deCima, ehRegiao])
  const visiveis = useMemo(() => grupos.flatMap((grupo) => grupo.membros.map((verbete) => verbete.id)), [grupos])

  // ─── Ações ─────────────────────────────────────────────────────────────────
  const anunciar = useCallback((texto: string) => setAnuncio(texto), [])
  const avisar = useCallback((texto: string, desfazer?: () => void) => setAviso({ chave: Date.now(), texto, desfazer }), [])

  /** Põe os lugares dentro de `destino` (`null` = fora de todos). Confere tudo de novo com a loja: o que a tela leu pode ter ficado para trás. */
  const mover = useCallback(
    (ids: readonly string[], destino: string | null) => {
      const movidos = moverLugares(ids, destino)
      if (movidos === null) return
      const { desfazer } = movidos
      if (desfazer === undefined) {
        avisar(movidos.texto)
        return
      }
      setMarcados(new Set())
      // O destino fechado abre: o lugar que acabou de chegar fica à vista.
      if (destino !== null) setFechadas((agora) => new Set([...agora].filter((id) => id !== destino)))
      avisar(movidos.texto, () => {
        desfazer()
        anunciar('Desfeito.')
      })
    },
    [anunciar, avisar],
  )

  /** Excluir: os lugares vão para a Lixeira (o que estava dentro sobe um nível); o Desfazer do aviso traz tudo de volta de uma vez. */
  const excluir = useCallback(
    (ids: readonly string[]) => {
      const feito = mandarParaALixeira(ids)
      if (feito.ids.length === 0) {
        avisar(feito.texto)
        return
      }
      setMarcados(new Set())
      avisar(feito.texto, () => {
        restaurarDaLixeira(feito.ids)
        anunciar('Desfeito.')
      })
    },
    [anunciar, avisar],
  )

  const criar = async () => {
    const dentroDe = atual === TODAS || atual === SEM ? undefined : atual
    const novo = verbeteNovo('lugar', 'Lugar sem nome', { campanhas: campanhaId === null ? [] : [campanhaId], ...(dentroDe === undefined ? {} : { paiId: dentroDe }) })
    await criarVerbete(novo)
    ir(lugarDoVerbete(novo, usePreludio.getState().verbetes))
  }

  const abrirLugar = useCallback(
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

  // ─── Arrastar um lugar para dentro de outro ───────────────────────────────
  const textosDoArrasto = useMemo(
    (): TextosDoArrasto => ({
      semAlvo: 'Solte sobre um lugar',
      antesDoAlvo: (alvo) => (alvo === SEM ? 'Soltar ' : 'Pôr dentro de '),
      anuncio: 'Arrastando. Solte sobre um lugar para pôr dentro dele, em Sem região para tirar de onde está, ou Esc para desistir.',
    }),
    [],
  )
  const recusaDoArrasto = useCallback((ids: readonly string[], alvo: string): string | null => {
    if (alvo === SEM) return null
    // Em cima dele mesmo (o começo de todo arrasto): a dica normal, sem acender nada.
    if (ids.includes(alvo)) return 'Solte sobre outro lugar'
    const nomeDoAlvo = nomeDe(usePreludio.getState().verbetes.get(alvo))
    const { mudam, recusados, jaEstavam } = planoAgora(ids, alvo)
    const primeira = recusados[0]
    if (mudam.length > 0) return null
    if (primeira !== undefined) return fraseDaRecusa(primeira[0], primeira[1], nomeDoAlvo)
    return jaEstavam > 0 ? `Já está dentro de ${nomeDoAlvo}` : null
  }, [])

  const arrasto = useArrastoParaPasta({
    idsDoArrasto: (id) => (marcados.has(id) ? [...marcados] : [id]),
    rotuloDoArrasto: (ids) => (ids.length === 1 ? nomeDe(verbetes.get(ids[0] ?? '')) : plural(ids.length, 'lugar', 'lugares')),
    nomeDoAlvo: (alvo) => (alvo === SEM ? 'fora de outros lugares' : nomeDe(verbetes.get(alvo))),
    textos: textosDoArrasto,
    recusa: recusaDoArrasto,
    aoParar: (alvo) => setFechadas((antes) => new Set([...antes].filter((id) => id !== alvo))),
    aoSoltar: (ids, alvo) => mover(ids, alvo === SEM ? null : alvo),
    anunciar,
  })
  const { aoApertar: apertarNoArrasto, acabouDeSoltar } = arrasto
  const aoApertar = useCallback(
    (id: string, evento: PointerEvent<HTMLElement>) => {
      if (!travado) apertarNoArrasto(id, evento)
    },
    [apertarNoArrasto, travado],
  )
  const aoAbrir = useCallback(
    (id: string) => {
      if (!acabouDeSoltar()) abrirLugar(id)
    },
    [abrirLugar, acabouDeSoltar],
  )
  const aoMenuDoLugar = useCallback((id: string, elemento: HTMLElement) => abrirMenu({ id }, elemento), [])

  /** A linha de baixo do cartão: onde ele fica; sem pai, quando mudou (Recentes) ou a campanha (todas). */
  const subDe = (verbete: Verbete): string => {
    const caminho = organizados.caminhoDe.get(verbete.id) ?? []
    if (caminho.length > 0) return `${caminho.length > NOMES_NO_CARTAO ? '… › ' : ''}${caminho.slice(-NOMES_NO_CARTAO).join(' › ')}`
    if (ordem === 'rec') return quando(momentoDoVerbete(verbete))
    if (campanhaId === null) return campanhaDoVerbete(verbete, campanhas)
    return ''
  }

  const aoTeclarNaPagina = (evento: KeyboardEvent<HTMLDivElement>) =>
    teclaDosMarcados(evento, {
      marcados: marcados.size,
      menuAberto: menu !== null,
      aoDesmarcar: () => {
        setMarcados(new Set())
        anunciar('Nada marcado.')
      },
      aoMarcarTodos: () => {
        setMarcados(new Set(visiveis))
        anunciar(`${plural(visiveis.length, 'marcado', 'marcados')}.`)
      },
    })

  // ─── O menu do lugar (o "…" do cartão) ─────────────────────────────────────
  const conteudoDoMenu = () => {
    if (menu === null) return null
    const estado = usePreludio.getState()
    const ids = marcados.has(menu.id) ? [...marcados] : [menu.id]
    const lugar = estado.verbetes.get(menu.id)
    const pai = lugar?.paiId === undefined ? undefined : estado.verbetes.get(lugar.paiId)
    return (
      <>
        <MenuItem icone={<IconeLivro />} onClick={() => abrirLugar(menu.id)}>
          Abrir o lugar
        </MenuItem>
        <MenuSeparador />
        <MenuItem icone={<IconeMapa />} disabled={travado} onClick={() => setEscolhendo(ids)}>
          {ids.length > 1 ? `Mover os ${ids.length} marcados para…` : 'Mover para…'}
        </MenuItem>
        {ids.length === 1 && pai !== undefined && (
          <MenuItem disabled={travado} onClick={() => mover(ids, null)}>
            Tirar de {nomeDe(pai)}
          </MenuItem>
        )}
        <MenuSeparador />
        <MenuItem icone={<IconeLixeira />} perigo disabled={travado} detalhe="Vai para a Lixeira." onClick={() => excluir(ids)}>
          {ids.length > 1 ? `Excluir os ${ids.length} marcados` : 'Excluir'}
        </MenuItem>
      </>
    )
  }

  const campanha = campanhas.find((uma) => uma.id === campanhaId)
  const regiaoAtual = atual === TODAS || atual === SEM ? undefined : porId.get(atual)
  const titulo = atual === TODAS ? 'Lugares' : atual === SEM ? 'Sem região' : nomeDe(regiaoAtual)
  const quantosNaTela = atual === TODAS ? lugares.length : (contas.get(atual) ?? 0)
  const onde = atual === TODAS ? (campanha === undefined ? 'em todas as campanhas' : `em ${campanha.nome}`) : atual === SEM ? 'fora de outros lugares' : `em ${titulo}`
  const nomeDoGrupo = (id: string) => (id === SEM ? (temRegioes ? 'Sem região' : 'Lugares') : nomeDe(porId.get(id)))

  return (
    <div className={`pp${marcados.size > 0 ? ' e-selecionando' : ''}`} onKeyDown={aoTeclarNaPagina}>
      <ArvoreDasPastas
        arvore={arvore}
        escolhida={atual}
        abertas={new Set(arvore.filter(({ pasta }) => !fechadas.has(pasta.id)).map(({ pasta }) => pasta.id))}
        contas={contas}
        travado={travado}
        titulo="Regiões"
        rotuloDeTodas="Todos"
        rotuloDeSem="Sem região"
        icone={<IconeMapa />}
        rodape="Região é um lugar com lugares dentro. Arraste um cartão sobre outro lugar para pôr dentro dele, ou marque e use Mover para."
        aoEscolher={(id) => {
          setEscolhida(id)
          setMarcados(new Set())
        }}
        aoAlternar={(id) => setFechadas((antes) => (antes.has(id) ? new Set([...antes].filter((uma) => uma !== id)) : new Set([...antes, id])))}
      />

      <div className="pp-conteudo">
        <header className="pp-cab">
          <div>
            <h2 className="pp-cab__tit">{titulo}</h2>
            <p className="pp-cab__conta">
              {plural(quantosNaTela, 'lugar', 'lugares')} {onde}
            </p>
          </div>
          <div className="pp-cab__acoes">
            <BotaoDaLixeira aoAbrir={() => setAviso(null)} />
            <button type="button" className="gr-bt gr-bt--p gr-bt--latao" disabled={travado} onClick={() => void criar()}>
              {regiaoAtual === undefined ? '+ Novo lugar' : `+ Lugar em ${nomeDe(regiaoAtual)}`}
            </button>
          </div>
        </header>

        <FerramentasDaLista
          um="lugar"
          busca={busca}
          aoBuscar={setBusca}
          campanhas={campanhas}
          campanhaId={campanhaId}
          aoEscolherCampanha={escolherCampanha}
          ordem={ordem}
          aoOrdenar={setOrdem}
          vista={vista}
          aoVer={setVista}
          rotuloDaGrade="Imagens"
        />

        <div className="pp-resultado">
          {grupos.length === 0 ? (
            <div className="pr-vazio pp-vazio">
              <p className="pr-vazio__texto">
                {limpa !== ''
                  ? `Nada com "${busca.trim()}" no nome ou nos apelidos${atual !== TODAS ? ' aqui' : ''}.`
                  : campanha !== undefined
                    ? `Nenhum lugar em ${campanha.nome} ainda.`
                    : 'Nenhum lugar ainda. Crie o primeiro, ou importe as campanhas do Grimório na tela Início.'}
              </p>
              <div className="pp-vazio__acoes">
                {limpa !== '' && (
                  <button type="button" className="gr-bt gr-bt--p" onClick={() => setBusca('')}>
                    Limpar a busca
                  </button>
                )}
                {atual !== TODAS && (
                  <button type="button" className="gr-bt gr-bt--p" onClick={() => setEscolhida(TODAS)}>
                    Procurar em todas as regiões
                  </button>
                )}
                {limpa === '' && campanha !== undefined && (
                  <button type="button" className="gr-bt gr-bt--p" onClick={() => escolherCampanha(null)}>
                    Ver todas as campanhas
                  </button>
                )}
              </div>
            </div>
          ) : (
            grupos.map((grupo) => {
              const fechado = gruposFechados.has(grupo.id) && limpa === ''
              const nome = nomeDoGrupo(grupo.id)
              const acima = grupo.id === SEM ? [] : (organizados.caminhoDe.get(grupo.id) ?? [])
              return (
                <GrupoDaLista
                  key={grupo.id}
                  alvo={grupo.id}
                  nome={nome}
                  caminho={acima.length === 0 ? undefined : `em ${acima.join(' › ')}`}
                  conta={grupo.membros.length}
                  fechado={fechado}
                  aoAlternar={() => setGruposFechados((antes) => (antes.has(grupo.id) ? new Set([...antes].filter((id) => id !== grupo.id)) : new Set([...antes, grupo.id])))}
                >
                  <ul className={vista === 'grade' ? 'pp-cartas pp-cartas--paisagem' : 'pp-linhas'} aria-label={nome}>
                    {grupo.membros.map((verbete) => (
                      <CartaoDoVerbete
                        key={verbete.id}
                        verbete={verbete}
                        vista={vista}
                        marcado={marcados.has(verbete.id)}
                        npc={false}
                        sub={subDe(verbete)}
                        resumo={vista === 'lista' ? resumoDe(verbete) : ''}
                        busca={busca}
                        aoMarcar={marcar}
                        aoAbrir={aoAbrir}
                        aoMenu={aoMenuDoLugar}
                        aoApertar={aoApertar}
                        capa="paisagem"
                        dentro={organizados.dentroDe.get(verbete.id) ?? 0}
                        alvo
                      />
                    ))}
                  </ul>
                </GrupoDaLista>
              )
            })
          )}
        </div>

        <BarraDosMarcados
          rotulo="Lugares marcados"
          quantos={marcados.size}
          travado={travado}
          aoMover={() => setEscolhendo([...marcados])}
          aoDesmarcar={() => setMarcados(new Set())}
        />
      </div>

      <Pop key={menu === null ? 'nenhum' : `verbete:${menu.id}`} aberto={menu !== null} gatilho={gatilho} rotulo="Ações" onFechar={() => setMenu(null)}>
        {conteudoDoMenu()}
      </Pop>

      <EscolherLugar
        aberto={escolhendo !== null}
        ids={escolhendo ?? SEM_IDS}
        campanhaId={campanhaId}
        aoFechar={() => setEscolhendo(null)}
        aoEscolher={(destino) => {
          const ids = escolhendo ?? SEM_IDS
          setEscolhendo(null)
          mover(ids, destino)
        }}
      />

      <AvisoDaLista aviso={aviso} aoFechar={(chave) => setAviso((agora) => (agora?.chave === chave ? null : agora))} />
      <p className="pr-sr" role="status">
        {anuncio}
      </p>
    </div>
  )
}
