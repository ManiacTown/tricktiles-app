package main

import (
	"log"
	"net/http"
	"os"

	"tricktiles/solver/api"
	"tricktiles/solver/dictionary"
)

func main() {
	_, trie := dictionary.Load()
	server := api.NewServer(trie)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("solver listening on :%s", port)
	if err := http.ListenAndServe(":"+port, server.Routes()); err != nil {
		log.Fatal(err)
	}
}
