//! PACOTE DE MINIGAMES: o jogo Godot (o motor tem 38 MB) não vem no instalador.
//!
//! Na primeira vez que o mestre abre o pino do jogo, o app baixa o pacote da
//! release fixa `minigames` (pré-lançamento) do GitHub para
//! `<appData>/minigames/<jogo>/atual` e a sala serve os arquivos aos jogadores
//! em `/minigames/<jogo>/<nome>`. O pacote sai de `scripts/pacote-minigames.cjs`.
//!
//! Na release, por jogo:
//!  - `<jogo>.indice.json` e `<jogo>.indice.json.sig` (mesma chave do atualizador);
//!  - `<jogo>.v<versao>.<nome>.gz`: cada arquivo do export web, em gzip. O nome
//!    servido é o do meio (`fogo.v3.index.wasm.gz` sai como `index.wasm`), e a
//!    sala manda os bytes como estão, com `Content-Encoding: gzip`.
//!
//! O jogo é código que roda no navegador do jogador, então a confiança é a do
//! pacote de animações (`animacoes.rs`, de onde vêm a assinatura, a conferência
//! de sha256, a decisão de versão e a troca de pasta): o índice só vale
//! assinado pela chave do atualizador, conferido a CADA leitura, e cada
//! arquivo só sai se o tamanho e o sha256 baterem com ele.

use std::collections::HashSet;
use std::future::Future;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

use serde::{Deserialize, Serialize};

use super::animacoes::{
    self, conferir_arquivo, decidir, disco, ler_com_teto, ler_versao, sha_valido, verificar_assinatura, Arquivo, ErroDoPacote,
    Estado, Indice, Versao, CHAVE_PUBLICA, PASTA_ATUAL, PREFIXO_NOVO,
};

/// Pasta dentro do `app_data_dir`; cada jogo tem a sua dentro dela.
pub const PASTA_DE_MINIGAMES: &str = "minigames";

/// Onde o pacote é publicado (a release `minigames` do repositório do app).
pub const URL_BASE: &str = "https://github.com/GedasioSaga/labirinto-vtt/releases/download/minigames/";

/// Os jogos que o app sabe baixar e servir (os `JOGOS` do script).
pub const JOGOS: [&str; 1] = ["fogo"];

/// A página que o iframe abre (o `ENTRADA` do script).
pub const ENTRADA: &str = "index.html";

/// Os mesmos tetos do script; tamanhos JÁ em gzip.
pub const TETO_ARQUIVO: u64 = 32 * 1024 * 1024;
pub const TETO_TOTAL: u64 = 64 * 1024 * 1024;
pub const MAX_ARQUIVOS: usize = 32;
const MAX_NOME: usize = 60;
const FORMATO: u64 = 1;
const TETO_ASSINATURA: u64 = 8 * 1024;

const TEMPO_PARA_CONECTAR: Duration = Duration::from_secs(10);
/// Sem prazo total: o motor tem ~10 MB e a internet do mestre pode ser lenta.
/// O que derruba é ficar este tempo sem receber nada.
const TEMPO_SEM_DADOS: Duration = Duration::from_secs(30);
/// A publicação troca índice e `.sig` em dois envios: quem lê no meio pega um
/// par trocado (ou nenhum índice). Uma releitura depois desta espera resolve.
const ESPERA_PARA_RELER: Duration = Duration::from_secs(2);
/// De quantos em quantos bytes o progresso vai ao TS.
const PASSO_DO_PROGRESSO: u64 = 256 * 1024;

pub fn jogo_conhecido(jogo: &str) -> Option<&'static str> {
    JOGOS.iter().copied().find(|conhecido| *conhecido == jogo)
}

pub fn nome_do_indice(jogo: &str) -> String {
    format!("{jogo}.indice.json")
}

pub fn nome_da_assinatura(jogo: &str) -> String {
    format!("{jogo}.indice.json.sig")
}

/// O `Content-Type` de um nome servido; `None` = extensão fora do pacote.
pub fn tipo_do_arquivo(servido: &str) -> Option<&'static str> {
    match servido.rsplit_once('.')?.1 {
        "html" => Some("text/html; charset=utf-8"),
        "js" => Some("text/javascript; charset=utf-8"),
        // Sem este tipo o navegador recusa o `instantiateStreaming` do Godot.
        "wasm" => Some("application/wasm"),
        "pck" => Some("application/octet-stream"),
        "png" => Some("image/png"),
        _ => None,
    }
}

