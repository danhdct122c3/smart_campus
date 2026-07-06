"""Amazon Athena client wrapper – run queries and fetch results."""

import time
import boto3
from functools import lru_cache
from botocore.exceptions import ClientError

from app.core.config import settings


@lru_cache
def get_athena_client():
    return boto3.client("athena", region_name=settings.aws_region)


class AthenaQueryError(Exception):
    """Raised when an Athena query fails or times out."""


def run_query(sql: str, database: str | None = None, output_location: str | None = None) -> str:
    """
    Start an Athena query and return the QueryExecutionId.

    Args:
        sql: The SQL query string.
        database: Athena database name (defaults to settings).
        output_location: S3 path for results (defaults to settings).

    Returns:
        QueryExecutionId (str)
    """
    client = get_athena_client()
    db = database or settings.athena_database
    output = output_location or settings.athena_output_location

    try:
        response = client.start_query_execution(
            QueryString=sql,
            QueryExecutionContext={"Database": db},
            ResultConfiguration={"OutputLocation": output},
        )
        return response["QueryExecutionId"]
    except ClientError as exc:
        raise AthenaQueryError(f"Failed to start Athena query: {exc}") from exc


def wait_for_query(execution_id: str, timeout_seconds: int = 30) -> str:
    """
    Poll until a query completes or times out.

    Returns:
        Final state: "SUCCEEDED" | "FAILED" | "CANCELLED"

    Raises:
        AthenaQueryError on timeout or query failure.
    """
    client = get_athena_client()
    deadline = time.time() + timeout_seconds
    poll_interval = 1.0

    while time.time() < deadline:
        try:
            response = client.get_query_execution(QueryExecutionId=execution_id)
            state = response["QueryExecution"]["Status"]["State"]
        except ClientError as exc:
            raise AthenaQueryError(f"Failed to get query status: {exc}") from exc

        if state == "SUCCEEDED":
            return state
        if state in ("FAILED", "CANCELLED"):
            reason = response["QueryExecution"]["Status"].get("StateChangeReason", "Unknown")
            raise AthenaQueryError(f"Athena query {state}: {reason}")

        time.sleep(poll_interval)
        poll_interval = min(poll_interval * 1.5, 5.0)  # exponential backoff, cap at 5s

    raise AthenaQueryError(f"Athena query timed out after {timeout_seconds}s.")


def get_query_results(execution_id: str, max_rows: int = 100) -> list[dict]:
    """
    Fetch results of a completed query as a list of row dicts.

    Returns:
        List of dicts where keys are column names.
    """
    client = get_athena_client()
    try:
        response = client.get_query_results(
            QueryExecutionId=execution_id,
            MaxResults=max_rows,
        )
    except ClientError as exc:
        raise AthenaQueryError(f"Failed to get query results: {exc}") from exc

    rows = response.get("ResultSet", {}).get("Rows", [])
    if not rows:
        return []

    # First row is headers
    headers = [col.get("VarCharValue", "") for col in rows[0].get("Data", [])]
    results = []
    for row in rows[1:]:
        values = [col.get("VarCharValue", "") for col in row.get("Data", [])]
        results.append(dict(zip(headers, values)))
    return results


def run_query_sync(sql: str, timeout_seconds: int = 30) -> list[dict]:
    """
    Convenience function: run query + wait + return results in one call.
    """
    execution_id = run_query(sql)
    wait_for_query(execution_id, timeout_seconds=timeout_seconds)
    return get_query_results(execution_id)
