package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return fn(req)
}

func stringResponse(req *http.Request, status int, contentType, body string) *http.Response {
	return &http.Response{
		StatusCode: status,
		Header:     http.Header{"Content-Type": []string{contentType}},
		Body:       io.NopCloser(strings.NewReader(body)),
		Request:    req,
	}
}

func bytesResponse(req *http.Request, status int, contentType string, body []byte) *http.Response {
	return &http.Response{
		StatusCode: status,
		Header:     http.Header{"Content-Type": []string{contentType}},
		Body:       io.NopCloser(bytes.NewReader(body)),
		Request:    req,
	}
}

func TestParseHTMLMetadata(t *testing.T) {
	document := `
		<html>
			<head>
				<title>Example &amp; Site</title>
				<meta name="description" content="Example description">
				<link rel="shortcut icon" href="/favicon.svg">
			</head>
		</html>
	`

	if got := parseHTMLTitle(document); got != "Example & Site" {
		t.Fatalf("expected parsed title, got %q", got)
	}

	if got := parseHTMLMetaContent(document, "description"); got != "Example description" {
		t.Fatalf("expected parsed description, got %q", got)
	}

	if got := parseHTMLIconURL(document, "https://example.com/path/page"); got != "https://example.com/favicon.svg" {
		t.Fatalf("expected absolute icon URL, got %q", got)
	}
}

func TestResolveSiteMetadataPrefersCachedIcon(t *testing.T) {
	pageURL := "https://cached-icon.example/path"

	app := &app{
		seedRecords:  make(map[string]*iconRecord),
		cacheRecords: make(map[string]*iconRecord),
		iconPrefix:   "/icons/",
		cachePrefix:  "/cache/",
		client: &http.Client{
			Timeout: time.Second,
			Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				if req.URL.String() != pageURL {
					return nil, errors.New("unexpected page request")
				}
				return stringResponse(req, http.StatusOK, "text/html; charset=utf-8", `
					<html>
						<head>
							<title>Cached Icon Site</title>
							<meta name="description" content="Page description">
							<link rel="icon" href="/favicon.ico">
						</head>
					</html>
				`), nil
			}),
		},
		itabClient: &itabClient{
			client: &http.Client{
				Timeout: time.Second,
				Transport: roundTripFunc(func(_ *http.Request) (*http.Response, error) {
					return nil, errors.New("unexpected upstream lookup")
				}),
			},
		},
	}
	host := normalizeHost(pageURL)
	app.cacheRecords[host] = &iconRecord{
		Host:       host,
		Name:       "Cached Name",
		URL:        pageURL,
		LocalIcons: []string{"cached-icon.svg"},
		Source:     "itab",
	}

	request := httptest.NewRequest(http.MethodGet, "/api/site/metadata", nil)
	metadata, _, err := app.resolveSiteMetadata(context.Background(), request, pageURL)
	if err != nil {
		t.Fatalf("resolve metadata: %v", err)
	}

	if metadata.Title == nil || *metadata.Title != "Cached Icon Site" {
		t.Fatalf("expected HTML title, got %#v", metadata.Title)
	}
	if metadata.Description == nil || *metadata.Description != "Page description" {
		t.Fatalf("expected HTML description, got %#v", metadata.Description)
	}
	if metadata.Icon == nil || *metadata.Icon != "http://example.com/cache/cached-icon.svg" {
		t.Fatalf("expected cached icon URL, got %#v", metadata.Icon)
	}
}

func TestImportSeedAllowsMissingSeedFile(t *testing.T) {
	app := &app{
		seedPath: filepath.Join(t.TempDir(), "missing-seed.json"),
	}

	if err := app.importSeed(); err != nil {
		t.Fatalf("expected missing seed file to be ignored, got %v", err)
	}
}

