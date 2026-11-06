/**
 * ESQUEMA SQLite do DO Campanha (plano §4.5). `CREATE ... IF NOT EXISTS` a
 * cada vez que o DO acorda: barato e idempotente. Duas diferenças da 4.5,
 * escritas aqui para não sumirem:
 *
 * - `ops` ganha `atomico` e `autorDeclarado`, que a `OpGravada` tem (sem eles
 *   o `exportar` e o `desde` devolveriam uma op diferente da gravada);
 * - `bloqueios` é nova: o socket que passa de N violações fecha e o upgrade
 *   seguinte da mesma conta é recusado por alguns minutos (§6.5); fica no
 *   SQLite porque a memória do DO some na hibernação.
 *
 * A rev atual NÃO fica em `meta`: é `MAX(rev)` de `ops` (chave primária,
 * leitura barata), uma linha gravada a menos por lote (§7) e nunca diverge.
 */

export const VERSAO_DO_ESQUEMA = 1

const TABELAS_DA_CAMPANHA = [
  `CREATE TABLE IF NOT EXISTS meta (chave TEXT PRIMARY KEY, valor TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS membros (
    contaId TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    nome TEXT NOT NULL,
    papel TEXT NOT NULL CHECK (papel IN ('mestre', 'jogador')),
    estado TEXT NOT NULL CHECK (estado IN ('ativo', 'removido'))
  )`,
  `CREATE TABLE IF NOT EXISTS fichas (
    id TEXT PRIMARY KEY,
    doc TEXT NOT NULL,
    visivel TEXT NOT NULL CHECK (visivel IN ('mesa', 'treino', 'mestre')),
    dono TEXT,
    apagada INTEGER NOT NULL,
    rev INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ops (
    rev INTEGER PRIMARY KEY,
    opId TEXT NOT NULL UNIQUE,
    loteId TEXT NOT NULL,
    fichaId TEXT NOT NULL,
    caminho TEXT NOT NULL,
    acao TEXT NOT NULL,
    valor TEXT,
    delta REAL,
    antes TEXT,
    baseRev INTEGER NOT NULL,
    autorContaId TEXT NOT NULL,
    autorNome TEXT NOT NULL,
    origem TEXT NOT NULL CHECK (origem IN ('app', 'site', 'mesa')),
    clienteId TEXT NOT NULL,
    atestadoPeloApp INTEGER NOT NULL,
    quando INTEGER NOT NULL,
    quandoCliente INTEGER NOT NULL,
    desfaz TEXT,
    resolve TEXT,
    atomico INTEGER NOT NULL DEFAULT 0,
    autorDeclarado TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS ops_por_ficha ON ops (fichaId, rev)`,
  // Parcial: só a op de desfazer grava linha neste índice (o `desfeitasDe` do núcleo).
  `CREATE INDEX IF NOT EXISTS ops_desfeitas ON ops (desfaz) WHERE desfaz IS NOT NULL`,
  `CREATE TABLE IF NOT EXISTS recusadas (
    opId TEXT PRIMARY KEY,
    op TEXT NOT NULL,
    motivo TEXT NOT NULL DEFAULT 'conflito',
    revAtual INTEGER NOT NULL,
    quando INTEGER NOT NULL,
    resposta TEXT NOT NULL,
    autorContaId TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS cotas (
    chave TEXT PRIMARY KEY,
    ops INTEGER NOT NULL,
    bytes INTEGER NOT NULL,
    midiaBytes INTEGER NOT NULL DEFAULT 0,
    negadas INTEGER NOT NULL,
    paceAt INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS bloqueios (contaId TEXT PRIMARY KEY, ate INTEGER NOT NULL)`,
  // Mídia (fatia W3): as tabelas nascem aqui para a W3 não precisar de migração.
  `CREATE TABLE IF NOT EXISTS midia (hash TEXT NOT NULL, parte INTEGER NOT NULL, bytes BLOB NOT NULL, PRIMARY KEY (hash, parte))`,
  `CREATE TABLE IF NOT EXISTS midia_meta (
    hash TEXT PRIMARY KEY,
    tipo TEXT NOT NULL,
    tamanho INTEGER NOT NULL,
    partes INTEGER NOT NULL,
    enviadoPor TEXT NOT NULL,
    quando INTEGER NOT NULL
  )`,
  // Chat (v2, fatia C1; lobby/nuvem/src/chat.ts). Sala e privado em tabelas separadas: o privado
  // fica fora do exportar e da cópia do app. `mudou` = cursor de mudança (criar ou apagar), um só
  // para as duas tabelas; `autorNome` = o nome de quando foi dita, como em `ops`. `emailA` e
  // `emailB` = o e-mail de cada lado quando foi escrita: a conversa é do par COM esses e-mails, e
  // trocar o e-mail de uma conta não abre o privado antigo para o dono do e-mail novo (12.19).
  `CREATE TABLE IF NOT EXISTS chat_sala (
    id INTEGER PRIMARY KEY,
    autorContaId TEXT NOT NULL,
    autorNome TEXT NOT NULL,
    texto TEXT NOT NULL,
    mencoes TEXT NOT NULL,
    criadaEm INTEGER NOT NULL,
    apagadaEm INTEGER,
    idDoCliente TEXT NOT NULL,
    mudou INTEGER NOT NULL,
    UNIQUE (autorContaId, idDoCliente)
  )`,
  `CREATE INDEX IF NOT EXISTS chat_sala_por_mudanca ON chat_sala (mudou)`,
  `CREATE TABLE IF NOT EXISTS chat_dm (
    id INTEGER PRIMARY KEY,
    par TEXT NOT NULL,
    contaA TEXT NOT NULL,
    contaB TEXT NOT NULL,
    emailA TEXT NOT NULL,
    emailB TEXT NOT NULL,
    autorContaId TEXT NOT NULL,
    autorNome TEXT NOT NULL,
    texto TEXT NOT NULL,
    criadaEm INTEGER NOT NULL,
    apagadaEm INTEGER,
    idDoCliente TEXT NOT NULL,
    mudou INTEGER NOT NULL,
    UNIQUE (autorContaId, par, emailA, emailB, idDoCliente)
  )`,
  `CREATE INDEX IF NOT EXISTS chat_dm_por_conversa ON chat_dm (par, emailA, emailB, id)`,
  `CREATE INDEX IF NOT EXISTS chat_dm_por_mudanca ON chat_dm (mudou)`,
  `CREATE TABLE IF NOT EXISTS lidas (contaId TEXT NOT NULL, canal TEXT NOT NULL, ateId INTEGER NOT NULL, PRIMARY KEY (contaId, canal))`,
  // Mural (v2, fatia M1; lobby/nuvem/src/mural.ts). Notícia fixada = aviso. `versao` sobe ao editar
  // e ao fixar; o lido de cada conta (`mural_lidos`) vale para a versão lida, então o aviso editado
  // volta a aparecer. Lápide = a linha fica sem texto nem imagem. Reações e lidos nunca são apagados.
  `CREATE TABLE IF NOT EXISTS mural_noticias (
    id INTEGER PRIMARY KEY,
    autorContaId TEXT NOT NULL,
    autorNome TEXT NOT NULL,
    texto TEXT NOT NULL,
    imagem TEXT,
    mencoes TEXT NOT NULL,
    fixada INTEGER NOT NULL,
    versao INTEGER NOT NULL,
    criadaEm INTEGER NOT NULL,
    editadaEm INTEGER,
    apagadaEm INTEGER,
    idDoCliente TEXT NOT NULL,
    UNIQUE (autorContaId, idDoCliente)
  )`,
  `CREATE TABLE IF NOT EXISTS mural_reacoes (
    noticiaId INTEGER NOT NULL,
    contaId TEXT NOT NULL,
    reacao TEXT NOT NULL,
    quando INTEGER NOT NULL,
    PRIMARY KEY (noticiaId, contaId)
  )`,
  `CREATE TABLE IF NOT EXISTS mural_lidos (
    contaId TEXT NOT NULL,
    noticiaId INTEGER NOT NULL,
    versao INTEGER NOT NULL,
    quando INTEGER NOT NULL,
    PRIMARY KEY (contaId, noticiaId)
  )`,
  // Duelo (v2, fatia T6; lobby/nuvem/src/duelo.ts). O convite é a mesma linha antes de começar
  // (`status 'convite'`). `prazo` = o que vence (o convite; os 3 minutos de quem caiu); `apagarEm`
  // = quando o duelo acabado sai. Um alarme só no DO, no menor dos dois (achado Tr4). Sem índice:
  // são poucas linhas (no máximo um duelo e um convite enviado por conta, mais os acabados do dia).
  `CREATE TABLE IF NOT EXISTS duelos (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL CHECK (status IN ('convite', 'andamento', 'fim')),
    jogadorA TEXT NOT NULL,
    jogadorB TEXT NOT NULL,
    estadoJson TEXT NOT NULL,
    seq INTEGER NOT NULL,
    versaoDoMotor INTEGER NOT NULL,
    prazo INTEGER,
    apagarEm INTEGER,
    atualizadoEm INTEGER NOT NULL
  )`,
]

export function criarEsquemaDaCampanha(sql: SqlStorage): void {
  for (const comando of TABELAS_DA_CAMPANHA) sql.exec(comando)
  sql.exec(`INSERT OR IGNORE INTO meta (chave, valor) VALUES ('versaoDoEsquema', ?)`, JSON.stringify(VERSAO_DO_ESQUEMA))
}

export function criarEsquemaDoDiretorio(sql: SqlStorage): void {
  sql.exec(`CREATE TABLE IF NOT EXISTS campanhasDoEmail (
    email TEXT NOT NULL,
    campanhaId TEXT NOT NULL,
    papel TEXT NOT NULL CHECK (papel IN ('mestre', 'jogador')),
    nomeDaCampanha TEXT NOT NULL,
    PRIMARY KEY (email, campanhaId)
  )`)
  sql.exec(`CREATE INDEX IF NOT EXISTS campanhas_por_id ON campanhasDoEmail (campanhaId)`)
}
