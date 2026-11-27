import { useId, useState, type RefObject } from 'react'
import { CAMPO_DA_DESCRICAO, linhasDoConfira, semConfira } from '../../../lib/batalha/mecanica/conversao/comum'
import { marcasGuardadas } from '../../../lib/batalha/requisitos/guardados'
import { lerMarcas, mesmaMarca } from '../../../lib/batalha/requisitos/ler'
import { MARCA_MAX, MARCAS_MAX } from '../../../lib/batalha/requisitos/modelo'
import type { CartaoDaFicha } from '../../../lib/personagem'
import { CampoQueColaImagem } from '../../CampoQueColaImagem'
import { ImagemOuIniciais } from '../../FichaPecas'

/** O teto da "Descrição para ambientar" (o `maxlength` do protótipo). */
const DESCRICAO_MAX = 400
/** O teto do nome (o do protótipo). */
const NOME_MAX = 60

interface TopoDaHabilidadeProps {
  cartao: CartaoDaFicha
  /** Cada mudança vai ao cartão; `aviso` = um passo próprio no Ctrl+Z, com o aviso embaixo. */
  onChange: (cartao: CartaoDaFicha, aviso?: string) => void
  campoDoNome: RefObject<HTMLInputElement | null>
  /** A imagem só existe no cartão da ficha (o catálogo do livro não a guarda). */
  comImagem: boolean
  /** As marcas que já existem na ficha, para sugerir. */
  sugestoesDeMarca: readonly string[]
  /** D11: o porquê de a habilidade de antes ter ficado no texto (a conversão não a montou). */
  ficouNoTexto: string | null
}

/**
 * O TOPO DO EDITOR (rework das habilidades, D14; protótipo `blocoTopo`): o que a habilidade é. Nome,
 * imagem, marcas e a "Descrição para ambientar", o único texto livre (a batalha não lê). A Ação vem logo
 * abaixo, na linha dela. A habilidade de antes convertida na leitura mostra a faixa "Confira" com o que
 * o leitor não entendeu (as linhas que a conversão pôs na Descrição) e o botão "Conferida".
 */
export function TopoDaHabilidade({ cartao, onChange, campoDoNome, comImagem, sugestoesDeMarca, ficouNoTexto }: TopoDaHabilidadeProps) {
  const nomeId = useId()
  const descricaoId = useId()
  const erroId = useId()
  const [erroDaImagem, setErroDaImagem] = useState<string | null>(null)
  const confira = linhasDoConfira(cartao)
  const semNome = cartao.nome.trim() === ''
  return (
    <section className="lb-ed__topo-hab" aria-label="Nome, imagem e ação">
      {confira.length > 0 && (
        <div className="lb-ed__confira" role="note">
          <div>
            <b>Convertida do texto antigo na leitura.</b> As linhas e peças abaixo vieram do texto; o que não deu para ler ficou na descrição:{' '}
            {confira.map((linha, indice) => (
              <q key={indice}>{linha}</q>
            ))}
            . Confira e marque como conferida.
          </div>
          <button type="button" className="lb-ed__bt lb-ed__bt--latao lb-ed__bt--p" onClick={() => onChange(semConfira(cartao), 'Conferida: as linhas "Confira" saíram da descrição.')}>
            Conferida
          </button>
        </div>
      )}
      {ficouNoTexto !== null && (
        <p className="lb-ed__confira lb-ed__confira--texto" role="note">
          <span>
            <b>Esta habilidade de antes ficou no texto</b>: {ficouNoTexto}. A batalha segue lendo o texto de antes até você montar as peças (comece de um modelo: o texto fica guardado em &quot;Texto de antes&quot;).
          </span>
        </p>
      )}
      <div className="lb-ed__topo">
        <div className="lb-ed__campo lb-ed__campo--nome">
          <label htmlFor={nomeId}>Nome</label>
          <input
            ref={campoDoNome}
            id={nomeId}
            className="lb-ed__entrada lb-ed__entrada--nome"
            value={cartao.nome}
            maxLength={NOME_MAX}
            placeholder="Nome da habilidade"
            aria-invalid={semNome ? true : undefined}
            aria-describedby={semNome ? erroId : undefined}
            onChange={(evento) => onChange({ ...cartao, nome: evento.target.value })}
          />
          {semNome && (
            <span className="lb-ed__erro" id={erroId}>
              Dê um nome: sem ele a habilidade não aparece na lista.
            </span>
          )}
        </div>
        {comImagem && (
          <div className="lb-ed__campo lb-ed__campo--imagem">
            <span className="lb-ed__rot">Imagem</span>
            <CampoQueColaImagem className="lb-ed__imagem" rotulo={`Imagem de ${cartao.nome.trim() || 'a habilidade'}: clique e cole com Ctrl+V`} onImagem={(imagem) => onChange({ ...cartao, imagem })} onAviso={setErroDaImagem}>
              <ImagemOuIniciais imagem={cartao.imagem} nome={cartao.nome} />
            </CampoQueColaImagem>
            {erroDaImagem !== null ? (
              <span className="lb-ed__erro" role="status">
                {erroDaImagem}
              </span>
            ) : (
              <span className="lb-ed__dica">clique e cole com Ctrl+V</span>
            )}
          </div>
        )}
        <MarcasNoTopo cartao={cartao} sugestoes={sugestoesDeMarca} onChange={onChange} />
        <div className="lb-ed__campo lb-ed__campo--desc">
          <label htmlFor={descricaoId}>
            Descrição para ambientar <span className="lb-ed__dica">como a cena parece; só para ler, a batalha não lê este texto</span>
          </label>
          <textarea
            id={descricaoId}
            className="lb-ed__entrada"
            rows={2}
            maxLength={DESCRICAO_MAX + confira.join('\n').length}
            value={cartao.campos[CAMPO_DA_DESCRICAO] ?? ''}
            placeholder="Ex.: uma flecha de fogo que corta o céu"
            onChange={(evento) => onChange({ ...cartao, campos: { ...cartao.campos, [CAMPO_DA_DESCRICAO]: evento.target.value } })}
          />
          <span className="lb-ed__dica">Sem regra aqui: o que a habilidade faz vem da Ação e das peças, e o cartão se escreve sozinho.</span>
        </div>
      </div>
    </section>
  )
}