func TestWriteSeedFilePreservesAmpersands(t *testing.T) {
	seedPath := filepath.Join(t.TempDir(), "seed-data.json")
	seed := seedFile{
		Items: []seedItem{
			{
				Title:         "A&B",
				URL:           "https://example.com/?a=1&b=2",
				IconURL:       "data/icons/example.svg",
				IconLocalHost: "example.com",
			},
		},
	}

	if err := writeSeedFile(seedPath, &seed); err != nil {
		t.Fatalf("write seed file: %v", err)
	}

	data, err := os.ReadFile(seedPath)
	if err != nil {
		t.Fatalf("read seed file: %v", err)
	}
	content := string(data)
	if strings.Contains(content, "\\u0026") {
		t.Fatalf("expected seed file to preserve &, got %q", content)
	}
	if !strings.Contains(content, "A&B") {
		t.Fatalf("expected title to preserve &, got %q", content)
	}
	if !strings.Contains(content, "https://example.com/?a=1&b=2") {
		t.Fatalf("expected url to preserve &, got %q", content)
	}
}

func TestLookupOrFetchRecordCompletesSeedFieldsAndPersistsSeedFile(t *testing.T) {
	tempDir := t.TempDir()
	seedIconsDir := filepath.Join(tempDir, "data", "icons")
	if err := os.MkdirAll(seedIconsDir, 0o755); err != nil {
		t.Fatalf("mkdir seed icons: %v", err)
	}
	if err := os.WriteFile(filepath.Join(seedIconsDir, "example.png"), []byte("png"), 0o644); err != nil {
		t.Fatalf("write seed icon: %v", err)
	}

	seedPath := filepath.Join(tempDir, "seed-data.json")
	seed := seedFile{
		Items: []seedItem{
			{
				Title:           "",
				URL:             "https://example.com/",
				IconURL:         "data/icons/example.png",
				OriginalIconURL: "",
				BackgroundColor: "",
				IconLocalHost:   "example.com",
			},
		},
	}
	if err := writeSeedFile(seedPath, &seed); err != nil {
		t.Fatalf("write seed file: %v", err)
	}

	microlinkCalls := 0
	app := &app{
		seedRecords:  make(map[string]*iconRecord),
		cacheRecords: make(map[string]*iconRecord),
		seedPath:     seedPath,
		seedIconDir:  seedIconsDir,
		cacheIconDir: filepath.Join(tempDir, "cache"),
		cachePath:    filepath.Join(tempDir, "cache.json"),
		microlinkClient: &microlinkClient{
			client: &http.Client{
				Timeout: time.Second,
				Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
					microlinkCalls++
					payload, err := json.Marshal(microlinkLookupResponse{
						Status: "success",
						Data: microlinkData{
							URL:   "https://example.com/",
							Title: "Example Title",
							Logo: &microlinkAsset{
								URL:             "https://cdn.example.com/example.png",
								BackgroundColor: "#112233",
							},
						},
					})
					if err != nil {
						return nil, err
					}
					return stringResponse(req, http.StatusOK, "application/json", string(payload)), nil
				}),
			},
			baseURL: "https://microlink.test/api",
		},
		itabClient: &itabClient{
			client: &http.Client{
				Timeout: time.Second,
				Transport: roundTripFunc(func(_ *http.Request) (*http.Response, error) {
					return nil, errors.New("should not call itab when microlink succeeds")
				}),
			},
		},
	}

	if err := app.importSeed(); err != nil {
		t.Fatalf("import seed: %v", err)
	}
	if microlinkCalls != 0 {
		t.Fatalf("expected seed import to skip remote completion, got %d calls", microlinkCalls)
	}

	record := app.seedRecords["example.com"]
	if record == nil {
		t.Fatal("expected imported seed record")
	}
	if record.Title != "" {
		t.Fatalf("expected import to keep incomplete title, got %q", record.Title)
	}
	if record.BackgroundColor != "" {
		t.Fatalf("expected import to keep incomplete background color, got %q", record.BackgroundColor)
	}

	record, _, err := app.lookupOrFetchRecord(context.Background(), "example.com")
	if err != nil {
		t.Fatalf("lookup or fetch seed: %v", err)
	}
	if microlinkCalls != 1 {
		t.Fatalf("expected one remote completion call, got %d", microlinkCalls)
	}
	if record.Title != "Example Title" {
		t.Fatalf("expected completed title, got %q", record.Title)
	}
	if record.BackgroundColor != "#112233" {
		t.Fatalf("expected completed background color, got %q", record.BackgroundColor)
	}
	if got := firstString(record.Icons); got != "https://cdn.example.com/example.png" {
		t.Fatalf("expected completed original icon url, got %q", got)
	}

	var saved seedFile
	data, err := os.ReadFile(seedPath)
	if err != nil {
		t.Fatalf("read saved seed: %v", err)
	}
	if err := json.Unmarshal(data, &saved); err != nil {
		t.Fatalf("decode saved seed: %v", err)
	}
	item := saved.Items[0]
	if item.Title != "Example Title" {
		t.Fatalf("expected saved title, got %q", item.Title)
	}
	if item.OriginalIconURL != "https://cdn.example.com/example.png" {
		t.Fatalf("expected saved original icon url, got %q", item.OriginalIconURL)
	}
	if item.BackgroundColor != "#112233" {
		t.Fatalf("expected saved background color, got %q", item.BackgroundColor)
	}
	if item.Update {
		t.Fatal("expected update flag to remain false after successful completion")
	}
}

