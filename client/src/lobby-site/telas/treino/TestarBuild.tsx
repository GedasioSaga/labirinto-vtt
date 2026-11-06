import { useEffect, useId, useRef, useState } from 'react'
import type { Personagem } from '../../../lib/personagem'
import { LUTAS_DA_SERIE, type ComparacaoDeBuild } from '../../../lib/treino/cemLutas'
import { compararBuildNoWorker, type LutasNoWorker } from '../../../lib/treino/lutasNoWorker'
import { sementeNova } from '../../../lib/treino/sorteio'
import { SISTEMA_DO_LOBBY } from '../contexto'
import { assentarAnimacao } from './ArenaDaLuta'
import { BarraDasLutas, NumerosDaSerie, type Progresso } from './CemLutas'
import { lutadoresDaMontagem, problemaDaMontagem, type MontagemDaLuta } from './lutaDeTreino'
import { apagarRascunho, comRascunho, guardarRascunho, lerRascunho, NUMERO_DO_RASCUNHO_MAX, rascunhoMuda, rascunhoVazio, type RascunhoDeTreino } from './rascunhoDeTreino'

/**
 * TESTAR BUILD (fatia T7; achado Tr6): a pessoa muda atributos e máximos numa
 * cópia da ficha, o "rascunho de treino", guardado neste navegador por mesa e
 * por ficha (recarregar não perde), e compara antes x depois: as mesmas 100
 * sementes com a ficha de agora e com o rascunho, no worker da T4. O rascunho
 * nunca vai ao servidor e nunca muda a ficha de verdade.
 */

const ATRIBUTOS = SISTEMA_DO_LOBBY.atributos
const RECURSOS_COM_MAXIMO = SISTEMA_DO_LOBBY.recursos.filter((recurso) => recurso.atualEMaximo === true)

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

export function TestarBuild({ campanhaId, demo, fichas, fichaInicial, montagem, aoMudarRascunho }: PropsDoBuild) {
  const [fichaId, setFichaId] = useState<string | null>(fichaInicial ?? fichas[0]?.id ?? null)
  const doc = fichas.find((ficha) => ficha.id === fichaId) ?? fichas[0]
  const [rascunho, setRascunho] = useState<RascunhoDeTreino | null>(() => (doc === undefined ? null : lerRascunho(campanhaId, doc.id, demo)))
  const [guardado, setGuardado] = useState<boolean | null>(null)
  const [progresso, setProgresso] = useState<Progresso | null>(null)
  const [comparacao, setComparacao] = useState<ComparacaoDeBuild | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const emCurso = useRef<LutasNoWorker<ComparacaoDeBuild> | null>(null)
  const idDaFicha = useId()

  useEffect(() => () => emCurso.current?.cancelar(), [])

  if (doc === undefined) {
    return <p className="lo-vazio">Você não tem personagem nesta mesa para testar uma build.</p>
  }
  const atual = rascunho ?? rascunhoVazio(doc.id)

  function trocarFicha(id: string) {
    setFichaId(id)
    setRascunho(lerRascunho(campanhaId, id, demo))
    setGuardado(null)
    setComparacao(null)
  }

  function mudar(campo: 'atributos' | 'maximos', id: string, valor: number, naFicha: number) {
    if (doc === undefined) return
    const numeros = { ...atual[campo] }
    if (valor === naFicha) delete numeros[id]
    else numeros[id] = valor
    const novo: RascunhoDeTreino = { ...atual, [campo]: numeros, salvoEm: Date.now() }
    setRascunho(novo)
    setComparacao(null)
    setGuardado(guardarRascunho(campanhaId, novo, demo))
    aoMudarRascunho()
  }

  function descartar() {
    if (doc === undefined) return
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
    const corrida = compararBuildNoWorker({ sistema: SISTEMA_DO_LOBBY, atual: antes.lutadores, rascunho: depois.lutadores, lado: 'a', semente: sementeNova() }, (feitas, total) =>
      setProgresso({ feitas, total }),
    )
    emCurso.current = corrida
    corrida.saida
      .then((saida) => {
        if (emCurso.current !== corrida) return
        emCurso.current = null
        setProgresso(null)
        if (saida.ok) setComparacao(saida.valor)
        else if (saida.motivo === 'falhou') setErro(`A comparação parou com erro: ${saida.detalhe}`)
      })
      .catch((falha: unknown) => {
        emCurso.current = null
        setProgresso(null)
        setErro(`A comparação parou com erro: ${falha instanceof Error ? falha.message : String(falha)}`)
      })
  }

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
        {ATRIBUTOS.map((atributo) => {
          const naFicha = doc.atributos[atributo.id] ?? 0
          return <CampoDoRascunho key={`${doc.id}-${atributo.id}`} nome={atributo.nome} naFicha={naFicha} valor={atual.atributos[atributo.id] ?? naFicha} aoMudar={(valor) => mudar('atributos', atributo.id, valor, naFicha)} />
        })}
      </fieldset>
      <fieldset className="lo-tr-build__grade">
        <legend>Máximos</legend>
        {RECURSOS_COM_MAXIMO.map((recurso) => {
          const naFicha = doc.maximos[recurso.id] ?? 0
          return <CampoDoRascunho key={`${doc.id}-${recurso.id}`} nome={`${recurso.nome} máxima`} naFicha={naFicha} valor={atual.maximos[recurso.id] ?? naFicha} aoMudar={(valor) => mudar('maximos', recurso.id, valor, naFicha)} />
        })}
      </fieldset>

      <p className="lo-motivo" role="status">
        {guardado === false
          ? 'O navegador não deixou guardar: este rascunho some quando a página fechar.'
          : muda && rascunho !== null && rascunho.salvoEm > 0
            ? `Rascunho guardado neste navegador às ${horaCurta(rascunho.salvoEm)}.`
            : 'Mude um número para começar o rascunho.'}
      </p>

      <div className="lo-tr-semente__botoes">
        <button type="button" className="lo-btn lo-btn--primario" disabled={!muda || problema !== null || progresso !== null} onClick={comparar}>
          Comparar antes e depois
        </button>
        {progresso !== null && (
          <button
            type="button"
            className="lo-btn"
            onClick={() => {
              emCurso.current?.cancelar()
              emCurso.current = null
              setProgresso(null)
            }}
          >
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
        <div className="lo-tr-resultado" role="status" onAnimationEnd={assentarAnimacao}>
          <p className="lo-tr-diferenca" data-tom={comparacao.diferenca > 0 ? 'vitoria' : comparacao.diferenca < 0 ? 'derrota' : undefined}>
            {comparacao.diferenca === 0
              ? `Mesmo número de vitórias nas mesmas ${LUTAS_DA_SERIE} lutas.`
              : `${comparacao.diferenca > 0 ? '+' : '−'}${Math.abs(comparacao.diferenca)} ${Math.abs(comparacao.diferenca) === 1 ? 'vitória' : 'vitórias'} com o rascunho, nas mesmas ${LUTAS_DA_SERIE} lutas.`}
          </p>
          <div className="lo-tr-comparacao">
            <NumerosDaSerie resultado={comparacao.atual} titulo="Ficha de agora" />
            <NumerosDaSerie resultado={comparacao.rascunho} titulo="Com o rascunho" />
          </div>
        </div>
      )}
    </div>
  )
}
