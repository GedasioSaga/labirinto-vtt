import { useId, useState } from 'react'
import type { ArmaNoEnsaio, CasoDaArma, EnsaioDasArmas, EscolhaDaArma } from '../../lib/livros/regraDaArma'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { confirmarJuntarAsArmas, ensaiarJuntarAsArmas } from '../../stores/armasNaFonte'
import { useToastStore } from '../../stores/toastStore'
import { formatarNumero } from './comum'

/**
 * "JUNTAR AS ARMAS" da página Itens (docs/design/habilidades/ARMAS-FONTE-UNICA.md
 * §4): o ENSAIO primeiro, com a lista do que muda e os conflitos lado a lado;
 * nada se grava antes do "Confirmar". Conflito nunca é decidido sozinho: sem
 * escolha ele fica como está ("Decidir depois").
 */

const DECIDIR_DEPOIS = ''
const SEPARAR = 'separar'

const FRASE_DO_CASO: Readonly<Record<Exclude<CasoDaArma, 'conflito'>, string>> = {
  iguais: 'iguais no livro e na ficha: só liga',
  livroVaiAFicha: 'o que ela faz vai do livro à ficha',
  fichaVaiAoLivro: 'o que ela faz vai da ficha ao livro',
  fonteGanha: 'a ficha mudou a cópia: volta ao que o livro diz',
}

function mensagemDoErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

const nomesDasFichas = (arma: Pick<ArmaNoEnsaio, 'cartoes'>): string => [...new Set(arma.cartoes.map((par) => par.personagemNome))].join(', ')

/** O ensaio de agora, ou a frase de por que não deu. */
function ensaiar(sistema: SistemaDeRpg): EnsaioDasArmas | string {
  try {
    return ensaiarJuntarAsArmas(sistema)
  } catch (erro) {
    return mensagemDoErro(erro)
  }
}

