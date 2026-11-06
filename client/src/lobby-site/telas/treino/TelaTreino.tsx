import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { Personagem } from '../../../lib/personagem'
import { enderecoDaRota, type Rota } from '../../dados/rotas'
import type { EstadoDaCampanha } from '../../dados/sessaoDaCampanha'
import { aoClicarNoLink, SISTEMA_DO_LOBBY, useDoSite, useSite } from '../contexto'
import { AvisoDaPagina } from '../Estados'
import { Icone } from '../Icone'
import { CemLutas } from './CemLutas'
import { comVidaCheia, type MontagemDaLuta } from './lutaDeTreino'
import { LutaTurnoATurno } from './LutaTurnoATurno'
import { comRascunho, lerRascunho, rascunhoMuda } from './rascunhoDeTreino'
import { EscolhaDeFichas, TelaDuelo } from './TelaDuelo'
import { TestarBuild } from './TestarBuild'
import './treino.css'

/**
 * O TREINO E O DUELO no site (fatia T7, plano do Lobby §8.2). Treino: a
 * pessoa monta a luta (as fichas dela contra um inimigo que o mestre liberou,
 * 1 a 3 cópias dele) e escolhe o modo: a luta turno a turno, as 100 lutas ou
 * testar build. Duelo: contra um colega, turno a turno. Nada daqui muda ficha
 * nenhuma: o treino luta com cópias e o rascunho mora só no navegador.
 */

type RotaDoTreino = Extract<Rota, { tela: 'treino' }>
type Modo = 'luta' | 'cem' | 'build'

const MODOS: readonly { id: Modo; nome: string }[] = [
  { id: 'luta', nome: 'Luta turno a turno' },
  { id: 'cem', nome: '100 lutas' },
  { id: 'build', nome: 'Testar build' },
]
/** Quantas cópias do inimigo dá para pôr (a "dificuldade" do treino). */
const QUANTOS: readonly number[] = [1, 2, 3]

