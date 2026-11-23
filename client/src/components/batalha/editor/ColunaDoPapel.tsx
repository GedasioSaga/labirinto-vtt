import { lazy, Suspense, useId, useMemo, type MouseEvent } from 'react'
import type { MecanicaV1 } from '../../../lib/batalha/mecanica/modelo'
import type { FichaDaPrevia } from '../../../lib/batalha/mecanica/resumo'
import type { CartaoDaFicha } from '../../../lib/personagem'
import { TestarDoAlcance } from '../alcance/TestarDoAlcance'
import { linhaCurtaDoPapel, pedacosDaFrase, type IdDaLinha } from './fraseDoPapel'
import { ancoraDaLinha } from './Linha'

/** O Testar pesa o motor da batalha inteiro: só carrega com o editor aberto (como na fachada de hoje). */
const PainelDeEnsaio = lazy(() => import('../../ensaio/PainelDeEnsaio').then((modulo) => ({ default: modulo.PainelDeEnsaio })))

/** Os campos de texto do cartão de hoje, na ordem do protótipo ("O que o app escreve nos campos de texto"). */
const CAMPOS_DE_TEXTO: readonly { chave: string; nome: string }[] = [
  { chave: 'acao', nome: 'Ação' },
  { chave: 'tipo', nome: 'Tipo' },
  { chave: 'efeito', nome: 'Efeito' },
  { chave: 'custo', nome: 'Custo' },
  { chave: 'tempo', nome: 'Tempo' },
  { chave: 'dano', nome: 'Dano' },
]

interface ColunaDoPapelProps {
  /** O cartão da tela: o rascunho completo no lugar da mecânica que vale (o mesmo que o Testar roda). */
  cartao: CartaoDaFicha
  /** A mecânica do rascunho; `null` = o cartão é só texto. */
  mecanica: MecanicaV1 | null
  ficha: FichaDaPrevia
  /** O prefixo das âncoras das linhas do editor. */
  prefixo: string
  /** `porTeclado`: o Enter no pedaço (sem rolagem suave). */
  onIr: (linha: IdDaLinha, porTeclado: boolean) => void
}

/**
 * A COLUNA DO PAPEL do editor novo (ED3; EDITOR.md §5, protótipo `htmlVer`):
 * como fica no cartão (a frase em pedaços que levam à linha), o que vai aos
 * campos de texto, o alcance no mapa 13x13 e o Testar no boneco, vivos.
 */
export function ColunaDoPapel({ cartao, mecanica, ficha, prefixo, onIr }: ColunaDoPapelProps) {
  const tituloId = useId()
  const pedacos = useMemo(() => (mecanica === null ? null : pedacosDaFrase(mecanica, ficha)), [mecanica, ficha])
  const linhaCurta = useMemo(() => (mecanica === null ? 'Só texto: a batalha lê os campos escritos' : linhaCurtaDoPapel(mecanica, ficha)), [mecanica, ficha])
  const descricao = (cartao.campos.descricao ?? '').trim()
  const irPara = (linha: IdDaLinha) => (evento: MouseEvent<HTMLAnchorElement>) => {
    evento.preventDefault()
    // O clique do teclado (Enter num link) chega com detail 0.
    onIr(linha, evento.detail === 0)
  }

  return (
    <>
      <section className="lb-ed__ver-bloco" aria-labelledby={tituloId}>
        <div className="lb-ed__ver-tit">
          <h2 id={tituloId}>Como fica no cartão</h2>
          {pedacos !== null && <span className="lb-ed__dica">clique num pedaço para mudar</span>}
        </div>
        <article className="lb-ed__papel">
          <h3 className="lb-ed__papel-nome">{cartao.nome.trim() || 'Sem nome'}</h3>
          <p className="lb-ed__papel-linha">{linhaCurta}</p>
          <p className="lb-ed__papel-frase">
            {pedacos === null
              ? (cartao.campos.efeito ?? '').trim() || 'Sem efeito escrito.'
              : pedacos.map((pedaco, indice) =>
                  pedaco.linha === undefined ? (
                    <span key={indice}>{pedaco.texto}</span>
                  ) : (
                    <a key={indice} className="lb-ed__pedaco" href={`#${ancoraDaLinha(prefixo, pedaco.linha)}`} data-cor={pedaco.cor} onClick={irPara(pedaco.linha)}>
                      {pedaco.texto}
                    </a>
                  ),
                )}
          </p>
          {descricao !== '' && <p className="lb-ed__papel-desc">{descricao}</p>}
          {cartao.extras.length > 0 && (
            <div className="lb-ed__papel-extras">
              {cartao.extras.map((extra, indice) => (
                <span key={indice}>
                  <b>{extra.nome.trim() || '(sem nome)'}:</b> {extra.valor}
                </span>
              ))}
            </div>
          )}
        </article>
        {/* ED2 (texto gerado): aqui entram os campos que o app escreve das escolhas; até lá, o que o cartão guarda hoje. */}
        <details className="lb-ed__textos">
          <summary>O que o app escreve nos campos de texto</summary>
          <p className="lb-ed__dica">Por enquanto, o texto que o cartão guarda hoje. Com o texto gerado, o app escreve sozinho a partir das escolhas, e não dá para editar aqui, para nunca dizerem outra coisa.</p>
          <dl>
            {CAMPOS_DE_TEXTO.map(({ chave, nome }) => (
              <div key={chave} className="lb-ed__texto">
                <dt>{nome}</dt>
                <dd>{(cartao.campos[chave] ?? '').trim() || '—'}</dd>
              </div>
            ))}
          </dl>
        </details>
      </section>

      {mecanica?.uso !== 'reacao' && (
        <div className="lb-ed__ver-bloco">
          <TestarDoAlcance cartao={cartao} quemUsa={ficha.personagem} sistema={ficha.sistema} grupo="habilidades" />
        </div>
      )}

      <div className="lb-ed__ver-bloco">
        <Suspense fallback={<p className="lb-ed__dica">Preparando o boneco de treino…</p>}>
          <PainelDeEnsaio cartao={cartao} quemUsa={ficha.personagem} sistema={ficha.sistema} embutido semAlcance />
        </Suspense>
      </div>
    </>
  )
}
