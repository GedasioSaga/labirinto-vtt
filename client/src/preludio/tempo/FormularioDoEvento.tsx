import { useId, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { lerAno, lerDia, lerMes, type DadosDoEvento } from '../../lib/preparo/linhaDoTempo'
import type { Era, Verbete } from '../../lib/preparo/tipos'

/**
 * O EVENTO ABERTO NO LUGAR (E3c): título, era (ou "Sem data", que deixa na
 * bandeja), ano, mês e dia, resumo, sessão de origem e segredo. Enter num
 * campo de uma linha salva, Esc desiste. Salvar confere o ano ("Dar data"
 * sem ano não passa) e leva o foco ao primeiro campo com erro.
 */

export interface RascunhoDoEvento {
  readonly titulo: string
  readonly era: string
  readonly ano: string
  readonly mes: string
  readonly dia: string
  readonly resumo: string
  readonly sessaoId: string
  readonly segredo: boolean
}

type CampoComErro = 'titulo' | 'ano' | 'mes' | 'dia'
type Erros = Partial<Record<CampoComErro, string>>

const ORDEM_DOS_ERROS: readonly CampoComErro[] = ['titulo', 'ano', 'mes', 'dia']

interface FormularioDoEventoProps {
  novo: boolean
  inicial: RascunhoDoEvento
  eras: readonly Era[]
  sessoes: readonly Verbete[]
  /** O título de uma sessão que não está na lista (outra campanha, apagada). */
  tituloDaSessao: (sessaoId: string) => string | undefined
  /** Abriu pelo "Dar data": o foco começa no ano. */
  focarNoAno: boolean
  /** Devolve `false` quando não gravou (o formulário fica aberto, com o que foi digitado). */
  aoSalvar: (dados: DadosDoEvento) => Promise<boolean>
  aoCancelar: () => void
  aoApagar?: () => void
}

function validar(rascunho: RascunhoDoEvento): { erros: Erros; dados: DadosDoEvento | null } {
  const erros: Erros = {}
  const titulo = rascunho.titulo.trim()
  if (titulo === '') erros.titulo = 'Dê um título ao evento.'
  const semData = rascunho.era === ''
  const ano = semData ? { ok: true as const, valor: 0 } : lerAno(rascunho.ano)
  const mes = semData ? { ok: true as const, valor: undefined } : lerMes(rascunho.mes)
  const dia = semData ? { ok: true as const, valor: undefined } : lerDia(rascunho.dia)
  if (!ano.ok) erros.ano = ano.motivo
  if (!mes.ok) erros.mes = mes.motivo
  if (!dia.ok) erros.dia = dia.motivo
  if (!ano.ok || !mes.ok || !dia.ok || erros.titulo !== undefined) return { erros, dados: null }
  return {
    erros,
    dados: {
      titulo,
      era: rascunho.era,
      ano: ano.valor ?? 0,
      ...(mes.valor === undefined ? {} : { mes: mes.valor }),
      ...(mes.valor === undefined || dia.valor === undefined ? {} : { dia: dia.valor }),
      resumo: rascunho.resumo.trim(),
      ...(rascunho.sessaoId === '' ? {} : { sessaoId: rascunho.sessaoId }),
      segredo: rascunho.segredo,
    },
  }
}

export function FormularioDoEvento({ novo, inicial, eras, sessoes, tituloDaSessao, focarNoAno, aoSalvar, aoCancelar, aoApagar }: FormularioDoEventoProps) {
  const id = useId()
  const [rascunho, setRascunho] = useState(inicial)
  const [erros, setErros] = useState<Erros>({})
  const [gravando, setGravando] = useState(false)
  const campos = useRef<Partial<Record<CampoComErro, HTMLInputElement | null>>>({})
  const semData = rascunho.era === ''

  // Só ao abrir: o foco vai ao título (ou ao ano, no "Dar data"), com o texto selecionado.
  const focarNoAnoAoAbrir = useRef(focarNoAno)
  useLayoutEffect(() => {
    const campo = focarNoAnoAoAbrir.current ? campos.current.ano : campos.current.titulo
    campo?.focus()
    campo?.select()
  }, [])

  const mudar = <C extends keyof RascunhoDoEvento>(campo: C, valor: RascunhoDoEvento[C]) => {
    setRascunho((atual) => ({ ...atual, [campo]: valor }))
    if (campo in erros) setErros((atuais) => ({ ...atuais, [campo]: undefined }))
  }

  const salvar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    if (gravando) return
    const { erros: achados, dados } = validar(rascunho)
    setErros(achados)
    if (dados === null) {
      const primeiro = ORDEM_DOS_ERROS.find((campo) => achados[campo] !== undefined)
      if (primeiro !== undefined) campos.current[primeiro]?.focus()
      return
    }
    setGravando(true)
    const gravou = await aoSalvar(dados)
    if (!gravou) setGravando(false)
  }

  const aoTeclar = (evento: KeyboardEvent<HTMLFormElement>) => {
    if (evento.key !== 'Escape' || evento.nativeEvent.isComposing) return
    evento.preventDefault()
    evento.stopPropagation()
    aoCancelar()
  }

  const sessaoForaDaLista = rascunho.sessaoId !== '' && !sessoes.some((sessao) => sessao.id === rascunho.sessaoId)
  const erroDe = (campo: CampoComErro) =>
    erros[campo] === undefined ? {} : { 'aria-invalid': true as const, 'aria-describedby': `${id}-${campo}-erro` }
  const mensagem = (campo: CampoComErro) =>
    erros[campo] === undefined ? null : (
      <span className="lt-erro" id={`${id}-${campo}-erro`}>
        {erros[campo]}
      </span>
    )

  return (
    <form className="lt-form" noValidate aria-label={novo ? 'Novo evento' : 'Editar evento'} onSubmit={(evento) => void salvar(evento)} onKeyDown={aoTeclar}>
      <label className="pr-campo lt-form__c6">
        <span className="pr-campo__rotulo">Título</span>
        <input
          ref={(campo) => {
            campos.current.titulo = campo
          }}
          className="pr-campo__entrada"
          value={rascunho.titulo}
          maxLength={200}
          onChange={(evento) => mudar('titulo', evento.target.value)}
          {...erroDe('titulo')}
        />
        {mensagem('titulo')}
      </label>
      <label className="pr-campo lt-form__c2">
        <span className="pr-campo__rotulo">Era</span>
        <select className="pr-campo__entrada" value={rascunho.era} onChange={(evento) => mudar('era', evento.target.value)}>
          {eras.map((era) => (
            <option key={era.id} value={era.id}>
              {era.nome || 'Era sem nome'}
            </option>
          ))}
          <option value="">Sem data (fica na bandeja)</option>
        </select>
      </label>
      <label className="pr-campo lt-form__c2">
        <span className="pr-campo__rotulo">Ano</span>
        <input
          ref={(campo) => {
            campos.current.ano = campo
          }}
          className="pr-campo__entrada"
          inputMode="numeric"
          value={semData ? '' : rascunho.ano}
          disabled={semData}
          placeholder={semData ? 'sem data' : 'ex.: 1520'}
          onChange={(evento) => mudar('ano', evento.target.value)}
          {...erroDe('ano')}
        />
        {mensagem('ano')}
      </label>
      <label className="pr-campo">
        <span className="pr-campo__rotulo">Mês</span>
        <input
          ref={(campo) => {
            campos.current.mes = campo
          }}
          className="pr-campo__entrada"
          inputMode="numeric"
          value={semData ? '' : rascunho.mes}
          disabled={semData}
          placeholder="opcional"
          onChange={(evento) => mudar('mes', evento.target.value)}
          {...erroDe('mes')}
        />
        {mensagem('mes')}
      </label>
      <label className="pr-campo">
        <span className="pr-campo__rotulo">Dia</span>
        <input
          ref={(campo) => {
            campos.current.dia = campo
          }}
          className="pr-campo__entrada"
          inputMode="numeric"
          value={semData ? '' : rascunho.dia}
          disabled={semData || rascunho.mes.trim() === ''}
          placeholder="opcional"
          title={!semData && rascunho.mes.trim() === '' ? 'Dê o mês antes do dia.' : undefined}
          onChange={(evento) => mudar('dia', evento.target.value)}
          {...erroDe('dia')}
        />
        {mensagem('dia')}
      </label>
      <label className="pr-campo lt-form__c6">
        <span className="pr-campo__rotulo">Resumo</span>
        <textarea className="pr-campo__entrada lt-form__texto" rows={2} maxLength={2000} value={rascunho.resumo} onChange={(evento) => mudar('resumo', evento.target.value)} />
      </label>
      <label className="pr-campo lt-form__c3">
        <span className="pr-campo__rotulo">Sessão de origem</span>
        <select className="pr-campo__entrada" value={rascunho.sessaoId} onChange={(evento) => mudar('sessaoId', evento.target.value)}>
          <option value="">Nenhuma</option>
          {sessoes.map((sessao) => (
            <option key={sessao.id} value={sessao.id}>
              {sessao.titulo || 'Sessão sem nome'}
            </option>
          ))}
          {sessaoForaDaLista && <option value={rascunho.sessaoId}>{tituloDaSessao(rascunho.sessaoId) ?? 'Sessão que não existe mais'}</option>}
        </select>
      </label>
      <div className="lt-form__c3 lt-form__segredo">
        <label className="lt-check">
          <input type="checkbox" checked={rascunho.segredo} onChange={(evento) => mudar('segredo', evento.target.checked)} />
          Segredo (só o mestre vê)
        </label>
      </div>
      <div className="lt-form__pe">
        <span className="lt-form__esq">
          {aoApagar !== undefined && (
            <button type="button" className="gr-bt gr-bt--p gr-bt--perigo" disabled={gravando} onClick={aoApagar}>
              Apagar
            </button>
          )}
        </span>
        <button type="button" className="gr-bt gr-bt--p gr-bt--fantasma" onClick={aoCancelar}>
          Cancelar <kbd className="gr-kbd">Esc</kbd>
        </button>
        <button type="submit" className="gr-bt gr-bt--p gr-bt--primario" disabled={gravando}>
          {gravando ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </form>
  )
}
