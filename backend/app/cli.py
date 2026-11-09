from pathlib import Path

import click
from flask import Flask

from .services.score_migration import promote_unknown_scores
from .services.song_import import DEFAULT_SCAN_FILE, import_songs
from .services.supabase_service import get_supabase


def register_cli(app: Flask) -> None:
    @app.cli.command("import-songs")
    @click.option(
        "--file",
        "scan_file",
        type=click.Path(exists=True, dir_okay=False, path_type=Path),
        default=DEFAULT_SCAN_FILE,
        show_default=True,
        help="Output of src/scripts/scan_songs.ts.",
    )
    @click.option("--apply", is_flag=True, help="Write the changes (default: preview only).")
    def import_songs_command(scan_file: Path, apply: bool) -> None:
        """Insert new songs and update changed ones from a song scan."""
        with app.app_context():
            import_songs(get_supabase(), scan_file, apply=apply, log=click.echo)

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
