import { lazy, Suspense, useId, useMemo, type MouseEvent } from 'react'
import type { MecanicaV1 } from '../../../lib/batalha/mecanica/modelo'
import type { FichaDaPrevia } from '../../../lib/batalha/mecanica/resumo'
import type { CartaoDaFicha } from '../../../lib/personagem'
import { TestarDoAlcance } from '../alcance/TestarDoAlcance'
import { armaTemCampoDeEfeito, pedacosDoPapel, textoDoCartao } from '../../../lib/batalha/mecanica/textoGerado'
import type { GrupoDoAlcance } from '../../../lib/batalha/alcance/condicoes'
import { CAMPO_DO_EFEITO } from '../../../lib/batalha/leituraDaFicha'
import type { SistemaDeRpg } from '../../../lib/sistemaDeRpg'
import { linhaCurtaDoPapel, type IdDaLinha } from './fraseDoPapel'
import type { DoQueNoEditor } from './gravarNoCartao'
import type { GastoDoItem } from './linhas/LinhaDoGasto'
import { ancoraDaLinha } from './Linha'
import { fraseDoTexto, PapelDoCartao } from './PapelDoCartao'

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

/** ED7: os campos que o app escreve em cada coisa. A arma só tem o Efeito (o dano dela é o escrito); o item não tem campo de texto (a vaga mostra a frase do efeito). */
function camposQueOAppEscreve(doQue: DoQueNoEditor, sistema: SistemaDeRpg): readonly { chave: string; nome: string }[] {
  if (doQue === 'tecnica') return CAMPOS_DE_TEXTO
  if (doQue === 'arma' && armaTemCampoDeEfeito(sistema)) return CAMPOS_DE_TEXTO.filter(({ chave }) => chave === CAMPO_DO_EFEITO)
  return []
}

/** O grupo do mapa do alcance (a cor e a legenda de cada coisa). */
const GRUPO_DO_ALCANCE: Readonly<Record<DoQueNoEditor, GrupoDoAlcance>> = { tecnica: 'habilidades', arma: 'armas', item: 'itens' }

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
  /** ED7: a arma testa pelo Atacar com ela; o item termina no gasto. */
  doQue: DoQueNoEditor
  /** Só no item: quanto e onde gasta (o Testar mostra o gasto). */
  gastoDoItem?: GastoDoItem
}

/**
 * A COLUNA DO PAPEL do editor novo (ED3; EDITOR.md §5, protótipo `htmlVer`):
 * como fica no cartão (a frase em pedaços que levam à linha), o que vai aos
 * campos de texto, o alcance no mapa 13x13 e o Testar no boneco, vivos.
 */
export function ColunaDoPapel({ cartao, mecanica, ficha, prefixo, onIr, doQue, gastoDoItem }: ColunaDoPapelProps) {
  const tituloId = useId()
  const pedacos = useMemo(() => (mecanica === null ? null : pedacosDoPapel(mecanica, ficha)), [mecanica, ficha])
  const linhaCurta = useMemo(() => (mecanica === null ? 'Ainda sem peças: a batalha lê o texto de antes' : linhaCurtaDoPapel(mecanica, ficha)), [mecanica, ficha])
  // Os valores vêm de uma fonte só (`textoDoCartao`): o mesmo que o Salvar grava nos campos da técnica montada.
  const gerado = useMemo<Readonly<Record<string, string>> | null>(() => (mecanica === null ? null : textoDoCartao(mecanica, ficha.sistema)), [mecanica, ficha.sistema])
  const campos = camposQueOAppEscreve(doQue, ficha.sistema)
  const noItem = doQue === 'item' ? { gasta: gastoDoItem?.gasta ?? 'um', onde: gastoDoItem?.onde ?? 'sempre', quantos: 1 } : undefined
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
        <PapelDoCartao
          cartao={cartao}
          linhaCurta={linhaCurta}
          frase={
            pedacos === null
              ? fraseDoTexto(cartao)
              : pedacos.map((pedaco, indice) =>
                  pedaco.linha === undefined ? (
                    <span key={indice} title={pedaco.titulo}>{pedaco.texto}</span>
                  ) : (
                    <a key={indice} className="lb-ed__pedaco" href={`#${ancoraDaLinha(prefixo, pedaco.linha)}`} data-cor={pedaco.cor} title={pedaco.titulo} onClick={irPara(pedaco.linha)}>
                      {pedaco.texto}
                    </a>
                  ),
                )
          }
        />
        {/* ED2: o que o app escreve nos campos de texto, das escolhas (o app de antes e o site do Lobby leem estes). Só leitura, de propósito. */}
        {gerado !== null && campos.length > 0 && (
          <details className="lb-ed__textos">
            <summary>O que o app escreve nos campos de texto</summary>
            <p className="lb-ed__dica">O app escreve sozinho a partir das escolhas, e não dá para editar aqui, para nunca dizerem outra coisa. O app de antes e o site do Lobby leem estes campos.</p>
            <dl>
              {campos.map(({ chave, nome }) => (
                <div key={chave} className="lb-ed__texto">
                  <dt>{nome}</dt>
                  <dd>{(gerado[chave] ?? '').trim() || '—'}</dd>
                </div>
              ))}
            </dl>
          </details>
        )}
      </section>

      {mecanica?.uso !== 'reacao' && (
        <div className="lb-ed__ver-bloco">
          <TestarDoAlcance cartao={cartao} quemUsa={ficha.personagem} sistema={ficha.sistema} grupo={GRUPO_DO_ALCANCE[doQue]} />
        </div>
      )}

      <div className="lb-ed__ver-bloco">
        <Suspense fallback={<p className="lb-ed__dica">Preparando o boneco de treino…</p>}>
          <PainelDeEnsaio cartao={cartao} quemUsa={ficha.personagem} sistema={ficha.sistema} embutido semAlcance semSorte={doQue === 'tecnica'} naArma={doQue === 'arma'} {...(noItem === undefined ? {} : { item: noItem })} />
        </Suspense>
      </div>
    </>
  )
}