function Montagem({ campanha, campanhaId, demo, modo, setModo, versaoDosRascunhos, mudouRascunho }: { campanha: EstadoDaCampanha; campanhaId: string; demo: boolean; modo: Modo; setModo(modo: Modo): void; versaoDosRascunhos: number; mudouRascunho(): void }) {
  const minhas = campanha.fichas.filter((ficha) => ficha.ehMinha && ficha.visivel === 'mesa')
  const inimigos = campanha.fichas.filter((ficha) => ficha.visivel === 'treino')
  const [escolhidas, setEscolhidas] = useState<string[]>(minhas[0] === undefined ? [] : [minhas[0].doc.id])
  const [inimigoId, setInimigoId] = useState<string | null>(inimigos[0]?.doc.id ?? null)
  const [quantos, setQuantos] = useState(1)
  const [vidaCheia, setVidaCheia] = useState(true)
  const [usarRascunho, setUsarRascunho] = useState(false)
  const listaDeModos = useRef<HTMLDivElement>(null)

  const docsEscolhidos = minhas.filter((ficha) => escolhidas.includes(ficha.doc.id)).map((ficha) => ficha.doc)
  const inimigo = inimigos.find((ficha) => ficha.doc.id === inimigoId)?.doc ?? null
  // `versaoDosRascunhos` muda quando o Testar build guarda: o "usar o rascunho" relê o que está no navegador.
  const rascunhos = useMemo(
    () => new Map(docsEscolhidos.map((doc) => [doc.id, lerRascunho(campanhaId, doc.id, demo)])),
    // Relê só quando a escolha ou um rascunho muda (a lista de docs é nova a cada render).
    [campanhaId, demo, escolhidas.join(','), versaoDosRascunhos],
  )
  const temRascunho = [...rascunhos.values()].some((rascunho) => rascunhoMuda(rascunho))
  const preparar = (doc: Personagem): Personagem => (vidaCheia ? comVidaCheia(doc, SISTEMA_DO_LOBBY) : doc)
  const inimigosDaLuta = inimigo === null ? [] : Array.from({ length: quantos }, () => preparar(inimigo))
  const montagem: MontagemDaLuta = {
    minhas: docsEscolhidos.map((doc) => preparar(usarRascunho ? comRascunho(doc, rascunhos.get(doc.id) ?? null) : doc)),
    inimigos: inimigosDaLuta,
  }
  /** O Testar build: a ficha do editor no lugar dela (com ou sem o rascunho), as outras escolhidas como estão. */
  const montagemDoBuild = (minha: Personagem): MontagemDaLuta => ({
    minhas: [minha, ...docsEscolhidos.filter((doc) => doc.id !== minha.id)].map(preparar),
    inimigos: inimigosDaLuta,
  })
  const nomeDoInimigo = inimigo === null ? 'O inimigo' : quantos > 1 ? `${inimigo.nome} e companhia` : inimigo.nome

  function teclaNosModos(evento: KeyboardEvent<HTMLDivElement>) {
    const atual = MODOS.findIndex((candidato) => candidato.id === modo)
    const destino =
      evento.key === 'ArrowRight' ? (atual + 1) % MODOS.length : evento.key === 'ArrowLeft' ? (atual - 1 + MODOS.length) % MODOS.length : evento.key === 'Home' ? 0 : evento.key === 'End' ? MODOS.length - 1 : null
    if (destino === null) return
    evento.preventDefault()
    setModo(MODOS[destino].id)
    requestAnimationFrame(() => listaDeModos.current?.querySelector<HTMLElement>(`#modo-treino-${MODOS[destino].id}`)?.focus())
  }

  return (
    <div className="lo-tr-corpo">
      <aside className="lo-tr-montagem lo-folha" aria-label="Quem luta">
        <div className="lo-tr-montagem__parte">
          <h2 className="lo-tr-bloco__titulo">Seu lado</h2>
          {minhas.length === 0 ? (
            <p className="lo-motivo">Você ainda não tem personagem nesta mesa. Quando o mestre ligar um a você, ele aparece aqui.</p>
          ) : (
            <EscolhaDeFichas fichas={minhas.map((ficha) => ({ id: ficha.doc.id, nome: ficha.doc.nome }))} escolhidas={escolhidas} aoMudar={setEscolhidas} rotulo="Seus personagens na luta" />
          )}
        </div>
        <div className="lo-tr-montagem__parte">
          <h2 className="lo-tr-bloco__titulo">Inimigo</h2>
          {inimigos.length === 0 ? (
            <p className="lo-motivo">O mestre ainda não liberou nenhum inimigo para o treino. Quando ele liberar um NPC no app, ele aparece aqui.</p>
          ) : (
            <fieldset className="lo-tr-grupo">
              <legend className="lo-sr">Contra quem</legend>
              {inimigos.map((ficha) => (
                <label key={ficha.doc.id} className="lo-tr-opcao">
                  <input type="radio" name="inimigo-do-treino" checked={inimigoId === ficha.doc.id} onChange={() => setInimigoId(ficha.doc.id)} />
                  <span className="lo-tr-opcao__nome">{ficha.doc.nome}</span>
                  {ficha.doc.descricao !== undefined && ficha.doc.descricao !== '' && <span className="lo-tr-opcao__valor">{ficha.doc.descricao}</span>}
                </label>
              ))}
            </fieldset>
          )}
        </div>
        <div className="lo-tr-montagem__parte">
          <h2 className="lo-tr-bloco__titulo" id="quantos-inimigos">
            Quantos
          </h2>
          <div className="lo-tr-quantos" role="radiogroup" aria-labelledby="quantos-inimigos">
            {QUANTOS.map((n) => (
              <button key={n} type="button" role="radio" aria-checked={quantos === n} className="lo-tr-ficha" onClick={() => setQuantos(n)}>
                {n === 1 ? '1 inimigo' : `${n} inimigos`}
              </button>
            ))}
          </div>
        </div>
        <div className="lo-tr-montagem__parte lo-tr-montagem__chaves">
          <label className="lo-tr-chave">
            <input type="checkbox" checked={vidaCheia} onChange={(evento) => setVidaCheia(evento.target.checked)} />
            <span>Começar com Vida e Energia cheias</span>
          </label>
          <label className="lo-tr-chave">
            <input type="checkbox" checked={usarRascunho && temRascunho} disabled={!temRascunho} onChange={(evento) => setUsarRascunho(evento.target.checked)} />
            <span>Lutar com o rascunho de treino{temRascunho ? '' : ' (nenhum ainda)'}</span>
          </label>
        </div>
      </aside>

      <div className="lo-folha lo-tr-modos">
        <div className="lo-abas" role="tablist" aria-label="Modos do treino" ref={listaDeModos} onKeyDown={teclaNosModos}>
          {MODOS.map((candidato) => (
            <button
              key={candidato.id}
              type="button"
              role="tab"
              id={`modo-treino-${candidato.id}`}
              className="lo-aba"
              aria-selected={modo === candidato.id}
              aria-controls={`painel-treino-${candidato.id}`}
              tabIndex={modo === candidato.id ? 0 : -1}
              onClick={() => setModo(candidato.id)}
            >
              {candidato.nome}
            </button>
          ))}
        </div>
        {/* Os três ficam montados (só escondidos): trocar de aba não perde a luta do meio, a série rodando nem a comparação. */}
        <div className="lo-painel" role="tabpanel" id="painel-treino-luta" aria-labelledby="modo-treino-luta" hidden={modo !== 'luta'}>
          <LutaTurnoATurno montagem={montagem} nomeDoInimigo={nomeDoInimigo} />
        </div>
        <div className="lo-painel" role="tabpanel" id="painel-treino-cem" aria-labelledby="modo-treino-cem" hidden={modo !== 'cem'}>
          <CemLutas montagem={montagem} />
        </div>
        <div className="lo-painel" role="tabpanel" id="painel-treino-build" aria-labelledby="modo-treino-build" hidden={modo !== 'build'}>
          <TestarBuild
            campanhaId={campanhaId}
            demo={demo}
            fichas={minhas.map((ficha) => ficha.doc)}
            fichaInicial={escolhidas[0] ?? null}
            montagem={montagemDoBuild}
            aoMudarRascunho={mudouRascunho}
          />
        </div>
      </div>
    </div>
  )
}

