import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { ContractRouterClient } from "@orpc/contract";
import type { contract } from "@aihackason/contract";
import { useAuth } from "../composables/useAuth";

const link = new RPCLink({
  url: `${window.location.origin}/rpc`,
  headers: () => {
    const { token } = useAuth();
    if (token.value) {
      return { Authorization: `Bearer ${token.value}` };
    }
    return {};
  },
});

export const client: ContractRouterClient<typeof contract> = createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);
