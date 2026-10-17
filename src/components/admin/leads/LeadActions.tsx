"use client";

import { RefreshCw, Send } from "lucide-react";
import { useState, type ReactElement } from "react";
import type { LeadStatus } from "@/generated/prisma/enums";
import { resendLead, setLeadStatus } from "@/lib/admin/actions/leads";
import { LEAD_STATUS_LABELS, LEAD_STATUSES } from "@/lib/admin/labels";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Select } from "../ui/inputs";
import { useActionSubmit } from "../ui/useActionSubmit";

function isLeadStatus(value: string): value is LeadStatus {
  return (LEAD_STATUSES as readonly string[]).includes(value);
}

/** Status select (saved immediately) + «Отправить в Telegram повторно». */
export function LeadActions({
  id,
  status,
  telegramSent,
}: {
  id: string;
  status: LeadStatus;
  telegramSent: boolean;
}): ReactElement {
  const [current, setCurrent] = useState<LeadStatus>(status);
  const statusSubmit = useActionSubmit();
  const resendSubmit = useActionSubmit();

  return (
    <div className="flex flex-col gap-5">
      <Field htmlFor="lead-status" label="Статус" hint="Сохраняется сразу.">
        <Select
          id="lead-status"
          value={current}
          disabled={statusSubmit.pending}
          onChange={(event) => {
            const next = event.target.value;
            if (!isLeadStatus(next)) return;
            const previous = current;
            setCurrent(next);
            statusSubmit.run(async () => {
              const result = await setLeadStatus(id, next);
              if (!result.ok) setCurrent(previous);
              return result;
            });
          }}
        >
          {LEAD_STATUSES.map((value) => (
            <option key={value} value={value}>
              {LEAD_STATUS_LABELS[value]}
            </option>
          ))}
        </Select>
      </Field>
      <div className="flex flex-col gap-2">
        <Button
          variant={telegramSent ? "outline" : "secondary"}
          pending={resendSubmit.pending}
          icon={telegramSent ? <RefreshCw className="size-4" aria-hidden /> : <Send className="size-4" aria-hidden />}
          onClick={() => resendSubmit.run(() => resendLead(id))}
        >
          Отправить в Telegram повторно
        </Button>
        <p className="text-xs text-muted">
          {telegramSent ? "Заявка уже доставлена, но её можно отправить ещё раз." : "Заявка не дошла до Telegram — попробуйте отправить снова."}
        </p>
      </div>
    </div>
  );
}
