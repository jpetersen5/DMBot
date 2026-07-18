import importlib

import click
from flask import Flask

from .services.score_migration import promote_unknown_scores
from .services.supabase_service import get_supabase


def register_cli(app: Flask) -> None:
    @app.cli.command("run-migration")
    @click.argument("name")
    def run_migration(name: str) -> None:
        """Run a migration module by name"""
        module = importlib.import_module(f"app.migrations.{name}")
        entry = getattr(module, name, None) or getattr(module, "run", None)
        if entry is None:
            raise click.ClickException(
                f"Migration module app.migrations.{name} has no callable '{name}' or 'run'"
            )
        with app.app_context():
            entry()
        click.echo(f"Migration {name} complete")

    @app.cli.command("promote-unknown-scores")
    @click.option(
        "--dry-run/--no-dry-run",
        default=True,
        help="Report would-be promotions without writing (default: on).",
    )
    def promote_unknown_scores_command(dry_run: bool) -> None:
        """Promote unknown scores whose songs now exist in songs_new."""
        with app.app_context():
            promote_unknown_scores(get_supabase(), dry_run=dry_run, log=click.echo)
