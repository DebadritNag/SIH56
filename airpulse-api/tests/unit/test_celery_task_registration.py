"""
Unit test: verify all expected Celery task names are registered on the
shared celery_app instance after all worker modules are imported.

These tests run without a broker or database — they only inspect the
in-process task registry that Celery builds at import time.
"""
import pytest


EXPECTED_TASK_NAMES = [
    "app.workers.collection_tasks.collect_staged_live_task",
    "app.workers.collection_tasks.process_collection_run_task",
    "app.workers.collection_tasks.schedule_collection_run",
    "app.workers.collection_tasks.sync_all_government_references",
    "app.workers.health_tasks.check_all_sources_health",
    "app.workers.index_tasks.calculate_daily_index_task",
]


@pytest.fixture(scope="module")
def registered_tasks():
    """
    Import the Celery app and trigger module loading the same way the
    worker process does (via ``import_default_modules``), then return
    the set of registered task names.
    """
    from app.workers.celery_app import celery_app  # noqa: PLC0415

    # This is what ``celery worker`` calls on startup: it iterates the
    # ``include`` list and imports each module, which runs every
    # @celery_app.task decorator and registers the task on the app.
    celery_app.loader.import_default_modules()

    # Also confirm the reference_tasks shim resolves without error.
    import app.workers.reference_tasks  # noqa: F401, PLC0415

    return set(celery_app.tasks.keys())


@pytest.mark.parametrize("task_name", EXPECTED_TASK_NAMES)
def test_task_is_registered(registered_tasks: set, task_name: str):
    """Each expected task name must appear in the Celery task registry."""
    assert task_name in registered_tasks, (
        f"Task '{task_name}' is NOT registered.\n"
        f"Registered tasks (app.*): "
        + ", ".join(sorted(t for t in registered_tasks if t.startswith("app.")))
    )


def test_no_unexpected_missing_app_tasks(registered_tasks: set):
    """All tasks whose names start with 'app.workers.' must be a known task."""
    worker_tasks = {t for t in registered_tasks if t.startswith("app.workers.")}
    unknown = worker_tasks - set(EXPECTED_TASK_NAMES)
    # Unknown tasks are not a hard failure (new tasks may be added),
    # but log them so CI output is informative.
    if unknown:
        import warnings
        warnings.warn(
            f"Worker tasks registered but not in EXPECTED_TASK_NAMES: {sorted(unknown)}",
            stacklevel=1,
        )


def test_beat_schedule_tasks_are_registered(registered_tasks: set):
    """Every task referenced in beat_schedule must be registered."""
    from app.workers.celery_app import celery_app  # noqa: PLC0415

    beat_tasks = {
        entry["task"]
        for entry in celery_app.conf.beat_schedule.values()
    }
    missing = beat_tasks - registered_tasks
    assert not missing, (
        f"Beat schedule references tasks that are NOT registered: {sorted(missing)}"
    )
