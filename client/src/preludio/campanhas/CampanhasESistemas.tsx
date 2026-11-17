import { useCallback, useEffect, useMemo, useState } from 'react'
import { Torrada, Torradas } from '../../components/grimorio/Torrada'
import { mapasNaPasta, mapasQueUsamAPasta, campanhaComPasta, campanhaComSistema, sistemaDaCampanha } from '../../lib/preparo/campanhaESistema'
import { lerIndiceDasPastas, lerRpgDaPasta, rpgComSistema } from '../../lib/pastasDeMapas'
import { SISTEMAS_EMBUTIDOS } from '../../lib/sistemaOnePiece'
import { tipoDaFichaLigada, type TiposDasFichas } from '../../lib/preparo/fichaDoVerbete'
import type { Campanha, Verbete } from '../../lib/preparo/tipos'
import { sistemaPorId, useRpgStore } from '../../stores/rpgStore'
import { usePreludio } from '../estado/preludio'
import { IconeCadeado } from '../enciclopedia/pastas/icones'
import { useTiposDasFichasLigadas } from '../enciclopedia/tiposDasFichas'
import './campanhas.css'

/**
 * CAMPANHAS E SISTEMAS (E3, protótipo aprovado em 16/11, tela 2). Cada campanha
 * do Prelúdio aponta para uma pasta de mapas do Labirinto, e o sistema de RPG
 * mora na pasta (`rpg.json`): "vem da pasta". "Mudar na pasta" troca o sistema
 * de todos os mapas da pasta, pelo mesmo caminho da configuração da pasta no
 * Carregar mapa (Lobby e mochila conferidos). Sem pasta, o sistema fica
 * guardado na campanha (`lib/preparo/campanhaESistema.ts`).
 *
 * A janela própria do Prelúdio não grava em `pastas/` (o disco dela só escreve
 * em `preparo/`): lá a pasta e o sistema da campanha mudam, e o da pasta muda
 * na janela principal.
 */

/** Uma pasta de mapas como o cartão precisa: o sistema dela e quantos mapas. */
export interface PastaDeMapasNoCartao {
  readonly id: string
  readonly nome: string
  /** `undefined` = sem sistema (ou o `rpg.json` não abriu). */
  readonly sistemaId: string | undefined
  readonly mapas: number
  /** Os mapas que usam o sistema da pasta (os que não preferem o próprio). */
  readonly usam: number
}

export interface SistemaNaLista {
  readonly id: string
  readonly nome: string
  readonly embutido: boolean
}

export interface NumerosDaCampanha {
  readonly personagens: number
  readonly npcs: number
  /** Os personagens ligados a uma ficha de jogador (não contam como NPC). */
  readonly jogadores: number
  readonly sessoes: number
  readonly eventos: number
}

/** O que a escolha fez: o texto do aviso e, se der, como voltar. `null` = nada mudou. Lança com a razão. */
export type Resultado = { readonly texto: string; readonly desfazer?: () => Promise<unknown> } | null

export interface CartoesDasCampanhasProps {
  campanhas: readonly Campanha[]
  /** `null` = ainda lendo. */
  pastas: readonly PastaDeMapasNoCartao[] | null
  aviso: string | null
  sistemas: readonly SistemaNaLista[]
  numeros: (campanhaId: string) => NumerosDaCampanha
  /** Dá para gravar o sistema na pasta (só a janela principal). */
  podeMudarNaPasta: boolean
  travado: boolean
  aoEscolherPasta: (campanha: Campanha, pastaId: string | null) => Promise<Resultado>
  aoCriarPasta: ((campanha: Campanha) => Promise<Resultado>) | null
  aoEscolherSistemaDaCampanha: (campanha: Campanha, sistemaId: string | null) => Promise<Resultado>
  aoEscolherSistemaDaPasta: (pasta: PastaDeMapasNoCartao, sistemaId: string | null) => Promise<Resultado>
}

const NOVA_PASTA = '__nova'

function plural(n: number, um: string, varios: string): string {
  return n === 1 ? um : varios
}

