import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { Personagem } from '../../../lib/personagem'
import { enderecoDaRota, type Rota } from '../../dados/rotas'
import type { EstadoDaCampanha } from '../../dados/sessaoDaCampanha'
import { aoClicarNoLink, sistemaDaCampanha, useDoSite, useSite } from '../contexto'
import { AvisoDaPagina } from '../Estados'
import { Icone } from '../Icone'
import { CemLutas } from './CemLutas'
import { ImagemDoSite } from './grade/ImagemDoSite'
import { AjustesDoJuiz } from './juiz/AjustesDoJuiz'
import { apagarAjustesDoJuiz, ajustesPadraoDoJuiz, fichaDoJuiz, guardarAjustesDoJuiz, ID_DO_JUIZ, juizMudou, juizNaoReage, lerAjustesDoJuiz, NOME_DO_JUIZ, RETRATO_DO_JUIZ, type AjustesDoJuiz as Ajustes } from './juiz/juizDoTreino'
import { comVidaCheia, type MontagemDaLuta } from './lutaDeTreino'
import { LutaTurnoATurno } from './LutaTurnoATurno'
import { MontagemNaGrade } from './montagem/MontagemNaGrade'
import { lutaDaMontagem, montagemInicial, soAsQueExistem, type PecaDaMontagem, type PecaNaGrade } from './montagem/regrasDaMontagem'
import { comRascunho, lerRascunho, rascunhoMuda } from './rascunhoDeTreino'
import { TelaDuelo } from './TelaDuelo'
import { TestarBuild } from './TestarBuild'
import './treino.css'

/**
 * O TREINO E O DUELO no site (fatia T7, plano do Lobby §8.2). Treino: a
 * pessoa monta a luta na grade (fatia J: puxa da lista "Personagens" para a
 * grade da Arena, e a metade onde solta decide o lado; o adversário padrão é o
 * Judge, o boneco de teste da Arena, ao lado dos inimigos que o mestre
 * liberou) e escolhe o modo: a luta turno a turno, as 100 lutas, testar build
 * ou ajustar o Judge. Duelo: contra um colega, turno a turno. Nada daqui muda
 * ficha nenhuma: o treino luta com cópias, e o rascunho e o Judge moram só no
 * navegador.
 */

type RotaDoTreino = Extract<Rota, { tela: 'treino' }>
type Modo = 'luta' | 'cem' | 'build' | 'juiz'

const MODOS: readonly { id: Modo; nome: string }[] = [
  { id: 'luta', nome: 'Luta turno a turno' },
  { id: 'cem', nome: '100 lutas' },
  { id: 'build', nome: 'Testar build' },
  { id: 'juiz', nome: `Ajustar o ${NOME_DO_JUIZ}` },
]

/** "Judge", "Judge e companhia": contra quem, para a barra e o fim da luta. */
function nomeDoLadoB(inimigos: readonly Personagem[]): string {
  const primeiro = inimigos[0]
  if (primeiro === undefined) return 'O inimigo'
  return inimigos.length > 1 ? `${primeiro.nome} e companhia` : primeiro.nome
}

