import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { BUILDS_MAX, NOME_DA_BUILD_MAX, type BaseDaBuild, type BuildSalva, type DiferencaDaBuild, type ResultadoDaBuild } from '../buildsSalvas'
import './builds.css'

/**
 * AS BUILDS SALVAS NA TELA (F1 da Arena multijogador, 07/11/2026): o campo do
 * nome com o "Salvar", e a lista das builds desta conta nesta mesa, cada uma
 * com o que dá para fazer com ela aqui (abrir no rascunho, pôr no Judge) e o
 * "Apagar" com confirmação no lugar; a ação que jogaria fora algo não salvo
 * (`AcaoDaBuild.perda`) confirma do mesmo jeito. A mesma peça no Testar build e no Ajustar
 * o Judge; quem chama diz de onde a build nova sai e o que cada uma faz.
 */

/** As builds da mesa, como a montagem do treino as guarda (uma lista só para o Testar build e o Judge). */
export interface BuildsDaMesa {
  lista: readonly BuildSalva[]
  /** Por que não dá para salvar, apagar nem usar agora (o "Ver como", sem conta); `null` = dá. */
  bloqueio: string | null
  /** `false` = o navegador não deixou guardar a última mudança. */
  guardado: boolean | null
  salvar(nome: string, base: BaseDaBuild, diferenca: DiferencaDaBuild): ResultadoDaBuild
  apagar(id: string): void
  /** "sobre Zé, a sua ficha", "sobre o boneco do Judge". */
  descreverBase(build: BuildSalva): string
  /** A base saiu da mesa. */
  desligada(build: BuildSalva): boolean
  /** O Judge passa a vestir a build; devolve o texto do que mudou. */
  porNoJuiz(build: BuildSalva): string
}

export interface AcaoDaBuild {
  rotulo: string
  pode(build: BuildSalva): boolean
  /**
   * O que a ação joga fora, se joga ("o rascunho de Zé tem mudanças..."):
   * texto = pede confirmação no lugar antes, como o Apagar; `null` ou ausente =
   * faz direto.
   */
  perda?(build: BuildSalva): string | null
  /** O botão que confirma a perda ("Abrir mesmo", como o "Apagar mesmo"); ausente = o rótulo da ação. */
  confirmar?: string
  /** Faz e devolve o texto do que mudou (vai para a linha de status). */
  fazer(build: BuildSalva): string
}

/** A confirmação aberta numa build: o Apagar, ou uma ação que joga algo fora (pelo rótulo dela). */
type Confirmacao = { buildId: string; tipo: 'apagar' } | { buildId: string; tipo: 'acao'; acao: string; perda: string }

interface ListaDeBuildsProps {
  builds: BuildsDaMesa
  /** De onde a build nova sai agora (a ficha do rascunho, ou o Judge como está). */
  base: BaseDaBuild
  diferenca: DiferencaDaBuild
  /** O que a build nova guarda, para o texto embaixo do nome ("o rascunho de Zé"). */
  doQue: string
  acoes: readonly AcaoDaBuild[]
}

