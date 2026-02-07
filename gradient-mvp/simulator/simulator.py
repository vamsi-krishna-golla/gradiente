import asyncio
import random
import time
from dataclasses import dataclass
from typing import Dict

import aiohttp
import yaml
from prometheus_client import Counter, Histogram, start_http_server


@dataclass
class NodeState:
    node_id: str
    base_latency_ms: float = 10.0
    error_rate: float = 0.0
    cpu_utilization: float = 0.3
    active_connections: int = 0
    max_connections: int = 100
    degradation_factor: float = 1.0

    def process_request(self) -> tuple[float, bool]:
        self.active_connections += 1
        load_factor = self.active_connections / self.max_connections
        latency = self.base_latency_ms * self.degradation_factor * (1 + load_factor * 2)
        effective_error_rate = min(self.error_rate * self.degradation_factor, 0.95)
        is_error = random.random() < effective_error_rate
        time.sleep(latency / 1000.0)
        self.active_connections -= 1
        return latency, is_error


class Simulator:
    def __init__(self, config_path: str):
        with open(config_path, "r", encoding="utf-8") as f:
            self.config = yaml.safe_load(f)
        self.nodes: Dict[str, NodeState] = {}
        self.gradient_agents: Dict[str, str] = {}
        self.rr_index = 0
        self.requests_total = Counter("sim_requests_total", "Total requests", ["router", "node", "status"])
        self.latency_histogram = Histogram("sim_latency_seconds", "Request latency", ["router", "node"])
        self.circuit_failures: Dict[str, int] = {}

    async def setup_cluster(self):
        for node_config in self.config["nodes"]:
            node = NodeState(
                node_id=node_config["id"],
                base_latency_ms=node_config.get("base_latency_ms", 10),
                max_connections=node_config.get("max_connections", 100),
            )
            self.nodes[node.node_id] = node
            self.gradient_agents[node.node_id] = node_config["gradient_agent_url"]

    async def run_scenario(self):
        print(f"Running scenario: {self.config['name']}")
        traffic = self.config["traffic"]
        traffic_task = asyncio.create_task(self.generate_traffic(traffic["requests_per_second"], traffic["duration_seconds"]))
        start = time.time()
        for event in self.config["events"]:
            await asyncio.sleep(max(0, event["at_second"] - (time.time() - start)))
            await self.execute_event(event)
        await traffic_task

    async def execute_event(self, event: dict):
        node = self.nodes[event["node"]]
        t = event["type"]
        if t == "degrade":
            node.degradation_factor = event["factor"]
        elif t == "recover":
            node.degradation_factor = 1.0
            node.error_rate = 0.0
        elif t == "fail":
            node.degradation_factor = 100.0
            node.error_rate = 0.99
        elif t == "increase_error_rate":
            node.error_rate = event["rate"]
        print("[EVENT]", event)

    async def generate_traffic(self, rps: int, duration_s: int):
        interval = 1.0 / rps
        end = time.time() + duration_s
        while time.time() < end:
            asyncio.create_task(self.send_request_gradient())
            asyncio.create_task(self.send_request_traditional())
            await asyncio.sleep(interval)

    async def send_request_gradient(self):
        candidates = list(self.nodes.keys())
        try:
            async with aiohttp.ClientSession() as session:
                agent_url = list(self.gradient_agents.values())[0]
                async with session.get(f"{agent_url}/route", params={"candidates": ",".join(candidates)}, timeout=1) as resp:
                    selected = (await resp.json())["selected_node"]
        except Exception:
            selected = random.choice(candidates)
        latency, is_error = self.nodes[selected].process_request()
        status = "error" if is_error else "success"
        self.requests_total.labels(router="gradient", node=selected, status=status).inc()
        self.latency_histogram.labels(router="gradient", node=selected).observe(latency / 1000)

    def is_circuit_open(self, node_id: str) -> bool:
        return self.circuit_failures.get(node_id, 0) >= 5

    def update_circuit_breaker(self, node_id: str, is_error: bool):
        cur = self.circuit_failures.get(node_id, 0)
        self.circuit_failures[node_id] = cur + 1 if is_error else max(0, cur - 1)

    async def send_request_traditional(self):
        candidates = [n for n in self.nodes.keys() if not self.is_circuit_open(n)]
        if not candidates:
            self.requests_total.labels(router="traditional", node="none", status="rejected").inc()
            return
        self.rr_index = (self.rr_index + 1) % len(candidates)
        selected = candidates[self.rr_index]
        latency, is_error = self.nodes[selected].process_request()
        self.update_circuit_breaker(selected, is_error)
        status = "error" if is_error else "success"
        self.requests_total.labels(router="traditional", node=selected, status=status).inc()
        self.latency_histogram.labels(router="traditional", node=selected).observe(latency / 1000)


if __name__ == "__main__":
    import sys

    cfg = sys.argv[1] if len(sys.argv) > 1 else "scenarios/gradual_degradation.yaml"
    start_http_server(9090)
    sim = Simulator(cfg)
    asyncio.run(sim.setup_cluster())
    asyncio.run(sim.run_scenario())
