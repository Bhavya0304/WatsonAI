"""IP → city/region/country via ip-api.com (free tier, no key). Looked up once per IP and cached."""

import ipaddress
import logging

import httpx

from .. import db
from ..config import get_settings

log = logging.getLogger("watson.geo")


def is_public(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False
    return not (addr.is_private or addr.is_loopback or addr.is_reserved or addr.is_link_local)


def lookup(ip: str) -> dict:
    if not get_settings().geo_enabled or not is_public(ip):
        return {"city": None, "region": None, "country": "Local" if not is_public(ip) else None}
    if cached := db.geo_get(ip):
        return cached
    try:
        r = httpx.get(f"http://ip-api.com/json/{ip}",
                      params={"fields": "status,country,regionName,city"}, timeout=5)
        data = r.json()
        if data.get("status") == "success":
            db.geo_set(ip, data.get("city"), data.get("regionName"), data.get("country"))
            return {"city": data.get("city"), "region": data.get("regionName"), "country": data.get("country")}
    except Exception as ex:
        log.warning("geo lookup failed for %s: %s", ip, ex)
    return {"city": None, "region": None, "country": None}


def enrich_session(session_id: str, ip: str) -> None:
    """Run as a background task after session start."""
    g = lookup(ip)
    db.update_session(session_id, city=g.get("city"), region=g.get("region"), country=g.get("country"))