func TestLookupOrFetchRecordMarksUpdateWhenCompletionStillIncomplete(t *testing.T) {
	tempDir := t.TempDir()
	seedIconsDir := filepath.Join(tempDir, "data", "icons")
	if err := os.MkdirAll(seedIconsDir, 0o755); err != nil {
		t.Fatalf("mkdir seed icons: %v", err)
	}
	if err := os.WriteFile(filepath.Join(seedIconsDir, "example.png"), []byte("png"), 0o644); err != nil {
		t.Fatalf("write seed icon: %v", err)
	}

	seedPath := filepath.Join(tempDir, "seed-data.json")
	seed := seedFile{
		Items: []seedItem{
			{
				Title:           "",
				URL:             "https://example.com/",
				IconURL:         "data/icons/example.png",
				OriginalIconURL: "",
				BackgroundColor: "",
				IconLocalHost:   "example.com",
			},
		},
	}
	if err := writeSeedFile(seedPath, &seed); err != nil {
		t.Fatalf("write seed file: %v", err)
	}

	microlinkCalls := 0
	application := &app{
		seedRecords:  make(map[string]*iconRecord),
		cacheRecords: make(map[string]*iconRecord),
		seedPath:     seedPath,
		seedIconDir:  seedIconsDir,
		cacheIconDir: filepath.Join(tempDir, "cache"),
		cachePath:    filepath.Join(tempDir, "cache.json"),
		microlinkClient: &microlinkClient{
			client: &http.Client{
				Timeout: time.Second,
				Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
					microlinkCalls++
					payload, err := json.Marshal(microlinkLookupResponse{
						Status: "success",
						Data: microlinkData{
							URL:   "https://example.com/",
							Title: "Example Title",
							Logo: &microlinkAsset{
								URL: "https://cdn.example.com/example.png",
							},
						},
					})
					if err != nil {
						return nil, err
					}
					return stringResponse(req, http.StatusOK, "application/json", string(payload)), nil
				}),
			},
			baseURL: "https://microlink.test/api",
		},
	}

	if err := application.importSeed(); err != nil {
		t.Fatalf("import seed: %v", err)
	}

	if _, _, err := application.lookupOrFetchRecord(context.Background(), "example.com"); err != nil {
		t.Fatalf("lookup or fetch seed: %v", err)
	}
	if microlinkCalls != 1 {
		t.Fatalf("expected one completion call on lookup, got %d", microlinkCalls)
	}

	var saved seedFile
	data, err := os.ReadFile(seedPath)
	if err != nil {
		t.Fatalf("read saved seed: %v", err)
	}
	if err := json.Unmarshal(data, &saved); err != nil {
		t.Fatalf("decode saved seed: %v", err)
	}
	if !saved.Items[0].Update {
		t.Fatal("expected update flag after incomplete completion")
	}
	if saved.Items[0].BackgroundColor != "" {
		t.Fatalf("expected background color to remain empty, got %q", saved.Items[0].BackgroundColor)
	}

	application = &app{
		seedRecords:  make(map[string]*iconRecord),
		cacheRecords: make(map[string]*iconRecord),
		seedPath:     seedPath,
		seedIconDir:  seedIconsDir,
		cacheIconDir: filepath.Join(tempDir, "cache"),
		cachePath:    filepath.Join(tempDir, "cache.json"),
		microlinkClient: &microlinkClient{
			client: &http.Client{
				Timeout: time.Second,
				Transport: roundTripFunc(func(_ *http.Request) (*http.Response, error) {
					return nil, errors.New("update 标记后不应再次补全")
				}),
			},
			baseURL: "https://microlink.test/api",
		},
	}

	if err := application.importSeed(); err != nil {
		t.Fatalf("re-import seed with update flag: %v", err)
	}
	if _, _, err := application.lookupOrFetchRecord(context.Background(), "example.com"); err != nil {
		t.Fatalf("lookup seed with update flag: %v", err)
	}
}

