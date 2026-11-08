import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { Personagem } from '../../../lib/personagem'
import { LUTAS_DA_SERIE, type ComparacaoDeBuild } from '../../../lib/treino/cemLutas'
import { compararBuildNoWorker, type LutasNoWorker } from '../../../lib/treino/lutasNoWorker'
import { NOME_DO_JUIZ } from '../../../lib/treino/juiz'
import { sementeNova } from '../../../lib/treino/sorteio'
import { useSistemaDoLobby } from '../contexto'
import { assentarAnimacao } from './ArenaDaLuta'
import { diferencaDoRascunho, rascunhoDaBuild, type BuildSalva } from './buildsSalvas'
import { AvisoDeMontagemVelha, BarraDasLutas, NumerosDaSerie, type Progresso } from './CemLutas'
import { EditorDeTecnicas } from './juiz/CamposDoTreino'
import { ListaDeBuilds, type AcaoDaBuild, type BuildsDaMesa } from './juiz/ListaDeBuilds'
import { assinaturaDaMontagem, lutadoresDaMontagem, problemaDaMontagem, quemLutou, type MontagemDaLuta } from './lutaDeTreino'
import { apagarRascunho, comRascunho, guardarRascunho, lerRascunho, NUMERO_DO_RASCUNHO_MAX, rascunhoMuda, rascunhoVazio, type RascunhoDeTreino } from './rascunhoDeTreino'

/**
 * TESTAR BUILD (fatia T7; achado Tr6): a pessoa muda atributos e máximos numa
 * cópia da ficha, o "rascunho de treino", guardado neste navegador por mesa e
 * por ficha (recarregar não perde), e compara antes x depois: as mesmas 100
 * sementes com a ficha de agora e com o rascunho, no worker da T4. O rascunho
 * nunca vai ao servidor e nunca muda a ficha de verdade.
 */

interface PropsDoBuild {
  campanhaId: string
  demo: boolean
  /** As minhas fichas na mesa, como estão (sem rascunho). */
  fichas: readonly Personagem[]
  /** A ficha que abre no editor (a primeira escolhida na montagem). */
  fichaInicial: string | null
  /** Os inimigos e as outras fichas do meu lado; `prepararMinha` põe a Vida cheia, se marcada. */
  montagem: (minhaNoLado: Personagem) => MontagemDaLuta
  aoMudarRascunho(): void
  /** As builds salvas desta conta (as mesmas do Judge): o rascunho vira build, e a build volta ao rascunho. */
  builds: BuildsDaMesa
}

