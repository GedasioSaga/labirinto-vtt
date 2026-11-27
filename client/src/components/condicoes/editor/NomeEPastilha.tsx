import { useId, useState } from 'react'
import { avisosDe, type AvisoDaCondicao, type ContextoDasFrases } from '../../../lib/condicoes/frasesDaCondicao'
import { PRAZO_PADRAO, TIPO_PADRAO_DA_CONDICAO, type TipoDaCondicao } from '../../../lib/condicoes/modelo'
import {
  camposDoDesenho,
  CORES_DE_CONDICAO,
  cortarNomeDeCondicao,
  DESENHO_ORDEM,
  desenhoDaCondicao,
  ehDesenhoNovoDeCondicao,
  limparSimboloDigitado,
  nomeDoDesenho,
  simboloDaCondicaoPropria,
  type DesenhoDeCondicao,
  type NomeDaCorDeCondicao,
} from '../../../lib/condicoesProprias'
import type { CondicaoPropria } from '../../../types/map'
import { Segmentos } from '../../batalha/editor/pecas/controlesDaPeca'
import { andarPelosRadios } from '../../grimorio/comum'
import { PastilhaDeCondicao } from '../../PastilhaDeCondicao'
import './pecas/estilo'
import { TIPOS_NA_TELA } from './pecas/vocabulario'

/** O que esta seção edita: o nome, o tipo e a pastilha (cor, desenho ou símbolo digitado). Nada da regra. */
export type IdentidadeDaCondicao = Pick<CondicaoPropria, 'nome' | 'cor' | 'simbolo' | 'texto' | 'tipo' | 'desenho'>

/** As duas cores que entraram no rework (decisão 11 do protótipo): levam o ponto dourado. */
const CORES_NOVAS: readonly NomeDaCorDeCondicao[] = ['Amarelo', 'Cinza']
/** A prévia grande (`pastilha(cd, 64)` do protótipo) e a de cada desenho na grade. */
const PREVIA = 64
const PASTILHA_DA_GRADE = 24

/**
 * A identidade com só o que difere do padrão: a negativa e o símbolo vazio ficam ausentes (a condição de
 * antes volta igual, e o arquivo só sobe de versão com campo novo de verdade); o desenho novo só fica
 * com a reserva dele no `simbolo` (`camposDoDesenho`).
 */
function enxuta(campos: { nome: string; cor: string; desenho: DesenhoDeCondicao; texto: string; tipo: TipoDaCondicao }): IdentidadeDaCondicao {
  return {
    nome: campos.nome,
    cor: campos.cor,
    ...camposDoDesenho(campos.desenho),
    ...(campos.texto === '' ? {} : { texto: campos.texto }),
    ...(campos.tipo === TIPO_PADRAO_DA_CONDICAO ? {} : { tipo: campos.tipo }),
  }
}

/**
 * O aviso do nome (vazio, repetido, ou o de uma das 25 de fábrica): o MESMO `avisosDe` do cartão, com a
 * condição sem peças, sem saídas e no prazo padrão, em que só o nome tem o que avisar. Uma regra só para o
 * cartão e para o campo.
 */
function avisoDoNome(id: string, nome: string, contexto: ContextoDasFrases): AvisoDaCondicao | null {
  const [aviso] = avisosDe({ id, nome, tipo: TIPO_PADRAO_DA_CONDICAO, pecas: [], prazo: PRAZO_PADRAO, saidas: [] }, contexto)
  return aviso ?? null
}

export interface NomeEPastilhaProps {
  /** O id da condição no rascunho (o nome repetido não conta com ela mesma). */
  id: string
  identidade: IdentidadeDaCondicao
  /** A identidade mudou: o editor troca só estes campos no rascunho (as peças, o prazo e as saídas ficam). */
  aoMudar: (identidade: IdentidadeDaCondicao) => void
  /** O catálogo em volta: o nome repetido. */
  contexto: ContextoDasFrases
  /** Condição nova: o nome nasce com o foco. */
  focarNome?: boolean
}

/**
 * NOME E PASTILHA (`blocoIdentidade` do protótipo): o nome, o tipo (negativa ou positiva), a cor e o
 * desenho ou o símbolo digitado. A prévia e cada desenho da grade são a pastilha de verdade
 * (`PastilhaDeCondicao` com `simboloDaCondicaoPropria`), a mesma conta que o mapa e a tela de quem joga
 * desenham (`pixi/drawTokenConditions.ts`): o que o mestre escolhe aqui é o que sai em cima da ficha.
 * A cor e o desenho que entraram nesta versão levam um ponto dourado.
 *
 * Teclado: as cores e os desenhos são grupos de rádio (setas andam e escolhem, Home e End vão às pontas).
 */
