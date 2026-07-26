package exchangerate

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	domain "github.com/creation/pennywise/backend/internal/domain/expense"
	"github.com/shopspring/decimal"
)

type Provider struct {
	baseURL string
	client  *http.Client
}

func NewProvider(baseURL string) *Provider {
	return &Provider{
		baseURL: strings.TrimRight(baseURL, "/"),
		client:  &http.Client{Timeout: 5 * time.Second},
	}
}

func (p *Provider) Convert(ctx context.Context, amountMinor int64, from string, to string) (domain.ConversionResult, error) {
	from = strings.ToUpper(strings.TrimSpace(from))
	to = strings.ToUpper(strings.TrimSpace(to))
	if from == "" || to == "" {
		return domain.ConversionResult{}, fmt.Errorf("currency codes are required")
	}
	if from == to {
		return domain.ConversionResult{
			OriginalAmountMinor:   amountMinor,
			OriginalCurrencyCode:  from,
			ConvertedAmountMinor:  amountMinor,
			ConvertedCurrencyCode: to,
			ExchangeRate:          decimal.NewFromInt(1),
		}, nil
	}

	rate, err := p.rate(ctx, from, to)
	if err != nil {
		return domain.ConversionResult{}, err
	}
	converted := decimal.NewFromInt(amountMinor).Mul(rate).Round(0).IntPart()
	return domain.ConversionResult{
		OriginalAmountMinor:   amountMinor,
		OriginalCurrencyCode:  from,
		ConvertedAmountMinor:  converted,
		ConvertedCurrencyCode: to,
		ExchangeRate:          rate,
	}, nil
}

func (p *Provider) rate(ctx context.Context, from string, to string) (decimal.Decimal, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, p.baseURL+"/"+from, nil)
	if err != nil {
		return decimal.Zero, err
	}
	resp, err := p.client.Do(req)
	if err != nil {
		return decimal.Zero, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return decimal.Zero, fmt.Errorf("exchange-rate provider returned status %d", resp.StatusCode)
	}

	var payload struct {
		Result          string             `json:"result"`
		ConversionRates map[string]float64 `json:"conversion_rates"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return decimal.Zero, err
	}
	value, ok := payload.ConversionRates[to]
	if !ok {
		return decimal.Zero, fmt.Errorf("exchange rate %s to %s not found", from, to)
	}
	return decimal.NewFromFloat(value), nil
}