/// O `NOME_SERVIDO` do script: trechos de `[a-z0-9-]` separados por um ponto,
/// com uma das extensões do pacote. Sem barra, sem ponto sobrando, sem `..`,
/// e sem nome de dispositivo do Windows na frente (`con.js` abre o dispositivo).
pub fn nome_servido_valido(nome: &str) -> bool {
    (1..=MAX_NOME).contains(&nome.len())
        && nome.split('.').count() >= 2
        && nome.split('.').all(|trecho| {
            !trecho.is_empty() && trecho.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
        })
        && tipo_do_arquivo(nome).is_some()
        && nome.split('.').next().is_some_and(|base| !animacoes::nome_de_dispositivo_do_windows(base))
}

/// `fogo.v3.index.wasm.gz` -> `index.wasm`, só se o prefixo for deste jogo e
/// desta versão (um índice v3 não aponta para arquivo da v2).
fn servido_do_nome<'a>(jogo: &str, versao: u64, nome: &'a str) -> Option<&'a str> {
    let servido = nome.strip_prefix(&format!("{jogo}.v{versao}."))?.strip_suffix(".gz")?;
    nome_servido_valido(servido).then_some(servido)
}

/// O índice validado: o `Indice` das animações (para reusar `decidir` e
/// `conferir_arquivo`) e, na mesma ordem, o nome servido de cada arquivo.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IndiceDoMinigame {
    pub base: Indice,
    servidos: Vec<String>,
}

impl IndiceDoMinigame {
    /// O arquivo que sai como `servido`, se o índice o lista.
    pub fn arquivo(&self, servido: &str) -> Option<&Arquivo> {
        let posicao = self.servidos.iter().position(|nome| nome == servido)?;
        self.base.arquivos.get(posicao)
    }

    /// Soma do que se baixa (os .gz).
    pub fn total(&self) -> u64 {
        self.base.arquivos.iter().map(|arquivo| arquivo.tamanho).sum()
    }
}

/// Índice com a assinatura conferida e a forma validada, com o texto exato.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Verificado {
    pub texto: String,
    pub assinatura: String,
    pub indice: IndiceDoMinigame,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct IndiceBruto {
    formato: u64,
    jogo: String,
    versao: u64,
    motor_minimo: String,
    entrada: String,
    arquivos: Vec<ArquivoBruto>,
}

#[derive(Deserialize)]
struct ArquivoBruto {
    nome: String,
    sha256: String,
    tamanho: u64,
}

/// Valida a forma do índice de `jogo` (não a assinatura). Campo a mais passa.
pub fn validar_indice(texto: &str, jogo: &str) -> Result<IndiceDoMinigame, ErroDoPacote> {
    let forma = ErroDoPacote::Invalido;
    if u64::try_from(texto.len()).unwrap_or(u64::MAX) > animacoes::TETO_INDICE {
        return Err(forma("indice grande demais"));
    }
    if !texto.trim_start().starts_with('{') {
        return Err(forma("indice nao e objeto"));
    }
    let bruto: IndiceBruto = serde_json::from_str(texto).map_err(|_| forma("indice mal formado"))?;
    if bruto.formato != FORMATO {
        return Err(forma("formato desconhecido"));
    }
    if bruto.jogo != jogo {
        return Err(forma("indice de outro jogo"));
    }
    if bruto.versao == 0 {
        return Err(forma("versao"));
    }
    let motor_minimo = ler_versao(&bruto.motor_minimo).ok_or(forma("motorMinimo"))?;
    if bruto.entrada != ENTRADA {
        return Err(forma("entrada"));
    }
    if bruto.arquivos.len() > MAX_ARQUIVOS {
        return Err(forma("arquivos demais"));
    }
    let mut nomes = HashSet::new();
    let mut total: u64 = 0;
    let mut arquivos = Vec::with_capacity(bruto.arquivos.len());
    let mut servidos = Vec::with_capacity(bruto.arquivos.len());
    for arquivo in bruto.arquivos {
        if arquivo.nome.len() > MAX_NOME {
            return Err(forma("nome de arquivo"));
        }
        let servido = servido_do_nome(jogo, bruto.versao, &arquivo.nome).ok_or(forma("nome de arquivo"))?.to_owned();
        if !nomes.insert(servido.clone()) {
            return Err(forma("nome repetido"));
        }
        if !sha_valido(&arquivo.sha256) {
            return Err(forma("sha256"));
        }
        if arquivo.tamanho > TETO_ARQUIVO {
            return Err(forma("arquivo grande demais"));
        }
        // Cabe com folga: no máximo 32 x 32 MiB.
        total += arquivo.tamanho;
        arquivos.push(Arquivo { nome: arquivo.nome, sha256: arquivo.sha256, tamanho: arquivo.tamanho });
        servidos.push(servido);
    }
    if total > TETO_TOTAL {
        return Err(forma("pacote grande demais"));
    }
    if !nomes.contains(ENTRADA) {
        return Err(forma("sem a entrada"));
    }
    Ok(IndiceDoMinigame { base: Indice { versao: bruto.versao, motor_minimo, arquivos }, servidos })
}

