import { useId } from 'react'
import {
  abaNova,
  atributoNovo,
  campoNovo,
  escolhaNova,
  moverLinha,
  previaDoRank,
  recursoNovo,
  tirarLinha,
  trocarLinha,
  type RascunhoDeAba,
  type RascunhoDeAtributo,
  type RascunhoDeCampo,
  type RascunhoDeEscolha,
  type RascunhoDeRecurso,
  type RascunhoDoSistema,
} from '../lib/editorDeSistema'
import { COR_PADRAO, corValida, type FormaDoCampo, type TomDoRecurso } from '../lib/sistemaDeRpg'
import { iniciais } from './FichaPecas'
import { Toggle } from './Toggle'

/**
 * As seções do EDITOR DE SISTEMA que são listas curtas, desenhadas inteiras:
 * Geral, Escolhas, Recursos, Atributos e Abas. Catálogos e Livro, que passam
 * de cem itens, ficam em `EditorDeSistemaLivro.tsx` (lista e detalhe). Cada
 * seção só troca o rascunho por `mudar`; quem valida e grava é a janela
 * (`EditorDeSistemaDialog`).
 */

export type MudarRascunho = (mudanca: (atual: RascunhoDoSistema) => RascunhoDoSistema) => void

export interface SecaoDoEditorProps {
  rascunho: RascunhoDoSistema
  mudar: MudarRascunho
}

/** O nome do sistema e os rótulos curtos: os tetos de quem os mostra (cartão da grade, chip da ficha). */
const NOME_DO_SISTEMA_MAX = 80
const ROTULO_MAX = 80
const ABREVIACAO_MAX = 8
const ID_MAX = 64

export const DICA_DO_ID = 'O id de cada parte não muda depois de salvo: é a chave do valor dentro de cada ficha. Na parte nova, vazio = sai do nome.'

interface CampoDeTextoProps {
  rotulo: string
  valor: string
  onChange: (valor: string) => void
  dica?: string
  placeholder?: string
  maxLength?: number
  /** Com `linhas`, o campo é um texto de várias linhas. */
  linhas?: number
  somenteLeitura?: boolean
  className?: string
}

