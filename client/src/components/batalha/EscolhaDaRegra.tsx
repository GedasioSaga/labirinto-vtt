import {
  BLOCOS_POR_RANK_MAX,
  BLOCOS_POR_RANK_MIN,
  BLOCOS_POR_RANK_PADRAO,
  NOME_DA_REGRA_MAX,
  NOME_DA_REGRA_PADRAO,
  TEXTO_DA_REGRA_MAX,
  blocosPorRankValido,
  type RegraDoCampo,
  type RegrasDaBatalha,
} from '../../lib/batalha/regrasDoCampo'
import { CampoLiga } from '../grimorio/CampoLiga'
import { CampoNum } from '../grimorio/CampoNum'
import { CampoSel, CampoTexto, type OpcaoDoSel } from '../grimorio/CampoTexto'
import './batalha.css'

/**
 * A REGRA DO CAMPO desta batalha (decisão 7), no "Iniciar batalha" e no
 * "Mudar regras" do painel: uma da biblioteca global (ajustada só para esta
 * batalha), uma escrita agora, ou nenhuma. "Guardar na biblioteca" grava a
 * regra para as próximas batalhas, de qualquer aventura.
 *
 * Controlado: quem monta guarda o rascunho e, ao confirmar, usa
 * `regrasDoRascunho` (a cópia da batalha) e `regraParaGuardar` (o que vai à
 * biblioteca, se for o caso).
 */

export type RascunhoDaRegra =
  | { modo: 'nenhuma' }
  | { modo: 'biblioteca'; regraId: string; blocosPorRank: number; texto: string; guardar: boolean }
  | { modo: 'nova'; nome: string; blocosPorRank: number; texto: string; guardar: boolean }

const NENHUMA = ''
const NOVA = '__nova'

/** O rascunho que abre: a cópia que a batalha já tem (no "Mudar"), senão nenhuma. */
export function rascunhoDe(regras: RegrasDaBatalha | null, biblioteca: readonly RegraDoCampo[]): RascunhoDaRegra {
  if (regras === null) return { modo: 'nenhuma' }
  const daBiblioteca = regras.origemId === null ? undefined : biblioteca.find((regra) => regra.id === regras.origemId)
  if (daBiblioteca !== undefined) return { modo: 'biblioteca', regraId: daBiblioteca.id, blocosPorRank: regras.blocosPorRank, texto: regras.texto, guardar: false }
  return { modo: 'nova', nome: regras.nome, blocosPorRank: regras.blocosPorRank, texto: regras.texto, guardar: false }
}

/** A cópia que vale nesta batalha; `null` = nenhuma. */
export function regrasDoRascunho(rascunho: RascunhoDaRegra, biblioteca: readonly RegraDoCampo[]): RegrasDaBatalha | null {
  if (rascunho.modo === 'nenhuma') return null
  const blocosPorRank = blocosPorRankValido(rascunho.blocosPorRank)
  const texto = rascunho.texto.slice(0, TEXTO_DA_REGRA_MAX)
  if (rascunho.modo === 'biblioteca') {
    const regra = biblioteca.find((candidata) => candidata.id === rascunho.regraId)
    return { origemId: regra?.id ?? null, nome: regra?.nome ?? NOME_DA_REGRA_PADRAO, blocosPorRank, texto }
  }
  return { origemId: null, nome: rascunho.nome.trim().slice(0, NOME_DA_REGRA_MAX) || NOME_DA_REGRA_PADRAO, blocosPorRank, texto }
}

/** O que a biblioteca global sabe fazer (`regrasDoCampoStore`): criar devolve a regra nova, ou `null` se não pôde. */
export interface GuardaDeRegras {
  criarRegra: (rascunho: { nome: string; blocosPorRank: number; texto: string }) => RegraDoCampo | null
  editarRegra: (id: string, mudanca: { blocosPorRank: number; texto: string }) => boolean
}

/**
 * Confirma o rascunho: com "Guardar" ligado, grava na biblioteca (a regra de
 * lá ganha os ajustes; a nova entra e a cópia da batalha aponta para ela) e
 * devolve a cópia desta batalha. A biblioteca recusar não impede a batalha.
 */
