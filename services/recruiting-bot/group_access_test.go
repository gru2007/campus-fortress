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
		case strings.HasSuffix(r.URL.Path, "/createChatInviteLink"):
			var body map[string]any
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				t.Fatal(err)
			}
			if body["creates_join_request"] != true {
				t.Fatal("/group did not create a join-request link")
			}
			return telegramReply(200, `{"ok":true,"result":{"invite_link":"https://t.me/+group-request"}}`), nil
		case strings.HasSuffix(r.URL.Path, "/sendMessage"):
			var body struct {
				Text string `json:"text"`
			}
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				t.Fatal(err)
			}
			if !strings.Contains(body.Text, "https://t.me/+group-request") {
				t.Fatalf("join-request URL missing: %q", body.Text)
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

func TestGuardQueryOpensMiniAppAndCanApprove(t *testing.T) {
	a := testApp(t)
	ctx := context.Background()
	webApps := 0
	answers := 0
	a.client.Transport = transportFunc(func(r *http.Request) (*http.Response, error) {
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		switch {
		case strings.HasSuffix(r.URL.Path, "/sendChatJoinRequestWebApp"):
			webApps++
			if body["chat_join_request_query_id"] != "guard-query" || body["web_app_url"] != a.cfg.PublicURL+"/?join_request=1" {
				t.Fatalf("bad guard Mini App request: %#v", body)
			}
			return telegramReply(200, `{"ok":true,"result":true}`), nil
		case strings.HasSuffix(r.URL.Path, "/answerChatJoinRequestQuery"):
			answers++
			if body["chat_join_request_query_id"] != "guard-query" || body["result"] != "approve" {
				t.Fatalf("bad guard answer: %#v", body)
			}
			return telegramReply(200, `{"ok":true,"result":true}`), nil
		default:
			t.Fatalf("unexpected Telegram method: %s", r.URL.Path)
			return nil, nil
		}
	})

	var join update
	if err := json.Unmarshal([]byte(`{"chat_join_request":{"from":{"id":10,"first_name":"Tester"},"chat":{"id":-100123},"query_id":"guard-query"}}`), &join); err != nil {
		t.Fatal(err)
	}
	if err := a.handleUpdate(ctx, join); err != nil {
		t.Fatal(err)
	}
	if webApps != 1 || answers != 0 {
		t.Fatalf("unexpected initial guard calls: webapps=%d answers=%d", webApps, answers)
	}
	pending, err := a.db.joinRequestPending(ctx, 10)
	if err != nil || !pending {
		t.Fatalf("guard query not persisted: %v", err)
	}

	cookie := login(t, a, 10)
	w := request(a, "POST", "/api/join-request/approve", `{"grant_group_access":true}`, a.cfg.PublicURL, cookie)
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"approved":true`) {
		t.Fatalf("Mini App approval failed: %d %s", w.Code, w.Body.String())
	}
	if answers != 1 {
		t.Fatalf("join query not answered: %d", answers)
	}
	pending, err = a.db.joinRequestPending(ctx, 10)
	if err != nil || pending {
		t.Fatalf("resolved guard query remained pending: %v", err)
	}
	eligible, err := a.db.groupEligible(ctx, 10)
	if err != nil || !eligible {
		t.Fatalf("Mini App confirmation did not grant group access: %v", err)
	}
}

func TestGuardQueryApprovesExistingAccessWithoutMiniApp(t *testing.T) {
	a := testApp(t)
	ctx := context.Background()
	if err := a.db.register(ctx, 10, "Tester", true); err != nil {
		t.Fatal(err)
	}
	if err := a.db.grantGroupAccess(ctx, 10); err != nil {
		t.Fatal(err)
	}
	answers := 0
	a.client.Transport = transportFunc(func(r *http.Request) (*http.Response, error) {
		if !strings.HasSuffix(r.URL.Path, "/answerChatJoinRequestQuery") {
			t.Fatalf("eligible user opened Mini App: %s", r.URL.Path)
		}
		answers++
		return telegramReply(200, `{"ok":true,"result":true}`), nil
	})
	var join update
	if err := json.Unmarshal([]byte(`{"chat_join_request":{"from":{"id":10,"first_name":"Tester"},"chat":{"id":-100123},"query_id":"eligible-query"}}`), &join); err != nil {
		t.Fatal(err)
	}
	if err := a.handleUpdate(ctx, join); err != nil {
		t.Fatal(err)
	}
	if answers != 1 {
		t.Fatal("eligible guard query was not approved")
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

func TestGuardBotMustBeAssigned(t *testing.T) {
	a := testApp(t)
	calls := 0
	a.client.Transport = transportFunc(func(r *http.Request) (*http.Response, error) {
		calls++
		switch {
		case strings.HasSuffix(r.URL.Path, "/getChat"):
			return telegramReply(200, `{"ok":true,"result":{"id":-100123,"type":"supergroup","username":"team_frontress_test","join_by_request":true}}`), nil
		case strings.HasSuffix(r.URL.Path, "/getMe"):
			return telegramReply(200, `{"ok":true,"result":{"id":777,"is_bot":true,"first_name":"Bot","supports_join_request_queries":true}}`), nil
		default:
			t.Fatalf("unexpected method: %s", r.URL.Path)
			return nil, nil
		}
	})
	if err := a.validateGroup(context.Background()); !errors.Is(err, errGuardBotNotConfigured) {
		t.Fatalf("missing guard bot accepted: %v", err)
	}
	if calls != 2 {
		t.Fatalf("unexpected validation calls: %d", calls)
	}

	a.client.Transport = transportFunc(func(r *http.Request) (*http.Response, error) {
		switch {
		case strings.HasSuffix(r.URL.Path, "/getChat"):
			return telegramReply(200, `{"ok":true,"result":{"id":-100123,"type":"supergroup","username":"team_frontress_test","join_by_request":true,"guard_bot":{"id":777,"is_bot":true,"first_name":"Bot"}}}`), nil
		case strings.HasSuffix(r.URL.Path, "/getMe"):
			return telegramReply(200, `{"ok":true,"result":{"id":777,"is_bot":true,"first_name":"Bot","supports_join_request_queries":true}}`), nil
		default:
			t.Fatalf("unexpected method: %s", r.URL.Path)
			return nil, nil
		}
	})
	if err := a.validateGroup(context.Background()); err != nil {
		t.Fatalf("configured guard bot rejected: %v", err)
	}
}