/// Assinatura primeiro, forma depois, como em `animacoes::verificar_indice`.
pub fn verificar_indice(bytes: Vec<u8>, assinatura: &str, chave_publica: &str, jogo: &str) -> Result<Verificado, ErroDoPacote> {
    if u64::try_from(bytes.len()).unwrap_or(u64::MAX) > animacoes::TETO_INDICE {
        return Err(ErroDoPacote::Invalido("indice grande demais"));
    }
    verificar_assinatura(&bytes, assinatura, chave_publica)?;
    let texto = String::from_utf8(bytes).map_err(|_| ErroDoPacote::Invalido("indice nao e utf-8"))?;
    let indice = validar_indice(&texto, jogo)?;
    Ok(Verificado { texto, assinatura: assinatura.to_owned(), indice })
}

/// O que `minigames_atualizar` devolve ao TS (`RespostaDaAtualizacao`):
/// `versao` é a instalada DEPOIS da chamada (`None` = nenhuma).
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ResultadoDaAtualizacao {
    pub estado: Estado,
    pub versao: Option<u64>,
}

impl ResultadoDaAtualizacao {
    fn com(estado: Estado, instalado: Option<&Verificado>) -> Self {
        Self { estado, versao: instalado.map(|verificado| verificado.indice.base.versao) }
    }
}

/// Uma mensagem do canal de progresso (`lerProgresso` do TS).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct Progresso {
    pub baixado: u64,
    pub total: u64,
}

// ---------------------------------------------------------------------------
// I/O
// ---------------------------------------------------------------------------

/// De onde o pacote vem. O app usa `GitHub`; os testes, uma fonte em memória.
pub trait Fonte {
    /// Os bytes de `nome` na release. Mais de `teto` bytes = `Invalido`; nome
    /// que não existe = `NaoEncontrado`; sem rede ou outro erro HTTP = `SemRede`.
    /// `ao_receber` recebe o tamanho de cada pedaço que chega.
    fn baixar(
        &self,
        nome: &str,
        teto: u64,
        ao_receber: &(dyn Fn(u64) + Sync),
    ) -> impl Future<Output = Result<Vec<u8>, ErroDoPacote>> + Send;
}

pub struct GitHub {
    cliente: reqwest::Client,
    base: String,
}

/// SÓ EM BUILD DE DEBUG: `LABIRINTO_MINIGAMES_URL` troca de onde o pacote vem,
/// para uma prova servir um pacote de teste local. A assinatura continua
/// conferida com a chave embutida. Em release a origem é sempre `URL_BASE`.
#[cfg(debug_assertions)]
fn url_base() -> String {
    match std::env::var("LABIRINTO_MINIGAMES_URL") {
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
            .https_only(base.starts_with("https://"))
            .connect_timeout(TEMPO_PARA_CONECTAR)
            .read_timeout(TEMPO_SEM_DADOS)
            .user_agent(concat!("labirinto-vtt/", env!("CARGO_PKG_VERSION")))
            .build()
            .map_err(|_| ErroDoPacote::SemRede)?;
        Ok(Self { cliente, base })
    }
}

