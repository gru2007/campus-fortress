package tf2pickup

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestActiveGamesAndForceEnd(t *testing.T) {
	const matchID = "0123456789abcdef"
	createdAt := time.Date(2026, 9, 10, 8, 0, 0, 0, time.UTC)
	readyAt := createdAt.Add(time.Minute)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Authorization"); got != "secret test-secret" {
			t.Errorf("Authorization = %q", got)
		}
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/api/frontress/v1/games":
			fmt.Fprintf(w, `{"games":[{"externalMatchId":%q,"map":"koth_product_final","matchGroup":7,"maxPlayers":24,"state":"launching","createdAt":%q,"readyAt":%q,"startedAt":null,"players":[],"server":{"connect":"127.0.0.1:27015","password":"pw","stv":null}}]}`, matchID, createdAt.Format(time.RFC3339), readyAt.Format(time.RFC3339))
		case r.Method == http.MethodPut && r.URL.Path == "/api/frontress/v1/games/"+matchID+"/force-end":
			fmt.Fprintf(w, `{"externalMatchId":%q,"map":"koth_product_final","matchGroup":7,"maxPlayers":24,"state":"interrupted","createdAt":%q,"readyAt":null,"startedAt":null,"players":[],"server":null}`, matchID, createdAt.Format(time.RFC3339))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()
	client, err := New(server.URL, "test-secret")
	if err != nil {
		t.Fatal(err)
	}

	games, err := client.ActiveGames(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(games) != 1 || games[0].ExternalMatchID != matchID {
		t.Fatalf("games = %#v", games)
	}
	if !games[0].CreatedAt.Equal(createdAt) || !games[0].ReadyAt.Equal(readyAt) {
		t.Fatalf("timestamps = %v, %v", games[0].CreatedAt, games[0].ReadyAt)
	}
	ended, err := client.ForceEnd(context.Background(), matchID)
	if err != nil {
		t.Fatal(err)
	}
	if !ended.Over() {
		t.Fatalf("ForceEnd state = %q", ended.State)
	}
}
