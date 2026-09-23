// JORNADA DE USUÁRIO — "apaguei o NPC da estante, e as fotos dele saíram do
// disco junto".
//
// O QUE ESTA JORNADA COBRA, e que nenhuma outra cobra hoje:
//   Apagar um item do acervo tem de tirar da PASTA os arquivos de imagem
//   daquele item — não só sumir o nome da lista. A jornada conta o que sobrou
//   na pasta, não o que sobrou no índice.
//
// POR QUE ELA PRECISOU EXISTIR (varredura de 18/09/2026, achado
// `task-jornada-acervo-de-tokens.spec.ts:398`, status CONFIRMADO):
//   cada item deixa até DOIS arquivos na pasta (`token_<id>_original.<ext>`
//   sempre, mais `token_<id>.webp` quando houve reamostragem —
//   `lib/imageImport.ts`). `apagarDoAcervo` varre a pasta por prefixo para
//   remover os dois (`lib/tokenLibrary.ts`), e o `catch` em volta da varredura
//   engole qualquer falha de propósito. A jornada selada só confere que o item
//   sumiu da LISTA. Se a varredura quebrar, o mestre que salva e apaga 100
//   NPCs acumula 200 imagens órfãs no `%APPDATA%` para sempre — e a suíte fica
//   verde, porque o erro mora dentro de um `catch` mudo.
//
// SOBRE LER O DISCO NUMA JORNADA: a única leitura de `sessionStorage` aqui é
// do DISCO DE MENTIRA — o sistema de arquivos falso que esta jornada mesma
// criou, o equivalente a um `fs.existsSync` numa suíte comum. Nenhuma leitura
// toca a store do app, e nada é escrito. As afirmações sobre o que a PESSOA vê
// continuam todas na tela (nome na lista, miniatura que carrega, aviso).
//
// REGRAS DE JORNADA respeitadas: gesto real de ponteiro e teclado; nenhum
// `evaluate` que mude estado do app.
import { test, expect, type Page } from '@playwright/test'
import { enterEditor } from './helpers/enterEditor'

/** 64x64 px, vermelho chapado — PNG de verdade, para o pipeline de
 *  `lib/imageImport.ts` rodar inteiro e gravar bytes de verdade na pasta. */
const FOTO_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAS0lEQVR42u3PQQkAAAgAsetfWiP4FgYrsKZeS0BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEDgsqnc8OJg6Ln3AAAAAElFTkSuQmCC'
const FOTO_NO_DISCO_DO_MESTRE = 'C:/fotos/npc.png'

/** Onde o acervo mora no disco de mentira (`appDataDir()` + `tokens`). */
const PASTA_DO_ACERVO = 'C:/appdata/tokens'

// ───────────────────────────────────────────────────────────────────────────
// Disco de mentira
// ───────────────────────────────────────────────────────────────────────────

type InternalsDoTauri = {
  metadata: { currentWindow: { label: string }; currentWebview: { windowLabel: string; label: string } }
  invoke: (cmd: string, args?: unknown, options?: { headers?: Record<string, string> }) => Promise<unknown>
  transformCallback: () => number
  convertFileSrc: (filePath: string, protocol?: string) => string
}
type JanelaDoMestre = { isTauri: boolean; __TAURI_INTERNALS__: InternalsDoTauri }

interface DiscoSalvo {
  textos: Record<string, string>
  binarios: Record<string, number[]>
  pastas: string[]
}

/** Chave do disco de mentira em `sessionStorage` — a jornada só LÊ daqui. */
const CHAVE_DO_DISCO = 'labirinto.disco-de-mentira'

/**
 * Disco e seletor de arquivo de mentira.
 *
 * `convertFileSrc` devolve os BYTES daquele caminho (e não uma foto fixa),
 * para a miniatura que continua na estante ser prova de que o arquivo DELA
 * continua legível no disco depois de o vizinho ter sido apagado.
 *
 * `travarApagarImagem` faz o sistema recusar a remoção dos arquivos de imagem,
 * com a mesma cara de "arquivo aberto em outro programa" que o próprio código
 * do acervo prevê (`motivoEmPortugues`, em `lib/tokenLibrary.ts`, traduz
 * `os error 5`/`os error 32`). É o antivírus, o OneDrive ou o visualizador de
 * fotos do Windows segurando o arquivo — nada exótico.
 */
