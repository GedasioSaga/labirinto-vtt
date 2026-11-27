import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import type { RelatorioDoCartao } from '../../../lib/batalha/mecanica/conversao/comum'
import { lerMecanica } from '../../../lib/batalha/mecanica/modelo'
import type { FichaDaPrevia } from '../../../lib/batalha/mecanica/resumo'
import { frasesDosRequisitos } from '../../../lib/batalha/requisitos/frases'
import { lerRequisitos } from '../../../lib/batalha/requisitos/ler'
import type { CartaoDaFicha } from '../../../lib/personagem'
import { ResumoDaMecanica } from '../MecanicaDaTecnica'
import type { AoAbrirOEditor } from './EditorDaHabilidade'
import type { DoQueNoEditor, QuemEditaNoEditor } from './gravarNoCartao'
import type { GastoDoItem } from './linhas/LinhaDoGasto'
import type { ModeloNoEditor } from './modelosDoEditor'
import { fraseDoTexto, linhaDoTexto, PapelDoCartao } from './PapelDoCartao'
import '../MecanicaDaTecnica.css'
import '../combate.css'
import './editor.css'

const EditorDaHabilidade = lazy(() => import('./EditorDaHabilidade').then((modulo) => ({ default: modulo.EditorDaHabilidade })))

interface HabilidadeNaFichaProps {
  cartao: CartaoDaFicha
  ficha: FichaDaPrevia
  quemEdita: QuemEditaNoEditor
  tecnicas: readonly CartaoDaFicha[]
  podeOcultar: boolean
  onChange: (cartao: CartaoDaFicha) => void
  /** ED7: a técnica, a arma ou o efeito do item; ausente = a técnica. */
  doQue?: DoQueNoEditor
  /** ED7: no livro ou no Acervo (o cartão é de mentira, só leva a regra ao editor). */
  foraDaFicha?: boolean
  /** ED7: onde a regra vale, no cabeçalho do editor. */
  trilha?: string
  /** Só no item: quanto e onde gasta. */
  gastoDoItem?: { gasto: GastoDoItem; onChange: (gasto: GastoDoItem) => void }
  /** Só no item: o modelo escolhido, antes da mudança das peças. */
  onModelo?: (modelo: ModeloNoEditor) => void
  /** A habilidade que acabou de nascer em branco ("+ Habilidade"): o editor abre sozinho, com o foco no Nome. */
  abrirAoNascer?: boolean
  /** Rework D14: a aba do cartão (a conversão de leitura lê a forma pela aba); ausente = Habilidades. */
  abaDoCartao?: string
  /** Rework D14: o relatório da conversão da ficha (o porquê de a habilidade de antes ter ficado no texto). */
  relatorio?: readonly RelatorioDoCartao[]
  /** Rework D14: com ele, o Salvar do editor oferece "Guardar também no catálogo do livro". */
  guardarNoCatalogo?: (cartao: CartaoDaFicha) => void
  /** Rework D8: a peça grava a ligação no requisito de outro cartão da ficha. */
  aoMudarOutroCartao?: (cartao: CartaoDaFicha) => void
}

/** Aberto: só abrir, ou abrir já fazendo algo (escolher o modelo, escrever o nome). */
type Aberto = AoAbrirOEditor | 'so'

/** O título e a frase sem peças de cada coisa (a técnica de antes, a arma só com o dano, o item só de descrição). */
const NA_TELA: Readonly<Record<DoQueNoEditor, { titulo: string; semPecas: string; aria: string }>> = {
  tecnica: { titulo: 'Mecânica', semPecas: 'Ainda sem peças: a batalha lê a Ação, o Custo e o Dano escritos.', aria: 'Mecânica e requisitos' },
  arma: { titulo: 'O que ela faz', semPecas: 'Sem mecânica, o Atacar usa só o dano da arma.', aria: 'O que a arma faz e requisitos' },
  item: { titulo: 'O que ele faz', semPecas: 'Sem efeito, o item é só descrição (o mestre narra).', aria: 'O que o item faz e requisitos' },
}

/**
 * A HABILIDADE NO CARTÃO (ED5; ED7 também a arma e o item; rework D14): o resumo do que ela faz e
 * pede, e o botão que abre o editor da habilidade, o único (EDITOR.md §5). O editor carrega só ao
 * abrir. A técnica de antes, sem peças, mostra o papel do texto e abre já convertida (D11). Na ficha,
 * no livro (a entrada de habilidade e de arma) e no Acervo (o efeito do item), pela mesma porta.
 */
