import { useId, useRef, useState } from 'react'
import type { AcaoDaMecanica, MecanicaV1, Teste, UsoDaMecanica } from '../../../../lib/batalha/mecanica/modelo'
import { trocarUso } from '../../../../lib/batalha/mecanica/modelos'
import { ACOES } from '../../blocos/BlocosDoComeco'
import { Escolha } from '../../blocos/controles'
import { categoriaDaHabilidade, nomeDaAcao, type CategoriaDaHabilidade } from '../../../../lib/batalha/mecanica/categoria'
import { mecanicaNaCategoria, motivoDaCategoria, oQueSaiu } from '../acaoNaTela'
import type { MudarNoEditor } from '../mudarNoEditor'

interface CartaoDaCategoria {
  valor: CategoriaDaHabilidade
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
  { valor: 'passiva', nome: 'Passiva', faz: 'Vale sozinha, sem gastar ação. Monta com peças: dispara sozinha, raça.' },
  { valor: 'manter', nome: 'Ligar e manter', faz: 'Forma, postura ou imbuir: liga e fica valendo até desligar.' },
]

const OUTRAS_ACOES_DO_ATAQUE = ACOES.filter((acao) => acao.valor !== 'completa')

const QUANDO_A_REACAO_VALE: readonly { valor: Exclude<UsoDaMecanica, 'ativa' | 'passiva' | 'manter'>; rotulo: string }[] = [
  { valor: 'reacao', rotulo: 'Só no lugar da reação' },
  { valor: 'ativaOuReacao', rotulo: 'Na vez ou na reação' },
]

const NOME_NO_AVISO: Readonly<Record<CategoriaDaHabilidade, string>> = {
  simples: 'Ataque Simples',
  completo: 'Ataque Completo',
  overload: 'Overload',
  apoio: 'Apoio',
  reacao: 'Reação',
  passiva: 'Passiva',
  manter: 'Ligar e manter',
}

function ehOutraAcao(acao: AcaoDaMecanica): boolean {
  return acao === 'bonus' || acao === 'livre' || acao === 'perguntar'
}

/** A passiva e o "Ligar e manter" não batem: quem volta deles a uma categoria de golpe passa antes pela vez. */
function semUsoNovo(mecanica: MecanicaV1): MecanicaV1 {
  return mecanica.uso === 'passiva' || mecanica.uso === 'manter' ? trocarUso(mecanica, 'ativa') : mecanica
}

/** A mecânica na categoria escolhida: os usos da versão 5 por `trocarUso`, o resto pelo caminho de sempre. */
function mecanicaNaHabilidade(mecanica: MecanicaV1, nova: CategoriaDaHabilidade, testeAntes: Teste | null): MecanicaV1 {
  if (nova === 'passiva' || nova === 'manter') return trocarUso(mecanica, nova)
  return mecanicaNaCategoria(semUsoNovo(mecanica), nova, testeAntes)
}

/** Por que a categoria não pode ser escolhida agora; a passiva e o "Ligar e manter" sempre podem (as peças avisam, cada uma na sua moldura). */
function motivoDaHabilidade(mecanica: MecanicaV1, opcao: CategoriaDaHabilidade): string | null {
  if (opcao === 'passiva' || opcao === 'manter') return null
  return motivoDaCategoria(semUsoNovo(mecanica), opcao)
}

/**
 * LINHA AÇÃO (EDITOR.md §3.3, protótipo `htmlAcao`; rework das habilidades D6, D7, decisão 9): os sete
 * cartões em dois grupos, rádio de verdade por baixo (setas e Espaço como o sistema). A Passiva agora
 * monta peças e entra o "Ligar e manter". Bônus, Livre e "perguntar" ficam atrás do link discreto,
 * porque fichas de hoje usam. A troca que tira o dano ou um efeito avisa, e o Ctrl+Z devolve.
 */
export function LinhaDaAcao({ mecanica, onChange }: { mecanica: MecanicaV1; onChange: MudarNoEditor }) {
  const nome = useId()
  const categoria = categoriaDaHabilidade(mecanica)
  // O teste de antes da Overload, para voltar a ele quando ela sai (a Overload trava em "não erra").
  const testeAntes = useRef<Teste | null>(null)
  const [outraAcaoAberta, setOutraAcaoAberta] = useState(false)
  const comForma = (mecanica.pecas ?? []).some((peca) => peca.tipo === 'transformacao')

  const escolher = (nova: CategoriaDaHabilidade) => {
    if (nova === 'overload') testeAntes.current = mecanica.teste
    const depois = mecanicaNaHabilidade(mecanica, nova, testeAntes.current)
    const saiu = oQueSaiu(mecanica, depois)
    onChange(depois, saiu === null ? undefined : `${NOME_NO_AVISO[nova]}: ${saiu}.`)
  }

  const cartao = (opcao: CartaoDaCategoria) => {
    const motivo = motivoDaHabilidade(mecanica, opcao.valor)
    const marcado = opcao.valor === categoria
    return (
      <label key={opcao.valor} className="lb-ed__opc" data-overload={opcao.valor === 'overload' ? '' : undefined} data-bloqueada={motivo !== null ? '' : undefined} title={motivo ?? undefined}>
        <input className="lb-sr-only" type="radio" name={nome} value={opcao.valor} checked={marcado} disabled={motivo !== null} onChange={() => escolher(opcao.valor)} />
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
      {(categoria === 'apoio' || categoria === 'manter') && <Escolha<AcaoDaMecanica> legenda={categoria === 'manter' ? 'Ligar gasta' : 'Gasta'} opcoes={ACOES} valor={mecanica.acao} onChange={(acao) => onChange({ ...mecanica, acao })} />}
      {categoria === 'manter' && <p className="lb-ed__dica">Fica ligada até desligar. &quot;Livre&quot; liga sem gastar ação, como na aba Transformações; o custo a cada vez, se houver, fica em Custo.</p>}
      {categoria === 'passiva' && <p className="lb-ed__dica">Não tem botão de usar: vale sozinha. O que ela faz vem das peças (Dispara sozinha, Passiva de raça).</p>}
      {categoria === 'reacao' && (
        <Escolha<Exclude<UsoDaMecanica, 'ativa' | 'passiva' | 'manter'>>
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
          {comForma
            ? 'Overload de transformação: liga como ação Livre no começo da vez e já age; vale 1 vez por batalha. Quanto dura, as ações a mais e a Fadiga ficam na peça Transformação.'
            : 'Overload gasta a vez inteira, vale 1 vez por batalha e o alvo não reage (só outra Overload defende). Acerto e Custo seguem isso.'}
        </p>
      )}
    </>
  )
}

/** As categorias que não batem: sem Golpe, Alcance, Dano nem Acerto no editor (a passiva, o "Ligar e manter" e a forma Overload). */
export function semGolpeNaTela(mecanica: MecanicaV1): boolean {
  const categoria: CategoriaDaHabilidade = categoriaDaHabilidade(mecanica)
  if (categoria === 'passiva' || categoria === 'manter') return true
  return categoria === 'overload' && (mecanica.pecas ?? []).some((peca) => peca.tipo === 'transformacao')
}
