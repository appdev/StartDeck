use serde_json::{Map, Value};

const LEGACY_STRING_REPLACEMENTS: [(&str, &str); 8] = [
    ("itab-grid/2026-05-22", "sd-grid/2026-05-22"),
    ("itab-capture", "sd-capture"),
    ("/itab-live-assets", "/sd-live-assets"),
    ("/itab/", "/sd/"),
    ("/itab", "/sd"),
    ("itab.", "sd."),
    ("itab_", "sd_"),
    ("itab-", "sd-"),
];

pub fn migrate_legacy_widget_string(value: &str) -> String {
    if value.starts_with("http://") || value.starts_with("https://") {
        return value.to_string();
    }
    LEGACY_STRING_REPLACEMENTS
        .iter()
        .fold(value.to_string(), |next, (from, to)| next.replace(from, to))
}

pub fn migrate_legacy_widget_value(value: Value) -> Value {
    match value {
        Value::String(text) => Value::String(migrate_legacy_widget_string(&text)),
        Value::Array(items) => Value::Array(
            items
                .into_iter()
                .map(migrate_legacy_widget_value)
                .collect::<Vec<_>>(),
        ),
        Value::Object(entries) => {
            let mut migrated = Map::new();
            for (key, value) in entries {
                migrated.insert(
                    if key == "itab" { "sd".to_string() } else { key },
                    migrate_legacy_widget_value(value),
                );
            }
            Value::Object(migrated)
        }
        other => other,
    }
}

pub fn migrate_legacy_widget_json_string(raw: &str) -> String {
    match serde_json::from_str::<Value>(raw) {
        Ok(value) => migrate_legacy_widget_value(value).to_string(),
        Err(_) => migrate_legacy_widget_string(raw),
    }
}