export function TelaTreino({ rota }: { rota: RotaDoTreino }) {
  const site = useSite()
  const demo = useDoSite((estado) => estado.demo)
  const campanha = useDoSite((estado) => estado.campanha)
  const duelo = useDoSite((estado) => estado.duelo)
  const erroDaCampanha = useDoSite((estado) => estado.erroDaCampanha)
  const nomeDaMesa = useDoSite((estado) =>
    estado.eu.t === 'pronto' ? (estado.eu.eu.campanhas.find((linha) => linha.campanhaId === rota.campanhaId)?.nomeDaCampanha ?? 'Mesa') : 'Mesa',
  )
  const [modo, setModo] = useState<Modo>('luta')
  const [versaoDosRascunhos, setVersaoDosRascunhos] = useState(0)
  const daMesa: Rota = { tela: 'campanha', campanhaId: rota.campanhaId }
  const ehDuelo = rota.parte === 'duelo'

  if (erroDaCampanha !== null) {
    return (
      <AvisoDaPagina titulo="Não deu para abrir esta mesa neste navegador">
        <p>{erroDaCampanha}</p>
      </AvisoDaPagina>
    )
  }

  if (campanha === null || duelo === null || !campanha.carregada) {
    return (
      <div className="lo-pagina lo-pagina--treino">
        <p className="lo-carregando" role="status">
          <span className="lo-giro" aria-hidden="true" />
          Abrindo a mesa…
        </p>
      </div>
    )
  }

  const outra: Rota = { tela: 'treino', campanhaId: rota.campanhaId, parte: ehDuelo ? 'lutas' : 'duelo' }
  return (
    <div className="lo-pagina lo-pagina--treino">
      <header className="lo-cab-pag">
        <div className="lo-cab-pag__texto">
          <a className="lo-voltar" href={enderecoDaRota(daMesa, demo)} onClick={aoClicarNoLink(site, daMesa)}>
            <Icone nome="voltar" /> {nomeDaMesa}
          </a>
          <h1 className="lo-titulo">{ehDuelo ? 'Duelo' : 'Treino'}</h1>
          <p className="lo-sub">
            {ehDuelo
              ? 'Desafie um colega da mesa. Turno a turno e sem relógio: cada um joga quando puder.'
              : 'Lute contra os inimigos que o mestre liberou. Nada aqui muda a sua ficha.'}
          </p>
        </div>
        <a className="lo-btn" href={enderecoDaRota(outra, demo)} onClick={aoClicarNoLink(site, outra)}>
          <Icone nome={ehDuelo ? 'treino' : 'duelo'} /> {ehDuelo ? 'Ir ao treino' : 'Ir ao duelo'}
        </a>
      </header>
      {ehDuelo ? (
        <div className="lo-folha lo-tr-folha-duelo">
          <div className="lo-painel">
            <TelaDuelo campanha={campanha} duelo={duelo} />
          </div>
        </div>
      ) : (
        <Montagem
          campanha={campanha}
          campanhaId={rota.campanhaId}
          demo={demo}
          modo={modo}
          setModo={setModo}
          versaoDosRascunhos={versaoDosRascunhos}
          mudouRascunho={() => setVersaoDosRascunhos((versao) => versao + 1)}
        />
      )}
    </div>
  )
}
