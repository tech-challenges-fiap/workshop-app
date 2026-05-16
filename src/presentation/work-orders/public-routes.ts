import type { Hono } from "hono";

import type { GetWorkOrderByPublicToken } from "../../application/work-order/get-work-order-by-public-token";
import { mapPublicWorkOrderError } from "./error-mapping";
import { publicTokenParamSchema } from "./schemas";
import type { WorkOrderRouteDependencies } from "./index";

type PublicWorkOrderView = Awaited<ReturnType<GetWorkOrderByPublicToken["execute"]>>;

export function registerPublicWorkOrderRoutes(app: Hono, deps: WorkOrderRouteDependencies): void {
  app.get("/public/work-orders/:token", async (c) => {
    try {
      const params = publicTokenParamSchema.parse({
        token: c.req.param("token"),
      });
      const result = await deps.getWorkOrderByPublicToken.execute({
        publicToken: params.token,
      });

      return c.json(result, 200);
    } catch (error) {
      return mapPublicWorkOrderError(c, error);
    }
  });

  app.get("/public/work-orders/:token/status", async (c) => {
    try {
      const params = publicTokenParamSchema.parse({
        token: c.req.param("token"),
      });
      const result = await deps.getWorkOrderByPublicToken.execute({
        publicToken: params.token,
      });

      return c.json({ status: result.status }, 200);
    } catch (error) {
      return mapPublicWorkOrderError(c, error);
    }
  });

  app.get("/public/work-orders/:token/approval", async (c) => {
    try {
      const params = publicTokenParamSchema.parse({
        token: c.req.param("token"),
      });
      const result = await deps.getWorkOrderByPublicToken.execute({
        publicToken: params.token,
      });

      return c.html(renderApprovalPage(params.token, result), 200);
    } catch (error) {
      return mapPublicWorkOrderError(c, error);
    }
  });
}

function renderApprovalPage(token: string, workOrder: PublicWorkOrderView): string {
  const workOrderId = workOrder.id ?? "unknown";
  const taskItems = workOrder.serviceTasks
    .map((task) => {
      const approveUrl = `/public/work-orders/${token}/service-tasks/${task.serviceTaskId}/approve`;
      const rejectUrl = `/public/work-orders/${token}/service-tasks/${task.serviceTaskId}/reject`;

      return `<li>
            <div>Task ${task.serviceTaskId} - ${task.status} - ${task.amount}</div>
            <form method="post" action="${approveUrl}">
              <button type="submit">Approve</button>
            </form>
            <form method="post" action="${rejectUrl}">
              <button type="submit">Reject</button>
            </form>
          </li>`;
    })
    .join("");

  const content = taskItems.length > 0 ? taskItems : "<li>No service tasks found.</li>";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Work Order Approval</title>
  </head>
  <body>
    <h1>Work Order ${workOrderId}</h1>
    <p>Status: ${workOrder.status}</p>
    <p>Total amount: ${workOrder.totalAmount}</p>
    <ul>
      ${content}
    </ul>
  </body>
</html>`;
}
