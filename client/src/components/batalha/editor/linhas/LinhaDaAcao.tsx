import { useId, useRef, useState } from 'react'
import type { AcaoDaMecanica, MecanicaV1, Teste, UsoDaMecanica } from '../../../../lib/batalha/mecanica/modelo'
import { trocarUso } from '../../../../lib/batalha/mecanica/modelos'
import { ACOES } from '../../blocos/BlocosDoComeco'
import { Escolha } from '../../blocos/controles'
import { categoriaDaMecanica, nomeDaAcao, type CategoriaDaAcao } from '../../../../lib/batalha/mecanica/categoria'
import { mecanicaNaCategoria, motivoDaCategoria, oQueSaiu } from '../acaoNaTela'
import type { MudarNoEditor } from '../mudarNoEditor'

interface CartaoDaCategoria {
  valor: CategoriaDaAcao | 'passiva'
  nome: string
  faz: string
}

const ATAQUES: readonly CartaoDaCategoria[] = [
  { valor: 'simples', nome: 'Ataque Simples', faz: 'Gasta a ação simples da vez.' },
  { valor: 'completo', nome: 'Ataque Completo', faz: 'Gasta a vez inteira.' },
  { valor: 'overload', nome: 'Overload', faz: '1 por batalha. Não erra: só outra Overload defende.' },
]

const SEM_SER_ATAQUE: readonly CartaoDaCategoria[] = [
  { valor: 'apoio', nome: 'Apoio', faz: 'Cura, buff ou escudo num aliado. Ninguém reage.' },
  { valor: 'reacao', nome: 'Reação', faz: 'Usada no lugar da reação, quando apanha.' },
  { valor: 'passiva', nome: 'Passiva', faz: 'Vale sozinha, sem gastar ação.' },
]

/** Passiva é o cartão sem mecânica (decisão de 23/11): o editor a escolhe junto com o modo "Só texto" (ED5). */
const PASSIVA_AINDA_NAO = 'A Passiva é o cartão sem peças (o app lê a descrição). Escolher aqui chega com o editor inteiro.'

const OUTRAS_ACOES_DO_ATAQUE = ACOES.filter((acao) => acao.valor !== 'completa')

const QUANDO_A_REACAO_VALE: readonly { valor: Exclude<UsoDaMecanica, 'ativa'>; rotulo: string }[] = [
  { valor: 'reacao', rotulo: 'Só no lugar da reação' },
  { valor: 'ativaOuReacao', rotulo: 'Na vez ou na reação' },
]

const NOME_NO_AVISO: Readonly<Record<CategoriaDaAcao, string>> = { simples: 'Ataque Simples', completo: 'Ataque Completo', overload: 'Overload', apoio: 'Apoio', reacao: 'Reação' }

function ehOutraAcao(acao: AcaoDaMecanica): boolean {
  return acao === 'bonus' || acao === 'livre' || acao === 'perguntar'
}

/**
 * LINHA AÇÃO (EDITOR.md §3.3, protótipo `htmlAcao`): os seis cartões em dois
 * grupos, rádio de verdade por baixo (setas e Espaço como o sistema). Bônus,
 * Livre e "perguntar" ficam atrás do link discreto, porque fichas de hoje usam.
 */
export function LinhaDaAcao({ mecanica, onChange }: { mecanica: MecanicaV1; onChange: MudarNoEditor }) {
  const nome = useId()
  const categoria = categoriaDaMecanica(mecanica)
  // O teste de antes da Overload, para voltar a ele quando ela sai (a Overload trava em "não erra").
  const testeAntes = useRef<Teste | null>(null)
  const [outraAcaoAberta, setOutraAcaoAberta] = useState(false)

  const escolher = (nova: CategoriaDaAcao) => {
    if (nova === 'overload') testeAntes.current = mecanica.teste
    const depois = mecanicaNaCategoria(mecanica, nova, testeAntes.current)
    const saiu = oQueSaiu(mecanica, depois)
    onChange(depois, saiu === null ? undefined : `${NOME_NO_AVISO[nova]}: ${saiu}.`)
  }

  const cartao = (opcao: CartaoDaCategoria) => {
    const motivo = opcao.valor === 'passiva' ? PASSIVA_AINDA_NAO : motivoDaCategoria(mecanica, opcao.valor)
    const marcado = opcao.valor === categoria
    return (
      <label key={opcao.valor} className="lb-ed__opc" data-overload={opcao.valor === 'overload' ? '' : undefined} data-bloqueada={motivo !== null ? '' : undefined} title={motivo ?? undefined}>
        <input
          className="lb-sr-only"
          type="radio"
          name={nome}
          value={opcao.valor}
          checked={marcado}
          disabled={motivo !== null}
          onChange={() => {
            if (opcao.valor !== 'passiva') escolher(opcao.valor)
          }}
        />
        <span className="lb-ed__opc-nome">{opcao.valor === 'simples' && marcado ? nomeDaAcao(mecanica) : opcao.nome}</span>
        <span className="lb-ed__opc-faz">{opcao.faz}</span>
      </label>
    )
  }

  const ataque = categoria === 'simples' || categoria === 'completo'
  return (
    <>
      <div className="lb-ed__opcs" role="radiogroup" aria-label="Ação">
        <p className="lb-ed__opcs-grupo">Ataque</p>
        {ATAQUES.map(cartao)}
        <p className="lb-ed__opcs-grupo">Sem ser ataque</p>
        {SEM_SER_ATAQUE.map(cartao)}
      </div>
      {ataque &&
        (outraAcaoAberta || ehOutraAcao(mecanica.acao) ? (
          <Escolha<AcaoDaMecanica> legenda="Gasta outra ação" opcoes={OUTRAS_ACOES_DO_ATAQUE} valor={mecanica.acao} onChange={(acao) => onChange({ ...mecanica, acao })} />
        ) : (
          <button type="button" className="lb-ed__link" onClick={() => setOutraAcaoAberta(true)}>
            Gasta a Bônus, a Livre ou pergunta na hora?
          </button>
        ))}
      {categoria === 'apoio' && <Escolha<AcaoDaMecanica> legenda="Gasta" opcoes={ACOES} valor={mecanica.acao} onChange={(acao) => onChange({ ...mecanica, acao })} />}
      {categoria === 'reacao' && (
        <Escolha<Exclude<UsoDaMecanica, 'ativa'>>
          legenda="Quando usa"
          opcoes={QUANDO_A_REACAO_VALE}
          valor={mecanica.uso === 'ativaOuReacao' ? 'ativaOuReacao' : 'reacao'}
          onChange={(uso) => {
            const depois = trocarUso(mecanica, uso)
            const saiu = oQueSaiu(mecanica, depois)
            onChange(depois, saiu === null ? undefined : `Só no lugar da reação: ${saiu}.`)
          }}
        />
      )}
      {categoria === 'overload' && (
        <p className="lb-ed__trava">
          <svg className="lb-ed__ic" viewBox="0 0 16 16" aria-hidden="true">
            <rect x="3" y="7" width="10" height="7" rx="1.5" />
            <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
          </svg>
          Overload gasta a vez inteira, vale 1 vez por batalha e o alvo não reage (só outra Overload defende). Acerto e Custo seguem isso.
        </p>
      )}
    </>
  )
}
