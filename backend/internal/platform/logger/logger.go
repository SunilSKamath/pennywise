package logger

import "go.uber.org/zap"

func New(env string) (*zap.Logger, error) {
	if env == "development" {
		return zap.NewDevelopment()
	}
	return zap.NewProduction()
}
