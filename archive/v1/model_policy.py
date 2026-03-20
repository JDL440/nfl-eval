#!/usr/bin/env python3
"""Executable model selection policy for the article pipeline."""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


DEFAULT_POLICY_PATH = (
    Path(__file__).resolve().parent.parent / ".squad" / "config" / "models.json"
)

PANEL_MODEL_KEYS = {
    1: "panel_casual",
    2: "panel_beat",
    3: "panel_deep_dive",
}

STAGE_MODEL_KEY_ALIASES = {
    "lead_discussion_prompt": "lead",
    "lead_synthesis": "lead",
    "publisher_metadata": "lightweight",
}

STAGE_BUDGET_KEY_ALIASES = {
    "panel": "panel_agent",
}


@dataclass(frozen=True)
class ResolvedModel:
    selected_model: str
    candidates: list[str]
    tier: str | None
    precedence_rank: int | None
    task_family: str | None
    stage_key: str | None
    stage_model_key: str | None
    output_budget_tokens: int | None
    override_applied: bool

    def to_dict(self) -> dict[str, Any]:
        return {
            "selected_model": self.selected_model,
            "candidates": self.candidates,
            "tier": self.tier,
            "precedence_rank": self.precedence_rank,
            "task_family": self.task_family,
            "stage_key": self.stage_key,
            "stage_model_key": self.stage_model_key,
            "output_budget_tokens": self.output_budget_tokens,
            "override_applied": self.override_applied,
        }


