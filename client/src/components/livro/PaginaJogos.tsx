import { useEffect } from 'react'
import { Acoes, Botao } from '../grimorio/Botao'
import { CampoSeg, type OpcaoDoSeg } from '../grimorio/CampoSeg'
import { CampoTexto } from '../grimorio/CampoTexto'
import { Nota } from '../grimorio/Nota'
import { SubFicha } from '../grimorio/Cartoes'
import { MinigameControls, type MinigameControlsProps } from '../MinigameControls'
import { FolhaDoLivro, TituloDaPagina } from './FolhaDoLivro'
import type { PaginaExtraDoMestre } from './LivroDoMestre'
import { IconeDoJogo, IconeDosJogos } from './IconeDoJogo'
import { DESAFIO_NOME_MAX_LENGTH, desafiosDo, desafiosMigrados, faltaNoLugar, novoDesafio, pontoDoDesafio, textoDoLugar } from '../../lib/desafios'
import { ORDEM_DOS_JOGOS, nomeDoJogo } from '../../minigames/registro'
import type { JogoDoMinigame } from '../../minigames/tipos'
import type { DancaAoVivo } from '../../net/dancaNoHost'
import type { PescaAoVivo } from '../../net/pescaNoHost'
import type { TiroAoVivo } from '../../net/tiroNoHost'
import type { FogoAoVivo } from '../../net/fogoNoHost'
import type { BolhaAoVivo } from '../../net/bolhaNoHost'
import type { Desafio, Prop, TipoDoLugarDoDesafio } from '../../types/map'
import { useAdventureStore } from '../../stores/adventureStore'
import { useDesafiosStore } from '../../stores/desafiosStore'
import { useMapStore } from '../../stores/mapStore'
import './paginaJogos.css'

/**
 * A PÁGINA JOGOS do livro do mestre (desafios, 15/11/2026; protótipo aprovado
 * com o pedido "coloca jogos para o lado esquerdo"): os minigames da cena fora
 * do pino. Lista, ao vivo, ficha de cada desafio (o mesmo painel do jogo que o
 * pino tinha) e o aviso dos pinos ▷ que viraram desafios ao abrir o mapa.
 */

/** O marcador da página no livro, antes do Roteiro do Prelúdio. */
export const PAGINA_DOS_JOGOS: PaginaExtraDoMestre = { id: 'jogos', rotulo: 'Jogos', icone: <IconeDosJogos /> }

/** Uma sessão ao vivo da sala, pelo id do desafio (o `pinId` das sessões). */
export interface SessaoAoVivo {
  pinId: string
  jogo: JogoDoMinigame
  fase: string
  jogadores: number
}

interface SessaoDoHost {
  pinId: string
  fase: string
  participantes: readonly unknown[]
}

function sessao(jogo: JogoDoMinigame, s: SessaoDoHost): SessaoAoVivo {
  return { pinId: s.pinId, jogo, fase: s.fase, jogadores: s.participantes.length }
}

/** As sessões da sala que ainda não acabaram, de todos os jogos. */
export function sessoesAoVivo(fontes: {
  danca: DancaAoVivo | null
  pescas: readonly PescaAoVivo[]
  tiros: readonly TiroAoVivo[]
  fogo: FogoAoVivo | null
  bolha: BolhaAoVivo | null
}): SessaoAoVivo[] {
  return [
    ...(fontes.danca === null ? [] : [sessao('danca', fontes.danca)]),
    ...fontes.pescas.map((s) => sessao('pesca', s)),
    ...fontes.tiros.map((s) => sessao('tiro', s)),
    ...(fontes.fogo === null ? [] : [sessao('fogo', fontes.fogo)]),
    ...(fontes.bolha === null ? [] : [sessao('bolha', fontes.bolha)]),
  ].filter((s) => s.fase !== 'encerrada')
}

const TEXTO_DA_FASE: Readonly<Record<string, string>> = {
  convite: 'chamando',
  musica: 'dançando',
  jogo: 'em jogo',
  aberta: 'aberta',
  pausa: 'em pausa',
  fim: 'acabando',
}

const OPCOES_DO_LUGAR: readonly OpcaoDoSeg<TipoDoLugarDoDesafio>[] = [
  { valor: 'ponto', rotulo: 'Ponto' },
  { valor: 'objeto', rotulo: 'Objeto' },
  { valor: 'nenhum', rotulo: 'Sem lugar' },
]

function Seta() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

/** Leva a câmera do editor ao selo do desafio (e ao piso dele). Sem lugar no mapa: nada. */
function irAoDesafio(desafio: Desafio, props: readonly Prop[]): void {
  const ponto = pontoDoDesafio(desafio, props)
  if (ponto === null) return
  const store = useMapStore.getState()
  const piso = ponto.piso ?? 0
  if (piso !== store.pisoAtivo) store.setPisoAtivo(piso)
  useAdventureStore.getState().goToPoint(null, { x: ponto.x, y: ponto.y })
}

