"""DynamoDB repository for Settings (COMPANY_NETWORKS)."""

from app.core.config import settings
from app.shared.aws.dynamodb import get_item, put_item

TABLE = settings.settings_table
KEY_NETWORKS = "COMPANY_NETWORKS"

def get_networks() -> list[dict]:
    """Retrieve the list of saved company networks."""
    item = get_item(TABLE, key={"setting_key": KEY_NETWORKS})
    if not item:
        return []
    return item.get("networks", [])


def save_networks(networks: list[dict]) -> None:
    """Save the list of company networks."""
    item = {
        "setting_key": KEY_NETWORKS,
        "networks": networks
    }
    put_item(TABLE, item)