function quando(ms: number): string {
  return new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function textoDoResultado(resultado: ResultadoDaBuild): string {
  if (resultado.ok) return resultado.trocou ? `Build “${resultado.build.nome}” atualizada.` : `Build “${resultado.build.nome}” salva neste navegador.`
  return resultado.motivo === 'cheia' ? `Já são ${BUILDS_MAX} builds: apague uma para salvar outra.` : 'Dê um nome à build para salvar.'
}

export function ListaDeBuilds({ builds, base, diferenca, doQue, acoes }: ListaDeBuildsProps) {
  const id = useId()
  const campo = useRef<HTMLInputElement>(null)
  const [nome, setNome] = useState('')
  const [semNome, setSemNome] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState<Confirmacao | null>(null)
  const travado = builds.bloqueio !== null

  function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const resultado = builds.salvar(nome, base, diferenca)
    setSemNome(!resultado.ok && resultado.motivo === 'sem-nome')
    setAviso(textoDoResultado(resultado))
    if (!resultado.ok) campo.current?.focus()
  }

  function apagar(build: BuildSalva) {
    builds.apagar(build.id)
    setConfirmando(null)
    setAviso(`Build “${build.nome}” apagada.`)
    // A linha some: o foco volta ao nome, o começo da peça.
    campo.current?.focus()
  }

  /** A ação que joga algo fora confirma no lugar primeiro; a confirmada (ou a que não perde nada) faz. */
  function usar(acao: AcaoDaBuild, build: BuildSalva, confirmada: boolean) {
    const perda = confirmada || acao.perda === undefined ? null : acao.perda(build)
    if (perda !== null) {
      setConfirmando({ buildId: build.id, tipo: 'acao', acao: acao.rotulo, perda })
      return
    }
    setConfirmando(null)
    setAviso(acao.fazer(build))
  }

  /** A ação de agora com o rótulo da confirmação (a de quando ela abriu pode ter ficado velha); sumiu = nada a fazer. */
  function acaoDoRotulo(rotulo: string, build: BuildSalva): AcaoDaBuild | null {
    return acoes.find((candidata) => candidata.rotulo === rotulo && candidata.pode(build)) ?? null
  }

  function confirmarAcao(rotulo: string, build: BuildSalva) {
    const acao = acaoDoRotulo(rotulo, build)
    if (acao === null) setConfirmando(null)
    else usar(acao, build, true)
  }

  function teclaNaConfirmacao(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key !== 'Escape') return
    evento.preventDefault()
    setConfirmando(null)
  }

  const status =
    builds.bloqueio ?? (builds.guardado === false ? 'O navegador não deixou guardar: as builds somem quando a página fechar.' : aviso ?? `A build guarda ${doQue}: só o que muda sobre a ficha de base.`)

  return (
    <section className="lo-tr-builds" aria-labelledby={`${id}-titulo`}>
      <div className="lo-tr-builds__cab">
        <h3 className="lo-tr-bloco__titulo" id={`${id}-titulo`}>
          Builds salvas
        </h3>
        <span className="lo-tr-builds__conta">
          {builds.lista.length} de {BUILDS_MAX}
        </span>
      </div>

      <form className="lo-tr-builds__salvar" onSubmit={salvar}>
        <div className="lo-campo">
          <label htmlFor={`${id}-nome`}>Nome da build</label>
          <input
            ref={campo}
            id={`${id}-nome`}
            className="lo-texto"
            value={nome}
            maxLength={NOME_DA_BUILD_MAX}
            autoComplete="off"
            placeholder="Ex.: Força no máximo"
            disabled={travado}
            aria-invalid={semNome}
            aria-describedby={`${id}-status`}
            onChange={(evento) => {
              setNome(evento.target.value)
              setSemNome(false)
            }}
          />
        </div>
        <button type="submit" className="lo-btn" disabled={travado}>
          Salvar a build
        </button>
      </form>
      <p className="lo-motivo" id={`${id}-status`} role="status">
        {status}
      </p>

      {builds.lista.length === 0 ? (
        <p className="lo-vazio">Nenhuma build salva nesta mesa. Dê um nome e salve para voltar a ela depois.</p>
      ) : (
        <ul className="lo-tr-builds__lista">
          {builds.lista.map((build) => {
            const desligada = builds.desligada(build)
            const pedido = confirmando !== null && confirmando.buildId === build.id ? confirmando : null
            const perdaId = `${id}-perda-${build.id}`
            return (
              <li key={build.id} className="lo-tr-builds__item" data-desligada={desligada ? '1' : undefined}>
                <div className="lo-tr-builds__texto">
                  <span className="lo-tr-builds__nome">{build.nome}</span>
                  <span className="lo-tr-builds__base">
                    {builds.descreverBase(build)}, salva em {quando(build.salvoEm)}
                  </span>
                  {desligada && <span className="lo-tr-builds__aviso">A ficha de base saiu da mesa: a build fica desligada até ela voltar.</span>}
                  {pedido !== null && pedido.tipo === 'acao' && (
                    <span className="lo-tr-builds__aviso" id={perdaId}>
                      {pedido.perda}
                    </span>
                  )}
                </div>
                {pedido !== null && pedido.tipo === 'apagar' ? (
                  <div className="lo-tr-builds__botoes" role="group" aria-label={`Apagar a build ${build.nome}?`} onKeyDown={teclaNaConfirmacao}>
                    <button type="button" className="lo-btn lo-tr-builds__apagar" autoFocus onClick={() => apagar(build)}>
                      Apagar mesmo
                    </button>
                    <button type="button" className="lo-btn lo-btn--fantasma" onClick={() => setConfirmando(null)}>
                      Manter
                    </button>
                  </div>
                ) : pedido !== null ? (
                  <div className="lo-tr-builds__botoes" role="group" aria-label={`${pedido.acao}: ${build.nome}?`} aria-describedby={perdaId} onKeyDown={teclaNaConfirmacao}>
                    <button type="button" className="lo-btn" autoFocus disabled={travado || desligada} onClick={() => confirmarAcao(pedido.acao, build)}>
                      {acaoDoRotulo(pedido.acao, build)?.confirmar ?? pedido.acao}
                    </button>
                    <button type="button" className="lo-btn lo-btn--fantasma" onClick={() => setConfirmando(null)}>
                      Manter
                    </button>
                  </div>
                ) : (
                  <div className="lo-tr-builds__botoes">
                    {/* Só o que vale para esta build (a de um colega não abre no meu rascunho); a base fora da mesa desliga. */}
                    {acoes.filter((acao) => acao.pode(build)).map((acao) => (
                      <button key={acao.rotulo} type="button" className="lo-btn" disabled={travado || desligada} onClick={() => usar(acao, build, false)}>
                        {acao.rotulo}
                      </button>
                    ))}
                    <button type="button" className="lo-btn lo-btn--fantasma" disabled={travado} aria-label={`Apagar a build ${build.nome}`} onClick={() => setConfirmando({ buildId: build.id, tipo: 'apagar' })}>
                      Apagar
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