impl Fonte for GitHub {
    async fn baixar(&self, nome: &str, teto: u64, ao_receber: &(dyn Fn(u64) + Sync)) -> Result<Vec<u8>, ErroDoPacote> {
        let grande_demais = ErroDoPacote::Invalido("download grande demais");
        let mut resposta =
            self.cliente.get(format!("{}{nome}", self.base)).send().await.map_err(|_| ErroDoPacote::SemRede)?;
        if resposta.status() == reqwest::StatusCode::NOT_FOUND {
            return Err(ErroDoPacote::NaoEncontrado);
        }
        if !resposta.status().is_success() {
            return Err(ErroDoPacote::SemRede);
        }
        if resposta.content_length().is_some_and(|tamanho| tamanho > teto) {
            return Err(grande_demais);
        }
        let mut bytes = Vec::new();
        while let Some(pedaco) = resposta.chunk().await.map_err(|_| ErroDoPacote::SemRede)? {
            let total = bytes.len().saturating_add(pedaco.len());
            if u64::try_from(total).unwrap_or(u64::MAX) > teto {
                return Err(grande_demais);
            }
            bytes.extend_from_slice(&pedaco);
            ao_receber(u64::try_from(pedaco.len()).unwrap_or(u64::MAX));
        }
        Ok(bytes)
    }
}

/// Uma atualização por vez no app inteiro (duas trocas de pasta se atropelariam).
static TRAVA_DE_ATUALIZACAO: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

/// O pacote de UM jogo no disco (`<raiz>/atual`) e a chave que o confere.
#[derive(Debug, Clone)]
pub struct Pacote {
    raiz: PathBuf,
    jogo: &'static str,
    chave_publica: &'static str,
    espera_para_reler: Duration,
}

impl Pacote {
    /// `<appData>/minigames/<jogo>`, conferido pela chave do atualizador.
    /// `None` = jogo que o app não conhece.
    pub fn oficial(dados_do_app: &Path, jogo: &str) -> Option<Self> {
        let jogo = jogo_conhecido(jogo)?;
        Some(Self {
            raiz: dados_do_app.join(PASTA_DE_MINIGAMES).join(jogo),
            jogo,
            chave_publica: CHAVE_PUBLICA,
            espera_para_reler: ESPERA_PARA_RELER,
        })
    }

    /// Outra raiz e outra chave: só os testes, que não têm a chave privada real.
    pub fn com_chave(raiz: PathBuf, jogo: &'static str, chave_publica: &'static str) -> Self {
        Self { raiz, jogo, chave_publica, espera_para_reler: Duration::ZERO }
    }

