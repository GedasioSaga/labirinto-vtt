import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
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
}

/** Aberto: só abrir, ou abrir já fazendo algo (montar, escolher o modelo, escrever o nome). */
type Aberto = AoAbrirOEditor | 'so'

/**
 * A técnica que, para quem edita, ainda é só texto: sem mecânica e (o dono) sem proposta dele. Ela
 * abre pelo papel e pelo "Montar no editor"; o texto antigo fica embaixo, recolhido.
 */
function abreComoTexto(cartao: CartaoDaFicha, quemEdita: QuemEditaNoEditor): boolean {
  if (lerMecanica(cartao.mecanica).tipo !== 'nenhuma') return false
  return quemEdita !== 'dono' || lerMecanica(cartao.mecanicaProposta).tipo === 'nenhuma'
}

/** O título e a frase sem peças de cada coisa (a técnica de texto, a arma só com o dano, o item só de descrição). */
const NA_TELA: Readonly<Record<DoQueNoEditor, { titulo: string; semPecas: string; aria: string }>> = {
  tecnica: { titulo: 'Mecânica', semPecas: 'Só texto: o app lê o Custo, a Ação e o Dano escritos.', aria: 'Mecânica e requisitos' },
  arma: { titulo: 'O que ela faz', semPecas: 'Sem mecânica, o Atacar usa só o dano da arma.', aria: 'O que a arma faz e requisitos' },
  item: { titulo: 'O que ele faz', semPecas: 'Sem efeito, o item é só descrição (o mestre narra).', aria: 'O que o item faz e requisitos' },
}

/**
 * A HABILIDADE NO CARTÃO (ED5; ED7 também a arma e o item): o resumo do que ela faz e pede, e o
 * botão que abre o editor da habilidade (EDITOR.md §5). O editor carrega só ao abrir. Na ficha, no
 * livro (a entrada de habilidade e de arma) e no Acervo (o efeito do item), pela mesma porta.
 */
export function HabilidadeNaFicha({ cartao, ficha, quemEdita, tecnicas, podeOcultar, onChange, doQue = 'tecnica', foraDaFicha = false, trilha, gastoDoItem, onModelo, abrirAoNascer = false }: HabilidadeNaFichaProps) {
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
      />
    </Suspense>
  )
  const requisitosNaTela = requisitos.map((secao) => (
    <p key={secao.titulo} className="lb-field__hint">
      <b>{secao.titulo}:</b> {secao.linhas.join('; ')}.
    </p>
  ))
  // O mestre vê a proposta do dono antes de montar por cima dela.
  const vemDoDono = proposta !== null && quemEdita === 'mestre'
  const conteudo =
    doQue === 'tecnica' && abreComoTexto(cartao, quemEdita) ? (
      <section className="lb-edf" aria-label="Habilidade só de texto">
        <div className="lb-edf__cab">
          <span className="lb-edf__selo">Só texto</span>
          <span className="lb-edf__dica">a batalha lê a Ação, o Custo e o Dano escritos</span>
        </div>
        <PapelDoCartao cartao={cartao} linhaCurta={linhaDoTexto(cartao)} frase={fraseDoTexto(cartao)} nomeComoTitulo={false} />
        {vemDoDono && (
          <p className="lb-mec__aviso" role="status">
            O dono da ficha propôs uma mecânica: veja no editor para aceitar ou recusar.
          </p>
        )}
        <div className="lb-edf__acoes">
          {vemDoDono && (
            <button type="button" className="lb-ed__bt lb-ed__bt--primario" onClick={() => setAberto('so')}>
              Ver a proposta
            </button>
          )}
          <button type="button" className={`lb-ed__bt ${vemDoDono ? 'lb-ed__bt--latao' : 'lb-ed__bt--primario'}`} onClick={() => setAberto('montar')}>
            Montar no editor
          </button>
          <button type="button" className="lb-ed__bt lb-ed__bt--latao" onClick={() => setAberto('modelo')}>
            Começar de um modelo
          </button>
          {!vemDoDono && (
            <button type="button" className="lb-ed__bt lb-ed__bt--fantasma" onClick={() => setAberto('so')}>
              Abrir sem montar
            </button>
          )}
        </div>
        <p className="lb-edf__dica">
          {quemEdita === 'dono'
            ? 'Montar vira uma proposta: vai ao mestre quando você salvar a ficha, e o texto vale até ele aceitar.'
            : 'Montar lê o que está escrito e monta as peças. O texto de agora fica guardado; o Desmontar o devolve.'}
        </p>
        {requisitosNaTela}
      </section>
    ) : (
      <section className="lb-mec" aria-label={textos.aria}>
        <div className="lb-mec__cab">
          <h5 className="lb-label lb-mec__titulo">{textos.titulo}</h5>
          {!montada && <span className="lb-mec__cab-dica">{textos.semPecas}</span>}
        </div>
        {valendo.tipo === 'pecas' && <ResumoDaMecanica mecanica={valendo.mecanica} ficha={ficha} titulo={proposta !== null ? 'Vale agora' : undefined} />}
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
        </div>
      </section>
    )
  // O editor fica fora do bloco, num lugar fixo: montar troca o bloco (de texto para peças) e a janela segue aberta.
  return (
    <>
      {conteudo}
      {editor}
    </>
  )
}
