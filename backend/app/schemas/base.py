from typing import Any, ClassVar

from pydantic import BaseModel, ConfigDict, model_validator


class CamelInputModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    field_aliases: ClassVar[dict[str, str]] = {}

    @model_validator(mode="before")
    @classmethod
    def normalize_camel_aliases(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        normalized = dict(data)
        for camel_name, snake_name in cls.field_aliases.items():
            if camel_name in normalized and snake_name not in normalized:
                normalized[snake_name] = normalized[camel_name]
            normalized.pop(camel_name, None)
        return normalized