func TestFetchAndCachePrefersMicrolinkAsFirstFallback(t *testing.T) {
	logoURL := "https://cdn.example.com/logo.png"
	microlinkURL := "https://microlink.test/api"

	itabCalls := 0
	tempDir := t.TempDir()
	app := &app{
		seedRecords:  make(map[string]*iconRecord),
		cacheRecords: make(map[string]*iconRecord),
		cachePath:    filepath.Join(tempDir, "cache.json"),
		cacheIconDir: tempDir,
		iconPrefix:   "/icons/",
		cachePrefix:  "/cache/",
		client: &http.Client{
			Timeout: time.Second,
			Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				if req.URL.String() != logoURL {
					return nil, errors.New("unexpected icon request")
				}
				return bytesResponse(req, http.StatusOK, "image/png", []byte{0x89, 0x50, 0x4e, 0x47}), nil
			}),
		},
		itabClient: &itabClient{
			client: &http.Client{
				Timeout: time.Second,
				Transport: roundTripFunc(func(_ *http.Request) (*http.Response, error) {
					itabCalls++
					return nil, errors.New("itab should not be called")
				}),
			},
		},
		microlinkClient: &microlinkClient{
			client: &http.Client{
				Timeout: time.Second,
				Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
					if !strings.HasPrefix(req.URL.String(), microlinkURL) {
						return nil, errors.New("unexpected microlink request")
					}
					payload, err := json.Marshal(microlinkLookupResponse{
						Status: "success",
						Data: microlinkData{
							URL:   "https://example.com/",
							Title: "Microlink Title",
							Logo: &microlinkAsset{
								URL:             logoURL,
								BackgroundColor: "#112233",
							},
						},
					})
					if err != nil {
						return nil, err
					}
					return stringResponse(req, http.StatusOK, "application/json", string(payload)), nil
				}),
			},
			baseURL: microlinkURL,
		},
	}

	record, err := app.fetchAndCache(context.Background(), "example.com")
	if err != nil {
		t.Fatalf("fetch and cache: %v", err)
	}

	if itabCalls != 0 {
		t.Fatalf("expected microlink to be the first fallback, got %d itab calls", itabCalls)
	}
	if record.Source != "microlink" {
		t.Fatalf("expected microlink source, got %q", record.Source)
	}
	if record.Name != "Microlink Title" {
		t.Fatalf("expected microlink title, got %q", record.Name)
	}
	if record.BackgroundColor != "#112233" {
		t.Fatalf("expected microlink background color, got %q", record.BackgroundColor)
	}
	if got := firstString(record.Icons); got != logoURL {
		t.Fatalf("expected logo url as icon source, got %q", got)
	}
	if len(record.LocalIcons) != 1 {
		t.Fatalf("expected downloaded microlink icon, got %v", record.LocalIcons)
	}
}

