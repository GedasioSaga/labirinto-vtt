import { useId, useLayoutEffect, useRef, useState } from 'react'
import { Botao } from '../grimorio/Botao'
import { Nota } from '../grimorio/Nota'
import { movimentoReduzido } from '../grimorio/comum'
import { theme } from '../../theme'
import { DE_O_MESTRE, darDocumento, juntarNomes, linhaDoDocumento, semDocumento, textoDaOrigem, type ResultadoDeDar } from '../../documentos/naFicha'
import { DOCUMENTOS_NA_FICHA_MAX, type Documento } from '../../documentos/tipos'
import type { Personagem } from '../../lib/personagem'
import { useAdventureStore } from '../../stores/adventureStore'
import { personagensAtivos, temRpgNoMapa } from '../../stores/donoDasFichas'
import { useToastStore } from '../../stores/toastStore'

/**
 * "ENTREGAR SEM IR ATÉ O PAPEL" e "QUEM TEM" (protótipo v2, `htmlPainelDoc`):
 * o mestre dá o documento a todos os jogadores ou a um só, e vê a lista de
 * quem tem. Grava na FICHA de cada um (`Personagem.documentos`), com o aviso
 * de novo, pelo `ajustarPersonagem` da aventura, que parte da ficha de agora.
 * O texto não vai para a ficha: lá ficam só o título, o papel, quando e de onde.
 */

/** A entrada da linha que acabou de mudar: o "recebeu do mestre" assenta, sem pular. */
const ENTRADA_DA_LINHA_MS = 220

const DATA_CURTA = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

function quando(em: number): string {
  return DATA_CURTA.format(new Date(em))
}

interface ResultadoDaEntrega {
  entraram: string[]
  jaTinham: string[]
  cheios: string[]
  falharam: string[]
}

/**
 * Dá a cada um da lista; devolve o que aconteceu com cada nome. A conta é
 * sobre a ficha de AGORA (lida na hora, e de novo dentro da gravação), não
 * sobre a lista que a tela mostrava: o jogador pode ter lido o papel um
 * instante antes.
 */
function entregar(documento: Pick<Documento, 'id' | 'titulo' | 'papel'>, personagens: readonly Personagem[]): ResultadoDaEntrega {
  const saida: ResultadoDaEntrega = { entraram: [], jaTinham: [], cheios: [], falharam: [] }
  const agora = Date.now()
  const dar = (atual: Personagem): ResultadoDeDar => darDocumento(atual, documento, 'mestre', DE_O_MESTRE, agora)
  for (const personagem of personagens) {
    const store = useAdventureStore.getState()
    const deAgora = personagensAtivos(store).find((candidato) => candidato.id === personagem.id)
    if (deAgora === undefined) {
      saida.falharam.push(personagem.nome)
      continue
    }
    const resultado = dar(deAgora)
    if (resultado.tipo === 'ja-tinha') saida.jaTinham.push(personagem.nome)
    else if (resultado.tipo === 'cheia') saida.cheios.push(personagem.nome)
    else if (store.ajustarPersonagem(personagem.id, (atual) => {
      const naGravacao = dar(atual)
      return naGravacao.tipo === 'entrou' ? naGravacao.personagem : atual
    })) saida.entraram.push(personagem.nome)
    else saida.falharam.push(personagem.nome)
  }
  return saida
}

function avisarEntrega(titulo: string, total: number, saida: ResultadoDaEntrega): void {
  const { push } = useToastStore.getState()
  if (saida.falharam.length > 0) push('error', `Não deu para gravar na ficha de ${juntarNomes(saida.falharam)}.`)
  if (saida.cheios.length > 0) push('error', `A lista de ${juntarNomes(saida.cheios)} já tem ${DOCUMENTOS_NA_FICHA_MAX} documentos.`)
  if (saida.entraram.length > 0) push('info', `“${titulo}” entregue a ${juntarNomes(saida.entraram)}. Fica na ficha ao salvar a aventura.`)
  else if (saida.jaTinham.length > 0 && saida.falharam.length === 0 && saida.cheios.length === 0) {
    push('info', total > 1 ? 'Todos já tinham este documento.' : `${saida.jaTinham[0]} já tinha este documento.`)
  }
}

