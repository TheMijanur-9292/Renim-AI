"""
Renim AI — Executive Analytics & Productivity Intelligence Router
"""

from typing import Optional
from fastapi import APIRouter, Header
from fastapi.responses import JSONResponse

from db import get_db_pool
from auth_utils import resolve_user_email, server_error

router = APIRouter(prefix="/api/analytics", tags=["Analytics & BI"])


@router.get("/overview")
async def get_analytics_overview(
    user_email: Optional[str] = None,
    authorization: Optional[str] = Header(default=None),
):
    email = resolve_user_email(authorization, user_email)
    pool = get_db_pool()
    if not pool:
        return {"kpis": {}, "task_breakdown": {}, "ai_usage": [], "recent_activity": []}
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT
                        COUNT(*) FILTER (WHERE status = 'done') AS tasks_done,
                        COUNT(*) FILTER (WHERE status = 'in_progress') AS tasks_in_progress,
                        COUNT(*) FILTER (WHERE status = 'todo') AS tasks_todo,
                        COUNT(*) FILTER (WHERE priority = 'high' AND status != 'done') AS urgent_open,
                        COUNT(*) AS tasks_total
                    FROM public.tasks
                    WHERE LOWER(user_email) = %s
                    """,
                    (email,),
                )
                task_stats = cur.fetchone() or {}

                cur.execute(
                    "SELECT COUNT(*) AS c FROM public.meetings WHERE LOWER(user_email) = %s",
                    (email,),
                )
                meetings_count = (cur.fetchone() or {}).get("c", 0)

                cur.execute(
                    "SELECT COUNT(*) AS c FROM public.notes WHERE LOWER(user_email) = %s",
                    (email,),
                )
                notes_count = (cur.fetchone() or {}).get("c", 0)

                cur.execute(
                    "SELECT COUNT(*) AS c, COALESCE(SUM(file_size), 0) AS bytes FROM public.user_documents WHERE LOWER(user_email) = %s",
                    (email,),
                )
                doc_row = cur.fetchone() or {}
                docs_count = doc_row.get("c", 0)
                docs_mb = round((doc_row.get("bytes", 0) or 0) / (1024 * 1024), 2)

                cur.execute(
                    """
                    SELECT feature, SUM(credits_used) AS credits, COUNT(*) AS calls
                    FROM public.usage_logs
                    WHERE user_email = %s
                    GROUP BY feature
                    ORDER BY credits DESC
                    LIMIT 8
                    """,
                    (email,),
                )
                ai_usage = cur.fetchall()
                total_ai_calls = sum(int(u.get("calls") or 0) for u in ai_usage)

                total_tasks = int(task_stats.get("tasks_total") or 0)
                done_tasks = int(task_stats.get("tasks_done") or 0)
                completion_rate = round((done_tasks / total_tasks) * 100, 1) if total_tasks > 0 else 0.0
                # Estimated hours saved: 0.5h per meeting summary + 0.25h per doc + 0.15h per AI call
                ai_hours_saved = round(meetings_count * 0.5 + docs_count * 0.25 + total_ai_calls * 0.15, 1)

                cur.execute(
                    """
                    SELECT action, resource_type, created_at
                    FROM public.audit_logs
                    WHERE user_email = %s
                    ORDER BY created_at DESC
                    LIMIT 8
                    """,
                    (email,),
                )
                recent_activity = cur.fetchall()

                return {
                    "kpis": {
                        "completion_rate": completion_rate,
                        "ai_hours_saved": ai_hours_saved,
                        "meetings_count": meetings_count,
                        "notes_count": notes_count,
                        "docs_count": docs_count,
                        "docs_storage_mb": docs_mb,
                        "total_ai_calls": total_ai_calls,
                    },
                    "task_breakdown": task_stats,
                    "ai_usage": ai_usage,
                    "recent_activity": recent_activity,
                }
    except Exception as e:
        return JSONResponse(status_code=500, content=server_error(e))
