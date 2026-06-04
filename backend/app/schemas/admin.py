from pydantic import BaseModel


class AdminStats(BaseModel):
    metrics: list[dict[str, str]]
    recentSearches: list[dict[str, str | int]]
    bookingMetrics: dict[str, int | float]
    revenueMetrics: dict[str, int | float]
    propertyMetrics: dict[str, int | float]
    userMetrics: dict[str, int | float]
