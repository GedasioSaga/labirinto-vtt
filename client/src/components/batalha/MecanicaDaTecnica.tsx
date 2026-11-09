import { useId, useRef, useState } from 'react'
import { avisoDaMecanica, lerMecanica, type MecanicaLida as LeituraDaMecanica, type MecanicaV1 } from '../../lib/batalha/mecanica/modelo'
import { guardarMecanica, MODELOS_PRONTOS, mecanicaDoModelo, mesmaMecanica, problemaDaMecanica, tecnicasParaCopiar } from '../../lib/batalha/mecanica/modelos'
import { etiquetaDaMecanica, pecasAMao, resumoDaMecanica, type FichaDaPrevia } from '../../lib/batalha/mecanica/resumo'
import type { CartaoDaFicha, MecanicaGuardada } from '../../lib/personagem'
import { BlocosDaMecanica } from './BlocosDaMecanica'
import './MecanicaDaTecnica.css'

/**
 * A MECÂNICA DA TÉCNICA no cartão da ficha (construtor de mecânicas, fatia C2;
 * seção 3 de docs/planos/construtor-de-mecanicas-2026-11-08.md).
 *
 * Quem edita (decisão 1 do mestre): o MESTRE grava a `mecanica` do cartão; o
 * DONO da ficha monta a `mecanicaProposta`, que vai ao mestre no Salvar e só
 * vale depois que ele aceitar. O número que sai das peças, na batalha, é o
 * que o app do mestre recalcula (decisão 2): aqui é só a prévia.
 *
 * Cada mudança vai na hora para o cartão em edição (como os outros campos da
 * ficha); quem grava é o Salvar da janela. O rascunho do editor fica aqui
 * dentro: a peça pela metade (fórmula vazia) não se perde ao reler o cartão.
 */

/** `ninguem` = só lê o resumo (o site do Lobby, que ainda não leva a mecânica). */
export type QuemEditaAMecanica = 'mestre' | 'dono' | 'ninguem'

export interface MecanicaDaTecnicaProps {
  cartao: CartaoDaFicha
  ficha: FichaDaPrevia
  quemEdita: Exclude<QuemEditaAMecanica, 'ninguem'>
  /** As técnicas da ficha, para o "Copiar de outra técnica". */
  tecnicas: readonly CartaoDaFicha[]
  onChange: (cartao: CartaoDaFicha) => void
}

type Fase = 'fechado' | 'escolhendo' | 'editando'

/** O cartão sem um dos dois campos da mecânica. */
function semCampo(cartao: CartaoDaFicha, campo: 'mecanica' | 'mecanicaProposta'): CartaoDaFicha {
  const { [campo]: _fora, ...resto } = cartao
  return resto
}

/** O resumo em frases, com a etiqueta (o que o jogador também vê). */
export function ResumoDaMecanica({ mecanica, ficha, titulo }: { mecanica: MecanicaV1; ficha?: FichaDaPrevia; titulo?: string }) {
  const aMao = pecasAMao(mecanica)
  return (
    <div className="lb-mec__resumo">
      <div className="lb-mec__resumo-cab">
        {titulo !== undefined && <span className="lb-mec__resumo-titulo">{titulo}</span>}
        <span className="lb-mec__etiqueta" data-a-mao={aMao > 0 ? '' : undefined}>
          {etiquetaDaMecanica(mecanica)}
        </span>
      </div>
      <ul className="lb-mec__frases">
        {resumoDaMecanica(mecanica, ficha).map((frase, indice) => (
          <li key={indice}>{frase}</li>
        ))}
      </ul>
    </div>
  )
}

/** O aviso do cartão com mecânica que este app não lê. */
function AvisoDaLida({ lida }: { lida: LeituraDaMecanica }) {
  if (lida.tipo !== 'invalida' && lida.tipo !== 'futura') return null
  return (
    <p className="lb-mec__aviso" role="note">
      {avisoDaMecanica(lida)}
    </p>
  )
}

/**
 * Fora da edição (o mestre e o jogador): o resumo em frases da mecânica que
 * vale e, se houver, a marca da proposta que espera o mestre. Sem mecânica e
 * sem proposta = nada (o cartão segue pelo texto, como antes).
 */
export function MecanicaLida({ cartao, ficha }: { cartao: CartaoDaFicha; ficha: FichaDaPrevia }) {
  if (cartao.mecanica === undefined && cartao.mecanicaProposta === undefined) return null
  const valendo = lerMecanica(cartao.mecanica)
  return (
    <div className="lb-mec lb-mec--lida">
      {valendo.tipo === 'pecas' && <ResumoDaMecanica mecanica={valendo.mecanica} ficha={ficha} titulo="Mecânica" />}
      <AvisoDaLida lida={valendo} />
      {cartao.mecanicaProposta !== undefined && <p className="lb-mec__espera">Proposta de mecânica esperando o mestre.</p>}
    </div>
  )
}