function Montagem({ campanha, campanhaId, demo, modo, setModo, versaoDosRascunhos, mudouRascunho }: { campanha: EstadoDaCampanha; campanhaId: string; demo: boolean; modo: Modo; setModo(modo: Modo): void; versaoDosRascunhos: number; mudouRascunho(): void }) {
  const minhas = campanha.fichas.filter((ficha) => ficha.ehMinha && ficha.visivel === 'mesa')
  // Os personagens dos colegas entram como cópia só para o treino (a ficha deles nunca muda).
  const colegas = campanha.fichas.filter((ficha) => !ficha.ehMinha && ficha.visivel === 'mesa' && ficha.nomeDoDono !== null)
  const inimigos = campanha.fichas.filter((ficha) => ficha.visivel === 'treino')
  const sistema = sistemaDaCampanha(campanha)
  const [vidaCheia, setVidaCheia] = useState(true)
  const [usarRascunho, setUsarRascunho] = useState(false)
  const [juiz, setJuiz] = useState<Ajustes>(() => lerAjustesDoJuiz(campanhaId, demo, sistema))
  const [juizGuardado, setJuizGuardado] = useState<boolean | null>(null)
  const listaDeModos = useRef<HTMLDivElement>(null)

  // `versaoDosRascunhos` muda quando o Testar build guarda: o "usar o rascunho" relê o que está no navegador.
  const idsDasMinhas = minhas.map((ficha) => ficha.doc.id).join(',')
  const rascunhos = useMemo(
    () => new Map(minhas.map((ficha) => [ficha.doc.id, lerRascunho(campanhaId, ficha.doc.id, demo)])),
    // Relê só quando as fichas ou um rascunho mudam (a lista é nova a cada render).
    [campanhaId, demo, idsDasMinhas, versaoDosRascunhos],
  )
  const temRascunho = [...rascunhos.values()].some((rascunho) => rascunhoMuda(rascunho))
  const comORascunho = usarRascunho && temRascunho

  const pecas: PecaDaMontagem[] = [
    ...minhas.map((ficha): PecaDaMontagem => ({
      id: ficha.doc.id,
      nome: ficha.doc.nome,
      retrato: ficha.doc.retrato,
      selo: ficha.doc.tipo === 'npc' ? 'npc' : 'jogador',
      origem: 'minha',
      detalhe: comORascunho && rascunhoMuda(rascunhos.get(ficha.doc.id) ?? null) ? 'seu, com o rascunho de treino' : 'seu personagem',
    })),
    ...colegas.map((ficha): PecaDaMontagem => ({ id: ficha.doc.id, nome: ficha.doc.nome, retrato: ficha.doc.retrato, selo: ficha.doc.tipo === 'npc' ? 'npc' : 'jogador', origem: 'colega', detalhe: `de ${ficha.nomeDoDono ?? 'um colega'}, cópia de treino` })),
    { id: ID_DO_JUIZ, nome: NOME_DO_JUIZ, retrato: RETRATO_DO_JUIZ, selo: 'npc', origem: 'juiz', detalhe: juizMudou(juiz) ? 'boneco de teste, ajustado por você' : 'boneco de teste da Arena' },
    ...inimigos.map((ficha): PecaDaMontagem => ({ id: ficha.doc.id, nome: ficha.doc.nome, retrato: ficha.doc.retrato, selo: 'npc', origem: 'inimigo', detalhe: 'liberado pelo mestre' })),
  ]
  const [guardada, setGuardada] = useState<PecaNaGrade[]>(() => montagemInicial(pecas))
  // O mestre tirou um inimigo do treino (ou a ficha saiu da mesa): a peça dele some da grade.
  const lista = soAsQueExistem(guardada, pecas)

  const preparar = (doc: Personagem): Personagem => (vidaCheia ? comVidaCheia(doc, sistema) : doc)
  const docDaPeca = (pecaId: string): Personagem | null => {
    if (pecaId === ID_DO_JUIZ) return fichaDoJuiz(sistema, juiz)
    const minha = minhas.find((ficha) => ficha.doc.id === pecaId)
    if (minha !== undefined) return comORascunho ? comRascunho(minha.doc, rascunhos.get(pecaId) ?? null) : minha.doc
    return [...colegas, ...inimigos].find((ficha) => ficha.doc.id === pecaId)?.doc ?? null
  }
  // O Judge com "Fica parado" não reage em nenhum modo: na luta turno a turno, nas 100 lutas e no Testar build.
  const naoReagem = juizNaoReage(juiz)
  const montagem: MontagemDaLuta = {
    ...lutaDaMontagem(lista, (pecaId) => {
      const doc = docDaPeca(pecaId)
      return doc === null ? null : preparar(doc)
    }),
    naoReagem,
  }
  /** O Testar build: a ficha do editor no lugar dela no Lado A (com ou sem o rascunho), o resto da grade como está. */
  const montagemDoBuild = (minha: Personagem): MontagemDaLuta => ({
    minhas: [preparar(minha), ...montagem.minhas.filter((doc) => doc.id !== minha.id)],
    inimigos: montagem.inimigos,
    naoReagem,
  })
  const nomeDoInimigo = nomeDoLadoB(montagem.inimigos)

  function mudarJuiz(novo: Ajustes) {
    setJuiz(novo)
    setJuizGuardado(guardarAjustesDoJuiz(campanhaId, demo, novo))
  }
  function juizPadrao() {
    apagarAjustesDoJuiz(campanhaId, demo)
    setJuiz(ajustesPadraoDoJuiz())
    setJuizGuardado(null)
  }
  function irParaOJuiz() {
    setModo('juiz')
    requestAnimationFrame(() => listaDeModos.current?.querySelector<HTMLElement>('#modo-treino-juiz')?.focus())
  }

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
    <div className="lo-tr-pilha">
      <section className="lo-folha lo-tr-montagem-grade" aria-label="Quem luta">
        <MontagemNaGrade pecas={pecas} lista={lista} onMudar={setGuardada} demo={demo} onAjustarJuiz={irParaOJuiz} />
        <div className="lo-tr-montagem-grade__pe">
          <label className="lo-tr-chave">
            <input type="checkbox" checked={vidaCheia} onChange={(evento) => setVidaCheia(evento.target.checked)} />
            <span>Começar com Vida e Energia cheias</span>
          </label>
          <label className="lo-tr-chave">
            <input type="checkbox" checked={comORascunho} disabled={!temRascunho} onChange={(evento) => setUsarRascunho(evento.target.checked)} />
            <span>Lutar com o rascunho de treino{temRascunho ? '' : ' (nenhum ainda)'}</span>
          </label>
          {minhas.length === 0 && <p className="lo-motivo">Você ainda não tem personagem nesta mesa: dá para treinar com o {NOME_DO_JUIZ} e as cópias dos colegas.</p>}
          {inimigos.length === 0 && <p className="lo-motivo">O mestre ainda não liberou inimigo para o treino: o {NOME_DO_JUIZ} fica de adversário.</p>}
        </div>
      </section>

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
        {/* Os quatro ficam montados (só escondidos): trocar de aba não perde a luta do meio, a série rodando nem a comparação. */}
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
            fichaInicial={lista.map((peca) => peca.pecaId).find((pecaId) => minhas.some((ficha) => ficha.doc.id === pecaId)) ?? null}
            montagem={montagemDoBuild}
            aoMudarRascunho={mudouRascunho}
          />
        </div>
        <div className="lo-painel" role="tabpanel" id="painel-treino-juiz" aria-labelledby="modo-treino-juiz" hidden={modo !== 'juiz'}>
          <AjustesDoJuiz ajustes={juiz} sistema={sistema} onMudar={mudarJuiz} onVoltarAoPadrao={juizPadrao} guardado={juizGuardado} />
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
  const pagina = (
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
              : 'Monte a luta na grade: contra o Judge, os inimigos que o mestre liberou ou cópias da mesa. Nada aqui muda a sua ficha.'}
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
  // O retrato das fichas vem da rota de mídia da mesa (na demo, os rostos inventados): a grade e a mira pedem por aqui.
  return (
    <ImagemDoSite campanhaId={rota.campanhaId} demo={demo}>
      {pagina}
    </ImagemDoSite>
  )
}