func TestFetchAndCacheFallsBackToITabWhenMicrolinkHasNoLogoAndUsesRawInputWhenITabURLMissing(t *testing.T) {
	iconURL := "https://cdn.example.com/itab.png"
	microlinkURL := "https://microlink.test/api"

	itabCalls := 0
	tempDir := t.TempDir()
	app := &app{
		seedRecords:  make(map[string]*iconRecord),
		cacheRecords: make(map[string]*iconRecord),
		cachePath:    filepath.Join(tempDir, "cache.json"),
		cacheIconDir: tempDir,
		iconPrefix:   "/icons/",
		cachePrefix:  "/cache/",
		client: &http.Client{
			Timeout: time.Second,
			Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				if req.URL.String() != iconURL {
					return nil, errors.New("unexpected icon request")
				}
				return bytesResponse(req, http.StatusOK, "image/png", []byte{0x89, 0x50, 0x4e, 0x47}), nil
			}),
		},
		itabClient: &itabClient{
			client: &http.Client{
				Timeout: time.Second,
				Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
					itabCalls++
					payload, err := json.Marshal(itabInfoResponse{
						Code: 200,
						Msg:  "ok",
						Data: itabInfoData{
							Name:            "ITab Title",
							Icon:            []string{iconURL},
							BackgroundColor: "#abcdef",
						},
					})
					if err != nil {
						return nil, err
					}

					return stringResponse(req, http.StatusOK, "application/json", string(payload)), nil
				}),
			},
		},
		microlinkClient: &microlinkClient{
			client: &http.Client{
				Timeout: time.Second,
				Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
					if !strings.HasPrefix(req.URL.String(), microlinkURL) {
						return nil, errors.New("unexpected microlink request")
					}
					payload, err := json.Marshal(microlinkLookupResponse{
						Status: "success",
						Data: microlinkData{
							URL:   "https://example.com/",
							Title: "Microlink Title",
							Image: &microlinkAsset{
								BackgroundColor: "#112233",
							},
						},
					})
					if err != nil {
						return nil, err
					}
					return stringResponse(req, http.StatusOK, "application/json", string(payload)), nil
				}),
			},
			baseURL: microlinkURL,
		},
	}

	record, err := app.fetchAndCache(context.Background(), "example.com")
	if err != nil {
		t.Fatalf("fetch and cache: %v", err)
	}

	if itabCalls == 0 {
		t.Fatalf("expected fallback to itab when microlink has no logo")
	}
	if record.Source != "itab" {
		t.Fatalf("expected itab source, got %q", record.Source)
	}
	if record.Name != "ITab Title" {
		t.Fatalf("expected itab title, got %q", record.Name)
	}
	if record.Host != "example.com" {
		t.Fatalf("expected host derived from raw input, got %q", record.Host)
	}
	if record.URL != "https://example.com/" || record.FinalURL != "https://example.com/" {
		t.Fatalf("expected fallback url from raw input, got url=%q finalUrl=%q", record.URL, record.FinalURL)
	}
	if got := firstString(record.Icons); got != iconURL {
		t.Fatalf("expected itab icon url, got %q", got)
	}
}

