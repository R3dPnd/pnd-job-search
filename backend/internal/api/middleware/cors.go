package middleware

import (
	"net/http"

	"github.com/rs/cors"
)

func CORS(origin string) func(http.Handler) http.Handler {
	c := cors.New(cors.Options{
		AllowedOrigins:   []string{origin},
		AllowedMethods:   []string{"GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
	})
	return c.Handler
}
