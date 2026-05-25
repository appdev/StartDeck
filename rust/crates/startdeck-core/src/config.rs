use std::env;
use std::path::{Path, PathBuf};

#[derive(Clone, Debug)]
pub struct RuntimeConfig {
    pub base_dir: PathBuf,
    pub data_dir: PathBuf,
    pub users_dir: PathBuf,
    pub sqlite_file: PathBuf,
    pub public_dir: PathBuf,
    pub music_dir: PathBuf,
    pub backgrounds_dir: PathBuf,
    pub mobile_backgrounds_dir: PathBuf,
    pub icon_cache_dir: PathBuf,
    pub icon_service_data_dir: PathBuf,
    pub host: String,
    pub port: u16,
    pub admin_password: String,
}

impl RuntimeConfig {
    pub fn from_env() -> Self {
        let cwd = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
        let base_dir = env::var_os("BASE_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|| infer_base_dir(&cwd));
        Self::from_base_dir(base_dir)
    }

    pub fn from_base_dir(base_dir: PathBuf) -> Self {
        let data_dir = env::var_os("STARTDECK_DATA_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|| base_dir.join("server").join("data"));
        let port = env::var("PORT")
            .ok()
            .and_then(|value| value.parse::<u16>().ok())
            .unwrap_or(9001);
        let host = env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
        let admin_password =
            env::var("STARTDECK_ADMIN_PASSWORD").unwrap_or_else(|_| "admin".to_string());
        Self {
            users_dir: data_dir.join("users"),
            sqlite_file: data_dir.join("startdeck.sqlite3"),
            public_dir: base_dir.join("server").join("public"),
            music_dir: base_dir.join("server").join("music"),
            backgrounds_dir: base_dir.join("server").join("PC"),
            mobile_backgrounds_dir: base_dir.join("server").join("APP"),
            icon_cache_dir: data_dir.join("icon-cache"),
            icon_service_data_dir: base_dir.join("icon-service").join("data"),
            data_dir,
            base_dir,
            host,
            port,
            admin_password,
        }
    }

    pub fn ensure_dirs(&self) -> std::io::Result<()> {
        for dir in [
            &self.data_dir,
            &self.users_dir,
            &self.public_dir,
            &self.music_dir,
            &self.backgrounds_dir,
            &self.mobile_backgrounds_dir,
            &self.icon_cache_dir,
            &self.icon_service_data_dir,
        ] {
            std::fs::create_dir_all(dir)?;
        }
        Ok(())
    }
}

fn infer_base_dir(cwd: &Path) -> PathBuf {
    match cwd.file_name().and_then(|value| value.to_str()) {
        Some("backend") | Some("frontend") | Some("icon-service") => cwd
            .parent()
            .map(Path::to_path_buf)
            .unwrap_or_else(|| cwd.to_path_buf()),
        _ => cwd.to_path_buf(),
    }
}
