//! O espaço livre no disco de `<appData>` (plano §4, passo 6: a importação do
//! Grimório é recusada se sobrarem menos de 8 GB; quem decide é o TypeScript, aqui
//! só se mede).
//!
//! Sem dependência nova: no Windows chama `GetDiskFreeSpaceExW` direto da
//! `kernel32`, que todo binário Rust no Windows já liga. É o único `unsafe` do
//! app, e fica restrito a uma chamada com ponteiros para variáveis locais.

use std::path::Path;

use super::{erro_disco, ErroPreludio};

/// Bytes livres para este usuário (respeita cota de disco) no volume de `caminho`.
/// Se `caminho` ainda não existe (primeira vez do app), mede pela pasta mais
/// próxima que existe, que fica no mesmo disco.
pub(super) fn espaco_livre_em(caminho: &Path) -> Result<u64, ErroPreludio> {
    let existente = caminho
        .ancestors()
        .find(|pasta| pasta.is_dir())
        .ok_or_else(|| erro_disco("Não deu para achar o disco da pasta de dados do app."))?;
    livre_no_volume(existente)
}

#[cfg(windows)]
fn livre_no_volume(pasta: &Path) -> Result<u64, ErroPreludio> {
    use std::os::windows::ffi::OsStrExt as _;

    #[link(name = "kernel32")]
    extern "system" {
        fn GetDiskFreeSpaceExW(
            diretorio: *const u16,
            livre_para_quem_chama: *mut u64,
            total: *mut u64,
            livre_total: *mut u64,
        ) -> i32;
    }

    let largo: Vec<u16> = pasta.as_os_str().encode_wide().chain(Some(0)).collect();
    let mut livre: u64 = 0;
    // SAFETY: `largo` termina em NUL e vive até o fim da chamada; `livre` é um
    // `u64` local (o `ULARGE_INTEGER` do Windows tem o mesmo layout); os dois
    // totais que não interessam vão como nulo, o que a API aceita.
    let ok = unsafe {
        GetDiskFreeSpaceExW(
            largo.as_ptr(),
            &mut livre,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
        )
    };
    if ok == 0 {
        return Err(erro_disco("Não deu para medir o espaço livre no disco."));
    }
    Ok(livre)
}

#[cfg(not(windows))]
fn livre_no_volume(_pasta: &Path) -> Result<u64, ErroPreludio> {
    Err(erro_disco("Medir o espaço livre no disco só funciona no Windows."))
}

#[cfg(all(test, windows))]
mod testes {
    use super::espaco_livre_em;

    #[test]
    fn mede_um_numero_maior_que_zero_numa_pasta_que_existe() {
        let livre = espaco_livre_em(&std::env::temp_dir());
        assert!(matches!(livre, Ok(bytes) if bytes > 0), "{livre:?}");
    }
}