    pub fn jogo(&self) -> &'static str {
        self.jogo
    }

    pub fn pasta_atual(&self) -> PathBuf {
        self.raiz.join(PASTA_ATUAL)
    }

    /// O índice instalado, com a assinatura conferida agora.
    pub async fn ler_indice(&self) -> Result<Verificado, ErroDoPacote> {
        let pasta = self.pasta_atual();
        let bytes = ler_com_teto(&pasta.join(nome_do_indice(self.jogo)), animacoes::TETO_INDICE).await?;
        let assinatura = ler_com_teto(&pasta.join(nome_da_assinatura(self.jogo)), TETO_ASSINATURA).await?;
        let assinatura = String::from_utf8(assinatura).map_err(|_| ErroDoPacote::Invalido("assinatura"))?;
        verificar_indice(bytes, &assinatura, self.chave_publica, self.jogo)
    }

    /// Os bytes (em gzip) de um arquivo do índice já verificado, só se baterem
    /// com o sha256 dele. O nome já passou por `validar_indice`: sem barra nem
    /// `..`, então juntá-lo à pasta não sai dela.
    pub async fn ler_arquivo_de(&self, arquivo: &Arquivo) -> Result<Vec<u8>, ErroDoPacote> {
        let bytes = ler_com_teto(&self.pasta_atual().join(&arquivo.nome), arquivo.tamanho).await?;
        conferir_arquivo(arquivo, &bytes)?;
        Ok(bytes)
    }

    /// Procura pacote novo na `fonte` e instala se for o caso; o progresso do
    /// download vai para `progresso`. `Err` só por falha de disco local.
    pub async fn atualizar(
        &self,
        fonte: &impl Fonte,
        versao_do_app: Versao,
        progresso: &(dyn Fn(Progresso) + Sync),
    ) -> Result<ResultadoDaAtualizacao, ErroDoPacote> {
        let _vez = TRAVA_DE_ATUALIZACAO.lock().await;
        tokio::fs::create_dir_all(&self.raiz).await.map_err(disco)?;
        animacoes::limpar_sobras(&self.raiz).await;
        let instalado = self.ler_indice().await.ok();

        let novo = match self.baixar_indice(fonte).await {
            Ok(novo) => novo,
            Err(erro) => return recusa(erro, instalado.as_ref()),
        };
        let estado = decidir(instalado.as_ref().map(|i| i.indice.base.versao), &novo.indice.base, versao_do_app);
        if estado != Estado::Novo {
            return Ok(ResultadoDaAtualizacao::com(estado, instalado.as_ref()));
        }
        if let Err(erro) = self.instalar(fonte, &novo, progresso).await {
            return recusa(erro, instalado.as_ref());
        }
        let instalado = self.ler_indice().await.ok();
        Ok(ResultadoDaAtualizacao::com(Estado::Novo, instalado.as_ref()))
    }

    /// Índice e `.sig`; se não conferirem (ou o índice sumir), relê uma vez:
    /// a publicação troca os dois em envios separados.
    async fn baixar_indice(&self, fonte: &impl Fonte) -> Result<Verificado, ErroDoPacote> {
        match self.baixar_indice_uma_vez(fonte).await {
            Err(ErroDoPacote::Invalido(_) | ErroDoPacote::NaoEncontrado) => {
                tokio::time::sleep(self.espera_para_reler).await;
                self.baixar_indice_uma_vez(fonte).await
            }
            resultado => resultado,
        }
    }

    async fn baixar_indice_uma_vez(&self, fonte: &impl Fonte) -> Result<Verificado, ErroDoPacote> {
        let nada = |_: u64| {};
        let bytes = fonte.baixar(&nome_do_indice(self.jogo), animacoes::TETO_INDICE, &nada).await?;
        let assinatura = fonte.baixar(&nome_da_assinatura(self.jogo), TETO_ASSINATURA, &nada).await?;
        let assinatura = String::from_utf8(assinatura).map_err(|_| ErroDoPacote::Invalido("assinatura"))?;
        verificar_indice(bytes, &assinatura, self.chave_publica, self.jogo)
    }

    /// Baixa para `novo-<x>`, confere e só então troca (`animacoes::trocar`).
    async fn instalar(&self, fonte: &impl Fonte, novo: &Verificado, progresso: &(dyn Fn(Progresso) + Sync)) -> Result<(), ErroDoPacote> {
        let temporaria = self.raiz.join(format!("{PREFIXO_NOVO}{}", animacoes::sufixo_aleatorio()));
        let feito = match self.preencher(fonte, novo, &temporaria, progresso).await {
            Ok(()) => animacoes::trocar(&self.raiz, &temporaria).await,
            Err(erro) => Err(erro),
        };
        if feito.is_err() {
            let _ = tokio::fs::remove_dir_all(&temporaria).await;
        }
        feito
    }

    /// Os arquivos primeiro, o índice por último: pasta sem índice nunca é
    /// lida como pacote.
    async fn preencher(
        &self,
        fonte: &impl Fonte,
        novo: &Verificado,
        pasta: &Path,
        progresso: &(dyn Fn(Progresso) + Sync),
    ) -> Result<(), ErroDoPacote> {
        tokio::fs::create_dir_all(pasta).await.map_err(disco)?;
        let total = novo.indice.total();
        let baixado = AtomicU64::new(0);
        let avisado = AtomicU64::new(0);
        progresso(Progresso { baixado: 0, total });
        let ao_receber = |bytes: u64| {
            // O que vier a mais que o índice promete já é recusa do `teto`; o
            // `min` só mantém `baixado <= total`, que o TS exige.
            let agora = baixado.fetch_add(bytes, Ordering::Relaxed).saturating_add(bytes).min(total);
            if agora.saturating_sub(avisado.load(Ordering::Relaxed)) >= PASSO_DO_PROGRESSO || agora == total {
                avisado.store(agora, Ordering::Relaxed);
                progresso(Progresso { baixado: agora, total });
            }
        };
        for arquivo in &novo.indice.base.arquivos {
            let bytes = fonte.baixar(&arquivo.nome, arquivo.tamanho, &ao_receber).await?;
            conferir_arquivo(arquivo, &bytes)?;
            tokio::fs::write(pasta.join(&arquivo.nome), &bytes).await.map_err(disco)?;
        }
        tokio::fs::write(pasta.join(nome_da_assinatura(self.jogo)), novo.assinatura.as_bytes()).await.map_err(disco)?;
        tokio::fs::write(pasta.join(nome_do_indice(self.jogo)), novo.texto.as_bytes()).await.map_err(disco)?;
        Ok(())
    }
}

