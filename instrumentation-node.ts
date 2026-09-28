import { runVideoAutopilotWorker } from "./lib/creator/autopilot-worker";

// Development-only: no public callbacks or hosted cron exist on localhost.
const local = globalThis as typeof globalThis & {
  videoAutopilotLocalTimer?: ReturnType<typeof setInterval>;
  videoAutopilotLocalBusy?: boolean;
};
if (!local.videoAutopilotLocalTimer) {
  local.videoAutopilotLocalTimer = setInterval(() => {
    if (local.videoAutopilotLocalBusy) return;
    local.videoAutopilotLocalBusy = true;
    void runVideoAutopilotWorker({budgetMs:55_000})
      .catch(error => console.error("Local video worker:", error instanceof Error ? error.message : "Unable to resume job"))
      .finally(() => { local.videoAutopilotLocalBusy = false; });
  }, 15_000);
  local.videoAutopilotLocalTimer.unref();
}
