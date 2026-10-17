"use client";

import type { ReactElement } from "react";
import { Toaster } from "sonner";

/** Toast host for the admin (sonner). Russian close label, dark theme. */
export function AdminToaster(): ReactElement {
  return (
    <Toaster
      theme="dark"
      position="bottom-right"
      richColors
      closeButton
      duration={4000}
      containerAriaLabel="Уведомления"
      toastOptions={{
        style: { fontFamily: "var(--font-sans)" },
        closeButtonAriaLabel: "Закрыть уведомление",
      }}
    />
  );
}
