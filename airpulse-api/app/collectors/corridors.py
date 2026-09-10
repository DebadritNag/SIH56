"""Bounded live-search corridors, shared by API validation and source navigation."""
LIVE_CORRIDORS = (
    {'id': 'DEL-BOM', 'origin': 'DEL', 'destination': 'BOM', 'label': 'Delhi (DEL) → Mumbai (BOM)'},
    {'id': 'DEL-CCU', 'origin': 'DEL', 'destination': 'CCU', 'label': 'Delhi (DEL) → Kolkata (CCU)'},
    {'id': 'BOM-BLR', 'origin': 'BOM', 'destination': 'BLR', 'label': 'Mumbai (BOM) → Bengaluru (BLR)'},
)


def validate_corridor(origin, destination):
    if not any(c['origin'] == origin and c['destination'] == destination for c in LIVE_CORRIDORS):
        raise ValueError('Unsupported live corridor. Choose DEL-BOM, DEL-CCU or BOM-BLR.')