/// Rede e pacote ruim viram `estado`, mantendo o instalado; disco sobe como
/// `Err`. Índice que não existe na release (ainda não publicado) conta como
/// "sem internet": não há o que baixar.
fn recusa(erro: ErroDoPacote, instalado: Option<&Verificado>) -> Result<ResultadoDaAtualizacao, ErroDoPacote> {
    let estado = match erro {
        ErroDoPacote::SemRede | ErroDoPacote::NaoEncontrado => Estado::SemInternet,
        ErroDoPacote::Invalido(motivo) => {
            eprintln!("pacote de minigame recusado: {motivo}");
            Estado::Invalido
        }
        ErroDoPacote::Disco(_) => return Err(erro),
    };
    Ok(ResultadoDaAtualizacao::com(estado, instalado))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use std::sync::Mutex;

    type Resultado = Result<(), Box<dyn std::error::Error>>;

    const CHAVE_TESTE: &str = include_str!("../../tests/fixtures/minigames/chave-teste.pub");
    const INDICE: &str = include_str!("../../tests/fixtures/minigames/fogo.indice.json");
    const INDICE_SIG: &str = include_str!("../../tests/fixtures/minigames/fogo.indice.json.sig");
    const HTML_GZ: &[u8] = include_bytes!("../../tests/fixtures/minigames/fogo.v1.index.html.gz");
    const WASM_GZ: &[u8] = include_bytes!("../../tests/fixtures/minigames/fogo.v1.index.wasm.gz");
    const APP: Versao = (0, 5, 37);

    struct FonteFalsa(HashMap<String, Vec<u8>>);

    impl Fonte for FonteFalsa {
        async fn baixar(&self, nome: &str, teto: u64, ao_receber: &(dyn Fn(u64) + Sync)) -> Result<Vec<u8>, ErroDoPacote> {
            let bytes = self.0.get(nome).ok_or(ErroDoPacote::NaoEncontrado)?;
            if u64::try_from(bytes.len()).unwrap_or(u64::MAX) > teto {
                return Err(ErroDoPacote::Invalido("download grande demais"));
            }
            ao_receber(u64::try_from(bytes.len()).unwrap_or(u64::MAX));
            Ok(bytes.clone())
        }
    }

    fn fonte_v1() -> FonteFalsa {
        FonteFalsa(HashMap::from([
            ("fogo.indice.json".to_owned(), INDICE.as_bytes().to_vec()),
            ("fogo.indice.json.sig".to_owned(), INDICE_SIG.as_bytes().to_vec()),
            ("fogo.v1.index.html.gz".to_owned(), HTML_GZ.to_vec()),
            ("fogo.v1.index.wasm.gz".to_owned(), WASM_GZ.to_vec()),
        ]))
    }

    fn indice_com(arquivos: &str, extra: &str) -> String {
        format!(r#"{{"formato":1,"jogo":"fogo","versao":2,"motorMinimo":"0.5.0","entrada":"index.html"{extra},"arquivos":[{arquivos}]}}"#)
    }

    fn arquivo_json(nome: &str) -> String {
        format!(r#"{{"nome":"{nome}","sha256":"{}","tamanho":10}}"#, "a".repeat(64))
    }

    /// Forma do índice: o publicado pelo script passa; nome com caminho, de
    /// outra versão ou de outro jogo, extensão fora da lista e falta da
    /// entrada são recusados.
    #[test]
    fn indice_valida_nomes_versao_e_entrada() -> Resultado {
        let verificado = verificar_indice(INDICE.as_bytes().to_vec(), INDICE_SIG, CHAVE_TESTE, "fogo")?;
        assert_eq!(verificado.indice.base.versao, 1);
        assert_eq!(verificado.indice.arquivo("index.wasm").map(|a| a.nome.as_str()), Some("fogo.v1.index.wasm.gz"));
        assert!(verificado.indice.arquivo("fogo.v1.index.wasm.gz").is_none());
        // A assinatura de teste não vale com a chave real, nem para outro jogo.
        assert_eq!(verificar_indice(INDICE.as_bytes().to_vec(), INDICE_SIG, CHAVE_PUBLICA, "fogo"), Err(ErroDoPacote::Invalido("assinatura")));
        assert_eq!(verificar_indice(INDICE.as_bytes().to_vec(), INDICE_SIG, CHAVE_TESTE, "pesca"), Err(ErroDoPacote::Invalido("indice de outro jogo")));

        let html = arquivo_json("fogo.v2.index.html.gz");
        assert!(validar_indice(&indice_com(&format!("{html},{}", arquivo_json("fogo.v2.index.wasm.gz")), ""), "fogo").is_ok());
        for ruim in ["fogo.v2.../x.js.gz", "fogo.v2.a/b.js.gz", "fogo.v1.index.js.gz", "pesca.v2.index.js.gz", "fogo.v2.index.exe.gz", "fogo.v2.con.js.gz", "fogo.v2.Index.js.gz", "fogo.v2.index.js"] {
            let texto = indice_com(&format!("{html},{}", arquivo_json(ruim)), "");
            assert_eq!(validar_indice(&texto, "fogo"), Err(ErroDoPacote::Invalido("nome de arquivo")), "{ruim}");
        }
        assert_eq!(validar_indice(&indice_com(&arquivo_json("fogo.v2.index.js.gz"), ""), "fogo"), Err(ErroDoPacote::Invalido("sem a entrada")));
        assert_eq!(validar_indice(&indice_com(&format!("{html},{html}"), ""), "fogo"), Err(ErroDoPacote::Invalido("nome repetido")));
        Ok(())
    }

    /// Primeira vez: baixa, confere, instala e avisa o progresso até o total;
    /// a segunda chamada vê a mesma versão e não baixa de novo.
    #[tokio::test]
    async fn atualizar_instala_com_progresso_e_depois_fica_igual() -> Resultado {
        let raiz = std::env::temp_dir().join(format!("labirinto-minigames-atualizar-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&raiz);
        let pacote = Pacote::com_chave(raiz.clone(), "fogo", CHAVE_TESTE);
        let avisos = Mutex::new(Vec::new());
        let anotar = |p: Progresso| avisos.lock().map(|mut lista| lista.push(p)).unwrap_or(());

        let resultado = pacote.atualizar(&fonte_v1(), APP, &anotar).await?;
        assert_eq!(resultado, ResultadoDaAtualizacao { estado: Estado::Novo, versao: Some(1) });
        let total = u64::try_from(HTML_GZ.len() + WASM_GZ.len())?;
        let avisos_feitos = avisos.lock().map(|lista| lista.clone()).unwrap_or_default();
        assert_eq!(avisos_feitos.first(), Some(&Progresso { baixado: 0, total }));
        assert_eq!(avisos_feitos.last(), Some(&Progresso { baixado: total, total }));

        let verificado = pacote.ler_indice().await?;
        let wasm = verificado.indice.arquivo("index.wasm").ok_or("sem index.wasm")?;
        assert_eq!(pacote.ler_arquivo_de(wasm).await?, WASM_GZ);

        let de_novo = pacote.atualizar(&fonte_v1(), APP, &|_| {}).await?;
        assert_eq!(de_novo, ResultadoDaAtualizacao { estado: Estado::Igual, versao: Some(1) });
        // Sem a release publicada: "sem internet", e o instalado continua.
        let vazia = FonteFalsa(HashMap::new());
        assert_eq!(pacote.atualizar(&vazia, APP, &|_| {}).await?, ResultadoDaAtualizacao { estado: Estado::SemInternet, versao: Some(1) });
        std::fs::remove_dir_all(&raiz)?;
        Ok(())
    }
}