async function discoDoMestre(page: Page, opcoes: { travarApagarImagem?: boolean } = {}): Promise<void> {
  await page.addInitScript(
    (entrada: { foto: string; origem: string; travarApagarImagem: boolean }) => {
      const CHAVE = 'labirinto.disco-de-mentira'
      const alvo = window as unknown as JanelaDoMestre
      const vazio: DiscoSalvo = { textos: {}, binarios: {}, pastas: [] }
      let disco: DiscoSalvo = vazio
      try {
        const bruto = window.sessionStorage.getItem(CHAVE)
        disco = bruto === null ? vazio : (JSON.parse(bruto) as DiscoSalvo)
      } catch {
        disco = vazio
      }
      const gravar = () => {
        try {
          window.sessionStorage.setItem(CHAVE, JSON.stringify(disco))
        } catch {
          // Cota estourada só deixa o último arquivo sem persistir; a jornada
          // falha na asserção seguinte, que é onde ela deve falhar.
        }
      }
      gravar()

      const bytesDaFoto = Array.from(Uint8Array.from(atob(entrada.foto), (c) => c.charCodeAt(0)))
      const bytesEm = (caminho: string): number[] | null => {
        if (caminho in disco.binarios) return disco.binarios[caminho]
        if (caminho === entrada.origem) return bytesDaFoto
        return null
      }
      const existe = (caminho: string): boolean =>
        caminho in disco.textos || caminho in disco.binarios || disco.pastas.indexOf(caminho) !== -1
      const ehArquivoDeImagem = (caminho: string): boolean => {
        const nome = caminho.slice(caminho.lastIndexOf('/') + 1)
        return nome.indexOf('token_') === 0
      }

      alvo.isTauri = true
      alvo.__TAURI_INTERNALS__ = {
        metadata: { currentWindow: { label: 'main' }, currentWebview: { windowLabel: 'main', label: 'main' } },
        transformCallback: () => 0,
        convertFileSrc: (caminho: string) => {
          const bytes = bytesEm(String(caminho))
          if (bytes === null) return String(caminho)
          const extensao = String(caminho).split('.').pop()
          const tipo = extensao === 'webp' ? 'webp' : extensao === 'jpg' || extensao === 'jpeg' ? 'jpeg' : 'png'
          let texto = ''
          for (const b of bytes) texto += String.fromCharCode(b)
          return `data:image/${tipo};base64,${btoa(texto)}`
        },
        invoke: async (cmd, args, options) => {
          const a = (args ?? {}) as Record<string, unknown>
          switch (cmd) {
            case 'plugin:path|resolve_directory':
              return 'C:/appdata'
            case 'plugin:path|join':
              return (a.paths as string[]).join('/')
            case 'plugin:path|dirname': {
              const p = String(a.path)
              return p.slice(0, Math.max(0, p.lastIndexOf('/')))
            }
            case 'plugin:fs|exists':
              return existe(String(a.path))
            case 'plugin:fs|mkdir': {
              if (disco.pastas.indexOf(String(a.path)) === -1) disco.pastas.push(String(a.path))
              gravar()
              return null
            }
            case 'plugin:fs|write_text_file': {
              const caminho = decodeURIComponent(options?.headers?.path ?? '')
              disco.textos[caminho] = new TextDecoder().decode(args as Uint8Array)
              gravar()
              return null
            }
            case 'plugin:fs|read_text_file': {
              const caminho = String(a.path)
              if (!(caminho in disco.textos)) throw new Error(`arquivo não existe: ${caminho}`)
              return Array.from(new TextEncoder().encode(disco.textos[caminho]))
            }
            case 'plugin:fs|write_file': {
              const caminho = decodeURIComponent(options?.headers?.path ?? '')
              disco.binarios[caminho] = Array.from(args as Uint8Array)
              gravar()
              return null
            }
            case 'plugin:fs|read_file': {
              const bytes = bytesEm(String(a.path))
              if (bytes === null) throw new Error(`arquivo não existe: ${String(a.path)}`)
              return bytes
            }
            case 'plugin:fs|rename': {
              const de = String(a.oldPath)
              const para = String(a.newPath)
              if (de in disco.textos) {
                disco.textos[para] = disco.textos[de]
                delete disco.textos[de]
              }
              if (de in disco.binarios) {
                disco.binarios[para] = disco.binarios[de]
                delete disco.binarios[de]
              }
              gravar()
              return null
            }
            case 'plugin:fs|remove': {
              const caminho = String(a.path)
              if (entrada.travarApagarImagem && ehArquivoDeImagem(caminho)) {
                throw new Error('Access is denied. (os error 5)')
              }
              delete disco.textos[caminho]
              delete disco.binarios[caminho]
              disco.pastas = disco.pastas.filter((p) => p !== caminho)
              gravar()
              return null
            }
            case 'plugin:fs|read_dir': {
              const prefixo = `${String(a.path).replace(/[/]+$/, '')}/`
              const nomes = Object.keys(disco.textos)
                .concat(Object.keys(disco.binarios))
                .filter((p) => p.indexOf(prefixo) === 0)
                .map((p) => p.slice(prefixo.length))
                .filter((nome) => nome.length > 0 && nome.indexOf('/') === -1)
              return nomes.map((name) => ({ name, isDirectory: false, isFile: true, isSymlink: false }))
            }
            case 'plugin:dialog|open':
              return entrada.origem
            case 'plugin:event|listen':
              return 1
            default:
              return null
          }
        },
      }
    },
    { foto: FOTO_BASE64, origem: FOTO_NO_DISCO_DO_MESTRE, travarApagarImagem: opcoes.travarApagarImagem === true },
  )
}

