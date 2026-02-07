package gossip

import (
	"context"
	"encoding/json"
	"math"
	"net"
	"strings"
	"time"

	"gradient-mvp/agent/pkg/fields"
)

const DefaultDecayRate = 1.0

type FieldGossip struct {
	Origin    string                       `json:"origin"`
	Hops      int                          `json:"hops"`
	Fields    map[string]fields.FieldValue `json:"fields"`
	Timestamp time.Time                    `json:"timestamp"`
}

type Config struct {
	NodeID    string
	Peers     []string
	BindAddr  string
	MaxHops   int
	DecayRate float64
}

type Protocol struct {
	cfg     Config
	emitter *fields.Emitter
	state   *fields.StateStore
	conn    net.PacketConn
}

func NewProtocol(cfg Config, emitter *fields.Emitter, state *fields.StateStore) (*Protocol, error) {
	if cfg.MaxHops == 0 {
		cfg.MaxHops = 3
	}
	if cfg.DecayRate == 0 {
		cfg.DecayRate = DefaultDecayRate
	}
	conn, err := net.ListenPacket("udp", cfg.BindAddr)
	if err != nil {
		return nil, err
	}
	return &Protocol{cfg: cfg, emitter: emitter, state: state, conn: conn}, nil
}

func DecayedIntensity(original float64, hops int, decayRate float64) float64 {
	return original * math.Exp(-decayRate*float64(hops))
}

func (p *Protocol) Close() error { return p.conn.Close() }

func (p *Protocol) PropagateFields(ctx context.Context) {
	t := time.NewTicker(100 * time.Millisecond)
	defer t.Stop()
	go p.listen(ctx)
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			local := p.emitter.EmitAll()
			p.state.SetLocal(local)
			msg := FieldGossip{Origin: p.cfg.NodeID, Hops: 0, Fields: local, Timestamp: time.Now()}
			p.broadcast(msg)
		}
	}
}

func (p *Protocol) listen(ctx context.Context) {
	buf := make([]byte, 64*1024)
	for {
		_ = p.conn.SetReadDeadline(time.Now().Add(200 * time.Millisecond))
		n, _, err := p.conn.ReadFrom(buf)
		if ne, ok := err.(net.Error); ok && ne.Timeout() {
			select {
			case <-ctx.Done():
				return
			default:
			}
			continue
		}
		if err != nil {
			continue
		}
		var g FieldGossip
		if json.Unmarshal(buf[:n], &g) == nil {
			p.HandleIncomingGossip(&g)
		}
	}
}

func (p *Protocol) HandleIncomingGossip(g *FieldGossip) {
	if g.Origin == p.cfg.NodeID || g.Hops >= p.cfg.MaxHops {
		return
	}
	for ft, v := range g.Fields {
		p.state.UpdateContribution(g.Origin, ft, DecayedIntensity(v.Intensity, g.Hops+1, p.cfg.DecayRate))
	}
	g.Hops++
	p.broadcast(*g)
}

func (p *Protocol) broadcast(msg FieldGossip) {
	b, _ := json.Marshal(msg)
	for _, peer := range p.cfg.Peers {
		peer = strings.TrimSpace(peer)
		if peer == "" {
			continue
		}
		_, _ = p.conn.WriteTo(b, mustResolve(peer))
	}
}

func mustResolve(addr string) net.Addr { a, _ := net.ResolveUDPAddr("udp", addr); return a }
