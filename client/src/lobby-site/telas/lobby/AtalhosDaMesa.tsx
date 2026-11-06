import { useId, useState, type ReactNode } from 'react'
import { enderecoDaRota, type Rota } from '../../dados/rotas'
import type { EstadoDaCampanha, FichaDoSite } from '../../dados/sessaoDaCampanha'
import { aoClicarNoLink, useDoSite, useSite } from '../contexto'
import { Icone, type NomeDoIcone } from '../Icone'
import { Medidores, Retrato } from '../TelaCampanha'
import { plural } from '../textos'
import { MOTIVO_DO_TREINO, TREINO_NO_SITE } from './treinoNoSite'

/**
 * OS ATALHOS GRANDES do lobby (H1): a ficha do jogador (o maior, com retrato
 * e barras), a mochila dela, o treino e o duelo. Com mais de um personagem,
 * a pessoa escolhe de qual são os atalhos. O mestre não tem "minha ficha":
 * no lugar, as fichas da mesa e o mural, onde ele escreve. O que ainda não
 * existe no site aparece parado, com o motivo, nunca como link vazio.
 */

/** Quantos rostos o cartão "Fichas da mesa" do mestre mostra antes de virar número. */
const ROSTOS_NO_CARTAO = 5

const SEM_PERSONAGEM = 'Você não tem personagem nesta mesa. Peça ao mestre para ligar uma ficha à sua conta.'

