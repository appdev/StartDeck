package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	defaultSiteIconProviderBaseURL = "http://127.0.0.1:8080"
	defaultSiteIconTimeout         = 5 * time.Second
)

type upstreamSiteMetadataResponse struct {
	Code int                       `json:"code"`
	Data *upstreamSiteMetadataData `json:"data"`
	Msg  string                    `json:"msg"`
}

type upstreamSiteMetadataData struct {
	URL             string          `json:"url"`
	FinalURL        string          `json:"finalUrl"`
	Title           string          `json:"title"`
	Name            string          `json:"name"`
	Icon            json.RawMessage `json:"icon"`
	IconURL         string          `json:"iconUrl"`
	Description     string          `json:"description"`
	BackgroundColor string          `json:"backgroundColor"`
	FetchedAt       string          `json:"fetchedAt"`
}

type siteMetadataResponse struct {
	Code int               `json:"code"`
	Data *siteMetadataData `json:"data"`
	Msg  string            `json:"msg"`
}

type siteMetadataData struct {
	URL             *string `json:"url"`
	Title           *string `json:"title"`
	Icon            *string `json:"icon"`
	Description     *string `json:"description"`
	BackgroundColor *string `json:"backgroundColor"`
	FetchedAt       *string `json:"fetchedAt"`
}

type rawSiteMetadata struct {
	URL             string
	Title           string
	Icon            string
	Description     string
	BackgroundColor string
	FetchedAt       string
}

func siteIconProviderBaseURL() string {
	if value := strings.TrimSpace(os.Getenv("ICON_SERVER_BASE_URL")); value != "" {
		return strings.TrimRight(value, "/")
	}
	return defaultSiteIconProviderBaseURL
}

func siteIconProviderTimeout() time.Duration {
	value := strings.TrimSpace(os.Getenv("ICON_SERVER_TIMEOUT_MS"))
	if value == "" {
		return defaultSiteIconTimeout
	}
	ms, err := strconv.Atoi(value)
	if err == nil && ms > 0 {
		return time.Duration(ms) * time.Millisecond
	}
	return defaultSiteIconTimeout
}

func normalizeSiteURL(input string) string {
	raw := strings.TrimSpace(input)
	if raw == "" {
		return ""
	}
	parsed, err := url.Parse(raw)
	if err == nil && parsed.Scheme != "" {
		if parsed.Scheme == "http" || parsed.Scheme == "https" {
			return parsed.String()
		}
		return ""
	}

	host := raw
	if slash := strings.Index(host, "/"); slash >= 0 {
		host = host[:slash]
	}
	host = strings.ToLower(strings.TrimSpace(host))
	scheme := "https://"
	if host == "localhost" || host == "::1" || strings.HasSuffix(host, ".local") || isPrivateIPv4Host(host) {
		scheme = "http://"
	}
	parsed, err = url.Parse(scheme + raw)
	if err != nil || parsed.Host == "" {
		return ""
	}
	return parsed.String()
}

func isPrivateIPv4Host(host string) bool {
	parts := strings.Split(host, ".")
	if len(parts) != 4 {
		return false
	}
	nums := make([]int, 4)
	for i, part := range parts {
		n, err := strconv.Atoi(part)
		if err != nil || n < 0 || n > 255 {
			return false
		}
		nums[i] = n
	}
	if nums[0] == 10 || nums[0] == 127 {
		return true
	}
	if nums[0] == 192 && nums[1] == 168 {
		return true
	}
	if nums[0] == 172 && nums[1] >= 16 && nums[1] <= 31 {
		return true
	}
	if nums[0] == 169 && nums[1] == 254 {
		return true
	}
	return false
}

func nullableSiteString(value string) *string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func firstMetadataString(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func firstIconFromRaw(raw json.RawMessage) string {
	if len(raw) == 0 || string(raw) == "null" {
		return ""
	}

	var single string
	if err := json.Unmarshal(raw, &single); err == nil {
		return strings.TrimSpace(single)
	}

	var list []string
	if err := json.Unmarshal(raw, &list); err == nil {
		for _, item := range list {
			if trimmed := strings.TrimSpace(item); trimmed != "" {
				return trimmed
			}
		}
	}
	return ""
}

func absoluteProviderURL(raw string, baseURL string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" || strings.HasPrefix(trimmed, "data:") {
		return trimmed
	}
	parsed, err := url.Parse(trimmed)
	if err != nil {
		return ""
	}
	if parsed.IsAbs() {
		return parsed.String()
	}
	base, err := url.Parse(strings.TrimRight(baseURL, "/") + "/")
	if err != nil {
		return trimmed
	}
	return base.ResolveReference(parsed).String()
}

func publicSiteIconURL(c *gin.Context, targetURL string) string {
	values := url.Values{}
	values.Set("url", targetURL)
	return "/api/site/icon?" + values.Encode()
}