interface PropsDaPaginaJogos {
  /** O painel do jogo do desafio (o mesmo que o pino tinha), montado pelo App com a sala e a visão de teste. */
  painelDoDesafio: (desafio: Desafio) => MinigameControlsProps
  /** As sessões ao vivo da sala (`sessoesAoVivo`). */
  aoVivo: readonly SessaoAoVivo[]
}

export function PaginaJogos({ painelDoDesafio, aoVivo }: PropsDaPaginaJogos) {
  const map = useMapStore((estado) => estado.map)
  const abertoId = useDesafiosStore((estado) => estado.aberto)
  const avisoDispensado = useDesafiosStore((estado) => estado.avisosDispensados.has(map.id))
  const desafios = desafiosDo(map)
  const aberto = desafios.find((desafio) => desafio.id === abertoId)
  return (
    <FolhaDoLivro pagina="jogos">
      {aberto === undefined ? (
        <ListaDosJogos desafios={desafios} props={map.props} aoVivo={aoVivo} mapaId={map.id} avisoDispensado={avisoDispensado} />
      ) : (
        <FichaDoDesafio key={aberto.id} desafio={aberto} props={map.props} painel={painelDoDesafio(aberto)} />
      )}
    </FolhaDoLivro>
  )
}

interface PropsDaLista {
  desafios: readonly Desafio[]
  props: readonly Prop[]
  aoVivo: readonly SessaoAoVivo[]
  mapaId: string
  avisoDispensado: boolean
}

