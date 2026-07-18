import importlib
import click
from flask import Flask

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