export function NomeEPastilha({ id, identidade, aoMudar, contexto, focarNome = false }: NomeEPastilhaProps) {
  const [nomeTocado, setNomeTocado] = useState(false)
  const nomeId = useId()
  const erroId = useId()
  const corId = useId()
  const desenhoId = useId()
  const digitadoId = useId()

  const texto = identidade.texto ?? ''
  const digitado = texto !== ''
  const desenho = desenhoDaCondicao(identidade)
  const tipo = identidade.tipo ?? TIPO_PADRAO_DA_CONDICAO
  const atual = { nome: identidade.nome, cor: identidade.cor, desenho, texto, tipo }
  const mudar = (campos: Partial<typeof atual>) => aoMudar(enxuta({ ...atual, ...campos }))

  const aviso = avisoDoNome(id, identidade.nome, contexto)
  // O "sem nome" espera o mestre sair do campo uma vez; o nome repetido avisa na hora.
  const erro = aviso !== null && aviso.impedeSalvar && (identidade.nome.trim() !== '' || nomeTocado) ? aviso.texto : null
  const nota = aviso !== null && !aviso.impedeSalvar ? aviso.texto : null
  const corNaPaleta = CORES_DE_CONDICAO.findIndex((opcao) => opcao.valor === identidade.cor.toLowerCase())

  return (
    <div className="lb-cd-id">
      <div className="lb-cd-id__previa">
        <PastilhaDeCondicao symbol={simboloDaCondicaoPropria(identidade)} tamanho={PREVIA} />
        <small>{identidade.nome.trim() === '' ? 'Sem nome' : identidade.nome.trim()}</small>
      </div>

      <div className="lb-cd-id__campos">
        <div className="lb-cd-id__linha">
          <div className="lb-cd-campo">
            <label className="lb-cd-rot" htmlFor={nomeId}>
              Nome
            </label>
            {/* Sem `maxLength`: ele conta unidades de código e cortaria um emoji no meio. Quem corta é o `cortarNomeDeCondicao`, entre caracteres. */}
            <input
              id={nomeId}
              className="lb-cd-entrada"
              type="text"
              value={identidade.nome}
              placeholder="Queimando"
              autoComplete="off"
              spellCheck={false}
              autoFocus={focarNome}
              aria-invalid={erro !== null}
              aria-describedby={erroId}
              onChange={(evento) => mudar({ nome: cortarNomeDeCondicao(evento.target.value) })}
              onBlur={() => setNomeTocado(true)}
            />
            <p className={erro === null ? 'lb-cd-erro lb-cd-erro--nota' : 'lb-cd-erro'} id={erroId} aria-live="polite">
              {erro ?? nota ?? ''}
            </p>
          </div>
          <div className="lb-cd-campo">
            <span className="lb-cd-rot" aria-hidden="true">
              Tipo
            </span>
            <Segmentos rotulo="Tipo da condição" valor={tipo} opcoes={TIPOS_NA_TELA} onChange={(novo) => mudar({ tipo: novo })} />
          </div>
        </div>

        <div className="lb-cd-campo">
          <span className="lb-cd-rot" id={corId}>
            Cor
          </span>
          <div className="lb-cd-cores" role="radiogroup" aria-labelledby={corId} onKeyDown={andarPelosRadios}>
            {CORES_DE_CONDICAO.map((opcao, indice) => {
              const nova = CORES_NOVAS.includes(opcao.nome)
              const rotulo = nova ? `${opcao.nome} (nova)` : opcao.nome
              return (
                <button
                  key={opcao.valor}
                  type="button"
                  role="radio"
                  className="lb-cd-cor"
                  style={{ background: opcao.valor }}
                  aria-checked={indice === corNaPaleta}
                  aria-label={rotulo}
                  title={rotulo}
                  tabIndex={indice === (corNaPaleta < 0 ? 0 : corNaPaleta) ? 0 : -1}
                  onClick={() => mudar({ cor: opcao.valor })}
                >
                  {nova && <i className="lb-cd-novo" />}
                </button>
              )
            })}
            <input
              type="color"
              className="lb-cd-cor lb-cd-cor--outra"
              aria-label="Outra cor…"
              title="Outra cor…"
              value={identidade.cor}
              data-marcada={corNaPaleta < 0 ? '' : undefined}
              onChange={(evento) => mudar({ cor: evento.target.value })}
            />
          </div>
        </div>

        <div className="lb-cd-campo">
          <span className="lb-cd-rot" id={desenhoId}>
            Desenho
          </span>
          <div className="lb-cd-desenhos" role="radiogroup" aria-labelledby={desenhoId} onKeyDown={andarPelosRadios}>
            {DESENHO_ORDEM.map((opcao) => {
              const novo = ehDesenhoNovoDeCondicao(opcao)
              const rotulo = novo ? `${nomeDoDesenho(opcao)} (novo)` : nomeDoDesenho(opcao)
              const escolhido = !digitado && opcao === desenho
              return (
                <button
                  key={opcao}
                  type="button"
                  role="radio"
                  className="lb-cd-desenho"
                  aria-checked={escolhido}
                  aria-label={rotulo}
                  title={rotulo}
                  tabIndex={opcao === desenho ? 0 : -1}
                  onClick={() => mudar({ desenho: opcao, texto: '' })}
                >
                  <PastilhaDeCondicao symbol={simboloDaCondicaoPropria({ cor: identidade.cor, ...camposDoDesenho(opcao) })} tamanho={PASTILHA_DA_GRADE} />
                  {novo && <i className="lb-cd-novo" />}
                </button>
              )
            })}
          </div>
          <div className="lb-cd-digitar">
            <label htmlFor={digitadoId}>ou digite 1 ou 2 letras, números ou um emoji</label>
            {/* Sem `maxLength`, pelo mesmo motivo do nome: quem corta é o `limparSimboloDigitado`, por caractere visto. */}
            <input
              id={digitadoId}
              className="lb-cd-entrada lb-cd-entrada--curta"
              type="text"
              value={texto}
              placeholder="A"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              data-ativo={digitado ? '' : undefined}
              onChange={(evento) => mudar({ texto: limparSimboloDigitado(evento.target.value) })}
            />
            <span className="lb-cd-legenda">
              <i aria-hidden="true" />
              ponto dourado = novo
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
