package mm

import (
	"context"
	"fmt"

	"github.com/gru2007/team-frontress/services/coordinator/internal/pool"
	"github.com/gru2007/team-frontress/services/coordinator/internal/wire"
)

// RecoverActive rebuilds ephemeral gateway state around a durable game after a
// restart. tf2pickup remains the source of truth for the match and server.
func (m *Matchmaker) RecoverActive(ctx context.Context, group wire.MatchGroup, leader wire.SteamID, party []wire.AssignedPlayer) (*Ticket, bool, error) {
	if m.backend == nil {
		return nil, false, nil
	}
	game, found, err := m.backend.ActiveGame(ctx, leader)
	if err != nil || !found {
		return nil, found, err
	}
	if game.MatchGroup != group {
		return nil, true, fmt.Errorf("%w: player is already active in match group %d", ErrActiveGameConflict, game.MatchGroup)
	}
	rosterTeams := make(map[wire.SteamID]wire.Team, len(game.Players))
	for _, player := range game.Players {
		rosterTeams[player.SteamID] = player.Team
	}
	for i := range party {
		team, ok := rosterTeams[party[i].SteamID]
		if !ok {
			return nil, true, fmt.Errorf("%w: party member %s is not in the active game's roster", ErrActiveGameConflict, party[i].SteamID)
		}
		party[i].Team = team
	}

	m.mu.Lock()
	mt := m.matches[game.ExternalMatchID]
	startBoot := false
	if mt == nil {
		now := m.now()
		startedAt := game.StartedAt
		if startedAt.IsZero() {
			startedAt = now
		}
		mt = &Match{
			ID: game.ExternalMatchID, MatchGroup: game.MatchGroup, Map: game.Map,
			MaxPlayers: game.MaxPlayers, Password: game.Password,
			createdAt: now, startedAt: startedAt, lastNonEmpty: now,
		}
		for _, player := range game.Players {
			mt.Players = append(mt.Players, wire.AssignedPlayer{SteamID: player.SteamID, Team: player.Team})
		}
		if game.Ready() {
			mt.state = msLive
			mt.Server = &pool.Server{Provider: "tf2pickup", Connect: game.Connect, STV: game.STV, Ephemeral: true}
		} else {
			mt.state = msWaitingServer
			mt.waitDetail = "Match found. Waiting for tf2pickup to start a server."
			startBoot = true
		}
		m.matches[mt.ID] = mt
	}

	key := leaderKey{leader: leader, group: group}
	if old := m.tickets[m.byLeader[key]]; old != nil {
		m.mu.Unlock()
		return old, true, nil
	}
	now := m.now()
	ticket := &Ticket{
		ID: m.newID(), MatchGroup: group, Leader: leader, Players: party,
		state: tsMatched, queuedAt: now, lastPoll: now, matchID: mt.ID,
	}
	mt.tickets = append(mt.tickets, ticket.ID)
	if mt.state == msLive {
		ticket.state = tsAssigned
		ticket.assignment = m.assignmentLocked(mt, teamOf(mt, ticket), false)
	}
	m.tickets[ticket.ID] = ticket
	m.byLeader[key] = ticket.ID
	m.mu.Unlock()

	if startBoot {
		go m.bootBackend(context.Background(), mt)
	}
	return ticket, true, nil
}
