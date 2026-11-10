import argparse

from backend.database import get_db
from backend.config import settings
from backend.services.media_storage import MediaStorage


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Delete all draft records and objects under the draft-media 'drafts/' prefix."
    )
    parser.add_argument(
        "--confirm",
        action="store_true",
        help="Required confirmation; this permanently deletes all current drafts.",
    )
    args = parser.parse_args()
    if not args.confirm:
        parser.error("Pass --confirm to permanently delete all drafts.")

    with get_db() as conn:
        cursor = conn.cursor()
        if settings.is_postgres:
            cursor.execute("LOCK TABLE drafts IN ACCESS EXCLUSIVE MODE")
        else:
            cursor.execute("BEGIN IMMEDIATE")
        cursor.execute("SELECT content_ref FROM drafts")
        references = [row["content_ref"] for row in cursor.fetchall()]
        objects = MediaStorage.list_draft_objects()
        if objects:
            MediaStorage.delete_object_keys(objects)
        cursor.execute("DELETE FROM drafts")
    for reference in references:
        if not MediaStorage.is_storage_ref(reference):
            MediaStorage.delete_reference(reference)
    print(f"Deleted all draft records and {len(objects)} draft media objects.")


if __name__ == "__main__":
    main()
