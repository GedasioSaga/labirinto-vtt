import type { ReactNode } from 'react'
import { percentualDoVolume, useSomStore } from '../../stores/somStore'
import { ControleDeSom, TITULO_DO_SOM } from '../ControleDeSom'
import { NoiseControl, VisaoDeJogadorBotao, type RoomPanelProps } from '../RoomPanel'
import { SecretCheckSection } from '../SecretCheckSection'
import { TableScreenSection } from '../TableScreenSection'
import { TRAVEL_LOG_TITLE, TravelLogSection } from '../TravelLogSection'
import { Acoes, Botao } from '../grimorio/Botao'
import { Ficha, Fichas } from '../grimorio/Ficha'
import { TituloDaPagina } from './FolhaDoLivro'
import { IconeDoLivro } from './icones'

export type PaginaMesaProps = Pick<RoomPanelProps, 'room' | 'players' | 'secretCheck' | 'visaoDeJogador' | 'noise' | 'table' | 'travelLog'> & {
  /** "Livro de regras" (`BotaoDoLivroDeRegras`): some quando o sistema não tem livro. */
  livroDeRegras?: ReactNode
}

/** O que fica no lugar da ferramenta que só existe com a sala aberta. */
const SO_COM_A_SALA = 'Abre junto com a sala.'

const contar = (n: number, um: string, varios: string): string => (n === 1 ? `1 ${um}` : `${n} ${varios}`)

/**
 * PÁGINA MESA do livro da mesa (fatia 4 do design consolidado): as
 * ferramentas da sessão, cada uma numa ficha recolhível com o resumo à vista
 * (Teste secreto, Visão de jogador, Som da mesa, Ruído, Tela da mesa, Diário
 * de viagens) e o Livro de regras no pé. As fichas são as mesmas nos dois
 * estados da sala; o que só funciona com ela aberta diz isso no lugar.
 */
export function PaginaMesa({ room, players, secretCheck, visaoDeJogador, noise, table, travelLog, livroDeRegras }: PaginaMesaProps) {
  const percentual = useSomStore((estado) => percentualDoVolume(estado.volume))
  const mudo = useSomStore((estado) => estado.mudo)
  const salaAberta = room !== null
  const comJogadores = salaAberta && players.length > 0 && secretCheck !== undefined
  return (
    <>
      <TituloDaPagina titulo="Mesa" sub="Ferramentas da sessão" />
      <div className="lb-zona lb-mesa">
        <Fichas>
          {/* O teste é o que mais se usa na mesa: a única ficha que nasce aberta. */}
          <Ficha titulo="Teste secreto" icone={<IconeDoLivro nome="olhoFechado" />} abertaInicial>
            {comJogadores ? (
              <SecretCheckSection {...secretCheck} semTitulo />
            ) : (
              <>
                <p className="gr-nota">Precisa de jogadores na sala.</p>
                <Acoes>
                  <Botao tamanho="p" disabled>
                    Pedir teste
                  </Botao>
                </Acoes>
              </>
            )}
          </Ficha>
          {visaoDeJogador !== undefined && (
            <Ficha titulo="Visão de jogador" icone={<IconeDoLivro nome="olho" />} resumo={visaoDeJogador.aberta ? (visaoDeJogador.fichaAberta ?? 'Aberta') : 'Teste'}>
              <VisaoDeJogadorBotao visao={visaoDeJogador} variante="ficha" />
            </Ficha>
          )}
          <Ficha titulo={TITULO_DO_SOM} icone={<IconeDoLivro nome={mudo ? 'somMudo' : 'som'} />} resumo={mudo ? 'Mudo' : `${percentual}%`}>
            <ControleDeSom variante="ficha" />
          </Ficha>
          <Ficha titulo="Ruído" icone={<IconeDoLivro nome="ruido" />} resumo={salaAberta && noise?.armed === true ? 'Armado' : 'Desarmado'}>
            {salaAberta && noise !== undefined ? <NoiseControl {...noise} /> : <p className="gr-nota">{SO_COM_A_SALA}</p>}
          </Ficha>
          {table !== undefined && (
            <Ficha titulo="Tela da mesa" icone={<IconeDoLivro nome="monitor" />} resumo={salaAberta ? contar(table.screens, 'tela', 'telas') : undefined}>
              {salaAberta ? <TableScreenSection {...table} semTitulo /> : <p className="gr-nota">{SO_COM_A_SALA}</p>}
            </Ficha>
          )}
          {/* Mapa solto não tem para onde viajar: o diário só existe com aventura aberta. */}
          {travelLog !== undefined && (
            <Ficha titulo={TRAVEL_LOG_TITLE} icone={<IconeDoLivro nome="caderno" />} resumo={salaAberta ? contar(travelLog.entries.length, 'viagem', 'viagens') : undefined}>
              {salaAberta ? <TravelLogSection {...travelLog} semTitulo /> : <p className="gr-nota">{SO_COM_A_SALA}</p>}
            </Ficha>
          )}
        </Fichas>
        {livroDeRegras !== undefined && <div className="lb-mesa__pe">{livroDeRegras}</div>}
      </div>
    </>
  )
}