func TestToResponseReturnsRichPayload(t *testing.T) {
	fetchedAt := time.Date(2026, 4, 22, 8, 11, 51, 0, time.UTC)
	record := &iconRecord{
		Host:            "example.com",
		Title:           "Example",
		Name:            "Example",
		URL:             "https://example.com/page",
		FinalURL:        "https://example.com/page",
		Description:     "Example description",
		BackgroundColor: "",
		Icons:           []string{"https://cdn.example.com/icon.png"},
		Src:             "https://cdn.example.com/icon.png",
		Source:          "microlink",
		FetchedAt:       fetchedAt,
	}

	app := &app{
		iconPrefix:  "/icons/",
		cachePrefix: "/cache/",
	}

	resp := app.toResponse(httptest.NewRequest(http.MethodGet, "/api/icon?host=example.com", nil), record)
	if resp == nil {
		t.Fatal("expected response data")
	}
	if resp.URL == nil || *resp.URL != "https://example.com/page" {
		t.Fatalf("unexpected url: %#v", resp.URL)
	}
	if resp.Title == nil || *resp.Title != "Example" {
		t.Fatalf("unexpected title: %#v", resp.Title)
	}
	if resp.Description == nil || *resp.Description != "Example description" {
		t.Fatalf("unexpected description: %#v", resp.Description)
	}
	if resp.BackgroundColor != nil {
		t.Fatalf("expected nil backgroundColor, got %v", *resp.BackgroundColor)
	}
	if resp.Icon == nil || *resp.Icon != "https://cdn.example.com/icon.png" {
		t.Fatalf("unexpected icon: %#v", resp.Icon)
	}
	if resp.FetchedAt == nil || *resp.FetchedAt != "2026-04-22T08:11:51Z" {
		t.Fatalf("unexpected fetchedAt: %#v", resp.FetchedAt)
	}
}

func TestHandleSiteMetadataReturnsUnifiedResultEnvelope(t *testing.T) {
	pageURL := "https://cached-icon.example/path"

	app := &app{
		seedRecords:  make(map[string]*iconRecord),
		cacheRecords: make(map[string]*iconRecord),
		cachePath:    filepath.Join(t.TempDir(), "cache.json"),
		cacheIconDir: t.TempDir(),
		iconPrefix:   "/icons/",
		cachePrefix:  "/cache/",
		client: &http.Client{
			Timeout: time.Second,
			Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				if req.URL.String() != pageURL {
					return nil, errors.New("unexpected page request")
				}
				return stringResponse(req, http.StatusOK, "text/html; charset=utf-8", `
					<html>
						<head>
							<title>Cached Icon Site</title>
							<meta name="description" content="Page description">
							<link rel="icon" href="/favicon.ico">
						</head>
					</html>
				`), nil
			}),
		},
		itabClient: &itabClient{
			client: &http.Client{
				Timeout: time.Second,
				Transport: roundTripFunc(func(_ *http.Request) (*http.Response, error) {
					return nil, errors.New("unexpected upstream lookup")
				}),
			},
		},
	}
	host := normalizeHost(pageURL)
	app.cacheRecords[host] = &iconRecord{
		Host:            host,
		Title:           "Cached Icon Site",
		URL:             pageURL,
		LocalIcons:      []string{"cached-icon.svg"},
		Source:          "itab",
		BackgroundColor: "#abcdef",
	}

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/site/metadata?url="+url.QueryEscape(pageURL), nil)
	app.handleSiteMetadata(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d", recorder.Code)
	}

	var body map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if body["code"] != float64(200) {
		t.Fatalf("unexpected code: %#v", body["code"])
	}
	if body["msg"] != "ok" {
		t.Fatalf("unexpected msg: %#v", body["msg"])
	}
	data, ok := body["data"].(map[string]any)
	if !ok {
		t.Fatalf("unexpected data payload: %#v", body["data"])
	}
	expectedKeys := map[string]bool{
		"url":             true,
		"title":           true,
		"icon":            true,
		"description":     true,
		"backgroundColor": true,
		"fetchedAt":       true,
	}
	if len(data) != len(expectedKeys) {
		t.Fatalf("unexpected key count: %#v", data)
	}
	for key := range data {
		if !expectedKeys[key] {
			t.Fatalf("unexpected key %q in payload: %#v", key, data)
		}
	}
	if data["url"] != pageURL {
		t.Fatalf("unexpected url: %#v", data["url"])
	}
	if data["icon"] != "http://example.com/cache/cached-icon.svg" {
		t.Fatalf("unexpected icon: %#v", data["icon"])
	}
	if data["backgroundColor"] != "#abcdef" {
		t.Fatalf("unexpected backgroundColor: %#v", data["backgroundColor"])
	}
}

