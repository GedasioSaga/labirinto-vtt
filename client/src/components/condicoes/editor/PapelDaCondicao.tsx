import type { MouseEvent } from 'react'
import { avisosDe, frasesDoCartao, naBatalha, prazoCurto, type ContextoDasFrases, type FraseDaCondicao, type LinhaDoCartao } from '../../../lib/condicoes/frasesDaCondicao'
import { tetoDePilhasDo, type CondicaoMontada } from '../../../lib/condicoes/modelo'
import type { ConditionSymbol } from '../../../lib/tokenConditions'
import { PastilhaDeCondicao } from '../../PastilhaDeCondicao'
import './editor.css'

/**
 * O CARTÃO DA CONDIÇÃO (rework das condições, PLANO.md E6; `renderPapel` do protótipo, prototipo.html:858):
 * a pastilha, o nome, o que ela faz (as frases que as peças escrevem, `frasesDoCartao`), o que aparece na
 * batalha (`naBatalha`), os avisos (`avisosDe`) e os números (tipo, prazo, pilhas, peças). É o mesmo no
 * editor (clicável: a linha leva até a seção que a escreve) e no lado de Livros › Condições (só leitura).
 * Nada aqui se digita: o texto se escreve sozinho (uma coisa, um lugar).
 */

/** Para onde a linha do cartão leva no editor: uma peça (pelo índice) ou uma seção. */
export type AlvoDoPapel = { tipo: 'peca'; indice: number } | { tipo: 'secao'; secao: 'identidade' | 'pecas' | 'prazo' }

/** O alvo de cada linha: a peça vai à peça; o prazo, as saídas e quem a apaga moram na seção do prazo. */
export function alvoDaLinha(linha: LinhaDoCartao): AlvoDoPapel {
  switch (linha.de) {
    case 'peca':
      return { tipo: 'peca', indice: linha.indice }
    case 'semPeca':
      return { tipo: 'secao', secao: 'pecas' }
    case 'mapa':
      return { tipo: 'secao', secao: 'identidade' }
    case 'prazo':
    case 'saida':
    case 'apagadaPor':
      return { tipo: 'secao', secao: 'prazo' }
  }
}

/** Uma frase das peças na tela: o texto corrido e os pedaços pintados (dano, cura, gasto, o nome de outra condição). */
export function FraseNaTela({ frase }: { frase: FraseDaCondicao }) {
  return (
    <>
      {frase.map((pedaco, indice) =>
        pedaco.tinta === undefined ? (
          <span key={indice}>{pedaco.texto}</span>
        ) : (
          <b key={indice} className="lb-cde-tinta" data-tinta={pedaco.tinta}>
            {pedaco.texto}
          </b>
        ),
      )}
    </>
  )
}

/** A família da linha (a cor do fio); o prazo, as saídas e o resto usam a cor neutra. */
function familiaDaLinha(linha: LinhaDoCartao): string {
  return linha.de === 'peca' ? linha.familia : linha.de
}

/** O olho do "o que aparece na batalha" e o triângulo do aviso: decorativos, o texto vai junto. */
function Icone({ nome }: { nome: 'olho' | 'aviso' }) {
  return (
    <svg className="lb-cde-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {nome === 'olho' ? (
        <>
          <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
          <circle cx="12" cy="12" r="2.8" />
        </>
      ) : (
        <>
          <path d="M12 3.5 21.5 20h-19z" />
          <path d="M12 10v4.5M12 17.2v.3" />
        </>
      )}
    </svg>
  )
}

export interface PapelDaCondicaoProps {
  condicao: CondicaoMontada
  /** A pastilha que o mapa desenha (a de fábrica pelo id, a criada pela cor e o desenho). */
  pastilha: ConditionSymbol
  /** O catálogo em volta: os nomes das outras, quem apaga esta e o nome repetido. */
  contexto: ContextoDasFrases
  deFabrica: boolean
  /** No editor: a linha vira botão e leva até a seção. Ausente = só leitura (o lado da lista). */
  aoIr?: (alvo: AlvoDoPapel, porTeclado: boolean) => void
  /** O que a leitura não entendeu (`CondicaoPropria.confira`): aparece como aviso no topo do cartão. */
  confira?: string
}

export function PapelDaCondicao({ condicao, pastilha, contexto, deFabrica, aoIr, confira }: PapelDaCondicaoProps) {
  const linhas = frasesDoCartao(condicao, contexto)
  const naLuta = naBatalha(condicao)
  const avisos = avisosDe(condicao, contexto)
  const nome = condicao.nome.trim() || 'Sem nome'
  const positiva = condicao.tipo === 'positiva'
  const pilhas = condicao.prazo.deNovo === 'pilha' ? `até ${tetoDePilhasDo(condicao.prazo)}` : 'não soma'
  const numeros: readonly (readonly [string, string])[] = [
    ['Tipo', positiva ? 'Positiva' : 'Negativa'],
    ['Prazo', prazoCurto(condicao.prazo)],
    ['Pilhas', pilhas],
    ['Peças', String(condicao.pecas.length)],
  ]
  // O clique do mouse rola macio; o Enter e o Espaço (clique com detail 0) vão na hora: movimento iniciado pelo teclado não anima.
  const ir = (linha: LinhaDoCartao) => (evento: MouseEvent<HTMLButtonElement>) => aoIr?.(alvoDaLinha(linha), evento.detail === 0)
  return (
    <article className="lb-cde-papel" aria-label={`Cartão de ${nome}`}>
      <div className="lb-cde-papel__topo">
        <PastilhaDeCondicao symbol={pastilha} tamanho={48} />
        <div className="lb-cde-papel__nomes">
          <h3 className="lb-cde-papel__nome">{nome}</h3>
          <p className="lb-cde-papel__tipo">
            {positiva ? 'Condição positiva' : 'Condição negativa'}
            {deFabrica ? ', de fábrica' : ''}
          </p>
        </div>
      </div>
      {confira !== undefined && (
        <p className="lb-cde-papel__confira" role="note">
          <Icone nome="aviso" />
          <span>Confira: {confira}</span>
        </p>
      )}
      <p className="lb-cde-papel__rot">O que acontece (escrito pelas peças)</p>
      <ul className="lb-cde-acontece">
        {linhas.map((linha, indice) => (
          <li key={indice} className="lb-cde-acontece__item" data-familia={familiaDaLinha(linha)}>
            {aoIr === undefined ? (
              <span className="lb-cde-acontece__linha">
                <FraseNaTela frase={linha.frase} />
              </span>
            ) : (
              <button type="button" className="lb-cde-acontece__linha" onClick={ir(linha)}>
                <FraseNaTela frase={linha.frase} />
              </button>
            )}
          </li>
        ))}
      </ul>
      <ul className="lb-cde-nota-lista" aria-label="O que aparece na batalha">
        {naLuta.map((texto) => (
          <li key={texto}>
            <Icone nome="olho" />
            <span>{texto}</span>
          </li>
        ))}
      </ul>
      {avisos.length > 0 && (
        <ul className="lb-cde-nota-lista lb-cde-nota-lista--aviso" aria-label="Avisos">
          {avisos.map((aviso) => (
            <li key={aviso.texto} data-impede={aviso.impedeSalvar ? '' : undefined}>
              <Icone nome="aviso" />
              <span>{aviso.texto}</span>
            </li>
          ))}
        </ul>
      )}
      <dl className="lb-cde-papel__numeros">
        {numeros.map(([rotulo, valor]) => (
          <div key={rotulo}>
            <dt>{rotulo}</dt>
            <dd>{valor}</dd>
          </div>
        ))}
      </dl>
    </article>
  )
}