/** As marcas do cartão ("Fogo"): o que o requisito "Ajuda de um aliado com Fogo" procura nas fichas dos aliados. */
function MarcasNoTopo({ cartao, sugestoes, onChange }: { cartao: CartaoDaFicha; sugestoes: readonly string[]; onChange: (cartao: CartaoDaFicha) => void }) {
  const listaId = useId()
  const [nova, setNova] = useState('')
  const marcas = lerMarcas(cartao.marcas)
  const gravar = (lista: readonly string[]) => {
    const guardadas = marcasGuardadas(lista)
    const { marcas: _antes, ...sem } = cartao
    onChange(guardadas === undefined ? sem : { ...sem, marcas: guardadas })
  }
  const por = () => {
    const texto = nova.trim()
    setNova('')
    if (texto === '' || marcas.some((marca) => mesmaMarca(marca, texto)) || marcas.length >= MARCAS_MAX) return
    gravar([...marcas, texto])
  }
  const livres = sugestoes.filter((marca) => !marcas.some((outra) => mesmaMarca(outra, marca)))
  return (
    <div className="lb-ed__campo lb-ed__campo--marcas">
      <span className="lb-ed__rot">Marcas (para requisitos e filtros)</span>
      <div className="lb-req__marcas">
        {marcas.map((marca) => (
          <span key={marca} className="lb-req__chip">
            {marca}
            <button type="button" className="lb-req__chip-x" aria-label={`Tirar a marca ${marca}`} onClick={() => gravar(marcas.filter((outra) => outra !== marca))}>
              ×
            </button>
          </span>
        ))}
        {marcas.length < MARCAS_MAX && (
          <input
            className="lb-req__txt"
            value={nova}
            maxLength={MARCA_MAX}
            placeholder="+ marca (ex.: Fogo)"
            aria-label="Nova marca"
            list={livres.length > 0 ? listaId : undefined}
            onChange={(evento) => setNova(evento.target.value)}
            onBlur={por}
            onKeyDown={(evento) => {
              if (evento.key !== 'Enter') return
              evento.preventDefault()
              por()
            }}
          />
        )}
        {livres.length > 0 && (
          <datalist id={listaId}>
            {livres.map((marca) => (
              <option key={marca} value={marca} />
            ))}
          </datalist>
        )}
      </div>
    </div>
  )
}