function OpcoesDeSistema({ sistemas, atual }: { sistemas: readonly SistemaNaLista[]; atual: string | undefined }) {
  const desconhecido = atual !== undefined && !sistemas.some((sistema) => sistema.id === atual)
  const grupos: [string, SistemaNaLista[]][] = [
    ['Que vêm com o Labirinto', sistemas.filter((sistema) => sistema.embutido)],
    ['Seus sistemas', sistemas.filter((sistema) => !sistema.embutido)],
  ]
  return (
    <>
      <option value="">Escolha o sistema</option>
      {desconhecido && <option value={atual}>Sistema que não está neste computador</option>}
      {grupos
        .filter(([, lista]) => lista.length > 0)
        .map(([rotulo, lista]) => (
          <optgroup key={rotulo} label={rotulo}>
            {lista.map((sistema) => (
              <option key={sistema.id} value={sistema.id}>
                {sistema.nome}
              </option>
            ))}
          </optgroup>
        ))}
    </>
  )
}

/** Os cartões das campanhas, sem disco: quem monta lê e grava (a página de prova usa dados inventados). */
export function CartoesDasCampanhas(props: CartoesDasCampanhasProps) {
  const { campanhas, pastas, aviso, sistemas, numeros, podeMudarNaPasta, travado } = props
  const [mudando, setMudando] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [torrada, setTorrada] = useState<{ chave: number; texto: string; desfazer?: () => Promise<unknown> } | null>(null)

  const nomeDoSistema = (id: string) => sistemas.find((sistema) => sistema.id === id)?.nome ?? 'um sistema que não está neste computador'

  const executar = async (acao: () => Promise<Resultado>) => {
    setOcupado(true)
    try {
      const resultado = await acao()
      if (resultado !== null) setTorrada({ chave: Date.now(), ...resultado })
    } catch (erro) {
      setTorrada({ chave: Date.now(), texto: erro instanceof Error ? erro.message : String(erro) })
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="cp">
      <h2 className="cp__tit">Campanhas e sistemas</h2>
      <p className="cp__sub">Cada campanha do Prelúdio aponta para uma pasta de mapas do Labirinto. O sistema de RPG mora na pasta: Virar NPC e Pôr no mapa usam esse sistema.</p>
      {aviso !== null && (
        <p className="cp-aviso" role="status">
          {aviso}
        </p>
      )}
      {campanhas.length === 0 ? (
        <p className="pr-vazio__texto">Nenhuma campanha ainda. Importe as campanhas do Grimório na tela Início.</p>
      ) : (
        <div className="cp-lista">
          {campanhas.map((campanha) => {
            const pasta = campanha.pastaId === undefined ? undefined : pastas?.find((uma) => uma.id === campanha.pastaId)
            const sistema = sistemaDaCampanha(campanha, (pastaId) => pastas?.find((uma) => uma.id === pastaId)?.sistemaId)
            const conta = numeros(campanha.id)
            const outras = pasta === undefined ? 0 : campanhas.filter((outra) => outra.id !== campanha.id && outra.pastaId === pasta.id).length
            const idDoSistema = `cp-sis-${campanha.id}`
            const idDaPasta = `cp-pm-${campanha.id}`
            const desligado = travado || ocupado
            let linhaDoSistema
            if (pasta !== undefined && pasta.sistemaId !== undefined && mudando !== campanha.id) {
              linhaDoSistema = (
                <>
                  <span className="cp-trava" id={idDoSistema}>
                    <IconeCadeado />
                    {nomeDoSistema(pasta.sistemaId)}
                  </span>
                  <span className="cp-explica">vem da pasta</span>
                  {podeMudarNaPasta ? (
                    <button type="button" className="gr-bt gr-bt--p gr-bt--fantasma" disabled={desligado} onClick={() => setMudando(campanha.id)}>
                      Mudar na pasta
                    </button>
                  ) : (
                    <span className="cp-explica">muda na janela principal do Labirinto</span>
                  )}
                </>
              )
            } else if (pasta !== undefined && podeMudarNaPasta) {
              const aviso = mudando === campanha.id
              // A pasta sem sistema mostra o que a campanha guardou (é o que vale) e oferece levá-lo para a pasta.
              const daCampanha = pasta.sistemaId === undefined ? campanha.sistemaId : undefined
              const mapasDela = pasta.usam === 1 ? 'o mapa' : `os ${pasta.usam} mapas`
              linhaDoSistema = (
                <>
                  <select
                    className="pr-campo__entrada"
                    id={idDoSistema}
                    value={pasta.sistemaId ?? daCampanha ?? ''}
                    disabled={desligado}
                    onChange={(evento) => {
                      const escolhido = evento.target.value === '' ? null : evento.target.value
                      setMudando(null)
                      void executar(() => props.aoEscolherSistemaDaPasta(pasta, escolhido))
                    }}
                  >
                    <OpcoesDeSistema sistemas={sistemas} atual={pasta.sistemaId ?? daCampanha} />
                  </select>
                  {aviso ? (
                    <>
                      <span className="cp-aviso">
                        Vale para {mapasDela} da pasta
                        {outras > 0 ? ` e para ${outras === 1 ? 'outra campanha' : `${outras} outras campanhas`}` : ''}.
                      </span>
                      <button type="button" className="gr-bt gr-bt--p gr-bt--fantasma" onClick={() => setMudando(null)}>
                        Pronto
                      </button>
                    </>
                  ) : daCampanha !== undefined ? (
                    <>
                      <span className="cp-explica">Guardado na campanha: a pasta {pasta.nome} ainda não tem sistema.</span>
                      <button type="button" className="gr-bt gr-bt--p gr-bt--fantasma" disabled={desligado} onClick={() => void executar(() => props.aoEscolherSistemaDaPasta(pasta, daCampanha))}>
                        Gravar na pasta
                      </button>
                    </>
                  ) : (
                    <span className="cp-explica">
                      Fica gravado na pasta {pasta.nome}, para {mapasDela} dela.
                    </span>
                  )}
                </>
              )
            } else {
              linhaDoSistema = (
                <>
                  <select
                    className="pr-campo__entrada"
                    id={idDoSistema}
                    value={campanha.sistemaId ?? ''}
                    disabled={desligado}
                    onChange={(evento) => void executar(() => props.aoEscolherSistemaDaCampanha(campanha, evento.target.value === '' ? null : evento.target.value))}
                  >
                    <OpcoesDeSistema sistemas={sistemas} atual={campanha.sistemaId} />
                  </select>
                  <span className="cp-explica">
                    {pasta === undefined ? 'Sem pasta de mapas, o sistema fica guardado na campanha até você escolher uma.' : 'A pasta ainda não tem sistema: este fica na campanha até a pasta ter um.'}
                  </span>
                </>
              )
            }
            return (
              <section key={campanha.id} className={`cp-cartao${sistema.sistemaId === null ? ' e-aberta' : ''}`} aria-labelledby={`cp-${campanha.id}`}>
                <div className="cp-cartao__cab">
                  <h3 className="cp-cartao__nome" id={`cp-${campanha.id}`}>
                    {campanha.nome || 'Campanha sem nome'}
                  </h3>
                  {sistema.sistemaId !== null ? (
                    <span className="cp-estado">
                      <i aria-hidden="true" />
                      Ligada ao {nomeDoSistema(sistema.sistemaId)}
                    </span>
                  ) : (
                    <span className="cp-estado cp-estado--falta">
                      <i aria-hidden="true" />
                      Falta o sistema
                    </span>
                  )}
                </div>
                <div className="cp-linha">
                  <label htmlFor={idDaPasta}>Pasta de mapas</label>
                  <div className="cp-valor">
                    <select
                      className="pr-campo__entrada"
                      id={idDaPasta}
                      value={campanha.pastaId ?? ''}
                      disabled={desligado || pastas === null}
                      onChange={(evento) => {
                        const valor = evento.target.value
                        setMudando(null)
                        const criar = props.aoCriarPasta
                        if (valor === NOVA_PASTA) {
                          if (criar !== null) void executar(() => criar(campanha))
                          return
                        }
                        void executar(() => props.aoEscolherPasta(campanha, valor === '' ? null : valor))
                      }}
                    >
                      <option value="">Nenhuma</option>
                      {campanha.pastaId !== undefined && pastas !== null && pasta === undefined && <option value={campanha.pastaId}>Pasta que não existe mais</option>}
                      {(pastas ?? []).map((uma) => (
                        <option key={uma.id} value={uma.id}>
                          {uma.nome} ({uma.sistemaId === undefined ? 'sem sistema' : nomeDoSistema(uma.sistemaId)})
                        </option>
                      ))}
                      {props.aoCriarPasta !== null && <option value={NOVA_PASTA}>Nova pasta de mapas…</option>}
                    </select>
                    {pasta !== undefined && (
                      <span className="cp-explica">
                        {pasta.mapas} {plural(pasta.mapas, 'mapa', 'mapas')}
                      </span>
                    )}
                    {pastas === null && <span className="cp-explica">Lendo as pastas…</span>}
                  </div>
                </div>
                <div className="cp-linha">
                  <label htmlFor={idDoSistema}>Sistema de RPG</label>
                  <div className="cp-valor">{linhaDoSistema}</div>
                </div>
                <div className="cp-numeros">
                  <span>
                    <b>{conta.personagens}</b>
                    {plural(conta.personagens, 'personagem', 'personagens')}
                  </span>
                  <span>
                    <b>{conta.npcs}</b>
                    {conta.npcs === 1 ? 'já é NPC' : 'já são NPC'}
                  </span>
                  {conta.jogadores > 0 && (
                    <span>
                      <b>{conta.jogadores}</b>
                      {conta.jogadores === 1 ? 'é jogador' : 'são jogadores'}
                    </span>
                  )}
                  <span>
                    <b>{conta.sessoes}</b>
                    {plural(conta.sessoes, 'sessão', 'sessões')}
                  </span>
                  <span>
                    <b>{conta.eventos}</b>
                    {plural(conta.eventos, 'evento', 'eventos')} na linha do tempo
                  </span>
                </div>
              </section>
            )
          })}
        </div>
      )}
      {torrada !== null && (
        <Torradas>
          <Torrada
            key={torrada.chave}
            mensagem={torrada.texto}
            acao={
              torrada.desfazer === undefined
                ? undefined
                : {
                    rotulo: 'Desfazer',
                    onClick: () => {
                      const desfazer = torrada.desfazer
                      if (desfazer === undefined) return
                      void executar(async () => {
                        await desfazer()
                        return { texto: 'Desfeito.' }
                      })
                    },
                  }
            }
            onFechar={() => setTorrada((agora) => (agora?.chave === torrada.chave ? null : agora))}
          />
        </Torradas>
      )}
    </div>
  )
}

// ─── A página, com o disco ───────────────────────────────────────────────────

interface DadosDasPastas {
  readonly pastas: readonly PastaDeMapasNoCartao[]
  readonly aviso: string | null
}

/** As pastas de mapas, o sistema e os mapas de cada uma. Nunca lança (as duas leituras não lançam). */
async function lerDadosDasPastas(): Promise<DadosDasPastas> {
  const { indice, aviso } = await lerIndiceDasPastas()
  const pastas = await Promise.all(
    indice.pastas.map(async (pasta): Promise<PastaDeMapasNoCartao> => {
      const lido = await lerRpgDaPasta(pasta.id)
      return { id: pasta.id, nome: pasta.nome, sistemaId: lido.ok ? lido.rpg.sistemaDeRpg : undefined, mapas: mapasNaPasta(indice, pasta.id), usam: mapasQueUsamAPasta(indice, pasta.id) }
    }),
  )
  return { pastas, aviso }
}

/** Os eventos da linha do tempo que vieram de uma sessão da campanha (o evento ainda não tem campanha própria). */
export function numerosDe(campanhaId: string, verbetes: ReadonlyMap<string, Verbete>, sessoesDoEvento: readonly (string | undefined)[], tipos: TiposDasFichas): NumerosDaCampanha {
  let personagens = 0
  let npcs = 0
  let jogadores = 0
  let sessoes = 0
  const daCampanha = new Set<string>()
  for (const verbete of verbetes.values()) {
    if (!verbete.campanhas.includes(campanhaId)) continue
    if (verbete.tipo === 'personagem') {
      personagens += 1
      const tipo = tipoDaFichaLigada(verbete, tipos)
      if (tipo === 'npc') npcs += 1
      else if (tipo === 'jogador') jogadores += 1
    } else if (verbete.tipo === 'sessao') {
      sessoes += 1
      daCampanha.add(verbete.id)
    }
  }
  const eventos = sessoesDoEvento.filter((sessaoId) => sessaoId !== undefined && daCampanha.has(sessaoId)).length
  return { personagens, npcs, jogadores, sessoes, eventos }
}

/**
 * Grava o sistema na pasta como a configuração da pasta grava (`PastaDeMapasConfig`):
 * pasta no Lobby não muda; a pasta convertida que volta a ter sistema confere
 * a mochila dos bonecos. Carregado só quando usado (só a janela principal grava aqui).
 */
async function gravarSistemaNaPasta(pastaId: string, sistemaId: string | null, vinhaSemSistema: boolean): Promise<void> {
  const [{ campanhaDaPasta }, { SISTEMA_FIXO_NO_LOBBY }, { trocarSistemaDaPasta }, { editarRpgDaPasta }] = await Promise.all([
    import('../../components/nuvem/ponteDoLobby'),
    import('../../components/nuvem/usePastaPublicada'),
    import('../../net/nuvem/mochilaPendenteNoApp'),
    import('../../stores/rpgDaPasta'),
  ])
  if ((await campanhaDaPasta(pastaId)) !== null) throw new Error(SISTEMA_FIXO_NO_LOBBY)
  await trocarSistemaDaPasta(pastaId, vinhaSemSistema, (rpg) => rpgComSistema(rpg, sistemaId), async (mudar) => {
    await editarRpgDaPasta(pastaId, mudar)
  })
}

async function criarPastaDeMapas(nome: string): Promise<string> {
  const { criarPasta, mudarIndiceDasPastas } = await import('../../lib/pastasDeMapas')
  let criada = ''
  await mudarIndiceDasPastas((indice) => {
    const resultado = criarPasta(indice, nome)
    criada = resultado.pasta.id
    return resultado.indice
  })
  return criada
}

function lancarSeFalhou(motivo: string | null): void {
  if (motivo !== null) throw new Error(motivo)
}

export function CampanhasESistemas({ naJanela }: { naJanela: boolean }) {
  const campanhas = usePreludio((estado) => estado.campanhas)
  const verbetes = usePreludio((estado) => estado.verbetes)
  const tempo = usePreludio((estado) => estado.tempo.tempo)
  const travado = usePreludio((estado) => estado.travado)
  const mudarCampanha = usePreludio((estado) => estado.mudarCampanha)
  const biblioteca = useRpgStore((estado) => estado.biblioteca)
  const carregarBiblioteca = useRpgStore((estado) => estado.carregarBiblioteca)
  const [dados, setDados] = useState<DadosDasPastas | null>(null)
  const [leitura, setLeitura] = useState(0)
  const tipos = useTiposDasFichasLigadas(useMemo(() => [...verbetes.values()], [verbetes]))

  // A janela do Prelúdio não lê `<appData>/sistemas`: lá a lista fica com os que vêm com o Labirinto.
  useEffect(() => {
    if (!naJanela) void carregarBiblioteca()
  }, [carregarBiblioteca, naJanela])

  useEffect(() => {
    let viva = true
    void lerDadosDasPastas().then((lidos) => {
      if (viva) setDados(lidos)
    })
    return () => {
      viva = false
    }
  }, [leitura])

  const embutidos = useMemo(() => new Set(SISTEMAS_EMBUTIDOS.map((sistema) => sistema.id)), [])
  const sistemas = useMemo(() => biblioteca.map((sistema) => ({ id: sistema.id, nome: sistema.nome, embutido: embutidos.has(sistema.id) })), [biblioteca, embutidos])
  const sessoesDosEventos = useMemo(() => (tempo?.eventos ?? []).map((evento) => evento.sessaoId), [tempo])
  const numeros = useCallback((campanhaId: string) => numerosDe(campanhaId, verbetes, sessoesDosEventos, tipos), [verbetes, sessoesDosEventos, tipos])
  const nome = (sistemaId: string | null) => (sistemaId === null ? 'nenhum sistema' : (sistemaPorId(biblioteca, sistemaId)?.nome ?? 'um sistema que não está neste computador'))
  const sistemaDe = (pastaId: string | null) => (pastaId === null ? undefined : dados?.pastas.find((pasta) => pasta.id === pastaId)?.sistemaId)

  const escolherPasta = async (campanha: Campanha, pastaId: string | null): Promise<Resultado> => {
    const antes = campanha
    lancarSeFalhou(await mudarCampanha(campanha.id, (atual) => campanhaComPasta(atual, pastaId, sistemaDe(pastaId))))
    const pasta = dados?.pastas.find((uma) => uma.id === pastaId)
    const desfazer = () => mudarCampanha(campanha.id, () => antes).then(lancarSeFalhou)
    if (pasta === undefined) return { texto: `${campanha.nome} ficou sem pasta de mapas.`, desfazer }
    return { texto: `${campanha.nome} agora usa ${pasta.nome}${pasta.sistemaId === undefined ? '' : `, com o sistema ${nome(pasta.sistemaId)}`}.`, desfazer }
  }

  const escolherSistemaDaCampanha = async (campanha: Campanha, sistemaId: string | null): Promise<Resultado> => {
    const antes = campanha.sistemaId ?? null
    lancarSeFalhou(await mudarCampanha(campanha.id, (atual) => campanhaComSistema(atual, sistemaId)))
    const desfazer = () => mudarCampanha(campanha.id, (atual) => campanhaComSistema(atual, antes)).then(lancarSeFalhou)
    return { texto: sistemaId === null ? `${campanha.nome} ficou sem sistema.` : `${campanha.nome} ligada ao ${nome(sistemaId)}. Virar NPC já usa este sistema.`, desfazer }
  }

  const escolherSistemaDaPasta = async (pasta: PastaDeMapasNoCartao, sistemaId: string | null): Promise<Resultado> => {
    if (sistemaId === (pasta.sistemaId ?? null)) return null
    try {
      await gravarSistemaNaPasta(pasta.id, sistemaId, pasta.sistemaId === undefined)
    } finally {
      setLeitura((anterior) => anterior + 1)
    }
    // A pasta ganhou sistema: a campanha não guarda mais o seu (só guarda enquanto não tem pasta com sistema).
    if (sistemaId !== null) {
      for (const campanha of campanhas) {
        if (campanha.pastaId === pasta.id && campanha.sistemaId !== undefined) lancarSeFalhou(await mudarCampanha(campanha.id, (atual) => campanhaComSistema(atual, null)))
      }
    }
    const mapas = pasta.usam === 1 ? 'no mapa dela' : `nos ${pasta.usam} mapas dela`
    return { texto: `${pasta.nome} agora é ${sistemaId === null ? 'sem sistema' : nome(sistemaId)}, ${mapas}.` }
  }

  const criarPasta = async (campanha: Campanha): Promise<Resultado> => {
    const nomeDaPasta = `Mapas de ${campanha.nome}`
    const pastaId = await criarPastaDeMapas(nomeDaPasta)
    setLeitura((anterior) => anterior + 1)
    lancarSeFalhou(await mudarCampanha(campanha.id, (atual) => campanhaComPasta(atual, pastaId, undefined)))
    return { texto: `Pasta de mapas ${nomeDaPasta} criada no Labirinto.` }
  }

  return (
    <CartoesDasCampanhas
      campanhas={campanhas}
      pastas={dados?.pastas ?? null}
      aviso={dados?.aviso ?? null}
      sistemas={sistemas}
      numeros={numeros}
      podeMudarNaPasta={!naJanela}
      travado={travado}
      aoEscolherPasta={escolherPasta}
      aoCriarPasta={naJanela ? null : criarPasta}
      aoEscolherSistemaDaCampanha={escolherSistemaDaCampanha}
      aoEscolherSistemaDaPasta={escolherSistemaDaPasta}
    />
  )
}
