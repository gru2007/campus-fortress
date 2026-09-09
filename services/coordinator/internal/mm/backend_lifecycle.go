package mm

import (
	"context"
	"fmt"
	"time"

	"github.com/gru2007/team-frontress/services/coordinator/internal/pool"
	"github.com/gru2007/team-frontress/services/coordinator/internal/wire"
)

func (m *Matchmaker) bootBackend(ctx context.Context, mt *Match) {
	group, _ := m.cfg.Group(mt.MatchGroup)
	request := BackendGameRequest{
		ExternalMatchID: mt.ID,
		Map:             mt.Map,
		MatchGroup:      mt.MatchGroup,
		MaxPlayers:      matchCapacity(mt, group),
		ServerConfig:    group.ServerConfig,
		MatchEmulation:  group.EffectiveMatchEmulation(),
		Players:         append([]wire.AssignedPlayer(nil), mt.Players...),
	}

	m.mu.Lock()
	mt.state = msWaitingServer
	mt.waitDetail = "Match found. Waiting for tf2pickup to start a server."
	m.mu.Unlock()

	deadline := time.NewTimer(m.cfg.Pool.BootDeadline())
	defer deadline.Stop()
	var game BackendGame
	var err error
	for {
		game, err = m.backend.CreateGame(ctx, request)
		if err == nil {
			break
		}
		m.log.Warn("could not persist match in tf2pickup", "match", mt.ID, "err", err)
		select {
		case <-ctx.Done():
			return
		case <-deadline.C:
			m.failMatch(mt, fmt.Errorf("tf2pickup did not accept the match: %w", err), true)
			return
		case <-time.After(2 * time.Second):
		}
	}

	for {
		if game.Ready() {
			break
		}
		if game.Over() {
			m.failMatch(mt, fmt.Errorf("tf2pickup ended the match before a server became ready"), false)
			return
		}
		if err != nil {
			m.log.Warn("tf2pickup game is not available yet", "match", mt.ID, "err", err)
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(2 * time.Second):
		}
		game, err = m.backend.Game(ctx, mt.ID)
	}

	now := m.now()
	m.mu.Lock()
	if mt.state == msOver {
		m.mu.Unlock()
		return
	}
	mt.Server = &pool.Server{Provider: "tf2pickup", Connect: game.Connect, STV: game.STV, Ephemeral: true}
	mt.Password = game.Password
	mt.state = msLive
	mt.waitDetail = ""
	mt.startedAt = now
	mt.lastNonEmpty = now
	for _, id := range mt.tickets {
		if ticket := m.tickets[id]; ticket != nil {
			ticket.state = tsAssigned
			ticket.assignment = m.assignmentLocked(mt, teamOf(mt, ticket), false)
		}
	}
	m.mu.Unlock()
	m.log.Info("match handed to tf2pickup", "match", mt.ID, "server", game.Connect)
}

func (m *Matchmaker) superviseBackendMatches(ctx context.Context) {
	now := m.now()
	m.mu.Lock()
	var matches []*Match
	for _, mt := range m.matches {
		if mt.state == msLive && now.Sub(mt.lastPolled) >= 5*time.Second {
			mt.lastPolled = now
			matches = append(matches, mt)
		}
	}
	m.mu.Unlock()

	for _, mt := range matches {
		game, err := m.backend.Game(ctx, mt.ID)
		if err != nil {
			m.log.Warn("could not read match from tf2pickup", "match", mt.ID, "err", err)
			continue
		}
		connected := 0
		present := make([]wire.AssignedPlayer, 0, len(game.Players))
		for _, player := range game.Players {
			if player.Connected {
				connected++
				present = append(present, wire.AssignedPlayer{SteamID: player.SteamID, Team: player.Team})
			}
		}
		m.mu.Lock()
		mt.players = connected
		if connected > 0 {
			mt.lastNonEmpty = now
			mt.everSeenPlayers = true
		}
		m.mu.Unlock()
		if !game.Over() {
			continue
		}
		winner := wire.TeamUnassigned
		if game.RedScore > game.BluScore {
			winner = wire.TeamRed
		} else if game.BluScore > game.RedScore {
			winner = wire.TeamBlu
		}
		m.endMatch(ctx, mt, &wire.MatchResult{
			MatchID:  mt.ID,
			Winner:   winner,
			RedScore: game.RedScore,
			BluScore: game.BluScore,
			Aborted:  game.State == "interrupted",
			Players:  present,
		}, "reported by tf2pickup")
	}
}
