# Trading API Server (Prototype)

This package contains a minimal Express based server intended to mirror the public
`trading-api-labs` endpoints. The implementation currently only returns mock
data but provides the structure for `/v1/quote`, `/v1/price` and `/v1/tokens`
endpoints.

Real implementations would fetch on-chain data or subgraph information to
compute quotes and prices.