export function HabilidadeNaFicha({ cartao, ficha, quemEdita, tecnicas, podeOcultar, onChange, doQue = 'tecnica', foraDaFicha = false, trilha, gastoDoItem, onModelo, abrirAoNascer = false, abaDoCartao, relatorio, guardarNoCatalogo, aoMudarOutroCartao }: HabilidadeNaFichaProps) {
  const [aberto, setAberto] = useState<Aberto | null>(() => (abrirAoNascer ? 'nome' : null))
  const fechar = useCallback(() => setAberto(null), [])
  const valendo = lerMecanica(cartao.mecanica)
  const proposta = cartao.mecanicaProposta === undefined ? null : lerMecanica(cartao.mecanicaProposta)
  const requisitos = useMemo(() => {
    const lidos = lerRequisitos(cartao.requisitos)
    return lidos.bloco === null ? [] : frasesDosRequisitos(lidos.bloco, false, true)
  }, [cartao.requisitos])
  const futura = valendo.tipo === 'futura' || (quemEdita === 'dono' && proposta?.tipo === 'futura')
  const montada = valendo.tipo === 'pecas'
  // A técnica de antes: sem mecânica que vale e, para o dono, sem proposta dele.
  const deAntes = doQue === 'tecnica' && valendo.tipo === 'nenhuma' && (quemEdita !== 'dono' || proposta === null || proposta.tipo === 'nenhuma')
  const textos = NA_TELA[doQue]
  const editor = aberto !== null && (
    <Suspense fallback={null}>
      <EditorDaHabilidade
        cartao={cartao}
        ficha={ficha}
        quemEdita={quemEdita}
        tecnicas={tecnicas}
        podeOcultar={podeOcultar}
        onChange={onChange}
        onFechar={fechar}
        doQue={doQue}
        foraDaFicha={foraDaFicha}
        {...(aberto === 'so' ? {} : { aoAbrir: aberto })}
        {...(trilha === undefined ? {} : { trilha })}
        {...(gastoDoItem === undefined ? {} : { gastoDoItem })}
        {...(onModelo === undefined ? {} : { onModelo })}
        {...(abaDoCartao === undefined ? {} : { abaDoCartao })}
        {...(relatorio === undefined ? {} : { relatorio })}
        {...(guardarNoCatalogo === undefined ? {} : { guardarNoCatalogo })}
        {...(aoMudarOutroCartao === undefined ? {} : { aoMudarOutroCartao })}
      />
    </Suspense>
  )
  const requisitosNaTela = requisitos.map((secao) => (
    <p key={secao.titulo} className="lb-field__hint">
      <b>{secao.titulo}:</b> {secao.linhas.join('; ')}.
    </p>
  ))
  const conteudo = (
    <section className="lb-mec" aria-label={textos.aria}>
      <div className="lb-mec__cab">
        <h5 className="lb-label lb-mec__titulo">{textos.titulo}</h5>
        {!montada && <span className="lb-mec__cab-dica">{textos.semPecas}</span>}
      </div>
      {valendo.tipo === 'pecas' && <ResumoDaMecanica mecanica={valendo.mecanica} ficha={ficha} titulo={proposta !== null ? 'Vale agora' : undefined} />}
      {deAntes && <PapelDoCartao cartao={cartao} linhaCurta={linhaDoTexto(cartao)} frase={fraseDoTexto(cartao)} nomeComoTitulo={false} />}
      {(valendo.tipo === 'invalida' || valendo.tipo === 'futura') && (
        <p className="lb-mec__aviso" role="note">
          {valendo.tipo === 'futura' ? 'Mecânica de um app mais novo: atualize o app para editar.' : `Mecânica que não se lê: ${valendo.motivo}. O editor troca por um modelo.`}
        </p>
      )}
      {proposta !== null && (
        <p className="lb-mec__aviso" role="status">
          {quemEdita === 'mestre' ? 'O dono da ficha propôs uma mecânica: abra o editor para aceitar ou recusar.' : 'Sua proposta espera o mestre. Até ele aceitar, vale o que está acima.'}
        </p>
      )}
      {requisitosNaTela}
      <div className="lb-mec__acoes">
        <button type="button" className="lb-btn lb-btn--compact" disabled={futura} title={futura ? 'Feita num app mais novo: atualize o app para editar' : undefined} onClick={() => setAberto('so')}>
          {quemEdita === 'dono' ? 'Abrir o editor (vai ao mestre)' : 'Abrir o editor'}
        </button>
        {deAntes && (
          <button type="button" className="lb-btn lb-btn--compact lb-btn--ghost" onClick={() => setAberto('modelo')}>
            Começar de um modelo
          </button>
        )}
      </div>
      {deAntes && (
        <p className="lb-field__hint">
          {quemEdita === 'dono'
            ? 'O que você montar no editor vira uma proposta: vai ao mestre quando você salvar a ficha, e o texto vale até ele aceitar.'
            : 'O editor abre com as peças que ele entende do texto; o texto de antes fica guardado em Campos extras.'}
        </p>
      )}
    </section>
  )
  // O editor fica fora do bloco, num lugar fixo: a conversão troca o bloco (de texto para peças) e a janela segue aberta.
  return (
    <>
      {conteudo}
      {editor}
    </>
  )
}
