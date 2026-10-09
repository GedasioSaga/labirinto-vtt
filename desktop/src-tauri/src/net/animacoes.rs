//! PACOTE DE ANIMAÇÕES: animação nova chega pelo GitHub, sem instalador novo.
//!
//! Uma release fixa (`animacoes`, pré-lançamento) guarda `indice.json`,
//! `indice.json.sig` e um módulo `.js` por animação. O mestre baixa tudo para
//! `<appData>/animacoes/atual` e serve aos jogadores pela sala (`/animacoes`).
//!
//! Animação é CÓDIGO que vai rodar no app e no navegador do jogador, então a
//! confiança tem de ser a mesma de uma versão nova do app: o índice só vale se
//! vier assinado pela mesma chave do atualizador do Tauri, conferido do mesmo
//! jeito (`verificar_assinatura`), e cada módulo só vale se tiver o tamanho e o
//! sha256 que o índice assinado diz. A chave privada nunca sai do PC do dono.
//!
//! Defesa em camadas, todas aqui e testadas:
//!  - a assinatura é conferida a CADA leitura, não só ao baixar: arquivo posto
//!    à mão em `atual` não passa;
//!  - nome de arquivo estrito (`nome_valido`): sem barra, ponto a mais ou `..`,
//!    então juntar o nome à pasta nunca sai dela;
//!  - tetos de tamanho no download (o servidor pode mentir no `Content-Length`)
//!    e na leitura do disco;
//!  - atualizar baixa para uma pasta temporária e só troca com a `atual` depois
//!    de tudo conferido: falha no meio deixa o pacote anterior intacto.
//!
//! Este módulo não depende de Tauri: `commands.rs` faz a costura com o
//! `AppHandle` e `server.rs` usa `Pacote` na rota da sala.

use std::collections::HashSet;
use std::future::Future;
use std::path::{Path, PathBuf};
use std::time::Duration;

use base64::Engine as _;
use minisign_verify::{PublicKey, Signature};
use rand::Rng;
use serde::{Deserialize, Serialize};

use super::media::hash_hex;

/// Pasta dentro do `app_data_dir` (o mesmo `appDataDir()` do TS).
pub const PASTA_DE_ANIMACOES: &str = "animacoes";
/// O pacote em uso. As outras pastas da raiz são só sobras de uma troca.
const PASTA_ATUAL: &str = "atual";
const PREFIXO_NOVO: &str = "novo-";
const PREFIXO_VELHO: &str = "velho-";
pub const NOME_DO_INDICE: &str = "indice.json";
pub const NOME_DA_ASSINATURA: &str = "indice.json.sig";

/// Onde o pacote é publicado. O GitHub redireciona o download para
/// `objects.githubusercontent.com`; o cliente segue, só por HTTPS.
pub const URL_BASE: &str = "https://github.com/GedasioSaga/labirinto-vtt/releases/download/animacoes/";

/// A metade pública da chave do atualizador, igual a `plugins.updater.pubkey`
/// de `tauri.conf.json` (um teste garante). Embutida no binário: trocar a chave
/// exige versão nova do app, como no próprio atualizador.
pub const CHAVE_PUBLICA: &str = "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEJFQjE5NTZGMEVENjU2MDAKUldRQVZ0WU9iNVd4dnRFczJNU0VhS1YwUUZVbDUydy9jaml4T2srZVdBRXNVTi9rMEx5MWM1ZHIK";

/// Tetos: o índice e a assinatura são texto pequeno; os módulos são código JS.
pub const TETO_INDICE: u64 = 256 * 1024;
pub const TETO_ASSINATURA: u64 = 8 * 1024;
pub const TETO_ARQUIVO: u64 = 2 * 1024 * 1024;
pub const TETO_TOTAL: u64 = 20 * 1024 * 1024;
pub const MAX_ARQUIVOS: usize = 200;
const MAX_NOME: usize = 60;
const TAMANHO_DO_SHA: usize = 64;
/// Único formato de índice que este app entende.
const FORMATO: u64 = 1;

const TEMPO_PARA_CONECTAR: Duration = Duration::from_secs(10);
/// Por requisição, do envio ao último byte: o maior módulo tem 2 MiB.
const TEMPO_POR_ARQUIVO: Duration = Duration::from_secs(60);

/// `(maior, menor, correção)`; a ordem da tupla é a ordem de versão.
pub type Versao = (u64, u64, u64);

/// Um módulo listado no índice, já validado.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Arquivo {
    pub nome: String,
    pub sha256: String,
    pub tamanho: u64,
}

/// Só o que o Rust usa do índice; `animacoes` e o resto passam como texto ao TS.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Indice {
    pub versao: u64,
    pub motor_minimo: Versao,
    pub arquivos: Vec<Arquivo>,
}

/// Índice cuja assinatura conferiu e cuja forma foi validada, com o texto e a
/// assinatura exatos (é o texto, não um JSON reescrito, que a assinatura cobre).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IndiceVerificado {
    pub texto: String,
    pub assinatura: String,
    pub indice: Indice,
}

impl IndiceVerificado {
    /// O módulo `nome`, se o índice o lista.
    pub fn arquivo(&self, nome: &str) -> Option<&Arquivo> {
        self.indice.arquivos.iter().find(|arquivo| arquivo.nome == nome)
    }
}

/// Por que o pacote (ou um arquivo dele) não serviu.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ErroDoPacote {
    /// Sem rede, tempo esgotado ou o GitHub respondeu erro HTTP.
    SemRede,
    /// Assinatura, forma do índice, tamanho ou sha256 não conferem. O texto é
    /// o motivo curto que vai ao log — nunca o conteúdo recebido.
    Invalido(&'static str),
    /// Nada instalado, ou o nome pedido não está no índice instalado.
    NaoEncontrado,
    /// Falha de disco local (criar pasta, gravar, trocar).
    Disco(std::io::ErrorKind),
}

impl std::fmt::Display for ErroDoPacote {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::SemRede => write!(f, "sem acesso ao pacote de animações"),
            Self::Invalido(motivo) => write!(f, "pacote de animações inválido ({motivo})"),
            Self::NaoEncontrado => write!(f, "animação não encontrada"),
            Self::Disco(tipo) => write!(f, "falha ao gravar o pacote de animações: {tipo}"),
        }
    }
}

