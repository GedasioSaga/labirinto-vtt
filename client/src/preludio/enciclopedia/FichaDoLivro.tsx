import { useEffect, useRef, useState } from 'react'
import { Dialogo } from '../../components/grimorio/Dialogo'
import { lerIndiceDasPastas, lerRpgDaPasta, type PastaDeMapas } from '../../lib/pastasDeMapas'
import type { Personagem } from '../../lib/personagem'
import { campanhaComPastaDoVerbete, campanhaParaLigar } from '../../lib/preparo/doVerbeteParaOMapa'
import type { Forma, LigaFicha, Verbete } from '../../lib/preparo/tipos'
import { LigarCampanhaAPasta } from '../campanhas/LigarCampanhaAPasta'
import { usePreludio } from '../estado/preludio'
import { anotarFichasDaPasta } from './tiposDasFichas'
import { VirarNpc } from './VirarNpc'

/**
 * VERBETE ↔ FICHA DO LIVRO (plano §2): pelo `Personagem.id` do `rpg.json` da
 * pasta, sem juntar os dois. Só lê as pastas; ligar e desligar mexem só no
 * verbete. Ficha que sumiu aparece como "não existe mais", nunca como erro.
 */

type Pastas = { t: 'lendo' } | { t: 'lidas'; pastas: readonly PastaDeMapas[]; aviso: string | null }
type Fichas = { t: 'lendo' } | { t: 'lidas'; personagens: readonly Personagem[] } | { t: 'falhou'; motivo: string }

function usePastas(): Pastas {
  const [pastas, setPastas] = useState<Pastas>({ t: 'lendo' })
  useEffect(() => {
    let vivo = true
    void lerIndiceDasPastas().then(({ indice, aviso }) => {
      if (vivo) setPastas({ t: 'lidas', pastas: indice.pastas, aviso })
    })
    return () => {
      vivo = false
    }
  }, [])
  return pastas
}

function useFichas(pastaId: string | null): Fichas {
  const [fichas, setFichas] = useState<Fichas>({ t: 'lendo' })
  useEffect(() => {
    if (pastaId === null) return
    let vivo = true
    setFichas({ t: 'lendo' })
    void lerRpgDaPasta(pastaId).then((lido) => {
      // A pasta lida conta o tipo das fichas ao selo "NPC"/"Jogador" das listas, mesmo que esta tela já tenha fechado.
      if (lido.ok) anotarFichasDaPasta(pastaId, lido.rpg.personagens)
      if (!vivo) return
      setFichas(lido.ok ? { t: 'lidas', personagens: lido.rpg.personagens } : { t: 'falhou', motivo: lido.motivo })
    })
    return () => {
      vivo = false
    }
  }, [pastaId])
  return fichas
}

function mesmaFicha(a: LigaFicha, b: LigaFicha): boolean {
  return a.pastaId === b.pastaId && a.personagemId === b.personagemId
}

function FichaLigada({ ligacao, pastas, editavel, aoDesligar }: { ligacao: LigaFicha; pastas: Pastas; editavel: boolean; aoDesligar: () => void }) {
  const fichas = useFichas(ligacao.pastaId)
  const pasta = pastas.t === 'lidas' ? pastas.pastas.find((uma) => uma.id === ligacao.pastaId) : undefined
  const personagem = fichas.t === 'lidas' ? fichas.personagens.find((um) => um.id === ligacao.personagemId) : undefined
  const sumiu = (pastas.t === 'lidas' && pasta === undefined) || (fichas.t === 'lidas' && personagem === undefined)
  return (
    <li className="pr-ficha">
      <span className="pr-ficha__nome">
        {fichas.t === 'lendo' || pastas.t === 'lendo' ? 'Lendo a ficha…' : sumiu ? 'A ficha não existe mais' : (personagem?.nome ?? 'Ficha sem nome')}
      </span>
      <span className="pr-ficha__onde">
        {fichas.t === 'falhou' ? `Não deu para ler a pasta: ${fichas.motivo}` : pasta === undefined ? 'Pasta apagada' : `${personagem?.tipo === 'npc' ? 'NPC' : 'Jogador'} na pasta ${pasta.nome}`}
      </span>
      {editavel && (
        <button type="button" className="gr-bt gr-bt--p gr-bt--fantasma" onClick={aoDesligar}>
          Desligar
        </button>
      )}
    </li>
  )
}

