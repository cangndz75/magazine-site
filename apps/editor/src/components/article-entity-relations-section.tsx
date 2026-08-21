"use client";

import { ENTITY_ROLE, ENTITY_STATUS, type EntityRole } from "@magazine/domain";
import {
  formatEntityKindLabel,
  formatEntityLabel,
} from "@/lib/content/lookup-labels";
import type { ArticleEditorEntity } from "@/lib/content/article-relation-state";
import { EntityRelationPicker } from "./article-relation-pickers";

const ROLE_LABELS: Record<EntityRole, string> = {
  [ENTITY_ROLE.SUBJECT]: "Ana Konu",
  [ENTITY_ROLE.SECONDARY]: "İlgili",
  [ENTITY_ROLE.MENTIONED]: "Bahsedilen",
};

type Props = {
  entities: ArticleEditorEntity[];
  disabled: boolean;
  onAdd: (entity: { id: string; name: string; kind: string; status: string }) => void;
  onRemove: (entityId: string) => void;
  onRoleChange: (entityId: string, role: EntityRole) => void;
  onMove: (entityId: string, direction: "up" | "down") => void;
};

export function ArticleEntityRelationsSection({
  entities,
  disabled,
  onAdd,
  onRemove,
  onRoleChange,
  onMove,
}: Props) {
  const sorted = entities
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));

  return (
    <section className="space-y-3">
      <EntityRelationPicker
        selected={sorted.map((item) => ({
          id: item.id,
          name: item.name,
          kind: item.kind,
        }))}
        disabled={disabled}
        onAdd={(entity) =>
          onAdd({
            id: entity.id,
            name: entity.name,
            kind: entity.kind,
            status: ENTITY_STATUS.ACTIVE,
          })
        }
        onRemove={onRemove}
      />

      {sorted.length > 0 ? (
        <ul className="space-y-2">
          {sorted.map((entity, index) => (
            <li
              key={entity.id}
              className="flex flex-col gap-2 rounded border border-zinc-200 bg-zinc-50 p-3 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-900">
                  {formatEntityLabel(entity)}
                </p>
                {entity.status === ENTITY_STATUS.ARCHIVED ? (
                  <p role="status" className="text-xs text-amber-800">
                    Bu varlık arşivlenmiş.
                  </p>
                ) : null}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <span className="text-zinc-600">Rol</span>
                <select
                  value={entity.role}
                  disabled={disabled}
                  aria-label={`${entity.name} rolü`}
                  onChange={(event) =>
                    onRoleChange(entity.id, event.target.value as EntityRole)
                  }
                  className="h-8 rounded border border-zinc-300 px-2 text-sm"
                >
                  {Object.entries(ROLE_LABELS).map(([role, label]) => (
                    <option key={role} value={role}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={disabled || index === 0}
                  aria-label={`${entity.name} yukarı taşı`}
                  onClick={() => onMove(entity.id, "up")}
                  className="h-8 rounded border border-zinc-300 px-2 text-xs"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={disabled || index === sorted.length - 1}
                  aria-label={`${entity.name} aşağı taşı`}
                  onClick={() => onMove(entity.id, "down")}
                  className="h-8 rounded border border-zinc-300 px-2 text-xs"
                >
                  ↓
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={`${entity.name} kaldır`}
                  onClick={() => onRemove(entity.id)}
                  className="h-8 rounded border border-zinc-300 px-2 text-xs text-red-700"
                >
                  Kaldır
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