func TestHandleLookupReturnsUnifiedResultEnvelope(t *testing.T) {
	app := &app{
		seedRecords: map[string]*iconRecord{
			"example.com": {
				Host:            "example.com",
				Title:           "Example",
				URL:             "https://example.com/page",
				FinalURL:        "https://example.com/page",
				Description:     "Example description",
				BackgroundColor: "#123456",
				Icons:           []string{"https://cdn.example.com/icon.png"},
				Source:          "microlink",
				FetchedAt:       time.Date(2026, 4, 22, 8, 11, 51, 0, time.UTC),
			},
		},
		cacheRecords: make(map[string]*iconRecord),
		iconPrefix:   "/icons/",
		cachePrefix:  "/cache/",
	}

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/icon?host=example.com", nil)
	app.handleLookup(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d", recorder.Code)
	}

	var body map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if body["code"] != float64(200) {
		t.Fatalf("unexpected code: %#v", body["code"])
	}
	if body["msg"] != "ok" {
		t.Fatalf("unexpected msg: %#v", body["msg"])
	}
	data, ok := body["data"].(map[string]any)
	if !ok {
		t.Fatalf("unexpected data payload: %#v", body["data"])
	}
	if _, exists := data["finalUrl"]; exists {
		t.Fatalf("unexpected finalUrl leak: %#v", data)
	}
	if _, exists := data["name"]; exists {
		t.Fatalf("unexpected name leak: %#v", data)
	}
	if data["icon"] != "https://cdn.example.com/icon.png" {
		t.Fatalf("unexpected icon: %#v", data["icon"])
	}
	if data["backgroundColor"] != "#123456" {
		t.Fatalf("unexpected backgroundColor: %#v", data["backgroundColor"])
	}
}

func TestLookupOrFetchRecordRefreshesStaleCache(t *testing.T) {
	logoURL := "https://cdn.example.com/logo.png"
	microlinkURL := "https://microlink.test/api"
	host := "example.com"

	app := &app{
		seedRecords: make(map[string]*iconRecord),
		cacheRecords: map[string]*iconRecord{
			host: {
				Host:            host,
				Title:           "Old Example",
				Name:            "Old Example",
				URL:             "https://example.com/",
				FinalURL:        "https://example.com/",
				Description:     "old",
				BackgroundColor: "#000000",
				Icons:           []string{"https://cdn.example.com/old.png"},
				Src:             "https://cdn.example.com/old.png",
				Source:          "microlink",
				FetchedAt:       time.Now().UTC().Add(-(cacheRefreshTTL + time.Hour)),
			},
		},
		cachePath:    filepath.Join(t.TempDir(), "cache.json"),
		cacheIconDir: t.TempDir(),
		iconPrefix:   "/icons/",
		cachePrefix:  "/cache/",
		client: &http.Client{
			Timeout: time.Second,
			Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				if req.URL.String() != logoURL {
					return nil, errors.New("unexpected icon request")
				}
				return bytesResponse(req, http.StatusOK, "image/png", []byte{0x89, 0x50, 0x4e, 0x47}), nil
			}),
		},
		itabClient: &itabClient{
			client: &http.Client{
				Timeout: time.Second,
				Transport: roundTripFunc(func(_ *http.Request) (*http.Response, error) {
					return nil, errors.New("itab should not be called")
				}),
			},
		},
		microlinkClient: &microlinkClient{
			client: &http.Client{
				Timeout: time.Second,
				Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
					if !strings.HasPrefix(req.URL.String(), microlinkURL) {
						return nil, errors.New("unexpected microlink request")
					}
					payload, err := json.Marshal(microlinkLookupResponse{
						Status: "success",
						Data: microlinkData{
							URL:         "https://example.com/",
							Title:       "New Example",
							Description: "new",
							Logo: &microlinkAsset{
								URL:             logoURL,
								BackgroundColor: "#123456",
							},
						},
					})
					if err != nil {
						return nil, err
					}
					return stringResponse(req, http.StatusOK, "application/json", string(payload)), nil
				}),
			},
			baseURL: microlinkURL,
		},
	}

	record, _, err := app.lookupOrFetchRecord(context.Background(), host)
	if err != nil {
		t.Fatalf("lookup or fetch: %v", err)
	}
	if record.Title != "New Example" {
		t.Fatalf("expected refreshed title, got %q", record.Title)
	}
	if record.Description != "new" {
		t.Fatalf("expected refreshed description, got %q", record.Description)
	}
	if record.BackgroundColor != "#123456" {
		t.Fatalf("expected refreshed backgroundColor, got %q", record.BackgroundColor)
	}
	if !recordTimestamp(record).After(time.Now().UTC().Add(-time.Minute)) {
		t.Fatalf("expected refreshed fetchedAt, got %s", recordTimestamp(record))
	}
}

