import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import type { FotoDoPreludio } from '../../lib/preparo/importar/noPreludio'
import type { ItemDaLista, PlanoDeReimportacao } from '../../lib/preparo/importar/reimportar'
import type { ResultadoDaSimulacao } from '../../lib/preparo/importar/relatorio'
import { lerIndiceDasPastas, type PastaDeMapas } from '../../lib/pastasDeMapas'
import type { Campanha } from '../../lib/preparo/tipos'
import { LINHAS_DO_COFRE, TIPOS_DA_REIMPORTACAO, numero, textoDoCofre, textoDoEspaco } from './textosDaImportacao'

/** Uma simulação pronta para o mestre conferir: o cofre, a foto do Prelúdio que ela usou e as pastas escolhidas. */
export interface SessaoDaImportacao {
  readonly raiz: string
  /** A pasta das cópias de conflito comparadas; `null` = não comparadas. */
  readonly copias: string | null
  readonly foto: FotoDoPreludio
  readonly resultado: ResultadoDaSimulacao
  /** Campanha → pasta do Labirinto (`null` = sem pasta). */
  readonly pastas: ReadonlyMap<string, string | null>
}

export interface RelatorioDaImportacaoProps {
  sessao: SessaoDaImportacao
  confirmando: boolean
  onPasta: (campanhaId: string, pastaId: string | null) => void
  onCompararCopias: () => void
  onConfirmar: (confirmando: boolean) => void
  onAplicar: () => void
  onFechar: () => void
}

/** Listas compridas mostram o começo; o resto fica no relatório gravado. */
const ITENS_MOSTRADOS = 40

/** O relatório da simulação (plano §4, passo 5), a pasta de cada campanha (passo 8) e o "Aplicar" com confirmação (passo 6). */
export function RelatorioDaImportacao({ sessao, confirmando, onPasta, onCompararCopias, onConfirmar, onAplicar, onFechar }: RelatorioDaImportacaoProps) {
  const { relatorio, plano } = sessao.resultado
  const titulo = useRef<HTMLHeadingElement>(null)
  const botaoAplicar = useRef<HTMLButtonElement>(null)
  const estavaConfirmando = useRef(confirmando)
  const idDoCofre = useId()

  // O relatório chega no lugar do andamento: o foco vai para o título dele, e o leitor de tela anuncia.
  useEffect(() => {
    titulo.current?.focus()
  }, [])

  // Desistir da confirmação devolve o foco ao botão que a abriu.
  useEffect(() => {
    if (estavaConfirmando.current && !confirmando) botaoAplicar.current?.focus()
    estavaConfirmando.current = confirmando
  }, [confirmando])

  const campanhas = plano.indice.campanhas.filter((campanha) => campanha.origem?.grimorio !== undefined)
  return (
    <div className="pl-imp__relatorio">
      <h3 className="pl-imp__sub pl-imp__sub--alto" ref={titulo} tabIndex={-1}>
        Relatório da simulação
      </h3>
      <p className="pl-copia__texto">
        Cofre: <b className="pl-imp__caminho">{sessao.raiz}</b>
      </p>
      <p className={relatorio.cadaArquivoUmDestino ? 'pl-imp__selo' : 'pl-copia__aviso'}>{textoDoCofre(relatorio.cofre.arquivos, relatorio.cofre.bytes, relatorio.cadaArquivoUmDestino)}</p>

      <section className="pl-imp__parte" aria-labelledby={`${idDoCofre}-c`}>
        <h4 className="pl-imp__sub" id={`${idDoCofre}-c`}>
          No cofre
        </h4>
        <dl className="pl-imp__livro">
          {LINHAS_DO_COFRE.map(({ rotulo, chave }) => (
            <div className="pl-imp__linha" key={chave}>
              <dt>{rotulo}</dt>
              <dd>{numero(relatorio.contagens[chave])}</dd>
            </div>
          ))}
        </dl>
        <p className="pl-copia__dica">
          {numero(relatorio.contagens.imagensUnicas)} imagens diferentes vão para o Prelúdio: a repetida no cofre vira uma só.
        </p>
      </section>

      {relatorio.reimportacao !== null && <Reimportacao plano={relatorio.reimportacao} />}
      <CopiasDeConflito sessao={sessao} onComparar={onCompararCopias} />
      <Lista titulo="Avisos" itens={relatorio.avisos} />
      <Lista titulo="Não deu para ler" itens={relatorio.falhas.map((falha) => `${falha.caminho}: ${falha.motivo}`)} aberta />
      <p className="pl-copia__texto">{textoDoEspaco(relatorio.espaco)}</p>

      <PastasDasCampanhas campanhas={campanhas} pastas={sessao.pastas} onPasta={onPasta} />

      {relatorio.motivosParaNaoAplicar.length > 0 && (
        <div className="pl-copia__aviso" role="status">
          <p className="pl-imp__sem-margem">O Aplicar está travado:</p>
          <ul className="pl-imp__motivos">
            {relatorio.motivosParaNaoAplicar.map((motivo) => (
              <li key={motivo}>{motivo}</li>
            ))}
          </ul>
        </div>
      )}

      {confirmando ? (
        <Confirmacao sessao={sessao} onVoltar={() => onConfirmar(false)} onAplicar={onAplicar} />
      ) : (
        <div className="pl-copia__linha">
          <button ref={botaoAplicar} type="button" className="lb-btn lb-btn--primary" disabled={!relatorio.podeAplicar} onClick={() => onConfirmar(true)}>
            Aplicar a importação…
          </button>
          <button type="button" className="lb-btn lb-btn--ghost" onClick={onFechar}>
            Fechar o relatório
          </button>
        </div>
      )}
    </div>
  )
}