export function MecanicaDaTecnica({ cartao, ficha, quemEdita, tecnicas, onChange }: MecanicaDaTecnicaProps) {
  const tituloId = useId()
  const copiarId = useId()
  const campo = quemEdita === 'mestre' ? 'mecanica' : 'mecanicaProposta'
  const valendo = lerMecanica(cartao.mecanica)
  const proposta = lerMecanica(cartao.mecanicaProposta)
  const [fase, setFase] = useState<Fase>('fechado')
  const [rascunho, setRascunho] = useState<MecanicaV1 | null>(null)
  const montarRef = useRef<HTMLButtonElement>(null)
  const copiaveis = tecnicasParaCopiar(tecnicas, cartao.id)
  const futura = valendo.tipo === 'futura' || (quemEdita === 'dono' && proposta.tipo === 'futura')

  /** A mecânica que o editor abre: a proposta do dono (se for ele), senão a que vale. */
  const inicial = (): MecanicaV1 | null => {
    if (quemEdita === 'dono' && proposta.tipo === 'pecas') return proposta.mecanica
    return valendo.tipo === 'pecas' ? valendo.mecanica : null
  }

  /** Grava no cartão em edição: o mestre na mecânica; o dono na proposta (igual à que vale = proposta nenhuma). */
  const gravar = (mecanica: MecanicaV1) => {
    setRascunho(mecanica)
    const guardada: MecanicaGuardada = guardarMecanica(mecanica)
    if (quemEdita === 'dono' && mesmaMecanica(guardada, cartao.mecanica)) {
      onChange(semCampo(cartao, 'mecanicaProposta'))
      return
    }
    onChange(campo === 'mecanica' ? { ...cartao, mecanica: guardada } : { ...cartao, mecanicaProposta: guardada })
  }

  const abrir = () => {
    const atual = inicial()
    if (atual === null) {
      setFase('escolhendo')
      return
    }
    setRascunho(atual)
    setFase('editando')
  }
  const fechar = () => {
    setFase('fechado')
    // O foco volta ao botão que abriu, e não some com o editor.
    requestAnimationFrame(() => montarRef.current?.focus())
  }
  const comecarDe = (mecanica: MecanicaV1) => {
    gravar(mecanica)
    setFase('editando')
  }
  const tirar = () => {
    onChange(semCampo(cartao, campo))
    setRascunho(null)
    fechar()
  }

  const editando = fase === 'editando' && rascunho !== null
  const problema = editando ? problemaDaMecanica(rascunho) : null
  const temAlgo = cartao.mecanica !== undefined || cartao.mecanicaProposta !== undefined

  return (
    <section className="lb-mec" aria-labelledby={tituloId}>
      <div className="lb-mec__cab">
        <h5 className="lb-label lb-mec__titulo" id={tituloId}>
          Mecânica
        </h5>
        {valendo.tipo === 'nenhuma' && fase === 'fechado' && <span className="lb-mec__cab-dica">O app lê o Custo, a Ação e o Dano do texto.</span>}
      </div>

      {/* O mestre decide a proposta do dono antes de mexer na mecânica. */}
      {quemEdita === 'mestre' && cartao.mecanicaProposta !== undefined && (
        <div className="lb-mec__proposta" role="group" aria-label="Proposta do dono da ficha">
          <p className="lb-mec__proposta-texto">O dono da ficha propôs esta mecânica. Ela só vale depois que você aceitar e salvar a ficha.</p>
          {proposta.tipo === 'pecas' ? <ResumoDaMecanica mecanica={proposta.mecanica} ficha={ficha} titulo="Proposta" /> : <AvisoDaLida lida={proposta} />}
          <div className="lb-mec__acoes">
            <button
              type="button"
              className="lb-btn lb-btn--primary lb-btn--compact"
              disabled={proposta.tipo !== 'pecas'}
              onClick={() => {
                if (proposta.tipo !== 'pecas') return
                onChange({ ...semCampo(cartao, 'mecanicaProposta'), mecanica: guardarMecanica(proposta.mecanica) })
                setRascunho(proposta.mecanica)
              }}
            >
              Aceitar a proposta
            </button>
            <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={() => onChange(semCampo(cartao, 'mecanicaProposta'))}>
              Recusar
            </button>
          </div>
        </div>
      )}

      {quemEdita === 'dono' && cartao.mecanicaProposta !== undefined && fase === 'fechado' && (
        <div className="lb-mec__proposta" role="group" aria-label="Sua proposta">
          <p className="lb-mec__proposta-texto">Sua proposta espera o mestre. Até ele aceitar, vale {valendo.tipo === 'nenhuma' ? 'o texto da técnica' : 'a mecânica de antes'}.</p>
          {proposta.tipo === 'pecas' ? <ResumoDaMecanica mecanica={proposta.mecanica} ficha={ficha} titulo="Proposta" /> : <AvisoDaLida lida={proposta} />}
        </div>
      )}

      {fase === 'fechado' && (
        <>
          {valendo.tipo === 'pecas' && <ResumoDaMecanica mecanica={valendo.mecanica} ficha={ficha} titulo={cartao.mecanicaProposta !== undefined ? 'Vale agora' : undefined} />}
          <AvisoDaLida lida={valendo} />
          <div className="lb-mec__acoes">
            <button ref={montarRef} type="button" className="lb-btn lb-btn--compact" disabled={futura} title={futura ? 'Feita num app mais novo: atualize o app para editar' : undefined} onClick={abrir}>
              {temAlgo ? (quemEdita === 'dono' ? 'Editar a proposta' : 'Editar a mecânica') : quemEdita === 'dono' ? 'Montar mecânica (vai ao mestre)' : 'Montar mecânica'}
            </button>
            {quemEdita === 'mestre' && cartao.mecanica !== undefined && (
              <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={tirar}>
                Tirar a mecânica (volta ao texto)
              </button>
            )}
            {quemEdita === 'dono' && cartao.mecanicaProposta !== undefined && (
              <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={tirar}>
                Desistir da proposta
              </button>
            )}
          </div>
          {valendo.tipo === 'invalida' && quemEdita === 'mestre' && <p className="lb-field__hint">"Editar" começa de um modelo: a mecânica inválida sai quando você escolher um.</p>}
        </>
      )}

      {fase === 'escolhendo' && (
        <div className="lb-mec__comeco" role="group" aria-labelledby={`${tituloId}-comeco`}>
          <p className="lb-mec__comeco-titulo" id={`${tituloId}-comeco`}>
            Comece por um modelo e ajuste os números.
          </p>
          <div className="lb-mec__modelos">
            {MODELOS_PRONTOS.map((modelo) => (
              <button key={modelo.id} type="button" className="lb-mec__modelo" onClick={() => comecarDe(mecanicaDoModelo(modelo.id, ficha.sistema))}>
                <span className="lb-mec__modelo-nome">{modelo.nome}</span>
                <span className="lb-mec__modelo-dica">{modelo.dica}</span>
              </button>
            ))}
          </div>
          {copiaveis.length > 0 && (
            <div className="lb-mec__copiar">
              <label className="lb-mec__numero-rotulo" htmlFor={copiarId}>
                Ou copie de outra técnica desta ficha
              </label>
              <select
                id={copiarId}
                className="lb-input"
                value=""
                onChange={(event) => {
                  const escolhida = copiaveis.find((tecnica) => tecnica.id === event.target.value)
                  if (escolhida !== undefined) comecarDe(escolhida.mecanica)
                }}
              >
                <option value="">Escolha a técnica…</option>
                {copiaveis.map((tecnica) => (
                  <option key={tecnica.id} value={tecnica.id}>
                    {tecnica.nome}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="lb-mec__acoes">
            <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={() => (rascunho === null ? fechar() : setFase('editando'))}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {editando && (
        <div className="lb-mec__editor">
          <p className="lb-field__hint">
            {quemEdita === 'dono'
              ? 'Vai ao mestre quando você salvar a ficha. O número final na batalha é o que o app do mestre calcula.'
              : 'Com a mecânica, os campos Custo, Ação, Tempo, Dano e Efeito em texto viram só descrição.'}
          </p>
          <BlocosDaMecanica mecanica={rascunho} cartao={cartao} ficha={ficha} onChange={gravar} />
          <ResumoDaMecanica mecanica={rascunho} ficha={ficha} titulo={quemEdita === 'dono' ? 'Como fica a proposta' : 'Como fica'} />
          {problema !== null && (
            <p className="lb-field__error" role="status">
              Ainda não vale na batalha: {problema}.
            </p>
          )}
          <div className="lb-mec__acoes">
            <button type="button" className="lb-btn lb-btn--compact" onClick={fechar}>
              Fechar o editor
            </button>
            <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={() => setFase('escolhendo')}>
              Recomeçar de um modelo
            </button>
            {quemEdita === 'mestre' ? (
              <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={tirar}>
                Tirar a mecânica (volta ao texto)
              </button>
            ) : (
              cartao.mecanicaProposta !== undefined && (
                <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={tirar}>
                  Desistir da proposta
                </button>
              )
            )}
          </div>
        </div>
      )}
    </section>
  )
}