export function confirmarRascunho(rascunho: RascunhoDaRegra, biblioteca: readonly RegraDoCampo[], guarda: GuardaDeRegras): RegrasDaBatalha | null {
  const regras = regrasDoRascunho(rascunho, biblioteca)
  if (regras === null || rascunho.modo === 'nenhuma' || !rascunho.guardar) return regras
  if (rascunho.modo === 'biblioteca' && regras.origemId !== null) {
    guarda.editarRegra(regras.origemId, { blocosPorRank: regras.blocosPorRank, texto: regras.texto })
    return regras
  }
  const nova = guarda.criarRegra({ nome: regras.nome, blocosPorRank: regras.blocosPorRank, texto: regras.texto })
  return nova === null ? regras : { ...regras, origemId: nova.id }
}

export interface EscolhaDaRegraProps {
  biblioteca: readonly RegraDoCampo[]
  valor: RascunhoDaRegra
  onChange: (valor: RascunhoDaRegra) => void
  /** Por que a biblioteca não grava agora (lendo o arquivo, ou ilegível); presente = "Guardar" desligado. */
  naoGuarda?: string | null
}

export function EscolhaDaRegra({ biblioteca, valor, onChange, naoGuarda }: EscolhaDaRegraProps) {
  const opcoes: OpcaoDoSel<string>[] = [
    { valor: NENHUMA, rotulo: 'Nenhuma' },
    ...biblioteca.map((regra) => ({ valor: regra.id, rotulo: regra.nome })),
    { valor: NOVA, rotulo: 'Escrever uma nova' },
  ]
  const escolhida = valor.modo === 'nenhuma' ? NENHUMA : valor.modo === 'nova' ? NOVA : valor.regraId

  const escolher = (id: string) => {
    if (id === NENHUMA) return onChange({ modo: 'nenhuma' })
    if (id === NOVA) return onChange({ modo: 'nova', nome: '', blocosPorRank: BLOCOS_POR_RANK_PADRAO, texto: '', guardar: true })
    const regra = biblioteca.find((candidata) => candidata.id === id)
    if (regra !== undefined) onChange({ modo: 'biblioteca', regraId: regra.id, blocosPorRank: regra.blocosPorRank, texto: regra.texto, guardar: false })
  }

  return (
    <>
      <CampoSel rotulo="Regra do campo" opcoes={opcoes} valor={escolhida} onChange={escolher} />
      {valor.modo === 'nenhuma' ? (
        <p className="bt-texto">
          Sem regra do campo: cada rank de Agilidade anda {BLOCOS_POR_RANK_PADRAO} bloco.
          {biblioteca.length === 0 && ' A biblioteca ainda está vazia; "Escrever uma nova" guarda a primeira.'}
        </p>
      ) : (
        <>
          {valor.modo === 'nova' && (
            <CampoTexto rotulo="Nome da regra" valor={valor.nome} maxLength={NOME_DA_REGRA_MAX} placeholder={NOME_DA_REGRA_PADRAO} onChange={(nome) => onChange({ ...valor, nome })} />
          )}
          <CampoNum
            rotulo="Blocos por rank de Agilidade"
            valor={valor.blocosPorRank}
            min={BLOCOS_POR_RANK_MIN}
            max={BLOCOS_POR_RANK_MAX}
            passo={1}
            unidade="blocos"
            onChange={(blocosPorRank) => onChange({ ...valor, blocosPorRank: blocosPorRankValido(Math.round(blocosPorRank)) })}
          />
          <CampoTexto rotulo="Texto" multilinha valor={valor.texto} maxLength={TEXTO_DA_REGRA_MAX} placeholder="O que vale neste campo (terreno, clima, proibições...)" onChange={(texto) => onChange({ ...valor, texto })} />
          <CampoLiga
            rotulo="Guardar na biblioteca"
            ajuda={
              naoGuarda
                ? naoGuarda
                : valor.modo === 'biblioteca'
                  ? 'Grava estes ajustes na regra da biblioteca, para as próximas batalhas'
                  : 'Guarda esta regra para as próximas batalhas, em qualquer aventura'
            }
            ligado={valor.guardar && !naoGuarda}
            disabled={Boolean(naoGuarda)}
            onChange={(guardar) => onChange({ ...valor, guardar })}
          />
        </>
      )}
    </>
  )
}
