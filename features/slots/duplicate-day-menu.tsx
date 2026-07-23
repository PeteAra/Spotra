"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  duplicateSameWeekdayInMonth,
  duplicateWeekdaysInMonth,
} from "@/features/slots/actions";

export function DuplicateDayMenu({
  workspaceId,
  sourceDate,
  weekdayLabel,
  onDone,
}: {
  workspaceId: string;
  sourceDate: string;
  weekdayLabel: string;
  onDone: () => void;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={async () => {
          const result = await duplicateSameWeekdayInMonth({
            workspaceId,
            sourceDate,
          });
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success(
            `Duplicated to all ${weekdayLabel}s (${result.data.created} slots)`,
          );
          onDone();
        }}
      >
        All {weekdayLabel}s
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={async () => {
          const result = await duplicateWeekdaysInMonth({
            workspaceId,
            sourceDate,
          });
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success(
            `Duplicated to weekdays (${result.data.created} slots)`,
          );
          onDone();
        }}
      >
        All weekdays
      </Button>
    </div>
  );
}