function ListaDosJogos({ desafios, props, aoVivo, mapaId, avisoDispensado }: PropsDaLista) {
  const migrados = desafiosMigrados({ desafios: [...desafios] })
  const { abrir, dispensarAviso } = useDesafiosStore.getState()
  const emJogo = new Set(aoVivo.map((s) => s.pinId))
  const nomeDe = (id: string) => desafios.find((desafio) => desafio.id === id)?.nome

  const criar = () => {
    const desafio = novoDesafio(crypto.randomUUID(), ORDEM_DOS_JOGOS[0])
    useMapStore.getState().addDesafio(desafio)
    abrir(desafio.id)
  }
  const mostrarMigrados = () => {
    const primeiro = migrados.find((desafio) => pontoDoDesafio(desafio, props) !== null)
    if (primeiro === undefined) return
    irAoDesafio(primeiro, props)
    abrir(primeiro.id)
  }

  return (
    <>
      <TituloDaPagina titulo="Jogos" sub="Os desafios desta cena: dança, pesca, tiro, fogo e bolha." />
      {migrados.length > 0 && !avisoDispensado && (
        <div className="mg-aviso" role="status">
          <p>
            {migrados.length === 1 ? '1 pino ▷ deste mapa virou desafio.' : `${migrados.length} pinos ▷ deste mapa viraram desafios.`} Os jogos
            moram aqui agora; no mapa, cada um aparece como um selo.
          </p>
          <Acoes>
            <Botao variante="latao" tamanho="p" onClick={mostrarMigrados}>
              Mostrar no mapa
            </Botao>
            <Botao variante="fantasma" tamanho="p" onClick={() => dispensarAviso(mapaId)}>
              Entendi
            </Botao>
          </Acoes>
        </div>
      )}

      {aoVivo.length > 0 && (
        <>
          <h3 className="mg-secao">
            Ao vivo <small>{aoVivo.length}</small>
          </h3>
          <ul className="mg-vivo">
            {aoVivo.map((s) => (
              <li key={`${s.jogo}:${s.pinId}`}>
                <button type="button" className="mg-linha" onClick={() => abrir(s.pinId)}>
                  <span className="mg-linha__med">
                    <IconeDoJogo jogo={s.jogo} />
                  </span>
                  <span className="mg-linha__nome">
                    <span className="mg-pulsando" aria-hidden="true" /> {nomeDe(s.pinId) ?? nomeDoJogo(s.jogo)}
                  </span>
                  <span className="mg-linha__seta">
                    <Seta />
                  </span>
                  <span className="mg-linha__onde">
                    {TEXTO_DA_FASE[s.fase] ?? s.fase} · {s.jogadores === 1 ? '1 jogador' : `${s.jogadores} jogadores`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className="mg-secao">
        Desafios <small>{desafios.length}</small>
      </h3>
      {desafios.length === 0 ? (
        <p className="mg-vazio">Nenhum desafio nesta cena. Crie um e marque onde ele acontece: um ponto do mapa ou um objeto.</p>
      ) : (
        <ul className="mg-lista">
          {desafios.map((desafio) => {
            const falta = faltaNoLugar(desafio, props)
            const temTags = desafio.eraPino !== undefined || emJogo.has(desafio.id) || falta !== null
            return (
              <li key={desafio.id}>
                <button type="button" className="mg-linha" onClick={() => abrir(desafio.id)}>
                  <span className="mg-linha__med">
                    <IconeDoJogo jogo={desafio.minigame.jogo} />
                  </span>
                  <span className="mg-linha__nome">{desafio.nome}</span>
                  <span className="mg-linha__seta">
                    <Seta />
                  </span>
                  <span className="mg-linha__onde">
                    {nomeDoJogo(desafio.minigame.jogo)} · {textoDoLugar(desafio, props)}
                  </span>
                  {temTags && (
                    <span className="mg-linha__tags">
                      {desafio.eraPino !== undefined && <span className="mg-tag mg-tag--latao">Era pino ▷</span>}
                      {emJogo.has(desafio.id) && <span className="mg-tag mg-tag--feito">Em jogo</span>}
                      {falta !== null && <span className="mg-tag mg-tag--perigo">{falta}</span>}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <div className="mg-nota-pe">
        <Botao variante="latao" largo onClick={criar}>
          Novo desafio
        </Botao>
      </div>

      <h3 className="mg-secao">Baús, caixas e barris</h3>
      <p className="mg-vazio">Chegam na próxima fase: o que cada baú, caixa e barril guarda, a armadilha e o efeito dela.</p>
    </>
  )
}

interface PropsDaFicha {
  desafio: Desafio
  props: readonly Prop[]
  painel: MinigameControlsProps
}

function FichaDoDesafio({ desafio, props, painel }: PropsDaFicha) {
  const marcando = useDesafiosStore((estado) => estado.marcando)
  const { abrir, marcar, pararDeMarcar } = useDesafiosStore.getState()
  const marcandoEste = marcando !== null && marcando.id === desafio.id ? marcando.modo : null
  const falta = faltaNoLugar(desafio, props)
  const gravar = useMapStore.getState().updateDesafio

  // Fechar a ficha (voltar, apagar, outra página) cancela o "Marcar no mapa" deste desafio.
  useEffect(
    () => () => {
      if (useDesafiosStore.getState().marcando?.id === desafio.id) useDesafiosStore.getState().pararDeMarcar()
    },
    [desafio.id],
  )
  // Esc cancela a marcação em curso.
  useEffect(() => {
    if (marcandoEste === null) return
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') useDesafiosStore.getState().pararDeMarcar()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [marcandoEste])

  const escolherLugar = (tipo: TipoDoLugarDoDesafio) => {
    if (tipo === 'nenhum') {
      pararDeMarcar()
      if (desafio.lugar.tipo !== 'nenhum') gravar(desafio.id, { lugar: { tipo: 'nenhum' } })
      return
    }
    marcar(desafio.id, tipo)
  }
  const apagar = () => {
    abrir(null)
    useMapStore.getState().removeDesafio(desafio.id)
  }

  return (
    <SubFicha voltarPara="Jogos" onVoltar={() => abrir(null)} icone={<IconeDoJogo jogo={desafio.minigame.jogo} />} titulo={desafio.nome} tipo={`Desafio de ${nomeDoJogo(desafio.minigame.jogo).toLowerCase()}`}>
      <CampoTexto rotulo="Nome" valor={desafio.nome} maxLength={DESAFIO_NOME_MAX_LENGTH} onChange={(nome) => gravar(desafio.id, { nome })} />
      <div className="mg-onde">
        <CampoSeg rotulo="Onde fica" opcoes={OPCOES_DO_LUGAR} valor={marcandoEste ?? desafio.lugar.tipo} onChange={escolherLugar} />
        {marcandoEste !== null ? (
          <>
            <Nota>{marcandoEste === 'ponto' ? 'Clique no mapa onde o jogo acontece.' : 'Clique no objeto do mapa onde o jogo acontece.'} Esc cancela.</Nota>
            <Acoes>
              <Botao variante="fantasma" tamanho="p" onClick={pararDeMarcar}>
                Cancelar
              </Botao>
            </Acoes>
          </>
        ) : (
          <>
            <Nota>
              Fica {textoDoLugar(desafio, props)}.{falta !== null && ` ${falta}: escolha outro lugar.`}
            </Nota>
            {desafio.lugar.tipo !== 'nenhum' && (
              <Acoes>
                <Botao variante="fantasma" tamanho="p" onClick={() => marcar(desafio.id, desafio.lugar.tipo === 'objeto' ? 'objeto' : 'ponto')}>
                  {desafio.lugar.tipo === 'objeto' ? 'Escolher outro objeto' : 'Marcar de novo'}
                </Botao>
                {falta === null && (
                  <Botao variante="fantasma" tamanho="p" onClick={() => irAoDesafio(desafio, props)}>
                    Mostrar no mapa
                  </Botao>
                )}
              </Acoes>
            )}
          </>
        )}
      </div>
      <MinigameControls key={desafio.id} {...painel} />
      {desafio.eraPino !== undefined && (
        <Nota>
          Veio do pino ▷{desafio.eraPino.nome ? ` “${desafio.eraPino.nome}”` : ''}. O pino saiu do mapa; o selo do desafio ficou no lugar dele.
        </Nota>
      )}
      <div className="mg-nota-pe">
        <Botao variante="perigo" onClick={apagar}>
          Apagar desafio
        </Botao>
      </div>
    </SubFicha>
  )
}
