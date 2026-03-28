import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import { createTanstackQueryUtils } from '@orpc/tanstack-query'
import type { ContractRouterClient } from '@orpc/contract'
import type { contract } from '@aihackason/contract'

const link = new RPCLink({
  url: '/rpc',
})

export const client: ContractRouterClient<typeof contract> = createORPCClient(link)

export const orpc = createTanstackQueryUtils(client)