export function JuntarAsArmas({ sistema, onFechar }: { sistema: SistemaDeRpg; onFechar: () => void }) {
  const idBase = useId()
  const [ensaio, setEnsaio] = useState<EnsaioDasArmas | string>(() => ensaiar(sistema))
  /** A versão escolhida de cada conflito (`VersaoDaArma.id`, `separar` ou vazio = decidir depois). */
  const [escolhas, setEscolhas] = useState<Readonly<Record<string, string>>>({})
  const [recriar, setRecriar] = useState<ReadonlySet<string>>(() => new Set())
  const [gravando, setGravando] = useState(false)

  if (typeof ensaio === 'string') {
    return (
      <section className="mu-armas" aria-labelledby={`${idBase}-tit`}>
        <h3 className="mu-armas__tit" id={`${idBase}-tit`}>
          Juntar as armas
        </h3>
        <p className="mu-campo__erro" role="alert">
          {ensaio}
        </p>
        <div className="mu-armas__pe">
          <button type="button" className="mu-bt" onClick={onFechar}>
            Fechar
          </button>
        </div>
      </section>
    )
  }

  const certas = ensaio.armas.filter((arma) => arma.caso !== 'conflito')
  const conflitos = ensaio.armas.filter((arma) => arma.caso === 'conflito')
  const coisasNovas = certas.filter((arma) => arma.precisaDeCoisa).length
  const nada = ensaio.armas.length === 0 && ensaio.coisaApagada.length === 0 && ensaio.textoVelho.length === 0
  const escolhidas: EscolhaDaArma[] = [
    ...Object.entries(escolhas).flatMap(([entradaId, valor]): EscolhaDaArma[] => (valor === DECIDIR_DEPOIS ? [] : valor === SEPARAR ? [{ entradaId, separar: true }] : [{ entradaId, vale: valor }])),
    ...[...recriar].map((entradaId): EscolhaDaArma => ({ entradaId, recriarCoisa: true })),
  ]

  const confirmar = async () => {
    if (gravando) return
    setGravando(true)
    const toasts = useToastStore.getState()
    try {
      const mudancas = await confirmarJuntarAsArmas(sistema, escolhidas)
      toasts.push('info', mudancas === 0 ? 'Nada mudou: as armas já diziam o mesmo.' : `Armas juntadas: ${formatarNumero(mudancas)} ${mudancas === 1 ? 'mudança' : 'mudanças'} no livro, no Acervo e nas fichas.`)
      // O que sobrou (os conflitos sem escolha) fica na tela, já sobre o disco novo.
      setEnsaio(ensaiar(sistema))
      setEscolhas({})
      setRecriar(new Set())
    } catch (erro) {
      toasts.push('error', `Não deu para juntar as armas: ${mensagemDoErro(erro)}`)
    } finally {
      setGravando(false)
    }
  }

  return (
    <section className="mu-armas" aria-labelledby={`${idBase}-tit`}>
      <h3 className="mu-armas__tit" id={`${idBase}-tit`}>
        Juntar as armas
      </h3>
      <p className="mu-armas__sub">Cada arma passa a dizer o mesmo no livro, no Acervo e nas fichas desta pasta. Nada se grava antes do Confirmar.</p>
      {nada && conflitos.length === 0 ? (
        <p className="mu-armas__nada">Nada a juntar: as armas do livro e das fichas desta pasta já dizem o mesmo.</p>
      ) : (
        <>
          {certas.length > 0 && (
            <div className="mu-armas__bloco">
              <h4 className="mu-armas__bloco-tit">Juntam sozinhas ({formatarNumero(certas.length)})</h4>
              <ul className="mu-armas__lista">
                {certas.map((arma) => (
                  <li key={arma.entradaId}>
                    <b>{arma.nome}</b> ({nomesDasFichas(arma)}): {arma.caso === 'conflito' ? '' : FRASE_DO_CASO[arma.caso]}
                    {arma.precisaDeCoisa ? '; ganha a coisa no Acervo' : ''}
                  </li>
                ))}
              </ul>
              {coisasNovas > 0 && (
                <p className="mu-campo__dica">
                  {formatarNumero(coisasNovas)} {coisasNovas === 1 ? 'coisa nova' : 'coisas novas'} no Acervo (categoria Arma): é por ela que a ficha fica ligada ao livro.
                </p>
              )}
            </div>
          )}
          {conflitos.length > 0 && (
            <div className="mu-armas__bloco">
              <h4 className="mu-armas__bloco-tit">Conflitos: escolha a que vale ({formatarNumero(conflitos.length)})</h4>
              {conflitos.map((arma) => {
                const escolhida = escolhas[arma.entradaId] ?? DECIDIR_DEPOIS
                const nomeDoGrupo = `${idBase}-${arma.entradaId}`
                const escolher = (valor: string) => setEscolhas((atuais) => ({ ...atuais, [arma.entradaId]: valor }))
                return (
                  <fieldset key={arma.entradaId} className="mu-armas__conflito">
                    <legend className="mu-armas__conflito-tit">{arma.nome}</legend>
                    <div className="mu-armas__versoes">
                      {arma.versoes.map((versao) => (
                        <label key={versao.id} className="mu-armas__versao" data-escolhida={escolhida === versao.id ? '' : undefined}>
                          <input type="radio" name={nomeDoGrupo} value={versao.id} checked={escolhida === versao.id} onChange={() => escolher(versao.id)} />
                          <span className="mu-armas__versao-rot">
                            {versao.rotulo}
                            {versao.cartoes.length > 1 ? ` e mais ${formatarNumero(versao.cartoes.length - 1)}` : ''}
                          </span>
                          <span className="mu-armas__versao-txt">{versao.resumo}</span>
                        </label>
                      ))}
                    </div>
                    <div className="mu-armas__outras">
                      <label className="mu-armas__opcao">
                        <input type="radio" name={nomeDoGrupo} value={SEPARAR} checked={escolhida === SEPARAR} onChange={() => escolher(SEPARAR)} />
                        <span>Separar: cada ficha fica com a sua (Só nesta ficha)</span>
                      </label>
                      <label className="mu-armas__opcao">
                        <input type="radio" name={nomeDoGrupo} value={DECIDIR_DEPOIS} checked={escolhida === DECIDIR_DEPOIS} onChange={() => escolher(DECIDIR_DEPOIS)} />
                        <span>Decidir depois (fica como está)</span>
                      </label>
                    </div>
                  </fieldset>
                )
              })}
            </div>
          )}
          {ensaio.coisaApagada.length > 0 && (
            <div className="mu-armas__bloco">
              <h4 className="mu-armas__bloco-tit">A coisa saiu do Acervo</h4>
              {ensaio.coisaApagada.map((arma) => (
                <label key={arma.entradaId} className="mu-armas__opcao">
                  <input
                    type="checkbox"
                    checked={recriar.has(arma.entradaId)}
                    onChange={(event) =>
                      setRecriar((atuais) => {
                        const novos = new Set(atuais)
                        if (event.target.checked) novos.add(arma.entradaId)
                        else novos.delete(arma.entradaId)
                        return novos
                      })
                    }
                  />
                  <span>{arma.nome}: recriar a coisa no Acervo (o livro segue valendo sem ela)</span>
                </label>
              ))}
            </div>
          )}
          {ensaio.textoVelho.length > 0 && <p className="mu-campo__dica">{formatarNumero(ensaio.textoVelho.length)} {ensaio.textoVelho.length === 1 ? 'arma perde' : 'armas perdem'} a frase velha "à mão até o app ter efeito de arma com usos".</p>}
        </>
      )}
      {(ensaio.nomeRepetido.length > 0 || ensaio.soNasFichas.length > 0) && (
        <div className="mu-armas__bloco">
          <h4 className="mu-armas__bloco-tit">Não junto sozinho</h4>
          <ul className="mu-armas__lista">
            {ensaio.nomeRepetido.map((caso) => (
              <li key={`r-${caso.nome}`}>
                <b>{caso.nome}</b>: {formatarNumero(caso.entradaIds.length)} armas com este nome no livro. Ligue à mão (lápis, Coisa do Acervo).
              </li>
            ))}
            {ensaio.soNasFichas.map((caso) => (
              <li key={`f-${caso.nome}`}>
                <b>{caso.nome}</b> ({nomesDasFichas(caso)}): só nas fichas, sem entrada no livro. Podem ser armas diferentes.
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mu-armas__pe">
        <button type="button" className="mu-bt" onClick={onFechar}>
          {nada && conflitos.length === 0 ? 'Fechar' : 'Cancelar'}
        </button>
        {!(nada && conflitos.length === 0) && (
          <button type="button" className="mu-bt mu-bt--primario" disabled={gravando} onClick={() => void confirmar()}>
            {gravando ? 'Juntando…' : 'Confirmar'}
          </button>
        )}
      </div>
    </section>
  )
}
