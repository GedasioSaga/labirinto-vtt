import { useId, useMemo } from 'react'
import { Botao } from '../grimorio/Botao'
import { CampoSeg, type OpcaoDoSeg } from '../grimorio/CampoSeg'
import { CampoTexto } from '../grimorio/CampoTexto'
import { Nota } from '../grimorio/Nota'
import type { ItemDoCatalogo } from '../../lib/acervoDeItens'
import { NOMES_DAS_MOSTRAS } from '../../documentos/desenhoDoPapel'
import { CHAVES_DO_TRECHO_MAX, MOSTRAS_DO_TRECHO, TEXTO_CIFRADO_MAX, TEXTO_CLARO_MAX, type Documento, type MostraDoTrecho, type TrechoCifrado } from '../../documentos/tipos'
import { comTrecho, semOTrecho, trechoDesfeito, trechosNaFicha, type TrechoNaFicha } from './trechosDoRascunho'

/**
 * "TRECHOS PROTEGIDOS" na ficha do documento (fase D5; protótipo dos extras,
 * `htmlTrechosEd`): o texto claro de cada trecho, o que vê quem não tem o
 * item e quais itens do acervo leem. O claro mora só aqui, no computador do
 * mestre; o host monta o que cada jogador recebe (`documentos/resolver.ts`).
 */

export interface PropsDosTrechos {
  documento: Documento
  itens: readonly ItemDoCatalogo[]
  mudar: (mudanca: (atual: Documento) => Documento) => void
  onAviso: (texto: string) => void
}

const OPCOES_DA_MOSTRA: OpcaoDoSeg<MostraDoTrecho>[] = MOSTRAS_DO_TRECHO.map((mostra) => ({ valor: mostra, rotulo: NOMES_DAS_MOSTRAS[mostra] }))
/** O valor da opção "escolha um item" da lista de itens. */
const NENHUM_ITEM = ''