function Reimportacao({ plano }: { plano: PlanoDeReimportacao }) {
  const id = useId()
  const editados = TIPOS_DA_REIMPORTACAO.flatMap(({ chave }) => plano[chave].editadosNoPreludio)
  return (
    <section className="pl-imp__parte" aria-labelledby={id}>
      <h4 className="pl-imp__sub" id={id}>
        Desde a última importação
      </h4>
      <div className="pl-imp__rolagem">
        <table className="pl-imp__tabela">
          <thead>
            <tr>
              <th scope="col">No Prelúdio</th>
              <th scope="col">Novos</th>
              <th scope="col">Atualizar</th>
              <th scope="col">Iguais</th>
              <th scope="col">Editados</th>
              <th scope="col">Sumiu lá</th>
              <th scope="col">Apagados</th>
            </tr>
          </thead>
          <tbody>
            {TIPOS_DA_REIMPORTACAO.map(({ rotulo, chave }) => {
              const tipo = plano[chave]
              const contas = [tipo.novos.length, tipo.atualizar.length, tipo.iguais.length, tipo.editadosNoPreludio.length, tipo.sumiuLa.length, tipo.apagadosNoPreludio.length]
              return (
                <tr key={chave}>
                  <th scope="row">{rotulo}</th>
                  {contas.map((conta, posicao) => (
                    <td key={posicao} data-zero={conta === 0 || undefined}>
                      {numero(conta)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Lista
        titulo="Editados no Prelúdio: ficam como estão"
        itens={editados.map((item) => (item.mudouNoGrimorioTambem ? `${item.titulo} (mudou no Grimório também)` : item.titulo))}
      />
      <Lista titulo="Sumiu do Grimório: fica no Prelúdio" itens={titulos(TIPOS_DA_REIMPORTACAO.flatMap(({ chave }) => plano[chave].sumiuLa))} />
      <Lista titulo="Apagados no Prelúdio: não voltam" itens={titulos(TIPOS_DA_REIMPORTACAO.flatMap(({ chave }) => plano[chave].apagadosNoPreludio))} />
    </section>
  )
}

function titulos(itens: readonly ItemDaLista[]): string[] {
  return itens.map((item) => item.titulo)
}

function CopiasDeConflito({ sessao, onComparar }: { sessao: SessaoDaImportacao; onComparar: () => void }) {
  const copias = sessao.resultado.relatorio.copiasDeConflito
  if (copias === null) {
    return (
      <p className="pl-copia__texto">
        As cópias de conflito não entram na importação e não foram comparadas.{' '}
        <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={onComparar}>
          Comparar com a pasta das cópias…
        </button>
      </p>
    )
  }
  const comparadas = copias.comparacoes.length
  return (
    <p className="pl-copia__texto">
      {numero(comparadas)} cópia{comparadas === 1 ? '' : 's'} de conflito comparada{comparadas === 1 ? '' : 's'} com o original (não entram): {numero(copias.comCoisaAMais)} com algo a mais,{' '}
      {numero(copias.soDiferencas)} só com diferenças.
    </p>
  )
}

/** Uma lista que só abre quando o mestre quer (as que travam o Aplicar já vêm abertas). Some quando vazia. */
function Lista({ titulo, itens, aberta = false }: { titulo: string; itens: readonly string[]; aberta?: boolean }) {
  if (itens.length === 0) return null
  const mostrados = itens.slice(0, ITENS_MOSTRADOS)
  return (
    <details className="pl-imp__det" open={aberta}>
      <summary>
        {titulo} ({numero(itens.length)})
      </summary>
      <ul className="pl-copia__avisos">
        {mostrados.map((item, posicao) => (
          <li key={`${posicao}-${item}`}>{item}</li>
        ))}
        {itens.length > mostrados.length && <li>e mais {numero(itens.length - mostrados.length)}, no relatório gravado em importacoes/.</li>}
      </ul>
    </details>
  )
}

type Pastas = { t: 'lendo' } | { t: 'lidas'; pastas: readonly PastaDeMapas[]; aviso: string | null }

function PastasDasCampanhas({ campanhas, pastas, onPasta }: { campanhas: readonly Campanha[]; pastas: ReadonlyMap<string, string | null>; onPasta: (campanhaId: string, pastaId: string | null) => void }) {
  const id = useId()
  const [doLabirinto, setDoLabirinto] = useState<Pastas>({ t: 'lendo' })

  useEffect(() => {
    let vivo = true
    void lerIndiceDasPastas().then(({ indice, aviso }) => {
      if (vivo) setDoLabirinto({ t: 'lidas', pastas: indice.pastas, aviso })
    })
    return () => {
      vivo = false
    }
  }, [])

  if (campanhas.length === 0) return null
  const lista = doLabirinto.t === 'lidas' ? doLabirinto.pastas : []
  return (
    <fieldset className="pl-imp__campanhas" disabled={doLabirinto.t === 'lendo'}>
      <legend className="pl-copia__legenda">A pasta do Labirinto de cada campanha</legend>
      <p className="pl-copia__dica">A pasta é a campanha do Lobby: por ela o Prelúdio acha as fichas e os mapas. Dá para trocar depois.</p>
      {campanhas.map((campanha) => {
        const escolha = pastas.get(campanha.id) ?? null
        const sumiu = escolha !== null && doLabirinto.t === 'lidas' && !lista.some((pasta) => pasta.id === escolha)
        return (
          <div className="pl-imp__campanha" key={campanha.id}>
            <label className="pl-imp__nome" htmlFor={`${id}-${campanha.id}`}>
              {campanha.nome}
            </label>
            <select
              id={`${id}-${campanha.id}`}
              className="lb-input pl-imp__escolha"
              value={escolha ?? ''}
              onChange={(evento) => onPasta(campanha.id, evento.target.value === '' ? null : evento.target.value)}
            >
              <option value="">Sem pasta</option>
              {lista.map((pasta) => (
                <option key={pasta.id} value={pasta.id}>
                  {pasta.nome}
                </option>
              ))}
              {sumiu && <option value={escolha}>Pasta que não existe mais</option>}
            </select>
          </div>
        )
      })}
      {doLabirinto.t === 'lidas' && doLabirinto.aviso !== null && <p className="pl-copia__dica">{doLabirinto.aviso}</p>}
    </fieldset>
  )
}

function textoDaConfirmacao(sessao: SessaoDaImportacao): string {
  const { plano } = sessao.resultado
  const verbetes = `${numero(plano.verbetes.length)} verbete${plano.verbetes.length === 1 ? '' : 's'}`
  const quadros = `${numero(plano.quadros.length)} quadro${plano.quadros.length === 1 ? '' : 's'}`
  const reimportar = plano.modo === 'reimportacao' ? ' O que você editou no Prelúdio fica como está.' : ''
  return `Grava no Prelúdio ${verbetes}, ${quadros} e as imagens que faltarem, liga cada campanha à pasta escolhida e guarda o relatório com os originais em importacoes/.${reimportar} O cofre do Grimório só é lido.`
}

function Confirmacao({ sessao, onVoltar, onAplicar }: { sessao: SessaoDaImportacao; onVoltar: () => void; onAplicar: () => void }) {
  // O Esc é desta caixa: sem isto ele subiria até o `MenuShell`, que tiraria o mestre da tela.
  const aoTeclar = (evento: KeyboardEvent<HTMLDivElement>) => {
    if (evento.key !== 'Escape') return
    evento.preventDefault()
    evento.stopPropagation()
    onVoltar()
  }
  return (
    <div className="pl-copia__confirmar" role="group" aria-label="Confirmar a importação" onKeyDown={aoTeclar}>
      <p className="pl-copia__aviso">{textoDaConfirmacao(sessao)}</p>
      <div className="pl-copia__linha">
        <button type="button" className="lb-btn lb-btn--primary lb-btn--compact" onClick={onAplicar}>
          Aplicar agora
        </button>
        <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" autoFocus onClick={onVoltar}>
          Voltar
        </button>
      </div>
    </div>
  )
}
