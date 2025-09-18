import os
import requests
from bedrock_agentcore.mcp import MCPServer

server = MCPServer()

API_URL = os.environ.get('API_GATEWAY_URL')

if not API_URL:
    raise RuntimeError('API_GATEWAY_URL must be set for MCP server')


def post_card_action(endpoint: str, payload: dict):
    response = requests.post(f"{API_URL}/cards/{endpoint}", json=payload, timeout=10)
    response.raise_for_status()
    return response.json()


@server.tool("approve_card", description="Approve a card and move it to Done")
def approve_card(card_id: str):
    if not card_id:
        return {"success": False, "error": "card_id is required"}

    try:
        result = post_card_action('approve', {
            'operation': 'approve',
            'cardId': card_id,
        })
        return {
            "success": bool(result.get('success', True)),
            "message": result.get('message') or f"✅ Card {card_id} approved",
            "data": result,
        }
    except Exception as exc:
        return {"success": False, "error": str(exc)}


@server.tool("reject_card", description="Reject a card and move it to Backlog")
def reject_card(card_id: str, reason: str = "Needs revision"):
    if not card_id:
        return {"success": False, "error": "card_id is required"}

    try:
        result = post_card_action('reject', {
            'operation': 'reject',
            'cardId': card_id,
            'reason': reason,
        })
        return {
            "success": bool(result.get('success', True)),
            "message": result.get('message') or f"❌ Card {card_id} rejected: {reason}",
            "data": result,
        }
    except Exception as exc:
        return {"success": False, "error": str(exc)}


if __name__ == "__main__":
    server.run()