export function CampoDeTexto({ rotulo, valor, onChange, dica, placeholder, maxLength, linhas, somenteLeitura, className }: CampoDeTextoProps) {
  const id = useId()
  const dicaId = `${id}-dica`
  const descrito = dica === undefined ? undefined : dicaId
  return (
    <div className={className === undefined ? 'lb-field lb-sistema-editor__campo' : `lb-field lb-sistema-editor__campo ${className}`}>
      <label className="lb-label" htmlFor={id}>
        {rotulo}
      </label>
      {linhas === undefined ? (
        <input
          id={id}
          type="text"
          className="lb-input"
          value={valor}
          placeholder={placeholder}
          maxLength={maxLength}
          readOnly={somenteLeitura}
          aria-describedby={descrito}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <textarea
          id={id}
          className="lb-input lb-textarea"
          rows={linhas}
          value={valor}
          placeholder={placeholder}
          maxLength={maxLength}
          readOnly={somenteLeitura}
          aria-describedby={descrito}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {dica !== undefined && (
        <p id={dicaId} className="lb-field__hint">
          {dica}
        </p>
      )}
    </div>
  )
}

/** O id da linha: digitável enquanto ela é nova; salva, só se lê. */
function CampoDeId({ linha, onChange }: { linha: { id: string; novo: boolean }; onChange: (id: string) => void }) {
  return (
    <CampoDeTexto
      rotulo="Id"
      valor={linha.id}
      onChange={onChange}
      somenteLeitura={!linha.novo}
      placeholder="automático (do nome)"
      maxLength={ID_MAX}
      className="lb-sistema-editor__id"
    />
  )
}

interface SeletorProps<T extends string> {
  rotulo: string
  valor: T
  opcoes: readonly { valor: T; rotulo: string }[]
  onChange: (valor: T) => void
}

function Seletor<T extends string>({ rotulo, valor, opcoes, onChange }: SeletorProps<T>) {
  const id = useId()
  return (
    <div className="lb-field lb-sistema-editor__campo">
      <label className="lb-label" htmlFor={id}>
        {rotulo}
      </label>
      <select
        id={id}
        className="lb-input"
        value={valor}
        onChange={(event) => {
          const escolhida = opcoes.find((opcao) => opcao.valor === event.target.value)
          if (escolhida !== undefined) onChange(escolhida.valor)
        }}
      >
        {opcoes.map((opcao) => (
          <option key={opcao.valor} value={opcao.valor}>
            {opcao.rotulo}
          </option>
        ))}
      </select>
    </div>
  )
}

interface AcoesDaLinhaProps {
  /** O nome da linha, para o leitor de tela dizer qual sobe, desce ou sai. */
  nome: string
  primeira: boolean
  ultima: boolean
  onMover: (passo: -1 | 1) => void
  onTirar: () => void
}

function AcoesDaLinha({ nome, primeira, ultima, onMover, onTirar }: AcoesDaLinhaProps) {
  return (
    <div className="lb-sistema-editor__linha-acoes">
      <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" aria-label={`Subir ${nome}`} title="Subir" disabled={primeira} onClick={() => onMover(-1)}>
        ↑
      </button>
      <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" aria-label={`Descer ${nome}`} title="Descer" disabled={ultima} onClick={() => onMover(1)}>
        ↓
      </button>
      <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact lb-sistema-editor__tirar" aria-label={`Tirar ${nome}`} onClick={onTirar}>
        Tirar
      </button>
    </div>
  )
}

/** Troca uma lista do rascunho pela função dada, sempre sobre o rascunho de agora. */
function mudarLista<K extends 'escolhas' | 'recursos' | 'atributos' | 'abas'>(mudar: MudarRascunho, chave: K) {
  return (mudanca: (lista: RascunhoDoSistema[K]) => RascunhoDoSistema[K]) => mudar((atual) => ({ ...atual, [chave]: mudanca(atual[chave]) }))
}

// ───────────────────────────────────────────────────────────────────────────

export function SecaoGeral({ rascunho, mudar }: SecaoDoEditorProps) {
  const corId = useId()
  const trocar = (parcial: Partial<RascunhoDoSistema>) => mudar((atual) => ({ ...atual, ...parcial }))
  return (
    <div className="lb-sistema-editor__secao-corpo">
      <div className="lb-sistema-editor__capa-linha">
        <span className="lb-sistema__capa lb-sistema-editor__capa" style={{ backgroundColor: corValida(rascunho.cor) ? rascunho.cor : COR_PADRAO }} aria-hidden="true">
          {iniciais(rascunho.nome.trim() || '?')}
        </span>
        <div className="lb-field">
          <label className="lb-label" htmlFor={corId}>
            Cor da capa
          </label>
          <input id={corId} type="color" className="lb-sistema-editor__cor" value={(corValida(rascunho.cor) ? rascunho.cor : COR_PADRAO).toLowerCase()} onChange={(event) => trocar({ cor: event.target.value })} />
        </div>
      </div>
      <CampoDeTexto rotulo="Nome" valor={rascunho.nome} onChange={(nome) => trocar({ nome })} maxLength={NOME_DO_SISTEMA_MAX} placeholder="Como o sistema aparece na grade" />
      <CampoDeTexto rotulo="Versão" valor={rascunho.versao} onChange={(versao) => trocar({ versao })} maxLength={ROTULO_MAX} className="lb-sistema-editor__curto" />
      <CampoDeTexto rotulo="Descrição" valor={rascunho.descricao} onChange={(descricao) => trocar({ descricao })} linhas={3} />
      <p className="lb-field__hint">
        {rascunho.novo
          ? 'O id do sistema (o nome do arquivo na biblioteca) sai do nome quando você salvar.'
          : `Id ${rascunho.id}: o arquivo ${rascunho.id}.json da biblioteca. Não muda — é por ele que as aventuras acham o sistema.`}
      </p>
    </div>
  )
}

export function SecaoEscolhas({ rascunho, mudar }: SecaoDoEditorProps) {
  const lista = rascunho.escolhas
  const trocarLista = mudarLista(mudar, 'escolhas')
  const trocar = (chave: string, parcial: Partial<RascunhoDeEscolha>) => trocarLista((atual) => trocarLinha(atual, chave, parcial))
  return (
    <div className="lb-sistema-editor__secao-corpo">
      <p className="lb-field__hint">Listas fechadas da ficha (Raça, Ofício): a opção escolhida aparece como chip no topo. {DICA_DO_ID}</p>
      <ol className="lb-sistema-editor__lista">
        {lista.map((escolha, i) => {
          const nome = escolha.rotulo.trim() || `Escolha ${i + 1}`
          return (
            <li key={escolha.chave} className="lb-sistema-editor__linha">
              <div className="lb-sistema-editor__grade">
                <CampoDeTexto rotulo="Rótulo" valor={escolha.rotulo} onChange={(rotulo) => trocar(escolha.chave, { rotulo })} maxLength={ROTULO_MAX} placeholder="Raça" />
                <CampoDeId linha={escolha} onChange={(id) => trocar(escolha.chave, { id })} />
              </div>
              <CampoDeTexto rotulo="Opções" dica="Uma por linha." valor={escolha.opcoes} onChange={(opcoes) => trocar(escolha.chave, { opcoes })} linhas={4} />
              <AcoesDaLinha
                nome={nome}
                primeira={i === 0}
                ultima={i === lista.length - 1}
                onMover={(passo) => trocarLista((atual) => moverLinha(atual, escolha.chave, passo))}
                onTirar={() => trocarLista((atual) => tirarLinha(atual, escolha.chave))}
              />
            </li>
          )
        })}
      </ol>
      <button type="button" className="lb-btn lb-sistema-editor__mais" onClick={() => trocarLista((atual) => [...atual, escolhaNova()])}>
        + Escolha
      </button>
    </div>
  )
}

const TONS: readonly { valor: TomDoRecurso; rotulo: string }[] = [
  { valor: 'vida', rotulo: 'Vida (vermelho)' },
  { valor: 'energia', rotulo: 'Energia (azul)' },
  { valor: 'neutro', rotulo: 'Neutro' },
]

export function SecaoRecursos({ rascunho, mudar }: SecaoDoEditorProps) {
  const lista = rascunho.recursos
  const trocarLista = mudarLista(mudar, 'recursos')
  const trocar = (chave: string, parcial: Partial<RascunhoDeRecurso>) => trocarLista((atual) => trocarLinha(atual, chave, parcial))
  return (
    <div className="lb-sistema-editor__secao-corpo">
      <p className="lb-field__hint">Os quadrinhos numerados da ficha (HP, SP, Escudo). {DICA_DO_ID}</p>
      <ol className="lb-sistema-editor__lista">
        {lista.map((recurso, i) => {
          const nome = recurso.nome.trim() || `Recurso ${i + 1}`
          return (
            <li key={recurso.chave} className="lb-sistema-editor__linha">
              <div className="lb-sistema-editor__grade lb-sistema-editor__grade--3">
                <CampoDeTexto rotulo="Nome" valor={recurso.nome} onChange={(valor) => trocar(recurso.chave, { nome: valor })} maxLength={ROTULO_MAX} placeholder="HP" />
                <Seletor rotulo="Tom" valor={recurso.tom} opcoes={TONS} onChange={(tom) => trocar(recurso.chave, { tom })} />
                <CampoDeId linha={recurso} onChange={(id) => trocar(recurso.chave, { id })} />
              </div>
              <Toggle label="Atual e máximo (HP 450/600)" checked={recurso.atualEMaximo} onChange={(atualEMaximo) => trocar(recurso.chave, { atualEMaximo })} />
              <AcoesDaLinha
                nome={nome}
                primeira={i === 0}
                ultima={i === lista.length - 1}
                onMover={(passo) => trocarLista((atual) => moverLinha(atual, recurso.chave, passo))}
                onTirar={() => trocarLista((atual) => tirarLinha(atual, recurso.chave))}
              />
            </li>
          )
        })}
      </ol>
      <button type="button" className="lb-btn lb-sistema-editor__mais" onClick={() => trocarLista((atual) => [...atual, recursoNovo()])}>
        + Recurso
      </button>
    </div>
  )
}

function LinhaDoAtributo({ atributo, trocar }: { atributo: RascunhoDeAtributo; trocar: (parcial: Partial<RascunhoDeAtributo>) => void }) {
  return (
    <>
      <div className="lb-sistema-editor__grade lb-sistema-editor__grade--3">
        <CampoDeTexto rotulo="Nome" valor={atributo.nome} onChange={(nome) => trocar({ nome })} maxLength={ROTULO_MAX} placeholder="Força" />
        <CampoDeTexto rotulo="Abreviação" valor={atributo.abreviacao} onChange={(abreviacao) => trocar({ abreviacao })} maxLength={ABREVIACAO_MAX} placeholder="FOR" />
        <CampoDeId linha={atributo} onChange={(id) => trocar({ id })} />
      </div>
      <Toggle label="Tem rank (tabela de limiares)" checked={atributo.comRank} onChange={(comRank) => trocar({ comRank })} />
      {atributo.comRank && (
        <div className="lb-sistema-editor__rank">
          <CampoDeTexto rotulo="Rank inicial" valor={atributo.inicial} onChange={(inicial) => trocar({ inicial })} className="lb-sistema-editor__curto" />
          <CampoDeTexto
            rotulo="Limiares"
            dica="Separados por vírgula, crescendo: o rank sobe um a cada limiar alcançado."
            valor={atributo.limiares}
            onChange={(limiares) => trocar({ limiares })}
            placeholder="40, 90, 150"
          />
          <CampoDeTexto rotulo="Testar valor" valor={atributo.teste} onChange={(teste) => trocar({ teste })} className="lb-sistema-editor__curto" />
          <output className="lb-sistema-editor__previa-rank">{previaDoRank(atributo)}</output>
        </div>
      )}
    </>
  )
}

export function SecaoAtributos({ rascunho, mudar }: SecaoDoEditorProps) {
  const lista = rascunho.atributos
  const trocarLista = mudarLista(mudar, 'atributos')
  return (
    <div className="lb-sistema-editor__secao-corpo">
      <p className="lb-field__hint">Os números da ficha, com o rank de cada um. O sistema precisa de pelo menos um. {DICA_DO_ID}</p>
      <ol className="lb-sistema-editor__lista">
        {lista.map((atributo, i) => (
          <li key={atributo.chave} className="lb-sistema-editor__linha">
            <LinhaDoAtributo atributo={atributo} trocar={(parcial) => trocarLista((atual) => trocarLinha(atual, atributo.chave, parcial))} />
            <AcoesDaLinha
              nome={atributo.nome.trim() || `Atributo ${i + 1}`}
              primeira={i === 0}
              ultima={i === lista.length - 1}
              onMover={(passo) => trocarLista((atual) => moverLinha(atual, atributo.chave, passo))}
              onTirar={() => trocarLista((atual) => tirarLinha(atual, atributo.chave))}
            />
          </li>
        ))}
      </ol>
      <button type="button" className="lb-btn lb-sistema-editor__mais" onClick={() => trocarLista((atual) => [...atual, atributoNovo()])}>
        + Atributo
      </button>
    </div>
  )
}

const FORMAS: readonly { valor: FormaDoCampo; rotulo: string }[] = [
  { valor: 'paragrafo', rotulo: 'Parágrafo (texto corrido, sem rótulo)' },
  { valor: 'linha', rotulo: 'Linha (Rótulo: valor)' },
  { valor: 'destaque', rotulo: 'Destaque (bloco com fundo)' },
]

/** Muda a aba a partir dela mesma, como está AGORA no rascunho (não como estava quando a tela desenhou). */
type MudarAba = (mudanca: (aba: RascunhoDeAba) => RascunhoDeAba) => void

function CamposDaAba({ aba, mudarAba }: { aba: RascunhoDeAba; mudarAba: MudarAba }) {
  const trocarCampos = (mudanca: (campos: RascunhoDeCampo[]) => RascunhoDeCampo[]) => mudarAba((atual) => ({ ...atual, campos: mudanca(atual.campos) }))
  const nomeDaAba = aba.nome.trim() || 'a aba'
  return (
    <div className="lb-sistema-editor__campos">
      <p className="lb-eyebrow">Campos do cartão</p>
      <ol className="lb-sistema-editor__lista lb-sistema-editor__lista--dentro">
        {aba.campos.map((campo, j) => (
          <li key={campo.chave} className="lb-sistema-editor__linha lb-sistema-editor__linha--dentro">
            <div className="lb-sistema-editor__grade lb-sistema-editor__grade--3">
              <CampoDeTexto rotulo="Rótulo" valor={campo.rotulo} onChange={(rotulo) => trocarCampos((campos) => trocarLinha(campos, campo.chave, { rotulo }))} maxLength={ROTULO_MAX} placeholder="Efeito" />
              <Seletor rotulo="Forma" valor={campo.forma} opcoes={FORMAS} onChange={(forma) => trocarCampos((campos) => trocarLinha(campos, campo.chave, { forma }))} />
              <CampoDeId linha={campo} onChange={(id) => trocarCampos((campos) => trocarLinha(campos, campo.chave, { id }))} />
            </div>
            <AcoesDaLinha
              nome={`${campo.rotulo.trim() || `campo ${j + 1}`} de ${nomeDaAba}`}
              primeira={j === 0}
              ultima={j === aba.campos.length - 1}
              onMover={(passo) => trocarCampos((campos) => moverLinha(campos, campo.chave, passo))}
              onTirar={() => trocarCampos((campos) => tirarLinha(campos, campo.chave))}
            />
          </li>
        ))}
      </ol>
      <button type="button" className="lb-btn lb-btn--compact lb-sistema-editor__mais" onClick={() => trocarCampos((campos) => [...campos, campoNovo()])}>
        + Campo
      </button>
    </div>
  )
}

function LinhaDaAba({ aba, abas, mudarAba }: { aba: RascunhoDeAba; abas: readonly RascunhoDeAba[]; mudarAba: MudarAba }) {
  const trocar = (parcial: Partial<RascunhoDeAba>) => mudarAba((atual) => ({ ...atual, ...parcial }))
  const nome = aba.nome.trim()
  const outras = abas.filter((outra) => outra.chave !== aba.chave)
  const alvo = abas.find((outra) => outra.chave === aba.subcartoes)
  const opcoesDeDentro = [{ valor: '', rotulo: 'Nenhum' }, ...outras.map((outra, i) => ({ valor: outra.chave, rotulo: outra.nome.trim() || `Aba sem nome ${i + 1}` }))]
  // A aba de dentro que sumiu continua na lista para o erro ter o que mostrar até alguém trocar.
  if (aba.subcartoes.length > 0 && alvo === undefined) opcoesDeDentro.push({ valor: aba.subcartoes, rotulo: '(aba apagada)' })
  return (
    <>
      <div className="lb-sistema-editor__grade lb-sistema-editor__grade--3">
        <CampoDeTexto rotulo="Nome" valor={aba.nome} onChange={(valor) => trocar({ nome: valor })} maxLength={ROTULO_MAX} placeholder="Habilidades" />
        <CampoDeTexto rotulo="Nome de um cartão" valor={aba.item} onChange={(item) => trocar({ item })} maxLength={ROTULO_MAX} placeholder={nome || 'Habilidade'} />
        <CampoDeId linha={aba} onChange={(id) => trocar({ id })} />
      </div>
      <CampoDeTexto rotulo="Texto da aba vazia" valor={aba.vazio} onChange={(vazio) => trocar({ vazio })} maxLength={ROTULO_MAX * 2} placeholder={`Nada em ${nome || 'esta aba'}.`} />
      <fieldset className="lb-sistema-editor__partes">
        <legend className="lb-eyebrow">Partes do cartão</legend>
        <Toggle label="Linhas livres (nome: valor)" checked={aba.extras} onChange={(extras) => trocar({ extras })} />
        <Toggle label="Escolhe atributos do sistema" checked={aba.atributos} onChange={(atributos) => trocar({ atributos })} />
        <Toggle label="Imagem própria" checked={aba.imagem} onChange={(imagem) => trocar({ imagem })} />
        <Toggle label="Soma ou tira pontos de atributos" checked={aba.modificadores} onChange={(modificadores) => trocar({ modificadores })} />
      </fieldset>
      <div className="lb-sistema-editor__grade">
        <Seletor rotulo="Cartões de outra aba dentro deste" valor={aba.subcartoes} opcoes={opcoesDeDentro} onChange={(subcartoes) => trocar({ subcartoes })} />
        {aba.subcartoes.length > 0 && (
          <CampoDeTexto
            rotulo="Rótulo dos cartões de dentro"
            valor={aba.rotuloDosSubcartoes}
            onChange={(rotuloDosSubcartoes) => trocar({ rotuloDosSubcartoes })}
            maxLength={ROTULO_MAX}
            placeholder={alvo === undefined ? '' : alvo.item.trim() || alvo.nome.trim()}
          />
        )}
      </div>
      <CamposDaAba aba={aba} mudarAba={mudarAba} />
    </>
  )
}

export function SecaoAbas({ rascunho, mudar }: SecaoDoEditorProps) {
  const lista = rascunho.abas
  const trocarLista = mudarLista(mudar, 'abas')
  return (
    <div className="lb-sistema-editor__secao-corpo">
      <p className="lb-field__hint">As abas de cartões da ficha (Habilidades, Perícias…) e o molde de cada cartão. {DICA_DO_ID}</p>
      <ol className="lb-sistema-editor__lista">
        {lista.map((aba, i) => (
          <li key={aba.chave} className="lb-sistema-editor__linha">
            <LinhaDaAba aba={aba} abas={lista} mudarAba={(mudanca) => trocarLista((atual) => atual.map((linha) => (linha.chave === aba.chave ? mudanca(linha) : linha)))} />
            <AcoesDaLinha
              nome={aba.nome.trim() || `Aba ${i + 1}`}
              primeira={i === 0}
              ultima={i === lista.length - 1}
              onMover={(passo) => trocarLista((atual) => moverLinha(atual, aba.chave, passo))}
              onTirar={() => trocarLista((atual) => tirarLinha(atual, aba.chave))}
            />
          </li>
        ))}
      </ol>
      <button type="button" className="lb-btn lb-sistema-editor__mais" onClick={() => trocarLista((atual) => [...atual, abaNova()])}>
        + Aba
      </button>
    </div>
  )
}