func TestLookupOrFetchRecordPrefersSeedOverCacheAndSkipsRefresh(t *testing.T) {
	host := "example.com"
	seedFetchedAt := time.Date(2026, 4, 22, 8, 0, 0, 0, time.UTC)
	cacheFetchedAt := time.Now().UTC().Add(-(cacheRefreshTTL + time.Hour))

	app := &app{
		seedRecords: map[string]*iconRecord{
			host: {
				Host:            host,
				Title:           "Seed Example",
				Name:            "Seed Example",
				URL:             "https://example.com/",
				FinalURL:        "https://example.com/",
				Description:     "seed",
				BackgroundColor: "#abcdef",
				LocalIcons:      []string{"example.com.png"},
				Source:          "seed",
				FetchedAt:       seedFetchedAt,
			},
		},
		cacheRecords: map[string]*iconRecord{
			host: {
				Host:            host,
				Title:           "Cache Example",
				Name:            "Cache Example",
				URL:             "https://example.com/",
				FinalURL:        "https://example.com/",
				Description:     "cache",
				BackgroundColor: "#123456",
				LocalIcons:      []string{"example.com-cache.png"},
				Source:          "microlink",
				FetchedAt:       cacheFetchedAt,
			},
		},
		cachePath:    filepath.Join(t.TempDir(), "cache.json"),
		cacheIconDir: t.TempDir(),
		iconPrefix:   "/icons/",
		cachePrefix:  "/cache/",
		client: &http.Client{
			Timeout: time.Second,
			Transport: roundTripFunc(func(_ *http.Request) (*http.Response, error) {
				return nil, errors.New("seed 命中时不应该请求页面或图标")
			}),
		},
		itabClient: &itabClient{
			client: &http.Client{
				Timeout: time.Second,
				Transport: roundTripFunc(func(_ *http.Request) (*http.Response, error) {
					return nil, errors.New("seed 命中时不应该回源 itab")
				}),
			},
		},
		microlinkClient: &microlinkClient{
			client: &http.Client{
				Timeout: time.Second,
				Transport: roundTripFunc(func(_ *http.Request) (*http.Response, error) {
					return nil, errors.New("seed 命中时不应该回源 microlink")
				}),
			},
			baseURL: "https://microlink.test/api",
		},
	}

	record, _, err := app.lookupOrFetchRecord(context.Background(), host)
	if err != nil {
		t.Fatalf("lookup or fetch: %v", err)
	}
	if record.Source != "seed" {
		t.Fatalf("expected seed record, got %q", record.Source)
	}
	if record.Title != "Seed Example" {
		t.Fatalf("expected seed title, got %q", record.Title)
	}
	if record.BackgroundColor != "#abcdef" {
		t.Fatalf("expected seed backgroundColor, got %q", record.BackgroundColor)
	}

	response := app.toResponse(httptest.NewRequest(http.MethodGet, "/api/icon?host=example.com", nil), record)
	if response == nil || response.Icon == nil {
		t.Fatal("expected seed icon response")
	}
	if *response.Icon != "http://example.com/icons/example.com.png" {
		t.Fatalf("expected seed icon path, got %q", *response.Icon)
	}
}