impl std::error::Error for ErroDoPacote {}

fn disco(erro: std::io::Error) -> ErroDoPacote {
    ErroDoPacote::Disco(erro.kind())
}

/// O que `animacoes_atualizar` devolve ao TS (`estado` em snake_case).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Estado {
    Novo,
    Igual,
    Antigo,
    AppVelho,
    SemInternet,
    Invalido,
}

/// `versao` e `indice` são sempre os do pacote instalado DEPOIS da chamada
/// (`None` se não houver nenhum), qualquer que seja o `estado`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ResultadoDaAtualizacao {
    pub estado: Estado,
    pub versao: Option<u64>,
    pub indice: Option<String>,
}

impl ResultadoDaAtualizacao {
    fn com(estado: Estado, instalado: Option<&IndiceVerificado>) -> Self {
        Self {
            estado,
            versao: instalado.map(|verificado| verificado.indice.versao),
            indice: instalado.map(|verificado| verificado.texto.clone()),
        }
    }
}

// ---------------------------------------------------------------------------
// Lógica pura
// ---------------------------------------------------------------------------

/// Confere a assinatura exatamente como o `tauri-plugin-updater` 2.x
/// (`verify_signature` em `updater.rs`): a chave e a assinatura chegam em
/// base64 do texto minisign; `allow_legacy = true` como lá. A versão gravada
/// no comentário confiável não se aplica: o índice tem a própria `versao`.
pub fn verificar_assinatura(dados: &[u8], assinatura: &str, chave_publica: &str) -> Result<(), ErroDoPacote> {
    conferir_minisign(dados, assinatura, chave_publica).ok_or(ErroDoPacote::Invalido("assinatura"))
}

fn conferir_minisign(dados: &[u8], assinatura: &str, chave_publica: &str) -> Option<()> {
    let chave = PublicKey::decode(&base64_para_texto(chave_publica)?).ok()?;
    // `trim`: o `.sig` pode ganhar quebra de linha no caminho; o base64 não tem espaço.
    let assinatura = Signature::decode(&base64_para_texto(assinatura.trim())?).ok()?;
    chave.verify(dados, &assinatura, true).ok()
}

fn base64_para_texto(base64: &str) -> Option<String> {
    let bytes = base64::engine::general_purpose::STANDARD.decode(base64).ok()?;
    String::from_utf8(bytes).ok()
}

/// `<1 a 60 de [a-z0-9-]>.js`, fora os nomes de dispositivo do Windows (`con`,
/// `nul`, `com1`...), que lá abririam o dispositivo em vez de um arquivo.
pub fn nome_valido(nome: &str) -> bool {
    let Some(base) = nome.strip_suffix(".js") else {
        return false;
    };
    (1..=MAX_NOME).contains(&base.len())
        && base.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
        && !nome_de_dispositivo_do_windows(base)
}

fn nome_de_dispositivo_do_windows(base: &str) -> bool {
    match base {
        "con" | "prn" | "aux" | "nul" => true,
        _ => {
            let numerado = base.strip_prefix("com").or_else(|| base.strip_prefix("lpt"));
            numerado.is_some_and(|resto| resto.len() == 1 && resto.bytes().all(|b| b.is_ascii_digit()))
        }
    }
}

