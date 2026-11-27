import { useState } from 'react'
import { ELEMENTOS_DE_FABRICA, ELEMENTOS_MAX, NOME_CURTO_MAX, type ElementoDaPeca } from '../../../../lib/batalha/mecanica/pecas'
import { Caixa, EscolherCondicao, Frase, Nota, Numero, Texto, TextoCurto, Tirar, useVariavelCss } from './controlesDaPeca'
import { Glifo } from './glifos'
import type { PropsDaPeca } from './registro'
import { ELEMENTOS_NA_TELA, nomeLivre, semOItem, trocado } from './vocabulario'

/** Os de fábrica na ordem da tabela; os próprios no fim, na ordem em que nasceram. */
function emOrdem(elementos: readonly ElementoDaPeca[]): ElementoDaPeca[] {
  const deFabrica = ELEMENTOS_DE_FABRICA.flatMap((fabrica) => elementos.filter((elemento) => elemento.id === fabrica.id))
  return [...deFabrica, ...elementos.filter((elemento) => elemento.id === 'proprio')]
}

function nomeRepetido(elementos: readonly ElementoDaPeca[], indice: number, nome: string): boolean {
  const chave = nome.trim().toLocaleLowerCase('pt-BR')
  return elementos.some((outro, atual) => atual !== indice && outro.nome.trim().toLocaleLowerCase('pt-BR') === chave)
}

function Ficha({ elemento, pressionado, onClick }: { elemento: { id: ElementoDaPeca['id']; nome: string }; pressionado: boolean; onClick: () => void }) {
  const visual = ELEMENTOS_NA_TELA[elemento.id]
  const pintar = useVariavelCss('--cor-el', visual.cor)
  return (
    <button ref={pintar} type="button" className="lb-pc__elem" aria-pressed={pressionado} onClick={onClick}>
      <Glifo nome={visual.icone} />
      {elemento.nome.trim() || 'Sem nome'}
    </button>
  )
}

function LinhaDoElemento({ elemento, elementos, indice, focar, aoMudar, aoTirar }: { elemento: ElementoDaPeca; elementos: readonly ElementoDaPeca[]; indice: number; focar: boolean; aoMudar: (elemento: ElementoDaPeca) => void; aoTirar: () => void }) {
  const visual = ELEMENTOS_NA_TELA[elemento.id]
  const pintar = useVariavelCss('--cor-el', visual.cor)
  const nome = elemento.nome
  return (
    <li ref={pintar} className="lb-pc__elem-linha">
      <span className="lb-pc__med lb-pc__med--p" aria-hidden="true">
        <Glifo nome={visual.icone} />
      </span>
      <Frase>
        <Texto>Se aceitar</Texto>
        {elemento.id === 'proprio' ? (
          <TextoCurto
            rotulo="Nome do elemento"
            valor={nome}
            maximo={NOME_CURTO_MAX}
            placeholder="Sangue"
            focar={focar}
            onChange={(novo) => {
              if (!nomeRepetido(elementos, indice, novo)) aoMudar({ ...elemento, nome: novo })
            }}
          />
        ) : (
          <Texto forte>{nome}</Texto>
        )}
        <Texto>:</Texto>
        <Numero rotulo={`Dano a mais com ${nome}`} valor={elemento.dano} minimo={-100} maximo={200} onChange={(dano) => aoMudar({ ...elemento, dano })} />
        <Texto>de dano, deixa</Texto>
        <EscolherCondicao
          rotulo={`Condição de ${nome}`}
          valor={elemento.condicao}
          nenhuma
          onChange={(condicao) => {
            const { condicao: _antes, ...sem } = elemento
            aoMudar(condicao === undefined ? sem : { ...sem, condicao })
          }}
        />
        <Texto>e custa</Texto>
        <Numero rotulo={`SP de ${nome}`} valor={elemento.sp} minimo={0} maximo={200} onChange={(sp) => aoMudar({ ...elemento, sp })} />
        <Texto>SP</Texto>
        <Caixa rotulo="o alvo reage com desvantagem" marcado={elemento.desvantagem} onChange={(desvantagem) => aoMudar({ ...elemento, desvantagem })} />
      </Frase>
      {elemento.id === 'proprio' ? <Tirar rotulo={`Tirar o elemento ${nome}`} onClick={aoTirar} /> : <span aria-hidden="true" />}
    </li>
  )
}

/**
 * IMBUIR (mecânica 2; `corpoImbuir` do protótipo): os elementos que o dono pode pôr no golpe enquanto a
 * técnica "Ligar e manter" está ligada. Ligar a ficha do elemento põe o de fábrica com os números da
 * tabela; o próprio nasce com nome livre. Na batalha, "Não" é sempre uma resposta e não gasta nada.
 */
export function PecaImbuir({ peca, aoMudar }: PropsDaPeca<'imbuir'>) {
  const { elementos } = peca
  const [novoProprio, setNovoProprio] = useState<number | null>(null)
  const cheio = elementos.length >= ELEMENTOS_MAX
  const gravar = (lista: readonly ElementoDaPeca[]) => aoMudar({ ...peca, elementos: emOrdem(lista) })
  const alternar = (fabrica: ElementoDaPeca) => {
    const ligado = elementos.some((elemento) => elemento.id === fabrica.id)
    if (ligado) gravar(elementos.filter((elemento) => elemento.id !== fabrica.id))
    else if (!cheio) gravar([...elementos, fabrica])
  }
  const porProprio = () => {
    if (cheio) return
    const nome = nomeLivre('Próprio', elementos.map((elemento) => elemento.nome))
    const lista = emOrdem([...elementos, { id: 'proprio', nome, dano: 10, sp: 10, desvantagem: false }])
    setNovoProprio(lista.length - 1)
    aoMudar({ ...peca, elementos: lista })
  }
  return (
    <>
      <div className="lb-pc__campo" role="group" aria-label="Elementos que o dono pode pôr no golpe">
        <span className="lb-pc__rot" aria-hidden="true">
          Elementos que o dono pode pôr no golpe
        </span>
        <div className="lb-pc__elems">
          {ELEMENTOS_DE_FABRICA.map((fabrica) => (
            <Ficha key={fabrica.id} elemento={fabrica} pressionado={elementos.some((elemento) => elemento.id === fabrica.id)} onClick={() => alternar(fabrica)} />
          ))}
          <button type="button" className="lb-pc__elem" disabled={cheio} title={cheio ? `No máximo ${ELEMENTOS_MAX} elementos` : undefined} onClick={porProprio}>
            <Glifo nome="mais" />
            Elemento próprio
          </button>
        </div>
      </div>
      {elementos.length === 0 ? (
        <Nota>Ligue pelo menos um elemento. Sem elemento, a batalha não pergunta nada.</Nota>
      ) : (
        <ul className="lb-pc__lista">
          {elementos.map((elemento, indice) => (
            <LinhaDoElemento
              key={elemento.id === 'proprio' ? `proprio-${indice}` : elemento.id}
              elemento={elemento}
              elementos={elementos}
              indice={indice}
              focar={novoProprio === indice}
              aoMudar={(novo) => gravar(trocado(elementos, indice, novo))}
              aoTirar={() => gravar(semOItem(elementos, indice))}
            />
          ))}
        </ul>
      )}
      <Nota>Um elemento por golpe. "Não" é sempre uma das respostas; recusar não gasta SP.</Nota>
    </>
  )
}