export function AtalhosDaMesa({ campanha }: { campanha: EstadoDaCampanha }) {
  const tituloId = useId()
  const escolhaId = useId()
  const [escolhida, setEscolhida] = useState<string | null>(null)
  const ehMestre = campanha.eu?.papel === 'mestre'
  const minhas = campanha.fichas.filter((ficha) => ficha.ehMinha)
  const ficha = minhas.find((candidata) => candidata.doc.id === escolhida) ?? minhas.at(0)
  const campanhaId = campanha.campanhaId

  return (
    <section className="lo-saguao__atalhos" aria-labelledby={tituloId}>
      <div className="lo-saguao__atalhos-cab">
        <h2 className="lo-sr" id={tituloId}>
          Atalhos
        </h2>
        {!ehMestre && ficha !== undefined && minhas.length > 1 && (
          <div className="lo-saguao__escolha">
            <label htmlFor={escolhaId}>Atalhos de</label>
            <select id={escolhaId} className="lo-escolha" value={ficha.doc.id} onChange={(evento) => setEscolhida(evento.target.value)}>
              {minhas.map((candidata) => (
                <option key={candidata.doc.id} value={candidata.doc.id}>
                  {candidata.doc.nome}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <ul className="lo-atalhos">
        {ehMestre ? (
          <>
            <li className="lo-atalhos__maior">
              <CartaoDasFichas campanha={campanha} />
            </li>
            <li>
              <Atalho
                alvo={{ tela: 'mural', campanhaId, aba: 'noticias' }}
                icone="mural"
                nome="Escrever no mural"
                detalhe="Notícias e avisos para a mesa inteira. Fixe o que ninguém pode perder."
              />
            </li>
          </>
        ) : ficha === undefined ? (
          <>
            <li className="lo-atalhos__maior">
              <Parado icone="ficha" nome="Minha ficha" detalhe="A sua ficha, para ver e mudar." motivo={SEM_PERSONAGEM} />
            </li>
            <li>
              <Parado icone="mochila" nome="Mochila" detalhe="Os itens e as moedas do seu personagem." motivo="Sem personagem, sem mochila." />
            </li>
          </>
        ) : (
          <>
            <li className="lo-atalhos__maior">
              <CartaoDaFicha campanhaId={campanhaId} ficha={ficha} />
            </li>
            <li>
              <Atalho
                alvo={{ tela: 'ficha', campanhaId, fichaId: ficha.doc.id, aba: 'mochila' }}
                icone="mochila"
                nome="Mochila"
                detalhe={`${plural(ficha.doc.mochila?.length ?? 0, 'item', 'itens')} e ${plural(ficha.doc.moedas ?? 0, 'moeda', 'moedas')}.`}
                rotulo={`Mochila de ${ficha.doc.nome}`}
              />
            </li>
          </>
        )}
        <li>
          {TREINO_NO_SITE ? (
            <Atalho alvo={{ tela: 'treino', campanhaId, parte: 'lutas' }} icone="treino" nome="Treino" detalhe="Lute contra os inimigos que o mestre liberou, sem mexer na sua ficha." />
          ) : (
            <Parado icone="treino" nome="Treino" detalhe="Lute contra os inimigos que o mestre liberou, sem mexer na sua ficha." motivo={MOTIVO_DO_TREINO} />
          )}
        </li>
        <li>
          {TREINO_NO_SITE ? (
            <Atalho alvo={{ tela: 'treino', campanhaId, parte: 'duelo' }} icone="duelo" nome="Duelo" detalhe="Desafie um colega da mesa, turno a turno." />
          ) : (
            <Parado icone="duelo" nome="Duelo" detalhe="Desafie um colega da mesa, turno a turno." motivo={MOTIVO_DO_TREINO} />
          )}
        </li>
      </ul>
    </section>
  )
}

function Link({ alvo, className, rotulo, children }: { alvo: Rota; className: string; rotulo?: string; children: ReactNode }) {
  const site = useSite()
  const demo = useDoSite((estado) => estado.demo)
  return (
    <a className={className} href={enderecoDaRota(alvo, demo)} onClick={aoClicarNoLink(site, alvo)} aria-label={rotulo}>
      {children}
    </a>
  )
}

function Atalho({ alvo, icone, nome, detalhe, rotulo }: { alvo: Rota; icone: NomeDoIcone; nome: string; detalhe: string; rotulo?: string }) {
  return (
    <Link alvo={alvo} className="lo-atalho" rotulo={rotulo}>
      <span className="lo-atalho__sinal" aria-hidden="true">
        <Icone nome={icone} />
      </span>
      <span className="lo-atalho__nome">{nome}</span>
      <span className="lo-atalho__detalhe">{detalhe}</span>
      <span className="lo-atalho__ir" aria-hidden="true">
        <Icone nome="ir" />
      </span>
    </Link>
  )
}

/** Um atalho que ainda não leva a nada: à vista, parado, com o motivo escrito (não é foco de teclado). */
function Parado({ icone, nome, detalhe, motivo }: { icone: NomeDoIcone; nome: string; detalhe: string; motivo: string }) {
  return (
    <div className="lo-atalho" aria-disabled="true">
      <span className="lo-atalho__sinal" aria-hidden="true">
        <Icone nome={icone} />
      </span>
      <span className="lo-atalho__nome">
        {nome} <span className="lo-tag">Em breve</span>
      </span>
      <span className="lo-atalho__detalhe">{detalhe}</span>
      <span className="lo-atalho__motivo">{motivo}</span>
    </div>
  )
}

function CartaoDaFicha({ campanhaId, ficha }: { campanhaId: string; ficha: FichaDoSite }) {
  return (
    <Link alvo={{ tela: 'ficha', campanhaId, fichaId: ficha.doc.id, aba: 'ficha' }} className="lo-atalho lo-atalho--ficha" rotulo={`Minha ficha: ${ficha.doc.nome}`}>
      <Retrato doc={ficha.doc} grande />
      <span className="lo-atalho__corpo">
        <span className="lo-atalho__rotulo">
          <Icone nome="ficha" /> Minha ficha
        </span>
        <span className="lo-atalho__titulo">{ficha.doc.nome}</span>
        <Medidores doc={ficha.doc} />
      </span>
    </Link>
  )
}

function CartaoDasFichas({ campanha }: { campanha: EstadoDaCampanha }) {
  const jogadores = campanha.fichas.filter((ficha) => ficha.doc.tipo === 'jogador').length
  const rostos = campanha.fichas.slice(0, ROSTOS_NO_CARTAO)
  const resto = campanha.fichas.length - rostos.length
  return (
    <Link alvo={{ tela: 'fichas', campanhaId: campanha.campanhaId }} className="lo-atalho lo-atalho--ficha">
      <span className="lo-atalho__corpo">
        <span className="lo-atalho__rotulo">
          <Icone nome="ficha" /> Fichas da mesa
        </span>
        <span className="lo-atalho__titulo">{plural(campanha.fichas.length, 'ficha', 'fichas')}</span>
        <span className="lo-atalho__detalhe">
          {plural(jogadores, 'personagem de jogador', 'personagens de jogadores')}. Você é o mestre: vê e muda todas daqui.
        </span>
        <span className="lo-grupo" aria-hidden="true">
          {rostos.map((ficha) => (
            <Retrato key={ficha.doc.id} doc={ficha.doc} />
          ))}
          {resto > 0 && <span className="lo-retrato">+{resto}</span>}
        </span>
      </span>
    </Link>
  )
}