function horaCurta(ms: number): string {
  return new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function CampoDoRascunho({ nome, naFicha, valor, aoMudar }: { nome: string; naFicha: number; valor: number; aoMudar(valor: number): void }) {
  const id = useId()
  const [texto, setTexto] = useState(String(valor))
  // Outro rascunho (outra ficha, ou descartado): o campo mostra o valor novo.
  useEffect(() => setTexto(String(valor)), [valor])
  const numero = Number(texto)
  const invalido = texto.trim() === '' || !Number.isSafeInteger(numero) || numero < 0 || numero > NUMERO_DO_RASCUNHO_MAX
  return (
    <div className="lo-tr-campo" data-mudou={valor !== naFicha ? '1' : undefined}>
      <label htmlFor={id}>{nome}</label>
      <input
        id={id}
        className="lo-numero"
        inputMode="numeric"
        value={texto}
        aria-invalid={invalido}
        aria-describedby={`${id}-ficha`}
        onChange={(evento) => {
          setTexto(evento.target.value)
          const lido = Number(evento.target.value)
          if (evento.target.value.trim() !== '' && Number.isSafeInteger(lido) && lido >= 0 && lido <= NUMERO_DO_RASCUNHO_MAX) aoMudar(lido)
        }}
      />
      <span id={`${id}-ficha`} className="lo-tr-campo__ficha">
        {valor !== naFicha ? `na ficha: ${naFicha.toLocaleString('pt-BR')}` : 'igual à ficha'}
      </span>
    </div>
  )
}

interface ComparacaoGuardada {
  valor: ComparacaoDeBuild
  /** Antes e depois com que a comparação rodou, e quem lutou, em texto (para o aviso quando a montagem muda). */
  assinatura: string
  quem: string
}

function ResultadoDaComparacao({ comparacao, quem, velha }: { comparacao: ComparacaoDeBuild; quem: string; velha: boolean }) {
  const { diferenca } = comparacao
  return (
    <div className="lo-tr-resultado" role="status" data-velho={velha ? '1' : undefined} onAnimationEnd={assentarAnimacao}>
      {velha && <AvisoDeMontagemVelha quem={quem} oQue="Esta comparação foi" refazer="Compare de novo para ver a de agora." />}
      <p className="lo-tr-diferenca" data-tom={diferenca > 0 ? 'vitoria' : diferenca < 0 ? 'derrota' : undefined}>
        {diferenca === 0
          ? `Mesmo número de vitórias nas mesmas ${LUTAS_DA_SERIE} lutas.`
          : `${diferenca > 0 ? '+' : '−'}${Math.abs(diferenca)} ${Math.abs(diferenca) === 1 ? 'vitória' : 'vitórias'} com o rascunho, nas mesmas ${LUTAS_DA_SERIE} lutas.`}
      </p>
      <div className="lo-tr-comparacao">
        <NumerosDaSerie resultado={comparacao.atual} titulo="Ficha de agora" />
        <NumerosDaSerie resultado={comparacao.rascunho} titulo="Com o rascunho" />
      </div>
      <p className="lo-motivo">Lutas de {quem}.</p>
    </div>
  )
}

export function TestarBuild({ campanhaId, demo, fichas, fichaInicial, montagem, aoMudarRascunho, builds }: PropsDoBuild) {
  // Os campos do rascunho são os do sistema da campanha: atributos, máximos e os de um número só (o Escudo, que muda o valor).
  const sistema = useSistemaDoLobby()
  const recursosComMaximo = sistema.recursos.filter((recurso) => recurso.atualEMaximo === true)
  const recursosDeUmNumero = sistema.recursos.filter((recurso) => recurso.atualEMaximo !== true)
  const [fichaId, setFichaId] = useState<string | null>(fichaInicial ?? fichas[0]?.id ?? null)
  const doc = fichas.find((ficha) => ficha.id === fichaId) ?? fichas[0]
  const [rascunho, setRascunho] = useState<RascunhoDeTreino | null>(() => (doc === undefined ? null : lerRascunho(campanhaId, doc.id, demo)))
  const [guardado, setGuardado] = useState<boolean | null>(null)
  const [progresso, setProgresso] = useState<Progresso | null>(null)
  const [comparacao, setComparacao] = useState<ComparacaoGuardada | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const emCurso = useRef<LutasNoWorker<ComparacaoDeBuild> | null>(null)
  const idDaFicha = useId()
  // Antes e depois, como vão para o worker: muda com o rascunho e com a montagem do lado (inimigo, Quantos, Vida cheia).
  const assinatura = useMemo(
    () => (doc === undefined ? '' : `${assinaturaDaMontagem(montagem(doc))}\n${assinaturaDaMontagem(montagem(comRascunho(doc, rascunho)))}`),
    [montagem, doc, rascunho],
  )

  useEffect(() => () => emCurso.current?.cancelar(), [])

  if (doc === undefined) {
    return <p className="lo-vazio">Você não tem personagem nesta mesa para testar uma build.</p>
  }
  const atual = rascunho ?? rascunhoVazio(doc.id)

  /** Para a comparação no meio: o worker fecha e o resultado dele, se ainda chegar, é ignorado (o `.then` confere `emCurso`). */
  function pararComparacao() {
    emCurso.current?.cancelar()
    emCurso.current = null
    setProgresso(null)
  }

  // Mudar o rascunho ou a ficha no meio da comparação para a comparação: ela era de outros números.
  function trocarFicha(id: string) {
    pararComparacao()
    setFichaId(id)
    setRascunho(lerRascunho(campanhaId, id, demo))
    setGuardado(null)
    setComparacao(null)
  }

  function mudar(campo: 'atributos' | 'maximos' | 'recursos', id: string, valor: number, naFicha: number) {
    const numeros = { ...atual[campo] }
    if (valor === naFicha) delete numeros[id]
    else numeros[id] = valor
    gravar({ ...atual, [campo]: numeros, salvoEm: Date.now() })
  }

  function gravar(novo: RascunhoDeTreino) {
    if (doc === undefined) return
    pararComparacao()
    setRascunho(novo)
    setComparacao(null)
    setGuardado(guardarRascunho(campanhaId, novo, demo))
    aoMudarRascunho()
  }

  function descartar() {
    if (doc === undefined) return
    pararComparacao()
    apagarRascunho(campanhaId, doc.id, demo)
    setRascunho(null)
    setGuardado(null)
    setComparacao(null)
    aoMudarRascunho()
  }

  function comparar() {
    if (doc === undefined) return
    const antes = lutadoresDaMontagem(montagem(doc))
    const depois = lutadoresDaMontagem(montagem(comRascunho(doc, rascunho)))
    if (!antes.ok || !depois.ok) {
      setErro('Não deu para montar a luta com essas fichas.')
      return
    }
    emCurso.current?.cancelar()
    setErro(null)
    setComparacao(null)
    setProgresso({ feitas: 0, total: 2 * LUTAS_DA_SERIE })
    const daCorrida = { assinatura, quem: quemLutou(montagem(doc)) }
    const corrida = compararBuildNoWorker({ sistema, atual: antes.lutadores, rascunho: depois.lutadores, lado: 'a', semente: sementeNova() }, (feitas, total) =>
      setProgresso({ feitas, total }),
    )
    emCurso.current = corrida
    corrida.saida
      .then((saida) => {
        if (emCurso.current !== corrida) return
        emCurso.current = null
        setProgresso(null)
        if (saida.ok) setComparacao({ valor: saida.valor, ...daCorrida })
        else if (saida.motivo === 'falhou') setErro(`A comparação parou com erro: ${saida.detalhe}`)
      })
      .catch((falha: unknown) => {
        if (emCurso.current !== corrida) return
        emCurso.current = null
        setProgresso(null)
        setErro(`A comparação parou com erro: ${falha instanceof Error ? falha.message : String(falha)}`)
      })
  }

  /** O rascunho guardado da ficha da build: o da tela, se é a ficha aberta (pode não ter ido ao navegador). */
  function rascunhoDaFicha(fichaIdDaBuild: string): RascunhoDeTreino | null {
    return doc !== undefined && fichaIdDaBuild === doc.id ? rascunho : lerRascunho(campanhaId, fichaIdDaBuild, demo)
  }

  /** Abrir a build joga fora o rascunho que a ficha tem: com mudança, confirma antes (não tem desfazer). */
  function perdaAoAbrir(build: BuildSalva): string | null {
    if (!rascunhoMuda(rascunhoDaFicha(build.base.fichaId))) return null
    const alvo = fichas.find((ficha) => ficha.id === build.base.fichaId)
    const de = alvo === undefined ? 'desta ficha' : `de ${alvo.nome}`
    return `O rascunho ${de} tem mudanças: abrir a build “${build.nome}” troca por ela, e o rascunho de agora some. Salve-o como build antes, se quiser guardar.`
  }

  /** A build de uma ficha minha abre no rascunho dela (o que estava lá dá lugar à build, depois da confirmação de `perdaAoAbrir`). */
  function abrirBuild(build: BuildSalva): string {
    const alvo = fichas.find((ficha) => ficha.id === build.base.fichaId)
    if (alvo === undefined) return `A ficha da build “${build.nome}” não é sua nesta mesa.`
    pararComparacao()
    setFichaId(alvo.id)
    setComparacao(null)
    const novo = rascunhoDaBuild(build, Date.now())
    setRascunho(novo)
    setGuardado(guardarRascunho(campanhaId, novo, demo))
    aoMudarRascunho()
    return `A build “${build.nome}” está no rascunho de ${alvo.nome}.`
  }
  const acoesDasBuilds: AcaoDaBuild[] = [
    {
      rotulo: 'Abrir no rascunho',
      pode: (build) => build.base.tipo === 'minha' && fichas.some((ficha) => ficha.id === build.base.fichaId),
      perda: perdaAoAbrir,
      confirmar: 'Abrir mesmo',
      fazer: abrirBuild,
    },
    { rotulo: `Pôr no ${NOME_DO_JUIZ}`, pode: () => true, fazer: builds.porNoJuiz },
  ]

  const problema = problemaDaMontagem(montagem(doc))
  const muda = rascunhoMuda(rascunho)

  return (
    <div className="lo-tr-build">
      <div className="lo-tr-build__cab">
        <span className="lo-tag lo-tag--mare">Rascunho de treino</span>
        <p className="lo-tr-explica">Só neste navegador. Nunca muda a sua ficha nem vai para o mestre.</p>
      </div>

      {fichas.length > 1 && (
        <div className="lo-campo lo-tr-build__ficha">
          <label htmlFor={idDaFicha}>Ficha</label>
          <select id={idDaFicha} className="lo-tr-select" value={doc.id} onChange={(evento) => trocarFicha(evento.target.value)}>
            {fichas.map((ficha) => (
              <option key={ficha.id} value={ficha.id}>
                {ficha.nome}
              </option>
            ))}
          </select>
        </div>
      )}

      <fieldset className="lo-tr-build__grade">
        <legend>Atributos de {doc.nome}</legend>
        {sistema.atributos.map((atributo) => {
          const naFicha = doc.atributos[atributo.id] ?? 0
          return <CampoDoRascunho key={`${doc.id}-${atributo.id}`} nome={atributo.nome} naFicha={naFicha} valor={atual.atributos[atributo.id] ?? naFicha} aoMudar={(valor) => mudar('atributos', atributo.id, valor, naFicha)} />
        })}
      </fieldset>
      <fieldset className="lo-tr-build__grade">
        <legend>Status</legend>
        {recursosComMaximo.map((recurso) => {
          const naFicha = doc.maximos[recurso.id] ?? 0
          return <CampoDoRascunho key={`${doc.id}-${recurso.id}`} nome={`${recurso.nome} máxima`} naFicha={naFicha} valor={atual.maximos[recurso.id] ?? naFicha} aoMudar={(valor) => mudar('maximos', recurso.id, valor, naFicha)} />
        })}
        {recursosDeUmNumero.map((recurso) => {
          const naFicha = doc.recursos[recurso.id] ?? 0
          return <CampoDoRascunho key={`${doc.id}-${recurso.id}`} nome={recurso.nome} naFicha={naFicha} valor={atual.recursos[recurso.id] ?? naFicha} aoMudar={(valor) => mudar('recursos', recurso.id, valor, naFicha)} />
        })}
      </fieldset>

      <EditorDeTecnicas
        key={doc.id}
        titulo={`Técnicas de treino de ${doc.nome}`}
        tecnicas={atual.tecnicas}
        personagem={comRascunho(doc, rascunho)}
        sistema={sistema}
        onMudar={(tecnicas) => gravar({ ...atual, tecnicas, salvoEm: Date.now() })}
      />

      <p className="lo-motivo" role="status">
        {guardado === false
          ? 'O navegador não deixou guardar: este rascunho some quando a página fechar.'
          : muda && rascunho !== null && rascunho.salvoEm > 0
            ? `Rascunho guardado neste navegador às ${horaCurta(rascunho.salvoEm)}.`
            : 'Mude um número ou dê uma técnica de treino para começar o rascunho.'}
      </p>

      <div className="lo-tr-semente__botoes">
        <button type="button" className="lo-btn lo-btn--primario" disabled={!muda || problema !== null || progresso !== null} onClick={comparar}>
          Comparar antes e depois
        </button>
        {progresso !== null && (
          <button type="button" className="lo-btn" onClick={pararComparacao}>
            Cancelar
          </button>
        )}
        <button type="button" className="lo-btn lo-btn--fantasma" disabled={!muda} onClick={descartar}>
          Descartar o rascunho
        </button>
      </div>
      {problema !== null && <p className="lo-motivo">{problema}</p>}
      {progresso !== null && <BarraDasLutas progresso={progresso} rotulo="Lutas da comparação" />}
      {erro !== null && (
        <p className="lo-linha-aviso" role="alert">
          {erro}
        </p>
      )}
      {comparacao !== null && (
        <ResultadoDaComparacao comparacao={comparacao.valor} quem={comparacao.quem} velha={comparacao.assinatura !== assinatura} />
      )}

      <ListaDeBuilds builds={builds} base={{ tipo: 'minha', fichaId: doc.id }} diferenca={diferencaDoRascunho(rascunho)} doQue={`o rascunho de ${doc.nome}`} acoes={acoesDasBuilds} />
    </div>
  )
}
