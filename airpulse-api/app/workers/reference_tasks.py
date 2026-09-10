"""
Reference-task shim.

``sync_all_government_references`` is physically defined in
``app.workers.collection_tasks`` (it shares the AsyncSessionLocal setup there),
but is logically a reference-data concern.  This module re-exports it under the
``app.workers.reference_tasks`` namespace so that:

  * Celery Beat schedule entries using the name
    ``app.workers.reference_tasks.sync_all_government_references`` resolve
    correctly when the worker is started with
    ``include=['app.workers.reference_tasks']``.
  * The canonical task name registered with Celery remains
    ``app.workers.collection_tasks.sync_all_government_references``
    (no beat_schedule or task-name change required).

Importing this module causes collection_tasks to be imported first, which
registers the task on the shared celery_app instance — no circular import
risk because celery_app is imported before either task module.
"""
from app.workers.collection_tasks import sync_all_government_references  # noqa: F401

__all__ = ["sync_all_government_references"]