func fetchRawSiteMetadata(targetURL string) (*rawSiteMetadata, int, string, error) {
	baseURL := siteIconProviderBaseURL()
	endpoint, err := url.Parse(strings.TrimRight(baseURL, "/") + "/api/site/metadata")
	if err != nil {
		return nil, http.StatusInternalServerError, "Invalid icon provider base URL", err
	}
	query := endpoint.Query()
	query.Set("url", targetURL)
	endpoint.RawQuery = query.Encode()

	client := &http.Client{Timeout: siteIconProviderTimeout()}
	req, err := http.NewRequest(http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return nil, http.StatusInternalServerError, "Failed to create icon provider request", err
	}
	req.Header.Set("Accept", "application/json, text/plain, */*")

	resp, err := client.Do(req)
	if err != nil {
		return nil, http.StatusBadGateway, "Failed to fetch site metadata", err
	}
	defer resp.Body.Close()

	var upstream upstreamSiteMetadataResponse
	if err := json.NewDecoder(resp.Body).Decode(&upstream); err != nil {
		return nil, http.StatusBadGateway, "Icon provider returned malformed data", err
	}

	code := upstream.Code
	if code == 0 {
		code = resp.StatusCode
	}
	if code != http.StatusOK || upstream.Data == nil {
		msg := strings.TrimSpace(upstream.Msg)
		if msg == "" {
			msg = fmt.Sprintf("Icon provider returned status %d", code)
		}
		return nil, code, msg, nil
	}

	rawIcon := firstMetadataString(firstIconFromRaw(upstream.Data.Icon), upstream.Data.IconURL)
	return &rawSiteMetadata{
		URL:             firstMetadataString(upstream.Data.URL, upstream.Data.FinalURL, targetURL),
		Title:           firstMetadataString(upstream.Data.Title, upstream.Data.Name),
		Icon:            absoluteProviderURL(rawIcon, baseURL),
		Description:     strings.TrimSpace(upstream.Data.Description),
		BackgroundColor: strings.TrimSpace(upstream.Data.BackgroundColor),
		FetchedAt:       firstMetadataString(upstream.Data.FetchedAt, time.Now().UTC().Format(time.RFC3339)),
	}, http.StatusOK, "ok", nil
}

func getSiteMetadataPayload(c *gin.Context, targetURL string) (siteMetadataResponse, int) {
	raw, status, msg, err := fetchRawSiteMetadata(targetURL)
	if err != nil {
		return siteMetadataResponse{Code: status, Data: nil, Msg: msg}, status
	}
	if raw == nil {
		if status < 100 || status > 599 {
			status = http.StatusBadGateway
		}
		return siteMetadataResponse{Code: status, Data: nil, Msg: msg}, status
	}

	icon := ""
	if raw.Icon != "" {
		icon = publicSiteIconURL(c, targetURL)
	}

	return siteMetadataResponse{
		Code: http.StatusOK,
		Data: &siteMetadataData{
			URL:             nullableSiteString(raw.URL),
			Title:           nullableSiteString(raw.Title),
			Icon:            nullableSiteString(icon),
			Description:     nullableSiteString(raw.Description),
			BackgroundColor: nullableSiteString(raw.BackgroundColor),
			FetchedAt:       nullableSiteString(raw.FetchedAt),
		},
		Msg: "ok",
	}, http.StatusOK
}

func GetSiteMetadata(c *gin.Context) {
	targetURL := normalizeSiteURL(c.Query("url"))
	if targetURL == "" {
		c.JSON(http.StatusBadRequest, siteMetadataResponse{
			Code: http.StatusBadRequest,
			Msg:  "Invalid url query parameter",
		})
		return
	}

	payload, status := getSiteMetadataPayload(c, targetURL)
	c.JSON(status, payload)
}

func GetSiteIcon(c *gin.Context) {
	targetURL := normalizeSiteURL(c.Query("url"))
	if targetURL == "" {
		c.String(http.StatusBadRequest, "invalid url query parameter")
		return
	}

	raw, status, msg, err := fetchRawSiteMetadata(targetURL)
	if err != nil {
		c.String(status, msg)
		return
	}
	if raw == nil || raw.Icon == "" {
		c.Header("Cache-Control", "public, max-age=86400")
		c.String(http.StatusNotFound, "icon not found")
		return
	}

	req, err := http.NewRequest(http.MethodGet, raw.Icon, nil)
	if err != nil {
		c.String(http.StatusBadGateway, "failed to create icon request")
		return
	}
	req.Header.Set("User-Agent", "StartDeck/1.0")

	client := &http.Client{Timeout: siteIconProviderTimeout()}
	resp, err := client.Do(req)
	if err != nil {
		c.String(http.StatusBadGateway, "failed to fetch site icon")
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		c.String(http.StatusBadGateway, "failed to fetch site icon")
		return
	}

	contentType := strings.TrimSpace(resp.Header.Get("Content-Type"))
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	c.Header("Content-Type", contentType)
	c.Header("Cache-Control", "public, max-age=86400")
	if etag := resp.Header.Get("ETag"); etag != "" {
		c.Header("ETag", etag)
	}

	c.Status(http.StatusOK)
	_, _ = io.Copy(c.Writer, io.LimitReader(resp.Body, maxIconCacheSize+1))
}