function EscolherFicha({ aberto, pastaInicial, ligadas, aoEscolher, aoFechar }: { aberto: boolean; pastaInicial: string | null; ligadas: readonly LigaFicha[]; aoEscolher: (ligacao: LigaFicha) => void; aoFechar: () => void }) {
  const pastas = usePastas()
  const [pastaId, setPastaId] = useState<string | null>(pastaInicial)
  const lidas = pastas.t === 'lidas' ? pastas.pastas : []
  const escolhida = pastaId ?? lidas[0]?.id ?? null
  const fichas = useFichas(escolhida)
  return (
    <Dialogo aberto={aberto} titulo="Ligar a uma ficha do Livro" onFechar={aoFechar} descricao="A ficha continua no Livro do mestre; o verbete só guarda qual é.">
      {pastas.t === 'lendo' ? (
        <p className="pr-quieto">Lendo as pastas…</p>
      ) : lidas.length === 0 ? (
        pastas.aviso !== null ? (
          <p className="pr-aviso" role="alert">
            {pastas.aviso}
          </p>
        ) : (
          <p className="pr-quieto">Nenhuma pasta de mapas ainda. As fichas moram nas pastas da tela Carregar mapa.</p>
        )
      ) : (
        <>
          <label className="pr-campo">
            <span className="pr-campo__rotulo">Pasta</span>
            <select className="pr-campo__entrada" value={escolhida ?? ''} onChange={(evento) => setPastaId(evento.target.value)}>
              {lidas.map((pasta) => (
                <option key={pasta.id} value={pasta.id}>
                  {pasta.nome}
                </option>
              ))}
            </select>
          </label>
          {fichas.t === 'lendo' ? (
            <p className="pr-quieto">Lendo as fichas…</p>
          ) : fichas.t === 'falhou' ? (
            <p className="pr-aviso" role="alert">
              Não deu para ler as fichas desta pasta: {fichas.motivo}
            </p>
          ) : fichas.personagens.length === 0 ? (
            <p className="pr-quieto">Esta pasta ainda não tem fichas.</p>
          ) : (
            <ul className="pr-escolha">
              {fichas.personagens.map((personagem) => {
                const ligacao = { pastaId: escolhida ?? '', personagemId: personagem.id }
                const jaLigada = ligadas.some((outra) => mesmaFicha(outra, ligacao))
                return (
                  <li key={personagem.id}>
                    <button type="button" className="pr-escolha__item" disabled={jaLigada} onClick={() => aoEscolher(ligacao)}>
                      <span>{personagem.nome || 'Ficha sem nome'}</span>
                      <span className="pr-escolha__detalhe">{jaLigada ? 'Já ligada' : personagem.tipo === 'npc' ? 'NPC' : personagem.nomeDoJogador === undefined ? 'Jogador' : `Jogador: ${personagem.nomeDoJogador}`}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </Dialogo>
  )
}

export function FichaDoLivro({ verbete, forma, editavel }: { verbete: Verbete; forma: Forma; editavel: boolean }) {
  const pastas = usePastas()
  const [escolhendo, setEscolhendo] = useState(false)
  const [virando, setVirando] = useState(false)
  const [ligou, setLigou] = useState<{ readonly verbeteId: string; readonly texto: string } | null>(null)
  const virarNpc = useRef<HTMLButtonElement>(null)
  const campanhas = usePreludio((estado) => estado.campanhas)
  const ativa = usePreludio((estado) => estado.campanhaId)
  const mudarVerbete = usePreludio((estado) => estado.mudarVerbete)
  const ligadas = verbete.liga?.fichas ?? []
  const campanhaComPasta = campanhaComPastaDoVerbete(verbete, campanhas, ativa)
  const pastaDaCampanha = campanhaComPasta?.pastaId ?? null
  const paraLigar = pastaDaCampanha === null ? campanhaParaLigar(verbete, campanhas, ativa) : null
  const recemLigada = ligou !== null && ligou.verbeteId === verbete.id ? ligou.texto : null

  // Ligou a pasta ali mesmo: o "Virar NPC" acende e recebe o foco (o botão de ligar sumiu debaixo do cursor do teclado).
  useEffect(() => {
    if (recemLigada !== null && pastaDaCampanha !== null) virarNpc.current?.focus()
  }, [recemLigada, pastaDaCampanha])

  const mudarFichas = (mudar: (fichas: LigaFicha[]) => LigaFicha[]) =>
    mudarVerbete(verbete.id, (atual) => ({ ...atual, liga: { fichas: mudar([...(atual.liga?.fichas ?? [])]), cenas: [...(atual.liga?.cenas ?? [])] } }))

  return (
    <section className="pr-trilho__bloco" aria-labelledby="pr-ficha-titulo">
      <h3 id="pr-ficha-titulo" className="pr-trilho__titulo">
        Ficha do Livro
      </h3>
      {ligadas.length === 0 ? (
        <p className="pr-quieto">Sem ficha ligada. Ligar põe o verbete e a ficha do Livro do mestre lado a lado, pelo id.</p>
      ) : (
        <ul className="pr-fichas">
          {ligadas.map((ligacao) => (
            <FichaLigada
              key={`${ligacao.pastaId}/${ligacao.personagemId}`}
              ligacao={ligacao}
              pastas={pastas}
              editavel={editavel}
              aoDesligar={() => mudarFichas((fichas) => fichas.filter((outra) => !mesmaFicha(outra, ligacao)))}
            />
          ))}
        </ul>
      )}
      {editavel && ligadas.length === 0 && (
        <div className="pr-virar-npc">
          <button
            ref={virarNpc}
            type="button"
            className="gr-bt gr-bt--p gr-bt--primario"
            disabled={pastaDaCampanha === null}
            aria-describedby={pastaDaCampanha === null ? 'pr-virar-npc-motivo' : undefined}
            onClick={() => setVirando(true)}
          >
            Virar NPC
          </button>
          {pastaDaCampanha !== null ? (
            <p className="pr-virar-npc__motivo" id="pr-virar-npc-motivo" role={recemLigada === null ? undefined : 'status'}>
              {recemLigada === null ? 'Abre a ficha do sistema da campanha já com nome, retrato e descrição.' : `Pronto: ${recemLigada}. Virar NPC já abre a ficha.`}
            </p>
          ) : paraLigar === null ? (
            <p className="pr-virar-npc__motivo" id="pr-virar-npc-motivo">
              Para virar NPC, ponha este personagem numa campanha que tenha pasta de mapas.
            </p>
          ) : (
            <div id="pr-virar-npc-motivo">
              <LigarCampanhaAPasta campanha={paraLigar} aoLigar={(pasta) => setLigou({ verbeteId: verbete.id, texto: `${paraLigar.nome} usa a pasta ${pasta.nome}` })} />
            </div>
          )}
        </div>
      )}
      {editavel && (
        <button type="button" className="gr-bt gr-bt--p gr-bt--latao" onClick={() => setEscolhendo(true)}>
          Ligar a uma ficha…
        </button>
      )}
      {virando && pastaDaCampanha !== null && (
        <VirarNpc verbete={verbete} forma={forma} pastaId={pastaDaCampanha} aoFechar={() => setVirando(false)} aoFeito={() => setVirando(false)} />
      )}
      {escolhendo && (
        <EscolherFicha
          aberto={escolhendo}
          pastaInicial={pastaDaCampanha}
          ligadas={ligadas}
          aoFechar={() => setEscolhendo(false)}
          aoEscolher={(ligacao) => {
            mudarFichas((fichas) => [...fichas, ligacao])
            setEscolhendo(false)
          }}
        />
      )}
    </section>
  )
}
