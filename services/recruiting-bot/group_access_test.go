package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"testing"
)

func TestGroupEligibilityExplicitAccessOrKey(t *testing.T) {
	a := testApp(t)
	ctx := context.Background()
	for _, id := range []int64{1, 2, 3} {
		if err := a.db.register(ctx, id, "Tester", true); err != nil {
			t.Fatal(err)
		}
	}
	if err := a.db.grantGroupAccess(ctx, 1); err != nil {
		t.Fatal(err)
	}
	if _, err := a.db.Exec(`UPDATE users SET steam_id='76561198000000002' WHERE telegram_id=2`); err != nil {
		t.Fatal(err)
	}
	if _, err := a.db.importKeys(ctx, "KEY"); err != nil {
		t.Fatal(err)
	}
	if key, err := a.db.claim(ctx, 2); err != nil || key != "KEY" {
		t.Fatalf("claim: %q %v", key, err)
	}
	for id, want := range map[int64]bool{1: true, 2: true, 3: false, 99: false} {
		got, err := a.db.groupEligible(ctx, id)
		if err != nil {
			t.Fatal(err)
		}
		if got != want {
			t.Fatalf("user %d eligibility=%v want=%v", id, got, want)
		}
	}
}

func TestGroupCommandGrantsPublicJoinRequestAccess(t *testing.T) {
	a := testApp(t)
	ctx := context.Background()
	approved := false
	declined := false
	a.client.Transport = transportFunc(func(r *http.Request) (*http.Response, error) {
		switch {
		case strings.HasSuffix(r.URL.Path, "/getChat"):
			return telegramReply(200, `{"ok":true,"result":{"id":-100123,"type":"supergroup","username":"team_frontress_test","join_by_request":true}}`), nil
		case strings.HasSuffix(r.URL.Path, "/sendMessage"):
			var body struct {
				Text string `json:"text"`
			}
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				t.Fatal(err)
			}
			if !strings.Contains(body.Text, "https://t.me/team_frontress_test") {
				t.Fatalf("public group URL missing: %q", body.Text)
			}
			return telegramReply(200, `{"ok":true,"result":{}}`), nil
		case strings.HasSuffix(r.URL.Path, "/approveChatJoinRequest"):
			approved = true
			return telegramReply(200, `{"ok":true,"result":true}`), nil
		case strings.HasSuffix(r.URL.Path, "/declineChatJoinRequest"):
			declined = true
			return telegramReply(200, `{"ok":true,"result":true}`), nil
		default:
			t.Fatalf("unexpected Telegram method: %s", r.URL.Path)
			return nil, nil
		}
	})

	var command update
	if err := json.Unmarshal([]byte(`{"message":{"from":{"id":10,"first_name":"Tester"},"chat":{"id":10,"type":"private"},"text":"/group"}}`), &command); err != nil {
		t.Fatal(err)
	}
	if err := a.handleUpdate(ctx, command); err != nil {
		t.Fatal(err)
	}
	eligible, err := a.db.groupEligible(ctx, 10)
	if err != nil || !eligible {
		t.Fatalf("/group did not persist access: %v", err)
	}

	for _, raw := range []string{
		`{"chat_join_request":{"from":{"id":10,"first_name":"Tester"},"chat":{"id":-100123}}}`,
		`{"chat_join_request":{"from":{"id":11,"first_name":"Random"},"chat":{"id":-100123}}}`,
	} {
		var join update
		if err := json.Unmarshal([]byte(raw), &join); err != nil {
			t.Fatal(err)
		}
		if err := a.handleUpdate(ctx, join); err != nil {
			t.Fatal(err)
		}
	}
	if !approved || !declined {
		t.Fatalf("join decisions missing: approved=%v declined=%v", approved, declined)
	}
}

func TestPublicGroupMustRequireJoinRequests(t *testing.T) {
	a := testApp(t)
	a.client.Transport = transportFunc(func(r *http.Request) (*http.Response, error) {
		return telegramReply(200, `{"ok":true,"result":{"id":-100123,"type":"supergroup","username":"team_frontress_test"}}`), nil
	})
	if err := a.validateGroup(context.Background()); !errors.Is(err, errPublicGroupJoinRequestsDisabled) {
		t.Fatalf("public group without join requests accepted: %v", err)
	}
}