class ModelPolicy:
    def __init__(self, policy_path: Path | None = None) -> None:
        self.policy_path = policy_path or DEFAULT_POLICY_PATH
        self.config = self._load()

    def _load(self) -> dict[str, Any]:
        with self.policy_path.open("r", encoding="utf-8") as handle:
            return json.load(handle)

    @property
    def supported_models(self) -> dict[str, list[str]]:
        return self.config["supported_models"]

    @property
    def task_families(self) -> dict[str, dict[str, Any]]:
        return self.config["task_families"]

    @property
    def models(self) -> dict[str, str]:
        return self.config["models"]

    @property
    def max_output_tokens(self) -> dict[str, int]:
        return self.config["max_output_tokens"]

    @property
    def stage_task_families(self) -> dict[str, str]:
        return self.config.get("stage_task_families", {})

    @property
    def override_policy(self) -> dict[str, Any]:
        return self.config.get("override_policy", {})

    def all_supported_models(self) -> list[str]:
        ordered: list[str] = []
        for key in ("low", "medium", "high", "agentic_code"):
            for model in self.supported_models.get(key, []):
                if model not in ordered:
                    ordered.append(model)
        return ordered

    def tier_for_model(self, model: str) -> tuple[str | None, int | None]:
        for tier_name, models in self.supported_models.items():
            if model in models:
                return tier_name, models.index(model) + 1
        return None, None

    def _resolve_stage_model_key(
        self, stage_key: str | None, depth_level: int | None
    ) -> str | None:
        if not stage_key:
            return None
        if stage_key == "panel":
            if depth_level is None:
                raise ValueError("depth_level is required when stage_key='panel'")
            try:
                return PANEL_MODEL_KEYS[depth_level]
            except KeyError as exc:
                raise ValueError(
                    f"Unsupported panel depth level: {depth_level}. Use 1, 2, or 3."
                ) from exc
        return STAGE_MODEL_KEY_ALIASES.get(stage_key, stage_key)

    def _resolve_task_family(self, stage_key: str | None, task_family: str | None) -> str | None:
        if task_family:
            return task_family
        if stage_key:
            return self.stage_task_families.get(stage_key)
        return None

    def _budget_key_for_stage(self, stage_key: str | None) -> str | None:
        if not stage_key:
            return None
        if stage_key in self.max_output_tokens:
            return stage_key
        return STAGE_BUDGET_KEY_ALIASES.get(stage_key)

    def _family_precedence(self, task_family: str | None) -> list[str]:
        if not task_family:
            return []
        family = self.task_families.get(task_family)
        if not family:
            raise ValueError(f"Unknown task family: {task_family}")
        return list(family.get("precedence", []))

    def _build_candidates(
        self,
        stage_key: str | None,
        stage_model_key: str | None,
        task_family: str | None,
    ) -> list[str]:
        candidates: list[str] = []
        prefer_stage_default = self.override_policy.get(
            "prefer_stage_default_before_tier_precedence", True
        )

        if stage_model_key and stage_model_key in self.models and prefer_stage_default:
            candidates.append(self.models[stage_model_key])

        for model in self._family_precedence(task_family):
            if model not in candidates:
                candidates.append(model)

        if stage_model_key and stage_model_key in self.models and not prefer_stage_default:
            model = self.models[stage_model_key]
            if model not in candidates:
                candidates.insert(0, model)

        if not candidates and stage_model_key and stage_model_key in self.models:
            candidates.append(self.models[stage_model_key])

        if task_family == "agentic_code":
            for model in self.supported_models.get("medium", []):
                if model not in candidates:
                    candidates.append(model)

        return candidates

    def resolve(
        self,
        *,
        stage_key: str | None = None,
        depth_level: int | None = None,
        task_family: str | None = None,
        override_model: str | None = None,
    ) -> ResolvedModel:
        stage_model_key = self._resolve_stage_model_key(stage_key, depth_level)
        resolved_task_family = self._resolve_task_family(stage_key, task_family)
        candidates = self._build_candidates(stage_key, stage_model_key, resolved_task_family)

        override_applied = False
        selected_model = candidates[0] if candidates else None

        if override_model:
            if not self.override_policy.get("allow_model_override", False):
                raise ValueError("Model overrides are disabled by policy.")
            if override_model not in self.all_supported_models():
                raise ValueError(f"Unsupported override model: {override_model}")
            selected_model = override_model
            override_applied = True
            if override_model not in candidates:
                candidates = [override_model, *candidates]

        if not selected_model:
            raise ValueError("Unable to resolve a model from the current policy.")

        tier, precedence_rank = self.tier_for_model(selected_model)
        budget_key = self._budget_key_for_stage(stage_key)
        output_budget_tokens = self.max_output_tokens.get(budget_key) if budget_key else None

        return ResolvedModel(
            selected_model=selected_model,
            candidates=candidates,
            tier=tier,
            precedence_rank=precedence_rank,
            task_family=resolved_task_family,
            stage_key=stage_key,
            stage_model_key=stage_model_key,
            output_budget_tokens=output_budget_tokens,
            override_applied=override_applied,
        )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Resolve article-pipeline model policy.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    list_parser = subparsers.add_parser("list", help="List supported models.")
    list_parser.add_argument("--tier", choices=["low", "medium", "high", "agentic_code"])

    select_parser = subparsers.add_parser("select", help="Resolve a model selection.")
    select_parser.add_argument("--stage-key")
    select_parser.add_argument("--depth-level", type=int)
    select_parser.add_argument(
        "--task-family",
        choices=["lightweight", "balanced", "deep_reasoning", "agentic_code"],
    )
    select_parser.add_argument("--override-model")

    stage_run_parser = subparsers.add_parser(
        "start-stage-run",
        help="Resolve model policy and create a stage_runs record.",
    )
    stage_run_parser.add_argument("--article-id", required=True)
    stage_run_parser.add_argument("--stage", required=True, type=int)
    stage_run_parser.add_argument("--surface", required=True)
    stage_run_parser.add_argument("--actor", required=True)
    stage_run_parser.add_argument("--stage-key")
    stage_run_parser.add_argument("--depth-level", type=int)
    stage_run_parser.add_argument(
        "--task-family",
        choices=["lightweight", "balanced", "deep_reasoning", "agentic_code"],
    )
    stage_run_parser.add_argument("--override-model")
    stage_run_parser.add_argument("--run-id")
    stage_run_parser.add_argument("--notes")
    stage_run_parser.add_argument("--stage-run-id")
    stage_run_parser.add_argument("--status", default="started")

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    policy = ModelPolicy()

    if args.command == "list":
        if args.tier:
            print(json.dumps({args.tier: policy.supported_models[args.tier]}, indent=2))
            return
        print(json.dumps(policy.supported_models, indent=2))
        return

    if args.command == "select":
        resolved = policy.resolve(
            stage_key=args.stage_key,
            depth_level=args.depth_level,
            task_family=args.task_family,
            override_model=args.override_model,
        )
        print(json.dumps(resolved.to_dict(), indent=2))
        return

    if args.command == "start-stage-run":
        resolved = policy.resolve(
            stage_key=args.stage_key,
            depth_level=args.depth_level,
            task_family=args.task_family,
            override_model=args.override_model,
        )
        from pipeline_state import PipelineState

        with PipelineState() as ps:
            stage_run_id = ps.start_stage_run(
                article_id=args.article_id,
                stage=args.stage,
                surface=args.surface,
                actor=args.actor,
                run_id=args.run_id,
                requested_model=resolved.selected_model,
                requested_model_tier=resolved.tier,
                precedence_rank=resolved.precedence_rank,
                output_budget_tokens=resolved.output_budget_tokens,
                notes=args.notes,
                stage_run_id=args.stage_run_id,
                status=args.status,
            )
        payload = resolved.to_dict()
        payload["stage_run_id"] = stage_run_id
        print(json.dumps(payload, indent=2))
        return

    raise ValueError(f"Unsupported command: {args.command}")


if __name__ == "__main__":
    main()