/** Os itens que leem o trecho: os escolhidos (cada um sai no ×) e a lista do acervo para pôr mais um. */
function QuemLe({ trecho, itens, onChange }: { trecho: TrechoCifrado; itens: readonly ItemDoCatalogo[]; onChange: (chaves: string[]) => void }) {
  const rotulo = useId()
  const nomePorId = useMemo(() => new Map(itens.map((item) => [item.id, item.nome])), [itens])
  const livres = useMemo(() => itens.filter((item) => !trecho.chaves.includes(item.id)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [itens, trecho.chaves])
  const cheio = trecho.chaves.length >= CHAVES_DO_TRECHO_MAX
  return (
    <div className="gr-campo" role="group" aria-labelledby={rotulo}>
      <span className="gr-campo__rot" id={rotulo}>
        Lê quem tem
      </span>
      {trecho.chaves.length > 0 && (
        <ul className="doc-chaves">
          {trecho.chaves.map((chave) => {
            const nome = nomePorId.get(chave) ?? 'Item apagado do acervo'
            return (
              <li key={chave} className="doc-chave">
                <span>{nome}</span>
                <button type="button" className="doc-chave__tirar" aria-label={`Tirar ${nome}`} title="Tirar" onClick={() => onChange(trecho.chaves.filter((outra) => outra !== chave))}>
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M7 7l10 10M17 7 7 17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <select
        className="gr-entrada"
        aria-label="Pôr mais um item que lê este trecho"
        value={NENHUM_ITEM}
        disabled={cheio || livres.length === 0}
        onChange={(evento) => {
          const id = evento.currentTarget.value
          if (id !== NENHUM_ITEM) onChange([...trecho.chaves, id])
        }}
      >
        <option value={NENHUM_ITEM}>{itens.length === 0 ? 'O acervo de itens está vazio' : cheio ? `No máximo ${CHAVES_DO_TRECHO_MAX} itens` : '+ Um item do acervo…'}</option>
        {livres.map((item) => (
          <option key={item.id} value={item.id}>
            {item.nome}
          </option>
        ))}
      </select>
    </div>
  )
}

function CartaoDoTrecho({ linha, documento, itens, mudar, onAviso }: PropsDosTrechos & { linha: TrechoNaFicha }) {
  const { id, trecho, rotulo, pagina } = linha
  const claroId = useId()
  const noTexto = pagina >= 0
  const desfazer = () => {
    const desfeito = trechoDesfeito(documento, id)
    if (desfeito === null) {
      onAviso('A página ficaria comprida demais com o texto do trecho. Encurte a página antes de desfazer.')
      return
    }
    mudar((atual) => trechoDesfeito(atual, id) ?? atual)
  }
  return (
    <li className={`doc-trecho${noTexto ? '' : ' is-orfao'}`}>
      <div className="doc-trecho__cab">
        <span className={`mg-tag${trecho.tipo === 'cifra' ? ' mg-tag--latao' : ''}`}>{rotulo}</span>
        <span>{noTexto ? `página ${pagina + 1}` : 'saiu do texto'}</span>
        {noTexto ? (
          <Botao variante="fantasma" tamanho="p" title="Volta a ser texto comum, legível para todos" onClick={desfazer}>
            Desfazer
          </Botao>
        ) : (
          <Botao variante="perigo" tamanho="p" onClick={() => mudar((atual) => semOTrecho(atual, id))}>
            Apagar
          </Botao>
        )}
      </div>
      <div className="gr-campo">
        <label className="gr-campo__rot" htmlFor={claroId}>
          Texto claro <small>só você vê aqui</small>
        </label>
        <textarea
          id={claroId}
          className="gr-entrada"
          rows={2}
          maxLength={TEXTO_CLARO_MAX}
          value={trecho.claro}
          onChange={(evento) => {
            const claro = evento.currentTarget.value
            mudar((atual) => (trecho.tipo === 'cifra' ? comTrecho<TrechoCifrado>(atual, id, 'cifra', (t) => ({ ...t, claro })) : comTrecho(atual, id, 'borrado', (t) => ({ ...t, claro }))))
          }}
        />
      </div>
      {trecho.tipo === 'borrado' ? (
        <Nota>Ninguém lê: todos veem a tinta borrada, com letras ao acaso.</Nota>
      ) : (
        <>
          <div className="doc-seg-em-duas">
            <CampoSeg
              rotulo="Quem não tem o item vê"
              opcoes={OPCOES_DA_MOSTRA}
              valor={trecho.mostra}
              onChange={(mostra) => mudar((atual) => comTrecho<TrechoCifrado>(atual, id, 'cifra', (t) => ({ ...t, mostra })))}
            />
          </div>
          {trecho.mostra !== 'embaralhado' && (
            <CampoTexto
              rotulo={trecho.mostra === 'codigo' ? 'O código (vazio: embaralhado)' : 'O texto na outra língua (vazio: embaralhado)'}
              valor={trecho.textoCifrado}
              maxLength={TEXTO_CIFRADO_MAX}
              onChange={(textoCifrado) => mudar((atual) => comTrecho<TrechoCifrado>(atual, id, 'cifra', (t) => ({ ...t, textoCifrado })))}
            />
          )}
          <QuemLe trecho={trecho} itens={itens} onChange={(chaves) => mudar((atual) => comTrecho<TrechoCifrado>(atual, id, 'cifra', (t) => ({ ...t, chaves })))} />
          {trecho.chaves.length === 0 && <p className="doc-trecho__perigo">Ninguém vai ler este trecho. Escolha ao menos um item.</p>}
        </>
      )}
    </li>
  )
}

export function SecaoDosTrechos(props: PropsDosTrechos) {
  const linhas = trechosNaFicha(props.documento)
  return (
    <section className="doc-secao" aria-label="Trechos protegidos">
      <h3 className="mg-secao">
        Trechos protegidos {linhas.length > 0 && <small>{linhas.length}</small>}
      </h3>
      {linhas.length === 0 ? (
        <p className="mg-vazio">Nenhum trecho protegido. Selecione um pedaço do texto de uma página e use Cifrar ou Borrar.</p>
      ) : (
        <ol className="doc-trechos">
          {linhas.map((linha) => (
            <CartaoDoTrecho key={linha.id} linha={linha} {...props} />
          ))}
        </ol>
      )}
      <Nota>O texto claro fica só no seu computador. Quem não tem o item recebe o que está em “Quem não tem o item vê”; o borrado chega embaralhado para todos.</Nota>
    </section>
  )
}