/**
 * Nomes dos arquivos de IMAGEM que estão na pasta do acervo, agora.
 *
 * Lê o disco de mentira que esta jornada criou — nunca a store do app — e não
 * escreve nada. É o `dir %APPDATA%\com.labirinto.app\tokens` que uma pessoa
 * faria para conferir se a foto saiu mesmo.
 */
async function imagensNaPastaDoAcervo(page: Page): Promise<string[]> {
  return page.evaluate(
    ([chave, pasta]: [string, string]) => {
      const bruto = window.sessionStorage.getItem(chave)
      if (bruto === null) return []
      const disco = JSON.parse(bruto) as { binarios: Record<string, number[]> }
      const prefixo = `${pasta}/`
      return Object.keys(disco.binarios)
        .filter((caminho) => caminho.indexOf(prefixo) === 0)
        .map((caminho) => caminho.slice(prefixo.length))
        .filter((nome) => nome.length > 0 && nome.indexOf('/') === -1)
        .sort()
    },
    [CHAVE_DO_DISCO, PASTA_DO_ACERVO] as [string, string],
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Gestos que a pessoa faz
// ───────────────────────────────────────────────────────────────────────────

/** "Adicionar token" → nome → "Escolher imagem..." → diálogo do sistema. */
async function criarTokenComFoto(page: Page, nome: string): Promise<void> {
  await page.getByRole('button', { name: 'Adicionar token', exact: true }).click()
  const campo = page.getByRole('textbox', { name: 'Nome do novo token' })
  await campo.click()
  await campo.pressSequentially(nome, { delay: 20 })
  await campo.press('Enter')
  await expect(page.getByRole('button', { name: 'Apagar token selecionado' })).toBeVisible()

  await page.getByRole('button', { name: 'Escolher imagem...' }).click()
  await expect(page.getByRole('button', { name: 'Trocar imagem...' })).toBeVisible({ timeout: 15_000 })
}

/** Guarda o token na estante e tira a peça do mapa. */
async function guardarNoAcervoELimparOMapa(page: Page, nome: string): Promise<void> {
  await page.getByRole('button', { name: 'Salvar no acervo' }).click()
  await expect(page.getByRole('button', { name: `Colocar ${nome} no mapa` })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Apagar token selecionado' }).click()
  await expect(page.getByRole('button', { name: 'Apagar token selecionado' })).toHaveCount(0)
}

/** Apagar pelo caminho da tela: o × do item, e a confirmação que repete o nome. */
async function apagarDaEstante(page: Page, nome: string): Promise<void> {
  await page.getByRole('button', { name: `Apagar ${nome} do acervo` }).click()
  await page.getByRole('button', { name: `Apagar ${nome} para sempre` }).click()
}

// ───────────────────────────────────────────────────────────────────────────
// As jornadas
// ───────────────────────────────────────────────────────────────────────────

test('CONTROLE POSITIVO: apagar um NPC da estante tira as fotos DELE da pasta e não encosta nas do vizinho', async ({ page }) => {
  test.setTimeout(180_000)
  await discoDoMestre(page)
  await enterEditor(page)

  await criarTokenComFoto(page, 'Goblin')
  await guardarNoAcervoELimparOMapa(page, 'Goblin')
  await criarTokenComFoto(page, 'Orc')
  await guardarNoAcervoELimparOMapa(page, 'Orc')

  // Dois NPCs guardados = dois arquivos de imagem na pasta. Se um dia o
  // importador voltar a deixar o original AO LADO da versão reduzida, este
  // número sobe e a jornada avisa, em vez de fingir que não viu.
  const antes = await imagensNaPastaDoAcervo(page)
  expect(antes, `a pasta do acervo tinha de ter uma imagem por NPC guardado; tem ${antes.join(', ') || '(nenhuma)'}`).toHaveLength(2)

  // ── ela apaga o Goblin, pelo caminho da tela ─────────────────────────────
  await apagarDaEstante(page, 'Goblin')
  await expect(page.getByRole('button', { name: 'Colocar Goblin no mapa' })).toHaveCount(0)

  // ── o Orc continua inteiro NA TELA: nome e miniatura que carrega ─────────
  await expect(page.getByRole('button', { name: 'Colocar Orc no mapa' })).toBeVisible()
  const miniaturaDoOrc = page.getByRole('img', { name: 'Foto de Orc' })
  await expect(miniaturaDoOrc).toBeVisible()
  await expect
    .poll(async () => miniaturaDoOrc.evaluate((el) => (el instanceof HTMLImageElement ? el.naturalWidth : 0)), { timeout: 10_000 })
    .toBeGreaterThan(0)

  // ── e a PASTA tem exatamente uma imagem a menos ──────────────────────────
  const depois = await imagensNaPastaDoAcervo(page)
  expect(
    depois,
    `apagar um NPC tinha de tirar a imagem dele da pasta; sobrou ${depois.join(', ') || '(nenhuma)'} de ${antes.join(', ')}`,
  ).toHaveLength(1)
  const sobrou = depois[0]
  expect(antes, 'o arquivo que sobrou tem de ser um dos dois que estavam lá').toContain(sobrou)
})

/**
 * O DEFEITO — "Apagar Goblin para sempre" é uma promessa que o app não confere.
 *
 * O botão de confirmação repete o nome e diz PARA SEMPRE. Quando o sistema
 * recusa remover o arquivo de imagem — antivírus, OneDrive ou o visualizador de
 * fotos do Windows segurando o arquivo, o `os error 5` que o próprio
 * `lib/tokenLibrary.ts` sabe traduzir —, o `catch` em volta da varredura engole
 * a falha: o nome some da lista, a pessoa vê exatamente a mesma tela do caso em
 * que tudo deu certo, e a foto fica no `%APPDATA%` para sempre.
 *
 * O que a jornada cobra: que a tela DIGA. Não o texto exato — só que exista um
 * aviso visível, como já existe para toda outra falha de arquivo deste app
 * (`reportFileError`, em `App.tsx`). Hoje não existe nenhum: apagar 100 NPCs
 * com a pasta travada acumula 100 fotos escondidas e a pessoa nunca fica
 * sabendo.
 */
test('quando a foto não pôde ser apagada do disco, a tela tem de dizer — e não fingir que apagou', async ({ page }) => {
  test.setTimeout(180_000)
  await discoDoMestre(page, { travarApagarImagem: true })
  await enterEditor(page)

  await criarTokenComFoto(page, 'Goblin')
  await guardarNoAcervoELimparOMapa(page, 'Goblin')

  const antes = await imagensNaPastaDoAcervo(page)
  expect(antes, 'o NPC guardado tinha de ter deixado a foto dele na pasta').toHaveLength(1)

  // Nenhum aviso de erro na tela antes do gesto: o que aparecer depois é
  // resposta a ELE. (O "Goblin entrou no acervo" é `role="status"`, não alerta.)
  await expect(page.getByRole('alert')).toHaveCount(0)

  // ── ela apaga, e a tela responde como se tivesse dado tudo certo ─────────
  await apagarDaEstante(page, 'Goblin')
  await expect(page.getByRole('button', { name: 'Colocar Goblin no mapa' })).toHaveCount(0)
  await expect(page.getByText('Nenhum token no acervo ainda.')).toBeVisible()

  // ── mas a foto continua lá, e vai continuar para sempre ──────────────────
  const depois = await imagensNaPastaDoAcervo(page)
  expect(
    depois,
    'o disco recusou apagar a imagem, então ela tinha mesmo de continuar na pasta — é esta a situação que a tela precisa contar',
  ).toEqual(antes)

  // ── a cobrança: a pessoa tem de ficar sabendo ────────────────────────────
  await expect(
    page.getByRole('alert'),
    `o app disse "Apagar Goblin para sempre", não conseguiu apagar ${depois.join(', ')} do disco e não avisou nada: a tela ficou igual à de um apagamento que deu certo`,
  ).toHaveCount(1)
})