fn sha_valido(sha: &str) -> bool {
    sha.len() == TAMANHO_DO_SHA && sha.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

/// `"x.y.z"` só com dígitos (o `parse` de inteiro aceitaria `+1`).
pub fn ler_versao(texto: &str) -> Option<Versao> {
    let mut partes = texto.split('.');
    let mut proxima = || {
        let parte = partes.next()?;
        if parte.is_empty() || !parte.bytes().all(|b| b.is_ascii_digit()) {
            return None;
        }
        parte.parse::<u64>().ok()
    };
    let versao = (proxima()?, proxima()?, proxima()?);
    partes.next().is_none().then_some(versao)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct IndiceBruto {
    formato: u64,
    versao: u64,
    motor_minimo: String,
    arquivos: Vec<ArquivoBruto>,
}

#[derive(Deserialize)]
struct ArquivoBruto {
    nome: String,
    sha256: String,
    tamanho: u64,
}

/// Valida a forma do índice (não a assinatura). Campo a mais passa: é do TS.
pub fn validar_indice(texto: &str) -> Result<Indice, ErroDoPacote> {
    let forma = ErroDoPacote::Invalido;
    if u64::try_from(texto.len()).unwrap_or(u64::MAX) > TETO_INDICE {
        return Err(forma("indice grande demais"));
    }
    // O serde aceita struct escrita como lista (`[1, 2, ...]`); o TS, não.
    if !texto.trim_start().starts_with('{') {
        return Err(forma("indice nao e objeto"));
    }
    let bruto: IndiceBruto = serde_json::from_str(texto).map_err(|_| forma("indice mal formado"))?;
    if bruto.formato != FORMATO {
        return Err(forma("formato desconhecido"));
    }
    if bruto.versao == 0 {
        return Err(forma("versao"));
    }
    let motor_minimo = ler_versao(&bruto.motor_minimo).ok_or(forma("motorMinimo"))?;
    if bruto.arquivos.len() > MAX_ARQUIVOS {
        return Err(forma("arquivos demais"));
    }
    let mut nomes = HashSet::new();
    let mut total: u64 = 0;
    let mut arquivos = Vec::with_capacity(bruto.arquivos.len());
    for arquivo in bruto.arquivos {
        if !nome_valido(&arquivo.nome) {
            return Err(forma("nome de arquivo"));
        }
        if !nomes.insert(arquivo.nome.clone()) {
            return Err(forma("nome repetido"));
        }
        if !sha_valido(&arquivo.sha256) {
            return Err(forma("sha256"));
        }
        if arquivo.tamanho > TETO_ARQUIVO {
            return Err(forma("arquivo grande demais"));
        }
        // Cabe com folga: no máximo 200 x 2 MiB.
        total += arquivo.tamanho;
        arquivos.push(Arquivo { nome: arquivo.nome, sha256: arquivo.sha256, tamanho: arquivo.tamanho });
    }
    if total > TETO_TOTAL {
        return Err(forma("pacote grande demais"));
    }
    Ok(Indice { versao: bruto.versao, motor_minimo, arquivos })
}

/// Assinatura primeiro, forma depois: nada do índice é lido antes de saber
/// que veio do dono da chave.
pub fn verificar_indice(bytes: Vec<u8>, assinatura: &str, chave_publica: &str) -> Result<IndiceVerificado, ErroDoPacote> {
    if u64::try_from(bytes.len()).unwrap_or(u64::MAX) > TETO_INDICE {
        return Err(ErroDoPacote::Invalido("indice grande demais"));
    }
    verificar_assinatura(&bytes, assinatura, chave_publica)?;
    let texto = String::from_utf8(bytes).map_err(|_| ErroDoPacote::Invalido("indice nao e utf-8"))?;
    let indice = validar_indice(&texto)?;
    Ok(IndiceVerificado { texto, assinatura: assinatura.to_owned(), indice })
}

/// Os bytes de um módulo batem com o índice assinado?
pub fn conferir_arquivo(arquivo: &Arquivo, bytes: &[u8]) -> Result<(), ErroDoPacote> {
    if u64::try_from(bytes.len()).ok() != Some(arquivo.tamanho) {
        return Err(ErroDoPacote::Invalido("tamanho do arquivo"));
    }
    if hash_hex(bytes) != arquivo.sha256 {
        return Err(ErroDoPacote::Invalido("sha256 do arquivo"));
    }
    Ok(())
}

/// O que fazer com um índice novo (já verificado) diante do instalado.
/// `Novo` é o único que instala; os outros mantêm o pacote atual.
pub fn decidir(instalada: Option<u64>, novo: &Indice, versao_do_app: Versao) -> Estado {
    match instalada.map(|versao| novo.versao.cmp(&versao)) {
        Some(std::cmp::Ordering::Less) => Estado::Antigo,
        Some(std::cmp::Ordering::Equal) => Estado::Igual,
        _ if novo.motor_minimo > versao_do_app => Estado::AppVelho,
        _ => Estado::Novo,
    }
}

// ---------------------------------------------------------------------------
// I/O
// ---------------------------------------------------------------------------

/// De onde o pacote vem. O app usa `GitHub`; os testes, uma fonte em memória.
pub trait Fonte {
    /// Os bytes de `nome` no pacote publicado. Mais de `teto` bytes = `Invalido`;
    /// sem rede ou erro HTTP = `SemRede`.
    fn baixar(&self, nome: &str, teto: u64) -> impl Future<Output = Result<Vec<u8>, ErroDoPacote>> + Send;
}

/// A release `animacoes` do repositório do app.
pub struct GitHub {
    cliente: reqwest::Client,
    base: String,
}

/// SÓ EM BUILD DE DEBUG: `LABIRINTO_ANIMACOES_URL` troca de onde o pacote vem,
/// para a prova ponta a ponta servir um pacote de teste num servidor local
/// sem publicar nada. A assinatura continua conferida com a chave embutida.
/// No build de release esta função nem existe e a origem é sempre `URL_BASE`.
#[cfg(debug_assertions)]
fn url_base() -> String {
    match std::env::var("LABIRINTO_ANIMACOES_URL") {
        Ok(url) if !url.is_empty() => {
            if url.ends_with('/') {
                url
            } else {
                format!("{url}/")
            }
        }
        _ => URL_BASE.to_owned(),
    }
}

#[cfg(not(debug_assertions))]
fn url_base() -> String {
    URL_BASE.to_owned()
}

impl GitHub {
    pub fn novo() -> Result<Self, ErroDoPacote> {
        let base = url_base();
        let cliente = reqwest::Client::builder()
            // Também vale para os redirects: nada de HTTP no meio do caminho.
            // Só o servidor local da prova de debug (`url_base`) usa HTTP.
            .https_only(base.starts_with("https://"))
            .connect_timeout(TEMPO_PARA_CONECTAR)
            .timeout(TEMPO_POR_ARQUIVO)
            .user_agent(concat!("labirinto-vtt/", env!("CARGO_PKG_VERSION")))
            .build()
            .map_err(|_| ErroDoPacote::SemRede)?;
        Ok(Self { cliente, base })
    }
}

impl Fonte for GitHub {
    async fn baixar(&self, nome: &str, teto: u64) -> Result<Vec<u8>, ErroDoPacote> {
        let grande_demais = ErroDoPacote::Invalido("download grande demais");
        let mut resposta =
            self.cliente.get(format!("{}{nome}", self.base)).send().await.map_err(|_| ErroDoPacote::SemRede)?;
        if !resposta.status().is_success() {
            return Err(ErroDoPacote::SemRede);
        }
        if resposta.content_length().is_some_and(|tamanho| tamanho > teto) {
            return Err(grande_demais);
        }
        // O `Content-Length` pode faltar ou mentir: o teto vale para o que chega.
        let mut bytes = Vec::new();
        while let Some(pedaco) = resposta.chunk().await.map_err(|_| ErroDoPacote::SemRede)? {
            // Saturar aqui só pode virar "grande demais", que é a resposta certa.
            let total = bytes.len().saturating_add(pedaco.len());
            if u64::try_from(total).unwrap_or(u64::MAX) > teto {
                return Err(grande_demais);
            }
            bytes.extend_from_slice(&pedaco);
        }
        Ok(bytes)
    }
}

/// Uma atualização por vez no app inteiro: a busca ao abrir e o botão podem
/// coincidir, e duas trocas de pasta ao mesmo tempo se atropelariam.
static TRAVA_DE_ATUALIZACAO: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

/// O pacote no disco (`<raiz>/atual`) e a chave que o confere.
#[derive(Debug, Clone)]
pub struct Pacote {
    raiz: PathBuf,
    chave_publica: &'static str,
}

impl Pacote {
    /// `<appData>/animacoes`, conferido pela chave do atualizador.
    pub fn oficial(dados_do_app: &Path) -> Self {
        Self { raiz: dados_do_app.join(PASTA_DE_ANIMACOES), chave_publica: CHAVE_PUBLICA }
    }

    /// Outra raiz e outra chave: só os testes, que não têm a chave privada real.
    pub fn com_chave(raiz: PathBuf, chave_publica: &'static str) -> Self {
        Self { raiz, chave_publica }
    }

    pub fn pasta_atual(&self) -> PathBuf {
        self.raiz.join(PASTA_ATUAL)
    }

    /// O índice instalado, com a assinatura conferida agora.
    pub async fn ler_indice(&self) -> Result<IndiceVerificado, ErroDoPacote> {
        let pasta = self.pasta_atual();
        let bytes = ler_com_teto(&pasta.join(NOME_DO_INDICE), TETO_INDICE).await?;
        let assinatura = ler_com_teto(&pasta.join(NOME_DA_ASSINATURA), TETO_ASSINATURA).await?;
        let assinatura = String::from_utf8(assinatura).map_err(|_| ErroDoPacote::Invalido("assinatura"))?;
        verificar_indice(bytes, &assinatura, self.chave_publica)
    }

    /// Os bytes de `nome`, só se o índice instalado (reconferido) o listar e o
    /// conteúdo bater com o sha256 dele.
    pub async fn ler_arquivo(&self, nome: &str) -> Result<Vec<u8>, ErroDoPacote> {
        let verificado = self.ler_indice().await?;
        let arquivo = verificado.arquivo(nome).ok_or(ErroDoPacote::NaoEncontrado)?;
        self.ler_arquivo_de(arquivo).await
    }

    /// Como `ler_arquivo`, para quem já tem o índice verificado em mãos (a
    /// rota, que olha o sha256 antes de ler o arquivo). O nome de um `Arquivo`
    /// já passou por `nome_valido`, então juntá-lo à pasta não sai dela.
    pub async fn ler_arquivo_de(&self, arquivo: &Arquivo) -> Result<Vec<u8>, ErroDoPacote> {
        let bytes = ler_com_teto(&self.pasta_atual().join(&arquivo.nome), arquivo.tamanho).await?;
        conferir_arquivo(arquivo, &bytes)?;
        Ok(bytes)
    }

    /// Procura pacote novo na `fonte` e instala se for o caso. `Err` só por
    /// falha de disco local; rede e pacote ruim viram `estado`.
    pub async fn atualizar(&self, fonte: &impl Fonte, versao_do_app: Versao) -> Result<ResultadoDaAtualizacao, ErroDoPacote> {
        let _vez = TRAVA_DE_ATUALIZACAO.lock().await;
        tokio::fs::create_dir_all(&self.raiz).await.map_err(disco)?;
        self.limpar_sobras().await;
        let instalado = self.ler_indice().await.ok();

        let novo = match self.baixar_indice(fonte).await {
            Ok(novo) => novo,
            Err(erro) => return recusa(erro, instalado.as_ref()),
        };
        let estado = decidir(instalado.as_ref().map(|i| i.indice.versao), &novo.indice, versao_do_app);
        if estado != Estado::Novo {
            return Ok(ResultadoDaAtualizacao::com(estado, instalado.as_ref()));
        }
        if let Err(erro) = self.instalar(fonte, &novo).await {
            return recusa(erro, instalado.as_ref());
        }
        // Relido do disco: o que se devolve é o que as leituras vão ver.
        let instalado = self.ler_indice().await.ok();
        Ok(ResultadoDaAtualizacao::com(Estado::Novo, instalado.as_ref()))
    }

    async fn baixar_indice(&self, fonte: &impl Fonte) -> Result<IndiceVerificado, ErroDoPacote> {
        let bytes = fonte.baixar(NOME_DO_INDICE, TETO_INDICE).await?;
        let assinatura = fonte.baixar(NOME_DA_ASSINATURA, TETO_ASSINATURA).await?;
        let assinatura = String::from_utf8(assinatura).map_err(|_| ErroDoPacote::Invalido("assinatura"))?;
        verificar_indice(bytes, &assinatura, self.chave_publica)
    }

    /// Baixa para `novo-<x>`, confere e só então troca. Qualquer falha apaga a
    /// temporária e deixa `atual` como estava.
    async fn instalar(&self, fonte: &impl Fonte, novo: &IndiceVerificado) -> Result<(), ErroDoPacote> {
        let temporaria = self.raiz.join(format!("{PREFIXO_NOVO}{}", sufixo_aleatorio()));
        let feito = match preencher(fonte, novo, &temporaria).await {
            Ok(()) => trocar(&self.raiz, &temporaria).await,
            Err(erro) => Err(erro),
        };
        if feito.is_err() {
            // Melhor esforço: o que sobrar sai na próxima `limpar_sobras`.
            let _ = tokio::fs::remove_dir_all(&temporaria).await;
        }
        feito
    }

    /// Apaga temporárias de uma atualização interrompida (app fechado no meio).
    /// Se a queda foi entre as duas trocas de nome, não há `atual`: a velha
    /// volta a ser a atual. Melhor esforço: falhar aqui não impede atualizar.
    async fn limpar_sobras(&self) {
        let Ok(mut entradas) = tokio::fs::read_dir(&self.raiz).await else {
            return;
        };
        let mut velhas = Vec::new();
        while let Ok(Some(entrada)) = entradas.next_entry().await {
            let nome = entrada.file_name();
            let nome = nome.to_string_lossy();
            if nome.starts_with(PREFIXO_NOVO) {
                let _ = tokio::fs::remove_dir_all(entrada.path()).await;
            } else if nome.starts_with(PREFIXO_VELHO) {
                velhas.push(entrada.path());
            }
        }
        let atual = self.pasta_atual();
        if !tokio::fs::try_exists(&atual).await.unwrap_or(true) {
            if let Some(velha) = velhas.pop() {
                let _ = tokio::fs::rename(&velha, &atual).await;
            }
        }
        for velha in velhas {
            let _ = tokio::fs::remove_dir_all(velha).await;
        }
    }
}

/// Rede e pacote ruim viram `estado`, mantendo o instalado; disco sobe como `Err`.
fn recusa(erro: ErroDoPacote, instalado: Option<&IndiceVerificado>) -> Result<ResultadoDaAtualizacao, ErroDoPacote> {
    let estado = match erro {
        ErroDoPacote::SemRede => Estado::SemInternet,
        ErroDoPacote::Invalido(motivo) => {
            // Só o motivo fixo: nada do que veio da rede vai ao log.
            eprintln!("pacote de animações recusado: {motivo}");
            Estado::Invalido
        }
        ErroDoPacote::NaoEncontrado | ErroDoPacote::Disco(_) => return Err(erro),
    };
    Ok(ResultadoDaAtualizacao::com(estado, instalado))
}

/// Os módulos primeiro, o índice por último: pasta sem índice nunca é lida
/// como pacote, mesmo que a troca acontecesse por engano.
async fn preencher(fonte: &impl Fonte, novo: &IndiceVerificado, pasta: &Path) -> Result<(), ErroDoPacote> {
    tokio::fs::create_dir_all(pasta).await.map_err(disco)?;
    for arquivo in &novo.indice.arquivos {
        let bytes = fonte.baixar(&arquivo.nome, arquivo.tamanho).await?;
        conferir_arquivo(arquivo, &bytes)?;
        tokio::fs::write(pasta.join(&arquivo.nome), &bytes).await.map_err(disco)?;
    }
    tokio::fs::write(pasta.join(NOME_DA_ASSINATURA), novo.assinatura.as_bytes()).await.map_err(disco)?;
    tokio::fs::write(pasta.join(NOME_DO_INDICE), novo.texto.as_bytes()).await.map_err(disco)?;
    Ok(())
}

/// `atual` -> `velho-<x>`, `novo` -> `atual`, apaga a velha. Se a segunda troca
/// falhar, a velha volta a ser `atual` e o erro sobe.
async fn trocar(raiz: &Path, novo: &Path) -> Result<(), ErroDoPacote> {
    let atual = raiz.join(PASTA_ATUAL);
    let velha = raiz.join(format!("{PREFIXO_VELHO}{}", sufixo_aleatorio()));
    let tinha_atual = tokio::fs::try_exists(&atual).await.map_err(disco)?;
    if tinha_atual {
        tokio::fs::rename(&atual, &velha).await.map_err(disco)?;
    }
    if let Err(erro) = tokio::fs::rename(novo, &atual).await {
        if tinha_atual {
            let _ = tokio::fs::rename(&velha, &atual).await;
        }
        return Err(disco(erro));
    }
    if tinha_atual {
        // Melhor esforço: se falhar, a próxima `limpar_sobras` apaga.
        let _ = tokio::fs::remove_dir_all(&velha).await;
    }
    Ok(())
}

fn sufixo_aleatorio() -> String {
    format!("{:016x}", rand::rng().random::<u64>())
}

/// Lê um arquivo comum de até `teto` bytes; o resto é recusa.
async fn ler_com_teto(caminho: &Path, teto: u64) -> Result<Vec<u8>, ErroDoPacote> {
    let info = tokio::fs::metadata(caminho).await.map_err(|_| ErroDoPacote::NaoEncontrado)?;
    if !info.is_file() {
        return Err(ErroDoPacote::NaoEncontrado);
    }
    if info.len() > teto {
        return Err(ErroDoPacote::Invalido("arquivo grande demais"));
    }
    let bytes = tokio::fs::read(caminho).await.map_err(|_| ErroDoPacote::NaoEncontrado)?;
    // O arquivo pode ter crescido entre o `metadata` e o `read`.
    if u64::try_from(bytes.len()).unwrap_or(u64::MAX) > teto {
        return Err(ErroDoPacote::Invalido("arquivo grande demais"));
    }
    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    type Resultado = Result<(), Box<dyn std::error::Error>>;

    const CHAVE_TESTE: &str = include_str!("../../tests/fixtures/animacoes/chave-teste.pub");
    const CHAVE_OUTRA: &str = include_str!("../../tests/fixtures/animacoes/chave-outra.pub");
    const V1: &[u8] = include_bytes!("../../tests/fixtures/animacoes/indice-v1.json");
    const V1_SIG: &str = include_str!("../../tests/fixtures/animacoes/indice-v1.json.sig");
    const V2: &[u8] = include_bytes!("../../tests/fixtures/animacoes/indice-v2.json");
    const V2_SIG: &str = include_str!("../../tests/fixtures/animacoes/indice-v2.json.sig");
    const V2_SIG_OUTRA: &str = include_str!("../../tests/fixtures/animacoes/indice-v2.json.sig-outra-chave");
    const V3_MOTOR: &[u8] = include_bytes!("../../tests/fixtures/animacoes/indice-v3-motor.json");
    const V3_MOTOR_SIG: &str = include_str!("../../tests/fixtures/animacoes/indice-v3-motor.json.sig");
    const PORTA: &[u8] = include_bytes!("../../tests/fixtures/animacoes/porta-teste.js");
    const TRANSICAO: &[u8] = include_bytes!("../../tests/fixtures/animacoes/transicao-teste.js");
    const APP: Versao = (0, 4, 20);

    /// Pacote publicado em memória; nome que falta = sem rede.
    struct FonteFalsa(HashMap<&'static str, Vec<u8>>);

    impl FonteFalsa {
        fn com(indice: &[u8], assinatura: &str, arquivos: &[(&'static str, &[u8])]) -> Self {
            let mut mapa = HashMap::from([(NOME_DO_INDICE, indice.to_vec()), (NOME_DA_ASSINATURA, assinatura.as_bytes().to_vec())]);
            for &(nome, bytes) in arquivos {
                mapa.insert(nome, bytes.to_vec());
            }
            Self(mapa)
        }
    }

    impl Fonte for FonteFalsa {
        async fn baixar(&self, nome: &str, teto: u64) -> Result<Vec<u8>, ErroDoPacote> {
            let bytes = self.0.get(nome).ok_or(ErroDoPacote::SemRede)?;
            if u64::try_from(bytes.len()).unwrap_or(u64::MAX) > teto {
                return Err(ErroDoPacote::Invalido("download grande demais"));
            }
            Ok(bytes.clone())
        }
    }

    fn fonte_v1() -> FonteFalsa {
        FonteFalsa::com(V1, V1_SIG, &[("porta-teste.js", PORTA)])
    }

    fn fonte_v2() -> FonteFalsa {
        FonteFalsa::com(V2, V2_SIG, &[("porta-teste.js", PORTA), ("transicao-teste.js", TRANSICAO)])
    }

    /// Raiz só deste teste (os testes rodam em paralelo), limpa no começo.
    fn pacote_de_teste(nome: &str) -> Result<Pacote, std::io::Error> {
        let raiz = std::env::temp_dir().join(format!("labirinto-animacoes-{nome}-{}", std::process::id()));
        if raiz.exists() {
            std::fs::remove_dir_all(&raiz)?;
        }
        std::fs::create_dir_all(&raiz)?;
        Ok(Pacote::com_chave(raiz, CHAVE_TESTE))
    }

    fn sobras(pacote: &Pacote) -> Result<Vec<String>, std::io::Error> {
        let mut nomes = Vec::new();
        for entrada in std::fs::read_dir(&pacote.raiz)? {
            let nome = entrada?.file_name().to_string_lossy().into_owned();
            if nome != PASTA_ATUAL {
                nomes.push(nome);
            }
        }
        Ok(nomes)
    }

    fn indice_com_arquivos(arquivos: &str) -> String {
        format!(r#"{{"formato":1,"versao":1,"motorMinimo":"0.1.0","arquivos":[{arquivos}],"animacoes":[]}}"#)
    }

    fn arquivo_json(nome: &str, tamanho: u64) -> String {
        format!(r#"{{"nome":"{nome}","sha256":"{}","tamanho":{tamanho}}}"#, "a".repeat(64))
    }

    #[test]
    fn chave_embutida_e_a_do_atualizador() -> Resultado {
        let conf: serde_json::Value = serde_json::from_str(include_str!("../../tauri.conf.json"))?;
        assert_eq!(conf.pointer("/plugins/updater/pubkey").and_then(|v| v.as_str()), Some(CHAVE_PUBLICA));
        Ok(())
    }

    #[test]
    fn assinatura_boa_confere() -> Resultado {
        let verificado = verificar_indice(V2.to_vec(), V2_SIG, CHAVE_TESTE)?;
        assert_eq!(verificado.indice.versao, 2);
        assert_eq!(verificado.indice.motor_minimo, (0, 4, 0));
        assert_eq!(verificado.indice.arquivos.len(), 2);
        assert_eq!(verificado.texto.as_bytes(), V2);
        assert!(verificado.arquivo("porta-teste.js").is_some());
        assert!(verificado.arquivo("outro.js").is_none());
        Ok(())
    }

    #[test]
    fn assinatura_de_outra_chave_e_recusada() {
        let recusa = Err(ErroDoPacote::Invalido("assinatura"));
        assert_eq!(verificar_indice(V2.to_vec(), V2_SIG_OUTRA, CHAVE_TESTE), recusa);
        assert_eq!(verificar_indice(V2.to_vec(), V2_SIG, CHAVE_OUTRA), recusa);
        // A chave real não reconhece a assinatura de teste.
        assert_eq!(verificar_indice(V2.to_vec(), V2_SIG, CHAVE_PUBLICA), recusa);
        assert_eq!(verificar_indice(V2.to_vec(), "", CHAVE_TESTE), recusa);
        assert_eq!(verificar_indice(V2.to_vec(), "nao e base64!", CHAVE_TESTE), recusa);
    }

    #[test]
    fn indice_alterado_depois_de_assinado_e_recusado() -> Resultado {
        let alterado = std::str::from_utf8(V2)?.replace(r#""versao": 2"#, r#""versao": 9"#);
        assert_ne!(alterado.as_bytes(), V2);
        assert_eq!(verificar_indice(alterado.into_bytes(), V2_SIG, CHAVE_TESTE), Err(ErroDoPacote::Invalido("assinatura")));
        // A assinatura de outro índice (v1) também não serve para o v2.
        assert_eq!(verificar_indice(V2.to_vec(), V1_SIG, CHAVE_TESTE), Err(ErroDoPacote::Invalido("assinatura")));
        Ok(())
    }

    #[test]
    fn nomes_fora_do_padrao_sao_recusados() {
        let no_limite = format!("{}.js", "a".repeat(60));
        let longo_demais = format!("{}.js", "a".repeat(61));
        for bom in ["a.js", "porta-teste.js", "0.js", "-.js", "com10.js", "console.js", no_limite.as_str()] {
            assert!(nome_valido(bom), "{bom}");
        }
        for ruim in [
            "",
            ".js",
            "Porta.js",
            "porta.JS",
            "porta.mjs",
            "porta",
            "porta.js.js",
            "../porta.js",
            "..js",
            "a/b.js",
            "a\\b.js",
            "porta_teste.js",
            "porta teste.js",
            "indice.json",
            "con.js",
            "nul.js",
            "com1.js",
            "lpt9.js",
            longo_demais.as_str(),
        ] {
            assert!(!nome_valido(ruim), "{ruim:?}");
        }
    }

    #[test]
    fn forma_do_indice_e_conferida() {
        let ok = indice_com_arquivos(&arquivo_json("a.js", 10));
        assert!(validar_indice(&ok).is_ok());
        let casos: Vec<(String, &str)> = vec![
            (indice_com_arquivos(&arquivo_json("../a.js", 10)), "nome de arquivo"),
            (indice_com_arquivos(&arquivo_json("A.js", 10)), "nome de arquivo"),
            (indice_com_arquivos(&format!("{},{}", arquivo_json("a.js", 1), arquivo_json("a.js", 1))), "nome repetido"),
            (indice_com_arquivos(&arquivo_json("a.js", TETO_ARQUIVO + 1)), "arquivo grande demais"),
            (indice_com_arquivos(r#"{"nome":"a.js","sha256":"ABC","tamanho":1}"#), "sha256"),
            (indice_com_arquivos(&format!(r#"{{"nome":"a.js","sha256":"{}","tamanho":1}}"#, "A".repeat(64))), "sha256"),
            (indice_com_arquivos(r#"{"nome":"a.js","sha256":"aa","tamanho":-1}"#), "indice mal formado"),
            (ok.replace(r#""formato":1"#, r#""formato":2"#), "formato desconhecido"),
            (ok.replace(r#""versao":1"#, r#""versao":0"#), "versao"),
            (ok.replace(r#""versao":1"#, r#""versao":-1"#), "indice mal formado"),
            (ok.replace(r#""versao":1"#, r#""versao":1.5"#), "indice mal formado"),
            (ok.replace("0.1.0", "0.1"), "motorMinimo"),
            (ok.replace("0.1.0", "0.1.0.0"), "motorMinimo"),
            (ok.replace("0.1.0", "+0.1.0"), "motorMinimo"),
            (ok.replace("0.1.0", "a.b.c"), "motorMinimo"),
            ("[1, 1, \"0.1.0\", []]".to_owned(), "indice nao e objeto"),
            (String::new(), "indice nao e objeto"),
        ];
        for (texto, motivo) in casos {
            assert_eq!(validar_indice(&texto), Err(ErroDoPacote::Invalido(motivo)), "{texto}");
        }
    }

    #[test]
    fn tetos_do_indice() {
        let muitos: Vec<String> = (0..=MAX_ARQUIVOS).map(|i| arquivo_json(&format!("a{i}.js"), 1)).collect();
        assert_eq!(validar_indice(&indice_com_arquivos(&muitos.join(","))), Err(ErroDoPacote::Invalido("arquivos demais")));
        // 11 x 2 MiB passa do teto de 20 MiB; 10 x 2 MiB cabe.
        let grandes = |n: u64| (0..n).map(|i| arquivo_json(&format!("g{i}.js"), TETO_ARQUIVO)).collect::<Vec<_>>().join(",");
        assert!(validar_indice(&indice_com_arquivos(&grandes(10))).is_ok());
        assert_eq!(validar_indice(&indice_com_arquivos(&grandes(11))), Err(ErroDoPacote::Invalido("pacote grande demais")));
        let enorme = format!("{}{}", indice_com_arquivos(""), " ".repeat(usize::try_from(TETO_INDICE).unwrap_or(usize::MAX)));
        assert_eq!(validar_indice(&enorme), Err(ErroDoPacote::Invalido("indice grande demais")));
        assert_eq!(verificar_indice(enorme.into_bytes(), V2_SIG, CHAVE_TESTE), Err(ErroDoPacote::Invalido("indice grande demais")));
    }

    #[test]
    fn versao_so_com_tres_numeros() {
        assert_eq!(ler_versao("0.4.20"), Some((0, 4, 20)));
        assert_eq!(ler_versao("10.0.0"), Some((10, 0, 0)));
        for ruim in ["", "1", "1.2", "1.2.3.4", "1..3", "v1.2.3", "1.2.3-beta", "+1.2.3", "1.2.-3", "99999999999999999999.0.0"] {
            assert_eq!(ler_versao(ruim), None, "{ruim}");
        }
    }

    #[test]
    fn decide_pela_versao_e_pelo_motor() {
        let indice = |versao, motor_minimo| Indice { versao, motor_minimo, arquivos: Vec::new() };
        assert_eq!(decidir(None, &indice(1, (0, 4, 0)), APP), Estado::Novo);
        assert_eq!(decidir(Some(1), &indice(2, (0, 4, 20)), APP), Estado::Novo);
        assert_eq!(decidir(Some(3), &indice(2, (0, 4, 0)), APP), Estado::Antigo);
        assert_eq!(decidir(Some(2), &indice(2, (0, 4, 0)), APP), Estado::Igual);
        assert_eq!(decidir(Some(1), &indice(2, (0, 4, 21)), APP), Estado::AppVelho);
        assert_eq!(decidir(None, &indice(2, (1, 0, 0)), APP), Estado::AppVelho);
        assert_eq!(decidir(Some(u64::MAX), &indice(u64::MAX, (0, 0, 0)), APP), Estado::Igual);
    }

    #[test]
    fn arquivo_com_sha_ou_tamanho_errado_e_recusado() -> Resultado {
        let verificado = verificar_indice(V2.to_vec(), V2_SIG, CHAVE_TESTE)?;
        let porta = verificado.arquivo("porta-teste.js").ok_or("porta")?;
        assert_eq!(conferir_arquivo(porta, PORTA), Ok(()));
        let mut trocado = PORTA.to_vec();
        trocado[0] ^= 1;
        assert_eq!(conferir_arquivo(porta, &trocado), Err(ErroDoPacote::Invalido("sha256 do arquivo")));
        assert_eq!(conferir_arquivo(porta, &PORTA[1..]), Err(ErroDoPacote::Invalido("tamanho do arquivo")));
        assert_eq!(conferir_arquivo(porta, b""), Err(ErroDoPacote::Invalido("tamanho do arquivo")));
        Ok(())
    }

    #[test]
    fn estado_vai_ao_ts_em_snake_case() -> Resultado {
        let r = ResultadoDaAtualizacao { estado: Estado::AppVelho, versao: None, indice: None };
        assert_eq!(serde_json::to_string(&r)?, r#"{"estado":"app_velho","versao":null,"indice":null}"#);
        assert_eq!(serde_json::to_string(&Estado::SemInternet)?, r#""sem_internet""#);
        Ok(())
    }

    #[tokio::test]
    async fn instala_do_zero_e_le_conferido() -> Resultado {
        let pacote = pacote_de_teste("zero")?;
        assert_eq!(pacote.ler_indice().await, Err(ErroDoPacote::NaoEncontrado));
        let r = pacote.atualizar(&fonte_v1(), APP).await?;
        assert_eq!((r.estado, r.versao), (Estado::Novo, Some(1)));
        assert_eq!(r.indice.as_deref().map(str::as_bytes), Some(V1));
        assert_eq!(pacote.ler_arquivo("porta-teste.js").await?, PORTA);
        assert_eq!(pacote.ler_arquivo("transicao-teste.js").await, Err(ErroDoPacote::NaoEncontrado));
        assert_eq!(pacote.ler_arquivo("../indice.json").await, Err(ErroDoPacote::NaoEncontrado));
        assert!(sobras(&pacote)?.is_empty());
        // De v1 para v2: troca e apaga a velha.
        let r = pacote.atualizar(&fonte_v2(), APP).await?;
        assert_eq!((r.estado, r.versao), (Estado::Novo, Some(2)));
        assert_eq!(pacote.ler_arquivo("transicao-teste.js").await?, TRANSICAO);
        assert!(sobras(&pacote)?.is_empty());
        std::fs::remove_dir_all(&pacote.raiz)?;
        Ok(())
    }

    #[tokio::test]
    async fn igual_nao_baixa_arquivos_e_menor_ou_motor_maior_mantem_o_atual() -> Resultado {
        let pacote = pacote_de_teste("versoes")?;
        pacote.atualizar(&fonte_v2(), APP).await?;
        // Só o índice publicado: se tentasse baixar um módulo, daria sem_internet.
        let r = pacote.atualizar(&FonteFalsa::com(V2, V2_SIG, &[]), APP).await?;
        assert_eq!((r.estado, r.versao), (Estado::Igual, Some(2)));
        let r = pacote.atualizar(&fonte_v1(), APP).await?;
        assert_eq!((r.estado, r.versao), (Estado::Antigo, Some(2)));
        let motor = FonteFalsa::com(V3_MOTOR, V3_MOTOR_SIG, &[("porta-teste.js", PORTA)]);
        let r = pacote.atualizar(&motor, APP).await?;
        assert_eq!((r.estado, r.versao), (Estado::AppVelho, Some(2)));
        assert_eq!(r.indice.as_deref().map(str::as_bytes), Some(V2));
        // Com o app novo o bastante, o mesmo pacote entra.
        let r = pacote.atualizar(&motor, (99, 0, 0)).await?;
        assert_eq!((r.estado, r.versao), (Estado::Novo, Some(3)));
        std::fs::remove_dir_all(&pacote.raiz)?;
        Ok(())
    }

    #[tokio::test]
    async fn falha_no_meio_deixa_o_atual_e_nao_deixa_sobra() -> Resultado {
        let pacote = pacote_de_teste("meio")?;
        pacote.atualizar(&fonte_v1(), APP).await?;
        // Mesmo tamanho, conteúdo trocado: só o sha256 denuncia.
        let mut trocado = TRANSICAO.to_vec();
        trocado[0] ^= 1;
        let sha_errado = FonteFalsa::com(V2, V2_SIG, &[("porta-teste.js", PORTA), ("transicao-teste.js", trocado.as_slice())]);
        let maior = [TRANSICAO, b"//".as_slice()].concat();
        let grande = FonteFalsa::com(V2, V2_SIG, &[("porta-teste.js", PORTA), ("transicao-teste.js", maior.as_slice())]);
        let caiu = FonteFalsa::com(V2, V2_SIG, &[("porta-teste.js", PORTA)]);
        let outra_chave = FonteFalsa::com(V2, V2_SIG_OUTRA, &[("porta-teste.js", PORTA), ("transicao-teste.js", TRANSICAO)]);
        let sem_rede = FonteFalsa(HashMap::new());
        for (fonte, estado) in [
            (sha_errado, Estado::Invalido),
            (grande, Estado::Invalido),
            (caiu, Estado::SemInternet),
            (outra_chave, Estado::Invalido),
            (sem_rede, Estado::SemInternet),
        ] {
            let r = pacote.atualizar(&fonte, APP).await?;
            assert_eq!((r.estado, r.versao), (estado, Some(1)));
            assert_eq!(pacote.ler_indice().await?.indice.versao, 1);
            assert_eq!(pacote.ler_arquivo("porta-teste.js").await?, PORTA);
            assert!(sobras(&pacote)?.is_empty(), "{:?}", sobras(&pacote));
        }
        std::fs::remove_dir_all(&pacote.raiz)?;
        Ok(())
    }

    #[tokio::test]
    async fn troca_que_falha_devolve_o_atual() -> Resultado {
        let pacote = pacote_de_teste("troca")?;
        pacote.atualizar(&fonte_v1(), APP).await?;
        let inexistente = pacote.raiz.join("novo-que-nao-existe");
        assert!(matches!(trocar(&pacote.raiz, &inexistente).await, Err(ErroDoPacote::Disco(_))));
        assert_eq!(pacote.ler_indice().await?.indice.versao, 1);
        assert!(sobras(&pacote)?.is_empty());
        std::fs::remove_dir_all(&pacote.raiz)?;
        Ok(())
    }

    #[tokio::test]
    async fn queda_entre_as_trocas_e_recuperada_na_proxima() -> Resultado {
        let pacote = pacote_de_teste("queda")?;
        pacote.atualizar(&fonte_v1(), APP).await?;
        // Simula o app fechado depois de `atual -> velho` e com uma `novo` pela metade.
        std::fs::rename(pacote.pasta_atual(), pacote.raiz.join("velho-0"))?;
        std::fs::create_dir_all(pacote.raiz.join("novo-0"))?;
        assert_eq!(pacote.ler_indice().await, Err(ErroDoPacote::NaoEncontrado));
        let r = pacote.atualizar(&FonteFalsa(HashMap::new()), APP).await?;
        assert_eq!((r.estado, r.versao), (Estado::SemInternet, Some(1)));
        assert!(sobras(&pacote)?.is_empty());
        std::fs::remove_dir_all(&pacote.raiz)?;
        Ok(())
    }

    #[tokio::test]
    async fn disco_adulterado_nao_sai() -> Resultado {
        let pacote = pacote_de_teste("adulterado")?;
        pacote.atualizar(&fonte_v2(), APP).await?;
        let atual = pacote.pasta_atual();
        // Arquivo posto à mão, fora do índice.
        std::fs::write(atual.join("intruso.js"), b"alert(1)")?;
        assert_eq!(pacote.ler_arquivo("intruso.js").await, Err(ErroDoPacote::NaoEncontrado));
        // Módulo listado, mas trocado depois de instalado.
        std::fs::write(atual.join("transicao-teste.js"), [TRANSICAO, b"//".as_slice()].concat())?;
        assert_eq!(pacote.ler_arquivo("transicao-teste.js").await, Err(ErroDoPacote::Invalido("arquivo grande demais")));
        let mut trocado = TRANSICAO.to_vec();
        trocado[0] ^= 1;
        std::fs::write(atual.join("transicao-teste.js"), &trocado)?;
        assert_eq!(pacote.ler_arquivo("transicao-teste.js").await, Err(ErroDoPacote::Invalido("sha256 do arquivo")));
        // Índice editado à mão: a assinatura reconferida derruba tudo.
        let editado = std::str::from_utf8(V2)?.replace(r#""versao": 2"#, r#""versao": 7"#);
        std::fs::write(atual.join(NOME_DO_INDICE), editado)?;
        assert_eq!(pacote.ler_indice().await, Err(ErroDoPacote::Invalido("assinatura")));
        assert_eq!(pacote.ler_arquivo("porta-teste.js").await, Err(ErroDoPacote::Invalido("assinatura")));
        std::fs::remove_dir_all(&pacote.raiz)?;
        Ok(())
    }
}
