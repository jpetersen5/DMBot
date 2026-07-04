import importlib
import click

def register_cli(app):
    @app.cli.command("run-migration")
    @click.argument("name")
    def run_migration(name):
        """Run a migration module by name, e.g. flask run-migration update_leaderboard_rankings"""
        module = importlib.import_module(f"app.migrations.{name}")
        entry = getattr(module, name, None) or getattr(module, "run", None)
        if entry is None:
            raise click.ClickException(
                f"Migration module app.migrations.{name} has no callable '{name}' or 'run'"
            )
        with app.app_context():
            entry()
        click.echo(f"Migration {name} complete")