"""Conservative Chrome admission check using the container's actual budget.

This is a preflight safeguard, not a guarantee about a site's peak memory.
Unknown/unlimited limits (including local Windows) are not rejected.
"""
from pathlib import Path

MIB = 1024 * 1024

def container_memory(root=Path('/sys/fs/cgroup')):
    for limit_file, usage_file in [('memory.max', 'memory.current'),
                                   ('memory/memory.limit_in_bytes', 'memory/memory.usage_in_bytes')]:
        try:
            limit = int((root / limit_file).read_text().strip())
            used = int((root / usage_file).read_text().strip())
            if 0 < limit < 1 << 60:
                return {'limit_mb': limit // MIB, 'used_mb': used // MIB,
                        'available_mb': max(0, limit-used) // MIB}
        except (OSError, ValueError):
            continue
    return None

def require_browser_memory():
    memory = container_memory()
    if memory and (memory['limit_mb'] < 1024 or memory['available_mb'] < 384):
        raise MemoryError(
            f"INSUFFICIENT_MEMORY: container has {memory['limit_mb']} MiB total, "
            f"{memory['available_mb']} MiB available. Chrome was not launched. "
            "Use a 2 GB Render instance for the combined API/browser workload, "
            "or run collection on a separate adequately sized host. "
            "Reducing Result Limit does not reduce homepage startup memory.")
    return memory
