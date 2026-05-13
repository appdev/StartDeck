package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"golang.org/x/crypto/bcrypt"
)

func TestLoadSecretKeyTrimsWhitespace(t *testing.T) {
	dir := t.TempDir()
	secretPath := filepath.Join(dir, "secret.key")
	if err := os.WriteFile(secretPath, []byte("abc123\n"), 0600); err != nil {
		t.Fatalf("write secret: %v", err)
	}

	oldSecretFile := SecretFile
	oldSecretKey := SecretKey
	SecretFile = secretPath
	SecretKey = nil
	t.Cleanup(func() {
		SecretFile = oldSecretFile
		SecretKey = oldSecretKey
	})

	loadSecretKey()

	if string(SecretKey) != "abc123" {
		t.Fatalf("expected trimmed secret, got %q", string(SecretKey))
	}
}

func withTempConfigPaths(t *testing.T, authMode string) (string, string) {
	t.Helper()

	tempDir := t.TempDir()
	dataDir := filepath.Join(tempDir, "data")
	usersDir := filepath.Join(dataDir, "users")
	systemFile := filepath.Join(dataDir, "system.json")

	if err := os.MkdirAll(usersDir, 0755); err != nil {
		t.Fatalf("mkdir users dir: %v", err)
	}
	if err := os.WriteFile(systemFile, []byte(`{"authMode":"`+authMode+`","enableDocker":false}`), 0644); err != nil {
		t.Fatalf("write system config: %v", err)
	}

	oldDataDir := DataDir
	oldUsersDir := UsersDir
	oldSystemConfigFile := SystemConfigFile
	DataDir = dataDir
	UsersDir = usersDir
	SystemConfigFile = systemFile
	t.Cleanup(func() {
		DataDir = oldDataDir
		UsersDir = oldUsersDir
		SystemConfigFile = oldSystemConfigFile
	})

	return dataDir, usersDir
}

func readJSONMap(t *testing.T, file string) map[string]interface{} {
	t.Helper()

	data, err := os.ReadFile(file)
	if err != nil {
		t.Fatalf("read %s: %v", file, err)
	}
	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatalf("parse %s: %v", file, err)
	}
	return result
}

func assertPasswordMatches(t *testing.T, hashedValue interface{}, password string) {
	t.Helper()

	hashed, ok := hashedValue.(string)
	if !ok || hashed == "" {
		t.Fatalf("expected hashed password string, got %#v", hashedValue)
	}
	if hashed == password {
		t.Fatal("password was written in plain text")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(hashed), []byte(password)); err != nil {
		t.Fatalf("password hash does not match: %v", err)
	}
}

func TestSyncAdminPasswordFromEnvSingleMode(t *testing.T) {
	dataDir, _ := withTempConfigPaths(t, "single")
	t.Setenv(AdminPasswordEnv, "violet")

	dataFile := filepath.Join(dataDir, "data.json")
	if err := os.WriteFile(dataFile, []byte(`{"appConfig":{"customTitle":"demo"},"groups":[]}`), 0644); err != nil {
		t.Fatalf("write data file: %v", err)
	}

	if err := syncAdminPasswordFromEnv(); err != nil {
		t.Fatalf("sync admin password: %v", err)
	}

	adminData := readJSONMap(t, dataFile)
	if got := adminData["username"]; got != "admin" {
		t.Fatalf("expected username admin, got %#v", got)
	}
	if _, ok := adminData["appConfig"]; !ok {
		t.Fatal("expected existing data to be preserved")
	}
	assertPasswordMatches(t, adminData["password"], "violet")
}

func TestSyncAdminPasswordFromEnvMultiMode(t *testing.T) {
	_, usersDir := withTempConfigPaths(t, "multi")
	t.Setenv(AdminPasswordEnv, "violet")

	if err := syncAdminPasswordFromEnv(); err != nil {
		t.Fatalf("sync admin password: %v", err)
	}

	adminData := readJSONMap(t, filepath.Join(usersDir, "admin.json"))
	if got := adminData["username"]; got != "admin" {
		t.Fatalf("expected username admin, got %#v", got)
	}
	assertPasswordMatches(t, adminData["password"], "violet")
}