function LinhaDeQuemTem({ personagem, docId, recemChegado }: { personagem: Personagem; docId: string; recemChegado: boolean }) {
  const linha = linhaDoDocumento(personagem, docId)
  const estado = useRef<HTMLSpanElement>(null)
  // Quem acabou de receber: o texto novo assenta de 2 px (com movimento reduzido, só aparece). Raro: uma vez por entrega.
  useLayoutEffect(() => {
    const no = estado.current
    if (!recemChegado || no === null || typeof no.animate !== 'function') return
    const reduzido = movimentoReduzido()
    const animacao = no.animate(reduzido ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'translateY(2px)' }, { opacity: 1, transform: 'none' }], {
      duration: ENTRADA_DA_LINHA_MS,
      easing: theme.gr.easeOut,
    })
    return () => animacao.cancel()
  }, [recemChegado])
  const tirar = () => {
    useAdventureStore.getState().ajustarPersonagem(personagem.id, (atual) => semDocumento(atual, docId))
  }
  return (
    <li className="doc-quem">
      <span className="doc-quem__av" aria-hidden="true">
        {personagem.nome.trim().charAt(0).toUpperCase() || '?'}
      </span>
      <span className="doc-quem__nome">{personagem.nome}</span>
      <span ref={estado} className={linha === undefined ? 'doc-quem__estado' : 'doc-quem__estado doc-quem__estado--tem'}>
        {linha === undefined ? 'ainda não tem' : textoDaOrigem(linha)}
        {linha !== undefined && (
          <small>
            {quando(linha.em)}
            {linha.novo === true && ' · ainda não abriu'}
          </small>
        )}
      </span>
      {linha !== undefined && (
        <Botao variante="fantasma" tamanho="p" className="doc-quem__tirar" onClick={tirar} aria-label={`Tirar o documento da lista de ${personagem.nome}`}>
          Tirar
        </Botao>
      )}
    </li>
  )
}

export function SecaoEntregar({ documento, antesDeEntregar }: { documento: Documento; antesDeEntregar: () => void }) {
  const personagens = useAdventureStore((estado) => personagensAtivos(estado))
  const temOndeGuardar = useAdventureStore((estado) => temRpgNoMapa(estado))
  const jogadores = personagens.filter((personagem) => personagem.tipo === 'jogador')
  const [escolhido, setEscolhido] = useState<string>('')
  const [recemChegados, setRecemChegados] = useState<ReadonlySet<string>>(new Set())
  const idDoSeletor = useId()
  const alvo = jogadores.find((personagem) => personagem.id === escolhido) ?? jogadores[0]
  const comLista = jogadores.filter((personagem) => linhaDoDocumento(personagem, documento.id) !== undefined).length
  const titulo = documento.titulo.trim() === '' ? 'Sem título' : documento.titulo

  const dar = (quem: readonly Personagem[]) => {
    antesDeEntregar()
    const saida = entregar({ id: documento.id, titulo, papel: documento.papel }, quem)
    const nomes = new Set(saida.entraram)
    setRecemChegados(new Set(quem.filter((personagem) => nomes.has(personagem.nome)).map((personagem) => personagem.id)))
    avisarEntrega(titulo, quem.length, saida)
  }

  return (
    <>
      <section className="doc-secao" aria-labelledby={`doc-dar-${documento.id}`}>
        <h3 className="mg-secao" id={`doc-dar-${documento.id}`}>
          Entregar sem ir até o papel
        </h3>
        {!temOndeGuardar ? (
          <Nota>Este mapa não é uma aventura: não há ficha onde guardar a lista. Abra-o como aventura para entregar documentos.</Nota>
        ) : jogadores.length === 0 ? (
          <Nota>Nenhum personagem de jogador nesta aventura. Crie as fichas na página Aventura para entregar documentos.</Nota>
        ) : (
          <>
            <Botao variante="primario" largo onClick={() => dar(jogadores)}>
              Dar a todos
            </Botao>
            <div className="gr-campo">
              <label className="gr-campo__rot" htmlFor={idDoSeletor}>
                Dar a…
              </label>
              <div className="doc-dar">
                <select id={idDoSeletor} className="gr-entrada" value={alvo?.id ?? ''} onChange={(evento) => setEscolhido(evento.currentTarget.value)}>
                  {jogadores.map((personagem) => (
                    <option key={personagem.id} value={personagem.id}>
                      {personagem.nome}
                    </option>
                  ))}
                </select>
                <Botao variante="latao" onClick={() => alvo !== undefined && dar([alvo])}>
                  Entregar
                </Botao>
              </div>
            </div>
            <Nota>Vai para a lista de Documentos do jogador, com o aviso de novo.</Nota>
          </>
        )}
      </section>
      {temOndeGuardar && jogadores.length > 0 && (
        <section className="doc-secao" aria-labelledby={`doc-quem-${documento.id}`}>
          <h3 className="mg-secao" id={`doc-quem-${documento.id}`}>
            Quem tem{' '}
            <small>
              {comLista} de {jogadores.length}
            </small>
          </h3>
          <ul className="doc-quem-tem">
            {jogadores.map((personagem) => (
              <LinhaDeQuemTem key={personagem.id} personagem={personagem} docId={documento.id} recemChegado={recemChegados.has(personagem.id)} />
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
